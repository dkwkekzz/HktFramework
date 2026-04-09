// Copyright Hkt Studios, Inc. All Rights Reserved.

// 런타임: 시뮬레이션 이벤트 → 미리 생성된 Niagara 시스템 스폰 + 파라미터 오버라이드

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "NiagaraSystem.h"
#include "NiagaraComponent.h"
#include "NiagaraFunctionLibrary.h"
#include "HktVFXIntent.h"
#include "HktVFXAssetBank.h"
#include "HktVFXRuntimeResolver.generated.h"

// ============================================================================
// UHktVFXRuntimeResolver - 게임플레이 코드에서 사용하는 컴포넌트
// ============================================================================
UCLASS(ClassGroup=(VFX), meta=(BlueprintSpawnableComponent))
class HKTVFX_API UHktVFXRuntimeResolver : public UActorComponent
{
    GENERATED_BODY()

public:
    // 에셋 뱅크 (에디터에서 할당)
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="VFX")
    UHktVFXAssetBank* AssetBank;

    // 폴백 시스템 (매칭 실패 시)
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="VFX")
    UNiagaraSystem* FallbackSystem;

    // === 메인 API: 시뮬레이션에서 호출 ===

    /** Intent 기반으로 VFX 스폰 (월드 위치) */
    UFUNCTION(BlueprintCallable, Category="VFX")
    UNiagaraComponent* PlayVFX(const FHktVFXIntent& Intent);

    /** Intent 기반으로 VFX 스폰 (컴포넌트에 Attach) */
    UFUNCTION(BlueprintCallable, Category="VFX")
    UNiagaraComponent* PlayVFXAttached(const FHktVFXIntent& Intent, USceneComponent* AttachTo,
        FName SocketName = NAME_None);

private:
    void ApplyRuntimeOverrides(UNiagaraComponent* Comp, const FHktVFXIntent& Intent);
    static FLinearColor GetElementTintColor(EHktVFXElement Element);
};
