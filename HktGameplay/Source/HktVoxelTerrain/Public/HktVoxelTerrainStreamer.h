// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Data/HktVoxelTypes.h"

class FHktVoxelRenderCache;

/**
 * FHktVoxelTerrainStreamer
 *
 * 카메라 위치 기반으로 테레인 청크의 로드/언로드 목록을 계산한다.
 * RTS 탑다운 카메라이므로 XY 평면 거리를 기준으로 스트리밍하고,
 * Y축(높이)은 전체 로드한다.
 *
 * 프레임 예산:
 *   프레임당 MaxLoadsPerFrame개 청크만 로드 (카메라 거리 기준 partial sort로 선택)
 */
class HKTVOXELTERRAIN_API FHktVoxelTerrainStreamer
{
public:
	FHktVoxelTerrainStreamer();

	/**
	 * 스트리밍 업데이트.
	 * @param CameraPos    카메라 월드 위치
	 * @param ViewDistance  로드 유지 거리 (UE 유닛)
	 * @param ChunkWorldSize  청크 1변 월드 크기 (기본 32*100=3200)
	 */
	void UpdateStreaming(const FVector& CameraPos, float ViewDistance, float ChunkWorldSize);

	/** 이번 프레임에 로드해야 할 청크 좌표 (최대 MaxLoadsPerFrame개) */
	const TArray<FIntVector>& GetChunksToLoad() const { return ChunksToLoad; }

	/** 이번 프레임에 언로드해야 할 청크 좌표 */
	const TArray<FIntVector>& GetChunksToUnload() const { return ChunksToUnload; }

	/** 현재 로드된 청크 집합 */
	const TSet<FIntVector>& GetLoadedChunks() const { return LoadedChunkSet; }

	/** 프레임당 최대 로드 수 */
	void SetMaxLoadsPerFrame(int32 NewMax) { MaxLoadsPerFrame = NewMax; }
	int32 GetMaxLoadsPerFrame() const { return MaxLoadsPerFrame; }

	/** 동시 로드 최대 청크 수 (메모리 예산). 0이면 제한 없음 */
	void SetMaxLoadedChunks(int32 NewMax) { MaxLoadedChunks = NewMax; }

	/** 테레인 높이 범위 (Z축 청크 좌표) */
	void SetHeightRange(int32 MinZ, int32 MaxZ) { HeightMinZ = MinZ; HeightMaxZ = MaxZ; }

	void Clear();

private:
	TSet<FIntVector> LoadedChunkSet;
	TArray<FIntVector> ChunksToLoad;
	TArray<FIntVector> ChunksToUnload;

	int32 MaxLoadsPerFrame = 4;
	int32 MaxLoadedChunks = 2048;
	int32 HeightMinZ = 0;
	int32 HeightMaxZ = 3;   // Z 0~3 (128m 높이)

	FIntVector LastCameraChunk = FIntVector(INT32_MAX);
};
