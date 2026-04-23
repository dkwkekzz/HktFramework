// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "Camera/HktCameraModeBase.h"
#include "HktCameraMode_ShoulderView.generated.h"

class UHktCameraFramingProfile;

/**
 * 3인칭 숄더뷰(Over-The-Shoulder) 카메라 모드.
 * 제어권을 가진 엔터티 뒤쪽 어깨 위에서 따라가며, 마우스 입력으로 카메라 회전이 가능합니다.
 *
 * 뷰 설정(투영/FOV/ArmLength/SocketOffset/Pitch 클램프)은 Framing 프로필이 관리합니다.
 * 이 클래스는 추적(대상 추종)과 입력(마우스 누적 회전)만 담당합니다.
 */
UCLASS()
class HKTPRESENTATION_API UHktCameraMode_ShoulderView : public UHktCameraModeBase
{
	GENERATED_BODY()

public:
	UHktCameraMode_ShoulderView();

	virtual void OnActivate(AHktRtsCameraPawn* Pawn) override;
	virtual void OnDeactivate(AHktRtsCameraPawn* Pawn) override;
	virtual void TickMode(AHktRtsCameraPawn* Pawn, float DeltaTime) override;
	virtual void HandleZoom(AHktRtsCameraPawn* Pawn, float Value) override;
	virtual void OnSubjectChanged(AHktRtsCameraPawn* Pawn, FHktEntityId EntityId) override;

	/** 뷰 프로필 — Perspective/FOV/ArmLength/SocketOffset/Pitch 클램프 */
	UPROPERTY(Instanced, EditAnywhere, Category = "Camera|Framing")
	TObjectPtr<UHktCameraFramingProfile> Framing;

	/** 마우스 감도 */
	UPROPERTY(EditAnywhere, Category = "Camera|Control")
	float MouseSensitivity = 1.0f;

	/** 대상 추적 보간 속도 */
	UPROPERTY(EditAnywhere, Category = "Camera|Tracking")
	float FollowInterpSpeed = 10.0f;

private:
	FHktEntityId SubjectEntityId = InvalidEntityId;

	/** 현재 카메라 Yaw/Pitch (절대각) */
	float CurrentYaw = 0.0f;
	float CurrentPitch = -15.0f;

	/** 활성화 직후 누적된 마우스 delta 스파이크를 한 프레임 버린다 */
	bool bDiscardNextMouseDelta = false;
};
