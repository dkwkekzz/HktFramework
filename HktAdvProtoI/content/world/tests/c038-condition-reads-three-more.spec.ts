// 단위 — **조건의 읽기가 형만큼 넓어진다** (C038 W · spec SPEC-002 ~ SPEC-005).
//
// C035 가 형을 여덟으로 세우고 읽기를 다섯만 열었다 (clock · region · source · route · history).
// 나머지 셋(connector · area · process)은 막힌 것이 아니라 **미개통**이었고, 이 Cycle 이 그것을
// 연다 — 세계가 이미 값을 아는 것만. 그래서 여기서 재는 것은 다섯이다.
//   ① 문 — 조건의 답이 `isConnectorOpen` 과 **모든 철 · 모든 패턴에서** 같은가 (SPEC-002)
//   ② 자락 — 위상이 거는 셋(깊이 · 위험 · 조건 자락)을 같은 잣대로 보는가 · 걸지 않으면 **거짓**인가 (SPEC-003)
//   ③ 되돌아옴 — 마디와 진행이 `sourceStateOf` 그대로인가 (SPEC-004)
//   ④ 모르는 이름은 갈래마다 여전히 **판정 불가**인가 (없는 것과 모르는 것은 다르다 · C035 규율)
//   ⑤ 어휘가 그 셋을 함께 열어 ㊹ 이 그 잎을 통과시키고, 어긋난 경로는 여전히 걸리는가 ·
//      **㊹ 의 답이 한 값도 달라지지 않는가** (SPEC-005 경계)
//
// 이름을 손으로 적지 않는다 — 시험이 무엇을 재는지는 이름이 아니라 데이터에서 유도한다
// (그 자락이 어느 방의 것인지 바뀌어도 이 시험은 같은 것을 잰다).

import { describe, expect, it } from 'vitest';
import {
  conditionLeaves,
  type Condition,
  type ConditionLeaf,
  type ConditionVerdict,
} from '../../../engine/world-authoring/condition';
import {
  CONDITION_ITEM,
  checkRegions,
  type CheckConditionSite,
  type CheckRegionsInput,
} from '../../../engine/world-authoring/check';
import { worldCheckInput } from '../../../tools/world-editor/check';
import { PRESENCE_ROUTES, REGION_GRAPH, REGION_SPECS, type RegionPhase } from '../../regions';
import {
  worldConditionSites,
  worldConditionVerdict,
  worldConditionVocabulary,
} from '../semantic/condition';
import { isConnectorOpen } from '../semantic/region';
import { findResourceSource, sourceStateOf } from '../semantic/resource';
import type { WorldState } from '../semantic/world-state';
import { driveWorld } from './drive';

/** 이 Cycle 이 여는 세 갈래 */
const OPENED_KINDS = ['connector', 'area', 'process'] as const;
/** 철 넷 — 세계 손잡이가 받는 그 글자 (시계가 소유한다) */
const SEASONS = ['STILL', 'SEEP', 'LONG_NIGHT', 'TURN'] as const;

type Setup = Parameters<typeof driveWorld>[0];

const worldState = (setup: Setup = {}): WorldState =>
  driveWorld(setup).world.snapshot().state as WorldState;

// ── 잎을 짓는 자리 (형은 기반의 것이고 글자는 어휘의 것이다) ──────────
const connectorLeaf = (ref: string, path = 'open'): ConditionLeaf => ({
  target: { kind: 'connector', ref },
  query: { kind: 'state', path },
  operator: '==',
  value: true,
});
const areaLeaf = (ref: string, path = 'active'): ConditionLeaf => ({
  target: { kind: 'area', ref },
  query: { kind: 'state', path },
  operator: '==',
  value: true,
});
const processPhaseLeaf = (ref: string, phase: string, path = 'phase'): ConditionLeaf => ({
  target: { kind: 'process', ref },
  query: { kind: 'state', path },
  operator: '==',
  value: phase,
});
const processProgressLeaf = (ref: string, value: number, path = 'progress'): ConditionLeaf => ({
  target: { kind: 'process', ref },
  query: { kind: 'property', path },
  operator: '==',
  value,
});

const verdict = (s: WorldState, condition: Condition): ConditionVerdict =>
  worldConditionVerdict(s, condition);

// ── 데이터에서 유도하는 것 (이름을 손으로 적지 않는다) ────────────────

