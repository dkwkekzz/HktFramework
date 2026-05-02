// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktCoreDefs.h"
#include "HktStoryTypes.h"
#include "HktWorldState.h"
#include "HktCoreEvents.h"
#include "VM/HktVMTypes.h"
#include "VM/HktVMRuntime.h"
#include "VM/HktVMContext.h"
#include "VM/HktVMWorldStateProxy.h"
#include "VM/HktVMInterpreter.h"

struct FHktVMProgram;

/**
 * FHktAutomationTestHarness — Opcode/Story 테스트용 VM 실행 환경
 *
 * WorldState + VMProxy + Interpreter를 초기화하고,
 * FHktStoryBuilder로 빌드한 프로그램을 실행/검증하는 유틸리티.
 */
class HKTAUTOMATIONTESTS_API FHktAutomationTestHarness
{
public:
	void Setup();
	void Teardown();

	// ========== Entity 생성 ==========

	FHktEntityId CreateEntity();
	FHktEntityId CreateEntityWithProperties(const TMap<uint16, int32>& Props);

	// ========== VM 실행 ==========

	/**
	 * 프로그램을 실행 (Completed/Failed까지 최대 MaxTicks 반복).
	 * Yield는 자동으로 재개, WaitingEvent는 MaxTicks 초과 시 중단.
	 */
	EVMStatus ExecuteProgram(
		TSharedPtr<FHktVMProgram> Program,
		FHktEntityId Source,
		FHktEntityId Target = InvalidEntityId,
		int32 MaxTicks = 100);

	/** Registry에서 가져온 const 프로그램을 직접 실행 (복사 불필요) */
	EVMStatus ExecuteProgram(
		const FHktVMProgram* Program,
		FHktEntityId Source,
		FHktEntityId Target = InvalidEntityId,
		int32 MaxTicks = 100);

	/** 단일 틱 실행 (Yield/WaitingEvent 테스트용) */
	EVMStatus ExecuteTick();

	// ========== Wait 분리 실행 (Phase 2c — 외부 이벤트 주입과 결합) ==========

	/**
	 * VM 이 Wait* op (Collision/MoveEnd/Grounded 등 비-Timer) 에 도달할 때까지 진행한다.
	 * Yield 와 WaitingEvent::Timer 는 자동 소화. 도달 시 OutWaitKind 에 EventWait.Type 반환.
	 * Halt/Failed 도달 시 OutWaitKind = EWaitEventType::None.
	 */
	EVMStatus ExecuteUntilWait(
		const FHktVMProgram* Program,
		FHktEntityId Source,
		FHktEntityId Target,
		int32 MaxTicks,
		EWaitEventType& OutWaitKind);

	/**
	 * Wait 해소 후 (Inject 또는 AdvanceTimerFrames 호출 후) 또는 일반 진행 — Halt/Failed 까지 실행.
	 * ExecuteProgram 과 동일 정책 (Yield 자동, Timer 자동, 비-Timer 도달 시 멈춤).
	 */
	EVMStatus ResumeUntilDone(int32 MaxTicks);

	// ========== 외부 이벤트 주입 ==========

	void InjectCollisionEvent(FHktEntityId HitEntity);
	void InjectMoveEndEvent();
	/** Grounded 이벤트 주입 — WaitGrounded 해소 (Jump 류 Story 검증용). */
	void InjectGroundedEvent();
	/** Timer Wait 진행 — 호출자가 명시한 프레임 수만큼 차감. 결정론적(정수). */
	void AdvanceTimerFrames(int32 Frames);
	/**
	 * AnimEnd 의제 주입. WaitAnimEnd 가 내부적으로 Timer (= SimFPS 프레임) 로 디스패치되므로,
	 * Timer 를 한 번에 SimFPS 만큼 진행시키는 편의 래퍼. VM/EWaitEventType 변경 없음.
	 */
	void InjectAnimEndEvent();

	/**
	 * Context.EventParam0..3 / EventTargetPos* 직접 세팅. 실제 게임에선 이벤트 디스패치
	 * (HktSimulationSystems) 가 채우지만, 하니스는 이벤트 우회 직접 실행이라 spec 에서 명시 필요.
	 * ExecuteProgram 호출 직전에 사용.
	 */
	void SetEventParams(int32 P0, int32 P1, int32 P2, int32 P3,
	                    int32 TargetPosX, int32 TargetPosY, int32 TargetPosZ);

	// ========== 검증 헬퍼 ==========

	int32 GetRegister(RegisterIndex Idx) const;
	int32 GetProperty(FHktEntityId Entity, uint16 PropId) const;
	bool HasTag(FHktEntityId Entity, const FGameplayTag& Tag) const;
	int32 GetEntityCount() const;

	// ========== 내부 상태 접근 ==========

	FHktWorldState& GetWorldState() { return WorldState; }
	const FHktWorldState& GetWorldState() const { return WorldState; }
	FHktVMRuntime& GetRuntime() { return Runtime; }
	const FHktVMRuntime& GetRuntime() const { return Runtime; }
	FHktVMWorldStateProxy& GetVMProxy() { return VMProxy; }

private:
	FHktWorldState WorldState;
	FHktVMWorldStateProxy VMProxy;
	FHktVMInterpreter Interpreter;
	FHktVMRuntime Runtime;
	FHktVMContext Context;
};
