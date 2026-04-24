// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "HktVoxelSpriteTerrainActor.generated.h"

class UNiagaraComponent;
class UNiagaraSystem;
class UHktVoxelTerrainNDI;
class AHktVoxelTerrainActor;
class FHktVoxelRenderCache;

/**
 * FHktVoxelSurfaceCell — 가시 영역 top-most voxel 1개.
 *
 * 카메라(IsometricOrtho, Pitch=-60°, Yaw=45°)에서 보이는 최상단 셀만 추출하여
 * Niagara Data Interface 버퍼로 업로드한다.
 */
struct FHktVoxelSurfaceCell
{
	FVector WorldPos = FVector::ZeroVector;  // 셀 중심 월드 좌표 (UU)
	uint16  TypeID = 0;                      // HktTerrainType
	uint8   PaletteIndex = 0;                // 0~7
	uint8   Flags = 0;                       // FHktVoxel::FLAG_*
};

/**
 * AHktVoxelSpriteTerrainActor
 *
 * AHktVoxelTerrainActor와 병렬 배치 가능한 스프라이트 기반 테레인 렌더러.
 * 카메라(IsometricOrtho) 고정 전제로, 가시 영역 top-most voxel 1셀을 1 particle로
 * 치환하여 Niagara System + Sprite Renderer로 단일 DC에 그린다.
 *
 * 데이터 흐름:
 *   FHktVoxelRenderCache (공용, 기존 Voxel 경로와 공유)
 *     → ScanVisibleTopSurface()  (Game Thread, Tick)
 *     → FHktVoxelSurfaceCell 배열
 *     → UHktVoxelTerrainNDI::PushSurfaceCells()
 *     → Niagara Simulation Stage → Sprite Renderer
 *
 * 기존 AHktVoxelTerrainActor의 메싱/청크 컴포넌트 경로와 독립적이며,
 * 월드에 둘 중 하나만 활성화하거나 양쪽 모두 스폰 후 bHiddenInGame으로 A/B 비교한다.
 */
UCLASS(ClassGroup = (HktVoxel))
class HKTVOXELTERRAIN_API AHktVoxelSpriteTerrainActor : public AActor
{
	GENERATED_BODY()

public:
	AHktVoxelSpriteTerrainActor();

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
	virtual void Tick(float DeltaSeconds) override;

public:
	/** Niagara 스프라이트 렌더러 — 월드에 1개 배치 */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "HktSprite")
	TObjectPtr<UNiagaraComponent> NiagaraComponent;

	/** 타입별 iso(45°) 아틀라스와 Sprite Renderer를 가진 Niagara System */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite")
	TObjectPtr<UNiagaraSystem> TerrainNiagaraSystem;

	/** 가시 영역 여유(UU) — OrthoWidth 프러스텀 경계 바깥 N UU까지 포함 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Streaming")
	float VisibilityPaddingUU = 240.0f;

	/** 초당 surface 스캔 횟수 상한 — 카메라/월드 변화 없으면 스킵 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Streaming")
	float MaxScansPerSecond = 30.0f;

private:
	/**
	 * 가시 영역 내 로드된 chunk iterate → 청크당 top-most voxel 1개 수집.
	 *
	 * 모바일 orthographic 카메라 기준 가시 청크 ≈ 20개 전제. 청크당 1 particle이므로
	 * GPU 부하는 Niagara에서 무시 가능. XY-평면 반경 체크로 frustum 근사하며 Z는 무시
	 * (iso 고정 각도라 세부 frustum이 불필요).
	 */
	void ScanVisibleTopSurface(TArray<FHktVoxelSurfaceCell>& OutCells) const;

	/** 스트리밍/가시성 기준점 — Pawn이 있으면 Pawn, 없으면 PC ViewPoint */
	FVector GetViewCenterWorldPos() const;

	/**
	 * RenderCache resolver — 월드에 배치된 AHktVoxelTerrainActor의 공용 캐시를 참조한다.
	 *
	 * 설계 결정: Voxel Actor의 데이터 파이프라인(Loader/Generator/Cache)을 재사용하여
	 * 메모리 복제와 중복 스트리밍을 피한다. Sprite-only 배포 시엔 Voxel Actor의
	 * 렌더링(ChunkComponent)만 별도 토글로 끄고 데이터 피드는 유지한다.
	 *
	 * Voxel Actor가 월드에 없으면 nullptr을 반환하고 Tick은 no-op으로 동작.
	 */
	FHktVoxelRenderCache* ResolveRenderCache() const;

	/** Niagara User Parameter로 바인딩되는 DI 인스턴스 */
	UPROPERTY(Transient)
	TObjectPtr<UHktVoxelTerrainNDI> TerrainNDI;

	/** 마지막 스캔 시각 (GetWorld()->GetTimeSeconds 기준) */
	float LastScanTime = -FLT_MAX;

	/** 월드 스캔 결과 캐시 — 매 Tick FindActorOfClass 재호출 방지 */
	mutable TWeakObjectPtr<AHktVoxelTerrainActor> CachedSourceActor;
};
