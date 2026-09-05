// C027 — 존재도 같은 자리에 선다 · 시나리오 테스트
//
// 이 Cycle 도 **세계를 한 자리도 바꾸지 않는다** (spec World Change — W 레인이 비어 있다).
// 바뀌는 것은 결정 Layer 가 만드는 SceneState 뿐이다. 그래서 시나리오가 서는 자리는
// content/world/tests 가 아니라 여기다: 관찰 결과(봉투) + 관찰자의 지목 → SceneState 를
// 보고 단언한다. World 는 기동하지 않는다.
//
// 이 파일은 이 Cycle 이 새로 쓴 코드를 **읽지 않고** 쓴다 (c026-a-place-answers.spec.ts 의 선례).
// 그래서 줄의 id 도, 문구의 어법도, 판이 무슨 말로 적는지도 모른다. 아는 것은 spec 이 준 계약뿐이다:
//
//   resolvePresentation(snapshot, motions?, { designation })   designation = {entityId} | {ground:{x,z}}
//   SceneState.targetFrame { title, subtitle?, rows[{ id, label, value, progress?, muted? }] }
//   SceneState.highlight   { entityId?, ground?, color, opacity, radius }
//   SceneState.hud[]       { id, widget, label, value, progress? }
//   SceneState.keyHints    readonly string[]
//   pointerRules(pick, scene) → { kind: 'request' | 'designate' | 'clear' } | null
//
// **판정 방식** — spec 이 줄의 id 와 문구를 정하지 않았으므로, 단언은 "그 사실이 판 어딘가에
// 실렸는가" 로 한다: 줄의 label·value 를 이어 붙인 글에서 **의미 코드의 문구**(codeText)를 찾는다
// (C026 의 하네스 그대로 — 세 글자 이상이면 포함, 한두 글자면 토큰).
//
// 그리고 문구를 모르는 자리는 **차이로** 잰다: 같은 봉투에서 한 가지만 바꿔 두 판을 세우고
// 줄의 id 집합이 어떻게 달라지는가로 "그 줄이 섰다 / 서지 않았다" 를 판정한다. 이 규율 덕에
// 이 파일은 판이 무슨 말을 쓰는지 몰라도 **없는 줄이 생겼는가**를 단언할 수 있다.
//
// 개수는 단언하지 않는다 — 다른 Cycle 이 줄을 더해도 깨지면 안 된다 (있음과 행동만 본다).

import { describe, expect, it } from 'vitest';
import type { EntityView, GameViewSnapshot, InteractionView, RegionStateView } from '../../protocol/gameview';
import type { SceneState } from '../../../engine/view-kernel/scene/scene-state';
import { resolvePresentation } from '../resolve';
import { pointerRules } from '../pointer-rules';
import { codeText } from '../code-text';
import { compileRegion } from '../../../engine/world-authoring/compile';
import { descriptionHash } from '../../../engine/world-authoring/description';
import { blockedReasonAt, isTraversableAt, tagsAt } from '../../../engine/world-authoring/query';
import type { CompiledWorldTerrain } from '../../../engine/world-authoring/compiled';
import { regionSpec } from '../../regions/index';
import {
  BLOCK_STEEP,
  BLOCK_WATER,
  COMPILE_RULES,
  CONDITION_RIDGE,
  CONDITION_RIVER,
  CONDITION_TREE,
  SETTLEMENT_LAYER,
  SURFACE_FLAT,
  SURFACE_WET,
} from '../../regions/terrain-rules';

// ── 계약이 준 형 ──────────────────────────────────────────────────────
//
// spec 이 SceneState 에 있다고 말한 자리를 **글로 적힌 그대로** 여기 둔다
// (engine 이 세운 형과 같은 모양이 된다 — 이 파일은 그것을 읽지 않고 쓴다).

interface TargetFrameRow {
  id: string;
  label: string;
  value: string | number;
  progress?: number;
  muted?: boolean;
}

interface TargetFrame {
  title: string;
  subtitle?: string;
  rows: TargetFrameRow[];
}

interface Highlight {
  entityId?: string;
  ground?: { x: number; z: number };
  color: number;
  opacity: number;
  radius: number;
}

type Scene = SceneState & { targetFrame?: TargetFrame; highlight?: Highlight };

// ── 땅 하네스 (C026 그대로) ───────────────────────────────────────────

const WHITE_KING = 'WHITE_KING_DOMAIN';
const MAZE = 'FANTASY_MAZE';

function compiledWorld(regionId: string): CompiledWorldTerrain {
  const spec = regionSpec(regionId);
  if (!spec) throw new Error(`content/regions 에 '${regionId}' 가 없다`);
  return compileRegion(spec.space, COMPILE_RULES).world;
}

function hashOf(regionId: string): string {
  const spec = regionSpec(regionId);
  if (!spec) throw new Error(`content/regions 에 '${regionId}' 가 없다`);
  return descriptionHash(spec.space);
}

/** 조건에 맞는 첫 자리 — 좌표를 박아 두지 않는다 (데이터가 바뀌면 자리도 함께 옮겨 간다) */
function findPlace(
  world: CompiledWorldTerrain,
  match: (x: number, z: number, surface: string) => boolean,
): { x: number; z: number } {
  for (let iz = 0; iz < world.rows; iz++) {
    for (let ix = 0; ix < world.cols; ix++) {
      const x = world.extent.minX + ix * world.resolution;
      const z = world.extent.minZ + iz * world.resolution;
      const surface = world.surfaceTags[world.surface[iz * world.cols + ix] ?? 0] ?? '';
      if (match(x, z, surface)) return { x, z };
    }
  }
  throw new Error('그런 자리가 이 방에 없다 — 데이터가 바뀌었으면 조건을 함께 고쳐야 한다');
}

const WHITE_KING_WORLD = compiledWorld(WHITE_KING);
const MAZE_WORLD = compiledWorld(MAZE);

/** 평지이고 지나갈 수 있는 자리 */
const FLAT = findPlace(
  WHITE_KING_WORLD,
  (x, z, surface) => surface === SURFACE_FLAT && isTraversableAt(WHITE_KING_WORLD, x, z),
);
/** 젖었지만 걸어 다닐 수 있는 자리 */
const WET = findPlace(
  WHITE_KING_WORLD,
  (x, z, surface) => surface === SURFACE_WET && isTraversableAt(WHITE_KING_WORLD, x, z),
);
/** 급경사로 막힌 자리 */
const STEEP = findPlace(WHITE_KING_WORLD, (x, z) => blockedReasonAt(WHITE_KING_WORLD, x, z) === BLOCK_STEEP);
/** 아무 area 에도 걸리지 않은 자리 — "땅에서 유도할 것이 없는 자리" 다 */
const BARE = findPlace(
  WHITE_KING_WORLD,
  (x, z) =>
    tagsAt(WHITE_KING_WORLD, x, z, SETTLEMENT_LAYER).length === 0 &&
    isTraversableAt(WHITE_KING_WORLD, x, z),
);

