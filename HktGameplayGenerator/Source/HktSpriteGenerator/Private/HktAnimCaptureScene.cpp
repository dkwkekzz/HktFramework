// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktAnimCaptureScene.h"

#include "Animation/AnimSequence.h"
#include "Camera/HktCameraFramingProfile.h"
#include "Camera/HktCameraModeBase.h"
#include "Components/DirectionalLightComponent.h"
#include "Components/SceneCaptureComponent2D.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/SkyLightComponent.h"
#include "Engine/SkeletalMesh.h"
#include "Engine/TextureRenderTarget2D.h"
#include "Engine/World.h"
#include "IImageWrapper.h"
#include "IImageWrapperModule.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Modules/ModuleManager.h"
#include "AdvancedPreviewScene.h"
#include "RenderingThread.h"
#include "TextureResource.h"

DEFINE_LOG_CATEGORY_STATIC(LogHktAnimCapture, Log, All);

namespace HktAnimCaptureScenePrivate
{
	/**
	 * 캡처용 표준 8방향 인덱스 → 카메라 yaw(도).
	 *
	 * 인덱스 ↔ 파일명 ↔ 시각:
	 *   0=N(back), 1=NE, 2=E, 3=SE, 4=S(front), 5=SW, 6=W, 7=NW
	 *
	 * 매핑 근거:
	 *   - UE 의 표준 SkeletalMesh 는 보통 +X 가 "정면(face)" 이다 (Mannequin 등).
	 *   - 카메라 yaw=0 → 카메라가 -X 위치에서 +X 를 향해 본다 → 캐릭터 BACK 시점.
	 *   - 카메라 yaw=180 → +X 위치에서 -X 를 향해 본다 → 캐릭터 FRONT 시점.
	 *   - 그러므로 N(back)=0, S(front)=180 으로 직선 매핑한다.
	 *
	 * 캐릭터 메시가 다른 축을 정면으로 가질 경우 Settings.YawOffset 으로 보정한다.
	 *
	 * SpriteGenerator 디렉터리 스캐너(kDirectionNames) 도 N/NE/E/SE/S/SW/W/NW 순서로
	 * 인덱스를 부여하므로 파일명 suffix 와 정렬된다.
	 */
	static float DirectionIndexToCameraYaw(int32 Idx, int32 NumDirections)
	{
		if (NumDirections <= 1) return 180.0f; // Front-facing camera (Mesh +X 정면 가정)
		const float Step = 360.0f / static_cast<float>(NumDirections);
		return FMath::Fmod(Step * Idx, 360.0f);
	}
}

FHktAnimCaptureScene::FHktAnimCaptureScene() = default;

FHktAnimCaptureScene::~FHktAnimCaptureScene()
{
	// FPreviewScene 의 소멸자가 World/Components 를 정리한다. UPROPERTY 가 아니므로
	// 약한 참조 해제만 명시적으로 끊어준다.
	MeshComp = nullptr;
	CaptureComp = nullptr;
	RenderTarget = nullptr;
	KeyLight = nullptr;
	FillLight = nullptr;
	ExtraSkyLight = nullptr;
	Preview.Reset();
}

void FHktAnimCaptureScene::AddReferencedObjects(FReferenceCollector& Collector)
{
	// PreviewScene 자체가 World/Components 를 GC root 로 잡지만, RT 와 같이
	// World 외부에 떠있는 UObject 는 명시적으로 referencing 해야 GC 안전.
	Collector.AddReferencedObject(MeshComp);
	Collector.AddReferencedObject(CaptureComp);
	Collector.AddReferencedObject(RenderTarget);
	Collector.AddReferencedObject(KeyLight);
	Collector.AddReferencedObject(FillLight);
	Collector.AddReferencedObject(ExtraSkyLight);
}

