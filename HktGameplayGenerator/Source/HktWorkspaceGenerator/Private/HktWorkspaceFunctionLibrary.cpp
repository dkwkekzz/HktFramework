// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktWorkspaceFunctionLibrary.h"
#include "HktWorkspaceLog.h"
#include "HktWorkspaceScanner.h"
#include "HktWorkspaceTagRegistrar.h"
#include "HktWorkspaceManifest.h"
#include "HktWorkspaceSettings.h"
#include "Builders/HktPaperWorkspaceBuilder.h"

#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Serialization/JsonWriter.h"
#include "Serialization/JsonSerializer.h"
#include "Misc/DateTime.h"
#include "HAL/FileManager.h"
#include "Misc/Paths.h"

namespace
{
	FString MakeErrorJson(const FString& Error)
	{
		TSharedPtr<FJsonObject> Root = MakeShared<FJsonObject>();
		Root->SetBoolField(TEXT("success"), false);
		Root->SetStringField(TEXT("error"), Error);
		FString Out;
		const TSharedRef<TJsonWriter<>> W = TJsonWriterFactory<>::Create(&Out);
		FJsonSerializer::Serialize(Root.ToSharedRef(), W);
		return Out;
	}

	FString SerializeJson(const TSharedPtr<FJsonObject>& Root)
	{
		FString Out;
		const TSharedRef<TJsonWriter<TCHAR, TPrettyJsonPrintPolicy<TCHAR>>> W
			= TJsonWriterFactory<TCHAR, TPrettyJsonPrintPolicy<TCHAR>>::Create(&Out);
		FJsonSerializer::Serialize(Root.ToSharedRef(), W);
		return Out;
	}

	TSharedRef<FJsonObject> EntryToJson(const FHktWorkspaceTagEntry& E, bool bUpToDate, const FString& InputsHash)
	{
		TSharedRef<FJsonObject> O = MakeShared<FJsonObject>();
		O->SetStringField(TEXT("category"),  FHktWorkspaceScanner::CategoryToString(E.Category));
		O->SetStringField(TEXT("folderName"), E.FolderName);
		O->SetStringField(TEXT("tag"),       E.TagString);
		O->SetStringField(TEXT("folderPath"), E.FolderPath);
		O->SetBoolField  (TEXT("tagPreRegistered"), E.bTagPreRegistered);
		O->SetBoolField  (TEXT("upToDate"),  bUpToDate);
		O->SetStringField(TEXT("inputsHash"), InputsHash);

		O->SetStringField(TEXT("mode"), HktWorkspaceConventions::TagModeToString(E.Mode));

		if (E.Mode == EHktWorkspaceTagMode::StaticVisual)
		{
			O->SetStringField(TEXT("staticImagePath"), E.StaticImagePath);
		}

		TArray<TSharedPtr<FJsonValue>> Anims;
		for (const FHktWorkspaceAnimInput& A : E.Anims)
		{
			TSharedPtr<FJsonObject> AO = MakeShared<FJsonObject>();
			AO->SetStringField(TEXT("name"),    A.Name);
			AO->SetStringField(TEXT("animTag"), A.AnimTag);
			AO->SetStringField(TEXT("source"),  HktWorkspaceConventions::AnimSourceToString(A.Source));

			TArray<TSharedPtr<FJsonValue>> Dirs;
			for (const FString& D : A.Directions) Dirs.Add(MakeShared<FJsonValueString>(D));
			AO->SetArrayField(TEXT("directions"), Dirs);

			Anims.Add(MakeShared<FJsonValueObject>(AO));
		}
		O->SetArrayField(TEXT("anims"), Anims);
		return O;
	}

	bool IsManifestUpToDate(const FHktWorkspaceTagEntry& Entry, const FString& CurrentHash)
	{
		FHktWorkspaceManifestData Prev;
		if (!FHktWorkspaceManifest::Load(Entry.FolderPath, Prev)) return false;
		return Prev.InputsHash == CurrentHash && !CurrentHash.IsEmpty();
	}

	FHktPaperBuildResult DispatchBuild(const FHktWorkspaceTagEntry& Entry)
	{
		const UHktWorkspaceSettings* Settings = GetDefault<UHktWorkspaceSettings>();
		const float PixelToWorld = Settings ? Settings->Paper2DDefaultPixelToWorld : 2.0f;

		if (Entry.Category == EHktWorkspaceCategory::Paper2D)
		{
			return HktPaperWorkspaceBuilder::BuildEntry(Entry, PixelToWorld);
		}

		FHktPaperBuildResult R;
		R.Error = FString::Printf(TEXT("카테고리 '%s' 빌더 미구현 (1차 범위 외)"),
			*FHktWorkspaceScanner::CategoryToString(Entry.Category));
		return R;
	}

