// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Actors/HktRtsCameraPawn.h"
#include "HktPresentationSubsystem.h"
#include "HktPresentationState.h"
#include "IHktPlayerInteractionInterface.h"
#include "Camera/HktCameraModeBase.h"
#include "Camera/HktCameraMode_RtsFree.h"
#include "Camera/HktCameraMode_SubjectFollow.h"
#include "Camera/HktCameraMode_ShoulderView.h"
#include "Camera/HktCameraMode_IsometricOrtho.h"
#include "Camera/HktCameraMode_IsometricGame.h"
#include "GameFramework/SpringArmComponent.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/PlayerController.h"
#include "Engine/LocalPlayer.h"
#include "Engine/World.h"
#include "HAL/IConsoleManager.h"
#include "EnhancedInputSubsystems.h"
#include "InputMappingContext.h"

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
	ShoulderViewMode = CreateDefaultSubobject<UHktCameraMode_ShoulderView>(TEXT("ShoulderViewMode"));
	IsometricOrthoMode = CreateDefaultSubobject<UHktCameraMode_IsometricOrtho>(TEXT("IsometricOrthoMode"));
	IsometricGameMode = CreateDefaultSubobject<UHktCameraMode_IsometricGame>(TEXT("IsometricGameMode"));
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

		// EndPlay 시 활성 모드의 InputMappingContext 제거
		if (ActiveMode && ActiveMode->InputMappingContext)
		{
			if (UEnhancedInputLocalPlayerSubsystem* InputSubsystem = ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PC->GetLocalPlayer()))
			{
				InputSubsystem->RemoveMappingContext(ActiveMode->InputMappingContext);
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
		// SetCameraMode 내부에서 OnSubjectChanged를 호출하므로 별도 호출 불필요
		if (IsOwnedEntity(PendingSubjectEntityId))
		{
			SetCameraMode(EHktCameraMode::SubjectFollow);
		}
		else
		{
			SetCameraMode(EHktCameraMode::RtsFree);
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

	const FHktOwnershipView* O = Sub->GetState().GetOwnership(EntityId);
	if (!O) return false;

	return O->OwnedPlayerUid.Get() == CachedPlayerUid;
}

void AHktRtsCameraPawn::SetCameraMode(EHktCameraMode NewMode)
{
	if (ActiveModeType == NewMode && ActiveMode) return;

	APlayerController* PC = BoundPlayerController.Get();
	UEnhancedInputLocalPlayerSubsystem* InputSubsystem = nullptr;
	if (PC)
	{
		InputSubsystem = ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PC->GetLocalPlayer());
	}

	if (ActiveMode)
	{
		// 이전 모드의 InputMappingContext 제거
		if (InputSubsystem && ActiveMode->InputMappingContext)
		{
			InputSubsystem->RemoveMappingContext(ActiveMode->InputMappingContext);
		}

		ActiveMode->OnDeactivate(this);
	}

	ActiveModeType = NewMode;
	ActiveMode = GetModeInstance(NewMode);

	if (ActiveMode)
	{
		ActiveMode->OnActivate(this);

		// 새 모드의 InputMappingContext 추가
		if (InputSubsystem && ActiveMode->InputMappingContext)
		{
			InputSubsystem->AddMappingContext(ActiveMode->InputMappingContext, ActiveMode->MappingPriority);
		}

		// 마우스 커서 상태 적용
		// (ShoulderView 등 일부 모드는 OnActivate에서 SetInputMode와 함께 직접 제어하므로
		//  여기서는 cursor-mode 모드의 기본값만 보장한다)
		if (PC && ActiveMode->bShowMouseCursor)
		{
			PC->bShowMouseCursor = true;
		}

		// 현재 Subject를 새 모드에 전달하여, 콘솔 커맨드 등 외부 전환 시에도 동기화
		if (CurrentSubjectEntityId != InvalidEntityId)
		{
			ActiveMode->OnSubjectChanged(this, CurrentSubjectEntityId);
		}
	}
}

UHktCameraModeBase* AHktRtsCameraPawn::GetModeInstance(EHktCameraMode Mode) const
{
	switch (Mode)
	{
	case EHktCameraMode::RtsFree:        return RtsFreeMode;
	case EHktCameraMode::SubjectFollow:  return SubjectFollowMode;
	case EHktCameraMode::ShoulderView:   return ShoulderViewMode;
	case EHktCameraMode::IsometricOrtho: return IsometricOrthoMode;
	case EHktCameraMode::IsometricGame:  return IsometricGameMode;
	default:                             return RtsFreeMode;
	}
}

// ============================================================================
// 콘솔 커맨드: 카메라 모드 전환
// ============================================================================

static AHktRtsCameraPawn* FindLocalCameraPawn(const UWorld* World)
{
	if (!World) return nullptr;

	APlayerController* PC = World->GetFirstPlayerController();
	if (!PC) return nullptr;

	return Cast<AHktRtsCameraPawn>(PC->GetPawn());
}

