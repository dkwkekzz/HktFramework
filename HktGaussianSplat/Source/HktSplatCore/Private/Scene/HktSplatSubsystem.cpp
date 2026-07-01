// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Scene/HktSplatSubsystem.h"
#include "Rendering/HktSplatSceneViewExtension.h"
#include "HktSplatCoreLog.h"
#include "SceneViewExtension.h"

void UHktSplatSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	ViewExtension = FSceneViewExtensions::NewExtension<FHktSplatSceneViewExtension>();
	UE_LOG(LogHktSplat, Log, TEXT("UHktSplatSubsystem 초기화 — SceneViewExtension 등록됨"));
}

void UHktSplatSubsystem::Deinitialize()
{
	// SVE 는 공유 참조가 사라지면 엔진 레지스트리에서 자동 해제된다.
	ViewExtension.Reset();
	Super::Deinitialize();
}

bool UHktSplatSubsystem::DoesSupportWorldType(const EWorldType::Type WorldType) const
{
	return WorldType == EWorldType::Game
		|| WorldType == EWorldType::PIE
		|| WorldType == EWorldType::Editor
		|| WorldType == EWorldType::EditorPreview;
}
