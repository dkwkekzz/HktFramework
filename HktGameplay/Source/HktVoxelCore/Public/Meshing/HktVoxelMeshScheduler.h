// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Tasks/Task.h"

class FHktVoxelRenderCache;

/**
 * FHktVoxelMeshScheduler
 *
 * 매 Game Thread 프레임 호출. dirty 청크를 카메라 거리 기준으로 우선순위 정렬 후,
 * 프레임당 MaxMeshPerFrame개를 UE::Tasks 워커 스레드에서 비동기 메싱한다.
 */
class HKTVOXELCORE_API FHktVoxelMeshScheduler
{
public:
	explicit FHktVoxelMeshScheduler(FHktVoxelRenderCache* InRenderCache);
	~FHktVoxelMeshScheduler();

	/** 매 프레임 호출 — 카메라 위치 기준으로 dirty 청크 메싱 스케줄링 */
	void Tick(const FVector& CameraPos);

	/** 진행 중인 모든 메싱 태스크 완료 대기 */
	void Flush();

	/** 프레임당 최대 메싱 청크 수 조절 */
	void SetMaxMeshPerFrame(int32 NewMax) { MaxMeshPerFrame = NewMax; }
	int32 GetMaxMeshPerFrame() const { return MaxMeshPerFrame; }

	/** 복셀 크기 설정 (ChunkToWorld 변환에 사용) */
	void SetVoxelSize(float InVoxelSize) { VoxelSize = InVoxelSize; }

	/** 양면 렌더링 여부 설정 (false: terrain용 단면, true: 엔티티용 양면) */
	void SetDoubleSided(bool bInDoubleSided) { bDoubleSided = bInDoubleSided; }

private:
	FHktVoxelRenderCache* RenderCache = nullptr;
	int32 MaxMeshPerFrame = 4;
	float VoxelSize = 15.0f;
	bool bDoubleSided = true;
	TArray<UE::Tasks::FTask> PendingTasks;

	/** 청크 좌표 → 월드 위치 변환 (청크 중심) */
	FVector ChunkToWorld(const FIntVector& ChunkCoord) const;
};
