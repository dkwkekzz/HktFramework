// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteWorldSubsystem.h"
#include "HktSpriteCrowdRenderer.h"
#include "HktSpriteProcessor.h"
#include "HktSpriteCoreLog.h"
#include "HktPresentationSubsystem.h"
#include "Engine/World.h"
#include "Engine/LocalPlayer.h"
#include "GameFramework/Actor.h"
#include "Components/SceneComponent.h"
#include "TimerManager.h"

bool UHktSpriteWorldSubsystem::ShouldCreateSubsystem(UObject* Outer) const
{
	// 서버 전용(Dedicated Server) 월드에선 스프라이트 렌더가 필요 없음
	if (UWorld* World = Cast<UWorld>(Outer))
	{
		const EWorldType::Type WT = World->WorldType;
		if (WT != EWorldType::Game && WT != EWorldType::PIE) return false;
	}
	return true;
}

void UHktSpriteWorldSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
}

void UHktSpriteWorldSubsystem::Deinitialize()
{
	if (UWorld* World = GetWorld())
	{
		World->GetTimerManager().ClearTimer(RegisterRetryHandle);
	}

	// PresentationSubsystem에서 해제 — LocalPlayer가 살아있다면 자발적 제거.
	if (Processor)
	{
		if (UWorld* World = GetWorld())
		{
			if (ULocalPlayer* LP = World->GetFirstLocalPlayerFromController())
			{
				if (UHktPresentationSubsystem* PS = LP->GetSubsystem<UHktPresentationSubsystem>())
				{
					PS->UnregisterRenderer(Processor.Get());
				}
			}
		}
		Processor->Teardown();
		Processor.Reset();
	}

	if (HostActor)
	{
		HostActor->Destroy();
		HostActor = nullptr;
	}
	Renderer = nullptr;

	Super::Deinitialize();
}

void UHktSpriteWorldSubsystem::OnWorldBeginPlay(UWorld& InWorld)
{
	Super::OnWorldBeginPlay(InWorld);

	EnsureHostActor();
	TryRegisterProcessor();
}

void UHktSpriteWorldSubsystem::EnsureHostActor()
{
	if (HostActor) return;

	UWorld* World = GetWorld();
	if (!World) return;

	FActorSpawnParameters Params;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	Params.ObjectFlags = RF_Transient;
	AActor* Host = World->SpawnActor<AActor>(AActor::StaticClass(), FTransform::Identity, Params);
	if (!Host)
	{
		UE_LOG(LogHktSpriteCore, Warning, TEXT("스프라이트 호스트 액터 생성 실패"));
		return;
	}
#if WITH_EDITOR
	Host->SetActorLabel(TEXT("HktSpriteCrowdHost"));
#endif

	USceneComponent* Root = NewObject<USceneComponent>(Host, TEXT("Root"));
	Host->SetRootComponent(Root);
	Root->RegisterComponent();

	// UActorComponent은 SceneComponent 계층에 부착하지 않는다.
	// HISM 자식 컴포넌트들은 GetOrCreateHISM 내부에서 Owner의 RootComponent에 SetupAttachment.
	UHktSpriteCrowdRenderer* Comp = NewObject<UHktSpriteCrowdRenderer>(Host, TEXT("CrowdRenderer"));
	Comp->RegisterComponent();

	HostActor = Host;
	Renderer = Comp;

	Processor = MakeShared<FHktSpriteProcessor>(Comp);
}

void UHktSpriteWorldSubsystem::TryRegisterProcessor()
{
	if (!Processor) return;

	UWorld* World = GetWorld();
	if (!World) return;

	ULocalPlayer* LP = World->GetFirstLocalPlayerFromController();
	UHktPresentationSubsystem* PS = LP ? LP->GetSubsystem<UHktPresentationSubsystem>() : nullptr;

	if (!PS)
	{
		// LocalPlayer 초기화가 늦는 경우 1초 후 재시도 (3회까지)
		static int32 Retries = 0;
		if (Retries++ < 3)
		{
			FTimerManager& TM = World->GetTimerManager();
			TM.SetTimer(RegisterRetryHandle, FTimerDelegate::CreateUObject(this, &UHktSpriteWorldSubsystem::TryRegisterProcessor), 1.f, false);
		}
		return;
	}

	PS->RegisterRenderer(Processor.Get());
	UE_LOG(LogHktSpriteCore, Log, TEXT("FHktSpriteProcessor registered with UHktPresentationSubsystem"));
}
