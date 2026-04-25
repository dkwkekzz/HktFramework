#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "GameplayTagContainer.h"
#include "HktRuntimeTypes.h"
#include "HktServerRuleInterfaces.h"
#include "HktClientRuleInterfaces.h"

#include "HktGameMode.generated.h"

class AHktIngamePlayerController;
class IHktServerRule;
class IHktClientRule;

/**
 * AHktGameMode - 서버 오케스트레이터
 *
 * 아키텍처 원칙:
 *   - Actor는 "이벤트 발행"에 집중 (인터페이스를 직접 구현하지 않음)
 *   - 로직 흐름은 ServerRule이 BindContext로 받은 인터페이스를 통해 결정 (item 2)
 *   - Component가 인터페이스 구현을 담당
 *
 * 이벤트 → Rule 매핑 (item 1):
 *   PostLogin()    → Rule->OnEvent_GameModePostLogin()
 *   Logout()       → Rule->OnEvent_GameModeLogout()
 *   Tick()         → Rule->OnEvent_GameModeTick() → FHktEventGameModeTickResult
 *   ReceiveRuntimeEvent → Rule->OnReceived_RuntimeEvent()
 */
UCLASS()
class HKTRUNTIME_API AHktGameMode : public AGameModeBase
{
    GENERATED_BODY()

public:
    AHktGameMode();

    /** 통합 런타임 이벤트를 Rule에 전달 (PlayerController에서 호출) */
    void PushRuntimeEvent(int64 PlayerUid, const FHktEvent& Event);

    /** 가방 요청을 Rule에 전달 (PlayerController에서 호출) */
    void PushBagRequest(int64 PlayerUid, const FHktBagRequest& Request);

    /** 월드 최초 생성 시 1회 발동할 Story Tag (예: 초기 스포너/월드 플로우) */
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Hkt|Story", meta = (Categories = "Story"))
    FGameplayTag WorldInitStoryTag;

    /** WorldInitStoryTag 발동 위치 (Spawner 파라미터 등) */
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Hkt|Story")
    FVector WorldInitLocation = FVector::ZeroVector;

protected:
    virtual void InitGame(const FString& MapName, const FString& Options, FString& ErrorMessage) override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
    virtual void Tick(float DeltaSeconds) override;
    virtual void PostLogin(APlayerController* NewPlayer) override;
    virtual void Logout(AController* Exiting) override;

    IHktServerRule* GetServerRule() const;

private:
    /** 고정 시뮬레이션 틱 (결정론적 시뮬레이션) */
    void SimulationTick();

    /** 고정 타임스텝 어큐뮬레이터 (서버도 30Hz 고정 간격 시뮬레이션) */
    float FrameAccumulator = 0.0f;
    static constexpr float FixedDeltaTime = 1.0f / 30.0f;
    TArray<float> GroupHeartbeatAccumulators;
    static constexpr float HeartbeatInterval = 1.0f; // 5Hz

    /** Insight 통계: 틱 당 처리 시간 추적 */
    float LastTickDurationMs = 0.0f;

    /** 서버 규칙 (UHktRuleSubsystem이 소유) */
    IHktServerRule* CachedServerRule = nullptr;

    /** Insights 및 요청 전달용 캐시 (Rule의 BindContext와 별개로 유지) */
    IHktFrameManager*           CachedFrameManager            = nullptr;
    IHktRelevancyGraph*         CachedRelevancyGraph          = nullptr;
    IHktWorldDatabase*          CachedWorldDatabase           = nullptr;
};
