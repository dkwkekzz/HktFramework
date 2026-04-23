// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "Camera/HktCameraModeBase.h"
#include "HktCameraMode_IsometricBase.generated.h"

/**
 * Isometric 계열 카메라 모드의 공용 베이스.
 * 베이스의 추적/Edge-scroll/Framing 위에 90도 단위 Yaw 스냅 회전을 추가한다.
 * 파생 클래스(IsometricOrtho/IsometricGame)는 생성자에서 Framing 디폴트만 세팅한다.
 */
UCLASS(Abstract)
class HKTPRESENTATION_API UHktCameraMode_IsometricBase : public UHktCameraModeBase
{
	GENERATED_BODY()

public:
	virtual void OnActivate(AHktRtsCameraPawn* Pawn) override;

	/** 90도 단위 Yaw 스냅 회전을 허용할지 */
	UPROPERTY(EditAnywhere, Category = "Camera|Control")
	bool bAllowYawSnapRotation = false;

	/** 현재 Yaw를 90도 단위로 회전 (Direction: +1/-1). 외부 입력 액션에서 호출. */
	void RotateYaw(AHktRtsCameraPawn* Pawn, int32 Direction);

protected:
	/** SpringArm 회전을 (Framing->DefaultPitch, CurrentYaw)로 재적용 */
	void UpdateSpringArmRotation(AHktRtsCameraPawn* Pawn) const;

	/** 런타임 Yaw 상태 — Framing->DefaultYaw로 초기화되며, RotateYaw로 변경 가능 */
	float CurrentYaw = 0.0f;
};
