// Copyright Hkt Studios, Inc. All Rights Reserved.
//
// PR-3 strangler-fig 마이그레이션 동등성 검증 (UE Automation Test).
//
// cpp 로 등록된 원본 Story 와 schema 2 JSON 으로 등록된 `Story.V2.{원본}` 가
// 동일 입력에 대해 동일 결과 property 를 만드는지 검증한다. byte-identical 비교는 폐기.
//
// 사용 패턴:
//   1. cpp Program 과 V2 Program 을 Registry 에서 lookup
//   2. 동일한 입력 prop 셋으로 별도 FHktAutomationTestHarness 인스턴스에서 각각 실행
//   3. ExecuteProgram 결과 EVMStatus 비교 + 의미 있는 property 비교

#include "Misc/AutomationTest.h"
#include "GameplayTagContainer.h"
#include "NativeGameplayTags.h"

#include "HktAutomationTestsHarness.h"
#include "HktCoreProperties.h"
#include "HktStoryRegistry.h"
#include "VM/HktVMProgram.h"
#include "VM/HktVMInterpreter.h"

#if WITH_AUTOMATION_TESTS

namespace
{
	const FHktVMProgram* FindProgramByName(const TCHAR* TagName)
	{
		const FGameplayTag Tag = FGameplayTag::RequestGameplayTag(FName(TagName), false);
		if (!Tag.IsValid()) return nullptr;
		return FHktVMProgramRegistry::Get().FindProgram(Tag);
	}
}

// ============================================================================
// MoveStop: cpp `Story.Event.Move.Stop` ↔ JSON `Story.V2.Event.Move.Stop`
//   기대: 둘 다 MoveForce=0, IsMoving=0 으로 정지시킨다.
// ============================================================================

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktStoryV2_MoveStop_Equivalent,
	"HktCore.Story.V2.MoveStop.Equivalent",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktStoryV2_MoveStop_Equivalent::RunTest(const FString& Parameters)
{
	// Story 등록 (안전하게 재호출).
	FHktStoryRegistry::InitializeAllStories();

	const FHktVMProgram* CppProg = FindProgramByName(TEXT("Story.Event.Move.Stop"));
	const FHktVMProgram* V2Prog  = FindProgramByName(TEXT("Story.V2.Event.Move.Stop"));

	TestNotNull(TEXT("cpp story 등록 (Story.Event.Move.Stop)"), CppProg);
	TestNotNull(TEXT("V2 story 등록 (Story.V2.Event.Move.Stop)"), V2Prog);
	if (!CppProg || !V2Prog) return false;

	auto RunOnce = [](const FHktVMProgram* P, int32& OutMoveForce, int32& OutIsMoving) -> EVMStatus
	{
		FHktAutomationTestHarness H;
		H.Setup();
		TMap<uint16, int32> Props;
		Props.Add(PropertyId::MoveForce, 500);
		Props.Add(PropertyId::IsMoving, 1);
		const FHktEntityId Self = H.CreateEntityWithProperties(Props);
		const EVMStatus St = H.ExecuteProgram(P, Self, InvalidEntityId, /*MaxFrames=*/500);
		OutMoveForce = H.GetProperty(Self, PropertyId::MoveForce);
		OutIsMoving  = H.GetProperty(Self, PropertyId::IsMoving);
		H.Teardown();
		return St;
	};

	int32 CppMF = -1, CppIM = -1;
	int32 V2MF  = -1, V2IM  = -1;
	const EVMStatus CppSt = RunOnce(CppProg, CppMF, CppIM);
	const EVMStatus V2St  = RunOnce(V2Prog,  V2MF,  V2IM);

	TestEqual(TEXT("cpp 실행 상태 == Completed"), (int32)CppSt, (int32)EVMStatus::Completed);
	TestEqual(TEXT("V2 실행 상태 == Completed"),  (int32)V2St,  (int32)EVMStatus::Completed);

	TestEqual(TEXT("MoveForce 결과 동등"), V2MF, CppMF);
	TestEqual(TEXT("IsMoving 결과 동등"),  V2IM, CppIM);

	// 의미적으로도 정지(0,0)가 되어야 한다 — 두 결과가 같지만 정지가 아니면 둘 다 잘못된 것.
	TestEqual(TEXT("의미 검증: MoveForce==0 (정지)"), CppMF, 0);
	TestEqual(TEXT("의미 검증: IsMoving==0 (정지)"),  CppIM, 0);

	return true;
}

#endif // WITH_AUTOMATION_TESTS
