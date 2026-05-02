// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktPaperWorkspaceScanner.h"
#include "HktPaper2DGeneratorLog.h"

#include "HktSpriteGeneratorFunctionLibrary.h"

#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "HAL/FileManager.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Dom/JsonObject.h"

namespace HktPaperWorkspace
{
	// HktSpriteGenerator 의 kDirNamesNS 와 정확히 일치 (N..NW).
	static const TCHAR* const kDirNames[8] = {
		TEXT("N"), TEXT("NE"), TEXT("E"), TEXT("SE"),
		TEXT("S"), TEXT("SW"), TEXT("W"), TEXT("NW")
	};

	const TCHAR* GetDirectionName(int32 DirIdx)
	{
		return kDirNames[FMath::Clamp(DirIdx, 0, 7)];
	}

	bool DiscoverAnimNames(const FString& CharacterTagStr, TArray<FString>& OutAnimSafeNames)
	{
		OutAnimSafeNames.Reset();

		const FString Root = UHktSpriteGeneratorFunctionLibrary::GetConventionBundleRoot(CharacterTagStr);
		if (Root.IsEmpty() || !IFileManager::Get().DirectoryExists(*Root))
		{
			UE_LOG(LogHktPaper2DGenerator, Warning,
				TEXT("[HktPaperWorkspace] Workspace root 없음: %s"), *Root);
			return false;
		}

		// 자식 디렉터리 = anim 폴더 (SafeAnim 이름).
		TArray<FString> Subdirs;
		IFileManager::Get().FindFiles(Subdirs, *(Root / TEXT("*")), /*Files*/ false, /*Dirs*/ true);
		Subdirs.Sort();
		OutAnimSafeNames = MoveTemp(Subdirs);
		return OutAnimSafeNames.Num() > 0;
	}

	bool LoadAtlasMeta(const FString& MetaJsonPath, TArray<FDirMeta>& OutDirs)
	{
		OutDirs.Reset();

		if (!FPaths::FileExists(MetaJsonPath))
		{
			return false;
		}
		FString Json;
		if (!FFileHelper::LoadFileToString(Json, *MetaJsonPath))
		{
			return false;
		}
		TSharedPtr<FJsonObject> Root;
		const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Json);
		if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
		{
			return false;
		}

		const TArray<TSharedPtr<FJsonValue>>* Dirs = nullptr;
		if (!Root->TryGetArrayField(TEXT("directions"), Dirs))
		{
			return false;
		}

		for (const TSharedPtr<FJsonValue>& V : *Dirs)
		{
			const TSharedPtr<FJsonObject>& O = V->AsObject();
			if (!O.IsValid())
			{
				continue;
			}
			const FString DirName = O->GetStringField(TEXT("dir"));
			int32 DirIdx = -1;
			for (int32 i = 0; i < 8; ++i)
			{
				if (DirName == kDirNames[i]) { DirIdx = i; break; }
			}
			if (DirIdx < 0)
			{
				continue;
			}
			FDirMeta M;
			M.DirIdx     = DirIdx;
			M.CellW      = O->GetIntegerField(TEXT("cellW"));
			M.CellH      = O->GetIntegerField(TEXT("cellH"));
			M.FrameCount = O->GetIntegerField(TEXT("frameCount"));
			OutDirs.Add(M);
		}
		return OutDirs.Num() > 0;
	}
}
