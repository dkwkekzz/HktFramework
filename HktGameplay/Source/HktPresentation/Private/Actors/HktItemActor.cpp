// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktItemActor.h"
#include "HktPresentationState.h"
#include "HktPresentationLog.h"
#include "HktCoreEventLog.h"
#include "Components/StaticMeshComponent.h"
#include "Components/SkeletalMeshComponent.h"

AHktItemActor::AHktItemActor()
{
	// DroppedMesh — 바닥에 놓일 때 보이는 메시 (Root)
	DroppedMeshComponent = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("DroppedMesh"));
	RootComponent = DroppedMeshComponent;

	DroppedMeshComponent->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
	DroppedMeshComponent->SetCollisionResponseToAllChannels(ECR_Ignore);
	DroppedMeshComponent->SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);

	// MeshComponent — 장착 시 소켓에 부착되는 메시
	MeshComponent = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("ItemMesh"));
	MeshComponent->SetupAttachment(RootComponent);
	MeshComponent->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	MeshComponent->SetVisibility(false);
}

void AHktItemActor::SetupMesh(UStaticMesh* InMesh, UStaticMesh* InDroppedMesh, FVector Scale, FRotator AttachRotOffset, FName InAttachSocketName)
{
	if (MeshComponent && InMesh)
	{
		MeshComponent->SetStaticMesh(InMesh);
		MeshComponent->SetRelativeScale3D(Scale);
		MeshComponent->SetRelativeRotation(AttachRotOffset);
	}

	if (DroppedMeshComponent)
	{
		UStaticMesh* DropMesh = InDroppedMesh ? InDroppedMesh : InMesh;
		if (DropMesh)
		{
			DroppedMeshComponent->SetStaticMesh(DropMesh);
		}
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
			// 장착: MeshComponent를 소켓에 부착, DroppedMesh 숨김
			SetDroppedState(false);
			if (!bIsAttachedToSocket)
				TryAttachToOwner(static_cast<FHktEntityId>(Entity.OwnerEntity.Get()), GetActorFunc);
		}
		else if (Entity.IsItemOwned())
		{
			// 소유 but 비장착: 둘 다 숨김
			DetachFromOwnerIfNeeded();
			SetDroppedState(false);
			SetActorHiddenInGame(true);
			SetActorEnableCollision(false);
		}
		else
		{
			// Ground: DroppedMesh 표시, 픽업 가능
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
	if (DroppedMeshComponent)
	{
		DroppedMeshComponent->SetVisibility(bDropped);
		DroppedMeshComponent->SetCollisionEnabled(bDropped ? ECollisionEnabled::QueryOnly : ECollisionEnabled::NoCollision);
	}
	// MeshComponent의 Visibility는 TryAttachToOwner/DetachFromOwnerIfNeeded에서만 제어
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
