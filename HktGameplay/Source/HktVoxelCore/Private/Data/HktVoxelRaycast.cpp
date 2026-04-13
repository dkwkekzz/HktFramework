// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Data/HktVoxelRaycast.h"
#include "Data/HktVoxelRenderCache.h"
#include "Data/HktVoxelTypes.h"

// ============================================================================
// 좌표 변환 헬퍼 (FHktTerrainState와 동일한 로직)
// ============================================================================

int32 FHktVoxelRaycast::FloorDiv(int32 A, int32 B)
{
	return (A >= 0) ? (A / B) : ((A - B + 1) / B);
}

int32 FHktVoxelRaycast::FloorMod(int32 A, int32 B)
{
	int32 Mod = A % B;
	return (Mod < 0) ? (Mod + B) : Mod;
}

// ============================================================================
// Amanatides & Woo DDA 복셀 레이캐스트
// ============================================================================

FHktVoxelRaycastResult FHktVoxelRaycast::Trace(
	const FHktVoxelRenderCache& Cache,
	const FVector& RayOrigin,
	const FVector& RayDir,
	float VoxelSize,
	float MaxDistance)
{
	FHktVoxelRaycastResult Result;

	if (VoxelSize <= 0.f || RayDir.IsNearlyZero())
	{
		return Result;
	}

	// 기본 최대 거리: 2청크 분량
	if (MaxDistance <= 0.f)
	{
		MaxDistance = 2.f * FHktVoxelChunk::SIZE * VoxelSize;
	}

	const float InvVoxelSize = 1.f / VoxelSize;

	// 월드 좌표 → 복셀 좌표 (부동소수)
	const FVector VoxelPosF(
		RayOrigin.X * InvVoxelSize,
		RayOrigin.Y * InvVoxelSize,
		RayOrigin.Z * InvVoxelSize);

	// 현재 복셀 정수 좌표
	int32 VoxelX = FMath::FloorToInt(VoxelPosF.X);
	int32 VoxelY = FMath::FloorToInt(VoxelPosF.Y);
	int32 VoxelZ = FMath::FloorToInt(VoxelPosF.Z);

	// 축별 스텝 방향
	const int32 StepX = (RayDir.X >= 0.f) ? 1 : -1;
	const int32 StepY = (RayDir.Y >= 0.f) ? 1 : -1;
	const int32 StepZ = (RayDir.Z >= 0.f) ? 1 : -1;

	// tDelta: 복셀 1칸 이동에 필요한 ray 파라미터 t 증분
	const double tDeltaX = (FMath::Abs(RayDir.X) > SMALL_NUMBER)
		? FMath::Abs(VoxelSize / RayDir.X)
		: MAX_dbl;
	const double tDeltaY = (FMath::Abs(RayDir.Y) > SMALL_NUMBER)
		? FMath::Abs(VoxelSize / RayDir.Y)
		: MAX_dbl;
	const double tDeltaZ = (FMath::Abs(RayDir.Z) > SMALL_NUMBER)
		? FMath::Abs(VoxelSize / RayDir.Z)
		: MAX_dbl;

	// tMax: 다음 복셀 경계까지의 ray 파라미터 t
	// StepX == 1이면 다음 경계는 (VoxelX+1)*VoxelSize, StepX == -1이면 VoxelX*VoxelSize
	double tMaxX, tMaxY, tMaxZ;

	if (FMath::Abs(RayDir.X) > SMALL_NUMBER)
	{
		const double NextBoundary = (StepX > 0)
			? (VoxelX + 1) * (double)VoxelSize
			: VoxelX * (double)VoxelSize;
		tMaxX = (NextBoundary - RayOrigin.X) / RayDir.X;
	}
	else
	{
		tMaxX = MAX_dbl;
	}

	if (FMath::Abs(RayDir.Y) > SMALL_NUMBER)
	{
		const double NextBoundary = (StepY > 0)
			? (VoxelY + 1) * (double)VoxelSize
			: VoxelY * (double)VoxelSize;
		tMaxY = (NextBoundary - RayOrigin.Y) / RayDir.Y;
	}
	else
	{
		tMaxY = MAX_dbl;
	}

	if (FMath::Abs(RayDir.Z) > SMALL_NUMBER)
	{
		const double NextBoundary = (StepZ > 0)
			? (VoxelZ + 1) * (double)VoxelSize
			: VoxelZ * (double)VoxelSize;
		tMaxZ = (NextBoundary - RayOrigin.Z) / RayDir.Z;
	}
	else
	{
		tMaxZ = MAX_dbl;
	}

	// 마지막으로 전진한 축의 법선 (히트 시 진입 면 계산용)
	FVector LastStepNormal = FVector::ZeroVector;
	double CurrentT = 0.0;

	// 최대 순회 스텝 수 (안전 제한)
	constexpr int32 MaxSteps = 256;

	for (int32 Step = 0; Step < MaxSteps; ++Step)
	{
		// 최대 거리 초과 확인
		if (CurrentT > MaxDistance)
		{
			break;
		}

		// 현재 복셀이 속한 청크 좌표 + 로컬 좌표 계산
		const FIntVector ChunkCoord(
			FloorDiv(VoxelX, FHktVoxelChunk::SIZE),
			FloorDiv(VoxelY, FHktVoxelChunk::SIZE),
			FloorDiv(VoxelZ, FHktVoxelChunk::SIZE));

		const int32 LocalX = FloorMod(VoxelX, FHktVoxelChunk::SIZE);
		const int32 LocalY = FloorMod(VoxelY, FHktVoxelChunk::SIZE);
		const int32 LocalZ = FloorMod(VoxelZ, FHktVoxelChunk::SIZE);

		// 청크 데이터 조회
		const FHktVoxelChunk* Chunk = Cache.GetChunk(ChunkCoord);
		if (Chunk)
		{
			const FHktVoxel& Voxel = Chunk->At(LocalX, LocalY, LocalZ);
			if (!Voxel.IsEmpty())
			{
				// 히트! 결과 채우기
				Result.bHit = true;
				Result.VoxelCoord = FIntVector(VoxelX, VoxelY, VoxelZ);
				Result.ChunkCoord = ChunkCoord;
				Result.HitTypeID = Voxel.TypeID;
				Result.HitNormal = LastStepNormal;
				Result.Distance = static_cast<float>(FMath::Max(CurrentT, 0.0));

				// 히트 위치: ray 위의 진입점
				Result.HitLocation = RayOrigin + RayDir * Result.Distance;

				return Result;
			}
		}
		// 미로드 청크는 빈 공간으로 통과

		// 다음 복셀로 전진 (tMax가 가장 작은 축)
		if (tMaxX < tMaxY)
		{
			if (tMaxX < tMaxZ)
			{
				CurrentT = tMaxX;
				VoxelX += StepX;
				tMaxX += tDeltaX;
				LastStepNormal = FVector(static_cast<float>(-StepX), 0.f, 0.f);
			}
			else
			{
				CurrentT = tMaxZ;
				VoxelZ += StepZ;
				tMaxZ += tDeltaZ;
				LastStepNormal = FVector(0.f, 0.f, static_cast<float>(-StepZ));
			}
		}
		else
		{
			if (tMaxY < tMaxZ)
			{
				CurrentT = tMaxY;
				VoxelY += StepY;
				tMaxY += tDeltaY;
				LastStepNormal = FVector(0.f, static_cast<float>(-StepY), 0.f);
			}
			else
			{
				CurrentT = tMaxZ;
				VoxelZ += StepZ;
				tMaxZ += tDeltaZ;
				LastStepNormal = FVector(0.f, 0.f, static_cast<float>(-StepZ));
			}
		}
	}

	return Result;
}
