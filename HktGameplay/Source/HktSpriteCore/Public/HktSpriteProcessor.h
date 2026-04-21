// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktPresentationProcessor.h"
#include "HktPresentationState.h"
#include "HktSpriteTypes.h"

class UHktSpriteCrowdRenderer;

/**
 * FHktSpriteProcessor — HktPresentationState의 FHktSpriteView 데이터를
 * UHktSpriteCrowdRenderer(HISM)로 디스패치하는 Processor.
 *
 *  - Sync: Removed → Spawned → Loadout diff → 매 프레임 UpdateEntity
 *  - Tick: 처리 없음 (CrowdRenderer 내부에서 비동기 로드 해소)
 */
class HKTSPRITECORE_API FHktSpriteProcessor : public IHktPresentationProcessor
{
public:
	explicit FHktSpriteProcessor(UHktSpriteCrowdRenderer* InRenderer);

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

private:
	TWeakObjectPtr<UHktSpriteCrowdRenderer> Renderer;

	/** AnimationView.AnimState 태그 → PartTemplate Action FName 변환 (캐시). */
	FName ResolveActionId(const FGameplayTag& AnimTag);

	float CameraYawDeg = 0.f;
	float TickDurationMs = 1000.f / 30.f;

	TMap<FGameplayTag, FName> ActionIdCache;
};
