// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Engine/EngineTypes.h"
#include "GameplayTagContainer.h"
#include "UObject/Object.h"
#include "HktSpriteVideoExtractPanelConfig.generated.h"

/**
 * UHktSpriteVideoExtractPanelConfig
 *
 * VideoExtract 패널의 입력 상태. UPROPERTY(Config) 로 EditorPerProjectUserSettings.ini
 * 에 자동 저장되어 다음 세션에서 그대로 복원된다.
 *
 * SpriteBuilder 와의 연계: OutputDir 가 비어있으면 산출물은
 *   {ProjectSavedDir}/SpriteGenerator/{CharacterTag}
 * 아래에 일관된 규칙으로 배치된다 — TextureBundle 폴더는
 *   {Root}/{AnimTag}/frame_*.png
 * Atlas PNG 는
 *   {Root}/{AnimTag}_atlas.png
 * 에 저장. SpriteBuilder 의 BuildSpriteAnim 은 SourcePath 가 비어있으면 동일 규칙으로
 * 위 경로를 자동 해석하므로, 사용자는 같은 CharacterTag 만 맞추면 별도 경로 입력 없이
 * DataAsset 을 즉시 빌드할 수 있다.
 */
UCLASS(Config = EditorPerProjectUserSettings)
class UHktSpriteVideoExtractPanelConfig : public UObject
{
	GENERATED_BODY()

public:
	/** 산출물을 식별할 캐릭터 태그(예: Sprite.Character.Knight). SpriteBuilder 와 공유. */
	UPROPERTY(EditAnywhere, Config, Category = "Identity", meta = (Categories = "Sprite"))
	FGameplayTag CharacterTag;

	/** 이 비디오가 만들어낼 단일 애니 태그(예: Anim.FullBody.Locomotion.Idle). */
	UPROPERTY(EditAnywhere, Config, Category = "Identity", meta = (Categories = "Anim"))
	FGameplayTag AnimTag;

	/** 입력 동영상 파일(절대 경로). 빈 채로 Browse 시 프로젝트 루트가 기본 위치. */
	UPROPERTY(EditAnywhere, Config, Category = "Source",
		meta = (FilePathFilter = "Video Files (*.mp4;*.mov;*.avi;*.webm;*.mkv)|*.mp4;*.mov;*.avi;*.webm;*.mkv|All Files|*.*"))
	FFilePath VideoPath;

	/**
	 * 산출물 루트 폴더. 비워두면 기본값:
	 *   {ProjectSavedDir}/SpriteGenerator/{CharacterTag}
	 * SpriteBuilder 도 동일 규칙을 사용하므로 비워두는 것을 권장.
	 */
	UPROPERTY(EditAnywhere, Config, Category = "Source")
	FDirectoryPath OutputDir;

	/** ffmpeg scale 필터 가로 px. 0 이면 원본 해상도 유지. */
	UPROPERTY(EditAnywhere, Config, Category = "Frames", meta = (ClampMin = "0"))
	int32 FrameWidth = 0;

	/** ffmpeg scale 필터 세로 px. 0 이면 원본 해상도 유지. */
	UPROPERTY(EditAnywhere, Config, Category = "Frames", meta = (ClampMin = "0"))
	int32 FrameHeight = 0;

	/** 추출 프레임 레이트(fps). 0 이면 ffmpeg fps 필터 생략(원본 fps). */
	UPROPERTY(EditAnywhere, Config, Category = "Frames", meta = (ClampMin = "0.0"))
	float FrameRate = 10.0f;

	/** 최대 프레임 수. 0 이면 무제한. */
	UPROPERTY(EditAnywhere, Config, Category = "Frames", meta = (ClampMin = "0"))
	int32 MaxFrames = 0;

	/** 시작 타임스탬프(초). */
	UPROPERTY(EditAnywhere, Config, Category = "Frames", meta = (ClampMin = "0.0"))
	float StartTimeSec = 0.0f;

	/** 종료 타임스탬프(초). 0 이면 끝까지. */
	UPROPERTY(EditAnywhere, Config, Category = "Frames", meta = (ClampMin = "0.0"))
	float EndTimeSec = 0.0f;
};
