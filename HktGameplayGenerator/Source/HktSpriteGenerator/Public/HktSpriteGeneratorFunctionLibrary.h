// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "HktSpriteGeneratorFunctionLibrary.generated.h"

class UTexture2D;

// ============================================================================
// EHktSpriteSourceType — BuildSpriteAnim 재료 타입
// ============================================================================

UENUM(BlueprintType)
enum class EHktSpriteSourceType : uint8
{
	/** 동영상 파일 (ffmpeg 필요). SourcePath = 절대 파일 경로. */
	Video         UMETA(DisplayName = "Video File (ffmpeg)"),

	/**
	 * 단일 아틀라스.
	 *   - SourcePath가 "/Game/"으로 시작 → 이미 임포트된 UE5 Texture2D 에셋 경로
	 *   - 그 외 → 디스크 PNG 절대 경로 (자동 임포트)
	 * 레이아웃: 행=방향, 열=프레임.
	 */
	Atlas         UMETA(DisplayName = "Atlas (PNG file or UE asset path)"),

	/**
	 * 이미지 폴더 (TextureBundle).
	 * SourcePath = 디렉터리 경로.
	 * 파일명 규칙: {action}[_{direction}][_{frame_idx}].{png|tga|…}
	 *   또는 서브폴더: {action}/{direction}/{idx}.ext
	 * → 자동으로 아틀라스를 패킹한 뒤 DataAsset 생성/갱신.
	 */
	TextureBundle UMETA(DisplayName = "Texture Bundle (image folder)"),

	/**
	 * 방향별로 분할된 N 개의 atlas (Stage 3 BuildSpriteAnim 의 유일한 모드).
	 * Workspace ({Saved}/SpriteGenerator/{Char}/{Anim}/atlas_{Dir}.png) 의 PNG 들을
	 * 임포트해 AtlasSlots 로 묶는다.
	 */
	DirectionalAtlas UMETA(DisplayName = "Directional Atlas (per-direction, by convention)"),
};

// ============================================================================
// UHktSpriteGeneratorFunctionLibrary
// ============================================================================

/**
 * HktSprite 자동화 API.
 *
 * === 단일 진입점 (Stage 3) ===
 *
 *   BuildSpriteAnim(CharacterTag, AnimTag, CellW, CellH, PixelToWorld)
 *
 * Workspace ({Saved}/SpriteGenerator/{SafeChar}) 의 컨벤션 경로에서 atlas_{Dir}.png 를
 * 자동 발견·임포트해 DA_SpriteCharacter_{Char} 에 누적. 나머지는 자동 추론:
 *   - NumDirections    → 발견된 슬롯 수로 1/5/8 양자화
 *   - FramesPerDir     → 아틀라스 너비 / CellW
 *   - PivotOffset      → 셀 중앙·하단 (CellW/2, CellH)
 *   - bLooping         → AnimTag 키워드 (Locomotion=true, Attack/Hit/Death=false)
 *   - 셀 크기          → 사용자 입력 우선 → atlas_meta.json (Stage 2 산출) → atlas 종횡비 폴백
 *   - Upsert           → 기존 DataAsset이 있으면 해당 AnimTag 항목만 추가/교체
 *
 * === 저수준 API (MCP Python 호환) ===
 *   McpBuildSpriteCharacter(JsonSpec) — 기존 인터페이스, 변경하지 않음
 *   EditorBuildSpriteCharacterFromAtlas / FromDirectory / FromVideo / ExtractVideoFrames
 */
