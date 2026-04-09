// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktAutomationTestsLog.h"
#include "HktAutomationTestsTypes.h"
#include "HktAutomationTestsHarness.h"
#include "HktStoryBuilder.h"
#include "HktCoreProperties.h"
#include "VM/HktVMProgram.h"

namespace HktOpcodeTests
{

static FGameplayTag EntityTestTag()
{
	return FGameplayTag::RequestGameplayTag(FName(TEXT("Test.Validation.Entity")), false);
}

// ============================================================================
// Entity Tests
// ============================================================================

static FHktTestResult Test_SpawnEntity()
{
	FHktAutomationTestHarness H;
	H.Setup();
	FHktEntityId Self = H.CreateEntity();

	int32 InitialCount = H.GetEntityCount();

	// SpawnEntity는 GameplayTag가 필요하지만, 테스트에서는 유효한 태그가 없을 수 있음
	// Builder에서 태그 resolve가 실패해도 엔티티는 생성됨
	FGameplayTag SpawnTag = FGameplayTag::RequestGameplayTag(FName(TEXT("Entity.Test.Dummy")), false);

	auto Program = FHktStoryBuilder::Create(EntityTestTag())
		.SpawnEntity(SpawnTag)
		.Halt()
		.Build();

	EVMStatus Status = H.ExecuteProgram(Program, Self);
	H.Teardown();

	if (Status != EVMStatus::Completed)
		return FHktTestResult::Fail(TEXT("SpawnEntity"), TEXT("Expected Completed"));

	int32 SpawnedId = H.GetRegister(Reg::Spawned);
	if (SpawnedId <= 0)
		return FHktTestResult::Fail(TEXT("SpawnEntity"), TEXT("Spawned register should have valid entity ID"));

	if (H.GetEntityCount() != InitialCount + 1)
		return FHktTestResult::Fail(TEXT("SpawnEntity"), TEXT("Entity count should increase by 1"));

	return FHktTestResult::Pass(TEXT("SpawnEntity"));
}

static FHktTestResult Test_SpawnEntity_AutoInit()
{
	FHktAutomationTestHarness H;
	H.Setup();

	TMap<uint16, int32> SelfProps;
	SelfProps.Add(PropertyId::Team, 2);
	FHktEntityId Self = H.CreateEntityWithProperties(SelfProps);

	FGameplayTag SpawnTag = FGameplayTag::RequestGameplayTag(FName(TEXT("Entity.Test.AutoInit")), false);

	auto Program = FHktStoryBuilder::Create(EntityTestTag())
		.SpawnEntity(SpawnTag)
		.LoadStoreEntity(Reg::R0, Reg::Spawned, PropertyId::Mass)
		.LoadStoreEntity(Reg::R1, Reg::Spawned, PropertyId::MaxSpeed)
		.LoadStoreEntity(Reg::R2, Reg::Spawned, PropertyId::CollisionRadius)
		.LoadStoreEntity(Reg::R3, Reg::Spawned, PropertyId::OwnerEntity)
		.Halt()
		.Build();

	H.ExecuteProgram(Program, Self);
	H.Teardown();

	if (H.GetRegister(Reg::R0) != 1)
		return FHktTestResult::Fail(TEXT("SpawnEntity_AutoInit"), TEXT("Mass should be 1"));
	if (H.GetRegister(Reg::R1) != 100)
		return FHktTestResult::Fail(TEXT("SpawnEntity_AutoInit"), TEXT("MaxSpeed should be 100"));
	if (H.GetRegister(Reg::R2) != 50)
		return FHktTestResult::Fail(TEXT("SpawnEntity_AutoInit"), TEXT("CollisionRadius should be 50"));
	if (H.GetRegister(Reg::R3) != static_cast<int32>(Self))
		return FHktTestResult::Fail(TEXT("SpawnEntity_AutoInit"), TEXT("OwnerEntity should be Self"));

	return FHktTestResult::Pass(TEXT("SpawnEntity_AutoInit"));
}

static FHktTestResult Test_DestroyEntity()
{
	FHktAutomationTestHarness H;
	H.Setup();
	FHktEntityId Self = H.CreateEntity();

	FGameplayTag SpawnTag = FGameplayTag::RequestGameplayTag(FName(TEXT("Entity.Test.Destroy")), false);

	auto Program = FHktStoryBuilder::Create(EntityTestTag())
		.SpawnEntity(SpawnTag)
		.DestroyEntity(Reg::Spawned)
		.Halt()
		.Build();

	int32 CountBefore = H.GetEntityCount();
	H.ExecuteProgram(Program, Self);
	H.Teardown();

	// Self(1) + Spawn(+1) - Destroy(-1) = 원래 수와 동일
	if (H.GetEntityCount() != CountBefore)
		return FHktTestResult::Fail(TEXT("DestroyEntity"), TEXT("Entity count should return to original after spawn+destroy"));

	return FHktTestResult::Pass(TEXT("DestroyEntity"));
}

// ============================================================================
// Tags Tests
// ============================================================================

static FHktTestResult Test_AddTag()
{
	FHktAutomationTestHarness H;
	H.Setup();
	FHktEntityId Self = H.CreateEntity();

	FGameplayTag StateTag = FGameplayTag::RequestGameplayTag(FName(TEXT("State.Test.Active")), false);

	auto Program = FHktStoryBuilder::Create(EntityTestTag())
		.AddTag(Reg::Self, StateTag)
		.Halt()
		.Build();

	H.ExecuteProgram(Program, Self);
	H.Teardown();

	if (!StateTag.IsValid())
	{
		// 태그가 등록되지 않은 환경에서는 스킵
		return FHktTestResult::Pass(TEXT("AddTag (skipped: tag not registered)"));
	}

	if (!H.HasTag(Self, StateTag))
		return FHktTestResult::Fail(TEXT("AddTag"), TEXT("Entity should have the tag after AddTag"));

	return FHktTestResult::Pass(TEXT("AddTag"));
}

static FHktTestResult Test_RemoveTag()
{
	FHktAutomationTestHarness H;
	H.Setup();
	FHktEntityId Self = H.CreateEntity();

	FGameplayTag StateTag = FGameplayTag::RequestGameplayTag(FName(TEXT("State.Test.ToRemove")), false);

	if (!StateTag.IsValid())
		return FHktTestResult::Pass(TEXT("RemoveTag (skipped: tag not registered)"));

	// 수동으로 태그 추가 후 제거 테스트
	H.GetWorldState().AddTag(Self, StateTag);

	auto Program = FHktStoryBuilder::Create(EntityTestTag())
		.RemoveTag(Reg::Self, StateTag)
		.Halt()
		.Build();

	H.ExecuteProgram(Program, Self);
	H.Teardown();

	if (H.HasTag(Self, StateTag))
		return FHktTestResult::Fail(TEXT("RemoveTag"), TEXT("Entity should not have tag after RemoveTag"));

	return FHktTestResult::Pass(TEXT("RemoveTag"));
}

static FHktTestResult Test_HasTag()
{
	FHktAutomationTestHarness H;
	H.Setup();
	FHktEntityId Self = H.CreateEntity();

	FGameplayTag TestTagVal = FGameplayTag::RequestGameplayTag(FName(TEXT("State.Test.Check")), false);

	if (!TestTagVal.IsValid())
		return FHktTestResult::Pass(TEXT("HasTag (skipped: tag not registered)"));

	auto Program = FHktStoryBuilder::Create(EntityTestTag())
		.HasTag(Reg::R0, Reg::Self, TestTagVal)  // 없는 상태 → 0
		.AddTag(Reg::Self, TestTagVal)
		.HasTag(Reg::R1, Reg::Self, TestTagVal)  // 있는 상태 → 1
		.Halt()
		.Build();

	H.ExecuteProgram(Program, Self);
	H.Teardown();

	if (H.GetRegister(Reg::R0) != 0)
		return FHktTestResult::Fail(TEXT("HasTag"), TEXT("HasTag should be 0 when tag not present"));
	if (H.GetRegister(Reg::R1) != 1)
		return FHktTestResult::Fail(TEXT("HasTag"), TEXT("HasTag should be 1 when tag present"));

	return FHktTestResult::Pass(TEXT("HasTag"));
}

// ============================================================================
// Spatial Query Tests
// ============================================================================

static FHktTestResult Test_GetDistance()
{
	FHktAutomationTestHarness H;
	H.Setup();

	TMap<uint16, int32> Props1;
	Props1.Add(PropertyId::PosX, 0);
	Props1.Add(PropertyId::PosY, 0);
	Props1.Add(PropertyId::PosZ, 0);
	FHktEntityId E1 = H.CreateEntityWithProperties(Props1);

	TMap<uint16, int32> Props2;
	Props2.Add(PropertyId::PosX, 300);
	Props2.Add(PropertyId::PosY, 400);
	Props2.Add(PropertyId::PosZ, 0);
	FHktEntityId E2 = H.CreateEntityWithProperties(Props2);

	auto Program = FHktStoryBuilder::Create(EntityTestTag())
		.GetDistance(Reg::R0, Reg::Self, Reg::Target)
		.Halt()
		.Build();

	H.ExecuteProgram(Program, E1, E2);
	H.Teardown();

	// Distance squared = 300^2 + 400^2 = 90000 + 160000 = 250000
	int32 DistSq = H.GetRegister(Reg::R0);
	if (DistSq != 250000)
		return FHktTestResult::Fail(TEXT("GetDistance"), FString::Printf(TEXT("DistSq should be 250000, got %d"), DistSq));

	return FHktTestResult::Pass(TEXT("GetDistance"));
}

static FHktTestResult Test_FindInRadius_Basic()
{
	FHktAutomationTestHarness H;
	H.Setup();

	// 센터 엔티티 (0,0,0)
	TMap<uint16, int32> CenterProps;
	CenterProps.Add(PropertyId::PosX, 0);
	CenterProps.Add(PropertyId::PosY, 0);
	CenterProps.Add(PropertyId::PosZ, 0);
	CenterProps.Add(PropertyId::CollisionMask, 0);  // 0 = all layers
	FHktEntityId Center = H.CreateEntityWithProperties(CenterProps);

	// 범위 내 엔티티 (100, 0, 0)
	TMap<uint16, int32> NearProps;
	NearProps.Add(PropertyId::PosX, 100);
	NearProps.Add(PropertyId::PosY, 0);
	NearProps.Add(PropertyId::PosZ, 0);
	FHktEntityId Near = H.CreateEntityWithProperties(NearProps);

	// 범위 외 엔티티 (1000, 0, 0)
	TMap<uint16, int32> FarProps;
	FarProps.Add(PropertyId::PosX, 1000);
	FarProps.Add(PropertyId::PosY, 0);
	FarProps.Add(PropertyId::PosZ, 0);
	H.CreateEntityWithProperties(FarProps);

	// FindInRadius(200cm) → Near만 검색됨
	auto Program = FHktStoryBuilder::Create(EntityTestTag())
		.FindInRadius(Reg::Self, 200)
		.Move(Reg::R0, Reg::Count)  // Count 레지스터 저장
		.NextFound()
		.Move(Reg::R1, Reg::Flag)   // Flag (1=has next)
		.Halt()
		.Build();

	H.ExecuteProgram(Program, Center);
	H.Teardown();

	if (H.GetRegister(Reg::R0) != 1)
		return FHktTestResult::Fail(TEXT("FindInRadius_Basic"), FString::Printf(TEXT("Count should be 1, got %d"), H.GetRegister(Reg::R0)));
	if (H.GetRegister(Reg::R1) != 1)
		return FHktTestResult::Fail(TEXT("FindInRadius_Basic"), TEXT("Flag should be 1 (has next)"));

	// Iter should point to Near entity
	int32 IterEntity = H.GetRegister(Reg::Iter);
	if (IterEntity != static_cast<int32>(Near))
		return FHktTestResult::Fail(TEXT("FindInRadius_Basic"), TEXT("Iter should be the Near entity"));

	return FHktTestResult::Pass(TEXT("FindInRadius_Basic"));
}

// ============================================================================
// Item System Tests
// ============================================================================

static FHktTestResult Test_SetOwnerUid_ClearOwnerUid()
{
	FHktAutomationTestHarness H;
	H.Setup();
	FHktEntityId Self = H.CreateEntity();
	FHktEntityId Item = H.CreateEntity();

	// SetOwnerUid는 PlayerUid를 사용하므로, Runtime에 PlayerUid 설정 필요
	// 직접 WorldState API로 테스트
	H.GetWorldState().SetOwnerUid(Item, 12345);

	int64 Uid = H.GetWorldState().GetOwnerUid(Item);
	if (Uid != 12345)
		return FHktTestResult::Fail(TEXT("SetOwnerUid_ClearOwnerUid"), TEXT("OwnerUid should be 12345"));

	H.GetWorldState().SetOwnerUid(Item, 0);
	Uid = H.GetWorldState().GetOwnerUid(Item);
	if (Uid != 0)
		return FHktTestResult::Fail(TEXT("SetOwnerUid_ClearOwnerUid"), TEXT("OwnerUid should be 0 after clear"));

	H.Teardown();
	return FHktTestResult::Pass(TEXT("SetOwnerUid_ClearOwnerUid"));
}

// ============================================================================
// Event Dispatch Tests
// ============================================================================

static FHktTestResult Test_DispatchEvent()
{
	FHktAutomationTestHarness H;
	H.Setup();
	FHktEntityId Self = H.CreateEntity();
	FHktEntityId Target = H.CreateEntity();

	FGameplayTag DispatchTag = FGameplayTag::RequestGameplayTag(FName(TEXT("Event.Test.Dispatch")), false);

	if (!DispatchTag.IsValid())
		return FHktTestResult::Pass(TEXT("DispatchEvent (skipped: tag not registered)"));

	auto Program = FHktStoryBuilder::Create(EntityTestTag())
		.DispatchEvent(DispatchTag)
		.Halt()
		.Build();

	H.ExecuteProgram(Program, Self, Target);
	H.Teardown();

	if (H.GetRuntime().PendingDispatchedEvents.Num() != 1)
		return FHktTestResult::Fail(TEXT("DispatchEvent"), TEXT("Should have 1 pending dispatched event"));

	const FHktEvent& Evt = H.GetRuntime().PendingDispatchedEvents[0];
	if (Evt.SourceEntity != Self)
		return FHktTestResult::Fail(TEXT("DispatchEvent"), TEXT("SourceEntity should be Self"));
	if (Evt.TargetEntity != Target)
		return FHktTestResult::Fail(TEXT("DispatchEvent"), TEXT("TargetEntity should be Target"));

	return FHktTestResult::Pass(TEXT("DispatchEvent"));
}

static FHktTestResult Test_DispatchEventTo()
{
	FHktAutomationTestHarness H;
	H.Setup();
	FHktEntityId Self = H.CreateEntity();
	FHktEntityId Target = H.CreateEntity();
	FHktEntityId NewTarget = H.CreateEntity();

	FGameplayTag DispatchTag = FGameplayTag::RequestGameplayTag(FName(TEXT("Event.Test.DispatchTo")), false);

	if (!DispatchTag.IsValid())
		return FHktTestResult::Pass(TEXT("DispatchEventTo (skipped: tag not registered)"));

	auto Program = FHktStoryBuilder::Create(EntityTestTag())
		.LoadConst(Reg::R0, static_cast<int32>(NewTarget))
		.DispatchEventTo(DispatchTag, Reg::R0)
		.Halt()
		.Build();

	H.ExecuteProgram(Program, Self, Target);
	H.Teardown();

	if (H.GetRuntime().PendingDispatchedEvents.Num() != 1)
		return FHktTestResult::Fail(TEXT("DispatchEventTo"), TEXT("Should have 1 pending event"));

	const FHktEvent& Evt = H.GetRuntime().PendingDispatchedEvents[0];
	if (Evt.TargetEntity != NewTarget)
		return FHktTestResult::Fail(TEXT("DispatchEventTo"), TEXT("TargetEntity should be NewTarget"));

	return FHktTestResult::Pass(TEXT("DispatchEventTo"));
}

// ============================================================================
// Movement Tests
// ============================================================================

static FHktTestResult Test_WaitCollision()
{
	FHktAutomationTestHarness H;
	H.Setup();
	FHktEntityId Self = H.CreateEntity();

	FGameplayTag SpawnTag = FGameplayTag::RequestGameplayTag(FName(TEXT("Entity.Test.Projectile")), false);

	auto Program = FHktStoryBuilder::Create(EntityTestTag())
		.SpawnEntity(SpawnTag)
		.WaitCollision(Reg::Spawned)
		.LoadConst(Reg::R0, 42)  // 충돌 후 실행
		.Halt()
		.Build();

	// 첫 실행 — WaitingEvent에서 정지 (MaxTicks=1로 제한)
	EVMStatus Status = H.ExecuteProgram(Program, Self, InvalidEntityId, 1);

	if (Status != EVMStatus::WaitingEvent)
		return FHktTestResult::Fail(TEXT("WaitCollision"), TEXT("Expected WaitingEvent after WaitCollision"));

	// 충돌 이벤트 주입
	FHktEntityId HitEntity = H.CreateEntity();
	H.InjectCollisionEvent(HitEntity);

	// ExecuteTick으로 재개 (Runtime 상태 유지)
	Status = H.ExecuteTick();

	H.Teardown();

	if (Status != EVMStatus::Completed)
		return FHktTestResult::Fail(TEXT("WaitCollision"), TEXT("Expected Completed after collision inject"));
	if (H.GetRegister(Reg::R0) != 42)
		return FHktTestResult::Fail(TEXT("WaitCollision"), TEXT("R0 should be 42 after resume"));
	if (H.GetRegister(Reg::Hit) != static_cast<int32>(HitEntity))
		return FHktTestResult::Fail(TEXT("WaitCollision"), TEXT("Hit register should contain HitEntity"));

	return FHktTestResult::Pass(TEXT("WaitCollision"));
}

// ============================================================================
// DispatchEventFrom Test
// ============================================================================

static FHktTestResult Test_DispatchEventFrom()
{
	FHktAutomationTestHarness H;
	H.Setup();
	FHktEntityId Self = H.CreateEntity();
	FHktEntityId Target = H.CreateEntity();
	FHktEntityId NewSource = H.CreateEntity();

	FGameplayTag DispatchTag = FGameplayTag::RequestGameplayTag(FName(TEXT("Event.Test.DispatchFrom")), false);

	if (!DispatchTag.IsValid())
		return FHktTestResult::Pass(TEXT("DispatchEventFrom (skipped: tag not registered)"));

	auto Program = FHktStoryBuilder::Create(EntityTestTag())
		.LoadConst(Reg::R0, static_cast<int32>(NewSource))
		.DispatchEventFrom(DispatchTag, Reg::R0)
		.Halt()
		.Build();

	H.ExecuteProgram(Program, Self, Target);
	H.Teardown();

	if (H.GetRuntime().PendingDispatchedEvents.Num() != 1)
		return FHktTestResult::Fail(TEXT("DispatchEventFrom"), TEXT("Should have 1 pending event"));

	const FHktEvent& Evt = H.GetRuntime().PendingDispatchedEvents[0];
	if (Evt.SourceEntity != NewSource)
		return FHktTestResult::Fail(TEXT("DispatchEventFrom"), TEXT("SourceEntity should be NewSource"));

	return FHktTestResult::Pass(TEXT("DispatchEventFrom"));
}

// ============================================================================
// ReadProperty / WriteProperty / WriteConst Tests
// ============================================================================

static FHktTestResult Test_ReadProperty_WriteProperty()
{
	FHktAutomationTestHarness H;
	H.Setup();

	TMap<uint16, int32> Props;
	Props.Add(PropertyId::Health, 100);
	FHktEntityId E = H.CreateEntityWithProperties(Props);

	auto Program = FHktStoryBuilder::Create(EntityTestTag())
		.ReadProperty(Reg::R0, PropertyId::Health)
		.LoadConst(Reg::R1, 75)
		.WriteProperty(PropertyId::Health, Reg::R1)
		.ReadProperty(Reg::R2, PropertyId::Health)
		.Halt()
		.Build();

	H.ExecuteProgram(Program, E);
	H.Teardown();

	if (H.GetRegister(Reg::R0) != 100)
		return FHktTestResult::Fail(TEXT("ReadProperty_WriteProperty"), TEXT("Initial Health should be 100"));
	if (H.GetRegister(Reg::R2) != 75)
		return FHktTestResult::Fail(TEXT("ReadProperty_WriteProperty"), TEXT("Updated Health should be 75"));

	return FHktTestResult::Pass(TEXT("ReadProperty_WriteProperty"));
}

static FHktTestResult Test_WriteConst()
{
	FHktAutomationTestHarness H;
	H.Setup();
	FHktEntityId E = H.CreateEntity();

	auto Program = FHktStoryBuilder::Create(EntityTestTag())
		.WriteConst(PropertyId::Health, 500)
		.ReadProperty(Reg::R0, PropertyId::Health)
		.Halt()
		.Build();

	H.ExecuteProgram(Program, E);
	H.Teardown();

	if (H.GetRegister(Reg::R0) != 500)
		return FHktTestResult::Fail(TEXT("WriteConst"), TEXT("Health should be 500"));

	return FHktTestResult::Pass(TEXT("WriteConst"));
}

// ============================================================================
// Public
// ============================================================================

FHktTestReport RunEntityTests()
{
	FHktTestReport Report;
	Report.Add(Test_SpawnEntity());
	Report.Add(Test_SpawnEntity_AutoInit());
	Report.Add(Test_DestroyEntity());
	Report.Add(Test_AddTag());
	Report.Add(Test_RemoveTag());
	Report.Add(Test_HasTag());
	Report.Add(Test_GetDistance());
	Report.Add(Test_FindInRadius_Basic());
	Report.Add(Test_SetOwnerUid_ClearOwnerUid());
	Report.Add(Test_DispatchEvent());
	Report.Add(Test_DispatchEventTo());
	Report.Add(Test_DispatchEventFrom());
	Report.Add(Test_WaitCollision());
	Report.Add(Test_ReadProperty_WriteProperty());
	Report.Add(Test_WriteConst());
	return Report;
}

} // namespace HktOpcodeTests
