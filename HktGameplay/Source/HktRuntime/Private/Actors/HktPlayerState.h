#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerState.h"
#include "GameplayTagContainer.h"
#include "HktPlayerState.generated.h"

/**
 * PlayerState for HktIntent system.
 * 
 * Components:
 * - IntentEventComponent: Intent 네트워크 전송 및 배치 복제
 * - SimulationStashComponent: 이벤트 배치 큐 및 시뮬레이션 결과 관리
 * 
 * 데이터 흐름:
 * Builder → EventComponent → (RPC) → Server → StashComponent → SimulationSubsystem
 */
UCLASS()
class HKTRUNTIME_API AHktPlayerState : public APlayerState
{
	GENERATED_BODY()

public:
	AHktPlayerState();

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
};
