// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "Camera/HktCameraModeBase.h"
#include "HktCameraMode_RtsView.generated.h"

/**
 * 전통적인 RTS 탑뷰 카메라 모드.
 * "내" 엔티티가 있으면 X/Y로 추적(높이 유지), 없으면 화면 가장자리 스크롤로 자유 이동.
 *
 * 추적/이동 로직은 베이스가 담당. 이 클래스는 Framing 디폴트만 세팅한다.
 */
UCLASS()
class HKTPRESENTATION_API UHktCameraMode_RtsView : public UHktCameraModeBase
{
	GENERATED_BODY()

public:
	UHktCameraMode_RtsView();
};