bool FHktAnimCaptureScene::Initialize(const FHktAnimCaptureSettings& Settings, FString& OutError)
{
	CachedSettings = Settings;

	USkeletalMesh* Mesh = Settings.SkeletalMesh.LoadSynchronous();
	if (!Mesh)
	{
		OutError = TEXT("SkeletalMesh 를 로드할 수 없음");
		return false;
	}

	UAnimSequence* Anim = Settings.AnimSequence.LoadSynchronous();
	// Anim 이 null 이어도 정적 포즈 캡처는 가능 — 단 길이는 0.

	// === Preview Scene ===
	// FAdvancedPreviewScene 은 엔진 SkeletalMesh/애니메이션 에디터가 쓰는 그 프리뷰 —
	// 자동으로 (1) 큐브맵 스카이스피어, (2) SkyLight, (3) DirectionalLight, (4) 포스트프로세스를 구성.
	// 플로어 메시는 캐릭터 캡처에 불필요하므로 끈다.
	FPreviewScene::ConstructionValues CVS;
	CVS.bAllowAudioPlayback = false;
	CVS.bShouldSimulatePhysics = false;
	CVS.bCreatePhysicsScene = false;
	// AdvancedPreviewScene 이 자체적으로 디폴트 라이팅/스카이를 만들기 때문에
	// 부모 FPreviewScene 의 bDefaultLighting 은 항상 false 로 둔다(중복 라이트 방지).
	CVS.bDefaultLighting = false;
	CVS.bForceMipsResident = true;
	Preview = MakeUnique<FAdvancedPreviewScene>(CVS);

	// 플로어 메시 숨김 — 스프라이트 캡처에는 캐릭터 외 잡요소가 들어가면 안 된다.
	// (스카이스피어는 ShowFlags.Atmosphere 로 프리뷰 시점에만 노출.)
	Preview->SetFloorVisibility(false, /*bDirect*/ true);

	// 사용자가 디폴트 라이팅(스카이+키 라이트)을 끈 경우 — AdvancedPreviewScene 의 자동
	// SkyLight 도 약화시키고 스카이스피어 자체를 비활성.
	if (!Settings.bUseDefaultLighting)
	{
		Preview->SetSkyBrightness(0.0f);
		Preview->SetEnvironmentVisibility(false, /*bDirect*/ true);
	}

	UWorld* World = Preview->GetWorld();
	if (!World)
	{
		OutError = TEXT("PreviewScene World 생성 실패");
		return false;
	}

	// === SkeletalMesh ===
	// 주의: USkeletalMeshComponent::InitAnim 은 IsRegistered()==true 일 때만 동작한다.
	// 즉 SetAnimationMode/SetAnimation 은 반드시 Preview->AddComponent(=등록) 이후에
	// 호출해야 AnimScriptInstance 가 만들어지고 실제로 포즈가 평가된다.
	MeshComp = NewObject<USkeletalMeshComponent>(GetTransientPackage(), USkeletalMeshComponent::StaticClass(), NAME_None, RF_Transient);
	MeshComp->SetSkeletalMeshAsset(Mesh);
	MeshComp->SetMobility(EComponentMobility::Movable);
	// 본 업데이트가 캡처 전 항상 평가되도록 — 보이지 않을 때도 동작 필요.
	// (등록 시점에 AnimTickOption 을 보므로 등록 전에 설정.)
	MeshComp->VisibilityBasedAnimTickOption = EVisibilityBasedAnimTickOption::AlwaysTickPoseAndRefreshBones;
	MeshComp->bUpdateJointsFromAnimation = true;

	// 스프라이트 캡처는 평면 라이팅이 목표 — self-shadow 가 캐릭터를 어둡게 덮으면
	// 색감이 죽고 알파 매트도 지저분해진다. 메시 자체의 캐스트/리시브를 모두 끔.
	MeshComp->SetCastShadow(false);
	MeshComp->bCastDynamicShadow = false;
	MeshComp->bCastStaticShadow = false;
	MeshComp->bAffectDynamicIndirectLighting = false;
	MeshComp->bAffectDistanceFieldLighting = false;

	Preview->AddComponent(MeshComp, FTransform::Identity);

	if (Anim)
	{
		MeshComp->SetAnimationMode(EAnimationMode::AnimationSingleNode);
		MeshComp->SetAnimation(Anim);
		MeshComp->SetPlayRate(0.0f);   // 외부에서 SetPosition 으로 시간 제어.
		MeshComp->Stop();
		AnimLengthSec = Anim->GetPlayLength();
	}
	else
	{
		MeshComp->SetAnimationMode(EAnimationMode::AnimationSingleNode);
		AnimLengthSec = 0.0f;
	}

	MeshComp->RefreshBoneTransforms();

	const FBoxSphereBounds Bounds = MeshComp->Bounds;
	SubjectFocus = Bounds.Origin;

	// === 사용자 정의 라이팅 ===
	ApplyLighting(Settings);

	// === RenderTarget ===
	const int32 W = FMath::Clamp(Settings.OutputWidth,  16, 4096);
	const int32 H = FMath::Clamp(Settings.OutputHeight, 16, 4096);

	RenderTarget = NewObject<UTextureRenderTarget2D>(GetTransientPackage(), NAME_None, RF_Transient);
	RenderTarget->RenderTargetFormat = RTF_RGBA8;
	RenderTarget->ClearColor = Settings.bTransparentBackground
		? FLinearColor(0.0f, 0.0f, 0.0f, 0.0f)
		: Settings.BackgroundColor;
	RenderTarget->bAutoGenerateMips = false;
	RenderTarget->InitAutoFormat(W, H);
	RenderTarget->UpdateResourceImmediate(true);

	// === SceneCapture ===
	CaptureComp = NewObject<USceneCaptureComponent2D>(GetTransientPackage(), USceneCaptureComponent2D::StaticClass(), NAME_None, RF_Transient);
	CaptureComp->TextureTarget = RenderTarget;
	CaptureComp->bCaptureEveryFrame = false;
	CaptureComp->bCaptureOnMovement = false;
	CaptureComp->bAlwaysPersistRenderingState = true;
	// 캡처 전용 ShowFlag — Atmosphere/Fog OFF 로 알파 보존, MotionBlur OFF 로 잔상 제거.
	// (프리뷰는 별도 SHktAnimPreviewViewport 가 표준 에디터 렌더 경로로 처리한다.)
	CaptureComp->ShowFlags.SetAtmosphere(false);
	CaptureComp->ShowFlags.SetFog(false);
	CaptureComp->ShowFlags.SetMotionBlur(false);
	// 스프라이트 캡처는 평면(flat) 라이팅이 목표 — 라이트 N·L 디퓨즈 항이 들어가면
	// 캐릭터의 라이트 반대편이 항상 어둡게 깔린다. SkyLight/FillLight 를 아무리
	// 더해도 메시 셀프-오클루전(법선 반대) 때문에 음영을 완전히 지울 수 없음.
	// → Lighting ShowFlag 자체를 OFF 하면 SceneCapture 가 BaseColor 풀브라이트로
	//   렌더 → 전체가 균일하게 밝고, 텍스처 디테일은 그대로 보존된다.
	CaptureComp->ShowFlags.SetLighting(false);
	if (Settings.bTransparentBackground)
	{
		// Final color with alpha — 알파 채널 보존 캡처. ATM/Fog 비활성과 함께
		// "캐릭터 외 영역은 알파=0" 를 보장.
		CaptureComp->CaptureSource = ESceneCaptureSource::SCS_FinalColorLDR;
		CaptureComp->bUseRayTracingIfEnabled = false;

		// 알파 보존을 위해 Ortho/Perspective 양쪽 모두 SCS_FinalColorLDR 사용.
		// (SCS_SceneColorHDR 도 가능하지만 후처리 결과가 더 자연스러움)
	}
	else
	{
		CaptureComp->CaptureSource = ESceneCaptureSource::SCS_FinalColorLDR;
	}

	Preview->AddComponent(CaptureComp, FTransform::Identity);

	ApplyCameraFraming(Settings);
	UpdateCameraTransform();

	return true;
}

