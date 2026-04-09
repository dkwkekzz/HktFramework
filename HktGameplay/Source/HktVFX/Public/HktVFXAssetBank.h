// Copyright Hkt Studios, Inc. All Rights Reserved.

// HktVFXAssetBank.h - 에디터에서 생성된 VFX 에셋 참조 테이블 (Data Asset)

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "NiagaraSystem.h"
#include "HktVFXIntent.h"
#include "HktVFXAssetBank.generated.h"

// ============================================================================
// VFX 에셋 뱅크 엔트리 - 키 → Niagara 시스템 매핑
// ============================================================================
USTRUCT(BlueprintType)
struct HKTVFX_API FHktVFXAssetEntry
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString Key;  // Intent.GetAssetKey() 결과

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TSoftObjectPtr<UNiagaraSystem> System;
};

// ============================================================================
// UHktVFXAssetBank - 에디터에서 생성된 VFX 에셋을 관리하는 DataAsset
// ============================================================================
UCLASS(BlueprintType)
class HKTVFX_API UHktVFXAssetBank : public UDataAsset
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TArray<FHktVFXAssetEntry> Entries;

    /** 키로 시스템 검색 (정확한 매칭) */
    UFUNCTION(BlueprintCallable, Category = "VFX")
    UNiagaraSystem* FindSystem(const FString& Key) const;

    /** 가장 유사한 시스템 검색 (정확 → Intensity 근접 매칭 폴백) */
    UFUNCTION(BlueprintCallable, Category = "VFX")
    UNiagaraSystem* FindClosestSystem(const FHktVFXIntent& Intent) const;
};
