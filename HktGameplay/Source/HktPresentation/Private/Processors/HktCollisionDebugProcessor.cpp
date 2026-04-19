// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktCollisionDebugProcessor.h"

#if ENABLE_HKT_INSIGHTS

#include "Engine/World.h"
#include "Engine/LocalPlayer.h"
#include "DrawDebugHelpers.h"
#include "HktCollisionLayers.h"
#include "Settings/HktRuntimeGlobalSetting.h"

static TAutoConsoleVariable<int32> CVarShowCollision(
	TEXT("hkt.Debug.ShowCollision"),
	0,
	TEXT("Entity collision visualization. 0=off, 1=capsule, 2=capsule+detection range, 3=capsule+detection range+voxel"),
	ECVF_Default);

static TAutoConsoleVariable<int32> CVarShowCollisionLabels(
	TEXT("hkt.Debug.ShowCollisionLabels"),
	0,
	TEXT("Show EntityId/parameters above collision capsule. 0=off, 1=on"),
	ECVF_Default);

static FColor GetCollisionLayerColor(int32 Layer)
{
	if (Layer & EHktCollisionLayer::Character)  return FColor(77, 153, 255);
	if (Layer & EHktCollisionLayer::NPC)        return FColor(255, 77, 77);
	if (Layer & EHktCollisionLayer::Projectile) return FColor(255, 200, 50);
	if (Layer & EHktCollisionLayer::Building)   return FColor(120, 120, 120);
	if (Layer & EHktCollisionLayer::Item)       return FColor(50, 220, 50);
	if (Layer & EHktCollisionLayer::Trigger)    return FColor(200, 50, 200);
	return FColor(200, 200, 200);
}

FHktCollisionDebugProcessor::FHktCollisionDebugProcessor(ULocalPlayer* InLP)
	: LocalPlayer(InLP)
{
}

void FHktCollisionDebugProcessor::Sync(FHktPresentationState& State)
{
	const int32 Mode = CVarShowCollision.GetValueOnGameThread();
	if (Mode <= 0) return;

	UWorld* World = LocalPlayer.IsValid() ? LocalPlayer->GetWorld() : nullptr;
	if (!World) return;

	DrawCollisionCapsules(World, State);

	if (Mode >= 2)
	{
		DrawDetectionRange(World, State);
	}

	if (Mode >= 3)
	{
		DrawVoxelCells(World, State);
	}
}

// --------------------------------------------------------------------------- Mode 1: Physics 뷰만 순회

void FHktCollisionDebugProcessor::DrawCollisionCapsules(UWorld* World, const FHktPresentationState& State)
{
	const bool bShowLabels = CVarShowCollisionLabels.GetValueOnGameThread() > 0;

	// Physics 뷰를 가진 엔터티만 순회 (Debris 등은 Physics 뷰가 없음 → 자연스럽게 스킵)
	for (auto It = State.Physics.CreateConstIterator(); It; ++It)
	{
		const FHktEntityId Id = static_cast<FHktEntityId>(It.GetIndex());
		const FHktPhysicsView& Phys = *It;
		const int32 Layer = Phys.CollisionLayer.Get();
		if (Layer == 0) continue;

		const FHktTransformView* Tfm = State.GetTransform(Id);
		if (!Tfm) continue;

		const float Radius = Phys.CollisionRadius.Get();
		const float HalfHeight = FMath::Max(Phys.CollisionHalfHeight.Get(), Radius);
		const FColor Color = GetCollisionLayerColor(Layer);

		const FVector SimPos = Tfm->Location.Get();
		const FVector CapsuleCenter(SimPos.X, SimPos.Y, SimPos.Z + HalfHeight);

		DrawDebugCapsule(World, CapsuleCenter, HalfHeight, Radius, FQuat::Identity,
			Color, false, -1.f, SDPG_World, 1.0f);

		if (bShowLabels)
		{
			const FString Label = FString::Printf(TEXT("E:%d R:%.0f HH:%.0f L:0x%X"),
				Id, Radius, HalfHeight, Layer);
			DrawDebugString(World, CapsuleCenter + FVector(0, 0, HalfHeight + 20.f),
				Label, nullptr, Color, -1.f, false, 1.0f);
		}
	}
}

