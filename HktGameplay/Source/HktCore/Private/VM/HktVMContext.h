// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktWorldState.h"
#include "HktCoreProperties.h"
#include "HktVMWorldStateProxy.h"

/**
 * FHktVMContext — VM 실행 컨텍스트 (구 FHktVMStore 대체)
 *
 * WorldState에 직접 읽기/쓰기. 쓰기는 VMProxy 경유하여 Dirty 추적.
 */
struct FHktVMContext
{
    FHktEntityId SourceEntity = InvalidEntityId;
    FHktEntityId TargetEntity = InvalidEntityId;
    FHktWorldState* WorldState = nullptr;
    FHktVMWorldStateProxy* VMProxy = nullptr;

    /** 이벤트 파라미터 로컬 저장 — SourceEntity 없이도 LoadStore로 읽기 가능 */
    int32 EventTargetPosX = 0;
    int32 EventTargetPosY = 0;
    int32 EventTargetPosZ = 0;
    int32 EventParam0 = 0;
    int32 EventParam1 = 0;
    int32 EventParam2 = 0;
    int32 EventParam3 = 0;

    FORCEINLINE int32 Read(uint16 PropId) const
    {
        // 이벤트 파라미터는 로컬 저장소에서 읽기 (SourceEntity 불필요)
        if      (PropId == PropertyId::TargetPosX) return EventTargetPosX;
        else if (PropId == PropertyId::TargetPosY) return EventTargetPosY;
        else if (PropId == PropertyId::TargetPosZ) return EventTargetPosZ;
        else if (PropId == PropertyId::Param0)     return EventParam0;
        else if (PropId == PropertyId::Param1)     return EventParam1;
        else if (PropId == PropertyId::Param2)     return EventParam2;
        else if (PropId == PropertyId::Param3)     return EventParam3;
        if (!WorldState) return 0;
        return WorldState->GetProperty(SourceEntity, PropId);
    }

    FORCEINLINE int32 ReadEntity(FHktEntityId Entity, uint16 PropId) const
    {
        if (!WorldState) return 0;
        return WorldState->GetProperty(Entity, PropId);
    }

    FORCEINLINE void Write(uint16 PropId, int32 Value)
    {
        if (VMProxy && WorldState)
            VMProxy->SetPropertyDirty(*WorldState, SourceEntity, PropId, Value);
    }

    FORCEINLINE void WriteEntity(FHktEntityId Entity, uint16 PropId, int32 Value)
    {
        if (VMProxy && WorldState)
            VMProxy->SetPropertyDirty(*WorldState, Entity, PropId, Value);
    }

    void Reset()
    {
        SourceEntity = InvalidEntityId;
        TargetEntity = InvalidEntityId;
        EventTargetPosX = EventTargetPosY = EventTargetPosZ = 0;
        EventParam0 = EventParam1 = EventParam2 = EventParam3 = 0;
    }
};
