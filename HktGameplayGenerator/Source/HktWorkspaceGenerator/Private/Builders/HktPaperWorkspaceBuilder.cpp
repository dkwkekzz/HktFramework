// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktPaperWorkspaceBuilder.h"
#include "HktWorkspaceLog.h"
#include "HktWorkspaceScanner.h"
#include "HktWorkspaceTagRegistrar.h"

// HktPaper2DGenerator 의 빌더 — 더 이상 UFUNCTION 진입점을 거치지 않는다.
#include "HktPaperAssetBuilder.h"
#include "HktPaperSpriteBuilderFunctionLibrary.h"  // BuildPaperStaticVisual (UFUNCTION 으로 유지)
#include "HktPaperAnimationDataAsset.h"
#include "HktPaperActorVisualDataAsset.h"
#include "HktSpriteGeneratorFunctionLibrary.h"

#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "HAL/FileManager.h"
#include "UObject/Package.h"

namespace
{
	/** Tag/Anim 문자열에서 GameplayTag → 디스크 경로용 안전 문자열 변환 ('.' → '_'). */
	FString Sanitize(const FString& In)
	{
		return In.Replace(TEXT("."), TEXT("_"));
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

	/** "N"|"NE"|... → 0..7. 실패 시 INDEX_NONE. */
	int32 DirectionNameToIdx(const FString& Name)
	{
		const TCHAR* const* Names = HktWorkspaceConventions::GetDirectionNames();
		for (int32 i = 0; i < HktWorkspaceConventions::NumDirections; ++i)
		{
			if (Name.Equals(Names[i], ESearchCase::IgnoreCase)) return i;
		}
		return INDEX_NONE;
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
	 * Atlas 모드 사용자 사이드카(anim_meta.json) → dir 별 cellW/cellH/frameCount + anim 단위 override.
	 *  - (A) `directions:[{dir,cellW,cellH,frameCount}, ...]` 스키마면 그대로 채택.
	 *  - (B) 단일 `cellW`/`cellH`(+frameCount) 면 모든 SourceAtlas 에 동일 적용.
	 * 결과는 dir 인덱스(0..7) → cell/frame 맵.
	 */
	struct FSidecarDir
	{
		int32 CellW = 0;
		int32 CellH = 0;
		int32 FrameCount = 0;
	};

	/** anim 단위 override — entity_meta.json 의 값보다 우선. 미지정(false) 이면 캐릭터/디폴트 사용. */
	struct FSidecarAnim
	{
		bool  bHasFrameDurationMs = false;
		float FrameDurationMs     = 0.f;
		bool  bHasLooping         = false;
		bool  bLooping            = true;
	};

	/** anim 폴더의 `anim_meta.json` 을 파싱해 root 객체 반환. 없으면 nullptr. */
	TSharedPtr<FJsonObject> LoadAnimMetaJson(const FString& UserAnimFolder)
	{
		const FString MetaPath = UserAnimFolder / TEXT("anim_meta.json");
		if (!FPaths::FileExists(MetaPath)) return nullptr;

		FString Json;
		if (!FFileHelper::LoadFileToString(Json, *MetaPath)) return nullptr;

		TSharedPtr<FJsonObject> Root;
		const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Json);
		if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid()) return nullptr;
		return Root;
	}

	/** anim_meta.json 루트의 frameDurationMs/looping → FSidecarAnim 채움. */
	void ApplyAnimRootOverride(const TSharedPtr<FJsonObject>& Root, FSidecarAnim& Out)
	{
		if (!Root.IsValid()) return;
		double D = 0.0;
		if (Root->TryGetNumberField(TEXT("frameDurationMs"), D) && D > 0.0)
		{
			Out.bHasFrameDurationMs = true;
			Out.FrameDurationMs    = (float)D;
		}
		bool B = false;
		if (Root->TryGetBoolField(TEXT("looping"), B) || Root->TryGetBoolField(TEXT("bLooping"), B))
		{
			Out.bHasLooping = true;
			Out.bLooping    = B;
		}
	}

