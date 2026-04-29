// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVoxelTerrainStyleApply.h"
#include "HktTerrainStyleSet.h"
#include "HktVoxelTerrainLog.h"
#include "Rendering/HktVoxelTileAtlas.h"
#include "Rendering/HktVoxelMaterialLUT.h"
#include "Engine/Texture2DArray.h"

void HktApplyTerrainStyleSetToVoxelAtlas(
	const UHktTerrainStyleSet* StyleSet,
	UHktVoxelTileAtlas* Atlas,
	UHktVoxelMaterialLUT* MaterialLUT)
{
	if (!StyleSet)
	{
		UE_LOG(LogHktVoxelTerrain, Warning, TEXT("[StyleApply] StyleSet is null"));
		return;
	}
	if (!Atlas)
	{
		UE_LOG(LogHktVoxelTerrain, Warning, TEXT("[StyleApply] Atlas is null"));
		return;
	}

	// 1. 베이크된 텍스처 배열 핸들 직결 — DDC 컴파일 경로 미경유
	Atlas->TileArray = StyleSet->TileArray;
	Atlas->NormalArray = StyleSet->NormalArray;

	// 2. TypeID → 슬라이스 매핑 주입
	for (const FHktBakedTileMapping& Mapping : StyleSet->TileMappings)
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
		for (const FHktBakedMaterialEntry& Entry : StyleSet->Materials)
		{
			MaterialLUT->SetMaterial(
				static_cast<uint16>(Entry.TypeID),
				Entry.Roughness, Entry.Metallic, Entry.Specular);
		}
		// 256×1 RGBA8 — 작아서 런타임 빌드 OK
		MaterialLUT->BuildLUTTexture();
	}

	UE_LOG(LogHktVoxelTerrain, Log,
		TEXT("[StyleApply] Applied — TileArray=%s, NormalArray=%s, %d mappings, %d materials"),
		StyleSet->TileArray ? *StyleSet->TileArray->GetName() : TEXT("(null)"),
		StyleSet->NormalArray ? *StyleSet->NormalArray->GetName() : TEXT("(null)"),
		StyleSet->TileMappings.Num(), StyleSet->Materials.Num());
}