void FHktAnimCaptureScene::ApplyCameraFraming(const FHktAnimCaptureSettings& Settings)
{
	if (!CaptureComp) return;

	// 프리셋 디폴트(HktPresentation 의 HktCameraMode_*.cpp 와 일치).
	float Pitch = Settings.Pitch;
	float ArmLength = Settings.ArmLength;
	ECameraProjectionMode::Type Proj = Settings.ProjectionMode;
	float FOV = Settings.FieldOfView;
	float OrthoW = Settings.OrthoWidth;
	FVector SocketOffset = FVector::ZeroVector;

	// 1순위: 인게임 카메라 모드 클래스의 CDO Framing 을 그대로 적용 (1:1 뷰 일치).
	// `UHktCameraModeBase` 는 EditInlineNew/DefaultToInstanced 라 콘텐츠 브라우저에
	// 독립 어셋으로 존재하지 않는다 — 그래서 인스턴스가 아닌 클래스(CDO)를 본다.
	bool bResolvedFromAsset = false;
	if (!Settings.CameraModeClass.IsNull())
	{
		if (UClass* ModeClass = Settings.CameraModeClass.LoadSynchronous())
		{
			if (ModeClass->HasAnyClassFlags(CLASS_Abstract))
			{
				UE_LOG(LogHktAnimCapture, Warning,
					TEXT("CameraModeClass(%s)가 Abstract — 파생 BP 또는 네이티브 구상 클래스를 골라야 한다."),
					*ModeClass->GetPathName());
			}
			else if (UHktCameraModeBase* CDO = ModeClass->GetDefaultObject<UHktCameraModeBase>())
			{
				if (UHktCameraFramingProfile* Profile = CDO->Framing)
				{
					Proj         = Profile->ProjectionMode;
					FOV          = Profile->FieldOfView;
					OrthoW       = Profile->OrthoWidth;
					Pitch        = Profile->DefaultPitch;
					ArmLength    = Profile->DefaultArmLength;
					SocketOffset = Profile->SocketOffset;
					bResolvedFromAsset = true;
				}
				else
				{
					UE_LOG(LogHktAnimCapture, Warning,
						TEXT("CameraModeClass(%s) CDO 에 Framing 프로필이 없음 — 프리셋으로 폴백"),
						*ModeClass->GetPathName());
				}
			}
		}
	}

	// 2순위: enum 프리셋 디폴트 (BP 미지정 또는 Framing 누락 시).
	if (!bResolvedFromAsset)
	{
		switch (Settings.CameraPreset)
		{
		case EHktAnimCaptureCameraPreset::RtsView:
			Proj = ECameraProjectionMode::Perspective;
			FOV = 90.0f;
			Pitch = -60.0f;
			ArmLength = 2000.0f;
			break;

		case EHktAnimCaptureCameraPreset::ShoulderView:
			Proj = ECameraProjectionMode::Perspective;
			FOV = 90.0f;
			Pitch = -15.0f;
			ArmLength = 300.0f;
			SocketOffset = FVector(0.0f, 50.0f, 80.0f);
			break;

		case EHktAnimCaptureCameraPreset::IsometricOrtho:
			Proj = ECameraProjectionMode::Orthographic;
			OrthoW = (Settings.OrthoWidth > 0.0f) ? Settings.OrthoWidth : 2500.0f;
			Pitch = -30.0f;
			ArmLength = 2000.0f;
			break;

		case EHktAnimCaptureCameraPreset::IsometricGame:
			Proj = ECameraProjectionMode::Perspective;
			FOV = 20.0f;
			Pitch = -55.0f;
			ArmLength = 2500.0f;
			break;

		case EHktAnimCaptureCameraPreset::Custom:
		default:
			break;
		}
	}

	CaptureComp->ProjectionType = Proj;
	if (Proj == ECameraProjectionMode::Perspective)
	{
		CaptureComp->FOVAngle = FMath::Clamp(FOV, 5.0f, 170.0f);
	}
	else
	{
		CaptureComp->OrthoWidth = FMath::Max(100.0f, OrthoW);
	}

	// 캐시 — UpdateCameraTransform 에서 읽음.
	CachedSettings.ProjectionMode = Proj;
	CachedSettings.FieldOfView    = FOV;
	CachedSettings.OrthoWidth     = OrthoW;
	CachedSettings.Pitch          = Pitch;
	CachedSettings.ArmLength      = ArmLength;
	CachedSocketOffset            = SocketOffset;
}

