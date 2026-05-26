// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktHUD.h"
#include "HktCoreDefs.h"
#include "HktPresentationProcessor.h"
#include "HktPresentationState.h"
#include "IHktEntityHudHitTestProvider.h"
#include "HktIngameHUD.generated.h"

class UHktWidgetEntityHudDataAsset;
class UHktWorldViewAnchorStrategy;
class UHktPresentationSubsystem;

/**
 * 인게임 맵 전용 HUD.
 * IHktPresentationProcessor를 구현하여 PresentationSubsystem으로부터 Sync를 수신합니다.
 * 카메라 이동 등 클라이언트 변경 시에도 엔티티 위젯 위치가 실시간 반영됩니다.
 */
UCLASS()
class HKTUI_API AHktIngameHUD : public AHktHUD, public IHktPresentationProcessor, public IHktEntityHudHitTestProvider
{
	GENERATED_BODY()

public:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

	/** 캔버스 즉시 모드 드로우 — 커서 숨김(ShoulderView 마우스룩) 시 화면 중앙 조준점 레티클 표시. */
	virtual void DrawHUD() override;

	// --- IHktPresentationProcessor ---
	virtual void Sync(FHktPresentationState& State) override;
	virtual void Teardown() override;
	virtual bool NeedsCameraSync() const override { return true; }
	virtual void OnCameraViewChanged(FHktPresentationState& State) override;

	// --- IHktEntityHudHitTestProvider ---
	virtual bool GetEntityUnderScreenPosition(const FVector2D& ScreenPos, FHktEntityId& OutEntityId) const override;

protected:
	/** 인게임 뷰포트 위젯 태그 (기본값: Widget.IngameHud) */
	UPROPERTY(EditDefaultsOnly, Category = "Hkt|UI")
	FGameplayTag IngameWidgetTag;

	/** 엔티티 HUD 위젯 태그 (기본값: Widget.EntityHud) */
	UPROPERTY(EditDefaultsOnly, Category = "Hkt|UI")
	FGameplayTag EntityWidgetTag;

	/**
	 * DataAsset 미제공 시 폴백 — 캡슐 머리 기준 월드 오프셋 (cm).
	 * Z 가 머리 위 여백. EntityHud DataAsset 이 자체 WorldOffset 을 정의하면 그 값이 우선.
	 */
	UPROPERTY(EditDefaultsOnly, Category = "Hkt|UI")
	FVector EntityHudWorldOffset = FVector(0.f, 0.f, 20.f);

private:
	/** 화면 중앙 십자형 조준점 레티클을 캔버스에 그린다. */
	void DrawShoulderReticle();

	void SyncEntityElements(const FHktPresentationState& State);
	void CreateEntityElement(FHktEntityId EntityId, const FHktPresentationState& State);
	void UpdateEntityPositions(const FHktPresentationState& State);
	void UpdateEntityProperties(const FHktPresentationState& State);

	/** 엔터티가 월드에 HUD를 가져야 하는지 — 아이템이면 Ground 상태일 때만 */
	static bool ShouldDisplayHud(const FHktPresentationState& State, FHktEntityId Id);

	UPROPERTY()
	TObjectPtr<UHktWidgetEntityHudDataAsset> CachedEntityHudAsset;

	UPROPERTY()
	TObjectPtr<UHktPresentationSubsystem> CachedPresentationSubsystem;

	bool bInitialSyncDone = false;
	TSet<FHktEntityId> TrackedEntities;
};
