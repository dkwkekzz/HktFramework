// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVoxelUnitActorBase.h"
#include "HktAnimInstance.h"
#include "HktPresentationState.h"
#include "HktCoreProperties.h"
#include "HktVoxelSkinLayerAsset.h"
#include "Rendering/HktVoxelChunkComponent.h"
#include "Data/HktVoxelRenderCache.h"
#include "Data/HktVoxelTypes.h"
#include "Meshing/HktVoxelMeshScheduler.h"
#include "Settings/HktRuntimeGlobalSetting.h"
#include "Components/SkeletalMeshComponent.h"
#include "GameplayTagContainer.h"

const FIntVector AHktVoxelUnitActorBase::EntityChunkCoord = FIntVector::ZeroValue;

AHktVoxelUnitActorBase::~AHktVoxelUnitActorBase()
{
	MeshScheduler.Reset();
}

AHktVoxelUnitActorBase::AHktVoxelUnitActorBase()
{
	PrimaryActorTick.bCanEverTick = true;

	RootScene = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	RootComponent = RootScene;

	BodyChunk = CreateDefaultSubobject<UHktVoxelChunkComponent>(TEXT("BodyChunk"));
	BodyChunk->SetupAttachment(RootScene);

	HiddenSkeleton = CreateDefaultSubobject<USkeletalMeshComponent>(TEXT("HiddenSkeleton"));
	HiddenSkeleton->SetupAttachment(RootScene);
	HiddenSkeleton->SetVisibility(false);
	HiddenSkeleton->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	HiddenSkeleton->SetComponentTickEnabled(false);
}

void AHktVoxelUnitActorBase::BeginPlay()
{
	Super::BeginPlay();

	EntityRenderCache = MakeShared<FHktVoxelRenderCache>();

	const UHktRuntimeGlobalSetting* Settings = GetDefault<UHktRuntimeGlobalSetting>();
	const float VoxelSizeCm = Settings ? Settings->VoxelSizeCm : FHktVoxelChunk::VOXEL_SIZE;

	MeshScheduler = MakeUnique<FHktVoxelMeshScheduler>(EntityRenderCache.Get());
	MeshScheduler->SetMaxMeshPerFrame(1);
	MeshScheduler->SetVoxelSize(VoxelSizeCm);

	BodyChunk->Initialize(EntityRenderCache.Get(), EntityChunkCoord, VoxelSizeCm);

	const float HalfChunkVoxels = FHktVoxelChunk::SIZE * 0.5f - 0.5f;
	const float Offset = -HalfChunkVoxels * VoxelSizeCm;
	BodyChunk->SetRelativeLocation(FVector(Offset, Offset, 0.f));

	InitializeVoxelMesh();
	OnSkinSetChanged(0);
	OnPaletteChanged(0);
}

void AHktVoxelUnitActorBase::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);

	constexpr float InterpSpeed = 15.f;
	InterpLocation = FMath::VInterpTo(InterpLocation, CachedRenderLocation, DeltaTime, InterpSpeed);
	InterpRotation = FMath::RInterpTo(InterpRotation, CachedRotation, DeltaTime, InterpSpeed);

	SetActorLocationAndRotation(
		InterpLocation, InterpRotation,
		false, nullptr, ETeleportType::TeleportPhysics);

	if (MeshScheduler)
	{
		MeshScheduler->Tick(InterpLocation);
	}

	PollMeshReady();
	TickAnimation(DeltaTime);
}

void AHktVoxelUnitActorBase::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	MeshScheduler.Reset();
	EntityRenderCache.Reset();
	Super::EndPlay(EndPlayReason);
}

// ============================================================================
// IHktPresentableActor 구현 — SOA 뷰별 Apply
// ============================================================================

void AHktVoxelUnitActorBase::ApplyTransform(const FHktTransformView& V)
{
	CachedRenderLocation = V.RenderLocation.Get();
	CachedRotation = V.Rotation.Get();
	if (!bHasInitialTransform)
	{
		InterpLocation = CachedRenderLocation;
		InterpRotation = CachedRotation;
		bHasInitialTransform = true;
	}
}

void AHktVoxelUnitActorBase::ApplyMovement(const FHktMovementView& V, int64 Frame, bool bForce)
{
	if (!IsBoneAnimationActive()) return;

	UHktAnimInstance* HktAnim = GetAnimInstance();
	if (!HktAnim) return;

	if (bForce || V.bIsMoving.IsDirty(Frame))
		HktAnim->bIsMoving = V.bIsMoving.Get();

	if (bForce || V.bIsJumping.IsDirty(Frame))
		HktAnim->bIsFalling = V.bIsJumping.Get();

	if (bForce || V.Velocity.IsDirty(Frame))
	{
		const FVector Vel = V.Velocity.Get();
		HktAnim->MoveSpeed = FVector2D(Vel.X, Vel.Y).Size();
		HktAnim->FallingSpeed = Vel.Z;
		HktAnim->BlendSpaceX = HktAnim->MoveSpeed;
	}
}

