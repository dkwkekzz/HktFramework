// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteGeneratorSettings.h"
#include "HAL/FileManager.h"
#include "HAL/PlatformMisc.h"
#include "Misc/Paths.h"

UHktSpriteGeneratorSettings::UHktSpriteGeneratorSettings()
{
	CategoryName = FName(TEXT("Plugins"));
	SectionName  = FName(TEXT("HktSpriteGenerator"));
}

FString UHktSpriteGeneratorSettings::ResolveFFmpegExecutable()
{
#if PLATFORM_WINDOWS
	static const TCHAR* const kExeName = TEXT("ffmpeg.exe");
#else
	static const TCHAR* const kExeName = TEXT("ffmpeg");
#endif

	auto ComposeFromDir = [](const FString& Dir) -> FString
	{
		if (Dir.IsEmpty()) return FString();
		const FString Candidate = FPaths::Combine(Dir, kExeName);
		return FPaths::FileExists(Candidate) ? Candidate : FString();
	};

	// 1) 프로젝트 세팅의 FFmpegDirectory
	if (const UHktSpriteGeneratorSettings* Settings = GetDefault<UHktSpriteGeneratorSettings>())
	{
		const FString Resolved = ComposeFromDir(Settings->FFmpegDirectory.Path);
		if (!Resolved.IsEmpty()) return Resolved;
	}

	// 2) 환경변수 HKT_FFMPEG_PATH — 디렉터리 또는 실행파일 절대경로 모두 허용
	const FString EnvPath = FPlatformMisc::GetEnvironmentVariable(TEXT("HKT_FFMPEG_PATH"));
	if (!EnvPath.IsEmpty())
	{
		if (FPaths::FileExists(EnvPath)) return EnvPath;
		const FString Resolved = ComposeFromDir(EnvPath);
		if (!Resolved.IsEmpty()) return Resolved;
	}

	// 3) 시스템 PATH 폴백 — 파일명만 반환, OS가 PATH 순회
	return kExeName;
}
