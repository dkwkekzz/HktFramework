// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktAutomationTestsHarness.h"
#include "HktSimulationTick.h"
#include "VM/HktVMProgram.h"

void FHktAutomationTestHarness::Setup()
{
	WorldState.Initialize();
	VMProxy.Initialize(WorldState);
	Interpreter.Initialize(&WorldState, &VMProxy);

	Runtime = FHktVMRuntime();
	Context.Reset();
	Context.WorldState = &WorldState;
	Context.VMProxy = &VMProxy;
	Runtime.Context = &Context;
}

void FHktAutomationTestHarness::Teardown()
{
	Runtime.Program = nullptr;
	Runtime.Context = nullptr;
	Context.WorldState = nullptr;
	Context.VMProxy = nullptr;
}

FHktEntityId FHktAutomationTestHarness::CreateEntity()
{
	return WorldState.AllocateEntity();
}

FHktEntityId FHktAutomationTestHarness::CreateEntityWithProperties(const TMap<uint16, int32>& Props)
{
	FHktEntityId Entity = WorldState.AllocateEntity();
	for (const auto& Pair : Props)
	{
		WorldState.SetProperty(Entity, Pair.Key, Pair.Value);
	}
	return Entity;
}

EVMStatus FHktAutomationTestHarness::ExecuteProgram(
	TSharedPtr<FHktVMProgram> Program,
	FHktEntityId Source,
	FHktEntityId Target,
	int32 MaxTicks)
{
	if (!Program.IsValid())
	{
		return EVMStatus::Failed;
	}
	return ExecuteProgram(Program.Get(), Source, Target, MaxTicks);
}

EVMStatus FHktAutomationTestHarness::ExecuteProgram(
	const FHktVMProgram* Program,
	FHktEntityId Source,
	FHktEntityId Target,
	int32 MaxTicks)
{
	if (!Program)
	{
		return EVMStatus::Failed;
	}

	// Runtime 초기화
	Runtime.Program = Program;
	Runtime.PC = 0;
	Runtime.Status = EVMStatus::Ready;
	Runtime.WaitFrames = 0;
	Runtime.EventWait.Reset();
	Runtime.SpatialQuery.Reset();
	Runtime.PendingDispatchedEvents.Reset();
	FMemory::Memzero(Runtime.Registers, sizeof(Runtime.Registers));

	// Context 설정
	Context.SourceEntity = Source;
	Context.TargetEntity = Target;
	Runtime.Registers[Reg::Self] = static_cast<int32>(Source);
	Runtime.Registers[Reg::Target] = static_cast<int32>(Target);

	// 실행 루프
	for (int32 Tick = 0; Tick < MaxTicks; ++Tick)
	{
		VMProxy.ResetDirtyIndices(WorldState);

		EVMStatus Status = Interpreter.Execute(Runtime);

		if (Status == EVMStatus::Completed || Status == EVMStatus::Failed)
		{
			return Status;
		}

		if (Status == EVMStatus::Yielded)
		{
			// Yield 소비: WaitFrames 차감
			if (Runtime.WaitFrames > 0)
			{
				Runtime.WaitFrames--;
			}
			if (Runtime.WaitFrames <= 0)
			{
				Runtime.Status = EVMStatus::Ready;
			}
			continue;
		}

		if (Status == EVMStatus::WaitingEvent)
		{
			// Timer 타입은 자동 진행 — 하니스 1틱 = 1프레임
			if (Runtime.EventWait.Type == EWaitEventType::Timer)
			{
				if (--Runtime.EventWait.RemainingFrames <= 0)
				{
					Runtime.EventWait.Reset();
					Runtime.Status = EVMStatus::Ready;
				}
				continue;
			}
			// 다른 이벤트 타입은 외부 주입 필요 — MaxTicks 초과 시 중단
			return Status;
		}
	}

	return Runtime.Status;
}

// ========== Wait 분리 실행 (Phase 2c) ==========
//
// 공통 루프 헬퍼 — bStopAtNonTimerWait 가 true 면 비-Timer Wait 시 즉시 멈추고
// false 면 Phase 2b 의 ExecuteProgram 과 동일 (비-Timer Wait 도 즉시 종료지만 Status 반환).
namespace
{
	EVMStatus RunLoopInternal(
		FHktVMRuntime& Runtime,
		FHktVMInterpreter& Interpreter,
		FHktVMWorldStateProxy& VMProxy,
		FHktWorldState& WorldState,
		int32 MaxTicks,
		bool bStopAtNonTimerWait,
		EWaitEventType* OutWaitKind)
	{
		if (OutWaitKind) { *OutWaitKind = EWaitEventType::None; }

		for (int32 Tick = 0; Tick < MaxTicks; ++Tick)
		{
			VMProxy.ResetDirtyIndices(WorldState);
			EVMStatus Status = Interpreter.Execute(Runtime);

			if (Status == EVMStatus::Completed || Status == EVMStatus::Failed)
			{
				return Status;
			}

			if (Status == EVMStatus::Yielded)
			{
				if (Runtime.WaitFrames > 0)
				{
					Runtime.WaitFrames--;
				}
				if (Runtime.WaitFrames <= 0)
				{
					Runtime.Status = EVMStatus::Ready;
				}
				continue;
			}

			if (Status == EVMStatus::WaitingEvent)
			{
				// Timer 는 자동 진행 (양 모드 공통). 하니스 1틱 = 1프레임.
				if (Runtime.EventWait.Type == EWaitEventType::Timer)
				{
					if (--Runtime.EventWait.RemainingFrames <= 0)
					{
						Runtime.EventWait.Reset();
						Runtime.Status = EVMStatus::Ready;
					}
					continue;
				}

				// 비-Timer Wait — 외부 주입 필요.
				if (OutWaitKind) { *OutWaitKind = Runtime.EventWait.Type; }
				return Status;
			}
		}
		return Runtime.Status;
	}
}

