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
// Region Map (PR-3) — entity-per-record 검증
//
// 04-region-state.md §3-D4 (entity-per-record) + Implementation-Plan §5.1-F 의 6 테스트:
//   1. RegionMapFindOrCreate creation — record row + RegionIdKey + RecordKey + tag
//   2. RegionMapFindOrCreate cache hit — 같은 (RegionId, Tag, Key) → 같은 entity
//   3. multi-key isolation — 같은 region 의 LineageId=42 / 137 → 다른 row
//   4. cross-region isolation — region A 의 42 와 region B 의 42 → 다른 row
//   5. RegionMapWrite VM 실행 — Builder helper 가 emit 한 시퀀스로 값 갱신
//   6. RegionMapRead lazy create — read-before-create 시 row 자동 생성 + default 0
// ============================================================================

static FGameplayTag RegionMapTestStoryTag()
{
	return FGameplayTag::RequestGameplayTag(FName(TEXT("Test.Validation.RegionMap")), false);
}

// 1. RegionMapFindOrCreate creation — 첫 호출 시 record row + 4-컬럼 설정.
static FHktTestResult Test_RegionMapFindOrCreate_Creation()
{
	FHktAutomationTestHarness H;
	H.Setup();

	const uint32 RegionId = HktRegionId::FromChunkCoord(1, 1);
	const uint32 LineageKey = 42;
	FHktWorldState& WS = H.GetWorldState();
	(void)WS.FindOrCreateRegionEntity(RegionId);

	const int32 BeforeCount = H.GetEntityCount();
	FHktEntityId Record = WS.FindOrCreateRegionRecord(
		RegionId, HktArchetypeTags::Entity_RegionRecord_Lineage, LineageKey);
	const int32 AfterCount = H.GetEntityCount();

	const int32 StoredRegion = WS.GetProperty(Record, PropertyId::RegionIdKey);
	const int32 StoredKey    = WS.GetProperty(Record, PropertyId::RecordKey);
	const bool bHasLeafTag   = H.HasTag(Record, HktArchetypeTags::Entity_RegionRecord_Lineage);
	const bool bHasParentTag = H.HasTag(Record, HktArchetypeTags::Entity_RegionRecord);

	H.Teardown();

	if (Record == InvalidEntityId)
	{
		return FHktTestResult::Fail(TEXT("RegionMapFindOrCreate_Creation"), TEXT("Returned InvalidEntityId"));
	}
	if (AfterCount != BeforeCount + 1)
	{
		return FHktTestResult::Fail(TEXT("RegionMapFindOrCreate_Creation"),
			FString::Printf(TEXT("Entity count should grow by 1 (was %d, got %d)"), BeforeCount, AfterCount));
	}
	if (StoredRegion != static_cast<int32>(RegionId))
	{
		return FHktTestResult::Fail(TEXT("RegionMapFindOrCreate_Creation"),
			FString::Printf(TEXT("RegionIdKey expected 0x%08X, got 0x%08X"), RegionId, StoredRegion));
	}
	if (StoredKey != static_cast<int32>(LineageKey))
	{
		return FHktTestResult::Fail(TEXT("RegionMapFindOrCreate_Creation"),
			FString::Printf(TEXT("RecordKey expected %u, got %d"), LineageKey, StoredKey));
	}
	if (!bHasLeafTag || !bHasParentTag)
	{
		return FHktTestResult::Fail(TEXT("RegionMapFindOrCreate_Creation"),
			FString::Printf(TEXT("Record entity missing tags (leaf=%d parent=%d)"), bHasLeafTag, bHasParentTag));
	}

	return FHktTestResult::Pass(TEXT("RegionMapFindOrCreate_Creation"));
}

// 2. RegionMapFindOrCreate cache hit — 같은 (Region, Tag, Key) → 같은 entity.
static FHktTestResult Test_RegionMapFindOrCreate_CacheHit()
{
	FHktAutomationTestHarness H;
	H.Setup();

	const uint32 RegionId = HktRegionId::FromChunkCoord(2, 2);
	const uint32 LineageKey = 99;
	FHktWorldState& WS = H.GetWorldState();
	(void)WS.FindOrCreateRegionEntity(RegionId);

	FHktEntityId First  = WS.FindOrCreateRegionRecord(RegionId, HktArchetypeTags::Entity_RegionRecord_Lineage, LineageKey);
	const int32 AfterFirst = H.GetEntityCount();
	FHktEntityId Second = WS.FindOrCreateRegionRecord(RegionId, HktArchetypeTags::Entity_RegionRecord_Lineage, LineageKey);
	const int32 AfterSecond = H.GetEntityCount();

	H.Teardown();

	if (First != Second)
	{
		return FHktTestResult::Fail(TEXT("RegionMapFindOrCreate_CacheHit"),
			FString::Printf(TEXT("Same key should reuse entity (First=%d, Second=%d)"), First, Second));
	}
	if (AfterSecond != AfterFirst)
	{
		return FHktTestResult::Fail(TEXT("RegionMapFindOrCreate_CacheHit"),
			FString::Printf(TEXT("Cache hit must not allocate (count %d → %d)"), AfterFirst, AfterSecond));
	}

	return FHktTestResult::Pass(TEXT("RegionMapFindOrCreate_CacheHit"));
}

