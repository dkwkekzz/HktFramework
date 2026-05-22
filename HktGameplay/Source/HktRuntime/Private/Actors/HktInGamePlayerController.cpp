// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktIngamePlayerController.h"
#include "HktCoreArchetype.h"
#include "HktRuntimeLog.h"
#include "HktRuntimeStats.h"
#include "HktPlayerState.h"
#include "HktClientRuleInterfaces.h"
#include "HktGameMode.h"
#include "HktRuntimeConverter.h"
#include "HktRuntimeTypes.h"
#include "Components/HktPlayerInventoryComponent.h"
#include "HktCoreDataCollector.h"
#include "HktCoreEventLog.h"
#include "HktStoryBuilder.h"
#include "HktRuntimeTags.h"
#include "HktCoreProperties.h"
#include "HktCoreEvents.h"
#include "HktWorldView.h"
#include "EnhancedInputSubsystems.h"
#include "EnhancedInputComponent.h"
#include "GameplayTagsManager.h"
#include "HAL/IConsoleManager.h"
#include "HktRuntimeTags.h"

DECLARE_CYCLE_STAT(TEXT("PlayerController.Tick"),               STAT_HktRuntime_PlayerControllerTick, STATGROUP_HktRuntime);
DECLARE_CYCLE_STAT(TEXT("PlayerController.BroadcastWorldView"), STAT_HktRuntime_BroadcastWorldView,   STATGROUP_HktRuntime);
DECLARE_CYCLE_STAT(TEXT("PlayerController.ReceiveFrameBatch"),  STAT_HktRuntime_ReceiveFrameBatch,    STATGROUP_HktRuntime);
DECLARE_CYCLE_STAT(TEXT("PlayerController.AutoPickup"),         STAT_HktRuntime_AutoPickup,           STATGROUP_HktRuntime);

AHktIngamePlayerController::AHktIngamePlayerController()
{
    bShowMouseCursor = true;
    bEnableClickEvents = true;
    bEnableMouseOverEvents = true;
}

void AHktIngamePlayerController::BeginPlay()
{
    Super::BeginPlay();

    if (UEnhancedInputLocalPlayerSubsystem* Subsystem = ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(GetLocalPlayer()))
    {
        if (DefaultMappingContext)
        {
            Subsystem->AddMappingContext(DefaultMappingContext, 0);
        }
    }

    // ClientRule — 로컬 플레이어 컨트롤러에서만 초기화한다.
    // NetMode 조건(NM_Standalone/NM_Client)으로 분기하면 ListenServer 호스트 PC가 누락된다.
    // IsLocalController()는 Standalone·Client·ListenServer 호스트 모두 true,
    // DedicatedServer 측 원격 PC에서는 false를 반환하므로 의미상 정확하다.
    if (IsLocalController())
    {
        CachedClientRule = HktRule::GetClientRule(GetWorld());

        // SpriteCrowdHost를 BP에서 지정한 클래스로 스폰 (HUD 등록 패턴).
        // 로컬 컨트롤러에서만 — Dedicated Server에선 IsLocalController()가 false라 자동 스킵.
        if (!SpriteCrowdHostClass.IsNull())
        {
            UClass* HostClass = SpriteCrowdHostClass.LoadSynchronous();
            if (HostClass)
            {
                FActorSpawnParameters Params;
                Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
                Params.ObjectFlags = RF_Transient;
                Params.Owner = this;
                SpawnedSpriteCrowdHost = GetWorld()->SpawnActor<AActor>(HostClass, FTransform::Identity, Params);
                if (!SpawnedSpriteCrowdHost)
                {
                    UE_LOG(LogHktRuntime, Warning, TEXT("SpriteCrowdHost 스폰 실패: %s"), *HostClass->GetName());
                }
#if WITH_EDITOR
                else
                {
                    SpawnedSpriteCrowdHost->SetActorLabel(TEXT("HktSpriteCrowdHost"));
                }
#endif
            }
            else
            {
                UE_LOG(LogHktRuntime, Warning, TEXT("SpriteCrowdHostClass 로드 실패: %s"), *SpriteCrowdHostClass.ToString());
            }
        }
    }

    // 컴포넌트에서 인터페이스 캐싱
    TArray<UActorComponent*> Components;
    GetComponents(Components);
    for (UActorComponent* Comp : Components)
    {
        if (IHktIntentBuilder* IntentBuilder = Cast<IHktIntentBuilder>(Comp))
        {
            CachedIntentBuilder = IntentBuilder;
        }
        else if (IHktUnitSelectionPolicy* SelectionPolicy = Cast<IHktUnitSelectionPolicy>(Comp))
        {
            CachedSelectionPolicy = SelectionPolicy;
        }
        else if (IHktProxySimulator* ProxySimulator = Cast<IHktProxySimulator>(Comp))
        {
            CachedProxySimulator = ProxySimulator;
        }
        else if (IHktCommandContainer* CommandContainer = Cast<IHktCommandContainer>(Comp))
        {
            CachedCommandContainer = CommandContainer;
            CommandContainer->InitializeSlots(SlotInputActions.Num());
        }
        else if (IHktWorldPlayer* WorldPlayer = Cast<IHktWorldPlayer>(Comp))
        {
            CachedWorldPlayer = WorldPlayer;
        }

        if (UHktPlayerInventoryComponent* InventoryComp = Cast<UHktPlayerInventoryComponent>(Comp))
        {
            CachedInventoryComponent = InventoryComp;
        }
    }

    // 컨텍스트 바인딩 — ServerRule::BindContext와 동일한 패턴
    if (CachedClientRule)
    {
        CachedClientRule->BindContext(
            CachedProxySimulator,
            CachedIntentBuilder,
            CachedSelectionPolicy,
            CachedCommandContainer,
            CachedWorldPlayer);
    }

    // ProxySimulatorComponent가 먼저 틱한 후 PlayerController Tick이 실행되도록 보장
    if (UActorComponent* ProxyComp = Cast<UActorComponent>(CachedProxySimulator))
    {
        AddTickPrerequisiteComponent(ProxyComp);
    }
}

