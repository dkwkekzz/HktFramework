// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Data/HktVoxelTypes.h"

class FHktVoxelRenderCache;

/** 단일 청크의 LOD 요청 — 스트리머가 액터에게 넘겨주는 작업 단위 */
struct FHktChunkLODRequest
{
	FIntVector Coord = FIntVector::ZeroValue;
	int32 LOD = 0;
};

/**
 * FHktVoxelTerrainStreamer
 *
 * 카메라 위치 기반 multi-ring LOD 스트리머.
 *
 * - LOD0~3 별 외곽 거리(D0..D3)로 4개 동심원을 정의.
 * - 안쪽 링은 풀 디테일(LOD0), 바깥 링으로 갈수록 다운샘플(LOD1~3) 청크 요청.
 * - LOD ≥ 2 에서는 SurfaceHeightProbe(컬럼별 최대 지표 청크 Z)로 순수 공기 청크를 스킵해
 *   horizon 영역을 채우면서 메모리/메싱 비용을 줄인다.
 * - Hysteresis(다운그레이드 5% 오버슈트)로 경계선 깜빡임 방지.
 * - 프레임 예산은 HighLOD(LOD0/1)와 LowLOD(LOD2/3) 두 갈래로 분리.
 */
class HKTVOXELTERRAIN_API FHktVoxelTerrainStreamer
{
public:
	FHktVoxelTerrainStreamer();

	/**
	 * 스트리밍 업데이트.
	 * @param CameraPos      카메라 월드 위치
	 * @param ChunkWorldSize 청크 1변 월드 크기 (= SIZE * VoxelSize)
	 *
	 * 호출 후 GetChunksToLoad/Unload/Retune로 결과 조회.
	 */
	void UpdateStreaming(const FVector& CameraPos, float ChunkWorldSize);

	/** 신규 로드 요청 (좌표 + 목표 LOD) */
	const TArray<FHktChunkLODRequest>& GetChunksToLoad() const { return ChunksToLoad; }

	/** 언로드 요청 */
	const TArray<FIntVector>& GetChunksToUnload() const { return ChunksToUnload; }

	/** 이미 로드된 청크 중 LOD 변경이 필요한 청크 (재메싱만, 보클 데이터 재생성 X) */
	const TArray<FHktChunkLODRequest>& GetChunksToRetune() const { return ChunksToRetune; }

	/** 현재 로드된 청크 → LOD 매핑 */
	const TMap<FIntVector, int32>& GetLoadedChunkLOD() const { return LoadedChunkLOD; }

	/** LOD별 로드된 청크 수 집계 (디버그/스탯용) */
	void GetLODHistogram(int32 OutCounts[4]) const;

	/** 4-원 LOD 외곽 거리 (UE 유닛). D0 < D1 < D2 < D3 권장 */
	void SetLODDistances(float D0, float D1, float D2, float D3);

	/**
	 * 프러스텀 바이어스 설정.
	 * @param ForwardXY   카메라 전방 벡터 XY 성분(정규화 필요). ZeroVector 전달 시 비활성.
	 * @param HalfFovCos  cos(HalfFOV + 마진). 이 값보다 XY dot이 작은 청크는 LOD 한 단계 강등.
	 *
	 * 효과: 프러스텀 밖(주로 카메라 뒤/옆) 청크는 한 단계 낮은 LOD로 로드되어 메싱/GPU 비용이 감소.
	 * 모든 청크는 계속 로드되므로 회전 히치는 없음. LOD3이면 더 이상 강등하지 않음.
	 */
	void SetFrustumBias(const FVector2D& ForwardXY, float HalfFovCos);

	/** 프레임 예산 — HighLOD(LOD0/1) vs LowLOD(LOD2/3) 분리 */
	void SetMaxLoadsPerFrame(int32 HighLOD, int32 LowLOD);

	/** 동시 로드 최대 청크 수 (메모리 예산). 0이면 제한 없음 */
	void SetMaxLoadedChunks(int32 NewMax) { MaxLoadedChunks = NewMax; }

	/** 테레인 높이 범위 (Z축 청크 좌표) */
	void SetHeightRange(int32 MinZ, int32 MaxZ) { HeightMinZ = MinZ; HeightMaxZ = MaxZ; }

	/**
	 * 컬럼별 최대 지표 청크 Z 프로브.
	 * Bound 시 LOD ≥ 2 영역에서 빈 공기 청크 스킵에 사용.
	 * 미바인드면 모든 LOD에서 Z 전체 로드(현행 호환).
	 */
	void SetSurfaceHeightProbe(TFunction<int32(int32 ChunkX, int32 ChunkY)> InProbe)
	{
		SurfaceHeightProbe = MoveTemp(InProbe);
		SurfaceHeightCache.Empty();
	}

	/** 디버그용 — 0~3이면 모든 청크를 해당 LOD로 강제. -1이면 정상 동작 */
	void SetForcedLOD(int32 InForcedLOD) { ForcedLOD = InForcedLOD; }
	int32 GetForcedLOD() const { return ForcedLOD; }

	void Clear();

private:
	/** 한 청크에 대한 LOD 결정 (hysteresis 포함) */
	int32 ComputeLODForChunk(float DistSqXY, int32 PrevLOD) const;

	TMap<FIntVector, int32> LoadedChunkLOD;

	// 칼럼별 이전 LOD — hysteresis 판정용. 컬럼 내 모든 Z가 동일 LOD라는 사실을
	// 3D 맵의 컨벤션으로 강요하지 않고 구조적으로 보장한다.
	TMap<FIntPoint, int32> LastColumnLOD;

	TArray<FHktChunkLODRequest> ChunksToLoad;
	TArray<FIntVector> ChunksToUnload;
	TArray<FHktChunkLODRequest> ChunksToRetune;

	// 프레임 스크래치 버퍼 — UpdateStreaming 진입 시 Reset만 수행하여 할당 재사용.
	TMap<FIntVector, int32> ScratchDesired;
	TArray<FHktChunkLODRequest> ScratchLoadCandidates;

	// 칼럼별 surface 높이 캐시 — Generator 노이즈는 deterministic이므로 영구 보관.
	// 외부에서 SurfaceHeightProbe를 교체하면 자동으로 비워진다.
	mutable TMap<FIntPoint, int32> SurfaceHeightCache;

	// LOD 외곽 거리 — Distances[i] = LOD i의 외곽 한계 (D3가 최대 가시 거리)
	// 기본: 80m / 200m / 500m / 1280m
	float Distances[4] = { 8000.f, 20000.f, 50000.f, 128000.f };

	int32 MaxLoadsPerFrameHighLOD = 4;
	int32 MaxLoadsPerFrameLowLOD = 16;
	int32 MaxLoadedChunks = 4096;
	int32 HeightMinZ = 0;
	int32 HeightMaxZ = 3;
	int32 ForcedLOD = -1;

	TFunction<int32(int32, int32)> SurfaceHeightProbe;

	// 프러스텀 바이어스 — ForwardXY가 ZeroVector면 비활성(전방향 풀 LOD).
	FVector2D FrustumForwardXY = FVector2D::ZeroVector;
	float FrustumHalfFovCos = -1.f;  // -1이면 항상 프러스텀 내부 판정(비활성)

	FIntVector LastCameraChunk = FIntVector(INT32_MAX);

	// 직전 UpdateStreaming이 어떤 work도 남기지 않은 상태 (로드/언로드/리튠 모두 0).
	// 카메라 청크가 동일하고 안정화되어 있으면 enumerate 자체를 스킵해 CPU를 절약한다.
	bool bLastUpdateStable = false;
};
