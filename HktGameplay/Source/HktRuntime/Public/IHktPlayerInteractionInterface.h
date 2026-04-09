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

	/** 대상(Target) 엔터티 변경 시 브로드캐스트. InvalidEntityId면 선택 해제. */
	virtual FOnHktTargetChanged& OnTargetChanged() = 0;

	/** Intent 제출 시 브로드캐스트 (클라이언트 즉시 VFX 등에 사용). */
	virtual FOnHktIntentSubmitted& OnIntentSubmitted() = 0;

	/** 커맨드(슬롯) 선택 변경 시 브로드캐스트. */
	virtual FOnHktCommandChanged& OnCommandChanged() { static FOnHktCommandChanged Dummy; return Dummy; }

	/** 아이템 장착/해제로 액션 슬롯 바인딩이 변경될 때 브로드캐스트. */
	virtual FOnHktSlotBindingChanged& OnSlotBindingChanged() { static FOnHktSlotBindingChanged Dummy; return Dummy; }

	/** 가방 상태 변경 시 브로드캐스트 (S2C RPC 수신 후). */
	virtual FOnHktBagChanged& OnBagChanged() { static FOnHktBagChanged Dummy; return Dummy; }

	/** 아이템 드롭 요청 (바닥에 놓기). */
	virtual void RequestItemDrop(FHktEntityId ItemEntity) {}

	/** 장비 슬롯 → 가방으로 보관 요청. */
	virtual void RequestBagStore(int32 EquipIndex) {}

	/** 가방 → 장비 슬롯으로 장착 요청. */
	virtual void RequestBagRestore(int32 BagSlot, int32 EquipIndex) {}

	/** 가방 → 바닥으로 버리기 요청. */
	virtual void RequestBagDiscard(int32 BagSlot) {}

	/** 클라이언트 로컬 가방 상태 조회. 미지원 시 nullptr 반환. */
	virtual const FHktBagState* GetBagState() const { return nullptr; }

	/** 이 플레이어의 고유 UID. 소유권 검증 등에 사용. 미지원 시 0 반환. */
	virtual int64 GetPlayerUid() const { return 0; }
};
