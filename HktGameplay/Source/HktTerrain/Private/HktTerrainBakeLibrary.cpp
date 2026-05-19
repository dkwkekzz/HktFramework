// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktTerrainBakeLibrary.h"
#include "HktTerrainBakedAsset.h"
#include "HktTerrainGenerator.h"
#include "HktTerrainBiome.h"
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

	// Coord → Asset->Chunks 인덱스 (표면 메타 후처리에서 mutable 접근 위해 빌드).
	// Asset->CoordToIndex 는 private — 본 빌드 시점엔 별도 로컬 맵을 운영하고,
	// 끝에서 Asset->RebuildIndex() 가 동일 데이터를 재생성한다.
	TMap<FIntVector, int32> LocalCoordToIndex;
	LocalCoordToIndex.Reserve(TotalChunks);

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

		const int32 NewIndex = Asset->Chunks.Add(MoveTemp(Chunk));
		LocalCoordToIndex.Add(FIntVector(CX, CY, CZ), NewIndex);
		++BakedCount;
	}

	// ────────────────────────────────────────────────────────────────────────
	// 표면 메타데이터 캡처 (TerrainSpawner.design.md §4-a 런타임 정책 패스)
	//
	// 청크 중심 column 1점 샘플로 (BiomeId, SurfaceVoxelZ) 결정 → 표면을 포함하는
	// 청크에 메타 부착. cpp 하드코딩 biome→Story 매핑은 폐기 — placement 정책 Story
	// (Content/Stories/Natural/Placement_*.json) 가 런타임 이벤트로 결정.
	//
	// `Spawners[]` 는 본 패스에서 비워 둔다 (공존 정책):
	//   - 명시 배치 (보스/랜드마크) 는 HktMapSpawnerAdapter / 수동 Detail 패널 입력
	//   - biome 기반 자연 배치는 ChunkLoaded 이벤트 + placement 정책 Story 가 담당
	// ────────────────────────────────────────────────────────────────────────
	int32 SurfaceMetaTagged   = 0;
	int32 SurfaceMetaSkipped  = 0;  // surfaceCZ 영역 밖 / 청크가 비어 저장 안 됨
	{
		auto FloorDivI = [](int32 A, int32 B) -> int32
		{
			return (A >= 0) ? (A / B) : -(((-A) + B - 1) / B);
		};

		for (int32 CY = ChunkMin.Y; CY <= ChunkMax.Y; ++CY)
		for (int32 CX = ChunkMin.X; CX <= ChunkMax.X; ++CX)
		{
			const int32 SampleVoxelX = CX * FHktTerrainGeneratorConfig::ChunkSize
			                          + FHktTerrainGeneratorConfig::ChunkSize / 2;
			const int32 SampleVoxelY = CY * FHktTerrainGeneratorConfig::ChunkSize
			                          + FHktTerrainGeneratorConfig::ChunkSize / 2;

			FHktTerrainPreviewRegion Preview;
			Generator.SamplePreviewRegion(SampleVoxelX, SampleVoxelY, 1, 1, Preview);
			if (Preview.Samples.Num() != 1)
			{
				++SurfaceMetaSkipped;
				continue;
			}
			const FHktTerrainPreviewSample& S = Preview.Samples[0];

			const int32 SurfaceVoxelZ = S.SurfaceHeightVoxels;
			const int32 SurfaceCZ     = FloorDivI(SurfaceVoxelZ, FHktTerrainGeneratorConfig::ChunkSize);
			if (SurfaceCZ < ChunkMin.Z || SurfaceCZ > ChunkMax.Z)
			{
				++SurfaceMetaSkipped;
				continue;
			}

			const FIntVector SurfaceCoord(CX, CY, SurfaceCZ);
			const int32* IdxPtr = LocalCoordToIndex.Find(SurfaceCoord);
			if (!IdxPtr || !Asset->Chunks.IsValidIndex(*IdxPtr))
			{
				// 표면 청크가 all-air 로 skip 된 케이스 — 정상적으로는 거의 없음 (표면 = 솔리드)
				++SurfaceMetaSkipped;
				continue;
			}

			FHktTerrainBakedChunk& Chunk = Asset->Chunks[*IdxPtr];
			Chunk.bIsSurfaceChunk = true;
			Chunk.BiomeId         = S.BiomeId;
			Chunk.SurfaceVoxelZ   = SurfaceVoxelZ;
			Chunk.SlotHash        = HashCombine(GetTypeHash(SurfaceCoord), GetTypeHash(0));
			++SurfaceMetaTagged;
		}
	}

	// Spawners[] 는 본 베이크 패스에서 채우지 않는다 — 명시 배치만 받음.
	// 비워두면 자산 새로 만들 때 빈 배열 그대로 직렬화 (의도된 빈 슬롯).

	// ────────────────────────────────────────────────────────────────────────
	// Voxel Spawn Template 자동 산출 (I-0014 Phase B)
	//
	// `BakedConfig.VoxelTypeSpawnTemplate` (디자이너 정의) 를 보고:
	//   1. 등장하는 unique StoryTag 별로 templateId 부여 → `SpawnTemplateCatalog`
	//   2. 매 surface chunk 의 32×32 column 을 순회, top-most non-air voxel 의 TypeID 가
	//      매핑되어 있으면 attribution 기록 (sparse, top voxel per column).
	//
	// 매핑이 비어 있으면 attribution 0 — 런타임 spawn 없음. 디자이너 책임.
	// Phase A 의 chunk-level ChunkLoaded 호환 어댑터는 본 PR 에서 함께 제거됨.
	// ────────────────────────────────────────────────────────────────────────
	int32 AttributionsWritten = 0;
	int32 SurfaceChunksProcessed = 0;
	{
		// 1. StoryTag → templateId 부여 (templateId 0 은 미할당으로 예약)
		TMap<FGameplayTag, uint16> TagToTemplateId;
		uint16 NextTemplateId = 1;
		for (const TPair<int32, FGameplayTag>& Pair : BakedConfig.VoxelTypeSpawnTemplate)
		{
			const FGameplayTag& Tag = Pair.Value;
			if (!Tag.IsValid()) continue;
			if (TagToTemplateId.Contains(Tag)) continue;
			if (NextTemplateId == 0)  // wraparound (>65535 unique tags) — 비현실적이나 방어
			{
				UE_LOG(LogHktTerrain, Warning,
					TEXT("BakeRegion: VoxelTypeSpawnTemplate unique tag 가 uint16 한도(65535)를 초과 — 일부 무시"));
				break;
			}
			TagToTemplateId.Add(Tag, NextTemplateId);
			Asset->SpawnTemplateCatalog.Add(NextTemplateId, Tag);
			++NextTemplateId;
		}

		// 2. VoxelTypeID → templateId 룩업 (chunk 순회용 hot map)
		TMap<uint16, uint16> VoxelTypeToTemplateId;
		VoxelTypeToTemplateId.Reserve(BakedConfig.VoxelTypeSpawnTemplate.Num());
		for (const TPair<int32, FGameplayTag>& Pair : BakedConfig.VoxelTypeSpawnTemplate)
		{
			if (!Pair.Value.IsValid()) continue;
			const uint16* TidPtr = TagToTemplateId.Find(Pair.Value);
			if (!TidPtr) continue;
			const int32 TypeKey = Pair.Key;
			if (TypeKey <= 0 || TypeKey > MAX_uint16)
			{
				UE_LOG(LogHktTerrain, Warning,
					TEXT("BakeRegion: VoxelTypeSpawnTemplate 키 %d 가 uint16 범위 밖 (0=air, ≤65535) — 무시"),
					TypeKey);
				continue;
			}
			VoxelTypeToTemplateId.Add(static_cast<uint16>(TypeKey), *TidPtr);
		}

		// 3. surface chunk 순회 → 32×32 column top-most non-air voxel scan
		if (VoxelTypeToTemplateId.Num() > 0)
		{
			constexpr int32 CS = FHktTerrainGeneratorConfig::ChunkSize;
			for (FHktTerrainBakedChunk& Chunk : Asset->Chunks)
			{
				if (!Chunk.bIsSurfaceChunk) continue;
				++SurfaceChunksProcessed;

				// surface chunk 의 voxel 데이터 재산출 (생성기 결정론적이므로 동일 결과).
				FMemory::Memzero(RawVoxels.GetData(), RawBytes);
				Generator.GenerateChunk(Chunk.Coord.X, Chunk.Coord.Y, Chunk.Coord.Z, RawVoxels.GetData());

				for (int32 LocalY = 0; LocalY < CS; ++LocalY)
				for (int32 LocalX = 0; LocalX < CS; ++LocalX)
				{
					// Z=31 → 0 스캔, 최초 non-air voxel = 본 청크 column 의 surface 후보
					for (int32 LocalZ = CS - 1; LocalZ >= 0; --LocalZ)
					{
						const int32 Idx = LocalX + LocalY * CS + LocalZ * CS * CS;
						const uint16 TypeID = RawVoxels[Idx].TypeID;
						if (TypeID == 0) continue;

						const uint16* TemplateIdPtr = VoxelTypeToTemplateId.Find(TypeID);
						if (TemplateIdPtr)
						{
							const uint16 Packed =
								FHktTerrainBakedChunk::PackLocalCoord(LocalX, LocalY, LocalZ);
							Chunk.SpawnTemplateAttribution.Add(Packed, *TemplateIdPtr);
							++AttributionsWritten;
						}
						break;  // top-most non-air 만 검사 (column 1점)
					}
				}
			}
		}
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
		TEXT("BakeRegion '%s' 완료 — Baked=%d SkippedEmpty=%d Total=%d CompressedBytes=%lld AvgRatio=%.2f%% SurfaceMeta=%d(skipped=%d) Attribution=%d(chunks=%d, catalog=%d)"),
		*SavePath, BakedCount, SkippedEmpty, TotalChunks, TotalCompressed,
		BakedCount > 0
			? 100.0 * TotalCompressed / (static_cast<int64>(BakedCount) * RawBytes)
			: 0.0,
		SurfaceMetaTagged, SurfaceMetaSkipped,
		AttributionsWritten, SurfaceChunksProcessed, Asset->SpawnTemplateCatalog.Num());

	return Asset;
#endif
}
