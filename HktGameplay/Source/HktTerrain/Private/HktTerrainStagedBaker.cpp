// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktTerrainStagedBaker.h"
#include "HktTerrainNoiseFloat.h"   // float 노이즈 + HktTerrainHash::SplitMix64 (HktTerrain Private)
#include "HktAdvTerrainTypes.h"     // EHktAdvBiome
#include "HktTerrainLog.h"

// ============================================================================
// 내부 헬퍼
// ============================================================================

namespace
{
	FORCEINLINE float Saturate(float V) { return FMath::Clamp(V, 0.f, 1.f); }

	/**
	 * 리지드 멀티프랙탈 — 뾰족한 능선(산맥)에 적합. 출력 ~[0,1].
	 * FHktTerrainNoiseFloat 에 ridged 가 없으므로 Noise2D 옥타브를 직접 누적한다.
	 */
	float Ridged(const FHktTerrainNoiseFloat& N, float X, float Y,
	             int32 Octaves, float Lacunarity, float Persistence)
	{
		float Sum = 0.f;
		float Amp = 0.5f;
		float Freq = 1.f;
		float Weight = 1.f;
		for (int32 i = 0; i < Octaves; ++i)
		{
			// Noise2D ~[-0.5,0.5] → |·|*2 ~[0,1] 의 보수 → 능선
			float Signal = 1.f - FMath::Abs(N.Noise2D(X * Freq, Y * Freq) * 2.f);
			Signal *= Signal;          // 능선을 더 날카롭게
			Signal *= Weight;          // 이전 옥타브가 높은 곳만 디테일 부여
			Weight = Saturate(Signal * 2.f);
			Sum += Signal * Amp;
			Freq *= Lacunarity;
			Amp *= Persistence;
		}
		return Saturate(Sum);
	}

	// ── Stage 4 물방울 침식 보조 ────────────────────────────────────────

	struct FHeightGrad
	{
		float Height = 0.f;
		float GradX = 0.f;
		float GradY = 0.f;
	};

	/** 그리드에서 (PosX,PosY) 의 bilinear 고도 + 경사. nodeX/Y 는 [0,W-2]/[0,H-2] 로 클램프. */
	FHeightGrad CalcHeightAndGradient(const TArray<float>& Map, int32 W, int32 H, float PosX, float PosY)
	{
		int32 NodeX = FMath::Clamp(FMath::FloorToInt(PosX), 0, W - 2);
		int32 NodeY = FMath::Clamp(FMath::FloorToInt(PosY), 0, H - 2);
		const float Fx = PosX - static_cast<float>(NodeX);
		const float Fy = PosY - static_cast<float>(NodeY);

		const int32 I = NodeX + NodeY * W;
		const float HNW = Map[I];
		const float HNE = Map[I + 1];
		const float HSW = Map[I + W];
		const float HSE = Map[I + W + 1];

		FHeightGrad Out;
		Out.GradX = (HNE - HNW) * (1.f - Fy) + (HSE - HSW) * Fy;
		Out.GradY = (HSW - HNW) * (1.f - Fx) + (HSE - HNE) * Fx;
		Out.Height = HNW * (1.f - Fx) * (1.f - Fy)
		           + HNE * Fx * (1.f - Fy)
		           + HSW * (1.f - Fx) * Fy
		           + HSE * Fx * Fy;
		return Out;
	}
}

// ============================================================================
// FHktTerrainStagedBaker
// ============================================================================

FHktTerrainStagedBaker::FHktTerrainStagedBaker(const FHktTerrainThemeSpec& InTheme)
	: Theme(InTheme)
{
}

