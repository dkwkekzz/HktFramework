// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktTerrainChunkLoader.h"

namespace
{
	/**
	 * 공통 유틸 — 카메라 가까운 순 정렬 키. Coord → Squared distance to CameraPos.
	 */
	static float ChunkDistSq(const FIntVector& Coord, const FVector& CameraPos, float ChunkWorldSize)
	{
		const float X = (Coord.X + 0.5f) * ChunkWorldSize - static_cast<float>(CameraPos.X);
		const float Y = (Coord.Y + 0.5f) * ChunkWorldSize - static_cast<float>(CameraPos.Y);
		const float Z = (Coord.Z + 0.5f) * ChunkWorldSize - static_cast<float>(CameraPos.Z);
		return X * X + Y * Y + Z * Z;
	}

	// ======================================================================
	// Legacy — 단일 반경 내 모든 청크를 Tier::Near로 로드. 회전 완전 무시.
	// LOD 파이프라인 문제 시 안전한 폴백.
	// ======================================================================
	class FHktLegacyChunkLoader final : public IHktTerrainChunkLoader
	{
	public:
		virtual void Configure(const FHktTerrainLoaderConfig& Cfg) override
		{
			const float NewRadius = FMath::Max(1.f, Cfg.PrimaryRadius);
			if (!FMath::IsNearlyEqual(NewRadius, StreamRadius))
			{
				StreamRadius = NewRadius;
				bHasLastCamera = false;  // 반경 변경 → stability 무효화, 다음 Update에서 재스캔
			}
			MaxLoadsPerFrame = FMath::Max(1, Cfg.MaxLoadsPerFrame);
			MaxLoadedChunks = Cfg.MaxLoadedChunks;
			HeightMinZ = Cfg.HeightMinZ;
			HeightMaxZ = Cfg.HeightMaxZ;
		}

		virtual void Update(const FVector& CameraPos, float ChunkWorldSize) override;

		virtual const TArray<FHktChunkTierRequest>& GetChunksToLoad() const override { return ChunksToLoad; }
		virtual const TArray<FIntVector>& GetChunksToUnload() const override { return ChunksToUnload; }
		virtual const TArray<FHktChunkTierRequest>& GetChunksToRetier() const override { return EmptyRetier; }
		virtual const TMap<FIntVector, EHktTerrainChunkTier>& GetLoadedChunks() const override { return LoadedChunks; }

		virtual void GetTierHistogram(int32 OutCounts[2]) const override
		{
			OutCounts[0] = LoadedChunks.Num();  // 전부 Near
			OutCounts[1] = 0;
		}

		virtual void Clear() override
		{
			LoadedChunks.Empty();
			ChunksToLoad.Reset();
			ChunksToUnload.Reset();
			ScratchDesired.Reset();
			bHasLastCamera = false;
		}

	private:
		TMap<FIntVector, EHktTerrainChunkTier> LoadedChunks;
		TArray<FHktChunkTierRequest> ChunksToLoad;
		TArray<FIntVector> ChunksToUnload;
		TArray<FHktChunkTierRequest> EmptyRetier;  // Legacy는 Tier 전이 없음
		TSet<FIntVector> ScratchDesired;

		float StreamRadius = 8000.f;
		int32 MaxLoadsPerFrame = 16;
		int32 MaxLoadedChunks = 2048;
		int32 HeightMinZ = 0;
		int32 HeightMaxZ = 3;

		FIntVector LastCameraChunk = FIntVector(INT32_MAX);
		bool bHasLastCamera = false;
	};

