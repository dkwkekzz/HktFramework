// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "SHktAnimPreviewViewport.h"

#include "AdvancedPreviewScene.h"
#include "Animation/AnimSequence.h"
#include "Camera/HktCameraFramingProfile.h"
#include "Camera/HktCameraModeBase.h"
#include "Components/DirectionalLightComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/SkyLightComponent.h"
#include "Engine/SkeletalMesh.h"
#include "Engine/World.h"

DEFINE_LOG_CATEGORY_STATIC(LogHktAnimPreview, Log, All);

namespace HktAnimPreviewPrivate
{
	/** 캡처 측 DirectionIndexToCameraYaw 와 동일 — 패널/캡처/프리뷰가 한 매핑을 공유. */
	static float DirectionIndexToCameraYaw(int32 Idx, int32 NumDirections)
	{
		if (NumDirections <= 1) return 180.0f;
		const float Step = 360.0f / static_cast<float>(NumDirections);
		return FMath::Fmod(Step * Idx, 360.0f);
	}
}

// =============================================================================
// FHktAnimPreviewViewportClient
// =============================================================================

FHktAnimPreviewViewportClient::FHktAnimPreviewViewportClient(
	const TSharedRef<SEditorViewport>& InViewport,
	const TSharedRef<FAdvancedPreviewScene>& InScene)
	: FEditorViewportClient(nullptr, &InScene.Get(), InViewport)
	, PreviewScene(InScene)
{
	// 표준 SkeletalMesh 에디터 뷰포트와 동일한 동작 — 매 프레임 갱신, 게임 입력 OFF.
	SetRealtime(true);
	bSetListenerPosition = false;

	// SetViewMode(VMI_Lit) — 디폴트지만 명시. Lumen/Lit 셰이딩이 SkyLight ambient 까지 포함.
	SetViewMode(VMI_Lit);

	// 게임뷰는 끄고 에디터 뷰: ShowFlags 가 표준 에디터 라이팅 풀세트.
	EngineShowFlags.SetSelectionOutline(false);
	EngineShowFlags.SetGrid(false);

	// 입력으로 카메라가 흔들리지 않도록 — 우리는 매 Tick 에서 카메라를 강제 갱신.
	bDisableInput = true;
}

void FHktAnimPreviewViewportClient::AddReferencedObjects(FReferenceCollector& Collector)
{
	Collector.AddReferencedObject(MeshComp);
	Collector.AddReferencedObject(KeyLight);
	Collector.AddReferencedObject(FillLight);
	Collector.AddReferencedObject(ExtraSkyLight);
}

void FHktAnimPreviewViewportClient::Tick(float DeltaSeconds)
{
	FEditorViewportClient::Tick(DeltaSeconds);

	// AdvancedPreviewScene World tick — Sequencer/Anim 평가에 필요.
	if (PreviewScene.IsValid())
	{
		PreviewScene->GetWorld()->Tick(LEVELTICK_All, DeltaSeconds);
	}

	if (!MeshComp || AnimLengthSec <= 0.0f)
	{
		TickPose();
		return;
	}

	if (bPlaying)
	{
		CurrentTimeSec += DeltaSeconds;
		CurrentTimeSec  = FMath::Fmod(CurrentTimeSec, AnimLengthSec);
		MeshComp->SetPosition(CurrentTimeSec, /*bFireNotifies*/ false);
	}
	TickPose();
}

void FHktAnimPreviewViewportClient::TickPose()
{
	if (!MeshComp) return;
	MeshComp->TickAnimation(0.0f, /*bNeedsValidRootMotion*/ false);
	MeshComp->RefreshBoneTransforms();
	MeshComp->MarkRenderTransformDirty();
	MeshComp->MarkRenderDynamicDataDirty();
}

void FHktAnimPreviewViewportClient::Rebuild(const FHktAnimCaptureSettings& Settings)
{
	CachedSettings = Settings;
	RebuildMesh(Settings);
	ApplyLighting(Settings);
	ApplyCameraFraming(Settings);
	UpdateCameraTransform();
}

