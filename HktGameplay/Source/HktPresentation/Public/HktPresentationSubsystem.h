// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "Subsystems/LocalPlayerSubsystem.h"
#include "GameplayTagContainer.h"
#include "HktCoreDefs.h"
#include "HktWorldView.h"
#include "HktPresentationState.h"
#include "HktPresentationProcessor.h"
#include "HktPresentationSubsystem.generated.h"

class IHktPlayerInteractionInterface;
class FHktActorProcessor;
class FHktMassEntityProcessor;
class FHktVFXProcessor;
#if ENABLE_HKT_INSIGHTS
class FHktCollisionDebugProcessor;
class FHktTerrainDebugProcessor;
class FHktHitboxDebugProcessor;
#endif
struct FHktRuntimeEvent;
struct FHktVFXIntent;

/** WorldState → PresentationState → Processor 파이프라인. LocalPlayer당 1개. */
UCLASS()
class HKTPRESENTATION_API UHktPresentationSubsystem : public ULocalPlayerSubsystem
{
	GENERATED_BODY()

public:
	static UHktPresentationSubsystem* Get(APlayerController* PC);

	virtual bool ShouldCreateSubsystem(UObject* Outer) const override;
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

	// === ULocalPlayerSubsystem ===
	virtual void PlayerControllerChanged(APlayerController* NewPlayerController) override;

	const FHktPresentationState& GetState() const { return State; }

	/** 클라 산출 viewmodel 값을 직접 기록할 때만 사용 (예: 스프라이트 Facing).
	 *  WorldState delta 적용 경로(서버 권위)는 ProcessDiff 내부 dispatcher 만 사용. */
	FHktPresentationState& GetMutableState() { return State; }

	/** 엔티티의 프레젠테이션 위치 반환. 유효하지 않으면 ZeroVector. */
	FVector GetEntityLocation(FHktEntityId Id) const;

	/** 엔티티에 바인딩된 Actor의 실제 위치 반환. Actor가 없으면 GetEntityLocation 폴백. */
	FVector GetEntityActorLocation(FHktEntityId Id) const;

	/** 카메라/UI 추적용 "시각적 중앙" 위치. Actor 가 IHktPresentableActor 면 위임,
	 *  아니면 GetEntityActorLocation 폴백. */
	FVector GetEntityFocusLocation(FHktEntityId Id) const;

	/** 월드 UI(EntityHud 등) 가 머리 위에 떠야 할 앵커 위치 (= 캡슐 상단).
	 *  Actor 가 IHktPresentableActor 면 GetHudAnchorWorldLocation 위임, 아니면 ActorLocation 폴백. */
	FVector GetEntityHudAnchorLocation(FHktEntityId Id) const;

	/** 현재 Subject 엔티티 ID (디버그 프로세서에서 사용) */
	FHktEntityId GetSubjectEntityId() const { return CurrentSubjectEntityId; }

	/** 외부 Processor 등록/해제 (예: AHktIngameHUD). 등록 시 기존 State 즉시 Sync. */
	void RegisterRenderer(IHktPresentationProcessor* InProcessor);
	void UnregisterRenderer(IHktPresentationProcessor* InProcessor);

	/** 카메라 뷰가 변경되었음을 알림 (카메라 폰에서 호출). NeedsCameraSync Processor만 Sync. */
	void NotifyCameraViewChanged();

	/** 월드 위치에 VFX 재생 (클라이언트 즉시, 서버 무관) */
	void PlayVFXAtLocation(FGameplayTag VFXTag, FVector Location);

	/** Intent 기반 VFX 재생 (AssetBank 퍼지 매칭 + RuntimeOverrides) */
	void PlayVFXWithIntent(const FHktVFXIntent& Intent);

private:
	void BindInteraction(IHktPlayerInteractionInterface* InInteraction);
	void UnbindInteraction();

	void OnWorldViewUpdated(const FHktWorldView& View);
	void OnIntentSubmitted(const FHktRuntimeEvent& Event);
	void OnSubjectChanged(FHktEntityId NewSubject);
	void OnTargetChanged(FHktEntityId NewTarget);

	/**
	 * Subject/Target 선택 상태를 DrawDebug 로 그린다. CVar hkt.selection.debug.draw 가 ON 일 때 매 틱.
	 * Target 이 VoxelTargetEntityId 면 PC 의 GetCurrentVoxelTarget() 을 조회해 voxel AABB 를 그린다.
	 */
	void DrawSelectionDebug() const;
	void ProcessInitialSync(const FHktWorldView& View);
	void ProcessDiff(const FHktWorldView& View);
	void SyncProcessors();

	void OnTick(float DeltaSeconds);

#if ENABLE_HKT_INSIGHTS
	/** PresentationState 의 모든 엔티티/View 를 FHktCoreDataCollector 에 publish (매 OnTick). */
	void PublishStateToCollector();
#endif

	FDelegateHandle TickHandle;
	FHktPresentationState State;

	/** Tick/Sync 루프에 참여하는 모든 Processor */
	TArray<IHktPresentationProcessor*> Processors;

	/** Processor별 전용 API 접근용. TSharedPtr — 전방선언 호환. */
	TSharedPtr<FHktActorProcessor> ActorProcessor;
	TSharedPtr<FHktMassEntityProcessor> MassEntityProcessor;
	TSharedPtr<FHktVFXProcessor> VFXProcessor;
#if ENABLE_HKT_INSIGHTS
	TSharedPtr<FHktCollisionDebugProcessor> CollisionDebugProcessor;
	TSharedPtr<FHktTerrainDebugProcessor> TerrainDebugProcessor;
	TSharedPtr<FHktHitboxDebugProcessor> HitboxDebugProcessor;
#endif

	IHktPlayerInteractionInterface* BoundInteraction = nullptr;
	FDelegateHandle WorldViewHandle;
	FDelegateHandle IntentSubmittedHandle;
	FDelegateHandle SubjectChangedHandle;
	FDelegateHandle TargetChangedHandle;

	FHktEntityId CurrentSubjectEntityId = InvalidEntityId;
	FHktEntityId CurrentTargetEntityId = InvalidEntityId;

	bool bInitialSyncDone = false;
	bool bStateDirty = false;
};
