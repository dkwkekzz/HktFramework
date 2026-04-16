// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktCoreDefs.h"
#include "GameplayTagContainer.h"
#include "UObject/NoExportTypes.h"

// ============================================================================
// Inline Payload — 이벤트 내 가변 데이터 컨테이너
// ============================================================================

struct FHktInlinePayload
{
    static constexpr int32 Capacity = 48;
    uint8 Data[Capacity] = { 0 };
    uint8 Size = 0;

    FHktInlinePayload() = default;

    template <typename... Args>
    void Set(Args... InArgs) { Size = 0; (Write(InArgs), ...); }

    template <typename T>
    void Write(const T& Value)
    {
        static_assert(TIsBitwiseConstructible<T>::Value, "Only bitwise-copyable types.");
        if (Size + sizeof(T) <= Capacity)
        {
            FMemory::Memcpy(Data + Size, &Value, sizeof(T));
            Size += sizeof(T);
        }
    }

    template <typename T>
    T Get(int32 Offset) const
    {
        T Result;
        if (Offset + sizeof(T) <= Size) FMemory::Memcpy(&Result, Data + Offset, sizeof(T));
        else FMemory::Memset(&Result, 0, sizeof(T));
        return Result;
    }

    bool operator==(const FHktInlinePayload& Other) const
    {
        return Size == Other.Size && FMemory::Memcmp(Data, Other.Data, Size) == 0;
    }
    bool operator!=(const FHktInlinePayload& Other) const { return !(*this == Other); }

    friend FArchive& operator<<(FArchive& Ar, FHktInlinePayload& P)
    {
        Ar << P.Size;
        if (P.Size > 0) Ar.Serialize(P.Data, P.Size);
        return Ar;
    }

    bool NetSerialize(FArchive& Ar, class UPackageMap* Map, bool& bOutSuccess)
    {
        Ar << Size;
        if (Size > 0) Ar.Serialize(Data, Size);
        bOutSuccess = true;
        return true;
    }
};

template<>
struct TStructOpsTypeTraits<FHktInlinePayload> : public TStructOpsTypeTraitsBase2<FHktInlinePayload>
{
    enum { WithNetSerializer = true };
};

// ============================================================================
// FHktEvent — 범용 게임플레이 이벤트
// ============================================================================

struct HKTCORE_API FHktEvent
{
    int32 EventId = 0;
    FGameplayTag EventTag;
    FHktEntityId SourceEntity = InvalidEntityId;
    FHktEntityId TargetEntity = InvalidEntityId;
    FVector Location = FVector::ZeroVector;
    int64 PlayerUid = 0;
    int32 Param0 = 0;
    int32 Param1 = 0;

    FString ToString() const
    {
        return FString::Printf(TEXT("EventId=%d Tag=%s Src=%d Tgt=%d PlayerUid=%lld"),
            EventId, *EventTag.ToString(), SourceEntity, TargetEntity, PlayerUid);
    }

    friend FArchive& operator<<(FArchive& Ar, FHktEvent& E)
    {
        Ar << E.EventId << E.SourceEntity << E.EventTag;
        Ar << E.TargetEntity << E.Location << E.PlayerUid << E.Param0 << E.Param1;
        return Ar;
    }
};

// ============================================================================
// FHktEntityState — 엔티티 DTO (직렬화 / Diff / DB)
//
// Data[PropId] = property value. size = HktProperty::MaxCount(). memcpy로 풀과 교환 가능.
// ============================================================================

struct HKTCORE_API FHktEntityState
{
    FHktEntityId EntityId = InvalidEntityId;
    TArray<int32> Data;
    FGameplayTagContainer Tags;
    int64 OwnerUid = 0;

    bool NetSerialize(FArchive& Ar, class UPackageMap* Map, bool& bOutSuccess)
    {
        Ar << EntityId << Data;
        Tags.NetSerialize(Ar, Map, bOutSuccess);
        Ar << OwnerUid;
        return true;
    }
};

