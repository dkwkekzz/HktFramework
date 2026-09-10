// C031 — 답은 하나가 아니다 · GameView 시나리오 테스트
//
// 이 파일이 재는 것은 **판이 무엇을 말하는가** 하나뿐이다 (spec SPEC-002 · Observable).
// 세계는 기동하지 않는다 — 봉투(관찰 결과)를 손으로 짓고 그것으로 SceneState 를 세워 본다
// (c029-a-room-asks.spec.ts · c030-the-answer-in-the-world.spec.ts 의 형식 그대로).
//
// 몸이 눈보라 자락 안에 섰는지 · 무엇이 그 요구를 무르게 했는지는 **세계의 일**이다. 이 파일이
// 아는 것은 그 결과로 표식에 실려 오는 코드 하나이고, 여기서 재는 것은 그 코드가 판에서
// 어떤 말이 되는가다. 아는 것은 spec 이 준 계약뿐이다:
//
//   entities[].conditions   그 존재에 걸린 조건 코드들 (C012 부터 있던 자리)
//   Lock 의 현상 코드         `asks-warmth`      — 자락 밖에서 그 문의 표식에 실린다 (C029)
//   완화된 사유 코드          `asks-warmth-weak` — 자락 안에서 그것을 **대신** 실린다 (spec 데이터 값 표)
//   흔적이 몸에 거는 코드      `breath-glows`     — 문 앞 자락의 몸에 실린다 (C029)
//
// **판정 방식** — spec 이 줄의 id 도 이름표도 정하지 않았으므로 단언은 "그 사실이 판 어딘가에
// 실렸는가" 로 한다 (C026 ~ C030 의 하네스 그대로). 문구를 모르는 자리는 **차이로** 잰다 —
// 같은 봉투에서 한 가지만 바꾼 두 판의 줄을 견주어 판정한다.
// **전체 줄 수는 단언하지 않는다** (다른 Cycle 이 줄을 더해도 깨지면 안 된다).
//
// 문구만은 **값 그대로** 적어 둔다 (c030 이 흔적의 색을 값으로 적어 둔 그 자리와 같다) — 이
// 셋은 표현이 지은 말이 아니라 기획이 적은 문장이고(spec 데이터 값 표 · Play §5.5 · §6 V25),
// 그래서 여기서 지켜야 하는 것이 곧 그 글자다.

import { describe, expect, it } from 'vitest';
import type { EntityView, GameViewSnapshot, InteractionView } from '../../protocol/gameview';
import type { SceneState } from '../../../engine/view-kernel/scene/scene-state';
import { resolvePresentation } from '../resolve';
import { codeText } from '../code-text';
import { descriptionHash } from '../../../engine/world-authoring/description';
import { regionSpec } from '../../regions/index';

// ── 계약이 준 형 (C027 ~ C030 의 것 그대로 — 이 파일은 engine 의 형을 읽지 않고 쓴다) ──

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

type Scene = SceneState & { targetFrame?: TargetFrame };

/** spec 이 정한 코드 셋 — 세계가 싣는 이름이다 (spec State 의 데이터 값 표) */
const ASKS_WARMTH = 'asks-warmth';
const ASKS_WARMTH_WEAK = 'asks-warmth-weak';
const BREATH_GLOWS = 'breath-glows';

/** 기획이 적은 문장 셋 — 표현이 지킬 글자다 (Play §5.5 관찰의 판 문장 · §6 V25) */
const FIRST_TEXT = '체열이 감지된다';
const WEAK_TEXT = '체열이 감지된다 — 눈보라 속에서 약하다';
const GLOW_TEXT = '김이 푸르게 빛난다';

/**
 * 판에 서면 안 되는 이름들 — 무르게 한 **자락의 이름**(방 Description 의 op id)과 요구의
 * 이름이다 (spec Observable "투영하지 않는다"). 세계가 싣는 것은 사유 코드 하나이고,
 * 무엇이 그것을 무르게 했는지는 자락을 걸어 들고 나 본 관찰자가 잇는다.
 */
const HIDDEN_NAMES = ['hazard-blizzard', 'heat:hides', 'heat:stores'] as const;

const CANYON = 'FROST_CANYON';

function hashOf(regionId: string): string {
  const spec = regionSpec(regionId);
  if (!spec) throw new Error(`content/regions 에 '${regionId}' 가 없다`);
  return descriptionHash(spec.space);
}

// ── 존재 하네스 ───────────────────────────────────────────────────────

/** 내 몸 — 문 앞의 자락 안에 서 있다 (C029 의 그 자리 그대로) */
const ME: EntityView = {
  id: 'player',
  role: 'player-character',
  state: 'idle',
  kind: 'rabbit-swordsman',
  position: { x: 0, z: 17 },
  conditions: [BREATH_GLOWS],
};

