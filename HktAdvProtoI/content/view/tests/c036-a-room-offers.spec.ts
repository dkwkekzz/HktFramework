// C036 — 방이 기회를 내민다 · GameView 시나리오 테스트 (View 몫)
//
// 이 파일이 재는 것은 **판이 무엇을 말하는가** 하나뿐이다 (spec SPEC-005 · Observable).
// 세계는 기동하지 않는다 — 봉투(관찰 결과)를 손으로 짓고 그것으로 SceneState 를 세워 본다
// (c029 ~ c031 의 형식 그대로).
//
// 어느 행동이 어느 기회에 속하는가 · 그 기회가 언제 열리는가는 **세계의 일**이다. 이 파일이
// 아는 것은 그 결과로 봉투에 실려 오는 자리 하나이고, 여기서 재는 것은 그것이 판에서 어떤
// 말이 되는가다. 아는 것은 spec 이 준 계약뿐이다:
//
//   interactions[].opportunity   { id, discovery } — 그 행동이 속한 기회 (없으면 자리가 없다)
//   discovery                    VISIBLE · SIGNAL · TRACE · HIDDEN 중 하나
//
// **판정 방식** — 줄의 형식이 C027 · C028 그대로인가는 **차이로** 잰다: 같은 봉투에서
// `opportunity` 하나만 뺀 판과 견주어, 늘어난 것이 줄 끝의 한 마디뿐임을 본다 (앞부분이
// 한 글자도 달라지지 않았음을 그 견줌이 진다). 전체 줄 수는 단언하지 않는다 — 다른 Cycle 이
// 줄을 더해도 깨지면 안 된다.
//
// 문구 셋만은 **값 그대로** 적어 둔다 (c030 이 흔적의 색을, c031 이 기획의 문장을 값으로
// 적어 둔 그 자리와 같다) — 이 셋이 이 Cycle 이 놓으려는 갈림 그 자체이기 때문이다:
// 같은 방의 두 원천이 하나는 흔적으로 하나는 신호로 읽힌다 (spec Experience Intent).

import { describe, expect, it } from 'vitest';
import type { EntityView, GameViewSnapshot, InteractionView } from '../../protocol/gameview';
import type { SceneState } from '../../../engine/view-kernel/scene/scene-state';
import { resolvePresentation } from '../resolve';
import { codeText, discoveryCode } from '../code-text';
import { descriptionHash } from '../../../engine/world-authoring/description';
import {
  FORM_FALLEN_SCALE,
  FORM_MOLT_LITTER,
  ORE_EATER_MOLT,
  WHALE_SCALE,
  regionSpec,
} from '../../regions/index';

// ── 계약이 준 형 (C027 ~ C031 의 것 그대로 — 이 파일은 engine 의 형을 읽지 않고 쓴다) ──

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

/** 세계가 싣는 discovery 의 값들 — spec World Change 1 의 어휘다 */
const VISIBLE = 'VISIBLE';
const SIGNAL = 'SIGNAL';
const TRACE = 'TRACE';
const HIDDEN = 'HIDDEN';

/** 표현이 지킬 글자 셋 — 이 Cycle 이 놓는 갈림이 곧 이 말들이다 */
const VISIBLE_TEXT = '눈에 보인다';
const TRACE_TEXT = '흔적이 말한다';
const SIGNAL_TEXT = '신호로 온다';

/** 유도된 기회의 id — **판에 서면 안 되는 글자**다 (spec 기본형 ⑥ · Observable) */
const MOLT_OPPORTUNITY = 'gather:MOLT_LITTER';
const SCALE_OPPORTUNITY = 'gather:FALLEN_SCALE';
const DOOR_OPPORTUNITY = 'cross:WALKING_FOREST_DOOR';

const FOREST_EDGE = 'FOREST_EDGE';

function hashOf(regionId: string): string {
  const spec = regionSpec(regionId);
  if (!spec) throw new Error(`content/regions 에 '${regionId}' 가 없다`);
  return descriptionHash(spec.space);
}

// ── 존재 하네스 (숲 가장자리 — spec Observable Result ① · ②) ─────────

const ME: EntityView = {
  id: 'player',
  role: 'player-character',
  state: 'idle',
  kind: 'rabbit-swordsman',
  position: { x: 0, z: 0 },
};

/** 밑동의 허물 — 흔적이 말하는 자리 */
const MOLT: EntityView = {
  id: 'MOLT_LITTER',
  role: 'resource-source',
  state: 'available',
  kind: FORM_MOLT_LITTER,
  material: ORE_EATER_MOLT,
  position: { x: 2, z: 0 },
};

