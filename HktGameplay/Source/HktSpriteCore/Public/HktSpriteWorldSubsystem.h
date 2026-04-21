// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "HktSpriteWorldSubsystem.generated.h"

class AActor;
class UHktSpriteCrowdRenderer;
class FHktSpriteProcessor;

/**
 * UHktSpriteWorldSubsystem — 스프라이트 크라우드 렌더러와 프로세서의 부트스트랩.
 *  - 월드 시작 시 호스트 액터에 UHktSpriteCrowdRenderer 컴포넌트 부착
 *  - 로컬 플레이어의 UHktPresentationSubsystem에 FHktSpriteProcessor 등록
 *  - 클라이언트(시각화가 필요한 월드)에서만 활성화
 */
UCLASS()
class HKTSPRITECORE_API UHktSpriteWorldSubsystem : public UWorldSubsystem
{
	GENERATED_BODY()

public:
	virtual bool ShouldCreateSubsystem(UObject* Outer) const override;
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;
	virtual void OnWorldBeginPlay(UWorld& InWorld) override;

	UHktSpriteCrowdRenderer* GetRenderer() const { return Renderer; }

private:
	UPROPERTY(Transient)
	TObjectPtr<AActor> HostActor;

	UPROPERTY(Transient)
	TObjectPtr<UHktSpriteCrowdRenderer> Renderer;

	TSharedPtr<FHktSpriteProcessor> Processor;

	FTimerHandle RegisterRetryHandle;

	void EnsureHostActor();
	void TryRegisterProcessor();
};
