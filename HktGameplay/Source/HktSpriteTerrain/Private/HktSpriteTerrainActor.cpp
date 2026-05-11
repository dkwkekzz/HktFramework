// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteTerrainActor.h"
#include "HktSpriteTerrainLog.h"
#include "HktAdvTerrainTypes.h"
#include "HktTerrainSubsystem.h"
#include "Terrain/HktTerrainGeneratorConfig.h"
#include "Components/HierarchicalInstancedStaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/Texture2D.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/Pawn.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "TextureResource.h"

namespace
{
	constexpr int32 kNumCustomDataFloats = 16;
	constexpr int32 kChunkSize = FHktTerrainGeneratorConfig::ChunkSize;
	constexpr int32 kVoxelsPerChunk = kChunkSize * kChunkSize * kChunkSize;

	FORCEINLINE int32 VoxelIndex(int32 X, int32 Y, int32 Z)
	{
		// FHktTerrainGenerator 와 동일 인덱싱 — Z-major (X + SIZE*Y + SIZE^2*Z).
		return X + kChunkSize * (Y + kChunkSize * Z);
	}

	// ------------------------------------------------------------------------
	// 폴백 컬러 테이블 — HktAdvTerrainType ID(0..32) 별 의미 있는 색.
	// Sprite art 가 다 준비되기 전, AtlasTexture 미할당 시 voxel 을 색깔 블록으로
	// 시각화하기 위한 dev fallback. 값은 sRGB FColor(R,G,B,A).
	// ------------------------------------------------------------------------
	static const FColor& GetFallbackTypeColor(uint16 TypeID)
	{
		// HktAdvTerrainType:: ID 매핑 (33 종).
		static const FColor Table[HktAdvTerrainType::TypeCount] = {
			FColor(  0,   0,   0,   0),  // 0  Air            (투명 — Air 는 emit 안 됨, defensive)
			FColor( 80, 170,  60, 255),  // 1  Grass          진초록
			FColor(115,  75,  45, 255),  // 2  Dirt           흙갈색
			FColor(125, 125, 130, 255),  // 3  Stone          중간 회색
			FColor(225, 200, 135, 255),  // 4  Sand           모래 황갈
			FColor( 45,  95, 185, 255),  // 5  Water          파랑
			FColor(240, 240, 245, 255),  // 6  Snow           눈 백색
			FColor(170, 220, 240, 255),  // 7  Ice            얼음 옅파랑
			FColor(140, 130, 120, 255),  // 8  Gravel         자갈 회갈
			FColor(155, 100,  80, 255),  // 9  Clay           점토 적갈
			FColor( 45,  45,  55, 255),  // 10 Bedrock        암반 진회색
			FColor(200, 220, 230, 200),  // 11 Glass          유리 (반투명)
			FColor(120, 190,  90, 255),  // 12 GrassFlower    꽃 초록
			FColor( 95, 115,  75, 255),  // 13 StoneMossy     이끼 올리브
			FColor(150, 210, 190, 255),  // 14 CrystalGrass   크리스탈 청록
			FColor(190, 225, 210, 255),  // 15 GrassEthereal  옅 신비록
			FColor(130, 225, 110, 255),  // 16 MossGlow       발광 이끼
			FColor( 65,  50,  35, 255),  // 17 SoilDark       어둠 흙
			FColor(235, 220, 180, 255),  // 18 SandBleached   탈색 모래
			FColor(115, 110, 105, 255),  // 19 StoneFractured 균열 석재
			FColor(220, 215, 195, 255),  // 20 BoneFragment   뼛가루
			FColor(200, 180, 240, 255),  // 21 CrystalShard   크리스탈 라일락
			FColor(110,  75,  45, 255),  // 22 Wood           목재
			FColor( 60, 130,  50, 255),  // 23 Leaves         잎새
			FColor(205, 220, 200, 255),  // 24 LeavesSnow     설엽
			FColor( 90, 145,  85, 255),  // 25 Cactus         선인장
			FColor(180, 120, 100, 255),  // 26 Mushroom       버섯 적갈
			FColor(255, 130, 220, 255),  // 27 MushroomGlow   발광 핑크
			FColor( 40,  40,  50, 255),  // 28 OreCoal        석탄
			FColor(185, 125,  90, 255),  // 29 OreIron        철광 적갈
			FColor(240, 200,  80, 255),  // 30 OreGold        금
			FColor(180, 230, 255, 255),  // 31 OreCrystal     크리스탈 광석
			FColor( 65,  35,  90, 255),  // 32 OreVoidstone   공허석 보라
		};
		// 알 수 없는 TypeID 는 마젠타 — 누락된 등록을 시각적으로 즉시 식별.
		static const FColor Unknown(255,   0, 255, 255);
		return (TypeID < HktAdvTerrainType::TypeCount) ? Table[TypeID] : Unknown;
	}
}

