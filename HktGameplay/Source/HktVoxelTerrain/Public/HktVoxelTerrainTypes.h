// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

// 본 헤더의 정의(EHktTerrainType)는 HktTerrain 모듈로 이동되어
// HktTerrain/Public/HktTerrainVoxelTypes.h 에 단일 출처로 존재한다.
// 기존 includes 호환을 위해 본 위치는 얇은 re-export shim 으로 남긴다.
//
// 이전 별도 존재했던 `HktTerrainType` (uint16 constexpr) / `HktTerrainPalette`
// (uint8 constexpr) 네임스페이스는 실사용처가 없어 제거 — EHktTerrainType 단일화.

#include "HktTerrainVoxelTypes.h"
