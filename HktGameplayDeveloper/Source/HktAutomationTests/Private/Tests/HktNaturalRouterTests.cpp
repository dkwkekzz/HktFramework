// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktAutomationTestsLog.h"
#include "HktAutomationTestsTypes.h"
#include "HktCoreEvents.h"
#include "HktCoreTags.h"
#include "HktNaturalActionRouter.h"
#include "Misc/AutomationTest.h"

// ============================================================================
// HktNaturalActionRouter — PR-1 (Implementation-Plan §3) 검증.
//
// 라우터는 Action.Natural.<Verb> → Event.Natural.<Verbed> 의 1:1 echo. 판정 0.
// 본 테스트는 (a) 8 종 verb round-trip, (b) invalid action → invalid event,
// (c) hint(Param0~3 / Location / SourceEntity / TargetEntity / PlayerUid) 그대로 통과
// 를 검증한다.
// ============================================================================

namespace HktNaturalRouterTests
{

namespace
{
    FHktEvent MakeIntent(const FGameplayTag& ActionTag)
    {
        FHktEvent Intent;
        Intent.EventTag     = ActionTag;
        Intent.SourceEntity = 42;
        Intent.TargetEntity = 99;
        Intent.Location     = FVector(1.0, 2.0, 3.0);
        Intent.PlayerUid    = 0x1234'5678'ABCDLL;
        Intent.Param0       = 11;
        Intent.Param1       = 22;
        Intent.Param2       = 33;
        Intent.Param3       = 44;
        return Intent;
    }

