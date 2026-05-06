#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "GameplayTagContainer.h"
#include "HktTagDataAsset.generated.h"

/**
 * 엔터티의 렌더 카테고리. TagDataAsset 의 클래스 타입에 의해 결정된다.
 * 기존에는 Entity_* archetype 태그로 분기했지만, 같은 archetype 으로도 다른 렌더 방식
 * (예: Sprite vs Voxel Actor) 을 쓰고 싶을 때 유연하지 못했다. 이제는 TagDataAsset
 * 서브클래스가 GetRenderCategory() 를 오버라이드해 자신의 렌더 카테고리를 선언한다.
 */
UENUM()
enum class EHktRenderCategory : uint8
{
    None = 0,
    Actor,
    MassEntity,
    FX,
    Debris,
};

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

    /**
     * 이 DataAsset 의 시각화 종류. 서브클래스에서 오버라이드하여 자신의 렌더 카테고리를 선언한다.
     * Presentation 레이어가 엔터티 추가 시 이 값을 조회하여 어떤 렌더 경로를 사용할지 결정한다.
     */
    virtual EHktRenderCategory GetRenderCategory() const { return EHktRenderCategory::None; }

#if WITH_EDITORONLY_DATA
    // 에디터에서 자산 저장 시 Asset Registry에 태그 정보를 기록합니다.
    virtual void GetAssetRegistryTags(TArray<FAssetRegistryTag>& OutTags) const override;
#endif
};