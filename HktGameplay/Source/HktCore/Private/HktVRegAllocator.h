// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
#include "HktVRegIR.h"

// ============================================================================
// HktVRegAllocator — Liveness 분석 + Linear-Scan 할당기 (단계 2)
//
// 역할:
//   - FCodeSection 내 anonymous VReg 들에 물리 레지스터(0..9)를 결정론적으로 배정.
//   - pre-colored VReg(고정 핀)는 그 핀을 그대로 유지하며 anonymous 와 충돌 시 anonymous 가 회피.
//   - 블록 VReg(연속 N개)는 best-fit 으로 N개 연속 영역을 확보.
//
// byte-identical 보장:
//   - 입력에 anonymous VReg 가 하나도 없으면 (FHktVRegPool::AllPreColored()==true)
//     할당기는 즉시 반환하며 출력 바이트코드는 PR-1과 동일.
//
// 결정론:
//   - 모든 컬렉션은 TArray만 사용. Map iteration 의존 없음.
//   - 정렬 tie-break는 VReg ID 오름차순.
//
// 실패 시:
//   - 동시 활성 GP 레지스터 > 10 인 경우, 충돌 PC 와 그 시점 활성 VReg 집합(이름 포함)을
//     OutErrors 에 기록하고 false 반환. Section 은 변경되지 않은 상태로 유지된다.
// ============================================================================

namespace HktVRegAlloc
{
    /**
     * Section 내 모든 anonymous VReg 에 물리 레지스터(0..9)를 배정한다.
     * 성공 시 Metas[id].PinnedPhysical 이 채워지고 true 반환.
     * 실패 시 OutErrors 에 진단을 누적하고 false 반환 — Section 은 부분 변경 가능 상태가 아닌
     * "no-op 또는 완전 변경" 둘 중 하나로 유지된다(필요한 안전성은 호출자 책임).
     *
     * StoryTag 는 오류 메시지에만 사용된다.
     */
    bool Allocate(FCodeSection& Section, const FGameplayTag& StoryTag, TArray<FString>& OutErrors);
}
