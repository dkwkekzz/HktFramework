// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

// ============================================================================
// HktRegionId — Macro-tile 좌표 해시 (PR-2)
//
// Region 은 TileSize × TileSize 청크 묶음을 단일 단위로 해석한다.
// `Docs/Concepts/C01_TranquilWilds/04-region-state.md` §3-D2 의 결정.
//
// 본 헤더는 순수 정수 연산만 포함 — UE 런타임 의존 0 (절대 원칙 2).
// TileSize 는 결정론에 영향을 주므로 시뮬레이션 상수 (CVar 아님) 로 고정.
// ============================================================================

namespace HktRegionId
{
    /**
     * 시즌 0 의 고정 macro-tile 크기 (한 변당 청크 수).
     * 결정론 영향 — 변경 시 같은 좌표가 다른 RegionId 로 해석되므로 save migration 필요.
     */
    constexpr int32 DefaultTileSize = 8;

    /**
     * FHktMacroTile — macro-tile 의 정수 2D 좌표.
     * X/Y 는 chunk 좌표를 TileSize 로 floor-div 한 결과.
     */
    struct FHktMacroTile
    {
        int32 X = 0;
        int32 Y = 0;

        FORCEINLINE bool operator==(const FHktMacroTile& Other) const
        {
            return X == Other.X && Y == Other.Y;
        }
        FORCEINLINE bool operator!=(const FHktMacroTile& Other) const
        {
            return !(*this == Other);
        }
    };

    /**
     * 결정론적 floor-div — 음수 chunk 좌표가 같은 tile 그룹에 묶이도록 보장.
     * C++ 의 부호 자르기(/)는 0 쪽 반올림이라 음수에서 그룹화가 깨지므로 직접 구현.
     */
    FORCEINLINE int32 FloorDiv(int32 N, int32 D)
    {
        // D 는 양수 가정 (TileSize > 0).
        const int32 Q = N / D;
        const int32 R = N % D;
        return (R != 0 && ((R < 0) != (D < 0))) ? (Q - 1) : Q;
    }

    /**
     * 청크 좌표 → macro-tile 좌표.
     * 같은 macro-tile 내의 모든 청크는 동일 (X, Y) 를 반환한다.
     */
    FORCEINLINE FHktMacroTile ToMacroTile(int32 ChunkX, int32 ChunkY, int32 TileSize = DefaultTileSize)
    {
        const int32 Safe = TileSize > 0 ? TileSize : DefaultTileSize;
        return FHktMacroTile{ FloorDiv(ChunkX, Safe), FloorDiv(ChunkY, Safe) };
    }

    /**
     * 청크 좌표 → RegionId (uint32 packed).
     *   상위 16 bit = MacroTile.X (int16 로 캐스팅)
     *   하위 16 bit = MacroTile.Y (int16 로 캐스팅)
     *
     * 음수 좌표 → int16 → uint16 캐스팅으로 비트 패턴 유지. 같은 tile 은 항상 같은 id 를 반환.
     */
    FORCEINLINE uint32 FromChunkCoord(int32 ChunkX, int32 ChunkY, int32 TileSize = DefaultTileSize)
    {
        const FHktMacroTile Tile = ToMacroTile(ChunkX, ChunkY, TileSize);
        const uint16 Hi = static_cast<uint16>(static_cast<int16>(Tile.X));
        const uint16 Lo = static_cast<uint16>(static_cast<int16>(Tile.Y));
        return (static_cast<uint32>(Hi) << 16) | static_cast<uint32>(Lo);
    }
}
