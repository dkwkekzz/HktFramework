// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktStoryJsonLoader.h"
#include "HktStoryJsonParser.h"
#include "HktCoreEventLog.h"
#include "HAL/FileManager.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"

DEFINE_LOG_CATEGORY_STATIC(LogHktStoryJsonLoader, Log, All);

int32 FHktStoryJsonLoader::LoadAllFromContentDirectory()
{
	const FString StoriesDir = FPaths::Combine(FPaths::ProjectContentDir(), TEXT("Stories"));
	return LoadAllFromDirectory(StoriesDir);
}

int32 FHktStoryJsonLoader::LoadAllFromDirectory(const FString& DirectoryPath)
{
	if (!IFileManager::Get().DirectoryExists(*DirectoryPath))
	{
		UE_LOG(LogHktStoryJsonLoader, Log, TEXT("Stories directory not found: %s (skipping JSON story loading)"), *DirectoryPath);
		return 0;
	}

	TArray<FString> JsonFiles;
	IFileManager::Get().FindFiles(JsonFiles, *FPaths::Combine(DirectoryPath, TEXT("*.json")), true, false);

	int32 SuccessCount = 0;
	int32 TotalCount = JsonFiles.Num();

	for (const FString& FileName : JsonFiles)
	{
		const FString FilePath = FPaths::Combine(DirectoryPath, FileName);
		FHktStoryParseResult Result = LoadFromFile(FilePath);

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

	return FHktStoryJsonParser::Get().ParseAndBuild(JsonStr);
}

FHktStoryParseResult FHktStoryJsonLoader::LoadFromString(const FString& JsonStr)
{
	return FHktStoryJsonParser::Get().ParseAndBuild(JsonStr);
}