/** 미로 — 구역 A 의 한가운데 */
const CELL_A_CENTER = { x: -20, z: 20 };

const CONDITION_TAGS = [CONDITION_RIDGE, CONDITION_RIVER, CONDITION_TREE];

// ── 존재 하네스 ───────────────────────────────────────────────────────
//
// 봉투에 새로 실리는 것은 하나도 없다 (spec World Change). 아래의 존재들은 C001 이전부터
// 있던 자리(name · role · kind · state · vitality · attended)만 채운다.

/** 이름을 가진 사람 — 생명 7 / 12, 지금 걷고 있다 */
const FERRA: EntityView = {
  id: 'npc-ferra',
  role: 'npc-character',
  state: 'move',
  kind: 'wanderer',
  name: '페라',
  position: { x: 4, z: 12 },
  vitality: { health: 7, healthMaximum: 12, downed: false },
};

/** 이름 없는 짐승 둘 — 같은 종류다 (종류의 이름으로 서는지 보는 자리) */
const BEAST_A: EntityView = {
  id: 'beast-a',
  role: 'npc-character',
  state: 'idle',
  kind: 'wanderer',
  position: { x: -6, z: 10 },
  vitality: { health: 3, healthMaximum: 9, downed: false },
};
const BEAST_B: EntityView = { ...BEAST_A, id: 'beast-b', position: { x: -8, z: 10 } };

/** 생명을 갖지 않는 것 둘 — 광맥과 출구 표식 */
const DEPOSIT: EntityView = {
  id: 'deposit-1',
  role: 'resource-deposit',
  state: 'available',
  kind: 'stone',
  position: { x: 8, z: -6 },
  labelValue: 5,
};
const GATE: EntityView = {
  id: 'MAZE_GATE_RETURN',
  role: 'region-exit',
  state: 'open',
  kind: 'road',
  position: { x: 0, z: 18 },
};

/** 이름도 종류도 모르는 것 — 지어내지 않는가를 보는 자리 */
const STRANGER: EntityView = {
  id: 'c027-test:unknown-body',
  role: 'c027-test:no-such-role',
  state: 'c027-test:no-such-state',
  kind: 'c027-test:no-such-kind',
  position: { x: 12, z: 12 },
};

/** 내 몸 */
const ME: EntityView = {
  id: 'player',
  role: 'player-character',
  state: 'idle',
  kind: 'rabbit-swordsman',
  position: { x: FLAT.x, z: FLAT.z },
};

/** 그 대상을 겨냥한 행동들 — 사유 코드를 대상마다 **다르게** 두어 섞임을 잡는다 */
const MINE_DEPOSIT: InteractionView = {
  id: 'mine',
  role: 'mine-deposit',
  targetEntityId: DEPOSIT.id,
  available: false,
  reason: 'out-of-range',
};
const GATE_SEALED: InteractionView = {
  id: 'gate-lock',
  role: 'transit-connector',
  targetEntityId: GATE.id,
  available: false,
  reason: 'c027-test:gate-sealed',
};
const TRANSIT_GATE: InteractionView = {
  id: 'transit',
  role: 'transit-connector',
  targetEntityId: GATE.id,
  available: true,
};
const MOVE: InteractionView = { id: 'move', role: 'move-to', available: true };

/** 내 몸의 것 — 상시 HUD 에 남아야 하는 것들 (spec SPEC-006 경계) */
const SELF_HUD = [
  { id: 'inventory.stone', kind: 'counter' as const, value: 4 },
  { id: 'tool.hasMiningTool', kind: 'flag' as const, value: true },
  { id: 'player.action', kind: 'label' as const, value: 'idle' },
  { id: 'world.time', kind: 'counter' as const, value: 100 },
  { id: 'observers.present', kind: 'counter' as const, value: 2 },
];

interface Made {
  region?: string;
  at?: { x: number; z: number };
  depth?: string;
  standing?: string[];
  state?: RegionStateView;
  entities?: EntityView[];
  interactions?: InteractionView[];
  hud?: GameViewSnapshot['hud'];
}

/**
 * 관찰 결과 하나 — 봉투의 자리는 C008 까지의 것뿐이다 (한 자리도 늘지 않는다).
 * region-c003.spec.ts 의 선례대로 fixture 를 새로 두지 않고 손으로 짓는다.
 */
function made(options: Made = {}): GameViewSnapshot {
  const region = options.region ?? WHITE_KING;
  const at = options.at ?? { x: FLAT.x, z: FLAT.z };
  const depth = options.depth ?? (region === MAZE ? 'deep' : 'civil');
  return {
    specId: 'VIEW-STONE-MINING-001',
    scene: region,
    region: {
      id: region,
      hash: hashOf(region),
      ...(options.state ? { state: options.state } : {}),
    },
    standingConditions: options.standing ?? [],
    observer: { id: 'observer-a', characterId: ME.id, acknowledgedMark: 0 },
    entities: options.entities ?? [{ ...ME, position: { ...at } }],
    interactions: options.interactions ?? [MOVE],
    hud: options.hud ?? [{ id: 'region.depth', kind: 'label', value: depth }, ...SELF_HUD],
    strikes: [],
    debug: { open: false },
    commands: [],
  } as GameViewSnapshot;
}

/** 사람·짐승·광맥·출구 표식·낯선 것이 모두 서 있는 방 */
function crowd(overrides: Made = {}): GameViewSnapshot {
  return made({
    entities: [ME, FERRA, BEAST_A, BEAST_B, DEPOSIT, GATE, STRANGER],
    interactions: [MOVE, MINE_DEPOSIT, TRANSIT_GATE, GATE_SEALED],
    ...overrides,
  });
}

const MAZE_STATE: RegionStateView = { pattern: 'DEFAULT', pressure: 63, pressureLimit: 120 };

// ── 화면 만들기 ───────────────────────────────────────────────────────

type Designation = { entityId: string } | { ground: { x: number; z: number } };

