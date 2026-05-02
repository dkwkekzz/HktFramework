// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

// ============================================================================
// HktPaperWorkspaceScanner — `HktSpriteGenerator` 의 워크스페이스 발견·메타 파싱.
//
// 입력 디렉터리 컨벤션 (HktSpriteGenerator 가 산출):
//   {ProjectSavedDir}/SpriteGenerator/{SafeChar}/{SafeAnim}/atlas_{Dir}.png
//   {ProjectSavedDir}/SpriteGenerator/{SafeChar}/{SafeAnim}/atlas_meta.json
//
// 본 스캐너는 generator 의 컨벤션 헬퍼(`UHktSpriteGeneratorFunctionLibrary`)
// 만 호출하고 generator 의 다른 코드는 일체 건드리지 않는다.
// ============================================================================
namespace HktPaperWorkspace
{
	/** 8 방향 인덱스 → 디렉터리 이름 (kDirectionNames 와 정확히 일치). */
	const TCHAR* GetDirectionName(int32 DirIdx);

	/** 워크스페이스에 실제 존재하는 anim 디렉터리 이름들을 수집. */
	bool DiscoverAnimNames(const FString& CharacterTagStr, TArray<FString>& OutAnimSafeNames);

	/** atlas_meta.json 사이드카에서 dir 별 cell/frame 추출. dir 이 없으면 비움. */
	struct FDirMeta
	{
		int32 DirIdx     = -1;
		int32 CellW      = 0;
		int32 CellH      = 0;
		int32 FrameCount = 0;
	};
	bool LoadAtlasMeta(const FString& MetaJsonPath, TArray<FDirMeta>& OutDirs);
}
