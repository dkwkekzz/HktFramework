// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteCrowdHost.h"
#include "HktSpriteAnimInstance.h"
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
	EnsureAnimInstance();
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

void AHktSpriteCrowdHost::EnsureAnimInstance()
{
	if (AnimInstance) return;

	UClass* Cls = AnimInstanceClass ? AnimInstanceClass.Get() : UHktSpriteAnimInstance::StaticClass();
	AnimInstance = NewObject<UHktSpriteAnimInstance>(this, Cls);
}

FHktSpriteAnimState& AHktSpriteCrowdHost::GetOrCreateAnimState(FHktEntityId Id)
{
	return AnimStates.FindOrAdd(Id);
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
	AnimStates.Empty();
}

void AHktSpriteCrowdHost::OnCameraViewChanged(FHktPresentationState& State)
{
	// 카메라 yaw 변화 시 Facing 변환이 달라지므로 전체 Sync 강제.
	Sync(State);
}

void AHktSpriteCrowdHost::Sync(FHktPresentationState& State)
{
	if (!Renderer) return;
	EnsureAnimInstance();

	const int64 Frame = State.GetCurrentFrame();

	// --- 1. Removed ---
	for (FHktEntityId Id : State.RemovedThisFrame)
	{
		Renderer->UnregisterEntity(Id);
		AnimStates.Remove(Id);
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

		// 초기 상태에서 Anim Tag Container/Stance를 한 번 동기화
		if (const FHktAnimationView* AV = State.GetAnimation(Id))
		{
			FHktSpriteAnimState& AnimState = GetOrCreateAnimState(Id);
			AnimInstance->SyncStance(AnimState, AV->Stance.Get());
			AnimInstance->SyncFromTagContainer(AnimState, AV->Tags, Frame);
		}
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
	//     모든 스프라이트 엔터티를 순회해 AnimInstance 상태 갱신 → 프레임/트랜스폼 재적용.
	//     NowTick으로는 State.GetCurrentFrame()을 사용 (히트스톱은 후속 확장).
	const int64 NowTick = Frame;

	for (auto It = State.Sprites.CreateConstIterator(); It; ++It)
	{
		const FHktEntityId Id = static_cast<FHktEntityId>(It.GetIndex());
		const FHktSpriteView& SV = *It;

		const FHktTransformView* TV = State.GetTransform(Id);
		if (!TV) continue;

		FHktSpriteAnimState& AnimState = GetOrCreateAnimState(Id);

		// AnimInstance 입력: Movement/Combat/Animation 뷰에서 파라미터 흡수.
		// (AHktUnitActor::ApplyMovement/ApplyCombat/ApplyAnimation과 동일 역할 통합)
		if (const FHktMovementView* MV = State.GetMovement(Id))
		{
			if (MV->bIsMoving.IsDirty(Frame))  AnimState.bIsMoving  = MV->bIsMoving.Get();
			if (MV->bIsJumping.IsDirty(Frame)) AnimState.bIsFalling = MV->bIsJumping.Get();
			if (MV->Velocity.IsDirty(Frame))
			{
				const FVector Vel = MV->Velocity.Get();
				AnimState.MoveSpeed    = FVector2D(Vel.X, Vel.Y).Size();
				AnimState.FallingSpeed = Vel.Z;
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
				AnimState.AttackPlayRate = SpeedScale;
			}
			if (CV->CPRatio.IsDirty(Frame)) AnimState.CPRatio = CV->CPRatio.Get();
		}

		int64 FallbackAnimStartTick = SV.AnimStartTick.Get();

		if (FHktAnimationView* AV = State.GetMutableAnimation(Id))
		{
			if (AV->Stance.IsDirty(Frame))
			{
				AnimInstance->SyncStance(AnimState, AV->Stance.Get());
			}
			if (AV->TagsDirtyFrame == Frame)
			{
				AnimInstance->SyncFromTagContainer(AnimState, AV->Tags, NowTick);
			}
			// 일회성 트리거 소비 (AHktUnitActor::ApplyAnimation과 동일)
			if (AV->PendingAnimTriggers.Num() > 0)
			{
				for (const FGameplayTag& AnimTag : AV->PendingAnimTriggers)
				{
					AnimInstance->ApplyAnimTag(AnimState, AnimTag, NowTick);
				}
				AV->PendingAnimTriggers.Reset();
			}
		}

		// 최종 렌더 출력 결정
		FName   ActionId       = NAME_None;
		float   PlayRate       = 1.f;
		int64   AnimStartTick  = FallbackAnimStartTick;
		AnimInstance->ResolveRenderOutputs(AnimState, FallbackAnimStartTick, ActionId, PlayRate, AnimStartTick);

		FHktSpriteEntityUpdate Update;
		Update.WorldLocation  = TV->RenderLocation.Get().IsZero() ? TV->Location.Get() : TV->RenderLocation.Get();
		Update.Facing         = static_cast<EHktSpriteFacing>(SV.Facing.Get() & 0x07);
		Update.ActionId       = ActionId;
		Update.AnimStartTick  = AnimStartTick;
		Update.NowTick        = NowTick;
		Update.TickDurationMs = TickDurationMs;
		Update.PlayRate       = PlayRate;
		Update.TintOverride   = FLinearColor::White;
		Update.PaletteIndex   = 0;

		Renderer->UpdateEntity(Id, Update);
	}
}
