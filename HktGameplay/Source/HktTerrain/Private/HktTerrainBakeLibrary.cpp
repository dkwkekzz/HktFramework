// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktTerrainBakeLibrary.h"
#include "HktTerrainBakedAsset.h"
#include "HktTerrainGenerator.h"
#include "HktTerrainLog.h"
#include "Terrain/HktTerrainVoxel.h"
#include "Misc/Compression.h"

#if WITH_EDITOR
#include "AssetRegistry/AssetRegistryModule.h"
#include "UObject/Package.h"
#include "UObject/SavePackage.h"
#include "Misc/PackageName.h"
#endif

UHktTerrainBakedAsset* UHktTerrainBakeLibrary::BakeRegion(
	const FHktTerrainBakedConfig& BakedConfig,
	FIntVector ChunkMin,
	FIntVector ChunkMax,
	const FString& SavePath)
{
#if !WITH_EDITOR
	UE_LOG(LogHktTerrain, Error, TEXT("BakeRegion 은 에디터 빌드에서만 동작합니다."));
	return nullptr;
#else
	// 영역 검증
	if (ChunkMin.X > ChunkMax.X || ChunkMin.Y > ChunkMax.Y || ChunkMin.Z > ChunkMax.Z)
	{
		UE_LOG(LogHktTerrain, Error,
			TEXT("BakeRegion: 영역 범위가 잘못됨 — Min=%s Max=%s"),
			*ChunkMin.ToString(), *ChunkMax.ToString());
		return nullptr;
	}

	// 패키지 / 자산 이름 분리
	const FString PackagePath = FPackageName::GetLongPackagePath(SavePath);
	const FString AssetName   = FPackageName::GetLongPackageAssetName(SavePath);
	if (PackagePath.IsEmpty() || AssetName.IsEmpty())
	{
		UE_LOG(LogHktTerrain, Error, TEXT("BakeRegion: SavePath '%s' 가 잘못됨"), *SavePath);
		return nullptr;
	}

	UPackage* Package = CreatePackage(*SavePath);
	if (!Package)
	{
		UE_LOG(LogHktTerrain, Error, TEXT("BakeRegion: CreatePackage 실패 '%s'"), *SavePath);
		return nullptr;
	}
	Package->FullyLoad();

	UHktTerrainBakedAsset* Asset = NewObject<UHktTerrainBakedAsset>(
		Package, *AssetName, RF_Public | RF_Standalone);
	if (!Asset)
	{
		UE_LOG(LogHktTerrain, Error, TEXT("BakeRegion: NewObject 실패 '%s'"), *AssetName);
		return nullptr;
	}

	Asset->GeneratorConfig = BakedConfig;
	Asset->RegionMin       = ChunkMin;
	Asset->RegionMax       = ChunkMax;
	Asset->BakeVersion     = UHktTerrainBakedAsset::CurrentBakeVersion;
	Asset->Chunks.Reset();

	// 청크 단위 생성 → 압축 → 누적
	FHktTerrainGenerator Generator(BakedConfig.ToConfig());

	constexpr int32 VoxelsPerChunk = 32 * 32 * 32;
	constexpr int32 RawBytes       = VoxelsPerChunk * sizeof(FHktTerrainVoxel);

	TArray<FHktTerrainVoxel> RawVoxels;
	RawVoxels.SetNumUninitialized(VoxelsPerChunk);

	const int32 TotalChunks =
		(ChunkMax.X - ChunkMin.X + 1) *
		(ChunkMax.Y - ChunkMin.Y + 1) *
		(ChunkMax.Z - ChunkMin.Z + 1);

	Asset->Chunks.Reserve(TotalChunks);

	int32 BakedCount = 0;
	int32 SkippedEmpty = 0;
	int64 TotalCompressed = 0;

	for (int32 CZ = ChunkMin.Z; CZ <= ChunkMax.Z; ++CZ)
	for (int32 CY = ChunkMin.Y; CY <= ChunkMax.Y; ++CY)
	for (int32 CX = ChunkMin.X; CX <= ChunkMax.X; ++CX)
	{
		FMemory::Memzero(RawVoxels.GetData(), RawBytes);
		Generator.GenerateChunk(CX, CY, CZ, RawVoxels.GetData());

		// 전 복셀이 air(TypeID=0)이면 자산에 저장하지 않음 — 폴백이 동일 결과 생성.
		bool bAllEmpty = true;
		for (int32 i = 0; i < VoxelsPerChunk; ++i)
		{
			if (RawVoxels[i].TypeID != 0) { bAllEmpty = false; break; }
		}
		if (bAllEmpty)
		{
			++SkippedEmpty;
			continue;
		}

		FHktTerrainBakedChunk Chunk;
		Chunk.Coord = FIntVector(CX, CY, CZ);
		Chunk.UncompressedSize = RawBytes;

		// Oodle 압축 — 보수적 상한으로 버퍼 확보
		int32 CompressedBound = FCompression::CompressMemoryBound(NAME_Oodle, RawBytes);
		Chunk.CompressedData.SetNumUninitialized(CompressedBound);

		int32 CompressedSize = CompressedBound;
		const bool bOk = FCompression::CompressMemory(
			NAME_Oodle,
			Chunk.CompressedData.GetData(),
			CompressedSize,
			RawVoxels.GetData(),
			RawBytes);

		if (!bOk)
		{
			UE_LOG(LogHktTerrain, Error,
				TEXT("BakeRegion: 청크 (%d,%d,%d) Oodle 압축 실패 — 자산 빌드 중단"),
				CX, CY, CZ);
			return nullptr;
		}
		Chunk.CompressedData.SetNum(CompressedSize, EAllowShrinking::No);
		TotalCompressed += CompressedSize;

		Asset->Chunks.Add(MoveTemp(Chunk));
		++BakedCount;
	}

	Asset->RebuildIndex();
	Asset->MarkPackageDirty();

	// 패키지 저장
	const FString FilePath = FPackageName::LongPackageNameToFilename(
		SavePath, FPackageName::GetAssetPackageExtension());

	FSavePackageArgs SaveArgs;
	SaveArgs.TopLevelFlags = RF_Public | RF_Standalone;

	const bool bSaved = UPackage::SavePackage(Package, Asset, *FilePath, SaveArgs);
	if (!bSaved)
	{
		UE_LOG(LogHktTerrain, Error, TEXT("BakeRegion: SavePackage 실패 '%s'"), *FilePath);
		return nullptr;
	}

	FAssetRegistryModule::AssetCreated(Asset);

	UE_LOG(LogHktTerrain, Log,
		TEXT("BakeRegion '%s' 완료 — Baked=%d SkippedEmpty=%d Total=%d CompressedBytes=%lld AvgRatio=%.2f%%"),
		*SavePath, BakedCount, SkippedEmpty, TotalChunks, TotalCompressed,
		BakedCount > 0
			? 100.0 * TotalCompressed / (static_cast<int64>(BakedCount) * RawBytes)
			: 0.0);

	return Asset;
#endif
}
