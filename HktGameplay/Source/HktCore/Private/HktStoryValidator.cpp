// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktStoryValidator.h"
#include "HktCoreLog.h"
#include "HktCoreEventLog.h"

FHktStoryValidator::FHktStoryValidator(
	const TArray<FInstruction>& InCode,
	const FGameplayTag& InTag,
	const TMap<FName, int32>& InLabels,
	const TMap<int32, int32>& InIntLabels,
	bool bInFlowMode)
	: Code(InCode)
	, Tag(InTag)
	, bFlowMode(bInFlowMode)
{
	for (const auto& Pair : InLabels)
	{
		LabelPCs.Add(Pair.Value);
	}
	for (const auto& Pair : InIntLabels)
	{
		LabelPCs.Add(Pair.Value);
	}
}

// ============================================================================
// Entity Register Validation (R0~R9 entity params + R10~R14 special)
// ============================================================================

bool FHktStoryValidator::ValidateEntityFlow()
{
	bool bValid = true;
	// Self(R10), Target(R11)은 이벤트에서 항상 초기화됨
	// Flow 모드에서는 SourceEntity가 없으므로 Self/Target도 무효
	// Spawned(R12), Hit(R13), Iter(R14)는 특정 Op 실행 후에만 유효
	const uint16 AlwaysValid = bFlowMode ? 0 : ((1 << Reg::Self) | (1 << Reg::Target));
	uint16 EntityRegs = AlwaysValid;

	// GP 레지스터(R0~R9) 초기화 추적 — 엔티티 파라미터로 사용될 때 검증
	constexpr int32 NumGPRegs = 10;
	uint16 GPRegsWritten = 0;

	auto GetRegName = [](RegisterIndex R) -> FString
	{
		switch (R)
		{
		case Reg::Self:    return TEXT("Self");
		case Reg::Target:  return TEXT("Target");
		case Reg::Spawned: return TEXT("Spawned");
		case Reg::Hit:     return TEXT("Hit");
		case Reg::Iter:    return TEXT("Iter");
		default:           return FString::Printf(TEXT("R%d"), R);
		}
	};

	// 에러 상세 정보를 수집 — 검증 완료 후 일괄 출력
	struct FEntityError
	{
		int32 PC;
		EOpCode Op;
		RegisterIndex Reg;
	};
	TArray<FEntityError> Errors;

	// 엔티티로 사용되는 레지스터가 초기화되었는지 검사
	// - R10~R14: 특수 엔티티 레지스터 (SpawnEntity/WaitCollision/NextFound으로 초기화)
	// - R0~R9: GP 레지스터가 엔티티 파라미터로 사용되는 경우 Write 여부 검사
	auto CheckEntityReg = [&](int32 PC, EOpCode Op, RegisterIndex R)
	{
		if (R < NumGPRegs)
		{
			// GP register used as entity parameter
			if (!(GPRegsWritten & (1 << R)))
			{
				Errors.Add({ PC, Op, R });
				bValid = false;
			}
			return;
		}

		// Special entity register (R10~R14)
		if (R <= Reg::Iter && !(EntityRegs & (1 << R)))
		{
			Errors.Add({ PC, Op, R });
			bValid = false;
		}
	};

	for (int32 PC = 0; PC < Code.Num(); ++PC)
	{
		if (LabelPCs.Contains(PC))
		{
			// Label 합류점: 다른 경로에서 올 수 있으므로 보수적으로 리셋.
			// - 엔티티 레지스터: Self/Target만 항상 유효
			// - GP 레지스터: 합류점에서는 초기화 가정 (ValidateRegisterFlow와 동일, 오탐 방지)
			EntityRegs = AlwaysValid;
			GPRegsWritten = (1 << NumGPRegs) - 1;  // 모든 GP를 Written으로 (오탐 방지)
		}

		const FInstruction& Inst = Code[PC];
		EOpCode Op = Inst.GetOpCode();

		// GP 레지스터 Write 추적 (모든 opcode 공통)
		FOpRegInfo Info = GetOpRegInfo(Op);
		if (Info.Dst == ERegRole::Write && Inst.Dst < NumGPRegs)
		{
			GPRegsWritten |= (1 << Inst.Dst);
		}

		switch (Op)
		{
		// --- Entity register writers ---
		case EOpCode::SpawnEntity:
			EntityRegs |= (1 << Reg::Spawned);
			break;
		case EOpCode::WaitCollision:
			CheckEntityReg(PC, Op, Inst.Src1);
			EntityRegs |= (1 << Reg::Hit);
			break;
		case EOpCode::NextFound:
			EntityRegs |= (1 << Reg::Iter);
			break;

		// --- Entity register readers (Src1 = entity) ---
		case EOpCode::LoadStoreEntity:
		case EOpCode::SaveStoreEntity:
		case EOpCode::DestroyEntity:
		case EOpCode::FindInRadius:
		case EOpCode::FindInRadiusEx:
			CheckEntityReg(PC, Op, Inst.Src1);
			break;
		case EOpCode::GetDistance:
		case EOpCode::LookAt:
			CheckEntityReg(PC, Op, Inst.Src1);
			CheckEntityReg(PC, Op, Inst.Src2);
			break;
		case EOpCode::AddTag:
		case EOpCode::RemoveTag:
		case EOpCode::HasTag:
		case EOpCode::PlayVFXAttached:
		case EOpCode::PlayAnim:
		case EOpCode::ApplyEffect:
		case EOpCode::RemoveEffect:
		case EOpCode::SetOwnerUid:
		case EOpCode::ClearOwnerUid:
		case EOpCode::CountByOwner:
		case EOpCode::FindByOwner:
		case EOpCode::WaitMoveEnd:
		case EOpCode::WaitAnimEnd:
		case EOpCode::SetForwardTarget:
			CheckEntityReg(PC, Op, Inst.Src1);
			break;

		// --- Entity register readers (Dst = entity, MakeImm 인코딩) ---
		case EOpCode::DispatchEventTo:
		case EOpCode::DispatchEventFrom:
			CheckEntityReg(PC, Op, Inst.Dst);
			break;

		default:
			break;
		}
	}

	// 에러 상세 출력 — 모든 위반을 한꺼번에 보여준다
	if (!bValid)
	{
		FString Detail;
		for (const FEntityError& Err : Errors)
		{
			Detail += FString::Printf(
				TEXT("\n  [PC=%d] Op=%s — Reg %s (R%d) 미초기화 사용"),
				Err.PC, GetOpCodeName(Err.Op), *GetRegName(Err.Reg), Err.Reg);
		}

		UE_LOG(LogHktCore, Error,
			TEXT("========================================\n")
			TEXT("  STORY ENTITY VALIDATION FAILED: %s\n")
			TEXT("  %d건의 invalid entity 사용 감지:%s\n")
			TEXT("\n  R0~R9   → 엔티티 파라미터 사용 전 Write 필요")
			TEXT("\n  Spawned → SpawnEntity 이후 유효")
			TEXT("\n  Hit     → WaitCollision 이후 유효")
			TEXT("\n  Iter    → NextFound 이후 유효")
			TEXT("\n  분기(Label) 합류점에서 Spawned/Hit/Iter는 무효 처리됩니다.")
			TEXT("\n========================================"),
			*Tag.ToString(), Errors.Num(), *Detail);

		for (const FEntityError& Err : Errors)
		{
			HKT_EVENT_LOG(HktLogTags::Core_Story, EHktLogLevel::Error, EHktLogSource::Server, FString::Printf(
				TEXT("Story BUILD: %s PC=%d Op=%s — Reg %s (R%d) 가 엔티티로 사용되었지만 이전에 초기화되지 않았습니다."),
				*Tag.ToString(), Err.PC, GetOpCodeName(Err.Op), *GetRegName(Err.Reg), Err.Reg));
		}
	}

	return bValid;
}

