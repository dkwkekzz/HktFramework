// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "AdvancedPreviewScene.h"
#include "UObject/GCObject.h"
#include "HktAnimCaptureTypes.h"

class USkeletalMesh;
class UAnimSequence;
class USkeletalMeshComponent;
class USceneCaptureComponent2D;
class UDirectionalLightComponent;
class USkyLightComponent;
class UTextureRenderTarget2D;

/**
 * FHktAnimCaptureScene
 *
 * 에디터 단독 캡처용 미니 씬.
 *  - 자체 FPreviewScene(World) 소유 — 어떤 활성 게임 World 도 건드리지 않음.
 *  - SkeletalMeshComponent: AnimationSingleNode 모드로 AnimSequence 를 evaluate.
 *  - SceneCaptureComponent2D: TextureRenderTarget2D 로 오프스크린 렌더.
 *
 * 사용 방식:
 *   FHktAnimCaptureScene Scene;
 *   if (!Scene.Initialize(Settings, OutError)) return false;
 *   for (Direction in 0..N-1) {
 *      Scene.SetDirectionIndex(Direction);
 *      for (FrameIdx in 0..F-1) {
 *         Scene.SetAnimationTime(t);
 *         Scene.CaptureToFile(PngPath);
 *      }
 *   }
 *   // 자동 RAII 해제
 */
class FHktAnimCaptureScene : public FGCObject
{
public:
	FHktAnimCaptureScene();
	virtual ~FHktAnimCaptureScene();

	bool Initialize(const FHktAnimCaptureSettings& Settings, FString& OutError);

	/** 0..NumDirections-1. 8방향 기준으로 South=0, SE=1, E=2, NE=3, N=4, NW=5, W=6, SW=7. */
	void SetDirectionIndex(int32 DirectionIdx);

	/** AnimSequence 의 절대 시간(초)으로 포즈 평가. */
	void SetAnimationTime(float TimeSec);

	/** 현재 RT 를 PNG 로 저장. true=성공. AutoCrop/패딩은 Settings 적용. */
	bool CaptureToFile(const FString& AbsolutePngPath, FString& OutError);

	/** AnimSequence 의 길이(초). 미지정 시 0. */
	float GetAnimSequenceLength() const { return AnimLengthSec; }

	// FGCObject ===========================================================
	virtual void AddReferencedObjects(FReferenceCollector& Collector) override;
	virtual FString GetReferencerName() const override { return TEXT("FHktAnimCaptureScene"); }

private:
	void ApplyCameraFraming(const FHktAnimCaptureSettings& Settings);
	void ApplyLighting(const FHktAnimCaptureSettings& Settings);
	void UpdateCameraTransform();
	void TickPose();

	// Render-target 픽셀을 읽어 PNG 바이너리로 인코딩(필요 시 자르기/패딩 적용).
	bool EncodePng(TArray64<uint8>& OutPng, FString& OutError) const;

	// FAdvancedPreviewScene — 엔진 표준 SkeletalMesh 에디터 프리뷰와 동일한
	// HDRI 스카이/큐브맵을 제공. 캡처용 SCC 의 Atmosphere/Fog ShowFlag 를
	// 토글하여 프리뷰 시점에만 스카이가 보이게 한다(캡처 시는 OFF — 알파 보존).
	TUniquePtr<FAdvancedPreviewScene> Preview;

	TObjectPtr<USkeletalMeshComponent> MeshComp = nullptr;
	TObjectPtr<USceneCaptureComponent2D> CaptureComp = nullptr;
	TObjectPtr<UTextureRenderTarget2D> RenderTarget = nullptr;
	// Settings 의 KeyLight/FillLight 가 만들어지는 추가 광원. bEnable* 가 false 면 nullptr.
	TObjectPtr<UDirectionalLightComponent> KeyLight = nullptr;
	TObjectPtr<UDirectionalLightComponent> FillLight = nullptr;
	// 추가 ambient — Settings.ExtraSkyLightIntensity > 0 일 때만.
	TObjectPtr<USkyLightComponent> ExtraSkyLight = nullptr;

	FHktAnimCaptureSettings CachedSettings;

	// 메시 바운드 중심 — SpringArm pivot 으로 사용.
	FVector SubjectFocus = FVector::ZeroVector;

	// HktCameraFramingProfile::SocketOffset 와 동일 의미 — SpringArm 회전 좌표계에서
	// (Forward, Right, Up) 으로 카메라를 살짝 미는 오프셋 (어깨뷰 등).
	FVector CachedSocketOffset = FVector::ZeroVector;

	int32 CurrentDirectionIdx = 0;
	float AnimLengthSec = 0.0f;
};
