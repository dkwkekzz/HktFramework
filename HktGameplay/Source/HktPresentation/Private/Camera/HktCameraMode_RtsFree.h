// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "Camera/HktCameraModeBase.h"
#include "HktCameraMode_RtsFree.generated.h"

/**
 * RTS 자유 카메라 모드.
 * 화면 가장자리에서 스크롤하고, 선택 없을 때 새로 스폰된 엔터티를 자동 추적합니다.
 */
UCLASS()
class UHktCameraMode_RtsFree : public UHktCameraModeBase
{
	GENERATED_BODY()

public:
	virtual void OnActivate(AHktRtsCameraPawn* Pawn) override;
	virtual void TickMode(AHktRtsCameraPawn* Pawn, float DeltaTime) override;
	virtual void OnSubjectChanged(AHktRtsCameraPawn* Pawn, FHktEntityId EntityId) override;

	UPROPERTY(EditAnywhere, Category = "Camera")
	float EdgeScrollThickness = 0.05f;

	UPROPERTY(EditAnywhere, Category = "Camera")
	float CameraScrollSpeed = 3000.0f;

	UPROPERTY(EditAnywhere, Category = "Camera")
	float FollowInterpSpeed = 5.0f;

private:
	void HandleEdgeScroll(AHktRtsCameraPawn* Pawn, float DeltaTime);
	void FollowNewSpawn(AHktRtsCameraPawn* Pawn, float DeltaTime);

	FHktEntityId FollowTargetEntityId = InvalidEntityId;
	bool bFollowNewSpawn = true;
};