function resolveWith(snapshot: GameViewSnapshot, designation?: Designation): Scene {
  return resolvePresentation(snapshot, undefined, {
    ...(designation ? { designation } : {}),
  } as Parameters<typeof resolvePresentation>[2]) as Scene;
}

/** 아무것도 지목하지 않은 화면 */
const look = (snapshot: GameViewSnapshot): Scene => resolveWith(snapshot);
/** 존재를 지목한 화면 */
const point = (snapshot: GameViewSnapshot, entityId: string): Scene => resolveWith(snapshot, { entityId });
/** 자리를 지목한 화면 (C026) */
const place = (snapshot: GameViewSnapshot, x: number, z: number): Scene =>
  resolveWith(snapshot, { ground: { x, z } });

function frameOf(scene: Scene): TargetFrame {
  const frame = scene.targetFrame;
  if (!frame) throw new Error('판(targetFrame)이 서지 않았다');
  return frame;
}

const rowsOf = (scene: Scene): TargetFrameRow[] => frameOf(scene).rows;
const rowIds = (scene: Scene): string[] => rowsOf(scene).map((row) => row.id);

/** 줄들의 글 — label 과 value 를 각각 하나의 글로 본다 */
function rowTexts(scene: Scene): string[] {
  return rowsOf(scene).flatMap((row) => [String(row.label ?? ''), String(row.value ?? '')]);
}

/** 판 전체의 글 — 제목·부제까지 */
function frameTexts(scene: Scene): string[] {
  const frame = frameOf(scene);
  return [frame.title ?? '', frame.subtitle ?? '', ...rowTexts(scene)];
}

/** 상시 HUD 의 글 — 이 Cycle 이 "여기 없어야 한다" 를 재는 자리 */
function hudTexts(scene: Scene): string[] {
  return scene.hud.flatMap((item) => [String(item.label ?? ''), String(item.value ?? '')]);
}

/** 짧은 태그가 다른 말 속에서 우연히 걸리지 않도록 — 세 글자 이상은 포함, 아니면 토큰 (C026 하네스) */
function said(texts: readonly string[], needle: string): boolean {
  if (needle.length >= 3) return texts.some((text) => text.includes(needle));
  return texts.some((text) => text.split(/[^\p{L}\p{N}:._-]+/u).includes(needle));
}

const rowsSay = (scene: Scene, code: string): boolean => said(rowTexts(scene), codeText(code));
const frameSays = (scene: Scene, code: string): boolean => said(frameTexts(scene), codeText(code));
const hudSays = (scene: Scene, code: string): boolean => said(hudTexts(scene), codeText(code));

/** 줄 하나를 그대로 가리키는 열쇠 — 같은 id 의 줄이 여럿 설 수 있으므로 값까지 함께 본다 */
const rowKey = (row: TargetFrameRow): string => `${row.id}|${row.label}|${row.value}`;

/**
 * 그 판에만 있는 줄들 — "이 사실 때문에 선 줄" 을 문구 없이 집는 수단.
 * 같은 봉투에서 한 가지만 뺀 판과 견주므로, 남는 것이 곧 그 사실이 세운 줄이다.
 */
function extraRows(scene: Scene, other: Scene): TargetFrameRow[] {
  const pool = rowsOf(other).map(rowKey);
  const extra: TargetFrameRow[] = [];
  for (const row of rowsOf(scene)) {
    const at = pool.indexOf(rowKey(row));
    if (at >= 0) pool.splice(at, 1);
    else extra.push(row);
  }
  return extra;
}

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-001 존재를 지목하면 그 존재가 판에 선다', () => {
  it('S-001 이름을 가진 존재를 지목하면 판의 제목이 그 이름이다', () => {
    // Given 이름이 실려 온 사람 하나 (봉투의 entities[].name — 이미 있는 자리다)
    // When  그를 지목한다
    const scene = point(crowd(), FERRA.id);
    // Then  판이 서고 제목이 그 이름이다
    expect(scene.targetFrame).toBeDefined();
    expect(frameOf(scene).title).toContain(FERRA.name!);
    expect(rowsOf(scene).length).toBeGreaterThan(0);
    for (const row of rowsOf(scene)) {
      expect(typeof row.id).toBe('string');
      expect(row.id.length).toBeGreaterThan(0);
      expect(row.value === undefined).toBe(false);
    }
  });

  it('S-002 이름이 없는 존재는 그 종류의 이름으로 선다 — 세계의 코드가 제목에 서지 않는다', () => {
    // Given 이름이 없는 광맥과 출구 표식 (Observable ① 이 이름까지 짚은 자리다)
    for (const entity of [DEPOSIT, GATE]) {
      // When 지목한다
      const title = frameOf(point(crowd(), entity.id)).title;
      // Then 제목에 세계의 코드(MAZE_GATE_RETURN 같은 id)가 서지 않는다
      expect({ id: entity.id, title }).not.toEqual({ id: entity.id, title: entity.id });
      expect(title.length).toBeGreaterThan(0);
    }
  });

  it('S-003 같은 종류의 이름 없는 둘은 같은 제목으로, 다른 종류는 다른 제목으로 선다', () => {
    // Given 같은 kind 의 짐승 둘과, 서로 다른 kind 의 광맥·출구 표식
    const snapshot = crowd();
    // Then 종류의 이름으로 서므로 같은 종류는 같은 제목이다
    expect(frameOf(point(snapshot, BEAST_A.id)).title).toBe(frameOf(point(snapshot, BEAST_B.id)).title);
    // And 종류가 다르면 제목도 갈린다 — 하나의 말로 뭉뚱그리지 않는다
    expect(frameOf(point(snapshot, DEPOSIT.id)).title).not.toBe(frameOf(point(snapshot, GATE.id)).title);
  });

  it('S-004 (경계) 이름도 종류도 모르는 것은 코드 그대로 뜬다 — 지어내지 않는다', () => {
    // Given 표에 없는 role · kind 를 가진 존재
    const title = frameOf(point(crowd(), STRANGER.id)).title;
    // Then 제목은 봉투가 실어 온 코드 셋 중 하나다 — 없는 이름을 만들어 붙이지 않는다
    expect([STRANGER.id, STRANGER.role, STRANGER.kind]).toContain(title);
  });

  it('S-005 (경계) 자리를 지목했을 때의 제목은 C026 그대로다 — 존재의 이름이 새어 들지 않는다', () => {
    // Given 존재들이 서 있는 방 / When 존재가 아니라 땅을 지목한다
    const scene = place(crowd(), WET.x, WET.z);
    // Then 그 자리의 판이고, 존재의 이름은 어디에도 없다
    expect(scene.targetFrame).toBeDefined();
    expect(frameTexts(scene).join('\n')).not.toContain(FERRA.name!);
    expect(rowsSay(scene, SURFACE_WET)).toBe(true);
  });
});

