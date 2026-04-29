// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "CoreMinimal.h"
#include "HAL/IConsoleManager.h"
#include "HAL/FileManager.h"
#include "Misc/Paths.h"
#include "Misc/FileHelper.h"
#include "Modules/ModuleManager.h"
#include "IImageWrapper.h"
#include "IImageWrapperModule.h"

#include "Settings/HktRuntimeGlobalSetting.h"
#include "HktTerrainGenerator.h"
#include "HktAdvTerrainTypes.h"

/*
 * hkt.terrain.preview [radiusChunks=16] [centerChunkX=0] [centerChunkY=0]
 *
 * 전체 맵을 빠르게 확인하기 위한 디버그 콘솔 명령.
 * 복셀 채우기(Layer 3~5)를 건너뛰고 Layer 0~2.5(기후/대륙/바이옴)만 실행해
 *   - 힐셰이드 + 바이옴 컬러 top-down PNG
 *   - 중심 Y 행의 XZ 단면 PNG
 * 두 장을 Saved/TerrainPreview/ 에 저장한다.
 *
 * 반경 N → 변 길이 (2N+1)*32 복셀 = (2N+1)*32 픽셀.
 */

namespace
{
	constexpr int32 ChunkSize = FHktTerrainGeneratorConfig::ChunkSize;

	// ── 바이옴 컬러 LUT — rnd-terrain-debug-viz.md §4.4 기반 ──
	FColor GetAdvBiomeColor(uint8 BiomeId)
	{
		switch (static_cast<EHktAdvBiome>(BiomeId))
		{
		// 현실 바이옴
		case EHktAdvBiome::Ocean:          return FColor(25, 65, 140);
		case EHktAdvBiome::Beach:          return FColor(230, 210, 160);
		case EHktAdvBiome::Grassland:      return FColor(130, 200, 90);
		case EHktAdvBiome::Forest:         return FColor(55, 130, 60);
		case EHktAdvBiome::Desert:         return FColor(220, 185, 120);
		case EHktAdvBiome::Savanna:        return FColor(200, 170, 80);
		case EHktAdvBiome::Tundra:         return FColor(160, 180, 190);
		case EHktAdvBiome::Taiga:          return FColor(95, 145, 135);
		case EHktAdvBiome::RockyMountain:  return FColor(130, 130, 135);
		case EHktAdvBiome::SnowPeak:       return FColor(240, 245, 250);
		case EHktAdvBiome::Swamp:          return FColor(100, 120, 60);
		// 이상 바이옴
		case EHktAdvBiome::CrystalForest:  return FColor(140, 255, 210);
		case EHktAdvBiome::FloatingMeadow: return FColor(255, 190, 220);
		case EHktAdvBiome::GlowMushroom:   return FColor(200, 255, 110);
		case EHktAdvBiome::BoneDesert:     return FColor(245, 230, 200);
		case EHktAdvBiome::VoidRift:       return FColor(180, 80, 240);
		case EHktAdvBiome::LivingForest:   return FColor(210, 200, 255);
		default:                           return FColor(128, 128, 128);
		}
	}

	// 레거시 EHktBiomeType (0~5). BiomeId는 샘플 구조체에서 +200 오프셋으로 저장.
	FColor GetLegacyBiomeColor(uint8 BiomeIdWithOffset)
	{
		const uint8 Raw = BiomeIdWithOffset >= 200 ? BiomeIdWithOffset - 200 : 0;
		static const FColor Palette[6] = {
			FColor(130, 200, 90),   // 0 Grassland
			FColor(220, 185, 120),  // 1 Desert
			FColor(160, 180, 190),  // 2 Tundra
			FColor(55, 130, 60),    // 3 Forest
			FColor(100, 120, 60),   // 4 Swamp
			FColor(130, 130, 135),  // 5 Mountain
		};
		return Palette[Raw < 6 ? Raw : 0];
	}

	FColor GetBiomeColor(const FHktTerrainPreviewSample& S)
	{
		return S.bIsAdvanced ? GetAdvBiomeColor(S.BiomeId) : GetLegacyBiomeColor(S.BiomeId);
	}

