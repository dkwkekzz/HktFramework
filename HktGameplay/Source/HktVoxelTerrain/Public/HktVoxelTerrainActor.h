// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "IHktHitRefinementProvider.h"
#include "Data/HktVoxelRenderCache.h"
#include "Meshing/HktVoxelMeshScheduler.h"
#include "HktVoxelChunkLoader.h"
#include "Terrain/HktTerrainGenerator.h"
#include "Rendering/HktVoxelChunkComponent.h"
#include "HktVoxelTerrainActor.generated.h"

struct FHktTerrainGeneratorConfig;
class UHktVoxelChunkComponent;
class UHktVoxelTileAtlas;
class UHktVoxelMaterialLUT;

/**
 * FHktVoxelBlockStyle — TypeID별 시각 정의
 *
 * 에디터에서 블록 타입별 텍스처(Top/Side/Bottom)와 PBR 속성을 지정한다.
 * TerrainActor가 BeginPlay에서 이 배열을 Texture2DArray + MaterialLUT로 빌드.
 */
USTRUCT(BlueprintType)
struct FHktVoxelBlockStyle
{
	GENERATED_BODY()

	/** 대응하는 복셀 TypeID (HktTerrainType 참조) */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Block")
	int32 TypeID = 0;

	/** 블록 이름 (에디터 표시용) */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Block")
	FString DisplayName;

	// --- 텍스처 (면 방향별) ---

	/** +Z(위) 면 텍스처. nullptr이면 SideTexture 사용 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Texture")
	TObjectPtr<UTexture2D> TopTexture;

	/** ±X/±Y(옆) 면 텍스처. 필수 — nullptr이면 팔레트 폴백 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Texture")
	TObjectPtr<UTexture2D> SideTexture;

	/** -Z(아래) 면 텍스처. nullptr이면 SideTexture 사용 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Texture")
	TObjectPtr<UTexture2D> BottomTexture;

	// --- 노멀맵 (선택) ---
	// 모든 슬라이스가 all-or-nothing. 일부만 설정하면 NormalArray 빌드 스킵 + 경고.
	// UE 에셋 설정은 TC_Normalmap + sRGB=off 권장. DXT5/BC5 모두 셰이더에서 z 재구성.

	/** +Z(위) 면 노멀맵. TopTexture가 있을 때만 사용, 없으면 SideNormal로 폴백 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Normal")
	TObjectPtr<UTexture2D> TopNormal;

	/** ±X/±Y(옆) 면 노멀맵 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Normal")
	TObjectPtr<UTexture2D> SideNormal;

	/** -Z(아래) 면 노멀맵. BottomTexture가 있을 때만 사용, 없으면 SideNormal로 폴백 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Normal")
	TObjectPtr<UTexture2D> BottomNormal;

	// --- PBR 속성 ---

	/** 표면 거칠기 (0=매끈/반사, 1=거침/매트) */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Material", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float Roughness = 0.8f;

	/** 금속성 (0=비금속, 1=금속) */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Material", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float Metallic = 0.0f;

	/** 스페큘러 반사 강도 (0=없음, 1=최대) */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Material", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float Specular = 0.5f;
};

/**
 * AHktVoxelTerrainActor
 *
 * 월드에 1개 배치하여 복셀 테레인 전체를 관리한다.
 * 테레인 전용 RenderCache + MeshScheduler를 소유하고,
 * 카메라 기반 스트리밍으로 ChunkComponent를 동적 생성/풀링한다.
 *
 * 데이터 흐름:
 *   Loader → Generator.GenerateChunk() → RenderCache → MeshScheduler → ChunkComponent → GPU
 */
