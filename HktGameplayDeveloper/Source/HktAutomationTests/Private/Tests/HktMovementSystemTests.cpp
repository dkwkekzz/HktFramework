// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktAutomationTestsTypes.h"
#include "HktAutomationTestsHarness.h"
#include "HktSimulationSystems.h"
#include "HktCoreProperties.h"
#include "HktCoreSimulator.h"
#include "HktStoryBuilder.h"
#include "VM/HktVMWorldStateProxy.h"
#include "VM/HktVMProgram.h"
#include "Misc/AutomationTest.h"

// ============================================================================
// MovementSystem 단독 검증 테스트
//
// V1↔V2 매칭 검증은 마이그레이션 완료로 제거되었다. 본 파일은 단일화된
// MovementSystem 이 다음 동작을 정확히 수행하는지 자체 검증한다:
//   - 도착 / 오버슈트 스냅 + MoveEnd emit
//   - RotYaw 갱신, MaxSpeed 상한
//   - 비활성 슬롯 PreMovePositions prefill (Physics 불변식)
//   - ActiveMoverSlots/Mask invariant (mark·prune 양쪽 swap-pop)
//   - VM 경로(MoveToward) 가 active mover 마크
//   - 시뮬레이터 풀 파이프라인을 통한 도착 sanity
// ============================================================================

namespace HktMovementSystemTests
{

// ============================================================================
// 테스트 fixture 상수
// ============================================================================

namespace TestConst
{
    /** 적분이 끝날 때까지 충분히 긴 도달 시뮬레이션 길이 (틱). */
    constexpr int32 MaxArrivalTicks = 60;

    /** Mover 기본 파라미터 — 운동 파이프라인이 trivially 0/1 로 자명해지지 않을
     *  "보통의" 값. */
    constexpr int32 DefaultForce    = 10000;
    constexpr int32 DefaultMass     = 100;
    constexpr int32 DefaultMaxSpeed = 600;

    /** 도착 판정 임계 안쪽 좌표 오프셋 (cm). production 의 ArrivalThresholdSq 에서 파생.
     *  2 * Offset² < ArrivalThresholdSq 이면 첫 틱에 도착이 보장된다. */
    constexpr int32 ArrivalInsideOffset = 1;
    static_assert(2 * ArrivalInsideOffset * ArrivalInsideOffset
                  < static_cast<int32>(FHktMovementSystem::ArrivalThresholdSq),
        "Offset must keep target inside arrival threshold");

    /** 적분이 시작되어도 도착 임계까지 한참 남는 일반 target 거리 (cm). */
    constexpr int32 FarTargetCm = 1000;

