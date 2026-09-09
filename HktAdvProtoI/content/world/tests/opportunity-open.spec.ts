// 단위 — **때가 있는 기회**(Event 데이터) · **열림의 유도**(RULE-OPPORTUNITY-OPEN-001) ·
// **방이 태어난 것을 센다**(births) (C037 W · spec SPEC-001 ~ SPEC-003 · SPEC-005 ~ SPEC-007).
//
// 시나리오(플레이가 실제로 그렇게 되는가)는 따로 있다. 여기서 재는 것은 넷이다 —
//   ① 데이터가 기본형을 덮되 **달라지는 것이 둘뿐**인가 (availability · outcomes)
//   ② 열림의 판정 셋 (참 → 열림 · 거짓 → 닫힘 · 판정 불가 → 열지 않음)
//   ③ **열림의 답이 원천의 phase 판정과 같은가** (SPEC-002 — 실측이고, 갈리면 그 자리를 적는다)
//   ④ 태어남의 셈 — 오르는 자리 하나 · 되살려도 남음 · 옛 스냅샷에 그 자리가 없어도 섬
//
// 세계 없이 잴 수 있는 것은 세계 없이 잰다 (①). ② ③ ④ 는 세계가 필요하다.

import { describe, expect, it } from 'vitest';
import {
  isEventOpportunity,
  type Opportunity,
} from '../../../engine/world-authoring/opportunity';
import {
  ALL_OPPORTUNITIES,
  DEFERRED_YIELD_KINDS,
  FOREST_EDGE,
  OPPORTUNITY_YIELD_TABLE,
  RED_EYE_TREE,
  SKY_WHALE_ROUTE,
  gatherOpportunityId,
  opportunitiesOf,
  passageLastAtPath,
  sourceTakenTotalPath,
  timedGatherOpportunity,
  type ResourceSourceSpec,
} from '../../regions';
import { isOpportunityOpen, opportunityStanding } from '../semantic/opportunity-open';
import { initialMemory, remember, type RegionState } from '../semantic/region-state';
import { PERSISTENCE_TABLE } from '../semantic/persistence';
import { sourceStateOf, sourcesInRegion } from '../semantic/resource';
import type { WorldState } from '../semantic/world-state';
import { createWorld, restoreWorld, type WorldSetup } from '../index';
import { driveWorld, OBSERVER, type WorldDriver } from './drive';

const SCALE = 'FALLEN_SCALE';
const PREY = 'PREY_REMAINS';
/** 눈 없는 것의 경로 — 먹이 잔해를 두고 간다 */
const HUNTER_ROUTE = 'BLIND_HUNTER_ROUTE';

const state = (w: WorldDriver): WorldState => w.world.snapshot().state as WorldState;

const opportunityOf = (region: string, id: string): Opportunity =>
  opportunitiesOf(region).find((it) => it.id === id)!;

const scaleOpportunity = (): Opportunity => opportunityOf(FOREST_EDGE, gatherOpportunityId(SCALE));
const preyOpportunity = (): Opportunity => opportunityOf(FOREST_EDGE, gatherOpportunityId(PREY));

