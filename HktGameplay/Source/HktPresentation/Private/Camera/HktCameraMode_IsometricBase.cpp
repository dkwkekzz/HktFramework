// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Camera/HktCameraMode_IsometricBase.h"
#include "Camera/HktCameraFramingProfile.h"
#include "Actors/HktRtsCameraPawn.h"
#include "HktPresentationSubsystem.h"
#include "GameFramework/SpringArmComponent.h"
#include "GameFramework/PlayerController.h"

void UHktCameraMode_IsometricBase::OnActivate(AHktRtsCameraPawn* Pawn)
{
	if (!Pawn) return;

	if (Framing)
	{
		Framing->Apply(Pawn);
		CurrentYaw = Framing->DefaultYaw;
	}

	UpdateSpringArmRotation(Pawn);
}

void UHktCameraMode_IsometricBase::OnDeactivate(AHktRtsCameraPawn* Pawn)
{
	if (!Pawn) return;

	if (Framing)
	{
		Framing->Restore(Pawn);
	}
}

void UHktCameraMode_IsometricBase::TickMode(AHktRtsCameraPawn* Pawn, float DeltaTime)
{
	if (!Pawn) return;

	if (SubjectEntityId == InvalidEntityId) return;

	APlayerController* PC = Pawn->GetBoundPC();
	if (!PC) return;

	UHktPresentationSubsystem* Sub = UHktPresentationSubsystem::Get(PC);
	if (!Sub) return;

	const FVector EntityLoc = Sub->GetEntityActorLocation(SubjectEntityId);
	if (EntityLoc.IsZero()) return;

	const FVector CurrentLoc = Pawn->GetActorLocation();
	const FVector NewLoc = (FollowInterpSpeed > 0.0f)
		? FMath::VInterpTo(CurrentLoc, EntityLoc, DeltaTime, FollowInterpSpeed)
		: EntityLoc;
	Pawn->SetActorLocation(NewLoc);
}

void UHktCameraMode_IsometricBase::HandleZoom(AHktRtsCameraPawn* Pawn, float Value)
{
	if (Framing)
	{
		Framing->HandleZoom(Pawn, Value);
	}
}

void UHktCameraMode_IsometricBase::OnSubjectChanged(AHktRtsCameraPawn* Pawn, FHktEntityId EntityId)
{
	SubjectEntityId = EntityId;

	if (EntityId == InvalidEntityId && bFallbackToRtsOnSubjectLost && Pawn)
	{
		Pawn->SetCameraMode(EHktCameraMode::RtsFree);
	}
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

	const float Pitch = Framing ? Framing->DefaultPitch : -30.0f;

	if (USpringArmComponent* SpringArm = Pawn->GetSpringArm())
	{
		SpringArm->SetRelativeRotation(FRotator(Pitch, CurrentYaw, 0.0f));
	}
}
