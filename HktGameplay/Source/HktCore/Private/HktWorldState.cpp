// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktWorldState.h"
#include "HktCoreProperties.h"
#include "HktSimulationLimits.h"
#include "HktCoreLog.h"
#include "HktCoreEventLog.h"

// ============================================================================
// Cold (Warm + Overflow) Access Helpers
// ============================================================================

int32 FHktWorldState::GetCold(int32 Slot, uint16 PropId) const
{
    const FHktPropertyPair* Base = &WarmData[Slot * WarmCapacity];
    for (int32 i = 0; i < WarmCapacity; ++i)
    {
        if (Base[i].PropId == PropId) return Base[i].Value;
        if (Base[i].IsEmpty()) break;
    }
    if (OverflowData.IsValidIndex(Slot))
    {
        for (const FHktPropertyPair& P : OverflowData[Slot])
            if (P.PropId == PropId) return P.Value;
    }
    return 0;
}

void FHktWorldState::SetCold(int32 Slot, uint16 PropId, int32 V)
{
    FHktPropertyPair* Base = &WarmData[Slot * WarmCapacity];

    // 기존 슬롯에서 검색
    int32 FirstEmpty = -1;
    for (int32 i = 0; i < WarmCapacity; ++i)
    {
        if (Base[i].PropId == PropId)
        {
            Base[i].Value = V;
            return;
        }
        if (Base[i].IsEmpty() && FirstEmpty < 0)
        {
            FirstEmpty = i;
            break;  // Empty 이후는 모두 Empty
        }
    }

    // 빈 슬롯이 있으면 삽입
    if (FirstEmpty >= 0)
    {
        Base[FirstEmpty].PropId = PropId;
        Base[FirstEmpty].Value = V;
        return;
    }

    // Overflow 검색 후 삽입
    if (OverflowData.IsValidIndex(Slot))
    {
        for (FHktPropertyPair& P : OverflowData[Slot])
        {
            if (P.PropId == PropId)
            {
                P.Value = V;
                return;
            }
        }
        OverflowData[Slot].Add({ PropId, V });
    }
}

// ============================================================================
// Slot Management (private)
// ============================================================================

void FHktWorldState::ClearSlotWarm(int32 Slot)
{
    FHktPropertyPair* Base = &WarmData[Slot * WarmCapacity];
    for (int32 i = 0; i < WarmCapacity; ++i)
    {
        Base[i].PropId = FHktPropertyPair::EmptyPropId;
        Base[i].Value = 0;
    }
    if (OverflowData.IsValidIndex(Slot))
    {
        OverflowData[Slot].Reset();
    }
}

int32 FHktWorldState::AllocateSlot(FHktEntityId EntityId)
{
    int32 Slot;
    if (FreeSlots.Num() > 0)
    {
        Slot = FreeSlots.Pop();
        SlotToEntity[Slot] = EntityId;
        TagContainers[Slot].Reset();
        EntityArchetypes[Slot] = EHktArchetype::None;
        OwnerUids[Slot] = 0;
#if ENABLE_HKT_INSIGHTS
        if (Slot < EntityDebugInfos.Num())
        {
            EntityDebugInfos[Slot] = FHktEntityDebugInfo();
        }
#endif
    }
    else
    {
        Slot = SlotToEntity.Num();
        SlotToEntity.Add(EntityId);
        HotData.AddZeroed(HotStride);
        WarmData.AddDefaulted(WarmCapacity);
        OverflowData.AddDefaulted(1);
        TagContainers.Add({});
        EntityArchetypes.Add(EHktArchetype::None);
        OwnerUids.Add(0);
#if ENABLE_HKT_INSIGHTS
        EntityDebugInfos.AddDefaulted(1);
#endif
    }
    FMemory::Memzero(HotData.GetData() + Slot * HotStride, HotStride * sizeof(int32));
    ClearSlotWarm(Slot);
    ActiveCount++;
    return Slot;
}

void FHktWorldState::FreeSlot(int32 Slot)
{
    SlotToEntity[Slot] = InvalidEntityId;
    TagContainers[Slot].Reset();
    EntityArchetypes[Slot] = EHktArchetype::None;
    OwnerUids[Slot] = 0;
    ClearSlotWarm(Slot);
    FreeSlots.Add(Slot);
    ActiveCount--;
}

// ============================================================================
// Lifecycle
// ============================================================================

void FHktWorldState::Initialize()
{
    EntitySlots.Reserve(HktLimits::MaxEntities);
    ActiveEvents.Reserve(HktLimits::MaxActiveEvents);

    constexpr int32 ReserveCount = 2176;  // 512 + 1024 + 512 + 128
    HotData.Reserve(ReserveCount * HotStride);
    WarmData.Reserve(ReserveCount * WarmCapacity);
    OverflowData.Reserve(ReserveCount);
    SlotToEntity.Reserve(ReserveCount);
    TagContainers.Reserve(ReserveCount);
    OwnerUids.Reserve(ReserveCount);
#if ENABLE_HKT_INSIGHTS
    EntityDebugInfos.Reserve(ReserveCount);
#endif
}

