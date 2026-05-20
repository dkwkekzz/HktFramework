// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktCollisionDebugProcessor.h"

#if ENABLE_HKT_INSIGHTS

#include "Engine/World.h"
#include "Engine/LocalPlayer.h"
#include "EngineUtils.h"
#include "DrawDebugHelpers.h"
#include "Components/CapsuleComponent.h"
#include "Components/PrimitiveComponent.h"
#include "HktCollisionLayers.h"
#include "HktCollisionDebugTracer.h"
#include "HktSelectable.h"
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

// 모든 엔티티 origin 에 R=CollisionRadius sphere (XY footprint). ShowCollision 과 독립.
static TAutoConsoleVariable<int32> CVarShowEntityPos(
	TEXT("hkt.Debug.ShowEntityPos"),
	0,
	TEXT("Draw sphere at every entity's position with radius = CollisionRadius. 0=off, 1=on"),
	ECVF_Default);

// FHktPhysicsSystem narrow-phase 가 검출한 엔티티-엔티티 충돌 페어 시각화. ShowCollision 과 독립.
static TAutoConsoleVariable<int32> CVarShowCollisionPairs(
	TEXT("hkt.Debug.ShowCollisionPairs"),
	0,
	TEXT("Draw lines + contact points for FHktPhysicsSystem-detected collision pairs. 0=off, 1=on"),
	ECVF_Default);

static TAutoConsoleVariable<int32> CVarCollisionPairLifetime(
	TEXT("hkt.Debug.CollisionPairLifetime"),
	15,
	TEXT("Collision pair line fade-out duration in sim frames (30Hz → 15 = 0.5s)"),
	ECVF_Default);

