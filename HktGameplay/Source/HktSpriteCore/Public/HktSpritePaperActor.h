// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "GameplayTagContainer.h"
#include "HktCoreDefs.h"
#include "HktSpriteAnimProcessor.h"
#include "HktSpriteTypes.h"
#include "Actors/IHktPresentableActor.h"
#include "HktSpritePaperActor.generated.h"

class USceneComponent;
class UPaperFlipbookComponent;
class UPaperFlipbook;
class UHktPaperCharacterTemplate;
class UHktTagDataAsset;
struct FHktSpriteView;

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
 *  - ApplySprite        : Facing / AnimStartTick 권위 입력 캐시 (F-2 정식 경로)
 *  - OnVisualAssetLoaded: UHktPaperActorVisualDataAsset → Template 캐싱
 *
 * Tick 에서 매 프레임:
 *  1. 위치 보간 (RenderLocation → InterpLocation)
 *  2. ResolveRenderOutputs(AnimFragment) → (AnimTag, PlayRate)
 *  3. F-2: ApplySprite 가 매 sync 마다 ServerFacing / ServerAnimStartTick 캐시
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
	virtual FVector GetFocusWorldLocation() const override;
	virtual void OnVisualAssetLoaded(UHktTagDataAsset* InAsset) override;
	virtual void ApplyTransform(const FHktTransformView& V) override;
	virtual void ApplyAnimation(FHktAnimationView& V, int64 Frame, bool bForce) override;
	virtual void ApplyMovement(const FHktMovementView& V, int64 Frame, bool bForce) override;
	virtual void ApplyCombat(const FHktCombatView& V, int64 Frame, bool bForce) override;
	virtual void ApplySprite(const FHktSpriteView& V, int64 Frame, bool bForce) override;

protected:
	UPROPERTY(VisibleAnywhere, Category = "HKT|PaperSprite")
	TObjectPtr<USceneComponent> RootScene;

	UPROPERTY(VisibleAnywhere, Category = "HKT|PaperSprite")
	TObjectPtr<UPaperFlipbookComponent> FlipbookComp;

private:
	/** 카메라 위치/회전 조회 (PlayerCameraManager). 미초기화 시 bValid=false. */
	struct FCameraView { FVector Location = FVector::ZeroVector; FRotator Rotation = FRotator::ZeroRotator; bool bValid = false; };
	FCameraView QueryCameraView() const;

	/** (AnimTag, DirIdx) 변경 시 Flipbook 리바인드. */
	void RebindFlipbookIfNeeded(const FGameplayTag& AnimTag, uint8 KeyDir, bool bFlipX,
		const struct FHktPaperAnimMeta& Meta);

	/** 클라 산출 Facing 을 ViewModel(FHktSpriteView) 에 기록. 소스(LastMoveDirXY) 또는
	 *  anim tag 가 dirty 인 시점에만 호출 — 카메라 yaw 회전만으로는 호출하지 않는다. */
	void WriteFacingToViewModel();

	FHktEntityId CachedEntityId = InvalidEntityId;

	UPROPERTY(Transient)
	TObjectPtr<UHktPaperCharacterTemplate> Template;

	/** AnimFragment — HktSpriteAnimProcessor 의 입력 POD. 호스트가 없으므로 액터가 직접 보유. */
	FHktSpriteAnimFragment AnimFragment;

	/** 마지막으로 적용한 (AnimTag, DirIdx, bFlipX) — 동일하면 SetFlipbook 스킵. */
	FGameplayTag CurrentAnimTag;
	uint8        CurrentKeyDir = 0xFF;
	bool         bCurrentFlipX = false;

	/** F-2: ApplySprite 가 매 sync 마다 캐시 — Tick 은 이 값으로 flipbook resolve.
	 *  Facing 은 서버 권위가 아닌 클라이언트 viewmodel(AnimFragment.LastMoveDirXY) 로 산출. */
	bool   bHasSpriteState = false;
	int32  ServerAuthoritativeAnimStartTick = 0;

	/** 서버 권위 AnimStartTick 변경 감지 → 로컬 시각 캡처. */
	int32  LastAuthoritativeAnimStartTick = MIN_int32;
	double AnimStartLocalSec = 0.0;
	double LocalNowSec = 0.0;

	/** 위치 보간 (HktUnitActor 패턴과 동일). */
	FVector CachedRenderLocation = FVector::ZeroVector;
	FVector InterpLocation       = FVector::ZeroVector;
	bool    bHasInitialTransform = false;

	/** 마지막으로 적용한 빌보드 회전. PR-5 dirty check 비교 기준 (Yaw+Pitch). */
	FRotator LastAppliedRotation = FRotator::ZeroRotator;
	bool     bHasAppliedRotation = false;

	/** 태그 해석 실패 dedup (HktSpriteCrowdHost 와 동일 패턴). */
	bool bLoggedResolveRenderOutputsFailure = false;

	/** WriteFacingToViewModel 에서 결정된 facing 캐시 — Tick 은 이 값을 그대로 소비.
	 *  카메라 yaw 변경만으로는 갱신되지 않음(설계 선택 — 이동 dirty 또는 anim tag dirty 시점에만 산출). */
	EHktSpriteFacing LastClientFacing = EHktSpriteFacing::S;
	/** 화면-공간 좌우 sticky (1=우향, 0=좌향). LastMoveDirXY 부호로만 갱신. */
	uint8 LastFacingRight = 1;

	/** Animation 해석(StoredFacing/Flipbook 매칭) 진단 dedup. 마지막으로 emit 한 (AnimTag,KeyDir,bFlipX) 와
	 *  Flipbook 존재 여부를 기억해 전이 시점에만 로그를 남긴다. */
	FGameplayTag LastDiagAnimTag;
	uint8        LastDiagKeyDir = 0xFF;
	bool         bLastDiagFlipX = false;
	bool         bLastDiagHadFlipbook = false;
	bool         bLastDiagSnapshotValid = false;
};
