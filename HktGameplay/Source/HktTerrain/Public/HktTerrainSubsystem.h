// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "Engine/StreamableManager.h"
#include "Containers/ArrayView.h"
#include "Terrain/HktTerrainGeneratorConfig.h"
#include "Terrain/HktTerrainVoxel.h"
#include "HktTerrainBakedAsset.h"
#include "HktTerrainSubsystem.generated.h"

class FHktTerrainGenerator;
struct FHktTerrainPreviewRegion;

/**
 * BakedAsset 또는 fallback Config 변경으로 effective Config 가 갱신되었을 때 발화.
 *
 * Provider 의 Config 갱신 정책 (정적 스냅샷 + 재바인딩) 의 트리거.
 * GameMode 는 본 델리게이트를 받으면 SetTerrainSource 를 다시 호출하여 그룹별
 * 시뮬레이터의 Provider 인스턴스를 새 Config 로 교체한다.
 */
DECLARE_MULTICAST_DELEGATE_OneParam(FHktTerrainEffectiveConfigChanged,
                                    const FHktTerrainGeneratorConfig& /*NewConfig*/);

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
 *   - 폴백 인자 결정 순서: BakedAsset->GeneratorConfig → Injected Fallback → 컴파일 기본값.
 *     Injected Fallback 은 호출자(예: AHktGameMode)가 `SetFallbackConfig` 로 주입.
 *     HktTerrain → HktRuntime 역의존 차단을 위한 inversion-of-control 패턴.
 *
 * 호출자:
 *   - HktVoxelTerrain — Voxel 메싱 입력
 *   - HktSpriteTerrain — 표면 셀 추출
 *   - HktLandscapeTerrain — 프리뷰 샘플링
 *   - HktCore (FHktTerrainProvider 경유) — 시뮬레이션 청크 데이터
 *
 * 단일 BakedAsset 정책: 한 World 에 단일 인스턴스. 여러 Actor 가 LoadBakedAsset 을
 * 호출하면 가장 최근 호출이 우선 — 단일 VoxelTerrainActor 배치를 권장한다.
 */
UCLASS(BlueprintType)
class HKTTERRAIN_API UHktTerrainSubsystem : public UWorldSubsystem
{
	GENERATED_BODY()

public:
	UHktTerrainSubsystem();

	// USubsystem ------------------------------------------------------------
	virtual bool ShouldCreateSubsystem(UObject* Outer) const override;
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
	 * 청크 데이터 획득 (buffer-out 형식).
	 *
	 *  1. BakedAsset 에 존재하면 디컴프레스 결과를 OutVoxels 로 복사.
	 *  2. 미존재 시 폴백 경로 — Generator 로 즉시 생성 + 경고 로그 1회 + 내부 캐시.
	 *  3. 폴백 인자 출처를 첫 호출 시 1회 INFO 로그.
	 *
	 * @param Coord       청크 좌표
	 * @param OutVoxels   호출자 버퍼 — `Num() == VoxelsPerChunk` 필요. 부족 시 false.
	 * @return 데이터 채움 성공 여부. false 인 경우 OutVoxels 는 zero-init 보장.
	 *
	 * 내부 LRU 캐시는 폴백/디컴프레스 결과 메모이제이션에만 사용 — 외부 포인터 노출 없음.
	 * 호출자는 결과 버퍼를 안전하게 보유/소유할 수 있다 (dangling 위험 0).
	 */
	bool AcquireChunk(const FIntVector& Coord, TArrayView<FHktTerrainVoxel> OutVoxels);

	/** LRU 캐시 힌트 — 더 이상 필요 없는 청크를 명시적으로 축출. 호출 생략 가능 (LRU 자동 정리). */
	void ReleaseChunk(const FIntVector& Coord);

	/** 한 청크에 들어가는 voxel 개수 (= ChunkSize^3). 호출자 버퍼 사이즈 체크용. */
	static constexpr int32 GetVoxelsPerChunk()
	{
		return FHktTerrainGeneratorConfig::ChunkSize *
		       FHktTerrainGeneratorConfig::ChunkSize *
		       FHktTerrainGeneratorConfig::ChunkSize;
	}

	/**
	 * Top-down 프리뷰 샘플링 — Landscape/UI 미니맵용.
	 * 베이크 영역 안이면 베이크 데이터 기반 표면 추출 (TODO: 향후 PR), 미존재 시 Generator 위임.
	 * 현재 PR-B 에서는 Generator 위임만 구현 (베이크 표면 추출은 PR-D 에서 추가).
	 */
	void SamplePreview(int32 MinWorldX, int32 MinWorldY, int32 Width, int32 Height,
	                   FHktTerrainPreviewRegion& OutRegion);

	/** 현재 베이크 자산. 없으면 nullptr. */
	UHktTerrainBakedAsset* GetBakedAsset() const { return BakedAsset; }

	/** 폴백 시 사용되는 Config (BakedAsset → Injected Fallback → 컴파일 기본값). */
	FHktTerrainGeneratorConfig GetEffectiveConfig() const;

	/**
	 * BakedAsset 부재 시 사용할 fallback Config 주입 (예: ProjectSettings 기반).
	 *
	 * HktTerrain 모듈은 HktRuntime 의존이 없으므로 `UHktRuntimeGlobalSetting` 을 직접
	 * 알 수 없다 — 호출자(예: AHktGameMode::InitGame)가 본 API 로 주입해야 한다.
	 *
	 * 호출 시점:
	 *   - GameMode InitGame 직후 (1회)
	 *   - Settings 변경에 반응할 필요가 있다면 다시 호출
	 *
	 * 주입된 Config 가 BakedAsset 부재 시 effective 가 되며, OnEffectiveConfigChanged 가
	 * (실제 변경된 경우에만) 발화되어 GameMode 가 Provider 를 재바인딩하도록 한다.
	 */
	void SetFallbackConfig(const FHktTerrainGeneratorConfig& InConfig);

	/** Effective Config 변경 통지 (BakedAsset 로드/언로드, fallback 갱신). GameMode 가 Provider 재바인딩 트리거로 사용. */
	FHktTerrainEffectiveConfigChanged OnEffectiveConfigChanged;

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

	/** 호출자(GameMode 등) 가 주입한 fallback Config — BakedAsset 부재 시 우선 사용. */
	FHktTerrainGeneratorConfig InjectedFallbackConfig;
	bool bInjectedFallbackConfigSet = false;

	bool bFallbackOriginLogged = false;
	int32 FallbackHitCount = 0;
	int32 BakedHitCount = 0;
	int32 CacheHitCount = 0;

	/** 마지막 베이크 자산 로드 소요 시간 (ms). 동기/비동기 양 경로에서 갱신. */
	double LastBakeLoadMs = 0.0;

	/** 마지막 AcquireChunk 호출 latency (us). 호출 직후 갱신. */
	double LastAcquireUs = 0.0;

	/** Config 결정 + 변경 감지하여 FallbackGenerator 갱신. */
	const FHktTerrainGenerator& EnsureFallbackGenerator();

	/** LRU 강제 축출 (MaxCachedChunks 초과 시). */
	void EvictIfNeeded();

	/** 폴백 호출 시 1회 INFO 로그 — Config 출처 확인용. */
	void LogFallbackOriginOnce(const TCHAR* Origin);

	/**
	 * Insights 키 일괄 갱신 — Shipping 빌드에서는 매크로가 no-op.
	 * 호출 빈도가 높은 AcquireChunk 안에서도 호출되므로 가벼워야 함 (단순 SetValue).
	 */
	void PublishInsights() const;
};
