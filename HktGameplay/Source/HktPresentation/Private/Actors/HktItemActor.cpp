// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktItemActor.h"
#include "HktPresentationState.h"
#include "HktPresentationLog.h"
#include "HktCoreEventLog.h"
#include "Components/StaticMeshComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Materials/MaterialInterface.h"
#include "Engine/StaticMesh.h"

AHktItemActor::AHktItemActor()
{
	DroppedMeshComponent = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("DroppedMesh"));
	RootComponent = DroppedMeshComponent;

	DroppedMeshComponent->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
	DroppedMeshComponent->SetCollisionResponseToAllChannels(ECR_Ignore);
	DroppedMeshComponent->SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);

	MeshComponent = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("ItemMesh"));
	MeshComponent->SetupAttachment(RootComponent);
	MeshComponent->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	MeshComponent->SetVisibility(false);
}

void AHktItemActor::SetupMesh(UStaticMesh* InMesh, UStaticMesh* InDroppedMesh, UMaterialInterface* InOverrideMaterial, FVector Scale, FRotator AttachRotOffset, FName InAttachSocketName)
{
	auto ApplyOverrideMaterial = [InOverrideMaterial](UStaticMeshComponent* Comp)
	{
		if (!Comp || !InOverrideMaterial) return;
		UStaticMesh* SM = Comp->GetStaticMesh();
		const int32 NumSlots = SM ? SM->GetStaticMaterials().Num() : Comp->GetNumMaterials();
		for (int32 i = 0; i < NumSlots; ++i)
		{
			Comp->SetMaterial(i, InOverrideMaterial);
		}
	};

	if (MeshComponent && InMesh)
	{
		MeshComponent->SetStaticMesh(InMesh);
		MeshComponent->SetRelativeScale3D(Scale);
		MeshComponent->SetRelativeRotation(AttachRotOffset);
		ApplyOverrideMaterial(MeshComponent);
	}

	if (DroppedMeshComponent)
	{
		UStaticMesh* DropMesh = InDroppedMesh ? InDroppedMesh : InMesh;
		if (DropMesh)
		{
			DroppedMeshComponent->SetStaticMesh(DropMesh);
			DroppedMeshComponent->SetRelativeScale3D(Scale);
			ApplyOverrideMaterial(DroppedMeshComponent);
		}
	}

	AttachSocketName = InAttachSocketName;
}

void AHktItemActor::ApplyItem(const FHktItemView& V, int64 Frame, bool bForce, TFunctionRef<AActor*(FHktEntityId)> GetActorFunc)
{
	if (!bForce && !V.OwnerEntity.IsDirty(Frame) && !V.ItemState.IsDirty(Frame)) return;

	if (V.IsAttached())
	{
		SetDroppedState(false);
		if (!bIsAttachedToSocket)
			TryAttachToOwner(static_cast<FHktEntityId>(V.OwnerEntity.Get()), GetActorFunc);
	}
	else if (V.IsOwned())
	{
		DetachFromOwnerIfNeeded();
		SetDroppedState(false);
		SetActorHiddenInGame(true);
		SetActorEnableCollision(false);
	}
	else
	{
		DetachFromOwnerIfNeeded();
		SetDroppedState(true);
		SetActorHiddenInGame(false);
		SetActorEnableCollision(true);
	}
}

void AHktItemActor::ApplyTransform(const FHktTransformView& V)
{
	if (bIsAttachedToSocket) return;
	SetActorLocationAndRotation(
		V.RenderLocation.Get(), V.Rotation.Get(),
		false, nullptr, ETeleportType::TeleportPhysics);
}

void AHktItemActor::SetDroppedState(bool bDropped)
{
	if (DroppedMeshComponent)
	{
		DroppedMeshComponent->SetVisibility(bDropped);
		DroppedMeshComponent->SetCollisionEnabled(bDropped ? ECollisionEnabled::QueryOnly : ECollisionEnabled::NoCollision);
	}
}

void AHktItemActor::TryAttachToOwner(FHktEntityId OwnerId, TFunctionRef<AActor*(FHktEntityId)> GetActorFunc)
{
	AActor* OwnerActor = GetActorFunc(OwnerId);
	if (!OwnerActor) return;  // Owner 미스폰 → Owner 스폰 시 재시도됨

	if (AttachSocketName.IsNone()) return;

	USkeletalMeshComponent* SkelMesh = OwnerActor->FindComponentByClass<USkeletalMeshComponent>();
	if (!SkelMesh) return;

	if (!SkelMesh->DoesSocketExist(AttachSocketName))
	{
		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
			FString::Printf(TEXT("Socket '%s' not found on owner %d for item %d"),
			*AttachSocketName.ToString(), OwnerId, CachedEntityId));
		return;
	}

	SetActorHiddenInGame(false);
	SetActorEnableCollision(false);
	MeshComponent->SetVisibility(true);

	MeshComponent->AttachToComponent(SkelMesh, FAttachmentTransformRules::SnapToTargetNotIncludingScale, AttachSocketName);
	bIsAttachedToSocket = true;

	HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client,
		FString::Printf(TEXT("AttachItem Socket=%s Owner=%d"), *AttachSocketName.ToString(), OwnerId),
		CachedEntityId);
}

void AHktItemActor::DetachFromOwnerIfNeeded()
{
	if (!bIsAttachedToSocket) return;

	MeshComponent->DetachFromComponent(FDetachmentTransformRules::KeepWorldTransform);
	MeshComponent->SetVisibility(false);
	bIsAttachedToSocket = false;

	HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client,
		FString::Printf(TEXT("DetachItem ItemId=%d"), CachedEntityId),
		CachedEntityId);
}
