// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "Camera/HktCameraModeBase.h"
#include "HktCameraMode_IsometricBase.generated.h"

class UHktCameraFramingProfile;

/**
 * Isometric 계열 카메라 모드의 공용 베이스.
 * 대상 엔티티 추적과 선택적 Yaw 스냅 회전(45도 단위)을 제공합니다.
 * 뷰 설정(투영/각도/거리)은 Framing 프로필이 관리합니다.
 * 파생 클래스(IsometricOrtho/IsometricGame)는 생성자에서 Framing 디폴트만 세팅하면 됩니다.
 */
UCLASS(Abstract)
class HKTPRESENTATION_API UHktCameraMode_IsometricBase : public UHktCameraModeBase
{
	GENERATED_BODY()

public:
	virtual void OnActivate(AHktRtsCameraPawn* Pawn) override;
	virtual void OnDeactivate(AHktRtsCameraPawn* Pawn) override;
	virtual void TickMode(AHktRtsCameraPawn* Pawn, float DeltaTime) override;
	virtual void HandleZoom(AHktRtsCameraPawn* Pawn, float Value) override;
	virtual void OnSubjectChanged(AHktRtsCameraPawn* Pawn, FHktEntityId EntityId) override;

	/** 뷰 프로필 — 파생 클래스 생성자에서 CreateDefaultSubobject로 생성·디폴트 세팅 */
	UPROPERTY(Instanced, EditAnywhere, Category = "Camera|Framing")
	TObjectPtr<UHktCameraFramingProfile> Framing;

	/** 45도 단위 Yaw 스냅 회전을 허용할지 */
	UPROPERTY(EditAnywhere, Category = "Camera|Control")
	bool bAllowYawSnapRotation = false;

	/** 대상 엔티티 추적 보간 속도 (0 이하면 즉시 스냅) */
	UPROPERTY(EditAnywhere, Category = "Camera|Tracking")
	float FollowInterpSpeed = 8.0f;

	/** Subject가 사라지면 RtsFree로 복귀할지 */
	UPROPERTY(EditAnywhere, Category = "Camera|Tracking")
	bool bFallbackToRtsOnSubjectLost = false;

	/** 현재 Yaw를 90도 단위로 회전 (Direction: +1/-1). 외부 입력 액션에서 호출. */
	void RotateYaw(AHktRtsCameraPawn* Pawn, int32 Direction);

protected:
	/** SpringArm 회전을 (Framing->DefaultPitch, CurrentYaw)로 재적용 */
	void UpdateSpringArmRotation(AHktRtsCameraPawn* Pawn) const;

	FHktEntityId SubjectEntityId = InvalidEntityId;

	/** 런타임 Yaw 상태 — Framing->DefaultYaw로 초기화되며, RotateYaw로 변경 가능 */
	float CurrentYaw = 0.0f;
};
