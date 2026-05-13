// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktAutomationTestsLog.h"
#include "HktAutomationTestsTypes.h"
#include "HktAutomationTestsHarness.h"
#include "HktStoryBuilder.h"
#include "HktCoreDefs.h"
#include "HktCoreProperties.h"
#include "HktWorldState.h"
#include "Terrain/HktRegionId.h"
#include "VM/HktVMProgram.h"
#include "Misc/AutomationTest.h"

namespace HktOpcodeTests
{

// ============================================================================
// Region 인프라 (PR-2) 검증
//
// Docs/Concepts/C01_TranquilWilds/Implementation-Plan.md §4 의 7 테스트:
//   1. RegionId 결정론 (양수 chunk)
//   2. RegionId 결정론 (음수 chunk)
//   3. MacroTile 그룹화 (TileSize 내 청크 동일 RegionId)
//   4. 다른 tile → 다른 RegionId
//   5. FindOrCreateRegionEntity creation
//   6. FindOrCreateRegionEntity cache hit
//   7. RegionAddScalar increment (VM 실행)
// ============================================================================

static FGameplayTag RegionTestStoryTag()
{
	return FGameplayTag::RequestGameplayTag(FName(TEXT("Test.Validation.Region")), false);
}

// 1. RegionId 결정론 — 같은 양수 chunk 좌표는 항상 같은 RegionId.
static FHktTestResult Test_RegionId_Deterministic_Positive()
{
	const uint32 Id1 = HktRegionId::FromChunkCoord(5, 7);
	const uint32 Id2 = HktRegionId::FromChunkCoord(5, 7);

	if (Id1 != Id2)
	{
		return FHktTestResult::Fail(TEXT("RegionId_Deterministic_Positive"),
			FString::Printf(TEXT("Id1=0x%08X != Id2=0x%08X for same chunk (5,7)"), Id1, Id2));
	}

	return FHktTestResult::Pass(TEXT("RegionId_Deterministic_Positive"));
}

// 2. RegionId 결정론 — 같은 음수 chunk 좌표도 항상 같은 RegionId.
static FHktTestResult Test_RegionId_Deterministic_Negative()
{
	const uint32 Id1 = HktRegionId::FromChunkCoord(-9, -3);
	const uint32 Id2 = HktRegionId::FromChunkCoord(-9, -3);

	if (Id1 != Id2)
	{
		return FHktTestResult::Fail(TEXT("RegionId_Deterministic_Negative"),
			FString::Printf(TEXT("Id1=0x%08X != Id2=0x%08X for same chunk (-9,-3)"), Id1, Id2));
	}

	// FloorDiv 의 음수 처리 — (-9, -3) 은 TileSize=8 기준 macro-tile (-2, -1).
	const HktRegionId::FHktMacroTile Tile = HktRegionId::ToMacroTile(-9, -3);
	if (Tile.X != -2 || Tile.Y != -1)
	{
		return FHktTestResult::Fail(TEXT("RegionId_Deterministic_Negative"),
			FString::Printf(TEXT("ToMacroTile(-9,-3) expected (-2,-1), got (%d,%d)"), Tile.X, Tile.Y));
	}

	return FHktTestResult::Pass(TEXT("RegionId_Deterministic_Negative"));
}

// 3. MacroTile 그룹화 — TileSize 안의 모든 청크는 동일 RegionId.
static FHktTestResult Test_RegionId_TileGrouping_SameTile()
{
	// TileSize=8 → chunk (16, 24) ~ (23, 31) 가 같은 macro-tile (2, 3) 에 속한다.
	const uint32 Anchor = HktRegionId::FromChunkCoord(16, 24);
	for (int32 X = 16; X < 16 + HktRegionId::DefaultTileSize; ++X)
	{
		for (int32 Y = 24; Y < 24 + HktRegionId::DefaultTileSize; ++Y)
		{
			const uint32 Id = HktRegionId::FromChunkCoord(X, Y);
			if (Id != Anchor)
			{
				return FHktTestResult::Fail(TEXT("RegionId_TileGrouping_SameTile"),
					FString::Printf(TEXT("Chunk (%d,%d) Id=0x%08X != anchor 0x%08X"), X, Y, Id, Anchor));
			}
		}
	}

	return FHktTestResult::Pass(TEXT("RegionId_TileGrouping_SameTile"));
}

// 4. 다른 tile → 다른 RegionId.
static FHktTestResult Test_RegionId_DifferentTile_DifferentId()
{
	const uint32 IdA = HktRegionId::FromChunkCoord(0, 0);             // tile (0,0)
	const uint32 IdB = HktRegionId::FromChunkCoord(8, 0);             // tile (1,0)
	const uint32 IdC = HktRegionId::FromChunkCoord(0, 8);             // tile (0,1)
	const uint32 IdD = HktRegionId::FromChunkCoord(-1, -1);           // tile (-1,-1)

	if (IdA == IdB || IdA == IdC || IdA == IdD || IdB == IdC || IdB == IdD || IdC == IdD)
	{
		return FHktTestResult::Fail(TEXT("RegionId_DifferentTile_DifferentId"),
			FString::Printf(TEXT("Distinct tiles should yield distinct ids: A=0x%08X B=0x%08X C=0x%08X D=0x%08X"),
				IdA, IdB, IdC, IdD));
	}

	return FHktTestResult::Pass(TEXT("RegionId_DifferentTile_DifferentId"));
}

// 5. FindOrCreateRegionEntity creation — 첫 호출 시 새 entity 생성 + Entity.Region 태그 부여.
static FHktTestResult Test_FindOrCreateRegion_Creation()
{
	FHktAutomationTestHarness H;
	H.Setup();

	const int32 InitialCount = H.GetEntityCount();
	const uint32 RegionId = HktRegionId::FromChunkCoord(3, 4);

	FHktEntityId RegionEntity = H.GetWorldState().FindOrCreateRegionEntity(RegionId);
	const int32 AfterCount = H.GetEntityCount();
	const bool bHasRegionTag = H.HasTag(RegionEntity, HktArchetypeTags::Entity_Region);

	H.Teardown();

	if (RegionEntity == InvalidEntityId)
	{
		return FHktTestResult::Fail(TEXT("FindOrCreateRegion_Creation"), TEXT("Returned InvalidEntityId"));
	}
	if (AfterCount != InitialCount + 1)
	{
		return FHktTestResult::Fail(TEXT("FindOrCreateRegion_Creation"),
			FString::Printf(TEXT("Entity count should grow by 1 (was %d, got %d)"), InitialCount, AfterCount));
	}
	if (!bHasRegionTag)
	{
		return FHktTestResult::Fail(TEXT("FindOrCreateRegion_Creation"),
			TEXT("Created region entity missing Entity.Region tag"));
	}

	return FHktTestResult::Pass(TEXT("FindOrCreateRegion_Creation"));
}

// 6. FindOrCreateRegionEntity cache hit — 같은 RegionId 두 번 호출 시 같은 entity 반환.
static FHktTestResult Test_FindOrCreateRegion_CacheHit()
{
	FHktAutomationTestHarness H;
	H.Setup();

	const uint32 RegionId = HktRegionId::FromChunkCoord(1, 1);
	FHktEntityId First  = H.GetWorldState().FindOrCreateRegionEntity(RegionId);
	const int32 AfterFirst = H.GetEntityCount();
	FHktEntityId Second = H.GetWorldState().FindOrCreateRegionEntity(RegionId);
	const int32 AfterSecond = H.GetEntityCount();

	// 다른 region 은 새 entity 가 만들어져야 한다 (cache 충돌 회귀 방지).
	const uint32 OtherId = HktRegionId::FromChunkCoord(100, 200);
	FHktEntityId Other = H.GetWorldState().FindOrCreateRegionEntity(OtherId);

	H.Teardown();

	if (First != Second)
	{
		return FHktTestResult::Fail(TEXT("FindOrCreateRegion_CacheHit"),
			FString::Printf(TEXT("Same RegionId should reuse entity (First=%d, Second=%d)"), First, Second));
	}
	if (AfterSecond != AfterFirst)
	{
		return FHktTestResult::Fail(TEXT("FindOrCreateRegion_CacheHit"),
			FString::Printf(TEXT("Cache hit must not allocate (count %d → %d)"), AfterFirst, AfterSecond));
	}
	if (Other == First)
	{
		return FHktTestResult::Fail(TEXT("FindOrCreateRegion_CacheHit"),
			TEXT("Distinct RegionId must return distinct entity"));
	}

	return FHktTestResult::Pass(TEXT("FindOrCreateRegion_CacheHit"));
}

// 7. RegionAddScalar increment — VM 실행으로 카운터 누적 검증.
static FHktTestResult Test_RegionAddScalar_Increment()
{
	FHktAutomationTestHarness H;
	H.Setup();

	const uint32 RegionId = HktRegionId::FromChunkCoord(2, 2);
	FHktEntityId RegionEntity = H.GetWorldState().FindOrCreateRegionEntity(RegionId);

	// Self 는 story 의 source — region entity 를 직접 Self 로 사용 (ExecuteProgram(Program, RegionEntity)).
	FHktStoryBuilder B = FHktStoryBuilder::Create(RegionTestStoryTag());
	B.RegionAddScalar(B.Self(), PropertyId::RegionBirchCount, 1);
	B.RegionAddScalar(B.Self(), PropertyId::RegionBirchCount, 1);
	B.RegionAddScalar(B.Self(), PropertyId::RegionBirchCount, 3);
	B.Halt();
	auto Program = B.Build();

	if (!Program.IsValid())
	{
		H.Teardown();
		return FHktTestResult::Fail(TEXT("RegionAddScalar_Increment"), TEXT("Program build failed"));
	}

	const int32 Before = H.GetProperty(RegionEntity, PropertyId::RegionBirchCount);
	EVMStatus Status = H.ExecuteProgram(Program, RegionEntity);
	const int32 After  = H.GetProperty(RegionEntity, PropertyId::RegionBirchCount);

	H.Teardown();

	if (Status != EVMStatus::Completed)
	{
		return FHktTestResult::Fail(TEXT("RegionAddScalar_Increment"),
			FString::Printf(TEXT("Program did not Complete (Status=%d)"), static_cast<int32>(Status)));
	}
	if (Before != 0)
	{
		return FHktTestResult::Fail(TEXT("RegionAddScalar_Increment"),
			FString::Printf(TEXT("Initial counter should be 0, got %d"), Before));
	}
	if (After != 5)
	{
		return FHktTestResult::Fail(TEXT("RegionAddScalar_Increment"),
			FString::Printf(TEXT("Expected counter 5 (1+1+3), got %d"), After));
	}

	return FHktTestResult::Pass(TEXT("RegionAddScalar_Increment"));
}

// ============================================================================
// Public
// ============================================================================

FHktTestReport RunRegionTests()
{
	FHktTestReport Report;
	Report.Add(Test_RegionId_Deterministic_Positive());
	Report.Add(Test_RegionId_Deterministic_Negative());
	Report.Add(Test_RegionId_TileGrouping_SameTile());
	Report.Add(Test_RegionId_DifferentTile_DifferentId());
	Report.Add(Test_FindOrCreateRegion_Creation());
	Report.Add(Test_FindOrCreateRegion_CacheHit());
	Report.Add(Test_RegionAddScalar_Increment());
	return Report;
}

} // namespace HktOpcodeTests

