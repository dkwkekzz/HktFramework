// C030 — 답이 세계에 있다 · GameView 시나리오 테스트
//
// 이 파일이 재는 것은 **판이 무엇을 말하는가**와 **흔적이 어떤 색으로 갈리는가** 둘뿐이다
// (spec SPEC-002 · SPEC-003 · SPEC-005). 세계는 기동하지 않는다 — 봉투(관찰 결과)를 손으로
// 짓고 그것으로 SceneState 를 세워 본다 (c029-a-room-asks.spec.ts 의 형식 그대로).
//
// 이 파일은 이 Cycle 이 새로 쓴 View 코드를 **읽지 않고** 쓴다. 그래서 줄의 id 도 이름표도
// 문구도 색의 이름도 모른다. 아는 것은 spec 이 준 계약뿐이다:
//
//   entities[].material     그 원천이 내는 Material Seed 의 코드 (C011 부터 있던 자리)
//   entities[].conditions   그 존재에 걸린 조건 코드들 (C012 부터 있던 자리)
//   entities[].state        available | depleted | recovering (C013 부터 있던 자리)
//   Seed 의 성질 태그        열 결정 = heat:stores (spec 데이터 값 표)
//   흔적 어휘 셋            흙 1..5 · 숨 1..3 · 온기 1..3 (spec 데이터 값 표 · content/regions)
//   propertyPhraseCode()    그 재료의 그 성질을 가리키는 문장의 코드 (content/regions 의 것)
//
// **판정 방식** — spec 이 줄의 id 도 이름표도 정하지 않았으므로 단언은 "그 사실이 판
// 어딘가에 실렸는가" 로 한다 (C026 ~ C029 의 하네스 그대로). 문구를 모르는 자리는 **차이로**
// 잰다 — 같은 봉투에서 한 가지만 바꾼 두 판의 줄을 견주어 판정한다.
// **전체 줄 수는 단언하지 않는다** (다른 Cycle 이 줄을 더해도 깨지면 안 된다).
//
// 색도 이름으로 묻지 않는다 — 앞의 두 어휘는 **값 그대로**를 적어 두고(C011 · C020 이 세운
// 그 값이다) 셋째는 "그 둘 어느 것과도 다르고 따뜻한 쪽이다" 로만 잰다. 그래야 이 파일이
// 표현의 이름이 아니라 **눈에 보이는 것**을 지킨다.

import { describe, expect, it } from 'vitest';
import type { EntityView, GameViewSnapshot, InteractionView } from '../../protocol/gameview';
import type { SceneState } from '../../../engine/view-kernel/scene/scene-state';
import { resolvePresentation } from '../resolve';
import { codeText } from '../code-text';
import { traceZonePresentation } from '../region-presentation';
import { REGISTERED_SPRITE_IDS } from '../sprites';
import { descriptionHash } from '../../../engine/world-authoring/description';
import {
  EMBER_COOLED,
  FORM_WALL_EMBER,
  HEAT_CRYSTAL,
  emberWarmthTag,
  frostBreathTag,
  propertyPhraseCode,
  regionSpec,
  soilStainTag,
} from '../../regions/index';

// ── 계약이 준 형 (C027 ~ C029 의 것 그대로 — 이 파일은 engine 의 형을 읽지 않고 쓴다) ──

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

/** 열 결정의 성질 태그 — spec 데이터 값 표("재료의 성질")의 것 그대로다 */
const HEAT_CRYSTAL_TAGS = ['heat:stores'] as const;

/** 이 재료의 **쓰임** — 판 어디에도 서지 않아야 하는 말들이다 (spec Out of Scope · 기본형 ⑦) */
const USE_WORDS = ['체온', '빙결', '유지'] as const;

const TREE_INNER = 'TREE_INNER_WORLD';

function hashOf(regionId: string): string {
  const spec = regionSpec(regionId);
  if (!spec) throw new Error(`content/regions 에 '${regionId}' 가 없다`);
  return descriptionHash(spec.space);
}

// ── 존재 하네스 ───────────────────────────────────────────────────────

