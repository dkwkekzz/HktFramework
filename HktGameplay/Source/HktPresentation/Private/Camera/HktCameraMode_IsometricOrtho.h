// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "Camera/HktCameraMode_IsometricBase.h"
#include "HktCameraMode_IsometricOrtho.generated.h"

/**
 * 정통 Isometric 카메라 모드 (Orthographic 투영).
 * 타일/전략 장르에 적합한 왜곡 없는 등축 투영을 제공합니다.
 *
 * 추적/회전/줌 로직은 전부 IsometricBase + Framing이 담당.
 * 이 클래스는 생성자에서 Framing 디폴트만 세팅합니다.
 */
UCLASS()
class HKTPRESENTATION_API UHktCameraMode_IsometricOrtho : public UHktCameraMode_IsometricBase
{
	GENERATED_BODY()

public:
	UHktCameraMode_IsometricOrtho();
};
