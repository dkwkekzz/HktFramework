// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVoxelTerrainNDI.h"
#include "HktVoxelSpriteTerrainActor.h"
#include "NiagaraComponent.h"
#include "NiagaraDataInterfaceArrayFunctionLibrary.h"

void UHktVoxelTerrainNDI::PushSurfaceCells(
	UNiagaraComponent* NiagaraComponent,
	TArrayView<const FHktVoxelSurfaceCell> Cells,
	const FParamNames& ParamNames)
{
	CachedCellCount = Cells.Num();

	if (!NiagaraComponent)
	{
		return;
	}

	const int32 Num = Cells.Num();
	ScratchPositions.SetNumUninitialized(Num);
	ScratchTypeIDs.SetNumUninitialized(Num);
	ScratchPaletteIndices.SetNumUninitialized(Num);
	ScratchFlags.SetNumUninitialized(Num);

	for (int32 i = 0; i < Num; ++i)
	{
		const FHktVoxelSurfaceCell& C = Cells[i];
		ScratchPositions[i] = C.WorldPos;
		ScratchTypeIDs[i] = static_cast<int32>(C.TypeID);
		ScratchPaletteIndices[i] = static_cast<int32>(C.PaletteIndex);
		ScratchFlags[i] = static_cast<int32>(C.Flags);
	}

	UNiagaraDataInterfaceArrayFunctionLibrary::SetNiagaraArrayPosition(
		NiagaraComponent, ParamNames.Positions, ScratchPositions);
	UNiagaraDataInterfaceArrayFunctionLibrary::SetNiagaraArrayInt32(
		NiagaraComponent, ParamNames.TypeIDs, ScratchTypeIDs);
	UNiagaraDataInterfaceArrayFunctionLibrary::SetNiagaraArrayInt32(
		NiagaraComponent, ParamNames.PaletteIndices, ScratchPaletteIndices);
	UNiagaraDataInterfaceArrayFunctionLibrary::SetNiagaraArrayInt32(
		NiagaraComponent, ParamNames.Flags, ScratchFlags);
}
