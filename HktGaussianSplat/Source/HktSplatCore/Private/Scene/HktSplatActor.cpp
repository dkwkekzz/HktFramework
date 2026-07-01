// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Scene/HktSplatActor.h"
#include "Scene/HktSplatComponent.h"

AHktSplatActor::AHktSplatActor()
{
	PrimaryActorTick.bCanEverTick = false;
	SplatComponent = CreateDefaultSubobject<UHktSplatComponent>(TEXT("SplatComponent"));
	RootComponent = SplatComponent;
}
