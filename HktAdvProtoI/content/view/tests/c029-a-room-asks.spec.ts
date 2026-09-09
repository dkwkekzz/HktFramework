// C029 — 방이 묻는다 · GameView 시나리오 테스트
//
// 이 파일이 재는 것은 **판이 무엇을 말하는가**와 **몸이 어떻게 보이는가** 둘뿐이다
// (spec SPEC-003 · SPEC-004 · SPEC-005 · R5). 세계는 기동하지 않는다 — 봉투(관찰 결과)를
// 손으로 짓고 그것으로 SceneState 를 세워 본다 (c027-a-being-stands-too.spec.ts 의 형식 그대로).
//
// 이 파일은 이 Cycle 이 새로 쓴 View 코드를 **읽지 않고** 쓴다. 그래서 줄의 id 도 이름표도
// 문구도 모른다. 아는 것은 spec 이 준 계약뿐이다:
//
//   entities[].material     그 원천이 내는 Material Seed 의 코드 (C011 부터 있던 자리)
//   entities[].conditions   그 존재에 걸린 조건 코드들 (C012 부터 있던 자리)
//   Lock 의 현상 코드        `asks-warmth`  — 문의 표식에 실린다 (spec 데이터 값 표)
//   흔적이 몸에 거는 코드     `breath-glows` — 문 앞 자락의 몸에 실린다 (spec 데이터 값 표)
//   Seed 의 성질 태그        빙정석 = heat:absorbs · light:emits · heat:grows-on (spec 데이터 값 표)
//   propertyPhraseCode()    그 재료의 그 성질을 가리키는 문장의 코드 (content/regions 의 것)
//
// **판정 방식** — spec 이 줄의 id 도 이름표도 정하지 않았으므로 단언은 "그 사실이 판
// 어딘가에 실렸는가" 로 한다 (C026 · C027 의 하네스 그대로): 줄의 label·value 를 이어 붙인
// 글에서 **의미 코드의 문구**(codeText)를 찾는다. 그리고 문구를 모르는 자리는 **차이로**
// 잰다 — 같은 봉투에서 한 가지만 바꾼 두 판의 줄을 견주어 "그 줄이 섰다 / 서지 않았다" 를
// 판정한다. **전체 줄 수는 단언하지 않는다** (다른 Cycle 이 줄을 더해도 깨지면 안 된다).

import { describe, expect, it } from 'vitest';
import type { EntityView, GameViewSnapshot, InteractionView } from '../../protocol/gameview';
import type { SceneState } from '../../../engine/view-kernel/scene/scene-state';
import { resolvePresentation } from '../resolve';
import { codeText } from '../code-text';
import { descriptionHash } from '../../../engine/world-authoring/description';
import {
  BIO_ORE,
  FORM_CORPSE_RIME,
  FORM_FALLEN_SCALE,
  FROST_CRYSTAL,
  ORE_EATER_MOLT,
  WHALE_SCALE,
  propertyPhraseCode,
  regionSpec,
} from '../../regions/index';

// ── 계약이 준 형 (C027 의 것 그대로 — 이 파일은 engine 의 형을 읽지 않고 쓴다) ──────

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

/** spec 이 정한 코드 둘 — 세계가 싣는 이름이다 (spec State 의 데이터 값 표) */
const ASKS_WARMTH = 'asks-warmth';
const BREATH_GLOWS = 'breath-glows';

/** 빙정석의 성질 태그 셋 — spec 데이터 값 표("빙정석의 성질")의 것 그대로다 */
const FROST_CRYSTAL_TAGS = ['heat:absorbs', 'light:emits', 'heat:grows-on'] as const;

const CANYON = 'FROST_CANYON';

function hashOf(regionId: string): string {
  const spec = regionSpec(regionId);
  if (!spec) throw new Error(`content/regions 에 '${regionId}' 가 없다`);
  return descriptionHash(spec.space);
}

// ── 존재 하네스 ───────────────────────────────────────────────────────

/** 내 몸 — 문 앞의 자락 안에 서 있다 */
const ME: EntityView = {
  id: 'player',
  role: 'player-character',
  state: 'idle',
  kind: 'rabbit-swordsman',
  position: { x: 0, z: 17 },
};

