// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktVoxelChunkLoader.h"

/**
 * FHktProximityChunkLoader
 *
 * 2단 링 전략 — 카메라 근거리는 풀 디테일, 원거리는 간이 모형.
 * 둘 다 뷰 무관(회전과 무관)이므로 회전 시 재계산이 일어나지 않는다.
 *
 * 동작:
 *   Near Ring (distance <= NearRadius)  → Tier::Near  (LOD 0 메시, 풀 머티리얼)
 *   Far Ring  (distance <= FarRadius)   → Tier::Far   (LOD 2 메시, 스트립 머티리얼)
 *   경계 바깥                            → 언로드
 *
 * Tier 전이:
 *   카메라가 청크 경계를 넘을 때만 스캔이 발생하며, 기존 청크의 Tier가 바뀌면
 *   ChunksToRetier에 담겨 재메시(Voxel 데이터 보존) 트리거된다.
 */
class FHktProximityChunkLoader : public IHktVoxelChunkLoader
{
public:
	void SetRadii(float InNearRadius, float InFarRadius)
	{
		NearRadius = FMath::Max(1.f, InNearRadius);
		FarRadius = FMath::Max(NearRadius + 1.f, InFarRadius);
	}

	// IHktVoxelChunkLoader
	virtual void Update(const FVector& CameraPos, float ChunkWorldSize) override;
	virtual const TArray<FHktChunkTierRequest>& GetChunksToLoad() const override { return ChunksToLoad; }
	virtual const TArray<FIntVector>& GetChunksToUnload() const override { return ChunksToUnload; }
	virtual const TArray<FHktChunkTierRequest>& GetChunksToRetier() const override { return ChunksToRetier; }
	virtual const TMap<FIntVector, EHktVoxelChunkTier>& GetLoadedChunks() const override { return LoadedChunks; }
	virtual void SetHeightRange(int32 MinZ, int32 MaxZ) override { HeightMinZ = MinZ; HeightMaxZ = MaxZ; }
	virtual void SetMaxLoadedChunks(int32 Max) override { MaxLoadedChunks = Max; }
	virtual void SetMaxLoadsPerFrame(int32 Max) override { MaxLoadsPerFrame = FMath::Max(1, Max); }
	virtual void Clear() override;
	virtual void GetTierHistogram(int32 OutCounts[2]) const override;

private:
	TMap<FIntVector, EHktVoxelChunkTier> LoadedChunks;
	TArray<FHktChunkTierRequest> ChunksToLoad;
	TArray<FIntVector> ChunksToUnload;
	TArray<FHktChunkTierRequest> ChunksToRetier;

	TMap<FIntVector, EHktVoxelChunkTier> ScratchDesired;

	float NearRadius = 1500.f;   // ≈ 3 청크 (480cm 기준)
	float FarRadius  = 8000.f;   // ≈ 16 청크
	int32 HeightMinZ = 0;
	int32 HeightMaxZ = 3;
	int32 MaxLoadedChunks = 2048;
	int32 MaxLoadsPerFrame = 16;

	FIntVector LastCameraChunk = FIntVector(INT32_MAX);
	bool bHasLastCamera = false;
};
