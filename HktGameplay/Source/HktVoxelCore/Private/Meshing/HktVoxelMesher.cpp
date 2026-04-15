// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Meshing/HktVoxelMesher.h"
#include "Meshing/HktVoxelVertex.h"
#include "Data/HktVoxelTypes.h"

void FHktVoxelMesher::MeshChunk(FHktVoxelChunk& Chunk, bool bDoubleSided)
{
	FWriteScopeLock WriteLock(Chunk.MeshLock);

	Chunk.OpaqueVertices.Reset();
	Chunk.OpaqueIndices.Reset();
	Chunk.TranslucentVertices.Reset();
	Chunk.TranslucentIndices.Reset();

	for (int32 Face = 0; Face < EHktVoxelFace::Count; Face++)
	{
		for (int32 Slice = 0; Slice < FHktVoxelChunk::SIZE; Slice++)
		{
			uint32 FaceMask[FHktVoxelChunk::SIZE] = {};
			BuildFaceMask(Chunk, Face, Slice, FaceMask);
			MergeQuads(Chunk, Face, Slice, FaceMask, bDoubleSided);
		}
	}

	// bMeshDirty/bMeshReady는 스케줄러 람다에서 세대 확인 후 관리
}

void FHktVoxelMesher::BuildFaceMask(
	const FHktVoxelChunk& Chunk,
	int32 Face, int32 Slice,
	uint32 OutMask[32])
{
	const int32 Axis = EHktVoxelFace::GetAxis(Face);
	const bool bPositive = EHktVoxelFace::IsPositive(Face);
	const int32 SIZE = FHktVoxelChunk::SIZE;

	// 축별로 U, V 매핑
	// Axis=0(X): U=Y, V=Z, Slice=X
	// Axis=1(Y): U=X, V=Z, Slice=Y
	// Axis=2(Z): U=X, V=Y, Slice=Z
	for (int32 V = 0; V < SIZE; V++)
	{
		uint32 Row = 0;
		for (int32 U = 0; U < SIZE; U++)
		{
			int32 X, Y, Z;
			switch (Axis)
			{
				case 0: X = Slice; Y = U; Z = V; break;
				case 1: X = U; Y = Slice; Z = V; break;
				case 2: X = U; Y = V; Z = Slice; break;
				default: X = Y = Z = 0; break;
			}

			const FHktVoxel& Voxel = Chunk.At(X, Y, Z);
			if (Voxel.IsEmpty())
			{
				continue;
			}

			// 인접 복셀 체크 — 해당 면이 노출되었는지
			int32 NX = X, NY = Y, NZ = Z;
			switch (Axis)
			{
				case 0: NX += bPositive ? 1 : -1; break;
				case 1: NY += bPositive ? 1 : -1; break;
				case 2: NZ += bPositive ? 1 : -1; break;
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
				bExposed = Neighbor.IsEmpty() || Neighbor.IsTranslucent();
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
	bool bDoubleSided)
{
	const int32 Axis = EHktVoxelFace::GetAxis(Face);
	const int32 SIZE = FHktVoxelChunk::SIZE;

	// 비트마스크 기반 Greedy Merge
	// 행 단위로 연속 비트를 찾고, 같은 타입이면 아래 행으로 확장
	uint32 Visited[SIZE] = {};

	for (int32 V = 0; V < SIZE; V++)
	{
		uint32 Row = Mask[V] & ~Visited[V];
		while (Row != 0)
		{
			// 가장 낮은 설정 비트 찾기
			int32 StartU = FMath::CountTrailingZeros(Row);

			// StartU에서 시작하는 연속 비트 폭 계산 (최대 SIZE-StartU)
			uint32 Shifted = Row >> StartU;
			int32 Width = FMath::Min((int32)FMath::CountTrailingZeros(~Shifted), SIZE - StartU);

			// 해당 복셀의 타입 확인
			int32 SX, SY, SZ;
			switch (Axis)
			{
				case 0: SX = Slice; SY = StartU; SZ = V; break;
				case 1: SX = StartU; SY = Slice; SZ = V; break;
				case 2: SX = StartU; SY = V; SZ = Slice; break;
				default: SX = SY = SZ = 0; break;
			}
			const FHktVoxel& BaseVoxel = Chunk.At(SX, SY, SZ);
			const uint8 BaseBone = Chunk.GetBoneIndex(SX, SY, SZ);

			// GPU 스키닝: 본 인덱스가 다르면 병합 불가 — Width 재계산
			if (Chunk.BoneIndices)
			{
				int32 NewWidth = 1;
				for (int32 DU = StartU + 1; DU < StartU + Width; DU++)
				{
					int32 BX, BY, BZ;
					switch (Axis)
					{
						case 0: BX = Slice; BY = DU; BZ = V; break;
						case 1: BX = DU; BY = Slice; BZ = V; break;
						case 2: BX = DU; BY = V; BZ = Slice; break;
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
			for (int32 DV = V + 1; DV < SIZE; DV++)
			{
				uint32 NextRow = Mask[DV] & ~Visited[DV];
				if ((NextRow & WidthMask) != WidthMask)
				{
					break;
				}

				// 같은 타입 + 같은 본인지 확인
				bool bSameType = true;
				for (int32 DU = StartU; DU < StartU + Width; DU++)
				{
					int32 CX, CY, CZ;
					switch (Axis)
					{
						case 0: CX = Slice; CY = DU; CZ = DV; break;
						case 1: CX = DU; CY = Slice; CZ = DV; break;
						case 2: CX = DU; CY = DV; CZ = Slice; break;
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

			// 쿼드 방출
			EmitQuad(Chunk, Face, Slice, StartU, V, Width, Height, BaseVoxel, BaseBone, bDoubleSided);

			// 처리된 비트 제거
			Row &= ~WidthMask;
		}
	}
}

uint8 FHktVoxelMesher::CalcVertexAO(
	const FHktVoxelChunk& Chunk,
	FIntVector Pos, int32 Face, int32 CornerIndex)
{
	// 간단한 AO: 코너 주변 3개 인접 복셀을 체크
	// side1, side2, corner → 0~3 (0=완전 차폐, 3=차폐 없음)
	const FIntVector Normal = EHktVoxelFace::GetNormal(Face);
	const int32 SIZE = FHktVoxelChunk::SIZE;

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

	// 코너별 오프셋
	int32 S1 = (CornerIndex & 1) ? 1 : -1;
	int32 S2 = (CornerIndex & 2) ? 1 : -1;

	auto IsSolid = [&](FIntVector P) -> bool
	{
		if (P.X < 0 || P.X >= SIZE || P.Y < 0 || P.Y >= SIZE || P.Z < 0 || P.Z >= SIZE)
		{
			return false;
		}
		return !Chunk.At(P.X, P.Y, P.Z).IsEmpty();
	};

	FIntVector SurfacePos = Pos + Normal;
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
	bool bDoubleSided)
{
	const int32 Axis = EHktVoxelFace::GetAxis(Face);

	// UE5 왼손 좌표계: 면 법선 방향에서 봤을 때 CW가 앞면
	// PosX(+X): U=Y,V=Z → CW=forward  | NegX(-X): U=Y,V=Z → CCW=forward
	// PosY(+Y): U=X,V=Z → CCW=forward | NegY(-Y): U=X,V=Z → CW=forward
	// PosZ(+Z): U=X,V=Y → CW=forward  | NegZ(-Z): U=X,V=Y → CCW=forward
	static constexpr bool bForwardWindingTable[EHktVoxelFace::Count] = { false, true, true, false, false, true };
	const bool bForwardWinding = bForwardWindingTable[Face];

	// UV → XYZ 변환
	auto ToWorld = [&](int32 U, int32 V) -> FIntVector
	{
		switch (Axis)
		{
			case 0: return FIntVector(Slice, U, V);
			case 1: return FIntVector(U, Slice, V);
			case 2: return FIntVector(U, V, Slice);
			default: return FIntVector::ZeroValue;
		}
	};

	// 4개 코너의 실제 위치에서 AO 계산
	// 코너 순서: 0=(minU,minV), 1=(maxU,minV), 2=(minU,maxV), 3=(maxU,maxV)
	FIntVector CornerPos[4] = {
		ToWorld(StartU,             StartV),              // 0: min,min
		ToWorld(StartU + Width - 1, StartV),              // 1: max,min
		ToWorld(StartU,             StartV + Height - 1), // 2: min,max
		ToWorld(StartU + Width - 1, StartV + Height - 1), // 3: max,max
	};

	uint8 AO[4];
	for (int32 i = 0; i < 4; i++)
	{
		AO[i] = CalcVertexAO(Chunk, CornerPos[i], Face, i);
	}

	FIntVector BasePos = CornerPos[0];

	// 버텍스 생성
	FHktVoxelVertex V0 = FHktVoxelVertex::Pack(
		BasePos.X, BasePos.Y, BasePos.Z,
		Width, Height, Face,
		Voxel.TypeID, Voxel.PaletteIndex, AO[0], Voxel.Flags, BoneIndex);

	// 대상 배열 선택
	TArray<FHktVoxelVertex>& Vertices = Voxel.IsTranslucent()
		? Chunk.TranslucentVertices
		: Chunk.OpaqueVertices;
	TArray<uint32>& Indices = Voxel.IsTranslucent()
		? Chunk.TranslucentIndices
		: Chunk.OpaqueIndices;

	uint32 BaseIndex = Vertices.Num();

	// 4개 버텍스 추가 (쿼드의 각 코너)
	// AO 인덱싱과 정확한 좌표는 셰이더에서 Width/Height로 확장
	for (int32 i = 0; i < 4; i++)
	{
		FHktVoxelVertex Vert = V0;
		// 코너별 AO만 다르게 — 위치 확장은 셰이더에서 SV_VertexID % 4로 처리
		Vert.PackedMaterialAndAO =
			(Vert.PackedMaterialAndAO & ~(0x3u << 19)) |
			((static_cast<uint32>(AO[i]) & 0x3) << 19);
		Vertices.Add(Vert);
	}

	// 인덱스 (face 방향별 winding + AO flip 고려)
	// bDoubleSided=true: 양면 렌더링 (엔티티 복셀 — body part junction 내부 노출 방지)
	// bDoubleSided=false: 단면 렌더링 (terrain — 삼각형 수 절반)
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
