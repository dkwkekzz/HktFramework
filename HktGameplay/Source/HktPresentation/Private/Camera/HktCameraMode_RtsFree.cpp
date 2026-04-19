// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Camera/HktCameraMode_RtsFree.h"
#include "Actors/HktRtsCameraPawn.h"
#include "HktPresentationSubsystem.h"
#include "HktPresentationState.h"
#include "GameFramework/PlayerController.h"

void UHktCameraMode_RtsFree::OnActivate(AHktRtsCameraPawn* Pawn)
{
	bFollowNewSpawn = true;
	FollowTargetEntityId = InvalidEntityId;
}

void UHktCameraMode_RtsFree::TickMode(AHktRtsCameraPawn* Pawn, float DeltaTime)
{
	HandleEdgeScroll(Pawn, DeltaTime);
	FollowNewSpawn(Pawn, DeltaTime);
}

void UHktCameraMode_RtsFree::OnSubjectChanged(AHktRtsCameraPawn* Pawn, FHktEntityId EntityId)
{
	if (EntityId == InvalidEntityId)
	{
		bFollowNewSpawn = true;
		FollowTargetEntityId = InvalidEntityId;
	}
	else
	{
		bFollowNewSpawn = false;
		FollowTargetEntityId = EntityId;
	}
}

void UHktCameraMode_RtsFree::HandleEdgeScroll(AHktRtsCameraPawn* Pawn, float DeltaTime)
{
	if (!Pawn) return;

	APlayerController* PC = Pawn->GetBoundPC();
	if (!PC) return;

	int32 ViewportSizeX, ViewportSizeY;
	PC->GetViewportSize(ViewportSizeX, ViewportSizeY);
	if (ViewportSizeX <= 0 || ViewportSizeY <= 0) return;

	float MousePosX, MousePosY;
	if (PC->GetMousePosition(MousePosX, MousePosY))
	{
		FVector DirectionToMove = FVector::ZeroVector;
		const float EdgeX = ViewportSizeX * EdgeScrollThickness;
		const float EdgeY = ViewportSizeY * EdgeScrollThickness;

		if (MousePosX <= EdgeX)                          DirectionToMove.Y = -1.0f;
		else if (MousePosX >= ViewportSizeX - EdgeX)     DirectionToMove.Y = 1.0f;
		if (MousePosY <= EdgeY)                          DirectionToMove.X = 1.0f;
		else if (MousePosY >= ViewportSizeY - EdgeY)     DirectionToMove.X = -1.0f;

		if (!DirectionToMove.IsZero())
		{
			DirectionToMove.Normalize();
			Pawn->AddActorWorldOffset(DirectionToMove * CameraScrollSpeed * DeltaTime);
		}
	}
}

void UHktCameraMode_RtsFree::FollowNewSpawn(AHktRtsCameraPawn* Pawn, float DeltaTime)
{
	if (!bFollowNewSpawn || !Pawn) return;

	APlayerController* PC = Pawn->GetBoundPC();
	if (!PC) return;

	UHktPresentationSubsystem* Sub = UHktPresentationSubsystem::Get(PC);
	if (!Sub) return;

	const FHktPresentationState& State = Sub->GetState();

	if (State.SpawnedThisFrame.Num() > 0)
	{
		FollowTargetEntityId = State.SpawnedThisFrame.Last();
	}

	if (FollowTargetEntityId == InvalidEntityId) return;

	if (!State.IsValid(FollowTargetEntityId))
	{
		FollowTargetEntityId = InvalidEntityId;
		return;
	}

	FVector TargetLoc = Sub->GetEntityActorLocation(FollowTargetEntityId);
	FVector CurrentLoc = Pawn->GetActorLocation();
	FVector NewLoc = FMath::VInterpTo(CurrentLoc, FVector(TargetLoc.X, TargetLoc.Y, CurrentLoc.Z), DeltaTime, FollowInterpSpeed);
	Pawn->SetActorLocation(NewLoc);
}
