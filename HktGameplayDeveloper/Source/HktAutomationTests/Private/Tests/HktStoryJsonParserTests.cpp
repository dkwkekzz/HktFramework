// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktAutomationTestsLog.h"
#include "HktAutomationTestsTypes.h"
#include "HktAutomationTestsHarness.h"
#include "HktStoryJsonParser.h"
#include "HktStoryBuilder.h"
#include "HktStoryTypes.h"
#include "HktCoreProperties.h"
#include "VM/HktVMProgram.h"

namespace HktStoryJsonParserTests
{

// ============================================================================
// Helper — 테스트용 태그 해석기 (문자열 기반 — 런타임 GameplayTag 없이 동작)
// ============================================================================

static FGameplayTag TestResolveTag(const FString& TagStr)
{
	return FGameplayTag::RequestGameplayTag(FName(*TagStr), false);
}

// ============================================================================
// 1. ParseRegister 테스트
// ============================================================================

static FHktTestResult Test_ParseRegister_SpecialRegs()
{
	const FString TestName = TEXT("JsonParser.ParseRegister.SpecialRegs");

	if (FHktStoryJsonParser::ParseRegister(TEXT("Self")) != Reg::Self)
		return FHktTestResult::Fail(TestName, TEXT("Self should map to Reg::Self"));
	if (FHktStoryJsonParser::ParseRegister(TEXT("Target")) != Reg::Target)
		return FHktTestResult::Fail(TestName, TEXT("Target should map to Reg::Target"));
	if (FHktStoryJsonParser::ParseRegister(TEXT("Spawned")) != Reg::Spawned)
		return FHktTestResult::Fail(TestName, TEXT("Spawned should map to Reg::Spawned"));
	if (FHktStoryJsonParser::ParseRegister(TEXT("Hit")) != Reg::Hit)
		return FHktTestResult::Fail(TestName, TEXT("Hit should map to Reg::Hit"));
	if (FHktStoryJsonParser::ParseRegister(TEXT("Iter")) != Reg::Iter)
		return FHktTestResult::Fail(TestName, TEXT("Iter should map to Reg::Iter"));
	if (FHktStoryJsonParser::ParseRegister(TEXT("Flag")) != Reg::Flag)
		return FHktTestResult::Fail(TestName, TEXT("Flag should map to Reg::Flag"));

	return FHktTestResult::Pass(TestName);
}

static FHktTestResult Test_ParseRegister_GPRegs()
{
	const FString TestName = TEXT("JsonParser.ParseRegister.GPRegs");

	for (int32 i = 0; i <= 9; ++i)
	{
		FString RegStr = FString::Printf(TEXT("R%d"), i);
		RegisterIndex Idx = FHktStoryJsonParser::ParseRegister(RegStr);
		if (Idx != static_cast<RegisterIndex>(i))
			return FHktTestResult::Fail(TestName, FString::Printf(TEXT("R%d should map to %d, got %d"), i, i, Idx));
	}

	return FHktTestResult::Pass(TestName);
}

static FHktTestResult Test_ParseRegister_Invalid()
{
	const FString TestName = TEXT("JsonParser.ParseRegister.Invalid");

	if (FHktStoryJsonParser::ParseRegister(TEXT("InvalidReg")) != 0xFF)
		return FHktTestResult::Fail(TestName, TEXT("Invalid register should return 0xFF"));
	if (FHktStoryJsonParser::ParseRegister(TEXT("R10")) != 0xFF)
		return FHktTestResult::Fail(TestName, TEXT("R10 should be invalid (special regs use names)"));
	if (FHktStoryJsonParser::ParseRegister(TEXT("")) != 0xFF)
		return FHktTestResult::Fail(TestName, TEXT("Empty string should return 0xFF"));

	return FHktTestResult::Pass(TestName);
}

// ============================================================================
// 2. ParsePropertyId 테스트
// ============================================================================

static FHktTestResult Test_ParsePropertyId_Valid()
{
	const FString TestName = TEXT("JsonParser.ParsePropertyId.Valid");

	if (FHktStoryJsonParser::ParsePropertyId(TEXT("Health")) != PropertyId::Health)
		return FHktTestResult::Fail(TestName, TEXT("Health should map to PropertyId::Health"));
	if (FHktStoryJsonParser::ParsePropertyId(TEXT("AttackPower")) != PropertyId::AttackPower)
		return FHktTestResult::Fail(TestName, TEXT("AttackPower should map correctly"));
	if (FHktStoryJsonParser::ParsePropertyId(TEXT("NextActionFrame")) != PropertyId::NextActionFrame)
		return FHktTestResult::Fail(TestName, TEXT("NextActionFrame should map correctly"));
	if (FHktStoryJsonParser::ParsePropertyId(TEXT("ItemState")) != PropertyId::ItemState)
		return FHktTestResult::Fail(TestName, TEXT("ItemState should map correctly"));
	if (FHktStoryJsonParser::ParsePropertyId(TEXT("EquipSlot0")) != PropertyId::EquipSlot0)
		return FHktTestResult::Fail(TestName, TEXT("EquipSlot0 should map correctly"));

	return FHktTestResult::Pass(TestName);
}

static FHktTestResult Test_ParsePropertyId_Invalid()
{
	const FString TestName = TEXT("JsonParser.ParsePropertyId.Invalid");

	if (FHktStoryJsonParser::ParsePropertyId(TEXT("NonExistentProp")) != 0xFFFF)
		return FHktTestResult::Fail(TestName, TEXT("Invalid property should return 0xFFFF"));

	return FHktTestResult::Pass(TestName);
}

// ============================================================================
// 3. IsReadOnlyOp 테스트
// ============================================================================

static FHktTestResult Test_IsReadOnlyOp()
{
	const FString TestName = TEXT("JsonParser.IsReadOnlyOp");

	// Read-only ops
	if (!FHktStoryJsonParser::IsReadOnlyOp(TEXT("LoadConst")))
		return FHktTestResult::Fail(TestName, TEXT("LoadConst should be read-only"));
	if (!FHktStoryJsonParser::IsReadOnlyOp(TEXT("CmpEq")))
		return FHktTestResult::Fail(TestName, TEXT("CmpEq should be read-only"));
	if (!FHktStoryJsonParser::IsReadOnlyOp(TEXT("HasTag")))
		return FHktTestResult::Fail(TestName, TEXT("HasTag should be read-only"));
	if (!FHktStoryJsonParser::IsReadOnlyOp(TEXT("IfEqConst")))
		return FHktTestResult::Fail(TestName, TEXT("IfEqConst should be read-only"));
	if (!FHktStoryJsonParser::IsReadOnlyOp(TEXT("ReadProperty")))
		return FHktTestResult::Fail(TestName, TEXT("ReadProperty should be read-only"));

	// Write ops (not read-only)
	if (FHktStoryJsonParser::IsReadOnlyOp(TEXT("SaveStore")))
		return FHktTestResult::Fail(TestName, TEXT("SaveStore should NOT be read-only"));
	if (FHktStoryJsonParser::IsReadOnlyOp(TEXT("SpawnEntity")))
		return FHktTestResult::Fail(TestName, TEXT("SpawnEntity should NOT be read-only"));
	if (FHktStoryJsonParser::IsReadOnlyOp(TEXT("ApplyDamage")))
		return FHktTestResult::Fail(TestName, TEXT("ApplyDamage should NOT be read-only"));
	if (FHktStoryJsonParser::IsReadOnlyOp(TEXT("AddTag")))
		return FHktTestResult::Fail(TestName, TEXT("AddTag should NOT be read-only"));

	return FHktTestResult::Pass(TestName);
}

// ============================================================================
// 4. GetValidOpNames 테스트
// ============================================================================

static FHktTestResult Test_GetValidOpNames()
{
	const FString TestName = TEXT("JsonParser.GetValidOpNames");

	TSet<FString> Ops = FHktStoryJsonParser::Get().GetValidOpNames();

	if (Ops.Num() < 50)
		return FHktTestResult::Fail(TestName,
			FString::Printf(TEXT("Expected at least 50 registered ops, got %d"), Ops.Num()));

	// Check some essential ops are registered
	const TCHAR* RequiredOps[] = {
		TEXT("Halt"), TEXT("LoadConst"), TEXT("SaveStore"), TEXT("AddTag"), TEXT("RemoveTag"),
		TEXT("SpawnEntity"), TEXT("DestroyEntity"), TEXT("ApplyDamageConst"),
		TEXT("If"), TEXT("EndIf"), TEXT("IfEqConst"), TEXT("IfPropertyLe"),
		TEXT("Repeat"), TEXT("EndRepeat"),
		TEXT("ForEachInRadius"), TEXT("EndForEach"),
		TEXT("DispatchEvent"), TEXT("DispatchEventTo"), TEXT("DispatchEventFrom"),
		TEXT("CopyPosition"), TEXT("PlayAnim"), TEXT("PlayVFXAtEntity"),
		TEXT("ReadProperty"), TEXT("WriteProperty"), TEXT("WriteConst"),
	};

	for (const TCHAR* Op : RequiredOps)
	{
		if (!Ops.Contains(Op))
			return FHktTestResult::Fail(TestName, FString::Printf(TEXT("Missing required op: %s"), Op));
	}

	return FHktTestResult::Pass(TestName);
}

// ============================================================================
// 5. ParseAndBuild 기본 테스트 — 최소 유효 JSON
// ============================================================================

static FHktTestResult Test_ParseAndBuild_MinimalValid()
{
	const FString TestName = TEXT("JsonParser.ParseAndBuild.MinimalValid");

	FString Json = TEXT(R"({
		"storyTag": "Test.Json.Minimal",
		"steps": [
			{"op": "Halt"}
		]
	})");

