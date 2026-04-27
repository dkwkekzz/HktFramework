// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Snippets/HktSnippetCombat.h"
#include "HktCoreProperties.h"

FHktStoryBuilder& HktSnippetCombat::CooldownCheck(
	FHktStoryBuilder& B,
	int32 FailLabel)
{
	FHktScopedReg CurFrame(B);
	FHktScopedReg NextAction(B);

	B.GetWorldTime(CurFrame)
	 .LoadStore(NextAction, PropertyId::NextActionFrame)
	 .CmpLt(Reg::Flag, CurFrame, NextAction)
	 .JumpIf(Reg::Flag, FailLabel);

	return B;
}

FHktStoryBuilder& HktSnippetCombat::CooldownUpdateConst(
	FHktStoryBuilder& B,
	int32 RecoveryFrame)
{
	FHktScopedReg A(B);
	FHktScopedReg C(B);
	FHktScopedReg D(B);

	// NextActionFrame = 현재프레임 + (RecoveryFrame * 100 / AttackSpeed)
	B.GetWorldTime(A)
	 .LoadConst(C, RecoveryFrame)
	 .LoadConst(D, 100)
	 .Mul(C, C, D)
	 .LoadStore(D, PropertyId::AttackSpeed)
	 .Div(C, C, D)
	 .Add(A, A, C)
	 .SaveStore(PropertyId::NextActionFrame, A);

	// MotionPlayRate = ReferenceRecovery * AttackSpeed / RecoveryFrame
	B.LoadConst(A, ReferenceRecovery)
	 .LoadStore(C, PropertyId::AttackSpeed)
	 .Mul(A, A, C)
	 .LoadConst(C, RecoveryFrame)
	 .Div(A, A, C)
	 .SaveStore(PropertyId::MotionPlayRate, A);

	return B;
}

FHktStoryBuilder& HktSnippetCombat::CooldownUpdateFromEntity(
	FHktStoryBuilder& B,
	RegisterIndex ItemEntity)
{
	FHktRegReserve Guard(B.GetRegAllocator(), {ItemEntity});
	FHktScopedReg A(B);
	FHktScopedReg C(B);
	FHktScopedReg D(B);

	// NextActionFrame = 현재프레임 + (Item.RecoveryFrame * 100 / AttackSpeed)
	B.GetWorldTime(A)
	 .LoadEntityProperty(C, ItemEntity, PropertyId::RecoveryFrame)
	 .LoadConst(D, 100)
	 .Mul(C, C, D)
	 .LoadStore(D, PropertyId::AttackSpeed)
	 .Div(C, C, D)
	 .Add(A, A, C)
	 .SaveStore(PropertyId::NextActionFrame, A);

	// MotionPlayRate = ReferenceRecovery * AttackSpeed / Item.RecoveryFrame
	B.LoadConst(A, ReferenceRecovery)
	 .LoadStore(C, PropertyId::AttackSpeed)
	 .Mul(A, A, C)
	 .LoadEntityProperty(C, ItemEntity, PropertyId::RecoveryFrame)
	 .Div(A, A, C)
	 .SaveStore(PropertyId::MotionPlayRate, A);

	return B;
}

FHktStoryBuilder& HktSnippetCombat::ResourceGainClamped(
	FHktStoryBuilder& B,
	uint16 CurrentProp,
	uint16 MaxProp,
	int32 Amount)
{
	FHktScopedReg Cur(B);
	FHktScopedReg Max(B);
	FHktScopedReg Amt(B);
	FHktScopedReg Cmp(B);

	int32 NoClampLabel = B.AllocLabel();

	B.LoadStore(Cur, CurrentProp)
	 .LoadStore(Max, MaxProp)
	 .LoadConst(Amt, Amount)
	 .Add(Cur, Cur, Amt)
	 .CmpGt(Cmp, Cur, Max)
	 .JumpIfNot(Cmp, NoClampLabel)
	 .Move(Cur, Max)
	 .Label(NoClampLabel)
	 .SaveStore(CurrentProp, Cur);

	return B;
}

// ============================================================================
// 애니메이션 제어
// ============================================================================

