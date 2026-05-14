// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktCoreDefs.h"
#include "GameplayTagContainer.h"
#include "HAL/CriticalSection.h"

// ============================================================================
// HktVMEventRecorder — VM 이벤트 3종 (FHktEvent / FHktPendingEvent / FHktPhysicsEvent)
// 의 생성·소비 라이프사이클을 기록/재생하기 위한 링버퍼 싱글톤.
//
// Shipping 빌드에서는 `ENABLE_HKT_INSIGHTS` 가 0 이므로 매크로는 no-op 으로 컴파일된다.
//
// 사용 흐름:
//   1. SHktVMEventPanel 패널 열림 → SetActive(true) (자동 기록 시작)
//   2. VMBuildSystem / VMProcessSystem / PhysicsSystem / Movement 등 시뮬레이션
//      훅 지점에서 HKT_VM_EVENT_RECORD_* 매크로로 기록
//   3. 패널 닫힘 → SetActive(false) (수집 비활성, 버퍼 보존)
//   4. 녹화: BeginRecording / EndRecording 으로 영구 보관 가능한 별도 스냅샷 확보
// ============================================================================

/** 어떤 자료형의 이벤트인가 */
enum class EHktVMEventKind : uint8
{
    Event = 0,         // FHktEvent (외부 트리거 → VMBuildSystem)
    PendingEvent = 1,  // FHktPendingEvent (Timer/MoveEnd/Grounded/Collision)
    PhysicsEvent = 2,  // FHktPhysicsEvent (PhysicsSystem 충돌 쌍)
};

/** 이벤트 라이프사이클 단계 */
enum class EHktVMEventPhase : uint8
{
    Created = 0,    // 외부 주입 / 시뮬 시스템이 신규 생성
    Consumed = 1,   // VM 깨우기 / VMBuild 가 새 VM 생성 / Pending → Pending 변환 등
    Discarded = 2,  // 매칭 VM 없음 / 프로그램 미등록 등으로 사라짐
};

/** 단일 레코드 — VM 이벤트 하나의 시점 스냅샷 */
struct HKTCORE_API FHktVMEventRecord
{
    double Timestamp = 0.0;                  // FPlatformTime::Seconds()
    uint64 FrameNumber = 0;                  // GFrameCounter (UE)
    int64 SimFrameNumber = -1;               // WorldState.FrameNumber (결정론 프레임)
    uint8 Source = 0;                        // EHktLogSource (Server/Client)
    EHktVMEventKind Kind = EHktVMEventKind::Event;
    EHktVMEventPhase Phase = EHktVMEventPhase::Created;

    // ── FHktEvent 전용 ──
    FGameplayTag EventTag;          // FHktEvent.EventTag
    int32 EventId = 0;              // FHktEvent.EventId
    int64 PlayerUid = 0;            // FHktEvent.PlayerUid
    int32 Param0 = 0;
    int32 Param1 = 0;
    int32 Param2 = 0;
    int32 Param3 = 0;
    FVector Location = FVector::ZeroVector;

    // ── FHktPendingEvent 전용 ──
    uint8 PendingType = 0;          // EWaitEventType (Timer/Collision/MoveEnd/Grounded)
    FHktEntityId WatchedEntity = InvalidEntityId;
    FHktEntityId HitEntity = InvalidEntityId;  // Collision

    // ── 공통 엔티티 슬롯 ──
    FHktEntityId SourceEntity = InvalidEntityId;
    FHktEntityId TargetEntity = InvalidEntityId;

    // ── FHktPhysicsEvent 전용 ──
    FVector ContactPoint = FVector::ZeroVector;

    // ── 자유 형식 메모 (이벤트 출처/소비처/사유 등) ──
    FString Note;
};

/**
 * FHktVMEventRecorder — 싱글톤 링버퍼.
 *
 * - 패널이 열리면 SetActive(true), 닫히면 SetActive(false).
 * - bActive==false 면 Record() 는 즉시 반환 (lock-free 게이트).
 * - 녹화 모드(`BeginRecording`)는 현재 시점부터 다음 `EndRecording` 까지의 모든 레코드를
 *   별도 배열에 영구 보관해 패널이 시간 슬라이더로 재탐색하도록 지원.
 */
