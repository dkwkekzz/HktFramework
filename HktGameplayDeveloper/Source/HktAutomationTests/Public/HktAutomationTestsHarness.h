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

	// ========== 외부 이벤트 주입 ==========

	void InjectCollisionEvent(FHktEntityId HitEntity);
	void InjectMoveEndEvent();
	void AdvanceTimer(float DeltaSeconds);

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
