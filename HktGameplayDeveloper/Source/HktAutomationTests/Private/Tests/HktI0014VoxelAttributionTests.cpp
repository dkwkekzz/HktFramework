// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktAutomationTestsLog.h"
#include "HktAutomationTestsTypes.h"
#include "HktStoryEventParams.h"
#include "Terrain/HktTerrainDataSource.h"

/**
 * I-0014 Voxel Attribution Builder — 두 입구 합류 검증.
 *
 * Phase A/B 가 자연 발생 경로 (BakedAsset attribution → FHktTerrainSystem::Process)
 * 를, Phase C 가 트리거 경로 (`HktEventBuilder::VoxelTemplateActivatedAt`) 를 정의.
 * 본 테스트는 두 경로가 동일 voxel 좌표에 대해 *형식적으로 동일한 FHktEvent* 를
 * 산출함을 검증하여 "voxel 한 점에서 합류" 의도를 코드로 못박는다.
 *
 * 추가로 I-0017 결정론 시드 (voxel 좌표 한 곳에서만 파생) 도 함께 검증.
 */
namespace HktOpcodeTests
{

namespace
{
	constexpr float TestVoxelSizeCm = 15.0f;

	FGameplayTag TestTemplateTag()
	{
		return FGameplayTag::RequestGameplayTag(
			FName(TEXT("Story.Flow.Spawner.Natural.Oak")), false);
	}

