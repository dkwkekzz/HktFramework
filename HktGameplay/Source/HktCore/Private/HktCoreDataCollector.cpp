// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktCoreDataCollector.h"
#include "HAL/IConsoleManager.h"

namespace
{
	// 글로벌 인사이트 수집 게이트. 0 이면 모든 HKT_INSIGHT_COLLECT/CLEAR_CATEGORY 무비용 우회.
	// 프로파일링 시 콘솔에서 `hkt.Insights.Enabled 0` 입력.
	int32 GHktInsightsEnabled = 1;
	FAutoConsoleVariableRef CVarHktInsightsEnabled(
		TEXT("hkt.Insights.Enabled"),
		GHktInsightsEnabled,
		TEXT("Master switch for HktInsights data collection (HKT_INSIGHT_COLLECT). 1=on (default), 0=off. ")
		TEXT("프로파일링 중 STAT_HktCore_InsightsPublish 등 수집 비용을 죽이려면 0."),
		ECVF_Cheat);
}

bool FHktCoreDataCollector::IsGloballyEnabled()
{
	return GHktInsightsEnabled != 0;
}

FHktCoreDataCollector& FHktCoreDataCollector::Get()
{
	static FHktCoreDataCollector Instance;
	return Instance;
}

void FHktCoreDataCollector::SetValue(const FString& Category, const FString& Key, const FString& Value)
{
	FScopeLock ScopeLock(&Lock);
	Data.FindOrAdd(Category).SetValue(Key, Value);
	++Version;
}

TArray<TPair<FString, FString>> FHktCoreDataCollector::GetEntries(const FString& Category) const
{
	FScopeLock ScopeLock(&Lock);
	if (const FCategoryData* Cat = Data.Find(Category))
	{
		return Cat->Rows;
	}
	return {};
}

TArray<FString> FHktCoreDataCollector::GetCategories() const
{
	FScopeLock ScopeLock(&Lock);
	TArray<FString> Result;
	Data.GetKeys(Result);
	return Result;
}

void FHktCoreDataCollector::ClearCategory(const FString& Category)
{
	FScopeLock ScopeLock(&Lock);
	Data.Remove(Category);
	++Version;
}

void FHktCoreDataCollector::Clear()
{
	FScopeLock ScopeLock(&Lock);
	Data.Empty();
	++Version;
}

void FHktCoreDataCollector::EnableCollection(const FString& Category)
{
	FScopeLock ScopeLock(&Lock);
	EnabledCollections.Add(Category);
}

void FHktCoreDataCollector::DisableCollection(const FString& Category)
{
	FScopeLock ScopeLock(&Lock);
	EnabledCollections.Remove(Category);
	Data.Remove(Category);
	++Version;
}

bool FHktCoreDataCollector::IsCollectionEnabled(const FString& Category) const
{
	FScopeLock ScopeLock(&Lock);
	return EnabledCollections.Contains(Category);
}
