// Copyright Hkt Studios, Inc. All Rights Reserved.
//
// 단계 1 완료 후 삭제 가능 — 가상 레지스터 IR 도입이 출력 바이트코드를
// 변경하지 않음(byte-identical)을 검증하는 임시 회귀 테스트.

#include "Misc/AutomationTest.h"
#include "HktStoryTypes.h"
#include "HktStoryBuilder.h"
#include "HktCoreProperties.h"
#include "VM/HktVMProgram.h"

#if WITH_AUTOMATION_TESTS

namespace
{
    /** ENABLE_HKT_INSIGHTS=1 빌드는 Story Start/End Log 인스트럭션이 자동 emit된다. */
    #if ENABLE_HKT_INSIGHTS
        constexpr bool bInsightsLogs = true;
    #else
        constexpr bool bInsightsLogs = false;
    #endif

    /** 테스트 헬퍼: Make() raw 비교 */
    bool RawEquals(const FInstruction& A, const FInstruction& B)
    {
        return A.Raw == B.Raw;
    }
}

// ============================================================================
// 기본 산술/저장 패턴이 기존 인코딩과 동일한지
// ============================================================================

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHktVRegIR_BasicEncoding,
    "HktCore.VRegIR.ByteIdentical.BasicEncoding",
    EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktVRegIR_BasicEncoding::RunTest(const FString& Parameters)
{
    auto Builder = FHktStoryBuilder::Create(FName(TEXT("Test.VRegIR.Basic")));
    Builder.LoadConst(Reg::R0, 42);
    Builder.LoadConst(Reg::R1, 7);
    Builder.Add(Reg::R2, Reg::R0, Reg::R1);
    Builder.SaveStore(PropertyId::Health, Reg::R2);
    Builder.Halt();
    TSharedPtr<FHktVMProgram> Program = Builder.Build();

    TestNotNull(TEXT("Build 성공"), Program.Get());
    if (!Program.IsValid()) return false;

    // 예상 인스트럭션 시퀀스 — 기존 emit 경로와 동일한 헬퍼로 생성
    TArray<FInstruction> Expected;
    if (bInsightsLogs)
    {
        // 생성자에서 Log("[Story Start] ...") (StrIdx=0)
        Expected.Add(FInstruction::MakeImm(EOpCode::Log, 0, 0));
    }
    Expected.Add(FInstruction::MakeImm(EOpCode::LoadConst, Reg::R0, 42));
    Expected.Add(FInstruction::MakeImm(EOpCode::LoadConst, Reg::R1, 7));
    Expected.Add(FInstruction::Make(EOpCode::Add, Reg::R2, Reg::R0, Reg::R1, 0));
    Expected.Add(FInstruction::Make(EOpCode::SaveStore, 0, Reg::R2, 0, PropertyId::Health));
    if (bInsightsLogs)
    {
        // Halt() 에서 Log("[Story End] ...") (StrIdx=1)
        Expected.Add(FInstruction::MakeImm(EOpCode::Log, 0, 1));
    }
    Expected.Add(FInstruction::Make(EOpCode::Halt, 0, 0, 0, 0));

    TestEqual(TEXT("코드 길이"), Program->Code.Num(), Expected.Num());
    if (Program->Code.Num() != Expected.Num()) return false;

    for (int32 PC = 0; PC < Expected.Num(); ++PC)
    {
        const bool bMatch = RawEquals(Program->Code[PC], Expected[PC]);
        TestTrue(FString::Printf(TEXT("PC=%d Op=%s 일치 (got=0x%08X, expected=0x%08X)"),
            PC, GetOpCodeName(Program->Code[PC].GetOpCode()),
            Program->Code[PC].Raw, Expected[PC].Raw), bMatch);
        if (!bMatch) return false;
    }
    return true;
}

// ============================================================================
// 라벨 해소: Jump의 Imm20에 라벨 PC가 정확히 패치되는지
// ============================================================================

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHktVRegIR_LabelResolution,
    "HktCore.VRegIR.ByteIdentical.LabelResolution",
    EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktVRegIR_LabelResolution::RunTest(const FString& Parameters)
{
    auto Builder = FHktStoryBuilder::Create(FName(TEXT("Test.VRegIR.Label")));
    Builder.LoadConst(Reg::R0, 1);
    Builder.JumpIf(Reg::R0, FName(TEXT("End")));
    Builder.LoadConst(Reg::R1, 99);
    Builder.Label(FName(TEXT("End")));
    Builder.Halt();
    TSharedPtr<FHktVMProgram> Program = Builder.Build();

    TestNotNull(TEXT("Build 성공"), Program.Get());
    if (!Program.IsValid()) return false;

    // JumpIf의 PC를 찾아서 Imm12 (jump targets는 JumpIf의 경우 Imm12)
    // 가 "End" 라벨 PC와 일치하는지 검증.
    int32 JumpIfPC = INDEX_NONE;
    for (int32 PC = 0; PC < Program->Code.Num(); ++PC)
    {
        if (Program->Code[PC].GetOpCode() == EOpCode::JumpIf)
        {
            JumpIfPC = PC;
            break;
        }
    }
    TestTrue(TEXT("JumpIf 발견"), JumpIfPC != INDEX_NONE);
    if (JumpIfPC == INDEX_NONE) return false;

    int32 HaltPC = INDEX_NONE;
    for (int32 PC = 0; PC < Program->Code.Num(); ++PC)
    {
        if (Program->Code[PC].GetOpCode() == EOpCode::Halt)
        {
            HaltPC = PC;
            break;
        }
    }
    TestTrue(TEXT("Halt 발견"), HaltPC != INDEX_NONE);
    if (HaltPC == INDEX_NONE) return false;

    const int32 ResolvedTarget = Program->Code[JumpIfPC].Imm12;
    TestEqual(TEXT("JumpIf 타겟이 'End' 라벨(=Halt PC)과 일치"), ResolvedTarget, HaltPC);
    return true;
}