/** 빙결 심층의 문 — 그 표식이 지는 사유 코드가 **선 자리에 따라 갈린다** */
function doorWith(conditions?: readonly string[]): EntityView {
  return {
    id: 'FROST_DEPTH_DOOR',
    role: 'region-exit',
    state: 'locked',
    kind: 'door',
    position: { x: 0, z: 18 },
    ...(conditions ? { conditions: [...conditions] } : {}),
  };
}

const MOVE: InteractionView = { id: 'move', role: 'move-to', available: true };

const SELF_HUD = [
  { id: 'inventory.stone', kind: 'counter' as const, value: 0 },
  { id: 'player.action', kind: 'label' as const, value: 'idle' },
  { id: 'world.time', kind: 'counter' as const, value: 400 },
];

/** 관찰 결과 하나 — 봉투의 자리는 지금까지의 것뿐이다 (한 자리도 늘지 않는다) */
function made(entities: EntityView[]): GameViewSnapshot {
  return {
    specId: 'VIEW-STONE-MINING-001',
    scene: CANYON,
    region: {
      id: CANYON,
      hash: hashOf(CANYON),
      disturbance: { value: 0, threshold: 300, phase: 'dormant' as const }, memory: { turns: 0, awakenings: { times: 0 }, passages: [], births: [] },
    },
    standingConditions: [],
    tracks: [],
    presences: [],
    clock: { dayPhase: 'NIGHT', season: 'LONG_NIGHT', dayIndex: 3, seasonCycle: 0 },
    observer: { id: 'observer-a', characterId: ME.id, acknowledgedMark: 0 },
    entities,
    interactions: [MOVE],
    hud: [{ id: 'region.depth', kind: 'label', value: 'wild' }, ...SELF_HUD],
    strikes: [],
    debug: { open: false },
    commands: [],
  } as GameViewSnapshot;
}

/** 자락 밖에서 읽은 문 — 처음 사유가 실린다 (SPEC-002 경계 ①) */
const FIRST = made([ME, doorWith([ASKS_WARMTH])]);

/** 자락 안에서 읽은 같은 문 — 완화된 사유가 **대신** 실린다 */
const RELAXED = made([ME, doorWith([ASKS_WARMTH_WEAK])]);

/** 아무 사유도 실리지 않은 문 — 사유가 세운 줄을 가려내는 견줄 자리다 */
const BARE = made([ME, doorWith()]);

// ── 화면 만들기 ───────────────────────────────────────────────────────

function resolveWith(snapshot: GameViewSnapshot, entityId?: string): Scene {
  return resolvePresentation(snapshot, undefined, {
    ...(entityId ? { designation: { entityId } } : {}),
  } as Parameters<typeof resolvePresentation>[2]) as Scene;
}

const point = (snapshot: GameViewSnapshot, entityId: string): Scene =>
  resolveWith(snapshot, entityId);

function frameOf(scene: Scene): TargetFrame {
  const frame = scene.targetFrame;
  if (!frame) throw new Error('판(targetFrame)이 서지 않았다');
  return frame;
}

const rowsOf = (scene: Scene): TargetFrameRow[] => frameOf(scene).rows;

/** 판 전체의 글 — 제목·부제·줄의 이름표와 값 */
function frameTexts(scene: Scene): string[] {
  const frame = frameOf(scene);
  return [
    frame.title ?? '',
    frame.subtitle ?? '',
    ...rowsOf(scene).flatMap((row) => [String(row.label ?? ''), String(row.value ?? '')]),
  ];
}

/** 짧은 태그가 다른 말 속에서 우연히 걸리지 않도록 — 세 글자 이상은 포함, 아니면 토큰 */
function said(texts: readonly string[], needle: string): boolean {
  if (needle.length >= 3) return texts.some((text) => text.includes(needle));
  return texts.some((text) => text.split(/[^\p{L}\p{N}:._-]+/u).includes(needle));
}

const frameSays = (scene: Scene, code: string): boolean => said(frameTexts(scene), codeText(code));

/** 그 코드가 **말이 되었는가** — 표에 없으면 코드 그대로 뜬다 (그 자리를 잡는 눈금) */
const isSpoken = (code: string): boolean => codeText(code) !== code;

/** 그 말이 판에 **몇 번** 섰는가 — 두 마디가 곁에 함께 서지 않았음을 재는 눈금이다 */
function countSaid(scene: Scene, needle: string): number {
  return frameTexts(scene).join('\n').split(needle).length - 1;
}

const rowKey = (row: TargetFrameRow): string => `${row.id}|${row.label}|${row.value}`;

/** 그 판에만 있는 줄들 — 한 가지만 바꾼 판과 견주므로 남는 것이 곧 그 사실이 세운 줄이다 */
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

