// Copyright Hkt Studios, Inc. All Rights Reserved.
// 임시 맵 스토리 설정 — MapGenerator 연동 전까지 테스트용.
// TODO: MapGenerator의 FHktMapData 연동 후 이 파일 삭제.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
#include "NativeGameplayTags.h"

/**
 * 임시 스토리 엔트리 — FHktMapStoryRef + 위치 파라미터.
 * MapGenerator의 FHktMapStoryRef와 1:1 대응.
 */
struct FHktTempStoryEntry
{
	FGameplayTag StoryTag;
	int32 SpawnPosX = 0;
	int32 SpawnPosY = 0;
};

/**
 * 테스트 맵의 스토리 구성.
 * 향후 FHktMapData::GlobalStories + FHktMapRegion::Stories로 교체.
 */
namespace HktTempMapStoryConfig
{
	/**
	 * 그룹별 스포너 목록 반환.
	 * GroupIndex로 그룹별 차별화 가능 — Region 개념과 대응.
	 */
	TArray<FHktTempStoryEntry> GetSpawnersForGroup(int32 GroupIndex);
}
