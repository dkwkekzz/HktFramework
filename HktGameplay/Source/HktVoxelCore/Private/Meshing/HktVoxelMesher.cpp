// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Meshing/HktVoxelMesher.h"
#include "Meshing/HktVoxelVertex.h"
#include "Data/HktVoxelTypes.h"
#include "LOD/HktVoxelLOD.h"

void FHktVoxelMesher::MeshChunk(FHktVoxelChunk& Chunk, bool bDoubleSided, int32 LODLevel)
{
	FWriteScopeLock WriteLock(Chunk.MeshLock);

	Chunk.OpaqueVertices.Reset();
	Chunk.OpaqueIndices.Reset();
	Chunk.TranslucentVertices.Reset();
	Chunk.TranslucentIndices.Reset();

	const int32 ClampedLOD = FMath::Clamp(LODLevel, 0, FHktVoxelLODPolicy::MaxLOD);
	const int32 DownSize = FHktVoxelChunk::SIZE >> ClampedLOD;

	for (int32 Face = 0; Face < EHktVoxelFace::Count; Face++)
	{
		for (int32 Slice = 0; Slice < DownSize; Slice++)
		{
			uint32 FaceMask[FHktVoxelChunk::SIZE] = {};
			BuildFaceMask(Chunk, Face, Slice, FaceMask, ClampedLOD);
			MergeQuads(Chunk, Face, Slice, FaceMask, bDoubleSided, ClampedLOD);
		}
	}

	// bMeshDirty/bMeshReady/CurrentLOD는 스케줄러 람다에서 세대 확인 후 관리
}

void FHktVoxelMesher::BuildFaceMask(
	const FHktVoxelChunk& Chunk,
	int32 Face, int32 Slice,
	uint32 OutMask[32],
	int32 LODLevel)
{
	const int32 Axis = EHktVoxelFace::GetAxis(Face);
	const bool bPositive = EHktVoxelFace::IsPositive(Face);
	const int32 SIZE = FHktVoxelChunk::SIZE;
	const int32 Step = 1 << LODLevel;
	const int32 DownSize = SIZE >> LODLevel;

	// 축별로 U, V 매핑
	// Axis=0(X): U=Y, V=Z, Slice=X
	// Axis=1(Y): U=X, V=Z, Slice=Y
	// Axis=2(Z): U=X, V=Y, Slice=Z
	for (int32 V = 0; V < DownSize; V++)
	{
		uint32 Row = 0;
		for (int32 U = 0; U < DownSize; U++)
		{
			// Down-sample 좌표 → 풀-그리드 좌표 (Step 곱)
			int32 X, Y, Z;
			switch (Axis)
			{
				case 0: X = Slice * Step; Y = U * Step; Z = V * Step; break;
				case 1: X = U * Step; Y = Slice * Step; Z = V * Step; break;
				case 2: X = U * Step; Y = V * Step; Z = Slice * Step; break;
				default: X = Y = Z = 0; break;
			}

			const FHktVoxel& Voxel = Chunk.At(X, Y, Z);
			if (Voxel.IsEmpty())
			{
				continue;
			}

			// 인접 다운샘플 셀 체크 — 해당 면이 노출되었는지 (Step만큼 이동)
			int32 NX = X, NY = Y, NZ = Z;
			switch (Axis)
			{
				case 0: NX += bPositive ? Step : -Step; break;
				case 1: NY += bPositive ? Step : -Step; break;
				case 2: NZ += bPositive ? Step : -Step; break;
			}

			bool bExposed = false;
			if (NX < 0 || NX >= SIZE || NY < 0 || NY >= SIZE || NZ < 0 || NZ >= SIZE)
			{
				// 청크 경계 밖 — 노출됨
				bExposed = true;
			}
			else
			{
				const FHktVoxel& Neighbor = Chunk.At(NX, NY, NZ);
				// 동일 Translucent 타입(예: water-water)끼리는 내부 면 컬링.
				const bool bNeighborTranslucentDifferent =
					Neighbor.IsTranslucent() && Neighbor.TypeID != Voxel.TypeID;
				bExposed = Neighbor.IsEmpty() || bNeighborTranslucentDifferent;
			}

			if (bExposed)
			{
				Row |= (1u << U);
			}
		}
		OutMask[V] = Row;
	}
}