/** 그 위상이 **이름으로 거는** 자락들 — 깊이 · 위험 · 조건 자락(outflow) 셋 */
function hungBy(phase: RegionPhase | undefined): string[] {
  if (!phase) return [];
  return [
    ...(phase.depthOverlay ?? []).map((entry) => entry.areaId),
    ...(phase.hazardExtend ?? []).map((entry) => entry.areaId),
    ...(phase.outflow ?? []).map((entry) => entry.areaId),
  ];
}

/** 늘 서 있는 위상이 거는 자락들 — 어느 철에도 걸려 있다 */
const standingAreaIds = (): string[] =>
  REGION_SPECS.flatMap((spec) => hungBy(spec.phases?.standing));

/** 그 철의 위상이 거는 자락들 (상시가 이미 거는 것은 뺀다 — 철에 따라 갈리는 것만 남긴다) */
function seasonOnlyAreaIds(season: string): string[] {
  const standing = new Set(standingAreaIds());
  return REGION_SPECS.flatMap((spec) =>
    hungBy(spec.phases?.seasons?.[season as keyof NonNullable<typeof spec.phases>['seasons']]),
  ).filter((id) => !standing.has(id));
}

/** 어느 방의 어느 위상도 이름으로 걸지 않는 자락들 — 세계에 있으나 걸리지 않는다 */
function neverHungAreaIds(): string[] {
  const hung = new Set(
    REGION_SPECS.flatMap((spec) => {
      const phases = spec.phases;
      if (!phases) return [];
      return [
        ...hungBy(phases.standing),
        ...hungBy(phases.awake),
        ...Object.values(phases.seasons ?? {}).flatMap((phase) => hungBy(phase)),
      ];
    }),
  );
  // 지나는 것 · 깨진 마디가 거는 것도 뺀다 — 그것들도 자락을 이름으로 건다
  for (const route of PRESENCE_ROUTES) {
    for (const hazard of route.effectWhilePassing?.hazardExtend ?? []) hung.add(hazard.areaId);
  }
  const ids: string[] = [];
  for (const spec of REGION_SPECS) {
    for (const overlay of spec.resourceEcology?.sources ?? []) {
      for (const hazard of overlay.depletedHazards ?? []) hung.add(hazard.areaId);
    }
    for (const op of spec.space.ops) {
      if (op.kind !== 'area' || hung.has(op.id) || ids.includes(op.id)) continue;
      ids.push(op.id);
    }
  }
  return ids;
}

/** 이 세계가 밝힌 자락 전부 — 어휘가 여는 그 목록과 견줄 잣대 */
function worldAreaIds(): string[] {
  const ids: string[] = [];
  for (const spec of REGION_SPECS) {
    for (const op of spec.space.ops) {
      if (op.kind !== 'area' || ids.includes(op.id)) continue;
      ids.push(op.id);
    }
  }
  return ids;
}