void FHktAnimCaptureScene::ApplyLighting(const FHktAnimCaptureSettings& Settings)
{
	if (!Preview) return;

	// FPreviewScene::Components 는 GC 루트 — UnregisterComponent 만으로는 배열에 잔존하여
	// 라이트 값을 자주 갱신하면 누적된다. RemoveComponent 가 unregister + 배열 제거를 함께 처리.
	if (KeyLight)       { Preview->RemoveComponent(KeyLight);      KeyLight = nullptr; }
	if (FillLight)      { Preview->RemoveComponent(FillLight);     FillLight = nullptr; }
	if (ExtraSkyLight)  { Preview->RemoveComponent(ExtraSkyLight); ExtraSkyLight = nullptr; }

	if (Settings.bEnableKeyLight)
	{
		KeyLight = NewObject<UDirectionalLightComponent>(GetTransientPackage(), UDirectionalLightComponent::StaticClass(), NAME_None, RF_Transient);
		KeyLight->SetIntensity(Settings.KeyLightIntensity);
		KeyLight->SetLightColor(Settings.KeyLightColor);
		KeyLight->SetMobility(EComponentMobility::Movable);
		KeyLight->SetCastShadows(false);
		Preview->AddComponent(KeyLight, FTransform(Settings.KeyLightRotation));
	}

	if (Settings.bEnableFillLight)
	{
		FillLight = NewObject<UDirectionalLightComponent>(GetTransientPackage(), UDirectionalLightComponent::StaticClass(), NAME_None, RF_Transient);
		FillLight->SetIntensity(Settings.FillLightIntensity);
		FillLight->SetLightColor(Settings.FillLightColor);
		FillLight->SetMobility(EComponentMobility::Movable);
		FillLight->SetCastShadows(false);
		Preview->AddComponent(FillLight, FTransform(Settings.FillLightRotation));
	}

	if (Settings.ExtraSkyLightIntensity > 0.0f)
	{
		ExtraSkyLight = NewObject<USkyLightComponent>(GetTransientPackage(), USkyLightComponent::StaticClass(), NAME_None, RF_Transient);
		ExtraSkyLight->SetIntensity(Settings.ExtraSkyLightIntensity);
		ExtraSkyLight->SetMobility(EComponentMobility::Movable);
		// SLS_CapturedScene 가 기본 — 별도 큐브맵 없이 PreviewScene 의 환경을 캡처.
		Preview->AddComponent(ExtraSkyLight, FTransform::Identity);
		ExtraSkyLight->RecaptureSky();
	}
}