// ============================================================================
// 결정론: 동일 빌더 호출 시퀀스는 동일 바이트를 만들어야 한다
// ============================================================================

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHktVRegIR_Determinism,
    "HktCore.VRegIR.ByteIdentical.Determinism",
    EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktVRegIR_Determinism::RunTest(const FString& Parameters)
{
    auto BuildOnce = []() -> TArray<FInstruction>
    {
        auto B = FHktStoryBuilder::Create(FName(TEXT("Test.VRegIR.Determ")));
        B.LoadConst(Reg::R0, 100);
        B.LoadConst(Reg::R1, 200);
        B.Add(Reg::R2, Reg::R0, Reg::R1);
        B.Sub(Reg::R3, Reg::R1, Reg::R0);
        B.Mul(Reg::R4, Reg::R2, Reg::R3);
        B.CmpGt(Reg::Flag, Reg::R4, Reg::R0);
        B.JumpIf(Reg::Flag, FName(TEXT("Exit")));
        B.SaveStore(PropertyId::Health, Reg::R4);
        B.Label(FName(TEXT("Exit")));
        B.Halt();
        TSharedPtr<FHktVMProgram> P = B.Build();
        return P->Code;
    };

    const TArray<FInstruction> A = BuildOnce();
    const TArray<FInstruction> Bx = BuildOnce();

    TestEqual(TEXT("코드 길이 동일"), A.Num(), Bx.Num());
    if (A.Num() != Bx.Num()) return false;
    for (int32 PC = 0; PC < A.Num(); ++PC)
    {
        TestTrue(FString::Printf(TEXT("PC=%d raw 동일"), PC), A[PC].Raw == Bx[PC].Raw);
    }
    return true;
}

// ============================================================================
// MakeImm 경로(LoadConst, DispatchEvent, Log)와 Make 경로 모두 byte-identical
// ============================================================================

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHktVRegIR_MixedEncoding,
    "HktCore.VRegIR.ByteIdentical.MixedEncoding",
    EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktVRegIR_MixedEncoding::RunTest(const FString& Parameters)
{
    auto Builder = FHktStoryBuilder::Create(FName(TEXT("Test.VRegIR.Mixed")));
    Builder.LoadConst(Reg::R0, 12345);                          // MakeImm
    Builder.LoadStoreEntity(Reg::R1, Reg::Self, PropertyId::Health); // Make w/ Imm12
    Builder.CmpLt(Reg::Flag, Reg::R1, Reg::R0);                 // Make 3-reg
    Builder.Move(Reg::R2, Reg::R0);                             // Make 2-reg
    Builder.AddImm(Reg::R3, Reg::R0, -7);                       // Make w/ signed Imm12
    Builder.Halt();
    TSharedPtr<FHktVMProgram> Program = Builder.Build();

    TestNotNull(TEXT("Build 성공"), Program.Get());
    if (!Program.IsValid()) return false;

    TArray<FInstruction> Expected;
    if (bInsightsLogs) Expected.Add(FInstruction::MakeImm(EOpCode::Log, 0, 0));
    Expected.Add(FInstruction::MakeImm(EOpCode::LoadConst, Reg::R0, 12345));
    Expected.Add(FInstruction::Make(EOpCode::LoadStoreEntity, Reg::R1, Reg::Self, 0, PropertyId::Health));
    Expected.Add(FInstruction::Make(EOpCode::CmpLt, Reg::Flag, Reg::R1, Reg::R0, 0));
    Expected.Add(FInstruction::Make(EOpCode::Move, Reg::R2, Reg::R0, 0, 0));
    Expected.Add(FInstruction::Make(EOpCode::AddImm, Reg::R3, Reg::R0, 0, static_cast<uint16>(-7 & 0xFFF)));
    if (bInsightsLogs) Expected.Add(FInstruction::MakeImm(EOpCode::Log, 0, 1));
    Expected.Add(FInstruction::Make(EOpCode::Halt, 0, 0, 0, 0));

    TestEqual(TEXT("코드 길이"), Program->Code.Num(), Expected.Num());
    if (Program->Code.Num() != Expected.Num()) return false;

    for (int32 PC = 0; PC < Expected.Num(); ++PC)
    {
        const bool bMatch = RawEquals(Program->Code[PC], Expected[PC]);
        TestTrue(FString::Printf(TEXT("PC=%d Op=%s 일치 (got=0x%08X, expected=0x%08X)"),
            PC, GetOpCodeName(Program->Code[PC].GetOpCode()),
            Program->Code[PC].Raw, Expected[PC].Raw), bMatch);
        if (!bMatch) return false;
    }
    return true;
}

#endif // WITH_AUTOMATION_TESTS