FHktEntityId FHktWorldState::AllocateEntity()
{
    FHktEntityId NewId = NextEntityId++;
    if (NewId >= EntitySlots.Num())
    {
        int32 OldNum = EntitySlots.Num();
        EntitySlots.SetNum(NewId + 1);
        for (int32 i = OldNum; i < EntitySlots.Num(); ++i)
            EntitySlots[i] = -1;
    }
    int32 Slot = AllocateSlot(NewId);
    EntitySlots[NewId] = Slot;
    HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Entity, EHktLogLevel::Info, LogSource,
        FString::Printf(TEXT("AllocateEntity Id=%d Slot=%d"), NewId, Slot), NewId);
    return NewId;
}

void FHktWorldState::RemoveEntity(FHktEntityId Id)
{
    if (!IsValidEntity(Id)) return;
    HKT_EVENT_LOG_ENTITY(HktLogTags::Core_Entity, EHktLogLevel::Info, LogSource,
        FString::Printf(TEXT("RemoveEntity Id=%d"), Id), Id);
    FreeSlot(EntitySlots[Id]);
    EntitySlots[Id] = -1;
}

int32 FHktWorldState::GetEntityCount() const
{
    return ActiveCount;
}

// ============================================================================
// DTO
// ============================================================================

FHktEntityState FHktWorldState::ExtractEntityState(FHktEntityId Id) const
{
    FHktEntityState S;
    S.EntityId = Id;
    if (!IsValidEntity(Id)) return S;
    int32 Slot = EntitySlots[Id];

    // Hot + Cold를 단일 배열로 복원
    S.Data.SetNumZeroed(PropertyId::MaxCount());
    FMemory::Memcpy(S.Data.GetData(), HotEntityData(Slot), HotStride * sizeof(int32));

    // Warm
    const FHktPropertyPair* Base = &WarmData[Slot * WarmCapacity];
    for (int32 i = 0; i < WarmCapacity; ++i)
    {
        if (Base[i].IsEmpty()) break;
        if (Base[i].PropId < PropertyId::MaxCount())
            S.Data[Base[i].PropId] = Base[i].Value;
    }

    // Overflow
    if (OverflowData.IsValidIndex(Slot))
    {
        for (const FHktPropertyPair& P : OverflowData[Slot])
            if (P.PropId < PropertyId::MaxCount())
                S.Data[P.PropId] = P.Value;
    }

    S.Tags = TagContainers[Slot];
    S.OwnerUid = OwnerUids[Slot];
    return S;
}

FHktEntityId FHktWorldState::ImportEntityState(const FHktEntityState& InState)
{
    FHktEntityId Id = AllocateEntity();
    int32 Slot = EntitySlots[Id];

    // Hot 영역 복사
    int32 HotN = FMath::Min(HotStride, InState.Data.Num());
    FMemory::Memcpy(HotEntityData(Slot), InState.Data.GetData(), HotN * sizeof(int32));

    // Cold 영역을 Warm에 분배
    for (int32 P = HotStride; P < FMath::Min((int32)PropertyId::MaxCount(), InState.Data.Num()); ++P)
    {
        if (InState.Data[P] != 0)
            SetCold(Slot, static_cast<uint16>(P), InState.Data[P]);
    }

    TagContainers[Slot] = InState.Tags;
    OwnerUids[Slot] = InState.OwnerUid;
    return Id;
}

void FHktWorldState::ImportEntityStateWithId(const FHktEntityState& InState)
{
    FHktEntityId Id = InState.EntityId;
    if (Id >= EntitySlots.Num())
    {
        int32 OldNum = EntitySlots.Num();
        EntitySlots.SetNum(Id + 1);
        for (int32 i = OldNum; i < EntitySlots.Num(); ++i)
            EntitySlots[i] = -1;
    }
    int32 Slot = AllocateSlot(Id);
    EntitySlots[Id] = Slot;

    // Hot 영역 복사
    int32 HotN = FMath::Min(HotStride, InState.Data.Num());
    FMemory::Memcpy(HotEntityData(Slot), InState.Data.GetData(), HotN * sizeof(int32));

    // Cold 영역을 Warm에 분배
    for (int32 P = HotStride; P < FMath::Min((int32)PropertyId::MaxCount(), InState.Data.Num()); ++P)
    {
        if (InState.Data[P] != 0)
            SetCold(Slot, static_cast<uint16>(P), InState.Data[P]);
    }

    TagContainers[Slot] = InState.Tags;
    OwnerUids[Slot] = InState.OwnerUid;
}