const connectorIds = (): string[] => REGION_GRAPH.connectors.map((connector) => connector.id);
const sourceIds = (): readonly string[] => worldConditionVocabulary().targets.source ?? [];
/** 규칙을 품은 방이 설 수 있는 패턴들 — 문의 배열 요구가 그것을 읽는다 */
const ruleRooms = (): { region: string; patterns: string[] }[] =>
  REGION_SPECS.filter((spec) => spec.rule).map((spec) => ({
    region: spec.id,
    patterns: spec.rule!.patterns.map((pattern) => pattern.name),
  }));

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-002 — 조건이 문을 읽는다 (판정은 isConnectorOpen 하나가 낸다)', () => {
  it('U-1 모든 철 · 모든 패턴에서 문 전부의 답이 isConnectorOpen 과 같다', () => {
    const setups: Setup[] = [];
    for (const clock of SEASONS) {
      setups.push({ clock });
      for (const room of ruleRooms()) {
        for (const pattern of room.patterns) {
          setups.push({ clock, regionPatterns: { [room.region]: pattern } });
        }
      }
    }
    const mismatches: string[] = [];
    for (const setup of setups) {
      const s = worldState(setup);
      for (const id of connectorIds()) {
        const open = isConnectorOpen(s.regionStates, id, s.time);
        const judged = verdict(s, connectorLeaf(id));
        if (judged !== (open ? 'met' : 'unmet')) {
          mismatches.push(`${JSON.stringify(setup)} ${id} — 판정 ${String(open)} / 조건 ${judged}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('U-2 참과 거짓이 실제로 둘 다 난다 — 어느 철엔가 열리고 어느 철엔가 닫히는 문이 있다', () => {
    const byId = new Map<string, Set<ConditionVerdict>>();
    for (const clock of SEASONS) {
      const s = worldState({ clock });
      for (const id of connectorIds()) {
        const set = byId.get(id) ?? new Set<ConditionVerdict>();
        set.add(verdict(s, connectorLeaf(id)));
        byId.set(id, set);
      }
    }
    const seen = [...byId.values()].flatMap((set) => [...set]);
    expect(seen).toContain('met');
    expect(seen).toContain('unmet');
    // 판정 불가는 하나도 없다 — 세계가 아는 문은 전부 읽힌다
    expect(seen).not.toContain('undecidable');
  });

  it('U-3 세계가 모르는 문 · 어휘 밖 경로는 판정 불가다 (닫혔다고 말하지 않는다)', () => {
    const s = worldState();
    expect(verdict(s, connectorLeaf('NO_SUCH_CONNECTOR'))).toBe('undecidable');
    expect(verdict(s, connectorLeaf(connectorIds()[0]!, 'opened'))).toBe('undecidable');
    expect(
      verdict(s, {
        target: { kind: 'connector', ref: connectorIds()[0]! },
        query: { kind: 'property', path: 'open' },
        operator: '==',
        value: true,
      }),
    ).toBe('undecidable');
    // ref 를 밝히지 않은 문도 판정 불가다 (세계에 하나뿐인 것이 아니다)
    expect(
      verdict(s, { target: { kind: 'connector' }, query: { kind: 'state', path: 'open' }, operator: '==', value: true }),
    ).toBe('undecidable');
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-003 — 조건이 자락을 읽는다 (거는 자리 셋을 같은 잣대로)', () => {
  it('U-4 늘 서 있는 위상이 건 자락은 어느 철에도 참이다', () => {
    const ids = standingAreaIds();
    expect(ids.length).toBeGreaterThan(0);
    for (const clock of SEASONS) {
      const s = worldState({ clock });
      for (const id of ids) expect({ clock, id, v: verdict(s, areaLeaf(id)) }).toEqual({ clock, id, v: 'met' });
    }
  });

  it('U-5 철의 위상이 건 자락은 그 철에만 참이다 (깊이 · 위험 · 조건 자락 모두)', () => {
    let measured = 0;
    for (const season of SEASONS) {
      const ids = seasonOnlyAreaIds(season);
      if (ids.length === 0) continue;
      const atSeason = worldState({ clock: season });
      for (const id of ids) {
        expect({ season, id, v: verdict(atSeason, areaLeaf(id)) }).toEqual({ season, id, v: 'met' });
        measured++;
      }
      // 그 자락을 아무 철도 걸지 않는 때가 하나라도 있으면 거기서는 거짓이다
      for (const other of SEASONS) {
        if (other === season) continue;
        const s = worldState({ clock: other });
        for (const id of ids) {
          if (seasonOnlyAreaIds(other).includes(id)) continue;
          expect({ other, id, v: verdict(s, areaLeaf(id)) }).toEqual({ other, id, v: 'unmet' });
        }
      }
    }
    expect(measured).toBeGreaterThan(0);
  });

  it('U-6 남의 방에 거는 조건 자락도 같은 잣대로 읽힌다 (outflow · 방을 넘는다)', () => {
    const outflows = REGION_SPECS.flatMap((spec) =>
      Object.entries(spec.phases?.seasons ?? {}).flatMap(([season, phase]) =>
        (phase.outflow ?? []).map((entry) => ({ from: spec.id, season, entry })),
      ),
    );
    expect(outflows.length).toBeGreaterThan(0);
    for (const { from, season, entry } of outflows) {
      // 가리켜진 자락은 **남의 방**의 것이다 — 그런데도 같은 한 잎이 답한다
      expect(entry.region).not.toBe(from);
      expect(verdict(worldState({ clock: season }), areaLeaf(entry.areaId))).toBe('met');
    }
  });

  it('U-7 깨어난 방의 위상이 건 자락도 걸린 것으로 읽힌다', () => {
    const awake = REGION_SPECS.filter((spec) => hungBy(spec.phases?.awake).length > 0);
    expect(awake.length).toBeGreaterThan(0);
    for (const spec of awake) {
      const dormant = worldState({});
      const awakened = worldState({ disturbances: { [spec.id]: 9999 } });
      expect(awakened.regionStates[spec.id]?.disturbance.phase).toBe('awake');
      for (const id of hungBy(spec.phases?.awake)) {
        expect({ id, v: verdict(awakened, areaLeaf(id)) }).toEqual({ id, v: 'met' });
        // 잠들어 있고 다른 위상도 걸지 않는 자락은 거짓이다 (모른다가 아니다)
        if (verdict(dormant, areaLeaf(id)) !== 'met') {
          expect({ id, v: verdict(dormant, areaLeaf(id)) }).toEqual({ id, v: 'unmet' });
        }
      }
    }
  });

  it('U-8 지나는 것이 건 자락도 같은 잣대로 걸린다 (원인이 방 밖에 있어도)', () => {
    const routes = PRESENCE_ROUTES.filter(
      (route) => (route.effectWhilePassing?.hazardExtend ?? []).length > 0,
    );
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      const passing = worldState({ presences: [route.id] });
      for (const hazard of route.effectWhilePassing?.hazardExtend ?? []) {
        expect({ id: hazard.areaId, v: verdict(passing, areaLeaf(hazard.areaId)) }).toEqual({
          id: hazard.areaId,
          v: 'met',
        });
      }
    }
  });

  it('U-9 어느 위상도 걸지 않는 자락은 **거짓**이다 — 세계에 있고 걸려 있지 않을 뿐이다', () => {
    const ids = neverHungAreaIds();
    expect(ids.length).toBeGreaterThan(0);
    for (const clock of SEASONS) {
      const s = worldState({ clock });
      for (const id of ids) expect({ clock, id, v: verdict(s, areaLeaf(id)) }).toEqual({ clock, id, v: 'unmet' });
    }
  });

  it('U-10 세계가 모르는 자락 · 어휘 밖 경로는 판정 불가다', () => {
    const s = worldState();
    expect(verdict(s, areaLeaf('no-such-area'))).toBe('undecidable');
    expect(verdict(s, areaLeaf(worldAreaIds()[0]!, 'hung'))).toBe('undecidable');
    expect(
      verdict(s, { target: { kind: 'area' }, query: { kind: 'state', path: 'active' }, operator: '==', value: true }),
    ).toBe('undecidable');
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-004 — 조건이 되돌아옴을 읽는다 (원천의 과정)', () => {
  it('U-11 마디와 진행이 sourceStateOf 그대로다 — 원천 전부 · 갓 선 세계와 되돌아오는 세계에서', () => {
    const recovering = sourceIds()[0]!;
    for (const setup of [{}, { sourcePhases: { [recovering]: 'recovering' } }]) {
      const s = worldState(setup as Setup);
      for (const id of sourceIds()) {
        const source = findResourceSource(id)!;
        const now = sourceStateOf(s.regionStates, source.regionId, source.id);
        expect({ id, v: verdict(s, processPhaseLeaf(id, now.phase)) }).toEqual({ id, v: 'met' });
        expect({ id, v: verdict(s, processProgressLeaf(id, now.progress)) }).toEqual({ id, v: 'met' });
      }
    }
  });

  it('U-12 참과 거짓이 둘 다 난다 — 되돌아오는 원천의 마디는 그 마디이고 다른 마디가 아니다', () => {
    const id = sourceIds()[0]!;
    const s = worldState({ sourcePhases: { [id]: 'recovering' } } as Setup);
    const source = findResourceSource(id)!;
    const now = sourceStateOf(s.regionStates, source.regionId, source.id);
    expect(now.phase).toBe('recovering');
    expect(verdict(s, processPhaseLeaf(id, 'recovering'))).toBe('met');
    expect(verdict(s, processPhaseLeaf(id, 'available'))).toBe('unmet');
  });

  it('U-13 세계가 모르는 원천 · 어긋난 경로는 판정 불가다', () => {
    const s = worldState();
    const id = sourceIds()[0]!;
    expect(verdict(s, processPhaseLeaf('NO_SUCH_SOURCE', 'available'))).toBe('undecidable');
    expect(verdict(s, processPhaseLeaf(id, 'available', 'progress'))).toBe('undecidable');
    expect(verdict(s, processProgressLeaf(id, 0, 'phase'))).toBe('undecidable');
    expect(
      verdict(s, { target: { kind: 'process' }, query: { kind: 'state', path: 'phase' }, operator: '==', value: 'available' }),
    ).toBe('undecidable');
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-005 — 어휘가 함께 넓어진다 (㊹ 이 그 잎을 잰다)', () => {
  const vocabulary = worldConditionVocabulary();

  it('U-14 어휘가 세 갈래의 targets 를 연다 — 자락 전부 · 문 전부 · 원천 전부', () => {
    expect(vocabulary.targets.area).toEqual(worldAreaIds());
    expect(vocabulary.targets.connector).toEqual(connectorIds());
    // 되돌아옴은 원천의 과정이므로 목록이 원천과 같은 한 벌이다 (두 벌로 세지 않는다)
    expect(vocabulary.targets.process).toEqual(vocabulary.targets.source);
    expect((vocabulary.targets.area ?? []).length).toBeGreaterThan(0);
    expect((vocabulary.targets.process ?? []).length).toBeGreaterThan(0);
  });

  it('U-15 어휘가 허용하는 경로는 읽기가 여는 그 넷뿐이다', () => {
    const paths = (target: string, query: string): readonly string[] | undefined =>
      vocabulary.queries.find((rule) => rule.target === target && rule.query === query)?.paths;
    expect(paths('area', 'state')).toEqual(['active']);
    expect(paths('connector', 'state')).toEqual(['open']);
    expect(paths('process', 'state')).toEqual(['phase']);
    expect(paths('process', 'property')).toEqual(['progress']);
  });

  it('U-16 ㊹ 이 세 갈래의 잎을 통과시킨다 (전에는 어휘 밖이라 걸렸다)', () => {
    const site: CheckConditionSite = {
      where: 'c038:opened',
      condition: {
        all: [
          connectorLeaf(connectorIds()[0]!),
          areaLeaf(worldAreaIds()[0]!),
          processPhaseLeaf(sourceIds()[0]!, 'available'),
          processProgressLeaf(sourceIds()[0]!, 0),
        ],
      },
    };
    const item = conditionItemOf(withSite(site));
    expect(item.status).toBe('pass');
    expect(item.refs).toEqual([]);
  });

  it('U-17 어긋난 경로 · 모르는 이름은 여전히 걸린다', () => {
    for (const leaf of [
      connectorLeaf(connectorIds()[0]!, 'opened'),
      areaLeaf('no-such-area'),
      processPhaseLeaf('NO_SUCH_SOURCE', 'available'),
      processProgressLeaf(sourceIds()[0]!, 0, 'phase'),
    ]) {
      const item = conditionItemOf(withSite({ where: 'c038:ghost', condition: leaf }));
      expect({ leaf, status: item.status }).toEqual({ leaf, status: 'fail' });
      expect(item.refs.map((ref) => ref.where)).toContain('c038:ghost');
    }
  });

  it('U-18 ㊹ 의 답이 한 값도 달라지지 않는다 — 자리 30 · 잎 31 · 걸린 것 0', () => {
    const item = conditionItemOf(worldCheckInput());
    expect(item.status).toBe('pass');
    expect(item.answer).toBe('자리 30 · 잎 31 · 걸린 것 0');
  });

  it('U-19 지금 데이터에는 이 세 갈래의 조건이 하나도 없다 — 그래서 기존 판정이 닿지 않는다', () => {
    const kinds = worldConditionSites()
      .flatMap((site) => conditionLeaves(site.condition))
      .map((leaf) => leaf.target.kind);
    for (const kind of OPENED_KINDS) expect({ kind, listed: kinds.includes(kind) }).toEqual({ kind, listed: false });
  });
});

// ── 검사를 부르는 자리 ────────────────────────────────────────────────

/** 검사의 입력에 자리 하나를 더한다 — 세계의 데이터는 한 글자도 손대지 않는다 (c035 의 어법) */
function withSite(site: CheckConditionSite): CheckRegionsInput {
  const input = worldCheckInput();
  if (!input.condition) throw new Error('worldCheckInput 이 조건 쪽 계약을 주지 않는다');
  return { ...input, condition: { ...input.condition, sites: [...input.condition.sites, site] } };
}

function conditionItemOf(input: CheckRegionsInput) {
  const item = checkRegions(input).items.find((it) => it.id === CONDITION_ITEM.id);
  if (!item) throw new Error('보고에 ㊹ 이 없다');
  return item;
}
