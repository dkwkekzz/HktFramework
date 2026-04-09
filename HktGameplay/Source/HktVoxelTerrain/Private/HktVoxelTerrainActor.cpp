// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVoxelTerrainActor.h"
#include "HktVoxelTerrainStreamer.h"
#include "HktVoxelTerrainLog.h"
#include "Data/HktVoxelRenderCache.h"
#include "Data/HktVoxelTypes.h"
#include "Meshing/HktVoxelMeshScheduler.h"
#include "Rendering/HktVoxelChunkComponent.h"
#include "Rendering/HktVoxelTileAtlas.h"
#include "Rendering/HktVoxelMaterialLUT.h"
#include "Terrain/HktTerrainGenerator.h"
#include "Terrain/HktTerrainVoxel.h"
#include "Settings/HktRuntimeGlobalSetting.h"
#include "Engine/World.h"
#include "Engine/Texture2DArray.h"
#include "Engine/Texture2D.h"
#include "GameFramework/PlayerController.h"
#include "RenderingThread.h"
#include "RHIStaticStates.h"
#include "TextureResource.h"

// FHktTerrainVoxel과 FHktVoxel은 동일 4바이트 레이아웃
static_assert(sizeof(FHktTerrainVoxel) == sizeof(FHktVoxel),
	"FHktTerrainVoxel and FHktVoxel must have identical size for safe reinterpret_cast");

AHktVoxelTerrainActor::~AHktVoxelTerrainActor() = default;

AHktVoxelTerrainActor::AHktVoxelTerrainActor()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.TickGroup = TG_PrePhysics;

	RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
}

void AHktVoxelTerrainActor::BeginPlay()
{
	Super::BeginPlay();

	// 테레인 전용 파이프라인 생성
	TerrainCache = MakeUnique<FHktVoxelRenderCache>();
	TerrainMeshScheduler = MakeUnique<FHktVoxelMeshScheduler>(TerrainCache.Get());
	TerrainMeshScheduler->SetMaxMeshPerFrame(MaxMeshPerFrame);
	TerrainMeshScheduler->SetVoxelSize(VoxelSize);
	TerrainMeshScheduler->SetDoubleSided(false);  // terrain은 단면 렌더링 — 삼각형 수 절반

	Streamer = MakeUnique<FHktVoxelTerrainStreamer>();
	Streamer->SetMaxLoadsPerFrame(MaxLoadsPerFrame);
	Streamer->SetHeightRange(HeightMinZ, HeightMaxZ);
	Streamer->SetMaxLoadedChunks(MaxLoadedChunks);

	// 지형 생성기 초기화 (UHktRuntimeGlobalSetting에서 설정 읽기)
	const UHktRuntimeGlobalSetting* Settings = GetDefault<UHktRuntimeGlobalSetting>();
	const FHktTerrainGeneratorConfig GenConfig = Settings->ToTerrainConfig();
	Generator = MakeUnique<FHktTerrainGenerator>(GenConfig);

	PrewarmPool(InitialPoolSize);

	// 블록 스타일 빌드 (비어있으면 스킵 → 기존 팔레트 렌더링)
	BuildTerrainStyle();

	UE_LOG(LogHktVoxelTerrain, Log,
		TEXT("Terrain Actor initialized — Seed=%lld, VoxelSize=%.1f, ChunkWorld=%.0f, ViewDist=%.0f, Pool=%d, MaxLoad=%d, MaxMesh=%d, Style=%s"),
		GenConfig.Seed, VoxelSize, GetChunkWorldSize(), ViewDistance, InitialPoolSize, MaxLoadsPerFrame, MaxMeshPerFrame,
		bStyleBuilt ? TEXT("Built") : TEXT("Palette"));
}

void AHktVoxelTerrainActor::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	// 1. OnMeshReady가 큐잉한 렌더 커맨드 완료 대기 — Proxy 참조 커맨드 처리 후 파괴
	FlushRenderingCommands();

	// 2. 컴포넌트 파괴 → Proxy가 렌더 스레드 지연 삭제 큐에 등록됨
	for (auto& Pair : ActiveChunks)
	{
		if (Pair.Value)
		{
			Pair.Value->DestroyComponent();
		}
	}
	ActiveChunks.Empty();

	for (UHktVoxelChunkComponent* Comp : ComponentPool)
	{
		if (Comp)
		{
			Comp->DestroyComponent();
		}
	}
	ComponentPool.Empty();

	// 3. Proxy 지연 삭제 실행 — GPU 버퍼(VB/IB/VertexFactory) 해제 보장
	FlushRenderingCommands();

	// 4. 워커 태스크 완료 대기 + 스케줄러 해제
	//    태스크는 TSharedPtr<FHktVoxelChunk>를 캡처하므로 청크 수명은 안전.
	//    Flush 후 TSharedPtr 해제 → 청크 참조 카운트 감소.
	TerrainMeshScheduler.Reset();

	// 5. 나머지 리소스 해제 — 캐시의 TSharedPtr 해제로 최종 청크 메모리 반환
	TerrainCache.Reset();
	Generator.Reset();
	Streamer.Reset();

	Super::EndPlay(EndPlayReason);
}

