// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktCoreEventLog.h"
#include "HAL/PlatformFileManager.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"

// ============================================================================
// 로그 카테고리 GameplayTag 정의
// ============================================================================

namespace HktLogTags
{
	UE_DEFINE_GAMEPLAY_TAG(Core,            "HktLog.Core");
	UE_DEFINE_GAMEPLAY_TAG(Core_Entity,     "HktLog.Core.Entity");
	UE_DEFINE_GAMEPLAY_TAG(Core_VM,         "HktLog.Core.VM");
	UE_DEFINE_GAMEPLAY_TAG(Core_Story,      "HktLog.Core.Story");
	UE_DEFINE_GAMEPLAY_TAG(Runtime,         "HktLog.Runtime");
	UE_DEFINE_GAMEPLAY_TAG(Runtime_Server,  "HktLog.Runtime.Server");
	UE_DEFINE_GAMEPLAY_TAG(Runtime_Client,  "HktLog.Runtime.Client");
	UE_DEFINE_GAMEPLAY_TAG(Runtime_Intent,  "HktLog.Runtime.Intent");
	UE_DEFINE_GAMEPLAY_TAG(Presentation,    "HktLog.Presentation");
	UE_DEFINE_GAMEPLAY_TAG(Asset,           "HktLog.Asset");
	UE_DEFINE_GAMEPLAY_TAG(Rule,            "HktLog.Rule");
	UE_DEFINE_GAMEPLAY_TAG(Story,           "HktLog.Story");
	UE_DEFINE_GAMEPLAY_TAG(UI,              "HktLog.UI");
	UE_DEFINE_GAMEPLAY_TAG(VFX,             "HktLog.VFX");
}

FHktCoreEventLog& FHktCoreEventLog::Get()
{
	static FHktCoreEventLog Instance;
	return Instance;
}

void FHktCoreEventLog::Log(const FGameplayTag& Category, const FString& Message,
                           FHktEntityId EntityId, FGameplayTag EventTag,
                           EHktLogLevel Level, EHktLogSource Source)
{
	if (!bActive)
	{
		return;
	}

	FScopeLock ScopeLock(&Lock);

	// 링 버퍼 초기화 (지연 할당)
	if (Entries.Num() == 0)
	{
		Entries.SetNum(MaxEntries);
	}

	const int32 Index = WriteIndex % MaxEntries;
	FHktLogEntry& Entry = Entries[Index];
	Entry.Timestamp = FPlatformTime::Seconds();
	Entry.FrameNumber = GFrameCounter;
	Entry.Category = Category;
	Entry.Message = Message;
	Entry.EntityId = EntityId;
	Entry.EventTag = EventTag;
	Entry.Level = Level;
	Entry.Source = Source;

	++WriteIndex;
	++Version;

	KnownCategories.AddTag(Category);
}

void FHktCoreEventLog::SetActive(bool bNewActive)
{
	FScopeLock ScopeLock(&Lock);
	bActive = bNewActive;
}

TArray<FHktLogEntry> FHktCoreEventLog::Consume(uint32& InOutReadIndex) const
{
	FScopeLock ScopeLock(&Lock);

	TArray<FHktLogEntry> Result;

	if (InOutReadIndex >= WriteIndex)
	{
		return Result;
	}

	// 읽기 시작점: WriteIndex가 MaxEntries를 넘어갔으면 오래된 데이터는 덮어쓰여짐
	uint32 StartIndex = InOutReadIndex;
	if (WriteIndex - StartIndex > (uint32)MaxEntries)
	{
		StartIndex = WriteIndex - MaxEntries;
	}

	const int32 Count = WriteIndex - StartIndex;
	Result.Reserve(Count);

	for (uint32 i = StartIndex; i < WriteIndex; ++i)
	{
		Result.Add(Entries[i % MaxEntries]);
	}

	InOutReadIndex = WriteIndex;
	return Result;
}

void FHktCoreEventLog::Clear()
{
	FScopeLock ScopeLock(&Lock);
	Entries.Reset();
	WriteIndex = 0;
	++Version;
}

