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

	/**
	 * 정적 객체(나무·바위·아이콘 등) 1장 빌드 — PNG 1개 → UPaperSprite 1개 →
	 * `UHktPaperActorVisualDataAsset.StaticSprite` 슬롯에 wiring.
	 *
	 *  - 애니메이션 자산은 만들지 않는다 (`AnimationAsset` 비움).
	 *  - 피벗은 셀 하단 중앙 (캐릭터 발 기준과 동일 컨벤션 — 나무 root 가 지면에 정합).
	 *  - 출력: `T_PaperStatic_{Safe}` / `PS_PaperStatic_{Safe}` / `DA_PaperVisual_{Safe}`.
	 *
	 * @param VisualTagStr     예: "PaperSprite.Prop.Tree.Oak". `IdentifierTag` 로 등록.
	 * @param SourceImagePath  PNG 절대 경로 (또는 프로젝트 상대 경로).
	 * @param PixelToWorld     1 픽셀당 월드 cm.
	 * @param OutputDir        비우면 `/Game/Generated/PaperSprites/Static/{SafeTag}`.
	 */
	UFUNCTION(BlueprintCallable, Category = "HKT|PaperSpriteBuilder")
	static FString BuildPaperStaticVisual(
		const FString& VisualTagStr,
		const FString& SourceImagePath,
		float PixelToWorld         = 2.0f,
		const FString& OutputDir   = TEXT(""));

	/**
	 * 정적 객체 폴더 일괄 빌드 — `SourceFolder` 안의 모든 `*.png` 를 각각 1 개의
	 * `UHktPaperActorVisualDataAsset` 로 만든다.
	 *  - VisualTag = `{BaseVisualTagStr}.{PngStem}` (예: `PaperSprite.Prop.Tree` + `Oak.png` → `PaperSprite.Prop.Tree.Oak`)
	 *  - 각 PNG 의 stem 이 그대로 자산 이름 / VisualTag 막바지에 사용.
	 */
	UFUNCTION(BlueprintCallable, Category = "HKT|PaperSpriteBuilder")
	static FString BuildPaperStaticFolder(
		const FString& BaseVisualTagStr,
		const FString& SourceFolder,
		float PixelToWorld         = 2.0f,
		const FString& OutputDir   = TEXT(""));
};
