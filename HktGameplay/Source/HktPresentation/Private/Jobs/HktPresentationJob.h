// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktCoreDefs.h"

struct FHktPresentationState;

/** Job 상태 머신 */
enum class EHktJobStatus : uint8
{
	Pending,    // 큐 대기
	Preparing,  // 비동기 작업 중 (에셋 로드, 지형 계산 등)
	Ready,      // 준비 완료, 실행 대기
	Completed,  // 실행 완료, 삭제 대기
	Cancelled   // 엔티티 파괴 등으로 취소됨
};

/**
 * Presentation 파이프라인의 작업 단위.
 * ProcessDiff에서 생성 → OnTick에서 TickJob/Execute 호출.
 */
class IHktPresentationJob
{
public:
	virtual ~IHktPresentationJob() = default;

	/** 매 프레임 호출. 비동기 작업 진행 상황을 체크하고 상태를 전이시킨다. */
	virtual void TickJob(float DeltaTime) = 0;

	/** Ready 상태일 때 호출. PresentationState를 갱신한다. */
	virtual void Execute(FHktPresentationState& OutState) = 0;

	/** 현재 상태 반환 */
	virtual EHktJobStatus GetStatus() const = 0;

	/** 연관 엔티티 ID (의존성 관리 및 취소 처리용). 엔티티 무관 Job은 InvalidEntityId 반환. */
	virtual FHktEntityId GetTargetEntityId() const = 0;

	/** 부모 엔티티 파괴 등으로 안전하게 중단 */
	virtual void Cancel() = 0;

	/** 로그용 Job 타입 이름 */
	virtual const TCHAR* GetJobName() const = 0;
};
