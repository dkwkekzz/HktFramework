// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVoxelTerrainActor.h"
#include "HktTerrainChunkLoader.h"
#include "HktVoxelTerrainLog.h"
#include "HktVoxelTerrainStyleSet.h"
#include "Data/HktVoxelRenderCache.h"
#include "Data/HktVoxelRaycast.h"
#include "Data/HktVoxelTypes.h"
#include "Meshing/HktVoxelMeshScheduler.h"
#include "Rendering/HktVoxelChunkComponent.h"
#include "Rendering/HktVoxelTileAtlas.h"
#include "Rendering/HktVoxelMaterialLUT.h"
#include "HktTerrainSubsystem.h"
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

	// 지형 스케일/형태의 런타임 단일 출처는 baked asset(Subsystem effective config)이다.
	// 글로벌 설정은 Subsystem 부재(테스트/스탠드얼론) 시 폴백으로만 읽는다 — baked 와 갈라지지 않게.
	UHktTerrainSubsystem* Sub = UHktTerrainSubsystem::Get(this);
	const FHktTerrainGeneratorConfig GenConfig = Sub
		? Sub->GetEffectiveConfig()
		: GetDefault<UHktRuntimeGlobalSetting>()->ToTerrainConfig();

	// 테레인 전용 파이프라인 생성
	TerrainCache = MakeUnique<FHktVoxelRenderCache>();
	TerrainMeshScheduler = MakeUnique<FHktVoxelMeshScheduler>(TerrainCache.Get());
	TerrainMeshScheduler->SetMaxMeshPerFrame(MaxMeshPerFrame);
	TerrainMeshScheduler->SetDoubleSided(false);  // terrain은 단면 렌더링 — 삼각형 수 절반

	// VoxelSize / Height 범위를 effective config 로 적용 (scheduler 생성 후 — SetVoxelSize 포함).
	ApplyTerrainConfigScale(GenConfig);

	// 청크 데이터는 UHktTerrainSubsystem 이 단일 출처. Actor 는 직접 Generator 를 보유하지 않는다.
	if (Sub)
	{
		if (!BakedAsset.IsNull())
		{
			UE_LOG(LogHktVoxelTerrain, Log,
				TEXT("[FloatRepro] VoxelTerrainActor.BeginPlay: LoadBakedAsset 호출 (SoftRef='%s')"),
				*BakedAsset.ToString());

			// 스트리밍은 IsBakedAssetPending 동안 보류된다. 따라서 첫 청크가 메싱되기 전,
			// 베이크 로드 완료 콜백에서 effective config(이제 baked)로 렌더 스케일을 재동기화해
			// BeginPlay 시점의 폴백 스케일과 baked 가 갈라지는 것을 막는다.
			TWeakObjectPtr<AHktVoxelTerrainActor> WeakThis(this);
			Sub->LoadBakedAsset(BakedAsset,
				[WeakThis](UHktTerrainBakedAsset* /*Loaded*/)
				{
					AHktVoxelTerrainActor* Self = WeakThis.Get();
					if (!Self) return;
					if (UHktTerrainSubsystem* S = UHktTerrainSubsystem::Get(Self))
					{
						Self->ApplyTerrainConfigScale(S->GetEffectiveConfig());
					}
				});
		}
		else
		{
			UE_LOG(LogHktVoxelTerrain, Log,
				TEXT("[FloatRepro] VoxelTerrainActor.BeginPlay: BakedAsset 미지정 — 폴백 Generator 경로 (대기 없음)"));
		}
	}
	else
	{
		UE_LOG(LogHktVoxelTerrain, Warning,
			TEXT("[TerrainActor] UHktTerrainSubsystem 부재 — 청크 스트리밍 비활성. Subsystem 가용 World 인지 확인."));
	}

	// 청크 로더 초기화 — LoaderType은 BeginPlay 시점에 확정되어 런타임 스왑하지 않는다.
	Loader = CreateTerrainChunkLoader(LoaderType);
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

	const TCHAR* LoaderName = (LoaderType == EHktTerrainLoaderType::Legacy)
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
	Loader.Reset();

	Super::EndPlay(EndPlayReason);
}

void AHktVoxelTerrainActor::ApplyTerrainConfigScale(const FHktTerrainGeneratorConfig& Cfg)
{
	VoxelSize  = Cfg.VoxelSizeCm;
	HeightMinZ = Cfg.HeightMinZ;
	HeightMaxZ = Cfg.HeightMaxZ;
	if (TerrainMeshScheduler)
	{
		TerrainMeshScheduler->SetVoxelSize(VoxelSize);
	}
}

