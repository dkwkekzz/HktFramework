// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
#include "HktCoreDefs.h"
#include "HktCoreEvents.h"
#include "HktWorldState.h"
#include "HktBagTypes.h"
#include "HktServerRuleInterfaces.h"
#include "HktRuntimeTypes.generated.h"

// =========================================================================
// [런타임 이벤트 / 네트워크 래퍼] (HKTRUNTIME 모듈)
// FHktEvent를 소유하며 암시적 변환 및 커스텀 직렬화를 제공합니다.
// =========================================================================
USTRUCT(BlueprintType)
struct HKTRUNTIME_API FHktRuntimeEvent
{
    GENERATED_BODY()

    // 1. 코어 이벤트를 내부에 값으로 소유 (동적 할당 및 포인터 연산 없음)
    FHktEvent Value;

    FHktRuntimeEvent() = default;

    // 이동 생성자: 제로 카피로 코어 이벤트 소유권 이전
    explicit FHktRuntimeEvent(FHktEvent&& InEvent)
        : Value(MoveTemp(InEvent))
    {}

    // 복사 생성자
    explicit FHktRuntimeEvent(const FHktEvent& InEvent)
        : Value(InEvent)
    {}

    // 대입 연산자: FHktEvent를 FHktRuntimeEvent에 대입
    FHktRuntimeEvent& operator=(const FHktEvent& InEvent)
    {
        Value = InEvent;
        return *this;
    }

    // 이동 대입 연산자
    FHktRuntimeEvent& operator=(FHktEvent&& InEvent)
    {
        Value = MoveTemp(InEvent);
        return *this;
    }

    // 2. 암시적 형변환 연산자
    // 이 구조체를 FHktEvent의 참조처럼 즉시 사용할 수 있게 합니다.
    FORCEINLINE operator FHktEvent&() { return Value; }
    FORCEINLINE operator const FHktEvent&() const { return Value; }

    // 편의를 위한 포인터 접근 연산자 오버로딩 (RuntimeEvent->EventId 형태로 사용 가능)
    FORCEINLINE FHktEvent* operator->() { return &Value; }
    FORCEINLINE const FHktEvent* operator->() const { return &Value; }

    // 3. 커스텀 직렬화 (엔진의 UHT 리플렉션을 거치지 않고 직접 바이트 전송)
    bool NetSerialize(FArchive& Ar, class UPackageMap* Map, bool& bOutSuccess)
    {
        Ar << Value;
        return bOutSuccess = true;
    }

    bool operator==(const FHktRuntimeEvent& Other) const
    {
        return Value.EventId == Other.Value.EventId;
    }

    bool operator!=(const FHktRuntimeEvent& Other) const
    {
        return !(*this == Other);
    }

    bool operator<(const FHktRuntimeEvent& Other) const
    {
        return Value.EventId < Other.Value.EventId;
    }

    bool IsValid() const 
    { 
        return Value.EventId != 0; 
    }
};

// 엔진에게 커스텀 직렬화 함수가 존재함을 알림
template<>
struct TStructOpsTypeTraits<FHktRuntimeEvent> : public TStructOpsTypeTraitsBase2<FHktRuntimeEvent>
{
    enum { WithNetSerializer = true };
};

//=============================================================================
// FHktRuntimeBatch - 기존 유저용 "입력(Input)" 패킷
// FHktSimulationEvent를 소유하며 암시적 변환 및 커스텀 직렬화를 제공합니다.
//=============================================================================
USTRUCT()
struct HKTRUNTIME_API FHktRuntimeBatch
{
    GENERATED_BODY()

    // 1. 코어 시뮬레이션 이벤트를 내부에 값으로 소유 (동적 할당 및 포인터 연산 없음)
    FHktSimulationEvent Value;

    FHktRuntimeBatch() = default;

    // 이동 생성자: 제로 카피로 코어 이벤트 소유권 이전
    explicit FHktRuntimeBatch(FHktSimulationEvent&& InEvent)
        : Value(MoveTemp(InEvent))
    {}

    // 복사 생성자
    explicit FHktRuntimeBatch(const FHktSimulationEvent& InEvent)
        : Value(InEvent)
    {}

