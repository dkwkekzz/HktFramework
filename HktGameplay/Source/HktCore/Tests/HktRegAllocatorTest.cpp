// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Misc/AutomationTest.h"
#include "HktStoryTypes.h"
#include "HktStoryBuilder.h"

#if WITH_AUTOMATION_TESTS

// ============================================================================
// FHktRegAllocator 단위 테스트
// ============================================================================

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHktRegAllocator_BasicAllocation,
    "HktCore.RegAllocator.BasicAllocation",
    EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktRegAllocator_BasicAllocation::RunTest(const FString& Parameters)
{
    FHktRegAllocator Alloc;

    // 10개 GP 레지스터(R0-R9) 모두 할당 가능해야 함
    TSet<RegisterIndex> Allocated;
    for (int32 i = 0; i < FHktRegAllocator::NumGPRegs; ++i)
    {
        RegisterIndex R = Alloc.Alloc();
        TestTrue(FString::Printf(TEXT("R%d는 GP 범위 내"), R), R < FHktRegAllocator::NumGPRegs);
        TestFalse(FString::Printf(TEXT("R%d는 중복 할당되지 않음"), R), Allocated.Contains(R));
        Allocated.Add(R);
    }

    TestEqual(TEXT("10개 모두 할당됨"), Allocated.Num(), FHktRegAllocator::NumGPRegs);
    TestEqual(TEXT("사용 가능 레지스터 0개"), Alloc.AvailableCount(), 0);

    return true;
}

// ----------------------------------------------------------------------------

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHktRegAllocator_FreeReuse,
    "HktCore.RegAllocator.FreeReuse",
    EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktRegAllocator_FreeReuse::RunTest(const FString& Parameters)
{
    FHktRegAllocator Alloc;

    RegisterIndex R0 = Alloc.Alloc();
    RegisterIndex R1 = Alloc.Alloc();

    TestEqual(TEXT("사용 가능 8개"), Alloc.AvailableCount(), 8);

    Alloc.Free(R0);
    TestTrue(TEXT("R0 해제 후 사용 가능"), Alloc.IsAvailable(R0));
    TestEqual(TEXT("사용 가능 9개"), Alloc.AvailableCount(), 9);

    // 해제된 레지스터가 재할당됨
    RegisterIndex R2 = Alloc.Alloc();
    TestEqual(TEXT("해제된 R0 재사용"), R2, R0);

    Alloc.Free(R1);
    Alloc.Free(R2);

    return true;
}

// ----------------------------------------------------------------------------

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHktRegAllocator_AllocBlock,
    "HktCore.RegAllocator.AllocBlock",
    EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktRegAllocator_AllocBlock::RunTest(const FString& Parameters)
{
    FHktRegAllocator Alloc;

    // 연속 3개 할당
    RegisterIndex Base = Alloc.AllocBlock(3);
    TestTrue(TEXT("Base는 GP 범위 내"), Base + 2 < FHktRegAllocator::NumGPRegs);

    // 3개 모두 사용 중
    TestFalse(TEXT("Base 사용 중"), Alloc.IsAvailable(Base));
    TestFalse(TEXT("Base+1 사용 중"), Alloc.IsAvailable(Base + 1));
    TestFalse(TEXT("Base+2 사용 중"), Alloc.IsAvailable(Base + 2));

    TestEqual(TEXT("사용 가능 7개"), Alloc.AvailableCount(), 7);

    Alloc.FreeBlock(Base, 3);
    TestEqual(TEXT("반환 후 사용 가능 10개"), Alloc.AvailableCount(), 10);

    return true;
}

// ----------------------------------------------------------------------------

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHktRegAllocator_AllocBlockSkipFragmented,
    "HktCore.RegAllocator.AllocBlockSkipFragmented",
    EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktRegAllocator_AllocBlockSkipFragmented::RunTest(const FString& Parameters)
{
    FHktRegAllocator Alloc;

    // R1을 먼저 할당하여 구멍 생성
    RegisterIndex First = Alloc.Alloc();  // R0
    RegisterIndex Hole = Alloc.Alloc();   // R1
    Alloc.Free(First);                     // R0 해제, R1 사용 중

    // 연속 3개 요청 → R0은 빈칸이지만 R1이 점유 → R0,R1,R2 연속 불가
    // R2,R3,R4 또는 그 이후 연속 블록이 반환되어야 함
    RegisterIndex Base = Alloc.AllocBlock(3);
    TestTrue(TEXT("블록이 R1(점유)을 건너뜀"), Base > Hole || Base + 2 < Hole);

    Alloc.Free(Hole);
    Alloc.FreeBlock(Base, 3);

    return true;
}

