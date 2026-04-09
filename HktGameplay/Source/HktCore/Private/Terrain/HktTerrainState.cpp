// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Terrain/HktTerrainState.h"
#include "Terrain/HktTerrainGenerator.h"

// ============================================================================
// 좌표 변환 헬퍼
// ============================================================================

int32 FHktTerrainState::FloorDiv(int32 A, int32 B)
{
	// C++ 나눗셈은 0으로 향하므로, 음수에서 올바른 floor를 위해 보정
	return (A >= 0) ? (A / B) : ((A - B + 1) / B);
}

int32 FHktTerrainState::FloorMod(int32 A, int32 B)
{
	int32 Mod = A % B;
	return (Mod < 0) ? (Mod + B) : Mod;
}

FIntVector FHktTerrainState::WorldToChunk(int32 X, int32 Y, int32 Z)
{
	return FIntVector(
		FloorDiv(X, ChunkSize),
		FloorDiv(Y, ChunkSize),
		FloorDiv(Z, ChunkSize));
}

uint16 FHktTerrainState::WorldToLocalIndex(int32 X, int32 Y, int32 Z)
{
	const int32 LX = FloorMod(X, ChunkSize);
	const int32 LY = FloorMod(Y, ChunkSize);
	const int32 LZ = FloorMod(Z, ChunkSize);
	return static_cast<uint16>(LX + LY * ChunkSize + LZ * ChunkSize * ChunkSize);
}

void FHktTerrainState::LocalIndexToXYZ(uint16 Index, int32& OutX, int32& OutY, int32& OutZ)
{
	OutX = Index % ChunkSize;
	OutY = (Index / ChunkSize) % ChunkSize;
	OutZ = Index / (ChunkSize * ChunkSize);
}

// ============================================================================
// 청크 생명주기
// ============================================================================

void FHktTerrainState::LoadChunk(const FIntVector& Coord, const FHktTerrainGenerator& Generator)
{
	if (LoadedChunks.Contains(Coord))
	{
		return; // 이미 로드됨
	}

	TArray<FHktTerrainVoxel>& ChunkData = LoadedChunks.Add(Coord);
	ChunkData.SetNumUninitialized(VoxelsPerChunk);

	// 생성기로 청크 생성
	Generator.GenerateChunk(Coord.X, Coord.Y, Coord.Z, ChunkData.GetData());

	// Modifications 오버레이 적용
	if (const TMap<uint16, FHktTerrainVoxel>* Mods = Modifications.Find(Coord))
	{
		for (const auto& Pair : *Mods)
		{
			ChunkData[Pair.Key] = Pair.Value;
		}
	}

	// 하이트맵 캐시 갱신
	RebuildHeightmapForChunk(Coord);
}

void FHktTerrainState::UnloadChunk(const FIntVector& Coord)
{
	LoadedChunks.Remove(Coord);
	// Modifications는 유지 — 다시 로드할 때 적용

	// 이 청크 XY에 다른 Z 레벨 청크가 남아 있으면 하이트맵 재계산,
	// 없으면 하이트맵 항목 제거
	const FIntVector HmKey(Coord.X, Coord.Y, 0);
	bool bHasOtherZ = false;
	for (const auto& Pair : LoadedChunks)
	{
		if (Pair.Key.X == Coord.X && Pair.Key.Y == Coord.Y)
		{
			bHasOtherZ = true;
			break;
		}
	}

	if (bHasOtherZ)
	{
		RebuildHeightmapForChunk(Coord);
	}
	else
	{
		HeightmapCache.Remove(HmKey);
	}
}

bool FHktTerrainState::IsChunkLoaded(const FIntVector& Coord) const
{
	return LoadedChunks.Contains(Coord);
}

// ============================================================================
// 복셀 쿼리
// ============================================================================

FHktTerrainVoxel FHktTerrainState::GetVoxel(int32 WorldX, int32 WorldY, int32 WorldZ) const
{
	const FIntVector ChunkCoord = WorldToChunk(WorldX, WorldY, WorldZ);
	const TArray<FHktTerrainVoxel>* ChunkData = LoadedChunks.Find(ChunkCoord);
	if (!ChunkData)
	{
		return FHktTerrainVoxel(); // 빈 복셀
	}

	const uint16 LocalIdx = WorldToLocalIndex(WorldX, WorldY, WorldZ);
	return (*ChunkData)[LocalIdx];
}

