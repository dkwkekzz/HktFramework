// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Engine/GameInstance.h"
#include "HktGameInstance.generated.h"

/**
 * 레벨 전환 간 유지되는 게임 인스턴스.
 * 선택 캐릭터 등 영구 데이터 보관.
 */
UCLASS()
class HKTRUNTIME_API UHktGameInstance : public UGameInstance
{
	GENERATED_BODY()

public:
	UHktGameInstance();

	/** 선택한 캐릭터 클래스 ID (예: 전사=1, 마법사=2) */
	UPROPERTY(BlueprintReadWrite, Category = "GameData")
	int32 SelectedCharacterClassID = 0;
};
