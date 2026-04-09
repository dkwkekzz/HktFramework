// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVoxelSkinAssembler.h"
#include "HktVoxelSkinLayerAsset.h"
#include "Data/HktVoxelTypes.h"
#include "HktVoxelSkinLog.h"

void FHktVoxelSkinAssembler::SetLayer(EHktVoxelSkinLayer::Type Layer, const FHktVoxelSkinLayerData& Data)
{
	if (Layer < EHktVoxelSkinLayer::Count)
	{
		Layers[Layer] = Data;
		bLayerActive[Layer] = true;
	}
}

void FHktVoxelSkinAssembler::RemoveLayer(EHktVoxelSkinLayer::Type Layer)
{
	if (Layer < EHktVoxelSkinLayer::Count)
	{
		bLayerActive[Layer] = false;
	}
}

void FHktVoxelSkinAssembler::SetLayerVisible(EHktVoxelSkinLayer::Type Layer, bool bVisible)
{
	if (Layer < EHktVoxelSkinLayer::Count && bLayerActive[Layer])
	{
		Layers[Layer].bVisible = bVisible;
	}
}

const FHktVoxelSkinLayerData* FHktVoxelSkinAssembler::GetLayer(EHktVoxelSkinLayer::Type Layer) const
{
	if (Layer < EHktVoxelSkinLayer::Count && bLayerActive[Layer])
	{
		return &Layers[Layer];
	}
	return nullptr;
}

void FHktVoxelSkinAssembler::Assemble(FHktVoxelChunk& OutChunk) const
{
	// 청크 초기화 — 모든 복셀을 빈 공간으로
	FMemory::Memzero(OutChunk.Data, sizeof(OutChunk.Data));
	OutChunk.bMeshDirty = true;
	OutChunk.bMeshReady = false;

	// 레이어를 낮은 우선순위부터 순회 — 높은 레이어가 덮어쓴다
	for (int32 i = 0; i < EHktVoxelSkinLayer::Count; i++)
	{
		if (!bLayerActive[i] || !Layers[i].bVisible)
		{
			continue;
		}

		const FHktVoxelSkinLayerData& LayerData = Layers[i];

		UE_LOG(LogHktVoxelSkin, Verbose, TEXT("Assembling layer: %s (SkinSet=%d, Palette=%d)"),
			EHktVoxelSkinLayer::ToString(static_cast<EHktVoxelSkinLayer::Type>(i)),
			LayerData.SkinID.SkinSetID,
			LayerData.SkinID.PaletteRow);

		// 에셋이 있으면 에셋에서 로드, 없으면 프로시저럴 폴백
		if (LayerData.VoxelLayerAsset.IsValid())
		{
			LayerData.VoxelLayerAsset->WriteToChunk(OutChunk, LayerData.Offset, LayerData.SkinID.PaletteRow);
		}
		else
		{
			GenerateDefaultShape(OutChunk, LayerData);
		}
	}
}

void FHktVoxelSkinAssembler::GenerateDefaultShape(FHktVoxelChunk& OutChunk, const FHktVoxelSkinLayerData& LayerData) const
{
	const uint16 TypeID = LayerData.SkinID.SkinSetID > 0 ? LayerData.SkinID.SkinSetID : 1;
	const uint8 Palette = LayerData.SkinID.PaletteRow;
	const FIntVector Off = LayerData.Offset;
	constexpr int32 S = FHktVoxelChunk::SIZE;

	auto SetVoxel = [&](int32 X, int32 Y, int32 Z, uint16 Type, uint8 PalIdx, uint8 Flags = 0)
	{
		X += Off.X;
		Y += Off.Y;
		Z += Off.Z;
		if (X >= 0 && X < S && Y >= 0 && Y < S && Z >= 0 && Z < S)
		{
			FHktVoxel& V = OutChunk.At(X, Y, Z);
			V.TypeID = Type;
			V.PaletteIndex = PalIdx;
			V.Flags = Flags;
		}
	};

	// 레이어별 기본 형태 — 프로시저럴 복셀 캐릭터 (~16×8×24 복셀)
	// 중심 X=16, Y=16에 배치
	switch (LayerData.Layer)
	{
	case EHktVoxelSkinLayer::Body:
	{
		// 몸통: 14~17 × 14~17 × 4~11 (4×4×8)
		for (int32 X = 14; X <= 17; X++)
			for (int32 Y = 14; Y <= 17; Y++)
				for (int32 Z = 4; Z <= 11; Z++)
					SetVoxel(X, Y, Z, TypeID, Palette);

		// 다리: 왼쪽 14~15, 오른쪽 16~17, Z 0~3
		for (int32 X = 14; X <= 15; X++)
			for (int32 Y = 15; Y <= 16; Y++)
				for (int32 Z = 0; Z <= 3; Z++)
					SetVoxel(X, Y, Z, TypeID, Palette);
		for (int32 X = 16; X <= 17; X++)
			for (int32 Y = 15; Y <= 16; Y++)
				for (int32 Z = 0; Z <= 3; Z++)
					SetVoxel(X, Y, Z, TypeID, Palette);

		// 팔: 왼쪽 12~13, 오른쪽 18~19, Z 6~11
		for (int32 Y = 15; Y <= 16; Y++)
			for (int32 Z = 6; Z <= 11; Z++)
			{
				SetVoxel(12, Y, Z, TypeID, Palette);
				SetVoxel(13, Y, Z, TypeID, Palette);
				SetVoxel(18, Y, Z, TypeID, Palette);
				SetVoxel(19, Y, Z, TypeID, Palette);
			}
		break;
	}
	case EHktVoxelSkinLayer::Head:
	{
		// 머리: 14~17 × 14~17 × 12~15 (4×4×4)
		for (int32 X = 14; X <= 17; X++)
			for (int32 Y = 14; Y <= 17; Y++)
				for (int32 Z = 12; Z <= 15; Z++)
					SetVoxel(X, Y, Z, TypeID, FMath::Clamp<uint8>(Palette + 1, 0, 7));
		break;
	}
	case EHktVoxelSkinLayer::Armor:
	{
		// 갑옷: 몸통 바깥 레이어 13~18 × 13~18 × 5~11
		for (int32 X = 13; X <= 18; X++)
			for (int32 Y = 13; Y <= 18; Y++)
				for (int32 Z = 5; Z <= 11; Z++)
				{
					// 바깥 면만 (안쪽은 Body가 있으므로)
					if (X == 13 || X == 18 || Y == 13 || Y == 18)
						SetVoxel(X, Y, Z, TypeID, FMath::Clamp<uint8>(Palette + 2, 0, 7));
				}
		break;
	}
	default:
		// 나머지 레이어는 프로덕션에서 에셋 로드로 처리
		break;
	}
}

