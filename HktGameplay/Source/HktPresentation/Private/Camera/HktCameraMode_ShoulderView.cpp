// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Camera/HktCameraMode_ShoulderView.h"
#include "Camera/HktCameraFramingProfile.h"
#include "Actors/HktRtsCameraPawn.h"
#include "HktPresentationSubsystem.h"
#include "GameFramework/SpringArmComponent.h"
#include "GameFramework/PawnMovementComponent.h"
#include "GameFramework/PlayerController.h"

UHktCameraMode_ShoulderView::UHktCameraMode_ShoulderView()
{
	bShowMouseCursor = false;
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

	CurrentYaw = PrevYaw;
	CurrentPitch = FMath::Clamp(InitialPitch, ClampMin, ClampMax);

	if (USpringArmComponent* SpringArm = Pawn->GetSpringArm())
	{
		SpringArm->SetRelativeRotation(FRotator(CurrentPitch, CurrentYaw, 0.0f));
	}

	ApplyInputModeForSubject(Pawn);
}

void UHktCameraMode_ShoulderView::OnDeactivate(AHktRtsCameraPawn* Pawn)
{
	if (!Pawn) return;

	if (UPawnMovementComponent* MoveComp = Pawn->GetMovementComponent())
	{
		MoveComp->Activate();
	}

	Super::OnDeactivate(Pawn);

	// 커서/입력 모드 복구 — 다른 모드에서 클릭 입력이 정상 동작하도록
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
	if (!Pawn) return;

	// Subject가 없으면 베이스 동작(edge-scroll)으로 폴백 — 커서가 보이는 상태여야 한다
	if (SubjectEntityId == InvalidEntityId)
	{
		Super::TickMode(Pawn, DeltaTime);
		return;
	}

	APlayerController* PC = Pawn->GetBoundPC();
	if (!PC) return;

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

	const float ClampMin = Framing ? Framing->PitchClampMin : -60.0f;
	const float ClampMax = Framing ? Framing->PitchClampMax : 60.0f;

	CurrentYaw += MouseX * MouseSensitivity;
	CurrentPitch = FMath::Clamp(CurrentPitch - MouseY * MouseSensitivity, ClampMin, ClampMax);

	if (USpringArmComponent* SpringArm = Pawn->GetSpringArm())
	{
		SpringArm->SetRelativeRotation(FRotator(CurrentPitch, CurrentYaw, 0.0f));
	}

	// 베이스의 추적 로직 재사용 (Z 포함)
	TrackEntity(Pawn, SubjectEntityId, DeltaTime);
}

void UHktCameraMode_ShoulderView::OnSubjectChanged(AHktRtsCameraPawn* Pawn, FHktEntityId EntityId)
{
	Super::OnSubjectChanged(Pawn, EntityId);
	ApplyInputModeForSubject(Pawn);
}

void UHktCameraMode_ShoulderView::ApplyInputModeForSubject(AHktRtsCameraPawn* Pawn)
{
	if (!Pawn) return;

	APlayerController* PC = Pawn->GetBoundPC();
	if (!PC) return;

	if (SubjectEntityId != InvalidEntityId)
	{
		// 마우스룩: 커서 캡처해서 화면 가장자리에서 mouse delta가 0으로 클램핑되는 것을 방지
		FInputModeGameOnly InputMode;
		InputMode.SetConsumeCaptureMouseDown(true);
		PC->SetInputMode(InputMode);
		PC->bShowMouseCursor = false;

		// 활성화/전환 직후 누적된 마우스 delta 스파이크를 한 프레임 버린다
		float DummyX = 0.0f, DummyY = 0.0f;
		PC->GetInputMouseDelta(DummyX, DummyY);
		bDiscardNextMouseDelta = true;
	}
	else
	{
		// Subject 없음 → edge-scroll 폴백을 위해 커서 노출
		FInputModeGameAndUI InputMode;
		InputMode.SetLockMouseToViewportBehavior(EMouseLockMode::DoNotLock);
		InputMode.SetHideCursorDuringCapture(false);
		PC->SetInputMode(InputMode);
		PC->bShowMouseCursor = true;
	}
}
