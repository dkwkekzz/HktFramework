// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Camera/HktCameraFramingProfile.h"
#include "Actors/HktRtsCameraPawn.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/SpringArmComponent.h"

void UHktCameraFramingProfile::Apply(AHktRtsCameraPawn* Pawn)
{
	if (!Pawn) return;

	USpringArmComponent* SpringArm = Pawn->GetSpringArm();
	UCameraComponent* Cam = Pawn->GetCamera();

	// 기존 세팅 백업
	if (SpringArm)
	{
		SavedArmLength = SpringArm->TargetArmLength;
		SavedArmRotation = SpringArm->GetRelativeRotation();
		SavedSocketOffset = SpringArm->SocketOffset;
	}
	if (Cam)
	{
		SavedProjectionMode = static_cast<uint8>(Cam->ProjectionMode);
		SavedFOV = Cam->FieldOfView;
		SavedOrthoWidth = Cam->OrthoWidth;
	}
	bApplied = true;

	// 프로필 적용
	if (SpringArm)
	{
		SpringArm->TargetArmLength = DefaultArmLength;
		SpringArm->SocketOffset = SocketOffset;
		SpringArm->SetRelativeRotation(FRotator(DefaultPitch, DefaultYaw, 0.0f));
	}
	if (Cam)
	{
		Cam->SetProjectionMode(ProjectionMode);
		if (ProjectionMode == ECameraProjectionMode::Orthographic)
		{
			Cam->SetOrthoWidth(OrthoWidth);
			Cam->SetOrthoNearClipPlane(OrthoNearClip);
			Cam->SetOrthoFarClipPlane(OrthoFarClip);
		}
		else
		{
			Cam->SetFieldOfView(FieldOfView);
		}
	}
}

void UHktCameraFramingProfile::Restore(AHktRtsCameraPawn* Pawn)
{
	if (!Pawn || !bApplied) return;

	if (USpringArmComponent* SpringArm = Pawn->GetSpringArm())
	{
		SpringArm->TargetArmLength = SavedArmLength;
		SpringArm->SetRelativeRotation(SavedArmRotation);
		SpringArm->SocketOffset = SavedSocketOffset;
	}
	if (UCameraComponent* Cam = Pawn->GetCamera())
	{
		Cam->SetProjectionMode(static_cast<ECameraProjectionMode::Type>(SavedProjectionMode));
		Cam->SetFieldOfView(SavedFOV);
		Cam->SetOrthoWidth(SavedOrthoWidth);
	}
	bApplied = false;
}

void UHktCameraFramingProfile::HandleZoom(AHktRtsCameraPawn* Pawn, float Value)
{
	if (!Pawn || Value == 0.0f) return;

	if (ProjectionMode == ECameraProjectionMode::Orthographic)
	{
		if (UCameraComponent* Cam = Pawn->GetCamera())
		{
			const float NewWidth = FMath::Clamp(
				Cam->OrthoWidth - Value * ZoomStep,
				MinOrthoWidth, MaxOrthoWidth);
			Cam->SetOrthoWidth(NewWidth);
			OrthoWidth = NewWidth;
		}
	}
	else
	{
		if (USpringArmComponent* SpringArm = Pawn->GetSpringArm())
		{
			const float NewLength = FMath::Clamp(
				SpringArm->TargetArmLength - Value * ZoomStep,
				MinArmLength, MaxArmLength);
			SpringArm->TargetArmLength = NewLength;
			DefaultArmLength = NewLength;
		}
	}
}

void UHktCameraFramingProfile::ApplyDefaultRotation(AHktRtsCameraPawn* Pawn) const
{
	if (!Pawn) return;

	if (USpringArmComponent* SpringArm = Pawn->GetSpringArm())
	{
		SpringArm->SetRelativeRotation(FRotator(DefaultPitch, DefaultYaw, 0.0f));
	}
}
