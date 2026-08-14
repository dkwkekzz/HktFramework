// RULE-OBSERVER-JOIN-001 — Implements INTENT-OBSERVER-IDENTITY-001 ·
//                                     INTENT-OBSERVER-JOIN-001 · INTENT-OBSERVER-REJOIN-001
// Input          관찰자가 밝힌 Id
// Preconditions  1. Id 가 비어 있지 않다   2. Id 의 길이가 한계 이내다
// Transition     이미 아는 Id  → Present = true. 몸은 만들지 않는다 (이전 몸을 그대로 쓴다)
//                처음 보는 Id  → 새 몸을 만들어 World.Actors 에 더하고
//                                Observer{Id, ActorId, Present} 를 World.Observers 에 더한다
// Result         Success(Id, ActorId) | Failure(invalid-observer-id)
//
// 세계는 밝힌 바가 참인지 따지지 않는다 — 자신이 누구인지 말할 수 있는 자는
// 그 관찰자로 인정된다 (INTENT-OBSERVER-IDENTITY-001). 자격 증명은 이 Cycle 의 밖이다.

import type { ActionResult } from '../../protocol/actions';
import { RULE_OBSERVER_JOIN } from '../../protocol/semantic-id';
import { idleAction } from '../semantic/action';
import type { ActorState, CharacterKind } from '../semantic/actor';
import { BODY_MASS, bodySize, DEFAULT_FACING } from '../semantic/collision';
import { combatProfile } from '../semantic/combat';
import { createInventory } from '../semantic/inventory';
import { MAX_OBSERVER_ID_LENGTH } from '../semantic/observer';
import type { WorldPosition } from '../semantic/position';
import {
  ATTACK_RANGE,
  findObserver,
  MOVE_SPEED,
  PERCEPTION_RANGE,
  SPAWN_POINTS,
  type WorldState,
} from '../semantic/world-state';

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

export function evaluateObserverIdentity(observerId: string): string | null {
  if (typeof observerId !== 'string' || observerId.length === 0) return 'invalid-observer-id';
  if (observerId.length > MAX_OBSERVER_ID_LENGTH) return 'invalid-observer-id';
  return null;
}

export function ruleObserverJoin(
  state: WorldState,
  observerId: string,
  defaults: BodyDefaults = DEFAULT_BODY,
): ActionResult {
  const failure = evaluateObserverIdentity(observerId);
  if (failure) return { status: 'failure', rule: RULE_OBSERVER_JOIN, reason: failure };

  const known = findObserver(state, observerId);
  if (known) {
    // 재참여 — 몸은 그대로다. 자리 · 가진 것 · 하던 행동이 이어진다.
    // 같은 Id 로 다른 이어짐이 보고 있었다면 그 이어짐은 떨어진다.
    // 몸 하나에 조종하는 이는 하나이며, 그 떼어냄은 이어짐을 쥔 쪽(server)이 수행한다.
    // AcknowledgedMark 는 되돌리지 않는다 (C005) — 같은 관찰자가 이어 온 것이므로
    // 세계가 받아들인 자리도 이어진다.
    known.present = true;
    return { status: 'success', rule: RULE_OBSERVER_JOIN };
  }

  // 첫 참여 — 세계가 새 몸을 만든다.
  // Actor.Id 는 세계가 순번으로 정한다. 관찰자가 밝힌 Id 를 몸의 이름에 섞지 않는다 —
  // 세계 밖에서 온 문자열이 세계 안 존재의 이름이 되어서는 안 된다.
  const ordinal = state.observers.length;
  const spawn =
    defaults.spawnPoints[ordinal % defaults.spawnPoints.length] ?? SPAWN_POINTS[0]!;

  // C007 — 새 몸은 자기 종류의 자원·템포 능력치를 갖는다 (COMBAT_PROFILES).
  // 이름도 세계가 순번으로 정한다 — 관찰자가 밝힌 Id 를 이름에 섞지 않는다는 원칙 그대로다.
  const profile = combatProfile(defaults.characterKind);
  const size = bodySize(defaults.characterKind); // 몸 크기는 종류가 정한다 (C006 R2)

  const body: ActorState = {
    id: `player-${ordinal + 1}`,
    name: `Player ${ordinal + 1}`,
    characterKind: defaults.characterKind,
    control: 'player',
    position: { x: spawn.x, z: spawn.z },
    bodyRadius: size.radius,
    bodyHeight: size.height,
    bodyMass: BODY_MASS,
    facing: { x: DEFAULT_FACING.x, z: DEFAULT_FACING.z },
    velocity: { x: 0, z: 0 },
    hp: profile.hpMax,
    hpMax: profile.hpMax,
    cp: profile.cpStart,
    cpMax: profile.cpMax,
    moveMode: 'walk',
    moveSpeed: profile.moveSpeed,
    runSpeedMultiplier: profile.runSpeedMultiplier,
    actionSpeed: profile.actionSpeed,
    attackRange: ATTACK_RANGE,
    perceptionRange: PERCEPTION_RANGE,
    wanderPath: [],
    wanderIndex: 0,
    inventory: createInventory(defaults.items),
    currentAction: idleAction(),
  };

  state.actors.push(body);
  // AcknowledgedMark 는 0 에서 시작한다 (C005) — 아직 이 관찰자에게서 받은 표식이 없다.
  state.observers.push({ id: observerId, actorId: body.id, present: true, acknowledgedMark: 0 });

  return { status: 'success', rule: RULE_OBSERVER_JOIN };
}
