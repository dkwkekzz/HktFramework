// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktAnimCaptureFunctionLibrary.h"

#include "HktAnimCaptureScene.h"
#include "HktSpriteGeneratorFunctionLibrary.h"

#include "Animation/AnimSequence.h"
#include "Engine/SkeletalMesh.h"
#include "HAL/FileManager.h"
#include "HAL/PlatformFileManager.h"
#include "Misc/Paths.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"

DEFINE_LOG_CATEGORY_STATIC(LogHktAnimCaptureLib, Log, All);

namespace HktAnimCaptureLibPrivate
{
	// HktSpriteGeneratorFunctionLibrary.cpp 의 kDirectionNames 와 동일 순서.
	// SpriteGenerator 디렉터리 스캐너가 N=0, NE=1, E=2, SE=3, S=4, SW=5, W=6, NW=7
	// 으로 인덱스를 부여하므로 캡처 파일명 suffix 도 그 매핑을 따른다.
	static const TCHAR* DirectionName(int32 Idx)
	{
		static const TCHAR* Names[8] = {
			TEXT("N"), TEXT("NE"), TEXT("E"), TEXT("SE"),
			TEXT("S"), TEXT("SW"), TEXT("W"), TEXT("NW")
		};
		return Names[((Idx % 8) + 8) % 8];
	}

	static FString MakeJsonError(const FString& Msg)
	{
		UE_LOG(LogHktAnimCaptureLib, Warning, TEXT("%s"), *Msg);
		FString Json;
		TSharedRef<TJsonWriter<>> W = TJsonWriterFactory<>::Create(&Json);
		W->WriteObjectStart();
		W->WriteValue(TEXT("success"), false);
		W->WriteValue(TEXT("error"), Msg);
		W->WriteObjectEnd();
		W->Close();
		return Json;
	}

	static FString DefaultDiskOutputDir(const FString& CharacterTag, const FString& ActionId)
	{
		const FString Safe = (CharacterTag.IsEmpty() ? TEXT("Untagged") : CharacterTag).Replace(TEXT("."), TEXT("_"));
		const FString Action = ActionId.IsEmpty() ? TEXT("idle") : ActionId;
		return FPaths::ProjectSavedDir() / TEXT("SpriteGenerator") / TEXT("AnimCapture") / Safe / Action;
	}

	/**
	 * 캡처 시작 전 출력 폴더를 비운다 — 이전 캡처의 잔존 프레임이 새로
	 * 패킹될 아틀라스에 섞이는 것을 방지.
	 */
	static void ClearDirectoryContents(const FString& Dir)
	{
		IFileManager& FM = IFileManager::Get();
		if (!FM.DirectoryExists(*Dir)) { FM.MakeDirectory(*Dir, /*Tree*/ true); return; }

		TArray<FString> Files;
		FM.FindFiles(Files, *(Dir / TEXT("*.png")), /*Files*/ true, /*Dirs*/ false);
		for (const FString& F : Files)
		{
			FM.Delete(*(Dir / F), /*RequireExists*/ false, /*EvenReadOnly*/ true);
		}
	}
}

