// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "HktServerRuleInterfaces.h"
#include "HktSimulationEventBuilderComponent.generated.h"

/**
 * UHktSimulationEventBuilderComponent - IHktSimulationEventBuilder 구현
 *
 * 아키텍처:
 *   - Intent 수집만 담당. Rule(BindContext로 전달받은 쪽)이 Resize 호출 후
 *     그룹별로 PushIntent/GetIntents로 Intent를 주고받음.
 *   - Enter/Exit, Batch 조립은 IHktServerRule(OnEvent_GameModeTick)에서
 *     FGroupEventSend 등으로 처리.
 */
UCLASS(ClassGroup=(HktRuntime), meta=(BlueprintSpawnableComponent))
class HKTRUNTIME_API UHktSimulationEventBuilderComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UHktSimulationEventBuilderComponent();

private:
	TArray<TArray<FHktEvent>> GroupIntents;
};
