// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktTerrainProvider.h"
#include "HktTerrainBakedAsset.h"
#include "HktTerrainSubsystem.h"
#include "HktTerrainLog.h"
#include "Terrain/HktTerrainVoxel.h"

namespace
{
	constexpr int32 VoxelsPerChunk =
		FHktTerrainGeneratorConfig::ChunkSize *
		FHktTerrainGeneratorConfig::ChunkSize *
		FHktTerrainGeneratorConfig::ChunkSize;
}

FHktTerrainProvider::FHktTerrainProvider(UHktTerrainSubsystem* InSubsystem,
                                         const FHktTerrainGeneratorConfig& InConfig)
	: Subsystem(InSubsystem)
	, Config(InConfig)
{
}

void FHktTerrainProvider::GenerateChunk(int32 ChunkX, int32 ChunkY, int32 ChunkZ,
                                        FHktTerrainVoxel* OutVoxels) const
{
	if (!OutVoxels) return;

	UHktTerrainSubsystem* Sub = Subsystem.Get();
	if (!Sub)
	{
		// 시뮬레이션 측 안전 디폴트 — 모두 빈 공간. 호출자(FHktTerrainState::LoadChunk)가
		// 데이터를 그대로 받아 처리하므로 여기서 zero-init 만 보장한다.
		FMemory::Memzero(OutVoxels, sizeof(FHktTerrainVoxel) * VoxelsPerChunk);
		UE_LOG(LogHktTerrain, Warning,
			TEXT("FHktTerrainProvider::GenerateChunk — Subsystem 무효, 빈 청크 반환 (%d,%d,%d)"),
			ChunkX, ChunkY, ChunkZ);
		return;
	}

	// Subsystem 의 buffer-out API 가 호출자 버퍼로 직접 채워준다 — 추가 memcpy 불요.
	TArrayView<FHktTerrainVoxel> View(OutVoxels, VoxelsPerChunk);
	if (!Sub->AcquireChunk(FIntVector(ChunkX, ChunkY, ChunkZ), View))
	{
		// AcquireChunk 가 실패해도 zero-init 은 자체적으로 보장하지만, 명시적으로 한 번 더.
		FMemory::Memzero(OutVoxels, sizeof(FHktTerrainVoxel) * VoxelsPerChunk);
	}
}

void FHktTerrainProvider::GetChunkSpawners(int32 ChunkX, int32 ChunkY, int32 ChunkZ,
                                           TArray<FHktTerrainSpawnerView>& OutSpawners) const
{
	UHktTerrainSubsystem* Sub = Subsystem.Get();
	if (!Sub)
	{
		return;
	}

	const UHktTerrainBakedAsset* Asset = Sub->GetBakedAsset();
	if (!Asset)
	{
		// BakedAsset 부재 — Generator 폴백 경로에는 spawner 가 없다 (Bake 시점에만 결정).
		// Phase 4 chunk-load dispatch 가 "왜 안 트리거되는가" 진단을 위해 인스턴스당 1회 INFO 로그.
		if (!bLoggedNoBakedAssetOnce)
		{
			UE_LOG(LogHktTerrain, Log,
				TEXT("[TerrainProvider] GetChunkSpawners: BakedAsset 미로드 — chunk-load spawner dispatch 비활성 (Phase 4 dormant). 인스턴스당 첫 발생만 출력."));
			bLoggedNoBakedAssetOnce = true;
		}
		return;
	}

	const FIntVector Coord(ChunkX, ChunkY, ChunkZ);
	TArray<const FHktTerrainSpawnerSpec*> Specs;
	Asset->GetSpawnersForChunk(Coord, Specs);
	if (Specs.Num() == 0)
	{
		return;
	}

	OutSpawners.Reserve(OutSpawners.Num() + Specs.Num());
	for (const FHktTerrainSpawnerSpec* Spec : Specs)
	{
		if (!Spec) continue;

		FHktTerrainSpawnerView View;
		View.PosXRaw  = Spec->PosXRaw;
		View.PosYRaw  = Spec->PosYRaw;
		View.PosZRaw  = Spec->PosZRaw;
		View.StoryTag = Spec->StoryTag;
		View.Param0   = Spec->Param0;
		View.Param1   = Spec->Param1;
		View.Param2   = Spec->Param2;
		View.Param3   = Spec->Param3;
		View.ChunkX   = Spec->ChunkCoord.X;
		View.ChunkY   = Spec->ChunkCoord.Y;
		View.ChunkZ   = Spec->ChunkCoord.Z;
		View.SlotHash = Spec->SlotHash;
		View.BiomeId  = Spec->BiomeId;
		OutSpawners.Add(View);
	}
}

