// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktDeconstructUnitActor.h"
#include "HktDeconstructParamController.h"
#include "Deconstruct/HktDeconstructVisualDataAsset.h"
#include "HktPresentationState.h"
#include "HktVFXIntent.h"
#include "NiagaraComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "NativeGameplayTags.h"

UE_DEFINE_GAMEPLAY_TAG_STATIC(Tag_Anim_Skill, "Anim.Skill");
UE_DEFINE_GAMEPLAY_TAG_STATIC(Tag_Anim_Attack, "Anim.Attack");

UE_DEFINE_GAMEPLAY_TAG_STATIC(Tag_Element_Fire, "Element.Fire");
UE_DEFINE_GAMEPLAY_TAG_STATIC(Tag_Element_Ice, "Element.Ice");
UE_DEFINE_GAMEPLAY_TAG_STATIC(Tag_Element_Lightning, "Element.Lightning");
UE_DEFINE_GAMEPLAY_TAG_STATIC(Tag_Element_Dark, "Element.Dark");
UE_DEFINE_GAMEPLAY_TAG_STATIC(Tag_Element_Void, "Element.Void");
UE_DEFINE_GAMEPLAY_TAG_STATIC(Tag_Element_Nature, "Element.Nature");

namespace
{
	EHktDeconstructElement ParseElementFromTag(const FGameplayTag& Tag)
	{
		if (Tag.MatchesTag(Tag_Element_Fire))       return EHktDeconstructElement::Fire;
		if (Tag.MatchesTag(Tag_Element_Ice))         return EHktDeconstructElement::Ice;
		if (Tag.MatchesTag(Tag_Element_Lightning))   return EHktDeconstructElement::Lightning;
		if (Tag.MatchesTag(Tag_Element_Dark) || Tag.MatchesTag(Tag_Element_Void))
			return EHktDeconstructElement::Void;
		if (Tag.MatchesTag(Tag_Element_Nature))      return EHktDeconstructElement::Nature;
		return EHktDeconstructElement::Fire;
	}
}

AHktDeconstructUnitActor::AHktDeconstructUnitActor()
{
	DeconstructNiagaraComponent = CreateDefaultSubobject<UNiagaraComponent>(TEXT("DeconstructNiagara"));
	DeconstructNiagaraComponent->SetupAttachment(GetMeshComponent());
	DeconstructNiagaraComponent->SetAutoActivate(false);

	ParamController = CreateDefaultSubobject<UHktDeconstructParamController>(TEXT("DeconstructParamController"));
}

void AHktDeconstructUnitActor::OnVisualAssetLoaded(UHktTagDataAsset* InAsset)
{
	UHktDeconstructVisualDataAsset* InDataAsset = Cast<UHktDeconstructVisualDataAsset>(InAsset);
	if (!InDataAsset || bDeconstructInitialized) return;
	bDeconstructInitialized = true;

	DeconstructDataAsset = InDataAsset;
	Tuning = InDataAsset->Tuning;

	if (InDataAsset->DeconstructSystem)
	{
		DeconstructNiagaraComponent->SetAsset(InDataAsset->DeconstructSystem);
	}

	ParamController->Initialize(DeconstructNiagaraComponent, GetMeshComponent());

	USkeletalMeshComponent* SkelMesh = GetMeshComponent();
	if (InDataAsset->CoreGlowMaterial && SkelMesh)
	{
		const int32 NumMaterials = SkelMesh->GetNumMaterials();
		for (int32 i = 0; i < NumMaterials; ++i)
		{
			SkelMesh->SetMaterial(i, InDataAsset->CoreGlowMaterial);
		}
	}

	UpdateElement(EHktDeconstructElement::Fire);

	CurrentParams.Coherence = 0.0f;
	CurrentParams.PointScatter = Tuning.MaxPointScatter;
	CurrentParams.PointDensity = 0.0f;
	TargetParams.Coherence = 1.0f;
	TargetParams.PointScatter = 0.0f;
	TargetParams.PointDensity = 1.0f;
	bParamsDirty = true;

	ParamController->PushParams(CurrentParams);
	LastPushedParams = CurrentParams;

	DeconstructNiagaraComponent->SetVisibility(true);
	DeconstructNiagaraComponent->Activate(true);
}

void AHktDeconstructUnitActor::UpdateElement(EHktDeconstructElement NewElement)
{
	if (CurrentElement == NewElement && bDeconstructInitialized) return;
	CurrentElement = NewElement;

	const UHktDeconstructVisualDataAsset* DA = DeconstructDataAsset.Get();
	FHktDeconstructPalette Palette = DA
		? DA->GetPalette(NewElement)
		: HktDeconstructDefaults::GetDefaultPalette(NewElement);

	UStaticMesh* FragMesh = DA ? DA->GetFragmentMesh(NewElement) : nullptr;

	CurrentParams.BaseColor = Palette.Primary;
	CurrentParams.SecondaryColor = Palette.Secondary;
	CurrentParams.AccentColor = Palette.Accent;
	TargetParams.BaseColor = Palette.Primary;
	TargetParams.SecondaryColor = Palette.Secondary;
	TargetParams.AccentColor = Palette.Accent;

	ParamController->SetFragmentMesh(FragMesh);
	bParamsDirty = true;
}