AHktSpriteTerrainActor::AHktSpriteTerrainActor()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.TickGroup = TG_DuringPhysics;

	HISMComponent = CreateDefaultSubobject<UHierarchicalInstancedStaticMeshComponent>(TEXT("HISM"));
	RootComponent = HISMComponent;
	HISMComponent->SetMobility(EComponentMobility::Movable);
	HISMComponent->NumCustomDataFloats = kNumCustomDataFloats;
	HISMComponent->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	HISMComponent->SetCanEverAffectNavigation(false);
	HISMComponent->bDisableCollision = true;
	HISMComponent->SetGenerateOverlapEvents(false);
	HISMComponent->bAffectDistanceFieldLighting = false;
	HISMComponent->bAffectDynamicIndirectLighting = false;
	HISMComponent->CastShadow = false;
}

void AHktSpriteTerrainActor::BeginPlay()
{
	Super::BeginPlay();

	if (HISMComponent && QuadMesh)
	{
		HISMComponent->SetStaticMesh(QuadMesh);
		HISMComponent->NumCustomDataFloats = kNumCustomDataFloats;

		if (TerrainMaterial)
		{
			TerrainMID = UMaterialInstanceDynamic::Create(TerrainMaterial, this);
			if (TerrainMID)
			{
				// AtlasTexture 미할당 + 폴백 옵션 ON → TypeID 별 솔리드 컬러 아틀라스 생성.
				UTexture2D* AtlasToBind = AtlasTexture;
				if (!AtlasToBind && bUseFallbackColors)
				{
					FallbackAtlasTexture = BuildFallbackAtlasTexture();
					AtlasToBind = FallbackAtlasTexture;
					if (AtlasToBind)
					{
						UE_LOG(LogHktSpriteTerrain, Log,
							TEXT("[SpriteTerrain] AtlasTexture 미할당 — 폴백 컬러 아틀라스 생성 (HktAdvTerrainType %d 종)."),
							HktAdvTerrainType::TypeCount);
					}
				}

				// Param 이름 — M_HktSpriteYBillboard 규약. HktSpriteCore 의 상수와 동일.
				if (AtlasToBind)
				{
					TerrainMID->SetTextureParameterValue(TEXT("Atlas"), AtlasToBind);
				}
				if (PaletteLUT)
				{
					TerrainMID->SetTextureParameterValue(TEXT("PaletteLUT"), PaletteLUT);
				}
				// AtlasSize: M_HktSpriteYBillboard 는 xy=atlas 픽셀 크기만 본다.
				// 미존재 파라미터는 silently 무시되므로 호환성 위해 동일 호출 유지.
				TerrainMID->SetVectorParameterValue(
					TEXT("AtlasSize"),
					FLinearColor(AtlasSizePx.X, AtlasSizePx.Y, CellSizePx.X, CellSizePx.Y));
				HISMComponent->SetMaterial(0, TerrainMID);
			}
		}
		else
		{
			UE_LOG(LogHktSpriteTerrain, Warning,
				TEXT("[SpriteTerrain] TerrainMaterial 미할당 — M_HktSpriteYBillboard 를 할당하세요."));
		}
	}

	Loader = CreateTerrainChunkLoader(LoaderType);

	if (UHktTerrainSubsystem* Sub = UHktTerrainSubsystem::Get(this))
	{
		if (!BakedAsset.IsNull())
		{
			Sub->LoadBakedAsset(BakedAsset);
		}
	}
	else
	{
		UE_LOG(LogHktSpriteTerrain, Warning,
			TEXT("[SpriteTerrain] UHktTerrainSubsystem 없음 — Tick 무동작"));
	}
}

void AHktSpriteTerrainActor::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	if (HISMComponent)
	{
		HISMComponent->ClearInstances();
	}
	ChunkInstanceIndices.Reset();
	InstanceChunkByIdx.Reset();
	bAboveChunkValid = false;
	if (Loader)
	{
		Loader->Clear();
		Loader.Reset();
	}

	Super::EndPlay(EndPlayReason);
}

