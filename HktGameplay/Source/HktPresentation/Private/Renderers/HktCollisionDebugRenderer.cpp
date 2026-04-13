// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktCollisionDebugRenderer.h"

#if ENABLE_HKT_INSIGHTS

#include "Engine/World.h"
#include "Engine/LocalPlayer.h"
#include "DrawDebugHelpers.h"
#include "HktCollisionLayers.h"
#include "Settings/HktRuntimeGlobalSetting.h"

// --------------------------------------------------------------------------- CVars

static TAutoConsoleVariable<int32> CVarShowCollision(
	TEXT("hkt.Debug.ShowCollision"),
	0,
	TEXT("Entity 충돌 시각화. 0=끄기, 1=캡슐, 2=캡슐+판정 범위, 3=캡슐+판정 범위+복셀"),
	ECVF_Default);

static TAutoConsoleVariable<int32> CVarShowCollisionLabels(
	TEXT("hkt.Debug.ShowCollisionLabels"),
	0,
	TEXT("충돌 캡슐 위에 EntityId/파라미터 표시. 0=끄기, 1=켜기"),
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

// --------------------------------------------------------------------------- Mode 1: 캡슐 충돌 범위

void FHktCollisionDebugRenderer::DrawCollisionCapsules(UWorld* World, const FHktPresentationState& State)
{
	const bool bShowLabels = CVarShowCollisionLabels.GetValueOnGameThread() > 0;

	State.ForEachEntity([&](const FHktEntityPresentation& Entity)
	{
		const int32 Layer = Entity.CollisionLayer.Get();
		if (Layer == 0) return;

		const float Radius = Entity.CollisionRadius.Get();
		const float HalfHeight = FMath::Max(Entity.CollisionHalfHeight.Get(), Radius);
		const FColor Color = GetCollisionLayerColor(Layer);

		// 시뮬레이션 위치 (발 기준) — RenderLocation은 CapsuleHalfHeight 오프셋이 적용되어 있으므로
		// 시뮬레이션 발 위치를 기준으로 캡슐 중심을 계산
		const FVector SimPos = Entity.Location.Get();  // 시뮬레이션 발 위치
		const FVector CapsuleCenter(SimPos.X, SimPos.Y, SimPos.Z + HalfHeight);

		// UE5 DrawDebugCapsule: Center, HalfHeight, Radius, Rotation
		DrawDebugCapsule(World, CapsuleCenter, HalfHeight, Radius, FQuat::Identity,
			Color, false, -1.f, SDPG_World, 1.0f);

		if (bShowLabels)
		{
			const FString Label = FString::Printf(TEXT("E:%d R:%.0f HH:%.0f L:0x%X"),
				Entity.EntityId, Radius, HalfHeight, Layer);
			DrawDebugString(World, CapsuleCenter + FVector(0, 0, HalfHeight + 20.f),
				Label, nullptr, Color, -1.f, false, 1.0f);
		}
	});
}

// --------------------------------------------------------------------------- Mode 2: 판정 범위 (Detection Range)

void FHktCollisionDebugRenderer::DrawDetectionRange(UWorld* World, const FHktPresentationState& State)
{
	// 판정 범위 = 자신의 캡슐을 Radius만큼 팽창 (worst case: 같은 크기의 상대와 충돌)
	// 즉, 외곽 캡슐의 Radius = 2 * Radius, HalfHeight = HalfHeight + Radius

	State.ForEachEntity([&](const FHktEntityPresentation& Entity)
	{
		const int32 Layer = Entity.CollisionLayer.Get();
		if (Layer == 0) return;

		const float Radius = Entity.CollisionRadius.Get();
		const float HalfHeight = FMath::Max(Entity.CollisionHalfHeight.Get(), Radius);
		const FColor BaseColor = GetCollisionLayerColor(Layer);
		const FColor RangeColor(BaseColor.R, BaseColor.G, BaseColor.B, 80);

		const FVector SimPos = Entity.Location.Get();

		// 팽창된 캡슐: Radius*2, HalfHeight + Radius
		const float DetectR = Radius * 2.0f;
		const float DetectHH = HalfHeight + Radius;
		const FVector DetectCenter(SimPos.X, SimPos.Y, SimPos.Z + DetectHH);

		DrawDebugCapsule(World, DetectCenter, DetectHH, DetectR, FQuat::Identity,
			RangeColor, false, -1.f, SDPG_World, 0.5f);
	});
}

// --------------------------------------------------------------------------- Mode 3: 포함 복셀 시각화

void FHktCollisionDebugRenderer::DrawVoxelCells(UWorld* World, const FHktPresentationState& State)
{
	// RuntimeGlobalSetting 단일 출처에서 VoxelSizeCm 획득
	const UHktRuntimeGlobalSetting* Settings = GetDefault<UHktRuntimeGlobalSetting>();
	const float VS = Settings ? Settings->VoxelSizeCm : 15.0f;
	if (VS <= 0.0f) return;

	State.ForEachEntity([&](const FHktEntityPresentation& Entity)
	{
		const int32 Layer = Entity.CollisionLayer.Get();
		if (Layer == 0) return;

		const FVector SimPos = Entity.Location.Get();
		const float Radius = FMath::Max(Entity.CollisionRadius.Get(), 30.0f);
		const float HalfHeight = FMath::Max(Entity.CollisionHalfHeight.Get(), Radius);

		// 캡슐 AABB → 복셀 셀 (PhysicsSystem Step 2와 동일한 로직)
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
	});
}

void FHktCollisionDebugRenderer::Teardown()
{
	LocalPlayer = nullptr;
}

#endif // ENABLE_HKT_INSIGHTS
