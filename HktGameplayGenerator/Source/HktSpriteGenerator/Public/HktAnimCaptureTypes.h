// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Camera/CameraTypes.h"
#include "HktAnimCaptureTypes.generated.h"

class USkeletalMesh;
class UAnimSequence;
class UHktCameraModeBase;

// ============================================================================
// EHktAnimCaptureCameraPreset
//
// HktPresentation/Camera/HktCameraModeBase.h 의 카메라 모드를 캡처용으로 미러.
// HktPresentation 의 UHktCameraModeBase / UHktCameraFramingProfile 은 모두
// Private 에 있어 외부 모듈에서 인스턴스화 불가하므로, 동일한 Framing 디폴트
// 값을 본 캡처 시스템 내부에 그대로 옮겨와 사용한다.
// ============================================================================

UENUM(BlueprintType)
enum class EHktAnimCaptureCameraPreset : uint8
{
	/** Top-down RTS (Pitch=-60, FOV=90, Perspective). */
	RtsView          UMETA(DisplayName = "RTS View"),

	/** Over-the-shoulder (Pitch=-15, FOV=90, ArmLength=300). */
	ShoulderView     UMETA(DisplayName = "Shoulder View"),

	/** True isometric ortho (Pitch=-30, OrthoWidth=2500). */
	IsometricOrtho   UMETA(DisplayName = "Isometric Ortho"),

	/** Game-style isometric (Pitch=-55, FOV=20 telephoto). */
	IsometricGame    UMETA(DisplayName = "Isometric Game"),

	/** 사용자 정의 — Pitch/Projection/FOV/OrthoWidth/ArmLength 직접 지정. */
	Custom           UMETA(DisplayName = "Custom"),
};

// ============================================================================
// FHktAnimCaptureSettings
//
// 캡처 1회 분량을 기술하는 단일 DTO. SHktAnimCapturePanel 이 채우고
// UHktAnimCaptureFunctionLibrary::CaptureAnimation 으로 전달한다.
// ============================================================================

USTRUCT(BlueprintType)
struct HKTSPRITEGENERATOR_API FHktAnimCaptureSettings
{
	GENERATED_BODY()

	// === 모델 ===

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Model")
	TSoftObjectPtr<USkeletalMesh> SkeletalMesh;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Model")
	TSoftObjectPtr<UAnimSequence> AnimSequence;

	// === 식별 ===

	/** 스프라이트 캐릭터 식별 태그. 비어있으면 자동 빌드(Atlas 생성)는 비활성. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Identity")
	FString CharacterTag = TEXT("Sprite.Character.Knight");

	/** 액션 식별자(파일 prefix). 예: "idle","walk","attack". */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Identity")
	FString ActionId = TEXT("idle");

	// === 카메라 ===

