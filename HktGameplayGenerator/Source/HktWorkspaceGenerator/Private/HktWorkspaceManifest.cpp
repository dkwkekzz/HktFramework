// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktWorkspaceManifest.h"
#include "HktWorkspaceLog.h"
#include "HktWorkspaceScanner.h"

#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Misc/SecureHash.h"
#include "HAL/FileManager.h"

namespace
{
	FString SourceTypeToStr(EHktWorkspaceAnimSource S)
	{
		switch (S)
		{
			case EHktWorkspaceAnimSource::Atlas:         return TEXT("atlas");
			case EHktWorkspaceAnimSource::FrameSequence: return TEXT("frame_sequence");
			case EHktWorkspaceAnimSource::Video:         return TEXT("video");
			default:                                      return TEXT("none");
		}
	}

	void HashFile(FSHA1& Sha, const FString& Path)
	{
		const FFileStatData Stat = IFileManager::Get().GetStatData(*Path);
		Sha.UpdateWithString(*Path, Path.Len());
		if (Stat.bIsValid)
		{
			const int64 Size = Stat.FileSize;
			Sha.Update(reinterpret_cast<const uint8*>(&Size), sizeof(int64));
			const FDateTime Mtime = Stat.ModificationTime;
			const int64 Ticks = Mtime.GetTicks();
			Sha.Update(reinterpret_cast<const uint8*>(&Ticks), sizeof(int64));
		}
	}

	void HashFolderRecursive(FSHA1& Sha, const FString& Dir)
	{
		TArray<FString> Files;
		IFileManager::Get().FindFilesRecursive(Files, *Dir, TEXT("*.*"), /*Files*/true, /*Dirs*/false);
		Files.Sort();
		for (const FString& F : Files)
		{
			HashFile(Sha, F);
		}
	}
}

FString FHktWorkspaceManifest::GetManifestPath(const FString& TagFolderPath)
{
	return TagFolderPath / TEXT(".workspace.meta.json");
}

FString FHktWorkspaceManifest::ComputeInputsHash(const FHktWorkspaceTagEntry& Entry)
{
	FSHA1 Sha;
	Sha.UpdateWithString(*Entry.TagString, Entry.TagString.Len());

	if (Entry.Mode == EHktWorkspaceTagMode::StaticVisual)
	{
		HashFile(Sha, Entry.StaticImagePath);
	}
	else
	{
		for (const FHktWorkspaceAnimInput& A : Entry.Anims)
		{
			Sha.UpdateWithString(*A.Name, A.Name.Len());
			const FString SrcStr = SourceTypeToStr(A.Source);
			Sha.UpdateWithString(*SrcStr, SrcStr.Len());
			for (const FString& P : A.SourcePaths)
			{
				const FFileStatData Stat = IFileManager::Get().GetStatData(*P);
				if (Stat.bIsValid && !Stat.bIsDirectory)
				{
					HashFile(Sha, P);
				}
				else if (Stat.bIsValid && Stat.bIsDirectory)
				{
					HashFolderRecursive(Sha, P);
				}
				else
				{
					HashFile(Sha, P); // 경로 자체는 해시.
				}
			}
		}
	}

	Sha.Final();
	uint8 Digest[20];
	Sha.GetHash(Digest);
	return BytesToHex(Digest, 20);
}

FHktWorkspaceManifestData FHktWorkspaceManifest::MakeDraft(const FHktWorkspaceTagEntry& Entry)
{
	FHktWorkspaceManifestData D;
	D.TagString  = Entry.TagString;
	D.Category   = FHktWorkspaceScanner::CategoryToString(Entry.Category);
	D.InputsHash = ComputeInputsHash(Entry);
	D.Version    = 1;

	for (const FHktWorkspaceAnimInput& A : Entry.Anims)
	{
		FHktWorkspaceManifestData::FAnimEntry AE;
		AE.Name       = A.Name;
		AE.Source     = SourceTypeToStr(A.Source);
		AE.Directions = A.Directions;
		D.Anims.Add(MoveTemp(AE));
	}
	return D;
}

