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
#include "Terrain/HktFixed32.h"
#include "LOD/HktVoxelLOD.h"
#include "Settings/HktRuntimeGlobalSetting.h"
#include "Engine/World.h"
#include "Engine/Engine.h"
#include "Engine/Texture2DArray.h"
#include "Engine/Texture2D.h"
#include "EngineUtils.h"
#include "GameFramework/PlayerController.h"
#include "Camera/PlayerCameraManager.h"
#include "HAL/IConsoleManager.h"
#include "RenderingThread.h"
#include "RHIStaticStates.h"
#include "TextureResource.h"

// HktVoxelCoreModule에서 등록한 베벨 토글 플래그. 액터 프로퍼티와 동기화해
// 메싱 워커가 재메싱 시 올바른 값을 읽게 한다.
extern int32 GHktVoxelBevelEnabled;

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
	Streamer->SetLODDistances(LOD0Distance, LOD1Distance, LOD2Distance, LOD3Distance);
	Streamer->SetMaxLoadsPerFrame(MaxLoadsPerFrameHighLOD, MaxLoadsPerFrameLowLOD);
	Streamer->SetHeightRange(HeightMinZ, HeightMaxZ);
	Streamer->SetMaxLoadedChunks(MaxLoadedChunks);
	Streamer->SetForcedLOD(ForcedLOD);

	// 지형 생성기 초기화
	Generator = MakeUnique<FHktTerrainGenerator>(GenConfig);

	// SurfaceHeightProbe 바인딩 — LOD ≥ 2 영역에서 빈 공기 청크 스킵.
	// 칼럼 4-corner를 샘플링하여 max surface chunk Z를 반환 (오버행 청크 손실 방지 위해 +1 마진은 스트리머가 적용).
	Streamer->SetSurfaceHeightProbe([this](int32 CX, int32 CY) -> int32
	{
		if (!Generator)
		{
			return HeightMaxZ;
		}
		const int32 ChunkVoxels = FHktVoxelChunk::SIZE;
		int32 MaxSurfaceVox = INT32_MIN;
		for (int32 i = 0; i <= 1; ++i)
		{
			for (int32 j = 0; j <= 1; ++j)
			{
				const int32 WX = (CX + i) * ChunkVoxels;
				const int32 WY = (CY + j) * ChunkVoxels;
				const int32 SurfVox = Generator->GetSurfaceHeight(
					FHktFixed32::FromInt(WX), FHktFixed32::FromInt(WY)).FloorToInt();
				MaxSurfaceVox = FMath::Max(MaxSurfaceVox, SurfVox);
			}
		}
		return FHktVoxelRaycast::FloorDiv(MaxSurfaceVox, ChunkVoxels);
	});

	// LODSettings 기본 정책 — 디자이너가 에디터에서 앞쪽만 채워두었을 경우 뒤만 보충.
	// 모서리 베벨은 LOD0 메싱 단계에서만 수행되므로 LOD 스케일 필드 불요.
	while (LODSettings.Num() < 4)
	{
		FHktVoxelLODSettings S;
		switch (LODSettings.Num())
		{
			case 0: S.NormalMapScale = 1.0f;
			        S.ShadowDistance = 0.0f;    S.bCastShadow = true;  S.bCollision = true;  break;
			case 1: S.NormalMapScale = 0.5f;
			        S.ShadowDistance = 0.0f;    S.bCastShadow = true;  S.bCollision = false; break;
			case 2: S.NormalMapScale = 0.0f;
			        S.ShadowDistance = 60000.f; S.bCastShadow = true;  S.bCollision = false; break;
			default: S.NormalMapScale = 0.0f;
			         S.ShadowDistance = 0.0f;   S.bCastShadow = false; S.bCollision = false; break;
		}
		LODSettings.Add(S);
	}

	PrewarmPool(InitialPoolSize);

	// 스타일라이즈·베벨 토글 초기값 동기화
	bPrevStylizedRendering = bStylizedRendering;
	bPrevBevelEnabled = bBevelEnabled;
	GHktVoxelBevelEnabled = bBevelEnabled ? 1 : 0;
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

	UE_LOG(LogHktVoxelTerrain, Log,
		TEXT("Terrain Actor initialized — Seed=%lld, VoxelSize=%.1f, ChunkWorld=%.0f, "
			 "LOD=[%.0f/%.0f/%.0f/%.0f], Pool=%d, MaxLoad=High%d/Low%d, MaxMesh=%d, Style=%s"),
		GenConfig.Seed, VoxelSize, GetChunkWorldSize(),
		LOD0Distance, LOD1Distance, LOD2Distance, LOD3Distance,
		InitialPoolSize, MaxLoadsPerFrameHighLOD, MaxLoadsPerFrameLowLOD, MaxMeshPerFrame,
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

	FVector CameraPos;
	FRotator CameraRot;
	float HalfFovDeg;
	GetCameraView(CameraPos, CameraRot, HalfFovDeg);

	// 1. 스트리밍 업데이트 — 디버그 모드면 모든 LOD 거리에 배수 적용
	Streamer->SetMaxLoadsPerFrame(MaxLoadsPerFrameHighLOD, MaxLoadsPerFrameLowLOD);
	Streamer->SetMaxLoadedChunks(MaxLoadedChunks);
	Streamer->SetHeightRange(HeightMinZ, HeightMaxZ);

	if (bLegacyNonLODMode)
	{
		// 레거시 모드: 모든 청크 LOD 0 + 단일 반경 + 프러스텀 바이어스 OFF
		const float DistMul = bDebugRenderMode ? DebugViewDistanceMultiplier : 1.0f;
		const float R = LegacyStreamRadius * DistMul;
		Streamer->SetLODDistances(R, R, R, R);
		Streamer->SetForcedLOD(0);
		Streamer->SetFrustumBias(FVector2D::ZeroVector, -1.f);
	}
	else
	{
		Streamer->SetForcedLOD(ForcedLOD);
		const float DistMul = bDebugRenderMode ? DebugViewDistanceMultiplier : 1.0f;
		Streamer->SetLODDistances(
			LOD0Distance * DistMul,
			LOD1Distance * DistMul,
			LOD2Distance * DistMul,
			LOD3Distance * DistMul);

		// 프러스텀 바이어스 — 카메라 전방 콘 밖은 LOD 한 단계 강등.
		if (bFrustumBias)
		{
			const FVector Fwd = CameraRot.Vector();
			const FVector2D FwdXY(Fwd.X, Fwd.Y);
			const float EffectiveHalfFovDeg = FMath::Clamp(HalfFovDeg + FrustumBiasMarginDeg, 1.f, 179.f);
			const float HalfFovCos = FMath::Cos(FMath::DegreesToRadians(EffectiveHalfFovDeg));
			Streamer->SetFrustumBias(FwdXY, HalfFovCos);
		}
		else
		{
			Streamer->SetFrustumBias(FVector2D::ZeroVector, -1.f);
		}
	}

	Streamer->UpdateStreaming(CameraPos, GetChunkWorldSize());

	// 10초마다 1회 청크 스트리밍 통계 로그 (어떤 규모로 로드 중인지 명확화)
	LogStreamingStatsPeriodic();

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

	// 노멀맵 강도 라이브 토글 — LOD 스케일을 통과한 값으로 재적용
	const bool bNormalChanged = !FMath::IsNearlyEqual(NormalMapStrength, PrevNormalMapStrength);
	if (bNormalChanged)
	{
		PrevNormalMapStrength = NormalMapStrength;
		for (auto& Pair : ActiveChunks)
		{
			if (Pair.Value)
			{
				ApplyLODToComponent(Pair.Value, Pair.Value->GetChunkLOD());
			}
		}
	}

	// 베벨 토글 라이브 변경 — 메싱 플래그 싱크 + LOD0 청크 재메싱 트리거.
	if (bBevelEnabled != bPrevBevelEnabled)
	{
		bPrevBevelEnabled = bBevelEnabled;
		GHktVoxelBevelEnabled = bBevelEnabled ? 1 : 0;
		if (TerrainCache)
		{
			for (const auto& Pair : ActiveChunks)
			{
				if (!Pair.Value) continue;
				FHktVoxelChunk* Chunk = TerrainCache->GetChunk(Pair.Key);
				if (Chunk && Chunk->CurrentLOD.load() == 0)
				{
					Chunk->bMeshDirty.store(true);
					Chunk->MeshGeneration.fetch_add(1);
				}
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
}

void AHktVoxelTerrainActor::LogStreamingStatsPeriodic()
{
	if (StatsLogInterval <= 0.f || !Streamer)
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
	// FHktVoxel 4바이트 + 메시 오버헤드(러프 추정)
	constexpr int32 BytesPerVoxel = 4;
	const int32 KBytesPerChunkData = (VoxelsPerChunk * BytesPerVoxel) / 1024;

	// LOD 분포
	int32 LODCounts[4] = { 0, 0, 0, 0 };
	Streamer->GetLODHistogram(LODCounts);
	const int32 TotalLoaded = LODCounts[0] + LODCounts[1] + LODCounts[2] + LODCounts[3];
	const int32 ActiveComps = ActiveChunks.Num();

	// 예상 스캔 셀 수 (매 재빌드 비용)
	const float DistMul = bDebugRenderMode ? DebugViewDistanceMultiplier : 1.0f;
	const float OuterCm = LOD3Distance * DistMul;
	const int32 OuterRadiusChunks = FMath::CeilToInt(OuterCm / FMath::Max(1.f, ChunkWorldCm));
	const int32 ScanCells = (2 * OuterRadiusChunks + 1) * (2 * OuterRadiusChunks + 1);

	UE_LOG(LogHktVoxelTerrain, Log,
		TEXT("[Terrain Stats] Loaded=%d (LOD0=%d, LOD1=%d, LOD2=%d, LOD3=%d), ActiveComps=%d | "
			 "Chunk=%dx%dx%d voxels = %.0fx%.0fcm = %d KB data | "
			 "OuterRadius=%d chunks (%.0fm), ScanCells/rebuild=%d | "
			 "Budget=High%d+Low%d /frame, Mesh=%d/frame, MaxLoaded=%d | "
			 "FrustumBias=%s"),
		TotalLoaded, LODCounts[0], LODCounts[1], LODCounts[2], LODCounts[3], ActiveComps,
		VoxelsPerAxis, VoxelsPerAxis, VoxelsPerAxis,
		ChunkWorldCm, ChunkWorldCm, KBytesPerChunkData,
		OuterRadiusChunks, OuterCm / 100.f, ScanCells,
		MaxLoadsPerFrameHighLOD, MaxLoadsPerFrameLowLOD, MaxMeshPerFrame, MaxLoadedChunks,
		bFrustumBias ? TEXT("ON") : TEXT("OFF"));
}

void AHktVoxelTerrainActor::GetLODHistogram(int32 OutCounts[4]) const
{
	if (Streamer)
	{
		Streamer->GetLODHistogram(OutCounts);
	}
	else
	{
		OutCounts[0] = OutCounts[1] = OutCounts[2] = OutCounts[3] = 0;
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
	FVector ViewLoc;
	FRotator ViewRot;
	float HalfFovDeg;
	GetCameraView(ViewLoc, ViewRot, HalfFovDeg);
	return ViewLoc;
}

void AHktVoxelTerrainActor::GetCameraView(FVector& OutPos, FRotator& OutRot, float& OutHalfFovDeg) const
{
	OutPos = FVector::ZeroVector;
	OutRot = FRotator::ZeroRotator;
	OutHalfFovDeg = 45.f;  // 기본 90° FOV 가정

	if (const UWorld* World = GetWorld())
	{
		if (const APlayerController* PC = World->GetFirstPlayerController())
		{
			PC->GetPlayerViewPoint(OutPos, OutRot);
			if (const APlayerCameraManager* CM = PC->PlayerCameraManager)
			{
				OutHalfFovDeg = CM->GetFOVAngle() * 0.5f;
			}
		}
	}
}

void AHktVoxelTerrainActor::GenerateAndLoadChunk(const FIntVector& ChunkCoord)
{
	GenerateAndLoadChunk(ChunkCoord, 0);
}

void AHktVoxelTerrainActor::GenerateAndLoadChunk(const FIntVector& ChunkCoord, int32 LOD)
{
	// 절차적 생성 (힙 할당 — 128KB는 워커 스레드 스택에 위험)
	constexpr int32 ChunkVoxelCount = 32 * 32 * 32;
	TArray<FHktTerrainVoxel> GeneratedVoxels;
	GeneratedVoxels.SetNumUninitialized(ChunkVoxelCount);
	Generator->GenerateChunk(ChunkCoord.X, ChunkCoord.Y, ChunkCoord.Z, GeneratedVoxels.GetData());

	// FHktTerrainVoxel → FHktVoxel (동일 4바이트 레이아웃)
	const FHktVoxel* VoxelData = reinterpret_cast<const FHktVoxel*>(GeneratedVoxels.GetData());
	TerrainCache->LoadChunk(ChunkCoord, VoxelData, ChunkVoxelCount);

	// LOD 요청 — LoadChunk 직후 ChunkRef를 받아 RequestedLOD를 캡처.
	// LoadChunk이 bMeshDirty=true로 설정해 두므로 다음 메싱 틱에서 그 LOD로 빌드된다.
	if (FHktVoxelChunkRef ChunkRef = TerrainCache->GetChunkRef(ChunkCoord))
	{
		const int32 ClampedLOD = FMath::Clamp(LOD, 0, FHktVoxelLODPolicy::MaxLOD);
		ChunkRef->RequestedLOD.store(static_cast<uint8>(ClampedLOD), std::memory_order_release);
	}

	AcquireAndConfigureComponent(ChunkCoord, LOD);
}

UHktVoxelChunkComponent* AHktVoxelTerrainActor::AcquireAndConfigureComponent(const FIntVector& ChunkCoord, int32 LOD)
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
	ApplyLODToComponent(Comp, LOD);
	if (bStyleBuilt)
	{
		ApplyStyleToComponent(Comp);
	}
	ActiveChunks.Add(ChunkCoord, Comp);
	return Comp;
}

void AHktVoxelTerrainActor::RetuneChunkLOD(const FIntVector& ChunkCoord, int32 NewLOD)
{
	if (!TerrainCache)
	{
		return;
	}
	FHktVoxelChunkRef ChunkRef = TerrainCache->GetChunkRef(ChunkCoord);
	if (!ChunkRef)
	{
		return;
	}

	const int32 ClampedLOD = FMath::Clamp(NewLOD, 0, FHktVoxelLODPolicy::MaxLOD);
	const uint8 PrevLOD = ChunkRef->RequestedLOD.load(std::memory_order_acquire);
	if (static_cast<int32>(PrevLOD) == ClampedLOD)
	{
		return;
	}

	// 메시 재생성 트리거 — Generation 증가로 in-flight 워커 결과는 폐기됨.
	ChunkRef->RequestedLOD.store(static_cast<uint8>(ClampedLOD), std::memory_order_release);
	ChunkRef->MeshGeneration.fetch_add(1, std::memory_order_acq_rel);
	ChunkRef->bMeshDirty.store(true, std::memory_order_release);

	if (UHktVoxelChunkComponent** Found = ActiveChunks.Find(ChunkCoord))
	{
		ApplyLODToComponent(*Found, ClampedLOD);
	}
}

void AHktVoxelTerrainActor::ApplyLODToComponent(UHktVoxelChunkComponent* Comp, int32 LOD)
{
	if (!Comp)
	{
		return;
	}
	const int32 ClampedLOD = FMath::Clamp(LOD, 0, FHktVoxelLODPolicy::MaxLOD);
	const FHktVoxelLODSettings& Settings = LODSettings.IsValidIndex(ClampedLOD)
		? LODSettings[ClampedLOD]
		: LODSettings[0];
	Comp->SetChunkLOD(ClampedLOD, Settings.ToComponentSettings(), NormalMapStrength);
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
	for (const FHktChunkLODRequest& Req : Streamer->GetChunksToLoad())
	{
		if (ActiveChunks.Contains(Req.Coord))
		{
			continue;
		}

		GenerateAndLoadChunk(Req.Coord, Req.LOD);
	}

	// Retune: 이미 로드된 청크의 LOD만 변경 (Voxel 데이터 보존, 메시만 재생성)
	for (const FHktChunkLODRequest& Req : Streamer->GetChunksToRetune())
	{
		RetuneChunkLOD(Req.Coord, Req.LOD);
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

	if (Streamer)
	{
		const TMap<FIntVector, int32>& Loaded = Streamer->GetLoadedChunkLOD();
		if (const int32* LODPtr = Loaded.Find(ChunkCoord))
		{
			const int32 LOD = *LODPtr;
			if (FHktVoxelChunkRef ChunkRef = TerrainCache->GetChunkRef(ChunkCoord))
			{
				ChunkRef->RequestedLOD.store(
					static_cast<uint8>(FMath::Clamp(LOD, 0, FHktVoxelLODPolicy::MaxLOD)),
					std::memory_order_release);
			}

			if (!ActiveChunks.Contains(ChunkCoord))
			{
				AcquireAndConfigureComponent(ChunkCoord, LOD);
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

	if (BlockStyles.Num() == 0)
	{
		UE_LOG(LogHktVoxelTerrain, Log, TEXT("[TerrainStyle] BlockStyles is empty — using palette fallback"));
		return;
	}

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
				TEXT("[Terrain] %s debug=%d (mult=%.2f)"),
				*A->GetName(), bNext ? 1 : 0, A->DebugViewDistanceMultiplier);
		}
	}

	void Cmd_TerrainDebugRadius(const TArray<FString>& Args)
	{
		if (Args.Num() < 1)
		{
			UE_LOG(LogConsoleResponse, Display,
				TEXT("Usage: hkt.terrain.debug.radius <Chunks> — 디버그 모드 스트리밍 반경 (청크)"));
			return;
		}
		const int32 Chunks = FMath::Max(1, FCString::Atoi(*Args[0]));
		auto Actors = FindTerrainActors();
		if (Actors.Num() == 0)
		{
			UE_LOG(LogConsoleResponse, Warning, TEXT("[Terrain] AHktVoxelTerrainActor 없음"));
			return;
		}
		for (AHktVoxelTerrainActor* A : Actors)
		{
			const float ChunkWorldSize = A->GetChunkWorldSize();
			const float TargetDistance = static_cast<float>(Chunks) * ChunkWorldSize;
			// LOD3가 외곽 가시 거리 기준 — 그에 맞춰 multiplier 산출
			const float Baseline = FMath::Max(1.f, A->LOD3Distance);
			A->DebugViewDistanceMultiplier = FMath::Clamp(TargetDistance / Baseline, 1.f, 32.f);
			UE_LOG(LogConsoleResponse, Display,
				TEXT("[Terrain] %s debug radius=%d chunks (mult=%.2f, outerDist=%.0fcm)"),
				*A->GetName(), Chunks, A->DebugViewDistanceMultiplier,
				A->LOD3Distance * A->DebugViewDistanceMultiplier);
		}
	}

	// === LOD 디버그 콘솔 명령 ===

	void Cmd_TerrainLODDistances(const TArray<FString>& Args)
	{
		if (Args.Num() < 4)
		{
			UE_LOG(LogConsoleResponse, Display,
				TEXT("Usage: hkt.terrain.lod.distances <D0> <D1> <D2> <D3> — LOD 외곽 거리 (cm)"));
			return;
		}
		const float D0 = FMath::Max(1.f, FCString::Atof(*Args[0]));
		const float D1 = FMath::Max(D0 + 1.f, FCString::Atof(*Args[1]));
		const float D2 = FMath::Max(D1 + 1.f, FCString::Atof(*Args[2]));
		const float D3 = FMath::Max(D2 + 1.f, FCString::Atof(*Args[3]));
		auto Actors = FindTerrainActors();
		if (Actors.Num() == 0)
		{
			UE_LOG(LogConsoleResponse, Warning, TEXT("[Terrain] AHktVoxelTerrainActor 없음"));
			return;
		}
		for (AHktVoxelTerrainActor* A : Actors)
		{
			A->LOD0Distance = D0;
			A->LOD1Distance = D1;
			A->LOD2Distance = D2;
			A->LOD3Distance = D3;
			UE_LOG(LogConsoleResponse, Display,
				TEXT("[Terrain] %s LOD distances = [%.0f / %.0f / %.0f / %.0f]"),
				*A->GetName(), D0, D1, D2, D3);
		}
	}

	void Cmd_TerrainLODFreeze(const TArray<FString>& Args)
	{
		if (Args.Num() < 1)
		{
			UE_LOG(LogConsoleResponse, Display,
				TEXT("Usage: hkt.terrain.lod.freeze <-1|0|1|2|3> — LOD 강제 (-1=정상)"));
			return;
		}
		const int32 LOD = FMath::Clamp(FCString::Atoi(*Args[0]), -1, 3);
		auto Actors = FindTerrainActors();
		if (Actors.Num() == 0)
		{
			UE_LOG(LogConsoleResponse, Warning, TEXT("[Terrain] AHktVoxelTerrainActor 없음"));
			return;
		}
		for (AHktVoxelTerrainActor* A : Actors)
		{
			A->ForcedLOD = LOD;
			UE_LOG(LogConsoleResponse, Display,
				TEXT("[Terrain] %s ForcedLOD=%d %s"),
				*A->GetName(), LOD,
				LOD < 0 ? TEXT("(정상 동작)") : TEXT("(전체 청크 강제)"));
		}
	}

	void Cmd_TerrainLODStats(const TArray<FString>&)
	{
		auto Actors = FindTerrainActors();
		if (Actors.Num() == 0)
		{
			UE_LOG(LogConsoleResponse, Warning, TEXT("[Terrain] AHktVoxelTerrainActor 없음"));
			return;
		}
		for (AHktVoxelTerrainActor* A : Actors)
		{
			int32 LODCount[4] = { 0, 0, 0, 0 };
			A->GetLODHistogram(LODCount);
			const int32 Total = LODCount[0] + LODCount[1] + LODCount[2] + LODCount[3];
			UE_LOG(LogConsoleResponse, Display,
				TEXT("[Terrain] %s — LOD0=%d, LOD1=%d, LOD2=%d, LOD3=%d (Total=%d active comps), "
					 "BudgetHigh=%d/frame, BudgetLow=%d/frame, Forced=%d, DistMul=%.2f"),
				*A->GetName(),
				LODCount[0], LODCount[1], LODCount[2], LODCount[3], Total,
				A->MaxLoadsPerFrameHighLOD, A->MaxLoadsPerFrameLowLOD,
				A->ForcedLOD, A->DebugViewDistanceMultiplier);
		}
	}

	FAutoConsoleCommand CmdTerrainDebug(
		TEXT("hkt.terrain.debug"),
		TEXT("Terrain 디버그 렌더 모드. 인자: 0=끔, 1=켬. 없으면 토글. "
			"실제 생성 파이프라인 그대로, DebugRenderMaterial로 교체 + 4개 LOD 거리 확장."),
		FConsoleCommandWithArgsDelegate::CreateStatic(&Cmd_TerrainDebug));

	FAutoConsoleCommand CmdTerrainDebugRadius(
		TEXT("hkt.terrain.debug.radius"),
		TEXT("디버그 모드 스트리밍 반경을 청크 단위로 설정. 예: hkt.terrain.debug.radius 64"),
		FConsoleCommandWithArgsDelegate::CreateStatic(&Cmd_TerrainDebugRadius));

	FAutoConsoleCommand CmdTerrainLODDistances(
		TEXT("hkt.terrain.lod.distances"),
		TEXT("LOD 0~3의 외곽 거리(cm)를 라이브 변경. 예: hkt.terrain.lod.distances 8000 20000 50000 128000"),
		FConsoleCommandWithArgsDelegate::CreateStatic(&Cmd_TerrainLODDistances));

	FAutoConsoleCommand CmdTerrainLODFreeze(
		TEXT("hkt.terrain.lod.freeze"),
		TEXT("모든 청크를 특정 LOD로 강제. 인자: -1=정상, 0/1/2/3=강제. 디버그/스크린샷용."),
		FConsoleCommandWithArgsDelegate::CreateStatic(&Cmd_TerrainLODFreeze));

	FAutoConsoleCommand CmdTerrainLODStats(
		TEXT("hkt.terrain.lod.stats"),
		TEXT("현재 LOD별 활성 청크 수와 프레임 버짓 출력."),
		FConsoleCommandWithArgsDelegate::CreateStatic(&Cmd_TerrainLODStats));

	void Cmd_TerrainLegacyMode(const TArray<FString>& Args)
	{
		auto Actors = FindTerrainActors();
		if (Actors.Num() == 0)
		{
			UE_LOG(LogConsoleResponse, Warning, TEXT("[Terrain] AHktVoxelTerrainActor 없음"));
			return;
		}
		const bool bHasArg = Args.Num() >= 1;
		const bool bForceOn = bHasArg && FCString::Atoi(*Args[0]) != 0;
		const float RadiusArg = (Args.Num() >= 2) ? FMath::Max(1600.f, FCString::Atof(*Args[1])) : -1.f;
		for (AHktVoxelTerrainActor* A : Actors)
		{
			const bool bNext = bHasArg ? bForceOn : !A->bLegacyNonLODMode;
			A->bLegacyNonLODMode = bNext;
			if (RadiusArg > 0.f)
			{
				A->LegacyStreamRadius = RadiusArg;
			}
			UE_LOG(LogConsoleResponse, Display,
				TEXT("[Terrain] %s LegacyNonLODMode=%s (Radius=%.0fcm)"),
				*A->GetName(), bNext ? TEXT("ON") : TEXT("OFF"), A->LegacyStreamRadius);
		}
	}

	FAutoConsoleCommand CmdTerrainLegacyMode(
		TEXT("hkt.terrain.legacy"),
		TEXT("LOD 도입 전 동작으로 되돌리기. 인자: [0|1] [radius_cm]. 없으면 토글. "
			"예: hkt.terrain.legacy 1 8000 — 레거시 모드 ON, 반경 80m."),
		FConsoleCommandWithArgsDelegate::CreateStatic(&Cmd_TerrainLegacyMode));
}