void AHktVoxelUnitActorBase::ApplyCombat(const FHktCombatView& V, int64 Frame, bool bForce)
{
	if (!IsBoneAnimationActive()) return;

	UHktAnimInstance* HktAnim = GetAnimInstance();
	if (!HktAnim) return;

	if (bForce || V.MotionPlayRate.IsDirty(Frame) || V.AttackSpeed.IsDirty(Frame))
	{
		const int32 RawRate = V.MotionPlayRate.Get();
		float SpeedScale = (RawRate > 0)
			? static_cast<float>(RawRate) / 100.0f
			: static_cast<float>(V.AttackSpeed.Get()) / 100.0f;
		if (SpeedScale <= 0.0f) SpeedScale = 1.0f;
		HktAnim->AttackPlayRate = SpeedScale;
	}

	if (bForce || V.CPRatio.IsDirty(Frame))
		HktAnim->CPRatio = V.CPRatio.Get();
}

void AHktVoxelUnitActorBase::ApplyAnimation(FHktAnimationView& V, int64 Frame, bool bForce)
{
	if (!IsBoneAnimationActive()) return;

	UHktAnimInstance* HktAnim = GetAnimInstance();
	if (!HktAnim) return;

	if (bForce || V.Stance.IsDirty(Frame))
		HktAnim->SyncStance(V.Stance.Get());

	if (bForce || V.TagsDirtyFrame == Frame)
		HktAnim->SyncFromTagContainer(V.Tags);

	if (V.PendingAnimTriggers.Num() > 0)
	{
		for (const FGameplayTag& AnimTag : V.PendingAnimTriggers)
		{
			HktAnim->ApplyAnimTag(AnimTag);
		}
		V.PendingAnimTriggers.Reset();
	}
}

void AHktVoxelUnitActorBase::ApplyVoxelSkin(const FHktVoxelSkinView& V, int64 Frame, bool bForce)
{
	if (bForce || V.VoxelSkinSet.IsDirty(Frame))
	{
		const uint16 NewSkinSet = static_cast<uint16>(V.VoxelSkinSet.Get());
		if (NewSkinSet != CachedSkinSetID)
		{
			OnSkinSetChanged(NewSkinSet);
		}
	}

	if (bForce || V.VoxelPalette.IsDirty(Frame))
	{
		const uint8 NewPalette = static_cast<uint8>(V.VoxelPalette.Get());
		if (NewPalette != CachedPaletteRow)
		{
			OnPaletteChanged(NewPalette);
		}
	}
}

// ============================================================================
// 스킨 / 에셋
// ============================================================================

UHktVoxelSkinLayerAsset* AHktVoxelUnitActorBase::GetDefaultAssetForLayer(EHktVoxelSkinLayer::Type Layer) const
{
	switch (Layer)
	{
	case EHktVoxelSkinLayer::Body:  return DefaultBodyAsset;
	case EHktVoxelSkinLayer::Head:  return DefaultHeadAsset;
	case EHktVoxelSkinLayer::Armor: return DefaultArmorAsset;
	default: return nullptr;
	}
}

void AHktVoxelUnitActorBase::InitializeVoxelMesh()
{
	if (!EntityRenderCache) return;

	auto SetupLayer = [this](EHktVoxelSkinLayer::Type Layer)
	{
		UHktVoxelSkinLayerAsset* Asset = GetDefaultAssetForLayer(Layer);
		if (!Asset) return;

		FHktVoxelSkinLayerData LayerData;
		LayerData.Layer = Layer;
		LayerData.SkinID.SkinSetID = CachedSkinSetID;
		LayerData.SkinID.PaletteRow = CachedPaletteRow;
		LayerData.bVisible = true;
		LayerData.VoxelLayerAsset = Asset;
		SkinAssembler.SetLayer(Layer, LayerData);
	};

	SetupLayer(EHktVoxelSkinLayer::Body);
	SetupLayer(EHktVoxelSkinLayer::Head);
	SetupLayer(EHktVoxelSkinLayer::Armor);

	if (!SkinAssembler.GetLayer(EHktVoxelSkinLayer::Body))
	{
		FHktVoxelSkinLayerData BodyLayer;
		BodyLayer.Layer = EHktVoxelSkinLayer::Body;
		BodyLayer.SkinID.SkinSetID = CachedSkinSetID;
		BodyLayer.SkinID.PaletteRow = CachedPaletteRow;
		BodyLayer.bVisible = true;
		SkinAssembler.SetLayer(EHktVoxelSkinLayer::Body, BodyLayer);
	}

	FHktVoxelChunk TempChunk;
	TempChunk.ChunkCoord = EntityChunkCoord;
	SkinAssembler.Assemble(TempChunk);

	const int32 VoxelCount = FHktVoxelChunk::SIZE * FHktVoxelChunk::SIZE * FHktVoxelChunk::SIZE;
	EntityRenderCache->LoadChunk(EntityChunkCoord, &TempChunk.Data[0][0][0], VoxelCount);
}