	void FHktLegacyChunkLoader::Update(const FVector& CameraPos, float ChunkWorldSize)
	{
		ChunksToLoad.Reset();
		ChunksToUnload.Reset();
		ScratchDesired.Reset();

		if (ChunkWorldSize <= 0.f)
		{
			return;
		}

		const FIntVector CameraChunk(
			FMath::FloorToInt(CameraPos.X / ChunkWorldSize),
			FMath::FloorToInt(CameraPos.Y / ChunkWorldSize),
			0);

		if (bHasLastCamera && CameraChunk == LastCameraChunk)
		{
			return;  // 회전 무관, 위치 그대로 → 작업 없음
		}

		const float RadiusSq = StreamRadius * StreamRadius;
		const int32 RadiusInChunks = FMath::CeilToInt(StreamRadius / ChunkWorldSize);
		const int32 ZSpan = FMath::Max(0, HeightMaxZ - HeightMinZ + 1);
		ScratchDesired.Reserve((2 * RadiusInChunks + 1) * (2 * RadiusInChunks + 1) * FMath::Max(1, ZSpan));

		for (int32 DX = -RadiusInChunks; DX <= RadiusInChunks; ++DX)
		{
			for (int32 DY = -RadiusInChunks; DY <= RadiusInChunks; ++DY)
			{
				const int32 CX = CameraChunk.X + DX;
				const int32 CY = CameraChunk.Y + DY;
				const float DX_W = (CX + 0.5f) * ChunkWorldSize - static_cast<float>(CameraPos.X);
				const float DY_W = (CY + 0.5f) * ChunkWorldSize - static_cast<float>(CameraPos.Y);
				if (DX_W * DX_W + DY_W * DY_W > RadiusSq)
				{
					continue;
				}
				for (int32 Z = HeightMinZ; Z <= HeightMaxZ; ++Z)
				{
					ScratchDesired.Add(FIntVector(CX, CY, Z));
				}
			}
		}

		for (const TPair<FIntVector, EHktTerrainChunkTier>& Pair : LoadedChunks)
		{
			if (!ScratchDesired.Contains(Pair.Key))
			{
				ChunksToUnload.Add(Pair.Key);
			}
		}

		TArray<FIntVector> LoadCandidates;
		LoadCandidates.Reserve(ScratchDesired.Num());
		for (const FIntVector& Coord : ScratchDesired)
		{
			if (!LoadedChunks.Contains(Coord))
			{
				LoadCandidates.Add(Coord);
			}
		}
		LoadCandidates.Sort([&CameraPos, ChunkWorldSize](const FIntVector& A, const FIntVector& B)
		{
			return ChunkDistSq(A, CameraPos, ChunkWorldSize) < ChunkDistSq(B, CameraPos, ChunkWorldSize);
		});

		const int32 MemRemaining = (MaxLoadedChunks > 0)
			? FMath::Max(0, MaxLoadedChunks - LoadedChunks.Num())
			: LoadCandidates.Num();
		const int32 Allowed = FMath::Min(MaxLoadsPerFrame, MemRemaining);

		for (int32 i = 0; i < Allowed && i < LoadCandidates.Num(); ++i)
		{
			ChunksToLoad.Add({ LoadCandidates[i], EHktTerrainChunkTier::Near });
		}

		for (const FIntVector& Coord : ChunksToUnload)
		{
			LoadedChunks.Remove(Coord);
		}
		for (const FHktChunkTierRequest& Req : ChunksToLoad)
		{
			LoadedChunks.Add(Req.Coord, Req.Tier);
		}

		// 로드 버짓에 막혀 잔여가 있으면 다음 틱에도 스캔 필요 — stability 보류.
		const bool bFullyDrained = (ChunksToLoad.Num() == LoadCandidates.Num());
		if (bFullyDrained)
		{
			LastCameraChunk = CameraChunk;
			bHasLastCamera = true;
		}
		else
		{
			bHasLastCamera = false;
		}
	}

	// ======================================================================
	// Proximity — 근거리(Tier::Near, 풀 디테일) + 원거리(Tier::Far, 간이) 2링.
	// 회전 무관. Tier 전이는 카메라가 청크 경계를 넘을 때만 발생.
	// ======================================================================
	class FHktProximityChunkLoader final : public IHktTerrainChunkLoader
	{
	public:
		virtual void Configure(const FHktTerrainLoaderConfig& Cfg) override
		{
			const float NewNear = FMath::Max(1.f, Cfg.PrimaryRadius);
			const float NewFar = FMath::Max(NewNear + 1.f, Cfg.SecondaryRadius);
			if (!FMath::IsNearlyEqual(NewNear, NearRadius) || !FMath::IsNearlyEqual(NewFar, FarRadius))
			{
				NearRadius = NewNear;
				FarRadius = NewFar;
				bHasLastCamera = false;  // 반경 변경 → 재스캔
			}
			MaxLoadsPerFrame = FMath::Max(1, Cfg.MaxLoadsPerFrame);
			MaxLoadedChunks = Cfg.MaxLoadedChunks;
			HeightMinZ = Cfg.HeightMinZ;
			HeightMaxZ = Cfg.HeightMaxZ;
		}

