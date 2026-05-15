// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktWorkspaceTypes.h"

// ============================================================================
// FHktWorkspaceManifest
//
// 한 Tag 폴더 안의 `.workspace.meta.json` IO — 입력 해시 / 마지막 빌드 시각 /
// 산출 자산 경로를 보존해 재빌드 시 변경 없으면 skip 가능하게 한다.
// ============================================================================
struct FHktWorkspaceManifestData
{
	FString TagString;
	FString Category;
	FString LastBuiltAtIso;
	FString InputsHash;
	int32   Version = 1;
	TArray<FString> Outputs;

	/** anim 별 요약 (디버깅·MCP 응답용). */
	struct FAnimEntry
	{
		FString Name;
		FString Source;
		TArray<FString> Directions;
	};
	TArray<FAnimEntry> Anims;
};

class HKTWORKSPACEGENERATOR_API FHktWorkspaceManifest
{
public:
	/** 폴더 내부의 `.workspace.meta.json` 경로. */
	static FString GetManifestPath(const FString& TagFolderPath);

	static bool Load(const FString& TagFolderPath, FHktWorkspaceManifestData& OutData);
	static bool Save(const FString& TagFolderPath, const FHktWorkspaceManifestData& Data);

	/** entry 의 모든 SourcePaths/StaticImagePath 와 파일 mtime 으로 해시 산출. */
	static FString ComputeInputsHash(const FHktWorkspaceTagEntry& Entry);

	/** Entry 로부터 InputsHash + Anims 메타를 채운 manifest 초안 생성. Outputs/LastBuiltAt 는 빌더가 채움. */
	static FHktWorkspaceManifestData MakeDraft(const FHktWorkspaceTagEntry& Entry);
};