void FHktAnimCaptureScene::SetDirectionIndex(int32 DirectionIdx)
{
	const int32 N = FMath::Clamp(CachedSettings.NumDirections, 1, 8);
	CurrentDirectionIdx = ((DirectionIdx % N) + N) % N;
	UpdateCameraTransform();
}

void FHktAnimCaptureScene::UpdateCameraTransform()
{
	if (!CaptureComp) return;

	const int32 N = FMath::Clamp(CachedSettings.NumDirections, 1, 8);
	const float CamYaw = HktAnimCaptureScenePrivate::DirectionIndexToCameraYaw(CurrentDirectionIdx, N)
	                   + CachedSettings.YawOffset;
	const float CamPitch = CachedSettings.Pitch;

	// 카메라 위치: Subject 주위를 (Pitch, Yaw) 로 도는 ArmLength 떨어진 점.
	const FRotator Rot(CamPitch, CamYaw, 0.0f);
	const FVector Forward = Rot.Vector(); // 카메라가 바라보는 방향
	const FVector Right   = FRotationMatrix(Rot).GetUnitAxis(EAxis::Y);
	const FVector Up      = FRotationMatrix(Rot).GetUnitAxis(EAxis::Z);

	// SocketOffset 은 HktCameraFramingProfile::SocketOffset 과 동일 — SpringArm 의
	// (Forward, Right, Up) 좌표계에서 카메라를 미는 오프셋.
	const FVector Socket =
		Forward * CachedSocketOffset.X +
		Right   * CachedSocketOffset.Y +
		Up      * CachedSocketOffset.Z;

	// SubjectFocusOffset: 메시는 그대로 두고 카메라의 LookAt 만 이동시킴 → 캐릭터가
	// 프레임 안에서 반대 방향으로 시프트되어 보인다(프리뷰/캡처 1:1).
	const FVector EffectiveFocus = SubjectFocus + CachedSettings.SubjectFocusOffset;
	const FVector CamLoc = EffectiveFocus - Forward * CachedSettings.ArmLength + Socket;

	CaptureComp->SetWorldLocationAndRotation(CamLoc, Rot);
}

void FHktAnimCaptureScene::SetAnimationTime(float TimeSec)
{
	if (!MeshComp) return;
	if (AnimLengthSec <= 0.0f) { TickPose(); return; }

	const float ClampedTime = FMath::Clamp(TimeSec, 0.0f, AnimLengthSec);
	MeshComp->SetPosition(ClampedTime, /*bFireNotifies*/ false);
	TickPose();
}

void FHktAnimCaptureScene::TickPose()
{
	if (!MeshComp) return;
	// Anim Single Node 모드: SetPosition 후 RefreshBoneTransforms 으로 즉시 평가.
	MeshComp->TickAnimation(0.0f, /*bNeedsValidRootMotion*/ false);
	MeshComp->RefreshBoneTransforms();
	MeshComp->MarkRenderTransformDirty();
	MeshComp->MarkRenderDynamicDataDirty();
}

