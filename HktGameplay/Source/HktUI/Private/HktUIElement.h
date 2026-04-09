// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "UObject/NoExportTypes.h"
#include "Widgets/Layout/SConstraintCanvas.h"
#include "HktUIElement.generated.h"

class IHktUIView;
class UHktUIAnchorStrategy;

/**
 * UI 요소를 추상화한 클래스.
 * 계층 구조(Tree) 관리 및 생명주기 담당.
 */
UCLASS(BlueprintType)
class HKTUI_API UHktUIElement : public UObject
{
	GENERATED_BODY()

public:
	virtual void InitializeElement(TSharedPtr<IHktUIView> InView, UHktUIAnchorStrategy* InAnchorStrategy);
	virtual void TickElement(float DeltaTime);

	/** 렌더링 래퍼 및 전략 (설계서상 public) */
	TSharedPtr<IHktUIView> View;

	UPROPERTY()
	TObjectPtr<UHktUIAnchorStrategy> AnchorStrategy;

	FVector2D CachedScreenPosition = FVector2D::ZeroVector;

	/** 이 UI가 추적 중인 Entity ID (Optional). -1이면 미할당 */
	int32 OwnerEntityID = -1;

	// --- Hierarchy (Subsystem CreateElement(Parent)용) ---
	void SetParent(UHktUIElement* InParent);
	UHktUIElement* GetParent() const { return Parent; }
	const TArray<UHktUIElement*>& GetChildren() const { return Children; }

	/** 화면 좌표 Getter (Strategy 계산 결과 캐시) */
	FVector2D GetScreenPosition() const { return CachedScreenPosition; }

	/** SConstraintCanvas 슬롯 포인터 (nullptr이면 캔버스에 미등록) */
	SConstraintCanvas::FSlot* CanvasSlot = nullptr;

	/** 화면 밖 여부 (Strategy 실패 시) */
	bool bIsOnScreen = false;

protected:
	UPROPERTY()
	TObjectPtr<UHktUIElement> Parent;

	UPROPERTY()
	TArray<TObjectPtr<UHktUIElement>> Children;
};
