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
		const float Bevel = ChunkRef->GetRequestedBevel();

		// 베벨이 활성인 청크만 6방향 이웃을 사전 조회해 태스크에 첨부.
		// 베벨 미적용 경로는 이웃 조회 오버헤드를 완전히 피한다 (기존 경로와 동일 성능).
		FHktVoxelChunkRef NegX, PosX, NegY, PosY, NegZ, PosZ;
		if (Bevel > 0.f)
		{
			const FIntVector Coord = DirtyChunks[i];
			NegX = RenderCache->GetChunkRef(Coord + FIntVector(-1, 0, 0));
			PosX = RenderCache->GetChunkRef(Coord + FIntVector(+1, 0, 0));
			NegY = RenderCache->GetChunkRef(Coord + FIntVector(0, -1, 0));
			PosY = RenderCache->GetChunkRef(Coord + FIntVector(0, +1, 0));
			NegZ = RenderCache->GetChunkRef(Coord + FIntVector(0, 0, -1));
			PosZ = RenderCache->GetChunkRef(Coord + FIntVector(0, 0, +1));
		}

		const bool bDS = bDoubleSided;
		PendingTasks.Add(UE::Tasks::Launch(
			TEXT("HktVoxelMeshing"),
			[ChunkRef, Gen, bDS, LOD, Bevel,
			 NegX = MoveTemp(NegX), PosX = MoveTemp(PosX),
			 NegY = MoveTemp(NegY), PosY = MoveTemp(PosY),
			 NegZ = MoveTemp(NegZ), PosZ = MoveTemp(PosZ)]()
			{
				FHktVoxelMeshNeighbors Neighbors;
				Neighbors.NegX = NegX.Get();
				Neighbors.PosX = PosX.Get();
				Neighbors.NegY = NegY.Get();
				Neighbors.PosY = PosY.Get();
				Neighbors.NegZ = NegZ.Get();
				Neighbors.PosZ = PosZ.Get();

				// Bevel==0이면 MeshChunk 내부에서 Neighbors를 무시한다.
				FHktVoxelMesher::MeshChunk(*ChunkRef, bDS, LOD, Bevel,
					(Bevel > 0.f) ? &Neighbors : nullptr);

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
