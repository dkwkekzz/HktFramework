// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktDebrisActor.h"
#include "HktPresentationState.h"
#include "Components/StaticMeshComponent.h"

AHktDebrisActor::AHktDebrisActor()
{
	CubeMeshComponent = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("CubeMesh"));
	RootComponent = CubeMeshComponent;

	CubeMeshComponent->SetCollisionEnabled(ECollisionEnabled::NoCollision);
}

void AHktDebrisActor::ApplyTransform(const FHktTransformView& V)
{
	SetActorLocationAndRotation(
		V.RenderLocation.Get(), V.Rotation.Get(),
		false, nullptr, ETeleportType::TeleportPhysics);
}

void AHktDebrisActor::ApplyTerrainDebris(const FHktTerrainDebrisView& V, int64 Frame, bool bForce)
{
	if (!bForce && !V.TerrainTypeId.IsDirty(Frame)) return;
	const int32 NewTerrainTypeId = V.TerrainTypeId.Get();
	if (NewTerrainTypeId != CachedTerrainTypeId)
	{
		CachedTerrainTypeId = NewTerrainTypeId;
	}
}
