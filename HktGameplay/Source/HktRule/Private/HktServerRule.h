#pragma once

#include "CoreMinimal.h"
#include "HktServerRuleInterfaces.h"
#include "HktBagTypes.h"

struct FHktPlayerRecord;

//=============================================================================
// FHktDefaultServerRule
//=============================================================================
class HKTRULE_API FHktDefaultServerRule : public IHktServerRule
{
public:
    FHktDefaultServerRule();
    virtual ~FHktDefaultServerRule();

    // 컨텍스트 바인딩 (item 2)
    virtual void BindContext(
        IHktFrameManager* InFrame,
        IHktRelevancyGraph* InGraph,
        IHktWorldDatabase* InDB) override;

    virtual void OnReceived_Authentication(IHktAuthenticator& Authenticator, const IHktPrincipal& InPrincipal, TFunction<void(bool bSuccess, const FString& Token)> InResultCallback) override;
    virtual void OnReceived_Deauthentication(IHktAuthenticator& Authenticator, const IHktPrincipal& InPrincipal) override {}
    virtual void OnReceived_RuntimeEvent(const FHktEvent& InEvent, const IHktWorldPlayer& InPlayer) override;
    virtual void OnReceived_BagRequest(const FHktBagRequest& InRequest, IHktWorldPlayer& InPlayer) override;

    // 액터 이벤트 (item 1)
    virtual void OnEvent_GameModePostLogin(IHktWorldPlayer& InPlayer) override;
    virtual void OnEvent_GameModeLogout(const IHktWorldPlayer& InPlayer) override;
    virtual void OnEvent_GameModeInitWorld(const FGameplayTag& InStoryTag, const FVector& InLocation) override;
    virtual FHktEventGameModeTickResult OnEvent_GameModeTick(float InDeltaTime) override;

private:
    // 바인딩된 컨텍스트 (item 2)
    IHktFrameManager*             CachedFrame   = nullptr;
    IHktRelevancyGraph*           CachedGraph   = nullptr;
    IHktWorldDatabase*            CachedDB      = nullptr;

    struct FPendingLoginResult
    {
        TWeakInterfacePtr<IHktWorldPlayer> WeakPlayer;
        FHktPlayerRecord Record;
    };

    TQueue<FPendingLoginResult, EQueueMode::Mpsc> PendingLoginResults;
    TQueue<int64, EQueueMode::Mpsc>               PendingLogoutRequests;
	TArray<TArray<FHktEvent>>                     PendingGroupIntents;

	int32 ServerEventSequence = 0;

	/** PendingWorldInit 의 NumGroups==0 경고 1회 게이트 — ServerRule 인스턴스 수명 동안 유지 (PIE 재시작 시 reset) */
	bool bLoggedPendingWorldInitZeroGroup = false;

	// [LEGACY · Phase 4 호환] 월드 최초 생성 Story (InitGame에서 등록, 첫 Tick에 소비).
	//
	// TerrainSpawner.design.md §7 의 dispatch 루프 (TerrainSystem 의 chunk-load → spawner
	// enumerate) 가 본 패턴을 흡수하도록 설계됨. Phase 3 의 BakeRegion 자동 추출
	// (WorldInitLocation 위치에 spawner 슬롯을 베이크에서 미리 생성) 가 완료되면
	// 본 큐와 OnEvent_GameModeInitWorld 는 제거 예정 — 그 전까지 부트스트랩 호환성으로 유지.
	struct FPendingWorldInit
	{
		FGameplayTag StoryTag;
		FVector Location = FVector::ZeroVector;
	};
	TOptional<FPendingWorldInit> PendingWorldInit;

	// RestoreToSlot/Discard — TakeFromBag 후 엔티티 생성이 필요한 큐
	struct FPendingBagEntitySpawn
	{
		FHktBagItem Item;
		int64 PlayerUid = 0;
		int32 GroupIndex = INDEX_NONE;
		FHktEntityId CharacterEntity = InvalidEntityId;
		int32 EquipIndex = -1;       // RestoreToSlot: 대상 슬롯, Discard: -1
		bool bDiscard = false;       // true면 Ground 엔티티 생성
	};
	TArray<FPendingBagEntitySpawn> PendingBagEntitySpawns;

	// Bag RestoreToSlot/Discard: 그룹별 엔티티 생성 큐 (틱 내에서 소비)
	TArray<TArray<FHktEntityState>> PendingGroupEntityStates;
};
