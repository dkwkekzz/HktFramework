// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktGameMode.h"
#include "HktRuntimeLog.h"
#include "HktIngamePlayerController.h"
#include "HktPlayerState.h"
#include "HktServerRuleInterfaces.h"
#include "HktClientRuleInterfaces.h"
#include "HktRuntimeConverter.h"
#include "HktRuntimeTypes.h"
#include "HktCoreDataCollector.h"
#include "HktCoreEventLog.h"
#include "HktTerrainSubsystem.h"
#include "HktTerrainProvider.h"
#include "Settings/HktRuntimeGlobalSetting.h"

DEFINE_LOG_CATEGORY(LogHktRuntime);

AHktGameMode::AHktGameMode()
{
    PrimaryActorTick.bCanEverTick = true;
    PrimaryActorTick.TickGroup = TG_PrePhysics;
}

void AHktGameMode::InitGame(const FString& MapName, const FString& Options, FString& ErrorMessage)
{
    Super::InitGame(MapName, Options, ErrorMessage);

    CachedServerRule = HktRule::GetServerRule(GetWorld());
    if (!CachedServerRule)
    {
        HKT_EVENT_LOG(HktLogTags::Runtime_Server, EHktLogLevel::Error, EHktLogSource::Server, TEXT("InitGame: ServerRule is null"));
        return;
    }

    // 컴포넌트에서 인터페이스 캐싱
    TArray<UActorComponent*> Components;
    GetComponents(Components);
    for (UActorComponent* Comp : Components)
    {
        if (IHktFrameManager* FM = Cast<IHktFrameManager>(Comp))
        {
            CachedFrameManager = FM;
        }
        else if (IHktRelevancyGraph* RG = Cast<IHktRelevancyGraph>(Comp))
        {
            CachedRelevancyGraph = RG;
        }
        else if (IHktWorldDatabase* WD = Cast<IHktWorldDatabase>(Comp))
        {
            CachedWorldDatabase = WD;
        }
    }

    // Rule에 컨텍스트 바인딩 (item 2)
    if (CachedServerRule)
    {
        CachedServerRule->BindContext(
            CachedFrameManager,
            CachedRelevancyGraph,
            CachedWorldDatabase);
    }

    if (CachedRelevancyGraph)
    {
        const UHktRuntimeGlobalSetting* Settings = GetDefault<UHktRuntimeGlobalSetting>();
        const FHktTerrainGeneratorConfig SettingsCfg = Settings->ToTerrainConfig();
        CachedRelevancyGraph->SetTerrainConfig(SettingsCfg);

        // Subsystem-aware Provider 주입 — baked-first + 폴백 정책 활성화.
        //
        // 순서:
        //   1) Subsystem 에 fallback Config 주입 (BakedAsset 부재 시 effective Config 의 출처)
        //   2) RebindTerrainProvider — Sub->GetEffectiveConfig() 가 SettingsCfg 를 반환
        //   3) 델리게이트 등록 — 이후 BakedAsset 로드 완료 시 자동 재바인딩
        //
        // (1) 은 (2) 보다 먼저여야 한다. 그렇지 않으면 BakedAsset 로드 전 윈도에서
        // Provider 가 컴파일-기본값 Config 로 만들어져 시뮬레이터의 VoxelSize 등이 stale 해진다.
        if (UHktTerrainSubsystem* Sub = UHktTerrainSubsystem::Get(this))
        {
            Sub->SetFallbackConfig(SettingsCfg);

            TerrainConfigChangedHandle = Sub->OnEffectiveConfigChanged.AddWeakLambda(
                this,
                [this](const FHktTerrainGeneratorConfig& /*NewConfig*/)
                {
                    RebindTerrainProvider();
                });
        }

        RebindTerrainProvider();
    }

    // 월드 최초 생성 Story 트리거 — 에디터에서 지정한 Tag를 Rule에 전달
    if (CachedServerRule && WorldInitStoryTag.IsValid())
    {
        CachedServerRule->OnEvent_GameModeInitWorld(WorldInitStoryTag, WorldInitLocation);
    }
}

