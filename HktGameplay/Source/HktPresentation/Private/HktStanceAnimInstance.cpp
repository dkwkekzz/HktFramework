// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktStanceAnimInstance.h"
#include "HktAnimInstance.h"
#include "Components/SkeletalMeshComponent.h"

void UHktStanceAnimInstance::NativeInitializeAnimation()
{
	Super::NativeInitializeAnimation();

	// Linked AnimInstance → 같은 SkeletalMeshComponent의 메인 AnimInstance가 부모
	USkeletalMeshComponent* MeshComp = GetSkelMeshComponent();
	if (MeshComp)
	{
		ParentAnimInstance = Cast<UHktAnimInstance>(MeshComp->GetAnimInstance());
	}
}

void UHktStanceAnimInstance::NativeUpdateAnimation(float DeltaSeconds)
{
	Super::NativeUpdateAnimation(DeltaSeconds);

	if (!ParentAnimInstance)
	{
		USkeletalMeshComponent* MeshComp = GetSkelMeshComponent();
		if (MeshComp)
		{
			ParentAnimInstance = Cast<UHktAnimInstance>(MeshComp->GetAnimInstance());
		}
		if (!ParentAnimInstance)
		{
			return;
		}
	}

	// 부모 UHktAnimInstance에서 데이터 동기화
	bIsMoving = ParentAnimInstance->bIsMoving;
	bIsJumping = ParentAnimInstance->bIsJumping;
	MoveSpeed = ParentAnimInstance->MoveSpeed;
	StanceTag = ParentAnimInstance->StanceTag;
	ActiveBlendSpace = ParentAnimInstance->ActiveBlendSpace;
	BlendSpaceX = ParentAnimInstance->BlendSpaceX;
	BlendSpaceY = ParentAnimInstance->BlendSpaceY;
}
