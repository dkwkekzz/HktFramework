// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktDeconstructParamController.h"
#include "NiagaraComponent.h"
#include "Components/SkeletalMeshComponent.h"

const FName UHktDeconstructParamController::PN_Coherence              = TEXT("Coherence");
const FName UHktDeconstructParamController::PN_PointScatter           = TEXT("PointScatter");
const FName UHktDeconstructParamController::PN_PointDensity           = TEXT("PointDensity");
const FName UHktDeconstructParamController::PN_Agitation              = TEXT("Agitation");
const FName UHktDeconstructParamController::PN_BaseColor              = TEXT("BaseColor");
const FName UHktDeconstructParamController::PN_SecondaryColor         = TEXT("SecondaryColor");
const FName UHktDeconstructParamController::PN_AccentColor            = TEXT("AccentColor");
const FName UHktDeconstructParamController::PN_PulseRate              = TEXT("PulseRate");
const FName UHktDeconstructParamController::PN_TrailLifetime          = TEXT("TrailLifetime");
const FName UHktDeconstructParamController::PN_RibbonWidthMult        = TEXT("RibbonWidthMult");
const FName UHktDeconstructParamController::PN_RibbonEmissiveMult     = TEXT("RibbonEmissiveMult");
const FName UHktDeconstructParamController::PN_AuraVelocityMult       = TEXT("AuraVelocityMult");
const FName UHktDeconstructParamController::PN_AuraSpawnRateMult      = TEXT("AuraSpawnRateMult");
const FName UHktDeconstructParamController::PN_FragmentScaleMult      = TEXT("FragmentScaleMult");
const FName UHktDeconstructParamController::PN_FragmentMesh           = TEXT("FragmentMesh");
const FName UHktDeconstructParamController::PN_SkeletalMeshComponent  = TEXT("SkeletalMeshComponent");

UHktDeconstructParamController::UHktDeconstructParamController()
{
	PrimaryComponentTick.bCanEverTick = false;
}

void UHktDeconstructParamController::Initialize(UNiagaraComponent* InNiagaraComp, USkeletalMeshComponent* InSkelMeshComp)
{
	NiagaraComp = InNiagaraComp;

	if (InNiagaraComp && InSkelMeshComp)
	{
		InNiagaraComp->SetVariableObject(PN_SkeletalMeshComponent, InSkelMeshComp);
	}
}

void UHktDeconstructParamController::PushParams(const FHktDeconstructParams& Params)
{
	UNiagaraComponent* Comp = NiagaraComp.Get();
	if (!Comp) return;

	Comp->SetVariableFloat(PN_Coherence, Params.Coherence);
	Comp->SetVariableFloat(PN_PointScatter, Params.PointScatter);
	Comp->SetVariableFloat(PN_PointDensity, Params.PointDensity);
	Comp->SetVariableFloat(PN_Agitation, Params.Agitation);
	Comp->SetVariableLinearColor(PN_BaseColor, Params.BaseColor);
	Comp->SetVariableLinearColor(PN_SecondaryColor, Params.SecondaryColor);
	Comp->SetVariableLinearColor(PN_AccentColor, Params.AccentColor);
	Comp->SetVariableFloat(PN_PulseRate, Params.PulseRate);
	Comp->SetVariableFloat(PN_TrailLifetime, Params.TrailLifetime);
	Comp->SetVariableFloat(PN_RibbonWidthMult, Params.RibbonWidthMult);
	Comp->SetVariableFloat(PN_RibbonEmissiveMult, Params.RibbonEmissiveMult);
	Comp->SetVariableFloat(PN_AuraVelocityMult, Params.AuraVelocityMult);
	Comp->SetVariableFloat(PN_AuraSpawnRateMult, Params.AuraSpawnRateMult);
	Comp->SetVariableFloat(PN_FragmentScaleMult, Params.FragmentScaleMult);
}

void UHktDeconstructParamController::SetFragmentMesh(UStaticMesh* FragmentMesh)
{
	UNiagaraComponent* Comp = NiagaraComp.Get();
	if (!Comp || !FragmentMesh) return;

	Comp->SetVariableObject(PN_FragmentMesh, FragmentMesh);
}
