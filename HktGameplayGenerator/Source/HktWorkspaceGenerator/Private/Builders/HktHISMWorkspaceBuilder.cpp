// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktHISMWorkspaceBuilder.h"
#include "HktWorkspaceLog.h"
#include "HktWorkspaceTagRegistrar.h"

// 두 진입점만 사용 — 내부 구현은 손대지 않는다.
#include "HktSpriteGeneratorFunctionLibrary.h"

#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "HAL/FileManager.h"

namespace
{
	int32 DirectionNameToIdx(const FString& Name)
	{
		const TCHAR* const* Names = HktWorkspaceConventions::GetDirectionNames();
		for (int32 i = 0; i < HktWorkspaceConventions::NumDirections; ++i)
		{
			if (Name.Equals(Names[i], ESearchCase::IgnoreCase)) return i;
		}
		return INDEX_NONE;
	}

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
			if (OutError.IsEmpty()) OutError = TEXT("HISM 빌더 실패 (원인 미상)");
		}
		return bOk;
	}

	bool EnsureDirExists(const FString& Dir)
	{
		return IFileManager::Get().MakeDirectory(*Dir, /*Tree*/true);
	}

	/** 단일 anim 단위 사이드카 override — entity_meta.json 보다 우선. */
	struct FHISMSidecarAnim
	{
		bool  bHasFrameDurationMs = false;
		float FrameDurationMs     = 0.f;
		bool  bHasLooping         = false;
		bool  bLooping            = true;
		bool  bHasCellW           = false;
		int32 CellW               = 0;
		bool  bHasCellH           = false;
		int32 CellH               = 0;
	};

	/** Atlas 모드 — anim_meta.json 의 cellW/cellH/frameCount + anim override 추출. */
	struct FHISMAtlasMeta
	{
		int32 CellW = 0;
		int32 CellH = 0;
		int32 FrameCount = 0;
	};

	bool ReadAnimSidecar(
		const FString& UserAnimFolder,
		const TArray<FString>& Directions,
		TMap<int32, FHISMAtlasMeta>& OutByDir,
		FHISMSidecarAnim& OutOverride)
	{
		const FString MetaPath = UserAnimFolder / TEXT("anim_meta.json");
		if (!FPaths::FileExists(MetaPath)) return false;

		FString Json;
		if (!FFileHelper::LoadFileToString(Json, *MetaPath)) return false;

		TSharedPtr<FJsonObject> Root;
		const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Json);
		if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid()) return false;

		// anim 단위 override.
		{
			double D = 0.0;
			if (Root->TryGetNumberField(TEXT("frameDurationMs"), D) && D > 0.0)
			{
				OutOverride.bHasFrameDurationMs = true;
				OutOverride.FrameDurationMs    = (float)D;
			}
			bool B = false;
			if (Root->TryGetBoolField(TEXT("looping"), B) || Root->TryGetBoolField(TEXT("bLooping"), B))
			{
				OutOverride.bHasLooping = true;
				OutOverride.bLooping    = B;
			}
			int32 Cw = 0, Ch = 0;
			if (Root->TryGetNumberField(TEXT("cellW"), Cw) && Cw > 0)
			{
				OutOverride.bHasCellW = true;
				OutOverride.CellW     = Cw;
			}
			if (Root->TryGetNumberField(TEXT("cellH"), Ch) && Ch > 0)
			{
				OutOverride.bHasCellH = true;
				OutOverride.CellH     = Ch;
			}
		}

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

				FHISMAtlasMeta E;
				O->TryGetNumberField(TEXT("cellW"),      E.CellW);
				O->TryGetNumberField(TEXT("cellH"),      E.CellH);
				O->TryGetNumberField(TEXT("frameCount"), E.FrameCount);
				if (E.CellW > 0 && E.CellH > 0)
				{
					OutByDir.Add(Idx, E);
				}

				// directions 원소 내부의 frameDurationMs/looping 도 anim 단위 override 로 채택
				// (root 에 명시되지 않은 schema A 형식 대응). 첫 유효값 채택.
				if (!OutOverride.bHasFrameDurationMs)
				{
					double D = 0.0;
					if (O->TryGetNumberField(TEXT("frameDurationMs"), D) && D > 0.0)
					{
						OutOverride.bHasFrameDurationMs = true;
						OutOverride.FrameDurationMs    = (float)D;
					}
				}
				if (!OutOverride.bHasLooping)
				{
					bool B = false;
					if (O->TryGetBoolField(TEXT("looping"), B) || O->TryGetBoolField(TEXT("bLooping"), B))
					{
						OutOverride.bHasLooping = true;
						OutOverride.bLooping    = B;
					}
				}
			}
			if (OutByDir.Num() > 0) return true;
		}

		// (B) flat cellW/cellH(+frameCount) — 모든 방향에 동일 적용.
		if (OutOverride.bHasCellW && OutOverride.bHasCellH)
		{
			int32 FrameCount = 0;
			Root->TryGetNumberField(TEXT("frameCount"), FrameCount);
			for (const FString& DirName : Directions)
			{
				const int32 Idx = DirectionNameToIdx(DirName);
				if (Idx == INDEX_NONE) continue;
				FHISMAtlasMeta E;
				E.CellW      = OutOverride.CellW;
				E.CellH      = OutOverride.CellH;
				E.FrameCount = FrameCount;
				OutByDir.Add(Idx, E);
			}
		}
		return OutByDir.Num() > 0;
	}

	FString Sanitize(const FString& In)
	{
		return In.Replace(TEXT("."), TEXT("_"));
	}

	/**
	 * Workspace anim → BuildSpriteAnim 입력(FHktSpriteAnimAtlasInput[]) 직접 생성.
	 * legacy 경로 경유·atlas_meta.json 쓰기 없음 — 워크스페이스가 진실 소스.
	 *
	 *   Atlas         : 워크스페이스 PNG 를 그대로 참조 (복사 X).
	 *                   cell/frame 은 anim_meta.json 에서, anim 단위 override 도 함께.
	 *   FrameSequence : `{TagFolder}/.cache/{SafeAnim}/atlas_{Dir}.png` 로 패킹.
	 *                   패킹 결과 cell/frame 을 그대로 입력에 담음.
	 *   Video         : 미지원 — TODO.
	 */
	bool NormalizeAnim(
		const FHktWorkspaceAnimInput& Anim,
		const FString& WorkspaceTagFolder,
		TArray<FHktSpriteAnimAtlasInput>& OutInputs,
		FHISMSidecarAnim& OutOverride,
		FString& OutError)
	{
		const FString SafeAnim = Sanitize(Anim.AnimTag);

		switch (Anim.Source)
		{
			case EHktWorkspaceAnimSource::Atlas:
			{
				TMap<int32, FHISMAtlasMeta> Sidecar;
				if (!Anim.FolderPath.IsEmpty())
				{
					ReadAnimSidecar(Anim.FolderPath, Anim.Directions, Sidecar, OutOverride);
				}

				for (int32 i = 0; i < Anim.SourcePaths.Num(); ++i)
				{
					const FString& Src     = Anim.SourcePaths[i];
					const FString  DirName = Anim.Directions.IsValidIndex(i) ? Anim.Directions[i] : FString();
					const int32 Idx = DirectionNameToIdx(DirName);
					if (Idx == INDEX_NONE)
					{
						UE_LOG(LogHktWorkspace, Warning,
							TEXT("[HISMBuilder] dir 인식 실패: '%s' (anim=%s) — skip"),
							*DirName, *Anim.AnimTag);
						continue;
					}
					if (!FPaths::FileExists(Src))
					{
						OutError = FString::Printf(TEXT("atlas PNG 없음: %s"), *Src);
						return false;
					}

					FHktSpriteAnimAtlasInput In;
					In.DirIdx  = Idx;
					In.PngPath = Src;
					if (const FHISMAtlasMeta* M = Sidecar.Find(Idx))
					{
						In.CellW      = M->CellW;
						In.CellH      = M->CellH;
						In.FrameCount = M->FrameCount;
					}
					OutInputs.Add(MoveTemp(In));
				}
				return true;
			}

			case EHktWorkspaceAnimSource::FrameSequence:
			{
				const FString CacheRoot = WorkspaceTagFolder / TEXT(".cache") / SafeAnim;
				EnsureDirExists(CacheRoot);

				// anim 단위 override (frameDurationMs/looping/cellW/cellH) — anim 폴더 사이드카에서.
				if (!Anim.FolderPath.IsEmpty())
				{
					TMap<int32, FHISMAtlasMeta> Ignored;
					ReadAnimSidecar(Anim.FolderPath, Anim.Directions, Ignored, OutOverride);
				}

				for (int32 i = 0; i < Anim.SourcePaths.Num(); ++i)
				{
					const FString& InputDir = Anim.SourcePaths[i];
					const FString  DirName  = Anim.Directions.IsValidIndex(i) ? Anim.Directions[i] : FString();
					const int32 Idx = DirectionNameToIdx(DirName);
					if (Idx == INDEX_NONE)
					{
						UE_LOG(LogHktWorkspace, Warning,
							TEXT("[HISMBuilder] dir 인식 실패(frame seq): '%s' (anim=%s) — skip"),
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

					FHktSpriteAnimAtlasInput In;
					In.DirIdx  = Idx;
					In.PngPath = Dest;
					Obj->TryGetNumberField(TEXT("cellW"),      In.CellW);
					Obj->TryGetNumberField(TEXT("cellH"),      In.CellH);
					Obj->TryGetNumberField(TEXT("frameCount"), In.FrameCount);
					OutInputs.Add(MoveTemp(In));
				}
				return true;
			}

			case EHktWorkspaceAnimSource::Video:
			default:
				OutError = TEXT("HISM Video 모드는 미지원 (TODO)");
				return false;
		}
	}
}

namespace HktHISMWorkspaceBuilder
{
	FHktPaperBuildResult BuildEntry(
		const FHktWorkspaceTagEntry& Entry,
		float PixelToWorld)
	{
		FHktPaperBuildResult Result;

		// 1) Tag 등록 보장.
		FString TagNote;
		const FGameplayTag Tag = FHktWorkspaceTagRegistrar::EnsureTag(Entry.TagString, &TagNote);
		Result.Notes.Add(FString::Printf(TEXT("tag=%s (%s)"), *Entry.TagString, *TagNote));
		if (!Tag.IsValid())
		{
			Result.Error = FString::Printf(TEXT("GameplayTag 등록 실패: %s"), *Entry.TagString);
			return Result;
		}

		// 2) StaticVisual 분기 — 단일 PNG → UHktHISMSpriteVisualAsset.
		if (Entry.Mode == EHktWorkspaceTagMode::StaticVisual)
		{
			if (Entry.StaticImagePath.IsEmpty() || !FPaths::FileExists(Entry.StaticImagePath))
			{
				Result.Error = FString::Printf(TEXT("StaticVisual 입력 PNG 없음: %s"), *Entry.StaticImagePath);
				return Result;
			}

			const FString JsonStr = UHktSpriteGeneratorFunctionLibrary::EditorBuildHISMStaticVisual(
				Entry.TagString, Entry.StaticImagePath, PixelToWorld, /*OutputDir*/ TEXT(""));

			TSharedPtr<FJsonObject> Obj;
			FString Err;
			if (!ParseJsonResult(JsonStr, Obj, Err))
			{
				Result.Error = Err;
				return Result;
			}

			FString Path;
			if (Obj->TryGetStringField(TEXT("visualPath"),  Path)) Result.OutputAssetPaths.Add(Path);
			if (Obj->TryGetStringField(TEXT("texturePath"), Path)) Result.OutputAssetPaths.Add(Path);

			Result.bSuccess = true;
			Result.Notes.Add(FString::Printf(TEXT("mode=StaticVisual src=%s"), *Entry.StaticImagePath));
			return Result;
		}

		if (Entry.Mode != EHktWorkspaceTagMode::Character)
		{
			Result.Error = TEXT("HISM: Mode 가 Character 도 StaticVisual 도 아님 — 스캐너 결과 확인 필요");
			return Result;
		}

		if (Entry.Anims.Num() == 0)
		{
			Result.Error = TEXT("HISM Character 모드인데 anim 입력이 없음");
			return Result;
		}

		// 3) entity_meta.json — anim 기본 인자. PixelToWorld + frameDurationMs/looping/mirrorWestFromEast
		//    를 char 단위 디폴트로 캡처. anim_meta.json 의 override 가 있으면 anim 별로 우선 적용.
		float ResolvedP2W = PixelToWorld;
		bool  bEntityHasFrameDurationMs = false;
		float EntityFrameDurationMs     = 0.f;
		bool  bEntityHasLooping         = false;
		bool  bEntityLooping            = true;
		bool  bEntityHasMirrorWFE       = false;
		bool  bEntityMirrorWFE          = true;
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
						if (MetaObj->TryGetNumberField(TEXT("pixelToWorld"), D) && D > 0.0)
						{
							ResolvedP2W = (float)D;
						}
						if (MetaObj->TryGetNumberField(TEXT("frameDurationMs"), D) && D > 0.0)
						{
							bEntityHasFrameDurationMs = true;
							EntityFrameDurationMs    = (float)D;
						}
						bool B = false;
						if (MetaObj->TryGetBoolField(TEXT("looping"), B) || MetaObj->TryGetBoolField(TEXT("bLooping"), B))
						{
							bEntityHasLooping = true;
							bEntityLooping    = B;
						}
						if (MetaObj->TryGetBoolField(TEXT("mirrorWestFromEast"), B)
							|| MetaObj->TryGetBoolField(TEXT("bMirrorWestFromEast"), B))
						{
							bEntityHasMirrorWFE = true;
							bEntityMirrorWFE    = B;
						}
					}
				}
			}
		}

		// 4) anim 별 bridge → BuildSpriteAnim.
		int32 AnimOkCount = 0;
		FString DataAssetPath;
		for (const FHktWorkspaceAnimInput& Anim : Entry.Anims)
		{
			FHktWorkspaceTagRegistrar::EnsureTag(Anim.AnimTag);

			TArray<FHktSpriteAnimAtlasInput> AtlasInputs;
			FHISMSidecarAnim AnimOverride;
			FString Err;
			if (!NormalizeAnim(Anim, Entry.FolderPath, AtlasInputs, AnimOverride, Err))
			{
				UE_LOG(LogHktWorkspace, Warning,
					TEXT("[HISMBuilder] anim normalize 실패 (%s): %s"), *Anim.AnimTag, *Err);
				Result.Notes.Add(FString::Printf(TEXT("anim normalize 실패: %s — %s"), *Anim.AnimTag, *Err));
				continue;
			}

			// CellW/CellH override 우선순위: anim 사이드카 root override > AtlasInputs 첫 항목 > 0(BuildSpriteAnim 폴백).
			int32 CellW = 0, CellH = 0;
			if (AnimOverride.bHasCellW) CellW = AnimOverride.CellW;
			if (AnimOverride.bHasCellH) CellH = AnimOverride.CellH;
			if ((CellW <= 0 || CellH <= 0) && AtlasInputs.Num() > 0)
			{
				for (const FHktSpriteAnimAtlasInput& In : AtlasInputs)
				{
					if (CellW <= 0) CellW = In.CellW;
					if (CellH <= 0) CellH = In.CellH;
					if (CellW > 0 && CellH > 0) break;
				}
			}

			// 해상도: anim 사이드카 override > entity_meta 기본 > BuildSpriteAnim 내부 디폴트(0/-1).
			const float ResolvedFrameDurMs =
				AnimOverride.bHasFrameDurationMs ? AnimOverride.FrameDurationMs
				: (bEntityHasFrameDurationMs    ? EntityFrameDurationMs : 0.f);
			const int32 ResolvedLoopingTri =
				AnimOverride.bHasLooping ? (AnimOverride.bLooping ? 1 : 0)
				: (bEntityHasLooping     ? (bEntityLooping ? 1 : 0) : -1);
			const int32 ResolvedMirrorTri =
				bEntityHasMirrorWFE ? (bEntityMirrorWFE ? 1 : 0) : -1;

			const FString JsonStr = UHktSpriteGeneratorFunctionLibrary::BuildSpriteAnim(
				Entry.TagString, Anim.AnimTag, AtlasInputs, CellW, CellH, ResolvedP2W,
				ResolvedFrameDurMs, ResolvedLoopingTri, ResolvedMirrorTri);

			TSharedPtr<FJsonObject> Obj;
			FString BErr;
			if (!ParseJsonResult(JsonStr, Obj, BErr))
			{
				UE_LOG(LogHktWorkspace, Warning,
					TEXT("[HISMBuilder] BuildSpriteAnim 실패 (%s): %s"), *Anim.AnimTag, *BErr);
				Result.Notes.Add(FString::Printf(TEXT("BuildSpriteAnim 실패: %s — %s"), *Anim.AnimTag, *BErr));
				continue;
			}

			++AnimOkCount;
			FString Path;
			if (Obj->TryGetStringField(TEXT("dataAssetPath"), Path))
			{
				Result.OutputAssetPaths.AddUnique(Path);
				DataAssetPath = Path;
			}

			Result.Notes.Add(FString::Printf(
				TEXT("anim=%s source=%d cell=%dx%d"),
				*Anim.AnimTag, (int32)Anim.Source, CellW, CellH));
		}

		if (AnimOkCount == 0)
		{
			Result.Error = TEXT("HISM: 모든 anim 빌드 실패");
			return Result;
		}

		Result.bSuccess = true;
		return Result;
	}
}