    /** Bogus / out-of-range 슬롯 인덱스 — Rebuild 가 정리하는지 확인용. */
    constexpr int32 BogusSlotIndex = 99;
}

// ============================================================================
// 헬퍼
// ============================================================================

/** Mover 엔티티 생성 — Pos / Target / 운동 파라미터 일괄 설정. */
static FHktEntityId CreateMover(
    FHktAutomationTestHarness& H,
    int32 PX, int32 PY, int32 PZ,
    int32 TX, int32 TY, int32 TZ,
    int32 Force = TestConst::DefaultForce,
    int32 MaxSpd = TestConst::DefaultMaxSpeed,
    int32 Mass = TestConst::DefaultMass,
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
    Props.Add(PropertyId::Mass, TestConst::DefaultMass);
    Props.Add(PropertyId::IsGrounded, 1);
    return H.CreateEntityWithProperties(Props);
}

/** 하니스가 직접 SetProperty 로 초기화한 슬롯은 ActiveMoverMark 가 누락되므로
 *  테스트 시작 시 명시적으로 등록한다 (실제 게임에선 SetPropertyDirty hook 이 처리). */
static void MarkAllAsActive(FHktAutomationTestHarness& H)
{
    const FHktWorldState& WS = H.GetWorldState();
    for (int32 Slot = 0; Slot < WS.SlotToEntity.Num(); ++Slot)
    {
        if (WS.SlotToEntity[Slot] != InvalidEntityId)
            H.GetVMProxy().MarkActiveMover(Slot);
    }
}

/** Movement 시스템 단발 호출 — Pre/MoveEnd 버퍼는 호출 사이트가 소유. */
static void RunMovement(
    FHktAutomationTestHarness& H,
    TArray<FIntVector>& OutPre,
    TArray<FHktPendingEvent>& OutMoveEnd)
{
    FHktMovementSystem Sys;
    Sys.LogSource = EHktLogSource::Server;
    Sys.Process(H.GetWorldState(), H.GetVMProxy(), OutMoveEnd, OutPre);
}

// ============================================================================
// Tests
// ============================================================================

/** T1: 도착 임계 안쪽에서 시작 — 첫 틱에 타겟 스냅, MoveEnd 1회 emit. */
static FHktTestResult Test_ArrivalSnapsToTarget()
{
    FHktAutomationTestHarness H;
    H.Setup();

    // TestConst::ArrivalInsideOffset 가 static_assert 로 임계 안쪽임을 보장.
    const int32 Off = TestConst::ArrivalInsideOffset;
    const FHktEntityId Id = CreateMover(H, 0, 0, 0, Off, Off, 0);
    MarkAllAsActive(H);

    TArray<FIntVector> Pre; TArray<FHktPendingEvent> Ev;
    RunMovement(H, Pre, Ev);

    const int32 EvCount = Ev.Num();
    const int32 IsMoving = H.GetProperty(Id, PropertyId::IsMoving);
    const int32 PosX = H.GetProperty(Id, PropertyId::PosX);
    const int32 PosY = H.GetProperty(Id, PropertyId::PosY);
    const int32 VelX = H.GetProperty(Id, PropertyId::VelX);
    const int32 VelY = H.GetProperty(Id, PropertyId::VelY);
    const FHktEntityId Watched = (EvCount == 1) ? Ev[0].WatchedEntity : InvalidEntityId;
    const EWaitEventType EvType = (EvCount == 1) ? Ev[0].Type : EWaitEventType::None;
    H.Teardown();

    if (EvCount != 1)
        return FHktTestResult::Fail(TEXT("ArrivalSnapsToTarget"),
            FString::Printf(TEXT("MoveEnd 1회 기대, 실제 %d"), EvCount));
    if (EvType != EWaitEventType::MoveEnd)
        return FHktTestResult::Fail(TEXT("ArrivalSnapsToTarget"),
            TEXT("이벤트 타입이 MoveEnd 가 아님"));
    if (Watched != Id)
        return FHktTestResult::Fail(TEXT("ArrivalSnapsToTarget"),
            FString::Printf(TEXT("WatchedEntity %d 기대, 실제 %d"), Id, Watched));
    if (IsMoving != 0)
        return FHktTestResult::Fail(TEXT("ArrivalSnapsToTarget"),
            FString::Printf(TEXT("도착 후 IsMoving 0 기대, 실제 %d"), IsMoving));
    if (PosX != Off || PosY != Off)
        return FHktTestResult::Fail(TEXT("ArrivalSnapsToTarget"),
            FString::Printf(TEXT("타겟 스냅 (%d,%d) 기대, 실제 (%d,%d)"), Off, Off, PosX, PosY));
    if (VelX != 0 || VelY != 0)
        return FHktTestResult::Fail(TEXT("ArrivalSnapsToTarget"),
            FString::Printf(TEXT("도착 후 수평 속도 0 기대, 실제 (%d,%d)"), VelX, VelY));

    return FHktTestResult::Pass(TEXT("ArrivalSnapsToTarget"));
}

/** T2: 충분히 긴 직선 이동 — N 틱 내 도착, IsMoving=0, 정확히 1회 MoveEnd. */
static FHktTestResult Test_LinearMotionReachesTarget()
{
    FHktAutomationTestHarness H;
    H.Setup();

    const int32 TX = TestConst::FarTargetCm;
    const FHktEntityId Id = CreateMover(H, 0, 0, 0, TX, 0, 0);
    MarkAllAsActive(H);

    int32 MoveEndCount = 0;
    bool bArrived = false;
    int32 ArrivedTick = -1;

    for (int32 T = 0; T < TestConst::MaxArrivalTicks; ++T)
    {
        TArray<FIntVector> Pre; TArray<FHktPendingEvent> Ev;
        RunMovement(H, Pre, Ev);
        MoveEndCount += Ev.Num();

        if (H.GetProperty(Id, PropertyId::IsMoving) == 0)
        {
            bArrived = true;
            ArrivedTick = T;
            break;
        }
    }

    const int32 PosX = H.GetProperty(Id, PropertyId::PosX);
    H.Teardown();

    if (!bArrived)
        return FHktTestResult::Fail(TEXT("LinearMotionReachesTarget"),
            FString::Printf(TEXT("%d 틱 내 도착 실패 (현재 X=%d, 타겟 X=%d)"),
                TestConst::MaxArrivalTicks, PosX, TX));
    if (MoveEndCount != 1)
        return FHktTestResult::Fail(TEXT("LinearMotionReachesTarget"),
            FString::Printf(TEXT("MoveEnd 정확히 1회 기대, 실제 %d (도착 틱=%d)"),
                MoveEndCount, ArrivedTick));
    // 도착 후엔 타겟에 정확히 스냅되어 있어야 한다 (스냅 코드가 정수 반올림 후 SetPosition).
    if (PosX != TX)
        return FHktTestResult::Fail(TEXT("LinearMotionReachesTarget"),
            FString::Printf(TEXT("도착 후 PosX=%d 기대, 실제 %d"), TX, PosX));

    return FHktTestResult::Pass(TEXT("LinearMotionReachesTarget"));
}

/** T3: RotYaw 가 타겟 방향으로 갱신된다. */
static FHktTestResult Test_RotYawUpdatedTowardTarget()
{
    FHktAutomationTestHarness H;
    H.Setup();

    // +X 방향 — atan2(0, +) = 0°
    const FHktEntityId IdX = CreateMover(H, 0, 0, 0, TestConst::FarTargetCm, 0, 0);
    // +Y 방향 — atan2(+, 0) = 90°
    const FHktEntityId IdY = CreateMover(H, 0, 0, 0, 0, TestConst::FarTargetCm, 0);
    MarkAllAsActive(H);

    TArray<FIntVector> Pre; TArray<FHktPendingEvent> Ev;
    RunMovement(H, Pre, Ev);

    const int32 YawX = H.GetProperty(IdX, PropertyId::RotYaw);
    const int32 YawY = H.GetProperty(IdY, PropertyId::RotYaw);
    H.Teardown();

    if (YawX != 0)
        return FHktTestResult::Fail(TEXT("RotYawUpdatedTowardTarget"),
            FString::Printf(TEXT("+X 방향 RotYaw=0 기대, 실제 %d"), YawX));
    if (YawY != 90)
        return FHktTestResult::Fail(TEXT("RotYawUpdatedTowardTarget"),
            FString::Printf(TEXT("+Y 방향 RotYaw=90 기대, 실제 %d"), YawY));

    return FHktTestResult::Pass(TEXT("RotYawUpdatedTowardTarget"));
}

/** T4: 수평 속도(`sqrt(VelX² + VelY²)`)가 MaxSpeed 를 초과하지 않는다. */
static FHktTestResult Test_VelocityRespectsMaxSpeed()
{
    FHktAutomationTestHarness H;
    H.Setup();

    const int32 MaxSpd = TestConst::DefaultMaxSpeed;
    const FHktEntityId Id = CreateMover(H, 0, 0, 0, TestConst::FarTargetCm, 0, 0,
        TestConst::DefaultForce, MaxSpd);
    MarkAllAsActive(H);

    bool bExceeded = false;
    int32 ExceededTick = -1;
    int32 PeakHSpeedSq = 0;

    // 적분이 충분히 가속한 뒤에도 상한이 지켜지는지 확인.
    for (int32 T = 0; T < TestConst::MaxArrivalTicks; ++T)
    {
        TArray<FIntVector> Pre; TArray<FHktPendingEvent> Ev;
        RunMovement(H, Pre, Ev);

        const int32 VX = H.GetProperty(Id, PropertyId::VelX);
        const int32 VY = H.GetProperty(Id, PropertyId::VelY);
        const int32 HSq = VX * VX + VY * VY;
        if (HSq > PeakHSpeedSq) PeakHSpeedSq = HSq;

        // 정수 반올림으로 1cm/s 정도 오버는 허용 (스냅 직전 마지막 틱에서 발생 가능).
        const int32 Tolerance = (MaxSpd + 1) * (MaxSpd + 1);
        if (HSq > Tolerance)
        {
            bExceeded = true;
            ExceededTick = T;
            break;
        }

        if (H.GetProperty(Id, PropertyId::IsMoving) == 0) break;
    }

    H.Teardown();

    if (bExceeded)
        return FHktTestResult::Fail(TEXT("VelocityRespectsMaxSpeed"),
            FString::Printf(TEXT("Tick %d: HSpeed²=%d > MaxSpeed²(+1)=%d"),
                ExceededTick, PeakHSpeedSq, (MaxSpd + 1) * (MaxSpd + 1)));

    return FHktTestResult::Pass(TEXT("VelocityRespectsMaxSpeed"));
}

/** T5: 빈 월드 — no-op, 이벤트 없음, ActiveMoverSlots 변동 없음. */
static FHktTestResult Test_EmptyWorld()
{
    FHktAutomationTestHarness H;
    H.Setup();

    TArray<FIntVector> Pre; TArray<FHktPendingEvent> Ev;
    RunMovement(H, Pre, Ev);

    const int32 Active = H.GetVMProxy().ActiveMoverSlots.Num();
    const int32 EvCount = Ev.Num();
    H.Teardown();

    if (Active != 0 || EvCount != 0)
        return FHktTestResult::Fail(TEXT("EmptyWorld"),
            FString::Printf(TEXT("빈 월드: active=%d events=%d 기대 0/0"), Active, EvCount));

    return FHktTestResult::Pass(TEXT("EmptyWorld"));
}

/** T6: idle 슬롯은 한 번 방문 후 ActiveMoverSlots 에서 prune. */
static FHktTestResult Test_PrunesIdleSlot()
{
    FHktAutomationTestHarness H;
    H.Setup();

    const FHktEntityId Id = CreateIdle(H, 0, 0, 0);
    const int32 Slot = H.GetWorldState().GetSlot(Id);
    H.GetVMProxy().MarkActiveMover(Slot);

    if (H.GetVMProxy().ActiveMoverSlots.Num() != 1)
    {
        H.Teardown();
        return FHktTestResult::Fail(TEXT("PrunesIdleSlot"),
            FString::Printf(TEXT("Setup: active 1 기대, 실제 %d"),
                H.GetVMProxy().ActiveMoverSlots.Num()));
    }

    TArray<FIntVector> Pre; TArray<FHktPendingEvent> Ev;
    RunMovement(H, Pre, Ev);

    const int32 PostCount = H.GetVMProxy().ActiveMoverSlots.Num();
    const uint8 PostMask = H.GetVMProxy().ActiveMoverMask.IsValidIndex(Slot)
        ? H.GetVMProxy().ActiveMoverMask[Slot] : 0;
    H.Teardown();

    if (PostCount != 0)
        return FHktTestResult::Fail(TEXT("PrunesIdleSlot"),
            FString::Printf(TEXT("Process 후 active 0 기대, 실제 %d"), PostCount));
    if (PostMask != 0)
        return FHktTestResult::Fail(TEXT("PrunesIdleSlot"),
            FString::Printf(TEXT("Process 후 mask=0 기대, 실제 %u"), PostMask));

    return FHktTestResult::Pass(TEXT("PrunesIdleSlot"));
}

/** T7: 이동 중 엔티티는 Process 후에도 active 로 남는다. */
static FHktTestResult Test_KeepsMovingSlotActive()
{
    FHktAutomationTestHarness H;
    H.Setup();

    const FHktEntityId Id = CreateMover(H, 0, 0, 0, TestConst::FarTargetCm, 0, 0);
    const int32 Slot = H.GetWorldState().GetSlot(Id);
    H.GetVMProxy().MarkActiveMover(Slot);

    TArray<FIntVector> Pre; TArray<FHktPendingEvent> Ev;
    RunMovement(H, Pre, Ev);

    const int32 PostCount = H.GetVMProxy().ActiveMoverSlots.Num();
    const uint8 PostMask = H.GetVMProxy().ActiveMoverMask[Slot];
    H.Teardown();

    if (PostCount != 1)
        return FHktTestResult::Fail(TEXT("KeepsMovingSlotActive"),
            FString::Printf(TEXT("active 1 기대, 실제 %d"), PostCount));
    if (PostMask != 1)
        return FHktTestResult::Fail(TEXT("KeepsMovingSlotActive"),
            FString::Printf(TEXT("mask=1 기대, 실제 %u"), PostMask));

    return FHktTestResult::Pass(TEXT("KeepsMovingSlotActive"));
}

/** T8: prune 직후 같은 슬롯에 mark 가 다시 들어와도 list 중복 없음. */
static FHktTestResult Test_NoDuplicateAfterPruneRemark()
{
    FHktAutomationTestHarness H;
    H.Setup();

    const FHktEntityId Id = CreateIdle(H, 0, 0, 0);
    const int32 Slot = H.GetWorldState().GetSlot(Id);
    H.GetVMProxy().MarkActiveMover(Slot);

    TArray<FIntVector> Pre; TArray<FHktPendingEvent> Ev;
    RunMovement(H, Pre, Ev);

    if (H.GetVMProxy().ActiveMoverSlots.Num() != 0)
    {
        H.Teardown();
        return FHktTestResult::Fail(TEXT("NoDuplicateAfterPruneRemark"),
            TEXT("Step1: idle prune 실패"));
    }

    // 임의 nonzero — 값 자체는 hook 동작과 무관 (Vel{XYZ} 가 hook 대상).
    constexpr int32 NonzeroVelZ = -100;
    H.GetVMProxy().SetPropertyDirty(H.GetWorldState(), Id, PropertyId::VelZ, NonzeroVelZ);

    const int32 AfterRemark = H.GetVMProxy().ActiveMoverSlots.Num();
    const uint8 AfterMask = H.GetVMProxy().ActiveMoverMask[Slot];
    H.Teardown();

    if (AfterRemark != 1)
        return FHktTestResult::Fail(TEXT("NoDuplicateAfterPruneRemark"),
            FString::Printf(TEXT("Re-mark 후 list 1 기대, 실제 %d (중복 회귀)"), AfterRemark));
    if (AfterMask != 1)
        return FHktTestResult::Fail(TEXT("NoDuplicateAfterPruneRemark"),
            FString::Printf(TEXT("Re-mark 후 mask=1 기대, 실제 %u"), AfterMask));

    return FHktTestResult::Pass(TEXT("NoDuplicateAfterPruneRemark"));
}

/** T9: 같은 슬롯에 운동 prop 을 여러 번 써도 list 1회만 Add. */
static FHktTestResult Test_NoDuplicateOnMultipleMarks()
{
    FHktAutomationTestHarness H;
    H.Setup();

    const FHktEntityId Id = CreateIdle(H, 0, 0, 0);

    auto Write = [&](uint16 PropId, int32 Value)
    {
        H.GetVMProxy().SetPropertyDirty(H.GetWorldState(), Id, PropId, Value);
    };
    // MoveTarget* 는 hook 대상 아님 — MoveForce/IsMoving/Vel{XY} 만 mark 트리거.
    // mask 가드로 list 에는 1 회만 Add.
    Write(PropertyId::MoveTargetX, TestConst::FarTargetCm);
    Write(PropertyId::MoveTargetY, 0);
    Write(PropertyId::MoveTargetZ, 0);
    Write(PropertyId::MoveForce, TestConst::DefaultForce);
    Write(PropertyId::IsMoving, 1);
    Write(PropertyId::VelX, 0);
    Write(PropertyId::VelY, 0);

    const int32 Count = H.GetVMProxy().ActiveMoverSlots.Num();
    H.Teardown();

    if (Count != 1)
        return FHktTestResult::Fail(TEXT("NoDuplicateOnMultipleMarks"),
            FString::Printf(TEXT("ActiveMoverSlots 1 기대, 실제 %d"), Count));

    return FHktTestResult::Pass(TEXT("NoDuplicateOnMultipleMarks"));
}

/** T10: 모든 유효 슬롯의 PreMovePositions 가 현재 Pos 로 채워진다 (Physics 전제). */
static FHktTestResult Test_PreMovePositionsFilledForAllSlots()
{
    FHktAutomationTestHarness H;
    H.Setup();

    const FIntVector MovingStart(100, 200, 50);
    const FIntVector IdleStart(300, 400, 25);

    const FHktEntityId Moving = CreateMover(H,
        MovingStart.X, MovingStart.Y, MovingStart.Z,
        TestConst::FarTargetCm, 0, 0);
    const FHktEntityId Idle = CreateIdle(H, IdleStart.X, IdleStart.Y, IdleStart.Z);

    MarkAllAsActive(H);

    TArray<FIntVector> Pre; TArray<FHktPendingEvent> Ev;
    RunMovement(H, Pre, Ev);

    const int32 SlotMoving = H.GetWorldState().GetSlot(Moving);
    const int32 SlotIdle = H.GetWorldState().GetSlot(Idle);

    // Idle 슬롯: prefill 로 현재 Pos 가 그대로.
    if (!Pre.IsValidIndex(SlotIdle) || Pre[SlotIdle] != IdleStart)
    {
        const FIntVector Got = Pre.IsValidIndex(SlotIdle) ? Pre[SlotIdle] : FIntVector::ZeroValue;
        H.Teardown();
        return FHktTestResult::Fail(TEXT("PreMovePositionsFilledForAllSlots"),
            FString::Printf(TEXT("Idle slot %d PreMove (%d,%d,%d) 기대, 실제 (%d,%d,%d)"),
                SlotIdle, IdleStart.X, IdleStart.Y, IdleStart.Z, Got.X, Got.Y, Got.Z));
    }

    // Moving 슬롯: 적분 전 위치(=처음 입력 Pos).
    if (!Pre.IsValidIndex(SlotMoving) || Pre[SlotMoving] != MovingStart)
    {
        const FIntVector Got = Pre.IsValidIndex(SlotMoving) ? Pre[SlotMoving] : FIntVector::ZeroValue;
        H.Teardown();
        return FHktTestResult::Fail(TEXT("PreMovePositionsFilledForAllSlots"),
            FString::Printf(TEXT("Moving slot %d PreMove (%d,%d,%d) 기대, 실제 (%d,%d,%d)"),
                SlotMoving, MovingStart.X, MovingStart.Y, MovingStart.Z, Got.X, Got.Y, Got.Z));
    }

    H.Teardown();
    return FHktTestResult::Pass(TEXT("PreMovePositionsFilledForAllSlots"));
}

/** T11: 엔티티 제거 후 stale 슬롯이 ActiveMoverSlots/Mask 에서 정리된다. */
static FHktTestResult Test_StaleSlotCleanup()
{
    FHktAutomationTestHarness H;
    H.Setup();

    const FHktEntityId Id = CreateMover(H, 0, 0, 0, TestConst::FarTargetCm, 0, 0);
    const int32 Slot = H.GetWorldState().GetSlot(Id);
    H.GetVMProxy().MarkActiveMover(Slot);

    H.GetWorldState().RemoveEntity(Id);

    TArray<FIntVector> Pre; TArray<FHktPendingEvent> Ev;
    RunMovement(H, Pre, Ev);

    const int32 PostCount = H.GetVMProxy().ActiveMoverSlots.Num();
    const uint8 PostMask = H.GetVMProxy().ActiveMoverMask.IsValidIndex(Slot)
        ? H.GetVMProxy().ActiveMoverMask[Slot] : 0;
    H.Teardown();

    if (PostCount != 0)
        return FHktTestResult::Fail(TEXT("StaleSlotCleanup"),
            FString::Printf(TEXT("stale 정리 후 list 0 기대, 실제 %d"), PostCount));
    if (PostMask != 0)
        return FHktTestResult::Fail(TEXT("StaleSlotCleanup"),
            FString::Printf(TEXT("stale 정리 후 mask=0 기대, 실제 %u"), PostMask));

    return FHktTestResult::Pass(TEXT("StaleSlotCleanup"));
}

/** T12: RebuildActiveMovers — Mover/Falling 은 active, Idle 은 inactive, bogus 슬롯은 drop. */
static FHktTestResult Test_RebuildActiveMovers()
{
    FHktAutomationTestHarness H;
    H.Setup();

    const FHktEntityId Mover = CreateMover(H, 0, 0, 0, TestConst::FarTargetCm, 0, 0);

    constexpr int32 SampleFallingVelZ = -50;
    TMap<uint16, int32> FallingProps;
    FallingProps.Add(PropertyId::IsGrounded, 0);
    FallingProps.Add(PropertyId::VelZ, SampleFallingVelZ);
    const FHktEntityId Falling = H.CreateEntityWithProperties(FallingProps);

    const FHktEntityId IdleE = CreateIdle(H, 0, 0, 0);

    // 일단 list 를 의도적으로 더럽힌 뒤 Rebuild — out-of-entity 슬롯은 drop 되어야 한다.
    H.GetVMProxy().MarkActiveMover(TestConst::BogusSlotIndex);

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
        return FHktTestResult::Fail(TEXT("RebuildActiveMovers"),
            TEXT("IsMoving=1 엔티티가 rebuild 후 inactive"));
    if (!bFallingActive)
        return FHktTestResult::Fail(TEXT("RebuildActiveMovers"),
            TEXT("IsGrounded=0 + VelZ!=0 엔티티가 rebuild 후 inactive"));
    if (bIdleActive)
        return FHktTestResult::Fail(TEXT("RebuildActiveMovers"),
            TEXT("Idle 엔티티가 rebuild 후 active 로 잘못 표시"));

    return FHktTestResult::Pass(TEXT("RebuildActiveMovers"));
}

// ============================================================================
// 통합 테스트 — 시뮬레이터/VM 파이프라인 결합
// ============================================================================

namespace
{
    /** Mover 엔티티의 초기 상태를 FHktEntityState 로 채워 반환. */
    FHktEntityState MakeMoverEntityState(
        int32 PX, int32 PY, int32 PZ,
        int32 TX, int32 TY, int32 TZ,
        int32 Force, int32 Mass, int32 MaxSpd)
    {
        FHktEntityState ES;
        ES.Data.SetNumZeroed(PropertyId::MaxCount());
        ES.Data[PropertyId::PosX] = PX;
        ES.Data[PropertyId::PosY] = PY;
        ES.Data[PropertyId::PosZ] = PZ;
        ES.Data[PropertyId::MoveTargetX] = TX;
        ES.Data[PropertyId::MoveTargetY] = TY;
        ES.Data[PropertyId::MoveTargetZ] = TZ;
        ES.Data[PropertyId::MoveForce] = Force;
        ES.Data[PropertyId::IsMoving] = 1;
        ES.Data[PropertyId::IsGrounded] = 1;
        ES.Data[PropertyId::Mass] = Mass;
        ES.Data[PropertyId::MaxSpeed] = MaxSpd;
        ES.OwnerUid = 1;
        return ES;
    }
}

/** T13 (Integration): 시뮬레이터 풀 파이프라인을 통한 도착 검증.
 *
 *  유닛 테스트는 MovementSystem.Process 만 격리해 호출했다. 본 테스트는
 *  `CreateDeterminismSimulator` 가 만든 풀 파이프라인 (Arrange → VMBuild →
 *  VMProcess → Gravity → Movement → Physics → Cleanup) 을 N 프레임 돌려
 *    - AdvanceFrame 의 NewEntityStates import-mark 루프
 *    - Gravity → Movement → Physics 간 mark 전파 정합성
 *    - 도착 후 IsMoving=0 까지 가는 풀 사이클
 *  을 cover 한다.
 */
static FHktTestResult Test_Integration_SimulatorReachesTarget()
{
    constexpr int32 NumFrames = 80;

    TUniquePtr<IHktDeterminismSimulator> Sim = CreateDeterminismSimulator(EHktLogSource::Server);

    // Frame 1: spawn 이동 엔티티.
    FHktSimulationEvent Spawn;
    Spawn.FrameNumber = 1;
    Spawn.NewEntityStates.Add(MakeMoverEntityState(
        /*Pos*/0, 0, 0,
        /*Tgt*/TestConst::FarTargetCm, 0, 0,
        TestConst::DefaultForce, TestConst::DefaultMass, TestConst::DefaultMaxSpeed));
    Sim->AdvanceFrame(Spawn);

    // 후속 프레임은 입력 없이 진행 — Movement 적분만 발생.
    for (int32 F = 2; F <= NumFrames; ++F)
    {
        FHktSimulationEvent Empty;
        Empty.FrameNumber = F;
        Sim->AdvanceFrame(Empty);
    }

    const FHktWorldState& WS = Sim->GetWorldState();
    if (WS.GetEntityCount() != 1)
        return FHktTestResult::Fail(TEXT("Integration_SimulatorReachesTarget"),
            FString::Printf(TEXT("EntityCount 1 기대, 실제 %d"), WS.GetEntityCount()));
    if (!WS.IsValidEntity(/*Id=*/0))
        return FHktTestResult::Fail(TEXT("Integration_SimulatorReachesTarget"),
            TEXT("EntityId=0 이 유효하지 않음"));

    const int32 IsMoving = WS.GetProperty(0, PropertyId::IsMoving);
    if (IsMoving != 0)
        return FHktTestResult::Fail(TEXT("Integration_SimulatorReachesTarget"),
            FString::Printf(TEXT("%d 프레임 후 IsMoving=0 기대, 실제 %d (도착 실패)"),
                NumFrames, IsMoving));

    // 도착 sanity — 타겟 X 근처(±몇 cm)로 와 있어야 한다.
    const int32 PosX = WS.GetProperty(0, PropertyId::PosX);
    if (FMath::Abs(PosX - TestConst::FarTargetCm) > 4)
        return FHktTestResult::Fail(TEXT("Integration_SimulatorReachesTarget"),
            FString::Printf(TEXT("PosX %d (~%d 기대)"), PosX, TestConst::FarTargetCm));

    return FHktTestResult::Pass(TEXT("Integration_SimulatorReachesTarget"));
}

/** T14 (VM-driven mark): Story 바이트코드 → VMContext.WriteEntity → SetPropertyDirty hook
 *  경로가 실제로 슬롯을 active mover 로 마크하는지 검증.
 *
 *  유닛 테스트는 `VMProxy.SetPropertyDirty` 를 직접 호출해 hook 동작만 cover 했다.
 *  본 테스트는 `FHktStoryBuilder::MoveToward` 가 emit 하는 SaveStoreEntity /
 *  SaveConstEntity 바이트코드가 실제로 VM 에서 실행되어 동일 결과를 내는지 확인 —
 *  미래에 누군가 VMContext.WriteEntity 를 우회하는 경로를 추가하면 회귀로 잡힌다.
 */
static FHktTestResult Test_VMDriven_MarksActiveMoverViaMoveToward()
{
    FHktAutomationTestHarness H;
    H.Setup();
    const FHktEntityId E = H.CreateEntity();

    if (H.GetVMProxy().ActiveMoverSlots.Num() != 0)
    {
        H.Teardown();
        return FHktTestResult::Fail(TEXT("VMDriven_MarksActiveMoverViaMoveToward"),
            TEXT("초기 상태에서 ActiveMoverSlots 비어있어야 함"));
    }

    const FGameplayTag Tag = FGameplayTag::RequestGameplayTag(
        FName(TEXT("Test.Movement.VMDriven")), /*ErrorIfNotFound=*/false);

    auto Program = FHktStoryBuilder::Create(Tag)
        .LoadConst(Reg::R5, TestConst::FarTargetCm)  // TargetX
        .LoadConst(Reg::R6, 0)                       // TargetY
        .LoadConst(Reg::R7, 0)                       // TargetZ
        .MoveToward(Reg::Self, Reg::R5, TestConst::DefaultForce)
        .Halt()
        .Build();

    if (!Program.IsValid())
    {
        H.Teardown();
        return FHktTestResult::Fail(TEXT("VMDriven_MarksActiveMoverViaMoveToward"),
            TEXT("Story Build 실패 — bytecode 생성 단계 결함 (테스트 환경 문제)"));
    }

    H.ExecuteProgram(Program, E);

    const int32 ActiveCount = H.GetVMProxy().ActiveMoverSlots.Num();
    const int32 IsMoving = H.GetProperty(E, PropertyId::IsMoving);
    const int32 MoveForce = H.GetProperty(E, PropertyId::MoveForce);
    const int32 SlotOfE = H.GetWorldState().GetSlot(E);
    const uint8 MaskOfE = H.GetVMProxy().ActiveMoverMask.IsValidIndex(SlotOfE)
        ? H.GetVMProxy().ActiveMoverMask[SlotOfE] : 0;
    H.Teardown();

    if (IsMoving != 1)
        return FHktTestResult::Fail(TEXT("VMDriven_MarksActiveMoverViaMoveToward"),
            FString::Printf(TEXT("IsMoving=1 기대, 실제 %d (Story 실행 자체 실패)"), IsMoving));
    if (MoveForce != TestConst::DefaultForce)
        return FHktTestResult::Fail(TEXT("VMDriven_MarksActiveMoverViaMoveToward"),
            FString::Printf(TEXT("MoveForce %d 기대, 실제 %d"),
                TestConst::DefaultForce, MoveForce));
    if (ActiveCount != 1)
        return FHktTestResult::Fail(TEXT("VMDriven_MarksActiveMoverViaMoveToward"),
            FString::Printf(TEXT("ActiveMoverSlots 1 기대, 실제 %d (VM→hook 경로 단절 의심)"),
                ActiveCount));
    if (MaskOfE != 1)
        return FHktTestResult::Fail(TEXT("VMDriven_MarksActiveMoverViaMoveToward"),
            FString::Printf(TEXT("ActiveMoverMask[Slot] 1 기대, 실제 %u"), MaskOfE));

    return FHktTestResult::Pass(TEXT("VMDriven_MarksActiveMoverViaMoveToward"));
}

// ============================================================================
// Runner aggregation
// ============================================================================

FHktTestReport RunAllMovementSystemTests()
{
    FHktTestReport Report;
    Report.Add(Test_ArrivalSnapsToTarget());
    Report.Add(Test_LinearMotionReachesTarget());
    Report.Add(Test_RotYawUpdatedTowardTarget());
    Report.Add(Test_VelocityRespectsMaxSpeed());
    Report.Add(Test_EmptyWorld());
    Report.Add(Test_PrunesIdleSlot());
    Report.Add(Test_KeepsMovingSlotActive());
    Report.Add(Test_NoDuplicateAfterPruneRemark());
    Report.Add(Test_NoDuplicateOnMultipleMarks());
    Report.Add(Test_PreMovePositionsFilledForAllSlots());
    Report.Add(Test_StaleSlotCleanup());
    Report.Add(Test_RebuildActiveMovers());
    Report.Add(Test_Integration_SimulatorReachesTarget());
    Report.Add(Test_VMDriven_MarksActiveMoverViaMoveToward());
    return Report;
}

} // namespace HktMovementSystemTests

