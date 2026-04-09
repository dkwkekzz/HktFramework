// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVoxelMeshVoxelizer.h"
#include "HktVoxelSkinLog.h"
#include "Engine/SkeletalMesh.h"
#include "Rendering/SkeletalMeshRenderData.h"
#include "Rendering/SkeletalMeshLODRenderData.h"

FHktVoxelMeshVoxelizer::FResult FHktVoxelMeshVoxelizer::Voxelize(
	const USkeletalMesh* Mesh, const FParams& Params)
{
	FResult Result;

	if (!Mesh)
	{
		UE_LOG(LogHktVoxelSkin, Warning, TEXT("Voxelize: null mesh"));
		return Result;
	}

	// Step 1: 삼각형 추출
	TArray<FExtractedVertex> Vertices;
	TArray<uint32> Indices;
	TArray<FName> BoneNames;
	TArray<FTransform> RefPoseTransforms;
	ExtractTriangles(Mesh, Vertices, Indices, BoneNames, RefPoseTransforms);

	if (Vertices.Num() == 0 || Indices.Num() == 0)
	{
		UE_LOG(LogHktVoxelSkin, Warning, TEXT("Voxelize: no triangles extracted from '%s'"), *Mesh->GetName());
		return Result;
	}

	// Step 2: AABB 계산
	FBox MeshBounds(ForceInit);
	for (const FExtractedVertex& V : Vertices)
	{
		MeshBounds += V.Position;
	}

	// Step 3: Conservative 래스터화
	const int32 GridSize = Params.GridSize;
	TArray<FVoxelCell> Grid;
	Grid.SetNumZeroed(GridSize * GridSize * GridSize);
	RasterizeTriangles(Vertices, Indices, GridSize, MeshBounds, Grid);

	// Step 4: Solid Fill
	if (Params.bSolidFill)
	{
		SolidFill(Grid, GridSize);
	}

	// Step 5: 내부 복셀 본 전파
	if (Params.bCaptureBoneIndex)
	{
		PropagateBonesToInterior(Grid, GridSize);
	}

	// Step 6: 결과 빌드
	BuildResult(Grid, GridSize, BoneNames, RefPoseTransforms, Params.bCaptureBoneIndex, Result);

	UE_LOG(LogHktVoxelSkin, Log, TEXT("Voxelize: '%s' → %d voxels, %d bone groups"),
		*Mesh->GetName(), Result.AllVoxels.Num(), Result.BoneGroups.Num());

	return Result;
}

void FHktVoxelMeshVoxelizer::ExtractTriangles(
	const USkeletalMesh* Mesh,
	TArray<FExtractedVertex>& OutVertices, TArray<uint32>& OutIndices,
	TArray<FName>& OutBoneNames, TArray<FTransform>& OutRefPoseTransforms)
{
	const FSkeletalMeshRenderData* RenderData = Mesh->GetResourceForRendering();
	if (!RenderData || RenderData->LODRenderData.Num() == 0)
	{
		return;
	}

	const FSkeletalMeshLODRenderData& LODData = RenderData->LODRenderData[0];
	const FPositionVertexBuffer& PosBuffer = LODData.StaticVertexBuffers.PositionVertexBuffer;
	const uint32 NumVerts = PosBuffer.GetNumVertices();

	if (NumVerts == 0)
	{
		return;
	}

	// 본 이름 + 레퍼런스 포즈 추출
	const FReferenceSkeleton& RefSkeleton = Mesh->GetRefSkeleton();
	const int32 NumBones = RefSkeleton.GetNum();
	OutBoneNames.SetNum(NumBones);
	OutRefPoseTransforms.SetNum(NumBones);

	// 컴포넌트 스페이스 트랜스폼 계산
	TArray<FTransform> ComponentSpaceTransforms;
	ComponentSpaceTransforms.SetNum(NumBones);
	for (int32 i = 0; i < NumBones; i++)
	{
		OutBoneNames[i] = RefSkeleton.GetBoneName(i);
		ComponentSpaceTransforms[i] = RefSkeleton.GetRefBonePose()[i];

		const int32 ParentIdx = RefSkeleton.GetParentIndex(i);
		if (ParentIdx != INDEX_NONE)
		{
			// Local * Parent 순서로 컴포넌트 스페이스 변환
			ComponentSpaceTransforms[i] = RefSkeleton.GetRefBonePose()[i] * ComponentSpaceTransforms[ParentIdx];
		}
		OutRefPoseTransforms[i] = ComponentSpaceTransforms[i];
	}

	// 버텍스 추출
	OutVertices.SetNum(NumVerts);
	const FSkinWeightVertexBuffer* SkinWeightPtr = LODData.GetSkinWeightVertexBuffer();
	if (!SkinWeightPtr)
	{
		return;
	}
	const FSkinWeightVertexBuffer& SkinWeightBuffer = *SkinWeightPtr;

	for (uint32 i = 0; i < NumVerts; i++)
	{
		FExtractedVertex& OutV = OutVertices[i];
		OutV.Position = FVector(PosBuffer.VertexPosition(i));

		// 본 웨이트 추출
		FMemory::Memzero(OutV.BoneIndices, sizeof(OutV.BoneIndices));
		FMemory::Memzero(OutV.BoneWeights, sizeof(OutV.BoneWeights));

		const int32 NumInfluences = FMath::Min<int32>(SkinWeightBuffer.GetMaxBoneInfluences(), 4);
		for (int32 Inf = 0; Inf < NumInfluences; Inf++)
		{
			const int32 SectionVertIdx = i;
			OutV.BoneIndices[Inf] = SkinWeightBuffer.GetBoneIndex(SectionVertIdx, Inf);
			OutV.BoneWeights[Inf] = static_cast<float>(SkinWeightBuffer.GetBoneWeight(SectionVertIdx, Inf)) / 255.0f;
		}
	}

	// 인덱스 추출
	{
		const FRawStaticIndexBuffer16or32Interface* IB = LODData.MultiSizeIndexContainer.GetIndexBuffer();
		if (IB)
		{
			const int32 NumIndices = IB->Num();
			OutIndices.SetNum(NumIndices);
			for (int32 i = 0; i < NumIndices; i++)
			{
				OutIndices[i] = IB->Get(i);
			}
		}
	}
}

