// Copyright Hkt Studios, Inc. All Rights Reserved.
//
// FHktVRegAllocator — Liveness + Linear-Scan 할당기 단위 테스트.
// Builder 통합이 아닌 FCodeSection 직접 조작으로 할당기 동작을 검증한다.

#include "Misc/AutomationTest.h"
#include "HktStoryTypes.h"
#include "HktStoryBuilder.h"
#include "HktVRegIR.h"
#include "HktVRegAllocator.h"
#include "VM/HktVMProgram.h"

#if WITH_AUTOMATION_TESTS

namespace
{
    /** PC 단위 헬퍼: 산술 명령 추가 + VReg ID 기록 */
    int32 EmitVI(FCodeSection& S, EOpCode Op, FHktVRegId Dst, FHktVRegId Src1, FHktVRegId Src2, uint16 Imm = 0)
    {
        FHktVInst V;
        V.Op = Op;
        V.DstVReg = Dst;
        V.Src1VReg = Src1;
        V.Src2VReg = Src2;
        V.Imm12Field = Imm;
        S.Code.Add(V);
        return S.Code.Num() - 1;
    }
}

// ============================================================================
// (1) 직선: 단순 anonymous → R0 부터 first-fit 할당
// ============================================================================

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHktVRegAllocator_Linear,
    "HktCore.VRegAllocator.Linear",
    EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktVRegAllocator_Linear::RunTest(const FString& Parameters)
{
    FCodeSection S;
    const FHktVRegId A = S.RegPool.NewAnonymous(TEXT("A"));
    const FHktVRegId B = S.RegPool.NewAnonymous(TEXT("B"));
    const FHktVRegId C = S.RegPool.NewAnonymous(TEXT("C"));
    EmitVI(S, EOpCode::LoadConst, A, InvalidVReg, InvalidVReg);
    EmitVI(S, EOpCode::LoadConst, B, InvalidVReg, InvalidVReg);
    EmitVI(S, EOpCode::Add, C, A, B);
    EmitVI(S, EOpCode::Halt, InvalidVReg, InvalidVReg, InvalidVReg);

    TArray<FString> Errors;
    const bool bOK = HktVRegAlloc::Allocate(S, FGameplayTag(), Errors);
    TestTrue(TEXT("할당 성공"), bOK);
    if (!bOK) { for (auto& E : Errors) AddError(E); return false; }

    // 모든 anonymous 가 0..9 범위로 핀됨
    for (FHktVRegId v = 0; v < S.RegPool.Metas.Num(); ++v)
    {
        const int32 P = S.RegPool.ResolvePhysical(v);
        TestTrue(FString::Printf(TEXT("v%d 는 0..9 범위"), v), P >= 0 && P <= 9);
    }
    return true;
}

// ============================================================================
// (2) 분기: JumpIf 후 Live 도 추적
// ============================================================================

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHktVRegAllocator_Branch,
    "HktCore.VRegAllocator.Branch",
    EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktVRegAllocator_Branch::RunTest(const FString& Parameters)
{
    FCodeSection S;
    const FHktVRegId Cond = S.RegPool.NewAnonymous(TEXT("Cond"));
    const FHktVRegId X = S.RegPool.NewAnonymous(TEXT("X"));
    EmitVI(S, EOpCode::LoadConst, Cond, InvalidVReg, InvalidVReg);
    EmitVI(S, EOpCode::LoadConst, X, InvalidVReg, InvalidVReg);
    // JumpIf: target=PC=4 (Halt). Imm12 가 jump 타겟.
    EmitVI(S, EOpCode::JumpIf, InvalidVReg, Cond, InvalidVReg, /*Imm=*/4);
    EmitVI(S, EOpCode::Add, X, X, X);
    EmitVI(S, EOpCode::Halt, InvalidVReg, InvalidVReg, InvalidVReg);

    TArray<FString> Errors;
    const bool bOK = HktVRegAlloc::Allocate(S, FGameplayTag(), Errors);
    TestTrue(TEXT("분기 포함 할당 성공"), bOK);
    if (!bOK) { for (auto& E : Errors) AddError(E); return false; }

    TestTrue(TEXT("Cond 0..9"), S.RegPool.ResolvePhysical(Cond) >= 0);
    TestTrue(TEXT("X 0..9"), S.RegPool.ResolvePhysical(X) >= 0);
    return true;
}