void AHktVoxelTerrainActor::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);

	if (!TerrainCache || !TerrainMeshScheduler || !Streamer || !Generator)
	{
		return;
	}

	const FVector CameraPos = GetCameraWorldPos();

	// 1. 스트리밍 업데이트
	Streamer->SetMaxLoadsPerFrame(MaxLoadsPerFrame);
	Streamer->SetMaxLoadedChunks(MaxLoadedChunks);
	Streamer->SetHeightRange(HeightMinZ, HeightMaxZ);
	Streamer->UpdateStreaming(CameraPos, ViewDistance, GetChunkWorldSize());

	// 2. 스트리밍 결과 반영 (생성 + 로드 + 컴포넌트 할당)
	ProcessStreamingResults();

	// 3. 메싱 스케줄링
	TerrainMeshScheduler->SetMaxMeshPerFrame(MaxMeshPerFrame);
	TerrainMeshScheduler->Tick(CameraPos);

	// 4. 메싱 완료 청크 → GPU 업로드
	ProcessMeshReadyChunks();
}

FVector AHktVoxelTerrainActor::GetCameraWorldPos() const
{
	if (const UWorld* World = GetWorld())
	{
		if (const APlayerController* PC = World->GetFirstPlayerController())
		{
			FVector ViewLoc;
			FRotator ViewRot;
			PC->GetPlayerViewPoint(ViewLoc, ViewRot);
			return ViewLoc;
		}
	}
	return FVector::ZeroVector;
}

void AHktVoxelTerrainActor::GenerateAndLoadChunk(const FIntVector& ChunkCoord)
{
	// 절차적 생성 (힙 할당 — 128KB는 워커 스레드 스택에 위험)
	constexpr int32 ChunkVoxelCount = 32 * 32 * 32;
	TArray<FHktTerrainVoxel> GeneratedVoxels;
	GeneratedVoxels.SetNumUninitialized(ChunkVoxelCount);
	Generator->GenerateChunk(ChunkCoord.X, ChunkCoord.Y, ChunkCoord.Z, GeneratedVoxels.GetData());

	// FHktTerrainVoxel → FHktVoxel (동일 4바이트 레이아웃)
	const FHktVoxel* VoxelData = reinterpret_cast<const FHktVoxel*>(GeneratedVoxels.GetData());
	TerrainCache->LoadChunk(ChunkCoord, VoxelData, ChunkVoxelCount);

	// 컴포넌트 할당
	UHktVoxelChunkComponent* Comp = AcquireComponent();
	if (Comp)
	{
		Comp->Initialize(TerrainCache.Get(), ChunkCoord, VoxelSize);
		Comp->SetShadowDistance(ShadowDistance);
		if (TerrainMaterial)
		{
			Comp->SetVoxelMaterial(TerrainMaterial);
		}
		if (bStyleBuilt) { ApplyStyleToComponent(Comp); }
		ActiveChunks.Add(ChunkCoord, Comp);
	}
}

void AHktVoxelTerrainActor::ProcessStreamingResults()
{
	// 언로드 — 태스크가 TSharedPtr<FHktVoxelChunk>를 캡처하므로 Flush 불필요.
	// UnloadChunk은 맵에서 제거만 하고, 실제 메모리는 태스크의 TSharedPtr 해제 시 반환.
	for (const FIntVector& Coord : Streamer->GetChunksToUnload())
	{
		TerrainCache->UnloadChunk(Coord);

		if (UHktVoxelChunkComponent** Found = ActiveChunks.Find(Coord))
		{
			ReleaseComponent(*Found);
			ActiveChunks.Remove(Coord);
		}
	}

	// 로드: 스트리머가 요청한 청크를 절차적 생성 → RenderCache 로드 → 컴포넌트 할당
	for (const FIntVector& Coord : Streamer->GetChunksToLoad())
	{
		if (ActiveChunks.Contains(Coord))
		{
			continue;
		}

		GenerateAndLoadChunk(Coord);
	}
}