// 3. multi-key isolation — 같은 region 에서 LineageId=42 / 137 이 별도 row.
static FHktTestResult Test_RegionMapFindOrCreate_MultiKey()
{
	FHktAutomationTestHarness H;
	H.Setup();

	const uint32 RegionId = HktRegionId::FromChunkCoord(3, 3);
	FHktWorldState& WS = H.GetWorldState();
	(void)WS.FindOrCreateRegionEntity(RegionId);

	FHktEntityId R42  = WS.FindOrCreateRegionRecord(RegionId, HktArchetypeTags::Entity_RegionRecord_Lineage, 42);
	FHktEntityId R137 = WS.FindOrCreateRegionRecord(RegionId, HktArchetypeTags::Entity_RegionRecord_Lineage, 137);

	// 각 record 에 별도 값을 기록해 독립 누적 검증.
	WS.SetProperty(R42,  PropertyId::LineageFelledCount, 3);
	WS.SetProperty(R137, PropertyId::LineageFelledCount, 7);

	const int32 V42  = WS.GetProperty(R42,  PropertyId::LineageFelledCount);
	const int32 V137 = WS.GetProperty(R137, PropertyId::LineageFelledCount);

	H.Teardown();

	if (R42 == R137)
	{
		return FHktTestResult::Fail(TEXT("RegionMapFindOrCreate_MultiKey"),
			FString::Printf(TEXT("Distinct keys must yield distinct entities (R42=%d == R137=%d)"), R42, R137));
	}
	if (V42 != 3 || V137 != 7)
	{
		return FHktTestResult::Fail(TEXT("RegionMapFindOrCreate_MultiKey"),
			FString::Printf(TEXT("Independent counters expected (3,7) got (%d,%d)"), V42, V137));
	}

	return FHktTestResult::Pass(TEXT("RegionMapFindOrCreate_MultiKey"));
}

// 4. cross-region isolation — region A 의 Key=42 와 region B 의 Key=42 가 별도 row.
static FHktTestResult Test_RegionMapFindOrCreate_CrossRegion()
{
	FHktAutomationTestHarness H;
	H.Setup();

	const uint32 RegionA = HktRegionId::FromChunkCoord(0, 0);
	const uint32 RegionB = HktRegionId::FromChunkCoord(100, 200);  // 다른 macro-tile 보장
	const uint32 SharedKey = 42;
	FHktWorldState& WS = H.GetWorldState();
	(void)WS.FindOrCreateRegionEntity(RegionA);
	(void)WS.FindOrCreateRegionEntity(RegionB);

	FHktEntityId RecA = WS.FindOrCreateRegionRecord(RegionA, HktArchetypeTags::Entity_RegionRecord_Lineage, SharedKey);
	FHktEntityId RecB = WS.FindOrCreateRegionRecord(RegionB, HktArchetypeTags::Entity_RegionRecord_Lineage, SharedKey);

	WS.SetProperty(RecA, PropertyId::LineagePromotedCount, 1);
	WS.SetProperty(RecB, PropertyId::LineagePromotedCount, 2);

	const int32 PA = WS.GetProperty(RecA, PropertyId::LineagePromotedCount);
	const int32 PB = WS.GetProperty(RecB, PropertyId::LineagePromotedCount);

	H.Teardown();

	if (RecA == RecB)
	{
		return FHktTestResult::Fail(TEXT("RegionMapFindOrCreate_CrossRegion"),
			TEXT("Same key in distinct regions must yield distinct entities"));
	}
	if (PA != 1 || PB != 2)
	{
		return FHktTestResult::Fail(TEXT("RegionMapFindOrCreate_CrossRegion"),
			FString::Printf(TEXT("Independent values expected (1,2) got (%d,%d)"), PA, PB));
	}

	return FHktTestResult::Pass(TEXT("RegionMapFindOrCreate_CrossRegion"));
}

