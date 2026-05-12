// Copyright Hkt Studios, Inc. All Rights Reserved.
// Spawner 액터 — SpawnRule에 따라 엔티티를 스폰/관리

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "GameplayTagContainer.h"
#include "HktMapData.h"
#include "HktSpawnerActor.generated.h"

/**
 * AHktSpawnerActor
 *
 * HktMap의 Spawner 데이터를 기반으로 엔티티를 스폰/관리하는 액터.
 * SpawnRule에 따라 즉시, 스토리 시작 시, 트리거 시, 타이머 기반으로 동작.
 * Region 스트리밍에 의해 활성화/비활성화된다.
 *
 * [DEPRECATED · Phase 5 M6 — TerrainSpawner.design.md §8]
 *   본 액터는 정적 SpawnRule enum 기반 spawner 의 런타임 actor 측 어댑터다.
 *   신규 흐름은 baked `FHktTerrainSpawnerSpec` → `FHktTerrainSystem` chunk-load →
 *   `FHktEvent` dispatch (HktServerRule) → Story VM. 본 클래스는 1 릴리즈 후 제거.
 *   임시 변환은 `HktMapSpawnerAdapter::MapSpawnerToTerrainSpec` 참조.
 */
UCLASS()
class HKTMAPGENERATOR_API AHktSpawnerActor : public AActor
{
	GENERATED_BODY()

public:
	AHktSpawnerActor();

	/** 스폰할 엔티티의 GameplayTag */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HKT|Spawner")
	FGameplayTag EntityTag;

	/** 스폰 규칙 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HKT|Spawner")
	EHktSpawnRule SpawnRule = EHktSpawnRule::Always;

	/** 동시 스폰 수 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HKT|Spawner")
	int32 SpawnCount = 1;

	/** 리스폰 간격 (0 = 리스폰 없음) */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HKT|Spawner")
	float RespawnSeconds = 0.f;

	/** FHktMapSpawner 데이터로 초기화 — Phase 5 M6 deprecated. */
	[[deprecated("Use HktMapSpawnerAdapter::MapSpawnerToTerrainSpec + UHktTerrainBakedAsset::Spawners (TerrainSpawner.design.md §8). 1 release after migration this method is removed.")]]
	void InitFromSpawnerData(const FHktMapSpawner& Data);

	/** Spawner 활성화 (Region 로드 시 호출) */
	UFUNCTION(BlueprintCallable, Category = "HKT|Spawner")
	void Activate();

	/** Spawner 비활성화 (Region 언로드 시 호출) — 스폰된 엔티티 제거 */
	UFUNCTION(BlueprintCallable, Category = "HKT|Spawner")
	void Deactivate();

	/** 활성 상태인지 */
	UFUNCTION(BlueprintCallable, Category = "HKT|Spawner")
	bool IsActive() const { return bActive; }

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

private:
	bool bActive = false;

	/** 스폰된 엔티티 추적 */
	UPROPERTY()
	TArray<TWeakObjectPtr<AActor>> SpawnedEntities;

	/** 리스폰 타이머 핸들 */
	FTimerHandle RespawnTimerHandle;

	/** 실제 엔티티 스폰 수행 */
	void DoSpawn();

	/** 리스폰 체크 콜백 */
	void OnRespawnTimer();
};
