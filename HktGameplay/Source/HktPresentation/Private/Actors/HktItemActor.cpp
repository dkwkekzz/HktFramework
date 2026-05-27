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

		const FHktEntityId OwnerId = static_cast<FHktEntityId>(V.OwnerEntity.Get());
		AActor* OwnerActor = GetActorFunc(OwnerId);

		// 방어적 부착 정합 — bIsAttachedToSocket 플래그가 아니라 실제 컴포넌트 부착 상태를 신뢰한다.
		// 소유자 액터가 컬링/파괴되면 엔진이 소켓 부착을 끊지만 플래그는 stale 하게 true 로 남는다.
		// 정상 경로(소유자-종속 컬링)에선 아이템이 소유자와 함께 파괴/재스폰되어 이 상태가 나오면 안 되므로,
		// 발생 시 반드시 Warning 으로 상태를 남기고 플래그를 리셋한 뒤 재부착한다.
		if (bIsAttachedToSocket)
		{
			const USceneComponent* CurrentParent = MeshComponent ? MeshComponent->GetAttachParent() : nullptr;
			const USkeletalMeshComponent* ExpectedParent = OwnerActor ? OwnerActor->FindComponentByClass<USkeletalMeshComponent>() : nullptr;
			if (ExpectedParent == nullptr || CurrentParent != ExpectedParent)
			{
				HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
					FString::Printf(TEXT("STALE 부착 상태: bIsAttachedToSocket=true 이나 실제 부착 불일치 (parent=%s owner=%d ownerActor=%s) → 리셋 후 재부착"),
						CurrentParent ? *CurrentParent->GetName() : TEXT("null"),
						OwnerId,
						OwnerActor ? *OwnerActor->GetName() : TEXT("null")),
					CachedEntityId);
				DetachFromOwnerIfNeeded();
			}
		}

		if (!bIsAttachedToSocket)
			TryAttachToOwner(OwnerId, GetActorFunc);
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
	if (!OwnerActor)
	{
		// Owner 액터 미스폰(비동기 스폰 지연 또는 컬링 재진입 중) → Owner 스폰 시 재시도됨.
		// 소유자-종속 컬링 하에선 짧은 전환 창에서만 발생해야 하므로 Verbose 로만 추적.
		HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Verbose, EHktLogSource::Client,
			FString::Printf(TEXT("부착 보류: Owner %d 액터 미존재 — 스폰 시 재시도"), OwnerId), CachedEntityId);
		return;
	}

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
