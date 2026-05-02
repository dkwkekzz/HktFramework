// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
#include "HktSpriteTypes.generated.h"

class UTexture2D;

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
// FHktSpriteAtlasSlot — Animation 의 atlas 풀 항목
//
// 한 애니메이션이 여러 atlas 텍스처를 가질 수 있도록 하는 간접 참조.
// 분할(테스트) 단계에서는 방향별 atlas 를 N 개 슬롯으로, 통합 단계에서는 단일 슬롯으로
// 표현한다. 렌더러는 슬롯 수에 무관하게 (dirIdx → AtlasSlotIdx) 규약으로 동일 코드
// 경로로 동작한다.
// ============================================================================

USTRUCT(BlueprintType)
struct HKTSPRITECORE_API FHktSpriteAtlasSlot
{
	GENERATED_BODY()

	/** 이 슬롯의 atlas 텍스처. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly)
	TSoftObjectPtr<UTexture2D> Atlas;

	/**
	 * 이 슬롯의 셀 크기 (px). 0 이면 Animation.AtlasCellSize → Template.AtlasCellSize 순으로 폴백.
	 * 슬롯 별로 셀 크기가 다른 경우(예: 공격 모션의 큰 프레임) 채운다.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly)
	FVector2f CellSize = FVector2f::ZeroVector;
};

// ============================================================================
// FHktSpriteAnimation — 한 애니메이션(AnimTag)의 재생 정보
//
// 한 캐릭터의 모든 애니메이션이 단일 아틀라스/머티리얼에 녹아 있으므로, 애니메이션
// 단위로는 "어느 셀 범위를 어떤 순서로 재생할지" + "공통 렌더 속성"만 들고 있다.
//
// 그리드 규약 — 프레임별 데이터는 모두 (dir, frame) 좌표로부터 합성한다:
//   - AtlasSlotIdx = dirIdx  (Frames[d*FPD+f].AtlasSlotIdx 를 따로 저장하지 않음)
//   - AtlasIndex   = frameIdx
//   - 그 외 PivotOffset/Scale/Rotation/Tint 은 Animation 공통값.
// 따라서 NumDirections × FramesPerDirection 만큼의 per-frame 배열은 갖지 않는다.
// ============================================================================

USTRUCT(BlueprintType)
struct HKTSPRITECORE_API FHktSpriteAnimation
{
	GENERATED_BODY()

	/**
	 * 애니별 단일 atlas (구식 / 통합 경로). Null 이면 CharacterTemplate.Atlas 폴백.
	 * AtlasSlots 가 비어있을 때만 사용된다. AtlasSlots 가 있으면 그쪽이 우선.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly)
	TSoftObjectPtr<UTexture2D> Atlas;

	/**
	 * 단일 atlas 의 셀 크기(px). 0이면 CharacterTemplate.AtlasCellSize 폴백.
	 * AtlasSlots 의 슬롯이 자체 CellSize=0 일 때도 폴백으로 참조된다.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly)
	FVector2f AtlasCellSize = FVector2f::ZeroVector;

	/**
	 * 애니별 atlas 풀. 비어있으면 단일 Atlas 경로(위 두 필드)를 사용.
	 * 분할 atlas: 슬롯 N=NumDirections 개, 슬롯 인덱스가 곧 dirIdx.
	 * 통합 atlas: 슬롯 1 개 (모든 dir 이 슬롯 0).
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly)
	TArray<FHktSpriteAtlasSlot> AtlasSlots;

	/** 저장된 방향 수: 1(단일), 5(N/NE/E/SE/S+미러), 8(전체). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, meta=(ClampMin="1", ClampMax="8"))
	int32 NumDirections = 1;

	/** 방향당 프레임 수. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, meta=(ClampMin="1"))
	int32 FramesPerDirection = 1;

	/** 모든 프레임의 공통 피벗(픽셀, 프레임 좌상단 기준). 보통 (CellW/2, CellH) — 바닥 중앙. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FVector2f PivotOffset = FVector2f::ZeroVector;

	/** 공통 스케일. 0/음수면 렌더러가 quad 0 로 거부. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FVector2f Scale = FVector2f(1.f, 1.f);

	/** 공통 회전 (degrees, Y-axis 빌보드 평면 내). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float Rotation = 0.f;

	/** 공통 틴트 (Update.TintOverride 와 곱). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FLinearColor Tint = FLinearColor::White;

	/** 고정 프레임 길이 (ms). PerFrameDurationMs가 비어있을 때 사용. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, meta=(ClampMin="1.0"))
	float FrameDurationMs = 100.f;

	/** 비어있으면 고정 FrameDurationMs 사용. 길이는 FramesPerDirection 권장. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly)
	TArray<float> PerFrameDurationMs;

	UPROPERTY(EditAnywhere, BlueprintReadOnly) bool bLooping = true;

	/** 비루프 애니 종료 후 자동 전환될 anim tag (없으면 무효 태그). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FGameplayTag OnCompleteTransition;

	/** W/SW/NW를 E/SE/NE 미러로 처리 (NumDirections=5일 때만 의미 있음). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) bool bMirrorWestFromEast = true;

	// --- 런타임 헬퍼 ---

	/** 해당 방향의 프레임 수. 현재는 모든 방향 동일 = FramesPerDirection. */
	FORCEINLINE int32 GetNumFrames(int32 /*DirIdx*/) const { return FMath::Max(FramesPerDirection, 0); }

	/** bMirrorWestFromEast + NumDirections를 반영해 저장된 방향과 flipX를 계산. */
	static EHktSpriteFacing ResolveStoredFacing(EHktSpriteFacing In, int32 NumDirections, bool bMirror, bool& OutFlipX);

	/**
	 * (dirIdx) → atlas/cellSize 해석.
	 * - AtlasSlots 가 있고 dirIdx 가 유효하면 그 슬롯 사용 (CellSize 0 이면 Animation.AtlasCellSize 폴백).
	 * - 그렇지 않으면 Animation.Atlas/AtlasCellSize 폴백.
	 * - 둘 다 비어있으면 OutAtlas 는 Null, OutCellSize 는 0 — 호출자가 Template 폴백 처리.
	 */
	void ResolveAtlasForDirection(int32 DirIdx,
		TSoftObjectPtr<UTexture2D>& OutAtlas, FVector2f& OutCellSize) const;
};
