// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "PreviewScene.h"
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

	// === Editor Preview =================================================
	// 캡처 출력 RT 와 별도로, 에디터 패널에 실시간 표시할 프리뷰 RT 를 운영한다.
	// 같은 SceneCaptureComponent 를 공유하되, 캡처 시에는 출력 RT 로 잠시 swap.

	/** 프리뷰용 RT 를 (재)생성. Initialize 이후 호출 가능. */
	bool InitializePreviewRT(int32 PreviewWidth, int32 PreviewHeight, FString& OutError);

	/** 프리뷰 1프레임 렌더 — 출력 RT 는 건드리지 않는다. */
	void RenderPreview();

	/** 카메라/프리셋/오프셋이 변경됐을 때 씬 재구성 없이 SCC 만 갱신. */
	void UpdateCameraSettings(const FHktAnimCaptureSettings& NewSettings);

	/** 조명 설정만 갱신 — 메시/RT 그대로, 라이트 컴포넌트만 재구성. */
	void UpdateLightingSettings(const FHktAnimCaptureSettings& NewSettings);

	UTextureRenderTarget2D* GetPreviewRenderTarget() const { return PreviewRT; }

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

	TUniquePtr<FPreviewScene> Preview;

	TObjectPtr<USkeletalMeshComponent> MeshComp = nullptr;
	TObjectPtr<USceneCaptureComponent2D> CaptureComp = nullptr;
	TObjectPtr<UTextureRenderTarget2D> RenderTarget = nullptr;
	// 에디터 프리뷰 패널용 RT — 출력 RT 와 별개. 미사용 시 nullptr.
	TObjectPtr<UTextureRenderTarget2D> PreviewRT = nullptr;
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
