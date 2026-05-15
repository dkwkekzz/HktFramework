// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktPaperWorkspaceBuilder.h"
#include "HktWorkspaceLog.h"
#include "HktWorkspaceScanner.h"
#include "HktWorkspaceTagRegistrar.h"

#include "HktPaperSpriteBuilderFunctionLibrary.h"
#include "HktSpriteGeneratorFunctionLibrary.h"

#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "HAL/FileManager.h"

namespace
{
	/** Tag/Anim 문자열에서 GameplayTag → 디스크 경로용 안전 문자열 변환 ('.' → '_'). */
	FString Sanitize(const FString& In)
	{
		return In.Replace(TEXT("."), TEXT("_"));
	}

	/** legacy SpriteGenerator 워크스페이스 경로. UHktSpriteGeneratorFunctionLibrary 의 컨벤션과 일치. */
	FString LegacyBundleRoot(const FString& CharacterTagStr)
	{
		return UHktSpriteGeneratorFunctionLibrary::GetConventionBundleRoot(CharacterTagStr);
	}

	FString LegacyAnimDir(const FString& CharacterTagStr, const FString& AnimTagStr)
	{
		return LegacyBundleRoot(CharacterTagStr) / Sanitize(AnimTagStr);
	}

	bool EnsureDirExists(const FString& Dir)
	{
		return IFileManager::Get().MakeDirectory(*Dir, /*Tree*/true);
	}

	/** UE 컨텐츠 경로 산출 — 워크스페이스 빌더 컨벤션. */
	FString DefaultPaperOutputDir(const FString& SafeChar)
	{
		return FString::Printf(TEXT("/Game/Generated/PaperSprites/%s"), *SafeChar);
	}

	/** JSON 응답에서 success 와 추가 필드 추출 — 실패 시 Error 채움. */
	bool ParseJsonResult(const FString& JsonStr, TSharedPtr<FJsonObject>& OutObj, FString& OutError)
	{
		const TSharedRef<TJsonReader<>> R = TJsonReaderFactory<>::Create(JsonStr);
		if (!FJsonSerializer::Deserialize(R, OutObj) || !OutObj.IsValid())
		{
			OutError = TEXT("결과 JSON 파싱 실패");
			return false;
		}
		bool bOk = false;
		OutObj->TryGetBoolField(TEXT("success"), bOk);
		if (!bOk)
		{
			OutObj->TryGetStringField(TEXT("error"), OutError);
			if (OutError.IsEmpty()) OutError = TEXT("빌더 실패 (원인 미상)");
		}
		return bOk;
	}