// 5. RegionMapWrite — Builder helper 가 emit 한 RegionMapFindOrCreate + SaveStoreEntity 시퀀스가
//    VM 실행으로 record 컬럼을 정확히 갱신하는지 검증.
static FHktTestResult Test_RegionMapWrite_VMExecution()
{
	FHktAutomationTestHarness H;
	H.Setup();

	const uint32 RegionId = HktRegionId::FromChunkCoord(5, 5);
	FHktEntityId RegionEntity = H.GetWorldState().FindOrCreateRegionEntity(RegionId);

	// story: LineageKey 를 vreg 에 적재 → 값 vreg 에 적재 → RegionMapWrite.
	// Self = RegionEntity (story 진입 anchor).
	FHktStoryBuilder B = FHktStoryBuilder::Create(RegionMapTestStoryTag());
	FHktVar KeyVar   = B.NewVar(TEXT("LineageKey"));
	FHktVar ValueVar = B.NewVar(TEXT("FelledDelta"));
	B.LoadConst(KeyVar, 42);
	B.LoadConst(ValueVar, 5);
	B.RegionMapWrite(B.Self(), HktArchetypeTags::Entity_RegionRecord_Lineage, KeyVar, PropertyId::LineageFelledCount, ValueVar);
	B.Halt();
	auto Program = B.Build();

	if (!Program.IsValid())
	{
		H.Teardown();
		return FHktTestResult::Fail(TEXT("RegionMapWrite_VMExecution"), TEXT("Program build failed"));
	}

	EVMStatus Status = H.ExecuteProgram(Program, RegionEntity);

	// VM 실행 후 record 가 생성되었고, LineageFelledCount=5 가 기록되어야 한다.
	FHktEntityId Record = H.GetWorldState().FindOrCreateRegionRecord(
		RegionId, HktArchetypeTags::Entity_RegionRecord_Lineage, 42);
	const int32 Stored = H.GetWorldState().GetProperty(Record, PropertyId::LineageFelledCount);

	H.Teardown();

	if (Status != EVMStatus::Completed)
	{
		return FHktTestResult::Fail(TEXT("RegionMapWrite_VMExecution"),
			FString::Printf(TEXT("Program did not Complete (Status=%d)"), static_cast<int32>(Status)));
	}
	if (Stored != 5)
	{
		return FHktTestResult::Fail(TEXT("RegionMapWrite_VMExecution"),
			FString::Printf(TEXT("Expected LineageFelledCount=5, got %d"), Stored));
	}

	return FHktTestResult::Pass(TEXT("RegionMapWrite_VMExecution"));
}

// 6. RegionMapRead lazy create — 처음 read 호출 시 record 가 자동 생성되고 default 0 반환.
//    동시에 Builder 가 emit 한 RegionMapFindOrCreate + LoadStoreEntity 가 VM 에서 정확히 실행됨을 검증.
static FHktTestResult Test_RegionMapRead_LazyCreate()
{
	FHktAutomationTestHarness H;
	H.Setup();

	const uint32 RegionId = HktRegionId::FromChunkCoord(6, 7);
	FHktEntityId RegionEntity = H.GetWorldState().FindOrCreateRegionEntity(RegionId);
	const int32 CountBeforeStory = H.GetEntityCount();

	// story: RegionMapRead 만 — 기존 record 가 없으므로 lazy create 가 발생해야 한다.
	FHktStoryBuilder B = FHktStoryBuilder::Create(RegionMapTestStoryTag());
	FHktVar KeyVar = B.NewVar(TEXT("VariantKey"));
	FHktVar OutVar = B.NewVar(TEXT("Potency"));
	B.LoadConst(KeyVar, 7);
	B.RegionMapRead(OutVar, B.Self(), HktArchetypeTags::Entity_RegionRecord_Variant, KeyVar, PropertyId::VariantPotency);
	// OutVar 를 RegionEntity 의 LineageElderPosZ 컬럼에 저장 (검증용 — RegionEntity 는 RegionRecord 가 아니지만 SoA 컬럼은 공유 가능).
	B.SaveStoreEntity(B.Self(), PropertyId::LineageElderPosZ, OutVar);
	B.Halt();
	auto Program = B.Build();

	if (!Program.IsValid())
	{
		H.Teardown();
		return FHktTestResult::Fail(TEXT("RegionMapRead_LazyCreate"), TEXT("Program build failed"));
	}

	EVMStatus Status = H.ExecuteProgram(Program, RegionEntity);

	const int32 CountAfterStory = H.GetEntityCount();
	const int32 ReadValue = H.GetWorldState().GetProperty(RegionEntity, PropertyId::LineageElderPosZ);

	// 추가 검증: 실제로 record 가 만들어졌고 RegionIdKey/RecordKey 가 일치한다.
	FHktEntityId Record = H.GetWorldState().FindOrCreateRegionRecord(
		RegionId, HktArchetypeTags::Entity_RegionRecord_Variant, 7);
	const int32 CountAfterLookup = H.GetEntityCount();  // 같은 키로 한번 더 호출 — 추가 row 생기면 안 됨.

	H.Teardown();

	if (Status != EVMStatus::Completed)
	{
		return FHktTestResult::Fail(TEXT("RegionMapRead_LazyCreate"),
			FString::Printf(TEXT("Program did not Complete (Status=%d)"), static_cast<int32>(Status)));
	}
	if (CountAfterStory != CountBeforeStory + 1)
	{
		return FHktTestResult::Fail(TEXT("RegionMapRead_LazyCreate"),
			FString::Printf(TEXT("Expected +1 entity from lazy create (was %d, got %d)"), CountBeforeStory, CountAfterStory));
	}
	if (ReadValue != 0)
	{
		return FHktTestResult::Fail(TEXT("RegionMapRead_LazyCreate"),
			FString::Printf(TEXT("Expected default 0 on first read, got %d"), ReadValue));
	}
	if (CountAfterLookup != CountAfterStory)
	{
		return FHktTestResult::Fail(TEXT("RegionMapRead_LazyCreate"),
			FString::Printf(TEXT("Re-lookup with same key should not allocate (was %d, got %d)"), CountAfterStory, CountAfterLookup));
	}
	if (Record == InvalidEntityId)
	{
		return FHktTestResult::Fail(TEXT("RegionMapRead_LazyCreate"), TEXT("Subsequent lookup returned InvalidEntityId"));
	}

	return FHktTestResult::Pass(TEXT("RegionMapRead_LazyCreate"));
}

