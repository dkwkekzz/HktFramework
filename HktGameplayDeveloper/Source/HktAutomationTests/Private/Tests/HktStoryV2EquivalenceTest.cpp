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

// ============================================================================
// PR-3 Phase 2b — Wait 없는 11개 cpp ↔ V2 JSON 동등성 케이스
//
// 각 케이스의 패턴:
//   1. cpp/V2 program 을 Registry 에서 lookup
//   2. EnsureV2StoryLoaded 로 V2 JSON 등록
//   3. cpp 본문이 사용하는 prop 만 셋업하여 ExecuteProgram(MaxFrames=500)
//   4. cpp 본문이 SaveStore/SaveConstEntity 한 prop 들만 비교
//
// precondition 람다가 있는 5개 cpp (ItemActivate, ItemDeactivate, ItemDrop,
// ItemPickup, ItemTrade) 는 Phase 2b 의 명세에 따라 람다 검증 skip — 본문 입력은
// cpp precondition 이 자동으로 통과되도록 셋업 (또는 cpp/V2 둘 다 같은 fail 경로
// 를 거치므로 결과가 동일하면 PASS).
// ============================================================================

// ----------------------------------------------------------------------------
// MoveForward
// ----------------------------------------------------------------------------
IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktStoryV2_MoveForward_Equivalent,
	"HktCore.Story.V2.MoveForward.Equivalent",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktStoryV2_MoveForward_Equivalent::RunTest(const FString& Parameters)
{
	FHktStoryRegistry::InitializeAllStories();
	FString LoadErr;
	if (!EnsureV2StoryLoaded(TEXT("Movement/MoveForward.json"), LoadErr)) { AddError(LoadErr); return false; }

	const FHktVMProgram* CppProg = FindProgramByName(TEXT("Story.Event.Move.Forward"));
	const FHktVMProgram* V2Prog  = FindProgramByName(TEXT("Story.V2.Event.Move.Forward"));
	TestNotNull(TEXT("cpp"), CppProg); TestNotNull(TEXT("V2"), V2Prog);
	if (!CppProg || !V2Prog) return false;

	auto RunOnce = [](const FHktVMProgram* P, int32& OutMTX, int32& OutMTY, int32& OutMF, int32& OutIM) -> EVMStatus
	{
		FHktAutomationTestHarness H; H.Setup();
		TMap<uint16, int32> Props;
		Props.Add(PropertyId::TargetPosX, 100);
		Props.Add(PropertyId::TargetPosY, 200);
		Props.Add(PropertyId::TargetPosZ, 300);
		const FHktEntityId Self = H.CreateEntityWithProperties(Props);
		const EVMStatus St = H.ExecuteProgram(P, Self, InvalidEntityId, 500);
		OutMTX = H.GetProperty(Self, PropertyId::MoveTargetX);
		OutMTY = H.GetProperty(Self, PropertyId::MoveTargetY);
		OutMF  = H.GetProperty(Self, PropertyId::MoveForce);
		OutIM  = H.GetProperty(Self, PropertyId::IsMoving);
		H.Teardown();
		return St;
	};

	int32 c1 = -1, c2 = -1, c3 = -1, c4 = -1;
	int32 v1 = -1, v2 = -1, v3 = -1, v4 = -1;
	const EVMStatus CppSt = RunOnce(CppProg, c1, c2, c3, c4);
	const EVMStatus V2St  = RunOnce(V2Prog,  v1, v2, v3, v4);
	TestEqual(TEXT("status"), (int32)CppSt, (int32)V2St);
	TestEqual(TEXT("MoveTargetX"), v1, c1);
	TestEqual(TEXT("MoveTargetY"), v2, c2);
	TestEqual(TEXT("MoveForce"),   v3, c3);
	TestEqual(TEXT("IsMoving"),    v4, c4);
	TestEqual(TEXT("의미: MoveForce==150"), c3, 150);
	TestEqual(TEXT("의미: IsMoving==1"),    c4, 1);
	return true;
}

// ----------------------------------------------------------------------------
// Jump
// ----------------------------------------------------------------------------
IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktStoryV2_Jump_Equivalent,
	"HktCore.Story.V2.Jump.Equivalent",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktStoryV2_Jump_Equivalent::RunTest(const FString& Parameters)
{
	FHktStoryRegistry::InitializeAllStories();
	FString LoadErr;
	if (!EnsureV2StoryLoaded(TEXT("Movement/Jump.json"), LoadErr)) { AddError(LoadErr); return false; }

	const FHktVMProgram* CppProg = FindProgramByName(TEXT("Story.Event.Move.Jump"));
	const FHktVMProgram* V2Prog  = FindProgramByName(TEXT("Story.V2.Event.Move.Jump"));
	TestNotNull(TEXT("cpp"), CppProg); TestNotNull(TEXT("V2"), V2Prog);
	if (!CppProg || !V2Prog) return false;

	auto RunOnce = [](const FHktVMProgram* P, int32& OutGrounded, int32& OutVelZ) -> EVMStatus
	{
		FHktAutomationTestHarness H; H.Setup();
		TMap<uint16, int32> Props;
		Props.Add(PropertyId::IsGrounded, 1);  // precondition: 접지 상태에서만 Jump 가능
		const FHktEntityId Self = H.CreateEntityWithProperties(Props);
		// 점프는 WaitGrounded 가 있어 MaxFrames 도달 시 WaitingEvent 로 종료될 수 있다.
		// 동등성 검증은 그 직전까지의 prop 효과만 본다.
		const EVMStatus St = H.ExecuteProgram(P, Self, InvalidEntityId, 500);
		OutGrounded = H.GetProperty(Self, PropertyId::IsGrounded);
		OutVelZ     = H.GetProperty(Self, PropertyId::VelZ);
		H.Teardown();
		return St;
	};

	int32 cG = -1, cV = -1, vG = -1, vV = -1;
	const EVMStatus CppSt = RunOnce(CppProg, cG, cV);
	const EVMStatus V2St  = RunOnce(V2Prog,  vG, vV);
	TestEqual(TEXT("status"), (int32)CppSt, (int32)V2St);
	TestEqual(TEXT("IsGrounded"), vG, cG);
	TestEqual(TEXT("VelZ"),       vV, cV);
	TestEqual(TEXT("의미: VelZ==500"), cV, 500);
	return true;
}

// ----------------------------------------------------------------------------
// VoxelBreak
// ----------------------------------------------------------------------------
IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktStoryV2_VoxelBreak_Equivalent,
	"HktCore.Story.V2.VoxelBreak.Equivalent",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktStoryV2_VoxelBreak_Equivalent::RunTest(const FString& Parameters)
{
	FHktStoryRegistry::InitializeAllStories();
	FString LoadErr;
	if (!EnsureV2StoryLoaded(TEXT("Voxel/VoxelBreak.json"), LoadErr)) { AddError(LoadErr); return false; }

	const FHktVMProgram* CppProg = FindProgramByName(TEXT("Story.Voxel.Break"));
	const FHktVMProgram* V2Prog  = FindProgramByName(TEXT("Story.V2.Voxel.Break"));
	TestNotNull(TEXT("cpp"), CppProg); TestNotNull(TEXT("V2"), V2Prog);
	if (!CppProg || !V2Prog) return false;

	auto RunOnce = [](const FHktVMProgram* P, int32& OutCount) -> EVMStatus
	{
		FHktAutomationTestHarness H; H.Setup();
		TMap<uint16, int32> Props;
		Props.Add(PropertyId::TargetPosX, 1000);
		Props.Add(PropertyId::TargetPosY, 2000);
		Props.Add(PropertyId::TargetPosZ, 500);
		Props.Add(PropertyId::Param0, 7);  // TypeId
		const FHktEntityId Self = H.CreateEntityWithProperties(Props);
		const EVMStatus St = H.ExecuteProgram(P, Self, InvalidEntityId, 500);
		// Debris 가 새로 스폰되었는지 — entity count 차이로 검증 (Self 1 + Debris 1 = 2)
		OutCount = H.GetEntityCount();
		H.Teardown();
		return St;
	};

	int32 cN = -1, vN = -1;
	const EVMStatus CppSt = RunOnce(CppProg, cN);
	const EVMStatus V2St  = RunOnce(V2Prog,  vN);
	TestEqual(TEXT("status"), (int32)CppSt, (int32)V2St);
	TestEqual(TEXT("EntityCount"), vN, cN);
	return true;
}

