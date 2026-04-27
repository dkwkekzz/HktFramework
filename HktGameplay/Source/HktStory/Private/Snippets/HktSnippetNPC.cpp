// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Snippets/HktSnippetNPC.h"
#include "HktCoreProperties.h"
#include "HktStoryTags.h"
#include "HktRuntimeTags.h"

FHktStoryBuilder& HktSnippetNPC::SetupNPCStats(
	FHktStoryBuilder& B,
	const FGameplayTag& SpecificTag,
	const FHktNPCTemplate& Stats)
{
	using namespace Reg;
	using namespace HktStoryTags;
	using namespace HktGameplayTags;
	using namespace HktArchetypeTags;

	B.SaveConstEntity(Spawned, PropertyId::IsNPC, 1)
	 .SaveConstEntity(Spawned, PropertyId::Health, Stats.Health)
	 .SaveConstEntity(Spawned, PropertyId::MaxHealth, Stats.Health)
	 .SaveConstEntity(Spawned, PropertyId::AttackPower, Stats.AttackPower);

	if (Stats.Defense > 0)
	{
		B.SaveConstEntity(Spawned, PropertyId::Defense, Stats.Defense);
	}

	B.SaveConstEntity(Spawned, PropertyId::Team, Stats.Team)
	 .AddTag(Spawned, Entity_NPC)
	 .AddTag(Spawned, SpecificTag)
	 .AddTag(Spawned, Tag_NPC_Hostile)
	 .SetStance(Spawned, HktStance::Unarmed);

	if (Stats.MaxSpeed > 0)
	{
		B.SaveConstEntity(Spawned, PropertyId::MaxSpeed, Stats.MaxSpeed);
	}

	return B;
}

FHktStoryBuilder& HktSnippetNPC::SpawnerLoopBegin(
	FHktStoryBuilder& B,
	int32 LoopLabel,
	int32 WaitLabel,
	const FGameplayTag& CountTag,
	int32 Cap)
{
	FHktScopedReg Count(B);
	FHktScopedReg CapReg(B);

	B.Label(LoopLabel)
	 .HasPlayerInGroup(Reg::Flag)
	 .JumpIfNot(Reg::Flag, WaitLabel)
	 .CountByTag(Count, CountTag)
	 .LoadConst(CapReg, Cap)
	 .CmpGe(Reg::Flag, Count, CapReg)
	 .JumpIf(Reg::Flag, WaitLabel);

	return B;
}

FHktStoryBuilder& HktSnippetNPC::SpawnerLoopEnd(
	FHktStoryBuilder& B,
	int32 LoopLabel,
	int32 WaitLabel,
	float IntervalSeconds)
{
	B.Label(WaitLabel)
	 .WaitSeconds(IntervalSeconds)
	 .Jump(LoopLabel);

	return B;
}

FHktStoryBuilder& HktSnippetNPC::SpawnNPCAtPosition(
	FHktStoryBuilder& B,
	const FGameplayTag& NPCTag,
	const FHktNPCTemplate& Stats,
	RegisterIndex PosBaseReg)
{
	FHktRegReserve Guard(B.GetRegAllocator(), {PosBaseReg, static_cast<RegisterIndex>(PosBaseReg + 1), static_cast<RegisterIndex>(PosBaseReg + 2)});

	B.Log(TEXT("[Snippet] SpawnNPCAtPosition"))
	 .SpawnEntity(NPCTag);
	SetupNPCStats(B, NPCTag, Stats);
	B.SetPosition(Reg::Spawned, PosBaseReg)
	 .DispatchEventFrom(HktStoryTags::Story_NPC_Lifecycle, Reg::Spawned);

	return B;
}


// ============================================================================
// 신 FHktVar API 오버로드 (PR-2 단계 2)
// SetupNPCStats 는 Reg::Spawned 의존이 시맨틱이므로 본문은 그대로 두고,
// FHktVarBlock 기반 위치 인자만 신 오버로드로 노출한다.
// ============================================================================

FHktStoryBuilder& HktSnippetNPC::SpawnNPCAtPosition(
	FHktStoryBuilder& B,
	const FGameplayTag& NPCTag,
	const FHktNPCTemplate& Stats,
	FHktVarBlock PosBlock)
{
	check(PosBlock.Num() >= 3);
	B.Log(TEXT("[Snippet] SpawnNPCAtPosition (Var)"));
	FHktVar Spawned = B.SpawnEntityVar(NPCTag);
	// SetupNPCStats 는 Reg::Spawned (특수 슬롯) 시맨틱을 사용하므로 그대로 호출.
	SetupNPCStats(B, NPCTag, Stats);
	B.SetPosition(Spawned, PosBlock);
	B.DispatchEventFrom(HktStoryTags::Story_NPC_Lifecycle, Spawned);
	return B;
}
