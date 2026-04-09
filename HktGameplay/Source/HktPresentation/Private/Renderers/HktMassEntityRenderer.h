// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktPresentationRenderer.h"
#include "HktPresentationState.h"

class ULocalPlayer;

/** MassEntity 기반 대량 엔터티 렌더링 (Projectile 등). 현재 스텁. */
class FHktMassEntityRenderer : public IHktPresentationRenderer
{
public:
	explicit FHktMassEntityRenderer(ULocalPlayer* InLP);
	virtual void Sync(const FHktPresentationState& State) override;
	virtual void Teardown() override;

private:
	ULocalPlayer* LocalPlayer = nullptr;
};