/** 장면에 선 그 몸 하나 */
function entityOf(scene: Scene, id: string): SceneState['entities'][number] {
  const entity = scene.entities.find((e) => e.id === id);
  if (!entity) throw new Error(`장면에 '${id}' 가 서지 않았다`);
  return entity;
}

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-002 완화된 사유가 판에서 말이 된다', () => {
  it('S-001 완화된 코드를 진 문을 지목하면 판이 "체열이 감지된다 — 눈보라 속에서 약하다" 라고 말한다', () => {
    // Given 완화된 사유 코드를 실은 문의 표식 / When 지목한다
    const scene = point(RELAXED, 'FROST_DEPTH_DOOR');
    // Then  그 코드가 말이 되어 판에 선다 — 기획이 적은 그 문장 그대로다
    expect(isSpoken(ASKS_WARMTH_WEAK)).toBe(true);
    expect(codeText(ASKS_WARMTH_WEAK)).toBe(WEAK_TEXT);
    expect(said(frameTexts(scene), WEAK_TEXT)).toBe(true);
    // And   코드 자체는 화면에 없다 (문구 누락이 아니다)
    expect(frameTexts(scene).join('\n')).not.toContain(ASKS_WARMTH_WEAK);
  });

  it('S-002 처음 코드를 진 문은 처음 말 그대로다 — 완화의 말이 서지 않는다 (SPEC-002 경계 ①)', () => {
    // Given 처음 사유 코드를 실은 같은 문 / When 지목한다
    const scene = point(FIRST, 'FROST_DEPTH_DOOR');
    // Then  C029 의 그 말이 한 글자도 달라지지 않고 선다
    expect(codeText(ASKS_WARMTH)).toBe(FIRST_TEXT);
    expect(frameSays(scene, ASKS_WARMTH)).toBe(true);
    // And   완화의 말은 어디에도 없다 — 갈리는 것은 실려 온 코드 하나뿐이다
    expect(frameTexts(scene).join('\n')).not.toContain('약하다');
  });

  it('S-003 둘이 **함께 서지 않는다** — 완화가 세운 줄은 하나다 (spec 기본형 ③)', () => {
    // Given 완화된 문의 판 · 처음 문의 판 · 사유가 없는 문의 판
    const relaxed = point(RELAXED, 'FROST_DEPTH_DOOR');
    const first = point(FIRST, 'FROST_DEPTH_DOOR');
    const bare = point(BARE, 'FROST_DEPTH_DOOR');
    // Then  사유가 세운 줄은 어느 쪽도 **하나**다 — 완화가 줄을 더하지 않는다
    expect(extraRows(relaxed, bare).length).toBe(1);
    expect(extraRows(first, bare).length).toBe(1);
    // And   그 한 줄이 두 마디를 다 진다 — 처음 말이 판에 두 번 서지 않는다
    expect(countSaid(relaxed, FIRST_TEXT)).toBe(1);
    // And   그 줄의 값이 곧 그 문장이다 (곁에 덧붙은 말이 아니다)
    expect(String(extraRows(relaxed, bare)[0]?.value)).toBe(WEAK_TEXT);
  });

  it('S-004 무엇이 그것을 무르게 했는지도 · 얼마나 무뎌졌는지도 판에 없다 (spec Observable)', () => {
    // Given 완화된 문을 지목한 판
    const scene = point(RELAXED, 'FROST_DEPTH_DOOR');
    const texts = frameTexts(scene).join('\n');
    // Then  그 자락의 이름도 요구의 이름도 없다 — 세계가 싣지 않는 것들이다
    for (const name of HIDDEN_NAMES) {
      expect({ name, said: texts.includes(name) }).toEqual({ name, said: false });
    }
    // And   정도도 수치도 없다 — 그 줄에 숫자도 진행도 실리지 않는다 ("약하다" 한 마디뿐이다)
    const row = extraRows(scene, point(BARE, 'FROST_DEPTH_DOOR'))[0];
    expect(String(row?.value ?? '')).not.toMatch(/\d/);
    expect(row?.progress).toBeUndefined();
  });
});

describe('SPEC-002 경계 — 앞 Cycle 의 답은 그대로다', () => {
  it('S-005 몸의 김은 한 글자도 달라지지 않았다 (C029 의 답 · spec 기본형 ②)', () => {
    // Then  C029 가 세운 그 말 그대로다 — 이 Cycle 은 김을 옅게 하지 않는다
    expect(isSpoken(BREATH_GLOWS)).toBe(true);
    expect(codeText(BREATH_GLOWS)).toBe(GLOW_TEXT);
    // And   완화된 자리에서 몸을 지목해도 그 말이 그대로 선다
    expect(frameSays(point(RELAXED, ME.id), BREATH_GLOWS)).toBe(true);
  });

  it('S-006 문의 사유가 갈려도 몸의 표현은 한 픽셀도 달라지지 않는다', () => {
    // Given 완화된 문이 선 방과 처음 문이 선 방 — 갈리는 것은 문의 코드 하나뿐이다
    const relaxed = resolveWith(RELAXED);
    const first = resolveWith(FIRST);
    // Then  김이 걸린 몸의 표현이 둘에서 똑같다
    expect(entityOf(relaxed, ME.id)).toEqual(entityOf(first, ME.id));
  });
});
