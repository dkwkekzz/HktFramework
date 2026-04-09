// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVoxelUnitActor.h"
#include "HktVoxelSkinLayerAsset.h"
#include "Rendering/HktVoxelChunkComponent.h"
#include "Data/HktVoxelRenderCache.h"
#include "Data/HktVoxelTypes.h"
#include "Components/SkeletalMeshComponent.h"

void AHktVoxelUnitActor::OnBoneDataAvailable(const TArray<FHktVoxelBoneGroup>& BoneGroups)
{
	InitializeGPUSkinning(BoneGroups);
}

void AHktVoxelUnitActor::OnBoneDataUnavailable()
{
	bGPUSkinningActive = false;
	BoneNameToIndex.Empty();

	if (HiddenSkeleton)
	{
		HiddenSkeleton->SetComponentTickEnabled(false);
	}
}

void AHktVoxelUnitActor::TickAnimation(float DeltaTime)
{
	if (bGPUSkinningActive)
	{
		UpdateBoneTransformsFromSkeleton();
	}
}

void AHktVoxelUnitActor::InitializeGPUSkinning(const TArray<FHktVoxelBoneGroup>& BoneGroups)
{
	if (BoneGroups.Num() == 0 || !EntityRenderCache) return;

	EnsureSkeletonMesh();

	if (HiddenSkeleton)
	{
		HiddenSkeleton->SetComponentTickEnabled(true);
	}

	// 본 이름 → 인덱스 매핑 (인덱스 0 = identity, 유효 본은 1~)
	BoneNameToIndex.Empty();
	uint8 NextBoneIndex = 1;
	for (const FHktVoxelBoneGroup& BoneGroup : BoneGroups)
	{
		if (BoneGroup.Voxels.Num() > 0 && !BoneNameToIndex.Contains(BoneGroup.BoneName))
		{
			BoneNameToIndex.Add(BoneGroup.BoneName, NextBoneIndex);
			NextBoneIndex++;
			if (NextBoneIndex >= 128) break;
		}
	}

	// 복셀 조합 + 본 인덱스 맵을 단일 청크에 기록
	FHktVoxelChunk TempChunk;
	TempChunk.ChunkCoord = EntityChunkCoord;
	FMemory::Memzero(TempChunk.Data, sizeof(TempChunk.Data));
	TempChunk.AllocBoneIndices();

	SkinAssembler.Assemble(TempChunk);

	for (const FHktVoxelBoneGroup& BoneGroup : BoneGroups)
	{
		const uint8* BoneIdxPtr = BoneNameToIndex.Find(BoneGroup.BoneName);
		if (!BoneIdxPtr) continue;
		const uint8 BoneIdx = *BoneIdxPtr;

		for (const FHktVoxelSparse& V : BoneGroup.Voxels)
		{
			if (V.X < FHktVoxelChunk::SIZE && V.Y < FHktVoxelChunk::SIZE && V.Z < FHktVoxelChunk::SIZE)
			{
				TempChunk.SetBoneIndex(V.X, V.Y, V.Z, BoneIdx);
			}
		}
	}

	const int32 VoxelCount = FHktVoxelChunk::SIZE * FHktVoxelChunk::SIZE * FHktVoxelChunk::SIZE;
	EntityRenderCache->LoadChunk(EntityChunkCoord, &TempChunk.Data[0][0][0], VoxelCount);

	FHktVoxelChunk* CachedChunk = EntityRenderCache->GetChunk(EntityChunkCoord);
	if (CachedChunk && TempChunk.BoneIndices)
	{
		CachedChunk->AllocBoneIndices();
		FMemory::Memcpy(CachedChunk->BoneIndices.Get(), TempChunk.BoneIndices.Get(),
			FHktVoxelChunk::SIZE * FHktVoxelChunk::SIZE * FHktVoxelChunk::SIZE);
		CachedChunk->bMeshDirty.store(true, std::memory_order_release);
	}

	bGPUSkinningActive = true;
	UE_LOG(LogTemp, Log, TEXT("[VoxelUnit] GPU Skinning initialized: %d bones"), BoneNameToIndex.Num());
}

void AHktVoxelUnitActor::UpdateBoneTransformsFromSkeleton()
{
	if (!HiddenSkeleton || !HiddenSkeleton->GetSkeletalMeshAsset() || BoneNameToIndex.Num() == 0) return;

	const int32 NumBones = BoneNameToIndex.Num() + 1;
	TArray<FVector4f> BoneMatrixRows;
	BoneMatrixRows.SetNumZeroed(NumBones * 3);

	// 인덱스 0 = identity
	BoneMatrixRows[0] = FVector4f(1, 0, 0, 0);
	BoneMatrixRows[1] = FVector4f(0, 1, 0, 0);
	BoneMatrixRows[2] = FVector4f(0, 0, 1, 0);

	const TArray<FTransform>& SpaceBases = HiddenSkeleton->GetComponentSpaceTransforms();

	for (const auto& [BoneName, BoneIdx] : BoneNameToIndex)
	{
		const int32 SkelIdx = HiddenSkeleton->GetBoneIndex(BoneName);
		const int32 Base = BoneIdx * 3;

		if (SkelIdx == INDEX_NONE || SkelIdx >= SpaceBases.Num())
		{
			BoneMatrixRows[Base + 0] = FVector4f(1, 0, 0, 0);
			BoneMatrixRows[Base + 1] = FVector4f(0, 1, 0, 0);
			BoneMatrixRows[Base + 2] = FVector4f(0, 0, 1, 0);
			continue;
		}

		// UE5는 v*M (행 벡터 좌측 곱) 규약이므로,
		// 셰이더에서 dot(Col, float4(pos,1))로 사용하려면 열(column)을 저장
		const FMatrix44f M = FMatrix44f(SpaceBases[SkelIdx].ToMatrixWithScale());
		BoneMatrixRows[Base + 0] = FVector4f(M.M[0][0], M.M[1][0], M.M[2][0], M.M[3][0]);
		BoneMatrixRows[Base + 1] = FVector4f(M.M[0][1], M.M[1][1], M.M[2][1], M.M[3][1]);
		BoneMatrixRows[Base + 2] = FVector4f(M.M[0][2], M.M[1][2], M.M[2][2], M.M[3][2]);
	}

	BodyChunk->UpdateBoneTransforms(BoneMatrixRows);
}