    FHktTestResult CheckVerbMapping(const TCHAR* TestName,
                                    const FGameplayTag& ActionTag,
                                    const FGameplayTag& ExpectedEventTag)
    {
        const FHktEvent Intent = MakeIntent(ActionTag);
        FHktEvent OutEvent;
        HktNaturalActionRouter::RouteAction(OutEvent, Intent);

        if (!OutEvent.EventTag.IsValid())
        {
            return FHktTestResult::Fail(TestName,
                FString::Printf(TEXT("Expected %s, got invalid tag"), *ExpectedEventTag.ToString()));
        }
        if (OutEvent.EventTag != ExpectedEventTag)
        {
            return FHktTestResult::Fail(TestName,
                FString::Printf(TEXT("Expected %s, got %s"),
                    *ExpectedEventTag.ToString(), *OutEvent.EventTag.ToString()));
        }
        return FHktTestResult::Pass(TestName);
    }
}

// ---- 8 verb mappings ------------------------------------------------------

static FHktTestResult Test_Verb_Fell_To_TreeFelled()
{
    return CheckVerbMapping(TEXT("Verb_Fell_To_TreeFelled"),
        HktNaturalActionTags::Fell, HktNaturalEventTags::TreeFelled);
}

static FHktTestResult Test_Verb_Harvest_To_BerryHarvested()
{
    return CheckVerbMapping(TEXT("Verb_Harvest_To_BerryHarvested"),
        HktNaturalActionTags::Harvest, HktNaturalEventTags::BerryHarvested);
}

static FHktTestResult Test_Verb_Pluck_To_AquaticPlucked()
{
    return CheckVerbMapping(TEXT("Verb_Pluck_To_AquaticPlucked"),
        HktNaturalActionTags::Pluck, HktNaturalEventTags::AquaticPlucked);
}

static FHktTestResult Test_Verb_Eat_To_MushroomEaten()
{
    return CheckVerbMapping(TEXT("Verb_Eat_To_MushroomEaten"),
        HktNaturalActionTags::Eat, HktNaturalEventTags::MushroomEaten);
}

static FHktTestResult Test_Verb_Ignite_To_FireIgnited()
{
    return CheckVerbMapping(TEXT("Verb_Ignite_To_FireIgnited"),
        HktNaturalActionTags::Ignite, HktNaturalEventTags::FireIgnited);
}

static FHktTestResult Test_Verb_Mine_To_OreMined()
{
    return CheckVerbMapping(TEXT("Verb_Mine_To_OreMined"),
        HktNaturalActionTags::Mine, HktNaturalEventTags::OreMined);
}

static FHktTestResult Test_Verb_Cross_To_FordCrossed()
{
    return CheckVerbMapping(TEXT("Verb_Cross_To_FordCrossed"),
        HktNaturalActionTags::Cross, HktNaturalEventTags::FordCrossed);
}

static FHktTestResult Test_Verb_Drink_To_SpringDrank()
{
    return CheckVerbMapping(TEXT("Verb_Drink_To_SpringDrank"),
        HktNaturalActionTags::Drink, HktNaturalEventTags::SpringDrank);
}

// ---- Invalid action handling ---------------------------------------------

static FHktTestResult Test_InvalidTag_ProducesInvalidEvent()
{
    FHktEvent Intent = MakeIntent(FGameplayTag());  // 기본 생성 = invalid
    FHktEvent OutEvent;
    OutEvent.EventTag = HktNaturalEventTags::TreeFelled;  // stale 값 — 라우터가 지워야 함
    HktNaturalActionRouter::RouteAction(OutEvent, Intent);

    if (OutEvent.EventTag.IsValid())
    {
        return FHktTestResult::Fail(TEXT("InvalidTag_ProducesInvalidEvent"),
            FString::Printf(TEXT("Expected invalid, got %s"), *OutEvent.EventTag.ToString()));
    }
    return FHktTestResult::Pass(TEXT("InvalidTag_ProducesInvalidEvent"));
}

static FHktTestResult Test_UnknownActionTag_ProducesInvalidEvent()
{
    // Action.Natural.* 가 아닌 임의 태그 — TreeFelled (= Event.Natural.*) 자체를 입력으로.
    FHktEvent Intent = MakeIntent(HktNaturalEventTags::TreeFelled);
    FHktEvent OutEvent;
    HktNaturalActionRouter::RouteAction(OutEvent, Intent);

    if (OutEvent.EventTag.IsValid())
    {
        return FHktTestResult::Fail(TEXT("UnknownActionTag_ProducesInvalidEvent"),
            FString::Printf(TEXT("Event tag should be invalid for non-Action input, got %s"),
                *OutEvent.EventTag.ToString()));
    }
    return FHktTestResult::Pass(TEXT("UnknownActionTag_ProducesInvalidEvent"));
}

// ---- Hint propagation -----------------------------------------------------

static FHktTestResult Test_Hints_AllParamsCopied()
{
    const FHktEvent Intent = MakeIntent(HktNaturalActionTags::Fell);
    FHktEvent OutEvent;
    HktNaturalActionRouter::RouteAction(OutEvent, Intent);

    if (OutEvent.Param0 != Intent.Param0 ||
        OutEvent.Param1 != Intent.Param1 ||
        OutEvent.Param2 != Intent.Param2 ||
        OutEvent.Param3 != Intent.Param3)
    {
        return FHktTestResult::Fail(TEXT("Hints_AllParamsCopied"),
            FString::Printf(TEXT("Params mismatch: out=(%d,%d,%d,%d) vs intent=(%d,%d,%d,%d)"),
                OutEvent.Param0, OutEvent.Param1, OutEvent.Param2, OutEvent.Param3,
                Intent.Param0,  Intent.Param1,  Intent.Param2,  Intent.Param3));
    }
    return FHktTestResult::Pass(TEXT("Hints_AllParamsCopied"));
}

static FHktTestResult Test_Hints_LocationCopied()
{
    const FHktEvent Intent = MakeIntent(HktNaturalActionTags::Harvest);
    FHktEvent OutEvent;
    HktNaturalActionRouter::RouteAction(OutEvent, Intent);

    if (!OutEvent.Location.Equals(Intent.Location, KINDA_SMALL_NUMBER))
    {
        return FHktTestResult::Fail(TEXT("Hints_LocationCopied"),
            FString::Printf(TEXT("Location mismatch: out=%s vs intent=%s"),
                *OutEvent.Location.ToString(), *Intent.Location.ToString()));
    }
    return FHktTestResult::Pass(TEXT("Hints_LocationCopied"));
}

static FHktTestResult Test_Hints_SourceTargetCopied()
{
    const FHktEvent Intent = MakeIntent(HktNaturalActionTags::Mine);
    FHktEvent OutEvent;
    HktNaturalActionRouter::RouteAction(OutEvent, Intent);

    if (OutEvent.SourceEntity != Intent.SourceEntity || OutEvent.TargetEntity != Intent.TargetEntity)
    {
        return FHktTestResult::Fail(TEXT("Hints_SourceTargetCopied"),
            FString::Printf(TEXT("Entity mismatch: out=(%d,%d) vs intent=(%d,%d)"),
                OutEvent.SourceEntity, OutEvent.TargetEntity,
                Intent.SourceEntity,  Intent.TargetEntity));
    }
    return FHktTestResult::Pass(TEXT("Hints_SourceTargetCopied"));
}

static FHktTestResult Test_Hints_PlayerUidCopied()
{
    const FHktEvent Intent = MakeIntent(HktNaturalActionTags::Drink);
    FHktEvent OutEvent;
    HktNaturalActionRouter::RouteAction(OutEvent, Intent);

    if (OutEvent.PlayerUid != Intent.PlayerUid)
    {
        return FHktTestResult::Fail(TEXT("Hints_PlayerUidCopied"),
            FString::Printf(TEXT("PlayerUid mismatch: out=%lld vs intent=%lld"),
                OutEvent.PlayerUid, Intent.PlayerUid));
    }
    return FHktTestResult::Pass(TEXT("Hints_PlayerUidCopied"));
}

// ---- Lookup helpers -------------------------------------------------------

static FHktTestResult Test_IsKnownAction_ReturnsTrueForAllVerbs()
{
    const FGameplayTag AllActions[] = {
        HktNaturalActionTags::Fell,    HktNaturalActionTags::Harvest,
        HktNaturalActionTags::Pluck,   HktNaturalActionTags::Eat,
        HktNaturalActionTags::Ignite,  HktNaturalActionTags::Mine,
        HktNaturalActionTags::Cross,   HktNaturalActionTags::Drink,
    };
    for (const FGameplayTag& Action : AllActions)
    {
        if (!HktNaturalActionRouter::IsKnownAction(Action))
        {
            return FHktTestResult::Fail(TEXT("IsKnownAction_ReturnsTrueForAllVerbs"),
                FString::Printf(TEXT("IsKnownAction(%s) should be true"), *Action.ToString()));
        }
    }
    return FHktTestResult::Pass(TEXT("IsKnownAction_ReturnsTrueForAllVerbs"));
}

static FHktTestResult Test_IsKnownAction_ReturnsFalseForInvalid()
{
    if (HktNaturalActionRouter::IsKnownAction(FGameplayTag()))
    {
        return FHktTestResult::Fail(TEXT("IsKnownAction_ReturnsFalseForInvalid"),
            TEXT("IsKnownAction(invalid) should be false"));
    }
    if (HktNaturalActionRouter::IsKnownAction(HktNaturalEventTags::TreeFelled))
    {
        return FHktTestResult::Fail(TEXT("IsKnownAction_ReturnsFalseForInvalid"),
            TEXT("IsKnownAction(Event tag) should be false (events are not actions)"));
    }
    return FHktTestResult::Pass(TEXT("IsKnownAction_ReturnsFalseForInvalid"));
}

// ============================================================================
// Public entry — HktAutomationTestsRunner.cpp 가 호출
// ============================================================================

FHktTestReport RunAllRouterTests()
{
    FHktTestReport Report;

    // verb 8
    Report.Add(Test_Verb_Fell_To_TreeFelled());
    Report.Add(Test_Verb_Harvest_To_BerryHarvested());
    Report.Add(Test_Verb_Pluck_To_AquaticPlucked());
    Report.Add(Test_Verb_Eat_To_MushroomEaten());
    Report.Add(Test_Verb_Ignite_To_FireIgnited());
    Report.Add(Test_Verb_Mine_To_OreMined());
    Report.Add(Test_Verb_Cross_To_FordCrossed());
    Report.Add(Test_Verb_Drink_To_SpringDrank());

    // invalid 2
    Report.Add(Test_InvalidTag_ProducesInvalidEvent());
    Report.Add(Test_UnknownActionTag_ProducesInvalidEvent());

    // hint propagation 4
    Report.Add(Test_Hints_AllParamsCopied());
    Report.Add(Test_Hints_LocationCopied());
    Report.Add(Test_Hints_SourceTargetCopied());
    Report.Add(Test_Hints_PlayerUidCopied());

    // lookup helpers 2
    Report.Add(Test_IsKnownAction_ReturnsTrueForAllVerbs());
    Report.Add(Test_IsKnownAction_ReturnsFalseForInvalid());

    return Report;
}

}  // namespace HktNaturalRouterTests

