// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Terrain/HktFixed32.h"

/**
 * FHktTerrainGeneratorConfig
 *
 * 지형 생성 파라미터 (POD). 시드 + 지형 형태 + 수면 높이 등을 정의한다.
 * 모든 연속 값은 FHktFixed32 (Q16.16) — 결정론 보장.
 *
 * 이 헤더는 HktCore 잔류본이다. 이전에는 HktTerrainGenerator.h 에 포함돼 있었으나,
 * 생성기 일체가 HktTerrain 모듈로 이관되면서 Config POD 만 HktCore 에 남겼다.
 *  - HktCoreSimulator / IHktServerRuleInterface 가 Config 를 인자로 받기 때문에 HktCore 잔류 필요.
 *  - 생성기 자체는 `HktTerrain/Public/HktTerrainGenerator.h` 의 `FHktTerrainGenerator` 가 소유.
 *
 * bAdvancedTerrain = true 시 고급 다층 파이프라인 활성화:
 *   Layer 0 시드 → Layer 1 기후 → Layer 1.5 대륙 → Layer 2 바이옴
 *   → Layer 2.5 이상 바이옴 → Layer 3 채우기 → Layer 4 랜드마크 → Layer 5 데코
 */
struct HKTCORE_API FHktTerrainGeneratorConfig
{
	using Fixed = FHktFixed32;

	int64 Seed = 42;

	// ─── 고급 지형 생성 모드 ───
	bool bAdvancedTerrain = false;
	bool bAdvEnableSubsurfaceOre  = true;   // Layer 5a — 지하 광석
	bool bAdvEnableSurfaceScatter = true;   // Layer 5b — 나무/꽃 등 표면 데코
	uint32 Epoch = 0;

	// 지형 형태
	Fixed HeightScale     = Fixed::FromRaw(64 * 65536);    // 64.0
	Fixed HeightOffset    = Fixed::FromRaw(32 * 65536);    // 32.0
	Fixed TerrainFreq     = Fixed::FromRaw(524);           // 0.008 * 65536 ≈ 524
	int32 TerrainOctaves  = 6;
	Fixed Lacunarity      = Fixed::FromRaw(2 * 65536);     // 2.0
	Fixed Persistence     = Fixed::FromRaw(32768);          // 0.5

	// 산악
	Fixed MountainFreq    = Fixed::FromRaw(262);           // 0.004 * 65536 ≈ 262
	Fixed MountainBlend   = Fixed::FromRaw(26214);         // 0.4 * 65536 ≈ 26214

	// 수면
	Fixed WaterLevel      = Fixed::FromRaw(30 * 65536);    // 30.0

	// 동굴
	bool  bEnableCaves    = true;
	Fixed CaveFreq        = Fixed::FromRaw(1966);          // 0.03 * 65536 ≈ 1966
	Fixed CaveThreshold   = Fixed::FromRaw(39322);         // 0.6 * 65536 ≈ 39322

	// 바이옴
	Fixed BiomeNoiseScale = Fixed::FromRaw(131);           // 0.002 * 65536 ≈ 131
	Fixed MountainBiomeThreshold = Fixed::FromRaw(80 * 65536); // 80.0

	// 복셀 1개의 월드 크기 (cm). HktVoxelCore / HktCore / 디버그 렌더러 등
	// 프레임워크 전체가 이 값을 단일 출처로 사용한다.
	float VoxelSizeCm = 15.0f;

	// 월드 경계 (Z축 청크 좌표). 시뮬레이션과 렌더가 공유.
	int32 HeightMinZ = 0;
	int32 HeightMaxZ = 3;

	// 시뮬레이션 청크 스트리밍 파라미터.
	// 렌더러의 스트리밍 설정과 독립되어 있으며, `FHktTerrainSystem::Process`가 사용.
	int32 SimLoadRadiusXY          = 2;
	int32 SimLoadRadiusZ           = 1;
	int32 SimMaxChunksLoaded       = 256;
	int32 SimMaxChunkLoadsPerFrame = 4;

	// 청크 크기 (HktVoxelCore와 동일)
	static constexpr int32 ChunkSize = 32;
};
