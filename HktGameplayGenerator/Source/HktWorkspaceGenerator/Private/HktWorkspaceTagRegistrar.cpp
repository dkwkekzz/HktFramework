// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktWorkspaceTagRegistrar.h"
#include "HktWorkspaceLog.h"
#include "HktWorkspaceSettings.h"

#include "GameplayTagsManager.h"
#include "Misc/Paths.h"
#include "Misc/FileHelper.h"
#include "Misc/ConfigCacheIni.h"
#include "HAL/FileManager.h"

FString FHktWorkspaceTagRegistrar::GetWorkspaceTagsIniPath()
{
	return FPaths::ProjectConfigDir() / TEXT("Tags") / TEXT("HktWorkspaceTags.ini");
}

bool FHktWorkspaceTagRegistrar::AppendTagToWorkspaceIni(const FString& TagString, const FString& DevComment)
{
	if (TagString.IsEmpty()) return false;

	const FString IniPath = GetWorkspaceTagsIniPath();
	const FString IniDir  = FPaths::GetPath(IniPath);
	IFileManager::Get().MakeDirectory(*IniDir, /*Tree*/true);

	const FString Section = TEXT("/Script/GameplayTags.GameplayTagsList");
	const FString NewEntry = FString::Printf(
		TEXT("(Tag=\"%s\",DevComment=\"%s\")"),
		*TagString, *DevComment);

	// 기존 GameplayTagList 값 읽기 — 중복 회피.
	TArray<FString> Existing;
	GConfig->GetArray(*Section, TEXT("GameplayTagList"), Existing, IniPath);
	const FString ExistingMatch = FString::Printf(TEXT("Tag=\"%s\""), *TagString);
	for (const FString& E : Existing)
	{
		if (E.Contains(ExistingMatch))
		{
			return true; // 이미 있음.
		}
	}

	Existing.Add(NewEntry);
	GConfig->SetArray(*Section, TEXT("GameplayTagList"), Existing, IniPath);
	GConfig->Flush(/*Read*/false, IniPath);

	// GameplayTagsManager 가 이 ini 를 다시 읽도록 ini search path 추가 → 차후
	// 에디터 재시작 시에도 자동 로드 보장.
	UGameplayTagsManager::Get().AddTagIniSearchPath(IniDir);

	UE_LOG(LogHktWorkspace, Log, TEXT("[TagRegistrar] ini 등록: %s → %s"), *TagString, *IniPath);
	return true;
}

FGameplayTag FHktWorkspaceTagRegistrar::EnsureTag(const FString& TagString, FString* OutNote)
{
	if (TagString.IsEmpty())
	{
		if (OutNote) *OutNote = TEXT("empty");
		return FGameplayTag();
	}

	UGameplayTagsManager& TagsMgr = UGameplayTagsManager::Get();
	FGameplayTag Existing = TagsMgr.RequestGameplayTag(FName(*TagString), /*ErrorIfNotFound*/false);
	if (Existing.IsValid())
	{
		if (OutNote) *OutNote = TEXT("preregistered");
		return Existing;
	}

	// 1) 즉시 사용 가능하도록 native 등록.
	TagsMgr.AddNativeGameplayTag(FName(*TagString));

	// 2) 영속 ini 등록 (설정 켜져 있을 때만).
	const UHktWorkspaceSettings* Settings = GetDefault<UHktWorkspaceSettings>();
	const bool bIni = (!Settings || Settings->bAutoRegisterMissingTagsToIni);
	bool bIniOk = false;
	if (bIni)
	{
		bIniOk = AppendTagToWorkspaceIni(TagString, TEXT("HktWorkspace auto-registered"));
	}

	FGameplayTag Resolved = TagsMgr.RequestGameplayTag(FName(*TagString), /*ErrorIfNotFound*/false);
	if (OutNote)
	{
		*OutNote = bIniOk ? TEXT("registered_native_and_ini")
			: (bIni ? TEXT("registered_native_only(ini_failed)") : TEXT("registered_native_only"));
	}
	return Resolved;
}

int32 FHktWorkspaceTagRegistrar::EnsureTags(const TArray<FString>& TagStrings)
{
	int32 Count = 0;
	for (const FString& T : TagStrings)
	{
		if (EnsureTag(T).IsValid())
		{
			++Count;
		}
	}
	return Count;
}