void FHktVoxelMeshVoxelizer::RasterizeTriangles(
	const TArray<FExtractedVertex>& Vertices, const TArray<uint32>& Indices,
	int32 GridSize, const FBox& MeshBounds,
	TArray<FVoxelCell>& OutGrid)
{
	const FVector BoundsSize = MeshBounds.GetSize();
	// 약간의 패딩으로 경계 복셀 보호
	const float MaxDim = FMath::Max3(BoundsSize.X, BoundsSize.Y, BoundsSize.Z);
	const float CellSize = MaxDim / static_cast<float>(GridSize - 2);  // 1복셀 마진
	const FVector GridOrigin = MeshBounds.GetCenter() - FVector(CellSize * GridSize * 0.5f);

	const FVector HalfCell(CellSize * 0.5f);

	for (int32 TriIdx = 0; TriIdx + 2 < Indices.Num(); TriIdx += 3)
	{
		const FExtractedVertex& V0 = Vertices[Indices[TriIdx + 0]];
		const FExtractedVertex& V1 = Vertices[Indices[TriIdx + 1]];
		const FExtractedVertex& V2 = Vertices[Indices[TriIdx + 2]];

		// 삼각형 AABB → 그리드 셀 범위
		FBox TriBounds(ForceInit);
		TriBounds += V0.Position;
		TriBounds += V1.Position;
		TriBounds += V2.Position;

		auto ToGrid = [&](const FVector& WorldPos) -> FIntVector
		{
			FVector Local = (WorldPos - GridOrigin) / CellSize;
			return FIntVector(
				FMath::Clamp(FMath::FloorToInt32(Local.X), 0, GridSize - 1),
				FMath::Clamp(FMath::FloorToInt32(Local.Y), 0, GridSize - 1),
				FMath::Clamp(FMath::FloorToInt32(Local.Z), 0, GridSize - 1));
		};

		const FIntVector MinCell = ToGrid(TriBounds.Min);
		const FIntVector MaxCell = ToGrid(TriBounds.Max);

		for (int32 Z = MinCell.Z; Z <= MaxCell.Z; Z++)
		{
			for (int32 Y = MinCell.Y; Y <= MaxCell.Y; Y++)
			{
				for (int32 X = MinCell.X; X <= MaxCell.X; X++)
				{
					const FVector CellCenter = GridOrigin + FVector(X + 0.5f, Y + 0.5f, Z + 0.5f) * CellSize;

					if (TriangleAABBIntersect(V0.Position, V1.Position, V2.Position, CellCenter, HalfCell))
					{
						const int32 Idx = X + Y * GridSize + Z * GridSize * GridSize;
						FVoxelCell& Cell = OutGrid[Idx];
						Cell.bSurface = true;
						Cell.bFilled = true;

						// 삼각형 3버텍스의 본 웨이트를 균등 누적 (바리센트릭 근사)
						for (int32 Vi = 0; Vi < 3; Vi++)
						{
							const FExtractedVertex& Vert = (Vi == 0) ? V0 : (Vi == 1) ? V1 : V2;
							for (int32 Inf = 0; Inf < 4; Inf++)
							{
								if (Vert.BoneWeights[Inf] > 0.0f)
								{
									Cell.BoneWeights.FindOrAdd(Vert.BoneIndices[Inf]) += Vert.BoneWeights[Inf];
								}
							}
						}
					}
				}
			}
		}
	}
}