void AHktVoxelUnitActorBase::OnSkinSetChanged(uint16 NewSkinSetID)
{
	CachedSkinSetID = NewSkinSetID;

	for (int32 i = 0; i < EHktVoxelSkinLayer::Count; i++)
	{
		auto Layer = static_cast<EHktVoxelSkinLayer::Type>(i);
		const FHktVoxelSkinLayerData* Existing = SkinAssembler.GetLayer(Layer);
		if (Existing)
		{
			FHktVoxelSkinLayerData Updated = *Existing;
			Updated.SkinID.SkinSetID = NewSkinSetID;
			SkinAssembler.SetLayer(Layer, Updated);
		}
	}

	if (!EntityRenderCache) return;

	if (SkinAssembler.HasAnyBoneData())
	{
		TArray<FHktVoxelBoneGroup> AllBoneGroups;
		for (int32 i = 0; i < EHktVoxelSkinLayer::Count; i++)
		{
			const FHktVoxelSkinLayerData* LayerData = SkinAssembler.GetLayer(static_cast<EHktVoxelSkinLayer::Type>(i));
			if (LayerData && LayerData->VoxelLayerAsset.IsValid() && LayerData->VoxelLayerAsset->HasBoneData())
			{
				AllBoneGroups = LayerData->VoxelLayerAsset->BoneGroups;
				break;
			}
		}

		OnBoneDataAvailable(AllBoneGroups);
	}
	else
	{
		OnBoneDataUnavailable();

		FHktVoxelChunk TempChunk;
		TempChunk.ChunkCoord = EntityChunkCoord;
		SkinAssembler.Assemble(TempChunk);

		const int32 VoxelCount = FHktVoxelChunk::SIZE * FHktVoxelChunk::SIZE * FHktVoxelChunk::SIZE;
		EntityRenderCache->LoadChunk(EntityChunkCoord, &TempChunk.Data[0][0][0], VoxelCount);
	}
}

void AHktVoxelUnitActorBase::OnPaletteChanged(uint8 NewPaletteRow)
{
	CachedPaletteRow = NewPaletteRow;

	if (BodyChunk)
	{
		BodyChunk->SetCustomPrimitiveDataFloat(0, static_cast<float>(NewPaletteRow));
	}
}

void AHktVoxelUnitActorBase::PollMeshReady()
{
	if (!EntityRenderCache || !BodyChunk) return;

	FHktVoxelChunk* Chunk = EntityRenderCache->GetChunk(EntityChunkCoord);
	if (Chunk && Chunk->bMeshReady.load(std::memory_order_acquire))
	{
		Chunk->bMeshReady.store(false, std::memory_order_relaxed);
		BodyChunk->OnMeshReady();
	}
}

void AHktVoxelUnitActorBase::EnsureSkeletonMesh()
{
	if (!HiddenSkeleton || HiddenSkeleton->GetSkeletalMeshAsset()) return;

	for (int32 i = 0; i < EHktVoxelSkinLayer::Count; i++)
	{
		const FHktVoxelSkinLayerData* LayerData = SkinAssembler.GetLayer(static_cast<EHktVoxelSkinLayer::Type>(i));
		if (LayerData && LayerData->VoxelLayerAsset.IsValid() && LayerData->VoxelLayerAsset->HasBoneData())
		{
			USkeletalMesh* SkelMesh = LayerData->VoxelLayerAsset->SourceMesh.LoadSynchronous();
			if (SkelMesh)
			{
				HiddenSkeleton->SetSkeletalMeshAsset(SkelMesh);
				UE_LOG(LogTemp, Log, TEXT("[VoxelUnit] HiddenSkeleton: SkeletalMesh set from VoxelLayerAsset SourceMesh"));
				break;
			}
		}
	}
}

UHktAnimInstance* AHktVoxelUnitActorBase::GetAnimInstance()
{
	if (!CachedAnimInstance.IsValid() && HiddenSkeleton)
	{
		CachedAnimInstance = Cast<UHktAnimInstance>(HiddenSkeleton->GetAnimInstance());
	}
	return CachedAnimInstance.Get();
}
