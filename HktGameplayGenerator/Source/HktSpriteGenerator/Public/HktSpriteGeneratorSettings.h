// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DeveloperSettings.h"
#include "HktSpriteGeneratorSettings.generated.h"

/**
 * UHktSpriteGeneratorSettings
 *
 * Project Settings > Plugins > HKT Sprite Generator 에 노출되는 에디터 설정.
 * ffmpeg 실행파일의 위치를 디렉터리 경로로 지정 가능.
 *
 * 해결 순서: 프로젝트 세팅(FFmpegDirectory) → 환경변수 HKT_FFMPEG_PATH → 시스템 PATH.
 */
UCLASS(config=Editor, defaultconfig, meta=(DisplayName="HKT Sprite Generator"))
class HKTSPRITEGENERATOR_API UHktSpriteGeneratorSettings : public UDeveloperSettings
{
	GENERATED_BODY()

public:
	UHktSpriteGeneratorSettings();

	/**
	 * ffmpeg 실행파일이 위치한 **절대 경로** 디렉터리. 비워두면 환경변수/시스템 PATH로 폴백.
	 * 디렉터리만 지정하면 OS에 맞는 파일명(ffmpeg.exe / ffmpeg)을 자동으로 조합.
	 */
	UPROPERTY(config, EditAnywhere, Category="FFmpeg",
		meta=(DisplayName="FFmpeg Directory"))
	FDirectoryPath FFmpegDirectory;

	// UDeveloperSettings 인터페이스
	virtual FName GetCategoryName() const override { return FName(TEXT("HktGameplay")); }
	virtual FName GetSectionName() const override { return FName(TEXT("HktSpriteGenerator")); }

	/** 설정 + 환경변수 + PATH 순으로 ffmpeg 실행파일 경로를 해석. 없으면 시스템 PATH 기본명 반환. */
	static FString ResolveFFmpegExecutable();
};