		virtual void Update(const FVector& CameraPos, float ChunkWorldSize) override;

		virtual const TArray<FHktChunkTierRequest>& GetChunksToLoad() const override { return ChunksToLoad; }
		virtual const TArray<FIntVector>& GetChunksToUnload() const override { return ChunksToUnload; }
		virtual const TArray<FHktChunkTierRequest>& GetChunksToRetier() const override { return ChunksToRetier; }
		virtual const TMap<FIntVector, EHktTerrainChunkTier>& GetLoadedChunks() const override { return LoadedChunks; }

		virtual void GetTierHistogram(int32 OutCounts[2]) const override
		{
			OutCounts[0] = 0;
			OutCounts[1] = 0;
			for (const TPair<FIntVector, EHktTerrainChunkTier>& Pair : LoadedChunks)
			{
				const int32 Idx = static_cast<int32>(Pair.Value);
				if (Idx >= 0 && Idx < 2) { ++OutCounts[Idx]; }
			}
		}

		virtual void Clear() override
		{
			LoadedChunks.Empty();
			ChunksToLoad.Reset();
			ChunksToUnload.Reset();
			ChunksToRetier.Reset();
			ScratchDesired.Reset();
			bHasLastCamera = false;
		}

	private:
		TMap<FIntVector, EHktTerrainChunkTier> LoadedChunks;
		TArray<FHktChunkTierRequest> ChunksToLoad;
		TArray<FIntVector> ChunksToUnload;
		TArray<FHktChunkTierRequest> ChunksToRetier;
		TMap<FIntVector, EHktTerrainChunkTier> ScratchDesired;

		float NearRadius = 1500.f;
		float FarRadius  = 8000.f;
		int32 MaxLoadsPerFrame = 16;
		int32 MaxLoadedChunks = 2048;
		int32 HeightMinZ = 0;
		int32 HeightMaxZ = 3;

		FIntVector LastCameraChunk = FIntVector(INT32_MAX);
		bool bHasLastCamera = false;
	};