void AHktVoxelTerrainActor::ProcessMeshReadyChunks()
{
	for (auto& Pair : ActiveChunks)
	{
		FHktVoxelChunk* Chunk = TerrainCache->GetChunk(Pair.Key);
		if (Chunk && Chunk->bMeshReady.load(std::memory_order_acquire))
		{
			Chunk->bMeshReady.store(false, std::memory_order_release);
			Pair.Value->OnMeshReady();
		}
	}
}

// === 외부 API (VM 직접 연동용 — 절차적 생성 없이 데이터 주입) ===

void AHktVoxelTerrainActor::LoadTerrainChunk(const FIntVector& ChunkCoord, const FHktVoxel* VoxelData, int32 VoxelCount)
{
	if (!TerrainCache)
	{
		return;
	}

	TerrainCache->LoadChunk(ChunkCoord, VoxelData, VoxelCount);

	if (Streamer && Streamer->GetLoadedChunks().Contains(ChunkCoord) && !ActiveChunks.Contains(ChunkCoord))
	{
		UHktVoxelChunkComponent* Comp = AcquireComponent();
		if (Comp)
		{
			Comp->Initialize(TerrainCache.Get(), ChunkCoord, VoxelSize);
			Comp->SetShadowDistance(ShadowDistance);
			if (TerrainMaterial)
			{
				Comp->SetVoxelMaterial(TerrainMaterial);
			}
			ApplyStyleToComponent(Comp);
			ActiveChunks.Add(ChunkCoord, Comp);
		}
	}
}

void AHktVoxelTerrainActor::UnloadTerrainChunk(const FIntVector& ChunkCoord)
{
	if (!TerrainCache)
	{
		return;
	}

	TerrainCache->UnloadChunk(ChunkCoord);

	if (UHktVoxelChunkComponent** Found = ActiveChunks.Find(ChunkCoord))
	{
		ReleaseComponent(*Found);
		ActiveChunks.Remove(ChunkCoord);
	}
}

// === 컴포넌트 풀 ===

UHktVoxelChunkComponent* AHktVoxelTerrainActor::AcquireComponent()
{
	UHktVoxelChunkComponent* Comp = nullptr;

	if (ComponentPool.Num() > 0)
	{
		Comp = ComponentPool.Pop(EAllowShrinking::No);
	}
	else
	{
		Comp = NewObject<UHktVoxelChunkComponent>(this, NAME_None, RF_Transient);
		Comp->SetupAttachment(RootComponent);
		Comp->RegisterComponent();
	}

	if (Comp)
	{
		Comp->SetVisibility(true);
		Comp->SetComponentTickEnabled(false);
	}
	return Comp;
}

void AHktVoxelTerrainActor::ReleaseComponent(UHktVoxelChunkComponent* Comp)
{
	if (!Comp)
	{
		return;
	}

	Comp->SetVisibility(false);

	// 풀 크기 제한 — InitialPoolSize의 2배 초과 시 컴포넌트 파괴
	const int32 MaxPoolSize = InitialPoolSize * 2;
	if (ComponentPool.Num() >= MaxPoolSize)
	{
		Comp->DestroyComponent();
	}
	else
	{
		ComponentPool.Add(Comp);
	}
}

void AHktVoxelTerrainActor::PrewarmPool(int32 Count)
{
	ComponentPool.Reserve(Count);
	for (int32 i = 0; i < Count; ++i)
	{
		UHktVoxelChunkComponent* Comp = NewObject<UHktVoxelChunkComponent>(this, NAME_None, RF_Transient);
		Comp->SetupAttachment(RootComponent);
		Comp->RegisterComponent();
		Comp->SetVisibility(false);
		ComponentPool.Add(Comp);
	}
}

// ============================================================================
// 블록 스타일 빌드 (BlockStyles → Texture2DArray + LUT + MaterialLUT)
// ============================================================================