	FHktStoryParseResult Result = FHktStoryJsonParser::Get().ParseAndBuild(Json, &TestResolveTag);

	if (!Result.bSuccess)
	{
		FString Errs = FString::Join(Result.Errors, TEXT("; "));
		return FHktTestResult::Fail(TestName, FString::Printf(TEXT("Parse failed: %s"), *Errs));
	}

	if (Result.StoryTag != TEXT("Test.Json.Minimal"))
		return FHktTestResult::Fail(TestName, TEXT("StoryTag mismatch"));

	return FHktTestResult::Pass(TestName);
}

// ============================================================================
// 6. ParseAndBuild — 잘못된 JSON
// ============================================================================

static FHktTestResult Test_ParseAndBuild_InvalidJson()
{
	const FString TestName = TEXT("JsonParser.ParseAndBuild.InvalidJson");

	FHktStoryParseResult Result = FHktStoryJsonParser::Get().ParseAndBuild(
		TEXT("{invalid json"), &TestResolveTag);

	if (Result.bSuccess)
		return FHktTestResult::Fail(TestName, TEXT("Should fail on invalid JSON"));
	if (Result.Errors.Num() == 0)
		return FHktTestResult::Fail(TestName, TEXT("Should have error messages"));

	return FHktTestResult::Pass(TestName);
}

