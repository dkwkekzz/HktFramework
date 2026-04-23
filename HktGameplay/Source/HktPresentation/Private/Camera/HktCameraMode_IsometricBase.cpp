// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Camera/HktCameraMode_IsometricBase.h"
#include "Camera/HktCameraFramingProfile.h"
#include "Actors/HktRtsCameraPawn.h"
#include "GameFramework/SpringArmComponent.h"

void UHktCameraMode_IsometricBase::OnActivate(AHktRtsCameraPawn* Pawn)
{
	Super::OnActivate(Pawn);

	if (Framing)
	{
		CurrentYaw = Framing->DefaultYaw;
	}

	UpdateSpringArmRotation(Pawn);
}

void UHktCameraMode_IsometricBase::RotateYaw(AHktRtsCameraPawn* Pawn, int32 Direction)
{
	if (!bAllowYawSnapRotation || Direction == 0) return;

	const float Step = (Direction > 0) ? 90.0f : -90.0f;
	CurrentYaw = FMath::UnwindDegrees(CurrentYaw + Step);
	UpdateSpringArmRotation(Pawn);
}

void UHktCameraMode_IsometricBase::UpdateSpringArmRotation(AHktRtsCameraPawn* Pawn) const
{
	if (!Pawn) return;

	const float Pitch = Framing ? Framing->DefaultPitch : -30.0f;

	if (USpringArmComponent* SpringArm = Pawn->GetSpringArm())
	{
		SpringArm->SetRelativeRotation(FRotator(Pitch, CurrentYaw, 0.0f));
	}
}