	void FHktProximityChunkLoader::Update(const FVector& CameraPos, float ChunkWorldSize)
	{
		ChunksToLoad.Reset();
		ChunksToUnload.Reset();
		ChunksToRetier.Reset();
		ScratchDesired.Reset();

		if (ChunkWorldSize <= 0.f)
		{
			return;
		}

		const FIntVector CameraChunk(
			FMath::FloorToInt(CameraPos.X / ChunkWorldSize),
			FMath::FloorToInt(CameraPos.Y / ChunkWorldSize),
			0);

		if (bHasLastCamera && CameraChunk == LastCameraChunk)
		{
			return;
		}

		const float NearRadiusSq = NearRadius * NearRadius;
		const float FarRadiusSq = FarRadius * FarRadius;
		const int32 OuterRadiusInChunks = FMath::CeilToInt(FarRadius / ChunkWorldSize);
		const int32 ZSpan = FMath::Max(0, HeightMaxZ - HeightMinZ + 1);
		ScratchDesired.Reserve((2 * OuterRadiusInChunks + 1) * (2 * OuterRadiusInChunks + 1) * FMath::Max(1, ZSpan));

		for (int32 DX = -OuterRadiusInChunks; DX <= OuterRadiusInChunks; ++DX)
		{
			for (int32 DY = -OuterRadiusInChunks; DY <= OuterRadiusInChunks; ++DY)
			{
				const int32 CX = CameraChunk.X + DX;
				const int32 CY = CameraChunk.Y + DY;
				const float DX_W = (CX + 0.5f) * ChunkWorldSize - static_cast<float>(CameraPos.X);
				const float DY_W = (CY + 0.5f) * ChunkWorldSize - static_cast<float>(CameraPos.Y);
				const float DistSqXY = DX_W * DX_W + DY_W * DY_W;
				if (DistSqXY > FarRadiusSq)
				{
					continue;
				}
				const EHktTerrainChunkTier Tier = (DistSqXY <= NearRadiusSq)
					? EHktTerrainChunkTier::Near
					: EHktTerrainChunkTier::Far;
				for (int32 Z = HeightMinZ; Z <= HeightMaxZ; ++Z)
				{
					ScratchDesired.Add(FIntVector(CX, CY, Z), Tier);
				}
			}
		}

		for (const TPair<FIntVector, EHktTerrainChunkTier>& Pair : LoadedChunks)
		{
			if (!ScratchDesired.Contains(Pair.Key))
			{
				ChunksToUnload.Add(Pair.Key);
			}
		}

		TArray<FHktChunkTierRequest> LoadCandidates;
		LoadCandidates.Reserve(ScratchDesired.Num());
		for (const TPair<FIntVector, EHktTerrainChunkTier>& Pair : ScratchDesired)
		{
			const EHktTerrainChunkTier* ExistingTier = LoadedChunks.Find(Pair.Key);
			if (!ExistingTier)
			{
				LoadCandidates.Add({ Pair.Key, Pair.Value });
			}
			else if (*ExistingTier != Pair.Value)
			{
				ChunksToRetier.Add({ Pair.Key, Pair.Value });
			}
		}

		auto ByDistance = [&CameraPos, ChunkWorldSize](const FHktChunkTierRequest& A, const FHktChunkTierRequest& B)
		{
			return ChunkDistSq(A.Coord, CameraPos, ChunkWorldSize)
				 < ChunkDistSq(B.Coord, CameraPos, ChunkWorldSize);
		};
		LoadCandidates.Sort(ByDistance);
		ChunksToRetier.Sort(ByDistance);

		// 로드 버짓 — 메모리 한도 고려.
		const int32 MemRemaining = (MaxLoadedChunks > 0)
			? FMath::Max(0, MaxLoadedChunks - LoadedChunks.Num())
			: LoadCandidates.Num();
		const int32 LoadAllowed = FMath::Min(MaxLoadsPerFrame, MemRemaining);
		for (int32 i = 0; i < LoadAllowed && i < LoadCandidates.Num(); ++i)
		{
			ChunksToLoad.Add(LoadCandidates[i]);
		}

		// Retier는 로드 이후 남은 버짓에서 차감 — 메시 재생성은 로드와 동일 비용.
		const int32 RetierCandidatesTotal = ChunksToRetier.Num();
		const int32 RetierBudget = FMath::Max(0, MaxLoadsPerFrame - ChunksToLoad.Num());
		if (RetierCandidatesTotal > RetierBudget)
		{
			ChunksToRetier.SetNum(RetierBudget, EAllowShrinking::No);
		}

		for (const FIntVector& Coord : ChunksToUnload)
		{
			LoadedChunks.Remove(Coord);
		}
		for (const FHktChunkTierRequest& Req : ChunksToLoad)
		{
			LoadedChunks.Add(Req.Coord, Req.Tier);
		}
		for (const FHktChunkTierRequest& Req : ChunksToRetier)
		{
			LoadedChunks.Add(Req.Coord, Req.Tier);
		}

		// 모든 후보가 소진되었을 때만 stability — 버짓 잔여분은 다음 틱 재스캔으로 처리.
		const bool bFullyDrained =
			(ChunksToLoad.Num() == LoadCandidates.Num()) &&
			(ChunksToRetier.Num() == RetierCandidatesTotal);
		if (bFullyDrained)
		{
			LastCameraChunk = CameraChunk;
			bHasLastCamera = true;
		}
		else
		{
			bHasLastCamera = false;
		}
	}
}  // namespace

TUniquePtr<IHktTerrainChunkLoader> CreateTerrainChunkLoader(EHktTerrainLoaderType Type)
{
	switch (Type)
	{
		case EHktTerrainLoaderType::Legacy:
			return MakeUnique<FHktLegacyChunkLoader>();
		case EHktTerrainLoaderType::Proximity:
		default:
			return MakeUnique<FHktProximityChunkLoader>();
	}
}