void FHktVoxelSkinAssembler::AssembleBoned(TMap<FName, FHktVoxelChunk>& OutBoneChunks) const
{
	OutBoneChunks.Empty();

	// 레이어를 낮은 우선순위부터 순회 — 높은 레이어가 덮어쓴다
	for (int32 i = 0; i < EHktVoxelSkinLayer::Count; i++)
	{
		if (!bLayerActive[i] || !Layers[i].bVisible)
		{
			continue;
		}

		const FHktVoxelSkinLayerData& LayerData = Layers[i];

		if (LayerData.VoxelLayerAsset.IsValid() && LayerData.VoxelLayerAsset->HasBoneData())
		{
			// 본-리지드 모드: 본별 청크에 복셀 기록
			for (const FHktVoxelBoneGroup& BoneGroup : LayerData.VoxelLayerAsset->BoneGroups)
			{
				if (BoneGroup.Voxels.Num() == 0)
				{
					continue;
				}

				const bool bNewEntry = !OutBoneChunks.Contains(BoneGroup.BoneName);
				FHktVoxelChunk& BoneChunk = OutBoneChunks.FindOrAdd(BoneGroup.BoneName);
				if (bNewEntry)
				{
					FMemory::Memzero(BoneChunk.Data, sizeof(BoneChunk.Data));
					BoneChunk.bMeshDirty = true;
					BoneChunk.bMeshReady = false;
				}

				UHktVoxelSkinLayerAsset::WriteBoneGroupToChunk(BoneChunk, BoneGroup, LayerData.SkinID.PaletteRow);
			}
		}
		else if (LayerData.VoxelLayerAsset.IsValid())
		{
			// 정적 에셋 — "root" 본 그룹으로 폴백
			const FName RootBone(TEXT("root"));
			const bool bNewRoot = !OutBoneChunks.Contains(RootBone);
			FHktVoxelChunk& RootChunk = OutBoneChunks.FindOrAdd(RootBone);
			if (bNewRoot)
			{
				FMemory::Memzero(RootChunk.Data, sizeof(RootChunk.Data));
				RootChunk.bMeshDirty = true;
				RootChunk.bMeshReady = false;
			}
			LayerData.VoxelLayerAsset->WriteToChunk(RootChunk, LayerData.Offset, LayerData.SkinID.PaletteRow);
		}
		// 에셋 없는 레이어는 본 모드에서 스킵 (GenerateDefaultShape는 정적 전용)
	}
}

bool FHktVoxelSkinAssembler::HasAnyBoneData() const
{
	for (int32 i = 0; i < EHktVoxelSkinLayer::Count; i++)
	{
		if (bLayerActive[i] && Layers[i].bVisible && Layers[i].VoxelLayerAsset.IsValid())
		{
			if (Layers[i].VoxelLayerAsset->HasBoneData())
			{
				return true;
			}
		}
	}
	return false;
}

void FHktVoxelSkinAssembler::ChangeSkinPalette(EHktVoxelSkinLayer::Type Layer, uint8 NewPaletteRow)
{
	if (Layer < EHktVoxelSkinLayer::Count && bLayerActive[Layer])
	{
		Layers[Layer].SkinID.PaletteRow = NewPaletteRow;
		// 팔레트 변경은 재메싱 불필요 — GPU에서 팔레트 텍스처 룩업으로 처리
	}
}

void FHktVoxelSkinAssembler::Clear()
{
	FMemory::Memzero(bLayerActive, sizeof(bLayerActive));
}
