// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktAutomationTestsLog.h"
#include "HktAutomationTestsTypes.h"
#include "HktAutomationTestsHarness.h"
#include "HktStoryBuilder.h"
#include "HktStoryEntryArgs.h"
#include "HktCoreProperties.h"
#include "VM/HktVMProgram.h"

namespace HktOpcodeTests
{

// ============================================================================
// Spawner Builder API 검증 (TerrainSpawner.design.md §4)
//
// 본 테스트는 §4-a (Spawner Context Builder 메서드) 와 §4-b (SpawnEntityAt/Around
// 헬퍼) 의 동작을 검증한다. 신규 opcode 가 추가되지 않았으므로 (§1-3 컴플라이언스)
// 테스트는 다음 두 축으로 분리한다:
//
//  1. Builder 시맨틱 — 동일 빌더 내에서 SpawnerOrigin/Biome/SlotHash/EntryArg* 가
//     같은 vreg 를 반환하는지 (entry-arg slot 단일 정의 보장).
//  2. 런타임 시맨틱 — SpawnEntityAt/Around 가 SpawnEntity + SetPosition 조합으로
//     올바른 위치에 엔티티를 생성하는지.
//
// VM 측 prefill (FHktStoryEntryArgs → entry-arg vreg) 은 M2 후속이므로, 본 테스트는
// 호출자가 LoadConst 로 명시 초기화하는 케이스만 다룬다.
// ============================================================================

static FGameplayTag SpawnerTestTag()
{
	return FGameplayTag::RequestGameplayTag(FName(TEXT("Test.Validation.Spawner")), false);
}

static FGameplayTag SpawnerEntityTag()
{
	return FGameplayTag::RequestGameplayTag(FName(TEXT("Entity.Test.Spawner")), false);
}

// ----------------------------------------------------------------------------
// Builder 시맨틱: vreg 캐싱
// ----------------------------------------------------------------------------

static FHktTestResult Test_SpawnerOrigin_Cached3SlotBlock()
{
	FHktStoryBuilder B = FHktStoryBuilder::Create(SpawnerTestTag());

	FHktVarBlock A = B.SpawnerOrigin();
	FHktVarBlock C = B.SpawnerOrigin();

	if (!A.IsValid())
		return FHktTestResult::Fail(TEXT("SpawnerOrigin_Cached3SlotBlock"), TEXT("First call should return valid block"));
	if (A.Num() != 3)
		return FHktTestResult::Fail(TEXT("SpawnerOrigin_Cached3SlotBlock"), TEXT("Block size should be 3"));
	if (A.Base().GetId() != C.Base().GetId() || A.Num() != C.Num())
		return FHktTestResult::Fail(TEXT("SpawnerOrigin_Cached3SlotBlock"), TEXT("Repeated calls should return cached block"));
	if (!A.Element(0).IsValid() || !A.Element(1).IsValid() || !A.Element(2).IsValid())
		return FHktTestResult::Fail(TEXT("SpawnerOrigin_Cached3SlotBlock"), TEXT("All 3 elements should be valid"));

	return FHktTestResult::Pass(TEXT("SpawnerOrigin_Cached3SlotBlock"));
}

static FHktTestResult Test_SpawnerBiome_CachedSingleVar()
{
	FHktStoryBuilder B = FHktStoryBuilder::Create(SpawnerTestTag());

	FHktVar A = B.SpawnerBiome();
	FHktVar C = B.SpawnerBiome();

	if (!A.IsValid())
		return FHktTestResult::Fail(TEXT("SpawnerBiome_CachedSingleVar"), TEXT("First call should return valid var"));
	if (A.GetId() != C.GetId())
		return FHktTestResult::Fail(TEXT("SpawnerBiome_CachedSingleVar"), TEXT("Repeated calls should return cached vreg"));

	return FHktTestResult::Pass(TEXT("SpawnerBiome_CachedSingleVar"));
}

static FHktTestResult Test_SpawnerSlotHash_CachedSingleVar()
{
	FHktStoryBuilder B = FHktStoryBuilder::Create(SpawnerTestTag());

	FHktVar A = B.SpawnerSlotHash();
	FHktVar C = B.SpawnerSlotHash();

	if (!A.IsValid())
		return FHktTestResult::Fail(TEXT("SpawnerSlotHash_CachedSingleVar"), TEXT("First call should return valid var"));
	if (A.GetId() != C.GetId())
		return FHktTestResult::Fail(TEXT("SpawnerSlotHash_CachedSingleVar"), TEXT("Repeated calls should return cached vreg"));

	return FHktTestResult::Pass(TEXT("SpawnerSlotHash_CachedSingleVar"));
}

static FHktTestResult Test_SpawnerContext_DistinctVRegs()
{
	FHktStoryBuilder B = FHktStoryBuilder::Create(SpawnerTestTag());

	FHktVarBlock Origin = B.SpawnerOrigin();
	FHktVar Biome = B.SpawnerBiome();
	FHktVar Hash = B.SpawnerSlotHash();

	// 세 entry-arg 는 서로 다른 vreg 여야 한다 — 같은 GP 에 동시 prefill 될 수 없으므로.
	if (Origin.Base().GetId() == Biome.GetId())
		return FHktTestResult::Fail(TEXT("SpawnerContext_DistinctVRegs"), TEXT("Origin and Biome must be distinct vregs"));
	if (Biome.GetId() == Hash.GetId())
		return FHktTestResult::Fail(TEXT("SpawnerContext_DistinctVRegs"), TEXT("Biome and SlotHash must be distinct vregs"));
	if (Origin.Base().GetId() == Hash.GetId())
		return FHktTestResult::Fail(TEXT("SpawnerContext_DistinctVRegs"), TEXT("Origin and SlotHash must be distinct vregs"));

	return FHktTestResult::Pass(TEXT("SpawnerContext_DistinctVRegs"));
}

static FHktTestResult Test_EntryArgInt_NamedCaching()
{
	FHktStoryBuilder B = FHktStoryBuilder::Create(SpawnerTestTag());

	FHktVar Radius1 = B.EntryArgInt(TEXT("TriggerRadius"));
	FHktVar Radius2 = B.EntryArgInt(TEXT("TriggerRadius"));
	FHktVar Count   = B.EntryArgInt(TEXT("Count"));

	if (!Radius1.IsValid() || !Count.IsValid())
		return FHktTestResult::Fail(TEXT("EntryArgInt_NamedCaching"), TEXT("Named entry args should be valid"));
	if (Radius1.GetId() != Radius2.GetId())
		return FHktTestResult::Fail(TEXT("EntryArgInt_NamedCaching"), TEXT("Same name should return cached vreg"));
	if (Radius1.GetId() == Count.GetId())
		return FHktTestResult::Fail(TEXT("EntryArgInt_NamedCaching"), TEXT("Different names should yield distinct vregs"));

	return FHktTestResult::Pass(TEXT("EntryArgInt_NamedCaching"));
}

static FHktTestResult Test_EntryArgTag_NamedCaching()
{
	FHktStoryBuilder B = FHktStoryBuilder::Create(SpawnerTestTag());

	FHktVar A = B.EntryArgTag(TEXT("EntityTag"));
	FHktVar C = B.EntryArgTag(TEXT("EntityTag"));

	if (!A.IsValid())
		return FHktTestResult::Fail(TEXT("EntryArgTag_NamedCaching"), TEXT("Tag entry arg should be valid"));
	if (A.GetId() != C.GetId())
		return FHktTestResult::Fail(TEXT("EntryArgTag_NamedCaching"), TEXT("Same name should return cached vreg"));

	return FHktTestResult::Pass(TEXT("EntryArgTag_NamedCaching"));
}

// ----------------------------------------------------------------------------
// 런타임 시맨틱: SpawnEntityAt / SpawnEntityAround
// ----------------------------------------------------------------------------

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
	// Builder 시맨틱
	Report.Add(Test_SpawnerOrigin_Cached3SlotBlock());
	Report.Add(Test_SpawnerBiome_CachedSingleVar());
	Report.Add(Test_SpawnerSlotHash_CachedSingleVar());
	Report.Add(Test_SpawnerContext_DistinctVRegs());
	Report.Add(Test_EntryArgInt_NamedCaching());
	Report.Add(Test_EntryArgTag_NamedCaching());
	// 런타임 시맨틱
	Report.Add(Test_SpawnEntityAt_PositionApplied());
	Report.Add(Test_SpawnEntityAround_Line_SpawnsN());
	Report.Add(Test_SpawnEntityAround_Circle_SpawnsN());
	Report.Add(Test_SpawnEntityAround_RandomSeeded_SpawnsN());
	return Report;
}

} // namespace HktOpcodeTests