void AHktIngamePlayerController::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    if (CachedClientRule)
    {
        CachedClientRule->BindContext(nullptr, nullptr, nullptr, nullptr, nullptr);
    }

    if (SpawnedSpriteCrowdHost)
    {
        SpawnedSpriteCrowdHost->Destroy();
        SpawnedSpriteCrowdHost = nullptr;
    }

    CachedClientRule       = nullptr;
    CachedIntentBuilder    = nullptr;
    CachedSelectionPolicy  = nullptr;
    CachedProxySimulator   = nullptr;
    CachedCommandContainer = nullptr;
    CachedWorldPlayer      = nullptr;
    CachedInventoryComponent     = nullptr;

    Super::EndPlay(EndPlayReason);
}

void AHktIngamePlayerController::OnRep_PlayerState()
{
    Super::OnRep_PlayerState();

    if (CachedWorldPlayer)
    {
        CachedWorldPlayer->InvalidatePlayerUidCache();
    }

    HKT_EVENT_LOG(HktLogTags::Runtime_Client, EHktLogLevel::Info, EHktLogSource::Client, TEXT("OnRep_PlayerState"));
}

void AHktIngamePlayerController::SetupInputComponent()
{
    Super::SetupInputComponent();

    UEnhancedInputComponent* EnhancedInput = Cast<UEnhancedInputComponent>(InputComponent);
    if (!EnhancedInput) return;

    if (SubjectAction) EnhancedInput->BindAction(SubjectAction, ETriggerEvent::Started, this, &AHktIngamePlayerController::OnSubjectAction);
    if (TargetAction)  EnhancedInput->BindAction(TargetAction,  ETriggerEvent::Started, this, &AHktIngamePlayerController::OnTargetAction);
    if (ZoomAction)    EnhancedInput->BindAction(ZoomAction,    ETriggerEvent::Triggered, this, &AHktIngamePlayerController::OnZoom);
    if (JumpAction)    EnhancedInput->BindAction(JumpAction,    ETriggerEvent::Started, this, &AHktIngamePlayerController::OnJumpAction);

    for (int32 i = 0; i < SlotInputActions.Num(); ++i)
    {
        if (SlotInputActions[i]) EnhancedInput->BindAction(SlotInputActions[i], ETriggerEvent::Started, this, &AHktIngamePlayerController::OnSlotAction, i);
    }

    if (MoveAction)
    {
        EnhancedInput->BindAction(MoveAction, ETriggerEvent::Triggered, this, &AHktIngamePlayerController::OnMoveAction);
        EnhancedInput->BindAction(MoveAction, ETriggerEvent::Completed, this, &AHktIngamePlayerController::OnMoveActionCompleted);
    }
}

// ============================================================================
// 입력 이벤트 — 판단 로직은 Rule에 위임, PC는 전달만
// ============================================================================

void AHktIngamePlayerController::OnSubjectAction(const FInputActionValue& Value)
{
    // 커서가 숨겨진 모드(ShoulderView 등)에서는 클릭-기반 RTS 선택을 비활성화
    if (!bShowMouseCursor) return;

    IHktClientRule* Rule = GetClientRule();
    if (!Rule) return;

    Rule->OnUserEvent_SubjectInputAction();

    if (CachedIntentBuilder)
    {
        // 빈 공간 클릭 시 (Subject 미선택) → 기본 Subject로 복원
        if (CachedIntentBuilder->GetSubjectEntityId() == InvalidEntityId && DefaultSubjectEntityId != InvalidEntityId)
        {
            CachedIntentBuilder->SetSubject(DefaultSubjectEntityId);
        }

        SubjectChangedDelegate.Broadcast(CachedIntentBuilder->GetSubjectEntityId());
        HKT_EVENT_LOG_ENTITY(HktLogTags::Runtime_Intent, EHktLogLevel::Info, EHktLogSource::Client,
            FString::Printf(TEXT("OnSubjectAction SubjectEntityId=%d"), CachedIntentBuilder->GetSubjectEntityId()),
            CachedIntentBuilder->GetSubjectEntityId());
    }
}

void AHktIngamePlayerController::OnTargetAction(const FInputActionValue& Value)
{
    // 커서가 숨겨진 모드(ShoulderView 등)에서는 RTS 우클릭 이동/공격 인텐트를 발사하지 않는다
    // — 그렇지 않으면 ShoulderView에서 우클릭 한 번에 캐릭터가 클릭 지점으로 끝없이 이동함
    if (!bShowMouseCursor) return;

    IHktClientRule* Rule = GetClientRule();
    if (!Rule) return;

    Rule->OnUserEvent_TargetInputAction();

    if (CachedIntentBuilder)
    {
        // "방금 해석된 타겟" 은 Policy 의 LastResolved* 캐시에서 직접 조회.
        // IntentBuilder.TargetEntityId 는 Rule 의 ResetCommand 직후 InvalidEntityId 로 비워지므로 사용 불가.
        // Policy 캐시는 다음 ResolveTarget 호출 전까지 유효.
        // Delegate 가 fire 되기 전에 갱신해 subscribers 가 GetCurrentVoxelTarget() 으로 즉시 조회 가능.
        const FHktEntityId TargetEntity = CachedSelectionPolicy
            ? CachedSelectionPolicy->GetLastResolvedTargetEntityId()
            : InvalidEntityId;
        if (TargetEntity == VoxelTargetEntityId && CachedSelectionPolicy)
        {
            CurrentVoxelTarget = CachedSelectionPolicy->GetLastResolvedVoxel();
        }
        else
        {
            CurrentVoxelTarget = FHktVoxelSelection{};
        }

        TargetChangedDelegate.Broadcast(TargetEntity);

        // Rule이 빌드한 이벤트가 있으면 전송
        if (CachedIntentBuilder->HasPendingRuntimeEvent())
        {
            FHktEvent Event = CachedIntentBuilder->ConsumePendingRuntimeEvent();
            Event.PlayerUid = GetPlayerUid();
            Server_ReceiveRuntimeEvent(FHktRuntimeEvent(Event));
            IntentSubmittedDelegate.Broadcast(FHktRuntimeEvent(Event));

            HKT_EVENT_LOG_TAG(HktLogTags::Runtime_Intent, EHktLogLevel::Info, EHktLogSource::Client,
                FString::Printf(TEXT("OnTargetAction Submit %s"), *Event.ToString()),
                Event.SourceEntity, Event.EventTag);
        }
    }
}