static FHktTestResult Test_ParseAndBuild_MissingStoryTag()
{
	const FString TestName = TEXT("JsonParser.ParseAndBuild.MissingStoryTag");

	FString Json = TEXT(R"({"steps": [{"op": "Halt"}]})");
	FHktStoryParseResult Result = FHktStoryJsonParser::Get().ParseAndBuild(Json, &TestResolveTag);

	if (Result.bSuccess)
		return FHktTestResult::Fail(TestName, TEXT("Should fail without storyTag"));

	return FHktTestResult::Pass(TestName);
}

static FHktTestResult Test_ParseAndBuild_MissingSteps()
{
	const FString TestName = TEXT("JsonParser.ParseAndBuild.MissingSteps");

	FString Json = TEXT(R"({"storyTag": "Test.Json.NoSteps"})");
	FHktStoryParseResult Result = FHktStoryJsonParser::Get().ParseAndBuild(Json, &TestResolveTag);

	if (Result.bSuccess)
		return FHktTestResult::Fail(TestName, TEXT("Should fail without steps array"));

	return FHktTestResult::Pass(TestName);
}

static FHktTestResult Test_ParseAndBuild_UnknownOp()
{
	const FString TestName = TEXT("JsonParser.ParseAndBuild.UnknownOp");

	FString Json = TEXT(R"({
		"storyTag": "Test.Json.UnknownOp",
		"steps": [
			{"op": "NonExistentOp"},
			{"op": "Halt"}
		]
	})");

	FHktStoryParseResult Result = FHktStoryJsonParser::Get().ParseAndBuild(Json, &TestResolveTag);

	if (Result.bSuccess)
		return FHktTestResult::Fail(TestName, TEXT("Should fail with unknown op"));

	return FHktTestResult::Pass(TestName);
}