/** 비늘 — 신호로 오는 자리 (같은 방 · 같은 종류의 존재) */
const SCALE: EntityView = {
  id: 'FALLEN_SCALE',
  role: 'resource-source',
  state: 'available',
  kind: FORM_FALLEN_SCALE,
  material: WHALE_SCALE,
  position: { x: -2, z: 0 },
};

/** 걸어 다니는 숲으로 가는 문 — 보이는 자리 */
const DOOR: EntityView = {
  id: 'WALKING_FOREST_DOOR',
  role: 'region-exit',
  state: 'locked',
  kind: 'door',
  position: { x: 0, z: 6 },
};

const MOVE: InteractionView = { id: 'move', role: 'move-to', available: true };

/**
 * C037 CHANGED — 봉투의 기회가 `event` · `open` 을 함께 싣는다 (관찰 계약 2.1).
 *
 * 이 파일이 세우는 기회는 전부 **때가 없고 열려 있다** (event: false · open: true) —
 * C036 이 재는 것은 discovery 한 마디이고, 그 값에서 판의 줄이 한 글자도 달라지지 않아야
 * 한다는 것이 C037 SPEC-004 경계의 회귀다. 때가 있는 기회의 줄은 c037 시험이 잰다.
 */
function opportunityOf(id: string, discovery: string): {
  id: string;
  discovery: string;
  event: boolean;
  open: boolean;
} {
  return { id, discovery, event: false, open: true };
}

/** 채취 하나 — 기회의 이름을 밝히거나(discovery) 밝히지 않거나 */
function harvest(
  target: string,
  options: {
    available?: boolean;
    reason?: string;
    opportunity?: { id: string; discovery: string; event: boolean; open: boolean };
  } = {},
): InteractionView {
  return {
    id: 'mine',
    role: 'harvest-source',
    targetEntityId: target,
    available: options.available ?? true,
    ...(options.reason === undefined ? {} : { reason: options.reason }),
    ...(options.opportunity === undefined ? {} : { opportunity: { ...options.opportunity } }),
  };
}

/** 건너기 하나 — 문의 줄이 기회에서 온다 (spec Observable Result ②) */
function cross(
  options: { opportunity?: { id: string; discovery: string; event: boolean; open: boolean } } = {},
): InteractionView {
  return {
    id: 'transit',
    role: 'transit-connector',
    targetEntityId: DOOR.id,
    available: false,
    reason: 'out-of-range',
    ...(options.opportunity === undefined ? {} : { opportunity: { ...options.opportunity } }),
  };
}

const SELF_HUD = [
  { id: 'inventory.stone', kind: 'counter' as const, value: 0 },
  { id: 'player.action', kind: 'label' as const, value: 'idle' },
  { id: 'world.time', kind: 'counter' as const, value: 400 },
];

/** 관찰 결과 하나 — 봉투의 자리는 계약이 준 것뿐이다 */
function made(interactions: InteractionView[]): GameViewSnapshot {
  return {
    specId: 'VIEW-STONE-MINING-001',
    scene: FOREST_EDGE,
    region: {
      id: FOREST_EDGE,
      hash: hashOf(FOREST_EDGE),
      disturbance: { value: 0, threshold: 300, phase: 'dormant' as const },
      memory: { turns: 0, awakenings: { times: 0 }, passages: [], births: [] },
    },
    standingConditions: [],
    tracks: [],
    presences: [],
    clock: { dayPhase: 'DAY', season: 'STILL', dayIndex: 0, seasonCycle: 0 },
    observer: { id: 'observer-a', characterId: ME.id, acknowledgedMark: 0 },
    entities: [ME, MOLT, SCALE, DOOR],
    interactions: [MOVE, ...interactions],
    hud: [{ id: 'region.depth', kind: 'label', value: 'wild' }, ...SELF_HUD],
    strikes: [],
    debug: { open: false },
    commands: [],
  } as GameViewSnapshot;
}

// ── 화면 만들기 ───────────────────────────────────────────────────────

function point(snapshot: GameViewSnapshot, entityId: string): Scene {
  return resolvePresentation(snapshot, undefined, {
    designation: { entityId },
  } as Parameters<typeof resolvePresentation>[2]) as Scene;
}

function frameOf(scene: Scene): TargetFrame {
  const frame = scene.targetFrame;
  if (!frame) throw new Error('판(targetFrame)이 서지 않았다');
  return frame;
}

