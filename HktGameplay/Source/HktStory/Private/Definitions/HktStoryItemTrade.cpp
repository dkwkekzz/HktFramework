// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "CoreMinimal.h"
#include "HktStoryBuilder.h"
#include "HktWorldState.h"
#include "HktCoreEvents.h"
#include "HktCoreProperties.h"
#include "HktStoryEventParams.h"
#include "HktStoryRegistry.h"
#include "HktStoryTags.h"
#include "NativeGameplayTags.h"

namespace HktStoryItemTrade
{
	using namespace HktStoryTags;

	// Story Name
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Event_Item_Trade, "Story.Event.Item.Trade", "Item trade intent event.");

	/**
	 * ================================================================
	 * 아이템 거래 Flow (2-phase: 검증 -> 원자적 교환)
	 *
	 * 자연어로 읽으면:
	 * "양측 아이템의 소유권을 검증한 뒤,
	 *  두 아이템의 OwnerEntity/OwnerUid를 원자적으로 교환한다.
	 *  Active 상태 아이템은 거래 불가."
	 *
	 * Self = 제안자 캐릭터, Target = 상대방 캐릭터
	 * Param0 = 제안 아이템 EntityId (Self 소유)
	 * Param1 = 요청 아이템 EntityId (Target 소유)
	 *
	 * 서버 권위적: 클라이언트 양측이 동일한 Trade 이벤트를 fire해야
	 * 서버가 이를 매칭하여 실행. (매칭 로직은 서버룰에서 처리)
	 * ================================================================
	 */
	HKT_REGISTER_STORY_BODY()
	{
		using namespace Reg;

		auto B = Story(Event_Item_Trade);
		FHktScopedReg r0(B);
		FHktScopedReg r1(B);
		FHktScopedReg r2(B);

		B.SetPrecondition([](const FHktWorldState& WS, const FHktEvent& E) -> bool
			{
				if (!WS.IsValidEntity(E.SourceEntity) || !WS.IsValidEntity(E.TargetEntity))
					return false;

				// ItemTradeParams: Param0 = OfferItem, Param1 = RequestItem
				FHktEntityId OfferItem = static_cast<FHktEntityId>(E.Param0);
				FHktEntityId RequestItem = static_cast<FHktEntityId>(E.Param1);

				if (!WS.IsValidEntity(OfferItem) || !WS.IsValidEntity(RequestItem))
					return false;

				// 제안 아이템이 제안자 소유인지
				if (WS.GetProperty(OfferItem, PropertyId::OwnerEntity) != E.SourceEntity)
					return false;

				// 요청 아이템이 상대방 소유인지
				if (WS.GetProperty(RequestItem, PropertyId::OwnerEntity) != E.TargetEntity)
					return false;

				// Active 상태 아이템은 거래 불가
				if (WS.GetProperty(OfferItem, PropertyId::ItemState) == 2)
					return false;
				if (WS.GetProperty(RequestItem, PropertyId::ItemState) == 2)
					return false;

				// 양측 가방 용량 확인 (교환이므로 슬롯은 1:1, 추가 검증 불필요)
				return true;
			})

			// 제안 아이템 / 요청 아이템 로드
			.ReadProperty(r0, ItemTradeParams::OfferItem)                   // r0 = OfferItem EntityId
			.ReadProperty(r1, ItemTradeParams::RequestItem)                 // r1 = RequestItem EntityId

			// 제안 아이템 소유자 검증
			.LoadEntityProperty(r2, r0, PropertyId::OwnerEntity)
			.CmpNe(Flag, r2, Self)
			.JumpIf(Flag, TEXT("fail"))

			// 요청 아이템 소유자 검증
			.LoadEntityProperty(r2, r1, PropertyId::OwnerEntity)
			.CmpNe(Flag, r2, Target)
			.JumpIf(Flag, TEXT("fail"))

			// Active 상태 검증 — 제안 아이템
			.LoadEntityProperty(r2, r0, PropertyId::ItemState)
			.CmpEqConst(Flag, r2, 2)
			.JumpIf(Flag, TEXT("fail"))

			// Active 상태 검증 — 요청 아이템
			.LoadEntityProperty(r2, r1, PropertyId::ItemState)
			.CmpEqConst(Flag, r2, 2)
			.JumpIf(Flag, TEXT("fail"))

			// === 원자적 교환 ===

			// 제안 아이템 -> 상대방으로 이전
			.SaveEntityProperty(r0, PropertyId::OwnerEntity, Target)

			// 요청 아이템 -> 제안자로 이전
			.SaveEntityProperty(r1, PropertyId::OwnerEntity, Self)

			// OwnerUid Clear — 향후 Pickup 시 재설정 또는 ExportPlayerState 개선 필요
			.ClearOwnerUid(r0)
			.ClearOwnerUid(r1)

			.Halt()

		.Label(TEXT("fail"))
			.Fail()
		.BuildAndRegister();
	}
}