// ============================================================================
// 7. ParseAndBuild — 데이터 연산 테스트
// ============================================================================

static FHktTestResult Test_ParseAndBuild_DataOps()
{
	const FString TestName = TEXT("JsonParser.ParseAndBuild.DataOps");

	FString Json = TEXT(R"({
		"storyTag": "Test.Json.DataOps",
		"steps": [
			{"op": "LoadConst", "dst": "R0", "value": 42},
			{"op": "LoadConst", "dst": "R1", "value": 8},
			{"op": "Add", "dst": "R2", "src1": "R0", "src2": "R1"},
			{"op": "Sub", "dst": "R3", "src1": "R0", "src2": "R1"},
			{"op": "Mul", "dst": "R4", "src1": "R0", "src2": "R1"},
			{"op": "Div", "dst": "R5", "src1": "R0", "src2": "R1"},
			{"op": "Move", "dst": "R6", "src": "R2"},
			{"op": "AddImm", "dst": "R7", "src": "R0", "imm": 5},
			{"op": "Halt"}
		]
	})");

	FHktStoryParseResult Result = FHktStoryJsonParser::Get().ParseAndBuild(Json, &TestResolveTag);

	if (!Result.bSuccess)
	{
		FString Errs = FString::Join(Result.Errors, TEXT("; "));
		return FHktTestResult::Fail(TestName, FString::Printf(TEXT("Parse failed: %s"), *Errs));
	}

	return FHktTestResult::Pass(TestName);
}

// ============================================================================
// 8. ParseAndBuild — 구조적 제어 흐름 테스트
// ============================================================================

static FHktTestResult Test_ParseAndBuild_StructuredControlFlow()
{
	const FString TestName = TEXT("JsonParser.ParseAndBuild.StructuredControlFlow");

	FString Json = TEXT(R"({
		"storyTag": "Test.Json.ControlFlow",
		"steps": [
			{"op": "LoadConst", "dst": "R0", "value": 10},
			{"op": "LoadConst", "dst": "R1", "value": 5},
			{"op": "IfGt", "a": "R0", "b": "R1"},
				{"op": "LoadConst", "dst": "R2", "value": 1},
			{"op": "Else"},
				{"op": "LoadConst", "dst": "R2", "value": 0},
			{"op": "EndIf"},
			{"op": "IfEqConst", "src": "R2", "value": 1},
				{"op": "Log", "message": "R0 > R1"},
			{"op": "EndIf"},
			{"op": "Repeat", "count": 3},
				{"op": "Log", "message": "loop iteration"},
			{"op": "EndRepeat"},
			{"op": "Halt"}
		]
	})");

	FHktStoryParseResult Result = FHktStoryJsonParser::Get().ParseAndBuild(Json, &TestResolveTag);

	if (!Result.bSuccess)
	{
		FString Errs = FString::Join(Result.Errors, TEXT("; "));
		return FHktTestResult::Fail(TestName, FString::Printf(TEXT("Parse failed: %s"), *Errs));
	}

	return FHktTestResult::Pass(TestName);
}

// ============================================================================
// 9. ParseAndBuild — 태그 별칭 테스트
// ============================================================================

static FHktTestResult Test_ParseAndBuild_TagAliases()
{
	const FString TestName = TEXT("JsonParser.ParseAndBuild.TagAliases");

	FString Json = TEXT(R"({
		"storyTag": "Test.Json.TagAliases",
		"tags": {
			"MyBuff": "Effect.PowerUp",
			"MyAnim": "Anim.UpperBody.Cast.Buff"
		},
		"steps": [
			{"op": "AddTag", "entity": "Self", "tag": "MyAnim"},
			{"op": "ApplyEffect", "target": "Self", "effectTag": "MyBuff"},
			{"op": "RemoveTag", "entity": "Self", "tag": "MyAnim"},
			{"op": "Halt"}
		]
	})");

	FHktStoryParseResult Result = FHktStoryJsonParser::Get().ParseAndBuild(Json, &TestResolveTag);

	if (!Result.bSuccess)
	{
		FString Errs = FString::Join(Result.Errors, TEXT("; "));
		return FHktTestResult::Fail(TestName, FString::Printf(TEXT("Parse failed: %s"), *Errs));
	}

	// Verify referenced tags include the aliased tags
	if (Result.ReferencedTags.Num() < 2)
		return FHktTestResult::Fail(TestName, TEXT("Should have at least 2 referenced tags (aliases)"));

	return FHktTestResult::Pass(TestName);
}

