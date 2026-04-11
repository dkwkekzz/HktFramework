// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include <atomic>

// ============================================================================
// FHktVoxel — 단일 복셀 데이터 (렌더링 전용)
// ============================================================================

struct FHktVoxel
{
	uint16 TypeID = 0;        // 복셀 종류 (0 = 빈 공간)
	uint8  PaletteIndex = 0;  // 8색 팔레트 내 인덱스
	uint8  Flags = 0;         // 비트플래그: 투명, 발광, 파괴가능 등

	// 플래그 비트 정의
	static constexpr uint8 FLAG_TRANSLUCENT  = 0x01;
	static constexpr uint8 FLAG_EMISSIVE     = 0x02;
	static constexpr uint8 FLAG_DESTRUCTIBLE = 0x04;
	static constexpr uint8 FLAG_ANIMATED     = 0x08;

	bool IsEmpty() const { return TypeID == 0; }
	bool IsTranslucent() const { return (Flags & FLAG_TRANSLUCENT) != 0; }
	bool IsEmissive() const { return (Flags & FLAG_EMISSIVE) != 0; }
};

// ============================================================================
// FHktVoxelChunk — 32x32x32 복셀 청크 (렌더링 전용 사본)
// ============================================================================

#include "Meshing/HktVoxelVertex.h"

struct HKTVOXELCORE_API FHktVoxelChunk
{
	static constexpr int32   SIZE       = 32;
	// VOXEL_SIZE는 폴백 기본값 전용 — 실제 런타임 크기는 UHktRuntimeGlobalSetting::VoxelSizeCm이
	// 단일 출처이며 FHktTerrainGeneratorConfig → FHktTerrainState / AHktVoxelTerrainActor 경로로 전파된다.
	static constexpr float   VOXEL_SIZE = 15.0f;   // fallback default (UU)

	FHktVoxel Data[SIZE][SIZE][SIZE];  // ~128KB

	/**
	 * 선택적 본 인덱스 맵 — GPU 스키닝용.
	 * 엔티티 복셀에서만 할당. nullptr이면 스키닝 없음 (월드 복셀).
	 * BoneIndices[X][Y][Z] = 해당 복셀이 귀속된 본 인덱스 (0~127).
	 */
	TUniquePtr<uint8[]> BoneIndices;   // SIZE^3 = 32768 bytes (할당 시)

	/** 본 인덱스 맵 할당 (0으로 초기화) */
	void AllocBoneIndices()
	{
		BoneIndices = MakeUnique<uint8[]>(SIZE * SIZE * SIZE);
		FMemory::Memzero(BoneIndices.Get(), SIZE * SIZE * SIZE);
	}

	/** 본 인덱스 접근 (맵 할당 시에만 유효) — Data[X][Y][Z]와 동일한 레이아웃 */
	uint8 GetBoneIndex(int32 X, int32 Y, int32 Z) const
	{
		return BoneIndices ? BoneIndices[X * SIZE * SIZE + Y * SIZE + Z] : 0;
	}
	void SetBoneIndex(int32 X, int32 Y, int32 Z, uint8 Index)
	{
		if (BoneIndices) { BoneIndices[X * SIZE * SIZE + Y * SIZE + Z] = Index; }
	}

	FIntVector ChunkCoord;             // 청크 좌표 (VM 기준)
	std::atomic<bool> bMeshDirty{true};   // 재메싱 필요 (Game↔Worker 원자적)
	std::atomic<bool> bMeshReady{false};  // 메싱 완료, GPU 업로드 대기
	std::atomic<uint32> MeshGeneration{0}; // 메싱 세대 — dirty 시 증가, 메싱 시작 시 캡처하여 완료 시 비교

	// Greedy Meshing 결과 — MeshChunk()가 채움
	TArray<FHktVoxelVertex> OpaqueVertices;
	TArray<uint32> OpaqueIndices;
	TArray<FHktVoxelVertex> TranslucentVertices;
	TArray<uint32> TranslucentIndices;

	FHktVoxelChunk() = default;
	FHktVoxelChunk(FHktVoxelChunk&& Other) noexcept
		: BoneIndices(MoveTemp(Other.BoneIndices))
		, ChunkCoord(Other.ChunkCoord)
		, bMeshDirty(Other.bMeshDirty.load(std::memory_order_relaxed))
		, bMeshReady(Other.bMeshReady.load(std::memory_order_relaxed))
		, MeshGeneration(Other.MeshGeneration.load(std::memory_order_relaxed))
		, OpaqueVertices(MoveTemp(Other.OpaqueVertices))
		, OpaqueIndices(MoveTemp(Other.OpaqueIndices))
		, TranslucentVertices(MoveTemp(Other.TranslucentVertices))
		, TranslucentIndices(MoveTemp(Other.TranslucentIndices))
	{
		FMemory::Memcpy(Data, Other.Data, sizeof(Data));
	}
	FHktVoxelChunk& operator=(FHktVoxelChunk&& Other) noexcept
	{
		if (this != &Other)
		{
			FMemory::Memcpy(Data, Other.Data, sizeof(Data));
			BoneIndices = MoveTemp(Other.BoneIndices);
			ChunkCoord = Other.ChunkCoord;
			bMeshDirty.store(Other.bMeshDirty.load(std::memory_order_relaxed), std::memory_order_relaxed);
			bMeshReady.store(Other.bMeshReady.load(std::memory_order_relaxed), std::memory_order_relaxed);
			MeshGeneration.store(Other.MeshGeneration.load(std::memory_order_relaxed), std::memory_order_relaxed);
			OpaqueVertices = MoveTemp(Other.OpaqueVertices);
			OpaqueIndices = MoveTemp(Other.OpaqueIndices);
			TranslucentVertices = MoveTemp(Other.TranslucentVertices);
			TranslucentIndices = MoveTemp(Other.TranslucentIndices);
		}
		return *this;
	}
	FHktVoxelChunk(const FHktVoxelChunk&) = delete;
	FHktVoxelChunk& operator=(const FHktVoxelChunk&) = delete;

	// 복셀 접근 (로컬 좌표)
	FHktVoxel& At(int32 X, int32 Y, int32 Z) { return Data[X][Y][Z]; }
	const FHktVoxel& At(int32 X, int32 Y, int32 Z) const { return Data[X][Y][Z]; }

	// LocalIndex (0~32767) ↔ 로컬 좌표 변환
	static FIntVector IndexToLocal(uint16 LocalIndex)
	{
		return FIntVector(
			LocalIndex % SIZE,
			(LocalIndex / SIZE) % SIZE,
			LocalIndex / (SIZE * SIZE)
		);
	}

	static uint16 LocalToIndex(int32 X, int32 Y, int32 Z)
	{
		return static_cast<uint16>(X + Y * SIZE + Z * SIZE * SIZE);
	}
};

// FHktVoxelDelta는 HktCoreEvents.h에서 정의됨 (HktCore 모듈)