	// Lambertian 힐셰이드. 방위각 315°(NW) + 고도 45°.
	// dz/dx, dz/dy는 복셀 단위. ZScale로 수직 과장(작을수록 평평하게 보임).
	float ComputeHillshade(const FHktTerrainPreviewRegion& R, int32 X, int32 Y, float ZScale)
	{
		const int32 W = R.Width;
		const int32 H = R.Height;
		auto Z = [&](int32 XX, int32 YY) -> float
		{
			XX = FMath::Clamp(XX, 0, W - 1);
			YY = FMath::Clamp(YY, 0, H - 1);
			return static_cast<float>(R.Samples[XX + YY * W].SurfaceHeightVoxels);
		};

		const float ZL = Z(X - 1, Y);
		const float ZR = Z(X + 1, Y);
		const float ZU = Z(X, Y - 1);
		const float ZD = Z(X, Y + 1);

		const float Nx = -(ZR - ZL) * 0.5f * ZScale;
		const float Ny = -(ZD - ZU) * 0.5f * ZScale;
		const float Nz = 1.0f;
		const float InvLen = FMath::InvSqrt(Nx * Nx + Ny * Ny + Nz * Nz);

		// Light = normalize(-1, -1, 1.2) — 북서 상공
		constexpr float LBase = 1.0f / 1.9442f;  // 1/sqrt(1+1+1.44)
		const float Lx = -1.0f * LBase;
		const float Ly = -1.0f * LBase;
		const float Lz = 1.2f * LBase;

		const float NdotL = (Nx * Lx + Ny * Ly + Nz * Lz) * InvLen;
		const float Diffuse = FMath::Max(0.f, NdotL);
		return 0.35f + 0.65f * Diffuse;  // ambient 35% + diffuse 65%
	}

	FColor ApplyShade(FColor Base, float Shade)
	{
		const float S = FMath::Clamp(Shade, 0.f, 1.5f);
		return FColor(
			static_cast<uint8>(FMath::Min(255.f, Base.R * S)),
			static_cast<uint8>(FMath::Min(255.f, Base.G * S)),
			static_cast<uint8>(FMath::Min(255.f, Base.B * S)),
			255);
	}

	// 해양: 수심(water level - surface)에 따라 더 짙은 파랑.
	FColor MakeOceanColor(int32 SurfaceZ, int32 WaterLevel)
	{
		const int32 Depth = FMath::Max(0, WaterLevel - SurfaceZ);
		const float T = FMath::Clamp(Depth / 40.f, 0.f, 1.f);
		const FColor Shallow(70, 140, 200);
		const FColor Deep(10, 30, 85);
		return FColor(
			static_cast<uint8>(FMath::Lerp(Shallow.R, Deep.R, T)),
			static_cast<uint8>(FMath::Lerp(Shallow.G, Deep.G, T)),
			static_cast<uint8>(FMath::Lerp(Shallow.B, Deep.B, T)),
			255);
	}

	bool SavePng(const TArray<FColor>& Pixels, int32 Width, int32 Height, const FString& OutPath)
	{
		if (Pixels.Num() != Width * Height)
		{
			return false;
		}

		IImageWrapperModule& Module = FModuleManager::LoadModuleChecked<IImageWrapperModule>(FName("ImageWrapper"));
		TSharedPtr<IImageWrapper> Wrapper = Module.CreateImageWrapper(EImageFormat::PNG);
		if (!Wrapper.IsValid())
		{
			return false;
		}

		if (!Wrapper->SetRaw(Pixels.GetData(), Pixels.Num() * sizeof(FColor),
			Width, Height, ERGBFormat::BGRA, 8))
		{
			return false;
		}

		const TArray64<uint8>& Compressed = Wrapper->GetCompressed(100);
		return FFileHelper::SaveArrayToFile(Compressed, *OutPath);
	}