uint16 FHktTerrainState::GetVoxelType(int32 WorldX, int32 WorldY, int32 WorldZ) const
{
	return GetVoxel(WorldX, WorldY, WorldZ).TypeID;
}

bool FHktTerrainState::IsSolid(int32 WorldX, int32 WorldY, int32 WorldZ) const
{
	return GetVoxelType(WorldX, WorldY, WorldZ) != 0;
}

int32 FHktTerrainState::GetSurfaceHeightAt(int32 WorldVoxelX, int32 WorldVoxelY) const
{
	const int32 ChunkX = FloorDiv(WorldVoxelX, ChunkSize);
	const int32 ChunkY = FloorDiv(WorldVoxelY, ChunkSize);
	const FIntVector HmKey(ChunkX, ChunkY, 0);

	const TArray<int32>* Heightmap = HeightmapCache.Find(HmKey);
	if (!Heightmap)
	{
		return 0;
	}

	const int32 LX = FloorMod(WorldVoxelX, ChunkSize);
	const int32 LY = FloorMod(WorldVoxelY, ChunkSize);
	return (*Heightmap)[LX + LY * ChunkSize];
}

// ============================================================================
// 복셀 변형
// ============================================================================

void FHktTerrainState::SetVoxel(int32 WorldX, int32 WorldY, int32 WorldZ,
                                const FHktTerrainVoxel& Voxel,
                                TArray<FHktVoxelDelta>& OutDeltas)
{
	const FIntVector ChunkCoord = WorldToChunk(WorldX, WorldY, WorldZ);
	const uint16 LocalIdx = WorldToLocalIndex(WorldX, WorldY, WorldZ);

	// Modifications 오버레이에 기록
	Modifications.FindOrAdd(ChunkCoord).Add(LocalIdx, Voxel);

	// 로드된 청크 캐시도 갱신
	if (TArray<FHktTerrainVoxel>* ChunkData = LoadedChunks.Find(ChunkCoord))
	{
		(*ChunkData)[LocalIdx] = Voxel;
	}

	// VoxelDelta 생성
	FHktVoxelDelta Delta;
	Delta.ChunkCoord = ChunkCoord;
	Delta.LocalIndex = LocalIdx;
	Delta.NewTypeID = Voxel.TypeID;
	Delta.NewPaletteIndex = Voxel.PaletteIndex;
	Delta.NewFlags = Voxel.Flags;
	OutDeltas.Add(Delta);

	// 하이트맵 캐시 부분 갱신 (변형된 열만)
	RebuildHeightmapColumn(WorldX, WorldY);
}

// ============================================================================
// 직렬화 / 복사
// ============================================================================

void FHktTerrainState::SerializeModifications(FArchive& Ar)
{
	if (Ar.IsSaving())
	{
		int32 ChunkCount = Modifications.Num();
		Ar << ChunkCount;

		for (auto& ChunkPair : Modifications)
		{
			FIntVector Coord = ChunkPair.Key;
			Ar << Coord;

			int32 ModCount = ChunkPair.Value.Num();
			Ar << ModCount;

			for (auto& ModPair : ChunkPair.Value)
			{
				uint16 Idx = ModPair.Key;
				FHktTerrainVoxel V = ModPair.Value;
				Ar << Idx << V.TypeID << V.PaletteIndex << V.Flags;
			}
		}
	}
	else
	{
		Modifications.Reset();

		int32 ChunkCount = 0;
		Ar << ChunkCount;

		for (int32 i = 0; i < ChunkCount; ++i)
		{
			FIntVector Coord;
			Ar << Coord;

			int32 ModCount = 0;
			Ar << ModCount;

			TMap<uint16, FHktTerrainVoxel>& ModMap = Modifications.FindOrAdd(Coord);
			for (int32 j = 0; j < ModCount; ++j)
			{
				uint16 Idx = 0;
				FHktTerrainVoxel V;
				Ar << Idx << V.TypeID << V.PaletteIndex << V.Flags;
				ModMap.Add(Idx, V);
			}
		}
	}
}

