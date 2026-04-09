// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVFXRuntimeResolver.h"
#include "HktVFXLog.h"
#include "HktCoreEventLog.h"
#include "NiagaraSystem.h"
#include "Engine/World.h"

UNiagaraComponent* UHktVFXRuntimeResolver::PlayVFX(const FHktVFXIntent& Intent)
{
    if (!AssetBank)
    {
        HKT_EVENT_LOG(HktLogTags::VFX, EHktLogLevel::Warning, EHktLogSource::Client, TEXT("[VFXResolver] No AssetBank assigned"));
        return nullptr;
    }

    // 1. 에셋 뱅크에서 시스템 검색
    UNiagaraSystem* System = AssetBank->FindClosestSystem(Intent);
    if (!System)
    {
        System = FallbackSystem;
        if (!System)
        {
            HKT_EVENT_LOG(HktLogTags::VFX, EHktLogLevel::Warning, EHktLogSource::Client,
                FString::Printf(TEXT("[VFXResolver] No matching VFX for: %s"), *Intent.GetAssetKey()));
            return nullptr;
        }
    }

    // 2. 스폰
    UNiagaraComponent* Comp = UNiagaraFunctionLibrary::SpawnSystemAtLocation(
        GetWorld(),
        System,
        Intent.Location,
        Intent.Direction.Rotation(),
        FVector::OneVector,
        true,   // bAutoDestroy
        true,   // bAutoActivate
        ENCPoolMethod::AutoRelease);

    if (!Comp) return nullptr;

    // 3. 런타임 파라미터 오버라이드
    ApplyRuntimeOverrides(Comp, Intent);

    HKT_EVENT_LOG(HktLogTags::VFX, EHktLogLevel::Info, EHktLogSource::Client, FString::Printf(TEXT("PlayVFX %s Loc=(%.1f,%.1f,%.1f)"),
        *Intent.GetAssetKey(), Intent.Location.X, Intent.Location.Y, Intent.Location.Z));

    return Comp;
}

UNiagaraComponent* UHktVFXRuntimeResolver::PlayVFXAttached(
    const FHktVFXIntent& Intent,
    USceneComponent* AttachTo,
    FName SocketName)
{
    if (!AssetBank || !AttachTo) return nullptr;

    UNiagaraSystem* System = AssetBank->FindClosestSystem(Intent);
    if (!System) System = FallbackSystem;
    if (!System) return nullptr;

    UNiagaraComponent* Comp = UNiagaraFunctionLibrary::SpawnSystemAttached(
        System,
        AttachTo,
        SocketName,
        FVector::ZeroVector,
        FRotator::ZeroRotator,
        EAttachLocation::SnapToTarget,
        true,   // bAutoDestroy
        true,   // bAutoActivate
        ENCPoolMethod::AutoRelease);

    if (Comp)
    {
        ApplyRuntimeOverrides(Comp, Intent);
        HKT_EVENT_LOG(HktLogTags::VFX, EHktLogLevel::Info, EHktLogSource::Client, FString::Printf(TEXT("PlayVFXAttached %s Socket=%s"),
            *Intent.GetAssetKey(), *SocketName.ToString()));
    }
    return Comp;
}

void UHktVFXRuntimeResolver::ApplyRuntimeOverrides(UNiagaraComponent* Comp, const FHktVFXIntent& Intent)
{
    // 크기 스케일
    float RadiusScale = Intent.Radius / 200.f;  // 기본 200 유닛 기준
    Comp->SetVariableFloat(FName("RadiusScale"), RadiusScale);

    // 강도
    Comp->SetVariableFloat(FName("IntensityMult"), Intent.Intensity);

    // 지속시간
    if (Intent.Duration > 0.f)
    {
        Comp->SetVariableFloat(FName("DurationScale"), Intent.Duration);
    }

    // 파워 레벨 (이펙트 화려함)
    Comp->SetVariableFloat(FName("PowerLevel"), Intent.SourcePower);

    // 속성 기반 색상 틴트 (미세 조정)
    FLinearColor ElementTint = GetElementTintColor(Intent.Element);
    Comp->SetVariableLinearColor(FName("ElementTint"), ElementTint);

    // 전체 스케일
    float OverallScale = FMath::Lerp(0.5f, 2.0f, Intent.Intensity);
    Comp->SetWorldScale3D(FVector(OverallScale * RadiusScale));
}

FLinearColor UHktVFXRuntimeResolver::GetElementTintColor(EHktVFXElement Element)
{
    switch (Element)
    {
    case EHktVFXElement::Fire:      return FLinearColor(1.0f, 0.6f, 0.2f, 1.0f);
    case EHktVFXElement::Ice:       return FLinearColor(0.5f, 0.8f, 1.0f, 1.0f);
    case EHktVFXElement::Lightning: return FLinearColor(0.7f, 0.9f, 1.0f, 1.0f);
    case EHktVFXElement::Water:     return FLinearColor(0.3f, 0.5f, 0.9f, 1.0f);
    case EHktVFXElement::Earth:     return FLinearColor(0.6f, 0.4f, 0.2f, 1.0f);
    case EHktVFXElement::Wind:      return FLinearColor(0.8f, 0.9f, 0.8f, 1.0f);
    case EHktVFXElement::Dark:      return FLinearColor(0.4f, 0.1f, 0.6f, 1.0f);
    case EHktVFXElement::Holy:      return FLinearColor(1.0f, 0.95f, 0.7f, 1.0f);
    case EHktVFXElement::Poison:    return FLinearColor(0.3f, 0.8f, 0.2f, 1.0f);
    case EHktVFXElement::Arcane:   return FLinearColor(0.5f, 0.3f, 0.9f, 1.0f);
    case EHktVFXElement::Nature:    return FLinearColor(0.4f, 0.8f, 0.3f, 1.0f);
    default:                        return FLinearColor::White;
    }
}
