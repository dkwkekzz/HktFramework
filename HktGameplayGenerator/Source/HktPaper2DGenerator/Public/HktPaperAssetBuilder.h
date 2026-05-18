// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"

class UTexture2D;
class UPaperSprite;
class UPaperFlipbook;
class UHktPaperAnimationDataAsset;
class UHktPaperActorVisualDataAsset;

// ============================================================================
// HktPaperAssetBuilder — Texture / UPaperSprite / UPaperFlipbook /
// UHktPaperAnimationDataAsset / UHktPaperActorVisualDataAsset upsert.
//
// 모든 함수는 멱등(idempotent) — 동일 인자로 재실행 시 in-place 갱신, 자산
// 이름 충돌이나 중복 자산 생성 0.
// ============================================================================
namespace HktPaperAssetBuilder
{
	/**
	 * 한 dir 의 atlas 입력 — 호출자(워크스페이스 빌더)가 채워서 BuildAnim 에 전달.
	 * 더 이상 디스크 컨벤션을 BuildAnim 안에서 탐색하지 않는다 — 워크스페이스가 진실 소스.
	 */
	struct FAnimAtlasInput
	{
		int32 DirIdx     = 0;   // 0..7 (HktWorkspaceConventions 와 일치)
		FString PngPath;        // atlas PNG 절대 경로
		int32 CellW      = 0;   // 0 = unknown (BuildAnim 이 종횡비 폴백)
		int32 CellH      = 0;
		int32 FrameCount = 0;   // 0 = unknown (BuildAnim 이 GridCount 폴백)
	};

	struct FBuildAnimResult
	{
		bool bSuccess = false;
		FString Error;

		FGameplayTag AnimTag;
		int32 NumDirections   = 0;       // 1 / 2 / 5 / 8
		int32 FramesPerDir    = 0;
		TArray<FString> AtlasAssetPaths; // 빌드된 텍스처 자산 경로
		TArray<FString> FlipbookAssetPaths;
	};

	/** PNG → UTexture2D 임포트 (이미 있으면 재임포트). */
	HKTPAPER2DGENERATOR_API UTexture2D* ImportAtlasTexture(const FString& PngPath, const FString& PackagePath, const FString& AssetName);

	/**
	 * 한 dir 의 atlas 텍스처에서 cell 단위로 UPaperSprite N 개 + UPaperFlipbook 1 개를 빌드.
	 * Cols 가 양수면 (col, row) 그리드로 슬라이스: OriginX=(i%Cols)*CellW, OriginY=(i/Cols)*CellH.
	 * Cols<=0 이면 단일-행으로 폴백.
	 * 반환: 빌드된 Flipbook (이미 존재하면 in-place 갱신).
	 */
	UPaperFlipbook* BuildDirFlipbook(
		UTexture2D* AtlasTex,
		const FString& OutputPackageDir,   // /Game/Generated/PaperSprites/{SafeChar}
		const FString& BaseAssetName,      // PFB_{SafeChar}_{SafeAnim}_{Dir} 의 베이스
		int32 CellW, int32 CellH,
		int32 Cols,
		int32 FrameCount,
		float PixelToWorld,
		float FrameDurationMs);

	/**
	 * (Char, Anim) 단위 빌드.
	 * 호출자(워크스페이스 빌더)가 워크스페이스 폴더에서 직접 수집한 atlas 입력 배열을 받아
	 * 발견된 dir 마다 Texture/Sprite/Flipbook 을 만들고 Animation 자산에 upsert.
	 *
	 * 디스크 컨벤션 탐색·사이드카 로드는 더 이상 수행하지 않는다 — 워크스페이스가 진실 소스.
	 */
	HKTPAPER2DGENERATOR_API FBuildAnimResult BuildAnim(
		const FString& CharacterTagStr,
		const FString& AnimTagStr,
		const FString& OutputPackageDir,
		const TArray<FAnimAtlasInput>& AtlasInputs,
		float PixelToWorld,
		float FrameDurationMs,
		bool bLooping,
		bool bMirrorWestFromEast,
		int32 CellWidthOverride,
		int32 CellHeightOverride);

	/** Animation 자산 로드/생성 (구 LoadOrCreateTemplate). */
	UHktPaperAnimationDataAsset* LoadOrCreateAnimation(
		const FString& OutputPackageDir,
		const FString& SafeCharName,
		float PixelToWorld);

	/** Visual 자산 로드/생성. */
	HKTPAPER2DGENERATOR_API UHktPaperActorVisualDataAsset* LoadOrCreateVisual(
		const FString& OutputPackageDir,
		const FString& SafeCharName,
		const FGameplayTag& IdentifierTag,
		UHktPaperAnimationDataAsset* Animation);

	/** UDataAsset 한 개를 디스크에 저장. */
	HKTPAPER2DGENERATOR_API bool SaveDataAsset(class UObject* Asset);

	/** Tag 문자열 → 자산 이름 안전 문자열. HktSpriteGenerator 와 동일 규약. */
	FString SanitizeForAssetName(const FString& In);
}