// IHktSelectable 액터의 실제 픽업 볼륨 시각화. ECC_Visibility blocking PrimitiveComponent 만 대상.
// sim capsule (hkt.Debug.ShowCollision 으로 녹색) 과 overlay 해서 비교 가능.
static TAutoConsoleVariable<int32> CVarShowSelectableHitbox(
	TEXT("hkt.Debug.ShowSelectableHitbox"),
	0,
	TEXT("Draw actor-side pickup volume for every IHktSelectable. 0=off, 1=orange overlay"),
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
	const int32 PosMode = CVarShowEntityPos.GetValueOnGameThread();
	const int32 PairsMode = CVarShowCollisionPairs.GetValueOnGameThread();
	const int32 HitboxMode = CVarShowSelectableHitbox.GetValueOnGameThread();

	// CVar 가 꺼지면 시뮬레이션 측 push 도 중단 — bEnabled 게이트로 zero-cost.
	FHktCollisionDebugTracer::Get().SetEnabled(PairsMode > 0);

	if (Mode <= 0 && PosMode <= 0 && PairsMode <= 0 && HitboxMode <= 0) return;

	UWorld* World = LocalPlayer.IsValid() ? LocalPlayer->GetWorld() : nullptr;
	if (!World) return;

	if (PosMode > 0)
	{
		DrawEntityPositions(World, State);
	}

	if (PairsMode > 0)
	{
		DrawCollisionPairs(World, State);
	}

	if (HitboxMode > 0)
	{
		DrawSelectableHitboxes(World, State);
	}

	if (Mode <= 0) return;

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

// --------------------------------------------------------------------------- 모든 Transform 보유 엔티티의 위치 sphere

void FHktCollisionDebugProcessor::DrawEntityPositions(UWorld* World, const FHktPresentationState& State)
{
	// Physics 뷰 보유 엔티티만 — Radius = CollisionRadius (entity property 1:1).
	// 색상: Physics layer 가 있으면 layer 색, 없으면 회색 (Layer 0 — 분류 안 됨).
	for (auto It = State.Physics.CreateConstIterator(); It; ++It)
	{
		const FHktEntityId Id = static_cast<FHktEntityId>(It.GetIndex());
		const FHktPhysicsView& Phys = *It;
		const float Radius = Phys.CollisionRadius.Get();
		if (Radius <= 0.f) continue;

		const FHktTransformView* Tfm = State.GetTransform(Id);
		if (!Tfm) continue;

		const int32 Layer = Phys.CollisionLayer.Get();
		const FColor Color = (Layer != 0) ? GetCollisionLayerColor(Layer) : FColor(200, 200, 200);

		DrawDebugSphere(World, Tfm->Location.Get(), Radius, 16,
			Color, /*bPersistent*/false, /*LifeTime*/-1.f, SDPG_World, /*Thickness*/1.0f);
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
		if (Radius <= 0.f) continue;
		// HalfHeight < Radius 면 시뮬레이션이 R 로 클램프 (HktSimulationSystems.cpp:1048).
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

// --------------------------------------------------------------------------- FHktPhysicsSystem narrow-phase 검출 페어

void FHktCollisionDebugProcessor::DrawCollisionPairs(UWorld* World, const FHktPresentationState& State)
{
	const int32 LifetimeFrames = FMath::Max(1, CVarCollisionPairLifetime.GetValueOnGameThread());
	const uint64 CurrentFrame = static_cast<uint64>(State.GetCurrentFrame());

	TArray<FHktCollisionPair> Pairs;
	FHktCollisionDebugTracer::Get().Snapshot(CurrentFrame, LifetimeFrames, Pairs);

	for (const FHktCollisionPair& P : Pairs)
	{
		const uint64 Age = (CurrentFrame > P.SimFrame) ? (CurrentFrame - P.SimFrame) : 0;
		const float AgeRatio = FMath::Clamp(static_cast<float>(Age) / static_cast<float>(LifetimeFrames), 0.f, 1.f);
		const uint8 Alpha = static_cast<uint8>(FMath::Lerp(255.f, 32.f, AgeRatio));

		// 페어 라인: 양 엔티티 색상의 중간 (Layer 색 평균)
		const FColor ColorA = GetCollisionLayerColor(static_cast<int32>(P.LayerA));
		const FColor ColorB = GetCollisionLayerColor(static_cast<int32>(P.LayerB));
		const FColor LineColor(
			static_cast<uint8>((ColorA.R + ColorB.R) / 2),
			static_cast<uint8>((ColorA.G + ColorB.G) / 2),
			static_cast<uint8>((ColorA.B + ColorB.B) / 2),
			Alpha);

		DrawDebugLine(World, P.PosA, P.PosB, LineColor,
			/*bPersistent*/false, /*LifeTime*/-1.f, SDPG_World, /*Thickness*/2.0f);

		// ContactPoint — 빨강(명중) + alpha 페이드
		const FColor ContactColor(255, 60, 60, Alpha);
		DrawDebugPoint(World, P.ContactPoint, /*Size*/12.f, ContactColor,
			/*bPersistent*/false, /*LifeTime*/-1.f, SDPG_World);
	}
}

// --------------------------------------------------------------------------- IHktSelectable 액터의 실제 픽업 볼륨

void FHktCollisionDebugProcessor::DrawSelectableHitboxes(UWorld* World, const FHktPresentationState& State)
{
	// sim capsule (녹색·`hkt.Debug.ShowCollision`) 과 비교용 — 액터 쪽에서 실제로
	// PlayerController::GetHitResultUnderCursor(ECC_Visibility) 가 잡는 PrimitiveComponent 의
	// 볼륨을 그대로 그려, 픽업 영역과 sim 충돌 영역의 어긋남을 즉시 눈에 보이게 한다.
	const FColor BoxColor(255, 150, 30);     // 주황
	const FColor CapsuleColor(255, 200, 60); // 옅은 주황

	for (TActorIterator<AActor> It(World); It; ++It)
	{
		AActor* Actor = *It;
		if (!Actor || !Actor->Implements<UHktSelectable>()) continue;

		// Implements<> 통과 시 Cast 는 보장됨 — EntityId 는 라벨용.
		const IHktSelectable* Sel = Cast<IHktSelectable>(Actor);
		const FHktEntityId EntityId = Sel ? Sel->GetEntityId() : InvalidEntityId;

		TInlineComponentArray<UPrimitiveComponent*> Prims(Actor);
		FVector LabelAnchor = Actor->GetActorLocation();
		float LabelTopZ = LabelAnchor.Z;
		bool bDrewAny = false;

		for (UPrimitiveComponent* Prim : Prims)
		{
			if (!Prim || !Prim->IsRegistered()) continue;
			if (Prim->GetCollisionEnabled() == ECollisionEnabled::NoCollision) continue;
			if (Prim->GetCollisionResponseToChannel(ECC_Visibility) != ECR_Block) continue;

			if (UCapsuleComponent* Cap = Cast<UCapsuleComponent>(Prim))
			{
				const FVector Center = Cap->GetComponentLocation();
				const float HH = Cap->GetScaledCapsuleHalfHeight();
				DrawDebugCapsule(World, Center, HH, Cap->GetScaledCapsuleRadius(),
					Cap->GetComponentQuat(), CapsuleColor,
					/*bPersistent*/false, /*LifeTime*/-1.f, SDPG_World, /*Thickness*/1.5f);
				LabelTopZ = FMath::Max(LabelTopZ, Center.Z + HH);
			}
			else
			{
				// 일반 PrimitiveComponent (StaticMesh / Voxel chunk / Box 등) — 바운딩으로 그린다.
				const FBoxSphereBounds B = Prim->Bounds;
				DrawDebugBox(World, B.Origin, B.BoxExtent, FQuat::Identity,
					BoxColor, /*bPersistent*/false, /*LifeTime*/-1.f, SDPG_World, /*Thickness*/1.0f);
				LabelTopZ = FMath::Max(LabelTopZ, B.Origin.Z + B.BoxExtent.Z);
			}
			bDrewAny = true;
		}

		if (bDrewAny && EntityId != InvalidEntityId)
		{
			const FString Label = FString::Printf(TEXT("Sel E:%d"), EntityId);
			DrawDebugString(World,
				FVector(LabelAnchor.X, LabelAnchor.Y, LabelTopZ + 12.f),
				Label, nullptr, BoxColor, -1.f, false, 1.0f);
		}
	}
}

void FHktCollisionDebugProcessor::Teardown()
{
	FHktCollisionDebugTracer::Get().SetEnabled(false);
	LocalPlayer = nullptr;
}

#endif // ENABLE_HKT_INSIGHTS
