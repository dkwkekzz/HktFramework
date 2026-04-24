// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "NiagaraDataInterface.h"
#include <atomic>
#include "HktVoxelTerrainNDI.generated.h"

struct FHktVoxelSurfaceCell;

/**
 * UHktVoxelTerrainNDI — 스프라이트 테레인용 Niagara Data Interface.
 *
 * AHktVoxelSpriteTerrainActor가 매 프레임(혹은 dirty 시) 가시 영역 top-most
 * voxel 리스트를 PushSurfaceCells()로 업로드하면, Render Thread의 structured
 * buffer로 반영되어 Niagara Emitter가 GPU에서 직접 샘플링한다.
 *
 * Niagara HLSL 측 함수(예정):
 *   GetSurfaceCellCount(out int Count)
 *   GetSurfaceCell(int Index, out float3 WorldPos,
 *                  out int TypeID, out int PaletteIndex, out int Flags)
 *
 * 현재는 스캐폴딩 단계 — CPU-side API만 구현하고 UNiagaraDataInterface 가상
 * 함수/HLSL 바인딩은 후속 커밋에서 채운다.
 */
UCLASS(EditInlineNew, Category = "HktVoxel", meta = (DisplayName = "Hkt Voxel Terrain"))
class HKTVOXELTERRAIN_API UHktVoxelTerrainNDI : public UNiagaraDataInterface
{
	GENERATED_BODY()

public:
	// --- CPU-side API ---

	/** Surface 배열 업로드 — Game Thread에서 호출 */
	void PushSurfaceCells(TArrayView<const FHktVoxelSurfaceCell> Cells);

	/** 최근 Push된 셀 수 (디버그/검증용) */
	int32 GetCachedCellCount() const { return CachedCellCount.load(std::memory_order_acquire); }

	// --- UNiagaraDataInterface overrides ---
	// TODO: UE 5.6 NiagaraDataInterface API에 맞춰 다음 override를 채운다.
	//   CanExecuteOnTarget / Equals / CopyToInternal
	//   PerInstanceDataSize / InitPerInstanceData / DestroyPerInstanceData
	//   GetFunctionsInternal / GetFunctionHLSL / GetParameterDefinitionHLSL
	//   BuildShaderParameters / ProvideShaderParameters (RT 바인딩)
	//   RT-side FRWBuffer structured buffer 래퍼

private:
	/** 최근 Push된 셀 수 — 스레드 안전 스냅샷 */
	std::atomic<int32> CachedCellCount{0};

	// TODO: GT→RT 업로드 큐 (TArray<FHktVoxelSurfaceCell>를 RT로 enqueue)
	// TODO: RT-side structured buffer (FRWBuffer) — PerInstanceData에 보관
};