    // 대입 연산자: FHktSimulationEvent를 FHktRuntimeBatch에 대입
    FHktRuntimeBatch& operator=(const FHktSimulationEvent& InEvent)
    {
        Value = InEvent;
        return *this;
    }

    // 이동 대입 연산자
    FHktRuntimeBatch& operator=(FHktSimulationEvent&& InEvent)
    {
        Value = MoveTemp(InEvent);
        return *this;
    }

    // 2. 암시적 형변환 연산자
    // 이 구조체를 FHktSimulationEvent의 참조처럼 즉시 사용할 수 있게 합니다.
    FORCEINLINE operator FHktSimulationEvent&() { return Value; }
    FORCEINLINE operator const FHktSimulationEvent&() const { return Value; }

    // 편의를 위한 포인터 접근 연산자 오버로딩 (RuntimeBatch->FrameNumber 형태로 사용 가능)
    FORCEINLINE FHktSimulationEvent* operator->() { return &Value; }
    FORCEINLINE const FHktSimulationEvent* operator->() const { return &Value; }

    // 3. 커스텀 직렬화 (엔진의 UHT 리플렉션을 거치지 않고 직접 바이트 전송)
    bool NetSerialize(FArchive& Ar, class UPackageMap* Map, bool& bOutSuccess)
    {
        return Value.NetSerialize(Ar, Map, bOutSuccess);
    }

    void Reset()
    {
        Value.FrameNumber = 0;
        Value.RandomSeed = 0;
        Value.RemovedOwnerIds.Reset();
        Value.NewEvents.Reset();
        Value.NewEntityStates.Reset();
    }
};

// 엔진에게 커스텀 직렬화 함수가 존재함을 알림
template<>
struct TStructOpsTypeTraits<FHktRuntimeBatch> : public TStructOpsTypeTraitsBase2<FHktRuntimeBatch>
{
    enum { WithNetSerializer = true };
};

//=============================================================================
// FHktRuntimeSimulationState - 신규 유저용 "결과(Result)" 패킷
// FHktWorldState를 소유하며 암시적 변환 및 커스텀 직렬화를 제공합니다.
//=============================================================================
// [중요] 그룹의 시뮬레이션 결과를 완벽하게 복원하기 위한 모든 데이터를 포함해야 함
USTRUCT()
struct HKTRUNTIME_API FHktRuntimeSimulationState
{
    GENERATED_BODY()

    // 1. 코어 월드 상태를 내부에 값으로 소유 (동적 할당 및 포인터 연산 없음)
    FHktWorldState Value;

    FHktRuntimeSimulationState() = default;

    // 이동 생성자: 제로 카피로 코어 상태 소유권 이전
    explicit FHktRuntimeSimulationState(FHktWorldState&& InState)
        : Value(MoveTemp(InState))
    {}

    // 복사 생성자
    explicit FHktRuntimeSimulationState(const FHktWorldState& InState)
        : Value(InState)
    {}

    // 대입 연산자: FHktWorldState를 FHktRuntimeSimulationState에 대입
    FHktRuntimeSimulationState& operator=(const FHktWorldState& InState)
    {
        Value = InState;
        return *this;
    }

    // 이동 대입 연산자
    FHktRuntimeSimulationState& operator=(FHktWorldState&& InState)
    {
        Value = MoveTemp(InState);
        return *this;
    }

    // 2. 암시적 형변환 연산자
    // 이 구조체를 FHktWorldState의 참조처럼 즉시 사용할 수 있게 합니다.
    FORCEINLINE operator FHktWorldState&() { return Value; }
    FORCEINLINE operator const FHktWorldState&() const { return Value; }

    // 편의를 위한 포인터 접근 연산자 오버로딩 (SimulationState->FrameNumber 형태로 사용 가능)
    FORCEINLINE FHktWorldState* operator->() { return &Value; }
    FORCEINLINE const FHktWorldState* operator->() const { return &Value; }

    // 3. 커스텀 직렬화 (엔진의 UHT 리플렉션을 거치지 않고 직접 바이트 전송)
    bool NetSerialize(FArchive& Ar, class UPackageMap* Map, bool& bOutSuccess)
    {
        return Value.NetSerialize(Ar, Map, bOutSuccess);
    }

