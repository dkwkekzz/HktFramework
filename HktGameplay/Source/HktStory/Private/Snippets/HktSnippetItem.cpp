// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Snippets/HktSnippetItem.h"
#include "HktCoreProperties.h"
#include "HktCoreArchetype.h"
#include "HktStoryEventParams.h"

FHktStoryBuilder& HktSnippetItem::LoadItemFromSlot(
	FHktStoryBuilder& B,
	RegisterIndex DstReg,
	int32 FailLabel)
{
	const TArray<uint16>& Slots = HktTrait::GetEquipSlotPropertyIds();

	FHktRegReserve Guard(B.GetRegAllocator(), {DstReg});
	FHktScopedReg SlotIdx(B);
	FHktScopedReg Cmp(B);

	int32 DoneLabel = B.AllocLabel();
	TArray<int32> BranchLabels;
	BranchLabels.SetNum(Slots.Num());
	for (int32 i = 0; i < Slots.Num(); ++i)
		BranchLabels[i] = B.AllocLabel();

	// 슬롯 인덱스 로드 (UseSkillParams::EquipSlotIndex = Param1)
	B.LoadStore(SlotIdx, UseSkillParams::EquipSlotIndex);

	// 디스패치: 각 슬롯 인덱스에 대해 비교 + 점프
	for (int32 i = 0; i < Slots.Num(); ++i)
	{
		B.LoadConst(Cmp, i).CmpEq(Reg::Flag, SlotIdx, Cmp).JumpIf(Reg::Flag, BranchLabels[i]);
	}
	B.Jump(FailLabel);

	// 로드 타겟
	for (int32 i = 0; i < Slots.Num(); ++i)
	{
		B.Label(BranchLabels[i]).LoadStore(DstReg, Slots[i]).Jump(DoneLabel);
	}

	B.Label(DoneLabel);

	// 유효성 검증: 아이템 엔티티 != 0
	{
		FHktScopedReg Zero(B);
		B.LoadConst(Zero, 0)
		 .CmpEq(Reg::Flag, DstReg, Zero)
		 .JumpIf(Reg::Flag, FailLabel);
	}

	return B;
}

FHktStoryBuilder& HktSnippetItem::SaveItemToEquipSlot(
	FHktStoryBuilder& B,
	RegisterIndex SlotIndexReg,
	RegisterIndex ValueReg)
{
	const TArray<uint16>& Slots = HktTrait::GetEquipSlotPropertyIds();

	FHktRegReserve Guard(B.GetRegAllocator(), {SlotIndexReg, ValueReg});
	FHktScopedReg Cmp(B);

	int32 DoneLabel = B.AllocLabel();
	TArray<int32> BranchLabels;
	BranchLabels.SetNum(Slots.Num());
	for (int32 i = 0; i < Slots.Num(); ++i)
		BranchLabels[i] = B.AllocLabel();

	for (int32 i = 0; i < Slots.Num(); ++i)
	{
		B.LoadConst(Cmp, i).CmpEq(Reg::Flag, SlotIndexReg, Cmp).JumpIf(Reg::Flag, BranchLabels[i]);
	}
	B.Jump(DoneLabel);

	for (int32 i = 0; i < Slots.Num(); ++i)
	{
		B.Label(BranchLabels[i]).SaveEntityProperty(Reg::Self, Slots[i], ValueReg).Jump(DoneLabel);
	}

	B.Label(DoneLabel);

	return B;
}

FHktStoryBuilder& HktSnippetItem::ClearEquipSlot(
	FHktStoryBuilder& B,
	RegisterIndex SlotIndexReg)
{
	const TArray<uint16>& Slots = HktTrait::GetEquipSlotPropertyIds();

	FHktRegReserve Guard(B.GetRegAllocator(), {SlotIndexReg});
	FHktScopedReg Cmp(B);

	int32 DoneLabel = B.AllocLabel();
	TArray<int32> BranchLabels;
	BranchLabels.SetNum(Slots.Num());
	for (int32 i = 0; i < Slots.Num(); ++i)
		BranchLabels[i] = B.AllocLabel();

	for (int32 i = 0; i < Slots.Num(); ++i)
	{
		B.LoadConst(Cmp, i).CmpEq(Reg::Flag, SlotIndexReg, Cmp).JumpIf(Reg::Flag, BranchLabels[i]);
	}
	B.Jump(DoneLabel);

	for (int32 i = 0; i < Slots.Num(); ++i)
	{
		B.Label(BranchLabels[i]).SaveConstEntity(Reg::Self, Slots[i], 0).Jump(DoneLabel);
	}

	B.Label(DoneLabel);

	return B;
}

