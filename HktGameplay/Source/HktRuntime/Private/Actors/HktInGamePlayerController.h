// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "GameplayTagContainer.h"
#include "InputActionValue.h"
#include "HktCoreDefs.h"
#include "HktWorldState.h"
#include "HktRuntimeDelegates.h"
#include "HktClientRuleInterfaces.h"
#include "HktServerRuleInterfaces.h"
#include "HktRuntimeTypes.h"
#include "IHktPlayerInteractionInterface.h"

#include "HktIngamePlayerController.generated.h"

class UInputMappingContext;
class UInputAction;
class IHktClientRule;
class UHktBagComponent;
struct FHktWorldView;

UCLASS()
class HKTRUNTIME_API AHktIngamePlayerController : public APlayerController
    , public IHktPlayerInteractionInterface
{
    GENERATED_BODY()

public:
    AHktIngamePlayerController();

    // === S2C RPC ===
    UFUNCTION(Client, Reliable)
    void Client_ReceiveInitialState(const FHktRuntimeSimulationState& State, int32 GroupIndex);

    UFUNCTION(Client, Reliable)
    void Client_ReceiveFrameBatch(const FHktRuntimeBatch& Batch);

    UFUNCTION(Client, Unreliable)
    void Client_ReceiveHeartbeat(int64 ServerFrame);

    // === C2S RPC (통일) ===

    /** Subject+Target 상호작용 통합 요청 (이동, 공격, 픽업, 드롭, 스킬 등) */
    UFUNCTION(Server, Reliable, WithValidation)
    void Server_ReceiveRuntimeEvent(const FHktRuntimeEvent& Event);

    // === C2S Bag RPC ===
    UFUNCTION(Server, Reliable, WithValidation)
    void Server_ReceiveBagRequest(const FHktRuntimeBagRequest& Request);

    /** 아이템 드롭 (바닥에 놓기) — RuntimeEvent로 전송 */
    virtual void RequestItemDrop(FHktEntityId ItemEntity) override;

    /** 임의 ActionTag 로 RuntimeEvent 전송 (임시 디버그 UI 용) */
    virtual void RequestActionEvent(FGameplayTag ActionTag) override;

    // === 가방 상호작용 (UI/입력에서 호출) ===

    /** EquipSlot → Bag (장비 슬롯에서 가방으로 보관) */
    virtual void RequestBagStore(int32 EquipIndex) override;

    /** Bag → EquipSlot (가방에서 장비 슬롯으로 장착) */
    virtual void RequestBagRestore(int32 BagSlot, int32 EquipIndex) override;

    /** Bag → Ground (가방에서 바닥으로 버리기) */
    virtual void RequestBagDiscard(int32 BagSlot) override;

    /** 클라이언트 로컬 가방 상태 조회 */
    virtual const FHktBagState* GetBagState() const override;

    /** 가방 컴포넌트 접근 */
    UHktBagComponent* GetBagComponent() const { return CachedBagComponent; }

    // === 델리게이트 ===
    virtual FOnHktTargetChanged& OnTargetChanged() override { return TargetChangedDelegate; }
    virtual FOnHktCommandChanged& OnCommandChanged() override { return CommandChangedDelegate; }
    virtual const FHktVoxelSelection& GetCurrentVoxelTarget() const override { return CurrentVoxelTarget; }

    // === IHktPlayerInteractionInterface ===
    virtual void ExecuteCommand(UObject* CommandData) override;
    virtual bool GetWorldState(const FHktWorldState*& OutState) const override;
    virtual FOnHktWorldViewUpdated& OnWorldViewUpdated() override { return WorldViewUpdatedDelegate; }
    virtual FOnHktWheelInput& OnWheelInput() override { return WheelInputDelegate; }
    virtual FOnHktSubjectChanged& OnSubjectChanged() override { return SubjectChangedDelegate; }
    virtual FOnHktIntentSubmitted& OnIntentSubmitted() override { return IntentSubmittedDelegate; }
    virtual FOnHktSlotBindingChanged& OnSlotBindingChanged() override { return SlotBindingChangedDelegate; }
    virtual FOnHktBagChanged& OnBagChanged() override;

    // === Player UID ===
    virtual int64 GetPlayerUid() const override;

    // === Story Tags (에디터에서 지정) ===

    /** 플레이어 생성 시 서버가 발동할 Story Tag (예: Story.State.Player.InWorld) */
    FGameplayTag GetPlayerSpawnStoryTag() const { return PlayerSpawnStoryTag; }

    /** 슬롯 미선택 상태에서 우클릭 시 서버로 보낼 기본 Story Tag (예: Story.Event.Target.Action) */
    FGameplayTag GetTargetDefaultStoryTag() const { return TargetDefaultStoryTag; }

protected:
    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
    virtual void Tick(float DeltaSeconds) override;
    virtual void SetupInputComponent() override;
    virtual void OnRep_PlayerState() override;

    void OnSubjectAction(const FInputActionValue& Value);
    void OnTargetAction(const FInputActionValue& Value);
    void OnSlotAction(const FInputActionValue& Value, int32 SlotIndex);
    void OnZoom(const FInputActionValue& Value);
    void OnJumpAction(const FInputActionValue& Value);

    /** ShoulderView 방향 이동 (WASD/방향키) — Triggered */
    void OnMoveAction(const FInputActionValue& Value);

    /** ShoulderView 방향 이동 종료 — Completed */
    void OnMoveActionCompleted(const FInputActionValue& Value);

    IHktClientRule* GetClientRule() const;

protected:
    // === Input ===
    UPROPERTY(EditDefaultsOnly, Category = "Hkt|Input")
    TObjectPtr<UInputMappingContext> DefaultMappingContext;

    UPROPERTY(EditDefaultsOnly, Category = "Hkt|Input")
    TObjectPtr<UInputAction> SubjectAction;

    UPROPERTY(EditDefaultsOnly, Category = "Hkt|Input")
    TObjectPtr<UInputAction> TargetAction;

    UPROPERTY(EditDefaultsOnly, Category = "Hkt|Input")
    TObjectPtr<UInputAction> ZoomAction;

    UPROPERTY(EditDefaultsOnly, Category = "Hkt|Input")
    TObjectPtr<UInputAction> JumpAction;

    UPROPERTY(EditDefaultsOnly, Category = "Hkt|Input")
    TArray<TObjectPtr<UInputAction>> SlotInputActions;

    /** ShoulderView 방향 이동 (WASD/방향키, Axis2D) */
    UPROPERTY(EditDefaultsOnly, Category = "Hkt|Input")
    TObjectPtr<UInputAction> MoveAction;

    // === Story Tags ===

    /** 플레이어 생성 시 서버가 발동할 Story Tag. 미설정 시 Story.State.Player.InWorld로 fallback. */
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Hkt|Story", meta = (Categories = "Story"))
    FGameplayTag PlayerSpawnStoryTag;

    /** 우클릭(타겟 선택) 시 슬롯 미선택이면 이 Story Tag로 Rule이 이벤트를 빌드한다. 미설정 시 Story.Event.Target.Action 으로 fallback. */
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Hkt|Story", meta = (Categories = "Story"))
    FGameplayTag TargetDefaultStoryTag;

    /**
     * 로컬 컨트롤러에서만 스폰될 SpriteCrowdHost 클래스 (AHktSpriteCrowdHost 또는 그 BP 서브클래스).
     * HUD 등록 패턴과 동일하게 BP에서 지정. Dedicated Server에선 스폰하지 않는다.
     * HktRuntime이 HktSpriteCore에 직접 의존하지 않도록 SoftClass + MetaClass로 결합.
     */
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Hkt|Presentation",
        meta = (MetaClass = "/Script/HktSpriteCore.HktSpriteCrowdHost", AllowAbstract = "false"))
    TSoftClassPtr<AActor> SpriteCrowdHostClass;

