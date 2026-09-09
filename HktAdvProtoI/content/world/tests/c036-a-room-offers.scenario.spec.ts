// C036 — 방이 기회를 내민다 · 세계 쪽 검증 시나리오 (spec SPEC-001 ~ SPEC-008 + 회귀 SPEC-009)
//
// C035 까지 판의 「할 수 있는 것」 줄은 규칙이 그때그때 지은 것이었다 — 그 줄이 **어느 기회의
// 것인가**도, **어떻게 알게 되는 것인가**도 어디에도 없었다. 이 Cycle 이 그 둘에 이름을 준다.
// 그래서 재는 것은 여덟이다:
//   ① 형 — 기회 하나가 항목 여덟으로 적히고, 이 Cycle 의 데이터에는 판정 불가 갈래도 HIDDEN 도 없다
//   ② 채집 — 원천마다 `gather:<원천>` 하나가 **유도**된다 (id · region · availability · discovery ·
//      target · possibleActions · progress · outcomes 가 SPEC-002 그대로)
//   ③ 건너기 — Lock 이 걸린 문마다 `cross:<문>` 하나가 유도되고, Lock 이 없는 문에는 서지 않는다
//   ④ 이름 — 관찰의 harvest-source · transit-connector 에 그 기회의 id 와 discovery 가 실리고,
//      기회가 없는 행동(이동 · 스킬 · 명령 · 탄생지의 채취 · Lock 없는 문)에는 **자리 자체가 없다**
//   ⑤ op 이름 — MUTATION_BINDINGS 의 op 도 기회의 outcomes.world 의 op 도 전부 MUTATION_OPS 안이다
//   ⑥ 검사 ㊺ — 참조가 성하면 통과이고, 유령 target · 표 밖의 op · 없는 progress 경로 ·
//      없는 action · 유령 조건은 fail 이다. ㊹ 의 답은 그대로다
//   ⑦ 검사 ㊻ — 판정 없는 report 이고 두 번 돌려도 글자까지 같다. 기회 0 인 방이 그 표에서 드러난다
//   ⑧ 회귀 — 방마다의 available · reason · role · **순서**가 C035 때와 한 값도 다르지 않고,
//      검사는 마흔여덟이 되며, 조건 자리 넷의 판정도 세계의 State 도 그대로다
//
// 세계는 공개 경로로만 본다 — driveWorld 로 굴리고 observe() 를 읽는다. 이 Cycle 의 새 구현
// (engine/world-authoring/opportunity.ts 의 본문 · content/regions/opportunity.ts 의 본문 ·
// content/world/semantic/mutation.ts 의 본문 · projection · check 의 ㊺ ㊻ 본문)은 **읽지 않았다.**
// 기대값의 출처는 cycles/C036-a-room-offers/spec.md 와 content/protocol/gameview.ts 의 관찰
// 계약(InteractionView.opportunity = { id, discovery }), 그리고 spec 이 선언한 함수 이름뿐이다.
//
// **이름도 자리도 손으로 적지 않는다** — 원천은 sourcesInRegion 에서, 문은 LOCKS 와 regionExitsOf
// 에서, 방은 REGION_SPECS 에서, 탄생지는 lifeSitesInRegion 에서 읽는다. 손으로 적는 것은 spec 이
// 못 박은 글자(id 의 자리 `gather:` · `cross:` · discovery 넷 · 역할 표 · progress 경로의 꼴 ·
// op 이름 열)와, 아래 C035_INTERACTIONS 하나뿐이다.
//
// **전체 개수를 단언하지 않는다** — 기회의 수도 원천의 수도 방의 수도 세지 않는다. 다만 검사의
// 수(마흔여덟)는 spec Observable 4 가 못 박은 값이라 그것만 잰다.
//
// **여기서 재지 않는 것** — 판의 「할 수 있는 것」 줄의 **문구**(discovery 한 마디)는 View 의
// 표가 짓는다. 세계 쪽에서 잴 수 있는 것은 그 판이 읽는 값(interactions[].opportunity)까지다
// (c030 · c034 · c035 가 세운 그 경계 그대로). 줄은 c036-a-room-offers.spec.ts (view) 가 잰다.

import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DECIDABLE_QUERY_KINDS,
  DECIDABLE_TARGET_KINDS,
  conditionLeaves,
  type Condition,
  type ConditionLeaf,
  type ConditionVerdict,
} from '../../../engine/world-authoring/condition';
import { checkRegions, type CheckItem, type CheckRegionsInput, type CheckReport } from '../../../engine/world-authoring/check';
import { MUTATION_OPS } from '../../../engine/world-authoring/opportunity';
import { descriptionHash } from '../../../engine/world-authoring/description';
import { LOCKS, REGION_SPECS, regionSpec, type Lock, type SeasonId } from '../../regions';
import { opportunitiesOf } from '../../regions/opportunity';
import type { GameViewSnapshot, InteractionView } from '../../protocol/gameview';
import { MUTATION_BINDINGS } from '../semantic/mutation';
import {
  DAY_SECONDS,
  LONG_NIGHT_SECONDS,
  SEEP_SECONDS,
  STILL_SECONDS,
  worldClockAt,
} from '../semantic/clock';
import { lifeRequirementCondition, lockCondition, sourceOccurrenceCondition, worldConditionVerdict } from '../semantic/condition';
import { lifeSitesInRegion, lifeUnmetCodes, type LifeSite } from '../semantic/life';
import { PERSISTENCE_TABLE } from '../semantic/persistence';
import { isConnectorOpen, regionExitsOf } from '../semantic/region';
import { NOT_THIS_HOUR, NOT_THIS_SEASON, regionPhaseAt } from '../semantic/region-phase';
import { sourceConditions, sourcesInRegion, type ResourceSource } from '../semantic/resource';
import type { WorldState } from '../semantic/world-state';
import { runWorldCheck, worldCheckInput } from '../../../tools/world-editor/check';
import { driveWorld, type WorldDriver } from './drive';

// ── spec 이 못 박은 글자 (여기 말고는 손으로 적지 않는다) ──────────────
/** 유도되는 기회 id 의 자리 — spec 기본형 ⑥ (코드의 자리이지 게임 이름이 아니다) */
const GATHER = 'gather:';
const CROSS = 'cross:';
/** discovery 넷 — spec World Change 1 (이 Cycle 의 데이터에 HIDDEN 은 없다) */
const DISCOVERY_KINDS = ['VISIBLE', 'SIGNAL', 'TRACE', 'HIDDEN'] as const;
const VISIBLE = 'VISIBLE';
const SIGNAL = 'SIGNAL';
const TRACE = 'TRACE';
const HIDDEN = 'HIDDEN';
/** 역할 표 — spec SPEC-002 (묶음 질문 Q3 의 답 "제안대로") */
const DISCOVERY_BY_ROLE: Readonly<Record<string, string>> = {
  baseline: TRACE,
  'by-product': TRACE,
  risk: TRACE,
  conditional: TRACE,
  'world-event': SIGNAL,
};
/** 동사 — spec World Change 1 ("이미 있는 동사만") */
const GATHER_ACTION = 'gather';
const CROSS_ACTION = 'cross';
/**
 * 항목 여덟 — spec SPEC-001. 다만 **availability 는 여기 없다**.
 *
 * spec 은 "항목 여덟으로 적히고" 라고만 하고 그 여덟이 **하나하나 다 있어야 하는가**는 말하지
 * 않는다. 조건을 밝히지 않은 원천의 기회는 SPEC-002 가 "둘 다 없으면 항상 참" 이라고 적었는데,
 * 그것을 `{ all: [] }` 로 적는 것과 자리를 비우는 것은 뜻이 같다. 그래서 여기서는 **자리의
 * 있고 없음이 아니라 판정**으로 잰다 — availability 의 있고 없음이 조건의 있고 없음과 맞는가는
 * S-312 · S-316 이, 그 판정이 늘 참인가는 S-312 가 잰다.
 */
