// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "GameplayTagContainer.h"
#include "HktCoreDefs.h"
#include "HktSelectable.h"
#include "HktSpriteAnimProcessor.h"
#include "HktSpriteTypes.h"
#include "Actors/IHktPresentableActor.h"
#include "HktSpritePaperActor.generated.h"

class USceneComponent;
class UCapsuleComponent;
class UPaperFlipbookComponent;
class UPaperFlipbook;
class UPaperSprite;
class UHktPaperAnimationDataAsset;       // 동적 애니메이션 자산
class UHktTagDataAsset;
struct FHktSpriteView;
struct FHktPhysicsView;

/**
 * AHktSpritePaperActor — Paper2D 경로의 엔터티당 1액터.
 *
 * 표준 `FHktActorProcessor` + `IHktPresentableActor` 파이프라인을 그대로 사용한다.
 * 호스트(`AHktSpriteCrowdHost`)와 무관하게 동작 — Paper2D 는 인스턴싱이 없으므로
 * 엔터티 한 명마다 액터 한 개 + `UPaperFlipbookComponent` 한 개를 들고 다닌다.
 *
 * 구성:
 *  - Root: USceneComponent (빌보드 회전 적용 위치)
 *  - Child: UPaperFlipbookComponent (Sprite 재생, Tint, X-스케일 미러)
 *
 * Apply 흐름 (단일 출처 — HktSpriteAnimProcessor):
 *  - ApplyTransform     : RenderLocation 캐시 (Tick 에서 보간)
 *  - ApplyPhysics       : CollisionRadius/HalfHeight → HitBox
 *  - ApplySprite        : 권위 AnimStartTick 캐시 (Tick 에서 VM 산출 입력)
 *  - OnVisualAssetLoaded: UHktPaperActorVisualDataAsset → Template 캐싱
 *
 *  Anim 의사결정(Movement/Combat/Animation 뷰 흡수 + AnimTag 해석 + Facing 산출 +
 *  Anim.Action 만료)은 모두 HktSpriteAnimProcessor 의 namespace 함수가 담당. Apply*
 *  메서드는 자체 anim 결정 로직을 들고 있지 않다 — 액터는 *set* 만 처리.
 *
 * Tick 에서 매 프레임:
 *  1. 위치 보간 (RenderLocation → InterpLocation) + 빌보드
 *  2. AbsorbViews(현 PresentationState 뷰 → Fragment)
 *  3. ExpireActionLayers(Flipbook duration 콜백)
 *  4. TickViewModel(Fragment, AuthAnimStartTick, DeltaSec, CameraYaw) → VM
 *  5. (facing 소스 dirty 시) SpriteView.Facing 기록
 *  6. VM.AnimTag → Animation->FindAnimationOrFallback → ResolveStoredFacing → Flipbook 바인드
 *  7. SetPlaybackPosition((VM.LocalNowSec - VM.AnimStartLocalSec) * PlayRate)
 *  8. RelativeScale3D.X = bFlipX ? -1 : +1
 */
UCLASS(Blueprintable)
class HKTSPRITECORE_API AHktSpritePaperActor : public AActor, public IHktPresentableActor, public IHktSelectable
{
	GENERATED_BODY()

public:
	AHktSpritePaperActor();

	virtual void Tick(float DeltaTime) override;

	// === IHktPresentableActor ===
	// Anim 의사결정(Movement/Combat/Animation 흡수)은 Tick 의 AbsorbViews 에서 일괄 처리.
	// 액터의 Apply* 는 권위 입력 캐시(ApplySprite) + 시각 자산 적용(ApplyPhysics/ApplyTransform) 만 담당.
	virtual void SetEntityId(FHktEntityId InEntityId) override { CachedEntityId = InEntityId; }
	virtual FVector GetFocusWorldLocation() const override;
	virtual FVector GetHudAnchorWorldLocation() const override;
	virtual void OnVisualAssetLoaded(UHktTagDataAsset* InAsset) override;
	virtual void ApplyTransform(const FHktTransformView& V) override;
	virtual void ApplyPhysics(const FHktPhysicsView& V, int64 Frame, bool bForce) override;
	virtual void ApplySprite(const FHktSpriteView& V, int64 Frame, bool bForce) override;

	// === IHktSelectable ===
	// Paper2D sprite 평면 자체는 collision 이 없으므로(FlipbookComp NoCollision) HitBox 박스에
	// Visibility trace 만 잡아 우클릭/마우스오버 픽을 가능하게 한다. CachedEntityId 가 SetEntityId
	// 이전이면 InvalidEntityId → IsSelectable=false 로 폴백.
	virtual FHktEntityId GetEntityId() const override { return CachedEntityId; }
	virtual bool IsSelectable() const override { return CachedEntityId != InvalidEntityId; }

protected:
	UPROPERTY(VisibleAnywhere, Category = "HKT|PaperSprite")
	TObjectPtr<USceneComponent> RootScene;

	UPROPERTY(VisibleAnywhere, Category = "HKT|PaperSprite")
	TObjectPtr<UPaperFlipbookComponent> FlipbookComp;

