// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktStoryBuilder.h"
#include "HktStoryValidator.h"
#include "HktCoreLog.h"
#include "HktCoreEventLog.h"
#include "HktCoreProperties.h"
#include "HktWorldState.h"
#include "HktCoreEvents.h"
#include "HktVRegIR.h"
#include "HktVRegAllocator.h"
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
    // 미등록 태그여도 fatal 처리하지 않는다 — 자동화 테스트나 동적 태그 시나리오에서
    // Tag 등록 없이도 Builder 를 만들 수 있어야 한다. 미등록 시 Program->Tag 는 빈 값.
    FGameplayTag Tag = FGameplayTag::RequestGameplayTag(TagName, /*ErrorIfNotFound*/ false);
    if (!Tag.IsValid())
    {
        UE_LOG(LogHktCore, Verbose, TEXT("FHktStoryBuilder::Create: tag '%s' is not registered; building with empty tag."), *TagName.ToString());
    }
    return FHktStoryBuilder(Tag);
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

// ============================================================================
// FHktVar 기반 EmitV — 단계 2 (anonymous VReg 지원)
// ============================================================================

void FHktStoryBuilder::EmitV(EOpCode Op, FHktVar Dst, FHktVar Src1, FHktVar Src2, uint16 Imm12)
{
    FHktVInst V;
    V.Op = Op;
    V.Imm12Field = Imm12;
    V.bUsesImm20 = false;
    V.DstVReg = ToVRegId(Dst);
    V.Src1VReg = ToVRegId(Src1);
    V.Src2VReg = ToVRegId(Src2);
    // Field 들은 0 으로 두고, 단계 2 할당기 + ToInstruction 이 ResolvePhysical 로 채운다.
    ActiveSection->Code.Add(V);
}

void FHktStoryBuilder::EmitV_Imm20(EOpCode Op, FHktVar Dst, int32 Imm20)
{
    FHktVInst V;
    V.Op = Op;
    V.bUsesImm20 = true;
    V.Imm20Field = Imm20;
    V.DstVReg = ToVRegId(Dst);
    ActiveSection->Code.Add(V);
}

void FHktStoryBuilder::EmitV_Imm20NoDst(EOpCode Op, int32 Imm20)
{
    FHktVInst V;
    V.Op = Op;
    V.bUsesImm20 = true;
    V.Imm20Field = Imm20;
    ActiveSection->Code.Add(V);
}

// ============================================================================
// FHktVar — 변수 발급
// ============================================================================

FHktVar FHktStoryBuilder::NewVar(const TCHAR* DebugName)
{
    return FHktVar(ActiveSection->RegPool.NewAnonymous(DebugName));
}

FHktVarBlock FHktStoryBuilder::NewVarBlock(int32 Count, const TCHAR* DebugName)
{
    check(Count > 0 && Count <= 10);
    const FHktVRegId Base = ActiveSection->RegPool.NewAnonymousBlock(Count, DebugName);
    return FHktVarBlock(Base, Count);
}

FHktVar FHktStoryBuilder::Self()      { return FHktVar(ActiveSection->RegPool.EnsurePinned(Reg::Self)); }
FHktVar FHktStoryBuilder::Target()    { return FHktVar(ActiveSection->RegPool.EnsurePinned(Reg::Target)); }
FHktVar FHktStoryBuilder::SpawnedVar(){ return FHktVar(ActiveSection->RegPool.EnsurePinned(Reg::Spawned)); }
FHktVar FHktStoryBuilder::HitVar()    { return FHktVar(ActiveSection->RegPool.EnsurePinned(Reg::Hit)); }
FHktVar FHktStoryBuilder::IterVar()   { return FHktVar(ActiveSection->RegPool.EnsurePinned(Reg::Iter)); }
FHktVar FHktStoryBuilder::FlagVar()   { return FHktVar(ActiveSection->RegPool.EnsurePinned(Reg::Flag)); }