// ----------------------------------------------------------------------------
// VoxelCrumble
// ----------------------------------------------------------------------------
IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktStoryV2_VoxelCrumble_Equivalent,
	"HktCore.Story.V2.VoxelCrumble.Equivalent",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktStoryV2_VoxelCrumble_Equivalent::RunTest(const FString& Parameters)
{
	FHktStoryRegistry::InitializeAllStories();
	FString LoadErr;
	if (!EnsureV2StoryLoaded(TEXT("Voxel/VoxelCrumble.json"), LoadErr)) { AddError(LoadErr); return false; }

	const FHktVMProgram* CppProg = FindProgramByName(TEXT("Story.Voxel.Crumble"));
	const FHktVMProgram* V2Prog  = FindProgramByName(TEXT("Story.V2.Voxel.Crumble"));
	TestNotNull(TEXT("cpp"), CppProg); TestNotNull(TEXT("V2"), V2Prog);
	if (!CppProg || !V2Prog) return false;

	auto RunOnce = [](const FHktVMProgram* P, int32& OutCount) -> EVMStatus
	{
		FHktAutomationTestHarness H; H.Setup();
		TMap<uint16, int32> Props;
		Props.Add(PropertyId::TargetPosX, 1000);
		Props.Add(PropertyId::TargetPosY, 2000);
		Props.Add(PropertyId::TargetPosZ, 500);
		Props.Add(PropertyId::Param0, 5);
		const FHktEntityId Self = H.CreateEntityWithProperties(Props);
		const EVMStatus St = H.ExecuteProgram(P, Self, InvalidEntityId, 500);
		OutCount = H.GetEntityCount();
		H.Teardown();
		return St;
	};

	int32 cN = -1, vN = -1;
	const EVMStatus CppSt = RunOnce(CppProg, cN);
	const EVMStatus V2St  = RunOnce(V2Prog,  vN);
	TestEqual(TEXT("status"), (int32)CppSt, (int32)V2St);
	TestEqual(TEXT("EntityCount"), vN, cN);
	return true;
}

// ----------------------------------------------------------------------------
// VoxelCrack
// ----------------------------------------------------------------------------
IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktStoryV2_VoxelCrack_Equivalent,
	"HktCore.Story.V2.VoxelCrack.Equivalent",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktStoryV2_VoxelCrack_Equivalent::RunTest(const FString& Parameters)
{
	FHktStoryRegistry::InitializeAllStories();
	FString LoadErr;
	if (!EnsureV2StoryLoaded(TEXT("Voxel/VoxelCrack.json"), LoadErr)) { AddError(LoadErr); return false; }

	const FHktVMProgram* CppProg = FindProgramByName(TEXT("Story.Voxel.Crack"));
	const FHktVMProgram* V2Prog  = FindProgramByName(TEXT("Story.V2.Voxel.Crack"));
	TestNotNull(TEXT("cpp"), CppProg); TestNotNull(TEXT("V2"), V2Prog);
	if (!CppProg || !V2Prog) return false;

	auto RunOnce = [](const FHktVMProgram* P, int32& OutCount) -> EVMStatus
	{
		FHktAutomationTestHarness H; H.Setup();
		TMap<uint16, int32> Props;
		Props.Add(PropertyId::TargetPosX, 1000);
		Props.Add(PropertyId::TargetPosY, 2000);
		Props.Add(PropertyId::TargetPosZ, 500);
		Props.Add(PropertyId::Param0, 9);
		const FHktEntityId Self = H.CreateEntityWithProperties(Props);
		const EVMStatus St = H.ExecuteProgram(P, Self, InvalidEntityId, 500);
		OutCount = H.GetEntityCount();
		H.Teardown();
		return St;
	};

	int32 cN = -1, vN = -1;
	const EVMStatus CppSt = RunOnce(CppProg, cN);
	const EVMStatus V2St  = RunOnce(V2Prog,  vN);
	TestEqual(TEXT("status"), (int32)CppSt, (int32)V2St);
	TestEqual(TEXT("EntityCount"), vN, cN);
	return true;
}

// ----------------------------------------------------------------------------
// PlayerInWorld
// ----------------------------------------------------------------------------
IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktStoryV2_PlayerInWorld_Equivalent,
	"HktCore.Story.V2.PlayerInWorld.Equivalent",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktStoryV2_PlayerInWorld_Equivalent::RunTest(const FString& Parameters)
{
	FHktStoryRegistry::InitializeAllStories();
	FString LoadErr;
	if (!EnsureV2StoryLoaded(TEXT("Lifecycle/PlayerInWorld.json"), LoadErr)) { AddError(LoadErr); return false; }

	const FHktVMProgram* CppProg = FindProgramByName(TEXT("Story.State.Player.InWorld"));
	const FHktVMProgram* V2Prog  = FindProgramByName(TEXT("Story.V2.State.Player.InWorld"));
	TestNotNull(TEXT("cpp"), CppProg); TestNotNull(TEXT("V2"), V2Prog);
	if (!CppProg || !V2Prog) return false;

	auto RunOnce = [](const FHktVMProgram* P, int32& OutCount) -> EVMStatus
	{
		FHktAutomationTestHarness H; H.Setup();
		TMap<uint16, int32> Props;
		Props.Add(PropertyId::TargetPosX, 100);
		Props.Add(PropertyId::TargetPosY, 100);
		Props.Add(PropertyId::TargetPosZ, 0);
		const FHktEntityId Self = H.CreateEntityWithProperties(Props);
		const EVMStatus St = H.ExecuteProgram(P, Self, InvalidEntityId, 500);
		// Self(원) + 새 캐릭터 + 목검 = 3 (cpp/V2 동일)
		OutCount = H.GetEntityCount();
		H.Teardown();
		return St;
	};

	int32 cN = -1, vN = -1;
	const EVMStatus CppSt = RunOnce(CppProg, cN);
	const EVMStatus V2St  = RunOnce(V2Prog,  vN);
	TestEqual(TEXT("status"), (int32)CppSt, (int32)V2St);
	TestEqual(TEXT("EntityCount"), vN, cN);
	return true;
}

