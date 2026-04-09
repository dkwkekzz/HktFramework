// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Terrain/HktTerrainVoxel.h"

/**
 * FHktVoxelDef - 복셀 타입의 상호작용 정의
 *
 * 타입별 속성값(Health, Phase 등)은 여기에 두지 않는다.
 * 오직 "이 복셀이 파괴될 때 어떤 Story 이벤트를 발행하는가"만 정의.
 *
 * InteractTerrain이 voxel을 제거한 뒤 InteractionEventTag로
 * Story를 발행한다. 엔티티 생성·속성 설정은 해당 Story가 담당.
 *
 *   FHktEvent.Location  = 복셀 중심 위치 (cm)
 *   FHktEvent.Param0    = 원래 TypeId
 *   FHktEvent.SourceEntity = 공격 주체
 *
 * 순수 C++ — UObject/UWorld 참조 없음.
 */
struct FHktVoxelDef
{
    bool          bDestructible;        // 파괴 가능 여부 (false → InteractTerrain 스킵)
    FName         InteractionEventTag;  // 파괴 시 발행할 Story 이벤트 이름 (NAME_None = 없음)
    uint8         AutoFlags;            // FHktTerrainVoxel::Flags 자동 할당 (Translucent 등)
};

/**
 * HktTerrainVoxelDef — TypeID별 FHktVoxelDef 조회
 *
 * 새 타입 추가 시 GetDef() 테이블만 수정.
 * HktTerrainType 상수 (HktVoxelTerrainTypes.h):
 *   Air=0, Grass=1, Dirt=2, Stone=3, Sand=4, Water=5,
 *   Snow=6, Ice=7, Gravel=8, Clay=9, Bedrock=10, Glass=11
 *
 * Story 이벤트 → 엔티티 생성 책임 매핑 (예시):
 *   Story.Voxel.Break   → Debris(Stone/Grass/Dirt/Snow/Clay) spawn
 *   Story.Voxel.Crumble → Debris(Sand/Gravel) spawn (중력 물리)
 *   Story.Voxel.Crack   → Debris(Ice) spawn
 *   Story.Voxel.Shatter → Debris(Glass) spawn (파편 다수)
 */
namespace HktTerrainVoxelDef
{
    static constexpr int32 MaxTypeId = 16;

    inline const FHktVoxelDef& GetDef(uint16 TypeId)
    {
        using F = FHktTerrainVoxel;

        static const FHktVoxelDef Table[MaxTypeId] = {
            /* 0  Air     */ {false, NAME_None,                          0},
            /* 1  Grass   */ {true,  FName(TEXT("Story.Voxel.Break")),   F::FLAG_DESTRUCTIBLE},
            /* 2  Dirt    */ {true,  FName(TEXT("Story.Voxel.Break")),   F::FLAG_DESTRUCTIBLE},
            /* 3  Stone   */ {true,  FName(TEXT("Story.Voxel.Break")),   F::FLAG_DESTRUCTIBLE},
            /* 4  Sand    */ {true,  FName(TEXT("Story.Voxel.Crumble")), F::FLAG_DESTRUCTIBLE},
            /* 5  Water   */ {false, NAME_None,                          F::FLAG_TRANSLUCENT},
            /* 6  Snow    */ {true,  FName(TEXT("Story.Voxel.Break")),   F::FLAG_DESTRUCTIBLE},
            /* 7  Ice     */ {true,  FName(TEXT("Story.Voxel.Crack")),   F::FLAG_TRANSLUCENT | F::FLAG_DESTRUCTIBLE},
            /* 8  Gravel  */ {true,  FName(TEXT("Story.Voxel.Crumble")), F::FLAG_DESTRUCTIBLE},
            /* 9  Clay    */ {true,  FName(TEXT("Story.Voxel.Break")),   F::FLAG_DESTRUCTIBLE},
            /* 10 Bedrock */ {false, NAME_None,                          0},
            /* 11 Glass   */ {true,  FName(TEXT("Story.Voxel.Shatter")), F::FLAG_TRANSLUCENT | F::FLAG_DESTRUCTIBLE},
            /* 12 */         {false, NAME_None,                          0},
            /* 13 */         {false, NAME_None,                          0},
            /* 14 */         {false, NAME_None,                          0},
            /* 15 */         {false, NAME_None,                          0},
        };

        if (TypeId < MaxTypeId)
            return Table[TypeId];

        static const FHktVoxelDef Default = {false, NAME_None, 0};
        return Default;
    }

    /**
     * TypeID에서 올바른 Flags가 설정된 FHktTerrainVoxel 생성.
     * Op_SetVoxel / 지형 생성기에서 사용.
     */
    inline FHktTerrainVoxel MakeVoxel(uint16 TypeId, uint8 PaletteIndex = 0)
    {
        FHktTerrainVoxel V;
        V.TypeID       = TypeId;
        V.PaletteIndex = PaletteIndex;
        V.Flags        = GetDef(TypeId).AutoFlags;
        return V;
    }
}
