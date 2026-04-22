// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "UObject/Interface.h"
#include "HktCoreDefs.h"
#include "HktCoreEvents.h"
#include "HktCoreSimulator.h"
#include "HktWorldState.h"
#include "HktBagTypes.h"
#include "Containers/ArrayView.h"
#include "HktServerRuleInterfaces.generated.h"

// Forward declarations
class AActor;
class IHktRelevancyGraph;

/**
 * FHktPlayerRecord - 플레이어의 영구 저장 데이터
 */
USTRUCT(BlueprintType)
struct HKTRULE_API FHktPlayerRecord
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Player")
	int64 PlayerUid = 0;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Player")
	FDateTime LastLoginTime;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Player")
	FDateTime CreatedTime;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Player")
	FVector LastPosition;

	// TODO: ...
	TArray<FHktEvent> ActiveEvents;
	TArray<FHktEntityState> EntityStates;

	/** 가방 아이템 (DB 저장/복원) */
	TArray<FHktBagItem> BagItems;

	FHktPlayerRecord()
	{
		CreatedTime = FDateTime::UtcNow();
		LastLoginTime = CreatedTime;
	}

	bool IsValid() const { return PlayerUid != 0; }
	bool HasEntities() const { return EntityStates.Num() > 0; }
};

//=============================================================================
// IHktWorldPlayer
//=============================================================================
UINTERFACE(MinimalAPI, BlueprintType)
class UHktWorldPlayer : public UInterface { GENERATED_BODY() };

class HKTRULE_API IHktWorldPlayer
{
	GENERATED_BODY()
public:
	virtual int64 GetPlayerUid() const = 0;
	virtual AActor* GetOwnerActor() const = 0;
	virtual bool IsInitialized() const = 0;
	virtual void InvalidatePlayerUidCache() = 0;

	// === Story Tags (owner Actor에서 읽음) ===

	/** 플레이어 생성 시 발동할 Story Tag. 빈 Tag면 호출자가 기본값을 사용한다. */
	virtual FGameplayTag GetSpawnStoryTag() const { return FGameplayTag(); }

	/** 기본 타겟 액션(우클릭 슬롯 미선택) Story Tag. 빈 Tag면 호출자가 기본값을 사용한다. */
	virtual FGameplayTag GetTargetDefaultStoryTag() const { return FGameplayTag(); }

	// === Bag ===
	virtual const FHktBagState& GetBagState() const { static FHktBagState Empty; return Empty; }
	virtual bool StoreToBag(const FHktBagItem& InItem, int32& OutBagSlot) { return false; }
	virtual bool TakeFromBag(int32 BagSlot, FHktBagItem& OutItem) { return false; }
	virtual void RestoreBagFromRecord(const TArray<FHktBagItem>& InBagItems, int32 InCapacity = 20) {}
	virtual TArray<FHktBagItem> ExportBagForRecord() const { return {}; }
	virtual void SendBagFullSync() {}
};

// ============================================================================
// IHktAuthoritySimulator — 서버 전용 시뮬레이터 (Determinism + ExportPlayerState 등)
// ============================================================================

UINTERFACE(MinimalAPI, BlueprintType)
class UHktAuthoritySimulator : public UInterface { GENERATED_BODY() };

class HKTRULE_API IHktAuthoritySimulator
{
	GENERATED_BODY()
public:
	/** 서버 전용: 플레이어 상태 내보내기 (저장/전송용) */
	virtual void AdvanceFrame(const FHktSimulationEvent& InEvent) = 0;
	virtual const FHktWorldState& GetWorldState() const = 0;
	virtual FHktPlayerState ExportPlayerState(int64 OwnerHash) const = 0;
};

//=============================================================================
// IHktRelevancyGroup — 서버 그룹 = 권위 시뮬레이터 + 플레이어 목록 (IHktAuthoritySimulator 상속)
//=============================================================================
UINTERFACE(MinimalAPI, BlueprintType)
class UHktRelevancyGroup : public UInterface { GENERATED_BODY() };

class HKTRULE_API IHktRelevancyGroup
{
	GENERATED_BODY()
public:
	virtual const TArray<int64>& GetPlayerUids() const = 0;
	virtual const TArray<IHktWorldPlayer*>& GetCachedWorldPlayers() const = 0;
	virtual const IHktAuthoritySimulator& GetSimulator() const = 0;
	virtual IHktAuthoritySimulator& GetSimulator() = 0;
};

