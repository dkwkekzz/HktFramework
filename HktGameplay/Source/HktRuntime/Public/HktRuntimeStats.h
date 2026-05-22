// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "Stats/Stats.h"

// ============================================================================
// HktRuntime Stats Group — `stat HktRuntime` 로 활성화
// ----------------------------------------------------------------------------
// 서버 GameMode 시뮬레이션 틱 / 클라 Proxy 예측 + 롤백 / PlayerController WorldView
// 브로드캐스트 등 런타임 경계 비용을 측정한다.
// ============================================================================

DECLARE_STATS_GROUP(TEXT("HktRuntime"), STATGROUP_HktRuntime, STATCAT_Advanced);
