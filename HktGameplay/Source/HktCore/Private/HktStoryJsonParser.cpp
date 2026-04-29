// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktStoryJsonParser.h"
#include "HktStoryBuilder.h"
#include "HktCoreArchetype.h"
#include "HktCoreProperties.h"
#include "GameplayTagsManager.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonSerializer.h"

namespace
{
	// JSON trait 이름 → HktTrait 포인터. 신규 trait 추가 시 여기에 매핑을 추가한다.
	const FHktPropertyTrait* ResolveTraitByName(const FString& Name)
	{
		if (Name == TEXT("Spatial"))    return HktTrait::Spatial;
		if (Name == TEXT("Movable"))    return HktTrait::Movable;
		if (Name == TEXT("Collidable")) return HktTrait::Collidable;
		if (Name == TEXT("Hittable"))   return HktTrait::Hittable;
		if (Name == TEXT("Combatable")) return HktTrait::Combatable;
		if (Name == TEXT("Animated"))   return HktTrait::Animated;
		if (Name == TEXT("EventParam")) return HktTrait::EventParam;
		if (Name == TEXT("Ownable"))    return HktTrait::Ownable;
		if (Name == TEXT("EquipSlots")) return HktTrait::EquipSlots;
		return nullptr;
	}
}

// ============================================================================
// FHktStoryCmdArgs
// ============================================================================

FHktStoryCmdArgs::FHktStoryCmdArgs(const TSharedPtr<FJsonObject>& InStep, int32 InStepIndex, const FString& InOpName)
	: Step(InStep)
	, StepIndex(InStepIndex)
	, OpName(InOpName)
{
}

RegisterIndex FHktStoryCmdArgs::GetReg(const FString& Key) const
{
	FString Val;
	if (!Step->TryGetStringField(Key, Val))
	{
		Errors.Add(FString::Printf(TEXT("Step %d (%s): missing '%s'"), StepIndex, *OpName, *Key));
		return Reg::R0;
	}
	RegisterIndex Idx = FHktStoryJsonParser::ParseRegister(Val);
	if (Idx == 0xFF)
	{
		Errors.Add(FString::Printf(TEXT("Step %d (%s): invalid register '%s'"), StepIndex, *OpName, *Val));
		return Reg::R0;
	}
	return Idx;
}

// ----------------------------------------------------------------------------
// Schema 2 VarRef 처리
// ----------------------------------------------------------------------------

FHktVar FHktStoryCmdArgs::GetVar(FHktStoryBuilder& B, const FString& Key) const
{
	const TSharedPtr<FJsonValue> V = Step->Values.FindRef(Key);
	if (!V.IsValid())
	{
		Errors.Add(FString::Printf(TEXT("Step %d (%s): missing var '%s'"), StepIndex, *OpName, *Key));
		return B.Self();  // 안전한 기본값 — 에러 누적되어 빌드 실패 처리됨
	}

	// 객체 형태(VarRef): {"var":"name"} / {"self":true} / {"target":true} / {"const":N} / {"block":"name","index":i}
	const TSharedPtr<FJsonObject>* Obj;
	if (V->TryGetObject(Obj))
	{
		bool bSelf = false, bTarget = false;
		if ((*Obj)->TryGetBoolField(TEXT("self"), bSelf) && bSelf) return B.Self();
		if ((*Obj)->TryGetBoolField(TEXT("target"), bTarget) && bTarget) return B.Target();

		FString VarName;
		if ((*Obj)->TryGetStringField(TEXT("var"), VarName))
		{
			return B.ResolveOrCreateNamedVar(VarName);
		}

		double ConstNum;
		if ((*Obj)->TryGetNumberField(TEXT("const"), ConstNum))
		{
			FHktVar Tmp = B.NewVar(*FString::Printf(TEXT("const_%d"), static_cast<int32>(ConstNum)));
			B.LoadConst(Tmp, static_cast<int32>(ConstNum));
			return Tmp;
		}

		FString BlockName;
		double IdxNum = 0;
		if ((*Obj)->TryGetStringField(TEXT("block"), BlockName) &&
		    (*Obj)->TryGetNumberField(TEXT("index"), IdxNum))
		{
			// {"block":"name", "index":i} — NamedBlockMap 으로 같은 이름은 같은 블록을 재사용.
			FHktVarBlock Blk = B.ResolveOrCreateNamedBlock(BlockName, 3);
			const int32 Idx = static_cast<int32>(IdxNum);
			if (Idx >= 0 && Idx < Blk.Num())
			{
				return Blk.Element(Idx);
			}
			Errors.Add(FString::Printf(TEXT("Step %d (%s): block index out of range: %d"), StepIndex, *OpName, Idx));
			return B.Self();
		}

		Errors.Add(FString::Printf(TEXT("Step %d (%s): unrecognized VarRef object for '%s'"), StepIndex, *OpName, *Key));
		return B.Self();
	}

	// 문자열 형태 (Schema 1 호환): "Self", "R0".."R9"
	FString StrVal;
	if (V->TryGetString(StrVal))
	{
		const RegisterIndex R = FHktStoryJsonParser::ParseRegister(StrVal);
		if (R == 0xFF)
		{
			Errors.Add(FString::Printf(TEXT("Step %d (%s): invalid register string '%s'"), StepIndex, *OpName, *StrVal));
			return B.Self();
		}
		// pre-colored 핸들 반환 — 빌더 내부 EnsurePinned 가 같은 인덱스에 같은 VReg 를 부여한다.
		// 직접 만들 수 없으므로 명명 헬퍼를 통한다.
		switch (R)
		{
		case Reg::Self:    return B.Self();
		case Reg::Target:  return B.Target();
		case Reg::Spawned: return B.SpawnedVar();
		case Reg::Hit:     return B.HitVar();
		case Reg::Iter:    return B.IterVar();
		case Reg::Flag:    return B.FlagVar();
		default: break;
		}
		// R0..R9: 이름 기반 변수로 매핑 (schema 2 코드에서 자유롭게 재사용)
		return B.ResolveOrCreateNamedVar(FString::Printf(TEXT("__pre_R%d"), R));
	}

	Errors.Add(FString::Printf(TEXT("Step %d (%s): VarRef '%s' must be string or object"), StepIndex, *OpName, *Key));
	return B.Self();
}

FHktVarBlock FHktStoryCmdArgs::GetVarBlock(FHktStoryBuilder& B, const FString& Key, int32 Count) const
{
	const TSharedPtr<FJsonValue> V = Step->Values.FindRef(Key);
	if (!V.IsValid())
	{
		Errors.Add(FString::Printf(TEXT("Step %d (%s): missing block '%s'"), StepIndex, *OpName, *Key));
		return B.NewVarBlock(Count, TEXT("missing"));
	}
	const TSharedPtr<FJsonObject>* Obj;
	if (V->TryGetObject(Obj))
	{
		FString Name;
		if ((*Obj)->TryGetStringField(TEXT("block"), Name))
		{
			// NamedBlockMap 을 통해 같은 이름의 블록을 재사용한다 (Builder 측에 매핑 보관).
			return B.ResolveOrCreateNamedBlock(Name, Count);
		}
	}
	Errors.Add(FString::Printf(TEXT("Step %d (%s): block '%s' must be {\"block\":\"name\"}"), StepIndex, *OpName, *Key));
	return B.NewVarBlock(Count, TEXT("invalid"));
}

RegisterIndex FHktStoryCmdArgs::GetRegOpt(const FString& Key, RegisterIndex Default) const
{
	FString Val;
	if (!Step->TryGetStringField(Key, Val))
	{
		return Default;
	}
	RegisterIndex Idx = FHktStoryJsonParser::ParseRegister(Val);
	return (Idx != 0xFF) ? Idx : Default;
}

