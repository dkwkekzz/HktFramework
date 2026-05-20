// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktAutomationTestsLog.h"
#include "HktAutomationTestsTypes.h"
#include "HktAutomationTestsHarness.h"
#include "HktStoryBuilder.h"
#include "HktStoryEventParams.h"
#include "HktCoreProperties.h"
#include "Terrain/HktFixed32.h"
#include "Terrain/HktTerrainDataSource.h"
#include "VM/HktVMProgram.h"
#include "Misc/AutomationTest.h"

namespace HktOpcodeTests
{

// ============================================================================
// Spawner Builder 헬퍼 검증 (Docs/Design-VoxelSpawner.md §4-b)
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
// SpawnerFromView 헬퍼 검증 (Docs/Design-VoxelSpawner.md §7)
//
// chunk-load dispatch 시 `FHktTerrainSpawnerView` 를 `FHktEvent` 로 변환할 때
// 필드 매핑이 설계대로인지 확인. Harness 불필요 — 순수 함수.
// ============================================================================

static FHktTestResult Test_SpawnerFromView_FieldMapping()
{
	FHktTerrainSpawnerView V;
	V.PosXRaw = FHktFixed32::FromInt(1234).Raw;   // Q16.16 raw cm
	V.PosYRaw = FHktFixed32::FromInt(-567).Raw;
	V.PosZRaw = FHktFixed32::FromInt(89).Raw;
	V.StoryTag = FGameplayTag::RequestGameplayTag(FName(TEXT("Test.Validation.Spawner")), false);
	V.Param2 = 0xABCD;
	V.Param3 = 42;

	const FHktEvent E = HktEventBuilder::SpawnerFromView(V);

	if (E.EventTag != V.StoryTag)
		return FHktTestResult::Fail(TEXT("SpawnerFromView_FieldMapping"), TEXT("EventTag != StoryTag"));
	if (E.Param0 != 1234)
		return FHktTestResult::Fail(TEXT("SpawnerFromView_FieldMapping"),
			*FString::Printf(TEXT("Param0 expected 1234, got %d"), E.Param0));
	if (E.Param1 != -567)
		return FHktTestResult::Fail(TEXT("SpawnerFromView_FieldMapping"),
			*FString::Printf(TEXT("Param1 expected -567, got %d"), E.Param1));
	if (E.Param2 != 0xABCD)
		return FHktTestResult::Fail(TEXT("SpawnerFromView_FieldMapping"), TEXT("Param2 mismatch"));
	if (E.Param3 != 42)
		return FHktTestResult::Fail(TEXT("SpawnerFromView_FieldMapping"), TEXT("Param3 mismatch"));
	// Location 은 PosRaw 의 double 표현 — Q16.16 정확 정수 입력이라 1234/-567/89 정확히 환원.
	if (!FMath::IsNearlyEqual(E.Location.X, 1234.0, 1e-3) ||
	    !FMath::IsNearlyEqual(E.Location.Y, -567.0, 1e-3) ||
	    !FMath::IsNearlyEqual(E.Location.Z, 89.0, 1e-3))
	{
		return FHktTestResult::Fail(TEXT("SpawnerFromView_FieldMapping"),
			*FString::Printf(TEXT("Location mismatch: (%.3f,%.3f,%.3f)"),
				E.Location.X, E.Location.Y, E.Location.Z));
	}

	return FHktTestResult::Pass(TEXT("SpawnerFromView_FieldMapping"));
}

static FHktTestResult Test_SpawnerFromView_InvalidTagSkipped()
{
	// View.StoryTag 가 invalid 면 TerrainSystem dispatch 단계에서 silent skip 되도록
	// 설계됨 (HktSimulationSystems.cpp 의 enumerate 루프). 본 테스트는 헬퍼 자체가
	// invalid tag 도 그대로 EventTag 에 복사함을 확인 — 필터링은 호출자 책임.
	FHktTerrainSpawnerView V;
	V.StoryTag = FGameplayTag();  // invalid
	const FHktEvent E = HktEventBuilder::SpawnerFromView(V);
	if (E.EventTag.IsValid())
		return FHktTestResult::Fail(TEXT("SpawnerFromView_InvalidTagSkipped"),
			TEXT("Invalid StoryTag should propagate as invalid EventTag"));
	return FHktTestResult::Pass(TEXT("SpawnerFromView_InvalidTagSkipped"));
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
	Report.Add(Test_SpawnerFromView_FieldMapping());
	Report.Add(Test_SpawnerFromView_InvalidTagSkipped());
	return Report;
}

} // namespace HktOpcodeTests