	// Click pick 전용 capsule. FlipbookComp 가 NoCollision 이라 Visibility trace 가
	// sprite 평면을 통과하므로, 별도 캡슐로 엔티티 충돌 영역을 덮어 IHktSelectable 픽이 가능하게 한다.
	// 크기는 VM property (CollisionRadius/CollisionHalfHeight) → ApplyPhysics 가 갱신 — sprite
	// 의 visual bound 를 따라가지 않는다 (sprite 크기와 실제 엔티티 충돌 반경이 일치하지 않기 때문).
	// HktCore narrow-phase 가 캡슐-캡슐로 충돌을 푸는 만큼 픽업 형태도 캡슐로 통일해 어긋남을 제거한다.
	// RootScene 에 부착하고 absolute rotation 으로 두어 billboard pitch 회전이 캡슐을 기울이지
	// 않게 한다 (yaw 는 XY 대칭이라 영향 없음). 캡슐 origin = 중심이므로 RelLoc.Z = HalfHeight 로
	// 두면 캡슐 발이 ActorLocation (= entity foot) 에 정확히 닿는다.
	UPROPERTY(VisibleAnywhere, Category = "HKT|PaperSprite")
	TObjectPtr<UCapsuleComponent> HitCapsule;

private:
	/** 카메라 위치/회전 조회 (PlayerCameraManager). 미초기화 시 bValid=false. */
	struct FCameraView { FVector Location = FVector::ZeroVector; FRotator Rotation = FRotator::ZeroRotator; bool bValid = false; };
	FCameraView QueryCameraView() const;

	/** (AnimTag, DirIdx) 변경 시 Flipbook 리바인드. */
	void RebindFlipbookIfNeeded(const FGameplayTag& AnimTag, uint8 KeyDir, bool bFlipX,
		const struct FHktPaperAnimMeta& Meta);

	FHktEntityId CachedEntityId = InvalidEntityId;

	/**
	 * 동적 애니메이션 자산. 비어 있으면 StaticSprite 폴백.
	 * 둘 중 하나라도 채워져 있으면 OnVisualAssetLoaded 가 적절히 캐싱한다.
	 */
	UPROPERTY(Transient)
	TObjectPtr<UHktPaperAnimationDataAsset> Animation;

	/** 정적 객체(나무·바위 등)용 단일 스프라이트. Animation 이 null 일 때만 사용. */
	UPROPERTY(Transient)
	TObjectPtr<UPaperSprite> StaticSprite;

	/** 정적 경로에서 한 번만 SetSprite 하기 위한 가드. */
	bool bStaticSpriteApplied = false;

	/** AnimFragment — HktSpriteAnimProcessor 의 입력 + sticky 상태 POD. 호스트가 없으므로 액터가 직접 보유. */
	FHktSpriteAnimFragment AnimFragment;

	/** 마지막으로 적용한 (AnimTag, DirIdx, bFlipX) — 동일하면 SetFlipbook 스킵. */
	FGameplayTag CurrentAnimTag;
	uint8        CurrentKeyDir = 0xFF;
	bool         bCurrentFlipX = false;

	/** Rebind 시 캐시 — DataAsset Meta.FrameDurationMs 와 바운드된 UPaperFlipbook 의
	 *  intrinsic FramesPerSecond 의 비율. SetPlaybackPosition(seconds) 가 내부적으로
	 *  flipbook 의 FPS 로 초→프레임 변환을 하므로, Meta 를 권위로 만들려면 이 비율을
	 *  ElapsedSec 에 곱해서 보정해야 한다. (Meta.FrameDurationMs ≤ 0 또는 fb FPS 0 이면 1.0) */
	float CurrentMetaTimeScale = 1.f;

	/** F-2: ApplySprite 가 매 sync 마다 캐시 — Tick 은 이 값을 AuthAnimStartTick 입력으로 사용. */
	bool   bHasSpriteState = false;
	int32  ServerAuthoritativeAnimStartTick = 0;

	/** 위치 보간 (HktUnitActor 패턴과 동일). */
	FVector CachedRenderLocation = FVector::ZeroVector;
	FVector InterpLocation       = FVector::ZeroVector;
	bool    bHasInitialTransform = false;

	/** 마지막으로 적용한 빌보드 회전. PR-5 dirty check 비교 기준 (Yaw+Pitch). */
	FRotator LastAppliedRotation = FRotator::ZeroRotator;
	bool     bHasAppliedRotation = false;

	/** 태그 해석 실패 dedup (HktSpriteCrowdHost 와 동일 패턴). */
	bool bLoggedResolveRenderOutputsFailure = false;

	/** Animation 해석(StoredFacing/Flipbook 매칭) 진단 dedup. 마지막으로 emit 한 (AnimTag,KeyDir,bFlipX) 와
	 *  Flipbook 존재 여부를 기억해 전이 시점에만 로그를 남긴다. */
	FGameplayTag LastDiagAnimTag;
	uint8        LastDiagKeyDir = 0xFF;
	bool         bLastDiagFlipX = false;
	bool         bLastDiagHadFlipbook = false;
	bool         bLastDiagSnapshotValid = false;
};
