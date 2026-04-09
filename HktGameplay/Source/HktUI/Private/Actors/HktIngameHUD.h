// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktHUD.h"
#include "HktCoreDefs.h"
#include "HktPresentationRenderer.h"
#include "HktPresentationState.h"
#include "IHktEntityHudHitTestProvider.h"
#include "HktIngameHUD.generated.h"

class UHktWidgetEntityHudDataAsset;
class UHktWorldViewAnchorStrategy;
class UHktPresentationSubsystem;

/**
 * 인게임 맵 전용 HUD.
 * IHktPresentationRenderer를 구현하여 PresentationSubsystem으로부터 Sync를 수신합니다.
 * 카메라 이동 등 클라이언트 변경 시에도 엔티티 위젯 위치가 실시간 반영됩니다.
 */
UCLASS()
class HKTUI_API AHktIngameHUD : public AHktHUD, public IHktPresentationRenderer, public IHktEntityHudHitTestProvider
{
	GENERATED_BODY()

public:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

	// --- IHktPresentationRenderer ---
	virtual void Sync(const FHktPresentationState& State) override;
	virtual void Teardown() override;
	virtual bool NeedsCameraSync() const override { return true; }
	virtual void OnCameraViewChanged(const FHktPresentationState& State) override;

	// --- IHktEntityHudHitTestProvider ---
	virtual bool GetEntityUnderScreenPosition(const FVector2D& ScreenPos, FHktEntityId& OutEntityId) const override;

protected:
	/** 인게임 뷰포트 위젯 태그 (기본값: Widget.IngameHud) */
	UPROPERTY(EditDefaultsOnly, Category = "Hkt|UI")
	FGameplayTag IngameWidgetTag;

	/** 엔티티 HUD 위젯 태그 (기본값: Widget.EntityHud) */
	UPROPERTY(EditDefaultsOnly, Category = "Hkt|UI")
	FGameplayTag EntityWidgetTag;

	/** 엔티티 HUD 머리 위 여백 (CapsuleHalfHeight 위에 추가) */
	UPROPERTY(EditDefaultsOnly, Category = "Hkt|UI")
	float EntityHudHeadClearance = 20.f;

private:
	void SyncEntityElements(const FHktPresentationState& State);
	void CreateEntityElement(FHktEntityId EntityId, const FHktPresentationState& State);
	void UpdateEntityPositions(const FHktPresentationState& State);
	void UpdateEntityProperties(const FHktPresentationState& State);

	UPROPERTY()
	TObjectPtr<UHktWidgetEntityHudDataAsset> CachedEntityHudAsset;

	UPROPERTY()
	TObjectPtr<UHktPresentationSubsystem> CachedPresentationSubsystem;

	bool bInitialSyncDone = false;
	TSet<FHktEntityId> TrackedEntities;
};
