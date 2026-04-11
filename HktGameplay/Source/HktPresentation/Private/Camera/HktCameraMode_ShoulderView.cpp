// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Camera/HktCameraMode_ShoulderView.h"
#include "Actors/HktRtsCameraPawn.h"
#include "HktPresentationSubsystem.h"
#include "GameFramework/SpringArmComponent.h"
#include "GameFramework/PawnMovementComponent.h"
#include "GameFramework/PlayerController.h"
#include "Framework/Application/SlateApplication.h"

void UHktCameraMode_ShoulderView::OnActivate(AHktRtsCameraPawn* Pawn)
{
	if (!Pawn) return;

	// SpectatorPawn의 기본 WASD 이동을 비활성화 — 숄더뷰에서는 대상 추적만 사용
	if (UPawnMovementComponent* MoveComp = Pawn->GetMovementComponent())
	{
		MoveComp->Deactivate();
	}

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

	// 커서를 캡처해서 화면 가장자리에서 mouse delta가 0으로 클램핑되는 것을 방지
	// (bShowMouseCursor=false 만으로는 부족 — InputMode를 GameOnly로 강제해야 함)
	if (APlayerController* PC = Pawn->GetBoundPC())
	{
		FInputModeGameOnly InputMode;
		InputMode.SetConsumeCaptureMouseDown(true);
		PC->SetInputMode(InputMode);
		PC->bShowMouseCursor = false;

		// 활성화 직후 누적된 마우스 delta 스파이크를 한 프레임 버린다
		float DummyX = 0.0f, DummyY = 0.0f;
		PC->GetInputMouseDelta(DummyX, DummyY);
	}
	bDiscardNextMouseDelta = true;
}

void UHktCameraMode_ShoulderView::OnDeactivate(AHktRtsCameraPawn* Pawn)
{
	if (!Pawn) return;

	// MovementComponent 재활성화
	if (UPawnMovementComponent* MoveComp = Pawn->GetMovementComponent())
	{
		MoveComp->Activate();
	}

	USpringArmComponent* SpringArm = Pawn->GetSpringArm();
	if (SpringArm)
	{
		// 백업된 세팅 복원
		SpringArm->TargetArmLength = SavedArmLength;
		SpringArm->SetRelativeRotation(SavedArmRotation);
		SpringArm->SocketOffset = SavedSocketOffset;
	}

	// 커서/입력 모드 복구 — RTS 모드에서 클릭 입력이 다시 동작하도록
	if (APlayerController* PC = Pawn->GetBoundPC())
	{
		FInputModeGameAndUI InputMode;
		InputMode.SetLockMouseToViewportBehavior(EMouseLockMode::DoNotLock);
		InputMode.SetHideCursorDuringCapture(false);
		PC->SetInputMode(InputMode);
		PC->bShowMouseCursor = true;
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

	// 마우스 델타로 카메라 회전 (ShoulderView에서는 마우스가 항상 방향 전환)
	float MouseX = 0.0f, MouseY = 0.0f;
	PC->GetInputMouseDelta(MouseX, MouseY);

	// 활성화 직후 첫 프레임의 누적 delta는 폐기 (스파이크로 인한 카메라 튐 방지)
	if (bDiscardNextMouseDelta)
	{
		bDiscardNextMouseDelta = false;
		MouseX = 0.0f;
		MouseY = 0.0f;
	}

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
	FVector NewLoc = FMath::VInterpTo(CurrentLoc, EntityLoc, DeltaTime, FollowInterpSpeed);
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
