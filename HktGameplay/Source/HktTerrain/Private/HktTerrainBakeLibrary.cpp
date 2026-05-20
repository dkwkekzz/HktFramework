// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktTerrainBakeLibrary.h"
#include "HktTerrainBakedAsset.h"
#include "HktTerrainGenerator.h"
#include "HktTerrainBiome.h"
#include "HktTerrainLog.h"
#include "Terrain/HktTerrainVoxel.h"
#include "HktStoryEventParams.h"  // ComputeVoxelSlotHash31 — bake/runtime 시드 단일 출처
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
	// 표면 청크 식별 (I-0014 attribution 산출 게이트)
	//
	// 청크 중심 column 1점 샘플로 surface Z 를 결정 → 표면을 포함하는 청크에
	// `bIsSurfaceChunk=true`. 후속 voxel attribution 산출 패스가 본 플래그로 게이트.
	// ────────────────────────────────────────────────────────────────────────
	int32 SurfaceMetaTagged   = 0;
	int32 SurfaceMetaSkipped  = 0;
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

			const int32 SurfaceCZ = FloorDivI(S.SurfaceHeightVoxels,
			                                  FHktTerrainGeneratorConfig::ChunkSize);
			if (SurfaceCZ < ChunkMin.Z || SurfaceCZ > ChunkMax.Z)
			{
				++SurfaceMetaSkipped;
				continue;
			}

			const FIntVector SurfaceCoord(CX, CY, SurfaceCZ);
			const int32* IdxPtr = LocalCoordToIndex.Find(SurfaceCoord);
			if (!IdxPtr || !Asset->Chunks.IsValidIndex(*IdxPtr))
			{
				++SurfaceMetaSkipped;
				continue;
			}

			Asset->Chunks[*IdxPtr].bIsSurfaceChunk = true;
			++SurfaceMetaTagged;
		}
	}

	// Spawners[] 는 본 베이크 패스에서 채우지 않는다 — 명시 배치만 받음.
	// 비워두면 자산 새로 만들 때 빈 배열 그대로 직렬화 (의도된 빈 슬롯).

	// ────────────────────────────────────────────────────────────────────────
	// Voxel Spawn Template 자동 산출 (I-0014 Phase B + 다양성 확장 v6)
	//
	// `BakedConfig.VoxelSpawnRules` (TArray<FHktVoxelSpawnRule>) 를 보고:
	//   1. voxel type 별로 후보 rule 들을 그룹핑 → weighted-pick 룩업 테이블.
	//   2. 각 unique StoryTag 에 templateId 부여 → `SpawnTemplateCatalog`.
	//   3. 매 surface chunk 의 32×32 column 의 top-most non-air voxel 좌표 기준으로
	//      `ComputeVoxelSlotHash31(worldX, worldY, worldZ) % totalWeight` 결정론적
	//      weighted-pick 수행 → 선정된 후보의 StoryTag 가 invalid 면 skip, 아니면
	//      attribution 기록.
	//
	// Rules 가 비어 있으면 attribution 0 — 런타임 spawn 없음. 디자이너 책임.
	// ────────────────────────────────────────────────────────────────────────
	int32 AttributionsWritten = 0;
	int32 SurfaceChunksProcessed = 0;
	int32 SkipPicks = 0;       // skip 슬롯 (invalid StoryTag) 가 선정된 횟수
	int32 OrphanRules = 0;     // VoxelType=Air / Weight 비정상이라 폐기된 rule 수
	{
		// 룩업 엔트리 — flat-array 그룹핑 산출물.
		// 각 voxel type 의 cumulative weights + templateId (invalid → 0=skip) 시퀀스.
		struct FRuleEntry
		{
			int32 TemplateId = 0;     // 0 = skip 슬롯 (StoryTag invalid)
			int32 CumWeight  = 0;     // prefix-sum (>=1)
		};
		struct FRuleBucket
		{
			TArray<FRuleEntry> Entries;
			int32 TotalWeight = 0;
		};

		// 1. StoryTag → templateId 부여 (templateId 0 은 skip 슬롯 예약)
		TMap<FGameplayTag, int32> TagToTemplateId;
		int32 NextTemplateId = 1;

		// 2. VoxelType 별 bucket 빌드
		TMap<uint16, FRuleBucket> Buckets;

		for (const FHktVoxelSpawnRule& Rule : BakedConfig.VoxelSpawnRules)
		{
			if (Rule.Weight <= 0)
			{
				++OrphanRules;
				continue;
			}
			if (Rule.VoxelType == EHktTerrainVoxelType::Air)
			{
				UE_LOG(LogHktTerrain, Warning,
					TEXT("BakeRegion: VoxelSpawnRules 엔트리의 VoxelType 이 Air — 무시"));
				++OrphanRules;
				continue;
			}

			int32 TemplateId = 0;  // invalid StoryTag → 0 (skip)
			if (Rule.StoryTag.IsValid())
			{
				int32* Existing = TagToTemplateId.Find(Rule.StoryTag);
				if (Existing)
				{
					TemplateId = *Existing;
				}
				else if (NextTemplateId > MAX_uint16)
				{
					UE_LOG(LogHktTerrain, Warning,
						TEXT("BakeRegion: VoxelSpawnRules unique tag 가 한도(65535) 초과 — 일부 무시"));
					++OrphanRules;
					continue;
				}
				else
				{
					TemplateId = NextTemplateId++;
					TagToTemplateId.Add(Rule.StoryTag, TemplateId);
					Asset->SpawnTemplateCatalog.Add(TemplateId, Rule.StoryTag);
				}
			}

			FRuleBucket& Bucket = Buckets.FindOrAdd(static_cast<uint16>(Rule.VoxelType));
			Bucket.TotalWeight += Rule.Weight;
			Bucket.Entries.Add({ TemplateId, Bucket.TotalWeight });
		}

		// 3. surface chunk 순회 → 32×32 column top-most non-air voxel → weighted pick
		if (Buckets.Num() > 0)
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

						const FRuleBucket* Bucket = Buckets.Find(TypeID);
						if (Bucket && Bucket->TotalWeight > 0)
						{
							// 결정론 시드: voxel 좌표 한 곳 (I-0017). 런타임 dispatch 의
							// Param2 SlotHash31 과 동일 함수 — 베이크/런타임 일관성.
							const int32 WorldX = Chunk.Coord.X * CS + LocalX;
							const int32 WorldY = Chunk.Coord.Y * CS + LocalY;
							const int32 WorldZ = Chunk.Coord.Z * CS + LocalZ;
							const uint32 Seed  =
								HktEventBuilder::ComputeVoxelSlotHash31(WorldX, WorldY, WorldZ);
							const int32 Roll   =
								static_cast<int32>(Seed % static_cast<uint32>(Bucket->TotalWeight));

							int32 PickedTemplateId = 0;  // 0 = skip
							for (const FRuleEntry& E : Bucket->Entries)
							{
								if (Roll < E.CumWeight)
								{
									PickedTemplateId = E.TemplateId;
									break;
								}
							}

							if (PickedTemplateId > 0)
							{
								const int32 Packed =
									FHktTerrainBakedChunk::PackLocalCoord(LocalX, LocalY, LocalZ);
								Chunk.SpawnTemplateAttribution.Add(Packed, PickedTemplateId);
								++AttributionsWritten;
							}
							else
							{
								++SkipPicks;  // skip 슬롯 선정 — attribution 미부여
							}
						}
						break;  // top-most non-air 만 검사 (column 1점)
					}
				}
			}
		}

		UE_LOG(LogHktTerrain, Log,
			TEXT("BakeRegion: VoxelSpawnRules 처리 — Rules=%d (orphan=%d), Buckets=%d, "
			     "SurfaceChunks=%d, AttributionsWritten=%d, SkipPicks=%d"),
			BakedConfig.VoxelSpawnRules.Num(), OrphanRules, Buckets.Num(),
			SurfaceChunksProcessed, AttributionsWritten, SkipPicks);
	}

	// ────────────────────────────────────────────────────────────────────────
	// I-0015 정적 검증 — bake 시점에 catalog ↔ attribution 결합 무결성 체크.
	//
	// 죽은 catalog id (어떤 chunk attribution 도 참조하지 않는 templateId) 를 검출하여
	// 디자이너의 매핑 오타 / 실제 voxel type 부재를 빌드 시점에 가시화. 검증 실패가 아닌
	// WARN — 큰 region 의 첫 베이크에서는 매핑이 의도적으로 over-spec 일 수 있어 강제 차단 X.
	// ────────────────────────────────────────────────────────────────────────
	{
		TSet<int32> ReferencedTemplateIds;
		for (const FHktTerrainBakedChunk& Chunk : Asset->Chunks)
		{
			for (const TPair<int32, int32>& Pair : Chunk.SpawnTemplateAttribution)
			{
				ReferencedTemplateIds.Add(Pair.Value);
			}
		}

		int32 OrphanCatalogEntries = 0;
		for (const TPair<int32, FGameplayTag>& Pair : Asset->SpawnTemplateCatalog)
		{
			if (!ReferencedTemplateIds.Contains(Pair.Key))
			{
				++OrphanCatalogEntries;
				UE_LOG(LogHktTerrain, Warning,
					TEXT("BakeRegion: catalog templateId=%d (tag='%s') 가 어떤 voxel 도 참조하지 않음 — 매핑 voxel type 이 region 에 부재하거나 매핑 오타 의심"),
					Pair.Key, *Pair.Value.ToString());
			}
		}

		if (OrphanCatalogEntries > 0)
		{
			UE_LOG(LogHktTerrain, Warning,
				TEXT("BakeRegion: 미참조 catalog 엔트리 %d 개 (I-0015 정적 검증)"),
				OrphanCatalogEntries);
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
