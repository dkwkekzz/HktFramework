// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Camera/HktCameraMode_IsometricBase.h"
#include "Actors/HktRtsCameraPawn.h"
#include "HktPresentationSubsystem.h"
#include "GameFramework/SpringArmComponent.h"
#include "GameFramework/PlayerController.h"

void UHktCameraMode_IsometricBase::OnActivate(AHktRtsCameraPawn* Pawn)
{
	if (!Pawn) return;

	USpringArmComponent* SpringArm = Pawn->GetSpringArm();
	if (SpringArm)
	{
		SavedArmLength = SpringArm->TargetArmLength;
		SavedArmRotation = SpringArm->GetRelativeRotation();
	}

	CurrentYaw = InitialYaw;
	UpdateSpringArmRotation(Pawn);

	// 파생 클래스의 투영/줌 초기화
	ApplyProjectionSettings(Pawn);
}

void UHktCameraMode_IsometricBase::OnDeactivate(AHktRtsCameraPawn* Pawn)
{
	if (!Pawn) return;

	// 파생 클래스의 투영 원복이 먼저 실행되어야 한다
	// (Ortho→Perspective 복귀 시 다음 모드의 ArmLength 세팅이 올바르게 반영되도록)
	RestoreProjectionSettings(Pawn);

	if (USpringArmComponent* SpringArm = Pawn->GetSpringArm())
	{
		SpringArm->TargetArmLength = SavedArmLength;
		SpringArm->SetRelativeRotation(SavedArmRotation);
	}
}

void UHktCameraMode_IsometricBase::TickMode(AHktRtsCameraPawn* Pawn, float DeltaTime)
{
	if (!Pawn) return;

	APlayerController* PC = Pawn->GetBoundPC();
	if (!PC) return;

	UHktPresentationSubsystem* Sub = UHktPresentationSubsystem::Get(PC);
	if (!Sub) return;

	FVector TargetLoc = FVector::ZeroVector;
	bool bHasTarget = false;

	if (SubjectEntityId != InvalidEntityId)
	{
		const FVector EntityLoc = Sub->GetEntityActorLocation(SubjectEntityId);
		if (!EntityLoc.IsZero())
		{
			TargetLoc = EntityLoc;
			bHasTarget = true;
		}
	}

	if (bHasTarget)
	{
		const FVector CurrentLoc = Pawn->GetActorLocation();
		const FVector NewLoc = (FollowInterpSpeed > 0.0f)
			? FMath::VInterpTo(CurrentLoc, TargetLoc, DeltaTime, FollowInterpSpeed)
			: TargetLoc;
		Pawn->SetActorLocation(NewLoc);
	}
}

void UHktCameraMode_IsometricBase::OnSubjectChanged(AHktRtsCameraPawn* Pawn, FHktEntityId EntityId)
{
	SubjectEntityId = EntityId;
}

void UHktCameraMode_IsometricBase::RotateYaw(AHktRtsCameraPawn* Pawn, int32 Direction)
{
	if (!bAllowYawSnapRotation || Direction == 0) return;

	const float Step = (Direction > 0) ? 90.0f : -90.0f;
	CurrentYaw = FMath::UnwindDegrees(CurrentYaw + Step);
	UpdateSpringArmRotation(Pawn);
}

void UHktCameraMode_IsometricBase::UpdateSpringArmRotation(AHktRtsCameraPawn* Pawn) const
{
	if (!Pawn) return;

	if (USpringArmComponent* SpringArm = Pawn->GetSpringArm())
	{
		SpringArm->SetRelativeRotation(FRotator(Pitch, CurrentYaw, 0.0f));
	}
}