// ============================================================================
// UE Automation Framework wrappers
//
// 본 파일의 테스트들은 기본적으로 custom harness (`HktAutomationTestsRunner`)
// 로 등록되어 콘솔 명령 `hkt.automation.opcodes` 로 실행된다. 그러나 그것만으로는
// UE Editor 의 Session Frontend → Automation 패널에 노출되지 않는다.
//
// 아래 IMPLEMENT_SIMPLE_AUTOMATION_TEST 래퍼들이 동일 테스트를 표준 UE Automation
// 프레임워크에도 등록하여 패널 / `Automation RunTests` 콘솔 / CI 헤드리스 러너 등
// 표준 경로 모두에서 접근 가능하게 한다. 본체 로직은 위 namespace 함수가 단일 출처.
// ============================================================================

#if WITH_AUTOMATION_TESTS

namespace
{
	bool ReportTestResultToAutomation(FAutomationTestBase& Test, const FHktTestResult& Result)
	{
		if (!Result.bPassed)
		{
			Test.AddError(Result.Message.IsEmpty()
				? FString::Printf(TEXT("%s: failed"), *Result.TestName)
				: FString::Printf(TEXT("%s: %s"), *Result.TestName, *Result.Message));
		}
		return Result.bPassed;
	}
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktSpawnerFromViewFieldMappingAutomationTest,
	"HktCore.Opcode.Spawner.SpawnerFromView.FieldMapping",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktSpawnerFromViewFieldMappingAutomationTest::RunTest(const FString& /*Parameters*/)
{
	return ReportTestResultToAutomation(*this, HktOpcodeTests::Test_SpawnerFromView_FieldMapping());
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktSpawnerFromViewInvalidTagAutomationTest,
	"HktCore.Opcode.Spawner.SpawnerFromView.InvalidTagSkipped",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktSpawnerFromViewInvalidTagAutomationTest::RunTest(const FString& /*Parameters*/)
{
	return ReportTestResultToAutomation(*this, HktOpcodeTests::Test_SpawnerFromView_InvalidTagSkipped());
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktSpawnEntityAtPositionAppliedAutomationTest,
	"HktCore.Opcode.Spawner.SpawnEntityAt.PositionApplied",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktSpawnEntityAtPositionAppliedAutomationTest::RunTest(const FString& /*Parameters*/)
{
	return ReportTestResultToAutomation(*this, HktOpcodeTests::Test_SpawnEntityAt_PositionApplied());
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktSpawnEntityAroundLineAutomationTest,
	"HktCore.Opcode.Spawner.SpawnEntityAround.Line",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktSpawnEntityAroundLineAutomationTest::RunTest(const FString& /*Parameters*/)
{
	return ReportTestResultToAutomation(*this, HktOpcodeTests::Test_SpawnEntityAround_Line_SpawnsN());
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktSpawnEntityAroundCircleAutomationTest,
	"HktCore.Opcode.Spawner.SpawnEntityAround.Circle",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktSpawnEntityAroundCircleAutomationTest::RunTest(const FString& /*Parameters*/)
{
	return ReportTestResultToAutomation(*this, HktOpcodeTests::Test_SpawnEntityAround_Circle_SpawnsN());
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktSpawnEntityAroundRandomSeededAutomationTest,
	"HktCore.Opcode.Spawner.SpawnEntityAround.RandomSeeded",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktSpawnEntityAroundRandomSeededAutomationTest::RunTest(const FString& /*Parameters*/)
{
	return ReportTestResultToAutomation(*this, HktOpcodeTests::Test_SpawnEntityAround_RandomSeeded_SpawnsN());
}

#endif // WITH_AUTOMATION_TESTS
