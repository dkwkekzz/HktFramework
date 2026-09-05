// C028 — 답이 남는다 · 시나리오 테스트
//
// 이 Cycle 도 **세계를 한 자리도 바꾸지 않는다** (spec World Change — W 레인이 비어 있다).
// 바뀌는 것은 결정 Layer 가 만드는 SceneState 뿐이다. 그래서 시나리오가 서는 자리는
// content/world/tests 가 아니라 여기다: 관찰 결과(봉투) + 관찰자가 모아 둔 기록 → SceneState 를
// 보고 단언한다. World 는 기동하지 않는다.
//
// 이 파일은 이 Cycle 이 새로 쓴 코드를 **읽지 않고** 쓴다 (C026 · C027 의 선례).
// 그래서 기록 줄의 어법도, 판이 무슨 말로 적는지도, 상한이 몇인지도 모른다. 아는 것은 spec 이
// 준 계약뿐이다:
//
//   resolvePresentation(snapshot, motions?, options)   options 는 관찰자가 쥐는 값들이다
//   SceneState.targetFrame { title, subtitle?, rows[…], log?[{ text, when? }] }
//   SceneState.hud[] · zones[] · highlight
//
// **어디까지 잴 수 있는가** — spec State 절이 경계를 그었다: "관찰자의 기록 — 세계 밖이다.
// 조립(app)이 쥔다." 그러므로 *모으는 것*(대답이 도착하면 쌓고 미는 것)은 조립이고 여기서
// 닿지 않는다. *그리는 지시로 옮기는 것*(무엇이 어떤 말로 · 얼마 전인지 · 어떤 차례로 · 비면
// 자리가 없는 것)은 결정 Layer 이고 여기서 잰다. 닿지 않는 것은 it.todo('GAP: …') 로 남긴다.
//
// **판정 방식 ①(문구)** — spec 이 줄의 어법을 정하지 않았으므로 단언은 "그 사실이 기록 어딘가에
// 실렸는가" 로 한다: 줄의 글에서 **의미 코드의 문구**(codeText)를 찾는다 (C026 · C027 하네스 그대로).
// 문구 표에 없는 코드는 코드 그대로 선다는 규율(code-text.ts 머리말)을 이용해, 세계의 알림처럼
// 코드를 모르는 자리는 **이 테스트가 지은 코드**를 넘기고 그것이 그대로 실렸는지로 본다.
//
// **판정 방식 ②(나이)** — "얼마 전인지" 는 어법을 모르므로 글에서 **숫자를 전부 뽑아** 그 안에
// 나이가 있는가로 본다 ("37초 전" 도 "0:37" 도 같이 통과하고, 원시 세계 시각(213)을 그대로 적으면
// 통과하지 않는다). 시간이 흐르면 그 값이 늘어난다는 것도 같은 방식으로 두 번 재어 본다.
//
// **판정 방식 ③(줄의 이름)** — 규칙 줄에 무엇이 더해졌는지는 같은 봉투에서 한 가지만 바꾼 두 판을
// 세워 **줄의 차이**로 집는다 (C027 의 extraRows 그대로).
//
// **하네스가 정한 것 (spec 이 침묵한 자리 — 보고의 감사 항목)**
//   ⓐ 기록이 resolvePresentation 에 어떤 이름으로 들어가는가. spec 은 "조립이 쥔다" 까지만 말한다.
//      그래서 하네스는 **알려진 어법 모두로** 같은 배열을 넘긴다 (log · answerLog · answers · frameLog).
//   ⓑ 기록 한 줄이 어떤 자리를 가지는가. 같은 이유로 **같은 사실을 여러 이름에** 적어 넘긴다:
//      무슨 일이 있었나를 code · reason(의미 코드)와 text · message(그 코드의 문구)에, 언제
//      있었나(세계 시각)를 at · time · worldTime · since 에. 어느 이름을 읽든 같은 말이 도착한다 —
//      코드를 문구로 옮기는 자리가 모으는 쪽인지 판인지는 spec 이 말하지 않았고, 이 파일은
//      그것을 묻지 않는다 (묻는 것은 "그 말이 판에 섰는가" 다).
//   ⓒ 상한이 몇 줄인가. spec 은 "판이 화면을 삼키지 않을 만큼" 이라고만 한다 — 여기서는
//      **24줄 이하**를 그 뜻으로 읽는다 (넘겨준 64건보다 적고, 남는 것은 새 것들이다).
//
// 개수는 단언하지 않는다 — 다른 Cycle 이 줄을 더해도 깨지면 안 된다 (있음과 행동만 본다).
// 다만 **기록의 줄 수**는 이 Cycle 의 주장 자체이므로 그것만 센다.

import { describe, expect, it } from 'vitest';
import type { EntityView, GameViewSnapshot, InteractionView, RegionStateView } from '../../protocol/gameview';
import type { SceneState } from '../../../engine/view-kernel/scene/scene-state';
import { resolvePresentation } from '../resolve';
import { codeText } from '../code-text';
import { compileRegion } from '../../../engine/world-authoring/compile';
import { descriptionHash } from '../../../engine/world-authoring/description';
import { blockedReasonAt, isTraversableAt } from '../../../engine/world-authoring/query';
import type { CompiledWorldTerrain } from '../../../engine/world-authoring/compiled';
import { regionSpec } from '../../regions/index';
import {
  BLOCK_STEEP,
  COMPILE_RULES,
  SURFACE_FLAT,
  SURFACE_WET,
} from '../../regions/terrain-rules';