class HKTCORE_API FHktVMEventRecorder
{
public:
    static FHktVMEventRecorder& Get();

    // ── 게이트 제어 ──
    void SetActive(bool bNewActive);
    bool IsActive() const { return bActive; }

    // ── 기록 ──
    void Record(FHktVMEventRecord&& Record);

    // ── 소비 (패널이 호출). InOutReadIndex 이후의 신규 레코드만 반환. ──
    TArray<FHktVMEventRecord> Consume(uint32& InOutReadIndex) const;

    // ── 전체 버퍼 스냅샷 (모든 살아있는 레코드, 시간 오름차순) ──
    TArray<FHktVMEventRecord> Snapshot() const;

    // ── 버퍼 초기화 ──
    void Clear();

    // ── 변경 감지용 버전 ──
    uint32 GetVersion() const { return Version; }

    // ── 녹화 ──
    /** 별도 영구 버퍼에 신규 레코드를 적층 시작. 이미 녹화 중이면 no-op. */
    void BeginRecording();
    /** 녹화 종료. 누적된 레코드는 GetRecording() 으로 접근 가능. */
    void EndRecording();
    bool IsRecording() const { return bRecording; }
    /** 현재까지 누적된 녹화 데이터 사본 (복사 비용 큼 — 종료 후 사용 권장). */
    TArray<FHktVMEventRecord> GetRecording() const;
    /** 녹화 데이터를 JSON 직렬화하여 파일로 저장. 반환 = 절대 경로 (실패 시 ""). */
    FString SaveRecordingToFile(const FString& OptionalPath = TEXT("")) const;
    /** 파일로부터 녹화 데이터 로드 (재생 모드). 실패 시 false. */
    bool LoadRecordingFromFile(const FString& InPath);

    int32 GetRecordedCount() const;

private:
    FHktVMEventRecorder() = default;

    static constexpr int32 MaxEntries = 8192;

    TArray<FHktVMEventRecord> Entries;   // 링 버퍼 (지연 할당)
    uint32 WriteIndex = 0;               // monotonic
    uint32 Version = 0;
    bool bActive = false;

    // 녹화
    bool bRecording = false;
    TArray<FHktVMEventRecord> Recording;

    mutable FCriticalSection Lock;
};

// ============================================================================
// HKT_VM_EVENT_RECORD_* 매크로 — ENABLE_HKT_INSIGHTS 가드
// ============================================================================

#if ENABLE_HKT_INSIGHTS

/** FHktEvent 레코드 (Phase: Created/Consumed/Discarded) */
#define HKT_VM_EVENT_RECORD_EVENT(InEvent, InPhase, InSource, InSimFrame, InNote) \
    do { if (FHktVMEventRecorder::Get().IsActive()) { \
        FHktVMEventRecord _Rec; \
        _Rec.Timestamp = FPlatformTime::Seconds(); \
        _Rec.FrameNumber = GFrameCounter; \
        _Rec.SimFrameNumber = (InSimFrame); \
        _Rec.Source = static_cast<uint8>(InSource); \
        _Rec.Kind = EHktVMEventKind::Event; \
        _Rec.Phase = (InPhase); \
        _Rec.EventTag = (InEvent).EventTag; \
        _Rec.EventId = (InEvent).EventId; \
        _Rec.PlayerUid = (InEvent).PlayerUid; \
        _Rec.Param0 = (InEvent).Param0; \
        _Rec.Param1 = (InEvent).Param1; \
        _Rec.Param2 = (InEvent).Param2; \
        _Rec.Param3 = (InEvent).Param3; \
        _Rec.Location = (InEvent).Location; \
        _Rec.SourceEntity = (InEvent).SourceEntity; \
        _Rec.TargetEntity = (InEvent).TargetEntity; \
        _Rec.Note = (InNote); \
        FHktVMEventRecorder::Get().Record(MoveTemp(_Rec)); \
    } } while(0)

