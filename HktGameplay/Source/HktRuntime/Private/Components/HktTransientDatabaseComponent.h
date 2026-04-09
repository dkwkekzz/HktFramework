// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Misc/Optional.h"
#include "Components/ActorComponent.h"
#include "HktServerRuleInterfaces.h"
#include "HktTransientDatabaseComponent.generated.h"

/**
 * UHktTransientDatabaseComponent - IHktWorldDatabase 구현 (휘발성 메모리 기반)
 *
 * 저장 없이 메모리에만 데이터를 보관하는 휘발성 데이터베이스.
 * 테스트 및 로컬 개발용으로 사용.
 *
 * 아키텍처:
 *   - IHktWorldDatabase 인터페이스 구현
 *   - 파일 I/O 없이 메모리(TMap)에만 저장
 *   - 게임 종료 시 모든 데이터 소실
 *
 * 역할:
 *   - IHktWorldDatabase: 비동기 플레이어 레코드 로드/저장
 *   - 메모리 내 저장만 수행 (파일 저장 없음)
 */
UCLASS(ClassGroup=(HktRuntime), meta=(BlueprintSpawnableComponent))
class HKTRUNTIME_API UHktTransientDatabaseComponent : public UActorComponent, public IHktWorldDatabase
{
    GENERATED_BODY()

public:
    UHktTransientDatabaseComponent();

    // === IHktWorldDatabase 구현 ===

    virtual void LoadPlayerRecordAsync(int64 InPlayerUid, TFunction<void(const FHktPlayerRecord&)> InCallback) override;
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

private:
    /** 메모리에 저장된 레코드 (휘발성) */
    TMap<int64, FHktPlayerRecord> TransientRecords;
};
