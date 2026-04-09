// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Actors/HktRtsCameraPawn.h"
#include "HktPresentationSubsystem.h"
#include "HktPresentationState.h"
#include "IHktPlayerInteractionInterface.h"
#include "Camera/HktCameraModeBase.h"
#include "Camera/HktCameraMode_RtsFree.h"
#include "Camera/HktCameraMode_SubjectFollow.h"
#include "GameFramework/SpringArmComponent.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/PlayerController.h"
#include "Engine/LocalPlayer.h"

AHktRtsCameraPawn::AHktRtsCameraPawn()
{
	PrimaryActorTick.bCanEverTick = true;

	SpringArm = CreateDefaultSubobject<USpringArmComponent>(TEXT("SpringArm"));
	SpringArm->SetupAttachment(GetRootComponent());
	SpringArm->bDoCollisionTest = false;
	SpringArm->SetRelativeRotation(FRotator(-60.0f, 0.0f, 0.0f));
	SpringArm->TargetArmLength = 2000.0f;

	Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Camera"));
	Camera->SetupAttachment(SpringArm);

	RtsFreeMode = CreateDefaultSubobject<UHktCameraMode_RtsFree>(TEXT("RtsFreeMode"));
	SubjectFollowMode = CreateDefaultSubobject<UHktCameraMode_SubjectFollow>(TEXT("SubjectFollowMode"));
}

void AHktRtsCameraPawn::BeginPlay()
{
	Super::BeginPlay();

	APlayerController* PC = GetController<APlayerController>();
	BoundPlayerController = PC;

	IHktPlayerInteractionInterface* Interaction = Cast<IHktPlayerInteractionInterface>(PC);
	if (Interaction)
	{
		WheelInputHandle = Interaction->OnWheelInput().AddUObject(this, &AHktRtsCameraPawn::HandleZoom);
		SubjectChangedHandle = Interaction->OnSubjectChanged().AddUObject(this, &AHktRtsCameraPawn::OnSubjectChanged);
		CachedPlayerUid = Interaction->GetPlayerUid();
	}

	// 기본 모드로 시작
	SetCameraMode(EHktCameraMode::RtsFree);
}

void AHktRtsCameraPawn::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	if (APlayerController* PC = BoundPlayerController.Get())
	{
		if (IHktPlayerInteractionInterface* Interaction = Cast<IHktPlayerInteractionInterface>(PC))
		{
			if (WheelInputHandle.IsValid())
			{
				Interaction->OnWheelInput().Remove(WheelInputHandle);
				WheelInputHandle.Reset();
			}
			if (SubjectChangedHandle.IsValid())
			{
				Interaction->OnSubjectChanged().Remove(SubjectChangedHandle);
				SubjectChangedHandle.Reset();
			}
		}
	}
	BoundPlayerController.Reset();

	if (ActiveMode)
	{
		ActiveMode->OnDeactivate(this);
		ActiveMode = nullptr;
	}

	Super::EndPlay(EndPlayReason);
}

void AHktRtsCameraPawn::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);

	// PlayerUid가 지연 초기화될 수 있으므로 캐싱 재시도
	if (CachedPlayerUid == 0)
	{
		if (IHktPlayerInteractionInterface* Interaction = Cast<IHktPlayerInteractionInterface>(BoundPlayerController.Get()))
		{
			CachedPlayerUid = Interaction->GetPlayerUid();
		}
	}

	if (PendingSubjectEntityId != InvalidEntityId && CachedPlayerUid != 0)
	{
		CurrentSubjectEntityId = PendingSubjectEntityId;

		// PlayerUid가 확정되면 보류 중인 Subject에 대해 소유권 검증 후 모드 재평가
		if (IsOwnedEntity(PendingSubjectEntityId))
		{
			SetCameraMode(EHktCameraMode::SubjectFollow);
		}
		else
		{
			SetCameraMode(EHktCameraMode::RtsFree);
		}

		if (ActiveMode)
		{
			ActiveMode->OnSubjectChanged(this, PendingSubjectEntityId);
		}

		PendingSubjectEntityId = InvalidEntityId;
	}

	if (ActiveMode)
	{
		ActiveMode->TickMode(this, DeltaTime);
	}

	// 카메라 뷰 변경 감지 → PresentationSubsystem에 직접 통지
	const FVector NewLocation = GetActorLocation();
	const FRotator NewRotation = GetActorRotation();
	const float NewArmLength = SpringArm ? SpringArm->TargetArmLength : 0.f;

	if (!NewLocation.Equals(CachedCameraLocation)
		|| !NewRotation.Equals(CachedCameraRotation)
		|| NewArmLength != CachedArmLength)
	{
		CachedCameraLocation = NewLocation;
		CachedCameraRotation = NewRotation;
		CachedArmLength = NewArmLength;

		if (APlayerController* PC = BoundPlayerController.Get())
		{
			if (UHktPresentationSubsystem* Sub = UHktPresentationSubsystem::Get(PC))
			{
				Sub->NotifyCameraViewChanged();
			}
		}
	}
}

void AHktRtsCameraPawn::HandleZoom(float Value)
{
	if (ActiveMode)
	{
		ActiveMode->HandleZoom(this, Value);
	}
}

void AHktRtsCameraPawn::OnSubjectChanged(FHktEntityId EntityId)
{
	if (CurrentSubjectEntityId != EntityId)
	{
		PendingSubjectEntityId = EntityId;
	}
}

bool AHktRtsCameraPawn::IsOwnedEntity(FHktEntityId EntityId) const
{
	if (CachedPlayerUid == 0) return false;

	APlayerController* PC = BoundPlayerController.Get();
	if (!PC) return false;

	UHktPresentationSubsystem* Sub = UHktPresentationSubsystem::Get(PC);
	if (!Sub) return false;

	const FHktEntityPresentation* E = Sub->GetState().Get(EntityId);
	if (!E) return false;

	return E->OwnedPlayerUid.Get() == CachedPlayerUid;
}

void AHktRtsCameraPawn::SetCameraMode(EHktCameraMode NewMode)
{
	if (ActiveModeType == NewMode && ActiveMode) return;

	if (ActiveMode)
	{
		ActiveMode->OnDeactivate(this);
	}

	ActiveModeType = NewMode;
	ActiveMode = GetModeInstance(NewMode);

	if (ActiveMode)
	{
		ActiveMode->OnActivate(this);
	}
}

UHktCameraModeBase* AHktRtsCameraPawn::GetModeInstance(EHktCameraMode Mode) const
{
	switch (Mode)
	{
	case EHktCameraMode::RtsFree:        return RtsFreeMode;
	case EHktCameraMode::SubjectFollow:  return SubjectFollowMode;
	default:                             return RtsFreeMode;
	}
}
