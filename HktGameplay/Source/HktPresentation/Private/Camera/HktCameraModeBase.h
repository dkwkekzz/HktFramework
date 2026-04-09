// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktCoreDefs.h"
#include "UObject/Object.h"
#include "HktCameraModeBase.generated.h"

class AHktRtsCameraPawn;

UCLASS(Abstract, DefaultToInstanced, EditInlineNew)
class UHktCameraModeBase : public UObject
{
	GENERATED_BODY()

public:
	virtual void OnActivate(AHktRtsCameraPawn* Pawn) {}
	virtual void OnDeactivate(AHktRtsCameraPawn* Pawn) {}
	virtual void TickMode(AHktRtsCameraPawn* Pawn, float DeltaTime) {}
	virtual void HandleZoom(AHktRtsCameraPawn* Pawn, float Value);
	virtual void OnSubjectChanged(AHktRtsCameraPawn* Pawn, FHktEntityId EntityId) {}
};
