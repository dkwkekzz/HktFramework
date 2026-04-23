// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Camera/HktCameraMode_RtsView.h"
#include "Camera/HktCameraFramingProfile.h"

UHktCameraMode_RtsView::UHktCameraMode_RtsView()
{
	bTrackSubjectZ = false;  // 탑뷰: 카메라 높이 고정, 대상 위치는 X/Y만 따라간다
	FollowInterpSpeed = 5.0f;
	bAutoFollowNewSpawn = true;  // 명시적 Subject가 없으면 새로 스폰된 엔티티를 자동 추적

	Framing = CreateDefaultSubobject<UHktCameraFramingProfile>(TEXT("Framing"));
	Framing->ProjectionMode = ECameraProjectionMode::Perspective;
	Framing->FieldOfView = 90.0f;

	Framing->DefaultPitch = -60.0f;
	Framing->DefaultYaw = 0.0f;

	Framing->DefaultArmLength = 2000.0f;
	Framing->MinArmLength = 500.0f;
	Framing->MaxArmLength = 4000.0f;
	Framing->ZoomStep = 100.0f;
}