	/**
	 * Anim 소스 → legacy `{Saved}/SpriteGenerator/{SafeChar}/{SafeAnim}/atlas_{Dir}.png` 정규화.
	 * 반환 값은 정규화된 atlas 파일 경로들. 실패 시 Error 채움.
	 */
	bool NormalizeAnim(
		const FString& CharacterTagStr,
		const FHktWorkspaceAnimInput& Anim,
		TArray<FString>& OutAtlasPaths,
		FString& OutError)
	{
		const FString SafeAnim = Sanitize(Anim.AnimTag);
		const FString AnimDir  = LegacyAnimDir(CharacterTagStr, Anim.AnimTag);
		EnsureDirExists(AnimDir);

		switch (Anim.Source)
		{
			case EHktWorkspaceAnimSource::Atlas:
			{
				// 1:1 복사 — 사용자 파일을 legacy 경로의 atlas_{Dir}.png 로 옮김.
				// mtime + size 동일하면 디스크 IO 절약을 위해 skip.
				for (int32 i = 0; i < Anim.SourcePaths.Num(); ++i)
				{
					const FString& Src = Anim.SourcePaths[i];
					const FString& Dir = Anim.Directions[i];
					const FString Dest = AnimDir / FString::Printf(TEXT("atlas_%s.png"), *Dir);

					IFileManager& FM = IFileManager::Get();
					const FFileStatData SrcStat  = FM.GetStatData(*Src);
					const FFileStatData DestStat = FM.GetStatData(*Dest);
					const bool bIdentical = SrcStat.bIsValid && DestStat.bIsValid
						&& SrcStat.FileSize == DestStat.FileSize
						&& SrcStat.ModificationTime == DestStat.ModificationTime;

					if (!bIdentical && FM.Copy(*Dest, *Src, /*bReplace*/true) != COPY_OK)
					{
						OutError = FString::Printf(TEXT("atlas 복사 실패: %s → %s"), *Src, *Dest);
						return false;
					}
					OutAtlasPaths.Add(Dest);
				}
				return true;
			}

			case EHktWorkspaceAnimSource::FrameSequence:
			{
				// 방향별 프레임 디렉터리 → atlas PNG 패킹 (UE 임포트 X — Paper 빌더가 임포트).
				for (int32 i = 0; i < Anim.SourcePaths.Num(); ++i)
				{
					const FString& InputDir = Anim.SourcePaths[i];
					const FString& Dir      = Anim.Directions[i];
					const FString Dest = AnimDir / FString::Printf(TEXT("atlas_%s.png"), *Dir);

					const FString PackJson = UHktSpriteGeneratorFunctionLibrary::EditorPackBundleFolderToAtlasPng(
						InputDir, Dest, /*MaxAtlasPixelWidth*/ 0);

					TSharedPtr<FJsonObject> Obj;
					FString Err;
					if (!ParseJsonResult(PackJson, Obj, Err))
					{
						OutError = FString::Printf(TEXT("frame→atlas 패킹 실패(%s): %s"), *Dir, *Err);
						return false;
					}
					OutAtlasPaths.Add(Dest);
				}
				return true;
			}

			case EHktWorkspaceAnimSource::Video:
			{
				// 영상 → 전체 8방향 추출 + atlas 패킹까지 컨벤션 경로에 자동 산출.
				if (Anim.SourcePaths.Num() != 1)
				{
					OutError = TEXT("Video 입력은 정확히 1개 영상 파일이어야 함");
					return false;
				}
				const FString VideoPath = Anim.SourcePaths[0];

				const FString ExtractJson = UHktSpriteGeneratorFunctionLibrary::EditorExtractAtlasAndBundle(
					CharacterTagStr, Anim.AnimTag, VideoPath,
					/*FrameW*/0, /*FrameH*/0,
					/*FrameRate*/10.0f,
					/*MaxFrames*/0,
					/*StartTime*/0.f, /*EndTime*/0.f,
					/*OutputDir*/ TEXT(""));

				TSharedPtr<FJsonObject> Obj;
				FString Err;
				if (!ParseJsonResult(ExtractJson, Obj, Err))
				{
					OutError = FString::Printf(TEXT("video→atlas 추출 실패: %s"), *Err);
					return false;
				}

				// 산출 atlas 파일 경로 추가 (8 방향 가정).
				for (int32 d = 0; d < HktWorkspaceConventions::NumDirections; ++d)
				{
					const FString AtlasPath = AnimDir / FString::Printf(
						TEXT("atlas_%s.png"), HktWorkspaceConventions::GetDirectionName(d));
					if (FPaths::FileExists(AtlasPath))
					{
						OutAtlasPaths.Add(AtlasPath);
					}
				}
				return true;
			}

			default:
				OutError = TEXT("anim 소스 타입 미지원");
				return false;
		}
	}
}