void FHktAnimPreviewViewportClient::RebuildMesh(const FHktAnimCaptureSettings& Settings)
{
	if (!PreviewScene.IsValid()) return;

	if (MeshComp)
	{
		PreviewScene->RemoveComponent(MeshComp);
		MeshComp = nullptr;
	}

	USkeletalMesh* Mesh = Settings.SkeletalMesh.LoadSynchronous();
	if (!Mesh) return;

	UAnimSequence* Anim = Settings.AnimSequence.LoadSynchronous();

	// 등록 전에 ticking/visibility 옵션 세팅 — InitAnim 이 등록 시점에 본다.
	MeshComp = NewObject<USkeletalMeshComponent>(GetTransientPackage(), USkeletalMeshComponent::StaticClass(), NAME_None, RF_Transient);
	MeshComp->SetSkeletalMeshAsset(Mesh);
	MeshComp->SetMobility(EComponentMobility::Movable);
	MeshComp->VisibilityBasedAnimTickOption = EVisibilityBasedAnimTickOption::AlwaysTickPoseAndRefreshBones;
	MeshComp->bUpdateJointsFromAnimation = true;

	// 프리뷰는 표준 에디터 라이팅 — 캡처용 flat 라이팅과 달리 그림자/간접광 그대로 받음.
	// (SkeletalMesh 에디터와 같은 시각이 목표.)

	PreviewScene->AddComponent(MeshComp, FTransform::Identity);

	if (Anim)
	{
		MeshComp->SetAnimationMode(EAnimationMode::AnimationSingleNode);
		MeshComp->SetAnimation(Anim);
		MeshComp->SetPlayRate(0.0f);
		MeshComp->Stop();
		AnimLengthSec = Anim->GetPlayLength();
	}
	else
	{
		MeshComp->SetAnimationMode(EAnimationMode::AnimationSingleNode);
		AnimLengthSec = 0.0f;
	}

	MeshComp->RefreshBoneTransforms();
	SubjectFocus = MeshComp->Bounds.Origin;

	CurrentTimeSec = 0.0f;
}

void FHktAnimPreviewViewportClient::UpdateLighting(const FHktAnimCaptureSettings& Settings)
{
	CachedSettings.bUseDefaultLighting    = Settings.bUseDefaultLighting;
	CachedSettings.bEnableKeyLight        = Settings.bEnableKeyLight;
	CachedSettings.KeyLightIntensity      = Settings.KeyLightIntensity;
	CachedSettings.KeyLightColor          = Settings.KeyLightColor;
	CachedSettings.KeyLightRotation       = Settings.KeyLightRotation;
	CachedSettings.bEnableFillLight       = Settings.bEnableFillLight;
	CachedSettings.FillLightIntensity     = Settings.FillLightIntensity;
	CachedSettings.FillLightColor         = Settings.FillLightColor;
	CachedSettings.FillLightRotation      = Settings.FillLightRotation;
	CachedSettings.ExtraSkyLightIntensity = Settings.ExtraSkyLightIntensity;
	ApplyLighting(CachedSettings);
}

