// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktPresentationProcessor.h"
#include "HktPresentationState.h"

class ULocalPlayer;

/** MassEntity 기반 대량 엔터티 렌더링 (Projectile 등). 현재 스텁. */
class FHktMassEntityProcessor : public IHktPresentationProcessor
{
public:
	explicit FHktMassEntityProcessor(ULocalPlayer* InLP);
	virtual void Sync(FHktPresentationState& State) override;
	virtual void Teardown() override;

private:
	ULocalPlayer* LocalPlayer = nullptr;
};