int32 FHktStoryCmdArgs::GetInt(const FString& Key) const
{
	double Val;
	if (!Step->TryGetNumberField(Key, Val))
	{
		Errors.Add(FString::Printf(TEXT("Step %d (%s): missing '%s'"), StepIndex, *OpName, *Key));
		return 0;
	}
	return static_cast<int32>(Val);
}

int32 FHktStoryCmdArgs::GetIntOpt(const FString& Key, int32 Default) const
{
	double Val;
	return Step->TryGetNumberField(Key, Val) ? static_cast<int32>(Val) : Default;
}

float FHktStoryCmdArgs::GetFloatOpt(const FString& Key, float Default) const
{
	double Val;
	return Step->TryGetNumberField(Key, Val) ? static_cast<float>(Val) : Default;
}

FGameplayTag FHktStoryCmdArgs::GetTag(const FString& Key) const
{
	FString Val;
	if (!Step->TryGetStringField(Key, Val))
	{
		Errors.Add(FString::Printf(TEXT("Step %d (%s): missing '%s'"), StepIndex, *OpName, *Key));
		return FGameplayTag();
	}
	if (ResolveTagFunc)
	{
		return ResolveTagFunc(Val);
	}
	return FGameplayTag::RequestGameplayTag(FName(*Val), false);
}

uint16 FHktStoryCmdArgs::GetPropertyId(const FString& Key) const
{
	FString Val;
	if (!Step->TryGetStringField(Key, Val))
	{
		Errors.Add(FString::Printf(TEXT("Step %d (%s): missing '%s'"), StepIndex, *OpName, *Key));
		return 0xFFFF;
	}
	uint16 PropId = FHktStoryJsonParser::ParsePropertyId(Val);
	if (PropId == 0xFFFF)
	{
		Errors.Add(FString::Printf(TEXT("Step %d (%s): invalid PropertyId '%s'"), StepIndex, *OpName, *Val));
	}
	return PropId;
}

FString FHktStoryCmdArgs::GetString(const FString& Key) const
{
	FString Val;
	Step->TryGetStringField(Key, Val);
	return Val;
}

// ============================================================================
// FHktStoryJsonParser — 싱글턴
// ============================================================================

FHktStoryJsonParser& FHktStoryJsonParser::Get()
{
	static FHktStoryJsonParser Instance;
	return Instance;
}

FHktStoryJsonParser::FHktStoryJsonParser()
{
	InitializeCoreCommands();
	InitializeCoreCommandsV2();
}

void FHktStoryJsonParser::RegisterCommand(const FString& OpName, FHktStoryCommandHandler Handler)
{
	CommandMap.Add(OpName, MoveTemp(Handler));
}

void FHktStoryJsonParser::RegisterCommandV2(const FString& OpName, FHktStoryCommandHandler Handler)
{
	CommandMapV2.Add(OpName, MoveTemp(Handler));
}

bool FHktStoryJsonParser::ApplyCommand(FHktStoryBuilder& Builder, const FHktStoryCmdArgs& Args)
{
	// Schema 2: V2 핸들러 우선, 없으면 v1 폴백 (공통 op — Halt, Jump, Yield 등은 register 인자가 없으므로 동일하다).
	if (Args.SchemaVersion >= 2)
	{
		if (const FHktStoryCommandHandler* H2 = CommandMapV2.Find(Args.OpName))
		{
			(*H2)(Builder, Args);
			return true;
		}
	}
	if (const FHktStoryCommandHandler* Handler = CommandMap.Find(Args.OpName))
	{
		(*Handler)(Builder, Args);
		return true;
	}
	return false;
}

TSet<FString> FHktStoryJsonParser::GetValidOpNames() const
{
	TSet<FString> Names;
	Names.Reserve(CommandMap.Num());
	for (const auto& Pair : CommandMap)
	{
		Names.Add(Pair.Key);
	}
	return Names;
}

// ============================================================================
// ParseRegister / ParsePropertyId
// ============================================================================

RegisterIndex FHktStoryJsonParser::ParseRegister(const FString& RegStr)
{
	if (RegStr == TEXT("Self")) return Reg::Self;
	if (RegStr == TEXT("Target")) return Reg::Target;
	if (RegStr == TEXT("Spawned")) return Reg::Spawned;
	if (RegStr == TEXT("Hit")) return Reg::Hit;
	if (RegStr == TEXT("Iter")) return Reg::Iter;
	if (RegStr == TEXT("Flag")) return Reg::Flag;
	if (RegStr == TEXT("Count")) return Reg::Count;
	if (RegStr == TEXT("Temp")) return Reg::Temp;

	// R0-R9
	if (RegStr.StartsWith(TEXT("R")) && RegStr.Len() <= 3)
	{
		int32 Idx = FCString::Atoi(*RegStr.Mid(1));
		if (Idx >= 0 && Idx <= 9) return static_cast<RegisterIndex>(Idx);
	}

	return 0xFF;
}

uint16 FHktStoryJsonParser::ParsePropertyId(const FString& PropStr)
{
	const FHktPropertyDef* Found = HktProperty::FindByName(PropStr);
	return Found ? Found->Id : 0xFFFF;
}

// ============================================================================
// ParseAndBuild
// ============================================================================

FHktStoryParseResult FHktStoryJsonParser::ParseAndBuild(const FString& JsonStr)
{
	return ParseAndBuild(JsonStr, [](const FString& TagStr) -> FGameplayTag {
		return FGameplayTag::RequestGameplayTag(FName(*TagStr), false);
	});
}

