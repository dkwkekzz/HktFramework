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
// FHktSpriteFrame — 한 프레임의 렌더 속성
// Crowd Renderer Custom Primitive Data 슬롯에 그대로 매핑.
// ============================================================================

USTRUCT(BlueprintType)
struct HKTSPRITECORE_API FHktSpriteFrame
{
	GENERATED_BODY()

	/** 아틀라스 내 셀 인덱스(좌→우, 위→아래). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) int32 AtlasIndex = 0;

	/** 스프라이트 pivot 오프셋 (픽셀, 프레임 좌상단 기준). 비워두면 애니메이션 공통값. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FVector2f PivotOffset = FVector2f::ZeroVector;

	UPROPERTY(EditAnywhere, BlueprintReadOnly) FVector2f Scale = FVector2f(1.f, 1.f);

	/** degrees, Y-axis 빌보드 평면 내 회전 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) float Rotation = 0.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly) FLinearColor Tint = FLinearColor::White;

	/** 같은 캐릭터 안에서 프레임 간 Z-fighting 해소용 오프셋. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) int32 ZBias = 0;
};

// ============================================================================
// FHktSpriteAnimation — 한 애니메이션(AnimTag)의 재생 정보 + 프레임 리스트
//
// 한 캐릭터의 모든 애니메이션이 단일 아틀라스/머티리얼에 녹아 있으므로, 애니메이션
// 단위로는 "어느 셀 범위를 어떤 순서로 재생할지" + "프레임별 렌더 속성"만 들고 있다.
//
// 그리드 파라미터(NumDirections × FramesPerDirection)는 Frames 배열과 중복처럼 보이지만,
// FrameResolver가 "현재 방향의 N번째 프레임"을 O(1)로 매핑하기 위해 필요하다.
// Frames.Num() >= NumDirections * FramesPerDirection 이어야 하며,
// 인덱싱: Frames[ dir * FramesPerDirection + frame ].
// ============================================================================

USTRUCT(BlueprintType)
struct HKTSPRITECORE_API FHktSpriteAnimation
{
	GENERATED_BODY()

	/**
	 * 이 애니메이션 전용 아틀라스. Null이면 CharacterTemplate의 Atlas(폴백) 사용.
	 * 애니별로 개별 PNG를 빌드한 캐릭터에서 필수.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly)
	TSoftObjectPtr<UTexture2D> Atlas;

	/**
	 * 이 애니메이션의 셀 크기(px). 0이면 CharacterTemplate의 AtlasCellSize(폴백) 사용.
	 * Atlas가 애니별로 다른 셀 크기를 가질 때(예: 공격 모션 큰 프레임) 사용.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly)
	FVector2f AtlasCellSize = FVector2f::ZeroVector;

	/** 저장된 방향 수: 1(단일), 5(N/NE/E/SE/S+미러), 8(전체). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, meta=(ClampMin="1", ClampMax="8"))
	int32 NumDirections = 1;

	/** 방향당 프레임 수. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, meta=(ClampMin="1"))
	int32 FramesPerDirection = 1;

	/** 모든 프레임의 공통 피벗(픽셀, 프레임 좌상단 기준). 보통 (CellW/2, CellH) — 바닥 중앙. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly) FVector2f PivotOffset = FVector2f::ZeroVector;

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

	/**
	 * 프레임 리스트. 크기는 NumDirections × FramesPerDirection.
	 * 인덱싱: Frames[ dir * FramesPerDirection + frame ].
	 * Generator가 채우므로 FrameOverride 같은 부분 덮어쓰기는 사용하지 않는다.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly)
	TArray<FHktSpriteFrame> Frames;

	// --- 런타임 헬퍼 ---

	/** 해당 방향의 프레임 수. 현재는 모든 방향 동일 = FramesPerDirection. */
	FORCEINLINE int32 GetNumFrames(int32 /*DirIdx*/) const { return FMath::Max(FramesPerDirection, 0); }

	/**
	 * (dir, frameIdx) → 실제 프레임 속성. Frames 배열에서 직접 꺼낸다.
	 * 범위를 벗어나면 grid 기본 속성(PivotOffset만 채운 FHktSpriteFrame)을 반환.
	 */
	FHktSpriteFrame MakeFrame(int32 DirIdx, int32 FrameIdx) const;

	/** bMirrorWestFromEast + NumDirections를 반영해 저장된 방향과 flipX를 계산. */
	static EHktSpriteFacing ResolveStoredFacing(EHktSpriteFacing In, int32 NumDirections, bool bMirror, bool& OutFlipX);
};