FHktVar FHktStoryBuilder::ResolveOrCreateNamedVar(const FString& Name)
{
    if (FHktVRegHandle* Found = NamedVarMap.Find(Name))
    {
        return FHktVar(*Found);
    }
    const FHktVRegId Id = ActiveSection->RegPool.NewAnonymous(*Name);
    NamedVarMap.Add(Name, Id);
    return FHktVar(Id);
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

bool FHktStoryBuilder::FinalizeAndEmitBytecode(FCodeSection& Section, const FGameplayTag& Tag,
    TArray<FInstruction>& OutCode, TArray<FString>& OutErrors)
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

    // === 2) Liveness + Linear-Scan 할당기 ===
    // 모든 VReg 가 pre-colored 면 즉시 반환 → byte-identical 보장. anonymous 가 있으면 GP 레지스터 배정.
    if (!HktVRegAlloc::Allocate(Section, Tag, OutErrors))
    {
        // 진단은 OutErrors 에 누적됨. 호출자가 Build 결과를 nullptr 로 반환할 수 있도록 false 반환.
        return false;
    }

    // === 3) 검증: 모든 사용된 VReg가 0..15 범위에 핀되었는지 확인 ===
    for (const FHktVRegMeta& Meta : Section.RegPool.Metas)
    {
        // 블록 멤버는 ResolvePhysical 이 base+offset 으로 자동 해소되므로 자체 PinnedPhysical 은 -1 일 수 있다.
        if (Meta.BlockBaseVReg >= 0) continue;
        if (Meta.PinnedPhysical < 0 || Meta.PinnedPhysical >= FHktVRegPool::NumPhysicalRegs)
        {
            HKT_EVENT_LOG(HktLogTags::Core_Story, EHktLogLevel::Error, EHktLogSource::Server,
                FString::Printf(TEXT("Story '%s': 미할당 또는 범위 외 VReg 발견 (Pinned=%d)"),
                    *Tag.ToString(), Meta.PinnedPhysical));
        }
    }

    // === 4) emit: VInst → FInstruction (인덱스 1:1) ===
    OutCode.Reset(Section.Code.Num());
    for (const FHktVInst& V : Section.Code)
    {
        OutCode.Add(HktVReg_ToInstruction(V, Section.RegPool));
    }
    return true;
}