void AHktVoxelTerrainActor::Tick(float DeltaTime)
{
	Super::Tick(DeltaTime);

	if (!TerrainCache || !TerrainMeshScheduler || !Loader)
	{
		return;
	}

	// BakedAsset 비동기 로드가 끝나기 전에는 스트리밍 보류 —
	// 그렇지 않으면 베이크 영역의 청크가 폴백 Generator 로 잘못 생성되어
	// 첫 PIE 진입에서 fallback terrain 이 보이는 race 가 발생한다.
	if (UHktTerrainSubsystem* Sub = UHktTerrainSubsystem::Get(this))
	{
		if (Sub->IsBakedAssetPending())
		{
			return;
		}
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
		const TMap<FIntVector, EHktTerrainChunkTier>& LoadedTiers = Loader->GetLoadedChunks();
		for (auto& Pair : ActiveChunks)
		{
			if (Pair.Value)
			{
				const EHktTerrainChunkTier* TierPtr = LoadedTiers.Find(Pair.Key);
				const EHktTerrainChunkTier Tier = TierPtr ? *TierPtr : EHktTerrainChunkTier::Near;
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

	const TMap<FIntVector, EHktTerrainChunkTier>& LoadedTiers = Loader->GetLoadedChunks();

	for (const TPair<FIntVector, UHktVoxelChunkComponent*>& Pair : ActiveChunks)
	{
		const FIntVector& Coord = Pair.Key;
		const UHktVoxelChunkComponent* Comp = Pair.Value;
		if (!Comp)
		{
			continue;
		}

		const EHktTerrainChunkTier* TierPtr = LoadedTiers.Find(Coord);
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
	const float OuterCm = (LoaderType == EHktTerrainLoaderType::Legacy)
		? LegacyStreamRadius
		: ProximityFarRadius;
	const int32 OuterRadiusChunks = FMath::CeilToInt(OuterCm / FMath::Max(1.f, ChunkWorldCm));
	const int32 ScanCells = (2 * OuterRadiusChunks + 1) * (2 * OuterRadiusChunks + 1);

	const TCHAR* LoaderName = (LoaderType == EHktTerrainLoaderType::Legacy)
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
	FHktTerrainLoaderConfig Cfg;
	Cfg.PrimaryRadius = (LoaderType == EHktTerrainLoaderType::Legacy)
		? LegacyStreamRadius
		: ProximityNearRadius;
	Cfg.SecondaryRadius = ProximityFarRadius;  // Legacy는 무시
	Cfg.MaxLoadsPerFrame = MaxLoadsPerFrame;
	Cfg.MaxLoadedChunks = MaxLoadedChunks;
	Cfg.HeightMinZ = HeightMinZ;
	Cfg.HeightMaxZ = HeightMaxZ;

	// BakedAsset 이 있으면 영역의 Z 범위로 클램프 — 베이크되지 않은 Z 청크 요청을 차단해
	// `Chunk … 베이크 미존재 — 런타임 생성 폴백` Warning 의 근본 원인을 제거.
	if (UHktTerrainSubsystem* Sub = UHktTerrainSubsystem::Get(this))
	{
		if (UHktTerrainBakedAsset* Baked = Sub->GetBakedAsset())
		{
			Cfg.HeightMinZ = FMath::Max(Cfg.HeightMinZ, Baked->RegionMin.Z);
			Cfg.HeightMaxZ = FMath::Min(Cfg.HeightMaxZ, Baked->RegionMax.Z);
		}
	}
	Loader->Configure(Cfg);
}

void AHktVoxelTerrainActor::GenerateAndLoadChunk(const FIntVector& ChunkCoord)
{
	GenerateAndLoadChunk(ChunkCoord, EHktTerrainChunkTier::Near);
}

void AHktVoxelTerrainActor::GenerateAndLoadChunk(const FIntVector& ChunkCoord, EHktTerrainChunkTier Tier)
{
	// UHktTerrainSubsystem 단일 출처에서 청크 데이터 획득 (baked-first + 폴백).
	// Subsystem 의 buffer-out API 가 호출자 버퍼를 직접 채워주므로 dangling 위험 0.
	UHktTerrainSubsystem* Sub = UHktTerrainSubsystem::Get(this);
	if (!Sub)
	{
		return;
	}

	constexpr int32 ChunkVoxelCount = 32 * 32 * 32;
	TArray<FHktTerrainVoxel> Voxels;
	Voxels.SetNumUninitialized(ChunkVoxelCount);
	if (!Sub->AcquireChunk(ChunkCoord, Voxels))
	{
		UE_LOG(LogHktVoxelTerrain, Warning,
			TEXT("[TerrainActor] AcquireChunk 실패 (%d,%d,%d) — 청크 로드 스킵"),
			ChunkCoord.X, ChunkCoord.Y, ChunkCoord.Z);
		return;
	}

	// FHktTerrainVoxel → FHktVoxel (동일 4바이트 레이아웃)
	const FHktVoxel* VoxelData = reinterpret_cast<const FHktVoxel*>(Voxels.GetData());
	TerrainCache->LoadChunk(ChunkCoord, VoxelData, ChunkVoxelCount);

	// Tier와 무관하게 모든 청크는 LOD 0으로 메싱 (LOD 다운샘플은 인접 청크와의 실루엣 불일치로
	// 크랙이 발생하므로 폐기). Tier 차이는 콜리전/그림자/노말맵으로만 반영된다.
	if (FHktVoxelChunkRef ChunkRef = TerrainCache->GetChunkRef(ChunkCoord))
	{
		ChunkRef->RequestedLOD.store(0, std::memory_order_release);
	}

	AcquireAndConfigureComponent(ChunkCoord, Tier);
}

UHktVoxelChunkComponent* AHktVoxelTerrainActor::AcquireAndConfigureComponent(const FIntVector& ChunkCoord, EHktTerrainChunkTier Tier)
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

void AHktVoxelTerrainActor::RetierChunk(const FIntVector& ChunkCoord, EHktTerrainChunkTier NewTier)
{
	// 모든 tier가 LOD 0을 공유하므로 메시 재생성은 불필요 — 컴포넌트 설정만 갱신.
	if (UHktVoxelChunkComponent** Found = ActiveChunks.Find(ChunkCoord))
	{
		ApplyTierToComponent(*Found, NewTier);
	}
}

void AHktVoxelTerrainActor::ApplyTierToComponent(UHktVoxelChunkComponent* Comp, EHktTerrainChunkTier Tier)
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
		case EHktTerrainChunkTier::Near:
			Settings.NormalMapScale = 1.0f;
			Settings.ShadowDistance = 0.0f;   // 0 = 항상 ON
			Settings.bCastShadow = true;
			Settings.bCollision = true;
			break;
		case EHktTerrainChunkTier::Far:
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

	auto TierName = [](EHktTerrainChunkTier T) { return T == EHktTerrainChunkTier::Near ? TEXT("Near") : TEXT("Far"); };

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
		const TMap<FIntVector, EHktTerrainChunkTier>& Loaded = Loader->GetLoadedChunks();
		if (const EHktTerrainChunkTier* TierPtr = Loaded.Find(ChunkCoord))
		{
			const EHktTerrainChunkTier Tier = *TierPtr;
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
// 블록 스타일 빌드 (StyleDataSet → BuiltTileAtlas + BuiltMaterialLUT)
// ============================================================================

void AHktVoxelTerrainActor::BuildTerrainStyle()
{
	bStyleBuilt = false;

	// 기본 팔레트 (8×256 흰색) 생성 — GWhiteTexture OOB 버그 방지용. StyleDataSet 유무와 무관.
	auto BuildWhitePalette = [this]()
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
	};

	if (!StyleDataSet)
	{
		BuildWhitePalette();
		UE_LOG(LogHktVoxelTerrain, Log,
			TEXT("[TerrainStyle] StyleDataSet 미할당 — 팔레트 폴백 렌더링"));
		return;
	}

	if (!StyleDataSet->HasBakedData())
	{
		BuildWhitePalette();
		UE_LOG(LogHktVoxelTerrain, Warning,
			TEXT("[TerrainStyle] StyleDataSet '%s' 베이크 미완료 — 자산에서 Bake 버튼을 눌러 주세요. 팔레트 폴백."),
			*StyleDataSet->GetName());
		return;
	}

	BuiltTileAtlas = NewObject<UHktVoxelTileAtlas>(this, TEXT("BuiltTileAtlas"), RF_Transient);
	BuiltMaterialLUT = NewObject<UHktVoxelMaterialLUT>(this, TEXT("BuiltMaterialLUT"), RF_Transient);
	StyleDataSet->ApplyTo(BuiltTileAtlas, BuiltMaterialLUT);

	BuildWhitePalette();

	// 작은 LUT 들의 RHI 준비를 BeginPlay 직후 보장 — 텍스처 배열은 이미 cooked 상태로
	// 로드되었으므로 flush 비용은 LUT(8×256, 256×3) 만큼만 든다.
	FlushRenderingCommands();

	bStyleBuilt = true;
	UE_LOG(LogHktVoxelTerrain, Log,
		TEXT("[TerrainStyle] StyleDataSet '%s' 적용 — %d styles, %d slices"),
		*StyleDataSet->GetName(),
		StyleDataSet->SourceBlockStyleCount, StyleDataSet->SliceCount);
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

bool AHktVoxelTerrainActor::TryGetVoxelHit(
	const FVector& TraceStart,
	const FVector& TraceDir,
	FHktVoxelSelection& OutVoxel) const
{
	OutVoxel = FHktVoxelSelection{};

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

	OutVoxel.bValid      = true;
	OutVoxel.VoxelCoord  = Result.VoxelCoord;
	OutVoxel.ChunkCoord  = Result.ChunkCoord;
	OutVoxel.HitNormal   = Result.HitNormal;
	OutVoxel.TypeID      = Result.HitTypeID;
	OutVoxel.VoxelSize   = VoxelSize;
	OutVoxel.WorldCenter = FVector(
		(static_cast<double>(Result.VoxelCoord.X) + 0.5) * VoxelSize,
		(static_cast<double>(Result.VoxelCoord.Y) + 0.5) * VoxelSize,
		(static_cast<double>(Result.VoxelCoord.Z) + 0.5) * VoxelSize);

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
			const TCHAR* Name = (A->LoaderType == EHktTerrainLoaderType::Legacy)
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

