// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVFXProcessor.h"
#include "HktPresentationLog.h"
#include "HktCoreEventLog.h"
#include "HktVFXAssetBank.h"
#include "HktVFXIntent.h"
#include "HktAssetSubsystem.h"
#include "HktPresentationState.h"
#include "DataAssets/HktVFXVisualDataAsset.h"
#include "NiagaraFunctionLibrary.h"
#include "NiagaraSystem.h"
#include "NiagaraComponent.h"
#include "Engine/LocalPlayer.h"
#include "Engine/World.h"

FHktVFXProcessor::FHktVFXProcessor(ULocalPlayer* InLP)
	: LocalPlayer(InLP)
{
}

void FHktVFXProcessor::SetAssetBank(UHktVFXAssetBank* InBank)
{
	AssetBank = InBank;
}

void FHktVFXProcessor::SetFallbackSystem(UNiagaraSystem* InSystem)
{
	FallbackSystem = InSystem;
}

// ============================================================================
// TagDataAsset 기반 비동�?NiagaraSystem 로드
// ============================================================================

void FHktVFXProcessor::LoadNiagaraSystemAsync(FGameplayTag VFXTag, TFunction<void(UNiagaraSystem*)> OnLoaded)
{
	// 캐시 ?�인
	if (TWeakObjectPtr<UNiagaraSystem>* Cached = NiagaraSystemCache.Find(VFXTag))
	{
		if (Cached->IsValid())
		{
			OnLoaded(Cached->Get());
			return;
		}
		NiagaraSystemCache.Remove(VFXTag);
	}

	UWorld* World = LocalPlayer ? LocalPlayer->GetWorld() : nullptr;
	if (!World)
	{
		OnLoaded(nullptr);
		return;
	}

	UHktAssetSubsystem* AssetSubsystem = UHktAssetSubsystem::Get(World);
	if (!AssetSubsystem)
	{
		OnLoaded(nullptr);
		return;
	}

	// TagDataAsset 비동�?로드 ??UHktVFXVisualDataAsset ??NiagaraSystem 추출
	// NiagaraSystem?� ?�드 ?�퍼?�스?��?�?DataAsset 로드 ???�께 로드??(LoadSynchronous 불필??
	TWeakPtr<bool> WeakGuard = AliveGuard;
	AssetSubsystem->LoadAssetAsync(VFXTag, [WeakGuard, this, VFXTag, OnLoaded](UHktTagDataAsset* LoadedAsset)
	{
		if (!WeakGuard.IsValid()) return;  // Renderer가 ?�멸??

		UNiagaraSystem* System = nullptr;

		UHktVFXVisualDataAsset* VFXAsset = Cast<UHktVFXVisualDataAsset>(LoadedAsset);
		if (VFXAsset && VFXAsset->NiagaraSystem)
		{
			System = VFXAsset->NiagaraSystem;
		}

		if (System)
		{
			NiagaraSystemCache.Add(VFXTag, System);
			HKT_EVENT_LOG(HktLogTags::VFX, EHktLogLevel::Verbose, EHktLogSource::Client, FString::Printf(TEXT("LoadNiagaraSystemAsync: [%s] ??%s"), *VFXTag.ToString(), *System->GetPathName()));
		}
		else
		{
			HKT_EVENT_LOG(HktLogTags::VFX, EHktLogLevel::Warning, EHktLogSource::Client, FString::Printf(TEXT("LoadNiagaraSystemAsync: Failed for tag [%s]"), *VFXTag.ToString()));
		}

		OnLoaded(System);
	});
}

// ============================================================================
// Tag 기반 VFX ?�생 (TagDataAsset ??NiagaraSystem 비동�?로드)
// ============================================================================

