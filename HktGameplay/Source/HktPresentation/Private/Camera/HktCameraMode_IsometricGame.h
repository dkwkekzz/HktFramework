// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "Camera/HktCameraMode_IsometricBase.h"
#include "HktCameraMode_IsometricGame.generated.h"

/**
 * 게임형 Isometric 카메라 모드 (Perspective + 좁은 FOV).
 * Diablo/StarCraft 스타일 — 텔레포토 효과로 등축에 가까운 느낌을 주면서도
 * Perspective 투영이라 라이팅·PostProcess·Niagara VFX 호환성이 온전합니다.
 *
 * 추적/회전/줌 로직은 전부 IsometricBase + Framing이 담당.
 * 이 클래스는 생성자에서 Framing 디폴트만 세팅합니다.
 */
UCLASS()
class HKTPRESENTATION_API UHktCameraMode_IsometricGame : public UHktCameraMode_IsometricBase
{
	GENERATED_BODY()

public:
	UHktCameraMode_IsometricGame();
};
