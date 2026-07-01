// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "HktSplatSubsystem.generated.h"

class FHktSplatSceneViewExtension;

/**
 * UHktSplatSubsystem — 월드별 스플랫 렌더 관리자.
 *
 * 월드마다 하나의 FHktSplatSceneViewExtension 을 생성/소유한다.
 * UHktSplatComponent 는 이 서브시스템을 통해 렌더 프록시를 등록/해제한다.
 */
UCLASS()
class HKTSPLATCORE_API UHktSplatSubsystem : public UWorldSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;
	virtual bool DoesSupportWorldType(const EWorldType::Type WorldType) const override;

	TSharedPtr<FHktSplatSceneViewExtension, ESPMode::ThreadSafe> GetViewExtension() const { return ViewExtension; }

private:
	TSharedPtr<FHktSplatSceneViewExtension, ESPMode::ThreadSafe> ViewExtension;
};
