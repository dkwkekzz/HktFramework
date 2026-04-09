// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktUnitActor.h"
#include "HktAnimInstance.h"
#include "HktPresentationState.h"
#include "Components/CapsuleComponent.h"
#include "Components/SkeletalMeshComponent.h"

AHktUnitActor::AHktUnitActor()
{
	PrimaryActorTick.bCanEverTick = true;

	CapsuleComponent = CreateDefaultSubobject<UCapsuleComponent>(TEXT("Capsule"));
	RootComponent = CapsuleComponent;

	// QueryOnly: 커서 트레이스(Visibility 채널)에 응답, 물리 충돌(밀어내기)은 없음
	CapsuleComponent->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
	CapsuleComponent->SetCollisionResponseToAllChannels(ECR_Ignore);
	CapsuleComponent->SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);
	CapsuleComponent->InitCapsuleSize(34.f, 88.f);

	MeshComponent = CreateDefaultSubobject<USkeletalMeshComponent>(TEXT("Mesh"));
	MeshComponent->SetupAttachment(CapsuleComponent);
	MeshComponent->SetRelativeLocation(FVector(0.f, 0.f, -88.f));
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

	SetActorLocationAndRotation(
		InterpLocation, InterpRotation,
		false, nullptr, ETeleportType::TeleportPhysics);
}

void AHktUnitActor::ApplyPresentation(const FHktEntityPresentation& Entity, int64 Frame, bool bForceAll,
	TFunctionRef<AActor*(FHktEntityId)> /*GetActorFunc*/)
{
	// Transform은 ApplyTransform()에서 매 프레임 처리
	CachedRenderLocation = Entity.RenderLocation.Get();
	CachedRotation = Entity.Rotation.Get();

	if (bForceAll)
	{
		InterpLocation = CachedRenderLocation;
		InterpRotation = CachedRotation;
	}

	// --- Animation ---
	UHktAnimInstance* HktAnim = GetAnimInstance();
	if (!HktAnim) return;

	if (bForceAll || Entity.bIsMoving.IsDirty(Frame))
		HktAnim->bIsMoving = Entity.bIsMoving.Get();

	if (bForceAll || Entity.bIsJumping.IsDirty(Frame))
		HktAnim->bIsJumping = Entity.bIsJumping.Get();

	if (bForceAll || Entity.Velocity.IsDirty(Frame))
	{
		FVector Vel = Entity.Velocity.Get();
		HktAnim->MoveSpeed = FVector2D(Vel.X, Vel.Y).Size();
		HktAnim->BlendSpaceX = HktAnim->MoveSpeed;
	}

	if (bForceAll || Entity.Stance.IsDirty(Frame))
		HktAnim->SyncStance(Entity.Stance.Get());

	if (bForceAll || Entity.MotionPlayRate.IsDirty(Frame) || Entity.AttackSpeed.IsDirty(Frame))
	{
		int32 RawRate = Entity.MotionPlayRate.Get();
		float SpeedScale = (RawRate > 0)
			? static_cast<float>(RawRate) / 100.0f
			: static_cast<float>(Entity.AttackSpeed.Get()) / 100.0f;
		if (SpeedScale <= 0.0f) SpeedScale = 1.0f;
		HktAnim->AttackPlayRate = SpeedScale;
	}

	if (bForceAll || Entity.CPRatio.IsDirty(Frame))
		HktAnim->CPRatio = Entity.CPRatio.Get();

	if (bForceAll || Entity.TagsDirtyFrame == Frame)
		HktAnim->SyncFromTagContainer(Entity.Tags);

	// 일회성 애니메이션 이벤트 소비 (PlayAnim 경유, 태그 비의존)
	if (Entity.PendingAnimTriggers.Num() > 0)
	{
		for (const FGameplayTag& AnimTag : Entity.PendingAnimTriggers)
		{
			HktAnim->ApplyAnimTag(AnimTag);
		}
		const_cast<FHktEntityPresentation&>(Entity).PendingAnimTriggers.Reset();
	}
}