void FHktCollisionDebugProcessor::DrawDetectionRange(UWorld* World, const FHktPresentationState& State)
{
	for (auto It = State.Physics.CreateConstIterator(); It; ++It)
	{
		const FHktEntityId Id = static_cast<FHktEntityId>(It.GetIndex());
		const FHktPhysicsView& Phys = *It;
		const int32 Layer = Phys.CollisionLayer.Get();
		if (Layer == 0) continue;

		const FHktTransformView* Tfm = State.GetTransform(Id);
		if (!Tfm) continue;

		const float Radius = Phys.CollisionRadius.Get();
		const float HalfHeight = FMath::Max(Phys.CollisionHalfHeight.Get(), Radius);
		const FColor BaseColor = GetCollisionLayerColor(Layer);
		const FColor RangeColor(BaseColor.R, BaseColor.G, BaseColor.B, 80);

		const FVector SimPos = Tfm->Location.Get();

		const float DetectR = Radius * 2.0f;
		const float DetectHH = HalfHeight + Radius;
		const FVector DetectCenter(SimPos.X, SimPos.Y, SimPos.Z + HalfHeight);

		DrawDebugCapsule(World, DetectCenter, DetectHH, DetectR, FQuat::Identity,
			RangeColor, false, -1.f, SDPG_World, 0.5f);
	}
}

void FHktCollisionDebugProcessor::DrawVoxelCells(UWorld* World, const FHktPresentationState& State)
{
	const UHktRuntimeGlobalSetting* Settings = GetDefault<UHktRuntimeGlobalSetting>();
	const float VS = Settings ? Settings->VoxelSizeCm : 15.0f;
	if (VS <= 0.0f) return;

	for (auto It = State.Physics.CreateConstIterator(); It; ++It)
	{
		const FHktEntityId Id = static_cast<FHktEntityId>(It.GetIndex());
		const FHktPhysicsView& Phys = *It;
		const int32 Layer = Phys.CollisionLayer.Get();
		if (Layer == 0) continue;

		const FHktTransformView* Tfm = State.GetTransform(Id);
		if (!Tfm) continue;

		const FVector SimPos = Tfm->Location.Get();
		const float Radius = FMath::Max(Phys.CollisionRadius.Get(), 30.0f);
		const float HalfHeight = FMath::Max(Phys.CollisionHalfHeight.Get(), Radius);

		const FIntVector MinV(
			FMath::FloorToInt((SimPos.X - Radius) / VS),
			FMath::FloorToInt((SimPos.Y - Radius) / VS),
			FMath::FloorToInt(SimPos.Z / VS));
		const FIntVector MaxV(
			FMath::FloorToInt((SimPos.X + Radius) / VS),
			FMath::FloorToInt((SimPos.Y + Radius) / VS),
			FMath::FloorToInt((SimPos.Z + 2.0f * HalfHeight) / VS));

		const FColor BaseColor = GetCollisionLayerColor(Layer);
		const FColor CellColor(BaseColor.R, BaseColor.G, BaseColor.B, 40);
		const FVector HE(VS * 0.5f);

		for (int32 VZ = MinV.Z; VZ <= MaxV.Z; ++VZ)
		{
			for (int32 VY = MinV.Y; VY <= MaxV.Y; ++VY)
			{
				for (int32 VX = MinV.X; VX <= MaxV.X; ++VX)
				{
					const FVector Center(
						static_cast<float>(VX) * VS + HE.X,
						static_cast<float>(VY) * VS + HE.Y,
						static_cast<float>(VZ) * VS + HE.Z);
					DrawDebugBox(World, Center, HE, CellColor, false, -1.f, SDPG_World, 0.5f);
				}
			}
		}
	}
}

void FHktCollisionDebugProcessor::Teardown()
{
	LocalPlayer = nullptr;
}

#endif // ENABLE_HKT_INSIGHTS