FHktStoryBuilder& HktSnippetCombat::AnimTrigger(
	FHktStoryBuilder& B,
	RegisterIndex Entity,
	const FGameplayTag& AnimTag)
{
	B.PlayAnim(Entity, AnimTag);
	return B;
}

FHktStoryBuilder& HktSnippetCombat::AnimLoopStart(
	FHktStoryBuilder& B,
	RegisterIndex Entity,
	const FGameplayTag& AnimTag)
{
	B.AddTag(Entity, AnimTag);
	return B;
}

FHktStoryBuilder& HktSnippetCombat::AnimLoopStop(
	FHktStoryBuilder& B,
	RegisterIndex Entity,
	const FGameplayTag& AnimTag)
{
	B.RemoveTag(Entity, AnimTag);
	return B;
}

FHktStoryBuilder& HktSnippetCombat::CheckDeath(
	FHktStoryBuilder& B,
	RegisterIndex Entity,
	const FGameplayTag& DeadTag)
{
	B.IfPropertyLe(Entity, PropertyId::Health, 0)
		.AddTag(Entity, DeadTag)
	.EndIf();
	return B;
}


// ============================================================================
// 신 FHktVar API 오버로드 (PR-2 단계 2)
// 모든 함수는 본 모듈의 RegisterIndex 버전과 동일한 시맨틱이지만 anonymous VReg
// 기반의 새 빌더 메서드만 사용한다.
// ============================================================================

FHktStoryBuilder& HktSnippetCombat::CooldownUpdateFromEntity(
	FHktStoryBuilder& B,
	FHktVar ItemEntity)
{
	FHktVar A = B.NewVar(TEXT("CooldownUpdate.A"));
	FHktVar C = B.NewVar(TEXT("CooldownUpdate.C"));
	FHktVar D = B.NewVar(TEXT("CooldownUpdate.D"));

	B.GetWorldTime(A);
	B.LoadStoreEntity(C, ItemEntity, PropertyId::RecoveryFrame);
	B.LoadConst(D, 100);
	B.Mul(C, C, D);
	B.LoadStore(D, PropertyId::AttackSpeed);
	B.Div(C, C, D);
	B.Add(A, A, C);
	B.SaveStore(PropertyId::NextActionFrame, A);

	B.LoadConst(A, ReferenceRecovery);
	B.LoadStore(C, PropertyId::AttackSpeed);
	B.Mul(A, A, C);
	B.LoadStoreEntity(C, ItemEntity, PropertyId::RecoveryFrame);
	B.Div(A, A, C);
	B.SaveStore(PropertyId::MotionPlayRate, A);

	return B;
}

FHktStoryBuilder& HktSnippetCombat::AnimTrigger(
	FHktStoryBuilder& B,
	FHktVar Entity,
	const FGameplayTag& AnimTag)
{
	B.PlayAnim(Entity, AnimTag);
	return B;
}

FHktStoryBuilder& HktSnippetCombat::AnimLoopStart(
	FHktStoryBuilder& B,
	FHktVar Entity,
	const FGameplayTag& AnimTag)
{
	B.AddTag(Entity, AnimTag);
	return B;
}

FHktStoryBuilder& HktSnippetCombat::AnimLoopStop(
	FHktStoryBuilder& B,
	FHktVar Entity,
	const FGameplayTag& AnimTag)
{
	B.RemoveTag(Entity, AnimTag);
	return B;
}

FHktStoryBuilder& HktSnippetCombat::CheckDeath(
	FHktStoryBuilder& B,
	FHktVar Entity,
	const FGameplayTag& DeadTag)
{
	// 새 API 에는 IfPropertyLe(FHktVar) 가 아직 없으므로 분해 형태로 작성:
	//   if (Entity.Health <= 0) AddTag(Entity, DeadTag)
	FHktVar Health = B.NewVar(TEXT("CheckDeath.Health"));
	FHktVar Zero = B.NewVar(TEXT("CheckDeath.Zero"));
	B.LoadStoreEntity(Health, Entity, PropertyId::Health);
	B.LoadConst(Zero, 0);
	B.CmpLe(B.FlagVar(), Health, Zero);
	B.If(B.FlagVar());
	B.AddTag(Entity, DeadTag);
	B.EndIf();
	return B;
}