void FHktTerrainProvider::GetChunkVoxelAttribution(int32 ChunkX, int32 ChunkY, int32 ChunkZ,
                                                   TArray<FHktVoxelAttributionView>& OutEntries) const
{
	UHktTerrainSubsystem* Sub = Subsystem.Get();
	if (!Sub)
	{
		return;
	}
	const UHktTerrainBakedAsset* Asset = Sub->GetBakedAsset();
	if (!Asset)
	{
		return;  // INFO 로그는 GetChunkSpawners 와 공유
	}

	const FIntVector Coord(ChunkX, ChunkY, ChunkZ);
	const TMap<uint16, uint16>* AttrMap = Asset->FindVoxelAttribution(Coord);
	if (!AttrMap)
	{
		return;  // 슬롯 비어 있음 — sim 이 chunk-level ChunkLoaded fallback 으로 처리
	}

	constexpr int32 ChunkSize = FHktTerrainGeneratorConfig::ChunkSize;
	OutEntries.Reserve(OutEntries.Num() + AttrMap->Num());

	for (const TPair<uint16, uint16>& Pair : *AttrMap)
	{
		const uint16 PackedLocal = Pair.Key;
		const uint16 TemplateId  = Pair.Value;

		const FGameplayTag* StoryTag = Asset->SpawnTemplateCatalog.Find(TemplateId);
		if (!StoryTag || !StoryTag->IsValid())
		{
			// 카탈로그 미정의 id — Phase A 는 silent skip + 인스턴스당 1회 WARN.
			// I-0015 위임 시 빌드 시점 정적 검증으로 차단된다.
			++UnknownTemplateIdCount;
			if (!bLoggedUnknownTemplateOnce)
			{
				UE_LOG(LogHktTerrain, Warning,
					TEXT("[TerrainProvider] Voxel attribution chunk(%d,%d,%d) templateId=%u 카탈로그 미정의 — skip. (인스턴스 첫 발생만 출력)"),
					ChunkX, ChunkY, ChunkZ, TemplateId);
				bLoggedUnknownTemplateOnce = true;
			}
			continue;
		}

		int32 LocalX = 0, LocalY = 0, LocalZ = 0;
		FHktTerrainBakedChunk::UnpackLocalCoord(PackedLocal, LocalX, LocalY, LocalZ);

		FHktVoxelAttributionView View;
		View.VoxelWorldX = ChunkX * ChunkSize + LocalX;
		View.VoxelWorldY = ChunkY * ChunkSize + LocalY;
		View.VoxelWorldZ = ChunkZ * ChunkSize + LocalZ;
		View.StoryTag    = *StoryTag;

		// 시드 = voxel 좌표 한 곳 (I-0017). chunk SlotHash / biome 은 보조 입력으로만 흡수.
		uint32 H = ::GetTypeHash(FIntVector(View.VoxelWorldX, View.VoxelWorldY, View.VoxelWorldZ));
		View.SlotHash31 = H & 0x7FFFFFFFu;

		const FHktTerrainBakedChunk* Chunk = Asset->FindChunk(Coord);
		View.BiomeId = Chunk ? static_cast<int32>(Chunk->BiomeId) : 0;

		OutEntries.Add(View);
	}
}

bool FHktTerrainProvider::TryGetChunkContext(int32 ChunkX, int32 ChunkY, int32 ChunkZ,
                                             FHktTerrainChunkContext& OutCtx) const
{
	UHktTerrainSubsystem* Sub = Subsystem.Get();
	if (!Sub)
	{
		return false;
	}
	const UHktTerrainBakedAsset* Asset = Sub->GetBakedAsset();
	if (!Asset)
	{
		// BakedAsset 미로드 — placement 정책 발화 불가. INFO 로그는 GetChunkSpawners 와 공유.
		return false;
	}

	int32 BiomeId = 0;
	int32 SurfaceVoxelZ = 0;
	uint32 SlotHash = 0;
	const FIntVector Coord(ChunkX, ChunkY, ChunkZ);
	if (!Asset->TryGetSurfaceContext(Coord, BiomeId, SurfaceVoxelZ, SlotHash))
	{
		return false;  // 비표면 / 미베이크 청크
	}
	OutCtx.BiomeId          = BiomeId;
	OutCtx.SurfaceVoxelZ    = SurfaceVoxelZ;
	OutCtx.SlotHash         = SlotHash;
	OutCtx.bIsSurfaceChunk  = true;
	// I-0014: baked 자산의 PlacementStoryTag 를 그대로 전달. 빈 태그면 sim 이 폴백 처리.
	OutCtx.DispatchTag      = Asset->GeneratorConfig.PlacementStoryTag;
	return true;
}
