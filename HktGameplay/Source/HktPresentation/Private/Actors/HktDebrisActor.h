// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "IHktPresentableActor.h"
#include "HktDebrisActor.generated.h"

struct FHktEntityPresentation;

/**
 * Terrain Debris Actor.
 *
 * terrain에서 분리된 파편을 렌더링한다.
 * TerrainTypeId에 해당하는 1x1x1 복셀 큐브를 렌더링하며,
 * 생성 시 scale pop-in, 파괴 시 shrink 애니메이션을 재생한다.
 */
UCLASS(NotBlueprintable)
class AHktDebrisActor : public AActor, public IHktPresentableActor
{
	GENERATED_BODY()

public:
	AHktDebrisActor();

	// IHktPresentableActor
	virtual void SetEntityId(FHktEntityId InEntityId) override { CachedEntityId = InEntityId; }
	virtual void ApplyTransform(const FHktEntityPresentation& Entity) override;
	virtual void ApplyPresentation(const FHktEntityPresentation& Entity, int64 Frame, bool bForceAll,
		TFunctionRef<AActor*(FHktEntityId)> GetActorFunc) override;

private:
	/** 복셀 큐브 메시 (1x1x1 단위 큐브) */
	UPROPERTY(VisibleAnywhere, Category = "HKT|Debris")
	TObjectPtr<UStaticMeshComponent> CubeMeshComponent;

	FHktEntityId CachedEntityId = InvalidEntityId;

	/** 이전 프레임의 TerrainTypeId (변경 감지) */
	int32 CachedTerrainTypeId = -1;
};
