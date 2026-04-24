// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktStoryJsonLoader.h"
#include "HktStoryJsonParser.h"
#include "HktCoreEventLog.h"
#include "GameplayTagsManager.h"
#include "HAL/FileManager.h"
#include "Interfaces/IPluginManager.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Settings/HktRuntimeGlobalSetting.h"

DEFINE_LOG_CATEGORY_STATIC(LogHktStoryJsonLoader, Log, All);

namespace
{
	// JSON에서 참조된 Tag를 자동으로 UGameplayTagsManager에 등록한 뒤
	// 유효한 FGameplayTag를 반환한다. 네이티브 C++ 하드코드 없이 JSON/에셋이
	// 단독 Source of Truth가 되도록 한다.
	FGameplayTag AutoRegisterResolveTag(const FString& TagStr)
	{
		if (TagStr.IsEmpty())
		{
			return FGameplayTag();
		}
		const FName TagName(*TagStr);
		FGameplayTag Tag = FGameplayTag::RequestGameplayTag(TagName, /*ErrorIfNotFound=*/false);
		if (!Tag.IsValid())
		{
			UGameplayTagsManager::Get().AddNativeGameplayTag(TagName, TEXT("Auto-registered from Content/Stories/*.json"));
			Tag = FGameplayTag::RequestGameplayTag(TagName, /*ErrorIfNotFound=*/false);
		}
		return Tag;
	}
}

int32 FHktStoryJsonLoader::LoadAllFromContentDirectory()
{
	TArray<FString> ScanDirs;

	// 1) HktGameplay 플러그인 자체 Content 디렉토리 (기본 내장 JSON Story 번들)
	//    사용자가 Settings를 비워두어도 플러그인 번들 Story는 항상 로드된다.
	if (TSharedPtr<IPlugin> Plugin = IPluginManager::Get().FindPlugin(TEXT("HktGameplay")))
	{
		ScanDirs.Add(Plugin->GetContentDir());
	}

	// 2) 프로젝트 측에서 Project Settings로 추가한 커스텀 디렉토리
	if (const UHktRuntimeGlobalSetting* Settings = GetDefault<UHktRuntimeGlobalSetting>())
	{
		for (const FDirectoryPath& DirPath : Settings->StoryDirectories)
		{
			if (DirPath.Path.IsEmpty())
			{
				continue;
			}
			// RelativeToGameContentDir: Path는 `<Project>/Content/` 기준 상대 경로
			ScanDirs.Add(FPaths::Combine(FPaths::ProjectContentDir(), DirPath.Path));
		}
	}

	if (ScanDirs.Num() == 0)
	{
		UE_LOG(LogHktStoryJsonLoader, Log, TEXT("No Story directories to scan; skipping JSON story loading"));
		return 0;
	}

	int32 TotalSuccess = 0;
	for (const FString& Dir : ScanDirs)
	{
		TotalSuccess += LoadAllFromDirectory(Dir);
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

	return FHktStoryJsonParser::Get().ParseAndBuild(JsonStr, [](const FString& TagStr) { return AutoRegisterResolveTag(TagStr); });
}

FHktStoryParseResult FHktStoryJsonLoader::LoadFromString(const FString& JsonStr)
{
	return FHktStoryJsonParser::Get().ParseAndBuild(JsonStr, [](const FString& TagStr) { return AutoRegisterResolveTag(TagStr); });
}