void AHktDeconstructUnitActor::ApplyVitals(const FHktVitalsView& V, int64 Frame, bool bForce)
{
	if (!bDeconstructInitialized) return;
	if (!bForce && !V.HealthRatio.IsDirty(Frame)) return;

	const float NewHealthRatio = V.HealthRatio.Get();

	if (NewHealthRatio <= 0.0f && !bDead)
	{
		bDead = true;
		TargetParams.Coherence = 0.0f;
		TargetParams.PointScatter = Tuning.MaxPointScatter;
		TargetParams.PointDensity = 0.0f;
		TargetParams.AuraSpawnRateMult = Tuning.DeathAuraSpawnMult;
		TargetParams.AuraVelocityMult = Tuning.DeathAuraVelMult;
		TargetParams.RibbonWidthMult = 0.0f;
	}
	else if (!bDead)
	{
		const float Delta = PrevHealthRatio - NewHealthRatio;
		if (Delta > 0.0f)
		{
			const float Spike = FMath::Clamp(Delta * Tuning.DamageToAgitationScale, 0.0f, 1.0f);
			TargetParams.Agitation = FMath::Max(TargetParams.Agitation, Spike);
		}

		TargetParams.Coherence = NewHealthRatio;
		TargetParams.PointDensity = FMath::Lerp(Tuning.MinPointDensity, 1.0f, NewHealthRatio);
	}

	PrevHealthRatio = NewHealthRatio;
}

void AHktDeconstructUnitActor::ApplyMovement(const FHktMovementView& V, int64 Frame, bool bForce)
{
	Super::ApplyMovement(V, Frame, bForce);

	if (!bDeconstructInitialized || bDead) return;
	if (!bForce && !V.Velocity.IsDirty(Frame)) return;

	const float Speed = FMath::Sqrt(V.Velocity.Get().SizeSquared());
	const float BaseAgitation = FMath::Clamp(Speed / Tuning.MovementSpeedRef, 0.0f, Tuning.MaxAgitationFromMovement);
	if (TargetParams.Agitation <= Tuning.MaxAgitationFromMovement)
	{
		TargetParams.Agitation = BaseAgitation;
	}
}

void AHktDeconstructUnitActor::ApplyVisualization(const FHktVisualizationView& V, int64 Frame, bool bForce)
{
	if (!bDeconstructInitialized) return;
	if (!bForce && !V.VisualElement.IsDirty(Frame)) return;

	const FGameplayTag VisualTag = V.VisualElement.Get();
	if (VisualTag.IsValid())
	{
		UpdateElement(ParseElementFromTag(VisualTag));
	}
}

void AHktDeconstructUnitActor::ApplyAnimation(FHktAnimationView& V, int64 Frame, bool bForce)
{
	// 부모 구현이 PendingAnimTriggers를 consume하기 전에 스킬/공격 스파이크 검출
	if (bDeconstructInitialized && V.PendingAnimTriggers.Num() > 0)
	{
		for (const FGameplayTag& AnimTag : V.PendingAnimTriggers)
		{
			if (AnimTag.MatchesTag(Tag_Anim_Skill) || AnimTag.MatchesTag(Tag_Anim_Attack))
			{
				CurrentParams.RibbonWidthMult = Tuning.SkillRibbonWidthMult;
				CurrentParams.RibbonEmissiveMult = Tuning.SkillRibbonEmissiveMult;
				CurrentParams.FragmentScaleMult = Tuning.SkillFragmentScaleMult;
				CurrentParams.AuraVelocityMult = Tuning.SkillAuraVelMult;
				bParamsDirty = true;
				break;
			}
		}
	}

	Super::ApplyAnimation(V, Frame, bForce);
}

void AHktDeconstructUnitActor::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);

	if (!bDeconstructInitialized) return;

	TargetParams.Agitation = FMath::FInterpTo(TargetParams.Agitation, 0.0f, DeltaTime, Tuning.InterpSpeed_AgitationDecay);

	CurrentParams.Coherence = FMath::FInterpTo(CurrentParams.Coherence, TargetParams.Coherence, DeltaTime, Tuning.InterpSpeed_Coherence);
	CurrentParams.PointScatter = FMath::FInterpTo(CurrentParams.PointScatter, TargetParams.PointScatter, DeltaTime, Tuning.InterpSpeed_Scatter);
	CurrentParams.PointDensity = FMath::FInterpTo(CurrentParams.PointDensity, TargetParams.PointDensity, DeltaTime, Tuning.InterpSpeed_Coherence);
	CurrentParams.Agitation = FMath::FInterpTo(CurrentParams.Agitation, TargetParams.Agitation, DeltaTime, Tuning.InterpSpeed_Agitation);
	CurrentParams.RibbonWidthMult = FMath::FInterpTo(CurrentParams.RibbonWidthMult, TargetParams.RibbonWidthMult, DeltaTime, Tuning.InterpSpeed_Multipliers);
	CurrentParams.RibbonEmissiveMult = FMath::FInterpTo(CurrentParams.RibbonEmissiveMult, TargetParams.RibbonEmissiveMult, DeltaTime, Tuning.InterpSpeed_Multipliers);
	CurrentParams.AuraVelocityMult = FMath::FInterpTo(CurrentParams.AuraVelocityMult, TargetParams.AuraVelocityMult, DeltaTime, Tuning.InterpSpeed_Multipliers);
	CurrentParams.AuraSpawnRateMult = FMath::FInterpTo(CurrentParams.AuraSpawnRateMult, TargetParams.AuraSpawnRateMult, DeltaTime, Tuning.InterpSpeed_Multipliers);
	CurrentParams.FragmentScaleMult = FMath::FInterpTo(CurrentParams.FragmentScaleMult, TargetParams.FragmentScaleMult, DeltaTime, Tuning.InterpSpeed_Multipliers);

	if (bParamsDirty || FMemory::Memcmp(&CurrentParams, &LastPushedParams, sizeof(FHktDeconstructParams)) != 0)
	{
		ParamController->PushParams(CurrentParams);
		LastPushedParams = CurrentParams;
		bParamsDirty = false;
	}
}
