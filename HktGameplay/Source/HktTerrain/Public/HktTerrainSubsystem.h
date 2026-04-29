// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "Engine/StreamableManager.h"
#include "Terrain/HktTerrainGeneratorConfig.h"
#include "Terrain/HktTerrainVoxel.h"
#include "HktTerrainBakedAsset.h"
#include "HktTerrainSubsystem.generated.h"

class FHktTerrainGenerator;
struct FHktTerrainPreviewRegion;

/**
 * UHktTerrainSubsystem — 청크 데이터 단일 출처 (월드 단위).
 *
 * 책임:
 *   1. `UHktTerrainBakedAsset` 비동기 로드 + 좌표 매핑
 *   2. 청크 좌표 → `FHktTerrainVoxel` 32768개 배포 (`AcquireChunk`)
 *   3. 베이크 미존재 시 동일 `FHktTerrainGenerator` 로 폴백 + 경고 로그 1회
 *   4. 폴백 결과 in-memory LRU 캐시 (메모리 예산 관리)
 *   5. Top-down 프리뷰 영역 샘플링 (`SamplePreview`)
 *
 * 절대 원칙 (CLAUDE.md):
 *   - 결정론: 베이크 결과와 폴백 결과가 비트 단위 동일해야 함 (Generator 알고리즘 동일).
 *   - 폴백 인자 결정 순서: BakedAsset->GeneratorConfig → ProjectSettings → 컴파일 기본값.
 *
 * 호출자:
 *   - HktVoxelTerrain — Voxel 메싱 입력
 *   - HktSpriteTerrain — 표면 셀 추출
 *   - HktLandscapeTerrain — 프리뷰 샘플링
 *   - HktCore (FHktTerrainProvider 경유) — 시뮬레이션 청크 데이터
 */
UCLASS(BlueprintType)
class HKTTERRAIN_API UHktTerrainSubsystem : public UWorldSubsystem
{
	GENERATED_BODY()

public:
	UHktTerrainSubsystem();

	// USubsystem ------------------------------------------------------------
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;
	// -----------------------------------------------------------------------

	/** 월드에서 서브시스템 가져오기. UWorld* 미존재 시 nullptr. */
	static UHktTerrainSubsystem* Get(const UObject* WorldContext);

	/**
	 * 베이크 자산 비동기 로드. 로드 완료 시까지 폴백 경로만 동작 (정상 케이스).
	 * @param SoftRef    .uasset 의 soft 참조.
	 * @param OnLoaded   완료 콜백 (옵션). 로드 실패 시에도 호출되며 nullptr 전달.
	 */
	void LoadBakedAsset(const TSoftObjectPtr<UHktTerrainBakedAsset>& SoftRef,
	                    TFunction<void(UHktTerrainBakedAsset*)> OnLoaded = nullptr);

	/** 동기 로드 변형 — 에디터 미리보기 등에서 사용. 권장하지 않음. */
	UHktTerrainBakedAsset* LoadBakedAssetSync(const TSoftObjectPtr<UHktTerrainBakedAsset>& SoftRef);

	/**
	 * 청크 데이터 획득.
	 *  1. BakedAsset 에 존재하면 디컴프레스 결과 반환 (LRU 캐시에 보관).
	 *  2. 미존재 시 폴백 경로 — Generator 로 즉시 생성 + 경고 로그 1회 + 캐시.
	 *  3. 폴백 인자 출처를 첫 호출 시 1회 INFO 로그.
	 *
	 * 반환된 포인터는 다음 EvictCache / Subsystem 종료 시까지 유효.
	 * 호출자는 데이터를 32768개 시퀀스로 안전하게 읽을 수 있다.
	 */
	const FHktTerrainVoxel* AcquireChunk(const FIntVector& Coord);

	/** LRU 캐시에서 청크를 명시적으로 해제. 호출하지 않아도 LRU 가 자동 정리. */
	void ReleaseChunk(const FIntVector& Coord);

	/**
	 * Top-down 프리뷰 샘플링 — Landscape/UI 미니맵용.
	 * 베이크 영역 안이면 베이크 데이터 기반 표면 추출 (TODO: 향후 PR), 미존재 시 Generator 위임.
	 * 현재 PR-B 에서는 Generator 위임만 구현 (베이크 표면 추출은 PR-D 에서 추가).
	 */
	void SamplePreview(int32 MinWorldX, int32 MinWorldY, int32 Width, int32 Height,
	                   FHktTerrainPreviewRegion& OutRegion);

	/** 현재 베이크 자산. 없으면 nullptr. */
	UHktTerrainBakedAsset* GetBakedAsset() const { return BakedAsset; }

	/** 폴백 시 사용되는 Config (로드 자산 우선, 없으면 ProjectSettings). */
	FHktTerrainGeneratorConfig GetEffectiveConfig() const;

	/** LRU 캐시 최대 항목 수. 기본 256 청크 (= 32MB raw). */
	UPROPERTY(EditAnywhere, Category = "Cache")
	int32 MaxCachedChunks = 256;

private:
	/** 폴백 캐시 엔트리 — LRU 정렬용. */
	struct FCachedChunk
	{
		FIntVector Coord;
		TArray<FHktTerrainVoxel> Voxels;  // 32768개
		uint64 LastAccessTick = 0;
		bool bFromBaked = false;          // 통계용
	};

	UPROPERTY()
	TObjectPtr<UHktTerrainBakedAsset> BakedAsset = nullptr;

	TSharedPtr<FStreamableHandle> PendingLoadHandle;

	TMap<FIntVector, TSharedPtr<FCachedChunk>> ChunkCache;
	uint64 NextAccessTick = 1;

	/** 폴백 생성기 — 첫 호출 시 lazy 생성. Config 변경 시 재생성. */
	TUniquePtr<FHktTerrainGenerator> FallbackGenerator;
	FHktTerrainGeneratorConfig FallbackConfigCached;
	bool bFallbackConfigCached = false;

	bool bFallbackOriginLogged = false;
	int32 FallbackHitCount = 0;
	int32 BakedHitCount = 0;

	/** Config 결정 + 변경 감지하여 FallbackGenerator 갱신. */
	const FHktTerrainGenerator& EnsureFallbackGenerator();

	/** LRU 강제 축출 (MaxCachedChunks 초과 시). */
	void EvictIfNeeded();

	/** 폴백 호출 시 1회 INFO 로그 — Config 출처 확인용. */
	void LogFallbackOriginOnce(const TCHAR* Origin);
};
