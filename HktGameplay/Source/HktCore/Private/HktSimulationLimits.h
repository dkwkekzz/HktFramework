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
}
