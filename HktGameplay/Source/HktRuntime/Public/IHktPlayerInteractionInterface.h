// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "UObject/Interface.h"
#include "GameplayTagContainer.h"
#include "HktCoreDefs.h"
#include "HktWorldState.h"
#include "HktRuntimeTypes.h"
#include "HktRuntimeDelegates.h"
#include "HktBagTypes.h"
#include "HktVoxelSelection.h"
#include "IHktPlayerInteractionInterface.generated.h"

/**
 * UI가 PlayerController에게 이벤트를 전달하고, 시뮬레이션 상태를 조회하기 위한 통신 인터페이스.
 * PlayerController에서 구현하여 로그인/시뮬레이션 등으로 라우팅합니다.
 * (GetWorldView 제거 — Diff/GetWorldState 기반으로 전환)
 */
UINTERFACE(MinimalAPI, BlueprintType)
class UHktPlayerInteractionInterface : public UInterface
{
	GENERATED_BODY()
};

class HKTRUNTIME_API IHktPlayerInteractionInterface
{
	GENERATED_BODY()

public:
	/** 일반적인 게임플레이 관련 명령 전달 (UObject를 통한 유연한 데이터 전달) */
	virtual void ExecuteCommand(UObject* CommandData) = 0;

	/** 현재 시뮬레이션 상태 조회. 시뮬레이터 미초기화 시 false 반환. */
	virtual bool GetWorldState(const FHktWorldState*& OutState) const = 0;

	/** 시뮬레이션 상태가 갱신되었을 때 (FrameBatch/InitialState 수신 후) 브로드캐스트됩니다. */
	virtual FOnHktWorldViewUpdated& OnWorldViewUpdated() = 0;

	/** 마우스 휠 등 줌 입력 (RTS 카메라 등에서 구독). 미지원 시 빈 델리게이트 반환. */
	virtual FOnHktWheelInput& OnWheelInput() = 0;

	/** 선택 주체(Subject) 엔터티 변경 시 브로드캐스트. InvalidEntityId면 선택 해제. */
	virtual FOnHktSubjectChanged& OnSubjectChanged() = 0;

	/**
	 * I-0041 다중 Entity 채널 — 한 Player 가 여러 Entity (메인 + 동행 NPC + 창고 등)
	 * 를 소유할 때 어느 Entity 를 Subject 로 볼지 선택. 소유권 (OwnerUid) 검증 후
	 * IntentBuilder 갱신 + OnSubjectChanged 브로드캐스트. 미소유 Entity 는 거절.
	 *
	 * Inventory 패널은 Entity 와 무관 (계정 단위) 하므로 영향 없음 — Equipment 패널만
	 * 새 Subject 의 활성 슬롯으로 갱신된다.
	 */
	virtual void RequestSetSubject(FHktEntityId InEntity) {}

	/**
	 * 대상(Target) 변경 시 브로드캐스트.
	 *  - 일반 entity : 정상 EntityId(>=0)
	 *  - Voxel       : VoxelTargetEntityId — GetCurrentVoxelTarget() 으로 상세 조회
	 *  - 해제        : InvalidEntityId
	 */
	virtual FOnHktTargetChanged& OnTargetChanged() = 0;

	/**
	 * 현재 voxel target 의 상세 정보. EntityId 가 VoxelTargetEntityId 일 때만 의미 있다.
	 * 기본 구현은 빈 voxel — voxel 인지가 없는 PC(LoginPC 등)는 override 불필요.
	 */
	virtual const FHktVoxelSelection& GetCurrentVoxelTarget() const
	{
		static const FHktVoxelSelection Empty;
		return Empty;
	}

	/** Intent 제출 시 브로드캐스트 (클라이언트 즉시 VFX 등에 사용). */
	virtual FOnHktIntentSubmitted& OnIntentSubmitted() = 0;

	/** 커맨드(슬롯) 선택 변경 시 브로드캐스트. */
	virtual FOnHktCommandChanged& OnCommandChanged() { static FOnHktCommandChanged Dummy; return Dummy; }

	/** 아이템 장착/해제로 액션 슬롯 바인딩이 변경될 때 브로드캐스트. */
	virtual FOnHktSlotBindingChanged& OnSlotBindingChanged() { static FOnHktSlotBindingChanged Dummy; return Dummy; }

	// ---- I-0041 Player Inventory API ----
	// 아래 "Bag" 명칭의 API 들은 Player Inventory (계정 단위 보관 공간) 를 가리킨다.
	// I-0040 의 Entity Bag (활성 슬롯) 과 혼동 금지. 실제 rename (RequestInventoryStore 등)
	// 은 별도 PR. 참고: Docs/intents/I-0041.md

	/** Player Inventory 변경 시 브로드캐스트 (S2C RPC 수신 후). (= OnInventoryChanged) */
	virtual FOnHktBagChanged& OnBagChanged() { static FOnHktBagChanged Dummy; return Dummy; }

	/** 아이템 드롭 요청 (바닥에 놓기). */
	virtual void RequestItemDrop(FHktEntityId ItemEntity) {}

	/**
	 * 임의의 ActionTag(EventTag) 로 RuntimeEvent 전송 요청 (임시 디버그 UI 용).
	 * Subject 는 현재 선택된 엔티티, Target 은 현재 타겟(있으면) 으로 설정한다.
	 */
	virtual void RequestActionEvent(FGameplayTag ActionTag) {}

	/** Entity 활성 슬롯 → Player Inventory 로 보관 요청. (= RequestInventoryStore) */
	virtual void RequestBagStore(int32 EquipIndex) {}

	/** Player Inventory → Entity 활성 슬롯으로 장착 요청. (= RequestInventoryRestore)
	 *  BagSlot 은 Inventory 슬롯 인덱스, EquipIndex 는 Entity 활성 슬롯 인덱스. */
	virtual void RequestBagRestore(int32 BagSlot, int32 EquipIndex) {}

	/** Player Inventory → 바닥(Ground) 으로 버리기 요청. (= RequestInventoryDiscard) */
	virtual void RequestBagDiscard(int32 BagSlot) {}

	/** 클라이언트 로컬 Player Inventory 상태 조회. 미지원 시 nullptr 반환. (= GetInventoryState) */
	virtual const FHktBagState* GetBagState() const { return nullptr; }

	/** 이 플레이어의 고유 UID. 소유권 검증 등에 사용. 미지원 시 0 반환. */
	virtual int64 GetPlayerUid() const { return 0; }
};
