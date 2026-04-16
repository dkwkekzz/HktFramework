// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVoxelTerrainActor.h"
#include "HktVoxelTerrainStreamer.h"
#include "HktVoxelTerrainLog.h"
#include "Data/HktVoxelRenderCache.h"
#include "Data/HktVoxelRaycast.h"
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

	// 단일 출처: UHktRuntimeGlobalSetting에서 지형 설정을 모두 읽는다
	const UHktRuntimeGlobalSetting* Settings = GetDefault<UHktRuntimeGlobalSetting>();
	const FHktTerrainGeneratorConfig GenConfig = Settings->ToTerrainConfig();
	VoxelSize  = GenConfig.VoxelSizeCm;
	HeightMinZ = GenConfig.HeightMinZ;
	HeightMaxZ = GenConfig.HeightMaxZ;

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

	// 지형 생성기 초기화
	Generator = MakeUnique<FHktTerrainGenerator>(GenConfig);

	PrewarmPool(InitialPoolSize);

	// 스타일라이즈 토글 초기값 동기화
	bPrevStylizedRendering = bStylizedRendering;

	// 블록 스타일 빌드 (비어있으면 스킵 → 기존 팔레트 렌더링)
	BuildTerrainStyle();

	// TerrainMaterial 미할당 시 안내 — ChunkComponent가 자동 생성된 VertexColor 머티리얼을
	// 기본값으로 사용하므로 텍스처는 정상 렌더링된다. 프로덕션에서는 커스텀 머티리얼 할당 권장.
	if (!TerrainMaterial)
	{
		UE_LOG(LogHktVoxelTerrain, Log,
			TEXT("[TerrainActor] TerrainMaterial 미할당 — ChunkComponent 기본 머티리얼(VertexColor → BaseColor)이 "
				 "자동 사용됩니다. 프로덕션에서는 커스텀 Surface 머티리얼을 할당하세요."));
	}

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

	// 4. 스타일 텍스처 재시도 펌프 (TileArray RHI 비동기 빌드 대응)
	//    ProcessMeshReadyChunks보다 먼저 호출해 OnMeshReady에서도 최신 캐시를 쓰게 한다.
	PumpStyleTextures();

	// 5. 스타일라이즈 토글 변경 감지 — 에디터에서 라이브 토글 시 전체 청크에 반영
	if (bStylizedRendering != bPrevStylizedRendering)
	{
		bPrevStylizedRendering = bStylizedRendering;
		for (auto& Pair : ActiveChunks)
		{
			if (Pair.Value)
			{
				Pair.Value->SetStylizedRendering(bStylizedRendering);
			}
		}
	}

	// 6. 메싱 완료 청크 → GPU 업로드
	ProcessMeshReadyChunks();
}