describe('SPEC-002 그 존재가 어떤 상태인지 말한다', () => {
  it('S-006 사람을 지목하면 생명(지금 / 최대)이 실리고, 얼마나 남았는지가 함께 보인다', () => {
    // Given 생명 7 / 12 인 사람 / When 지목한다
    const scene = point(crowd(), FERRA.id);
    const vitality = FERRA.vitality!;
    // Then 지금의 생명이 실린다
    expect(said(rowTexts(scene), String(vitality.health))).toBe(true);
    // And 얼마나 남았는지가 함께 온다 — 최대치가 적히거나 채움(progress)으로 실린다 (C026 S-014 의 어법)
    const asMaximum = said(rowTexts(scene), String(vitality.healthMaximum));
    const asProgress = rowsOf(scene).some(
      (row) =>
        row.progress !== undefined &&
        Math.abs(row.progress - vitality.health / vitality.healthMaximum) < 0.01,
    );
    expect(asMaximum || asProgress).toBe(true);
  });

  it('S-007 지금 하는 일이 줄로 실린다', () => {
    // Given 지금 걷고 있는 사람 (state = move) / When 지목한다
    const scene = point(crowd(), FERRA.id);
    // Then 그 행동이 줄로 읽힌다 (문구 표를 거친다 — 미등록이면 코드 그대로 선다)
    expect(rowsSay(scene, FERRA.state)).toBe(true);
  });

  it('S-008 (경계) 생명을 갖지 않는 존재에는 그 줄이 아예 없다 — 0 으로 지어내지 않는다', () => {
    // Given 사람의 판에서 생명을 진 줄을 집는다 (문구를 모르므로 값으로 집는다)
    const person = point(crowd(), FERRA.id);
    const vitality = FERRA.vitality!;
    const healthRows = rowsOf(person).filter(
      (row) =>
        said([String(row.label), String(row.value)], String(vitality.healthMaximum)) ||
        (row.progress !== undefined &&
          Math.abs(row.progress - vitality.health / vitality.healthMaximum) < 0.01),
    );
    expect(healthRows.length).toBeGreaterThan(0);

    // When 생명을 갖지 않는 것들을 지목한다 / Then 그 줄이 자리에 없다
    for (const entity of [DEPOSIT, GATE]) {
      const scene = point(crowd(), entity.id);
      for (const row of healthRows) {
        expect({ id: entity.id, row: row.id, stood: rowIds(scene).includes(row.id) }).toEqual({
          id: entity.id,
          row: row.id,
          stood: false,
        });
        expect({
          id: entity.id,
          label: row.label,
          stood: rowsOf(scene).some((other) => other.label === row.label),
        }).toEqual({ id: entity.id, label: row.label, stood: false });
      }
    }
  });

  it('S-009 (경계) 쓰러진 몸은 쓰러졌다는 것이 읽힌다', () => {
    // Given 쓰러진 사람 (기존 downed 상태 — 새 문구를 짓지 않는다)
    const fallen: EntityView = {
      ...FERRA,
      state: 'downed',
      vitality: { health: 0, healthMaximum: 12, downed: true },
    };
    // When 지목한다 / Then 쓰러졌다는 것이 판에 선다
    const scene = point(crowd({ entities: [ME, fallen] }), fallen.id);
    expect(frameSays(scene, 'downed')).toBe(true);
  });
});

describe('SPEC-003 그 대상이 주는 것을 말한다', () => {
  it('S-010 광맥을 지목하면 그것을 겨냥한 행동이 줄로 서고, 못 하는 것은 사유가 함께 실린다', () => {
    // Given 채굴이 걸려 있으나 지금은 멀어서 안 되는 광맥
    const scene = point(crowd(), DEPOSIT.id);
    // Then 사유 코드가 함께 읽힌다 — 걸어가 거절당하기 전에 안다
    expect(rowsSay(scene, MINE_DEPOSIT.reason!)).toBe(true);
    // And 그 행동 때문에 선 줄이 실제로 있다 (같은 봉투에서 그 행동만 뺀 판과 견준다)
    const without = point(crowd({ interactions: [MOVE] }), DEPOSIT.id);
    expect(extraRows(scene, without).length).toBeGreaterThan(0);
  });

  it('S-011 출구 표식을 지목하면 걸 수 있는 것과 못 하는 것이 함께 선다', () => {
    // Given 건널 수 있는 통로 하나와, 잠겨서 못 하는 것 하나가 같은 표식을 겨냥한다
    const scene = point(crowd(), GATE.id);
    // Then 못 하는 것의 사유가 실린다
    expect(rowsSay(scene, GATE_SEALED.reason!)).toBe(true);
    // And 걸 수 있는 것도 줄로 선다 — 되는 것이 사라지지 않는다
    const without = point(crowd({ interactions: [MOVE, GATE_SEALED] }), GATE.id);
    expect(extraRows(scene, without).length).toBeGreaterThan(0);
  });

  it('S-012 (경계) 그 대상을 겨냥한 행동이 하나도 없으면 그 줄들이 없다', () => {
    // Given 아무 행동도 겨냥하지 않은 짐승
    const beast = point(crowd(), BEAST_A.id);
    // Given 광맥의 판이 행동 때문에 세운 줄들
    const offered = extraRows(point(crowd(), DEPOSIT.id), point(crowd({ interactions: [MOVE] }), DEPOSIT.id));
    expect(offered.length).toBeGreaterThan(0);
    // Then 짐승의 판에는 그 줄이 자리째 없다 — 이름도 값도 서지 않는다
    for (const row of offered) {
      expect({ row: row.label, stood: rowsOf(beast).some((one) => one.label === row.label) }).toEqual({
        row: row.label,
        stood: false,
      });
      expect({ row: rowKey(row), stood: rowsOf(beast).some((one) => rowKey(one) === rowKey(row)) }).toEqual({
        row: rowKey(row),
        stood: false,
      });
    }
    // And 다른 대상의 사유가 새어 들지도 않는다
    expect(rowsSay(beast, MINE_DEPOSIT.reason!)).toBe(false);
    expect(rowsSay(beast, GATE_SEALED.reason!)).toBe(false);
  });

  it('S-013 (경계) 다른 대상을 겨냥한 행동은 실리지 않는다 — 지목한 것의 것만 읽힌다', () => {
    // Given 광맥의 사유와 출구 표식의 사유가 서로 다른 코드다
    const onDeposit = point(crowd(), DEPOSIT.id);
    const onGate = point(crowd(), GATE.id);
    // Then 각자 자기 것만 읽는다
    expect(rowsSay(onDeposit, MINE_DEPOSIT.reason!)).toBe(true);
    expect(rowsSay(onDeposit, GATE_SEALED.reason!)).toBe(false);
    expect(rowsSay(onGate, GATE_SEALED.reason!)).toBe(true);
    expect(rowsSay(onGate, MINE_DEPOSIT.reason!)).toBe(false);
  });
});

