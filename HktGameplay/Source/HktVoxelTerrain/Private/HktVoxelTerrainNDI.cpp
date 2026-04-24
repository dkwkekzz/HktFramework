// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVoxelTerrainNDI.h"
#include "HktVoxelSpriteTerrainActor.h"

void UHktVoxelTerrainNDI::PushSurfaceCells(TArrayView<const FHktVoxelSurfaceCell> Cells)
{
	CachedCellCount.store(Cells.Num(), std::memory_order_release);

	// TODO: ENQUEUE_RENDER_COMMAND로 RT에 structured buffer 업로드
	//   - FRHICommandListImmediate에서 FRWBuffer 리사이즈 + UpdateBuffer
	//   - 동일 프레임 내 중복 Push는 최신값으로 overwrite
}