void AHktSpriteTerrainActor::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (!HISMComponent || !QuadMesh || !Loader)
	{
		return;
	}

	UHktTerrainSubsystem* Sub = UHktTerrainSubsystem::Get(this);
	if (!Sub)
	{
		return;
	}

	// 스캔 빈도 제한 — iso 카메라라 초당 N회면 충분.
	const float Now = GetWorld() ? GetWorld()->GetTimeSeconds() : 0.f;
	const float MinInterval = (MaxScansPerSecond > 0.f) ? 1.f / MaxScansPerSecond : 0.f;
	if (Now - LastScanTime < MinInterval)
	{
		return;
	}
	LastScanTime = Now;

	const float ChunkWorldSize = ComputeChunkWorldSize(Sub);
	if (ChunkWorldSize <= 0.f)
	{
		return;
	}
	CachedChunkWorldSize = ChunkWorldSize;

	// Sprite 크기는 PixelToWorld × CellSizePx 에서만 산출되므로 ChunkWorldSize 변화는 무관.
	// ComponentZBias / sprite half-size 변경 감지 → 기존 인스턴스 slot 7/8/15 일괄 refresh.
	const float CurHalfW = CellSizePx.X * PixelToWorld * 0.5f;
	const float CurHalfH = CellSizePx.Y * PixelToWorld * 0.5f;
	const bool bBaselineChanged =
		!FMath::IsNearlyEqual(PrevComponentZBias, ComponentZBias) ||
		!FMath::IsNearlyEqual(PrevHalfWWorld,    CurHalfW)        ||
		!FMath::IsNearlyEqual(PrevHalfHWorld,    CurHalfH);
	if (bBaselineChanged)
	{
		RefreshAllInstanceBaseline();
		PrevComponentZBias = ComponentZBias;
		PrevHalfWWorld     = CurHalfW;
		PrevHalfHWorld     = CurHalfH;
	}

	SyncLoaderConfig(Sub);

	const FVector CameraPos = GetViewCenterWorldPos();
	Loader->Update(CameraPos, ChunkWorldSize);

	// === Unload — 일괄 인스턴스 제거 ===
	for (const FIntVector& Coord : Loader->GetChunksToUnload())
	{
		RemoveInstancesForChunk(Coord);
	}

	// === Load — 새 청크. AcquireChunk → ExtractSurfaceCells → AddInstancesForChunk ===
	for (const FHktChunkTierRequest& Req : Loader->GetChunksToLoad())
	{
		// 이미 로드된 청크는 스킵 (방어적 — Loader 는 신규만 emit 한다는 전제).
		if (ChunkInstanceIndices.Contains(Req.Coord))
		{
			continue;
		}

		// 청크 1개 단위로 위 청크 캐시는 무효화 — 이전 청크용으로 fetch 된 것일 수 있음.
		bAboveChunkValid = false;
		AboveChunkCachedCoord = FIntVector(INT_MIN, INT_MIN, INT_MIN);

		ExtractSurfaceCells(Sub, Req.Coord, SurfaceCellsScratch);
		if (SurfaceCellsScratch.Num() > 0)
		{
			AddInstancesForChunk(Req.Coord, SurfaceCellsScratch);
		}
	}

	HISMComponent->MarkRenderStateDirty();
}

void AHktSpriteTerrainActor::SyncLoaderConfig(UHktTerrainSubsystem* Sub)
{
	const FHktTerrainGeneratorConfig Cfg = Sub->GetEffectiveConfig();

	FHktTerrainLoaderConfig LoaderCfg;
	LoaderCfg.PrimaryRadius   = StreamRadius;
	LoaderCfg.SecondaryRadius = (LoaderType == EHktTerrainLoaderType::Proximity)
		? ProximityFarRadius
		: StreamRadius;
	LoaderCfg.MaxLoadsPerFrame = MaxLoadsPerFrame;
	LoaderCfg.MaxLoadedChunks  = MaxLoadedChunks;
	LoaderCfg.HeightMinZ       = Cfg.HeightMinZ;
	LoaderCfg.HeightMaxZ       = Cfg.HeightMaxZ;
	Loader->Configure(LoaderCfg);
}

float AHktSpriteTerrainActor::ComputeChunkWorldSize(UHktTerrainSubsystem* Sub) const
{
	const float VoxelSizeCm = Sub->GetEffectiveConfig().VoxelSizeCm;
	return kChunkSize * VoxelSizeCm;
}