void AHktIngamePlayerController::OnSlotAction(const FInputActionValue& Value, int32 SlotIndex)
{
    IHktClientRule* Rule = GetClientRule();
    if (!Rule) return;

    Rule->OnUserEvent_CommandInputAction(SlotIndex);

    if (CachedIntentBuilder && CachedCommandContainer)
    {
        // 타겟 필요 여부 확인
        bool bTargetRequired = CachedCommandContainer->IsTargetRequiredAtSlot(SlotIndex);
        if (bTargetRequired)
        {
            // 타겟 대기 상태 — CommandChanged 브로드캐스트
            CommandChangedDelegate.Broadcast(CachedCommandContainer->GetEventTagAtSlot(SlotIndex));
            HKT_EVENT_LOG(HktLogTags::Runtime_Client, EHktLogLevel::Verbose, EHktLogSource::Client, FString::Printf(TEXT("OnSlotAction WaitTarget Slot=%d"), SlotIndex));
            return;
        }

        // 타겟 불필요한 스킬 → Rule이 이벤트를 빌드했으면 즉시 전송
        if (CachedIntentBuilder->HasPendingRuntimeEvent())
        {
            FHktEvent Event = CachedIntentBuilder->ConsumePendingRuntimeEvent();
            Event.PlayerUid = GetPlayerUid();
            Server_ReceiveRuntimeEvent(FHktRuntimeEvent(Event));
            IntentSubmittedDelegate.Broadcast(FHktRuntimeEvent(Event));

            HKT_EVENT_LOG_TAG(HktLogTags::Runtime_Intent, EHktLogLevel::Info, EHktLogSource::Client,
                FString::Printf(TEXT("OnSlotAction Submit Slot=%d %s"), SlotIndex, *Event.ToString()),
                Event.SourceEntity, Event.EventTag);
        }
        else
        {
            // 커맨드 대기 상태 (타겟 지정 필요)
            CommandChangedDelegate.Broadcast(CachedCommandContainer->GetEventTagAtSlot(SlotIndex));
        }
    }
}

void AHktIngamePlayerController::OnZoom(const FInputActionValue& Value)
{
    IHktClientRule* Rule = GetClientRule();
    if (!Rule) return;

    if (Value.GetValueType() == EInputActionValueType::Axis1D)
    {
        float Delta = Value.Get<float>();
        Rule->OnUserEvent_ZoomInputAction(Delta);
        WheelInputDelegate.Broadcast(Delta);
    }
}

void AHktIngamePlayerController::OnJumpAction(const FInputActionValue& Value)
{
    IHktClientRule* Rule = GetClientRule();
    if (!Rule) return;

    Rule->OnUserEvent_JumpInputAction();

    // Rule이 빌드한 점프 이벤트가 있으면 즉시 전송
    if (CachedIntentBuilder && CachedIntentBuilder->HasPendingRuntimeEvent())
    {
        FHktEvent Event = CachedIntentBuilder->ConsumePendingRuntimeEvent();
        Event.PlayerUid = GetPlayerUid();
        Server_ReceiveRuntimeEvent(FHktRuntimeEvent(Event));
        IntentSubmittedDelegate.Broadcast(FHktRuntimeEvent(Event));

        HKT_EVENT_LOG_TAG(HktLogTags::Runtime_Intent, EHktLogLevel::Info, EHktLogSource::Client,
            FString::Printf(TEXT("OnJumpAction Submit %s"), *Event.ToString()),
            Event.SourceEntity, Event.EventTag);
    }
}

void AHktIngamePlayerController::OnMoveAction(const FInputActionValue& Value)
{
    if (Value.GetValueType() != EInputActionValueType::Axis2D) return;

    const FVector2D Input = Value.Get<FVector2D>();
    if (Input.IsNearlyZero()) return;

    // 카메라 Yaw 기준으로 월드 방향 계산
    const FRotator CameraRot = PlayerCameraManager ? PlayerCameraManager->GetCameraRotation() : GetControlRotation();
    const FRotator YawRot(0.0f, CameraRot.Yaw, 0.0f);
    const FVector Forward = FRotationMatrix(YawRot).GetUnitAxis(EAxis::X);
    const FVector Right = FRotationMatrix(YawRot).GetUnitAxis(EAxis::Y);

    FVector Direction = (Forward * Input.X + Right * Input.Y).GetSafeNormal();
    if (Direction.IsNearlyZero()) return;

    // 쓰로틀: 방향이 크게 변경되었거나 일정 시간 경과 시에만 전송
    const double Now = FPlatformTime::Seconds();
    const bool bDirectionChanged = FVector::DotProduct(Direction, LastMoveDirection) < 0.95f;
    const bool bTimeElapsed = (Now - LastMoveEventTime) >= 0.1;

    if (bIsDirectionalMoving && !bDirectionChanged && !bTimeElapsed) return;

    bIsDirectionalMoving = true;
    SubmitMoveEvent(Direction);
}

