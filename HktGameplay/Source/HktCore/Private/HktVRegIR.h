// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktStoryTypes.h"

// ============================================================================
// HktVRegIR — Builder 내부 가상 레지스터 IR (Stage 1 스캐폴딩)
//
// 목표: SSA 스타일 가상 레지스터 도입의 기반 IR. 단계 1에서는 모든 VReg가
// pre-colored(고정 물리 레지스터에 핀)되며, 출력 바이트코드는 변경 전과
// byte-identical이다. 단계 2에서 anonymous VReg + linear-scan 할당기가 도입된다.
//
// 결정론: 모든 컬렉션은 TArray만 사용 (Map iteration 비의존). VReg ID는
// 생성 순서로 부여되며 외부 비교/정렬에 안전하다.
// ============================================================================

/** 가상 레지스터 ID — -1은 미할당 */
using FHktVRegId = int32;
constexpr FHktVRegId InvalidVReg = -1;

/**
 * FHktVInst — 가상 인스트럭션
 *
 * 단계 1에서는 FInstruction의 레이아웃을 1:1로 보존하기 위해 raw 필드를
 * 그대로 담는다. 동시에 각 register-role 필드에 대응하는 VReg ID도 보관하여
 * 단계 2에서 할당기가 anonymous VReg를 핀 처리할 때 활용한다.
 *
 * 라벨/픽스업 메타데이터는 단계 1에서는 instruction 인덱스 기반의
 * 별도 컬렉션이 그대로 진실의 원천이며, 본 구조체의 LabelKey/bIs* 필드는
 * 단계 2 확장을 위한 자리 표시자다.
 */
struct FHktVInst
{
    EOpCode Op = EOpCode::Nop;

    // FInstruction 인코딩 보존 — 출력 바이트코드의 원본 단원천(source of truth)
    uint8 DstField = 0;     // 0..15
    uint8 Src1Field = 0;    // 0..15
    uint8 Src2Field = 0;    // 0..15
    uint16 Imm12Field = 0;  // 12-bit immediate
    int32 Imm20Field = 0;   // 20-bit immediate (signed)
    bool bUsesImm20 = false;

    // VReg 추적 — 단계 1: 단순 pre-colored 매핑. 단계 2: 할당기 입력.
    FHktVRegId DstVReg = InvalidVReg;
    FHktVRegId Src1VReg = InvalidVReg;
    FHktVRegId Src2VReg = InvalidVReg;

    // 라벨/픽스업 — 단계 1에서는 미사용 (FCodeSection의 Fixups가 진실의 원천).
    // 단계 2에서 라벨을 VInst 단위로 흡수할 때 사용한다.
    int32 LabelKey = 0;
    bool bIsLabel = false;
    bool bIsJumpFixup = false;
};

/**
 * FHktVRegMeta — VReg 단일 항목 메타데이터
 *
 * 단계 1에서 모든 VReg는 PinnedPhysical >= 0 (고정 핀)이다.
 * 단계 2에서 PinnedPhysical = -1 인 anonymous VReg가 도입되며,
 * FirstDef/LastUse를 기반으로 linear-scan 할당이 이루어진다.
 */
struct FHktVRegMeta
{
    int32 PinnedPhysical = -1;       // 0..15 = pre-colored, -1 = anonymous
    bool bIsBlockBase = false;       // 연속 블록의 base 인지 여부
    int32 BlockSize = 1;             // 블록 크기 (1 = 단일 레지스터)
    int32 FirstDef = INT32_MAX;      // 최초 정의된 VInst 인덱스
    int32 LastUse = -1;              // 마지막 사용 VInst 인덱스
};

/**
 * FHktVRegPool — Builder 단위 VReg 컨테이너
 *
 * 모든 VReg는 여기에 등록되며 ID는 생성 순서대로 부여된다.
 * 단계 1: 같은 물리 레지스터에 대한 요청은 같은 VReg를 재사용한다
 * (fluent 코드에서 R0를 여러 번 쓰는 패턴 지원).
 */
struct FHktVRegPool
{
    TArray<FHktVRegMeta> Metas;

    // 물리 레지스터 0..15 → VReg ID 매핑 (단계 1 영구 pre-colored)
    static constexpr int32 NumPhysicalRegs = 16;
    FHktVRegId PhysicalToVReg[NumPhysicalRegs] = {
        InvalidVReg, InvalidVReg, InvalidVReg, InvalidVReg,
        InvalidVReg, InvalidVReg, InvalidVReg, InvalidVReg,
        InvalidVReg, InvalidVReg, InvalidVReg, InvalidVReg,
        InvalidVReg, InvalidVReg, InvalidVReg, InvalidVReg,
    };

    /** 물리 레지스터를 위한 pre-colored VReg를 lazy하게 1회만 생성/반환 */
    FHktVRegId EnsurePinned(uint8 PhysicalIndex)
    {
        check(PhysicalIndex < NumPhysicalRegs);
        if (PhysicalToVReg[PhysicalIndex] == InvalidVReg)
        {
            FHktVRegMeta Meta;
            Meta.PinnedPhysical = static_cast<int32>(PhysicalIndex);
            const FHktVRegId Id = Metas.Add(Meta);
            PhysicalToVReg[PhysicalIndex] = Id;
        }
        return PhysicalToVReg[PhysicalIndex];
    }

