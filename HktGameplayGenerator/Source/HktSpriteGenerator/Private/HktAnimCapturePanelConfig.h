// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
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

/**
 * UHktAnimCaptureTagHolder
 *
 * 패널 인스턴스가 일시적으로 보유하는 UObject — 단일 FGameplayTag 두 개(캐릭터/애니)
 * 를 UPROPERTY 로 노출해 PropertyEditor 의 SinglePropertyView 가 UE 표준 태그
 * 피커(드롭다운/검색/새 태그 추가 등)를 그대로 그려주도록 한다.
 *
 * 라이프타임은 SHktAnimCapturePanel 가 TStrongObjectPtr 로 잡고 있으며, 패널이
 * 파괴될 때 함께 GC 된다. Config 직렬화는 하지 않고 — 진짜 저장은 UHktAnimCapturePanelConfig
 * 의 LastSettings 가 담당한다(태그도 LastSettings 안에 들어 있다).
 */
UCLASS()
class UHktAnimCaptureTagHolder : public UObject
{
	GENERATED_BODY()

public:
	UPROPERTY(EditAnywhere, Category = "Identity", meta = (Categories = "Sprite"))
	FGameplayTag CharacterTag;

	UPROPERTY(EditAnywhere, Category = "Identity", meta = (Categories = "Anim"))
	FGameplayTag AnimTag;
};
