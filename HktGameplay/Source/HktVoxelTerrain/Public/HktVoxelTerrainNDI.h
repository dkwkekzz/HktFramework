// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "UObject/Object.h"
#include "HktVoxelTerrainNDI.generated.h"

struct FHktVoxelSurfaceCell;
class UNiagaraComponent;

/**
 * UHktVoxelTerrainNDI — Sprite 테레인용 Niagara Array DI 바인더.
 *
 * AHktVoxelSpriteTerrainActor가 매 Tick 수집한 SurfaceCell 배열을 Niagara
 * Component의 User Parameter Array Data Interface(들)로 분해·업로드한다.
 *
 * 본 클래스는 UNiagaraDataInterface 서브클래스가 "아니다" — 커스텀 DI는
 * ~20 particle 규모에 과잉이라 내장 Array DI(Position/Int32)를 사용한다.
 * 추후 voxel 단위(수만~수십만 particle)로 확장하거나 GPU Simulation Stage가
 * 필요해지면 본 클래스를 커스텀 DI로 교체한다.
 *
 * 전제 Niagara User Parameter 이름 (AHktVoxelSpriteTerrainActor에서 오버라이드):
 *   - Positions     : Array Position DI  (TArray<FVector>)
 *   - TypeIDs       : Array Int32 DI     (TArray<int32>)
 *   - PaletteIndices: Array Int32 DI     (TArray<int32>)
 *   - Flags         : Array Int32 DI     (TArray<int32>)
 */
UCLASS()
class HKTVOXELTERRAIN_API UHktVoxelTerrainNDI : public UObject
{
	GENERATED_BODY()

public:
	/** 기본 User Parameter 이름 세트 — Actor가 FName UPROPERTY로 오버라이드 가능 */
	struct FParamNames
	{
		FName Positions = TEXT("Positions");
		FName TypeIDs = TEXT("TypeIDs");
		FName PaletteIndices = TEXT("PaletteIndices");
		FName Flags = TEXT("Flags");
	};

	/**
	 * SurfaceCell 배열을 분해해 NiagaraComponent의 Array DI User Parameter에 업로드.
	 * Cells가 비어있으면 모든 배열을 0-length로 설정하여 Emitter를 idle 상태로 둔다.
	 */
	void PushSurfaceCells(
		UNiagaraComponent* NiagaraComponent,
		TArrayView<const FHktVoxelSurfaceCell> Cells,
		const FParamNames& ParamNames);

	/** 최근 Push된 셀 수 (디버그/검증용) */
	int32 GetCachedCellCount() const { return CachedCellCount; }

private:
	int32 CachedCellCount = 0;

	/** Push 재사용용 스크래치 버퍼 — 매 Push마다 재할당 방지 */
	TArray<FVector> ScratchPositions;
	TArray<int32> ScratchTypeIDs;
	TArray<int32> ScratchPaletteIndices;
	TArray<int32> ScratchFlags;
};
