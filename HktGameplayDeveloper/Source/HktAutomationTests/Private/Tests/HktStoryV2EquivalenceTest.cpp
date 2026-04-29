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
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "HAL/FileManager.h"
#include "GameplayTagContainer.h"
#include "NativeGameplayTags.h"

#include "HktAutomationTestsHarness.h"
#include "HktCoreProperties.h"
#include "HktStoryRegistry.h"
#include "HktStoryJsonParser.h"
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

	// V2 JSON Story 를 직접 파싱+등록.
	// 자동화 테스트는 PIE 외부에서 실행되어 HktStoryModule 의 PreBeginPIE 훅이
	// 발화하지 않으므로 JSON 등록을 수동으로 트리거해야 한다.
	// 이미 등록된 Story 는 ParseAndBuild → BuildAndRegister 가 idempotent 하게 갱신.
	bool EnsureV2StoryLoaded(const TCHAR* RelativePath, FString& OutError)
	{
		const FString FullPath = FPaths::ProjectPluginsDir()
			/ TEXT("HktFramework/HktGameplay/Content/Stories") / RelativePath;
		if (!IFileManager::Get().FileExists(*FullPath))
		{
			OutError = FString::Printf(TEXT("V2 JSON 파일 없음: %s"), *FullPath);
			return false;
		}
		FString JsonStr;
		if (!FFileHelper::LoadFileToString(JsonStr, *FullPath))
		{
			OutError = FString::Printf(TEXT("V2 JSON 읽기 실패: %s"), *FullPath);
			return false;
		}
		FHktStoryParseResult R = FHktStoryJsonParser::Get().ParseAndBuild(JsonStr);
		if (!R.bSuccess)
		{
			OutError = FString::Printf(TEXT("V2 JSON 파싱 실패 (%s): %s"),
				*FullPath, R.Errors.Num() > 0 ? *R.Errors[0] : TEXT("unknown"));
			return false;
		}
		return true;
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

	// V2 JSON Story 수동 로드 — PIE 외부 실행 시에도 V2 가 등록되도록 보장.
	FString LoadErr;
	if (!EnsureV2StoryLoaded(TEXT("Movement/MoveStop.json"), LoadErr))
	{
		AddError(LoadErr);
		return false;
	}

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

	// 의미 검증 — 정지 상태 표식만 확인.
	// (MoveForce 는 StopMovement 가 건드리지 않으므로 입력값이 그대로 남는다 —
	//  cpp 빌더 구현이 IsMoving=0, VelX/Y/Z=0 만 emit. 시뮬레이션 시스템 측에서
	//  IsMoving=0 을 보고 다음 프레임부터 가속을 멈추는 설계.)
	TestEqual(TEXT("의미 검증: IsMoving==0 (정지)"),  CppIM, 0);

	return true;
}

#endif // WITH_AUTOMATION_TESTS