describe('SPEC-004 지목은 유지되고, 사라지면 풀린다', () => {
  it('S-014 지목한 몸이 세계 안에서 표시된다 — 내가 누른 것과 판이 말하는 것이 같은 몸이다', () => {
    const scene = point(crowd(), FERRA.id);
    expect(scene.highlight).toBeDefined();
    expect(scene.highlight!.entityId).toBe(FERRA.id);
    expect(typeof scene.highlight!.color).toBe('number');
    expect(scene.highlight!.opacity).toBeGreaterThan(0);
    expect(scene.highlight!.radius).toBeGreaterThan(0);
  });

  it('S-015 (경계) 쓰러져도 풀리지 않는다 — 쓰러진 채로 계속 읽힌다 (확정 8)', () => {
    // Given 지목한 사람이 다음 tick 에 쓰러진다 (세계에서 사라진 것이 아니다)
    const fallen: EntityView = {
      ...FERRA,
      state: 'downed',
      vitality: { health: 0, healthMaximum: 12, downed: true },
    };
    const after = point(crowd({ entities: [ME, fallen, DEPOSIT] }), FERRA.id);
    // Then 판이 그대로 서 있고 여전히 그 몸의 것이다
    expect(after.targetFrame).toBeDefined();
    expect(frameOf(after).title).toContain(FERRA.name!);
    expect(after.highlight?.entityId).toBe(FERRA.id);
  });

  it('S-016 세계에서 사라지면 풀린다 — 그리고 풀린 자리는 비어 있지 않다', () => {
    // Given 지목했던 몸이 더는 봉투에 없다
    const gone = crowd({ entities: [ME, DEPOSIT] });
    expect(gone.entities.some((entity) => entity.id === FERRA.id)).toBe(false);
    // When 그 id 로 판을 세우려 한다
    const scene = point(gone, FERRA.id);
    // Then 그 몸의 판이 아니고, 아무것도 지목하지 않았을 때의 판(기본 대상)으로 돌아간다 (SPEC-004 경계)
    const idle = look(gone);
    expect(frameTexts(scene).join('\n')).not.toContain(FERRA.name!);
    expect(scene.targetFrame).toEqual(idle.targetFrame);
    expect(scene.highlight).toEqual(idle.highlight);
  });

  it('S-017 새로 지목하지 않으면 대상은 그대로다 — 세계가 흘러도 같은 몸을 읽는다', () => {
    // Given 지목한 사람이 걷다가 멈춘다 (같은 몸 · 다른 tick)
    const moved: EntityView = { ...FERRA, state: 'idle', position: { x: 9, z: 9 } };
    const before = point(crowd(), FERRA.id);
    const after = point(crowd({ entities: [ME, moved, DEPOSIT, GATE] }), FERRA.id);
    // Then 여전히 그 몸의 판이다
    expect(frameOf(after).title).toBe(frameOf(before).title);
    expect(after.highlight?.entityId).toBe(FERRA.id);
  });

  it.todo(
    'GAP: Escape 로 풀리는가 — 지목을 쥐는 것은 조립(app)이고 실제 키 입력이 필요하다 (C026 S-031 과 같은 이유)',
  );
  it.todo(
    'GAP: 방을 옮기면 풀리는가 — 이전 방 id 를 기억하는 것은 조립(app)이고 SceneState 에 실리지 않는다',
  );
});

