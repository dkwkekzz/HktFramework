// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
#include "HktCoreDefs.h"
#include "HktStoryTypes.h"
#include "HktCoreArchetype.h"

// ============================================================================
// FHktStoryBuilder API 가이드
//
// 본 빌더는 두 종류의 공개 API 를 동시에 노출한다.
//
//   (A) [신] FHktVar 기반 가상 레지스터 API — 권장
//        - NewVar(), NewVarBlock(), Self(), Target() 으로 변수를 얻고
//          이를 인자로 넘긴다. 빌드 타임에 Liveness + Linear-Scan 할당기가
//          GP 레지스터(R0..R9) 를 자동 배정한다.
//        - SpawnEntity / WaitCollision / GetPosition 등은 FHktVar 또는
//          FHktVarBlock 을 *반환*하므로 호출자가 결과를 명시적으로 받는다.
//        - JSON schema 2 (`{"schema": 2, ...}`) 는 본 API 만 사용한다.
//
//   (B) [구] RegisterIndex 기반 API — [[deprecated]]
//        - 모든 RegisterIndex 인자/Reg 별칭을 받는 메서드는 deprecated 로 표시되어
//          호출 측에 컴파일 경고가 발생한다.
//        - 시그니처와 emit 결과는 PR-1과 byte-identical 로 보존된다.
//        - PR-3에서 strangler-fig 방식으로 새 API 기반 JSON 으로 점진 대체된다.
//
// 신·구 API 의 공존은 명시적인 설계 결정이다 (PR-2 단계). 신규 코드는 (A) 만
// 사용해야 하며, 기존 cpp 스토리/스니펫은 PR-3 마이그레이션까지 (B) 를 그대로 사용한다.
// ============================================================================

struct FHktVMProgram;
struct FHktWorldState;
struct FHktEvent;
class FHktStoryBuilder;

/**
 * EHktSpawnPattern — `SpawnEntityAround` 의 분포 정책.
 *
 *  - Circle:        Center 중심 Radius 원주에 균등 배치.
 *  - Line:          Center 에서 일정 간격 직선 배치.
 *  - RandomSeeded:  SlotHash + RandomInt 결정론적 jitter 로 분산 배치.
 *
 * 본 enum 은 *Builder 매개변수* — 신규 opcode 가 아니다 (Docs/Design-VoxelSpawner.md §1-3, §4-b).
 * Builder 가 기존 opcode (SpawnEntity, SetPosition, RandomInt, Add 등) 를 조합해 emit 한다.
 */
enum class EHktSpawnPattern : uint8
{
    Circle,
    Line,
    RandomSeeded,
};

// ============================================================================
// FHktVar / FHktVarBlock — 신 가상 변수 API (PR-2)
// ============================================================================

/** 가상 레지스터 ID — HktVRegIR.h 의 FHktVRegId 와 일치(int32). 공개 헤더에서는 별칭으로 둔다. */
using FHktVRegHandle = int32;

/**
 * FHktVar — 빌더가 발급한 가상 변수 핸들
 *
 * 내부적으로 FHktVRegId 를 보유하며, 빌드 타임 Linear-Scan 할당기가 물리 레지스터를 결정한다.
 * 외부 코드는 값으로 자유롭게 복사할 수 있고, 동일 빌더 내에서 재사용 가능하다.
 * 다른 빌더 인스턴스로 넘기는 것은 정의되지 않은 동작이다.
 */
class HKTCORE_API FHktVar
{
public:
    FHktVar() = default;
    FHktVar(const FHktVar&) = default;
    FHktVar& operator=(const FHktVar&) = default;

    bool IsValid() const { return VRegId >= 0; }
    FHktVRegHandle GetId() const { return VRegId; }

private:
    friend class FHktStoryBuilder;
    friend class FHktVarBlock;
    explicit FHktVar(FHktVRegHandle Id) : VRegId(Id) {}
    FHktVRegHandle VRegId = -1;
};

/**
 * FHktVarBlock — 연속 N개 가상 변수 핸들 (Position 등)
 *
 * Element(i) 로 i번째 슬롯의 FHktVar 를 얻는다. 할당기는 모든 슬롯에 연속 GP 레지스터를 부여한다.
 */
class HKTCORE_API FHktVarBlock
{
public:
    FHktVarBlock() = default;
    FHktVarBlock(const FHktVarBlock&) = default;
    FHktVarBlock& operator=(const FHktVarBlock&) = default;

    int32 Num() const { return Count; }
    bool IsValid() const { return BaseVRegId >= 0 && Count > 0; }

    /** i번째 슬롯의 FHktVar (0-based). NewVarBlock 은 베이스 + 멤버 VReg 를 연속 ID 로 발급한다. */
    FHktVar Element(int32 i) const
    {
        check(i >= 0 && i < Count);
        return FHktVar(BaseVRegId + i);
    }

    /** 베이스(0번) 슬롯 — Position 같은 base 인자에 그대로 사용 가능 */
    FHktVar Base() const { return Element(0); }

private:
    friend class FHktStoryBuilder;
    FHktVarBlock(FHktVRegHandle InBase, int32 InCount) : BaseVRegId(InBase), Count(InCount) {}
    FHktVRegHandle BaseVRegId = -1;
    int32 Count = 0;
};

// ============================================================================
// RAII 레지스터 핸들 — 스코프 종료 시 자동 반환
// ============================================================================

/**
 * FHktScopedReg — 단일 GP 레지스터 RAII 핸들
 *
 * 생성 시 FHktRegAllocator에서 빈 레지스터를 할당받고,
 * 소멸 시 자동 반환한다. RegisterIndex로 암묵 변환 가능.
 *
 * 사용 예:
 *   {
 *       FHktScopedReg scratch(Builder);
 *       Builder.LoadConst(scratch, 100);
 *       Builder.SaveStore(PropertyId::Health, scratch);
 *   } // scratch 자동 반환
 */
/**
 * @deprecated PR-3 에서 FHktVar (NewVar) 기반 새 API 로 대체 예정. 현재는 기존 cpp 스토리 호환을 위해 보존.
 * 내부 emit 결과는 PR-1과 byte-identical 이며, 신·구 API 가 동일 빌더에서 공존할 수 있다.
 */
struct HKTCORE_API FHktScopedReg
{
    FHktScopedReg(FHktStoryBuilder& InBuilder);
    ~FHktScopedReg();

    FHktScopedReg(const FHktScopedReg&) = delete;
    FHktScopedReg& operator=(const FHktScopedReg&) = delete;
    FHktScopedReg(FHktScopedReg&& Other) noexcept;
    FHktScopedReg& operator=(FHktScopedReg&&) = delete;

    operator RegisterIndex() const { return Reg; }

private:
    FHktRegAllocator* Allocator;
    RegisterIndex Reg;
};

/**
 * FHktScopedRegBlock — 연속 GP 레지스터 RAII 핸들
 *
 * Position(X,Y,Z) 등 연속 레지스터가 필요한 경우 사용.
 * RegisterIndex로 변환 시 Base를 반환한다.
 *
 * 사용 예:
 *   {
 *       FHktScopedRegBlock pos(Builder, 3);
 *       Builder.GetPosition(pos, Self);     // pos, pos+1, pos+2
 *       Builder.SetPosition(Spawned, pos);
 *   } // 3개 모두 반환
 */
struct HKTCORE_API FHktScopedRegBlock
{
    FHktScopedRegBlock(FHktStoryBuilder& InBuilder, int32 InCount);
    ~FHktScopedRegBlock();