// ----------------------------------------------------------------------------

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHktRegAllocator_ScopedRegRAII,
    "HktCore.RegAllocator.ScopedRegRAII",
    EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktRegAllocator_ScopedRegRAII::RunTest(const FString& Parameters)
{
    auto Builder = FHktStoryBuilder::Create(FName(TEXT("Test.ScopedReg")));
    RegisterIndex CapturedReg;

    TestEqual(TEXT("초기 사용 가능 10개"), Builder.GetRegAllocator().AvailableCount(), 10);

    {
        FHktScopedReg Scoped(Builder);
        CapturedReg = Scoped;
        TestEqual(TEXT("할당 후 사용 가능 9개"), Builder.GetRegAllocator().AvailableCount(), 9);
        TestFalse(TEXT("할당된 레지스터 사용 중"), Builder.GetRegAllocator().IsAvailable(CapturedReg));
    }

    // 스코프 종료 후 자동 반환
    TestTrue(TEXT("스코프 종료 후 반환됨"), Builder.GetRegAllocator().IsAvailable(CapturedReg));
    TestEqual(TEXT("반환 후 사용 가능 10개"), Builder.GetRegAllocator().AvailableCount(), 10);

    return true;
}

// ----------------------------------------------------------------------------

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHktRegAllocator_NestedCompositeNoConflict,
    "HktCore.RegAllocator.NestedCompositeNoConflict",
    EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktRegAllocator_NestedCompositeNoConflict::RunTest(const FString& Parameters)
{
    auto Builder = FHktStoryBuilder::Create(FName(TEXT("Test.NestedComposite")));

    // 외부에서 2개 할당
    FHktScopedReg Outer1(Builder);
    FHktScopedReg Outer2(Builder);
    RegisterIndex O1 = Outer1;
    RegisterIndex O2 = Outer2;

    {
        // 내부에서 3개 할당 (조합 연산 시뮬레이션)
        FHktScopedReg Inner1(Builder);
        FHktScopedReg Inner2(Builder);
        FHktScopedReg Inner3(Builder);

        // 내부 레지스터가 외부와 다른지 검증
        TestNotEqual(TEXT("Inner1 != Outer1"), static_cast<RegisterIndex>(Inner1), O1);
        TestNotEqual(TEXT("Inner1 != Outer2"), static_cast<RegisterIndex>(Inner1), O2);
        TestNotEqual(TEXT("Inner2 != Outer1"), static_cast<RegisterIndex>(Inner2), O1);
        TestNotEqual(TEXT("Inner2 != Outer2"), static_cast<RegisterIndex>(Inner2), O2);
        TestNotEqual(TEXT("Inner3 != Outer1"), static_cast<RegisterIndex>(Inner3), O1);
        TestNotEqual(TEXT("Inner3 != Outer2"), static_cast<RegisterIndex>(Inner3), O2);

        // 내부끼리도 다른지 검증
        TestNotEqual(TEXT("Inner1 != Inner2"), static_cast<RegisterIndex>(Inner1), static_cast<RegisterIndex>(Inner2));
        TestNotEqual(TEXT("Inner1 != Inner3"), static_cast<RegisterIndex>(Inner1), static_cast<RegisterIndex>(Inner3));
        TestNotEqual(TEXT("Inner2 != Inner3"), static_cast<RegisterIndex>(Inner2), static_cast<RegisterIndex>(Inner3));

        TestEqual(TEXT("5개 사용 중, 5개 사용 가능"), Builder.GetRegAllocator().AvailableCount(), 5);
    }

    // 내부 스코프 종료 후 외부만 사용 중
    TestEqual(TEXT("내부 반환 후 8개 사용 가능"), Builder.GetRegAllocator().AvailableCount(), 8);

    return true;
}

// ----------------------------------------------------------------------------

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHktRegAllocator_ScopedRegBlockRAII,
    "HktCore.RegAllocator.ScopedRegBlockRAII",
    EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktRegAllocator_ScopedRegBlockRAII::RunTest(const FString& Parameters)
{
    auto Builder = FHktStoryBuilder::Create(FName(TEXT("Test.ScopedRegBlock")));
    RegisterIndex CapturedBase;

    {
        FHktScopedRegBlock Block(Builder, 3);
        CapturedBase = Block;
        TestEqual(TEXT("블록 할당 후 사용 가능 7개"), Builder.GetRegAllocator().AvailableCount(), 7);
    }

    // 스코프 종료 후 3개 모두 반환
    TestEqual(TEXT("블록 반환 후 사용 가능 10개"), Builder.GetRegAllocator().AvailableCount(), 10);
    TestTrue(TEXT("Base 사용 가능"), Builder.GetRegAllocator().IsAvailable(CapturedBase));
    TestTrue(TEXT("Base+1 사용 가능"), Builder.GetRegAllocator().IsAvailable(CapturedBase + 1));
    TestTrue(TEXT("Base+2 사용 가능"), Builder.GetRegAllocator().IsAvailable(CapturedBase + 2));

    return true;
}