//=============================================================================
// IHktRelevancyGraph
//=============================================================================
UINTERFACE(MinimalAPI, BlueprintType)
class UHktRelevancyGraph : public UInterface { GENERATED_BODY() };

class HKTRULE_API IHktRelevancyGraph
{
	GENERATED_BODY()
public:
	virtual void RegisterPlayer(IHktWorldPlayer* Player, int32 GroupIndex) = 0;
	virtual void UnregisterPlayer(int64 PlayerUid) = 0;
	virtual void UpdateRelevancy() = 0;
	virtual IHktWorldPlayer* GetWorldPlayer(int64 PlayerUid) const = 0;
	virtual int32 GetWorldPlayerCount() const = 0;
	virtual int32 NumRelevancyGroup() const = 0;
	virtual IHktRelevancyGroup& GetRelevancyGroup(int32 Index) = 0;
	virtual const IHktRelevancyGroup& GetRelevancyGroup(int32 Index) const = 0;
	virtual int32 GetRelevancyGroupIndex(int64 PlayerUid) const = 0;
	virtual int32 CalculateRelevancyGroupIndex(FVector PlayerPos) const = 0;

	/** InitGame에서 첫 AdvanceFrame 이전에 호출 필수 — 시뮬레이션 지형 인지 활성화 */
	virtual void SetTerrainConfig(const FHktTerrainGeneratorConfig& Config) {}
};

//=============================================================================
// IHktWorldDatabase
//=============================================================================
UINTERFACE(MinimalAPI, BlueprintType)
class UHktWorldDatabase : public UInterface { GENERATED_BODY() };

class HKTRULE_API IHktWorldDatabase
{
	GENERATED_BODY()
public:
	/**
	 * @param InSpawnStoryTag 신규/재진입 플레이어의 월드 진입 이벤트로 주입할 Story Tag.
	 *                       빈 Tag면 구현체의 기본값(Story.State.Player.InWorld)을 사용한다.
	 */
	virtual void LoadPlayerRecordAsync(int64 InPlayerUid, const FGameplayTag& InSpawnStoryTag, TFunction<void(const FHktPlayerRecord&)> InCallback) = 0;
	virtual void SavePlayerRecordAsync(int64 InPlayerUid, FHktPlayerState&& InState, TArray<FHktBagItem>&& InBagItems = {}) = 0;
	virtual const FHktPlayerRecord* GetCachedPlayerRecord(int64 InPlayerUid) const = 0;
};

//=============================================================================
// IHktFrameManager
//=============================================================================
UINTERFACE(MinimalAPI, BlueprintType)
class UHktFrameManager : public UInterface { GENERATED_BODY() };

class HKTRULE_API IHktFrameManager
{
	GENERATED_BODY()
public:
	virtual bool IsInitialized() const = 0;
	virtual int64 GetFrameNumber() const = 0;
	virtual void AdvanceFrame() = 0;
};

//=============================================================================
// IHktPrincipal / IHktAuthenticator
//=============================================================================
UINTERFACE(MinimalAPI, BlueprintType)
class UHktPrincipal : public UInterface { GENERATED_BODY() };

class HKTRULE_API IHktPrincipal
{
	GENERATED_BODY()
public:
	virtual const FString& GetLoginID() const = 0;
	virtual const FString& GetLoginPW() const = 0;
	virtual const FString& GetAuthenticationToken() const = 0;
	virtual bool IsAuthenticated() const = 0;
};

UINTERFACE(MinimalAPI, BlueprintType)
class UHktAuthenticator : public UInterface { GENERATED_BODY() };

class HKTRULE_API IHktAuthenticator
{
	GENERATED_BODY()
public:
	virtual void Authenticate(const FString& ID, const FString& PW, TFunction<void(bool bSuccess, const FString& Token)> ResultCallback) = 0;
	virtual void Deauthenticate(const FString& Token) = 0;
};

/** 그룹별 이벤트 전송 정보 (신입 제외 기존 플레이어에게 배치 전달) */
struct FGroupEventSend
{
	FHktSimulationEvent Batch;
	TArray<IHktWorldPlayer*> Entered;
	const TArray<IHktWorldPlayer*>* Existing = nullptr;
	const FHktWorldState* NewState = nullptr;
};

