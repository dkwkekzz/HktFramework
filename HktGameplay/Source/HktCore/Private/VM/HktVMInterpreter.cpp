// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVMInterpreter.h"
#include "HktVMProgram.h"
#include "HktVMContext.h"
#include "HktVMWorldStateProxy.h"
#include "HktCoreEvents.h"
#include "HktCoreLog.h"
#include "HktCoreEventLog.h"
#include "HktCoreProperties.h"
#include "HktSimulationLimits.h"

void FHktVMInterpreter::Initialize(FHktWorldState* InWorldState, FHktVMWorldStateProxy* InVMProxy,
                                   FHktTerrainState* InTerrainState, TArray<FHktVoxelDelta>* InPendingVoxelDeltas)
{
    WorldState = InWorldState;
    VMProxy = InVMProxy;
    TerrainState = InTerrainState;
    PendingVoxelDeltas = InPendingVoxelDeltas;
}

EVMStatus FHktVMInterpreter::Execute(FHktVMRuntime& Runtime)
{
    if (!Runtime.Program || !Runtime.Program->IsValid())
        return EVMStatus::Failed;

    if (Runtime.Status == EVMStatus::WaitingEvent)
        return EVMStatus::WaitingEvent;

    const FHktVMProgram& Program = *Runtime.Program;
    int32 InstructionCount = 0;

    while (InstructionCount < MaxInstructionsPerTick)
    {
        if (Runtime.PC < 0 || Runtime.PC >= Program.CodeSize())
            return EVMStatus::Completed;

        const FInstruction& Inst = Program.Code[Runtime.PC];
        Runtime.PC++;
        InstructionCount++;

        EVMStatus Status = ExecuteInstruction(Runtime, Inst);
        if (Status != EVMStatus::Running)
            return Status;
    }

    return EVMStatus::Yielded;
}

