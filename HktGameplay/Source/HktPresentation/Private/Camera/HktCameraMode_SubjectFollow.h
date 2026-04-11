// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "Camera/HktCameraModeBase.h"
#include "HktCameraMode_SubjectFollow.generated.h"

/**
 * 선택된 캐릭터 추적 카메라 모드.
 * 제어권을 가진 엔터티만 따라가며, Edge scroll로 임시 오프셋이 가능합니다.
 * 오프셋은 시간에 따라 감쇄되어 대상 중심으로 복귀합니다.
 */
UCLASS()
class HKTPRESENTATION_API UHktCameraMode_SubjectFollow : public UHktCameraModeBase
{
	GENERATED_BODY()

public:
	virtual void OnActivate(AHktRtsCameraPawn* Pawn) override;
	virtual void TickMode(AHktRtsCameraPawn* Pawn, float DeltaTime) override;
	virtual void OnSubjectChanged(AHktRtsCameraPawn* Pawn, FHktEntityId EntityId) override;

	UPROPERTY(EditAnywhere, Category = "Camera")
	float FollowInterpSpeed = 8.0f;

	UPROPERTY(EditAnywhere, Category = "Camera")
	float EdgeScrollThickness = 0.05f;

	UPROPERTY(EditAnywhere, Category = "Camera")
	float EdgeScrollSpeed = 1500.0f;

	UPROPERTY(EditAnywhere, Category = "Camera")
	float OffsetDecaySpeed = 3.0f;

private:
	void HandleEdgeScrollOffset(AHktRtsCameraPawn* Pawn, float DeltaTime);

	FHktEntityId SubjectEntityId = InvalidEntityId;
	FVector ManualOffset = FVector::ZeroVector;
};
