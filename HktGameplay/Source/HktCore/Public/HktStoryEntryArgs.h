// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Containers/Map.h"
#include "GameplayTagContainer.h"
#include "UObject/NameTypes.h"

/**
 * FHktStoryEntryArgs — VM 인스턴스 시작 시 Story 진입점에 prefill 되는 인자 묶음.
 *
 * Spawner-bound Story (`spawner_bound: true` Schema 2) 는 진입 시점에 다음을 받는다:
 *
 *   - SpawnerOrigin (3-슬롯 블록, FHktFixed32 raw)
 *   - SpawnerBiome
 *   - SpawnerSlotHash (RNG seed 로 사용 시 동일 spawner 결정론 보장)
 *   - 사용자 정의 EntryArgs (int / GameplayTag) — 이름으로 빌더의 `EntryArgInt/Tag` 가 발급한
 *     entry-arg vreg 와 매칭된다.
 *
 * 본 구조체는 HktCore 의 plain C++ POD — UObject 의존 0 (절대 원칙 2).
 *
 * 결정론 규칙:
 *   - 좌표는 `FHktFixed32` raw (Q16.16). UE float 누설 금지.
 *   - 인자는 `int32` 또는 `FGameplayTag` 만 허용. `float` 금지 (TerrainSpawner.design.md O4).
 *
 * VM 측은 본 구조체를 받아 entry-arg 표식 vreg(`FHktVRegMeta::bIsEntryArgSlot`) 에 prefill 한다.
 * Linear-Scan 할당기는 해당 vreg 의 라이브니스를 entry 부터로 잡아 GP 레지스터를 점유한다.
 *
 * V2 컴플라이언스: 본 구조체는 신규 데이터 전달용 POD 만 — `Reg::` 네임스페이스/RegisterIndex
 * 신규 의미 부여(D1~D3) 와 무관하다.
 */
struct HKTCORE_API FHktStoryEntryArgs
{
    // ─── Spawner 컨텍스트 (spawner_bound Story 전용) ───

    /** 좌표 raw (Q16.16). spawner 의 결정론 위치. */
    int32 OriginXRaw = 0;
    int32 OriginYRaw = 0;
    int32 OriginZRaw = 0;

    /** 베이크 시점 biome id (런타임 검증/조건 분기에 사용). */
    int32 BiomeId = 0;

    /** 결정론 ID: hash(ChunkCoord, SlotIndex). RandomInt seed 와 결합. */
    uint32 SlotHash = 0;

    // ─── 사용자 정의 EntryArgs ───

    /** 정수형 인자 — fixed-point 값 권장. 이름은 `EntryArgInt(FName)` 가 발급한 vreg 와 매칭. */
    TMap<FName, int32> ArgsInt;

    /** GameplayTag 형 인자 — `EntryArgTag(FName)` 가 발급한 vreg 와 매칭. */
    TMap<FName, FGameplayTag> ArgsTag;
};
