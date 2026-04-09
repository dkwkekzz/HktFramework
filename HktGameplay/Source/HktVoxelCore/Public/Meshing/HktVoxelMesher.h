// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

struct FHktVoxel;
struct FHktVoxelChunk;

/**
 * FHktVoxelMesher — Binary Greedy Meshing
 *
 * 슬라이스별 비트마스크를 사용하여 노출된 면을 탐색하고,
 * 동일 타입의 인접 면을 병합(Greedy Merge)하여 쿼드 수를 최소화한다.
 *
 * 호출 컨텍스트: 워커 스레드 (UE::Tasks)
 * 입력: FHktVoxelChunk.Data (읽기 전용)
 * 출력: FHktVoxelChunk.Opaque/TranslucentVertices/Indices
 */
class HKTVOXELCORE_API FHktVoxelMesher
{
public:
	/** 단일 청크를 메싱 — 워커 스레드에서 호출. bDoubleSided=true면 양면 렌더링 (엔티티용) */
	static void MeshChunk(FHktVoxelChunk& Chunk, bool bDoubleSided = true);

private:
	/**
	 * 슬라이스별 노출면 비트마스크 생성
	 * OutMask[row] — 해당 행에서 노출된 복셀의 비트가 1
	 */
	static void BuildFaceMask(
		const FHktVoxelChunk& Chunk,
		int32 Face, int32 Slice,
		uint32 OutMask[32]);

	/**
	 * 비트 연산으로 인접 동일 타입 면 병합 → 쿼드 생성
	 */
	static void MergeQuads(
		FHktVoxelChunk& Chunk,
		int32 Face, int32 Slice,
		const uint32 Mask[32],
		bool bDoubleSided = true);

	/**
	 * Baked AO 계산 — 인접 복셀 기반, 버텍스당 0~3
	 * 0 = 완전 차폐, 3 = 차폐 없음
	 */
	static uint8 CalcVertexAO(
		const FHktVoxelChunk& Chunk,
		FIntVector Pos, int32 Face, int32 CornerIndex);

	/** 쿼드 4개 버텍스 + 인덱스를 청크 메시 배열에 추가. bDoubleSided=false면 back face 생략 */
	static void EmitQuad(
		FHktVoxelChunk& Chunk,
		int32 Face, int32 Slice,
		int32 StartU, int32 StartV,
		int32 Width, int32 Height,
		const FHktVoxel& Voxel,
		uint8 BoneIndex = 0,
		bool bDoubleSided = true);
};