describe('SPEC-005 지목이 없으면 판은 내가 선 자리를 진다', () => {
  it('S-018 아무것도 지목하지 않아도 판이 서고, 내 몸이 선 자리를 진다', () => {
    // Given 젖은 자리에 서 있는 나 / When 아무것도 지목하지 않는다
    const scene = look(made({ at: WET, depth: 'civil' }));
    // Then 판이 있고, 그 자리의 사실이 C026 의 자리 읽기와 같은 어법으로 실린다
    expect(scene.targetFrame).toBeDefined();
    expect(rowsOf(scene).length).toBeGreaterThan(0);
    expect(rowsSay(scene, SURFACE_WET)).toBe(true);
  });

  it('S-019 내가 움직이면 판이 따라 바뀐다', () => {
    // Given 같은 방, 다른 자리에 선 나 (평지 · 젖은 자리)
    const onFlat = look(made({ at: FLAT }));
    const onWet = look(made({ at: WET }));
    // Then 같은 판이 아니고, 각각 자기 자리를 말한다
    expect(rowTexts(onWet).join('\n')).not.toBe(rowTexts(onFlat).join('\n'));
    expect(rowsSay(onFlat, SURFACE_FLAT)).toBe(true);
    expect(rowsSay(onWet, SURFACE_WET)).toBe(true);
  });

  it('S-020 내가 선 자리의 깊이가 판에 실린다 — 봉투의 hud[region.depth] 가 여기로 옮겨 온다', () => {
    const shallow = look(made({ at: FLAT, depth: 'civil' }));
    const deep = look(made({ region: MAZE, at: CELL_A_CENTER, depth: 'deep', state: MAZE_STATE }));
    expect(frameSays(shallow, 'civil')).toBe(true);
    expect(frameSays(deep, 'deep')).toBe(true);
  });

  it('S-021 (경계) 안전한 이유는 세계가 준 것(standingConditions)이지 땅에서 유도한 것이 아니다', () => {
    // Given 땅에는 아무 area 도 걸리지 않은 자리 — 유도할 것이 하나도 없는 자리다
    expect(tagsAt(WHITE_KING_WORLD, BARE.x, BARE.z, SETTLEMENT_LAYER)).toEqual([]);
    // When 세계가 그 자리에서 조건 하나를 실어 보낸다
    const given = look(made({ at: BARE, standing: [CONDITION_TREE] }));
    // Then 그 조건이 판에 선다 — 땅이 아니라 세계가 준 것이기 때문이다
    expect(rowsSay(given, CONDITION_TREE)).toBe(true);
    // And 세계가 아무 조건도 주지 않으면 그 줄이 없다 (땅에서 지어내지 않는다)
    const none = look(made({ at: BARE, standing: [] }));
    for (const tag of CONDITION_TAGS) {
      expect({ tag, said: rowsSay(none, tag) }).toEqual({ tag, said: false });
    }
  });

  it('S-022 (경계) 겹친 조건은 전부 실린다 — 하나로 줄이지 않는다 (C006 safe-by 규율)', () => {
    const scene = look(made({ at: BARE, standing: [CONDITION_RIDGE, CONDITION_RIVER] }));
    for (const tag of [CONDITION_RIDGE, CONDITION_RIVER]) {
      expect({ tag, said: rowsSay(scene, tag) }).toEqual({ tag, said: true });
    }
  });

  it('S-023 규칙을 품은 방이면 압력이 판에 실린다', () => {
    const scene = look(made({ region: MAZE, at: CELL_A_CENTER, state: MAZE_STATE }));
    expect(rowsSay(scene, MAZE_STATE.pattern)).toBe(true);
    const asNumber = said(rowTexts(scene), String(MAZE_STATE.pressure));
    const asProgress = rowsOf(scene).some(
      (row) =>
        row.progress !== undefined &&
        Math.abs(row.progress - MAZE_STATE.pressure / MAZE_STATE.pressureLimit) < 0.01,
    );
    expect(asNumber || asProgress).toBe(true);
  });

  it('S-024 (경계) 규칙을 품지 않은 방에서는 압력 줄이 아예 없다 — 0 으로 지어내지 않는다', () => {
    // Given 규칙 없는 방 (봉투에 region.state 자리가 없다)
    const snapshot = made({ at: FLAT });
    expect((snapshot.region as { state?: unknown }).state).toBeUndefined();
    // When 아무것도 지목하지 않는다 / Then 패턴도 압력도 없다 (C008 SPEC-007 · C026 SPEC-004 경계 그대로)
    const scene = look(snapshot);
    expect(rowsSay(scene, MAZE_STATE.pattern)).toBe(false);
    expect(said(rowTexts(scene), String(MAZE_STATE.pressureLimit))).toBe(false);
  });

  it('S-025 (경계) 존재를 지목하면 기본 대상이 물러난다 — 두 대상이 한 판에 겹치지 않는다', () => {
    const standing = look(crowd({ at: WET }));
    const being = point(crowd({ at: WET }), FERRA.id);
    expect(frameOf(being).title).not.toBe(frameOf(standing).title);
    expect(frameOf(being).title).toContain(FERRA.name!);
  });
});

describe('SPEC-006 상시 HUD 는 내 몸의 상태만 진다', () => {
  /** 깊이도 조건도 압력도 다 있는 화면 — 상시 HUD 가 가장 길어질 자리다 */
  const loaded = () =>
    made({
      region: MAZE,
      at: CELL_A_CENTER,
      depth: 'deep',
      standing: [CONDITION_TREE],
      state: MAZE_STATE,
      hud: [{ id: 'region.depth', kind: 'label', value: 'deep' }, ...SELF_HUD],
    });

  it('S-026 좌상단 HUD 에 깊이가 없다 — 그 사실은 판에 있다', () => {
    const scene = look(loaded());
    expect(scene.hud.some((item) => item.id === 'region.depth')).toBe(false);
    expect(hudSays(scene, 'deep')).toBe(false);
    expect(frameSays(scene, 'deep')).toBe(true); // 사라진 것이 아니라 옮겨 간 것이다
  });

  it('S-027 좌상단 HUD 에 안전한 이유가 없다 — 그 사실은 판에 있다', () => {
    const scene = look(loaded());
    expect(hudSays(scene, CONDITION_TREE)).toBe(false);
    expect(rowsSay(scene, CONDITION_TREE)).toBe(true);
  });

  it('S-028 좌상단 HUD 에 압력이 없다 — 그 사실은 판에 있다', () => {
    const scene = look(loaded());
    expect(said(hudTexts(scene), String(MAZE_STATE.pressure))).toBe(false);
    expect(hudSays(scene, MAZE_STATE.pattern)).toBe(false);
    expect(
      scene.hud.some(
        (item) =>
          item.progress !== undefined &&
          Math.abs(item.progress - MAZE_STATE.pressure / MAZE_STATE.pressureLimit) < 0.01,
      ),
    ).toBe(false);
    expect(rowsSay(scene, MAZE_STATE.pattern)).toBe(true);
  });

  it('S-029 (경계) 내 몸의 것은 그대로 남는다 — 행동 · 소지품 · 곡괭이 · 세계 시간 · 함께', () => {
    const scene = look(loaded());
    for (const item of SELF_HUD) {
      expect({ id: item.id, stood: scene.hud.some((one) => one.id === item.id) }).toEqual({
        id: item.id,
        stood: true,
      });
    }
  });

  it('S-030 (경계) 같은 사실이 두 자리에 동시에 적히지 않는다', () => {
    const scene = look(loaded());
    // 깊이 · 안전한 이유 · 압력 — 셋 다 판에만 있고 HUD 에는 없다
    for (const code of ['deep', CONDITION_TREE, MAZE_STATE.pattern]) {
      expect({ code, frame: frameSays(scene, code), hud: hudSays(scene, code) }).toEqual({
        code,
        frame: true,
        hud: false,
      });
    }
  });

  it('S-031 (경계) 존재를 지목해도 상시 HUD 는 내 몸의 것뿐이다 — 대상의 것이 좌상단으로 새지 않는다', () => {
    const scene = point(crowd({ standing: [CONDITION_TREE] }), FERRA.id);
    expect(hudTexts(scene).join('\n')).not.toContain(FERRA.name!);
    expect(said(hudTexts(scene), String(FERRA.vitality!.healthMaximum))).toBe(false);
    for (const item of SELF_HUD) {
      expect({ id: item.id, stood: scene.hud.some((one) => one.id === item.id) }).toEqual({
        id: item.id,
        stood: true,
      });
    }
  });
});

