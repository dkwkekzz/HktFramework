// Copyright Hkt Studios, Inc. All Rights Reserved.
//
// FHktStorySpecAutomationTest — Phase 2d Story Spec 영구 검증 자동화 테스트.
//
// 본 파일은 `HktGameplay/Content/Stories/**/*.spec.json` 사이드카를 스캔하여
// 시나리오 단위로 UE Automation 테스트를 펼친다. 실행 위치: Session Frontend
// `HktCore.Story.Spec.<TagNormalized>.<ScenarioName>`.
//
// 설계 결정:
//  - Spec storyTag 는 V2 prefix 없이 작성된다. lookup 시 "Story.V2.<rest>" 우선,
//    실패 시 base tag (Phase 2i rename 후 자동 호환).
//  - Spec sibling 본문 (Foo.spec.json ↔ Foo.json) 이 있으면 자동화 실행 시
//    V2 등록을 보장 (PIE 외부에서 PreBeginPIE 훅 미발화 대응 — equivalence 테스트 패턴).

#include "Misc/AutomationTest.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Misc/ScopeExit.h"
#include "HAL/FileManager.h"
#include "GameplayTagContainer.h"

#include "HktAutomationTestsHarness.h"
#include "HktCoreProperties.h"
#include "HktCoreArchetype.h"
#include "HktStoryRegistry.h"
#include "HktStoryJsonParser.h"
#include "VM/HktVMProgram.h"

#include "HktStorySpecParser.h"

#if WITH_AUTOMATION_TESTS

namespace HktStorySpecRunner
{
	static FString GetStoriesRoot()
	{
		return FPaths::ProjectPluginsDir()
			/ TEXT("HktFramework/HktGameplay/Content/Stories");
	}

	static FString NormalizeForTestName(const FString& In)
	{
		FString Out = In;
		for (TCHAR& C : Out)
		{
			if (!FChar::IsAlnum(C) && C != TEXT('_')) C = TEXT('_');
		}
		return Out;
	}

	static void ScanSpecFiles(TArray<FString>& OutAbsPaths)
	{
		const FString Root = GetStoriesRoot();
		IFileManager::Get().FindFilesRecursive(OutAbsPaths, *Root, TEXT("*.spec.json"), true, false);
	}

	// V2 우선, 베이스 fallback. Phase 2i rename 후 자연 호환.
	static const FHktVMProgram* FindProgram(const FString& BaseTag)
	{
		if (BaseTag.StartsWith(TEXT("Story.")) && !BaseTag.StartsWith(TEXT("Story.V2.")))
		{
			const FString V2Tag = TEXT("Story.V2.") + BaseTag.Mid(6);
			const FGameplayTag V2 = FGameplayTag::RequestGameplayTag(FName(*V2Tag), false);
			if (V2.IsValid())
			{
				if (const FHktVMProgram* P = FHktVMProgramRegistry::Get().FindProgram(V2)) return P;
			}
		}
		const FGameplayTag Base = FGameplayTag::RequestGameplayTag(FName(*BaseTag), false);
		if (Base.IsValid())
		{
			if (const FHktVMProgram* P = FHktVMProgramRegistry::Get().FindProgram(Base)) return P;
		}
		return nullptr;
	}

	// spec sibling 본문 (Foo.spec.json → Foo.json) 으로부터 V2 등록.
	// 호출자가 이미 "registry 에 target 미존재" 를 확인한 후에만 호출하는 전제.
	// 따라서 ParseAndBuild 가 빈 슬롯에 쓰므로 overwrite 로그 미발생.
	static bool LoadSiblingV2(const FString& SpecAbsPath)
	{
		if (!SpecAbsPath.EndsWith(TEXT(".spec.json"))) return false;
		FString BodyPath = SpecAbsPath.LeftChop(10); // ".spec.json"
		BodyPath.Append(TEXT(".json"));
		if (!IFileManager::Get().FileExists(*BodyPath)) return false;
		FString JsonStr;
		if (!FFileHelper::LoadFileToString(JsonStr, *BodyPath)) return false;
		const FHktStoryParseResult R = FHktStoryJsonParser::Get().ParseAndBuild(JsonStr);
		return R.bSuccess;
	}

