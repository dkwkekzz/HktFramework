// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteCrowdHost.h"
#include "HktHISMSpriteAnimationDataAsset.h"
#include "HktHISMSpriteVisualAsset.h"
#include "HktSpriteAnimProcessor.h"
#include "HktSpriteCoreTags.h"
#include "HktSpriteCrowdRenderer.h"
#include "HktSpriteFrameResolver.h"
#include "HktSpriteCoreLog.h"
#include "HktCoreEventLog.h"
#include "HktPresentationSubsystem.h"
#include "Components/SceneComponent.h"
#include "Engine/LocalPlayer.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "HAL/IConsoleManager.h"
#include "TimerManager.h"

// Facing 산출 시 LastMoveDirXY 를 갱신할 최소 속도(cm/s). 임계 미만 입력은 sticky
// 직전 방향을 유지 — 정지 → idle 에서 facing 이 임의로 S 로 튀지 않게 한다.
// PaperActor 에서도 동일 CVar 를 공용하므로 외부 연결(non-static).
TAutoConsoleVariable<float> CVarHktSpriteFacingMinSpeed(
	TEXT("hkt.Sprite.Facing.MinSpeed"),
	5.f,
	TEXT("AHktSpriteCrowdHost / AHktSpritePaperActor 클라이언트 facing 산출의 ")
	TEXT("최소 XY 속도(cm/s). 이 미만이면 LastMoveDirXY 갱신 생략(sticky)."),
	ECVF_Default);

namespace
{
	// CharacterTag 가 본 호스트의 클레임(`Entity.Character.Crowd.*`) 에 속하는지 판정.
	// 각 sprite 호스트(Paper / Crowd / Niagara) 는 자기 클레임 태그 prefix 만 처리한다.
	FORCEINLINE bool IsCrowdCharacterTag(const FGameplayTag& CharacterTag)
	{
		return CharacterTag.MatchesTag(HktSpriteCoreTags::Entity_Character_Crowd);
	}
}

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

FHktSpriteAnimFragment& AHktSpriteCrowdHost::GetOrCreateAnimFragment(FHktEntityId Id)
{
	return AnimFragments.FindOrAdd(Id);
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
	AnimFragments.Empty();
	PendingDeltaSec = 0.f;
}

void AHktSpriteCrowdHost::OnCameraViewChanged(FHktPresentationState& State)
{
	// 카메라 yaw 변화 시 Facing 변환이 달라지므로 즉시 재반영.
	// DeltaSec=0 으로 호출하여 LocalNowSec 이 두 번 가속되지 않게 한다.
	UpdateEntitiesPerFrame(State);
}

void AHktSpriteCrowdHost::Tick(FHktPresentationState& State, float DeltaTime)
{
	// DeltaTime 을 보존 — UpdateEntitiesPerFrame 가 TickViewModel 에 전달.
	PendingDeltaSec = DeltaTime;
	UpdateEntitiesPerFrame(State);
	PendingDeltaSec = 0.f;
}

void AHktSpriteCrowdHost::Sync(FHktPresentationState& State)
{
	if (!Renderer) return;

	const int64 Frame = State.GetCurrentFrame();

	// --- 1. Removed ---
	for (FHktEntityId Id : State.RemovedThisFrame)
	{
		Renderer->UnregisterEntity(Id);
		AnimFragments.Remove(Id);
	}

	// --- 2. Spawned: FHktSpriteView가 할당된 엔터티만 처리 ---
	for (FHktEntityId Id : State.SpawnedThisFrame)
	{
		const FHktSpriteView* SV = State.GetSprite(Id);
		if (!SV) continue;

		// 본 호스트는 `Entity.Character.Crowd.*` 만 처리 — 그 외 sprite 엔터티는 다른 호스트
		// (Paper/Niagara) 가 담당. 클레임 미일치 시 dispatch 단계에서 일찍 거른다.
		if (!IsCrowdCharacterTag(SV->Character.Get())) continue;

		Renderer->RegisterEntity(Id);

		// 캐릭터 1개 = UHktHISMSpriteVisualAsset 1개. SpawnEntity의 ClassTag(=EntitySpawnTag)를
		// 그대로 Visual Tag 로 사용한다 (Visual 내부의 AnimationAsset 으로 anim 분기).
		Renderer->SetCharacter(Id, SV->Character.Get());

		// 초기 상태에서 Anim Tag Container를 한 번 동기화
		if (const FHktAnimationView* AV = State.GetAnimation(Id))
		{
			FHktSpriteAnimFragment& Frag = GetOrCreateAnimFragment(Id);
			HktSpriteAnimProcessor::SyncFromTagContainer(Frag, AV->Tags);
		}
	}

	// --- 3. Character diff: CharacterTemplate 태그 변경분만 반영 ---
	for (auto It = State.Sprites.CreateConstIterator(); It; ++It)
	{
		const FHktEntityId Id = static_cast<FHktEntityId>(It.GetIndex());
		const FHktSpriteView& SV = *It;
		if (!SV.Character.IsDirty(Frame)) continue;

		// 클레임 미일치(Paper / Niagara / 그 외) 로 전환된 경우 — 기존 등록 정리 후 skip.
		// (UnregisterEntity 는 미등록 Id 에 대해 idempotent)
		if (!IsCrowdCharacterTag(SV.Character.Get()))
		{
			Renderer->UnregisterEntity(Id);
			continue;
		}

		Renderer->SetCharacter(Id, SV.Character.Get());
	}

	// per-entity frame cursor 계산은 Tick(UpdateEntitiesPerFrame)에서 수행 — 매 render frame 진행.
}