// ----------------------------------------------------------------------------
// TargetDefault — Target=Invalid 분기 (가장 단순한 경로)
// ----------------------------------------------------------------------------
IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktStoryV2_TargetDefault_Equivalent,
	"HktCore.Story.V2.TargetDefault.Equivalent",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktStoryV2_TargetDefault_Equivalent::RunTest(const FString& Parameters)
{
	FHktStoryRegistry::InitializeAllStories();
	FString LoadErr;
	if (!EnsureV2StoryLoaded(TEXT("Lifecycle/TargetDefault.json"), LoadErr)) { AddError(LoadErr); return false; }

	const FHktVMProgram* CppProg = FindProgramByName(TEXT("Story.Event.Target.Default"));
	const FHktVMProgram* V2Prog  = FindProgramByName(TEXT("Story.V2.Event.Target.Default"));
	TestNotNull(TEXT("cpp"), CppProg); TestNotNull(TEXT("V2"), V2Prog);
	if (!CppProg || !V2Prog) return false;

	auto RunOnce = [](const FHktVMProgram* P) -> EVMStatus
	{
		FHktAutomationTestHarness H; H.Setup();
		const FHktEntityId Self = H.CreateEntity();
		// Target = Invalid → dispatch_move 분기. DispatchEvent + Halt 로 종료.
		const EVMStatus St = H.ExecuteProgram(P, Self, InvalidEntityId, 500);
		H.Teardown();
		return St;
	};

	const EVMStatus CppSt = RunOnce(CppProg);
	const EVMStatus V2St  = RunOnce(V2Prog);
	TestEqual(TEXT("status (Target=Invalid → dispatch_move 분기)"), (int32)CppSt, (int32)V2St);
	return true;
}

// ----------------------------------------------------------------------------
// ItemDrop — precondition 람다 skip, body 만 비교
// ----------------------------------------------------------------------------
IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktStoryV2_ItemDrop_Equivalent,
	"HktCore.Story.V2.ItemDrop.Equivalent",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktStoryV2_ItemDrop_Equivalent::RunTest(const FString& Parameters)
{
	FHktStoryRegistry::InitializeAllStories();
	FString LoadErr;
	if (!EnsureV2StoryLoaded(TEXT("Item/ItemDrop.json"), LoadErr)) { AddError(LoadErr); return false; }

	const FHktVMProgram* CppProg = FindProgramByName(TEXT("Story.Event.Item.Drop"));
	const FHktVMProgram* V2Prog  = FindProgramByName(TEXT("Story.V2.Event.Item.Drop"));
	TestNotNull(TEXT("cpp"), CppProg); TestNotNull(TEXT("V2"), V2Prog);
	if (!CppProg || !V2Prog) return false;

	auto RunOnce = [](const FHktVMProgram* P, int32& OutItemState, int32& OutOwner) -> EVMStatus
	{
		FHktAutomationTestHarness H; H.Setup();
		const FHktEntityId Self = H.CreateEntity();
		TMap<uint16, int32> ItemProps;
		ItemProps.Add(PropertyId::ItemState, 1);  // InBag (Active 아님 → drop_exec 직행)
		ItemProps.Add(PropertyId::OwnerEntity, Self);
		ItemProps.Add(PropertyId::EquipIndex, 0);
		const FHktEntityId Item = H.CreateEntityWithProperties(ItemProps);
		const EVMStatus St = H.ExecuteProgram(P, Self, Item, 500);
		OutItemState = H.GetProperty(Item, PropertyId::ItemState);
		OutOwner     = H.GetProperty(Item, PropertyId::OwnerEntity);
		H.Teardown();
		return St;
	};

	int32 c1 = -1, c2 = -1, v1 = -1, v2 = -1;
	const EVMStatus CppSt = RunOnce(CppProg, c1, c2);
	const EVMStatus V2St  = RunOnce(V2Prog,  v1, v2);
	TestEqual(TEXT("status"), (int32)CppSt, (int32)V2St);
	TestEqual(TEXT("ItemState (Drop 후)"),   v1, c1);
	TestEqual(TEXT("OwnerEntity (Drop 후)"), v2, c2);
	return true;
}

// ----------------------------------------------------------------------------
// ItemActivate — precondition 람다 skip, InBag → Active 본문
// ----------------------------------------------------------------------------
IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktStoryV2_ItemActivate_Equivalent,
	"HktCore.Story.V2.ItemActivate.Equivalent",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktStoryV2_ItemActivate_Equivalent::RunTest(const FString& Parameters)
{
	FHktStoryRegistry::InitializeAllStories();
	FString LoadErr;
	if (!EnsureV2StoryLoaded(TEXT("Item/ItemActivate.json"), LoadErr)) { AddError(LoadErr); return false; }

	const FHktVMProgram* CppProg = FindProgramByName(TEXT("Story.Event.Item.Activate"));
	const FHktVMProgram* V2Prog  = FindProgramByName(TEXT("Story.V2.Event.Item.Activate"));
	TestNotNull(TEXT("cpp"), CppProg); TestNotNull(TEXT("V2"), V2Prog);
	if (!CppProg || !V2Prog) return false;

	auto RunOnce = [](const FHktVMProgram* P, int32& OutItemState) -> EVMStatus
	{
		FHktAutomationTestHarness H; H.Setup();
		TMap<uint16, int32> SelfProps;
		SelfProps.Add(PropertyId::Param0, 0);  // ItemActivateParams::EquipIndex
		const FHktEntityId Self = H.CreateEntityWithProperties(SelfProps);
		TMap<uint16, int32> ItemProps;
		ItemProps.Add(PropertyId::ItemState, 1);
		ItemProps.Add(PropertyId::OwnerEntity, Self);
		const FHktEntityId Item = H.CreateEntityWithProperties(ItemProps);
		const EVMStatus St = H.ExecuteProgram(P, Self, Item, 500);
		OutItemState = H.GetProperty(Item, PropertyId::ItemState);
		H.Teardown();
		return St;
	};

	int32 c1 = -1, v1 = -1;
	const EVMStatus CppSt = RunOnce(CppProg, c1);
	const EVMStatus V2St  = RunOnce(V2Prog,  v1);
	TestEqual(TEXT("status"), (int32)CppSt, (int32)V2St);
	TestEqual(TEXT("ItemState"), v1, c1);
	return true;
}

// ----------------------------------------------------------------------------
// ItemDeactivate — precondition 람다 skip
// ----------------------------------------------------------------------------
IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktStoryV2_ItemDeactivate_Equivalent,
	"HktCore.Story.V2.ItemDeactivate.Equivalent",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktStoryV2_ItemDeactivate_Equivalent::RunTest(const FString& Parameters)
{
	FHktStoryRegistry::InitializeAllStories();
	FString LoadErr;
	if (!EnsureV2StoryLoaded(TEXT("Item/ItemDeactivate.json"), LoadErr)) { AddError(LoadErr); return false; }

	const FHktVMProgram* CppProg = FindProgramByName(TEXT("Story.Event.Item.Deactivate"));
	const FHktVMProgram* V2Prog  = FindProgramByName(TEXT("Story.V2.Event.Item.Deactivate"));
	TestNotNull(TEXT("cpp"), CppProg); TestNotNull(TEXT("V2"), V2Prog);
	if (!CppProg || !V2Prog) return false;

	auto RunOnce = [](const FHktVMProgram* P, int32& OutItemState) -> EVMStatus
	{
		FHktAutomationTestHarness H; H.Setup();
		const FHktEntityId Self = H.CreateEntity();
		TMap<uint16, int32> ItemProps;
		ItemProps.Add(PropertyId::ItemState, 2);  // Active
		ItemProps.Add(PropertyId::OwnerEntity, Self);
		ItemProps.Add(PropertyId::EquipIndex, 0);
		const FHktEntityId Item = H.CreateEntityWithProperties(ItemProps);
		const EVMStatus St = H.ExecuteProgram(P, Self, Item, 500);
		OutItemState = H.GetProperty(Item, PropertyId::ItemState);
		H.Teardown();
		return St;
	};

	int32 c1 = -1, v1 = -1;
	const EVMStatus CppSt = RunOnce(CppProg, c1);
	const EVMStatus V2St  = RunOnce(V2Prog,  v1);
	TestEqual(TEXT("status"), (int32)CppSt, (int32)V2St);
	TestEqual(TEXT("ItemState (Deactivate 후)"), v1, c1);
	return true;
}

