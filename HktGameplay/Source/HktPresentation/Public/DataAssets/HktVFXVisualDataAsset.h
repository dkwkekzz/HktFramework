// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktTagDataAsset.h"
#include "HktVFXVisualDataAsset.generated.h"

class UNiagaraSystem;

/**
 * VFX 시각화용 TagDataAsset.
 * IdentifierTag(예: VFX.HitSpark)로 로드되며, 재생할 Niagara System을 지정합니다.
 * DataAsset 비동기 로드 시 NiagaraSystem도 함께 로드됩니다 (하드 레퍼런스).
 */
UCLASS(BlueprintType)
class HKTPRESENTATION_API UHktVFXVisualDataAsset : public UHktTagDataAsset
{
	GENERATED_BODY()

public:
	/** 이 VFX 태그에 대응하는 Niagara System */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|VFX")
	TObjectPtr<UNiagaraSystem> NiagaraSystem;
};