namespace
{
	// HISM/Niagara Animation 자산에서 anim 의 1-cycle duration 을 산출. ExpireActionLayers
	// 콜백으로 사용 — Renderer 가 그릴 수 있는 anim 만 expire 후보. 자산 미존재 → 0 반환
	// → 즉시 만료(렌더 불가능 layer 가 Locomotion 차단 중인 상황 해소).
	float QueryHISMAnimDurationSec(const UHktHISMSpriteVisualAsset* Visual, const FGameplayTag& AnimTag)
	{
		if (!Visual || !Visual->AnimationAsset) return 0.f;
		const FHktSpriteAnimation* Anim = Visual->AnimationAsset->FindAnimation(AnimTag);
		if (!Anim) return 0.f;
		if (Anim->FramesPerDirection <= 0) return 0.f;

		// PerFrameDurationMs 가 있으면 그것의 합을 사용, 아니면 (FramesPerDirection * FrameDurationMs).
		float TotalMs = 0.f;
		if (Anim->PerFrameDurationMs.Num() > 0)
		{
			for (float Ms : Anim->PerFrameDurationMs) TotalMs += Ms;
		}
		else
		{
			TotalMs = Anim->FramesPerDirection * Anim->FrameDurationMs;
		}
		return TotalMs * 0.001f;
	}
}

void AHktSpriteCrowdHost::UpdateEntitiesPerFrame(FHktPresentationState& State)
{
	if (!Renderer) return;

	const int64 Frame = State.GetCurrentFrame();
	const float MinFacingSpeed = CVarHktSpriteFacingMinSpeed.GetValueOnGameThread();
	const double DeltaSec = static_cast<double>(PendingDeltaSec);

	for (auto It = State.Sprites.CreateConstIterator(); It; ++It)
	{
		const FHktEntityId Id = static_cast<FHktEntityId>(It.GetIndex());
		const FHktSpriteView& SV = *It;

		// 본 호스트 클레임 외 엔터티는 Fragment / Renderer 작업 모두 생략.
		if (!IsCrowdCharacterTag(SV.Character.Get())) continue;

		const FHktTransformView* TV = State.GetTransform(Id);
		if (!TV) continue;

		FHktSpriteAnimFragment& Frag = GetOrCreateAnimFragment(Id);

		// 1) WorldView 흡수 (Movement/Combat/Animation 뷰 → Fragment).
		const bool bFacingSourceDirty = HktSpriteAnimProcessor::AbsorbViews(
			Frag, State, Id, Frame, MinFacingSpeed);

		// 2) Per-frame VM 산출. 카메라 yaw 변화도 매 호출 재반영.
		FHktSpriteAnimViewModel VM;
		HktSpriteAnimProcessor::TickViewModel(Frag,
			SV.AnimStartTick.Get(), DeltaSec, CameraYawDeg,
			VM, bLoggedResolveRenderOutputsFailure);

		// 3) Anim.Action.* 자동 만료 (resolve 이후) — Renderer-specific duration query.
		//    이번 프레임 resolve 가 action layer 를 픽한 뒤 만료 — 다음 프레임 Locomotion 폴백.
		const UHktHISMSpriteVisualAsset* Visual = Renderer->ResolveVisualAsset(SV.Character.Get());
		HktSpriteAnimProcessor::ExpireActionLayers(Frag, Frag.LocalNowSec,
			[Visual](const FGameplayTag& AnimTag) { return QueryHISMAnimDurationSec(Visual, AnimTag); });

		// 4) 클라 산출 Facing 을 SpriteView 에 기록 — facing 소스 dirty 인 프레임에만.
		//   (카메라 yaw 회전만으로는 ViewModel 미갱신 — Renderer 는 VM.Facing 으로 즉시 반영.)
		if (bFacingSourceDirty)
		{
			if (FHktSpriteView* MutableSV = State.GetMutableSprite(Id))
			{
				MutableSV->Facing.Set(static_cast<uint8>(VM.Facing), Frame);
				MutableSV->FacingRight.Set(VM.bFacingRight ? 1 : 0, Frame);
			}
		}

		// 5) Renderer Dispatch — VM 을 그대로 Renderer 입력으로 변환.
		//   FrameResolver 는 ms 도메인 NowTick/AnimStartTick 입력을 받으므로 sec → ms 변환.
		FHktSpriteEntityUpdate Update;
		Update.WorldLocation  = TV->RenderLocation.Get().IsZero() ? TV->Location.Get() : TV->RenderLocation.Get();
		Update.Facing         = VM.Facing;
		Update.AnimTag        = VM.AnimTag;
		Update.AnimStartTick  = static_cast<int64>(VM.AnimStartLocalSec * 1000.0);
		Update.NowTick        = static_cast<int64>(VM.LocalNowSec * 1000.0);
		Update.TickDurationMs = 1.0f;
		Update.PlayRate       = VM.PlayRate;
		Update.TintOverride   = FLinearColor::White;
		Update.PaletteIndex   = 0;

		Renderer->UpdateEntity(Id, Update);
	}
}
