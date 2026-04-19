// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "HktSelectable.h"
#include "IHktPresentableActor.h"
#include "HktItemActor.generated.h"

/**
 * 범용 아이템 Actor.
 * 모든 아이템 타입이 이 단일 C++ 클래스를 공유합니다.
 * DataAsset(UHktItemVisualDataAsset)으로부터 메시를 받아 설정합니다.
 *
 * 상태별 메시 표시:
 *  - Ground: DroppedMeshComponent만 보임, 픽업 가능
 *  - Owned+Equipped: MeshComponent가 소켓에 부착됨
 *  - Owned+Unequipped: 둘 다 숨김
 */
UCLASS(NotBlueprintable)
class AHktItemActor : public AActor, public IHktSelectable, public IHktPresentableActor
{
	GENERATED_BODY()

public:
	AHktItemActor();

	void SetupMesh(UStaticMesh* InMesh, UStaticMesh* InDroppedMesh, FVector Scale, FRotator AttachRotOffset, FName InAttachSocketName);

	FName GetAttachSocketName() const { return AttachSocketName; }

	// IHktSelectable
	virtual FHktEntityId GetEntityId() const override { return CachedEntityId; }

	// IHktPresentableActor
	virtual void SetEntityId(FHktEntityId InEntityId) override { CachedEntityId = InEntityId; }
	virtual void ApplyTransform(const FHktTransformView& V) override;
	virtual void ApplyItem(const FHktItemView& V, int64 Frame, bool bForce, TFunctionRef<AActor*(FHktEntityId)> GetActorFunc) override;

private:
	void TryAttachToOwner(FHktEntityId OwnerId, TFunctionRef<AActor*(FHktEntityId)> GetActorFunc);
	void DetachFromOwnerIfNeeded();
	void SetDroppedState(bool bDropped);

	UPROPERTY(VisibleAnywhere, Category = "HKT|Item")
	TObjectPtr<UStaticMeshComponent> MeshComponent;

	UPROPERTY(VisibleAnywhere, Category = "HKT|Item")
	TObjectPtr<UStaticMeshComponent> DroppedMeshComponent;

	FName AttachSocketName = NAME_None;

	FHktEntityId CachedEntityId = InvalidEntityId;

	bool bIsAttachedToSocket = false;
};
