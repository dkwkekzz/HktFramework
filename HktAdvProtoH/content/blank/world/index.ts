// blank 팩의 World — 존재 종류 하나, interaction 하나(move), 시스템 하나(이동 진행).
//
// 이 파일 하나가 WorldContent 계약 전부를 구현한다. engine/ 은 이 팩을 모른다 —
// 같은 커널이 proto-adventure 를 돌리는 방식 그대로 이 세계를 돌린다 (분리의 증명, P5).

import type { ActionResult } from '../../../engine/protocol-core/actions';
import type {
  EntityView,
  GameViewSnapshot,
  InteractionView,
} from '../../../engine/protocol-core/gameview';
import type { WorldContent } from '../../../engine/world-kernel/content';
import { createWorldKernel, type World } from '../../../engine/world-kernel/kernel';
import {
  findObserver,
  presentObserverCount,
  type CoreWorldState,
} from '../../../engine/world-kernel/state';

export type { World } from '../../../engine/world-kernel/kernel';

// ── 이 세계의 State ──────────────────────────────────────────────────

interface WalkerState {
  id: string;
  name: string;
  position: { x: number; z: number };
  /** 가고 있는 자리 — 없으면 서 있다 */
  target?: { x: number; z: number };
}

export interface WorldState extends CoreWorldState {
  walkers: WalkerState[];
}

// 결정론 시뮬레이션 값 — 헤더 상수로 고정한다.
export const TICK_INTERVAL = 1 / 30;
const MOVE_SPEED = 4.0; // unit/sec
const ARRIVE_EPSILON = 0.05;

// ── Rule ─────────────────────────────────────────────────────────────

const RULE_WALK = 'RULE-BLANK-WALK-001';

function walkerOfObserver(state: WorldState, observerId: string): WalkerState | undefined {
  const observer = findObserver(state, observerId);
  return observer ? state.walkers.find((w) => w.id === observer.actorId) : undefined;
}

// 이동 진행 — 목표를 향해 일정 속도로 간다. 도착하면 목표가 사라진다.
function ruleWalkProgress(state: WorldState, dt: number): void {
  for (const walker of state.walkers) {
    if (!walker.target) continue;
    const dx = walker.target.x - walker.position.x;
    const dz = walker.target.z - walker.position.z;
    const distance = Math.hypot(dx, dz);
    const step = MOVE_SPEED * dt;
    if (distance <= step + ARRIVE_EPSILON) {
      walker.position = { x: walker.target.x, z: walker.target.z };
      delete walker.target;
      continue;
    }
    walker.position.x += (dx / distance) * step;
    walker.position.z += (dz / distance) * step;
  }
}

// ── 투영 ─────────────────────────────────────────────────────────────

export const SPEC_ID = 'VIEW-BLANK-001';

function projectObserver(state: WorldState, observerId: string): GameViewSnapshot | null {
  const observer = findObserver(state, observerId);
  const self = walkerOfObserver(state, observerId);
  if (!observer || !self) return null;

  const entities: EntityView[] = state.walkers.map((walker) => ({
    id: walker.id,
    role: walker.id === self.id ? 'player-character' : 'other-player-character',
    state: walker.target ? 'move' : 'idle',
    name: walker.name,
    kind: 'blank-walker',
    position: { x: walker.position.x, z: walker.position.z },
  }));

  const interactions: InteractionView[] = [
    { id: 'move', role: 'move-to', available: true },
  ];

  return {
    specId: SPEC_ID,
    scene: 'blank-field',
    observer: { id: observerId, characterId: self.id, acknowledgedMark: observer.acknowledgedMark },
    entities,
    interactions,
    hud: [
      { id: 'world.time', kind: 'counter', value: state.time },
      { id: 'observers.present', kind: 'counter', value: presentObserverCount(state) },
    ],
    debug: { open: false },
    commands: [],
  };
}

// ── 조립 ─────────────────────────────────────────────────────────────

/** 이 팩은 초기 배치 옵션이 없다 — 조립 계약을 위해 형태만 받는다 */
export interface WorldSetup {}

export function createWorld(_setup: WorldSetup = {}): World {
  const state: WorldState = { time: 0, observers: [], walkers: [] };

  const content: WorldContent<WorldState> = {
    tickInterval: TICK_INTERVAL,
    spawnObserverBody: (worldState, ordinal) => {
      const walker: WalkerState = {
        id: `walker-${ordinal + 1}`,
        name: `Walker ${ordinal + 1}`,
        position: { x: ordinal * 2, z: 0 },
      };
      worldState.walkers.push(walker);
      return walker.id;
    },
    interactions: [
      {
        id: 'move',
        handle: (worldState, observerId, action): ActionResult => {
          const walker = walkerOfObserver(worldState, observerId);
          if (!walker) return { status: 'failure', rule: RULE_WALK, reason: 'unknown-observer' };
          if (!action.position)
            return { status: 'failure', rule: RULE_WALK, reason: 'missing-position' };
          walker.target = { x: action.position.x, z: action.position.z };
          return { status: 'success', rule: RULE_WALK };
        },
      },
    ],
    systems: [ruleWalkProgress],
    postTimeSystems: [],
    projectObserver,
  };

  return createWorldKernel(state, content);
}