    FHktScopedRegBlock(const FHktScopedRegBlock&) = delete;
    FHktScopedRegBlock& operator=(const FHktScopedRegBlock&) = delete;
    FHktScopedRegBlock(FHktScopedRegBlock&& Other) noexcept;
    FHktScopedRegBlock& operator=(FHktScopedRegBlock&&) = delete;

    operator RegisterIndex() const { return Base; }

private:
    FHktRegAllocator* Allocator;
    RegisterIndex Base;
    int32 Count;
};

/**
 * FHktEventPrecondition — Story 사전조건 검증 함수
 *
 * 각 Story가 자신의 실행 조건을 C++ 함수로 등록한다.
 * 클라이언트는 Proxy WorldState로 호출하여 요청 가능 여부를 사전 판단하고,
 * 서버는 Story 바이트코드 내부 검증이 권위적 최종 검증으로 작동한다.
 */
using FHktEventPrecondition = TFunction<bool(const FHktWorldState& WorldState, const FHktEvent& Event)>;

// ============================================================================
// Fluent Builder API - 자연어 스타일
// ============================================================================

/**
 * FHktStoryBuilder - 자연어처럼 읽히는 Flow 정의
 *
 * VM은 근본 연산만 opcode로 제공:
 *  - Entity 생성/파괴
 *  - Entity Property 읽기/쓰기 (LoadStore, SaveStore 등)
 *  - Entity Tag 추가/제거
 *
 * 조합 연산(Position, Movement, Damage 등)은 이 Builder에서 기본 opcode를 조합하여 구현.
 *
 * 사용 예:
 *   Story(TEXT("Ability.Skill.Fireball"))
 *       .AddTag(Self, TAG_Anim_UpperBody_Cast_Fireball)
 *       .WaitSeconds(1.0f)
 *       .SpawnEntity(TAG_Entity_Fireball).MoveForward(Spawned, 500)
 *       .WaitCollision()
 *           .DestroyEntity(Spawned)
 *           .ApplyDamageConst(Hit, 100)
 *           .ForEachInRadius(Hit, 300)
 *               .ApplyDamageConst(Iter, 50)
 *           .EndForEach()
 *       .RemoveTag(Self, TAG_Anim_UpperBody_Cast_Fireball)
 *       .End();
 */
/**
 * FCodeSection — Builder 내부 코드 섹션 (Main / Precondition 공용)
 *
 * Emit, AddString, AddConstant, Label, Jump 등이 모두 ActiveSection 포인터를 통해
 * 이 구조체에 쓰기하므로, 새로운 섹션 추가 시 분기 코드가 불필요하다.
 *
 * 정의는 private 헤더(HktVRegIR.h)에 있다 — 가상 레지스터 IR 도입으로
 * 내부 명령어 표현이 FInstruction에서 FHktVInst로 전환되었기 때문이다.
 * 외부 코드는 이 타입을 직접 참조하지 않으며 Builder 내부에서만 다룬다.
 */
struct FCodeSection;

class HKTCORE_API FHktStoryBuilder
{
    friend struct FHktScopedReg;
    friend struct FHktScopedRegBlock;

public:
    /** 레지스터 할당기 접근 — ScopedReg가 내부에서 사용 */
    FHktRegAllocator& GetRegAllocator() { return RegAllocator; }
    const FHktRegAllocator& GetRegAllocator() const { return RegAllocator; }


    static FHktStoryBuilder Create(const FGameplayTag& Tag);
    static FHktStoryBuilder Create(const FName& TagName);

    // ========================================================================
    // 신 FHktVar API (PR-2)
    //
    // 신규 코드는 본 섹션의 메서드만 사용해야 한다. 기존 RegisterIndex API 는
    // [[deprecated]] 로 마킹되어 PR-3 에서 JSON 마이그레이션과 함께 제거된다.
    // ========================================================================

    /** 새 anonymous 가상 변수 — 빌드 타임에 GP 레지스터(R0..R9) 가 자동 배정 */
    FHktVar NewVar(const TCHAR* DebugName = nullptr);

    /** 새 anonymous 가상 블록 — Position(X,Y,Z) 등 연속 N개 슬롯이 필요할 때 사용 */
    FHktVarBlock NewVarBlock(int32 Count, const TCHAR* DebugName = nullptr);

    /** 특수 레지스터 핸들 — 동일 빌더 내에서 항상 같은 VReg 반환 */
    FHktVar Self();
    FHktVar Target();
    FHktVar SpawnedVar();   // 최근 SpawnEntity 결과를 가리키는 특수 슬롯
    FHktVar HitVar();       // 최근 WaitCollision 결과
    FHktVar IterVar();      // ForEach 순회 슬롯
    FHktVar FlagVar();      // 비교/카운트 결과 슬롯

    // ----- Spawner Context -----
    //
    // 별도의 spawner-context Builder 메서드는 도입하지 않는다.
    // 기존 `FHktEvent::Param0~3` + `Location` + `HktEventBuilder::Spawner` 가 모든 spawner
    // 진입 컨텍스트(위치/SlotHash/archetype params)를 인라인 정수 + FVector 로 표현하므로,
    // Story 코드는 `LoadStore(PropertyId::Param0..3)` / 좌표 자동 매핑으로 그대로 읽는다.
    //
    // Docs/Design-VoxelSpawner.md §4-a 갱신: 별도 prefill 메커니즘/EntryArgs 구조체 폐기.
    // `SpawnerParams::` 네임스페이스(HktStoryEventParams.h) 에서 Param0~3 의 의미 별칭만
    // 정의해 archetype 별 계약을 형식화한다.

    /**
     * 같은 이름은 같은 VReg 로 해석 — JSON `{"var":"name"}` 폼이 사용한다.
     * 이름이 처음 등장하면 anonymous VReg 를 생성한다.
     */
    FHktVar ResolveOrCreateNamedVar(const FString& Name);

    /**
     * 같은 이름은 같은 FHktVarBlock 으로 해석 — JSON `{"block":"name"}` 폼이 사용한다.
     * 이름이 처음 등장하면 NewVarBlock(Count) 으로 새 블록을 발급한다.
     * 같은 이름으로 다른 Count 가 요청되면 처음 등록된 블록을 그대로 반환한다 (호출자 책임).
     */
    FHktVarBlock ResolveOrCreateNamedBlock(const FString& Name, int32 Count);

    // ---- 데이터 ----
    FHktStoryBuilder& LoadConst(FHktVar Dst, int32 Value);
    FHktStoryBuilder& LoadStore(FHktVar Dst, uint16 PropertyId);
    FHktStoryBuilder& LoadStoreEntity(FHktVar Dst, FHktVar Entity, uint16 PropertyId);
    FHktStoryBuilder& SaveStore(uint16 PropertyId, FHktVar Src);
    FHktStoryBuilder& SaveStoreEntity(FHktVar Entity, uint16 PropertyId, FHktVar Src);
    // 주의: SaveConst(uint16, int32) 는 레지스터 인자가 없으므로 신·구 API 공통.
    FHktStoryBuilder& SaveConstEntity(FHktVar Entity, uint16 PropertyId, int32 Value);
    /** GameplayTag 를 NetIndex 로 변환해 entity 의 property 에 저장 (SaveConstEntity 의 tag 변형). */
    FHktStoryBuilder& SaveTagEntity(FHktVar Entity, uint16 PropertyId, const FGameplayTag& Tag);
    FHktStoryBuilder& Move(FHktVar Dst, FHktVar Src);

