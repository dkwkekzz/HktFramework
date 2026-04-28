// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "HktAnimCaptureTypes.h"
#include "HktAnimCaptureFunctionLibrary.generated.h"

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
};
