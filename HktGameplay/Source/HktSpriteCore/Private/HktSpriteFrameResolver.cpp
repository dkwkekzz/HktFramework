// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteFrameResolver.h"
#include "Math/UnrealMathUtility.h"

// ============================================================================
// HktResolveSpriteFrame
// ============================================================================

FHktSpriteFrameResolveResult HktResolveSpriteFrame(const FHktSpriteFrameResolveInput& In)
{
	FHktSpriteFrameResolveResult Out;

	if (!In.Action)
	{
		Out.bInvalid = true;
		return Out;
	}
	const FHktSpriteAction& A = *In.Action;

	// 방향 리졸브 (mirror 처리)
	bool bFlipX = false;
	const EHktSpriteFacing Stored = FHktSpriteAction::ResolveStoredFacing(
		In.Facing, A.NumDirections, A.bMirrorWestFromEast, bFlipX);
	Out.StoredFacing = Stored;
	Out.bFlipX = bFlipX;

	const int32 DirIdx = static_cast<int32>(Stored);
	if (DirIdx < 0 || DirIdx >= A.NumDirections)
	{
		Out.bInvalid = true;
		return Out;
	}

	const int32 N = A.GetNumFrames(DirIdx);
	if (N <= 0)
	{
		Out.bInvalid = true;
		return Out;
	}
	if (N == 1)
	{
		Out.FrameIndex = 0;
		Out.bFinished = !A.bLooping;
		return Out;
	}

	// 경과 시간 (ms) — PlayRate 반영 후 음수 방지
	const int64 ElapsedTicks = In.NowTick - In.AnimStartTick;
	const float SafeRate = In.PlayRate > 0.f ? In.PlayRate : 1.f;
	const double ElapsedMs = static_cast<double>(ElapsedTicks) * static_cast<double>(In.TickDurationMs) * SafeRate;
	const double SafeElapsed = FMath::Max(ElapsedMs, 0.0);

	// --- Per-frame duration이 제공되면 누적 비교 ---
	if (A.PerFrameDurationMs.Num() >= N)
	{
		// 액션 전체 길이 계산
		double Total = 0.0;
		for (int32 i = 0; i < N; ++i)
		{
			Total += FMath::Max(static_cast<double>(A.PerFrameDurationMs[i]), 1.0);
		}
		if (Total <= 0.0)
		{
			Out.FrameIndex = 0;
			return Out;
		}

		double T = SafeElapsed;
		if (A.bLooping)
		{
			T = FMath::Fmod(T, Total);
		}
		else if (T >= Total)
		{
			Out.FrameIndex = N - 1;
			Out.bFinished = true;
			return Out;
		}

		// 누적 비교로 현재 프레임 찾기
		double Acc = 0.0;
		for (int32 i = 0; i < N; ++i)
		{
			const double D = FMath::Max(static_cast<double>(A.PerFrameDurationMs[i]), 1.0);
			if (T < Acc + D)
			{
				Out.FrameIndex = i;
				Out.BlendAlpha = static_cast<float>((T - Acc) / D);
				return Out;
			}
			Acc += D;
		}
		// 수치 오차 폴백
		Out.FrameIndex = N - 1;
		if (!A.bLooping) Out.bFinished = true;
		return Out;
	}

	// --- 고정 duration 경로 ---
	const double Duration = FMath::Max(static_cast<double>(A.FrameDurationMs), 1.0);
	const double FrameF = SafeElapsed / Duration;

	if (A.bLooping)
	{
		const double Mod = FMath::Fmod(FrameF, static_cast<double>(N));
		const int32 Idx = static_cast<int32>(FMath::FloorToInt64(Mod));
		Out.FrameIndex = FMath::Clamp(Idx, 0, N - 1);
		Out.BlendAlpha = static_cast<float>(Mod - FMath::FloorToInt64(Mod));
	}
	else
	{
		if (FrameF >= static_cast<double>(N))
		{
			Out.FrameIndex = N - 1;
			Out.bFinished = true;
		}
		else
		{
			const int32 Idx = static_cast<int32>(FMath::FloorToInt64(FrameF));
			Out.FrameIndex = FMath::Clamp(Idx, 0, N - 1);
			Out.BlendAlpha = static_cast<float>(FrameF - FMath::FloorToInt64(FrameF));
			if (Out.FrameIndex == N - 1) Out.bFinished = false; // 마지막 프레임의 남은 시간 동안은 아직 재생 중
		}
	}
	return Out;
}

// ============================================================================
// HktFacingFromYaw — 월드 yaw + 카메라 yaw → 8방향
// 엔티티가 카메라 기준으로 어디를 바라보는지를 8방향으로 양자화.
// 스크린 기준 "아래" = S (플레이어 시점에서 앞)가 되도록 매핑.
// ============================================================================

EHktSpriteFacing HktFacingFromYaw(float EntityYawDegrees, float CameraYawDegrees)
{
	// 카메라 기준 상대 yaw (도)
	float Rel = EntityYawDegrees - CameraYawDegrees;
	Rel = FMath::UnwindDegrees(Rel);
	// UE yaw: +X=0도(동), 회전 반시계(+). 스크린 "남쪽(아래)" = 카메라 전방 → 0도로 정렬.
	// N(0), NE(1), E(2), SE(3), S(4), SW(5), W(6), NW(7) 매핑.
	// 0도를 S로 오프셋: S=0, SW=45, W=90, NW=135, N=180(-180), NE=-135, E=-90, SE=-45
	// 8개 섹터, 각 45도.
	float Shifted = Rel + 180.f; // [0, 360]
	if (Shifted < 0.f) Shifted += 360.f;
	if (Shifted >= 360.f) Shifted -= 360.f;

	// 0 = N, 45 = NE, 90 = E, 135 = SE, 180 = S, 225 = SW, 270 = W, 315 = NW
	const int32 Sector = static_cast<int32>(FMath::FloorToInt((Shifted + 22.5f) / 45.f)) % 8;
	return static_cast<EHktSpriteFacing>(Sector);
}