	bool ReadAtlasSidecar(
		const FString& UserAnimFolder,
		const TArray<FString>& SourceAtlasPaths,
		const TArray<FString>& Directions,
		TMap<int32, FSidecarDir>& OutByDir,
		FSidecarAnim& OutAnimOverride)
	{
		TSharedPtr<FJsonObject> Root = LoadAnimMetaJson(UserAnimFolder);
		if (!Root.IsValid()) return false;

		// anim 단위 override — schema (A)/(B) 어느 쪽이든 루트에 frameDurationMs/looping 이 있으면
		// 해당 anim 의 빌드 인자를 캐릭터 기본보다 우선해 덮어쓴다.
		ApplyAnimRootOverride(Root, OutAnimOverride);

		// (A) directions 배열.
		const TArray<TSharedPtr<FJsonValue>>* DirArr = nullptr;
		if (Root->TryGetArrayField(TEXT("directions"), DirArr))
		{
			for (const TSharedPtr<FJsonValue>& V : *DirArr)
			{
				const TSharedPtr<FJsonObject>& O = V->AsObject();
				if (!O.IsValid()) continue;

				FString DirName;
				O->TryGetStringField(TEXT("dir"), DirName);
				const int32 Idx = DirectionNameToIdx(DirName);
				if (Idx == INDEX_NONE) continue;

				FSidecarDir E;
				O->TryGetNumberField(TEXT("cellW"),      E.CellW);
				O->TryGetNumberField(TEXT("cellH"),      E.CellH);
				O->TryGetNumberField(TEXT("frameCount"), E.FrameCount);
				if (E.CellW > 0 && E.CellH > 0)
				{
					OutByDir.Add(Idx, E);
				}

				// directions 원소 안의 frameDurationMs / looping 도 anim 단위 override 로 채택.
				// 빌더가 dir 별 frameDuration 을 받지 않으므로 첫 유효값만 사용 (보통 모든 dir 동일).
				if (!OutAnimOverride.bHasFrameDurationMs)
				{
					double D = 0.0;
					if (O->TryGetNumberField(TEXT("frameDurationMs"), D) && D > 0.0)
					{
						OutAnimOverride.bHasFrameDurationMs = true;
						OutAnimOverride.FrameDurationMs    = (float)D;
					}
				}
				if (!OutAnimOverride.bHasLooping)
				{
					bool B = false;
					if (O->TryGetBoolField(TEXT("looping"), B) || O->TryGetBoolField(TEXT("bLooping"), B))
					{
						OutAnimOverride.bHasLooping = true;
						OutAnimOverride.bLooping    = B;
					}
				}
			}
			return OutByDir.Num() > 0;
		}

		// (B) flat cellW/cellH(+frameCount).
		int32 CellW = 0, CellH = 0, FrameCount = 0;
		Root->TryGetNumberField(TEXT("cellW"),      CellW);
		Root->TryGetNumberField(TEXT("cellH"),      CellH);
		Root->TryGetNumberField(TEXT("frameCount"), FrameCount);
		if (CellW <= 0 || CellH <= 0) return false;

		for (int32 i = 0; i < SourceAtlasPaths.Num(); ++i)
		{
			const FString DirName = Directions.IsValidIndex(i) ? Directions[i] : TEXT("E");
			const int32 Idx = DirectionNameToIdx(DirName);
			if (Idx == INDEX_NONE) continue;

			FSidecarDir E;
			E.CellW      = CellW;
			E.CellH      = CellH;
			E.FrameCount = FrameCount;
			OutByDir.Add(Idx, E);
		}
		return OutByDir.Num() > 0;
	}

