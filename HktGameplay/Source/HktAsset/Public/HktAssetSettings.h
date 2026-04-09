// Copyright Hkt Studios, Inc. All Rights Reserved.
// Convention Path 설정 — Project Settings > HktGameplay > HktAsset

#pragma once

#include "CoreMinimal.h"
#include "Engine/DeveloperSettings.h"
#include "HktAssetSettings.generated.h"

/**
 * Convention Path 규칙 엔트리.
 * Tag prefix와 경로 패턴을 매핑합니다.
 *
 * PathPattern에서 사용 가능한 치환 변수:
 *   {Root}     — ConventionRootDirectory (예: /Game/Generated)
 *   {Leaf}     — 태그의 마지막 세그먼트 (예: Goblin)
 *   {TagPath}  — 태그를 _ 로 연결 (예: VFX_Explosion_Fire)
 *   {Category} — 태그의 두 번째 세그먼트 (예: Weapon)
 */
USTRUCT(BlueprintType)
struct HKTASSET_API FHktConventionRule
{
	GENERATED_BODY()

	/** 태그 프리픽스. 이 문자열로 시작하는 태그에 적용 (예: "Entity.Character.") */
	UPROPERTY(EditAnywhere, Category = "Convention")
	FString TagPrefix;

	/**
	 * 경로 패턴. 치환 변수를 사용하여 에셋 경로 결정.
	 * 예: "{Root}/Characters/{Leaf}/BP_{Leaf}"
	 */
	UPROPERTY(EditAnywhere, Category = "Convention")
	FString PathPattern;
};

/**
 * UHktAssetSettings
 *
 * Project Settings > HktGameplay > HktAsset 에서 설정 가능.
 * Convention Path의 루트 디렉토리와 태그별 경로 규칙을 정의합니다.
 * Convention Path는 Generator가 에셋 출력 경로를 결정할 때 사용됩니다.
 * 런타임 에셋 로딩은 TagDataAsset 시스템을 통해 수행됩니다.
 */
UCLASS(config = Game, DefaultConfig, DisplayName = "Hkt Asset Convention")
class HKTASSET_API UHktAssetSettings : public UDeveloperSettings
{
	GENERATED_BODY()

public:
	UHktAssetSettings();

	// =========================================================================
	// Convention Path
	// =========================================================================

	/** Convention Path의 루트 디렉토리 ({Root} 치환) */
	UPROPERTY(Config, EditAnywhere, Category = "Convention")
	FString ConventionRootDirectory = TEXT("/Game/Generated");

	/**
	 * 태그 프리픽스 → 경로 패턴 규칙 목록.
	 * 위에서부터 순서대로 매칭하며, 첫 번째 일치하는 규칙을 사용합니다.
	 * 규칙이 없는 태그는 Convention 해결을 건너뜁니다.
	 */
	UPROPERTY(Config, EditAnywhere, Category = "Convention", meta = (TitleProperty = "TagPrefix"))
	TArray<FHktConventionRule> ConventionRules;

	// =========================================================================
	// UDeveloperSettings
	// =========================================================================

	virtual FName GetContainerName() const override { return FName("Project"); }
	virtual FName GetCategoryName() const override { return FName("HktGameplay"); }
	virtual FName GetSectionName() const override { return FName("HktAsset"); }

	static const UHktAssetSettings* Get()
	{
		return GetDefault<UHktAssetSettings>();
	}

	// =========================================================================
	// 유틸리티
	// =========================================================================

	/**
	 * 태그에 대한 Convention Path를 해결합니다.
	 * ConventionRules에서 매칭되는 규칙을 찾아 패턴 치환 후 반환.
	 * @return 해결된 경로. 규칙이 없으면 빈 문자열.
	 */
	FString ResolveConventionPath(const FString& TagStr) const;
};
