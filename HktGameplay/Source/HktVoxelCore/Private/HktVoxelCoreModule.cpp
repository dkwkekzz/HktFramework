// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "IHktVoxelCoreModule.h"
#include "HktVoxelCoreLog.h"
#include "Interfaces/IPluginManager.h"
#include "Misc/Paths.h"
#include "Modules/ModuleManager.h"

#define LOCTEXT_NAMESPACE "FHktVoxelCoreModule"

DEFINE_LOG_CATEGORY(LogHktVoxelCore);

class FHktVoxelCoreModule : public IHktVoxelCoreModule
{
public:
	virtual void StartupModule() override
	{
		// 셰이더 디렉토리 매핑 — 커스텀 .ush/.usf 셰이더 경로 등록
		FString PluginBaseDir = IPluginManager::Get().FindPlugin(TEXT("HktGameplay"))->GetBaseDir();
		FString ShaderDir = FPaths::Combine(PluginBaseDir, TEXT("Source/HktVoxelCore/Shaders"));
		AddShaderSourceDirectoryMapping(TEXT("/Plugin/HktVoxelCore"), ShaderDir);

		UE_LOG(LogHktVoxelCore, Log, TEXT("HktVoxelCore Module Started — Shader path: %s"), *ShaderDir);
	}

	virtual void ShutdownModule() override
	{
		UE_LOG(LogHktVoxelCore, Log, TEXT("HktVoxelCore Module Shutdown"));
	}
};

IMPLEMENT_MODULE(FHktVoxelCoreModule, HktVoxelCore)

#undef LOCTEXT_NAMESPACE
