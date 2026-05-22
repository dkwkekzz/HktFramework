// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpritePaperActor.h"

#include "HktPaperActorVisualDataAsset.h"
#include "HktPaperAnimationDataAsset.h"
#include "HktPaperUnlitMaterial.h"
#include "HktRuntimeTags.h"
#include "HktSpriteCoreLog.h"
#include "HktSpriteTypes.h"
#include "HktCoreEventLog.h"
#include "HktPresentationState.h"
#include "HktPresentationSubsystem.h"

#include "Camera/PlayerCameraManager.h"
#include "Components/CapsuleComponent.h"
#include "Components/SceneComponent.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "HAL/IConsoleManager.h"
#include "HktSpriteFrameResolver.h"
#include "Materials/MaterialInterface.h"
#include "Math/RotationMatrix.h"
#include "PaperFlipbook.h"
#include "PaperFlipbookComponent.h"
#include "PaperSprite.h"

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

	// HitCapsule — click pick 전용. RootScene 에 부착 + absolute rotation 으로 billboard 회전(특히
	// pitch) 영향을 차단한다. 크기는 VM property 가 권위 — ApplyPhysics 에서 CollisionRadius/
	// CollisionHalfHeight 를 그대로 SetCapsuleSize. 생성자 기본값은 HktUnitActor 의 캡슐 폴백
	// (R=50, HH=90) 과 동일.
	// HktCore 의 entity 위치는 *발* 기준 (RenderLocation = foot). UCapsuleComponent origin = 캡슐
	// 중심이므로 RelLoc.Z = HalfHeight 로 두면 캡슐 발이 ActorLocation 에 정확히 닿는다.
	HitCapsule = CreateDefaultSubobject<UCapsuleComponent>(TEXT("HitCapsule"));
	HitCapsule->SetupAttachment(RootScene);
	HitCapsule->SetUsingAbsoluteRotation(true);
	HitCapsule->SetRelativeLocation(FVector(0.f, 0.f, 90.f));
	HitCapsule->InitCapsuleSize(50.f, 90.f);
	HitCapsule->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
	HitCapsule->SetCollisionResponseToAllChannels(ECR_Ignore);
	HitCapsule->SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);
	HitCapsule->SetGenerateOverlapEvents(false);
	HitCapsule->SetCanEverAffectNavigation(false);
	HitCapsule->bHiddenInGame = true;
}

// ----------------------------------------------------------------------------
// 시각적 중앙 위치 (카메라 추적용)
// ----------------------------------------------------------------------------

FVector AHktSpritePaperActor::GetFocusWorldLocation() const
{
	// PaperSprite ActorLocation 은 발(엔티티 좌표) 기준. 빌보드 yaw / X-Flip 으로 인해
	// FlipbookComp 바운드의 XY 는 매 프레임 흔들리므로 XY 는 ActorLocation 을 그대로 쓰고
	// Z 만 sprite 바운드 중앙에서 가져와 카메라 시선이 캐릭터 중앙을 향하도록 한다.
	const FVector Loc = GetActorLocation();
	if (FlipbookComp && FlipbookComp->IsRegistered())
	{
		const FBoxSphereBounds B = FlipbookComp->Bounds;
		if (B.BoxExtent.Z > KINDA_SMALL_NUMBER)
		{
			return FVector(Loc.X, Loc.Y, B.Origin.Z);
		}
	}
	return Loc;
}

FVector AHktSpritePaperActor::GetHudAnchorWorldLocation() const
{
	// RootScene 이 루트 — ActorLocation = 엔티티 발(=캡슐 바닥).
	// HitCapsule 은 RelLoc.Z = HalfHeight (중심), 따라서 캡슐 상단 = 발 + 2*HalfHeight.
	const FVector Loc = GetActorLocation();
	const float HalfHeight = HitCapsule ? HitCapsule->GetScaledCapsuleHalfHeight() : 90.f;
	return Loc + FVector(0.f, 0.f, 2.f * HalfHeight);
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

	// 우선순위: AnimationAsset ≻ StaticSprite.
	Animation       = PaperVisual->AnimationAsset;
	StaticSprite    = PaperVisual->StaticSprite.LoadSynchronous();
	bStaticSpriteApplied = false;

	if (!Animation && !StaticSprite)
	{
		UE_LOG(LogHktSpriteCore, Warning,
			TEXT("AHktSpritePaperActor[%d]: Visual 의 AnimationAsset/StaticSprite 가 모두 비어 있음 (%s)"),
			CachedEntityId, *GetNameSafe(InAsset));
	}

	// 본 경로 머티리얼은 엔진 Paper2D 디폴트(`/Paper2D/MaskedUnlitSpriteMaterial`) 고정.
	if (FlipbookComp)
	{
		if (UMaterialInterface* DefaultMat = HktPaperUnlitMaterial::GetDefault())
		{
			FlipbookComp->SetMaterial(0, DefaultMat);
		}
	}
}