EVMStatus FHktVMInterpreter::ExecuteInstruction(FHktVMRuntime& Runtime, const FInstruction& Inst)
{
    switch (Inst.GetOpCode())
    {
    // Control Flow
    case EOpCode::Nop: break;
    case EOpCode::Halt: return EVMStatus::Completed;
    case EOpCode::Fail: return EVMStatus::Failed;
    case EOpCode::Yield: return Op_Yield(Runtime, Inst.Imm12);
    case EOpCode::YieldSeconds: return Op_YieldSeconds(Runtime, Inst.GetSignedImm20());
    case EOpCode::Jump: Op_Jump(Runtime, Inst.Imm20); break;
    case EOpCode::JumpIf: Op_JumpIf(Runtime, Inst.Src1, Inst.Imm12); break;
    case EOpCode::JumpIfNot: Op_JumpIfNot(Runtime, Inst.Src1, Inst.Imm12); break;
    // Event Wait
    case EOpCode::WaitCollision: return Op_WaitCollision(Runtime, Inst.Src1);
    case EOpCode::WaitMoveEnd: return Op_WaitMoveEnd(Runtime, Inst.Src1);
    case EOpCode::WaitGrounded: return Op_WaitGrounded(Runtime, Inst.Src1);
    case EOpCode::WaitAnimEnd: return Op_WaitAnimEnd(Runtime, Inst.Src1);
    // Data Operations
    case EOpCode::LoadConst: Op_LoadConst(Runtime, Inst._Dst, Inst.GetSignedImm20()); break;
    case EOpCode::LoadConstHigh: Op_LoadConstHigh(Runtime, Inst.Dst, Inst.Imm12); break;
    case EOpCode::LoadStore: Op_LoadStore(Runtime, Inst.Dst, Inst.Imm12); break;
    case EOpCode::LoadStoreEntity: Op_LoadStoreEntity(Runtime, Inst.Dst, Inst.Src1, Inst.Imm12); break;
    case EOpCode::SaveStore: Op_SaveStore(Runtime, Inst.Imm12, Inst.Src1); break;
    case EOpCode::SaveStoreEntity: Op_SaveStoreEntity(Runtime, Inst.Src1, Inst.Imm12, Inst.Src2); break;
    case EOpCode::Move: Op_Move(Runtime, Inst.Dst, Inst.Src1); break;
    // Arithmetic
    case EOpCode::Add: Op_Add(Runtime, Inst.Dst, Inst.Src1, Inst.Src2); break;
    case EOpCode::Sub: Op_Sub(Runtime, Inst.Dst, Inst.Src1, Inst.Src2); break;
    case EOpCode::Mul: Op_Mul(Runtime, Inst.Dst, Inst.Src1, Inst.Src2); break;
    case EOpCode::Div: Op_Div(Runtime, Inst.Dst, Inst.Src1, Inst.Src2); break;
    case EOpCode::Mod: Op_Mod(Runtime, Inst.Dst, Inst.Src1, Inst.Src2); break;
    case EOpCode::AddImm: Op_AddImm(Runtime, Inst.Dst, Inst.Src1, Inst.GetSignedImm12()); break;
    // Comparison
    case EOpCode::CmpEq: Op_CmpEq(Runtime, Inst.Dst, Inst.Src1, Inst.Src2); break;
    case EOpCode::CmpNe: Op_CmpNe(Runtime, Inst.Dst, Inst.Src1, Inst.Src2); break;
    case EOpCode::CmpLt: Op_CmpLt(Runtime, Inst.Dst, Inst.Src1, Inst.Src2); break;
    case EOpCode::CmpLe: Op_CmpLe(Runtime, Inst.Dst, Inst.Src1, Inst.Src2); break;
    case EOpCode::CmpGt: Op_CmpGt(Runtime, Inst.Dst, Inst.Src1, Inst.Src2); break;
    case EOpCode::CmpGe: Op_CmpGe(Runtime, Inst.Dst, Inst.Src1, Inst.Src2); break;
    // Entity
    case EOpCode::SpawnEntity: Op_SpawnEntity(Runtime, Inst.Imm12); break;
    case EOpCode::DestroyEntity: Op_DestroyEntity(Runtime, Inst.Src1); break;
    // Spatial Query
    case EOpCode::GetDistance: Op_GetDistance(Runtime, Inst.Dst, Inst.Src1, Inst.Src2); break;
    case EOpCode::LookAt: Op_LookAt(Runtime, Inst.Src1, Inst.Src2); break;
    case EOpCode::FindInRadius: Op_FindInRadius(Runtime, Inst.Src1, Inst.Imm12); break;
    case EOpCode::FindInRadiusEx: Op_FindInRadiusEx(Runtime, Inst.Src1, Inst.Src2, static_cast<RegisterIndex>(Inst.Imm12 & 0xF)); break;
    case EOpCode::NextFound: Op_NextFound(Runtime); break;
    // Presentation
    case EOpCode::ApplyEffect: Op_ApplyEffect(Runtime, Inst.Src1, Inst.Imm12); break;
    case EOpCode::RemoveEffect: Op_RemoveEffect(Runtime, Inst.Src1, Inst.Imm12); break;
    case EOpCode::PlayVFX: Op_PlayVFX(Runtime, Inst.Src1, Inst.Imm12); break;
    case EOpCode::PlayVFXAttached: Op_PlayVFXAttached(Runtime, Inst.Src1, Inst.Imm12); break;
    case EOpCode::PlayAnim: Op_PlayAnim(Runtime, Inst.Src1, Inst.Imm12); break;
    case EOpCode::PlaySound: Op_PlaySound(Runtime, Inst.GetSignedImm20()); break;
    case EOpCode::PlaySoundAtLocation: Op_PlaySoundAtLocation(Runtime, Inst.Src1, Inst.Imm12); break;
    // Tags
    case EOpCode::AddTag:    Op_AddTag(Runtime, Inst.Src1, Inst.Imm12); break;
    case EOpCode::RemoveTag: Op_RemoveTag(Runtime, Inst.Src1, Inst.Imm12); break;
    case EOpCode::HasTag:     Op_HasTag(Runtime, Inst.Dst, Inst.Src1, Inst.Imm12); break;
    case EOpCode::CheckTrait: Op_CheckTrait(Runtime, Inst.Dst, Inst.Src1, Inst.Imm12); break;
    // NPC Spawning
    case EOpCode::CountByTag: Op_CountByTag(Runtime, Inst.Dst, Inst.Imm12); break;
    case EOpCode::GetWorldTime: Op_GetWorldTime(Runtime, Inst.Dst); break;
    case EOpCode::RandomInt: Op_RandomInt(Runtime, Inst.Dst, Inst.Src1); break;
    case EOpCode::HasPlayerInGroup: Op_HasPlayerInGroup(Runtime, Inst.Dst); break;
    // Item System
    case EOpCode::CountByOwner: Op_CountByOwner(Runtime, Inst.Dst, Inst.Src1, Inst.Imm12); break;
    case EOpCode::FindByOwner: Op_FindByOwner(Runtime, Inst.Src1, Inst.Imm12); break;
    case EOpCode::SetOwnerUid: Op_SetOwnerUid(Runtime, Inst.Src1); break;
    case EOpCode::ClearOwnerUid: Op_ClearOwnerUid(Runtime, Inst.Src1); break;
    // Event Dispatch
    case EOpCode::DispatchEvent: Op_DispatchEvent(Runtime, Inst.GetSignedImm20()); break;
    case EOpCode::DispatchEventTo: Op_DispatchEventTo(Runtime, Inst.Dst, Inst.GetSignedImm20()); break;
    case EOpCode::DispatchEventFrom: Op_DispatchEventFrom(Runtime, Inst.Dst, Inst.GetSignedImm20()); break;
    // Movement
    case EOpCode::SetForwardTarget: Op_SetForwardTarget(Runtime, Inst.Src1); break;
    // Terrain
    case EOpCode::GetTerrainHeight: Op_GetTerrainHeight(Runtime, Inst.Dst, Inst.Src1, Inst.Src2); break;
    case EOpCode::GetVoxelType: Op_GetVoxelType(Runtime, Inst.Dst, Inst.Src1, Inst.Src2); break;
    case EOpCode::SetVoxel: Op_SetVoxel(Runtime, Inst.Src1, Inst.Src2); break;
    case EOpCode::IsTerrainSolid: Op_IsTerrainSolid(Runtime, Inst.Dst, Inst.Src1, Inst.Src2); break;
    case EOpCode::InteractTerrain: Op_InteractTerrain(Runtime, Inst.Src1, Inst.Imm12); break;
    // Utility
    case EOpCode::Log: Op_Log(Runtime, Inst.GetSignedImm20()); break;
    default: return EVMStatus::Failed;
    }
    return EVMStatus::Running;
}

