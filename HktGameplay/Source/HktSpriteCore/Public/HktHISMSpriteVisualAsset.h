// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktTagDataAsset.h"
#include "GameplayTagContainer.h"
#include "HktHISMSpriteVisualAsset.generated.h"

class UTexture2D;
class UHktHISMSpriteAnimationDataAsset;

// ============================================================================
// UHktHISMSpriteVisualAsset — HISM/Niagara 경로의 Visual 진입 자산.
//
// `UHktAssetSubsystem::LoadAssetAsync(VisualTag)` 의 타깃이며
// 다음 데이터를 직접 보유한다:
//
//   - Atlas / AtlasCellSize / PixelToWorld  (정적 객체 또는 동적 폴백)
//   - AnimationAsset(optional)              (동적 객체 — null 이면 정적 단일 quad)
//
// 정적 객체(나무·바위 등) 권장 사용:
//   - `IdentifierTag = Sprite.Prop.Tree.Oak`
//   - `Atlas` 에 PNG 1장(단일 셀), `AtlasCellSize` = 이미지 크기, `AnimationAsset` 비움.
//   - 렌더러는 NumDirections=1 / FramesPerDirection=1 의 단일 quad 로 그린다.
//
// 동적 객체(캐릭터·몹) 권장 사용:
//   - `IdentifierTag = Sprite.Character.Knight`
//   - `Atlas` 는 비워두고(또는 폴백 1장), `AnimationAsset` 에 다중 anim 자산 연결.
//   - 렌더러는 (AnimTag, dirIdx, frameIdx) 별 atlas/cell 해석.
//
// 등록 컨벤션:
//   - 캐릭터:    `Sprite.Character.{Name}`
//   - 정적 객체: `Sprite.Prop.{Category}.{Name}` (예: `Sprite.Prop.Tree.Oak`)
// ============================================================================

UCLASS(BlueprintType)
class HKTSPRITECORE_API UHktHISMSpriteVisualAsset : public UHktTagDataAsset
{
	GENERATED_BODY()

public:
	/**
	 * 폴백/정적 단일 아틀라스. `AnimationAsset` 이 null 인 정적 객체에서는 본
	 * 텍스처가 곧 그려질 단일 셀이다. 동적 경로에서는 Animation 의 슬롯 atlas 가
	 * 우선하고, 비어있을 때 본 필드를 폴백으로 사용.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "HKT|Sprite")
	TSoftObjectPtr<UTexture2D> Atlas;

	/** 셀 크기(px). 정적 객체는 텍스처 전체 크기, 동적 객체는 단일 프레임 크기. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "HKT|Sprite")
	FVector2f AtlasCellSize = FVector2f(64.f, 64.f);

	/** 1 픽셀당 월드 cm — Crowd Renderer 쿼드 크기 결정. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "HKT|Sprite", meta = (ClampMin = "0.1"))
	float PixelToWorld = 2.f;

	/**
	 * 동적 객체용 애니메이션 자산. null 이면 정적 경로 (단일 atlas / 단일 quad).
	 * 하드 참조 — 본 Visual 자산 비동기 로드 시 함께 끌려옴.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "HKT|Sprite")
	TObjectPtr<UHktHISMSpriteAnimationDataAsset> AnimationAsset;

	virtual EHktRenderCategory GetRenderCategory() const override { return EHktRenderCategory::MassEntity; }

	/** AnimationAsset 가 있는지 — 정적/동적 분기 헬퍼. */
	FORCEINLINE bool IsStatic() const { return AnimationAsset == nullptr; }
};
