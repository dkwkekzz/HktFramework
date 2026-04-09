// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "VM/HktVMTypes.h"
#include "HktVMRuntime.h"
#include "HktCoreEventLog.h"
#include "HktCoreProperties.h"

// Forward declarations
struct FHktWorldState;
struct FHktVMWorldStateProxy;
struct FHktTerrainState;
struct FHktVoxelDelta;

/**
 * FHktVMInterpreter - 바이트코드 인터프리터 (Pure C++)
 *
 * 단일 VM을 yield 또는 종료까지 실행합니다.
 * UObject/UWorld 참조 없음 - HktCore의 순수성 유지
 *
 * 근본 연산만 opcode로 제공:
 *  - Entity 생성/파괴
 *  - Entity Property 읽기/쓰기
 *  - Entity Tag 추가/제거
 * 조합 연산(Position, Movement, Damage 등)은 StoryBuilder에서 기본 opcode 조합으로 구현.
 */
class HKTCORE_API FHktVMInterpreter
{
public:
    /** WorldState 및 VMProxy 참조 초기화 */
    void Initialize(FHktWorldState* InWorldState, FHktVMWorldStateProxy* InVMProxy,
                    FHktTerrainState* InTerrainState = nullptr,
                    TArray<FHktVoxelDelta>* InPendingVoxelDeltas = nullptr);

    /** VM을 yield/완료/실패까지 실행 */
    EVMStatus Execute(FHktVMRuntime& Runtime);

    /**
     * Precondition 바이트코드를 읽기 전용으로 실행.
     * 임시 레지스터/Context를 사용하여 WorldState에 쓰기 없음.
     * Flag 레지스터 != 0이면 true 반환, Fail opcode 시 false 반환.
     */
    static bool ExecutePrecondition(
        const TArray<FInstruction>& Code,
        const TArray<int32>& Constants,
        const TArray<FString>& Strings,
        const FHktWorldState& WorldState,
        const FHktEvent& Event);

private:
    EVMStatus ExecuteInstruction(FHktVMRuntime& Runtime, const FInstruction& Inst);

    // ===== Control Flow =====
    void Op_Nop(FHktVMRuntime& Runtime);
    EVMStatus Op_Halt(FHktVMRuntime& Runtime);
    EVMStatus Op_Yield(FHktVMRuntime& Runtime, int32 Frames);
    EVMStatus Op_YieldSeconds(FHktVMRuntime& Runtime, int32 DeciMillis);
    void Op_Jump(FHktVMRuntime& Runtime, int32 Target);
    void Op_JumpIf(FHktVMRuntime& Runtime, RegisterIndex Cond, int32 Target);
    void Op_JumpIfNot(FHktVMRuntime& Runtime, RegisterIndex Cond, int32 Target);

    // ===== Event Wait =====
    EVMStatus Op_WaitCollision(FHktVMRuntime& Runtime, RegisterIndex WatchEntity);
    EVMStatus Op_WaitMoveEnd(FHktVMRuntime& Runtime, RegisterIndex WatchEntity);
    EVMStatus Op_WaitGrounded(FHktVMRuntime& Runtime, RegisterIndex WatchEntity);
    EVMStatus Op_WaitAnimEnd(FHktVMRuntime& Runtime, RegisterIndex WatchEntity);

    // ===== Data Operations =====
    void Op_LoadConst(FHktVMRuntime& Runtime, RegisterIndex Dst, int32 Value);
    void Op_LoadConstHigh(FHktVMRuntime& Runtime, RegisterIndex Dst, int32 HighBits);
    void Op_LoadStore(FHktVMRuntime& Runtime, RegisterIndex Dst, uint16 PropertyId);
    void Op_LoadStoreEntity(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex Entity, uint16 PropertyId);
    void Op_SaveStore(FHktVMRuntime& Runtime, uint16 PropertyId, RegisterIndex Src);
    void Op_SaveStoreEntity(FHktVMRuntime& Runtime, RegisterIndex Entity, uint16 PropertyId, RegisterIndex Src);
    void Op_Move(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex Src);

    // ===== Arithmetic =====
    void Op_Add(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2);
    void Op_Sub(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2);
    void Op_Mul(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2);
    void Op_Div(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2);
    void Op_Mod(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2);
    void Op_AddImm(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex Src, int32 Imm);

    // ===== Comparison =====
    void Op_CmpEq(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2);
    void Op_CmpNe(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2);
    void Op_CmpLt(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2);
    void Op_CmpLe(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2);
    void Op_CmpGt(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2);
    void Op_CmpGe(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2);

    // ===== Entity =====
    void Op_SpawnEntity(FHktVMRuntime& Runtime, int32 TagIndex);
    void Op_DestroyEntity(FHktVMRuntime& Runtime, RegisterIndex Entity);