TSharedPtr<FHktVMProgram> FHktStoryBuilder::Build()
{
    if (MainSection->Code.Num() == 0 || MainSection->Code.Last().Op != EOpCode::Halt)
    {
        Halt();
    }

    // === MainSection: VInst → FInstruction emit (라벨 해소 + 할당기 포함) ===
    if (!FinalizeAndEmitBytecode(*MainSection, Program->Tag, Program->Code, ValidationErrors))
    {
        HKT_EVENT_LOG(HktLogTags::Core_Story, EHktLogLevel::Error, EHktLogSource::Server, FString::Printf(
            TEXT("===== Story '%s' Build FAILED — Linear-Scan 할당 실패 ====="),
            *Program->Tag.ToString()));
        for (const FString& Err : ValidationErrors)
        {
            HKT_EVENT_LOG(HktLogTags::Core_Story, EHktLogLevel::Error, EHktLogSource::Server,
                FString::Printf(TEXT("  %s"), *Err));
        }
        return nullptr;
    }
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
        if (!FinalizeAndEmitBytecode(*PreconditionSection, Program->Tag, Program->PreconditionCode, ValidationErrors))
        {
            HKT_EVENT_LOG(HktLogTags::Core_Story, EHktLogLevel::Error, EHktLogSource::Server, FString::Printf(
                TEXT("Story '%s': Precondition Linear-Scan 할당 실패"),
                *Program->Tag.ToString()));
            return nullptr;
        }
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
// FHktVar 기반 신 API 구현 — 모든 메서드는 EmitV / EmitV_Imm20 / EmitV_Imm20NoDst 만 사용
// 하여 anonymous VReg 도 자연스럽게 처리된다. pre-colored VReg(Self/Target/...)는
// EnsurePinned 로 발급된 VReg ID를 그대로 전달한다.
// ============================================================================

namespace
{
    // 빈 FHktVar (InvalidVReg) — Src1/Src2 가 없는 op 에서 사용
    inline FHktVar VNone() { return FHktVar(); }
}

// ---- 데이터 ----
FHktStoryBuilder& FHktStoryBuilder::LoadConst(FHktVar Dst, int32 Value)
{
    if (Value >= -524288 && Value <= 524287)
    {
        EmitV_Imm20(EOpCode::LoadConst, Dst, Value);
    }
    else
    {
        EmitV_Imm20(EOpCode::LoadConst, Dst, Value & 0xFFFFF);
        EmitV(EOpCode::LoadConstHigh, Dst, VNone(), VNone(), static_cast<uint16>((Value >> 20) & 0xFFF));
    }
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::LoadStore(FHktVar Dst, uint16 PropertyId)
{
    ValidatePropertyAccess(PropertyId, SelfArchetype);
    EmitV(EOpCode::LoadStore, Dst, VNone(), VNone(), PropertyId);
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::LoadStoreEntity(FHktVar Dst, FHktVar Entity, uint16 PropertyId)
{
    EmitV(EOpCode::LoadStoreEntity, Dst, Entity, VNone(), PropertyId);
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::SaveStore(uint16 PropertyId, FHktVar Src)
{
    ValidatePropertyAccess(PropertyId, SelfArchetype);
    EmitV(EOpCode::SaveStore, VNone(), Src, VNone(), PropertyId);
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::SaveStoreEntity(FHktVar Entity, uint16 PropertyId, FHktVar Src)
{
    EmitV(EOpCode::SaveStoreEntity, VNone(), Entity, Src, PropertyId);
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::SaveConstEntity(FHktVar Entity, uint16 PropertyId, int32 Value)
{
    FHktVar Tmp = NewVar(TEXT("SaveConstEntity.Tmp"));
    LoadConst(Tmp, Value);
    SaveStoreEntity(Entity, PropertyId, Tmp);
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::Move(FHktVar Dst, FHktVar Src)
{
    EmitV(EOpCode::Move, Dst, Src, VNone(), 0);
    return *this;
}

// ---- 산술 ----
FHktStoryBuilder& FHktStoryBuilder::Add(FHktVar Dst, FHktVar Src1, FHktVar Src2) { EmitV(EOpCode::Add, Dst, Src1, Src2, 0); return *this; }
FHktStoryBuilder& FHktStoryBuilder::Sub(FHktVar Dst, FHktVar Src1, FHktVar Src2) { EmitV(EOpCode::Sub, Dst, Src1, Src2, 0); return *this; }
FHktStoryBuilder& FHktStoryBuilder::Mul(FHktVar Dst, FHktVar Src1, FHktVar Src2) { EmitV(EOpCode::Mul, Dst, Src1, Src2, 0); return *this; }
FHktStoryBuilder& FHktStoryBuilder::Div(FHktVar Dst, FHktVar Src1, FHktVar Src2) { EmitV(EOpCode::Div, Dst, Src1, Src2, 0); return *this; }
FHktStoryBuilder& FHktStoryBuilder::AddImm(FHktVar Dst, FHktVar Src, int32 Imm)
{
    EmitV(EOpCode::AddImm, Dst, Src, VNone(), static_cast<uint16>(Imm & 0xFFF));
    return *this;
}

// ---- 비교 ----
FHktStoryBuilder& FHktStoryBuilder::CmpEq(FHktVar D, FHktVar A, FHktVar B) { EmitV(EOpCode::CmpEq, D, A, B, 0); return *this; }
FHktStoryBuilder& FHktStoryBuilder::CmpNe(FHktVar D, FHktVar A, FHktVar B) { EmitV(EOpCode::CmpNe, D, A, B, 0); return *this; }
FHktStoryBuilder& FHktStoryBuilder::CmpLt(FHktVar D, FHktVar A, FHktVar B) { EmitV(EOpCode::CmpLt, D, A, B, 0); return *this; }
FHktStoryBuilder& FHktStoryBuilder::CmpLe(FHktVar D, FHktVar A, FHktVar B) { EmitV(EOpCode::CmpLe, D, A, B, 0); return *this; }
FHktStoryBuilder& FHktStoryBuilder::CmpGt(FHktVar D, FHktVar A, FHktVar B) { EmitV(EOpCode::CmpGt, D, A, B, 0); return *this; }
FHktStoryBuilder& FHktStoryBuilder::CmpGe(FHktVar D, FHktVar A, FHktVar B) { EmitV(EOpCode::CmpGe, D, A, B, 0); return *this; }

// ---- 점프 ----
FHktStoryBuilder& FHktStoryBuilder::JumpIf(FHktVar Cond, FName LabelName)
{
    ActiveSection->Fixups.Add({ActiveSection->Code.Num(), LabelName});
    EmitV(EOpCode::JumpIf, VNone(), Cond, VNone(), 0);
    return *this;
}
FHktStoryBuilder& FHktStoryBuilder::JumpIfNot(FHktVar Cond, FName LabelName)
{
    ActiveSection->Fixups.Add({ActiveSection->Code.Num(), LabelName});
    EmitV(EOpCode::JumpIfNot, VNone(), Cond, VNone(), 0);
    return *this;
}
FHktStoryBuilder& FHktStoryBuilder::JumpIf(FHktVar Cond, int32 Key)
{
    ActiveSection->IntFixups.Add({ActiveSection->Code.Num(), Key});
    EmitV(EOpCode::JumpIf, VNone(), Cond, VNone(), 0);
    return *this;
}
FHktStoryBuilder& FHktStoryBuilder::JumpIfNot(FHktVar Cond, int32 Key)
{
    ActiveSection->IntFixups.Add({ActiveSection->Code.Num(), Key});
    EmitV(EOpCode::JumpIfNot, VNone(), Cond, VNone(), 0);
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::If(FHktVar Cond)
{
    const int32 Id = IfCounter++;
    IfStack.Push({Id, false});
    JumpIfNot(Cond, MakeLabelKey(LT_If, Id, 0));   // → false branch
    return *this;
}
FHktStoryBuilder& FHktStoryBuilder::IfNot(FHktVar Cond)
{
    const int32 Id = IfCounter++;
    IfStack.Push({Id, false});
    JumpIf(Cond, MakeLabelKey(LT_If, Id, 0));      // → false branch
    return *this;
}

// ---- 엔티티 ----
FHktVar FHktStoryBuilder::SpawnEntityVar(const FGameplayTag& ClassTag)
{
    int32 TagIdx = TagToInt(ClassTag);
    EmitV_Imm20NoDst(EOpCode::SpawnEntity, TagIdx & 0xFFF);
    // 단계 2: SpawnEntity 의 결과 슬롯은 여전히 Reg::Spawned (VM 시맨틱). 명시 반환은 그 핸들.
    SpawnedArchetype = FHktArchetypeRegistry::Get().FindByTag(ClassTag);
    return SpawnedVar();
}

FHktStoryBuilder& FHktStoryBuilder::DestroyEntity(FHktVar Entity)
{
    EmitV(EOpCode::DestroyEntity, VNone(), Entity, VNone(), 0);
    return *this;
}

// ---- Position & Movement ----
FHktVarBlock FHktStoryBuilder::GetPosition(FHktVar Entity)
{
    FHktVarBlock Pos = NewVarBlock(3, TEXT("GetPosition"));
    LoadStoreEntity(Pos.Element(0), Entity, PropertyId::PosX);
    LoadStoreEntity(Pos.Element(1), Entity, PropertyId::PosY);
    LoadStoreEntity(Pos.Element(2), Entity, PropertyId::PosZ);
    return Pos;
}

FHktStoryBuilder& FHktStoryBuilder::SetPosition(FHktVar Entity, FHktVarBlock Src)
{
    check(Src.Num() >= 3);
    SaveStoreEntity(Entity, PropertyId::PosX, Src.Element(0));
    SaveStoreEntity(Entity, PropertyId::PosY, Src.Element(1));
    SaveStoreEntity(Entity, PropertyId::PosZ, Src.Element(2));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::CopyPosition(FHktVar DstEntity, FHktVar SrcEntity)
{
    FHktVarBlock Pos = GetPosition(SrcEntity);
    SetPosition(DstEntity, Pos);
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::MoveToward(FHktVar Entity, FHktVarBlock TargetPos, int32 Force)
{
    check(TargetPos.Num() >= 3);
    SaveStoreEntity(Entity, PropertyId::MoveTargetX, TargetPos.Element(0));
    SaveStoreEntity(Entity, PropertyId::MoveTargetY, TargetPos.Element(1));
    SaveStoreEntity(Entity, PropertyId::MoveTargetZ, TargetPos.Element(2));
    SaveConstEntity(Entity, PropertyId::MoveForce, Force);
    SaveConstEntity(Entity, PropertyId::IsMoving, 1);
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::MoveForward(FHktVar Entity, int32 Force)
{
    FHktVar Yaw = NewVar(TEXT("MoveForward.Yaw"));
    LoadStoreEntity(Yaw, Self(), PropertyId::RotYaw);
    SaveStoreEntity(Entity, PropertyId::RotYaw, Yaw);
    EmitV(EOpCode::SetForwardTarget, VNone(), Entity, VNone(), 0);
    SaveConstEntity(Entity, PropertyId::MoveForce, Force);
    SaveConstEntity(Entity, PropertyId::IsMoving, 1);
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::StopMovement(FHktVar Entity)
{
    SaveConstEntity(Entity, PropertyId::IsMoving, 0);
    SaveConstEntity(Entity, PropertyId::VelX, 0);
    SaveConstEntity(Entity, PropertyId::VelY, 0);
    SaveConstEntity(Entity, PropertyId::VelZ, 0);
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::ApplyJump(FHktVar Entity, int32 ImpulseVelZ)
{
    SaveConstEntity(Entity, PropertyId::IsGrounded, 0);
    SaveConstEntity(Entity, PropertyId::VelZ, ImpulseVelZ);
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::GetDistance(FHktVar Dst, FHktVar E1, FHktVar E2)
{
    EmitV(EOpCode::GetDistance, Dst, E1, E2, 0);
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::LookAt(FHktVar Entity, FHktVar TargetEntity)
{
    EmitV(EOpCode::LookAt, VNone(), Entity, TargetEntity, 0);
    return *this;
}

// ---- Spatial Query ----
FHktStoryBuilder& FHktStoryBuilder::FindInRadius(FHktVar CenterEntity, int32 RadiusCm)
{
    EmitV(EOpCode::FindInRadius, FlagVar(), CenterEntity, VNone(), static_cast<uint16>(RadiusCm & 0xFFF));
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::FindInRadiusEx(FHktVar CenterEntity, int32 RadiusCm, uint32 FilterMask)
{
    // VM 인터프리터는 Imm12 에 RadiusReg 의 물리 인덱스를 기대한다.
    // 신 API 에서 RadiusReg 를 anonymous 로 두면 할당 결과가 Imm12 인코딩과 일치하지 않으므로,
    // RadiusReg 를 pre-colored R0 로 강제하여 인코딩 일관성을 보장한다.
    // (PR-3 에서 VM 인터프리터를 VReg 기반으로 재설계하면 본 강제 핀이 제거된다.)
    FHktVar RadiusReg = FHktVar(ActiveSection->RegPool.EnsurePinned(0));
    FHktVar MaskReg = NewVar(TEXT("FindInRadiusEx.Mask"));
    LoadConst(RadiusReg, RadiusCm);
    LoadConst(MaskReg, static_cast<int32>(FilterMask));
    EmitV(EOpCode::FindInRadiusEx, FlagVar(), CenterEntity, MaskReg, /*Imm12=R0=*/0);
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::ForEachInRadius_Begin(FHktVar CenterEntity, int32 RadiusCm)
{
    const int32 Id = ForEachCounter++;
    ForEachStack.Push({Id});

    FindInRadius(CenterEntity, RadiusCm);
    Label(MakeLabelKey(LT_ForEach, Id, 0));          // loop
    EmitV(EOpCode::NextFound, IterVar(), VNone(), VNone(), 0);
    JumpIfNot(FlagVar(), MakeLabelKey(LT_ForEach, Id, 1)); // → end
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::ForEachInRadius_End()
{
    check(ForEachStack.Num() > 0);
    FForEachContext Ctx = ForEachStack.Pop();
    Jump(MakeLabelKey(LT_ForEach, Ctx.Id, 0));      // → loop
    Label(MakeLabelKey(LT_ForEach, Ctx.Id, 1));      // end
    return *this;
}

// ---- WaitCollision ----
FHktVar FHktStoryBuilder::WaitCollision(FHktVar Watch)
{
    // VM 시맨틱: WaitCollision 의 결과는 항상 Reg::Hit 슬롯
    EmitV(EOpCode::WaitCollision, HitVar(), Watch, VNone(), 0);
    return HitVar();
}

// ---- Combat ----
FHktStoryBuilder& FHktStoryBuilder::ApplyDamage(FHktVar TargetEntity, FHktVar Amount)
{
    FHktVar Dmg = NewVar(TEXT("ApplyDamage.Dmg"));
    FHktVar Scratch = NewVar(TEXT("ApplyDamage.Scratch"));
    Move(Dmg, Amount);
    LoadStoreEntity(Scratch, TargetEntity, PropertyId::Defense);
    Sub(Dmg, Dmg, Scratch);

    LoadConst(Scratch, 1);
    CmpLt(FlagVar(), Dmg, Scratch);
    {
        const int32 Key = MakeLabelKey(LT_Internal, InternalLabelCounter++, 0);
        JumpIfNot(FlagVar(), Key);
        Move(Dmg, Scratch);
        Label(Key);
    }

    LoadStoreEntity(Scratch, TargetEntity, PropertyId::Health);
    Sub(Scratch, Scratch, Dmg);

    {
        FHktVar Zero = NewVar(TEXT("ApplyDamage.Zero"));
        LoadConst(Zero, 0);
        CmpLt(FlagVar(), Scratch, Zero);
        const int32 Key = MakeLabelKey(LT_Internal, InternalLabelCounter++, 0);
        JumpIfNot(FlagVar(), Key);
        Move(Scratch, Zero);
        Label(Key);
    }

    SaveStoreEntity(TargetEntity, PropertyId::Health, Scratch);
    return *this;
}

FHktStoryBuilder& FHktStoryBuilder::ApplyDamageConst(FHktVar TargetEntity, int32 Amount)
{
    FHktVar AmountVar = NewVar(TEXT("ApplyDamageConst.Amount"));
    LoadConst(AmountVar, Amount);
    return ApplyDamage(TargetEntity, AmountVar);
}

// ---- Tags ----
FHktStoryBuilder& FHktStoryBuilder::AddTag(FHktVar Entity, const FGameplayTag& Tag)
{
    int32 TagIdx = TagToInt(Tag);
    EmitV(EOpCode::AddTag, VNone(), Entity, VNone(), static_cast<uint16>(TagIdx & 0xFFF));
    return *this;
}
FHktStoryBuilder& FHktStoryBuilder::RemoveTag(FHktVar Entity, const FGameplayTag& Tag)
{
    int32 TagIdx = TagToInt(Tag);
    EmitV(EOpCode::RemoveTag, VNone(), Entity, VNone(), static_cast<uint16>(TagIdx & 0xFFF));
    return *this;
}
FHktStoryBuilder& FHktStoryBuilder::HasTag(FHktVar Dst, FHktVar Entity, const FGameplayTag& Tag)
{
    int32 TagIdx = TagToInt(Tag);
    EmitV(EOpCode::HasTag, Dst, Entity, VNone(), static_cast<uint16>(TagIdx & 0xFFF));
    return *this;
}
FHktStoryBuilder& FHktStoryBuilder::CheckTrait(FHktVar Dst, FHktVar Entity, const FHktPropertyTrait* Trait)
{
    int32 TraitIdx = FHktArchetypeRegistry::Get().GetTraitIndex(Trait);
    checkf(TraitIdx >= 0, TEXT("CheckTrait: Trait not registered"));
    EmitV(EOpCode::CheckTrait, Dst, Entity, VNone(), static_cast<uint16>(TraitIdx & 0xFFF));
    return *this;
}
FHktStoryBuilder& FHktStoryBuilder::IfHasTrait(FHktVar Entity, const FHktPropertyTrait* Trait)
{
    FHktVar Tmp = NewVar(TEXT("IfHasTrait.Tmp"));
    CheckTrait(Tmp, Entity, Trait);
    return If(Tmp);
}

// ---- Presentation ----
FHktStoryBuilder& FHktStoryBuilder::ApplyEffect(FHktVar Target, const FGameplayTag& EffectTag)
{
    int32 TagIdx = TagToInt(EffectTag);
    EmitV(EOpCode::ApplyEffect, VNone(), Target, VNone(), static_cast<uint16>(TagIdx & 0xFFF));
    return *this;
}
FHktStoryBuilder& FHktStoryBuilder::RemoveEffect(FHktVar Target, const FGameplayTag& EffectTag)
{
    int32 TagIdx = TagToInt(EffectTag);
    EmitV(EOpCode::RemoveEffect, VNone(), Target, VNone(), static_cast<uint16>(TagIdx & 0xFFF));
    return *this;
}
FHktStoryBuilder& FHktStoryBuilder::PlayVFX(FHktVarBlock PosBlock, const FGameplayTag& VFXTag)
{
    int32 TagIdx = TagToInt(VFXTag);
    EmitV(EOpCode::PlayVFX, VNone(), PosBlock.Element(0), VNone(), static_cast<uint16>(TagIdx & 0xFFF));
    return *this;
}
FHktStoryBuilder& FHktStoryBuilder::PlayVFXAttached(FHktVar Entity, const FGameplayTag& VFXTag)
{
    int32 TagIdx = TagToInt(VFXTag);
    EmitV(EOpCode::PlayVFXAttached, VNone(), Entity, VNone(), static_cast<uint16>(TagIdx & 0xFFF));
    return *this;
}
FHktStoryBuilder& FHktStoryBuilder::PlayAnim(FHktVar Entity, const FGameplayTag& AnimTag)
{
    int32 TagIdx = TagToInt(AnimTag);
    EmitV(EOpCode::PlayAnim, VNone(), Entity, VNone(), static_cast<uint16>(TagIdx & 0xFFF));
    return *this;
}
FHktStoryBuilder& FHktStoryBuilder::PlaySoundAtLocation(FHktVarBlock PosBlock, const FGameplayTag& SoundTag)
{
    int32 TagIdx = TagToInt(SoundTag);
    EmitV(EOpCode::PlaySoundAtLocation, VNone(), PosBlock.Element(0), VNone(), static_cast<uint16>(TagIdx & 0xFFF));
    return *this;
}
FHktStoryBuilder& FHktStoryBuilder::PlayVFXAtEntity(FHktVar Entity, const FGameplayTag& VFXTag)
{
    FHktVarBlock Pos = GetPosition(Entity);
    return PlayVFX(Pos, VFXTag);
}
FHktStoryBuilder& FHktStoryBuilder::PlaySoundAtEntity(FHktVar Entity, const FGameplayTag& SoundTag)
{
    FHktVarBlock Pos = GetPosition(Entity);
    return PlaySoundAtLocation(Pos, SoundTag);
}

// ---- World Query ----
FHktStoryBuilder& FHktStoryBuilder::CountByTag(FHktVar Dst, const FGameplayTag& Tag)
{
    int32 TagIdx = TagToInt(Tag);
    EmitV(EOpCode::CountByTag, Dst, VNone(), VNone(), static_cast<uint16>(TagIdx & 0xFFF));
    return *this;
}
FHktStoryBuilder& FHktStoryBuilder::GetWorldTime(FHktVar Dst)
{
    EmitV(EOpCode::GetWorldTime, Dst, VNone(), VNone(), 0);
    return *this;
}
FHktStoryBuilder& FHktStoryBuilder::RandomInt(FHktVar Dst, FHktVar Mod)
{
    EmitV(EOpCode::RandomInt, Dst, Mod, VNone(), 0);
    return *this;
}
FHktStoryBuilder& FHktStoryBuilder::HasPlayerInGroup(FHktVar Dst)
{
    EmitV(EOpCode::HasPlayerInGroup, Dst, VNone(), VNone(), 0);
    return *this;
}

// ---- Item ----
FHktStoryBuilder& FHktStoryBuilder::CountByOwner(FHktVar Dst, FHktVar OwnerEntity, const FGameplayTag& Tag)
{
    int32 TagIdx = TagToInt(Tag);
    EmitV(EOpCode::CountByOwner, Dst, OwnerEntity, VNone(), static_cast<uint16>(TagIdx & 0xFFF));
    return *this;
}
FHktStoryBuilder& FHktStoryBuilder::FindByOwner(FHktVar OwnerEntity, const FGameplayTag& Tag)
{
    int32 TagIdx = TagToInt(Tag);
    EmitV(EOpCode::FindByOwner, FlagVar(), OwnerEntity, VNone(), static_cast<uint16>(TagIdx & 0xFFF));
    return *this;
}
FHktStoryBuilder& FHktStoryBuilder::SetOwnerUid(FHktVar Entity)
{
    EmitV(EOpCode::SetOwnerUid, VNone(), Entity, VNone(), 0);
    return *this;
}
FHktStoryBuilder& FHktStoryBuilder::ClearOwnerUid(FHktVar Entity)
{
    EmitV(EOpCode::ClearOwnerUid, VNone(), Entity, VNone(), 0);
    return *this;
}

// ---- Stance / Item skill ----
FHktStoryBuilder& FHktStoryBuilder::SetStance(FHktVar Entity, const FGameplayTag& StanceTag)
{
    int32 TagIdx = TagToInt(StanceTag);
    SaveConstEntity(Entity, PropertyId::Stance, TagIdx);
    return *this;
}
FHktStoryBuilder& FHktStoryBuilder::SetItemSkillTag(FHktVar Entity, const FGameplayTag& SkillTag)
{
    int32 TagIdx = TagToInt(SkillTag);
    SaveConstEntity(Entity, PropertyId::ItemSkillTag, TagIdx);
    return *this;
}

// ---- Event Dispatch ----
FHktStoryBuilder& FHktStoryBuilder::DispatchEventTo(const FGameplayTag& EventTag, FHktVar TargetEntity)
{
    int32 TagIdx = TagToInt(EventTag);
    EmitV_Imm20(EOpCode::DispatchEventTo, TargetEntity, TagIdx);
    return *this;
}
FHktStoryBuilder& FHktStoryBuilder::DispatchEventFrom(const FGameplayTag& EventTag, FHktVar SourceEntity)
{
    int32 TagIdx = TagToInt(EventTag);
    EmitV_Imm20(EOpCode::DispatchEventFrom, SourceEntity, TagIdx);
    return *this;
}

// ---- Terrain ----
FHktStoryBuilder& FHktStoryBuilder::GetTerrainHeight(FHktVar Dst, FHktVar VoxelX, FHktVar VoxelY)
{
    EmitV(EOpCode::GetTerrainHeight, Dst, VoxelX, VoxelY, 0);
    return *this;
}
FHktStoryBuilder& FHktStoryBuilder::GetVoxelType(FHktVar Dst, FHktVarBlock PosXY, FHktVar Z)
{
    check(PosXY.Num() >= 2);
    EmitV(EOpCode::GetVoxelType, Dst, PosXY.Element(0), Z, 0);
    return *this;
}
FHktStoryBuilder& FHktStoryBuilder::SetVoxel(FHktVarBlock Pos, FHktVar Type)
{
    check(Pos.Num() >= 3);
    EmitV(EOpCode::SetVoxel, VNone(), Pos.Element(0), Type, 0);
    return *this;
}
FHktStoryBuilder& FHktStoryBuilder::IsTerrainSolid(FHktVar Dst, FHktVarBlock PosXY, FHktVar Z)
{
    check(PosXY.Num() >= 2);
    EmitV(EOpCode::IsTerrainSolid, Dst, PosXY.Element(0), Z, 0);
    return *this;
}
FHktVarBlock FHktStoryBuilder::EntityPosToVoxel(FHktVar Entity, int32 VoxelSizeCm)
{
    FHktVarBlock Out = NewVarBlock(3, TEXT("EntityPosToVoxel"));
    FHktVar Divisor = NewVar(TEXT("EntityPosToVoxel.Divisor"));
    LoadStoreEntity(Out.Element(0), Entity, PropertyId::PosX);
    LoadStoreEntity(Out.Element(1), Entity, PropertyId::PosY);
    LoadStoreEntity(Out.Element(2), Entity, PropertyId::PosZ);
    LoadConst(Divisor, VoxelSizeCm);
    Div(Out.Element(0), Out.Element(0), Divisor);
    Div(Out.Element(1), Out.Element(1), Divisor);
    Div(Out.Element(2), Out.Element(2), Divisor);
    return Out;
}
FHktStoryBuilder& FHktStoryBuilder::DestroyVoxelAt(FHktVarBlock Pos)
{
    FHktVar Type = NewVar(TEXT("DestroyVoxelAt.Type"));
    LoadConst(Type, 0);
    return SetVoxel(Pos, Type);
}

// ---- Wait ----
FHktStoryBuilder& FHktStoryBuilder::WaitAnimEnd(FHktVar Entity)
{
    EmitV(EOpCode::WaitAnimEnd, VNone(), Entity, VNone(), 0);
    return *this;
}
FHktStoryBuilder& FHktStoryBuilder::WaitMoveEnd(FHktVar Entity)
{
    EmitV(EOpCode::WaitMoveEnd, VNone(), Entity, VNone(), 0);
    return *this;
}
FHktStoryBuilder& FHktStoryBuilder::WaitGrounded(FHktVar Entity)
{
    EmitV(EOpCode::WaitGrounded, VNone(), Entity, VNone(), 0);
    return *this;
}

// ============================================================================
// Public Query API
// ============================================================================

bool HktStory::ValidateEvent(const FHktWorldState& WorldState, const FHktEvent& Event)
{
    return FHktVMProgramRegistry::Get().ValidateEvent(WorldState, Event);
}
