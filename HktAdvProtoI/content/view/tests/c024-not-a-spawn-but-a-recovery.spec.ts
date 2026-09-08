// C024 — 멎은 것이 사유를 말하고, 사체가 균류가 되는 자리가 갈린다 · 화면 쪽 검증 시나리오
// (spec Added — View · Observable "관찰 계약은 한 항목도 늘지 않았다")
//
// 이 Cycle 이 화면에 더하는 것은 **표의 줄뿐**이다 — 관찰 계약이 한 항목도 늘지 않았고,
// 이번 것들은 이미 실리는 자리로 온다 (원천의 조건 코드 · 원천과 탄생지의 kind · 자락 · 떼).
// 그래서 재는 것도 "표가 늘었는가" 하나다. **전체 개수를 세지 않는다** — 이 Cycle 이 더한
// 코드와 형태가 저마다 문구와 그림을 가지고, 이미 서 있던 것들과 갈리는지만 본다.
//
// 재는 것 다섯.
//   ① 문구  — 조건 코드 넷에 사람이 읽을 말이 붙고, 이웃한 조건 코드들과 갈린다
//   ② 그림  — 사체와 변성지가 그림표에 서고, 같은 방의 것들과 픽셀이 갈린다
//   ③ phase — 변성지의 넷이 **눈으로도 말로도** 갈린다 (맺히는 중 · 터진 뒤 · 아무 일 없음)
//   ④ 자락  — 새 자락 넷이 **이 숲의 흙 사다리를 그대로 탄다** (새 색 체계가 없다)
//   ⑤ 침묵  — 거목균은 떼의 자락도 코드도 밝히지 않으므로 화면에 아무것도 서지 않는다
//
// **개체군의 값은 어디에서도 읽지 않는다** — 세계가 싣지 않는다 (spec Observable
// "투영하지 않는 것"). 그래서 이 파일에도 값을 세는 단언이 하나도 없다.

import { describe, expect, it } from 'vitest';
import type { EntityView, GameViewSnapshot, InteractionView } from '../../protocol/gameview';
import type { SceneState } from '../../../engine/view-kernel/scene/scene-state';
import { descriptionHash } from '../../../engine/world-authoring/description';
import { codeText } from '../code-text';
import { lifeSiteStateCode } from '../life-reading';
import { ROLE_PRESENTATIONS } from '../role-presentation';
import { SPRITE_SHEET } from '../sprites';
import { resolvePresentation } from '../resolve';
import { traceZonePresentation } from '../region-presentation';
import {
  CONDITION_UNMET,
  FORM_CARCASS,
  FORM_CARCASS_BLOOM,
  FORM_NEST_MYCELIUM,
  FORM_ROOT_CLUTCH,
  FORM_ROOT_EGGS,
  LIFE_FUNGUS_CROWDED,
  LIFE_HAS_OWNER,
  LIFE_NEEDS_CARCASS,
  LIFE_NEEDS_DECAY,
  LIFE_NEEDS_MATERIAL,
  LIFE_NEEDS_PARENT,
  LIFE_NEEDS_RAIN,
  NO_DECOMPOSER,
  NO_MOLTER,
  PREDATOR_NEST,
  RECOVERY_STALLED,
  TRACE_LAYER,
  TREE_FUNGUS,
  regionSpec,
  soilStainLevel,
  traceLevel,
} from '../../regions/index';
import { areasOf } from '../../../engine/world-authoring/description';

// ── 데이터가 소유한 이름 (여기서 지어내지 않는다) ─────────────────────

/** 이 Cycle 이 세운 자락 넷 — 세계 쪽 데이터가 소유하는 op id 다 */
const NEW_TRACE_OPS = [
  'trace-nest-carcass',
  'trace-nest-rot',
  'trace-nest-odor',
  'trace-nest-returned-soil',
] as const;

/** 세계가 싣는 원천의 state 셋 · 탄생지의 phase 넷 (봉투가 실어 오는 값 그대로) */
const SOURCE_STATES = ['available', 'depleted', 'recovering'] as const;
const LIFE_PHASES = ['dormant', 'binding', 'born', 'spent'] as const;

const spriteMap = (id: string): readonly string[] => {
  const map = SPRITE_SHEET.maps[id];
  if (!map) throw new Error(`그림표에 '${id}' 가 없다`);
  return map;
};