void AHktSpriteTerrainActor::ExtractSurfaceCells(UHktTerrainSubsystem* Sub,
	const FIntVector& Coord, TArray<FHktSpriteTerrainSurfaceCell>& OutCells)
{
	OutCells.Reset();

	if (ChunkVoxelScratch.Num() != kVoxelsPerChunk)
	{
		ChunkVoxelScratch.SetNumUninitialized(kVoxelsPerChunk);
	}
	if (!Sub->AcquireChunk(Coord, ChunkVoxelScratch))
	{
		return;
	}

	const float VoxelSize = Sub->GetEffectiveConfig().VoxelSizeCm;
	const float ChunkWorldSize = kChunkSize * VoxelSize;

	// 위 청크 voxel — 청크 경계 (LocalZ == ChunkSize-1) 의 +Z 노출 판정에만 lazy fetch.
	auto EnsureAboveChunkLoaded = [&]() -> bool
	{
		const FIntVector AboveCoord(Coord.X, Coord.Y, Coord.Z + 1);
		if (bAboveChunkValid && AboveChunkCachedCoord == AboveCoord)
		{
			return true;
		}
		if (AboveChunkVoxelScratch.Num() != kVoxelsPerChunk)
		{
			AboveChunkVoxelScratch.SetNumUninitialized(kVoxelsPerChunk);
		}
		bAboveChunkValid = Sub->AcquireChunk(AboveCoord, AboveChunkVoxelScratch);
		AboveChunkCachedCoord = AboveCoord;
		return bAboveChunkValid;
	};

	OutCells.Reserve(kChunkSize * kChunkSize);

	// 청크 내 (LX, LY) 별 topmost-exposed solid voxel 탐색.
	for (int32 LY = 0; LY < kChunkSize; ++LY)
	{
		for (int32 LX = 0; LX < kChunkSize; ++LX)
		{
			int32 TopZ = -1;
			const FHktTerrainVoxel* TopVoxel = nullptr;

			for (int32 LZ = kChunkSize - 1; LZ >= 0; --LZ)
			{
				const FHktTerrainVoxel& V = ChunkVoxelScratch[VoxelIndex(LX, LY, LZ)];
				if (V.IsEmpty())
				{
					continue;
				}
				TopZ = LZ;
				TopVoxel = &V;
				break;
			}

			if (!TopVoxel)
			{
				continue;  // 빈 컬럼 — emit 없음
			}

			// 노출 판정:
			//  - TopZ < ChunkSize-1: 위 voxel 은 같은 청크 안, 항상 비어 있음 (top-down 스캔이 거기서 stop 안 했으므로).
			//  - TopZ == ChunkSize-1: 위 청크 (X,Y,0) voxel 이 비어 있어야 노출.
			//                          위 청크 미존재(월드 상한 초과) → 노출로 간주.
			bool bExposedAbove = (TopZ < kChunkSize - 1);
			if (!bExposedAbove)
			{
				if (EnsureAboveChunkLoaded())
				{
					const FHktTerrainVoxel& AboveV =
						AboveChunkVoxelScratch[VoxelIndex(LX, LY, 0)];
					bExposedAbove = AboveV.IsEmpty();
				}
				else
				{
					// 위 청크가 월드 영역 밖이거나 fetch 실패 — 노출로 간주 (top-most 가시).
					bExposedAbove = true;
				}
			}

			if (!bExposedAbove)
			{
				continue;
			}

			FHktSpriteTerrainSurfaceCell Cell;
			Cell.ChunkCoord = Coord;
			Cell.LocalCoord = FIntVector(LX, LY, TopZ);
			// voxel 의 바닥-중앙 (= quad bottom-center pivot 정렬점).
			Cell.WorldPos = FVector(
				Coord.X * ChunkWorldSize + (LX + 0.5f) * VoxelSize,
				Coord.Y * ChunkWorldSize + (LY + 0.5f) * VoxelSize,
				Coord.Z * ChunkWorldSize +  TopZ        * VoxelSize);
			Cell.TypeID       = TopVoxel->TypeID;
			Cell.PaletteIndex = TopVoxel->PaletteIndex;
			Cell.Flags        = TopVoxel->Flags;
			OutCells.Add(Cell);
		}
	}
}

