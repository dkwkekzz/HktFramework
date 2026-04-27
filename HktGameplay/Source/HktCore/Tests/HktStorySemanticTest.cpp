// Copyright Hkt Studios, Inc. All Rights Reserved.
//
// Story 의미 검증 인프라 (Phase 1 후속).
//
// 목적: cpp 빌더로 등록된 program 과 schema 2 JSON 으로 등록된 program 이
// 동일한 입력 WorldState 에서 시뮬레이션 1틱 후 동일한 dirty diff 를 생성하는지
// 비교한다. byte-identical 비교는 폐기 (의미가 같으면 인스트럭션 시퀀스가 다를 수 있다).
//
// 비교 대상: FHktSimulationDiff 의
//   - PropertyDeltas (EntityId, PropertyId, NewValue, OldValue)
//   - SpawnedEntities  (EntityId)
//   - RemovedEntities  (EntityId)
//   - TagDeltas        (EntityId, Tags 합집합)
//   - VFXEvents / AnimEvents (Tag + 위치/엔티티)
//
// 사용 예 (Phase 2 에서 cpp ↔ V2 비교 시):
//   FHktStorySemanticHarness Hcpp;
//   Hcpp.SeedSelfEntity(100, 100);
//   TArray<FString> CppDirty;
//   Hcpp.RunStoryAndCaptureDirty(CppTag, Hcpp.SelfEntity, CppDirty);
//
//   FHktStorySemanticHarness Hv2;
//   Hv2.SeedSelfEntity(100, 100);
//   TArray<FString> JsonDirty;
//   Hv2.RunStoryAndCaptureDirty(JsonV2Tag, Hv2.SelfEntity, JsonDirty);
//
//   FString Msg;
//   const bool bOK = FHktStorySemanticHarness::CompareDirty(CppDirty, JsonDirty, Msg);

#include "Misc/AutomationTest.h"
#include "NativeGameplayTags.h"
#include "GameplayTagContainer.h"

#include "HktCoreSimulator.h"
#include "HktCoreEvents.h"
#include "HktCoreProperties.h"
#include "HktWorldState.h"
#include "HktStoryBuilder.h"
#include "VM/HktVMProgram.h"

#if WITH_AUTOMATION_TESTS

// 자가검증용 Story 태그 — 모듈 로드 시 자동 등록되어 RequestGameplayTag 로 정상 해석.
UE_DEFINE_GAMEPLAY_TAG_STATIC(Tag_Test_Semantic_SelfCheck, "Test.Semantic.SelfCheck");

namespace
{
    /**
     * FHktStorySemanticHarness — Story 의미 검증용 테스트 헬퍼.
     *
     * 같은 시뮬레이터 인스턴스를 통해 시드 → AdvanceFrame 1틱 → dirty diff 를
     * 정규화된 문자열 라인으로 캡처한다. 매 케이스마다 시뮬레이터를 새로 만들어
     * 상호 오염을 방지한다.
     */
    struct FHktStorySemanticHarness
    {
        TUniquePtr<IHktDeterminismSimulator> Sim;
        FHktEntityId SelfEntity = InvalidEntityId;
        int64 PlayerUid = 1;

        FHktStorySemanticHarness()
        {
            Sim = CreateDeterminismSimulator(EHktLogSource::Server);
        }

        /** 단일 self entity 를 시뮬레이션에 주입 (Health/MaxHealth 등 초기 프로퍼티). */
        void SeedSelfEntity(int32 Health, int32 MaxHealth)
        {
            FHktEntityState Seed;
            Seed.EntityId = 1;
            Seed.OwnerUid = PlayerUid;
            Seed.Data.SetNumZeroed(HktProperty::MaxCount());
            Seed.Data[PropertyId::Health]    = Health;
            Seed.Data[PropertyId::MaxHealth] = MaxHealth;

            FHktSimulationEvent SeedEvent;
            SeedEvent.FrameNumber  = 0;
            SeedEvent.DeltaSeconds = 1.0f / 30.0f;
            SeedEvent.NewEntityStates.Add(Seed);
            const FHktSimulationDiff Diff = Sim->AdvanceFrame(SeedEvent);
            // 시드 프레임의 SpawnedEntities[0] 이 실제 부여된 EntityId.
            SelfEntity = (Diff.SpawnedEntities.Num() > 0)
                ? Diff.SpawnedEntities[0].EntityId
                : Seed.EntityId;
        }

