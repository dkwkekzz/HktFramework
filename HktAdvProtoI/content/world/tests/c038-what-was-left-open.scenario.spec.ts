// C038 — 열려 있던 것을 닫는다 · 세계 쪽 검증 시나리오 (spec SPEC-001 ~ SPEC-008 + 회귀 SPEC-009)
//
// 새 의미를 세우는 Cycle 이 아니다 — **약속을 지키는** Cycle 이다. 그래서 재는 것은 여덟이다:
//   ① HIDDEN 거름 — 아직 드러나지 않은 기회의 **이름**이 관찰의 어느 Interaction 에도 실리지
//      않는다. 판정(available · reason · role · 차례)은 한 값도 달라지지 않는다
//   ② 문 — `connector` · `state open` 의 답이 `isConnectorOpen` 과 모든 철 · 모든 문에서 같다
//   ③ 자락 — `area` · `state active` 가 위상이 거는 자락에 참, 아무 위상도 걸지 않는 자락에 **거짓**
//      (모른다가 아니다). 모르는 이름만 판정 불가다
//   ④ 되돌아옴 — `process` · `state phase` 와 `property progress` 가 그 원천의 값 그대로다
//   ⑤ 어휘와 ㊹ — 어휘가 그 셋을 함께 열어 ㊹ 이 그 갈래의 잎을 **통과시킨다**. 어긋난 경로는 fail
//   ⑥ ㊸ 의 뒷면 — 그 방의 것이 아닌 탄생지 키 · 셀 자리가 있는데 빠진 탄생지가 fail 이다
//   ⑦ `--report --at <철>` — 표의 「지금」 이 그 철의 값이고 표 머리가 그것을 밝힌다. 밝히지
//      않으면 갓 선 세계다
//   ⑧ 스러짐 — 지나간 것이 남긴 자리가 스러지면 그 원천의 고갈로 센다 (캔 것은 오르지 않는다).
//      그리고 회귀 — 검사 마흔여덟의 답 · 방 열셋의 hash · 모든 Interaction 의 판정
//
// 세계는 공개 경로로만 본다 — driveWorld 로 굴리고 dispatch 로 요청하고 observe() 를 읽는다.
// 이 Cycle 의 새 구현(content/world/semantic/condition.ts 의 새 읽기 · content/world/projection 의
// 거름 · engine/world-authoring/check.ts 의 ㊸ 뒷면 · tools/world-editor/observe.ts 의 `--at`)은
// **읽지 않았다.** 기대값의 출처는 cycles/C038-what-was-left-open/spec.md 와
// content/protocol/gameview.ts 의 관찰 계약, 그리고 이미 있던 하네스와 선례(c034 ~ c037)뿐이다.
//
// **이름도 자리도 손으로 적지 않는다** — 문은 LOCKS · regionExitsOf 에서, 자락은 방의 space 와
// phases 에서, 원천은 sourcesInRegion 에서, 탄생지는 lifeSitesInRegion 에서, 방은 REGION_SPECS
// 에서 읽는다. 손으로 적는 것은 spec 이 못 박은 글자(discovery 넷 · 조건의 경로 셋 · 검사 번호 ·
// 검사 마흔여덟)와 아래 C037_INTERACTIONS 하나뿐이다.
//
// **전체 개수를 단언하지 않는다** — 기회의 수도 문의 수도 자락의 수도 세지 않는다. 다만 검사의
// 수(마흔여덟)는 spec SPEC-009 가 값으로 못 박은 예외라 그것만 잰다.
//
// **여기서 재지 않는 것** — 판이 짓는 문구는 View 의 표가 소유한다 (c030 · c034 ~ c037 이 세운
// 그 경계 그대로). 세계 쪽에서 잴 수 있는 것은 판이 읽는 값까지다.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { conditionLeaves, type Condition, type ConditionLeaf, type ConditionVerdict } from '../../../engine/world-authoring/condition';
import {
  checkRegions,
  type CheckConditionSite,
  type CheckItem,
  type CheckRegionsInput,
  type CheckReport,
} from '../../../engine/world-authoring/check';
import { descriptionHash } from '../../../engine/world-authoring/description';
import type { WorldSnapshot } from '../../../engine/world-kernel/persistence';
import { FOREST_EDGE, LOCKS, PRESENCE_ROUTES, REGION_SPECS, regionSpec, type SeasonId } from '../../regions';
import { opportunitiesOf } from '../../regions/opportunity';
import type { ActionResult } from '../../protocol/actions';
import type { GameViewSnapshot, InteractionView } from '../../protocol/gameview';
import { createWorld, restoreWorld, type World, type WorldSetup } from '../index';
import { idleAction } from '../semantic/action';
import type { ActorState } from '../semantic/actor';
import { worldClockAt } from '../semantic/clock';
import { worldConditionVerdict } from '../semantic/condition';
import { lifeSitesInRegion, type LifeSite } from '../semantic/life';
import { isConnectorOpen, regionExitsOf } from '../semantic/region';
import { sourcePositionOf, sourceStateOf, sourcesInRegion, type ResourceSource } from '../semantic/resource';
import { INTERACTION_RANGE, TICK_INTERVAL, type WorldState } from '../semantic/world-state';
import { runWorldCheck, worldCheckInput } from '../../../tools/world-editor/check';
import { driveWorld, OBSERVER, type WorldDriver } from './drive';

// ── HIDDEN 을 세우는 자리 (SPEC-001) ──────────────────────────────────
//
// 이 세계의 데이터에는 HIDDEN 이 하나도 없다 (C036 SPEC-001 이 그렇게 적었고 S-601 이 그것을
// 다시 잰다). 그러니 **거름이 실제로 도는지**를 재려면 HIDDEN 인 기회가 있어야 한다. 세계
// 데이터를 고치지 않고, 세계가 기회 목록을 얻는 자리(`opportunitiesOf`) 하나를 하네스로 갈아
// 끼운다 — 그 방의 그 기회 하나의 discovery 만 바꿔 되돌린다. 나머지는 원본 그대로다.
const stage = vi.hoisted(() => ({ region: '', id: '', discovery: '' }));
vi.mock('../../regions/opportunity', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  const listOf = original.opportunitiesOf as (region: string) => readonly unknown[];
  const forAction = original.opportunityForAction as (
    region: string,
    action: string,
    targetRef: string,
  ) => unknown | undefined;
  /** 그 하나만 갈아 끼운다 — 나머지는 원본 그대로 돌려준다 */
  const staged = (region: string, one: unknown): unknown => {
    if (one === undefined || stage.id === '' || region !== stage.region) return one;
    return (one as { id: string }).id === stage.id ? { ...(one as object), discovery: stage.discovery } : one;
  };
  return {
    ...original,
    opportunitiesOf: (region: string): readonly unknown[] => listOf(region).map((one) => staged(region, one)),
    opportunityForAction: (region: string, action: string, targetRef: string): unknown =>
      staged(region, forAction(region, action, targetRef)),
  };
});
/** 그 기회 하나만 그 discovery 로 세워 두고 잰 뒤 되돌린다 */
function withDiscovery<T>(region: string, id: string, discovery: string, body: () => T): T {
  stage.region = region;
  stage.id = id;
  stage.discovery = discovery;
  try {
    return body();
  } finally {
    stage.region = '';
    stage.id = '';
    stage.discovery = '';
  }
}

