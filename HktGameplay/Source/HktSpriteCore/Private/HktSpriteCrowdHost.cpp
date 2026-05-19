// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteCrowdHost.h"
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

void AHktSpriteCrowdHost::UpdateEntitiesPerFrame(FHktPresentationState& State)
{
	if (!Renderer) return;

	const int64 Frame = State.GetCurrentFrame();

	for (auto It = State.Sprites.CreateConstIterator(); It; ++It)
	{
		const FHktEntityId Id = static_cast<FHktEntityId>(It.GetIndex());
		const FHktSpriteView& SV = *It;

		// 본 호스트 클레임 외 엔터티는 Fragment / Renderer 작업 모두 생략.
		if (!IsCrowdCharacterTag(SV.Character.Get())) continue;

		const FHktTransformView* TV = State.GetTransform(Id);
		if (!TV) continue;

		FHktSpriteAnimFragment& Frag = GetOrCreateAnimFragment(Id);

		// Facing ViewModel 기록 트리거 — 소스(LastMoveDirXY) 또는 anim tag 가 dirty 일 때만.
		// 카메라 yaw 변화로 인한 재계산은 ViewModel 에 반영하지 않음 (렌더러만 사용).
		bool bFacingSourceDirty = false;

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
				const FVector2D VelXY(Vel.X, Vel.Y);
				Frag.MoveSpeed    = VelXY.Size();
				Frag.FallingSpeed = Vel.Z;

				// Sticky: 임계 이상으로 움직였을 때만 facing 입력 갱신.
				const float MinSpeed = CVarHktSpriteFacingMinSpeed.GetValueOnGameThread();
				if (Frag.MoveSpeed >= MinSpeed)
				{
					Frag.LastMoveDirXY = VelXY;
					bFacingSourceDirty = true;
				}
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
				bFacingSourceDirty = true; // anim tag 직접 전달 시 facing 스냅샷 갱신
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
		// Facing 은 클라 viewmodel 산출 — 서버 SV.Facing 무시.
		// 카메라 yaw 가 회전해도 매 프레임 자연스럽게 따라가도록 LastMoveDirXY(world) 와
		// 현재 CameraYawDeg 로 매 프레임 재계산. 한 번도 움직이지 않은 엔터티는 카메라
		// 정면(S) 폴백.
		EHktSpriteFacing ClientFacing = EHktSpriteFacing::S;
		if (!Frag.LastMoveDirXY.IsNearlyZero())
		{
			const float DirYawDeg = FMath::RadiansToDegrees(
				FMath::Atan2(Frag.LastMoveDirXY.Y, Frag.LastMoveDirXY.X));
			ClientFacing = HktFacingFromYaw(DirYawDeg, CameraYawDeg);
		}

		// 클라 산출 Facing 을 ViewModel 에 기록 — 소스(LastMoveDirXY) 또는 anim tag dirty 인 프레임에만.
		// 카메라 yaw 회전만으로는 ViewModel 을 갱신하지 않음 (렌더러는 위 ClientFacing 으로 즉시 반영).
		if (bFacingSourceDirty)
		{
			if (FHktSpriteView* MutableSV = State.GetMutableSprite(Id))
			{
				MutableSV->Facing.Set(static_cast<uint8>(ClientFacing), Frame);
			}
		}

		FHktSpriteEntityUpdate Update;
		Update.WorldLocation  = TV->RenderLocation.Get().IsZero() ? TV->Location.Get() : TV->RenderLocation.Get();
		Update.Facing         = ClientFacing;
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