        /**
         * Tag 로 등록된 program 을 1틱 실행하고 dirty 를 OutDirty 라인 배열로 캡처.
         * - program 이 등록돼 있지 않으면 false.
         * - WaitSeconds/WaitCollision 등 멀티-틱 program 도 호출은 가능하지만
         *   1틱 dirty 만 캡처되므로 비교는 제한적이다 (Phase 2 에서 멀티-틱 헬퍼 추가 권장).
         */
        bool RunStoryAndCaptureDirty(const FGameplayTag& Tag, FHktEntityId InSelfEntity, TArray<FString>& OutDirty)
        {
            if (!FHktVMProgramRegistry::Get().FindProgram(Tag))
            {
                return false;
            }
            FHktEvent Evt;
            Evt.EventId      = 1;
            Evt.EventTag     = Tag;
            Evt.SourceEntity = InSelfEntity;
            Evt.PlayerUid    = PlayerUid;

            FHktSimulationEvent Frame;
            Frame.FrameNumber  = 1;
            Frame.DeltaSeconds = 1.0f / 30.0f;
            Frame.NewEvents.Add(Evt);

            const FHktSimulationDiff Diff = Sim->AdvanceFrame(Frame);
            SerializeDiff(Diff, OutDirty);
            return true;
        }

        /** Diff 의 의미적으로 유의한 필드들을 정렬 가능한 라인 형식으로 직렬화. */
        static void SerializeDiff(const FHktSimulationDiff& Diff, TArray<FString>& Out)
        {
            for (const FHktPropertyDelta& P : Diff.PropertyDeltas)
            {
                Out.Add(FString::Printf(TEXT("PROP|E=%d|Pid=%u|Old=%d|New=%d"),
                    (int32)P.EntityId, P.PropertyId, P.OldValue, P.NewValue));
            }
            for (const FHktEntityState& S : Diff.SpawnedEntities)
            {
                Out.Add(FString::Printf(TEXT("SPAWN|E=%d|Owner=%lld"),
                    (int32)S.EntityId, S.OwnerUid));
            }
            for (const FHktEntityState& S : Diff.RemovedEntities)
            {
                Out.Add(FString::Printf(TEXT("REMOVE|E=%d"), (int32)S.EntityId));
            }
            for (const FHktTagDelta& T : Diff.TagDeltas)
            {
                FString TagsStr;
                for (const FGameplayTag& Tag : T.Tags)    { TagsStr += TEXT("+") + Tag.ToString(); }
                for (const FGameplayTag& Tag : T.OldTags) { TagsStr += TEXT("-") + Tag.ToString(); }
                Out.Add(FString::Printf(TEXT("TAG|E=%d|%s"), (int32)T.EntityId, *TagsStr));
            }
            for (const FHktVFXEvent& V : Diff.VFXEvents)
            {
                Out.Add(FString::Printf(TEXT("VFX|Tag=%s|P=%d,%d,%d"),
                    *V.Tag.ToString(), V.Position.X, V.Position.Y, V.Position.Z));
            }
            for (const FHktAnimEvent& A : Diff.AnimEvents)
            {
                Out.Add(FString::Printf(TEXT("ANIM|Tag=%s|E=%d"),
                    *A.Tag.ToString(), (int32)A.EntityId));
            }
            // VoxelDeltas / OwnerDeltas 는 현재 시범에서 비교 대상 외 — 필요 시 확장.
        }

        /** A,B 의 멀티셋 동일성을 검사 (정렬 후 line-by-line). 다르면 OutMessage 에 첫 차이 기술. */
        static bool CompareDirty(const TArray<FString>& InA, const TArray<FString>& InB, FString& OutMessage)
        {
            TArray<FString> A = InA; A.Sort();
            TArray<FString> B = InB; B.Sort();
            if (A.Num() != B.Num())
            {
                OutMessage = FString::Printf(TEXT("Dirty 라인 수가 다름: A=%d B=%d"), A.Num(), B.Num());
                return false;
            }
            for (int32 i = 0; i < A.Num(); ++i)
            {
                if (A[i] != B[i])
                {
                    OutMessage = FString::Printf(TEXT("라인 %d 불일치:\n  A: %s\n  B: %s"), i, *A[i], *B[i]);
                    return false;
                }
            }
            OutMessage = FString::Printf(TEXT("OK (%d 라인 일치)"), A.Num());
            return true;
        }
    };
}

