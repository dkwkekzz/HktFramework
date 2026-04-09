// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "CoreMinimal.h"
#include "HktStoryBuilder.h"
#include "HktWorldState.h"
#include "HktCoreEvents.h"
#include "HktCoreProperties.h"
#include "HktStoryRegistry.h"
#include "NativeGameplayTags.h"
#include "Snippets/HktSnippetItem.h"

namespace HktStoryItemDrop
{
	// Story Name
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Event_Item_Drop, "Story.Event.Item.Drop", "Item drop intent event.");

	/**
	 * ================================================================
	 * 아이템 드랍 Flow (Active → Ground)
	 *
	 * 자연어로 읽으면:
	 * "내 소유인 활성 아이템을 월드에 내려놓는다.
	 *  캐릭터의 EquipSlot을 클리어하고, 스탯을 차감한 뒤
	 *  소유자를 해제하고 현재 위치에 드랍한다."
	 *
	 * Self = 유닛, Target = 드랍할 아이템
	 * ================================================================
	 */
	HKT_REGISTER_STORY_BODY()
	{
		using namespace Reg;

		auto B = Story(Event_Item_Drop);

		int32 FailLabel = B.AllocLabel();

		FHktScopedReg r0(B);
		FHktScopedReg r2(B);

		B.SetPrecondition([](const FHktWorldState& WS, const FHktEvent& E) -> bool
			{
				if (!WS.IsValidEntity(E.SourceEntity) || !WS.IsValidEntity(E.TargetEntity))
					return false;
				if (WS.GetProperty(E.TargetEntity, PropertyId::OwnerEntity) != E.SourceEntity)
					return false;
				return true;
			});

		// 소유자 확인
		HktSnippetItem::ValidateOwnership(B, Target, FailLabel);

		// Active 상태였으면 캐릭터의 EquipSlot 클리어 + 스탯 차감
		B.LoadEntityProperty(r0, Target, PropertyId::ItemState)
		 .CmpNeConst(Flag, r0, 2)                                          // Active = 2
		 .JumpIf(Flag, TEXT("drop_exec"));

		// EquipIndex 보존 → 캐릭터의 EquipSlot[N] 클리어
		B.LoadEntityProperty(r2, Target, PropertyId::EquipIndex);
		HktSnippetItem::ClearEquipSlot(B, r2);

		// Active 아이템 스탯 차감
		HktSnippetItem::RemoveItemStats(B, Target, Self);

		B.Label(TEXT("drop_exec"));

		// Ground로 전환 + 소유 해제 + 위치 설정
		HktSnippetItem::DropToGround(B, Target, Self);

		B
			.Halt()

		.Label(FailLabel)
			.Fail()
		.BuildAndRegister();
	}
}