/** 같은 자락에 든 다른 몸 — 걸리는 것이 내 몸 하나가 아님을 재는 자리 (SPEC-003 경계 ③) */
const OTHER: EntityView = {
  id: 'npc-walker',
  role: 'npc-character',
  state: 'idle',
  kind: 'wanderer',
  position: { x: 1, z: 17 },
};

/** 자락 밖의 몸 — 한 픽셀도 달라지지 않아야 하는 자리 */
const COLD: EntityView = {
  id: 'npc-far',
  role: 'npc-character',
  state: 'idle',
  kind: 'wanderer',
  position: { x: 0, z: 4 },
};

/** 언 사체 곁의 결정 — 성질을 밝힌 재료(빙정석)의 원천 */
const CRYSTAL_SOURCE: EntityView = {
  id: 'frost-source-1',
  role: 'resource-source',
  state: 'available',
  kind: FORM_CORPSE_RIME,
  material: FROST_CRYSTAL,
  position: { x: -3, z: 12 },
};

/** 떨어진 비늘 — 성질을 밝히지 않은 재료(고래 비늘)의 원천 */
const SCALE_SOURCE: EntityView = {
  id: 'scale-source-1',
  role: 'resource-source',
  state: 'available',
  kind: FORM_FALLEN_SCALE,
  material: WHALE_SCALE,
  position: { x: 5, z: 10 },
};

/** 빙결 심층의 문 — 그 표식이 지는 것은 요구의 이름이 아니라 **현상**의 코드다 */
const DOOR: EntityView = {
  id: 'FROST_DEPTH_DOOR',
  role: 'region-exit',
  state: 'locked',
  kind: 'door',
  position: { x: 0, z: 18 },
  conditions: [ASKS_WARMTH],
};

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
      disturbance: { value: 0, threshold: 300, phase: 'dormant' as const }, memory: { turns: 0, awakenings: { times: 0 }, passages: [] },
    },
    standingConditions: [],
    tracks: [],
    presences: [],
    // 긴 밤 — 이 Play 가 서는 철이다 (판이 무엇을 말하는가는 철과 무관하지만, 봉투는 언제나 때를 싣는다)
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

/** 그 자락에 김이 선 방 — 내 몸과 곁의 몸에 걸리고, 멀리 선 몸에는 걸리지 않는다 */
const GLOWING = made([
  { ...ME, conditions: [BREATH_GLOWS] },
  { ...OTHER, conditions: [BREATH_GLOWS] },
  COLD,
  CRYSTAL_SOURCE,
  SCALE_SOURCE,
  DOOR,
]);