UMaterialInterface* AHktVoxelTerrainActor::GetEffectiveTerrainMaterial() const
{
	// TerrainMaterial이 명시적으로 할당되면 그대로 사용.
	// 미할당이면 nullptr 반환 — ChunkComponent의 기본 VertexColor 머티리얼이 사용됨.
	return TerrainMaterial;
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
		Comp->SetStylizedRendering(bStylizedRendering);
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
	// 참고: 스타일 텍스처 재시도/전달은 PumpStyleTextures()가 매 Tick 별도로 처리한다.
	// 여기서는 순수하게 메시 GPU 업로드만 담당.
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

void AHktVoxelTerrainActor::PumpStyleTextures()
{
	if (!bStyleBuilt)
	{
		return;
	}

	const bool bExpectsTileArray = BuiltTileAtlas && BuiltTileAtlas->TileArray != nullptr;
	const bool bExpectsMaterialLUT = (BuiltMaterialLUT != nullptr);

	if (!bExpectsTileArray && !bExpectsMaterialLUT)
	{
		return;
	}

	int32 PendingCount = 0;
	int32 AppliedCount = 0;

	for (auto& Pair : ActiveChunks)
	{
		UHktVoxelChunkComponent* Comp = Pair.Value;
		if (!Comp)
		{
			continue;
		}

		// 캐시 재시도 — RHI가 이번 틱에 방금 준비되었을 수 있다.
		const bool bNeedTileRetry = bExpectsTileArray && !Comp->HasCachedTileTextures();
		const bool bNeedMatRetry = bExpectsMaterialLUT && !Comp->HasCachedMaterialLUT();
		if (bNeedTileRetry || bNeedMatRetry)
		{
			ApplyStyleToComponent(Comp);
		}

		// 캐시가 기대하는 모든 부분에 대해 완성되었고 아직 Proxy에 전달되지 않았다면 push.
		const bool bTileComplete = !bExpectsTileArray || Comp->HasCachedTileTextures();
		const bool bMatComplete = !bExpectsMaterialLUT || Comp->HasCachedMaterialLUT();
		if (bTileComplete && bMatComplete && !Comp->IsStyleTexturesApplied())
		{
			Comp->PushStyleTexturesToProxy();
		}

		if (Comp->IsStyleTexturesApplied())
		{
			AppliedCount++;
		}
		else
		{
			PendingCount++;
		}
	}

	// 5초간 1회 진단 로그 — 파이프라인 상태 요약
	static bool bDiagLogged = false;
	if (!bDiagLogged && GetWorld() && GetWorld()->GetTimeSeconds() > 5.0f && ActiveChunks.Num() > 0)
	{
		bDiagLogged = true;
		UE_LOG(LogHktVoxelTerrain, Warning,
			TEXT("[PumpStyle 진단] ActiveChunks=%d, Applied=%d, Pending=%d, "
				 "ExpectsTile=%d, ExpectsMat=%d, "
				 "TileArrayRHI=%p, TileIndexLUTRHI=%p, MaterialLUTRHI=%p"),
			ActiveChunks.Num(), AppliedCount, PendingCount,
			bExpectsTileArray ? 1 : 0, bExpectsMaterialLUT ? 1 : 0,
			BuiltTileAtlas ? BuiltTileAtlas->GetTileArrayRHI() : nullptr,
			BuiltTileAtlas ? BuiltTileAtlas->GetTileIndexLUTRHI() : nullptr,
			BuiltMaterialLUT ? BuiltMaterialLUT->GetMaterialLUTRHI() : nullptr);
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
			Comp->SetStylizedRendering(bStylizedRendering);
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

	// 3. 소스 텍스처 호환성 검증 — Texture2DArray는 모든 슬라이스가 동일 포맷/해상도여야 함
	if (SliceTextures.Num() > 0)
	{
		const int32 RefSizeX = SliceTextures[0]->GetSizeX();
		const int32 RefSizeY = SliceTextures[0]->GetSizeY();
		const EPixelFormat RefFormat = SliceTextures[0]->GetPixelFormat();
		bool bAllCompatible = true;

		for (int32 i = 1; i < SliceTextures.Num(); i++)
		{
			const UTexture2D* Tex = SliceTextures[i];
			if (Tex->GetSizeX() != RefSizeX || Tex->GetSizeY() != RefSizeY)
			{
				UE_LOG(LogHktVoxelTerrain, Error,
					TEXT("[TerrainStyle] 텍스처 크기 불일치 — 슬라이스[0]=%dx%d, 슬라이스[%d](%s)=%dx%d. "
						 "Texture2DArray는 모든 텍스처가 동일 해상도여야 합니다."),
					RefSizeX, RefSizeY, i, *Tex->GetName(),
					Tex->GetSizeX(), Tex->GetSizeY());
				bAllCompatible = false;
			}
			if (Tex->GetPixelFormat() != RefFormat)
			{
				UE_LOG(LogHktVoxelTerrain, Error,
					TEXT("[TerrainStyle] 텍스처 포맷 불일치 — 슬라이스[0]=%s, 슬라이스[%d](%s)=%s. "
						 "Texture2DArray는 모든 텍스처가 동일 PixelFormat이어야 합니다."),
					GetPixelFormatString(RefFormat), i, *Tex->GetName(),
					GetPixelFormatString(Tex->GetPixelFormat()));
				bAllCompatible = false;
			}
		}

		if (!bAllCompatible)
		{
			UE_LOG(LogHktVoxelTerrain, Error,
				TEXT("[TerrainStyle] 텍스처 호환성 검증 실패 — Texture2DArray를 빌드할 수 없습니다. "
					 "모든 BlockStyle 텍스처를 동일 해상도/포맷으로 통일하세요. 팔레트 폴백으로 렌더링합니다."));
			return;
		}

		UTexture2DArray* TileArray = NewObject<UTexture2DArray>(BuiltTileAtlas, TEXT("TileArray"), RF_Transient);

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

	// 6. 기본 팔레트 텍스처 생성 (8×256 흰색)
	//    GWhiteTexture(1x1)를 팔레트로 사용하면 셰이더의 Load(int3(PaletteIdx, VoxelType, 0))가
	//    VoxelType>0에서 out-of-bounds → (0,0,0,0)을 반환, TileColor * 0 = 검정.
	//    올바른 크기의 흰색 팔레트를 제공하여 PaletteTint = (1,1,1,1) 보장.
	{
		const int32 PW = 8, PH = 256;
		DefaultPaletteTexture = NewObject<UTexture2D>(this, TEXT("DefaultPalette"), RF_Transient);
		FTexturePlatformData* PPD = new FTexturePlatformData();
		PPD->SizeX = PW;
		PPD->SizeY = PH;
		PPD->PixelFormat = PF_B8G8R8A8;
		FTexture2DMipMap* PMip = new FTexture2DMipMap();
		PPD->Mips.Add(PMip);
		PMip->SizeX = PW;
		PMip->SizeY = PH;
		PMip->BulkData.Lock(LOCK_READ_WRITE);
		uint8* PData = static_cast<uint8*>(PMip->BulkData.Realloc(PW * PH * 4));
		FMemory::Memset(PData, 0xFF, PW * PH * 4);
		PMip->BulkData.Unlock();
		DefaultPaletteTexture->SetPlatformData(PPD);
		DefaultPaletteTexture->Filter = TF_Nearest;
		DefaultPaletteTexture->SRGB = false;
		DefaultPaletteTexture->AddressX = TA_Clamp;
		DefaultPaletteTexture->AddressY = TA_Clamp;
		DefaultPaletteTexture->UpdateResource();
	}

	// 7. RHI 리소스 동기 대기 — UpdateResource()는 비동기로 렌더 스레드에서 RHI를 생성하므로,
	//    여기서 Flush하지 않으면 직후 ApplyStyleToComponent에서 GetTileArrayRHI()가 nullptr을
	//    반환한다. PumpStyleTextures가 매 틱 재시도하지만, 이미 메싱이 완료된 청크에
	//    SceneProxy가 재생성되지 않는 한 텍스처를 주입할 기회가 제한적이다.
	//    BeginPlay 초기화 시 1회 Flush로 모든 텍스처 RHI를 확정한다.
	FlushRenderingCommands();

	// 7. RHI 유효성 검증 — TileArray는 UpdateSourceFromSourceTextures 경유로
	//    UE5 텍스처 파이프라인이 비동기 리빌드하여 RHI가 지연될 수 있다.
	//    null이면 경고만 출력하고 계속 진행 — PumpStyleTextures가 매 틱 재시도.
	if (BuiltTileAtlas->TileArray && !BuiltTileAtlas->GetTileArrayRHI())
	{
		UE_LOG(LogHktVoxelTerrain, Warning,
			TEXT("[TerrainStyle] TileArray RHI 미준비 (비동기 빌드 진행 중) — PumpStyleTextures가 재시도합니다."));
	}
	if (!BuiltTileAtlas->GetTileIndexLUTRHI())
	{
		UE_LOG(LogHktVoxelTerrain, Error,
			TEXT("[TerrainStyle] TileIndexLUT RHI 생성 실패. 팔레트 폴백으로 렌더링합니다."));
		return;
	}

	bStyleBuilt = true;

	UE_LOG(LogHktVoxelTerrain, Log,
		TEXT("[TerrainStyle] Built — %d block styles, %d unique textures, %d slices, TileArray=%dx%d %s"),
		BlockStyles.Num(), TextureToSlice.Num(), SliceTextures.Num(),
		SliceTextures.Num() > 0 ? SliceTextures[0]->GetSizeX() : 0,
		SliceTextures.Num() > 0 ? SliceTextures[0]->GetSizeY() : 0,
		SliceTextures.Num() > 0 ? GetPixelFormatString(SliceTextures[0]->GetPixelFormat()) : TEXT("N/A"));
}

// ============================================================================
// IHktHitRefinementProvider — DDA 복셀 레이캐스트로 정밀 히트 보정
// ============================================================================

bool AHktVoxelTerrainActor::RefineHit(
	const FVector& TraceStart,
	const FVector& TraceDir,
	const FHitResult& CoarseHit,
	FHitResult& OutRefinedHit) const
{
	if (!TerrainCache)
	{
		return false;
	}

	const FHktVoxelRaycastResult Result = FHktVoxelRaycast::Trace(
		*TerrainCache, TraceStart, TraceDir, VoxelSize);

	if (!Result.bHit)
	{
		return false;
	}

	// coarse 히트의 Actor/Component 정보를 유지하면서 위치/법선만 갱신
	OutRefinedHit = CoarseHit;
	OutRefinedHit.Location = Result.HitLocation;
	OutRefinedHit.ImpactPoint = Result.HitLocation;
	OutRefinedHit.ImpactNormal = Result.HitNormal;
	OutRefinedHit.Normal = Result.HitNormal;
	OutRefinedHit.Distance = Result.Distance;

	return true;
}

void AHktVoxelTerrainActor::ApplyStyleToComponent(UHktVoxelChunkComponent* Comp)
{
	if (!Comp)
	{
		return;
	}

	if (BuiltTileAtlas)
	{
		FRHITexture* TileArrayRHI = BuiltTileAtlas->GetTileArrayRHI();
		FRHITexture* TileIndexLUTRHI = BuiltTileAtlas->GetTileIndexLUTRHI();

		FHktVoxelTileTextureSet TileSet;
		TileSet.TileArray = { TileArrayRHI,
			TStaticSamplerState<SF_Bilinear, AM_Wrap, AM_Wrap>::GetRHI() };
		TileSet.TileIndexLUT = { TileIndexLUTRHI,
			TStaticSamplerState<SF_Point, AM_Clamp, AM_Clamp>::GetRHI() };

		// 기본 팔레트 (8×256 흰색) — GWhiteTexture OOB 방지
		if (DefaultPaletteTexture && DefaultPaletteTexture->GetResource())
		{
			TileSet.DefaultPalette = { DefaultPaletteTexture->GetResource()->TextureRHI,
				TStaticSamplerState<SF_Point, AM_Clamp, AM_Clamp>::GetRHI() };
		}

		if (TileSet.IsValid())
		{
			Comp->SetTileTextures(TileSet);
		}
		else
		{
			UE_LOG(LogHktVoxelTerrain, Warning,
				TEXT("[ApplyStyle] TileSet 무효 — TileArrayRHI=%p, TileIndexLUTRHI=%p, Chunk=%s"),
				TileArrayRHI, TileIndexLUTRHI, *Comp->GetChunkCoord().ToString());
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
