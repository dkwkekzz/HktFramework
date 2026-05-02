// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "DataAssets/HktActorVisualDataAsset.h"
#include "HktPaperActorVisualDataAsset.generated.h"

class UHktPaperCharacterTemplate;

/**
 * Paper2D 경로 전용 비주얼 등록 자산.
 *
 * `UHktActorVisualDataAsset` 가 들고 있는 `ActorClass` (= `AHktSpritePaperActor`)
 * 위에 캐릭터 데이터(`UHktPaperCharacterTemplate`) 슬롯을 추가한다. 본 자산이
 * `UHktAssetSubsystem::LoadAssetAsync(VisualTag)` 의 진입점이며, Animation 의
 * 하드 참조를 통해 모든 Flipbook/Sprite/Atlas 를 같은 비동기 배치에 끌어온다.
 *
 * 별도 파생 클래스로 둔 이유:
 *   - `UHktActorVisualDataAsset` 에 generic data slot 을 추가하면
 *     `HktPresentation` 모듈을 수정해야 하고 다른 액터 비주얼들도 영향받는다.
 *   - Paper2D 전용 의미를 클래스명에 새겨 두는 편이 디버깅·검색에 명확하다.
 *
 * 등록 컨벤션:
 *   - `IdentifierTag = PaperSprite.Character.{CharName}`
 *   - `ActorClass    = AHktSpritePaperActor::StaticClass()`  (PR-2 에서 채워짐)
 *   - `Animation     = DA_PaperCharacter_{CharName}`
 */
UCLASS(BlueprintType)
class HKTSPRITECORE_API UHktPaperActorVisualDataAsset : public UHktActorVisualDataAsset
{
	GENERATED_BODY()

public:
	/** 이 캐릭터의 Flipbook 룩업 테이블. 비주얼 자산 로드 시 함께 끌려옴. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|PaperSprite")
	TObjectPtr<UHktPaperCharacterTemplate> Animation;
};