// ----------------------------------------------------------------------------
// ItemPickup — precondition 람다 skip
// ----------------------------------------------------------------------------
IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktStoryV2_ItemPickup_Equivalent,
	"HktCore.Story.V2.ItemPickup.Equivalent",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktStoryV2_ItemPickup_Equivalent::RunTest(const FString& Parameters)
{
	FHktStoryRegistry::InitializeAllStories();
	FString LoadErr;
	if (!EnsureV2StoryLoaded(TEXT("Item/ItemPickup.json"), LoadErr)) { AddError(LoadErr); return false; }

	const FHktVMProgram* CppProg = FindProgramByName(TEXT("Story.Event.Item.Pickup"));
	const FHktVMProgram* V2Prog  = FindProgramByName(TEXT("Story.V2.Event.Item.Pickup"));
	TestNotNull(TEXT("cpp"), CppProg); TestNotNull(TEXT("V2"), V2Prog);
	if (!CppProg || !V2Prog) return false;

	auto RunOnce = [](const FHktVMProgram* P, int32& OutOwner, int32& OutItemState) -> EVMStatus
	{
		FHktAutomationTestHarness H; H.Setup();
		const FHktEntityId Self = H.CreateEntity();
		TMap<uint16, int32> ItemProps;
		ItemProps.Add(PropertyId::ItemState, 0);  // Ground
		const FHktEntityId Item = H.CreateEntityWithProperties(ItemProps);
		const EVMStatus St = H.ExecuteProgram(P, Self, Item, 500);
		OutOwner     = H.GetProperty(Item, PropertyId::OwnerEntity);
		OutItemState = H.GetProperty(Item, PropertyId::ItemState);
		H.Teardown();
		return St;
	};

	int32 c1 = -1, c2 = -1, v1 = -1, v2 = -1;
	const EVMStatus CppSt = RunOnce(CppProg, c1, c2);
	const EVMStatus V2St  = RunOnce(V2Prog,  v1, v2);
	TestEqual(TEXT("status"), (int32)CppSt, (int32)V2St);
	TestEqual(TEXT("OwnerEntity"), v1, c1);
	TestEqual(TEXT("ItemState"),   v2, c2);
	return true;
}

// ----------------------------------------------------------------------------
// ItemTrade — precondition 람다 skip, 본문 검증 + 교환
// ----------------------------------------------------------------------------
IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktStoryV2_ItemTrade_Equivalent,
	"HktCore.Story.V2.ItemTrade.Equivalent",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktStoryV2_ItemTrade_Equivalent::RunTest(const FString& Parameters)
{
	FHktStoryRegistry::InitializeAllStories();
	FString LoadErr;
	if (!EnsureV2StoryLoaded(TEXT("Item/ItemTrade.json"), LoadErr)) { AddError(LoadErr); return false; }

	const FHktVMProgram* CppProg = FindProgramByName(TEXT("Story.Event.Item.Trade"));
	const FHktVMProgram* V2Prog  = FindProgramByName(TEXT("Story.V2.Event.Item.Trade"));
	TestNotNull(TEXT("cpp"), CppProg); TestNotNull(TEXT("V2"), V2Prog);
	if (!CppProg || !V2Prog) return false;

	auto RunOnce = [](const FHktVMProgram* P, int32& OutOfferOwner, int32& OutReqOwner) -> EVMStatus
	{
		FHktAutomationTestHarness H; H.Setup();
		const FHktEntityId Target = H.CreateEntity();
		// Item 들을 먼저 만들어 EntityId 를 확보 — 그러나 Self 의 Param0/Param1 에 그 ID 를 셋업해야 한다.
		// 결정론을 위해 먼저 Item 두 개 만들고 그 EntityId 를 이용해 Self 를 후행 생성한다.
		TMap<uint16, int32> Offer;
		Offer.Add(PropertyId::ItemState, 1);
		const FHktEntityId OfferItem = H.CreateEntityWithProperties(Offer);
		TMap<uint16, int32> Req;
		Req.Add(PropertyId::ItemState, 1);
		const FHktEntityId ReqItem = H.CreateEntityWithProperties(Req);
		TMap<uint16, int32> SelfProps;
		SelfProps.Add(PropertyId::Param0, static_cast<int32>(OfferItem));
		SelfProps.Add(PropertyId::Param1, static_cast<int32>(ReqItem));
		const FHktEntityId Self = H.CreateEntityWithProperties(SelfProps);
		// Item 들의 OwnerEntity 도 Self/Target 으로 설정 (Self 가 알려진 후) — WorldState 에 직접 즉시 반영
		H.GetWorldState().SetProperty(OfferItem, PropertyId::OwnerEntity, static_cast<int32>(Self));
		H.GetWorldState().SetProperty(ReqItem,   PropertyId::OwnerEntity, static_cast<int32>(Target));
		const EVMStatus St = H.ExecuteProgram(P, Self, Target, 500);
		OutOfferOwner = H.GetProperty(OfferItem, PropertyId::OwnerEntity);
		OutReqOwner   = H.GetProperty(ReqItem,   PropertyId::OwnerEntity);
		H.Teardown();
		return St;
	};

	int32 c1 = -1, c2 = -1, v1 = -1, v2 = -1;
	const EVMStatus CppSt = RunOnce(CppProg, c1, c2);
	const EVMStatus V2St  = RunOnce(V2Prog,  v1, v2);
	TestEqual(TEXT("status"), (int32)CppSt, (int32)V2St);
	TestEqual(TEXT("OfferItem.OwnerEntity (교환 후)"), v1, c1);
	TestEqual(TEXT("ReqItem.OwnerEntity (교환 후)"),   v2, c2);
	return true;
}

// ============================================================================
// PR-3 Phase 2c — Wait 있는 cpp ↔ V2 동등성 케이스 (17개)
//
// Harness 확장 (ExecuteUntilWait/ResumeUntilDone/InjectGroundedEvent) 을 활용:
//   - WaitCollision : ExecuteUntilWait → InjectCollisionEvent → ResumeUntilDone
//   - WaitMoveEnd   : ExecuteUntilWait → InjectMoveEndEvent   → ResumeUntilDone
//   - WaitGrounded  : ExecuteUntilWait → InjectGroundedEvent  → ResumeUntilDone
//   - WaitAnimEnd / WaitSeconds : Timer 기반 — ExecuteProgram 의 자동 진행으로 충분
//
// 무한 루프 Spawner 는 한 사이클의 끝(Yield/WaitSeconds 직전)에서 ExecuteUntilWait
// 가 멈추므로 그 시점 EntityCount/dirty prop 으로 비교한다 (MaxFrames=500).
// ============================================================================

namespace
{
	// 공통 유틸: 두 program 을 같은 Self/Target/입력 으로 한 번씩 실행 후 결과 비교용 entity count 만 회수.
	// (Spawner 류 한 사이클 비교에 적합. cpp/V2 둘 다 같은 진행 + 같은 타이밍이라면 같은 수가 나와야 한다.)
	int32 RunOnceCountAfter(const FHktVMProgram* P, FHktEntityId Self, int32 MaxFrames)
	{
		FHktAutomationTestHarness H; H.Setup();
		// Self 가 InvalidEntityId 가 아니면 호출자가 별도 prop 셋업 후 ID 를 넘긴 것.
		const FHktEntityId Source = Self;
		EWaitEventType Kind = EWaitEventType::None;
		H.ExecuteUntilWait(P, Source, InvalidEntityId, MaxFrames, Kind);
		const int32 N = H.GetEntityCount();
		H.Teardown();
		return N;
	}
}

