// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktAutomationTestsLog.h"
#include "HktAutomationTestsTypes.h"
#include "HktAutomationTestsHarness.h"
#include "HktStoryBuilder.h"
#include "HktCoreProperties.h"
#include "VM/HktVMProgram.h"

namespace HktOpcodeTests
{

// ============================================================================
// Spawner Builder 헬퍼 검증 (TerrainSpawner.design.md §4-b)
//
// SpawnEntityAt / SpawnEntityAround 가 기존 opcode (SpawnEntity + SetPosition +
// RandomInt + Add) 조합으로 expansion 되는지 런타임 실행으로 검증한다.
//
// 별도 spawner-entry 메커니즘(EntryArgs / vreg prefill) 은 도입하지 않았으며,
// spawner Story 의 컨텍스트는 `FHktEvent::Param0~3` + `Location` 으로 표현된다.
// 따라서 본 테스트는 builder helper 의 런타임 시맨틱만 다룬다.
// ============================================================================

static FGameplayTag SpawnerTestTag()
{
	return FGameplayTag::RequestGameplayTag(FName(TEXT("Test.Validation.Spawner")), false);
}

static FGameplayTag SpawnerEntityTag()
{
	return FGameplayTag::RequestGameplayTag(FName(TEXT("Entity.Test.Spawner")), false);
}

static FHktTestResult Test_SpawnEntityAt_PositionApplied()
{
	FHktAutomationTestHarness H;
	H.Setup();
	FHktEntityId Self = H.CreateEntity();

	const int32 InitialCount = H.GetEntityCount();

	FHktStoryBuilder B = FHktStoryBuilder::Create(SpawnerTestTag());
	FHktVarBlock Pos = B.NewVarBlock(3, TEXT("Pos"));
	B.LoadConst(Pos.Element(0), 111);
	B.LoadConst(Pos.Element(1), 222);
	B.LoadConst(Pos.Element(2), 333);
	B.SpawnEntityAt(SpawnerEntityTag(), Pos);
	B.Halt();
	auto Program = B.Build();

	EVMStatus Status = H.ExecuteProgram(Program, Self);
	const int32 SpawnedId = H.GetRegister(Reg::Spawned);
	const int32 SpawnedPosX = (SpawnedId > 0) ? H.GetProperty(static_cast<FHktEntityId>(SpawnedId), PropertyId::PosX) : 0;
	const int32 SpawnedPosY = (SpawnedId > 0) ? H.GetProperty(static_cast<FHktEntityId>(SpawnedId), PropertyId::PosY) : 0;
	const int32 SpawnedPosZ = (SpawnedId > 0) ? H.GetProperty(static_cast<FHktEntityId>(SpawnedId), PropertyId::PosZ) : 0;
	const int32 FinalCount = H.GetEntityCount();
	H.Teardown();

	if (Status != EVMStatus::Completed)
		return FHktTestResult::Fail(TEXT("SpawnEntityAt_PositionApplied"), TEXT("Expected Completed"));
	if (FinalCount != InitialCount + 1)
		return FHktTestResult::Fail(TEXT("SpawnEntityAt_PositionApplied"), TEXT("Entity count should increase by 1"));
	if (SpawnedId <= 0)
		return FHktTestResult::Fail(TEXT("SpawnEntityAt_PositionApplied"), TEXT("Spawned register should hold valid entity id"));
	if (SpawnedPosX != 111 || SpawnedPosY != 222 || SpawnedPosZ != 333)
		return FHktTestResult::Fail(TEXT("SpawnEntityAt_PositionApplied"), TEXT("Spawned entity Pos should match LoadConst values"));

	return FHktTestResult::Pass(TEXT("SpawnEntityAt_PositionApplied"));
}

static FHktTestResult Test_SpawnEntityAround_Line_SpawnsN()
{
	FHktAutomationTestHarness H;
	H.Setup();
	FHktEntityId Self = H.CreateEntity();

	const int32 InitialCount = H.GetEntityCount();
	constexpr int32 SpawnCount = 4;

	FHktStoryBuilder B = FHktStoryBuilder::Create(SpawnerTestTag());
	FHktVarBlock Center = B.NewVarBlock(3, TEXT("Center"));
	B.LoadConst(Center.Element(0), 0);
	B.LoadConst(Center.Element(1), 0);
	B.LoadConst(Center.Element(2), 0);
	FHktVar Radius = B.NewVar(TEXT("Radius"));
	B.LoadConst(Radius, 100);  // Line 패턴은 Radius 미사용 — 단순 위치 holder.
	B.SpawnEntityAround(SpawnerEntityTag(), Center, Radius, SpawnCount, EHktSpawnPattern::Line);
	B.Halt();
	auto Program = B.Build();

	EVMStatus Status = H.ExecuteProgram(Program, Self);
	const int32 FinalCount = H.GetEntityCount();
	H.Teardown();

	if (Status != EVMStatus::Completed)
		return FHktTestResult::Fail(TEXT("SpawnEntityAround_Line_SpawnsN"), TEXT("Expected Completed"));
	if (FinalCount != InitialCount + SpawnCount)
		return FHktTestResult::Fail(TEXT("SpawnEntityAround_Line_SpawnsN"),
			*FString::Printf(TEXT("Entity count should increase by %d (got %d)"), SpawnCount, FinalCount - InitialCount));

	return FHktTestResult::Pass(TEXT("SpawnEntityAround_Line_SpawnsN"));
}

static FHktTestResult Test_SpawnEntityAround_Circle_SpawnsN()
{
	FHktAutomationTestHarness H;
	H.Setup();
	FHktEntityId Self = H.CreateEntity();

	const int32 InitialCount = H.GetEntityCount();
	constexpr int32 SpawnCount = 6;

	FHktStoryBuilder B = FHktStoryBuilder::Create(SpawnerTestTag());
	FHktVarBlock Center = B.NewVarBlock(3, TEXT("Center"));
	B.LoadConst(Center.Element(0), 500);
	B.LoadConst(Center.Element(1), 500);
	B.LoadConst(Center.Element(2), 0);
	FHktVar Radius = B.NewVar(TEXT("Radius"));
	B.LoadConst(Radius, 200);
	B.SpawnEntityAround(SpawnerEntityTag(), Center, Radius, SpawnCount, EHktSpawnPattern::Circle);
	B.Halt();
	auto Program = B.Build();

	EVMStatus Status = H.ExecuteProgram(Program, Self);
	const int32 FinalCount = H.GetEntityCount();
	H.Teardown();

	if (Status != EVMStatus::Completed)
		return FHktTestResult::Fail(TEXT("SpawnEntityAround_Circle_SpawnsN"), TEXT("Expected Completed"));
	if (FinalCount != InitialCount + SpawnCount)
		return FHktTestResult::Fail(TEXT("SpawnEntityAround_Circle_SpawnsN"),
			*FString::Printf(TEXT("Entity count should increase by %d (got %d)"), SpawnCount, FinalCount - InitialCount));

	return FHktTestResult::Pass(TEXT("SpawnEntityAround_Circle_SpawnsN"));
}

static FHktTestResult Test_SpawnEntityAround_RandomSeeded_SpawnsN()
{
	FHktAutomationTestHarness H;
	H.Setup();
	FHktEntityId Self = H.CreateEntity();

	const int32 InitialCount = H.GetEntityCount();
	constexpr int32 SpawnCount = 3;

	FHktStoryBuilder B = FHktStoryBuilder::Create(SpawnerTestTag());
	FHktVarBlock Center = B.NewVarBlock(3, TEXT("Center"));
	B.LoadConst(Center.Element(0), 0);
	B.LoadConst(Center.Element(1), 0);
	B.LoadConst(Center.Element(2), 0);
	FHktVar Radius = B.NewVar(TEXT("Radius"));
	B.LoadConst(Radius, 50);
	B.SpawnEntityAround(SpawnerEntityTag(), Center, Radius, SpawnCount, EHktSpawnPattern::RandomSeeded);
	B.Halt();
	auto Program = B.Build();

	EVMStatus Status = H.ExecuteProgram(Program, Self);
	const int32 FinalCount = H.GetEntityCount();
	H.Teardown();

	if (Status != EVMStatus::Completed)
		return FHktTestResult::Fail(TEXT("SpawnEntityAround_RandomSeeded_SpawnsN"), TEXT("Expected Completed"));
	if (FinalCount != InitialCount + SpawnCount)
		return FHktTestResult::Fail(TEXT("SpawnEntityAround_RandomSeeded_SpawnsN"),
			*FString::Printf(TEXT("Entity count should increase by %d (got %d)"), SpawnCount, FinalCount - InitialCount));

	return FHktTestResult::Pass(TEXT("SpawnEntityAround_RandomSeeded_SpawnsN"));
}

// ============================================================================
// Public
// ============================================================================

FHktTestReport RunSpawnerTests()
{
	FHktTestReport Report;
	Report.Add(Test_SpawnEntityAt_PositionApplied());
	Report.Add(Test_SpawnEntityAround_Line_SpawnsN());
	Report.Add(Test_SpawnEntityAround_Circle_SpawnsN());
	Report.Add(Test_SpawnEntityAround_RandomSeeded_SpawnsN());
	return Report;
}

} // namespace HktOpcodeTests