/** 「할 수 있는 것」 줄들의 값 — 줄의 id 는 그 행동의 것이다 (C027) */
function offerLines(scene: Scene): string[] {
  return frameOf(scene)
    .rows.filter((row) => row.id.startsWith('being.offer'))
    .map((row) => String(row.value));
}

/** 판 전체의 글 — 제목·부제·줄의 이름표와 값 */
function frameTexts(scene: Scene): string[] {
  const frame = frameOf(scene);
  return [
    frame.title ?? '',
    frame.subtitle ?? '',
    ...frame.rows.flatMap((row) => [String(row.label ?? ''), String(row.value ?? '')]),
  ];
}

// ── ① 줄이 discovery 를 말한다 (spec SPEC-005 · Observable Result ①) ──

describe('C036 판의 「할 수 있는 것」 줄이 어떻게 알게 되는지를 함께 진다', () => {
  const scene = point(
    made([
      harvest(MOLT.id, { opportunity: opportunityOf(MOLT_OPPORTUNITY, TRACE) }),
      harvest(SCALE.id, { opportunity: opportunityOf(SCALE_OPPORTUNITY, SIGNAL) }),
      cross({ opportunity: opportunityOf(DOOR_OPPORTUNITY, VISIBLE) }),
    ]),
    MOLT.id,
  );

  it('밑동의 허물을 지목하면 흔적이 말한다가 그 줄에 함께 선다', () => {
    expect(offerLines(scene)).toEqual([`채취${' · '}${TRACE_TEXT}`]);
  });

  it('같은 방의 비늘은 신호로 온다 — 두 원천이 갈려 읽힌다', () => {
    const scaleScene = point(
      made([
        harvest(MOLT.id, { opportunity: opportunityOf(MOLT_OPPORTUNITY, TRACE) }),
        harvest(SCALE.id, { opportunity: opportunityOf(SCALE_OPPORTUNITY, SIGNAL) }),
      ]),
      SCALE.id,
    );
    expect(offerLines(scaleScene)).toEqual([`채취 · ${SIGNAL_TEXT}`]);
    // 같은 줄이 두 대상에서 다른 말을 한다 — 그것이 이 Cycle 이 놓는 갈림이다
    expect(offerLines(scaleScene)).not.toEqual(offerLines(scene));
  });

  it('문(건너기)의 줄도 기회에서 온다 — 잠긴 문은 사유 뒤에 그 마디가 선다', () => {
    const doorScene = point(
      made([cross({ opportunity: opportunityOf(DOOR_OPPORTUNITY, VISIBLE) })]),
      DOOR.id,
    );
    expect(offerLines(doorScene)).toEqual([
      `건너기 · ${codeText('out-of-range')} · ${VISIBLE_TEXT}`,
    ]);
  });

  it('기회의 id 는 판 어디에도 서지 않는다 (코드의 자리이지 사람이 읽을 이름이 아니다)', () => {
    const texts = frameTexts(scene).join('\n');
    for (const id of [MOLT_OPPORTUNITY, SCALE_OPPORTUNITY, DOOR_OPPORTUNITY]) {
      expect(texts).not.toContain(id);
    }
    // 세계의 코드 글자도 서지 않는다 — 사람의 말이 된 뒤에만 판에 오른다
    for (const code of [VISIBLE, SIGNAL, TRACE, HIDDEN]) expect(texts).not.toContain(code);
  });
});

// ── ② 형식 · 순서 · 거절 사유는 C027 · C028 그대로다 (SPEC-005 경계 ①) ──