void AHktIngamePlayerController::OnMoveActionCompleted(const FInputActionValue& Value)
{
    // 항상 Stop 이벤트를 시도한다 — bIsDirectionalMoving 가드를 두면
    // IMC 교체/포커스 손실로 Triggered가 누락된 경우 정지가 안 나가서 캐릭터가 계속 전진함
    bIsDirectionalMoving = false;
    LastMoveDirection = FVector::ZeroVector;

    IHktClientRule* Rule = GetClientRule();
    if (!Rule) return;

    Rule->OnUserEvent_MoveStopAction();

    if (CachedIntentBuilder && CachedIntentBuilder->HasPendingRuntimeEvent())
    {
        FHktEvent Event = CachedIntentBuilder->ConsumePendingRuntimeEvent();
        Event.PlayerUid = GetPlayerUid();
        Server_ReceiveRuntimeEvent(FHktRuntimeEvent(Event));
        IntentSubmittedDelegate.Broadcast(FHktRuntimeEvent(Event));

        HKT_EVENT_LOG(HktLogTags::Runtime_Intent, EHktLogLevel::Info, EHktLogSource::Client,
            FString::Printf(TEXT("OnMoveActionCompleted Submit %s"), *Event.ToString()));
    }
}

void AHktIngamePlayerController::SubmitMoveEvent(const FVector& Direction)
{
    IHktClientRule* Rule = GetClientRule();
    if (!Rule) return;

    Rule->OnUserEvent_MoveInputAction(Direction);

    if (CachedIntentBuilder && CachedIntentBuilder->HasPendingRuntimeEvent())
    {
        FHktEvent Event = CachedIntentBuilder->ConsumePendingRuntimeEvent();
        Event.PlayerUid = GetPlayerUid();
        Server_ReceiveRuntimeEvent(FHktRuntimeEvent(Event));
        IntentSubmittedDelegate.Broadcast(FHktRuntimeEvent(Event));

        LastMoveDirection = Direction;
        LastMoveEventTime = FPlatformTime::Seconds();

        HKT_EVENT_LOG(HktLogTags::Runtime_Intent, EHktLogLevel::Info, EHktLogSource::Client,
            FString::Printf(TEXT("SubmitMoveEvent Dir=(%.1f,%.1f,%.1f) %s"),
                Direction.X, Direction.Y, Direction.Z, *Event.ToString()));
    }
}

// ============================================================================
// S2C RPC
// ============================================================================

void AHktIngamePlayerController::Client_ReceiveInitialState_Implementation(const FHktRuntimeSimulationState& State, int32 GroupIndex)
{
#if ENABLE_HKT_INSIGHTS
    InsightReceivedInitialStateCount++;
#endif

    HKT_EVENT_LOG(HktLogTags::Runtime_Client, EHktLogLevel::Info, EHktLogSource::Client, FString::Printf(TEXT("ReceiveInitialState GroupIndex=%d"), GroupIndex));
    bIsInitialSync = false;

    IHktClientRule* Rule = GetClientRule();
    if (Rule)
    {
        Rule->OnReceived_InitialState(HktRuntimeConverter::ConvertToWorldState(State), GroupIndex);
    }
}

void AHktIngamePlayerController::Client_ReceiveFrameBatch_Implementation(const FHktRuntimeBatch& Batch)
{
    SCOPE_CYCLE_COUNTER(STAT_HktRuntime_ReceiveFrameBatch);

    IHktClientRule* Rule = GetClientRule();
    if (!Rule) return;

#if ENABLE_HKT_INSIGHTS
    InsightReceivedBatchCount++;
#endif

    HKT_EVENT_LOG(HktLogTags::Runtime_Client, EHktLogLevel::Info, EHktLogSource::Client,
        FString::Printf(TEXT("ReceiveFrameBatch Frame=%lld Events=%d"),
            Batch.Value.FrameNumber, Batch.Value.NewEvents.Num()));
    Rule->OnReceived_FrameBatch(static_cast<const FHktSimulationEvent&>(Batch));
}

void AHktIngamePlayerController::Client_ReceiveHeartbeat_Implementation(int64 ServerFrame)
{
#if ENABLE_HKT_INSIGHTS
    InsightReceivedHeartbeatCount++;
#endif

    if (CachedProxySimulator)
    {
        CachedProxySimulator->NotifyHeartbeat(ServerFrame);
    }
}

// ============================================================================
// Tick — ProxySimulator가 생성한 Diff를 소비하여 Presentation에 전달
// ============================================================================