void FHktVoxelMesher::MergeQuads(
	FHktVoxelChunk& Chunk,
	int32 Face, int32 Slice,
	const uint32 Mask[32],
	bool bDoubleSided,
	int32 LODLevel)
{
	const int32 Axis = EHktVoxelFace::GetAxis(Face);
	const int32 SIZE = FHktVoxelChunk::SIZE;
	const int32 Step = 1 << LODLevel;
	const int32 DownSize = SIZE >> LODLevel;

	// 비트마스크 기반 Greedy Merge — 다운샘플 좌표 기준
	uint32 Visited[32] = {};

	for (int32 V = 0; V < DownSize; V++)
	{
		uint32 Row = Mask[V] & ~Visited[V];
		while (Row != 0)
		{
			// 가장 낮은 설정 비트 찾기
			int32 StartU = FMath::CountTrailingZeros(Row);

			// StartU에서 시작하는 연속 비트 폭 계산 (최대 DownSize-StartU)
			uint32 Shifted = Row >> StartU;
			int32 Width = FMath::Min((int32)FMath::CountTrailingZeros(~Shifted), DownSize - StartU);

			// 해당 셀의 타입 확인 (다운샘플 좌표 → 풀 좌표)
			int32 SX, SY, SZ;
			switch (Axis)
			{
				case 0: SX = Slice * Step; SY = StartU * Step; SZ = V * Step; break;
				case 1: SX = StartU * Step; SY = Slice * Step; SZ = V * Step; break;
				case 2: SX = StartU * Step; SY = V * Step; SZ = Slice * Step; break;
				default: SX = SY = SZ = 0; break;
			}
			const FHktVoxel& BaseVoxel = Chunk.At(SX, SY, SZ);
			const uint8 BaseBone = Chunk.GetBoneIndex(SX, SY, SZ);

			// GPU 스키닝: 본 인덱스가 다르면 병합 불가 (LOD 0에서만 의미)
			if (Chunk.BoneIndices)
			{
				int32 NewWidth = 1;
				for (int32 DU = StartU + 1; DU < StartU + Width; DU++)
				{
					int32 BX, BY, BZ;
					switch (Axis)
					{
						case 0: BX = Slice * Step; BY = DU * Step; BZ = V * Step; break;
						case 1: BX = DU * Step; BY = Slice * Step; BZ = V * Step; break;
						case 2: BX = DU * Step; BY = V * Step; BZ = Slice * Step; break;
						default: BX = BY = BZ = 0; break;
					}
					if (Chunk.GetBoneIndex(BX, BY, BZ) != BaseBone) break;
					NewWidth++;
				}
				Width = NewWidth;
			}

			// Width=32일 때 1u<<32은 UB → 별도 처리
			uint32 WidthMask = (Width >= 32) ? (~0u << StartU) : (((1u << Width) - 1) << StartU);

			// 아래 행들로 Height 확장 — 같은 타입 + 같은 노출 패턴 + 같은 본
			int32 Height = 1;
			for (int32 DV = V + 1; DV < DownSize; DV++)
			{
				uint32 NextRow = Mask[DV] & ~Visited[DV];
				if ((NextRow & WidthMask) != WidthMask)
				{
					break;
				}

				bool bSameType = true;
				for (int32 DU = StartU; DU < StartU + Width; DU++)
				{
					int32 CX, CY, CZ;
					switch (Axis)
					{
						case 0: CX = Slice * Step; CY = DU * Step; CZ = DV * Step; break;
						case 1: CX = DU * Step; CY = Slice * Step; CZ = DV * Step; break;
						case 2: CX = DU * Step; CY = DV * Step; CZ = Slice * Step; break;
						default: CX = CY = CZ = 0; break;
					}
					const FHktVoxel& CheckVoxel = Chunk.At(CX, CY, CZ);
					if (CheckVoxel.TypeID != BaseVoxel.TypeID ||
						CheckVoxel.PaletteIndex != BaseVoxel.PaletteIndex)
					{
						bSameType = false;
						break;
					}
					if (Chunk.BoneIndices && Chunk.GetBoneIndex(CX, CY, CZ) != BaseBone)
					{
						bSameType = false;
						break;
					}
				}

				if (!bSameType)
				{
					break;
				}

				Height++;
			}

			// Visited 마킹
			for (int32 DV = V; DV < V + Height; DV++)
			{
				Visited[DV] |= WidthMask;
			}

			// 쿼드 방출 (다운샘플 좌표 그대로 전달, EmitQuad 안에서 Step 스케일)
			EmitQuad(Chunk, Face, Slice, StartU, V, Width, Height, BaseVoxel, BaseBone, bDoubleSided, LODLevel);

			// 처리된 비트 제거
			Row &= ~WidthMask;
		}
	}
}

