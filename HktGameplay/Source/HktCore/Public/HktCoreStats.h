// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "Stats/Stats.h"

// ============================================================================
// HktCore Stats Group — `stat HktCore` 로 활성화
// ----------------------------------------------------------------------------
// 결정론 시뮬레이션 (HktWorldDeterminismSimulator) 의 각 시스템 / VM 실행 비용을
// SCOPE_CYCLE_COUNTER 로 측정한다. 엔티티 수가 증가할 때 어느 시스템이 병목인지
// 즉시 식별할 수 있도록 시스템별 / 페이즈별로 분리.
//
// 측정 단위는 CycleCounter (ms) — `stat HktCore` 또는 Unreal Insights /
// 외부 프로파일러(`-trace=cpu`) 에서 시각화 가능.
// ============================================================================

DECLARE_STATS_GROUP(TEXT("HktCore"), STATGROUP_HktCore, STATCAT_Advanced);