void AHktGameMode::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    if (CachedServerRule)
    {
        CachedServerRule->BindContext(nullptr, nullptr, nullptr);
    }

    if (TerrainConfigChangedHandle.IsValid())
    {
        if (UHktTerrainSubsystem* Sub = UHktTerrainSubsystem::Get(this))
        {
            Sub->OnEffectiveConfigChanged.Remove(TerrainConfigChangedHandle);
        }
        TerrainConfigChangedHandle.Reset();
    }

    if (CachedRelevancyGraph)
    {
        // 그룹별 시뮬레이터에서 Provider 해제 — Subsystem 무효화 이전에 dangling 차단.
        CachedRelevancyGraph->SetTerrainSource(nullptr);
    }

    CachedServerRule             = nullptr;
    CachedFrameManager           = nullptr;
    CachedRelevancyGraph         = nullptr;
    CachedWorldDatabase          = nullptr;

    Super::EndPlay(EndPlayReason);
}

void AHktGameMode::RebindTerrainProvider()
{
    if (!CachedRelevancyGraph) { return; }

    UHktTerrainSubsystem* Sub = UHktTerrainSubsystem::Get(this);
    if (!Sub)
    {
        // Subsystem 부재 — Provider 없이 SetTerrainConfig 만으로 동작 (폴백 Generator).
        UE_LOG(LogHktRuntime, Log,
            TEXT("[GameMode] UHktTerrainSubsystem 부재 — Provider 등록 생략, 기본 Generator 경로 유지"));
        return;
    }

    const FHktTerrainGeneratorConfig EffectiveCfg = Sub->GetEffectiveConfig();
    TWeakObjectPtr<UHktTerrainSubsystem> WeakSub(Sub);

    // 그룹별 시뮬레이터마다 별도 인스턴스 — RelevancyGraph 가 각 그룹마다 팩토리를 호출.
    // Provider 의 Config 는 본 함수 호출 시점의 정적 스냅샷 (CLAUDE.md 절대원칙: 결정론).
    CachedRelevancyGraph->SetTerrainSource(
        [WeakSub, EffectiveCfg]() -> TUniquePtr<IHktTerrainDataSource>
        {
            UHktTerrainSubsystem* CapturedSub = WeakSub.Get();
            if (!CapturedSub)
            {
                return TUniquePtr<IHktTerrainDataSource>();
            }
            return MakeUnique<FHktTerrainProvider>(CapturedSub, EffectiveCfg);
        });

    UE_LOG(LogHktRuntime, Log,
        TEXT("[GameMode] Terrain Provider 재바인딩 — VoxelSizeCm=%d ChunkSize=%d"),
        EffectiveCfg.VoxelSizeCm, FHktTerrainGeneratorConfig::ChunkSize);
}

void AHktGameMode::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    if (!CachedFrameManager || !CachedFrameManager->IsInitialized())
    {
        return;
    }

    // 고정 간격 시뮬레이션 (결정론적: 서버도 1/30초 고정 틱)
    FrameAccumulator += DeltaSeconds;
    while (FrameAccumulator >= FixedDeltaTime)
    {
        FrameAccumulator -= FixedDeltaTime;
        SimulationTick();
    }
}