// ============================================================================
// UE Automation Test 노출 — Session Frontend "HktCore.Movement.*" 트리에 표시
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

HKT_DEFINE_MOVEMENT_TEST(FHktMovement_ArrivalSnapsToTargetTest,
    "HktCore.Movement.Arrival.SnapsToTarget", Test_ArrivalSnapsToTarget)
HKT_DEFINE_MOVEMENT_TEST(FHktMovement_LinearMotionReachesTargetTest,
    "HktCore.Movement.Motion.LinearReachesTarget", Test_LinearMotionReachesTarget)
HKT_DEFINE_MOVEMENT_TEST(FHktMovement_RotYawUpdatedTowardTargetTest,
    "HktCore.Movement.Motion.RotYawUpdatedTowardTarget", Test_RotYawUpdatedTowardTarget)
HKT_DEFINE_MOVEMENT_TEST(FHktMovement_VelocityRespectsMaxSpeedTest,
    "HktCore.Movement.Motion.VelocityRespectsMaxSpeed", Test_VelocityRespectsMaxSpeed)
HKT_DEFINE_MOVEMENT_TEST(FHktMovement_EmptyWorldTest,
    "HktCore.Movement.Invariant.EmptyWorld", Test_EmptyWorld)
HKT_DEFINE_MOVEMENT_TEST(FHktMovement_PrunesIdleSlotTest,
    "HktCore.Movement.Invariant.PrunesIdleSlot", Test_PrunesIdleSlot)
