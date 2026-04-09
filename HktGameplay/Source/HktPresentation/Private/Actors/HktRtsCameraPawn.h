// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktCoreDefs.h"
#include "Camera/HktCameraModeTypes.h"
#include "GameFramework/SpectatorPawn.h"
#include "HktRtsCameraPawn.generated.h"

class USpringArmComponent;
class UCameraComponent;
class UHktCameraModeBase;
class UHktCameraMode_RtsFree;
class UHktCameraMode_SubjectFollow;

/**
 * RTS 스타일 카메라 이동·줌을 담당하는 폰.
 * PlayerController가 이 폰을 Possess합니다.
 * 카메라 모드 시스템을 통해 다양한 카메라 동작을 지원합니다.
 */
UCLASS()
class HKTPRESENTATION_API AHktRtsCameraPawn : public ASpectatorPawn
{
	GENERATED_BODY()

public:
	AHktRtsCameraPawn();

	/** 마우스 휠 등으로 호출할 줌 처리 */
	void HandleZoom(float Value);

	/** 카메라 모드 전환 */
	void SetCameraMode(EHktCameraMode NewMode);
	EHktCameraMode GetCameraMode() const { return ActiveModeType; }

	// === 모드에서 사용할 접근자 ===
	USpringArmComponent* GetSpringArm() const { return SpringArm; }
	UCameraComponent* GetCamera() const { return Camera; }
	APlayerController* GetBoundPC() const { return BoundPlayerController.Get(); }
	float GetZoomSpeed() const { return ZoomSpeed; }
	float GetMinZoom() const { return MinZoom; }
	float GetMaxZoom() const { return MaxZoom; }
	int64 GetCachedPlayerUid() const { return CachedPlayerUid; }

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
	virtual void Tick(float DeltaTime) override;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Camera")
	TObjectPtr<USpringArmComponent> SpringArm;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Camera")
	TObjectPtr<UCameraComponent> Camera;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Camera")
	float ZoomSpeed = 100.0f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Camera")
	float MinZoom = 500.0f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Camera")
	float MaxZoom = 4000.0f;

	// === 카메라 모드 ===
	UPROPERTY(Instanced, EditAnywhere, Category = "Camera|Modes")
	TObjectPtr<UHktCameraMode_RtsFree> RtsFreeMode;

	UPROPERTY(Instanced, EditAnywhere, Category = "Camera|Modes")
	TObjectPtr<UHktCameraMode_SubjectFollow> SubjectFollowMode;

private:
	void OnSubjectChanged(FHktEntityId EntityId);

	/** 엔티티 소유권 검증: PlayerUid가 일치하는지 확인 */
	bool IsOwnedEntity(FHktEntityId EntityId) const;

	UHktCameraModeBase* GetModeInstance(EHktCameraMode Mode) const;

	UHktCameraModeBase* ActiveMode = nullptr;
	EHktCameraMode ActiveModeType = EHktCameraMode::RtsFree;

	int64 CachedPlayerUid = 0;

	/** PlayerUid 미확정 시 Subject를 보류하고, Uid 확정 후 재평가 */
	FHktEntityId PendingSubjectEntityId = InvalidEntityId;
	FHktEntityId CurrentSubjectEntityId = InvalidEntityId;

	/** 카메라 뷰 변경 감지용 캐시 */
	FVector CachedCameraLocation = FVector::ZeroVector;
	FRotator CachedCameraRotation = FRotator::ZeroRotator;
	float CachedArmLength = 0.f;

	FDelegateHandle WheelInputHandle;
	FDelegateHandle SubjectChangedHandle;
	TWeakObjectPtr<class APlayerController> BoundPlayerController;
};
