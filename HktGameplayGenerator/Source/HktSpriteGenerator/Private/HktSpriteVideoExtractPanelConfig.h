// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Engine/EngineTypes.h"
#include "GameplayTagContainer.h"
#include "HktSpriteTypes.h"
#include "UObject/Object.h"
#include "HktSpriteVideoExtractPanelConfig.generated.h"

/**
 * UHktSpriteVideoExtractPanelConfig — Stage 1 입력 상태.
 *
 * 모든 산출물은 공유 Workspace 에 컨벤션으로 떨어진다:
 *   {ProjectSavedDir}/SpriteGenerator/{SafeChar}/{SafeAnim}/{Dir}/frame_*.png
 * Stage 2/3 가 같은 Workspace 를 스캔하므로 사용자는 CharacterTag 만 일치시키면 된다.
 */
UCLASS(Config = EditorPerProjectUserSettings)
class UHktSpriteVideoExtractPanelConfig : public UObject
{
	GENERATED_BODY()

public:
	/** 산출물을 식별할 캐릭터 태그(예: Sprite.Character.Knight). 3 Stage 공통. */
	UPROPERTY(EditAnywhere, Config, Category = "Identity", meta = (Categories = "Entity.Character"))
	FGameplayTag CharacterTag;

	/** 이 비디오가 만들어낼 단일 애니 태그(예: Anim.FullBody.Locomotion.Idle). */
	UPROPERTY(EditAnywhere, Config, Category = "Identity", meta = (Categories = "Anim"))
	FGameplayTag AnimTag;

	/** 이 비디오가 캡처한 방향. 산출물은 {Workspace}/{SafeAnim}/{DirName}/frame_*.png 로 분리 저장. */
	UPROPERTY(EditAnywhere, Config, Category = "Identity")
	EHktSpriteFacing Direction = EHktSpriteFacing::N;

	/** 입력 동영상 파일(절대 경로). */
	UPROPERTY(EditAnywhere, Config, Category = "Source",
		meta = (FilePathFilter = "Video Files (*.mp4;*.mov;*.avi;*.webm;*.mkv)|*.mp4;*.mov;*.avi;*.webm;*.mkv|All Files|*.*"))
	FFilePath VideoPath;

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
