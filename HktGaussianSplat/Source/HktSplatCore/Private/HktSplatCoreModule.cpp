// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "IHktSplatCoreModule.h"
#include "HktSplatCoreLog.h"
#include "Interfaces/IPluginManager.h"
#include "Misc/Paths.h"
#include "Modules/ModuleManager.h"
#include "ShaderCore.h"

#define LOCTEXT_NAMESPACE "FHktSplatCoreModule"

DEFINE_LOG_CATEGORY(LogHktSplat);

class FHktSplatCoreModule : public IHktSplatCoreModule
{
public:
	virtual void StartupModule() override
	{
		// 셰이더 디렉토리 매핑 — 커스텀 .ush/.usf 를 /Plugin/HktSplat 가상 경로로 노출.
		const TSharedPtr<IPlugin> Plugin = IPluginManager::Get().FindPlugin(TEXT("HktGaussianSplat"));
		if (Plugin.IsValid())
		{
			const FString ShaderDir = FPaths::Combine(Plugin->GetBaseDir(), TEXT("Source/HktSplatCore/Shaders"));
			AddShaderSourceDirectoryMapping(TEXT("/Plugin/HktSplat"), ShaderDir);
			UE_LOG(LogHktSplat, Log, TEXT("HktSplatCore 모듈 시작 — 셰이더 경로: %s"), *ShaderDir);
		}
		else
		{
			UE_LOG(LogHktSplat, Error, TEXT("HktSplatCore: HktGaussianSplat 플러그인을 찾지 못해 셰이더 경로 매핑 실패"));
		}
	}

	virtual void ShutdownModule() override
	{
		UE_LOG(LogHktSplat, Log, TEXT("HktSplatCore 모듈 종료"));
	}
};

IMPLEMENT_MODULE(FHktSplatCoreModule, HktSplatCore)

#undef LOCTEXT_NAMESPACE
