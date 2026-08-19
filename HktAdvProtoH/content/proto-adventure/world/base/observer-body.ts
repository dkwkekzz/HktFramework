// 관찰자의 몸 — RULE-OBSERVER-JOIN-001 의 "어떤 몸이 만들어지는가" (P1 CHANGED)
//
// 참여의 인과(언제 몸이 생기고 재참여면 왜 안 생기는가)는 Engine 의
// observer-join 이 소유하고, 몸의 내용(종류·자리·소지품)은 이 팩이 정한다.
// Actor.Id 는 세계가 순번으로 정한다. 관찰자가 밝힌 Id 를 몸의 이름에 섞지 않는다 —
// 세계 밖에서 온 문자열이 세계 안 존재의 이름이 되어서는 안 된다.

import type { CharacterKind } from './actor';
import { createInventory } from '../domains/mining/inventory';
import type { WorldPosition } from './position';
import { spawnActor } from './spawn';
import { SPAWN_POINTS, type WorldState } from './world-state';

// 관찰자의 몸이 처음 만들어질 때의 기본값 — 세계의 초기 설정이다 (DEFAULT_NPCS 와 같은 성격).
export interface BodyDefaults {
  characterKind: CharacterKind;
  items: Partial<Record<'stone' | 'pickaxe', number>>;
  spawnPoints: WorldPosition[];
}

export const DEFAULT_BODY: BodyDefaults = {
  characterKind: 'rabbit-swordsman',
  items: { pickaxe: 1 },
  spawnPoints: SPAWN_POINTS,
};

// C007 — 새 몸은 자기 종류의 자원·템포 능력치를 갖는다 (character-catalog).
// 이름도 세계가 순번으로 정한다 — 관찰자가 밝힌 Id 를 이름에 섞지 않는다는 원칙 그대로다.
export function spawnObserverBody(
  state: WorldState,
  ordinal: number,
  defaults: BodyDefaults = DEFAULT_BODY,
): string {
  const spawn =
    defaults.spawnPoints[ordinal % defaults.spawnPoints.length] ?? SPAWN_POINTS[0]!;

  const body = spawnActor({
    id: `player-${ordinal + 1}`,
    name: `Player ${ordinal + 1}`,
    characterKind: defaults.characterKind,
    control: 'player',
    position: { x: spawn.x, z: spawn.z },
    inventory: createInventory(defaults.items),
  });

  state.actors.push(body);
  return body.id;
}
