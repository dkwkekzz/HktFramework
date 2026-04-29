// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Terrain/HktTerrainDataSource.h"

namespace HktTerrain
{
	namespace
	{
		FDataSourceFactory& GetFactoryStorage()
		{
			static FDataSourceFactory Factory;
			return Factory;
		}
	}

	void RegisterDataSourceFactory(FDataSourceFactory Factory)
	{
		GetFactoryStorage() = MoveTemp(Factory);
	}

	void UnregisterDataSourceFactory()
	{
		GetFactoryStorage() = FDataSourceFactory();
	}

	TUniquePtr<IHktTerrainDataSource> CreateDataSource(const FHktTerrainGeneratorConfig& Config)
	{
		const FDataSourceFactory& Factory = GetFactoryStorage();
		if (!Factory)
		{
			return TUniquePtr<IHktTerrainDataSource>();
		}
		return Factory(Config);
	}
}
