// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVoxelTerrainBakeLibrary.h"
#include "HktVoxelTerrainStyleSet.h"
#include "HktVoxelTerrainLog.h"
#include "Engine/Texture2D.h"
#include "Engine/Texture2DArray.h"
#include "PixelFormat.h"
#include "RHI.h"

#if WITH_EDITOR
#include "TextureCompiler.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "UObject/Package.h"
#include "UObject/SavePackage.h"
#include "Misc/PackageName.h"
#endif

namespace
{
	struct FBakeSlicePlan
	{
		TArray<UTexture2D*> SliceTextures;
		TArray<UTexture2D*> SliceNormals;
		TArray<FHktBakedTileMapping> TileMappings;
		TArray<FHktBakedMaterialEntry> MaterialEntries;
	};

	bool PlanSlices(const TArray<FHktVoxelBlockStyle>& BlockStyles, FBakeSlicePlan& OutPlan)
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
			Mapping.TypeID = static_cast<int32>(Style.GetTypeID());
			Mapping.TopSlice = TopSlice;
			Mapping.SideSlice = SideSlice;
			Mapping.BottomSlice = BottomSlice;
			OutPlan.TileMappings.Add(Mapping);

			FHktBakedMaterialEntry Entry;
			Entry.TypeID = static_cast<int32>(Style.GetTypeID());
			Entry.Roughness = Style.Roughness;
			Entry.Metallic = Style.Metallic;
			Entry.Specular = Style.Specular;
			OutPlan.MaterialEntries.Add(Entry);
		}

		return OutPlan.SliceTextures.Num() > 0;
	}

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

bool UHktVoxelTerrainBakeLibrary::BakeStyleSet(UHktVoxelTerrainStyleSet* StyleSet)
{
#if WITH_EDITOR
	if (!StyleSet)
	{
		UE_LOG(LogHktVoxelTerrain, Error, TEXT("[Bake] StyleSet is null"));
		return false;
	}
	if (StyleSet->BlockStyles.Num() == 0)
	{
		UE_LOG(LogHktVoxelTerrain, Error, TEXT("[Bake] StyleSet '%s' has empty BlockStyles"),
			*StyleSet->GetName());
		return false;
	}

	FBakeSlicePlan Plan;
	if (!PlanSlices(StyleSet->BlockStyles, Plan))
	{
		UE_LOG(LogHktVoxelTerrain, Error,
			TEXT("[Bake] BlockStyles에 BaseColor 텍스처가 하나도 없음 — 베이크 중단"));
		return false;
	}

	if (!ValidateSliceCompatibility(Plan.SliceTextures, TEXT("BaseColor")))
	{
		UE_LOG(LogHktVoxelTerrain, Error, TEXT("[Bake] BaseColor 슬라이스 호환성 검증 실패"));
		return false;
	}

	// 기존 inner subobject 가 있다면 garbage 로 표시 (이름 충돌 방지).
	if (StyleSet->TileArray)
	{
		StyleSet->TileArray->Rename(nullptr, GetTransientPackage(),
			REN_DontCreateRedirectors | REN_DoNotDirty | REN_NonTransactional);
		StyleSet->TileArray = nullptr;
	}
	if (StyleSet->NormalArray)
	{
		StyleSet->NormalArray->Rename(nullptr, GetTransientPackage(),
			REN_DontCreateRedirectors | REN_DoNotDirty | REN_NonTransactional);
		StyleSet->NormalArray = nullptr;
	}

	UTexture2DArray* TileArrayObj = NewObject<UTexture2DArray>(
		StyleSet, TEXT("TileArray"), RF_Public);
	TileArrayObj->SourceTextures.Empty();
	for (UTexture2D* Tex : Plan.SliceTextures)
	{
		TileArrayObj->SourceTextures.Add(Tex);
	}
	TileArrayObj->AddressX = TA_Wrap;
	TileArrayObj->AddressY = TA_Wrap;
	TileArrayObj->UpdateSourceFromSourceTextures(true);
	TileArrayObj->UpdateResource();
	StyleSet->TileArray = TileArrayObj;

	int32 NumNormalsProvided = 0;
	for (UTexture2D* N : Plan.SliceNormals) { if (N) { NumNormalsProvided++; } }

	UTexture2DArray* NormalArrayObj = nullptr;
	if (NumNormalsProvided == Plan.SliceNormals.Num() && NumNormalsProvided > 0)
	{
		if (ValidateSliceCompatibility(Plan.SliceNormals, TEXT("Normal")))
		{
			NormalArrayObj = NewObject<UTexture2DArray>(StyleSet, TEXT("NormalArray"), RF_Public);
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
			StyleSet->NormalArray = NormalArrayObj;
		}
	}
	else if (NumNormalsProvided > 0)
	{
		UE_LOG(LogHktVoxelTerrain, Warning,
			TEXT("[Bake] 노멀맵 부분 구성 (%d/%d) — NormalArray 베이크 스킵"),
			NumNormalsProvided, Plan.SliceNormals.Num());
	}

	{
		TArray<UTexture*> ToFinish;
		ToFinish.Add(TileArrayObj);
		if (NormalArrayObj) { ToFinish.Add(NormalArrayObj); }
		FTextureCompilingManager::Get().FinishCompilation(ToFinish);
	}

	StyleSet->TileMappings = MoveTemp(Plan.TileMappings);
	StyleSet->Materials = MoveTemp(Plan.MaterialEntries);
	StyleSet->SourceBlockStyleCount = StyleSet->BlockStyles.Num();
	StyleSet->SliceCount = Plan.SliceTextures.Num();

	StyleSet->MarkPackageDirty();

	UE_LOG(LogHktVoxelTerrain, Log,
		TEXT("[Bake] StyleSet '%s' 베이크 — %d styles, %d slices, Normal=%s"),
		*StyleSet->GetName(), StyleSet->BlockStyles.Num(),
		StyleSet->SliceCount, NormalArrayObj ? TEXT("yes") : TEXT("no"));

	return true;
#else
	UE_LOG(LogHktVoxelTerrain, Error, TEXT("[Bake] Editor-only (WITH_EDITOR=0)"));
	return false;
#endif
}

