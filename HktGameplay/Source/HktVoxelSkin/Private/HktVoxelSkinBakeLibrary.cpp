// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVoxelSkinBakeLibrary.h"
#include "HktVoxelMeshVoxelizer.h"
#include "HktVoxelSkinLayerAsset.h"
#include "HktVoxelSkinLog.h"
#include "Engine/SkeletalMesh.h"
#include "UObject/Package.h"
#include "UObject/SavePackage.h"
#include "AssetRegistry/AssetRegistryModule.h"

UHktVoxelSkinLayerAsset* UHktVoxelSkinBakeLibrary::BakeSkeletalMesh(
	USkeletalMesh* SkeletalMesh,
	const FString& SavePath,
	int32 GridSize,
	bool bSolidFill)
{
#if WITH_EDITOR
	if (!SkeletalMesh)
	{
		UE_LOG(LogHktVoxelSkin, Error, TEXT("BakeSkeletalMesh: SkeletalMesh is null"));
		return nullptr;
	}

	GridSize = FMath::Clamp(GridSize, 4, 64);

	UE_LOG(LogHktVoxelSkin, Log, TEXT("BakeSkeletalMesh: '%s' → '%s' (Grid=%d, SolidFill=%d)"),
		*SkeletalMesh->GetName(), *SavePath, GridSize, bSolidFill);

	// --- 복셀화 실행 ---
	FHktVoxelMeshVoxelizer::FParams Params;
	Params.GridSize = GridSize;
	Params.bSolidFill = bSolidFill;
	Params.bCaptureBoneIndex = true;

	FHktVoxelMeshVoxelizer::FResult Result = FHktVoxelMeshVoxelizer::Voxelize(SkeletalMesh, Params);

	if (Result.AllVoxels.Num() == 0)
	{
		UE_LOG(LogHktVoxelSkin, Error, TEXT("BakeSkeletalMesh: Voxelization produced 0 voxels for '%s'"),
			*SkeletalMesh->GetName());
		return nullptr;
	}

	UE_LOG(LogHktVoxelSkin, Log, TEXT("BakeSkeletalMesh: %d voxels, %d bone groups"),
		Result.AllVoxels.Num(), Result.BoneGroups.Num());

	// --- 패키지/에셋 생성 ---
	const FString PackagePath = SavePath;
	const FString AssetName = FPackageName::GetShortName(PackagePath);

	UPackage* Package = CreatePackage(*PackagePath);
	if (!Package)
	{
		UE_LOG(LogHktVoxelSkin, Error, TEXT("BakeSkeletalMesh: Failed to create package '%s'"), *PackagePath);
		return nullptr;
	}
	Package->FullyLoad();

	UHktVoxelSkinLayerAsset* Asset = NewObject<UHktVoxelSkinLayerAsset>(
		Package, *AssetName, RF_Public | RF_Standalone);

	// --- 결과를 에셋에 기록 ---
	Asset->SparseVoxels = MoveTemp(Result.AllVoxels);
	Asset->BoneGroups = MoveTemp(Result.BoneGroups);
	Asset->BoundsMin = Result.BoundsMin;
	Asset->BoundsMax = Result.BoundsMax;
	Asset->SourceMesh = SkeletalMesh;
	if (SkeletalMesh->GetSkeleton())
	{
		Asset->SourceSkeleton = SkeletalMesh->GetSkeleton();
	}

	// --- 저장 ---
	Asset->MarkPackageDirty();
	FAssetRegistryModule::AssetCreated(Asset);

	const FString PackageFilename = FPackageName::LongPackageNameToFilename(
		PackagePath, FPackageName::GetAssetPackageExtension());

	FSavePackageArgs SaveArgs;
	SaveArgs.TopLevelFlags = RF_Public | RF_Standalone;
	bool bSaved = UPackage::SavePackage(Package, Asset, *PackageFilename, SaveArgs);

	if (bSaved)
	{
		UE_LOG(LogHktVoxelSkin, Log, TEXT("BakeSkeletalMesh: Saved '%s' (%d voxels, %d bone groups)"),
			*PackageFilename, Asset->SparseVoxels.Num(), Asset->BoneGroups.Num());
	}
	else
	{
		UE_LOG(LogHktVoxelSkin, Error, TEXT("BakeSkeletalMesh: Failed to save '%s'"), *PackageFilename);
	}

	return Asset;
#else
	UE_LOG(LogHktVoxelSkin, Error, TEXT("BakeSkeletalMesh: Editor only"));
	return nullptr;
#endif
}

bool UHktVoxelSkinBakeLibrary::PreviewVoxelize(
	USkeletalMesh* SkeletalMesh,
	int32 GridSize,
	int32& OutVoxelCount,
	int32& OutBoneCount)
{
	OutVoxelCount = 0;
	OutBoneCount = 0;

	if (!SkeletalMesh) return false;

	GridSize = FMath::Clamp(GridSize, 4, 64);

	FHktVoxelMeshVoxelizer::FParams Params;
	Params.GridSize = GridSize;
	Params.bSolidFill = true;
	Params.bCaptureBoneIndex = true;

	FHktVoxelMeshVoxelizer::FResult Result = FHktVoxelMeshVoxelizer::Voxelize(SkeletalMesh, Params);

	OutVoxelCount = Result.AllVoxels.Num();
	OutBoneCount = Result.BoneGroups.Num();

	UE_LOG(LogHktVoxelSkin, Log, TEXT("PreviewVoxelize: '%s' → %d voxels, %d bone groups"),
		*SkeletalMesh->GetName(), OutVoxelCount, OutBoneCount);

	return OutVoxelCount > 0;
}