FHktStoryParseResult FHktStoryJsonParser::ParseAndBuild(
	const FString& JsonStr,
	const TFunction<FGameplayTag(const FString&)>& ResolveTag)
{
	FHktStoryParseResult Result;

	// JSON 파싱
	TSharedPtr<FJsonObject> Root;
	TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(JsonStr);
	if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
	{
		Result.Errors.Add(TEXT("Invalid JSON syntax"));
		return Result;
	}

	// Schema 버전 (선택, 기본 1) — schema 2 는 VarRef 객체 폼만 허용한다.
	int32 SchemaVersion = 1;
	{
		double SchemaNum;
		if (Root->TryGetNumberField(TEXT("schema"), SchemaNum))
		{
			SchemaVersion = static_cast<int32>(SchemaNum);
			if (SchemaVersion != 1 && SchemaVersion != 2)
			{
				Result.Errors.Add(FString::Printf(TEXT("Unsupported schema version: %d (expected 1 or 2)"), SchemaVersion));
				return Result;
			}
		}
	}

	// Story tag
	FString StoryTagStr;
	if (!Root->TryGetStringField(TEXT("storyTag"), StoryTagStr) || StoryTagStr.IsEmpty())
	{
		Result.Errors.Add(TEXT("Missing or empty 'storyTag' field"));
		return Result;
	}
	Result.StoryTag = StoryTagStr;

	// storyTag 자체도 ResolveTag를 통해 등록 (에디터에서는 자동등록, 런타임에서는 조회)
	FGameplayTag StoryTag = ResolveTag(StoryTagStr);
	if (StoryTag.IsValid())
	{
		Result.ReferencedTags.AddUnique(StoryTag);
	}

	// Tag aliases
	TMap<FString, FGameplayTag> TagAliases;
	const TSharedPtr<FJsonObject>* TagsObj;
	if (Root->TryGetObjectField(TEXT("tags"), TagsObj))
	{
		for (const auto& Pair : (*TagsObj)->Values)
		{
			FString TagName = Pair.Value->AsString();
			FGameplayTag Tag = ResolveTag(TagName);
			if (!Tag.IsValid())
			{
				Result.Warnings.Add(FString::Printf(
					TEXT("Tag '%s' (%s) could not be resolved"), *Pair.Key, *TagName));
			}
			TagAliases.Add(Pair.Key, Tag);
		}
	}

	// Builder 생성
	FHktStoryBuilder Builder = FHktStoryBuilder::Create(FName(*StoryTagStr));

	// Archetype (선택적)
	FString ArchetypeStr;
	if (Root->TryGetStringField(TEXT("archetype"), ArchetypeStr))
	{
		EHktArchetype Arch = FHktArchetypeRegistry::Get().FindByName(*ArchetypeStr);
		if (Arch != EHktArchetype::None)
		{
			Builder.SetArchetype(Arch);
		}
		else
		{
			Result.Warnings.Add(FString::Printf(TEXT("Unknown archetype: '%s'"), *ArchetypeStr));
		}
	}

	// CancelOnDuplicate
	bool bCancelOnDuplicate = false;
	if (Root->TryGetBoolField(TEXT("cancelOnDuplicate"), bCancelOnDuplicate) && bCancelOnDuplicate)
	{
		Builder.CancelOnDuplicate();
	}

	// FlowMode — Self/Target 엔티티 없는 Story (Spawner 등). Validator 가 Self/Target 유효성을 강제하지 않음.
	bool bFlowMode = false;
	if (Root->TryGetBoolField(TEXT("flowMode"), bFlowMode) && bFlowMode)
	{
		Builder.SetFlowMode();
	}

	// RequiresTrait — Self 가 해당 Trait 을 보유해야만 Story 실행. C++ precondition 자동 등록.
	FString RequiresTraitStr;
	if (Root->TryGetStringField(TEXT("requiresTrait"), RequiresTraitStr) && !RequiresTraitStr.IsEmpty())
	{
		const FHktPropertyTrait* Trait = ResolveTraitByName(RequiresTraitStr);
		if (Trait)
		{
			Builder.RequiresTrait(Trait);
		}
		else
		{
			Result.Warnings.Add(FString::Printf(TEXT("requiresTrait: unknown trait '%s'"), *RequiresTraitStr));
		}
	}

	// Alias 해결 + 참조 태그 수집을 포함하는 태그 해석기
	auto ResolveTagWithAlias = [&](const FString& TagStr) -> FGameplayTag
	{
		FGameplayTag Tag;
		if (const FGameplayTag* Found = TagAliases.Find(TagStr))
		{
			Tag = *Found;
		}
		else
		{
			Tag = ResolveTag(TagStr);
		}
		if (Tag.IsValid())
		{
			Result.ReferencedTags.AddUnique(Tag);
		}
		return Tag;
	};

	// Preconditions 배열 (선택)
	const TArray<TSharedPtr<FJsonValue>>* Preconditions;
	if (Root->TryGetArrayField(TEXT("preconditions"), Preconditions))
	{
		if (!ParsePreconditions(*Preconditions, ResolveTagWithAlias, Builder, Result))
		{
			return Result;
		}
	}

	// Steps 배열
	const TArray<TSharedPtr<FJsonValue>>* Steps;
	if (!Root->TryGetArrayField(TEXT("steps"), Steps))
	{
		Result.Errors.Add(TEXT("Missing 'steps' array"));
		return Result;
	}

	// 각 step을 커맨드 맵으로 디스패치
	for (int32 i = 0; i < Steps->Num(); ++i)
	{
		const TSharedPtr<FJsonObject>* StepObj;
		if (!(*Steps)[i]->TryGetObject(StepObj))
		{
			Result.Errors.Add(FString::Printf(TEXT("Step %d: not a JSON object"), i));
			continue;
		}

		FString OpName;
		if (!(*StepObj)->TryGetStringField(TEXT("op"), OpName))
		{
			Result.Errors.Add(FString::Printf(TEXT("Step %d: missing 'op' field"), i));
			continue;
		}

		FHktStoryCmdArgs Args(*StepObj, i, OpName);
		Args.ResolveTagFunc = ResolveTagWithAlias;
		Args.SchemaVersion = SchemaVersion;

		if (!ApplyCommand(Builder, Args))
		{
			Result.Errors.Add(FString::Printf(TEXT("Step %d: unknown operation '%s'"), i, *OpName));
		}
		else if (Args.HasErrors())
		{
			Result.Errors.Append(Args.Errors);
		}
	}

	if (Result.Errors.Num() > 0)
	{
		return Result;
	}

	// 빌드 + 등록
	Builder.BuildAndRegister();
	Result.bSuccess = true;

	return Result;
}

// ============================================================================
// IsReadOnlyOp — Precondition에서 허용되는 읽기 전용 op 판별
// ============================================================================

bool FHktStoryJsonParser::IsReadOnlyOp(const FString& OpName)
{
	static const TSet<FString> ReadOnlyOps = {
		// Control Flow
		TEXT("Label"), TEXT("Jump"), TEXT("JumpIf"), TEXT("JumpIfNot"), TEXT("Halt"), TEXT("Fail"),
		// Structured Control Flow (읽기 전용 — 비교만 수행)
		TEXT("If"), TEXT("IfNot"), TEXT("Else"), TEXT("EndIf"),
		TEXT("IfEq"), TEXT("IfNe"), TEXT("IfLt"), TEXT("IfLe"), TEXT("IfGt"), TEXT("IfGe"),
		TEXT("IfEqConst"), TEXT("IfNeConst"), TEXT("IfLtConst"), TEXT("IfLeConst"), TEXT("IfGtConst"), TEXT("IfGeConst"),
		TEXT("IfPropertyEq"), TEXT("IfPropertyNe"), TEXT("IfPropertyLt"), TEXT("IfPropertyLe"), TEXT("IfPropertyGt"), TEXT("IfPropertyGe"),
		// Data (읽기 전용)
		TEXT("LoadConst"), TEXT("LoadStore"), TEXT("LoadStoreEntity"), TEXT("LoadEntityProperty"), TEXT("ReadProperty"), TEXT("Move"),
		// Arithmetic
		TEXT("Add"), TEXT("Sub"), TEXT("Mul"), TEXT("Div"), TEXT("AddImm"),
		// Comparison
		TEXT("CmpEq"), TEXT("CmpNe"), TEXT("CmpLt"), TEXT("CmpLe"), TEXT("CmpGt"), TEXT("CmpGe"),
		TEXT("CmpEqConst"), TEXT("CmpNeConst"), TEXT("CmpLtConst"), TEXT("CmpLeConst"), TEXT("CmpGtConst"), TEXT("CmpGeConst"),
		// Spatial Query (읽기)
		TEXT("GetDistance"),
		// Tags / Traits (읽기)
		TEXT("HasTag"), TEXT("CheckTrait"), TEXT("IfHasTrait"),
		// Query
		TEXT("CountByTag"), TEXT("GetWorldTime"), TEXT("RandomInt"), TEXT("HasPlayerInGroup"),
		// Item (읽기)
		TEXT("CountByOwner"),
		// Utility
		TEXT("Log"),
	};
	return ReadOnlyOps.Contains(OpName);
}

// ============================================================================
// ParsePreconditions — preconditions 배열 → Builder BeginPrecondition/EndPrecondition
// ============================================================================

