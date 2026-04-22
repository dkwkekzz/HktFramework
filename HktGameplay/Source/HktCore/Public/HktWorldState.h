// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktCoreDefs.h"
#include "HktCoreEvents.h"
#include "HktCoreEventLog.h"
#include "HktCoreProperties.h"
#include "HktCoreArchetype.h"

// ============================================================================
// FHktPropertyPair — Warm/Overflow 페어 저장 단위
// ============================================================================

struct FHktPropertyPair
{
    static constexpr uint16 EmptyPropId = 0xFFFF;

    uint16 PropId = EmptyPropId;
    int32 Value = 0;

    FORCEINLINE bool IsEmpty() const { return PropId == EmptyPropId; }

    friend FArchive& operator<<(FArchive& Ar, FHktPropertyPair& P)
    {
        Ar << P.PropId << P.Value;
        return Ar;
    }
};

// ============================================================================
// FHktWorldState — 3-Tier Property Storage 기반 순수 게임 상태
//
// Hot:  HotData[Slot * HotStride + PropId]        — O(1) 직접 인덱싱
// Warm: WarmData[Slot * WarmCapacity + i]          — 선형 탐색 (고정 용량)
// Overflow: OverflowData[Slot]                     — 힙 TArray (Warm 초과 시)
// ============================================================================

struct HKTCORE_API FHktWorldState
{
    static inline const int32 HotStride = HktProperty::HotMaxCount();
    static constexpr int32 WarmCapacity = 16;

    // --- LogSource (시뮬레이터에서 설정) ---
    EHktLogSource LogSource = EHktLogSource::Server;

    // --- Frame State ---
    int64 FrameNumber = 0;
    int32 RandomSeed = 0;
    FHktEntityId NextEntityId = 0;

    // --- Entity Storage (3-Tier) ---
    TArray<int32> EntitySlots;                      // EntityId → Slot (-1 = invalid)
    TArray<int32> HotData;                          // Hot property storage
    TArray<FHktPropertyPair> WarmData;              // Warm property pairs
    TArray<TArray<FHktPropertyPair>> OverflowData;  // Heap overflow per slot
    TArray<FHktEntityId> SlotToEntity;              // Slot → EntityId reverse mapping
    TArray<int32> FreeSlots;                        // Free slot stack for reuse
    int32 ActiveCount = 0;

    TArray<FGameplayTagContainer> TagContainers;
    TArray<EHktArchetype> EntityArchetypes;             // Slot → Archetype 매핑
    TArray<int64> OwnerUids;
    TArray<FHktEvent> ActiveEvents;
    TArray<FHktVMSnapshot> ActiveVMSnapshots;       // Late-Join용 VM 런타임 스냅샷 (프레임 말미 캡처)

#if ENABLE_HKT_INSIGHTS
    /**
     * FHktEntityDebugInfo — 엔티티 디버그 정보 (Insights 전용)
     * 엔티티 생성 시점의 컨텍스트를 기록하여 디버깅 시각화에 활용.
     */
    struct FHktEntityDebugInfo
    {
        FString DebugName;      // 예: "Fireball@CharacterSpawn:F42"
        FString StoryTag;       // 생성 원인 Story 태그 (예: "Event.Character.Spawn")
        FString ClassTag;       // 엔티티 ClassTag (예: "Entity.Item.Sword")
        int64 CreationFrame = 0;// 생성 프레임
    };

    TArray<FHktEntityDebugInfo> EntityDebugInfos;  // Slot 기반 인덱싱

    /** 엔티티에 디버그 정보 설정 (Slot 기반) */
    void SetEntityDebugInfo(int32 Slot, const FString& StoryTag, const FString& ClassTag, int64 Frame);

    /** 엔티티 디버그 이름 조회 (EntityId 기반) */
    const FString& GetEntityDebugName(FHktEntityId Id) const;

    /** 엔티티 디버그 정보 전체 조회 (EntityId 기반) */
    const FHktEntityDebugInfo* GetEntityDebugInfo(FHktEntityId Id) const;
#endif // ENABLE_HKT_INSIGHTS

    // --- Lifecycle ---
    void Initialize();
    FHktEntityId AllocateEntity();
    void RemoveEntity(FHktEntityId Id);

    FORCEINLINE bool IsValidEntity(FHktEntityId Id) const
    {
        return Id >= 0 && Id < EntitySlots.Num() && EntitySlots[Id] >= 0;
    }

    // --- Slot-level Hot Data Access (내부/시스템용, Hot 전용) ---
    FORCEINLINE int32* HotEntityData(int32 Slot) { return HotData.GetData() + Slot * HotStride; }
    FORCEINLINE const int32* HotEntityData(int32 Slot) const { return HotData.GetData() + Slot * HotStride; }

    // --- 3-Tier Get/Set ---
    FORCEINLINE int32 Get(int32 Slot, uint16 PropId) const
    {
        if (PropId < HotStride)
        {
            return HotData[Slot * HotStride + PropId];
        }
        return GetCold(Slot, PropId);
    }

    FORCEINLINE void Set(int32 Slot, uint16 PropId, int32 V)
    {
        if (PropId < HotStride)
        {
            HotData[Slot * HotStride + PropId] = V;
            return;
        }
        SetCold(Slot, PropId, V);
    }

