// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "Camera/HktCameraMode_IsometricBase.h"
#include "HktCameraMode_IsometricOrtho.generated.h"

/**
 * 정통 Isometric 카메라 모드 (Orthographic 투영).
 * 타일/전략 장르에 적합한 왜곡 없는 등축 투영을 제공합니다.
 * Pitch -30도, Yaw 45도 기본값으로 다이아몬드형 그리드를 형성합니다.
 * 줌은 OrthoWidth로 조정되며, PostProcess(SSR 등) 일부 효과가 제한될 수 있습니다.
 */
UCLASS()
class HKTPRESENTATION_API UHktCameraMode_IsometricOrtho : public UHktCameraMode_IsometricBase
{
	GENERATED_BODY()

public:
	UHktCameraMode_IsometricOrtho();

	virtual void HandleZoom(AHktRtsCameraPawn* Pawn, float Value) override;

	/** 초기 OrthoWidth (화면에 보이는 월드 가로 폭, 언리얼 단위) */
	UPROPERTY(EditAnywhere, Category = "Camera|Isometric")
	float OrthoWidth = 2500.0f;

	UPROPERTY(EditAnywhere, Category = "Camera|Isometric")
	float MinOrthoWidth = 800.0f;

	UPROPERTY(EditAnywhere, Category = "Camera|Isometric")
	float MaxOrthoWidth = 6000.0f;

	/** 줌 휠 1 틱당 OrthoWidth 변화량 */
	UPROPERTY(EditAnywhere, Category = "Camera|Isometric")
	float OrthoZoomStep = 200.0f;

	/** Orthographic에서 Near/Far clip (고정각 카메라에서 큰 값 권장) */
	UPROPERTY(EditAnywhere, Category = "Camera|Isometric")
	float OrthoNearClip = -10000.0f;

	UPROPERTY(EditAnywhere, Category = "Camera|Isometric")
	float OrthoFarClip = 20000.0f;

protected:
	virtual void ApplyProjectionSettings(AHktRtsCameraPawn* Pawn) override;
	virtual void RestoreProjectionSettings(AHktRtsCameraPawn* Pawn) override;

private:
	/** 활성화 전 Camera 컴포넌트 세팅 백업 */
	uint8 SavedProjectionMode = 0;
	float SavedOrthoWidth = 0.0f;
	float SavedFOV = 90.0f;
};
