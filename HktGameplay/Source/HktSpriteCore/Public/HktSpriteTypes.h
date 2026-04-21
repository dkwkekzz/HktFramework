// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
#include "HktSpriteTypes.generated.h"

// ============================================================================
// 파츠 슬롯 — 라그나로크 정통 슬롯 구조
// ============================================================================

UENUM(BlueprintType)
enum class EHktSpritePartSlot : uint8
{
	Body          = 0,
	Head          = 1,
	Weapon        = 2,
	Shield        = 3,
	HeadgearTop   = 4,
	HeadgearMid   = 5,
	HeadgearLow   = 6,
	MAX           = 7 UMETA(Hidden)
};

// ============================================================================
// 방향 — 8방향 또는 5방향 + mirror
// 저장 순서: N, NE, E, SE, S, SW, W, NW
// ============================================================================

UENUM(BlueprintType)
enum class EHktSpriteFacing : uint8
{
	N  = 0,
	NE = 1,
	E  = 2,
	SE = 3,
	S  = 4,
	SW = 5,
	W  = 6,
	NW = 7,
	MAX = 8 UMETA(Hidden)
};

// ============================================================================
// FHktSpriteFrame — 한 파츠의 한 방향 한 프레임
// Custom Primitive Data 16슬롯에 그대로 매핑.
// ============================================================================

USTRUCT(BlueprintType)
struct HKTSPRITECORE_API FHktSpriteFrame
{
	GENERATED_BODY()

	/** 아틀라스 내 스프라이트 인덱스 (셀 그리드 순서) */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) int32 AtlasIndex = 0;

	/** 스프라이트 pivot 오프셋 (픽셀, 프레임 좌상단 기준) */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FVector2f PivotOffset = FVector2f::ZeroVector;

	/** 파츠 트랜스폼 — 스프라이트 자체의 스케일/회전/틴트 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FVector2f Scale = FVector2f(1.f, 1.f);

	/** degrees, Y-axis 빌보드 평면 내 회전 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float Rotation = 0.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly) FLinearColor Tint = FLinearColor::White;

	/** 파츠 간 Z-fighting 해소 (Head=+1, Weapon=+2 등) */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) int32 ZBias = 0;

	/** 이번 프레임 기준으로 자식 파츠가 부착될 앵커 포인트 (픽셀) */
	UPROPERTY(EditAnywhere, BlueprintReadOnly)
	TMap<FName, FVector2f> ChildAnchors;
};

// ============================================================================
// FHktSpriteDirectionFrames — 한 방향의 프레임 시퀀스 (USTRUCT nested-array 래퍼)
// ============================================================================

USTRUCT(BlueprintType)
struct HKTSPRITECORE_API FHktSpriteDirectionFrames
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly)
	TArray<FHktSpriteFrame> Frames;
};

// ============================================================================
// FHktSpriteAction — 한 액션(idle/walk/attack/...)의 모든 방향 × 프레임
// ============================================================================

USTRUCT(BlueprintType)
struct HKTSPRITECORE_API FHktSpriteAction
{
	GENERATED_BODY()

	/** "idle", "walk", "attack_1", "hurt", "die" 등 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FName ActionId;

	/** 방향별 프레임 시퀀스. 크기 5(대칭) 또는 8. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly)
	TArray<FHktSpriteDirectionFrames> FramesByDirection;

	/** 고정 fps 기준 기본 프레임 길이 (ms) */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, meta=(ClampMin="1.0"))
	float FrameDurationMs = 100.f;

	/** 비어있으면 고정 FrameDurationMs 사용, 있으면 per-frame override */
	UPROPERTY(EditAnywhere, BlueprintReadOnly)
	TArray<float> PerFrameDurationMs;

	UPROPERTY(EditAnywhere, BlueprintReadOnly) bool bLooping = true;

	/** 비루프 액션 종료 후 자동 전환될 액션 (없으면 NAME_None) */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FName OnCompleteTransition;

	/** 대칭 방향(W, SW, NW)을 E/SE/NE 미러로 생성할지 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) bool bMirrorWestFromEast = true;

	/**
	 * FramesByDirection에서 실제 저장된 방향을 반환.
	 * bMirrorWestFromEast=true면 W→E, SW→SE, NW→NE로 폴백.
	 * OutFlipX=true면 호출자가 스프라이트를 좌우 반전해야 함.
	 */
	static EHktSpriteFacing ResolveStoredFacing(EHktSpriteFacing In, bool bMirror, bool& OutFlipX);
};

// ============================================================================
// FHktSpriteLoadout — 캐릭터의 파츠 조합 (VM 상태의 프레젠테이션 스냅샷)
// VM 내부에는 각 파츠 ID가 FGameplayTag NetIndex로 개별 Cold Property에 저장됨
// (HktCoreProperties.h: SpriteBody..SpriteHeadgearLow). 이 구조체는 Presentation
// 뷰가 한 번에 취급할 수 있도록 모은 값 객체.
// ============================================================================

USTRUCT(BlueprintType)
struct HKTSPRITECORE_API FHktSpriteLoadout
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly) FGameplayTag BodyPart;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FGameplayTag HeadPart;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FGameplayTag WeaponPart;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FGameplayTag ShieldPart;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FGameplayTag HeadgearTop;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FGameplayTag HeadgearMid;
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FGameplayTag HeadgearLow;

	/** 슬롯 열거값으로 접근 */
	FGameplayTag GetSlotTag(EHktSpritePartSlot Slot) const;
	void SetSlotTag(EHktSpritePartSlot Slot, FGameplayTag Tag);

	bool IsEqual(const FHktSpriteLoadout& Other) const;
};
