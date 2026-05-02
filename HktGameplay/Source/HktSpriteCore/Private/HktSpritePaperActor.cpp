// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpritePaperActor.h"

#include "HktPaperActorVisualDataAsset.h"
#include "HktPaperCharacterTemplate.h"
#include "HktSpriteCoreLog.h"
#include "HktSpriteTypes.h"
#include "HktPresentationState.h"
#include "HktPresentationSubsystem.h"

#include "Camera/PlayerCameraManager.h"
#include "Components/SceneComponent.h"
#include "Engine/LocalPlayer.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "PaperFlipbook.h"
#include "PaperFlipbookComponent.h"

AHktSpritePaperActor::AHktSpritePaperActor()
{
	PrimaryActorTick.bCanEverTick = true;

	RootScene = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	SetRootComponent(RootScene);

	FlipbookComp = CreateDefaultSubobject<UPaperFlipbookComponent>(TEXT("Flipbook"));
	FlipbookComp->SetupAttachment(RootScene);
	FlipbookComp->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	// Paper2D PaperSprite 의 기본 평면 normal 은 -Y. RootScene 의 Yaw 가 카메라 yaw 를 따라가면서
	// 스프라이트가 카메라를 향한다. 추가 보정(예: yaw + 90) 이 필요하면 PR-3 에서 시각 검증 후 적용.
}

// ----------------------------------------------------------------------------
// 자산 바인딩
// ----------------------------------------------------------------------------

void AHktSpritePaperActor::OnVisualAssetLoaded(UHktTagDataAsset* InAsset)
{
	UHktPaperActorVisualDataAsset* PaperVisual = Cast<UHktPaperActorVisualDataAsset>(InAsset);
	if (!PaperVisual)
	{
		UE_LOG(LogHktSpriteCore, Warning,
			TEXT("AHktSpritePaperActor[%d]: VisualAsset 이 UHktPaperActorVisualDataAsset 가 아님 (%s)"),
			CachedEntityId, *GetNameSafe(InAsset));
		return;
	}
	Template = PaperVisual->Animation;
	if (!Template)
	{
		UE_LOG(LogHktSpriteCore, Warning,
			TEXT("AHktSpritePaperActor[%d]: Visual->Animation 비어 있음 (%s)"),
			CachedEntityId, *GetNameSafe(InAsset));
	}
}

// ----------------------------------------------------------------------------
// Apply* — SOA 뷰 → AnimFragment / 위치 캐시
// ----------------------------------------------------------------------------

void AHktSpritePaperActor::ApplyTransform(const FHktTransformView& V)
{
	const FVector Render = V.RenderLocation.Get();
	CachedRenderLocation = Render.IsZero() ? V.Location.Get() : Render;
	if (!bHasInitialTransform)
	{
		InterpLocation = CachedRenderLocation;
		SetActorLocation(InterpLocation, false, nullptr, ETeleportType::TeleportPhysics);
		bHasInitialTransform = true;
	}
}

void AHktSpritePaperActor::ApplyMovement(const FHktMovementView& V, int64 Frame, bool bForce)
{
	if (bForce || V.bIsMoving.IsDirty(Frame))   AnimFragment.bIsMoving  = V.bIsMoving.Get();
	if (bForce || V.bIsJumping.IsDirty(Frame))  AnimFragment.bIsFalling = V.bIsJumping.Get();
	if (bForce || V.Velocity.IsDirty(Frame))
	{
		const FVector Vel = V.Velocity.Get();
		AnimFragment.MoveSpeed    = FVector2D(Vel.X, Vel.Y).Size();
		AnimFragment.FallingSpeed = Vel.Z;
	}
}

void AHktSpritePaperActor::ApplyCombat(const FHktCombatView& V, int64 Frame, bool bForce)
{
	if (bForce || V.MotionPlayRate.IsDirty(Frame) || V.AttackSpeed.IsDirty(Frame))
	{
		const int32 RawRate = V.MotionPlayRate.Get();
		float SpeedScale = (RawRate > 0)
			? static_cast<float>(RawRate) / 100.0f
			: static_cast<float>(V.AttackSpeed.Get()) / 100.0f;
		if (SpeedScale <= 0.0f) SpeedScale = 1.0f;
		AnimFragment.AttackPlayRate = SpeedScale;
	}
	if (bForce || V.CPRatio.IsDirty(Frame))
	{
		AnimFragment.CPRatio = V.CPRatio.Get();
	}
}

void AHktSpritePaperActor::ApplyAnimation(FHktAnimationView& V, int64 Frame, bool bForce)
{
	if (bForce || V.TagsDirtyFrame == Frame)
	{
		HktSpriteAnimProcessor::SyncFromTagContainer(AnimFragment, V.Tags);
	}
	if (V.PendingAnimTriggers.Num() > 0)
	{
		for (const FGameplayTag& AnimTag : V.PendingAnimTriggers)
		{
			HktSpriteAnimProcessor::ApplyAnimTag(AnimFragment, AnimTag);
		}
		V.PendingAnimTriggers.Reset();
	}
}

// ----------------------------------------------------------------------------
// Tick — 위치 보간 + Flipbook resolve + 빌보드
// ----------------------------------------------------------------------------

