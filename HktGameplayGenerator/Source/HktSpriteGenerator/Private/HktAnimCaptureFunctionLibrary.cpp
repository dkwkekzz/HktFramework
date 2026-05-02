// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktAnimCaptureFunctionLibrary.h"

#include "HktAnimCaptureScene.h"
#include "HktSpriteGeneratorFunctionLibrary.h"

#include "Animation/AnimSequence.h"
#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Engine/SkeletalMesh.h"
#include "HAL/FileManager.h"
#include "HAL/PlatformFileManager.h"
#include "Misc/Paths.h"
#include "Misc/ScopedSlowTask.h"
#include "Serialization/JsonReader.h"
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

	/**
	 * 방향별 TextureBundle 컨벤션 루트.
	 *   {ProjectSavedDir}/SpriteGenerator/{SafeChar}/{SafeAnim}/
	 * 하위에 {DirName}/frame_{nnn:03d}.png 가 쌓이고,
	 * 캡처 산출물(방향별 frame_*.png + atlas_{Dir}.png) 의 루트.
	 */
	static FString DefaultDiskOutputDir(const FString& CharacterTag, const FString& AnimTagStr, const FString& ActionId)
	{
		// AnimTag 가 있으면 컨벤션 경로 사용. 없으면 ActionId 폴백.
		if (!CharacterTag.IsEmpty() && !AnimTagStr.IsEmpty())
		{
			return UHktSpriteGeneratorFunctionLibrary::GetConventionBundleDir(CharacterTag, AnimTagStr);
		}
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
	 * 캡처 시작 전 방향별 서브트리를 통째로 비운다 — 이전 캡처의 stale 프레임이
	 * 새로 패킹될 방향별 atlas 에 섞이는 것을 방지.
	 *   {Dir}/{N,NE,E,SE,S,SW,W,NW}/frame_*.png  +  {Dir}/atlas_*.png
	 */
	static void ClearPerDirectionContents(const FString& Dir)
	{
		IFileManager& FM = IFileManager::Get();
		if (!FM.DirectoryExists(*Dir)) { FM.MakeDirectory(*Dir, /*Tree*/ true); return; }

		static const TCHAR* DirNames[8] = {
			TEXT("N"), TEXT("NE"), TEXT("E"), TEXT("SE"),
			TEXT("S"), TEXT("SW"), TEXT("W"), TEXT("NW")
		};
		for (const TCHAR* Name : DirNames)
		{
			const FString Sub = Dir / Name;
			FM.DeleteDirectory(*Sub, /*RequireExists*/ false, /*Tree*/ true);
		}

		// 방향별 atlas PNG 도 정리 — Stage 2 가 다시 만든다.
		TArray<FString> AtlasFiles;
		FM.FindFiles(AtlasFiles, *(Dir / TEXT("atlas_*.png")), /*Files*/ true, /*Dirs*/ false);
		for (const FString& F : AtlasFiles)
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

	// 출력 폴더 결정 — 기본값은 컨벤션 경로
	// (ConventionBundleDir = {Saved}/SpriteGenerator/{SafeChar}/{SafeAnim}/).
	const FString AnimTagStr = Settings.AnimTag.IsValid() ? Settings.AnimTag.ToString() : FString();
	if (Settings.DiskOutputDir.IsEmpty())
	{
		Settings.DiskOutputDir = DefaultDiskOutputDir(CharacterTagStr, AnimTagStr, Settings.ActionId);
	}
	Settings.DiskOutputDir = FPaths::ConvertRelativePathToFull(Settings.DiskOutputDir);
	ClearPerDirectionContents(Settings.DiskOutputDir);

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

		// 방향별 서브폴더 생성 — 첫 진입 시 없으면 만든다.
		IFileManager::Get().MakeDirectory(*(Settings.DiskOutputDir / DirName), /*Tree*/ true);

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

			// 방향별 서브폴더 + frame_{nnn:03d}.png — Stage 2 패커가
			// {Root}/{DirName}/frame_*.png 글롭으로 스캔하는 컨벤션과 일치.
			const FString DirSubPath = Settings.DiskOutputDir / DirName;
			const FString FileName   = FString::Printf(TEXT("frame_%03d.png"), Frame);
			const FString FullPath   = DirSubPath / FileName;

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

	// === 방향별 Atlas PNG 패킹 (UE 임포트 없음, DataAsset 없음) ===
	// {DiskOutputDir}/{DirName}/frame_*.png  →  {DiskOutputDir}/atlas_{DirName}.png 만 생성.
	int32 AtlasOkCount = 0;
	FString AtlasFirstError;
	TArray<TSharedPtr<FJsonValue>> AtlasItems;
	if (Settings.bAutoBuildAtlas)
	{
		for (int32 d = 0; d < Settings.NumDirections; ++d)
		{
			const TCHAR* DirName = DirectionName(d);
			const FString DirBundle = Settings.DiskOutputDir / DirName;
			const FString AtlasPng  = Settings.DiskOutputDir / FString::Printf(TEXT("atlas_%s.png"), DirName);

			const FString PackJson = UHktSpriteGeneratorFunctionLibrary::EditorPackBundleFolderToAtlasPng(
				DirBundle, AtlasPng);

			TSharedPtr<FJsonObject> Parsed;
			TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(PackJson);
			if (FJsonSerializer::Deserialize(Reader, Parsed) && Parsed.IsValid())
			{
				bool bOk = false;
				Parsed->TryGetBoolField(TEXT("success"), bOk);
				if (bOk)
				{
					Parsed->SetStringField(TEXT("direction"), DirName);
					AtlasItems.Add(MakeShared<FJsonValueObject>(Parsed));
					++AtlasOkCount;
				}
				else if (AtlasFirstError.IsEmpty())
				{
					Parsed->TryGetStringField(TEXT("error"), AtlasFirstError);
				}
			}
		}
	}

	FString AtlasResults;
	if (Settings.bAutoBuildAtlas)
	{
		TSharedRef<TJsonWriter<>> AW = TJsonWriterFactory<>::Create(&AtlasResults);
		TSharedRef<FJsonObject> AObj = MakeShared<FJsonObject>();
		AObj->SetBoolField(TEXT("success"),   AtlasOkCount > 0);
		AObj->SetNumberField(TEXT("count"),   AtlasOkCount);
		AObj->SetArrayField(TEXT("items"),    AtlasItems);
		if (AtlasOkCount == 0 && !AtlasFirstError.IsEmpty())
		{
			AObj->SetStringField(TEXT("error"), AtlasFirstError);
		}
		FJsonSerializer::Serialize(AObj, AW);
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
		if (!AtlasResults.IsEmpty())
		{
			W->WriteIdentifierPrefix(TEXT("atlasResults"));
			W->WriteRawJSONValue(AtlasResults);
		}
		W->WriteObjectEnd();
		W->Close();
	}
	return OutJson;
}