// ── 계약이 준 형 ──────────────────────────────────────────────────────
//
// spec 이 SceneState 에 는다고 말한 자리를 **글로 적힌 그대로** 여기 둔다
// (engine 이 세운 형과 같은 모양이 된다 — 이 파일은 그것을 읽지 않고 쓴다).

interface TargetFrameRow {
  id: string;
  label: string;
  value: string | number;
  progress?: number;
  muted?: boolean;
}

/** 판의 기록 한 줄 — 무슨 일이 있었나, 그리고 (알면) 언제 있었나 */
interface FrameLogLine {
  text: string;
  when?: string;
}

interface TargetFrame {
  title: string;
  subtitle?: string;
  rows: TargetFrameRow[];
  log?: readonly FrameLogLine[];
}

interface Highlight {
  entityId?: string;
  ground?: { x: number; z: number };
  color: number;
  opacity: number;
  radius: number;
}

type Scene = SceneState & { targetFrame?: TargetFrame; highlight?: Highlight };

// ── 땅 하네스 (C026 · C027 그대로) ────────────────────────────────────

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

const FLAT = findPlace(
  WHITE_KING_WORLD,
  (x, z, surface) => surface === SURFACE_FLAT && isTraversableAt(WHITE_KING_WORLD, x, z),
);
const WET = findPlace(
  WHITE_KING_WORLD,
  (x, z, surface) => surface === SURFACE_WET && isTraversableAt(WHITE_KING_WORLD, x, z),
);
const STEEP = findPlace(WHITE_KING_WORLD, (x, z) => blockedReasonAt(WHITE_KING_WORLD, x, z) === BLOCK_STEEP);

/** 미로 — 구역 A 의 한가운데 */
const CELL_A_CENTER = { x: -20, z: 20 };

// ── 봉투 하네스 ───────────────────────────────────────────────────────
//
// 봉투에 새로 실리는 것은 하나도 없다 (spec World Change · Observable "늘어나는 것 없다").

const ME: EntityView = {
  id: 'player',
  role: 'player-character',
  state: 'idle',
  kind: 'rabbit-swordsman',
  position: { x: FLAT.x, z: FLAT.z },
};

const FERRA: EntityView = {
  id: 'npc-ferra',
  role: 'npc-character',
  state: 'move',
  kind: 'wanderer',
  name: '페라',
  position: { x: 4, z: 12 },
  vitality: { health: 7, healthMaximum: 12, downed: false },
};

const DEPOSIT: EntityView = {
  id: 'deposit-1',
  role: 'resource-deposit',
  state: 'available',
  kind: 'stone',
  position: { x: 8, z: -6 },
  labelValue: 5,
};

const MOVE: InteractionView = { id: 'move', role: 'move-to', available: true };
const MINE_DEPOSIT: InteractionView = {
  id: 'mine',
  role: 'mine-deposit',
  targetEntityId: DEPOSIT.id,
  available: true,
};

/** 내 몸의 것 — 상시 HUD 에 남아야 하는 것들 (C027 SPEC-006) */
const SELF_HUD_BASE = [
  { id: 'inventory.stone', kind: 'counter' as const, value: 4 },
  { id: 'tool.hasMiningTool', kind: 'flag' as const, value: true },
  { id: 'player.action', kind: 'label' as const, value: 'idle' },
  { id: 'observers.present', kind: 'counter' as const, value: 2 },
];

/** 세계 시각의 기본값 — 나이를 재는 값이다 (strikes.since 의 선례 그대로) */
const NOW = 250;

interface Made {
  region?: string;
  at?: { x: number; z: number };
  depth?: string;
  state?: RegionStateView;
  entities?: EntityView[];
  interactions?: InteractionView[];
  /** 봉투가 실어 온 세계 시각. null 이면 **세계 시각을 모르는 화면**이다 */
  now?: number | null;
}

function made(options: Made = {}): GameViewSnapshot {
  const region = options.region ?? WHITE_KING;
  const at = options.at ?? { x: FLAT.x, z: FLAT.z };
  const depth = options.depth ?? (region === MAZE ? 'deep' : 'civil');
  const now = options.now === undefined ? NOW : options.now;
  return {
    specId: 'VIEW-STONE-MINING-001',
    scene: region,
    region: {
      id: region,
      hash: hashOf(region),
      ...(options.state ? { state: options.state } : {}),
    },
    standingConditions: [],
    observer: { id: 'observer-a', characterId: ME.id, acknowledgedMark: 0 },
    entities: options.entities ?? [{ ...ME, position: { ...at } }, FERRA, DEPOSIT],
    interactions: options.interactions ?? [MOVE, MINE_DEPOSIT],
    hud: [
      { id: 'region.depth', kind: 'label', value: depth },
      ...SELF_HUD_BASE,
      ...(now === null ? [] : [{ id: 'world.time', kind: 'counter' as const, value: now }]),
    ],
    strikes: [],
    debug: { open: false },
    commands: [],
  } as GameViewSnapshot;
}

const MAZE_STATE: RegionStateView = { pattern: 'DEFAULT', pressure: 63, pressureLimit: 120 };

// ── 관찰자의 기록 (하네스가 정한 것 ⓐ ⓑ) ──────────────────────────────

