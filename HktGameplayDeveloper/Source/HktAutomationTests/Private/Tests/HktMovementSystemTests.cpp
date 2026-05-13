// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktAutomationTestsTypes.h"
#include "HktAutomationTestsHarness.h"
#include "HktSimulationSystems.h"
#include "HktCoreProperties.h"
#include "VM/HktVMWorldStateProxy.h"
#include "Misc/AutomationTest.h"

// ============================================================================
// MovementSystem V1↔V2 검증 테스트
//
// V2 (active-mover 슬롯만 순회) 가 V1 (전체 순회) 과 동일한 결과를 내는지,
// 그리고 ActiveMoverSlots invariant (mask=1 ⇔ list 에 정확히 1회) 가 모든
// prune/mark 경로에서 깨지지 않는지 검증한다.
// ============================================================================

namespace HktMovementSystemTests
{

// ============================================================================
// 헬퍼
// ============================================================================

/** Mover 엔티티 생성 — Pos / Target / 운동 파라미터 일괄 설정. */
static FHktEntityId CreateMover(
    FHktAutomationTestHarness& H,
    int32 PX, int32 PY, int32 PZ,
    int32 TX, int32 TY, int32 TZ,
    int32 Force = 10000,
    int32 MaxSpd = 600,
    int32 Mass = 100,
    int32 IsGrounded = 1,
    int32 IsMoving = 1)
{
    TMap<uint16, int32> Props;
    Props.Add(PropertyId::PosX, PX);
    Props.Add(PropertyId::PosY, PY);
    Props.Add(PropertyId::PosZ, PZ);
    Props.Add(PropertyId::MoveTargetX, TX);
    Props.Add(PropertyId::MoveTargetY, TY);
    Props.Add(PropertyId::MoveTargetZ, TZ);
    Props.Add(PropertyId::MoveForce, Force);
    Props.Add(PropertyId::Mass, Mass);
    Props.Add(PropertyId::MaxSpeed, MaxSpd);
    Props.Add(PropertyId::IsGrounded, IsGrounded);
    Props.Add(PropertyId::IsMoving, IsMoving);
    return H.CreateEntityWithProperties(Props);
}

/** 정지 (Idle) 엔티티 생성 — 모든 운동 프로퍼티 0, 접지 상태. */
static FHktEntityId CreateIdle(FHktAutomationTestHarness& H, int32 PX, int32 PY, int32 PZ)
{
    TMap<uint16, int32> Props;
    Props.Add(PropertyId::PosX, PX);
    Props.Add(PropertyId::PosY, PY);
    Props.Add(PropertyId::PosZ, PZ);
    Props.Add(PropertyId::Mass, 100);
    Props.Add(PropertyId::IsGrounded, 1);
    return H.CreateEntityWithProperties(Props);
}

/** V1↔V2 비교 대상 프로퍼티 셋. 위치/속도/이동 상태만 비교 (Movement 직접 출력값). */
static const uint16 ComparedProperties[] = {
    PropertyId::PosX, PropertyId::PosY, PropertyId::PosZ,
    PropertyId::VelX, PropertyId::VelY, PropertyId::VelZ,
    PropertyId::IsMoving, PropertyId::RotYaw,
};

/** 두 WorldState 의 엔티티 프로퍼티가 모두 일치하는지 검증. */
static bool CompareWorldStates(
    const FHktWorldState& A,
    const FHktWorldState& B,
    FString& OutMismatch)
{
    if (A.SlotToEntity.Num() != B.SlotToEntity.Num())
    {
        OutMismatch = FString::Printf(TEXT("SlotToEntity.Num mismatch: A=%d B=%d"),
            A.SlotToEntity.Num(), B.SlotToEntity.Num());
        return false;
    }

    for (int32 Slot = 0; Slot < A.SlotToEntity.Num(); ++Slot)
    {
        const FHktEntityId IdA = A.SlotToEntity[Slot];
        const FHktEntityId IdB = B.SlotToEntity[Slot];
        if (IdA != IdB)
        {
            OutMismatch = FString::Printf(TEXT("Slot %d entity mismatch: A=%d B=%d"),
                Slot, IdA, IdB);
            return false;
        }
        if (IdA == InvalidEntityId) continue;

        for (uint16 PropId : ComparedProperties)
        {
            const int32 VA = A.Get(Slot, PropId);
            const int32 VB = B.Get(Slot, PropId);
            if (VA != VB)
            {
                const TCHAR* PropName = HktProperty::GetPropertyName(PropId);
                OutMismatch = FString::Printf(
                    TEXT("Slot %d (Id %d) prop %s(%d) mismatch: V1=%d V2=%d"),
                    Slot, IdA, PropName ? PropName : TEXT("?"), PropId, VA, VB);
                return false;
            }
        }
    }
    return true;
}

/** Movement 시스템 직접 호출 — Pre/MoveEnd 버퍼는 호출 사이트가 소유. */
static void RunMovementV1(
    FHktAutomationTestHarness& H,
    TArray<FIntVector>& OutPre,
    TArray<FHktPendingEvent>& OutMoveEnd)
{
    FHktMovementSystem Sys;
    Sys.LogSource = EHktLogSource::Server;
    Sys.Process(H.GetWorldState(), H.GetVMProxy(), OutMoveEnd, OutPre);
}

static void RunMovementV2(
    FHktAutomationTestHarness& H,
    TArray<FIntVector>& OutPre,
    TArray<FHktPendingEvent>& OutMoveEnd)
{
    FHktMovementSystemV2 Sys;
    Sys.LogSource = EHktLogSource::Server;
    Sys.Process(H.GetWorldState(), H.GetVMProxy(), OutMoveEnd, OutPre);
}

/** V2 에 운동 슬롯을 등록해 두는 헬퍼 — 실제 게임에선 SetPropertyDirty hook 이 처리하지만,
 *  하니스는 WorldState.SetProperty 로 초기 세팅을 하므로 mark 가 누락된다. */
static void MarkAllAsActive(FHktAutomationTestHarness& H)
{
    const FHktWorldState& WS = H.GetWorldState();
    for (int32 Slot = 0; Slot < WS.SlotToEntity.Num(); ++Slot)
    {
        if (WS.SlotToEntity[Slot] != InvalidEntityId)
            H.GetVMProxy().MarkActiveMover(Slot);
    }
}

// ============================================================================
// Tests
// ============================================================================

/** T1: 단일 이동 엔티티에 대해 V1/V2 가 N 틱 동안 동일 결과를 낸다. */
static FHktTestResult Test_Parity_SingleMover()
{
    FHktAutomationTestHarness HA, HB;
    HA.Setup(); HB.Setup();

    CreateMover(HA, /*Pos*/0, 0, 0, /*Tgt*/1000, 0, 0);
    CreateMover(HB, 0, 0, 0, 1000, 0, 0);

    MarkAllAsActive(HA);
    MarkAllAsActive(HB);

    constexpr int32 NumTicks = 30;
    TArray<FIntVector> PreA, PreB;
    TArray<FHktPendingEvent> EvA, EvB;

    for (int32 T = 0; T < NumTicks; ++T)
    {
        RunMovementV1(HA, PreA, EvA);
        RunMovementV2(HB, PreB, EvB);

        FString Mismatch;
        if (!CompareWorldStates(HA.GetWorldState(), HB.GetWorldState(), Mismatch))
        {
            HA.Teardown(); HB.Teardown();
            return FHktTestResult::Fail(TEXT("Parity_SingleMover"),
                FString::Printf(TEXT("Tick %d: %s"), T, *Mismatch));
        }
        if (EvA.Num() != EvB.Num())
        {
            HA.Teardown(); HB.Teardown();
            return FHktTestResult::Fail(TEXT("Parity_SingleMover"),
                FString::Printf(TEXT("Tick %d: MoveEnd event count mismatch V1=%d V2=%d"),
                    T, EvA.Num(), EvB.Num()));
        }
    }

    HA.Teardown(); HB.Teardown();
    return FHktTestResult::Pass(TEXT("Parity_SingleMover"));
}

/** T2: 혼합(이동/정지) 다수 엔티티에 대해 V1/V2 동일 결과. PreMovePositions 도 일치. */
static FHktTestResult Test_Parity_MixedMoversAndIdles()
{
    FHktAutomationTestHarness HA, HB;
    HA.Setup(); HB.Setup();

    // Moving entities
    CreateMover(HA, 0, 0, 0, 500, 500, 0);
    CreateMover(HB, 0, 0, 0, 500, 500, 0);
    CreateMover(HA, -200, 100, 0, 200, 100, 0);
    CreateMover(HB, -200, 100, 0, 200, 100, 0);
    // Idle entities (PreMovePositions 가 현재 Pos 로 채워져야 함)
    CreateIdle(HA, 1000, 1000, 0);
    CreateIdle(HB, 1000, 1000, 0);
    CreateIdle(HA, -500, 0, 50);
    CreateIdle(HB, -500, 0, 50);
    CreateIdle(HA, 0, -300, 0);
    CreateIdle(HB, 0, -300, 0);

    MarkAllAsActive(HA);
    MarkAllAsActive(HB);

    constexpr int32 NumTicks = 20;
    TArray<FIntVector> PreA, PreB;
    TArray<FHktPendingEvent> EvA, EvB;

    for (int32 T = 0; T < NumTicks; ++T)
    {
        RunMovementV1(HA, PreA, EvA);
        RunMovementV2(HB, PreB, EvB);

        // PreMovePositions: V1 은 모든 슬롯, V2 도 모든 슬롯(prefill) 채운다 — 동일.
        if (PreA.Num() != PreB.Num())
        {
            HA.Teardown(); HB.Teardown();
            return FHktTestResult::Fail(TEXT("Parity_MixedMoversAndIdles"),
                FString::Printf(TEXT("Tick %d: PreMove array size mismatch V1=%d V2=%d"),
                    T, PreA.Num(), PreB.Num()));
        }
        for (int32 Slot = 0; Slot < PreA.Num(); ++Slot)
        {
            if (HA.GetWorldState().SlotToEntity[Slot] == InvalidEntityId) continue;
            if (PreA[Slot] != PreB[Slot])
            {
                HA.Teardown(); HB.Teardown();
                return FHktTestResult::Fail(TEXT("Parity_MixedMoversAndIdles"),
                    FString::Printf(TEXT("Tick %d Slot %d PreMove mismatch V1=(%d,%d,%d) V2=(%d,%d,%d)"),
                        T, Slot, PreA[Slot].X, PreA[Slot].Y, PreA[Slot].Z,
                        PreB[Slot].X, PreB[Slot].Y, PreB[Slot].Z));
            }
        }

        FString Mismatch;
        if (!CompareWorldStates(HA.GetWorldState(), HB.GetWorldState(), Mismatch))
        {
            HA.Teardown(); HB.Teardown();
            return FHktTestResult::Fail(TEXT("Parity_MixedMoversAndIdles"),
                FString::Printf(TEXT("Tick %d: %s"), T, *Mismatch));
        }
    }

    HA.Teardown(); HB.Teardown();
    return FHktTestResult::Pass(TEXT("Parity_MixedMoversAndIdles"));
}

/** T3: 도착 시 V1/V2 모두 동일한 MoveEnd 이벤트를 emit. */
static FHktTestResult Test_Parity_ArrivalEvent()
{
    FHktAutomationTestHarness HA, HB;
    HA.Setup(); HB.Setup();

    // 도착 임계(ArrivalThresholdSq=16) 안쪽에서 시작 — 첫 틱에 도착.
    CreateMover(HA, 0, 0, 0, 2, 2, 0);
    CreateMover(HB, 0, 0, 0, 2, 2, 0);

    MarkAllAsActive(HA);
    MarkAllAsActive(HB);

    TArray<FIntVector> PreA, PreB;
    TArray<FHktPendingEvent> EvA, EvB;

    RunMovementV1(HA, PreA, EvA);
    RunMovementV2(HB, PreB, EvB);

    if (EvA.Num() != 1 || EvB.Num() != 1)
    {
        HA.Teardown(); HB.Teardown();
        return FHktTestResult::Fail(TEXT("Parity_ArrivalEvent"),
            FString::Printf(TEXT("Expected exactly 1 MoveEnd per system. V1=%d V2=%d"),
                EvA.Num(), EvB.Num()));
    }
    if (EvA[0].Type != EWaitEventType::MoveEnd || EvB[0].Type != EWaitEventType::MoveEnd)
    {
        HA.Teardown(); HB.Teardown();
        return FHktTestResult::Fail(TEXT("Parity_ArrivalEvent"),
            TEXT("Event type should be MoveEnd"));
    }
    if (EvA[0].WatchedEntity != EvB[0].WatchedEntity)
    {
        HA.Teardown(); HB.Teardown();
        return FHktTestResult::Fail(TEXT("Parity_ArrivalEvent"),
            FString::Printf(TEXT("WatchedEntity mismatch V1=%d V2=%d"),
                EvA[0].WatchedEntity, EvB[0].WatchedEntity));
    }

    FString Mismatch;
    if (!CompareWorldStates(HA.GetWorldState(), HB.GetWorldState(), Mismatch))
    {
        HA.Teardown(); HB.Teardown();
        return FHktTestResult::Fail(TEXT("Parity_ArrivalEvent"), Mismatch);
    }

    HA.Teardown(); HB.Teardown();
    return FHktTestResult::Pass(TEXT("Parity_ArrivalEvent"));
}

/** T4: idle 슬롯은 V2 한 번 방문 후 ActiveMoverSlots 에서 제거된다. */
static FHktTestResult Test_V2_PrunesIdleSlot()
{
    FHktAutomationTestHarness H;
    H.Setup();

    const FHktEntityId Id = CreateIdle(H, 100, 200, 0);
    const int32 Slot = H.GetWorldState().GetSlot(Id);
    H.GetVMProxy().MarkActiveMover(Slot);

    if (H.GetVMProxy().ActiveMoverSlots.Num() != 1)
    {
        H.Teardown();
        return FHktTestResult::Fail(TEXT("V2_PrunesIdleSlot"),
            FString::Printf(TEXT("Setup: expected 1 active slot, got %d"),
                H.GetVMProxy().ActiveMoverSlots.Num()));
    }

    TArray<FIntVector> Pre; TArray<FHktPendingEvent> Ev;
    RunMovementV2(H, Pre, Ev);

    const int32 PostCount = H.GetVMProxy().ActiveMoverSlots.Num();
    const uint8 PostMask = H.GetVMProxy().ActiveMoverMask.IsValidIndex(Slot)
        ? H.GetVMProxy().ActiveMoverMask[Slot] : 0;
    H.Teardown();

    if (PostCount != 0)
        return FHktTestResult::Fail(TEXT("V2_PrunesIdleSlot"),
            FString::Printf(TEXT("After V2: expected 0 active slots, got %d"), PostCount));
    if (PostMask != 0)
        return FHktTestResult::Fail(TEXT("V2_PrunesIdleSlot"),
            FString::Printf(TEXT("After V2: mask should be 0, got %u"), PostMask));

    return FHktTestResult::Pass(TEXT("V2_PrunesIdleSlot"));
}

/** T5: 이동 중 엔티티는 V2 후에도 active 로 남아 있다. */
static FHktTestResult Test_V2_KeepsMovingSlotActive()
{
    FHktAutomationTestHarness H;
    H.Setup();

    const FHktEntityId Id = CreateMover(H, 0, 0, 0, 1000, 0, 0);
    const int32 Slot = H.GetWorldState().GetSlot(Id);
    H.GetVMProxy().MarkActiveMover(Slot);

    TArray<FIntVector> Pre; TArray<FHktPendingEvent> Ev;
    RunMovementV2(H, Pre, Ev);

    const int32 PostCount = H.GetVMProxy().ActiveMoverSlots.Num();
    const uint8 PostMask = H.GetVMProxy().ActiveMoverMask[Slot];
    H.Teardown();

    if (PostCount != 1)
        return FHktTestResult::Fail(TEXT("V2_KeepsMovingSlotActive"),
            FString::Printf(TEXT("Expected 1 active slot, got %d"), PostCount));
    if (PostMask != 1)
        return FHktTestResult::Fail(TEXT("V2_KeepsMovingSlotActive"),
            FString::Printf(TEXT("Expected mask=1, got %u"), PostMask));

    return FHktTestResult::Pass(TEXT("V2_KeepsMovingSlotActive"));
}

/** T6: V2 가 idle 슬롯을 prune 한 직후 같은 슬롯에 mark 가 다시 들어와도 list 에
 *      중복으로 쌓이지 않는다 (invariant 검증 — 이전 결함의 회귀 방지). */
static FHktTestResult Test_V2_NoDuplicateAfterPruneRemark()
{
    FHktAutomationTestHarness H;
    H.Setup();

    const FHktEntityId Id = CreateIdle(H, 0, 0, 0);
    const int32 Slot = H.GetWorldState().GetSlot(Id);
    H.GetVMProxy().MarkActiveMover(Slot);

    // V2 가 idle 판정 → swap-pop. list 비고 mask=0.
    TArray<FIntVector> Pre; TArray<FHktPendingEvent> Ev;
    RunMovementV2(H, Pre, Ev);

    if (H.GetVMProxy().ActiveMoverSlots.Num() != 0)
    {
        H.Teardown();
        return FHktTestResult::Fail(TEXT("V2_NoDuplicateAfterPruneRemark"),
            TEXT("Step1: idle 슬롯이 prune 되지 않았다"));
    }

    // SetPropertyDirty hook 으로 재-mark 발생 시뮬레이션 (Physics 의 IsGrounded write 등).
    H.GetVMProxy().SetPropertyDirty(H.GetWorldState(), Id, PropertyId::VelZ, -100);

    const int32 AfterRemark = H.GetVMProxy().ActiveMoverSlots.Num();
    const uint8 AfterMask = H.GetVMProxy().ActiveMoverMask[Slot];
    H.Teardown();

    if (AfterRemark != 1)
        return FHktTestResult::Fail(TEXT("V2_NoDuplicateAfterPruneRemark"),
            FString::Printf(TEXT("Re-mark 후 list 크기 1 기대, 실제 %d (중복 회귀)"), AfterRemark));
    if (AfterMask != 1)
        return FHktTestResult::Fail(TEXT("V2_NoDuplicateAfterPruneRemark"),
            FString::Printf(TEXT("Re-mark 후 mask=1 기대, 실제 %u"), AfterMask));

    return FHktTestResult::Pass(TEXT("V2_NoDuplicateAfterPruneRemark"));
}

/** T7: 같은 슬롯에 운동 프로퍼티를 여러 번 써도 list 가 1회만 Add 된다 (mask 가드). */
static FHktTestResult Test_V2_NoDuplicateOnMultipleMarks()
{
    FHktAutomationTestHarness H;
    H.Setup();

    const FHktEntityId Id = CreateIdle(H, 0, 0, 0);

    // MoveToward 가 5 회 SetPropertyDirty 하는 경로를 모사.
    H.GetVMProxy().SetPropertyDirty(H.GetWorldState(), Id, PropertyId::MoveTargetX, 1000);
    H.GetVMProxy().SetPropertyDirty(H.GetWorldState(), Id, PropertyId::MoveTargetY, 0);
    H.GetVMProxy().SetPropertyDirty(H.GetWorldState(), Id, PropertyId::MoveTargetZ, 0);
    H.GetVMProxy().SetPropertyDirty(H.GetWorldState(), Id, PropertyId::MoveForce, 10000);
    H.GetVMProxy().SetPropertyDirty(H.GetWorldState(), Id, PropertyId::IsMoving, 1);

    // 추가로 다른 hooked 프로퍼티도 — 여전히 중복 Add 금지.
    H.GetVMProxy().SetPropertyDirty(H.GetWorldState(), Id, PropertyId::VelX, 0);
    H.GetVMProxy().SetPropertyDirty(H.GetWorldState(), Id, PropertyId::VelY, 0);

    const int32 Count = H.GetVMProxy().ActiveMoverSlots.Num();
    H.Teardown();

    // MoveTarget* 는 hook 대상이 아니지만 MoveForce/IsMoving/VelX/VelY 는 hook → 한 번만 Add.
    if (Count != 1)
        return FHktTestResult::Fail(TEXT("V2_NoDuplicateOnMultipleMarks"),
            FString::Printf(TEXT("ActiveMoverSlots 크기 1 기대, 실제 %d"), Count));

    return FHktTestResult::Pass(TEXT("V2_NoDuplicateOnMultipleMarks"));
}

/** T8: PreMovePositions 가 모든 유효 슬롯에 대해 현재 Pos 로 채워진다 (Physics 전제). */
static FHktTestResult Test_V2_PreMovePositionsFilled()
{
    FHktAutomationTestHarness H;
    H.Setup();

    const FHktEntityId Moving = CreateMover(H, 100, 200, 50, 1000, 0, 0);
    const FHktEntityId Idle = CreateIdle(H, 300, 400, 25);

    MarkAllAsActive(H);

    TArray<FIntVector> Pre; TArray<FHktPendingEvent> Ev;
    RunMovementV2(H, Pre, Ev);

    const int32 SlotMoving = H.GetWorldState().GetSlot(Moving);
    const int32 SlotIdle = H.GetWorldState().GetSlot(Idle);

    // Idle 슬롯: prefill 로 현재 Pos 가 그대로.
    const FIntVector ExpIdle(300, 400, 25);
    if (!Pre.IsValidIndex(SlotIdle) || Pre[SlotIdle] != ExpIdle)
    {
        const FIntVector Got = Pre.IsValidIndex(SlotIdle) ? Pre[SlotIdle] : FIntVector::ZeroValue;
        H.Teardown();
        return FHktTestResult::Fail(TEXT("V2_PreMovePositionsFilled"),
            FString::Printf(TEXT("Idle slot %d PreMove (%d,%d,%d) 기대, 실제 (%d,%d,%d)"),
                SlotIdle, ExpIdle.X, ExpIdle.Y, ExpIdle.Z, Got.X, Got.Y, Got.Z));
    }

    // Moving 슬롯: 적분 전 위치(=처음 입력 Pos)가 저장돼야 한다.
    const FIntVector ExpMov(100, 200, 50);
    if (!Pre.IsValidIndex(SlotMoving) || Pre[SlotMoving] != ExpMov)
    {
        const FIntVector Got = Pre.IsValidIndex(SlotMoving) ? Pre[SlotMoving] : FIntVector::ZeroValue;
        H.Teardown();
        return FHktTestResult::Fail(TEXT("V2_PreMovePositionsFilled"),
            FString::Printf(TEXT("Moving slot %d PreMove (%d,%d,%d) 기대, 실제 (%d,%d,%d)"),
                SlotMoving, ExpMov.X, ExpMov.Y, ExpMov.Z, Got.X, Got.Y, Got.Z));
    }

    H.Teardown();
    return FHktTestResult::Pass(TEXT("V2_PreMovePositionsFilled"));
}

/** T9: 엔티티 없는 빈 월드에서 V2 가 안전하게 no-op 된다. */
static FHktTestResult Test_V2_EmptyWorld()
{
    FHktAutomationTestHarness H;
    H.Setup();

    TArray<FIntVector> Pre; TArray<FHktPendingEvent> Ev;
    RunMovementV2(H, Pre, Ev);

    const int32 Active = H.GetVMProxy().ActiveMoverSlots.Num();
    const int32 EvCount = Ev.Num();
    H.Teardown();

    if (Active != 0 || EvCount != 0)
        return FHktTestResult::Fail(TEXT("V2_EmptyWorld"),
            FString::Printf(TEXT("빈 월드: active=%d events=%d 기대 0/0"), Active, EvCount));

    return FHktTestResult::Pass(TEXT("V2_EmptyWorld"));
}

/** T10: SlotToEntity 가 InvalidEntityId 인 슬롯(엔티티 제거 후)을 만나면 V2 가 list 에서 정리. */
static FHktTestResult Test_V2_StaleSlotCleanup()
{
    FHktAutomationTestHarness H;
    H.Setup();

    const FHktEntityId Id = CreateMover(H, 0, 0, 0, 1000, 0, 0);
    const int32 Slot = H.GetWorldState().GetSlot(Id);
    H.GetVMProxy().MarkActiveMover(Slot);

    // 엔티티 제거 — 슬롯은 Free 풀로 가지만 ActiveMoverMask/Slots 는 직접 갱신되지 않음.
    H.GetWorldState().RemoveEntity(Id);

    // V2 는 stale-Entity 분기에서 mask=0 + RemoveAtSwap 수행해야 한다.
    TArray<FIntVector> Pre; TArray<FHktPendingEvent> Ev;
    RunMovementV2(H, Pre, Ev);

    const int32 PostCount = H.GetVMProxy().ActiveMoverSlots.Num();
    const uint8 PostMask = H.GetVMProxy().ActiveMoverMask.IsValidIndex(Slot)
        ? H.GetVMProxy().ActiveMoverMask[Slot] : 0;
    H.Teardown();

    if (PostCount != 0)
        return FHktTestResult::Fail(TEXT("V2_StaleSlotCleanup"),
            FString::Printf(TEXT("stale slot 정리 후 list 0 기대, 실제 %d"), PostCount));
    if (PostMask != 0)
        return FHktTestResult::Fail(TEXT("V2_StaleSlotCleanup"),
            FString::Printf(TEXT("stale slot 정리 후 mask=0 기대, 실제 %u"), PostMask));

    return FHktTestResult::Pass(TEXT("V2_StaleSlotCleanup"));
}

/** T11: RebuildActiveMovers 가 WorldState 의 실제 운동 상태를 정확히 재구성. */
static FHktTestResult Test_V2_RebuildActiveMovers()
{
    FHktAutomationTestHarness H;
    H.Setup();

    const FHktEntityId Mover = CreateMover(H, 0, 0, 0, 1000, 0, 0);

    TMap<uint16, int32> FallingProps;
    FallingProps.Add(PropertyId::IsGrounded, 0);  // 공중 — Gravity 대상
    FallingProps.Add(PropertyId::VelZ, -50);
    const FHktEntityId Falling = H.CreateEntityWithProperties(FallingProps);

    const FHktEntityId IdleE = CreateIdle(H, 0, 0, 0);

    // 일단 list 를 의도적으로 더럽힌 뒤 Rebuild — 깨끗하게 재구성되는지 본다.
    H.GetVMProxy().MarkActiveMover(0);  // bogus
    H.GetVMProxy().MarkActiveMover(99); // bogus out-of-entity

    H.GetVMProxy().RebuildActiveMovers(H.GetWorldState());

    auto IsActive = [&](FHktEntityId Id) -> bool
    {
        const int32 Slot = H.GetWorldState().GetSlot(Id);
        return H.GetVMProxy().ActiveMoverMask.IsValidIndex(Slot)
            && H.GetVMProxy().ActiveMoverMask[Slot] != 0;
    };

    const bool bMoverActive   = IsActive(Mover);
    const bool bFallingActive = IsActive(Falling);
    const bool bIdleActive    = IsActive(IdleE);
    H.Teardown();

    if (!bMoverActive)
        return FHktTestResult::Fail(TEXT("V2_RebuildActiveMovers"),
            TEXT("IsMoving=1 엔티티가 rebuild 후 inactive"));
    if (!bFallingActive)
        return FHktTestResult::Fail(TEXT("V2_RebuildActiveMovers"),
            TEXT("IsGrounded=0 + VelZ!=0 엔티티가 rebuild 후 inactive"));
    if (bIdleActive)
        return FHktTestResult::Fail(TEXT("V2_RebuildActiveMovers"),
            TEXT("Idle 엔티티가 rebuild 후 active 로 잘못 표시"));

    return FHktTestResult::Pass(TEXT("V2_RebuildActiveMovers"));
}

// ============================================================================
// Runner aggregation
// ============================================================================

FHktTestReport RunAllMovementSystemTests()
{
    FHktTestReport Report;
    Report.Add(Test_Parity_SingleMover());
    Report.Add(Test_Parity_MixedMoversAndIdles());
    Report.Add(Test_Parity_ArrivalEvent());
    Report.Add(Test_V2_PrunesIdleSlot());
    Report.Add(Test_V2_KeepsMovingSlotActive());
    Report.Add(Test_V2_NoDuplicateAfterPruneRemark());
    Report.Add(Test_V2_NoDuplicateOnMultipleMarks());
    Report.Add(Test_V2_PreMovePositionsFilled());
    Report.Add(Test_V2_EmptyWorld());
    Report.Add(Test_V2_StaleSlotCleanup());
    Report.Add(Test_V2_RebuildActiveMovers());
    return Report;
}

} // namespace HktMovementSystemTests