struct FHktEventGameModeTickResult
{
	TArray<FGroupEventSend> EventSends;
};

// FHktSlotRequest — 제거됨: FHktRuntimeEvent로 통합
// FHktItemRequest — 제거됨: FHktRuntimeEvent로 통합
// FHktMoveRequest — 제거됨: FHktRuntimeEvent로 통합

// ============================================================================
// EHktBagAction — 가방 요청 액션 타입
// ============================================================================

enum class EHktBagAction : uint8
{
	StoreFromSlot = 0,    // EquipSlot → Bag (공개 엔티티를 가방으로)
	RestoreToSlot = 1,    // Bag → EquipSlot (가방에서 공개 엔티티로)
	Discard       = 2,    // Bag → Ground (가방에서 바닥으로)
};

// ============================================================================
// FHktBagRequest — 가방 상호작용 요청 (C2S)
// ============================================================================

struct HKTRULE_API FHktBagRequest
{
	EHktBagAction Action = EHktBagAction::StoreFromSlot;
	FHktEntityId SourceEntity = InvalidEntityId;   // 캐릭터
	int32 BagSlot = -1;                            // 가방 슬롯 (RestoreToSlot/Discard)
	int32 EquipIndex = -1;                         // EquipSlot 인덱스 (StoreFromSlot: 출발, RestoreToSlot: 도착)

	FString ToString() const
	{
		return FString::Printf(TEXT("Action=%d Src=%d BagSlot=%d EquipIndex=%d"),
			static_cast<uint8>(Action), SourceEntity, BagSlot, EquipIndex);
	}

	friend FArchive& operator<<(FArchive& Ar, FHktBagRequest& R)
	{
		uint8 ActionByte = static_cast<uint8>(R.Action);
		Ar << ActionByte << R.SourceEntity << R.BagSlot << R.EquipIndex;
		if (Ar.IsLoading()) R.Action = static_cast<EHktBagAction>(ActionByte);
		return Ar;
	}
};

//=============================================================================
// IHktServerRule
//=============================================================================
class HKTRULE_API IHktServerRule
{
public:
	virtual ~IHktServerRule() = default;

	/** 컨텍스트 바인딩 — 룰 내부에서 인터페이스 캐싱 (item 2) */
	virtual void BindContext(
		IHktFrameManager* InFrame,
		IHktRelevancyGraph* InGraph,
		IHktWorldDatabase* InDB) {}

	virtual void OnReceived_Authentication(IHktAuthenticator& Authenticator, const IHktPrincipal& InPrincipal, TFunction<void(bool bSuccess, const FString& Token)> InResultCallback) {}
	virtual void OnReceived_Deauthentication(IHktAuthenticator& Authenticator, const IHktPrincipal& InPrincipal) {}

	/** 통합 런타임 이벤트 수신 — 클라이언트가 EventTag를 포함하여 전송 (아이템 Pickup/Drop 포함) */
	virtual void OnReceived_RuntimeEvent(const FHktEvent& InEvent, const IHktWorldPlayer& InPlayer) {}

	/** 가방 요청 수신 — 서버가 Bag ↔ Entity 전환 처리 (Bag 상태 변경이 필요하므로 non-const) */
	virtual void OnReceived_BagRequest(const FHktBagRequest& InRequest, IHktWorldPlayer& InPlayer) {}

	/** 액터 이벤트 — 내부 캐싱된 DB 사용 (item 1, 2) */
	virtual void OnEvent_GameModePostLogin(IHktWorldPlayer& InPlayer) {}
	virtual void OnEvent_GameModeLogout(const IHktWorldPlayer& InPlayer) {}

	/** 월드 최초 생성 Story 트리거 — InitGame에서 호출, 첫 Tick에 이벤트 발동 */
	virtual void OnEvent_GameModeInitWorld(const FGameplayTag& InStoryTag, const FVector& InLocation) {}

	/** 틱 — 내부 캐싱된 컨텍스트 사용, 결과 구조체 반환 (item 1, 2, 6) */
	virtual FHktEventGameModeTickResult OnEvent_GameModeTick(float InDeltaTime) { return {}; }
};

namespace HktRule
{
	HKTRULE_API IHktServerRule* GetServerRule(UWorld* World);
}