const OPPORTUNITY_FIELDS = ['id', 'region', 'discovery', 'target', 'possibleActions', 'progress', 'outcomes'] as const;
/** 검사 ㊺ ㊻ 의 이름 — spec Reuse (opportunity-refs · opportunity-summary) */
const REFS_ID = 'opportunity-refs';
const REFS_MARK = '㊺';
const SUMMARY_ID = 'opportunity-summary';
const SUMMARY_MARK = '㊻';
/** 검사는 마흔여덟이 된다 — spec Observable 4 */
const CHECK_COUNT = 48;
/** C035 가 못 박아 둔 검사 넷 — 이 Cycle 이 겹쳐 보되 지우지 않는다 */
const KEPT_MARKS = ['㉓', '㉖', '㉞', '㊹'] as const;
/** op 표의 이름들 — spec SPEC-006 이 다섯 군으로 적은 것 */
const OP_NAMES = [
  'ADD',
  'CLAMP',
  'CHANGE_STATE',
  'CONNECT',
  'DISCONNECT',
  'START',
  'STOP',
  'ADVANCE',
  'RESET',
  'GRANT',
] as const;
/** 관찰의 role 셋 — spec SPEC-004 */
const HARVEST = 'harvest-source';
const TRANSIT = 'transit-connector';

// ── 철의 이름과 자리 (clock.ts 의 상수에서 유도한다 · c016 ~ c035 그대로) ─
const SEASONS: readonly SeasonId[] = ['STILL', 'SEEP', 'LONG_NIGHT', 'TURN'];
const SEASON_AT: Readonly<Record<SeasonId, number>> = {
  STILL: 0,
  SEEP: STILL_SECONDS,
  LONG_NIGHT: STILL_SECONDS + SEEP_SECONDS,
  TURN: STILL_SECONDS + SEEP_SECONDS + LONG_NIGHT_SECONDS,
};
interface TimeSample {
  season: SeasonId;
  slot: 'first' | 'second';
  dayPhase: 'DAY' | 'NIGHT';
  time: number;
}
/** 철 넷 × 낮밤 둘 — C035 가 세운 회귀의 자 그대로 */
const TIME_GRID: readonly TimeSample[] = SEASONS.flatMap((season) => {
  const start = SEASON_AT[season];
  const first = start + 1;
  const second = season === 'TURN' ? start + 30 : start + DAY_SECONDS + 1;
  return [
    { season, slot: 'first' as const, dayPhase: worldClockAt(first).dayPhase, time: first },
    { season, slot: 'second' as const, dayPhase: worldClockAt(second).dayPhase, time: second },
  ];
});

// ── 하네스 (c035 의 선례 그대로) ───────────────────────────────────────
const state = (w: WorldDriver) => w.world.snapshot().state as WorldState;
/** 같은 세계를 **그 시각**으로 본다 */
const at = (s: WorldState, time: number): WorldState => ({ ...s, time });
const standingIn = (region: string): WorldDriver => driveWorld({ npcs: [], actorRegion: region });
const spaceOf = (id: string) => regionSpec(id)!.space;

/** 세계의 원천 전부 · 탄생지 전부 — 방 순 · 자리 순 (데이터가 소유한다) */
const ALL_SOURCES: readonly ResourceSource[] = REGION_SPECS.flatMap((spec) => sourcesInRegion(spec.id));
const ALL_SITES: readonly LifeSite[] = REGION_SPECS.flatMap((spec) => lifeSitesInRegion(spec.id));
/** 그 원천이 밝힌 기억 조건 — C035 가 semantic 에 세운 자리 */
const memoryConditionOf = (source: ResourceSource): Condition | undefined =>
  (source as ResourceSource & { condition?: Condition }).condition;
/** 그 방에 선 Lock 들 (문에 걸린 것만) */
const locksInRegion = (region: string) =>
  LOCKS.filter((lock) => lock.region === region && lock.at.kind === 'connector');
const lockOf = (connector: string): (Lock & { region: string }) | undefined =>
  LOCKS.find((lock) => lock.at.kind === 'connector' && lock.at.ref === connector);
/** 그 방의 규칙이 설 수 있는 패턴 이름들 */
const patternsOf = (region: string): string[] => regionSpec(region)?.rule?.patterns.map((p) => p.name) ?? [];

// ── 기회를 읽는 자리 (spec 이 선언한 계약의 점 경로) ───────────────────
//
// 형을 engine 에서 가져오지 않고 **spec 이 글로 적은 그대로** 여기 둔다 — 이 파일은 새 구현을
// 읽지 않는다 (c027 view 시나리오의 선례).
interface OpportunityShape {
  id: string;
  region: string;
  availability?: Condition;
  discovery: string;
  target: { kind: string; ref?: string };
  possibleActions: readonly string[];
  progress: { kind: string; ref?: string };
  outcomes: { world: readonly unknown[]; yield: readonly unknown[] };
}
const opportunitiesIn = (region: string): OpportunityShape[] =>
  [...(opportunitiesOf(region) as readonly unknown[])] as OpportunityShape[];
/** 세계의 기회 전부 — 방 순 (저장되지 않는다 · 물을 때마다 유도된다) */
const allOpportunities = (): OpportunityShape[] => REGION_SPECS.flatMap((spec) => opportunitiesIn(spec.id));
const findIn = (region: string, id: string): OpportunityShape | undefined =>
  opportunitiesIn(region).find((o) => o.id === id);

/** 조건을 그 시각으로 판정한다 — 없는 조건은 "묻지 않음" 이다 */
const verdictOf = (s: WorldState, condition: Condition | undefined): ConditionVerdict | undefined =>
  condition === undefined ? undefined : worldConditionVerdict(s, condition);
/** 잎을 차례와 무관하게 견주는 자 — 어떤 순서로 엮었는지는 spec 이 정하지 않았다 */
const leafBag = (condition: Condition | undefined): string[] =>
  (condition === undefined ? [] : conditionLeaves(condition)).map((l) => JSON.stringify(l)).sort();

/** 그 값 안의 글자 전부 — 형을 모르는 채로 "무슨 이름을 쓰는가" 만 본다 */
function stringsIn(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (typeof value === 'string') into.add(value);
  else if (Array.isArray(value)) for (const one of value) stringsIn(one, into);
  else if (value !== null && typeof value === 'object') for (const one of Object.values(value)) stringsIn(one, into);
  return into;
}
/** 그 값 안의 글자를 전부 바꾼 사본 — "표 밖의 이름" 을 형을 모르는 채로 짓는 길 */
function corruptStrings(value: unknown, to: string): unknown {
  if (typeof value === 'string') return to;
  if (Array.isArray(value)) return value.map((one) => corruptStrings(one, to));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, corruptStrings(v, to)]));
  }
  return value;
}
/** op 어휘 — spec §4.2 는 그것을 "군 × op" 라고 적었다 */
interface MutationOp {
  group: string;
  op: string;
}
const OP_PAIRS: ReadonlySet<string> = new Set(
  (MUTATION_OPS as readonly MutationOp[]).map((one) => `${one.group}.${one.op}`),
);
/** 그 어휘 안의 글자 전부 — 군 이름도 op 이름도 (표 밖의 이름을 가려내는 자) */
const OP_VOCABULARY: ReadonlySet<string> = stringsIn(MUTATION_OPS);
/** 대문자 이름만 골라 본다 — RULE id(줄표) 와 사람 말은 빼고 op 이름만 남긴다 */
const isOpName = (text: string): boolean => /^[A-Z][A-Z0-9_]*$/.test(text);
/** 세계가 아는 이름 전부 — Mutation 의 ref 가 유령이 아닌지 보는 자 */
const worldNames = (): ReadonlySet<string> =>
  new Set([
    ...REGION_SPECS.map((s) => s.id),
    ...ALL_SOURCES.map((s) => s.id),
    ...REGION_SPECS.flatMap((s) => regionExitsOf(s.id).map((e) => e.connector.id)),
    ...ALL_SITES.map((s) => s.id),
  ]);

// ── 관찰 결과를 읽는 자리 (spec Observable 의 점 경로) ─────────────────
type SeenInteraction = InteractionView & { opportunity?: { id: string; discovery: string } };
const interactionsIn = (v: GameViewSnapshot): SeenInteraction[] => v.interactions as SeenInteraction[];
const seenIn = (region: string): SeenInteraction[] => interactionsIn(standingIn(region).observe());
const harvestOf = (list: readonly SeenInteraction[], target: string): SeenInteraction | undefined =>
  list.find((i) => i.role === HARVEST && i.targetEntityId === target);
const transitOf = (list: readonly SeenInteraction[], target: string): SeenInteraction | undefined =>
  list.find((i) => i.role === TRANSIT && i.targetEntityId === target);

