// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"

// ============================================================================
// FHktWorkspaceTagRegistrar
//
// 워크스페이스 폴더명에서 발견된 GameplayTag 가 시스템에 미등록이면, native 등록
// 및(설정에 따라) Config/Tags/HktWorkspaceTags.ini 영속 기록을 수행한다.
// ============================================================================
class HKTWORKSPACEGENERATOR_API FHktWorkspaceTagRegistrar
{
public:
	/**
	 * 단일 태그 등록. 이미 등록되어 있으면 그대로 반환. 영속 등록 여부는
	 * UHktWorkspaceSettings::bAutoRegisterMissingTagsToIni 설정에 따른다.
	 */
	static FGameplayTag EnsureTag(const FString& TagString, FString* OutNote = nullptr);

	/** 다수 태그 일괄 등록. 반환은 등록된 태그 개수. */
	static int32 EnsureTags(const TArray<FString>& TagStrings);

	/** ini 영속 등록만 — 이미 native 만으로 됐던 태그들을 보존하고 싶을 때. */
	static bool AppendTagToWorkspaceIni(const FString& TagString, const FString& DevComment = TEXT(""));

	/** Config/Tags/HktWorkspaceTags.ini 절대 경로. 디렉터리는 호출자가 생성. */
	static FString GetWorkspaceTagsIniPath();
};