    /** VReg → 물리 레지스터 인덱스 (-1이면 미할당) */
    int32 ResolvePhysical(FHktVRegId Id) const
    {
        if (Id == InvalidVReg) return -1;
        check(Id >= 0 && Id < Metas.Num());
        return Metas[Id].PinnedPhysical;
    }
};

// ============================================================================
// 인코딩 헬퍼
// ============================================================================

/** 주어진 OpCode가 FInstruction::MakeImm (Imm20 인코딩)을 사용하는지 판단 */
inline bool HktVReg_OpUsesImm20(EOpCode Op)
{
    switch (Op)
    {
    case EOpCode::LoadConst:
    case EOpCode::Jump:
    case EOpCode::YieldSeconds:
    case EOpCode::PlaySound:
    case EOpCode::DispatchEvent:
    case EOpCode::DispatchEventTo:
    case EOpCode::DispatchEventFrom:
    case EOpCode::Log:
        return true;
    default:
        return false;
    }
}

/** FInstruction → FHktVInst (raw 필드 보존 + 단계 1: pre-colored VReg 매핑) */
inline FHktVInst HktVReg_FromInstruction(const FInstruction& Inst, FHktVRegPool& Pool)
{
    FHktVInst V;
    V.Op = Inst.GetOpCode();
    V.DstField = static_cast<uint8>(Inst.Dst);
    V.Src1Field = static_cast<uint8>(Inst.Src1);
    V.Src2Field = static_cast<uint8>(Inst.Src2);
    V.Imm12Field = static_cast<uint16>(Inst.Imm12);
    V.bUsesImm20 = HktVReg_OpUsesImm20(V.Op);
    if (V.bUsesImm20)
    {
        V.Imm20Field = Inst.GetSignedImm20();
    }

    // 단계 1: GetOpRegInfo가 register라고 명시한 필드만 VReg로 매핑.
    // (DispatchEventTo/From의 Dst-as-register 같은 메타데이터 불일치는
    //  단계 1에서는 무시 — raw 필드가 출력의 진실이므로 byte-identical 보장.)
    const FOpRegInfo Info = GetOpRegInfo(V.Op);
    if (Info.Dst != ERegRole::None)
    {
        V.DstVReg = Pool.EnsurePinned(V.DstField);
    }
    // Imm20 인코딩은 Src1/Src2/Imm12 비트가 모두 immediate 의 일부다 — 레지스터 매핑 금지.
    if (!V.bUsesImm20)
    {
        if (Info.Src1 != ERegRole::None)
        {
            V.Src1VReg = Pool.EnsurePinned(V.Src1Field);
        }
        if (Info.Src2 != ERegRole::None)
        {
            V.Src2VReg = Pool.EnsurePinned(V.Src2Field);
        }
    }
    return V;
}

// ============================================================================
// FCodeSection — Builder 내부 코드 섹션 (Main / Precondition 공용)
//
// 이전에는 HktStoryBuilder.h(public)에 정의되어 있었으나, FHktVInst를
// 멤버로 갖게 되면서 private 헤더로 이동했다. Builder는 Pimpl로 보유한다.
// ============================================================================

struct FCodeSection
{
    TArray<FHktVInst> Code;
    TArray<int32> Constants;
    TArray<FString> Strings;
    TMap<FName, int32> Labels;
    TArray<TPair<int32, FName>> Fixups;

    // 정수 키 라벨 — 자동 생성 라벨용 (힙할당 없음)
    TMap<int32, int32> IntLabels;
    TArray<TPair<int32, int32>> IntFixups;

    // 단계 1: 섹션별 VReg 풀. 단계 2에서 anonymous VReg가 추가될 때 확장.
    FHktVRegPool RegPool;
};

/** FHktVInst → FInstruction (단계 1: raw 필드를 그대로 인코딩 → byte-identical) */
inline FInstruction HktVReg_ToInstruction(const FHktVInst& V, const FHktVRegPool& Pool)
{
    // 단계 1에서는 모든 VReg가 pre-colored이므로 raw field가 항상 정답이다.
    // 단계 2에서 anonymous VReg가 도입되면 여기서 Pool.ResolvePhysical()으로
    // 해소된 물리 인덱스를 raw field 대신 사용하게 된다.
    uint8 OutDst = V.DstField;
    uint8 OutSrc1 = V.Src1Field;
    uint8 OutSrc2 = V.Src2Field;
    if (V.DstVReg != InvalidVReg)
    {
        const int32 P = Pool.ResolvePhysical(V.DstVReg);
        if (P >= 0) OutDst = static_cast<uint8>(P);
    }
    if (V.Src1VReg != InvalidVReg)
    {
        const int32 P = Pool.ResolvePhysical(V.Src1VReg);
        if (P >= 0) OutSrc1 = static_cast<uint8>(P);
    }
    if (V.Src2VReg != InvalidVReg)
    {
        const int32 P = Pool.ResolvePhysical(V.Src2VReg);
        if (P >= 0) OutSrc2 = static_cast<uint8>(P);
    }

    if (V.bUsesImm20)
    {
        // MakeImm 경로: Dst nibble + Imm20
        return FInstruction::MakeImm(V.Op, OutDst, V.Imm20Field);
    }
    return FInstruction::Make(V.Op, OutDst, OutSrc1, OutSrc2, V.Imm12Field);
}