void FHktVFXProcessor::PlayVFXAtLocation(FGameplayTag VFXTag, FVector Location)
{
	UWorld* World = LocalPlayer ? LocalPlayer->GetWorld() : nullptr;
	if (!World)
	{
		HKT_EVENT_LOG(HktLogTags::VFX, EHktLogLevel::Warning, EHktLogSource::Client, TEXT("PlayVFXAtLocation: No world"));
		return;
	}

	TWeakObjectPtr<ULocalPlayer> WeakLP = LocalPlayer;
	LoadNiagaraSystemAsync(VFXTag, [WeakLP, VFXTag, Location](UNiagaraSystem* System)
	{
		if (!System)
		{
			HKT_EVENT_LOG(HktLogTags::VFX, EHktLogLevel::Warning, EHktLogSource::Client, FString::Printf(TEXT("PlayVFXAtLocation: No NiagaraSystem for tag [%s]"), *VFXTag.ToString()));
			return;
		}

		ULocalPlayer* LP = WeakLP.Get();
		if (!LP) return;

		UWorld* CallbackWorld = LP->GetWorld();
		if (!CallbackWorld) return;

		UNiagaraFunctionLibrary::SpawnSystemAtLocation(
			CallbackWorld,
			System,
			Location,
			FRotator::ZeroRotator,
			FVector::OneVector,
			true,   // bAutoDestroy
			true,   // bAutoActivate
			ENCPoolMethod::AutoRelease);

		HKT_EVENT_LOG(HktLogTags::VFX, EHktLogLevel::Verbose, EHktLogSource::Client, FString::Printf(TEXT("PlayVFXAtLocation: [%s] at %s"), *VFXTag.ToString(), *Location.ToString()));
	});
}

// ============================================================================
// Intent 기반 VFX ?�생 (AssetBank ?��? 매칭)
// ============================================================================

void FHktVFXProcessor::PlayVFXWithIntent(const FHktVFXIntent& Intent)
{
	UWorld* World = LocalPlayer ? LocalPlayer->GetWorld() : nullptr;
	if (!World)
	{
		HKT_EVENT_LOG(HktLogTags::VFX, EHktLogLevel::Warning, EHktLogSource::Client, TEXT("PlayVFXWithIntent: No world"));
		return;
	}

	UNiagaraSystem* System = nullptr;
	if (AssetBank)
	{
		System = AssetBank->FindClosestSystem(Intent);
	}

	if (!System)
	{
		System = FallbackSystem;
	}

	if (!System)
	{
		HKT_EVENT_LOG(HktLogTags::VFX, EHktLogLevel::Warning, EHktLogSource::Client, FString::Printf(TEXT("PlayVFXWithIntent: No system for [%s]"), *Intent.GetAssetKey()));
		return;
	}

	UNiagaraComponent* Comp = UNiagaraFunctionLibrary::SpawnSystemAtLocation(
		World,
		System,
		Intent.Location,
		Intent.Direction.Rotation(),
		FVector::OneVector,
		true,   // bAutoDestroy
		true,   // bAutoActivate
		ENCPoolMethod::AutoRelease);

	if (Comp)
	{
		ApplyRuntimeOverrides(Comp, Intent);
	}

	HKT_EVENT_LOG(HktLogTags::VFX, EHktLogLevel::Verbose, EHktLogSource::Client, FString::Printf(TEXT("PlayVFXWithIntent: [%s] at %s"), *Intent.GetAssetKey(), *Intent.Location.ToString()));
}

void FHktVFXProcessor::ApplyRuntimeOverrides(UNiagaraComponent* Comp, const FHktVFXIntent& Intent)
{
	float RadiusScale = Intent.Radius / 200.f;
	Comp->SetVariableFloat(FName("RadiusScale"), RadiusScale);
	Comp->SetVariableFloat(FName("IntensityMult"), Intent.Intensity);

	if (Intent.Duration > 0.f)
	{
		Comp->SetVariableFloat(FName("DurationScale"), Intent.Duration);
	}

	Comp->SetVariableFloat(FName("PowerLevel"), Intent.SourcePower);

	FLinearColor ElementTint = GetElementTintColor(Intent.Element);
	Comp->SetVariableLinearColor(FName("ElementTint"), ElementTint);

	float OverallScale = FMath::Lerp(0.5f, 2.0f, Intent.Intensity);
	Comp->SetWorldScale3D(FVector(OverallScale * RadiusScale));
}

FLinearColor FHktVFXProcessor::GetElementTintColor(EHktVFXElement Element)
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
	case EHktVFXElement::Arcane:    return FLinearColor(0.5f, 0.3f, 0.9f, 1.0f);
	case EHktVFXElement::Nature:    return FLinearColor(0.4f, 0.8f, 0.3f, 1.0f);
	default:                        return FLinearColor::White;
	}
}

// ============================================================================
// ?�터??부�?지?�형 VFX
// ============================================================================

