// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVoxelTerrainActor.h"
#include "HktVoxelChunkLoader.h"
#include "HktVoxelTerrainLog.h"
#include "HktVoxelTerrainStyleSet.h"
#if WITH_EDITOR
#include "HktVoxelTerrainBakeLibrary.h"
#endif
#include "Data/HktVoxelRenderCache.h"
#include "Data/HktVoxelRaycast.h"
#include "Data/HktVoxelTypes.h"
#include "Meshing/HktVoxelMeshScheduler.h"
#include "Rendering/HktVoxelChunkComponent.h"
#include "Rendering/HktVoxelTileAtlas.h"
#include "Rendering/HktVoxelMaterialLUT.h"
#include "HktTerrainGenerator.h"
#include "Terrain/HktTerrainVoxel.h"
#include "Terrain/HktFixed32.h"
#include "LOD/HktVoxelLOD.h"
#include "Settings/HktRuntimeGlobalSetting.h"
#include "Engine/World.h"
#include "Engine/Engine.h"
#include "Engine/Texture2DArray.h"
#include "Engine/Texture2D.h"
#include "EngineUtils.h"
#include "GameFramework/Pawn.h"
#include "GameFramework/PlayerController.h"
#include "HAL/IConsoleManager.h"
#include "RenderingThread.h"
#include "RHIStaticStates.h"
#include "TextureResource.h"
#include "DrawDebugHelpers.h"

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

	// 지형 생성기 초기화
	Generator = MakeUnique<FHktTerrainGenerator>(GenConfig);

	// 청크 로더 초기화 — LoaderType은 BeginPlay 시점에 확정되어 런타임 스왑하지 않는다.
	Loader = CreateVoxelChunkLoader(LoaderType);
	SyncLoaderParams();

	PrewarmPool(InitialPoolSize);

	// 에디터 라이브 토글 감지용 초기값 동기화
	bPrevStylizedRendering = bStylizedRendering;
	bPrevDebugRenderMode = bDebugRenderMode;
	PrevNormalMapStrength = NormalMapStrength;

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

	const TCHAR* LoaderName = (LoaderType == EHktVoxelLoaderType::Legacy)
		? TEXT("Legacy") : TEXT("Proximity");
	UE_LOG(LogHktVoxelTerrain, Log,
		TEXT("Terrain Actor initialized — Seed=%lld, VoxelSize=%.1f, ChunkWorld=%.0f, "
			 "Loader=%s, Pool=%d, MaxLoad=%d/frame, MaxMesh=%d, Style=%s"),
		GenConfig.Seed, VoxelSize, GetChunkWorldSize(),
		LoaderName, InitialPoolSize, MaxLoadsPerFrame, MaxMeshPerFrame,
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
	Loader.Reset();

	Super::EndPlay(EndPlayReason);
}

void AHktVoxelTerrainActor::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);

	if (!TerrainCache || !TerrainMeshScheduler || !Loader || !Generator)
	{
		return;
	}

	const FVector CameraPos = GetCameraWorldPos();

	// 1. 로더 파라미터 동기화 (반경/버짓/높이 등) — UPROPERTY 변경이 즉시 반영되도록.
	SyncLoaderParams();

	// 2. 뷰-독립 스트리밍 업데이트 — 카메라 청크 경계를 넘을 때만 전체 스캔.
	Loader->Update(CameraPos, GetChunkWorldSize());

	// 10초마다 1회 청크 스트리밍 통계 로그 (어떤 규모로 로드 중인지 명확화)
	LogStreamingStatsPeriodic();

	// 3. 스트리밍 결과 반영 (생성 + 로드 + 컴포넌트 할당 + Tier 전이)
	ProcessStreamingResults();

	// 4. 메싱 스케줄링
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

	// 노멀맵 강도 라이브 토글 — 현재 Tier 기준으로 재적용
	const bool bNormalChanged = !FMath::IsNearlyEqual(NormalMapStrength, PrevNormalMapStrength);
	if (bNormalChanged)
	{
		PrevNormalMapStrength = NormalMapStrength;
		const TMap<FIntVector, EHktVoxelChunkTier>& LoadedTiers = Loader->GetLoadedChunks();
		for (auto& Pair : ActiveChunks)
		{
			if (Pair.Value)
			{
				const EHktVoxelChunkTier* TierPtr = LoadedTiers.Find(Pair.Key);
				const EHktVoxelChunkTier Tier = TierPtr ? *TierPtr : EHktVoxelChunkTier::Near;
				ApplyTierToComponent(Pair.Value, Tier);
			}
		}
	}

	// 디버그 렌더 모드 라이브 토글 — 활성 청크 전부에 머티리얼 스왑
	if (bDebugRenderMode != bPrevDebugRenderMode)
	{
		bPrevDebugRenderMode = bDebugRenderMode;
		UMaterialInterface* EffMat = GetEffectiveTerrainMaterial();
		UMaterialInterface* EffWaterMat = GetEffectiveWaterMaterial();
		for (auto& Pair : ActiveChunks)
		{
			if (Pair.Value)
			{
				Pair.Value->SetVoxelMaterial(EffMat);
				Pair.Value->SetWaterMaterial(EffWaterMat);
			}
		}
	}

	// 6. 메싱 완료 청크 → GPU 업로드
	ProcessMeshReadyChunks();

	// 7. 디버그 시각화 — LOD 색상 AABB (bDrawChunkDebug ON 시)
	if (bDrawChunkDebug)
	{
		DrawChunkDebug();
	}
}

