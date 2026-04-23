// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Camera/HktCameraMode_IsometricGame.h"
#include "Camera/HktCameraFramingProfile.h"

UHktCameraMode_IsometricGame::UHktCameraMode_IsometricGame()
{
	Framing = CreateDefaultSubobject<UHktCameraFramingProfile>(TEXT("Framing"));
	Framing->ProjectionMode = ECameraProjectionMode::Perspective;
	Framing->FieldOfView = 20.0f;  // 텔레포토 — 등축에 가까운 효과
	Framing->ZoomStep = 200.0f;

	// 게임형 isometric: 가독성을 위해 좀 더 가파른 각도
	Framing->DefaultPitch = -55.0f;
	Framing->DefaultYaw = 45.0f;

	Framing->DefaultArmLength = 2500.0f;
	Framing->MinArmLength = 1500.0f;
	Framing->MaxArmLength = 5000.0f;
}