// ── spec 이 못 박은 글자 (여기 말고는 손으로 적지 않는다) ──────────────
/** discovery 넷 — C036 World Change 1 (이 Cycle 이 거르는 것은 그 가운데 HIDDEN 하나다) */
const HIDDEN = 'HIDDEN';
const SHOWN = ['VISIBLE', 'SIGNAL', 'TRACE'] as const;
/** 유도되는 기회 id 의 자리 — C036 기본형 ⑥ */
const GATHER = 'gather:';
/** 조건이 새로 읽는 경로 셋 — spec World Change 2 가 글자로 적은 그대로 */
const OPEN = 'open';
const ACTIVE = 'active';
const PHASE = 'phase';
const PROGRESS = 'progress';
/** 검사의 이름들 — spec SPEC-005 · SPEC-006 (㊸ 태어남의 키 · ㊹ 조건이 가리키는 것) */
const MEMORY_REFS_ID = 'memory-refs';
const MEMORY_REFS_MARK = '㊸';
const CONDITION_REFS_ID = 'condition-refs';
const CONDITION_REFS_MARK = '㊹';
/** 검사는 마흔여덟 그대로다 — spec SPEC-009 (C036 이 못 박은 값) */
const CHECK_COUNT = 48;
/** 관찰의 role 둘 — C036 SPEC-004 그대로 */
const HARVEST = 'harvest-source';
/** 철 넷 (C015 · C016 그대로) */
const SEASONS: readonly SeasonId[] = ['STILL', 'SEEP', 'LONG_NIGHT', 'TURN'];
/** 채취의 소요 시간 — 행동표가 소유한다. 여기서는 "넉넉히 지난다" 로만 쓴다 (c011~c037 어법) */
const MINE_SECONDS = 1.2;
/** phase 셋 (C012 · C013 그대로) */
const AVAILABLE = 'available';

// ── 하네스 (c034 ~ c037 의 선례 그대로) ───────────────────────────────
const state = (w: WorldDriver) => w.world.snapshot().state as WorldState;
const timeOf = (w: WorldDriver): number => state(w).time;
const spaceOf = (id: string) => regionSpec(id)!.space;
const standingIn = (region: string, extra: WorldSetup = {}): WorldDriver =>
  driveWorld({ npcs: [], actorRegion: region, ...extra });
const bodyOf = (w: WorldDriver, observerId = OBSERVER): string => w.observe(observerId).observer.characterId;

const tickFor = (w: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) w.tick(TICK_INTERVAL);
};
/** 그 조건이 참이 될 때까지 1 세계 초 걸음으로 굴린다 (c023 ~ c037 의 runUntil 그대로) */
function runUntil(w: WorldDriver, done: () => boolean, limitSeconds: number, what: string): number {
  for (let s = 0; s < limitSeconds; s++) {
    if (done()) return s;
    w.tick(1);
  }
  if (done()) return limitSeconds;
  throw new Error(`${limitSeconds} 세계 초 안에 일어나지 않았다 — ${what}`);
}
const mine = (w: WorldDriver, targetEntityId: string, observerId = OBSERVER): ActionResult =>
  w.dispatch({ interactionId: 'mine', targetEntityId }, observerId);
function mineOnce(w: WorldDriver, id: string, observerId = OBSERVER): ActionResult {
  const result = mine(w, id, observerId);
  tickFor(w, MINE_SECONDS + TICK_INTERVAL);
  return result;
}

// ── 저장·복구로 Given 을 세운다 (c035 · c037 의 선례 그대로) ──────────
function wrap(world: World): WorldDriver {
  return {
    dispatch(action, observerId = OBSERVER) {
      world.request(observerId, action);
      const result = world.tick(0).results[0];
      if (!result) throw new Error('요청이 처리되지 않았다');
      return result;
    },
    dispatchForOutcome(action, observerId = OBSERVER) {
      world.request(observerId, action);
      return world.tick(0).outcomes.get(observerId) ?? [];
    },
    tick: (dt) => void world.tick(dt),
    join: (observerId) => world.join(observerId),
    leave: (observerId) => world.leave(observerId),
    mark: (value, observerId = OBSERVER) => world.mark(observerId, value),
    observe(observerId = OBSERVER) {
      const snapshot = world.latestObservation(observerId);
      if (!snapshot) throw new Error(`관찰 결과가 없다 — ${observerId}`);
      return snapshot as GameViewSnapshot;
    },
    world,
  };
}
const throughFile = (snapshot: WorldSnapshot): WorldSnapshot => JSON.parse(JSON.stringify(snapshot)) as WorldSnapshot;
function worldFrom(base: WorldDriver, edit: (s: WorldState) => void): WorldDriver {
  const restored = restoreWorld(throughFile(base.world.snapshot()));
  if (!restored) throw new Error('되살릴 수 없는 스냅샷이다');
  edit(restored);
  const world = createWorld({}, restored);
  world.join(OBSERVER);
  world.tick(0);
  return wrap(world);
}
/** 그 몸을 그 방 그 자리에 세운다 (관성도 하던 행동도 없이) */
function place(s: WorldState, id: string, region: string, spot: { x: number; z: number }) {
  const a = s.actors.find((x: ActorState) => x.id === id)!;
  a.regionId = region;
  a.position = { x: spot.x, z: spot.z };
  a.velocity = { x: 0, z: 0 };
  a.currentAction = idleAction();
}
/** 그 원천 곁에 몸을 세운 세계 (c035 · c037 의 beside 그대로 — 자리는 세계가 안다) */
function beside(w: WorldDriver, source: ResourceSource): WorldDriver {
  const p = sourcePositionOf(state(w).regionStates, source);
  return worldFrom(w, (s) => place(s, bodyOf(w), source.regionId, { x: p.x + INTERACTION_RANGE / 2, z: p.z }));
}

// ── 데이터가 소유하는 이름들 (손으로 적지 않는다) ─────────────────────
const ALL_SOURCES: readonly ResourceSource[] = REGION_SPECS.flatMap((spec) => sourcesInRegion(spec.id));
const ALL_SITES: readonly LifeSite[] = REGION_SPECS.flatMap((spec) => lifeSitesInRegion(spec.id));
const sourceById = (id: string): ResourceSource => {
  const found = ALL_SOURCES.find((s) => s.id === id);
  if (!found) throw new Error(`세계에 원천 '${id}' 가 없다`);
  return found;
};
/** 이 세계의 모든 문 (데이터 차례 그대로 · 겹치는 것은 한 번만) */
const ALL_CONNECTORS: readonly string[] = [
  ...new Set(REGION_SPECS.flatMap((spec) => regionExitsOf(spec.id).map((exit) => exit.connector.id))),
];
/** 경로가 남기는 것 — L2-World-Time 2.6 의 leavesBehind (지나간 것이 남긴 자리의 출처다) */
interface RouteShape {
  id: string;
  presence: string;
  leavesBehind?: readonly string[];
  effectWhilePassing?: unknown;
}
const ROUTES = PRESENCE_ROUTES as unknown as readonly RouteShape[];
const LEFT_BEHIND: readonly string[] = ROUTES.flatMap((r) => [...(r.leavesBehind ?? [])]);

