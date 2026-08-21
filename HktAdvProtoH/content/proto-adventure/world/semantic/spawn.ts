// World Semantic — Actor Spawn
//
// 카탈로그(character-catalog)에서 몸을 만드는 유일한 경로.
// 종류가 정하는 값(몸·자원·템포·거리)은 전부 카탈로그에서 오고,
// 자리·이름·조종·소지품처럼 개체마다 다른 값만 호출자가 정한다.
// RULE-OBSERVER-JOIN-001(관찰자의 몸)과 세계 초기 배치(자율 존재)가 공유한다.

import { idleAction } from './action';
import type { ActorControl, ActorState, CharacterKind } from './actor';
import { characterDefinition } from './character-catalog';
import type { Inventory } from './inventory';
import { createInventory } from './inventory';
import type { WorldPosition } from './position';
import type { GuardedGround } from './relation';

export interface ActorSpawn {
  id: string;
  name: string;
  characterKind: CharacterKind;
  control: ActorControl;
  position: WorldPosition;
  inventory?: Inventory;
  wanderPath?: WorldPosition[]; // control = autonomous 일 때만 의미가 있다
  perceptionRange?: number; // 개체별 재정의 — 밝히지 않으면 종류의 값
  guardedGround?: GuardedGround; // C018 — 지키는 자리. 밝히지 않으면 지킬 것이 없다
}

export function spawnActor(spawn: ActorSpawn): ActorState {
  const def = characterDefinition(spawn.characterKind);
  return {
    id: spawn.id,
    name: spawn.name,
    characterKind: spawn.characterKind,
    control: spawn.control,
    position: { x: spawn.position.x, z: spawn.position.z },
    bodyRadius: def.body.radius,
    bodyHeight: def.body.height,
    bodyMass: def.body.mass,
    facing: { x: def.facing.x, z: def.facing.z },
    velocity: { x: 0, z: 0 },
    hp: def.resources.hpMax,
    hpMax: def.resources.hpMax,
    cp: def.resources.cpStart,
    cpMax: def.resources.cpMax,
    physicalAttack: def.combat.physicalAttack, // C012 — 종류가 정하는 네 능력
    auraAttack: def.combat.auraAttack,
    armor: def.combat.armor,
    resistance: def.combat.resistance,
    armorPenetration: def.combat.armorPenetration, // C013 — 종류가 정하는 관통 둘
    resistancePenetration: def.combat.resistancePenetration,
    criticalChance: def.combat.criticalChance, // C015 — 종류가 정하는 Critical 둘
    criticalDamage: def.combat.criticalDamage,
    insight: def.insight, // C016 — 종류가 정하는 통찰 (지금은 모두 0)
    guarding: false, // C011 — 막기는 종류가 정하는 값이 아니다. 누구나 안 든 채로 태어난다
    guardBrokenUntil: 0,
    moveMode: 'walk',
    moveSpeed: def.tempo.moveSpeed,
    runSpeedMultiplier: def.tempo.runSpeedMultiplier,
    actionSpeed: def.tempo.actionSpeed,
    engagementRange: def.engagementRange,
    perceptionRange: spawn.perceptionRange ?? def.perceptionRange,
    wanderPath: (spawn.wanderPath ?? []).map((p) => ({ x: p.x, z: p.z })),
    wanderIndex: 0,
    // C018 — 지키는 자리는 개체가 지니는 값이다. 밝히지 않으면 없다 —
    // 막기를 안 든 채로 태어나는 것(guarding = false)과 같은 초기값이며,
    // 조종 주체에 따른 예외가 아니다.
    guardedGround: spawn.guardedGround
      ? {
          center: { x: spawn.guardedGround.center.x, z: spawn.guardedGround.center.z },
          radius: spawn.guardedGround.radius,
        }
      : null,
    inventory: spawn.inventory ?? createInventory(),
    currentAction: idleAction(),
  };
}
