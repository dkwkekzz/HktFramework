// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktWorkspaceTagRegistrar.h"
#include "HktWorkspaceLog.h"
#include "HktWorkspaceSettings.h"

#include "GameplayTagsManager.h"
#include "Misc/Paths.h"
#include "Misc/FileHelper.h"
#include "Misc/ConfigCacheIni.h"
#include "HAL/FileManager.h"
#if WITH_EDITOR
#include "GameplayTagsEditorModule.h"
#include "Modules/ModuleManager.h"
#endif

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

	const FString Section  = TEXT("/Script/GameplayTags.GameplayTagsList");
	const FString NewEntry = FString::Printf(
		TEXT("(Tag=\"%s\",DevComment=\"%s\")"),
		*TagString, *DevComment);
	const FString ExistingMatch = FString::Printf(TEXT("Tag=\"%s\""), *TagString);

	// 기존 항목 수집 — 디스크 파일을 직접 파싱한다(GConfig 는 미로드 ini 에 대해
	// SetArray + Flush 가 파일을 실제로 생성하지 않는 경우가 있어 신뢰하지 않음).
	TArray<FString> ExistingEntries;
	bool bAlreadyHas = false;
	if (FPaths::FileExists(IniPath))
	{
		TArray<FString> Lines;
		if (FFileHelper::LoadFileToStringArray(Lines, *IniPath))
		{
			bool bInSection = false;
			for (const FString& RawLine : Lines)
			{
				FString Line = RawLine;
				Line.TrimStartAndEndInline();
				if (Line.IsEmpty() || Line.StartsWith(TEXT(";"))) continue;

				if (Line.StartsWith(TEXT("[")) && Line.EndsWith(TEXT("]")))
				{
					const FString SectionName = Line.Mid(1, Line.Len() - 2);
					bInSection = SectionName.Equals(Section);
					continue;
				}

				if (!bInSection) continue;
				if (!Line.StartsWith(TEXT("+GameplayTagList="))) continue;

				const FString EntryBody = Line.RightChop(FString(TEXT("+GameplayTagList=")).Len());
				if (EntryBody.Contains(ExistingMatch))
				{
					bAlreadyHas = true;
				}
				ExistingEntries.Add(EntryBody);
			}
		}
	}

	if (bAlreadyHas)
	{
		// 이미 디스크에 있음 — GameplayTagsManager 가 이 ini 디렉터리를 인식하도록 search path 만 보장.
		UGameplayTagsManager::Get().AddTagIniSearchPath(IniDir);
		return true;
	}

	ExistingEntries.Add(NewEntry);

	// 직접 파일 작성 — GConfig 우회로 항상 영속화 보장.
	FString Buffer;
	Buffer += FString::Printf(TEXT("[%s]") LINE_TERMINATOR, *Section);
	for (const FString& E : ExistingEntries)
	{
		Buffer += FString::Printf(TEXT("+GameplayTagList=%s") LINE_TERMINATOR, *E);
	}

	if (!FFileHelper::SaveStringToFile(Buffer, *IniPath, FFileHelper::EEncodingOptions::ForceUTF8WithoutBOM))
	{
		UE_LOG(LogHktWorkspace, Warning, TEXT("[TagRegistrar] ini 쓰기 실패: %s"), *IniPath);
		return false;
	}

	// GConfig 캐시 무효화 → 다음 GetArray/Load 가 디스크 파일을 다시 읽도록.
	GConfig->LoadFile(IniPath);

	// GameplayTagsManager 가 이 ini 를 다시 읽도록 ini search path 추가 → 차후
	// 에디터 재시작 시에도 자동 로드 보장 + 이번 세션에도 즉시 등록.
	UGameplayTagsManager& TagsMgr = UGameplayTagsManager::Get();
	TagsMgr.AddTagIniSearchPath(IniDir);
#if WITH_EDITOR
	// 이미 native tag 등록 단계가 끝난 상태(런타임/에디터 정상 동작 중)에서
	// AddNativeGameplayTag 는 ensure 트립을 일으킨다 — 그 대신 ini 기반
	// tag tree 를 강제 리로드해 새 항목이 즉시 RequestGameplayTag 로 인식되게 한다.
	TagsMgr.EditorRefreshGameplayTagTree();
#endif

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
	const FGameplayTag Existing = TagsMgr.RequestGameplayTag(FName(*TagString), /*ErrorIfNotFound*/false);

	const UHktWorkspaceSettings* Settings = GetDefault<UHktWorkspaceSettings>();
	const bool bIni = (!Settings || Settings->bAutoRegisterMissingTagsToIni);

	if (Existing.IsValid())
	{
		// 이미 등록됨. 영속화는 native 등록 케이스(엔진 시작 시 모듈 native tag) 면 굳이
		// ini 에 또 누적할 필요 없음 — 다음 세션에도 동일 native 가 다시 등록되므로.
		// 단 ini 기반 등록이 아닌 다른 native 경로로 들어온 경우만 안전하게 ini 보강.
		if (OutNote) *OutNote = TEXT("preregistered");
		return Existing;
	}

#if WITH_EDITOR
	if (bIni)
	{
		// IGameplayTagsEditorModule::AddNewGameplayTagToINI — editor 전용 공식 API.
		// 내부에서:
		//   1) UGameplayTagsSettings/UGameplayTagsDeveloperSettings 의 GameplayTagList 갱신
		//   2) 지정 TagSource ini 파일 저장(없으면 자동 생성)
		//   3) EditorRefreshGameplayTagTree() 호출 → 즉시 RequestGameplayTag 로 인식
		// TagSourceName: "HktWorkspaceTags.ini" — Config/Tags/ 하위에 누적.
		if (IGameplayTagsEditorModule::IsAvailable())
		{
			IGameplayTagsEditorModule::Get().AddNewGameplayTagToINI(
				TagString,
				TEXT("HktWorkspace auto-registered"),
				FName(TEXT("HktWorkspaceTags.ini")));
		}
	}
#endif

	const FGameplayTag Resolved = TagsMgr.RequestGameplayTag(FName(*TagString), /*ErrorIfNotFound*/false);
	if (OutNote)
	{
		*OutNote = bIni
			? (Resolved.IsValid() ? TEXT("registered_ini") : TEXT("registered_ini(not_visible)"))
			: TEXT("disabled");
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
