// Copyright Hkt Studios, Inc. All Rights Reserved.
#pragma once

#include "UObject/Interface.h"
#include "GameFramework/Actor.h"
#include "HktCoreDefs.h"
#include "IHktPresentableActor.generated.h"

struct FHktTransformView;
struct FHktPhysicsView;
struct FHktMovementView;
struct FHktVitalsView;
struct FHktCombatView;
struct FHktOwnershipView;
struct FHktAnimationView;
struct FHktVisualizationView;
struct FHktItemView;
struct FHktVoxelSkinView;
struct FHktSpriteView;
struct FHktTerrainDebrisView;
class UHktTagDataAsset;

UINTERFACE()
class UHktPresentableActor : public UInterface { GENERATED_BODY() };

/**
 * ActorProcessor가 SOA 뷰 컴포넌트를 Actor에 전달하는 인터페이스.
 * 각 뷰는 독립 패스로 순회되며, Actor는 필요한 Apply* 메서드만 오버라이드한다.
 * bForce == true  : 최초 스폰 또는 동기화 강제 — 모든 필드를 적용해야 함
 * bForce == false : 뷰의 `AnyDirty(Frame)`가 true일 때만 호출됨
 */
class IHktPresentableActor
{
	GENERATED_BODY()
public:
	virtual void SetEntityId(FHktEntityId InEntityId) = 0;

	/**
	 * 카메라/UI 가 "엔티티의 시각적 중앙"을 보고 싶을 때 사용할 월드 위치.
	 * 액터 타입별로 발 기준 좌표를 시각적 중앙으로 보정한다.
	 *  - 캡슐 액터: ActorLocation (루트가 캡슐 중심) — 기본값
	 *  - 스프라이트 액터: FlipbookComp 바운드 중앙으로 오버라이드
	 */
	virtual FVector GetFocusWorldLocation() const
	{
		const AActor* Self = Cast<const AActor>(_getUObject());
		return Self ? Self->GetActorLocation() : FVector::ZeroVector;
	}

	/**
	 * EntityHud 등 머리 위에 떠야 하는 월드 UI 의 앵커 위치 (= 캡슐 상단/머리).
	 * 액터 타입별로 ActorLocation 과 캡슐 좌표 컨벤션이 달라 각자 보정한다.
	 *  - HktUnitActor: 캡슐 루트, ActorLocation = 캡슐 중심 → +HalfHeight
	 *  - HktSpritePaperActor: RootScene 루트, ActorLocation = 발 → +2*HalfHeight
	 *  - 기본값: ActorLocation (보정 불가 시 폴백)
	 * UI 측에서 여기에 DataAsset 의 WorldOffset 을 더해 최종 HUD 앵커를 산출한다.
	 */
	virtual FVector GetHudAnchorWorldLocation() const
	{
		const AActor* Self = Cast<const AActor>(_getUObject());
		return Self ? Self->GetActorLocation() : FVector::ZeroVector;
	}

	/** 매 프레임 호출 (Transform 뷰가 있는 모든 엔터티) */
	virtual void ApplyTransform(const FHktTransformView& V) {}

	/** 뷰가 이번 프레임에 변경되었거나 bForce=true일 때 호출 */
	virtual void ApplyPhysics(const FHktPhysicsView& V, int64 Frame, bool bForce) {}
	virtual void ApplyMovement(const FHktMovementView& V, int64 Frame, bool bForce) {}
	virtual void ApplyVitals(const FHktVitalsView& V, int64 Frame, bool bForce) {}
	virtual void ApplyCombat(const FHktCombatView& V, int64 Frame, bool bForce) {}
	virtual void ApplyOwnership(const FHktOwnershipView& V, int64 Frame, bool bForce) {}
	/** Animation 뷰는 PendingAnimTriggers 소비를 위해 mutable */
	virtual void ApplyAnimation(FHktAnimationView& V, int64 Frame, bool bForce) {}
	virtual void ApplyVisualization(const FHktVisualizationView& V, int64 Frame, bool bForce) {}
	/** Item 뷰는 OwnerEntity 룩업을 위해 Actor 조회 콜백 필요 */
	virtual void ApplyItem(const FHktItemView& V, int64 Frame, bool bForce, TFunctionRef<AActor*(FHktEntityId)> GetActorFunc) {}
	virtual void ApplyVoxelSkin(const FHktVoxelSkinView& V, int64 Frame, bool bForce) {}
	/** 2D 스프라이트 캐릭터 전용. Facing / AnimStartTick 등 Paper2D / HISM 양 경로의 권위 입력. */
	virtual void ApplySprite(const FHktSpriteView& V, int64 Frame, bool bForce) {}
	virtual void ApplyTerrainDebris(const FHktTerrainDebrisView& V, int64 Frame, bool bForce) {}

	/** Processor가 에셋 로드 후 호출. Actor가 필요한 타입으로 Cast해서 사용. */
	virtual void OnVisualAssetLoaded(UHktTagDataAsset* InAsset) {}
};
