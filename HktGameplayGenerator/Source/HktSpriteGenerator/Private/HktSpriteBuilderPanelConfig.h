// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
#include "UObject/Object.h"
#include "HktSpriteBuilderPanelConfig.generated.h"

/**
 * FHktSpriteBuilderAnimEntry
 *
 * Stage 3 SpriteBuilder 의 애니메이션 1 항목 — 태그 + 이 anim 의 셀 크기.
 * Workspace ({Saved}/SpriteGenerator/{SafeChar}) 의 컨벤션 경로에서 atlas PNG 를
 * 자동 발견·임포트 후 DataAsset 에 추가한다 — 사용자는 셀 크기만 입력.
 */
USTRUCT(BlueprintType)
struct FHktSpriteBuilderAnimEntry
{
	GENERATED_BODY()

	/** 등록할 애니메이션 태그(예: Anim.FullBody.Locomotion.Idle). 비워두면 빌드에서 스킵. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Animation", meta = (Categories = "Anim"))
	FGameplayTag AnimTag;

	/**
	 * 이 애니의 셀 가로 px. 0 이면 atlas 비율 자동 추론.
	 * Stage 2 가 남긴 atlas_meta.json 의 cellW 가 있으면 그 값 사용 (자동), 없으면 atlas 종횡비로 계산.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Animation", meta = (ClampMin = "0"))
	int32 CellWidth = 0;

	/** 이 애니의 셀 세로 px. 0 = atlas 높이 자동. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Animation", meta = (ClampMin = "0"))
	int32 CellHeight = 0;
};

/**
 * UHktSpriteBuilderPanelConfig — Stage 3 입력 상태.
 *
 * Workspace ({Saved}/SpriteGenerator/{SafeChar}) 를 스캔해 발견된 모든 anim 디렉터리를
 * 빌드 대상으로 본다. Animations 가 비어있으면 자동 발견된 목록을 사용 (셀 크기 0=자동).
 */
UCLASS(Config = EditorPerProjectUserSettings)
class UHktSpriteBuilderPanelConfig : public UObject
{
	GENERATED_BODY()

public:
	/** 모든 애니메이션이 공유할 캐릭터 태그(예: Sprite.Character.Knight). */
	UPROPERTY(EditAnywhere, Config, Category = "Common", meta = (Categories = "Entity.Character"))
	FGameplayTag CharacterTag;

	/** 픽셀 → 월드 단위 (cm/px). 모든 애니메이션 공통. */
	UPROPERTY(EditAnywhere, Config, Category = "Common", meta = (ClampMin = "0.1"))
	float PixelToWorld = 2.0f;

	/**
	 * 등록할 애니메이션 목록 — anim별 셀 크기를 직접 지정하고 싶을 때만 채운다.
	 * 비워두면 Workspace 의 모든 anim 폴더를 자동 발견해 셀 크기 자동 추론으로 빌드.
	 */
	UPROPERTY(EditAnywhere, Config, Category = "Animations")
	TArray<FHktSpriteBuilderAnimEntry> Animations;
};