    // ---- 산술 ----
    FHktStoryBuilder& Add(FHktVar Dst, FHktVar Src1, FHktVar Src2);
    FHktStoryBuilder& Sub(FHktVar Dst, FHktVar Src1, FHktVar Src2);
    FHktStoryBuilder& Mul(FHktVar Dst, FHktVar Src1, FHktVar Src2);
    FHktStoryBuilder& Div(FHktVar Dst, FHktVar Src1, FHktVar Src2);
    FHktStoryBuilder& AddImm(FHktVar Dst, FHktVar Src, int32 Imm);

    // ---- 비교 ----
    FHktStoryBuilder& CmpEq(FHktVar Dst, FHktVar Src1, FHktVar Src2);
    FHktStoryBuilder& CmpNe(FHktVar Dst, FHktVar Src1, FHktVar Src2);
    FHktStoryBuilder& CmpLt(FHktVar Dst, FHktVar Src1, FHktVar Src2);
    FHktStoryBuilder& CmpLe(FHktVar Dst, FHktVar Src1, FHktVar Src2);
    FHktStoryBuilder& CmpGt(FHktVar Dst, FHktVar Src1, FHktVar Src2);
    FHktStoryBuilder& CmpGe(FHktVar Dst, FHktVar Src1, FHktVar Src2);

    // ---- 점프/조건 ----
    FHktStoryBuilder& JumpIf(FHktVar Cond, FName LabelName);
    FHktStoryBuilder& JumpIfNot(FHktVar Cond, FName LabelName);
    FHktStoryBuilder& JumpIf(FHktVar Cond, int32 Key);
    FHktStoryBuilder& JumpIfNot(FHktVar Cond, int32 Key);
    FHktStoryBuilder& If(FHktVar Cond);
    FHktStoryBuilder& IfNot(FHktVar Cond);

    // ---- 엔티티 (출력 변수 명시 반환) ----
    /**
     * 엔티티 스폰 — 새 VReg 핸들 반환.
     * 구 API 의 묵시적 Reg::Spawned 의존을 제거하기 위해 명시적 반환을 채택.
     * 이름이 SpawnEntity 와 동일하면 반환형만 다른 오버로드(불가) 가 되므로 별명으로 분리.
     */
    FHktVar SpawnEntityVar(const FGameplayTag& ClassTag);

    /**
     * 지정 위치에 단일 엔티티 spawn.
     *  - 내부적으로 `SpawnEntity(ClassTag)` + `SetPosition(Spawned, Position)` 을 emit.
     *  - 신규 opcode 추가 없음 (Docs/Design-VoxelSpawner.md §1-3, §4-b).
     * @return spawned entity 의 vreg 핸들.
     */
    FHktVar SpawnEntityAt(const FGameplayTag& EntityTag, FHktVarBlock Position);

    /**
     * 중심점 주변에 CountCompile 개 엔티티를 분포 패턴에 맞게 spawn.
     *  - `Pattern`: Circle/Line/RandomSeeded.
     *  - `RadiusRaw`: FHktFixed32 raw 반지름 (cm 단위) 를 담은 vreg.
     *  - 본 헬퍼는 컴파일 타임에 Count 가 결정되는 케이스만 지원 — 동적 count 가 필요하면
     *    호출자가 명시적인 Repeat/Counter 루프를 직접 구성한다.
     *  - 신규 opcode 추가 없음 — SpawnEntity/SetPosition/RandomInt/Add 조합 emit.
     * @return 마지막으로 spawn 된 엔티티 vreg (반복 spawn 의 최종 결과).
     */
    FHktVar SpawnEntityAround(const FGameplayTag& EntityTag,
                              FHktVarBlock Center,
                              FHktVar RadiusRaw,
                              int32 CountCompile,
                              EHktSpawnPattern Pattern);

    FHktStoryBuilder& DestroyEntity(FHktVar Entity);

    // ---- Position & Movement ----
    /** 위치 가져오기 — 새 FHktVarBlock(3) 반환. 호출자가 Element(0..2) 로 X/Y/Z 접근. */
    FHktVarBlock GetPosition(FHktVar Entity);

    FHktStoryBuilder& SetPosition(FHktVar Entity, FHktVarBlock SrcPos);
    FHktStoryBuilder& CopyPosition(FHktVar DstEntity, FHktVar SrcEntity);
    FHktStoryBuilder& MoveToward(FHktVar Entity, FHktVarBlock TargetPos, int32 Force);
    FHktStoryBuilder& MoveForward(FHktVar Entity, int32 Force);
    FHktStoryBuilder& StopMovement(FHktVar Entity);
    FHktStoryBuilder& ApplyJump(FHktVar Entity, int32 ImpulseVelZ);
    FHktStoryBuilder& GetDistance(FHktVar Dst, FHktVar Entity1, FHktVar Entity2);
    FHktStoryBuilder& LookAt(FHktVar Entity, FHktVar TargetEntity);

    // ---- Spatial Query ----
    FHktStoryBuilder& FindInRadius(FHktVar CenterEntity, int32 RadiusCm);
    FHktStoryBuilder& FindInRadiusEx(FHktVar CenterEntity, int32 RadiusCm, uint32 FilterMask);
    FHktStoryBuilder& InteractTerrain(FHktVar CenterEntity, int32 RadiusCm);

    /**
     * 콜백 형태 ForEach — Body 람다는 Iter VReg(FHktVar) 를 인자로 받는다.
     * 호환성을 위해 람다 형태의 본 메서드는 헤더에 인라인으로 둔다 (템플릿).
     */
    template <typename F>
    FHktStoryBuilder& ForEachInRadius(FHktVar CenterEntity, int32 RadiusCm, F&& Body)
    {
        FHktVar IterIn = IterVar();
        ForEachInRadius_Begin(CenterEntity, RadiusCm);
        Body(*this, IterIn);
        ForEachInRadius_End();
        return *this;
    }

    // ---- WaitCollision: Hit VReg 명시 반환 ----
    FHktVar WaitCollision(FHktVar Watch);

    // ---- Combat ----
    FHktStoryBuilder& ApplyDamage(FHktVar TargetEntity, FHktVar Amount);
    FHktStoryBuilder& ApplyDamageConst(FHktVar TargetEntity, int32 Amount);

    // ---- Tags ----
    FHktStoryBuilder& AddTag(FHktVar Entity, const FGameplayTag& Tag);
    FHktStoryBuilder& RemoveTag(FHktVar Entity, const FGameplayTag& Tag);
    FHktStoryBuilder& HasTag(FHktVar Dst, FHktVar Entity, const FGameplayTag& Tag);
    FHktStoryBuilder& CheckTrait(FHktVar Dst, FHktVar Entity, const FHktPropertyTrait* Trait);
    FHktStoryBuilder& IfHasTrait(FHktVar Entity, const FHktPropertyTrait* Trait);

    // ---- Presentation ----
    FHktStoryBuilder& ApplyEffect(FHktVar TargetEntity, const FGameplayTag& EffectTag);
    FHktStoryBuilder& RemoveEffect(FHktVar TargetEntity, const FGameplayTag& EffectTag);
    FHktStoryBuilder& PlayVFX(FHktVarBlock PosBlock, const FGameplayTag& VFXTag);
    FHktStoryBuilder& PlayVFXAttached(FHktVar Entity, const FGameplayTag& VFXTag);
    FHktStoryBuilder& PlayAnim(FHktVar Entity, const FGameplayTag& AnimTag);
    FHktStoryBuilder& PlaySoundAtLocation(FHktVarBlock PosBlock, const FGameplayTag& SoundTag);
    FHktStoryBuilder& PlayVFXAtEntity(FHktVar Entity, const FGameplayTag& VFXTag);
    FHktStoryBuilder& PlaySoundAtEntity(FHktVar Entity, const FGameplayTag& SoundTag);

