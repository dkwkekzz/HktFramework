#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "GameplayTagContainer.h"
#include "HktTagDataAsset.generated.h"

/**
 * Tag 기반으로 검색 가능한 기본 데이터 에셋입니다.
 * Asset Registry에 Tag 정보를 메타데이터로 노출하여, 에셋 로드 없이 검색이 가능합니다.
 */
UCLASS(BlueprintType)
class HKTASSET_API UHktTagDataAsset : public UPrimaryDataAsset
{
    GENERATED_BODY()

public:
    // 이 에셋을 식별할 고유 태그입니다.
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|Identity")
    FGameplayTag IdentifierTag;

#if WITH_EDITORONLY_DATA
    // 에디터에서 자산 저장 시 Asset Registry에 태그 정보를 기록합니다.
    virtual void GetAssetRegistryTags(TArray<FAssetRegistryTag>& OutTags) const override;
#endif
};