/** FHktPendingEvent 레코드 (Phase: Created/Consumed/Discarded) */
#define HKT_VM_EVENT_RECORD_PENDING(InPending, InPhase, InSource, InSimFrame, InNote) \
    do { if (FHktVMEventRecorder::Get().IsActive()) { \
        FHktVMEventRecord _Rec; \
        _Rec.Timestamp = FPlatformTime::Seconds(); \
        _Rec.FrameNumber = GFrameCounter; \
        _Rec.SimFrameNumber = (InSimFrame); \
        _Rec.Source = static_cast<uint8>(InSource); \
        _Rec.Kind = EHktVMEventKind::PendingEvent; \
        _Rec.Phase = (InPhase); \
        _Rec.PendingType = static_cast<uint8>((InPending).Type); \
        _Rec.WatchedEntity = (InPending).WatchedEntity; \
        _Rec.HitEntity = (InPending).HitEntity; \
        _Rec.Note = (InNote); \
        FHktVMEventRecorder::Get().Record(MoveTemp(_Rec)); \
    } } while(0)

/** FHktPhysicsEvent 레코드 (Phase: Created) */
#define HKT_VM_EVENT_RECORD_PHYSICS(InPhys, InSource, InSimFrame, InNote) \
    do { if (FHktVMEventRecorder::Get().IsActive()) { \
        FHktVMEventRecord _Rec; \
        _Rec.Timestamp = FPlatformTime::Seconds(); \
        _Rec.FrameNumber = GFrameCounter; \
        _Rec.SimFrameNumber = (InSimFrame); \
        _Rec.Source = static_cast<uint8>(InSource); \
        _Rec.Kind = EHktVMEventKind::PhysicsEvent; \
        _Rec.Phase = EHktVMEventPhase::Created; \
        _Rec.SourceEntity = (InPhys).EntityA; \
        _Rec.TargetEntity = (InPhys).EntityB; \
        _Rec.ContactPoint = (InPhys).ContactPoint; \
        _Rec.Note = (InNote); \
        FHktVMEventRecorder::Get().Record(MoveTemp(_Rec)); \
    } } while(0)

#else // !ENABLE_HKT_INSIGHTS

#define HKT_VM_EVENT_RECORD_EVENT(InEvent, InPhase, InSource, InSimFrame, InNote)   do {} while(0)
#define HKT_VM_EVENT_RECORD_PENDING(InPending, InPhase, InSource, InSimFrame, InNote) do {} while(0)
#define HKT_VM_EVENT_RECORD_PHYSICS(InPhys, InSource, InSimFrame, InNote)            do {} while(0)

#endif // ENABLE_HKT_INSIGHTS

// ============================================================================
// 헬퍼: enum → 표시 문자열
// ============================================================================

inline const TCHAR* GetHktVMEventKindName(EHktVMEventKind Kind)
{
    switch (Kind)
    {
    case EHktVMEventKind::Event:        return TEXT("Event");
    case EHktVMEventKind::PendingEvent: return TEXT("Pending");
    case EHktVMEventKind::PhysicsEvent: return TEXT("Physics");
    default:                            return TEXT("???");
    }
}

inline const TCHAR* GetHktVMEventPhaseName(EHktVMEventPhase Phase)
{
    switch (Phase)
    {
    case EHktVMEventPhase::Created:   return TEXT("CREATE");
    case EHktVMEventPhase::Consumed:  return TEXT("CONSUME");
    case EHktVMEventPhase::Discarded: return TEXT("DISCARD");
    default:                          return TEXT("???");
    }
}

/** EWaitEventType (HktVMTypes.h) 이름 — 헤더 포함 회피용 정수 변환. */
inline const TCHAR* GetHktPendingTypeName(uint8 PendingType)
{
    switch (PendingType)
    {
    case 0: return TEXT("None");
    case 1: return TEXT("Timer");
    case 2: return TEXT("Collision");
    case 3: return TEXT("MoveEnd");
    case 4: return TEXT("Grounded");
    default: return TEXT("?");
    }
}
