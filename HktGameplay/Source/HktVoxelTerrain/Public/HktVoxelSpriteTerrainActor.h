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
 *
 * ============================================================================
 * [Niagara System 에셋 스펙 — NS_HktSpriteTerrain]
 * ============================================================================
 * 본 Actor는 UNiagaraComponent를 소유하지만 Niagara System(.uasset)은 에디터에서
 * 별도 제작한다. 아래 규약을 지켜야 Actor가 올바르게 바인딩된다.
 *
 * [User Parameters (Array Data Interface)]
 *   - Positions      : NiagaraDataInterfaceArrayPosition  ← FVector[]
 *   - TypeIDs        : NiagaraDataInterfaceArrayInt32     ← int32[] (HktTerrainType)
 *   - PaletteIndices : NiagaraDataInterfaceArrayInt32     ← int32[] (0~7)
 *   - Flags          : NiagaraDataInterfaceArrayInt32     ← int32[] (FLAG_TRANSLUCENT 등)
 *   이름은 AHktVoxelSpriteTerrainActor의 ParamName_* UPROPERTY로 오버라이드 가능.
 *
 * [Emitter 구성 — 최소 2개]
 *   1) Emitter_Opaque
 *        - Spawn Burst (1 tick, Count = Positions.Length)  또는
 *          Niagara "Sample Array" 템플릿으로 per-index 스폰
 *        - Flags[i] & 0x01 == 0  인 particle만 통과 (Particles.Kill 게이트)
 *   2) Emitter_Translucent
 *        - 동일 패턴, Flags[i] & 0x01 == 1 게이트
 *        - Sprite Renderer의 Material Domain = Translucent
 *
 * [Particle Attribute 바인딩 (Spawn 또는 Particle Update)]
 *   Particles.Position       ← Positions.Sample(i)
 *   Particles.SubImageIndex  ← TypeIDs.Sample(i)           (아틀라스 프레임 인덱스)
 *   Particles.Color.a        ← PaletteIndices.Sample(i)/7  (셰이더에서 팔레트 lookup)
 *   Particles.Lifetime       ← 0 (정적) 또는 매우 짧음 + 재스폰 by dirty
 *
 * [Sprite Renderer 설정 — 고정 카메라 iso 뷰 전제]
 *   - Facing Mode         : Custom Facing Vector
 *   - Facing Vector (월드): 카메라 forward의 반대 고정 벡터
 *                            IsometricOrtho(Pitch=-60°, Yaw=45°) 기준
 *                            Forward ≈ (cos(-60°)*cos(45°), cos(-60°)*sin(45°), sin(-60°))
 *                                    ≈ (0.354, 0.354, -0.866) → Facing = -Forward
 *   - Alignment           : Custom Alignment (월드 +Z up)
 *   - Pivot Offset        : (0.5, 1.0) — bottom-center (타일이 복셀 바닥에 앉도록)
 *   - Size                : Chunk WorldSize(480 UU) 기준 — 1 particle이 1 chunk top tile
 *   - Sub UV              : 1D horizontal strip, Sub Image Size = (1/NumTypes, 1)
 *   - Material            : M_HktSpriteTerrain (Atlas Texture2DArray 또는 SubUV Texture2D)
 *
 * [업데이트 주기]
 *   Actor Tick이 매 프레임 PushSurfaceCells 호출 (MaxScansPerSecond 상한 적용).
 *   Array DI 는 GPU에 자동 재업로드되므로 추가 dirty 신호 불필요.
 *   Emitter Lifetime을 "무한"으로 두지 말 것 — Array 길이 변경 시 Respawn 필요.
 *   권장: Emitter Loop = Infinite, SpawnBurst per frame, Particles.Lifetime = Delta Time + 1틱.
 * ============================================================================
 *
 * ============================================================================
 * [아틀라스 베이크 파이프라인 — T_HktSpriteTerrainAtlas]
 * ============================================================================
 * 33 타입 × 1방향(iso 고정) = 33 프레임. Yaw 회전 비활성이므로 방향 바리에이션 불필요.
 *
 * [아틀라스 레이아웃]
 *   - 크기       : 모바일 기준 프레임당 128×128 px → 아틀라스 4224×128 (1D strip)
 *                   또는 8×5 그리드 (1024×640)로 mip 친화적 레이아웃
 *   - Frame 순서 : HktTerrainType 열거값 순서와 동일 (Air=0은 빈 프레임)
 *                   SubImageIndex = TypeID 직접 매핑
 *   - 포맷       : BC7 / ASTC 6×6 (모바일) — 알파 채널로 투명 배경 보존
 *   - sRGB       : ON (diffuse)
 *
 * [렌더 파라미터 — 모든 프레임 공통]
 *   - 카메라      : Orthographic, Yaw=45°, Pitch=-60° (HktCameraMode_IsometricOrtho와 동일)
 *   - OrthoWidth  : 1 voxel cube(15 cm) 투영 시 프레임 90% 차지하도록 조정
 *                   → 아이소에서 대각 ≈ 21 cm → OrthoWidth ≈ 23 cm
 *   - 배경        : 투명 (checker board OFF)
 *   - 조명        : 고정 3점(Key/Fill/Rim) — 프레임간 조명 일관성 필수
 *   - 섀도우      : 자체 그림자 OFF (Sprite Renderer에서 별도 drop shadow)
 *
 * [팔레트 바리에이션]
 *   개별 프레임에 팔레트를 굽지 않는다 — 셰이더에서 런타임 스왑:
 *     1) 베이스 프레임은 grayscale + mask 레이어로 저장
 *     2) M_HktSpriteTerrain이 PaletteIndex로 8색 LUT(Texture2D 8×N)에서 tint 샘플
 *     3) HktTerrainPalette 바이옴별 변주는 LUT row로 처리
 *   이 방식은 기존 UHktVoxelPalette(HktSpriteCore) 관행과 동일.
 *
 * [베이크 도구]
 *   HktGameplayGenerator/McpServer/tools/texture_tools.py 재사용:
 *     - SD WebUI(SD_WEBUI_URL)로 개별 타입 프롬프트 일괄 생성
 *     - 후처리: iso 크롭, alpha matting, 아틀라스 패킹
 *     - UE5 import 시 Texture Group = UI / Compression = BC7 / Mip = Off(1D strip) 또는 Auto
 *
 * [런타임 워크플로]
 *   AHktVoxelSpriteTerrainActor 는 아틀라스를 직접 참조하지 않는다 —
 *   M_HktSpriteTerrain 이 SubImageIndex로 샘플링한다. 타입 추가 시엔
 *   HktTerrainType 열거 + 아틀라스 재베이크만 필요 (Actor/NDI 수정 없음).
 * ============================================================================
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

	// === Niagara User Parameter 이름 매핑 ===
	// Niagara System에서 Array DI 기반 User Parameter로 아래 이름을 노출해야 한다.

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Niagara")
	FName ParamName_Positions = TEXT("Positions");

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Niagara")
	FName ParamName_TypeIDs = TEXT("TypeIDs");

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Niagara")
	FName ParamName_PaletteIndices = TEXT("PaletteIndices");

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "HktSprite|Niagara")
	FName ParamName_Flags = TEXT("Flags");

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
