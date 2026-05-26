// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "Camera/HktCameraModeBase.h"
#include "HktCameraMode_ShoulderView.generated.h"

/**
 * 3인칭 숄더뷰(OTS) 카메라 모드.
 * "내" 엔티티가 있으면 그 뒤쪽 어깨에서 따라간다 (없으면 베이스 edge-scroll).
 *
 * 회전 정책:
 *  - 기본 상태는 커서 노출 + 마우스 자유 이동(회전 없음) → 좌클릭 선택 가능.
 *  - 우클릭을 누르고 있는 동안만 마우스로 카메라 회전(마우스룩, 커서 숨김·캡처).
 *  - 우클릭을 떼면 누르기 직전의 "기존 뷰"(RestYaw/RestPitch)로 부드럽게 복귀.
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

	/** 마우스 감도 */
	UPROPERTY(EditAnywhere, Category = "Camera|Control")
	float MouseSensitivity = 1.0f;

	/** 우클릭을 뗀 뒤 기존 뷰로 복귀하는 보간 속도 (0 이하면 즉시 스냅) */
	UPROPERTY(EditAnywhere, Category = "Camera|Control")
	float ReturnInterpSpeed = 10.0f;

private:
	/** 커서 노출 + GameAndUI 입력 모드로 전환 (회전 안 함 — 선택/edge-scroll 가능). */
	void EnterCursorMode(AHktRtsCameraPawn* Pawn);

	/** 커서 숨김 + GameOnly 캡처로 전환 (마우스룩 시작). 첫 프레임 delta 스파이크는 버린다. */
	void EnterRotateMode(AHktRtsCameraPawn* Pawn);

	/** 복귀 목표 — 우클릭을 누르기 직전(또는 활성화 시점)의 "기존 뷰" */
	float RestYaw = 0.0f;
	float RestPitch = -15.0f;

	/** 현재 적용 중인 카메라 Yaw/Pitch (절대각) */
	float CurrentYaw = 0.0f;
	float CurrentPitch = -15.0f;

	/** 우클릭 마우스룩 진행 중 여부 */
	bool bRotating = false;

	/** 마우스룩 진입 직후 누적된 마우스 delta 스파이크를 한 프레임 버린다 */
	bool bDiscardNextMouseDelta = false;
};
