// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVoxelTerrainBakeLibrary.h"
#include "HktVoxelTerrainStyleSet.h"
#include "HktVoxelTerrainActor.h"  // FHktVoxelBlockStyle
#include "HktVoxelTerrainLog.h"
#include "Engine/Texture2D.h"
#include "Engine/Texture2DArray.h"
#include "PixelFormat.h"
#include "RHI.h"

#if WITH_EDITOR
#include "UObject/Package.h"
#include "UObject/SavePackage.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "TextureCompiler.h"
#endif

namespace
{
	struct FBakeSlicePlan
	{
		// SliceTextures[i] / SliceNormals[i] 가 Texture2DArray 슬라이스 i 의 BaseColor / Normal.
		TArray<UTexture2D*> SliceTextures;
		TArray<UTexture2D*> SliceNormals;

		// TileMappings 채우기용 — TypeID 별 (Top/Side/Bottom 슬라이스 인덱스).
		TArray<FHktBakedTileMapping> TileMappings;

		// MaterialEntries 채우기용 — TypeID 별 PBR.
		TArray<FHktBakedMaterialEntry> MaterialEntries;
	};

	// AHktVoxelTerrainActor::BuildTerrainStyle 의 슬라이스 할당 로직 미러.
	// 단, 베이크 결과만 수집하여 FBakeSlicePlan 으로 반환한다.
	bool PlanSlices(
		const TArray<FHktVoxelBlockStyle>& BlockStyles,
		FBakeSlicePlan& OutPlan)
	{
		TMap<UTexture2D*, uint8> TextureToSlice;

		auto AssignSlice = [&](UTexture2D* Base, UTexture2D* Normal) -> uint8
		{
			if (!Base) { return 255; }

			if (const uint8* Found = TextureToSlice.Find(Base))
			{
				const uint8 Idx = *Found;
				if (Normal)
				{
					if (!OutPlan.SliceNormals[Idx])
					{
						OutPlan.SliceNormals[Idx] = Normal;
					}
					else if (OutPlan.SliceNormals[Idx] != Normal)
					{
						UE_LOG(LogHktVoxelTerrain, Warning,
							TEXT("[Bake] Base 텍스처 %s는 슬라이스 %d에 이미 Normal=%s가 할당됨 — 새 Normal=%s는 무시됨."),
							*Base->GetName(), Idx,
							*OutPlan.SliceNormals[Idx]->GetName(), *Normal->GetName());
					}
				}
				return Idx;
			}
			if (OutPlan.SliceTextures.Num() >= 255)
			{
				UE_LOG(LogHktVoxelTerrain, Warning, TEXT("[Bake] Too many unique textures (max 255)"));
				return 255;
			}
			const uint8 Idx = static_cast<uint8>(OutPlan.SliceTextures.Num());
			TextureToSlice.Add(Base, Idx);
			OutPlan.SliceTextures.Add(Base);
			OutPlan.SliceNormals.Add(Normal);
			return Idx;
		};

		for (const FHktVoxelBlockStyle& Style : BlockStyles)
		{
			UTexture2D* TopTex = Style.TopTexture ? Style.TopTexture.Get() : Style.SideTexture.Get();
			UTexture2D* SideTex = Style.SideTexture.Get();
			UTexture2D* BottomTex = Style.BottomTexture ? Style.BottomTexture.Get() : SideTex;

			UTexture2D* TopNorm = Style.TopTexture ? Style.TopNormal.Get() : Style.SideNormal.Get();
			UTexture2D* SideNorm = Style.SideNormal.Get();
			UTexture2D* BottomNorm = Style.BottomTexture ? Style.BottomNormal.Get() : Style.SideNormal.Get();

			const uint8 TopSlice = AssignSlice(TopTex, TopNorm);
			const uint8 SideSlice = AssignSlice(SideTex, SideNorm);
			const uint8 BottomSlice = AssignSlice(BottomTex, BottomNorm);

			FHktBakedTileMapping Mapping;
			Mapping.TypeID = Style.TypeID;
			Mapping.TopSlice = TopSlice;
			Mapping.SideSlice = SideSlice;
			Mapping.BottomSlice = BottomSlice;
			OutPlan.TileMappings.Add(Mapping);

			FHktBakedMaterialEntry Entry;
			Entry.TypeID = Style.TypeID;
			Entry.Roughness = Style.Roughness;
			Entry.Metallic = Style.Metallic;
			Entry.Specular = Style.Specular;
			OutPlan.MaterialEntries.Add(Entry);
		}

		return OutPlan.SliceTextures.Num() > 0;
	}

