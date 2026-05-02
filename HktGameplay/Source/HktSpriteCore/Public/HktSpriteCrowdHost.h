// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "GameplayTagContainer.h"
#include "HktPresentationProcessor.h"
#include "HktPresentationState.h"
#include "HktSpriteAnimProcessor.h"
#include "HktSpriteTypes.h"
#include "HktSpriteCrowdHost.generated.h"

class UHktSpriteCrowdRenderer;
class UHktPresentationSubsystem;

/**
 * AHktSpriteCrowdHost — 스프라이트 크라우드 렌더러를 소유하는 Actor이자 Presentation Processor.
 *
 *  - UHktSpriteCrowdRenderer 컴포넌트를 기본 서브오브젝트로 보유
 *  - IHktPresentationProcessor를 구현하여 PresentationState의 FHktSpriteView를 렌더러로 디스패치
 *  - BeginPlay 시 LocalPlayer의 UHktPresentationSubsystem에 자기 자신을 등록
 *    (AHktIngameHUD와 동일한 패턴)
 *
 * Anim 처리 구조(MassEntity 스타일):
 *  - AnimFragments (TMap<Id, POD>) : 엔터티당 경량 상태 (UObject 아님)
 *  - HktSpriteAnimProcessor:: (순수 C++ namespace) : 의사결정 로직
 *
 *  PartTemplate이 각 액션의 AnimTag를 직접 보유하므로 별도 매핑 DataAsset은 없다.
 */
UCLASS(NotPlaceable, Blueprintable)
class HKTSPRITECORE_API AHktSpriteCrowdHost : public AActor, public IHktPresentationProcessor
{
	GENERATED_BODY()

public:
	AHktSpriteCrowdHost();

	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

	// --- IHktPresentationProcessor ---
	virtual void Tick(FHktPresentationState& State, float DeltaTime) override;
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

private:
	/** 등록 시도 — LocalPlayer 초기화가 늦으면 1초 후 재시도 (3회까지). */
	void TryRegisterWithPresentation();

	/** Entity별 AnimFragment를 가져오거나 없으면 생성. */
	FHktSpriteAnimFragment& GetOrCreateAnimFragment(FHktEntityId Id);

	UPROPERTY(VisibleAnywhere, Category = "HKT|Sprite")
	TObjectPtr<UHktSpriteCrowdRenderer> Renderer;

	UPROPERTY(Transient)
	TObjectPtr<UHktPresentationSubsystem> CachedPresentationSubsystem;

	FTimerHandle RegisterRetryHandle;
	int32 RegisterRetries = 0;

	float CameraYawDeg = 0.f;
	float TickDurationMs = 1000.f / 30.f;

	/** 매 render 프레임마다 모든 sprite 엔터티의 frame cursor 를 재계산 — 서버 batch 가 없어도 진행. */
	void UpdateEntitiesPerFrame(FHktPresentationState& State);

	/** Entity별 sprite anim 런타임 상태(POD fragment). */
	TMap<FHktEntityId, FHktSpriteAnimFragment> AnimFragments;

	/**
	 * 로컬 실시간 클럭 (ms). 매 Tick 에서 DeltaTime*1000 누적.
	 * 서버 batch 가 멈춰도 (state delta 없음) 애니메이션이 계속 진행되도록 하는 단일 시간 출처.
	 */
	double LocalNowMs = 0.0;

	/**
	 * 엔터티별 anim start 의 로컬 ms 시각.
	 * 서버 권위 AnimStartTick 값이 바뀌면(즉, 서버가 anim 전환을 통보) 그 시점의 LocalNowMs 로 갱신.
	 */
	TMap<FHktEntityId, double> AnimStartLocalMs;

	/**
	 * 엔터티별 마지막으로 관측한 서버 권위 AnimStartTick 값. 변화 감지로 AnimStartLocalMs 재캡처 트리거.
	 */
	TMap<FHktEntityId, int32> LastAuthoritativeAnimStartTick;

	/**
	 * HktSpriteAnimProcessor::ResolveRenderOutputs 태그 해석 실패 dedup.
	 * 호스트 인스턴스 수명에 묶여 PIE 재시작 / 멀티 호스트에서 자동 리셋된다.
	 */
	bool bLoggedResolveRenderOutputsFailure = false;
};