	/**
	 * 한 entry 빌드: 사전 검사 → fresh 면 skip → 빌드 → manifest 갱신.
	 * 결과 JSON 객체는 상위가 집계하기 좋게 tag/folderName/category 필드를 포함.
	 * 반환 카운터: bWasOk (실제 빌드 성공) / bWasSkipped (skip 한 케이스).
	 */
	struct FBuildOutcome
	{
		TSharedRef<FJsonObject> Json = MakeShared<FJsonObject>();
		bool bWasOk      = false;
		bool bWasSkipped = false;
	};

	FBuildOutcome BuildOneEntry(const FHktWorkspaceTagEntry& E, bool bForce)
	{
		FBuildOutcome Out;
		Out.Json->SetStringField(TEXT("tag"),        E.TagString);
		Out.Json->SetStringField(TEXT("folderName"), E.FolderName);
		Out.Json->SetStringField(TEXT("category"),   FHktWorkspaceScanner::CategoryToString(E.Category));

		// 1차 범위: Paper2D 만 빌드. HISM 등 다른 카테고리는 skip 마킹.
		if (E.Category != EHktWorkspaceCategory::Paper2D)
		{
			Out.Json->SetBoolField(TEXT("success"), false);
			Out.Json->SetBoolField(TEXT("skipped"), true);
			Out.Json->SetStringField(TEXT("reason"), TEXT("1차 범위 외 카테고리 — HISM 등은 후속 PR"));
			Out.bWasSkipped = true;
			return Out;
		}

		if (E.Mode == EHktWorkspaceTagMode::Unknown)
		{
			Out.Json->SetBoolField(TEXT("success"), false);
			Out.Json->SetStringField(TEXT("reason"), TEXT("Mode 식별 실패 — 폴더 내용 확인"));
			return Out;
		}

		const FString CurrentHash = FHktWorkspaceManifest::ComputeInputsHash(E);
		const bool bUpToDate = !bForce && IsManifestUpToDate(E, CurrentHash);
		Out.Json->SetStringField(TEXT("inputsHash"), CurrentHash);

		if (bUpToDate)
		{
			Out.Json->SetBoolField(TEXT("success"), true);
			Out.Json->SetBoolField(TEXT("skipped"), true);
			Out.Json->SetStringField(TEXT("reason"), TEXT("manifest up-to-date"));
			Out.bWasSkipped = true;
			return Out;
		}

		const FHktPaperBuildResult Build = DispatchBuild(E);
		Out.Json->SetBoolField(TEXT("success"), Build.bSuccess);
		if (!Build.bSuccess)
		{
			Out.Json->SetStringField(TEXT("error"), Build.Error);
			return Out;
		}

		FHktWorkspaceManifestData Manifest = FHktWorkspaceManifest::MakeDraft(E);
		Manifest.InputsHash    = CurrentHash;
		Manifest.LastBuiltAtIso = FDateTime::UtcNow().ToIso8601();
		Manifest.Outputs       = Build.OutputAssetPaths;
		FHktWorkspaceManifest::Save(E.FolderPath, Manifest);

		TArray<TSharedPtr<FJsonValue>> OutPaths;
		for (const FString& P : Build.OutputAssetPaths) OutPaths.Add(MakeShared<FJsonValueString>(P));
		Out.Json->SetArrayField(TEXT("outputs"), OutPaths);

		TArray<TSharedPtr<FJsonValue>> NoteArr;
		for (const FString& N : Build.Notes) NoteArr.Add(MakeShared<FJsonValueString>(N));
		Out.Json->SetArrayField(TEXT("notes"), NoteArr);

		Out.bWasOk = true;
		return Out;
	}
}