void FHktTerrainState::CopyFrom(const FHktTerrainState& Other)
{
	LoadedChunks = Other.LoadedChunks;
	Modifications = Other.Modifications;
	HeightmapCache = Other.HeightmapCache;
}

// ============================================================================
// 하이트맵 캐시 내부 구현
// ============================================================================

void FHktTerrainState::RebuildHeightmapColumn(int32 WorldVoxelX, int32 WorldVoxelY)
{
	const int32 ChunkX = FloorDiv(WorldVoxelX, ChunkSize);
	const int32 ChunkY = FloorDiv(WorldVoxelY, ChunkSize);
	const FIntVector HmKey(ChunkX, ChunkY, 0);

	TArray<int32>* Heightmap = HeightmapCache.Find(HmKey);
	if (!Heightmap)
	{
		return; // 아직 하이트맵이 없으면 무시 (청크 로드 시 전체 빌드됨)
	}

	// 이 XY 열에 해당하는 로드된 청크의 Z 범위 파악
	int32 MinChunkZ = MAX_int32;
	int32 MaxChunkZ = MIN_int32;
	for (const auto& Pair : LoadedChunks)
	{
		if (Pair.Key.X == ChunkX && Pair.Key.Y == ChunkY)
		{
			MinChunkZ = FMath::Min(MinChunkZ, Pair.Key.Z);
			MaxChunkZ = FMath::Max(MaxChunkZ, Pair.Key.Z);
		}
	}

	if (MinChunkZ > MaxChunkZ)
	{
		return;
	}

	// 위에서 아래로 탐색
	const int32 TopZ = (MaxChunkZ + 1) * ChunkSize - 1;
	const int32 BottomZ = MinChunkZ * ChunkSize;
	int32 SurfaceZ = BottomZ;

	for (int32 Z = TopZ; Z >= BottomZ; --Z)
	{
		if (IsSolid(WorldVoxelX, WorldVoxelY, Z))
		{
			SurfaceZ = Z + 1;
			break;
		}
	}

	const int32 LX = FloorMod(WorldVoxelX, ChunkSize);
	const int32 LY = FloorMod(WorldVoxelY, ChunkSize);
	(*Heightmap)[LX + LY * ChunkSize] = SurfaceZ;
}

void FHktTerrainState::RebuildHeightmapForChunk(const FIntVector& ChunkCoord)
{
	const int32 ChunkX = ChunkCoord.X;
	const int32 ChunkY = ChunkCoord.Y;
	const FIntVector HmKey(ChunkX, ChunkY, 0);

	// 이 XY 열의 로드된 Z 범위 파악
	int32 MinChunkZ = MAX_int32;
	int32 MaxChunkZ = MIN_int32;
	for (const auto& Pair : LoadedChunks)
	{
		if (Pair.Key.X == ChunkX && Pair.Key.Y == ChunkY)
		{
			MinChunkZ = FMath::Min(MinChunkZ, Pair.Key.Z);
			MaxChunkZ = FMath::Max(MaxChunkZ, Pair.Key.Z);
		}
	}

	if (MinChunkZ > MaxChunkZ)
	{
		HeightmapCache.Remove(HmKey);
		return;
	}

	TArray<int32>& Heightmap = HeightmapCache.FindOrAdd(HmKey);
	if (Heightmap.Num() != ChunkSize * ChunkSize)
	{
		Heightmap.SetNumZeroed(ChunkSize * ChunkSize);
	}

	const int32 WorldBaseX = ChunkX * ChunkSize;
	const int32 WorldBaseY = ChunkY * ChunkSize;
	const int32 TopZ = (MaxChunkZ + 1) * ChunkSize - 1;
	const int32 BottomZ = MinChunkZ * ChunkSize;

	for (int32 LY = 0; LY < ChunkSize; ++LY)
	{
		for (int32 LX = 0; LX < ChunkSize; ++LX)
		{
			const int32 WX = WorldBaseX + LX;
			const int32 WY = WorldBaseY + LY;
			int32 SurfaceZ = BottomZ;

			for (int32 Z = TopZ; Z >= BottomZ; --Z)
			{
				if (IsSolid(WX, WY, Z))
				{
					SurfaceZ = Z + 1;
					break;
				}
			}

			Heightmap[LX + LY * ChunkSize] = SurfaceZ;
		}
	}
}