	static FHktEntityId BuildEntity(
		FHktAutomationTestHarness& H,
		const FHktSpecEntity& E,
		TArray<FString>& OutUnknownProps,
		TArray<FString>& OutUnknownArchetypes)
	{
		FHktWorldState& W = H.GetWorldState();
		const FHktEntityId Id = W.AllocateEntity();
		// archetype: trait/property 카탈로그 결정. IfHasTrait/CheckTrait 가 의존.
		if (!E.Archetype.IsEmpty())
		{
			const EHktArchetype Arch = FHktArchetypeRegistry::Get().FindByName(*E.Archetype);
			if (Arch != EHktArchetype::None)
			{
				W.SetArchetype(Id, Arch);
			}
			else
			{
				OutUnknownArchetypes.Add(E.Archetype);
			}
		}
		for (const FHktSpecPropPair& P : E.Properties)
		{
			const FHktPropertyDef* Def = HktProperty::FindByName(P.Name);
			if (Def)
			{
				W.SetProperty(Id, *Def, P.Value);
			}
			else
			{
				OutUnknownProps.Add(P.Name);
			}
		}
		if (E.bHasPosition)
		{
			W.SetProperty(Id, HktProperty::PosX, E.PosX);
			W.SetProperty(Id, HktProperty::PosY, E.PosY);
			W.SetProperty(Id, HktProperty::PosZ, E.PosZ);
		}
		for (const FString& T : E.Tags)
		{
			const FGameplayTag Tag = FGameplayTag::RequestGameplayTag(FName(*T), false);
			if (Tag.IsValid()) W.AddTag(Id, Tag);
		}
		return Id;
	}
}

