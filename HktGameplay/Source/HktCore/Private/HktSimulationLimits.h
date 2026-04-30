// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

// ============================================================================
// Simulation Limits
// ============================================================================

namespace HktLimits
{
    constexpr int32 MaxEntities     = 4096;
    constexpr int32 MaxProperties   = 64;
    constexpr int32 MaxVMs          = 512;
    constexpr int32 MaxActiveEvents = 512;
    constexpr int32 MaxPendingEvents = 1024;
    constexpr int32 MaxPhysicsEvents = 512;
    constexpr int32 WarmPropertyCapacity = 16;

    // 고정 시뮬레이션 틱 — 모든 시간 종속 변형은 이 상수로부터 파생되어야 한다.
    // 시뮬레이션 시스템에서 DeltaSeconds 를 입력으로 받지 않는다.
    constexpr int32 FramesPerSecond = 30;
}
