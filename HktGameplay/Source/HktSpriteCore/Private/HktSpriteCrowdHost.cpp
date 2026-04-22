// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteCrowdHost.h"
#include "HktSpriteCrowdRenderer.h"
#include "HktSpriteFrameResolver.h"
#include "HktSpriteCoreLog.h"
#include "HktPresentationSubsystem.h"
#include "Components/SceneComponent.h"
#include "Engine/LocalPlayer.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "TimerManager.h"

AHktSpriteCrowdHost::AHktSpriteCrowdHost()
{
	PrimaryActorTick.bCanEverTick = false;

	USceneComponent* Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	SetRootComponent(Root);

	// HISM 자식 컴포넌트들은 GetOrCreateHISM 내부에서 Owner의 RootComponent에 SetupAttachment.
	Renderer = CreateDefaultSubobject<UHktSpriteCrowdRenderer>(TEXT("CrowdRenderer"));
}

void AHktSpriteCrowdHost::BeginPlay()
{
	Super::BeginPlay();
	TryRegisterWithPresentation();
}

void AHktSpriteCrowdHost::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	if (UWorld* World = GetWorld())
	{
		World->GetTimerManager().ClearTimer(RegisterRetryHandle);
	}

	if (CachedPresentationSubsystem)
	{
		CachedPresentationSubsystem->UnregisterRenderer(this);
		CachedPresentationSubsystem = nullptr;
	}

	Super::EndPlay(EndPlayReason);
}

void AHktSpriteCrowdHost::TryRegisterWithPresentation()
{
	if (CachedPresentationSubsystem) return;

	UWorld* World = GetWorld();
	if (!World) return;

	APlayerController* PC = World->GetFirstPlayerController();
	UHktPresentationSubsystem* PS = UHktPresentationSubsystem::Get(PC);

	if (!PS)
	{
		// LocalPlayer 초기화가 늦는 경우 1초 후 재시도 (3회까지)
		if (RegisterRetries++ < 3)
		{
			FTimerManager& TM = World->GetTimerManager();
			TM.SetTimer(RegisterRetryHandle,
				FTimerDelegate::CreateUObject(this, &AHktSpriteCrowdHost::TryRegisterWithPresentation),
				1.f, false);
		}
		return;
	}

	CachedPresentationSubsystem = PS;
	PS->RegisterRenderer(this);
	UE_LOG(LogHktSpriteCore, Log, TEXT("AHktSpriteCrowdHost registered with UHktPresentationSubsystem"));
}

// --- IHktPresentationProcessor ---

void AHktSpriteCrowdHost::Teardown()
{
	if (Renderer)
	{
		Renderer->ClearAll();
	}
	ActionIdCache.Empty();
}

FName AHktSpriteCrowdHost::ResolveActionId(const FGameplayTag& AnimTag)
{
	if (!AnimTag.IsValid()) return NAME_None;
	if (const FName* Cached = ActionIdCache.Find(AnimTag))
	{
		return *Cached;
	}

	// 태그의 leaf name을 소문자로 변환해서 ActionId로 사용.
	// 예: Anim.Action.Walk → "walk", Anim.Action.Attack_1 → "attack_1"
	const FString TagStr = AnimTag.ToString();
	int32 LastDot = INDEX_NONE;
	TagStr.FindLastChar(TEXT('.'), LastDot);
	const FString Leaf = (LastDot != INDEX_NONE && LastDot + 1 < TagStr.Len())
		? TagStr.RightChop(LastDot + 1)
		: TagStr;
	const FName Result(*Leaf.ToLower());
	ActionIdCache.Add(AnimTag, Result);
	return Result;
}

void AHktSpriteCrowdHost::OnCameraViewChanged(FHktPresentationState& State)
{
	// 카메라 yaw 변화 시 Facing 변환이 달라지므로 전체 Sync 강제.
	Sync(State);
}

void AHktSpriteCrowdHost::Sync(FHktPresentationState& State)
{
	if (!Renderer) return;

	const int64 Frame = State.GetCurrentFrame();

	// --- 1. Removed ---
	for (FHktEntityId Id : State.RemovedThisFrame)
	{
		Renderer->UnregisterEntity(Id);
	}

	// --- 2. Spawned: FHktSpriteView가 할당된 엔터티만 처리 ---
	for (FHktEntityId Id : State.SpawnedThisFrame)
	{
		const FHktSpriteView* SV = State.GetSprite(Id);
		if (!SV) continue;

		Renderer->RegisterEntity(Id);

		FHktSpriteLoadout Loadout;
		Loadout.BodyPart    = SV->BodyPart.Get();
		Loadout.HeadPart    = SV->HeadPart.Get();
		Loadout.WeaponPart  = SV->WeaponPart.Get();
		Loadout.ShieldPart  = SV->ShieldPart.Get();
		Loadout.HeadgearTop = SV->HeadgearTop.Get();
		Loadout.HeadgearMid = SV->HeadgearMid.Get();
		Loadout.HeadgearLow = SV->HeadgearLow.Get();
		Renderer->SetLoadout(Id, Loadout);
	}

	// --- 3. Loadout diff: 기존 엔터티 중 이번 프레임 Loadout 변경분 ---
	for (auto It = State.Sprites.CreateConstIterator(); It; ++It)
	{
		const FHktEntityId Id = static_cast<FHktEntityId>(It.GetIndex());
		const FHktSpriteView& SV = *It;
		if (!SV.AnyLoadoutDirty(Frame)) continue;

		FHktSpriteLoadout Loadout;
		Loadout.BodyPart    = SV.BodyPart.Get();
		Loadout.HeadPart    = SV.HeadPart.Get();
		Loadout.WeaponPart  = SV.WeaponPart.Get();
		Loadout.ShieldPart  = SV.ShieldPart.Get();
		Loadout.HeadgearTop = SV.HeadgearTop.Get();
		Loadout.HeadgearMid = SV.HeadgearMid.Get();
		Loadout.HeadgearLow = SV.HeadgearLow.Get();
		Renderer->SetLoadout(Id, Loadout);
	}

	// --- 4. 매 프레임 UpdateEntity ---
	//     모든 스프라이트 엔터티를 순회해 프레임/트랜스폼 재적용.
	//     NowTick으로는 State.GetCurrentFrame()을 사용 (히트스톱 구현은 VM에서 또는 후속 확장에서).
	const int64 NowTick = Frame;

	for (auto It = State.Sprites.CreateConstIterator(); It; ++It)
	{
		const FHktEntityId Id = static_cast<FHktEntityId>(It.GetIndex());
		const FHktSpriteView& SV = *It;

		const FHktTransformView* TV = State.GetTransform(Id);
		if (!TV) continue;
		const FHktAnimationView* AV = State.GetAnimation(Id);

		FHktSpriteEntityUpdate Update;
		Update.WorldLocation  = TV->RenderLocation.Get().IsZero() ? TV->Location.Get() : TV->RenderLocation.Get();
		Update.Facing         = static_cast<EHktSpriteFacing>(SV.Facing.Get() & 0x07);
		Update.ActionId       = AV ? ResolveActionId(AV->AnimState.Get()) : NAME_None;
		Update.AnimStartTick  = SV.AnimStartTick.Get();
		Update.NowTick        = NowTick;
		Update.TickDurationMs = TickDurationMs;
		Update.PlayRate       = 1.f;
		Update.TintOverride   = FLinearColor::White;
		Update.PaletteIndex   = 0;

		Renderer->UpdateEntity(Id, Update);
	}
}