// ============================================================================
// General Register Flow Validation (R0~R8)
// ============================================================================

int32 FHktStoryValidator::ValidateRegisterFlow()
{
	/**
	 * 범용 레지스터(R0~R8) 흐름을 선형 스캔하여 두 가지 패턴을 감지:
	 *
	 * 1. Read-before-Write: 초기화 안 된 레지스터를 읽는 경우
	 *    → 이전 Story 실행의 잔류값에 의존하는 잠재 버그
	 *
	 * 2. Dead Write (Write-Write-without-Read): 값을 쓰고 읽지 않고 다시 덮어쓰는 경우
	 *    → Snippet 파라미터 레지스터가 내부 temp에 의해 덮어씌워지는 유형의 버그
	 *
	 * Label(합류점)에서는 상태를 보수적으로 리셋하여 오탐을 방지한다.
	 */
	constexpr int32 NumGPRegs = 10; // R0~R9 (ScopedReg 도입으로 R9 예약 해제)
	int32 WarningCount = 0;

	enum class ERegState : uint8 { Unknown, Written, Read };
	ERegState State[NumGPRegs];
	int32 WritePC[NumGPRegs];
	for (int32 i = 0; i < NumGPRegs; ++i)
	{
		State[i] = ERegState::Unknown;
		WritePC[i] = -1;
	}

	auto MarkRead = [&](int32 PC, EOpCode Op, RegisterIndex R)
	{
		if (R >= NumGPRegs) return;
		if (State[R] == ERegState::Unknown)
		{
			HKT_EVENT_LOG(HktLogTags::Core_Story, EHktLogLevel::Warning, EHktLogSource::Server, FString::Printf(
				TEXT("Story REGFLOW: %s PC=%d Op=%s — R%d Read-before-Write. "
					 "초기화되지 않은 레지스터를 읽고 있습니다."),
				*Tag.ToString(), PC, GetOpCodeName(Op), R));
			++WarningCount;
		}
		State[R] = ERegState::Read;
	};

	auto MarkWrite = [&](int32 PC, EOpCode Op, RegisterIndex R)
	{
		if (R >= NumGPRegs) return;
		if (State[R] == ERegState::Written)
		{
			HKT_EVENT_LOG(HktLogTags::Core_Story, EHktLogLevel::Warning, EHktLogSource::Server, FString::Printf(
				TEXT("Story REGFLOW: %s PC=%d Op=%s — R%d Dead Write. "
					 "PC=%d에서 쓴 값을 읽지 않고 덮어쓰고 있습니다. 레지스터 충돌을 확인하세요."),
				*Tag.ToString(), PC, GetOpCodeName(Op), R, WritePC[R]));
			++WarningCount;
		}
		State[R] = ERegState::Written;
		WritePC[R] = PC;
	};

	for (int32 PC = 0; PC < Code.Num(); ++PC)
	{
		// Label 합류점: 다른 경로에서 올 수 있으므로 상태를 보수적으로 Read로 리셋
		if (LabelPCs.Contains(PC))
		{
			for (int32 i = 0; i < NumGPRegs; ++i)
			{
				State[i] = ERegState::Read;
			}
		}

		const FInstruction& Inst = Code[PC];
		EOpCode Op = Inst.GetOpCode();
		FOpRegInfo Info = GetOpRegInfo(Op);

		// Read를 먼저 처리 (같은 명령에서 Read+Write면 Read가 먼저 발생)
		if (Info.Src1 == ERegRole::Read)
			MarkRead(PC, Op, Inst.Src1);
		if (Info.Src2 == ERegRole::Read)
			MarkRead(PC, Op, Inst.Src2);

		// Write 처리
		if (Info.Dst == ERegRole::Write)
			MarkWrite(PC, Op, Inst.Dst);
	}

	return WarningCount;
}
