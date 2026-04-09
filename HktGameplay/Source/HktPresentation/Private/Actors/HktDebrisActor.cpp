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

void AHktDebrisActor::ApplyTransform(const FHktEntityPresentation& Entity)
{
	SetActorLocationAndRotation(
		Entity.RenderLocation.Get(), Entity.Rotation.Get(),
		false, nullptr, ETeleportType::TeleportPhysics);
}

void AHktDebrisActor::ApplyPresentation(const FHktEntityPresentation& Entity, int64 Frame, bool bForceAll,
	TFunctionRef<AActor*(FHktEntityId)> GetActorFunc)
{
	// TerrainTypeId 변경 시 머티리얼 갱신 등 추가 처리 가능
	if (bForceAll || Entity.TerrainTypeId.IsDirty(Frame))
	{
		const int32 NewTerrainTypeId = Entity.TerrainTypeId.Get();
		if (NewTerrainTypeId != CachedTerrainTypeId)
		{
			CachedTerrainTypeId = NewTerrainTypeId;
			// TODO: TerrainTypeId에 따른 머티리얼/메시 변경
		}
	}
}