// ----------------------------------------------------------------------------
// BasicAttack — WaitAnimEnd (Timer 기반, 자동 진행)
// ----------------------------------------------------------------------------
IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktStoryV2_BasicAttack_Equivalent,
	"HktCore.Story.V2.BasicAttack.Equivalent",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktStoryV2_BasicAttack_Equivalent::RunTest(const FString& Parameters)
{
	FHktStoryRegistry::InitializeAllStories();
	FString LoadErr;
	if (!EnsureV2StoryLoaded(TEXT("Combat/BasicAttack.json"), LoadErr)) { AddError(LoadErr); return false; }

	const FHktVMProgram* CppProg = FindProgramByName(TEXT("Story.Event.Attack.Basic"));
	const FHktVMProgram* V2Prog  = FindProgramByName(TEXT("Story.V2.Event.Attack.Basic"));
	TestNotNull(TEXT("cpp"), CppProg); TestNotNull(TEXT("V2"), V2Prog);
	if (!CppProg || !V2Prog) return false;

	auto RunOnce = [](const FHktVMProgram* P, int32& OutAtk) -> EVMStatus
	{
		FHktAutomationTestHarness H; H.Setup();
		TMap<uint16, int32> Props;
		Props.Add(PropertyId::AttackPower, 25);
		const FHktEntityId Self = H.CreateEntityWithProperties(Props);
		const FHktEntityId Target = H.CreateEntity();
		// 단순 비교 — 주변에 Hittable 엔티티가 없는 환경에서 Halt 까지 진행.
		const EVMStatus St = H.ExecuteProgram(P, Self, Target, 500);
		OutAtk = H.GetProperty(Self, PropertyId::AttackPower);
		H.Teardown();
		return St;
	};

	int32 cA = -1, vA = -1;
	const EVMStatus CppSt = RunOnce(CppProg, cA);
	const EVMStatus V2St  = RunOnce(V2Prog,  vA);
	TestEqual(TEXT("status"), (int32)CppSt, (int32)V2St);
	TestEqual(TEXT("AttackPower 보존"), vA, cA);
	return true;
}

// ----------------------------------------------------------------------------
// Buff — WaitSeconds(0.5) 후 자기 AttackPower +10
// ----------------------------------------------------------------------------
IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktStoryV2_Buff_Equivalent,
	"HktCore.Story.V2.Buff.Equivalent",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktStoryV2_Buff_Equivalent::RunTest(const FString& Parameters)
{
	FHktStoryRegistry::InitializeAllStories();
	FString LoadErr;
	if (!EnsureV2StoryLoaded(TEXT("Combat/Buff.json"), LoadErr)) { AddError(LoadErr); return false; }

	const FHktVMProgram* CppProg = FindProgramByName(TEXT("Story.Event.Skill.Buff"));
	const FHktVMProgram* V2Prog  = FindProgramByName(TEXT("Story.V2.Event.Skill.Buff"));
	TestNotNull(TEXT("cpp"), CppProg); TestNotNull(TEXT("V2"), V2Prog);
	if (!CppProg || !V2Prog) return false;

	auto RunOnce = [](const FHktVMProgram* P, int32& OutAtk) -> EVMStatus
	{
		FHktAutomationTestHarness H; H.Setup();
		TMap<uint16, int32> Props;
		Props.Add(PropertyId::AttackPower, 20);
		const FHktEntityId Self = H.CreateEntityWithProperties(Props);
		const EVMStatus St = H.ExecuteProgram(P, Self, InvalidEntityId, 500);
		OutAtk = H.GetProperty(Self, PropertyId::AttackPower);
		H.Teardown();
		return St;
	};

	int32 cA = -1, vA = -1;
	const EVMStatus CppSt = RunOnce(CppProg, cA);
	const EVMStatus V2St  = RunOnce(V2Prog,  vA);
	TestEqual(TEXT("status"), (int32)CppSt, (int32)V2St);
	TestEqual(TEXT("AttackPower (+10)"), vA, cA);
	TestEqual(TEXT("의미: 30"), cA, 30);
	return true;
}

// ----------------------------------------------------------------------------
// Heal — WaitSeconds(0.8) 후 Health 회복 (clamp)
// ----------------------------------------------------------------------------
IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktStoryV2_Heal_Equivalent,
	"HktCore.Story.V2.Heal.Equivalent",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktStoryV2_Heal_Equivalent::RunTest(const FString& Parameters)
{
	FHktStoryRegistry::InitializeAllStories();
	FString LoadErr;
	if (!EnsureV2StoryLoaded(TEXT("Combat/Heal.json"), LoadErr)) { AddError(LoadErr); return false; }

	const FHktVMProgram* CppProg = FindProgramByName(TEXT("Story.Event.Skill.Heal"));
	const FHktVMProgram* V2Prog  = FindProgramByName(TEXT("Story.V2.Event.Skill.Heal"));
	TestNotNull(TEXT("cpp"), CppProg); TestNotNull(TEXT("V2"), V2Prog);
	if (!CppProg || !V2Prog) return false;

	auto RunOnce = [](const FHktVMProgram* P, int32& OutHp) -> EVMStatus
	{
		FHktAutomationTestHarness H; H.Setup();
		TMap<uint16, int32> Props;
		Props.Add(PropertyId::Health,    60);
		Props.Add(PropertyId::MaxHealth, 100);
		Props.Add(PropertyId::Param0,    0);  // 기본 50 사용
		const FHktEntityId Self = H.CreateEntityWithProperties(Props);
		const EVMStatus St = H.ExecuteProgram(P, Self, InvalidEntityId, 500);
		OutHp = H.GetProperty(Self, PropertyId::Health);
		H.Teardown();
		return St;
	};

	int32 cH = -1, vH = -1;
	const EVMStatus CppSt = RunOnce(CppProg, cH);
	const EVMStatus V2St  = RunOnce(V2Prog,  vH);
	TestEqual(TEXT("status"), (int32)CppSt, (int32)V2St);
	TestEqual(TEXT("Health (60+50 clamped 100)"), vH, cH);
	return true;
}

// ----------------------------------------------------------------------------
// Lightning — Target 직격 + 범위 (주변 적 없음)
// ----------------------------------------------------------------------------
IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktStoryV2_Lightning_Equivalent,
	"HktCore.Story.V2.Lightning.Equivalent",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktStoryV2_Lightning_Equivalent::RunTest(const FString& Parameters)
{
	FHktStoryRegistry::InitializeAllStories();
	FString LoadErr;
	if (!EnsureV2StoryLoaded(TEXT("Combat/Lightning.json"), LoadErr)) { AddError(LoadErr); return false; }

	const FHktVMProgram* CppProg = FindProgramByName(TEXT("Story.Event.Skill.Lightning"));
	const FHktVMProgram* V2Prog  = FindProgramByName(TEXT("Story.V2.Event.Skill.Lightning"));
	TestNotNull(TEXT("cpp"), CppProg); TestNotNull(TEXT("V2"), V2Prog);
	if (!CppProg || !V2Prog) return false;

	auto RunOnce = [](const FHktVMProgram* P, int32& OutHp) -> EVMStatus
	{
		FHktAutomationTestHarness H; H.Setup();
		const FHktEntityId Self = H.CreateEntity();
		TMap<uint16, int32> Props;
		Props.Add(PropertyId::Health,    100);
		Props.Add(PropertyId::MaxHealth, 100);
		const FHktEntityId Target = H.CreateEntityWithProperties(Props);
		const EVMStatus St = H.ExecuteProgram(P, Self, Target, 500);
		OutHp = H.GetProperty(Target, PropertyId::Health);
		H.Teardown();
		return St;
	};

	int32 cH = -1, vH = -1;
	const EVMStatus CppSt = RunOnce(CppProg, cH);
	const EVMStatus V2St  = RunOnce(V2Prog,  vH);
	TestEqual(TEXT("status"), (int32)CppSt, (int32)V2St);
	TestEqual(TEXT("Target.Health (100 - 80)"), vH, cH);
	return true;
}