void FHktTerrainStagedBaker::BakeRegion(int32 OriginX, int32 OriginY, int32 W, int32 H, FHktTerrainBakeField& Out) const
{
	if (W <= 1 || H <= 1)
	{
		UE_LOG(LogHktTerrain, Warning, TEXT("[StagedBaker] 영역이 너무 작음 (%dx%d)"), W, H);
		Out = FHktTerrainBakeField{};
		return;
	}

	const int32 Count = W * H;
	Out.Width = W;
	Out.Height = H;
	Out.SeaLevel01 = Theme.SeaLevel;
	Out.Elevation.SetNumUninitialized(Count);
	Out.BiomeId.SetNumUninitialized(Count);

	// 기후 필드는 바이옴(Stage 5)이 재사용하므로 임시 버퍼에 보관.
	TArray<float> Temperature;
	TArray<float> Moisture;
	Temperature.SetNumUninitialized(Count);
	Moisture.SetNumUninitialized(Count);

	// 서브시드 파생 — 각 step 이 독립 노이즈를 갖도록.
	using HktTerrainHash::SplitMix64;
	const uint64 S = static_cast<uint64>(Theme.Seed);
	const FHktTerrainNoiseFloat ContinentNoise(SplitMix64(S ^ 0xC0FFEEULL));
	const FHktTerrainNoiseFloat ContinentWarp (SplitMix64(S ^ 0x5EED01ULL));
	const FHktTerrainNoiseFloat MountainNoise (SplitMix64(S ^ 0x317A11ULL));
	const FHktTerrainNoiseFloat DetailNoise   (SplitMix64(S ^ 0xDE7A11ULL));
	const FHktTerrainNoiseFloat TempNoise     (SplitMix64(S ^ 0x7E7177ULL));
	const FHktTerrainNoiseFloat MoistNoise    (SplitMix64(S ^ 0x701577ULL));

	const float ContinentFreq = 1.f / FMath::Max(Theme.ContinentWavelength, 64.f);
	const float MountainFreq  = 1.f / FMath::Max(Theme.MountainWavelength, 32.f);
	const float TempFreq      = ContinentFreq * 0.7f;   // 기후는 대륙보다 더 완만
	const float MoistFreq     = ContinentFreq * 1.3f;
	const float DetailFreq    = MountainFreq * 4.f;
	const float WarpStrength  = Theme.ContinentWavelength * 0.12f;

	const float Sea = Theme.SeaLevel;
	const float HeadRoom = 1.f - Sea;          // 해수면 위 가용 고도
	const float CoastT = 0.5f;                 // continent01 의 해안선 임계값
	const float PlainsBand = HeadRoom * 0.45f;
	const float MountainBand = HeadRoom * 0.85f;
	const float DetailBand = HeadRoom * 0.10f;

	// ── Stage 1~3: 기후 → 골격 → 베이스 하이트필드 ─────────────────────
	for (int32 Y = 0; Y < H; ++Y)
	{
		for (int32 X = 0; X < W; ++X)
		{
			const int32 Idx = X + Y * W;
			const float Wx = static_cast<float>(OriginX + X);
			const float Wy = static_cast<float>(OriginY + Y);

			// Stage 2(부분): 대륙 마스크 — 도메인 워프로 유기적 해안선.
			float Cwx = Wx;
			float Cwy = Wy;
			ContinentWarp.DomainWarp2D(Cwx, Cwy, WarpStrength);
			const float Cont = ContinentNoise.FBm2D(Cwx * ContinentFreq, Cwy * ContinentFreq, 4) * 1.3f;
			const float Continent01 = Saturate(0.5f + Cont + (Theme.Continentality - 0.5f));

			// Stage 1: 기후 — 온도/습도 저주파 필드.
			const float TNoise = TempNoise.FBm2D(Wx * TempFreq, Wy * TempFreq, 3);
			float Temp01 = Saturate(0.5f + TNoise - (Theme.Coldness - 0.5f));
			const float MNoise = MoistNoise.FBm2D(Wx * MoistFreq, Wy * MoistFreq, 3);
			const float Moist01 = Saturate(0.5f + MNoise + (Theme.Precipitation - 0.5f));

			// Stage 2: 산맥 능선장 — 내륙일수록 강하게.
			const float Ridge = Ridged(MountainNoise, Wx * MountainFreq, Wy * MountainFreq, 5, 2.f, 0.5f);
			const float Inland = Saturate((Continent01 - (CoastT + 0.05f)) / 0.35f);
			const float MountainField = Ridge * Inland * Theme.Mountainousness;

			// Stage 3: 베이스 하이트필드 — 해안선(Sea)에서 연속.
			float Elev01;
			if (Continent01 < CoastT)
			{
				// 해저: 해안에서 멀수록 깊게.
				const float Depth01 = Saturate((CoastT - Continent01) / CoastT);
				Elev01 = Sea * (1.f - 0.7f * Depth01);
			}
			else
			{
				const float LandT = Saturate((Continent01 - CoastT) / (1.f - CoastT));
				const float Plains = Sea + LandT * PlainsBand;
				const float Mtn = MountainField * MountainBand;
				const float Detail = DetailNoise.FBm2D(Wx * DetailFreq, Wy * DetailFreq, 5) * DetailBand * LandT;
				Elev01 = Plains + Mtn + Detail;
			}

			// 고도는 산맥 위에서도 식어야 자연스럽다 — 고지대 한랭 보정.
			Temp01 = Saturate(Temp01 - FMath::Max(0.f, Elev01 - Sea) * 0.6f);

			Out.Elevation[Idx] = Saturate(Elev01);
			Temperature[Idx] = Temp01;
			Moisture[Idx] = Moist01;
		}
	}

	// ── Stage 4: 침식/하천 — 물방울 침식으로 계곡 카빙 ─────────────────
	if (Theme.ErosionStrength > KINDA_SMALL_NUMBER)
	{
		// 침식 파라미터 (Sebastian Lague 류 물방울 모델, 4-셀 bilinear).
		const float Inertia = 0.05f;
		const float CapacityFactor = 4.f;
		const float MinCapacity = 0.01f;
		const float ErodeSpeed = 0.3f * Theme.ErosionStrength;
		const float DepositSpeed = 0.3f;
		const float EvaporateSpeed = 0.012f;
		const float Gravity = 4.f;
		const int32 MaxLifetime = 32;

		// 물방울 수: 면적 비례 × 강도. bake-time 비용 허용(D1).
		const int32 NumDroplets = FMath::RoundToInt(Count * 0.6f * Theme.ErosionStrength);

		uint64 Rng = SplitMix64(S ^ 0xE2051034ULL);
		auto NextFloat = [&Rng]() -> float
		{
			Rng = SplitMix64(Rng);
			return static_cast<float>(Rng & 0xFFFFFFULL) / 16777215.f;
		};

		TArray<float>& Map = Out.Elevation;
		for (int32 D = 0; D < NumDroplets; ++D)
		{
			float PosX = NextFloat() * static_cast<float>(W - 1);
			float PosY = NextFloat() * static_cast<float>(H - 1);
			float DirX = 0.f;
			float DirY = 0.f;
			float Speed = 1.f;
			float Water = 1.f;
			float Sediment = 0.f;

			for (int32 Life = 0; Life < MaxLifetime; ++Life)
			{
				const int32 NodeX = FMath::Clamp(FMath::FloorToInt(PosX), 0, W - 2);
				const int32 NodeY = FMath::Clamp(FMath::FloorToInt(PosY), 0, H - 2);
				const float CellX = PosX - static_cast<float>(NodeX);
				const float CellY = PosY - static_cast<float>(NodeY);
				const int32 DropIdx = NodeX + NodeY * W;

				const FHeightGrad HG = CalcHeightAndGradient(Map, W, H, PosX, PosY);

				// 방향 갱신 (관성 혼합) + 정규화.
				DirX = DirX * Inertia - HG.GradX * (1.f - Inertia);
				DirY = DirY * Inertia - HG.GradY * (1.f - Inertia);
				const float Len = FMath::Sqrt(DirX * DirX + DirY * DirY);
				if (Len > KINDA_SMALL_NUMBER)
				{
					DirX /= Len;
					DirY /= Len;
				}
				PosX += DirX;
				PosY += DirY;

				// 정지 또는 맵 이탈 → 종료.
				if ((FMath::IsNearlyZero(DirX) && FMath::IsNearlyZero(DirY)) ||
				    PosX < 0.f || PosX >= static_cast<float>(W - 1) ||
				    PosY < 0.f || PosY >= static_cast<float>(H - 1))
				{
					break;
				}

				const float NewHeight = CalcHeightAndGradient(Map, W, H, PosX, PosY).Height;
				const float DeltaHeight = NewHeight - HG.Height;

				const float Capacity = FMath::Max(-DeltaHeight * Speed * Water * CapacityFactor, MinCapacity);

				if (Sediment > Capacity || DeltaHeight > 0.f)
				{
					// 퇴적 — 오르막이면 가진 만큼, 아니면 초과분의 일부.
					const float Deposit = (DeltaHeight > 0.f)
						? FMath::Min(DeltaHeight, Sediment)
						: (Sediment - Capacity) * DepositSpeed;
					Sediment -= Deposit;
					Map[DropIdx]         += Deposit * (1.f - CellX) * (1.f - CellY);
					Map[DropIdx + 1]     += Deposit * CellX * (1.f - CellY);
					Map[DropIdx + W]     += Deposit * (1.f - CellX) * CellY;
					Map[DropIdx + W + 1] += Deposit * CellX * CellY;
				}
				else
				{
					// 침식 — 용량 여유와 내리막 폭 중 작은 만큼.
					const float Erode = FMath::Min((Capacity - Sediment) * ErodeSpeed, -DeltaHeight);
					Map[DropIdx]         -= Erode * (1.f - CellX) * (1.f - CellY);
					Map[DropIdx + 1]     -= Erode * CellX * (1.f - CellY);
					Map[DropIdx + W]     -= Erode * (1.f - CellX) * CellY;
					Map[DropIdx + W + 1] -= Erode * CellX * CellY;
					Sediment += Erode;
				}

				Speed = FMath::Sqrt(FMath::Max(0.f, Speed * Speed + DeltaHeight * Gravity));
				Water *= (1.f - EvaporateSpeed);
			}
		}

		// 침식이 [0,1] 밖으로 밀어낸 값 정리.
		for (int32 i = 0; i < Count; ++i)
		{
			Out.Elevation[i] = Saturate(Out.Elevation[i]);
		}
	}

	// ── Stage 5: 바이옴 페인터 — 기후 + 고도 + 경사 → 바이옴 ID ────────
	const float BeachBand = HeadRoom * 0.03f;
	const float MountainStart = Sea + HeadRoom * 0.55f;
	const float SlopeRockThreshold = 0.045f;   // 정규화 고도/버텍스 — 가파른 면은 암반.

	for (int32 Y = 0; Y < H; ++Y)
	{
		for (int32 X = 0; X < W; ++X)
		{
			const int32 Idx = X + Y * W;
			const float E = Out.Elevation[Idx];

			EHktAdvBiome Biome;
			if (E <= Sea)
			{
				Biome = EHktAdvBiome::Ocean;
			}
			else if (E <= Sea + BeachBand)
			{
				Biome = EHktAdvBiome::Beach;
			}
			else
			{
				// 경사 (중앙차분, 경계는 한쪽차분).
				const int32 XL = FMath::Max(X - 1, 0);
				const int32 XR = FMath::Min(X + 1, W - 1);
				const int32 YD = FMath::Max(Y - 1, 0);
				const int32 YU = FMath::Min(Y + 1, H - 1);
				const float Dx = (Out.Elevation[XR + Y * W] - Out.Elevation[XL + Y * W]) * 0.5f;
				const float Dy = (Out.Elevation[X + YU * W] - Out.Elevation[X + YD * W]) * 0.5f;
				const float Slope = FMath::Sqrt(Dx * Dx + Dy * Dy);

				const float T = Temperature[Idx];
				const float M = Moisture[Idx];

				if (E > MountainStart)
				{
					const float HighT = (E - MountainStart) / FMath::Max(1.f - MountainStart, KINDA_SMALL_NUMBER);
					Biome = (T < 0.3f || HighT > 0.65f) ? EHktAdvBiome::SnowPeak : EHktAdvBiome::RockyMountain;
				}
				else if (Slope > SlopeRockThreshold)
				{
					Biome = EHktAdvBiome::RockyMountain;
				}
				else if (T < 0.3f)
				{
					Biome = (M < 0.4f) ? EHktAdvBiome::Tundra : EHktAdvBiome::Taiga;
				}
				else if (T < 0.6f)
				{
					Biome = (M < 0.33f) ? EHktAdvBiome::Grassland
					      : (M < 0.66f) ? EHktAdvBiome::Forest : EHktAdvBiome::Swamp;
				}
				else
				{
					Biome = (M < 0.33f) ? EHktAdvBiome::Desert
					      : (M < 0.66f) ? EHktAdvBiome::Savanna : EHktAdvBiome::Forest;
				}
			}

			Out.BiomeId[Idx] = static_cast<uint8>(Biome);
		}
	}
}