/**
 * 세계가 나에게 한 말 하나. spec 은 이 형의 이름도 자리 이름도 정하지 않았다 —
 * 조립(app)이 쥐는 값이기 때문이다. 그래서 **같은 사실을 알려진 이름 모두에** 적는다.
 *
 * 무슨 일이 있었나는 **의미 코드와 그 코드의 문구를 함께** 적는다 (code · reason 에 코드,
 * text · message 에 문구). 모으는 자리가 코드를 쥐고 판이 문구로 옮기든, 모으는 자리가
 * 이미 문구로 옮겨 넘기든 — 어느 쪽이어도 판에는 **같은 말**이 도착한다. 이 파일은 그 말이
 * 판에 섰는가만 보고, 코드를 문구로 옮기는 자리가 어디인지는 묻지 않는다 (spec 이 침묵한다).
 */
function happening(code: string, at?: number): Record<string, unknown> {
  return {
    code,
    reason: code,
    text: codeText(code),
    message: codeText(code),
    accepted: false,
    ...(at === undefined ? {} : { at, time: at, worldTime: at, since: at }),
  };
}

type Designation = { entityId: string } | { ground: { x: number; z: number } };

interface Watching {
  designation?: Designation;
  /** 관찰자가 모아 둔 기록 — 새 것이 뒤인 시간 순서로 넘긴다 (하네스가 정한 차례) */
  log?: readonly Record<string, unknown>[];
}

function resolveWith(snapshot: GameViewSnapshot, watching: Watching = {}): Scene {
  const log = watching.log;
  return resolvePresentation(snapshot, undefined, {
    ...(watching.designation ? { designation: watching.designation } : {}),
    ...(log === undefined ? {} : { log, answerLog: log, answers: log, frameLog: log }),
  } as unknown as Parameters<typeof resolvePresentation>[2]) as Scene;
}

const look = (snapshot: GameViewSnapshot, log?: readonly Record<string, unknown>[]): Scene =>
  resolveWith(snapshot, log === undefined ? {} : { log });
const point = (snapshot: GameViewSnapshot, entityId: string, log?: readonly Record<string, unknown>[]): Scene =>
  resolveWith(snapshot, { designation: { entityId }, ...(log === undefined ? {} : { log }) });
const place = (
  snapshot: GameViewSnapshot,
  at: { x: number; z: number },
  log?: readonly Record<string, unknown>[],
): Scene => resolveWith(snapshot, { designation: { ground: at }, ...(log === undefined ? {} : { log }) });

// ── 읽는 자리 ─────────────────────────────────────────────────────────

function frameOf(scene: Scene): TargetFrame {
  const frame = scene.targetFrame;
  if (!frame) throw new Error('판(targetFrame)이 서지 않았다');
  return frame;
}

const rowsOf = (scene: Scene): TargetFrameRow[] => frameOf(scene).rows;

/** 판의 기록 — **없으면 없는 것이다** (빈 배열과 구분한다) */
const logOf = (scene: Scene): readonly FrameLogLine[] | undefined => frameOf(scene).log;

function logLines(scene: Scene): readonly FrameLogLine[] {
  const log = logOf(scene);
  if (!log) throw new Error('판에 기록 자리가 서지 않았다');
  return log;
}

/** 기록 한 줄의 글 — 무슨 일이 있었나와 언제 있었나를 각각 하나의 글로 본다 */
const lineTexts = (line: FrameLogLine): string[] => [String(line.text ?? ''), String(line.when ?? '')];

const logTexts = (scene: Scene): string[] => logLines(scene).flatMap(lineTexts);

const rowTexts = (scene: Scene): string[] =>
  rowsOf(scene).flatMap((row) => [String(row.label ?? ''), String(row.value ?? '')]);

const hudTexts = (scene: Scene): string[] =>
  scene.hud.flatMap((item) => [String(item.label ?? ''), String(item.value ?? '')]);

/** 짧은 태그가 다른 말 속에서 우연히 걸리지 않도록 — 세 글자 이상은 포함, 아니면 토큰 (C026 하네스) */
function said(texts: readonly string[], needle: string): boolean {
  if (needle.length >= 3) return texts.some((text) => text.includes(needle));
  return texts.some((text) => text.split(/[^\p{L}\p{N}:._-]+/u).includes(needle));
}

/** 그 일이 기록에 실렸는가 — 문구 표를 거친 말로 찾는다 (미등록 코드는 코드 그대로 선다) */
const logSays = (scene: Scene, code: string): boolean => said(logTexts(scene), codeText(code));
const rowsSay = (scene: Scene, code: string): boolean => said(rowTexts(scene), codeText(code));
const hudSays = (scene: Scene, code: string): boolean => said(hudTexts(scene), codeText(code));

/** 그 일을 진 줄들 — 몇 줄이 되었는지까지 세려면 줄 단위로 집어야 한다 */
const linesFor = (scene: Scene, code: string): FrameLogLine[] =>
  logLines(scene).filter((line) => said(lineTexts(line), codeText(code)));

/** 글에서 숫자를 전부 뽑는다 — "얼마 전인지" 를 어법 없이 재는 자리 (판정 방식 ②) */
function numbersIn(texts: readonly string[]): number[] {
  const found: number[] = [];
  for (const text of texts) {
    for (const match of text.matchAll(/-?\d+(?:\.\d+)?/g)) found.push(Number(match[0]));
  }
  return found;
}

/** 줄 하나를 그대로 가리키는 열쇠 (C027 하네스) */
const rowKey = (row: TargetFrameRow): string => `${row.id}|${row.label}|${row.value}`;

/** 그 판에만 있는 줄들 — "이 사실 때문에 선 줄" 을 문구 없이 집는 수단 (C027 하네스) */
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

