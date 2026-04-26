// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktStoryJsonLoader.h"
#include "HktStoryJsonParser.h"
#include "HktCoreEventLog.h"
#include "HAL/FileManager.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Settings/HktRuntimeGlobalSetting.h"

DEFINE_LOG_CATEGORY_STATIC(LogHktStoryJsonLoader, Log, All);

namespace
{
	// JSON에서 참조된 Tag를 lookup만 수행한다. AddNativeGameplayTag는 DoneAddingNativeTags
	// 이후 호출 시 ensure에 걸리므로, 신규 태그는 UHktStoryEditorLibrary 에디터 함수가
	// Config/Tags/HktStoryTags.ini에 사전 등록한 뒤 엔진 부팅 시 로드되어야 한다.
	FGameplayTag ResolveTagOrWarn(const FString& TagStr)
	{
		if (TagStr.IsEmpty())
		{
			return FGameplayTag();
		}
		FGameplayTag Tag = FGameplayTag::RequestGameplayTag(FName(*TagStr), /*ErrorIfNotFound=*/false);
		if (!Tag.IsValid())
		{
			UE_LOG(LogHktStoryJsonLoader, Warning,
				TEXT("Unknown GameplayTag '%s' — run UHktStoryEditorLibrary::RegenerateStoryTagsAndReload to register"),
				*TagStr);
		}
		return Tag;
	}
}

int32 FHktStoryJsonLoader::LoadAllFromContentDirectory()
{
	const UHktRuntimeGlobalSetting* Settings = GetDefault<UHktRuntimeGlobalSetting>();
	if (!Settings || Settings->StoryDirectories.Num() == 0)
	{
		UE_LOG(LogHktStoryJsonLoader, Log, TEXT("No Story directories configured in HktRuntimeGlobalSetting; skipping JSON story loading"));
		return 0;
	}

	int32 TotalSuccess = 0;
	for (const FDirectoryPath& DirPath : Settings->StoryDirectories)
	{
		if (DirPath.Path.IsEmpty())
		{
			continue;
		}
		// 설정값은 절대 경로(SpriteGeneratorSettings 패턴). 추가 결합 없이 그대로 사용.
		TotalSuccess += LoadAllFromDirectory(DirPath.Path);
	}
	return TotalSuccess;
}

int32 FHktStoryJsonLoader::LoadAllFromDirectory(const FString& DirectoryPath)
{
	if (!IFileManager::Get().DirectoryExists(*DirectoryPath))
	{
		UE_LOG(LogHktStoryJsonLoader, Log, TEXT("Stories directory not found: %s (skipping JSON story loading)"), *DirectoryPath);
		return 0;
	}

	// 재귀 스캔 — `Stories/` 등 서브 디렉토리의 JSON도 모두 수집
	TArray<FString> JsonFiles;
	IFileManager::Get().FindFilesRecursive(JsonFiles, *DirectoryPath, TEXT("*.json"), /*Files=*/true, /*Directories=*/false);

	int32 SuccessCount = 0;
	int32 TotalCount = JsonFiles.Num();

	for (const FString& FilePath : JsonFiles)
	{
		FHktStoryParseResult Result = LoadFromFile(FilePath);
		const FString FileName = FPaths::GetCleanFilename(FilePath);

		if (Result.bSuccess)
		{
			++SuccessCount;
			UE_LOG(LogHktStoryJsonLoader, Log, TEXT("Loaded JSON story: %s (%s)"), *Result.StoryTag, *FileName);
		}
		else
		{
			UE_LOG(LogHktStoryJsonLoader, Error, TEXT("Failed to load JSON story: %s"), *FileName);
			for (const FString& Error : Result.Errors)
			{
				UE_LOG(LogHktStoryJsonLoader, Error, TEXT("  %s"), *Error);
			}
		}

		for (const FString& Warning : Result.Warnings)
		{
			UE_LOG(LogHktStoryJsonLoader, Warning, TEXT("  %s (%s)"), *Warning, *FileName);
		}
	}

	UE_LOG(LogHktStoryJsonLoader, Log, TEXT("JSON story loading complete: %d/%d succeeded"), SuccessCount, TotalCount);
	HKT_EVENT_LOG(HktLogTags::Story, EHktLogLevel::Info, EHktLogSource::Server,
		FString::Printf(TEXT("JSON stories loaded: %d/%d"), SuccessCount, TotalCount));

	return SuccessCount;
}

FHktStoryParseResult FHktStoryJsonLoader::LoadFromFile(const FString& FilePath)
{
	FString JsonStr;
	if (!FFileHelper::LoadFileToString(JsonStr, *FilePath))
	{
		FHktStoryParseResult Result;
		Result.Errors.Add(FString::Printf(TEXT("Failed to read file: %s"), *FilePath));
		return Result;
	}

	return FHktStoryJsonParser::Get().ParseAndBuild(JsonStr, [](const FString& TagStr) { return ResolveTagOrWarn(TagStr); });
}

FHktStoryParseResult FHktStoryJsonLoader::LoadFromString(const FString& JsonStr)
{
	return FHktStoryJsonParser::Get().ParseAndBuild(JsonStr, [](const FString& TagStr) { return ResolveTagOrWarn(TagStr); });
}