describe('C036 줄의 앞부분은 한 글자도 달라지지 않는다', () => {
  const withOpportunity = (discovery: string, reason?: string): Scene =>
    point(
      made([
        harvest(MOLT.id, {
          ...(reason === undefined ? {} : { available: false, reason }),
          opportunity: opportunityOf(MOLT_OPPORTUNITY, discovery),
        }),
      ]),
      MOLT.id,
    );
  const without = (reason?: string): Scene =>
    point(
      made([harvest(MOLT.id, reason === undefined ? {} : { available: false, reason })]),
      MOLT.id,
    );

  it('걸 수 있는 줄 — 늘어난 것은 줄 끝의 한 마디뿐이다', () => {
    const before = offerLines(without())[0]!;
    const after = offerLines(withOpportunity(TRACE))[0]!;
    expect(before).toBe('채취');
    expect(after).toBe(`${before} · ${TRACE_TEXT}`);
  });

  it('거절된 줄 — 사유가 먼저이고 그 뒤에 붙는다 (사유의 문구도 자리도 그대로)', () => {
    const before = offerLines(without('source-depleted'))[0]!;
    const after = offerLines(withOpportunity(SIGNAL, 'source-depleted'))[0]!;
    expect(before).toBe(`채취 · ${codeText('source-depleted')}`);
    expect(after).toBe(`${before} · ${SIGNAL_TEXT}`);
  });

  it('discovery 는 판정을 바꾸지 않는다 — 줄의 수도 다른 줄들도 그대로다 (경계 ②)', () => {
    const bare = frameOf(without('source-recovering'));
    const named = frameOf(withOpportunity(TRACE, 'source-recovering'));
    expect(named.title).toBe(bare.title);
    expect(named.rows.map((row) => row.id)).toEqual(bare.rows.map((row) => row.id));
    // 「할 수 있는 것」 말고는 값도 한 글자도 다르지 않다
    const others = (frame: TargetFrame): string[] =>
      frame.rows.filter((row) => !row.id.startsWith('being.offer')).map((row) => String(row.value));
    expect(others(named)).toEqual(others(bare));
  });

  it('기회가 없는 줄은 지금 그대로다 — 이동에도 스킬에도 마디가 붙지 않는다', () => {
    // 대상을 겨냥하지 않은 이동은 애초에 이 판에 서지 않고(C027 SPEC-003), 겨냥한 행동이
    // 기회를 밝히지 않으면 이름과 사유까지다
    expect(offerLines(without())).toEqual(['채취']);
  });
});

// ── ③ 문구 셋 (spec SPEC-005 · World Change 4) ────────────────────────

describe('C036 어떻게 알게 되는가의 문구 셋', () => {
  it('세계가 싣는 값에서 코드를 짓고 그 코드가 사람의 말이 된다', () => {
    expect(codeText(discoveryCode(VISIBLE))).toBe(VISIBLE_TEXT);
    expect(codeText(discoveryCode(TRACE))).toBe(TRACE_TEXT);
    expect(codeText(discoveryCode(SIGNAL))).toBe(SIGNAL_TEXT);
  });

  it('셋은 서로 다른 말이다 — 같은 말이면 갈림이 화면에서 사라진다', () => {
    const said = [VISIBLE_TEXT, TRACE_TEXT, SIGNAL_TEXT];
    expect(new Set(said).size).toBe(said.length);
  });

  it('게임 내부의 말이 하나도 섞이지 않는다 (코드 글자 · 기회 · id)', () => {
    // HIDDEN 은 빠졌다 — C038 부터 세계가 그 값을 실어 보내지 않아 표에 말이 없다
    for (const value of [VISIBLE, SIGNAL, TRACE]) {
      const text = codeText(discoveryCode(value));
      expect(text).not.toContain(value);
      expect(text).not.toContain('기회');
      expect(text).not.toContain('discovery');
    }
  });

  it('HIDDEN 은 화면에 닿지 않는다 — 세계가 그 값을 실어 보내지 않는다 (C038 CHANGED)', () => {
    // C036 때는 "말은 있되 줄이 서지 않는다" 였다. C038 이 거름을 세계에 세우면서
    // 그 값이 화면에 닿을 길이 없어졌고, 닿지 않는 말은 표에서 지웠다 (C038 기본형 ⑤).
    // 표에 없으면 코드 글자가 그대로 뜨는 것이 이 표의 규율이고, 여기서는 그것이 옳다 —
    // 세계가 보내지 않는 값이 화면에 뜨는 일 자체가 없어야 하기 때문이다.
    expect(codeText(discoveryCode(HIDDEN))).toBe(discoveryCode(HIDDEN));
    // 그리고 어떤 봉투도 그 값을 싣지 않는다 (spec SPEC-001)
    const scene = point(
      made([
        harvest(MOLT.id, { opportunity: opportunityOf(MOLT_OPPORTUNITY, TRACE) }),
        harvest(SCALE.id, { opportunity: opportunityOf(SCALE_OPPORTUNITY, SIGNAL) }),
        cross({ opportunity: opportunityOf(DOOR_OPPORTUNITY, VISIBLE) }),
      ]),
      MOLT.id,
    );
    expect(frameTexts(scene).join('\n')).not.toContain(codeText(discoveryCode(HIDDEN)));
  });

  it('표에 없는 값(자리만인 NPC · KNOWLEDGE)은 코드 그대로 뜬다 — 지어내지 않는다', () => {
    expect(codeText(discoveryCode('NPC'))).toBe('discovery-npc');
  });
});
