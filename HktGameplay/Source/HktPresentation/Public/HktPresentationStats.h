// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "Stats/Stats.h"

// ============================================================================
// HktPresentation Stats Group — `stat HktPresentation` 로 활성화
// ----------------------------------------------------------------------------
// WorldView 수신 → Diff 적용 → Processor Tick/Sync → Actor Transform 적용 까지의
// 클라 프레임 비용을 측정한다. 엔티티 수 증가 시 어느 단계(Diff vs Actor sync vs
// VFX) 가 비싼지 빠르게 식별 가능.
// ============================================================================

DECLARE_STATS_GROUP(TEXT("HktPresentation"), STATGROUP_HktPresentation, STATCAT_Advanced);