UCLASS()
class HKTSPRITEGENERATOR_API UHktSpriteGeneratorFunctionLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:

	// ========================================================================
	// 단일 진입점
	// ========================================================================

	/**
	 * CharacterTag + AnimTag + 재료(동영상|Atlas|TextureBundle) → UHktSpriteCharacterTemplate 빌드/갱신.
	 *
	 * 하나의 캐릭터(=CharacterTag)에 여러 애니메이션을 반복 호출로 누적한다.
	 *   - 같은 CharacterTag의 DataAsset이 이미 있으면 Animations 맵에 해당 AnimTag만 추가/교체
	 *   - 각 애니는 자신의 고유 아틀라스(`FHktSpriteAnimation::Atlas`)를 가짐 — 이전 애니가 파손되지 않음
	 *
	 * @param CharacterTagStr  캐릭터 식별 태그 — 필수 (예: "Sprite.Character.Knight")
	 * @param AnimTagStr       애니메이션 GameplayTag 문자열 (예: "Anim.FullBody.Locomotion.Idle")
	 * @param SourcePath       재료 경로. SourceType별:
	 *                           Video         → 동영상 파일 절대 경로
	 *                           Atlas         → PNG 절대경로 또는 UE 텍스처 에셋 경로("/Game/…")
	 *                           TextureBundle → 이미지 폴더 경로
	 * @param SourceType       재료 타입
	 * @param CellWidth        셀(프레임) 가로 px. Atlas 소스는 **필수**, 나머지는 0=자동 검출
	 * @param CellHeight       셀(프레임) 세로 px. Atlas 소스는 **필수**, 나머지는 0=자동 검출
	 * @param PixelToWorld     px → UE cm (기본 2.0)
	 * @param OutputDir        에셋 출력 경로. 비어있으면 /Game/Generated/Sprites
	 *
	 * 반환: {"success":bool, "dataAssetPath":…, "atlasAssetPath":…, "animTag":…,
	 *        "characterTag":…, "numDirections":…, "framesPerDir":…, "error":…}
	 */
	/**
	 * Stage 3 — Workspace ({Saved}/SpriteGenerator/{SafeChar}) 의 컨벤션 경로에서
	 * 방향별 atlas PNG 를 자동 발견·임포트하여 DataAsset 에 누적. CellWidth/Height 는 anim별 입력.
	 */
	UFUNCTION(BlueprintCallable, Category = "HKT|SpriteGenerator")
	static FString BuildSpriteAnim(
		const FString& CharacterTagStr,
		const FString& AnimTagStr,
		int32 CellWidth      = 0,
		int32 CellHeight     = 0,
		float PixelToWorld   = 2.0f);

	// ========================================================================
	// 저수준 API — MCP Python 및 직접 호출용 (기존 인터페이스 유지)
	// ========================================================================

	/**
	 * Atlas PNG + 메타데이터로 UHktSpriteCharacterTemplate DataAsset 빌드.
	 *
	 * JsonSpec 스키마:
	 * {
	 *   "characterTag": "Sprite.Character.Knight",
	 *   "atlasPngPath": "absolute/path/to/packed_atlas.png",
	 *   "cellW": 64,
	 *   "cellH": 64,
	 *   "pixelToWorld": 2.0,
	 *   "outputDir": "/Game/Generated/Sprites",
	 *   "defaultAnimTag": "Anim.FullBody.Locomotion.Idle",
	 *   "animations": [
	 *     {
	 *       "animTag": "Anim.FullBody.Locomotion.Idle",
	 *       "numDirections": 8,
	 *       "framesPerDirection": 4,
	 *       "pivotX": 32, "pivotY": 64,
	 *       "frameDurationMs": 100,
	 *       "looping": true,
	 *       "mirrorWestFromEast": true,
	 *       "onCompleteTransition": "",
	 *       "perFrameDurationMs": [100, 80, 100, 120],
	 *       "frames": [ { "atlasIndex": 0, … }, … ]
	 *     }
	 *   ]
	 * }
	 *
	 * 반환: {"success":bool, "dataAssetPath":…, "atlasAssetPath":…, "error":…}
	 */
	UFUNCTION(BlueprintCallable, Category = "HKT|SpriteGenerator|MCP")
	static FString McpBuildSpriteCharacter(const FString& JsonSpec);

	/**
	 * 이미 임포트된 UTexture2D 아틀라스 + 단일 프레임 크기 → DataAsset 생성.
	 * 아틀라스 레이아웃: 행=방향, 열=프레임.
	 *
	 * 반환: {"success":bool, "dataAssetPath":…, "error":…}
	 */
	UFUNCTION(BlueprintCallable, Category = "HKT|SpriteGenerator|Editor")
	static FString EditorBuildSpriteCharacterFromAtlas(
		const FString& CharacterTag,
		const FString& AtlasAssetPath,
		int32 FrameWidth,
		int32 FrameHeight,
		const FString& AnimTagStr      = TEXT("Anim.FullBody.Locomotion.Idle"),
		const FString& OutputDir       = TEXT("/Game/Generated/Sprites"),
		float PixelToWorld             = 2.0f,
		float FrameDurationMs          = 100.f,
		bool bLooping                  = true,
		bool bMirrorWestFromEast       = true);

	/**
	 * 디렉터리의 이미지들을 스캔 → Atlas 패킹 → DataAsset 생성.
	 * 파일명 규칙: {action}[_{direction}][_{frame_idx}].{png|tga|…}
	 *
	 * @param AnimTagOverride  비워두면 파일명의 action 으로부터 자동 추론
	 *                         (`Anim.FullBody.<Action>`). 지정하면 그대로 사용 —
	 *                         파일명에서 액션을 라운드트립할 때 발생하던 태그
	 *                         망가짐(예: "Anim.FullBody.Anim_fullbody_idle")을 회피.
	 *
	 * 반환: McpBuildSpriteCharacter와 동일 JSON.
	 */
	UFUNCTION(BlueprintCallable, Category = "HKT|SpriteGenerator|Editor")
	static FString EditorBuildSpriteCharacterFromDirectory(
		const FString& CharacterTag,
		const FString& InputDir,
		const FString& OutputDir       = TEXT("/Game/Generated/Sprites"),
		float PixelToWorld             = 2.0f,
		float FrameDurationMs          = 100.f,
		bool bLooping                  = true,
		bool bMirrorWestFromEast       = true,
		const FString& AnimTagOverride = TEXT(""));

	/**
	 * 동영상 → ffmpeg 프레임 추출 (frame_0001.png …).
	 * ffmpeg 경로는 Project Settings > Plugins > HKT Sprite Generator > FFmpeg Directory,
	 * 없으면 환경변수 HKT_FFMPEG_PATH, 그마저도 없으면 시스템 PATH 순으로 해석.
	 *
	 * FrameWidth/Height가 0이면 ffmpeg scale 필터를 생략하고 원본 해상도로 추출.
	 *
	 * 반환: {"success":bool, "outputDir":…, "frameCount":…, "error":…}
	 */
	UFUNCTION(BlueprintCallable, Category = "HKT|SpriteGenerator|Editor")
	static FString EditorExtractVideoFrames(
		const FString& VideoPath,
		const FString& OutputDir,
		int32 FrameWidth               = 0,
		int32 FrameHeight              = 0,
		float FrameRate                = 10.0f,
		int32 MaxFrames                = 0,
		float StartTimeSec             = 0.0f,
		float EndTimeSec               = 0.0f);

	/**
	 * 동영상 → ffmpeg 프레임 추출 → Atlas 패킹까지 일괄 수행 (DataAsset 빌드는 안 함).
	 *
	 * 산출물:
	 *   - TextureBundle 폴더: {OutputDir}/{SafeAnimTag}/frame_*.png
	 *   - Atlas PNG:        {OutputDir}/{SafeAnimTag}_atlas.png
	 *
	 * OutputDir 가 비어있으면 기본 루트는 {ProjectSavedDir}/SpriteGenerator/{SafeCharTag}.
	 * 이 규칙은 BuildSpriteAnim 의 SourcePath 자동 해석 규칙과 동일 — 사용자가 같은
	 * CharacterTag 만 입력하면 SpriteBuilder 가 SourcePath 없이도 산출물을 찾아낸다.
	 *
	 * 반환: {"success":bool, "characterTag":…, "animTag":…, "bundleDir":…,
	 *        "atlasPath":…, "frameCount":…, "cellW":…, "cellH":…, "error":…}
	 */
	/**
	 * Stage 1 — 동영상 → **단일 방향**의 TextureBundle 만 추출 (atlas 생성 안 함).
	 *
	 * 산출물: {Root}/{SafeAnimTag}/{DirName}/frame_*.png  ({DirName} = N|NE|E|…|NW)
	 * 같은 방향을 재추출하면 디렉터리 내 frame_*.png 만 정리하고 새로 채운다.
	 *
	 * @param DirectionIdx  0..7. EHktSpriteFacing 의 정수값과 일치(N=0, NE=1, …, NW=7).
	 *
	 * 반환: {"success":bool, "characterTag":…, "animTag":…, "direction":…,
	 *        "bundleDir":…, "frameCount":…, "error":…}
	 */
	UFUNCTION(BlueprintCallable, Category = "HKT|SpriteGenerator|Editor")
	static FString EditorExtractVideoBundle(
		const FString& CharacterTagStr,
		const FString& AnimTagStr,
		int32 DirectionIdx,
		const FString& VideoPath,
		int32 FrameWidth               = 0,
		int32 FrameHeight              = 0,
		float FrameRate                = 10.0f,
		int32 MaxFrames                = 0,
		float StartTimeSec             = 0.0f,
		float EndTimeSec               = 0.0f);

	/**
	 * Stage 2 — 컨벤션 경로의 방향별 TextureBundle 들을 스캔해 방향별 Atlas PNG 패킹 + UE Texture2D 임포트.
	 *
	 * 동작:
	 *   1) {Root}/{Anim}/{Dir}/frame_*.png 가 존재하는 (Anim, Dir) 조합을 모두 발견.
	 *      AnimTagFilter 가 비어있지 않으면 그 anim 만 처리.
	 *   2) 각 방향별로 1행 N열 strip atlas → {Root}/{Anim}/atlas_{Dir}.png 저장 후
	 *      {OutputDir}/T_SpriteAtlas_{SafeChar}_{SafeAnim}_{Dir} 로 임포트.
	 *
	 * @param ForcedCellW/H 0이면 디코드된 첫 프레임에서 자동 검출.
	 *
	 * 반환: {"success":bool, "items":[ {animTag, direction, atlasAssetPath, cellW, cellH, frameCount}, ... ], "error":…}
	 */
	/**
	 * Stage 2 — Workspace 의 {SafeAnim}/{Dir}/frame_*.png 를 방향별 strip atlas PNG 로 패킹.
	 * UE 임포트는 하지 않는다 (Stage 3 가 빌드 시점에 임포트). 셀 크기/프레임 수 메타는
	 * {Workspace}/{SafeAnim}/atlas_meta.json 에 사이드카로 남긴다.
	 */
	UFUNCTION(BlueprintCallable, Category = "HKT|SpriteGenerator|Editor")
	static FString EditorPackDirectionalAtlases(
		const FString& CharacterTagStr,
		const FString& AnimTagFilter   = TEXT(""));

	/**
	 * 단일 폴더의 frame_*.png 들을 1행 N열 strip atlas PNG 한 장으로 패킹 (UE 임포트 없음).
	 * 디스크 PNG 산출만 — DataAsset/UTexture2D 모두 만들지 않는다.
	 *
	 * 셀 크기는 디코드된 첫 프레임 max(W,H) 기반(자동). 출력 부모 디렉터리는 자동 생성,
	 * 기존 파일은 덮어쓴다.
	 *
	 * 반환: {"success":bool, "atlasPath":…, "frameCount":…, "cellW":…, "cellH":…, "error":…}
	 */
	UFUNCTION(BlueprintCallable, Category = "HKT|SpriteGenerator|Editor")
	static FString EditorPackBundleFolderToAtlasPng(
		const FString& InputDir,
		const FString& OutputPngPath);

	UFUNCTION(BlueprintCallable, Category = "HKT|SpriteGenerator|Editor")
	static FString EditorExtractAtlasAndBundle(
		const FString& CharacterTagStr,
		const FString& AnimTagStr,
		const FString& VideoPath,
		int32 FrameWidth               = 0,
		int32 FrameHeight              = 0,
		float FrameRate                = 10.0f,
		int32 MaxFrames                = 0,
		float StartTimeSec             = 0.0f,
		float EndTimeSec               = 0.0f,
		const FString& OutputDir       = TEXT(""));

	/**
	 * VideoExtract / BuildSpriteAnim 이 공유하는 규약 경로 헬퍼.
	 *
	 *   GetConventionBundleRoot(CharTag)              → {ProjectSavedDir}/SpriteGenerator/{SafeCharTag}
	 *   GetConventionBundleDir(CharTag, AnimTag)      → {Root}/{SafeAnimTag}                 (TextureBundle 폴더)
	 *   GetConventionAtlasPng(CharTag, AnimTag)       → {Root}/{SafeAnimTag}_atlas.png       (Atlas PNG)
	 */
	UFUNCTION(BlueprintCallable, Category = "HKT|SpriteGenerator|Editor")
	static FString GetConventionBundleRoot(const FString& CharacterTagStr);

	UFUNCTION(BlueprintCallable, Category = "HKT|SpriteGenerator|Editor")
	static FString GetConventionBundleDir(const FString& CharacterTagStr, const FString& AnimTagStr);

	UFUNCTION(BlueprintCallable, Category = "HKT|SpriteGenerator|Editor")
	static FString GetConventionAtlasPng(const FString& CharacterTagStr, const FString& AnimTagStr);

	/**
	 * 방향별(분할) 컨벤션 경로 헬퍼.
	 *   GetConventionDirectionalBundleDir(Char,Anim,DirIdx) → {Root}/{SafeAnim}/{DirName}
	 *   GetConventionDirectionalAtlasPng(Char,Anim,DirIdx)  → {Root}/{SafeAnim}/atlas_{DirName}.png
	 *   GetConventionDirectionalAtlasAssetPath(Char,Anim,DirIdx,OutputDir) → {OutputDir}/T_SpriteAtlas_{SafeChar}_{SafeAnim}_{DirName}
	 */
	UFUNCTION(BlueprintCallable, Category = "HKT|SpriteGenerator|Editor")
	static FString GetConventionDirectionalBundleDir(const FString& CharacterTagStr, const FString& AnimTagStr, int32 DirectionIdx);

	UFUNCTION(BlueprintCallable, Category = "HKT|SpriteGenerator|Editor")
	static FString GetConventionDirectionalAtlasPng(const FString& CharacterTagStr, const FString& AnimTagStr, int32 DirectionIdx);

	UFUNCTION(BlueprintCallable, Category = "HKT|SpriteGenerator|Editor")
	static FString GetConventionDirectionalAtlasAssetPath(const FString& CharacterTagStr, const FString& AnimTagStr, int32 DirectionIdx, const FString& OutputDir);

	/**
	 * 33프레임 1D 가로 strip 테레인 아틀라스를 폴더에서 빌드 (T_HktSpriteTerrainAtlas).
	 *
	 * 동작:
	 *   1) InputDir에서 {TypeName}.{png|tga|jpg|jpeg|bmp|webp} 파일을 스캔.
	 *      파일명 stem이 HktTerrainType의 이름(대소문자 무시)과 일치하면 해당 인덱스에 배치.
	 *      예) "Grass.png" → 인덱스 1, "Stone.png" → 3, "OreVoidstone.png" → 32
	 *   2) 누락된 프레임(파일 없음)과 Air(인덱스 0)는 투명(0,0,0,0) 셀로 채움.
	 *   3) 모든 프레임을 ForcedFrameSize(또는 입력 max(W,H))로 정렬해 1×33 strip으로 패킹.
	 *   4) PNG로 임시 저장 → UE5 Texture2D 에셋으로 임포트 (Nearest, NoMipmap, sRGB ON).
	 *      압축 설정은 임포트 후 에디터에서 수동 조정 권장 (모바일: BC7 / ASTC 6×6).
	 *
	 * 호환성:
	 *   - Material(M_HktSpriteTerrain)이 SubImageIndex로 샘플링하므로 SubUV는 (1/33, 1).
	 *   - HktVoxelTerrainTypes.h::HktTerrainType과 인덱스 순서가 일치해야 함 — 타입 추가 시
	 *     본 함수의 cpp 내 kTerrainTypeNames 배열도 동기화할 것.
	 *
	 * @param InputDir            이미지 폴더 절대 경로 (예: D:\Bundles\Terrain\Iso)
	 * @param OutputAssetPath     UE 에셋 경로. 기본: /Game/Generated/Terrain/T_HktSpriteTerrainAtlas
	 * @param ForcedFrameSize     프레임 한 변 픽셀(정사각). 0이면 입력 이미지 max(W,H) 사용.
	 *                            모바일 권장 128.
	 *
	 * 반환: {"success":bool, "atlasAssetPath":..., "frameCount":33, "frameSize":...,
	 *        "missing":["Air","..."], "error":...}
	 */
	UFUNCTION(BlueprintCallable, Category = "HKT|SpriteGenerator|Editor")
	static FString EditorBuildTerrainAtlasFromBundle(
		const FString& InputDir,
		const FString& OutputAssetPath = TEXT("/Game/Generated/Terrain/T_HktSpriteTerrainAtlas"),
		int32 ForcedFrameSize          = 128);

	/**
	 * 동영상 → 프레임 추출 → Atlas 패킹 → DataAsset 일괄 빌드.
	 *
	 * 반환: McpBuildSpriteCharacter와 동일 JSON.
	 */
	UFUNCTION(BlueprintCallable, Category = "HKT|SpriteGenerator|Editor")
	static FString EditorBuildSpriteCharacterFromVideo(
		const FString& CharacterTag,
		const FString& VideoPath,
		const FString& ActionId        = TEXT("idle"),
		int32 FrameWidth               = 0,
		int32 FrameHeight              = 0,
		float FrameRate                = 10.0f,
		int32 MaxFrames                = 0,
		float StartTimeSec             = 0.0f,
		float EndTimeSec               = 0.0f,
		const FString& OutputDir       = TEXT("/Game/Generated/Sprites"),
		float PixelToWorld             = 2.0f,
		float FrameDurationMs          = 100.f,
		bool bLooping                  = true,
		bool bMirrorWestFromEast       = true);
};