/** 판을 걷어낸 화면 — "판 말고는 아무것도 달라지지 않았다" 를 재는 자리 */
function strip(scene: Scene): Record<string, unknown> {
  const { targetFrame, ...rest } = scene as Scene & Record<string, unknown>;
  void targetFrame;
  return rest;
}

// ── 세계가 한 말들 ────────────────────────────────────────────────────
//
// 거절 사유 셋은 **이미 있는 코드**다 (code-text 의 불가 사유 — 이 Cycle 은 새 의미를 만들지 않는다).
// 알림 둘은 코드를 모르므로 이 테스트가 짓는다 — 미등록 코드는 코드 그대로 선다는 규율로 잰다.

const NO_TOOL = 'no-mining-tool';
const TOO_FAR = 'out-of-range';
const TOO_STEEP = 'too-steep';
const DEEP_WATER = 'deep-water';
const NOT_BUILT = 'region-not-built';

const REJECTIONS = [NO_TOOL, TOO_FAR, TOO_STEEP, DEEP_WATER, NOT_BUILT];

/** 세계의 알림 — 방에 들어섬 · 길이 바뀜 · 이어짐 끊김 (spec SPEC-002 의 셋) */
const ENTERED_ROOM = 'c028-test:entered-white-king';
const PATH_REARRANGED = 'c028-test:path-rearranged';
const LINK_LOST = 'c028-test:link-lost';

const NOTICES = [ENTERED_ROOM, PATH_REARRANGED, LINK_LOST];

// ─────────────────────────────────────────────────────────────────────
describe('하네스 전제', () => {
  it('H-001 이 파일이 쓰는 사유 코드들은 문구 표에 있고 서로 다른 말이다', () => {
    // Given codeText 가 코드를 그대로 돌려주면 "문구로 찾는다" 는 단언이 무의미해진다
    for (const code of REJECTIONS) {
      expect({ code, text: codeText(code) }).not.toEqual({ code, text: code });
    }
    // And 서로 다른 사유가 같은 말로 서면 줄을 가릴 수 없다
    const texts = REJECTIONS.map((code) => codeText(code));
    expect(new Set(texts).size).toBe(texts.length);
    // And 알림으로 쓰는 코드들은 표에 없다 — 코드 그대로 서는 것으로 잰다 (C026 S-020 의 규율)
    for (const code of NOTICES) {
      expect({ code, text: codeText(code) }).toEqual({ code, text: code });
    }
  });
});

describe('SPEC-001 거절 사유가 기록에 남는다', () => {
  it('S-001 거절당한 사유가 판의 기록에 한 줄로 선다', () => {
    // Given 곡괭이 없이 캐려다 거절당했다 — 관찰자가 그 대답을 세계 시각과 함께 모아 두었다
    const log = [happening(NO_TOOL, NOW - 3)];
    // When 판을 세운다
    const scene = look(made(), log);
    // Then 판에 기록 자리가 서고, 그 사유가 한 줄로 있다
    expect(logOf(scene)).toBeDefined();
    expect(logLines(scene).length).toBeGreaterThan(0);
    expect(logSays(scene, NO_TOOL)).toBe(true);
    // And 줄마다 무슨 일이 있었나가 글로 끝나 있다 (기구는 문구를 짓지 않는다)
    for (const line of logLines(scene)) {
      expect(typeof line.text).toBe('string');
      expect(line.text.length).toBeGreaterThan(0);
      if (line.when !== undefined) expect(typeof line.when).toBe('string');
    }
  });

  it('S-002 2.2초가 지나도 그대로 있다 — 뜨는 문구와 달리 사라지지 않는다', () => {
    // Given 세계 시각 3초 전에 있었던 거절
    const log = [happening(TOO_FAR, NOW - 3)];
    // When 그로부터 한참(2.2초를 훨씬 넘겨) 시간이 흐른 뒤 다시 판을 세운다
    const early = look(made({ now: NOW }), log);
    const later = look(made({ now: NOW + 120 }), log);
    // Then 그 줄이 여전히 있고, 무슨 일이 있었나도 같은 말이다
    expect(logSays(early, TOO_FAR)).toBe(true);
    expect(logSays(later, TOO_FAR)).toBe(true);
    expect(linesFor(later, TOO_FAR).map((line) => line.text)).toEqual(
      linesFor(early, TOO_FAR).map((line) => line.text),
    );
  });

  it('S-003 (경계) 받아들여진 요청은 줄을 만들지 않는다 — 판이 스스로 기록을 짓지 않는다', () => {
    // Given 받아들여진 요청들만 오가는 화면 (걷기 · 캐기가 전부 available 이다)
    expect([MOVE, MINE_DEPOSIT].every((one) => one.available)).toBe(true);
    // When 걸어 다니며 여러 번 판을 세운다 (관찰자가 모아 둔 것은 아무것도 없다)
    for (const at of [FLAT, WET, { x: FLAT.x + 1, z: FLAT.z + 1 }]) {
      const scene = look(made({ at, interactions: [MOVE, MINE_DEPOSIT] }));
      // Then 판은 서지만 기록 자리는 아예 없다 — 걸을 때마다 줄이 늘지 않는다
      expect(scene.targetFrame).toBeDefined();
      expect({ at, log: logOf(scene) }).toEqual({ at, log: undefined });
    }
  });

  it.todo(
    'GAP: 세계가 받아들인 대답(Request.Outcome.accepted)이 실제로 기록에 들어가지 않는가 — 대답을 받아 쌓는 자리는 조립(app)이고, Outcome 은 봉투가 아니라 Tick 의 산출물이라 여기서 도달하지 않는다',
  );
});