// ============================================================================
// Control Flow
// ============================================================================

void FHktVMInterpreter::Op_Nop(FHktVMRuntime& Runtime) {}

EVMStatus FHktVMInterpreter::Op_Halt(FHktVMRuntime& Runtime) { return EVMStatus::Completed; }

EVMStatus FHktVMInterpreter::Op_Yield(FHktVMRuntime& Runtime, int32 Frames)
{
    Runtime.WaitFrames = FMath::Max(1, Frames);
    return EVMStatus::Yielded;
}

EVMStatus FHktVMInterpreter::Op_YieldSeconds(FHktVMRuntime& Runtime, int32 DeciMillis)
{
    // DeciMillis(=ms*10) → 30Hz 프레임 정수 변환 (반올림). float 사용 금지 — 결정론.
    // ex) 1초(=10000) * 30 = 300000, /10000 = 30 frames
    Runtime.EventWait.Type = EWaitEventType::Timer;
    Runtime.EventWait.RemainingFrames =
        FMath::Max(1, (DeciMillis * HktLimits::FramesPerSecond + 5000) / 10000);
    return EVMStatus::WaitingEvent;
}

void FHktVMInterpreter::Op_Jump(FHktVMRuntime& Runtime, int32 Target) { Runtime.PC = Target; }

void FHktVMInterpreter::Op_JumpIf(FHktVMRuntime& Runtime, RegisterIndex Cond, int32 Target)
{
    if (Runtime.GetReg(Cond) != 0) Runtime.PC = Target;
}

void FHktVMInterpreter::Op_JumpIfNot(FHktVMRuntime& Runtime, RegisterIndex Cond, int32 Target)
{
    if (Runtime.GetReg(Cond) == 0) Runtime.PC = Target;
}

// ============================================================================
// Event Wait
// ============================================================================

EVMStatus FHktVMInterpreter::Op_WaitCollision(FHktVMRuntime& Runtime, RegisterIndex WatchEntity)
{
    Runtime.EventWait.Type = EWaitEventType::Collision;
    Runtime.EventWait.WatchedEntity = Runtime.GetRegEntity(WatchEntity);
    HKT_EVENT_LOG_ENTITY(HktLogTags::Core_VM, EHktLogLevel::Info, LogSource,
        FString::Printf(TEXT("Op_WaitCollision WatchEntity=%d"), Runtime.EventWait.WatchedEntity),
        Runtime.EventWait.WatchedEntity);
    return EVMStatus::WaitingEvent;
}

