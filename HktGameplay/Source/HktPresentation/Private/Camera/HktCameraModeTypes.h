// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

UENUM(BlueprintType)
enum class EHktCameraMode : uint8
{
	RtsView,
	ShoulderView,
	IsometricOrtho,
	IsometricGame,
};
