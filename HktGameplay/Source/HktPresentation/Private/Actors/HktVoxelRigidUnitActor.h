// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktVoxelUnitActorBase.h"
#include "HktVoxelRigidUnitActor.generated.h"

struct FHktVoxelBoneGroup;

/**
 * 리지드 본 복셀 캐릭터.
 *
 * 본마다 별도의 UHktVoxelChunkComponent를 생성하고
 * HiddenSkeleton의 본 소켓에 어태치하여 애니메이션을 구현한다.
 * 각 파츠가 변형 없이 통째로 본을 따라 움직이는 방식.
 * 마인크래프트 스타일의 블록 관절 느낌.
 */
UCLASS(Blueprintable)
class AHktVoxelRigidUnitActor : public AHktVoxelUnitActorBase
{
	GENERATED_BODY()

public:
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

protected:
	virtual void OnBoneDataAvailable(const TArray<FHktVoxelBoneGroup>& BoneGroups) override;
	virtual void OnBoneDataUnavailable() override;
	virtual bool IsBoneAnimationActive() const override { return bBoneAnimatedMode; }
	virtual void OnPaletteChanged(uint8 NewPaletteRow) override;
	virtual void PollMeshReady() override;

private:
	void InitializeBoneChunks(const TArray<FHktVoxelBoneGroup>& BoneGroups);
	void TeardownBoneChunks();

	TMap<FName, TObjectPtr<UHktVoxelChunkComponent>> BoneChunks;
	TMap<FName, FIntVector> BoneChunkCoords;
	bool bBoneAnimatedMode = false;
};