template<>
struct TStructOpsTypeTraits<FHktEntityState> : public TStructOpsTypeTraitsBase2<FHktEntityState>
{
    enum { WithNetSerializer = true };
};

// ============================================================================
// FHktSimulationEvent — 프레임 단위 시뮬레이션 입력
// ============================================================================

struct HKTCORE_API FHktSimulationEvent
{
    int64 FrameNumber = 0;
    int32 RandomSeed = 0;
    float DeltaSeconds = 0.0f;
    TArray<int64> RemovedOwnerIds;
    TArray<FHktEvent> NewEvents;
    TArray<FHktEntityState> NewEntityStates;  // ← 추가: 신규 진입자 엔티티

    FString ToString() const
    {
        return FString::Printf(TEXT("Frame=%lld Seed=%d Dt=%.3f Removed=%d Events=%d NewStates=%d"),
            FrameNumber, RandomSeed, DeltaSeconds, RemovedOwnerIds.Num(), NewEvents.Num(), NewEntityStates.Num());
    }

    void Reset()
    {
        FrameNumber = 0; RandomSeed = 0; DeltaSeconds = 0.0f;
        RemovedOwnerIds.Reset(); NewEvents.Reset();
        NewEntityStates.Reset();  // ← 추가
    }

    bool NetSerialize(FArchive& Ar, class UPackageMap* Map, bool& bOutSuccess)
    {
        Ar << FrameNumber << RandomSeed << DeltaSeconds << RemovedOwnerIds << NewEvents;
        bOutSuccess = SafeNetSerializeTArray_WithNetSerialize<1024>(Ar, NewEntityStates, Map);
        return bOutSuccess;
    }
};

template<>
struct TStructOpsTypeTraits<FHktSimulationEvent> : public TStructOpsTypeTraitsBase2<FHktSimulationEvent>
{
    enum { WithNetSerializer = true };
};

// ============================================================================
// FHktPropertyDelta — 단일 프로퍼티 변경
// ============================================================================

struct HKTCORE_API FHktPropertyDelta
{
    FHktEntityId EntityId = InvalidEntityId;
    uint16 PropertyId = 0;
    int32 NewValue = 0;
    int32 OldValue = 0;

    friend FArchive& operator<<(FArchive& Ar, FHktPropertyDelta& D)
    {
        Ar << D.EntityId << D.PropertyId << D.NewValue << D.OldValue;
        return Ar;
    }
};

// ============================================================================
// FHktTagDelta — 엔티티 태그 변경 스냅샷 (서버 → 클라이언트)
// ============================================================================

struct HKTCORE_API FHktTagDelta
{
    FHktEntityId EntityId = InvalidEntityId;
    FGameplayTagContainer Tags;
    FGameplayTagContainer OldTags;

    bool NetSerialize(FArchive& Ar, class UPackageMap* Map, bool& bOutSuccess)
    {
        Ar << EntityId;
        Tags.NetSerialize(Ar, Map, bOutSuccess);
        OldTags.NetSerialize(Ar, Map, bOutSuccess);
        return bOutSuccess;
    }
};

template<>
struct TStructOpsTypeTraits<FHktTagDelta> : public TStructOpsTypeTraitsBase2<FHktTagDelta>
{
    enum { WithNetSerializer = true };
};

// ============================================================================
// FHktOwnerDelta — 엔티티 소유권 변경
// ============================================================================

struct HKTCORE_API FHktOwnerDelta
{
    FHktEntityId EntityId = InvalidEntityId;
    int64 NewOwnerUid = 0;
    int64 OldOwnerUid = 0;

    friend FArchive& operator<<(FArchive& Ar, FHktOwnerDelta& D)
    {
        Ar << D.EntityId << D.NewOwnerUid << D.OldOwnerUid;
        return Ar;
    }
};

// ============================================================================
// FHktVFXEvent — VM이 요청한 일회성 VFX 이벤트 (재생 후 자동 파괴)
// ============================================================================

struct HKTCORE_API FHktVFXEvent
{
    FGameplayTag Tag;
    FIntVector Position;

