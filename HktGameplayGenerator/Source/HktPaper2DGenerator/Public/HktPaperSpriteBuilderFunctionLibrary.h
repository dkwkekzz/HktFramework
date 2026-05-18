// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "HktPaperSpriteBuilderFunctionLibrary.generated.h"

// ============================================================================
// UHktPaperSpriteBuilderFunctionLibrary
//
// 정적 비주얼(StaticVisual) 전용 UFUNCTION 진입점. 캐릭터/anim 빌드는
// HktPaperAssetBuilder::BuildAnim 으로 일원화되었으므로 여기서는 더 이상
// UFUNCTION 으로 노출하지 않는다 — 호출자는 워크스페이스 빌더(HktWorkspaceGenerator)
// 가 단일 진입점.
//
// StaticVisual 출력 루트 (기본): /Game/Generated/PaperSprites/Static/{SafeTag}
//   ├─ T_PaperStatic_{SafeTag}    (UTexture2D)
//   ├─ PS_PaperStatic_{SafeTag}   (UPaperSprite, 전체 텍스처)
//   └─ DA_PaperVisual_{SafeTag}   (UHktPaperActorVisualDataAsset, StaticSprite 슬롯)
// ============================================================================
UCLASS()
class HKTPAPER2DGENERATOR_API UHktPaperSpriteBuilderFunctionLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
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