FString UHktAnimCaptureFunctionLibrary::CaptureAnimation(const FHktAnimCaptureSettings& InSettings)
{
	using namespace HktAnimCaptureLibPrivate;

	FHktAnimCaptureSettings Settings = InSettings;

	if (Settings.SkeletalMesh.IsNull())
	{
		return MakeJsonError(TEXT("SkeletalMesh 미지정"));
	}

	// 출력 폴더 결정.
	if (Settings.DiskOutputDir.IsEmpty())
	{
		Settings.DiskOutputDir = DefaultDiskOutputDir(Settings.CharacterTag, Settings.ActionId);
	}
	Settings.DiskOutputDir = FPaths::ConvertRelativePathToFull(Settings.DiskOutputDir);
	ClearDirectoryContents(Settings.DiskOutputDir);

	// 방향 수 정규화 — SpriteGenerator 가 1·5·8 양자화하므로 4 는 사실상 8 로 보강하는 것이 안전.
	if (Settings.NumDirections <= 0) Settings.NumDirections = 1;
	if (Settings.NumDirections > 8)  Settings.NumDirections = 8;

	// === 씬 초기화 ===
	FHktAnimCaptureScene Scene;
	FString InitErr;
	if (!Scene.Initialize(Settings, InitErr))
	{
		return MakeJsonError(InitErr);
	}

	// === 프레임 수 결정 ===
	const float AnimLen = Scene.GetAnimSequenceLength();
	float StartT = FMath::Max(0.0f, Settings.StartTime);
	float EndT   = (Settings.EndTime > 0.0f) ? Settings.EndTime : AnimLen;
	if (AnimLen > 0.0f) { EndT = FMath::Min(EndT, AnimLen); }
	if (EndT <= StartT) { EndT = AnimLen; }

	int32 FrameCount = Settings.FrameCount;
	if (FrameCount <= 0)
	{
		const float Span = FMath::Max(0.0f, EndT - StartT);
		FrameCount = (Span > 0.0f && Settings.CaptureFPS > 0.0f)
			? FMath::Max(1, FMath::CeilToInt(Span * Settings.CaptureFPS))
			: 1;
	}

	const float TimeStep = (FrameCount > 1)
		? (EndT - StartT) / static_cast<float>(FrameCount - 1)
		: 0.0f;

	// === 캡처 루프 ===
	int32 SavedFrames = 0;
	const FString ActionLower = Settings.ActionId.IsEmpty() ? TEXT("idle") : Settings.ActionId.ToLower();

	for (int32 Dir = 0; Dir < Settings.NumDirections; ++Dir)
	{
		Scene.SetDirectionIndex(Dir);

		// SpriteGenerator 의 디렉터리 스캐너는 N(0)..NW(7) 로 8방향만 인덱스가 있다.
		// 사용자가 NumDirections=1 또는 4 를 골라도, 우리는 N..NW 매핑 이름을 그대로 쓴다.
		// (N=0 → 정면 캡처, 이후 균등 분할)
		const TCHAR* DirName = DirectionName(Dir);

		for (int32 Frame = 0; Frame < FrameCount; ++Frame)
		{
			const float T = (AnimLen > 0.0f) ? (StartT + TimeStep * Frame) : 0.0f;
			Scene.SetAnimationTime(T);

			// 파일명: {action}_{dir}_{frame:03d}.png — HktSpriteGenerator ParseFlatStem 호환.
			const FString FileName = FString::Printf(TEXT("%s_%s_%03d.png"), *ActionLower, DirName, Frame);
			const FString FullPath = Settings.DiskOutputDir / FileName;

			FString CaptureErr;
			if (!Scene.CaptureToFile(FullPath, CaptureErr))
			{
				return MakeJsonError(FString::Printf(TEXT("캡처 실패(dir=%s frame=%d): %s"), DirName, Frame, *CaptureErr));
			}
			++SavedFrames;
		}
	}

	UE_LOG(LogHktAnimCaptureLib, Log,
		TEXT("AnimCapture 완료: 방향=%d 프레임=%d 총=%d → %s"),
		Settings.NumDirections, FrameCount, SavedFrames, *Settings.DiskOutputDir);

	// === Atlas 자동 빌드 ===
	FString AtlasResult;
	if (Settings.bAutoBuildAtlas && !Settings.CharacterTag.IsEmpty())
	{
		AtlasResult = UHktSpriteGeneratorFunctionLibrary::EditorBuildSpriteCharacterFromDirectory(
			Settings.CharacterTag,
			Settings.DiskOutputDir,
			Settings.AssetOutputDir,
			Settings.PixelToWorld,
			Settings.FrameDurationMs,
			Settings.bLooping,
			Settings.bMirrorWestFromEast);
	}

	// === 결과 JSON ===
	FString OutJson;
	{
		TSharedRef<TJsonWriter<>> W = TJsonWriterFactory<>::Create(&OutJson);
		W->WriteObjectStart();
		W->WriteValue(TEXT("success"),       true);
		W->WriteValue(TEXT("diskOutputDir"), Settings.DiskOutputDir);
		W->WriteValue(TEXT("characterTag"),  Settings.CharacterTag);
		W->WriteValue(TEXT("actionId"),      Settings.ActionId);
		W->WriteValue(TEXT("directions"),    Settings.NumDirections);
		W->WriteValue(TEXT("framesPerDir"),  FrameCount);
		W->WriteValue(TEXT("totalFrames"),   SavedFrames);
		W->WriteValue(TEXT("animLength"),    AnimLen);
		if (!AtlasResult.IsEmpty())
		{
			W->WriteIdentifierPrefix(TEXT("atlasResult"));
			W->WriteRawJSONValue(AtlasResult);
		}
		W->WriteObjectEnd();
		W->Close();
	}
	return OutJson;
}
