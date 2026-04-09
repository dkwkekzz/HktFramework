// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktVoxelUnitActorBase.h"
#include "HktVoxelUnitActor.generated.h"

struct FHktVoxelBoneGroup;

/**
 * GPU 스키닝 복셀 캐릭터.
 *
 * 단일 BodyChunk에 모든 복셀을 담고, 버텍스별 본 인덱스를 패킹.
 * 셰이더에서 본 트랜스폼을 적용하여 스켈레톤 애니메이션을 구현한다.
 * 1 draw call, 부드러운 버텍스 변형.
 */
UCLASS(Blueprintable)
class AHktVoxelUnitActor : public AHktVoxelUnitActorBase
{
	GENERATED_BODY()

protected:
	virtual void OnBoneDataAvailable(const TArray<FHktVoxelBoneGroup>& BoneGroups) override;
	virtual void OnBoneDataUnavailable() override;
	virtual bool IsBoneAnimationActive() const override { return bGPUSkinningActive; }
	virtual void TickAnimation(float DeltaTime) override;

private:
	void InitializeGPUSkinning(const TArray<FHktVoxelBoneGroup>& BoneGroups);
	void UpdateBoneTransformsFromSkeleton();

	bool bGPUSkinningActive = false;
	TMap<FName, uint8> BoneNameToIndex;
};
