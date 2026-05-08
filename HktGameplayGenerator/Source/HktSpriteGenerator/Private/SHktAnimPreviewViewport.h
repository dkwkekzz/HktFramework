// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "EditorViewportClient.h"
#include "HktAnimCaptureTypes.h"
#include "SEditorViewport.h"

class FAdvancedPreviewScene;
class UAnimSequence;
class UDirectionalLightComponent;
class USkeletalMesh;
class USkeletalMeshComponent;
class USkyLightComponent;
class UHktCameraFramingProfile;

/**
 * SHktAnimPreviewViewport — AnimCapture 패널 전용 프리뷰 위젯.
 *
 * 기존 SImage(RenderTarget) 경로를 폐기하고 SEditorViewport 표준 경로로 교체한다.
 * StaticMesh/SkeletalMesh 에디터와 동일한 렌더 파이프라인(`FEditorViewportClient` +
 * `FAdvancedPreviewScene`) 을 사용하므로 Stationary SkyLight, Lumen, DFAO, 볼류메트릭
 * 라이트맵 등 표준 라이팅 경로가 모두 정상 동작한다 — SceneCapture2D 경로의 한계
 * (동적 메시에 ambient 미적용, Lumen 차단 등) 가 사라진다.
 *
 * 캡처(PNG 출력)는 별도 경로 — `FHktAnimCaptureScene` 의 SceneCapture2D 가 의도된
 * "평면(BaseColor) 알파 보존" 출력을 그대로 만든다. 본 위젯은 프리뷰 전용.
 */
class FHktAnimPreviewViewportClient : public FEditorViewportClient
{
public:
	FHktAnimPreviewViewportClient(
		const TSharedRef<class SEditorViewport>& InViewport,
		const TSharedRef<FAdvancedPreviewScene>& InScene);

	// FEditorViewportClient ===============================================
	virtual void Tick(float DeltaSeconds) override;

	// FGCObject (FEditorViewportClient 가 이미 상속 — 다중 상속 금지, override 만) ===
	virtual void AddReferencedObjects(FReferenceCollector& Collector) override;
	virtual FString GetReferencerName() const override { return TEXT("FHktAnimPreviewViewportClient"); }

	// 외부 제어 ===========================================================
	/** Settings 전체를 적용 — 메시 교체 / 라이트 / 카메라까지 한 번에 재구성. */
	void Rebuild(const FHktAnimCaptureSettings& Settings);

	/** 라이트 그룹만 재구성 — 메시/카메라는 그대로. */
	void UpdateLighting(const FHktAnimCaptureSettings& Settings);

	/** 카메라 프레이밍/방향만 갱신 — 메시/라이트 그대로. */
	void UpdateCamera(const FHktAnimCaptureSettings& Settings);

	void SetDirectionIndex(int32 DirIdx);
	void SetPlaying(bool bPlay) { bPlaying = bPlay; }
	void SetTime(float TimeSec);

	int32 GetDirectionIndex() const { return CurrentDirectionIdx; }
	float GetTimeSec() const { return CurrentTimeSec; }
	float GetAnimLengthSec() const { return AnimLengthSec; }
	bool  IsPlaying() const { return bPlaying; }

private:
	void RebuildMesh(const FHktAnimCaptureSettings& Settings);
	void ApplyLighting(const FHktAnimCaptureSettings& Settings);
	void ApplyCameraFraming(const FHktAnimCaptureSettings& Settings);
	void UpdateCameraTransform();
	void TickPose();

	TSharedRef<FAdvancedPreviewScene> PreviewScene;

	TObjectPtr<USkeletalMeshComponent>    MeshComp = nullptr;
	TObjectPtr<UDirectionalLightComponent> KeyLight = nullptr;
	TObjectPtr<UDirectionalLightComponent> FillLight = nullptr;
	TObjectPtr<USkyLightComponent>        ExtraSkyLight = nullptr;

	FHktAnimCaptureSettings CachedSettings;
	FVector SubjectFocus = FVector::ZeroVector;
	FVector CachedSocketOffset = FVector::ZeroVector;

	int32 CurrentDirectionIdx = 0;
	float CurrentTimeSec      = 0.0f;
	float AnimLengthSec       = 0.0f;
	bool  bPlaying            = true;
};

class SHktAnimPreviewViewport : public SEditorViewport
{
public:
	SLATE_BEGIN_ARGS(SHktAnimPreviewViewport) {}
	SLATE_END_ARGS()

	void Construct(const FArguments& InArgs);
	virtual ~SHktAnimPreviewViewport() override;

	/** Settings 적용 — 메시/라이트/카메라 전부 재구성. */
	void Rebuild(const FHktAnimCaptureSettings& Settings);
	void UpdateLighting(const FHktAnimCaptureSettings& Settings);
	void UpdateCamera(const FHktAnimCaptureSettings& Settings);

	void SetDirectionIndex(int32 DirIdx);
	void SetPlaying(bool bPlay);
	int32 GetDirectionIndex() const;
	float GetAnimLengthSec() const;
	float GetTimeSec() const;
	bool  IsPlaying() const;

protected:
	// SEditorViewport =====================================================
	virtual TSharedRef<FEditorViewportClient> MakeEditorViewportClient() override;

private:
	TSharedPtr<FAdvancedPreviewScene>             PreviewScene;
	TSharedPtr<FHktAnimPreviewViewportClient>     ViewportClient;

	// 위젯 Construct 시점엔 아직 Settings 가 없을 수 있으므로 첫 Rebuild 가 들어올 때까지
	// 보류용 캐시. 실제 적용은 ViewportClient 가 만들어진 직후에 수행.
	TOptional<FHktAnimCaptureSettings> PendingRebuild;
};