namespace HktPaperWorkspaceBuilder
{
	FHktPaperBuildResult BuildEntry(
		const FHktWorkspaceTagEntry& Entry,
		float PixelToWorld)
	{
		FHktPaperBuildResult Result;

		// 1) Tag 등록 보장 (native + ini).
		FString TagNote;
		const FGameplayTag Tag = FHktWorkspaceTagRegistrar::EnsureTag(Entry.TagString, &TagNote);
		Result.Notes.Add(FString::Printf(TEXT("tag=%s (%s)"), *Entry.TagString, *TagNote));
		if (!Tag.IsValid())
		{
			Result.Error = FString::Printf(TEXT("GameplayTag 등록 실패: %s"), *Entry.TagString);
			return Result;
		}

		const FString SafeChar = Sanitize(Entry.TagString);

		// 2) Mode 분기.
		if (Entry.Mode == EHktWorkspaceTagMode::StaticVisual)
		{
			if (Entry.StaticImagePath.IsEmpty() || !FPaths::FileExists(Entry.StaticImagePath))
			{
				Result.Error = FString::Printf(TEXT("StaticVisual 입력 PNG 없음: %s"), *Entry.StaticImagePath);
				return Result;
			}

			const FString OutDir = DefaultPaperOutputDir(SafeChar);

			// VisualTag = 워크스페이스 Tag 자체. BuildPaperStaticVisual 이 산출 자산 경로 반환.
			const FString Single = UHktPaperSpriteBuilderFunctionLibrary::BuildPaperStaticVisual(
				Entry.TagString, Entry.StaticImagePath, PixelToWorld, OutDir);

			TSharedPtr<FJsonObject> Obj;
			FString Err;
			if (!ParseJsonResult(Single, Obj, Err))
			{
				Result.Error = Err;
				return Result;
			}

			FString Path;
			if (Obj->TryGetStringField(TEXT("visualPath"), Path)) Result.OutputAssetPaths.Add(Path);
			if (Obj->TryGetStringField(TEXT("texturePath"), Path)) Result.OutputAssetPaths.Add(Path);
			if (Obj->TryGetStringField(TEXT("spritePath"), Path)) Result.OutputAssetPaths.Add(Path);

			Result.bSuccess = true;
			Result.Notes.Add(FString::Printf(TEXT("mode=StaticVisual src=%s"), *Entry.StaticImagePath));
			return Result;
		}

		if (Entry.Mode != EHktWorkspaceTagMode::Character)
		{
			Result.Error = TEXT("Mode 가 Character 도 StaticVisual 도 아님 — 스캐너 결과 확인 필요");
			return Result;
		}

		if (Entry.Anims.Num() == 0)
		{
			Result.Error = TEXT("Character 모드인데 anim 입력이 없음");
			return Result;
		}

		// 3) 캐릭터 사이드카(character_meta.json) 가 있으면 legacy workspace 의 paper_character_meta.json
		//    으로 복사 — BuildPaperCharacter 가 그 파일을 읽어 frameDurationMs/pixelToWorld override 적용.
		{
			const FString UserMeta   = Entry.FolderPath / TEXT("character_meta.json");
			if (FPaths::FileExists(UserMeta))
			{
				const FString LegacyRoot = LegacyBundleRoot(Entry.TagString);
				EnsureDirExists(LegacyRoot);
				const FString LegacyMeta = LegacyRoot / TEXT("paper_character_meta.json");
				if (IFileManager::Get().Copy(*LegacyMeta, *UserMeta, /*bReplace*/true) == COPY_OK)
				{
					Result.Notes.Add(FString::Printf(TEXT("character_meta 사이드카 적용: %s"), *UserMeta));
				}
				else
				{
					UE_LOG(LogHktWorkspace, Warning,
						TEXT("[PaperBuilder] character_meta 복사 실패: %s → %s"), *UserMeta, *LegacyMeta);
				}
			}
		}

		// 4) anim 별 anim tag native 등록 + legacy workspace 정규화.
		for (const FHktWorkspaceAnimInput& Anim : Entry.Anims)
		{
			FHktWorkspaceTagRegistrar::EnsureTag(Anim.AnimTag);

			TArray<FString> AtlasPaths;
			FString Err;
			if (!NormalizeAnim(Entry.TagString, Anim, AtlasPaths, Err))
			{
				Result.Error = Err;
				return Result;
			}
			Result.Notes.Add(FString::Printf(
				TEXT("anim=%s source=%d atlases=%d"),
				*Anim.AnimTag, (int32)Anim.Source, AtlasPaths.Num()));
		}

		// 5) Paper2D 일괄 빌드.
		const FString OutDir = DefaultPaperOutputDir(SafeChar);
		const FString CharResultJson = UHktPaperSpriteBuilderFunctionLibrary::BuildPaperCharacter(
			Entry.TagString, /*VisualIdentifierTag*/ Entry.TagString,
			PixelToWorld, OutDir);

		TSharedPtr<FJsonObject> CharObj;
		FString CharErr;
		if (!ParseJsonResult(CharResultJson, CharObj, CharErr))
		{
			Result.Error = CharErr;
			return Result;
		}

		// 산출 자산 경로 수집.
		const TArray<TSharedPtr<FJsonValue>>* AnimArr = nullptr;
		if (CharObj->TryGetArrayField(TEXT("anims"), AnimArr))
		{
			for (const TSharedPtr<FJsonValue>& V : *AnimArr)
			{
				const TSharedPtr<FJsonObject>& O = V->AsObject();
				if (!O.IsValid()) continue;

				FString Path;
				if (O->TryGetStringField(TEXT("visualDataAssetPath"), Path)
					&& !Result.OutputAssetPaths.Contains(Path))
				{
					Result.OutputAssetPaths.Add(Path);
				}
				if (O->TryGetStringField(TEXT("characterDataAssetPath"), Path)
					&& !Result.OutputAssetPaths.Contains(Path))
				{
					Result.OutputAssetPaths.Add(Path);
				}

				const TArray<TSharedPtr<FJsonValue>>* AtlasArr = nullptr;
				if (O->TryGetArrayField(TEXT("atlases"), AtlasArr))
				{
					for (const TSharedPtr<FJsonValue>& A : *AtlasArr)
					{
						const FString P = A->AsString();
						if (!P.IsEmpty()) Result.OutputAssetPaths.AddUnique(P);
					}
				}
				const TArray<TSharedPtr<FJsonValue>>* FbArr = nullptr;
				if (O->TryGetArrayField(TEXT("flipbooks"), FbArr))
				{
					for (const TSharedPtr<FJsonValue>& F : *FbArr)
					{
						const FString P = F->AsString();
						if (!P.IsEmpty()) Result.OutputAssetPaths.AddUnique(P);
					}
				}
			}
		}

		Result.bSuccess = true;
		return Result;
	}
}
