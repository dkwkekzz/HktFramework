// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "HktVoxelSkinTypes.h"
#include "HktVoxelSkinLayerAsset.generated.h"

struct FHktVoxelChunk;
class USkeleton;

/**
 * UHktVoxelSkinLayerAsset — 베이크된 복셀 스킨 데이터
 *
 * 에디터 타임에 FHktVoxelMeshVoxelizer로 SkeletalMesh를 복셀화하여 저장한다.
 * 런타임에 FHktVoxelSkinAssembler가 이 에셋을 참조하여 청크에 복셀을 기록한다.
 *
 * 두 가지 모드:
 *   정적 모드: SparseVoxels만 사용 (단일 청크에 기록)
 *   본-리지드 모드: BoneGroups 사용 (본별 청크에 기록, 애니메이션 지원)
 */
UCLASS(BlueprintType)
class HKTVOXELSKIN_API UHktVoxelSkinLayerAsset : public UDataAsset
{
	GENERATED_BODY()

public:
	// --- 정적 모드 ---

	/** 전체 복셀 (정적 모드 / 폴백) — custom Serialize()로 직렬화 */
	TArray<FHktVoxelSparse> SparseVoxels;

	/** 복셀 유효 범위 */
	UPROPERTY(EditAnywhere, Category = "HKT|VoxelSkin")
	FIntVector BoundsMin = FIntVector::ZeroValue;

	UPROPERTY(EditAnywhere, Category = "HKT|VoxelSkin")
	FIntVector BoundsMax = FIntVector::ZeroValue;

	// --- 본-리지드 모드 ---

	/** 본별 복셀 그룹 (비어있으면 정적 모드) — custom Serialize()로 직렬화 */
	TArray<FHktVoxelBoneGroup> BoneGroups;

	// --- 에디터 참조 ---

	/** 원본 SkeletalMesh 참조 (에디터 검증용) */
	UPROPERTY(EditAnywhere, Category = "HKT|VoxelSkin|Editor")
	TSoftObjectPtr<USkeletalMesh> SourceMesh;

	/** 원본 스켈레톤 참조 */
	UPROPERTY(EditAnywhere, Category = "HKT|VoxelSkin|Editor")
	TSoftObjectPtr<USkeleton> SourceSkeleton;

	// --- 직렬화 ---
	virtual void Serialize(FArchive& Ar) override;

	// --- 쿼리 ---

	/** 본-리지드 애니메이션 데이터가 있는지 */
	bool HasBoneData() const { return BoneGroups.Num() > 0; }

	// --- 청크 기록 ---

	/** 정적 모드: SparseVoxels를 청크에 기록 */
	void WriteToChunk(FHktVoxelChunk& OutChunk, const FIntVector& Offset, uint8 PaletteRow) const;

	/** 본-리지드 모드: 특정 본 그룹의 복셀을 청크에 기록 */
	static void WriteBoneGroupToChunk(FHktVoxelChunk& OutChunk, const FHktVoxelBoneGroup& BoneGroup, uint8 PaletteRow);
};