EVMStatus FHktVMInterpreter::Op_WaitMoveEnd(FHktVMRuntime& Runtime, RegisterIndex WatchEntity)
{
    Runtime.EventWait.Type = EWaitEventType::MoveEnd;
    Runtime.EventWait.WatchedEntity = Runtime.GetRegEntity(WatchEntity);
    HKT_EVENT_LOG_ENTITY(HktLogTags::Core_VM, EHktLogLevel::Info, LogSource,
        FString::Printf(TEXT("Op_WaitMoveEnd WatchEntity=%d"), Runtime.EventWait.WatchedEntity),
        Runtime.EventWait.WatchedEntity);
    return EVMStatus::WaitingEvent;
}

EVMStatus FHktVMInterpreter::Op_WaitGrounded(FHktVMRuntime& Runtime, RegisterIndex WatchEntity)
{
    Runtime.EventWait.Type = EWaitEventType::Grounded;
    Runtime.EventWait.WatchedEntity = Runtime.GetRegEntity(WatchEntity);
    HKT_EVENT_LOG_ENTITY(HktLogTags::Core_VM, EHktLogLevel::Info, LogSource,
        FString::Printf(TEXT("Op_WaitGrounded WatchEntity=%d"), Runtime.EventWait.WatchedEntity),
        Runtime.EventWait.WatchedEntity);
    return EVMStatus::WaitingEvent;
}

EVMStatus FHktVMInterpreter::Op_WaitAnimEnd(FHktVMRuntime& Runtime, RegisterIndex WatchEntity)
{
    // 결정론적 고정 프레임 대기 — 서버/클라 동일한 Timer 사용 (1초 = FramesPerSecond)
    // 실제 몽타주 길이와 정확히 일치하지 않아도 됨 (태그 제거만 하면 됨)
    static constexpr int32 DefaultAnimWaitFrames = HktLimits::FramesPerSecond;
    Runtime.EventWait.Type = EWaitEventType::Timer;
    Runtime.EventWait.RemainingFrames = DefaultAnimWaitFrames;
    HKT_EVENT_LOG_ENTITY(HktLogTags::Core_VM, EHktLogLevel::Info, LogSource,
        FString::Printf(TEXT("Op_WaitAnimEnd WatchEntity=%d (Timer=%dframes)"),
        Runtime.GetRegEntity(WatchEntity), DefaultAnimWaitFrames),
        Runtime.GetRegEntity(WatchEntity));
    return EVMStatus::WaitingEvent;
}

// ============================================================================
// Data Operations
// ============================================================================

void FHktVMInterpreter::Op_LoadConst(FHktVMRuntime& Runtime, RegisterIndex Dst, int32 Value)
{
    Runtime.SetReg(Dst, Value);
}

void FHktVMInterpreter::Op_LoadConstHigh(FHktVMRuntime& Runtime, RegisterIndex Dst, int32 HighBits)
{
    Runtime.SetReg(Dst, (Runtime.GetReg(Dst) & 0xFFFFF) | (HighBits << 20));
}

void FHktVMInterpreter::Op_LoadStore(FHktVMRuntime& Runtime, RegisterIndex Dst, uint16 PropId)
{
    if (Runtime.Context)
    {
        const int32 Value = Runtime.Context->Read(PropId);
        Runtime.SetReg(Dst, Value);
    }
}

void FHktVMInterpreter::Op_LoadStoreEntity(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex Entity, uint16 PropId)
{
    if (Runtime.Context)
    {
        FHktEntityId E = Runtime.GetRegEntity(Entity);
        const int32 Value = Runtime.Context->ReadEntity(E, PropId);
        Runtime.SetReg(Dst, Value);
    }
}

void FHktVMInterpreter::Op_SaveStore(FHktVMRuntime& Runtime, uint16 PropId, RegisterIndex Src)
{
    if (Runtime.Context)
    {
        const int32 Value = Runtime.GetReg(Src);
        const int32 OldValue = Runtime.Context->Read(PropId);
        Runtime.Context->Write(PropId, Value);
        if (OldValue != Value)
        {
            const TCHAR* PropName = HktProperty::GetPropertyName(PropId);
            HKT_EVENT_LOG_ENTITY(HktLogTags::Core_VM, EHktLogLevel::Verbose, LogSource,
                FString::Printf(TEXT("[%s] Op_SaveStore %s(%d) %d->%d"),
                    Runtime.Program ? *Runtime.Program->Tag.ToString() : TEXT("?"),
                    PropName ? PropName : TEXT("?"), PropId, OldValue, Value),
                Runtime.Context->SourceEntity);
        }
    }
}