/** 내 몸 — 거목 속, 원천 곁에 서 있다 */
const ME: EntityView = {
  id: 'player',
  role: 'player-character',
  state: 'idle',
  kind: 'rabbit-swordsman',
  position: { x: -30, z: 20 },
};

/** 벽의 한 자리에 선 잉걸 — 아직 있다 */
const EMBER_SOURCE: EntityView = {
  id: 'core-ember-1',
  role: 'resource-source',
  state: 'available',
  kind: FORM_WALL_EMBER,
  material: HEAT_CRYSTAL,
  position: { x: -34, z: 20 },
};

/** 같은 원천, 다 캐 간 뒤 — 세계가 고갈의 코드를 함께 싣는다 */
const COOLED_SOURCE: EntityView = {
  ...EMBER_SOURCE,
  state: 'depleted',
  conditions: [EMBER_COOLED],
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
    scene: TREE_INNER,
    region: {
      id: TREE_INNER,
      hash: hashOf(TREE_INNER),
      disturbance: { value: 0, threshold: 300, phase: 'dormant' as const }, memory: { turns: 0, awakenings: { times: 0 }, passages: [], births: [] },
    },
    standingConditions: [],
    tracks: [],
    presences: [],
    clock: { dayPhase: 'NIGHT', season: 'LONG_NIGHT', dayIndex: 3, seasonCycle: 0 },
    observer: { id: 'observer-a', characterId: ME.id, acknowledgedMark: 0 },
    entities,
    interactions: [MOVE],
    hud: [{ id: 'region.depth', kind: 'label', value: 'deep' }, ...SELF_HUD],
    strikes: [],
    debug: { open: false },
    commands: [],
  } as GameViewSnapshot;
}

/** 잉걸이 있는 방 */
const WARM = made([ME, EMBER_SOURCE]);

/** 같은 방, 그 자리가 식은 것 — 견줄 자리다 */
const COOLED = made([ME, COOLED_SOURCE]);

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

/** 색 하나의 색상(hue · 도) — "따뜻한 쪽인가" 를 이름이 아니라 값으로 묻는 자리 */
function hueOf(color: number): number {
  const r = ((color >> 16) & 0xff) / 255;
  const g = ((color >> 8) & 0xff) / 255;
  const b = (color & 0xff) / 255;
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  if (delta === 0) return 0;
  const hue =
    max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return (hue * 60 + 360) % 360;
}

/** 그 흔적 태그가 낮에 받는 결정 — 표 밖이면 그리지 않는다(undefined) */
function zoneOf(tag: string, level: number, night = false) {
  const zone = traceZonePresentation(level, tag, night);
  if (!zone) throw new Error(`'${tag}' 의 흔적이 그려지지 않았다`);
  return zone;
}

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-005 지목하면 판이 재료의 이름과 성질을 말한다', () => {
  it('S-001 그 원천을 지목하면 「열을 저장하는 결정」과 「열을 담는다」가 함께 선다', () => {
    // Given 벽의 한 자리에 선 잉걸 (세계가 material 로 열 결정을 실어 온다)
    // When  그것을 지목한다
    const scene = point(WARM, EMBER_SOURCE.id);
    // Then  그 재료의 이름이 판에 선다 — 코드가 아니라 말이다
    expect(isSpoken(HEAT_CRYSTAL)).toBe(true);
    expect(frameSays(scene, HEAT_CRYSTAL)).toBe(true);
    // And   그 재료의 성질 문장이 이어 선다 (태그마다 그 재료의 문장 하나)
    for (const tag of HEAT_CRYSTAL_TAGS) {
      const phrase = propertyPhraseCode(HEAT_CRYSTAL, tag);
      expect({ tag, spoken: isSpoken(phrase) }).toEqual({ tag, spoken: true });
      expect({ tag, said: frameSays(scene, phrase) }).toEqual({ tag, said: true });
    }
  });

  it('S-002 성질을 밝힌 재료이므로 두 줄을 세운다 — 이름과 성질', () => {
    // Given 그 원천 하나와, 같은 것에서 재료만 지운 것
    const withMaterial = point(WARM, EMBER_SOURCE.id);
    const withoutMaterial = point(
      made([ME, { ...EMBER_SOURCE, material: undefined }]),
      EMBER_SOURCE.id,
    );
    // Then  이름 줄과 성질 줄 둘이다 (C029 의 빙정석이 세운 그 형 그대로)
    expect(extraRows(withMaterial, withoutMaterial).length).toBe(2);
  });

  it('S-003 성질의 **태그**도 · 그 요구가 어디 있는지도 판에 없다 (SPEC-005 경계 ① ②)', () => {
    // Given 그 원천을 지목한 판
    const texts = frameTexts(point(WARM, EMBER_SOURCE.id)).join('\n');
    // Then  축:관계의 태그가 없다 — 서는 것은 문장이다
    for (const tag of HEAT_CRYSTAL_TAGS) expect(texts).not.toContain(tag);
    // And   그 성질이 답하는 요구의 이름도 · 그 요구가 선 방의 이름도 없다
    expect(texts).not.toContain('heat:hides');
    expect(texts).not.toContain('FROST_DEPTH');
  });

  it('S-004 이 재료의 **쓰임**은 판 어디에도 없다 (spec Out of Scope · 기본형 ⑦)', () => {
    // Given 그 원천을 지목한 판 (있을 때와 식었을 때 둘 다)
    for (const snapshot of [WARM, COOLED]) {
      const texts = frameTexts(point(snapshot, EMBER_SOURCE.id)).join('\n');
      // Then  "빙결 Region 에서 체온을 유지한다" 의 어느 낱말도 서지 않는다
      for (const word of USE_WORDS) {
        expect({ word, said: texts.includes(word) }).toEqual({ word, said: false });
      }
    }
  });
});

