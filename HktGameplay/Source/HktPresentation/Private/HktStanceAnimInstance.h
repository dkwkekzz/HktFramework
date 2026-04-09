// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Animation/AnimInstance.h"
#include "GameplayTagContainer.h"
#include "HktStanceAnimInstance.generated.h"

class UHktAnimInstance;
class UBlendSpace;

/**
 * UHktStanceAnimInstance
 *
 * Stance별 ABP의 베이스 AnimInstance.
 * LinkAnimClassLayers()로 MainABP에 연결되어 Stance 그래프를 제공한다.
 *
 * MainABP(UHktAnimInstance)에서 LinkAnimClassLayers로 이 클래스의 파생 ABP를 연결하면,
 * NativeUpdateAnimation에서 부모의 데이터를 자동 동기화한다.
 *
 * Stance별 ABP에서 이 클래스의 프로퍼티를 사용하여 StateMachine을 구성:
 *   - bIsMoving, MoveSpeed → Idle/Walk/Run 전환
 *   - ActiveBlendSpace, BlendSpaceX/Y → BlendSpace 노드
 *   - Stance → 현재 Stance 확인 (필요시)
 */
UCLASS()
class HKTPRESENTATION_API UHktStanceAnimInstance : public UAnimInstance
{
	GENERATED_BODY()

public:
	virtual void NativeInitializeAnimation() override;
	virtual void NativeUpdateAnimation(float DeltaSeconds) override;

	// ========== Stance 상태 (매 프레임 부모에서 동기화) ==========

	UPROPERTY(BlueprintReadOnly, Category = "HKT|Stance")
	bool bIsMoving = false;

	UPROPERTY(BlueprintReadOnly, Category = "HKT|Stance")
	float MoveSpeed = 0.0f;

	UPROPERTY(BlueprintReadOnly, Category = "HKT|Stance")
	bool bIsJumping = false;

	UPROPERTY(BlueprintReadOnly, Category = "HKT|Stance")
	FGameplayTag StanceTag;

	UPROPERTY(BlueprintReadOnly, Category = "HKT|Stance")
	TObjectPtr<UBlendSpace> ActiveBlendSpace;

	UPROPERTY(BlueprintReadOnly, Category = "HKT|Stance")
	float BlendSpaceX = 0.0f;

	UPROPERTY(BlueprintReadOnly, Category = "HKT|Stance")
	float BlendSpaceY = 0.0f;

private:
	/** 부모 UHktAnimInstance (캐시) */
	UPROPERTY()
	TObjectPtr<UHktAnimInstance> ParentAnimInstance;
};
