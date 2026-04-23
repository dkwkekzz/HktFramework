// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Camera/HktCameraModeBase.h"
#include "Camera/HktCameraFramingProfile.h"
#include "Actors/HktRtsCameraPawn.h"
#include "HktPresentationSubsystem.h"
#include "HktPresentationState.h"
#include "GameFramework/SpringArmComponent.h"
#include "GameFramework/PlayerController.h"

void UHktCameraModeBase::OnActivate(AHktRtsCameraPawn* Pawn)
{
	if (Framing && Pawn)
	{
		Framing->Apply(Pawn);
		Framing->ApplyDefaultRotation(Pawn);
	}
}

void UHktCameraModeBase::OnDeactivate(AHktRtsCameraPawn* Pawn)
{
	if (Framing && Pawn)
	{
		Framing->Restore(Pawn);
	}
}

void UHktCameraModeBase::TickMode(AHktRtsCameraPawn* Pawn, float DeltaTime)
{
	if (!Pawn) return;

	// 우선순위: 명시적 Subject > 자동 추적 타겟 > 자체 컨트롤(edge-scroll)
	FHktEntityId TrackId = SubjectEntityId;
	if (TrackId == InvalidEntityId && bAutoFollowNewSpawn)
	{
		TrackId = ResolveAutoFollowTarget(Pawn);
	}

	if (TrackId != InvalidEntityId)
	{
		TrackEntity(Pawn, TrackId, DeltaTime);
	}
	else
	{
		HandleEdgeScroll(Pawn, DeltaTime);
	}
}

void UHktCameraModeBase::HandleZoom(AHktRtsCameraPawn* Pawn, float Value)
{
	if (Framing)
	{
		Framing->HandleZoom(Pawn, Value);
		return;
	}

	// Framing이 없으면 SpringArm 직접 조정 (기본 폴백)
	if (!Pawn) return;
	USpringArmComponent* SpringArm = Pawn->GetSpringArm();
	if (SpringArm && Value != 0.0f)
	{
		SpringArm->TargetArmLength = FMath::Clamp(
			SpringArm->TargetArmLength - Value * Pawn->GetZoomSpeed(),
			Pawn->GetMinZoom(), Pawn->GetMaxZoom());
	}
}

void UHktCameraModeBase::OnSubjectChanged(AHktRtsCameraPawn* Pawn, FHktEntityId EntityId)
{
	SubjectEntityId = EntityId;

	// 명시적 Subject가 잡히면 자동 추적 타겟은 클리어 — 그래야 Subject가 해제됐을 때
	// 마지막 Subject로 다시 돌아가지 않고 다음 새 스폰을 잡는다.
	if (EntityId != InvalidEntityId)
	{
		AutoFollowEntityId = InvalidEntityId;
	}
}

void UHktCameraModeBase::TrackEntity(AHktRtsCameraPawn* Pawn, FHktEntityId EntityId, float DeltaTime)
{
	APlayerController* PC = Pawn->GetBoundPC();
	if (!PC) return;

	UHktPresentationSubsystem* Sub = UHktPresentationSubsystem::Get(PC);
	if (!Sub) return;

	const FVector EntityLoc = Sub->GetEntityActorLocation(EntityId);
	if (EntityLoc.IsZero()) return;

	const FVector CurrentLoc = Pawn->GetActorLocation();
	FVector TargetLoc = bTrackSubjectZ
		? EntityLoc
		: FVector(EntityLoc.X, EntityLoc.Y, CurrentLoc.Z);

	const FVector NewLoc = (FollowInterpSpeed > 0.0f)
		? FMath::VInterpTo(CurrentLoc, TargetLoc, DeltaTime, FollowInterpSpeed)
		: TargetLoc;
	Pawn->SetActorLocation(NewLoc);
}

FHktEntityId UHktCameraModeBase::ResolveAutoFollowTarget(AHktRtsCameraPawn* Pawn)
{
	if (!Pawn) return InvalidEntityId;

	APlayerController* PC = Pawn->GetBoundPC();
	if (!PC) return InvalidEntityId;

	UHktPresentationSubsystem* Sub = UHktPresentationSubsystem::Get(PC);
	if (!Sub) return InvalidEntityId;

	const FHktPresentationState& State = Sub->GetState();

	// 새 스폰이 있으면 가장 최근 것을 자동 추적 타겟으로 채택
	if (State.SpawnedThisFrame.Num() > 0)
	{
		AutoFollowEntityId = State.SpawnedThisFrame.Last();
	}

	// 기존 타겟이 사라졌으면 클리어
	if (AutoFollowEntityId != InvalidEntityId && !State.IsValid(AutoFollowEntityId))
	{
		AutoFollowEntityId = InvalidEntityId;
	}

	return AutoFollowEntityId;
}

void UHktCameraModeBase::HandleEdgeScroll(AHktRtsCameraPawn* Pawn, float DeltaTime)
{
	APlayerController* PC = Pawn->GetBoundPC();
	if (!PC) return;

	int32 ViewportSizeX, ViewportSizeY;
	PC->GetViewportSize(ViewportSizeX, ViewportSizeY);
	if (ViewportSizeX <= 0 || ViewportSizeY <= 0) return;

	float MousePosX, MousePosY;
	if (!PC->GetMousePosition(MousePosX, MousePosY)) return;

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
		Pawn->AddActorWorldOffset(Direction * EdgeScrollSpeed * DeltaTime);
	}
}
