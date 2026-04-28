// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "PreviewScene.h"
#include "HktAnimCaptureTypes.h"

class USkeletalMesh;
class UAnimSequence;
class USkeletalMeshComponent;
class USceneCaptureComponent2D;
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
class FHktAnimCaptureScene
{
public:
	FHktAnimCaptureScene();
	~FHktAnimCaptureScene();

	bool Initialize(const FHktAnimCaptureSettings& Settings, FString& OutError);

	/** 0..NumDirections-1. 8방향 기준으로 South=0, SE=1, E=2, NE=3, N=4, NW=5, W=6, SW=7. */
	void SetDirectionIndex(int32 DirectionIdx);

	/** AnimSequence 의 절대 시간(초)으로 포즈 평가. */
	void SetAnimationTime(float TimeSec);

	/** 현재 RT 를 PNG 로 저장. true=성공. AutoCrop/패딩은 Settings 적용. */
	bool CaptureToFile(const FString& AbsolutePngPath, FString& OutError);

	/** AnimSequence 의 길이(초). 미지정 시 0. */
	float GetAnimSequenceLength() const { return AnimLengthSec; }

private:
	void ApplyCameraFraming(const FHktAnimCaptureSettings& Settings);
	void UpdateCameraTransform();
	void TickPose();

	// Render-target 픽셀을 읽어 PNG 바이너리로 인코딩(필요 시 자르기/패딩 적용).
	bool EncodePng(TArray64<uint8>& OutPng, FString& OutError) const;

	TUniquePtr<FPreviewScene> Preview;

	TObjectPtr<USkeletalMeshComponent> MeshComp = nullptr;
	TObjectPtr<USceneCaptureComponent2D> CaptureComp = nullptr;
	TObjectPtr<UTextureRenderTarget2D> RenderTarget = nullptr;

	FHktAnimCaptureSettings CachedSettings;

	// 메시 바운드 중심 — SpringArm pivot 으로 사용.
	FVector SubjectFocus = FVector::ZeroVector;

	// HktCameraFramingProfile::SocketOffset 와 동일 의미 — SpringArm 회전 좌표계에서
	// (Forward, Right, Up) 으로 카메라를 살짝 미는 오프셋 (어깨뷰 등).
	FVector CachedSocketOffset = FVector::ZeroVector;

	int32 CurrentDirectionIdx = 0;
	float AnimLengthSec = 0.0f;
};