void AHktVoxelTerrainActor::BuildTerrainStyle()
{
	bStyleBuilt = false;

	if (BlockStyles.Num() == 0)
	{
		UE_LOG(LogHktVoxelTerrain, Log, TEXT("[TerrainStyle] BlockStyles is empty — using palette fallback"));
		return;
	}

	// 1. 고유 텍스처 수집 → 슬라이스 인덱스 할당
	TMap<UTexture2D*, uint8> TextureToSlice;
	TArray<UTexture2D*> SliceTextures;  // 인덱스 순서

	auto AssignSlice = [&](UTexture2D* Tex) -> uint8
	{
		if (!Tex)
		{
			return 255;  // 미매핑 → 팔레트 폴백
		}
		if (const uint8* Found = TextureToSlice.Find(Tex))
		{
			return *Found;
		}
		if (SliceTextures.Num() >= 255)
		{
			UE_LOG(LogHktVoxelTerrain, Warning, TEXT("[TerrainStyle] Too many unique textures (max 255)"));
			return 255;
		}
		const uint8 Idx = static_cast<uint8>(SliceTextures.Num());
		TextureToSlice.Add(Tex, Idx);
		SliceTextures.Add(Tex);
		return Idx;
	};

	// 2. TileAtlas 생성 + 매핑
	BuiltTileAtlas = NewObject<UHktVoxelTileAtlas>(this, TEXT("BuiltTileAtlas"), RF_Transient);

	for (const FHktVoxelBlockStyle& Style : BlockStyles)
	{
		UTexture2D* TopTex = Style.TopTexture ? Style.TopTexture.Get() : Style.SideTexture.Get();
		UTexture2D* SideTex = Style.SideTexture.Get();
		UTexture2D* BottomTex = Style.BottomTexture ? Style.BottomTexture.Get() : SideTex;

		const uint8 TopSlice = AssignSlice(TopTex);
		const uint8 SideSlice = AssignSlice(SideTex);
		const uint8 BottomSlice = AssignSlice(BottomTex);

		BuiltTileAtlas->SetTileMapping(
			static_cast<uint16>(Style.TypeID), TopSlice, SideSlice, BottomSlice);
	}

	// 3. 개별 UTexture2D들을 Texture2DArray로 조립
	if (SliceTextures.Num() > 0)
	{
		UTexture2DArray* TileArray = NewObject<UTexture2DArray>(BuiltTileAtlas, TEXT("TileArray"), RF_Transient);

		// SourceTextures에 개별 텍스처 추가 → UE5가 자동으로 Texture2DArray 빌드
		TileArray->SourceTextures.Empty();
		for (UTexture2D* Tex : SliceTextures)
		{
			TileArray->SourceTextures.Add(Tex);
		}
		TileArray->AddressX = TA_Wrap;
		TileArray->AddressY = TA_Wrap;
		TileArray->UpdateSourceFromSourceTextures(true);
		TileArray->UpdateResource();

		BuiltTileAtlas->TileArray = TileArray;
	}

	// 4. TileIndexLUT 빌드
	BuiltTileAtlas->BuildLUTTexture();

	// 5. MaterialLUT 생성
	BuiltMaterialLUT = NewObject<UHktVoxelMaterialLUT>(this, TEXT("BuiltMaterialLUT"), RF_Transient);

	for (const FHktVoxelBlockStyle& Style : BlockStyles)
	{
		BuiltMaterialLUT->SetMaterial(
			static_cast<uint16>(Style.TypeID),
			Style.Roughness, Style.Metallic, Style.Specular);
	}
	BuiltMaterialLUT->BuildLUTTexture();

	bStyleBuilt = true;

	UE_LOG(LogHktVoxelTerrain, Log,
		TEXT("[TerrainStyle] Built — %d block styles, %d unique textures, %d slices"),
		BlockStyles.Num(), TextureToSlice.Num(), SliceTextures.Num());
}

void AHktVoxelTerrainActor::ApplyStyleToComponent(UHktVoxelChunkComponent* Comp)
{
	if (!Comp)
	{
		return;
	}

	if (BuiltTileAtlas)
	{
		FHktVoxelTileTextureSet TileSet;
		TileSet.TileArray = { BuiltTileAtlas->GetTileArrayRHI(),
			TStaticSamplerState<SF_Bilinear, AM_Wrap, AM_Wrap>::GetRHI() };
		TileSet.TileIndexLUT = { BuiltTileAtlas->GetTileIndexLUTRHI(),
			TStaticSamplerState<SF_Point, AM_Clamp, AM_Clamp>::GetRHI() };

		if (TileSet.IsValid())
		{
			Comp->SetTileTextures(TileSet);
		}
	}

	if (BuiltMaterialLUT)
	{
		FHktVoxelTexturePair MatPair = { BuiltMaterialLUT->GetMaterialLUTRHI(),
			TStaticSamplerState<SF_Point, AM_Clamp, AM_Clamp>::GetRHI() };

		if (MatPair.IsValid())
		{
			Comp->SetMaterialLUT(MatPair);
		}
	}
}
