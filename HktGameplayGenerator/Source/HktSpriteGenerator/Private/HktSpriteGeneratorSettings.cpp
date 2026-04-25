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

namespace
{
	/** 상대경로/프로젝트 기준 경로를 항상 절대경로로 정규화. 빈 문자열은 그대로. */
	static FString NormalizeToAbsolute(const FString& In)
	{
		if (In.IsEmpty()) return FString();
		FString Full = FPaths::ConvertRelativePathToFull(In);
		FPaths::NormalizeDirectoryName(Full);
		return Full;
	}
}

#if WITH_EDITOR
void UHktSpriteGeneratorSettings::PostEditChangeProperty(FPropertyChangedEvent& PropertyChangedEvent)
{
	Super::PostEditChangeProperty(PropertyChangedEvent);

	const FName PropName = PropertyChangedEvent.GetPropertyName();
	if (PropName == GET_MEMBER_NAME_CHECKED(UHktSpriteGeneratorSettings, FFmpegDirectory))
	{
		const FString Normalized = NormalizeToAbsolute(FFmpegDirectory.Path);
		if (Normalized != FFmpegDirectory.Path)
		{
			FFmpegDirectory.Path = Normalized;
			// 정규화한 값을 디스크에 반영.
			SaveConfig();
		}
	}
}
#endif

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
		// 런타임에도 한 번 더 절대경로로 정규화 — 에디터 외 경로에서 호출돼도 안전.
		const FString AbsDir = NormalizeToAbsolute(Dir);
		const FString Candidate = FPaths::Combine(AbsDir, kExeName);
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
		const FString AbsEnv = NormalizeToAbsolute(EnvPath);
		if (FPaths::FileExists(AbsEnv)) return AbsEnv;
		const FString Resolved = ComposeFromDir(AbsEnv);
		if (!Resolved.IsEmpty()) return Resolved;
	}

	// 3) 시스템 PATH 폴백 — 파일명만 반환, OS가 PATH 순회
	return kExeName;
}