// ── 자락을 데이터에서 갈라낸다 (SPEC-003) ─────────────────────────────
/** 그 값 안의 글자 전부 — 형을 모르는 채로 "무슨 이름을 쓰는가" 만 본다 (c036 · c037 그대로) */
function stringsIn(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (typeof value === 'string') into.add(value);
  else if (Array.isArray(value)) for (const one of value) stringsIn(one, into);
  else if (value !== null && typeof value === 'object') for (const one of Object.values(value)) stringsIn(one, into);
  return into;
}
interface AreaOpShape {
  id: string;
  kind: string;
}
/** 그 방의 자락(area op) 전부 */
const areasIn = (region: string): string[] =>
  (spaceOf(region).ops as unknown as AreaOpShape[]).filter((op) => op.kind === 'area').map((op) => op.id);
/** 그 방의 위상 · 지나감이 이름으로 부르는 것 전부 (덧씌움을 거는 자리들) */
const phaseNamesOf = (region: string): Set<string> => stringsIn((regionSpec(region) as { phases?: unknown }).phases);
const ROUTE_NAMES: ReadonlySet<string> = stringsIn(ROUTES);
/** 그 방 그 철의 위상이 거는 자락 (depthOverlay · hazardExtend 가 부르는 areaId) */
interface OverlayShape {
  areaId: string;
}
interface SeasonPhaseShape {
  depthOverlay?: readonly OverlayShape[];
  hazardExtend?: readonly OverlayShape[];
}
const seasonPhaseOf = (region: string, season: SeasonId): SeasonPhaseShape | undefined =>
  ((regionSpec(region) as { phases?: { seasons?: Record<string, SeasonPhaseShape> } }).phases?.seasons ?? {})[season];
const overlayAreasOf = (region: string, season: SeasonId): string[] => {
  const held = seasonPhaseOf(region, season);
  return [...(held?.depthOverlay ?? []), ...(held?.hazardExtend ?? [])].map((one) => one.areaId);
};
/**
 * **한 철만** 거는 자락 — 그 방의 다른 철도 · 서 있는 위상도 · 깨어남도 · 지나가는 것도
 * 부르지 않는 자락이다. 그래야 "그 철에 걸리고 다른 철에는 걸리지 않는다" 를 잴 수 있다.
 */
function areasOwnedByOneSeason(): { region: string; season: SeasonId; area: string }[] {
  const found: { region: string; season: SeasonId; area: string }[] = [];
  for (const spec of REGION_SPECS) {
    for (const season of SEASONS) {
      const here = overlayAreasOf(spec.id, season);
      const others = new Set(SEASONS.filter((s) => s !== season).flatMap((s) => overlayAreasOf(spec.id, s)));
      // 그 방의 위상 전체가 부르는 이름 가운데 이 철의 덧씌움 밖에서도 불리는 것은 뺀다
      const outsideSeasons = new Set(
        [...phaseNamesOf(spec.id)].filter((name) => !SEASONS.some((s) => overlayAreasOf(spec.id, s).includes(name))),
      );
      for (const area of here) {
        if (others.has(area)) continue;
        if (outsideSeasons.has(area)) continue;
        if (ROUTE_NAMES.has(area)) continue;
        found.push({ region: spec.id, season, area });
      }
    }
  }
  return found;
}
/** 아무 위상도 지나감도 부르지 않는 자락 — 세계에 있고 지금 걸려 있지 않을 뿐이다 */
function areasNoPhaseTouches(): { region: string; area: string }[] {
  const found: { region: string; area: string }[] = [];
  for (const spec of REGION_SPECS) {
    const named = phaseNamesOf(spec.id);
    for (const area of areasIn(spec.id)) {
      if (named.has(area) || ROUTE_NAMES.has(area)) continue;
      found.push({ region: spec.id, area });
    }
  }
  return found;
}

// ── 조건을 시험이 직접 짓는다 (c035 의 leaf 어법 그대로) ───────────────
const leafOf = (
  target: ConditionLeaf['target'],
  query: ConditionLeaf['query'],
  operator: ConditionLeaf['operator'],
  value?: ConditionLeaf['value'],
): ConditionLeaf => ({ target, query, operator, ...(value !== undefined ? { value } : {}) });
const connectorOpen = (ref: string, open: boolean): ConditionLeaf =>
  leafOf({ kind: 'connector', ref }, { kind: 'state', path: OPEN }, '==', open);
const areaActive = (ref: string, active: boolean): ConditionLeaf =>
  leafOf({ kind: 'area', ref }, { kind: 'state', path: ACTIVE }, '==', active);
const processPhase = (ref: string, phase: string): ConditionLeaf =>
  leafOf({ kind: 'process', ref }, { kind: 'state', path: PHASE }, '==', phase);
const processProgress = (ref: string, operator: ConditionLeaf['operator'], value: number): ConditionLeaf =>
  leafOf({ kind: 'process', ref }, { kind: 'property', path: PROGRESS }, operator, value);
const verdict = (w: WorldDriver, condition: Condition): ConditionVerdict => worldConditionVerdict(state(w), condition);
const verdictOf = (s: WorldState, condition: Condition | undefined): ConditionVerdict =>
  condition === undefined ? 'met' : worldConditionVerdict(s, condition);

// ── 원천의 값을 세계에게 직접 묻는 자리 (C012 · C013 의 그 글자) ───────
interface SourceStateShape {
  phase: string;
  progress: number;
}
const sourceValue = (w: WorldDriver, region: string, id: string): SourceStateShape =>
  sourceStateOf(state(w).regionStates, region, id) as unknown as SourceStateShape;

// ── 기회를 읽는 자리 (C036 · C037 이 세운 점 경로) ─────────────────────
interface OpportunityShape {
  id: string;
  region: string;
  availability?: Condition;
  discovery: string;
}
const opportunitiesIn = (region: string): OpportunityShape[] =>
  [...(opportunitiesOf(region) as readonly unknown[])] as OpportunityShape[];
const allOpportunities = (): OpportunityShape[] => REGION_SPECS.flatMap((spec) => opportunitiesIn(spec.id));
/**
 * 지금 관찰에 실리는 채집 기회 하나 — 그 방 · 그 이름 · 그것이 겨냥하는 원천.
 * 손으로 적지 않는다 (세계가 실제로 내미는 것 가운데 고른다).
 */
function shownGatherOpportunity(): { region: string; id: string; source: string } {
  for (const spec of REGION_SPECS) {
    for (const seen of seenIn(spec.id)) {
      const carried = seen.opportunity;
      if (!carried || !carried.id.startsWith(GATHER)) continue;
      if (!(SHOWN as readonly string[]).includes(carried.discovery)) continue;
      if (seen.role !== HARVEST || seen.targetEntityId === undefined) continue;
      if (!opportunitiesIn(spec.id).some((o) => o.id === carried.id)) continue;
      return { region: spec.id, id: carried.id, source: seen.targetEntityId };
    }
  }
  throw new Error('관찰에 실린 채집 기회가 하나도 없다 — HIDDEN 거름을 잴 자리가 없다');
}

