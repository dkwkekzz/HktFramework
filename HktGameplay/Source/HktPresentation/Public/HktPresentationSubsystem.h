// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "Subsystems/LocalPlayerSubsystem.h"
#include "GameplayTagContainer.h"
#include "HktCoreDefs.h"
#include "HktWorldView.h"
#include "HktPresentationState.h"
#include "HktPresentationRenderer.h"
#include "Jobs/HktJobQueue.h"
#include "HktPresentationSubsystem.generated.h"

class IHktPlayerInteractionInterface;
class FHktActorRenderer;
class FHktMassEntityRenderer;
class FHktVFXRenderer;
#if ENABLE_HKT_INSIGHTS
class FHktCollisionDebugRenderer;
class FHktTerrainDebugRenderer;
#endif
struct FHktRuntimeEvent;
struct FHktVFXIntent;

/** WorldState → PresentationState → Renderer 파이프라인. LocalPlayer당 1개. */
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

	/** 엔티티의 프레젠테이션 위치 반환. 유효하지 않으면 ZeroVector. */
	FVector GetEntityLocation(FHktEntityId Id) const;

	/** 엔티티에 바인딩된 Actor의 실제 위치 반환. Actor가 없으면 GetEntityLocation 폴백. */
	FVector GetEntityActorLocation(FHktEntityId Id) const;

	/** 현재 Subject 엔티티 ID (디버그 렌더러에서 사용) */
	FHktEntityId GetSubjectEntityId() const { return CurrentSubjectEntityId; }

	/** 외부 렌더러 등록/해제 (예: AHktIngameHUD). 등록 시 기존 State 즉시 Sync. */
	void RegisterRenderer(IHktPresentationRenderer* InRenderer);
	void UnregisterRenderer(IHktPresentationRenderer* InRenderer);

	/** 카메라 뷰가 변경되었음을 알림 (카메라 폰에서 호출). NeedsCameraSync 렌더러만 Sync. */
	void NotifyCameraViewChanged();

	/** 월드 위치에 VFX 재생 (클라이언트 즉시, 서버 무관) */
	void PlayVFXAtLocation(FGameplayTag VFXTag, FVector Location);

	/** Intent 기반 VFX 재생 (AssetBank 퍼지 매칭 + RuntimeOverrides) */
	void PlayVFXWithIntent(const FHktVFXIntent& Intent);

private:
	/** PlayerController 바인딩 (BeginPlay 등에서 호출) */
	void BindInteraction(IHktPlayerInteractionInterface* InInteraction);
	void UnbindInteraction();

	void OnWorldViewUpdated(const FHktWorldView& View);
	void OnIntentSubmitted(const FHktRuntimeEvent& Event);
	void OnSubjectChanged(FHktEntityId NewSubject);
	void OnTargetChanged(FHktEntityId NewTarget);
	void ProcessInitialSync(const FHktWorldView& View);
	void ProcessDiff(const FHktWorldView& View);
	void SyncRenderers();

	/** State 변경 시 전체 Sync, 아니면 NeedsTick인 렌더러만 Sync */
	void OnTick(float DeltaSeconds);

	FDelegateHandle TickHandle;
	FHktPresentationState State;
	FHktJobQueue JobQueue;

	/** IHktPresentationRenderer::Sync 루프에 참여하는 모든 렌더러 */
	TArray<IHktPresentationRenderer*> Renderers;

	/** 렌더러별 전용 API 접근용 (PlayVFX 등). TSharedPtr — 전방선언 호환. */
	TSharedPtr<FHktActorRenderer> ActorRenderer;
	TSharedPtr<FHktMassEntityRenderer> MassEntityRenderer;
	TSharedPtr<FHktVFXRenderer> VFXRenderer;
#if ENABLE_HKT_INSIGHTS
	TSharedPtr<FHktCollisionDebugRenderer> CollisionDebugRenderer;
	TSharedPtr<FHktTerrainDebugRenderer> TerrainDebugRenderer;
#endif

	IHktPlayerInteractionInterface* BoundInteraction = nullptr;
	FDelegateHandle WorldViewHandle;
	FDelegateHandle IntentSubmittedHandle;
	FDelegateHandle SubjectChangedHandle;
	FDelegateHandle TargetChangedHandle;

	/** 현재 선택된 Subject/Target 엔터티 (VFX 추적용) */
	FHktEntityId CurrentSubjectEntityId = InvalidEntityId;
	FHktEntityId CurrentTargetEntityId = InvalidEntityId;

	bool bInitialSyncDone = false;
	bool bStateDirty = false;
};
