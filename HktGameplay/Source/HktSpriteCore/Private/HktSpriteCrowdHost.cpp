// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteCrowdHost.h"
#include "HktSpriteAnimProcessor.h"
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
	AnimStartLocalMs.Empty();
	LastAuthoritativeAnimStartTick.Empty();
	LocalNowMs = 0.0;
}

void AHktSpriteCrowdHost::OnCameraViewChanged(FHktPresentationState& State)
{
	// 카메라 yaw 변화 시 Facing 변환이 달라지므로 즉시 재반영.
	UpdateEntitiesPerFrame(State);
}

void AHktSpriteCrowdHost::Tick(FHktPresentationState& State, float DeltaTime)
{
	// 로컬 실시간 클럭 누적 — 서버 batch 가 없어도 애니메이션이 진행되도록 함.
	LocalNowMs += static_cast<double>(DeltaTime) * 1000.0;

	UpdateEntitiesPerFrame(State);
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
		AnimStartLocalMs.Remove(Id);
		LastAuthoritativeAnimStartTick.Remove(Id);
	}

	// --- 2. Spawned: FHktSpriteView가 할당된 엔터티만 처리 ---
	for (FHktEntityId Id : State.SpawnedThisFrame)
	{
		const FHktSpriteView* SV = State.GetSprite(Id);
		if (!SV) continue;

		Renderer->RegisterEntity(Id);

		// 캐릭터 1개 = UHktSpriteCharacterTemplate 1개. SpawnEntity의 ClassTag(=EntitySpawnTag)를
		// 그대로 Template Tag로 사용한다 (Template 내부에서 향후 파츠 분기는 가능).
		Renderer->SetCharacter(Id, SV->Character.Get());

		// 초기 상태에서 Anim Tag Container를 한 번 동기화
		if (const FHktAnimationView* AV = State.GetAnimation(Id))
		{
			FHktSpriteAnimFragment& Frag = GetOrCreateAnimFragment(Id);
			HktSpriteAnimProcessor::SyncFromTagContainer(Frag, AV->Tags);
		}

		// Spawn 시점의 로컬 시각을 anim 시작 시각으로 등록.
		AnimStartLocalMs.Add(Id, LocalNowMs);
		LastAuthoritativeAnimStartTick.Add(Id, SV->AnimStartTick.Get());
	}

	// --- 3. Character diff: CharacterTemplate 태그 변경분만 반영 ---
	for (auto It = State.Sprites.CreateConstIterator(); It; ++It)
	{
		const FHktEntityId Id = static_cast<FHktEntityId>(It.GetIndex());
		const FHktSpriteView& SV = *It;
		if (!SV.Character.IsDirty(Frame)) continue;
		Renderer->SetCharacter(Id, SV.Character.Get());
	}

	// per-entity frame cursor 계산은 Tick(UpdateEntitiesPerFrame)에서 수행 — 매 render frame 진행.
}

