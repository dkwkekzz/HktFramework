// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Terrain/HktTerrainVoxel.h"
#include "HktCoreEvents.h"

class FHktTerrainGenerator;

/**
 * FHktTerrainState — 시뮬레이션 런타임 지형 상태
 *
 * 결정론적 시뮬레이션에서 복셀 지형을 관리한다.
 * 생성기(FHktTerrainGenerator)로 청크를 로드하고,
 * 플레이어/VM 변형을 오버레이로 추적한다.
 *
 * 순수 C++ — UObject/UWorld 참조 없음.
 *
 * 좌표 체계:
 *   월드 복셀 좌표 = ChunkCoord * ChunkSize + LocalCoord
 *   인덱스(LocalIndex) = X + Y * ChunkSize + Z * ChunkSize * ChunkSize
 */
struct HKTCORE_API FHktTerrainState
{
	static constexpr int32 ChunkSize = 32;
	static constexpr int32 VoxelsPerChunk = ChunkSize * ChunkSize * ChunkSize; // 32768

	// ============================================================================
	// 단일 출처 설정값
	// ============================================================================

	/**
	 * 복셀 1개의 월드 크기 (cm). Generator의 Config에서 복사된다.
	 * 시뮬레이션 시스템(Movement/Physics)이 cm↔voxel 변환에 사용.
	 * 기본 15.0f — LoadChunk 최초 호출 시 Generator의 값으로 갱신.
	 */
	float VoxelSizeCm = 15.0f;

	// ============================================================================
	// 로드된 청크 캐시
	// ============================================================================

	/** 로드된 청크: ChunkCoord → 32768개 FHktTerrainVoxel 배열 */
	TMap<FIntVector, TArray<FHktTerrainVoxel>> LoadedChunks;

	/**
	 * 변형 오버레이: ChunkCoord → { LocalIndex → 변형된 복셀 }
	 * 생성기 결과 위에 덮어쓰는 수정사항만 저장 (메모리 절약).
	 * 직렬화/롤백 시 이것만 전송/복원하면 된다.
	 */
	TMap<FIntVector, TMap<uint16, FHktTerrainVoxel>> Modifications;

	/**
	 * 하이트맵 캐시: (ChunkX, ChunkY) → 32×32 표면 높이 배열 (월드 복셀 Z)
	 * LoadChunk/SetVoxel 시 자동 갱신. GetSurfaceHeightAt O(1) 조회 지원.
	 * Key의 Z 컴포넌트는 항상 0.
	 */
	TMap<FIntVector, TArray<int32>> HeightmapCache;

	// ============================================================================
	// 청크 생명주기
	// ============================================================================

	/** 생성기로 청크를 생성하여 캐시에 로드. 이미 로드된 경우 무시. */
	void LoadChunk(const FIntVector& Coord, const FHktTerrainGenerator& Generator);

	/** 청크를 캐시에서 언로드 (Modifications는 유지). */
	void UnloadChunk(const FIntVector& Coord);

	/** 청크가 로드되어 있는지 확인 */
	bool IsChunkLoaded(const FIntVector& Coord) const;

	/** 로드된 청크 수 */
	int32 GetLoadedChunkCount() const { return LoadedChunks.Num(); }

	// ============================================================================
	// 복셀 쿼리 (월드 복셀 좌표 기반)
	// ============================================================================

	/** 특정 월드 복셀 좌표의 복셀을 반환. 로드되지 않은 청크는 빈 복셀 반환. */
	FHktTerrainVoxel GetVoxel(int32 WorldX, int32 WorldY, int32 WorldZ) const;

	/** 특정 월드 복셀 좌표의 TypeID 반환 (0 = 빈 공간) */
	uint16 GetVoxelType(int32 WorldX, int32 WorldY, int32 WorldZ) const;

	/** 특정 월드 복셀 좌표가 고체(TypeID != 0)인지 확인 */
	bool IsSolid(int32 WorldX, int32 WorldY, int32 WorldZ) const;

	/**
	 * 특정 XY 열의 최상단 고체 복셀의 Z+1을 반환 (표면 높이).
	 * HeightmapCache를 사용하여 O(1) 조회.
	 * 캐시에 없으면 0 반환.
	 */
	int32 GetSurfaceHeightAt(int32 WorldVoxelX, int32 WorldVoxelY) const;

	// ============================================================================
	// 복셀 변형
	// ============================================================================

	/**
	 * 특정 월드 복셀 좌표의 복셀을 변형한다.
	 * Modifications 오버레이에 기록하고, 로드된 청크 캐시도 갱신.
	 * FHktVoxelDelta를 OutDeltas에 추가.
	 */
	void SetVoxel(int32 WorldX, int32 WorldY, int32 WorldZ,
	              const FHktTerrainVoxel& Voxel,
	              TArray<FHktVoxelDelta>& OutDeltas);

	// ============================================================================
	// 직렬화 / 복사
	// ============================================================================

	/** Modifications만 직렬화 (생성기 결과는 시드로 재생성 가능) */
	void SerializeModifications(FArchive& Ar);

	/** 전체 상태 복사 (롤백/예측용) */
	void CopyFrom(const FHktTerrainState& Other);

	// ============================================================================
	// 좌표 변환 헬퍼 (static)
	// ============================================================================

	/** 월드 복셀 좌표 → 청크 좌표 */
	static FIntVector WorldToChunk(int32 X, int32 Y, int32 Z);

	/** 월드 복셀 좌표 → 청크 내 로컬 인덱스 (0~32767) */
	static uint16 WorldToLocalIndex(int32 X, int32 Y, int32 Z);

	/** 청크 내 로컬 인덱스 → 로컬 XYZ 좌표 */
	static void LocalIndexToXYZ(uint16 Index, int32& OutX, int32& OutY, int32& OutZ);

private:
	/** FloorDiv: 음수 좌표를 올바르게 처리하는 정수 나눗셈 */
	static int32 FloorDiv(int32 A, int32 B);

	/** FloorMod: 음수 좌표를 올바르게 처리하는 나머지 (항상 0 이상) */
	static int32 FloorMod(int32 A, int32 B);

	/** 청크 로드/변형 후 해당 XY 열의 하이트맵 캐시 갱신 */
	void RebuildHeightmapColumn(int32 WorldVoxelX, int32 WorldVoxelY);

	/** 청크 전체 로드 후 32×32 하이트맵 갱신 */
	void RebuildHeightmapForChunk(const FIntVector& ChunkCoord);
};