FHktStoryBuilder& HktSnippetItem::ApplyItemStats(
	FHktStoryBuilder& B,
	RegisterIndex ItemEntity,
	RegisterIndex CharEntity)
{
	FHktRegReserve Guard(B.GetRegAllocator(), {ItemEntity, CharEntity});
	FHktScopedReg ItemVal(B);
	FHktScopedReg CharVal(B);

	int32 SkipStanceLabel = B.AllocLabel();

	B.LoadEntityProperty(ItemVal, ItemEntity, PropertyId::AttackPower)
	 .LoadEntityProperty(CharVal, CharEntity, PropertyId::AttackPower)
	 .Add(CharVal, CharVal, ItemVal)
	 .SaveEntityProperty(CharEntity, PropertyId::AttackPower, CharVal)
	 .LoadEntityProperty(ItemVal, ItemEntity, PropertyId::Defense)
	 .LoadEntityProperty(CharVal, CharEntity, PropertyId::Defense)
	 .Add(CharVal, CharVal, ItemVal)
	 .SaveEntityProperty(CharEntity, PropertyId::Defense, CharVal)
	 // Stance: 장착 가능한 아이템만 Stance를 캐릭터에 적용
	 .LoadEntityProperty(ItemVal, ItemEntity, PropertyId::Equippable)
	 .CmpEqConst(Reg::Flag, ItemVal, 0)
	 .JumpIf(Reg::Flag, SkipStanceLabel)
	 .LoadEntityProperty(ItemVal, ItemEntity, PropertyId::Stance)
	 .SaveEntityProperty(CharEntity, PropertyId::Stance, ItemVal)
	.Label(SkipStanceLabel);

	return B;
}

FHktStoryBuilder& HktSnippetItem::RemoveItemStats(
	FHktStoryBuilder& B,
	RegisterIndex ItemEntity,
	RegisterIndex CharEntity)
{
	FHktRegReserve Guard(B.GetRegAllocator(), {ItemEntity, CharEntity});
	FHktScopedReg ItemVal(B);
	FHktScopedReg CharVal(B);

	B.LoadEntityProperty(ItemVal, ItemEntity, PropertyId::AttackPower)
	 .LoadEntityProperty(CharVal, CharEntity, PropertyId::AttackPower)
	 .Sub(CharVal, CharVal, ItemVal)
	 .SaveEntityProperty(CharEntity, PropertyId::AttackPower, CharVal)
	 .LoadEntityProperty(ItemVal, ItemEntity, PropertyId::Defense)
	 .LoadEntityProperty(CharVal, CharEntity, PropertyId::Defense)
	 .Sub(CharVal, CharVal, ItemVal)
	 .SaveEntityProperty(CharEntity, PropertyId::Defense, CharVal);

	return B;
}

FHktStoryBuilder& HktSnippetItem::ValidateOwnership(
	FHktStoryBuilder& B,
	RegisterIndex Entity,
	int32 FailLabel)
{
	FHktRegReserve Guard(B.GetRegAllocator(), {Entity});
	FHktScopedReg Owner(B);

	B.LoadEntityProperty(Owner, Entity, PropertyId::OwnerEntity)
	 .CmpNe(Reg::Flag, Owner, Reg::Self)
	 .JumpIf(Reg::Flag, FailLabel);

	return B;
}

