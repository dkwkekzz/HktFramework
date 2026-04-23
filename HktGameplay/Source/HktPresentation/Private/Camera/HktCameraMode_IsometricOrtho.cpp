// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Camera/HktCameraMode_IsometricOrtho.h"
#include "Camera/HktCameraFramingProfile.h"

UHktCameraMode_IsometricOrtho::UHktCameraMode_IsometricOrtho()
{
	Framing = CreateDefaultSubobject<UHktCameraFramingProfile>(TEXT("Framing"));
	Framing->ProjectionMode = ECameraProjectionMode::Orthographic;
	Framing->OrthoWidth = 2500.0f;
	Framing->MinOrthoWidth = 800.0f;
	Framing->MaxOrthoWidth = 6000.0f;
	Framing->OrthoNearClip = -10000.0f;
	Framing->OrthoFarClip = 20000.0f;
	Framing->ZoomStep = 200.0f;

	// 정통 isometric: -30도 피치, 45도 요
	Framing->DefaultPitch = -30.0f;
	Framing->DefaultYaw = 45.0f;

	// Ortho에서 ArmLength는 시각적 거리에 영향 없지만, 어태치먼트 기준점 유지용
	Framing->DefaultArmLength = 2000.0f;
}
