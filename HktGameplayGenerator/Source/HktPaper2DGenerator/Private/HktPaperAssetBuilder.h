// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"

class UTexture2D;
class UPaperSprite;
class UPaperFlipbook;
class UHktPaperCharacterTemplate;
class UHktPaperActorVisualDataAsset;

// ============================================================================
// HktPaperAssetBuilder — Texture / UPaperSprite / UPaperFlipbook /
// UHktPaperCharacterTemplate / UHktPaperActorVisualDataAsset upsert.
//
// 모든 함수는 멱등(idempotent) — 동일 인자로 재실행 시 in-place 갱신, 자산
// 이름 충돌이나 중복 자산 생성 0.
// ============================================================================
namespace HktPaperAssetBuilder
{
	struct FBuildAnimDirInput
	{
		int32 DirIdx     = 0;
		FString PngPath;
		int32 CellW      = 0;
		int32 CellH      = 0;
		int32 FrameCount = 0;
	};

	struct FBuildAnimResult
	{
		bool bSuccess = false;
		FString Error;

		FGameplayTag AnimTag;
		int32 NumDirections   = 0;       // 1 / 5 / 8
		int32 FramesPerDir    = 0;
		TArray<FString> AtlasAssetPaths; // 빌드된 텍스처 자산 경로
		TArray<FString> FlipbookAssetPaths;
	};

	/** PNG → UTexture2D 임포트 (이미 있으면 재임포트). */
	UTexture2D* ImportAtlasTexture(const FString& PngPath, const FString& PackagePath, const FString& AssetName);

	/**
	 * 한 dir 의 atlas 텍스처에서 cell 단위로 UPaperSprite N 개 + UPaperFlipbook 1 개를 빌드.
	 * 반환: 빌드된 Flipbook (이미 존재하면 in-place 갱신).
	 */
	UPaperFlipbook* BuildDirFlipbook(
		UTexture2D* AtlasTex,
		const FString& OutputPackageDir,   // /Game/Generated/PaperSprites/{SafeChar}
		const FString& BaseAssetName,      // PFB_{SafeChar}_{SafeAnim}_{Dir} 의 베이스
		int32 CellW, int32 CellH,
		int32 FrameCount,
		float PixelToWorld,
		float FrameDurationMs);

	/**
	 * (Char, Anim) 단위 빌드. Workspace 의 atlas_{Dir}.png 들을 읽어
	 * 발견된 dir 마다 Texture/Sprite/Flipbook 을 만들고 Template/Visual 자산에 upsert.
	 */
	FBuildAnimResult BuildAnim(
		const FString& CharacterTagStr,
		const FString& AnimTagStr,
		const FString& OutputPackageDir,
		float PixelToWorld,
		float FrameDurationMs,
		bool bLooping,
		bool bMirrorWestFromEast,
		int32 CellWidthOverride,
		int32 CellHeightOverride);

	/** Template 자산 로드/생성. */
	UHktPaperCharacterTemplate* LoadOrCreateTemplate(
		const FString& OutputPackageDir,
		const FString& SafeCharName,
		float PixelToWorld);

	/** Visual 자산 로드/생성. */
	UHktPaperActorVisualDataAsset* LoadOrCreateVisual(
		const FString& OutputPackageDir,
		const FString& SafeCharName,
		const FGameplayTag& IdentifierTag,
		UHktPaperCharacterTemplate* Template);

	/** UDataAsset 한 개를 디스크에 저장. */
	bool SaveDataAsset(class UObject* Asset);

	/** Tag 문자열 → 자산 이름 안전 문자열. HktSpriteGenerator 와 동일 규약. */
	FString SanitizeForAssetName(const FString& In);
}
