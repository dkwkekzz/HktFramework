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
    ActiveMoverMask.Reserve(Reserve);
    ActiveMoverSlots.Reserve(256);
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

    // Anim 상태 전환을 유발하는 property에는 AnimStartTick도 함께 갱신.
    // 단, 동일 값을 매 틱 재기록하는 호출자(Story 루프, Phase 1 등)에 의해
    // AnimStartTick이 매 프레임 리셋되어 ElapsedTicks=0이 되는 것을 막기 위해
    // 실제 값이 변경된 경우에만 Touch한다.
    const bool bAnimTrigger =
        PropId != PropertyId::AnimStartTick &&
        (PropId == PropertyId::IsMoving ||
         PropId == PropertyId::IsGrounded ||
         PropId == PropertyId::AnimState ||
         PropId == PropertyId::AnimStateUpper);

    const bool bChanged = bAnimTrigger ? (WS.Get(Slot, PropId) != Value) : false;

    SetDirty(WS, Slot, PropId, Value);

    if (bAnimTrigger && bChanged)
    {
        TouchAnimStartTickBySlot(WS, Slot);
    }

    // MovementSystem 추적: 운동 관련 프로퍼티 쓰기는 슬롯을 active mover 로 표시.
    // 쓰인 값이 0(정지)이라도 일단 mark — MovementSystem 이 처리 후 idle 이면 prune.
    if (PropId == PropertyId::IsMoving ||
        PropId == PropertyId::MoveForce ||
        PropId == PropertyId::VelX ||
        PropId == PropertyId::VelY ||
        PropId == PropertyId::VelZ ||
        PropId == PropertyId::IsGrounded)
    {
        MarkActiveMover(Slot);
    }
}

void FHktVMWorldStateProxy::RebuildActiveMovers(const FHktWorldState& WS)
{
    // 기존 인덱스 전부 비우고 WorldState 를 한 번 스캔해 재구성.
    // RestoreWorldState (롤백/리하이드레이션) 직후 호출 — 빈도 낮음.
    ActiveMoverMask.Reset();
    ActiveMoverSlots.Reset();
    ActiveMoverMask.SetNumZeroed(WS.SlotToEntity.Num());

    for (int32 S = 0; S < WS.SlotToEntity.Num(); ++S)
    {
        if (WS.SlotToEntity[S] == InvalidEntityId) continue;

        const int32 IsMoving   = WS.Get(S, PropertyId::IsMoving);
        const int32 IsGrounded = WS.Get(S, PropertyId::IsGrounded);
        const int32 MoveForce  = WS.Get(S, PropertyId::MoveForce);
        const int32 VX = WS.Get(S, PropertyId::VelX);
        const int32 VY = WS.Get(S, PropertyId::VelY);
        const int32 VZ = WS.Get(S, PropertyId::VelZ);

        const bool bMoving = (IsMoving != 0) || (IsGrounded == 0) ||
                             (MoveForce != 0) ||
                             (VX != 0) || (VY != 0) || (VZ != 0);
        if (bMoving)
        {
            ActiveMoverMask[S] = 1;
            ActiveMoverSlots.Add(S);
        }
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