void AHktSpritePaperActor::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);

	LocalNowSec += static_cast<double>(DeltaTime);

	// --- 위치 보간 (HktUnitActor 와 동일 패턴) ---
	constexpr float InterpSpeed = 15.f;
	InterpLocation = FMath::VInterpTo(InterpLocation, CachedRenderLocation, DeltaTime, InterpSpeed);
	SetActorLocation(InterpLocation, false, nullptr, ETeleportType::TeleportPhysics);

	// --- 빌보드: RootScene yaw = 카메라 yaw ---
	const float CameraYaw = QueryCameraYaw();
	if (RootScene)
	{
		RootScene->SetWorldRotation(FRotator(0.f, CameraYaw, 0.f));
	}

	if (!Template || !FlipbookComp) return;

	// --- 서버 권위 sprite state (F-3): Facing + AnimStartTick ---
	uint8 RawFacing = static_cast<uint8>(EHktSpriteFacing::S);
	int32 AuthStartTick = 0;
	const bool bHaveServerState = QueryServerSpriteState(RawFacing, AuthStartTick);
	if (!bHaveServerState)
	{
		// 아직 SpriteView 가 도착 전 — 다음 프레임에 재시도. flipbook 미설정 상태로 유지.
		return;
	}

	// --- AnimTag / PlayRate 결정 ---
	FGameplayTag AnimTag;
	float PlayRate = 1.f;
	HktSpriteAnimProcessor::ResolveRenderOutputs(AnimFragment, AnimTag, PlayRate, bLoggedResolveRenderOutputsFailure);

	// Template 에서 anim meta 폴백 해석 (없으면 DefaultAnimTag → 첫 원소).
	FGameplayTag ResolvedTag;
	const FHktPaperAnimMeta* Meta = Template->FindAnimationOrFallback(AnimTag, &ResolvedTag);
	if (!Meta)
	{
		// 캐릭터 데이터 비어 있음 — 스킵.
		return;
	}

	// --- Facing → 저장 dir + 미러 ---
	bool bFlipX = false;
	const EHktSpriteFacing InFacing = static_cast<EHktSpriteFacing>(RawFacing & 0x07);
	const EHktSpriteFacing StoredFacing = FHktSpriteAnimation::ResolveStoredFacing(
		InFacing, Meta->NumDirections, Meta->bMirrorWestFromEast, bFlipX);
	const uint8 KeyDir = static_cast<uint8>(StoredFacing);

	// --- 서버 권위 AnimStartTick 변화 감지 → 로컬 시각 캡처 ---
	if (LastAuthoritativeAnimStartTick != AuthStartTick)
	{
		LastAuthoritativeAnimStartTick = AuthStartTick;
		AnimStartLocalSec = LocalNowSec;
	}

	// --- (AnimTag, KeyDir, bFlipX) 변경 시 Flipbook 리바인드 ---
	RebindFlipbookIfNeeded(ResolvedTag, KeyDir, bFlipX, *Meta);

	// --- 재생 위치 진행 ---
	const float SafeRate = PlayRate > 0.f ? PlayRate : 1.f;
	const double ElapsedSec = (LocalNowSec - AnimStartLocalSec) * static_cast<double>(SafeRate);
	FlipbookComp->SetPlaybackPosition(static_cast<float>(FMath::Max(ElapsedSec, 0.0)), /*bFireEvents=*/false);
}

// ----------------------------------------------------------------------------
// Flipbook 리바인드
// ----------------------------------------------------------------------------

void AHktSpritePaperActor::RebindFlipbookIfNeeded(
	const FGameplayTag& AnimTag, uint8 KeyDir, bool bFlipX, const FHktPaperAnimMeta& Meta)
{
	const bool bSameKey = (AnimTag == CurrentAnimTag) && (KeyDir == CurrentKeyDir);
	const bool bSameFlip = (bFlipX == bCurrentFlipX);
	if (bSameKey && bSameFlip)
	{
		return;
	}

	if (!bSameKey)
	{
		const FHktPaperAnimDirKey Key{ AnimTag, KeyDir };
		const TObjectPtr<UPaperFlipbook>* Found = Template->Flipbooks.Find(Key);
		UPaperFlipbook* FB = Found ? Found->Get() : nullptr;
		if (!FB)
		{
			UE_LOG(LogHktSpriteCore, Verbose,
				TEXT("AHktSpritePaperActor[%d]: Flipbook 미존재 (%s, dir=%u)"),
				CachedEntityId, *AnimTag.ToString(), KeyDir);
			return;
		}
		FlipbookComp->SetFlipbook(FB);
		FlipbookComp->SetLooping(Meta.bLooping);
		FlipbookComp->SetSpriteColor(Meta.Tint);
		CurrentAnimTag = AnimTag;
		CurrentKeyDir  = KeyDir;
	}

	if (!bSameFlip)
	{
		// 미러: PaperFlipbookComponent 의 X-스케일 반전.
		FVector Scale = FlipbookComp->GetRelativeScale3D();
		Scale.X = bFlipX ? -FMath::Abs(Scale.X) : FMath::Abs(Scale.X);
		FlipbookComp->SetRelativeScale3D(Scale);
		bCurrentFlipX = bFlipX;
	}
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

float AHktSpritePaperActor::QueryCameraYaw() const
{
	UWorld* World = GetWorld();
	if (!World) return 0.f;
	APlayerController* PC = World->GetFirstPlayerController();
	if (!PC || !PC->PlayerCameraManager) return 0.f;
	return PC->PlayerCameraManager->GetCameraRotation().Yaw;
}

bool AHktSpritePaperActor::QueryServerSpriteState(uint8& OutFacing, int32& OutAuthoritativeAnimStartTick) const
{
	UWorld* World = GetWorld();
	if (!World) return false;
	APlayerController* PC = World->GetFirstPlayerController();
	UHktPresentationSubsystem* PS = UHktPresentationSubsystem::Get(PC);
	if (!PS) return false;
	const FHktSpriteView* SV = PS->GetState().GetSprite(CachedEntityId);
	if (!SV) return false;
	OutFacing = SV->Facing.Get();
	OutAuthoritativeAnimStartTick = SV->AnimStartTick.Get();
	return true;
}