describe('SPEC-003 캐면 그 자리가 식는다', () => {
  it('S-005 고갈된 그 원천을 지목하면 「자리가 식었다」가 선다', () => {
    // Given 다 캐 간 그 자리 (세계가 고갈의 코드를 실어 온다)
    // When  그것을 지목한다
    const scene = point(COOLED, COOLED_SOURCE.id);
    // Then  그 코드가 말이 되어 판에 선다 — 코드 자체는 화면에 없다
    expect(isSpoken(EMBER_COOLED)).toBe(true);
    expect(frameSays(scene, EMBER_COOLED)).toBe(true);
    expect(frameTexts(scene).join('\n')).not.toContain(EMBER_COOLED);
  });

  it('S-006 있는 동안에는 그 말이 없다 (SPEC-003 경계 ①)', () => {
    // Given 아직 있는 그 원천의 판
    const scene = point(WARM, EMBER_SOURCE.id);
    // Then  그 말이 서지 않는다 — 캐기 전에는 실리지 않는 코드다
    expect(frameSays(scene, EMBER_COOLED)).toBe(false);
    // And   그 코드가 세운 줄은 고갈된 판에만 있다 (한 줄 · 걸린 것)
    const extra = extraRows(point(COOLED, COOLED_SOURCE.id), scene);
    expect(extra.some((row) => String(row.value).includes(codeText(EMBER_COOLED)))).toBe(true);
  });

  it('S-007 그림이 있음 / 바닥남으로 갈린다 (V24)', () => {
    // Given 같은 자리의 같은 원천, state 만 다른 둘
    const warm = entityOf(resolveWith(WARM), EMBER_SOURCE.id);
    const cooled = entityOf(resolveWith(COOLED), COOLED_SOURCE.id);
    // Then  그림이 다르다 — 자국은 세계의 state 에서 온다
    expect(warm.spriteId).not.toBe(cooled.spriteId);
    // And   둘 다 그림표에 있다 (없는 그림을 가리키지 않는다)
    for (const spriteId of [warm.spriteId, cooled.spriteId]) {
      expect({ spriteId, registered: REGISTERED_SPRITE_IDS.includes(spriteId) }).toEqual({
        spriteId,
        registered: true,
      });
    }
  });
});