void FHktVMInterpreter::Op_SaveStoreEntity(FHktVMRuntime& Runtime, RegisterIndex Entity, uint16 PropId, RegisterIndex Src)
{
    if (Runtime.Context)
    {
        FHktEntityId E = Runtime.GetRegEntity(Entity);
        const int32 Value = Runtime.GetReg(Src);
        const int32 OldValue = Runtime.Context->ReadEntity(E, PropId);
        Runtime.Context->WriteEntity(E, PropId, Value);
        if (OldValue != Value)
        {
            const TCHAR* PropName = HktProperty::GetPropertyName(PropId);
            HKT_EVENT_LOG_ENTITY(HktLogTags::Core_VM, EHktLogLevel::Verbose, LogSource,
                FString::Printf(TEXT("[%s] Op_SaveStoreEntity Id=%d %s(%d) %d->%d"),
                    Runtime.Program ? *Runtime.Program->Tag.ToString() : TEXT("?"),
                    E, PropName ? PropName : TEXT("?"), PropId, OldValue, Value),
                E);
        }
    }
}

void FHktVMInterpreter::Op_Move(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex Src)
{
    Runtime.SetReg(Dst, Runtime.GetReg(Src));
}

// ============================================================================
// Arithmetic
// ============================================================================

void FHktVMInterpreter::Op_Add(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2)
{
    Runtime.SetReg(Dst, Runtime.GetReg(Src1) + Runtime.GetReg(Src2));
}

void FHktVMInterpreter::Op_Sub(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2)
{
    Runtime.SetReg(Dst, Runtime.GetReg(Src1) - Runtime.GetReg(Src2));
}

void FHktVMInterpreter::Op_Mul(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2)
{
    Runtime.SetReg(Dst, Runtime.GetReg(Src1) * Runtime.GetReg(Src2));
}

void FHktVMInterpreter::Op_Div(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2)
{
    int32 D = Runtime.GetReg(Src2);
    Runtime.SetReg(Dst, D != 0 ? Runtime.GetReg(Src1) / D : 0);
}

void FHktVMInterpreter::Op_Mod(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2)
{
    int32 D = Runtime.GetReg(Src2);
    Runtime.SetReg(Dst, D != 0 ? Runtime.GetReg(Src1) % D : 0);
}

void FHktVMInterpreter::Op_AddImm(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex Src, int32 Imm)
{
    Runtime.SetReg(Dst, Runtime.GetReg(Src) + Imm);
}

// ============================================================================
// Comparison
// ============================================================================

void FHktVMInterpreter::Op_CmpEq(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2)
{
    Runtime.SetReg(Dst, Runtime.GetReg(Src1) == Runtime.GetReg(Src2) ? 1 : 0);
}

void FHktVMInterpreter::Op_CmpNe(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2)
{
    Runtime.SetReg(Dst, Runtime.GetReg(Src1) != Runtime.GetReg(Src2) ? 1 : 0);
}

void FHktVMInterpreter::Op_CmpLt(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2)
{
    Runtime.SetReg(Dst, Runtime.GetReg(Src1) < Runtime.GetReg(Src2) ? 1 : 0);
}

void FHktVMInterpreter::Op_CmpLe(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2)
{
    Runtime.SetReg(Dst, Runtime.GetReg(Src1) <= Runtime.GetReg(Src2) ? 1 : 0);
}

void FHktVMInterpreter::Op_CmpGt(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2)
{
    Runtime.SetReg(Dst, Runtime.GetReg(Src1) > Runtime.GetReg(Src2) ? 1 : 0);
}

void FHktVMInterpreter::Op_CmpGe(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2)
{
    Runtime.SetReg(Dst, Runtime.GetReg(Src1) >= Runtime.GetReg(Src2) ? 1 : 0);
}

// ============================================================================
// ExecutePrecondition — 읽기 전용 바이트코드 실행
// ============================================================================

