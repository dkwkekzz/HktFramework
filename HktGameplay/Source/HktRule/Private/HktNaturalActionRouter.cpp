// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktNaturalActionRouter.h"

#include "HktCoreEvents.h"
#include "HktCoreTags.h"
#include "HktRuleLog.h"

namespace HktNaturalActionRouter
{
    namespace
    {
        // Action → Event 1:1 매핑 테이블 — lazy init (init-on-first-call).
        // NativeGameplayTag 는 모듈 StartupModule 이후 유효해진다. 본 헤더는 HktRule 모듈
        // 전역에서 처음 RouteAction 호출 시 1회 채워진다.
        struct FActionEventEntry
        {
            FGameplayTag Action;
            FGameplayTag Event;
        };

        const TArray<FActionEventEntry>& GetMappingTable()
        {
            static const TArray<FActionEventEntry> Table = {
                { HktNaturalActionTags::Fell,    HktNaturalEventTags::TreeFelled     },
                { HktNaturalActionTags::Harvest, HktNaturalEventTags::BerryHarvested },
                { HktNaturalActionTags::Pluck,   HktNaturalEventTags::AquaticPlucked },
                { HktNaturalActionTags::Eat,     HktNaturalEventTags::MushroomEaten  },
                { HktNaturalActionTags::Ignite,  HktNaturalEventTags::FireIgnited    },
                { HktNaturalActionTags::Mine,    HktNaturalEventTags::OreMined       },
                { HktNaturalActionTags::Cross,   HktNaturalEventTags::FordCrossed    },
                { HktNaturalActionTags::Drink,   HktNaturalEventTags::SpringDrank    },
            };
            return Table;
        }

        FGameplayTag FindMapping(const FGameplayTag& ActionTag)
        {
            if (!ActionTag.IsValid())
            {
                return FGameplayTag();
            }
            for (const FActionEventEntry& Entry : GetMappingTable())
            {
                if (Entry.Action == ActionTag)
                {
                    return Entry.Event;
                }
            }
            return FGameplayTag();
        }
    }

    void RouteAction(FHktEvent& OutEvent, const FHktEvent& Intent)
    {
        // 호출자가 재사용하는 OutEvent 의 이전 상태를 지워 매핑 실패 케이스에서
        // stale 컨텍스트가 흘러가지 않도록 한다.
        OutEvent = FHktEvent{};

        const FGameplayTag MappedEvent = FindMapping(Intent.EventTag);
        if (!MappedEvent.IsValid())
        {
            UE_LOG(LogHktRule, Verbose,
                TEXT("[NaturalActionRouter] Unknown action tag — skipping. Intent=%s"),
                *Intent.EventTag.ToString());
            return;
        }

        // 1:1 echo — 판정 0, hint 그대로 통과 (권위는 VM 단계).
        OutEvent.EventTag     = MappedEvent;
        OutEvent.SourceEntity = Intent.SourceEntity;
        OutEvent.TargetEntity = Intent.TargetEntity;
        OutEvent.Location     = Intent.Location;
        OutEvent.PlayerUid    = Intent.PlayerUid;
        OutEvent.Param0       = Intent.Param0;
        OutEvent.Param1       = Intent.Param1;
        OutEvent.Param2       = Intent.Param2;
        OutEvent.Param3       = Intent.Param3;
        // EventId 는 VM/서버가 enqueue 시점에 할당 — 라우터는 0 유지.
    }

    bool IsKnownAction(const FGameplayTag& ActionTag)
    {
        return FindMapping(ActionTag).IsValid();
    }

    FGameplayTag LookupEventForAction(const FGameplayTag& ActionTag)
    {
        return FindMapping(ActionTag);
    }
}