    // ---- World Query ----
    FHktStoryBuilder& CountByTag(FHktVar Dst, const FGameplayTag& Tag);
    FHktStoryBuilder& GetWorldTime(FHktVar Dst);
    FHktStoryBuilder& RandomInt(FHktVar Dst, FHktVar ModulusVar);
    FHktStoryBuilder& HasPlayerInGroup(FHktVar Dst);

    // ---- Item ----
    FHktStoryBuilder& CountByOwner(FHktVar Dst, FHktVar OwnerEntity, const FGameplayTag& Tag);
    FHktStoryBuilder& FindByOwner(FHktVar OwnerEntity, const FGameplayTag& Tag);
    FHktStoryBuilder& SetOwnerUid(FHktVar Entity);
    FHktStoryBuilder& ClearOwnerUid(FHktVar Entity);

    // ---- Stance / Item skill ----
    FHktStoryBuilder& SetStance(FHktVar Entity, const FGameplayTag& StanceTag);
    FHktStoryBuilder& SetItemSkillTag(FHktVar Entity, const FGameplayTag& SkillTag);

    // ---- Event Dispatch ----
    FHktStoryBuilder& DispatchEventTo(const FGameplayTag& EventTag, FHktVar TargetEntity);
    FHktStoryBuilder& DispatchEventFrom(const FGameplayTag& EventTag, FHktVar SourceEntity);
    /** EventTag NetIndex 가 들어있는 vreg 로부터 동적 디스패치 (entity-self-declares-action). */
    FHktStoryBuilder& DispatchEventByReg(FHktVar TagNetIndexVar);

    // ---- Region (PR-2) ----
    /**
     * Region scalar 카운터에 Delta 를 누적한다.
     *   emit: LoadStoreEntity + AddImm(또는 LoadConst+Add) + SaveStoreEntity (신규 opcode 0).
     * Docs/Concepts/C01_TranquilWilds/04-region-state.md §3-D6 의 group A 헬퍼.
     * RegionEntity 는 spawner story 진입 시 FindOrCreateRegionEntity 로 얻은 row.
     */
    FHktStoryBuilder& RegionAddScalar(FHktVar RegionEntity, uint16 PropId, int32 Delta);

    /**
     * Region 안의 *키별 record entity* 를 해소해 vreg 로 반환한다 (없으면 lazy create).
     * 04 §3-D4 entity-per-record 모델.
     *   emit: RegionMapFindOrCreate(Dst, RegionEntity, KeyVar, Imm12=RecordTag NetIndex).
     *
     * @param RegionEntity  소속 region (FindOrCreateRegionEntity 결과) vreg
     * @param RecordTag     record 유형 — Entity.RegionRecord.{Lineage|Variant|OreSpecies}
     * @param KeyVar        record 키 (LineageId/VariantId/OreSpeciesId 등 32bit) vreg
     * @return 해소된 record entity 의 vreg
     */
    FHktVar RegionMapFindOrCreate(FHktVar RegionEntity, const FGameplayTag& RecordTag, FHktVar KeyVar);

    /**
     * Region map record 의 한 컬럼을 읽는다.
     *   emit: RegionMapFindOrCreate + LoadStoreEntity (신규 opcode 0, 기존 opcode 재사용).
     */
    FHktStoryBuilder& RegionMapRead(FHktVar Dst, FHktVar RegionEntity, const FGameplayTag& RecordTag, FHktVar KeyVar, uint16 PropId);

    /**
     * Region map record 의 한 컬럼을 쓴다 (없으면 record lazy create 후 write).
     *   emit: RegionMapFindOrCreate + SaveStoreEntity.
     */
    FHktStoryBuilder& RegionMapWrite(FHktVar RegionEntity, const FGameplayTag& RecordTag, FHktVar KeyVar, uint16 PropId, FHktVar ValueVar);

    /**
     * 위치(cm) → RegionEntity 해소 (PR-5).
     *   emit: FindOrCreateRegionEntityAt(Dst, PosX, PosY) — 1 host-call opcode.
     * spawner story 가 Param0/Param1 의 spawn 좌표로 region-scoped helper 진입점을 얻는다.
     * 결정론: VoxelSizeCm/ChunkSize 는 TerrainState 에서 조회되며 정수 floor-div 만 사용.
     * @param PosXVar  위치 X (cm) vreg
     * @param PosYVar  위치 Y (cm) vreg
     * @return 해소된 RegionEntity 의 vreg
     */
    FHktVar FindOrCreateRegionAt(FHktVar PosXVar, FHktVar PosYVar);

    // ---- Terrain ----
    FHktStoryBuilder& GetTerrainHeight(FHktVar Dst, FHktVar VoxelX, FHktVar VoxelY);
    FHktStoryBuilder& GetVoxelType(FHktVar Dst, FHktVarBlock PosXY, FHktVar ZVar);

    /**
     * Event.Location(cm) 의 voxel TypeID 를 Dst 에 적재.
     *
     * Selection 시스템에서 RMB 로 voxel 을 클릭하면 Event.Location 이 voxel 중앙(cm) 으로
     * 채워진다 (TargetEntity 는 InvalidEntityId). 이 op 가 VoxelSizeCm 로 floor-div 하여
     * 결정론적으로 voxel 좌표를 구하고 TerrainState.GetVoxelType 으로 TypeID 를 반환한다.
     * TypeID == 0 = 빈 공간 또는 미로드 청크.
     */
    FHktStoryBuilder& GetVoxelTypeAtEventLocation(FHktVar Dst);
    FHktStoryBuilder& SetVoxel(FHktVarBlock Pos, FHktVar TypeVar);
    FHktStoryBuilder& IsTerrainSolid(FHktVar Dst, FHktVarBlock PosXY, FHktVar ZVar);
    FHktVarBlock     EntityPosToVoxel(FHktVar Entity, int32 VoxelSizeCm);
    FHktStoryBuilder& DestroyVoxelAt(FHktVarBlock Pos);

    // ---- Wait variants ----
    FHktStoryBuilder& WaitAnimEnd(FHktVar Entity);
    FHktStoryBuilder& WaitMoveEnd(FHktVar Entity);
    FHktStoryBuilder& WaitGrounded(FHktVar Entity);
    FHktStoryBuilder& WaitTag(FHktVar Entity, const FGameplayTag& Tag);

    // ========================================================================
    // 구 RegisterIndex API (deprecated — 시그니처/구현 보존)
    //
    // 이하 메서드는 PR-3 에서 새 FHktVar 기반 JSON 으로 strangler-fig 마이그레이션 예정.
    // ========================================================================

    // ActiveSection이 자기 멤버(MainSection/PreconditionSection)를 가리키므로
    // implicit copy/move는 댕글링 포인터를 만든다. 복사 금지, move는 재조정.
    // FCodeSection이 forward-declared이므로 dtor도 out-of-line로 둔다.
    FHktStoryBuilder(const FHktStoryBuilder&) = delete;
    FHktStoryBuilder& operator=(const FHktStoryBuilder&) = delete;
    FHktStoryBuilder(FHktStoryBuilder&& Other) noexcept;
    FHktStoryBuilder& operator=(FHktStoryBuilder&&) = delete;
    ~FHktStoryBuilder();

    // ========== Archetype 검증 ==========

    /** Self 엔티티의 Archetype 설정 — 프로퍼티 접근 빌드타임 검증 활성화 */
    FHktStoryBuilder& SetArchetype(EHktArchetype Arch);

    // ========== Story Policy ==========

    /** 같은 엔티티에 동일 이벤트가 중복 발생 시 기존 VM을 취소 (예: MoveTo) */
    FHktStoryBuilder& CancelOnDuplicate();