// ============================================================================
// (3) 루프: 백워드 점프로 Live 가 영속됨
// ============================================================================

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHktVRegAllocator_Loop,
    "HktCore.VRegAllocator.Loop",
    EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktVRegAllocator_Loop::RunTest(const FString& Parameters)
{
    FCodeSection S;
    const FHktVRegId Cnt = S.RegPool.NewAnonymous(TEXT("Cnt"));
    const FHktVRegId One = S.RegPool.NewAnonymous(TEXT("One"));
    const FHktVRegId Acc = S.RegPool.NewAnonymous(TEXT("Acc"));
    EmitVI(S, EOpCode::LoadConst, Cnt, InvalidVReg, InvalidVReg);  // 0
    EmitVI(S, EOpCode::LoadConst, One, InvalidVReg, InvalidVReg);  // 1
    EmitVI(S, EOpCode::LoadConst, Acc, InvalidVReg, InvalidVReg);  // 2
    EmitVI(S, EOpCode::Add, Acc, Acc, One);                         // 3 (loop body)
    EmitVI(S, EOpCode::Add, Cnt, Cnt, One);                         // 4
    EmitVI(S, EOpCode::Jump, InvalidVReg, InvalidVReg, InvalidVReg); // 5 → 3
    S.Code[5].Imm20Field = 3; S.Code[5].bUsesImm20 = true;
    EmitVI(S, EOpCode::Halt, InvalidVReg, InvalidVReg, InvalidVReg); // 6

    TArray<FString> Errors;
    const bool bOK = HktVRegAlloc::Allocate(S, FGameplayTag(), Errors);
    TestTrue(TEXT("루프 포함 할당 성공"), bOK);
    if (!bOK) { for (auto& E : Errors) AddError(E); return false; }

    // 세 변수 모두 다른 물리 레지스터에 핀되어야 함 (루프 내 동시 활성)
    const int32 PCnt = S.RegPool.ResolvePhysical(Cnt);
    const int32 PAcc = S.RegPool.ResolvePhysical(Acc);
    const int32 POne = S.RegPool.ResolvePhysical(One);
    TestNotEqual(TEXT("Cnt != Acc"), PCnt, PAcc);
    TestNotEqual(TEXT("Cnt != One"), PCnt, POne);
    TestNotEqual(TEXT("Acc != One"), PAcc, POne);
    return true;
}

// ============================================================================
// (4) Pre-colored 회피: pre-colored R5 가 라이브 구간에 있으면 anonymous 가 회피
// ============================================================================

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHktVRegAllocator_PrecoloredAvoidance,
    "HktCore.VRegAllocator.PrecoloredAvoidance",
    EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktVRegAllocator_PrecoloredAvoidance::RunTest(const FString& Parameters)
{
    FCodeSection S;
    const FHktVRegId Pin5 = S.RegPool.EnsurePinned(5);  // pre-colored R5
    const FHktVRegId A = S.RegPool.NewAnonymous(TEXT("A"));
    EmitVI(S, EOpCode::LoadConst, Pin5, InvalidVReg, InvalidVReg);   // R5 def
    EmitVI(S, EOpCode::LoadConst, A, InvalidVReg, InvalidVReg);
    EmitVI(S, EOpCode::Add, Pin5, Pin5, A);                          // R5 use
    EmitVI(S, EOpCode::Halt, InvalidVReg, InvalidVReg, InvalidVReg);

    TArray<FString> Errors;
    const bool bOK = HktVRegAlloc::Allocate(S, FGameplayTag(), Errors);
    TestTrue(TEXT("Pre-colored 충돌 회피 할당 성공"), bOK);
    if (!bOK) { for (auto& E : Errors) AddError(E); return false; }

    TestEqual(TEXT("Pin5 는 그대로 R5"), S.RegPool.ResolvePhysical(Pin5), 5);
    TestNotEqual(TEXT("A 는 R5 가 아닌 다른 GP"), S.RegPool.ResolvePhysical(A), 5);
    return true;
}

// ============================================================================
// (5) 고갈 시나리오: 11개 동시 활성 anonymous → 실패 + 진단 메시지
// ============================================================================

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHktVRegAllocator_Exhaustion,
    "HktCore.VRegAllocator.Exhaustion",
    EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktVRegAllocator_Exhaustion::RunTest(const FString& Parameters)
{
    FCodeSection S;
    TArray<FHktVRegId> Vars;
    for (int32 i = 0; i < 11; ++i)
    {
        Vars.Add(S.RegPool.NewAnonymous(*FString::Printf(TEXT("V%d"), i)));
        EmitVI(S, EOpCode::LoadConst, Vars[i], InvalidVReg, InvalidVReg);
    }
    // 모든 변수를 마지막에 동시에 사용 (= 동시 활성)
    for (int32 i = 0; i < Vars.Num() - 1; ++i)
    {
        EmitVI(S, EOpCode::Add, Vars[i], Vars[i], Vars[Vars.Num() - 1]);
    }
    EmitVI(S, EOpCode::Halt, InvalidVReg, InvalidVReg, InvalidVReg);

    TArray<FString> Errors;
    const bool bOK = HktVRegAlloc::Allocate(S, FGameplayTag(), Errors);
    TestFalse(TEXT("11개 동시 활성 → 실패"), bOK);
    TestTrue(TEXT("진단 메시지 누적"), Errors.Num() > 0);
    return true;
}