void AHktSpriteTerrainActor::AddInstancesForChunk(const FIntVector& Coord,
	const TArray<FHktSpriteTerrainSurfaceCell>& Cells)
{
	if (Cells.Num() == 0)
	{
		return;
	}

	TArray<int32>& Indices = ChunkInstanceIndices.FindOrAdd(Coord);
	Indices.Reserve(Indices.Num() + Cells.Num());

	TArray<float> CustomData;
	CustomData.SetNumUninitialized(kNumCustomDataFloats);

	for (const FHktSpriteTerrainSurfaceCell& Cell : Cells)
	{
		const FTransform Xform = MakeInstanceTransform(Cell);
		const int32 NewIdx = HISMComponent->AddInstance(Xform, /*bWorldSpace=*/true);
		if (NewIdx == INDEX_NONE)
		{
			continue;
		}
		FillCustomData(Cell, CustomData);
		for (int32 S = 0; S < kNumCustomDataFloats; ++S)
		{
			HISMComponent->SetCustomDataValue(NewIdx, S, CustomData[S],
				/*bMarkRenderStateDirty=*/false);
		}
		Indices.Add(NewIdx);
		InstanceChunkByIdx.Add(NewIdx, Coord);
	}
}

void AHktSpriteTerrainActor::RemoveInstancesForChunk(const FIntVector& Coord)
{
	TArray<int32> Indices;
	if (!ChunkInstanceIndices.RemoveAndCopyValue(Coord, Indices))
	{
		return;
	}

	// 큰 인덱스부터 제거하면 swap-with-last 보정 시 같은 청크 내 작은 인덱스가 흔들리지 않음.
	Indices.Sort();

	for (int32 i = Indices.Num() - 1; i >= 0; --i)
	{
		const int32 RemoveIdx = Indices[i];
		const int32 LastIdx = HISMComponent->GetInstanceCount() - 1;
		if (!HISMComponent->RemoveInstance(RemoveIdx))
		{
			InstanceChunkByIdx.Remove(RemoveIdx);
			continue;
		}
		InstanceChunkByIdx.Remove(RemoveIdx);

		// RemoveInstance 는 마지막 인스턴스를 빈 자리에 swap. 매핑 보정.
		if (RemoveIdx != LastIdx)
		{
			if (FIntVector* MovedChunk = InstanceChunkByIdx.Find(LastIdx))
			{
				const FIntVector ChunkOfMoved = *MovedChunk;
				InstanceChunkByIdx.Remove(LastIdx);
				InstanceChunkByIdx.Add(RemoveIdx, ChunkOfMoved);

				if (TArray<int32>* MovedList = ChunkInstanceIndices.Find(ChunkOfMoved))
				{
					for (int32& Slot : *MovedList)
					{
						if (Slot == LastIdx)
						{
							Slot = RemoveIdx;
							break;
						}
					}
				}
			}
		}
	}
}

FTransform AHktSpriteTerrainActor::MakeInstanceTransform(const FHktSpriteTerrainSurfaceCell& Cell) const
{
	// quad 는 1×1 단위, 머티리얼 WPO 가 Y-axis billboard + 카메라 정렬 처리.
	// 회전 identity — sprite 크기는 CPD slot 7/8 (HalfW/HalfH world) 로 결정.
	return FTransform(FQuat::Identity, Cell.WorldPos, FVector::OneVector);
}

void AHktSpriteTerrainActor::FillCustomData(
	const FHktSpriteTerrainSurfaceCell& Cell, TArray<float>& OutData) const
{
	check(OutData.Num() == kNumCustomDataFloats);

	const float HalfW = CellSizePx.X * PixelToWorld * 0.5f;
	const float HalfH = CellSizePx.Y * PixelToWorld * 0.5f;
	const bool bTranslucent = (Cell.Flags & FHktTerrainVoxel::FLAG_TRANSLUCENT) != 0;
	const float Alpha = bTranslucent ? 0.6f : 1.0f;

	// M_HktSpriteYBillboard CPD 규약 (HktSpriteBillboardMaterial.h).
	OutData[0]  = static_cast<float>(Cell.TypeID);   // AtlasIndex = grid cell idx
	OutData[1]  = CellSizePx.X;                       // CellW (px)
	OutData[2]  = CellSizePx.Y;                       // CellH (px)
	OutData[3]  = 0.f;                                // reserved
	OutData[4]  = 0.f;                                // PivotOffsetX (world) — quad mesh 가 이미 bottom-center
	OutData[5]  = 0.f;                                // PivotOffsetY (world)
	OutData[6]  = 0.f;                                // RotRad
	OutData[7]  = HalfW;                              // HalfWidth  (world cm)
	OutData[8]  = HalfH;                              // HalfHeight (world cm)
	OutData[9]  = 1.f;                                // Tint R
	OutData[10] = 1.f;                                // Tint G
	OutData[11] = 1.f;                                // Tint B
	OutData[12] = Alpha;                              // Tint A
	OutData[13] = static_cast<float>(Cell.PaletteIndex);
	OutData[14] = 0.f;                                // FlipX
	OutData[15] = ComponentZBias;                     // ZBias (cm)
}

