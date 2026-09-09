// C037 — 때가 있는 기회 · GameView 시나리오 테스트 (View 몫)
//
// 이 파일이 재는 것은 **판이 무엇을 말하는가** 하나뿐이다 (spec SPEC-004 · SPEC-007 ·
// Observable). 세계는 기동하지 않는다 — 봉투(관찰 결과)를 손으로 짓고 그것으로 SceneState 를
// 세워 본다 (c036 의 형식 그대로).
//
// 그 기회가 언제 열리고 무엇이 그것을 여는가는 **세계의 일**이다. 이 파일이 아는 것은 그
// 결과로 봉투에 실려 오는 자리 둘이고, 여기서 재는 것은 그것이 판에서 무슨 말이 되는가다.
// 아는 것은 spec 이 준 계약뿐이다:
//
//   interactions[].opportunity   { id, discovery, event, open } — open 은 판정 불가도 거짓이다
//   region.memory.births[]       { formation, times, lastAt? } — 태어난 적 있는 것만
//
// **판정 방식** — 줄의 형식이 C036 그대로인가는 **차이로** 잰다 (c036 의 규율 그대로):
// 같은 봉투에서 `event` · `open` 만 바꿔 세운 판과 견주어, 늘어난 것이 한 마디뿐임을 본다.
// 전체 줄 수는 단언하지 않는다 — 다른 Cycle 이 줄을 더해도 깨지면 안 된다.
//
// 문구 하나만은 **값 그대로** 적어 둔다 (c036 이 discovery 셋을 그리한 자리와 같다) —
// 「지금은 없다」 가 이 Cycle 이 놓으려는 갈림 그 자체이기 때문이다: 같은 원천이 고래가
// 지나기 전과 뒤에 다른 말을 한다 (spec Experience Intent).

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

// ── 계약이 준 형 (C027 ~ C036 의 것 그대로) ───────────────────────────

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

/** 세계가 싣는 discovery 의 값들 (C036 의 어휘 그대로) */
const SIGNAL = 'SIGNAL';
const TRACE = 'TRACE';
const VISIBLE = 'VISIBLE';

/** 표현이 지킬 글자 — 이 Cycle 이 놓는 갈림이 곧 이 말이다 */
const CLOSED_TEXT = '지금은 없다';
const SIGNAL_TEXT = '신호로 온다';

/** 유도된 기회의 id — **판에 서면 안 되는 글자**다 (C036 기본형 ⑥ 그대로) */
const SCALE_OPPORTUNITY = 'gather:FALLEN_SCALE';
const MOLT_OPPORTUNITY = 'gather:MOLT_LITTER';
const DOOR_OPPORTUNITY = 'cross:WALKING_FOREST_DOOR';

const FOREST_EDGE = 'FOREST_EDGE';

/** 세계가 세는 것들 — 방의 기억에 실려 오는 값 (C034 · C037) */
const SKY_WHALE = 'sky-whale';
const ROOT_CLUTCH = 'root-clutch';
/**
 * 판에 서면 안 되는 것 — 무엇이 그 기회를 여는가 · 언제까지인가 (spec Observable).
 *
 * '고래' 한 글자는 여기 없다: **재료의 이름**(고래 비늘)이 이미 그 글자를 가지고 있고,
 * 그 줄은 C029 가 세운 "그것이 무엇으로 되어 있는가" 이지 "무엇이 그것을 여는가" 가 아니다.
 * 금하는 것은 **그 기회를 여는 것의 이름**(지나가는 천공고래)과 때의 말이다.
 */
const FORBIDDEN = ['240', '초 뒤', '초 후', '천공고래', '지나면', '지나야'];

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

/** 비늘 — 때가 있는 기회의 자리 (신호로 온다) */
const SCALE: EntityView = {
  id: 'FALLEN_SCALE',
  role: 'resource-source',
  state: 'available',
  kind: FORM_FALLEN_SCALE,
  material: WHALE_SCALE,
  position: { x: -2, z: 0 },
};

