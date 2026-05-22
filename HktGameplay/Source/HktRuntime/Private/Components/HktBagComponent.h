// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "HktBagTypes.h"
#include "HktWorldState.h"
#include "HktRuntimeDelegates.h"
#include "HktRuntimeTypes.h"

#include "HktBagComponent.generated.h"

/**
 * UHktBagComponent  (= UHktPlayerInventoryComponent) — Player Inventory 관리 컴포넌트
 *
 * I-0041 (Docs/intents/I-0041.md): 본 컴포넌트는 *Player Inventory*
 * (계정 단위 보관 공간) 이다. I-0040 의 Entity Bag (활성 슬롯) 과 혼동 금지 —
 * 둘은 같은 한 아이템이 어디에 있느냐의 두 끝을 나눠 가진다.
 * 실제 클래스/타입 rename 은 별도 PR.
 *
 * PlayerController 에 부착 (계정 단위). 서버에서 Inventory 상태를 관리하고,
 * Client RPC 로 소유자 클라이언트에게만 Inventory 변경을 전달한다.
 *
 * 아키텍처:
 *   - 서버: ServerBagState (=ServerInventoryState) 에 아이템 저장/제거,
 *           Client_ReceiveBagUpdate RPC 전송
 *   - 클라: LocalBagState  (=LocalInventoryState)  캐시,
 *           FOnHktBagChanged 델리게이트 브로드캐스트
 *   - Entity 활성 슬롯 ↔ Inventory 전환은 ServerRule 이 이 컴포넌트의
 *     서버 API 를 호출하여 수행 (Story_ItemActivate / Story_ItemDeactivate)
 */
UCLASS(ClassGroup=(HktRuntime), meta=(BlueprintSpawnableComponent))
class HKTRUNTIME_API UHktBagComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UHktBagComponent();

	// =================================================================
	// 서버 전용 API — ServerRule에서 호출
	// =================================================================

	/**
	 * 엔티티의 아이템 프로퍼티를 스냅샷하여 가방에 저장.
	 * @param WS        현재 WorldState (아이템 프로퍼티 읽기)
	 * @param ItemEntity 저장할 아이템 엔티티
	 * @param OutBagSlot 할당된 가방 슬롯 (out)
	 * @return 성공시 true
	 */
	bool Server_StoreFromEntity(const FHktWorldState& WS, FHktEntityId ItemEntity, int32& OutBagSlot);

	/** 이미 만들어진 FHktBagItem을 가방에 저장 (IHktWorldPlayer 위임용) */
	bool Server_StoreBagItem(const FHktBagItem& InItem, int32& OutBagSlot);

	/**
	 * 가방에서 아이템을 꺼내 엔티티로 복원하기 위한 데이터 반환.
	 * 가방에서는 제거됨.
	 * @param BagSlot 가방 슬롯
	 * @param OutItem 복원할 아이템 데이터 (out)
	 * @return 성공시 true
	 */
	bool Server_RestoreFromBag(int32 BagSlot, FHktBagItem& OutItem);

	/** 서버 가방 상태 읽기 (ServerRule에서 검증용) */
	const FHktBagState& GetServerBagState() const { return ServerBagState; }

	/** DB에서 로드한 데이터로 서버 가방 초기화 */
	void Server_RestoreFromRecord(const TArray<FHktBagItem>& InBagItems, int32 InCapacity = 20);

	/** 가방 데이터를 DB 저장용으로 내보내기 */
	TArray<FHktBagItem> Server_ExportForRecord() const { return ServerBagState.Items; }

	/** 전체 동기화 델타를 소유자 클라이언트에 전송 */
	void Server_SendFullSync();

	/** 단일 아이템 변경 델타를 소유자 클라이언트에 전송 */
	void Server_SendDelta(EHktBagOp Op, const FHktBagItem& Item);

	// =================================================================
	// S2C RPC — 소유자 클라이언트에게만 전달
	// =================================================================

	UFUNCTION(Client, Reliable)
	void Client_ReceiveBagUpdate(const FHktRuntimeBagUpdate& Update);

	// =================================================================
	// 클라이언트 API
	// =================================================================

	/** 클라이언트 로컬 가방 상태 조회 */
	const FHktBagState& GetLocalBagState() const { return LocalBagState; }

	/** 가방 변경 델리게이트 (UI 구독용) */
	FOnHktBagChanged& OnBagChanged() { return BagChangedDelegate; }

private:
	/** 서버측 가방 상태 (서버에서만 수정) */
	FHktBagState ServerBagState;

	/** 클라이언트측 가방 캐시 (S2C RPC로 업데이트) */
	FHktBagState LocalBagState;

	/** 가방 변경 알림 델리게이트 */
	FOnHktBagChanged BagChangedDelegate;
};
