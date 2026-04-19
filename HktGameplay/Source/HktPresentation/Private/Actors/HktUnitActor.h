// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "HktSelectable.h"
#include "IHktPresentableActor.h"
#include "HktUnitActor.generated.h"

class UCapsuleComponent;
class USkeletalMeshComponent;
class UHktAnimInstance;

/**
 * 캐릭터/유닛용 Actor.
 * IHktSelectable을 구현하여 커서 트레이스로 선택 가능.
 * 물리 충돌 없이 Visibility 채널만 응답 (QueryOnly).
 */
UCLASS(Blueprintable)
class AHktUnitActor : public AActor, public IHktSelectable, public IHktPresentableActor
{
	GENERATED_BODY()

public:
	AHktUnitActor();

	// IHktSelectable
	virtual FHktEntityId GetEntityId() const override { return CachedEntityId; }

	virtual void Tick(float DeltaTime) override;

	// IHktPresentableActor
	virtual void SetEntityId(FHktEntityId InEntityId) override { CachedEntityId = InEntityId; }
	virtual void ApplyTransform(const FHktTransformView& V) override;
	virtual void ApplyPhysics(const FHktPhysicsView& V, int64 Frame, bool bForce) override;
	virtual void ApplyMovement(const FHktMovementView& V, int64 Frame, bool bForce) override;
	virtual void ApplyCombat(const FHktCombatView& V, int64 Frame, bool bForce) override;
	virtual void ApplyAnimation(FHktAnimationView& V, int64 Frame, bool bForce) override;

protected:
	UPROPERTY(VisibleAnywhere, Category = "HKT|Unit")
	TObjectPtr<UCapsuleComponent> CapsuleComponent;

	UPROPERTY(VisibleAnywhere, Category = "HKT|Unit")
	TObjectPtr<USkeletalMeshComponent> MeshComponent;

	USkeletalMeshComponent* GetMeshComponent() const { return MeshComponent; }

private:
	FHktEntityId CachedEntityId = InvalidEntityId;

	/** 위치 보간용 현재 시각 위치 (RenderLocation을 향해 매 프레임 VInterpTo) */
	FVector InterpLocation = FVector::ZeroVector;
	FVector CachedRenderLocation = FVector::ZeroVector;
	FRotator InterpRotation = FRotator::ZeroRotator;
	FRotator CachedRotation = FRotator::ZeroRotator;
	bool bHasInitialTransform = false;

	/** 캐시된 AnimInstance (매 프레임 FindComponent 방지) */
	TWeakObjectPtr<UHktAnimInstance> CachedAnimInstance;

	UHktAnimInstance* GetAnimInstance();
};
