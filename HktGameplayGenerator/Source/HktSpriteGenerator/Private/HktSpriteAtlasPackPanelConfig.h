// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
#include "UObject/Object.h"
#include "HktSpriteAtlasPackPanelConfig.generated.h"

/**
 * UHktSpriteAtlasPackPanelConfig — Stage 2 입력 상태.
 *
 * Stage 1 산출 디렉터리({Workspace}/{SafeAnim}/{Dir}/frame_*.png) 를 스캔해 같은 Workspace 에
 *   {Workspace}/{SafeAnim}/atlas_{Dir}.png        (방향별 strip atlas)
 *   {Workspace}/{SafeAnim}/atlas_meta.json        (셀 크기/프레임 수 메타)
 * 만 만든다 — UE 임포트는 하지 않는다 (Stage 3 가 빌드 시 Workspace PNG 를 직접 임포트).
 *
 * AnimTagFilter 가 비어있으면 캐릭터 하위 모든 anim 일괄 처리.
 */
UCLASS(Config = EditorPerProjectUserSettings)
class UHktSpriteAtlasPackPanelConfig : public UObject
{
	GENERATED_BODY()

public:
	/** 어느 캐릭터의 bundle 들을 패킹할지 — Stage 1 과 동일 태그. */
	UPROPERTY(EditAnywhere, Config, Category = "Identity", meta = (Categories = "Entity.Character"))
	FGameplayTag CharacterTag;

	/** 비워두면 캐릭터 하위 모든 anim 처리. 특정 anim 만 재패킹하려면 그 태그 입력. */
	UPROPERTY(EditAnywhere, Config, Category = "Identity", meta = (Categories = "Anim"))
	FGameplayTag AnimTagFilter;

	/**
	 * 아틀라스 가로 픽셀 상한 — 0 이면 무제한(GPU 한계 8192 까지 strip).
	 * >0 이면 가로가 이 값을 넘지 못하도록 다음 행으로 wrap 되어 그리드로 패킹된다.
	 * 프레임 수가 많은 anim 이 가로로 지나치게 길어지는 현상을 막을 때 사용.
	 */
	UPROPERTY(EditAnywhere, Config, Category = "Layout", meta = (ClampMin = "0", UIMin = "0", UIMax = "8192"))
	int32 MaxAtlasPixelWidth = 2048;
};