bool FHktStoryJsonParser::ParsePreconditions(
	const TArray<TSharedPtr<FJsonValue>>& PreconditionArray,
	const TFunction<FGameplayTag(const FString&)>& ResolveTag,
	FHktStoryBuilder& Builder,
	FHktStoryParseResult& Result)
{
	Builder.BeginPrecondition();

	for (int32 i = 0; i < PreconditionArray.Num(); ++i)
	{
		const TSharedPtr<FJsonObject>* StepObj;
		if (!PreconditionArray[i]->TryGetObject(StepObj))
		{
			Result.Errors.Add(FString::Printf(TEXT("Precondition %d: not a JSON object"), i));
			continue;
		}

		FString OpName;
		if (!(*StepObj)->TryGetStringField(TEXT("op"), OpName))
		{
			Result.Errors.Add(FString::Printf(TEXT("Precondition %d: missing 'op' field"), i));
			continue;
		}

		if (!IsReadOnlyOp(OpName))
		{
			Result.Errors.Add(FString::Printf(
				TEXT("Precondition %d: operation '%s' is not allowed in preconditions (write/wait ops are forbidden)"),
				i, *OpName));
			continue;
		}

		FHktStoryCmdArgs Args(*StepObj, i, OpName);
		Args.ResolveTagFunc = ResolveTag;

		if (!ApplyCommand(Builder, Args))
		{
			Result.Errors.Add(FString::Printf(TEXT("Precondition %d: unknown operation '%s'"), i, *OpName));
		}
		else if (Args.HasErrors())
		{
			Result.Errors.Append(Args.Errors);
		}
	}

	Builder.EndPrecondition();

	return Result.Errors.Num() == 0;
}

// ============================================================================
// InitializeCoreCommands — 모든 Builder 명령어를 람다로 등록
// ============================================================================

