// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Actors/HktUnitActor.h"
#include "Deconstruct/HktDeconstructTypes.h"
#include "HktDeconstructUnitActor.generated.h"

class UNiagaraComponent;
class UHktDeconstructParamController;
class UHktDeconstructVisualDataAsset;

/**
 * Skeletal Mesh Deconstruction 비주얼 Actor.
 *
 * AHktUnitActor를 상속하여 NiagaraComponent(NS_HktDeconstruct)를 추가하고,
 * VM State(Health, Element, Combat State)를 Niagara User Parameter로 변환한다.
 *
 * 설계 원칙: AHktUnitActor처럼 순수 리액티브.
 * - ApplyPresentation()에서 TargetParams만 설정
 * - Tick()에서 FInterpTo로 CurrentParams → TargetParams 수렴
 * - 자체 상태 머신/타이머 없음. 모든 전환은 보간 속도만으로 제어.
 */
UCLASS(Blueprintable)
class AHktDeconstructUnitActor : public AHktUnitActor
{
	GENERATED_BODY()

public:
	AHktDeconstructUnitActor();

	virtual void ApplyPresentation(const FHktEntityPresentation& Entity, int64 Frame, bool bForceAll,
		TFunctionRef<AActor*(FHktEntityId)> GetActorFunc) override;

	virtual void Tick(float DeltaTime) override;
	virtual void OnVisualAssetLoaded(UHktTagDataAsset* InAsset) override;

protected:
	UPROPERTY(VisibleAnywhere, Category = "HKT|Deconstruct")
	TObjectPtr<UNiagaraComponent> DeconstructNiagaraComponent;

private:
	/** OnVisualAssetLoaded()에서 설정. 런타임 Element 조회용 캐시. */
	UPROPERTY(Transient)
	TObjectPtr<UHktDeconstructVisualDataAsset> DeconstructDataAsset;

	/** DataAsset에서 복사한 튜닝값 캐시 */
	FHktDeconstructTuning Tuning;

	UPROPERTY()
	TObjectPtr<UHktDeconstructParamController> ParamController;

	EHktDeconstructElement CurrentElement = EHktDeconstructElement::Fire;

	FHktDeconstructParams CurrentParams;
	FHktDeconstructParams TargetParams;
	FHktDeconstructParams LastPushedParams;

	float PrevHealthRatio = 1.0f;
	bool bDeconstructInitialized = false;
	bool bParamsDirty = true;
	bool bDead = false;

	void UpdateElement(EHktDeconstructElement NewElement);
};