private:
    FOnHktSubjectChanged SubjectChangedDelegate;
    FOnHktTargetChanged TargetChangedDelegate;
    FOnHktCommandChanged CommandChangedDelegate;

    /** Target 이 voxel(VoxelTargetEntityId) 인 동안 유지되는 상세 정보. */
    FHktVoxelSelection CurrentVoxelTarget;
    FOnHktIntentSubmitted IntentSubmittedDelegate;
    FOnHktWheelInput WheelInputDelegate;
    FOnHktWorldViewUpdated WorldViewUpdatedDelegate;
    FOnHktSlotBindingChanged SlotBindingChangedDelegate;

    /** 클라이언트 규칙 (Subsystem 소유, 수명 동일) */
    IHktClientRule* CachedClientRule = nullptr;

    /** 가방 컴포넌트 캐시 */
    UHktBagComponent* CachedBagComponent = nullptr;

    /** 캐싱된 인터페이스 포인터들 */
    IHktIntentBuilder* CachedIntentBuilder = nullptr;
    IHktUnitSelectionPolicy* CachedSelectionPolicy = nullptr;
    IHktProxySimulator* CachedProxySimulator = nullptr;
    IHktCommandContainer* CachedCommandContainer = nullptr;
    IHktWorldPlayer* CachedWorldPlayer = nullptr;

    /** 로컬 컨트롤러에서 스폰한 SpriteCrowdHost 인스턴스. EndPlay에서 파기. */
    UPROPERTY(Transient)
    TObjectPtr<AActor> SpawnedSpriteCrowdHost;

    /** OwnedPlayerUid가 일치하는 첫 번째 엔티티 — 기본 Subject */
    FHktEntityId DefaultSubjectEntityId = InvalidEntityId;
    bool bIsInitialSync = false;

    /** WorldState에서 나의 엔티티를 찾아 DefaultSubjectEntityId로 설정 */
    void ResolveDefaultSubject();

    // === Auto-Pickup (I-0035 P5) ===
    /**
     * 매 틱 호출 — Subject 주변 ground 아이템을 스캔하여 자동 픽업 시도.
     * 서버 precondition (Story_ItemPickup) 이 권위 판정, 클라는 *의도 제출* 만.
     */
    void TickAutoPickup();

    /** Subject → Item 픽업 이벤트(Story.Event.Item.Pickup) 를 서버로 전송. */
    void RequestItemPickup(FHktEntityId ItemEntity);

    /**
     * 자동 픽업 인식 반경 (cm). 서버 precondition 의 거리 임계와 일치해야 한다 —
     * Story_ItemPickup.json 의 GetDistance ≤ 300 검증과 동일.
     * 클라가 더 넓게 잡으면 서버가 거절하여 spam 만 늘고, 더 좁게 잡으면 사용자가
     * "닿았는데 안 주워지는" UX 를 겪는다.
     */
    static constexpr int32 AutoPickupRangeCm = 300;

    /** 같은 item 에 대한 재시도 쿨다운 (초). 서버 거절(가방 만석 등) 후 즉시 spam 방지. */
    static constexpr float AutoPickupRetrySeconds = 1.0f;

    /** item entity id → 마지막 시도 시각 (초). 무효/Ground 아님이면 sweep 에서 제거. */
    TMap<FHktEntityId, double> AutoPickupAttemptedAt;
    /** 시도 맵 청소 타이머. 5초마다 1회 — 사라진 entity 누적 방지. */
    double LastAutoPickupSweepTime = 0.0;

    /** 방향 이동 입력 이벤트 전송 + 쓰로틀 */
    void SubmitMoveEvent(const FVector& Direction);

    /** 방향 이동 쓰로틀 — 마지막 전송 방향 / 시각 */
    FVector LastMoveDirection = FVector::ZeroVector;
    double LastMoveEventTime = 0.0;
    bool bIsDirectionalMoving = false;

    /** 캐릭터 엔티티의 EquipSlot0~8 프로퍼티에서 아이템 스킬을 읽어 CommandSlot에 바인딩 */
    void SyncSlotBindingsFromWorldState(const FHktWorldView& View);

#if ENABLE_HKT_INSIGHTS
    /** Insight 통계 카운터 */
    int32 InsightSentIntentCount = 0;
    int32 InsightReceivedBatchCount = 0;
    int32 InsightReceivedInitialStateCount = 0;
    int32 InsightReceivedHeartbeatCount = 0;
#endif
};