// ============================================================================
// 10. ParseAndBuild — cancelOnDuplicate
// ============================================================================

static FHktTestResult Test_ParseAndBuild_CancelOnDuplicate()
{
	const FString TestName = TEXT("JsonParser.ParseAndBuild.CancelOnDuplicate");

	FString Json = TEXT(R"({
		"storyTag": "Test.Json.CancelOnDuplicate",
		"cancelOnDuplicate": true,
		"steps": [
			{"op": "Log", "message": "test"},
			{"op": "Halt"}
		]
	})");

	FHktStoryParseResult Result = FHktStoryJsonParser::Get().ParseAndBuild(Json, &TestResolveTag);

	if (!Result.bSuccess)
	{
		FString Errs = FString::Join(Result.Errors, TEXT("; "));
		return FHktTestResult::Fail(TestName, FString::Printf(TEXT("Parse failed: %s"), *Errs));
	}

	return FHktTestResult::Pass(TestName);
}

// ============================================================================
// 11. ParseAndBuild — Preconditions 테스트
// ============================================================================

static FHktTestResult Test_ParseAndBuild_Preconditions()
{
	const FString TestName = TEXT("JsonParser.ParseAndBuild.Preconditions");

	FString Json = TEXT(R"({
		"storyTag": "Test.Json.Preconditions",
		"preconditions": [
			{"op": "LoadConst", "dst": "R0", "value": 1},
			{"op": "Move", "dst": "Flag", "src": "R0"}
		],
		"steps": [
			{"op": "Log", "message": "precondition passed"},
			{"op": "Halt"}
		]
	})");

	FHktStoryParseResult Result = FHktStoryJsonParser::Get().ParseAndBuild(Json, &TestResolveTag);

	if (!Result.bSuccess)
	{
		FString Errs = FString::Join(Result.Errors, TEXT("; "));
		return FHktTestResult::Fail(TestName, FString::Printf(TEXT("Parse failed: %s"), *Errs));
	}

	return FHktTestResult::Pass(TestName);
}

static FHktTestResult Test_ParseAndBuild_PreconditionRejectsWrite()
{
	const FString TestName = TEXT("JsonParser.ParseAndBuild.PreconditionRejectsWrite");

	FString Json = TEXT(R"({
		"storyTag": "Test.Json.PrecondWriteOp",
		"preconditions": [
			{"op": "SaveStore", "property": "Health", "src": "R0"}
		],
		"steps": [
			{"op": "Halt"}
		]
	})");

	FHktStoryParseResult Result = FHktStoryJsonParser::Get().ParseAndBuild(Json, &TestResolveTag);

	if (Result.bSuccess)
		return FHktTestResult::Fail(TestName, TEXT("Should fail: SaveStore is not allowed in preconditions"));

	return FHktTestResult::Pass(TestName);
}

// ============================================================================
// 12. ParseAndBuild — 전투/엔티티 명령어 테스트
// ============================================================================

static FHktTestResult Test_ParseAndBuild_CombatAndEntity()
{
	const FString TestName = TEXT("JsonParser.ParseAndBuild.CombatAndEntity");

	FString Json = TEXT(R"({
		"storyTag": "Test.Json.CombatEntity",
		"steps": [
			{"op": "SpawnEntity", "classTag": "Entity.Projectile.Fireball"},
			{"op": "CopyPosition", "dst": "Spawned", "src": "Self"},
			{"op": "MoveForward", "entity": "Spawned", "force": 500},
			{"op": "WaitCollision", "entity": "Spawned"},
			{"op": "ApplyDamageConst", "target": "Hit", "amount": 100},
			{"op": "DestroyEntity", "entity": "Spawned"},
			{"op": "ForEachInRadius", "center": "Hit", "radius": 300},
				{"op": "Move", "dst": "Target", "src": "Iter"},
				{"op": "ApplyDamageConst", "target": "Target", "amount": 50},
			{"op": "EndForEach"},
			{"op": "Halt"}
		]
	})");

	FHktStoryParseResult Result = FHktStoryJsonParser::Get().ParseAndBuild(Json, &TestResolveTag);

	if (!Result.bSuccess)
	{
		FString Errs = FString::Join(Result.Errors, TEXT("; "));
		return FHktTestResult::Fail(TestName, FString::Printf(TEXT("Parse failed: %s"), *Errs));
	}

	return FHktTestResult::Pass(TestName);
}

