// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktPresentationState.h"

/** State에서 이번 프레임 변경사항을 소비하여 렌더링에 반영 */
class IHktPresentationRenderer
{
public:
	virtual ~IHktPresentationRenderer() = default;
	virtual void Sync(const FHktPresentationState& State) = 0;
	virtual void Teardown() = 0;

	/** 렌더러가 등록될 때 호출. 기존 State 전달. 기본 구현은 Sync 호출. */
	virtual void OnRegistered(const FHktPresentationState& State) { Sync(State); }

	/** 비동기 작업 완료 등으로 추가 Sync가 필요한지 여부 */
	virtual bool NeedsTick() const { return false; }

	/** 카메라 변경 시 재동기화가 필요한 렌더러인지 여부 (스크린 투영 등) */
	virtual bool NeedsCameraSync() const { return false; }

	/** 카메라 뷰만 변경되었을 때 호출. 기본 구현은 Sync 호출.
	 *  스크린 투영만 재계산하면 되는 렌더러는 오버라이드하여 경량 처리 가능. */
	virtual void OnCameraViewChanged(const FHktPresentationState& State) { Sync(State); }
};
