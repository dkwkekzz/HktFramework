// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DeveloperSettings.h"
#include "HktWorkspaceSettings.generated.h"

/**
 * UHktWorkspaceSettings
 *
 * I-0008 워크스페이스 설정. Project Settings > Plugins > HKT Workspace 에 노출.
 * 기본 루트는 {ProjectSaved}/Workspace/ — 디렉터리만 비워두면 자동 사용.
 */
UCLASS(config=Editor, defaultconfig, meta=(DisplayName="HKT Workspace"))
class HKTWORKSPACEGENERATOR_API UHktWorkspaceSettings : public UDeveloperSettings
{
	GENERATED_BODY()

public:
	/**
	 * 워크스페이스 루트 — 비우면 `{ProjectSaved}/Workspace/` 자동 사용.
	 */
	UPROPERTY(config, EditAnywhere, Category="Workspace",
		meta=(DisplayName="Workspace Root"))
	FDirectoryPath WorkspaceRoot;

	/**
	 * 미등록 GameplayTag 자동 ini 등록 — 끄면 빌드는 native 등록만 사용.
	 * (켜면 Config/Tags/HktWorkspaceTags.ini 에 누적.)
	 */
	UPROPERTY(config, EditAnywhere, Category="Workspace",
		meta=(DisplayName="Auto Register Missing Tags To Ini"))
	bool bAutoRegisterMissingTagsToIni = true;

	/** Paper2D 기본 PixelToWorld (1 px → world cm). character_meta.json 이 우선. */
	UPROPERTY(config, EditAnywhere, Category="Defaults|Paper2D",
		meta=(DisplayName="Paper2D Default Pixel To World"))
	float Paper2DDefaultPixelToWorld = 2.0f;

	/** Paper2D 기본 frame duration (ms). */
	UPROPERTY(config, EditAnywhere, Category="Defaults|Paper2D",
		meta=(DisplayName="Paper2D Default Frame Duration Ms"))
	float Paper2DDefaultFrameDurationMs = 100.f;

	/** Paper2D 기본 looping. */
	UPROPERTY(config, EditAnywhere, Category="Defaults|Paper2D",
		meta=(DisplayName="Paper2D Default Looping"))
	bool bPaper2DDefaultLooping = true;

	/** Paper2D 기본 mirror W ← E. */
	UPROPERTY(config, EditAnywhere, Category="Defaults|Paper2D",
		meta=(DisplayName="Paper2D Default Mirror West From East"))
	bool bPaper2DDefaultMirrorWestFromEast = true;

	// UDeveloperSettings 인터페이스
	virtual FName GetCategoryName() const override { return FName(TEXT("HktGameplay")); }
	virtual FName GetSectionName()  const override { return FName(TEXT("HktWorkspace")); }

	/** 설정의 WorkspaceRoot 가 비어있으면 `{ProjectSaved}/Workspace/` 로 폴백. */
	static FString ResolveWorkspaceRoot();
};