// ============================================================================
// 13. ParseAndBuild — 라벨 & 점프 테스트
// ============================================================================

static FHktTestResult Test_ParseAndBuild_LabelAndJump()
{
	const FString TestName = TEXT("JsonParser.ParseAndBuild.LabelAndJump");

	FString Json = TEXT(R"({
		"storyTag": "Test.Json.LabelJump",
		"steps": [
			{"op": "Label", "name": "start"},
			{"op": "LoadConst", "dst": "R0", "value": 0},
			{"op": "JumpIf", "cond": "R0", "label": "end"},
			{"op": "Log", "message": "loop body"},
			{"op": "Jump", "label": "start"},
			{"op": "Label", "name": "end"},
			{"op": "Halt"}
		]
	})");

	FHktStoryParseResult Result = FHktStoryJsonParser::Get().ParseAndBuild(Json, &TestResolveTag);

	if (!Result.bSuccess)
	{
		FString Errs = FString::Join(Result.Errors, TEXT("; "));
		return FHktTestResult::Fail(TestName, FString::Printf(TEXT("Parse failed: %s"), *Errs));
	}

	return FHktTestResult::Pass(TestName);
}

// ============================================================================
// 14. ParseAndBuild — Property 고수준 별칭 테스트
// ============================================================================

static FHktTestResult Test_ParseAndBuild_PropertyAliases()
{
	const FString TestName = TEXT("JsonParser.ParseAndBuild.PropertyAliases");

	FString Json = TEXT(R"({
		"storyTag": "Test.Json.PropertyAliases",
		"steps": [
			{"op": "ReadProperty", "dst": "R0", "property": "Health"},
			{"op": "ReadProperty", "dst": "R1", "property": "MaxHealth"},
			{"op": "WriteProperty", "property": "Health", "src": "R0"},
			{"op": "WriteConst", "property": "AttackPower", "value": 42},
			{"op": "IfPropertyLe", "entity": "Self", "property": "Health", "value": 0},
				{"op": "Log", "message": "dead"},
			{"op": "EndIf"},
			{"op": "Halt"}
		]
	})");

	FHktStoryParseResult Result = FHktStoryJsonParser::Get().ParseAndBuild(Json, &TestResolveTag);

	if (!Result.bSuccess)
	{
		FString Errs = FString::Join(Result.Errors, TEXT("; "));
		return FHktTestResult::Fail(TestName, FString::Printf(TEXT("Parse failed: %s"), *Errs));
	}

	return FHktTestResult::Pass(TestName);
}

// ============================================================================
// 15. ParseAndBuild — DispatchEvent 테스트
// ============================================================================

static FHktTestResult Test_ParseAndBuild_DispatchEvent()
{
	const FString TestName = TEXT("JsonParser.ParseAndBuild.DispatchEvent");

	FString Json = TEXT(R"({
		"storyTag": "Test.Json.Dispatch",
		"steps": [
			{"op": "DispatchEvent", "eventTag": "Story.Event.Attack.Basic"},
			{"op": "DispatchEventTo", "eventTag": "Story.Event.Skill.Heal", "target": "Target"},
			{"op": "DispatchEventFrom", "eventTag": "Story.Flow.NPC.Lifecycle", "source": "Spawned"},
			{"op": "Halt"}
		]
	})");

	FHktStoryParseResult Result = FHktStoryJsonParser::Get().ParseAndBuild(Json, &TestResolveTag);

	if (!Result.bSuccess)
	{
		FString Errs = FString::Join(Result.Errors, TEXT("; "));
		return FHktTestResult::Fail(TestName, FString::Printf(TEXT("Parse failed: %s"), *Errs));
	}

	return FHktTestResult::Pass(TestName);
}

// ============================================================================
// 16. ParseAndBuild — Comparison Const 테스트
// ============================================================================

