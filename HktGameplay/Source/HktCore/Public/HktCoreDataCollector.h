// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HAL/CriticalSection.h"

/**
 * ENABLE_HKT_INSIGHTS 매크로:
 * HktCore.Build.cs 에서 비-Shipping 빌드 시 정의됨.
 * Shipping 빌드에서는 0으로 정의되어 모든 수집 코드가 제거됨.
 */

#if ENABLE_HKT_INSIGHTS

/**
 * HKT_INSIGHT_COLLECT - 인사이트 데이터 주입 매크로
 *
 * 런타임 게이트: CVar `hkt.Insights.Enabled` (기본 1).
 * 프로파일링 중 비용을 죽이고 싶으면 콘솔에서 `hkt.Insights.Enabled 0` 입력.
 * 게이트 OFF 시 락 진입/문자열 SetValue 모두 우회되어 매크로 자체가 거의 무비용.
 * 단, 매크로 호출 전 Printf 등으로 Value 문자열을 미리 만든 호출자는 비용이 남음 →
 * 무거운 publish 블록은 호출자에서 `FHktCoreDataCollector::IsGloballyEnabled()` 로 조기 종료할 것.
 *
 * @param Category  카테고리 문자열 (예: "VM", "WorldState", "Runtime.Server")
 * @param Key       키 문자열 (행 식별자)
 * @param Value     값 FString
 */
#define HKT_INSIGHT_COLLECT(Category, Key, Value) \
	do { if (FHktCoreDataCollector::IsGloballyEnabled()) { FHktCoreDataCollector::Get().SetValue(Category, Key, Value); } } while(0)

/**
 * HKT_INSIGHT_CLEAR_CATEGORY - 카테고리 전체 데이터 초기화
 */
#define HKT_INSIGHT_CLEAR_CATEGORY(Category) \
	do { if (FHktCoreDataCollector::IsGloballyEnabled()) { FHktCoreDataCollector::Get().ClearCategory(Category); } } while(0)

#else

#define HKT_INSIGHT_COLLECT(Category, Key, Value)    do {} while(0)
#define HKT_INSIGHT_CLEAR_CATEGORY(Category)         do {} while(0)

#endif // ENABLE_HKT_INSIGHTS


/**
 * FHktCoreDataCollector
 *
 * 순수 C++ 싱글톤. Category → Key → Value 구조의 단순한 데이터 저장소.
 * HktGameplay 내부에서 HKT_INSIGHT_COLLECT 매크로를 통해 데이터를 주입하고,
 * HktGameplayDeveloper의 UHktInsightsWorldSubsystem이 이를 읽어 패널에 표시한다.
 *
 * - SetValue(): 키가 이미 있으면 덮어쓰기, 없으면 추가 (삽입 순서 유지)
 * - Version: 어떤 변경이든 버전 카운터 증가 → 패널이 변경 감지에 사용
 * - Thread-Safe: FCriticalSection으로 보호
 */
class HKTCORE_API FHktCoreDataCollector
{
public:
	static FHktCoreDataCollector& Get();

	/** 카테고리 내 Key-Value 설정 (덮어쓰기 or 추가) */
	void SetValue(const FString& Category, const FString& Key, const FString& Value);

	/** 카테고리의 모든 행 반환 (삽입 순서) */
	TArray<TPair<FString, FString>> GetEntries(const FString& Category) const;

	/** 등록된 모든 카테고리 목록 */
	TArray<FString> GetCategories() const;

	/** 특정 카테고리 데이터 제거 */
	void ClearCategory(const FString& Category);

	/** 모든 데이터 제거 */
	void Clear();

	/** 변경 감지용 버전 카운터 (변경 시 증가) */
	uint32 GetVersion() const { return Version; }

	/**
	 * 글로벌 수집 게이트.
	 * CVar `hkt.Insights.Enabled` 와 바인딩되어 런타임에 토글 가능 (기본 ON).
	 * 프로파일링 중 비용을 죽이고 싶을 때 OFF 로 두면 매크로 및 호출자 조기종료가 작동.
	 * inline 가벼운 함수 — 핫패스에서 호출 OK.
	 */
	static bool IsGloballyEnabled();

	/**
	 * On-demand 수집 플래그.
	 * 비용이 큰 카테고리(예: VMDetail)는 소비자가 활성화했을 때만 수집.
	 * 패널 열림/닫힘 시 EnableCollection/DisableCollection 호출.
	 */
	void EnableCollection(const FString& Category);
	void DisableCollection(const FString& Category);
	bool IsCollectionEnabled(const FString& Category) const;

private:
	FHktCoreDataCollector() = default;

	/**
	 * 카테고리별 데이터 저장소.
	 * TArray<TPair> 를 사용하여 삽입 순서를 유지하면서도 Key 기반 덮어쓰기를 지원.
	 * 각 카테고리에 KeyIndex(TMap)를 두어 Key→배열인덱스 빠른 조회.
	 */
	struct FCategoryData
	{
		TArray<TPair<FString, FString>> Rows;
		TMap<FString, int32> KeyIndex;  // Key → Rows 배열 인덱스

		void SetValue(const FString& Key, const FString& Value)
		{
			if (int32* Idx = KeyIndex.Find(Key))
			{
				Rows[*Idx].Value = Value;
			}
			else
			{
				KeyIndex.Add(Key, Rows.Num());
				Rows.Emplace(Key, Value);
			}
		}
	};

	TMap<FString, FCategoryData> Data;
	TSet<FString> EnabledCollections;
	uint32 Version = 0;
	mutable FCriticalSection Lock;
};
