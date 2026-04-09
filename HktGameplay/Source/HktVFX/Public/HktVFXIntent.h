// Copyright Hkt Studios, Inc. All Rights Reserved.

// 프로그래머가 작성하는 유일한 부분: 무슨 일이 일어나는지 "의미"만 기술
// 비주얼은 AI가 결정함

#pragma once

#include "CoreMinimal.h"
#include "HktVFXIntent.generated.h"

// ============================================================================
// 이벤트 타입 - 시뮬레이션에서 어떤 일이 일어났는가
// ============================================================================
UENUM(BlueprintType)
enum class EHktVFXEventType : uint8
{
    Explosion,        // 폭발
    ProjectileHit,    // 투사체 적중
    ProjectileTrail,  // 투사체 궤적
    AreaEffect,       // 장판/범위 효과
    Buff,             // 버프
    Debuff,           // 디버프
    Heal,             // 힐
    Summon,           // 소환
    Teleport,         // 텔레포트
    Shield,           // 방어막
    Channel,          // 채널링 (지속 시전)
    Death,            // 사망
    LevelUp,          // 레벨업
    Custom,           // 커스텀 (Description 필드 사용)
};

// ============================================================================
// 속성 - 시각적 테마를 결정하는 핵심 요소
// ============================================================================
UENUM(BlueprintType)
enum class EHktVFXElement : uint8
{
    Fire,
    Ice,
    Lightning,
    Water,
    Earth,
    Wind,
    Dark,
    Holy,
    Poison,
    Arcane,
    Physical,   // 물리 (돌, 금속 파편 등)
    Nature,     // 자연 (잎, 꽃 등)
    Custom,
};

// ============================================================================
// 표면 타입 - 충돌 시 어떤 바닥인가
// ============================================================================
UENUM(BlueprintType)
enum class EHktVFXSurfaceType : uint8
{
    None,
    Stone,
    Metal,
    Wood,
    Dirt,
    Sand,
    Water,
    Snow,
    Grass,
};

// ============================================================================
// FHktVFXIntent - 프로그래머가 채우는 메인 구조체
// ============================================================================
USTRUCT(BlueprintType)
struct HKTVFX_API FHktVFXIntent
{
    GENERATED_BODY()

    // --- 핵심 파라미터 (필수) ---

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Intent|Core")
    EHktVFXEventType EventType = EHktVFXEventType::Explosion;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Intent|Core")
    EHktVFXElement Element = EHktVFXElement::Fire;

    // 0.0 ~ 1.0, 시뮬레이션의 데미지/힐량 등을 정규화한 값
    // 0.1 = 약한 이펙트, 1.0 = 최대 강도
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Intent|Core", meta=(ClampMin="0.0", ClampMax="1.0"))
    float Intensity = 0.5f;

    // --- 공간 파라미터 ---

    // 영향 범위 (언리얼 유닛). 0이면 점 이펙트
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Intent|Spatial")
    float Radius = 200.f;

    // 지속 시간 (초). 0이면 원샷
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Intent|Spatial")
    float Duration = 1.0f;

    // --- 맥락 파라미터 (선택) ---

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Intent|Context")
    EHktVFXSurfaceType SurfaceType = EHktVFXSurfaceType::None;

    // 시전자의 파워 레벨 (0~1). 같은 스킬이라도 캐릭터 성장에 따라 이펙트 화려해짐
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Intent|Context", meta=(ClampMin="0.0", ClampMax="1.0"))
    float SourcePower = 0.5f;

    // Custom 타입일 때 자연어 설명
    // 예: "dark energy vortex pulling enemies inward with chains"
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Intent|Context")
    FString CustomDescription;

    // 추가 키워드 (AI에게 힌트)
    // 예: "ethereal", "ancient", "corrupted", "mechanical"
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Intent|Context")
    TArray<FString> StyleKeywords;

    // --- 런타임 공간 정보 (에디터 생성 시에는 무시됨) ---

    UPROPERTY(BlueprintReadWrite, Category="Intent|Runtime")
    FVector Location = FVector::ZeroVector;

    UPROPERTY(BlueprintReadWrite, Category="Intent|Runtime")
    FVector Direction = FVector::ForwardVector;

    UPROPERTY(BlueprintReadWrite, Category="Intent|Runtime")
    FVector SurfaceNormal = FVector::UpVector;

    // --- 유틸리티 ---

    // Intent에서 에셋 이름용 키 생성
    FString GetAssetKey() const
    {
        FString Key = FString::Printf(TEXT("VFX_%s_%s_I%d"),
            *UEnum::GetValueAsString(EventType).RightChop(20),  // "EHktVFXEventType::" 제거
            *UEnum::GetValueAsString(Element).RightChop(18),     // "EHktVFXElement::" 제거
            FMath::RoundToInt(Intensity * 10));

        if (SurfaceType != EHktVFXSurfaceType::None)
        {
            Key += FString::Printf(TEXT("_%s"),
                *UEnum::GetValueAsString(SurfaceType).RightChop(21));  // "EHktVFXSurfaceType::" 제거
        }
        return Key;
    }

    // LLM 프롬프트용 자연어 설명 생성
    FString ToNaturalLanguage() const;
};

// ============================================================================
// FHktVFXGenerationRequest - 에디터 생성 요청
// ============================================================================
USTRUCT(BlueprintType)
struct HKTVFX_API FHktVFXGenerationRequest
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "VFXGeneration")
    FHktVFXIntent Intent;

    // 생성된 에셋을 저장할 경로 (Content 기준)
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "VFXGeneration")
    FString OutputDirectory = TEXT("/Game/GeneratedVFX");

    // 텍스처 해상도
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "VFXGeneration")
    int32 TextureResolution = 512;

    // 변형 개수 (같은 Intent로 여러 변형 생성)
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "VFXGeneration")
    int32 VariationCount = 1;
};
