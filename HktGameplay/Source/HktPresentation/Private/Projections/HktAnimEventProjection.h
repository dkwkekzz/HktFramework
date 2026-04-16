// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktProjection.h"

/**
 * FHktAnimEventProjection — AnimEvent → PendingAnimTriggers 적재
 *
 * 기존 코드 매핑:
 *  - ProcessDiff: ForEachAnimEvent → E->PendingAnimTriggers.Add + DirtyThisFrame 추가
 *
 * VM의 Op_PlayAnim이 발생한 일회성 애니메이션 이벤트를 ViewModel에 적재.
 * ActorRenderer::Sync에서 ForwardToActor 호출 시 PendingAnimTriggers가 소비됨.
 */
class FHktAnimEventProjection final : public IHktProjection
{
public:
	virtual const TCHAR* GetName() const override { return TEXT("AnimEvent"); }

	virtual void Project(
		const FHktPresentationChangeSet& Changes,
		FHktProjectionContext& Ctx) override;
};
