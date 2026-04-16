// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktTerrainDebugProcessor.h"

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
	TEXT("Voxel terrain visualization around character. 0=off, 1=surface boundary, 2=surface+horizontal radius"),
	ECVF_Default);

static TAutoConsoleVariable<int32> CVarTerrainVoxelRadius(
	TEXT("hkt.Debug.TerrainVoxelRadius"),
	5,
	TEXT("XY radius of voxel visualization (in voxel units). Default 5"),
	ECVF_Default);

static TAutoConsoleVariable<int32> CVarShowTerrainVoxelLabels(
	TEXT("hkt.Debug.ShowTerrainVoxelLabels"),
	0,
	TEXT("Show coordinate labels on terrain voxels. 0=off, 1=on"),
	ECVF_Default);

// --------------------------------------------------------------------------- 좌표 변???�퍼

static constexpr int32 ChunkSize = 32;

static FIntVector CmToVoxel(const FVector& Pos, float VoxelSize)
{
	return FIntVector(
		FMath::FloorToInt(static_cast<float>(Pos.X) / VoxelSize),
		FMath::FloorToInt(static_cast<float>(Pos.Y) / VoxelSize),
		FMath::FloorToInt(static_cast<float>(Pos.Z) / VoxelSize));
}

static FVector VoxelToCm(const FIntVector& V, float VoxelSize)
{
	const float Half = VoxelSize * 0.5f;
	return FVector(
		V.X * VoxelSize + Half,
		V.Y * VoxelSize + Half,
		V.Z * VoxelSize + Half);
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

// --------------------------------------------------------------------------- ?�더 캐시 쿼리

static bool IsSolidRC(FHktVoxelRenderCache* Cache, int32 VX, int32 VY, int32 VZ)
{
	if (!Cache) return false;
	const FIntVector CC(FloorDiv(VX, ChunkSize), FloorDiv(VY, ChunkSize), FloorDiv(VZ, ChunkSize));
	const FHktVoxelChunk* Chunk = Cache->GetChunk(CC);
	if (!Chunk) return false;
	return !Chunk->At(FloorMod(VX, ChunkSize), FloorMod(VY, ChunkSize), FloorMod(VZ, ChunkSize)).IsEmpty();
}

/** PhysicsSystem ??FindFloorVoxelZ ?� ?�일??로직 (?�더 캐시 기반) */
static int32 FindFloorVoxelZRC(FHktVoxelRenderCache* Cache, int32 VX, int32 VY, int32 StartVZ,
                                int32 MaxScanUp = 8, int32 MaxScanDown = 64)
{
	if (!Cache) return StartVZ;
	if (IsSolidRC(Cache, VX, VY, StartVZ))
	{
		for (int32 Z = StartVZ + 1; Z <= StartVZ + MaxScanUp; ++Z)
		{
			if (!IsSolidRC(Cache, VX, VY, Z))
				return Z;
		}
		return StartVZ;
	}
	for (int32 Z = StartVZ - 1; Z >= StartVZ - MaxScanDown; --Z)
	{
		if (IsSolidRC(Cache, VX, VY, Z))
			return Z + 1;
	}
	return StartVZ;
}

static uint16 GetTypeRC(FHktVoxelRenderCache* Cache, int32 VX, int32 VY, int32 VZ)
{
	if (!Cache) return 0;
	const FIntVector CC(FloorDiv(VX, ChunkSize), FloorDiv(VY, ChunkSize), FloorDiv(VZ, ChunkSize));
	const FHktVoxelChunk* Chunk = Cache->GetChunk(CC);
	if (!Chunk) return 0;
	return Chunk->At(FloorMod(VX, ChunkSize), FloorMod(VY, ChunkSize), FloorMod(VZ, ChunkSize)).TypeID;
}

/** ?�리??복�???6방향 �??�나?�도 �??�웃??가지�??�면 */
static bool IsSurfaceVoxel(FHktVoxelRenderCache* Cache, int32 VX, int32 VY, int32 VZ)
{
	if (!IsSolidRC(Cache, VX, VY, VZ)) return false;
	return !IsSolidRC(Cache, VX+1, VY, VZ) || !IsSolidRC(Cache, VX-1, VY, VZ)
		|| !IsSolidRC(Cache, VX, VY+1, VZ) || !IsSolidRC(Cache, VX, VY-1, VZ)
		|| !IsSolidRC(Cache, VX, VY, VZ+1) || !IsSolidRC(Cache, VX, VY, VZ-1);
}

// --------------------------------------------------------------------------- Implementation

FHktTerrainDebugProcessor::FHktTerrainDebugProcessor(ULocalPlayer* InLP)
	: LocalPlayer(InLP)
{
}

void FHktTerrainDebugProcessor::Sync(const FHktPresentationState& State)
{
	const int32 Mode = CVarShowTerrainVoxels.GetValueOnGameThread();
	if (Mode <= 0) return;

	UWorld* World = LocalPlayer.IsValid() ? LocalPlayer->GetWorld() : nullptr;
	if (!World) return;

	DrawTerrainVoxels(World, State);
}

void FHktTerrainDebugProcessor::DrawTerrainVoxels(UWorld* World, const FHktPresentationState& State)
{
	const int32 Mode = CVarShowTerrainVoxels.GetValueOnGameThread();
	const int32 RadiusXY = FMath::Clamp(CVarTerrainVoxelRadius.GetValueOnGameThread(), 2, 12);
	const bool bShowLabels = CVarShowTerrainVoxelLabels.GetValueOnGameThread() > 0;

	// Subject ?�티???�치
	UHktPresentationSubsystem* Sub = LocalPlayer.IsValid()
		? LocalPlayer->GetSubsystem<UHktPresentationSubsystem>() : nullptr;
	if (!Sub) return;

	const FHktEntityId SubjectId = Sub->GetSubjectEntityId();
	if (SubjectId == InvalidEntityId) return;

	const FHktEntityPresentation* Entity = State.Get(SubjectId);
	if (!Entity) return;

	const FVector EntityPos = Entity->RenderLocation.Get().IsZero()
		? Entity->Location.Get() : Entity->RenderLocation.Get();
	const float ColRadius = FMath::Max(Entity->CollisionRadius.Get(), 30.0f);

	// AHktVoxelTerrainActor ?�색
	AHktVoxelTerrainActor* TerrainActor = nullptr;
	for (TActorIterator<AHktVoxelTerrainActor> It(World); It; ++It)
	{
		TerrainActor = *It;
		break;
	}
	FHktVoxelRenderCache* RC = TerrainActor ? TerrainActor->GetTerrainCache() : nullptr;
	if (!RC) return;

	// ?�더�??�이?�라?�과 ?�일??복�? ?�기�??�용 (?�디?�에??변�?가??
	const float VS = TerrainActor->VoxelSize;

	const FIntVector CV = CmToVoxel(EntityPos, VS); // ?�티??중심 복�?
	const FVector HE(VS * 0.5f);                    // 복�? 반절 ?�기
	constexpr int32 ZScanUp = 3;
	constexpr int32 ZScanDown = 2;

	int32 SurfaceCount = 0;

	// =========================================================================
	// 1. ?�면 경계 복�? ???�리?�이면서 �??�웃???�는 복�?�?그린??
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
				const FVector Pos = VoxelToCm(FIntVector(VX, VY, VZ), VS);

				// ?�티??충돌 반경�?겹치???�면 = 빨강, ?�니�?초록
				const float DistToEntity = FVector::Dist(Pos, EntityPos);
				const bool bInCollisionRange = (DistToEntity < ColRadius + VS);

				const FColor Color = bInCollisionRange
					? FColor(255, 50, 50)    // 빨강 ??충돌 범위 ???�면
					: FColor(50, 220, 50);   // 초록 ???�전 ?�면
				const float Thickness = bInCollisionRange ? 2.0f : 1.0f;

				DrawDebugBox(World, Pos, HE, Color, false, -1.f, SDPG_Foreground, Thickness);

				if (bShowLabels && bInCollisionRange)
				{
					const uint16 TypeID = GetTypeRC(RC, VX, VY, VZ);
					DrawDebugString(World, Pos + FVector(0, 0, VS * 0.6f),
						FString::Printf(TEXT("V(%d,%d,%d) T:%d"), VX, VY, VZ, TypeID),
						nullptr, FColor::White, -1.f, false, 0.8f);
				}
			}
		}
	}

	// =========================================================================
	// 2. ?�평 ?�라?�스 (Mode 2) ???�티??발밑 Z??XY ?�면??그리?�로 ?�시
	//    ?�리???�색 채�?, �?공간=?��? ?�선, 충돌 ?�역 ?�시
	// =========================================================================
	if (Mode >= 2)
	{
		const int32 SliceZ = CV.Z; // 발밑 Z ?�벨

		for (int32 DY = -RadiusXY; DY <= RadiusXY; ++DY)
		{
			for (int32 DX = -RadiusXY; DX <= RadiusXY; ++DX)
			{
				const int32 VX = CV.X + DX;
				const int32 VY = CV.Y + DY;
				const FVector Pos = VoxelToCm(FIntVector(VX, VY, SliceZ), VS);
				const bool bSolid = IsSolidRC(RC, VX, VY, SliceZ);

				if (bSolid)
				{
					// ?�리?? ?�색 바닥�??�인
					const FVector Lo(Pos.X - HE.X, Pos.Y - HE.Y, Pos.Z - HE.Z);
					const FVector Hi(Pos.X + HE.X, Pos.Y + HE.Y, Pos.Z - HE.Z);
					DrawDebugBox(World,
						FVector((Lo.X+Hi.X)*0.5f, (Lo.Y+Hi.Y)*0.5f, Lo.Z),
						FVector(HE.X, HE.Y, 0.5f),
						FColor(100, 100, 100), false, -1.f, SDPG_Foreground, 0.5f);
				}
				else
				{
					// �?공간: ?�주 ?��? ??
					DrawDebugPoint(World, Pos, 2.0f,
						FColor(40, 40, 40), false, -1.f, SDPG_Foreground);
				}
			}
		}
	}

	// =========================================================================
	// 3. Physics ?�심 ?�버�???Floor Voxel + SurfaceCmZ + ?�티???�치
	// =========================================================================

	// Physics Phase1 �??�일??로직?�로 바닥 복�? 검??
	const int32 FloorVoxelZ = FindFloorVoxelZRC(RC, CV.X, CV.Y, CV.Z);
	const float SurfaceCmZ = static_cast<float>(FMath::RoundToInt(FloorVoxelZ * VS + VS * 0.5f));  // VoxelToCm center
	const bool bCenterSolid = IsSolidRC(RC, CV.X, CV.Y, CV.Z);

	// 3-a) 바닥 복�?(Floor Voxel) ???��???굵�? 박스 (Physics가 "?�딛�??�다"�??�단?�는 ?�치)
	{
		const FIntVector FloorVoxelBelow(CV.X, CV.Y, FloorVoxelZ - 1);  // ?�리??복�? (바닥 ?�래)
		const FIntVector FloorVoxelAir(CV.X, CV.Y, FloorVoxelZ);        // ?�어 복�? (???�는 �?

		// ?�리??복�? = 주황 (?�제 ?�딛???�리??
		if (IsSolidRC(RC, FloorVoxelBelow.X, FloorVoxelBelow.Y, FloorVoxelBelow.Z))
		{
			DrawDebugBox(World, VoxelToCm(FloorVoxelBelow, VS), HE,
				FColor(255, 140, 0), false, -1.f, SDPG_Foreground, 3.0f);
		}

		// ?�어 복�? = ?��???(Physics가 snap ?�는 ?�치)
		DrawDebugBox(World, VoxelToCm(FloorVoxelAir, VS), HE,
			FColor(255, 255, 0), false, -1.f, SDPG_Foreground, 2.5f);
	}

	// 3-b) SurfaceCmZ ?�평????Physics floor snap 목표 ?�이 (?��?????��)
	{
		const float CrossSize = ColRadius + 20.0f;
		const FVector SurfCenter(EntityPos.X, EntityPos.Y, SurfaceCmZ);
		DrawDebugLine(World,
			SurfCenter + FVector(-CrossSize, 0, 0), SurfCenter + FVector(CrossSize, 0, 0),
			FColor::Yellow, false, -1.f, SDPG_Foreground, 2.0f);
		DrawDebugLine(World,
			SurfCenter + FVector(0, -CrossSize, 0), SurfCenter + FVector(0, CrossSize, 0),
			FColor::Yellow, false, -1.f, SDPG_Foreground, 2.0f);
	}

	// 3-c) ?�티???�제 ?��??�이???�치 ??마젠?� ?�인??(PosZ)
	DrawDebugPoint(World, EntityPos, 12.0f, FColor::Magenta, false, -1.f, SDPG_Foreground);

	// 3-d) 중심 복�? ???�안 박스
	{
		const FVector CenterCm = VoxelToCm(CV, VS);
		DrawDebugBox(World, CenterCm, HE, FColor::Cyan, false, -1.f, SDPG_Foreground, 2.5f);
	}

	// 3-e) PosZ ??SurfaceCmZ 간격 ?�시 (?�직 ??
	{
		const FColor GapColor = (EntityPos.Z <= SurfaceCmZ) ? FColor::Green : FColor::Red;
		DrawDebugLine(World,
			FVector(EntityPos.X, EntityPos.Y, EntityPos.Z),
			FVector(EntityPos.X, EntityPos.Y, SurfaceCmZ),
			GapColor, false, -1.f, SDPG_Foreground, 2.5f);
	}

	// =========================================================================
	// 4. 충돌 반경 + wall-slide ?�스???�인??
	// =========================================================================

	// 충돌 반경???�평 ?�으�??�시
	DrawDebugCircle(World, EntityPos, ColRadius, 32,
		FColor(255, 165, 0), false, -1.f, SDPG_Foreground, 2.0f,
		FVector(0,1,0), FVector(1,0,0), false);

	// wall-slide ?�스???�인??(BodyZ = PosZ + VoxelSize)
	{
		const float BodyZ = EntityPos.Z + VS;

		const FVector TestPosXp(EntityPos.X + ColRadius, EntityPos.Y, BodyZ);
		const FVector TestNegXp(EntityPos.X - ColRadius, EntityPos.Y, BodyZ);
		const FVector TestPosYp(EntityPos.X, EntityPos.Y + ColRadius, BodyZ);
		const FVector TestNegYp(EntityPos.X, EntityPos.Y - ColRadius, BodyZ);

		const float PtSize = 8.0f;
		auto DrawTestPoint = [&](const FVector& Pt)
		{
			const FIntVector PtV = CmToVoxel(Pt, VS);
			const bool bBlocked = IsSolidRC(RC, PtV.X, PtV.Y, PtV.Z);
			const FColor C = bBlocked ? FColor::Red : FColor::Green;
			DrawDebugPoint(World, Pt, PtSize, C, false, -1.f, SDPG_Foreground);
			DrawDebugLine(World, EntityPos, Pt, FColor(180, 180, 180), false, -1.f, SDPG_Foreground, 0.5f);
		};

		DrawTestPoint(TestPosXp);
		DrawTestPoint(TestNegXp);
		DrawTestPoint(TestPosYp);
		DrawTestPoint(TestNegYp);
	}

	// =========================================================================
	// 5. HUD ?�약 ??Physics ?�심 ?�태 3�?
	// =========================================================================
	{
		const int32 CollisionLayerVal = Entity->CollisionLayer.Get();
		const bool bJumping = Entity->bIsJumping.Get();
		const FVector Vel = Entity->Velocity.Get();
		const float PosZ = EntityPos.Z;
		const float GapZ = PosZ - SurfaceCmZ;

		// 1�? 복�? 좌표 + 충돌 반경 + ?�이??
		const FString Line1 = FString::Printf(
			TEXT("V(%d,%d,%d) R=%.0f Layer=%d %s"),
			CV.X, CV.Y, CV.Z, ColRadius, CollisionLayerVal,
			CollisionLayerVal == 0 ? TEXT("!! NO COLLISION !!") : TEXT(""));

		// 2�? Floor snap ?�보
		const FString Line2 = FString::Printf(
			TEXT("FloorV=Z:%d SurfCmZ=%.0f PosZ=%.0f Gap=%.1f %s"),
			FloorVoxelZ, SurfaceCmZ, PosZ, GapZ,
			(PosZ <= SurfaceCmZ) ? TEXT("[GROUNDED]") : TEXT("[AIRBORNE]"));

		// 3�? ?�도 + ?�프 ?�태
		const FString Line3 = FString::Printf(
			TEXT("Vel=(%.0f,%.0f,%.0f) Jump=%s %s"),
			Vel.X, Vel.Y, Vel.Z,
			bJumping ? TEXT("YES") : TEXT("NO"),
			bCenterSolid ? TEXT("!! INSIDE SOLID !!") : TEXT(""));

		const FColor Col1 = (CollisionLayerVal == 0) ? FColor::Red : FColor::White;
		const FColor Col2 = (PosZ > SurfaceCmZ) ? FColor::Yellow : FColor::Green;
		const FColor Col3 = bCenterSolid ? FColor::Red : FColor::White;

		const float BaseZ = ColRadius + 80.f;
		DrawDebugString(World, EntityPos + FVector(0, 0, BaseZ),
			Line1, nullptr, Col1, -1.f, false, 1.0f);
		DrawDebugString(World, EntityPos + FVector(0, 0, BaseZ - 18.f),
			Line2, nullptr, Col2, -1.f, false, 1.0f);
		DrawDebugString(World, EntityPos + FVector(0, 0, BaseZ - 36.f),
			Line3, nullptr, Col3, -1.f, false, 1.0f);
	}

	// Insights ?�이???�집
	HKT_INSIGHT_COLLECT(TEXT("Terrain.Debug"), TEXT("SubjectEntity"),
		FString::Printf(TEXT("%d"), SubjectId));
	HKT_INSIGHT_COLLECT(TEXT("Terrain.Debug"), TEXT("VoxelCoord"),
		FString::Printf(TEXT("(%d, %d, %d)"), CV.X, CV.Y, CV.Z));
	HKT_INSIGHT_COLLECT(TEXT("Terrain.Debug"), TEXT("FloorVoxelZ"),
		FString::Printf(TEXT("%d"), FloorVoxelZ));
	HKT_INSIGHT_COLLECT(TEXT("Terrain.Debug"), TEXT("SurfaceCmZ"),
		FString::Printf(TEXT("%.1f"), SurfaceCmZ));
	HKT_INSIGHT_COLLECT(TEXT("Terrain.Debug"), TEXT("EntityPosZ"),
		FString::Printf(TEXT("%.1f"), EntityPos.Z));
	HKT_INSIGHT_COLLECT(TEXT("Terrain.Debug"), TEXT("CollisionLayer"),
		FString::Printf(TEXT("%d"), Entity->CollisionLayer.Get()));
	HKT_INSIGHT_COLLECT(TEXT("Terrain.Debug"), TEXT("CollisionRadius"),
		FString::Printf(TEXT("%.1f"), ColRadius));
	HKT_INSIGHT_COLLECT(TEXT("Terrain.Debug"), TEXT("CenterSolid"),
		bCenterSolid ? TEXT("YES") : TEXT("No"));
}

void FHktTerrainDebugProcessor::Teardown()
{
	LocalPlayer = nullptr;
}

#endif // ENABLE_HKT_INSIGHTS
