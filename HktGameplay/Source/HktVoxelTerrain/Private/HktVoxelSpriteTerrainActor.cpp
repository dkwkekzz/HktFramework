// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVoxelSpriteTerrainActor.h"
#include "HktVoxelTerrainActor.h"
#include "HktVoxelTerrainNDI.h"
#include "Data/HktVoxelRenderCache.h"
#include "Data/HktVoxelTypes.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/Pawn.h"
#include "Kismet/GameplayStatics.h"
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
		UHktVoxelTerrainNDI::FParamNames Names;
		Names.Positions = ParamName_Positions;
		Names.TypeIDs = ParamName_TypeIDs;
		Names.PaletteIndices = ParamName_PaletteIndices;
		Names.Flags = ParamName_Flags;

		TerrainNDI->PushSurfaceCells(NiagaraComponent, Cells, Names);
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

	// ResolveRenderCache 성공 경로에선 CachedSourceActor가 유효
	const AHktVoxelTerrainActor* VoxelActor = CachedSourceActor.Get();
	if (!VoxelActor)
	{
		return;
	}

	const float ChunkWorldSize = VoxelActor->GetChunkWorldSize();
	const float VoxelSize = VoxelActor->VoxelSize;
	if (ChunkWorldSize <= 0.f || VoxelSize <= 0.f)
	{
		return;
	}

	const FVector ViewCenter = GetViewCenterWorldPos();
	const float IncludeRadiusSq = FMath::Square(IncludeRadiusUU);

	TArray<FIntVector> Coords;
	Cache->GetAllChunkCoords(Coords);

	OutCells.Reserve(Coords.Num());

	// 청크당 top-most 1셀 — 전체 32×32 컬럼의 최상단 non-empty voxel 중 Z 최대 선택.
	// 공기 구멍이 있는 지형도 안정적으로 top을 잡는다.
	constexpr int32 S = FHktVoxelChunk::SIZE;

	for (const FIntVector& Coord : Coords)
	{
		// 청크 AABB 중심 (XY만 사용 — iso 고정각이라 Z는 무시)
		const FVector2D ChunkCenterXY(
			(Coord.X + 0.5f) * ChunkWorldSize,
			(Coord.Y + 0.5f) * ChunkWorldSize);

		const float DX = ChunkCenterXY.X - ViewCenter.X;
		const float DY = ChunkCenterXY.Y - ViewCenter.Y;
		if (DX * DX + DY * DY > IncludeRadiusSq)
		{
			continue;
		}

		const FHktVoxelChunk* Chunk = Cache->GetChunk(Coord);
		if (!Chunk)
		{
			continue;
		}

		int32 BestZ = -1;
		int32 BestX = 0;
		int32 BestY = 0;
		const FHktVoxel* BestVoxel = nullptr;

		for (int32 Y = 0; Y < S; ++Y)
		{
			for (int32 X = 0; X < S; ++X)
			{
				for (int32 Z = S - 1; Z > BestZ; --Z)
				{
					const FHktVoxel& V = Chunk->At(X, Y, Z);
					if (V.IsEmpty())
					{
						continue;
					}
					BestZ = Z;
					BestX = X;
					BestY = Y;
					BestVoxel = &V;
					break;
				}
			}
		}

		if (!BestVoxel)
		{
			continue;
		}

		FHktVoxelSurfaceCell Cell;
		Cell.WorldPos = FVector(
			Coord.X * ChunkWorldSize + (BestX + 0.5f) * VoxelSize,
			Coord.Y * ChunkWorldSize + (BestY + 0.5f) * VoxelSize,
			Coord.Z * ChunkWorldSize + (BestZ + 0.5f) * VoxelSize);
		Cell.TypeID = BestVoxel->TypeID;
		Cell.PaletteIndex = BestVoxel->PaletteIndex;
		Cell.Flags = BestVoxel->Flags;
		OutCells.Add(Cell);
	}
}

FVector AHktVoxelSpriteTerrainActor::GetViewCenterWorldPos() const
{
	if (const UWorld* World = GetWorld())
	{
		if (const APlayerController* PC = World->GetFirstPlayerController())
		{
			if (const APawn* Pawn = PC->GetPawn())
			{
				return Pawn->GetActorLocation();
			}
			FVector Pos; FRotator Rot;
			PC->GetPlayerViewPoint(Pos, Rot);
			return Pos;
		}
	}
	return FVector::ZeroVector;
}

FHktVoxelRenderCache* AHktVoxelSpriteTerrainActor::ResolveRenderCache() const
{
	// 캐시된 핸들이 아직 유효하면 즉시 반환
	if (AHktVoxelTerrainActor* Cached = CachedSourceActor.Get())
	{
		return Cached->GetTerrainCache();
	}

	UWorld* World = GetWorld();
	if (!World)
	{
		return nullptr;
	}

	// 월드에 1개 존재 가정 — 없으면 no-op. 레벨 스트리밍으로 뒤늦게 스폰돼도
	// 다음 Tick에 재시도되므로 경고 로그는 생략.
	AActor* Found = UGameplayStatics::GetActorOfClass(World, AHktVoxelTerrainActor::StaticClass());
	AHktVoxelTerrainActor* VoxelActor = Cast<AHktVoxelTerrainActor>(Found);
	if (!VoxelActor)
	{
		return nullptr;
	}

	CachedSourceActor = VoxelActor;

	// Voxel Actor가 RenderCache를 갱신한 후에 Sprite Actor가 읽도록 tick 순서 확정.
	// const_cast — resolve는 const 경로지만 tick dependency 등록은 설계상 1회 세팅이며
	// 관측 가능한 상태 변화가 없다.
	AHktVoxelSpriteTerrainActor* MutableSelf = const_cast<AHktVoxelSpriteTerrainActor*>(this);
	MutableSelf->AddTickPrerequisiteActor(VoxelActor);

	// Sprite + Voxel 동시 렌더링 감지 — chunk mesh와 sprite 평면이 Z-fighting 소지.
	// A/B 비교 중이 아니라면 Voxel Actor의 ChunkComponent를 숨기거나 한 쪽을 제거할 것.
	if (!VoxelActor->IsHidden())
	{
		UE_LOG(LogTemp, Warning,
			TEXT("[HktVoxelSpriteTerrain] AHktVoxelTerrainActor also visible — Z-fighting ")
			TEXT("possible. Hide one actor (bHiddenInGame) for clean A/B or single render."));
	}

	return VoxelActor->GetTerrainCache();
}