// 내부 헬퍼 — Animation 자산에서 메타 + Flipbook 룩업.
// 정적 경로(Animation null) 에서는 호출되지 않는다.
namespace
{
	const FHktPaperAnimMeta* ResolveMeta(UHktPaperAnimationDataAsset* Anim,
		const FGameplayTag& InTag, FGameplayTag& OutTag)
	{
		if (Anim) return Anim->FindAnimationOrFallback(InTag, &OutTag);
		return nullptr;
	}
	UPaperFlipbook* ResolveFlipbook(UHktPaperAnimationDataAsset* Anim, const FHktPaperAnimDirKey& Key)
	{
		if (Anim)
		{
			if (const TObjectPtr<UPaperFlipbook>* Found = Anim->Flipbooks.Find(Key))
				return Found->Get();
		}
		return nullptr;
	}
	int32 ResolveFlipbookCount(UHktPaperAnimationDataAsset* Anim)
	{
		if (Anim) return Anim->Flipbooks.Num();
		return 0;
	}

	// 자산 pivot 과 무관하게 sprite 의 바닥이 ActorLocation(=발) 에 닿게 하는 보정값(cm).
	// UPaperSprite::GetRenderBounds 는 sprite-local 공간 bounds 를 돌려준다 — Paper2D 의
	// sprite 평면은 로컬 XZ, 수직축은 Z 라 Min.Z 가 sprite 바닥의 로컬 좌표가 된다.
	//   - bottom-center pivot 자산: Min.Z = 0   → 보정 0
	//   - center pivot 자산:        Min.Z = -H/2 → +H/2 만큼 위로 올려야 바닥 = 발
	// HISM 경로의 CPD-기반 (CellH - Pivot.Y) 오프셋과 동일 의미 — Paper2D 경로에서는
	// FlipbookComp 의 RelativeLocation.Z 로 흡수해 자산-pivot 비종속 렌더를 만든다.
	float ComputeFootAnchorOffsetZ(const UPaperSprite* Sprite)
	{
		if (!Sprite) return 0.f;
		const FBoxSphereBounds B = Sprite->GetRenderBounds();
		const float BottomLocalZ = B.Origin.Z - B.BoxExtent.Z;
		return -BottomLocalZ;
	}
}

// ----------------------------------------------------------------------------
// Apply* — 권위 입력 캐시만. Anim 의사결정은 Tick 에서 HktSpriteAnimProcessor 로 일원화.
// ----------------------------------------------------------------------------

void AHktSpritePaperActor::ApplyPhysics(const FHktPhysicsView& V, int64 Frame, bool bForce)
{
	// HktUnitActor::ApplyPhysics 와 동일한 패턴 — VM property 1:1 반영.
	// Property 가 0 이면 갱신 자체를 스킵해 생성자 기본값(R=50/HH=90, 중심 Z=90) 유지.
	// 캡슐 중심을 +HalfHeight 만큼 위로 올려 캡슐 발이 entity foot (ActorLocation.Z) 에 닿게 한다 —
	// HktCore narrow-phase 캡슐과 동일 좌표계로 정렬되어야 픽업과 시뮬레이션 충돌이 일치한다.
	if (!bForce && !V.CollisionRadius.IsDirty(Frame) && !V.CollisionHalfHeight.IsDirty(Frame)) return;
	const float Radius = V.CollisionRadius.Get();
	if (Radius <= 0.f) return;
	const float HalfHeight = FMath::Max(V.CollisionHalfHeight.Get(), Radius);
	if (HitCapsule)
	{
		HitCapsule->SetRelativeLocation(FVector(0.f, 0.f, HalfHeight));
		HitCapsule->SetCapsuleSize(Radius, HalfHeight, /*bUpdateOverlaps=*/false);
	}
}

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

