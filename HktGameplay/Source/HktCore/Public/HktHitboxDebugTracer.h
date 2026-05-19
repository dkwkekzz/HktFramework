// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HAL/CriticalSection.h"
#include "HktCoreDefs.h"
#include <atomic>

/**
 * Hitbox 디버그 트레이서 — Server VM 의 ForEachInRadius (Op_FindInRadius/Ex) 가
 * 매 호출마다 (Center, Radius, HitCount, SimFrame, StoryTag) 를 ring buffer 에
 * 적재. HktPresentation 측 Processor 가 매 프레임 Snapshot 을 읽어 DrawDebug 로
 * 시각화한다.
 *
 * - ENABLE_HKT_INSIGHTS 가드: Shipping 빌드는 모든 API 가 인라인 no-op.
 * - bEnabled 게이트: 외부(클라 Processor)가 CVar 와 동기화. off 일 때 Push 는
 *   atomic load 한 번에 종료 → 결정론·성능 영향 0.
 * - VM 결과를 register/WorldState 로 되돌리지 않으므로 결정론 영향 없음.
 */

#if ENABLE_HKT_INSIGHTS

struct HKTCORE_API FHktHitboxTrace
{
	uint64 SimFrame = 0;        // WorldState->FrameNumber (push 시점)
	FHktEntityId Source = InvalidEntityId;
	FIntVector Center = FIntVector::ZeroValue;  // sim cm 단위
	int32 RadiusCm = 0;
	int32 HitCount = 0;         // 반경 내 검출된 엔티티 수
	uint32 FilterMask = 0;
	FName StoryTag;             // Runtime.Program->Tag (e.g. Story.Event.Attack.Basic)
};

class HKTCORE_API FHktHitboxDebugTracer
{
public:
	static FHktHitboxDebugTracer& Get();

	FORCEINLINE bool IsEnabled() const { return bEnabled.load(std::memory_order_relaxed); }
	void SetEnabled(bool bInEnabled) { bEnabled.store(bInEnabled, std::memory_order_relaxed); }

	void Push(const FHktHitboxTrace& Trace);

	/** 최근 N 프레임 이내 trace 만 복사 (CurrentSimFrame 기준). MaxAgeFrames=0 이면 전체. */
	void Snapshot(uint64 CurrentSimFrame, int32 MaxAgeFrames, TArray<FHktHitboxTrace>& OutTraces) const;

	void Clear();

private:
	FHktHitboxDebugTracer() = default;

	static constexpr int32 RingCapacity = 256;

	mutable FCriticalSection Lock;
	TArray<FHktHitboxTrace> Ring;  // 고정 크기 ring buffer
	int32 Head = 0;                // 다음 쓸 슬롯
	int32 Count = 0;               // 채워진 슬롯 수 (<= RingCapacity)
	std::atomic<bool> bEnabled{ false };
};

#endif // ENABLE_HKT_INSIGHTS
