// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpritePaperActor.h"

#include "HktPaperActorVisualDataAsset.h"
#include "HktPaperCharacterTemplate.h"
#include "HktPaperUnlitMaterial.h"
#include "HktSpriteCoreLog.h"
#include "HktSpriteTypes.h"
#include "HktCoreEventLog.h"
#include "HktPresentationState.h"

#include "Camera/PlayerCameraManager.h"
#include "Components/SceneComponent.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "HAL/IConsoleManager.h"
#include "HktSpriteFrameResolver.h"
#include "Materials/MaterialInterface.h"
#include "Math/RotationMatrix.h"
#include "PaperFlipbook.h"
#include "PaperFlipbookComponent.h"

// Facing 산출 시 LastMoveDirXY 갱신 최소 속도(cm/s). 임계 미만은 sticky.
// CrowdHost 와 동일 의미 — 같은 CVar 를 공용한다.
extern TAutoConsoleVariable<float> CVarHktSpriteFacingMinSpeed;

// ----------------------------------------------------------------------------
// 콘솔 변수 — 빌보드 회전 dirty check (PR-5)
// ----------------------------------------------------------------------------
//
// 액터 N개가 매 프레임 SetActorRotation 을 호출하면 transform marshalling 비용이
// 누적된다. yaw 변화량이 임계값 미만이면 회전 적용 자체를 생략 — 위치 갱신은
// 항상 필요하므로 위치만 SetActorLocation 으로 따로 호출한다.
//
//   0.0 → 항상 적용 (PR-5 이전 동작)
//   0.5 → 카메라 yaw 가 0.5도 이상 변할 때만 적용 (기본)
static TAutoConsoleVariable<float> CVarHktPaperSpriteYawDirtyDeg(
	TEXT("hkt.PaperSprite.YawDirtyDeg"),
	0.5f,
	TEXT("AHktSpritePaperActor 빌보드 회전 dirty 임계값(도). ")
	TEXT("Yaw 또는 Pitch 변화량이 이 값 미만이면 SetActorRotation 을 생략. ")
	TEXT("0 이면 항상 적용 (PR-5 이전 동작)."),
	ECVF_Default);

// 빌보드를 카메라 pitch 까지 따라가게 할지 토글. ShoulderView 처럼 pitch 가 바뀌는
// 모드에서는 켜야 sprite 평면이 카메라를 정면으로 본다. RTS-탑다운 같이 pitch 가
// 거의 고정인 모드에서는 꺼서 sprite 직립 유지가 가능.
static TAutoConsoleVariable<int32> CVarHktPaperSpriteViewAlignedBillboard(
	TEXT("hkt.PaperSprite.ViewAlignedBillboard"),
	1,
	TEXT("1: 카메라 위치를 기준으로 view-aligned billboard (pitch 보정 포함). ")
	TEXT("0: yaw 만 추적하는 cylindrical billboard."),
	ECVF_Default);

AHktSpritePaperActor::AHktSpritePaperActor()
{
	PrimaryActorTick.bCanEverTick = true;

	RootScene = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	SetRootComponent(RootScene);

	FlipbookComp = CreateDefaultSubobject<UPaperFlipbookComponent>(TEXT("Flipbook"));
	FlipbookComp->SetupAttachment(RootScene);
	FlipbookComp->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	// Paper2D PaperSprite 의 기본 평면 normal 은 로컬 -Y. 카메라를 정면으로 향하게 하려면
	// 액터 Yaw = CameraYaw - 90° (Tick 의 빌보드 회전 적용 위치 참조).
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

	// 본 경로 머티리얼은 엔진 Paper2D 디폴트(`/Paper2D/MaskedUnlitSpriteMaterial`) 고정.
	// PaperSprite 자산엔 머티리얼을 박지 않으므로(빌더 정책) 여기서 컴포넌트에 명시 적용.
	if (FlipbookComp)
	{
		if (UMaterialInterface* DefaultMat = HktPaperUnlitMaterial::GetDefault())
		{
			FlipbookComp->SetMaterial(0, DefaultMat);
		}
	}
}

// ----------------------------------------------------------------------------
// Apply* — SOA 뷰 → AnimFragment / 위치 캐시
// ----------------------------------------------------------------------------

