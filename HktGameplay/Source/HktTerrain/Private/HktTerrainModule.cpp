// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "IHktTerrainModule.h"
#include "HktTerrainLog.h"
#include "HktTerrainGenerator.h"
#include "Terrain/HktTerrainDataSource.h"
#include "Modules/ModuleManager.h"
#include "Templates/UniquePtr.h"

#define LOCTEXT_NAMESPACE "FHktTerrainModule"

DEFINE_LOG_CATEGORY(LogHktTerrain);

class FHktTerrainModule : public IHktTerrainModule
{
public:
	virtual void StartupModule() override
	{
		// HktCore 의 데이터 소스 팩토리에 FHktTerrainGenerator 를 등록.
		// HktWorldDeterminismSimulator::SetTerrainConfig 가 이를 통해 인스턴스를 생성한다.
		HktTerrain::RegisterDataSourceFactory(
			[](const FHktTerrainGeneratorConfig& Config) -> TUniquePtr<IHktTerrainDataSource>
			{
				return MakeUnique<FHktTerrainGenerator>(Config);
			});

		UE_LOG(LogHktTerrain, Log, TEXT("HktTerrain Module Started — IHktTerrainDataSource factory registered"));
	}

	virtual void ShutdownModule() override
	{
		HktTerrain::UnregisterDataSourceFactory();
		UE_LOG(LogHktTerrain, Log, TEXT("HktTerrain Module Shutdown"));
	}
};

IMPLEMENT_MODULE(FHktTerrainModule, HktTerrain)

#undef LOCTEXT_NAMESPACE