void AHktSpriteCrowdHost::UpdateEntitiesPerFrame(FHktPresentationState& State)
{
	if (!Renderer) return;

	const int64 Frame = State.GetCurrentFrame();

	for (auto It = State.Sprites.CreateConstIterator(); It; ++It)
	{
		const FHktEntityId Id = static_cast<FHktEntityId>(It.GetIndex());
		const FHktSpriteView& SV = *It;

		const FHktTransformView* TV = State.GetTransform(Id);
		if (!TV) continue;

		FHktSpriteAnimFragment& Frag = GetOrCreateAnimFragment(Id);

		// Fragment 입력: Movement/Combat/Animation 뷰에서 파라미터 흡수.
		// IsDirty(Frame) 은 sim batch 가 막 도착한 프레임에서만 true — 이후 render frame 들에서는
		// false 가 되어 idempotent. 새 batch 도착 시점에만 갱신 시도.
		if (const FHktMovementView* MV = State.GetMovement(Id))
		{
			if (MV->bIsMoving.IsDirty(Frame))  Frag.bIsMoving  = MV->bIsMoving.Get();
			if (MV->bIsJumping.IsDirty(Frame)) Frag.bIsFalling = MV->bIsJumping.Get();
			if (MV->Velocity.IsDirty(Frame))
			{
				const FVector Vel = MV->Velocity.Get();
				Frag.MoveSpeed    = FVector2D(Vel.X, Vel.Y).Size();
				Frag.FallingSpeed = Vel.Z;
			}
		}

		if (const FHktCombatView* CV = State.GetCombat(Id))
		{
			if (CV->MotionPlayRate.IsDirty(Frame) || CV->AttackSpeed.IsDirty(Frame))
			{
				const int32 RawRate = CV->MotionPlayRate.Get();
				float SpeedScale = (RawRate > 0)
					? static_cast<float>(RawRate) / 100.0f
					: static_cast<float>(CV->AttackSpeed.Get()) / 100.0f;
				if (SpeedScale <= 0.0f) SpeedScale = 1.0f;
				Frag.AttackPlayRate = SpeedScale;
			}
			if (CV->CPRatio.IsDirty(Frame)) Frag.CPRatio = CV->CPRatio.Get();
		}

		if (FHktAnimationView* AV = State.GetMutableAnimation(Id))
		{
			if (AV->TagsDirtyFrame == Frame)
			{
				HktSpriteAnimProcessor::SyncFromTagContainer(Frag, AV->Tags);
			}
			if (AV->PendingAnimTriggers.Num() > 0)
			{
				for (const FGameplayTag& AnimTag : AV->PendingAnimTriggers)
				{
					HktSpriteAnimProcessor::ApplyAnimTag(Frag, AnimTag);
				}
				AV->PendingAnimTriggers.Reset();
			}
		}

		// --- 서버 권위 AnimStartTick → 로컬 ms 시각으로 변환 ---
		// 서버는 sim frame 단위 정수 AnimStartTick 만 통보. 클라는 그 값이 *변할 때마다*
		// 로컬 실시간 시각(LocalNowMs)을 anim 시작점으로 캡처해서 매 render frame 진행시킨다.
		// 이렇게 하면 idle 처럼 서버가 추가 batch 를 안 보내도 frame cursor 가 멈추지 않는다.
		const int32 ServerStartTick = SV.AnimStartTick.Get();
		int32* LastSeen = LastAuthoritativeAnimStartTick.Find(Id);
		if (!LastSeen || *LastSeen != ServerStartTick)
		{
			AnimStartLocalMs.FindOrAdd(Id) = LocalNowMs;
			LastAuthoritativeAnimStartTick.FindOrAdd(Id) = ServerStartTick;
		}
		const double EntityAnimStartMs = AnimStartLocalMs.FindOrAdd(Id);

		// 최종 렌더 출력 결정 (AnimTag / PlayRate).
		FGameplayTag AnimTag;
		float PlayRate = 1.f;
		HktSpriteAnimProcessor::ResolveRenderOutputs(Frag, AnimTag, PlayRate, bLoggedResolveRenderOutputsFailure);

		// FrameResolver 에 ms 도메인으로 전달:
		//   ElapsedMs = (NowTick - AnimStartTick) * TickDurationMs
		// 여기서 NowTick=LocalNowMs, AnimStartTick=EntityAnimStartMs, TickDurationMs=1.0
		// 이면 ElapsedMs == LocalNowMs - EntityAnimStartMs (실시간 ms).
		FHktSpriteEntityUpdate Update;
		Update.WorldLocation  = TV->RenderLocation.Get().IsZero() ? TV->Location.Get() : TV->RenderLocation.Get();
		Update.Facing         = static_cast<EHktSpriteFacing>(SV.Facing.Get() & 0x07);
		Update.AnimTag        = AnimTag;
		Update.AnimStartTick  = static_cast<int64>(EntityAnimStartMs);
		Update.NowTick        = static_cast<int64>(LocalNowMs);
		Update.TickDurationMs = 1.0f;
		Update.PlayRate       = PlayRate;
		Update.TintOverride   = FLinearColor::White;
		Update.PaletteIndex   = 0;

		Renderer->UpdateEntity(Id, Update);
	}
}