	// 모든 슬라이스 텍스처가 동일 해상도/포맷인지 검증.
	bool ValidateSliceCompatibility(const TArray<UTexture2D*>& Slices, const TCHAR* Label)
	{
		if (Slices.Num() == 0) { return true; }
		const int32 RefSizeX = Slices[0]->GetSizeX();
		const int32 RefSizeY = Slices[0]->GetSizeY();
		const EPixelFormat RefFormat = Slices[0]->GetPixelFormat();
		bool bOk = true;

		for (int32 i = 1; i < Slices.Num(); i++)
		{
			const UTexture2D* Tex = Slices[i];
			if (Tex->GetSizeX() != RefSizeX || Tex->GetSizeY() != RefSizeY)
			{
				UE_LOG(LogHktVoxelTerrain, Error,
					TEXT("[Bake] %s 크기 불일치 — [0]=%dx%d, [%d](%s)=%dx%d"),
					Label, RefSizeX, RefSizeY, i, *Tex->GetName(),
					Tex->GetSizeX(), Tex->GetSizeY());
				bOk = false;
			}
			if (Tex->GetPixelFormat() != RefFormat)
			{
				UE_LOG(LogHktVoxelTerrain, Error,
					TEXT("[Bake] %s 포맷 불일치 — [0]=%s, [%d](%s)=%s"),
					Label, GetPixelFormatString(RefFormat), i, *Tex->GetName(),
					GetPixelFormatString(Tex->GetPixelFormat()));
				bOk = false;
			}
		}
		return bOk;
	}
}

