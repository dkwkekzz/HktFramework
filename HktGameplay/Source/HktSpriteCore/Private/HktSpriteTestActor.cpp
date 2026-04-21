// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteTestActor.h"
#include "HktSpriteCrowdRenderer.h"
#include "HktSpriteCoreLog.h"
#include "Components/SceneComponent.h"

// 다수 AHktSpriteTestActor를 월드에 배치할 때 EntityId 충돌 방지용.
// 전역 카운터 — 각 액터 인스턴스가 고유 ID를 확보.
int32 AHktSpriteTestActor::AllocateTestEntityId()
{
	static int32 Next = 1000; // 실제 VM 엔터티 ID와 안 겹치도록 여유있게 시작
	return Next++;
}

AHktSpriteTestActor::AHktSpriteTestActor()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.bStartWithTickEnabled = true;

	USceneComponent* Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	SetRootComponent(Root);

	// UActorComponent라 Attach 불가 — CreateDefaultSubobject로 생성만
	Renderer = CreateDefaultSubobject<UHktSpriteCrowdRenderer>(TEXT("CrowdRenderer"));
}

void AHktSpriteTestActor::BeginPlay()
{
	Super::BeginPlay();

	TestEntityId = AllocateTestEntityId();
	ElapsedSeconds = 0.0;

	EnsureRendererAndLoadout();
}

void AHktSpriteTestActor::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	if (Renderer)
	{
		Renderer->UnregisterEntity(TestEntityId);
	}
	Super::EndPlay(EndPlayReason);
}

void AHktSpriteTestActor::EnsureRendererAndLoadout()
{
	if (!Renderer) return;

	Renderer->QuadMesh = QuadMesh;
	Renderer->SpriteMaterialTemplate = SpriteMaterial;
	Renderer->GlobalWorldScale = GlobalWorldScale;

	Renderer->RegisterEntity(TestEntityId);
	Renderer->SetLoadout(TestEntityId, BuildLoadout());
}

FHktSpriteLoadout AHktSpriteTestActor::BuildLoadout() const
{
	FHktSpriteLoadout L;
	L.BodyPart    = BodyPart;
	L.HeadPart    = HeadPart;
	L.WeaponPart  = WeaponPart;
	L.ShieldPart  = ShieldPart;
	L.HeadgearTop = HeadgearTop;
	L.HeadgearMid = HeadgearMid;
	L.HeadgearLow = HeadgearLow;
	return L;
}

void AHktSpriteTestActor::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (!Renderer) return;

	ElapsedSeconds += DeltaSeconds;

	const float TickHz = FMath::Max(SimulatedTickHz, 1.f);
	const float TickDurationMs = 1000.f / TickHz;
	const int64 AnimStartTick = 0;
	const int64 NowTick = static_cast<int64>(ElapsedSeconds * static_cast<double>(TickHz));

	FHktSpriteEntityUpdate Update;
	Update.WorldLocation  = GetActorLocation();
	Update.Facing         = Facing;
	Update.ActionId       = ActionId;
	Update.AnimStartTick  = AnimStartTick;
	Update.NowTick        = NowTick;
	Update.TickDurationMs = TickDurationMs;
	Update.PlayRate       = PlayRate;
	Update.TintOverride   = TintOverride;
	Update.PaletteIndex   = PaletteIndex;

	Renderer->UpdateEntity(TestEntityId, Update);
}

#if WITH_EDITOR
void AHktSpriteTestActor::PostEditChangeProperty(FPropertyChangedEvent& PropertyChangedEvent)
{
	Super::PostEditChangeProperty(PropertyChangedEvent);

	// PIE 중 속성 조작 시 즉시 반영 (Loadout / Mesh 등)
	if (HasActorBegunPlay() && Renderer)
	{
		EnsureRendererAndLoadout();
	}
}
#endif
