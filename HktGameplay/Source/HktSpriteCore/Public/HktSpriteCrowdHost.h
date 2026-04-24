// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "GameplayTagContainer.h"
#include "HktPresentationProcessor.h"
#include "HktPresentationState.h"
#include "HktSpriteAnimInstance.h"
#include "HktSpriteTypes.h"
#include "HktSpriteCrowdHost.generated.h"

class UHktSpriteCrowdRenderer;
class UHktSpriteAnimInstance;
class UHktPresentationSubsystem;

/**
 * AHktSpriteCrowdHost — 스프라이트 크라우드 렌더러를 소유하는 Actor이자 Presentation Processor.
 *
 *  - UHktSpriteCrowdRenderer 컴포넌트를 기본 서브오브젝트로 보유
 *  - IHktPresentationProcessor를 구현하여 PresentationState의 FHktSpriteView를 렌더러로 디스패치
 *  - BeginPlay 시 LocalPlayer의 UHktPresentationSubsystem에 자기 자신을 등록
 *    (AHktIngameHUD와 동일한 패턴)
 */
UCLASS(NotPlaceable, NotBlueprintable)
class HKTSPRITECORE_API AHktSpriteCrowdHost : public AActor, public IHktPresentationProcessor
{
	GENERATED_BODY()

public:
	AHktSpriteCrowdHost();

	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

	// --- IHktPresentationProcessor ---
	virtual void Tick(FHktPresentationState& State, float DeltaTime) override {}
	virtual void Sync(FHktPresentationState& State) override;
	virtual void Teardown() override;
	/** 애니메이션은 VM 델타 없이도 매 프레임 진행해야 하므로 항상 true. */
	virtual bool NeedsTick() const override { return true; }
	virtual bool NeedsCameraSync() const override { return true; }
	virtual void OnCameraViewChanged(FHktPresentationState& State) override;

	/** Sync 시 필요한 보조 값 주입 — 카메라 yaw, Tick duration 등. */
	void SetCameraYaw(float YawDegrees) { CameraYawDeg = YawDegrees; }
	void SetTickDurationMs(float Ms) { TickDurationMs = Ms; }

	UHktSpriteCrowdRenderer* GetRenderer() const { return Renderer; }

	/** 현재 사용 중인 AnimInstance 템플릿. BP에서 RegisterAnimMapping 호출용. */
	UHktSpriteAnimInstance* GetAnimInstance() const { return AnimInstance; }

private:
	/** 등록 시도 — LocalPlayer 초기화가 늦으면 1초 후 재시도 (3회까지). */
	void TryRegisterWithPresentation();

	/** AnimInstance(템플릿) 생성 — BeginPlay와 Sync 양쪽에서 한 번만 실행. */
	void EnsureAnimInstance();

	/** Entity별 AnimState를 가져오거나 없으면 생성. */
	FHktSpriteAnimState& GetOrCreateAnimState(FHktEntityId Id);

	UPROPERTY(VisibleAnywhere, Category = "HKT|Sprite")
	TObjectPtr<UHktSpriteCrowdRenderer> Renderer;

	/**
	 * Anim 의사결정 템플릿 클래스. UHktAnimInstance가 AnimBP로 스켈레탈별 커스터마이즈 되듯,
	 * 프로젝트별로 BP 서브클래스를 만들어 AnimMappings를 구성한다.
	 */
	UPROPERTY(EditAnywhere, Category = "HKT|SpriteAnim")
	TSubclassOf<UHktSpriteAnimInstance> AnimInstanceClass;

	UPROPERTY(Transient)
	TObjectPtr<UHktSpriteAnimInstance> AnimInstance;

	UPROPERTY(Transient)
	TObjectPtr<UHktPresentationSubsystem> CachedPresentationSubsystem;

	FTimerHandle RegisterRetryHandle;
	int32 RegisterRetries = 0;

	float CameraYawDeg = 0.f;
	float TickDurationMs = 1000.f / 30.f;

	/** Entity별 sprite anim 런타임 상태(PrevAnimTags/AnimLayerTags 등). */
	TMap<FHktEntityId, FHktSpriteAnimState> AnimStates;
};