IMPLEMENT_COMPLEX_AUTOMATION_TEST(
	FHktStorySpecAutomationTest,
	"HktCore.Story.Spec",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

void FHktStorySpecAutomationTest::GetTests(
	TArray<FString>& OutBeautifiedNames,
	TArray<FString>& OutTestCommands) const
{
	TArray<FString> SpecFiles;
	HktStorySpecRunner::ScanSpecFiles(SpecFiles);
	for (const FString& Abs : SpecFiles)
	{
		FHktStorySpec Spec;
		FString Err;
		if (!FHktStorySpecParser::ParseFile(Abs, Spec, Err)) continue;

		const FString TagN = HktStorySpecRunner::NormalizeForTestName(Spec.StoryTag);
		for (int32 i = 0; i < Spec.Scenarios.Num(); ++i)
		{
			const FString NameN = HktStorySpecRunner::NormalizeForTestName(Spec.Scenarios[i].Name);
			OutBeautifiedNames.Add(FString::Printf(TEXT("%s.%s"), *TagN, *NameN));
			OutTestCommands.Add(FString::Printf(TEXT("%s|%d"), *Abs, i));
		}
	}
}

bool FHktStorySpecAutomationTest::RunTest(const FString& Parameters)
{
	int32 Pipe = INDEX_NONE;
	if (!Parameters.FindLastChar(TEXT('|'), Pipe))
	{
		AddError(TEXT("Parameters 폼 오류 (expected: <path>|<idx>)"));
		return false;
	}
	const FString AbsPath = Parameters.Left(Pipe);
	const int32 ScenarioIdx = FCString::Atoi(*Parameters.Mid(Pipe + 1));

	FHktStorySpec Spec;
	FString Err;
	if (!FHktStorySpecParser::ParseFile(AbsPath, Spec, Err))
	{
		AddError(FString::Printf(TEXT("spec 파싱 실패 (%s): %s"), *AbsPath, *Err));
		return false;
	}
	if (!Spec.Scenarios.IsValidIndex(ScenarioIdx))
	{
		AddError(FString::Printf(TEXT("scenario 인덱스 범위 외: %d"), ScenarioIdx));
		return false;
	}
	const FHktSpecScenario& S = Spec.Scenarios[ScenarioIdx];

	// Lazy 등록 — 세 단계로 점진적 등록을 시도하되 매 단계마다 target 조회.
	// PIE 가 이미 ReloadAllStories 로 등록을 마친 상태가 일반적이므로, 이 경우
	// 등록 절차 자체를 건너뛰어 "overwriting existing program" 로그를 회피한다.
	//
	//   1) 즉시 조회 — registry 가 PIE 또는 이전 테스트로 이미 채워진 경우 (대부분).
	//   2) sibling V2 본문만 등록 — V2 tag 가 빈 경우, cpp 전체를 건드리지 않고 핀포인트.
	//   3) cpp native 일괄 등록 — V2 가 없는 (cpp 한정) Story 에 한해 fallback.
	const FHktVMProgram* Prog = HktStorySpecRunner::FindProgram(Spec.StoryTag);
	if (!Prog)
	{
		HktStorySpecRunner::LoadSiblingV2(AbsPath);
		Prog = HktStorySpecRunner::FindProgram(Spec.StoryTag);
	}
	if (!Prog)
	{
		FHktStoryRegistry::InitializeAllStories();
		Prog = HktStorySpecRunner::FindProgram(Spec.StoryTag);
	}
	if (!Prog)
	{
		AddError(FString::Printf(TEXT("Program 미등록: %s (V2 시도 + cpp native 등록 후에도 부재)"), *Spec.StoryTag));
		return false;
	}

	FHktAutomationTestHarness H;
	H.Setup();
	ON_SCOPE_EXIT { H.Teardown(); };

	TArray<FString> UnknownProps;
	TArray<FString> UnknownArchetypes;
	const FHktEntityId Self = HktStorySpecRunner::BuildEntity(H, S.Given.Self, UnknownProps, UnknownArchetypes);
	FHktEntityId Target = InvalidEntityId;
	if (S.Given.bHasTarget)
	{
		Target = HktStorySpecRunner::BuildEntity(H, S.Given.Target, UnknownProps, UnknownArchetypes);
	}
	TArray<FHktEntityId> EntityIds;
	for (const FHktSpecEntity& E : S.Given.Entities)
	{
		EntityIds.Add(HktStorySpecRunner::BuildEntity(H, E, UnknownProps, UnknownArchetypes));
	}
	if (UnknownProps.Num() > 0)
	{
		AddError(FString::Printf(TEXT("given: 알 수 없는 PropertyId 이름 [%s] — HktProperty::FindByName 등록 누락 의심"),
			*FString::Join(UnknownProps, TEXT(", "))));
		return false;
	}
	if (UnknownArchetypes.Num() > 0)
	{
		AddError(FString::Printf(TEXT("given: 알 수 없는 archetype 이름 [%s] — FHktArchetypeRegistry::FindByName 등록 누락"),
			*FString::Join(UnknownArchetypes, TEXT(", "))));
		return false;
	}

	// given.event 가 있으면 Context.EventParam* 세팅 (LoadStore Param0 류 op 가 entity 컬럼이 아닌 Context local 을 읽음).
	if (S.Given.Event.bSet)
	{
		H.SetEventParams(
			S.Given.Event.Param0, S.Given.Event.Param1, S.Given.Event.Param2, S.Given.Event.Param3,
			S.Given.Event.TargetPosX, S.Given.Event.TargetPosY, S.Given.Event.TargetPosZ);
	}

	auto ResolveRef = [&](const FString& Ref) -> FHktEntityId
	{
		if (Ref == TEXT("self"))   return Self;
		if (Ref == TEXT("target")) return Target;
		if (Ref.StartsWith(TEXT("entities[")) && Ref.EndsWith(TEXT("]")))
		{
			const FString Inner = Ref.Mid(9, Ref.Len() - 10);
			const int32 Idx = FCString::Atoi(*Inner);
			if (EntityIds.IsValidIndex(Idx)) return EntityIds[Idx];
		}
		return InvalidEntityId;
	};

	// 실행 — events 가 비어있으면 단발 ExecuteProgram (Timer 자동 진행).
	EVMStatus Status;
	if (S.Events.Num() == 0)
	{
		Status = H.ExecuteProgram(Prog, Self, Target, S.MaxFrames);
	}
	else
	{
		EWaitEventType WaitKind = EWaitEventType::None;
		Status = H.ExecuteUntilWait(Prog, Self, Target, S.MaxFrames, WaitKind);
		for (const FHktSpecEvent& Ev : S.Events)
		{
			switch (Ev.Kind)
			{
				case EHktSpecEventKind::Advance:         H.AdvanceTimerFrames(Ev.Frames); break;
				case EHktSpecEventKind::InjectCollision: H.InjectCollisionEvent(ResolveRef(Ev.EntityRef)); break;
				case EHktSpecEventKind::InjectMoveEnd:   H.InjectMoveEndEvent(); break;
				case EHktSpecEventKind::InjectGrounded:  H.InjectGroundedEvent(); break;
				case EHktSpecEventKind::InjectAnimEnd:   H.InjectAnimEndEvent(); break;
			}
			Status = H.ResumeUntilDone(S.MaxFrames);
			if (Status == EVMStatus::Completed || Status == EVMStatus::Failed) break;
		}
	}

	bool bAllPass = true;
	const FString DiagPrefix = FString::Printf(TEXT("(%s scenario #%d '%s')"),
		*FPaths::GetCleanFilename(AbsPath), ScenarioIdx, *S.Name);

	if (Status != S.Expect.Status)
	{
		AddError(FString::Printf(TEXT("status: expected=%d actual=%d %s"),
			(int32)S.Expect.Status, (int32)Status, *DiagPrefix));
		bAllPass = false;
	}

	for (const FHktSpecMatcher& M : S.Expect.Matchers)
	{
		const FHktEntityId Eid = ResolveRef(M.EntityRef);
		if (Eid == InvalidEntityId)
		{
			AddError(FString::Printf(TEXT("expect.%s: entity ref 해석 실패 %s"),
				*M.EntityRef, *DiagPrefix));
			bAllPass = false;
			continue;
		}

		// properties — 정확 일치
		for (const FHktSpecPropPair& P : M.Properties)
		{
			const FHktPropertyDef* Def = HktProperty::FindByName(P.Name);
			if (!Def)
			{
				AddError(FString::Printf(TEXT("expect.%s.properties: 알 수 없는 PropertyId '%s' %s"),
					*M.EntityRef, *P.Name, *DiagPrefix));
				bAllPass = false;
				continue;
			}
			const int32 Actual = H.GetProperty(Eid, *Def);
			if (Actual != P.Value)
			{
				AddError(FString::Printf(TEXT("expect.%s.properties.%s: expected=%d actual=%d %s"),
					*M.EntityRef, *P.Name, P.Value, Actual, *DiagPrefix));
				bAllPass = false;
			}
		}

		// tags — 부분 일치 (모두 포함)
		for (const FString& T : M.TagsContains)
		{
			const FGameplayTag Tag = FGameplayTag::RequestGameplayTag(FName(*T), false);
			if (!Tag.IsValid() || !H.HasTag(Eid, Tag))
			{
				AddError(FString::Printf(TEXT("expect.%s.tags: '%s' 부재 %s"),
					*M.EntityRef, *T, *DiagPrefix));
				bAllPass = false;
			}
		}

		// tagsAbsent — 모두 부재
		for (const FString& T : M.TagsAbsent)
		{
			const FGameplayTag Tag = FGameplayTag::RequestGameplayTag(FName(*T), false);
			if (Tag.IsValid() && H.HasTag(Eid, Tag))
			{
				AddError(FString::Printf(TEXT("expect.%s.tagsAbsent: '%s' 가 남아있음 %s"),
					*M.EntityRef, *T, *DiagPrefix));
				bAllPass = false;
			}
		}

		// tagsExact — 명시 태그가 모두 있어야 PASS (역방향 추가 태그 검출은 Phase 2e 보강).
		for (const FString& T : M.TagsExact)
		{
			const FGameplayTag Tag = FGameplayTag::RequestGameplayTag(FName(*T), false);
			if (!Tag.IsValid() || !H.HasTag(Eid, Tag))
			{
				AddError(FString::Printf(TEXT("expect.%s.tagsExact: '%s' 부재 %s"),
					*M.EntityRef, *T, *DiagPrefix));
				bAllPass = false;
			}
		}
	}

	return bAllPass;
}

#endif // WITH_AUTOMATION_TESTS
