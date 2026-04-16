// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktProjection.h"

/**
 * FHktVFXProjection — VFXEvent → 일회성 VFX 재생
 *
 * 기존 코드 매핑:
 *  - ProcessDiff: ForEachVFXEvent → VFXRenderer->PlayVFXAtLocation
 *
 * VM의 Op_PlayVFX / Op_PlayVFXAttached가 발생한 일회성 VFX 이벤트를
 * PlayVFXAtLocation effect로 기록. EffectExecutor가 VFXRenderer로 실행.
 */
class FHktVFXProjection final : public IHktProjection
{
public:
	virtual const TCHAR* GetName() const override { return TEXT("VFX"); }

	virtual void Project(
		const FHktPresentationChangeSet& Changes,
		FHktProjectionContext& Ctx) override;
};