void AHktSpritePaperActor::ApplySprite(const FHktSpriteView& V, int64 Frame, bool bForce)
{
	// F-2: ActorProcessor 의 sprite 패스가 권위 입력을 직접 푸시.
	// 캐시해 두고 Tick 에서 TickViewModel(AuthAnimStartTick=...) 입력으로 사용.
	// Facing 은 서버 권위가 아닌 클라 viewmodel 산출(AnimFragment.LastMoveDirXY 사용).
	if (bForce || V.AnimStartTick.IsDirty(Frame))
	{
		ServerAuthoritativeAnimStartTick = V.AnimStartTick.Get();
	}
	bHasSpriteState = true;
}

// ----------------------------------------------------------------------------
// Tick — 위치 보간 + 빌보드 + VM 산출 → Flipbook 적용
// ----------------------------------------------------------------------------

void AHktSpritePaperActor::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);

	// --- 위치 보간 + 빌보드 (PR-5: yaw dirty check) ---
	// 위치는 매 프레임 보간/적용. 회전은 yaw 변화량이 임계값 이상일 때만 적용 —
	// CVar `hkt.PaperSprite.YawDirtyDeg` 로 임계값 조정.
	constexpr float InterpSpeed = 15.f;
	InterpLocation = FMath::VInterpTo(InterpLocation, CachedRenderLocation, DeltaTime, InterpSpeed);

	const FCameraView CamView = QueryCameraView();
	const float CameraYaw     = CamView.Rotation.Yaw;

	// --- 빌보드 타깃 회전 산출 ---
	// PaperSprite 로컬 평면 normal 은 -Y. 카메라 평면에 평행하게 두려면 액터의 -Y 가
	// -CameraForward 방향(=카메라 쪽)을 향해야 한다 → 액터 +Y = +CameraForward.
	// 카메라 forward 는 모든 엔티티에 공통이므로 카메라가 평행 이동해도 회전이 변하지
	// 않는다 — "엔티티→카메라" 광선 기반(시차) 정렬이 만들던 Y축 흔들림 제거.
	// 등가성 확인: 기존 ToCam 경로의 -ToCamN 은 카메라가 엔티티를 정면으로 볼 때
	// +CamForward 와 일치하며, cylindrical 분기의 Yaw=CameraYaw-90° 도 같은 결과.
	FRotator TargetRot;
	const bool bViewAligned = CVarHktPaperSpriteViewAlignedBillboard.GetValueOnGameThread() != 0;
	if (bViewAligned && CamView.bValid)
	{
		const FVector CamForward = CamView.Rotation.Vector();
		if (!CamForward.IsNearlyZero())
		{
			TargetRot = FRotationMatrix::MakeFromYZ(CamForward, FVector::UpVector).Rotator();
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

	if (!FlipbookComp) return;

	// --- 정적 경로 (Animation null, StaticSprite 만 있음) ---
	// 단일 UPaperSprite 를 일회성 바인딩 후 매 프레임 빌보드 회전만 갱신.
	if (!Animation)
	{
		if (StaticSprite && !bStaticSpriteApplied)
		{
			// FlipbookComponent 는 Sprite 직접 바인딩이 불가하므로, 단일-프레임 Flipbook 으로 감싸 사용.
			// 비용 — 액터당 1회 호출이라 무시. PaperSpriteComponent 로 바꾸려면 컴포넌트 교체가 필요해
			// 본 단계에서는 기존 FlipbookComp 재사용.
			UPaperFlipbook* Wrap = NewObject<UPaperFlipbook>(this);
			if (Wrap)
			{
				FPaperFlipbookKeyFrame KF;
				KF.Sprite = StaticSprite;
				KF.FrameRun = 1;
				{
					FScopedFlipbookMutator Mutator(Wrap);
					Mutator.KeyFrames.Add(KF);
					Mutator.FramesPerSecond = 1.f;
				}
				FlipbookComp->SetFlipbook(Wrap);
				FlipbookComp->SetLooping(false);
				FlipbookComp->SetPlaybackPosition(0.f, false);
				FlipbookComp->Stop();

				// 발 앵커 보정 — UPaperSprite pivot 이 bottom-center 가 아닐 때(예: 외부 임포트로
				// center pivot 으로 baked 된 경우) sprite 절반이 ActorLocation(=발) 아래로 매몰되는
				// 증상(예: Paper2D Birch 나무) 차단. HISM 경로의 CPD offset 과 동일 의미를
				// FlipbookComp.RelativeLocation 으로 흡수해 자산 pivot 과 무관하게 동작.
				FlipbookComp->SetRelativeLocation(
					FVector(0.f, 0.f, ComputeFootAnchorOffsetZ(StaticSprite)));
				bStaticSpriteApplied = true;
			}
		}
		return;
	}

	// --- 동적 경로 ---
	// 서버 권위 sprite state (F-2): ApplySprite 가 캐시. 첫 sync 전이면 대기.
	if (!bHasSpriteState)
	{
		return;
	}

	// --- WorldView → Fragment 흡수 + Anim.Action 만료 + VM 산출 (HktSpriteAnimProcessor 단일 출처) ---
	UWorld* W = GetWorld();
	UHktPresentationSubsystem* PS = W ? UHktPresentationSubsystem::Get(W->GetFirstPlayerController()) : nullptr;
	if (!PS) return;
	FHktPresentationState& PState = PS->GetMutableState();
	const int64 Frame = PState.GetCurrentFrame();
	const float MinFacingSpeed = CVarHktSpriteFacingMinSpeed.GetValueOnGameThread();

	// 1) Movement/Combat/Animation 뷰 → Fragment.
	const bool bFacingSourceDirty = HktSpriteAnimProcessor::AbsorbViews(
		AnimFragment, PState, CachedEntityId, Frame, MinFacingSpeed);

	// 2) Per-frame VM 산출 — LocalNowSec advance + ResolveRenderOutputs + Facing.
	FHktSpriteAnimViewModel VM;
	HktSpriteAnimProcessor::TickViewModel(AnimFragment,
		ServerAuthoritativeAnimStartTick,
		static_cast<double>(DeltaTime),
		CameraYaw,
		VM, bLoggedResolveRenderOutputsFailure);

	// 3) Anim.Action.* 자동 만료 (resolve 이후) — Flipbook 의 GetTotalDuration 으로 layer 길이 질의.
	//    이번 프레임의 ResolveRenderOutputs 가 action layer 를 픽한 뒤에 만료 — 다음 프레임의
	//    resolver 가 Locomotion 으로 폴백하도록 한다 (원본 PaperActor 동작 보존).
	UHktPaperAnimationDataAsset* AnimAsset = Animation;
	HktSpriteAnimProcessor::ExpireActionLayers(AnimFragment, AnimFragment.LocalNowSec,
		[AnimAsset](const FGameplayTag& LayerAnimTag) -> float
		{
			// Anim.Action.* 는 일반적으로 단일방향(NumDirections=1) — KeyDir=0 시도.
			const FHktPaperAnimDirKey Key0{ LayerAnimTag, 0 };
			UPaperFlipbook* LayerFB = ResolveFlipbook(AnimAsset, Key0);
			return LayerFB ? LayerFB->GetTotalDuration() : 0.f;
		});

	// 4) facing 소스 dirty 시 SpriteView 에 기록 (HUD/UI 진단용).
	if (bFacingSourceDirty)
	{
		if (FHktSpriteView* MutableSV = PState.GetMutableSprite(CachedEntityId))
		{
			MutableSV->Facing.Set(static_cast<uint8>(VM.Facing), Frame);
			MutableSV->FacingRight.Set(VM.bFacingRight ? 1 : 0, Frame);
		}
	}

	// --- VM 소비: Flipbook 바인드 + 재생 위치 적용 ---

	// Animation 에서 meta 폴백 해석 (없으면 DefaultAnimTag → 첫 원소).
	FGameplayTag ResolvedTag;
	const FHktPaperAnimMeta* Meta = ResolveMeta(Animation, VM.AnimTag, ResolvedTag);
	if (!Meta)
	{
		// 애니메이션 데이터 비어 있음 — 스킵.
		return;
	}

	// --- Facing → 저장 dir + 미러 ---
	// 2슬롯 경로는 ResolveStoredFacing 내부가 bFacingRight 로 직접 결정 (8방향 양자화 우회).
	bool bFlipX = false;
	const EHktSpriteFacing StoredFacing = FHktSpriteAnimation::ResolveStoredFacing(
		VM.Facing, Meta->NumDirections, Meta->bMirrorWestFromEast, bFlipX, VM.bFacingRight);
	const uint8 KeyDir = static_cast<uint8>(StoredFacing);

	// --- 진단 로그: (ClientFacing → StoredFacing/KeyDir → Flipbook) 매칭 결과 ---
	// (ResolvedTag, KeyDir, bFlipX) 또는 Flipbook 존재 여부가 직전과 달라질 때만 emit.
	{
		const FHktPaperAnimDirKey Key{ ResolvedTag, KeyDir };
		UPaperFlipbook* FoundFB = ResolveFlipbook(Animation, Key);
		const bool bHasFB = FoundFB != nullptr;
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
					static_cast<int32>(VM.Facing), static_cast<int32>(StoredFacing),
					Meta->NumDirections, Meta->bMirrorWestFromEast ? 1 : 0, bFlipX ? 1 : 0,
					*ResolvedTag.ToString(), KeyDir,
					bHasFB ? TEXT("OK") : TEXT("MISSING"),
					ResolveFlipbookCount(Animation)),
				CachedEntityId);
		}
	}

	// --- (AnimTag, KeyDir, bFlipX) 변경 시 Flipbook 리바인드 ---
	RebindFlipbookIfNeeded(ResolvedTag, KeyDir, bFlipX, *Meta);

	// --- 재생 위치 진행 ---
	// Meta.FrameDurationMs 를 권위로 — RebindFlipbookIfNeeded 에서 캐시한
	// CurrentMetaTimeScale (= MetaFps / FbIntrinsicFps) 를 ElapsedSec 에 곱해
	// flipbook intrinsic FPS 와 무관하게 DataAsset 값으로 재생 속도를 결정한다.
	// AnimStartLocalSec 은 ResolvedTag 가 바뀐 시점에 리셋되므로 항상 0 부터 재생.
	const float SafeRate = VM.PlayRate > 0.f ? VM.PlayRate : 1.f;
	const double ElapsedSec = (VM.LocalNowSec - VM.AnimStartLocalSec) * static_cast<double>(SafeRate);
	const double ScaledSec = ElapsedSec * static_cast<double>(CurrentMetaTimeScale);
	FlipbookComp->SetPlaybackPosition(static_cast<float>(FMath::Max(ScaledSec, 0.0)), /*bFireEvents=*/false);
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
		UPaperFlipbook* FB = ResolveFlipbook(Animation, Key);
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
		// non-looping flipbook 이 끝에 도달하면 UPaperFlipbookComponent 내부 TickFlipbook 이
		// bPlaying=false 로 자동 전환 → SetFlipbook 은 bPlaying 을 복구하지 않으므로 새 flipbook
		// 바운드 후 명시적으로 Play() 호출. 이후 Tick 의 SetPlaybackPosition 가 매 프레임
		// 권위 위치로 덮어쓰므로 내부 advance 와 충돌하지 않는다 (Actor::Tick 이 component
		// tick 이후 실행). IsPlaying() == true 를 외부에서 게이트로 쓰는 경로도 정상화.
		FlipbookComp->Play();

		// 발 앵커 보정 — 정적 경로와 동일. 동일 anim 안의 모든 프레임은 BuildDirFlipbook 컨벤션
		// 상 같은 cell-pivot 을 공유하므로 키프레임 0 의 sprite 만 조회해도 충분.
		const UPaperSprite* AnchorSprite =
			(FB && FB->GetNumKeyFrames() > 0) ? FB->GetKeyFrameChecked(0).Sprite : nullptr;
		FlipbookComp->SetRelativeLocation(
			FVector(0.f, 0.f, ComputeFootAnchorOffsetZ(AnchorSprite)));

		// DataAsset 의 FrameDurationMs 를 권위로 — 바운드된 flipbook 의 intrinsic FPS 와
		// 차이가 있으면 SetPlaybackPosition 입력에 곱할 스케일을 캐시.
		const float FbFps    = FB ? FB->GetFramesPerSecond() : 0.f;
		const float MetaFps  = (Meta.FrameDurationMs > 0.f) ? (1000.f / Meta.FrameDurationMs) : 0.f;
		CurrentMetaTimeScale = (FbFps > 0.f && MetaFps > 0.f) ? (MetaFps / FbFps) : 1.f;

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
