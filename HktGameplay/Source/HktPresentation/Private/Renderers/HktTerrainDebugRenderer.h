// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "HktPresentationRenderer.h"
#include "HktPresentationState.h"

class ULocalPlayer;

#if ENABLE_HKT_INSIGHTS

/**
 * 지형 복셀 디버그 렌더러.
 * Subject 엔티티 주변의 복셀 솔리드/빈 공간을 DrawDebug 와이어프레임으로 시각화하여
 * 시뮬레이션 충돌과 실제 렌더 메시 간의 불일치를 시각적으로 확인할 수 있다.
 *
 * 콘솔 명령:
 *   hkt.Debug.ShowTerrainVoxels       0=끄기, 1=솔리드만, 2=솔리드+빈공간 그리드
 *   hkt.Debug.TerrainVoxelRadius      복셀 반경 (기본 3)
 *   hkt.Debug.ShowTerrainVoxelLabels  0=끄기, 1=복셀 좌표 표시
 */
class FHktTerrainDebugRenderer : public IHktPresentationRenderer
{
public:
	explicit FHktTerrainDebugRenderer(ULocalPlayer* InLP);

	virtual void Sync(const FHktPresentationState& State) override;
	virtual void Teardown() override;
	virtual bool NeedsTick() const override { return true; }

private:
	void DrawTerrainVoxels(UWorld* World, const FHktPresentationState& State);

	TWeakObjectPtr<ULocalPlayer> LocalPlayer;
};

#endif // ENABLE_HKT_INSIGHTS
