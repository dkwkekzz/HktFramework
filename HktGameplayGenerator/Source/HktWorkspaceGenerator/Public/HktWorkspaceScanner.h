// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktWorkspaceTypes.h"

// ============================================================================
// FHktWorkspaceScanner
//
// 워크스페이스 루트를 훑어 카테고리별 Tag 폴더와 그 내부 입력 파일들의 형식을
// 식별한다. 빌드 자체는 수행하지 않음 — 결과는 FHktWorkspaceTagEntry 배열.
// ============================================================================
class HKTWORKSPACEGENERATOR_API FHktWorkspaceScanner
{
public:
	/** 모든 카테고리 스캔. WorkspaceRoot 가 비면 UHktWorkspaceSettings::ResolveWorkspaceRoot() 사용. */
	static bool ScanAll(const FString& WorkspaceRoot, TArray<FHktWorkspaceTagEntry>& OutEntries);

	/** Paper2D 카테고리만 스캔. */
	static bool ScanPaper2D(const FString& Paper2DRoot, TArray<FHktWorkspaceTagEntry>& OutEntries);

	/** 임의 카테고리 루트 스캔 (Paper2D/HISM 공통 디렉터리 컨벤션). */
	static bool ScanCategoryRoot(
		EHktWorkspaceCategory Category,
		const FString& CategoryRoot,
		TArray<FHktWorkspaceTagEntry>& OutEntries);

	/** 한 Tag 폴더의 입력 형식 식별. 결과 entry 의 Mode/Anims/StaticImagePath 채움. */
	static bool InspectTagFolder(
		EHktWorkspaceCategory Category,
		const FString& TagFolderPath,
		FHktWorkspaceTagEntry& InOutEntry);

	/** 폴더명 → 정규화된 GameplayTag 문자열 ("Paper2D.X.Y.Z" 형태). */
	static FString NormalizeTagFromFolderName(const FString& FolderName);

	/** 카테고리 이름 enum 변환. */
	static EHktWorkspaceCategory CategoryFromString(const FString& Name);
	static FString CategoryToString(EHktWorkspaceCategory Cat);

	/** anim 이름 → AnimTag 추론. sprite_tools.py 의 _action_name_to_anim_tag 와 동일 규약. */
	static FString AnimNameToAnimTag(const FString& AnimName);
};