void AHktVoxelTerrainActor::DrawChunkDebug() const
{
	UWorld* World = GetWorld();
	if (!World)
	{
		return;
	}

	const float ChunkWorldSize = GetChunkWorldSize();
	if (ChunkWorldSize <= 0.f)
	{
		return;
	}

	if (!Loader)
	{
		return;
	}

	const FVector Extent(ChunkWorldSize * 0.5f);
	const FTransform ActorXform = GetActorTransform();

	// Tier 색상: Near=녹 / Far=주황
	static const FColor TierColors[2] = {
		FColor(0, 255, 0),
		FColor(255, 128, 0),
	};

	const TMap<FIntVector, EHktVoxelChunkTier>& LoadedTiers = Loader->GetLoadedChunks();

	for (const TPair<FIntVector, UHktVoxelChunkComponent*>& Pair : ActiveChunks)
	{
		const FIntVector& Coord = Pair.Key;
		const UHktVoxelChunkComponent* Comp = Pair.Value;
		if (!Comp)
		{
			continue;
		}

		const EHktVoxelChunkTier* TierPtr = LoadedTiers.Find(Coord);
		const int32 TierIdx = TierPtr
			? FMath::Clamp(static_cast<int32>(*TierPtr), 0, 1)
			: 0;
		const FColor& Color = TierColors[TierIdx];

		const FVector LocalCenter(
			(Coord.X + 0.5f) * ChunkWorldSize,
			(Coord.Y + 0.5f) * ChunkWorldSize,
			(Coord.Z + 0.5f) * ChunkWorldSize);
		const FVector WorldCenter = ActorXform.TransformPosition(LocalCenter);

		DrawDebugBox(World, WorldCenter, Extent, Color,
			/*bPersistent=*/false, /*Lifetime=*/-1.f,
			/*DepthPriority=*/0, ChunkDebugDrawThickness);

		if (bDrawChunkDebugLabels)
		{
			const TCHAR* TierName = (TierIdx == 0) ? TEXT("Near") : TEXT("Far");
			const FString Label = FString::Printf(
				TEXT("%s\n(%d,%d,%d)"),
				TierName, Coord.X, Coord.Y, Coord.Z);
			DrawDebugString(World, WorldCenter, Label,
				/*TestBaseActor=*/nullptr, Color,
				/*Duration=*/0.f, /*bDrawShadow=*/true);
		}
	}
}

void AHktVoxelTerrainActor::LogStreamingStatsPeriodic()
{
	if (StatsLogInterval <= 0.f || !Loader)
	{
		return;
	}

	const UWorld* World = GetWorld();
	if (!World)
	{
		return;
	}
	const float Now = World->GetTimeSeconds();
	if (Now < NextStatsLogTime)
	{
		return;
	}
	NextStatsLogTime = Now + StatsLogInterval;

	// 청크당 크기
	const int32 VoxelsPerAxis = FHktVoxelChunk::SIZE;
	const int32 VoxelsPerChunk = VoxelsPerAxis * VoxelsPerAxis * VoxelsPerAxis;
	const float ChunkWorldCm = GetChunkWorldSize();
	constexpr int32 BytesPerVoxel = 4;
	const int32 KBytesPerChunkData = (VoxelsPerChunk * BytesPerVoxel) / 1024;

	// Tier 분포
	int32 TierCounts[2] = { 0, 0 };
	Loader->GetTierHistogram(TierCounts);
	const int32 TotalLoaded = TierCounts[0] + TierCounts[1];
	const int32 ActiveComps = ActiveChunks.Num();

	// 예상 스캔 셀 수 (로더별 외곽 반경)
	const float OuterCm = (LoaderType == EHktVoxelLoaderType::Legacy)
		? LegacyStreamRadius
		: ProximityFarRadius;
	const int32 OuterRadiusChunks = FMath::CeilToInt(OuterCm / FMath::Max(1.f, ChunkWorldCm));
	const int32 ScanCells = (2 * OuterRadiusChunks + 1) * (2 * OuterRadiusChunks + 1);

	const TCHAR* LoaderName = (LoaderType == EHktVoxelLoaderType::Legacy)
		? TEXT("Legacy") : TEXT("Proximity");

	UE_LOG(LogHktVoxelTerrain, Log,
		TEXT("[Terrain Stats] Loader=%s, Loaded=%d (Near=%d, Far=%d), ActiveComps=%d | "
			 "Chunk=%dx%dx%d voxels = %.0fx%.0fcm = %d KB data | "
			 "OuterRadius=%d chunks (%.0fm), ScanCells/rebuild=%d | "
			 "Budget=%d/frame, Mesh=%d/frame, MaxLoaded=%d"),
		LoaderName, TotalLoaded, TierCounts[0], TierCounts[1], ActiveComps,
		VoxelsPerAxis, VoxelsPerAxis, VoxelsPerAxis,
		ChunkWorldCm, ChunkWorldCm, KBytesPerChunkData,
		OuterRadiusChunks, OuterCm / 100.f, ScanCells,
		MaxLoadsPerFrame, MaxMeshPerFrame, MaxLoadedChunks);
}

