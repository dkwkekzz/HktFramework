// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktEffectExecutor.h"
#include "HktPresentationLog.h"
#include "HktCoreEventLog.h"
#include "HktAssetSubsystem.h"
#include "DataAssets/HktActorVisualDataAsset.h"
#include "Renderers/HktActorRenderer.h"
#include "Renderers/HktVFXRenderer.h"
#include "Components/CapsuleComponent.h"
#include "Engine/World.h"
#include "Engine/LocalPlayer.h"

FHktEffectExecutor::FHktEffectExecutor(
	ULocalPlayer* InLP,
	FHktActorRenderer* InActorRenderer,
	FHktVFXRenderer* InVFXRenderer)
	: LocalPlayer(InLP)
	, ActorRenderer(InActorRenderer)
	, VFXRenderer(InVFXRenderer)
{
}

void FHktEffectExecutor::Execute(const FHktEffectsPlan& Plan, FHktPresentationState& State)
{
	for (const FHktEffect& Effect : Plan.Effects)
	{
		switch (Effect.Type)
		{
		case EHktEffectType::ResolveAsset:
			ExecuteResolveAsset(Effect, State);
			break;
		case EHktEffectType::SpawnActor:
			ExecuteSpawnActor(Effect, State);
			break;
		case EHktEffectType::DestroyActor:
			ExecuteDestroyActor(Effect);
			break;
		case EHktEffectType::ComputeRenderLocation:
			ExecuteComputeRenderLocation(Effect, State);
			break;
		case EHktEffectType::PlayVFXAtLocation:
			ExecutePlayVFX(Effect);
			break;
		case EHktEffectType::AttachVFXToEntity:
			ExecuteAttachVFX(Effect);
			break;
		case EHktEffectType::DetachVFXFromEntity:
			ExecuteDetachVFX(Effect);
			break;
		}
	}
}

// --------------------------------------------------------------------------- ResolveAsset
void FHktEffectExecutor::ExecuteResolveAsset(const FHktEffect& Effect, FHktPresentationState& State)
{
	UWorld* World = LocalPlayer.IsValid() ? LocalPlayer->GetWorld() : nullptr;
	UHktAssetSubsystem* AssetSubsystem = World ? UHktAssetSubsystem::Get(World) : nullptr;
	if (!AssetSubsystem) return;

	FGameplayTag VisualTag = Effect.Tag;
	if (!VisualTag.IsValid()) return;

	FHktEntityId EntityId = Effect.EntityId;
	TWeakObjectPtr<ULocalPlayer> WeakLP = LocalPlayer;

	// State 포인터 캡처: State는 Subsystem 멤버이므로 WeakLP가 유효하면 State도 유효.
	// 참조 캡처(&State)보다 포인터 캡처가 비동기 콜백 수명을 명시적으로 표현.
	FHktPresentationState* StatePtr = &State;

	// 비동기 에셋 로드 — 콜백에서 ViewModel 갱신 (CapsuleHalfHeight + ResolvedAssetPath + RenderLocation 재계산)
	AssetSubsystem->LoadAssetAsync(VisualTag, [this, WeakLP, EntityId, StatePtr](UHktTagDataAsset* Asset)
	{
		if (!Asset || !WeakLP.IsValid()) return;

		FHktEntityPresentation* E = StatePtr->GetMutable(EntityId);
		if (!E || !E->IsAlive()) return;

		E->ResolvedAssetPath.Set(FSoftObjectPath(Asset), StatePtr->GetCurrentFrame());

		// ActorVisualDataAsset인 경우 CDO에서 캡슐 반높이 추출
		if (UHktActorVisualDataAsset* VisualAsset = Cast<UHktActorVisualDataAsset>(Asset))
		{
			if (VisualAsset->ActorClass)
			{
				if (AActor* CDO = VisualAsset->ActorClass->GetDefaultObject<AActor>())
				{
					if (UCapsuleComponent* Capsule = CDO->FindComponentByClass<UCapsuleComponent>())
					{
						E->CapsuleHalfHeight = Capsule->GetScaledCapsuleHalfHeight();
					}
				}
			}
		}

		// CapsuleHalfHeight 변경 후 RenderLocation 재계산
		FVector Loc = E->Location.Get();
		if (Loc.Z == 0.0f)
		{
			float GroundZ;
			if (TraceGroundZ(Loc, GroundZ))
			{
				Loc.Z = GroundZ;
			}
		}
		Loc.Z += E->CapsuleHalfHeight;
		E->RenderLocation.Set(Loc, StatePtr->GetCurrentFrame());
	});
}