	/**
	 * 워크스페이스 anim 입력 → FAnimAtlasInput 배열로 정규화.
	 *
	 * Atlas         : 워크스페이스 PNG 를 그대로 참조 — 복사 없음. 사이드카에서 cell/frame 추출.
	 * FrameSequence : 워크스페이스 anim 폴더 안의 `.cache/atlas_{Dir}.png` 로 패킹 →
	 *                 패킹 결과 cell/frame 을 그대로 입력에 담음.
	 * Video         : 미지원 — TODO.
	 */
	bool NormalizeAnim(
		const FHktWorkspaceAnimInput& Anim,
		const FString& WorkspaceTagFolder,
		TArray<HktPaperAssetBuilder::FAnimAtlasInput>& OutInputs,
		FSidecarAnim& OutAnimOverride,
		FString& OutError)
	{
		const FString SafeAnim = Sanitize(Anim.AnimTag);

		switch (Anim.Source)
		{
			case EHktWorkspaceAnimSource::Atlas:
			{
				// 사이드카 로드 — cell/frame + anim 단위 override.
				TMap<int32, FSidecarDir> Sidecar;
				if (!Anim.FolderPath.IsEmpty())
				{
					ReadAtlasSidecar(Anim.FolderPath, Anim.SourcePaths, Anim.Directions, Sidecar, OutAnimOverride);
				}

				for (int32 i = 0; i < Anim.SourcePaths.Num(); ++i)
				{
					const FString& Src = Anim.SourcePaths[i];
					const FString  DirName = Anim.Directions.IsValidIndex(i) ? Anim.Directions[i] : FString();
					const int32 Idx = DirectionNameToIdx(DirName);
					if (Idx == INDEX_NONE)
					{
						UE_LOG(LogHktWorkspace, Warning,
							TEXT("[PaperBuilder] dir 이름 인식 실패: '%s' (anim=%s) — skip"),
							*DirName, *Anim.AnimTag);
						continue;
					}
					if (!FPaths::FileExists(Src))
					{
						OutError = FString::Printf(TEXT("atlas PNG 없음: %s"), *Src);
						return false;
					}

					HktPaperAssetBuilder::FAnimAtlasInput E;
					E.DirIdx  = Idx;
					E.PngPath = Src;
					if (const FSidecarDir* M = Sidecar.Find(Idx))
					{
						E.CellW      = M->CellW;
						E.CellH      = M->CellH;
						E.FrameCount = M->FrameCount;
					}
					OutInputs.Add(MoveTemp(E));
				}
				return true;
			}

			case EHktWorkspaceAnimSource::FrameSequence:
			{
				// 패킹 산출은 워크스페이스 안의 `.cache/{SafeAnim}/atlas_{Dir}.png` 에 둔다 —
				// 입력 폴더(원본 frame 시퀀스)는 건드리지 않고, 캐시 폴더만 빌더가 관리.
				const FString CacheRoot = WorkspaceTagFolder / TEXT(".cache") / SafeAnim;
				EnsureDirExists(CacheRoot);

				// anim 단위 override (frameDurationMs/looping) — anim 폴더의 anim_meta.json 에서 읽음.
				// FrameSequence 는 cell/frame 을 패킹 결과에서 얻으므로 사이드카는 메타 override 만 담당.
				if (!Anim.FolderPath.IsEmpty())
				{
					ApplyAnimRootOverride(LoadAnimMetaJson(Anim.FolderPath), OutAnimOverride);
				}

				for (int32 i = 0; i < Anim.SourcePaths.Num(); ++i)
				{
					const FString& InputDir = Anim.SourcePaths[i];
					const FString  DirName  = Anim.Directions.IsValidIndex(i) ? Anim.Directions[i] : FString();
					const int32 Idx = DirectionNameToIdx(DirName);
					if (Idx == INDEX_NONE)
					{
						UE_LOG(LogHktWorkspace, Warning,
							TEXT("[PaperBuilder] dir 이름 인식 실패(frame seq): '%s' (anim=%s) — skip"),
							*DirName, *Anim.AnimTag);
						continue;
					}

					const FString Dest = CacheRoot / FString::Printf(TEXT("atlas_%s.png"), *DirName.ToUpper());
					const FString PackJson = UHktSpriteGeneratorFunctionLibrary::EditorPackBundleFolderToAtlasPng(
						InputDir, Dest, /*MaxAtlasPixelWidth*/ 0);

					TSharedPtr<FJsonObject> Obj;
					FString Err;
					if (!ParseJsonResult(PackJson, Obj, Err))
					{
						OutError = FString::Printf(TEXT("frame→atlas 패킹 실패(%s): %s"), *DirName, *Err);
						return false;
					}

					HktPaperAssetBuilder::FAnimAtlasInput E;
					E.DirIdx  = Idx;
					E.PngPath = Dest;
					Obj->TryGetNumberField(TEXT("cellW"),      E.CellW);
					Obj->TryGetNumberField(TEXT("cellH"),      E.CellH);
					Obj->TryGetNumberField(TEXT("frameCount"), E.FrameCount);
					OutInputs.Add(MoveTemp(E));
				}
				return true;
			}

			case EHktWorkspaceAnimSource::Video:
			{
				// TODO: EditorExtractAtlasAndBundle 가 legacy 컨벤션 폴더에 산출하도록 돼있음.
				// 워크스페이스 일원화에 맞춰 새 추출 경로(또는 워크스페이스로 복사 단계)가 필요.
				// 현재는 미지원으로 명시.
				OutError = TEXT("Video 모드는 워크스페이스 일원화 후 미지원 (TODO)");
				return false;
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

		// 3) 워크스페이스 entity_meta.json 로드 — anim 별 빌드 인자 결정.
		float FrameDurationMs = 100.f;
		bool  bLooping        = true;
		bool  bMirrorWFE      = true;
		float ResolvedP2W     = PixelToWorld;
		{
			const FString UserMeta = Entry.FolderPath / TEXT("entity_meta.json");
			if (FPaths::FileExists(UserMeta))
			{
				FString MetaJson;
				if (FFileHelper::LoadFileToString(MetaJson, *UserMeta))
				{
					TSharedPtr<FJsonObject> MetaObj;
					const TSharedRef<TJsonReader<>> R = TJsonReaderFactory<>::Create(MetaJson);
					if (FJsonSerializer::Deserialize(R, MetaObj) && MetaObj.IsValid())
					{
						double D = 0.0;
						if (MetaObj->TryGetNumberField(TEXT("frameDurationMs"), D) && D > 0.0) FrameDurationMs = (float)D;
						if (MetaObj->TryGetNumberField(TEXT("pixelToWorld"),    D) && D > 0.0) ResolvedP2W     = (float)D;
						bool B = false;
						if (MetaObj->TryGetBoolField(TEXT("looping"), B) || MetaObj->TryGetBoolField(TEXT("bLooping"), B))
							bLooping = B;
						if (MetaObj->TryGetBoolField(TEXT("mirrorWestFromEast"), B)
							|| MetaObj->TryGetBoolField(TEXT("bMirrorWestFromEast"), B))
							bMirrorWFE = B;
					}
				}
			}
		}

		// 4) Visual identifier — 워크스페이스 Tag 자체를 사용 (서버 SpawnEntity 의 VisualTag 와 일치).
		const FGameplayTag VisualIdentTag = Tag;

		// 5) anim 별 normalize → BuildAnim 직접 호출.
		const FString OutDir = DefaultPaperOutputDir(SafeChar);
		int32 AnimOkCount = 0;
		UHktPaperAnimationDataAsset* LastTemplate = nullptr;
		for (const FHktWorkspaceAnimInput& Anim : Entry.Anims)
		{
			FHktWorkspaceTagRegistrar::EnsureTag(Anim.AnimTag);

			TArray<HktPaperAssetBuilder::FAnimAtlasInput> AtlasInputs;
			FSidecarAnim AnimOverride;
			FString Err;
			if (!NormalizeAnim(Anim, Entry.FolderPath, AtlasInputs, AnimOverride, Err))
			{
				UE_LOG(LogHktWorkspace, Warning,
					TEXT("[PaperBuilder] anim normalize 실패 (%s): %s"), *Anim.AnimTag, *Err);
				Result.Notes.Add(FString::Printf(TEXT("anim normalize 실패: %s — %s"), *Anim.AnimTag, *Err));
				continue;
			}

			// anim 단위 override > character 단위 > 디폴트.
			const float ResolvedAnimFrameDurMs = AnimOverride.bHasFrameDurationMs
				? AnimOverride.FrameDurationMs : FrameDurationMs;
			const bool  ResolvedAnimLooping    = AnimOverride.bHasLooping
				? AnimOverride.bLooping : bLooping;

			Result.Notes.Add(FString::Printf(
				TEXT("anim=%s source=%d atlases=%d frameDurMs=%.2f looping=%d"),
				*Anim.AnimTag, (int32)Anim.Source, AtlasInputs.Num(),
				ResolvedAnimFrameDurMs, ResolvedAnimLooping ? 1 : 0));

			HktPaperAssetBuilder::FBuildAnimResult BuildRes = HktPaperAssetBuilder::BuildAnim(
				Entry.TagString, Anim.AnimTag, OutDir,
				AtlasInputs,
				ResolvedP2W, ResolvedAnimFrameDurMs, ResolvedAnimLooping, bMirrorWFE,
				/*CellWidthOverride*/ 0, /*CellHeightOverride*/ 0);

			if (!BuildRes.bSuccess)
			{
				UE_LOG(LogHktWorkspace, Warning,
					TEXT("[PaperBuilder] BuildAnim 실패 (%s): %s"), *Anim.AnimTag, *BuildRes.Error);
				Result.Notes.Add(FString::Printf(TEXT("BuildAnim 실패: %s — %s"), *Anim.AnimTag, *BuildRes.Error));
				continue;
			}
			++AnimOkCount;

			// 산출 자산 경로 수집.
			const FString TemplateName = FString::Printf(TEXT("DA_PaperAnimation_%s"), *SafeChar);
			const FString TemplatePath = OutDir / TemplateName;
			Result.OutputAssetPaths.AddUnique(TemplatePath);
			for (const FString& A : BuildRes.AtlasAssetPaths)    Result.OutputAssetPaths.AddUnique(A);
			for (const FString& F : BuildRes.FlipbookAssetPaths) Result.OutputAssetPaths.AddUnique(F);

			// 다음 단계 Visual upsert 를 위해 Animation 자산 핸들 캐시.
			if (!LastTemplate)
			{
				const FString ObjPath = TemplatePath + TEXT(".") + TemplateName;
				LastTemplate = LoadObject<UHktPaperAnimationDataAsset>(nullptr, *ObjPath);
			}
		}

		if (AnimOkCount == 0)
		{
			Result.Error = TEXT("모든 anim 빌드 실패");
			return Result;
		}

		// 6) Visual DataAsset upsert — 캐릭터당 1회 (모든 anim 빌드 후).
		if (UHktPaperActorVisualDataAsset* Visual = HktPaperAssetBuilder::LoadOrCreateVisual(
				OutDir, SafeChar, VisualIdentTag, LastTemplate))
		{
			HktPaperAssetBuilder::SaveDataAsset(Visual);
			const FString VisualName = FString::Printf(TEXT("DA_PaperVisual_%s"), *SafeChar);
			Result.OutputAssetPaths.AddUnique(OutDir / VisualName);
		}
		else
		{
			UE_LOG(LogHktWorkspace, Warning,
				TEXT("[PaperBuilder] Visual upsert 실패 (char=%s)"), *Entry.TagString);
		}

		Result.bSuccess = true;
		return Result;
	}
}