// ============================================================================
// Public
// ============================================================================

FHktTestReport RunRegionMapTests()
{
	FHktTestReport Report;
	Report.Add(Test_RegionMapFindOrCreate_Creation());
	Report.Add(Test_RegionMapFindOrCreate_CacheHit());
	Report.Add(Test_RegionMapFindOrCreate_MultiKey());
	Report.Add(Test_RegionMapFindOrCreate_CrossRegion());
	Report.Add(Test_RegionMapWrite_VMExecution());
	Report.Add(Test_RegionMapRead_LazyCreate());
	return Report;
}

} // namespace HktOpcodeTests

// ============================================================================
// UE Automation Framework wrappers
// ============================================================================

#if WITH_AUTOMATION_TESTS

namespace
{
	bool ReportRegionMapTestResult(FAutomationTestBase& Test, const FHktTestResult& Result)
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
	FHktRegionMapFindOrCreateCreationAutomationTest,
	"HktCore.RegionMap.FindOrCreate.Creation",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktRegionMapFindOrCreateCreationAutomationTest::RunTest(const FString& /*Parameters*/)
{
	return ReportRegionMapTestResult(*this, HktOpcodeTests::Test_RegionMapFindOrCreate_Creation());
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktRegionMapFindOrCreateCacheHitAutomationTest,
	"HktCore.RegionMap.FindOrCreate.CacheHit",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktRegionMapFindOrCreateCacheHitAutomationTest::RunTest(const FString& /*Parameters*/)
{
	return ReportRegionMapTestResult(*this, HktOpcodeTests::Test_RegionMapFindOrCreate_CacheHit());
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktRegionMapFindOrCreateMultiKeyAutomationTest,
	"HktCore.RegionMap.FindOrCreate.MultiKey",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktRegionMapFindOrCreateMultiKeyAutomationTest::RunTest(const FString& /*Parameters*/)
{
	return ReportRegionMapTestResult(*this, HktOpcodeTests::Test_RegionMapFindOrCreate_MultiKey());
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktRegionMapFindOrCreateCrossRegionAutomationTest,
	"HktCore.RegionMap.FindOrCreate.CrossRegion",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktRegionMapFindOrCreateCrossRegionAutomationTest::RunTest(const FString& /*Parameters*/)
{
	return ReportRegionMapTestResult(*this, HktOpcodeTests::Test_RegionMapFindOrCreate_CrossRegion());
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktRegionMapWriteVMExecutionAutomationTest,
	"HktCore.RegionMap.Write.VMExecution",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktRegionMapWriteVMExecutionAutomationTest::RunTest(const FString& /*Parameters*/)
{
	return ReportRegionMapTestResult(*this, HktOpcodeTests::Test_RegionMapWrite_VMExecution());
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktRegionMapReadLazyCreateAutomationTest,
	"HktCore.RegionMap.Read.LazyCreate",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktRegionMapReadLazyCreateAutomationTest::RunTest(const FString& /*Parameters*/)
{
	return ReportRegionMapTestResult(*this, HktOpcodeTests::Test_RegionMapRead_LazyCreate());
}

#endif // WITH_AUTOMATION_TESTS