    /** Story 사전조건 등록 — 클라이언트/서버 양측에서 호출 가능한 검증 함수 */
    FHktStoryBuilder& SetPrecondition(FHktEventPrecondition InPrecondition);

    /**
     * Precondition 바이트코드 모드 — Begin/End 사이의 모든 Emit은 PreconditionCode로 전달.
     * 기존 step ops와 동일한 fluent API를 사용하되, 읽기 전용 ops만 허용.
     * 실행 후 Flag 레지스터 != 0이면 precondition pass.
     */
    FHktStoryBuilder& BeginPrecondition();
    FHktStoryBuilder& EndPrecondition();

    // ========== Control Flow ==========

    /** 라벨 정의 (점프 대상) — FName으로 저장, 힙할당 없음 */
    FHktStoryBuilder& Label(FName Name);

    /** 무조건 점프 */
    FHktStoryBuilder& Jump(FName LabelName);

    /** 조건부 점프 */
    FHktStoryBuilder& JumpIf(RegisterIndex Cond, FName LabelName);
    FHktStoryBuilder& JumpIfNot(RegisterIndex Cond, FName LabelName);

    // ========== 정수 키 라벨 (동적 라벨용 — FName 파싱 이슈 없음) ==========

    /** 고유 정수 라벨 키 할당 — Snippet에서 동적 라벨 충돌 방지에 사용 */
    int32 AllocLabel();

    /** 문자열 라벨 이름 → int32 키 변환 — 동일 이름은 동일 키 반환 (JSON 파서용) */
    int32 ResolveLabel(const FString& Name);

    /** 정수 키 라벨 정의 */
    FHktStoryBuilder& Label(int32 Key);

    /** 정수 키 무조건 점프 */
    FHktStoryBuilder& Jump(int32 Key);

    /** 정수 키 조건부 점프 */
    FHktStoryBuilder& JumpIf(RegisterIndex Cond, int32 Key);
    FHktStoryBuilder& JumpIfNot(RegisterIndex Cond, int32 Key);

    /** 다음 프레임까지 대기 */
    FHktStoryBuilder& Yield(int32 Frames = 1);

    /** N초 대기 */
    FHktStoryBuilder& WaitSeconds(float Seconds);

    /** 프로그램 종료 */
    FHktStoryBuilder& Halt();

    /** 검증 실패로 프로그램 종료 — EVMStatus::Failed 반환, 에러 로그 출력 */
    FHktStoryBuilder& Fail();

    // ========== Event Wait ==========

    /** 충돌 대기 - 충돌 시 Hit 레지스터에 대상 저장 */
    FHktStoryBuilder& WaitCollision(RegisterIndex WatchEntity = Reg::Spawned);

    /** 애니메이션 종료 대기 — 결정론적 고정 시간(1초) 대기. 이후 태그 제거로 정리. */
    FHktStoryBuilder& WaitAnimEnd(RegisterIndex Entity = Reg::Self);

    /** 이동 완료 대기 */
    FHktStoryBuilder& WaitMoveEnd(RegisterIndex Entity = Reg::Self);

    /** 착지 대기: 점프 후 엔티티가 지면에 착지할 때까지 대기 */
    FHktStoryBuilder& WaitGrounded(RegisterIndex Entity = Reg::Self);

    /** 태그 부여 대기: WatchEntity 에 Tag(또는 자식 태그) 가 부여될 때까지 yield. */
    FHktStoryBuilder& WaitTag(RegisterIndex WatchEntity, const FGameplayTag& Tag);

    // ========== Structured Control Flow ==========

    /** 조건이 참이면 블록 진입, EndIf()까지 실행 */
    FHktStoryBuilder& If(RegisterIndex Cond);

    /** 조건이 거짓이면 블록 진입, EndIf()까지 실행 */
    FHktStoryBuilder& IfNot(RegisterIndex Cond);

    /** If 블록의 거짓 분기 시작 */
    FHktStoryBuilder& Else();

    /** If/Else 블록 종료 */
    FHktStoryBuilder& EndIf();

    // ========== Register Comparison + If ==========

    /** 두 레지스터 비교 후 If 블록 진입 */
    FHktStoryBuilder& IfEq(RegisterIndex A, RegisterIndex B);
    FHktStoryBuilder& IfNe(RegisterIndex A, RegisterIndex B);
    FHktStoryBuilder& IfLt(RegisterIndex A, RegisterIndex B);
    FHktStoryBuilder& IfLe(RegisterIndex A, RegisterIndex B);
    FHktStoryBuilder& IfGt(RegisterIndex A, RegisterIndex B);
    FHktStoryBuilder& IfGe(RegisterIndex A, RegisterIndex B);

    // ========== Register vs Constant + If ==========

    /** 레지스터와 상수 비교 후 If 블록 진입 (임시 레지스터 자동 할당) */
    FHktStoryBuilder& IfEqConst(RegisterIndex Src, int32 Value);
    FHktStoryBuilder& IfNeConst(RegisterIndex Src, int32 Value);
    FHktStoryBuilder& IfLtConst(RegisterIndex Src, int32 Value);
    FHktStoryBuilder& IfLeConst(RegisterIndex Src, int32 Value);
    FHktStoryBuilder& IfGtConst(RegisterIndex Src, int32 Value);
    FHktStoryBuilder& IfGeConst(RegisterIndex Src, int32 Value);

    // ========== Entity Property vs Constant + If ==========

    /** Entity 프로퍼티를 상수와 비교 후 If 블록 진입 (레지스터 자동 할당) */
    FHktStoryBuilder& IfPropertyEq(RegisterIndex Entity, uint16 PropertyId, int32 Value);
    FHktStoryBuilder& IfPropertyNe(RegisterIndex Entity, uint16 PropertyId, int32 Value);
    FHktStoryBuilder& IfPropertyLt(RegisterIndex Entity, uint16 PropertyId, int32 Value);
    FHktStoryBuilder& IfPropertyLe(RegisterIndex Entity, uint16 PropertyId, int32 Value);
    FHktStoryBuilder& IfPropertyGt(RegisterIndex Entity, uint16 PropertyId, int32 Value);
    FHktStoryBuilder& IfPropertyGe(RegisterIndex Entity, uint16 PropertyId, int32 Value);

    // ========== Repeat Loop ==========

    /** N회 반복 루프 시작 — EndRepeat()에서 자동으로 카운터 증가 및 점프 */
    FHktStoryBuilder& Repeat(int32 Count);

    /** Repeat 루프 종료 */
    FHktStoryBuilder& EndRepeat();

    // ========== Wait Patterns ==========

    /** 특정 태그 엔티티가 0이 될 때까지 폴링 대기 (예: 전멸 대기) */
    FHktStoryBuilder& WaitUntilCountZero(const FGameplayTag& Tag, float PollIntervalSeconds = 2.0f);

    // ========== Property Access (고수준 별칭) ==========

    /** Self/Context 프로퍼티 읽기 → Dst (연산 피연산자용) */
    FHktStoryBuilder& ReadProperty(RegisterIndex Dst, uint16 PropertyId)
    { return LoadStore(Dst, PropertyId); }

    /** Src → Self 프로퍼티 쓰기 */
    FHktStoryBuilder& WriteProperty(uint16 PropertyId, RegisterIndex Src)
    { return SaveStore(PropertyId, Src); }

    /** 상수 → Self 프로퍼티 쓰기 */
    FHktStoryBuilder& WriteConst(uint16 PropertyId, int32 Value)
    { return SaveConst(PropertyId, Value); }

    // ========== Data Operations (opcode 래퍼 — Snippet/내부용) ==========

    FHktStoryBuilder& LoadConst(RegisterIndex Dst, int32 Value);