bool FHktVMInterpreter::ExecutePrecondition(
    const TArray<FInstruction>& Code,
    const TArray<int32>& Constants,
    const TArray<FString>& Strings,
    const FHktWorldState& WorldState,
    const FHktEvent& Event)
{
    if (Code.Num() == 0)
        return true;

    // 임시 프로그램 (스택에 구성, 바이트코드는 참조)
    FHktVMProgram TempProgram;
    TempProgram.Code = Code;       // 복사 (const → non-const 필요)
    TempProgram.Constants = Constants;
    TempProgram.Strings = Strings;

    // 읽기 전용 Context (VMProxy=nullptr → Write 호출 시 no-op)
    FHktVMContext TempContext;
    TempContext.SourceEntity = Event.SourceEntity;
    TempContext.TargetEntity = Event.TargetEntity;
    TempContext.WorldState = const_cast<FHktWorldState*>(&WorldState);
    TempContext.VMProxy = nullptr;  // 쓰기 차단
    TempContext.EventParam0 = Event.Param0;
    TempContext.EventParam1 = Event.Param1;
    TempContext.EventTargetPosX = static_cast<int32>(Event.Location.X);
    TempContext.EventTargetPosY = static_cast<int32>(Event.Location.Y);
    TempContext.EventTargetPosZ = static_cast<int32>(Event.Location.Z);

    // 임시 Runtime
    FHktVMRuntime TempRuntime;
    TempRuntime.Program = &TempProgram;
    TempRuntime.Context = &TempContext;
    TempRuntime.PC = 0;
    TempRuntime.Status = EVMStatus::Ready;
    TempRuntime.PlayerUid = Event.PlayerUid;
    FMemory::Memzero(TempRuntime.Registers, sizeof(TempRuntime.Registers));
    TempRuntime.SetRegEntity(Reg::Self, Event.SourceEntity);
    TempRuntime.SetRegEntity(Reg::Target, Event.TargetEntity);

    // Interpreter (WorldState 읽기 전용 — VMProxy=nullptr)
    FHktVMInterpreter Interpreter;
    Interpreter.Initialize(const_cast<FHktWorldState*>(&WorldState), nullptr);

    // 실행 (최대 1000 instructions)
    constexpr int32 MaxPreconditionInstructions = 1000;
    int32 InstructionCount = 0;

    while (InstructionCount < MaxPreconditionInstructions)
    {
        if (TempRuntime.PC < 0 || TempRuntime.PC >= TempProgram.CodeSize())
            break;

        const FInstruction& Inst = TempProgram.Code[TempRuntime.PC];
        TempRuntime.PC++;
        InstructionCount++;

        EOpCode Op = Inst.GetOpCode();

        // 쓰기/대기 opcode는 skip (JSON 파서에서 이미 걸러지지만 방어적 처리)
        switch (Op)
        {
        case EOpCode::SaveStore:
        case EOpCode::SaveStoreEntity:
        case EOpCode::SpawnEntity:
        case EOpCode::DestroyEntity:
        case EOpCode::AddTag:
        case EOpCode::RemoveTag:
        case EOpCode::ApplyEffect:
        case EOpCode::RemoveEffect:
        case EOpCode::PlayVFX:
        case EOpCode::PlayVFXAttached:
        case EOpCode::PlayAnim:
        case EOpCode::PlaySound:
        case EOpCode::PlaySoundAtLocation:
        case EOpCode::SetOwnerUid:
        case EOpCode::ClearOwnerUid:
        case EOpCode::FindInRadius:
        case EOpCode::FindInRadiusEx:
        case EOpCode::NextFound:
        case EOpCode::FindByOwner:
        case EOpCode::DispatchEvent:
        case EOpCode::DispatchEventTo:
        case EOpCode::DispatchEventFrom:
        case EOpCode::LookAt:
        case EOpCode::SetForwardTarget:
            continue;  // skip
        case EOpCode::Yield:
        case EOpCode::YieldSeconds:
        case EOpCode::WaitCollision:
        case EOpCode::WaitMoveEnd:
        case EOpCode::WaitGrounded:
        case EOpCode::WaitAnimEnd:
            continue;  // skip
        default:
            break;
        }

        EVMStatus Status = Interpreter.ExecuteInstruction(TempRuntime, Inst);
        if (Status == EVMStatus::Failed)
            return false;
        if (Status == EVMStatus::Completed)
            break;
    }

    return TempRuntime.GetReg(Reg::Flag) != 0;
}