void AHktIngamePlayerController::Tick(float DeltaSeconds)
{
    SCOPE_CYCLE_COUNTER(STAT_HktRuntime_PlayerControllerTick);

    Super::Tick(DeltaSeconds);

    if (!CachedProxySimulator || !CachedProxySimulator->IsInitialized()) return;

    if (!bIsInitialSync)
    {
        bIsInitialSync = true;

        // InitialState 수신 후 나의 엔티티를 기본 Subject로 설정
        ResolveDefaultSubject();

        if (CachedProxySimulator)
        {
            FHktWorldView View;
            View.WorldState = &CachedProxySimulator->GetWorldState();
            View.FrameNumber = CachedProxySimulator->GetWorldState().FrameNumber;
            View.bIsInitialSync = true;
            WorldViewUpdatedDelegate.Broadcast(View);

            // InitialSync 시 전체 슬롯 바인딩 동기화
            SyncSlotBindingsFromWorldState(View);
        }
    }

    // PlayerUid가 지연 복제되어 ResolveDefaultSubject가 실패한 경우 재시도
    if (DefaultSubjectEntityId == InvalidEntityId && CachedProxySimulator && CachedProxySimulator->IsInitialized())
    {
        ResolveDefaultSubject();
    }

    FHktSimulationDiff Diff;
    if (CachedProxySimulator->ConsumePendingDiff(Diff))
    {
        SCOPE_CYCLE_COUNTER(STAT_HktRuntime_BroadcastWorldView);

        FHktWorldView View;
        View.WorldState = &CachedProxySimulator->GetWorldState();
        View.FrameNumber = Diff.FrameNumber;
        View.bIsInitialSync = false;
        View.SpawnedEntities = &Diff.SpawnedEntities;
        View.RemovedEntities = &Diff.RemovedEntities;
        View.PropertyDeltas = &Diff.PropertyDeltas;
        View.TagDeltas = &Diff.TagDeltas;
        View.OwnerDeltas = &Diff.OwnerDeltas;
        View.VFXEvents = &Diff.VFXEvents;
        View.AnimEvents = &Diff.AnimEvents;
        WorldViewUpdatedDelegate.Broadcast(View);

        // EquipIndex 변경이 포함된 경우 슬롯 바인딩 동기화
        SyncSlotBindingsFromWorldState(View);
    }

    // 자동 픽업 — Subject 주변 ground 아이템 스캔 (I-0035 P5)
    {
        SCOPE_CYCLE_COUNTER(STAT_HktRuntime_AutoPickup);
        TickAutoPickup();
    }

#if ENABLE_HKT_INSIGHTS
    // 클라이언트 런타임 상태 수집
    {
        const FString Cat = TEXT("Runtime.Client");
        FString NetModeStr;
        switch (GetWorld()->GetNetMode())
        {
        case NM_Standalone:       NetModeStr = TEXT("Standalone"); break;
        case NM_DedicatedServer:  NetModeStr = TEXT("DedicatedServer"); break;
        case NM_ListenServer:     NetModeStr = TEXT("ListenServer"); break;
        default:                  NetModeStr = TEXT("Client"); break;
        }
        HKT_INSIGHT_COLLECT(Cat, TEXT("NetMode"), NetModeStr);
        HKT_INSIGHT_COLLECT(Cat, TEXT("Role"), HasAuthority() ? TEXT("Server") : TEXT("Client"));

        if (CachedIntentBuilder)
        {
            HKT_INSIGHT_COLLECT(Cat, TEXT("Subject"), FString::FromInt(CachedIntentBuilder->GetSubjectEntityId()));
            FGameplayTag Tag = CachedIntentBuilder->GetEventTag();
            HKT_INSIGHT_COLLECT(Cat, TEXT("Command"), Tag.IsValid() ? Tag.ToString() : TEXT("(none)"));
        }

        if (CachedProxySimulator && CachedProxySimulator->IsInitialized())
        {
            const FHktWorldState& WS = CachedProxySimulator->GetWorldState();
            HKT_INSIGHT_COLLECT(Cat, TEXT("ProxyFrame"), FString::Printf(TEXT("%lld"), WS.FrameNumber));
            HKT_INSIGHT_COLLECT(Cat, TEXT("ProxyEntities"), FString::FromInt(WS.GetEntityCount()));
        }

        if (CachedWorldPlayer)
        {
            HKT_INSIGHT_COLLECT(Cat, TEXT("PlayerUid"), FString::Printf(TEXT("%lld"), CachedWorldPlayer->GetPlayerUid()));
        }

        HKT_INSIGHT_COLLECT(Cat, TEXT("SentIntents"), FString::FromInt(InsightSentIntentCount));
        HKT_INSIGHT_COLLECT(Cat, TEXT("ReceivedBatches"), FString::FromInt(InsightReceivedBatchCount));
        HKT_INSIGHT_COLLECT(Cat, TEXT("ReceivedInitialStates"), FString::FromInt(InsightReceivedInitialStateCount));
        HKT_INSIGHT_COLLECT(Cat, TEXT("ReceivedHeartbeats"), FString::FromInt(InsightReceivedHeartbeatCount));
    }
#endif
}

// ============================================================================
// C2S RPC — 통합 RuntimeEvent
// ============================================================================

bool AHktIngamePlayerController::Server_ReceiveRuntimeEvent_Validate(const FHktRuntimeEvent& Event)
{
    return Event.Value.SourceEntity != InvalidEntityId && Event.Value.EventTag.IsValid();
}

void AHktIngamePlayerController::Server_ReceiveRuntimeEvent_Implementation(const FHktRuntimeEvent& Event)
{
#if ENABLE_HKT_INSIGHTS
    InsightSentIntentCount++;
#endif

    if (AHktGameMode* GM = GetWorld()->GetAuthGameMode<AHktGameMode>())
    {
        GM->PushRuntimeEvent(GetPlayerUid(), Event.Value);
    }
}

// ============================================================================
// 아이템 상호작용 (UI 전용 — RuntimeEvent로 통합)
// ============================================================================

void AHktIngamePlayerController::RequestItemDrop(FHktEntityId ItemEntity)
{
    if (!CachedIntentBuilder || ItemEntity == InvalidEntityId) return;

    const FHktEntityId SubjectEntity = CachedIntentBuilder->GetSubjectEntityId();
    if (SubjectEntity == InvalidEntityId) return;

    FHktEvent Event;
    Event.EventTag = HktGameplayTags::Story_Event_Item_Drop;
    Event.SourceEntity = SubjectEntity;
    Event.TargetEntity = ItemEntity;
    Event.PlayerUid = GetPlayerUid();
    Server_ReceiveRuntimeEvent(FHktRuntimeEvent(Event));

    HKT_EVENT_LOG_ENTITY(HktLogTags::Runtime_Intent, EHktLogLevel::Info, EHktLogSource::Client,
        FString::Printf(TEXT("RequestItemDrop Item=%d"), ItemEntity), SubjectEntity);
}