void FHktAnimPreviewViewportClient::ApplyLighting(const FHktAnimCaptureSettings& Settings)
{
	if (!PreviewScene.IsValid()) return;

	// FAdvancedPreviewScene 의 디폴트 sky/key light 는 살아있다. 사용자가 끄겠다고 한 경우
	// SkyBrightness 와 EnvironmentVisibility 만 조절. (라이트맵/Lumen/DFAO 가 표준 에디터
	// 뷰포트에선 정상 동작하므로 Stationary SkyLight 도 동적 메시에 ambient 를 전달한다.)
	if (Settings.bUseDefaultLighting)
	{
		PreviewScene->SetSkyBrightness(1.0f);
		PreviewScene->SetEnvironmentVisibility(true, /*bDirect*/ true);
	}
	else
	{
		PreviewScene->SetSkyBrightness(0.0f);
		PreviewScene->SetEnvironmentVisibility(false, /*bDirect*/ true);
	}

	// 사용자 추가 라이트는 매번 클린 → 재생성 (강도/색/회전 변경 시 컴포넌트 갱신이 더 안정).
	if (KeyLight)      { PreviewScene->RemoveComponent(KeyLight);      KeyLight = nullptr; }
	if (FillLight)     { PreviewScene->RemoveComponent(FillLight);     FillLight = nullptr; }
	if (ExtraSkyLight) { PreviewScene->RemoveComponent(ExtraSkyLight); ExtraSkyLight = nullptr; }

	if (Settings.bEnableKeyLight)
	{
		KeyLight = NewObject<UDirectionalLightComponent>(GetTransientPackage(), UDirectionalLightComponent::StaticClass(), NAME_None, RF_Transient);
		KeyLight->SetIntensity(Settings.KeyLightIntensity);
		KeyLight->SetLightColor(Settings.KeyLightColor);
		KeyLight->SetMobility(EComponentMobility::Movable);
		KeyLight->SetCastShadows(false);
		PreviewScene->AddComponent(KeyLight, FTransform(Settings.KeyLightRotation));
	}

	if (Settings.bEnableFillLight)
	{
		FillLight = NewObject<UDirectionalLightComponent>(GetTransientPackage(), UDirectionalLightComponent::StaticClass(), NAME_None, RF_Transient);
		FillLight->SetIntensity(Settings.FillLightIntensity);
		FillLight->SetLightColor(Settings.FillLightColor);
		FillLight->SetMobility(EComponentMobility::Movable);
		FillLight->SetCastShadows(false);
		PreviewScene->AddComponent(FillLight, FTransform(Settings.FillLightRotation));
	}

	if (Settings.ExtraSkyLightIntensity > 0.0f)
	{
		ExtraSkyLight = NewObject<USkyLightComponent>(GetTransientPackage(), USkyLightComponent::StaticClass(), NAME_None, RF_Transient);
		ExtraSkyLight->SetIntensity(Settings.ExtraSkyLightIntensity);
		ExtraSkyLight->SetMobility(EComponentMobility::Movable);
		PreviewScene->AddComponent(ExtraSkyLight, FTransform::Identity);
		ExtraSkyLight->RecaptureSky();
	}
}

void FHktAnimPreviewViewportClient::UpdateCamera(const FHktAnimCaptureSettings& Settings)
{
	CachedSettings.CameraPreset      = Settings.CameraPreset;
	CachedSettings.CameraModeClass   = Settings.CameraModeClass;
	CachedSettings.ProjectionMode    = Settings.ProjectionMode;
	CachedSettings.FieldOfView       = Settings.FieldOfView;
	CachedSettings.OrthoWidth        = Settings.OrthoWidth;
	CachedSettings.Pitch             = Settings.Pitch;
	CachedSettings.ArmLength         = Settings.ArmLength;
	CachedSettings.YawOffset         = Settings.YawOffset;
	CachedSettings.SubjectFocusOffset= Settings.SubjectFocusOffset;
	CachedSettings.NumDirections     = FMath::Clamp(Settings.NumDirections, 1, 8);

	ApplyCameraFraming(CachedSettings);
	if (CurrentDirectionIdx >= CachedSettings.NumDirections)
	{
		CurrentDirectionIdx = CachedSettings.NumDirections - 1;
	}
	UpdateCameraTransform();
}