FHktStoryBuilder& HktSnippetItem::ValidateItemState(
	FHktStoryBuilder& B,
	RegisterIndex Entity,
	int32 ExpectedState,
	int32 FailLabel)
{
	FHktRegReserve Guard(B.GetRegAllocator(), {Entity});
	FHktScopedReg State(B);
	FHktScopedReg Expected(B);

	B.LoadEntityProperty(State, Entity, PropertyId::ItemState)
	 .LoadConst(Expected, ExpectedState)
	 .CmpNe(Reg::Flag, State, Expected)
	 .JumpIf(Reg::Flag, FailLabel);

	return B;
}

FHktStoryBuilder& HktSnippetItem::FindEmptyEquipSlot(
	FHktStoryBuilder& B,
	RegisterIndex DstReg,
	int32 FailLabel)
{
	const TArray<uint16>& Slots = HktTrait::GetEquipSlotPropertyIds();

	FHktRegReserve Guard(B.GetRegAllocator(), {DstReg});
	FHktScopedReg SlotVal(B);
	FHktScopedReg Zero(B);

	int32 FoundLabel = B.AllocLabel();
	TArray<int32> BranchLabels;
	BranchLabels.SetNum(Slots.Num());
	for (int32 i = 0; i < Slots.Num(); ++i)
		BranchLabels[i] = B.AllocLabel();

	// EquipSlot0~8 순차 검사: 값이 0이면 빈 슬롯
	for (int32 i = 0; i < Slots.Num(); ++i)
	{
		B.LoadStore(SlotVal, Slots[i])
		 .LoadConst(Zero, 0)
		 .CmpEq(Reg::Flag, SlotVal, Zero)
		 .JumpIf(Reg::Flag, BranchLabels[i]);
	}
	B.Jump(FailLabel);  // 모든 슬롯이 차 있음

	for (int32 i = 0; i < Slots.Num(); ++i)
	{
		B.Label(BranchLabels[i])
		 .LoadConst(DstReg, i)
		 .Jump(FoundLabel);
	}

	B.Label(FoundLabel);

	return B;
}

// ================================================================
// 고수준 아이템 명령어
// ================================================================

FHktStoryBuilder& HktSnippetItem::AssignOwnership(
	FHktStoryBuilder& B,
	RegisterIndex ItemEntity,
	RegisterIndex NewOwner)
{
	B.Log(TEXT("[Snippet] AssignOwnership"))
	 .SaveEntityProperty(ItemEntity, PropertyId::OwnerEntity, NewOwner)
	 .SetOwnerUid(ItemEntity);

	return B;
}

FHktStoryBuilder& HktSnippetItem::ReleaseOwnership(
	FHktStoryBuilder& B,
	RegisterIndex ItemEntity)
{
	B.Log(TEXT("[Snippet] ReleaseOwnership"))
	 .SaveConstEntity(ItemEntity, PropertyId::OwnerEntity, 0)
	 .ClearOwnerUid(ItemEntity);

	return B;
}

FHktStoryBuilder& HktSnippetItem::ActivateInSlot(
	FHktStoryBuilder& B,
	RegisterIndex ItemEntity,
	RegisterIndex SlotIndexReg,
	RegisterIndex CharEntity)
{
	FHktRegReserve Guard(B.GetRegAllocator(), {ItemEntity, SlotIndexReg, CharEntity});
	FHktScopedReg SlotCopy(B);
	FHktScopedReg ItemCopy(B);

	// Active 상태로 전환 + EquipIndex 설정
	B.Log(TEXT("[Snippet] ActivateInSlot"))
	 .SaveConstEntity(ItemEntity, PropertyId::ItemState, 2)              // Active
	 .SaveEntityProperty(ItemEntity, PropertyId::EquipIndex, SlotIndexReg);

	// 캐릭터의 EquipSlot[N] = 아이템 EntityId
	B.Move(SlotCopy, SlotIndexReg);
	B.Move(ItemCopy, ItemEntity);
	SaveItemToEquipSlot(B, SlotCopy, ItemCopy);

	// 아이템 스탯 + Stance를 캐릭터에 적용
	ApplyItemStats(B, ItemEntity, CharEntity);

	return B;
}

