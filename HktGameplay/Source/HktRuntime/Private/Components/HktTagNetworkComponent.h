#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "HktTagTypes.h"
#include "HktTagNetworkComponent.generated.h"

/**
 * [태그 동기화 컴포넌트]
 * - GameState에 부착되어 태그 데이터를 전파하는 역할
 * - Manager(로컬/스레드세이프) <-> Component(네트워크/게임스레드) 가교 역할
 */
UCLASS(ClassGroup=(HktRuntime), meta=(BlueprintSpawnableComponent))
class  UHktTagNetworkComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UHktTagNetworkComponent();

    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

    // [New] 틱에서 큐 처리
    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;
    
    // [Server] 매니저가 큐에서 꺼낸 태그를 네트워크 배열에 추가
    void Server_SyncTag(const FString& TagString, uint32 TagId);

protected:
    // 실제 네트워크로 전파되는 데이터
    UPROPERTY(Replicated)
    FHktTagContainer ReplicatedTags;
};