    // ===== Spatial Query =====
    void Op_GetDistance(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex Entity1, RegisterIndex Entity2);
    void Op_LookAt(FHktVMRuntime& Runtime, RegisterIndex Entity, RegisterIndex TargetEntity);
    void Op_FindInRadius(FHktVMRuntime& Runtime, RegisterIndex CenterEntity, int32 RadiusCm);
    void Op_FindInRadiusEx(FHktVMRuntime& Runtime, RegisterIndex CenterEntity, RegisterIndex FilterMaskReg, RegisterIndex RadiusReg);
    void Op_NextFound(FHktVMRuntime& Runtime);

    // ===== Presentation =====
    void Op_ApplyEffect(FHktVMRuntime& Runtime, RegisterIndex Target, int32 TagIndex);
    void Op_RemoveEffect(FHktVMRuntime& Runtime, RegisterIndex Target, int32 TagIndex);
    void Op_PlayVFX(FHktVMRuntime& Runtime, RegisterIndex PosBase, int32 TagIndex);
    void Op_PlayVFXAttached(FHktVMRuntime& Runtime, RegisterIndex Entity, int32 TagIndex);
    void Op_PlayAnim(FHktVMRuntime& Runtime, RegisterIndex Entity, int32 TagIndex);
    void Op_PlaySound(FHktVMRuntime& Runtime, int32 TagIndex);
    void Op_PlaySoundAtLocation(FHktVMRuntime& Runtime, RegisterIndex PosBase, int32 TagIndex);

    // ===== Tags =====
    void Op_AddTag(FHktVMRuntime& Runtime, RegisterIndex Entity, int32 TagIndex);
    void Op_RemoveTag(FHktVMRuntime& Runtime, RegisterIndex Entity, int32 TagIndex);
    void Op_HasTag(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex Entity, int32 TagIndex);
    void Op_CheckTrait(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex Entity, int32 TraitIndex);

    // ===== NPC Spawning =====
    void Op_CountByTag(FHktVMRuntime& Runtime, RegisterIndex Dst, int32 TagIndex);
    void Op_GetWorldTime(FHktVMRuntime& Runtime, RegisterIndex Dst);
    void Op_RandomInt(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex ModulusReg);
    void Op_HasPlayerInGroup(FHktVMRuntime& Runtime, RegisterIndex Dst);

    // ===== Item System =====
    void Op_CountByOwner(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex OwnerEntity, int32 TagIndex);
    void Op_FindByOwner(FHktVMRuntime& Runtime, RegisterIndex OwnerEntity, int32 TagIndex);
    void Op_SetOwnerUid(FHktVMRuntime& Runtime, RegisterIndex Entity);
    void Op_ClearOwnerUid(FHktVMRuntime& Runtime, RegisterIndex Entity);

    // ===== Event Dispatch =====
    void Op_DispatchEvent(FHktVMRuntime& Runtime, int32 TagNetIndex);
    void Op_DispatchEventTo(FHktVMRuntime& Runtime, RegisterIndex TargetReg, int32 TagNetIndex);
    void Op_DispatchEventFrom(FHktVMRuntime& Runtime, RegisterIndex SourceReg, int32 TagNetIndex);

    // ===== Movement =====
    void Op_SetForwardTarget(FHktVMRuntime& Runtime, RegisterIndex Entity);

    // ===== Terrain =====
    void Op_GetTerrainHeight(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex XReg, RegisterIndex YReg);
    void Op_GetVoxelType(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex PosBase, RegisterIndex ZReg);
    void Op_SetVoxel(FHktVMRuntime& Runtime, RegisterIndex PosBase, RegisterIndex TypeReg);
    void Op_IsTerrainSolid(FHktVMRuntime& Runtime, RegisterIndex Dst, RegisterIndex PosBase, RegisterIndex ZReg);
    void Op_InteractTerrain(FHktVMRuntime& Runtime, RegisterIndex CenterEntity, int32 RadiusCm);

    // ===== Utility =====
    void Op_Log(FHktVMRuntime& Runtime, int32 StringIndex);

    // ===== Helper =====
    const FString& GetString(FHktVMRuntime& Runtime, int32 Index);
    FGameplayTag ResolveTag(int32 TagIndex);

private:
    static constexpr int32 MaxInstructionsPerTick = 10000;

    FHktWorldState* WorldState = nullptr;
    FHktVMWorldStateProxy* VMProxy = nullptr;
    FHktTerrainState* TerrainState = nullptr;
    TArray<FHktVoxelDelta>* PendingVoxelDeltas = nullptr;

public:
    /** 시뮬레이터에서 설정: 로그 소스 (Server/Client) */
    EHktLogSource LogSource = EHktLogSource::Server;
};