UHktVoxelTerrainStyleSet* UHktVoxelTerrainBakeLibrary::BakeStyleSet(
	const TArray<FHktVoxelBlockStyle>& BlockStyles,
	const FString& SavePath)
{
#if WITH_EDITOR
	if (BlockStyles.Num() == 0)
	{
		UE_LOG(LogHktVoxelTerrain, Error, TEXT("[Bake] BlockStyles is empty"));
		return nullptr;
	}

	// --- 1. 슬라이스 계획 ---
	FBakeSlicePlan Plan;
	if (!PlanSlices(BlockStyles, Plan))
	{
		UE_LOG(LogHktVoxelTerrain, Error,
			TEXT("[Bake] BlockStyles에 BaseColor 텍스처가 하나도 없음 — 베이크 중단"));
		return nullptr;
	}

	// --- 2. BaseColor 슬라이스 호환성 검증 ---
	if (!ValidateSliceCompatibility(Plan.SliceTextures, TEXT("BaseColor")))
	{
		UE_LOG(LogHktVoxelTerrain, Error,
			TEXT("[Bake] BaseColor 슬라이스 호환성 검증 실패 — 베이크 중단"));
		return nullptr;
	}

	// --- 3. 패키지/Asset 생성 ---
	const FString PackagePath = SavePath;
	const FString AssetName = FPackageName::GetShortName(PackagePath);

	UPackage* Package = CreatePackage(*PackagePath);
	if (!Package)
	{
		UE_LOG(LogHktVoxelTerrain, Error, TEXT("[Bake] CreatePackage 실패: '%s'"), *PackagePath);
		return nullptr;
	}
	Package->FullyLoad();

	UHktVoxelTerrainStyleSet* Asset = NewObject<UHktVoxelTerrainStyleSet>(
		Package, *AssetName, RF_Public | RF_Standalone);

	// --- 4. TileArray (BaseColor) 빌드 — inner subobject ---
	UTexture2DArray* TileArrayObj = NewObject<UTexture2DArray>(
		Asset, TEXT("TileArray"), RF_Public);
	TileArrayObj->SourceTextures.Empty();
	for (UTexture2D* Tex : Plan.SliceTextures)
	{
		TileArrayObj->SourceTextures.Add(Tex);
	}
	TileArrayObj->AddressX = TA_Wrap;
	TileArrayObj->AddressY = TA_Wrap;
	TileArrayObj->UpdateSourceFromSourceTextures(true);
	TileArrayObj->UpdateResource();

	Asset->TileArray = TileArrayObj;

	// --- 5. NormalArray 빌드 (선택, all-or-nothing) ---
	int32 NumNormalsProvided = 0;
	for (UTexture2D* N : Plan.SliceNormals) { if (N) { NumNormalsProvided++; } }

	UTexture2DArray* NormalArrayObj = nullptr;
	if (NumNormalsProvided == Plan.SliceNormals.Num() && NumNormalsProvided > 0)
	{
		if (ValidateSliceCompatibility(Plan.SliceNormals, TEXT("Normal")))
		{
			NormalArrayObj = NewObject<UTexture2DArray>(Asset, TEXT("NormalArray"), RF_Public);
			NormalArrayObj->SourceTextures.Empty();
			for (UTexture2D* N : Plan.SliceNormals)
			{
				NormalArrayObj->SourceTextures.Add(N);

				if (N->SRGB)
				{
					UE_LOG(LogHktVoxelTerrain, Warning,
						TEXT("[Bake] 노멀 텍스처 %s SRGB=true — 에셋에서 sRGB=off + TC_Normalmap 권장"),
						*N->GetName());
				}
			}
			NormalArrayObj->AddressX = TA_Wrap;
			NormalArrayObj->AddressY = TA_Wrap;
			NormalArrayObj->SRGB = false;
			NormalArrayObj->UpdateSourceFromSourceTextures(true);
			NormalArrayObj->UpdateResource();

			Asset->NormalArray = NormalArrayObj;
		}
	}
	else if (NumNormalsProvided > 0)
	{
		UE_LOG(LogHktVoxelTerrain, Warning,
			TEXT("[Bake] 노멀맵 부분 구성 (%d/%d) — NormalArray 베이크 스킵"),
			NumNormalsProvided, Plan.SliceNormals.Num());
	}

	// --- 6. 텍스처 컴파일 완료 대기 (DDC) ---
	{
		TArray<UTexture*> ToFinish;
		ToFinish.Add(TileArrayObj);
		if (NormalArrayObj) { ToFinish.Add(NormalArrayObj); }
		FTextureCompilingManager::Get().FinishCompilation(ToFinish);
	}

	// --- 7. 매핑/머티리얼 채우기 ---
	Asset->TileMappings = MoveTemp(Plan.TileMappings);
	Asset->Materials = MoveTemp(Plan.MaterialEntries);
	Asset->SourceBlockStyleCount = BlockStyles.Num();
	Asset->SliceCount = Plan.SliceTextures.Num();

	// --- 8. 저장 ---
	Asset->MarkPackageDirty();
	FAssetRegistryModule::AssetCreated(Asset);

	const FString PackageFilename = FPackageName::LongPackageNameToFilename(
		PackagePath, FPackageName::GetAssetPackageExtension());

	FSavePackageArgs SaveArgs;
	SaveArgs.TopLevelFlags = RF_Public | RF_Standalone;
	const bool bSaved = UPackage::SavePackage(Package, Asset, *PackageFilename, SaveArgs);

	if (bSaved)
	{
		UE_LOG(LogHktVoxelTerrain, Log,
			TEXT("[Bake] Saved StyleSet '%s' — %d styles, %d slices, Normal=%s"),
			*PackageFilename, BlockStyles.Num(), Asset->SliceCount,
			NormalArrayObj ? TEXT("yes") : TEXT("no"));
	}
	else
	{
		UE_LOG(LogHktVoxelTerrain, Error,
			TEXT("[Bake] SavePackage 실패: '%s'"), *PackageFilename);
		return nullptr;
	}

	return Asset;
#else
	UE_LOG(LogHktVoxelTerrain, Error, TEXT("[Bake] Editor-only (WITH_EDITOR=0)"));
	return nullptr;
#endif
}
