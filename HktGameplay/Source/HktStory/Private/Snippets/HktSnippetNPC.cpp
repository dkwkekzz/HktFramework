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
