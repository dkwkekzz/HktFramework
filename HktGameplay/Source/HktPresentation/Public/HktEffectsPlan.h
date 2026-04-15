// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktCoreDefs.h"
#include "GameplayTagContainer.h"
#include "Math/Vector.h"

/**
 * EHktEffectType — Projection이 기록하는 UE5 side effect 유형
 *
 * Projection은 ViewModel(FHktPresentationState)을 직접 갱신하되,
 * UE5 월드에 대한 side effect는 Effect로 기록. EffectExecutor가 일괄 실행.
 */
enum class EHktEffectType : uint8
{
	// --- 에셋 ---
	ResolveAsset,               // VisualElement 태그 → 비동기 에셋 로드 + CapsuleHalfHeight 추출

	// --- Actor 생명주기 ---
	SpawnActor,                 // 엔티티용 Actor 생성 (비동기, 에셋 로드 후)
	DestroyActor,               // Actor 즉시 파괴

	// --- 렌더 위치 ---
	ComputeRenderLocation,      // 지면 트레이스 + 캡슐 오프셋 → RenderLocation 갱신

	// --- Presentation 전달 ---
	SyncPresentation,           // ViewModel → Actor 전체 동기화 (bForceAll=true, 스폰 후)
	SyncPresentationDelta,      // ViewModel → Actor 증분 동기화 (dirty 엔티티)

	// --- VFX ---
	PlayVFXAtLocation,          // 일회성 VFX 재생 (자동 파괴)
	AttachVFXToEntity,          // 엔티티 추적 VFX 부착 (지속형)
	DetachVFXFromEntity,        // 엔티티 VFX 해제

	MAX_VALUE                   // 센티널 — 새 타입은 이 위에 추가
};

/**
 * FHktEffect — 단일 side effect 기록
 *
 * Effect별 필드 사용:
 *  ResolveAsset:          EntityId, Tag(VisualElement)
 *  SpawnActor:            EntityId
 *  DestroyActor:          EntityId
 *  ComputeRenderLocation: EntityId
 *  SyncPresentation:      EntityId
 *  SyncPresentationDelta: EntityId
 *  PlayVFXAtLocation:     Tag, Location
 *  AttachVFXToEntity:     Tag, EntityId, Location
 *  DetachVFXFromEntity:   Tag, EntityId
 */
struct FHktEffect
{
	EHktEffectType Type;
	FHktEntityId EntityId = InvalidEntityId;
	FGameplayTag Tag;
	FVector Location = FVector::ZeroVector;

	FHktEffect() : Type(EHktEffectType::DestroyActor) {}
	FHktEffect(EHktEffectType InType, FHktEntityId InId) : Type(InType), EntityId(InId) {}
};

/**
 * FHktEffectsPlan — 프레임 내 모든 side effect 목록
 *
 * Projection이 Project() 호출 중 Effect를 기록.
 * 파이프라인 완료 후 EffectExecutor가 순서대로 실행.
 */
struct HKTPRESENTATION_API FHktEffectsPlan
{
	TArray<FHktEffect> Effects;

	void Reset() { Effects.Reset(); }
	int32 Num() const { return Effects.Num(); }

	/** 기본 Effect 추가 (EntityId 기반) */
	FHktEffect& Add(EHktEffectType Type, FHktEntityId EntityId);

	/** VFX Effect 추가 (위치 기반) */
	FHktEffect& AddVFX(EHktEffectType Type, FGameplayTag Tag, FVector Location);

	/** VFX Entity Effect 추가 (엔티티 + 위치) */
	FHktEffect& AddVFXEntity(EHktEffectType Type, FGameplayTag Tag, FHktEntityId EntityId, FVector Location);

	/** 디버그: Effect 목록을 요약 문자열로 직렬화 */
	FString Describe() const;

	/** 특정 타입의 Effect 개수 */
	int32 CountByType(EHktEffectType Type) const;
};