FHktStoryBuilder& HktSnippetItem::DeactivateToBag(
	FHktStoryBuilder& B,
	RegisterIndex ItemEntity,
	RegisterIndex CharEntity)
{
	// InBag 상태로 전환 + EquipIndex 해제
	B.Log(TEXT("[Snippet] DeactivateToBag"))
	 .SaveConstEntity(ItemEntity, PropertyId::ItemState, 1)              // InBag
	 .SaveConstEntity(ItemEntity, PropertyId::EquipIndex, -1);           // 액션 해제

	// 아이템 스탯을 캐릭터에서 차감
	RemoveItemStats(B, ItemEntity, CharEntity);

	return B;
}

FHktStoryBuilder& HktSnippetItem::DropToGround(
	FHktStoryBuilder& B,
	RegisterIndex ItemEntity,
	RegisterIndex PositionSourceEntity)
{
	FHktRegReserve Guard(B.GetRegAllocator(), {ItemEntity, PositionSourceEntity});

	// Ground로 전환
	B.Log(TEXT("[Snippet] DropToGround"))
	 .SaveConstEntity(ItemEntity, PropertyId::ItemState, 0)              // Ground
	 .SaveConstEntity(ItemEntity, PropertyId::EquipIndex, -1);           // 장착 해제

	// 소유권 해제
	ReleaseOwnership(B, ItemEntity);

	// 위치 설정
	B.CopyPosition(ItemEntity, PositionSourceEntity);

	return B;
}

FHktStoryBuilder& HktSnippetItem::SpawnGroundItem(
	FHktStoryBuilder& B,
	const FGameplayTag& ItemClassTag,
	const FHktGroundItemTemplate& Template,
	RegisterIndex PosSourceEntity)
{
	FHktRegReserve Guard(B.GetRegAllocator(), {PosSourceEntity});

	B.Log(TEXT("[Snippet] SpawnGroundItem"))
	 .SpawnEntity(ItemClassTag)
	 .SaveConstEntity(Reg::Spawned, PropertyId::ItemState, 0)                 // Ground
	 .SaveConstEntity(Reg::Spawned, PropertyId::ItemId, Template.ItemId)
	 .SaveConstEntity(Reg::Spawned, PropertyId::EquipIndex, -1);              // 미등록

	B.CopyPosition(Reg::Spawned, PosSourceEntity);

	return B;
}

FHktStoryBuilder& HktSnippetItem::SpawnGroundItemAtPos(
	FHktStoryBuilder& B,
	const FGameplayTag& ItemClassTag,
	const FHktGroundItemTemplate& Template,
	RegisterIndex PosBase)
{
	FHktRegReserve Guard(B.GetRegAllocator(), {PosBase, static_cast<RegisterIndex>(PosBase + 1), static_cast<RegisterIndex>(PosBase + 2)});

	B.Log(TEXT("[Snippet] SpawnGroundItem"))
	 .SpawnEntity(ItemClassTag)
	 .SaveConstEntity(Reg::Spawned, PropertyId::ItemState, 0)                 // Ground
	 .SaveConstEntity(Reg::Spawned, PropertyId::ItemId, Template.ItemId)
	 .SaveConstEntity(Reg::Spawned, PropertyId::EquipIndex, -1);              // 미등록

	B.SetPosition(Reg::Spawned, PosBase);

	return B;
}


// ============================================================================
// 신 FHktVar API 오버로드 (PR-2 단계 2)
// ============================================================================