void AHktSpritePaperActor::ApplyTransform(const FHktTransformView& V)
{
	// 액터는 ActorProcessor::SpawnActorFromResolvedAsset 시점에 RenderLocation 으로
	// spawn 됨 — 이후 ApplyTransform 시점에는 항상 valid. HktSpriteCrowdHost 가 갖는
	// IsZero 폴백은 sprite-host path 전용(액터 lifecycle 우회) 이라 여기선 불필요.
	CachedRenderLocation = V.RenderLocation.Get();
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
		const FVector2D VelXY(Vel.X, Vel.Y);
		AnimFragment.MoveSpeed    = VelXY.Size();
		AnimFragment.FallingSpeed = Vel.Z;

		// Sticky: 임계 이상으로 움직였을 때만 facing 입력 갱신.
		const float MinSpeed = CVarHktSpriteFacingMinSpeed.GetValueOnGameThread();
		if (AnimFragment.MoveSpeed >= MinSpeed)
		{
			AnimFragment.LastMoveDirXY = VelXY;
		}
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

void AHktSpritePaperActor::ApplySprite(const FHktSpriteView& V, int64 Frame, bool bForce)
{
	// F-2: ActorProcessor 의 sprite 패스가 권위 입력을 직접 푸시.
	// 캐시해 두고 Tick 에서 resolve — 동일 프레임 중복 호출 비용 0.
	// Facing 은 서버 권위가 아닌 클라 viewmodel 산출(ApplyMovement 의 LastMoveDirXY 사용).
	if (bForce || V.AnimStartTick.IsDirty(Frame))
	{
		ServerAuthoritativeAnimStartTick = V.AnimStartTick.Get();
	}
	bHasSpriteState = true;
}

// ----------------------------------------------------------------------------
// Tick — 위치 보간 + Flipbook resolve + 빌보드
// ----------------------------------------------------------------------------

void AHktSpritePaperActor::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);

	LocalNowSec += static_cast<double>(DeltaTime);

	// --- 위치 보간 + 빌보드 (PR-5: yaw dirty check) ---
	// 위치는 매 프레임 보간/적용. 회전은 yaw 변화량이 임계값 이상일 때만 적용 —
	// CVar `hkt.PaperSprite.YawDirtyDeg` 로 임계값 조정.
	constexpr float InterpSpeed = 15.f;
	InterpLocation = FMath::VInterpTo(InterpLocation, CachedRenderLocation, DeltaTime, InterpSpeed);

	const FCameraView CamView = QueryCameraView();
	const float CameraYaw     = CamView.Rotation.Yaw;

	// --- 빌보드 타깃 회전 산출 ---
	// PaperSprite 로컬 평면 normal 은 -Y. 카메라를 정면으로 향하려면 액터의 +Y 축이
	// (Actor → Camera) 의 반대 방향(=즉 -Y 가 카메라를 가리킴)이 되도록 회전.
	// MakeFromYZ(YAxis, ZHint): Y 를 우선 정렬하고 Z 는 ZHint 의 직교 성분으로 보정 →
	// sprite 가 가능한 한 직립을 유지하면서 pitch 만 카메라 쪽으로 기울어짐.
	FRotator TargetRot;
	const bool bViewAligned = CVarHktPaperSpriteViewAlignedBillboard.GetValueOnGameThread() != 0;
	if (bViewAligned && CamView.bValid)
	{
		const FVector ToCam = CamView.Location - InterpLocation;
		if (!ToCam.IsNearlyZero())
		{
			const FVector ToCamN = ToCam.GetSafeNormal();
			TargetRot = FRotationMatrix::MakeFromYZ(-ToCamN, FVector::UpVector).Rotator();
		}
		else
		{
			TargetRot = FRotator(0.f, CameraYaw - 90.f, 0.f);
		}
	}
	else
	{
		// Cylindrical billboard: yaw 만 추적.
		// (액터 yaw θ → 로컬 -Y 가 world (sin θ,-cos θ,0); -CameraForward 와 일치시키면 θ = α-90°)
		TargetRot = FRotator(0.f, CameraYaw - 90.f, 0.f);
	}

	const float DirtyDeg = FMath::Max(0.f, CVarHktPaperSpriteYawDirtyDeg.GetValueOnGameThread());
	const float DeltaYaw = bHasAppliedRotation
		? FMath::Abs(FRotator::NormalizeAxis(TargetRot.Yaw   - LastAppliedRotation.Yaw))
		: TNumericLimits<float>::Max();
	const float DeltaPitch = bHasAppliedRotation
		? FMath::Abs(FRotator::NormalizeAxis(TargetRot.Pitch - LastAppliedRotation.Pitch))
		: TNumericLimits<float>::Max();
	const bool bRotDirty = !bHasAppliedRotation || DeltaYaw >= DirtyDeg || DeltaPitch >= DirtyDeg;

	if (bRotDirty)
	{
		SetActorLocationAndRotation(InterpLocation, TargetRot,
			false, nullptr, ETeleportType::TeleportPhysics);
		LastAppliedRotation = TargetRot;
		bHasAppliedRotation = true;
	}
	else
	{
		SetActorLocation(InterpLocation, false, nullptr, ETeleportType::TeleportPhysics);
	}

	if (!Template || !FlipbookComp) return;

	// --- 서버 권위 sprite state (F-2): ApplySprite 가 캐시. 첫 sync 전이면 대기. ---
	if (!bHasSpriteState)
	{
		return;
	}
	const int32 AuthStartTick = ServerAuthoritativeAnimStartTick;

	// --- Facing 은 클라이언트 viewmodel: LastMoveDirXY(world) + 현재 카메라 yaw ---
	// 카메라 회전에 맞춰 facing 이 즉시 따라가도록 매 Tick 재계산. 한 번도
	// 움직이지 않은 엔터티는 카메라 정면(S) 폴백.
	EHktSpriteFacing ClientFacing = EHktSpriteFacing::S;
	if (!AnimFragment.LastMoveDirXY.IsNearlyZero())
	{
		const float DirYawDeg = FMath::RadiansToDegrees(
			FMath::Atan2(AnimFragment.LastMoveDirXY.Y, AnimFragment.LastMoveDirXY.X));
		ClientFacing = HktFacingFromYaw(DirYawDeg, CameraYaw);
	}
	const uint8 RawFacing = static_cast<uint8>(ClientFacing);

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

	// --- 진단 로그: (ClientFacing → StoredFacing/KeyDir → Flipbook) 매칭 결과 ---
	// (ResolvedTag, KeyDir, bFlipX) 또는 Flipbook 존재 여부가 직전과 달라질 때만 emit.
	// "ClientFacing 은 바뀌는데 그림이 안 바뀌면" Flipbook 미존재 / NumDirections=1 로 KeyDir 가
	// 항상 0 이라 같은 dir 키만 룩업되는 등의 원인이 즉시 보인다.
	{
		const FHktPaperAnimDirKey Key{ ResolvedTag, KeyDir };
		const TObjectPtr<UPaperFlipbook>* Found = Template->Flipbooks.Find(Key);
		const bool bHasFB = Found && Found->Get() != nullptr;
		const bool bChanged = !bLastDiagSnapshotValid
			|| LastDiagAnimTag != ResolvedTag
			|| LastDiagKeyDir != KeyDir
			|| bLastDiagFlipX != bFlipX
			|| bLastDiagHadFlipbook != bHasFB;
		if (bChanged)
		{
			LastDiagAnimTag = ResolvedTag;
			LastDiagKeyDir = KeyDir;
			bLastDiagFlipX = bFlipX;
			bLastDiagHadFlipbook = bHasFB;
			bLastDiagSnapshotValid = true;
			HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation,
				bHasFB ? EHktLogLevel::Info : EHktLogLevel::Warning,
				EHktLogSource::Client,
				FString::Printf(TEXT("Sprite|PaperActor: AnimResolve InFacing=%d → StoredFacing=%d (NumDir=%d, bMirror=%d, flipX=%d), AnimTag=%s, KeyDir=%u, FB=%s, Flipbooks.Num=%d"),
					static_cast<int32>(InFacing), static_cast<int32>(StoredFacing),
					Meta->NumDirections, Meta->bMirrorWestFromEast ? 1 : 0, bFlipX ? 1 : 0,
					*ResolvedTag.ToString(), KeyDir,
					bHasFB ? TEXT("OK") : TEXT("MISSING"),
					Template->Flipbooks.Num()),
				CachedEntityId);
		}
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

AHktSpritePaperActor::FCameraView AHktSpritePaperActor::QueryCameraView() const
{
	FCameraView Out;
	UWorld* World = GetWorld();
	if (!World) return Out;
	APlayerController* PC = World->GetFirstPlayerController();
	if (!PC || !PC->PlayerCameraManager) return Out;
	Out.Location = PC->PlayerCameraManager->GetCameraLocation();
	Out.Rotation = PC->PlayerCameraManager->GetCameraRotation();
	Out.bValid   = true;
	return Out;
}