UCLASS(ClassGroup = (HktVoxel))
class HKTVOXELTERRAIN_API AHktVoxelTerrainActor
	: public AActor
	, public IHktHitRefinementProvider
{
	GENERATED_BODY()

public:
	AHktVoxelTerrainActor();
	~AHktVoxelTerrainActor();

	// === 외부 API (VM 연동) ===

	/** VM에서 청크 데이터를 수신하여 로드 */
	void LoadTerrainChunk(const FIntVector& ChunkCoord, const struct FHktVoxel* VoxelData, int32 VoxelCount);

	/** VM에서 청크 언로드 요청 (스트리밍 아웃) */
	void UnloadTerrainChunk(const FIntVector& ChunkCoord);

	/** RenderCache 직접 접근 (테스트/디버그용) */
	FHktVoxelRenderCache* GetTerrainCache() const { return TerrainCache.Get(); }

	/** Tier별 로드된 청크 수 집계 — 콘솔/디버그용. [0]=Near, [1]=Far */
	void GetTierHistogram(int32 OutCounts[2]) const;

	// IHktHitRefinementProvider
	virtual bool RefineHit(
		const FVector& TraceStart,
		const FVector& TraceDir,
		const FHitResult& CoarseHit,
		FHitResult& OutRefinedHit) const override;

	// === 설정 ===

	// === 청크 로더 선택 ===

	/**
	 * 청크 로딩 전략. 두 가지 방식만 지원:
	 *  - Legacy   : 단일 반경 내 모든 청크 풀 디테일. 안전한 폴백.
	 *  - Proximity: 근거리 풀 + 원거리 간이 2링. 회전에 무관(피드백 루프 없음).
	 * BeginPlay 1회 생성이라 런타임 스왑하지 않는다 — 변경 시 PIE 재시작 필요.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktTerrain|Streaming")
	EHktVoxelLoaderType LoaderType = EHktVoxelLoaderType::Proximity;

	// === Legacy 로더 파라미터 ===

	/** Legacy 모드에서 사용할 단일 스트리밍 반경 (UE 유닛). 기본 8000 = 80m */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktTerrain|Streaming|Legacy",
		meta = (EditCondition = "LoaderType == EHktVoxelLoaderType::Legacy",
				ClampMin = 1600, ClampMax = 1024000))
	float LegacyStreamRadius = 8000.f;

	// === Proximity 로더 파라미터 ===

	/** 근거리(풀 디테일) 링 반경. 기본 1500 = 15m (~3 청크 @ 480cm). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktTerrain|Streaming|Proximity",
		meta = (EditCondition = "LoaderType == EHktVoxelLoaderType::Proximity",
				ClampMin = 480, ClampMax = 102400))
	float ProximityNearRadius = 1500.f;

	/** 원거리(간이 메시) 링 반경. 기본 8000 = 80m (~16 청크 @ 480cm). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktTerrain|Streaming|Proximity",
		meta = (EditCondition = "LoaderType == EHktVoxelLoaderType::Proximity",
				ClampMin = 480, ClampMax = 1024000))
	float ProximityFarRadius = 8000.f;

	// === 공용 버짓 ===

	/** 프레임당 최대 청크 로드/리티어 수 (로더 공통) */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktTerrain|Streaming",
		meta = (ClampMin = 1, ClampMax = 64))
	int32 MaxLoadsPerFrame = 16;

	/** 프레임당 최대 메싱 수 (MeshScheduler에 전달) */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktTerrain|Meshing", meta = (ClampMin = 1, ClampMax = 16))
	int32 MaxMeshPerFrame = 8;

	/** 동시에 로드 가능한 최대 청크 수 (메모리 예산). 0이면 제한 없음 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktTerrain|Streaming", meta = (ClampMin = 0))
	int32 MaxLoadedChunks = 2048;

	/**
	 * 테레인 높이 범위 — Z축 청크 좌표 [MinZ, MaxZ].
	 * BeginPlay에서 UHktRuntimeGlobalSetting에서 읽어 초기화된다 (시뮬레이션과 공유).
	 * 직접 편집 불가 — 전역 설정이 단일 출처.
	 */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "HktTerrain|Streaming", Transient)
	int32 HeightMinZ = 0;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "HktTerrain|Streaming", Transient)
	int32 HeightMaxZ = 3;

	/** 테레인 렌더링용 머티리얼 (팔레트 기반) */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktTerrain|Rendering")
	TObjectPtr<UMaterialInterface> TerrainMaterial;

	/**
	 * 워터 전용 머티리얼 — Translucent Water 복셀(TypeID=5)만 이 머티리얼로 별도 렌더링.
	 * 호수/강/바다 표면 전부 공통. nullptr이면 TerrainMaterial로 폴백.
	 * 권장: Blend Mode = Translucent, 깊이 페이드 + 프레넬 + 애니메이션 노멀.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktTerrain|Rendering")
	TObjectPtr<UMaterialInterface> WaterMaterial;

	/** 스타일라이즈 렌더링 — 메이플2풍 카툰 셰이딩 (그리드 라인, AO 부스트, 채도 강화) */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktTerrain|Rendering")
	bool bStylizedRendering = false;

	/**
	 * 노멀맵 강도 — BlockStyle의 Normal 텍스처가 빌드되었을 때만 적용.
	 * 0 = off(평면), 1 = 원본 강도, 1.0 이상 = 과장.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktTerrain|Rendering",
		meta = (ClampMin = "0.0", ClampMax = "2.0", UIMin = "0.0", UIMax = "2.0"))
	float NormalMapStrength = 1.0f;

	/** 그림자 렌더링 최대 거리 (UE 유닛). 이 거리 밖 청크는 그림자를 드리우지 않음. 0이면 항상 ON */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktTerrain|Rendering", meta = (ClampMin = 0))
	float ShadowDistance = 16000.f;

	// === 디버그 렌더 모드 ===

	/**
	 * 디버그 렌더 모드.
	 * ON → 실제 생성/메싱 파이프라인 그대로 유지, 머티리얼만 DebugRenderMaterial로 교체.
	 * 콘솔: hkt.terrain.debug 0|1
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktTerrain|Debug")
	bool bDebugRenderMode = false;

	/**
	 * 디버그 렌더 전용 머티리얼. nullptr이면 ChunkComponent의 자동 기본
	 * (M_HktVoxelVertexColor, 언릿 버텍스 컬러) 사용.
	 * 와이어프레임 또는 TypeID 컬러 머티리얼을 할당하면 그쪽으로 그려진다.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktTerrain|Debug")
	TObjectPtr<UMaterialInterface> DebugRenderMaterial;

	// === 블록 스타일 (Phase 1+2: 타일 텍스처 + PBR) ===

	/**
	 * 블록 타입별 시각 정의.
	 * TypeID별 텍스처(Top/Side/Bottom)와 PBR(Roughness/Metallic/Specular)을 지정.
	 * BeginPlay에서 자동으로 Texture2DArray + MaterialLUT로 빌드된다.
	 * 비어있으면 기존 팔레트 렌더링 그대로 동작.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktTerrain|Style",
		meta = (TitleProperty = "{DisplayName} (ID:{TypeID})"))
	TArray<FHktVoxelBlockStyle> BlockStyles;

	/**
	 * 복셀 1개의 월드 크기 (UE 유닛).
	 * BeginPlay에서 UHktRuntimeGlobalSetting::VoxelSizeCm에서 읽어 초기화된다.
	 * 직접 편집 불가 — 전역 설정이 단일 출처.
	 */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "HktTerrain|Rendering", Transient)
	float VoxelSize = 15.0f;

	/** 컴포넌트 풀 초기 크기 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktTerrain|Streaming", meta = (ClampMin = 16, ClampMax = 2048))
	int32 InitialPoolSize = 64;

	/** 청크 스트리밍 통계 로그 주기(초). 0 이하면 비활성 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktTerrain|Debug",
		meta = (ClampMin = 0.f, ClampMax = 60.f))
	float StatsLogInterval = 10.f;

	/**
	 * 청크 단위 LOAD/UNLOAD/RETUNE 이벤트를 UE_LOG로 출력.
	 * ON 시 매 틱 빈도가 높을 수 있으므로 진단 중에만 사용.
	 * 콘솔: hkt.terrain.log.chunks 0|1
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktTerrain|Debug", Transient)
	bool bLogChunkEvents = false;

	/**
	 * 활성 청크별 AABB를 Tier 색상으로 DrawDebug 렌더.
	 * Near=녹 / Far=주황. 매 틱 1프레임 라인 그리기.
	 * 콘솔: hkt.terrain.debug.draw 0|1
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktTerrain|Debug", Transient)
	bool bDrawChunkDebug = false;

	/** DrawChunkDebug 시 청크 좌표·Tier 텍스트 라벨 표시 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktTerrain|Debug", Transient,
		meta = (EditCondition = "bDrawChunkDebug"))
	bool bDrawChunkDebugLabels = false;

	/** DrawChunkDebug AABB 선 두께 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktTerrain|Debug", Transient,
		meta = (EditCondition = "bDrawChunkDebug", ClampMin = "0.5", ClampMax = "8.0"))
	float ChunkDebugDrawThickness = 2.f;

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
	virtual void Tick(float DeltaTime) override;

private:
	/** 카메라 위치 가져오기 */
	FVector GetCameraWorldPos() const;

	/** 절차적 생성 + RenderCache 로드 + 컴포넌트 할당 (기본 Near Tier — 외부 API 호환용) */
	void GenerateAndLoadChunk(const FIntVector& ChunkCoord);

	/** Tier-aware 절차적 생성 + 로드 + 컴포넌트 할당 */
	void GenerateAndLoadChunk(const FIntVector& ChunkCoord, EHktVoxelChunkTier Tier);

	/**
	 * 이미 로드된 청크의 Tier만 변경 — RequestedLOD store + bMeshDirty=true + MeshGeneration++.
	 * Voxel 데이터는 재생성하지 않고 메시만 다음 틱에 새 LOD로 재생성된다.
	 * 머티리얼/그림자/콜리전 등 컴포넌트 설정도 동시에 반영.
	 */
	void RetierChunk(const FIntVector& ChunkCoord, EHktVoxelChunkTier NewTier);

	/** Tier에 해당하는 컴포넌트 설정 적용 (액터 글로벌 강도 합성) */
	void ApplyTierToComponent(UHktVoxelChunkComponent* Comp, EHktVoxelChunkTier Tier);

	/** 스트리밍 결과 반영 — 청크 로드/언로드 + 컴포넌트 할당 */
	void ProcessStreamingResults();

	/** 메싱 완료된 청크의 컴포넌트 갱신 */
	void ProcessMeshReadyChunks();

	/**
	 * ActiveChunks 전체에 대해 스타일 텍스처 캐시 재시도 + Proxy 전달.
	 *
	 * BuildTerrainStyle의 UpdateResource()가 비동기이므로, 최초 ApplyStyleToComponent
	 * 호출 시점에는 TileArray RHI가 아직 nullptr일 수 있다. 이전 구현은 ProcessMeshReadyChunks
	 * 안에서 bMeshReady=true인 틱에만 재시도를 수행했는데, 정적 청크는 메싱이 한 번만
	 * 발생하므로 RHI가 그 틱 안에 준비되지 않으면 다시는 재시도할 기회가 없었다.
	 *
	 * 매 Tick 호출되어 캐시가 완성되는 즉시 PushStyleTexturesToProxy로 Proxy에 전달한다.
	 */
	void PumpStyleTextures();

	/** 활성 청크 AABB를 Tier 색상으로 DrawDebug 그림 (bDrawChunkDebug ON 시) */
	void DrawChunkDebug() const;

	/** StatsLogInterval 주기로 현재 로드된 청크 수, 크기, Tier 분포를 로그 출력 */
	void LogStreamingStatsPeriodic();

	/** UPROPERTY 변경이 즉시 반영되도록 매 Tick 로더에 Config 주입 */
	void SyncLoaderParams();

	/** 컴포넌트 풀 관리 */
	UHktVoxelChunkComponent* AcquireComponent();
	void ReleaseComponent(UHktVoxelChunkComponent* Comp);
	void PrewarmPool(int32 Count);

	/**
	 * 풀에서 컴포넌트 1개를 획득해 머티리얼/Tier/스타일/ActiveChunks 등록까지 일괄 처리.
	 * GenerateAndLoadChunk와 LoadTerrainChunk의 공통 초기화 경로. nullptr 반환 시 스킵.
	 */
	UHktVoxelChunkComponent* AcquireAndConfigureComponent(const FIntVector& ChunkCoord, EHktVoxelChunkTier Tier);

	/** BlockStyles 배열로부터 Texture2DArray + LUT + MaterialLUT를 빌드 */
	void BuildTerrainStyle();

	/** 청크 컴포넌트에 타일/머티리얼 텍스처를 적용 */
	void ApplyStyleToComponent(UHktVoxelChunkComponent* Comp);

	// === 내부 상태 ===

	TUniquePtr<FHktVoxelRenderCache> TerrainCache;
	TUniquePtr<FHktVoxelMeshScheduler> TerrainMeshScheduler;
	TUniquePtr<IHktVoxelChunkLoader> Loader;
	TUniquePtr<FHktTerrainGenerator> Generator;

	/** 활성 청크 → 컴포넌트 매핑 */
	TMap<FIntVector, UHktVoxelChunkComponent*> ActiveChunks;

	/** 비활성 컴포넌트 풀 (재사용) */
	TArray<UHktVoxelChunkComponent*> ComponentPool;