// ── 관찰 결과를 읽는 자리 (spec Observable 의 점 경로) ────────────────
interface SeenOpportunity {
  id: string;
  discovery: string;
  event: boolean;
  open: boolean;
}
type SeenInteraction = InteractionView & { opportunity?: SeenOpportunity };
const interactionsIn = (v: GameViewSnapshot): SeenInteraction[] => v.interactions as SeenInteraction[];
const seenIn = (region: string): SeenInteraction[] => interactionsIn(standingIn(region).observe());
/** 줄 하나를 글자로 — `id/role/대상/available/사유` (C036 · C037 의 회귀 어법 그대로) */
const lineOf = (i: SeenInteraction): string =>
  `${i.id}/${i.role}/${i.targetEntityId ?? ''}/${i.available}/${i.reason ?? ''}`;

// ── 방의 기억을 읽는 자리 (C034 의 어법 그대로 · spec State) ──────────
interface SourceMemoryShape {
  takenTotal: number;
  depletedTimes: number;
  lastDepletedAt?: number | null;
}
interface HistoryShape {
  sources?: Record<string, SourceMemoryShape>;
  passages?: Record<string, { times: number; lastAt?: number }>;
}
const historyOf = (w: WorldDriver, region: string): HistoryShape | undefined =>
  (state(w).regionStates as unknown as Record<string, { history?: HistoryShape }>)[region]?.history;
const sourceMemoryOf = (w: WorldDriver, region: string, id: string): SourceMemoryShape | undefined =>
  historyOf(w, region)?.sources?.[id];