// ============================================================================
// UndoDiff
// ============================================================================

void FHktWorldState::UndoDiff(const FHktSimulationDiff& Diff)
{
    HKT_EVENT_LOG(HktLogTags::Core_Entity, EHktLogLevel::Info, LogSource,
        FString::Printf(TEXT("UndoDiff Frame=%lld Spawned=%d Removed=%d Props=%d"),
            Diff.FrameNumber, Diff.SpawnedEntities.Num(), Diff.RemovedEntityStates.Num(), Diff.PropertyDeltas.Num()));
    for (const FHktEntityState& S : Diff.SpawnedEntities)
        RemoveEntity(S.EntityId);

    if (Diff.PrevNextEntityId != InvalidEntityId)
        NextEntityId = Diff.PrevNextEntityId;

    for (const FHktEntityState& S : Diff.RemovedEntityStates)
        ImportEntityStateWithId(S);

    for (const FHktPropertyDelta& D : Diff.PropertyDeltas)
        SetProperty(D.EntityId, D.PropertyId, D.OldValue);

    for (const FHktOwnerDelta& D : Diff.OwnerDeltas)
        SetOwnerUid(D.EntityId, D.OldOwnerUid);

    for (const FHktTagDelta& D : Diff.TagDeltas)
    {
        if (!IsValidEntity(D.EntityId)) continue;
        TagContainers[EntitySlots[D.EntityId]] = D.OldTags;
    }

    FrameNumber = Diff.FrameNumber - 1;
}

// ============================================================================
// CopyFrom
// ============================================================================

void FHktWorldState::CopyFrom(const FHktWorldState& Other)
{
    FrameNumber = Other.FrameNumber;
    RandomSeed = Other.RandomSeed;
    NextEntityId = Other.NextEntityId;
    EntitySlots = Other.EntitySlots;
    ActiveEvents = Other.ActiveEvents;

    HotData = Other.HotData;
    WarmData = Other.WarmData;
    OverflowData = Other.OverflowData;
    SlotToEntity = Other.SlotToEntity;
    FreeSlots = Other.FreeSlots;
    ActiveCount = Other.ActiveCount;
    TagContainers = Other.TagContainers;
    EntityArchetypes = Other.EntityArchetypes;
    OwnerUids = Other.OwnerUids;

#if ENABLE_HKT_INSIGHTS
    EntityDebugInfos = Other.EntityDebugInfos;
#endif
}

// ============================================================================
// Serialization
// ============================================================================

bool FHktWorldState::NetSerialize(FArchive& Ar, class UPackageMap* Map, bool& bOutSuccess)
{
    Ar << FrameNumber << RandomSeed << NextEntityId;

    if (Ar.IsSaving())
    {
        int32 TotalEntities = ActiveCount;
        Ar << TotalEntities;

        ForEachEntity([&](FHktEntityId Id, int32 Slot)
        {
            Ar << Id;

            // Hot properties
            for (int32 P = 0; P < HotStride; ++P)
            {
                int32 Val = HotEntityData(Slot)[P];
                Ar << Val;
            }

            // Warm properties: count + pairs
            const FHktPropertyPair* Base = &WarmData[Slot * WarmCapacity];
            int32 WarmCount = 0;
            for (int32 i = 0; i < WarmCapacity; ++i)
            {
                if (Base[i].IsEmpty()) break;
                WarmCount++;
            }
            Ar << WarmCount;
            for (int32 i = 0; i < WarmCount; ++i)
            {
                uint16 PId = Base[i].PropId;
                int32 Val = Base[i].Value;
                Ar << PId << Val;
            }

            // Overflow properties: count + pairs
            int32 OverflowCount = OverflowData.IsValidIndex(Slot) ? OverflowData[Slot].Num() : 0;
            Ar << OverflowCount;
            for (int32 i = 0; i < OverflowCount; ++i)
            {
                uint16 PId = OverflowData[Slot][i].PropId;
                int32 Val = OverflowData[Slot][i].Value;
                Ar << PId << Val;
            }

            TagContainers[Slot].NetSerialize(Ar, Map, bOutSuccess);
            Ar << OwnerUids[Slot];
        });
    }
    else // IsLoading
    {
        EntitySlots.Reset();
        HotData.Reset();
        WarmData.Reset();
        OverflowData.Reset();
        SlotToEntity.Reset();
        FreeSlots.Reset();
        TagContainers.Reset();
        EntityArchetypes.Reset();
        OwnerUids.Reset();
        ActiveCount = 0;
#if ENABLE_HKT_INSIGHTS
        EntityDebugInfos.Reset();
#endif

        int32 TotalEntities; Ar << TotalEntities;
        for (int32 i = 0; i < TotalEntities; ++i)
        {
            FHktEntityId Id; Ar << Id;

            if (Id >= EntitySlots.Num())
            {
                int32 OldNum = EntitySlots.Num();
                EntitySlots.SetNum(Id + 1);
                for (int32 j = OldNum; j < EntitySlots.Num(); ++j)
                    EntitySlots[j] = -1;
            }

            int32 Slot = AllocateSlot(Id);
            EntitySlots[Id] = Slot;

            // Hot properties
            for (int32 P = 0; P < HotStride; ++P)
                Ar << HotEntityData(Slot)[P];

            // Warm properties
            int32 WarmCount; Ar << WarmCount;
            FHktPropertyPair* Base = &WarmData[Slot * WarmCapacity];
            for (int32 w = 0; w < WarmCount; ++w)
            {
                uint16 PId; int32 Val;
                Ar << PId << Val;
                if (w < WarmCapacity)
                {
                    Base[w].PropId = PId;
                    Base[w].Value = Val;
                }
                else
                {
                    OverflowData[Slot].Add({ PId, Val });
                }
            }

            // Overflow properties
            int32 OverflowCount; Ar << OverflowCount;
            for (int32 o = 0; o < OverflowCount; ++o)
            {
                uint16 PId; int32 Val;
                Ar << PId << Val;
                OverflowData[Slot].Add({ PId, Val });
            }

            TagContainers[Slot].NetSerialize(Ar, Map, bOutSuccess);
            Ar << OwnerUids[Slot];
        }
    }

    Ar << ActiveEvents;
    return true;
}

