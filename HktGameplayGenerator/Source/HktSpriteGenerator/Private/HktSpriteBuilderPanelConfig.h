// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
#include "HktSpriteGeneratorFunctionLibrary.h"
#include "UObject/Object.h"
#include "HktSpriteBuilderPanelConfig.generated.h"

/**
 * FHktSpriteBuilderAnimEntry
 *
 * SpriteBuilder 패널에 등록된 1개 애니메이션의 입력 — 태그 + 재료(소스 타입/경로)만.
 * 셀 크기 등 캐릭터 단위 공통 값(CellWidth/Height/PixelToWorld/OutputDir)은
 * 패널 상단 Common 영역에 따로 보관 — 사용자가 한 캐릭터의 모든 애니가 같은
 * 셀 크기를 공유한다고 명시했기 때문.
 */
USTRUCT(BlueprintType)
struct FHktSpriteBuilderAnimEntry
{
	GENERATED_BODY()

	/** 등록할 애니메이션 태그(예: Anim.FullBody.Locomotion.Idle). 비워두면 빌드에서 스킵. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Animation", meta = (Categories = "Anim"))
	FGameplayTag AnimTag;

	/** 재료 타입 — Atlas/TextureBundle/Video. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Animation")
	EHktSpriteSourceType SourceType = EHktSpriteSourceType::TextureBundle;

	/**
	 * 재료 경로. SourceType 별:
	 *   - Video         : 동영상 파일 절대 경로
	 *   - Atlas         : `/Game/...` UE 텍스처 또는 PNG 절대 경로
	 *   - TextureBundle : 이미지 폴더 절대 경로
	 *
	 * 디렉터리·파일이 모두 가능하므로 FString 으로 둠 — 표준 텍스트 박스로 표시되며
	 * 사용자가 경로를 직접 붙여넣는다(전용 피커가 필요하면 별도 위젯 추가 필요).
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Animation")
	FString SourcePath;
};

/**
 * UHktSpriteBuilderPanelConfig
 *
 * SpriteBuilder 패널의 전체 상태(공통 설정 + 애니 리스트). UPROPERTY(Config) 로
 * EditorPerProjectUserSettings.ini 에 자동 저장되어 다음 세션에서 그대로 복원.
 *
 * 패널은 단순히 이 객체를 IDetailsView 로 띄우고 "Build All" 만 호출하면 된다 —
 * 모든 입력 위젯(태그 피커, 파일 경로, enum 콤보, 배열 ± 버튼)은 UE 표준이 자동 제공.
 */
UCLASS(Config = EditorPerProjectUserSettings)
class UHktSpriteBuilderPanelConfig : public UObject
{
	GENERATED_BODY()

public:
	/** 모든 애니메이션이 공유할 캐릭터 태그(예: Sprite.Character.Knight). */
	UPROPERTY(EditAnywhere, Config, Category = "Common", meta = (Categories = "Sprite"))
	FGameplayTag CharacterTag;

	/** UE 컨텐트 출력 폴더 — 모든 애니메이션이 동일 DataAsset 에 누적 추가됨. */
	UPROPERTY(EditAnywhere, Config, Category = "Common")
	FString OutputDir = TEXT("/Game/Generated/Sprites");

	/** 픽셀 → 월드 단위 (cm/px). 모든 애니메이션 공통. */
	UPROPERTY(EditAnywhere, Config, Category = "Common", meta = (ClampMin = "0.1"))
	float PixelToWorld = 2.0f;

	/**
	 * 셀(프레임) 가로 px — 모든 애니메이션 공통. Atlas 소스에서 필수, 그 외는 0=auto.
	 * 한 캐릭터의 모든 애니가 동일 크기를 가진다고 가정 — 다르면 BuildSpriteAnim 을
	 * 직접 호출하거나 추후 per-anim override 추가.
	 */
	UPROPERTY(EditAnywhere, Config, Category = "Common", meta = (ClampMin = "0"))
	int32 CellWidth = 0;

	/** 셀(프레임) 세로 px — CellWidth 와 동일 의미. */
	UPROPERTY(EditAnywhere, Config, Category = "Common", meta = (ClampMin = "0"))
	int32 CellHeight = 0;

	/** 등록할 애니메이션 목록 — Build All 시 위에서 아래로 순차 빌드. */
	UPROPERTY(EditAnywhere, Config, Category = "Animations")
	TArray<FHktSpriteBuilderAnimEntry> Animations;
};
