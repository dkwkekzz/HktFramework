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
// FHktSpriteFrame — 한 프레임의 렌더 속성
// Crowd Renderer Custom Primitive Data 슬롯에 그대로 매핑.
// ============================================================================

USTRUCT(BlueprintType)
struct HKTSPRITECORE_API FHktSpriteFrame
{
	GENERATED_BODY()

	/** 아틀라스 내 셀 인덱스(좌→우, 위→아래). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) int32 AtlasIndex = 0;

	/** 스프라이트 pivot 오프셋 (픽셀, 프레임 좌상단 기준) */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FVector2f PivotOffset = FVector2f::ZeroVector;

	UPROPERTY(EditAnywhere, BlueprintReadOnly) FVector2f Scale = FVector2f(1.f, 1.f);

	/** degrees, Y-axis 빌보드 평면 내 회전 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float Rotation = 0.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly) FLinearColor Tint = FLinearColor::White;

	/** 파츠 간 Z-fighting 해소 (Head=+1, Weapon=+2 등) */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) int32 ZBias = 0;

	/** 자식 파츠가 부착될 앵커 포인트 (픽셀). 비어있으면 부모의 PivotOffset 사용. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly)
	TMap<FName, FVector2f> ChildAnchors;
};

// ============================================================================
// FHktSpriteAction — 한 액션(idle/walk/attack/...)의 그리드 레이아웃
//
// ----------------------------------------------------------------------------
// 디자인 철학: 거의 모든 파츠는 "아틀라스를 방향 × 프레임 격자로 잘라 순서대로
// 사용"하는 정형 패턴이다. 과거의 TArray<TArray<FHktSpriteFrame>> 중첩 구조는
// 에디터에서 드릴다운이 심하고, 프레임마다 7개 필드를 채워야 해 불편했다.
//
// 기본 입력은 단 4개:
//   - NumDirections      : 저장 방향 수 (1 / 5 / 8)
//   - FramesPerDirection : 방향당 프레임 수
//   - StartAtlasIndex    : 첫 셀 위치(보통 0)
//   - PivotOffset        : 프레임 공통 피벗(픽셀)
//
// 셀 인덱싱 규칙:
//   AtlasIndex(dir, frame) = StartAtlasIndex + dir * FramesPerDirection + frame
//
// 즉 아틀라스 한 행(row)이 한 방향, 한 열(col)이 한 프레임이 되도록 패킹됐다고
// 가정한다. (HktSpriteGeneratorFunctionLibrary가 그렇게 패킹해 둔다.)
//
// 프레임 단위 특수 속성(Tint/ZBias/ChildAnchors 등)이 필요한 경우에 한해
// FrameOverrides 에 부분적으로 지정한다. 비어두면 그리드만으로 충분.
// ============================================================================

USTRUCT(BlueprintType)
struct HKTSPRITECORE_API FHktSpriteFrameOverride
{
	GENERATED_BODY()

	/** 덮어쓸 방향 인덱스(0~7). -1이면 모든 방향. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) int32 DirectionIndex = -1;

	/** 덮어쓸 프레임 인덱스. -1이면 모든 프레임. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) int32 FrameIndex = -1;

	/** 프레임 속성 (기본값에서 바뀌는 필드만 채우면 됨). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FHktSpriteFrame Frame;

	/** Frame.AtlasIndex 사용 여부 (false면 그리드 계산값 유지). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) bool bOverrideAtlasIndex = false;

	/** Frame.PivotOffset 사용 여부 (false면 액션 공통 PivotOffset 유지). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) bool bOverridePivot = false;
};

USTRUCT(BlueprintType)
struct HKTSPRITECORE_API FHktSpriteAction
{
	GENERATED_BODY()

	/** "idle", "walk", "attack_1", "hurt", "die" 등 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FName ActionId;

	/** 저장된 방향 수: 1(단일), 5(N/NE/E/SE/S+미러), 8(전체). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, meta=(ClampMin="1", ClampMax="8"))
	int32 NumDirections = 1;

	/** 방향당 프레임 수. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, meta=(ClampMin="1"))
	int32 FramesPerDirection = 1;

	/** 첫 프레임이 아틀라스에서 차지하는 셀 인덱스(좌→우, 위→아래). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, meta=(ClampMin="0"))
	int32 StartAtlasIndex = 0;

	/** 모든 프레임 공통 피벗(픽셀, 프레임 좌상단 기준). 보통 (CellW/2, CellH) — 바닥 중앙. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FVector2f PivotOffset = FVector2f::ZeroVector;

	/** 고정 프레임 길이 (ms) */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, meta=(ClampMin="1.0"))
	float FrameDurationMs = 100.f;

	/** 비어있으면 고정 FrameDurationMs 사용. 길이는 FramesPerDirection 권장. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly)
	TArray<float> PerFrameDurationMs;

	UPROPERTY(EditAnywhere, BlueprintReadOnly) bool bLooping = true;

	/** 비루프 액션 종료 후 자동 전환될 액션 (없으면 NAME_None) */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FName OnCompleteTransition;

	/** W/SW/NW를 E/SE/NE 미러로 처리 (NumDirections=5일 때만 의미 있음). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) bool bMirrorWestFromEast = true;

	/** 고급: 특정 (방향, 프레임) 셀의 속성을 덮어쓰고 싶을 때만 채운다. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly)
	TArray<FHktSpriteFrameOverride> FrameOverrides;

	// --- 런타임 헬퍼 ---

	/** 해당 방향의 프레임 수. 현재는 모든 방향 동일 = FramesPerDirection. */
	FORCEINLINE int32 GetNumFrames(int32 /*DirIdx*/) const { return FMath::Max(FramesPerDirection, 0); }

	/** (dir, frameIdx) → 실제 프레임 속성 (Overrides 적용). */
	FHktSpriteFrame MakeFrame(int32 DirIdx, int32 FrameIdx) const;

	/** bMirrorWestFromEast + NumDirections를 반영해 저장된 방향과 flipX를 계산. */
	static EHktSpriteFacing ResolveStoredFacing(EHktSpriteFacing In, int32 NumDirections, bool bMirror, bool& OutFlipX);
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
