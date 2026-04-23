// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "IHktVoxelCoreModule.h"
#include "HktVoxelCoreLog.h"
#include "Interfaces/IPluginManager.h"
#include "Misc/Paths.h"
#include "Modules/ModuleManager.h"
#include "HAL/IConsoleManager.h"

#define LOCTEXT_NAMESPACE "FHktVoxelCoreModule"

DEFINE_LOG_CATEGORY(LogHktVoxelCore);

// ============================================================================
// 베벨 토글 CVar — HktVoxelMesher가 워커 스레드에서 읽는다.
// 기본 ON. 단순 int32의 relaxed read: 값 전이(0↔1) 시 워커가 짧은 순간 이전 값을
// 볼 수 있지만, 토글은 곧 다음 재메싱 때 반영되므로 허용.
// 액터 프로퍼티 bBevelEnabled 토글 시 AHktVoxelTerrainActor::Tick이 재메싱을
// 트리거하므로 CVar를 직접 바꾸면 액터 프로퍼티도 동기화해야 완전 반영.
// ============================================================================
int32 GHktVoxelBevelEnabled = 1;

static FAutoConsoleVariableRef CVarHktVoxelBevelEnabled(
	TEXT("hkt.Voxel.BevelEnabled"),
	GHktVoxelBevelEnabled,
	TEXT("LOD0 복셀 모서리 베벨 지오메트리 활성화(1) / 비활성(0). 변경 후 청크 재메싱 필요."),
	ECVF_Default);

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