void FHktStoryJsonParser::InitializeCoreCommands()
{
	// ======================== Control Flow ========================

	RegisterCommand(TEXT("Label"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.Label(B.ResolveLabel(A.GetString(TEXT("name"))));
	});
	RegisterCommand(TEXT("Jump"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.Jump(B.ResolveLabel(A.GetString(TEXT("label"))));
	});
	RegisterCommand(TEXT("JumpIf"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.JumpIf(A.GetReg(TEXT("cond")), B.ResolveLabel(A.GetString(TEXT("label"))));
	});
	RegisterCommand(TEXT("JumpIfNot"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.JumpIfNot(A.GetReg(TEXT("cond")), B.ResolveLabel(A.GetString(TEXT("label"))));
	});
	RegisterCommand(TEXT("Yield"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.Yield(A.GetIntOpt(TEXT("frames"), 1));
	});
	RegisterCommand(TEXT("WaitSeconds"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.WaitSeconds(A.GetFloatOpt(TEXT("seconds"), 1.0f));
	});
	RegisterCommand(TEXT("Halt"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.Halt();
	});
	RegisterCommand(TEXT("Fail"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.Fail();
	});

	// ======================== Event Wait ========================

	RegisterCommand(TEXT("WaitCollision"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.WaitCollision(A.GetRegOpt(TEXT("entity"), Reg::Spawned));
	});
	RegisterCommand(TEXT("WaitAnimEnd"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.WaitAnimEnd(A.GetRegOpt(TEXT("entity"), Reg::Self));
	});
	RegisterCommand(TEXT("WaitMoveEnd"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.WaitMoveEnd(A.GetRegOpt(TEXT("entity"), Reg::Self));
	});

	// ======================== Data Operations ========================

	RegisterCommand(TEXT("LoadConst"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.LoadConst(A.GetReg(TEXT("dst")), A.GetInt(TEXT("value")));
	});
	RegisterCommand(TEXT("LoadStore"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.LoadStore(A.GetReg(TEXT("dst")), A.GetPropertyId(TEXT("property")));
	});
	RegisterCommand(TEXT("LoadEntityProperty"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.LoadEntityProperty(A.GetReg(TEXT("dst")), A.GetReg(TEXT("entity")), A.GetPropertyId(TEXT("property")));
	});
	RegisterCommand(TEXT("SaveStore"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.SaveStore(A.GetPropertyId(TEXT("property")), A.GetReg(TEXT("src")));
	});
	RegisterCommand(TEXT("SaveEntityProperty"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.SaveEntityProperty(A.GetReg(TEXT("entity")), A.GetPropertyId(TEXT("property")), A.GetReg(TEXT("src")));
	});
	RegisterCommand(TEXT("SaveConst"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.SaveConst(A.GetPropertyId(TEXT("property")), A.GetInt(TEXT("value")));
	});
	RegisterCommand(TEXT("SaveConstEntity"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.SaveConstEntity(A.GetReg(TEXT("entity")), A.GetPropertyId(TEXT("property")), A.GetInt(TEXT("value")));
	});
	RegisterCommand(TEXT("Move"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.Move(A.GetReg(TEXT("dst")), A.GetReg(TEXT("src")));
	});

	// ======================== Arithmetic ========================

	RegisterCommand(TEXT("Add"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.Add(A.GetReg(TEXT("dst")), A.GetReg(TEXT("src1")), A.GetReg(TEXT("src2")));
	});
	RegisterCommand(TEXT("Sub"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.Sub(A.GetReg(TEXT("dst")), A.GetReg(TEXT("src1")), A.GetReg(TEXT("src2")));
	});
	RegisterCommand(TEXT("Mul"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.Mul(A.GetReg(TEXT("dst")), A.GetReg(TEXT("src1")), A.GetReg(TEXT("src2")));
	});
	RegisterCommand(TEXT("Div"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.Div(A.GetReg(TEXT("dst")), A.GetReg(TEXT("src1")), A.GetReg(TEXT("src2")));
	});
	RegisterCommand(TEXT("AddImm"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.AddImm(A.GetReg(TEXT("dst")), A.GetReg(TEXT("src")), A.GetInt(TEXT("imm")));
	});

	// ======================== Comparison ========================

	RegisterCommand(TEXT("CmpEq"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.CmpEq(A.GetReg(TEXT("dst")), A.GetReg(TEXT("src1")), A.GetReg(TEXT("src2")));
	});
	RegisterCommand(TEXT("CmpNe"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.CmpNe(A.GetReg(TEXT("dst")), A.GetReg(TEXT("src1")), A.GetReg(TEXT("src2")));
	});
	RegisterCommand(TEXT("CmpLt"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.CmpLt(A.GetReg(TEXT("dst")), A.GetReg(TEXT("src1")), A.GetReg(TEXT("src2")));
	});
	RegisterCommand(TEXT("CmpLe"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.CmpLe(A.GetReg(TEXT("dst")), A.GetReg(TEXT("src1")), A.GetReg(TEXT("src2")));
	});
	RegisterCommand(TEXT("CmpGt"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.CmpGt(A.GetReg(TEXT("dst")), A.GetReg(TEXT("src1")), A.GetReg(TEXT("src2")));
	});
	RegisterCommand(TEXT("CmpGe"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.CmpGe(A.GetReg(TEXT("dst")), A.GetReg(TEXT("src1")), A.GetReg(TEXT("src2")));
	});

	// ======================== Entity ========================

	RegisterCommand(TEXT("SpawnEntity"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.SpawnEntity(A.GetTag(TEXT("classTag")));
	});
	RegisterCommand(TEXT("DestroyEntity"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.DestroyEntity(A.GetReg(TEXT("entity")));
	});

	// ======================== Position & Movement ========================

	RegisterCommand(TEXT("GetPosition"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.GetPosition(A.GetReg(TEXT("dst")), A.GetReg(TEXT("entity")));
	});
	RegisterCommand(TEXT("SetPosition"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.SetPosition(A.GetReg(TEXT("entity")), A.GetReg(TEXT("src")));
	});
	RegisterCommand(TEXT("MoveToward"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.MoveToward(A.GetReg(TEXT("entity")), A.GetReg(TEXT("targetPos")), A.GetInt(TEXT("force")));
	});
	RegisterCommand(TEXT("MoveForward"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.MoveForward(A.GetReg(TEXT("entity")), A.GetInt(TEXT("force")));
	});
	RegisterCommand(TEXT("StopMovement"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.StopMovement(A.GetReg(TEXT("entity")));
	});
	RegisterCommand(TEXT("GetDistance"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.GetDistance(A.GetReg(TEXT("dst")), A.GetReg(TEXT("entity1")), A.GetReg(TEXT("entity2")));
	});
	RegisterCommand(TEXT("LookAt"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.LookAt(A.GetReg(TEXT("entity")), A.GetReg(TEXT("target")));
	});

	// ======================== Spatial Query ========================

	RegisterCommand(TEXT("FindInRadius"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.FindInRadius(A.GetReg(TEXT("center")), A.GetInt(TEXT("radius")));
	});
	RegisterCommand(TEXT("NextFound"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.NextFound();
	});
	RegisterCommand(TEXT("ForEachInRadius"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.ForEachInRadius(A.GetReg(TEXT("center")), A.GetInt(TEXT("radius")));
	});
	RegisterCommand(TEXT("FindInRadiusEx"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.FindInRadiusEx(A.GetReg(TEXT("center")), A.GetInt(TEXT("radius")), static_cast<uint32>(A.GetInt(TEXT("filter"))));
	});
	RegisterCommand(TEXT("ForEachInRadiusEx"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.ForEachInRadiusEx(A.GetReg(TEXT("center")), A.GetInt(TEXT("radius")), static_cast<uint32>(A.GetInt(TEXT("filter"))));
	});
	RegisterCommand(TEXT("EndForEach"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.EndForEach();
	});
	RegisterCommand(TEXT("InteractTerrain"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.InteractTerrain(A.GetRegOpt(TEXT("center"), Reg::Self), A.GetInt(TEXT("radius")));
	});

	// ======================== Combat ========================

	RegisterCommand(TEXT("ApplyDamage"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.ApplyDamage(A.GetReg(TEXT("target")), A.GetReg(TEXT("amount")));
	});
	RegisterCommand(TEXT("ApplyDamageConst"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.ApplyDamageConst(A.GetReg(TEXT("target")), A.GetInt(TEXT("amount")));
	});
	RegisterCommand(TEXT("ApplyEffect"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.ApplyEffect(A.GetReg(TEXT("target")), A.GetTag(TEXT("effectTag")));
	});
	RegisterCommand(TEXT("RemoveEffect"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.RemoveEffect(A.GetReg(TEXT("target")), A.GetTag(TEXT("effectTag")));
	});

	// ======================== VFX ========================

	RegisterCommand(TEXT("PlayVFX"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.PlayVFX(A.GetReg(TEXT("pos")), A.GetTag(TEXT("tag")));
	});
	RegisterCommand(TEXT("PlayVFXAttached"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.PlayVFXAttached(A.GetReg(TEXT("entity")), A.GetTag(TEXT("tag")));
	});

	// ======================== Audio ========================

	RegisterCommand(TEXT("PlaySound"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.PlaySound(A.GetTag(TEXT("tag")));
	});
	RegisterCommand(TEXT("PlaySoundAtLocation"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.PlaySoundAtLocation(A.GetReg(TEXT("pos")), A.GetTag(TEXT("tag")));
	});

	// ======================== Tags ========================

	RegisterCommand(TEXT("AddTag"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.AddTag(A.GetReg(TEXT("entity")), A.GetTag(TEXT("tag")));
	});
	RegisterCommand(TEXT("RemoveTag"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.RemoveTag(A.GetReg(TEXT("entity")), A.GetTag(TEXT("tag")));
	});
	RegisterCommand(TEXT("HasTag"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.HasTag(A.GetReg(TEXT("dst")), A.GetReg(TEXT("entity")), A.GetTag(TEXT("tag")));
	});
	RegisterCommand(TEXT("CheckTrait"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		const FString TraitName = A.GetString(TEXT("trait"));
		const FHktPropertyTrait* Trait = ResolveTraitByName(TraitName);
		if (!Trait)
		{
			A.Errors.Add(FString::Printf(TEXT("CheckTrait: unknown trait '%s'"), *TraitName));
			return;
		}
		B.CheckTrait(A.GetReg(TEXT("dst")), A.GetReg(TEXT("entity")), Trait);
	});
	RegisterCommand(TEXT("IfHasTrait"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		const FString TraitName = A.GetString(TEXT("trait"));
		const FHktPropertyTrait* Trait = ResolveTraitByName(TraitName);
		if (!Trait)
		{
			A.Errors.Add(FString::Printf(TEXT("IfHasTrait: unknown trait '%s'"), *TraitName));
			return;
		}
		B.IfHasTrait(A.GetReg(TEXT("entity")), Trait);
	});
	RegisterCommand(TEXT("CountByTag"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.CountByTag(A.GetReg(TEXT("dst")), A.GetTag(TEXT("tag")));
	});

	// ======================== World Query ========================

	RegisterCommand(TEXT("GetWorldTime"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.GetWorldTime(A.GetReg(TEXT("dst")));
	});
	RegisterCommand(TEXT("RandomInt"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.RandomInt(A.GetReg(TEXT("dst")), A.GetReg(TEXT("modulus")));
	});
	RegisterCommand(TEXT("HasPlayerInGroup"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.HasPlayerInGroup(A.GetReg(TEXT("dst")));
	});

	// ======================== Item System ========================

	RegisterCommand(TEXT("CountByOwner"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.CountByOwner(A.GetReg(TEXT("dst")), A.GetReg(TEXT("owner")), A.GetTag(TEXT("tag")));
	});
	RegisterCommand(TEXT("FindByOwner"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.FindByOwner(A.GetReg(TEXT("owner")), A.GetTag(TEXT("tag")));
	});
	RegisterCommand(TEXT("SetOwnerUid"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.SetOwnerUid(A.GetReg(TEXT("entity")));
	});
	RegisterCommand(TEXT("ClearOwnerUid"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.ClearOwnerUid(A.GetReg(TEXT("entity")));
	});

	// ======================== Stance ========================

	RegisterCommand(TEXT("SetStance"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.SetStance(A.GetReg(TEXT("entity")), A.GetTag(TEXT("stanceTag")));
	});
	RegisterCommand(TEXT("SetItemSkillTag"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.SetItemSkillTag(A.GetReg(TEXT("entity")), A.GetTag(TEXT("skillTag")));
	});

	// ======================== Structured Control Flow ========================

	RegisterCommand(TEXT("If"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.If(A.GetReg(TEXT("cond")));
	});
	RegisterCommand(TEXT("IfNot"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.IfNot(A.GetReg(TEXT("cond")));
	});
	RegisterCommand(TEXT("Else"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.Else();
	});
	RegisterCommand(TEXT("EndIf"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.EndIf();
	});

	// Register comparison + If variants
	RegisterCommand(TEXT("IfEq"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.IfEq(A.GetReg(TEXT("a")), A.GetReg(TEXT("b")));
	});
	RegisterCommand(TEXT("IfNe"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.IfNe(A.GetReg(TEXT("a")), A.GetReg(TEXT("b")));
	});
	RegisterCommand(TEXT("IfLt"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.IfLt(A.GetReg(TEXT("a")), A.GetReg(TEXT("b")));
	});
	RegisterCommand(TEXT("IfLe"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.IfLe(A.GetReg(TEXT("a")), A.GetReg(TEXT("b")));
	});
	RegisterCommand(TEXT("IfGt"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.IfGt(A.GetReg(TEXT("a")), A.GetReg(TEXT("b")));
	});
	RegisterCommand(TEXT("IfGe"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.IfGe(A.GetReg(TEXT("a")), A.GetReg(TEXT("b")));
	});

	// Register vs Constant + If
	RegisterCommand(TEXT("IfEqConst"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.IfEqConst(A.GetReg(TEXT("src")), A.GetInt(TEXT("value")));
	});
	RegisterCommand(TEXT("IfNeConst"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.IfNeConst(A.GetReg(TEXT("src")), A.GetInt(TEXT("value")));
	});
	RegisterCommand(TEXT("IfLtConst"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.IfLtConst(A.GetReg(TEXT("src")), A.GetInt(TEXT("value")));
	});
	RegisterCommand(TEXT("IfLeConst"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.IfLeConst(A.GetReg(TEXT("src")), A.GetInt(TEXT("value")));
	});
	RegisterCommand(TEXT("IfGtConst"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.IfGtConst(A.GetReg(TEXT("src")), A.GetInt(TEXT("value")));
	});
	RegisterCommand(TEXT("IfGeConst"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.IfGeConst(A.GetReg(TEXT("src")), A.GetInt(TEXT("value")));
	});

	// Entity Property vs Constant + If
	RegisterCommand(TEXT("IfPropertyEq"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.IfPropertyEq(A.GetReg(TEXT("entity")), A.GetPropertyId(TEXT("property")), A.GetInt(TEXT("value")));
	});
	RegisterCommand(TEXT("IfPropertyNe"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.IfPropertyNe(A.GetReg(TEXT("entity")), A.GetPropertyId(TEXT("property")), A.GetInt(TEXT("value")));
	});
	RegisterCommand(TEXT("IfPropertyLt"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.IfPropertyLt(A.GetReg(TEXT("entity")), A.GetPropertyId(TEXT("property")), A.GetInt(TEXT("value")));
	});
	RegisterCommand(TEXT("IfPropertyLe"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.IfPropertyLe(A.GetReg(TEXT("entity")), A.GetPropertyId(TEXT("property")), A.GetInt(TEXT("value")));
	});
	RegisterCommand(TEXT("IfPropertyGt"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.IfPropertyGt(A.GetReg(TEXT("entity")), A.GetPropertyId(TEXT("property")), A.GetInt(TEXT("value")));
	});
	RegisterCommand(TEXT("IfPropertyGe"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.IfPropertyGe(A.GetReg(TEXT("entity")), A.GetPropertyId(TEXT("property")), A.GetInt(TEXT("value")));
	});

	// Repeat loop
	RegisterCommand(TEXT("Repeat"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.Repeat(A.GetInt(TEXT("count")));
	});
	RegisterCommand(TEXT("EndRepeat"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.EndRepeat();
	});

	// ======================== Comparison vs Constant ========================

	RegisterCommand(TEXT("CmpEqConst"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.CmpEqConst(A.GetReg(TEXT("dst")), A.GetReg(TEXT("src")), A.GetInt(TEXT("value")));
	});
	RegisterCommand(TEXT("CmpNeConst"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.CmpNeConst(A.GetReg(TEXT("dst")), A.GetReg(TEXT("src")), A.GetInt(TEXT("value")));
	});
	RegisterCommand(TEXT("CmpLtConst"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.CmpLtConst(A.GetReg(TEXT("dst")), A.GetReg(TEXT("src")), A.GetInt(TEXT("value")));
	});
	RegisterCommand(TEXT("CmpLeConst"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.CmpLeConst(A.GetReg(TEXT("dst")), A.GetReg(TEXT("src")), A.GetInt(TEXT("value")));
	});
	RegisterCommand(TEXT("CmpGtConst"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.CmpGtConst(A.GetReg(TEXT("dst")), A.GetReg(TEXT("src")), A.GetInt(TEXT("value")));
	});
	RegisterCommand(TEXT("CmpGeConst"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.CmpGeConst(A.GetReg(TEXT("dst")), A.GetReg(TEXT("src")), A.GetInt(TEXT("value")));
	});

	// ======================== Composite Movement ========================

	RegisterCommand(TEXT("CopyPosition"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.CopyPosition(A.GetReg(TEXT("dst")), A.GetReg(TEXT("src")));
	});
	RegisterCommand(TEXT("MoveTowardProperty"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.MoveTowardProperty(A.GetReg(TEXT("entity")), A.GetPropertyId(TEXT("baseProp")), A.GetInt(TEXT("force")));
	});

	// ======================== Composite Presentation ========================

	RegisterCommand(TEXT("PlayVFXAtEntity"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.PlayVFXAtEntity(A.GetReg(TEXT("entity")), A.GetTag(TEXT("tag")));
	});
	RegisterCommand(TEXT("PlaySoundAtEntity"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.PlaySoundAtEntity(A.GetReg(TEXT("entity")), A.GetTag(TEXT("tag")));
	});
	RegisterCommand(TEXT("PlayAnim"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.PlayAnim(A.GetReg(TEXT("entity")), A.GetTag(TEXT("tag")));
	});

	// ======================== Wait Patterns ========================

	RegisterCommand(TEXT("WaitUntilCountZero"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.WaitUntilCountZero(A.GetTag(TEXT("tag")), A.GetFloatOpt(TEXT("interval"), 2.0f));
	});

	// ======================== Event Dispatch ========================

	RegisterCommand(TEXT("DispatchEvent"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.DispatchEvent(A.GetTag(TEXT("eventTag")));
	});
	RegisterCommand(TEXT("DispatchEventTo"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.DispatchEventTo(A.GetTag(TEXT("eventTag")), A.GetReg(TEXT("target")));
	});
	RegisterCommand(TEXT("DispatchEventFrom"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.DispatchEventFrom(A.GetTag(TEXT("eventTag")), A.GetReg(TEXT("source")));
	});

	// ======================== Property Aliases ========================

	RegisterCommand(TEXT("ReadProperty"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.ReadProperty(A.GetReg(TEXT("dst")), A.GetPropertyId(TEXT("property")));
	});
	RegisterCommand(TEXT("WriteProperty"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.WriteProperty(A.GetPropertyId(TEXT("property")), A.GetReg(TEXT("src")));
	});
	RegisterCommand(TEXT("WriteConst"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.WriteConst(A.GetPropertyId(TEXT("property")), A.GetInt(TEXT("value")));
	});

	// ======================== Entity Property (additional) ========================

	RegisterCommand(TEXT("LoadStoreEntity"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.LoadStoreEntity(A.GetReg(TEXT("dst")), A.GetReg(TEXT("entity")), A.GetPropertyId(TEXT("property")));
	});

	// ======================== Utility ========================

	RegisterCommand(TEXT("Log"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
		B.Log(A.GetString(TEXT("message")));
	});
}


