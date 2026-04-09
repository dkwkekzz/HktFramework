#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameStateBase.h"
#include "HktGameState.generated.h"

/**
 * GameState 껍데기 — GameMode의 GameStateClass 슬롯용.
 * 프레임 동기화는 ProxySimulatorComponent가 담당하므로 로직 없음.
 */
UCLASS()
class HKTRUNTIME_API AHktGameState : public AGameStateBase
{
	GENERATED_BODY()
};
