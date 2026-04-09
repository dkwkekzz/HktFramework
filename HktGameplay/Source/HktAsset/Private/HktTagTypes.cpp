#include "HktTagTypes.h"
#include "Net/UnrealNetwork.h"
#include "HktTagSubsystem.h"

// ============================================================================
// FHktTagEntry Logic
// ============================================================================

void FHktTagEntry::PostReplicatedAdd(const FHktTagContainer& InArraySerializer)
{
    // 클라이언트가 서버로부터 새 태그를 받으면 매니저에 알림
    if (InArraySerializer.OwnerManager)
    {
        InArraySerializer.OwnerManager->OnTagReceivedFromNetwork(*this);
    }
}
void FHktTagEntry::PostReplicatedChange(const FHktTagContainer& InArraySerializer) { }
void FHktTagEntry::PreReplicatedRemove(const FHktTagContainer& InArraySerializer) { }
