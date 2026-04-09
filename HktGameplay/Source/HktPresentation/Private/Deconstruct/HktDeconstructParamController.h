// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Deconstruct/HktDeconstructTypes.h"
#include "HktDeconstructParamController.generated.h"

class UNiagaraComponent;
class USkeletalMeshComponent;
class UStaticMesh;

/**
 * FHktDeconstructParams → Niagara User Parameter 전송을 캡슐화하는 컴포넌트.
 * Niagara User Parameter 이름은 NS_HktDeconstruct 에셋과의 계약이다.
 */
UCLASS()
class UHktDeconstructParamController : public UActorComponent
{
	GENERATED_BODY()

public:
	UHktDeconstructParamController();

	/** NiagaraComponent + SkeletalMeshComponent 바인딩 */
	void Initialize(UNiagaraComponent* InNiagaraComp, USkeletalMeshComponent* InSkelMeshComp);

	/** 현재 파라미터를 Niagara에 Push */
	void PushParams(const FHktDeconstructParams& Params);

	/** Fragment 메시 교체 */
	void SetFragmentMesh(UStaticMesh* FragmentMesh);

private:
	TWeakObjectPtr<UNiagaraComponent> NiagaraComp;

	static const FName PN_Coherence;
	static const FName PN_PointScatter;
	static const FName PN_PointDensity;
	static const FName PN_Agitation;
	static const FName PN_BaseColor;
	static const FName PN_SecondaryColor;
	static const FName PN_AccentColor;
	static const FName PN_PulseRate;
	static const FName PN_TrailLifetime;
	static const FName PN_RibbonWidthMult;
	static const FName PN_RibbonEmissiveMult;
	static const FName PN_AuraVelocityMult;
	static const FName PN_AuraSpawnRateMult;
	static const FName PN_FragmentScaleMult;
	static const FName PN_FragmentMesh;
	static const FName PN_SkeletalMeshComponent;
};
