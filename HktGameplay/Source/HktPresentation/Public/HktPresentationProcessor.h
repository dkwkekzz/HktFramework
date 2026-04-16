// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktPresentationState.h"

/**
 * Presentation 파이프라인의 처리 단위.
 * ProcessDiff가 State에 적재한 pending 배열을 소비하여 비동기 작업 진행(Tick) + 렌더링(Sync).
 */
class IHktPresentationProcessor
{
public:
	virtual ~IHktPresentationProcessor() = default;

	/** 비동기 작업 진행 (에셋 로드 등). State 변경 가능. */
	virtual void Tick(FHktPresentationState& State, float DeltaTime) {}

	/** State 읽어서 렌더링/VFX/디버그 등 처리 */
	virtual void Sync(const FHktPresentationState& State) = 0;

	virtual void Teardown() = 0;

	/** Processor가 등록될 때 호출. 기존 State 전달. 기본 구현은 Sync 호출. */
	virtual void OnRegistered(const FHktPresentationState& State) { Sync(State); }

	/** 비동기 작업 완료 등으로 추가 Sync가 필요한지 여부 */
	virtual bool NeedsTick() const { return false; }

	/** 카메라 변경 시 재동기화가 필요한 Processor인지 여부 */
	virtual bool NeedsCameraSync() const { return false; }

	/** 카메라 뷰만 변경되었을 때 호출. 기본 구현은 Sync 호출. */
	virtual void OnCameraViewChanged(const FHktPresentationState& State) { Sync(State); }
};
