// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "GameplayTagContainer.h"
#include "IHktUIView.h"
#include "HktHUD.generated.h"

class UHktUIElement;
class UHktUIAnchorStrategy;
class IHktUIViewFactory;
class APlayerController;
class IHktPlayerInteractionInterface;
class SConstraintCanvas;

/**
 * 뷰포트 UI의 진입점.
 * AssetSubsystem으로 UI DataAsset을 비동기 로드하고, 로드 완료 시 위젯을 생성합니다.
 * 전체 UI 트리(RootElement, MainCanvasWidget, EntityUIMap)와 PlayerInteraction을 관리합니다.
 */
UCLASS()
class HKTUI_API AHktHUD : public AHUD
{
	GENERATED_BODY()

public:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

	/** 현재 PlayerController의 IHktPlayerInteractionInterface (없으면 nullptr) */
	IHktPlayerInteractionInterface* GetPlayerInteraction() const { return PlayerInteraction; }

	/** 뷰와 전략을 받아 Element를 생성하고 트리/캔버스에 등록 */
	UHktUIElement* CreateElement(TSharedPtr<IHktUIView> InView, UHktUIAnchorStrategy* InStrategy, UHktUIElement* Parent = nullptr);

	/** Entity ID에 해당하는 Element를 반환. 없으면 새로 생성하여 등록 후 반환 */
	UHktUIElement* GetOrAddEntityElement(int32 EntityID);

	/** Entity ID에 해당하는 Element를 제거 (맵에서만 제거, 객체 파괴는 호출측에서) */
	void RemoveEntityElement(int32 EntityID);

	/** Entity ID에 해당하는 Element를 찾아 반환 (없으면 nullptr) */
	UHktUIElement* FindEntityElement(int32 EntityID) const;

	/** Element의 View를 메인 캔버스에 추가 (CreateElement 시 자동 호출됨) */
	void AddElementToCanvas(UHktUIElement* Element);

	/** Element의 View를 메인 캔버스에서 제거 */
	void RemoveElementFromCanvas(UHktUIElement* Element);

	/** 전체 Element의 스크린 좌표 재계산 + 캔버스 슬롯 반영. OnWorldViewUpdated에서 호출. */
	void UpdateAllElements();

protected:
	/**
	 * 태그에 해당하는 UI DataAsset을 비동기 로드한 뒤 CreateView/CreateStrategy로 Element 생성 및 등록.
	 * @param WidgetTag 로드할 위젯의 GameplayTag (HktAsset 태그 맵과 매핑)
	 * @param OnCreated 로드 및 생성 완료 시 호출되는 콜백 (nullptr 가능)
	 */
	void LoadAndCreateWidget(FGameplayTag WidgetTag, TFunction<void(UHktUIElement*)> OnCreated = nullptr);

	/** 엔티티 UI 생성/제거/갱신. 서브클래스에서 오버라이드하여 구현. */
	virtual void UpdateEntityUI();

private:
	void BindPlayerInteraction(APlayerController* PC);
	void UnbindPlayerInteraction();

	TWeakObjectPtr<APlayerController> CachedPlayerController;
	IHktPlayerInteractionInterface* PlayerInteraction = nullptr;

	UPROPERTY()
	TObjectPtr<UHktUIElement> RootElement;

	TSharedPtr<SConstraintCanvas> MainCanvasWidget;

	UPROPERTY()
	TMap<int32, TObjectPtr<UHktUIElement>> EntityUIMap;
};
