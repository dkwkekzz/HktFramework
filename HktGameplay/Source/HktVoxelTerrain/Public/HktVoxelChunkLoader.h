// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktVoxelChunkLoader.generated.h"

/**
 * 청크 로딩 전략 추상화.
 *
 * 기존 multi-ring LOD 스트리머(FHktVoxelTerrainStreamer)를 완전히 폐기하고
 * 전략 패턴으로 재설계했다. 회전에 반응하지 않는 "뷰 독립 로더"를 전제로 하여
 * 프러스텀-바이어스 → Retune 피드백 루프를 구조적으로 제거한다.
 *
 * 현재 두 구현:
 *   - FHktLegacyChunkLoader   : 단일 반경 내 모든 청크를 Tier 0(풀 디테일)로 로드
 *   - FHktProximityChunkLoader: 근거리(Tier 0 풀) + 원거리(Tier 1 간이 메시) 2링
 *
 * 추가 방식이 필요할 때 이 인터페이스를 구현하고 EHktVoxelLoaderType에 enum 값을 추가하면 된다.
 */

/** 청크 Tier — 로더가 정하는 품질 계층. 현재 2단계만 사용. */
enum class EHktVoxelChunkTier : uint8
{
	Near = 0,  // 풀 디테일 (LOD 0 메시, 풀 머티리얼, 그림자/콜리전 ON)
	Far  = 1,  // 간이 메시 (다운샘플 LOD, 스트립 머티리얼, 그림자/콜리전 OFF)
};

/** 단일 청크의 로드/리티어 요청 — 좌표 + Tier. */
struct FHktChunkTierRequest
{
	FIntVector Coord = FIntVector::ZeroValue;
	EHktVoxelChunkTier Tier = EHktVoxelChunkTier::Near;
};

/**
 * IHktVoxelChunkLoader — 청크 로딩 전략 인터페이스.
 *
 * 모든 구현은 다음 원칙을 준수한다:
 *   1. 뷰 무관 — 카메라 회전에 반응하지 않음 (Update 인자에 Rotation/FOV 없음)
 *   2. 카메라가 청크 경계를 넘을 때만 전체 재계산 (그 외엔 no-op)
 *   3. 결과는 Load/Unload/Retier 세 배열로 분리 배출
 */
class HKTVOXELTERRAIN_API IHktVoxelChunkLoader
{
public:
	virtual ~IHktVoxelChunkLoader() = default;

	/**
	 * 스트리밍 업데이트. 호출 후 GetChunksToLoad/Unload/Retier로 결과 조회.
	 * @param CameraPos      카메라 월드 위치
	 * @param ChunkWorldSize 청크 1변 월드 크기 (= SIZE * VoxelSize)
	 */
	virtual void Update(const FVector& CameraPos, float ChunkWorldSize) = 0;

	/** 신규 로드 요청 (좌표 + Tier) */
	virtual const TArray<FHktChunkTierRequest>& GetChunksToLoad() const = 0;

	/** 언로드 요청 */
	virtual const TArray<FIntVector>& GetChunksToUnload() const = 0;

	/** 이미 로드된 청크의 Tier만 변경 (메시 재생성, Voxel 데이터 보존) */
	virtual const TArray<FHktChunkTierRequest>& GetChunksToRetier() const = 0;

	/** 현재 로드된 청크 → Tier 매핑 (통계/디버그용) */
	virtual const TMap<FIntVector, EHktVoxelChunkTier>& GetLoadedChunks() const = 0;

	/** 테레인 높이 범위 (Z축 청크 좌표) */
	virtual void SetHeightRange(int32 MinZ, int32 MaxZ) = 0;

	/** 동시 로드 최대 청크 수 (메모리 예산). 0이면 제한 없음 */
	virtual void SetMaxLoadedChunks(int32 Max) = 0;

	/** 프레임당 최대 로드 수 (per-frame budget) */
	virtual void SetMaxLoadsPerFrame(int32 Max) = 0;

	/** 내부 상태 초기화 — BeginPlay/EndPlay에서 호출 */
	virtual void Clear() = 0;

	/** Tier별 로드된 청크 수 집계 (디버그용). 인덱스 = Tier */
	virtual void GetTierHistogram(int32 OutCounts[2]) const = 0;
};

/** 로더 종류 선택자 — UPROPERTY에 노출되어 런타임에 전략을 스왑. */
UENUM(BlueprintType)
enum class EHktVoxelLoaderType : uint8
{
	/** LOD 도입 전 동작 — 단일 반경 내 모든 청크를 풀 디테일로 로드. 안전한 폴백. */
	Legacy     UMETA(DisplayName = "Legacy (Single Radius)"),

	/** 근거리 풀 + 원거리 간이 2링. 회전 무관 / 피드백 루프 없음. */
	Proximity  UMETA(DisplayName = "Proximity (Near/Far Ring)"),
};

/** 로더 팩토리 — enum을 인스턴스로 변환 */
HKTVOXELTERRAIN_API TUniquePtr<IHktVoxelChunkLoader> CreateVoxelChunkLoader(EHktVoxelLoaderType Type);
