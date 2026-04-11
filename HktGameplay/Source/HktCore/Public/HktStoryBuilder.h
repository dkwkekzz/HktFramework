// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
#include "HktCoreDefs.h"
#include "HktStoryTypes.h"
#include "HktCoreArchetype.h"

struct FHktVMProgram;
struct FHktWorldState;
struct FHktEvent;
class FHktStoryBuilder;

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
 */
struct FCodeSection
{
    TArray<FInstruction> Code;
    TArray<int32> Constants;
    TArray<FString> Strings;
    TMap<FName, int32> Labels;
    TArray<TPair<int32, FName>> Fixups;

    // 정수 키 라벨 — 자동 생성 라벨용 (힙할당 없음)
    TMap<int32, int32> IntLabels;
    TArray<TPair<int32, int32>> IntFixups;
};

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

    // ActiveSection이 자기 멤버(MainSection/PreconditionSection)를 가리키므로
    // implicit copy/move는 댕글링 포인터를 만든다. 복사 금지, move는 재조정.
    FHktStoryBuilder(const FHktStoryBuilder&) = delete;
    FHktStoryBuilder& operator=(const FHktStoryBuilder&) = delete;
    FHktStoryBuilder(FHktStoryBuilder&& Other) noexcept;
    FHktStoryBuilder& operator=(FHktStoryBuilder&&) = delete;

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

    // ========== Terrain ==========

    /** 복셀 좌표(X,Y)의 표면 높이 → Dst (복셀 단위) */
    FHktStoryBuilder& GetTerrainHeight(RegisterIndex Dst, RegisterIndex VoxelX, RegisterIndex VoxelY);

    /** 복셀 좌표(PosBase, PosBase+1)의 Z=ZReg 위치 복셀 타입 → Dst */
    FHktStoryBuilder& GetVoxelType(RegisterIndex Dst, RegisterIndex PosBase, RegisterIndex ZReg);

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

private:
    explicit FHktStoryBuilder(const FGameplayTag& Tag);

    void Emit(FInstruction Inst);
    int32 AddString(const FString& Str);
    int32 AddConstant(int32 Value);
    int32 TagToInt(const FGameplayTag& Tag);
    static void ResolveLabels(FCodeSection& Section, const FGameplayTag& Tag);

    // 비교 + If 헬퍼 (18개 public 메서드의 공통 구현)
    FHktStoryBuilder& IfCmp(EOpCode CmpOp, RegisterIndex A, RegisterIndex B);
    FHktStoryBuilder& IfCmpConst(EOpCode CmpOp, RegisterIndex Src, int32 Value);
    FHktStoryBuilder& IfPropertyCmp(EOpCode CmpOp, RegisterIndex Entity, uint16 PropertyId, int32 Value);
    FHktStoryBuilder& CmpConst(EOpCode CmpOp, RegisterIndex Dst, RegisterIndex Src, int32 Value);

private:
    TSharedRef<FHktVMProgram> Program;
    FHktRegAllocator RegAllocator;

    FCodeSection MainSection;
    FCodeSection PreconditionSection;
    FCodeSection* ActiveSection = &MainSection;

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
