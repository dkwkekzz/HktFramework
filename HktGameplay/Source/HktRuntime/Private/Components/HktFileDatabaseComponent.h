// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "GameFramework/SaveGame.h"
#include "HktServerRuleInterfaces.h"
#include "HktFileDatabaseComponent.generated.h"

/**
 * UHktPlayerSaveGame
 * * FHktPlayerRecord를 위한 SaveGame 에셋 래퍼입니다.
 * 원시 JSON 파일 형식을 언리얼의 네이티브 바이너리 직렬화(Data Asset)로 대체합니다.
 */
UCLASS()
class HKTRUNTIME_API UHktPlayerSaveGame : public USaveGame
{
	GENERATED_BODY()

public:
	UPROPERTY(VisibleAnywhere, Category = "Hkt")
	FHktPlayerRecord PlayerRecord;

	// [추가됨] 커스텀 직렬화를 위해 Serialize 함수를 오버라이드 합니다.
	virtual void Serialize(FArchive& Ar) override;
};

/**
 * UHktFileDatabaseComponent - IHktWorldDatabase 구현 (SaveGame 에셋)
 *
 * 언리얼의 SaveGame 시스템을 사용하여 플레이어 데이터를 유지합니다 (Saved/SaveGames/에 .sav 에셋으로 저장됨).
 * 기존의 JSON 텍스트 파일 구현을 대체합니다.
 *
 * 역할:
 * - IHktWorldDatabase: 비동기 플레이어 레코드 로드/저장
 * - 구조화된 에셋 저장을 위해 UHktPlayerSaveGame을 사용합니다.
 */
UCLASS(ClassGroup = (HktRuntime), meta = (BlueprintSpawnableComponent))
class HKTRUNTIME_API UHktFileDatabaseComponent : public UActorComponent, public IHktWorldDatabase
{
	GENERATED_BODY()

public:
	UHktFileDatabaseComponent();

	// === IHktWorldDatabase 구현 ===

	virtual void LoadPlayerRecordAsync(int64 InPlayerUid, const FGameplayTag& InSpawnStoryTag, TFunction<void(const FHktPlayerRecord&)> InCallback) override;
	virtual void SavePlayerRecordAsync(int64 InPlayerUid, FHktPlayerState&& InState, TArray<FHktBagItem>&& InBagItems = {}) override;
	virtual const FHktPlayerRecord* GetCachedPlayerRecord(int64 InPlayerUid) const override;

	// === 기본값 설정 ===

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hkt|Database|Defaults")
	int32 DefaultHealth = 100;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hkt|Database|Defaults")
	int32 DefaultMaxHealth = 100;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hkt|Database|Defaults")
	int32 DefaultAttackPower = 10;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hkt|Database|Defaults")
	int32 DefaultDefense = 5;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hkt|Database|Defaults")
	FGameplayTag DefaultVisualTag;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Hkt|Database|Defaults")
	FGameplayTag DefaultFlowTag;

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

private:
	/** SaveGame 슬롯 관리 */
	static FString GetSaveSlotName(int64 PlayerUid);
	void LoadFromSlot(int64 PlayerUid, TFunction<void(TOptional<FHktPlayerRecord>)> Callback);
	void SaveToSlot(int64 PlayerUid, const FHktPlayerRecord& Record, TFunction<void(bool bSuccess)> Callback);

	/** 디스크 I/O를 최소화하기 위한 캐시된 레코드 */
	TMap<int64, FHktPlayerRecord> CachedRecords;
};