bool FHktAnimCaptureScene::CaptureToFile(const FString& AbsolutePngPath, FString& OutError)
{
	if (!CaptureComp || !RenderTarget)
	{
		OutError = TEXT("CaptureComp / RenderTarget 미초기화");
		return false;
	}

	// 본 업데이트가 GPU 까지 반영되도록 한 번 더 강제.
	TickPose();
	CaptureComp->CaptureScene();

	// CaptureScene 은 RenderCmd 를 enqueue 한다 — 픽셀을 읽기 전에 flush.
	FlushRenderingCommands();

	TArray64<uint8> Png;
	if (!EncodePng(Png, OutError))
	{
		return false;
	}

	const FString Dir = FPaths::GetPath(AbsolutePngPath);
	if (!Dir.IsEmpty())
	{
		IFileManager::Get().MakeDirectory(*Dir, /*Tree*/ true);
	}

	if (!FFileHelper::SaveArrayToFile(Png, *AbsolutePngPath))
	{
		OutError = FString::Printf(TEXT("PNG 저장 실패: %s"), *AbsolutePngPath);
		return false;
	}
	return true;
}

bool FHktAnimCaptureScene::EncodePng(TArray64<uint8>& OutPng, FString& OutError) const
{
	if (!RenderTarget) { OutError = TEXT("RT 없음"); return false; }

	FTextureRenderTargetResource* Res = RenderTarget->GameThread_GetRenderTargetResource();
	if (!Res) { OutError = TEXT("RT 리소스 없음"); return false; }

	const int32 W = RenderTarget->SizeX;
	const int32 H = RenderTarget->SizeY;

	TArray<FColor> Pixels;
	Pixels.SetNumUninitialized(W * H);

	FReadSurfaceDataFlags ReadFlags(RCM_UNorm, CubeFace_MAX);
	ReadFlags.SetLinearToGamma(false);
	if (!Res->ReadPixels(Pixels, ReadFlags))
	{
		OutError = TEXT("RT ReadPixels 실패");
		return false;
	}

	int32 OutW = W;
	int32 OutH = H;
	TArray<FColor> Out;

	if (CachedSettings.bAutoCropToContent)
	{
		// 알파 > 0 인 영역의 바운딩 박스 계산.
		int32 MinX = W, MinY = H, MaxX = -1, MaxY = -1;
		for (int32 y = 0; y < H; ++y)
		{
			for (int32 x = 0; x < W; ++x)
			{
				if (Pixels[y * W + x].A > 0)
				{
					if (x < MinX) MinX = x;
					if (y < MinY) MinY = y;
					if (x > MaxX) MaxX = x;
					if (y > MaxY) MaxY = y;
				}
			}
		}

		if (MaxX < MinX || MaxY < MinY)
		{
			// 빈 프레임 — 원본 그대로 출력.
			Out = MoveTemp(Pixels);
		}
		else
		{
			const int32 Pad = FMath::Max(0, CachedSettings.CropPaddingPx);
			MinX = FMath::Max(0, MinX - Pad);
			MinY = FMath::Max(0, MinY - Pad);
			MaxX = FMath::Min(W - 1, MaxX + Pad);
			MaxY = FMath::Min(H - 1, MaxY + Pad);

			OutW = MaxX - MinX + 1;
			OutH = MaxY - MinY + 1;
			Out.SetNumUninitialized(OutW * OutH);
			for (int32 y = 0; y < OutH; ++y)
			{
				FMemory::Memcpy(
					&Out[y * OutW],
					&Pixels[(MinY + y) * W + MinX],
					sizeof(FColor) * OutW);
			}
		}
	}
	else
	{
		Out = MoveTemp(Pixels);
	}

	// PNG 인코딩.
	IImageWrapperModule& IWM = FModuleManager::LoadModuleChecked<IImageWrapperModule>("ImageWrapper");
	TSharedPtr<IImageWrapper> Wrapper = IWM.CreateImageWrapper(EImageFormat::PNG);
	if (!Wrapper.IsValid())
	{
		OutError = TEXT("PNG ImageWrapper 생성 실패");
		return false;
	}

	if (!Wrapper->SetRaw(Out.GetData(), static_cast<int64>(Out.Num()) * sizeof(FColor), OutW, OutH, ERGBFormat::BGRA, 8))
	{
		OutError = TEXT("PNG SetRaw 실패");
		return false;
	}

	OutPng = Wrapper->GetCompressed();
	return OutPng.Num() > 0;
}