// ============================================================================
// UE Automation Framework wrappers
// 본 파일의 테스트는 (a) custom harness (`hkt.automation.run`), (b) UE Editor
// Session Frontend → Automation 두 경로 모두에서 실행 가능.
// ============================================================================

#if WITH_AUTOMATION_TESTS

namespace
{
    bool ReportRouterResultToAutomation(FAutomationTestBase& Test, const FHktTestResult& Result)
    {
        if (!Result.bPassed)
        {
            Test.AddError(Result.Message.IsEmpty()
                ? FString::Printf(TEXT("%s: failed"), *Result.TestName)
                : FString::Printf(TEXT("%s: %s"), *Result.TestName, *Result.Message));
        }
        return Result.bPassed;
    }
}

#define HKT_DEFINE_ROUTER_AUTOMATION_TEST(TestClass, PrettyName, FuncRef)                                    \
    IMPLEMENT_SIMPLE_AUTOMATION_TEST(TestClass, PrettyName,                                                  \
        EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)                   \
    bool TestClass::RunTest(const FString& /*Parameters*/)                                                   \
    {                                                                                                        \
        return ReportRouterResultToAutomation(*this, FuncRef());                                             \
    }

HKT_DEFINE_ROUTER_AUTOMATION_TEST(FHktActionRouterFellTest,
    "HktCore.Action.Router.Fell", HktNaturalRouterTests::Test_Verb_Fell_To_TreeFelled)
