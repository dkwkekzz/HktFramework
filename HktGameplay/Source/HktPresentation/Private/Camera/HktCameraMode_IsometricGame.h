// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "Camera/HktCameraMode_IsometricBase.h"
#include "HktCameraMode_IsometricGame.generated.h"

/**
 * 게임형 Isometric 카메라 모드 (Perspective + 좁은 FOV).
 * Diablo/StarCraft 스타일. 텔레포토 효과로 등축에 가까운 느낌을 주면서도
 * Perspective 투영이라 라이팅·PostProcess·Niagara VFX 호환성이 온전합니다.
 * 줌은 SpringArm TargetArmLength로 조정됩니다.
 */
UCLASS()
class HKTPRESENTATION_API UHktCameraMode_IsometricGame : public UHktCameraMode_IsometricBase
{
	GENERATED_BODY()

public:
	UHktCameraMode_IsometricGame();

	virtual void HandleZoom(AHktRtsCameraPawn* Pawn, float Value) override;

	/** 텔레포토 효과용 좁은 FOV (도). 등축에 가까우려면 15~25 권장 */
	UPROPERTY(EditAnywhere, Category = "Camera|Isometric")
	float FieldOfView = 20.0f;

	/** 초기 SpringArm 길이 */
	UPROPERTY(EditAnywhere, Category = "Camera|Isometric")
	float ArmLength = 2500.0f;

	UPROPERTY(EditAnywhere, Category = "Camera|Isometric")
	float MinArmLength = 1500.0f;

	UPROPERTY(EditAnywhere, Category = "Camera|Isometric")
	float MaxArmLength = 5000.0f;

	/** 줌 휠 1 틱당 ArmLength 변화량 */
	UPROPERTY(EditAnywhere, Category = "Camera|Isometric")
	float ArmZoomStep = 200.0f;

protected:
	virtual void ApplyProjectionSettings(AHktRtsCameraPawn* Pawn) override;
	virtual void RestoreProjectionSettings(AHktRtsCameraPawn* Pawn) override;

private:
	uint8 SavedProjectionMode = 0;
	float SavedFOV = 90.0f;
};
