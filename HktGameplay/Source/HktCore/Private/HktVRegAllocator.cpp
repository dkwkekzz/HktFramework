// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVRegAllocator.h"
#include "HktCoreLog.h"
#include "HktCoreEventLog.h"

namespace
{
    // anonymous VReg 가 사용할 수 있는 GP 물리 레지스터 범위 (R0..R9).
    constexpr int32 GPLow = 0;
    constexpr int32 GPHigh = 9;
    constexpr int32 NumGP = GPHigh - GPLow + 1;

    // ------------------------------------------------------------------
    // CFG 구성 — 라벨/점프 기반 successor 계산
    // ------------------------------------------------------------------

    /** PC 단위 successor 리스트 — 결정론을 위해 TArray<int32> 만 사용 */
    struct FCFG
    {
        TArray<TArray<int32, TInlineAllocator<2>>> Successors;  // PC → next PCs
        int32 NumInsts = 0;
    };

    /** VInst Op 가 무조건 다음 PC 로 진행하지 않는 경우 (Halt/Fail/Jump 는 fall-through 없음) */
    bool IsTerminator(EOpCode Op)
    {
        return Op == EOpCode::Halt || Op == EOpCode::Fail || Op == EOpCode::Jump;
    }

    /** Jump 계열의 타겟 PC 를 추출. Jump 는 Imm20, JumpIf/JumpIfNot 은 Imm12 — 픽스업 후 호출되어야 함. */
    int32 ExtractJumpTarget(const FHktVInst& V)
    {
        if (V.Op == EOpCode::Jump)
        {
            return V.Imm20Field;
        }
        if (V.Op == EOpCode::JumpIf || V.Op == EOpCode::JumpIfNot)
        {
            return static_cast<int32>(V.Imm12Field);
        }
        return -1;
    }

    /**
     * 라벨이 픽스업되지 않은 jump (= Imm 필드가 0이지만 Fixups 미해결) 도 보수적으로 모든 라벨 PC 로 분기한다고
     * 가정해야 하지만, 본 할당기는 ResolveVInstFixup 호출 이후 (또는 동등하게 Section.Code 의 jump imm 이
     * 이미 패치된 시점)에 호출된다. 따라서 단순 Imm 추출이 정확하다.
     */
    FCFG BuildCFG(const TArray<FHktVInst>& Code)
    {
        FCFG CFG;
        CFG.NumInsts = Code.Num();
        CFG.Successors.SetNum(Code.Num());

        for (int32 PC = 0; PC < Code.Num(); ++PC)
        {
            const FHktVInst& V = Code[PC];

            // 종결 명령은 fall-through 없음
            if (!IsTerminator(V.Op))
            {
                if (PC + 1 < Code.Num())
                {
                    CFG.Successors[PC].Add(PC + 1);
                }
            }

            // 점프류
            if (V.Op == EOpCode::Jump)
            {
                const int32 Target = ExtractJumpTarget(V);
                if (Target >= 0 && Target < Code.Num())
                {
                    CFG.Successors[PC].Add(Target);
                }
            }
            else if (V.Op == EOpCode::JumpIf || V.Op == EOpCode::JumpIfNot)
            {
                const int32 Target = ExtractJumpTarget(V);
                if (Target >= 0 && Target < Code.Num())
                {
                    // 이미 fall-through 가 추가됨 — Target 은 두 번째 successor
                    CFG.Successors[PC].AddUnique(Target);
                }
            }
        }
        return CFG;
    }

    // ------------------------------------------------------------------
    // Use/Def 추출 — VInst 단위
    // ------------------------------------------------------------------

    void CollectUseDef(const FHktVInst& V, TArray<FHktVRegId, TInlineAllocator<3>>& OutUses,
                       TArray<FHktVRegId, TInlineAllocator<1>>& OutDefs)
    {
        const FOpRegInfo Info = GetOpRegInfo(V.Op);

        // Imm20 인코딩 op 는 src1/src2/imm12 가 모두 immediate — 레지스터 use 아님
        if (!V.bUsesImm20)
        {
            if (Info.Src1 == ERegRole::Read && V.Src1VReg != InvalidVReg) OutUses.Add(V.Src1VReg);
            if (Info.Src2 == ERegRole::Read && V.Src2VReg != InvalidVReg) OutUses.Add(V.Src2VReg);
        }
        if (Info.Dst == ERegRole::Write && V.DstVReg != InvalidVReg) OutDefs.Add(V.DstVReg);
    }

    // ------------------------------------------------------------------
    // Liveness — backward iterative dataflow
    // ------------------------------------------------------------------