const flat = (id: string): string => spriteMap(id).join('\n');

/** 그 role 의 kind → 그림 키 (없으면 그 kind 가 아직 표에 서지 않은 것이다) */
function spriteKeyOf(role: string, kind: string): string {
  const key = ROLE_PRESENTATIONS[role]?.spriteByKind?.[kind];
  if (!key) throw new Error(`${role} 의 그림표에 '${kind}' 가 없다`);
  return key;
}

// ── ① 문구 — 멎은 것과 모자란 것이 저마다 말을 가진다 ────────────────

describe('C024 문구 — 이 Cycle 이 더한 코드 넷이 말을 가진다', () => {
  // 코드 그대로 보이는 것이 곧 표에 줄이 없는 것이다 (미등록 코드의 폴백)
  const FOUR = [NO_MOLTER, NO_DECOMPOSER, LIFE_NEEDS_CARCASS, LIFE_FUNGUS_CROWDED];

  it('넷 다 코드가 아니라 사람이 읽을 말로 뜬다', () => {
    for (const code of FOUR) {
      expect({ code, text: codeText(code) }).not.toEqual({ code, text: code });
      expect(codeText(code).length).toBeGreaterThan(0);
    }
  });

  it('멎음 코드 둘이 이웃한 조건 코드들과 갈린다 — 매달림도 때도 아닌 셋째 사유다', () => {
    // recovery-stalled 는 "매달린 원천이 비었다" 이고 condition-unmet 은 "아직 그때가 아니다" 다.
    // 이 둘은 **살아 있는 것이 없다** 이므로 관찰자가 셋을 갈라 읽어야 한다 (spec Observable Result 1)
    const said = [RECOVERY_STALLED, CONDITION_UNMET, NO_MOLTER, NO_DECOMPOSER].map((code) => codeText(code));
    expect(new Set(said).size).toBe(4);
  });

  it('모자람 코드 둘이 앞의 다섯과 갈린다', () => {
    const said = [
      LIFE_NEEDS_MATERIAL,
      LIFE_NEEDS_DECAY,
      LIFE_NEEDS_RAIN,
      LIFE_HAS_OWNER,
      LIFE_NEEDS_PARENT,
      LIFE_NEEDS_CARCASS,
      LIFE_FUNGUS_CROWDED,
    ].map((code) => codeText(code));
    expect(new Set(said).size).toBe(7);
  });

  it('삭일 것과 삭을 것이 서로 다른 말이다 — 사슬의 두 끝이 갈려 읽힌다', () => {
    expect(codeText(NO_DECOMPOSER)).not.toBe(codeText(LIFE_NEEDS_CARCASS));
  });

  it('형태 둘이 말을 가지고 이미 선 형태들과 갈린다', () => {
    for (const form of [FORM_CARCASS, FORM_CARCASS_BLOOM]) {
      expect({ form, text: codeText(form) }).not.toEqual({ form, text: form });
    }
    // 사체는 같은 방의 '사체 위 흰 균사' 와, 변성지는 뿌리의 둘과 갈려야 한다
    const said = [
      FORM_CARCASS,
      FORM_CARCASS_BLOOM,
      FORM_NEST_MYCELIUM,
      FORM_ROOT_CLUTCH,
      FORM_ROOT_EGGS,
    ].map((code) => codeText(code));
    expect(new Set(said).size).toBe(5);
  });

  it('그 말들이 개체군의 값도 상한도 세지 않는다 — 화면에 숫자가 없다', () => {
    for (const code of [...FOUR, FORM_CARCASS, FORM_CARCASS_BLOOM]) {
      expect(codeText(code)).not.toMatch(/[0-9]/);
    }
  });
});

// ── ② 그림 — 사체와 변성지가 그림표에 선다 ───────────────────────────

