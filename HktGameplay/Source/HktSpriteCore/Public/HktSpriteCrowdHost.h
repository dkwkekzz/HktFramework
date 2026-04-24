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
class UHktSpriteAnimMappingAsset;
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
 *  - AnimMapping(UDataAsset) : 매핑 테이블만 담은 1개 공용 데이터
 *  - AnimFragments (TMap<Id, POD>) : 엔터티당 경량 상태 (UObject 아님)
 *  - HktSpriteAnimProcessor:: (순수 C++ namespace) : 의사결정 로직
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

	/** 현재 사용 중인 Anim 매핑 DataAsset. Generator의 RegisterMapping 등 BP 호출용. */
	UHktSpriteAnimMappingAsset* GetAnimMapping() const { return AnimMapping; }

private:
	/** 등록 시도 — LocalPlayer 초기화가 늦으면 1초 후 재시도 (3회까지). */
	void TryRegisterWithPresentation();

	/** Entity별 AnimFragment를 가져오거나 없으면 생성. */
	FHktSpriteAnimFragment& GetOrCreateAnimFragment(FHktEntityId Id);

	UPROPERTY(VisibleAnywhere, Category = "HKT|Sprite")
	TObjectPtr<UHktSpriteCrowdRenderer> Renderer;

	/**
	 * Anim 매핑 DataAsset. 크라우드 전체가 1개 공유.
	 * null이면 태그 leaf를 소문자 FName으로 사용하는 기본 동작.
	 */
	UPROPERTY(EditAnywhere, Category = "HKT|SpriteAnim")
	TObjectPtr<UHktSpriteAnimMappingAsset> AnimMapping;

	UPROPERTY(Transient)
	TObjectPtr<UHktPresentationSubsystem> CachedPresentationSubsystem;

	FTimerHandle RegisterRetryHandle;
	int32 RegisterRetries = 0;

	float CameraYawDeg = 0.f;
	float TickDurationMs = 1000.f / 30.f;

	/** Entity별 sprite anim 런타임 상태(POD fragment). */
	TMap<FHktEntityId, FHktSpriteAnimFragment> AnimFragments;
};
