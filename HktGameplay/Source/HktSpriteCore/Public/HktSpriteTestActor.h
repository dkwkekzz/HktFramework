// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "GameplayTagContainer.h"
#include "HktSpriteTypes.h"
#include "HktSpriteTestActor.generated.h"

class UHktSpriteCrowdRenderer;
class UStaticMesh;
class UMaterialInterface;

/**
 * AHktSpriteTestActor — VM/Presentation 파이프라인 없이 스프라이트 시스템을 단독 검증하는 테스트 액터.
 *
 * 사용법:
 *   1. 월드에 이 액터를 드래그 배치.
 *   2. Details 패널에서 QuadMesh / SpriteMaterial / 파츠 태그 / AnimTag 지정.
 *   3. Play 시 자체 UHktSpriteCrowdRenderer를 생성하고 단일 EntityId로 등록.
 *   4. Tick마다 NowTick을 증분해 UpdateEntity 호출.
 *
 * 모든 참조는 이 액터에 국한되며 자동 스폰되는 AHktSpriteCrowdHost와 독립.
 * (Presentation 파이프라인이 비활성화된 상태에서도 검증 가능)
 */
UCLASS(BlueprintType, meta=(DisplayName="Hkt Sprite Test Actor"))
class HKTSPRITECORE_API AHktSpriteTestActor : public AActor
{
	GENERATED_BODY()

public:
	AHktSpriteTestActor();

	// --- 렌더 에셋 (필수) ---

	/** 모든 파츠가 공유하는 쿼드 메쉬 (예: Engine/BasicShapes/Plane) */
	UPROPERTY(EditAnywhere, Category="HKT|Sprite|Asset")
	TObjectPtr<UStaticMesh> QuadMesh;

	/** Y-axis billboard + CPD 16슬롯 소비 머티리얼. 없으면 QuadMesh 기본 머티리얼 사용. */
	UPROPERTY(EditAnywhere, Category="HKT|Sprite|Asset")
	TObjectPtr<UMaterialInterface> SpriteMaterial;

	UPROPERTY(EditAnywhere, Category="HKT|Sprite|Asset", meta=(ClampMin="0.01"))
	float GlobalWorldScale = 1.f;

	// --- Loadout (Tag로 UHktSpritePartTemplate 로드) ---

	UPROPERTY(EditAnywhere, Category="HKT|Sprite|Loadout") FGameplayTag BodyPart;
	UPROPERTY(EditAnywhere, Category="HKT|Sprite|Loadout") FGameplayTag HeadPart;
	UPROPERTY(EditAnywhere, Category="HKT|Sprite|Loadout") FGameplayTag WeaponPart;
	UPROPERTY(EditAnywhere, Category="HKT|Sprite|Loadout") FGameplayTag ShieldPart;
	UPROPERTY(EditAnywhere, Category="HKT|Sprite|Loadout") FGameplayTag HeadgearTop;
	UPROPERTY(EditAnywhere, Category="HKT|Sprite|Loadout") FGameplayTag HeadgearMid;
	UPROPERTY(EditAnywhere, Category="HKT|Sprite|Loadout") FGameplayTag HeadgearLow;

	// --- 애니메이션 재생 상태 ---

	/** 재생할 액션의 anim tag (PartTemplate의 Action.AnimTag와 매칭). 비워두면 PartTemplate의 DefaultAnimTag로 폴백. */
	UPROPERTY(EditAnywhere, Category="HKT|Sprite|Anim")
	FGameplayTag AnimTag;

	/** 바라볼 방향 (8방향 양자화) */
	UPROPERTY(EditAnywhere, Category="HKT|Sprite|Anim")
	EHktSpriteFacing Facing = EHktSpriteFacing::S;

	/** VM tick 시뮬레이션 주파수. 기본 30Hz. */
	UPROPERTY(EditAnywhere, Category="HKT|Sprite|Anim", meta=(ClampMin="1.0", ClampMax="240.0"))
	float SimulatedTickHz = 30.f;

	/** 플레이 속도 배율 */
	UPROPERTY(EditAnywhere, Category="HKT|Sprite|Anim", meta=(ClampMin="0.01"))
	float PlayRate = 1.f;

	/** 틴트 오버라이드 (파츠 프레임 Tint와 곱해짐) */
	UPROPERTY(EditAnywhere, Category="HKT|Sprite|Anim")
	FLinearColor TintOverride = FLinearColor::White;

	UPROPERTY(EditAnywhere, Category="HKT|Sprite|Anim", meta=(ClampMin="0"))
	int32 PaletteIndex = 0;

	// --- AActor override ---
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

#if WITH_EDITOR
	/** Details 패널에서 속성 변경 시 즉시 반영 (PIE 중에도) */
	virtual void PostEditChangeProperty(FPropertyChangedEvent& PropertyChangedEvent) override;
#endif

private:
	UPROPERTY(Transient)
	TObjectPtr<UHktSpriteCrowdRenderer> Renderer;

	/** BeginPlay 이후 경과 시간 누적 (초). TickHz × 이 값으로 NowTick 계산. */
	double ElapsedSeconds = 0.0;

	/** 이 액터 인스턴스의 고유 EntityId (다수 배치 시 충돌 방지) */
	static int32 AllocateTestEntityId();

	int32 TestEntityId = 0;

	void EnsureRendererAndLoadout();
	FHktSpriteLoadout BuildLoadout() const;
};