describe('SPEC-002 흔적의 어휘가 셋이 된다 — 갈리는 것은 색뿐이다', () => {
  it('S-008 온기의 태그 셋이 코드가 아니라 말과 색으로 갈린다', () => {
    // Given 온기의 사다리 셋
    const levels = [1, 2, 3] as const;
    // Then  셋 다 말이 되어 있다 — 판에 코드가 그대로 뜨지 않는다
    const phrases = levels.map((level) => codeText(emberWarmthTag(level)));
    for (const level of levels) {
      expect({ level, spoken: isSpoken(emberWarmthTag(level)) }).toEqual({ level, spoken: true });
    }
    expect(new Set(phrases).size).toBe(levels.length);
    // And   셋이 **한 색**을 나눠 쓰고 짙기만 단조 증가한다 (앞의 두 어휘와 같은 문법이다)
    const zones = levels.map((level) => zoneOf(emberWarmthTag(level), level));
    expect(new Set(zones.map((zone) => zone.color)).size).toBe(1);
    for (let i = 1; i < zones.length; i += 1) {
      expect({ i, rising: zones[i]!.opacity > zones[i - 1]!.opacity }).toEqual({
        i,
        rising: true,
      });
    }
  });

  it('S-009 그 색이 흙과도 숨과도 눈으로 갈린다 — 따뜻한 쪽이다', () => {
    // Given 세 어휘가 같은 단계에서 받는 색
    const ember = zoneOf(emberWarmthTag(2), 2).color;
    const soil = zoneOf(soilStainTag(2), 2).color;
    const breath = zoneOf(frostBreathTag(2), 2).color;
    // Then  셋이 서로 다른 값이다
    expect(new Set([ember, soil, breath]).size).toBe(3);
    // And   온기는 호박빛/주홍 대역이고, 숨의 찬 쪽 끝과 반대편이다
    expect(hueOf(ember)).toBeGreaterThan(20);
    expect(hueOf(ember)).toBeLessThan(60);
    expect(hueOf(breath)).toBeGreaterThan(180);
    // And   흙과 같은 따뜻한 쪽에 서므로 색상만으로 갈리지 않는다 — 밝기가 함께 갈린다
    expect(hueOf(ember)).toBeGreaterThan(hueOf(soil) + 10);
    expect(ember & 0xff0000).toBeGreaterThan(soil & 0xff0000);
  });

  it('S-010 흙과 숨의 색은 한 값도 달라지지 않는다 (SPEC-002 경계 ①)', () => {
    // Given C011 이 세운 흙의 다섯과 C020 이 세운 숨의 셋 — 값도 짙기도 그때의 것이다
    const SOIL = { day: 0x6b3524, night: 0x9c4a2e };
    const BREATH = { day: 0x3b3a8c, night: 0x6f6cd8 };
    const OPACITY = [0.1, 0.18, 0.26, 0.34, 0.42];
    // Then  흙 다섯이 그대로다
    for (const level of [1, 2, 3, 4, 5]) {
      expect({ level, zone: zoneOf(soilStainTag(level), level) }).toEqual({
        level,
        zone: { color: SOIL.day, opacity: OPACITY[level - 1] },
      });
      expect({ level, color: zoneOf(soilStainTag(level), level, true).color }).toEqual({
        level,
        color: SOIL.night,
      });
    }
    // And   숨 셋도 그대로다
    for (const level of [1, 2, 3]) {
      expect({ level, zone: zoneOf(frostBreathTag(level), level) }).toEqual({
        level,
        zone: { color: BREATH.day, opacity: OPACITY[level - 1] },
      });
      expect({ level, color: zoneOf(frostBreathTag(level), level, true).color }).toEqual({
        level,
        color: BREATH.night,
      });
    }
  });

  it('S-011 모르는 어휘는 지금까지대로 흙으로 읽힌다 (폴백은 한 줄도 바뀌지 않았다)', () => {
    // Given 이 세계가 알지 못하는 태그 하나
    // Then  색은 흙의 것이고 짙기는 그 단계의 것이다 — 새 어휘가 폴백을 가져가지 않았다
    expect(zoneOf('mystery-tag:2', 2)).toEqual({ color: 0x6b3524, opacity: 0.18 });
    // And   표 밖의 단계는 여전히 그리지 않는다
    expect(traceZonePresentation(0, emberWarmthTag(1))).toBeUndefined();
    expect(traceZonePresentation(6, soilStainTag(5))).toBeUndefined();
  });
});
