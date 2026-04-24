// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVoxelSpriteTerrainActor.h"
#include "HktVoxelTerrainNDI.h"
#include "NiagaraComponent.h"
#include "NiagaraSystem.h"

AHktVoxelSpriteTerrainActor::AHktVoxelSpriteTerrainActor()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.TickGroup = TG_DuringPhysics;

	NiagaraComponent = CreateDefaultSubobject<UNiagaraComponent>(TEXT("NiagaraComponent"));
	RootComponent = NiagaraComponent;
	NiagaraComponent->bAutoActivate = false;
}

void AHktVoxelSpriteTerrainActor::BeginPlay()
{
	Super::BeginPlay();

	TerrainNDI = NewObject<UHktVoxelTerrainNDI>(this);

	if (TerrainNiagaraSystem && NiagaraComponent)
	{
		NiagaraComponent->SetAsset(TerrainNiagaraSystem);
		// TODO: Niagara User Parameter("TerrainNDI")에 TerrainNDI 바인딩
		//   NiagaraComponent->SetVariableObject(TEXT("TerrainNDI"), TerrainNDI);
		NiagaraComponent->Activate(true);
	}
}

void AHktVoxelSpriteTerrainActor::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	if (NiagaraComponent)
	{
		NiagaraComponent->Deactivate();
	}
	Super::EndPlay(EndPlayReason);
}

void AHktVoxelSpriteTerrainActor::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	// 스캔 빈도 제한 — 고정 카메라라 초당 N회면 충분
	const float Now = GetWorld() ? GetWorld()->GetTimeSeconds() : 0.f;
	const float MinInterval = (MaxScansPerSecond > 0.f) ? 1.f / MaxScansPerSecond : 0.f;
	if (Now - LastScanTime < MinInterval)
	{
		return;
	}
	LastScanTime = Now;

	TArray<FHktVoxelSurfaceCell> Cells;
	ScanVisibleTopSurface(Cells);

	if (TerrainNDI)
	{
		TerrainNDI->PushSurfaceCells(Cells);
	}
}

void AHktVoxelSpriteTerrainActor::ScanVisibleTopSurface(TArray<FHktVoxelSurfaceCell>& OutCells) const
{
	OutCells.Reset();

	FHktVoxelRenderCache* Cache = ResolveRenderCache();
	if (!Cache)
	{
		return;
	}

	// TODO: 구현
	//   1) 카메라 frustum을 월드 XY 평면에 투영 (IsometricOrtho: Yaw=45°, Pitch=-60°)
	//   2) AABB padding = VisibilityPaddingUU
	//   3) AABB와 겹치는 청크만 iterate — RenderCache에 chunk iterator/키 접근자 추가 필요
	//   4) 청크당 (LocalX, LocalY) 컬럼 32x32 스캔 → Z 최대 non-empty voxel 1개만 수집
	//   5) WorldPos = ChunkCoord * ChunkWorldSize + (Local + 0.5) * VoxelSize
	//      팔레트/플래그 복사 후 OutCells.Add
	//   6) dirty-only 증분 경로는 후속: ApplyVoxelDelta 훅으로 영향 컬럼만 재계산
}

FHktVoxelRenderCache* AHktVoxelSpriteTerrainActor::ResolveRenderCache() const
{
	// TODO: 3가지 경로 중 선택 (헤더 주석 참조)
	return nullptr;
}