describe('SPEC-002 세계의 알림도 같은 기록에 남는다', () => {
  it('S-004 알림 셋이 거절 사유와 같은 기록에 같은 형식으로 선다', () => {
    // Given 방에 들어섰고 · 길이 바뀌었고 · 이어짐이 끊겼고 · 한 번 거절당했다
    const log = [
      happening(ENTERED_ROOM, NOW - 40),
      happening(TOO_STEEP, NOW - 30),
      happening(PATH_REARRANGED, NOW - 20),
      happening(LINK_LOST, NOW - 10),
    ];
    const scene = look(made(), log);
    // Then 넷이 **한 기록**에 있다 — 알림이 따로 놓이지 않는다
    for (const code of [...NOTICES, TOO_STEEP]) {
      expect({ code, said: logSays(scene, code) }).toEqual({ code, said: true });
    }
    // And 형식이 같다 — 알림 줄도 거절 줄과 같은 자리(text · when)를 가진다
    const notice = linesFor(scene, PATH_REARRANGED)[0];
    const rejection = linesFor(scene, TOO_STEEP)[0];
    expect(notice).toBeDefined();
    expect(rejection).toBeDefined();
    expect(Object.keys(notice!).sort()).toEqual(Object.keys(rejection!).sort());
  });

  it('S-005 (경계) 같은 알림이 매 프레임 다시 쌓이지 않는다 — 그리는 일이 기록을 늘리지 않는다', () => {
    // Given 알림 하나가 든 기록
    const log = [happening(ENTERED_ROOM, NOW - 5)];
    const snapshot = made();
    // When 같은 봉투로 판을 세 번 세운다 (프레임이 흐른다)
    const drawn = [look(snapshot, log), look(snapshot, log), look(snapshot, log)];
    // Then 줄 수가 늘지 않고, 그 알림을 진 줄은 언제나 하나다
    for (const scene of drawn) {
      expect(logLines(scene).length).toBe(logLines(drawn[0]!).length);
      expect(linesFor(scene, ENTERED_ROOM).length).toBe(1);
    }
  });

  it.todo(
    'GAP: 한 번 일어난 일이 한 줄인가 (방 이름은 들어선 그 프레임에만 · 재배열은 그 재배열마다 한 번) — 같은 사건을 알아보려면 이전 프레임의 기억이 필요하고 그것은 조립(app)이 쥔다',
  );
});

describe('SPEC-003 언제 일어난 일인지가 함께 적힌다', () => {
  it('S-006 줄에 얼마 전 일인지가 적힌다', () => {
    // Given 세계 시각 213 에 있었던 일 · 지금은 250 이다 (37초 전)
    const at = NOW - 37;
    const scene = look(made({ now: NOW }), [happening(TOO_FAR, at)]);
    const line = linesFor(scene, TOO_FAR)[0];
    expect(line).toBeDefined();
    // Then 그 줄에 때가 적혀 있고, 적힌 숫자 안에 **나이**가 있다 (원시 세계 시각이 아니다)
    expect(line!.when).toBeDefined();
    expect(numbersIn(lineTexts(line!))).toContain(37);
  });

  it('S-007 시간이 흐르면 그 값이 늘어난다', () => {
    // Given 같은 한 사건 · 세계 시각만 흐른 두 화면
    const at = NOW - 37;
    const early = linesFor(look(made({ now: NOW }), [happening(TOO_FAR, at)]), TOO_FAR)[0]!;
    const later = linesFor(look(made({ now: NOW + 150 }), [happening(TOO_FAR, at)]), TOO_FAR)[0]!;
    // Then 나중 화면의 나이가 더 크다 — 37 이었던 것이 187 이 된다
    expect(numbersIn(lineTexts(early))).toContain(37);
    expect(numbersIn(lineTexts(later))).toContain(187);
  });

  it('S-008 (경계) 세계 시각을 모르면 나이를 지어내지 않는다', () => {
    // Given 봉투에 세계 시각이 실려 오지 않은 화면
    const snapshot = made({ now: null });
    expect(snapshot.hud.some((item) => item.id === 'world.time')).toBe(false);
    // When 기록을 넘긴다
    const scene = look(snapshot, [happening(TOO_FAR, NOW - 37)]);
    // Then 무슨 일이 있었나는 그대로 서지만, 때는 적히지 않는다
    expect(logSays(scene, TOO_FAR)).toBe(true);
    for (const line of logLines(scene)) {
      expect({ text: line.text, when: line.when }).toEqual({ text: line.text, when: undefined });
    }
  });
});

