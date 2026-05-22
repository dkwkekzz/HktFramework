// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "HktInventoryTypes.h"
#include "HktWorldState.h"
#include "HktRuntimeDelegates.h"
#include "HktRuntimeTypes.h"

#include "HktPlayerInventoryComponent.generated.h"

/**
 * UHktPlayerInventoryComponent — Player Inventory 관리 컴포넌트 (I-0041).
 *
 * PlayerController 에 부착 (계정 단위). I-0040 의 Entity Bag (활성 슬롯) 과
 * 혼동 금지 — 둘은 같은 한 아이템이 어디에 있느냐의 두 끝을 나눠 가진다.
 * 서버에서 Inventory 상태를 관리하고, Client RPC 로 소유자 클라이언트에게만
 * Inventory 변경을 전달한다.
 *
 * 아키텍처:
 *   - 서버: ServerInventoryState 에 아이템 저장/제거,
 *           Client_ReceiveInventoryUpdate RPC 전송
 *   - 클라: LocalInventoryState 캐시,
 *           FOnHktInventoryChanged 델리게이트 브로드캐스트
 *   - Entity 활성 슬롯 ↔ Inventory 전환은 ServerRule 이 이 컴포넌트의
 *     서버 API 를 호출하여 수행 (Story_ItemActivate / Story_ItemDeactivate)
 */
UCLASS(ClassGroup=(HktRuntime), meta=(BlueprintSpawnableComponent))
class HKTRUNTIME_API UHktPlayerInventoryComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UHktPlayerInventoryComponent();

	// =================================================================
	// 서버 전용 API — ServerRule에서 호출
	// =================================================================

	/**
	 * 엔티티의 아이템 프로퍼티를 스냅샷하여 Inventory 에 저장.
	 * @param WS              현재 WorldState (아이템 프로퍼티 읽기)
	 * @param ItemEntity      저장할 아이템 엔티티
	 * @param OutInventorySlot 할당된 Inventory 슬롯 (out)
	 * @return 성공시 true
	 */
	bool Server_StoreFromEntity(const FHktWorldState& WS, FHktEntityId ItemEntity, int32& OutInventorySlot);

	/** 이미 만들어진 FHktInventoryItem 을 Inventory 에 저장 (IHktWorldPlayer 위임용) */
	bool Server_StoreInventoryItem(const FHktInventoryItem& InItem, int32& OutInventorySlot);

	/**
	 * Inventory 에서 아이템을 꺼내 엔티티로 복원하기 위한 데이터 반환.
	 * Inventory 에서는 제거됨.
	 * @param InventorySlot Inventory 슬롯
	 * @param OutItem 복원할 아이템 데이터 (out)
	 * @return 성공시 true
	 */
	bool Server_RestoreFromInventory(int32 InventorySlot, FHktInventoryItem& OutItem);

	/** 서버 Inventory 상태 읽기 (ServerRule 에서 검증용) */
	const FHktInventoryState& GetServerInventoryState() const { return ServerInventoryState; }

	/** DB 에서 로드한 데이터로 서버 Inventory 초기화 */
	void Server_RestoreFromRecord(const TArray<FHktInventoryItem>& InInventoryItems, int32 InCapacity = 20);

	/** Inventory 데이터를 DB 저장용으로 내보내기 */
	TArray<FHktInventoryItem> Server_ExportForRecord() const { return ServerInventoryState.Items; }

	/** 전체 동기화 델타를 소유자 클라이언트에 전송 */
	void Server_SendFullSync();

	/** 단일 아이템 변경 델타를 소유자 클라이언트에 전송 */
	void Server_SendDelta(EHktInventoryOp Op, const FHktInventoryItem& Item);

	// =================================================================
	// S2C RPC — 소유자 클라이언트에게만 전달
	// =================================================================

	UFUNCTION(Client, Reliable)
	void Client_ReceiveInventoryUpdate(const FHktRuntimeInventoryUpdate& Update);

	// =================================================================
	// 클라이언트 API
	// =================================================================

	/** 클라이언트 로컬 Inventory 상태 조회 */
	const FHktInventoryState& GetLocalInventoryState() const { return LocalInventoryState; }

	/** Inventory 변경 델리게이트 (UI 구독용) */
	FOnHktInventoryChanged& OnInventoryChanged() { return InventoryChangedDelegate; }

private:
	/** 서버측 Inventory 상태 (서버에서만 수정) */
	FHktInventoryState ServerInventoryState;

	/** 클라이언트측 Inventory 캐시 (S2C RPC 로 업데이트) */
	FHktInventoryState LocalInventoryState;

	/** Inventory 변경 알림 델리게이트 */
	FOnHktInventoryChanged InventoryChangedDelegate;
};