    /** VReg 집합을 비트셋으로 표현 — 결정론적 + 빠른 합집합 */
    struct FLiveSet
    {
        TBitArray<> Bits;
        explicit FLiveSet(int32 NumVRegs) { Bits.Init(false, NumVRegs); }

        bool Get(int32 V) const { return Bits[V]; }
        void Set(int32 V) { Bits[V] = true; }
        void Clear(int32 V) { Bits[V] = false; }

        bool UnionWith(const FLiveSet& Other)
        {
            bool bChanged = false;
            const int32 N = Bits.Num();
            for (int32 i = 0; i < N; ++i)
            {
                if (!Bits[i] && Other.Bits[i]) { Bits[i] = true; bChanged = true; }
            }
            return bChanged;
        }

        bool Equals(const FLiveSet& Other) const
        {
            const int32 N = Bits.Num();
            if (N != Other.Bits.Num()) return false;
            for (int32 i = 0; i < N; ++i)
            {
                if (Bits[i] != Other.Bits[i]) return false;
            }
            return true;
        }
    };

    struct FLivenessResult
    {
        TArray<FLiveSet> LiveIn;   // 인스트럭션 진입 시 라이브
        TArray<FLiveSet> LiveOut;  // 인스트럭션 종료 후 라이브
    };

    FLivenessResult ComputeLiveness(const TArray<FHktVInst>& Code, const FCFG& CFG, int32 NumVRegs)
    {
        FLivenessResult R;
        R.LiveIn.Reserve(Code.Num());
        R.LiveOut.Reserve(Code.Num());
        for (int32 i = 0; i < Code.Num(); ++i)
        {
            R.LiveIn.Emplace(NumVRegs);
            R.LiveOut.Emplace(NumVRegs);
        }

        bool bChanged = true;
        int32 Iter = 0;
        const int32 MaxIters = Code.Num() * 4 + 16;  // 안전 상한

        while (bChanged && Iter++ < MaxIters)
        {
            bChanged = false;
            for (int32 PC = Code.Num() - 1; PC >= 0; --PC)
            {
                // live_out[PC] = ∪ live_in[succ]
                FLiveSet NewLiveOut(NumVRegs);
                for (int32 Succ : CFG.Successors[PC])
                {
                    NewLiveOut.UnionWith(R.LiveIn[Succ]);
                }
                if (!NewLiveOut.Equals(R.LiveOut[PC]))
                {
                    R.LiveOut[PC] = MoveTemp(NewLiveOut);
                    bChanged = true;
                }

                // live_in[PC] = use[PC] ∪ (live_out[PC] - def[PC])
                TArray<FHktVRegId, TInlineAllocator<3>> Uses;
                TArray<FHktVRegId, TInlineAllocator<1>> Defs;
                CollectUseDef(Code[PC], Uses, Defs);

                FLiveSet NewLiveIn = R.LiveOut[PC];
                for (FHktVRegId D : Defs) NewLiveIn.Clear(D);
                for (FHktVRegId U : Uses) NewLiveIn.Set(U);

                if (!NewLiveIn.Equals(R.LiveIn[PC]))
                {
                    R.LiveIn[PC] = MoveTemp(NewLiveIn);
                    bChanged = true;
                }
            }
        }
        return R;
    }

    // ------------------------------------------------------------------
    // Live Interval — VReg 단위 [Start, End] (PC 인덱스, 양끝 inclusive)
    // ------------------------------------------------------------------

    struct FInterval
    {
        FHktVRegId VReg = InvalidVReg;
        int32 Start = INT32_MAX;
        int32 End = -1;
        bool bValid() const { return End >= Start; }
    };

