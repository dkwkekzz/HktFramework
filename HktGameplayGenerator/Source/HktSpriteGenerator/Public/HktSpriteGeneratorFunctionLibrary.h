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

	/**
	 * 에디터 단독 경로: 사용자가 지정한 디렉터리에서 이미지를 스캔해
	 * Atlas 패킹 + UHktSpritePartTemplate DataAsset 생성을 끝까지 수행.
	 *
	 * InputDir 파일명 규칙 (Python sprite_tools와 동일):
	 *   - 플랫:    {action}[_{direction}][_{frame_idx}].{png|tga|jpg|bmp|webp}
	 *   - 서브폴더: {action}/{direction}/{idx}.{ext}  또는  {action}/{direction}.{ext}
	 *
	 * 반환: McpBuildSpritePart와 동일한 JSON.
	 */
	UFUNCTION(BlueprintCallable, Category = "HKT|SpriteGenerator|Editor")
	static FString EditorBuildSpritePartFromDirectory(
		const FString& Tag,
		const FString& Slot,
		const FString& InputDir,
		const FString& OutputDir = TEXT("/Game/Generated/Sprites"),
		float PixelToWorld = 2.0f,
		float FrameDurationMs = 100.f,
		bool bLooping = true,
		bool bMirrorWestFromEast = true);

	/**
	 * 동영상 파일에서 ffmpeg로 일정한 크기의 PNG 프레임 시퀀스를 추출한다.
	 *
	 * 요구사항: 시스템에 ffmpeg가 설치되어 있어야 한다.
	 *   - 환경변수 HKT_FFMPEG_PATH 로 실행파일 경로를 지정 가능
	 *   - 미지정 시 시스템 PATH의 "ffmpeg" 사용
	 *
	 * 출력 파일: {OutputDir}/frame_0001.png, frame_0002.png, ...
	 *
	 * 파라미터:
	 *   FrameWidth/Height  추출 시 리사이즈할 셀 크기(px). 0 이하면 원본 크기.
	 *   FrameRate          초당 추출 프레임 수. (기본 10fps)
	 *   MaxFrames          최대 프레임 수. 0이면 제한 없음.
	 *   StartTimeSec       시작 시각(초).
	 *   EndTimeSec         종료 시각(초). 0이면 끝까지.
	 *
	 * 반환: {"success":bool, "outputDir":..., "frameCount":..., "error":...}
	 */
	UFUNCTION(BlueprintCallable, Category = "HKT|SpriteGenerator|Editor")
	static FString EditorExtractVideoFrames(
		const FString& VideoPath,
		const FString& OutputDir,
		int32 FrameWidth = 64,
		int32 FrameHeight = 64,
		float FrameRate = 10.0f,
		int32 MaxFrames = 0,
		float StartTimeSec = 0.0f,
		float EndTimeSec = 0.0f);

	/**
	 * 동영상 → 프레임 추출 → Atlas 패킹 → UHktSpritePartTemplate DataAsset 생성까지 일괄 수행.
	 *
	 * 내부적으로 EditorExtractVideoFrames로 프레임을 추출한 뒤
	 * EditorBuildSpritePartFromDirectory의 디렉터리 파이프라인을 재사용한다.
	 * 프레임에는 방향 정보가 없으므로 모든 8방향이 동일 아틀라스 셀을 공유한다.
	 *
	 * 프레임 임시 경로: {ProjectSavedDir}/SpriteGenerator/VideoFrames/{SafeTag}/{ActionId}/frame_####.png
	 *
	 * 반환: McpBuildSpritePart와 동일한 JSON.
	 */
	UFUNCTION(BlueprintCallable, Category = "HKT|SpriteGenerator|Editor")
	static FString EditorBuildSpritePartFromVideo(
		const FString& Tag,
		const FString& Slot,
		const FString& VideoPath,
		const FString& ActionId = TEXT("idle"),
		int32 FrameWidth = 64,
		int32 FrameHeight = 64,
		float FrameRate = 10.0f,
		int32 MaxFrames = 0,
		float StartTimeSec = 0.0f,
		float EndTimeSec = 0.0f,
		const FString& OutputDir = TEXT("/Game/Generated/Sprites"),
		float PixelToWorld = 2.0f,
		float FrameDurationMs = 100.f,
		bool bLooping = true,
		bool bMirrorWestFromEast = true);
};
