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

	/**
	 * 캐릭터 워크스페이스 루트의 사이드카(`paper_character_meta.json`) 파싱.
	 *  - bMirrorWestFromEast (override) : 캐릭터별로 미러 비활성 가능.
	 *  - frameDurationMs                : 캐릭터별 기본 프레임 지속.
	 *  - pixelToWorld                   : 캐릭터별 기본 PixelToWorld.
	 *  - looping                        : 캐릭터별 기본 looping.
	 * 모든 필드가 optional — 미지정이면 OutHas* false. PR-5 캐릭터별 override 진입점.
	 */
	struct FCharacterMeta
	{
		bool bHasMirrorWestFromEast = false;
		bool bMirrorWestFromEast    = true;

		bool  bHasFrameDurationMs   = false;
		float FrameDurationMs       = 100.f;

		bool  bHasPixelToWorld      = false;
		float PixelToWorld          = 2.f;

		bool  bHasLooping           = false;
		bool  bLooping              = true;
	};
	bool LoadCharacterMeta(const FString& CharacterTagStr, FCharacterMeta& OutMeta);
}