static FHktTestResult Test_ParseAndBuild_CmpConst()
{
	const FString TestName = TEXT("JsonParser.ParseAndBuild.CmpConst");

	FString Json = TEXT(R"({
		"storyTag": "Test.Json.CmpConst",
		"steps": [
			{"op": "LoadConst", "dst": "R0", "value": 10},
			{"op": "CmpEqConst", "dst": "R1", "src": "R0", "value": 10},
			{"op": "CmpGeConst", "dst": "R2", "src": "R0", "value": 5},
			{"op": "CmpLtConst", "dst": "R3", "src": "R0", "value": 20},
			{"op": "Halt"}
		]
	})");

	FHktStoryParseResult Result = FHktStoryJsonParser::Get().ParseAndBuild(Json, &TestResolveTag);

	if (!Result.bSuccess)
	{
		FString Errs = FString::Join(Result.Errors, TEXT("; "));
		return FHktTestResult::Fail(TestName, FString::Printf(TEXT("Parse failed: %s"), *Errs));
	}

	return FHktTestResult::Pass(TestName);
}

// ============================================================================
// 17. Heal Story JSON 파싱 + 실행 테스트
// ============================================================================

static FHktTestResult Test_ParseAndBuild_FullHealPattern()
{
	const FString TestName = TEXT("JsonParser.ParseAndBuild.FullHealPattern");

	// 회복 스킬의 전체 JSON 구조 테스트 — CooldownUpdateConst 인라인 패턴 포함
	FString Json = TEXT(R"({
		"storyTag": "Test.Json.HealFull",
		"tags": {
			"AnimCastHeal": "Anim.UpperBody.Cast.Heal",
			"VfxHealCast": "VFX.Niagara.HealCast",
			"SndHeal": "Sound.Heal"
		},
		"steps": [
			{"op": "GetWorldTime", "dst": "R0"},
			{"op": "LoadConst", "dst": "R1", "value": 60},
			{"op": "LoadConst", "dst": "R2", "value": 100},
			{"op": "Mul", "dst": "R1", "src1": "R1", "src2": "R2"},
			{"op": "LoadStore", "dst": "R2", "property": "AttackSpeed"},
			{"op": "Div", "dst": "R1", "src1": "R1", "src2": "R2"},
			{"op": "Add", "dst": "R0", "src1": "R0", "src2": "R1"},
			{"op": "SaveStore", "property": "NextActionFrame", "src": "R0"},
			{"op": "LoadConst", "dst": "R0", "value": 30},
			{"op": "LoadStore", "dst": "R1", "property": "AttackSpeed"},
			{"op": "Mul", "dst": "R0", "src1": "R0", "src2": "R1"},
			{"op": "LoadConst", "dst": "R1", "value": 60},
			{"op": "Div", "dst": "R0", "src1": "R0", "src2": "R1"},
			{"op": "SaveStore", "property": "MotionPlayRate", "src": "R0"},

			{"op": "AddTag", "entity": "Self", "tag": "AnimCastHeal"},
			{"op": "PlayVFXAttached", "entity": "Self", "tag": "VfxHealCast"},
			{"op": "WaitSeconds", "seconds": 0.8},

			{"op": "ReadProperty", "dst": "R0", "property": "Health"},
			{"op": "ReadProperty", "dst": "R1", "property": "MaxHealth"},
			{"op": "LoadConst", "dst": "R2", "value": 50},
			{"op": "Add", "dst": "R0", "src1": "R0", "src2": "R2"},
			{"op": "IfGt", "a": "R0", "b": "R1"},
				{"op": "Move", "dst": "R0", "src": "R1"},
			{"op": "EndIf"},
			{"op": "WriteProperty", "property": "Health", "src": "R0"},

			{"op": "PlaySound", "tag": "SndHeal"},
			{"op": "RemoveTag", "entity": "Self", "tag": "AnimCastHeal"},
			{"op": "Halt"}
		]
	})");

	FHktStoryParseResult Result = FHktStoryJsonParser::Get().ParseAndBuild(Json, &TestResolveTag);

	if (!Result.bSuccess)
	{
		FString Errs = FString::Join(Result.Errors, TEXT("; "));
		return FHktTestResult::Fail(TestName, FString::Printf(TEXT("Parse failed: %s"), *Errs));
	}

	// 태그 참조 검증 — 태그 별칭이 올바르게 해석되었는지
	if (Result.ReferencedTags.Num() < 3)
		return FHktTestResult::Fail(TestName,
			FString::Printf(TEXT("Expected >= 3 referenced tags, got %d"), Result.ReferencedTags.Num()));

	return FHktTestResult::Pass(TestName);
}

