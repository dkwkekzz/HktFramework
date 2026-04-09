// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktDeconstructTypes.generated.h"

// ============================================================================
// Deconstruction Element — Niagara 비주얼 테마를 결정하는 5종
// ============================================================================
UENUM(BlueprintType)
enum class EHktDeconstructElement : uint8
{
	Fire,
	Ice,
	Lightning,
	Void,
	Nature,
	Count UMETA(Hidden)
};

// ============================================================================
// Element별 색상 팔레트
// ============================================================================
USTRUCT(BlueprintType)
struct FHktDeconstructPalette
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Deconstruct|Palette")
	FLinearColor Primary = FLinearColor::White;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Deconstruct|Palette")
	FLinearColor Secondary = FLinearColor::White;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Deconstruct|Palette")
	FLinearColor Accent = FLinearColor::White;
};

// ============================================================================
// Niagara User Parameter로 전달할 런타임 상태
// ============================================================================
USTRUCT(BlueprintType)
struct FHktDeconstructParams
{
	GENERATED_BODY()

	// 형태 유지도 (1=원형, 0=완전 분해). HealthRatio 연동.
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Deconstruct", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float Coherence = 1.0f;

	// 포인트 이탈 거리(cm). 분해/조립 연출 핵심.
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Deconstruct", meta = (ClampMin = "0.0", ClampMax = "50.0"))
	float PointScatter = 0.0f;

	// 전체 버텍스 중 표시 비율 (0~1). HealthRatio 연동.
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Deconstruct", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float PointDensity = 1.0f;

	// 파편 회전/노이즈 강도 (0~1). 전투 상태 연동.
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Deconstruct", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float Agitation = 0.0f;

	// 기본 발광 색상 (팔레트 Primary)
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Deconstruct")
	FLinearColor BaseColor = FLinearColor::White;

	// Secondary 색상
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Deconstruct")
	FLinearColor SecondaryColor = FLinearColor::White;

	// Accent 색상
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Deconstruct")
	FLinearColor AccentColor = FLinearColor::White;

	// 밝기 맥동 속도(Hz)
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Deconstruct", meta = (ClampMin = "0.0", ClampMax = "10.0"))
	float PulseRate = 1.0f;

	// 잔상 지속 시간(초)
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Deconstruct", meta = (ClampMin = "0.02", ClampMax = "0.15"))
	float TrailLifetime = 0.05f;

	// 리본 폭 배율
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Deconstruct", meta = (ClampMin = "0.0", ClampMax = "5.0"))
	float RibbonWidthMult = 1.0f;

	// 리본 Emissive 배율
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Deconstruct", meta = (ClampMin = "0.0", ClampMax = "10.0"))
	float RibbonEmissiveMult = 1.0f;

	// Aura 속도 배율
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Deconstruct", meta = (ClampMin = "0.0", ClampMax = "5.0"))
	float AuraVelocityMult = 1.0f;

	// Aura 스폰 레이트 배율
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Deconstruct", meta = (ClampMin = "0.0", ClampMax = "5.0"))
	float AuraSpawnRateMult = 1.0f;

	// GeoFragment 스케일 배율
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Deconstruct", meta = (ClampMin = "0.0", ClampMax = "3.0"))
	float FragmentScaleMult = 1.0f;
};

// ============================================================================
// 보간/매핑/연출 튜닝 파라미터 (DataAsset에서 에디터 조정 가능)
// ============================================================================
USTRUCT(BlueprintType)
struct FHktDeconstructTuning
{
	GENERATED_BODY()

	// --- 보간 속도 (높을수록 빠르게 수렴) ---
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Tuning|Interp", meta = (ClampMin = "0.1", ClampMax = "20.0"))
	float InterpSpeed_Coherence = 2.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Tuning|Interp", meta = (ClampMin = "0.1", ClampMax = "20.0"))
	float InterpSpeed_Scatter = 2.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Tuning|Interp", meta = (ClampMin = "0.1", ClampMax = "20.0"))
	float InterpSpeed_Agitation = 4.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Tuning|Interp", meta = (ClampMin = "0.1", ClampMax = "20.0"))
	float InterpSpeed_Multipliers = 6.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Tuning|Interp", meta = (ClampMin = "0.1", ClampMax = "20.0"))
	float InterpSpeed_AgitationDecay = 2.0f;

	// --- 매핑 상수 ---
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Tuning|Mapping", meta = (ClampMin = "1.0", ClampMax = "200.0"))
	float MaxPointScatter = 50.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Tuning|Mapping", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float MinPointDensity = 0.3f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Tuning|Mapping", meta = (ClampMin = "0.1", ClampMax = "20.0"))
	float DamageToAgitationScale = 5.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Tuning|Mapping", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float MaxAgitationFromMovement = 0.3f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Tuning|Mapping", meta = (ClampMin = "100.0", ClampMax = "2000.0"))
	float MovementSpeedRef = 600.0f;

	// --- 스킬 스파이크 값 ---
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Tuning|Skill", meta = (ClampMin = "0.0", ClampMax = "10.0"))
	float SkillRibbonWidthMult = 3.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Tuning|Skill", meta = (ClampMin = "0.0", ClampMax = "20.0"))
	float SkillRibbonEmissiveMult = 5.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Tuning|Skill", meta = (ClampMin = "0.0", ClampMax = "10.0"))
	float SkillFragmentScaleMult = 2.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Tuning|Skill", meta = (ClampMin = "0.0", ClampMax = "10.0"))
	float SkillAuraVelMult = 3.0f;

	// --- 사망 연출 값 ---
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Tuning|Death", meta = (ClampMin = "0.0", ClampMax = "10.0"))
	float DeathAuraSpawnMult = 3.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Tuning|Death", meta = (ClampMin = "0.0", ClampMax = "10.0"))
	float DeathAuraVelMult = 2.0f;
};

// ============================================================================
// EHktVFXElement → EHktDeconstructElement 변환
// ============================================================================
enum class EHktVFXElement : uint8;

HKTPRESENTATION_API EHktDeconstructElement HktMapVFXElementToDeconstruct(EHktVFXElement InElement);

// ============================================================================
// Element별 기본 팔레트 (하드코딩 폴백)
// ============================================================================
namespace HktDeconstructDefaults
{
	inline FHktDeconstructPalette GetDefaultPalette(EHktDeconstructElement Element)
	{
		switch (Element)
		{
		case EHktDeconstructElement::Fire:
			return { FLinearColor(1.0f, 0.271f, 0.0f), FLinearColor(1.0f, 0.549f, 0.0f), FLinearColor(1.0f, 0.843f, 0.0f) };
		case EHktDeconstructElement::Ice:
			return { FLinearColor(0.529f, 0.808f, 0.922f), FLinearColor(1.0f, 1.0f, 1.0f), FLinearColor(0.867f, 0.627f, 0.867f) };
		case EHktDeconstructElement::Lightning:
			return { FLinearColor(0.576f, 0.439f, 0.859f), FLinearColor(1.0f, 1.0f, 1.0f), FLinearColor(0.678f, 0.847f, 0.902f) };
		case EHktDeconstructElement::Void:
			return { FLinearColor(0.102f, 0.0f, 0.2f), FLinearColor(0.545f, 0.0f, 0.545f), FLinearColor(0.29f, 0.0f, 0.0f) };
		case EHktDeconstructElement::Nature:
			return { FLinearColor(0.133f, 0.545f, 0.133f), FLinearColor(0.565f, 0.933f, 0.565f), FLinearColor(1.0f, 0.843f, 0.0f) };
		default:
			return {};
		}
	}
}
