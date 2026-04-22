// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

namespace HktStory
{
	/**
	 * HktSnippetItem 함수들을 FHktStoryJsonParser에 JSON op로 등록한다.
	 * HktStory 모듈의 StartupModule()에서 JSON 로드 전에 호출해야 한다.
	 */
	void RegisterSnippetJsonCommands();
}
