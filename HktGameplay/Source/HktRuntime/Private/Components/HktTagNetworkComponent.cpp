
#include "HktTagNetworkComponent.h"
#include "Net/UnrealNetwork.h"
#include "HktTagSubsystem.h"

// ============================================================================
// UHktTagNetworkComponent
// ============================================================================

UHktTagNetworkComponent::UHktTagNetworkComponent()
{
    SetIsReplicatedByDefault(true); // 컴포넌트 리플리케이션 켜기
    bWantsInitializeComponent = true;
    PrimaryComponentTick.bCanEverTick = true; // 틱 활성화 (큐 처리용)
}

void UHktTagNetworkComponent::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(UHktTagNetworkComponent, ReplicatedTags);
}

void UHktTagNetworkComponent::BeginPlay()
{
    Super::BeginPlay();
    
    // [제거됨] RegisterNetworkComponent 호출 불필요
    // Component가 틱에서 직접 Subsystem을 가져와 사용함
}

void UHktTagNetworkComponent::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    // [제거됨] UnregisterNetworkComponent 호출 불필요
    Super::EndPlay(EndPlayReason);
}

void UHktTagNetworkComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

    // [최적화] 서버(권한자)가 아니면 로직을 수행할 필요가 없음
    if (GetOwnerRole() != ROLE_Authority)
    {
        return;
    }

    // 매니저로부터 대기 중인 태그 가져오기
    UHktTagSubsystem* Manager = UHktTagSubsystem::Get(this);
    if (!Manager) return;

    FString PendingTag;
    // 큐에 있는 모든 태그를 이번 프레임에 처리 (혹은 개수 제한을 둘 수도 있음)
    while (Manager->DequeuePendingTag(PendingTag))
    {
        // 큐에 있다는 건 이미 로컬 ID가 발급되었다는 뜻이므로,
        // bAllowCreate=false로 ID만 조회하여 동기화
        uint32 Id = Manager->RequestTagId(PendingTag, false);
        if (Id > 0)
        {
            Server_SyncTag(PendingTag, Id);
        }
    }
}

void UHktTagNetworkComponent::Server_SyncTag(const FString& TagString, uint32 TagId)
{
    // 서버에서만 실행됨
    if (GetOwnerRole() == ROLE_Authority)
    {
        FHktTagEntry& NewEntry = ReplicatedTags.Items.AddDefaulted_GetRef();
        NewEntry.TagString = TagString;
        NewEntry.TagId = TagId;
        
        // 변경 사항 마킹 -> 클라이언트로 전송됨
        ReplicatedTags.MarkItemDirty(NewEntry);
    }
}