uint8 FHktVoxelMesher::CalcVertexAO(
	const FHktVoxelChunk& Chunk,
	FIntVector Pos, int32 Face, int32 CornerIndex, int32 LODLevel)
{
	const FIntVector Normal = EHktVoxelFace::GetNormal(Face);
	const int32 SIZE = FHktVoxelChunk::SIZE;
	const int32 Step = 1 << LODLevel;

	// 면 법선에 수직인 두 축 결정
	FIntVector Tangent1, Tangent2;
	if (Normal.X != 0)
	{
		Tangent1 = FIntVector(0, 1, 0);
		Tangent2 = FIntVector(0, 0, 1);
	}
	else if (Normal.Y != 0)
	{
		Tangent1 = FIntVector(1, 0, 0);
		Tangent2 = FIntVector(0, 0, 1);
	}
	else
	{
		Tangent1 = FIntVector(1, 0, 0);
		Tangent2 = FIntVector(0, 1, 0);
	}

	// 코너별 오프셋 (Step 단위로 probe — 다운샘플 셀 인접성)
	int32 S1 = (CornerIndex & 1) ? Step : -Step;
	int32 S2 = (CornerIndex & 2) ? Step : -Step;

	auto IsSolid = [&](FIntVector P) -> bool
	{
		if (P.X < 0 || P.X >= SIZE || P.Y < 0 || P.Y >= SIZE || P.Z < 0 || P.Z >= SIZE)
		{
			return false;
		}
		return !Chunk.At(P.X, P.Y, P.Z).IsEmpty();
	};

	FIntVector SurfacePos = Pos + Normal * Step;
	bool bSide1 = IsSolid(SurfacePos + Tangent1 * S1);
	bool bSide2 = IsSolid(SurfacePos + Tangent2 * S2);
	bool bCorner = IsSolid(SurfacePos + Tangent1 * S1 + Tangent2 * S2);

	if (bSide1 && bSide2)
	{
		return 0;
	}
	return 3 - (bSide1 + bSide2 + bCorner);
}

