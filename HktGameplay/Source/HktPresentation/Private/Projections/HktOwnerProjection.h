// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktProjection.h"

/**
 * FHktOwnerProjection — OwnerDelta → 소유권 동기화
 *
 * 기존 코드 매핑:
 *  - ProcessDiff: ForEachOwnerDelta → State.ApplyOwnerDelta
 *
 * ApplyOwnerDelta 내부에서 OwnedPlayerUid + OwnerLabel 갱신.
 */
class FHktOwnerProjection final : public IHktProjection
{
public:
	virtual const TCHAR* GetName() const override { return TEXT("Owner"); }

	virtual void Project(
		const FHktPresentationChangeSet& Changes,
		FHktProjectionContext& Ctx) override;
};
