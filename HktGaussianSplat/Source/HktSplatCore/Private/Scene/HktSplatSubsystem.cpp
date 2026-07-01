// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Scene/HktSplatSubsystem.h"
#include "Rendering/HktSplatSceneViewExtension.h"
#include "HktSplatCoreLog.h"
#include "SceneViewExtension.h"
#include "RenderingThread.h"

void UHktSplatSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	ViewExtension = FSceneViewExtensions::NewExtension<FHktSplatSceneViewExtension>();
	UE_LOG(LogHktSplat, Log, TEXT("UHktSplatSubsystem 초기화 — SceneViewExtension 등록됨"));
}

void UHktSplatSubsystem::Deinitialize()
{
	// SVE 가 in-flight 렌더 커맨드에서 raw `this` 를 캡처하므로, 공유 참조를 놓기 전에
	// 렌더 스레드를 flush 해 큐잉된 커맨드가 모두 실행되도록 보장한다 (use-after-free 방지).
	if (ViewExtension.IsValid())
	{
		FlushRenderingCommands();
	}
	ViewExtension.Reset();
	Super::Deinitialize();
}

bool UHktSplatSubsystem::DoesSupportWorldType(const EWorldType::Type WorldType) const
{
	// EditorPreview(썸네일/BP/머티리얼 프리뷰)는 제외 — 짧게 살고 사라지는 프리뷰 월드마다
	// SVE + 수MB GPU 버퍼를 할당할 이유가 없다.
	return WorldType == EWorldType::Game
		|| WorldType == EWorldType::PIE
		|| WorldType == EWorldType::Editor;
}