void AHktIngamePlayerController::RequestActionEvent(FGameplayTag ActionTag)
{
    if (!ActionTag.IsValid()) return;

    // Subject 는 IntentBuilder 의 현재 선택, 없으면 DefaultSubject 로 fallback
    FHktEntityId SubjectEntity = InvalidEntityId;
    FHktEntityId TargetEntity = InvalidEntityId;
    if (CachedIntentBuilder)
    {
        SubjectEntity = CachedIntentBuilder->GetSubjectEntityId();
        TargetEntity  = CachedIntentBuilder->GetTargetEntityId();
    }
    if (SubjectEntity == InvalidEntityId)
    {
        SubjectEntity = DefaultSubjectEntityId;
    }
    if (SubjectEntity == InvalidEntityId) return;

    FHktEvent Event;
    Event.EventTag = ActionTag;
    Event.SourceEntity = SubjectEntity;
    Event.TargetEntity = TargetEntity;
    Event.PlayerUid = GetPlayerUid();
    Server_ReceiveRuntimeEvent(FHktRuntimeEvent(Event));
    IntentSubmittedDelegate.Broadcast(FHktRuntimeEvent(Event));

    HKT_EVENT_LOG_TAG(HktLogTags::Runtime_Intent, EHktLogLevel::Info, EHktLogSource::Client,
        FString::Printf(TEXT("RequestActionEvent Submit %s"), *Event.ToString()),
        Event.SourceEntity, Event.EventTag);
}

void AHktIngamePlayerController::RequestSetSubject(FHktEntityId InEntity)
{
    // I-0041 다중 Entity 채널 — 소유권 검증 후 Subject 전환.
    if (!CachedIntentBuilder) return;
    if (!CachedProxySimulator || !CachedProxySimulator->IsInitialized()) return;

    const FHktWorldState& WS = CachedProxySimulator->GetWorldState();

    // InvalidEntityId → DefaultSubject 로 복원 (UI 가 "선택 해제" 의미로 호출 가능).
    if (InEntity == InvalidEntityId)
    {
        if (DefaultSubjectEntityId == InvalidEntityId) return;
        CachedIntentBuilder->SetSubject(DefaultSubjectEntityId);
        SubjectChangedDelegate.Broadcast(DefaultSubjectEntityId);
        return;
    }

    if (!WS.IsValidEntity(InEntity)) return;

    const int64 MyUid = GetPlayerUid();
    if (MyUid == 0) return;

    const int64 EntityOwner = WS.GetOwnerUid(InEntity);
    if (EntityOwner != MyUid)
    {
        HKT_EVENT_LOG_ENTITY(HktLogTags::Runtime_Client, EHktLogLevel::Warning, EHktLogSource::Client,
            FString::Printf(TEXT("RequestSetSubject rejected — entity %d owner=%lld != my %lld"),
                InEntity, EntityOwner, MyUid),
            InEntity);
        return;
    }

    CachedIntentBuilder->SetSubject(InEntity);
    SubjectChangedDelegate.Broadcast(InEntity);
    HKT_EVENT_LOG_ENTITY(HktLogTags::Runtime_Client, EHktLogLevel::Info, EHktLogSource::Client,
        FString::Printf(TEXT("RequestSetSubject Subject=%d"), InEntity), InEntity);
}

void AHktIngamePlayerController::ResolveDefaultSubject()
{
    if (!CachedProxySimulator || !CachedProxySimulator->IsInitialized()) return;

    const int64 PlayerUid = GetPlayerUid();
    if (PlayerUid == 0) return;

    const FHktWorldState& WS = CachedProxySimulator->GetWorldState();
    DefaultSubjectEntityId = InvalidEntityId;

    WS.ForEachEntityByOwner(PlayerUid, [this](FHktEntityId Id, int32 /*Slot*/)
    {
        if (DefaultSubjectEntityId == InvalidEntityId)
        {
            DefaultSubjectEntityId = Id;
        }
    });

    if (DefaultSubjectEntityId != InvalidEntityId && CachedIntentBuilder)
    {
        CachedIntentBuilder->SetSubject(DefaultSubjectEntityId);
        SubjectChangedDelegate.Broadcast(DefaultSubjectEntityId);
        HKT_EVENT_LOG(HktLogTags::Runtime_Client, EHktLogLevel::Info, EHktLogSource::Client, FString::Printf(TEXT("ResolveDefaultSubject: DefaultSubjectEntityId=%d PlayerUid=%lld"), DefaultSubjectEntityId, PlayerUid));
    }
}

// ============================================================================
// Auto-Pickup (I-0035 P5)
//
// 매 프레임 Subject 주변의 ground 아이템(ItemState==0, archetype==Item)을
// 인식 반경 안에서 스캔하고, 발견 즉시 Story.Event.Item.Pickup 이벤트를 서버로
// 전송한다. 권위 판정(거리·상태·빈 슬롯)은 서버 Story_ItemPickup precondition
// 이 수행 — 클라는 *의도 제출* 만 책임지며, 거절은 silent.
//
// spam 방지: 동일 item 에 대해 AutoPickupRetrySeconds(1.0s) 쿨다운. 서버가
// 거절(가방 만석 등)한 경우 사용자가 빠지지 않고 그 자리에 머물러도 매 틱
// 재전송되지 않는다. 아이템이 사라지거나 ItemState 가 바뀌면 sweep 에서 제거.
// ============================================================================

namespace
{
    static int32 GAutoPickupEnabled = 1;
    static FAutoConsoleVariableRef CVarAutoPickupEnabled(
        TEXT("hkt.Client.AutoPickup"),
        GAutoPickupEnabled,
        TEXT("0 = disable client-side auto-pickup proximity scan, 1 = enable (default)."),
        ECVF_Default);
}

