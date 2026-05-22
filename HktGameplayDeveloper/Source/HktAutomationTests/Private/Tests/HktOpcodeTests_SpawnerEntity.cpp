// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktAutomationTestsLog.h"
#include "HktAutomationTestsTypes.h"
#include "HktAutomationTestsHarness.h"
#include "HktStoryBuilder.h"
#include "VM/HktVMProgram.h"
#include "HktWorldState.h"
#include "HktCoreDefs.h"
#include "HktCoreProperties.h"
#include "HktSimulationSystems.h"
#include "VM/HktVMWorldStateProxy.h"

/**
 * Spawner Entity — voxel-attribution slot 단위 lifecycle row.
 *
 * `FHktWorldState::FindOrCreateSpawner(SlotKey)` 가 Entity.Spawner 태그 + SpawnerSlotKey 컬럼
 * 매칭으로 SoA 선형 스캔 lazy create 함을 검증. VM `SpawnerFindOrCreate` opcode 도 동일
 * 경로로 동작.
 */
namespace HktOpcodeTests
{

namespace
{
	FGameplayTag SpawnerEntityTestTag()
	{
		return FGameplayTag::RequestGameplayTag(FName(TEXT("Test.Spawner.Entity")), false);
	}

	FHktTestResult Test_FindOrCreateSpawner_LazyCreate()
	{
		FHktAutomationTestHarness H;
		H.Setup();

		const uint32 SlotKey = 0x12345678u;
		const FHktEntityId Id = H.GetWorldState().FindOrCreateSpawner(SlotKey);
		if (!H.GetWorldState().IsValidEntity(Id))
		{
			H.Teardown();
			return FHktTestResult::Fail(TEXT("Spawner.LazyCreate"), TEXT("invalid entity returned"));
		}

		const bool bHasTag = H.GetWorldState().HasTag(Id, HktArchetypeTags::Entity_Spawner);
		const int32 KeyCol = H.GetWorldState().GetProperty(Id, PropertyId::SpawnerSlotKey);
		H.Teardown();

		if (!bHasTag)
			return FHktTestResult::Fail(TEXT("Spawner.LazyCreate"), TEXT("Entity.Spawner 태그 미부여"));
		if (static_cast<uint32>(KeyCol) != SlotKey)
			return FHktTestResult::Fail(TEXT("Spawner.LazyCreate"), TEXT("SpawnerSlotKey 컬럼 미적재"));

		return FHktTestResult::Pass(TEXT("Spawner.LazyCreate"));
	}

	FHktTestResult Test_FindOrCreateSpawner_CacheHit()
	{
		FHktAutomationTestHarness H;
		H.Setup();

		const uint32 SlotKey = 0xCAFEBABEu;
		const FHktEntityId First  = H.GetWorldState().FindOrCreateSpawner(SlotKey);
		const FHktEntityId Second = H.GetWorldState().FindOrCreateSpawner(SlotKey);
		H.Teardown();

		if (First != Second)
			return FHktTestResult::Fail(TEXT("Spawner.CacheHit"), TEXT("같은 SlotKey 가 두 row 를 만들었음"));

		return FHktTestResult::Pass(TEXT("Spawner.CacheHit"));
	}

	FHktTestResult Test_FindOrCreateSpawner_DistinctKeys()
	{
		FHktAutomationTestHarness H;
		H.Setup();

		const FHktEntityId A = H.GetWorldState().FindOrCreateSpawner(1);
		const FHktEntityId B = H.GetWorldState().FindOrCreateSpawner(2);
		H.Teardown();

		if (A == B)
			return FHktTestResult::Fail(TEXT("Spawner.DistinctKeys"), TEXT("서로 다른 SlotKey 가 동일 row 에 매핑됨"));

		return FHktTestResult::Pass(TEXT("Spawner.DistinctKeys"));
	}