    /** SourceEntity 프로퍼티 읽기 → Dst */
    FHktStoryBuilder& LoadStore(RegisterIndex Dst, uint16 PropertyId);

    /** 임의 Entity 프로퍼티 읽기 → Dst */
    FHktStoryBuilder& LoadStoreEntity(RegisterIndex Dst, RegisterIndex Entity, uint16 PropertyId);

    /** Src → SourceEntity 프로퍼티 쓰기 */
    FHktStoryBuilder& SaveStore(uint16 PropertyId, RegisterIndex Src);

    /** Src → 임의 Entity 프로퍼티 쓰기 */
    FHktStoryBuilder& SaveStoreEntity(RegisterIndex Entity, uint16 PropertyId, RegisterIndex Src);

    /** LoadStoreEntity 별칭 */
    FHktStoryBuilder& LoadEntityProperty(RegisterIndex Dst, RegisterIndex Entity, uint16 PropertyId)
    { return LoadStoreEntity(Dst, Entity, PropertyId); }

    /** SaveStoreEntity 별칭 */
    FHktStoryBuilder& SaveEntityProperty(RegisterIndex Entity, uint16 PropertyId, RegisterIndex Src)
    { return SaveStoreEntity(Entity, PropertyId, Src); }

    /** 상수 값을 SourceEntity 프로퍼티에 직접 저장 (LoadConst + SaveStore 조합) */
    FHktStoryBuilder& SaveConst(uint16 PropertyId, int32 Value);

    /** 상수 값을 임의 엔티티 프로퍼티에 직접 저장 (LoadConst + SaveStoreEntity 조합) */
    FHktStoryBuilder& SaveConstEntity(RegisterIndex Entity, uint16 PropertyId, int32 Value);

    FHktStoryBuilder& Move(RegisterIndex Dst, RegisterIndex Src);

    // ========== Arithmetic ==========

    FHktStoryBuilder& Add(RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2);
    FHktStoryBuilder& Sub(RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2);
    FHktStoryBuilder& Mul(RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2);
    FHktStoryBuilder& Div(RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2);
    FHktStoryBuilder& AddImm(RegisterIndex Dst, RegisterIndex Src, int32 Imm);

    // ========== Comparison (Snippet/내부용) ==========

    FHktStoryBuilder& CmpEq(RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2);
    FHktStoryBuilder& CmpNe(RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2);
    FHktStoryBuilder& CmpLt(RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2);
    FHktStoryBuilder& CmpLe(RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2);
    FHktStoryBuilder& CmpGt(RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2);
    FHktStoryBuilder& CmpGe(RegisterIndex Dst, RegisterIndex Src1, RegisterIndex Src2);

    /** 레지스터와 상수 비교 — 임시 레지스터 자동 할당 (Snippet/내부용) */
    FHktStoryBuilder& CmpEqConst(RegisterIndex Dst, RegisterIndex Src, int32 Value);
    FHktStoryBuilder& CmpNeConst(RegisterIndex Dst, RegisterIndex Src, int32 Value);
    FHktStoryBuilder& CmpLtConst(RegisterIndex Dst, RegisterIndex Src, int32 Value);
    FHktStoryBuilder& CmpLeConst(RegisterIndex Dst, RegisterIndex Src, int32 Value);
    FHktStoryBuilder& CmpGtConst(RegisterIndex Dst, RegisterIndex Src, int32 Value);
    FHktStoryBuilder& CmpGeConst(RegisterIndex Dst, RegisterIndex Src, int32 Value);

    // ========== Entity Management ==========

    /** 엔티티 스폰 → Spawned 레지스터에 저장. ClassTag는 영구 태그로 부여됨. */
    FHktStoryBuilder& SpawnEntity(const FGameplayTag& ClassTag);

    /** 엔티티 제거 */
    FHktStoryBuilder& DestroyEntity(RegisterIndex Entity);

    // ========== Position & Movement (조합 연산) ==========

    /** 위치 가져오기: (Dst, Dst+1, Dst+2) = Position */
    FHktStoryBuilder& GetPosition(RegisterIndex DstBase, RegisterIndex Entity);

    /** 위치 설정: Position = (SrcBase, SrcBase+1, SrcBase+2) */
    FHktStoryBuilder& SetPosition(RegisterIndex Entity, RegisterIndex SrcBase);

    /** 엔티티 간 위치 복사: DstEntity.Position = SrcEntity.Position (내부 임시 레지스터 자동 관리) */
    FHktStoryBuilder& CopyPosition(RegisterIndex DstEntity, RegisterIndex SrcEntity);

    /** Self의 연속 3개 프로퍼티를 목표 위치로 읽어 이동 시작 (내부 임시 레지스터 자동 관리) */
    FHktStoryBuilder& MoveTowardProperty(RegisterIndex Entity, uint16 BasePropId, int32 Force);

    /** 엔티티 위치에서 VFX 재생 (내부 임시 레지스터 자동 관리) */
    FHktStoryBuilder& PlayVFXAtEntity(RegisterIndex Entity, const FGameplayTag& VFXTag);

    /** 엔티티 위치에서 사운드 재생 (내부 임시 레지스터 자동 관리) */
    FHktStoryBuilder& PlaySoundAtEntity(RegisterIndex Entity, const FGameplayTag& SoundTag);

    /** 목표 위치로 이동 시작 (Force 단위, F=ma) */
    FHktStoryBuilder& MoveToward(RegisterIndex Entity, RegisterIndex TargetPosBase, int32 Force);

    /** 전방으로 이동 (투사체용, Force 단위) */
    FHktStoryBuilder& MoveForward(RegisterIndex Entity, int32 Force);

    /** 이동 중지 */
    FHktStoryBuilder& StopMovement(RegisterIndex Entity);

    /** 점프 적용: IsGrounded=0, VelZ=ImpulseVelZ 설정 (GravitySystem 이 다음 프레임부터 낙하 감속) */
    FHktStoryBuilder& ApplyJump(RegisterIndex Entity, int32 ImpulseVelZ);

    /** 거리 계산 (VM opcode — sqrt 필요) */
    FHktStoryBuilder& GetDistance(RegisterIndex Dst, RegisterIndex Entity1, RegisterIndex Entity2);

    /** Entity1이 Entity2를 바라보도록 RotYaw 설정 */
    FHktStoryBuilder& LookAt(RegisterIndex Entity, RegisterIndex TargetEntity);

    // ========== Spatial Query ==========

    /** 범위 내 엔티티 검색 (엔티티의 CollisionMask 기반 필터링) */
    FHktStoryBuilder& FindInRadius(RegisterIndex CenterEntity, int32 RadiusCm);

    /** 범위 내 엔티티 검색 (명시적 레이어 마스크 필터) */
    FHktStoryBuilder& FindInRadiusEx(RegisterIndex CenterEntity, int32 RadiusCm, uint32 FilterMask);

    /** 다음 검색 결과 → Iter, 끝이면 Flag=0 */
    FHktStoryBuilder& NextFound();

    /** ForEach 편의 메서드 (FindInRadius + 루프) */
    FHktStoryBuilder& ForEachInRadius(RegisterIndex CenterEntity, int32 RadiusCm);
    FHktStoryBuilder& ForEachInRadiusEx(RegisterIndex CenterEntity, int32 RadiusCm, uint32 FilterMask);

    /** 반경 내 terrain voxel 상호작용 — 셀 예측 + Precondition 검증 + Event 발행 (ForEach 아님, 단발 호출) */
    FHktStoryBuilder& InteractTerrain(RegisterIndex CenterEntity, int32 RadiusCm);

    FHktStoryBuilder& EndForEach();