const sourceSpec = (id: string): ResourceSourceSpec =>
  sourcesInRegion(FOREST_EDGE).find((source) => source.id === id) as unknown as ResourceSourceSpec;

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-001 · SPEC-005 — Event 의 데이터 (데이터가 기본형을 덮되 둘만 달라진다)', () => {
  it('U-021 비늘의 availability 는 [기억 조건, 그 경로의 lastAt WITHIN 240] 이다', () => {
    expect(scaleOpportunity().availability).toEqual({
      all: [
        {
          target: { kind: 'history', ref: FOREST_EDGE },
          query: { kind: 'history', path: `passages.${SKY_WHALE_ROUTE.id}` },
          operator: 'EXISTS',
        },
        {
          target: { kind: 'history', ref: FOREST_EDGE },
          query: { kind: 'history', path: passageLastAtPath(SKY_WHALE_ROUTE.id) },
          operator: 'EXISTS',
          qualifier: { kind: 'time', mode: 'WITHIN', seconds: 240 },
        },
        // Human 판정 (C037) — 지금 그 자리에 **서 있는가**. 이 잎이 없으면 판이 거짓말을 한다
        { target: { kind: 'source', ref: SCALE }, query: { kind: 'state', path: 'phase' }, operator: '==', value: 'available' },
      ],
    });
  });

  it('U-022 먹이 잔해는 C036 이 짓는 조건이 없으므로 시간 잎과 서 있음 둘이 availability 전부다', () => {
    expect(preyOpportunity().availability).toEqual({
      all: [
        {
          target: { kind: 'history', ref: FOREST_EDGE },
          query: { kind: 'history', path: passageLastAtPath(HUNTER_ROUTE) },
          operator: 'EXISTS',
          qualifier: { kind: 'time', mode: 'WITHIN', seconds: 240 },
        },
        { target: { kind: 'source', ref: PREY }, query: { kind: 'state', path: 'phase' }, operator: '==', value: 'available' },
      ],
    });
  });

  it('U-023 WITHIN 의 초는 그 원천의 recoverySeconds 그대로다 (새 값을 짓지 않는다)', () => {
    for (const [id, opportunity] of [
      [SCALE, scaleOpportunity()],
      [PREY, preyOpportunity()],
    ] as const) {
      const seconds = JSON.stringify(opportunity.availability).match(/"seconds":(\d+)/)?.[1];
      expect({ id, seconds: Number(seconds) }).toEqual({
        id,
        seconds: sourceSpec(id).recoverySeconds,
      });
    }
  });

  it('U-024 outcomes 는 world 둘(phase 옮김 · 소유 넘김) · yield 둘(재료 · 세계에의 영향)이다', () => {
    expect(scaleOpportunity().outcomes).toEqual({
      world: [
        { group: 'entity', op: 'CHANGE_STATE', ref: SCALE },
        { group: 'ownership', op: 'GRANT', ref: sourceSpec(SCALE).materialId },
      ],
      yield: ['Material', 'WorldInfluence'],
    });
    expect(preyOpportunity().outcomes.yield).toEqual(['Material', 'WorldInfluence']);
  });

  it('U-025 (경계) 덮어쓰기가 나머지 항목을 한 값도 바꾸지 않는다 — 자리도 차례도 그대로다', () => {
    for (const [id, opportunity] of [
      [SCALE, scaleOpportunity()],
      [PREY, preyOpportunity()],
    ] as const) {
      const source = sourceSpec(id);
      expect({
        id: opportunity.id,
        region: opportunity.region,
        discovery: opportunity.discovery,
        target: opportunity.target,
        actions: opportunity.possibleActions,
        progress: opportunity.progress,
      }).toEqual({
        id: gatherOpportunityId(id),
        region: FOREST_EDGE,
        // 비늘은 world-event(SIGNAL) · 먹이 잔해는 by-product(TRACE) — 기본형의 표 그대로
        discovery: source.opportunity === 'world-event' ? 'SIGNAL' : 'TRACE',
        target: { kind: 'source', ref: id },
        actions: ['gather'],
        progress: { kind: 'counter', ref: sourceTakenTotalPath(id) },
      });
    }
    // 차례도 그대로다 — 덮은 기회가 유도된 그 자리에 선다 (뒤에 붙지 않는다)
    const ids = opportunitiesOf(FOREST_EDGE).map((it) => it.id);
    expect(ids.indexOf(gatherOpportunityId(SCALE))).toBeLessThan(
      ids.indexOf(gatherOpportunityId(PREY)),
    );
  });

  it('U-026 이 세계의 Event 는 둘뿐이다 — 나머지 기회에는 시간 qualifier 가 없다', () => {
    const events = ALL_OPPORTUNITIES.filter(isEventOpportunity).map((it) => it.id);
    expect(events).toEqual([gatherOpportunityId(SCALE), gatherOpportunityId(PREY)]);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-006 — Yield 표는 열 열넷이고 뒤 열은 0 이다', () => {
  it('U-027 열이 열넷이고 차례는 앞 넷 · 뒤 열이다', () => {
    expect(OPPORTUNITY_YIELD_TABLE.map((column) => column.kind)).toEqual([
      'Material',
      'Access',
      'Discovery',
      'WorldInfluence',
      ...DEFERRED_YIELD_KINDS,
    ]);
    expect(OPPORTUNITY_YIELD_TABLE.length).toBe(14);
  });

  it('U-028 앞 넷만 이 층의 열이고, 뒤 열은 값이 0 인 채로 서 있는다', () => {
    for (const column of OPPORTUNITY_YIELD_TABLE) {
      expect({ kind: column.kind, standing: column.standing, zero: column.count === 0 }).toEqual({
        kind: column.kind,
        standing: column.standing,
        // 뒤 열은 언제나 0 · 앞 넷은 지금 세계가 실제로 내는 만큼이다 (0 일 수도 있다)
        zero: column.standing ? column.count === 0 : true,
      });
    }
    expect(OPPORTUNITY_YIELD_TABLE.filter((column) => column.standing).length).toBe(4);
  });

  it('U-029 표의 셈은 지금 선 기회를 센 것이다 — 재료는 채집만큼 · 세계에의 영향은 Event 둘', () => {
    const count = (kind: string): number =>
      ALL_OPPORTUNITIES.filter((it) => (it.outcomes.yield as readonly string[]).includes(kind))
        .length;
    for (const column of OPPORTUNITY_YIELD_TABLE) {
      expect({ kind: column.kind, count: column.count }).toEqual({
        kind: column.kind,
        count: count(column.kind),
      });
    }
    expect(OPPORTUNITY_YIELD_TABLE.find((c) => c.kind === 'WorldInfluence')?.count).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('RULE-OPPORTUNITY-OPEN-001 — 판정 셋 (SPEC-003)', () => {
  const anyWorld = (): WorldDriver => driveWorld({});

  it('U-030 availability 를 밝히지 않은 기회는 늘 열려 있다', () => {
    const w = anyWorld();
    const always: Opportunity = {
      id: 'x',
      region: FOREST_EDGE,
      discovery: 'TRACE',
      target: { kind: 'source', ref: 'X' },
      possibleActions: ['gather'],
      progress: { kind: 'none' },
      outcomes: { world: [], yield: [] },
    };
    expect(isOpportunityOpen(state(w), always)).toBe(true);
  });

  it('U-031 참이면 열리고 거짓이면 닫힌다 — 갓 선 세계의 비늘은 닫혀 있다 (경계 ①)', () => {
    const w = anyWorld();
    // 한 번도 지나지 않았으므로 기억 조건이 거짓이다
    expect(isOpportunityOpen(state(w), scaleOpportunity())).toBe(false);
    expect(isOpportunityOpen(state(w), preyOpportunity())).toBe(false);
  });

  it('U-032 판정 불가는 **열지 않는다** — 문의 요구(성질·앎)를 묻는 기회가 그것이다', () => {
    const w = anyWorld();
    const undecidable: Opportunity = {
      id: 'y',
      region: FOREST_EDGE,
      // actor 를 묻는 잎 — 2층의 평가기가 판정 불가를 낸다 (거짓이 아니다)
      availability: {
        target: { kind: 'actor' },
        query: { kind: 'capability', path: 'anything' },
        operator: 'EXISTS',
      },
      discovery: 'VISIBLE',
      target: { kind: 'connector', ref: 'Z' },
      possibleActions: ['cross'],
      progress: { kind: 'none' },
      outcomes: { world: [], yield: ['Access'] },
    };
    expect(isOpportunityOpen(state(w), undecidable)).toBe(false);
    // 그리고 그것은 Event 가 아니다 — 「지금은 없다」 가 붙을 자리가 아니다 (SPEC-003 경계)
    expect(opportunityStanding(state(w), undecidable)).toEqual({ event: false, open: false });
  });

  it('U-033 열림은 저장되지 않는다 — 두 번 물어도 같고, State 에 자리가 나지 않는다', () => {
    const w = anyWorld();
    const before = JSON.stringify(state(w).regionStates[FOREST_EDGE]);
    const first = isOpportunityOpen(state(w), scaleOpportunity());
    const second = isOpportunityOpen(state(w), scaleOpportunity());
    expect(first).toBe(second);
    expect(JSON.stringify(state(w).regionStates[FOREST_EDGE])).toBe(before);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-002 — 열림의 답과 원천의 phase 판정 (실측)', () => {
  /**
   * 고래가 지나가는 세계를 세우고, 매 초 **열림**과 **캘 수 있는가**(phase === available)를
   * 나란히 잰다. 둘이 갈린 구간이 있으면 그 구간을 그대로 적는다 —
   * 값을 지어내 맞추지 않는다 (spec SPEC-002 는 "모든 때에 같다" 를 요구한다).
   */
  function walk(
    setup: WorldSetup,
    sourceId: string,
    opportunity: () => Opportunity,
    seconds: number,
  ): { at: number; open: boolean; minable: boolean }[] {
    const world = createWorld(setup);
    world.join(OBSERVER);
    world.tick(0);
    const rows: { at: number; open: boolean; minable: boolean }[] = [];
    for (let step = 0; step < seconds; step++) {
      world.tick(1);
      const s = world.snapshot().state as WorldState;
      rows.push({
        at: s.time,
        open: isOpportunityOpen(s, opportunity()),
        minable: sourceStateOf(s.regionStates, FOREST_EDGE, sourceId).phase === 'available',
      });
    }
    return rows;
  }

  /** 답이 달라지는 자리마다 한 줄 — `[그 시각부터] open/minable` (사실을 그대로 적는다) */
  function segments(rows: { at: number; open: boolean; minable: boolean }[]): string[] {
    const out: string[] = [];
    let current: string | undefined;
    for (const row of rows) {
      const line = `${row.at}: open=${row.open} minable=${row.minable}`;
      const shape = `${row.open}/${row.minable}`;
      if (current === shape) continue;
      current = shape;
      out.push(line);
    }
    return out;
  }

  it('U-034 비늘 — 열림과 캘 수 있음이 **언제나 같다** (Human 판정 뒤 · SPEC-002)', () => {
    const rows = walk({ presences: [SKY_WHALE_ROUTE.id] }, SCALE, scaleOpportunity, 400);
    // 고래가 드는 시각(45)에 기억이 오르지만 원천이 서는 것은 지나감이 **끝나는** 시각(180)이고,
    // 머무는 동안(240)이 지나면 RULE-PRESENCE-LEFT-FADE-001 이 그 자리를 거둔다.
    // 그래서 열려 있는 구간과 캘 수 있는 구간이 한 초도 갈리지 않는다.
    expect(segments(rows)).toEqual([
      '1: open=false minable=false',
      '181: open=true minable=true',
      '286: open=false minable=false',
    ]);
    expect({ splits: rows.filter((row) => row.open !== row.minable).length }).toEqual({ splits: 0 });
  });

  it('U-035 먹이 잔해 — 같은 잣대로 재도 한 초도 갈리지 않는다', () => {
    const rows = walk(
      { clock: 'LONG_NIGHT', presences: [HUNTER_ROUTE] },
      PREY,
      preyOpportunity,
      400,
    );
    expect(segments(rows)).toEqual([
      '1801: open=false minable=false',
      '1891: open=true minable=true',
      '2086: open=false minable=false',
    ]);
    expect({ splits: rows.filter((row) => row.open !== row.minable).length }).toEqual({ splits: 0 });
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-007 — 방이 태어난 것을 센다 (births)', () => {
  it('U-036 갓 선 방의 기억에는 births 자리가 있고 비어 있다', () => {
    expect(initialMemory().births).toEqual({});
  });

  it('U-037 셈을 올리는 자리는 remember 하나다 — 횟수가 오르고 시각이 적힌다', () => {
    const states: Record<string, RegionState> = {};
    remember(states, RED_EYE_TREE, 10, { kind: 'birth', formationId: 'A_SITE' });
    remember(states, RED_EYE_TREE, 25, { kind: 'birth', formationId: 'A_SITE' });
    expect(states[RED_EYE_TREE]!.history.births).toEqual({ A_SITE: { times: 2, lastAt: 25 } });
  });

  it('U-038 (경계 ②) 그 자리가 없는 옛 State 에도 셈이 0 에서 선다', () => {
    const states: Record<string, RegionState> = {
      [RED_EYE_TREE]: { disturbance: { value: 0, phase: 'dormant' }, history: initialMemory() },
    };
    // 옛 스냅샷에는 이 자리가 없다 (STATE_VERSION 을 올리지 않았다 · 기본형 ④)
    delete (states[RED_EYE_TREE]!.history as { births?: unknown }).births;
    remember(states, RED_EYE_TREE, 5, { kind: 'birth', formationId: 'A_SITE' });
    expect(states[RED_EYE_TREE]!.history.births).toEqual({ A_SITE: { times: 1, lastAt: 5 } });
  });

  it('U-039 (경계 ②) 되살린 세계가 그 자리 없이도 서고, 판이 빈 목록을 싣는다', () => {
    const base = driveWorld({});
    const snapshot = JSON.parse(JSON.stringify(base.world.snapshot()));
    for (const region of Object.values(
      (snapshot.state as WorldState).regionStates as Record<string, RegionState>,
    )) {
      delete (region.history as { births?: unknown }).births;
    }
    const restored = restoreWorld(snapshot);
    expect(restored).not.toBeNull();
    const world = createWorld({}, restored!);
    world.join(OBSERVER);
    world.tick(0);
    expect(world.latestObservation(OBSERVER)).toBeTruthy();
    const seen = world.latestObservation(OBSERVER) as unknown as {
      region: { memory: { births: unknown[] } };
    };
    expect(seen.region.memory.births).toEqual([]);
  });

  it('U-041 RULE-LIFE-BIRTH-001 이 태어남마다 그것을 부른다 — 되살려도 남는다', () => {
    // Given 갓 선 세계 (고요의 첫 낮 · 비가 온다 · 요구 넷이 다 차 있다)
    const w = driveWorld({});
    expect(state(w).regionStates[RED_EYE_TREE]?.history.births).toEqual({});
    // When 결속의 길이(60 초)가 지나 붉은 알집이 터진다
    for (let step = 0; step < 65; step++) w.tick(1);
    // Then 그 방의 셈이 하나 올랐고 시각이 적혔다
    const born = state(w).regionStates[RED_EYE_TREE]!.history.births['ROOT_CLUTCH'];
    expect(born?.times).toBe(1);
    expect(born?.lastAt).toBeGreaterThan(0);
    // And 되살려도 그대로다 (지워지지 않는 것 · SPEC-007 경계 ①)
    const restored = restoreWorld(JSON.parse(JSON.stringify(w.world.snapshot())));
    expect(
      (restored as WorldState).regionStates[RED_EYE_TREE]!.history.births['ROOT_CLUTCH'],
    ).toEqual(born);
  });

  it('U-040 수명 표에 그 경로가 서고 지워지지 않는 손을 진다', () => {
    const row = PERSISTENCE_TABLE.find((it) => it.path === 'region.history.births[]');
    expect(row).toEqual({ path: 'region.history.births[]', eraser: 'indelible' });
  });
});
