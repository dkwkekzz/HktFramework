// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "Camera/HktCameraModeBase.h"
#include "HktCameraMode_IsometricBase.generated.h"

/**
 * Isometric 계열 카메라 모드의 공용 베이스.
 * 고정 Pitch/Yaw의 SpringArm 회전, 대상 엔티티 추적, 45도 단위 Yaw 스냅 회전을 공유합니다.
 * 파생 클래스가 투영 방식(Orthographic/Perspective)과 줌 동작을 정의합니다.
 */
UCLASS(Abstract)
class HKTPRESENTATION_API UHktCameraMode_IsometricBase : public UHktCameraModeBase
{
	GENERATED_BODY()

public:
	virtual void OnActivate(AHktRtsCameraPawn* Pawn) override;
	virtual void OnDeactivate(AHktRtsCameraPawn* Pawn) override;
	virtual void TickMode(AHktRtsCameraPawn* Pawn, float DeltaTime) override;
	virtual void OnSubjectChanged(AHktRtsCameraPawn* Pawn, FHktEntityId EntityId) override;

	/** 카메라 Pitch (아래를 향함, 음수). 정통 isometric: -30, 게임형: -55 */
	UPROPERTY(EditAnywhere, Category = "Camera|Isometric")
	float Pitch = -55.0f;

	/** 초기 Yaw (45도 단위 권장) */
	UPROPERTY(EditAnywhere, Category = "Camera|Isometric")
	float InitialYaw = 45.0f;

	/** 45도 단위 Yaw 스냅 회전을 허용할지 (Q/E 키 등으로 조작하려면 true) */
	UPROPERTY(EditAnywhere, Category = "Camera|Isometric")
	bool bAllowYawSnapRotation = false;

	/** 대상 엔티티 추적 보간 속도 (0 이하면 즉시 스냅) */
	UPROPERTY(EditAnywhere, Category = "Camera|Isometric")
	float FollowInterpSpeed = 8.0f;

	/** 대상이 없을 때 새 스폰을 자동 추적할지 */
	UPROPERTY(EditAnywhere, Category = "Camera|Isometric")
	bool bAutoFollowNewSpawn = true;

protected:
	/** 파생 클래스가 Activation 시 투영/줌 세팅을 적용하도록 오버라이드 */
	virtual void ApplyProjectionSettings(AHktRtsCameraPawn* Pawn) {}

	/** 파생 클래스가 Deactivation 시 투영/줌 세팅을 원복하도록 오버라이드 */
	virtual void RestoreProjectionSettings(AHktRtsCameraPawn* Pawn) {}

	/** 현재 Yaw를 90도 단위로 회전 (Direction: +1 / -1) */
	void RotateYaw(AHktRtsCameraPawn* Pawn, int32 Direction);

	/** SpringArm 회전을 CurrentYaw/Pitch로 재적용 */
	void UpdateSpringArmRotation(AHktRtsCameraPawn* Pawn) const;

	FHktEntityId SubjectEntityId = InvalidEntityId;
	float CurrentYaw = 45.0f;

	/** 활성화 전 SpringArm 세팅 백업 */
	float SavedArmLength = 0.0f;
	FRotator SavedArmRotation = FRotator::ZeroRotator;
};
