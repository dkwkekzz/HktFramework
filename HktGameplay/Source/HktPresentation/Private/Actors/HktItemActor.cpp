// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktItemActor.h"
#include "HktPresentationState.h"
#include "HktPresentationLog.h"
#include "HktCoreEventLog.h"
#include "Components/StaticMeshComponent.h"
#include "Components/SkeletalMeshComponent.h"

AHktItemActor::AHktItemActor()
{
	MeshComponent = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("ItemMesh"));
	RootComponent = MeshComponent;

	MeshComponent->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
	MeshComponent->SetCollisionResponseToAllChannels(ECR_Ignore);
	MeshComponent->SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);
}

void AHktItemActor::SetupMesh(UStaticMesh* InMesh, FVector Scale, FRotator AttachRotOffset, FName InAttachSocketName)
{
	if (MeshComponent && InMesh)
	{
		MeshComponent->SetStaticMesh(InMesh);
		MeshComponent->SetRelativeScale3D(Scale);
		MeshComponent->SetRelativeRotation(AttachRotOffset);
	}

	AttachSocketName = InAttachSocketName;
}

void AHktItemActor::ApplyPresentation(const FHktEntityPresentation& Entity, int64 Frame, bool bForceAll,
	TFunctionRef<AActor*(FHktEntityId)> GetActorFunc)
{
	// --- 부착/소유 상태 판단 ---
	if (bForceAll || Entity.OwnerEntity.IsDirty(Frame) || Entity.ItemState.IsDirty(Frame))
	{
		if (Entity.IsItemAttached())
		{
			SetDroppedState(false);
			if (!bIsAttachedToSocket)
				TryAttachToOwner(static_cast<FHktEntityId>(Entity.OwnerEntity.Get()), GetActorFunc);
		}
		else if (Entity.IsItemOwned())
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

	// Transform은 ApplyTransform()에서 매 프레임 처리
}

void AHktItemActor::ApplyTransform(const FHktEntityPresentation& Entity)
{
	if (bIsAttachedToSocket) return;
	SetActorLocationAndRotation(
		Entity.RenderLocation.Get(), Entity.Rotation.Get(),
		false, nullptr, ETeleportType::TeleportPhysics);
}

void AHktItemActor::SetDroppedState(bool bDropped)
{
	if (MeshComponent)
	{
		MeshComponent->SetVisibility(bDropped);
		MeshComponent->SetCollisionEnabled(bDropped ? ECollisionEnabled::QueryOnly : ECollisionEnabled::NoCollision);
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

	// MeshComponent를 소켓에 부착
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
