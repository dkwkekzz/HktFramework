// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktAnimCaptureTypes.h"
#include "UObject/Object.h"
#include "HktAnimCapturePanelConfig.generated.h"

/**
 * UHktAnimCapturePanelConfig
 *
 * SHktAnimCapturePanel 의 마지막 사용 세팅을 저장/복원하기 위한 단일 UObject.
 * Config=EditorPerProjectUserSettings — 사용자별로 EditorPerProjectUserSettings.ini 에
 * 저장된다. UI 에 노출하지 않으며(Project Settings 메뉴에 보이지 않음) 패널이
 * 직접 GetMutableDefault<>().LoadConfig() / SaveConfig() 로만 사용한다.
 *
 * `LastSettings` 는 USTRUCT 이지만 UPROPERTY(Config) 로 마킹하면 UE 의 INI 직렬화가
 * 내부 멤버를 모두 (Field=Value, ...) 형태로 펼쳐 저장한다.
 */
UCLASS(Config = EditorPerProjectUserSettings)
class UHktAnimCapturePanelConfig : public UObject
{
	GENERATED_BODY()

public:
	UPROPERTY(Config)
	FHktAnimCaptureSettings LastSettings;
};