describe('SPEC-007 화면이 지목하는 법을 말한다', () => {
  const scene = look(crowd());

  /**
   * 무엇이 지목을 뜻하는가는 C026 이 정한 **입력의 결정**이다 (C026 UNRESOLVED "지목의 입력").
   * 이 테스트는 그 결정을 짚지 않는다 — 정책이 실제로 지목으로 읽는 집기를 먼저 찾고,
   * **그 입력의 이름이 안내에 적혀 있는가**만 본다. 재는 것은 "화면이 말하지 않아 알 수 없던
   * 것이 없다" 이지 특정 키가 아니다.
   */
  const candidates = () => {
    const ground = { x: FLAT.x, z: FLAT.z };
    const none = { alt: false, shift: false, ctrl: false, meta: false };
    return [
      { words: ['alt', '알트', 'option', '옵션'], over: { modifiers: { ...none, alt: true } } },
      { words: ['shift', '시프트'], over: { modifiers: { ...none, shift: true } } },
      { words: ['ctrl', 'control', '컨트롤'], over: { modifiers: { ...none, ctrl: true } } },
      { words: ['meta', 'cmd', 'command', '커맨드', '⌘'], over: { modifiers: { ...none, meta: true } } },
      { words: ['우클릭', '오른쪽', '우측', 'right', 'rmb'], over: { modifiers: none, button: 2 } },
      { words: ['두 번', '두번', '더블', 'double'], over: { modifiers: none, doubleClick: true } },
      { words: ['지목'], over: { modifiers: none, designate: true } },
    ].map((one) => ({
      words: one.words,
      pick: { entityId: null, ground, ...one.over } as unknown as Parameters<typeof pointerRules>[0],
    }));
  };

  it('S-032 조작 안내에 지목하는 법이 한 줄로 적혀 있다', () => {
    // Given 정책이 실제로 지목으로 읽는 집기들
    const designating = candidates().filter(
      (one) => pointerRules(one.pick, scene)?.kind === 'designate',
    );
    expect(designating.length).toBeGreaterThan(0);
    // When 조작 안내를 읽는다
    const hints = (scene.keyHints ?? []).map((line) => line.toLowerCase());
    expect(hints.length).toBeGreaterThan(0);
    // Then 그 입력의 이름을 적은 줄이 있다 — 화면이 말하지 않아 알 수 없던 것이 없다
    const named = designating.some((one) =>
      one.words.some((word) => hints.some((line) => line.includes(word.toLowerCase()))),
    );
    expect({
      designating: designating.map((one) => one.words[0]),
      hints: scene.keyHints,
      named,
    }).toMatchObject({ named: true });
  });

  it('S-033 (경계) 기존 안내 줄들은 그대로다 — 줄이 하나 늘 뿐이고 지목 여부로 흔들리지 않는다', () => {
    // Given 지목하지 않은 화면 · 자리를 지목한 화면 · 존재를 지목한 화면
    const snapshot = crowd();
    const idle = look(snapshot);
    const onPlace = place(snapshot, FLAT.x, FLAT.z);
    const onBeing = point(snapshot, FERRA.id);
    // Then 안내는 늘 같다 — 지목하고 나서야 지목하는 법을 알려 주지 않는다
    expect(onPlace.keyHints).toEqual(idle.keyHints);
    expect(onBeing.keyHints).toEqual(idle.keyHints);
    // And 같은 줄이 두 번 서지 않는다
    const hints = idle.keyHints ?? [];
    expect(new Set(hints).size).toBe(hints.length);
    for (const line of hints) expect(line.trim().length).toBeGreaterThan(0);
  });
});

describe('SPEC-008 판과 상시 HUD 는 겹치지 않는다', () => {
  it.todo(
    'GAP: 판과 상시 HUD 가 화면에서 서로를 덮지 않는가 — CSS 배치의 사실이라 vitest 로 잴 수 없다 (브라우저 레이아웃이 필요하다)',
  );
  it.todo(
    'GAP: (경계) 판이 길어져도 가로로 번지지 않는가 — SceneTargetFrame 계약에 너비를 말하는 자리가 없다 (SceneSurface.width 와 달리 상한은 CSS 에만 있다). 잴 수 있게 하려면 계약이나 눈검증(shots) 이 필요하다',
  );
});

describe('SPEC-009 존재 지목도 세계에 아무것도 보내지 않는다', () => {
  const scene = look(crowd());

  /** 존재를 지목하는 집기들 — 무엇이 골라지든 **요청이 아니어야 한다** (C026 S-021 의 어법) */
  const designatePicks = () => {
    const none = { alt: false, shift: false, ctrl: false, meta: false };
    return [
      { entityId: DEPOSIT.id, ground: null, modifiers: { ...none, alt: true } },
      { entityId: DEPOSIT.id, ground: null, modifiers: { ...none, shift: true } },
      { entityId: DEPOSIT.id, ground: null, modifiers: { ...none, ctrl: true } },
      { entityId: DEPOSIT.id, ground: null, modifiers: { ...none, meta: true } },
      { entityId: DEPOSIT.id, ground: null, modifiers: none, button: 2 },
      { entityId: DEPOSIT.id, ground: null, modifiers: none, doubleClick: true },
      { entityId: DEPOSIT.id, ground: null, modifiers: none, designate: true },
    ].map((pick) => pick as unknown as Parameters<typeof pointerRules>[0]);
  };

  it('S-034 존재를 지목하는 집기는 요청이 아니라 지목이다', () => {
    const kinds = designatePicks().map((pick) => pointerRules(pick, scene)?.kind);
    expect(kinds).toContain('designate');
  });

  it('S-035 (경계) 지목한 것의 어떤 행동도 저절로 걸리지 않는다 — 판은 읽는 자리다', () => {
    for (const pick of designatePicks()) {
      const result = pointerRules(pick, scene);
      if (result?.kind !== 'designate') continue;
      expect(JSON.stringify(result)).not.toContain('interactionId');
    }
  });

  it('S-036 여러 번 지목하고 풀어도 봉투가 한 자리도 달라지지 않는다', () => {
    // Given 규칙을 품은 방의 봉투 (압력이 오를 수 있는 곳이다)
    const snapshot = crowd({ region: MAZE, at: CELL_A_CENTER, state: MAZE_STATE });
    const before = JSON.stringify(snapshot);
    // When 존재를 여러 번 지목하고 푼다
    point(snapshot, FERRA.id);
    point(snapshot, DEPOSIT.id);
    point(snapshot, GATE.id);
    look(snapshot);
    // Then 봉투도, 그 안의 압력도 그대로다 — 지목은 이동이 아니다
    expect(JSON.stringify(snapshot)).toBe(before);
    expect(snapshot.region.state?.pressure).toBe(MAZE_STATE.pressure);
  });

  it('S-037 (경계) 지목하지 않은 관찰자의 화면에는 아무 일도 일어나지 않는다', () => {
    const snapshot = crowd();
    const otherBefore = look(snapshot);
    point(snapshot, FERRA.id);
    const otherAfter = look(snapshot);
    expect(otherAfter).toEqual(otherBefore);
  });

  it.todo(
    'GAP: 실제로 세계로 나간 패킷이 0 인가 — 소켓(app/server)이 필요하다. 여기서는 봉투 불변만 잰다 (C026 과 같은 이유)',
  );
});

