// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Modules/ModuleManager.h"

#include "HktPaper2DGeneratorLog.h"

DEFINE_LOG_CATEGORY(LogHktPaper2DGenerator);

// ----------------------------------------------------------------------------
// HktPaper2DGenerator — 모듈 진입점.
//
// 빌더 패널 / 단일-anim 콘솔 커맨드는 워크스페이스 일원화에 따라 모두 제거되었다.
// 외부 진입은 다음만 사용한다:
//   - HktWorkspaceGenerator 의 패널/콘솔(`HktWorkspace.*`) → HktPaperWorkspaceBuilder
//   - StaticVisual 빌더(`UHktPaperSpriteBuilderFunctionLibrary::BuildPaperStaticVisual` 등)
// ----------------------------------------------------------------------------
class FHktPaper2DGeneratorModule : public IModuleInterface
{
public:
	virtual void StartupModule() override {}
	virtual void ShutdownModule() override {}
};

IMPLEMENT_MODULE(FHktPaper2DGeneratorModule, HktPaper2DGenerator)