void AHktGameMode::SimulationTick()
{
#if ENABLE_HKT_INSIGHTS
    double TickStart = FPlatformTime::Seconds();
#endif

    IHktServerRule* Rule = GetServerRule();
    if (!Rule)
    {
        HKT_EVENT_LOG(HktLogTags::Runtime_Server, EHktLogLevel::Warning, EHktLogSource::Server, TEXT("Tick: ServerRule is null"));
        return;
    }

    const FHktEventGameModeTickResult TickResult = Rule->OnEvent_GameModeTick(FixedDeltaTime);
    if (GroupHeartbeatAccumulators.Num() != TickResult.EventSends.Num())
    {
        GroupHeartbeatAccumulators.Init(0.0f, TickResult.EventSends.Num());
    }

    for (int32 GroupIndex = 0; GroupIndex < TickResult.EventSends.Num(); ++GroupIndex)
    {
        const FGroupEventSend& GroupSend = TickResult.EventSends[GroupIndex];
        const FHktSimulationEvent& Batch = GroupSend.Batch;
        const bool bHasContent = Batch.NewEvents.Num() > 0
            || Batch.NewEntityStates.Num() > 0
            || Batch.RemovedOwnerIds.Num() > 0;

        if (bHasContent)
        {
            GroupHeartbeatAccumulators[GroupIndex] = 0.0f;

            if (GroupSend.Existing)
            {
                const TArray<IHktWorldPlayer*>& Existing = *GroupSend.Existing;
                for (IHktWorldPlayer* Player : Existing)
                {
                    if (AHktIngamePlayerController* PC = Cast<AHktIngamePlayerController>(Player->GetOwnerActor()))
                    {
                        PC->Client_ReceiveFrameBatch(HktRuntimeConverter::ConvertToBatch(Batch));
                    }
                }
            }
        }

        if (!bHasContent)
        {
            float& GroupHeartbeatAccumulator = GroupHeartbeatAccumulators[GroupIndex];
            GroupHeartbeatAccumulator += FixedDeltaTime;
            if (GroupHeartbeatAccumulator >= HeartbeatInterval)
            {
                GroupHeartbeatAccumulator -= HeartbeatInterval;

                if (GroupSend.Existing)
                {
                    const TArray<IHktWorldPlayer*>& Existing = *GroupSend.Existing;
                    for (IHktWorldPlayer* Player : Existing)
                    {
                        if (AHktIngamePlayerController* PC = Cast<AHktIngamePlayerController>(Player->GetOwnerActor()))
                        {
                            PC->Client_ReceiveHeartbeat(Batch.FrameNumber);
                        }
                    }
                }
            }
        }

        const TArray<IHktWorldPlayer*>& Entered = GroupSend.Entered;
        for (IHktWorldPlayer* Newbie : Entered)
        {
            if (AHktIngamePlayerController* PC = Cast<AHktIngamePlayerController>(Newbie->GetOwnerActor()))
            {
                const int32 GroupIdx = CachedRelevancyGraph->GetRelevancyGroupIndex(Newbie->GetPlayerUid());
                PC->Client_ReceiveInitialState(HktRuntimeConverter::ConvertWorldState(*GroupSend.NewState), GroupIdx);
            }
        }
    }

#if ENABLE_HKT_INSIGHTS
    LastTickDurationMs = static_cast<float>((FPlatformTime::Seconds() - TickStart) * 1000.0);

    // 서버 런타임 상태 수집
    {
        const FString Cat = TEXT("Runtime.Server");
        HKT_INSIGHT_COLLECT(Cat, TEXT("ServerRule"), CachedServerRule ? TEXT("Active") : TEXT("None"));
        HKT_INSIGHT_COLLECT(Cat, TEXT("TickDuration"),
            FString::Printf(TEXT("%.2f ms"), LastTickDurationMs));

        if (CachedFrameManager)
        {
            HKT_INSIGHT_COLLECT(Cat, TEXT("Frame"),
                FString::Printf(TEXT("%lld"), CachedFrameManager->GetFrameNumber()));
            HKT_INSIGHT_COLLECT(Cat, TEXT("FrameInitialized"),
                CachedFrameManager->IsInitialized() ? TEXT("Yes") : TEXT("No"));
        }

        if (CachedRelevancyGraph)
        {
            int32 NumGroups = CachedRelevancyGraph->NumRelevancyGroup();
            HKT_INSIGHT_COLLECT(Cat, TEXT("RelevancyGroups"), FString::FromInt(NumGroups));

            int32 TotalPlayers = 0;
            for (int32 i = 0; i < NumGroups; ++i)
            {
                TotalPlayers += CachedRelevancyGraph->GetRelevancyGroup(i).GetPlayerUids().Num();
            }
            HKT_INSIGHT_COLLECT(Cat, TEXT("TotalPlayers"), FString::FromInt(TotalPlayers));
        }

        HKT_INSIGHT_COLLECT(Cat, TEXT("PersistentFrame"), CachedFrameManager ? TEXT("OK") : TEXT("NULL"));
        HKT_INSIGHT_COLLECT(Cat, TEXT("Relevancy"), CachedRelevancyGraph ? TEXT("OK") : TEXT("NULL"));
        HKT_INSIGHT_COLLECT(Cat, TEXT("Database"), CachedWorldDatabase ? TEXT("OK") : TEXT("NULL"));
    }
#endif
}