UHktVoxelTerrainStyleSet* UHktVoxelTerrainBakeLibrary::CreateStyleSetFromDirectory(
	const FString& SourceDirectory,
	const FString& SavePath)
{
#if !WITH_EDITOR
	UE_LOG(LogHktVoxelTerrain, Error, TEXT("[Bake] CreateStyleSetFromDirectory: Editor-only"));
	return nullptr;
#else
	if (SourceDirectory.IsEmpty() || !SourceDirectory.StartsWith(TEXT("/")))
	{
		UE_LOG(LogHktVoxelTerrain, Error,
			TEXT("[Bake] CreateStyleSetFromDirectory: SourceDirectory '%s' 가 잘못됨 — '/Game/...' 형식 필요"),
			*SourceDirectory);
		return nullptr;
	}
	if (SavePath.IsEmpty() || !SavePath.StartsWith(TEXT("/")))
	{
		UE_LOG(LogHktVoxelTerrain, Error,
			TEXT("[Bake] CreateStyleSetFromDirectory: SavePath '%s' 가 잘못됨 — '/Game/...' 형식 필요"),
			*SavePath);
		return nullptr;
	}

	const FString PackagePath = FPackageName::GetLongPackagePath(SavePath);
	const FString AssetName   = FPackageName::GetLongPackageAssetName(SavePath);
	if (PackagePath.IsEmpty() || AssetName.IsEmpty())
	{
		UE_LOG(LogHktVoxelTerrain, Error,
			TEXT("[Bake] CreateStyleSetFromDirectory: SavePath '%s' 가 잘못됨"), *SavePath);
		return nullptr;
	}

	UPackage* Package = CreatePackage(*SavePath);
	if (!Package)
	{
		UE_LOG(LogHktVoxelTerrain, Error,
			TEXT("[Bake] CreateStyleSetFromDirectory: CreatePackage 실패 '%s'"), *SavePath);
		return nullptr;
	}
	Package->FullyLoad();

	// 동일 경로의 기존 자산은 재사용 (소스 디렉토리만 갱신해 다시 import/bake).
	UHktVoxelTerrainStyleSet* Asset =
		FindObject<UHktVoxelTerrainStyleSet>(Package, *AssetName);
	if (!Asset)
	{
		Asset = NewObject<UHktVoxelTerrainStyleSet>(
			Package, *AssetName, RF_Public | RF_Standalone);
	}
	if (!Asset)
	{
		UE_LOG(LogHktVoxelTerrain, Error,
			TEXT("[Bake] CreateStyleSetFromDirectory: NewObject 실패 '%s'"), *AssetName);
		return nullptr;
	}

	Asset->SourceDirectory.Path = SourceDirectory;
	Asset->BlockStyles.Reset();

	Asset->ImportFromDirectory();

	if (Asset->BlockStyles.Num() == 0)
	{
		UE_LOG(LogHktVoxelTerrain, Error,
			TEXT("[Bake] CreateStyleSetFromDirectory: '%s' 임포트 후에도 BlockStyles 비어있음 — 파일명 규칙 확인"),
			*SourceDirectory);
		return nullptr;
	}

	if (!BakeStyleSet(Asset))
	{
		UE_LOG(LogHktVoxelTerrain, Error,
			TEXT("[Bake] CreateStyleSetFromDirectory: BakeStyleSet 실패"));
		return nullptr;
	}

	FAssetRegistryModule::AssetCreated(Asset);

	const FString FilePath = FPackageName::LongPackageNameToFilename(
		SavePath, FPackageName::GetAssetPackageExtension());

	FSavePackageArgs SaveArgs;
	SaveArgs.TopLevelFlags = RF_Public | RF_Standalone;
	const bool bSaved = UPackage::SavePackage(Package, Asset, *FilePath, SaveArgs);
	if (!bSaved)
	{
		UE_LOG(LogHktVoxelTerrain, Error,
			TEXT("[Bake] CreateStyleSetFromDirectory: SavePackage 실패 '%s'"), *FilePath);
		return nullptr;
	}

	UE_LOG(LogHktVoxelTerrain, Log,
		TEXT("[Bake] CreateStyleSetFromDirectory 완료 — '%s' (BlockStyles=%d, Slices=%d)"),
		*SavePath, Asset->BlockStyles.Num(), Asset->SliceCount);

	return Asset;
#endif
}