// ============================================================================
// InitializeCoreCommandsV2 — Schema 2 (FHktVar VarRef) 핸들러 베이스라인
//
// 본 맵은 schema 2 Story 가 사용하며, 등록되지 않은 op 는 자동으로 v1 핸들러로 폴백한다.
// PR-3 의 strangler-fig 마이그레이션이 진행되면서 점진적으로 op 가 추가될 예정.
// ============================================================================

void FHktStoryJsonParser::InitializeCoreCommandsV2()
{
    // ---- Data ----
    RegisterCommandV2(TEXT("LoadConst"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.LoadConst(A.GetVar(B, TEXT("dst")), A.GetInt(TEXT("value")));
    });
    RegisterCommandV2(TEXT("LoadStore"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.LoadStore(A.GetVar(B, TEXT("dst")), A.GetPropertyId(TEXT("property")));
    });
    RegisterCommandV2(TEXT("LoadStoreEntity"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.LoadStoreEntity(A.GetVar(B, TEXT("dst")), A.GetVar(B, TEXT("entity")), A.GetPropertyId(TEXT("property")));
    });
    RegisterCommandV2(TEXT("SaveStore"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.SaveStore(A.GetPropertyId(TEXT("property")), A.GetVar(B, TEXT("src")));
    });
    RegisterCommandV2(TEXT("SaveStoreEntity"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.SaveStoreEntity(A.GetVar(B, TEXT("entity")), A.GetPropertyId(TEXT("property")), A.GetVar(B, TEXT("src")));
    });
    RegisterCommandV2(TEXT("SaveConstEntity"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.SaveConstEntity(A.GetVar(B, TEXT("entity")), A.GetPropertyId(TEXT("property")), A.GetInt(TEXT("value")));
    });
    RegisterCommandV2(TEXT("Move"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.Move(A.GetVar(B, TEXT("dst")), A.GetVar(B, TEXT("src")));
    });

    // ---- Arithmetic ----
    RegisterCommandV2(TEXT("Add"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.Add(A.GetVar(B, TEXT("dst")), A.GetVar(B, TEXT("src1")), A.GetVar(B, TEXT("src2")));
    });
    RegisterCommandV2(TEXT("Sub"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.Sub(A.GetVar(B, TEXT("dst")), A.GetVar(B, TEXT("src1")), A.GetVar(B, TEXT("src2")));
    });
    RegisterCommandV2(TEXT("Mul"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.Mul(A.GetVar(B, TEXT("dst")), A.GetVar(B, TEXT("src1")), A.GetVar(B, TEXT("src2")));
    });
    RegisterCommandV2(TEXT("Div"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.Div(A.GetVar(B, TEXT("dst")), A.GetVar(B, TEXT("src1")), A.GetVar(B, TEXT("src2")));
    });

    // ---- Comparison ----
    RegisterCommandV2(TEXT("CmpEq"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.CmpEq(A.GetVar(B, TEXT("dst")), A.GetVar(B, TEXT("src1")), A.GetVar(B, TEXT("src2")));
    });
    RegisterCommandV2(TEXT("CmpNe"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.CmpNe(A.GetVar(B, TEXT("dst")), A.GetVar(B, TEXT("src1")), A.GetVar(B, TEXT("src2")));
    });
    RegisterCommandV2(TEXT("CmpLt"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.CmpLt(A.GetVar(B, TEXT("dst")), A.GetVar(B, TEXT("src1")), A.GetVar(B, TEXT("src2")));
    });

    // ---- Tags ----
    RegisterCommandV2(TEXT("AddTag"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.AddTag(A.GetVar(B, TEXT("entity")), A.GetTag(TEXT("tag")));
    });
    RegisterCommandV2(TEXT("RemoveTag"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.RemoveTag(A.GetVar(B, TEXT("entity")), A.GetTag(TEXT("tag")));
    });
    RegisterCommandV2(TEXT("HasTag"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.HasTag(A.GetVar(B, TEXT("dst")), A.GetVar(B, TEXT("entity")), A.GetTag(TEXT("tag")));
    });

    // ---- Entity ----
    RegisterCommandV2(TEXT("SpawnEntity"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        // 명시 출력 변수: 결과를 이름에 바인딩 (선택)
        FHktVar Out = B.SpawnEntityVar(A.GetTag(TEXT("classTag")));
        FString OutName;
        if (A.Step->TryGetStringField(TEXT("out"), OutName))
        {
            B.Move(B.ResolveOrCreateNamedVar(OutName), Out);
        }
    });
    RegisterCommandV2(TEXT("DestroyEntity"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.DestroyEntity(A.GetVar(B, TEXT("entity")));
    });

    // ---- Combat ----
    RegisterCommandV2(TEXT("ApplyDamage"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.ApplyDamage(A.GetVar(B, TEXT("target")), A.GetVar(B, TEXT("amount")));
    });
    RegisterCommandV2(TEXT("ApplyDamageConst"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.ApplyDamageConst(A.GetVar(B, TEXT("target")), A.GetInt(TEXT("amount")));
    });

    // ---- Wait ----
    RegisterCommandV2(TEXT("WaitCollision"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.WaitCollision(A.GetVar(B, TEXT("entity")));
    });

    // ---- Movement ----
    RegisterCommandV2(TEXT("MoveForward"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.MoveForward(A.GetVar(B, TEXT("entity")), A.GetInt(TEXT("force")));
    });
    RegisterCommandV2(TEXT("CopyPosition"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.CopyPosition(A.GetVar(B, TEXT("dst")), A.GetVar(B, TEXT("src")));
    });
    RegisterCommandV2(TEXT("StopMovement"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.StopMovement(A.GetVar(B, TEXT("entity")));
    });

    // ---- Presentation ----
    RegisterCommandV2(TEXT("PlayVFXAttached"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.PlayVFXAttached(A.GetVar(B, TEXT("entity")), A.GetTag(TEXT("tag")));
    });
    RegisterCommandV2(TEXT("PlayAnim"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.PlayAnim(A.GetVar(B, TEXT("entity")), A.GetTag(TEXT("tag")));
    });
    RegisterCommandV2(TEXT("ApplyEffect"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.ApplyEffect(A.GetVar(B, TEXT("target")), A.GetTag(TEXT("effectTag")));
    });
    RegisterCommandV2(TEXT("RemoveEffect"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.RemoveEffect(A.GetVar(B, TEXT("target")), A.GetTag(TEXT("effectTag")));
    });

    // ---- Position & Block I/O ----
    // GetPosition: out 으로 명시된 named block 에 결과 위치(3슬롯) 를 바인딩한다.
    RegisterCommandV2(TEXT("GetPosition"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        FString OutName;
        if (!A.Step->TryGetStringField(TEXT("out"), OutName) || OutName.IsEmpty())
        {
            A.Errors.Add(FString::Printf(TEXT("Step %d (GetPosition): missing 'out' (block name)"), A.StepIndex));
            return;
        }
        FHktVarBlock OutBlock = B.ResolveOrCreateNamedBlock(OutName, 3);
        FHktVarBlock Tmp = B.GetPosition(A.GetVar(B, TEXT("entity")));
        // GetPosition 은 매번 새 블록을 발급하므로 named block 으로 옮긴다.
        B.Move(OutBlock.Element(0), Tmp.Element(0));
        B.Move(OutBlock.Element(1), Tmp.Element(1));
        B.Move(OutBlock.Element(2), Tmp.Element(2));
    });
    RegisterCommandV2(TEXT("SetPosition"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.SetPosition(A.GetVar(B, TEXT("entity")), A.GetVarBlock(B, TEXT("pos"), 3));
    });
    RegisterCommandV2(TEXT("MoveToward"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.MoveToward(A.GetVar(B, TEXT("entity")), A.GetVarBlock(B, TEXT("targetPos"), 3), A.GetInt(TEXT("force")));
    });
    RegisterCommandV2(TEXT("PlayVFX"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.PlayVFX(A.GetVarBlock(B, TEXT("pos"), 3), A.GetTag(TEXT("tag")));
    });
    RegisterCommandV2(TEXT("PlaySoundAtLocation"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.PlaySoundAtLocation(A.GetVarBlock(B, TEXT("pos"), 3), A.GetTag(TEXT("tag")));
    });
    RegisterCommandV2(TEXT("LookAt"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.LookAt(A.GetVar(B, TEXT("entity")), A.GetVar(B, TEXT("target")));
    });
    RegisterCommandV2(TEXT("ApplyJump"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.ApplyJump(A.GetVar(B, TEXT("entity")), A.GetInt(TEXT("impulseVelZ")));
    });
    RegisterCommandV2(TEXT("GetDistance"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.GetDistance(A.GetVar(B, TEXT("dst")), A.GetVar(B, TEXT("entity1")), A.GetVar(B, TEXT("entity2")));
    });

    // ---- Wait variants ----
    // WaitCollision 은 기존 v2 핸들러를 덮어써 out 바인딩을 지원한다.
    RegisterCommandV2(TEXT("WaitCollision"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        FHktVar Hit = B.WaitCollision(A.GetVar(B, TEXT("entity")));
        FString OutName;
        if (A.Step->TryGetStringField(TEXT("out"), OutName) && !OutName.IsEmpty())
        {
            B.Move(B.ResolveOrCreateNamedVar(OutName), Hit);
        }
    });
    RegisterCommandV2(TEXT("WaitAnimEnd"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.WaitAnimEnd(A.GetVar(B, TEXT("entity")));
    });
    RegisterCommandV2(TEXT("WaitMoveEnd"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.WaitMoveEnd(A.GetVar(B, TEXT("entity")));
    });
    RegisterCommandV2(TEXT("WaitGrounded"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.WaitGrounded(A.GetVar(B, TEXT("entity")));
    });

    // ---- Spatial Query ----
    RegisterCommandV2(TEXT("FindInRadius"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.FindInRadius(A.GetVar(B, TEXT("center")), A.GetInt(TEXT("radius")));
    });
    RegisterCommandV2(TEXT("FindInRadiusEx"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.FindInRadiusEx(A.GetVar(B, TEXT("center")), A.GetInt(TEXT("radius")), static_cast<uint32>(A.GetInt(TEXT("filter"))));
    });
    RegisterCommandV2(TEXT("ForEachInRadius"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.ForEachInRadius_Begin(A.GetVar(B, TEXT("center")), A.GetInt(TEXT("radius")));
    });
    // EndForEach / NextFound 는 인자가 없어 v1 핸들러로도 충분하지만 명시 등록하여 V2 우선 디스패치 시 일관성 확보.
    RegisterCommandV2(TEXT("EndForEach"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.ForEachInRadius_End();
    });
    RegisterCommandV2(TEXT("NextFound"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.NextFound();
    });

    // ---- Tags / Traits ----
    RegisterCommandV2(TEXT("CheckTrait"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        const FString TraitName = A.GetString(TEXT("trait"));
        const FHktPropertyTrait* Trait = ResolveTraitByName(TraitName);
        if (!Trait)
        {
            A.Errors.Add(FString::Printf(TEXT("CheckTrait: unknown trait '%s'"), *TraitName));
            return;
        }
        B.CheckTrait(A.GetVar(B, TEXT("dst")), A.GetVar(B, TEXT("entity")), Trait);
    });
    RegisterCommandV2(TEXT("IfHasTrait"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        const FString TraitName = A.GetString(TEXT("trait"));
        const FHktPropertyTrait* Trait = ResolveTraitByName(TraitName);
        if (!Trait)
        {
            A.Errors.Add(FString::Printf(TEXT("IfHasTrait: unknown trait '%s'"), *TraitName));
            return;
        }
        B.IfHasTrait(A.GetVar(B, TEXT("entity")), Trait);
    });
    RegisterCommandV2(TEXT("CountByTag"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.CountByTag(A.GetVar(B, TEXT("dst")), A.GetTag(TEXT("tag")));
    });

    // ---- World / Item ----
    RegisterCommandV2(TEXT("GetWorldTime"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.GetWorldTime(A.GetVar(B, TEXT("dst")));
    });
    RegisterCommandV2(TEXT("RandomInt"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        // Builder 시그니처는 (Dst, ModulusVar). JSON 은 modulus VarRef 를 받는다.
        B.RandomInt(A.GetVar(B, TEXT("dst")), A.GetVar(B, TEXT("modulus")));
    });
    RegisterCommandV2(TEXT("HasPlayerInGroup"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.HasPlayerInGroup(A.GetVar(B, TEXT("dst")));
    });
    RegisterCommandV2(TEXT("CountByOwner"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.CountByOwner(A.GetVar(B, TEXT("dst")), A.GetVar(B, TEXT("owner")), A.GetTag(TEXT("tag")));
    });
    RegisterCommandV2(TEXT("FindByOwner"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        // Builder 시그니처는 (OwnerEntity, Tag) 만. dst/failLabel 은 v1 형식의 잔재이므로 무시된다.
        B.FindByOwner(A.GetVar(B, TEXT("owner")), A.GetTag(TEXT("tag")));
    });
    RegisterCommandV2(TEXT("SetOwnerUid"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.SetOwnerUid(A.GetVar(B, TEXT("entity")));
    });
    RegisterCommandV2(TEXT("ClearOwnerUid"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.ClearOwnerUid(A.GetVar(B, TEXT("entity")));
    });

    // ---- Stance / Item skill ----
    RegisterCommandV2(TEXT("SetStance"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.SetStance(A.GetVar(B, TEXT("entity")), A.GetTag(TEXT("stanceTag")));
    });
    RegisterCommandV2(TEXT("SetItemSkillTag"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.SetItemSkillTag(A.GetVar(B, TEXT("entity")), A.GetTag(TEXT("skillTag")));
    });

    // ---- Event Dispatch ----
    RegisterCommandV2(TEXT("DispatchEventTo"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.DispatchEventTo(A.GetTag(TEXT("eventTag")), A.GetVar(B, TEXT("target")));
    });
    RegisterCommandV2(TEXT("DispatchEventFrom"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.DispatchEventFrom(A.GetTag(TEXT("eventTag")), A.GetVar(B, TEXT("source")));
    });

    // ---- Structured Control Flow ----
    RegisterCommandV2(TEXT("If"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.If(A.GetVar(B, TEXT("cond")));
    });
    RegisterCommandV2(TEXT("IfNot"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.IfNot(A.GetVar(B, TEXT("cond")));
    });
    // Else / EndIf 는 인자 없음 — v1 핸들러로 충분하지만 일관성 위해 등록.
    RegisterCommandV2(TEXT("Else"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.Else();
    });
    RegisterCommandV2(TEXT("EndIf"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.EndIf();
    });
    RegisterCommandV2(TEXT("JumpIf"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.JumpIf(A.GetVar(B, TEXT("cond")), B.ResolveLabel(A.GetString(TEXT("label"))));
    });
    RegisterCommandV2(TEXT("JumpIfNot"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.JumpIfNot(A.GetVar(B, TEXT("cond")), B.ResolveLabel(A.GetString(TEXT("label"))));
    });

    // ---- Comparison (보강) ----
    RegisterCommandV2(TEXT("CmpLe"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.CmpLe(A.GetVar(B, TEXT("dst")), A.GetVar(B, TEXT("src1")), A.GetVar(B, TEXT("src2")));
    });
    RegisterCommandV2(TEXT("CmpGt"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.CmpGt(A.GetVar(B, TEXT("dst")), A.GetVar(B, TEXT("src1")), A.GetVar(B, TEXT("src2")));
    });
    RegisterCommandV2(TEXT("CmpGe"), [](FHktStoryBuilder& B, const FHktStoryCmdArgs& A) {
        B.CmpGe(A.GetVar(B, TEXT("dst")), A.GetVar(B, TEXT("src1")), A.GetVar(B, TEXT("src2")));
    });
}