	/**
	 * 인게임 카메라 모드 클래스 (네이티브 `UHktCameraMode_*` 또는 그로부터 파생된 BP).
	 *
	 * `UHktCameraModeBase` 는 `EditInlineNew, DefaultToInstanced` — 즉 콘텐츠
	 * 브라우저에 독립 어셋으로는 존재하지 않고 Pawn BP 안의 서브오브젝트로 산다.
	 * 그래서 인스턴스(=어셋) 가 아닌 **클래스** 를 픽하고, 캡처 시 그 클래스의
	 * CDO(GetDefaultObject) 의 `Framing` 프로필을 SceneCapture 에 적용한다.
	 *
	 * 적용 범위: C++ 생성자에서 세팅된 디폴트 + BP 클래스 자체에서 변경된 값.
	 * (`AHktRtsCameraPawn` BP 의 인스턴스 디테일에서 오버라이드된 값은
	 *  잡지 못함 — 그건 pawn 단의 서브오브젝트 오버라이드라서.)
	 *
	 * 미지정 시 enum 프리셋 / Custom 필드 사용.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera", meta = (MetaClass = "/Script/HktPresentation.HktCameraModeBase"))
	TSoftClassPtr<UHktCameraModeBase> CameraModeClass;

	/** CameraModeClass 미지정 시 사용. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera")
	EHktAnimCaptureCameraPreset CameraPreset = EHktAnimCaptureCameraPreset::IsometricOrtho;

	/** Custom 프리셋 또는 오버라이드 사용 시 적용. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|Custom")
	TEnumAsByte<ECameraProjectionMode::Type> ProjectionMode = ECameraProjectionMode::Orthographic;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|Custom",
		meta = (EditCondition = "ProjectionMode==ECameraProjectionMode::Perspective"))
	float FieldOfView = 90.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|Custom",
		meta = (EditCondition = "ProjectionMode==ECameraProjectionMode::Orthographic"))
	float OrthoWidth = 2500.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|Custom")
	float Pitch = -30.0f;

	/** Subject(메시 root)에서 카메라까지의 거리 — Perspective 에서는 카메라 길이로,
	 *  Ortho 에서는 클리핑/배경 처리에 사용. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|Custom")
	float ArmLength = 2000.0f;

	/**
	 * 캐릭터 회전에 더해질 yaw 오프셋(도). 일부 메시는 X+를 정면으로 가지며,
	 * 게임에서 South 방향이 정면이 되어야 한다면 보통 -90 또는 +180 이 필요하다.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera|Custom")
	float YawOffset = 0.0f;

	// === 캡처 ===

	/** 출력 텍스처 1프레임당 가로/세로 픽셀. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Capture")
	int32 OutputWidth = 256;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Capture")
	int32 OutputHeight = 256;

	/**
	 * 캡처 방향 수. **1 또는 8 만 안전**.
	 *
	 * SpriteGenerator 디렉터리 스캐너의 방향 인덱스는 N(0)/NE(1)/E(2)/SE(3)/
	 * S(4)/SW(5)/W(6)/NW(7) 8개 고정. 4 등 중간값을 쓰면 yaw step (=360/N)
	 * 과 파일명 인덱스가 어긋나 잘못된 방향 슬롯에 매핑된다.
	 *
	 * 1 외의 값은 모두 8 로 강제 (CaptureAnimation 진입부에서 클램프).
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Capture", meta = (ClampMin = "1", ClampMax = "8"))
	int32 NumDirections = 8;

	/** 0 이면 AnimSequence 길이 × CaptureFPS 로 자동 계산. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Capture", meta = (ClampMin = "0"))
	int32 FrameCount = 0;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Capture", meta = (ClampMin = "0.1"))
	float CaptureFPS = 10.0f;

	/** 0 이상. AnimSequence 의 시작 시간(초). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Capture", meta = (ClampMin = "0.0"))
	float StartTime = 0.0f;

	/** 0 이면 AnimSequence 끝까지. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Capture", meta = (ClampMin = "0.0"))
	float EndTime = 0.0f;

	/** True 이면 알파 채널 보존(투명 배경). False 면 BackgroundColor 단색 배경. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Capture")
	bool bTransparentBackground = true;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Capture",
		meta = (EditCondition = "!bTransparentBackground"))
	FLinearColor BackgroundColor = FLinearColor(0.1f, 0.1f, 0.1f, 1.0f);

	// === 프레임 자르기/리사이즈 ===

	/** True 이면 캡처 후 알파>0 영역만 남기고 자동 크롭(빈 여백 제거). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Crop")
	bool bAutoCropToContent = false;

	/** AutoCrop 에 추가할 투명 패딩(px). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Crop", meta = (ClampMin = "0"))
	int32 CropPaddingPx = 4;

	// === 출력 ===

	/**
	 * 디스크 출력 폴더(절대 경로). 비어있으면
	 * <Project>/Saved/SpriteGenerator/AnimCapture/<CharacterTag>/<ActionId>/ 사용.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Output")
	FString DiskOutputDir;

	/** UE 컨텐트 출력 경로 (DataAsset/Atlas 저장용). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Output")
	FString AssetOutputDir = TEXT("/Game/Generated/Sprites");

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Output")
	float PixelToWorld = 2.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Output")
	float FrameDurationMs = 100.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Output")
	bool bLooping = true;

	/**
	 * True 이면 캡처 종료 후 디스크 폴더를 즉시
	 * UHktSpriteGeneratorFunctionLibrary::EditorBuildSpriteCharacterFromDirectory 로 패킹.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Output")
	bool bAutoBuildAtlas = true;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Output")
	bool bMirrorWestFromEast = false;
};