void AHktVoxelTerrainActor::GetTierHistogram(int32 OutCounts[2]) const
{
	if (Loader)
	{
		Loader->GetTierHistogram(OutCounts);
	}
	else
	{
		OutCounts[0] = OutCounts[1] = 0;
	}
}

UMaterialInterface* AHktVoxelTerrainActor::GetEffectiveTerrainMaterial() const
{
	// 디버그 모드 — DebugRenderMaterial 우선. 미할당이면 자동 생성된 Wireframe+Unlit 머티리얼 사용.
	if (bDebugRenderMode)
	{
		if (DebugRenderMaterial)
		{
			return DebugRenderMaterial;
		}
		return UHktVoxelChunkComponent::GetDebugWireframeMaterial();
	}
	// TerrainMaterial이 명시적으로 할당되면 그대로 사용.
	// 미할당이면 nullptr 반환 — ChunkComponent의 기본 VertexColor 머티리얼이 사용됨.
	return TerrainMaterial;
}

UMaterialInterface* AHktVoxelTerrainActor::GetEffectiveWaterMaterial() const
{
	// 디버그 모드에서는 워터도 같은 디버그 머티리얼로 — 경계가 혼동되지 않도록.
	if (bDebugRenderMode)
	{
		return GetEffectiveTerrainMaterial();
	}
	return WaterMaterial;
}

