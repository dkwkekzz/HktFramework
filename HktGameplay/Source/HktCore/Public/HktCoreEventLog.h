// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktCoreDefs.h"
#include "GameplayTagContainer.h"
#include "NativeGameplayTags.h"
#include "HAL/CriticalSection.h"


// ============================================================================
// 로그 레벨 및 소스 구분
//
// EHktLogLevel: 로그 심각도 구분 (Verbose < Info < Warning < Error)
// EHktLogSource: 클라/서버 분리 필터링용
// ============================================================================

enum class EHktLogLevel : uint8
{
	Verbose = 0,   // 상세 추적 (물리 업데이트, 매 프레임 속성 변경 등)
	Info    = 1,   // 일반 정보 (VM 생성/완료, 엔티티 스폰 등)
	Warning = 2,   // 주의 (풀 부족, 유효하지 않은 태그 등)
	Error   = 3,   // 오류 (VM 실패, 프로그램 미등록 등)
};

enum class EHktLogSource : uint8
{
	Server  = 0,   // 서버 전용 (GameMode, 서버 RPC, Core VM/WorldState/Simulation)
	Client  = 1,   // 클라이언트 전용 (PlayerController, Proxy, Presentation, UI)
};

/** LogLevel 이름 문자열 */
inline const TCHAR* GetLogLevelName(EHktLogLevel Level)
{
	switch (Level)
	{
	case EHktLogLevel::Verbose: return TEXT("VRB");
	case EHktLogLevel::Info:    return TEXT("INF");
	case EHktLogLevel::Warning: return TEXT("WRN");
	case EHktLogLevel::Error:   return TEXT("ERR");
	default:                    return TEXT("???");
	}
}

/** LogSource 이름 문자열 */
inline const TCHAR* GetLogSourceName(EHktLogSource Source)
{
	switch (Source)
	{
	case EHktLogSource::Server: return TEXT("Server");
	case EHktLogSource::Client: return TEXT("Client");
	default:                    return TEXT("???");
	}
}


// ============================================================================
// 로그 카테고리 GameplayTag 선언
//
// 태그 계층: HktLog.{Module}.{Level}
// MatchesTag()로 상위 태그 기준 필터링 가능.
// 예: HktLog.Core.VM.MatchesTag(HktLog.Core) == true
// ============================================================================

namespace HktLogTags
{
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Core);
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Core_Entity);
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Core_VM);
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Core_Story);
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Core_Movement);
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Core_Physics);
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Runtime);
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Runtime_Server);
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Runtime_Client);
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Runtime_Intent);
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Presentation);
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Asset);
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Rule);
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(Story);
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(UI);
	HKTCORE_API UE_DECLARE_GAMEPLAY_TAG_EXTERN(VFX);
}


// ============================================================================
// HKT_EVENT_LOG 매크로
//
// ENABLE_HKT_INSIGHTS 매크로 활용 (HktCore.Build.cs 에서 비-Shipping 빌드 시 정의).
// bActive 플래그를 먼저 확인하여 패널이 닫혀 있으면 즉시 반환 (성능 최적화).
// FString::Printf 호출도 bActive 체크 이후에만 실행되므로 메모리 할당 없음.
//
// HKT_EVENT_LOG(CategoryTag, Level, Source, Message)
// HKT_EVENT_LOG_ENTITY(CategoryTag, Level, Source, Message, EntityId)
// HKT_EVENT_LOG_TAG(CategoryTag, Level, Source, Message, EntityId, Tag)
// ============================================================================

#if ENABLE_HKT_INSIGHTS

#define HKT_EVENT_LOG(CategoryTag, Level, Source, Message) \
	do { if (FHktCoreEventLog::Get().ShouldLog(Level)) \
		FHktCoreEventLog::Get().Log(CategoryTag, Message, InvalidEntityId, FGameplayTag(), Level, Source); } while(0)

#define HKT_EVENT_LOG_ENTITY(CategoryTag, Level, Source, Message, EntityId) \
	do { if (FHktCoreEventLog::Get().ShouldLog(Level)) \
		FHktCoreEventLog::Get().Log(CategoryTag, Message, EntityId, FGameplayTag(), Level, Source); } while(0)

#define HKT_EVENT_LOG_TAG(CategoryTag, Level, Source, Message, EntityId, Tag) \
	do { if (FHktCoreEventLog::Get().ShouldLog(Level)) \
		FHktCoreEventLog::Get().Log(CategoryTag, Message, EntityId, Tag, Level, Source); } while(0)

#else

