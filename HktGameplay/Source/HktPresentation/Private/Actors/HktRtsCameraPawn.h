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
class UHktCameraMode_RtsView;
class UHktCameraMode_ShoulderView;
class UHktCameraMode_IsometricOrtho;
class UHktCameraMode_IsometricGame;

/**
 * RTS 스타일 카메라 이동·줌을 담당하는 폰.
 * PlayerController가 이 폰을 Possess합니다.
 *
 * 카메라 모드는 4종(RtsView/ShoulderView/IsometricOrtho/IsometricGame)을 지원하며,
 * 모든 모드는 "내 엔티티가 있으면 추적, 없으면 자체 컨트롤(edge-scroll)" 계약을 따릅니다.
 * 기본 모드는 BP에서 DefaultCameraMode UPROPERTY로 지정합니다.
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
	UFUNCTION(BlueprintCallable, Category = "Camera")
	void SetCameraMode(EHktCameraMode NewMode);

	UFUNCTION(BlueprintCallable, Category = "Camera")
	EHktCameraMode GetCameraMode() const { return ActiveModeType; }

	// === 모드에서 사용할 접근자 ===
	USpringArmComponent* GetSpringArm() const { return SpringArm; }
	UCameraComponent* GetCamera() const { return Camera; }
	APlayerController* GetBoundPC() const { return BoundPlayerController.Get(); }
	float GetZoomSpeed() const { return ZoomSpeed; }
	float GetMinZoom() const { return MinZoom; }
	float GetMaxZoom() const { return MaxZoom; }

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

	/** BeginPlay 시 활성화될 카메라 모드. BP에서 기본값 변경 가능. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera")
	EHktCameraMode DefaultCameraMode = EHktCameraMode::RtsView;

	// === 카메라 모드 인스턴스 ===
	UPROPERTY(Instanced, EditAnywhere, Category = "Camera|Modes")
	TObjectPtr<UHktCameraMode_RtsView> RtsViewMode;

	UPROPERTY(Instanced, EditAnywhere, Category = "Camera|Modes")
	TObjectPtr<UHktCameraMode_ShoulderView> ShoulderViewMode;

	UPROPERTY(Instanced, EditAnywhere, Category = "Camera|Modes")
	TObjectPtr<UHktCameraMode_IsometricOrtho> IsometricOrthoMode;

	UPROPERTY(Instanced, EditAnywhere, Category = "Camera|Modes")
	TObjectPtr<UHktCameraMode_IsometricGame> IsometricGameMode;

private:
	void OnSubjectChanged(FHktEntityId EntityId);

	UHktCameraModeBase* GetModeInstance(EHktCameraMode Mode) const;

	UHktCameraModeBase* ActiveMode = nullptr;
	EHktCameraMode ActiveModeType = EHktCameraMode::RtsView;

	/** 현재 Subject — Interaction에서 받은 raw entity. 모드 전환/Subject 변경 시 모드에 전파. */
	FHktEntityId CurrentSubjectEntityId = InvalidEntityId;

	/** 카메라 뷰 변경 감지용 캐시 */
	FVector CachedCameraLocation = FVector::ZeroVector;
	FRotator CachedCameraRotation = FRotator::ZeroRotator;
	float CachedArmLength = 0.f;

	FDelegateHandle WheelInputHandle;
	FDelegateHandle SubjectChangedHandle;
	TWeakObjectPtr<class APlayerController> BoundPlayerController;
};
