// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HAL/CriticalSection.h"
#include "HktCoreDefs.h"
#include <atomic>

/**
 * Collision Pair 디버그 트레이서 — FHktPhysicsSystem Phase1 이 실제로 검출한
 * 엔티티-엔티티 충돌 페어(접촉점·양측 위치·Layer) 를 ring buffer 에 적재한다.
 * HktPresentation 측 Processor 가 매 프레임 Snapshot 을 읽어 DrawDebugLine /
 * DrawDebugPoint 로 시각화한다.
 *
 * Hitbox tracer(I-0020) 가 VM `Op_FindInRadius` 의 *AoE 스윕* 자취를 그리는 반면,
 * 이 tracer 는 PhysicsSystem 의 *캡슐-캡슐 narrow phase 결과* 만 다룬다.
 *
 * - ENABLE_HKT_INSIGHTS 가드: Shipping 빌드는 모든 API 가 인라인 no-op.
 * - bEnabled 게이트: Presentation Processor 가 CVar 와 동기화. off 일 때 Push 는
 *   atomic load 한 번에 종료 → 결정론·성능 영향 0.
 */

#if ENABLE_HKT_INSIGHTS

struct HKTCORE_API FHktCollisionPair
{
	uint64 SimFrame = 0;
	FHktEntityId EntityA = InvalidEntityId;
	FHktEntityId EntityB = InvalidEntityId;
	FVector PosA = FVector::ZeroVector;        // sim cm
	FVector PosB = FVector::ZeroVector;        // sim cm
	FVector ContactPoint = FVector::ZeroVector; // sim cm
	uint32 LayerA = 0;
	uint32 LayerB = 0;
};

class HKTCORE_API FHktCollisionDebugTracer
{
public:
	static FHktCollisionDebugTracer& Get();

	FORCEINLINE bool IsEnabled() const { return bEnabled.load(std::memory_order_relaxed); }
	void SetEnabled(bool bInEnabled) { bEnabled.store(bInEnabled, std::memory_order_relaxed); }

	void Push(const FHktCollisionPair& Pair);

	/** 최근 N 프레임 이내 페어만 복사 (CurrentSimFrame 기준). MaxAgeFrames=0 이면 전체. */
	void Snapshot(uint64 CurrentSimFrame, int32 MaxAgeFrames, TArray<FHktCollisionPair>& OutPairs) const;

	void Clear();

private:
	FHktCollisionDebugTracer() = default;

	static constexpr int32 RingCapacity = 512;

	mutable FCriticalSection Lock;
	TArray<FHktCollisionPair> Ring;
	int32 Head = 0;
	int32 Count = 0;
	std::atomic<bool> bEnabled{ false };
};

#endif // ENABLE_HKT_INSIGHTS
