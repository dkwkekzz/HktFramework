// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktAutomationTestsLog.h"
#include "HktAutomationTestsTypes.h"
#include "HktAutomationTestsHarness.h"
#include "HktStoryBuilder.h"
#include "VM/HktVMProgram.h"

namespace HktOpcodeTests
{

// ============================================================================
// 헬퍼: 테스트용 GameplayTag 생성
// ============================================================================

static FGameplayTag TestTag(const TCHAR* Name)
{
	return FGameplayTag::RequestGameplayTag(FName(Name), false);
}

static FGameplayTag TestStoryTag()
{
	static FGameplayTag Tag = TestTag(TEXT("Test.Validation.Opcode"));
	return Tag;
}

// ============================================================================
// Control Flow Tests
// ============================================================================

static FHktTestResult Test_Nop()
{
	FHktAutomationTestHarness H;
	H.Setup();
	FHktEntityId E = H.CreateEntity();

	auto Program = FHktStoryBuilder::Create(TestStoryTag())
		.LoadConst(Reg::R0, 42)
		.Halt()
		.Build();

	EVMStatus Status = H.ExecuteProgram(Program, E);
	H.Teardown();

	if (Status != EVMStatus::Completed)
		return FHktTestResult::Fail(TEXT("Nop_Halt"), TEXT("Expected Completed"));
	if (H.GetRegister(Reg::R0) != 42)
		return FHktTestResult::Fail(TEXT("Nop_Halt"), TEXT("R0 should be 42"));

	return FHktTestResult::Pass(TEXT("Nop_Halt"));
}

static FHktTestResult Test_Halt()
{
	FHktAutomationTestHarness H;
	H.Setup();
	FHktEntityId E = H.CreateEntity();

	auto Program = FHktStoryBuilder::Create(TestStoryTag())
		.Halt()
		.Build();

	EVMStatus Status = H.ExecuteProgram(Program, E);
	H.Teardown();

	if (Status != EVMStatus::Completed)
		return FHktTestResult::Fail(TEXT("Halt"), TEXT("Expected Completed"));

	return FHktTestResult::Pass(TEXT("Halt"));
}

static FHktTestResult Test_Fail()
{
	FHktAutomationTestHarness H;
	H.Setup();
	FHktEntityId E = H.CreateEntity();

	auto Program = FHktStoryBuilder::Create(TestStoryTag())
		.Fail()
		.Build();

	EVMStatus Status = H.ExecuteProgram(Program, E);
	H.Teardown();

	if (Status != EVMStatus::Failed)
		return FHktTestResult::Fail(TEXT("Fail"), TEXT("Expected Failed"));

	return FHktTestResult::Pass(TEXT("Fail"));
}

static FHktTestResult Test_Yield()
{
	FHktAutomationTestHarness H;
	H.Setup();
	FHktEntityId E = H.CreateEntity();

	auto Program = FHktStoryBuilder::Create(TestStoryTag())
		.LoadConst(Reg::R0, 10)
		.Yield(1)
		.LoadConst(Reg::R0, 20)
		.Halt()
		.Build();

	// 첫 번째 실행: Yield에서 정지
	EVMStatus Status = H.ExecuteProgram(Program, E);
	H.Teardown();

	// ExecuteProgram은 Yield를 자동 소비하므로 Completed가 되어야 함
	if (Status != EVMStatus::Completed)
		return FHktTestResult::Fail(TEXT("Yield"), TEXT("Expected Completed after auto-resume"));
	if (H.GetRegister(Reg::R0) != 20)
		return FHktTestResult::Fail(TEXT("Yield"), TEXT("R0 should be 20 after resume"));

	return FHktTestResult::Pass(TEXT("Yield"));
}

static FHktTestResult Test_YieldSeconds()
{
	FHktAutomationTestHarness H;
	H.Setup();
	FHktEntityId E = H.CreateEntity();

	auto Program = FHktStoryBuilder::Create(TestStoryTag())
		.LoadConst(Reg::R0, 1)
		.WaitSeconds(0.5f)
		.LoadConst(Reg::R0, 2)
		.Halt()
		.Build();

	// ExecuteProgram은 Timer를 자동 진행하므로 Completed가 되어야 함
	EVMStatus Status = H.ExecuteProgram(Program, E);
	H.Teardown();

	if (Status != EVMStatus::Completed)
		return FHktTestResult::Fail(TEXT("YieldSeconds"), TEXT("Expected Completed"));
	if (H.GetRegister(Reg::R0) != 2)
		return FHktTestResult::Fail(TEXT("YieldSeconds"), TEXT("R0 should be 2 after timer"));

	return FHktTestResult::Pass(TEXT("YieldSeconds"));
}

static FHktTestResult Test_Jump()
{
	FHktAutomationTestHarness H;
	H.Setup();
	FHktEntityId E = H.CreateEntity();

	auto B = FHktStoryBuilder::Create(TestStoryTag());
	int32 SkipLabel = B.AllocLabel();
	auto Program = B
		.LoadConst(Reg::R0, 1)
		.Jump(SkipLabel)
		.LoadConst(Reg::R0, 999)  // 이 줄은 스킵되어야 함
		.Label(SkipLabel)
		.LoadConst(Reg::R1, 2)
		.Halt()
		.Build();

	EVMStatus Status = H.ExecuteProgram(Program, E);
	H.Teardown();

	if (Status != EVMStatus::Completed)
		return FHktTestResult::Fail(TEXT("Jump"), TEXT("Expected Completed"));
	if (H.GetRegister(Reg::R0) != 1)
		return FHktTestResult::Fail(TEXT("Jump"), TEXT("R0 should be 1 (skip should have bypassed 999)"));
	if (H.GetRegister(Reg::R1) != 2)
		return FHktTestResult::Fail(TEXT("Jump"), TEXT("R1 should be 2"));

	return FHktTestResult::Pass(TEXT("Jump"));
}

static FHktTestResult Test_JumpIf_JumpIfNot()
{
	FHktAutomationTestHarness H;
	H.Setup();
	FHktEntityId E = H.CreateEntity();

	// JumpIf: R0=1 → 점프
	{
		auto B1 = FHktStoryBuilder::Create(TestStoryTag());
		int32 TakenLabel = B1.AllocLabel();
		auto Program = B1
			.LoadConst(Reg::R0, 1)
			.JumpIf(Reg::R0, TakenLabel)
			.LoadConst(Reg::R1, 0)
			.Halt()
			.Label(TakenLabel)
			.LoadConst(Reg::R1, 100)
			.Halt()
			.Build();

		EVMStatus Status = H.ExecuteProgram(Program, E);
		if (H.GetRegister(Reg::R1) != 100)
			return FHktTestResult::Fail(TEXT("JumpIf_JumpIfNot"), TEXT("JumpIf should jump when cond != 0"));
	}

	// JumpIf: R0=0 → 점프 안 함
	H.Setup();
	E = H.CreateEntity();
	{
		auto B2 = FHktStoryBuilder::Create(TestStoryTag());
		int32 TakenLabel2 = B2.AllocLabel();
		auto Program = B2
			.LoadConst(Reg::R0, 0)
			.JumpIf(Reg::R0, TakenLabel2)
			.LoadConst(Reg::R1, 50)
			.Halt()
			.Label(TakenLabel2)
			.LoadConst(Reg::R1, 100)
			.Halt()
			.Build();

		H.ExecuteProgram(Program, E);
		if (H.GetRegister(Reg::R1) != 50)
			return FHktTestResult::Fail(TEXT("JumpIf_JumpIfNot"), TEXT("JumpIf should not jump when cond == 0"));
	}

	// JumpIfNot: R0=0 → 점프
	H.Setup();
	E = H.CreateEntity();
	{
		auto B3 = FHktStoryBuilder::Create(TestStoryTag());
		int32 TakenLabel3 = B3.AllocLabel();
		auto Program = B3
			.LoadConst(Reg::R0, 0)
			.JumpIfNot(Reg::R0, TakenLabel3)
			.LoadConst(Reg::R1, 50)
			.Halt()
			.Label(TakenLabel3)
			.LoadConst(Reg::R1, 200)
			.Halt()
			.Build();

		H.ExecuteProgram(Program, E);
		if (H.GetRegister(Reg::R1) != 200)
			return FHktTestResult::Fail(TEXT("JumpIf_JumpIfNot"), TEXT("JumpIfNot should jump when cond == 0"));
	}

	H.Teardown();
	return FHktTestResult::Pass(TEXT("JumpIf_JumpIfNot"));
}

// ============================================================================
// Structured Control Flow Tests (If/Else/EndIf, Repeat)
// ============================================================================

static FHktTestResult Test_If_EndIf()
{
	FHktAutomationTestHarness H;
	H.Setup();
	FHktEntityId E = H.CreateEntity();

	// If(true) → 블록 실행
	auto Program = FHktStoryBuilder::Create(TestStoryTag())
		.LoadConst(Reg::R0, 1)
		.LoadConst(Reg::R1, 0)
		.If(Reg::R0)
			.LoadConst(Reg::R1, 100)
		.EndIf()
		.Halt()
		.Build();

	H.ExecuteProgram(Program, E);

	if (H.GetRegister(Reg::R1) != 100)
		return FHktTestResult::Fail(TEXT("If_EndIf"), TEXT("If(true) block should execute"));

	// If(false) → 블록 스킵
	H.Setup();
	E = H.CreateEntity();

	Program = FHktStoryBuilder::Create(TestStoryTag())
		.LoadConst(Reg::R0, 0)
		.LoadConst(Reg::R1, 50)
		.If(Reg::R0)
			.LoadConst(Reg::R1, 100)
		.EndIf()
		.Halt()
		.Build();

	H.ExecuteProgram(Program, E);
	H.Teardown();

	if (H.GetRegister(Reg::R1) != 50)
		return FHktTestResult::Fail(TEXT("If_EndIf"), TEXT("If(false) block should be skipped"));

	return FHktTestResult::Pass(TEXT("If_EndIf"));
}

static FHktTestResult Test_If_Else_EndIf()
{
	FHktAutomationTestHarness H;
	H.Setup();
	FHktEntityId E = H.CreateEntity();

	auto Program = FHktStoryBuilder::Create(TestStoryTag())
		.LoadConst(Reg::R0, 0)  // false
		.LoadConst(Reg::R1, 0)
		.If(Reg::R0)
			.LoadConst(Reg::R1, 10)
		.Else()
			.LoadConst(Reg::R1, 20)
		.EndIf()
		.Halt()
		.Build();

	H.ExecuteProgram(Program, E);
	H.Teardown();

	if (H.GetRegister(Reg::R1) != 20)
		return FHktTestResult::Fail(TEXT("If_Else_EndIf"), TEXT("Else branch should execute when cond=0"));

	return FHktTestResult::Pass(TEXT("If_Else_EndIf"));
}

static FHktTestResult Test_IfEqConst()
{
	FHktAutomationTestHarness H;
	H.Setup();
	FHktEntityId E = H.CreateEntity();

	auto Program = FHktStoryBuilder::Create(TestStoryTag())
		.LoadConst(Reg::R0, 42)
		.LoadConst(Reg::R1, 0)
		.IfEqConst(Reg::R0, 42)
			.LoadConst(Reg::R1, 1)
		.EndIf()
		.IfEqConst(Reg::R0, 99)
			.LoadConst(Reg::R1, 2)
		.EndIf()
		.Halt()
		.Build();

	H.ExecuteProgram(Program, E);
	H.Teardown();

	if (H.GetRegister(Reg::R1) != 1)
		return FHktTestResult::Fail(TEXT("IfEqConst"), TEXT("IfEqConst(42,42) should enter, IfEqConst(42,99) should skip"));

	return FHktTestResult::Pass(TEXT("IfEqConst"));
}

static FHktTestResult Test_IfPropertyLe()
{
	FHktAutomationTestHarness H;
	H.Setup();

	TMap<uint16, int32> Props;
	Props.Add(PropertyId::Health, 0);
	FHktEntityId E = H.CreateEntityWithProperties(Props);

	auto Program = FHktStoryBuilder::Create(TestStoryTag())
		.LoadConst(Reg::R0, 0)
		.IfPropertyLe(Reg::Self, PropertyId::Health, 0)
			.LoadConst(Reg::R0, 1)  // Health <= 0 → dead
		.EndIf()
		.Halt()
		.Build();

	H.ExecuteProgram(Program, E);
	H.Teardown();

	if (H.GetRegister(Reg::R0) != 1)
		return FHktTestResult::Fail(TEXT("IfPropertyLe"), TEXT("Health=0, IfPropertyLe(Health,0) should enter"));

	return FHktTestResult::Pass(TEXT("IfPropertyLe"));
}

static FHktTestResult Test_Repeat_EndRepeat()
{
	FHktAutomationTestHarness H;
	H.Setup();
	FHktEntityId E = H.CreateEntity();

	// R0를 Repeat(5)로 5번 증가
	auto Program = FHktStoryBuilder::Create(TestStoryTag())
		.LoadConst(Reg::R0, 0)
		.Repeat(5)
			.AddImm(Reg::R0, Reg::R0, 10)
		.EndRepeat()
		.Halt()
		.Build();

	H.ExecuteProgram(Program, E);
	H.Teardown();

	if (H.GetRegister(Reg::R0) != 50)
		return FHktTestResult::Fail(TEXT("Repeat_EndRepeat"), FString::Printf(TEXT("R0 should be 50, got %d"), H.GetRegister(Reg::R0)));

	return FHktTestResult::Pass(TEXT("Repeat_EndRepeat"));
}

// ============================================================================
// ScopedReg Tests
// ============================================================================

static FHktTestResult Test_ScopedReg()
{
	FHktAutomationTestHarness H;
	H.Setup();
	FHktEntityId E = H.CreateEntity();

	auto B = FHktStoryBuilder::Create(TestStoryTag());
	{
		FHktScopedReg r0(B);
		FHktScopedReg r1(B);
		B.LoadConst(r0, 42);
		B.LoadConst(r1, 99);
		B.Add(Reg::R5, r0, r1);  // R5 = 42+99 = 141
	}
	// r0, r1 은 소멸 → 레지스터 반환됨
	B.Halt();

	auto Program = B.Build();
	H.ExecuteProgram(Program, E);
	H.Teardown();

	if (H.GetRegister(Reg::R5) != 141)
		return FHktTestResult::Fail(TEXT("ScopedReg"), FString::Printf(TEXT("R5 should be 141, got %d"), H.GetRegister(Reg::R5)));

	return FHktTestResult::Pass(TEXT("ScopedReg"));
}

static FHktTestResult Test_ScopedRegBlock()
{
	FHktAutomationTestHarness H;
	H.Setup();

	TMap<uint16, int32> Props;
	Props.Add(PropertyId::PosX, 100);
	Props.Add(PropertyId::PosY, 200);
	Props.Add(PropertyId::PosZ, 300);
	FHktEntityId Self = H.CreateEntityWithProperties(Props);
	FHktEntityId Target = H.CreateEntity();

	auto B = FHktStoryBuilder::Create(TestStoryTag());
	{
		FHktScopedRegBlock pos(B, 3);
		B.GetPosition(pos, Reg::Self);
		B.SetPosition(Reg::Target, pos);
	}
	B.Halt();

	auto Program = B.Build();
	H.ExecuteProgram(Program, Self, Target);
	H.Teardown();

	if (H.GetProperty(Target, PropertyId::PosX) != 100 ||
		H.GetProperty(Target, PropertyId::PosY) != 200 ||
		H.GetProperty(Target, PropertyId::PosZ) != 300)
		return FHktTestResult::Fail(TEXT("ScopedRegBlock"), TEXT("Position should be copied via ScopedRegBlock"));

	return FHktTestResult::Pass(TEXT("ScopedRegBlock"));
}

// ============================================================================
// Public: 테스트 실행
// ============================================================================

FHktTestReport RunControlFlowTests()
{
	FHktTestReport Report;
	Report.Add(Test_Nop());
	Report.Add(Test_Halt());
	Report.Add(Test_Fail());
	Report.Add(Test_Yield());
	Report.Add(Test_YieldSeconds());
	Report.Add(Test_Jump());
	Report.Add(Test_JumpIf_JumpIfNot());
	Report.Add(Test_If_EndIf());
	Report.Add(Test_If_Else_EndIf());
	Report.Add(Test_IfEqConst());
	Report.Add(Test_IfPropertyLe());
	Report.Add(Test_Repeat_EndRepeat());
	Report.Add(Test_ScopedReg());
	Report.Add(Test_ScopedRegBlock());
	return Report;
}

} // namespace HktOpcodeTests
