// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

struct FHktVMRuntime;

// ============================================================================
// HktVMExecTrace — VM 실행 추적 (진단 전용)
//
// opcode 처리 중 무효 엔티티 등으로 ensure 가 걸렸을 때 "어느 Story 의 어느
// opcode(PC/소스 라인)" 에서 발생했는지 + 레지스터/엔티티 스냅샷을 메시지에
// 첨부하기 위한 경량 추적기. 시뮬레이션 상태가 아닌 순수 진단 상태이므로
// 결정론(롤백 재실행 포함)에 영향이 없다.
//
// DO_ENSURE 빌드(보통 비-Shipping)에서만 활성 — ensure 가 실제로 컴파일되는
// 빌드와 정확히 일치시킨다. Shipping 에서는 전부 no-op 이라 런타임 비용 0.
//
// 비용: Execute()/ExecutePrecondition() 호출당 RAII 스코프 1개(thread-local
// 포인터 1회 write + 복원). 인스트럭션 디스패치 루프 내부에는 추가 비용이 없다.
// ============================================================================

namespace HktVMExecTrace
{
#if DO_ENSURE
    // 현재 실행 중인 VM 을 가리키는 진단 스코프. precondition 등 중첩 실행을 위해
    // 이전 스코프를 보존하는 링크드 스택으로 동작한다.
    struct FScope
    {
        const FHktVMRuntime* Runtime;
        const FScope* Prev;

        explicit FScope(const FHktVMRuntime& InRuntime);
        ~FScope();
    };

    // 현재 추적 컨텍스트 설명 문자열. VM 실행 밖이면 안내 문자열을 반환한다.
    // ensure 실패 경로에서만 호출되므로 FString 빌드 비용은 핫패스에 없다.
    FString DescribeCurrent();

    #define HKT_VM_TRACE_SCOPE(RuntimeRef) const HktVMExecTrace::FScope HktVMTraceScope_((RuntimeRef))
#else
    FORCEINLINE FString DescribeCurrent() { return FString(); }

    #define HKT_VM_TRACE_SCOPE(RuntimeRef) ((void)0)
#endif
}
