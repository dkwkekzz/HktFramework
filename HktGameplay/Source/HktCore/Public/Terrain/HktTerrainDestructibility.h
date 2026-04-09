// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Terrain/HktTerrainVoxelDef.h"

/**
 * HktTerrainDestructibility - terrain voxel 파괴 가능 여부 조회
 *
 * HktTerrainVoxelDef에 위임. 기존 호출부 호환을 위해 유지.
 * Health는 VoxelDef가 관리하지 않으므로 이 네임스페이스에서도 제거됨.
 *
 * pure C++ — UObject/UWorld 참조 없음.
 */
namespace HktTerrainDestructibility
{
    inline bool IsDestructible(uint16 TypeId)
    {
        return HktTerrainVoxelDef::GetDef(TypeId).bDestructible;
    }
}
