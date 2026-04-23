// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "HktSpriteGeneratorFunctionLibrary.generated.h"

class UTexture2D;

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
	 * JsonSpec 스키마 (그리드 레이아웃 기반):
	 * {
	 *   "tag": "Sprite.Part.Body.Knight",
	 *   "slot": "Body",
	 *   "atlasPngPath": "absolute/path/to/packed_atlas.png",
	 *   "cellW": 64,
	 *   "cellH": 64,
	 *   "pixelToWorld": 2.0,
	 *   "outputDir": "/Game/Generated/Sprites",
	 *   "actions": [
	 *     {
	 *       "id": "idle",
	 *       "numDirections": 8,                 // 1 | 5 | 8
	 *       "framesPerDirection": 4,
	 *       "startAtlasIndex": 0,
	 *       "pivotX": 32, "pivotY": 64,
	 *       "frameDurationMs": 100,
	 *       "looping": true,
	 *       "mirrorWestFromEast": true,
	 *       "onCompleteTransition": "",
	 *       "perFrameDurationMs": [100, 80, 100, 120],   // optional
	 *       "frameOverrides": [                          // optional
	 *         { "dir": 0, "frame": 3, "atlasIndex": 42 }
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
	 * 가장 간단한 경로: 이미 임포트된 UTexture2D 아틀라스 경로와 단일 프레임 크기만으로
	 * UHktSpritePartTemplate DataAsset을 생성.
	 *
	 * AtlasAssetPath: UE5 오브젝트 경로 문자열 (예: "/Game/Generated/Textures/T_Foo.T_Foo").
	 *   내부에서 LoadObject<UTexture2D> 로 명시 로드한다 — 아직 메모리에 없어도 됨.
	 *   Remote Control API / Python MCP 에서도 이 문자열 그대로 넘기면 된다.
	 *
	 * 가정: 아틀라스는 "행=방향, 열=프레임" 그리드 형태로 패킹되어 있다.
	 *   - cols = Atlas.Width  / FrameWidth  → FramesPerDirection
	 *   - rows = Atlas.Height / FrameHeight → NumDirections (1/5/8로 양자화)
	 *
	 * 단일 "idle" 액션을 StartAtlasIndex=0, Pivot=(FrameWidth/2, FrameHeight)로 생성한다.
	 * 더 복잡한 구조가 필요하면 McpBuildSpritePart 사용.
	 *
	 * 반환: {"success":bool, "dataAssetPath":..., "error":...}
	 *
	 * === Python 사용 예시 (MCP EditorBridge / Remote Control API) ===
	 *
	 *   from hkt_mcp.bridge.editor_bridge import EditorBridge
	 *
	 *   OBJECT_PATH = "/Script/HktSpriteGenerator.Default__HktSpriteGeneratorFunctionLibrary"
	 *
	 *   # 1) 최소 예시: /Game/ 아래에 임포트된 Atlas 텍스처 경로를 그대로 전달
	 *   async def build_knight_body(bridge: EditorBridge):
	 *       result_json = await bridge.call_method(
	 *           "EditorBuildSpritePartFromAtlas",
	 *           object_path=OBJECT_PATH,
	 *           Tag="Sprite.Part.Body.Knight",
	 *           Slot="Body",
	 *           AtlasAssetPath="/Game/Generated/Textures/T_Knight_Body_Atlas.T_Knight_Body_Atlas",
	 *           FrameWidth=64,
	 *           FrameHeight=64,
	 *       )
	 *       # result_json: {"success": true, "dataAssetPath": "/Game/Generated/Sprites/DA_...", ...}
	 *       return result_json
	 *
	 *   # 2) 전체 파라미터 예시: 액션 id/피봇/루핑/미러링 등을 명시
	 *   async def build_mage_cast(bridge: EditorBridge):
	 *       return await bridge.call_method(
	 *           "EditorBuildSpritePartFromAtlas",
	 *           object_path=OBJECT_PATH,
	 *           Tag="Sprite.Part.Body.Mage",
	 *           Slot="Body",
	 *           AtlasAssetPath="/Game/Generated/Textures/T_Mage_Cast_Atlas.T_Mage_Cast_Atlas",
	 *           FrameWidth=96,
	 *           FrameHeight=96,
	 *           ActionId="cast",
	 *           OutputDir="/Game/Generated/Sprites/Mage",
	 *           PixelToWorld=2.0,
	 *           FrameDurationMs=80.0,
	 *           bLooping=False,
	 *           bMirrorWestFromEast=True,
	 *       )
	 *
	 *   # 3) 디스크 PNG → McpImportTexture → 반환 경로를 AtlasAssetPath 로 바로 체이닝
	 *   async def import_then_build(bridge: EditorBridge, png_path: str):
	 *       import json
	 *       intent = json.dumps({"usage": "UI"})  # Nearest/NoMipmap 강제
	 *       imp = await bridge.call_method(
	 *           "McpImportTexture",
	 *           object_path="/Script/HktTextureGenerator.Default__HktTextureFunctionLibrary",
	 *           ImageFilePath=png_path,
	 *           JsonIntent=intent,
	 *           OutputDir="/Game/Generated/Textures",
	 *       )
	 *       atlas_asset_path = json.loads(imp)["assetPath"]
	 *       return await bridge.call_method(
	 *           "EditorBuildSpritePartFromAtlas",
	 *           object_path=OBJECT_PATH,
	 *           Tag="Sprite.Part.Weapon.Sword",
	 *           Slot="Weapon",
	 *           AtlasAssetPath=atlas_asset_path,
	 *           FrameWidth=48,
	 *           FrameHeight=48,
	 *           ActionId="swing",
	 *           bLooping=False,
	 *       )
	 */
	UFUNCTION(BlueprintCallable, Category = "HKT|SpriteGenerator|Editor")
	static FString EditorBuildSpritePartFromAtlas(
		const FString& Tag,
		const FString& Slot,
		const FString& AtlasAssetPath,
		int32 FrameWidth,
		int32 FrameHeight,
		const FString& ActionId = TEXT("idle"),
		const FString& OutputDir = TEXT("/Game/Generated/Sprites"),
		float PixelToWorld = 2.0f,
		float FrameDurationMs = 100.f,
		bool bLooping = true,
		bool bMirrorWestFromEast = true);

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