bool FHktWorkspaceManifest::Load(const FString& TagFolderPath, FHktWorkspaceManifestData& OutData)
{
	const FString Path = GetManifestPath(TagFolderPath);
	if (!FPaths::FileExists(Path)) return false;

	FString Json;
	if (!FFileHelper::LoadFileToString(Json, *Path)) return false;

	TSharedPtr<FJsonObject> Root;
	const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Json);
	if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid()) return false;

	Root->TryGetStringField(TEXT("tag"),          OutData.TagString);
	Root->TryGetStringField(TEXT("category"),     OutData.Category);
	Root->TryGetStringField(TEXT("lastBuiltAt"),  OutData.LastBuiltAtIso);
	Root->TryGetStringField(TEXT("inputsHash"),   OutData.InputsHash);
	int32 Ver = 1;
	Root->TryGetNumberField(TEXT("version"), Ver);
	OutData.Version = Ver;

	const TArray<TSharedPtr<FJsonValue>>* OutArr = nullptr;
	if (Root->TryGetArrayField(TEXT("outputs"), OutArr))
	{
		for (const TSharedPtr<FJsonValue>& V : *OutArr)
		{
			OutData.Outputs.Add(V->AsString());
		}
	}

	const TArray<TSharedPtr<FJsonValue>>* AnimArr = nullptr;
	if (Root->TryGetArrayField(TEXT("anims"), AnimArr))
	{
		for (const TSharedPtr<FJsonValue>& V : *AnimArr)
		{
			const TSharedPtr<FJsonObject>& O = V->AsObject();
			if (!O.IsValid()) continue;
			FHktWorkspaceManifestData::FAnimEntry AE;
			O->TryGetStringField(TEXT("name"),   AE.Name);
			O->TryGetStringField(TEXT("source"), AE.Source);
			const TArray<TSharedPtr<FJsonValue>>* DirArr = nullptr;
			if (O->TryGetArrayField(TEXT("directions"), DirArr))
			{
				for (const TSharedPtr<FJsonValue>& D : *DirArr)
				{
					AE.Directions.Add(D->AsString());
				}
			}
			OutData.Anims.Add(MoveTemp(AE));
		}
	}
	return true;
}

bool FHktWorkspaceManifest::Save(const FString& TagFolderPath, const FHktWorkspaceManifestData& Data)
{
	TSharedPtr<FJsonObject> Root = MakeShared<FJsonObject>();
	Root->SetStringField(TEXT("tag"),          Data.TagString);
	Root->SetStringField(TEXT("category"),     Data.Category);
	Root->SetStringField(TEXT("lastBuiltAt"),  Data.LastBuiltAtIso);
	Root->SetStringField(TEXT("inputsHash"),   Data.InputsHash);
	Root->SetNumberField(TEXT("version"),      Data.Version);

	TArray<TSharedPtr<FJsonValue>> Outs;
	for (const FString& O : Data.Outputs)
	{
		Outs.Add(MakeShared<FJsonValueString>(O));
	}
	Root->SetArrayField(TEXT("outputs"), Outs);

	TArray<TSharedPtr<FJsonValue>> Anims;
	for (const FHktWorkspaceManifestData::FAnimEntry& A : Data.Anims)
	{
		TSharedPtr<FJsonObject> O = MakeShared<FJsonObject>();
		O->SetStringField(TEXT("name"),   A.Name);
		O->SetStringField(TEXT("source"), A.Source);
		TArray<TSharedPtr<FJsonValue>> Dirs;
		for (const FString& D : A.Directions)
		{
			Dirs.Add(MakeShared<FJsonValueString>(D));
		}
		O->SetArrayField(TEXT("directions"), Dirs);
		Anims.Add(MakeShared<FJsonValueObject>(O));
	}
	Root->SetArrayField(TEXT("anims"), Anims);

	FString Out;
	const TSharedRef<TJsonWriter<TCHAR, TPrettyJsonPrintPolicy<TCHAR>>> Writer
		= TJsonWriterFactory<TCHAR, TPrettyJsonPrintPolicy<TCHAR>>::Create(&Out);
	FJsonSerializer::Serialize(Root.ToSharedRef(), Writer);

	const FString Path = GetManifestPath(TagFolderPath);
	if (!FFileHelper::SaveStringToFile(Out, *Path))
	{
		UE_LOG(LogHktWorkspace, Warning, TEXT("[Manifest] 저장 실패: %s"), *Path);
		return false;
	}
	return true;
}