describe('회귀', () => {
  const civil = crowd();

  it('R-001 클릭 셋(빈 땅 이동 · 광맥 채굴 · 출구 건너기)이 C008 까지와 같은 요청을 만든다', () => {
    const scene = look(civil);
    const legacy = (entityId: string | null, ground: { x: number; z: number } | null) => {
      if (entityId) {
        const interaction = scene.interactions.find((one) => one.targetEntityId === entityId);
        if (interaction) return { interactionId: interaction.id, targetEntityId: entityId };
      }
      if (ground) {
        const terrain = scene.interactions.find((one) => one.terrainTarget);
        if (terrain) return { interactionId: terrain.id, position: ground };
      }
      return null;
    };

    const cases: { entityId: string | null; ground: { x: number; z: number } | null }[] = [
      { entityId: null, ground: { x: FLAT.x, z: FLAT.z } },
      { entityId: DEPOSIT.id, ground: null },
      { entityId: GATE.id, ground: null },
    ];

    for (const one of cases) {
      const expected = legacy(one.entityId, one.ground)!;
      const pick = {
        ...one,
        modifiers: { alt: false, shift: false, ctrl: false, meta: false },
      } as unknown as Parameters<typeof pointerRules>[0];
      const result = pointerRules(pick, scene);
      expect({ case: one, kind: result?.kind }).toEqual({ case: one, kind: 'request' });
      const json = JSON.stringify(result);
      expect(json).toContain(`"interactionId":"${expected.interactionId}"`);
      if (expected.targetEntityId) expect(json).toContain(`"targetEntityId":"${expected.targetEntityId}"`);
      if (expected.position) expect(json).toContain(`"z":${expected.position.z}`);
    }
  });

  it('R-002 C026 의 자리 읽기가 그대로다 — 표면과 못 지나가는 사유', () => {
    expect(rowsSay(place(civil, FLAT.x, FLAT.z), SURFACE_FLAT)).toBe(true);
    expect(rowsSay(place(civil, WET.x, WET.z), SURFACE_WET)).toBe(true);
    const steep = place(civil, STEEP.x, STEEP.z);
    expect(rowsSay(steep, BLOCK_STEEP)).toBe(true);
    expect(rowsSay(steep, BLOCK_WATER)).toBe(false);
  });

  it('R-003 C026 의 자리 지목이 그 자리를 세계 안에서 표시한다', () => {
    const scene = place(civil, WET.x, WET.z);
    expect(scene.highlight?.ground).toEqual({ x: WET.x, z: WET.z });
    expect(scene.highlight?.entityId).toBeUndefined();
  });

  it('R-004 C026 의 경계 그대로 — 규칙 없는 방을 지목하면 규칙 줄이 아예 없다', () => {
    const scene = place(civil, FLAT.x, FLAT.z);
    expect(rowsSay(scene, MAZE_STATE.pattern)).toBe(false);
    expect(said(rowTexts(scene), String(MAZE_STATE.pressureLimit))).toBe(false);
  });

  it('R-005 세계 위 상시 글자가 여전히 0 이다 — 지면 구역에 이름표가 없다', () => {
    for (const snapshot of [civil, made({ region: MAZE, at: CELL_A_CENTER, state: MAZE_STATE })]) {
      const scene = look(snapshot);
      expect(scene.zones.length).toBeGreaterThan(0);
      for (const zone of scene.zones) {
        expect({ id: zone.id, label: zone.label }).toEqual({ id: zone.id, label: undefined });
      }
    }
  });

  it('R-006 미로의 구역과 통로는 그대로 그려진다 — 걷어낸 것은 글자이지 구역이 아니다', () => {
    const zones = look(made({ region: MAZE, at: CELL_A_CENTER, state: MAZE_STATE })).zones;
    expect(zones.some((zone) => zone.id.startsWith('cell:'))).toBe(true);
    expect(zones.some((zone) => zone.id.startsWith('passage:'))).toBe(true);
    for (const zone of zones) {
      expect({ id: zone.id, drawn: !!(zone.fill || zone.edge) }).toEqual({ id: zone.id, drawn: true });
    }
    // 통로 판정을 세우는 땅도 그대로다 (C008 의 구역·통로 layer)
    expect(tagsAt(MAZE_WORLD, CELL_A_CENTER.x, CELL_A_CENTER.z, 'cell')).toEqual(['A']);
  });

  it('R-007 지목은 판과 표식 말고 화면의 어떤 자리도 건드리지 않는다', () => {
    const strip = (scene: Scene) => {
      const { targetFrame, highlight, ...rest } = scene;
      void targetFrame;
      void highlight;
      return rest;
    };
    const idle = look(civil);
    expect(strip(point(civil, FERRA.id))).toEqual(strip(idle));
    expect(strip(place(civil, WET.x, WET.z))).toEqual(strip(idle));
  });

  it('R-008 판이 서 있어도 자판이 읽는 자리가 그대로다 — 판은 초점을 붙잡지 않는다', () => {
    const idle = look(civil);
    const being = point(civil, FERRA.id);
    expect(being.interactions).toEqual(idle.interactions);
    expect(being.slotBars).toEqual(idle.slotBars);
    expect(being.commandSurface).toEqual(idle.commandSurface);
    // 겹쳐 뜨는 표면이 하나도 열리지 않는다 (판은 늘 떠 있는 원소다)
    const open = (scene: Scene) => scene.surfaces.filter((surface) => surface.open).length;
    expect(open(being)).toBe(open(idle));
  });

  it.todo(
    'GAP: 방 이름이 들어선 순간 한 번 지나가는가 — 진입 제목은 SceneState 에 실리지 않는다 (조립이 쥔 이전 방 id 가 필요하다 · C026 과 같은 이유)',
  );
});
