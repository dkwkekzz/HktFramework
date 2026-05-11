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

	// 입력을 허용해 사용자가 마우스로 직접 카메라를 회전/줌하여 캐릭터 위치를
	// 검증할 수 있게 한다. Rebuild/UpdateCamera/SetDirectionIndex 가 호출될 때만
	// 카메라가 재설정되며, 매 Tick 에선 강제 갱신하지 않으므로 사용자 조작이 유지된다.
	bDisableInput = false;
}

void FHktAnimPreviewViewportClient::AddReferencedObjects(FReferenceCollector& Collector)
{
	// 부모(FEditorViewportClient → FGCObject)도 자체 참조를 등록 — 빠뜨리면 PostProcess 등
	// 내부 UObject 가 GC 로 회수될 위험.
	FEditorViewportClient::AddReferencedObjects(Collector);

	Collector.AddReferencedObject(MeshComp);
	Collector.AddReferencedObject(KeyLight);
	Collector.AddReferencedObject(FillLight);
	Collector.AddReferencedObject(ExtraSkyLight);
}

void FHktAnimPreviewViewportClient::Tick(float DeltaSeconds)
{
	FEditorViewportClient::Tick(DeltaSeconds);

	// AdvancedPreviewScene World tick — Sequencer/Anim 평가에 필요. World 가 만들어지지
	// 않은 비정상 경로에서는 진입하지 않도록 가드.
	if (UWorld* World = PreviewScene->GetWorld())
	{
		World->Tick(LEVELTICK_All, DeltaSeconds);
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
	if (MeshComp)
	{
		PreviewScene->RemoveComponent(MeshComp);
		MeshComp = nullptr;
	}

	USkeletalMesh* Mesh = Settings.SkeletalMesh.LoadSynchronous();
	if (!Mesh)
	{
		UE_LOG(LogHktAnimPreview, Warning,
			TEXT("RebuildMesh: SkeletalMesh 로드 실패 (path=%s) — 프리뷰 메시가 비어 있게 됩니다."),
			*Settings.SkeletalMesh.ToSoftObjectPath().ToString());
		AnimLengthSec = 0.0f;
		return;
	}

	UAnimSequence* Anim = Settings.AnimSequence.LoadSynchronous();
	if (!Settings.AnimSequence.IsNull() && !Anim)
	{
		// 경로는 지정됐는데 로드 실패 — 정적 포즈로 폴백. 사용자에게 명시.
		UE_LOG(LogHktAnimPreview, Warning,
			TEXT("RebuildMesh: AnimSequence 로드 실패 (path=%s) — 정적 포즈로 폴백."),
			*Settings.AnimSequence.ToSoftObjectPath().ToString());
	}

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

	UE_LOG(LogHktAnimPreview, Log,
		TEXT("RebuildMesh OK — Mesh=%s, Anim=%s, Length=%.2fs, Focus=(%.1f,%.1f,%.1f)"),
		*Mesh->GetName(),
		Anim ? *Anim->GetName() : TEXT("(none)"),
		AnimLengthSec, SubjectFocus.X, SubjectFocus.Y, SubjectFocus.Z);
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
	UE_LOG(LogHktAnimPreview, Verbose,
		TEXT("ApplyLighting — Default=%d Key=%d(I=%.2f) Fill=%d(I=%.2f) ExtraSky=%.2f"),
		Settings.bUseDefaultLighting ? 1 : 0,
		Settings.bEnableKeyLight ? 1 : 0, Settings.KeyLightIntensity,
		Settings.bEnableFillLight ? 1 : 0, Settings.FillLightIntensity,
		Settings.ExtraSkyLightIntensity);

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
			if (ModeClass->HasAnyClassFlags(CLASS_Abstract))
			{
				UE_LOG(LogHktAnimPreview, Warning,
					TEXT("ApplyCameraFraming: CameraModeClass(%s) 가 Abstract — 파생 BP 또는 네이티브 구상 클래스를 골라야 한다. 프리셋으로 폴백."),
					*ModeClass->GetPathName());
			}
			else if (UHktCameraModeBase* CDO = ModeClass->GetDefaultObject<UHktCameraModeBase>())
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
				else
				{
					UE_LOG(LogHktAnimPreview, Warning,
						TEXT("ApplyCameraFraming: CameraModeClass(%s) CDO 에 Framing 프로필이 없음 — 프리셋으로 폴백."),
						*ModeClass->GetPathName());
				}
			}
		}
		else
		{
			UE_LOG(LogHktAnimPreview, Warning,
				TEXT("ApplyCameraFraming: CameraModeClass 로드 실패 (path=%s) — 프리셋으로 폴백."),
				*Settings.CameraModeClass.ToSoftObjectPath().ToString());
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

	// EditorViewport 측 카메라 모드 적용 — 표준 setter 경유(부모 viewport 가 내부 상태 갱신).
	if (Proj == ECameraProjectionMode::Perspective)
	{
		SetViewportType(LVT_Perspective);
		ViewFOV = FMath::Clamp(FOV, 5.0f, 170.0f);
	}
	else
	{
		// LVT_OrthoFreelook — 자유 회전 가능한 ortho.
		// 주의: FEditorViewportClient::OrthoZoom 은 USceneCaptureComponent2D::OrthoWidth 와
		// 단위가 다르다. UE 내부 변환은 대략 `WorldUnitsPerPixel = OrthoZoom / (Width * 15)`
		// → 즉 viewport 가로폭이 OrthoWidth 와 일치하려면 OrthoZoom = OrthoWidth * 15.
		// 이전 코드는 OrthoWidth 값을 직접 OrthoZoom 으로 대입해 캐릭터가 1/15 스케일로 매우
		// 작게 그려져 보이지 않았다.
		SetViewportType(LVT_OrthoFreelook);
		const float TargetOrthoWidth = FMath::Max(100.0f, OrthoW);
		SetOrthoZoom(TargetOrthoWidth * 15.0f);
	}

	UE_LOG(LogHktAnimPreview, Verbose,
		TEXT("ApplyCameraFraming — %s, Pitch=%.1f, Arm=%.1f, FOV=%.1f, OrthoW=%.1f, Socket=(%.1f,%.1f,%.1f), %s"),
		(Proj == ECameraProjectionMode::Perspective) ? TEXT("Perspective") : TEXT("Ortho"),
		Pitch, ArmLength, FOV, OrthoW, SocketOff.X, SocketOff.Y, SocketOff.Z,
		bResolvedFromAsset ? TEXT("from CDO") : TEXT("from preset"));
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

	if (!PreviewScene->GetWorld())
	{
		UE_LOG(LogHktAnimPreview, Error,
			TEXT("SHktAnimPreviewViewport::Construct: FAdvancedPreviewScene World 생성 실패. 프리뷰가 동작하지 않습니다."));
	}

	// SEditorViewport::Construct 가 MakeEditorViewportClient() 를 호출 — 그 안에서
	// ViewportClient 가 만들어진다. PreviewScene 은 이 시점에 이미 준비되어 있어야 함.
	SEditorViewport::Construct(SEditorViewport::FArguments());

	if (!ViewportClient.IsValid())
	{
		UE_LOG(LogHktAnimPreview, Error,
			TEXT("SHktAnimPreviewViewport::Construct: MakeEditorViewportClient 가 ViewportClient 를 만들지 않았습니다."));
	}

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
	checkf(PreviewScene.IsValid(), TEXT("MakeEditorViewportClient 가 Construct 의 PreviewScene 생성 이전에 호출됨"));
	ViewportClient = MakeShared<FHktAnimPreviewViewportClient>(SharedThis(this), PreviewScene.ToSharedRef());
	UE_LOG(LogHktAnimPreview, Log, TEXT("SHktAnimPreviewViewport: ViewportClient 생성됨"));
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
		// Construct 가 끝나기 전(SEditorViewport::Construct 내부에서 콜백이 들어오는 경우)에는
		// 보류했다가 Construct 마지막 단계에서 일괄 적용한다.
		PendingRebuild = Settings;
		UE_LOG(LogHktAnimPreview, Verbose, TEXT("Rebuild deferred — ViewportClient 가 아직 생성 전."));
	}
}

void SHktAnimPreviewViewport::UpdateLighting(const FHktAnimCaptureSettings& Settings)
{
	if (ViewportClient.IsValid())
	{
		ViewportClient->UpdateLighting(Settings);
	}
	else
	{
		UE_LOG(LogHktAnimPreview, Warning, TEXT("UpdateLighting 호출 시 ViewportClient 가 없음 — 무시."));
	}
}

void SHktAnimPreviewViewport::UpdateCamera(const FHktAnimCaptureSettings& Settings)
{
	if (ViewportClient.IsValid())
	{
		ViewportClient->UpdateCamera(Settings);
	}
	else
	{
		UE_LOG(LogHktAnimPreview, Warning, TEXT("UpdateCamera 호출 시 ViewportClient 가 없음 — 무시."));
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
