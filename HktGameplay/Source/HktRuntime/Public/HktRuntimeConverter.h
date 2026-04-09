// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktCoreDefs.h"
#include "HktCoreEvents.h"
#include "HktWorldState.h"
#include "HktCoreProperties.h"
#include "HktRuntimeTypes.h"

/**
 * HktRuntime <-> HktCore 타입 변환 유틸리티
 * 
 * Runtime 모듈 내부에서만 사용 (양쪽 타입 모두 접근 가능)
 */
namespace HktRuntimeConverter
{
    // ========================================================================
    // Runtime -> Core
    // ========================================================================

    /** FHktRuntimeEvent -> FHktEvent (Zero-Cost 변환: reinterpret_cast 사용) */
    inline FHktEvent ConvertEvent(const FHktRuntimeEvent& In)
    {
        // FHktRuntimeEvent의 첫 번째 멤버가 FHktEvent CoreEvent이므로
        // 메모리 레이아웃이 동일하여 reinterpret_cast가 안전함
        return reinterpret_cast<const FHktEvent&>(In);
    }

    /** FHktEvent -> FHktRuntimeEvent (Zero-Cost 변환: reinterpret_cast 사용) */
    inline const FHktRuntimeEvent& ConvertEventToRuntime(const FHktEvent& In)
    {
        // 생성자를 호출하지 않고, 메모리 자체를 RuntimeEvent로 간주하여 읽습니다 (Zero-Cost)
        return reinterpret_cast<const FHktRuntimeEvent&>(In);
    }

    /** FHktRuntimeBatch -> FHktSimulationEvent (Zero-Cost 변환: 암시적 변환 활용) */
    inline const FHktSimulationEvent& ConvertBatch(const FHktRuntimeBatch& In)
    {
        // 래퍼 구조이므로 암시적 변환을 통해 CoreEvent에 접근
        return static_cast<const FHktSimulationEvent&>(In);
    }

    /** FHktEvent -> FHktRuntimeEvent (Zero-Cost 변환: reinterpret_cast 사용) */
    inline const FHktRuntimeBatch& ConvertToBatch(const FHktSimulationEvent& In)
    {
        // 생성자를 호출하지 않고, 메모리 자체를 RuntimeEvent로 간주하여 읽습니다 (Zero-Cost)
        return reinterpret_cast<const FHktRuntimeBatch&>(In);
    }

    // ========================================================================
    // Core -> Runtime
    // ========================================================================

    /** FHktWorldState -> FHktRuntimeSimulationState (Zero-Cost 변환: 암시적 변환 활용) */
    inline const FHktRuntimeSimulationState& ConvertWorldState(const FHktWorldState& In)
    {
        return reinterpret_cast<const FHktRuntimeSimulationState&>(In);
    }

    // ========================================================================
    // Runtime -> Core (상태 복원)
    // ========================================================================

    /** FHktRuntimeSimulationState -> FHktWorldState (Zero-Cost 변환: 암시적 변환 활용) */
    inline const FHktWorldState& ConvertToWorldState(const FHktRuntimeSimulationState& In)
    {
        // 래퍼 구조이므로 암시적 변환을 통해 CoreState에 접근
        return static_cast<const FHktWorldState&>(In);
    }
}
