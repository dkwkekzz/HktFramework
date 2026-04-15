// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktProjection.h"

/**
 * FHktTagProjection — TagDelta → 태그 동기화 + VFX 생명주기 관리
 *
 * 기존 코드 매핑:
 *  - ProcessDiff: ForEachTagDelta → State.ApplyTagDelta
 *  - VFX 태그 감지: Tags.Filter(VFX prefix) → AttachVFX/DetachVFX
 *
 * VFX prefix("VFX")로 시작하는 태그가 추가되면 AttachVFXToEntity,
 * 제거되면 DetachVFXFromEntity effect를 기록.
 */
class FHktTagProjection final : public IHktProjection
{
public:
	virtual const TCHAR* GetName() const override { return TEXT("Tag"); }

	virtual void Project(
		const FHktPresentationChangeSet& Changes,
		FHktProjectionContext& Ctx) override;
};
