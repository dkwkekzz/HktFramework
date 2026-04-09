// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktAutomationTestsHarness.h"
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
			// Timer 타입은 자동 진행
			if (Runtime.EventWait.Type == EWaitEventType::Timer)
			{
				Runtime.EventWait.RemainingTime -= 0.016f; // ~60fps
				if (Runtime.EventWait.RemainingTime <= 0.0f)
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

void FHktAutomationTestHarness::AdvanceTimer(float DeltaSeconds)
{
	if (Runtime.EventWait.Type == EWaitEventType::Timer)
	{
		Runtime.EventWait.RemainingTime -= DeltaSeconds;
		if (Runtime.EventWait.RemainingTime <= 0.0f)
		{
			Runtime.EventWait.Reset();
			Runtime.Status = EVMStatus::Ready;
		}
	}
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