	// 회귀 가드: spawner entity 는 *virtual* row 라 gravity / chunk preload 등 simulation
	// 시스템에서 skip 되어야 한다. 옛 Region entity 가 같은 함정에서 PosZ 무한 하락 +
	// 매 프레임 PropertyDelta replication 노이즈를 유발했었음.
	FHktTestResult Test_SpawnerEntity_NotSimulated()
	{
		FHktAutomationTestHarness H;
		H.Setup();

		const FHktEntityId Spawner = H.GetWorldState().FindOrCreateSpawner(0xABCDu);
		// 일반 entity 대비
		const FHktEntityId Normal = H.CreateEntity();

		const bool bSpawnerSim = H.GetWorldState().IsSimulatedEntity(Spawner);
		const bool bNormalSim  = H.GetWorldState().IsSimulatedEntity(Normal);

		// GravitySystem 을 직접 한 프레임 돌려 spawner 의 VelZ / PosZ 가 변하지 않는지 검증
		const int32 InitialVelZ = H.GetWorldState().GetProperty(Spawner, PropertyId::VelZ);
		const int32 InitialPosZ = H.GetWorldState().GetProperty(Spawner, PropertyId::PosZ);

		FHktGravitySystem Gravity;
		Gravity.Process(H.GetWorldState(), H.GetVMProxy());

		const int32 AfterVelZ = H.GetWorldState().GetProperty(Spawner, PropertyId::VelZ);
		const int32 AfterPosZ = H.GetWorldState().GetProperty(Spawner, PropertyId::PosZ);
		H.Teardown();

		if (bSpawnerSim)
			return FHktTestResult::Fail(TEXT("Spawner.NotSimulated"), TEXT("IsSimulatedEntity(spawner) 가 true — virtual entity 검사 누락"));
		if (!bNormalSim)
			return FHktTestResult::Fail(TEXT("Spawner.NotSimulated"), TEXT("IsSimulatedEntity(normal) 가 false — 일반 entity 가 잘못 skip"));
		if (AfterVelZ != InitialVelZ)
			return FHktTestResult::Fail(TEXT("Spawner.NotSimulated"), TEXT("GravitySystem 이 spawner 의 VelZ 를 변경 — 매 프레임 PropertyDelta 노이즈 회귀"));
		if (AfterPosZ != InitialPosZ)
			return FHktTestResult::Fail(TEXT("Spawner.NotSimulated"), TEXT("spawner 의 PosZ 가 변경 — virtual entity 가 떨어짐"));

		return FHktTestResult::Pass(TEXT("Spawner.NotSimulated"));
	}

	FHktTestResult Test_SpawnerFindOrCreate_VM()
	{
		FHktAutomationTestHarness H;
		H.Setup();
		FHktEntityId Self = H.CreateEntity();

		FHktStoryBuilder B = FHktStoryBuilder::Create(SpawnerEntityTestTag());
		FHktVar SlotKeyVar = B.NewVar(TEXT("slotKey"));
		B.LoadConst(SlotKeyVar, 0x77777777);
		B.SpawnerFindOrCreate(SlotKeyVar);
		B.Halt();
		auto Program = B.Build();

		const EVMStatus Status = H.ExecuteProgram(Program, Self);

		// VM 실행 후 동일 SlotKey 로 다시 호출 — 새 row 가 만들어지면 안 되고 기존 row 반환되어야 한다
		const int32 BeforeCount = H.GetEntityCount();
		const FHktEntityId Resolved = H.GetWorldState().FindOrCreateSpawner(0x77777777u);
		const int32 AfterCount = H.GetEntityCount();
		const bool bHasTag = H.GetWorldState().HasTag(Resolved, HktArchetypeTags::Entity_Spawner);
		H.Teardown();

		if (Status != EVMStatus::Completed)
			return FHktTestResult::Fail(TEXT("Spawner.VM"), TEXT("Expected Completed"));
		if (!bHasTag)
			return FHktTestResult::Fail(TEXT("Spawner.VM"), TEXT("VM 실행 후 spawner row 의 태그 미부여"));
		if (BeforeCount != AfterCount)
			return FHktTestResult::Fail(TEXT("Spawner.VM"), TEXT("VM 이 row 를 만들지 않아 후속 FindOrCreate 가 new row 발급 — lazy create 누락"));

		return FHktTestResult::Pass(TEXT("Spawner.VM"));
	}
}

FHktTestReport RunSpawnerEntityTests()
{
	FHktTestReport Report;
	Report.Add(Test_FindOrCreateSpawner_LazyCreate());
	Report.Add(Test_FindOrCreateSpawner_CacheHit());
	Report.Add(Test_FindOrCreateSpawner_DistinctKeys());
	Report.Add(Test_SpawnerEntity_NotSimulated());
	Report.Add(Test_SpawnerFindOrCreate_VM());
	return Report;
}

} // namespace HktOpcodeTests
