// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "HktPaperSpriteBuilderFunctionLibrary.generated.h"

// ============================================================================
// UHktPaperSpriteBuilderFunctionLibrary
//
// 기존 `HktSpriteGenerator` 의 워크스페이스(`{Saved}/SpriteGenerator/...`)를
// 입력으로 받아 UE 표준 `Paper2D` 자산(UPaperSprite / UPaperFlipbook) 과
// 본 경로 전용 `UHktPaperCharacterTemplate` / `UHktPaperActorVisualDataAsset`
// 을 생성·갱신한다.
//
// 출력 루트 (기본): /Game/Generated/PaperSprites/{SafeChar}
//   ├─ T_PaperAtlas_{SafeChar}_{SafeAnim}_{Dir}   (UTexture2D)
//   ├─ PS_{SafeChar}_{SafeAnim}_{Dir}_{Frame}     (UPaperSprite)
//   ├─ PFB_{SafeChar}_{SafeAnim}_{Dir}            (UPaperFlipbook)
//   ├─ DA_PaperCharacter_{SafeChar}               (UHktPaperCharacterTemplate)
//   └─ DA_PaperVisual_{SafeChar}                  (UHktPaperActorVisualDataAsset)
// ============================================================================
UCLASS()
class HKTPAPER2DGENERATOR_API UHktPaperSpriteBuilderFunctionLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	/**
	 * (Char, Anim) 단위 빌드 — Workspace 의 atlas_{Dir}.png 들을 임포트해
	 * Sprite/Flipbook 생성 후 DA_PaperCharacter_{Char} 에 upsert. DA_PaperVisual_{Char}
	 * 도 동시에 upsert.
	 *
	 * 반환: JSON 문자열 (success/error/atlases/flipbooks/numDirections/framesPerDir/...)
	 */
	UFUNCTION(BlueprintCallable, Category = "HKT|PaperSpriteBuilder")
	static FString BuildPaperSpriteAnim(
		const FString& CharacterTagStr,
		const FString& AnimTagStr,
		int32 CellWidth            = 0,
		int32 CellHeight           = 0,
		float PixelToWorld         = 2.0f,
		float FrameDurationMs      = 100.f,
		bool  bLooping             = true,
		bool  bMirrorWestFromEast  = true,
		const FString& VisualIdentifierTagStr = TEXT(""),
		const FString& OutputDir   = TEXT(""));

	/**
	 * 캐릭터 워크스페이스 안의 모든 anim 디렉터리를 자동 발견해 일괄 빌드.
	 *  - VisualIdentifierTagStr 비우면 "PaperSprite.Character.{Char}" 자동 사용.
	 */
	UFUNCTION(BlueprintCallable, Category = "HKT|PaperSpriteBuilder")
	static FString BuildPaperCharacter(
		const FString& CharacterTagStr,
		const FString& VisualIdentifierTagStr = TEXT(""),
		float PixelToWorld           = 2.0f,
		const FString& OutputDir     = TEXT(""));
};
