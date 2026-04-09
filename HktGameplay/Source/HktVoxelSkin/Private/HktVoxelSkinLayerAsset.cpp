// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVoxelSkinLayerAsset.h"
#include "Data/HktVoxelTypes.h"

void UHktVoxelSkinLayerAsset::Serialize(FArchive& Ar)
{
	Super::Serialize(Ar);

	// SparseVoxels
	int32 NumSparse = SparseVoxels.Num();
	Ar << NumSparse;
	if (Ar.IsLoading())
	{
		SparseVoxels.SetNum(NumSparse);
	}
	for (int32 i = 0; i < NumSparse; i++)
	{
		FHktVoxelSparse& V = SparseVoxels[i];
		Ar << V.X << V.Y << V.Z << V.TypeID << V.PaletteIndex << V.Flags;
	}

	// BoneGroups
	int32 NumGroups = BoneGroups.Num();
	Ar << NumGroups;
	if (Ar.IsLoading())
	{
		BoneGroups.SetNum(NumGroups);
	}
	for (int32 i = 0; i < NumGroups; i++)
	{
		FHktVoxelBoneGroup& G = BoneGroups[i];
		Ar << G.BoneName;
		Ar << G.LocalOrigin;
		Ar << G.RefPoseBonePos;

		int32 NumVoxels = G.Voxels.Num();
		Ar << NumVoxels;
		if (Ar.IsLoading())
		{
			G.Voxels.SetNum(NumVoxels);
		}
		for (int32 j = 0; j < NumVoxels; j++)
		{
			FHktVoxelSparse& V = G.Voxels[j];
			Ar << V.X << V.Y << V.Z << V.TypeID << V.PaletteIndex << V.Flags;
		}
	}
}

void UHktVoxelSkinLayerAsset::WriteToChunk(FHktVoxelChunk& OutChunk, const FIntVector& Offset, [[maybe_unused]] uint8 PaletteRow) const
{
	// PaletteRow는 현재 미사용 — 팔레트는 GPU에서 CustomPrimitiveData로 처리
	// 향후 복셀별 팔레트 오버라이드가 필요하면 여기서 적용
	constexpr int32 S = FHktVoxelChunk::SIZE;

	for (const FHktVoxelSparse& V : SparseVoxels)
	{
		const int32 X = V.X + Offset.X;
		const int32 Y = V.Y + Offset.Y;
		const int32 Z = V.Z + Offset.Z;

		if (X >= 0 && X < S && Y >= 0 && Y < S && Z >= 0 && Z < S)
		{
			FHktVoxel& Dest = OutChunk.At(X, Y, Z);
			Dest.TypeID = V.TypeID;
			Dest.PaletteIndex = V.PaletteIndex;
			Dest.Flags = V.Flags;
		}
	}
}

void UHktVoxelSkinLayerAsset::WriteBoneGroupToChunk(FHktVoxelChunk& OutChunk, const FHktVoxelBoneGroup& BoneGroup, [[maybe_unused]] uint8 PaletteRow)
{
	constexpr int32 S = FHktVoxelChunk::SIZE;

	for (const FHktVoxelSparse& V : BoneGroup.Voxels)
	{
		const int32 X = V.X;
		const int32 Y = V.Y;
		const int32 Z = V.Z;

		if (X >= 0 && X < S && Y >= 0 && Y < S && Z >= 0 && Z < S)
		{
			FHktVoxel& Dest = OutChunk.At(X, Y, Z);
			Dest.TypeID = V.TypeID;
			Dest.PaletteIndex = V.PaletteIndex;
			Dest.Flags = V.Flags;
		}
	}
}
