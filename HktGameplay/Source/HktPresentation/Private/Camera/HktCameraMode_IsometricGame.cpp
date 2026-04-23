// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Camera/HktCameraMode_IsometricGame.h"
#include "Actors/HktRtsCameraPawn.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/SpringArmComponent.h"

UHktCameraMode_IsometricGame::UHktCameraMode_IsometricGame()
{
	// 게임형 isometric: 가독성을 위해 좀 더 가파른 각도 사용
	Pitch = -55.0f;
	InitialYaw = 45.0f;
}

void UHktCameraMode_IsometricGame::ApplyProjectionSettings(AHktRtsCameraPawn* Pawn)
{
	if (!Pawn) return;

	if (USpringArmComponent* SpringArm = Pawn->GetSpringArm())
	{
		SpringArm->TargetArmLength = ArmLength;
	}

	UCameraComponent* Cam = Pawn->GetCamera();
	if (!Cam) return;

	SavedProjectionMode = static_cast<uint8>(Cam->ProjectionMode);
	SavedFOV = Cam->FieldOfView;

	Cam->SetProjectionMode(ECameraProjectionMode::Perspective);
	Cam->SetFieldOfView(FieldOfView);
}

void UHktCameraMode_IsometricGame::RestoreProjectionSettings(AHktRtsCameraPawn* Pawn)
{
	if (!Pawn) return;

	if (UCameraComponent* Cam = Pawn->GetCamera())
	{
		Cam->SetProjectionMode(static_cast<ECameraProjectionMode::Type>(SavedProjectionMode));
		Cam->SetFieldOfView(SavedFOV);
	}
}

void UHktCameraMode_IsometricGame::HandleZoom(AHktRtsCameraPawn* Pawn, float Value)
{
	if (!Pawn || Value == 0.0f) return;

	USpringArmComponent* SpringArm = Pawn->GetSpringArm();
	if (!SpringArm) return;

	const float NewLength = FMath::Clamp(
		SpringArm->TargetArmLength - Value * ArmZoomStep,
		MinArmLength, MaxArmLength);
	SpringArm->TargetArmLength = NewLength;
	ArmLength = NewLength;
}