// ============================================================================
// (6) Byte-identical: 모든 pre-colored 입력은 할당기가 no-op 으로 통과
// ============================================================================

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHktVRegAllocator_PreColoredOnlyByteIdentical,
    "HktCore.VRegAllocator.PreColoredOnlyByteIdentical",
    EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktVRegAllocator_PreColoredOnlyByteIdentical::RunTest(const FString& Parameters)
{
    // 기존 32개 cpp 스토리는 모두 EnsurePinned 만 사용하므로 pre-colored only.
    // 이 경우 할당기가 즉시 반환하여 RegPool 의 Metas 가 변경되지 않아야 한다.
    FCodeSection S;
    const FHktVRegId R0 = S.RegPool.EnsurePinned(0);
    const FHktVRegId R3 = S.RegPool.EnsurePinned(3);
    EmitVI(S, EOpCode::LoadConst, R0, InvalidVReg, InvalidVReg);
    EmitVI(S, EOpCode::LoadConst, R3, InvalidVReg, InvalidVReg);
    EmitVI(S, EOpCode::Add, R0, R0, R3);
    EmitVI(S, EOpCode::Halt, InvalidVReg, InvalidVReg, InvalidVReg);

    // 할당기 호출 전 스냅샷
    const int32 R0PinnedBefore = S.RegPool.Metas[R0].PinnedPhysical;
    const int32 R3PinnedBefore = S.RegPool.Metas[R3].PinnedPhysical;

    TArray<FString> Errors;
    const bool bOK = HktVRegAlloc::Allocate(S, FGameplayTag(), Errors);
    TestTrue(TEXT("pre-colored only: 즉시 성공"), bOK);
    TestEqual(TEXT("R0 핀 미변경"), S.RegPool.Metas[R0].PinnedPhysical, R0PinnedBefore);
    TestEqual(TEXT("R3 핀 미변경"), S.RegPool.Metas[R3].PinnedPhysical, R3PinnedBefore);
    return true;
}

// ============================================================================
// (7) 결정론: 같은 입력은 같은 할당 결과
// ============================================================================

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHktVRegAllocator_Determinism,
    "HktCore.VRegAllocator.Determinism",
    EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktVRegAllocator_Determinism::RunTest(const FString& Parameters)
{
    auto BuildAndAllocate = []() -> TArray<int32>
    {
        FCodeSection S;
        const FHktVRegId A = S.RegPool.NewAnonymous(TEXT("A"));
        const FHktVRegId B = S.RegPool.NewAnonymous(TEXT("B"));
        const FHktVRegId C = S.RegPool.NewAnonymous(TEXT("C"));
        EmitVI(S, EOpCode::LoadConst, A, InvalidVReg, InvalidVReg);
        EmitVI(S, EOpCode::LoadConst, B, InvalidVReg, InvalidVReg);
        EmitVI(S, EOpCode::Add, C, A, B);
        EmitVI(S, EOpCode::Sub, A, C, B);
        EmitVI(S, EOpCode::Halt, InvalidVReg, InvalidVReg, InvalidVReg);

        TArray<FString> Errors;
        HktVRegAlloc::Allocate(S, FGameplayTag(), Errors);

        return { S.RegPool.ResolvePhysical(A),
                 S.RegPool.ResolvePhysical(B),
                 S.RegPool.ResolvePhysical(C) };
    };

    const auto X = BuildAndAllocate();
    const auto Y = BuildAndAllocate();
    TestTrue(TEXT("동일 입력 → 동일 할당 (A)"), X[0] == Y[0]);
    TestTrue(TEXT("동일 입력 → 동일 할당 (B)"), X[1] == Y[1]);
    TestTrue(TEXT("동일 입력 → 동일 할당 (C)"), X[2] == Y[2]);
    return true;
}

#endif // WITH_AUTOMATION_TESTS
