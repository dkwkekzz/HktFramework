// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "IHktSpriteCoreModule.h"
#include "HktSpriteCoreLog.h"
#include "HktSpriteCrowdHost.h"
#include "Engine/Engine.h"
#include "Engine/World.h"
#include "Modules/ModuleManager.h"

#define LOCTEXT_NAMESPACE "FHktSpriteCoreModule"

DEFINE_LOG_CATEGORY(LogHktSpriteCore);

class FHktSpriteCoreModule : public IHktSpriteCoreModule
{
public:
	virtual void StartupModule() override
	{
		UE_LOG(LogHktSpriteCore, Log, TEXT("HktSpriteCore Module Started"));

		// 클라이언트(시각화가 필요한 월드)에서만 SpriteCrowdHost를 자동 스폰.
		// AHktIngameHUD가 PresentationSubsystem에 자기 자신을 등록하는 것과 동일한 패턴.
		WorldPostInitHandle = FWorldDelegates::OnPostWorldInitialization.AddRaw(this, &FHktSpriteCoreModule::OnPostWorldInit);
	}

	virtual void ShutdownModule() override
	{
		FWorldDelegates::OnPostWorldInitialization.Remove(WorldPostInitHandle);
		UE_LOG(LogHktSpriteCore, Log, TEXT("HktSpriteCore Module Shutdown"));
	}

private:
	void OnPostWorldInit(UWorld* InWorld, const UWorld::InitializationValues)
	{
		if (!InWorld) return;
		// Dedicated Server / Editor 월드에선 스프라이트 렌더 불필요.
		const EWorldType::Type WT = InWorld->WorldType;
		if (WT != EWorldType::Game && WT != EWorldType::PIE) return;

		FActorSpawnParameters Params;
		Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
		Params.ObjectFlags = RF_Transient;
		AHktSpriteCrowdHost* Host = InWorld->SpawnActor<AHktSpriteCrowdHost>(AHktSpriteCrowdHost::StaticClass(), FTransform::Identity, Params);
		if (!Host)
		{
			UE_LOG(LogHktSpriteCore, Warning, TEXT("AHktSpriteCrowdHost 자동 스폰 실패"));
			return;
		}
#if WITH_EDITOR
		Host->SetActorLabel(TEXT("HktSpriteCrowdHost"));
#endif
	}

	FDelegateHandle WorldPostInitHandle;
};

IMPLEMENT_MODULE(FHktSpriteCoreModule, HktSpriteCore)

#undef LOCTEXT_NAMESPACE