FString FHktCoreEventLog::DumpToFile(const FString& OptionalPath) const
{
	FString Content;

	// Lock 범위를 문자열 빌드까지로 제한 — 파일 I/O는 Lock 밖에서 수행
	{
		FScopeLock ScopeLock(&Lock);

		if (Entries.Num() == 0 || WriteIndex == 0)
		{
			return FString();
		}

		// 가장 오래된 유효 엔트리부터 순서대로 출력
		uint32 StartIndex = 0;
		if (WriteIndex > (uint32)MaxEntries)
		{
			StartIndex = WriteIndex - MaxEntries;
		}

		const uint32 EntryCount = FMath::Min(WriteIndex, (uint32)MaxEntries);

		// 엔트리당 ~200자 추정으로 사전 할당
		Content.Reserve(EntryCount * 200);
		Content.Appendf(TEXT("=== HKT Event Log Dump ===\n"));
		Content.Appendf(TEXT("Entries: %u (buffer capacity: %d)\n\n"), EntryCount, MaxEntries);

		for (uint32 i = StartIndex; i < WriteIndex; ++i)
		{
			const FHktLogEntry& Entry = Entries[i % MaxEntries];
			// [Frame:000123] [Level] [Source] [Category] Message | Entity:ID | Tag:EventTag
			Content.Appendf(TEXT("[Frame:%06llu] [%s] [%s] [%s] %s"),
				Entry.FrameNumber,
				GetLogLevelName(Entry.Level),
				GetLogSourceName(Entry.Source),
				*Entry.Category.ToString(),
				*Entry.Message);

			if (Entry.EntityId != InvalidEntityId)
			{
				Content.Appendf(TEXT(" | Entity:%d"), Entry.EntityId);
			}
			if (Entry.EventTag.IsValid())
			{
				Content.Appendf(TEXT(" | Tag:%s"), *Entry.EventTag.ToString());
			}
			Content.AppendChar(TEXT('\n'));
		}
	}

	// 경로 결정
	FString FilePath = OptionalPath;
	if (FilePath.IsEmpty())
	{
		FilePath = FPaths::ProjectSavedDir() / TEXT("Logs") / TEXT("HktEventLog.log");
	}
	FilePath = FPaths::ConvertRelativePathToFull(FilePath);

	// 파일 쓰기 (Lock 밖)
	if (FFileHelper::SaveStringToFile(Content, *FilePath, FFileHelper::EEncodingOptions::ForceUTF8WithoutBOM))
	{
		UE_LOG(LogTemp, Log, TEXT("HktEventLog: Dumped to %s"), *FilePath);
		return FilePath;
	}

	UE_LOG(LogTemp, Warning, TEXT("HktEventLog: Failed to write to %s"), *FilePath);
	return FString();
}

FGameplayTagContainer FHktCoreEventLog::GetCategories() const
{
	FScopeLock ScopeLock(&Lock);
	return KnownCategories;
}

// ============================================================================
// 콘솔 커맨드
// ============================================================================

#if ENABLE_HKT_INSIGHTS

static FAutoConsoleCommand GHktEventLogStartCmd(
	TEXT("hkt.EventLog.Start"),
	TEXT("HKT 이벤트 로그 수집을 시작합니다. 패널 없이도 독립적으로 수집 가능."),
	FConsoleCommandDelegate::CreateLambda([]()
	{
		FHktCoreEventLog::Get().SetActive(true);
		UE_LOG(LogTemp, Log, TEXT("HktEventLog: Collection started."));
	})
);

static FAutoConsoleCommand GHktEventLogStopCmd(
	TEXT("hkt.EventLog.Stop"),
	TEXT("HKT 이벤트 로그 수집을 중지합니다."),
	FConsoleCommandDelegate::CreateLambda([]()
	{
		FHktCoreEventLog::Get().SetActive(false);
		UE_LOG(LogTemp, Log, TEXT("HktEventLog: Collection stopped."));
	})
);

static FAutoConsoleCommand GHktEventLogDumpCmd(
	TEXT("hkt.EventLog.Dump"),
	TEXT("현재 버퍼의 이벤트 로그를 파일로 출력합니다. Saved/Logs/HktEventLog.log"),
	FConsoleCommandDelegate::CreateLambda([]()
	{
		const FString Path = FHktCoreEventLog::Get().DumpToFile();
		if (!Path.IsEmpty())
		{
			UE_LOG(LogTemp, Log, TEXT("HktEventLog: Dump complete -> %s"), *Path);
		}
		else
		{
			UE_LOG(LogTemp, Warning, TEXT("HktEventLog: No entries to dump or write failed."));
		}
	})
);

static FAutoConsoleCommand GHktEventLogClearCmd(
	TEXT("hkt.EventLog.Clear"),
	TEXT("이벤트 로그 버퍼를 초기화합니다."),
	FConsoleCommandDelegate::CreateLambda([]()
	{
		FHktCoreEventLog::Get().Clear();
		UE_LOG(LogTemp, Log, TEXT("HktEventLog: Buffer cleared."));
	})
);

#endif // ENABLE_HKT_INSIGHTS
