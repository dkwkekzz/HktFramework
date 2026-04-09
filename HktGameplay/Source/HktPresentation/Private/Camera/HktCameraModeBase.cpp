// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Camera/HktCameraModeBase.h"
#include "Actors/HktRtsCameraPawn.h"
#include "GameFramework/SpringArmComponent.h"

void UHktCameraModeBase::HandleZoom(AHktRtsCameraPawn* Pawn, float Value)
{
	if (!Pawn) return;

	USpringArmComponent* SpringArm = Pawn->GetSpringArm();
	if (SpringArm && Value != 0.0f)
	{
		SpringArm->TargetArmLength = FMath::Clamp(
			SpringArm->TargetArmLength - Value * Pawn->GetZoomSpeed(),
			Pawn->GetMinZoom(), Pawn->GetMaxZoom());
	}
}
