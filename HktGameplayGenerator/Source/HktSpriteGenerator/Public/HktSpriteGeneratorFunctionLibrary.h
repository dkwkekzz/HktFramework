// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "HktSpriteGeneratorFunctionLibrary.generated.h"

/**
 * UHktSpriteGeneratorFunctionLibrary
 *
 * MCP에서 호출 가능한 Sprite 파츠 자동 빌드 API.
 *
 * === 워크플로우 ===
 * 1. Python 측에서 입력 텍스처들을 Pillow로 균일 그리드 Atlas PNG로 패킹
 * 2. 패킹 메타데이터(JsonSpec)에 tag/slot/cell size/actions/frames 포함
 * 3. McpBuildSpritePart 호출:
 *    - Atlas PNG → UTexture2D로 임포트 (Nearest, NoMipmaps, UI 설정)
 *    - UHktSpritePartTemplate DataAsset 생성 + 필드 자동 주입
 *    - IdentifierTag로 런타임 UHktAssetSubsystem 태그 조회 자동 연결
 */
UCLASS()
class HKTSPRITEGENERATOR_API UHktSpriteGeneratorFunctionLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	/**
	 * Atlas PNG + 메타데이터로 UHktSpritePartTemplate DataAsset 빌드.
	 *
	 * JsonSpec 스키마:
	 * {
	 *   "tag": "Sprite.Part.Body.Knight",
	 *   "slot": "Body",                    // Body|Head|Weapon|Shield|HeadgearTop|HeadgearMid|HeadgearLow
	 *   "atlasPngPath": "absolute/path/to/packed_atlas.png",
	 *   "cellW": 64,
	 *   "cellH": 64,
	 *   "pixelToWorld": 2.0,
	 *   "outputDir": "/Game/Generated/Sprites",  // optional
	 *   "actions": [
	 *     {
	 *       "id": "idle",
	 *       "frameDurationMs": 100,
	 *       "looping": true,
	 *       "mirrorWestFromEast": true,
	 *       "onCompleteTransition": "",
	 *       "framesByDirection": [
	 *         [ {"atlasIndex":0, "pivotX":32, "pivotY":56}, {"atlasIndex":1}, ... ],  // N
	 *         [ ... ],                                                                // NE
	 *         ...
	 *       ]
	 *     }
	 *   ]
	 * }
	 *
	 * 반환: {"success":bool, "dataAssetPath":..., "atlasAssetPath":..., "error":...}
	 */
	UFUNCTION(BlueprintCallable, Category = "HKT|SpriteGenerator|MCP")
	static FString McpBuildSpritePart(const FString& JsonSpec);
};