/** 같은 방, 김만 없는 것 — 견줄 자리다 */
const PLAIN = made([ME, OTHER, COLD, CRYSTAL_SOURCE, SCALE_SOURCE, DOOR]);

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
describe('SPEC-005 판이 재료의 이름과 성질을 말한다', () => {
  it('S-001 성질을 밝힌 재료의 원천을 지목하면 이름과 성질 문장들이 함께 선다', () => {
    // Given 언 사체 곁의 결정 (세계가 material 로 빙정석을 실어 온다)
    // When  그것을 지목한다
    const scene = point(GLOWING, CRYSTAL_SOURCE.id);
    // Then  그 재료의 이름이 판에 선다 — 코드가 아니라 말이다
    expect(isSpoken(FROST_CRYSTAL)).toBe(true);
    expect(frameSays(scene, FROST_CRYSTAL)).toBe(true);
    // And   그 재료의 성질 문장들이 이어 선다 (태그마다 그 재료의 문장 하나 · R5)
    for (const tag of FROST_CRYSTAL_TAGS) {
      const phrase = propertyPhraseCode(FROST_CRYSTAL, tag);
      expect({ tag, spoken: isSpoken(phrase) }).toEqual({ tag, spoken: true });
      expect({ tag, said: frameSays(scene, phrase) }).toEqual({ tag, said: true });
    }
  });

  it('S-002 성질을 밝히지 않은 재료는 이름 줄까지만 선다 (SPEC-005 경계 ①)', () => {
    // Given 고래 비늘의 원천 하나와, 같은 것에서 재료만 지운 것
    const withMaterial = point(GLOWING, SCALE_SOURCE.id);
    const withoutMaterial = point(
      made([ME, { ...SCALE_SOURCE, material: undefined }]),
      SCALE_SOURCE.id,
    );
    // Then  재료가 세운 줄은 **하나**다 — 이름 하나이고 성질 줄은 서지 않는다
    expect(extraRows(withMaterial, withoutMaterial).length).toBe(1);
    // And   그 줄의 값은 그 재료의 말이다 (코드가 아니다)
    expect(isSpoken(WHALE_SCALE)).toBe(true);
    expect(frameSays(withMaterial, WHALE_SCALE)).toBe(true);
  });

  it('S-003 성질을 밝힌 재료는 두 줄을 세운다 — 이름과 성질', () => {
    // Given 빙정석의 원천 하나와, 같은 것에서 재료만 지운 것
    const withMaterial = point(GLOWING, CRYSTAL_SOURCE.id);
    const withoutMaterial = point(
      made([ME, { ...CRYSTAL_SOURCE, material: undefined }]),
      CRYSTAL_SOURCE.id,
    );
    // Then  이름 줄과 성질 줄 둘이다 (성질 여럿은 한 줄에 이어진다 — '걸린 것' 의 어법)
    expect(extraRows(withMaterial, withoutMaterial).length).toBe(2);
  });

  it('S-004 재료가 아닌 것(몸 · 출구 표식)에는 그 줄이 아예 없다 (SPEC-005 경계 ②)', () => {
    // Given 몸 하나와 문의 표식 하나 — 세계가 material 을 싣지 않는 것들이다.
    // 김이 걸리지 않은 방에서 본다: 빙정석의 성질 문장("푸르게 빛난다")이 김의 말
    // ("김이 푸르게 빛난다") 안에 든 낱말이라 걸린 몸에서는 이 하네스가 둘을 가르지 못한다
    for (const entity of [ME, DOOR]) {
      const scene = point(PLAIN, entity.id);
      // Then  어느 재료의 이름도 어느 성질의 문장도 그 판에 없다 — 지어내지 않는다
      for (const material of [FROST_CRYSTAL, WHALE_SCALE]) {
        expect({ at: entity.id, said: frameSays(scene, material) }).toEqual({
          at: entity.id,
          said: false,
        });
      }
      for (const tag of FROST_CRYSTAL_TAGS) {
        const phrase = propertyPhraseCode(FROST_CRYSTAL, tag);
        expect({ at: entity.id, tag, said: frameSays(scene, phrase) }).toEqual({
          at: entity.id,
          tag,
          said: false,
        });
      }
    }
  });

  it('S-005 성질의 **태그**는 화면 어디에도 서지 않는다 — 서는 것은 문장이다', () => {
    // Given 성질 셋을 가진 재료의 원천 / When 지목한다
    const texts = frameTexts(point(GLOWING, CRYSTAL_SOURCE.id)).join('\n');
    // Then  요구의 이름도 축:관계의 태그도 판에 없다 (spec Observable "투영하지 않는다")
    for (const tag of FROST_CRYSTAL_TAGS) expect(texts).not.toContain(tag);
    expect(texts).not.toContain('heat:hides');
  });

  it('S-006 같은 태그라도 재료마다 말이 다르다 (R5 경계 ② — 태그는 문장의 색인이다)', () => {
    // Given 같은 태그(light:emits)를 가진 재료 셋
    const phrases = [BIO_ORE, ORE_EATER_MOLT, FROST_CRYSTAL].map((material) =>
      codeText(propertyPhraseCode(material, 'light:emits')),
    );
    // Then  셋 다 말이 되어 있고, 셋이 서로 다른 말이다
    for (const phrase of phrases) expect(phrase.length).toBeGreaterThan(0);
    expect(new Set(phrases).size).toBe(phrases.length);
  });
});