/** 밑동의 허물 — 같은 방의 때 없는 기회 (흔적이 말한다) */
const MOLT: EntityView = {
  id: 'MOLT_LITTER',
  role: 'resource-source',
  state: 'available',
  kind: FORM_MOLT_LITTER,
  material: ORE_EATER_MOLT,
  position: { x: 2, z: 0 },
};

/** 잠긴 문 — 판정 불가 잎을 가진 기회의 자리 (Event 가 아니다) */
const DOOR: EntityView = {
  id: 'WALKING_FOREST_DOOR',
  role: 'region-exit',
  state: 'locked',
  kind: 'door',
  position: { x: 0, z: 6 },
};

const MOVE: InteractionView = { id: 'move', role: 'move-to', available: true };

interface Opportunity {
  id: string;
  discovery: string;
  event: boolean;
  open: boolean;
}

/** 기회 하나 — 때가 있는가(event) · 지금 서 있는가(open) */
function opportunityOf(
  id: string,
  discovery: string,
  options: { event?: boolean; open?: boolean } = {},
): Opportunity {
  return { id, discovery, event: options.event ?? false, open: options.open ?? true };
}

function harvest(
  target: string,
  options: { available?: boolean; reason?: string; opportunity?: Opportunity } = {},
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

function cross(options: { opportunity?: Opportunity } = {}): InteractionView {
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

/** 방의 기억 하나 — 실려 온 것만 담는다 (없는 셈은 자리 자체가 없다) */
type Memory = GameViewSnapshot['region']['memory'];

const EMPTY_MEMORY: Memory = { turns: 0, awakenings: { times: 0 }, passages: [], births: [] };

/** 관찰 결과 하나 — 봉투의 자리는 계약이 준 것뿐이다 */
function made(interactions: InteractionView[], memory: Memory = EMPTY_MEMORY): GameViewSnapshot {
  return {
    specId: 'VIEW-STONE-MINING-001',
    scene: FOREST_EDGE,
    region: {
      id: FOREST_EDGE,
      hash: hashOf(FOREST_EDGE),
      disturbance: { value: 0, threshold: 300, phase: 'dormant' as const },
      memory,
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

type Designation = { entityId: string } | { ground: { x: number; z: number } };

function resolveWith(snapshot: GameViewSnapshot, designation: Designation): Scene {
  return resolvePresentation(snapshot, undefined, {
    designation,
  } as Parameters<typeof resolvePresentation>[2]) as Scene;
}

const point = (snapshot: GameViewSnapshot, entityId: string): Scene =>
  resolveWith(snapshot, { entityId });
const here = (snapshot: GameViewSnapshot): Scene => resolveWith(snapshot, { ground: { x: 0, z: 0 } });

function frameOf(scene: Scene): TargetFrame {
  const frame = scene.targetFrame;
  if (!frame) throw new Error('판(targetFrame)이 서지 않았다');
  return frame;
}

/** 「할 수 있는 것」 줄들의 값 */
function offerLines(scene: Scene): string[] {
  return frameOf(scene)
    .rows.filter((row) => row.id.startsWith('being.offer'))
    .map((row) => String(row.value));
}

/** 그 방의 「기억」 줄 — 서지 않았으면 없다 */
function memoryLine(scene: Scene): string | undefined {
  const found = frameOf(scene).rows.find((row) => row.id === 'place.memory');
  return found === undefined ? undefined : String(found.value);
}

/** 판 전체의 글 — 제목 · 부제 · 줄의 이름표와 값 */
function frameText(scene: Scene): string {
  const frame = frameOf(scene);
  return [
    frame.title ?? '',
    frame.subtitle ?? '',
    ...frame.rows.flatMap((row) => [String(row.label ?? ''), String(row.value ?? '')]),
  ].join('\n');
}

// ── ① 판이 「지금은 없다」 를 갈라 말한다 (spec SPEC-004 · Result ① · ②) ──

describe('C037 때가 있는 기회가 닫혀 있으면 그 줄이 지금은 없다를 함께 진다', () => {
  /** 고래가 지나기 전 — 비늘의 기회가 Event 이고 닫혀 있다 */
  const before = point(
    made([
      harvest(SCALE.id, {
        available: false,
        reason: 'condition-unmet',
        opportunity: opportunityOf(SCALE_OPPORTUNITY, SIGNAL, { event: true, open: false }),
      }),
    ]),
    SCALE.id,
  );
  /** 고래가 지나간 뒤 — 같은 기회가 열려 있다 (다른 것은 한 값도 바뀌지 않았다) */
  const after = point(
    made([
      harvest(SCALE.id, {
        opportunity: opportunityOf(SCALE_OPPORTUNITY, SIGNAL, { event: true, open: true }),
      }),
    ]),
    SCALE.id,
  );

  it('닫혀 있으면 그 마디가 서고 — 사유 뒤 · 어떻게 아는가 앞이다', () => {
    expect(offerLines(before)).toEqual([
      `채취 · ${codeText('condition-unmet')} · ${CLOSED_TEXT} · ${SIGNAL_TEXT}`,
    ]);
  });

  it('열려 있으면 붙지 않는다 — 그 마디가 사라지고 주울 수 있는 줄이 남는다', () => {
    expect(offerLines(after)).toEqual([`채취 · ${SIGNAL_TEXT}`]);
    expect(frameText(after)).not.toContain(CLOSED_TEXT);
  });

  it('언제까지도 무엇이 그것을 여는지도 어느 줄에 없다 (spec SPEC-004 경계)', () => {
    for (const scene of [before, after]) {
      const text = frameText(scene);
      for (const forbidden of FORBIDDEN) expect(text).not.toContain(forbidden);
    }
  });

  it('때가 없는 기회는 닫혀 있어도 그 마디를 얻지 못한다 (그 마디는 Event 의 것이다)', () => {
    // 판정 불가 잎을 가진 문의 기회 — 세계는 open: false 로만 말하지만 Event 가 아니다
    const doorScene = point(
      made([cross({ opportunity: opportunityOf(DOOR_OPPORTUNITY, VISIBLE, { open: false }) })]),
      DOOR.id,
    );
    // C029 · C036 의 그 줄 그대로다 — 한 글자도 늘지 않았다
    expect(offerLines(doorScene)).toEqual([
      `건너기 · ${codeText('out-of-range')} · ${codeText(discoveryCode(VISIBLE))}`,
    ]);
  });

  it('같은 방의 두 원천이 갈려 읽힌다 — 하나는 지금 없고 하나는 지금 있다', () => {
    const both = made([
      harvest(SCALE.id, {
        available: false,
        reason: 'condition-unmet',
        opportunity: opportunityOf(SCALE_OPPORTUNITY, SIGNAL, { event: true, open: false }),
      }),
      harvest(MOLT.id, { opportunity: opportunityOf(MOLT_OPPORTUNITY, TRACE) }),
    ]);
    expect(offerLines(point(both, SCALE.id))[0]).toContain(CLOSED_TEXT);
    expect(offerLines(point(both, MOLT.id))[0]).not.toContain(CLOSED_TEXT);
  });

  it('기회의 id 도 세계의 코드 글자도 판에 서지 않는다 (C036 의 규율 그대로)', () => {
    const text = frameText(before);
    for (const id of [SCALE_OPPORTUNITY, MOLT_OPPORTUNITY, DOOR_OPPORTUNITY]) {
      expect(text).not.toContain(id);
    }
    for (const code of [SIGNAL, TRACE, VISIBLE]) expect(text).not.toContain(code);
  });
});

// ── ② 줄의 앞부분은 C036 과 한 글자도 다르지 않다 (SPEC-004 경계) ──────

describe('C037 늘어난 것은 마디 하나뿐이다', () => {
  const lineOf = (options: { event: boolean; open: boolean; reason?: string }): string =>
    offerLines(
      point(
        made([
          harvest(SCALE.id, {
            ...(options.reason === undefined
              ? {}
              : { available: false, reason: options.reason }),
            opportunity: opportunityOf(SCALE_OPPORTUNITY, SIGNAL, {
              event: options.event,
              open: options.open,
            }),
          }),
        ]),
        SCALE.id,
      ),
    )[0]!;

  it('걸 수 있는 줄 — C036 의 줄에 한 마디가 끼어들 뿐 앞뒤가 그대로다', () => {
    const c036 = lineOf({ event: false, open: true });
    const closed = lineOf({ event: true, open: false });
    expect(c036).toBe(`채취 · ${SIGNAL_TEXT}`);
    expect(closed).toBe(`채취 · ${CLOSED_TEXT} · ${SIGNAL_TEXT}`);
  });

  it('거절된 줄 — 사유의 문구도 그 자리도 그대로다', () => {
    const c036 = lineOf({ event: false, open: true, reason: 'source-depleted' });
    const closed = lineOf({ event: true, open: false, reason: 'source-depleted' });
    expect(c036).toBe(`채취 · ${codeText('source-depleted')} · ${SIGNAL_TEXT}`);
    expect(closed.startsWith(`채취 · ${codeText('source-depleted')} · `)).toBe(true);
    expect(closed.endsWith(SIGNAL_TEXT)).toBe(true);
  });

  it('그 마디는 판정을 바꾸지 않는다 — 줄의 id 도 다른 줄의 값도 그대로다', () => {
    const bare = frameOf(
      point(
        made([
          harvest(SCALE.id, {
            opportunity: opportunityOf(SCALE_OPPORTUNITY, SIGNAL, { event: false, open: true }),
          }),
        ]),
        SCALE.id,
      ),
    );
    const timed = frameOf(
      point(
        made([
          harvest(SCALE.id, {
            opportunity: opportunityOf(SCALE_OPPORTUNITY, SIGNAL, { event: true, open: false }),
          }),
        ]),
        SCALE.id,
      ),
    );
    expect(timed.title).toBe(bare.title);
    expect(timed.rows.map((row) => row.id)).toEqual(bare.rows.map((row) => row.id));
    const others = (frame: TargetFrame): string[] =>
      frame.rows.filter((row) => !row.id.startsWith('being.offer')).map((row) => String(row.value));
    expect(others(timed)).toEqual(others(bare));
  });

  it('앞 Cycle 의 봉투(그 자리가 없는 것)에서는 아무 마디도 서지 않는다', () => {
    // 모르는 것을 닫힘으로 읽지 않는다 — event 도 open 도 실려 오지 않으면 C036 의 줄이다
    const old = made([
      harvest(SCALE.id, {
        opportunity: { id: SCALE_OPPORTUNITY, discovery: SIGNAL } as unknown as Opportunity,
      }),
    ]);
    expect(offerLines(point(old, SCALE.id))).toEqual([`채취 · ${SIGNAL_TEXT}`]);
  });
});

// ── ③ 문구 하나 (spec SPEC-004 · World Change 6) ──────────────────────

describe('C037 지금은 없다의 문구', () => {
  it('코드가 사람의 말이 된다 — 게임 안쪽의 말이 섞이지 않는다', () => {
    const text = codeText('opportunity.closed');
    expect(text).toBe(CLOSED_TEXT);
    expect(text).not.toContain('기회');
    expect(text).not.toContain('Event');
    expect(text).not.toContain('open');
  });

  it('때를 말하지 않는다 — 언제까지도 무엇이 여는지도 그 말에 없다', () => {
    const text = codeText('opportunity.closed');
    for (const forbidden of [...FORBIDDEN, '아직', '다시']) expect(text).not.toContain(forbidden);
  });

  it('거절 사유들과 다른 말이다 — 나란히 서도 사유의 하나로 읽히지 않는다', () => {
    for (const reason of ['condition-unmet', 'source-depleted', 'source-recovering']) {
      expect(codeText('opportunity.closed')).not.toBe(codeText(reason));
    }
  });
});

// ── ④ 판의 「기억」 줄에 태어남 한 마디 (spec SPEC-007) ────────────────

describe('C037 방의 기억이 태어난 것도 센다', () => {
  const clutchText = codeText(ROOT_CLUTCH);
  const whaleText = codeText(SKY_WHALE);

  it('태어난 적 있으면 그 마디가 「기억」 줄 끝에 선다 — 지나감과 같은 어법이다', () => {
    const scene = here(
      made([], {
        turns: 2,
        awakenings: { times: 0 },
        passages: [{ presence: SKY_WHALE, times: 3, lastAt: 100 }],
        births: [{ formation: ROOT_CLUTCH, times: 1, lastAt: 250 }],
      }),
    );
    expect(memoryLine(scene)).toBe(
      [
        codeText('memory.turns', '2'),
        `${whaleText} ${codeText('memory.passage', '3')} ${codeText('memory.passage-last', codeText('ago.seconds', '300'))}`,
        `${clutchText} ${codeText('memory.birth', '1')} ${codeText('memory.birth-last', codeText('ago.seconds', '150'))}`,
      ].join(' · '),
    );
  });

  it('태어난 적 없으면 그 마디가 없다 — 0 을 말하지 않는다', () => {
    const scene = here(
      made([], { turns: 1, awakenings: { times: 0 }, passages: [], births: [] }),
    );
    const line = memoryLine(scene);
    expect(line).toBe(codeText('memory.turns', '1'));
    expect(line).not.toContain(clutchText);
  });

  it('셈이 0 인 자리도 마디가 되지 않는다 (실려 와도 말하지 않는다)', () => {
    const scene = here(
      made([], {
        turns: 1,
        awakenings: { times: 0 },
        passages: [],
        births: [{ formation: ROOT_CLUTCH, times: 0 }],
      }),
    );
    expect(memoryLine(scene)).toBe(codeText('memory.turns', '1'));
  });

  it('태어남만 있으면 그 마디 하나로 줄이 선다 — 줄이 늘지는 않는다', () => {
    const scene = here(
      made([], {
        turns: 0,
        awakenings: { times: 0 },
        passages: [],
        births: [{ formation: ROOT_CLUTCH, times: 2, lastAt: 400 }],
      }),
    );
    expect(memoryLine(scene)).toBe(
      `${clutchText} ${codeText('memory.birth', '2')} ${codeText('memory.birth-last', codeText('ago.seconds', '0'))}`,
    );
    // 「기억」 줄은 여전히 하나다 (마디를 늘리되 줄을 늘리지 않는다 — 판이 몸을 가린다는 부채)
    expect(frameOf(scene).rows.filter((row) => row.id === 'place.memory')).toHaveLength(1);
  });

  it('나이를 잴 수 없으면 그 괄호만 서지 않는다 — 몇 번 태어났는지는 그대로다', () => {
    const scene = here(
      made([], {
        turns: 0,
        awakenings: { times: 0 },
        passages: [],
        births: [{ formation: ROOT_CLUTCH, times: 1 }],
      }),
    );
    expect(memoryLine(scene)).toBe(`${clutchText} ${codeText('memory.birth', '1')}`);
  });

  it('누가 태어났는지도 언제 다시 태어나는지도 말하지 않는다', () => {
    const scene = here(
      made([], {
        turns: 0,
        awakenings: { times: 0 },
        passages: [],
        births: [{ formation: ROOT_CLUTCH, times: 1, lastAt: 200 }],
      }),
    );
    const text = frameText(scene);
    // 세계의 코드 글자가 판에 서지 않는다 (사람의 말이 된 뒤에만 오른다)
    expect(text).not.toContain(ROOT_CLUTCH);
    for (const forbidden of ['다시', '곧', '예정']) expect(text).not.toContain(forbidden);
  });
});
