// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktAnimCaptureFunctionLibrary.h"

#include "HktAnimCaptureScene.h"
#include "HktSpriteGeneratorFunctionLibrary.h"

#include "Animation/AnimSequence.h"
#include "Engine/SkeletalMesh.h"
#include "HAL/FileManager.h"
#include "HAL/PlatformFileManager.h"
#include "Misc/Paths.h"
#include "Misc/ScopedSlowTask.h"
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
	 * AnimTag 의 leaf 세그먼트(소문자) 를 file prefix 로 사용 — 사용자가 ActionId 를 비워도
	 * 캡처가 동작하도록. 예: Anim.FullBody.Locomotion.Idle → "idle".
	 * AnimTag 도 비어 있으면 "idle" 폴백.
	 */
	static FString DeriveActionIdFromAnimTag(const FGameplayTag& AnimTag)
	{
		if (!AnimTag.IsValid()) return TEXT("idle");
		const FString TagStr = AnimTag.ToString();
		int32 LastDot = INDEX_NONE;
		TagStr.FindLastChar(TEXT('.'), LastDot);
		const FString Leaf = (LastDot == INDEX_NONE) ? TagStr : TagStr.Mid(LastDot + 1);
		return Leaf.IsEmpty() ? TEXT("idle") : Leaf.ToLower();
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
	return CaptureAnimationWithProgress(InSettings, FHktAnimCaptureProgressDelegate());
}

FString UHktAnimCaptureFunctionLibrary::CaptureAnimationWithProgress(
	const FHktAnimCaptureSettings& InSettings,
	const FHktAnimCaptureProgressDelegate& ProgressCallback)
{
	using namespace HktAnimCaptureLibPrivate;

	FHktAnimCaptureSettings Settings = InSettings;

	if (Settings.SkeletalMesh.IsNull())
	{
		return MakeJsonError(TEXT("SkeletalMesh 미지정"));
	}

	// ActionId 가 비어있으면 AnimTag 의 leaf 로부터 자동 결정 — 사용자가 태그만
	// 지정하고 file prefix 는 신경 안 써도 동작하게.
	const FString CharacterTagStr = Settings.CharacterTag.ToString();
	if (Settings.ActionId.IsEmpty())
	{
		Settings.ActionId = DeriveActionIdFromAnimTag(Settings.AnimTag);
	}

	// 출력 폴더 결정.
	if (Settings.DiskOutputDir.IsEmpty())
	{
		Settings.DiskOutputDir = DefaultDiskOutputDir(CharacterTagStr, Settings.ActionId);
	}
	Settings.DiskOutputDir = FPaths::ConvertRelativePathToFull(Settings.DiskOutputDir);
	ClearDirectoryContents(Settings.DiskOutputDir);

	// 방향 수 강제: 1 또는 8 만 허용. 그 외(2/3/4/5/6/7)는 yaw step 과
	// SpriteGenerator 의 N/NE/E/SE/S/SW/W/NW 파일명 인덱스 매핑이 어긋나
	// 잘못된 방향 슬롯으로 들어간다 — 안전을 위해 8 로 강제.
	Settings.NumDirections = (Settings.NumDirections <= 1) ? 1 : 8;

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
	const int32 TotalFrames = FMath::Max(1, Settings.NumDirections * FrameCount);

	// FScopedSlowTask: 표준 Unreal 진행 다이얼로그(취소 가능). EnterProgressFrame 가 Slate
	// 도 함께 펌프하므로 동시에 패널에 바인딩된 SProgressBar 도 실시간 갱신된다.
	FScopedSlowTask SlowTask(static_cast<float>(TotalFrames),
		NSLOCTEXT("HktAnimCapture", "Capturing", "Capturing animation frames..."));
	SlowTask.MakeDialog(/*bShowCancelButton*/ true);

	for (int32 Dir = 0; Dir < Settings.NumDirections; ++Dir)
	{
		Scene.SetDirectionIndex(Dir);

		// SpriteGenerator 의 디렉터리 스캐너는 N(0)..NW(7) 로 8방향만 인덱스가 있다.
		// 사용자가 NumDirections=1 또는 4 를 골라도, 우리는 N..NW 매핑 이름을 그대로 쓴다.
		// (N=0 → 정면 캡처, 이후 균등 분할)
		const TCHAR* DirName = DirectionName(Dir);

		for (int32 Frame = 0; Frame < FrameCount; ++Frame)
		{
			if (SlowTask.ShouldCancel())
			{
				return MakeJsonError(FString::Printf(TEXT("사용자 취소(저장된 프레임=%d/%d)"), SavedFrames, TotalFrames));
			}

			const FString StatusMsg = FString::Printf(TEXT("Dir %s (%d/%d)  Frame %d/%d"),
				DirName, Dir + 1, Settings.NumDirections, Frame + 1, FrameCount);

			SlowTask.EnterProgressFrame(1.0f, FText::FromString(StatusMsg));

			ProgressCallback.ExecuteIfBound(SavedFrames, TotalFrames, StatusMsg);

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

	// 마지막 갱신 — 100% 도달 알림.
	ProgressCallback.ExecuteIfBound(SavedFrames, TotalFrames,
		FString::Printf(TEXT("Captured %d frames"), SavedFrames));

	UE_LOG(LogHktAnimCaptureLib, Log,
		TEXT("AnimCapture 완료: 방향=%d 프레임=%d 총=%d → %s"),
		Settings.NumDirections, FrameCount, SavedFrames, *Settings.DiskOutputDir);

	// === Atlas 자동 빌드 ===
	FString AtlasResult;
	if (Settings.bAutoBuildAtlas && !CharacterTagStr.IsEmpty())
	{
		// AnimTag 가 지정되면 그대로 사용해 등록 — 파일명 round-trip 으로 발생하던
		// "Anim.FullBody.Anim_..." 같은 망가진 태그를 방지.
		const FString AnimTagOverride = Settings.AnimTag.IsValid() ? Settings.AnimTag.ToString() : FString();
		AtlasResult = UHktSpriteGeneratorFunctionLibrary::EditorBuildSpriteCharacterFromDirectory(
			CharacterTagStr,
			Settings.DiskOutputDir,
			Settings.AssetOutputDir,
			Settings.PixelToWorld,
			Settings.FrameDurationMs,
			Settings.bLooping,
			Settings.bMirrorWestFromEast,
			AnimTagOverride);
	}

	// === 결과 JSON ===
	FString OutJson;
	{
		TSharedRef<TJsonWriter<>> W = TJsonWriterFactory<>::Create(&OutJson);
		W->WriteObjectStart();
		W->WriteValue(TEXT("success"),       true);
		W->WriteValue(TEXT("diskOutputDir"), Settings.DiskOutputDir);
		W->WriteValue(TEXT("characterTag"),  CharacterTagStr);
		W->WriteValue(TEXT("animTag"),       Settings.AnimTag.IsValid() ? Settings.AnimTag.ToString() : FString());
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