describe('SPEC-004 새 것이 위다', () => {
  /** 서로 다른 사유로 세 번 — 오래된 것부터 시간 순서로 모았다 */
  const three = () => [
    happening(NO_TOOL, NOW - 30),
    happening(TOO_FAR, NOW - 20),
    happening(TOO_STEEP, NOW - 5),
  ];

  it('S-009 (경계) 여러 번 거절당하면 여러 줄이 쌓인다 — 마지막 하나만 남지 않는다', () => {
    const scene = look(made(), three());
    // Then 셋이 전부 서 있다 — 앞의 것이 뒤의 것에 덮이지 않는다
    for (const code of [NO_TOOL, TOO_FAR, TOO_STEEP]) {
      expect({ code, said: logSays(scene, code) }).toEqual({ code, said: true });
    }
    expect(logLines(scene).length).toBe(3);
  });

  it('S-010 가장 나중 것이 맨 위에 서고 그 아래로 이전 것들이 차례로 선다', () => {
    const scene = look(made(), three());
    const lines = logLines(scene);
    const indexOf = (code: string) => lines.findIndex((line) => said(lineTexts(line), codeText(code)));
    // Then 방금 것이 맨 위, 가장 오래된 것이 맨 아래다
    expect(indexOf(TOO_STEEP)).toBe(0);
    expect(indexOf(TOO_FAR)).toBeGreaterThan(indexOf(TOO_STEEP));
    expect(indexOf(NO_TOOL)).toBeGreaterThan(indexOf(TOO_FAR));
    // And 위에서 아래로 내려갈수록 나이가 는다 (어법을 모르므로 숫자로 잰다)
    const ages = lines.map((line) => Math.max(...numbersIn([String(line.when ?? '')]), Number.NaN));
    for (let i = 1; i < ages.length; i++) {
      if (Number.isNaN(ages[i]!) || Number.isNaN(ages[i - 1]!)) continue;
      expect({ i, older: ages[i]! >= ages[i - 1]! }).toEqual({ i, older: true });
    }
  });

  it('S-011 같은 사유로 두 번 거절당하면 두 줄이다 — 묶어 세지 않는다 (spec 기본형)', () => {
    const scene = look(made(), [happening(TOO_FAR, NOW - 12), happening(TOO_FAR, NOW - 2)]);
    expect(linesFor(scene, TOO_FAR).length).toBe(2);
  });
});

describe('SPEC-005 기록에는 상한이 있다', () => {
  /** 판이 화면을 삼키지 않을 만큼 — 하네스가 정한 판정 기준 ⓒ */
  const SANE_LIMIT = 24;

  it('S-012 상한보다 많은 일이 일어나면 가장 오래된 줄이 밀려난다', () => {
    // Given 예순네 번 무슨 일이 있었다 (하나하나 다른 일이다)
    const many = Array.from({ length: 64 }, (_, i) => happening(`c028-test:event-${i}`, NOW - 64 + i));
    const scene = look(made(), many);
    // Then 줄 수가 상한에 걸린다 — 판이 화면을 삼키지 않는다
    expect(logLines(scene).length).toBeLessThan(many.length);
    expect(logLines(scene).length).toBeLessThanOrEqual(SANE_LIMIT);
    // And 남은 것은 새 것들이다 — 방금 것이 있고 가장 오래된 것은 밀려났다
    expect(logSays(scene, 'c028-test:event-63')).toBe(true);
    expect(logSays(scene, 'c028-test:event-0')).toBe(false);
  });

  it('S-013 (경계) 상한 이하에서는 아무것도 밀려나지 않는다', () => {
    const few = [
      happening(NO_TOOL, NOW - 9),
      happening(TOO_FAR, NOW - 6),
      happening(DEEP_WATER, NOW - 1),
    ];
    const scene = look(made(), few);
    expect(logLines(scene).length).toBe(few.length);
    for (const code of [NO_TOOL, TOO_FAR, DEEP_WATER]) {
      expect({ code, said: logSays(scene, code) }).toEqual({ code, said: true });
    }
  });

  it.todo(
    'GAP: 대답이 도착할 때마다 쌓고 넘치면 미는가 — 쌓는 자리는 조립(app)이고, 여기서는 넘겨준 것이 어떻게 그려지는지까지만 잰다',
  );
});

describe('SPEC-006 기록은 대상의 것이 아니라 내 것이다', () => {
  const log = () => [happening(NO_TOOL, NOW - 20), happening(TOO_FAR, NOW - 4)];

  it('S-014 대상을 바꾸어도 · 지목을 풀어도 기록이 그대로다', () => {
    // Given 기록이 쌓인 뒤 — 아무것도 지목하지 않았다 · 존재를 지목한다 · 자리를 지목한다
    const snapshot = made();
    const idle = look(snapshot, log());
    const onBeing = point(snapshot, FERRA.id, log());
    const onPlace = place(snapshot, WET, log());
    // Then 세 판 모두 같은 기록을 진다 — 판의 대상이 달라져도 기록은 내 것이다
    expect(logLines(onBeing)).toEqual(logLines(idle));
    expect(logLines(onPlace)).toEqual(logLines(idle));
    // And 지목이 바뀌었다는 사실 자체는 판의 제목에서 읽힌다 (기록이 제목을 가리지 않는다)
    expect(frameOf(onBeing).title).not.toBe(frameOf(idle).title);
  });

  it('S-015 방을 옮겨도 기록이 그대로 남는다', () => {
    // Given 백왕령에서 쌓은 기록을 들고 미로로 건너간다
    const before = look(made(), log());
    const after = look(made({ region: MAZE, at: CELL_A_CENTER, state: MAZE_STATE }), log());
    // Then 기록이 그대로다 — 방의 것도 대상의 것도 아니다
    expect(logLines(after)).toEqual(logLines(before));
  });

  it('S-016 (경계) 기록이 비어 있으면 그 자리가 아예 없다 — 빈 기록판을 세우지 않는다', () => {
    // Given 아직 세계가 나에게 아무 말도 하지 않았다 (넘긴 것이 없거나 · 빈 목록이다)
    for (const empty of [undefined, [] as Record<string, unknown>[]]) {
      const scene = look(made(), empty);
      // Then 판은 서지만 기록 자리는 없다 (C026 SPEC-001 경계와 같은 규율)
      expect(scene.targetFrame).toBeDefined();
      expect(rowsOf(scene).length).toBeGreaterThan(0);
      expect({ empty, log: logOf(scene) }).toEqual({ empty, log: undefined });
    }
  });
});

