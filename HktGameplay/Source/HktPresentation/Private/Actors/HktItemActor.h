// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "HktSelectable.h"
#include "IHktPresentableActor.h"
#include "HktItemActor.generated.h"

struct FHktEntityPresentation;

/**
 * 범용 아이템 Actor.
 * 모든 아이템 타입이 이 단일 C++ 클래스를 공유합니다.
 * DataAsset(UHktItemVisualDataAsset)으로부터 메시를 받아 설정합니다.
 *
 * 상태별 메시 표시:
 *  - Ground: MeshComponent 보임, 픽업 가능
 *  - Owned+Equipped: MeshComponent가 소켓에 부착됨
 *  - Owned+Unequipped: 숨김
 */
UCLASS(NotBlueprintable)
class AHktItemActor : public AActor, public IHktSelectable, public IHktPresentableActor
{
	GENERATED_BODY()

public:
	AHktItemActor();

	/** DataAsset에서 메시/스케일/회전 오프셋을 받아 컴포넌트에 적용 */
	void SetupMesh(UStaticMesh* InMesh, FVector Scale, FRotator AttachRotOffset, FName InAttachSocketName);

	/** 이 아이템이 부착될 소켓 이름 (DataAsset에서 지정) */
	FName GetAttachSocketName() const { return AttachSocketName; }

	// IHktSelectable
	virtual FHktEntityId GetEntityId() const override { return CachedEntityId; }

	// IHktPresentableActor
	virtual void SetEntityId(FHktEntityId InEntityId) override { CachedEntityId = InEntityId; }
	virtual void ApplyTransform(const FHktEntityPresentation& Entity) override;
	virtual void ApplyPresentation(const FHktEntityPresentation& Entity, int64 Frame, bool bForceAll,
		TFunctionRef<AActor*(FHktEntityId)> GetActorFunc) override;

private:
	void TryAttachToOwner(FHktEntityId OwnerId, TFunctionRef<AActor*(FHktEntityId)> GetActorFunc);
	void DetachFromOwnerIfNeeded();

	UPROPERTY(VisibleAnywhere, Category = "HKT|Item")
	TObjectPtr<UStaticMeshComponent> MeshComponent;

	/** 캐릭터 소켓 이름 (DataAsset에서 복사) */
	FName AttachSocketName = NAME_None;

	/** 이 Actor가 나타내는 WorldState 엔티티 ID */
	FHktEntityId CachedEntityId = InvalidEntityId;

	/** 현재 소켓에 부착되어 있는지 여부 */
	bool bIsAttachedToSocket = false;
};