FHktStoryBuilder& HktSnippetItem::ApplyItemStats(
	FHktStoryBuilder& B,
	FHktVar ItemEntity,
	FHktVar CharEntity)
{
	FHktVar ItemVal = B.NewVar(TEXT("ApplyStats.Item"));
	FHktVar CharVal = B.NewVar(TEXT("ApplyStats.Char"));

	B.LoadStoreEntity(ItemVal, ItemEntity, PropertyId::AttackPower);
	B.LoadStoreEntity(CharVal, CharEntity, PropertyId::AttackPower);
	B.Add(CharVal, CharVal, ItemVal);
	B.SaveStoreEntity(CharEntity, PropertyId::AttackPower, CharVal);

	B.LoadStoreEntity(ItemVal, ItemEntity, PropertyId::Defense);
	B.LoadStoreEntity(CharVal, CharEntity, PropertyId::Defense);
	B.Add(CharVal, CharVal, ItemVal);
	B.SaveStoreEntity(CharEntity, PropertyId::Defense, CharVal);

	// Equippable 검사 — Equippable != 0 일 때만 Stance 복사
	FHktVar Eq = B.NewVar(TEXT("ApplyStats.Eq"));
	B.LoadStoreEntity(Eq, ItemEntity, PropertyId::Equippable);
	B.If(Eq);
	B.LoadStoreEntity(ItemVal, ItemEntity, PropertyId::Stance);
	B.SaveStoreEntity(CharEntity, PropertyId::Stance, ItemVal);
	B.EndIf();
	return B;
}

FHktStoryBuilder& HktSnippetItem::RemoveItemStats(
	FHktStoryBuilder& B,
	FHktVar ItemEntity,
	FHktVar CharEntity)
{
	FHktVar ItemVal = B.NewVar(TEXT("RemoveStats.Item"));
	FHktVar CharVal = B.NewVar(TEXT("RemoveStats.Char"));

	B.LoadStoreEntity(ItemVal, ItemEntity, PropertyId::AttackPower);
	B.LoadStoreEntity(CharVal, CharEntity, PropertyId::AttackPower);
	B.Sub(CharVal, CharVal, ItemVal);
	B.SaveStoreEntity(CharEntity, PropertyId::AttackPower, CharVal);

	B.LoadStoreEntity(ItemVal, ItemEntity, PropertyId::Defense);
	B.LoadStoreEntity(CharVal, CharEntity, PropertyId::Defense);
	B.Sub(CharVal, CharVal, ItemVal);
	B.SaveStoreEntity(CharEntity, PropertyId::Defense, CharVal);
	return B;
}

FHktStoryBuilder& HktSnippetItem::AssignOwnership(
	FHktStoryBuilder& B,
	FHktVar ItemEntity,
	FHktVar NewOwner)
{
	B.Log(TEXT("[Snippet] AssignOwnership (Var)"));
	B.SaveStoreEntity(ItemEntity, PropertyId::OwnerEntity, NewOwner);
	B.SetOwnerUid(ItemEntity);
	return B;
}

FHktStoryBuilder& HktSnippetItem::ReleaseOwnership(
	FHktStoryBuilder& B,
	FHktVar ItemEntity)
{
	B.Log(TEXT("[Snippet] ReleaseOwnership (Var)"));
	B.SaveConstEntity(ItemEntity, PropertyId::OwnerEntity, 0);
	B.ClearOwnerUid(ItemEntity);
	return B;
}

FHktStoryBuilder& HktSnippetItem::DropToGround(
	FHktStoryBuilder& B,
	FHktVar ItemEntity,
	FHktVar PositionSourceEntity)
{
	B.Log(TEXT("[Snippet] DropToGround (Var)"));
	B.SaveConstEntity(ItemEntity, PropertyId::ItemState, 0);          // Ground
	B.SaveConstEntity(ItemEntity, PropertyId::EquipIndex, -1);
	HktSnippetItem::ReleaseOwnership(B, ItemEntity);
	B.CopyPosition(ItemEntity, PositionSourceEntity);
	return B;
}

FHktStoryBuilder& HktSnippetItem::SpawnGroundItemAtPos(
	FHktStoryBuilder& B,
	const FGameplayTag& ItemClassTag,
	const FHktGroundItemTemplate& Template,
	FHktVarBlock PosBlock)
{
	B.Log(TEXT("[Snippet] SpawnGroundItemAtPos (Var)"));
	FHktVar Spawned = B.SpawnEntityVar(ItemClassTag);
	B.SaveConstEntity(Spawned, PropertyId::ItemState, 0);              // Ground
	B.SaveConstEntity(Spawned, PropertyId::ItemId, Template.ItemId);
	B.SaveConstEntity(Spawned, PropertyId::EquipIndex, -1);
	B.SetPosition(Spawned, PosBlock);
	return B;
}