describe('SPEC-007 재배열이 기록과 함께 읽힌다', () => {
  const REARRANGED_AT = NOW - 37;
  const rearranged: RegionStateView = { ...MAZE_STATE, rearrangedAt: REARRANGED_AT };

  const maze = (state: RegionStateView, now = NOW) =>
    made({ region: MAZE, at: CELL_A_CENTER, state, now });

  it('S-017 규칙 줄에 마지막 재배열이 얼마 전인지가 함께 실린다', () => {
    // Given 한 번 재배열된 미로 (봉투의 region.state.rearrangedAt — C008 이 이미 싣는다)
    const withIt = look(maze(rearranged));
    const withoutIt = look(maze(MAZE_STATE));
    // When 그 사실 하나만 다른 두 판을 견준다
    const extra = extraRows(withIt, withoutIt);
    // Then 그것 때문에 선(또는 달라진) 줄이 있고, 거기 **나이**가 적혀 있다
    expect(extra.length).toBeGreaterThan(0);
    expect(numbersIn(extra.flatMap((row) => [String(row.label), String(row.value)]))).toContain(37);
  });

  it('S-018 시간이 흐르면 그 값도 늘어난다', () => {
    const later = look(maze(rearranged, NOW + 150));
    const laterExtra = extraRows(later, look(maze(MAZE_STATE, NOW + 150)));
    expect(laterExtra.length).toBeGreaterThan(0);
    expect(numbersIn(laterExtra.flatMap((row) => [String(row.label), String(row.value)]))).toContain(187);
  });

  it('S-019 (경계) 재배열이 한 번도 없었던 방에는 그 값이 없다 — 0 으로 지어내지 않는다', () => {
    // Given 재배열이 있었던 방이 그 때문에 세운(또는 달라진) 줄들
    const extra = extraRows(look(maze(rearranged)), look(maze(MAZE_STATE)));
    expect(extra.length).toBeGreaterThan(0);
    // When 아직 한 번도 재배열되지 않은 방을 본다 (rearrangedAt 자리가 봉투에 없다)
    const snapshot = maze(MAZE_STATE);
    expect(snapshot.region.state?.rearrangedAt).toBeUndefined();
    const scene = look(snapshot);
    // Then 그 줄이 그 모습으로는 서지 않고, 나이도 적히지 않는다
    for (const row of extra) {
      expect({ row: rowKey(row), stood: rowsOf(scene).some((one) => rowKey(one) === rowKey(row)) }).toEqual({
        row: rowKey(row),
        stood: false,
      });
    }
    expect(numbersIn(rowTexts(scene))).not.toContain(37);
    // And 시간이 흘러도 규칙 줄이 한 글자도 달라지지 않는다 — 재지 않는 것은 자라지도 않는다
    expect(rowsOf(look(maze(MAZE_STATE, NOW + 150)))).toEqual(rowsOf(scene));
  });

  it('S-020 (경계) 규칙을 품지 않은 방에서는 규칙 줄 자체가 없다 (C008 · C026 경계 그대로)', () => {
    const snapshot = made({ at: FLAT });
    expect((snapshot.region as { state?: unknown }).state).toBeUndefined();
    const scene = look(snapshot, [happening(TOO_FAR, NOW - 3)]);
    expect(rowsSay(scene, MAZE_STATE.pattern)).toBe(false);
    expect(said(rowTexts(scene), String(MAZE_STATE.pressureLimit))).toBe(false);
  });

  it.todo(
    'GAP: 압력이 넘쳐 길이 재배열된 그 사실이 기록에 한 줄로 남는가 — 재배열을 알아채려면 이전 rearrangedAt 의 기억이 필요하고 그것은 조립(app)이 쥔다 (여기서는 규칙 줄에 얼마 전인지가 실리는 것까지 잰다)',
  );
});

describe('SPEC-008 잠깐 뜨는 문구는 그대로다', () => {
  it('S-021 기록이 쌓여도 판 말고 화면의 어떤 자리도 달라지지 않는다', () => {
    // Given 기록이 있는 화면과 없는 화면
    const snapshot = made();
    const quiet = look(snapshot);
    const kept = look(snapshot, [happening(NO_TOOL, NOW - 8), happening(TOO_FAR, NOW - 2)]);
    // Then 판을 걷어내면 두 화면이 같다 — 뜨는 문구가 서는 자리도 손대지 않았다
    expect(strip(kept)).toEqual(strip(quiet));
  });

  it('S-022 (경계) 같은 일이 기록에 두 줄로 쌓이지 않는다 — 뜨는 것과 남는 것은 한 사건의 두 표현이다', () => {
    // Given 한 번 거절당했다 (세계의 대답 하나)
    const scene = look(made(), [happening(NO_TOOL, NOW - 2)]);
    // Then 그 사유를 진 줄이 정확히 하나다
    expect(linesFor(scene, NO_TOOL).length).toBe(1);
    expect(logLines(scene).length).toBe(1);
  });

  it.todo(
    'GAP: 문구가 지금까지대로 떴다 2.2초 만에 사라지는가 — 잠깐 뜨는 문구(regionNotice)는 SceneState 에 실리지 않고 조립(app)이 띄웠다 지운다',
  );
});

