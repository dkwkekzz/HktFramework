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

	// 월드 최초 생성 Story (InitGame에서 등록, 첫 Tick에 소비)
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