HKT_DEFINE_MOVEMENT_TEST(FHktMovement_KeepsMovingSlotActiveTest,
    "HktCore.Movement.Invariant.KeepsMovingSlotActive", Test_KeepsMovingSlotActive)
HKT_DEFINE_MOVEMENT_TEST(FHktMovement_NoDuplicateAfterPruneRemarkTest,
    "HktCore.Movement.Invariant.NoDuplicateAfterPruneRemark", Test_NoDuplicateAfterPruneRemark)
HKT_DEFINE_MOVEMENT_TEST(FHktMovement_NoDuplicateOnMultipleMarksTest,
    "HktCore.Movement.Invariant.NoDuplicateOnMultipleMarks", Test_NoDuplicateOnMultipleMarks)
HKT_DEFINE_MOVEMENT_TEST(FHktMovement_PreMovePositionsFilledTest,
    "HktCore.Movement.Invariant.PreMovePositionsFilled", Test_PreMovePositionsFilledForAllSlots)
HKT_DEFINE_MOVEMENT_TEST(FHktMovement_StaleSlotCleanupTest,
    "HktCore.Movement.Invariant.StaleSlotCleanup", Test_StaleSlotCleanup)
HKT_DEFINE_MOVEMENT_TEST(FHktMovement_RebuildActiveMoversTest,
    "HktCore.Movement.Invariant.RebuildActiveMovers", Test_RebuildActiveMovers)
HKT_DEFINE_MOVEMENT_TEST(FHktMovement_Integration_SimulatorReachesTargetTest,
    "HktCore.Movement.Integration.SimulatorReachesTarget", Test_Integration_SimulatorReachesTarget)
HKT_DEFINE_MOVEMENT_TEST(FHktMovement_Integration_VMDrivenMarkTest,
    "HktCore.Movement.Integration.VMDrivenMark", Test_VMDriven_MarksActiveMoverViaMoveToward)

#undef HKT_DEFINE_MOVEMENT_TEST

#endif // WITH_AUTOMATION_TESTS
