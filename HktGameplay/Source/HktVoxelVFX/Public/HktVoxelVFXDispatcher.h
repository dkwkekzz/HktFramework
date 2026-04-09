// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "HktVoxelVFXTypes.h"
#include "HktVoxelVFXDispatcher.generated.h"

class UNiagaraSystem;
class UCameraShakeBase;

/**
 * UHktVoxelVFXDispatcher
 *
 * VM 이벤트를 받아 UE5 복셀 이펙트로 변환하는 중앙 허브.
 * VMBridge에서 이벤트 소비 시 이 서브시스템의 핸들러를 호출한다.
 *
 * 핵심 원칙:
 *   - 모든 시각 연출의 파라미터는 VM 이벤트에서 받는다 (UE5가 자체 판단하지 않음)
 *   - 파편/이펙트 물리는 VM에 넣지 않는다 (순수 시각 연출은 UE5에서 자유롭게)
 *   - 히트스탑은 보간 레이어에서 처리, VM 틱은 절대 건드리지 않는다
 */
UCLASS()
class HKTVOXELVFX_API UHktVoxelVFXDispatcher : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual bool ShouldCreateSubsystem(UObject* Outer) const override { return true; }
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

	// === VM 이벤트 핸들러 — VMBridge에서 호출 ===

	/** 타격 이벤트 처리 — 파편 + 히트스탑 + 카메라 셰이크 + 사운드 */
	void OnHit(const FHktVoxelHitEvent& Hit);

	/** 복셀 파괴 이벤트 — 월드 복셀 파편 생성 */
	void OnVoxelDestroy(const FHktVoxelDestroyEvent& Destroy);

	/** 엔티티 사망 — 대규모 파편 + 슬로모션 연출 */
	void OnEntityDeath(const FHktVoxelDeathEvent& Death);

private:
	/** Niagara 파편 스폰 (1x1x1 큐브 메시, 팔레트 색상) */
	void SpawnVoxelFragments(const FVector& Location, const FVector& Direction,
		uint16 TypeID, uint8 PaletteIndex, int32 FragmentCount);

	/**
	 * 히트스탑 — 보간 알파 정지 방식
	 * VM 틱은 멈추지 않는다! 렌더링 보간만 일시 정지.
	 */
	void ApplyHitStop(int32 HitType);

	/** 카메라 셰이크 */
	void ShakeCamera(int32 HitType);

	/** 타격 대상 플래시 (머티리얼 파라미터) */
	void FlashTarget(int32 TargetEntityId);

	// Niagara 시스템 참조
	UPROPERTY()
	UNiagaraSystem* FragmentNiagaraSystem = nullptr;

	// 카메라 셰이크 클래스
	UPROPERTY()
	TSubclassOf<UCameraShakeBase> NormalHitShake;
	UPROPERTY()
	TSubclassOf<UCameraShakeBase> CriticalHitShake;
	UPROPERTY()
	TSubclassOf<UCameraShakeBase> KillShake;
};