// ============================================================================
// UE Automation Framework wrappers
// ============================================================================

#if WITH_AUTOMATION_TESTS

namespace
{
	bool ReportRegionTestResult(FAutomationTestBase& Test, const FHktTestResult& Result)
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
	FHktRegionIdDeterministicPositiveAutomationTest,
	"HktCore.Region.RegionId.Deterministic.Positive",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktRegionIdDeterministicPositiveAutomationTest::RunTest(const FString& /*Parameters*/)
{
	return ReportRegionTestResult(*this, HktOpcodeTests::Test_RegionId_Deterministic_Positive());
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktRegionIdDeterministicNegativeAutomationTest,
	"HktCore.Region.RegionId.Deterministic.Negative",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktRegionIdDeterministicNegativeAutomationTest::RunTest(const FString& /*Parameters*/)
{
	return ReportRegionTestResult(*this, HktOpcodeTests::Test_RegionId_Deterministic_Negative());
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktRegionIdTileGroupingAutomationTest,
	"HktCore.Region.RegionId.TileGrouping.SameTile",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktRegionIdTileGroupingAutomationTest::RunTest(const FString& /*Parameters*/)
{
	return ReportRegionTestResult(*this, HktOpcodeTests::Test_RegionId_TileGrouping_SameTile());
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktRegionIdDifferentTileAutomationTest,
	"HktCore.Region.RegionId.DifferentTile.DifferentId",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktRegionIdDifferentTileAutomationTest::RunTest(const FString& /*Parameters*/)
{
	return ReportRegionTestResult(*this, HktOpcodeTests::Test_RegionId_DifferentTile_DifferentId());
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktFindOrCreateRegionCreationAutomationTest,
	"HktCore.Region.FindOrCreateRegion.Creation",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktFindOrCreateRegionCreationAutomationTest::RunTest(const FString& /*Parameters*/)
{
	return ReportRegionTestResult(*this, HktOpcodeTests::Test_FindOrCreateRegion_Creation());
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktFindOrCreateRegionCacheHitAutomationTest,
	"HktCore.Region.FindOrCreateRegion.CacheHit",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktFindOrCreateRegionCacheHitAutomationTest::RunTest(const FString& /*Parameters*/)
{
	return ReportRegionTestResult(*this, HktOpcodeTests::Test_FindOrCreateRegion_CacheHit());
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktRegionAddScalarIncrementAutomationTest,
	"HktCore.Region.RegionAddScalar.Increment",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktRegionAddScalarIncrementAutomationTest::RunTest(const FString& /*Parameters*/)
{
	return ReportRegionTestResult(*this, HktOpcodeTests::Test_RegionAddScalar_Increment());
}

#endif // WITH_AUTOMATION_TESTS
