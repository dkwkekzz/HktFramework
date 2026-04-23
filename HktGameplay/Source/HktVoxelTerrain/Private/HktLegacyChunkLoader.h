// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktVoxelChunkLoader.h"

/**
 * FHktLegacyChunkLoader
 *
 * LOD 도입 이전 동작을 그대로 재현하는 최소 로더.
 * 카메라로부터 StreamRadius 내의 모든 컬럼을 Tier::Near 단일 계층으로 로드.
 * 프러스텀/뷰 방향과 무관 — 회전해도 재계산 없음.
 *
 * LOD 파이프라인에 문제가 있을 때 확실한 폴백으로 쓰이는 모드.
 */
class FHktLegacyChunkLoader : public IHktVoxelChunkLoader
{
public:
	void SetStreamRadius(float Radius) { StreamRadius = FMath::Max(1.f, Radius); }

	// IHktVoxelChunkLoader
	virtual void Update(const FVector& CameraPos, float ChunkWorldSize) override;
	virtual const TArray<FHktChunkTierRequest>& GetChunksToLoad() const override { return ChunksToLoad; }
	virtual const TArray<FIntVector>& GetChunksToUnload() const override { return ChunksToUnload; }
	virtual const TArray<FHktChunkTierRequest>& GetChunksToRetier() const override { return EmptyRetier; }
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
	TArray<FHktChunkTierRequest> EmptyRetier;  // Legacy는 Tier 전이 없음

	TSet<FIntVector> ScratchDesired;

	float StreamRadius = 8000.f;
	int32 HeightMinZ = 0;
	int32 HeightMaxZ = 3;
	int32 MaxLoadedChunks = 1024;
	int32 MaxLoadsPerFrame = 16;

	FIntVector LastCameraChunk = FIntVector(INT32_MAX);
	bool bHasLastCamera = false;
};
