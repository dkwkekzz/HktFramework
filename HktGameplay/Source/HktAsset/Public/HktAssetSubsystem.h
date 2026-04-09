#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "GameplayTagContainer.h"
#include "Engine/StreamableManager.h"
#include "HktAssetSubsystem.generated.h"

class UHktTagDataAsset;

/**
 * TagMiss 콜백 델리게이트.
 * Tag가 매핑되지 않았을 때 호출됩니다. 에셋 경로(TagDataAsset)를 반환하면 해당 경로로 로드 시도.
 * 빈 경로 반환 시 로드 포기.
 */
DECLARE_DELEGATE_RetVal_OneParam(FSoftObjectPath, FOnHktTagMiss, const FGameplayTag& /*Tag*/);

/**
 * 태그 기반 에셋 관리 서브시스템입니다.
 * 게임 시작 시 HktTagDataAsset 타입의 에셋들을 스캔하여 태그 매핑 테이블을 구축합니다.
 *
 * 에셋 해결 순서:
 * 1. TagToPathMap (DataAsset 기반)
 * 2. OnTagMiss 콜백 (Generator가 자동 생성 후 경로 반환)
 */
UCLASS()
class HKTASSET_API UHktAssetSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()

public:
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;
    virtual void Deinitialize() override;

    static UHktAssetSubsystem* Get(UWorld* World);

    // 동기 로드: 이미 로드된 에셋을 찾거나, 없으면 동기로 로드하여 반환합니다.
    UHktTagDataAsset* LoadAssetSync(FGameplayTag Tag);

    // 비동기 로드 (기본형): 완료 신호만 받습니다. 람다 캡처를 통해 Tag를 가져와야 합니다.
    void LoadAssetAsync(FGameplayTag Tag, FStreamableDelegate DelegateToCall);

    // 비동기 로드 (편의형): 로드된 에셋을 람다 인자로 바로 전달받습니다.
    void LoadAssetAsync(FGameplayTag Tag, TFunction<void(UHktTagDataAsset*)> OnLoaded);

    // =========================================================================
    // 태그 → 경로 해결 (로드하지 않음)
    // =========================================================================

    /** 태그를 FSoftObjectPath로 해결 (로드X, 맵 룩업 + OnTagMiss). ViewModel 사전 해결용. */
    FSoftObjectPath ResolveTagPath(const FGameplayTag& Tag);

    /** FSoftObjectPath로 직접 비동기 로드 (태그 해결 불필요 시) */
    void LoadAssetByPathAsync(FSoftObjectPath Path, TFunction<void(UHktTagDataAsset*)> OnLoaded);

    // =========================================================================
    // Convention Path (Generator 출력 경로 결정용 유틸리티)
    // =========================================================================

    /** Convention Path 문자열 반환 (로드하지 않음). Settings 기반. Generator가 출력 경로를 결정할 때 사용. */
    static FSoftObjectPath ResolveConventionPath(const FGameplayTag& Tag);

    // =========================================================================
    // TagMiss 콜백 (Generator 연동)
    // =========================================================================

    /** Tag miss 콜백 등록. Generator가 바인딩하여 자동 생성 수행. */
    FOnHktTagMiss OnTagMiss;

    /** TagMap에 수동으로 경로 등록 (Generator가 생성 완료 후 호출) */
    void RegisterTagPath(FGameplayTag Tag, FSoftObjectPath Path);

    /** TagMap 강제 재구축 */
    void ForceRebuildTagMap();

protected:
    void RebuildTagMap();

    // 로딩 완료 후 처리를 위한 내부 헬퍼
    void OnAssetLoadedInternal(FGameplayTag Tag, TFunction<void(UHktTagDataAsset*)> Callback);

    /** Tag에서 에셋 경로 해결 (TagMap → OnMiss 순서) */
    FSoftObjectPath ResolvePath(FGameplayTag Tag);

private:
    // Tag와 SoftObjectPath를 매핑합니다.
    TMap<FGameplayTag, FSoftObjectPath> TagToPathMap;

    // 비동기 로딩 핸들 관리 (Garbage Collection 방지용으로 핸들을 잡아두고 싶다면 TSharedPtr<FStreamableHandle>을 저장해야 함)
    // 여기서는 단순 로드 요청용으로 사용합니다.
    FStreamableManager StreamableManager;
};