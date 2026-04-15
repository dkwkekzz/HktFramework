// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVoxelRigidUnitActor.h"
#include "HktVoxelSkinLayerAsset.h"
#include "Rendering/HktVoxelChunkComponent.h"
#include "Data/HktVoxelRenderCache.h"
#include "Data/HktVoxelTypes.h"
#include "Meshing/HktVoxelMeshScheduler.h"
#include "Settings/HktRuntimeGlobalSetting.h"
#include "Components/SkeletalMeshComponent.h"

void AHktVoxelRigidUnitActor::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	TeardownBoneChunks();
	Super::EndPlay(EndPlayReason);
}

void AHktVoxelRigidUnitActor::OnBoneDataAvailable(const TArray<FHktVoxelBoneGroup>& BoneGroups)
{
	InitializeBoneChunks(BoneGroups);
}

void AHktVoxelRigidUnitActor::OnBoneDataUnavailable()
{
	if (bBoneAnimatedMode)
	{
		TeardownBoneChunks();
	}
}

void AHktVoxelRigidUnitActor::OnPaletteChanged(uint8 NewPaletteRow)
{
	Super::OnPaletteChanged(NewPaletteRow);

	if (bBoneAnimatedMode)
	{
		for (auto& [BoneName, Comp] : BoneChunks)
		{
			if (Comp)
			{
				Comp->SetCustomPrimitiveDataFloat(0, static_cast<float>(NewPaletteRow));
			}
		}
	}
}

void AHktVoxelRigidUnitActor::PollMeshReady()
{
	if (!EntityRenderCache) return;

	if (bBoneAnimatedMode)
	{
		for (auto& [BoneName, ChunkCoord] : BoneChunkCoords)
		{
			FHktVoxelChunk* Chunk = EntityRenderCache->GetChunk(ChunkCoord);
			if (Chunk && Chunk->bMeshReady.load(std::memory_order_acquire))
			{
				Chunk->bMeshReady.store(false, std::memory_order_relaxed);
				if (auto* Comp = BoneChunks.Find(BoneName))
				{
					(*Comp)->OnMeshReady();
				}
			}
		}
	}
	else
	{
		Super::PollMeshReady();
	}
}

void AHktVoxelRigidUnitActor::InitializeBoneChunks(const TArray<FHktVoxelBoneGroup>& BoneGroups)
{
	TeardownBoneChunks();

	if (BoneGroups.Num() == 0 || !EntityRenderCache) return;

	EnsureSkeletonMesh();

	// 정적 BodyChunk 숨기기
	if (BodyChunk)
	{
		BodyChunk->SetVisibility(false);
	}

	if (HiddenSkeleton)
	{
		HiddenSkeleton->SetComponentTickEnabled(true);
	}

	if (MeshScheduler)
	{
		MeshScheduler->SetMaxMeshPerFrame(4);
	}

	// 단일 출처: UHktRuntimeGlobalSetting::VoxelSizeCm
	const UHktRuntimeGlobalSetting* Settings = GetDefault<UHktRuntimeGlobalSetting>();
	const float VoxelSize = Settings ? Settings->VoxelSizeCm : FHktVoxelChunk::VOXEL_SIZE;

	int32 BoneIndex = 0;
	for (const FHktVoxelBoneGroup& BoneGroup : BoneGroups)
	{
		if (BoneGroup.Voxels.Num() == 0) continue;

		const FIntVector ChunkCoord(BoneIndex + 1, 0, 0);

		UHktVoxelChunkComponent* BoneComp = NewObject<UHktVoxelChunkComponent>(this);
		BoneComp->RegisterComponent();

		BoneComp->AttachToComponent(HiddenSkeleton,
			FAttachmentTransformRules::SnapToTargetNotIncludingScale,
			BoneGroup.BoneName);

		BoneComp->Initialize(EntityRenderCache.Get(), ChunkCoord, VoxelSize);

		FHktVoxelChunk TempChunk;
		FMemory::Memzero(TempChunk.Data, sizeof(TempChunk.Data));
		TempChunk.ChunkCoord = ChunkCoord;
		UHktVoxelSkinLayerAsset::WriteBoneGroupToChunk(TempChunk, BoneGroup, CachedPaletteRow);

		const int32 VoxelCount = FHktVoxelChunk::SIZE * FHktVoxelChunk::SIZE * FHktVoxelChunk::SIZE;
		EntityRenderCache->LoadChunk(ChunkCoord, &TempChunk.Data[0][0][0], VoxelCount);
		// 청크 중심 정렬: (SIZE/2 - 0.5) 복셀
		const float HalfChunk = (FHktVoxelChunk::SIZE * 0.5f - 0.5f) * VoxelSize;
		const FVector VoxelOriginWorld = FVector(
			BoneGroup.LocalOrigin.X * VoxelSize - HalfChunk,
			BoneGroup.LocalOrigin.Y * VoxelSize - HalfChunk,
			BoneGroup.LocalOrigin.Z * VoxelSize);
		const FVector BoneOffset = VoxelOriginWorld - BoneGroup.RefPoseBonePos;
		BoneComp->SetRelativeLocation(BoneOffset);

		BoneComp->SetCustomPrimitiveDataFloat(0, static_cast<float>(CachedPaletteRow));

		BoneChunks.Add(BoneGroup.BoneName, BoneComp);
		BoneChunkCoords.Add(BoneGroup.BoneName, ChunkCoord);

		BoneIndex++;
	}

	bBoneAnimatedMode = true;
	UE_LOG(LogTemp, Log, TEXT("[VoxelRigidUnit] InitializeBoneChunks: %d bone chunks created"), BoneChunks.Num());
}

void AHktVoxelRigidUnitActor::TeardownBoneChunks()
{
	for (auto& [BoneName, Comp] : BoneChunks)
	{
		if (Comp)
		{
			if (auto* CoordPtr = BoneChunkCoords.Find(BoneName))
			{
				if (EntityRenderCache)
				{
					EntityRenderCache->UnloadChunk(*CoordPtr);
				}
			}
			Comp->DestroyComponent();
		}
	}

	BoneChunks.Empty();
	BoneChunkCoords.Empty();
	bBoneAnimatedMode = false;

	if (BodyChunk)
	{
		BodyChunk->SetVisibility(true);
	}
	if (HiddenSkeleton)
	{
		HiddenSkeleton->SetComponentTickEnabled(false);
	}
	if (MeshScheduler)
	{
		MeshScheduler->SetMaxMeshPerFrame(1);
	}
}
