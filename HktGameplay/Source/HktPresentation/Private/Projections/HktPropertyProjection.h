// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktProjection.h"

/**
 * FHktPropertyProjection — PropertyDelta → ViewModel 필드 갱신
 *
 * 기존 코드 매핑:
 *  - ProcessDiff: ForEachDelta → State.ApplyDelta (GetDeltaDispatchTable)
 *  - ComputeRenderLocations(): DirtyThisFrame 중 Location 변경 → RenderLocation 재계산
 *
 * ApplyDelta 내부의 dispatch table (50+개 핸들러)은 FHktPresentationState에 유지.
 * 이 Projection은 delta를 State에 전달하고, 위치 변경 시 effect를 기록.
 */
class FHktPropertyProjection final : public IHktProjection
{
public:
	virtual const TCHAR* GetName() const override { return TEXT("Property"); }

	virtual void Project(
		const FHktPresentationChangeSet& Changes,
		FHktProjectionContext& Ctx) override;
};