void FHktVoxelMeshVoxelizer::SolidFill(TArray<FVoxelCell>& Grid, int32 GridSize)
{
	// Z-슬라이스별, Y행별 X축 scanline parity fill
	for (int32 Z = 0; Z < GridSize; Z++)
	{
		for (int32 Y = 0; Y < GridSize; Y++)
		{
			bool bInside = false;
			bool bPrevSurface = false;

			for (int32 X = 0; X < GridSize; X++)
			{
				const int32 Idx = X + Y * GridSize + Z * GridSize * GridSize;
				FVoxelCell& Cell = Grid[Idx];

				if (Cell.bSurface)
				{
					if (!bPrevSurface)
					{
						bInside = !bInside;
					}
					bPrevSurface = true;
				}
				else
				{
					bPrevSurface = false;
					if (bInside)
					{
						Cell.bFilled = true;
					}
				}
			}
		}
	}
}

void FHktVoxelMeshVoxelizer::PropagateBonesToInterior(TArray<FVoxelCell>& Grid, int32 GridSize)
{
	// BFS: surface 복셀의 본을 인접 interior 복셀로 전파
	TQueue<int32> Queue;
	const int32 TotalCells = GridSize * GridSize * GridSize;

	// surface 복셀을 시드로 사용
	for (int32 i = 0; i < TotalCells; i++)
	{
		if (Grid[i].bSurface && Grid[i].BoneWeights.Num() > 0)
		{
			Queue.Enqueue(i);
		}
	}

	static const int32 Offsets[6][3] = {
		{1,0,0}, {-1,0,0}, {0,1,0}, {0,-1,0}, {0,0,1}, {0,0,-1}
	};

	while (!Queue.IsEmpty())
	{
		int32 Current;
		Queue.Dequeue(Current);

		const int32 CX = Current % GridSize;
		const int32 CY = (Current / GridSize) % GridSize;
		const int32 CZ = Current / (GridSize * GridSize);

		for (int32 D = 0; D < 6; D++)
		{
			const int32 NX = CX + Offsets[D][0];
			const int32 NY = CY + Offsets[D][1];
			const int32 NZ = CZ + Offsets[D][2];

			if (NX < 0 || NX >= GridSize || NY < 0 || NY >= GridSize || NZ < 0 || NZ >= GridSize)
			{
				continue;
			}

			const int32 NIdx = NX + NY * GridSize + NZ * GridSize * GridSize;
			FVoxelCell& Neighbor = Grid[NIdx];

			// interior (filled but not surface) 이고 본 할당이 없으면 전파
			if (Neighbor.bFilled && !Neighbor.bSurface && Neighbor.BoneWeights.Num() == 0)
			{
				Neighbor.BoneWeights = Grid[Current].BoneWeights;
				Queue.Enqueue(NIdx);
			}
		}
	}
}

void FHktVoxelMeshVoxelizer::BuildResult(
	const TArray<FVoxelCell>& Grid, int32 GridSize,
	const TArray<FName>& BoneNames, const TArray<FTransform>& RefPoseTransforms,
	bool bCaptureBoneIndex, FResult& OutResult)
{
	OutResult.BoundsMin = FIntVector(GridSize, GridSize, GridSize);
	OutResult.BoundsMax = FIntVector(0, 0, 0);

	// 본별 복셀 수집용 맵 (본 인덱스 → 복셀 배열)
	TMap<int32, TArray<FHktVoxelSparse>> BoneVoxelMap;

	for (int32 Z = 0; Z < GridSize; Z++)
	{
		for (int32 Y = 0; Y < GridSize; Y++)
		{
			for (int32 X = 0; X < GridSize; X++)
			{
				const int32 Idx = X + Y * GridSize + Z * GridSize * GridSize;
				const FVoxelCell& Cell = Grid[Idx];

				if (!Cell.bFilled)
				{
					continue;
				}

				FHktVoxelSparse Sparse;
				Sparse.X = static_cast<uint8>(X);
				Sparse.Y = static_cast<uint8>(Y);
				Sparse.Z = static_cast<uint8>(Z);
				Sparse.TypeID = Cell.TypeID;
				Sparse.PaletteIndex = Cell.PaletteIndex;
				Sparse.Flags = Cell.Flags;

				OutResult.AllVoxels.Add(Sparse);

				// 바운드 갱신
				OutResult.BoundsMin.X = FMath::Min(OutResult.BoundsMin.X, X);
				OutResult.BoundsMin.Y = FMath::Min(OutResult.BoundsMin.Y, Y);
				OutResult.BoundsMin.Z = FMath::Min(OutResult.BoundsMin.Z, Z);
				OutResult.BoundsMax.X = FMath::Max(OutResult.BoundsMax.X, X);
				OutResult.BoundsMax.Y = FMath::Max(OutResult.BoundsMax.Y, Y);
				OutResult.BoundsMax.Z = FMath::Max(OutResult.BoundsMax.Z, Z);

				// 본 할당
				if (bCaptureBoneIndex && Cell.BoneWeights.Num() > 0)
				{
					int32 DominantBone = 0;
					float MaxWeight = -1.0f;
					for (const auto& Pair : Cell.BoneWeights)
					{
						if (Pair.Value > MaxWeight)
						{
							MaxWeight = Pair.Value;
							DominantBone = Pair.Key;
						}
					}
					BoneVoxelMap.FindOrAdd(DominantBone).Add(Sparse);
				}
			}
		}
	}

	// 본 그룹 생성
	if (bCaptureBoneIndex)
	{
		for (const auto& Pair : BoneVoxelMap)
		{
			const int32 BoneIdx = Pair.Key;
			if (BoneIdx < 0 || BoneIdx >= BoneNames.Num() || Pair.Value.Num() == 0)
			{
				continue;
			}

			FHktVoxelBoneGroup Group;
			Group.BoneName = BoneNames[BoneIdx];
			Group.RefPoseBonePos = RefPoseTransforms[BoneIdx].GetTranslation();
			Group.Voxels = Pair.Value;

			// LocalOrigin 계산 (그룹 AABB 최소점)
			FIntVector Min(GridSize, GridSize, GridSize);
			for (const FHktVoxelSparse& V : Group.Voxels)
			{
				Min.X = FMath::Min(Min.X, (int32)V.X);
				Min.Y = FMath::Min(Min.Y, (int32)V.Y);
				Min.Z = FMath::Min(Min.Z, (int32)V.Z);
			}
			Group.LocalOrigin = Min;

			OutResult.BoneGroups.Add(MoveTemp(Group));
		}
	}
}

