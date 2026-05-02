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
// 에디터 환경에서 SkeletalMesh + AnimSequence 를 8(또는 1)방향으로 회전시켜
// SceneCaptureComponent2D 로 프레임별 PNG 를 방향별 서브폴더에 기록한다.
// 옵션으로 캡처 직후 EditorPackBundleFolderToAtlasPng 를 8회 호출해 방향별
// strip atlas PNG 까지 만든다. UE 측 산출물(Texture2D / DataAsset) 은 만들지 않음 —
// 결과물은 모두 DiskOutputDir 아래 PNG 로만 떨어진다.
//
// 산출물:
//   {DiskOutputDir}/{N|NE|...|NW}/frame_{nnn:03d}.png      (TextureBundle, 방향별)
//   {DiskOutputDir}/atlas_{N|NE|...|NW}.png                (방향별 패킹 atlas PNG)
//
// 사용 흐름:
//   FHktAnimCaptureSettings S;
//   S.SkeletalMesh = ...;  S.AnimSequence = ...;
//   S.CharacterTag = "Sprite.Character.Knight";  S.AnimTag = "Anim.FullBody.Locomotion.Idle";
//   const FString ResultJson = UHktAnimCaptureFunctionLibrary::CaptureAnimation(S);
//
// 결과 JSON: {"success":bool, "diskOutputDir":..., "framesPerDir":..., "directions":...,
//             "atlasResults":{...EditorPackDirectionalAtlases 결과 (success/count/items)...},
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