void AHktGameMode::PostLogin(APlayerController* NewPlayer)
{
    Super::PostLogin(NewPlayer);

    AHktIngamePlayerController* HktPC = Cast<AHktIngamePlayerController>(NewPlayer);
    if (!HktPC) return;

    IHktServerRule* Rule = GetServerRule();
    if (!Rule) return;

    IHktWorldPlayer* WorldPlayer = HktPC->FindComponentByInterface<IHktWorldPlayer>();
    if (!WorldPlayer) return;

    // item 1: 액터 이벤트 그대로 전달 (DB 파라미터 없음 — item 2)
    Rule->OnEvent_GameModePostLogin(*WorldPlayer);

    HKT_EVENT_LOG(HktLogTags::Runtime_Server, EHktLogLevel::Info, EHktLogSource::Server,
        FString::Printf(TEXT("PostLogin PlayerUid=%lld"), WorldPlayer->GetPlayerUid()));
}

void AHktGameMode::Logout(AController* Exiting)
{
    AHktIngamePlayerController* HktPC = Cast<AHktIngamePlayerController>(Exiting);
    if (!HktPC) return;

    IHktServerRule* Rule = GetServerRule();
    if (!Rule) return;

    IHktWorldPlayer* WorldPlayer = HktPC->FindComponentByInterface<IHktWorldPlayer>();
    if (!WorldPlayer || !WorldPlayer->IsInitialized()) return;

    const int64 PlayerUid = WorldPlayer->GetPlayerUid();
    HKT_EVENT_LOG(HktLogTags::Runtime_Server, EHktLogLevel::Info, EHktLogSource::Server,
        FString::Printf(TEXT("Logout PlayerUid=%lld"), PlayerUid));

    // item 1: 액터 이벤트 그대로 전달 (DB 파라미터 없음 — item 2)
    Rule->OnEvent_GameModeLogout(*WorldPlayer);

    Super::Logout(Exiting);
}

void AHktGameMode::PushRuntimeEvent(int64 PlayerUid, const FHktEvent& Event)
{
    IHktServerRule* Rule = GetServerRule();
    if (!Rule) return;

    IHktRelevancyGraph* Graph = CachedRelevancyGraph;
    if (!Graph) return;

    IHktWorldPlayer* WorldPlayer = Graph->GetWorldPlayer(PlayerUid);
    if (!WorldPlayer) return;

    HKT_EVENT_LOG_TAG(HktLogTags::Runtime_Server, EHktLogLevel::Info, EHktLogSource::Server,
        FString::Printf(TEXT("PushRuntimeEvent PlayerUid=%lld %s"), PlayerUid, *Event.ToString()),
        Event.SourceEntity, Event.EventTag);
    Rule->OnReceived_RuntimeEvent(Event, *WorldPlayer);
}

void AHktGameMode::PushBagRequest(int64 PlayerUid, const FHktBagRequest& Request)
{
    IHktServerRule* Rule = GetServerRule();
    if (!Rule) return;

    IHktRelevancyGraph* Graph = CachedRelevancyGraph;
    if (!Graph) return;

    IHktWorldPlayer* WorldPlayer = Graph->GetWorldPlayer(PlayerUid);
    if (!WorldPlayer) return;

    HKT_EVENT_LOG(HktLogTags::Runtime_Server, EHktLogLevel::Info, EHktLogSource::Server,
        FString::Printf(TEXT("PushBagRequest PlayerUid=%lld %s"), PlayerUid, *Request.ToString()));
    Rule->OnReceived_BagRequest(Request, *WorldPlayer);
}

IHktServerRule* AHktGameMode::GetServerRule() const
{
    return CachedServerRule;
}
