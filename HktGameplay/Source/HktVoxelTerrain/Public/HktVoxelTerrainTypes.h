// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

// 본 헤더의 정의(HktTerrainType / EHktTerrainType / HktTerrainPalette)는 HktTerrain 모듈로
// 이동되어 HktTerrain/Public/HktTerrainVoxelTypes.h 에 단일 출처로 존재한다.
// 기존 includes 호환을 위해 본 위치는 얇은 re-export shim 으로 남긴다.
//
// 이전: HktVoxelTerrain 만 enum 을 소유 → HktTerrain 에서 사용할 수 없음 (의존 역전).
// 현재: HktTerrain 이 enum 을 소유 → HktVoxelTerrain (HktTerrain 의존) 이 자연히 접근 가능.

#include "HktTerrainVoxelTypes.h"
