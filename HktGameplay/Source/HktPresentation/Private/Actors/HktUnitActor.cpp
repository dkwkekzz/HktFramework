// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktUnitActor.h"
#include "HktAnimInstance.h"
#include "HktPresentationState.h"
#include "Components/CapsuleComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "DrawDebugHelpers.h"

static TAutoConsoleVariable<int32> CVarHktUnitActorDrawDebugCapsule(
	TEXT("hkt.UnitActor.DrawDebugCapsule"),
	1,
	TEXT("Draw debug capsule at AHktUnitActor runtime location for position debugging. 0=off, 1=on"),
	ECVF_Cheat);

AHktUnitActor::AHktUnitActor()
{
	PrimaryActorTick.bCanEverTick = true;

	CapsuleComponent = CreateDefaultSubobject<UCapsuleComponent>(TEXT("Capsule"));
	RootComponent = CapsuleComponent;

	CapsuleComponent->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
	CapsuleComponent->SetCollisionResponseToAllChannels(ECR_Ignore);
	CapsuleComponent->SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);
	CapsuleComponent->InitCapsuleSize(50.f, 90.f);

	MeshComponent = CreateDefaultSubobject<USkeletalMeshComponent>(TEXT("Mesh"));
	MeshComponent->SetupAttachment(CapsuleComponent);
	MeshComponent->SetRelativeLocation(FVector::ZeroVector);
	MeshComponent->SetCollisionEnabled(ECollisionEnabled::NoCollision);
}

UHktAnimInstance* AHktUnitActor::GetAnimInstance()
{
	if (!CachedAnimInstance.IsValid() && MeshComponent)
	{
		CachedAnimInstance = Cast<UHktAnimInstance>(MeshComponent->GetAnimInstance());
	}
	return CachedAnimInstance.Get();
}

void AHktUnitActor::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);

	constexpr float InterpSpeed = 15.f;
	InterpLocation = FMath::VInterpTo(InterpLocation, CachedRenderLocation, DeltaTime, InterpSpeed);
	InterpRotation = FMath::RInterpTo(InterpRotation, CachedRotation, DeltaTime, InterpSpeed);

	SetActorLocationAndRotation(InterpLocation, InterpRotation, false, nullptr, ETeleportType::TeleportPhysics);

#if ENABLE_DRAW_DEBUG
	if (CapsuleComponent && CVarHktUnitActorDrawDebugCapsule.GetValueOnGameThread() != 0)
	{
		const float Radius = CapsuleComponent->GetScaledCapsuleRadius();
		const float HalfHeight = CapsuleComponent->GetScaledCapsuleHalfHeight();
		DrawDebugCapsule(
			GetWorld(),
			InterpLocation,
			HalfHeight,
			Radius,
			InterpRotation.Quaternion(),
			FColor::Green,
			false,
			-1.f,
			0,
			1.5f);
	}
#endif
}

void AHktUnitActor::ApplyTransform(const FHktTransformView& V)
{
	CachedRenderLocation = V.RenderLocation.Get();
	CachedRotation = V.Rotation.Get();
	if (!bHasInitialTransform)
	{
		InterpLocation = CachedRenderLocation;
		InterpRotation = CachedRotation;
		bHasInitialTransform = true;
	}
}

void AHktUnitActor::ApplyPhysics(const FHktPhysicsView& V, int64 Frame, bool bForce)
{
	// HktCore PosZ = 캡슐 바닥(발), UE5 CapsuleComponent 원점 = 캡슐 중심
	if (!bForce && !V.CollisionRadius.IsDirty(Frame) && !V.CollisionHalfHeight.IsDirty(Frame)) return;
	const float Radius = V.CollisionRadius.Get();
	const float HalfHeight = FMath::Max(V.CollisionHalfHeight.Get(), Radius);
	if (CapsuleComponent)
	{
		CapsuleComponent->SetCapsuleSize(Radius, HalfHeight);
	}
}

void AHktUnitActor::ApplyMovement(const FHktMovementView& V, int64 Frame, bool bForce)
{
	UHktAnimInstance* HktAnim = GetAnimInstance();
	if (!HktAnim) return;

	if (bForce || V.bIsMoving.IsDirty(Frame))
		HktAnim->bIsMoving = V.bIsMoving.Get();

	if (bForce || V.bIsJumping.IsDirty(Frame))
		HktAnim->bIsFalling = V.bIsJumping.Get();

	if (bForce || V.Velocity.IsDirty(Frame))
	{
		const FVector Vel = V.Velocity.Get();
		HktAnim->MoveSpeed = FVector2D(Vel.X, Vel.Y).Size();
		HktAnim->FallingSpeed = Vel.Z;
		HktAnim->BlendSpaceX = HktAnim->MoveSpeed;
	}
}

void AHktUnitActor::ApplyCombat(const FHktCombatView& V, int64 Frame, bool bForce)
{
	UHktAnimInstance* HktAnim = GetAnimInstance();
	if (!HktAnim) return;

	if (bForce || V.MotionPlayRate.IsDirty(Frame) || V.AttackSpeed.IsDirty(Frame))
	{
		const int32 RawRate = V.MotionPlayRate.Get();
		float SpeedScale = (RawRate > 0)
			? static_cast<float>(RawRate) / 100.0f
			: static_cast<float>(V.AttackSpeed.Get()) / 100.0f;
		if (SpeedScale <= 0.0f) SpeedScale = 1.0f;
		HktAnim->AttackPlayRate = SpeedScale;
	}

	if (bForce || V.CPRatio.IsDirty(Frame))
		HktAnim->CPRatio = V.CPRatio.Get();
}

void AHktUnitActor::ApplyAnimation(FHktAnimationView& V, int64 Frame, bool bForce)
{
	UHktAnimInstance* HktAnim = GetAnimInstance();
	if (!HktAnim) return;

	if (bForce || V.Stance.IsDirty(Frame))
		HktAnim->SyncStance(V.Stance.Get());

	if (bForce || V.TagsDirtyFrame == Frame)
		HktAnim->SyncFromTagContainer(V.Tags);

	// 일회성 애니메이션 이벤트 소비 (소유권 이전)
	if (V.PendingAnimTriggers.Num() > 0)
	{
		for (const FGameplayTag& AnimTag : V.PendingAnimTriggers)
		{
			HktAnim->ApplyAnimTag(AnimTag);
		}
		V.PendingAnimTriggers.Reset();
	}
}
