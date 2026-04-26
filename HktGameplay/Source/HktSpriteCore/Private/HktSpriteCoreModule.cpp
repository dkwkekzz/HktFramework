// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "IHktSpriteCoreModule.h"
#include "HktSpriteCoreLog.h"
#include "Modules/ModuleManager.h"

#define LOCTEXT_NAMESPACE "FHktSpriteCoreModule"

DEFINE_LOG_CATEGORY(LogHktSpriteCore);

class FHktSpriteCoreModule : public IHktSpriteCoreModule
{
public:
	virtual void StartupModule() override
	{
		// SpriteCrowdHost는 AHktIngamePlayerController가 BP로 지정한 클래스를
		// 로컬 컨트롤러에서만 직접 스폰한다 (HUD 등록 패턴). 이곳에선 자동 스폰하지 않는다.
		UE_LOG(LogHktSpriteCore, Log, TEXT("HktSpriteCore Module Started"));
	}

	virtual void ShutdownModule() override
	{
		UE_LOG(LogHktSpriteCore, Log, TEXT("HktSpriteCore Module Shutdown"));
	}
};

IMPLEMENT_MODULE(FHktSpriteCoreModule, HktSpriteCore)

#undef LOCTEXT_NAMESPACE
