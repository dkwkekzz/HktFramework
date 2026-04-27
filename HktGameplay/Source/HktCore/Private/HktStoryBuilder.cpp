// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktStoryBuilder.h"
#include "HktStoryValidator.h"
#include "HktCoreLog.h"
#include "HktCoreEventLog.h"
#include "HktCoreProperties.h"
#include "HktWorldState.h"
#include "HktCoreEvents.h"
#include "HktVRegIR.h"
#include "VM/HktVMProgram.h"
#include "GameplayTagsManager.h"

DEFINE_LOG_CATEGORY(LogHktCore);

// ============================================================================
// FHktStoryBuilder - Construction
// ============================================================================

FHktStoryBuilder FHktStoryBuilder::Create(const FGameplayTag& Tag)
{
    return FHktStoryBuilder(Tag);
}

FHktStoryBuilder FHktStoryBuilder::Create(const FName& TagName)
{
    return FHktStoryBuilder(FGameplayTag::RequestGameplayTag(TagName));
}

FHktStoryBuilder::FHktStoryBuilder(const FGameplayTag& Tag)
    : Program(MakeShared<FHktVMProgram>())
    , MainSection(MakeUnique<FCodeSection>())
    , PreconditionSection(MakeUnique<FCodeSection>())
{
    ActiveSection = MainSection.Get();
    Program->Tag = Tag;
#if ENABLE_HKT_INSIGHTS
    Log(FString::Printf(TEXT("[Story Start] %s"), *Tag.ToString()));
#endif
}

FHktStoryBuilder::~FHktStoryBuilder() = default;

FHktStoryBuilder::FHktStoryBuilder(FHktStoryBuilder&& Other) noexcept
    : Program(MoveTemp(Other.Program))
    , RegAllocator(Other.RegAllocator)
    , MainSection(MoveTemp(Other.MainSection))
    , PreconditionSection(MoveTemp(Other.PreconditionSection))
    , ForEachStack(MoveTemp(Other.ForEachStack))
    , ForEachCounter(Other.ForEachCounter)
    , InternalLabelCounter(Other.InternalLabelCounter)
    , IfStack(MoveTemp(Other.IfStack))
    , IfCounter(Other.IfCounter)
    , RepeatStack(MoveTemp(Other.RepeatStack))
    , RepeatCounter(Other.RepeatCounter)
    , NamedLabelMap(MoveTemp(Other.NamedLabelMap))
    , SelfArchetype(Other.SelfArchetype)
    , SpawnedArchetype(Other.SpawnedArchetype)
    , ValidationErrors(MoveTemp(Other.ValidationErrors))
{
    // ActiveSection 포인터 재조정: 원본이 어느 섹션을 가리키고 있었는지에 따라 결정
    ActiveSection = (Other.ActiveSection == Other.PreconditionSection.Get())
        ? PreconditionSection.Get()
        : MainSection.Get();
    Other.ActiveSection = nullptr;
}

// ============================================================================
// FHktScopedReg / FHktScopedRegBlock — RAII 레지스터 핸들
// ============================================================================

FHktScopedReg::FHktScopedReg(FHktStoryBuilder& InBuilder)
    : Allocator(&InBuilder.RegAllocator)
    , Reg(Allocator->Alloc())
{
}

FHktScopedReg::~FHktScopedReg()
{
    if (Allocator)
    {
        Allocator->Free(Reg);
    }
}

FHktScopedReg::FHktScopedReg(FHktScopedReg&& Other) noexcept
    : Allocator(Other.Allocator)
    , Reg(Other.Reg)
{
    Other.Allocator = nullptr;
}

FHktScopedRegBlock::FHktScopedRegBlock(FHktStoryBuilder& InBuilder, int32 InCount)
    : Allocator(&InBuilder.RegAllocator)
    , Base(Allocator->AllocBlock(InCount))
    , Count(InCount)
{
}

FHktScopedRegBlock::~FHktScopedRegBlock()
{
    if (Allocator)
    {
        Allocator->FreeBlock(Base, Count);
    }
}

FHktScopedRegBlock::FHktScopedRegBlock(FHktScopedRegBlock&& Other) noexcept
    : Allocator(Other.Allocator)
    , Base(Other.Base)
    , Count(Other.Count)
{
    Other.Allocator = nullptr;
}

void FHktStoryBuilder::Emit(FInstruction Inst)
{
    // 단계 1: FInstruction → FHktVInst 변환 후 push.
    // RegisterIndex 0..15는 pre-colored VReg로 매핑되며, 동일 인덱스는 동일 VReg를 재사용.
    ActiveSection->Code.Add(HktVReg_FromInstruction(Inst, ActiveSection->RegPool));
}

int32 FHktStoryBuilder::AddString(const FString& Str)
{
    int32 Index = ActiveSection->Strings.IndexOfByKey(Str);
    if (Index == INDEX_NONE)
    {
        Index = ActiveSection->Strings.Num();
        ActiveSection->Strings.Add(Str);
    }
    return Index;
}

int32 FHktStoryBuilder::AddConstant(int32 Value)
{
    int32 Index = ActiveSection->Constants.IndexOfByKey(Value);
    if (Index == INDEX_NONE)
    {
        Index = ActiveSection->Constants.Num();
        ActiveSection->Constants.Add(Value);
    }
    return Index;
}

int32 FHktStoryBuilder::TagToInt(const FGameplayTag& Tag)
{
    if (Tag.IsValid())
    {
        FGameplayTagNetIndex NetIndex = UGameplayTagsManager::Get().GetNetIndexFromTag(Tag);
        return static_cast<int32>(NetIndex);
    }
    return 0;
}

FString FHktStoryBuilder::MakeInternalLabel(const TCHAR* Prefix)
{
    TCHAR Buf[48];
    FCString::Sprintf(Buf, TEXT("__%s_%d"), Prefix, InternalLabelCounter++);
    return FString(Buf);
}

// ============================================================================
// Flow Policy
// ============================================================================

