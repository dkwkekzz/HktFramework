// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktWorldState.h"
#include "HktCoreProperties.h"
#include "HktCoreEvents.h"

// ============================================================================
// FHktVMWorldStateProxy — VM dirty-aware 뮤테이션 API (CorePrivate 전용)
//
// DirtyMask / DirtySlots — 프레임 내 변경 추적
// PreFrame 스냅샷 — UndoDiff OldValue 조회 (3-Tier 대응)
// ============================================================================

struct HKTCORE_API FHktVMWorldStateProxy
{
    TArray<FHktVFXEvent> PendingVFXEvents;
    TArray<FHktAnimEvent> PendingAnimEvents;

    TArray<uint64> DirtyMask;
    TArray<int32>  DirtySlots;
    TArray<uint8>  TagsDirtyMask;
    TArray<int32>  TagsDirtySlots;

    // Op_PlayAnim 동일 태그 재호출 시 AnimStartTick이 매 틱 리셋되어 프레임 커서가
    // 0에 머무는 것을 막기 위한 per-slot 마지막 재생 태그 해시. 프레임 경계를 넘어 유지.
    TArray<uint32> LastPlayAnimTagHashBySlot;

    // PreFrame 스냅샷 (3-Tier)
    TArray<int32>  PreFrameHotData;
    TArray<FHktPropertyPair> PreFrameWarmData;
    TArray<TArray<FHktPropertyPair>> PreFrameOverflowData;

    TArray<FGameplayTagContainer> PreFrameTagContainers;
    TArray<int64>  PreFrameOwnerUids;
    TArray<int32>  OwnerDirtySlots;
    TArray<uint8>  OwnerDirtyMask;

    void Initialize(const FHktWorldState& WS);
    void ResetDirtyIndices(const FHktWorldState& WS);

    // --- Property Dirty ---
    FORCEINLINE void SetDirty(FHktWorldState& WS, int32 Slot, uint16 PropId, int32 V)
    {
        WS.Set(Slot, PropId, V);
        if (Slot >= DirtyMask.Num())
        {
            DirtyMask.SetNum(Slot + 1, EAllowShrinking::No);
            TagsDirtyMask.SetNum(Slot + 1, EAllowShrinking::No);
        }
        if (DirtyMask[Slot] == 0) DirtySlots.Add(Slot);
        DirtyMask[Slot] |= (1ULL << PropId);
    }

    void SetPropertyDirty(FHktWorldState& WS, FHktEntityId Entity, uint16 PropId, int32 Value);

    // --- Tag Dirty ---
    FORCEINLINE void SetTagsDirty(int32 Slot)
    {
        if (Slot >= TagsDirtyMask.Num())
            TagsDirtyMask.SetNum(Slot + 1, EAllowShrinking::No);
        if (!TagsDirtyMask[Slot]) { TagsDirtySlots.Add(Slot); TagsDirtyMask[Slot] = 1; }
    }

    FORCEINLINE void AddTag(FHktWorldState& WS, FHktEntityId Entity, const FGameplayTag& Tag)
    {
        if (!WS.IsValidEntity(Entity)) return;
        int32 Slot = WS.GetSlot(Entity);
        // 이미 보유한 태그를 매 틱 재추가하면 AnimStartTick이 리셋되어 프레임 커서가 0에 머문다.
        // 실제 추가가 일어난 경우에만 dirty/Touch.
        const bool bHad = WS.TagContainers[Slot].HasTagExact(Tag);
        if (bHad) return;
        WS.TagContainers[Slot].AddTag(Tag);
        SetTagsDirty(Slot);
        if (IsAnimTag(Tag)) TouchAnimStartTickBySlot(WS, Slot);
    }

    FORCEINLINE void RemoveTag(FHktWorldState& WS, FHktEntityId Entity, const FGameplayTag& Tag)
    {
        if (!WS.IsValidEntity(Entity)) return;
        int32 Slot = WS.GetSlot(Entity);
        const bool bHad = WS.TagContainers[Slot].HasTagExact(Tag);
        if (!bHad) return;
        WS.TagContainers[Slot].RemoveTag(Tag);
        SetTagsDirty(Slot);
        if (IsAnimTag(Tag)) TouchAnimStartTickBySlot(WS, Slot);
    }

    // --- Owner Dirty ---
    FORCEINLINE void SetOwnerDirty(FHktWorldState& WS, int32 Slot, int64 Uid)
    {
        WS.OwnerUids[Slot] = Uid;
        if (Slot >= OwnerDirtyMask.Num())
            OwnerDirtyMask.SetNum(Slot + 1, EAllowShrinking::No);
        if (!OwnerDirtyMask[Slot]) { OwnerDirtySlots.Add(Slot); OwnerDirtyMask[Slot] = 1; }
    }