// ── 도구를 밖에서 돌린다 (c018 · c034 ~ c037 의 선례 그대로) ───────────
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
describe('SPEC-001 HIDDEN 거름 — 드러나지 않은 것은 이름이 실리지 않는다', () => {
  it('S-601 지금 서는 기회 전부 — 실린 discovery 는 넷 가운데 HIDDEN 이 아닌 셋뿐이다', () => {
    // Given 이 세계의 데이터에는 HIDDEN 이 하나도 없다 (C036 SPEC-001 이 그렇게 적었다)
    for (const one of allOpportunities()) {
      expect({ id: one.id, hidden: one.discovery === HIDDEN }).toEqual({ id: one.id, hidden: false });
    }
    // Then 관찰에 실린 discovery 도 그 셋 안이다 — 방마다 · 기회마다
    let seen = 0;
    for (const spec of REGION_SPECS) {
      for (const one of seenIn(spec.id)) {
        if (!one.opportunity) continue;
        seen++;
        expect({
          region: spec.id,
          id: one.opportunity.id,
          shown: (SHOWN as readonly string[]).includes(one.opportunity.discovery),
        }).toEqual({ region: spec.id, id: one.opportunity.id, shown: true });
      }
    }
    expect({ seen: seen > 0 }).toEqual({ seen: true });
  });

  it('S-602 VISIBLE · SIGNAL · TRACE 는 지금 그대로 실린다 — 갈래마다 실제로 하나씩 보았다', () => {
    const found = new Set<string>();
    for (const spec of REGION_SPECS) {
      for (const one of seenIn(spec.id)) {
        if (one.opportunity) found.add(one.opportunity.discovery);
      }
    }
    // 지금 데이터가 세우는 갈래는 이 셋 안이고, 그 가운데 실제로 선 것이 하나 넘는다
    for (const kind of found) {
      expect({ kind, shown: (SHOWN as readonly string[]).includes(kind) }).toEqual({ kind, shown: true });
    }
    expect({ kinds: found.size > 1 }).toEqual({ kinds: true });
  });

  it('S-603 그 기회를 HIDDEN 으로 세우면 그 이름이 어느 Interaction 에도 실리지 않는다 — 자리 자체가 없다', () => {
    const target = shownGatherOpportunity();
    // Given 하네스가 그 기회 하나만 HIDDEN 으로 갈아 끼웠다 (데이터는 손대지 않는다)
    withDiscovery(target.region, target.id, HIDDEN, () => {
      expect({ staged: opportunitiesIn(target.region).find((o) => o.id === target.id)?.discovery }).toEqual({
        staged: HIDDEN,
      });
      // Then 그 이름이 그 방의 어느 줄에도 없다 — `opportunity` 자리가 아예 서지 않는다
      const list = seenIn(target.region);
      const carried = list.find((i) => i.opportunity?.id === target.id);
      expect({ id: target.id, carried: carried !== undefined }).toEqual({ id: target.id, carried: false });
      const holder = list.find((i) => i.role === HARVEST && i.targetEntityId === target.source);
      expect(holder, 'HIDDEN 이 되자 그 행동의 줄 자체가 사라졌다 — 숨는 것은 이름이지 행동이 아니다').toBeDefined();
      expect({ target: target.source, has: 'opportunity' in holder! }).toEqual({
        target: target.source,
        has: false,
      });
    });
  });

  it('S-604 (경계 ①) available · reason · role · 차례가 한 값도 달라지지 않는다', () => {
    const target = shownGatherOpportunity();
    const before = seenIn(target.region).map(lineOf);
    const after = withDiscovery(target.region, target.id, HIDDEN, () => seenIn(target.region).map(lineOf));
    expect({ region: target.region, lines: after }).toEqual({ region: target.region, lines: before });
  });

  it('S-605 (경계 ②) 셋 가운데 어느 것으로 세워도 그 이름은 그대로 실린다', () => {
    const target = shownGatherOpportunity();
    for (const kind of SHOWN) {
      withDiscovery(target.region, target.id, kind, () => {
        const carried = seenIn(target.region).find((i) => i.opportunity?.id === target.id)?.opportunity;
        expect({ kind, id: carried?.id, discovery: carried?.discovery }).toEqual({
          kind,
          id: target.id,
          discovery: kind,
        });
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-002 조건이 문을 읽는다', () => {
  it('S-611 시험이 지은 조건의 답이 isConnectorOpen 과 모든 철 · 모든 문에서 같다', () => {
    const mismatches: string[] = [];
    let openSeen = 0;
    let closedSeen = 0;
    for (const season of SEASONS) {
      const w = standingIn(REGION_SPECS[0]!.id, { clock: season } as WorldSetup);
      const s = state(w);
      for (const connector of ALL_CONNECTORS) {
        const open = isConnectorOpen(s.regionStates, connector, s.time);
        if (open) openSeen++;
        else closedSeen++;
        const isTrue = verdict(w, connectorOpen(connector, true));
        const isFalse = verdict(w, connectorOpen(connector, false));
        if (isTrue !== (open ? 'met' : 'unmet') || isFalse !== (open ? 'unmet' : 'met')) {
          mismatches.push(`${season} ${connector}  open=${open}  ==true:${isTrue}  ==false:${isFalse}`);
        }
      }
    }
    expect(mismatches.slice(0, 5).join('\n')).toBe('');
    // 열린 문과 잠긴 문을 둘 다 보았다 — 한쪽만 보면 이 항이 헛돈다
    expect({ open: openSeen > 0, closed: closedSeen > 0 }).toEqual({ open: true, closed: true });
    // 그리고 잠긴 문이 실제로 Lock 이 걸린 문이다 (데이터가 그것을 소유한다)
    expect({ locks: LOCKS.length > 0 }).toEqual({ locks: true });
  });

  it('S-612 (경계) 세계가 모르는 문 이름은 판정 불가다 — 없는 것과 모르는 것은 다르다', () => {
    const w = standingIn(REGION_SPECS[0]!.id);
    expect(verdict(w, connectorOpen('NO_SUCH_CONNECTOR', true))).toBe('undecidable');
    expect(verdict(w, connectorOpen('NO_SUCH_CONNECTOR', false))).toBe('undecidable');
    // 어긋난 경로도 마찬가지다 — 이 어휘가 여는 것은 `open` 하나다
    expect(
      verdict(w, leafOf({ kind: 'connector', ref: ALL_CONNECTORS[0]! }, { kind: 'state', path: 'opened' }, '==', true)),
    ).toBe('undecidable');
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-003 조건이 자락을 읽는다', () => {
  it('S-621 위상이 거는 자락은 그 철에 참이고 다른 철에는 거짓이다', () => {
    const owned = areasOwnedByOneSeason();
    expect({ owned: owned.length > 0 }).toEqual({ owned: true });
    for (const one of owned) {
      for (const season of SEASONS) {
        const w = standingIn(one.region, { clock: season } as WorldSetup);
        const expected = season === one.season;
        expect({ area: one.area, season, active: verdict(w, areaActive(one.area, true)) }).toEqual({
          area: one.area,
          season,
          active: expected ? 'met' : 'unmet',
        });
      }
    }
  });

  it('S-622 (경계) 아무 위상도 걸지 않는 자락은 **거짓**이다 — 모른다가 아니다', () => {
    const untouched = areasNoPhaseTouches();
    expect({ untouched: untouched.length > 0 }).toEqual({ untouched: true });
    for (const one of untouched.slice(0, 8)) {
      const w = standingIn(one.region);
      expect({ area: one.area, active: verdict(w, areaActive(one.area, true)) }).toEqual({
        area: one.area,
        active: 'unmet',
      });
      expect({ area: one.area, inactive: verdict(w, areaActive(one.area, false)) }).toEqual({
        area: one.area,
        inactive: 'met',
      });
    }
  });

  it('S-623 (경계) 세계가 모르는 자락 이름만 판정 불가다', () => {
    const w = standingIn(REGION_SPECS[0]!.id);
    expect(verdict(w, areaActive('no-such-area', true))).toBe('undecidable');
    const known = areasNoPhaseTouches()[0]!;
    expect(
      verdict(w, leafOf({ kind: 'area', ref: known.area }, { kind: 'state', path: 'awake' }, '==', true)),
    ).toBe('undecidable');
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-004 조건이 되돌아옴을 읽는다', () => {
  it('S-631 phase 의 답이 그 원천의 phase 그대로다 — 방마다 · 원천마다 · 철마다', () => {
    const mismatches: string[] = [];
    const phasesSeen = new Set<string>();
    for (const season of SEASONS) {
      for (const spec of REGION_SPECS) {
        const w = standingIn(spec.id, { clock: season } as WorldSetup);
        for (const source of sourcesInRegion(spec.id)) {
          const phase = sourceValue(w, spec.id, source.id).phase;
          phasesSeen.add(phase);
          const same = verdict(w, processPhase(source.id, phase));
          if (same !== 'met') mismatches.push(`${season} ${spec.id} ${source.id}  phase=${phase}  →${same}`);
          const other = verdict(w, processPhase(source.id, `not-${phase}`));
          if (other !== 'unmet') mismatches.push(`${season} ${spec.id} ${source.id}  아닌 값이 ${other}`);
        }
      }
    }
    expect(mismatches.slice(0, 5).join('\n')).toBe('');
    // 마디를 하나 넘게 보았다 — 한 값만 보면 이 항이 헛돈다
    expect({ phases: phasesSeen.size > 1 }).toEqual({ phases: true });
  });

  it('S-632 progress 의 답이 되돌아옴의 진행 그대로다 — 굴러가는 동안 내내', () => {
    const w = standingIn(FOREST_EDGE);
    const source = sourcesInRegion(FOREST_EDGE)[0]!;
    const mismatches: string[] = [];
    const values = new Set<number>();
    for (let i = 0; i < 240; i++) {
      w.tick(1);
      const progress = sourceValue(w, FOREST_EDGE, source.id).progress;
      values.add(progress);
      const same = verdict(w, processProgress(source.id, '==', progress));
      const above = verdict(w, processProgress(source.id, '>', progress));
      if (same !== 'met' || above !== 'unmet') {
        mismatches.push(`t=${timeOf(w)} ${source.id} progress=${progress}  ==:${same}  >:${above}`);
      }
    }
    expect(mismatches.slice(0, 5).join('\n')).toBe('');
    expect({ progressed: values.size > 0 }).toEqual({ progressed: true });
  });

  it('S-633 (경계) 세계가 모르는 이름은 여전히 판정 불가다 (없는 것과 모르는 것은 다르다)', () => {
    const w = standingIn(FOREST_EDGE);
    expect(verdict(w, processPhase('NO_SUCH_SOURCE', AVAILABLE))).toBe('undecidable');
    expect(verdict(w, processProgress('NO_SUCH_SOURCE', '>=', 0))).toBe('undecidable');
    // 어긋난 경로도 판정 불가다 — 이 어휘가 여는 것은 phase 와 progress 뿐이다
    const known = sourcesInRegion(FOREST_EDGE)[0]!;
    expect(verdict(w, leafOf({ kind: 'process', ref: known.id }, { kind: 'state', path: 'progress' }, '>=', 0))).toBe(
      'undecidable',
    );
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-005 어휘가 함께 넓어진다 — 검사 ㊹ 이 그 잎을 통과시킨다', () => {
  const report = runWorldCheck();
  const itemById = (r: CheckReport, id: string): CheckItem | undefined => r.items.find((i) => i.id === id);
  /** 검사의 입력에 자리 하나를 더한다 — 데이터는 손대지 않는다 (c035 · c036 withGhost 의 어법) */
  function withGhost(ghost: CheckConditionSite): CheckRegionsInput {
    const input = worldCheckInput();
    if (!input.condition) throw new Error('worldCheckInput 이 조건 쪽 계약(condition)을 주지 않는다');
    return { ...input, condition: { ...input.condition, sites: [...input.condition.sites, ghost] } };
  }
  const statusWith = (where: string, condition: Condition): string | undefined =>
    itemById(checkRegions(withGhost({ where, condition })), CONDITION_REFS_ID)?.status;

  it('S-641 문 · 자락 · 되돌아옴을 묻는 잎을 넣으면 ㊹ 이 그것을 통과시킨다 (전에는 어휘 밖이라 걸렸다)', () => {
    const connector = ALL_CONNECTORS[0]!;
    const area = areasNoPhaseTouches()[0]!.area;
    const source = ALL_SOURCES[0]!.id;
    const cases: { name: string; condition: Condition }[] = [
      { name: 'connector-open', condition: connectorOpen(connector, true) },
      { name: 'area-active', condition: areaActive(area, true) },
      { name: 'process-phase', condition: processPhase(source, AVAILABLE) },
      { name: 'process-progress', condition: processProgress(source, '>=', 0) },
    ];
    for (const one of cases) {
      expect({ name: one.name, status: statusWith(`c038-test:${one.name}`, one.condition) }).toEqual({
        name: one.name,
        status: 'pass',
      });
    }
  });

  it('S-642 (경계) 어긋난 경로 · 유령 이름은 여전히 fail 이다', () => {
    const connector = ALL_CONNECTORS[0]!;
    const area = areasNoPhaseTouches()[0]!.area;
    const source = ALL_SOURCES[0]!.id;
    const cases: { name: string; condition: Condition }[] = [
      {
        name: 'connector-bad-path',
        condition: leafOf({ kind: 'connector', ref: connector }, { kind: 'state', path: 'opened' }, '==', true),
      },
      { name: 'connector-ghost', condition: connectorOpen('NO_SUCH_CONNECTOR', true) },
      {
        name: 'area-bad-path',
        condition: leafOf({ kind: 'area', ref: area }, { kind: 'state', path: 'awake' }, '==', true),
      },
      { name: 'area-ghost', condition: areaActive('no-such-area', true) },
      {
        name: 'process-bad-path',
        condition: leafOf({ kind: 'process', ref: source }, { kind: 'property', path: 'phase' }, '==', AVAILABLE),
      },
      { name: 'process-ghost', condition: processPhase('NO_SUCH_SOURCE', AVAILABLE) },
    ];
    for (const one of cases) {
      expect({ name: one.name, status: statusWith(`c038-test:${one.name}`, one.condition) }).toEqual({
        name: one.name,
        status: 'fail',
      });
    }
  });

  it('S-643 (경계) 지금 데이터에는 그 갈래의 조건이 하나도 없으므로 ㊹ 의 답이 달라지지 않는다', () => {
    const item = itemById(report, CONDITION_REFS_ID);
    expect(item, '보고에 condition-refs 가 없다').toBeDefined();
    expect({ mark: item!.mark, status: item!.status }).toEqual({ mark: CONDITION_REFS_MARK, status: 'pass' });
    // 세계가 실제로 쓰는 조건 자리 가운데 새 갈래를 묻는 것은 하나도 없다
    const input = worldCheckInput();
    const kinds = input.condition!.sites.flatMap((site) =>
      conditionLeaves(site.condition).map((one) => one.target.kind),
    );
    for (const kind of ['area', 'process'] as const) {
      expect({ kind, used: kinds.includes(kind) }).toEqual({ kind, used: false });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-006 ㊸ 의 태어남 뒷면 — 방마다 견준다', () => {
  type Bag = Record<string, unknown>;
  interface MemoryRegionShape {
    id: string;
    formations: string[];
  }
  const memoryRegions = (input: CheckRegionsInput): MemoryRegionShape[] =>
    ((input.memory as unknown as Bag).regions as MemoryRegionShape[]).map((one) => ({
      ...one,
      formations: [...one.formations],
    }));
  /** 방마다의 탄생지 목록을 갈아 끼운 입력 — 데이터는 손대지 않는다 (c035 · c036 withGhost 의 어법) */
  function withFormations(edit: (regions: MemoryRegionShape[]) => void): CheckRegionsInput {
    const input = worldCheckInput();
    const regions = memoryRegions(input);
    edit(regions);
    return { ...input, memory: { ...(input.memory as unknown as Bag), regions } } as unknown as CheckRegionsInput;
  }
  const statusOf = (report: CheckReport): string | undefined =>
    report.items.find((i) => i.id === MEMORY_REFS_ID)?.status;
  /** 탄생지를 하나 넘게 가진 세계다 — 없으면 이 항을 세울 수 없다 */
  const someSite = (): { region: string; site: string; other: string } => {
    const withSites = REGION_SPECS.map((spec) => ({ region: spec.id, sites: lifeSitesInRegion(spec.id) })).filter(
      (one) => one.sites.length > 0,
    );
    if (withSites.length < 2) throw new Error('탄생지를 가진 방이 둘보다 적다 — 뒷면을 잴 자리가 없다');
    return {
      region: withSites[0]!.region,
      site: withSites[0]!.sites[0]!.id,
      other: withSites[1]!.sites[0]!.id,
    };
  };

  it('S-651 ㊸ 이 지금 통과이고 그 답이 세계의 탄생지 수를 든다', () => {
    const item = runWorldCheck().items.find((i) => i.mark === MEMORY_REFS_MARK);
    expect(item, `보고에 검사 ${MEMORY_REFS_MARK} 가 없다`).toBeDefined();
    expect({ id: item!.id, status: item!.status }).toEqual({ id: MEMORY_REFS_ID, status: 'pass' });
    expect(ALL_SITES.length).toBeGreaterThan(0);
    expect(new RegExp(`태어남[^0-9]{0,8}${ALL_SITES.length}`).test(item!.answer)).toBe(true);
    // 손대지 않은 입력은 그대로 통과다 — 검사가 헛돌지 않는다
    expect(statusOf(checkRegions(withFormations(() => {})))).toBe('pass');
  });

  it('S-652 (①) 그 방의 것이 아닌 탄생지 키를 넣으면 fail 이다', () => {
    const one = someSite();
    const broken = checkRegions(
      withFormations((regions) => {
        const here = regions.find((r) => r.id === one.region)!;
        here.formations = [...here.formations, one.other];
      }),
    );
    expect(statusOf(broken)).toBe('fail');
    expect(broken.ok).toBe(false);
  });

  it('S-653 (②) 셀 자리가 있는데 목록에서 빠진 탄생지가 있으면 fail 이다', () => {
    const one = someSite();
    const broken = checkRegions(
      withFormations((regions) => {
        const here = regions.find((r) => r.id === one.region)!;
        here.formations = here.formations.filter((id) => id !== one.site);
      }),
    );
    expect(statusOf(broken)).toBe('fail');
    expect(broken.ok).toBe(false);
  });

  it('S-654 (경계) 계통을 주지 않으면 뒷면은 재지 않는다 — 없는 계약을 거짓으로 읽지 않는다', () => {
    const one = someSite();
    const input = withFormations((regions) => {
      const here = regions.find((r) => r.id === one.region)!;
      here.formations = here.formations.filter((id) => id !== one.site);
    });
    const withoutLife = { ...input, life: undefined } as unknown as CheckRegionsInput;
    expect(statusOf(checkRegions(withoutLife))).not.toBe('fail');
  });

  it('S-655 (경계) 원천 · 경로의 잣대는 그대로다 — 없는 원천 키를 넣으면 여전히 fail 이다', () => {
    const input = worldCheckInput();
    const regions = ((input.memory as unknown as Bag).regions as { id: string; sources: string[] }[]).map((one) => ({
      ...one,
      sources: [...one.sources],
    }));
    regions[0]!.sources = [...regions[0]!.sources, 'NO_SUCH_SOURCE'];
    const broken = checkRegions({
      ...input,
      memory: { ...(input.memory as unknown as Bag), regions },
    } as unknown as CheckRegionsInput);
    expect(statusOf(broken)).toBe('fail');
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-007 표가 묻는 때를 보인다 — `--report --at <철>`', () => {
  /** 그 표의 머리줄과 행들 — 표는 「어디에」 로 시작하는 머리 뒤에 이어진다 */
  function tableOf(out: string, opening: RegExp): { head: string; rows: string[] } {
    const lines = out.split('\n');
    const start = lines.findIndex((line) => opening.test(line));
    if (start < 0) throw new Error(`보고에 그 표가 없다 — ${opening}`);
    const rows: string[] = [];
    for (let i = start + 2; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.trim() === '' || /^\s*-{10,}\s*$/.test(line)) break;
      rows.push(line.trimEnd());
    }
    return { head: lines[start]!, rows };
  }
  const conditionTable = (out: string) => tableOf(out, /^\s*조건 \d+ \(/);
  const opportunityTable = (out: string) => tableOf(out, /^\s*기회 \d+ \(/);
  /** 그 철의 갓 선 세계 (도구가 세우는 것과 같은 자리 — clock 손잡이가 그 철의 첫 때를 준다) */
  const worldAt = (season: SeasonId): WorldState => state(standingIn(REGION_SPECS[0]!.id, { clock: season } as WorldSetup));
  /** 조건 표의 행 차례 — 검사가 세는 자리의 잎 차례 그대로다 */
  const conditionLeavesInOrder = (): ConditionLeaf[] =>
    worldCheckInput().condition!.sites.flatMap((site) => conditionLeaves(site.condition));
  /** 기회 표의 행 차례 — 방 차례 · 그 방의 기회 차례 */
  const opportunitiesInOrder = (): OpportunityShape[] => allOpportunities();

  const plain = runTool(OBSERVE, ['--report']);
  const atLongNight = runTool(OBSERVE, ['--report', '--at', 'LONG_NIGHT']);
  const born = worldClockAt(0).season as SeasonId;

  it('S-661 조건 표의 「지금」 이 그 철의 값이다 — 행마다 견준다', () => {
    expect({ status: atLongNight.status, err: atLongNight.err.slice(0, 200) }).toEqual({ status: 0, err: '' });
    const before = conditionTable(plain.out);
    const after = conditionTable(atLongNight.out);
    expect({ rows: after.rows.length }).toEqual({ rows: before.rows.length });
    const leaves = conditionLeavesInOrder();
    expect({ leaves: leaves.length }).toEqual({ leaves: before.rows.length });
    const t0 = worldAt(born);
    const night = worldAt('LONG_NIGHT');
    let changed = 0;
    for (let i = 0; i < leaves.length; i++) {
      const expectedChange = verdictOf(t0, leaves[i]!) !== verdictOf(night, leaves[i]!);
      if (expectedChange) changed++;
      expect({ row: i, changed: before.rows[i] !== after.rows[i] }).toEqual({ row: i, changed: expectedChange });
    }
    // 실제로 달라진 행이 있다 — 하나도 없으면 이 항이 헛돈다
    expect({ changed: changed > 0 }).toEqual({ changed: true });
  });

  it('S-662 기회 표의 「지금」 도 그 철의 값이다 — 행마다 견준다', () => {
    const before = opportunityTable(plain.out);
    const after = opportunityTable(atLongNight.out);
    expect({ rows: after.rows.length }).toEqual({ rows: before.rows.length });
    const list = opportunitiesInOrder();
    expect({ list: list.length }).toEqual({ list: before.rows.length });
    const t0 = worldAt(born);
    const night = worldAt('LONG_NIGHT');
    let changed = 0;
    for (let i = 0; i < list.length; i++) {
      const expectedChange =
        verdictOf(t0, list[i]!.availability) === 'met' !== (verdictOf(night, list[i]!.availability) === 'met');
      if (expectedChange) changed++;
      expect({ row: i, id: list[i]!.id, changed: before.rows[i] !== after.rows[i] }).toEqual({
        row: i,
        id: list[i]!.id,
        changed: expectedChange,
      });
    }
    expect({ changed: changed > 0 }).toEqual({ changed: true });
  });

  it('S-663 표 머리가 어느 때의 값인지 밝힌다', () => {
    for (const table of [conditionTable, opportunityTable]) {
      expect({ head: table(atLongNight.out).head.includes('LONG_NIGHT') }).toEqual({ head: true });
      // 밝히지 않은 보고의 머리는 그 철을 말하지 않는다 — 갓 선 세계다
      expect({ head: table(plain.out).head.includes('LONG_NIGHT') }).toEqual({ head: false });
    }
  });

  it('S-664 (경계) `--at` 없이 돌리면 지금과 글자까지 같고, 갓 선 세계의 철을 밝히면 그 값이 같다', () => {
    // 두 번 돌려도 글자까지 같다 (읽기 전용이다)
    expect(runTool(OBSERVE, ['--report']).out).toBe(plain.out);
    // 그리고 갓 선 세계의 철을 밝히면 표의 행이 한 글자도 달라지지 않는다
    const atBorn = runTool(OBSERVE, ['--report', '--at', born]);
    expect({ status: atBorn.status }).toEqual({ status: 0 });
    expect(conditionTable(atBorn.out).rows).toEqual(conditionTable(plain.out).rows);
    expect(opportunityTable(atBorn.out).rows).toEqual(opportunityTable(plain.out).rows);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-008 스러짐이 고갈로 센다', () => {
  /** 지나간 것이 남기는 자리 하나 — 데이터가 그 이름을 소유한다 (지금은 비늘과 먹이 잔해다) */
  const leftBehind = (): ResourceSource => {
    const found = LEFT_BEHIND.map((id) => sourceById(id)).find((s) => s.regionId === FOREST_EDGE);
    if (!found) throw new Error(`${FOREST_EDGE} 에 지나간 것이 남기는 자리가 없다`);
    return found;
  };
  const phaseOf = (w: WorldDriver, id: string): string => sourceValue(w, FOREST_EDGE, id).phase;
  /** 그 자리가 서고 · 아무도 손대지 않은 채 스러질 때까지 굴린다 */
  function untilFaded(w: WorldDriver, id: string): { stoodAt: number; fadedAt: number } {
    runUntil(w, () => phaseOf(w, id) === AVAILABLE, 1200, `${id} 가 그 자리에 서는 것`);
    const stoodAt = timeOf(w);
    runUntil(w, () => phaseOf(w, id) !== AVAILABLE, 1200, `${id} 가 스러지는 것`);
    return { stoodAt, fadedAt: timeOf(w) };
  }

  it('S-671 스러지면 그 원천의 depletedTimes 가 1 오르고 lastDepletedAt 이 그때다 — takenTotal 은 오르지 않는다', () => {
    const source = leftBehind();
    const w = standingIn(FOREST_EDGE);
    // Given 아직 아무 기억도 없다
    expect(sourceMemoryOf(w, FOREST_EDGE, source.id)).toBeUndefined();
    // When 지나간 것이 남긴 자리가 서고, 아무도 줍지 않은 채 머무는 동안이 지난다
    const { stoodAt, fadedAt } = untilFaded(w, source.id);
    // Then 그 원천의 고갈이 하나 오르고 그 시각이 남는다 — 캔 것은 0 그대로다
    const memory = sourceMemoryOf(w, FOREST_EDGE, source.id);
    expect(memory, '스러진 자리가 방의 기억에 남지 않았다').toBeDefined();
    expect({ takenTotal: memory!.takenTotal, depletedTimes: memory!.depletedTimes }).toEqual({
      takenTotal: 0,
      depletedTimes: 1,
    });
    expect(memory!.lastDepletedAt!).toBeGreaterThanOrEqual(stoodAt);
    expect(memory!.lastDepletedAt!).toBeLessThanOrEqual(fadedAt);
  });

  it('S-672 (경계 ①) 주워서 고갈된 것과 셈이 갈리지 않는다 — 같은 열쇠로 같은 셈을 센다', () => {
    const source = leftBehind();
    // ① 스러진 자리의 기억
    const fadedWorld = standingIn(FOREST_EDGE);
    untilFaded(fadedWorld, source.id);
    const faded = sourceMemoryOf(fadedWorld, FOREST_EDGE, source.id)!;
    // ② 주워서 고갈된 자리의 기억 (같은 원천을 그 자리에 서자마자 캔다)
    const base = standingIn(FOREST_EDGE, { actorItems: { pickaxe: 9 } } as WorldSetup);
    runUntil(base, () => phaseOf(base, source.id) === AVAILABLE, 1200, `${source.id} 가 그 자리에 서는 것`);
    const taken = beside(base, source);
    expect(mineOnce(taken, source.id).status).toBe('success');
    const mined = sourceMemoryOf(taken, FOREST_EDGE, source.id)!;
    // Then 두 기억의 열쇠가 같다 — 세계가 스러짐을 따로 말하지 않는다
    expect(Object.keys(faded).sort()).toEqual(Object.keys(mined).sort());
    expect({ depletedTimes: faded.depletedTimes }).toEqual({ depletedTimes: mined.depletedTimes });
    // 갈리는 것은 캔 것뿐이다 (스러진 것은 아무도 캐지 않았다)
    expect({ faded: faded.takenTotal, mined: mined.takenTotal }).toEqual({ faded: 0, mined: 1 });
    // 그리고 방의 기억 어디에도 스러짐을 따로 세는 자리가 없다
    const text = JSON.stringify(historyOf(fadedWorld, FOREST_EDGE));
    for (const word of ['fade', 'Fade', 'faded', 'fadedTimes']) {
      expect({ word, said: text.includes(word) }).toEqual({ word, said: false });
    }
  });

  it('S-673 (경계 ②) 스러지지 않은 자리의 셈은 달라지지 않는다 — 주워 간 자리도 아직 머무는 자리도', () => {
    const source = leftBehind();
    // ① 주워 간 자리 — 그 뒤로 머무는 동안이 지나도 셈이 더 오르지 않는다 (그 자리는 이미 없다)
    const base = standingIn(FOREST_EDGE, { actorItems: { pickaxe: 9 } } as WorldSetup);
    runUntil(base, () => phaseOf(base, source.id) === AVAILABLE, 1200, `${source.id} 가 그 자리에 서는 것`);
    const taken = beside(base, source);
    expect(mineOnce(taken, source.id).status).toBe('success');
    const afterTaking = { ...sourceMemoryOf(taken, FOREST_EDGE, source.id)! };
    for (let i = 0; i < 400; i++) taken.tick(1);
    expect({ depletedTimes: sourceMemoryOf(taken, FOREST_EDGE, source.id)!.depletedTimes }).toEqual({
      depletedTimes: afterTaking.depletedTimes,
    });
    expect({ takenTotal: sourceMemoryOf(taken, FOREST_EDGE, source.id)!.takenTotal }).toEqual({
      takenTotal: afterTaking.takenTotal,
    });

    // ② 지나간 것이 남긴 자리가 아닌 원천 — 아무도 손대지 않았으면 기억 자체가 서지 않는다
    const quiet = standingIn(FOREST_EDGE);
    untilFaded(quiet, source.id);
    for (const other of sourcesInRegion(FOREST_EDGE)) {
      if ((LEFT_BEHIND as readonly string[]).includes(other.id)) continue;
      expect({ source: other.id, memory: sourceMemoryOf(quiet, FOREST_EDGE, other.id) }).toEqual({
        source: other.id,
        memory: undefined,
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
//
// C037 의 세계가 낸 답 — **이 Cycle 이 한 값도 바꾸지 않아야 하는 것**.
//
// spec SPEC-009 가 "모든 Interaction 의 available · reason · 순서가 C037 과 같다" 를 못 박았으므로,
// C037 이 닫힌 자리의 세계가 방마다 낸 줄을 그대로 받아 적었다 (그 표는 C035 · C036 이 낸 답
// 그대로이기도 하다 — 기회가 붙어도 때가 붙어도 판정은 한 값도 달라지지 않았다).
// 줄 하나는 `id/role/대상/available/사유` 다.
const C037_INTERACTIONS: Readonly<Record<string, readonly string[]>> = {
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
  it('S-681 (SPEC-009) 방마다 available · reason · role · 순서가 C037 과 한 값도 다르지 않다', () => {
    for (const spec of REGION_SPECS) {
      expect({ region: spec.id, lines: seenIn(spec.id).map(lineOf) }).toEqual({
        region: spec.id,
        lines: [...(C037_INTERACTIONS[spec.id] ?? [])],
      });
    }
  });

  it('S-682 (SPEC-009) 검사가 마흔여덟 그대로이고 통과이며, 두 번 돌려도 글자까지 같다', () => {
    const first: CheckReport = runWorldCheck();
    expect(first.items.length).toBe(CHECK_COUNT);
    expect({ fail: first.counts.fail, ok: first.ok }).toEqual({ fail: 0, ok: true });
    for (const item of first.items) {
      expect({ id: item.id, failed: item.status === 'fail' }).toEqual({ id: item.id, failed: false });
    }
    expect(JSON.stringify(runWorldCheck())).toBe(JSON.stringify(first));
  });

  it('S-683 (SPEC-009) 방 열셋의 hash 가 그대로이고, 조건을 물어도 세계의 State 가 달라지지 않는다', () => {
    for (const spec of REGION_SPECS) {
      expect({ id: spec.id, hash: standingIn(spec.id).observe().region.hash }).toEqual({
        id: spec.id,
        hash: descriptionHash(spaceOf(spec.id)),
      });
    }
    // 조건을 묻는 것은 읽기다 — 물어도 세계가 달라지지 않는다 (C035 가 세운 규율 그대로)
    const w = standingIn(FOREST_EDGE);
    const before = JSON.stringify(state(w));
    verdict(w, connectorOpen(ALL_CONNECTORS[0]!, true));
    verdict(w, areaActive(areasNoPhaseTouches()[0]!.area, true));
    verdict(w, processPhase(ALL_SOURCES[0]!.id, AVAILABLE));
    expect(JSON.stringify(state(w))).toBe(before);
  });

  it('S-684 (SPEC-009) 기회의 유도가 C037 과 같다 — 방마다의 이름과 discovery 가 두 번 읽어도 같다', () => {
    const first = JSON.stringify(allOpportunities());
    expect(JSON.stringify(allOpportunities())).toBe(first);
    for (const spec of REGION_SPECS) {
      // 그 방의 기회 이름이 관찰에 실린 이름을 다 덮는다 (문의 저쪽 끝만 예외다 · C036 S-321)
      const here = new Set(opportunitiesIn(spec.id).map((o) => o.id));
      for (const seen of seenIn(spec.id)) {
        const carried = seen.opportunity;
        if (!carried) continue;
        expect({ region: spec.id, id: carried.id, known: here.has(carried.id) || seen.role !== HARVEST }).toEqual({
          region: spec.id,
          id: carried.id,
          known: true,
        });
      }
    }
  });
});
