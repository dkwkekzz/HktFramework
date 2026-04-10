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
	TEXT("캐릭터 주변 복셀 시각화. 0=끄기, 1=표면 경계만, 2=표면+수평 슬라이스"),
	ECVF_Default);

static TAutoConsoleVariable<int32> CVarTerrainVoxelRadius(
	TEXT("hkt.Debug.TerrainVoxelRadius"),
	5,
	TEXT("복셀 시각화 XY 반경 (복셀 단위). 기본 5"),
	ECVF_Default);

static TAutoConsoleVariable<int32> CVarShowTerrainVoxelLabels(
	TEXT("hkt.Debug.ShowTerrainVoxelLabels"),
	0,
	TEXT("표면 복셀 위에 좌표 라벨 표시. 0=끄기, 1=켜기"),
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

// --------------------------------------------------------------------------- 렌더 캐시 쿼리

static bool IsSolidRC(FHktVoxelRenderCache* Cache, int32 VX, int32 VY, int32 VZ)
{
	if (!Cache) return false;
	const FIntVector CC(FloorDiv(VX, ChunkSize), FloorDiv(VY, ChunkSize), FloorDiv(VZ, ChunkSize));
	const FHktVoxelChunk* Chunk = Cache->GetChunk(CC);
	if (!Chunk) return false;
	return !Chunk->At(FloorMod(VX, ChunkSize), FloorMod(VY, ChunkSize), FloorMod(VZ, ChunkSize)).IsEmpty();
}

static uint16 GetTypeRC(FHktVoxelRenderCache* Cache, int32 VX, int32 VY, int32 VZ)
{
	if (!Cache) return 0;
	const FIntVector CC(FloorDiv(VX, ChunkSize), FloorDiv(VY, ChunkSize), FloorDiv(VZ, ChunkSize));
	const FHktVoxelChunk* Chunk = Cache->GetChunk(CC);
	if (!Chunk) return 0;
	return Chunk->At(FloorMod(VX, ChunkSize), FloorMod(VY, ChunkSize), FloorMod(VZ, ChunkSize)).TypeID;
}

/** 솔리드 복셀이 6방향 중 하나라도 빈 이웃을 가지면 표면 */
static bool IsSurfaceVoxel(FHktVoxelRenderCache* Cache, int32 VX, int32 VY, int32 VZ)
{
	if (!IsSolidRC(Cache, VX, VY, VZ)) return false;
	return !IsSolidRC(Cache, VX+1, VY, VZ) || !IsSolidRC(Cache, VX-1, VY, VZ)
		|| !IsSolidRC(Cache, VX, VY+1, VZ) || !IsSolidRC(Cache, VX, VY-1, VZ)
		|| !IsSolidRC(Cache, VX, VY, VZ+1) || !IsSolidRC(Cache, VX, VY, VZ-1);
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
	const int32 RadiusXY = FMath::Clamp(CVarTerrainVoxelRadius.GetValueOnGameThread(), 2, 12);
	const bool bShowLabels = CVarShowTerrainVoxelLabels.GetValueOnGameThread() > 0;

	// Subject 엔티티 위치
	UHktPresentationSubsystem* Sub = LocalPlayer.IsValid()
		? LocalPlayer->GetSubsystem<UHktPresentationSubsystem>() : nullptr;
	if (!Sub) return;

	const FHktEntityId SubjectId = Sub->GetSubjectEntityId();
	if (SubjectId == InvalidEntityId) return;

	const FHktEntityPresentation* Entity = State.Get(SubjectId);
	if (!Entity) return;

	// RenderLocation은 CapsuleHalfHeight가 더해진 렌더용 위치.
	// 시뮬레이션(MovementSystem/PhysicsSystem)은 raw PosZ를 사용하므로
	// CapsuleHalfHeight를 빼서 실제 충돌 판정 위치와 일치시킨다.
	const FVector RenderPos = Entity->RenderLocation.Get().IsZero()
		? Entity->Location.Get() : Entity->RenderLocation.Get();
	const FVector EntityPos(RenderPos.X, RenderPos.Y, RenderPos.Z - Entity->CapsuleHalfHeight);
	const float ColRadius = FMath::Max(Entity->CollisionRadius.Get(), 30.0f);

	// AHktVoxelTerrainActor 탐색
	AHktVoxelTerrainActor* TerrainActor = nullptr;
	for (TActorIterator<AHktVoxelTerrainActor> It(World); It; ++It)
	{
		TerrainActor = *It;
		break;
	}
	FHktVoxelRenderCache* RC = TerrainActor ? TerrainActor->GetTerrainCache() : nullptr;
	if (!RC) return;

	const FIntVector CV = CmToVoxel(EntityPos); // 엔티티 중심 복셀
	const FVector HE(VoxelSizeCm * 0.5f);       // 복셀 반절 크기
	constexpr int32 ZScanUp = 3;
	constexpr int32 ZScanDown = 2;

	int32 SurfaceCount = 0;

	// =========================================================================
	// 1. 표면 경계 복셀 — 솔리드이면서 빈 이웃이 있는 복셀만 그린다
	// =========================================================================
	for (int32 DZ = -ZScanDown; DZ <= ZScanUp; ++DZ)
	{
		for (int32 DY = -RadiusXY; DY <= RadiusXY; ++DY)
		{
			for (int32 DX = -RadiusXY; DX <= RadiusXY; ++DX)
			{
				const int32 VX = CV.X + DX;
				const int32 VY = CV.Y + DY;
				const int32 VZ = CV.Z + DZ;

				if (!IsSurfaceVoxel(RC, VX, VY, VZ))
					continue;

				++SurfaceCount;
				const FVector Pos = VoxelToCm(FIntVector(VX, VY, VZ));

				// 엔티티 충돌 반경과 겹치는 표면 = 빨강, 아니면 초록
				const float DistToEntity = FVector::Dist(Pos, EntityPos);
				const bool bInCollisionRange = (DistToEntity < ColRadius + VoxelSizeCm);

				const FColor Color = bInCollisionRange
					? FColor(255, 50, 50)    // 빨강 — 충돌 범위 내 표면
					: FColor(50, 220, 50);   // 초록 — 안전 표면
				const float Thickness = bInCollisionRange ? 2.0f : 1.0f;

				DrawDebugBox(World, Pos, HE, Color, false, -1.f, SDPG_Foreground, Thickness);

				if (bShowLabels && bInCollisionRange)
				{
					const uint16 TypeID = GetTypeRC(RC, VX, VY, VZ);
					DrawDebugString(World, Pos + FVector(0, 0, VoxelSizeCm * 0.6f),
						FString::Printf(TEXT("V(%d,%d,%d) T:%d"), VX, VY, VZ, TypeID),
						nullptr, FColor::White, -1.f, false, 0.8f);
				}
			}
		}
	}

	// =========================================================================
	// 2. 수평 슬라이스 (Mode 2) — 엔티티 발밑 Z의 XY 평면을 그리드로 표시
	//    솔리드=회색 채움, 빈 공간=얇은 점선, 충돌 영역 표시
	// =========================================================================
	if (Mode >= 2)
	{
		const int32 SliceZ = CV.Z; // 발밑 Z 레벨

		for (int32 DY = -RadiusXY; DY <= RadiusXY; ++DY)
		{
			for (int32 DX = -RadiusXY; DX <= RadiusXY; ++DX)
			{
				const int32 VX = CV.X + DX;
				const int32 VY = CV.Y + DY;
				const FVector Pos = VoxelToCm(FIntVector(VX, VY, SliceZ));
				const bool bSolid = IsSolidRC(RC, VX, VY, SliceZ);

				if (bSolid)
				{
					// 솔리드: 회색 바닥면 라인
					const FVector Lo(Pos.X - HE.X, Pos.Y - HE.Y, Pos.Z - HE.Z);
					const FVector Hi(Pos.X + HE.X, Pos.Y + HE.Y, Pos.Z - HE.Z);
					DrawDebugBox(World,
						FVector((Lo.X+Hi.X)*0.5f, (Lo.Y+Hi.Y)*0.5f, Lo.Z),
						FVector(HE.X, HE.Y, 0.5f),
						FColor(100, 100, 100), false, -1.f, SDPG_Foreground, 0.5f);
				}
				else
				{
					// 빈 공간: 아주 얇은 점
					DrawDebugPoint(World, Pos, 2.0f,
						FColor(40, 40, 40), false, -1.f, SDPG_Foreground);
				}
			}
		}
	}

	// =========================================================================
	// 3. 엔티티 정보 — 충돌 반경 원 + 중심 마커 + 충돌 테스트 포인트
	// =========================================================================

	// 충돌 반경을 수평 원으로 표시 — 렌더 위치(캐릭터 시각 위치)에 그린다
	DrawDebugCircle(World, RenderPos, ColRadius, 32,
		FColor(255, 165, 0), false, -1.f, SDPG_Foreground, 2.0f,
		FVector(0,1,0), FVector(1,0,0), false);

	// 중심 복셀 — 시안 굵은 선
	{
		const FVector CenterCm = VoxelToCm(CV);
		DrawDebugBox(World, CenterCm, HE, FColor::Cyan, false, -1.f, SDPG_Foreground, 2.5f);
	}

	// MovementSystem의 벽 충돌 테스트 포인트 시각화
	// (BodyZ = CurZ + VoxelSizeCm 에서 EdgeX, EdgeY 검사)
	{
		const float BodyZ = EntityPos.Z + VoxelSizeCm;

		// +X / -X 방향 테스트 포인트
		const FVector TestPosXp(EntityPos.X + ColRadius, EntityPos.Y, BodyZ);
		const FVector TestNegXp(EntityPos.X - ColRadius, EntityPos.Y, BodyZ);
		// +Y / -Y 방향 테스트 포인트
		const FVector TestPosYp(EntityPos.X, EntityPos.Y + ColRadius, BodyZ);
		const FVector TestNegYp(EntityPos.X, EntityPos.Y - ColRadius, BodyZ);

		const float PtSize = 8.0f;
		auto DrawTestPoint = [&](const FVector& Pt)
		{
			const FIntVector PtV = CmToVoxel(Pt);
			const bool bBlocked = IsSolidRC(RC, PtV.X, PtV.Y, PtV.Z);
			const FColor C = bBlocked ? FColor::Red : FColor::Green;
			DrawDebugPoint(World, Pt, PtSize, C, false, -1.f, SDPG_Foreground);
			// 테스트 포인트에서 엔티티 중심까지 선
			DrawDebugLine(World, EntityPos, Pt, FColor(180, 180, 180), false, -1.f, SDPG_Foreground, 0.5f);
		};

		DrawTestPoint(TestPosXp);
		DrawTestPoint(TestNegXp);
		DrawTestPoint(TestPosYp);
		DrawTestPoint(TestNegYp);
	}

	// =========================================================================
	// 4. HUD 요약 — 엔티티 상단에 핵심 정보만 한 줄
	// =========================================================================
	{
		const bool bCenterSolid = IsSolidRC(RC, CV.X, CV.Y, CV.Z);

		const FString Summary = FString::Printf(
			TEXT("V(%d,%d,%d) R=%.0f Surface=%d %s"),
			CV.X, CV.Y, CV.Z, ColRadius, SurfaceCount,
			bCenterSolid ? TEXT("!! INSIDE SOLID !!") : TEXT(""));

		const FColor SumColor = bCenterSolid ? FColor::Red : FColor::White;
		DrawDebugString(World,
			RenderPos + FVector(0, 0, ColRadius + 40.f),
			Summary, nullptr, SumColor, -1.f, false, 1.0f);
	}

	// Insights 데이터 수집
	HKT_INSIGHT_COLLECT(TEXT("Terrain.Debug"), TEXT("SubjectEntity"),
		FString::Printf(TEXT("%d"), SubjectId));
	HKT_INSIGHT_COLLECT(TEXT("Terrain.Debug"), TEXT("VoxelCoord"),
		FString::Printf(TEXT("(%d, %d, %d)"), CV.X, CV.Y, CV.Z));
	HKT_INSIGHT_COLLECT(TEXT("Terrain.Debug"), TEXT("CollisionRadius"),
		FString::Printf(TEXT("%.1f"), ColRadius));
	HKT_INSIGHT_COLLECT(TEXT("Terrain.Debug"), TEXT("SurfaceVoxels"),
		FString::Printf(TEXT("%d"), SurfaceCount));
	HKT_INSIGHT_COLLECT(TEXT("Terrain.Debug"), TEXT("CenterSolid"),
		IsSolidRC(RC, CV.X, CV.Y, CV.Z) ? TEXT("YES") : TEXT("No"));
}

void FHktTerrainDebugRenderer::Teardown()
{
	LocalPlayer = nullptr;
}

#endif // ENABLE_HKT_INSIGHTS
