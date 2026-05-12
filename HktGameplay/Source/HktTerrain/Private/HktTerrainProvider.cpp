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