	// 힐셰이드+바이옴 컬러 + 해양 오버레이 → BGRA 픽셀 배열
	void RenderTopDown(const FHktTerrainPreviewRegion& R, TArray<FColor>& OutPixels, float ZScale)
	{
		OutPixels.SetNumUninitialized(R.Width * R.Height);

		for (int32 Y = 0; Y < R.Height; ++Y)
		{
			for (int32 X = 0; X < R.Width; ++X)
			{
				const FHktTerrainPreviewSample& S = R.Samples[X + Y * R.Width];

				FColor Out;
				if (S.bIsOcean && S.SurfaceHeightVoxels < R.WaterLevel)
				{
					// 수면 — 힐셰이드 없이 수심으로 어둡게
					Out = MakeOceanColor(S.SurfaceHeightVoxels, R.WaterLevel);
				}
				else
				{
					const FColor Biome = GetBiomeColor(S);
					const float Shade = ComputeHillshade(R, X, Y, ZScale);
					Out = ApplyShade(Biome, Shade);
				}

				// BGRA 순서로 저장 (FColor는 이미 BGRA 레이아웃)
				OutPixels[X + Y * R.Width] = Out;
			}
		}
	}

	// 중심 Y 행의 XZ 단면. 높이 = (HeightMaxZ - HeightMinZ + 1) * 32 픽셀, 상단이 z-최대.
	void RenderCrossSection(const FHktTerrainPreviewRegion& R, TArray<FColor>& OutPixels,
		int32& OutWidth, int32& OutHeight)
	{
		const int32 ZMin = R.HeightMinZ * ChunkSize;
		const int32 ZMax = (R.HeightMaxZ + 1) * ChunkSize - 1;
		const int32 ZRange = ZMax - ZMin + 1;

		OutWidth = R.Width;
		OutHeight = ZRange;
		OutPixels.SetNumUninitialized(OutWidth * OutHeight);

		const int32 MidY = R.Height / 2;

		for (int32 PZ = 0; PZ < ZRange; ++PZ)
		{
			// 이미지 Y=0이 화면 상단 → 월드 Z = ZMax 부터 내려감
			const int32 WorldZ = ZMax - PZ;

			for (int32 X = 0; X < R.Width; ++X)
			{
				const FHktTerrainPreviewSample& S = R.Samples[X + MidY * R.Width];
				const int32 SurfaceZ = S.SurfaceHeightVoxels;

				FColor Pixel;
				if (WorldZ > SurfaceZ)
				{
					if (WorldZ <= R.WaterLevel)
					{
						// 수면 열
						Pixel = MakeOceanColor(WorldZ, R.WaterLevel + 5);
					}
					else
					{
						// 공기 — 하늘 그라디언트 (고도 높을수록 밝음)
						const float T = FMath::Clamp(static_cast<float>(WorldZ - R.WaterLevel) /
							FMath::Max(1, ZMax - R.WaterLevel), 0.f, 1.f);
						const uint8 V = static_cast<uint8>(FMath::Lerp(180.f, 235.f, T));
						Pixel = FColor(V, V, V + 10 > 255 ? 255 : V + 10, 255);
					}
				}
				else
				{
					const int32 Depth = SurfaceZ - WorldZ;
					const FColor SurfaceColor = GetBiomeColor(S);

					if (WorldZ <= 2)
					{
						Pixel = FColor(40, 40, 45, 255);            // bedrock
					}
					else if (Depth >= 4)
					{
						Pixel = FColor(95, 95, 100, 255);            // deep / stone
					}
					else if (Depth >= 1)
					{
						// subsurface — 바이옴 컬러 × 0.6
						Pixel = FColor(
							static_cast<uint8>(SurfaceColor.R * 0.6f),
							static_cast<uint8>(SurfaceColor.G * 0.6f),
							static_cast<uint8>(SurfaceColor.B * 0.6f),
							255);
					}
					else
					{
						Pixel = SurfaceColor;                        // 표면
					}
				}

				OutPixels[X + PZ * OutWidth] = Pixel;
			}
		}
	}

