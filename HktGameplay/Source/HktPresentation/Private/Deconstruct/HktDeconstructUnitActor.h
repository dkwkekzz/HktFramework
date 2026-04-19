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
 * - Apply* 패스에서 TargetParams만 설정
 * - Tick()에서 FInterpTo로 CurrentParams → TargetParams 수렴
 */
UCLASS(Blueprintable)
class AHktDeconstructUnitActor : public AHktUnitActor
{
	GENERATED_BODY()

public:
	AHktDeconstructUnitActor();

	// SOA 뷰별 Apply 오버라이드
	virtual void ApplyVitals(const FHktVitalsView& V, int64 Frame, bool bForce) override;
	virtual void ApplyMovement(const FHktMovementView& V, int64 Frame, bool bForce) override;
	virtual void ApplyVisualization(const FHktVisualizationView& V, int64 Frame, bool bForce) override;
	virtual void ApplyAnimation(FHktAnimationView& V, int64 Frame, bool bForce) override;

	virtual void Tick(float DeltaTime) override;
	virtual void OnVisualAssetLoaded(UHktTagDataAsset* InAsset) override;

protected:
	UPROPERTY(VisibleAnywhere, Category = "HKT|Deconstruct")
	TObjectPtr<UNiagaraComponent> DeconstructNiagaraComponent;

private:
	UPROPERTY(Transient)
	TObjectPtr<UHktDeconstructVisualDataAsset> DeconstructDataAsset;

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
