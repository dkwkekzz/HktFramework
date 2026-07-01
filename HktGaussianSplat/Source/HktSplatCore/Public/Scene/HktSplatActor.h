// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "HktSplatActor.generated.h"

class UHktSplatComponent;

/**
 * AHktSplatActor — 스플랫 클라우드 배치용 액터.
 *
 * 루트에 UHktSplatComponent 하나를 두고 PLY 경로를 노출한다.
 * 레벨에 드래그 후 PlyFilePath 지정만으로 렌더된다.
 */
UCLASS()
class HKTSPLATCORE_API AHktSplatActor : public AActor
{
	GENERATED_BODY()

public:
	AHktSplatActor();

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "HktSplat")
	TObjectPtr<UHktSplatComponent> SplatComponent;
};