void AHktIngamePlayerController::TickAutoPickup()
{
    if (GAutoPickupEnabled == 0) return;
    if (!IsLocalController()) return;
    if (DefaultSubjectEntityId == InvalidEntityId) return;
    if (!CachedProxySimulator || !CachedProxySimulator->IsInitialized()) return;

    const double Now = GetWorld() ? GetWorld()->GetRealTimeSeconds() : 0.0;
    if (Now - LastAutoPickupScanTime < AutoPickupScanIntervalSeconds) return;
    LastAutoPickupScanTime = Now;

    const FHktWorldState& WS = CachedProxySimulator->GetWorldState();
    if (!WS.IsValidEntity(DefaultSubjectEntityId)) return;

    const int32 SubjectX = WS.GetProperty(DefaultSubjectEntityId, PropertyId::PosX);
    const int32 SubjectY = WS.GetProperty(DefaultSubjectEntityId, PropertyId::PosY);

    constexpr int64 RangeSq =
        static_cast<int64>(HktLimits::DefaultPickupRangeCm) *
        static_cast<int64>(HktLimits::DefaultPickupRangeCm);

    WS.ForEachEntity([&](FHktEntityId Id, int32 /*Slot*/)
    {
        if (Id == DefaultSubjectEntityId) return;
        if (WS.GetArchetype(Id) != EHktArchetype::Item) return;
        if (WS.GetProperty(Id, PropertyId::ItemState) != 0) return;

        // 2D 거리 제곱 비교 — sqrt 회피, 정수 연산
        const int32 ItemX = WS.GetProperty(Id, PropertyId::PosX);
        const int32 ItemY = WS.GetProperty(Id, PropertyId::PosY);
        const int64 DX = static_cast<int64>(ItemX) - static_cast<int64>(SubjectX);
        const int64 DY = static_cast<int64>(ItemY) - static_cast<int64>(SubjectY);
        if (DX * DX + DY * DY > RangeSq) return;

        if (const double* LastAttempt = AutoPickupAttemptedAt.Find(Id))
        {
            if (Now - *LastAttempt < AutoPickupRetrySeconds) return;
        }

        AutoPickupAttemptedAt.Add(Id, Now);
        RequestItemPickup(Id);
    });

    // 맵이 임계 초과로 부풀면 cooldown 지난 stale entry 청소 — 사라진 entity 누적 방지.
    if (AutoPickupAttemptedAt.Num() > AutoPickupAttemptedSweepThreshold)
    {
        for (auto It = AutoPickupAttemptedAt.CreateIterator(); It; ++It)
        {
            if (Now - It.Value() < AutoPickupRetrySeconds) continue;
            const FHktEntityId Id = It.Key();
            if (!WS.IsValidEntity(Id) || WS.GetProperty(Id, PropertyId::ItemState) != 0)
            {
                It.RemoveCurrent();
            }
        }
    }
}

void AHktIngamePlayerController::RequestItemPickup(FHktEntityId ItemEntity)
{
    if (DefaultSubjectEntityId == InvalidEntityId || ItemEntity == InvalidEntityId) return;
    if (!HktGameplayTags::Story_Event_Item_Pickup.GetTag().IsValid()) return;

    FHktEvent Event;
    Event.EventTag = HktGameplayTags::Story_Event_Item_Pickup;
    Event.SourceEntity = DefaultSubjectEntityId;
    Event.TargetEntity = ItemEntity;
    Event.PlayerUid = GetPlayerUid();
    Server_ReceiveRuntimeEvent(FHktRuntimeEvent(Event));

    HKT_EVENT_LOG_ENTITY(HktLogTags::Runtime_Intent, EHktLogLevel::Info, EHktLogSource::Client,
        FString::Printf(TEXT("AutoPickup Item=%d (Subject=%d)"), ItemEntity, DefaultSubjectEntityId),
        DefaultSubjectEntityId);
}

// EquipSlot PropertyId는 HktTrait::GetEquipSlotPropertyIds()에서 가져옴

void AHktIngamePlayerController::SyncSlotBindingsFromWorldState(const FHktWorldView& View)
{
    if (!CachedCommandContainer || !View.WorldState) return;
    if (DefaultSubjectEntityId == InvalidEntityId) return;

    const FHktWorldState& WS = *View.WorldState;

    // InitialSync 또는 EquipSlot/ItemSkillTag 프로퍼티 변경 시 동기화
    bool bNeedsSync = View.bIsInitialSync;
    if (!bNeedsSync && View.PropertyDeltas)
    {
        const TArray<uint16>& EquipSlotProps = HktTrait::GetEquipSlotPropertyIds();
        for (const FHktPropertyDelta& D : *View.PropertyDeltas)
        {
            if (EquipSlotProps.Contains(D.PropertyId))
            {
                bNeedsSync = true;
                break;
            }
            if (D.PropertyId == PropertyId::ItemSkillTag || D.PropertyId == PropertyId::ItemState)
            {
                bNeedsSync = true;
                break;
            }
        }
    }
    if (!bNeedsSync) return;

    // 모든 슬롯 클리어
    const int32 NumSlots = FMath::Min(CachedCommandContainer->GetNumSlots(), HktTrait::GetEquipSlotPropertyIds().Num());
    for (int32 i = 0; i < NumSlots; ++i)
    {
        CachedCommandContainer->ClearSlotBinding(i);
    }

    // 캐릭터 엔티티의 EquipSlot0~8에서 아이템 EntityId 읽기 → 스킬 바인딩
    for (int32 i = 0; i < NumSlots; ++i)
    {
        const FHktEntityId ItemId = WS.GetProperty(DefaultSubjectEntityId, HktTrait::GetEquipSlotPropertyIds()[i]);
        if (ItemId == 0 || !WS.IsValidEntity(ItemId))
            continue;

        // ItemSkillTag (NetIndex → FGameplayTag)
        int32 SkillTagNetIndex = WS.GetProperty(ItemId, PropertyId::ItemSkillTag);
        if (SkillTagNetIndex <= 0)
            continue;

        FName TagName = UGameplayTagsManager::Get().GetTagNameFromNetIndex(static_cast<FGameplayTagNetIndex>(SkillTagNetIndex));
        if (TagName.IsNone())
            continue;

        FGameplayTag SkillTag = FGameplayTag::RequestGameplayTag(TagName, false);
        if (!SkillTag.IsValid())
            continue;

        // 아이템의 SkillTargetRequired 프로퍼티로 타겟 필요 여부 결정 (기본값: 필요)
        bool bTargetRequired = WS.GetProperty(ItemId, PropertyId::SkillTargetRequired) != 0;
        CachedCommandContainer->SetSlotBinding(i, SkillTag, bTargetRequired);
        HKT_EVENT_LOG(HktLogTags::Runtime_Client, EHktLogLevel::Info, EHktLogSource::Client, FString::Printf(TEXT("SyncSlotBindings: Slot %d -> %s (Item %d)"),
            i, *SkillTag.ToString(), ItemId));
    }

    // 배치 완료 후 한 번만 broadcast — UI 갱신 트리거
    SlotBindingChangedDelegate.Broadcast(-1);
}

