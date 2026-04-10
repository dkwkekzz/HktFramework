// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktTerrainDebugRenderer.h"

#if ENABLE_HKT_INSIGHTS

#include "Engine/World.h"
#include "Engine/LocalPlayer.h"
#include "DrawDebugHelpers.h"
#include "EngineUtils.h"
#include "HktPresentationSubsystem.h"
#include "HktVoxelTerrainActor.h"
#include "Data/HktVoxelRenderCache.h"
#include "Data/HktVoxelTypes.h"
#include "HktCoreDataCollector.h"

// --------------------------------------------------------------------------- CVars

static TAutoConsoleVariable<int32> CVarShowTerrainVoxels(
	TEXT("hkt.Debug.ShowTerrainVoxels"),
	0,
	TEXT("캐릭터 주변 복셀 시각화. 0=끄기, 1=솔리드만, 2=솔리드+빈공간 그리드"),
	ECVF_Default);

static TAutoConsoleVariable<int32> CVarTerrainVoxelRadius(
	TEXT("hkt.Debug.TerrainVoxelRadius"),
	3,
	TEXT("복셀 시각화 반경 (복셀 단위). 기본 3 (7x7x7 영역)"),
	ECVF_Default);

static TAutoConsoleVariable<int32> CVarShowTerrainVoxelLabels(
	TEXT("hkt.Debug.ShowTerrainVoxelLabels"),
	0,
	TEXT("복셀 위에 좌표 라벨 표시. 0=끄기, 1=켜기"),
	ECVF_Default);

// --------------------------------------------------------------------------- 좌표 변환 헬퍼 (HktTerrainSystem과 동일)

static constexpr float VoxelSizeCm = 15.0f;
static constexpr int32 ChunkSize = 32;

static FIntVector CmToVoxel(const FVector& Pos)
{
	return FIntVector(
		FMath::FloorToInt(static_cast<float>(Pos.X) / VoxelSizeCm),
		FMath::FloorToInt(static_cast<float>(Pos.Y) / VoxelSizeCm),
		FMath::FloorToInt(static_cast<float>(Pos.Z) / VoxelSizeCm));
}

static FVector VoxelToCm(const FIntVector& V)
{
	const float Half = VoxelSizeCm * 0.5f;
	return FVector(
		V.X * VoxelSizeCm + Half,
		V.Y * VoxelSizeCm + Half,
		V.Z * VoxelSizeCm + Half);
}

static int32 FloorDiv(int32 A, int32 B)
{
	return (A >= 0) ? (A / B) : ((A - B + 1) / B);
}

static int32 FloorMod(int32 A, int32 B)
{
	const int32 R = A % B;
	return (R < 0) ? R + B : R;
}

/** 렌더 캐시에서 특정 월드 복셀의 솔리드 여부를 쿼리 */
static bool QueryRenderCacheSolid(FHktVoxelRenderCache* Cache, int32 VX, int32 VY, int32 VZ, uint16* OutTypeID = nullptr)
{
	if (!Cache)
	{
		return false;
	}

	const FIntVector ChunkCoord(FloorDiv(VX, ChunkSize), FloorDiv(VY, ChunkSize), FloorDiv(VZ, ChunkSize));
	const FHktVoxelChunk* Chunk = Cache->GetChunk(ChunkCoord);
	if (!Chunk)
	{
		return false;
	}

	const int32 LX = FloorMod(VX, ChunkSize);
	const int32 LY = FloorMod(VY, ChunkSize);
	const int32 LZ = FloorMod(VZ, ChunkSize);

	const FHktVoxel& Voxel = Chunk->At(LX, LY, LZ);
	if (OutTypeID)
	{
		*OutTypeID = Voxel.TypeID;
	}
	return !Voxel.IsEmpty();
}

// --------------------------------------------------------------------------- 색상 정의

/** 솔리드 복셀 TypeID 기반 색상 */
static FColor GetSolidVoxelColor(uint16 TypeID)
{
	// TypeID별 색상 분류 (시각적 구분 용이)
	switch (TypeID)
	{
	case 1:  return FColor(50, 200, 50);    // Grass — 초록
	case 2:  return FColor(139, 90, 43);    // Dirt — 갈색
	case 3:  return FColor(128, 128, 128);  // Stone — 회색
	case 4:  return FColor(200, 180, 120);  // Sand — 모래색
	case 5:  return FColor(60, 120, 200);   // Water — 파랑
	default: return FColor(180, 180, 50);   // 기타 — 노랑
	}
}

// --------------------------------------------------------------------------- Implementation

FHktTerrainDebugRenderer::FHktTerrainDebugRenderer(ULocalPlayer* InLP)
	: LocalPlayer(InLP)
{
}