static const TCHAR* CameraModeToString(EHktCameraMode Mode)
{
	switch (Mode)
	{
	case EHktCameraMode::RtsFree:        return TEXT("RtsFree");
	case EHktCameraMode::SubjectFollow:  return TEXT("SubjectFollow");
	case EHktCameraMode::ShoulderView:   return TEXT("ShoulderView");
	case EHktCameraMode::IsometricOrtho: return TEXT("IsometricOrtho");
	case EHktCameraMode::IsometricGame:  return TEXT("IsometricGame");
	default:                             return TEXT("Unknown");
	}
}

static bool StringToCameraMode(const FString& Str, EHktCameraMode& OutMode)
{
	if (Str.Equals(TEXT("RtsFree"), ESearchCase::IgnoreCase)
		|| Str.Equals(TEXT("0")))
	{
		OutMode = EHktCameraMode::RtsFree;
		return true;
	}
	if (Str.Equals(TEXT("SubjectFollow"), ESearchCase::IgnoreCase)
		|| Str.Equals(TEXT("1")))
	{
		OutMode = EHktCameraMode::SubjectFollow;
		return true;
	}
	if (Str.Equals(TEXT("ShoulderView"), ESearchCase::IgnoreCase)
		|| Str.Equals(TEXT("Shoulder"), ESearchCase::IgnoreCase)
		|| Str.Equals(TEXT("OTS"), ESearchCase::IgnoreCase)
		|| Str.Equals(TEXT("2")))
	{
		OutMode = EHktCameraMode::ShoulderView;
		return true;
	}
	if (Str.Equals(TEXT("IsometricOrtho"), ESearchCase::IgnoreCase)
		|| Str.Equals(TEXT("IsoOrtho"), ESearchCase::IgnoreCase)
		|| Str.Equals(TEXT("Ortho"), ESearchCase::IgnoreCase)
		|| Str.Equals(TEXT("3")))
	{
		OutMode = EHktCameraMode::IsometricOrtho;
		return true;
	}
	if (Str.Equals(TEXT("IsometricGame"), ESearchCase::IgnoreCase)
		|| Str.Equals(TEXT("IsoGame"), ESearchCase::IgnoreCase)
		|| Str.Equals(TEXT("Iso"), ESearchCase::IgnoreCase)
		|| Str.Equals(TEXT("4")))
	{
		OutMode = EHktCameraMode::IsometricGame;
		return true;
	}
	return false;
}

static FAutoConsoleCommandWithWorldAndArgs GHktCameraSetModeCmd(
	TEXT("hkt.Camera.SetMode"),
	TEXT("카메라 모드 전환. 사용법: hkt.Camera.SetMode <RtsFree|SubjectFollow|ShoulderView|IsometricOrtho|IsometricGame|0|1|2|3|4>"),
	FConsoleCommandWithWorldAndArgsDelegate::CreateLambda(
		[](const TArray<FString>& Args, UWorld* World)
		{
			if (Args.Num() < 1)
			{
				UE_LOG(LogTemp, Warning,
					TEXT("hkt.Camera.SetMode: 모드를 지정하세요. (RtsFree, SubjectFollow, ShoulderView, IsometricOrtho, IsometricGame, 0, 1, 2, 3, 4)"));
				return;
			}

			EHktCameraMode NewMode;
			if (!StringToCameraMode(Args[0], NewMode))
			{
				UE_LOG(LogTemp, Warning,
					TEXT("hkt.Camera.SetMode: 알 수 없는 모드 '%s'. (RtsFree, SubjectFollow, ShoulderView, IsometricOrtho, IsometricGame, 0, 1, 2, 3, 4)"),
					*Args[0]);
				return;
			}

			AHktRtsCameraPawn* Pawn = FindLocalCameraPawn(World);
			if (!Pawn)
			{
				UE_LOG(LogTemp, Warning, TEXT("hkt.Camera.SetMode: CameraPawn을 찾을 수 없습니다."));
				return;
			}

			Pawn->SetCameraMode(NewMode);
			UE_LOG(LogTemp, Log, TEXT("hkt.Camera.SetMode: %s"), CameraModeToString(NewMode));
		})
);

static FAutoConsoleCommandWithWorldAndArgs GHktCameraGetModeCmd(
	TEXT("hkt.Camera.GetMode"),
	TEXT("현재 카메라 모드를 출력합니다."),
	FConsoleCommandWithWorldAndArgsDelegate::CreateLambda(
		[](const TArray<FString>& Args, UWorld* World)
		{
			AHktRtsCameraPawn* Pawn = FindLocalCameraPawn(World);
			if (!Pawn)
			{
				UE_LOG(LogTemp, Warning, TEXT("hkt.Camera.GetMode: CameraPawn을 찾을 수 없습니다."));
				return;
			}

			UE_LOG(LogTemp, Log, TEXT("hkt.Camera.GetMode: %s"), CameraModeToString(Pawn->GetCameraMode()));
		})
);
