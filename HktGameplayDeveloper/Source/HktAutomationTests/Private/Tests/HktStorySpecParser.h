// Copyright Hkt Studios, Inc. All Rights Reserved.
//
// FHktStorySpecParser — `<Story>.spec.json` → FHktStorySpec.
// 로드 타임 전용. 출력은 TArray 기반이라 런타임에서 TMap 부담이 없다.

#pragma once

#include "CoreMinimal.h"
#include "HktStorySpecTypes.h"

class FHktStorySpecParser
{
public:
	/** 절대 경로의 spec.json 을 파싱. 실패 시 false + OutError 채움. */
	static bool ParseFile(const FString& AbsolutePath, FHktStorySpec& Out, FString& OutError);

	/** JSON 본문 직접 파싱 (테스트 / 인-메모리 케이스용). SourceFile 은 외부에서 채울 것. */
	static bool ParseJson(const FString& JsonStr, FHktStorySpec& Out, FString& OutError);
};