// ============================================================================
// 자가검증 케이스: 같은 program 을 두 번 돌리면 동일 dirty 를 생성해야 한다.
//   → 헬퍼·비교 로직이 동작함을 입증한다 (인프라 smoke test).
//
// 시범 cpp ↔ V2 JSON 비교 케이스는 Phase 2 에서 추가:
//   - 현재 V2 로 변환된 JSON 은 Fireball 하나뿐이며 WaitSeconds/WaitCollision 으로
//     1틱 비교가 불가능하다.
//   - 32개 cpp 중 Wait/Yield 가 없어 1틱 비교 가능한 후보:
//     MoveStop, MoveForward, Jump, ItemDrop, ItemActivate, ItemDeactivate, ItemPickup,
//     ItemTrade, PlayerInWorld, TargetDefault, VoxelBreak, VoxelShatter (총 12개).
//     해당 cpp 의 의미를 보존하는 V2 JSON 이 등록되면 케이스를 추가한다.
// ============================================================================

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FHktStorySemantic_HarnessSelfCheck,
    "HktCore.Story.Semantic.HarnessSelfCheck",
    EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktStorySemantic_HarnessSelfCheck::RunTest(const FString& Parameters)
{
    const FName SelfCheckName(TEXT("Test.Semantic.SelfCheck"));

    // 임시 program 을 1회 등록 (Health -= 5).
    {
        FHktStoryBuilder B = FHktStoryBuilder::Create(SelfCheckName);
        B.LoadStoreEntity(Reg::R0, Reg::Self, PropertyId::Health);
        B.AddImm(Reg::R0, Reg::R0, -5);
        B.SaveStore(PropertyId::Health, Reg::R0);
        B.Halt();
        TSharedPtr<FHktVMProgram> Program = B.Build();
        TestNotNull(TEXT("test program 빌드"), Program.Get());
        if (!Program.IsValid()) return false;
        FHktVMProgramRegistry::Get().RegisterProgram(Program.ToSharedRef());
    }

    auto RunOnce = [this, &SelfCheckName](TArray<FString>& OutDirty) -> bool
    {
        FHktStorySemanticHarness H;
        H.SeedSelfEntity(/*Health*/ 100, /*MaxHealth*/ 100);
        if (H.SelfEntity == InvalidEntityId)
        {
            AddError(TEXT("seed entity 실패"));
            return false;
        }
        const FGameplayTag Tag = FGameplayTag::RequestGameplayTag(SelfCheckName, false);
        if (!Tag.IsValid())
        {
            AddError(TEXT("Test.Semantic.SelfCheck 태그가 없음"));
            return false;
        }
        if (!H.RunStoryAndCaptureDirty(Tag, H.SelfEntity, OutDirty))
        {
            AddError(TEXT("Test.Semantic.SelfCheck program 미등록"));
            return false;
        }
        return true;
    };

    TArray<FString> A, Bx;
    if (!RunOnce(A))  return false;
    if (!RunOnce(Bx)) return false;

    FString Msg;
    const bool bOK = FHktStorySemanticHarness::CompareDirty(A, Bx, Msg);
    TestTrue(FString::Printf(TEXT("동일 program 두 번 실행 시 dirty 가 동일해야 함: %s"), *Msg), bOK);

    // 최소 하나의 PropertyDelta (Health 100 → 95) 가 캡처되었는지 추가 검증.
    bool bSawHealth = false;
    for (const FString& Line : A)
    {
        if (Line.Contains(TEXT("PROP|")) && Line.Contains(TEXT("Old=100|New=95")))
        {
            bSawHealth = true;
            break;
        }
    }
    TestTrue(TEXT("Health 100→95 PropertyDelta 캡처됨"), bSawHealth);

    return bOK && bSawHealth;
}

#endif // WITH_AUTOMATION_TESTS