// ============================================================================
// Tag Access (EntityId 기반)
// ============================================================================

const FGameplayTagContainer& FHktWorldState::GetTags(FHktEntityId Entity) const
{
    static FGameplayTagContainer Empty;
    if (!IsValidEntity(Entity)) return Empty;
    return TagContainers[EntitySlots[Entity]];
}

void FHktWorldState::AddTag(FHktEntityId Entity, const FGameplayTag& Tag)
{
    if (!IsValidEntity(Entity)) return;
    HKT_EVENT_LOG_TAG(HktLogTags::Core_Entity, EHktLogLevel::Info, LogSource,
        FString::Printf(TEXT("AddTag Id=%d Tag=%s"), Entity, *Tag.ToString()), Entity, Tag);
    TagContainers[EntitySlots[Entity]].AddTag(Tag);
}

void FHktWorldState::RemoveTag(FHktEntityId Entity, const FGameplayTag& Tag)
{
    if (!IsValidEntity(Entity)) return;
    HKT_EVENT_LOG_TAG(HktLogTags::Core_Entity, EHktLogLevel::Info, LogSource,
        FString::Printf(TEXT("RemoveTag Id=%d Tag=%s"), Entity, *Tag.ToString()), Entity, Tag);
    TagContainers[EntitySlots[Entity]].RemoveTag(Tag);
}

bool FHktWorldState::HasTag(FHktEntityId Entity, const FGameplayTag& Tag) const
{
    if (!IsValidEntity(Entity)) return false;
    return TagContainers[EntitySlots[Entity]].HasTag(Tag);
}

// ============================================================================
// Entity Debug Info (Insights)
// ============================================================================

#if ENABLE_HKT_INSIGHTS

void FHktWorldState::SetEntityDebugInfo(int32 Slot, const FString& StoryTag, const FString& ClassTag, int64 Frame)
{
    if (Slot >= 0 && Slot < EntityDebugInfos.Num())
    {
        FHktEntityDebugInfo& Info = EntityDebugInfos[Slot];
        Info.StoryTag = StoryTag;
        Info.ClassTag = ClassTag;
        Info.CreationFrame = Frame;
        // 간결한 디버그 이름 생성: "ClassTag@StoryTag:F{Frame}"
        // 예: "Entity.Item.Sword@Event.Character.Spawn:F42"
        Info.DebugName = FString::Printf(TEXT("%s@%s:F%lld"), *ClassTag, *StoryTag, Frame);
    }
}

const FString& FHktWorldState::GetEntityDebugName(FHktEntityId Id) const
{
    static FString Empty;
    if (!IsValidEntity(Id)) return Empty;
    int32 Slot = EntitySlots[Id];
    if (Slot >= 0 && Slot < EntityDebugInfos.Num())
    {
        return EntityDebugInfos[Slot].DebugName;
    }
    return Empty;
}

const FHktWorldState::FHktEntityDebugInfo* FHktWorldState::GetEntityDebugInfo(FHktEntityId Id) const
{
    if (!IsValidEntity(Id)) return nullptr;
    int32 Slot = EntitySlots[Id];
    if (Slot >= 0 && Slot < EntityDebugInfos.Num())
    {
        return &EntityDebugInfos[Slot];
    }
    return nullptr;
}

#endif
