// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

class UHktTerrainStyleSet;
class UHktVoxelTileAtlas;
class UHktVoxelMaterialLUT;

/**
 * UHktTerrainStyleSet → Voxel 렌더 어셋(TileAtlas + MaterialLUT) 적용 헬퍼.
 *
 * StyleSet 자산은 렌더러 비종속 (HktTerrain 모듈에 위치) 이므로, Voxel 측 변환은
 * 본 free function 으로 분리되어 있다. Sprite 경로(PR-D)는 별도 어댑터 사용.
 *
 * 주입 작업:
 *   1. StyleSet->TileArray / NormalArray 핸들을 Atlas 에 직결 — DDC 컴파일 미경유
 *   2. TypeID → 슬라이스 매핑을 Atlas 에 푸시 + 인덱스 LUT 빌드
 *   3. PBR 엔트리를 MaterialLUT 에 푸시 + LUT 빌드
 *
 * Atlas 가 nullptr 이면 전체 작업을 스킵 + 경고 로그.
 * MaterialLUT 가 nullptr 이면 PBR 부분만 스킵 (Atlas 적용은 진행).
 */
HKTVOXELTERRAIN_API void HktApplyTerrainStyleSetToVoxelAtlas(
	const UHktTerrainStyleSet* StyleSet,
	UHktVoxelTileAtlas* Atlas,
	UHktVoxelMaterialLUT* MaterialLUT);