    friend FArchive& operator<<(FArchive& Ar, FHktVFXEvent& V)
    {
        return Ar << V.Tag << V.Position;
    }
};

// ============================================================================
// FHktAnimEvent — VM이 요청한 일회성 애니메이션 이벤트 (몽타주 fire-and-forget)
// ============================================================================

struct HKTCORE_API FHktAnimEvent
{
    FGameplayTag Tag;
    FHktEntityId EntityId = InvalidEntityId;

    friend FArchive& operator<<(FArchive& Ar, FHktAnimEvent& V)
    {
        return Ar << V.Tag << V.EntityId;
    }
};

// ============================================================================
// FHktVoxelDelta — 단일 복셀 변경 (VM → 렌더 캐시)
// ============================================================================

struct HKTCORE_API FHktVoxelDelta
{
    FIntVector ChunkCoord;
    uint16 LocalIndex = 0;       // 청크 내 복셀 인덱스 (0~32767)
    uint16 NewTypeID = 0;
    uint8  NewPaletteIndex = 0;
    uint8  NewFlags = 0;

    friend FArchive& operator<<(FArchive& Ar, FHktVoxelDelta& D)
    {
        Ar << D.ChunkCoord << D.LocalIndex << D.NewTypeID << D.NewPaletteIndex << D.NewFlags;
        return Ar;
    }
};

// ============================================================================
// FHktSimulationDiff — 프레임별 변경점 (서버 → 클라이언트)
// ============================================================================

struct HKTCORE_API FHktSimulationDiff
{
    int64 FrameNumber = 0;
    TArray<FHktPropertyDelta> PropertyDeltas;
    FHktEntityId PrevNextEntityId = InvalidEntityId;  // 이 프레임 실행 전 NextEntityId (Undo 시 복원)
    TArray<FHktEntityState> SpawnedEntities;
    TArray<FHktEntityState> RemovedEntityStates;  // 제거된 엔티티 전체 상태 (UndoDiff 복원용)
    TArray<FHktTagDelta> TagDeltas;
    TArray<FHktOwnerDelta> OwnerDeltas;
    TArray<FHktVFXEvent> VFXEvents;
    TArray<FHktAnimEvent> AnimEvents;
    TArray<FHktVoxelDelta> VoxelDeltas;  // 복셀 변경 이벤트 (VM → 렌더 캐시)

    bool NetSerialize(FArchive& Ar, class UPackageMap* Map, bool& bOutSuccess)
    {
        Ar << FrameNumber << PropertyDeltas << PrevNextEntityId;
        bOutSuccess = SafeNetSerializeTArray_WithNetSerialize<1024>(Ar, SpawnedEntities, Map);
        bOutSuccess = SafeNetSerializeTArray_WithNetSerialize<1024>(Ar, RemovedEntityStates, Map);
        bOutSuccess = SafeNetSerializeTArray_WithNetSerialize<1024>(Ar, TagDeltas, Map);
        Ar << OwnerDeltas << VFXEvents << AnimEvents << VoxelDeltas;
        return true;
    }
};

template<>
struct TStructOpsTypeTraits<FHktSimulationDiff> : public TStructOpsTypeTraitsBase2<FHktSimulationDiff>
{
    enum { WithNetSerializer = true };
};

// ============================================================================
// FHktPlayerState — 플레이어 단위 상태 (그룹 이동 / DB 저장)
// ============================================================================

struct HKTCORE_API FHktPlayerState
{
    int64 PlayerUid = 0;
    TArray<FHktEvent> ActiveEvents;
    TArray<FHktEntityState> OwnedEntities;

    bool NetSerialize(FArchive& Ar, class UPackageMap* Map, bool& bOutSuccess)
    {
        Ar << PlayerUid << ActiveEvents;
        bOutSuccess = SafeNetSerializeTArray_WithNetSerialize<1024>(Ar, OwnedEntities, Map);
        return true;
    }
};

template<>
struct TStructOpsTypeTraits<FHktPlayerState> : public TStructOpsTypeTraitsBase2<FHktPlayerState>
{
    enum { WithNetSerializer = true };
};