	void ExecutePreview(const TArray<FString>& Args)
	{
		int32 RadiusChunks = 16;
		int32 CenterChunkX = 0;
		int32 CenterChunkY = 0;
		if (Args.Num() >= 1) RadiusChunks = FMath::Clamp(FCString::Atoi(*Args[0]), 1, 96);
		if (Args.Num() >= 2) CenterChunkX = FCString::Atoi(*Args[1]);
		if (Args.Num() >= 3) CenterChunkY = FCString::Atoi(*Args[2]);

		const UHktRuntimeGlobalSetting* Settings = GetDefault<UHktRuntimeGlobalSetting>();
		if (!Settings)
		{
			UE_LOG(LogConsoleResponse, Error, TEXT("[TerrainPreview] UHktRuntimeGlobalSetting 없음"));
			return;
		}

		const FHktTerrainGeneratorConfig Config = Settings->ToTerrainConfig();
		FHktTerrainGenerator Generator(Config);

		const int32 SideChunks = 2 * RadiusChunks + 1;
		const int32 Side = SideChunks * ChunkSize;
		const int32 MinChunkX = CenterChunkX - RadiusChunks;
		const int32 MinChunkY = CenterChunkY - RadiusChunks;
		const int32 MinWorldX = MinChunkX * ChunkSize;
		const int32 MinWorldY = MinChunkY * ChunkSize;

		UE_LOG(LogConsoleResponse, Display,
			TEXT("[TerrainPreview] %s mode, seed=%lld, %d×%d chunks (%d×%d px), center=(%d,%d)"),
			Config.bAdvancedTerrain ? TEXT("ADVANCED") : TEXT("LEGACY"),
			Config.Seed, SideChunks, SideChunks, Side, Side, CenterChunkX, CenterChunkY);

		const double StartTime = FPlatformTime::Seconds();

		FHktTerrainPreviewRegion Region;
		Generator.SamplePreviewRegion(MinWorldX, MinWorldY, Side, Side, Region);

		const double SampleTime = FPlatformTime::Seconds() - StartTime;

		TArray<FColor> TopPixels;
		RenderTopDown(Region, TopPixels, 0.3f);

		TArray<FColor> CrossPixels;
		int32 CrossW = 0, CrossH = 0;
		RenderCrossSection(Region, CrossPixels, CrossW, CrossH);

		// 파일 저장
		const FString OutDir = FPaths::ProjectSavedDir() / TEXT("TerrainPreview");
		IFileManager::Get().MakeDirectory(*OutDir, true);
		const FString TimeStamp = FDateTime::Now().ToString(TEXT("%Y%m%d_%H%M%S"));
		const FString Suffix = FString::Printf(TEXT("seed%lld_r%d_%s"),
			Config.Seed, RadiusChunks, *TimeStamp);

		const FString TopPath = OutDir / FString::Printf(TEXT("topdown_%s.png"), *Suffix);
		const FString CrossPath = OutDir / FString::Printf(TEXT("crosssection_%s.png"), *Suffix);

		const bool bTopOk = SavePng(TopPixels, Side, Side, TopPath);
		const bool bCrossOk = SavePng(CrossPixels, CrossW, CrossH, CrossPath);

		const double TotalTime = FPlatformTime::Seconds() - StartTime;
		UE_LOG(LogConsoleResponse, Display,
			TEXT("[TerrainPreview] sample=%.2fs, total=%.2fs"), SampleTime, TotalTime);

		if (bTopOk)  { UE_LOG(LogConsoleResponse, Display, TEXT("[TerrainPreview] saved %s"), *TopPath); }
		else         { UE_LOG(LogConsoleResponse, Error,   TEXT("[TerrainPreview] FAILED %s"), *TopPath); }
		if (bCrossOk){ UE_LOG(LogConsoleResponse, Display, TEXT("[TerrainPreview] saved %s"), *CrossPath); }
		else         { UE_LOG(LogConsoleResponse, Error,   TEXT("[TerrainPreview] FAILED %s"), *CrossPath); }
	}

	FAutoConsoleCommand CmdTerrainPreview(
		TEXT("hkt.terrain.preview"),
		TEXT("Advanced terrain의 top-down hillshade + XZ cross-section PNG를 Saved/TerrainPreview/에 덤프.\n"
			 "Usage: hkt.terrain.preview [radiusChunks=16] [centerChunkX=0] [centerChunkY=0]"),
		FConsoleCommandWithArgsDelegate::CreateStatic(&ExecutePreview));
}