// ============================================================================
// UE Automation Test 노출 — Session Frontend "Hkt.Movement.V2.*" 트리에 표시
// ============================================================================

#if WITH_AUTOMATION_TESTS

namespace
{
    bool ReportToAutomation(FAutomationTestBase& Test, const FHktTestResult& R)
    {
        if (!R.bPassed)
        {
            Test.AddError(R.Message.IsEmpty()
                ? FString::Printf(TEXT("%s: failed"), *R.TestName)
                : FString::Printf(TEXT("%s: %s"), *R.TestName, *R.Message));
        }
        return R.bPassed;
    }
}

#define HKT_DEFINE_MOVEMENT_TEST(TestClass, PrettyName, TestFunc) \
    IMPLEMENT_SIMPLE_AUTOMATION_TEST(TestClass, PrettyName, \
        EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter) \
    bool TestClass::RunTest(const FString& /*Parameters*/) \
    { \
        return ReportToAutomation(*this, HktMovementSystemTests::TestFunc()); \
    }

HKT_DEFINE_MOVEMENT_TEST(FHktMovementV2_Parity_SingleMoverTest,
    "HktCore.Movement.V2.Parity.SingleMover", Test_Parity_SingleMover)
HKT_DEFINE_MOVEMENT_TEST(FHktMovementV2_Parity_MixedTest,
    "HktCore.Movement.V2.Parity.MixedMoversAndIdles", Test_Parity_MixedMoversAndIdles)
