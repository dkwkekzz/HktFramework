// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

// ============================================================================
// HktSimulationTick — 고정 시뮬레이션 틱 단일 출처
//
// 모든 시간 종속 변형(중력 적분, 이동 적분, VM Timer, 런타임 누적 dispatch)은
// 이 함수들이 반환하는 값으로부터 파생되어야 한다. 시스템은 DeltaSeconds 를
// 입력으로 받지 않는다 — 결정론.
//
// 값은 콘솔변수 `hkt.Sim.FramesPerSecond` 로 정의된다 (HktSimulationSystems.cpp).
// 기본 60Hz. 런타임 변경은 가능하나, 결정론을 유지하려면 서버/클라가 동일 값을
// 사용해야 한다 (시작 시 고정 권장).
// ============================================================================

/** 시뮬레이션 틱 주파수 (frames per second). 항상 양수. */
HKTCORE_API int32 HktGetSimFramesPerSecond();

/** 1 / FramesPerSecond — 1프레임당 초. Movement/Gravity 적분 계수. */
HKTCORE_API float HktGetSimInvFramesPerSecond();

/** 한 프레임의 wall-clock 길이 (초). 런타임 fixed-step 누적용. */
HKTCORE_API float HktGetSimFixedDeltaSeconds();
