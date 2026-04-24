// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVMWorldStateProxy.h"
#include "HktCoreProperties.h"

// ============================================================================
// FHktVMWorldStateProxy
// ============================================================================

void FHktVMWorldStateProxy::Initialize(const FHktWorldState& WS)
{
    constexpr int32 Reserve = 2176;
    DirtyMask.Reserve(Reserve);
    DirtySlots.Reserve(256);
    TagsDirtyMask.Reserve(Reserve);
    TagsDirtySlots.Reserve(256);
    PreFrameHotData.Reserve(Reserve * FHktWorldState::HotStride);
    PreFrameWarmData.Reserve(Reserve * FHktWorldState::WarmCapacity);
    PreFrameOverflowData.Reserve(Reserve);
    PreFrameTagContainers.Reserve(Reserve);
    PreFrameOwnerUids.Reserve(Reserve);
    OwnerDirtyMask.Reserve(Reserve);
    OwnerDirtySlots.Reserve(256);
}

void FHktVMWorldStateProxy::ResetDirtyIndices(const FHktWorldState& WS)
{
    for (int32 S : DirtySlots)
        if (S < DirtyMask.Num()) DirtyMask[S] = 0;
    for (int32 S : TagsDirtySlots)
        if (S < TagsDirtyMask.Num()) TagsDirtyMask[S] = 0;
    for (int32 S : OwnerDirtySlots)
        if (S < OwnerDirtyMask.Num()) OwnerDirtyMask[S] = 0;
    DirtySlots.Reset();
    TagsDirtySlots.Reset();
    OwnerDirtySlots.Reset();
    PendingVFXEvents.Reset();
    PendingAnimEvents.Reset();

    if (WS.ActiveCount > 0)
    {
        PreFrameHotData = WS.HotData;
        PreFrameWarmData = WS.WarmData;
        PreFrameOverflowData = WS.OverflowData;
        PreFrameTagContainers = WS.TagContainers;
        PreFrameOwnerUids = WS.OwnerUids;
    }
}

void FHktVMWorldStateProxy::SetPropertyDirty(FHktWorldState& WS, FHktEntityId Entity, uint16 PropId, int32 Value)
{
    if (!WS.IsValidEntity(Entity)) return;
    const int32 Slot = WS.GetSlot(Entity);
    SetDirty(WS, Slot, PropId, Value);

    // Anim 상태 전환을 유발하는 property에는 AnimStartTick도 함께 갱신.
    // AnimStartTick 자체 쓰기에 대한 재귀는 당연히 회피.
    if (PropId != PropertyId::AnimStartTick
        && (PropId == PropertyId::IsMoving
         || PropId == PropertyId::IsGrounded
         || PropId == PropertyId::AnimState
         || PropId == PropertyId::AnimStateUpper))
    {
        TouchAnimStartTick(WS, Slot);
    }
}

void FHktVMWorldStateProxy::SetOwnerUid(FHktWorldState& WS, FHktEntityId Entity, int64 Uid)
{
    if (!WS.IsValidEntity(Entity)) return;
    int32 Slot = WS.GetSlot(Entity);
    SetOwnerDirty(WS, Slot, Uid);
}

int32 FHktVMWorldStateProxy::GetPreFrameValue(int32 Slot, uint16 PropId) const
{
    if (PropId < FHktWorldState::HotStride)
    {
        return PreFrameHotData[Slot * FHktWorldState::HotStride + PropId];
    }

    // Warm 탐색
    const FHktPropertyPair* Base = &PreFrameWarmData[Slot * FHktWorldState::WarmCapacity];
    for (int32 i = 0; i < FHktWorldState::WarmCapacity; ++i)
    {
        if (Base[i].PropId == PropId) return Base[i].Value;
        if (Base[i].IsEmpty()) break;
    }

    // Overflow 탐색
    if (PreFrameOverflowData.IsValidIndex(Slot))
    {
        for (const FHktPropertyPair& P : PreFrameOverflowData[Slot])
            if (P.PropId == PropId) return P.Value;
    }

    return 0;
}
