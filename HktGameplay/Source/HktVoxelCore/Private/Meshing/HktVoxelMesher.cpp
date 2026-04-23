// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Meshing/HktVoxelMesher.h"
#include "Meshing/HktVoxelVertex.h"
#include "Data/HktVoxelTypes.h"
#include "LOD/HktVoxelLOD.h"

// 베벨 토글 CVar — HktVoxelCoreModule에서 등록. 기본 ON.
// 해당 청크가 워커 스레드에서 메싱될 때 읽는다. 단순 int32 — tearing이 있어도
// 값 전이(0↔1)는 곧 다음 재메싱 때 일관되게 수렴.
extern int32 GHktVoxelBevelEnabled;

void FHktVoxelMesher::MeshChunk(FHktVoxelChunk& Chunk, bool bDoubleSided, int32 LODLevel)
{
	FWriteScopeLock WriteLock(Chunk.MeshLock);

	Chunk.OpaqueVertices.Reset();
	Chunk.OpaqueIndices.Reset();
	Chunk.TranslucentVertices.Reset();
	Chunk.TranslucentIndices.Reset();
	Chunk.BevelVertices.Reset();
	Chunk.BevelIndices.Reset();

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

	// LOD0 근접 청크에만 실제 지오메트리 모서리 베벨 추가.
	// LOD1+는 거리상 2cm 실루엣 변화가 인지 불가 → 비용 0 유지.
	if (ClampedLOD == 0 && GHktVoxelBevelEnabled != 0)
	{
		EmitConvexEdges(Chunk, 0.15f);
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

// ============================================================================
// EmitConvexEdges — LOD0 볼록 모서리 45° 베벨 지오메트리 생성
// ============================================================================
//
// 알고리즘:
//   1) 각 솔리드 복셀 V(x,y,z)를 순회.
//   2) 12개 cube 모서리 후보를 검사. 각 모서리는 (주축, 수직 축1, 수직 축2)로
//      식별되며 수직 두 축의 부호 조합이 볼록 방향 s1,s2 ∈ {-1,+1}.
//   3) 노출 조건:
//        - 수직 축1의 +s1 방향 이웃이 비어있거나 다른 translucent 타입
//        - 수직 축2의 +s2 방향 이웃이 비어있거나 다른 translucent 타입
//        - 대각 (s1 B_hat + s2 C_hat) 이웃도 비어있음(볼록 보장)
//   4) 조건을 만족하는 모서리에 대해 두 면 사이를 45°로 이어주는 베벨 쿼드
//      4개 버텍스 + 2개 삼각형 방출.
//
// 각 모서리에 대한 쿼드 4 정점(voxel 로컬 좌표):
//   E0 = (cell 원점) + 주축 시작 + B축(+/- s1)*b + C축(0 또는 1)
//   E1 = (cell 원점) + 주축 시작 + B축(0 또는 1) + C축(+/- s2)*b
//   (+주축 끝 벌전 E2, E3 동일 패턴)
// 여기서 b = BevelSize * VoxelSize, 그리고 face의 "1복셀" 경계점은 1.0 또는 0.0.
// 세부 공식은 구현부 참고.
// ============================================================================

// 베벨 쿼드 각 모서리 정의 — (PrimaryAxis, B_axis, C_axis, s1_sign, s2_sign)
// PrimaryAxis: 에지가 놓인 방향(0=X,1=Y,2=Z)
// B_axis / C_axis: PrimaryAxis에 수직인 나머지 두 축
// s1_sign / s2_sign: 각각 B, C축의 노출 방향. +1이면 양, -1이면 음.
// 총 12가지 = 3 축 × 2 × 2.
static constexpr int32 kBevelEdgeCount = 12;
struct FBevelEdgeDef
{
	int8 PrimaryAxis;  // 0=X, 1=Y, 2=Z
	int8 BAxis;
	int8 CAxis;
	int8 S1;           // +1 또는 -1
	int8 S2;
};

static const FBevelEdgeDef kBevelEdges[kBevelEdgeCount] = {
	// PrimaryAxis=0 (X축 에지) → BAxis=1(Y), CAxis=2(Z)
	{0, 1, 2, +1, +1}, {0, 1, 2, +1, -1}, {0, 1, 2, -1, +1}, {0, 1, 2, -1, -1},
	// PrimaryAxis=1 (Y축 에지) → BAxis=0(X), CAxis=2(Z)
	{1, 0, 2, +1, +1}, {1, 0, 2, +1, -1}, {1, 0, 2, -1, +1}, {1, 0, 2, -1, -1},
	// PrimaryAxis=2 (Z축 에지) → BAxis=0(X), CAxis=1(Y)
	{2, 0, 1, +1, +1}, {2, 0, 1, +1, -1}, {2, 0, 1, -1, +1}, {2, 0, 1, -1, -1},
};

void FHktVoxelMesher::EmitConvexEdges(FHktVoxelChunk& Chunk, float BevelSize)
{
	const int32 SIZE = FHktVoxelChunk::SIZE;

	auto IsExposed = [&](int32 X, int32 Y, int32 Z, const FHktVoxel& Self) -> bool
	{
		// 청크 경계 밖은 노출로 취급 (greedy mesher와 일치).
		if (X < 0 || X >= SIZE || Y < 0 || Y >= SIZE || Z < 0 || Z >= SIZE)
		{
			return true;
		}
		const FHktVoxel& N = Chunk.At(X, Y, Z);
		if (N.IsEmpty()) return true;
		// 동일 translucent 타입끼리는 내부 컬링됨 — 동일한 예측을 따른다.
		if (N.IsTranslucent() && N.TypeID != Self.TypeID) return true;
		return false;
	};

	for (int32 Z = 0; Z < SIZE; ++Z)
	{
		for (int32 Y = 0; Y < SIZE; ++Y)
		{
			for (int32 X = 0; X < SIZE; ++X)
			{
				const FHktVoxel& V = Chunk.At(X, Y, Z);
				if (V.IsEmpty()) continue;
				// 반투명(물)은 베벨 대상에서 제외.
				if (V.IsTranslucent()) continue;

				const uint8 BoneIdx = Chunk.GetBoneIndex(X, Y, Z);

				for (int32 EdgeIdx = 0; EdgeIdx < kBevelEdgeCount; ++EdgeIdx)
				{
					const FBevelEdgeDef& Def = kBevelEdges[EdgeIdx];

					// 세 체크 이웃의 복셀 좌표 계산.
					int32 NbrB[3] = { X, Y, Z };
					int32 NbrC[3] = { X, Y, Z };
					int32 NbrD[3] = { X, Y, Z };
					NbrB[Def.BAxis] += Def.S1;
					NbrC[Def.CAxis] += Def.S2;
					NbrD[Def.BAxis] += Def.S1;
					NbrD[Def.CAxis] += Def.S2;

					const bool bExpB = IsExposed(NbrB[0], NbrB[1], NbrB[2], V);
					const bool bExpC = IsExposed(NbrC[0], NbrC[1], NbrC[2], V);
					const bool bExpD = IsExposed(NbrD[0], NbrD[1], NbrD[2], V);

					// 볼록 노출 조건: B, C 방향 두 이웃 노출 + 대각 D도 노출.
					// (대각 D가 솔리드면 오목이므로 베벨이 그쪽 면을 관통)
					if (!(bExpB && bExpC && bExpD)) continue;

					// 모서리 길이(= 주축) 양 끝을 베벨 쿼드로 연결.
					// 복셀 로컬 좌표(0~32)에서 셀은 [X,X+1]×[Y,Y+1]×[Z,Z+1] 범위.
					// 모서리 좌표는 B축에서 (S1>0 ? 1 : 0), C축에서 (S2>0 ? 1 : 0).
					// 베벨 인셋은 경계로부터 BevelSize voxel 안쪽으로 인입.
					float Origin[3] = { static_cast<float>(X), static_cast<float>(Y), static_cast<float>(Z) };

					// 모서리 이중 점(P_B, P_C): 각각 B축에서 +S1 면 위 / C축에서 +S2 면 위.
					// P_B는 B = (S1>0 ? 1 : 0), C = (S2>0 ? 1-b : b)로 인셋.
					// P_C는 B = (S1>0 ? 1-b : b)로 인셋, C = (S2>0 ? 1 : 0).
					const float BOuter = (Def.S1 > 0) ? 1.0f : 0.0f;
					const float COuter = (Def.S2 > 0) ? 1.0f : 0.0f;
					const float BInset = (Def.S1 > 0) ? (1.0f - BevelSize) : BevelSize;
					const float CInset = (Def.S2 > 0) ? (1.0f - BevelSize) : BevelSize;

					// 주축 시작/끝 (0 또는 1 복셀).
					const float PStart = 0.0f;
					const float PEnd = 1.0f;

					// 4 정점 좌표 구성 — (PStart, P_B), (PStart, P_C), (PEnd, P_B), (PEnd, P_C).
					auto MakePos = [&](float P, bool bUseB)
					{
						float Out[3] = { Origin[0], Origin[1], Origin[2] };
						Out[Def.PrimaryAxis] += P;
						if (bUseB)
						{
							Out[Def.BAxis] += BOuter;
							Out[Def.CAxis] += CInset;
						}
						else
						{
							Out[Def.BAxis] += BInset;
							Out[Def.CAxis] += COuter;
						}
						return FVector3f(Out[0], Out[1], Out[2]);
					};

					const FVector3f P0 = MakePos(PStart, true);   // 시작점, B면
					const FVector3f P1 = MakePos(PStart, false);  // 시작점, C면
					const FVector3f P2 = MakePos(PEnd, true);     // 끝점, B면
					const FVector3f P3 = MakePos(PEnd, false);    // 끝점, C면

					// 정점 생성 — 4개 전부 동일 material / bone / AO.
					// AO는 해당 복셀의 평균에 가까운 근사로 0 부여(추후 필요시 CalcVertexAO 활용).
					const uint8 AO = 3;  // 완전 노출 가정 — 볼록 모서리는 주변 가림 없음
					const bool bS1Pos = (Def.S1 > 0);
					const bool bS2Pos = (Def.S2 > 0);

					const uint32 Base = Chunk.BevelVertices.Num();
					Chunk.BevelVertices.Add(FHktVoxelBevelVertex::Make(
						P0.X, P0.Y, P0.Z, (uint8)Def.PrimaryAxis, bS1Pos, bS2Pos,
						V.TypeID, V.PaletteIndex, AO, V.Flags, BoneIdx));
					Chunk.BevelVertices.Add(FHktVoxelBevelVertex::Make(
						P1.X, P1.Y, P1.Z, (uint8)Def.PrimaryAxis, bS1Pos, bS2Pos,
						V.TypeID, V.PaletteIndex, AO, V.Flags, BoneIdx));
					Chunk.BevelVertices.Add(FHktVoxelBevelVertex::Make(
						P2.X, P2.Y, P2.Z, (uint8)Def.PrimaryAxis, bS1Pos, bS2Pos,
						V.TypeID, V.PaletteIndex, AO, V.Flags, BoneIdx));
					Chunk.BevelVertices.Add(FHktVoxelBevelVertex::Make(
						P3.X, P3.Y, P3.Z, (uint8)Def.PrimaryAxis, bS1Pos, bS2Pos,
						V.TypeID, V.PaletteIndex, AO, V.Flags, BoneIdx));

					// 인덱스 — (P0, P1, P2) + (P1, P3, P2). 법선이 (s1*B + s2*C)/√2 바깥쪽을
					// 향하도록 winding 조정. s1*s2가 양이면 CCW, 음이면 CW로 뒤집는다.
					// UE5 왼손 좌표계 + CW가 앞면이므로 외부 관찰자 기준으로 다음 순서.
					if (Def.S1 * Def.S2 > 0)
					{
						Chunk.BevelIndices.Append({ Base + 0, Base + 2, Base + 1,
						                             Base + 1, Base + 2, Base + 3 });
					}
					else
					{
						Chunk.BevelIndices.Append({ Base + 0, Base + 1, Base + 2,
						                             Base + 1, Base + 3, Base + 2 });
					}
				}
			}
		}
	}
}
