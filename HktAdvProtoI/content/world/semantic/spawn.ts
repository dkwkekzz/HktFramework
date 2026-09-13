// World Semantic — Actor Spawn
//
// 카탈로그(character-catalog)에서 몸을 만드는 유일한 경로.
// 종류가 정하는 값(몸·자원·템포·거리)은 전부 카탈로그에서 오고,
// 자리·이름·조종·소지품처럼 개체마다 다른 값만 호출자가 정한다.
// RULE-OBSERVER-JOIN-001(관찰자의 몸)과 세계 초기 배치(자율 존재)가 공유한다.

import type { PropertySource } from '../../../engine/world-authoring/property';
import { idleAction } from './action';
import type { ActorControl, ActorState, CharacterKind } from './actor';
import { awarenessCapSource } from './body-property';
import { characterDefinition } from './character-catalog';
import type { Inventory } from './inventory';
import { createInventory } from './inventory';
import type { WorldPosition } from './position';

export interface ActorSpawn {
  id: string;
  name: string;
  characterKind: CharacterKind;
  control: ActorControl;
  regionId: string; // 몸이 놓일 Region — 필수. 자리는 그 Region 의 Local Space 좌표다 (C001)
  position: WorldPosition;
  inventory?: Inventory;
  wanderPath?: WorldPosition[]; // control = autonomous 일 때만 의미가 있다
  /**
   * 개체별 인지 재정의 — 밝히지 않으면 종류의 값 (C039 CHANGED).
   *
   * 이제 그 몸의 필드가 되지 않는다: **「인지에 상한 하나」라는 Source 한 줄**로 몸에 걸린다
   * (propertySources). 그래서 종류가 거는 상한 · 때가 거는 상한 · 자락이 거는 상한과 **같은
   * 잣대**로 겹쳐 작은 쪽이 이긴다 — 밝힌 수보다 넓어지는 일은 없다.
   */
  perceptionRange?: number;
  /** 그 몸에 **더 걸린** Source 들 — 검증 · 촬영용 손잡이 (세계 규칙을 바꾸지 않는다) */
  sources?: readonly PropertySource[];
  /** 그 몸의 Core — 밝히지 않으면 종류의 값 (RULE-BODY-CORE-001) */
  core?: string;
}

export function spawnActor(spawn: ActorSpawn): ActorState {
  const def = characterDefinition(spawn.characterKind);
  return {
    id: spawn.id,
    name: spawn.name,
    characterKind: spawn.characterKind,
    control: spawn.control,
    regionId: spawn.regionId,
    position: { x: spawn.position.x, z: spawn.position.z },
    bodyRadius: def.body.radius,
    bodyHeight: def.body.height,
    bodyMass: def.body.mass,
    facing: { x: def.facing.x, z: def.facing.z },
    velocity: { x: 0, z: 0 },
    // 태어나는 몸은 그 종류의 최대만큼 차 있다 — 최대는 저장되지 않고 묻는 것이다 (C039)
    hp: def.resources.hpMax,
    cp: def.resources.cpStart,
    moveMode: 'walk',
    moveSpeed: def.tempo.moveSpeed,
    runSpeedMultiplier: def.tempo.runSpeedMultiplier,
    actionSpeed: def.tempo.actionSpeed,
    attackRange: def.attackRange,
    // C039 — 몸에 **걸리는 것**들. 종류가 거는 상한은 성질을 묻는 자리가 카탈로그에서 읽으므로
    // 여기 담지 않는다: 이 자리는 **개체마다 다른 것**의 자리다 (개체별 인지 재정의 · 손잡이).
    core: spawn.core ?? def.core,
    propertySources: [
      ...(spawn.perceptionRange === undefined ? [] : [awarenessCapSource(spawn.perceptionRange)]),
      ...(spawn.sources ?? []),
    ],
    wanderPath: (spawn.wanderPath ?? []).map((p) => ({ x: p.x, z: p.z })),
    wanderIndex: 0,
    movedThisTick: 0, // 아직 아무 tick 도 지나지 않았다 (C008)
    distanceSinceTrack: 0, // 아직 한 걸음도 걷지 않았다 (C017)
    inventory: spawn.inventory ?? createInventory(),
    currentAction: idleAction(),
  };
}