void AHktSpriteTerrainActor::RefreshAllInstanceBaseline()
{
	if (!HISMComponent || InstanceChunkByIdx.Num() == 0)
	{
		return;
	}

	const float HalfW = CellSizePx.X * PixelToWorld * 0.5f;
	const float HalfH = CellSizePx.Y * PixelToWorld * 0.5f;

	// slot 7/8/15 만 baseline. 0~6, 9~14 는 셀 단위라 새 셀 emit 때만 갱신.
	for (const TPair<int32, FIntVector>& Pair : InstanceChunkByIdx)
	{
		const int32 Idx = Pair.Key;
		HISMComponent->SetCustomDataValue(Idx, 7,  HalfW,            /*bMarkRenderStateDirty=*/false);
		HISMComponent->SetCustomDataValue(Idx, 8,  HalfH,            /*bMarkRenderStateDirty=*/false);
		HISMComponent->SetCustomDataValue(Idx, 15, ComponentZBias,   /*bMarkRenderStateDirty=*/false);
	}
}

FVector AHktSpriteTerrainActor::GetViewCenterWorldPos() const
{
	if (const UWorld* World = GetWorld())
	{
		if (const APlayerController* PC = World->GetFirstPlayerController())
		{
			if (const APawn* Pawn = PC->GetPawn())
			{
				return Pawn->GetActorLocation();
			}
			FVector Pos; FRotator Rot;
			PC->GetPlayerViewPoint(Pos, Rot);
			return Pos;
		}
	}
	return FVector::ZeroVector;
}

UTexture2D* AHktSpriteTerrainActor::BuildFallbackAtlasTexture()
{
	// UPROPERTY AtlasSizePx / CellSizePx 그대로 따라 사용자 atlas 의 grid 와 동일 layout 유지.
	// 셀당 solid color, TF_Nearest 로 경계 블리딩 방지.
	const int32 W = FMath::Max(1, FMath::FloorToInt(AtlasSizePx.X));
	const int32 H = FMath::Max(1, FMath::FloorToInt(AtlasSizePx.Y));
	const int32 CellW = FMath::Max(1, FMath::FloorToInt(CellSizePx.X));
	if (W <= 0 || H <= 0)
	{
		return nullptr;
	}

	UTexture2D* Tex = NewObject<UTexture2D>(this,
		TEXT("SpriteTerrainFallbackAtlas"), RF_Transient);
	FTexturePlatformData* PD = new FTexturePlatformData();
	PD->SizeX = W;
	PD->SizeY = H;
	PD->PixelFormat = PF_B8G8R8A8;
	FTexture2DMipMap* Mip = new FTexture2DMipMap();
	PD->Mips.Add(Mip);
	Mip->SizeX = W;
	Mip->SizeY = H;
	Mip->BulkData.Lock(LOCK_READ_WRITE);
	uint8* Bytes = static_cast<uint8*>(Mip->BulkData.Realloc(W * H * 4));

	// 가로 cell index = TypeID. 세로는 모든 행이 동일 색 (frame 축 미사용).
	for (int32 PY = 0; PY < H; ++PY)
	{
		for (int32 PX = 0; PX < W; ++PX)
		{
			const int32 CellX = PX / CellW;
			const uint16 TypeID = static_cast<uint16>(CellX);
			const FColor& C = GetFallbackTypeColor(TypeID);
			uint8* P = Bytes + (PY * W + PX) * 4;
			// PF_B8G8R8A8 layout: B, G, R, A.
			P[0] = C.B;
			P[1] = C.G;
			P[2] = C.R;
			P[3] = C.A;
		}
	}
	Mip->BulkData.Unlock();

	Tex->SetPlatformData(PD);
	Tex->Filter = TF_Nearest;
	Tex->SRGB = true;
	Tex->AddressX = TA_Clamp;
	Tex->AddressY = TA_Clamp;
	Tex->UpdateResource();
	return Tex;
}
