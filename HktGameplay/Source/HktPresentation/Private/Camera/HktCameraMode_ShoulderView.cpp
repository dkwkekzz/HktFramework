// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Camera/HktCameraMode_ShoulderView.h"
#include "Camera/HktCameraFramingProfile.h"
#include "Actors/HktRtsCameraPawn.h"
#include "IHktPlayerInteractionInterface.h"
#include "HktPresentationSubsystem.h"
#include "GameFramework/SpringArmComponent.h"
#include "GameFramework/PawnMovementComponent.h"
#include "GameFramework/PlayerController.h"
#include "InputCoreTypes.h"

UHktCameraMode_ShoulderView::UHktCameraMode_ShoulderView()
{
	// 기본은 커서 노출 — 회전은 우클릭을 누르는 동안만.
	bShowMouseCursor = true;
	FollowInterpSpeed = 10.0f;

	Framing = CreateDefaultSubobject<UHktCameraFramingProfile>(TEXT("Framing"));
	Framing->ProjectionMode = ECameraProjectionMode::Perspective;
	Framing->FieldOfView = 90.0f;
	Framing->DefaultPitch = -15.0f;
	Framing->DefaultYaw = 0.0f;
	Framing->PitchClampMin = -60.0f;
	Framing->PitchClampMax = 60.0f;
	Framing->DefaultArmLength = 300.0f;
	Framing->MinArmLength = 150.0f;
	Framing->MaxArmLength = 600.0f;
	Framing->SocketOffset = FVector(0.0f, 50.0f, 80.0f);
	Framing->ZoomStep = 30.0f;
}

void UHktCameraMode_ShoulderView::OnActivate(AHktRtsCameraPawn* Pawn)
{
	if (!Pawn) return;

	// SpectatorPawn의 기본 WASD 이동을 비활성화 — 위치는 추적/edge-scroll로만 제어
	if (UPawnMovementComponent* MoveComp = Pawn->GetMovementComponent())
	{
		MoveComp->Deactivate();
	}

	// Framing 적용 전 이전 Yaw를 캡처 — 모드 전환 시 시선 방향 유지
	float PrevYaw = 0.0f;
	if (USpringArmComponent* SpringArm = Pawn->GetSpringArm())
	{
		PrevYaw = SpringArm->GetRelativeRotation().Yaw;
	}

	Super::OnActivate(Pawn);

	const float ClampMin = Framing ? Framing->PitchClampMin : -60.0f;
	const float ClampMax = Framing ? Framing->PitchClampMax : 60.0f;
	const float InitialPitch = Framing ? Framing->DefaultPitch : -15.0f;

	// 기존 뷰(복귀 목표)와 현재 뷰를 동일하게 초기화
	RestYaw = FRotator::NormalizeAxis(PrevYaw);
	RestPitch = FMath::Clamp(InitialPitch, ClampMin, ClampMax);
	CurrentYaw = RestYaw;
	CurrentPitch = RestPitch;
	bRotating = false;

	if (USpringArmComponent* SpringArm = Pawn->GetSpringArm())
	{
		SpringArm->SetRelativeRotation(FRotator(CurrentPitch, CurrentYaw, 0.0f));
	}

	// 진입 시 커서 노출 — 좌클릭 선택 가능
	EnterCursorMode(Pawn);
}

void UHktCameraMode_ShoulderView::OnDeactivate(AHktRtsCameraPawn* Pawn)
{
	if (!Pawn) return;

	if (UPawnMovementComponent* MoveComp = Pawn->GetMovementComponent())
	{
		MoveComp->Activate();
	}

	Super::OnDeactivate(Pawn);

	// 다른 모드로 전환 시 클릭-이동 재허용 + 커서/입력 모드 복구
	if (APlayerController* PC = Pawn->GetBoundPC())
	{
		if (IHktPlayerInteractionInterface* Interaction = Cast<IHktPlayerInteractionInterface>(PC))
		{
			Interaction->SetTargetActionEnabled(true);
		}

		FInputModeGameAndUI InputMode;
		InputMode.SetLockMouseToViewportBehavior(EMouseLockMode::DoNotLock);
		InputMode.SetHideCursorDuringCapture(false);
		PC->SetInputMode(InputMode);
		PC->bShowMouseCursor = true;
	}
}