    // 편의 메서드: LastProcessedFrameNumber 접근
    int64 GetLastProcessedFrameNumber() const { return Value.FrameNumber; }
    void SetLastProcessedFrameNumber(int64 FrameNumber) { Value.FrameNumber = FrameNumber; }
};

// 엔진에게 커스텀 직렬화 함수가 존재함을 알림
template<>
struct TStructOpsTypeTraits<FHktRuntimeSimulationState> : public TStructOpsTypeTraitsBase2<FHktRuntimeSimulationState>
{
    enum { WithNetSerializer = true };
};

//=============================================================================
// FHktRuntimeDiff - 기존 유저용 "프레임 Diff" 패킷 (Legacy / Proxy 시뮬레이터)
// FHktSimulationDiff를 소유하며 암시적 변환 및 복제 지원.
//=============================================================================
USTRUCT()
struct HKTRUNTIME_API FHktRuntimeDiff
{
	GENERATED_BODY()

	FHktSimulationDiff Value;

	FHktRuntimeDiff() = default;
	explicit FHktRuntimeDiff(const FHktSimulationDiff& InDiff) : Value(InDiff) {}
	explicit FHktRuntimeDiff(FHktSimulationDiff&& InDiff) : Value(MoveTemp(InDiff)) {}

	FORCEINLINE operator FHktSimulationDiff&() { return Value; }
	FORCEINLINE operator const FHktSimulationDiff&() const { return Value; }

	bool NetSerialize(FArchive& Ar, class UPackageMap* Map, bool& bOutSuccess)
	{
        return Value.NetSerialize(Ar, Map, bOutSuccess);
	}
};

template<>
struct TStructOpsTypeTraits<FHktRuntimeDiff> : public TStructOpsTypeTraitsBase2<FHktRuntimeDiff>
{
	enum { WithNetSerializer = true };
};

// FHktRuntimeSlotRequest — 제거됨: Server_ReceiveRuntimeEvent로 통합
// FHktRuntimeItemRequest — 제거됨: Server_ReceiveRuntimeEvent로 통합
// FHktRuntimeMoveRequest — 제거됨: Server_ReceiveRuntimeEvent로 통합

//=============================================================================
// FHktRuntimeBagRequest — 가방 요청 네트워크 래퍼
//=============================================================================
USTRUCT()
struct HKTRUNTIME_API FHktRuntimeBagRequest
{
	GENERATED_BODY()

	FHktBagRequest Value;

	FHktRuntimeBagRequest() = default;
	explicit FHktRuntimeBagRequest(const FHktBagRequest& In) : Value(In) {}

	FORCEINLINE operator FHktBagRequest&() { return Value; }
	FORCEINLINE operator const FHktBagRequest&() const { return Value; }

	bool NetSerialize(FArchive& Ar, class UPackageMap* Map, bool& bOutSuccess)
	{
		Ar << Value;
		return bOutSuccess = true;
	}
};

template<>
struct TStructOpsTypeTraits<FHktRuntimeBagRequest> : public TStructOpsTypeTraitsBase2<FHktRuntimeBagRequest>
{
	enum { WithNetSerializer = true };
};

//=============================================================================
// FHktRuntimeBagUpdate — 가방 변경 알림 네트워크 래퍼 (S2C)
//=============================================================================
USTRUCT()
struct HKTRUNTIME_API FHktRuntimeBagUpdate
{
	GENERATED_BODY()

	FHktBagDelta Value;

	FHktRuntimeBagUpdate() = default;
	explicit FHktRuntimeBagUpdate(const FHktBagDelta& In) : Value(In) {}
	explicit FHktRuntimeBagUpdate(FHktBagDelta&& In) : Value(MoveTemp(In)) {}

	FORCEINLINE operator FHktBagDelta&() { return Value; }
	FORCEINLINE operator const FHktBagDelta&() const { return Value; }

	bool NetSerialize(FArchive& Ar, class UPackageMap* Map, bool& bOutSuccess)
	{
		return Value.NetSerialize(Ar, Map, bOutSuccess);
	}
};

template<>
struct TStructOpsTypeTraits<FHktRuntimeBagUpdate> : public TStructOpsTypeTraitsBase2<FHktRuntimeBagUpdate>
{
	enum { WithNetSerializer = true };
};
