// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
#include "UObject/Object.h"
#include "HktPaperSpriteBuilderPanelConfig.generated.h"

/**
 * FHktPaperBuilderAnimEntry
 *
 * Paper2D 빌더의 애니메이션 1 항목 — 태그 + anim 단위로 덮어 쓸 수 있는 셀 / 타이밍 옵션.
 * Workspace ({Saved}/SpriteGenerator/{SafeChar}/{SafeAnim}) 의 atlas_{Dir}.png 를
 * 임포트해 UPaperSprite/UPaperFlipbook 으로 빌드한다.
 */
USTRUCT(BlueprintType)
struct FHktPaperBuilderAnimEntry
{
	GENERATED_BODY()

	/** 등록할 애니메이션 태그(예: Anim.FullBody.Locomotion.Idle). 비워두면 빌드에서 스킵. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Animation", meta = (Categories = "Anim"))
	FGameplayTag AnimTag;

	/** 셀 가로 px. 0 이면 atlas_meta.json → 종횡비 폴백으로 자동 추론. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Animation", meta = (ClampMin = "0"))
	int32 CellWidth = 0;

	/** 셀 세로 px. 0 = atlas 높이 자동. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Animation", meta = (ClampMin = "0"))
	int32 CellHeight = 0;

	/** 프레임 1장 표시 시간(ms). UPaperFlipbook 의 FramesPerSecond 산정에 사용. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Animation", meta = (ClampMin = "1.0"))
	float FrameDurationMs = 100.f;

	/** 액터의 UPaperFlipbookComponent 에 적용될 looping 플래그(자산엔 저장되지 않음). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Animation")
	bool bLooping = true;
};

/**
 * UHktPaperSpriteBuilderPanelConfig — Paper2D Builder 패널의 영구 입력 상태.
 *
 * EditorPerProjectUserSettings 에 저장 — 다음 세션에서 마지막 입력이 그대로 복원된다.
 */
UCLASS(Config = EditorPerProjectUserSettings)
class UHktPaperSpriteBuilderPanelConfig : public UObject
{
	GENERATED_BODY()

public:
	/** 모든 애니메이션이 공유할 캐릭터 태그 (예: Sprite.Character.Knight). */
	UPROPERTY(EditAnywhere, Config, Category = "Common", meta = (Categories = "Entity.Character,Sprite.Character"))
	FGameplayTag CharacterTag;

	/**
	 * 액터 비주얼 식별자 태그 (`UHktActorVisualDataAsset::IdentifierTag`).
	 * 비우면 `PaperSprite.Character.{Char}` 자동 생성. 서버 SpawnEntity 의 VisualTag 와 일치해야
	 * `FHktActorProcessor` 가 `AHktSpritePaperActor` 를 스폰한다.
	 */
	UPROPERTY(EditAnywhere, Config, Category = "Common", meta = (Categories = "PaperSprite.Character"))
	FGameplayTag VisualIdentifierTag;

	/** 픽셀 → 월드 단위(cm/px). 모든 애니메이션 공통. */
	UPROPERTY(EditAnywhere, Config, Category = "Common", meta = (ClampMin = "0.1"))
	float PixelToWorld = 2.0f;

	/** 미러 dir(W/SW/NW) 을 반대측에서 X-스케일로 생성할지 — 기본 true. */
	UPROPERTY(EditAnywhere, Config, Category = "Common")
	bool bMirrorWestFromEast = true;

	/**
	 * 출력 콘텐츠 디렉터리. 비우면 `/Game/Generated/PaperSprites/{SafeChar}` 사용.
	 * 동일 캐릭터를 다른 곳으로 빌드하고 싶을 때만 채운다.
	 */
	UPROPERTY(EditAnywhere, Config, Category = "Common")
	FString OutputDir;

	/**
	 * 등록할 애니메이션 목록 — anim별로 셀 크기/타이밍을 직접 지정하고 싶을 때만 채운다.
	 * 비워두면 Workspace 의 모든 anim 폴더를 자동 발견해 일괄 빌드한다.
	 */
	UPROPERTY(EditAnywhere, Config, Category = "Animations")
	TArray<FHktPaperBuilderAnimEntry> Animations;
};
