// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Camera/CameraTypes.h"
#include "UObject/Object.h"
#include "HktCameraFramingProfile.generated.h"

class AHktRtsCameraPawn;

/**
 * 카메라의 "뷰" 관심사를 캡슐화한 프로필.
 * ProjectionMode(Perspective/Orthographic), 기본 Pitch/Yaw, FOV/OrthoWidth,
 * SpringArm 길이/소켓오프셋, Pitch 클램프 범위를 소유합니다.
 *
 * 추적(Tracking)·입력(Control)과 분리된 관점에서 "어떤 각도·투영·거리로 보이는가"만 정의하며,
 * 각 카메라 모드는 이 프로필 인스턴스를 하나 가지고 OnActivate/OnDeactivate에서
 * Apply/Restore로 일괄 적용·원복합니다.
 *
 * 런타임 회전 값(마우스 누적 Yaw/Pitch 등)은 여기 보관하지 않습니다.
 * 기본값과 클램프 범위만 제공하며, 모드가 보유한 런타임 상태가 이를 참조합니다.
 */
UCLASS(Blueprintable, DefaultToInstanced, EditInlineNew)
class HKTPRESENTATION_API UHktCameraFramingProfile : public UObject
{
	GENERATED_BODY()

public:
	// === 투영 ===
	UPROPERTY(EditAnywhere, Category = "Framing|Projection")
	TEnumAsByte<ECameraProjectionMode::Type> ProjectionMode = ECameraProjectionMode::Perspective;

	/** Perspective일 때 FOV (도) */
	UPROPERTY(EditAnywhere, Category = "Framing|Projection", meta = (EditCondition = "ProjectionMode==ECameraProjectionMode::Perspective"))
	float FieldOfView = 90.0f;

	/** Orthographic일 때 화면 월드 폭 (언리얼 단위) */
	UPROPERTY(EditAnywhere, Category = "Framing|Projection", meta = (EditCondition = "ProjectionMode==ECameraProjectionMode::Orthographic"))
	float OrthoWidth = 2500.0f;

	UPROPERTY(EditAnywhere, Category = "Framing|Projection", meta = (EditCondition = "ProjectionMode==ECameraProjectionMode::Orthographic"))
	float OrthoNearClip = -10000.0f;

	UPROPERTY(EditAnywhere, Category = "Framing|Projection", meta = (EditCondition = "ProjectionMode==ECameraProjectionMode::Orthographic"))
	float OrthoFarClip = 20000.0f;

	// === 각도 (기본값; 런타임 회전은 모드가 보유) ===
	UPROPERTY(EditAnywhere, Category = "Framing|Angle")
	float DefaultPitch = -60.0f;

	UPROPERTY(EditAnywhere, Category = "Framing|Angle")
	float DefaultYaw = 0.0f;

	/** 마우스 제어 모드에서 Pitch 클램프 범위 */
	UPROPERTY(EditAnywhere, Category = "Framing|Angle")
	float PitchClampMin = -60.0f;

	UPROPERTY(EditAnywhere, Category = "Framing|Angle")
	float PitchClampMax = 60.0f;

	// === SpringArm ===
	UPROPERTY(EditAnywhere, Category = "Framing|SpringArm")
	float DefaultArmLength = 2000.0f;

	UPROPERTY(EditAnywhere, Category = "Framing|SpringArm")
	float MinArmLength = 500.0f;

	UPROPERTY(EditAnywhere, Category = "Framing|SpringArm")
	float MaxArmLength = 4000.0f;

	/** 소켓 오프셋 — 어깨뷰 등에서 카메라를 좌우/상하로 밀 때 사용 */
	UPROPERTY(EditAnywhere, Category = "Framing|SpringArm")
	FVector SocketOffset = FVector::ZeroVector;

	// === 줌 ===
	/** Perspective: ArmLength 1 틱당 변화량. Ortho: OrthoWidth 1 틱당 변화량 */
	UPROPERTY(EditAnywhere, Category = "Framing|Zoom")
	float ZoomStep = 200.0f;

	/** Orthographic일 때 OrthoWidth 클램프 최소 */
	UPROPERTY(EditAnywhere, Category = "Framing|Zoom", meta = (EditCondition = "ProjectionMode==ECameraProjectionMode::Orthographic"))
	float MinOrthoWidth = 800.0f;

	UPROPERTY(EditAnywhere, Category = "Framing|Zoom", meta = (EditCondition = "ProjectionMode==ECameraProjectionMode::Orthographic"))
	float MaxOrthoWidth = 6000.0f;

	/**
	 * Pawn의 SpringArm/Camera에 이 프로필을 일괄 적용.
	 * 기존 세팅은 내부 백업 필드에 저장되어 Restore()로 원복 가능.
	 */
	void Apply(AHktRtsCameraPawn* Pawn);

	/** Apply()로 저장된 이전 세팅을 복원. */
	void Restore(AHktRtsCameraPawn* Pawn);

	/**
	 * 줌 입력 처리 — ProjectionMode에 따라 ArmLength 또는 OrthoWidth를 조정.
	 * 현재 값은 프로필 UPROPERTY에 기록되어 세션 내 지속성을 가짐.
	 */
	void HandleZoom(AHktRtsCameraPawn* Pawn, float Value);

	/** SpringArm 회전을 (DefaultPitch, DefaultYaw)로 초기화. 런타임 회전이 없을 때 사용. */
	void ApplyDefaultRotation(AHktRtsCameraPawn* Pawn) const;

private:
	// Apply() 시 백업된 이전 세팅 (Restore에서 복원)
	bool bApplied = false;
	uint8 SavedProjectionMode = 0;
	float SavedFOV = 90.0f;
	float SavedOrthoWidth = 0.0f;
	float SavedArmLength = 0.0f;
	FRotator SavedArmRotation = FRotator::ZeroRotator;
	FVector SavedSocketOffset = FVector::ZeroVector;
};
