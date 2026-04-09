// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktVoxelSkinTypes.h"

class USkeletalMesh;

/**
 * FHktVoxelMeshVoxelizer — SkeletalMesh를 복셀 데이터로 변환
 *
 * 에디터 타임 전용. LOD0 레퍼런스 포즈에서 삼각형을 추출하고
 * Conservative 래스터화 + Solid Fill로 복셀 그리드를 생성한다.
 * 각 복셀에 지배적 본(dominant bone)을 할당하여 본-리지드 애니메이션을 지원한다.
 *
 * 알고리즘:
 *   1. 삼각형 추출 (LOD0 레퍼런스 포즈, 버텍스 컬러 + 본 웨이트)
 *   2. AABB → 그리드 매핑 (32^3 균일 피팅)
 *   3. Conservative 삼각형 래스터화 (SAT 교차 + 본 웨이트 누적)
 *   4. Solid Fill (Z-슬라이스 scanline parity fill)
 *   5. 내부 복셀 본 전파 (BFS)
 *   6. 본 그룹핑 (dominant bone 기준)
 */
class FHktVoxelMeshVoxelizer
{
public:
	struct FParams
	{
		int32 GridSize = 32;
		bool bSolidFill = true;
		bool bCaptureBoneIndex = true;
	};

	struct FResult
	{
		TArray<FHktVoxelSparse> AllVoxels;          // 전체 복셀 (정적 모드용)
		TArray<FHktVoxelBoneGroup> BoneGroups;      // 본별 그룹 (본-리지드 모드용)
		FIntVector BoundsMin = FIntVector::ZeroValue;
		FIntVector BoundsMax = FIntVector::ZeroValue;
	};

	/**
	 * SkeletalMesh를 복셀화
	 * @param Mesh - 원본 SkeletalMesh (LOD0 사용)
	 * @param Params - 복셀화 파라미터
	 * @return 복셀화 결과 (sparse voxels + bone groups)
	 */
	static FResult Voxelize(const USkeletalMesh* Mesh, const FParams& Params = FParams());

private:
	/** 삼각형에서 추출된 버텍스 정보 */
	struct FExtractedVertex
	{
		FVector Position;
		uint8 BoneIndices[4];
		float BoneWeights[4];
	};

	/** 복셀 셀의 누적 본 웨이트 */
	struct FVoxelCell
	{
		bool bSurface = false;     // surface voxel 여부
		bool bFilled = false;      // solid fill 이후 채워짐 여부
		uint16 TypeID = 1;
		uint8 PaletteIndex = 0;
		uint8 Flags = 0;
		TMap<int32, float> BoneWeights;  // BoneIndex → 누적 웨이트
	};

	static void ExtractTriangles(const USkeletalMesh* Mesh,
		TArray<FExtractedVertex>& OutVertices, TArray<uint32>& OutIndices,
		TArray<FName>& OutBoneNames, TArray<FTransform>& OutRefPoseTransforms);

	static void RasterizeTriangles(
		const TArray<FExtractedVertex>& Vertices, const TArray<uint32>& Indices,
		int32 GridSize, const FBox& MeshBounds,
		TArray<FVoxelCell>& OutGrid);

	static void SolidFill(TArray<FVoxelCell>& Grid, int32 GridSize);

	static void PropagateBonesToInterior(TArray<FVoxelCell>& Grid, int32 GridSize);

	static void BuildResult(
		const TArray<FVoxelCell>& Grid, int32 GridSize,
		const TArray<FName>& BoneNames, const TArray<FTransform>& RefPoseTransforms,
		bool bCaptureBoneIndex, FResult& OutResult);

	/** 삼각형-AABB 교차 테스트 (SAT) */
	static bool TriangleAABBIntersect(const FVector& V0, const FVector& V1, const FVector& V2,
		const FVector& BoxCenter, const FVector& BoxHalfExtent);
};