FString UHktWorkspaceFunctionLibrary::ListWorkspaceTags(const FString& WorkspaceRoot)
{
	const FString Root = WorkspaceRoot.IsEmpty()
		? UHktWorkspaceSettings::ResolveWorkspaceRoot() : WorkspaceRoot;

	TArray<FHktWorkspaceTagEntry> Entries;
	FHktWorkspaceScanner::ScanAll(Root, Entries);

	TSharedPtr<FJsonObject> RootObj = MakeShared<FJsonObject>();
	RootObj->SetBoolField  (TEXT("success"),     true);
	RootObj->SetStringField(TEXT("workspaceRoot"), Root);
	RootObj->SetNumberField(TEXT("entryCount"), Entries.Num());

	TArray<TSharedPtr<FJsonValue>> Arr;
	for (const FHktWorkspaceTagEntry& E : Entries)
	{
		const FString Hash = (E.Mode == EHktWorkspaceTagMode::Unknown)
			? FString() : FHktWorkspaceManifest::ComputeInputsHash(E);
		const bool bUpToDate = IsManifestUpToDate(E, Hash);
		Arr.Add(MakeShared<FJsonValueObject>(EntryToJson(E, bUpToDate, Hash)));
	}
	RootObj->SetArrayField(TEXT("entries"), Arr);

	return SerializeJson(RootObj);
}

FString UHktWorkspaceFunctionLibrary::ScanAndBuildAll(const FString& WorkspaceRoot, bool bForce)
{
	const FString Root = WorkspaceRoot.IsEmpty()
		? UHktWorkspaceSettings::ResolveWorkspaceRoot() : WorkspaceRoot;

	TArray<FHktWorkspaceTagEntry> Entries;
	if (!FHktWorkspaceScanner::ScanAll(Root, Entries))
	{
		return MakeErrorJson(FString::Printf(TEXT("Workspace 비어있거나 없음: %s"), *Root));
	}

	TArray<TSharedPtr<FJsonValue>> Results;
	int32 OkCount = 0;
	int32 SkipCount = 0;

	for (const FHktWorkspaceTagEntry& E : Entries)
	{
		FBuildOutcome Out = BuildOneEntry(E, bForce);
		if (Out.bWasOk)      ++OkCount;
		if (Out.bWasSkipped) ++SkipCount;
		Results.Add(MakeShared<FJsonValueObject>(Out.Json));
	}

	TSharedPtr<FJsonObject> RootObj = MakeShared<FJsonObject>();
	RootObj->SetBoolField  (TEXT("success"),     OkCount > 0 || SkipCount == Entries.Num());
	RootObj->SetStringField(TEXT("workspaceRoot"), Root);
	RootObj->SetNumberField(TEXT("entryCount"), Entries.Num());
	RootObj->SetNumberField(TEXT("okCount"),    OkCount);
	RootObj->SetNumberField(TEXT("skipCount"),  SkipCount);
	RootObj->SetArrayField (TEXT("results"),    Results);
	return SerializeJson(RootObj);
}

FString UHktWorkspaceFunctionLibrary::BuildTag(
	const FString& Category,
	const FString& TagFolderName,
	bool bForce,
	const FString& WorkspaceRoot)
{
	const EHktWorkspaceCategory Cat = FHktWorkspaceScanner::CategoryFromString(Category);
	if (Cat == EHktWorkspaceCategory::Unknown)
	{
		return MakeErrorJson(FString::Printf(TEXT("알 수 없는 카테고리: %s"), *Category));
	}
	if (Cat != EHktWorkspaceCategory::Paper2D)
	{
		return MakeErrorJson(FString::Printf(TEXT("카테고리 '%s' 빌더 미구현"), *Category));
	}
	if (TagFolderName.IsEmpty())
	{
		return MakeErrorJson(TEXT("TagFolderName 필수"));
	}

	const FString Root = WorkspaceRoot.IsEmpty()
		? UHktWorkspaceSettings::ResolveWorkspaceRoot() : WorkspaceRoot;
	const FString FolderPath = Root / FHktWorkspaceScanner::CategoryToString(Cat) / TagFolderName;

	if (!IFileManager::Get().DirectoryExists(*FolderPath))
	{
		return MakeErrorJson(FString::Printf(TEXT("Tag 폴더 없음: %s"), *FolderPath));
	}

	FHktWorkspaceTagEntry Entry;
	Entry.Category   = Cat;
	Entry.FolderName = TagFolderName;
	Entry.TagString  = FHktWorkspaceScanner::NormalizeTagFromFolderName(TagFolderName);
	Entry.FolderPath = FolderPath;

	if (!FHktWorkspaceScanner::InspectTagFolder(Cat, FolderPath, Entry))
	{
		return MakeErrorJson(TEXT("Tag 폴더 입력 형식 미인식"));
	}

	FBuildOutcome Out = BuildOneEntry(Entry, bForce);
	return SerializeJson(Out.Json);
}
