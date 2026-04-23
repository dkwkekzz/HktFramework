// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Camera/HktCameraMode_IsometricOrtho.h"
#include "Actors/HktRtsCameraPawn.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/SpringArmComponent.h"

UHktCameraMode_IsometricOrtho::UHktCameraMode_IsometricOrtho()
{
	// 정통 isometric: -30도 피치
	Pitch = -30.0f;
	InitialYaw = 45.0f;
}

void UHktCameraMode_IsometricOrtho::ApplyProjectionSettings(AHktRtsCameraPawn* Pawn)
{
	if (!Pawn) return;

	// Ortho에서는 SpringArm 길이가 시각적 거리에 영향을 주지 않지만,
	// Near/Far clip 계산과 어태치먼트 기준점 유지를 위해 적당한 값을 유지
	if (USpringArmComponent* SpringArm = Pawn->GetSpringArm())
	{
		SpringArm->TargetArmLength = 2000.0f;
	}

	UCameraComponent* Cam = Pawn->GetCamera();
	if (!Cam) return;

	SavedProjectionMode = static_cast<uint8>(Cam->ProjectionMode);
	SavedOrthoWidth = Cam->OrthoWidth;
	SavedFOV = Cam->FieldOfView;

	Cam->SetProjectionMode(ECameraProjectionMode::Orthographic);
	Cam->SetOrthoWidth(OrthoWidth);
	Cam->SetOrthoNearClipPlane(OrthoNearClip);
	Cam->SetOrthoFarClipPlane(OrthoFarClip);
}

void UHktCameraMode_IsometricOrtho::RestoreProjectionSettings(AHktRtsCameraPawn* Pawn)
{
	if (!Pawn) return;

	if (UCameraComponent* Cam = Pawn->GetCamera())
	{
		Cam->SetProjectionMode(static_cast<ECameraProjectionMode::Type>(SavedProjectionMode));
		Cam->SetOrthoWidth(SavedOrthoWidth);
		Cam->SetFieldOfView(SavedFOV);
	}
}

void UHktCameraMode_IsometricOrtho::HandleZoom(AHktRtsCameraPawn* Pawn, float Value)
{
	if (!Pawn || Value == 0.0f) return;

	UCameraComponent* Cam = Pawn->GetCamera();
	if (!Cam) return;

	const float NewWidth = FMath::Clamp(
		Cam->OrthoWidth - Value * OrthoZoomStep,
		MinOrthoWidth, MaxOrthoWidth);
	Cam->SetOrthoWidth(NewWidth);
	OrthoWidth = NewWidth;
}
