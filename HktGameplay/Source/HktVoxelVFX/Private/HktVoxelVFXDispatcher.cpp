// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVoxelVFXDispatcher.h"
#include "HktVoxelHitFeedback.h"
#include "HktVoxelVFXLog.h"
#include "NiagaraFunctionLibrary.h"
#include "NiagaraComponent.h"
#include "Kismet/GameplayStatics.h"

void UHktVoxelVFXDispatcher::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	UE_LOG(LogHktVoxelVFX, Log, TEXT("VFX Dispatcher initialized"));
}

void UHktVoxelVFXDispatcher::Deinitialize()
{
	Super::Deinitialize();
}

void UHktVoxelVFXDispatcher::OnHit(const FHktVoxelHitEvent& Hit)
{
	// 1. 파편 스폰
	SpawnVoxelFragments(
		Hit.Location, -Hit.HitDirection,
		Hit.TargetSkinTypeID, Hit.TargetPaletteIndex,
		FMath::Clamp(static_cast<int32>(Hit.Damage * 0.5f), 3, 32));

	// 2. 히트스탑 (보간 알파 정지)
	ApplyHitStop(Hit.HitType);

	// 3. 카메라 셰이크
	ShakeCamera(Hit.HitType);

	// 4. 대상 플래시
	FlashTarget(Hit.TargetEntityId);
}

void UHktVoxelVFXDispatcher::OnVoxelDestroy(const FHktVoxelDestroyEvent& Destroy)
{
	SpawnVoxelFragments(
		Destroy.Location, FVector::UpVector,
		Destroy.DestroyedTypeID, Destroy.DestroyedPaletteIndex,
		Destroy.FragmentCount);
}

void UHktVoxelVFXDispatcher::OnEntityDeath(const FHktVoxelDeathEvent& Death)
{
	// 대규모 파편
	SpawnVoxelFragments(
		Death.Location, FVector::UpVector,
		Death.SkinTypeID, Death.PaletteIndex,
		Death.FragmentCount);

	// Kill 등급 히트스탑
	ApplyHitStop(FHktVoxelHitFeedback::HIT_KILL);
	ShakeCamera(FHktVoxelHitFeedback::HIT_KILL);
}

void UHktVoxelVFXDispatcher::SpawnVoxelFragments(
	const FVector& Location, const FVector& Direction,
	uint16 TypeID, uint8 PaletteIndex, int32 FragmentCount)
{
	if (!FragmentNiagaraSystem)
	{
		UE_LOG(LogHktVoxelVFX, Verbose, TEXT("FragmentNiagaraSystem not set — skipping fragment spawn"));
		return;
	}

	UWorld* World = GetGameInstance()->GetWorld();
	if (!World)
	{
		return;
	}

	UNiagaraComponent* NC = UNiagaraFunctionLibrary::SpawnSystemAtLocation(
		World, FragmentNiagaraSystem, Location, Direction.Rotation());

	if (NC)
	{
		NC->SetIntParameter(TEXT("FragmentCount"), FragmentCount);
		NC->SetIntParameter(TEXT("VoxelTypeID"), TypeID);
		NC->SetIntParameter(TEXT("PaletteIndex"), PaletteIndex);
	}
}

void UHktVoxelVFXDispatcher::ApplyHitStop(int32 HitType)
{
	// 히트스탑 = 보간 알파 정지
	// VM 틱은 절대 멈추지 않는다!
	// 보간 시스템에 정지 요청을 보내는 것은 VMBridge/Presentation 레이어의 책임
	// 여기서는 정지 시간만 계산하여 전달

	const float StopDuration = FHktVoxelHitFeedback::GetHitStopDuration(HitType);

	UE_LOG(LogHktVoxelVFX, Verbose, TEXT("HitStop requested: HitType=%d Duration=%.3fs"), HitType, StopDuration);

	// TODO: InterpolationSystem->PauseFor(StopDuration) 연동
	// Phase 1에서는 로깅만 수행. Phase 2에서 보간 시스템과 연결.
}

void UHktVoxelVFXDispatcher::ShakeCamera(int32 HitType)
{
	TSubclassOf<UCameraShakeBase> ShakeClass = nullptr;
	switch (HitType)
	{
		case FHktVoxelHitFeedback::HIT_NORMAL:   ShakeClass = NormalHitShake; break;
		case FHktVoxelHitFeedback::HIT_CRITICAL:  ShakeClass = CriticalHitShake; break;
		case FHktVoxelHitFeedback::HIT_KILL:      ShakeClass = KillShake; break;
	}

	if (!ShakeClass)
	{
		return;
	}

	UWorld* World = GetGameInstance()->GetWorld();
	if (!World)
	{
		return;
	}

	APlayerController* PC = World->GetFirstPlayerController();
	if (PC)
	{
		PC->ClientStartCameraShake(ShakeClass);
	}
}

void UHktVoxelVFXDispatcher::FlashTarget(int32 TargetEntityId)
{
	// TODO: Phase 2 — 머티리얼 파라미터 컬렉션을 통한 플래시
	UE_LOG(LogHktVoxelVFX, Verbose, TEXT("FlashTarget: EntityId=%d"), TargetEntityId);
}