static FHktTestResult Test_ParseAndBuild_SpawnerPattern()
{
	const FString TestName = TEXT("JsonParser.ParseAndBuild.SpawnerPattern");

	// NPC 스포너 패턴 — Label + Jump + SpawnEntity + SetupNPCStats
	FString Json = TEXT(R"({
		"storyTag": "Test.Json.SpawnerPattern",
		"steps": [
			{"op": "Label", "name": "loop"},
			{"op": "HasPlayerInGroup", "dst": "Flag"},
			{"op": "JumpIfNot", "cond": "Flag", "label": "wait"},
			{"op": "CountByTag", "dst": "R0", "tag": "Entity.NPC.Goblin"},
			{"op": "LoadConst", "dst": "R1", "value": 5},
			{"op": "CmpGe", "dst": "Flag", "src1": "R0", "src2": "R1"},
			{"op": "JumpIf", "cond": "Flag", "label": "wait"},

			{"op": "SpawnEntity", "classTag": "Entity.NPC.Goblin"},
			{"op": "SaveConstEntity", "entity": "Spawned", "property": "IsNPC", "value": 1},
			{"op": "SaveConstEntity", "entity": "Spawned", "property": "Health", "value": 80},
			{"op": "SaveConstEntity", "entity": "Spawned", "property": "MaxHealth", "value": 80},
			{"op": "SaveConstEntity", "entity": "Spawned", "property": "AttackPower", "value": 15},
			{"op": "AddTag", "entity": "Spawned", "tag": "Entity.NPC"},
			{"op": "AddTag", "entity": "Spawned", "tag": "Entity.NPC.Goblin"},
			{"op": "SetStance", "entity": "Spawned", "stanceTag": "Entity.Stance.Unarmed"},
			{"op": "DispatchEventFrom", "eventTag": "Story.Flow.NPC.Lifecycle", "source": "Spawned"},

			{"op": "Label", "name": "wait"},
			{"op": "WaitSeconds", "seconds": 10.0},
			{"op": "Jump", "label": "loop"}
		]
	})");

	FHktStoryParseResult Result = FHktStoryJsonParser::Get().ParseAndBuild(Json, &TestResolveTag);

	if (!Result.bSuccess)
	{
		FString Errs = FString::Join(Result.Errors, TEXT("; "));
		return FHktTestResult::Fail(TestName, FString::Printf(TEXT("Parse failed: %s"), *Errs));
	}

	return FHktTestResult::Pass(TestName);
}

// ============================================================================
// Aggregate
// ============================================================================

FHktTestReport RunAllJsonParserTests()
{
	FHktTestReport Report;

	Report.Add(Test_ParseRegister_SpecialRegs());
	Report.Add(Test_ParseRegister_GPRegs());
	Report.Add(Test_ParseRegister_Invalid());
	Report.Add(Test_ParsePropertyId_Valid());
	Report.Add(Test_ParsePropertyId_Invalid());
	Report.Add(Test_IsReadOnlyOp());
	Report.Add(Test_GetValidOpNames());
	Report.Add(Test_ParseAndBuild_MinimalValid());
	Report.Add(Test_ParseAndBuild_InvalidJson());
	Report.Add(Test_ParseAndBuild_MissingStoryTag());
	Report.Add(Test_ParseAndBuild_MissingSteps());
	Report.Add(Test_ParseAndBuild_UnknownOp());
	Report.Add(Test_ParseAndBuild_DataOps());
	Report.Add(Test_ParseAndBuild_StructuredControlFlow());
	Report.Add(Test_ParseAndBuild_TagAliases());
	Report.Add(Test_ParseAndBuild_CancelOnDuplicate());
	Report.Add(Test_ParseAndBuild_Preconditions());
	Report.Add(Test_ParseAndBuild_PreconditionRejectsWrite());
	Report.Add(Test_ParseAndBuild_CombatAndEntity());
	Report.Add(Test_ParseAndBuild_LabelAndJump());
	Report.Add(Test_ParseAndBuild_PropertyAliases());
	Report.Add(Test_ParseAndBuild_DispatchEvent());
	Report.Add(Test_ParseAndBuild_CmpConst());
	Report.Add(Test_ParseAndBuild_FullHealPattern());
	Report.Add(Test_ParseAndBuild_SpawnerPattern());

	return Report;
}

} // namespace HktStoryJsonParserTests