describe('SPEC-009 기록은 세계에 아무것도 요구하지 않는다', () => {
  it('S-023 기록을 들고 판을 여러 번 세워도 봉투가 한 자리도 달라지지 않는다', () => {
    // Given 규칙을 품은 방의 봉투 (압력이 오를 수 있는 곳이다)
    const snapshot = made({ region: MAZE, at: CELL_A_CENTER, state: MAZE_STATE });
    const before = JSON.stringify(snapshot);
    // When 기록과 함께 여러 번 그린다
    const log = [happening(NO_TOOL, NOW - 30), happening(PATH_REARRANGED, NOW - 10)];
    look(snapshot, log);
    point(snapshot, FERRA.id, log);
    place(snapshot, CELL_A_CENTER, log);
    // Then 봉투도, 그 안의 압력도 그대로다 — 기록은 세계에 아무것도 묻지 않는다
    expect(JSON.stringify(snapshot)).toBe(before);
    expect(snapshot.region.state?.pressure).toBe(MAZE_STATE.pressure);
  });

  it('S-024 (경계) 다른 관찰자의 화면에는 내 기록이 없다', () => {
    // Given 같은 봉투 — 나는 기록을 모았고 그는 모으지 않았다
    const snapshot = made();
    const mine = look(snapshot, [happening(NO_TOOL, NOW - 5)]);
    const theirs = look(snapshot);
    // Then 그의 판에는 기록 자리가 없고, 내 사유가 새어 들지도 않는다
    expect(logOf(mine)).toBeDefined();
    expect(logOf(theirs)).toBeUndefined();
    expect(said([...rowTexts(theirs), ...hudTexts(theirs)], codeText(NO_TOOL))).toBe(false);
  });

  it.todo(
    'GAP: 기록이 쌓이는 동안 세계로 나간 요청이 정말 0 인가 — 소켓(app/server)이 필요하다. 여기서는 봉투 불변만 잰다 (C026 · C027 과 같은 이유)',
  );
});

describe('회귀', () => {
  const log = () => [happening(NO_TOOL, NOW - 20), happening(PATH_REARRANGED, NOW - 3)];

  it('R-001 C026 의 자리 지목이 그대로다 — 표면과 못 지나가는 사유', () => {
    const snapshot = made();
    expect(rowsSay(place(snapshot, FLAT, log()), SURFACE_FLAT)).toBe(true);
    expect(rowsSay(place(snapshot, WET, log()), SURFACE_WET)).toBe(true);
    expect(rowsSay(place(snapshot, STEEP, log()), BLOCK_STEEP)).toBe(true);
  });

  it('R-002 C026 의 경계 그대로 — 세계 위 상시 글자가 여전히 0 이다', () => {
    for (const snapshot of [made(), made({ region: MAZE, at: CELL_A_CENTER, state: MAZE_STATE })]) {
      const scene = look(snapshot, log());
      expect(scene.zones.length).toBeGreaterThan(0);
      for (const zone of scene.zones) {
        expect({ id: zone.id, label: zone.label }).toEqual({ id: zone.id, label: undefined });
      }
    }
  });

  it('R-003 C027 의 존재 지목이 그대로다 — 이름을 가진 존재는 그 이름이 제목이다', () => {
    const scene = point(made(), FERRA.id, log());
    expect(frameOf(scene).title).toContain(FERRA.name!);
    expect(scene.highlight?.entityId).toBe(FERRA.id);
  });

  it('R-004 C027 의 기본 대상이 그대로다 — 지목이 없으면 판은 내가 선 자리를 진다', () => {
    const scene = look(made({ at: WET }), log());
    expect(scene.targetFrame).toBeDefined();
    expect(rowsSay(scene, SURFACE_WET)).toBe(true);
  });

  it('R-005 C027 의 경계 그대로 — 상시 HUD 는 여전히 내 몸의 것만 진다', () => {
    const scene = look(made({ region: MAZE, at: CELL_A_CENTER, state: MAZE_STATE }), log());
    // 내 몸의 것은 그대로 있다
    for (const item of SELF_HUD_BASE) {
      expect({ id: item.id, stood: scene.hud.some((one) => one.id === item.id) }).toEqual({
        id: item.id,
        stood: true,
      });
    }
    // 세계의 사실은 여전히 판의 것이다 — 깊이도 압력도 좌상단에 없다
    expect(scene.hud.some((one) => one.id === 'region.depth')).toBe(false);
    expect(hudSays(scene, 'deep')).toBe(false);
    expect(hudSays(scene, MAZE_STATE.pattern)).toBe(false);
    // 그리고 기록도 좌상단으로 새지 않는다 — 기록은 판의 자리다
    expect(hudSays(scene, NO_TOOL)).toBe(false);
    expect(said(hudTexts(scene), PATH_REARRANGED)).toBe(false);
  });

  it('R-006 판의 줄들이 기록 유무로 달라지지 않는다 — 기록은 줄을 밀어내지 않는다', () => {
    const snapshot = made({ region: MAZE, at: CELL_A_CENTER, state: MAZE_STATE });
    for (const designation of [undefined, { entityId: FERRA.id }, { ground: WET }] as (
      | Designation
      | undefined
    )[]) {
      const quiet = resolveWith(snapshot, designation ? { designation } : {});
      const kept = resolveWith(snapshot, { ...(designation ? { designation } : {}), log: log() });
      expect(rowsOf(kept)).toEqual(rowsOf(quiet));
      expect(frameOf(kept).title).toBe(frameOf(quiet).title);
      expect(frameOf(kept).subtitle).toBe(frameOf(quiet).subtitle);
    }
  });
});
