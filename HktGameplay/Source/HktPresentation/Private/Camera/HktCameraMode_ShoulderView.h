// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "Camera/HktCameraModeBase.h"
#include "HktCameraMode_ShoulderView.generated.h"

/**
 * 3인칭 숄더뷰(OTS) 카메라 모드.
 * "내" 엔티티가 있으면 그 뒤쪽 어깨에서 따라가며 마우스로 카메라 회전.
 * 없으면 베이스의 edge-scroll로 자유 이동(커서는 보이도록 전환).
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
	virtual void OnSubjectChanged(AHktRtsCameraPawn* Pawn, FHktEntityId EntityId) override;

	/** 마우스 감도 */
	UPROPERTY(EditAnywhere, Category = "Camera|Control")
	float MouseSensitivity = 1.0f;

private:
	/** Subject 유무에 따라 입력 모드(마우스 캡처/커서) 전환 */
	void ApplyInputModeForSubject(AHktRtsCameraPawn* Pawn);

	/** 현재 카메라 Yaw/Pitch (절대각) */
	float CurrentYaw = 0.0f;
	float CurrentPitch = -15.0f;

	/** 활성화 직후 누적된 마우스 delta 스파이크를 한 프레임 버린다 */
	bool bDiscardNextMouseDelta = false;
};