// ----------------------------------------------------------------------------

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHktRegAllocator_ReserveProtectsCallerRegisters,
    "HktCore.RegAllocator.ReserveProtectsCallerRegisters",
    EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktRegAllocator_ReserveProtectsCallerRegisters::RunTest(const FString& Parameters)
{
    FHktRegAllocator Alloc;

    // R0, R1을 외부에서 사용 중이라고 가정 (직접 지정된 레지스터)
    // FHktRegReserve로 보호
    {
        FHktRegReserve Guard(Alloc, {Reg::R0, Reg::R1});

        // Guard 활성 중에는 R0, R1이 사용 불가
        TestFalse(TEXT("R0 예약됨"), Alloc.IsAvailable(Reg::R0));
        TestFalse(TEXT("R1 예약됨"), Alloc.IsAvailable(Reg::R1));

        // Alloc()은 R0, R1을 건너뜀
        RegisterIndex S0 = Alloc.Alloc();
        TestNotEqual(TEXT("스크래치 != R0"), S0, Reg::R0);
        TestNotEqual(TEXT("스크래치 != R1"), S0, Reg::R1);

        RegisterIndex S1 = Alloc.Alloc();
        TestNotEqual(TEXT("스크래치2 != R0"), S1, Reg::R0);
        TestNotEqual(TEXT("스크래치2 != R1"), S1, Reg::R1);

        Alloc.Free(S0);
        Alloc.Free(S1);
    }

    // Guard 소멸 후 R0, R1 다시 사용 가능
    TestTrue(TEXT("Guard 해제 후 R0 사용 가능"), Alloc.IsAvailable(Reg::R0));
    TestTrue(TEXT("Guard 해제 후 R1 사용 가능"), Alloc.IsAvailable(Reg::R1));
    TestEqual(TEXT("전체 10개 사용 가능"), Alloc.AvailableCount(), 10);

    return true;
}

// ----------------------------------------------------------------------------

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHktRegAllocator_ReserveIgnoresSpecialRegisters,
    "HktCore.RegAllocator.ReserveIgnoresSpecialRegisters",
    EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktRegAllocator_ReserveIgnoresSpecialRegisters::RunTest(const FString& Parameters)
{
    FHktRegAllocator Alloc;

    // 특수 레지스터(R10~R15)는 Reserve 대상이 아님
    {
        FHktRegReserve Guard(Alloc, {Reg::Self, Reg::Target, Reg::Spawned});

        // GP 레지스터 수에 영향 없음
        TestEqual(TEXT("특수 레지스터는 GP 풀에 영향 없음"), Alloc.AvailableCount(), 10);
    }

    return true;
}

// ----------------------------------------------------------------------------

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHktRegAllocator_NestedReserveAndAlloc,
    "HktCore.RegAllocator.NestedReserveAndAlloc",
    EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktRegAllocator_NestedReserveAndAlloc::RunTest(const FString& Parameters)
{
    // ApplyDamageConst(Target=R11, Amount=100) → ApplyDamage(Target=R11, Amount=ScopedReg) 시뮬레이션
    // Target은 특수 레지스터(R11), Amount는 ScopedReg
    FHktRegAllocator Alloc;

    // 외부: ApplyDamageConst가 AmountReg 할당
    {
        FHktRegReserve OuterGuard(Alloc, {Reg::Target}); // R11 → GP 범위 밖 → 무시됨
        RegisterIndex AmountReg = Alloc.Alloc(); // R0

        // 내부: ApplyDamage가 Target(R11), Amount(R0) 보호 후 스크래치 할당
        {
            FHktRegReserve InnerGuard(Alloc, {Reg::Target, AmountReg});
            RegisterIndex Dmg = Alloc.Alloc();
            RegisterIndex Scratch = Alloc.Alloc();

            // 스크래치가 AmountReg(R0)과 다른지 확인
            TestNotEqual(TEXT("Dmg != AmountReg"), Dmg, AmountReg);
            TestNotEqual(TEXT("Scratch != AmountReg"), Scratch, AmountReg);
            TestNotEqual(TEXT("Dmg != Scratch"), Dmg, Scratch);

            Alloc.Free(Dmg);
            Alloc.Free(Scratch);
        }

        Alloc.Free(AmountReg);
    }

    TestEqual(TEXT("모두 해제 후 10개 사용 가능"), Alloc.AvailableCount(), 10);
    return true;
}

#endif // WITH_AUTOMATION_TESTS