// ── 도구를 밖에서 돌린다 (c018 · c034 · c035 의 선례 그대로) ────────────
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const OBSERVE = 'tools/world-editor/observe.ts';
function runTool(script: string, args: readonly string[]) {
  const result = spawnSync('npx', ['tsx', script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return { status: result.status, out: result.stdout ?? '', err: result.stderr ?? '' };
}

// ─────────────────────────────────────────────────────────────────────

describe('SPEC-001 형이 선다 — 기회 하나가 항목 여덟으로 적힌다', () => {
  it('S-308 방마다 기회 목록이 서고, 기회마다 항목이 다 있다 (기본형 밖의 데이터는 이 Cycle 에 없다)', () => {
    // Given 데이터에는 기본형 밖의 기회가 하나도 적혀 있지 않다 (spec State 절)
    for (const spec of REGION_SPECS) {
      const written = (spec as { opportunities?: readonly unknown[] }).opportunities ?? [];
      expect({ region: spec.id, written: [...written] }).toEqual({ region: spec.id, written: [] });
    }
    // Then 그래도 기회는 선다 — 유도된 것이다 (기본형 ②)
    const all = allOpportunities();
    expect(all.length).toBeGreaterThan(0);
    for (const one of all) {
      const missing = OPPORTUNITY_FIELDS.filter((field) => !(field in one));
      expect({ id: one.id, missing }).toEqual({ id: one.id, missing: [] });
      // 그 기회는 자기가 선 방을 안다
      expect({ id: one.id, region: one.region }).toEqual({
        id: one.id,
        region: REGION_SPECS.find((s) => opportunitiesIn(s.id).some((o) => o.id === one.id))!.id,
      });
      expect(one.possibleActions.length).toBeGreaterThan(0);
    }
    // And 같은 id 가 세계에 둘 있지 않다
    const ids = all.map((o) => o.id);
    expect([...new Set(ids)].sort()).toEqual([...ids].sort());
  });

  it('S-309 (경계 ①) 이 Cycle 이 지은 조건은 판정 가능한 갈래만 쓴다 — 자리만인 잎은 문이 이미 묻던 것뿐이다', () => {
    // spec 이 침묵한 자리: SPEC-001 경계 ① 은 "자리만인 Target · Query 는 이 Cycle 의 데이터에
    // 없다" 고 하고, SPEC-003 은 "cross 의 availability = 그 Lock 의 조건(lockCondition)" 이라고
    // 한다. 그런데 어떤 문은 C011 부터 property · knowledge 를 물어 왔고 그 항은 2층이 판정하지
    // 않는다(C035 S-246). 둘 다 지키는 읽기는 하나뿐이다 — **이 Cycle 이 새로 지은 잎**에는
    // 자리만인 갈래가 없고, 자리만인 잎은 전부 그 문이 **이미 묻던 것**이어야 한다.
    let deferredSeen = 0;
    for (const one of allOpportunities()) {
      const inherited = new Set(
        one.id.startsWith(CROSS) ? leafBag(lockCondition(lockOf(one.id.slice(CROSS.length))!)) : [],
      );
      for (const leaf of conditionLeaves(one.availability ?? { all: [] })) {
        const decidable =
          DECIDABLE_TARGET_KINDS.includes(leaf.target.kind) &&
          DECIDABLE_QUERY_KINDS.includes(leaf.query.kind) &&
          leaf.chance === undefined;
        if (decidable) continue;
        deferredSeen++;
        // 자리만인 잎은 그 문이 이미 묻던 것 그대로다 — 이 Cycle 이 지은 것이 아니다
        expect({ id: one.id, leaf: JSON.stringify(leaf), inherited: inherited.has(JSON.stringify(leaf)) }).toEqual({
          id: one.id,
          leaf: JSON.stringify(leaf),
          inherited: true,
        });
      }
      // 채집 기회에는 자리만인 잎이 하나도 없다 (이 Cycle 의 데이터가 지은 조건이다)
      if (!one.id.startsWith(GATHER)) continue;
      for (const leaf of conditionLeaves(one.availability ?? { all: [] })) {
        expect({
          id: one.id,
          target: DECIDABLE_TARGET_KINDS.includes(leaf.target.kind),
          query: DECIDABLE_QUERY_KINDS.includes(leaf.query.kind),
          chance: leaf.chance,
        }).toEqual({ id: one.id, target: true, query: true, chance: undefined });
      }
    }
    // 자리만인 잎을 실제로 보았다 — 보지 못했으면 위의 읽기가 헛돈 것이다
    expect({ deferredSeen: deferredSeen > 0 }).toEqual({ deferredSeen: true });
  });

  it('S-310 (경계 ②) discovery 는 넷 중 하나이고, 이 Cycle 의 데이터에 HIDDEN 은 없다', () => {
    const seen = new Set<string>();
    for (const one of allOpportunities()) {
      expect({ id: one.id, listed: DISCOVERY_KINDS.includes(one.discovery as never) }).toEqual({
        id: one.id,
        listed: true,
      });
      expect({ id: one.id, hidden: one.discovery === HIDDEN }).toEqual({ id: one.id, hidden: false });
      seen.add(one.discovery);
    }
    // 그리고 셋이 다 쓰인다 — 한 갈래만 보면 갈림이 헛돈다 (spec Experience Intent)
    expect([...seen].sort()).toEqual([SIGNAL, TRACE, VISIBLE].sort());
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-002 채집 기회의 기본형 유도', () => {
  it('S-311 원천마다 gather:<원천> 하나가 서고 target · possibleActions · progress · outcomes 가 spec 그대로다', () => {
    expect(ALL_SOURCES.length).toBeGreaterThan(0);
    for (const source of ALL_SOURCES) {
      const found = findIn(source.regionId, `${GATHER}${source.id}`);
      expect({ source: source.id, stood: found !== undefined }).toEqual({ source: source.id, stood: true });
      expect({ source: source.id, ...found! }).toMatchObject({
        source: source.id,
        region: source.regionId,
        target: { kind: 'source', ref: source.id },
        possibleActions: [GATHER_ACTION],
        progress: { kind: 'counter', ref: `sources.${source.id}.takenTotal` },
      });
      // outcomes — 자리와 이름만이다 (굴리지 않는다 · Out of Scope). 세계 쪽은 하나 · 얻는 것도 하나
      const outcomes = found!.outcomes;
      expect({ source: source.id, world: outcomes.world.length > 0, yield: outcomes.yield.length > 0 }).toEqual({
        source: source.id,
        world: true,
        yield: true,
      });
      expect({ source: source.id, op: [...stringsIn(outcomes.world)].some((t) => t.includes('CHANGE_STATE')) }).toEqual({
        source: source.id,
        op: true,
      });
      expect({
        source: source.id,
        gained: [...stringsIn(outcomes.yield)].some((t) => t.toLowerCase().includes('material')),
      }).toEqual({ source: source.id, gained: true });
    }
  });

  it('S-312 availability 가 그 원천의 조건이다 — 때와 기억을 함께 지고, 둘 다 없으면 늘 참이다', () => {
    const w = standingIn(REGION_SPECS[0]!.id);
    for (const source of ALL_SOURCES) {
      const one = findIn(source.regionId, `${GATHER}${source.id}`)!;
      const parts = [sourceOccurrenceCondition(source), memoryConditionOf(source)].filter(
        (c): c is Condition => c !== undefined,
      );
      // 잎이 그 원천의 조건 잎 그대로다 — 더 지어내지도 빠뜨리지도 않는다
      expect({ source: source.id, leaves: leafBag(one.availability) }).toEqual({
        source: source.id,
        leaves: parts.flatMap((c) => leafBag(c)).sort(),
      });
      // 그리고 자리는 조건이 있을 때만 선다 — 없는 것은 "묻지 않음 = 늘 참" 이다 (S-308 의 읽기)
      expect({ source: source.id, stood: 'availability' in one }).toEqual({
        source: source.id,
        stood: parts.length > 0,
      });
      // 그리고 판정이 그 조건들의 all 과 같다 (조건이 없으면 늘 참이다)
      for (const sample of TIME_GRID) {
        const s = at(state(w), sample.time);
        const expected = parts.length === 0 ? 'met' : worldConditionVerdict(s, { all: parts });
        expect({ source: source.id, ...sample, verdict: verdictOf(s, one.availability ?? { all: [] }) }).toEqual({
          source: source.id,
          ...sample,
          verdict: expected,
        });
      }
    }
  });

  it('S-313 discovery 가 역할 표 그대로다 — 세계 사건은 신호로 오고 나머지는 흔적이 말한다', () => {
    const roles = new Set<string>();
    for (const source of ALL_SOURCES) {
      const one = findIn(source.regionId, `${GATHER}${source.id}`)!;
      roles.add(source.opportunity);
      expect({ source: source.id, role: source.opportunity, discovery: one.discovery }).toEqual({
        source: source.id,
        role: source.opportunity,
        discovery: DISCOVERY_BY_ROLE[source.opportunity],
      });
    }
    // 표의 두 답을 다 보았다 — SIGNAL 쪽이 하나도 없으면 표가 헛돈다
    expect({ signal: [...roles].some((r) => DISCOVERY_BY_ROLE[r] === SIGNAL) }).toEqual({ signal: true });
    expect({ trace: [...roles].some((r) => DISCOVERY_BY_ROLE[r] === TRACE) }).toEqual({ trace: true });
  });

  it('S-314 (경계) 원천이 없는 방은 채집 기회가 0 이다', () => {
    const bare = REGION_SPECS.filter((spec) => sourcesInRegion(spec.id).length === 0);
    // 그런 방이 있다 (없으면 이 경계는 잴 것이 없다 — 그것도 밝힌다)
    expect({ bare: bare.length > 0 }).toEqual({ bare: true });
    for (const spec of bare) {
      const gathered = opportunitiesIn(spec.id).filter((o) => o.id.startsWith(GATHER));
      expect({ region: spec.id, gathered: gathered.map((o) => o.id) }).toEqual({ region: spec.id, gathered: [] });
    }
  });

  // SPEC-002 경계("데이터에 같은 id 를 적으면 데이터가 이긴다")는 이 하네스로 놓을 수 없다 —
  // 이 Cycle 의 데이터에 덮어쓰는 기회가 하나도 없어 세계를 세워서는 그 자리를 만들 수 없다.
  // 유도 함수를 직접 부르는 단위 시험이 잰다: content/world/tests/opportunity.spec.ts U-009 ~ U-011.
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-003 건너기 기회의 기본형 유도', () => {
  const locked = LOCKS.filter((lock) => lock.at.kind === 'connector');

  it('S-315 Lock 이 걸린 문마다 cross:<문> 하나가 서고 VISIBLE · target · [cross] · progress none 이다', () => {
    expect(locked.length).toBeGreaterThan(0);
    for (const lock of locked) {
      const one = findIn(lock.region, `${CROSS}${lock.at.ref}`);
      expect({ lock: lock.id, stood: one !== undefined }).toEqual({ lock: lock.id, stood: true });
      expect({ lock: lock.id, ...one! }).toMatchObject({
        lock: lock.id,
        region: lock.region,
        discovery: VISIBLE, // 문은 보인다
        target: { kind: 'connector', ref: lock.at.ref },
        possibleActions: [CROSS_ACTION],
        progress: { kind: 'none' },
      });
      // outcomes — 세계에 남는 것은 없고 얻는 것은 드나듦이다
      expect({ lock: lock.id, world: [...one!.outcomes.world] }).toEqual({ lock: lock.id, world: [] });
      expect({
        lock: lock.id,
        gained: [...stringsIn(one!.outcomes.yield)].some((t) => t.toLowerCase().includes('access')),
      }).toEqual({ lock: lock.id, gained: true });
    }
  });

  it('S-316 availability 가 그 Lock 의 조건이다 — 잎도 판정도 lockCondition 과 같다 (철 넷 × 낮밤 둘 · 패턴마다)', () => {
    for (const lock of locked) {
      const one = findIn(lock.region, `${CROSS}${lock.at.ref}`)!;
      const condition = lockCondition(lock);
      expect({ lock: lock.id, stood: 'availability' in one }).toEqual({ lock: lock.id, stood: true });
      expect({ lock: lock.id, leaves: leafBag(one.availability) }).toEqual({
        lock: lock.id,
        leaves: leafBag(condition),
      });
      // 그 문의 state 항이 가리키는 방을 패턴마다 세워 본다 (C035 의 lockWorlds 어법)
      const clauses = lock.requires.flatMap((r) => (r.state ? [r.state] : []));
      const worlds: { label: string; w: WorldDriver }[] =
        clauses.length === 0
          ? [{ label: 'default', w: standingIn(lock.region) }]
          : clauses.flatMap((clause) =>
              patternsOf(clause.region).map((pattern) => ({
                label: `${clause.region}=${pattern}`,
                w: driveWorld({ npcs: [], actorRegion: lock.region, regionPatterns: { [clause.region]: pattern } }),
              })),
            );
      for (const { label, w } of worlds) {
        for (const sample of TIME_GRID) {
          const s = at(state(w), sample.time);
          expect({ lock: lock.id, world: label, ...sample, verdict: verdictOf(s, one.availability) }).toEqual({
            lock: lock.id,
            world: label,
            ...sample,
            verdict: verdictOf(s, condition),
          });
        }
      }
    }
  });

  it('S-317 (경계) Lock 이 없는 문에는 건너기 기회가 서지 않는다 — 이 Cycle 은 "묻는 문" 만 이름을 준다', () => {
    let openDoors = 0;
    for (const spec of REGION_SPECS) {
      const ids = opportunitiesIn(spec.id).filter((o) => o.id.startsWith(CROSS)).map((o) => o.id);
      for (const exit of regionExitsOf(spec.id)) {
        if (lockOf(exit.connector.id)) continue;
        openDoors++;
        expect({ region: spec.id, connector: exit.connector.id, stood: ids.includes(`${CROSS}${exit.connector.id}`) }).toEqual({
          region: spec.id,
          connector: exit.connector.id,
          stood: false,
        });
      }
      // 그 방에 선 건너기 기회는 전부 그 방에 선 Lock 의 것이다
      expect({ region: spec.id, crossed: ids.sort() }).toEqual({
        region: spec.id,
        crossed: locksInRegion(spec.id).map((lock) => `${CROSS}${lock.at.ref}`).sort(),
      });
    }
    // 묻지 않는 문이 실제로 있다 — 없으면 이 경계는 잴 것이 없다
    expect({ openDoors: openDoors > 0 }).toEqual({ openDoors: true });
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-004 이름이 붙는다 — 관찰의 Interaction 에 기회 id 와 discovery 가 실린다', () => {
  it('S-318 원천을 겨냥한 harvest-source 에 gather:<원천> 과 그 원천의 discovery 가 실린다 — 한 방의 둘이 갈려 읽힌다', () => {
    let signalSeen = 0;
    let traceSeen = 0;
    for (const spec of REGION_SPECS) {
      const list = seenIn(spec.id);
      for (const source of sourcesInRegion(spec.id)) {
        const seen = harvestOf(list, source.id);
        if (!seen) continue; // 그때 관찰에 서지 않는 원천은 이 항의 물음이 아니다
        expect({ source: source.id, opportunity: seen.opportunity }).toEqual({
          source: source.id,
          opportunity: { id: `${GATHER}${source.id}`, discovery: DISCOVERY_BY_ROLE[source.opportunity] },
        });
        if (seen.opportunity!.discovery === SIGNAL) signalSeen++;
        else traceSeen++;
      }
    }
    // 흔적이 말하는 것과 신호로 오는 것을 둘 다 보았다 (spec Observable 1 — 같은 방의 둘이 갈린다)
    expect({ signalSeen: signalSeen > 0, traceSeen: traceSeen > 0 }).toEqual({ signalSeen: true, traceSeen: true });
  });

  it('S-319 Lock 이 걸린 문을 겨냥한 transit-connector 에 cross:<문> 과 VISIBLE 이 실린다', () => {
    for (const lock of LOCKS) {
      if (lock.at.kind !== 'connector') continue;
      const seen = transitOf(seenIn(lock.region), lock.at.ref);
      expect({ lock: lock.id, listed: seen !== undefined }).toEqual({ lock: lock.id, listed: true });
      expect({ lock: lock.id, opportunity: seen!.opportunity }).toEqual({
        lock: lock.id,
        opportunity: { id: `${CROSS}${lock.at.ref}`, discovery: VISIBLE },
      });
    }
  });

  it('S-320 (경계) 기회가 없는 행동에는 자리 자체가 없다 — 이동 · 스킬 · 명령 · 탄생지의 채취 · 묻지 않는 문', () => {
    const siteIds = new Set(ALL_SITES.map((site) => site.id));
    let bareSeen = 0;
    let siteSeen = 0;
    for (const spec of REGION_SPECS) {
      const sourceIds = new Set(sourcesInRegion(spec.id).map((s) => s.id));
      for (const seen of seenIn(spec.id)) {
        // 대상이 없는 행동 — 이동 · 스킬 · 명령
        if (seen.targetEntityId === undefined) {
          expect({ region: spec.id, id: seen.id, opportunity: seen.opportunity }).toEqual({
            region: spec.id,
            id: seen.id,
            opportunity: undefined,
          });
          bareSeen++;
          continue;
        }
        // 탄생지를 겨냥한 채취 — 원천이 아니므로 기회가 없다
        if (seen.role === HARVEST && !sourceIds.has(seen.targetEntityId) && siteIds.has(seen.targetEntityId)) {
          expect({ region: spec.id, site: seen.targetEntityId, opportunity: seen.opportunity }).toEqual({
            region: spec.id,
            site: seen.targetEntityId,
            opportunity: undefined,
          });
          siteSeen++;
          continue;
        }
        // 묻지 않는 문 — Lock 이 없으면 자리가 없다
        if (seen.role === TRANSIT && !lockOf(seen.targetEntityId)) {
          expect({ region: spec.id, connector: seen.targetEntityId, opportunity: seen.opportunity }).toEqual({
            region: spec.id,
            connector: seen.targetEntityId,
            opportunity: undefined,
          });
        }
      }
    }
    expect({ bareSeen: bareSeen > 0, siteSeen: siteSeen > 0 }).toEqual({ bareSeen: true, siteSeen: true });
  });

  it('S-321 세계 어디에도 유령 이름이 실리지 않는다 — 실린 기회는 그 방(또는 그 문)의 기회 그대로다', () => {
    for (const spec of REGION_SPECS) {
      const here = new Map(opportunitiesIn(spec.id).map((o) => [o.id, o]));
      for (const seen of seenIn(spec.id)) {
        const carried = seen.opportunity;
        if (!carried) continue;
        const known = here.get(carried.id);
        if (known) {
          // 실린 이름과 discovery 가 그 방의 기회 그대로다
          expect({ region: spec.id, id: carried.id, discovery: carried.discovery }).toEqual({
            region: spec.id,
            id: carried.id,
            discovery: known.discovery,
          });
          continue;
        }
        // 이 방의 것이 아닌 이름이 실렸다면 그것은 **문의 저쪽 끝**뿐이다 (spec 이 침묵한 자리 —
        // R1 은 "그 기회의 target 이 그 대상이다" 까지만 말하고 방을 묻지 않는다). 그 경우에도
        // 아무 이름이나 실릴 수는 없다: 그 문에 걸린 Lock 의 기회여야 한다
        const lock = seen.targetEntityId ? lockOf(seen.targetEntityId) : undefined;
        expect({ region: spec.id, id: carried.id, discovery: carried.discovery }).toEqual({
          region: spec.id,
          id: `${CROSS}${lock?.at.ref}`,
          discovery: VISIBLE,
        });
      }
    }
  });

  // SPEC-005 의 **문구**는 세계 쪽에서 잴 수 없다 — 문구는 content/view 의 code-text 가 짓는다.
  // 여기서 잴 수 있는 것은 그 판이 읽는 값(interactions[].opportunity)까지이고, 줄 자체는
  // content/view/tests/c036-a-room-offers.spec.ts(문구 셋)와 같은 폴더의 scenario 가 잰다.
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-006 op 이름 — 옮기지 않고 이름만 준다', () => {
  it('S-322 MUTATION_BINDINGS 가 다섯 군의 op 이름을 다 주고, 인용한 RULE id 가 규칙 코드에 실제로 있다', () => {
    const texts = stringsIn(MUTATION_BINDINGS);
    expect(texts.size).toBeGreaterThan(0);
    // spec SPEC-006 이 적은 op 이름 열이 다 있다
    for (const op of OP_NAMES) {
      expect({ op, named: texts.has(op) }).toEqual({ op, named: true });
    }
    // 표가 쓰는 대문자 이름은 전부 op 어휘 안이다 (군 이름 · 사람 말 · RULE id 는 걸러진다)
    for (const text of texts) {
      if (!isOpName(text)) continue;
      expect({ name: text, inVocabulary: OP_VOCABULARY.has(text) }).toEqual({ name: text, inVocabulary: true });
    }
    // 그리고 줄마다의 군 × op 짝이 그 표의 칸이다 — 어휘 안의 글자를 아무렇게나 엮은 것이 아니다
    for (const binding of MUTATION_BINDINGS as readonly Partial<MutationOp>[]) {
      expect({ pair: `${binding.group}.${binding.op}`, inTable: OP_PAIRS.has(`${binding.group}.${binding.op}`) }).toEqual({
        pair: `${binding.group}.${binding.op}`,
        inTable: true,
      });
    }
    // 인용한 RULE id 는 지어낸 것이 아니라 지금 굴러가는 규칙의 것이다
    const source = worldSourceText();
    const cited = [...texts].filter((t) => t.startsWith('RULE-'));
    expect(cited.length).toBeGreaterThan(0);
    for (const id of cited) {
      expect({ rule: id, lives: source.includes(id) }).toEqual({ rule: id, lives: true });
    }
  });

  it('S-323 (경계) 기회의 outcomes.world 에 쓰인 op 도 전부 그 표의 칸이고, 가리키는 것도 유령이 아니다', () => {
    const names = worldNames();
    let seen = 0;
    for (const one of allOpportunities()) {
      for (const mutation of one.outcomes.world as readonly (MutationOp & { ref?: string })[]) {
        seen++;
        const pair = `${mutation.group}.${mutation.op}`;
        expect({ id: one.id, pair, inTable: OP_PAIRS.has(pair) }).toEqual({ id: one.id, pair, inTable: true });
        // 그 op 가 가리키는 것이 있으면 그것은 세계가 아는 이름이다 (자리와 이름만이되 유령은 아니다)
        for (const text of stringsIn(mutation)) {
          if (OP_VOCABULARY.has(text)) continue;
          expect({ id: one.id, ref: text, known: names.has(text) }).toEqual({ id: one.id, ref: text, known: true });
        }
      }
    }
    expect({ seen: seen > 0 }).toEqual({ seen: true });
  });
});

/** 지금 굴러가는 규칙 코드 전부의 글 — RULE id 가 살아 있는지 여기서 본다 */
function worldSourceText(): string {
  const folders = ['content/world/rules', 'content/world/simulation', 'content/world/semantic'];
  return folders
    .flatMap((folder) =>
      readdirSync(`${ROOT}${folder}`)
        .filter((name) => name.endsWith('.ts'))
        .map((name) => readFileSync(`${ROOT}${folder}/${name}`, 'utf8')),
    )
    .join('\n');
}

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-007 검사 ㊺ — 기회가 가리키는 것', () => {
  const report = runWorldCheck();
  const itemById = (r: CheckReport, id: string): CheckItem | undefined => r.items.find((i) => i.id === id);

  /** 검사의 입력에 기회 하나를 더한다 — 데이터는 손대지 않는다 (c035 withGhost 의 어법) */
  type Bag = Record<string, unknown>;
  const isOpportunityLike = (value: unknown): boolean =>
    value !== null &&
    typeof value === 'object' &&
    'id' in (value as Bag) &&
    'target' in (value as Bag) &&
    'possibleActions' in (value as Bag);
  function withGhost(ghost: OpportunityShape): CheckRegionsInput {
    const input = worldCheckInput() as unknown as Bag;
    const held = input.opportunity as Bag | undefined;
    if (!held || typeof held !== 'object') {
      throw new Error('worldCheckInput 이 기회 쪽 계약(opportunity)을 주지 않는다 — spec Reuse 가 CheckOpportunity 를 못 박았다');
    }
    // 목록의 열쇠 이름을 손으로 적지 않는다 — Opportunity 를 담은 배열을 형으로 찾는다
    const key = Object.entries(held).find(([, v]) => Array.isArray(v) && v.some(isOpportunityLike))?.[0];
    if (!key) throw new Error('기회 쪽 계약에 Opportunity 목록이 없다');
    return {
      ...input,
      opportunity: { ...held, [key]: [...(held[key] as unknown[]), ghost] },
    } as unknown as CheckRegionsInput;
  }
  /** 성한 기회 하나 — 유도된 채집 기회를 그대로 베낀다 (이름만 다르다) */
  const sound = (): OpportunityShape => {
    const found = allOpportunities().find((o) => o.id.startsWith(GATHER) && o.outcomes.world.length > 0);
    if (!found) throw new Error('세계에 채집 기회가 없다 — 유령을 지을 자리가 없다');
    return JSON.parse(JSON.stringify(found)) as OpportunityShape;
  };

  it('S-324 ㊺ 가 id opportunity-refs · 번호 ㊺ 로 서고 통과다 — 기회가 가리키는 것이 다 실재한다', () => {
    const item = itemById(report, REFS_ID);
    expect(item, '보고에 opportunity-refs 가 없다').toBeDefined();
    expect(item!.mark).toBe(REFS_MARK);
    expect(item!.status).toBe('pass');
    expect(item!.answer.length).toBeGreaterThan(0);
    expect({ fail: report.counts.fail, ok: report.ok }).toEqual({ fail: 0, ok: true });
  });

  it('S-325 없는 원천을 target 으로 한 기회를 넣으면 ㊺ 만 fail 이고 다른 항목의 답은 그대로다', () => {
    const ghost = sound();
    ghost.id = `${GATHER}NO_SUCH_SOURCE`;
    ghost.target = { ...ghost.target, ref: 'NO_SUCH_SOURCE' };
    const broken = checkRegions(withGhost(ghost));
    expect(itemById(broken, REFS_ID)?.status).toBe('fail');
    expect(broken.ok).toBe(false);
    for (const before of report.items) {
      if (before.id === REFS_ID) continue;
      expect({ id: before.id, status: itemById(broken, before.id)?.status }).toEqual({
        id: before.id,
        status: before.status,
      });
    }
  });

  it('S-326 op 표 밖의 이름 · 없는 progress 경로 · 없는 action · 유령 조건도 fail 이고, 성한 것은 통과다', () => {
    const cases: { name: string; make: (o: OpportunityShape) => void }[] = [
      {
        name: 'op-outside-table',
        // 형을 모르므로 그 자리의 글자를 전부 표 밖의 이름으로 바꾼다
        make: (o) => {
          o.outcomes = { ...o.outcomes, world: o.outcomes.world.map((m) => corruptStrings(m, 'NO_SUCH_OP')) };
        },
      },
      { name: 'no-such-progress', make: (o) => void (o.progress = { ...o.progress, ref: 'no.such.path' }) },
      { name: 'no-such-action', make: (o) => void (o.possibleActions = ['c036-test:no-such-action']) },
      {
        name: 'ghost-condition',
        make: (o) =>
          void (o.availability = {
            target: { kind: 'region', ref: 'NO_SUCH_ROOM' },
            query: { kind: 'state', path: 'pattern' },
            operator: 'IN',
            value: ['NO_SUCH_PATTERN'],
          } as ConditionLeaf),
      },
    ];
    for (const one of cases) {
      const ghost = sound();
      ghost.id = `c036-test:${one.name}`;
      one.make(ghost);
      const broken = checkRegions(withGhost(ghost));
      expect({ name: one.name, status: itemById(broken, REFS_ID)?.status }).toEqual({ name: one.name, status: 'fail' });
    }
    // 성한 기회는 통과다 — 검사가 헛돌지 않는다
    const ok = sound();
    ok.id = 'c036-test:sound';
    expect(itemById(checkRegions(withGhost(ok)), REFS_ID)?.status).toBe('pass');
  });

  it('S-327 (경계) ㉓ · ㉖ · ㉞ · ㊹ 의 답은 그대로다 — 겹쳐 보되 지우지 않는다', () => {
    for (const mark of KEPT_MARKS) {
      const found = report.items.find((i) => i.mark === mark);
      expect({ mark, status: found?.status }).toEqual({ mark, status: 'pass' });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-008 검사 ㊻ — 방마다 무엇을 내미는가 (판정 없음)', () => {
  it('S-328 ㊻ 가 id opportunity-summary · 번호 ㊻ · status report 이고 두 번 돌려도 글자까지 같다', () => {
    const first = runWorldCheck().items.find((i) => i.id === SUMMARY_ID);
    const second = runWorldCheck().items.find((i) => i.id === SUMMARY_ID);
    expect(first, '보고에 opportunity-summary 가 없다').toBeDefined();
    expect(first!.mark).toBe(SUMMARY_MARK);
    expect(first!.status).toBe('report');
    expect(first!.answer.length).toBeGreaterThan(0);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('S-329 (경계) 방마다의 줄이 서고 기회 0 인 방도 그 표에 든다 · Event 는 0 이다', () => {
    const item = runWorldCheck().items.find((i) => i.id === SUMMARY_ID)!;
    const text = JSON.stringify(item);
    for (const spec of REGION_SPECS) {
      expect({ region: spec.id, listed: text.includes(spec.id) }).toEqual({ region: spec.id, listed: true });
    }
    // 기회가 0 인 방이 실제로 있다 — 그 방이 눈에 띄는 것이 이 검사의 값이다
    const bare = REGION_SPECS.filter((spec) => opportunitiesIn(spec.id).length === 0);
    expect({ bare: bare.length > 0 }).toEqual({ bare: true });
    for (const spec of bare) {
      expect({ region: spec.id, listed: text.includes(spec.id) }).toEqual({ region: spec.id, listed: true });
    }
    // 그리고 discovery 세 갈래의 이름이 그 표에 있다
    for (const discovery of [VISIBLE, SIGNAL, TRACE]) {
      expect({ discovery, listed: text.includes(discovery) }).toEqual({ discovery, listed: true });
    }
    // Event 는 0 이다 — availability 에 시간 qualifier 를 가진 기회가 데이터에 하나도 없다
    for (const one of allOpportunities()) {
      for (const leaf of conditionLeaves(one.availability ?? { all: [] })) {
        expect({ id: one.id, qualifier: leaf.qualifier?.kind }).not.toEqual({ id: one.id, qualifier: 'time' });
      }
    }
  });

  // 통합에서 푼 GAP — spec 이 관계 다섯의 **코드 어휘**를 밝히지 않아 T 가 이름으로 잴 자가
  // 없었다. 어휘는 컨텐츠가 정했고(`relation:<갈래>` 다섯), 세계가 실제로 낸 그 이름으로 잰다.
  it('S-342 (경계) 관계 다섯 갈래가 그 표에 서고, 하나도 닿지 않는 갈래(사회)도 지워지지 않는다', () => {
    const item = runWorldCheck().items.find((i) => i.id === SUMMARY_ID)!;
    const kinds = item.refs.filter((ref) => ref.where.startsWith('relation:'));
    // 다섯이다 — 갈래가 늘거나 줄면 이 줄이 걸린다 (G9 "다섯 갈래로 이미 서 있다")
    expect({ kinds: kinds.map((ref) => ref.where) }).toEqual({
      kinds: [
        'relation:spatial',
        'relation:environment',
        'relation:ecology',
        'relation:event',
        'relation:social',
      ],
    });
    // 사회는 아직 어느 방에도 닿지 않는다 — **없다는 사실이 표에 선다** (지워지지 않는다)
    const social = kinds.find((ref) => ref.where === 'relation:social')!;
    expect({ reaches: social.detail.includes('닿는 방 0') }).toEqual({ reaches: true });
  });
});

// ─────────────────────────────────────────────────────────────────────
//
// C035 의 세계가 낸 답 — **이 Cycle 이 한 값도 바꾸지 않아야 하는 것**.
//
// spec SPEC-004 경계가 "available · reason · role · profile · 순서는 한 값도 달라지지 않는다" 를
// 못 박았으므로, C035 가 닫힌 자리(HEAD 05e4b77)의 세계를 방마다 세워 관찰이 낸 줄을 그대로
// 받아 적었다. 줄 하나는 `id/role/대상/available/사유` 다. 기회의 이름은 여기 없다 — 이 표는
// 기회가 **붙기 전**의 답이기 때문이다.
const C035_INTERACTIONS: Readonly<Record<string, readonly string[]>> = {
  WHITE_KING_DOMAIN: [
    'move/move-to//true/',
    'attack/skill-basic//true/',
    'skill-heavy/skill-heavy//true/',
    'move-mode/set-move-mode//true/',
    'set-attribute/debug-set-attribute//true/',
    'emergency-return/emergency-return//false/no-emergency-exit',
    'transit/transit-connector/FOREST_PATH/false/out-of-range',
    'transit/transit-connector/RED_WASTE_PASS/false/out-of-range',
    'transit/transit-connector/ICE_CANYON_PASS/false/out-of-range',
  ],
  FOREST_EDGE: [
    'move/move-to//true/',
    'attack/skill-basic//true/',
    'skill-heavy/skill-heavy//true/',
    'move-mode/set-move-mode//true/',
    'set-attribute/debug-set-attribute//true/',
    'emergency-return/emergency-return//false/no-emergency-exit',
    'mine/harvest-source/MOLT_LITTER/false/out-of-range',
    'mine/harvest-source/FALLEN_SCALE/false/source-depleted',
    'mine/harvest-source/PREY_REMAINS/false/source-depleted',
    'mine/harvest-source/ORE_PEBBLE_EDGE/false/out-of-range',
    'mine/harvest-source/HUSK_SHARD_EDGE/false/out-of-range',
    'transit/transit-connector/FOREST_PATH/false/out-of-range',
    'transit/transit-connector/RUIN_TRAIL/false/out-of-range',
    'transit/transit-connector/DEEP_TRAIL/false/out-of-range',
  ],
  FOREST_DEEP: [
    'move/move-to//true/',
    'attack/skill-basic//true/',
    'skill-heavy/skill-heavy//true/',
    'move-mode/set-move-mode//true/',
    'set-attribute/debug-set-attribute//true/',
    'emergency-return/emergency-return//false/no-emergency-exit',
    'mine/harvest-source/RIVER_SILT/false/source-depleted',
    'mine/harvest-source/ORE_PEBBLE_DEEP_1/false/out-of-range',
    'mine/harvest-source/ORE_PEBBLE_DEEP_2/false/out-of-range',
    'mine/harvest-source/HUSK_SHARD_DEEP/false/out-of-range',
    'transit/transit-connector/DEEP_TRAIL/false/out-of-range',
    'transit/transit-connector/NEST_TRAIL/false/out-of-range',
    'transit/transit-connector/ORE_TRAIL/false/out-of-range',
    'transit/transit-connector/TREE_APPROACH/false/out-of-range',
    'transit/transit-connector/ANCIENT_GATE/false/out-of-range',
    'transit/transit-connector/WALKING_FOREST_DOOR/false/out-of-range',
  ],
  EXPLORER_RUIN: [
    'move/move-to//true/',
    'attack/skill-basic//true/',
    'skill-heavy/skill-heavy//true/',
    'move-mode/set-move-mode//true/',
    'set-attribute/debug-set-attribute//true/',
    'emergency-return/emergency-return//false/no-emergency-exit',
    'mine/harvest-source/RUIN_SPOIL/false/out-of-range',
    'mine/harvest-source/ORE_PEBBLE_RUIN/false/out-of-range',
    'mine/harvest-source/HUSK_SHARD_RUIN_1/false/out-of-range',
    'mine/harvest-source/HUSK_SHARD_RUIN_2/false/out-of-range',
    'transit/transit-connector/RUIN_TRAIL/false/out-of-range',
  ],
  PREDATOR_NEST: [
    'move/move-to//true/',
    'attack/skill-basic//true/',
    'skill-heavy/skill-heavy//true/',
    'move-mode/set-move-mode//true/',
    'set-attribute/debug-set-attribute//true/',
    'emergency-return/emergency-return//false/no-emergency-exit',
    'mine/harvest-source/NEST_FUNGUS/false/out-of-range',
    'mine/harvest-source/HUSK_SHARD_NEST/false/out-of-range',
    'mine/harvest-source/NEST_CARCASS/false/out-of-range',
    'mine/harvest-source/CARCASS_TO_FUNGUS/false/not-a-source',
    'transit/transit-connector/NEST_TRAIL/false/out-of-range',
  ],
  BIO_ORE_FIELD: [
    'move/move-to//true/',
    'attack/skill-basic//true/',
    'skill-heavy/skill-heavy//true/',
    'move-mode/set-move-mode//true/',
    'set-attribute/debug-set-attribute//true/',
    'emergency-return/emergency-return//false/no-emergency-exit',
    'mine/harvest-source/ORE_OUTCROP/false/out-of-range',
    'mine/harvest-source/ORE_PEBBLE_ORE_1/false/out-of-range',
    'mine/harvest-source/ORE_PEBBLE_ORE_2/false/out-of-range',
    'mine/harvest-source/ORE_PEBBLE_ORE_3/false/out-of-range',
    'mine/harvest-source/HUSK_SHARD_ORE/false/out-of-range',
    'transit/transit-connector/ORE_TRAIL/false/out-of-range',
    'transit/transit-connector/ORE_TREE_TRAIL/false/out-of-range',
  ],
  RED_EYE_TREE: [
    'move/move-to//true/',
    'attack/skill-basic//true/',
    'skill-heavy/skill-heavy//true/',
    'move-mode/set-move-mode//true/',
    'set-attribute/debug-set-attribute//true/',
    'emergency-return/emergency-return//false/no-emergency-exit',
    'mine/harvest-source/ROOT_NODULE/false/out-of-range',
    'mine/harvest-source/ORE_PEBBLE_TREE/false/out-of-range',
    'mine/harvest-source/CLUTCH_HUSK/false/source-depleted',
    'mine/harvest-source/EGG_HUSK/false/source-depleted',
    'mine/harvest-source/ROOT_CLUTCH/false/not-a-source',
    'mine/harvest-source/ROOT_EGGS/false/not-a-source',
    'transit/transit-connector/TREE_APPROACH/false/out-of-range',
    'transit/transit-connector/ORE_TREE_TRAIL/false/out-of-range',
    'transit/transit-connector/TREE_INNER_DOOR/false/out-of-range',
  ],
  TREE_INNER_WORLD: [
    'move/move-to//true/',
    'attack/skill-basic//true/',
    'skill-heavy/skill-heavy//true/',
    'move-mode/set-move-mode//true/',
    'set-attribute/debug-set-attribute//true/',
    'emergency-return/emergency-return//false/no-emergency-exit',
    'mine/harvest-source/CORE_EMBER/false/out-of-range',
    'transit/transit-connector/TREE_INNER_DOOR/false/out-of-range',
    'transit/transit-connector/TREE_FALL/false/out-of-range',
  ],
  HEART_LAKE: [
    'move/move-to//true/',
    'attack/skill-basic//true/',
    'skill-heavy/skill-heavy//true/',
    'move-mode/set-move-mode//true/',
    'set-attribute/debug-set-attribute//true/',
    'emergency-return/emergency-return//false/no-emergency-exit',
    'mine/harvest-source/LAKE_SILT_BED/false/out-of-range',
    'transit/transit-connector/HEART_RIVER/false/out-of-range',
  ],
  FANTASY_MAZE: [
    'move/move-to//true/',
    'attack/skill-basic//true/',
    'skill-heavy/skill-heavy//true/',
    'move-mode/set-move-mode//true/',
    'set-attribute/debug-set-attribute//true/',
    'emergency-return/emergency-return//true/',
    'transit/transit-connector/MAZE_GATE_RETURN/false/out-of-range',
    'transit/transit-connector/MAZE_HEART_GATE/false/out-of-range',
  ],
  MAZE_HEART: [
    'move/move-to//true/',
    'attack/skill-basic//true/',
    'skill-heavy/skill-heavy//true/',
    'move-mode/set-move-mode//true/',
    'set-attribute/debug-set-attribute//true/',
    'emergency-return/emergency-return//false/no-emergency-exit',
    'transit/transit-connector/MAZE_HEART_GATE/false/out-of-range',
    'transit/transit-connector/INVERTED_GARDEN_DOOR/false/out-of-range',
  ],
  ICE_CANYON: [
    'move/move-to//true/',
    'attack/skill-basic//true/',
    'skill-heavy/skill-heavy//true/',
    'move-mode/set-move-mode//true/',
    'set-attribute/debug-set-attribute//true/',
    'emergency-return/emergency-return//false/no-emergency-exit',
    'mine/harvest-source/PASS_RIME/false/out-of-range',
    'transit/transit-connector/ICE_CANYON_PASS/false/out-of-range',
    'transit/transit-connector/FROST_CANYON_TRAIL/false/out-of-range',
  ],
  FROST_CANYON: [
    'move/move-to//true/',
    'attack/skill-basic//true/',
    'skill-heavy/skill-heavy//true/',
    'move-mode/set-move-mode//true/',
    'set-attribute/debug-set-attribute//true/',
    'emergency-return/emergency-return//false/no-emergency-exit',
    'mine/harvest-source/CLIFF_FROST_VEIN/false/out-of-range',
    'mine/harvest-source/FROZEN_REMAINS/false/out-of-range',
    'transit/transit-connector/FROST_CANYON_TRAIL/false/out-of-range',
    'transit/transit-connector/FROST_DEPTH_DOOR/false/out-of-range',
  ],
};

describe('회귀', () => {
  it('S-330 (SPEC-004 경계) 방마다 available · reason · role · 순서가 C035 때와 한 값도 다르지 않다', () => {
    for (const spec of REGION_SPECS) {
      const lines = seenIn(spec.id).map(
        (i) => `${i.id}/${i.role}/${i.targetEntityId ?? ''}/${i.available}/${i.reason ?? ''}`,
      );
      expect({ region: spec.id, lines }).toEqual({
        region: spec.id,
        lines: [...(C035_INTERACTIONS[spec.id] ?? [])],
      });
    }
    // 그리고 profile 이 붙던 자리도 그대로다 — 스킬 둘은 여전히 profile 을 진다
    const list = seenIn(REGION_SPECS[0]!.id) as (SeenInteraction & { profile?: unknown })[];
    expect(list.filter((i) => i.profile !== undefined).map((i) => i.id)).toEqual(['attack', 'skill-heavy']);
  });

  it('S-331 (SPEC-009) 검사가 마흔여덟이 되고 통과이며, 두 번 돌려도 글자까지 같다', () => {
    const first = runWorldCheck();
    expect(first.items.length).toBe(CHECK_COUNT);
    expect({ fail: first.counts.fail, ok: first.ok }).toEqual({ fail: 0, ok: true });
    // 새로 든 둘 말고는 fail 이 없다 (앞의 마흔여섯의 답이 그대로다)
    for (const item of first.items) {
      expect({ id: item.id, failed: item.status === 'fail' }).toEqual({ id: item.id, failed: false });
    }
    expect(JSON.stringify(runWorldCheck())).toBe(JSON.stringify(first));
  });

  it('S-332 (SPEC-009) 조건 자리 넷의 판정이 그대로다 — 문의 열림 · 원천의 때 · 위상 · 결속', () => {
    const w = standingIn(REGION_SPECS[0]!.id);
    // ① 문의 열림 — Lock 의 판정 가능한 항이 isConnectorOpen 과 같다
    for (const lock of LOCKS) {
      if (lock.at.kind !== 'connector') continue;
      const decidable: Condition = {
        all: conditionLeaves(lockCondition(lock)!).filter(
          (leaf) =>
            DECIDABLE_TARGET_KINDS.includes(leaf.target.kind) &&
            DECIDABLE_QUERY_KINDS.includes(leaf.query.kind) &&
            leaf.chance === undefined,
        ),
      };
      for (const sample of TIME_GRID) {
        const s = at(state(w), sample.time);
        const open = isConnectorOpen(s.regionStates, lock.at.ref, sample.time);
        expect({ lock: lock.id, ...sample, judged: worldConditionVerdict(s, decidable) }).toEqual({
          lock: lock.id,
          ...sample,
          judged: open ? 'met' : 'unmet',
        });
      }
    }
    // ② 원천의 때 — occurrence 조건의 판정이 sourceConditions 와 같다
    for (const source of ALL_SOURCES) {
      const condition = sourceOccurrenceCondition(source);
      if (!condition) continue;
      for (const sample of TIME_GRID) {
        const s = at(state(w), sample.time);
        const codes = sourceConditions(
          s.regionStates,
          source,
          sample.time,
          (s as unknown as { presences: Record<string, never> }).presences,
        );
        const stands = !codes.includes(NOT_THIS_SEASON) && !codes.includes(NOT_THIS_HOUR);
        expect({ source: source.id, ...sample, verdict: verdictOf(s, condition) }).toEqual({
          source: source.id,
          ...sample,
          verdict: stands ? 'met' : 'unmet',
        });
      }
    }
    // ③ 위상 — 철별 덧씌움이 그 철에만 난다
    for (const spec of REGION_SPECS) {
      const keys = Object.keys(spec.phases?.seasons ?? {}) as SeasonId[];
      for (const season of keys) {
        for (const sample of TIME_GRID) {
          const expected = spec.phases!.seasons![season];
          expect({ room: spec.id, key: season, ...sample, isThat: regionPhaseAt(spec.id, sample.time) === expected }).toEqual({
            room: spec.id,
            key: season,
            ...sample,
            isThat: worldClockAt(sample.time).season === season,
          });
        }
      }
    }
    // ④ 결속 — 요구마다의 판정이 lifeUnmetCodes 와 같다
    for (const site of ALL_SITES) {
      for (const requirement of site.requires) {
        const single: LifeSite = { ...site, requires: [requirement] };
        for (const sample of TIME_GRID) {
          const s = at(state(w), sample.time);
          const unmet = lifeUnmetCodes(s.regionStates, single, sample.time).includes(requirement.unmetCode);
          expect({ site: site.id, code: requirement.unmetCode, ...sample, verdict: verdictOf(s, lifeRequirementCondition(requirement)) }).toEqual({
            site: site.id,
            code: requirement.unmetCode,
            ...sample,
            verdict: unmet ? 'unmet' : 'met',
          });
        }
      }
    }
  });

  it('S-333 (SPEC-009 · 기본형 ②) 기회를 유도해도 세계의 State 도 방의 hash 도 한 글자 달라지지 않는다', () => {
    const w = standingIn(REGION_SPECS[0]!.id);
    const before = JSON.stringify(state(w));
    // 방마다 기회를 몇 번을 물어도 — 유도는 저장되지 않는다
    const first = JSON.stringify(allOpportunities());
    const second = JSON.stringify(allOpportunities());
    expect(second).toBe(first);
    expect(JSON.stringify(state(w))).toBe(before);
    // 그리고 방마다 땅의 hash 가 그대로다
    for (const spec of REGION_SPECS) {
      expect({ id: spec.id, hash: standingIn(spec.id).observe().region.hash }).toEqual({
        id: spec.id,
        hash: descriptionHash(spaceOf(spec.id)),
      });
    }
  });

  it('S-334 (SPEC-009) 규칙 코드에 기회의 이름 글자가 없다 — 기회는 판정하지 않는다 (grep 이 증거)', () => {
    const names = ['opportunity', 'discovery', GATHER, CROSS, VISIBLE, SIGNAL, HIDDEN];
    const folder = 'content/world/rules';
    const hits: string[] = [];
    for (const file of readdirSync(`${ROOT}${folder}`).filter((n) => n.endsWith('.ts'))) {
      readFileSync(`${ROOT}${folder}/${file}`, 'utf8')
        .split('\n')
        .forEach((text, index) => {
          for (const name of names) {
            if (text.includes(name)) hits.push(`${folder}/${file}:${index + 1}  ${name}  │ ${text.trim()}`);
          }
        });
    }
    expect(hits.join('\n')).toBe('');
  });

  it('S-335 (Observable 5) world:observe --report 에 기회 표와 수명 표가 선다', () => {
    const run = runTool(OBSERVE, ['--report']);
    expect(run.status).toBe(0);
    // 기회 표 — 방마다 그 방의 기회 id 가 한 줄씩 있다
    for (const one of allOpportunities()) {
      expect({ id: one.id, listed: run.out.includes(one.id) }).toEqual({ id: one.id, listed: true });
    }
    // 수명 표 — C034 가 세운 표의 경로가 그 글에 한 줄씩 있다
    expect(PERSISTENCE_TABLE.length).toBeGreaterThan(0);
    for (const row of PERSISTENCE_TABLE) {
      expect({ path: row.path, listed: run.out.includes(row.path) }).toEqual({ path: row.path, listed: true });
    }
  });
});
