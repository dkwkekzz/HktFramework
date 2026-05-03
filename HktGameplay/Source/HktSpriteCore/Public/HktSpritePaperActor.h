// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "GameplayTagContainer.h"
#include "HktCoreDefs.h"
#include "HktSpriteAnimProcessor.h"
#include "Actors/IHktPresentableActor.h"
#include "HktSpritePaperActor.generated.h"

class USceneComponent;
class UPaperFlipbookComponent;
class UPaperFlipbook;
class UHktPaperCharacterTemplate;
class UHktTagDataAsset;

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
 * Apply 흐름:
 *  - ApplyTransform     : RenderLocation 캐시 (Tick 에서 보간)
 *  - ApplyAnimation     : Tag 컨테이너 → AnimFragment (HktSpriteAnimProcessor 위임)
 *  - ApplyMovement      : bIsMoving / bIsFalling / Velocity → AnimFragment
 *  - ApplyCombat        : MotionPlayRate / AttackSpeed / CPRatio → AnimFragment
 *  - OnVisualAssetLoaded: UHktPaperActorVisualDataAsset → Template 캐싱
 *
 * Tick 에서 매 프레임:
 *  1. 위치 보간 (RenderLocation → InterpLocation)
 *  2. ResolveRenderOutputs(AnimFragment) → (AnimTag, PlayRate)
 *  3. F-3 룩업: UHktPresentationSubsystem → FHktSpriteView::Facing
 *  4. ResolveStoredFacing → KeyDir + bFlipX (W/SW/NW 미러)
 *  5. (AnimTag, KeyDir) 변경 시 Template->Flipbooks[{...}] → SetFlipbook
 *  6. ElapsedSec = (NowLocalSec - AnimStartLocalSec) * PlayRate
 *     SetPlaybackPosition / 마지막 권위 AnimStartTick 변화 감지
 *  7. RelativeScale3D.X = bFlipX ? -1 : +1
 *  8. RootScene yaw = CameraYaw (빌보드)
 */
UCLASS(Blueprintable)
class HKTSPRITECORE_API AHktSpritePaperActor : public AActor, public IHktPresentableActor
{
	GENERATED_BODY()

public:
	AHktSpritePaperActor();

	virtual void Tick(float DeltaTime) override;

	// === IHktPresentableActor ===
	virtual void SetEntityId(FHktEntityId InEntityId) override { CachedEntityId = InEntityId; }
	virtual void OnVisualAssetLoaded(UHktTagDataAsset* InAsset) override;
	virtual void ApplyTransform(const FHktTransformView& V) override;
	virtual void ApplyAnimation(FHktAnimationView& V, int64 Frame, bool bForce) override;
	virtual void ApplyMovement(const FHktMovementView& V, int64 Frame, bool bForce) override;
	virtual void ApplyCombat(const FHktCombatView& V, int64 Frame, bool bForce) override;

protected:
	UPROPERTY(VisibleAnywhere, Category = "HKT|PaperSprite")
	TObjectPtr<USceneComponent> RootScene;

	UPROPERTY(VisibleAnywhere, Category = "HKT|PaperSprite")
	TObjectPtr<UPaperFlipbookComponent> FlipbookComp;

private:
	/** 카메라 yaw 조회 (PlayerCameraManager). 미초기화 시 0. */
	float QueryCameraYaw() const;

	/** F-3: PresentationSubsystem 에서 자기 EntityId 의 FHktSpriteView 직접 read. */
	bool QueryServerSpriteState(uint8& OutFacing, int32& OutAuthoritativeAnimStartTick) const;

	/** (AnimTag, DirIdx) 변경 시 Flipbook 리바인드. */
	void RebindFlipbookIfNeeded(const FGameplayTag& AnimTag, uint8 KeyDir, bool bFlipX,
		const struct FHktPaperAnimMeta& Meta);

	FHktEntityId CachedEntityId = InvalidEntityId;

	UPROPERTY(Transient)
	TObjectPtr<UHktPaperCharacterTemplate> Template;

	/** AnimFragment — HktSpriteAnimProcessor 의 입력 POD. 호스트가 없으므로 액터가 직접 보유. */
	FHktSpriteAnimFragment AnimFragment;

	/** 마지막으로 적용한 (AnimTag, DirIdx, bFlipX) — 동일하면 SetFlipbook 스킵. */
	FGameplayTag CurrentAnimTag;
	uint8        CurrentKeyDir = 0xFF;
	bool         bCurrentFlipX = false;

	/** 서버 권위 AnimStartTick 변경 감지 → 로컬 시각 캡처. */
	int32  LastAuthoritativeAnimStartTick = MIN_int32;
	double AnimStartLocalSec = 0.0;
	double LocalNowSec = 0.0;

	/** 위치 보간 (HktUnitActor 패턴과 동일). */
	FVector CachedRenderLocation = FVector::ZeroVector;
	FVector InterpLocation       = FVector::ZeroVector;
	bool    bHasInitialTransform = false;

	/** 태그 해석 실패 dedup (HktSpriteCrowdHost 와 동일 패턴). */
	bool bLoggedResolveRenderOutputsFailure = false;
};
