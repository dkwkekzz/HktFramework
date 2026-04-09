// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Data/HktVoxelTypes.h"

/** 스레드 안전 청크 공유 포인터 — 워커 태스크가 캡처하여 청크 수명을 보장 */
using FHktVoxelChunkRef = TSharedPtr<FHktVoxelChunk, ESPMode::ThreadSafe>;

/**
 * FHktVoxelRenderCache
 *
 * VM 복셀 상태의 UE5 측 읽기 전용 사본.
 * VM이 발행한 VoxelDelta를 적용하여 렌더링용 청크 데이터를 관리한다.
 *
 * 소유권 원칙:
 *   복셀 데이터의 유일한 소유자 = VM
 *   이 캐시는 "렌더링 전용 사본"으로 VM과 1~2틱 지연 허용
 *
 * 스레드 안전:
 *   ApplyVoxelDelta / LoadChunk / UnloadChunk = Game Thread에서 호출
 *   GetDirtyChunks / GetChunk = 메싱 스케줄러가 호출 (Game Thread)
 *   메싱 워커는 GetChunkRef()로 받은 TSharedPtr를 캡처하여 청크 수명을 보장
 */
class HKTVOXELCORE_API FHktVoxelRenderCache
{
public:
	FHktVoxelRenderCache() = default;
	~FHktVoxelRenderCache() = default;

	// Non-copyable
	FHktVoxelRenderCache(const FHktVoxelRenderCache&) = delete;
	FHktVoxelRenderCache& operator=(const FHktVoxelRenderCache&) = delete;

	/** VM delta 적용 — 단일 복셀 변경 */
	void ApplyVoxelDelta(const FIntVector& ChunkCoord, uint16 LocalIndex, FHktVoxel NewValue);

	/** 초기 청크 로드 (VM에서 청크 전체 데이터 수신 시) */
	void LoadChunk(const FIntVector& ChunkCoord, const FHktVoxel* VoxelData, int32 VoxelCount);

	/** 청크 해제 — 맵에서 제거. 워커 태스크가 TSharedPtr를 보유 중이면 태스크 완료 후 해제 */
	void UnloadChunk(const FIntVector& ChunkCoord);

	/** dirty 청크 목록 반환 (메싱 스케줄러용) */
	void GetDirtyChunks(TArray<FIntVector>& OutDirtyChunks) const;

	/** 메싱/렌더링용 청크 접근 (raw 포인터 — 동일 프레임 내 유효) */
	FHktVoxelChunk* GetChunk(const FIntVector& ChunkCoord);
	const FHktVoxelChunk* GetChunk(const FIntVector& ChunkCoord) const;

	/** 워커 태스크용 청크 참조 — TSharedPtr 캡처로 청크 수명 보장 */
	FHktVoxelChunkRef GetChunkRef(const FIntVector& ChunkCoord);

	/** 로드된 청크 수 */
	int32 GetChunkCount() const;

	/** 모든 청크 해제 */
	void Clear();

private:
	TMap<FIntVector, FHktVoxelChunkRef> Chunks;
	mutable FCriticalSection ChunkLock;
};