// ----------------------------------------------------------------------------
// CharacterSpawn — WaitSeconds + WaitAnimEnd (둘 다 Timer)
// ----------------------------------------------------------------------------
IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktStoryV2_CharacterSpawn_Equivalent,
	"HktCore.Story.V2.CharacterSpawn.Equivalent",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktStoryV2_CharacterSpawn_Equivalent::RunTest(const FString& Parameters)
{
	FHktStoryRegistry::InitializeAllStories();
	FString LoadErr;
	if (!EnsureV2StoryLoaded(TEXT("Lifecycle/CharacterSpawn.json"), LoadErr)) { AddError(LoadErr); return false; }

	const FHktVMProgram* CppProg = FindProgramByName(TEXT("Story.Flow.Character.Spawn"));
	const FHktVMProgram* V2Prog  = FindProgramByName(TEXT("Story.V2.Flow.Character.Spawn"));
	TestNotNull(TEXT("cpp"), CppProg); TestNotNull(TEXT("V2"), V2Prog);
	if (!CppProg || !V2Prog) return false;

	auto RunOnce = [](const FHktVMProgram* P, int32& OutN) -> EVMStatus
	{
		FHktAutomationTestHarness H; H.Setup();
		TMap<uint16, int32> Props;
		Props.Add(PropertyId::TargetPosX, 100);
		Props.Add(PropertyId::TargetPosY, 200);
		Props.Add(PropertyId::TargetPosZ, 0);
		const FHktEntityId Self = H.CreateEntityWithProperties(Props);
		const EVMStatus St = H.ExecuteProgram(P, Self, InvalidEntityId, 500);
		OutN = H.GetEntityCount();
		H.Teardown();
		return St;
	};

	int32 cN = -1, vN = -1;
	const EVMStatus CppSt = RunOnce(CppProg, cN);
	const EVMStatus V2St  = RunOnce(V2Prog,  vN);
	TestEqual(TEXT("status"), (int32)CppSt, (int32)V2St);
	TestEqual(TEXT("EntityCount (Self+Char+Sword+Shield)"), vN, cN);
	return true;
}

// ----------------------------------------------------------------------------
// NPCLifecycle — Self 에 StateDead 셋업 → 즉시 die 분기
// ----------------------------------------------------------------------------
IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktStoryV2_NPCLifecycle_Equivalent,
	"HktCore.Story.V2.NPCLifecycle.Equivalent",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktStoryV2_NPCLifecycle_Equivalent::RunTest(const FString& Parameters)
{
	FHktStoryRegistry::InitializeAllStories();
	FString LoadErr;
	if (!EnsureV2StoryLoaded(TEXT("Lifecycle/NPCLifecycle.json"), LoadErr)) { AddError(LoadErr); return false; }

	const FHktVMProgram* CppProg = FindProgramByName(TEXT("Story.Flow.NPC.Lifecycle"));
	const FHktVMProgram* V2Prog  = FindProgramByName(TEXT("Story.V2.Flow.NPC.Lifecycle"));
	TestNotNull(TEXT("cpp"), CppProg); TestNotNull(TEXT("V2"), V2Prog);
	if (!CppProg || !V2Prog) return false;

	const FGameplayTag DeadTag = FGameplayTag::RequestGameplayTag(FName(TEXT("State.Dead")), false);

	auto RunOnce = [&](const FHktVMProgram* P, int32& OutN) -> EVMStatus
	{
		FHktAutomationTestHarness H; H.Setup();
		const FHktEntityId Self = H.CreateEntity();
		// 사망 태그 사전 부여 — die 라벨 즉시 분기
		if (DeadTag.IsValid())
		{
			H.GetWorldState().AddTag(Self, DeadTag);
		}
		const EVMStatus St = H.ExecuteProgram(P, Self, InvalidEntityId, 500);
		OutN = H.GetEntityCount();
		H.Teardown();
		return St;
	};

	int32 cN = -1, vN = -1;
	const EVMStatus CppSt = RunOnce(CppProg, cN);
	const EVMStatus V2St  = RunOnce(V2Prog,  vN);
	TestEqual(TEXT("status"), (int32)CppSt, (int32)V2St);
	TestEqual(TEXT("EntityCount (drop + Self destroyed)"), vN, cN);
	return true;
}

// ----------------------------------------------------------------------------
// DebrisLifecycle — die 분기 (StateDead 사전 부여)
// ----------------------------------------------------------------------------
IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktStoryV2_DebrisLifecycle_Equivalent,
	"HktCore.Story.V2.DebrisLifecycle.Equivalent",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktStoryV2_DebrisLifecycle_Equivalent::RunTest(const FString& Parameters)
{
	FHktStoryRegistry::InitializeAllStories();
	FString LoadErr;
	if (!EnsureV2StoryLoaded(TEXT("Lifecycle/DebrisLifecycle.json"), LoadErr)) { AddError(LoadErr); return false; }

	const FHktVMProgram* CppProg = FindProgramByName(TEXT("Story.Flow.Debris.Lifecycle"));
	const FHktVMProgram* V2Prog  = FindProgramByName(TEXT("Story.V2.Flow.Debris.Lifecycle"));
	TestNotNull(TEXT("cpp"), CppProg); TestNotNull(TEXT("V2"), V2Prog);
	if (!CppProg || !V2Prog) return false;

	const FGameplayTag DeadTag = FGameplayTag::RequestGameplayTag(FName(TEXT("State.Dead")), false);

	auto RunOnce = [&](const FHktVMProgram* P, int32& OutVz) -> EVMStatus
	{
		FHktAutomationTestHarness H; H.Setup();
		TMap<uint16, int32> Props;
		Props.Add(PropertyId::IsGrounded, 1);
		Props.Add(PropertyId::VelZ, 0);
		const FHktEntityId Self = H.CreateEntityWithProperties(Props);
		if (DeadTag.IsValid()) { H.GetWorldState().AddTag(Self, DeadTag); }
		// die 분기 진입 → WriteConst VelZ=200 → WaitSeconds(3.0) 직전에서 멈춰야 함.
		// ExecuteProgram 으로 끝까지 가면 DestroyEntity(Self) 가 발화하여 Self 슬롯이 무효화되고
		// 이후 GetProperty 가 IsValidEntity ensure 실패. ExecuteUntilWait 로 Timer 를 자동 소화하다가
		// MaxTicks 한도(10) 내에서 종료 — 3초 Timer 는 60fps 기준 188틱 필요하므로 절대 완료되지 않음.
		EWaitEventType WaitKind = EWaitEventType::None;
		const EVMStatus St = H.ExecuteUntilWait(P, Self, InvalidEntityId, /*MaxTicks=*/10, WaitKind);
		OutVz = H.GetProperty(Self, PropertyId::VelZ);
		H.Teardown();
		return St;
	};

	int32 cV = -1, vV = -1;
	const EVMStatus CppSt = RunOnce(CppProg, cV);
	const EVMStatus V2St  = RunOnce(V2Prog,  vV);
	// Phase 2c 의 본질은 cpp/V2 등가성. 자동화 컨텍스트에서 State.Dead 태그가 RequestGameplayTag
	// 로 invalid 반환될 가능성이 있어 die 분기 진입을 보장할 수 없음 — 이 경우 cpp/V2 모두 동일하게
	// TTL WaitSeconds(1.0) 에서 timer-stuck 한다. 등가성만 검증하면 충분.
	TestEqual(TEXT("status"), (int32)CppSt, (int32)V2St);
	TestEqual(TEXT("VelZ 동등"), vV, cV);
	return true;
}