void FHktVoxelMesher::EmitQuad(
	FHktVoxelChunk& Chunk,
	int32 Face, int32 Slice,
	int32 StartU, int32 StartV,
	int32 Width, int32 Height,
	const FHktVoxel& Voxel,
	uint8 BoneIndex,
	bool bDoubleSided,
	int32 LODLevel)
{
	const int32 Axis = EHktVoxelFace::GetAxis(Face);
	const int32 Step = 1 << LODLevel;

	// LOD ≥ 2: 원거리 워터/투명 면 패스 생략 (시각/CPU 비용 절감)
	if (LODLevel >= 2 && Voxel.IsTranslucent())
	{
		return;
	}

	// UE5 왼손 좌표계: 면 법선 방향에서 봤을 때 CW가 앞면
	static constexpr bool bForwardWindingTable[EHktVoxelFace::Count] = { false, true, true, false, false, true };
	const bool bForwardWinding = bForwardWindingTable[Face];

	// 다운샘플 UV → 풀-그리드 XYZ (Step 곱) — 위치/크기는 모두 풀-그리드 단위
	const int32 ScaledSlice = Slice * Step;
	const int32 ScaledU = StartU * Step;
	const int32 ScaledV = StartV * Step;
	const int32 ScaledWidth = Width * Step;
	const int32 ScaledHeight = Height * Step;

	auto ToWorld = [&](int32 U, int32 V) -> FIntVector
	{
		switch (Axis)
		{
			case 0: return FIntVector(ScaledSlice, U, V);
			case 1: return FIntVector(U, ScaledSlice, V);
			case 2: return FIntVector(U, V, ScaledSlice);
			default: return FIntVector::ZeroValue;
		}
	};

	// 4개 코너의 실제 위치에서 AO 계산 (풀-그리드 좌표).
	// Width/Height는 다운샘플 셀 기준 1 이상이므로, max 코너는 (Width-1)*Step 떨어진 셀의 시작점.
	FIntVector CornerPos[4] = {
		ToWorld(ScaledU,                            ScaledV),                              // 0: min,min
		ToWorld(ScaledU + (Width - 1) * Step,       ScaledV),                              // 1: max,min
		ToWorld(ScaledU,                            ScaledV + (Height - 1) * Step),        // 2: min,max
		ToWorld(ScaledU + (Width - 1) * Step,       ScaledV + (Height - 1) * Step),        // 3: max,max
	};

	uint8 AO[4];
	for (int32 i = 0; i < 4; i++)
	{
		AO[i] = CalcVertexAO(Chunk, CornerPos[i], Face, i, LODLevel);
	}

	FIntVector BasePos = CornerPos[0];

	// 버텍스 생성 — 위치/크기는 모두 풀-그리드(0~31) 좌표계로 패킹.
	// 6-bit 필드 한계: ScaledWidth max = 32 (LOD0 32 / LOD3 4*8). Pack에서 0x3F 마스킹되며
	// 32는 셰이더에서 Width=0(=64? 아니 0)으로 보일 위험 → 32 그대로 두고 셰이더가 0이면 32로 처리하도록...
	// 현재 셰이더는 Width=32를 허용 (PackedPositionAndSize의 Width 필드는 0..63). 32는 비트 5(0x20)만 켜짐 → 0x3F 안에서 32로 정상.
	FHktVoxelVertex V0 = FHktVoxelVertex::Pack(
		(uint8)BasePos.X, (uint8)BasePos.Y, (uint8)BasePos.Z,
		(uint8)ScaledWidth, (uint8)ScaledHeight, (uint8)Face,
		Voxel.TypeID, Voxel.PaletteIndex, AO[0], Voxel.Flags, BoneIndex);

	// 대상 배열 선택
	TArray<FHktVoxelVertex>& Vertices = Voxel.IsTranslucent()
		? Chunk.TranslucentVertices
		: Chunk.OpaqueVertices;
	TArray<uint32>& Indices = Voxel.IsTranslucent()
		? Chunk.TranslucentIndices
		: Chunk.OpaqueIndices;

	uint32 BaseIndex = Vertices.Num();

	for (int32 i = 0; i < 4; i++)
	{
		FHktVoxelVertex Vert = V0;
		Vert.PackedMaterialAndAO =
			(Vert.PackedMaterialAndAO & ~(0x3u << 19)) |
			((static_cast<uint32>(AO[i]) & 0x3) << 19);
		Vertices.Add(Vert);
	}

	if (AO[0] + AO[3] > AO[1] + AO[2])
	{
		// 0-3 대각선 분할
		if (bForwardWinding)
		{
			Indices.Append({BaseIndex,   BaseIndex+1, BaseIndex+3,
							BaseIndex,   BaseIndex+3, BaseIndex+2});
		}
		else
		{
			Indices.Append({BaseIndex,   BaseIndex+3, BaseIndex+1,
							BaseIndex,   BaseIndex+2, BaseIndex+3});
		}
		if (bDoubleSided)
		{
			if (bForwardWinding)
			{
				Indices.Append({BaseIndex,   BaseIndex+3, BaseIndex+1,
								BaseIndex,   BaseIndex+2, BaseIndex+3});
			}
			else
			{
				Indices.Append({BaseIndex,   BaseIndex+1, BaseIndex+3,
								BaseIndex,   BaseIndex+3, BaseIndex+2});
			}
		}
	}
	else
	{
		// 1-2 대각선 분할 (AO flip)
		if (bForwardWinding)
		{
			Indices.Append({BaseIndex,   BaseIndex+1, BaseIndex+2,
							BaseIndex+1, BaseIndex+3, BaseIndex+2});
		}
		else
		{
			Indices.Append({BaseIndex+2, BaseIndex+1, BaseIndex,
							BaseIndex+2, BaseIndex+3, BaseIndex+1});
		}
		if (bDoubleSided)
		{
			if (bForwardWinding)
			{
				Indices.Append({BaseIndex+2, BaseIndex+1, BaseIndex,
								BaseIndex+2, BaseIndex+3, BaseIndex+1});
			}
			else
			{
				Indices.Append({BaseIndex,   BaseIndex+1, BaseIndex+2,
								BaseIndex+1, BaseIndex+3, BaseIndex+2});
			}
		}
	}
}