#define HKT_EVENT_LOG(CategoryTag, Level, Source, Message)                       do {} while(0)
#define HKT_EVENT_LOG_ENTITY(CategoryTag, Level, Source, Message, EntityId)      do {} while(0)
#define HKT_EVENT_LOG_TAG(CategoryTag, Level, Source, Message, EntityId, Tag)    do {} while(0)

#endif // ENABLE_HKT_INSIGHTS


// ============================================================================
// FHktLogEntry — 개별 로그 엔트리
// ============================================================================

struct HKTCORE_API FHktLogEntry
{
	double Timestamp = 0.0;         // FPlatformTime::Seconds()
	uint64 FrameNumber = 0;         // GFrameCounter
	FGameplayTag Category;          // HktLog.Core.VM, HktLog.Runtime.Server, etc.
	FString Message;                // 자유 형식 메시지
	FHktEntityId EntityId = InvalidEntityId;  // 관련 엔티티 (-1 if none)
	FGameplayTag EventTag;          // 관련 이벤트 태그 (optional)
	EHktLogLevel Level = EHktLogLevel::Info;    // 로그 심각도
	EHktLogSource Source = EHktLogSource::Server; // 클라/서버 구분
};


// ============================================================================
// FHktCoreEventLog
//
// 순수 C++ 싱글톤. 링 버퍼 기반 이벤트 로그 저장소.
// HktGameplay 내부에서 HKT_EVENT_LOG 매크로를 통해 이벤트를 기록하고,
// HktGameplayDeveloper의 패널이 Consume()으로 읽어 표시한다.
//
// - 패널 열림/닫힘에 따라 SetActive(true/false)로 수집 제어
// - IsActive() 체크 후 Log() 호출 (매크로가 자동 처리)
// - 링 버퍼로 메모리 상한 고정 (MaxEntries = 8192)
// - Thread-Safe: FCriticalSection 보호
// - Category는 FGameplayTag: MatchesTag()로 계층적 필터링 지원
// ============================================================================

class HKTCORE_API FHktCoreEventLog
{
public:
	static FHktCoreEventLog& Get();

	/** 로그 추가. bActive==false면 즉시 반환. */
	void Log(const FGameplayTag& Category, const FString& Message,
	         FHktEntityId EntityId = InvalidEntityId,
	         FGameplayTag EventTag = FGameplayTag(),
	         EHktLogLevel Level = EHktLogLevel::Info,
	         EHktLogSource Source = EHktLogSource::Server);

	/** 패널에서 호출: 수집 활성화/비활성화 */
	void SetActive(bool bNewActive);

	/** 수집 활성 여부 (lock-free) */
	bool IsActive() const { return bActive; }

	/** 최소 수집 레벨 설정. 이 레벨 미만의 로그는 수집하지 않음 (FString 할당도 회피). */
	void SetMinLogLevel(EHktLogLevel NewLevel);
	EHktLogLevel GetMinLogLevel() const { return MinLogLevel; }

	/** 매크로에서 사용: bActive && Level >= MinLogLevel (lock-free, 인라인) */
	bool ShouldLog(EHktLogLevel Level) const { return bActive && Level >= MinLogLevel; }

	/**
	 * 패널에서 호출: InOutReadIndex 이후의 새 엔트리 반환.
	 * InOutReadIndex는 현재 WriteIndex로 갱신됨.
	 */
	TArray<FHktLogEntry> Consume(uint32& InOutReadIndex) const;

	/** 전체 로그 초기화 */
	void Clear();

	/**
	 * 현재 버퍼의 로그를 파일로 출력.
	 * 기본 경로: {ProjectDir}/Saved/Logs/HktEventLog.log
	 * @return 출력된 파일의 절대 경로. 실패 시 빈 문자열.
	 */
	FString DumpToFile(const FString& OptionalPath = TEXT("")) const;

	/** 변경 감지용 버전 카운터 */
	uint32 GetVersion() const { return Version; }

	/** 등록된 모든 카테고리 태그 반환 */
	FGameplayTagContainer GetCategories() const;

private:
	FHktCoreEventLog() = default;

	static constexpr int32 MaxEntries = 8192;

	TArray<FHktLogEntry> Entries;   // 링 버퍼 (MaxEntries로 고정 크기)
	uint32 WriteIndex = 0;          // 다음 쓰기 위치 (monotonic, % MaxEntries로 인덱싱)
	uint32 Version = 0;
	bool bActive = false;
	EHktLogLevel MinLogLevel = EHktLogLevel::Info;  // 기본: Verbose 수집 안 함

	FGameplayTagContainer KnownCategories;  // 지금까지 기록된 카테고리 태그

	mutable FCriticalSection Lock;
};