FVector AHktVoxelTerrainActor::GetCameraWorldPos() const
{
	// 스트리밍 포커스는 "카메라 자체 위치"가 아니라 "플레이어가 있는 곳".
	// 이소/탑다운 RTS 카메라는 피사체에서 수십 미터 떨어져 배치되므로 카메라 좌표를
	// 쓰면 화면 중앙 지형이 전부 Far tier로 밀려난다. Pawn이 있으면 Pawn 위치를 쓰고,
	// 없으면(관전/스폰 전 등) 카메라 뷰포인트로 폴백.
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

void AHktVoxelTerrainActor::SyncLoaderParams()
{
	if (!Loader)
	{
		return;
	}
	FHktVoxelLoaderConfig Cfg;
	Cfg.PrimaryRadius = (LoaderType == EHktVoxelLoaderType::Legacy)
		? LegacyStreamRadius
		: ProximityNearRadius;
	Cfg.SecondaryRadius = ProximityFarRadius;  // Legacy는 무시
	Cfg.MaxLoadsPerFrame = MaxLoadsPerFrame;
	Cfg.MaxLoadedChunks = MaxLoadedChunks;
	Cfg.HeightMinZ = HeightMinZ;
	Cfg.HeightMaxZ = HeightMaxZ;
	Loader->Configure(Cfg);
}

void AHktVoxelTerrainActor::GenerateAndLoadChunk(const FIntVector& ChunkCoord)
{
	GenerateAndLoadChunk(ChunkCoord, EHktVoxelChunkTier::Near);
}

void AHktVoxelTerrainActor::GenerateAndLoadChunk(const FIntVector& ChunkCoord, EHktVoxelChunkTier Tier)
{
	// 절차적 생성 (힙 할당 — 128KB는 워커 스레드 스택에 위험)
	constexpr int32 ChunkVoxelCount = 32 * 32 * 32;
	TArray<FHktTerrainVoxel> GeneratedVoxels;
	GeneratedVoxels.SetNumUninitialized(ChunkVoxelCount);
	Generator->GenerateChunk(ChunkCoord.X, ChunkCoord.Y, ChunkCoord.Z, GeneratedVoxels.GetData());

	// FHktTerrainVoxel → FHktVoxel (동일 4바이트 레이아웃)
	const FHktVoxel* VoxelData = reinterpret_cast<const FHktVoxel*>(GeneratedVoxels.GetData());
	TerrainCache->LoadChunk(ChunkCoord, VoxelData, ChunkVoxelCount);

	// Tier와 무관하게 모든 청크는 LOD 0으로 메싱 (LOD 다운샘플은 인접 청크와의 실루엣 불일치로
	// 크랙이 발생하므로 폐기). Tier 차이는 콜리전/그림자/노말맵으로만 반영된다.
	if (FHktVoxelChunkRef ChunkRef = TerrainCache->GetChunkRef(ChunkCoord))
	{
		ChunkRef->RequestedLOD.store(0, std::memory_order_release);
	}

	AcquireAndConfigureComponent(ChunkCoord, Tier);
}

UHktVoxelChunkComponent* AHktVoxelTerrainActor::AcquireAndConfigureComponent(const FIntVector& ChunkCoord, EHktVoxelChunkTier Tier)
{
	UHktVoxelChunkComponent* Comp = AcquireComponent();
	if (!Comp)
	{
		return nullptr;
	}
	Comp->Initialize(TerrainCache.Get(), ChunkCoord, VoxelSize);
	Comp->SetStylizedRendering(bStylizedRendering);
	Comp->SetVoxelMaterial(GetEffectiveTerrainMaterial());
	Comp->SetWaterMaterial(GetEffectiveWaterMaterial());
	ApplyTierToComponent(Comp, Tier);
	if (bStyleBuilt)
	{
		ApplyStyleToComponent(Comp);
	}
	ActiveChunks.Add(ChunkCoord, Comp);
	return Comp;
}

void AHktVoxelTerrainActor::RetierChunk(const FIntVector& ChunkCoord, EHktVoxelChunkTier NewTier)
{
	// 모든 tier가 LOD 0을 공유하므로 메시 재생성은 불필요 — 컴포넌트 설정만 갱신.
	if (UHktVoxelChunkComponent** Found = ActiveChunks.Find(ChunkCoord))
	{
		ApplyTierToComponent(*Found, NewTier);
	}
}

void AHktVoxelTerrainActor::ApplyTierToComponent(UHktVoxelChunkComponent* Comp, EHktVoxelChunkTier Tier)
{
	if (!Comp)
	{
		return;
	}
	// Tier별 고정 프리셋:
	//  Near: 풀 노멀맵 + 그림자 ON + 콜리전 ON
	//  Far : 노멀맵 OFF + 그림자 OFF + 콜리전 OFF
	FHktVoxelLODComponentSettings Settings;
	switch (Tier)
	{
		case EHktVoxelChunkTier::Near:
			Settings.NormalMapScale = 1.0f;
			Settings.ShadowDistance = 0.0f;   // 0 = 항상 ON
			Settings.bCastShadow = true;
			Settings.bCollision = true;
			break;
		case EHktVoxelChunkTier::Far:
		default:
			Settings.NormalMapScale = 0.0f;
			Settings.ShadowDistance = 0.0f;
			Settings.bCastShadow = false;
			Settings.bCollision = false;
			break;
	}

	Comp->SetChunkLOD(0, Settings, NormalMapStrength);
}

void AHktVoxelTerrainActor::ProcessStreamingResults()
{
	const TArray<FIntVector>& ToUnload = Loader->GetChunksToUnload();
	const TArray<FHktChunkTierRequest>& ToLoad = Loader->GetChunksToLoad();
	const TArray<FHktChunkTierRequest>& ToRetier = Loader->GetChunksToRetier();

	auto TierName = [](EHktVoxelChunkTier T) { return T == EHktVoxelChunkTier::Near ? TEXT("Near") : TEXT("Far"); };

	// 언로드 — 태스크가 TSharedPtr<FHktVoxelChunk>를 캡처하므로 Flush 불필요.
	// UnloadChunk은 맵에서 제거만 하고, 실제 메모리는 태스크의 TSharedPtr 해제 시 반환.
	for (const FIntVector& Coord : ToUnload)
	{
		if (bLogChunkEvents)
		{
			UE_LOG(LogHktVoxelTerrain, Log,
				TEXT("[Chunk UNLOAD] coord=(%d,%d,%d)"),
				Coord.X, Coord.Y, Coord.Z);
		}

		TerrainCache->UnloadChunk(Coord);

		if (UHktVoxelChunkComponent** Found = ActiveChunks.Find(Coord))
		{
			ReleaseComponent(*Found);
			ActiveChunks.Remove(Coord);
		}
	}

	// 로드: 로더가 요청한 청크를 절차적 생성 → RenderCache 로드 → 컴포넌트 할당
	int32 LoadedCount = 0;
	for (const FHktChunkTierRequest& Req : ToLoad)
	{
		if (ActiveChunks.Contains(Req.Coord))
		{
			continue;
		}

		if (bLogChunkEvents)
		{
			UE_LOG(LogHktVoxelTerrain, Log,
				TEXT("[Chunk LOAD] coord=(%d,%d,%d) tier=%s"),
				Req.Coord.X, Req.Coord.Y, Req.Coord.Z, TierName(Req.Tier));
		}

		GenerateAndLoadChunk(Req.Coord, Req.Tier);
		++LoadedCount;
	}

	// Retier: 이미 로드된 청크의 Tier만 변경 (Voxel 데이터 보존, 메시 + 컴포넌트 설정 갱신)
	for (const FHktChunkTierRequest& Req : ToRetier)
	{
		if (bLogChunkEvents)
		{
			UE_LOG(LogHktVoxelTerrain, Log,
				TEXT("[Chunk RETIER] coord=(%d,%d,%d) -> tier=%s"),
				Req.Coord.X, Req.Coord.Y, Req.Coord.Z, TierName(Req.Tier));
		}

		RetierChunk(Req.Coord, Req.Tier);
	}

	if (bLogChunkEvents
		&& (LoadedCount + ToUnload.Num() + ToRetier.Num()) > 0)
	{
		UE_LOG(LogHktVoxelTerrain, Log,
			TEXT("[Chunk Tick] Load=%d Unload=%d Retier=%d | Active=%d"),
			LoadedCount, ToUnload.Num(), ToRetier.Num(), ActiveChunks.Num());
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

	if (Loader)
	{
		const TMap<FIntVector, EHktVoxelChunkTier>& Loaded = Loader->GetLoadedChunks();
		if (const EHktVoxelChunkTier* TierPtr = Loaded.Find(ChunkCoord))
		{
			const EHktVoxelChunkTier Tier = *TierPtr;
			if (FHktVoxelChunkRef ChunkRef = TerrainCache->GetChunkRef(ChunkCoord))
			{
				ChunkRef->RequestedLOD.store(0, std::memory_order_release);
			}

			if (!ActiveChunks.Contains(ChunkCoord))
			{
				AcquireAndConfigureComponent(ChunkCoord, Tier);
			}
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

	// 우선순위 1) BakedStyleSet — DDC 컴파일 미경유, 단순 자산 적용.
	//   에디터-타임에 베이크된 Texture2DArray 를 그대로 참조하므로
	//   TextureDerivedData 워커 메모리 폭증 (~1 GiB+) 회피.
	if (BakedStyleSet && BakedStyleSet->HasBakedData())
	{
		BuiltTileAtlas = NewObject<UHktVoxelTileAtlas>(this, TEXT("BuiltTileAtlas"), RF_Transient);
		BuiltMaterialLUT = NewObject<UHktVoxelMaterialLUT>(this, TEXT("BuiltMaterialLUT"), RF_Transient);
		BakedStyleSet->ApplyTo(BuiltTileAtlas, BuiltMaterialLUT);

		// 기본 팔레트 텍스처 (8×256 흰색) — GWhiteTexture OOB 방지용. Build 경로와 동일.
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

		// 작은 LUT 들의 RHI 준비를 BeginPlay 직후 보장 — 텍스처 배열은 이미
		// cooked 상태로 로드되었으므로 여기서 flush 비용은 LUT(8×256, 256×3) 만큼만 든다.
		FlushRenderingCommands();

		bStyleBuilt = true;
		UE_LOG(LogHktVoxelTerrain, Log,
			TEXT("[TerrainStyle] BakedStyleSet 적용 — '%s' (%d styles, %d slices)"),
			*BakedStyleSet->GetName(),
			BakedStyleSet->SourceBlockStyleCount, BakedStyleSet->SliceCount);
		return;
	}

	if (BlockStyles.Num() == 0)
	{
		UE_LOG(LogHktVoxelTerrain, Log, TEXT("[TerrainStyle] BlockStyles is empty — using palette fallback"));
		return;
	}

	// 폴백: 런타임 빌드 경로. BCn DDC 컴파일이 발생하므로 텍스처 수/해상도가
	// 크면 TextureDerivedData 워커 메모리 한계(~982 MiB)를 초과할 수 있다.
	// 프로덕션은 BakeStyleSet 버튼으로 베이크된 BakedStyleSet 사용을 권장.
	UE_LOG(LogHktVoxelTerrain, Warning,
		TEXT("[TerrainStyle] BakedStyleSet 미할당 — BlockStyles 직접 빌드 경로 사용. "
			 "텍스처 수/해상도가 크면 DDC 컴파일 메모리 폭증 위험. "
			 "Details 패널의 BakeStyleSet 버튼으로 자산을 생성하세요."));

	// 1. 고유 텍스처 수집 → 슬라이스 인덱스 할당 (BaseColor 키 + 병렬 Normal 트래킹)
	//    같은 BaseColor에 서로 다른 Normal이 매핑되면 첫 번째 값을 유지하고 경고.
	//    null로 시작한 슬롯은 이후 non-null Normal이 들어오면 승격(promote).
	TMap<UTexture2D*, uint8> TextureToSlice;
	TArray<UTexture2D*> SliceTextures;  // 인덱스 순서
	TArray<UTexture2D*> SliceNormals;   // 병렬 배열 — null = 해당 슬라이스 노멀 없음

	auto AssignSlice = [&](UTexture2D* Base, UTexture2D* Normal) -> uint8
	{
		if (!Base)
		{
			return 255;  // 미매핑 → 팔레트 폴백
		}
		if (const uint8* Found = TextureToSlice.Find(Base))
		{
			const uint8 Idx = *Found;
			// 병렬 배열에서 기존 Normal과 비교 — null 승격 or 충돌 경고
			if (Normal)
			{
				if (!SliceNormals[Idx])
				{
					SliceNormals[Idx] = Normal;  // null → 구체화
				}
				else if (SliceNormals[Idx] != Normal)
				{
					UE_LOG(LogHktVoxelTerrain, Warning,
						TEXT("[TerrainStyle] Base 텍스처 %s는 슬라이스 %d에 이미 Normal=%s가 할당됨 — 새 Normal=%s는 무시됨."),
						*Base->GetName(), Idx,
						*SliceNormals[Idx]->GetName(), *Normal->GetName());
				}
			}
			return Idx;
		}
		if (SliceTextures.Num() >= 255)
		{
			UE_LOG(LogHktVoxelTerrain, Warning, TEXT("[TerrainStyle] Too many unique textures (max 255)"));
			return 255;
		}
		const uint8 Idx = static_cast<uint8>(SliceTextures.Num());
		TextureToSlice.Add(Base, Idx);
		SliceTextures.Add(Base);
		SliceNormals.Add(Normal);
		return Idx;
	};

	// 2. TileAtlas 생성 + 매핑
	BuiltTileAtlas = NewObject<UHktVoxelTileAtlas>(this, TEXT("BuiltTileAtlas"), RF_Transient);

	for (const FHktVoxelBlockStyle& Style : BlockStyles)
	{
		// BaseColor: Top이 없으면 Side로 폴백. Bottom도 동일.
		UTexture2D* TopTex = Style.TopTexture ? Style.TopTexture.Get() : Style.SideTexture.Get();
		UTexture2D* SideTex = Style.SideTexture.Get();
		UTexture2D* BottomTex = Style.BottomTexture ? Style.BottomTexture.Get() : SideTex;

		// Normal도 대응하는 BaseColor의 폴백 규칙을 따른다 —
		// Top이 Side로 폴백되면 TopNormal도 SideNormal로 폴백 (같은 텍스처 쌍 유지).
		UTexture2D* TopNorm = Style.TopTexture ? Style.TopNormal.Get() : Style.SideNormal.Get();
		UTexture2D* SideNorm = Style.SideNormal.Get();
		UTexture2D* BottomNorm = Style.BottomTexture ? Style.BottomNormal.Get() : Style.SideNormal.Get();

		const uint8 TopSlice = AssignSlice(TopTex, TopNorm);
		const uint8 SideSlice = AssignSlice(SideTex, SideNorm);
		const uint8 BottomSlice = AssignSlice(BottomTex, BottomNorm);

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

	// 3b. NormalArray 빌드 (선택) — TileArray와 동일 슬라이스 레이아웃.
	//     MVP 정책: all-or-nothing. 일부 슬라이스만 노멀이 있으면 전체 스킵 + 경고.
	//     이유: 누락 슬라이스에 플레이스홀더를 삽입하려면 참조 포맷이 BC5인 경우
	//     프로시저럴 생성이 복잡해진다. 아티스트가 명시적으로 모든 텍스처를 제공하도록 강제.
	if (SliceNormals.Num() > 0)
	{
		int32 NumProvided = 0;
		int32 FirstMissingIdx = INDEX_NONE;
		for (int32 i = 0; i < SliceNormals.Num(); i++)
		{
			if (SliceNormals[i]) { NumProvided++; }
			else if (FirstMissingIdx == INDEX_NONE) { FirstMissingIdx = i; }
		}

		if (NumProvided == 0)
		{
			UE_LOG(LogHktVoxelTerrain, Log,
				TEXT("[TerrainStyle] 노멀맵 미구성 — 플랫 노멀로 렌더링 (%d 슬라이스)"),
				SliceNormals.Num());
		}
		else if (NumProvided < SliceNormals.Num())
		{
			UE_LOG(LogHktVoxelTerrain, Warning,
				TEXT("[TerrainStyle] 노멀맵 부분 구성 (%d/%d) — NormalArray 빌드 스킵. "
					 "최초 누락 슬라이스[%d]=%s (BaseColor). "
					 "모든 BlockStyle에 Top/Side/BottomNormal을 설정하거나 전부 비워 두세요."),
				NumProvided, SliceNormals.Num(),
				FirstMissingIdx,
				*SliceTextures[FirstMissingIdx]->GetName());
		}
		else
		{
			// 모든 슬라이스에 노멀 제공됨 — 포맷/크기 호환성 검증 후 빌드
			const int32 NormSizeX = SliceNormals[0]->GetSizeX();
			const int32 NormSizeY = SliceNormals[0]->GetSizeY();
			const EPixelFormat NormFormat = SliceNormals[0]->GetPixelFormat();
			bool bNormalCompatible = true;

			for (int32 i = 1; i < SliceNormals.Num(); i++)
			{
				UTexture2D* N = SliceNormals[i];
				if (N->GetSizeX() != NormSizeX || N->GetSizeY() != NormSizeY)
				{
					UE_LOG(LogHktVoxelTerrain, Error,
						TEXT("[TerrainStyle] 노멀 텍스처 크기 불일치 — [0]=%dx%d, [%d](%s)=%dx%d"),
						NormSizeX, NormSizeY, i, *N->GetName(),
						N->GetSizeX(), N->GetSizeY());
					bNormalCompatible = false;
				}
				if (N->GetPixelFormat() != NormFormat)
				{
					UE_LOG(LogHktVoxelTerrain, Error,
						TEXT("[TerrainStyle] 노멀 텍스처 포맷 불일치 — [0]=%s, [%d](%s)=%s"),
						GetPixelFormatString(NormFormat), i, *N->GetName(),
						GetPixelFormatString(N->GetPixelFormat()));
					bNormalCompatible = false;
				}
			}

			// SRGB=true는 노멀맵에서 잘못된 설정 — 경고만 출력 (포맷 변환은 엔진이 자동).
			for (UTexture2D* N : SliceNormals)
			{
				if (N->SRGB)
				{
					UE_LOG(LogHktVoxelTerrain, Warning,
						TEXT("[TerrainStyle] 노멀 텍스처 %s에 SRGB=true 설정됨. "
							 "노멀맵은 Linear 데이터이므로 에셋에서 sRGB=off + TC_Normalmap 권장."),
						*N->GetName());
				}
			}

			if (bNormalCompatible)
			{
				UTexture2DArray* NArray = NewObject<UTexture2DArray>(
					BuiltTileAtlas, TEXT("NormalArray"), RF_Transient);
				NArray->SourceTextures.Empty();
				for (UTexture2D* N : SliceNormals)
				{
					NArray->SourceTextures.Add(N);
				}
				NArray->AddressX = TA_Wrap;
				NArray->AddressY = TA_Wrap;
				NArray->SRGB = false;  // 노멀맵은 항상 linear
				NArray->UpdateSourceFromSourceTextures(true);
				NArray->UpdateResource();

				BuiltTileAtlas->NormalArray = NArray;
			}
		}
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
		FRHITexture* NormalArrayRHI = BuiltTileAtlas->GetNormalArrayRHI();

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

		// NormalArray는 옵션 — 빌드되지 않았으면 null로 남아 셰이더가 플랫 노멀 폴백
		if (NormalArrayRHI)
		{
			TileSet.NormalArray = { NormalArrayRHI,
				TStaticSamplerState<SF_Bilinear, AM_Wrap, AM_Wrap>::GetRHI() };
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

// ============================================================================
// 콘솔 명령 — hkt.terrain.debug 0|1, hkt.terrain.debug.radius N
// 실제 AHktVoxelTerrainActor 파이프라인(생성+메싱) 그대로 사용, 머티리얼·스트리밍 반경만 조정
// ============================================================================

namespace
{
	TArray<AHktVoxelTerrainActor*> FindTerrainActors()
	{
		TArray<AHktVoxelTerrainActor*> Out;
		if (!GEngine)
		{
			return Out;
		}
		for (const FWorldContext& Ctx : GEngine->GetWorldContexts())
		{
			if ((Ctx.WorldType != EWorldType::Game && Ctx.WorldType != EWorldType::PIE) || !Ctx.World())
			{
				continue;
			}
			for (TActorIterator<AHktVoxelTerrainActor> It(Ctx.World()); It; ++It)
			{
				if (IsValid(*It))
				{
					Out.Add(*It);
				}
			}
		}
		return Out;
	}

	void Cmd_TerrainDebug(const TArray<FString>& Args)
	{
		auto Actors = FindTerrainActors();
		if (Actors.Num() == 0)
		{
			UE_LOG(LogConsoleResponse, Warning, TEXT("[Terrain] AHktVoxelTerrainActor 없음"));
			return;
		}
		const bool bHasArg = Args.Num() >= 1;
		const bool bForceOn = bHasArg && FCString::Atoi(*Args[0]) != 0;
		for (AHktVoxelTerrainActor* A : Actors)
		{
			const bool bNext = bHasArg ? bForceOn : !A->bDebugRenderMode;
			A->bDebugRenderMode = bNext;
			UE_LOG(LogConsoleResponse, Display,
				TEXT("[Terrain] %s debug=%d"),
				*A->GetName(), bNext ? 1 : 0);
		}
	}

	// === 로더 파라미터 / 통계 ===
	// 로더 종류(LoaderType)는 BeginPlay 시점에 확정되어 런타임에 바꾸지 않는다.
	// 에디터 UPROPERTY로 변경 후 PIE 재시작해서 적용한다.

	void Cmd_TerrainProximityRadii(const TArray<FString>& Args)
	{
		if (Args.Num() < 2)
		{
			UE_LOG(LogConsoleResponse, Display,
				TEXT("Usage: hkt.terrain.proximity <NearCm> <FarCm> — Proximity 로더 반경"));
			return;
		}
		const float Near = FMath::Max(1.f, FCString::Atof(*Args[0]));
		const float Far = FMath::Max(Near + 1.f, FCString::Atof(*Args[1]));
		auto Actors = FindTerrainActors();
		for (AHktVoxelTerrainActor* A : Actors)
		{
			A->ProximityNearRadius = Near;
			A->ProximityFarRadius = Far;
			UE_LOG(LogConsoleResponse, Display,
				TEXT("[Terrain] %s Proximity radii = [Near=%.0fcm, Far=%.0fcm]"),
				*A->GetName(), Near, Far);
		}
	}

	void Cmd_TerrainLegacyRadius(const TArray<FString>& Args)
	{
		if (Args.Num() < 1)
		{
			UE_LOG(LogConsoleResponse, Display,
				TEXT("Usage: hkt.terrain.legacy.radius <Cm> — Legacy 로더 반경"));
			return;
		}
		const float R = FMath::Max(1.f, FCString::Atof(*Args[0]));
		auto Actors = FindTerrainActors();
		for (AHktVoxelTerrainActor* A : Actors)
		{
			A->LegacyStreamRadius = R;
			UE_LOG(LogConsoleResponse, Display,
				TEXT("[Terrain] %s Legacy radius = %.0fcm"), *A->GetName(), R);
		}
	}

	void Cmd_TerrainStats(const TArray<FString>&)
	{
		auto Actors = FindTerrainActors();
		if (Actors.Num() == 0)
		{
			UE_LOG(LogConsoleResponse, Warning, TEXT("[Terrain] AHktVoxelTerrainActor 없음"));
			return;
		}
		for (AHktVoxelTerrainActor* A : Actors)
		{
			int32 TierCount[2] = { 0, 0 };
			A->GetTierHistogram(TierCount);
			const int32 Total = TierCount[0] + TierCount[1];
			const TCHAR* Name = (A->LoaderType == EHktVoxelLoaderType::Legacy)
				? TEXT("Legacy") : TEXT("Proximity");
			UE_LOG(LogConsoleResponse, Display,
				TEXT("[Terrain] %s — Loader=%s, Near=%d, Far=%d (Total=%d), Budget=%d/frame, MaxLoaded=%d"),
				*A->GetName(), Name, TierCount[0], TierCount[1], Total,
				A->MaxLoadsPerFrame, A->MaxLoadedChunks);
		}
	}

	FAutoConsoleCommand CmdTerrainDebug(
		TEXT("hkt.terrain.debug"),
		TEXT("Terrain 디버그 렌더 모드. 인자: 0=끔, 1=켬. 없으면 토글. "
			"DebugRenderMaterial로 교체 (생성/메싱 파이프라인은 그대로)."),
		FConsoleCommandWithArgsDelegate::CreateStatic(&Cmd_TerrainDebug));

	FAutoConsoleCommand CmdTerrainProximityRadii(
		TEXT("hkt.terrain.proximity"),
		TEXT("Proximity 로더 반경 설정. 예: hkt.terrain.proximity 1500 8000 (Near=15m, Far=80m)"),
		FConsoleCommandWithArgsDelegate::CreateStatic(&Cmd_TerrainProximityRadii));

	FAutoConsoleCommand CmdTerrainLegacyRadius(
		TEXT("hkt.terrain.legacy.radius"),
		TEXT("Legacy 로더 반경 설정. 예: hkt.terrain.legacy.radius 8000 (80m)"),
		FConsoleCommandWithArgsDelegate::CreateStatic(&Cmd_TerrainLegacyRadius));

	FAutoConsoleCommand CmdTerrainStats(
		TEXT("hkt.terrain.stats"),
		TEXT("현재 Tier별 활성 청크 수와 프레임 버짓 출력."),
		FConsoleCommandWithArgsDelegate::CreateStatic(&Cmd_TerrainStats));

	// === 청크 이벤트 로그 / DrawDebug 토글 ===

	void Cmd_TerrainLogChunks(const TArray<FString>& Args)
	{
		auto Actors = FindTerrainActors();
		if (Actors.Num() == 0)
		{
			UE_LOG(LogConsoleResponse, Warning, TEXT("[Terrain] AHktVoxelTerrainActor 없음"));
			return;
		}
		const bool bHasArg = Args.Num() >= 1;
		const bool bForceOn = bHasArg && FCString::Atoi(*Args[0]) != 0;
		for (AHktVoxelTerrainActor* A : Actors)
		{
			const bool bNext = bHasArg ? bForceOn : !A->bLogChunkEvents;
			A->bLogChunkEvents = bNext;
			UE_LOG(LogConsoleResponse, Display,
				TEXT("[Terrain] %s LogChunkEvents=%s"),
				*A->GetName(), bNext ? TEXT("ON") : TEXT("OFF"));
		}
	}

	void Cmd_TerrainDebugDraw(const TArray<FString>& Args)
	{
		auto Actors = FindTerrainActors();
		if (Actors.Num() == 0)
		{
			UE_LOG(LogConsoleResponse, Warning, TEXT("[Terrain] AHktVoxelTerrainActor 없음"));
			return;
		}
		const bool bHasArg = Args.Num() >= 1;
		const bool bForceOn = bHasArg && FCString::Atoi(*Args[0]) != 0;
		const bool bHasLabelArg = Args.Num() >= 2;
		const bool bForceLabels = bHasLabelArg && FCString::Atoi(*Args[1]) != 0;
		for (AHktVoxelTerrainActor* A : Actors)
		{
			const bool bNext = bHasArg ? bForceOn : !A->bDrawChunkDebug;
			A->bDrawChunkDebug = bNext;
			if (bHasLabelArg)
			{
				A->bDrawChunkDebugLabels = bForceLabels;
			}
			UE_LOG(LogConsoleResponse, Display,
				TEXT("[Terrain] %s DrawChunkDebug=%s (Labels=%s)"),
				*A->GetName(),
				bNext ? TEXT("ON") : TEXT("OFF"),
				A->bDrawChunkDebugLabels ? TEXT("ON") : TEXT("OFF"));
		}
	}

	FAutoConsoleCommand CmdTerrainLogChunks(
		TEXT("hkt.terrain.log.chunks"),
		TEXT("청크 단위 LOAD/UNLOAD/RETUNE 이벤트 로그. 인자: 0=끔, 1=켬, 없으면 토글."),
		FConsoleCommandWithArgsDelegate::CreateStatic(&Cmd_TerrainLogChunks));

	FAutoConsoleCommand CmdTerrainDebugDraw(
		TEXT("hkt.terrain.debug.draw"),
		TEXT("활성 청크 AABB를 LOD 색상(0=녹/1=노랑/2=주황/3=빨강)으로 DrawDebug. "
			 "인자: [0|1] [labels:0|1]. 예: hkt.terrain.debug.draw 1 1"),
		FConsoleCommandWithArgsDelegate::CreateStatic(&Cmd_TerrainDebugDraw));
}

#if WITH_EDITOR
void AHktVoxelTerrainActor::BakeStyleSet()
{
	if (BlockStyles.Num() == 0)
	{
		UE_LOG(LogHktVoxelTerrain, Error,
			TEXT("[TerrainActor] BakeStyleSet: BlockStyles 가 비어있습니다."));
		return;
	}

	if (BakeStyleSetSavePath.IsEmpty() || !BakeStyleSetSavePath.StartsWith(TEXT("/")))
	{
		UE_LOG(LogHktVoxelTerrain, Error,
			TEXT("[TerrainActor] BakeStyleSet: BakeStyleSetSavePath '%s' 가 잘못됨 — '/Game/...' 형식 필요"),
			*BakeStyleSetSavePath);
		return;
	}

	UHktVoxelTerrainStyleSet* NewAsset =
		UHktVoxelTerrainBakeLibrary::BakeStyleSet(BlockStyles, BakeStyleSetSavePath);

	if (NewAsset)
	{
		BakedStyleSet = NewAsset;
		Modify();
		UE_LOG(LogHktVoxelTerrain, Log,
			TEXT("[TerrainActor] BakeStyleSet 성공 — BakedStyleSet 에 자동 할당됨: '%s'"),
			*NewAsset->GetPathName());
	}
}
#endif