describe('SPEC-004 지목하면 현상을 말한다', () => {
  it('S-007 문을 지목하면 판이 "체열이 감지된다" 라고 말한다 — 코드가 아니라 말이다', () => {
    // Given 현상의 코드를 실은 문의 표식 / When 지목한다
    const scene = point(GLOWING, DOOR.id);
    // Then  그 코드가 말이 되어 판에 선다
    expect(isSpoken(ASKS_WARMTH)).toBe(true);
    expect(frameSays(scene, ASKS_WARMTH)).toBe(true);
    // And   코드 자체는 화면에 없다 (문구 누락이 아니다)
    expect(frameTexts(scene).join('\n')).not.toContain(ASKS_WARMTH);
  });

  it('S-008 요구의 이름도 · 답이 될 재료도 · 답의 자리도 판에 없다 (SPEC-004 경계 ①)', () => {
    // Given 그 문을 지목한 판
    const texts = frameTexts(point(GLOWING, DOOR.id)).join('\n');
    // Then  요구의 이름(축:관계)이 없다
    expect(texts).not.toContain('heat:hides');
    expect(texts).not.toContain('heat:stores');
    // And   C020 이 세계가 답을 알려 주던 그 말은 사라졌다 (R3 — 요구의 이름에서 현상으로)
    expect(texts).not.toContain('저장된 열');
    // And   무엇이 그것을 채우는지도 없다
    expect(said([texts], codeText(FROST_CRYSTAL))).toBe(false);
  });
});

describe('SPEC-003 문 앞의 현상 — 몸이 그것을 보인다', () => {
  it('S-009 김이 걸린 몸은 화면에서 달라지고, 판이 그 말을 한다', () => {
    // Given 자락에 든 내 몸 (세계가 breath-glows 를 실어 온다)
    const glowing = resolveWith(GLOWING);
    const plain = resolveWith(PLAIN);
    // Then  그 몸의 표현이 걸리지 않았을 때와 다르다 — 눈에 보인다
    expect(entityOf(glowing, ME.id)).not.toEqual(entityOf(plain, ME.id));
    // And   지목하면 판도 그 말을 한다 — 코드가 아니라 말이다
    expect(isSpoken(BREATH_GLOWS)).toBe(true);
    expect(frameSays(point(GLOWING, ME.id), BREATH_GLOWS)).toBe(true);
  });

  it('S-010 그 자락에 든 **모든 몸**에 실린다 (SPEC-003 경계 ③)', () => {
    // Given 같은 자락에 든 다른 몸 하나
    const glowing = resolveWith(GLOWING);
    const plain = resolveWith(PLAIN);
    // Then  내 몸이 아니어도 달라진다 — 관찰자의 것이 아니라 세계의 사실이다
    expect(entityOf(glowing, OTHER.id)).not.toEqual(entityOf(plain, OTHER.id));
    // And   지목한 판도 그 말을 한다
    expect(frameSays(point(GLOWING, OTHER.id), BREATH_GLOWS)).toBe(true);
  });

  it('S-011 걸리지 않은 몸은 한 픽셀도 달라지지 않는다 (SPEC-003 경계 ①)', () => {
    // Given 자락 밖의 몸과 재료의 원천들 — 김이 실리지 않은 것들이다
    const glowing = resolveWith(GLOWING);
    const plain = resolveWith(PLAIN);
    // Then  김이 선 방에서도 그것들의 표현은 김이 없는 방의 것과 똑같다
    for (const id of [COLD.id, CRYSTAL_SOURCE.id, SCALE_SOURCE.id, DOOR.id]) {
      expect({ id, entity: entityOf(glowing, id) }).toEqual({ id, entity: entityOf(plain, id) });
    }
    // And   그 몸의 판에도 그 말이 서지 않는다
    expect(frameSays(point(GLOWING, COLD.id), BREATH_GLOWS)).toBe(false);
  });

  it('S-012 자락을 벗어나면 사라진다 — 저장되지 않는 유도된 사실이다', () => {
    // Given 김이 걸린 몸의 화면과, 같은 몸에서 조건만 사라진 화면 (세계가 다음 tick 에 싣지 않는다)
    const glowing = resolveWith(GLOWING);
    const left = resolveWith(PLAIN);
    // Then  그 몸의 표현이 걸리기 전으로 돌아간다 — 자국이 남지 않는다
    expect(entityOf(left, ME.id)).toEqual(entityOf(resolveWith(PLAIN), ME.id));
    expect(entityOf(left, ME.id)).not.toEqual(entityOf(glowing, ME.id));
  });
});
