// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktCollisionDebugRenderer.h"

#if ENABLE_HKT_INSIGHTS

#include "Engine/World.h"
#include "Engine/LocalPlayer.h"
#include "DrawDebugHelpers.h"
#include "HktCollisionLayers.h"

// --------------------------------------------------------------------------- CVars

static TAutoConsoleVariable<int32> CVarShowCollision(
	TEXT("hkt.Debug.ShowCollision"),
	0,
	TEXT("Entity 충돌 시각화. 0=끄기, 1=충돌 구체, 2=구체+Spatial Grid"),
	ECVF_Default);

static TAutoConsoleVariable<int32> CVarShowCollisionLabels(
	TEXT("hkt.Debug.ShowCollisionLabels"),
	0,
	TEXT("충돌 구체 위에 EntityId 표시. 0=끄기, 1=켜기"),
	ECVF_Default);

// --------------------------------------------------------------------------- Collision Layer Colors

static FColor GetCollisionLayerColor(int32 Layer)
{
    if (Layer & EHktCollisionLayer::Character)  return FColor(77, 153, 255);  // Blue
    if (Layer & EHktCollisionLayer::NPC)        return FColor(255, 77, 77);   // Red
    if (Layer & EHktCollisionLayer::Projectile) return FColor(255, 200, 50);  // Yellow
    if (Layer & EHktCollisionLayer::Building)   return FColor(120, 120, 120); // Gray
    if (Layer & EHktCollisionLayer::Item)       return FColor(50, 220, 50);   // Green
    if (Layer & EHktCollisionLayer::Trigger)    return FColor(200, 50, 200);  // Purple
    return FColor(200, 200, 200);                                              // White (None)
}

// --------------------------------------------------------------------------- Spatial Grid Constants (HktPhysicsSystem과 동일)

static constexpr float GridCellSize = 1000.0f;

struct FHktDebugCellCoord
{
	int32 X, Y;
	bool operator==(const FHktDebugCellCoord& Other) const { return X == Other.X && Y == Other.Y; }
	friend uint32 GetTypeHash(const FHktDebugCellCoord& C) { return HashCombine(::GetTypeHash(C.X), ::GetTypeHash(C.Y)); }
};

static FHktDebugCellCoord WorldToCell(const FVector& Pos)
{
	return { FMath::FloorToInt((float)Pos.X / GridCellSize), FMath::FloorToInt((float)Pos.Y / GridCellSize) };
}

// --------------------------------------------------------------------------- Implementation

FHktCollisionDebugRenderer::FHktCollisionDebugRenderer(ULocalPlayer* InLP)
	: LocalPlayer(InLP)
{
}

void FHktCollisionDebugRenderer::Sync(const FHktPresentationState& State)
{
	const int32 Mode = CVarShowCollision.GetValueOnGameThread();
	if (Mode <= 0) return;

	UWorld* World = LocalPlayer.IsValid() ? LocalPlayer->GetWorld() : nullptr;
	if (!World) return;

	DrawCollisionSpheres(World, State);

	if (Mode >= 2)
	{
		DrawSpatialGrid(World, State);
	}
}

void FHktCollisionDebugRenderer::DrawCollisionSpheres(UWorld* World, const FHktPresentationState& State)
{
	const bool bShowLabels = CVarShowCollisionLabels.GetValueOnGameThread() > 0;

	State.ForEachEntity([&](const FHktEntityPresentation& Entity)
	{
		const FVector Pos = Entity.RenderLocation.Get().IsZero() ? Entity.Location.Get() : Entity.RenderLocation.Get();
		const float Radius = Entity.CollisionRadius.Get();
		const int32 Layer = Entity.CollisionLayer.Get();
		const FColor Color = GetCollisionLayerColor(Layer);

		DrawDebugSphere(World, Pos, Radius, 16, Color, false, -1.f, SDPG_World, 1.0f);

		if (bShowLabels)
		{
			const FString Label = FString::Printf(TEXT("E:%d R:%.0f L:0x%X"), Entity.EntityId, Radius, Layer);
			DrawDebugString(World, Pos + FVector(0, 0, Radius + 20.f), Label, nullptr, Color, -1.f, false, 1.0f);
		}
	});
}

void FHktCollisionDebugRenderer::DrawSpatialGrid(UWorld* World, const FHktPresentationState& State)
{
	TSet<FHktDebugCellCoord> OccupiedCells;

	State.ForEachEntity([&](const FHktEntityPresentation& Entity)
	{
		const FVector Pos = Entity.Location.Get();
		OccupiedCells.Add(WorldToCell(Pos));
	});

	static constexpr float GridDrawHeight = 5.0f;
	const FColor GridColor(80, 80, 80, 60);

	for (const FHktDebugCellCoord& Cell : OccupiedCells)
	{
		const float MinX = static_cast<float>(Cell.X) * GridCellSize;
		const float MinY = static_cast<float>(Cell.Y) * GridCellSize;
		const FVector Center(MinX + GridCellSize * 0.5f, MinY + GridCellSize * 0.5f, GridDrawHeight);
		const FVector Extent(GridCellSize * 0.5f, GridCellSize * 0.5f, 1.0f);

		DrawDebugBox(World, Center, Extent, GridColor, false, -1.f, SDPG_World, 2.0f);
	}
}

void FHktCollisionDebugRenderer::Teardown()
{
	LocalPlayer = nullptr;
}

#endif // ENABLE_HKT_INSIGHTS