HKT_DEFINE_MOVEMENT_TEST(FHktMovementV2_Parity_ArrivalEventTest,
    "HktCore.Movement.V2.Parity.ArrivalEvent", Test_Parity_ArrivalEvent)
HKT_DEFINE_MOVEMENT_TEST(FHktMovementV2_PrunesIdleSlotTest,
    "HktCore.Movement.V2.Invariant.PrunesIdleSlot", Test_V2_PrunesIdleSlot)
HKT_DEFINE_MOVEMENT_TEST(FHktMovementV2_KeepsMovingSlotActiveTest,
    "HktCore.Movement.V2.Invariant.KeepsMovingSlotActive", Test_V2_KeepsMovingSlotActive)
HKT_DEFINE_MOVEMENT_TEST(FHktMovementV2_NoDuplicateAfterPruneRemarkTest,
    "HktCore.Movement.V2.Invariant.NoDuplicateAfterPruneRemark", Test_V2_NoDuplicateAfterPruneRemark)
HKT_DEFINE_MOVEMENT_TEST(FHktMovementV2_NoDuplicateOnMultipleMarksTest,
    "HktCore.Movement.V2.Invariant.NoDuplicateOnMultipleMarks", Test_V2_NoDuplicateOnMultipleMarks)
HKT_DEFINE_MOVEMENT_TEST(FHktMovementV2_PreMovePositionsFilledTest,
    "HktCore.Movement.V2.Invariant.PreMovePositionsFilled", Test_V2_PreMovePositionsFilled)
HKT_DEFINE_MOVEMENT_TEST(FHktMovementV2_EmptyWorldTest,
    "HktCore.Movement.V2.Invariant.EmptyWorld", Test_V2_EmptyWorld)
HKT_DEFINE_MOVEMENT_TEST(FHktMovementV2_StaleSlotCleanupTest,
    "HktCore.Movement.V2.Invariant.StaleSlotCleanup", Test_V2_StaleSlotCleanup)
HKT_DEFINE_MOVEMENT_TEST(FHktMovementV2_RebuildActiveMoversTest,
    "HktCore.Movement.V2.Invariant.RebuildActiveMovers", Test_V2_RebuildActiveMovers)

#undef HKT_DEFINE_MOVEMENT_TEST

#endif // WITH_AUTOMATION_TESTS