public:
	/** 청크 월드 크기 = SIZE * VoxelSize */
	float GetChunkWorldSize() const { return FHktVoxelChunk::SIZE * VoxelSize; }

	/** 실제 렌더링에 사용되는 머티리얼 — 디버그 모드 시 DebugRenderMaterial, 아니면 TerrainMaterial */
	UMaterialInterface* GetEffectiveTerrainMaterial() const;

	/**
	 * 워터 섹션 유효 머티리얼 — 디버그 모드 시 지형과 동일 머티리얼(일관된 디버그 룩),
	 * 평상시엔 WaterMaterial. nullptr 반환 허용 (ChunkComponent가 TerrainMaterial로 폴백).
	 */
	UMaterialInterface* GetEffectiveWaterMaterial() const;

private:

	// === 스타일 빌드 결과 (BeginPlay에서 생성) ===

	UPROPERTY(Transient)
	TObjectPtr<UHktVoxelTileAtlas> BuiltTileAtlas;

	UPROPERTY(Transient)
	TObjectPtr<UHktVoxelMaterialLUT> BuiltMaterialLUT;

	/** 타일 텍스처 활성 시 기본 팔레트 (8×256 흰색) — GWhiteTexture OOB 버그 방지 */
	UPROPERTY(Transient)
	TObjectPtr<UTexture2D> DefaultPaletteTexture;

	/** 스타일이 빌드되었는지 (BlockStyles가 비어있으면 false → 기존 팔레트 폴백) */
	bool bStyleBuilt = false;

	/** bStylizedRendering 변경 감지용 이전 값 (에디터 라이브 토글 대응) */
	bool bPrevStylizedRendering = false;

	/** NormalMapStrength 변경 감지용 이전 값 */
	float PrevNormalMapStrength = 1.0f;

	/** bDebugRenderMode 변경 감지용 이전 값 */
	bool bPrevDebugRenderMode = false;

	/** 다음 스트리밍 통계 로그 출력 시각 (초) */
	float NextStatsLogTime = 0.f;
};