bool FHktVoxelMeshVoxelizer::TriangleAABBIntersect(
	const FVector& V0, const FVector& V1, const FVector& V2,
	const FVector& BoxCenter, const FVector& BoxHalfExtent)
{
	// Tomas Akenine-Möller SAT-based triangle-AABB intersection test
	const FVector A = V0 - BoxCenter;
	const FVector B = V1 - BoxCenter;
	const FVector C = V2 - BoxCenter;

	const FVector E0 = B - A;
	const FVector E1 = C - B;
	const FVector E2 = A - C;

	const FVector H = BoxHalfExtent;

	// AABB face normals (축 정렬) 테스트
	{
		float MinV = FMath::Min3(A.X, B.X, C.X);
		float MaxV = FMath::Max3(A.X, B.X, C.X);
		if (MinV > H.X || MaxV < -H.X) return false;
	}
	{
		float MinV = FMath::Min3(A.Y, B.Y, C.Y);
		float MaxV = FMath::Max3(A.Y, B.Y, C.Y);
		if (MinV > H.Y || MaxV < -H.Y) return false;
	}
	{
		float MinV = FMath::Min3(A.Z, B.Z, C.Z);
		float MaxV = FMath::Max3(A.Z, B.Z, C.Z);
		if (MinV > H.Z || MaxV < -H.Z) return false;
	}

	// 삼각형 평면 테스트
	const FVector TriNormal = FVector::CrossProduct(E0, E1);
	{
		float D = FVector::DotProduct(TriNormal, A);
		float R = H.X * FMath::Abs(TriNormal.X) + H.Y * FMath::Abs(TriNormal.Y) + H.Z * FMath::Abs(TriNormal.Z);
		if (FMath::Abs(D) > R) return false;
	}

	// 9개 크로스 프로덕트 축 테스트 (엣지 × AABB 축)
	auto TestAxis = [&](const FVector& Axis) -> bool
	{
		float PA = FVector::DotProduct(A, Axis);
		float PB = FVector::DotProduct(B, Axis);
		float PC = FVector::DotProduct(C, Axis);
		float R = H.X * FMath::Abs(Axis.X) + H.Y * FMath::Abs(Axis.Y) + H.Z * FMath::Abs(Axis.Z);
		float MinP = FMath::Min3(PA, PB, PC);
		float MaxP = FMath::Max3(PA, PB, PC);
		return !(MinP > R || MaxP < -R);
	};

	const FVector Axes[3] = { FVector::XAxisVector, FVector::YAxisVector, FVector::ZAxisVector };
	const FVector Edges[3] = { E0, E1, E2 };

	for (int32 i = 0; i < 3; i++)
	{
		for (int32 j = 0; j < 3; j++)
		{
			FVector CrossAxis = FVector::CrossProduct(Edges[i], Axes[j]);
			if (CrossAxis.SizeSquared() > SMALL_NUMBER)
			{
				if (!TestAxis(CrossAxis)) return false;
			}
		}
	}

	return true;
}