void FHktTerrainDebugRenderer::Sync(const FHktPresentationState& State)
{
	const int32 Mode = CVarShowTerrainVoxels.GetValueOnGameThread();
	if (Mode <= 0) return;

	UWorld* World = LocalPlayer.IsValid() ? LocalPlayer->GetWorld() : nullptr;
	if (!World) return;

	DrawTerrainVoxels(World, State);
}

void FHktTerrainDebugRenderer::DrawTerrainVoxels(UWorld* World, const FHktPresentationState& State)
{
	const int32 Mode = CVarShowTerrainVoxels.GetValueOnGameThread();
	const int32 Radius = FMath::Clamp(CVarTerrainVoxelRadius.GetValueOnGameThread(), 1, 10);
	const bool bShowLabels = CVarShowTerrainVoxelLabels.GetValueOnGameThread() > 0;
	const bool bShowEmpty = (Mode >= 2);

	// Subject 엔티티 위치 가져오기
	UHktPresentationSubsystem* Sub = LocalPlayer.IsValid()
		? LocalPlayer->GetSubsystem<UHktPresentationSubsystem>()
		: nullptr;
	if (!Sub) return;

	const FHktEntityId SubjectId = Sub->GetSubjectEntityId();
	if (SubjectId == InvalidEntityId) return;

	const FHktEntityPresentation* Entity = State.Get(SubjectId);
	if (!Entity) return;

	const FVector EntityPos = Entity->RenderLocation.Get().IsZero()
		? Entity->Location.Get()
		: Entity->RenderLocation.Get();
	const float CollisionRadius = Entity->CollisionRadius.Get();

	// AHktVoxelTerrainActor 탐색 (월드에 1개 존재)
	AHktVoxelTerrainActor* TerrainActor = nullptr;
	for (TActorIterator<AHktVoxelTerrainActor> It(World); It; ++It)
	{
		TerrainActor = *It;
		break;
	}

	FHktVoxelRenderCache* RenderCache = TerrainActor ? TerrainActor->GetTerrainCache() : nullptr;

	// 엔티티 위치 → 복셀 좌표
	const FIntVector CenterVoxel = CmToVoxel(EntityPos);

	// 엔티티 충돌 구체 표시
	DrawDebugSphere(World, EntityPos, CollisionRadius, 16,
		FColor(255, 165, 0), false, -1.f, SDPG_World, 1.5f); // 오렌지

	// 엔티티 중심 복셀 표시 (굵은 선)
	{
		const FVector CenterCm = VoxelToCm(CenterVoxel);
		const FVector HalfExtent(VoxelSizeCm * 0.5f);
		DrawDebugBox(World, CenterCm, HalfExtent, FColor::Cyan, false, -1.f, SDPG_World, 3.0f);

		if (bShowLabels)
		{
			const FString Label = FString::Printf(TEXT("Center V(%d,%d,%d)"),
				CenterVoxel.X, CenterVoxel.Y, CenterVoxel.Z);
			DrawDebugString(World, CenterCm + FVector(0, 0, VoxelSizeCm),
				Label, nullptr, FColor::Cyan, -1.f, false, 1.2f);
		}
	}

	// 청크 로드 상태 정보 수집
	int32 SolidCount = 0;
	int32 EmptyCount = 0;
	int32 UnloadedCount = 0;

	// 주변 복셀 순회
	const FVector HalfExtent(VoxelSizeCm * 0.5f);

	for (int32 DZ = -Radius; DZ <= Radius; ++DZ)
	{
		for (int32 DY = -Radius; DY <= Radius; ++DY)
		{
			for (int32 DX = -Radius; DX <= Radius; ++DX)
			{
				// 중심 복셀은 위에서 이미 그림
				if (DX == 0 && DY == 0 && DZ == 0)
					continue;

				const FIntVector VoxelCoord(
					CenterVoxel.X + DX,
					CenterVoxel.Y + DY,
					CenterVoxel.Z + DZ);
				const FVector VoxelCm = VoxelToCm(VoxelCoord);

				if (!RenderCache)
				{
					// 렌더 캐시 없음 — 전부 미로드 처리
					++UnloadedCount;
					if (bShowEmpty)
					{
						DrawDebugBox(World, VoxelCm, HalfExtent,
							FColor(80, 0, 0, 40), false, -1.f, SDPG_World, 0.5f);
					}
					continue;
				}

				// 청크 로드 여부 확인
				const FIntVector ChunkCoord(
					FloorDiv(VoxelCoord.X, ChunkSize),
					FloorDiv(VoxelCoord.Y, ChunkSize),
					FloorDiv(VoxelCoord.Z, ChunkSize));
				const FHktVoxelChunk* Chunk = RenderCache->GetChunk(ChunkCoord);

				if (!Chunk)
				{
					// 청크 미로드 — 빨간 점선 표시 (시뮬레이션 미스매치 가능성)
					++UnloadedCount;
					DrawDebugBox(World, VoxelCm, HalfExtent,
						FColor(200, 0, 0, 80), false, -1.f, SDPG_World, 1.0f);

					if (bShowLabels)
					{
						DrawDebugString(World, VoxelCm, TEXT("UNLOADED"),
							nullptr, FColor::Red, -1.f, false, 0.8f);
					}
					continue;
				}

				uint16 TypeID = 0;
				const bool bSolid = QueryRenderCacheSolid(RenderCache,
					VoxelCoord.X, VoxelCoord.Y, VoxelCoord.Z, &TypeID);

				if (bSolid)
				{
					++SolidCount;
					const FColor Color = GetSolidVoxelColor(TypeID);
					DrawDebugSolidBox(World, VoxelCm, HalfExtent * 0.95f, Color.WithAlpha(60));
					DrawDebugBox(World, VoxelCm, HalfExtent, Color, false, -1.f, SDPG_World, 1.5f);

					if (bShowLabels)
					{
						const FString Label = FString::Printf(TEXT("T:%d"), TypeID);
						DrawDebugString(World, VoxelCm, Label,
							nullptr, Color, -1.f, false, 0.7f);
					}
				}
				else
				{
					++EmptyCount;
					if (bShowEmpty)
					{
						DrawDebugBox(World, VoxelCm, HalfExtent,
							FColor(60, 60, 60, 30), false, -1.f, SDPG_World, 0.3f);
					}
				}
			}
		}
	}

	// HUD 요약 정보 표시 (엔티티 위 상단)
	{
		const FString Summary = FString::Printf(
			TEXT("Voxel Debug: Solid=%d Empty=%d Unloaded=%d | Entity V(%d,%d,%d) Pos(%.0f,%.0f,%.0f) R=%.0f"),
			SolidCount, EmptyCount, UnloadedCount,
			CenterVoxel.X, CenterVoxel.Y, CenterVoxel.Z,
			EntityPos.X, EntityPos.Y, EntityPos.Z,
			CollisionRadius);
		DrawDebugString(World,
			EntityPos + FVector(0, 0, CollisionRadius + 60.f),
			Summary, nullptr, FColor::White, -1.f, false, 1.0f);
	}

	// Insights 데이터 수집 (WorldState 패널에서 확인 가능)
	HKT_INSIGHT_COLLECT(TEXT("Terrain.Debug"), TEXT("SubjectEntity"),
		FString::Printf(TEXT("%d"), SubjectId));
	HKT_INSIGHT_COLLECT(TEXT("Terrain.Debug"), TEXT("VoxelCoord"),
		FString::Printf(TEXT("(%d, %d, %d)"), CenterVoxel.X, CenterVoxel.Y, CenterVoxel.Z));
	HKT_INSIGHT_COLLECT(TEXT("Terrain.Debug"), TEXT("WorldPos"),
		FString::Printf(TEXT("(%.1f, %.1f, %.1f)"), EntityPos.X, EntityPos.Y, EntityPos.Z));
	HKT_INSIGHT_COLLECT(TEXT("Terrain.Debug"), TEXT("CollisionRadius"),
		FString::Printf(TEXT("%.1f"), CollisionRadius));
	HKT_INSIGHT_COLLECT(TEXT("Terrain.Debug"), TEXT("SolidVoxels"),
		FString::Printf(TEXT("%d"), SolidCount));
	HKT_INSIGHT_COLLECT(TEXT("Terrain.Debug"), TEXT("UnloadedChunks"),
		FString::Printf(TEXT("%d"), UnloadedCount));

	// 중심 복셀 솔리드 여부 경고 (엔티티가 솔리드 안에 있으면 빨간색 경고)
	if (RenderCache)
	{
		const bool bCenterSolid = QueryRenderCacheSolid(RenderCache,
			CenterVoxel.X, CenterVoxel.Y, CenterVoxel.Z);

		HKT_INSIGHT_COLLECT(TEXT("Terrain.Debug"), TEXT("CenterVoxelSolid"),
			bCenterSolid ? TEXT("YES — INSIDE TERRAIN") : TEXT("No"));

		if (bCenterSolid)
		{
			DrawDebugString(World,
				EntityPos + FVector(0, 0, CollisionRadius + 80.f),
				TEXT("!! ENTITY INSIDE SOLID VOXEL !!"),
				nullptr, FColor::Red, -1.f, false, 1.5f);
		}
	}
}

void FHktTerrainDebugRenderer::Teardown()
{
	LocalPlayer = nullptr;
}

#endif // ENABLE_HKT_INSIGHTS
