// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktPresentationChangeSet.h"
#include "HktPresentationState.h"
#include "HktEffectsPlan.h"

/**
 * FHktProjectionContext — Projection 실행 컨텍스트
 *
 * Projection이 Project() 호출 시 사용하는 공유 컨텍스트.
 * ViewModel(State) 직접 쓰기 + Effects 기록 + WorldState 읽기.
 */
struct HKTPRESENTATION_API FHktProjectionContext
{
	FHktPresentationState& State;
	FHktEffectsPlan& Effects;
	const FHktWorldState& WorldState;
	int64 Frame;

	/** 편의: 유효한 엔티티 ViewModel 반환 (없으면 nullptr) */
	FHktEntityPresentation* GetEntity(FHktEntityId Id) { return State.GetMutable(Id); }
	const FHktEntityPresentation* GetEntity(FHktEntityId Id) const { return State.Get(Id); }
};

/**
 * IHktProjection — Presentation 파이프라인의 투영 규칙
 *
 * ChangeSet의 변경을 해석하여:
 *  1) ViewModel(FHktPresentationState) 직접 갱신 (순수 데이터)
 *  2) UE5 side effect를 FHktEffectsPlan에 기록
 *
 * Pipeline이 등록 순서대로 호출. 선행 Projection이 State에 쓴 값을
 * 후행 Projection이 읽을 수 있음 (실행 순서 = 의존성 순서).
 *
 * 구현 가이드:
 *  - ViewModel에 직접 쓰기: Ctx.State / Ctx.GetEntity() 사용
 *  - UE5 side effect 기록: Ctx.Effects.Add() / AddVFX() 사용
 *  - WorldState 읽기:      Ctx.WorldState 사용 (읽기 전용)
 *  - 절대 UE5 월드 객체를 직접 조작하지 않음 (Actor, Component 등)
 */
struct HKTPRESENTATION_API IHktProjection
{
	virtual ~IHktProjection() = default;

	/** 디버그 식별자 (로그/Insights에서 Projection 이름으로 표시) */
	virtual const TCHAR* GetName() const = 0;

	/** ChangeSet을 처리. ViewModel 직접 쓰기 + Effects 기록. */
	virtual void Project(
		const FHktPresentationChangeSet& Changes,
		FHktProjectionContext& Ctx) = 0;
};
