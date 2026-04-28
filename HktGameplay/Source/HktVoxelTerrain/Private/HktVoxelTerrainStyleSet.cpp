// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVoxelTerrainStyleSet.h"
#include "HktVoxelTerrainLog.h"
#include "Rendering/HktVoxelTileAtlas.h"
#include "Rendering/HktVoxelMaterialLUT.h"
#include "Engine/Texture2DArray.h"

void UHktVoxelTerrainStyleSet::ApplyTo(UHktVoxelTileAtlas* Atlas, UHktVoxelMaterialLUT* MaterialLUT) const
{
	if (!Atlas)
	{
		UE_LOG(LogHktVoxelTerrain, Warning, TEXT("[StyleSet] ApplyTo: Atlas is null"));
		return;
	}

	// 1. 베이크된 텍스처 배열 핸들 직결 — DDC 컴파일 경로 미경유
	Atlas->TileArray = TileArray;
	Atlas->NormalArray = NormalArray;

	// 2. TypeID → 슬라이스 매핑 주입
	for (const FHktBakedTileMapping& Mapping : TileMappings)
	{
		Atlas->SetTileMapping(
			static_cast<uint16>(Mapping.TypeID),
			Mapping.TopSlice, Mapping.SideSlice, Mapping.BottomSlice);
	}

	// 3. 인덱스 LUT 구축 (256×3 R8 — 작아서 런타임 빌드 OK, FTexturePlatformData 직접 경로)
	Atlas->BuildLUTTexture();

	// 4. 머티리얼 LUT 채우기
	if (MaterialLUT)
	{
		for (const FHktBakedMaterialEntry& Entry : Materials)
		{
			MaterialLUT->SetMaterial(
				static_cast<uint16>(Entry.TypeID),
				Entry.Roughness, Entry.Metallic, Entry.Specular);
		}
		// 256×1 RGBA8 — 작아서 런타임 빌드 OK
		MaterialLUT->BuildLUTTexture();
	}

	UE_LOG(LogHktVoxelTerrain, Log,
		TEXT("[StyleSet] Applied — TileArray=%s, NormalArray=%s, %d mappings, %d materials"),
		TileArray ? *TileArray->GetName() : TEXT("(null)"),
		NormalArray ? *NormalArray->GetName() : TEXT("(null)"),
		TileMappings.Num(), Materials.Num());
}