    /**
     * VReg 별 라이브 구간 산출 — 정의/사용 PC 와 live_in/live_out 을 모두 반영.
     * 블록 멤버 VReg 의 구간은 자기 자신의 사용 구간이며, 베이스 VReg 는 모든 멤버 구간의 합집합으로 확장된다.
     */
    TArray<FInterval> ComputeIntervals(const TArray<FHktVInst>& Code, const FLivenessResult& Live,
                                       const TArray<FHktVRegMeta>& Metas)
    {
        const int32 NumV = Metas.Num();
        TArray<FInterval> Intervals;
        Intervals.SetNum(NumV);
        for (int32 v = 0; v < NumV; ++v) Intervals[v].VReg = v;

        auto Touch = [&](FHktVRegId V, int32 PC)
        {
            FInterval& I = Intervals[V];
            if (PC < I.Start) I.Start = PC;
            if (PC > I.End) I.End = PC;
        };

        for (int32 PC = 0; PC < Code.Num(); ++PC)
        {
            // Use/Def 직접 사용 PC
            TArray<FHktVRegId, TInlineAllocator<3>> Uses;
            TArray<FHktVRegId, TInlineAllocator<1>> Defs;
            CollectUseDef(Code[PC], Uses, Defs);
            for (FHktVRegId U : Uses) Touch(U, PC);
            for (FHktVRegId D : Defs) Touch(D, PC);

            // live_in/live_out 으로 분기 너머의 라이브니스 반영
            const int32 NumBits = Live.LiveIn[PC].Bits.Num();
            for (int32 i = 0; i < NumBits; ++i)
            {
                if (Live.LiveIn[PC].Bits[i]) Touch(i, PC);
                if (Live.LiveOut[PC].Bits[i]) Touch(i, PC);
            }
        }

        // 블록 베이스의 구간을 모든 멤버 구간으로 확장 — 베이스가 N 연속 reg 를 점유하기 위해 필요
        for (int32 v = 0; v < NumV; ++v)
        {
            const FHktVRegMeta& M = Metas[v];
            if (M.BlockBaseVReg >= 0 && Intervals[v].bValid())
            {
                FInterval& Base = Intervals[M.BlockBaseVReg];
                if (Intervals[v].Start < Base.Start) Base.Start = Intervals[v].Start;
                if (Intervals[v].End > Base.End) Base.End = Intervals[v].End;
            }
        }
        return Intervals;
    }

    // ------------------------------------------------------------------
    // Linear-Scan 할당
    // ------------------------------------------------------------------

    struct FAllocCtx
    {
        // 각 PC 시점에서 점유된 물리 레지스터 비트마스크 (16비트 — R0..R15)
        TArray<uint16> OccupiedAt;

        void Init(int32 NumPCs) { OccupiedAt.Init(0, NumPCs); }

        bool IsFree(int32 Phys, int32 Start, int32 End) const
        {
            for (int32 PC = Start; PC <= End; ++PC)
            {
                if (OccupiedAt[PC] & (1 << Phys)) return false;
            }
            return true;
        }

        bool IsRangeFree(int32 BasePhys, int32 Count, int32 Start, int32 End) const
        {
            for (int32 i = 0; i < Count; ++i)
            {
                if (!IsFree(BasePhys + i, Start, End)) return false;
            }
            return true;
        }

        void Reserve(int32 Phys, int32 Start, int32 End)
        {
            for (int32 PC = Start; PC <= End; ++PC)
            {
                OccupiedAt[PC] |= (1 << Phys);
            }
        }

        void ReserveRange(int32 BasePhys, int32 Count, int32 Start, int32 End)
        {
            for (int32 i = 0; i < Count; ++i)
            {
                Reserve(BasePhys + i, Start, End);
            }
        }
    };

    /** 충돌 시점의 활성 VReg 진단 메시지 생성 */
    FString BuildConflictDiagnostic(int32 PC, const TArray<FHktVRegMeta>& Metas, const FLivenessResult& Live)
    {
        TArray<int32> ActiveVRegs;
        const int32 NumBits = Live.LiveOut[PC].Bits.Num();
        for (int32 i = 0; i < NumBits; ++i)
        {
            if (Live.LiveOut[PC].Bits[i]) ActiveVRegs.Add(i);
        }
        ActiveVRegs.Sort();

        FString Msg = FString::Printf(TEXT("PC=%d: GP 레지스터 고갈 — 동시 활성 VReg ["), PC);
        for (int32 i = 0; i < ActiveVRegs.Num(); ++i)
        {
            const int32 V = ActiveVRegs[i];
            const FHktVRegMeta& M = Metas[V];
            Msg += (i == 0 ? TEXT("") : TEXT(", "));
            if (!M.DebugName.IsEmpty())
            {
                Msg += FString::Printf(TEXT("v%d:%s"), V, *M.DebugName);
            }
            else if (M.PinnedPhysical >= 0)
            {
                Msg += FString::Printf(TEXT("v%d:R%d"), V, M.PinnedPhysical);
            }
            else
            {
                Msg += FString::Printf(TEXT("v%d:anon"), V);
            }
        }
        Msg += TEXT("]");
        return Msg;
    }

} // namespace

