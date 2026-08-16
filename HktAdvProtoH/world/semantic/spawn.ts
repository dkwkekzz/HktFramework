// World Semantic — Actor Spawn
//
// 카탈로그(character-catalog)에서 몸을 만드는 유일한 경로.
// 종류가 정하는 값(몸·자원·템포·거리)은 전부 카탈로그에서 오고,
// 자리·이름·조종·소지품처럼 개체마다 다른 값만 호출자가 정한다.
// RULE-OBSERVER-JOIN-001(관찰자의 몸)과 세계 초기 배치(자율 존재)가 공유한다.

import { idleAction } from './action';
import type { ActorControl, ActorState, CharacterKind } from './actor';
import { characterDefinition } from './character-catalog';
import { GUARD_REARM_LOCK } from './combat';
import type { Inventory } from './inventory';
import { createInventory } from './inventory';
import type { WorldPosition } from './position';

export interface ActorSpawn {
  id: string;
  name: string;
  characterKind: CharacterKind;
  control: ActorControl;
  position: WorldPosition;
  inventory?: Inventory;
  wanderPath?: WorldPosition[]; // control = autonomous 일 때만 의미가 있다
  perceptionRange?: number; // 개체별 재정의 — 밝히지 않으면 종류의 값
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
    // C010 — 새로 놓이는 몸은 막지 않은 채로, 여파 없이, 자기 종류의 방어력으로 선다
    defense: def.defense.defense,
    stance: 'open',
    guardBrokenUntil: 0,
    // C011 — 아직 아무 자세도 세운 적이 없고 열려 있지도 않다.
    // guardStartedAt 이 음수인 것은 "세계가 시작하자마자도 막을 수 있다" 를 위한 것이다 —
    // 0 으로 두면 World.Time 이 GUARD_REARM_LOCK 을 지나기 전까지 아무도 막지 못한다.
    guardStartedAt: -GUARD_REARM_LOCK,
    exposedUntil: 0,
    moveMode: 'walk',
    moveSpeed: def.tempo.moveSpeed,
    runSpeedMultiplier: def.tempo.runSpeedMultiplier,
    actionSpeed: def.tempo.actionSpeed,
    attackRange: def.attackRange,
    perceptionRange: spawn.perceptionRange ?? def.perceptionRange,
    wanderPath: (spawn.wanderPath ?? []).map((p) => ({ x: p.x, z: p.z })),
    wanderIndex: 0,
    inventory: spawn.inventory ?? createInventory(),
    currentAction: idleAction(),
  };
}
