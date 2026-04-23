// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Meshing/HktVoxelMesher.h"
#include "Meshing/HktVoxelVertex.h"
#include "Data/HktVoxelTypes.h"
#include "LOD/HktVoxelLOD.h"

void FHktVoxelMesher::MeshChunk(FHktVoxelChunk& Chunk, bool bDoubleSided, int32 LODLevel,
                                float BevelSize)
{
	FWriteScopeLock WriteLock(Chunk.MeshLock);

	Chunk.OpaqueVertices.Reset();
	Chunk.OpaqueIndices.Reset();
	Chunk.TranslucentVertices.Reset();
	Chunk.TranslucentIndices.Reset();

	const int32 ClampedLOD = FMath::Clamp(LODLevel, 0, FHktVoxelLODPolicy::MaxLOD);
	const int32 DownSize = FHktVoxelChunk::SIZE >> ClampedLOD;

	// 베벨은 LOD 0(풀 디테일)에서만 유효. 원거리 LOD는 삼각형 수를 아끼고 효과도 보이지 않음.
	const float EffectiveBevel = (ClampedLOD == 0) ? FMath::Clamp(BevelSize, 0.f, 0.45f) : 0.f;

	for (int32 Face = 0; Face < EHktVoxelFace::Count; Face++)
	{
		for (int32 Slice = 0; Slice < DownSize; Slice++)
		{
			uint32 FaceMask[FHktVoxelChunk::SIZE] = {};
			BuildFaceMask(Chunk, Face, Slice, FaceMask, ClampedLOD);
			MergeQuads(Chunk, Face, Slice, FaceMask, bDoubleSided, ClampedLOD, EffectiveBevel);
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
	int32 LODLevel,
	float BevelSize)
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
			EmitQuad(Chunk, Face, Slice, StartU, V, Width, Height, BaseVoxel, BaseBone, bDoubleSided, LODLevel, BevelSize);

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
	int32 LODLevel,
	float BevelSize)
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

	// ---- per-corner 베벨 오프셋 계산 ----
	//
	// 실루엣 판정: 각 U/V edge에 대해, 해당 edge 바깥쪽 in-plane 이웃 cell이
	// 빈칸(empty) 또는 청크 밖이면 그 edge는 silhouette이다. 이 edge에 붙은
	// 두 코너를 in-plane 안쪽으로 BevelSize voxel만큼 당기고, 동시에 face
	// 법선의 반대 방향(solid 안쪽)으로도 BevelSize voxel만큼 밀어넣어
	// 지오메트리 레벨에서 chamfer를 만든다.
	//
	// 베벨을 적용하지 않는 쪽(BevelSize=0 또는 edge가 다른 solid에 접해 있음)은
	// 오프셋이 0이라 기존 평면 greedy mesh와 완전히 동일하게 렌더링된다.
	float BevelOX[4] = {0.f, 0.f, 0.f, 0.f};
	float BevelOY[4] = {0.f, 0.f, 0.f, 0.f};
	float BevelOZ[4] = {0.f, 0.f, 0.f, 0.f};

	if (BevelSize > 0.f)
	{
		const int32 SIZE = FHktVoxelChunk::SIZE;

		auto CellEmpty = [&](int32 X, int32 Y, int32 Z) -> bool
		{
			if (X < 0 || X >= SIZE || Y < 0 || Y >= SIZE || Z < 0 || Z >= SIZE)
			{
				return true;
			}
			return Chunk.At(X, Y, Z).IsEmpty();
		};

		// U-low / U-high / V-low / V-high 각각의 실루엣 여부 (쿼드 전체 변 기준).
		// 효율을 위해 변 전체가 아닌 대표 샘플 셀(쿼드 중앙의 해당 변 셀)로 판정.
		// 아주 복잡한 형태에서는 변 전체가 실루엣이 아닐 수 있지만 이 경우는 드물고,
		// 잘못 베벨이 적용되어도 단지 시각적 미세 오차일 뿐이므로 허용한다.
		auto InPlaneEmpty = [&](int32 USample, int32 VSample, int32 DU, int32 DV) -> bool
		{
			// Axis에 따라 U, V를 축 좌표로 매핑하여 in-plane 이웃을 probe.
			switch (Axis)
			{
				case 0: return CellEmpty(ScaledSlice, USample + DU, VSample + DV);
				case 1: return CellEmpty(USample + DU, ScaledSlice, VSample + DV);
				case 2: return CellEmpty(USample + DU, VSample + DV, ScaledSlice);
			}
			return true;
		};

		const int32 MidU = ScaledU + (ScaledWidth / 2);
		const int32 MidV = ScaledV + (ScaledHeight / 2);
		const bool bSilU0 = InPlaneEmpty(ScaledU,                    MidV, -Step, 0);       // -U silhouette
		const bool bSilU1 = InPlaneEmpty(ScaledU + ScaledWidth - 1,  MidV, +Step, 0);       // +U silhouette
		const bool bSilV0 = InPlaneEmpty(MidU,                       ScaledV, 0, -Step);    // -V silhouette
		const bool bSilV1 = InPlaneEmpty(MidU,                       ScaledV + ScaledHeight - 1, 0, +Step);  // +V silhouette

		// 축 0(X) → U=Y, V=Z.  축 1(Y) → U=X, V=Z.  축 2(Z) → U=X, V=Y.
		// 코너 인덱스: bit0 = U-high, bit1 = V-high. Corner 0 = (UMin, VMin).
		auto SetCornerOffset = [&](int32 CornerIdx, float OffU, float OffV, float OffN)
		{
			// In-plane 이동은 U / V 축 방향으로 각각. 법선 이동은 Face 법선 반대 방향.
			const FIntVector Normal = EHktVoxelFace::GetNormal((uint8)Face);
			switch (Axis)
			{
				case 0:
					// X=Slice축 법선, Y=U, Z=V
					BevelOX[CornerIdx] += -OffN * (float)Normal.X;
					BevelOY[CornerIdx] += OffU;
					BevelOZ[CornerIdx] += OffV;
					break;
				case 1:
					// Y=Slice축 법선, X=U, Z=V
					BevelOX[CornerIdx] += OffU;
					BevelOY[CornerIdx] += -OffN * (float)Normal.Y;
					BevelOZ[CornerIdx] += OffV;
					break;
				case 2:
					// Z=Slice축 법선, X=U, Y=V
					BevelOX[CornerIdx] += OffU;
					BevelOY[CornerIdx] += OffV;
					BevelOZ[CornerIdx] += -OffN * (float)Normal.Z;
					break;
			}
		};

		// 코너별로 U/V edge 접촉 여부를 확인하고 실루엣이면 오프셋 누적.
		// Corner: 0=(Umin,Vmin), 1=(Umax,Vmin), 2=(Umin,Vmax), 3=(Umax,Vmax)
		for (int32 c = 0; c < 4; ++c)
		{
			const bool bUHigh = (c & 1) != 0;
			const bool bVHigh = (c & 2) != 0;

			const bool bUSil = bUHigh ? bSilU1 : bSilU0;
			const bool bVSil = bVHigh ? bSilV1 : bSilV0;

			if (!bUSil && !bVSil)
			{
				continue;
			}

			// In-plane inset 방향: U-silhouette이면 U 방향으로 중심을 향해 당긴다.
			const float OffU = bUSil ? (bUHigh ? -BevelSize : +BevelSize) : 0.f;
			const float OffV = bVSil ? (bVHigh ? -BevelSize : +BevelSize) : 0.f;

			// 법선 반대(=솔리드 안쪽) 오프셋 — U 또는 V 중 하나라도 실루엣이면 적용.
			// 코너에서만 강하게(= BevelSize), 변 중간은 자연 보간으로 완화된다.
			const float OffN = BevelSize;

			SetCornerOffset(c, OffU, OffV, OffN);
		}
	}

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
		Vert.SetBevelOffset(BevelOX[i], BevelOY[i], BevelOZ[i]);
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