// ============================================================================
// C2S Inventory RPC
// ============================================================================

bool AHktIngamePlayerController::Server_ReceiveInventoryRequest_Validate(const FHktRuntimeInventoryRequest& Request)
{
    return Request.Value.SourceEntity != InvalidEntityId;
}

void AHktIngamePlayerController::Server_ReceiveInventoryRequest_Implementation(const FHktRuntimeInventoryRequest& Request)
{
#if ENABLE_HKT_INSIGHTS
    InsightSentIntentCount++;
#endif

    if (AHktGameMode* GM = GetWorld()->GetAuthGameMode<AHktGameMode>())
    {
        GM->PushInventoryRequest(GetPlayerUid(), Request.Value);
    }
}

// ============================================================================
// 가방 요청 API (UI에서 호출)
// ============================================================================

void AHktIngamePlayerController::RequestInventoryStore(int32 EquipIndex)
{
    if (DefaultSubjectEntityId == InvalidEntityId) return;

    FHktInventoryRequest Req;
    Req.Action = EHktInventoryAction::StoreFromSlot;
    Req.SourceEntity = DefaultSubjectEntityId;
    Req.EquipIndex = EquipIndex;
    Server_ReceiveInventoryRequest(FHktRuntimeInventoryRequest(Req));

    HKT_EVENT_LOG_ENTITY(HktLogTags::Runtime_Intent, EHktLogLevel::Info, EHktLogSource::Client,
        FString::Printf(TEXT("RequestInventoryStore EquipIndex=%d"), EquipIndex), DefaultSubjectEntityId);
}

void AHktIngamePlayerController::RequestInventoryRestore(int32 InventorySlot, int32 EquipIndex)
{
    if (DefaultSubjectEntityId == InvalidEntityId) return;

    FHktInventoryRequest Req;
    Req.Action = EHktInventoryAction::RestoreToSlot;
    Req.SourceEntity = DefaultSubjectEntityId;
    Req.InventorySlot = InventorySlot;
    Req.EquipIndex = EquipIndex;
    Server_ReceiveInventoryRequest(FHktRuntimeInventoryRequest(Req));

    HKT_EVENT_LOG_ENTITY(HktLogTags::Runtime_Intent, EHktLogLevel::Info, EHktLogSource::Client,
        FString::Printf(TEXT("RequestInventoryRestore InventorySlot=%d EquipIndex=%d"), InventorySlot, EquipIndex), DefaultSubjectEntityId);
}

void AHktIngamePlayerController::RequestInventoryDiscard(int32 InventorySlot)
{
    if (DefaultSubjectEntityId == InvalidEntityId) return;

    FHktInventoryRequest Req;
    Req.Action = EHktInventoryAction::Discard;
    Req.SourceEntity = DefaultSubjectEntityId;
    Req.InventorySlot = InventorySlot;
    Server_ReceiveInventoryRequest(FHktRuntimeInventoryRequest(Req));

    HKT_EVENT_LOG_ENTITY(HktLogTags::Runtime_Intent, EHktLogLevel::Info, EHktLogSource::Client,
        FString::Printf(TEXT("RequestInventoryDiscard InventorySlot=%d"), InventorySlot), DefaultSubjectEntityId);
}

const FHktInventoryState* AHktIngamePlayerController::GetInventoryState() const
{
    return CachedInventoryComponent ? &CachedInventoryComponent->GetLocalInventoryState() : nullptr;
}

FOnHktInventoryChanged& AHktIngamePlayerController::OnInventoryChanged()
{
    if (CachedInventoryComponent)
    {
        return CachedInventoryComponent->OnInventoryChanged();
    }
    static FOnHktInventoryChanged Dummy;
    return Dummy;
}

IHktClientRule* AHktIngamePlayerController::GetClientRule() const
{
    return CachedClientRule;
}

// ============================================================================
// IHktPlayerInteractionInterface 구현
// ============================================================================

void AHktIngamePlayerController::ExecuteCommand(UObject* CommandData)
{
}

bool AHktIngamePlayerController::GetWorldState(const FHktWorldState*& OutState) const
{
    if (CachedProxySimulator && CachedProxySimulator->IsInitialized())
    {
        OutState = &CachedProxySimulator->GetWorldState();
        return true;
    }
    OutState = nullptr;
    return false;
}

int64 AHktIngamePlayerController::GetPlayerUid() const
{
    return CachedWorldPlayer ? CachedWorldPlayer->GetPlayerUid() : 0;
}