void FHktAnimPreviewViewportClient::ApplyCameraFraming(const FHktAnimCaptureSettings& Settings)
{
	// FHktAnimCaptureScene::ApplyCameraFraming 과 동일한 우선순위 — CameraModeClass CDO →
	// enum 프리셋 → Custom 직접 지정. 캐시에 적재하여 UpdateCameraTransform 이 사용.
	float Pitch       = Settings.Pitch;
	float ArmLength   = Settings.ArmLength;
	ECameraProjectionMode::Type Proj = Settings.ProjectionMode;
	float FOV         = Settings.FieldOfView;
	float OrthoW      = Settings.OrthoWidth;
	FVector SocketOff = FVector::ZeroVector;

	bool bResolvedFromAsset = false;
	if (!Settings.CameraModeClass.IsNull())
	{
		if (UClass* ModeClass = Settings.CameraModeClass.LoadSynchronous())
		{
			if (!ModeClass->HasAnyClassFlags(CLASS_Abstract))
			{
				if (UHktCameraModeBase* CDO = ModeClass->GetDefaultObject<UHktCameraModeBase>())
				{
					if (UHktCameraFramingProfile* Profile = CDO->Framing)
					{
						Proj      = Profile->ProjectionMode;
						FOV       = Profile->FieldOfView;
						OrthoW    = Profile->OrthoWidth;
						Pitch     = Profile->DefaultPitch;
						ArmLength = Profile->DefaultArmLength;
						SocketOff = Profile->SocketOffset;
						bResolvedFromAsset = true;
					}
				}
			}
		}
	}

	if (!bResolvedFromAsset)
	{
		switch (Settings.CameraPreset)
		{
		case EHktAnimCaptureCameraPreset::RtsView:
			Proj = ECameraProjectionMode::Perspective; FOV = 90.0f; Pitch = -60.0f; ArmLength = 2000.0f; break;
		case EHktAnimCaptureCameraPreset::ShoulderView:
			Proj = ECameraProjectionMode::Perspective; FOV = 90.0f; Pitch = -15.0f; ArmLength = 300.0f;
			SocketOff = FVector(0.0f, 50.0f, 80.0f); break;
		case EHktAnimCaptureCameraPreset::IsometricOrtho:
			Proj = ECameraProjectionMode::Orthographic;
			OrthoW = (Settings.OrthoWidth > 0.0f) ? Settings.OrthoWidth : 2500.0f;
			Pitch = -30.0f; ArmLength = 2000.0f; break;
		case EHktAnimCaptureCameraPreset::IsometricGame:
			Proj = ECameraProjectionMode::Perspective; FOV = 20.0f; Pitch = -55.0f; ArmLength = 2500.0f; break;
		default: break;
		}
	}

	CachedSettings.ProjectionMode = Proj;
	CachedSettings.FieldOfView    = FOV;
	CachedSettings.OrthoWidth     = OrthoW;
	CachedSettings.Pitch          = Pitch;
	CachedSettings.ArmLength      = ArmLength;
	CachedSocketOffset            = SocketOff;

	// EditorViewport 측 카메라 모드 적용.
	if (Proj == ECameraProjectionMode::Perspective)
	{
		ViewportType = LVT_Perspective;
		ViewFOV = FMath::Clamp(FOV, 5.0f, 170.0f);
	}
	else
	{
		// LVT_OrthoFreelook — 자유 회전 가능한 ortho. SetOrthoZoom 단위는 viewport width
		// (in unreal units). SceneCapture 의 OrthoWidth 와 동일 의미로 사용.
		ViewportType = LVT_OrthoFreelook;
		SetOrthoZoom(FMath::Max(100.0f, OrthoW));
	}
}

void FHktAnimPreviewViewportClient::UpdateCameraTransform()
{
	const int32 N = FMath::Clamp(CachedSettings.NumDirections, 1, 8);
	const float CamYaw = HktAnimPreviewPrivate::DirectionIndexToCameraYaw(CurrentDirectionIdx, N) + CachedSettings.YawOffset;
	const float CamPitch = CachedSettings.Pitch;

	const FRotator Rot(CamPitch, CamYaw, 0.0f);
	const FVector  Forward = Rot.Vector();
	const FVector  Right   = FRotationMatrix(Rot).GetUnitAxis(EAxis::Y);
	const FVector  Up      = FRotationMatrix(Rot).GetUnitAxis(EAxis::Z);

	const FVector  Socket  = Forward * CachedSocketOffset.X
	                       + Right   * CachedSocketOffset.Y
	                       + Up      * CachedSocketOffset.Z;

	const FVector EffectiveFocus = SubjectFocus + CachedSettings.SubjectFocusOffset;
	const FVector CamLoc = EffectiveFocus - Forward * CachedSettings.ArmLength + Socket;

	SetViewLocation(CamLoc);
	SetViewRotation(Rot);
}

void FHktAnimPreviewViewportClient::SetDirectionIndex(int32 DirIdx)
{
	const int32 N = FMath::Clamp(CachedSettings.NumDirections, 1, 8);
	CurrentDirectionIdx = ((DirIdx % N) + N) % N;
	UpdateCameraTransform();
}