	bool EventsEqual(const FHktEvent& A, const FHktEvent& B)
	{
		return A.EventTag == B.EventTag
			&& A.Param0 == B.Param0
			&& A.Param1 == B.Param1
			&& A.Param2 == B.Param2
			&& A.Param3 == B.Param3
			&& A.Location.Equals(B.Location, 0.0001);
	}
}

// ============================================================================
// 두 입구 합류 — VoxelTemplateActivated(view) vs VoxelTemplateActivatedAt(coord)
// ============================================================================

static FHktTestResult Test_VoxelTemplate_TwoEntriesProduceSameEvent()
{
	const FGameplayTag TemplateTag = TestTemplateTag();
	if (!TemplateTag.IsValid())
	{
		return FHktTestResult::Pass(TEXT("VoxelTemplate.TwoEntriesProduceSameEvent (skipped: tag unregistered)"));
	}

	// 자연 발생 경로: Provider 가 만드는 View 를 모사
	FHktVoxelAttributionView View;
	View.VoxelWorldX = 42;
	View.VoxelWorldY = -17;
	View.VoxelWorldZ = 8;
	View.StoryTag    = TemplateTag;
	View.SlotHash31  = HktEventBuilder::ComputeVoxelSlotHash31(
		View.VoxelWorldX, View.VoxelWorldY, View.VoxelWorldZ);

	const FHktEvent NaturalEvent = HktEventBuilder::VoxelTemplateActivated(View, TestVoxelSizeCm);

	// 트리거 경로: caller 가 voxel 좌표만 직접 전달
	const FHktEvent TriggerEvent = HktEventBuilder::VoxelTemplateActivatedAt(
		TemplateTag, View.VoxelWorldX, View.VoxelWorldY, View.VoxelWorldZ, TestVoxelSizeCm);

	if (!EventsEqual(NaturalEvent, TriggerEvent))
	{
		return FHktTestResult::Fail(TEXT("VoxelTemplate.TwoEntriesProduceSameEvent"),
			TEXT("Natural / Trigger paths produced different FHktEvent for same voxel"));
	}

	return FHktTestResult::Pass(TEXT("VoxelTemplate.TwoEntriesProduceSameEvent"));
}

// ============================================================================
// Param 슬롯 매핑 — VoxelTemplateParams:: 컨벤션 준수
// ============================================================================

static FHktTestResult Test_VoxelTemplate_ParamSlotMapping()
{
	const FGameplayTag TemplateTag = TestTemplateTag();
	if (!TemplateTag.IsValid())
	{
		return FHktTestResult::Pass(TEXT("VoxelTemplate.ParamSlotMapping (skipped: tag unregistered)"));
	}

	const int32 VoxelX = 10, VoxelY = 20, VoxelZ = 30;
	const FHktEvent E = HktEventBuilder::VoxelTemplateActivatedAt(
		TemplateTag, VoxelX, VoxelY, VoxelZ, TestVoxelSizeCm);

	// VoxelTemplateParams::VoxelCmX = Param0, VoxelCmY = Param1, SlotHash31 = Param2, VoxelCmZ = Param3
	// XY 는 column 중심, Z 는 SOLID 표면 상단면 (bake attribution 의 top-most non-air voxel
	// 좌표 위에 entity 가 서도록) — HktStoryEventParams.h `VoxelTemplateActivatedAt` 참조.
	const float Half = TestVoxelSizeCm * 0.5f;
	const int32 ExpectedCmX = FMath::RoundToInt(VoxelX * TestVoxelSizeCm + Half);
	const int32 ExpectedCmY = FMath::RoundToInt(VoxelY * TestVoxelSizeCm + Half);
	const int32 ExpectedCmZ = FMath::RoundToInt((VoxelZ + 1) * TestVoxelSizeCm);
	const int32 ExpectedHash31 = static_cast<int32>(
		HktEventBuilder::ComputeVoxelSlotHash31(VoxelX, VoxelY, VoxelZ));

	if (E.EventTag != TemplateTag)
		return FHktTestResult::Fail(TEXT("VoxelTemplate.ParamSlotMapping"), TEXT("EventTag != TemplateTag"));
	if (E.Param0 != ExpectedCmX)
		return FHktTestResult::Fail(TEXT("VoxelTemplate.ParamSlotMapping"), TEXT("Param0 (VoxelCmX) mismatch"));
	if (E.Param1 != ExpectedCmY)
		return FHktTestResult::Fail(TEXT("VoxelTemplate.ParamSlotMapping"), TEXT("Param1 (VoxelCmY) mismatch"));
	if (E.Param2 != ExpectedHash31)
		return FHktTestResult::Fail(TEXT("VoxelTemplate.ParamSlotMapping"), TEXT("Param2 (SlotHash31) mismatch"));
	if (E.Param3 != ExpectedCmZ)
		return FHktTestResult::Fail(TEXT("VoxelTemplate.ParamSlotMapping"), TEXT("Param3 (VoxelCmZ) mismatch"));
	if (!E.Location.Equals(FVector(ExpectedCmX, ExpectedCmY, ExpectedCmZ), 0.0001))
		return FHktTestResult::Fail(TEXT("VoxelTemplate.ParamSlotMapping"), TEXT("Location mismatch"));

	return FHktTestResult::Pass(TEXT("VoxelTemplate.ParamSlotMapping"));
}

// ============================================================================
// 시드 결정성 (I-0017) — 동일 voxel → 동일 SlotHash31, 다른 voxel → 다른 hash
// ============================================================================

static FHktTestResult Test_SlotHash31_Deterministic()
{
	const uint32 H1 = HktEventBuilder::ComputeVoxelSlotHash31(100, 200, 300);
	const uint32 H2 = HktEventBuilder::ComputeVoxelSlotHash31(100, 200, 300);
	if (H1 != H2)
		return FHktTestResult::Fail(TEXT("SlotHash31.Deterministic"),
			TEXT("동일 voxel 좌표가 서로 다른 SlotHash31 산출 — 결정론 위반"));

	// MSB clear (31bit)
	if ((H1 & 0x80000000u) != 0)
		return FHktTestResult::Fail(TEXT("SlotHash31.Deterministic"),
			TEXT("SlotHash31 MSB 가 set — 31bit 범위 위반"));

	return FHktTestResult::Pass(TEXT("SlotHash31.Deterministic"));
}

static FHktTestResult Test_SlotHash31_DistinguishesCoords()
{
	const uint32 HA = HktEventBuilder::ComputeVoxelSlotHash31(0, 0, 0);
	const uint32 HB = HktEventBuilder::ComputeVoxelSlotHash31(1, 0, 0);
	const uint32 HC = HktEventBuilder::ComputeVoxelSlotHash31(0, 1, 0);
	const uint32 HD = HktEventBuilder::ComputeVoxelSlotHash31(0, 0, 1);

	// 4개 모두 다르길 기대 — hash 충돌 가능성은 무시할 수준
	const bool bAllDistinct = (HA != HB) && (HA != HC) && (HA != HD)
	                       && (HB != HC) && (HB != HD) && (HC != HD);
	if (!bAllDistinct)
	{
		return FHktTestResult::Fail(TEXT("SlotHash31.DistinguishesCoords"),
			TEXT("인접 voxel 좌표가 동일 hash 산출 — 결정론 분기 약화"));
	}

	return FHktTestResult::Pass(TEXT("SlotHash31.DistinguishesCoords"));
}

// ============================================================================
// 트리거 caller 가 voxel 좌표만으로 자연 발생과 동일 시드 산출 (I-0017 합류)
// ============================================================================

static FHktTestResult Test_VoxelTemplate_TriggerMatchesNaturalSeed()
{
	const FGameplayTag TemplateTag = TestTemplateTag();
	if (!TemplateTag.IsValid())
	{
		return FHktTestResult::Pass(TEXT("VoxelTemplate.TriggerMatchesNaturalSeed (skipped: tag unregistered)"));
	}

	const int32 X = -5, Y = 7, Z = 12;

	// Provider 가 산출하는 SlotHash31
	const uint32 ProviderSeed = HktEventBuilder::ComputeVoxelSlotHash31(X, Y, Z);

	// 트리거 caller 가 ::At 헬퍼만 호출했을 때 Param2 에 들어가는 SlotHash31
	const FHktEvent E = HktEventBuilder::VoxelTemplateActivatedAt(TemplateTag, X, Y, Z, TestVoxelSizeCm);
	const uint32 TriggerSeed = static_cast<uint32>(E.Param2);

	if (ProviderSeed != TriggerSeed)
	{
		return FHktTestResult::Fail(TEXT("VoxelTemplate.TriggerMatchesNaturalSeed"),
			TEXT("Provider 와 트리거 caller 의 SlotHash31 산출이 불일치 — 단일 출처 위반"));
	}

	return FHktTestResult::Pass(TEXT("VoxelTemplate.TriggerMatchesNaturalSeed"));
}

// ============================================================================
// Public
// ============================================================================

FHktTestReport RunI0014VoxelAttributionTests()
{
	FHktTestReport Report;
	Report.Add(Test_VoxelTemplate_TwoEntriesProduceSameEvent());
	Report.Add(Test_VoxelTemplate_ParamSlotMapping());
	Report.Add(Test_SlotHash31_Deterministic());
	Report.Add(Test_SlotHash31_DistinguishesCoords());
	Report.Add(Test_VoxelTemplate_TriggerMatchesNaturalSeed());
	return Report;
}

} // namespace HktOpcodeTests
