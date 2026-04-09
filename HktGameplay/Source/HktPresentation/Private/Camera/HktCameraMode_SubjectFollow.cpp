// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Camera/HktCameraMode_SubjectFollow.h"
#include "Actors/HktRtsCameraPawn.h"
#include "HktPresentationSubsystem.h"
#include "GameFramework/PlayerController.h"

void UHktCameraMode_SubjectFollow::OnActivate(AHktRtsCameraPawn* Pawn)
{
	if (!Pawn) return;

	// 현재 카메라와 대상 위치의 차이를 ManualOffset으로 설정하여 점프 방지
	if (SubjectEntityId != InvalidEntityId)
	{
		APlayerController* PC = Pawn->GetBoundPC();
		UHktPresentationSubsystem* Sub = PC ? UHktPresentationSubsystem::Get(PC) : nullptr;
		if (Sub)
		{
			FVector EntityLoc = Sub->GetEntityActorLocation(SubjectEntityId);
			if (!EntityLoc.IsZero())
			{
				FVector CameraLoc = Pawn->GetActorLocation();
				ManualOffset = FVector(CameraLoc.X - EntityLoc.X, CameraLoc.Y - EntityLoc.Y, 0.0f);
				return;
			}
		}
	}

	ManualOffset = FVector::ZeroVector;
}

void UHktCameraMode_SubjectFollow::TickMode(AHktRtsCameraPawn* Pawn, float DeltaTime)
{
	if (!Pawn || SubjectEntityId == InvalidEntityId) return;

	APlayerController* PC = Pawn->GetBoundPC();
	if (!PC) return;

	UHktPresentationSubsystem* Sub = UHktPresentationSubsystem::Get(PC);
	if (!Sub) return;

	FVector EntityLoc = Sub->GetEntityActorLocation(SubjectEntityId);
	if (EntityLoc.IsZero()) return;

	// 오프셋 감쇄
	ManualOffset = FMath::VInterpTo(ManualOffset, FVector::ZeroVector, DeltaTime, OffsetDecaySpeed);

	Pawn->SetActorLocation(EntityLoc);
}

void UHktCameraMode_SubjectFollow::OnSubjectChanged(AHktRtsCameraPawn* Pawn, FHktEntityId EntityId)
{
	SubjectEntityId = EntityId;

	if (EntityId == InvalidEntityId)
	{
		ManualOffset = FVector::ZeroVector;

		if (Pawn)
		{
			Pawn->SetCameraMode(EHktCameraMode::RtsFree);
		}
	}
}

void UHktCameraMode_SubjectFollow::HandleEdgeScrollOffset(AHktRtsCameraPawn* Pawn, float DeltaTime)
{
	APlayerController* PC = Pawn->GetBoundPC();
	if (!PC) return;

	int32 ViewportSizeX, ViewportSizeY;
	PC->GetViewportSize(ViewportSizeX, ViewportSizeY);
	if (ViewportSizeX <= 0 || ViewportSizeY <= 0) return;

	float MousePosX, MousePosY;
	if (PC->GetMousePosition(MousePosX, MousePosY))
	{
		FVector Direction = FVector::ZeroVector;
		const float EdgeX = ViewportSizeX * EdgeScrollThickness;
		const float EdgeY = ViewportSizeY * EdgeScrollThickness;

		if (MousePosX <= EdgeX)                          Direction.Y = -1.0f;
		else if (MousePosX >= ViewportSizeX - EdgeX)     Direction.Y = 1.0f;
		if (MousePosY <= EdgeY)                          Direction.X = 1.0f;
		else if (MousePosY >= ViewportSizeY - EdgeY)     Direction.X = -1.0f;

		if (!Direction.IsZero())
		{
			Direction.Normalize();
			ManualOffset += Direction * EdgeScrollSpeed * DeltaTime;
		}
	}
}