// --------------------------------------------------------------------------- SpawnActor
void FHktEffectExecutor::ExecuteSpawnActor(const FHktEffect& Effect, const FHktPresentationState& State)
{
	if (!ActorRenderer) return;

	const FHktEntityPresentation* E = State.Get(Effect.EntityId);
	if (!E || E->RenderCategory != EHktRenderCategory::Actor) return;
	if (ActorRenderer->HasActorOrPending(Effect.EntityId)) return;

	ActorRenderer->EnsureState(State);
	ActorRenderer->SpawnActor(*E);
}

// --------------------------------------------------------------------------- DestroyActor
void FHktEffectExecutor::ExecuteDestroyActor(const FHktEffect& Effect)
{
	if (ActorRenderer)
	{
		ActorRenderer->DestroyActor(Effect.EntityId);
	}
}

// --------------------------------------------------------------------------- ComputeRenderLocation
void FHktEffectExecutor::ExecuteComputeRenderLocation(const FHktEffect& Effect, FHktPresentationState& State)
{
	FHktEntityPresentation* E = State.GetMutable(Effect.EntityId);
	if (!E) return;

	FVector Loc = E->Location.Get();

	// 시뮬레이션의 Z를 그대로 사용. Z==0일 때만 UE5 ground trace 폴백.
	if (Loc.Z == 0.0f)
	{
		float GroundZ;
		if (TraceGroundZ(Loc, GroundZ))
		{
			Loc.Z = GroundZ;
		}
	}
	Loc.Z += E->CapsuleHalfHeight;
	E->RenderLocation.Set(Loc, State.GetCurrentFrame());
}

// --------------------------------------------------------------------------- VFX
void FHktEffectExecutor::ExecutePlayVFX(const FHktEffect& Effect)
{
	if (VFXRenderer)
	{
		VFXRenderer->PlayVFXAtLocation(Effect.Tag, Effect.Location);
	}
}

void FHktEffectExecutor::ExecuteAttachVFX(const FHktEffect& Effect)
{
	if (VFXRenderer)
	{
		VFXRenderer->AttachVFXToEntity(Effect.Tag, Effect.EntityId, Effect.Location);
	}
}

void FHktEffectExecutor::ExecuteDetachVFX(const FHktEffect& Effect)
{
	if (VFXRenderer)
	{
		VFXRenderer->DetachVFXFromEntity(Effect.Tag, Effect.EntityId);
	}
}

// --------------------------------------------------------------------------- Ground Trace 유틸리티
bool FHktEffectExecutor::TraceGroundZ(const FVector& Pos, float& OutZ) const
{
	UWorld* World = LocalPlayer.IsValid() ? LocalPlayer->GetWorld() : nullptr;
	if (!World) return false;

	constexpr float TraceHalfHeight = 500.0f;
	const FVector Start(Pos.X, Pos.Y, Pos.Z + TraceHalfHeight);
	const FVector End(Pos.X, Pos.Y, Pos.Z - TraceHalfHeight);
	FHitResult Hit;
	FCollisionQueryParams Params;
	Params.bTraceComplex = false;

	if (World->LineTraceSingleByChannel(Hit, Start, End, ECC_WorldStatic, Params))
	{
		OutZ = Hit.ImpactPoint.Z;
		return true;
	}
	return false;
}
