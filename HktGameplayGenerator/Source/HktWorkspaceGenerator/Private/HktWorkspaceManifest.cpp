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
	void HashString(FSHA1& Sha, const FString& Str)
	{
		// UpdateWithString 의 byte 길이 의미가 플랫폼별 모호 — Update 로 명시.
		Sha.Update(reinterpret_cast<const uint8*>(*Str), Str.Len() * sizeof(TCHAR));
	}

	void HashFileMeta(FSHA1& Sha, const FString& Path, const FFileStatData& Stat)
	{
		HashString(Sha, Path);
		if (!Stat.bIsValid) return;
		const int64 Size  = Stat.FileSize;
		const int64 Ticks = Stat.ModificationTime.GetTicks();
		Sha.Update(reinterpret_cast<const uint8*>(&Size),  sizeof(int64));
		Sha.Update(reinterpret_cast<const uint8*>(&Ticks), sizeof(int64));
	}

	void HashFile(FSHA1& Sha, const FString& Path)
	{
		HashFileMeta(Sha, Path, IFileManager::Get().GetStatData(*Path));
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
	HashString(Sha, Entry.TagString);

	// entity_meta.json — Tag 폴더 직속. frameDurationMs/pixelToWorld/looping/mirror 등
	// 빌드 인자에 직접 영향. 사이드카만 수정해도 재빌드 되도록 항상 해시.
	if (!Entry.FolderPath.IsEmpty())
	{
		const FString EntityMeta = Entry.FolderPath / TEXT("entity_meta.json");
		if (FPaths::FileExists(EntityMeta))
		{
			HashFile(Sha, EntityMeta);
		}
	}

	if (Entry.Mode == EHktWorkspaceTagMode::StaticVisual)
	{
		HashFile(Sha, Entry.StaticImagePath);
	}
	else
	{
		for (const FHktWorkspaceAnimInput& A : Entry.Anims)
		{
			HashString(Sha, A.Name);
			HashString(Sha, FString(HktWorkspaceConventions::AnimSourceToString(A.Source)));

			// FrameSequence: SourcePaths 는 디렉터리 — 곧장 recurse (디렉터리는 stat 결과 의미 없음).
			// Atlas/Video: SourcePaths 는 파일 — HashFile 한 번이면 stat 1회로 충분.
			const bool bDirectorySource = (A.Source == EHktWorkspaceAnimSource::FrameSequence);
			for (const FString& P : A.SourcePaths)
			{
				if (bDirectorySource) HashFolderRecursive(Sha, P);
				else                  HashFile(Sha, P);
			}

			// anim 폴더의 `anim_meta.json` — source 타입과 무관하게 항상 hash.
			// FrameSequence 의 경우 SourcePaths(디렉터리) 들의 부모 폴더에 위치하므로
			// folder recurse 만으로는 잡히지 않는다.
			if (!A.FolderPath.IsEmpty())
			{
				const FString AnimMeta = A.FolderPath / TEXT("anim_meta.json");
				if (FPaths::FileExists(AnimMeta))
				{
					HashFile(Sha, AnimMeta);
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
		AE.Source     = FString(HktWorkspaceConventions::AnimSourceToString(A.Source));
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