HKT_DEFINE_ROUTER_AUTOMATION_TEST(FHktActionRouterHarvestTest,
    "HktCore.Action.Router.Harvest", HktNaturalRouterTests::Test_Verb_Harvest_To_BerryHarvested)
HKT_DEFINE_ROUTER_AUTOMATION_TEST(FHktActionRouterPluckTest,
    "HktCore.Action.Router.Pluck", HktNaturalRouterTests::Test_Verb_Pluck_To_AquaticPlucked)
HKT_DEFINE_ROUTER_AUTOMATION_TEST(FHktActionRouterEatTest,
    "HktCore.Action.Router.Eat", HktNaturalRouterTests::Test_Verb_Eat_To_MushroomEaten)
HKT_DEFINE_ROUTER_AUTOMATION_TEST(FHktActionRouterIgniteTest,
    "HktCore.Action.Router.Ignite", HktNaturalRouterTests::Test_Verb_Ignite_To_FireIgnited)
HKT_DEFINE_ROUTER_AUTOMATION_TEST(FHktActionRouterMineTest,
    "HktCore.Action.Router.Mine", HktNaturalRouterTests::Test_Verb_Mine_To_OreMined)
HKT_DEFINE_ROUTER_AUTOMATION_TEST(FHktActionRouterCrossTest,
    "HktCore.Action.Router.Cross", HktNaturalRouterTests::Test_Verb_Cross_To_FordCrossed)
HKT_DEFINE_ROUTER_AUTOMATION_TEST(FHktActionRouterDrinkTest,
    "HktCore.Action.Router.Drink", HktNaturalRouterTests::Test_Verb_Drink_To_SpringDrank)
HKT_DEFINE_ROUTER_AUTOMATION_TEST(FHktActionRouterInvalidTagTest,
    "HktCore.Action.Router.InvalidTag", HktNaturalRouterTests::Test_InvalidTag_ProducesInvalidEvent)
HKT_DEFINE_ROUTER_AUTOMATION_TEST(FHktActionRouterUnknownActionTagTest,
    "HktCore.Action.Router.UnknownActionTag", HktNaturalRouterTests::Test_UnknownActionTag_ProducesInvalidEvent)
HKT_DEFINE_ROUTER_AUTOMATION_TEST(FHktActionRouterHintsAllParamsTest,
    "HktCore.Action.Router.Hints.AllParamsCopied", HktNaturalRouterTests::Test_Hints_AllParamsCopied)
HKT_DEFINE_ROUTER_AUTOMATION_TEST(FHktActionRouterHintsLocationTest,
    "HktCore.Action.Router.Hints.LocationCopied", HktNaturalRouterTests::Test_Hints_LocationCopied)
HKT_DEFINE_ROUTER_AUTOMATION_TEST(FHktActionRouterHintsSourceTargetTest,
    "HktCore.Action.Router.Hints.SourceTargetCopied", HktNaturalRouterTests::Test_Hints_SourceTargetCopied)
HKT_DEFINE_ROUTER_AUTOMATION_TEST(FHktActionRouterHintsPlayerUidTest,
    "HktCore.Action.Router.Hints.PlayerUidCopied", HktNaturalRouterTests::Test_Hints_PlayerUidCopied)
HKT_DEFINE_ROUTER_AUTOMATION_TEST(FHktActionRouterIsKnownAllTest,
    "HktCore.Action.Router.IsKnown.AllVerbs", HktNaturalRouterTests::Test_IsKnownAction_ReturnsTrueForAllVerbs)
HKT_DEFINE_ROUTER_AUTOMATION_TEST(FHktActionRouterIsKnownInvalidTest,
    "HktCore.Action.Router.IsKnown.Invalid", HktNaturalRouterTests::Test_IsKnownAction_ReturnsFalseForInvalid)

#undef HKT_DEFINE_ROUTER_AUTOMATION_TEST

#endif  // WITH_AUTOMATION_TESTS