    void SetOwnerUid(FHktWorldState& WS, FHktEntityId Entity, int64 Uid);

    // --- Anim Start Tick 자동 기록 ---
    //
    // Anim 상태가 전환되는 모든 경로(PlayAnim / Anim.* 태그 Add/Remove /
    // IsMoving·IsGrounded·AnimState·AnimStateUpper 변경)에서 현재 프레임 번호를
    // PropertyId::AnimStartTick 에 기록한다. 클라(Presentation / SpriteAnimProcessor)는
    // 서버 권위 AnimStartTick만 믿고 프레임 커서를 계산 — 별도 클라측 추론 불필요.
    //
    // 내부 헬퍼 — SetDirty로 직접 써서 SetPropertyDirty 재진입 회피.
    FORCEINLINE void TouchAnimStartTickBySlot(FHktWorldState& WS, int32 Slot)
    {
        SetDirty(WS, Slot, PropertyId::AnimStartTick, static_cast<int32>(WS.FrameNumber));
    }

    FORCEINLINE void TouchAnimStartTick(FHktWorldState& WS, FHktEntityId Entity)
    {
        if (!WS.IsValidEntity(Entity)) return;
        TouchAnimStartTickBySlot(WS, WS.GetSlot(Entity));
    }

    /** Tag가 "Anim" 혹은 "Anim.*" 계열인지. (HktCore는 HktRuntime에 의존하지 않으므로 string prefix 판정) */
    static FORCEINLINE bool IsAnimTag(const FGameplayTag& Tag)
    {
        if (!Tag.IsValid()) return false;
        const FName N = Tag.GetTagName();
        static const FName AnimRoot(TEXT("Anim"));
        if (N == AnimRoot) return true;
        // FName → 문자열 prefix 체크. "Anim." 5글자 비교만 수행.
        const FString S = N.ToString();
        return S.StartsWith(TEXT("Anim."), ESearchCase::CaseSensitive);
    }

    // --- Position ---
    FORCEINLINE void SetPosition(FHktWorldState& WS, FHktEntityId Entity, int32 X, int32 Y, int32 Z)
    {
        SetPropertyDirty(WS, Entity, PropertyId::PosX, X);
        SetPropertyDirty(WS, Entity, PropertyId::PosY, Y);
        SetPropertyDirty(WS, Entity, PropertyId::PosZ, Z);
    }

    FORCEINLINE void SetPosition(FHktWorldState& WS, FHktEntityId Entity, const FIntVector& Pos)
    {
        SetPosition(WS, Entity, Pos.X, Pos.Y, Pos.Z);
    }

    // --- PreFrame Access (3-Tier) ---
    int32 GetPreFrameValue(int32 Slot, uint16 PropId) const;

    FORCEINLINE const FGameplayTagContainer& GetPreFrameTags(int32 Slot) const
    {
        return PreFrameTagContainers[Slot];
    }

    FORCEINLINE int64 GetPreFrameOwnerUid(int32 Slot) const
    {
        return (Slot < PreFrameOwnerUids.Num()) ? PreFrameOwnerUids[Slot] : 0;
    }

    // --- Dirty Iteration ---
    template<typename F>
    void ForEachDirtyEntity(const FHktWorldState& WS, F&& Cb) const
    {
        for (int32 S : DirtySlots)
        {
            if (!WS.SlotToEntity.IsValidIndex(S)) continue;
            FHktEntityId Id = WS.SlotToEntity[S];
            if (Id != InvalidEntityId) Cb(Id, S, DirtyMask[S]);
        }
    }

    template<typename F>
    void ForEachTagDirtyEntity(const FHktWorldState& WS, F&& Cb) const
    {
        for (int32 S : TagsDirtySlots)
        {
            if (!WS.SlotToEntity.IsValidIndex(S)) continue;
            FHktEntityId Id = WS.SlotToEntity[S];
            if (Id != InvalidEntityId) Cb(Id, S);
        }
    }

    template<typename F>
    void ForEachOwnerDirtyEntity(const FHktWorldState& WS, F&& Cb) const
    {
        for (int32 S : OwnerDirtySlots)
        {
            if (!WS.SlotToEntity.IsValidIndex(S)) continue;
            FHktEntityId Id = WS.SlotToEntity[S];
            if (Id != InvalidEntityId) Cb(Id, S);
        }
    }
};
