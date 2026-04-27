// Copyright Hkt Studios, Inc. All Rights Reserved.
//
// FHktVar Builder API — 통합 테스트.
// 새 FHktVar API 만 사용하여 미니 Fireball 형태 스토리를 작성하고,
// 빌드가 성공하며 Halt 가 마지막 명령인지 검증한다.

#include "Misc/AutomationTest.h"
#include "HktStoryBuilder.h"
#include "HktCoreProperties.h"
#include "HktStoryTypes.h"
#include "VM/HktVMProgram.h"

#if WITH_AUTOMATION_TESTS

// ============================================================================
// (1) 신 API 만으로 빌드 가능한지 — 산술/저장 파이프라인
// ============================================================================

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHktVarBuilder_BasicArithmetic,
    "HktCore.VarBuilder.BasicArithmetic",
    EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktVarBuilder_BasicArithmetic::RunTest(const FString& Parameters)
{
    auto B = FHktStoryBuilder::Create(FName(TEXT("Test.VarBuilder.Arithmetic")));
    FHktVar A = B.NewVar(TEXT("A"));
    FHktVar Bv = B.NewVar(TEXT("B"));
    FHktVar Cv = B.NewVar(TEXT("C"));
    B.LoadConst(A, 42);
    B.LoadConst(Bv, 7);
    B.Add(Cv, A, Bv);
    B.SaveStore(PropertyId::Health, Cv);
    B.Halt();
    TSharedPtr<FHktVMProgram> P = B.Build();

    TestNotNull(TEXT("Build 성공"), P.Get());
    if (!P.IsValid()) return false;
    TestTrue(TEXT("Halt 로 종료"), P->Code.Last().GetOpCode() == EOpCode::Halt);
    return true;
}

// ============================================================================
// (2) FHktVarBlock 으로 Position 패턴
// ============================================================================

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHktVarBuilder_PositionBlock,
    "HktCore.VarBuilder.PositionBlock",
    EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktVarBuilder_PositionBlock::RunTest(const FString& Parameters)
{
    auto B = FHktStoryBuilder::Create(FName(TEXT("Test.VarBuilder.Position")));
    FHktVar Self = B.Self();
    FHktVarBlock Pos = B.GetPosition(Self);
    TestEqual(TEXT("Block 크기 3"), Pos.Num(), 3);
    B.SetPosition(Self, Pos);
    B.Halt();
    TSharedPtr<FHktVMProgram> P = B.Build();

    TestNotNull(TEXT("Build 성공"), P.Get());
    return P.IsValid();
}

// ============================================================================
// (3) 미니 Fireball — 신 API 만 사용한 동등 코드
// ============================================================================

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHktVarBuilder_MiniFireball,
    "HktCore.VarBuilder.MiniFireball",
    EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktVarBuilder_MiniFireball::RunTest(const FString& Parameters)
{
    const FGameplayTag CastTag = FGameplayTag::RequestGameplayTag(FName(TEXT("Anim.UpperBody.Cast.Fireball")), false);
    const FGameplayTag ProjTag = FGameplayTag::RequestGameplayTag(FName(TEXT("Entity.Projectile.Fireball")), false);
    const FGameplayTag VFXTag  = FGameplayTag::RequestGameplayTag(FName(TEXT("VFX.Niagara.DirectHit")), false);

    auto B = FHktStoryBuilder::Create(FName(TEXT("Test.VarBuilder.MiniFireball")));
    FHktVar Self = B.Self();
    if (CastTag.IsValid()) B.AddTag(Self, CastTag);
    B.WaitSeconds(1.0f);

    // 투사체 생성 + 발사
    FHktVar Spawned = B.SpawnEntityVar(ProjTag);
    B.SaveConstEntity(Spawned, PropertyId::IsGrounded, 0);
    B.CopyPosition(Spawned, Self);
    B.MoveForward(Spawned, 500);

    // 충돌 대기 + 직격 처리
    FHktVar Hit = B.WaitCollision(Spawned);
    FHktVar HitTarget = B.NewVar(TEXT("HitTarget"));
    B.Move(HitTarget, Hit);

    FHktVarBlock ExplosionPos = B.GetPosition(Spawned);
    B.DestroyEntity(Spawned);
    B.ApplyDamageConst(HitTarget, 100);
    if (VFXTag.IsValid()) B.PlayVFXAttached(HitTarget, VFXTag);

    if (CastTag.IsValid()) B.RemoveTag(Self, CastTag);
    B.Halt();
    TSharedPtr<FHktVMProgram> P = B.Build();

    TestNotNull(TEXT("미니 Fireball Build 성공"), P.Get());
    if (!P.IsValid()) return false;

    // 스폰/충돌 대기/제거 op 가 모두 존재
    bool bSawSpawn = false, bSawWait = false, bSawDestroy = false;
    for (const FInstruction& I : P->Code)
    {
        if (I.GetOpCode() == EOpCode::SpawnEntity) bSawSpawn = true;
        if (I.GetOpCode() == EOpCode::WaitCollision) bSawWait = true;
        if (I.GetOpCode() == EOpCode::DestroyEntity) bSawDestroy = true;
    }
    TestTrue(TEXT("SpawnEntity emit"), bSawSpawn);
    TestTrue(TEXT("WaitCollision emit"), bSawWait);
    TestTrue(TEXT("DestroyEntity emit"), bSawDestroy);
    return true;
}

// ============================================================================
// (4) 신·구 API 공존: 같은 빌더에서 양 API 가 동시에 동작
// ============================================================================

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHktVarBuilder_OldNewCoexistence,
    "HktCore.VarBuilder.OldNewCoexistence",
    EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktVarBuilder_OldNewCoexistence::RunTest(const FString& Parameters)
{
    auto B = FHktStoryBuilder::Create(FName(TEXT("Test.VarBuilder.Coexist")));

    // 구 API
    B.LoadConst(Reg::R0, 10);
    B.LoadConst(Reg::R1, 20);
    B.Add(Reg::R2, Reg::R0, Reg::R1);

    // 신 API — 같은 빌더에서 새 변수 발급
    FHktVar A = B.NewVar(TEXT("NewA"));
    FHktVar Bv = B.NewVar(TEXT("NewB"));
    B.LoadConst(A, 100);
    B.LoadConst(Bv, 200);
    B.Add(A, A, Bv);
    B.SaveStore(PropertyId::Health, A);

    B.Halt();
    TSharedPtr<FHktVMProgram> P = B.Build();
    TestNotNull(TEXT("신·구 공존 Build 성공"), P.Get());
    return P.IsValid();
}

#endif // WITH_AUTOMATION_TESTS