namespace HktVRegAlloc
{

bool Allocate(FCodeSection& Section, const FGameplayTag& StoryTag, TArray<FString>& OutErrors)
{
    // 단계 0: 바로가기 — pre-colored 만 있으면 변경 없음 (byte-identical 보장)
    if (Section.RegPool.AllPreColored())
    {
        return true;
    }

    const int32 NumV = Section.RegPool.Metas.Num();
    if (NumV == 0)
    {
        return true;
    }

    // 단계 1: CFG + Liveness
    const FCFG CFG = BuildCFG(Section.Code);
    const FLivenessResult Live = ComputeLiveness(Section.Code, CFG, NumV);

    // 단계 2: Live Interval
    TArray<FInterval> Intervals = ComputeIntervals(Section.Code, Live, Section.RegPool.Metas);

    // 단계 3: pre-colored 점유를 미리 OccupiedAt 에 표시
    FAllocCtx Ctx;
    Ctx.Init(Section.Code.Num());
    for (int32 v = 0; v < NumV; ++v)
    {
        const FHktVRegMeta& M = Section.RegPool.Metas[v];
        if (M.PinnedPhysical >= 0 && Intervals[v].bValid())
        {
            Ctx.Reserve(M.PinnedPhysical, Intervals[v].Start, Intervals[v].End);
        }
    }

    // 단계 4: 할당 대상 = anonymous 베이스(블록 베이스 포함, 멤버 제외).
    // 정렬: Start 오름차순, tie-break VReg ID 오름차순 (결정론).
    struct FAllocCandidate { int32 VReg; int32 Start; };
    TArray<FAllocCandidate> Cands;
    for (int32 v = 0; v < NumV; ++v)
    {
        const FHktVRegMeta& M = Section.RegPool.Metas[v];
        if (M.PinnedPhysical < 0 && M.BlockBaseVReg < 0 && Intervals[v].bValid())
        {
            // anonymous 단일 또는 anonymous 블록 베이스
            Cands.Add({v, Intervals[v].Start});
        }
    }
    Cands.Sort([](const FAllocCandidate& A, const FAllocCandidate& B)
    {
        if (A.Start != B.Start) return A.Start < B.Start;
        return A.VReg < B.VReg;
    });

    // 단계 5: 각 후보에 GP 레지스터 배정
    for (const FAllocCandidate& C : Cands)
    {
        const FInterval& I = Intervals[C.VReg];
        FHktVRegMeta& Meta = Section.RegPool.Metas[C.VReg];
        const int32 BlockSize = Meta.bIsBlockBase ? Meta.BlockSize : 1;

        // GP 범위(R0..R9) 내에서 첫 적합 영역 탐색 — first-fit (low-index 우선) — 결정론
        int32 ChosenBase = -1;
        for (int32 P = GPLow; P <= GPHigh - BlockSize + 1; ++P)
        {
            if (Ctx.IsRangeFree(P, BlockSize, I.Start, I.End))
            {
                ChosenBase = P;
                break;
            }
        }

        if (ChosenBase < 0)
        {
            OutErrors.Add(FString::Printf(
                TEXT("Story '%s': %s — VReg v%d (%s, size=%d) 배정 실패. %s"),
                *StoryTag.ToString(),
                BlockSize > 1 ? TEXT("연속 GP 레지스터 영역 확보 실패") : TEXT("GP 레지스터 고갈"),
                C.VReg,
                Meta.DebugName.IsEmpty() ? TEXT("anon") : *Meta.DebugName,
                BlockSize,
                *BuildConflictDiagnostic(I.Start, Section.RegPool.Metas, Live)));
            return false;
        }

        // 점유 표시 + 결과 기록
        Ctx.ReserveRange(ChosenBase, BlockSize, I.Start, I.End);
        Meta.PinnedPhysical = ChosenBase;
    }

    // 검증: 모든 anonymous 가 0..9 범위에 핀되었는지 (블록 멤버는 ResolvePhysical 이 base+offset 으로 자동 해소)
    for (int32 v = 0; v < NumV; ++v)
    {
        const FHktVRegMeta& M = Section.RegPool.Metas[v];
        if (M.BlockBaseVReg >= 0) continue;  // 멤버는 베이스를 통해 해소됨
        if (M.PinnedPhysical < 0)
        {
            // 미참조 anonymous (Interval 비유효) — 실제 사용되지 않는 dead VReg.
            // 안전한 대체로 R0 에 핀하거나 그대로 두어도 무방하지만, 명시적으로 R0 부여.
            // 그 VReg 가 실제 emit 되는 일은 없으므로(인스트럭션에 등장하지 않음) bytecode 에 영향 없음.
            FHktVRegMeta& Mut = Section.RegPool.Metas[v];
            Mut.PinnedPhysical = 0;
        }
    }
    return true;
}

} // namespace HktVRegAlloc