EVMStatus FHktAutomationTestHarness::ExecuteUntilWait(
	const FHktVMProgram* Program,
	FHktEntityId Source,
	FHktEntityId Target,
	int32 MaxTicks,
	EWaitEventType& OutWaitKind)
{
	OutWaitKind = EWaitEventType::None;
	if (!Program) { return EVMStatus::Failed; }

	// Runtime 초기화 (ExecuteProgram 과 동일 절차).
	Runtime.Program = Program;
	Runtime.PC = 0;
	Runtime.Status = EVMStatus::Ready;
	Runtime.WaitFrames = 0;
	Runtime.EventWait.Reset();
	Runtime.SpatialQuery.Reset();
	Runtime.PendingDispatchedEvents.Reset();
	FMemory::Memzero(Runtime.Registers, sizeof(Runtime.Registers));

	Context.SourceEntity = Source;
	Context.TargetEntity = Target;
	Runtime.Registers[Reg::Self] = static_cast<int32>(Source);
	Runtime.Registers[Reg::Target] = static_cast<int32>(Target);

	return RunLoopInternal(Runtime, Interpreter, VMProxy, WorldState, MaxTicks, /*stop=*/true, &OutWaitKind);
}

EVMStatus FHktAutomationTestHarness::ResumeUntilDone(int32 MaxTicks)
{
	return RunLoopInternal(Runtime, Interpreter, VMProxy, WorldState, MaxTicks, /*stop=*/true, nullptr);
}

EVMStatus FHktAutomationTestHarness::ExecuteTick()
{
	VMProxy.ResetDirtyIndices(WorldState);
	return Interpreter.Execute(Runtime);
}

void FHktAutomationTestHarness::InjectCollisionEvent(FHktEntityId HitEntity)
{
	if (Runtime.EventWait.Type == EWaitEventType::Collision)
	{
		Runtime.SetRegEntity(Reg::Hit, HitEntity);
		Runtime.EventWait.Reset();
		Runtime.Status = EVMStatus::Ready;
	}
}

void FHktAutomationTestHarness::InjectMoveEndEvent()
{
	if (Runtime.EventWait.Type == EWaitEventType::MoveEnd)
	{
		Runtime.EventWait.Reset();
		Runtime.Status = EVMStatus::Ready;
	}
}

void FHktAutomationTestHarness::InjectGroundedEvent()
{
	if (Runtime.EventWait.Type == EWaitEventType::Grounded)
	{
		Runtime.EventWait.Reset();
		Runtime.Status = EVMStatus::Ready;
	}
}

void FHktAutomationTestHarness::AdvanceTimerFrames(int32 Frames)
{
	if (Runtime.EventWait.Type == EWaitEventType::Timer)
	{
		Runtime.EventWait.RemainingFrames -= Frames;
		if (Runtime.EventWait.RemainingFrames <= 0)
		{
			Runtime.EventWait.Reset();
			Runtime.Status = EVMStatus::Ready;
		}
	}
}

void FHktAutomationTestHarness::SetEventParams(int32 P0, int32 P1, int32 P2, int32 P3,
                                               int32 TargetPosX, int32 TargetPosY, int32 TargetPosZ)
{
	Context.EventParam0 = P0;
	Context.EventParam1 = P1;
	Context.EventParam2 = P2;
	Context.EventParam3 = P3;
	Context.EventTargetPosX = TargetPosX;
	Context.EventTargetPosY = TargetPosY;
	Context.EventTargetPosZ = TargetPosZ;
}

void FHktAutomationTestHarness::InjectAnimEndEvent()
{
	// WaitAnimEnd 는 EWaitEventType::Timer 로 SimFPS 프레임을 세팅한다 (HktVMInterpreter::Op_WaitAnimEnd).
	// Timer 한 호흡 분량을 한 번에 진행하여 Wait 를 해소.
	AdvanceTimerFrames(HktGetSimFramesPerSecond());
}

int32 FHktAutomationTestHarness::GetRegister(RegisterIndex Idx) const
{
	return Runtime.GetReg(Idx);
}

int32 FHktAutomationTestHarness::GetProperty(FHktEntityId Entity, uint16 PropId) const
{
	return WorldState.GetProperty(Entity, PropId);
}

bool FHktAutomationTestHarness::HasTag(FHktEntityId Entity, const FGameplayTag& Tag) const
{
	return WorldState.HasTag(Entity, Tag);
}

int32 FHktAutomationTestHarness::GetEntityCount() const
{
	return WorldState.ActiveCount;
}