FHktStoryBuilder& FHktStoryBuilder::CancelOnDuplicate()
{
    Program->bCancelOnDuplicate = true;
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::SetPrecondition(FHktEventPrecondition InPrecondition)
{
    Program->Precondition = MoveTemp(InPrecondition);
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::BeginPrecondition()
{
    check(ActiveSection == MainSection.Get());
    ActiveSection = PreconditionSection.Get();
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::EndPrecondition()
{
    check(ActiveSection == PreconditionSection.Get());
    // 단계 1: PreconditionSection의 FInstruction emit은 Build에서 일괄 처리한다.
    // 라벨 해소는 VInst 단계에서도 가능하지만 단순화를 위해 Build로 일원화.
    ActiveSection = MainSection.Get();
    return *this;
}

// ============================================================================
// 정수 키 라벨 — 동적 라벨 전용 (힙할당 없음, FName 파싱 이슈 없음)
// ============================================================================

int32 FHktStoryBuilder::AllocLabel()
{
    return MakeLabelKey(LT_Internal, InternalLabelCounter++, 0);
}

int32 FHktStoryBuilder::ResolveLabel(const FString& Name)
{
    if (int32* Found = NamedLabelMap.Find(Name))
    {
        return *Found;
    }
    int32 Key = AllocLabel();
    NamedLabelMap.Add(Name, Key);
    return Key;
}

FHktStoryBuilder& FHktStoryBuilder::Label(int32 Key)
{
    ActiveSection->IntLabels.Add(Key, ActiveSection->Code.Num());
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::Jump(int32 Key)
{
    ActiveSection->IntFixups.Add({ActiveSection->Code.Num(), Key});
    Emit(FInstruction::MakeImm(EOpCode::Jump, 0, 0));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::JumpIf(RegisterIndex Cond, int32 Key)
{
    ActiveSection->IntFixups.Add({ActiveSection->Code.Num(), Key});
    Emit(FInstruction::Make(EOpCode::JumpIf, 0, Cond, 0, 0));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::JumpIfNot(RegisterIndex Cond, int32 Key)
{
    ActiveSection->IntFixups.Add({ActiveSection->Code.Num(), Key});
    Emit(FInstruction::Make(EOpCode::JumpIfNot, 0, Cond, 0, 0));
    return *this;
}

// ============================================================================
// Structured Control Flow (If / Else / EndIf)
// ============================================================================

FHktStoryBuilder& FHktStoryBuilder::If(RegisterIndex Cond)
{
    const int32 Id = IfCounter++;
    IfStack.Push({Id, false});
    JumpIfNot(Cond, MakeLabelKey(LT_If, Id, 0));   // → false branch
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::IfNot(RegisterIndex Cond)
{
    const int32 Id = IfCounter++;
    IfStack.Push({Id, false});
    JumpIf(Cond, MakeLabelKey(LT_If, Id, 0));      // → false branch
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::Else()
{
    check(IfStack.Num() > 0);
    FIfContext& Ctx = IfStack.Last();
    check(!Ctx.bHasElse);
    Jump(MakeLabelKey(LT_If, Ctx.Id, 1));           // → end
    Label(MakeLabelKey(LT_If, Ctx.Id, 0));           // false branch starts here
    Ctx.bHasElse = true;
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::EndIf()
{
    check(IfStack.Num() > 0);
    FIfContext Ctx = IfStack.Pop();
    Label(Ctx.bHasElse
        ? MakeLabelKey(LT_If, Ctx.Id, 1)               // end label
        : MakeLabelKey(LT_If, Ctx.Id, 0));              // false label (no else)
    return *this;
}

// ============================================================================
// Register Comparison + If
// ============================================================================

FHktStoryBuilder& FHktStoryBuilder::IfCmp(EOpCode CmpOp, RegisterIndex A, RegisterIndex B)
{
    Emit(FInstruction::Make(CmpOp, Reg::Flag, A, B, 0));
    return If(Reg::Flag);
}

FHktStoryBuilder& FHktStoryBuilder::IfEq(RegisterIndex A, RegisterIndex B) { return IfCmp(EOpCode::CmpEq, A, B); }
FHktStoryBuilder& FHktStoryBuilder::IfNe(RegisterIndex A, RegisterIndex B) { return IfCmp(EOpCode::CmpNe, A, B); }
FHktStoryBuilder& FHktStoryBuilder::IfLt(RegisterIndex A, RegisterIndex B) { return IfCmp(EOpCode::CmpLt, A, B); }
FHktStoryBuilder& FHktStoryBuilder::IfLe(RegisterIndex A, RegisterIndex B) { return IfCmp(EOpCode::CmpLe, A, B); }
FHktStoryBuilder& FHktStoryBuilder::IfGt(RegisterIndex A, RegisterIndex B) { return IfCmp(EOpCode::CmpGt, A, B); }
FHktStoryBuilder& FHktStoryBuilder::IfGe(RegisterIndex A, RegisterIndex B) { return IfCmp(EOpCode::CmpGe, A, B); }

// ============================================================================
// Register vs Constant + If
// ============================================================================

FHktStoryBuilder& FHktStoryBuilder::IfCmpConst(EOpCode CmpOp, RegisterIndex Src, int32 Value)
{
    FHktRegReserve Guard(RegAllocator, {Src});
    FHktScopedReg Tmp(*this);
    LoadConst(Tmp, Value);
    Emit(FInstruction::Make(CmpOp, Reg::Flag, Src, Tmp, 0));
    return If(Reg::Flag);
}

FHktStoryBuilder& FHktStoryBuilder::IfEqConst(RegisterIndex Src, int32 Value) { return IfCmpConst(EOpCode::CmpEq, Src, Value); }
FHktStoryBuilder& FHktStoryBuilder::IfNeConst(RegisterIndex Src, int32 Value) { return IfCmpConst(EOpCode::CmpNe, Src, Value); }
FHktStoryBuilder& FHktStoryBuilder::IfLtConst(RegisterIndex Src, int32 Value) { return IfCmpConst(EOpCode::CmpLt, Src, Value); }
FHktStoryBuilder& FHktStoryBuilder::IfLeConst(RegisterIndex Src, int32 Value) { return IfCmpConst(EOpCode::CmpLe, Src, Value); }
FHktStoryBuilder& FHktStoryBuilder::IfGtConst(RegisterIndex Src, int32 Value) { return IfCmpConst(EOpCode::CmpGt, Src, Value); }
FHktStoryBuilder& FHktStoryBuilder::IfGeConst(RegisterIndex Src, int32 Value) { return IfCmpConst(EOpCode::CmpGe, Src, Value); }

// ============================================================================
// Entity Property vs Constant + If
// ============================================================================

FHktStoryBuilder& FHktStoryBuilder::IfPropertyCmp(EOpCode CmpOp, RegisterIndex Entity, uint16 PropertyId, int32 Value)
{
    FHktRegReserve Guard(RegAllocator, {Entity});
    FHktScopedReg Prop(*this);
    FHktScopedReg Const(*this);
    LoadStoreEntity(Prop, Entity, PropertyId);
    LoadConst(Const, Value);
    Emit(FInstruction::Make(CmpOp, Reg::Flag, Prop, Const, 0));
    return If(Reg::Flag);
}

FHktStoryBuilder& FHktStoryBuilder::IfPropertyEq(RegisterIndex Entity, uint16 PropertyId, int32 Value) { return IfPropertyCmp(EOpCode::CmpEq, Entity, PropertyId, Value); }
FHktStoryBuilder& FHktStoryBuilder::IfPropertyNe(RegisterIndex Entity, uint16 PropertyId, int32 Value) { return IfPropertyCmp(EOpCode::CmpNe, Entity, PropertyId, Value); }
FHktStoryBuilder& FHktStoryBuilder::IfPropertyLt(RegisterIndex Entity, uint16 PropertyId, int32 Value) { return IfPropertyCmp(EOpCode::CmpLt, Entity, PropertyId, Value); }
FHktStoryBuilder& FHktStoryBuilder::IfPropertyLe(RegisterIndex Entity, uint16 PropertyId, int32 Value) { return IfPropertyCmp(EOpCode::CmpLe, Entity, PropertyId, Value); }
FHktStoryBuilder& FHktStoryBuilder::IfPropertyGt(RegisterIndex Entity, uint16 PropertyId, int32 Value) { return IfPropertyCmp(EOpCode::CmpGt, Entity, PropertyId, Value); }
FHktStoryBuilder& FHktStoryBuilder::IfPropertyGe(RegisterIndex Entity, uint16 PropertyId, int32 Value) { return IfPropertyCmp(EOpCode::CmpGe, Entity, PropertyId, Value); }

// ============================================================================
// CmpXxConst (상수 비교 — Snippet/내부용)
// ============================================================================

FHktStoryBuilder& FHktStoryBuilder::CmpConst(EOpCode CmpOp, RegisterIndex Dst, RegisterIndex Src, int32 Value)
{
    FHktRegReserve Guard(RegAllocator, {Dst, Src});
    FHktScopedReg Tmp(*this);
    LoadConst(Tmp, Value);
    Emit(FInstruction::Make(CmpOp, Dst, Src, Tmp, 0));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::CmpEqConst(RegisterIndex Dst, RegisterIndex Src, int32 Value) { return CmpConst(EOpCode::CmpEq, Dst, Src, Value); }
FHktStoryBuilder& FHktStoryBuilder::CmpNeConst(RegisterIndex Dst, RegisterIndex Src, int32 Value) { return CmpConst(EOpCode::CmpNe, Dst, Src, Value); }
FHktStoryBuilder& FHktStoryBuilder::CmpLtConst(RegisterIndex Dst, RegisterIndex Src, int32 Value) { return CmpConst(EOpCode::CmpLt, Dst, Src, Value); }
FHktStoryBuilder& FHktStoryBuilder::CmpLeConst(RegisterIndex Dst, RegisterIndex Src, int32 Value) { return CmpConst(EOpCode::CmpLe, Dst, Src, Value); }
FHktStoryBuilder& FHktStoryBuilder::CmpGtConst(RegisterIndex Dst, RegisterIndex Src, int32 Value) { return CmpConst(EOpCode::CmpGt, Dst, Src, Value); }
FHktStoryBuilder& FHktStoryBuilder::CmpGeConst(RegisterIndex Dst, RegisterIndex Src, int32 Value) { return CmpConst(EOpCode::CmpGe, Dst, Src, Value); }

// ============================================================================
// Repeat / EndRepeat
// ============================================================================

FHktStoryBuilder& FHktStoryBuilder::Repeat(int32 Count)
{
    const int32 Id = RepeatCounter++;
    const RegisterIndex CounterReg = RegAllocator.Alloc();

    LoadConst(CounterReg, 0);
    Label(MakeLabelKey(LT_Repeat, Id, 0));           // loop
    CmpGeConst(Reg::Flag, CounterReg, Count);
    JumpIf(Reg::Flag, MakeLabelKey(LT_Repeat, Id, 1)); // → end

    RepeatStack.Push({Id, CounterReg, Count});
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::EndRepeat()
{
    check(RepeatStack.Num() > 0);
    FRepeatContext Ctx = RepeatStack.Pop();

    AddImm(Ctx.CounterReg, Ctx.CounterReg, 1);
    Jump(MakeLabelKey(LT_Repeat, Ctx.Id, 0));       // → loop
    Label(MakeLabelKey(LT_Repeat, Ctx.Id, 1));       // end

    RegAllocator.Free(Ctx.CounterReg);
    return *this;
}

// ============================================================================
// WaitUntilCountZero
// ============================================================================

FHktStoryBuilder& FHktStoryBuilder::WaitUntilCountZero(const FGameplayTag& Tag, float PollIntervalSeconds)
{
    FHktScopedReg Count(*this);
    const int32 LoopId = InternalLabelCounter++;
    const int32 LoopKey = MakeLabelKey(LT_Internal, LoopId, 0);
    const int32 DoneKey = MakeLabelKey(LT_Internal, LoopId, 1);

    Label(LoopKey);
    CountByTag(Count, Tag);
    CmpLeConst(Reg::Flag, Count, 0);
    JumpIf(Reg::Flag, DoneKey);
    WaitSeconds(PollIntervalSeconds);
    Jump(LoopKey);
    Label(DoneKey);

    return *this;
}

// ============================================================================
// Control Flow
// ============================================================================

FHktStoryBuilder& FHktStoryBuilder::Label(FName Name)
{
    ActiveSection->Labels.Add(Name, ActiveSection->Code.Num());
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::Jump(FName LabelName)
{
    ActiveSection->Fixups.Add({ActiveSection->Code.Num(), LabelName});
    Emit(FInstruction::MakeImm(EOpCode::Jump, 0, 0));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::JumpIf(RegisterIndex Cond, FName LabelName)
{
    ActiveSection->Fixups.Add({ActiveSection->Code.Num(), LabelName});
    Emit(FInstruction::Make(EOpCode::JumpIf, 0, Cond, 0, 0));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::JumpIfNot(RegisterIndex Cond, FName LabelName)
{
    ActiveSection->Fixups.Add({ActiveSection->Code.Num(), LabelName});
    Emit(FInstruction::Make(EOpCode::JumpIfNot, 0, Cond, 0, 0));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::Yield(int32 Frames)
{
    Emit(FInstruction::Make(EOpCode::Yield, 0, 0, 0, FMath::Max(1, Frames)));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::WaitSeconds(float Seconds)
{
    int32 DeciMillis = FMath::RoundToInt(Seconds * 100.0f);
    Emit(FInstruction::MakeImm(EOpCode::YieldSeconds, 0, DeciMillis));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::Halt()
{
#if ENABLE_HKT_INSIGHTS
    Log(FString::Printf(TEXT("[Story End] %s"), *Program->Tag.ToString()));
#endif
    Emit(FInstruction::Make(EOpCode::Halt));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::Fail()
{
#if ENABLE_HKT_INSIGHTS
    Log(FString::Printf(TEXT("[Story End] %s"), *Program->Tag.ToString()));
#endif
    Emit(FInstruction::Make(EOpCode::Fail));
    return *this;
}

// ============================================================================
// Event Wait
// ============================================================================

FHktStoryBuilder& FHktStoryBuilder::WaitCollision(RegisterIndex WatchEntity)
{
    Emit(FInstruction::Make(EOpCode::WaitCollision, Reg::Hit, WatchEntity, 0, 0));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::WaitAnimEnd(RegisterIndex Entity)
{
    Emit(FInstruction::Make(EOpCode::WaitAnimEnd, 0, Entity, 0, 0));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::WaitMoveEnd(RegisterIndex Entity)
{
    Emit(FInstruction::Make(EOpCode::WaitMoveEnd, 0, Entity, 0, 0));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::WaitGrounded(RegisterIndex Entity)
{
    Emit(FInstruction::Make(EOpCode::WaitGrounded, 0, Entity, 0, 0));
    return *this;
}

// ============================================================================
// Data Operations (근본 opcode 래퍼)
// ============================================================================

FHktStoryBuilder& FHktStoryBuilder::LoadConst(RegisterIndex Dst, int32 Value)
{
    if (Value >= -524288 && Value <= 524287)
    {
        Emit(FInstruction::MakeImm(EOpCode::LoadConst, Dst, Value));
    }
    else
    {
        Emit(FInstruction::MakeImm(EOpCode::LoadConst, Dst, Value & 0xFFFFF));
        Emit(FInstruction::Make(EOpCode::LoadConstHigh, Dst, 0, 0, (Value >> 20) & 0xFFF));
    }
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::SetArchetype(EHktArchetype Arch)
{
    SelfArchetype = Arch;
    return *this;
}

void FHktStoryBuilder::ValidatePropertyAccess(uint16 PropId, EHktArchetype Arch)
{
    if (Arch == EHktArchetype::None) return;

    const FHktArchetypeMetadata* Meta = FHktArchetypeRegistry::Get().Find(Arch);
    if (!Meta) return;

    if (!Meta->HasProperty(PropId))
    {
        const TCHAR* PropName = HktProperty::GetPropertyName(PropId);
        ValidationErrors.Add(FString::Printf(
            TEXT("Archetype '%s' does not have property '%s' (Id=%d)"),
            Meta->Name, PropName ? PropName : TEXT("?"), PropId));
    }
}

EHktArchetype FHktStoryBuilder::ResolveArchetypeForRegister(RegisterIndex Entity) const
{
    if (Entity == Reg::Self)    return SelfArchetype;
    if (Entity == Reg::Spawned) return SpawnedArchetype;
    return EHktArchetype::None;
}

FHktStoryBuilder& FHktStoryBuilder::LoadStore(RegisterIndex Dst, uint16 PropertyId)
{
    ValidatePropertyAccess(PropertyId, SelfArchetype);
    Emit(FInstruction::Make(EOpCode::LoadStore, Dst, 0, 0, PropertyId));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::LoadStoreEntity(RegisterIndex Dst, RegisterIndex Entity, uint16 PropertyId)
{
    ValidatePropertyAccess(PropertyId, ResolveArchetypeForRegister(Entity));
    Emit(FInstruction::Make(EOpCode::LoadStoreEntity, Dst, Entity, 0, PropertyId));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::SaveStore(uint16 PropertyId, RegisterIndex Src)
{
    ValidatePropertyAccess(PropertyId, SelfArchetype);
    Emit(FInstruction::Make(EOpCode::SaveStore, 0, Src, 0, PropertyId));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::SaveStoreEntity(RegisterIndex Entity, uint16 PropertyId, RegisterIndex Src)
{
    ValidatePropertyAccess(PropertyId, ResolveArchetypeForRegister(Entity));
    Emit(FInstruction::Make(EOpCode::SaveStoreEntity, 0, Entity, Src, PropertyId));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::SaveConst(uint16 PropertyId, int32 Value)
{
    FHktScopedReg Tmp(*this);
    LoadConst(Tmp, Value);
    SaveStore(PropertyId, Tmp);
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::SaveConstEntity(RegisterIndex Entity, uint16 PropertyId, int32 Value)
{
    FHktRegReserve Guard(RegAllocator, {Entity});
    FHktScopedReg Tmp(*this);
    LoadConst(Tmp, Value);
    SaveStoreEntity(Entity, PropertyId, Tmp);
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::Move(RegisterIndex Dst, RegisterIndex Src)
{
    Emit(FInstruction::Make(EOpCode::Move, Dst, Src, 0, 0));
    return *this;
}

// ============================================================================
// Arithmetic
// ============================================================================

FHktStoryBuilder& FHktStoryBuilder::Add(RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2)
{
    Emit(FInstruction::Make(EOpCode::Add, Dst, Src1, Src2, 0));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::Sub(RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2)
{
    Emit(FInstruction::Make(EOpCode::Sub, Dst, Src1, Src2, 0));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::Mul(RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2)
{
    Emit(FInstruction::Make(EOpCode::Mul, Dst, Src1, Src2, 0));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::Div(RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2)
{
    Emit(FInstruction::Make(EOpCode::Div, Dst, Src1, Src2, 0));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::AddImm(RegisterIndex Dst, RegisterIndex Src, int32 Imm)
{
    Emit(FInstruction::Make(EOpCode::AddImm, Dst, Src, 0, Imm & 0xFFF));
    return *this;
}

// ============================================================================
// Comparison
// ============================================================================

FHktStoryBuilder& FHktStoryBuilder::CmpEq(RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2)
{
    Emit(FInstruction::Make(EOpCode::CmpEq, Dst, Src1, Src2, 0));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::CmpNe(RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2)
{
    Emit(FInstruction::Make(EOpCode::CmpNe, Dst, Src1, Src2, 0));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::CmpLt(RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2)
{
    Emit(FInstruction::Make(EOpCode::CmpLt, Dst, Src1, Src2, 0));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::CmpLe(RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2)
{
    Emit(FInstruction::Make(EOpCode::CmpLe, Dst, Src1, Src2, 0));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::CmpGt(RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2)
{
    Emit(FInstruction::Make(EOpCode::CmpGt, Dst, Src1, Src2, 0));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::CmpGe(RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2)
{
    Emit(FInstruction::Make(EOpCode::CmpGe, Dst, Src1, Src2, 0));
    return *this;
}

// ============================================================================
// Entity Management
// ============================================================================

FHktStoryBuilder& FHktStoryBuilder::SpawnEntity(const FGameplayTag& ClassTag)
{
    int32 TagIdx = TagToInt(ClassTag);
    Emit(FInstruction::Make(EOpCode::SpawnEntity, 0, 0, 0, TagIdx & 0xFFF));

    // ClassTag → Archetype 자동 추론 (Spawned 레지스터 검증용)
    SpawnedArchetype = FHktArchetypeRegistry::Get().FindByTag(ClassTag);

    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::DestroyEntity(RegisterIndex Entity)
{
    Emit(FInstruction::Make(EOpCode::DestroyEntity, 0, Entity, 0, 0));
    return *this;
}

// ============================================================================
// Position & Movement (조합 연산 — 기본 opcode로 분해)
// ============================================================================

FHktStoryBuilder& FHktStoryBuilder::GetPosition(RegisterIndex DstBase, RegisterIndex Entity)
{
    LoadStoreEntity(DstBase,     Entity, PropertyId::PosX);
    LoadStoreEntity(DstBase + 1, Entity, PropertyId::PosY);
    LoadStoreEntity(DstBase + 2, Entity, PropertyId::PosZ);
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::SetPosition(RegisterIndex Entity, RegisterIndex SrcBase)
{
    SaveStoreEntity(Entity, PropertyId::PosX, SrcBase);
    SaveStoreEntity(Entity, PropertyId::PosY, SrcBase + 1);
    SaveStoreEntity(Entity, PropertyId::PosZ, SrcBase + 2);
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::CopyPosition(RegisterIndex DstEntity, RegisterIndex SrcEntity)
{
    FHktRegReserve Guard(RegAllocator, {DstEntity, SrcEntity});
    FHktScopedRegBlock Pos(*this, 3);
    GetPosition(Pos, SrcEntity);
    SetPosition(DstEntity, Pos);
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::MoveTowardProperty(RegisterIndex Entity, uint16 BasePropId, int32 Force)
{
    FHktRegReserve Guard(RegAllocator, {Entity});
    FHktScopedRegBlock Pos(*this, 3);
    LoadStore(Pos,     BasePropId);
    LoadStore(Pos + 1, BasePropId + 1);
    LoadStore(Pos + 2, BasePropId + 2);
    MoveToward(Entity, Pos, Force);
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::PlayVFXAtEntity(RegisterIndex Entity, const FGameplayTag& VFXTag)
{
    FHktRegReserve Guard(RegAllocator, {Entity});
    FHktScopedRegBlock Pos(*this, 3);
    GetPosition(Pos, Entity);
    PlayVFX(Pos, VFXTag);
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::PlaySoundAtEntity(RegisterIndex Entity, const FGameplayTag& SoundTag)
{
    FHktRegReserve Guard(RegAllocator, {Entity});
    FHktScopedRegBlock Pos(*this, 3);
    GetPosition(Pos, Entity);
    PlaySoundAtLocation(Pos, SoundTag);
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::MoveToward(RegisterIndex Entity, RegisterIndex TargetPosBase, int32 Force)
{
    SaveStoreEntity(Entity, PropertyId::MoveTargetX, TargetPosBase);
    SaveStoreEntity(Entity, PropertyId::MoveTargetY, TargetPosBase + 1);
    SaveStoreEntity(Entity, PropertyId::MoveTargetZ, TargetPosBase + 2);
    SaveConstEntity(Entity, PropertyId::MoveForce, Force);
    SaveConstEntity(Entity, PropertyId::IsMoving, 1);
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::MoveForward(RegisterIndex Entity, int32 Force)
{
    // Self의 RotYaw를 투사체에 복사하여 발사 방향 결정
    FHktRegReserve Guard(RegAllocator, {Entity});
    FHktScopedReg Tmp(*this);
    LoadStoreEntity(Tmp, Reg::Self, PropertyId::RotYaw);
    SaveStoreEntity(Entity, PropertyId::RotYaw, Tmp);
    Emit(FInstruction::Make(EOpCode::SetForwardTarget, 0, Entity, 0, 0));
    SaveConstEntity(Entity, PropertyId::MoveForce, Force);
    SaveConstEntity(Entity, PropertyId::IsMoving, 1);
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::StopMovement(RegisterIndex Entity)
{
    SaveConstEntity(Entity, PropertyId::IsMoving, 0);
    SaveConstEntity(Entity, PropertyId::VelX, 0);
    SaveConstEntity(Entity, PropertyId::VelY, 0);
    SaveConstEntity(Entity, PropertyId::VelZ, 0);
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::ApplyJump(RegisterIndex Entity, int32 ImpulseVelZ)
{
    // 수직 속도는 VelZ(공용)로 통합되었다. IsGrounded=0 으로 공중 상태로 전환하면
    // 다음 프레임부터 GravitySystem이 VelZ 를 매 프레임 차감하여 낙하 처리한다.
    SaveConstEntity(Entity, PropertyId::IsGrounded, 0);
    SaveConstEntity(Entity, PropertyId::VelZ, ImpulseVelZ);
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::GetDistance(RegisterIndex Dst, RegisterIndex Entity1, RegisterIndex Entity2)
{
    Emit(FInstruction::Make(EOpCode::GetDistance, Dst, Entity1, Entity2, 0));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::LookAt(RegisterIndex Entity, RegisterIndex TargetEntity)
{
    Emit(FInstruction::Make(EOpCode::LookAt, 0, Entity, TargetEntity, 0));
    return *this;
}

// ============================================================================
// Spatial Query
// ============================================================================

FHktStoryBuilder& FHktStoryBuilder::FindInRadius(RegisterIndex CenterEntity, int32 RadiusCm)
{
    Emit(FInstruction::Make(EOpCode::FindInRadius, Reg::Count, CenterEntity, 0, RadiusCm & 0xFFF));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::FindInRadiusEx(RegisterIndex CenterEntity, int32 RadiusCm, uint32 FilterMask)
{
    FHktRegReserve Guard(RegAllocator, {CenterEntity});
    FHktScopedReg RadiusReg(*this);
    FHktScopedReg MaskReg(*this);
    LoadConst(RadiusReg, RadiusCm);
    LoadConst(MaskReg, static_cast<int32>(FilterMask));
    // Imm12 필드에 RadiusReg 인덱스를 인코딩하여 인터프리터에 전달
    Emit(FInstruction::Make(EOpCode::FindInRadiusEx, Reg::Count, CenterEntity, MaskReg, static_cast<uint16>(static_cast<RegisterIndex>(RadiusReg))));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::NextFound()
{
    Emit(FInstruction::Make(EOpCode::NextFound, Reg::Iter, 0, 0, 0));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::ForEachInRadius(RegisterIndex CenterEntity, int32 RadiusCm)
{
    const int32 Id = ForEachCounter++;
    ForEachStack.Push({Id});

    FindInRadius(CenterEntity, RadiusCm);
    Label(MakeLabelKey(LT_ForEach, Id, 0));          // loop
    NextFound();
    JumpIfNot(Reg::Flag, MakeLabelKey(LT_ForEach, Id, 1)); // → end

    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::InteractTerrain(RegisterIndex CenterEntity, int32 RadiusCm)
{
    // 단발 호출 — ForEach 구조 아님 (셀 예측 + Precondition + Event 발행)
    Emit(FInstruction::Make(EOpCode::InteractTerrain, 0, CenterEntity, 0, RadiusCm & 0xFFF));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::ForEachInRadiusEx(RegisterIndex CenterEntity, int32 RadiusCm, uint32 FilterMask)
{
    const int32 Id = ForEachCounter++;
    ForEachStack.Push({Id});

    FindInRadiusEx(CenterEntity, RadiusCm, FilterMask);
    Label(MakeLabelKey(LT_ForEach, Id, 0));          // loop
    NextFound();
    JumpIfNot(Reg::Flag, MakeLabelKey(LT_ForEach, Id, 1)); // → end

    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::EndForEach()
{
    check(ForEachStack.Num() > 0);
    FForEachContext Ctx = ForEachStack.Pop();

    Jump(MakeLabelKey(LT_ForEach, Ctx.Id, 0));      // → loop
    Label(MakeLabelKey(LT_ForEach, Ctx.Id, 1));      // end

    return *this;
}

// ============================================================================
// Combat (조합 연산 — R7,R8,R9 사용)
// ============================================================================

FHktStoryBuilder& FHktStoryBuilder::ApplyDamage(RegisterIndex Target, RegisterIndex Amount)
{
    // ActualDmg = Max(1, Amount - Defense)
    // NewHealth = Max(0, Health - ActualDmg)
    FHktRegReserve Guard(RegAllocator, {Target, Amount});
    FHktScopedReg Dmg(*this);
    FHktScopedReg Scratch(*this);

    Move(Dmg, Amount);                                        // Dmg = Amount (즉시 복사하여 안전)
    LoadStoreEntity(Scratch, Target, PropertyId::Defense);    // Scratch = Defense
    Sub(Dmg, Dmg, Scratch);                                   // Dmg = Amount - Defense

    // Clamp to min 1
    LoadConst(Scratch, 1);
    CmpLt(Reg::Flag, Dmg, Scratch);                          // Flag = (Dmg < 1)
    {
        const int32 Key = MakeLabelKey(LT_Internal, InternalLabelCounter++, 0);
        JumpIfNot(Reg::Flag, Key);
        Move(Dmg, Scratch);                                   // Dmg = 1
        Label(Key);
    }

    // NewHealth = Health - ActualDmg
    LoadStoreEntity(Scratch, Target, PropertyId::Health);     // Scratch = Health
    Sub(Scratch, Scratch, Dmg);                               // Scratch = Health - ActualDmg

    // Clamp to min 0
    {
        FHktScopedReg Zero(*this);
        LoadConst(Zero, 0);
        CmpLt(Reg::Flag, Scratch, Zero);                     // Flag = (Scratch < 0)
        const int32 Key = MakeLabelKey(LT_Internal, InternalLabelCounter++, 0);
        JumpIfNot(Reg::Flag, Key);
        Move(Scratch, Zero);                                  // Scratch = 0
        Label(Key);
    }

    SaveStoreEntity(Target, PropertyId::Health, Scratch);     // Health = NewHealth
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::ApplyDamageConst(RegisterIndex Target, int32 Amount)
{
    FHktRegReserve Guard(RegAllocator, {Target});
    FHktScopedReg AmountReg(*this);
    LoadConst(AmountReg, Amount);
    ApplyDamage(Target, AmountReg);
    return *this;
}

// ============================================================================
// Presentation
// ============================================================================

FHktStoryBuilder& FHktStoryBuilder::ApplyEffect(RegisterIndex Target, const FGameplayTag& EffectTag)
{
    int32 TagIdx = TagToInt(EffectTag);
    Emit(FInstruction::Make(EOpCode::ApplyEffect, 0, Target, 0, TagIdx & 0xFFF));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::RemoveEffect(RegisterIndex Target, const FGameplayTag& EffectTag)
{
    int32 TagIdx = TagToInt(EffectTag);
    Emit(FInstruction::Make(EOpCode::RemoveEffect, 0, Target, 0, TagIdx & 0xFFF));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::PlayVFX(RegisterIndex PosBase, const FGameplayTag& VFXTag)
{
    int32 TagIdx = TagToInt(VFXTag);
    Emit(FInstruction::Make(EOpCode::PlayVFX, 0, PosBase, 0, TagIdx & 0xFFF));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::PlayVFXAttached(RegisterIndex Entity, const FGameplayTag& VFXTag)
{
    int32 TagIdx = TagToInt(VFXTag);
    Emit(FInstruction::Make(EOpCode::PlayVFXAttached, 0, Entity, 0, TagIdx & 0xFFF));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::PlayAnim(RegisterIndex Entity, const FGameplayTag& AnimTag)
{
    int32 TagIdx = TagToInt(AnimTag);
    Emit(FInstruction::Make(EOpCode::PlayAnim, 0, Entity, 0, TagIdx & 0xFFF));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::PlaySound(const FGameplayTag& SoundTag)
{
    int32 TagIdx = TagToInt(SoundTag);
    Emit(FInstruction::MakeImm(EOpCode::PlaySound, 0, TagIdx));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::PlaySoundAtLocation(RegisterIndex PosBase, const FGameplayTag& SoundTag)
{
    int32 TagIdx = TagToInt(SoundTag);
    Emit(FInstruction::Make(EOpCode::PlaySoundAtLocation, 0, PosBase, 0, TagIdx & 0xFFF));
    return *this;
}

// ============================================================================
// Tags
// ============================================================================

FHktStoryBuilder& FHktStoryBuilder::AddTag(RegisterIndex Entity, const FGameplayTag& Tag)
{
    int32 TagIdx = TagToInt(Tag);
    Emit(FInstruction::Make(EOpCode::AddTag, 0, Entity, 0, TagIdx & 0xFFF));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::RemoveTag(RegisterIndex Entity, const FGameplayTag& Tag)
{
    int32 TagIdx = TagToInt(Tag);
    Emit(FInstruction::Make(EOpCode::RemoveTag, 0, Entity, 0, TagIdx & 0xFFF));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::HasTag(RegisterIndex Dst, RegisterIndex Entity, const FGameplayTag& Tag)
{
    int32 TagIdx = TagToInt(Tag);
    Emit(FInstruction::Make(EOpCode::HasTag, Dst, Entity, 0, TagIdx & 0xFFF));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::CheckTrait(RegisterIndex Dst, RegisterIndex Entity, const FHktPropertyTrait* Trait)
{
    int32 TraitIdx = FHktArchetypeRegistry::Get().GetTraitIndex(Trait);
    checkf(TraitIdx >= 0, TEXT("CheckTrait: Trait not registered in FHktArchetypeRegistry"));
    Emit(FInstruction::Make(EOpCode::CheckTrait, Dst, Entity, 0, TraitIdx & 0xFFF));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::IfHasTrait(RegisterIndex Entity, const FHktPropertyTrait* Trait)
{
    FHktScopedReg tmp(*this);
    CheckTrait(tmp, Entity, Trait);
    return If(tmp);
}

FHktStoryBuilder& FHktStoryBuilder::RequiresTrait(const FHktPropertyTrait* Trait)
{
    return SetPrecondition([Trait](const FHktWorldState& WS, const FHktEvent& E) -> bool
    {
        return WS.HasTrait(E.SourceEntity, Trait);
    });
}

// ============================================================================
// NPC Spawning
// ============================================================================

FHktStoryBuilder& FHktStoryBuilder::CountByTag(RegisterIndex Dst, const FGameplayTag& Tag)
{
    int32 TagIdx = TagToInt(Tag);
    Emit(FInstruction::Make(EOpCode::CountByTag, Dst, 0, 0, TagIdx & 0xFFF));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::GetWorldTime(RegisterIndex Dst)
{
    Emit(FInstruction::Make(EOpCode::GetWorldTime, Dst, 0, 0, 0));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::RandomInt(RegisterIndex Dst, RegisterIndex ModulusReg)
{
    Emit(FInstruction::Make(EOpCode::RandomInt, Dst, ModulusReg, 0, 0));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::HasPlayerInGroup(RegisterIndex Dst)
{
    Emit(FInstruction::Make(EOpCode::HasPlayerInGroup, Dst, 0, 0, 0));
    return *this;
}

// ============================================================================
// Item System
// ============================================================================

FHktStoryBuilder& FHktStoryBuilder::CountByOwner(RegisterIndex Dst, RegisterIndex OwnerEntity, const FGameplayTag& Tag)
{
    int32 TagIdx = TagToInt(Tag);
    Emit(FInstruction::Make(EOpCode::CountByOwner, Dst, OwnerEntity, 0, TagIdx & 0xFFF));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::FindByOwner(RegisterIndex OwnerEntity, const FGameplayTag& Tag)
{
    int32 TagIdx = TagToInt(Tag);
    Emit(FInstruction::Make(EOpCode::FindByOwner, Reg::Count, OwnerEntity, 0, TagIdx & 0xFFF));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::SetOwnerUid(RegisterIndex Entity)
{
    Emit(FInstruction::Make(EOpCode::SetOwnerUid, 0, Entity));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::ClearOwnerUid(RegisterIndex Entity)
{
    Emit(FInstruction::Make(EOpCode::ClearOwnerUid, 0, Entity));
    return *this;
}

// ============================================================================
// Stance
// ============================================================================

FHktStoryBuilder& FHktStoryBuilder::SetStance(RegisterIndex Entity, const FGameplayTag& StanceTag)
{
    int32 TagIdx = TagToInt(StanceTag);
    SaveConstEntity(Entity, PropertyId::Stance, TagIdx);
    return *this;
}

// ============================================================================
// Item Skill
// ============================================================================

FHktStoryBuilder& FHktStoryBuilder::SetItemSkillTag(RegisterIndex Entity, const FGameplayTag& SkillTag)
{
    int32 TagIdx = TagToInt(SkillTag);
    SaveConstEntity(Entity, PropertyId::ItemSkillTag, TagIdx);
    return *this;
}

// ============================================================================
// Event Dispatch
// ============================================================================

FHktStoryBuilder& FHktStoryBuilder::DispatchEvent(const FGameplayTag& EventTag)
{
    int32 TagIdx = TagToInt(EventTag);
    Emit(FInstruction::MakeImm(EOpCode::DispatchEvent, 0, TagIdx));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::DispatchEventTo(const FGameplayTag& EventTag, RegisterIndex TargetEntity)
{
    int32 TagIdx = TagToInt(EventTag);
    Emit(FInstruction::MakeImm(EOpCode::DispatchEventTo, TargetEntity, TagIdx));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::DispatchEventFrom(const FGameplayTag& EventTag, RegisterIndex SourceEntity)
{
    int32 TagIdx = TagToInt(EventTag);
    Emit(FInstruction::MakeImm(EOpCode::DispatchEventFrom, SourceEntity, TagIdx));
    return *this;
}

// ============================================================================
// Terrain
// ============================================================================

FHktStoryBuilder& FHktStoryBuilder::GetTerrainHeight(RegisterIndex Dst, RegisterIndex VoxelX, RegisterIndex VoxelY)
{
    Emit(FInstruction::Make(EOpCode::GetTerrainHeight, Dst, VoxelX, VoxelY));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::GetVoxelType(RegisterIndex Dst, RegisterIndex PosBase, RegisterIndex ZReg)
{
    Emit(FInstruction::Make(EOpCode::GetVoxelType, Dst, PosBase, ZReg));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::SetVoxel(RegisterIndex PosBase, RegisterIndex TypeReg)
{
    Emit(FInstruction::Make(EOpCode::SetVoxel, 0, PosBase, TypeReg));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::IsTerrainSolid(RegisterIndex Dst, RegisterIndex PosBase, RegisterIndex ZReg)
{
    Emit(FInstruction::Make(EOpCode::IsTerrainSolid, Dst, PosBase, ZReg));
    return *this;
}


FHktStoryBuilder& FHktStoryBuilder::EntityPosToVoxel(RegisterIndex OutVoxelBase, RegisterIndex Entity, int32 VoxelSizeCm)
{
    // 조합 연산: 엔티티 cm 위치를 복셀 좌표로 변환
    // 호출자가 UHktRuntimeGlobalSetting::VoxelSizeCm을 바이트코드 상수로 베이크하도록 전달한다.
    // OutVoxelBase+0 = PosX / VoxelSizeCm
    // OutVoxelBase+1 = PosY / VoxelSizeCm
    // OutVoxelBase+2 = PosZ / VoxelSizeCm
    FHktRegReserve guard(RegAllocator, {OutVoxelBase, Entity});
    FHktScopedReg divisor(*this);

    LoadStoreEntity(OutVoxelBase, Entity, PropertyId::PosX);
    LoadStoreEntity(static_cast<RegisterIndex>(OutVoxelBase + 1), Entity, PropertyId::PosY);
    LoadStoreEntity(static_cast<RegisterIndex>(OutVoxelBase + 2), Entity, PropertyId::PosZ);

    LoadConst(divisor, VoxelSizeCm);
    Div(OutVoxelBase, OutVoxelBase, divisor);
    Div(static_cast<RegisterIndex>(OutVoxelBase + 1), static_cast<RegisterIndex>(OutVoxelBase + 1), divisor);
    Div(static_cast<RegisterIndex>(OutVoxelBase + 2), static_cast<RegisterIndex>(OutVoxelBase + 2), divisor);

    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::DestroyVoxelAt(RegisterIndex PosBase)
{
    // TypeID = 0 (빈 공간)
    FHktRegReserve guard(RegAllocator, {PosBase});
    FHktScopedReg typeReg(*this);
    LoadConst(typeReg, 0);
    SetVoxel(PosBase, typeReg);
    return *this;
}

// ============================================================================
// Utility
// ============================================================================

FHktStoryBuilder& FHktStoryBuilder::Log(const FString& Message)
{
#if ENABLE_HKT_INSIGHTS
    int32 StrIdx = AddString(Message);
    Emit(FInstruction::MakeImm(EOpCode::Log, 0, StrIdx));
#endif
    return *this;
}

// ============================================================================
// Build
// ============================================================================

// VInst의 점프/조건점프 인스트럭션의 immediate 필드에 라벨 PC를 패치한다.
static void ResolveVInstFixup(FHktVInst& V, int32 Target)
{
    switch (V.Op)
    {
    case EOpCode::Jump:
        V.Imm20Field = Target;
        V.bUsesImm20 = true;
        break;
    case EOpCode::JumpIf:
    case EOpCode::JumpIfNot:
        V.Imm12Field = static_cast<uint16>(Target);
        break;
    default:
        break;
    }
}

void FHktStoryBuilder::FinalizeAndEmitBytecode(FCodeSection& Section, const FGameplayTag& Tag,
    TArray<FInstruction>& OutCode)
{
    // === 1) 라벨 해소: VInst의 Imm 필드에 라벨 PC를 패치 ===
    // FName 라벨 (사용자 정의 + Snippet)
    for (const auto& Fixup : Section.Fixups)
    {
        if (const int32* Target = Section.Labels.Find(Fixup.Value))
        {
            ResolveVInstFixup(Section.Code[Fixup.Key], *Target);
        }
        else
        {
            HKT_EVENT_LOG(HktLogTags::Core_Story, EHktLogLevel::Error, EHktLogSource::Server,
                FString::Printf(TEXT("Unresolved label: %s in Flow %s"),
                    *Fixup.Value.ToString(), *Tag.ToString()));
        }
    }

    // 정수 라벨 (자동 생성 — 힙할당 없음)
    for (const auto& Fixup : Section.IntFixups)
    {
        if (const int32* Target = Section.IntLabels.Find(Fixup.Value))
        {
            ResolveVInstFixup(Section.Code[Fixup.Key], *Target);
        }
        else
        {
            HKT_EVENT_LOG(HktLogTags::Core_Story, EHktLogLevel::Error, EHktLogSource::Server,
                FString::Printf(TEXT("Unresolved int label: 0x%08X in Flow %s"),
                    Fixup.Value, *Tag.ToString()));
        }
    }

    // === 2) 검증: 모든 사용된 VReg가 0..15 범위의 pre-colored인지 확인 ===
    // 단계 1: anonymous VReg가 없으므로 위반은 곧 버그. 단계 2에서 spill 처리로 확장.
    for (const FHktVRegMeta& Meta : Section.RegPool.Metas)
    {
        if (Meta.PinnedPhysical < 0 || Meta.PinnedPhysical >= FHktVRegPool::NumPhysicalRegs)
        {
            HKT_EVENT_LOG(HktLogTags::Core_Story, EHktLogLevel::Error, EHktLogSource::Server,
                FString::Printf(TEXT("Story '%s': pre-colored 범위(0..15)를 벗어난 VReg 발견 (Pinned=%d)"),
                    *Tag.ToString(), Meta.PinnedPhysical));
        }
    }

    // === 3) emit: VInst → FInstruction (인덱스 1:1) ===
    OutCode.Reset(Section.Code.Num());
    for (const FHktVInst& V : Section.Code)
    {
        OutCode.Add(HktVReg_ToInstruction(V, Section.RegPool));
    }
}

TSharedPtr<FHktVMProgram> FHktStoryBuilder::Build()
{
    if (MainSection->Code.Num() == 0 || MainSection->Code.Last().Op != EOpCode::Halt)
    {
        Halt();
    }

    // === MainSection: VInst → FInstruction emit (라벨 해소 포함) ===
    FinalizeAndEmitBytecode(*MainSection, Program->Tag, Program->Code);
    Program->Constants = MoveTemp(MainSection->Constants);
    Program->Strings = MoveTemp(MainSection->Strings);

    // === Archetype 프로퍼티 검증 ===
    if (ValidationErrors.Num() > 0)
    {
        HKT_EVENT_LOG(HktLogTags::Core_Story, EHktLogLevel::Error, EHktLogSource::Server, FString::Printf(
            TEXT("===== Story '%s' Build FAILED — Archetype validation ====="),
            *Program->Tag.ToString()));
        for (const FString& Err : ValidationErrors)
        {
            HKT_EVENT_LOG(HktLogTags::Core_Story, EHktLogLevel::Error, EHktLogSource::Server,
                FString::Printf(TEXT("  %s"), *Err));
        }
        return nullptr;
    }

    // === Story 바이트코드 검증 ===
    FHktStoryValidator Validator(Program->Code, Program->Tag, MainSection->Labels, MainSection->IntLabels, bFlowMode);

    if (!Validator.ValidateEntityFlow())
    {
        HKT_EVENT_LOG(HktLogTags::Core_Story, EHktLogLevel::Error, EHktLogSource::Server, FString::Printf(
            TEXT("Story BUILD FAILED: %s — 엔티티 레지스터 검증 실패. 이 Story는 등록되지 않습니다."),
            *Program->Tag.ToString()));
        ensureAlwaysMsgf(false, TEXT("Story BUILD FAILED: %s — 초기화되지 않은 레지스터를 엔티티로 사용. "
            "로그에서 상세 PC/OpCode 정보를 확인하세요."),
            *Program->Tag.ToString());
        return nullptr;
    }

    const int32 RegFlowWarnings = Validator.ValidateRegisterFlow();
#if !WITH_EDITOR
    // Game(Shipping) 빌드: RegisterFlow 경고도 치명적 오류로 처리
    if (RegFlowWarnings > 0)
    {
        HKT_EVENT_LOG(HktLogTags::Core_Story, EHktLogLevel::Error, EHktLogSource::Server, FString::Printf(
            TEXT("Story BUILD FAILED: %s — 레지스터 흐름 검증에서 %d건의 경고 발견. 이 Story는 등록되지 않습니다."),
            *Program->Tag.ToString(), RegFlowWarnings));
        return nullptr;
    }
#endif

    // === PreconditionSection: VInst → FInstruction emit ===
    if (PreconditionSection->Code.Num() > 0)
    {
        FinalizeAndEmitBytecode(*PreconditionSection, Program->Tag, Program->PreconditionCode);
        Program->PreconditionConstants = MoveTemp(PreconditionSection->Constants);
        Program->PreconditionStrings = MoveTemp(PreconditionSection->Strings);
    }

    return Program;
}

void FHktStoryBuilder::BuildAndRegister()
{
    TSharedPtr<FHktVMProgram> BuiltProgram = Build();
    if (BuiltProgram.IsValid())
    {
        FHktVMProgramRegistry::Get().RegisterProgram(BuiltProgram.ToSharedRef());
    }
}



// ============================================================================
// Public Query API
// ============================================================================

bool HktStory::ValidateEvent(const FHktWorldState& WorldState, const FHktEvent& Event)
{
    return FHktVMProgramRegistry::Get().ValidateEvent(WorldState, Event);
}