describe('C024 그림 — 표에 열여섯째 원천과 셋째 탄생지가 는다', () => {
  it('사체가 원천의 그림표에 서고 세 state 가 다 있다', () => {
    const key = spriteKeyOf('resource-source', FORM_CARCASS);
    for (const state of SOURCE_STATES) expect(spriteMap(`${key}:${state}`).length).toBe(16);
  });

  it('변성지가 탄생지의 그림표에 서고 phase 넷이 다 있다', () => {
    const key = spriteKeyOf('life-site', FORM_CARCASS_BLOOM);
    for (const phase of LIFE_PHASES) expect(spriteMap(`${key}:${phase}`).length).toBe(16);
  });

  it('사체가 **같은 방의 사체 위 균사**와 픽셀부터 갈린다 — 흰 것이 한 점도 없다', () => {
    const carcass = spriteKeyOf('resource-source', FORM_CARCASS);
    const mycelium = spriteKeyOf('resource-source', FORM_NEST_MYCELIUM);
    for (const state of SOURCE_STATES) {
      expect(flat(`${carcass}:${state}`)).not.toBe(flat(`${mycelium}:${state}`));
    }
    // 흰 것(w · z)은 균사의 글자다 — 아직 덮이지 않은 사체에는 한 점도 없다
    expect(flat(`${carcass}:available`)).not.toMatch(/[wz]/);
  });

  it('변성지가 뿌리의 둘과 갈린다 — 붉은 것(C · 6)이 한 점도 없다', () => {
    const bloom = spriteKeyOf('life-site', FORM_CARCASS_BLOOM);
    const clutch = spriteKeyOf('life-site', FORM_ROOT_CLUTCH);
    const eggs = spriteKeyOf('life-site', FORM_ROOT_EGGS);
    for (const phase of LIFE_PHASES) {
      const one = flat(`${bloom}:${phase}`);
      expect(one).not.toBe(flat(`${clutch}:${phase}`));
      expect(one).not.toBe(flat(`${eggs}:${phase}`));
      expect(one).not.toMatch(/[C6]/);
    }
  });

  it('새 색 체계를 만들지 않았다 — 쓴 글자가 전부 이미 있던 팔레트의 것이다', () => {
    const known = new Set(Object.keys(SPRITE_SHEET.palette));
    const added = [
      ...SOURCE_STATES.map((s) => `${spriteKeyOf('resource-source', FORM_CARCASS)}:${s}`),
      ...LIFE_PHASES.map((p) => `${spriteKeyOf('life-site', FORM_CARCASS_BLOOM)}:${p}`),
    ];
    for (const id of added) {
      for (const glyph of flat(id).replace(/\n/g, '')) expect(known.has(glyph)).toBe(true);
    }
  });
});

// ── ③ phase — 셋이 눈으로 갈린다 (C022 · C023 이 알집과 알에 한 그대로) ──

describe('C024 변성지의 phase — 맺히는 중 · 터진 뒤 · 아무 일 없음이 갈린다', () => {
  const key = () => spriteKeyOf('life-site', FORM_CARCASS_BLOOM);

  it('멎음 · 맺힘 · 터진 뒤 셋의 그림이 서로 다르다', () => {
    const three = ['dormant', 'binding', 'spent'].map((phase) => flat(`${key()}:${phase}`));
    expect(new Set(three).size).toBe(3);
  });

  it('맺히는 동안은 실루엣이 같고 **빛이 는다** — 있던 것이 달라진 것이다', () => {
    const dormant = flat(`${key()}:dormant`);
    const binding = flat(`${key()}:binding`);
    // 빛나지 않는 흰 것(z)이 빛나는 흰 것(w)으로 간다 (glow-cap 이 쓰는 그 어휘 그대로)
    expect(dormant).toMatch(/z/);
    expect(dormant).not.toMatch(/w/);
    expect(binding).toMatch(/w/);
  });

  it('터진 뒤는 **실루엣부터** 갈린다 — 서 있던 것이 없어진 자리다', () => {
    const spent = spriteMap(`${key()}:spent`);
    const binding = spriteMap(`${key()}:binding`);
    const filled = (rows: readonly string[]) =>
      rows.join('').split('').filter((glyph) => glyph !== '.').length;
    expect(filled(spent)).toBeLessThan(filled(binding));
  });

  it('phase 넷이 저마다 자기 말을 가지고 뿌리의 둘과 갈린다', () => {
    const bloom = LIFE_PHASES.map((phase) => lifeSiteStateCode(FORM_CARCASS_BLOOM, phase));
    // 코드 그대로 지나갔으면 표에 줄이 없는 것이다 (미등록 형태의 폴백)
    for (const [i, code] of bloom.entries()) expect(code).not.toBe(LIFE_PHASES[i]);
    const said = bloom.map((code) => codeText(code));
    expect(new Set(said).size).toBe(4);
    for (const [i, code] of bloom.entries()) {
      const phase = LIFE_PHASES[i] as string;
      expect(codeText(code)).not.toBe(codeText(lifeSiteStateCode(FORM_ROOT_CLUTCH, phase)));
    }
  });
});

