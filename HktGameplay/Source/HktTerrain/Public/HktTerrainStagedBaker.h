// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktTerrainStagedBaker.generated.h"

/**
 * FHktTerrainThemeSpec — Stage 0 (Theme Spec) 의 선언적 노브.
 *
 * I-0049 "테마 기반 cell×step 절차적 지형 베이크" 의 입력. 하나의 *주제* 를 주면
 * 세계가 그 주제에 맞게 펼쳐진다. 본 구조체는 설계 §5 Stage 0 의 첫 컷 — 시각적
 * 그럴듯함에 필요한 노브만 추린다(위도/강수/대륙성/산맥/침식).
 *
 * 결정론 불필요(D1): 본 베이커는 float 로 계산한다. 동일 입력은 동일 바이너리에서
 * 동일 결과지만, 그 보장에 시뮬레이션이 의존하지 않는다 — baked 정본이 정답이다.
 */
USTRUCT(BlueprintType)
struct HKTTERRAIN_API FHktTerrainThemeSpec
{
	GENERATED_BODY()

	/** 마스터 시드. 모든 step 의 서브시드가 여기서 파생된다. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Theme")
	int64 Seed = 1337;

	/** 대륙성 [0,1]. 0 = 거의 바다, 1 = 거의 육지. 해안선/육지 비율을 좌우. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Theme", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float Continentality = 0.55f;

	/** 해수면 (정규화 고도 [0,1]). elev01 이 이 값 이하면 바다. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Theme", meta = (ClampMin = "0.05", ClampMax = "0.9"))
	float SeaLevel = 0.40f;

	/** 산맥 강도 [0,1]. 클수록 능선이 높고 잦다. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Theme", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float Mountainousness = 0.6f;

	/** 침식 강도 [0,1]. 0 = 침식 패스 건너뜀. 하천형 계곡을 깎아 자연스러움을 더한다. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Theme", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float ErosionStrength = 0.5f;

	/** 강수 경향 [0,1]. 클수록 습윤 바이옴(숲/늪) 비중이 커진다. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Theme", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float Precipitation = 0.5f;

	/** 한랭 편향 [0,1]. 클수록 툰드라/타이가/설원 비중이 커진다. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Theme", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float Coldness = 0.45f;

	/** 대륙 피처의 공간 파장 (버텍스 단위). 클수록 대륙이 커진다. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Theme|Scale", meta = (ClampMin = "64.0"))
	float ContinentWavelength = 1024.f;

	/** 산맥 피처의 공간 파장 (버텍스 단위). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Theme|Scale", meta = (ClampMin = "32.0"))
	float MountainWavelength = 320.f;
};

/**
 * FHktTerrainBakeField — 스테이지드 베이커의 (인메모리) 산출물.
 *
 * 설계의 heightfield-canonical(D3) 첫 컷: 한 영역(현재는 Landscape 그리드 전체)에 대해
 * 정규화 고도 + 바이옴 ID 를 row-major(Idx = X + Y*Width) 로 담는다. 파일 영속화(§3.2)는
 * 후속 — 지금은 호출자(AHktLandscapeTerrainActor)가 곧바로 소비한다.
 */
struct FHktTerrainBakeField
{
	int32 Width = 0;
	int32 Height = 0;

	/** 해수면 (정규화). 호출자가 바이옴/머티리얼 경계에 참조. */
	float SeaLevel01 = 0.f;

	/** 정규화 고도 [0,1]. row-major. */
	TArray<float> Elevation;

	/** 바이옴 ID — EHktAdvBiome 값을 uint8 로 캐스트. row-major. */
	TArray<uint8> BiomeId;

	float ElevationAt(int32 X, int32 Y) const { return Elevation[X + Y * Width]; }
	uint8 BiomeAt(int32 X, int32 Y) const { return BiomeId[X + Y * Width]; }
};

/**
 * FHktTerrainStagedBaker — 테마 기반 cell×step 파이프라인의 *저작(Baker)* 첫 컷.
 *
 * 시각적으로 그럴듯한 지형에 필요한 step 만 구현한다(설계 §5):
 *   Stage 1  Macro Climate    — 위도/강수/대륙성 저주파 필드 (월드좌표 함수)
 *   Stage 2  Tectonic Skeleton — 대륙 마스크 + 산맥 능선장
 *   Stage 3  Base Heightfield  — 골격 위 노이즈 누적 → 정규화 고도
 *   Stage 4  Erosion           — 물방울 침식으로 하천형 계곡 카빙
 *   Stage 5  Biome Painter     — 기후 + 고도 + 경사 → 바이옴 ID
 *
 * Landmark/Scatter/Evaluator(Stage 6~8)는 시각 그럴듯함의 최소 집합 밖이므로 후속.
 *
 * 순수 C++ (UObject 0). float 기반(D1) — 결정론 의존 없음. cell 타일링/halo 는 후속이며,
 * 현재는 한 영역을 통째로 베이크한다(연속 영역이라 seam 문제 없음).
 */
class HKTTERRAIN_API FHktTerrainStagedBaker
{
public:
	explicit FHktTerrainStagedBaker(const FHktTerrainThemeSpec& InTheme);

	/**
	 * 월드 버텍스 영역을 베이크한다. (OriginX,OriginY) = 좌하단 버텍스의 월드 좌표
	 * (버텍스 1개 = 월드 복셀 1개 가정 — Landscape 경로와 동일), W×H 버텍스.
	 * 고도는 월드좌표의 함수이므로 영역을 옮겨도 같은 좌표는 같은 결과를 낸다.
	 */
	void BakeRegion(int32 OriginX, int32 OriginY, int32 W, int32 H, FHktTerrainBakeField& Out) const;

private:
	FHktTerrainThemeSpec Theme;
};
