// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktAutomationTestsLog.h"
#include "HktAutomationTestsTypes.h"
#include "HktAutomationTestsHarness.h"
#include "HktStoryBuilder.h"
#include "HktStoryRegistry.h"
#include "HktCoreProperties.h"
#include "HktStoryEventParams.h"
#include "VM/HktVMProgram.h"
#include "VM/HktVMInterpreter.h"

/**
 * HktStoryScenarioTests — 등록된 Story를 실제 실행하여 기대 동작을 검증
 *
 * 각 테스트는:
 * 1. WorldState에 필요한 엔티티/속성을 셋업
 * 2. Registry에서 실제 Story 프로그램을 가져와 실행
 * 3. 실행 결과 (프로퍼티 변경, 엔티티 생성, 태그 등)를 Assert
 */
namespace HktStoryScenarioTests
{

// ============================================================================
// 헬퍼
// ============================================================================

static const FHktVMProgram* FindStory(const TCHAR* TagName)
{
	FGameplayTag Tag = FGameplayTag::RequestGameplayTag(FName(TagName), false);
	if (!Tag.IsValid()) return nullptr;
	return FHktVMProgramRegistry::Get().FindProgram(Tag);
}

static FHktTestResult SkipResult(const TCHAR* TestName, const TCHAR* Reason)
{
	return FHktTestResult::Pass(FString::Printf(TEXT("%s (skipped: %s)"), TestName, Reason));
}

// ============================================================================
// Heal: 체력 회복 + MaxHealth 클램핑
// ============================================================================

static FHktTestResult Test_Heal_Recovery()
{
	const TCHAR* Name = TEXT("Scenario_Heal_Recovery");
	const FHktVMProgram* Program = FindStory(TEXT("Story.Event.Skill.Heal"));
	if (!Program) return SkipResult(Name, TEXT("story not registered"));

	FHktAutomationTestHarness H;
	H.Setup();

	TMap<uint16, int32> Props;
	Props.Add(PropertyId::Health, 60);
	Props.Add(PropertyId::MaxHealth, 100);
	Props.Add(PropertyId::AttackSpeed, 100);
	Props.Add(PropertyId::NextActionFrame, 0);
	FHktEntityId Self = H.CreateEntityWithProperties(Props);

	// Param0 = HealAmount (0이면 기본 50 사용)
	EVMStatus Status = H.ExecuteProgram(Program, Self, InvalidEntityId, 500);
	H.Teardown();

	if (Status != EVMStatus::Completed)
		return FHktTestResult::Fail(Name, FString::Printf(TEXT("Expected Completed, got %d"), (int)Status));

	int32 Health = H.GetProperty(Self, PropertyId::Health);
	// Health=60 + HealAmount=50 = 110 → clamped to MaxHealth=100
	if (Health != 100)
		return FHktTestResult::Fail(Name, FString::Printf(TEXT("Health should be 100 (clamped), got %d"), Health));

	return FHktTestResult::Pass(Name);
}

static FHktTestResult Test_Heal_NoClamping()
{
	const TCHAR* Name = TEXT("Scenario_Heal_NoClamping");
	const FHktVMProgram* Program = FindStory(TEXT("Story.Event.Skill.Heal"));
	if (!Program) return SkipResult(Name, TEXT("story not registered"));

	FHktAutomationTestHarness H;
	H.Setup();

	TMap<uint16, int32> Props;
	Props.Add(PropertyId::Health, 30);
	Props.Add(PropertyId::MaxHealth, 200);
	Props.Add(PropertyId::AttackSpeed, 100);
	Props.Add(PropertyId::NextActionFrame, 0);
	FHktEntityId Self = H.CreateEntityWithProperties(Props);

	EVMStatus Status = H.ExecuteProgram(Program, Self, InvalidEntityId, 500);
	H.Teardown();

	if (Status != EVMStatus::Completed)
		return FHktTestResult::Fail(Name, TEXT("Expected Completed"));

	int32 Health = H.GetProperty(Self, PropertyId::Health);
	// Health=30 + 50 = 80 (< MaxHealth=200, no clamp)
	if (Health != 80)
		return FHktTestResult::Fail(Name, FString::Printf(TEXT("Health should be 80, got %d"), Health));

	return FHktTestResult::Pass(Name);
}

// ============================================================================
// Buff: 공격력 +10 증가
// ============================================================================

static FHktTestResult Test_Buff_AttackPowerIncrease()
{
	const TCHAR* Name = TEXT("Scenario_Buff_AttackPower");
	const FHktVMProgram* Program = FindStory(TEXT("Story.Event.Skill.Buff"));
	if (!Program) return SkipResult(Name, TEXT("story not registered"));

	FHktAutomationTestHarness H;
	H.Setup();

	TMap<uint16, int32> Props;
	Props.Add(PropertyId::AttackPower, 20);
	Props.Add(PropertyId::AttackSpeed, 100);
	Props.Add(PropertyId::NextActionFrame, 0);
	FHktEntityId Self = H.CreateEntityWithProperties(Props);

	EVMStatus Status = H.ExecuteProgram(Program, Self, InvalidEntityId, 500);
	H.Teardown();

	if (Status != EVMStatus::Completed)
		return FHktTestResult::Fail(Name, TEXT("Expected Completed"));

	int32 AtkPow = H.GetProperty(Self, PropertyId::AttackPower);
	if (AtkPow != 30)
		return FHktTestResult::Fail(Name, FString::Printf(TEXT("AttackPower should be 30 (20+10), got %d"), AtkPow));

	return FHktTestResult::Pass(Name);
}

// ============================================================================
// Lightning: 직격 80 + AoE 30 데미지
// ============================================================================

static FHktTestResult Test_Lightning_DirectDamage()
{
	const TCHAR* Name = TEXT("Scenario_Lightning_DirectDamage");
	const FHktVMProgram* Program = FindStory(TEXT("Story.Event.Skill.Lightning"));
	if (!Program) return SkipResult(Name, TEXT("story not registered"));

	FHktAutomationTestHarness H;
	H.Setup();

	// Caster
	TMap<uint16, int32> CasterProps;
	CasterProps.Add(PropertyId::AttackSpeed, 100);
	CasterProps.Add(PropertyId::NextActionFrame, 0);
	CasterProps.Add(PropertyId::PosX, 0);
	CasterProps.Add(PropertyId::PosY, 0);
	CasterProps.Add(PropertyId::PosZ, 0);
	FHktEntityId Caster = H.CreateEntityWithProperties(CasterProps);

	// Direct target
	TMap<uint16, int32> TargetProps;
	TargetProps.Add(PropertyId::Health, 200);
	TargetProps.Add(PropertyId::Defense, 0);
	TargetProps.Add(PropertyId::PosX, 100);
	TargetProps.Add(PropertyId::PosY, 0);
	TargetProps.Add(PropertyId::PosZ, 0);
	TargetProps.Add(PropertyId::CollisionMask, 0);
	FHktEntityId Target = H.CreateEntityWithProperties(TargetProps);

	EVMStatus Status = H.ExecuteProgram(Program, Caster, Target, 500);
	H.Teardown();

	if (Status != EVMStatus::Completed)
		return FHktTestResult::Fail(Name, TEXT("Expected Completed"));

	int32 TargetHealth = H.GetProperty(Target, PropertyId::Health);
	// Direct: 80 damage (Defense=0) → 200 - 80 = 120
	// AoE: Target is also within 200cm of itself? Actually FindInRadius excludes center entity.
	// So target health = 200 - 80 = 120
	if (TargetHealth != 120)
		return FHktTestResult::Fail(Name, FString::Printf(TEXT("Target Health should be 120, got %d"), TargetHealth));

	return FHktTestResult::Pass(Name);
}

static FHktTestResult Test_Lightning_AoEDamage()
{
	const TCHAR* Name = TEXT("Scenario_Lightning_AoE");
	const FHktVMProgram* Program = FindStory(TEXT("Story.Event.Skill.Lightning"));
	if (!Program) return SkipResult(Name, TEXT("story not registered"));

	FHktAutomationTestHarness H;
	H.Setup();

	// Caster (far away from target to not be in AoE)
	TMap<uint16, int32> CasterProps;
	CasterProps.Add(PropertyId::AttackSpeed, 100);
	CasterProps.Add(PropertyId::NextActionFrame, 0);
	CasterProps.Add(PropertyId::PosX, 1000);
	CasterProps.Add(PropertyId::PosY, 0);
	CasterProps.Add(PropertyId::PosZ, 0);
	FHktEntityId Caster = H.CreateEntityWithProperties(CasterProps);

	// Direct target at origin
	TMap<uint16, int32> TargetProps;
	TargetProps.Add(PropertyId::Health, 200);
	TargetProps.Add(PropertyId::Defense, 0);
	TargetProps.Add(PropertyId::PosX, 0);
	TargetProps.Add(PropertyId::PosY, 0);
	TargetProps.Add(PropertyId::PosZ, 0);
	TargetProps.Add(PropertyId::CollisionMask, 0);
	FHktEntityId Target = H.CreateEntityWithProperties(TargetProps);

	// AoE victim (within 200cm of target)
	TMap<uint16, int32> AoEProps;
	AoEProps.Add(PropertyId::Health, 100);
	AoEProps.Add(PropertyId::Defense, 0);
	AoEProps.Add(PropertyId::PosX, 50);
	AoEProps.Add(PropertyId::PosY, 0);
	AoEProps.Add(PropertyId::PosZ, 0);
	FHktEntityId AoEVictim = H.CreateEntityWithProperties(AoEProps);

	EVMStatus Status = H.ExecuteProgram(Program, Caster, Target, 500);
	H.Teardown();

	if (Status != EVMStatus::Completed)
		return FHktTestResult::Fail(Name, TEXT("Expected Completed"));

	int32 VictimHealth = H.GetProperty(AoEVictim, PropertyId::Health);
	// AoE: 30 damage (Defense=0) → 100 - 30 = 70
	if (VictimHealth != 70)
		return FHktTestResult::Fail(Name, FString::Printf(TEXT("AoE Victim Health should be 70, got %d"), VictimHealth));

	return FHktTestResult::Pass(Name);
}

// ============================================================================
// BasicAttack: ForEachInRadius 기반 데미지 + 사망 판정
// ============================================================================

static FHktTestResult Test_BasicAttack_Damage()
{
	const TCHAR* Name = TEXT("Scenario_BasicAttack_Damage");
	const FHktVMProgram* Program = FindStory(TEXT("Story.Event.Attack.Basic"));
	if (!Program) return SkipResult(Name, TEXT("story not registered"));

	FHktAutomationTestHarness H;
	H.Setup();

	// Attacker
	TMap<uint16, int32> AtkProps;
	AtkProps.Add(PropertyId::AttackPower, 15);
	AtkProps.Add(PropertyId::AttackSpeed, 100);
	AtkProps.Add(PropertyId::NextActionFrame, 0);
	AtkProps.Add(PropertyId::PosX, 0);
	AtkProps.Add(PropertyId::PosY, 0);
	AtkProps.Add(PropertyId::PosZ, 0);
	AtkProps.Add(PropertyId::CollisionMask, 0);
	FHktEntityId Attacker = H.CreateEntityWithProperties(AtkProps);

	// Target within 200cm
	TMap<uint16, int32> TgtProps;
	TgtProps.Add(PropertyId::Health, 80);
	TgtProps.Add(PropertyId::Defense, 5);
	TgtProps.Add(PropertyId::PosX, 100);
	TgtProps.Add(PropertyId::PosY, 0);
	TgtProps.Add(PropertyId::PosZ, 0);
	FHktEntityId Target = H.CreateEntityWithProperties(TgtProps);

	// Contains WaitAnimEnd → timer auto-advance in ExecuteProgram
	EVMStatus Status = H.ExecuteProgram(Program, Attacker, Target, 500);
	H.Teardown();

	if (Status != EVMStatus::Completed)
		return FHktTestResult::Fail(Name, FString::Printf(TEXT("Expected Completed, got %d"), (int)Status));

	int32 TargetHealth = H.GetProperty(Target, PropertyId::Health);
	// Damage = max(1, 15-5) = 10 → Health = 80 - 10 = 70
	if (TargetHealth != 70)
		return FHktTestResult::Fail(Name, FString::Printf(TEXT("Target Health should be 70, got %d"), TargetHealth));

	return FHktTestResult::Pass(Name);
}

static FHktTestResult Test_BasicAttack_Kill()
{
	const TCHAR* Name = TEXT("Scenario_BasicAttack_Kill");
	const FHktVMProgram* Program = FindStory(TEXT("Story.Event.Attack.Basic"));
	if (!Program) return SkipResult(Name, TEXT("story not registered"));

	FGameplayTag DeadTag = FGameplayTag::RequestGameplayTag(FName(TEXT("State.Dead")), false);
	if (!DeadTag.IsValid()) return SkipResult(Name, TEXT("State.Dead tag not registered"));

	FHktAutomationTestHarness H;
	H.Setup();

	TMap<uint16, int32> AtkProps;
	AtkProps.Add(PropertyId::AttackPower, 100);
	AtkProps.Add(PropertyId::AttackSpeed, 100);
	AtkProps.Add(PropertyId::NextActionFrame, 0);
	AtkProps.Add(PropertyId::PosX, 0);
	AtkProps.Add(PropertyId::PosY, 0);
	AtkProps.Add(PropertyId::PosZ, 0);
	AtkProps.Add(PropertyId::CollisionMask, 0);
	FHktEntityId Attacker = H.CreateEntityWithProperties(AtkProps);

	TMap<uint16, int32> TgtProps;
	TgtProps.Add(PropertyId::Health, 5);
	TgtProps.Add(PropertyId::Defense, 0);
	TgtProps.Add(PropertyId::PosX, 50);
	TgtProps.Add(PropertyId::PosY, 0);
	TgtProps.Add(PropertyId::PosZ, 0);
	FHktEntityId Target = H.CreateEntityWithProperties(TgtProps);

	EVMStatus Status = H.ExecuteProgram(Program, Attacker, Target, 500);
	H.Teardown();

	if (Status != EVMStatus::Completed)
		return FHktTestResult::Fail(Name, TEXT("Expected Completed"));

	int32 TargetHealth = H.GetProperty(Target, PropertyId::Health);
	if (TargetHealth != 0)
		return FHktTestResult::Fail(Name, FString::Printf(TEXT("Target Health should be 0, got %d"), TargetHealth));

	if (!H.HasTag(Target, DeadTag))
		return FHktTestResult::Fail(Name, TEXT("Target should have State.Dead tag"));

	return FHktTestResult::Pass(Name);
}

// ============================================================================
// BasicAttack: 자기 자신 제외 확인
// ============================================================================

static FHktTestResult Test_BasicAttack_SelfExclude()
{
	const TCHAR* Name = TEXT("Scenario_BasicAttack_SelfExclude");
	const FHktVMProgram* Program = FindStory(TEXT("Story.Event.Attack.Basic"));
	if (!Program) return SkipResult(Name, TEXT("story not registered"));

	FHktAutomationTestHarness H;
	H.Setup();

	// 엔티티 1개만 (Self == 유일한 범위 내 엔티티)
	TMap<uint16, int32> AtkProps;
	AtkProps.Add(PropertyId::AttackPower, 50);
	AtkProps.Add(PropertyId::Health, 100);
	AtkProps.Add(PropertyId::Defense, 0);
	AtkProps.Add(PropertyId::AttackSpeed, 100);
	AtkProps.Add(PropertyId::NextActionFrame, 0);
	AtkProps.Add(PropertyId::PosX, 0);
	AtkProps.Add(PropertyId::PosY, 0);
	AtkProps.Add(PropertyId::PosZ, 0);
	AtkProps.Add(PropertyId::CollisionMask, 0);
	FHktEntityId Self = H.CreateEntityWithProperties(AtkProps);

	// Target은 범위 외
	TMap<uint16, int32> TgtProps;
	TgtProps.Add(PropertyId::Health, 100);
	TgtProps.Add(PropertyId::PosX, 9999);
	TgtProps.Add(PropertyId::PosY, 0);
	TgtProps.Add(PropertyId::PosZ, 0);
	FHktEntityId Target = H.CreateEntityWithProperties(TgtProps);

	H.ExecuteProgram(Program, Self, Target, 500);
	H.Teardown();

	// Self는 자기 자신을 공격하지 않아야 함
	int32 SelfHealth = H.GetProperty(Self, PropertyId::Health);
	if (SelfHealth != 100)
		return FHktTestResult::Fail(Name, FString::Printf(TEXT("Self Health should be 100 (untouched), got %d"), SelfHealth));

	return FHktTestResult::Pass(Name);
}

// ============================================================================
// Cooldown 검증: 두 번째 실행 시 NextActionFrame 갱신 확인
// ============================================================================

static FHktTestResult Test_Buff_CooldownUpdate()
{
	const TCHAR* Name = TEXT("Scenario_Buff_Cooldown");
	const FHktVMProgram* Program = FindStory(TEXT("Story.Event.Skill.Buff"));
	if (!Program) return SkipResult(Name, TEXT("story not registered"));

	FHktAutomationTestHarness H;
	H.Setup();

	TMap<uint16, int32> Props;
	Props.Add(PropertyId::AttackPower, 10);
	Props.Add(PropertyId::AttackSpeed, 100);
	Props.Add(PropertyId::NextActionFrame, 0);
	FHktEntityId Self = H.CreateEntityWithProperties(Props);

	H.ExecuteProgram(Program, Self, InvalidEntityId, 500);
	H.Teardown();

	int32 NextAction = H.GetProperty(Self, PropertyId::NextActionFrame);
	// CooldownUpdateConst(30) → NextActionFrame = WorldTime + 30
	// WorldState.FrameNumber starts at 0, so NextActionFrame should be > 0
	if (NextAction <= 0)
		return FHktTestResult::Fail(Name, FString::Printf(TEXT("NextActionFrame should be > 0 after cooldown, got %d"), NextAction));

	return FHktTestResult::Pass(Name);
}

// ============================================================================
// Precondition 실행 테스트: UseSkill의 쿨다운 체크
// ============================================================================

static FHktTestResult Test_UseSkill_PreconditionCooldown()
{
	const TCHAR* Name = TEXT("Scenario_UseSkill_Precondition");
	const FHktVMProgram* Program = FindStory(TEXT("Story.Event.Combat.UseSkill"));
	if (!Program) return SkipResult(Name, TEXT("story not registered"));
	if (!Program->Precondition) return SkipResult(Name, TEXT("no precondition set"));

	FHktAutomationTestHarness H;
	H.Setup();

	// Case 1: 쿨다운 통과 (NextActionFrame=0, FrameNumber=0)
	TMap<uint16, int32> Props;
	Props.Add(PropertyId::NextActionFrame, 0);
	FHktEntityId Self = H.CreateEntityWithProperties(Props);

	FHktEvent TestEvent;
	TestEvent.SourceEntity = Self;
	TestEvent.TargetEntity = InvalidEntityId;

	bool bPass = Program->Precondition(H.GetWorldState(), TestEvent);
	if (!bPass)
		return FHktTestResult::Fail(Name, TEXT("Precondition should pass when NextActionFrame=0"));

	// Case 2: 쿨다운 중 (NextActionFrame=999999)
	H.GetWorldState().SetProperty(Self, PropertyId::NextActionFrame, 999999);
	bool bFail = Program->Precondition(H.GetWorldState(), TestEvent);

	H.Teardown();

	if (bFail)
		return FHktTestResult::Fail(Name, TEXT("Precondition should fail when on cooldown"));

	return FHktTestResult::Pass(Name);
}

// ============================================================================
// Public
// ============================================================================

FHktTestReport RunAllScenarioTests()
{
	// Story 등록 (이미 완료되었을 수 있지만 안전하게 호출)
	FHktStoryRegistry::InitializeAllStories();

	FHktTestReport Report;
	Report.Add(Test_Heal_Recovery());
	Report.Add(Test_Heal_NoClamping());
	Report.Add(Test_Buff_AttackPowerIncrease());
	Report.Add(Test_Lightning_DirectDamage());
	Report.Add(Test_Lightning_AoEDamage());
	Report.Add(Test_BasicAttack_Damage());
	Report.Add(Test_BasicAttack_Kill());
	Report.Add(Test_BasicAttack_SelfExclude());
	Report.Add(Test_Buff_CooldownUpdate());
	Report.Add(Test_UseSkill_PreconditionCooldown());
	return Report;
}

} // namespace HktStoryScenarioTests
