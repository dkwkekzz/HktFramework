// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Camera/HktCameraMode_ShoulderView.h"
#include "Actors/HktRtsCameraPawn.h"
#include "HktPresentationSubsystem.h"
#include "GameFramework/SpringArmComponent.h"
#include "GameFramework/PlayerController.h"

void UHktCameraMode_ShoulderView::OnActivate(AHktRtsCameraPawn* Pawn)
{
	if (!Pawn) return;

	USpringArmComponent* SpringArm = Pawn->GetSpringArm();
	if (SpringArm)
	{
		// 기존 SpringArm 세팅 백업
		SavedArmLength = SpringArm->TargetArmLength;
		SavedArmRotation = SpringArm->GetRelativeRotation();
		SavedSocketOffset = SpringArm->SocketOffset;

		// 숄더뷰용 세팅 적용
		SpringArm->TargetArmLength = ArmLength;
		SpringArm->SocketOffset = ShoulderOffset;

		// 현재 SpringArm 회전을 초기 Yaw/Pitch로 사용
		CurrentYaw = SavedArmRotation.Yaw;
		CurrentPitch = FMath::Clamp(-15.0f, MinPitch, MaxPitch);
		SpringArm->SetRelativeRotation(FRotator(CurrentPitch, CurrentYaw, 0.0f));
	}
}

void UHktCameraMode_ShoulderView::OnDeactivate(AHktRtsCameraPawn* Pawn)
{
	if (!Pawn) return;

	USpringArmComponent* SpringArm = Pawn->GetSpringArm();
	if (SpringArm)
	{
		// 백업된 세팅 복원
		SpringArm->TargetArmLength = SavedArmLength;
		SpringArm->SetRelativeRotation(SavedArmRotation);
		SpringArm->SocketOffset = SavedSocketOffset;
	}
}

void UHktCameraMode_ShoulderView::TickMode(AHktRtsCameraPawn* Pawn, float DeltaTime)
{
	if (!Pawn || SubjectEntityId == InvalidEntityId) return;

	APlayerController* PC = Pawn->GetBoundPC();
	if (!PC) return;

	UHktPresentationSubsystem* Sub = UHktPresentationSubsystem::Get(PC);
	if (!Sub) return;

	FVector EntityLoc = Sub->GetEntityActorLocation(SubjectEntityId);
	if (EntityLoc.IsZero()) return;

	// 마우스 델타로 카메라 회전
	float MouseX = 0.0f, MouseY = 0.0f;
	PC->GetInputMouseDelta(MouseX, MouseY);

	CurrentYaw += MouseX * MouseSensitivity;
	CurrentPitch = FMath::Clamp(CurrentPitch - MouseY * MouseSensitivity, MinPitch, MaxPitch);

	// SpringArm 회전 적용
	USpringArmComponent* SpringArm = Pawn->GetSpringArm();
	if (SpringArm)
	{
		SpringArm->SetRelativeRotation(FRotator(CurrentPitch, CurrentYaw, 0.0f));
	}

	// 대상 위치로 보간 이동
	FVector CurrentLoc = Pawn->GetActorLocation();
	FVector TargetLoc = FVector(EntityLoc.X, EntityLoc.Y, EntityLoc.Z);
	FVector NewLoc = FMath::VInterpTo(CurrentLoc, TargetLoc, DeltaTime, FollowInterpSpeed);
	Pawn->SetActorLocation(NewLoc);
}

void UHktCameraMode_ShoulderView::HandleZoom(AHktRtsCameraPawn* Pawn, float Value)
{
	if (!Pawn || Value == 0.0f) return;

	USpringArmComponent* SpringArm = Pawn->GetSpringArm();
	if (SpringArm)
	{
		SpringArm->TargetArmLength = FMath::Clamp(
			SpringArm->TargetArmLength - Value * ZoomSpeed,
			MinArmLength, MaxArmLength);
	}
}

void UHktCameraMode_ShoulderView::OnSubjectChanged(AHktRtsCameraPawn* Pawn, FHktEntityId EntityId)
{
	SubjectEntityId = EntityId;

	if (EntityId == InvalidEntityId)
	{
		// 대상이 없어지면 RtsFree로 복귀
		if (Pawn)
		{
			Pawn->SetCameraMode(EHktCameraMode::RtsFree);
		}
	}
}