void FHktAnimPreviewViewportClient::SetTime(float TimeSec)
{
	CurrentTimeSec = (AnimLengthSec > 0.0f) ? FMath::Clamp(TimeSec, 0.0f, AnimLengthSec) : 0.0f;
	if (MeshComp && AnimLengthSec > 0.0f)
	{
		MeshComp->SetPosition(CurrentTimeSec, /*bFireNotifies*/ false);
	}
	TickPose();
}

// =============================================================================
// SHktAnimPreviewViewport
// =============================================================================

void SHktAnimPreviewViewport::Construct(const FArguments& InArgs)
{
	// Preview Scene 먼저 — ViewportClient 생성자가 PreviewScene 참조를 요구.
	FPreviewScene::ConstructionValues CVS;
	CVS.bAllowAudioPlayback = false;
	CVS.bShouldSimulatePhysics = false;
	CVS.bCreatePhysicsScene = false;
	// FAdvancedPreviewScene 이 자체 sky/light 를 만들기 때문에 부모 FPreviewScene 의
	// bDefaultLighting 은 항상 false (중복 라이트 방지).
	CVS.bDefaultLighting = false;
	CVS.bForceMipsResident = true;
	PreviewScene = MakeShared<FAdvancedPreviewScene>(CVS);
	PreviewScene->SetFloorVisibility(false, /*bDirect*/ true);

	// SEditorViewport::Construct 가 MakeEditorViewportClient() 를 호출 — 그 안에서
	// ViewportClient 가 만들어진다. PreviewScene 은 이 시점에 이미 준비되어 있어야 함.
	SEditorViewport::Construct(SEditorViewport::FArguments());

	// Construct 도중 Pending 이 있었다면 위젯 사이클이 끝난 직후 적용.
	if (PendingRebuild.IsSet() && ViewportClient.IsValid())
	{
		ViewportClient->Rebuild(PendingRebuild.GetValue());
		PendingRebuild.Reset();
	}
}

SHktAnimPreviewViewport::~SHktAnimPreviewViewport()
{
	ViewportClient.Reset();
	PreviewScene.Reset();
}

TSharedRef<FEditorViewportClient> SHktAnimPreviewViewport::MakeEditorViewportClient()
{
	check(PreviewScene.IsValid());
	ViewportClient = MakeShared<FHktAnimPreviewViewportClient>(SharedThis(this), PreviewScene.ToSharedRef());
	return ViewportClient.ToSharedRef();
}

void SHktAnimPreviewViewport::Rebuild(const FHktAnimCaptureSettings& Settings)
{
	if (ViewportClient.IsValid())
	{
		ViewportClient->Rebuild(Settings);
	}
	else
	{
		PendingRebuild = Settings;
	}
}

void SHktAnimPreviewViewport::UpdateLighting(const FHktAnimCaptureSettings& Settings)
{
	if (ViewportClient.IsValid())
	{
		ViewportClient->UpdateLighting(Settings);
	}
}

void SHktAnimPreviewViewport::UpdateCamera(const FHktAnimCaptureSettings& Settings)
{
	if (ViewportClient.IsValid())
	{
		ViewportClient->UpdateCamera(Settings);
	}
}

void SHktAnimPreviewViewport::SetDirectionIndex(int32 DirIdx)
{
	if (ViewportClient.IsValid())
	{
		ViewportClient->SetDirectionIndex(DirIdx);
	}
}

void SHktAnimPreviewViewport::SetPlaying(bool bPlay)
{
	if (ViewportClient.IsValid())
	{
		ViewportClient->SetPlaying(bPlay);
	}
}

int32 SHktAnimPreviewViewport::GetDirectionIndex() const
{
	return ViewportClient.IsValid() ? ViewportClient->GetDirectionIndex() : 0;
}

float SHktAnimPreviewViewport::GetAnimLengthSec() const
{
	return ViewportClient.IsValid() ? ViewportClient->GetAnimLengthSec() : 0.0f;
}

float SHktAnimPreviewViewport::GetTimeSec() const
{
	return ViewportClient.IsValid() ? ViewportClient->GetTimeSec() : 0.0f;
}

bool SHktAnimPreviewViewport::IsPlaying() const
{
	return ViewportClient.IsValid() ? ViewportClient->IsPlaying() : false;
}
