// Copyright Hkt Studios, Inc. All Rights Reserved.
#pragma once

#include "UObject/Interface.h"
#include "HktCoreDefs.h"
#include "IHktPresentableActor.generated.h"

struct FHktEntityPresentation;
class AActor;
class UHktTagDataAsset;

UINTERFACE()
class UHktPresentableActor : public UInterface { GENERATED_BODY() };

/** ActorRenderer가 Actor에게 EntityId 설정 및 ViewModel 변경점 전달에 사용하는 인터페이스 */
class IHktPresentableActor
{
	GENERATED_BODY()
public:
	virtual void SetEntityId(FHktEntityId InEntityId) = 0;
	virtual void ApplyTransform(const FHktEntityPresentation& Entity) = 0;
	virtual void ApplyPresentation(const FHktEntityPresentation& Entity, int64 Frame, bool bForceAll,
		TFunctionRef<AActor*(FHktEntityId)> GetActorFunc) = 0;

	/** Renderer가 에셋 로드 후 호출. Actor가 필요한 타입으로 Cast해서 사용. */
	virtual void OnVisualAssetLoaded(UHktTagDataAsset* InAsset) {}
};