    // ========== Combat (조합 연산) ==========

    /** 데미지 적용 */
    FHktStoryBuilder& ApplyDamage(RegisterIndex Target, RegisterIndex Amount);
    FHktStoryBuilder& ApplyDamageConst(RegisterIndex Target, int32 Amount);

    // ========== Tags ==========

    /** 엔티티에 태그 추가 */
    FHktStoryBuilder& AddTag(RegisterIndex Entity, const FGameplayTag& Tag);

    /** 엔티티에서 태그 제거 */
    FHktStoryBuilder& RemoveTag(RegisterIndex Entity, const FGameplayTag& Tag);

    /** 엔티티가 태그를 가지고 있는지 확인 → Dst (1/0) */
    FHktStoryBuilder& HasTag(RegisterIndex Dst, RegisterIndex Entity, const FGameplayTag& Tag);

    /** 엔티티의 Archetype이 Trait을 포함하면 Dst=1, 아니면 0 */
    FHktStoryBuilder& CheckTrait(RegisterIndex Dst, RegisterIndex Entity, const FHktPropertyTrait* Trait);

    /** 엔티티의 Archetype이 Trait을 포함하면 블록 진입 (IfHasTrait ~ EndIf) */
    FHktStoryBuilder& IfHasTrait(RegisterIndex Entity, const FHktPropertyTrait* Trait);

    /** Story 전제조건: Self가 Trait을 가져야 실행 — C++ precondition 자동 등록 */
    FHktStoryBuilder& RequiresTrait(const FHktPropertyTrait* Trait);

    // ========== Presentation ==========

    /** 이펙트 적용 (버프/디버프) */
    FHktStoryBuilder& ApplyEffect(RegisterIndex Target, const FGameplayTag& EffectTag);

    /** 이펙트 제거 */
    FHktStoryBuilder& RemoveEffect(RegisterIndex Target, const FGameplayTag& EffectTag);

    /** VFX 재생 (위치) */
    FHktStoryBuilder& PlayVFX(RegisterIndex PosBase, const FGameplayTag& VFXTag);

    /** VFX 재생 (엔티티에 부착) */
    FHktStoryBuilder& PlayVFXAttached(RegisterIndex Entity, const FGameplayTag& VFXTag);

    /** 일회성 애니메이션 재생 (몽타주 fire-and-forget, 태그 상태 비의존) */
    FHktStoryBuilder& PlayAnim(RegisterIndex Entity, const FGameplayTag& AnimTag);

    FHktStoryBuilder& PlaySound(const FGameplayTag& SoundTag);
    FHktStoryBuilder& PlaySoundAtLocation(RegisterIndex PosBase, const FGameplayTag& SoundTag);

    // ========== NPC Spawning ==========

    /** 특정 태그를 가진 엔티티 수 카운트 → Dst */
    FHktStoryBuilder& CountByTag(RegisterIndex Dst, const FGameplayTag& Tag);

    /** 현재 프레임 번호 → Dst */
    FHktStoryBuilder& GetWorldTime(RegisterIndex Dst);

    /** 결정론적 랜덤 [0, ModulusReg) → Dst */
    FHktStoryBuilder& RandomInt(RegisterIndex Dst, RegisterIndex ModulusReg);

    /** 현재 relevancy group에 플레이어 존재 여부 → Dst (1/0) */
    FHktStoryBuilder& HasPlayerInGroup(RegisterIndex Dst);

    // ========== Item System ==========

    /** 특정 엔티티가 소유한 Tag 매칭 엔티티 수 카운트 → Dst */
    FHktStoryBuilder& CountByOwner(RegisterIndex Dst, RegisterIndex OwnerEntity, const FGameplayTag& Tag);

    /** 특정 엔티티가 소유한 Tag 매칭 엔티티 검색 → NextFound()로 순회 */
    FHktStoryBuilder& FindByOwner(RegisterIndex OwnerEntity, const FGameplayTag& Tag);

    /** 현재 Runtime.PlayerUid를 엔티티의 OwnerUid로 설정 */
    FHktStoryBuilder& SetOwnerUid(RegisterIndex Entity);

    /** 엔티티의 OwnerUid를 0으로 초기화 (무주물 전환) */
    FHktStoryBuilder& ClearOwnerUid(RegisterIndex Entity);

    // ========== Stance ==========

    /** Stance 태그 설정 */
    FHktStoryBuilder& SetStance(RegisterIndex Entity, const FGameplayTag& StanceTag);

    // ========== Item Skill ==========

    /** 아이템의 스킬 태그 설정 (GameplayTag → NetIndex로 저장) */
    FHktStoryBuilder& SetItemSkillTag(RegisterIndex Entity, const FGameplayTag& SkillTag);

    // ========== Event Dispatch ==========

    /** 현재 이벤트의 Source/Target/Location을 유지하면서 다른 Story를 디스패치 */
    FHktStoryBuilder& DispatchEvent(const FGameplayTag& EventTag);
    /** DispatchEvent 변형 — TargetEntity를 지정 레지스터의 엔티티로 오버라이드 */
    FHktStoryBuilder& DispatchEventTo(const FGameplayTag& EventTag, RegisterIndex TargetEntity);
    /** DispatchEvent 변형 — SourceEntity를 지정 레지스터의 엔티티로 오버라이드 (디스패치된 Story의 Self가 됨) */
    FHktStoryBuilder& DispatchEventFrom(const FGameplayTag& EventTag, RegisterIndex SourceEntity);
    /** DispatchEvent 변형 — EventTag NetIndex 를 지정 레지스터에서 읽어 동적 디스패치 */
    FHktStoryBuilder& DispatchEventByReg(RegisterIndex TagNetIndexReg);

    // ========== Terrain ==========

    /** 복셀 좌표(X,Y)의 표면 높이 → Dst (복셀 단위) */
    FHktStoryBuilder& GetTerrainHeight(RegisterIndex Dst, RegisterIndex VoxelX, RegisterIndex VoxelY);

    /** 복셀 좌표(PosBase, PosBase+1)의 Z=ZReg 위치 복셀 타입 → Dst */
    FHktStoryBuilder& GetVoxelType(RegisterIndex Dst, RegisterIndex PosBase, RegisterIndex ZReg);

    /** Event.Location(cm) 의 voxel TypeID → Dst (자세한 설명은 FHktVar 변형 참고) */
    FHktStoryBuilder& GetVoxelTypeAtEventLocation(RegisterIndex Dst);

    /** 복셀 좌표(PosBase, PosBase+1, PosBase+2) 위치에 TypeReg의 복셀 설정 (지형 변형) */
    FHktStoryBuilder& SetVoxel(RegisterIndex PosBase, RegisterIndex TypeReg);

    /** 복셀 좌표(PosBase, PosBase+1)의 Z=ZReg 위치가 고체인지 → Dst (1/0) */
    FHktStoryBuilder& IsTerrainSolid(RegisterIndex Dst, RegisterIndex PosBase, RegisterIndex ZReg);

    /**
     * 엔티티 cm 위치 → 복셀 좌표로 변환 (조합 연산)
     * OutVoxelBase, OutVoxelBase+1, OutVoxelBase+2 에 복셀 XYZ 저장
     */
    /** @param VoxelSizeCm  바이트코드에 베이크될 복셀 크기 (cm). UHktRuntimeGlobalSetting에서 조회해 전달할 것. */
    FHktStoryBuilder& EntityPosToVoxel(RegisterIndex OutVoxelBase, RegisterIndex Entity, int32 VoxelSizeCm);

