// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Delegates/Delegate.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "HktAnimCaptureTypes.h"
#include "HktAnimCaptureFunctionLibrary.generated.h"

/**
 * 캡처 진행 콜백.
 *  - DoneFrames  : 지금까지 저장한 프레임 수 (0..TotalFrames)
 *  - TotalFrames : 전체 프레임 수 (방향수 × 프레임수)
 *  - Status      : 한 줄 짜리 사람용 상태 문자열 ("Dir 3/8 Frame 5/12" 등)
 *
 * BP 에서 받기 위해 필요하지 않다면 native 전용 — Slate 패널에서만 사용.
 */
DECLARE_DELEGATE_ThreeParams(FHktAnimCaptureProgressDelegate, int32 /*DoneFrames*/, int32 /*TotalFrames*/, const FString& /*Status*/);

// ============================================================================
// UHktAnimCaptureFunctionLibrary
//
// 에디터 환경에서 SkeletalMesh + AnimSequence 를 8(또는 1·4)방향으로 회전시켜
// SceneCaptureComponent2D 로 프레임별 PNG 를 디스크에 기록하고, 옵션으로
// HktSpriteGenerator 의 TextureBundle → Atlas 빌더까지 연결한다.
//
// 사용 흐름:
//   FHktAnimCaptureSettings S;
//   S.SkeletalMesh = ...;  S.AnimSequence = ...;
//   S.CharacterTag = "Sprite.Character.Knight";  S.ActionId = "idle";
//   const FString ResultJson = UHktAnimCaptureFunctionLibrary::CaptureAnimation(S);
//
// 결과 JSON: {"success":bool, "diskOutputDir":..., "frameCount":..., "directions":...,
//             "atlasResult":{...최상위 EditorBuildSpriteCharacterFromDirectory 결과...},
//             "error":...}
// ============================================================================

UCLASS()
class HKTSPRITEGENERATOR_API UHktAnimCaptureFunctionLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	UFUNCTION(BlueprintCallable, Category = "HKT|SpriteGenerator|AnimCapture")
	static FString CaptureAnimation(const FHktAnimCaptureSettings& Settings);

	/**
	 * 진행 콜백 버전. Slate 패널에서 진행률 표시용으로 사용.
	 * 매 프레임 저장 직전에 ProgressCallback(DoneFrames, TotalFrames, Status) 가 호출된다.
	 * 내부적으로 FScopedSlowTask 도 함께 가동하여 표준 Unreal 진행 다이얼로그도 표시.
	 */
	static FString CaptureAnimationWithProgress(
		const FHktAnimCaptureSettings& Settings,
		const FHktAnimCaptureProgressDelegate& ProgressCallback);
};