void FHktVFXProcessor::AttachVFXToEntity(FGameplayTag VFXTag, FHktEntityId EntityId, FVector Location)
{
	FEntityVFXKey Key{ VFXTag, EntityId };

	// 기존 VFX가 ?�으�??�거
	if (TWeakObjectPtr<UNiagaraComponent>* Existing = EntityVFXMap.Find(Key))
	{
		if (Existing->IsValid())
		{
			Existing->Get()->DestroyComponent();
		}
		EntityVFXMap.Remove(Key);
	}

	TWeakObjectPtr<ULocalPlayer> WeakLP = LocalPlayer;
	TWeakPtr<bool> WeakGuard = AliveGuard;
	LoadNiagaraSystemAsync(VFXTag, [WeakGuard, this, Key, VFXTag, EntityId, Location, WeakLP](UNiagaraSystem* System)
	{
		if (!WeakGuard.IsValid()) return;  // Renderer가 ?�멸??

		if (!System)
		{
			HKT_EVENT_LOG(HktLogTags::VFX, EHktLogLevel::Warning, EHktLogSource::Client, FString::Printf(TEXT("AttachVFXToEntity: No NiagaraSystem for tag [%s]"), *VFXTag.ToString()));
			return;
		}

		ULocalPlayer* LP = WeakLP.Get();
		if (!LP) return;

		UWorld* CallbackWorld = LP->GetWorld();
		if (!CallbackWorld) return;

		UNiagaraComponent* Comp = UNiagaraFunctionLibrary::SpawnSystemAtLocation(
			CallbackWorld,
			System,
			Location,
			FRotator::ZeroRotator,
			FVector::OneVector,
			false,  // bAutoDestroy ??지?�형?��?�??�동 관�?
			true,   // bAutoActivate
			ENCPoolMethod::None);

		if (Comp)
		{
			EntityVFXMap.Add(Key, Comp);
			HKT_EVENT_LOG(HktLogTags::VFX, EHktLogLevel::Verbose, EHktLogSource::Client, FString::Printf(TEXT("AttachVFXToEntity: [%s] on Entity=%d at %s"), *VFXTag.ToString(), EntityId, *Location.ToString()));
		}
	});
}

void FHktVFXProcessor::DetachVFXFromEntity(FGameplayTag VFXTag, FHktEntityId EntityId)
{
	FEntityVFXKey Key{ VFXTag, EntityId };
	if (TWeakObjectPtr<UNiagaraComponent>* Found = EntityVFXMap.Find(Key))
	{
		if (Found->IsValid())
		{
			Found->Get()->DestroyComponent();
		}
		EntityVFXMap.Remove(Key);
		HKT_EVENT_LOG(HktLogTags::VFX, EHktLogLevel::Verbose, EHktLogSource::Client, FString::Printf(TEXT("DetachVFXFromEntity: [%s] from Entity=%d"), *VFXTag.ToString(), EntityId));
	}
}

void FHktVFXProcessor::Sync(FHktPresentationState& State)
{
	// Pending 큐 소비
	for (const FHktPendingVFXEvent& Evt : State.PendingVFXEvents)
	{
		PlayVFXAtLocation(Evt.Tag, Evt.Location);
	}
	for (const FHktPendingVFXAttach& Req : State.PendingVFXAttachments)
	{
		AttachVFXToEntity(Req.Tag, Req.EntityId, Req.Location);
	}
	for (const FHktPendingVFXDetach& Req : State.PendingVFXDetachments)
	{
		DetachVFXFromEntity(Req.Tag, Req.EntityId);
	}

	// 엔터티 부착 VFX 위치 동기화 + 유효하지 않으면 정리
	for (auto It = EntityVFXMap.CreateIterator(); It; ++It)
	{
		if (!It.Value().IsValid())
		{
			It.RemoveCurrent();
			continue;
		}

		const FHktEntityId EntityId = It.Key().EntityId;
		if (!State.IsValid(EntityId))
		{
			It.Value().Get()->DestroyComponent();
			It.RemoveCurrent();
			continue;
		}

		const FHktTransformView* Tfm = State.GetTransform(EntityId);
		if (!Tfm) continue;
		It.Value().Get()->SetWorldLocation(Tfm->Location.Get());
	}
}

void FHktVFXProcessor::Teardown()
{
	// 비동�?콜백 무효??(this ?�근 방�?)
	AliveGuard.Reset();

	// 지?�형 VFX ?�리
	for (auto& Pair : EntityVFXMap)
	{
		if (Pair.Value.IsValid())
		{
			Pair.Value.Get()->DestroyComponent();
		}
	}
	EntityVFXMap.Empty();
	NiagaraSystemCache.Empty();

	AssetBank = nullptr;
	FallbackSystem = nullptr;
}
