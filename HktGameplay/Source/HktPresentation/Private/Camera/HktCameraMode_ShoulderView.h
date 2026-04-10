// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "Camera/HktCameraModeBase.h"
#include "HktCameraMode_ShoulderView.generated.h"

/**
 * 3인칭 숄더뷰(Over-The-Shoulder) 카메라 모드.
 * 제어권을 가진 엔터티 뒤쪽 어깨 위에서 따라가며,
 * 마우스 입력으로 카메라 회전이 가능합니다.
 */
UCLASS()
class UHktCameraMode_ShoulderView : public UHktCameraModeBase
{
	GENERATED_BODY()

public:
	UHktCameraMode_ShoulderView() { bShowMouseCursor = false; }

	virtual void OnActivate(AHktRtsCameraPawn* Pawn) override;
	virtual void OnDeactivate(AHktRtsCameraPawn* Pawn) override;
	virtual void TickMode(AHktRtsCameraPawn* Pawn, float DeltaTime) override;
	virtual void HandleZoom(AHktRtsCameraPawn* Pawn, float Value) override;
	virtual void OnSubjectChanged(AHktRtsCameraPawn* Pawn, FHktEntityId EntityId) override;

	/** 대상으로부터의 SpringArm 거리 */
	UPROPERTY(EditAnywhere, Category = "Camera")
	float ArmLength = 300.0f;

	UPROPERTY(EditAnywhere, Category = "Camera")
	float MinArmLength = 150.0f;

	UPROPERTY(EditAnywhere, Category = "Camera")
	float MaxArmLength = 600.0f;

	/** 어깨 오프셋 (캐릭터 기준 우측/상방) */
	UPROPERTY(EditAnywhere, Category = "Camera")
	FVector ShoulderOffset = FVector(0.0f, 50.0f, 80.0f);

	/** 카메라 피치 범위 (도) */
	UPROPERTY(EditAnywhere, Category = "Camera")
	float MinPitch = -60.0f;

	UPROPERTY(EditAnywhere, Category = "Camera")
	float MaxPitch = 60.0f;

	/** 마우스 감도 */
	UPROPERTY(EditAnywhere, Category = "Camera")
	float MouseSensitivity = 1.0f;

	/** 대상 추적 보간 속도 */
	UPROPERTY(EditAnywhere, Category = "Camera")
	float FollowInterpSpeed = 10.0f;

	/** 줌 속도 배율 */
	UPROPERTY(EditAnywhere, Category = "Camera")
	float ZoomSpeed = 30.0f;

private:
	FHktEntityId SubjectEntityId = InvalidEntityId;

	/** 활성화 전 SpringArm 세팅 백업 */
	float SavedArmLength = 0.0f;
	FRotator SavedArmRotation = FRotator::ZeroRotator;
	FVector SavedSocketOffset = FVector::ZeroVector;

	/** 현재 카메라 Yaw/Pitch (절대각) */
	float CurrentYaw = 0.0f;
	float CurrentPitch = -15.0f;
};