// ── ④ 자락 — 이 숲의 흙 사다리를 그대로 탄다 ─────────────────────────

describe('C024 자락 — 전조 둘과 뒤 자락 하나가 흙의 어휘로 선다', () => {
  const areas = () => {
    const spec = regionSpec(PREDATOR_NEST);
    if (!spec) throw new Error('content/regions 에 둥지가 없다');
    return areasOf(spec.space, TRACE_LAYER);
  };

  it('넷이 다 그 방의 자락 layer 에 서 있다', () => {
    const ids = new Set(areas().map((area) => area.id));
    for (const op of NEW_TRACE_OPS) expect(ids.has(op)).toBe(true);
  });

  it('넷이 다 **흙의 사다리**를 탄다 — 새 어휘를 만들지 않았다', () => {
    for (const op of NEW_TRACE_OPS) {
      const area = areas().find((one) => one.id === op);
      if (!area) throw new Error(`자락 '${op}' 이 없다`);
      // 흙의 단계로 읽히고(soilStainLevel > 0), 그 값이 두 어휘를 다 아는 자리의 답과 같다
      expect(soilStainLevel(area.tag)).toBeGreaterThan(0);
      expect(traceLevel(area.tag)).toBe(soilStainLevel(area.tag));
    }
  });

  it('그 단계가 이미 있던 흙의 색 하나로 그려진다 — 색을 더하지 않았다', () => {
    const soil = traceZonePresentation(1, 'soil-stain:1');
    for (const op of NEW_TRACE_OPS) {
      const area = areas().find((one) => one.id === op);
      if (!area) throw new Error(`자락 '${op}' 이 없다`);
      const drawn = traceZonePresentation(traceLevel(area.tag), area.tag);
      expect(drawn).toBeDefined();
      // 색은 흙 하나이고 갈리는 것은 짙기뿐이다 (C011 이 세운 사다리 그대로)
      expect(drawn?.color).toBe(soil?.color);
    }
  });
});

// ── ⑤ 침묵 — 거목균은 아무것도 세우지 않는다 ─────────────────────────

describe('C024 침묵 — 돌지 않는 것은 화면에 서지 않는다', () => {
  it('거목균이 떼의 자락도 코드도 밝히지 않는다 — 결손이 아니라 결정이다', () => {
    const population = regionSpec(PREDATOR_NEST)?.ecology?.populations?.find(
      (one) => one.id === TREE_FUNGUS,
    );
    expect(population).toBeDefined();
    expect(population?.presence).toBeUndefined();
  });

  it('그래서 그 방의 바닥에 떼의 자락이 한 겹도 눕지 않는다', () => {
    const spec = regionSpec(PREDATOR_NEST);
    if (!spec) throw new Error('content/regions 에 둥지가 없다');
    const snapshot = {
      specId: 'VIEW-BASIC-COMBAT-POLICY-001',
      scene: PREDATOR_NEST,
      region: {
        id: PREDATOR_NEST,
        hash: descriptionHash(spec.space),
        disturbance: { value: 0, threshold: 300, phase: 'dormant' as const },
      },
      standingConditions: [],
      tracks: [],
      // 세계가 실은 떼가 하나도 없다 — 거목균이 그것을 밝히지 않았으므로 그렇다
      presences: [],
      clock: { dayPhase: 'DAY', season: 'STILL', dayIndex: 0, seasonCycle: 0 },
      observer: { id: 'observer-a', characterId: 'player', acknowledgedMark: 0 },
      entities: [] as EntityView[],
      interactions: [] as InteractionView[],
      hud: [],
      strikes: [],
      debug: { open: false },
      commands: [],
    } as unknown as GameViewSnapshot;
    const scene = resolvePresentation(snapshot) as SceneState;
    // 방의 땅과 흔적은 그대로 그려지되, 떼의 자락은 한 겹도 없다
    // (자락의 이름은 presence-presentation 이 짓는다 — `swarm:<방>:<코드>:<자리>`)
    expect(scene.zones.some((zone) => zone.id.startsWith('swarm:'))).toBe(false);
  });
});
