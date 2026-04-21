// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Meshing/HktVoxelMeshScheduler.h"
#include "Meshing/HktVoxelMesher.h"
#include "Data/HktVoxelRenderCache.h"
#include "Data/HktVoxelTypes.h"
#include "HktVoxelCoreLog.h"
#include "Tasks/Task.h"

FHktVoxelMeshScheduler::FHktVoxelMeshScheduler(FHktVoxelRenderCache* InRenderCache)
	: RenderCache(InRenderCache)
{
}

FHktVoxelMeshScheduler::~FHktVoxelMeshScheduler()
{
	Flush();
}

void FHktVoxelMeshScheduler::Flush()
{
	for (UE::Tasks::FTask& Task : PendingTasks)
	{
		Task.Wait();
	}
	PendingTasks.Empty();
}

void FHktVoxelMeshScheduler::Tick(const FVector& CameraPos)
{
	if (!RenderCache)
	{
		return;
	}

	// 완료된 태스크 제거
	PendingTasks.RemoveAllSwap([](const UE::Tasks::FTask& Task) { return Task.IsCompleted(); });

	TArray<FIntVector> DirtyChunks;
	RenderCache->GetDirtyChunks(DirtyChunks);

	if (DirtyChunks.Num() == 0)
	{
		return;
	}

	// 카메라 거리 기준 우선순위 정렬 (가까운 청크 먼저)
	DirtyChunks.Sort([&](const FIntVector& A, const FIntVector& B)
	{
		return FVector::DistSquared(ChunkToWorld(A), CameraPos)
			 < FVector::DistSquared(ChunkToWorld(B), CameraPos);
	});

	const int32 Count = FMath::Min(DirtyChunks.Num(), MaxMeshPerFrame);
	for (int32 i = 0; i < Count; i++)
	{
		// TSharedPtr로 청크 참조 획득 — 태스크가 실행 중에 UnloadChunk이 호출되어도 안전
		FHktVoxelChunkRef ChunkRef = RenderCache->GetChunkRef(DirtyChunks[i]);
		if (!ChunkRef || !ChunkRef->bMeshDirty)
		{
			continue;
		}

		// dirty 해제 + 세대 캡처하여 메싱 중 새 delta가 들어오면 결과를 버릴 수 있도록
		ChunkRef->bMeshDirty.store(false, std::memory_order_relaxed);
		const uint32 Gen = ChunkRef->MeshGeneration.load(std::memory_order_acquire);
		const int32 LOD = (int32)ChunkRef->RequestedLOD.load(std::memory_order_acquire);

		const bool bDS = bDoubleSided;
		PendingTasks.Add(UE::Tasks::Launch(
			TEXT("HktVoxelMeshing"),
			[ChunkRef, Gen, bDS, LOD]()
			{
				FHktVoxelMesher::MeshChunk(*ChunkRef, bDS, LOD);
				// 세대가 변경되지 않았을 때만 결과를 유효로 마킹.
				// CurrentLOD를 먼저 갱신해 게임 스레드가 bMeshReady 관측 시 LOD가 일관되도록.
				if (ChunkRef->MeshGeneration.load(std::memory_order_acquire) == Gen)
				{
					ChunkRef->CurrentLOD.store((uint8)LOD, std::memory_order_release);
					ChunkRef->bMeshReady.store(true, std::memory_order_release);
				}
			},
			UE::Tasks::ETaskPriority::BackgroundNormal
		));
	}
}

FVector FHktVoxelMeshScheduler::ChunkToWorld(const FIntVector& ChunkCoord) const
{
	const float ChunkWorldSize = FHktVoxelChunk::SIZE * VoxelSize;
	const float HalfChunk = ChunkWorldSize * 0.5f;

	return FVector(
		ChunkCoord.X * ChunkWorldSize + HalfChunk,
		ChunkCoord.Y * ChunkWorldSize + HalfChunk,
		ChunkCoord.Z * ChunkWorldSize + HalfChunk
	);
}