// ----------------------------------------------------------------------------
// MoveTo — WaitMoveEnd 발생 — InjectMoveEndEvent 로 해소
// ----------------------------------------------------------------------------
IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktStoryV2_MoveTo_Equivalent,
	"HktCore.Story.V2.MoveTo.Equivalent",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktStoryV2_MoveTo_Equivalent::RunTest(const FString& Parameters)
{
	FHktStoryRegistry::InitializeAllStories();
	FString LoadErr;
	if (!EnsureV2StoryLoaded(TEXT("Movement/MoveTo.json"), LoadErr)) { AddError(LoadErr); return false; }

	const FHktVMProgram* CppProg = FindProgramByName(TEXT("Story.Event.Move.ToLocation"));
	const FHktVMProgram* V2Prog  = FindProgramByName(TEXT("Story.V2.Event.Move.ToLocation"));
	TestNotNull(TEXT("cpp"), CppProg); TestNotNull(TEXT("V2"), V2Prog);
	if (!CppProg || !V2Prog) return false;

	auto RunOnce = [](const FHktVMProgram* P, int32& OutMF, int32& OutIM) -> EVMStatus
	{
		FHktAutomationTestHarness H; H.Setup();
		TMap<uint16, int32> Props;
		Props.Add(PropertyId::TargetPosX, 1000);
		Props.Add(PropertyId::TargetPosY, 0);
		Props.Add(PropertyId::TargetPosZ, 0);
		const FHktEntityId Self = H.CreateEntityWithProperties(Props);

		EWaitEventType Kind = EWaitEventType::None;
		EVMStatus St = H.ExecuteUntilWait(P, Self, InvalidEntityId, 500, Kind);
		// MoveToward 후 WaitMoveEnd 가 첫 비-Timer wait. 외부 주입.
		if (St == EVMStatus::WaitingEvent && Kind == EWaitEventType::MoveEnd)
		{
			H.InjectMoveEndEvent();
			St = H.ResumeUntilDone(500);
		}
		OutMF = H.GetProperty(Self, PropertyId::MoveForce);
		OutIM = H.GetProperty(Self, PropertyId::IsMoving);
		H.Teardown();
		return St;
	};

	int32 cMF = -1, cIM = -1, vMF = -1, vIM = -1;
	const EVMStatus CppSt = RunOnce(CppProg, cMF, cIM);
	const EVMStatus V2St  = RunOnce(V2Prog,  vMF, vIM);
	TestEqual(TEXT("status"), (int32)CppSt, (int32)V2St);
	TestEqual(TEXT("MoveForce (StopMovement 후)"), vMF, cMF);
	TestEqual(TEXT("IsMoving (StopMovement 후)"),  vIM, cIM);
	return true;
}

// ----------------------------------------------------------------------------
// VoxelShatter — 동기 Halt (Wait 없음). Debris 1개 추가 확인.
// ----------------------------------------------------------------------------
IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktStoryV2_VoxelShatter_Equivalent,
	"HktCore.Story.V2.VoxelShatter.Equivalent",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktStoryV2_VoxelShatter_Equivalent::RunTest(const FString& Parameters)
{
	FHktStoryRegistry::InitializeAllStories();
	FString LoadErr;
	if (!EnsureV2StoryLoaded(TEXT("Voxel/VoxelShatter.json"), LoadErr)) { AddError(LoadErr); return false; }

	const FHktVMProgram* CppProg = FindProgramByName(TEXT("Story.Voxel.Shatter"));
	const FHktVMProgram* V2Prog  = FindProgramByName(TEXT("Story.V2.Voxel.Shatter"));
	TestNotNull(TEXT("cpp"), CppProg); TestNotNull(TEXT("V2"), V2Prog);
	if (!CppProg || !V2Prog) return false;

	auto RunOnce = [](const FHktVMProgram* P, int32& OutN) -> EVMStatus
	{
		FHktAutomationTestHarness H; H.Setup();
		TMap<uint16, int32> Props;
		Props.Add(PropertyId::TargetPosX, 1000);
		Props.Add(PropertyId::TargetPosY, 2000);
		Props.Add(PropertyId::TargetPosZ, 500);
		Props.Add(PropertyId::Param0,     7);
		const FHktEntityId Self = H.CreateEntityWithProperties(Props);
		const EVMStatus St = H.ExecuteProgram(P, Self, InvalidEntityId, 500);
		OutN = H.GetEntityCount();
		H.Teardown();
		return St;
	};

	int32 cN = -1, vN = -1;
	const EVMStatus CppSt = RunOnce(CppProg, cN);
	const EVMStatus V2St  = RunOnce(V2Prog,  vN);
	TestEqual(TEXT("status"), (int32)CppSt, (int32)V2St);
	TestEqual(TEXT("EntityCount (Self+DebrisGlass)"), vN, cN);
	return true;
}

// ----------------------------------------------------------------------------
// NPCSpawnerGoblinCamp — 무한 루프. 한 사이클 끝(WaitSeconds 직전)에서 비교.
// ----------------------------------------------------------------------------
IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktStoryV2_NPCSpawnerGoblinCamp_Equivalent,
	"HktCore.Story.V2.NPCSpawnerGoblinCamp.Equivalent",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktStoryV2_NPCSpawnerGoblinCamp_Equivalent::RunTest(const FString& Parameters)
{
	FHktStoryRegistry::InitializeAllStories();
	FString LoadErr;
	if (!EnsureV2StoryLoaded(TEXT("NPC/Spawners/GoblinCamp.json"), LoadErr)) { AddError(LoadErr); return false; }

	const FHktVMProgram* CppProg = FindProgramByName(TEXT("Story.Flow.Spawner.GoblinCamp"));
	const FHktVMProgram* V2Prog  = FindProgramByName(TEXT("Story.V2.Flow.Spawner.GoblinCamp"));
	TestNotNull(TEXT("cpp"), CppProg); TestNotNull(TEXT("V2"), V2Prog);
	if (!CppProg || !V2Prog) return false;

	auto RunOnce = [](const FHktVMProgram* P) -> int32
	{
		FHktAutomationTestHarness H; H.Setup();
		TMap<uint16, int32> Props;
		Props.Add(PropertyId::Param0, 500);
		Props.Add(PropertyId::Param1, 700);
		const FHktEntityId Self = H.CreateEntityWithProperties(Props);
		EWaitEventType Kind = EWaitEventType::None;
		H.ExecuteUntilWait(P, Self, InvalidEntityId, 500, Kind);
		const int32 N = H.GetEntityCount();
		H.Teardown();
		return N;
	};

	const int32 cN = RunOnce(CppProg);
	const int32 vN = RunOnce(V2Prog);
	TestEqual(TEXT("EntityCount 한 사이클"), vN, cN);
	return true;
}