    // --- Property Access (EntityId 기반) ---
    FORCEINLINE int32 GetProperty(FHktEntityId Entity, uint16 PropId) const
    {
        if (!ensure(IsValidEntity(Entity))) return 0;
        return Get(EntitySlots[Entity], PropId);
    }

    FORCEINLINE void SetProperty(FHktEntityId Entity, uint16 PropId, int32 Value)
    {
        if (!ensure(IsValidEntity(Entity))) return;
        Set(EntitySlots[Entity], PropId, Value);
    }

    // --- Tag Access (EntityId 기반) ---
    const FGameplayTagContainer& GetTags(FHktEntityId Entity) const;
    void AddTag(FHktEntityId Entity, const FGameplayTag& Tag);
    void RemoveTag(FHktEntityId Entity, const FGameplayTag& Tag);
    bool HasTag(FHktEntityId Entity, const FGameplayTag& Tag) const;

    // --- Tag Access (Slot 기반, 내부용) ---
    FORCEINLINE const FGameplayTagContainer& GetTagsBySlot(int32 Slot) const { return TagContainers[Slot]; }

    // --- Archetype Access ---
    FORCEINLINE EHktArchetype GetArchetype(FHktEntityId Entity) const
    {
        if (!IsValidEntity(Entity)) return EHktArchetype::None;
        return EntityArchetypes[EntitySlots[Entity]];
    }

    FORCEINLINE void SetArchetype(FHktEntityId Entity, EHktArchetype Arch)
    {
        if (!ensure(IsValidEntity(Entity))) return;
        EntityArchetypes[EntitySlots[Entity]] = Arch;
    }

    /** 엔티티의 Archetype이 해당 Trait을 포함하는지 확인 */
    FORCEINLINE bool HasTrait(FHktEntityId Entity, const FHktPropertyTrait* Trait) const
    {
        if (!IsValidEntity(Entity)) return false;
        const FHktArchetypeMetadata* Meta = FHktArchetypeRegistry::Get().Find(GetArchetype(Entity));
        return Meta && Meta->HasTrait(Trait);
    }

    // --- Owner Access ---
    FORCEINLINE int64 GetOwnerUid(FHktEntityId Entity) const
    {
        if (!ensure(IsValidEntity(Entity))) return 0;
        return OwnerUids[EntitySlots[Entity]];
    }

    FORCEINLINE void SetOwnerUid(FHktEntityId Entity, int64 Uid)
    {
        if (!ensure(IsValidEntity(Entity))) return;
        OwnerUids[EntitySlots[Entity]] = Uid;
    }

    // --- Position shortcuts ---
    FORCEINLINE FIntVector GetPosition(FHktEntityId Entity) const
    {
        return FIntVector(
            GetProperty(Entity, PropertyId::PosX),
            GetProperty(Entity, PropertyId::PosY),
            GetProperty(Entity, PropertyId::PosZ));
    }

    FORCEINLINE void SetPosition(FHktEntityId Entity, int32 X, int32 Y, int32 Z)
    {
        SetProperty(Entity, PropertyId::PosX, X);
        SetProperty(Entity, PropertyId::PosY, Y);
        SetProperty(Entity, PropertyId::PosZ, Z);
    }

    FORCEINLINE void SetPosition(FHktEntityId Entity, const FIntVector& Pos)
    {
        SetPosition(Entity, Pos.X, Pos.Y, Pos.Z);
    }

    // --- Slot Access (내부 사용) ---
    FORCEINLINE int32 GetSlot(FHktEntityId Id) const { return EntitySlots[Id]; }

    // --- Iteration ---
    template<typename F> void ForEachEntity(F&& Cb) const
    {
        for (int32 S = 0; S < SlotToEntity.Num(); ++S)
            if (SlotToEntity[S] != InvalidEntityId) Cb(SlotToEntity[S], S);
    }

    template<typename F> void ForEachEntityByOwner(int64 OwnerUid, F&& Cb) const
    {
        if (ActiveCount == 0) return;
        ForEachEntity([&](FHktEntityId Id, int32 Slot)
        {
            if (OwnerUids[Slot] == OwnerUid)
                Cb(Id, Slot);
        });
    }

    // --- State ---
    int32 GetEntityCount() const;

    // --- DTO ---
    FHktEntityState ExtractEntityState(FHktEntityId Id) const;
    FHktEntityId ImportEntityState(const FHktEntityState& InState);
    void ImportEntityStateWithId(const FHktEntityState& InState);

    /** Diff 역적용 — 프레임 변경 되돌리기 */
    void UndoDiff(const FHktSimulationDiff& Diff);

    /** 전체 상태 복사 */
    void CopyFrom(const FHktWorldState& Other);

    // --- Serialization ---
    bool NetSerialize(FArchive& Ar, class UPackageMap* Map, bool& bOutSuccess);

private:
    int32 AllocateSlot(FHktEntityId EntityId);
    void FreeSlot(int32 Slot);
    void ClearSlotWarm(int32 Slot);

    // Cold (Warm+Overflow) 접근 헬퍼
    int32 GetCold(int32 Slot, uint16 PropId) const;
    void SetCold(int32 Slot, uint16 PropId, int32 V);
};

template<>
struct TStructOpsTypeTraits<FHktWorldState> : public TStructOpsTypeTraitsBase2<FHktWorldState>
{
    enum { WithNetSerializer = true };
};
