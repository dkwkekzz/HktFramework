// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "HktStoryEditorLibrary.generated.h"

/**
 * UHktStoryEditorLibrary
 *
 * StoryDirectories의 *.json을 스캔하여 (1) 참조된 모든 GameplayTag를
 * Config/Tags/HktStoryTags.ini에 기록하고 (2) GameplayTagsManager 트리를 갱신하여
 * 해당 태그가 즉시 RequestGameplayTag로 조회되도록 한다. 마지막으로 (3) Story
 * 레지스트리를 재로드한다. 신규 태그를 추가한 JSON을 작성한 직후 호출.
 *
 * 에디터 전용 — 패키지 빌드에는 포함되지 않는다.
 */
UCLASS()
class HKTSTORY_API UHktStoryEditorLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
#if WITH_EDITOR
	/** Story JSON에서 태그를 수집해 ini에 기록하고 Story를 재컴파일. 등록된 태그 수 반환. */
	UFUNCTION(BlueprintCallable, CallInEditor, Category = "HktStory|Editor",
		meta = (DisplayName = "Regenerate Story Tags and Reload"))
	static int32 RegenerateStoryTagsAndReload();
#endif
};