void UHktCameraMode_ShoulderView::TickMode(AHktRtsCameraPawn* Pawn, float DeltaTime)
{
	if (!Pawn) return;

	APlayerController* PC = Pawn->GetBoundPC();
	if (!PC) return;

	// 우클릭을 누르고 있는 동안만 마우스룩. 떼면 기존 뷰로 복귀.
	const bool bWantRotate = PC->IsInputKeyDown(EKeys::RightMouseButton);
	if (bWantRotate && !bRotating)
	{
		EnterRotateMode(Pawn);
	}
	else if (!bWantRotate && bRotating)
	{
		EnterCursorMode(Pawn);
	}

	const float ClampMin = Framing ? Framing->PitchClampMin : -60.0f;
	const float ClampMax = Framing ? Framing->PitchClampMax : 60.0f;

	if (bRotating)
	{
		// 마우스 델타로 카메라 회전
		float MouseX = 0.0f, MouseY = 0.0f;
		PC->GetInputMouseDelta(MouseX, MouseY);

		if (bDiscardNextMouseDelta)
		{
			bDiscardNextMouseDelta = false;
			MouseX = 0.0f;
			MouseY = 0.0f;
		}

		CurrentYaw += MouseX * MouseSensitivity;
		CurrentPitch = FMath::Clamp(CurrentPitch - MouseY * MouseSensitivity, ClampMin, ClampMax);
	}
	else
	{
		// 우클릭을 뗀 상태 → 기존 뷰(RestYaw/RestPitch)로 최단경로 보간 복귀
		if (ReturnInterpSpeed > 0.0f)
		{
			const FRotator Cur(CurrentPitch, CurrentYaw, 0.0f);
			const FRotator Rest(RestPitch, RestYaw, 0.0f);
			const FRotator New = FMath::RInterpTo(Cur, Rest, DeltaTime, ReturnInterpSpeed);
			CurrentYaw = New.Yaw;
			CurrentPitch = New.Pitch;
		}
		else
		{
			CurrentYaw = RestYaw;
			CurrentPitch = RestPitch;
		}
	}

	if (USpringArmComponent* SpringArm = Pawn->GetSpringArm())
	{
		SpringArm->SetRelativeRotation(FRotator(CurrentPitch, CurrentYaw, 0.0f));
	}

	// 위치 추적: Subject 있으면 추적, 없으면 edge-scroll 폴백
	if (SubjectEntityId != InvalidEntityId)
	{
		TrackEntity(Pawn, SubjectEntityId, DeltaTime);
	}
	else
	{
		HandleEdgeScroll(Pawn, DeltaTime);
	}
}

void UHktCameraMode_ShoulderView::EnterCursorMode(AHktRtsCameraPawn* Pawn)
{
	if (!Pawn) return;

	APlayerController* PC = Pawn->GetBoundPC();
	if (!PC) return;

	bRotating = false;

	// 커서를 우클릭 회전 전용으로 쓰므로 클릭-이동/공격은 끈다 (I-0045).
	// 좌클릭 선택(OnSubjectAction)은 그대로 동작 — 커서가 보이므로 커서 기준 선택.
	if (IHktPlayerInteractionInterface* Interaction = Cast<IHktPlayerInteractionInterface>(PC))
	{
		Interaction->SetTargetActionEnabled(false);
	}

	FInputModeGameAndUI InputMode;
	InputMode.SetLockMouseToViewportBehavior(EMouseLockMode::DoNotLock);
	InputMode.SetHideCursorDuringCapture(false);
	PC->SetInputMode(InputMode);
	PC->bShowMouseCursor = true;
}

void UHktCameraMode_ShoulderView::EnterRotateMode(AHktRtsCameraPawn* Pawn)
{
	if (!Pawn) return;

	APlayerController* PC = Pawn->GetBoundPC();
	if (!PC) return;

	bRotating = true;

	// 마우스룩: 커서 캡처해서 화면 가장자리에서 mouse delta가 0으로 클램핑되는 것을 방지
	FInputModeGameOnly InputMode;
	InputMode.SetConsumeCaptureMouseDown(true);
	PC->SetInputMode(InputMode);
	PC->bShowMouseCursor = false;

	// 진입 직후 누적된 마우스 delta 스파이크를 한 프레임 버린다
	float DummyX = 0.0f, DummyY = 0.0f;
	PC->GetInputMouseDelta(DummyX, DummyY);
	bDiscardNextMouseDelta = true;
}