// ----------------------------------------------------------------------------
// NPCSpawnerProximity — Self 1개만, HasPlayerInGroup 미충족 시 sleep 분기.
// ----------------------------------------------------------------------------
IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktStoryV2_NPCSpawnerProximity_Equivalent,
	"HktCore.Story.V2.NPCSpawnerProximity.Equivalent",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktStoryV2_NPCSpawnerProximity_Equivalent::RunTest(const FString& Parameters)
{
	FHktStoryRegistry::InitializeAllStories();
	FString LoadErr;
	if (!EnsureV2StoryLoaded(TEXT("NPC/Spawners/Proximity.json"), LoadErr)) { AddError(LoadErr); return false; }

	const FHktVMProgram* CppProg = FindProgramByName(TEXT("Story.Flow.Spawner.DungeonEntrance"));
	const FHktVMProgram* V2Prog  = FindProgramByName(TEXT("Story.V2.Flow.Spawner.DungeonEntrance"));
	TestNotNull(TEXT("cpp"), CppProg); TestNotNull(TEXT("V2"), V2Prog);
	if (!CppProg || !V2Prog) return false;

	auto RunOnce = [](const FHktVMProgram* P) -> int32
	{
		FHktAutomationTestHarness H; H.Setup();
		const FHktEntityId Self = H.CreateEntity();
		EWaitEventType Kind = EWaitEventType::None;
		H.ExecuteUntilWait(P, Self, InvalidEntityId, 500, Kind);
		const int32 N = H.GetEntityCount();
		H.Teardown();
		return N;
	};
	const int32 cN = RunOnce(CppProg);
	const int32 vN = RunOnce(V2Prog);
	TestEqual(TEXT("EntityCount"), vN, cN);
	return true;
}

// ----------------------------------------------------------------------------
// NPCSpawnerWave — Wave1 Repeat(3) 후 WaitUntilCountZero (비-Timer Yield).
// 한 사이클 멈춤 시점 EntityCount 비교.
// ----------------------------------------------------------------------------
IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FHktStoryV2_NPCSpawnerWave_Equivalent,
	"HktCore.Story.V2.NPCSpawnerWave.Equivalent",
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FHktStoryV2_NPCSpawnerWave_Equivalent::RunTest(const FString& Parameters)
{
	FHktStoryRegistry::InitializeAllStories();
	FString LoadErr;
	if (!EnsureV2StoryLoaded(TEXT("NPC/Spawners/Wave.json"), LoadErr)) { AddError(LoadErr); return false; }

	const FHktVMProgram* CppProg = FindProgramByName(TEXT("Story.Flow.Spawner.Wave.Arena"));
	const FHktVMProgram* V2Prog  = FindProgramByName(TEXT("Story.V2.Flow.Spawner.Wave.Arena"));
	TestNotNull(TEXT("cpp"), CppProg); TestNotNull(TEXT("V2"), V2Prog);
	if (!CppProg || !V2Prog) return false;

	auto RunOnce = [](const FHktVMProgram* P) -> int32
	{
		FHktAutomationTestHarness H; H.Setup();
		TMap<uint16, int32> Props;
		Props.Add(PropertyId::Param0, 500);
		Props.Add(PropertyId::Param1, 700);
		const FHktEntityId Self = H.CreateEntityWithProperties(Props);
		EWaitEventType Kind = EWaitEventType::None;
		H.ExecuteUntilWait(P, Self, InvalidEntityId, 500, Kind);
		const int32 N = H.GetEntityCount();
		H.Teardown();
		return N;
	};
	const int32 cN = RunOnce(CppProg);
	const int32 vN = RunOnce(V2Prog);
	TestEqual(TEXT("EntityCount (Self+goblin*3)"), vN, cN);
	return true;
}

// ----------------------------------------------------------------------------
// ItemSpawner — 5개. 모두 같은 패턴 (한 사이클 EntityCount 비교).
// ----------------------------------------------------------------------------
#define HKT_DEFINE_ITEM_SPAWNER_TEST(Name, JsonRel, CppTagStr, V2TagStr) \
IMPLEMENT_SIMPLE_AUTOMATION_TEST( \
	FHktStoryV2_ItemSpawner##Name##_Equivalent, \
	"HktCore.Story.V2.ItemSpawner" #Name ".Equivalent", \
	EAutomationTestFlags_ApplicationContextMask | EAutomationTestFlags::ProductFilter) \
bool FHktStoryV2_ItemSpawner##Name##_Equivalent::RunTest(const FString& Parameters) \
{ \
	FHktStoryRegistry::InitializeAllStories(); \
	FString LoadErr; \
	if (!EnsureV2StoryLoaded(TEXT(JsonRel), LoadErr)) { AddError(LoadErr); return false; } \
	const FHktVMProgram* CppProg = FindProgramByName(TEXT(CppTagStr)); \
	const FHktVMProgram* V2Prog  = FindProgramByName(TEXT(V2TagStr)); \
	TestNotNull(TEXT("cpp"), CppProg); TestNotNull(TEXT("V2"), V2Prog); \
	if (!CppProg || !V2Prog) return false; \
	auto RunOnce = [](const FHktVMProgram* P) -> int32 { \
		FHktAutomationTestHarness H; H.Setup(); \
		TMap<uint16, int32> Props; \
		Props.Add(PropertyId::Param0, 500); \
		Props.Add(PropertyId::Param1, 700); \
		const FHktEntityId Self = H.CreateEntityWithProperties(Props); \
		EWaitEventType Kind = EWaitEventType::None; \
		H.ExecuteUntilWait(P, Self, InvalidEntityId, 500, Kind); \
		const int32 N = H.GetEntityCount(); \
		H.Teardown(); \
		return N; \
	}; \
	const int32 cN = RunOnce(CppProg); \
	const int32 vN = RunOnce(V2Prog); \
	TestEqual(TEXT("EntityCount 한 사이클"), vN, cN); \
	return true; \
}

HKT_DEFINE_ITEM_SPAWNER_TEST(AncientStaff,
	"Item/Spawners/AncientStaff.json",
	"Story.Flow.Spawner.Item.AncientStaff",
	"Story.V2.Flow.Spawner.Item.AncientStaff")

HKT_DEFINE_ITEM_SPAWNER_TEST(Bandage,
	"Item/Spawners/Bandage.json",
	"Story.Flow.Spawner.Item.Bandage",
	"Story.V2.Flow.Spawner.Item.Bandage")

HKT_DEFINE_ITEM_SPAWNER_TEST(ThunderHammer,
	"Item/Spawners/ThunderHammer.json",
	"Story.Flow.Spawner.Item.ThunderHammer",
	"Story.V2.Flow.Spawner.Item.ThunderHammer")

HKT_DEFINE_ITEM_SPAWNER_TEST(TreeDrop,
	"Item/Spawners/TreeDrop.json",
	"Story.Flow.Spawner.Item.TreeDrop",
	"Story.V2.Flow.Spawner.Item.TreeDrop")

HKT_DEFINE_ITEM_SPAWNER_TEST(WingsOfFreedom,
	"Item/Spawners/WingsOfFreedom.json",
	"Story.Flow.Spawner.Item.WingsOfFreedom",
	"Story.V2.Flow.Spawner.Item.WingsOfFreedom")

#undef HKT_DEFINE_ITEM_SPAWNER_TEST

#endif // WITH_AUTOMATION_TESTS