    /** 복셀 좌표(PosBase, PosBase+1, PosBase+2)에 빈 공간(TypeID=0) 설정 (파괴) */
    FHktStoryBuilder& DestroyVoxelAt(RegisterIndex PosBase);

    // ========== Utility ==========

    FHktStoryBuilder& Log(const FString& Message);

    // ========== Internal Label (Snippet용 고유 라벨 생성) ==========

    /** @deprecated AllocLabel() + Label(int32) 사용 권장 */
    FString MakeInternalLabel(const TCHAR* Prefix);

    // ========== Flow Mode ==========

    /** Flow 모드 설정 — Self/Target 엔티티가 없는 Story (Spawner 등).
     *  Validator에서 Self/Target을 항상 유효하다고 가정하지 않게 한다. */
    FHktStoryBuilder& SetFlowMode() { bFlowMode = true; return *this; }

    // ========== Build ==========

    /** 빌드 — 검증 실패 시 nullptr 반환, 실패한 Story는 등록되지 않음 */
    TSharedPtr<FHktVMProgram> Build();

    /** 빌드 + 레지스트리 등록 — 검증 실패 시 등록하지 않음 */
    void BuildAndRegister();

public:
    // ForEach 템플릿이 호출하는 진입/종료 헬퍼 (FHktVar 기반).
    // 사용자가 직접 호출할 일은 거의 없지만, 템플릿이 헤더에 인라인되므로 public.
    FHktStoryBuilder& ForEachInRadius_Begin(FHktVar CenterEntity, int32 RadiusCm);
    FHktStoryBuilder& ForEachInRadius_End();

private:
    explicit FHktStoryBuilder(const FGameplayTag& Tag);

    void Emit(FInstruction Inst);

    /**
     * VReg 기반 인스트럭션 emit — 신 FHktVar API 의 공통 백엔드.
     * Field(0..15) 는 비워두고 VReg ID만 기록 → 단계 2 할당기가 채운다.
     */
    void EmitV(EOpCode Op, FHktVar Dst, FHktVar Src1, FHktVar Src2, uint16 Imm12);
    void EmitV_Imm20(EOpCode Op, FHktVar Dst, int32 Imm20);
    /** Imm20 인코딩 + Dst 미사용 (DispatchEvent, PlaySound 등) */
    void EmitV_Imm20NoDst(EOpCode Op, int32 Imm20);

    /** FHktVar → 내부 VReg ID 변환 (-1 이면 InvalidVReg). 멤버 헬퍼 */
    static FHktVRegHandle ToVRegId(FHktVar V) { return V.GetId(); }

    int32 AddString(const FString& Str);
    int32 AddConstant(int32 Value);
    int32 TagToInt(const FGameplayTag& Tag);

    /**
     * VInst 단위 라벨/픽스업을 해소하면서 FInstruction 배열로 emit한다.
     * 단계 2: 라벨 픽스업 후 Linear-Scan 할당기가 anonymous VReg 에 물리 레지스터를 배정한다.
     * 입력에 anonymous 가 없으면 할당기는 즉시 반환하여 PR-1과 byte-identical 출력을 보장.
     */
    static bool FinalizeAndEmitBytecode(FCodeSection& Section, const FGameplayTag& Tag,
        TArray<FInstruction>& OutCode, TArray<FString>& OutErrors);

    // 비교 + If 헬퍼 (18개 public 메서드의 공통 구현)
    FHktStoryBuilder& IfCmp(EOpCode CmpOp, RegisterIndex A, RegisterIndex B);
    FHktStoryBuilder& IfCmpConst(EOpCode CmpOp, RegisterIndex Src, int32 Value);
    FHktStoryBuilder& IfPropertyCmp(EOpCode CmpOp, RegisterIndex Entity, uint16 PropertyId, int32 Value);
    FHktStoryBuilder& CmpConst(EOpCode CmpOp, RegisterIndex Dst, RegisterIndex Src, int32 Value);

private:
    TSharedRef<FHktVMProgram> Program;
    FHktRegAllocator RegAllocator;

    // FCodeSection은 private 헤더에 정의된다 (FHktVInst 의존). Pimpl 패턴.
    TUniquePtr<FCodeSection> MainSection;
    TUniquePtr<FCodeSection> PreconditionSection;
    FCodeSection* ActiveSection = nullptr;

    /**
     * 자동 생성 라벨 키 인코딩 (FString 없이 정수만 사용):
     *   Key = (Type << 16) | (Counter << 1) | Variant
     *   Type: 0=If, 1=Repeat, 2=ForEach, 3=Internal
     *   Variant: 0=false/loop, 1=end
     */
    enum ELabelType : int32 { LT_If = 0, LT_Repeat = 1, LT_ForEach = 2, LT_Internal = 3 };
    static int32 MakeLabelKey(ELabelType Type, int32 Counter, int32 Variant)
    { return (static_cast<int32>(Type) << 16) | (Counter << 1) | Variant; }

    // ForEach 스택 — POD, 힙할당 없음
    struct FForEachContext { int32 Id; };
    TArray<FForEachContext, TInlineAllocator<4>> ForEachStack;
    int32 ForEachCounter = 0;
    int32 InternalLabelCounter = 0;

    // If 스택 — POD, 힙할당 없음
    struct FIfContext { int32 Id; bool bHasElse = false; };
    TArray<FIfContext, TInlineAllocator<4>> IfStack;
    int32 IfCounter = 0;

    // Repeat 스택 — POD, 힙할당 없음
    struct FRepeatContext { int32 Id; RegisterIndex CounterReg; int32 Count; };
    TArray<FRepeatContext, TInlineAllocator<4>> RepeatStack;
    int32 RepeatCounter = 0;

    // 문자열 → int32 키 매핑 (JSON 파서용 — 런타임 동적 라벨 해석)
    TMap<FString, int32> NamedLabelMap;

    // 신 FHktVar API 의 이름 기반 변수 매핑 (JSON schema 2 의 {"var":"name"} 해석용)
    TMap<FString, FHktVRegHandle> NamedVarMap;

    // 신 FHktVar API 의 이름 기반 블록 매핑 (JSON schema 2 의 {"block":"name"} 해석용).
    // Base VReg + Count 를 보관하여 같은 이름 호출 시 동일 블록을 재사용한다.
    struct FNamedBlockEntry { FHktVRegHandle Base; int32 Count; };
    TMap<FString, FNamedBlockEntry> NamedBlockMap;

    // Flow 모드 — Self/Target 엔티티 없음
    bool bFlowMode = false;

    // Archetype 프로퍼티 검증
    EHktArchetype SelfArchetype = EHktArchetype::None;
    EHktArchetype SpawnedArchetype = EHktArchetype::None;
    TArray<FString> ValidationErrors;
    void ValidatePropertyAccess(uint16 PropId, EHktArchetype Arch);
    EHktArchetype ResolveArchetypeForRegister(RegisterIndex Entity) const;
};

// ============================================================================
// 편의 함수
// ============================================================================

/** 간단한 Story 생성 시작 */
inline FHktStoryBuilder Story(FGameplayTag TagName)
{
    return FHktStoryBuilder::Create(TagName);
}

// ============================================================================
// Public Query API
// ============================================================================

namespace HktStory
{
    /**
     * EventTag + WorldState로 Story 사전조건을 검증한다.
     *
     * 클라이언트: Proxy WorldState로 호출하여 UI 표시/요청 가능 여부 결정.
     * 서버: Story 바이트코드 내부 검증이 권위적 최종 검증 (이 함수는 힌트).
     *
     * Precondition 미등록 Story는 항상 true 반환.
     */
    HKTCORE_API bool ValidateEvent(const FHktWorldState& WorldState, const FHktEvent& Event);
}
