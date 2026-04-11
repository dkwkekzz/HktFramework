// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktCoreDefs.h"
#include "UObject/Object.h"
#include "HktCameraModeBase.generated.h"

class AHktRtsCameraPawn;
class UInputMappingContext;

UCLASS(Abstract, Blueprintable, DefaultToInstanced, EditInlineNew)
class UHktCameraModeBase : public UObject
{
	GENERATED_BODY()

public:
	virtual void OnActivate(AHktRtsCameraPawn* Pawn) {}
	virtual void OnDeactivate(AHktRtsCameraPawn* Pawn) {}
	virtual void TickMode(AHktRtsCameraPawn* Pawn, float DeltaTime) {}
	virtual void HandleZoom(AHktRtsCameraPawn* Pawn, float Value);
	virtual void OnSubjectChanged(AHktRtsCameraPawn* Pawn, FHktEntityId EntityId) {}

	/** 이 모드가 활성화될 때 추가할 InputMappingContext (null이면 추가/제거 없음) */
	UPROPERTY(EditAnywhere, Category = "Input")
	TObjectPtr<UInputMappingContext> InputMappingContext;

	/** MappingContext 우선순위 (높을수록 우선, 공통 DefaultMappingContext=0) */
	UPROPERTY(EditAnywhere, Category = "Input")
	int32 MappingPriority = 1;

	/** 이 모드에서 마우스 커서를 표시할지 여부 */
	UPROPERTY(EditAnywhere, Category = "Input")
	bool bShowMouseCursor = true;
};
