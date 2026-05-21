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

    // VM 런타임 풀 — 결정론 입력(핸들 Index 가 스냅샷 직렬화에 포함).
    // Initial 은 부팅 시 SetNum, Max 는 grow 의 hard cap. FHktVMHandle.Index 는 24-bit
    // 이므로 16M 까지 가능하나 직렬화 안전성·메모리 페널티를 고려해 보수적으로 1024.
    constexpr int32 InitialVMPoolCapacity = 64;
    constexpr int32 MaxVMPoolCapacity     = 1024;
    // Spawner 백프레셔 임계 — 풀 사용량이 이 값 이상이면 Story.Flow.Spawner.* 류
    // 이벤트는 즉시 drop. 핵심 게임플레이(전투/인터랙션/Brain) 가 마지막 슬롯까지
    // 보호되도록 spawner 만 미리 거절. 결정론 입력(drop 자체) 이므로 헤더 상수로 고정.
    constexpr int32 SpawnerBackpressureSoftCap = MaxVMPoolCapacity * 3 / 4;

    constexpr int32 MaxActiveEvents = 512;
    constexpr int32 MaxPendingEvents = 1024;
    constexpr int32 MaxPhysicsEvents = 512;
    constexpr int32 WarmPropertyCapacity = 16;

    // 고정 시뮬레이션 틱은 콘솔변수 hkt.Sim.FramesPerSecond 로 정의된다.
    // 접근자: HktSimulationTick.h — HktGetSimFramesPerSecond() / HktGetSimInvFramesPerSecond() 등.
}
