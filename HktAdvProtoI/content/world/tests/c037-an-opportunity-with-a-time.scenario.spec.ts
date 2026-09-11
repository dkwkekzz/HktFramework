// C037 — 때가 있는 기회 · 세계 쪽 검증 시나리오 (spec SPEC-001 ~ SPEC-008 + 회귀 SPEC-009)
//
// C036 까지 기회는 **늘 거기 있는 것**이었다 — 이름과 discovery 가 붙었을 뿐 availability 는 한
// 번도 평가되지 않았고, 「지금은 없다」 를 말할 자리도 없었다. 이 Cycle 이 그 조건을 **때**로
// 읽는다. 그래서 재는 것은 여덟이다:
//   ① Event — availability 에 시간 qualifier 가 있는 기회가 Event 다. 이 세계의 Event 는 둘이고
//      (경로가 남기는 것 둘 — 비늘 · 먹이 잔해) 나머지는 아니다
//   ② 열림 — 그 경로가 이 방을 지난 시각으로부터 그 초 안이면 열려 있다. **그 답이 원천의
//      phase 판정(캘 수 있는가)과 모든 때에 같다.** 지나기 전은 닫힘이고, 주워 고갈되면 닫히며
//      시간이 그것을 되돌리지 않는다
//   ③ 판정 셋 — 참이면 열림 · 거짓이면 닫힘 · **판정 불가면 열지 않는다** (문의 cross 가 그것이고
//      그 줄은 C036 과 한 값도 다르지 않다)
//   ④ 판이 읽는 값 — 실리는 자리는 넷뿐이다(id · discovery · event · open). "N초 뒤" 도 무엇이
//      여는지(고래)도 어느 자리에도 없다
//   ⑤ outcomes — 주움의 world op 가 표 안이고 얻는 것이 Yield 표의 열이다. ㊺ 가 통과한다
//   ⑥ Yield 표 — 열 열넷이 서고 2층이 실제로 쓰는 것은 앞 넷뿐이다 (뒤 열은 0 인 채로 선다)
//   ⑦ 태어남의 셈 — 탄생지에서 하나가 태어나면 그 방의 기억이 오르고, 뒤척임도 되살리기도 그것을
//      지우지 못한다. 그 자리가 없는 옛 스냅샷을 되살려도 세계가 서고 셈은 0 에서 시작한다
//   ⑧ 도구 셋과 회귀 — brief 의 열셋째 답 · 등급 셋(A · B · C) · lab 편중 요약의 ㊻ · observe 의
//      「지금」 열, 그리고 검사 마흔여덟의 답 · 방 열셋의 hash · 모든 판정이 C036 과 같다
//
// 세계는 공개 경로로만 본다 — driveWorld 로 굴리고 dispatch 로 요청하고 observe() 를 읽는다.
// 이 Cycle 의 새 구현(content/regions/opportunity.ts 의 새 데이터 · content/world/rules 의 새
// 규칙 · engine 의 Yield 표 · check · grade · brief 의 새 본문 · content/view/**)은 **읽지 않았다.**
// 기대값의 출처는 cycles/C037-an-opportunity-with-a-time/spec.md 와 content/protocol/gameview.ts 의
// 관찰 계약(InteractionView.opportunity = { id, discovery, event, open } · RegionMemoryView.births),
// 그리고 이미 있던 하네스와 선례(c034 · c035 · c036)뿐이다.
//
// **이름도 자리도 손으로 적지 않는다** — 경로와 그것이 남기는 것은 PRESENCE_ROUTES 의
// `leavesBehind` 에서, 원천은 sourcesInRegion 에서, 탄생지는 lifeSitesInRegion 에서, 문은 LOCKS
// 에서, 방은 REGION_SPECS 에서 읽는다. 손으로 적는 것은 spec 이 못 박은 글자(비늘의 id · 방 둘 ·
// Yield 열 열넷의 이름 · 검사 번호 · 등급 셋 · C036 의 답 여덟)와 아래 C036_INTERACTIONS 하나뿐이다.
//
// **전체 개수를 단언하지 않는다** — 기회의 수도 원천의 수도 방의 수도 세지 않는다. 다만 검사의
// 수(마흔여덟)와 Event 의 수(둘)는 spec 이 값으로 못 박은 예외라 그것만 잰다.
//
// **여기서 재지 않는 것** — 판의 「— 지금은 없다」 **문구**는 View 의 표가 짓는다. 세계 쪽에서 잴
// 수 있는 것은 그 판이 읽는 값(interactions[].opportunity.event · open)까지다 (c030 · c034 · c035 ·
// c036 이 세운 그 경계 그대로). 줄은 content/view/tests 의 c037 시나리오가 잰다.

import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DECIDABLE_QUERY_KINDS,
  DECIDABLE_TARGET_KINDS,
  conditionLeaves,
  type Condition,
  type ConditionVerdict,
} from '../../../engine/world-authoring/condition';
import type { CheckItem, CheckReport } from '../../../engine/world-authoring/check';
import { MUTATION_OPS, isEventOpportunity } from '../../../engine/world-authoring/opportunity';
import { descriptionHash } from '../../../engine/world-authoring/description';
import type { WorldSnapshot } from '../../../engine/world-kernel/persistence';
import {
  FOREST_EDGE,
  LOCKS,
  PRESENCE_ROUTES,
  RED_EYE_TREE,
  REGION_SPECS,
  regionSpec,
  type Lock,
  type SeasonId,
} from '../../regions';
import { opportunitiesOf } from '../../regions/opportunity';
import type { ActionResult } from '../../protocol/actions';
import type { GameViewSnapshot, InteractionView, RegionMemoryView } from '../../protocol/gameview';
import { createWorld, restoreWorld, type World, type WorldSetup } from '../index';
import { idleAction } from '../semantic/action';
import type { ActorState } from '../semantic/actor';
import { NEEDS_PASSAGE, lockCondition, worldConditionVerdict } from '../semantic/condition';
import { lifeSitesInRegion, type LifeSite } from '../semantic/life';
import { sourcePositionOf, sourceStateOf, sourcesInRegion, type ResourceSource } from '../semantic/resource';
import { INTERACTION_RANGE, TICK_INTERVAL, type WorldState } from '../semantic/world-state';
import { runWorldCheck } from '../../../tools/world-editor/check';
import { gradeFromFile } from '../../../tools/world-editor/author';
import { runBatch } from '../../../tools/world-editor/draft';
import { driveWorld, OBSERVER, type WorldDriver } from './drive';

// ── spec 이 못 박은 글자 (여기 말고는 손으로 적지 않는다) ──────────────
/** 유도되는 기회 id 의 자리 — C036 기본형 ⑥ */
const GATHER = 'gather:';
const CROSS = 'cross:';
/** spec 이 이름으로 못 박은 원천 하나 — 숲 가장자리의 비늘 (C018 · C035 · C037 Playable Goal) */
const SCALE = 'FALLEN_SCALE';
/** phase 셋 (C012 · C013 그대로) — "캘 수 있는가" 의 답이 이 글자다 */
const AVAILABLE = 'available';
/** 채취의 소요 시간 — 행동표가 소유한다. 여기서는 "넉넉히 지난다" 로만 쓴다 (c011~c036 어법) */
const MINE_SECONDS = 1.2;
/** 검사 셋 — spec Observable 4 (㊸ 태어남의 키 · ㊺ 기회의 참조 · ㊻ 방마다 무엇을 내미는가) */
const HISTORY_REFS_MARK = '㊸';
const REFS_ID = 'opportunity-refs';
const SUMMARY_ID = 'opportunity-summary';
const SUMMARY_MARK = '㊻';
/**
 * 검사의 수 — 그 Cycle 의 spec 이 **마흔여덟**로 못 박았고, 그 뒤 T2 확장이 접근 계통에 ㊽ 을
 * 더해 마흔아홉이, 재료 계통에 ㊾(캘 횟수)이 더해져 쉰이 되었다.
 *
 * 동결된 spec 을 고쳐 읽는 것이 아니다 — 그때 마흔여덟이었다는 것은 그대로 참이고, 이 줄이
 * 재는 것은 "지금도 그 수가 맞는가" 다. 총수를 못 박은 것은 그 spec 이 예외로 둔 자리이므로
 * (그래서 다른 시나리오는 전체 개수를 단언하지 않는다) 검사가 늘 때마다 여기가 함께 움직인다.
 */
const CHECK_COUNT = 50;
/** 이 세계의 Event 는 둘이다 — spec SPEC-001 */
const EVENT_COUNT = 2;
/**
 * Yield 표의 열 열넷 — spec SPEC-006 이 이름으로 적은 그대로.
 * 앞 넷이 2층이 값을 가지는 열이고 뒤 열은 0 인 채로 선다 (기본형 ⑥).
 */
const YIELD_COLUMNS = [
  'Material',
  'Access',
  'Discovery',
  'WorldInfluence',
  'Item',
  'Currency',
  'Knowledge',
  'Recipe',
  'Skill',
  'Capability',
  'ClassProgress',
  'Mastery',
  'Relationship',
  'Reputation',
] as const;
const YIELD_SECOND_LAYER = YIELD_COLUMNS.slice(0, 4);
/** C036 까지의 brief 답 여덟 — 이 Cycle 이 그 뒤에 열셋째 답의 자리를 세운다 (spec SPEC-008) */
const ANSWERS_BEFORE = [
  'distinction',
  'cause',
  'dwelling',
  'danger',
  'worth',
  'discovery',
  'opening',
  'birth',
] as const;
/** 등급의 본보기 셋 — 그 등급이 달라지지 않는다 (spec SPEC-008 경계) */
const GRADED_EXAMPLES: readonly (readonly [string, string])[] = [
  ['GAS_VILLAGE', 'A'],
  ['GHOST_CITY', 'B'],
  ['MAGIC_CITY', 'C'],
];
/** 관찰의 role 둘 — C036 SPEC-004 그대로 */
const HARVEST = 'harvest-source';
const TRANSIT = 'transit-connector';
/** 철 넷 (C015 · C016 그대로) — 판정 셋을 다 보려면 철을 다 돌아야 한다 */
const SEASONS: readonly SeasonId[] = ['STILL', 'SEEP', 'LONG_NIGHT', 'TURN'];

// ── 하네스 (c034 · c035 · c036 의 선례 그대로) ────────────────────────
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
/** dt 를 잘게 나누어 준다 (c013 ~ c036 의 wait 선례 그대로) */
function wait(w: WorldDriver, seconds: number, step = 1) {
  let left = seconds;
  while (left > 1e-9) {
    const dt = Math.min(step, left);
    w.tick(dt);
    left -= dt;
  }
}
/** 그 조건이 참이 될 때까지 1 세계 초 걸음으로 굴린다 (c023 의 runUntil 그대로) */
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

// ── 저장·복구 (c034 · c035 의 선례 그대로) ───────────────────────────
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
/** 파일을 지나는 저장 — server/world-store.ts 가 하는 일 그대로 */
const throughFile = (snapshot: WorldSnapshot): WorldSnapshot =>
  JSON.parse(JSON.stringify(snapshot)) as WorldSnapshot;
/** 되살리면서 State 를 고친 세계 — 걸어서는 세울 수 없는 Given 을 공개 길로 세운다 */
function worldFrom(base: WorldDriver, edit: (s: WorldState) => void): WorldDriver {
  const restored = restoreWorld(throughFile(base.world.snapshot()));
  if (!restored) throw new Error('되살릴 수 없는 스냅샷이다');
  edit(restored);
  const world = createWorld({}, restored);
  world.join(OBSERVER);
  world.tick(0);
  return wrap(world);
}
const revive = (base: WorldDriver): WorldDriver => worldFrom(base, () => {});
/** 그 몸을 그 방 그 자리에 세운다 (관성도 하던 행동도 없이) */
function place(s: WorldState, id: string, region: string, spot: { x: number; z: number }) {
  const a = s.actors.find((x: ActorState) => x.id === id)!;
  a.regionId = region;
  a.position = { x: spot.x, z: spot.z };
  a.velocity = { x: 0, z: 0 };
  a.currentAction = idleAction();
}
/** 그 원천 곁에 몸을 세운 세계 (c035 의 beside 그대로 — 자리는 세계가 안다) */
function beside(w: WorldDriver, source: ResourceSource): WorldDriver {
  const p = sourcePositionOf(state(w).regionStates, source);
  return worldFrom(w, (s) =>
    place(s, bodyOf(w), source.regionId, { x: p.x + INTERACTION_RANGE / 2, z: p.z }),
  );
}

// ── 데이터가 소유하는 이름들 (손으로 적지 않는다) ─────────────────────
const ALL_SOURCES: readonly ResourceSource[] = REGION_SPECS.flatMap((spec) => sourcesInRegion(spec.id));
const ALL_SITES: readonly LifeSite[] = REGION_SPECS.flatMap((spec) => lifeSitesInRegion(spec.id));
const sourceById = (id: string): ResourceSource => {
  const found = ALL_SOURCES.find((s) => s.id === id);
  if (!found) throw new Error(`세계에 원천 '${id}' 가 없다`);
  return found;
};
/** 경로가 남기는 것 — L2-World-Time 2.6 의 leavesBehind (Event 의 출처를 데이터가 소유한다) */
interface RouteShape {
  id: string;
  presence: string;
  leavesBehind?: readonly string[];
  nodes: readonly (readonly { region: string }[])[];
}
const ROUTES = PRESENCE_ROUTES as unknown as readonly RouteShape[];
/** 그 원천을 남기는 경로 — 없으면 그 원천은 Event 의 것이 아니다 */
const routeLeaving = (sourceId: string): RouteShape | undefined =>
  ROUTES.find((r) => (r.leavesBehind ?? []).includes(sourceId));
/** 이 세계가 경로로 남기는 원천 전부 — 곧 Event 인 기회의 대상들이다 */
const LEFT_BEHIND: readonly string[] = ROUTES.flatMap((r) => [...(r.leavesBehind ?? [])]);
/** 그 경로가 지나는 방들 (데이터 순서 그대로) */
const roomsOnRoute = (route: RouteShape): string[] => [
  ...new Set(route.nodes.flatMap((node) => node.map((c) => c.region))),
];
const lockOf = (connector: string): (Lock & { region: string }) | undefined =>
  LOCKS.find((lock) => lock.at.kind === 'connector' && lock.at.ref === connector);

// ── 기회를 읽는 자리 (spec 이 선언한 계약의 점 경로) ──────────────────
//
// 형을 engine 에서 가져오지 않고 **spec 이 글로 적은 그대로** 여기 둔다 (c036 의 선례).
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
const allOpportunities = (): OpportunityShape[] => REGION_SPECS.flatMap((spec) => opportunitiesIn(spec.id));
const findIn = (region: string, id: string): OpportunityShape | undefined =>
  opportunitiesIn(region).find((o) => o.id === id);
const scaleOpportunity = (): OpportunityShape => {
  const found = findIn(FOREST_EDGE, `${GATHER}${SCALE}`);
  if (!found) throw new Error(`${FOREST_EDGE} 에 비늘의 채집 기회가 서지 않았다`);
  return found;
};
/** 그 기회의 잎 가운데 **때**를 묻는 것들 — Event 의 표식이다 (spec SPEC-001) */
interface LeafShape {
  qualifier?: { kind?: string; seconds?: number; mode?: string };
}
const timeLeavesOf = (condition: Condition | undefined): LeafShape[] =>
  (condition === undefined ? [] : (conditionLeaves(condition) as unknown as LeafShape[])).filter(
    (leaf) => leaf.qualifier?.kind === 'time',
  );
const isEventData = (one: OpportunityShape): boolean => timeLeavesOf(one.availability).length > 0;
/** 그 Event 가 묻는 초 — 데이터가 소유한다 (spec 은 "그 초" 라고만 하고 값을 여기서 적지 않는다) */
function withinSecondsOf(one: OpportunityShape): number {
  const seconds = timeLeavesOf(one.availability)
    .map((leaf) => leaf.qualifier?.seconds)
    .filter((s): s is number => typeof s === 'number');
  if (seconds.length !== 1) {
    throw new Error(`기회 '${one.id}' 의 시간 qualifier 가 초를 하나로 말하지 않는다 — ${JSON.stringify(seconds)}`);
  }
  return seconds[0]!;
}
/** 조건을 그 State 로 판정한다 — 없는 조건은 "묻지 않음" 이다 */
const verdictOf = (s: WorldState, condition: Condition | undefined): ConditionVerdict =>
  condition === undefined ? 'met' : worldConditionVerdict(s, condition);
/** 판정 불가 잎을 가졌는가 — 2층이 채우지 못하는 갈래를 묻는 기회다 */
const hasDeferredLeaf = (one: OpportunityShape): boolean =>
  conditionLeaves(one.availability ?? { all: [] }).some(
    (leaf) =>
      !DECIDABLE_TARGET_KINDS.includes(leaf.target.kind) ||
      !DECIDABLE_QUERY_KINDS.includes(leaf.query.kind) ||
      leaf.chance !== undefined,
  );

/** 그 값 안의 글자 전부 — 형을 모르는 채로 "무슨 이름을 쓰는가" 만 본다 (c036 그대로) */
function stringsIn(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (typeof value === 'string') into.add(value);
  else if (Array.isArray(value)) for (const one of value) stringsIn(one, into);
  else if (value !== null && typeof value === 'object') for (const one of Object.values(value)) stringsIn(one, into);
  return into;
}
interface MutationOp {
  group: string;
  op: string;
}
const OP_PAIRS: ReadonlySet<string> = new Set(
  (MUTATION_OPS as readonly MutationOp[]).map((one) => `${one.group}.${one.op}`),
);

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
const harvestOf = (list: readonly SeenInteraction[], target: string): SeenInteraction | undefined =>
  list.find((i) => i.role === HARVEST && i.targetEntityId === target);
const transitOf = (list: readonly SeenInteraction[], target: string): SeenInteraction | undefined =>
  list.find((i) => i.role === TRANSIT && i.targetEntityId === target);
/** 지금 그 원천을 겨냥한 행동에 실린 기회 (관찰에 실리지 않았으면 없다) */
const seenGather = (w: WorldDriver, sourceId: string): SeenOpportunity | undefined =>
  harvestOf(interactionsIn(w.observe()), sourceId)?.opportunity;
/** 그 원천을 지금 캘 수 있는가 — 원천의 phase 판정 (C012 · C013 의 그 글자) */
const phaseOf = (w: WorldDriver, region: string, id: string): string =>
  (sourceStateOf(state(w).regionStates, region, id) as unknown as { phase: string }).phase;
const isMinable = (w: WorldDriver, region: string, id: string): boolean =>
  phaseOf(w, region, id) === AVAILABLE;
/** 지목한 원천의 조건 코드들 (C014 · C035 의 그 자리) */
const seenConditions = (w: WorldDriver, id: string): string[] =>
  ((w.observe().entities.find((e) => e.role === 'resource-source' && e.id === id) as
    | { conditions?: string[] }
    | undefined)?.conditions ?? []);

// ── 방의 기억을 읽는 자리 (C034 의 어법 그대로 · spec State) ──────────
interface CountShape {
  times: number;
  lastAt?: number | null;
}
interface HistoryShape {
  turns: number;
  awakenings: CountShape;
  passages?: Record<string, CountShape>;
  births?: Record<string, CountShape>;
}
interface RegionStateShape {
  history?: HistoryShape;
}
const shapeOf = (w: WorldDriver): Record<string, RegionStateShape> =>
  state(w).regionStates as unknown as Record<string, RegionStateShape>;
const historyOf = (w: WorldDriver, region: string): HistoryShape | undefined => shapeOf(w)[region]?.history;
/** 그 방이 센 태어남 — 한 번도 없었으면 자리가 없다 (passages 의 어법 그대로 · spec State) */
const birthOf = (w: WorldDriver, region: string, site: string): CountShape | undefined =>
  historyOf(w, region)?.births?.[site];
const seenMemory = (w: WorldDriver): RegionMemoryView & { births?: { formation: string; times: number; lastAt?: number }[] } =>
  w.observe().region.memory as RegionMemoryView & {
    births?: { formation: string; times: number; lastAt?: number }[];
  };
/** 그 탄생지의 의미 코드 — 데이터가 소유한다 (경로의 presence 와 같은 어법) */
const formationCodeOf = (site: LifeSite): string => (site as LifeSite & { form: string }).form;

// ── 도구를 밖에서 돌린다 (c018 · c034 · c035 · c036 의 선례 그대로) ────
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
const exampleAt = (id: string) => join(ROOT, `content/authoring/examples/${id}.json`);
const exampleOf = (id: string): unknown => JSON.parse(readFileSync(exampleAt(id), 'utf8'));
/** 미답 목록이 말하는 답의 이름들 — T4 가 적는 글의 마지막 마디다 (grade.spec 의 선례 그대로) */
const pendingKeys = (id: string): string[] =>
  (gradeFromFile(exampleAt(id)) as { pending: readonly { required: string }[] }).pending.map((g) =>
    g.required.split('가운데 ').slice(-1)[0]!.trim(),
  );

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-001 Event 의 정의 — availability 에 시간 qualifier 가 있는 기회', () => {
  it('S-343 경로가 남기는 것 둘의 채집 기회만 때를 묻는다 — 나머지 기회는 하나도 Event 가 아니다', () => {
    // Given 데이터가 이미 말한다 — 경로가 남기는 것은 둘이다 (leavesBehind)
    expect(LEFT_BEHIND.length).toBe(EVENT_COUNT);
    expect(LEFT_BEHIND).toContain(SCALE);
    // Then 그 둘의 채집 기회가 Event 이고 (때를 묻는 잎이 있다)
    const events = allOpportunities().filter((one) => isEventData(one));
    expect(events.map((o) => o.id).sort()).toEqual(LEFT_BEHIND.map((id) => `${GATHER}${id}`).sort());
    // And engine 의 판정도 같은 답을 낸다 — Event 는 저장된 갈래가 아니라 유도다
    for (const one of allOpportunities()) {
      expect({ id: one.id, engine: isEventOpportunity(one as never), data: isEventData(one) }).toEqual({
        id: one.id,
        engine: isEventData(one),
        data: isEventData(one),
      });
    }
    // And 나머지는 하나도 아니다 — 다른 마흔 남짓은 그대로다 (SPEC-001 경계)
    const others = allOpportunities().filter((one) => !isEventData(one));
    expect(others.length).toBeGreaterThan(0);
    for (const one of others) {
      expect({ id: one.id, event: isEventOpportunity(one as never) }).toEqual({ id: one.id, event: false });
    }
  });

  it('S-344 관찰에 실린 event 가 그 판정 그대로다 — 방마다 · 기회마다', () => {
    let eventSeen = 0;
    for (const spec of REGION_SPECS) {
      const here = new Map(opportunitiesIn(spec.id).map((o) => [o.id, o]));
      for (const seen of seenIn(spec.id)) {
        const carried = seen.opportunity;
        if (!carried) continue;
        // 이 방의 것이 아닌 이름은 문의 저쪽 끝뿐이다 (C036 S-321 의 읽기) — 그것은 Event 가 아니다
        const known = here.get(carried.id);
        const expected = known ? isEventData(known) : false;
        expect({ region: spec.id, id: carried.id, event: carried.event }).toEqual({
          region: spec.id,
          id: carried.id,
          event: expected,
        });
        if (carried.event) eventSeen++;
      }
    }
    // Event 인 기회를 실제로 보았다 — 보지 못했으면 이 항이 헛돈 것이다
    expect({ eventSeen: eventSeen > 0 }).toEqual({ eventSeen: true });
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-002 열림 — 지난 시각으로부터 그 초 안', () => {
  it('S-345 비늘의 availability 가 기억 조건과 때를 함께 지고, 묻는 초가 그 원천의 되돌아옴 그대로다', () => {
    const one = scaleOpportunity();
    const source = sourceById(SCALE);
    // Given 이 원천은 경로가 남기는 것이다
    const route = routeLeaving(SCALE);
    expect({ source: SCALE, left: route !== undefined }).toEqual({ source: SCALE, left: true });
    // Then 그 조건이 이 방의 그 경로의 지나감을 묻고 (C035 의 기억 조건 그대로)
    const leaves = conditionLeaves(one.availability ?? { all: [] });
    expect(leaves.length).toBeGreaterThan(1);
    expect(
      leaves.some(
        (leaf) =>
          leaf.target.kind === 'history' &&
          leaf.target.ref === FOREST_EDGE &&
          String(leaf.query.path ?? '').includes(route!.id),
      ),
    ).toBe(true);
    // And 때를 묻는 잎이 하나 있고 그 초가 지금 코드의 되돌아옴 값 그대로다 (자리만 옮겼다 · Q7)
    expect({ within: withinSecondsOf(one) }).toEqual({
      within: (source as ResourceSource & { recoverySeconds: number }).recoverySeconds,
    });
  });

  it('S-346 열림의 답이 원천의 phase 판정과 **모든 때에 같다** — 지나기 전 · 지나는 동안 · 지난 뒤', () => {
    // Given 갓 선 숲 가장자리 — 고래는 아직 지나지 않았다
    const w = standingIn(FOREST_EDGE);
    expect(historyOf(w, FOREST_EDGE)?.passages?.[routeLeaving(SCALE)!.id]).toBeUndefined();
    const mismatches: string[] = [];
    let openSeen = 0;
    let closedSeen = 0;
    // When 1 세계 초 걸음으로 훑는다 — 지나감도 되돌아옴도 그 안에서 일어난다
    for (let i = 0; i < 600; i++) {
      w.tick(1);
      const seen = seenGather(w, SCALE);
      if (!seen) continue; // 그때 관찰에 실리지 않는 원천은 이 항의 물음이 아니다
      const minable = isMinable(w, FOREST_EDGE, SCALE);
      if (seen.open !== minable) {
        mismatches.push(`t=${timeOf(w)}  open=${seen.open}  phase=${phaseOf(w, FOREST_EDGE, SCALE)}`);
      }
      if (seen.open) openSeen++;
      else closedSeen++;
    }
    // Then 어느 때에도 어긋나지 않는다 (앞의 다섯만 적어 보인다)
    expect(mismatches.slice(0, 5).join('\n')).toBe('');
    // And 열린 때와 닫힌 때를 둘 다 보았다 — 한쪽만 보면 이 항이 헛돈다
    expect({ openSeen: openSeen > 0, closedSeen: closedSeen > 0 }).toEqual({
      openSeen: true,
      closedSeen: true,
    });
  });

  it('S-347 (경계 ①) 한 번도 지나지 않았으면 닫혀 있다 — needs-passage 도 그대로 선다', () => {
    const w = standingIn(FOREST_EDGE);
    const seen = seenGather(w, SCALE);
    expect(seen, '비늘을 겨냥한 채취가 관찰에 실리지 않았다').toBeDefined();
    expect({ event: seen!.event, open: seen!.open }).toEqual({ event: true, open: false });
    // 그리고 C035 가 세운 조건 코드가 한 값도 달라지지 않았다
    expect(seenConditions(w, SCALE)).toContain(NEEDS_PASSAGE);
  });

  it('S-348 (경계 ②) 주워서 고갈되면 닫히고, 그 초를 넘겨 기다려도 다시 열리지 않는다', () => {
    // Given 고래가 지나 비늘을 캘 수 있게 된 세계 (지나감은 세계의 시간표가 부른다)
    const base = standingIn(FOREST_EDGE, { actorItems: { pickaxe: 9 } });
    runUntil(base, () => isMinable(base, FOREST_EDGE, SCALE), 900, '비늘이 캘 수 있게 되는 것');
    const route = routeLeaving(SCALE)!;
    const passedAt = historyOf(base, FOREST_EDGE)!.passages![route.id]!.lastAt!;
    // 그 자리 곁에 서면 열려 있다
    const w = beside(base, sourceById(SCALE));
    expect({ open: seenGather(w, SCALE)?.open }).toEqual({ open: true });

    // When 줍는다
    expect(mineOnce(w, SCALE).status).toBe('success');
    // Then 그 기회가 닫힌다 (고갈이다)
    expect({ minable: isMinable(w, FOREST_EDGE, SCALE), open: seenGather(w, SCALE)?.open }).toEqual({
      minable: false,
      open: false,
    });

    // When 그 초를 넘겨 기다린다 — 고래는 다시 지나지 않는다
    const within = withinSecondsOf(scaleOpportunity());
    const closed: string[] = [];
    while (timeOf(w) < passedAt + within + 60) {
      w.tick(1);
      const seen = seenGather(w, SCALE);
      if (seen?.open) closed.push(`t=${timeOf(w)} 에 시간이 열었다 (phase=${phaseOf(w, FOREST_EDGE, SCALE)})`);
    }
    // Then 시간이 되돌리지 않는다 — 되돌리는 것은 다시 지나감뿐이다 (RoomNeverSame 확정 9)
    expect(historyOf(w, FOREST_EDGE)!.passages![route.id]!.lastAt).toBe(passedAt);
    expect(closed.slice(0, 3).join('\n')).toBe('');
  });

  // (번호는 이어 붙인 뒤에 왔다 — 앞의 것을 다시 매기지 않는다 · C036 S-342 의 선례)
  it('S-376 (경계 ②의 뒷면) 다시 여는 것은 다시 지나감이다 — 그 경로가 또 지나면 그 자리에서 열린다', () => {
    const w = standingIn(FOREST_EDGE);
    const route = routeLeaving(SCALE)!;
    const passages = () => historyOf(w, FOREST_EDGE)?.passages?.[route.id];
    runUntil(w, () => (passages()?.times ?? 0) >= 1, 900, '고래가 이 방을 처음 지나는 것');
    const first = passages()!.lastAt!;
    // When 그 경로가 다시 지날 때까지 굴린다 (시간표는 세계의 것이다 — 여기서 부르지 않는다)
    let left = 12_000;
    while (left > 0 && (passages()?.times ?? 0) < 2) {
      const dt = Math.min(5, left);
      w.tick(dt);
      left -= dt;
    }
    const again = passages();
    expect({ times: (again?.times ?? 0) >= 2 }).toEqual({ times: true });
    expect(again!.lastAt!).toBeGreaterThan(first);
    // And 지나감이 **끝나야** 그 자리에 선다 — 드는 시각(lastAt)은 마디를 다 지나기 전이다.
    // 그때까지 굴린다 (머무는 동안 안이다 — RULE-PRESENCE-LEFT-FADE-001 이 거두기 전).
    runUntil(w, () => seenGather(w, SCALE)?.open === true, 300, '다시 지난 뒤 비늘이 그 자리에 서는 것');
    // Then 그 자리가 다시 열린다 — 지나감이 되돌린다 (시간이 아니다)
    const seen = seenGather(w, SCALE);
    expect(seen, '다시 지난 뒤 비늘의 채취가 관찰에 실리지 않았다').toBeDefined();
    expect({ event: seen!.event, open: seen!.open }).toEqual({ event: true, open: true });
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-003 판정 셋 — 참이면 열림 · 거짓이면 닫힘 · 판정 불가면 열지 않는다', () => {
  it('S-349 방마다 · 철마다 · 기회마다 open 이 availability 의 판정 그대로다 (판정 불가는 거짓이다)', () => {
    // 철 넷을 다 돈다 — 판정 불가가 서는 자리는 철이 정한다 (C035 가 세운 회귀의 자 그대로)
    let deferredSeen = 0;
    let metSeen = 0;
    let unmetSeen = 0;
    for (const season of SEASONS) {
      for (const spec of REGION_SPECS) {
        const w = standingIn(spec.id, { clock: season } as WorldSetup);
        const here = new Map(opportunitiesIn(spec.id).map((o) => [o.id, o]));
        for (const seen of interactionsIn(w.observe())) {
          const carried = seen.opportunity;
          if (!carried) continue;
          const known = here.get(carried.id);
          if (!known) continue; // 문의 저쪽 끝 — 그 방의 기회가 아니다 (C036 S-321)
          const verdict = verdictOf(state(w), known.availability);
          if (verdict === 'met') metSeen++;
          else if (verdict === 'unmet') unmetSeen++;
          else deferredSeen++;
          expect({ season, region: spec.id, id: carried.id, verdict, open: carried.open }).toEqual({
            season,
            region: spec.id,
            id: carried.id,
            verdict,
            open: verdict === 'met',
          });
        }
      }
    }
    // 판정 셋을 다 보았다 — 하나라도 못 보면 이 항이 헛돈다 (판정 불가는 문이 묻는 자리다 · C035 S-246)
    expect({ met: metSeen > 0, unmet: unmetSeen > 0, deferred: deferredSeen > 0 }).toEqual({
      met: true,
      unmet: true,
      deferred: true,
    });
  });

  it('S-350 (경계) 판정 불가 잎을 가진 기회는 Event 가 아니고, 그 문의 줄이 C036 과 한 값도 다르지 않다', () => {
    const deferred = allOpportunities().filter((one) => one.id.startsWith(CROSS) && hasDeferredLeaf(one));
    expect(deferred.length).toBeGreaterThan(0);
    for (const one of deferred) {
      // Event 가 아니다 — 「지금은 없다」 는 그 문의 것이 아니다
      expect({ id: one.id, event: isEventOpportunity(one as never) }).toEqual({ id: one.id, event: false });
      const lock = lockOf(one.id.slice(CROSS.length))!;
      const seen = transitOf(seenIn(lock.region), lock.at.ref);
      expect({ lock: lock.id, listed: seen !== undefined }).toEqual({ lock: lock.id, listed: true });
      // 그 줄의 판정과 사유가 C036 의 골든 그대로다 (아래 회귀 표가 방마다 다시 잰다)
      const line = `${seen!.id}/${seen!.role}/${seen!.targetEntityId ?? ''}/${seen!.available}/${seen!.reason ?? ''}`;
      expect({ lock: lock.id, kept: (C036_INTERACTIONS[lock.region] ?? []).includes(line) }).toEqual({
        lock: lock.id,
        kept: true,
      });
      // 그리고 그 잎이 lockCondition 이 이미 묻던 것 그대로다 — 이 Cycle 이 지은 것이 아니다
      expect({ lock: lock.id, leaves: conditionLeaves(one.availability!).length }).toEqual({
        lock: lock.id,
        leaves: conditionLeaves(lockCondition(lock)!).length,
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-004 판이 읽는 값 — 닫힌 Event 도 줄에 선다', () => {
  it('S-351 실리는 자리는 넷뿐이다 — 언제 · 무엇이 여는가는 어느 자리에도 없다', () => {
    const routeNames = ROUTES.flatMap((r) => [r.id, r.presence]);
    for (const spec of REGION_SPECS) {
      const list = interactionsIn(standingIn(spec.id).observe());
      for (const seen of list) {
        if (!seen.opportunity) continue;
        expect({ region: spec.id, id: seen.opportunity.id, keys: Object.keys(seen.opportunity).sort() }).toEqual({
          region: spec.id,
          id: seen.opportunity.id,
          keys: ['discovery', 'event', 'id', 'open'].sort(),
        });
      }
      // 그리고 「할 수 있는 것」 줄 어디에도 무엇이 여는지가 없다 (남은 시간도 없다)
      const text = JSON.stringify(list);
      for (const name of routeNames) {
        expect({ region: spec.id, name, said: text.includes(name) }).toEqual({
          region: spec.id,
          name,
          said: false,
        });
      }
    }
  });

  it('S-352 Event 는 닫혀 있어도 줄에 서고, 지나면 그 자리에서 열린다 — 줄 자체는 사라지지 않는다', () => {
    const w = standingIn(FOREST_EDGE);
    const before = harvestOf(interactionsIn(w.observe()), SCALE);
    expect(before, '닫힌 Event 의 줄이 서지 않았다').toBeDefined();
    expect({ event: before!.opportunity!.event, open: before!.opportunity!.open }).toEqual({
      event: true,
      open: false,
    });

    // When 고래가 지나 그 자리가 열린다
    runUntil(w, () => isMinable(w, FOREST_EDGE, SCALE), 900, '비늘이 캘 수 있게 되는 것');
    const after = harvestOf(interactionsIn(w.observe()), SCALE);
    expect(after, '열린 Event 의 줄이 사라졌다').toBeDefined();
    expect({ event: after!.opportunity!.event, open: after!.opportunity!.open }).toEqual({
      event: true,
      open: true,
    });
    // And 줄의 이름과 discovery 는 그대로다 — 열림이 이름을 바꾸지 않는다
    expect({ id: after!.opportunity!.id, discovery: after!.opportunity!.discovery }).toEqual({
      id: before!.opportunity!.id,
      discovery: before!.opportunity!.discovery,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-005 outcomes 가 실제 op 으로 적힌다', () => {
  it('S-353 비늘 주움의 world op 이 [entity CHANGE_STATE · ownership GRANT] 이고 얻는 것이 [Material · WorldInfluence] 다', () => {
    const one = scaleOpportunity();
    const world = one.outcomes.world as readonly MutationOp[];
    expect(world.map((m) => `${m.group}.${m.op}`)).toEqual(['entity.CHANGE_STATE', 'ownership.GRANT']);
    // 얻는 것 — Yield 표의 열 이름으로 적힌다 (소지에 드는 것과 세계에 남는 소란)
    const gained = [...stringsIn(one.outcomes.yield)].filter((t) =>
      (YIELD_COLUMNS as readonly string[]).includes(t),
    );
    expect(gained.sort()).toEqual(['Material', 'WorldInfluence'].sort());
  });

  it('S-354 세계의 모든 기회의 op 이 표 안이고 ㊺ 가 통과다', () => {
    let seen = 0;
    for (const one of allOpportunities()) {
      for (const mutation of one.outcomes.world as readonly MutationOp[]) {
        seen++;
        const pair = `${mutation.group}.${mutation.op}`;
        expect({ id: one.id, pair, inTable: OP_PAIRS.has(pair) }).toEqual({ id: one.id, pair, inTable: true });
      }
    }
    expect({ seen: seen > 0 }).toEqual({ seen: true });
    const item = runWorldCheck().items.find((i) => i.id === REFS_ID);
    expect(item, '보고에 opportunity-refs 가 없다').toBeDefined();
    expect({ status: item!.status }).toEqual({ status: 'pass' });
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-006 Yield 표 — 열 열넷 · 2층 값 넷', () => {
  it('S-355 이 층이 쓰는 열은 앞 넷뿐이다 — 뒤 열은 아무 기회도 채우지 않는다', () => {
    const used = new Set<string>();
    for (const one of allOpportunities()) {
      for (const text of stringsIn(one.outcomes.yield)) {
        if ((YIELD_COLUMNS as readonly string[]).includes(text)) used.add(text);
      }
    }
    expect(used.size).toBeGreaterThan(0);
    for (const name of used) {
      expect({ column: name, secondLayer: (YIELD_SECOND_LAYER as readonly string[]).includes(name) }).toEqual({
        column: name,
        secondLayer: true,
      });
    }
  });

  it('S-356 표가 열 열넷으로 선다 — 뒤 열 열은 0 인 채로 지워지지 않는다 (world:observe --report)', () => {
    const run = runTool(OBSERVE, ['--report']);
    expect(run.status).toBe(0);
    for (const column of YIELD_COLUMNS) {
      expect({ column, listed: run.out.includes(column) }).toEqual({ column, listed: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-007 방이 태어난 것을 센다', () => {
  /** 붉은 눈의 거목 — 알집이 터지는 방 (C022 ~ C025 가 세운 그 자리) */
  const TREE = RED_EYE_TREE;
  const sitesHere = (): LifeSite[] => [...lifeSitesInRegion(TREE)];
  /** 그 탄생지 곁에 선 세계 — 자리는 데이터가 안다 */
  const atSite = (site: LifeSite): WorldDriver =>
    standingIn(TREE, { clock: 'STILL', actorPosition: { x: site.position.x, z: site.position.z } } as WorldSetup);
  /** 하나가 태어날 때까지 굴린다 — 그 방의 어느 탄생지든 셈이 서면 멈춘다 */
  function runToBirth(w: WorldDriver, site: LifeSite): { before: number; after: number } {
    const before = timeOf(w);
    runUntil(
      w,
      () => (birthOf(w, TREE, site.id)?.times ?? 0) > 0,
      600,
      `탄생지 '${site.id}' 에서 하나가 태어나는 것`,
    );
    return { before, after: timeOf(w) };
  }

  it('S-357 탄생지에서 하나가 태어나면 그 방의 births 가 오르고 lastAt 이 그때다 — 판이 그것을 읽는다', () => {
    const site = sitesHere()[0]!;
    const w = atSite(site);
    // Given 아직 아무것도 태어나지 않았다 — 자리 자체가 없다 (passages 의 어법)
    expect(birthOf(w, TREE, site.id)).toBeUndefined();
    expect(seenMemory(w).births ?? []).toEqual([]);

    // When 하나가 태어난다
    const { before, after } = runToBirth(w, site);
    // Then 그 방의 셈이 하나 오르고 그 시각이 남는다
    const held = birthOf(w, TREE, site.id)!;
    expect({ times: held.times }).toEqual({ times: 1 });
    expect(held.lastAt!).toBeGreaterThanOrEqual(before);
    expect(held.lastAt!).toBeLessThanOrEqual(after);
    // And 판이 읽을 값이 서 있다 — 무엇이 몇 번 태어났는가와 그 시각뿐이다
    const seen = (seenMemory(w).births ?? []).find((b) => b.formation === formationCodeOf(site));
    expect(seen, '태어남이 방의 기억에 실리지 않았다').toBeDefined();
    expect(Object.keys(seen!).sort()).toEqual(['formation', 'lastAt', 'times'].sort());
    expect({ times: seen!.times, lastAt: seen!.lastAt }).toEqual({ times: 1, lastAt: held.lastAt });
    // And 태어난 적 없는 탄생지는 목록에 서지 않는다
    for (const other of sitesHere()) {
      if (other.id === site.id) continue;
      if ((birthOf(w, TREE, other.id)?.times ?? 0) > 0) continue;
      expect({
        site: other.id,
        listed: (seenMemory(w).births ?? []).some((b) => b.formation === formationCodeOf(other)),
      }).toEqual({ site: other.id, listed: false });
    }
  });

  it('S-358 (경계 ①) 뒤척임도 되돌아옴도 그 셈을 지우지 못하고, 저장하고 되살려도 그대로다', () => {
    const site = sitesHere()[0]!;
    const w = atSite(site);
    runToBirth(w, site);
    const held = birthOf(w, TREE, site.id)!;
    // When 세계가 한참을 더 구른다 — 터진 자리가 되돌아오고 방이 뒤척인다
    wait(w, 600, 5);
    expect(birthOf(w, TREE, site.id)!.times).toBeGreaterThanOrEqual(held.times);
    expect(birthOf(w, TREE, site.id)!.lastAt).toBeGreaterThanOrEqual(held.lastAt!);
    // And 저장하고 되살려도 그대로다 (지워지지 않는 것 · PERSISTENT)
    const revived = revive(w);
    expect(birthOf(revived, TREE, site.id)).toEqual(birthOf(w, TREE, site.id));
    expect(seenMemory(revived).births).toEqual(seenMemory(w).births);
  });

  it('S-359 (경계 ②) 그 자리가 없는 옛 스냅샷을 되살려도 세계가 서고 셈은 0 에서 시작한다', () => {
    const site = sitesHere()[0]!;
    const w = atSite(site);
    runToBirth(w, site);
    // Given 그 자리를 지운 스냅샷 — C037 앞의 세계가 남긴 것과 같은 모습이다
    const old = worldFrom(w, (s) => {
      const states = s.regionStates as unknown as Record<string, RegionStateShape>;
      for (const held of Object.values(states)) {
        if (held.history) delete held.history.births;
      }
    });
    // Then 세계가 선다 — 없는 자리는 0 으로 읽힌다 (기본형 ④ · STATE_VERSION 을 올리지 않는다)
    expect(birthOf(old, TREE, site.id)).toBeUndefined();
    expect(seenMemory(old).births ?? []).toEqual([]);
    // And 다시 태어나면 1 부터 센다
    const again = atSite(site);
    const restarted = worldFrom(again, (s) => {
      const states = s.regionStates as unknown as Record<string, RegionStateShape>;
      for (const held of Object.values(states)) {
        if (held.history) delete held.history.births;
      }
    });
    runUntil(
      restarted,
      () => (birthOf(restarted, TREE, site.id)?.times ?? 0) > 0,
      600,
      '되살린 세계에서 하나가 태어나는 것',
    );
    expect(birthOf(restarted, TREE, site.id)!.times).toBe(1);
  });

  it('S-360 (경계 ③) 검사 ㊸ 이 태어남의 키를 잰다 — 통과이고 그 수가 세계의 탄생지 수 그대로다', () => {
    const report = runWorldCheck();
    const item = report.items.find((i) => i.mark === HISTORY_REFS_MARK);
    expect(item, `보고에 검사 ${HISTORY_REFS_MARK} 가 없다`).toBeDefined();
    expect({ status: item!.status }).toEqual({ status: 'pass' });
    // spec 이 침묵한 자리 — ㊸ 의 답이 **어떤 글로** 그 키를 적는지는 정해지지 않았다. 그래서
    // 글자가 아니라 **수**로 잰다: 태어남을 말하는 마디의 수가 데이터의 탄생지 수 그대로다.
    expect(ALL_SITES.length).toBeGreaterThan(0);
    expect(new RegExp(`태어남[^0-9]{0,8}${ALL_SITES.length}`).test(item!.answer)).toBe(true);
  });

  it.todo(
    'GAP: ㊸ 의 **뒷면**(방이 셀 수 없는 탄생지의 키를 데이터가 내밀면 fail 이다)은 이 하네스로 놓을 수 없다 — 데이터를 실제로 훼손해야 하고 그것은 손으로 지은 데이터로 재는 engine/world-authoring/tests/check.spec.ts 의 자리다 (c034 가 이미 세운 그 GAP 그대로 · 담당 경계상 그 파일을 만지지 않았다)',
  );
});

// ─────────────────────────────────────────────────────────────────────
describe('SPEC-008 도구 셋 — brief · 등급 · lab · observe', () => {
  it('S-361 brief 에 열셋째 답의 자리가 있고, 적지 않은 brief 는 그것을 미답으로 센다', () => {
    // C036 의 여덟 뒤에 답이 더 선다 — 본보기 셋은 그것을 적지 않았으므로 미답으로 센다.
    // T2 확장 CHANGED — 하나가 아니라 **둘**이다: ⑨~⑫ 물음(asking)이 ⑬ 내밂 곁에 섰다
    const keys = pendingKeys('MAGIC_CITY'); // 축이 없어 여덟을 하나도 적지 못하는 방
    for (const answer of ANSWERS_BEFORE) {
      expect({ answer, pending: keys.includes(answer) }).toEqual({ answer, pending: true });
    }
    const added = keys.filter((key) => !(ANSWERS_BEFORE as readonly string[]).includes(key));
    expect({ added: added.length }).toEqual({ added: 2 });
    // 그리고 다 적은 방(등급 A)도 그것들만은 미답이다 — 자리가 있으면 세어진다는 뜻이다
    for (const key of added) expect(pendingKeys('GAS_VILLAGE')).toContain(key);
  });

  it('S-362 등급이 A · B · C 로 갈리고 본보기 셋의 등급이 달라지지 않는다 (결정 나무의 답)', () => {
    for (const [id, expected] of GRADED_EXAMPLES) {
      const result = gradeFromFile(exampleAt(id)) as { grade: string; blocking: readonly unknown[] };
      expect({ id, grade: result.grade }).toEqual({ id, grade: expected });
    }
    // 그리고 걸린 것의 수도 그대로다 — A 는 없고 · B 는 규칙 하나 · C 는 축 둘 (T4 의 완료 조건)
    const blockingOf = (id: string) => (gradeFromFile(exampleAt(id)) as { blocking: readonly unknown[] }).blocking.length;
    expect({ a: blockingOf('GAS_VILLAGE'), b: blockingOf('GHOST_CITY'), c: blockingOf('MAGIC_CITY') }).toEqual({
      a: 0,
      b: 1,
      c: 2,
    });
  });

  it(
    'S-363 world:lab 의 편중 요약에 ㊻ 이 든다 — 방 하나가 늘면 그 줄이 움직인다',
    async () => {
      const dir = mkdtempSync(join(tmpdir(), 'c037-lab-'));
      try {
        const candidates = await runBatch(['가스로 가득 찬 마을'], async () => exampleOf('GAS_VILLAGE'), {
          attempts: 1,
          dir,
        });
        const stood = candidates[0]!;
        const shifts = (stood.judgement as { shifts: readonly { id: string }[] }).shifts;
        expect(shifts.length).toBeGreaterThan(0);
        // ㊻ 의 줄이 그 요약에 있다 — 편중은 새로 세지 않고 검사 보고를 견주어 나온다
        const summaryMark = runWorldCheck().items.find((i) => i.id === SUMMARY_ID)!.mark;
        expect({ mark: summaryMark }).toEqual({ mark: SUMMARY_MARK });
        expect({ listed: shifts.some((s) => s.id === SUMMARY_ID) }).toEqual({ listed: true });
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    180_000,
  );

  it('S-364 world:observe --report 기회 표에 「지금」 열이 서고, 기회마다 한 줄씩 있다', () => {
    const run = runTool(OBSERVE, ['--report']);
    expect(run.status).toBe(0);
    // 갓 선 세계(t=0)의 값이다 — 조건 표와 같은 어법 (spec SPEC-008)
    expect({ column: run.out.includes('지금') }).toEqual({ column: true });
    for (const one of allOpportunities()) {
      expect({ id: one.id, listed: run.out.includes(one.id) }).toEqual({ id: one.id, listed: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
//
// C036 의 세계가 낸 답 — **이 Cycle 이 한 값도 바꾸지 않아야 하는 것**.
//
// spec SPEC-009 가 "모든 판정이 C036 과 같다" 를 못 박았으므로, C036 이 닫힌 자리의 세계가 방마다
// 낸 줄을 그대로 받아 적었다 (그 표는 C035 가 낸 답 그대로이기도 하다 — 기회가 붙어도 available ·
// reason 은 한 값도 달라지지 않았다). 줄 하나는 `id/role/대상/available/사유` 다.
const C036_INTERACTIONS: Readonly<Record<string, readonly string[]>> = {
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

/** 지금 굴러가는 규칙 코드 전부의 글 — 이름 0 을 여기서 본다 (c036 의 선례 그대로) */
function ruleSourceText(): { file: string; lines: string[] }[] {
  const folder = 'content/world/rules';
  return readdirSync(`${ROOT}${folder}`)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => ({
      file: `${folder}/${name}`,
      lines: readFileSync(`${ROOT}${folder}/${name}`, 'utf8').split('\n'),
    }));
}

describe('회귀', () => {
  it('S-365 (SPEC-009) 방마다 available · reason · role · 순서가 C036 과 한 값도 다르지 않다', () => {
    for (const spec of REGION_SPECS) {
      const lines = seenIn(spec.id).map(
        (i) => `${i.id}/${i.role}/${i.targetEntityId ?? ''}/${i.available}/${i.reason ?? ''}`,
      );
      expect({ region: spec.id, lines }).toEqual({
        region: spec.id,
        lines: [...(C036_INTERACTIONS[spec.id] ?? [])],
      });
    }
  });

  it('S-366 (SPEC-009) 검사가 쉰이고 통과이며, 두 번 돌려도 글자까지 같다 · ㊻ 에 Event 둘', () => {
    const first: CheckReport = runWorldCheck();
    expect(first.items.length).toBe(CHECK_COUNT);
    expect({ fail: first.counts.fail, ok: first.ok }).toEqual({ fail: 0, ok: true });
    for (const item of first.items) {
      expect({ id: item.id, failed: item.status === 'fail' }).toEqual({ id: item.id, failed: false });
    }
    expect(JSON.stringify(runWorldCheck())).toBe(JSON.stringify(first));
    // ㊻ 은 판정하지 않고 보고한다 — 그 보고가 이제 Event 의 수를 든다 (spec Observable 4)
    const summary: CheckItem | undefined = first.items.find((i) => i.id === SUMMARY_ID);
    expect(summary, '보고에 opportunity-summary 가 없다').toBeDefined();
    expect({ mark: summary!.mark, status: summary!.status }).toEqual({
      mark: SUMMARY_MARK,
      status: 'report',
    });
    expect({ events: allOpportunities().filter((one) => isEventData(one)).length }).toEqual({
      events: EVENT_COUNT,
    });
    expect(new RegExp(`Event[^0-9]{0,8}${EVENT_COUNT}`).test(JSON.stringify(summary))).toBe(true);
  });

  it('S-367 (SPEC-009) 방마다 땅의 hash 가 그대로이고, 기회를 물어도 세계의 State 가 달라지지 않는다', () => {
    const w = standingIn(REGION_SPECS[0]!.id);
    const before = JSON.stringify(state(w));
    const first = JSON.stringify(allOpportunities());
    expect(JSON.stringify(allOpportunities())).toBe(first);
    expect(JSON.stringify(state(w))).toBe(before);
    for (const spec of REGION_SPECS) {
      expect({ id: spec.id, hash: standingIn(spec.id).observe().region.hash }).toEqual({
        id: spec.id,
        hash: descriptionHash(spaceOf(spec.id)),
      });
    }
  });

  it('S-368 (SPEC-009) 규칙 코드에 기회 · 경로 · 탄생지의 이름 글자가 없다 (grep 이 증거)', () => {
    const names = [
      'opportunity',
      GATHER,
      CROSS,
      ...ROUTES.map((r) => r.id),
      ...ALL_SITES.map((s) => s.id),
    ];
    const hits: string[] = [];
    for (const one of ruleSourceText()) {
      one.lines.forEach((text, index) => {
        for (const name of names) {
          if (text.includes(name)) hits.push(`${one.file}:${index + 1}  ${name}  │ ${text.trim()}`);
        }
      });
    }
    expect(hits.join('\n')).toBe('');
  });

  it('S-369 (SPEC-009) 먹이 잔해의 되돌아옴이 C036 과 같다 — 눈 없는 것이 지나기 전에는 고갈이고 지나면 선다', () => {
    // 이 세계가 경로로 남기는 것 가운데 비늘이 아닌 것 — 데이터가 그 이름을 소유한다
    const remains = LEFT_BEHIND.find((id) => id !== SCALE);
    expect(remains, '경로가 남기는 것이 하나뿐이다 — 먹이 잔해가 데이터에 없다').toBeDefined();
    const source = sourceById(remains!);
    const route = routeLeaving(remains!)!;
    const room = roomsOnRoute(route).find((id) => id === source.regionId)!;
    const w = standingIn(room);
    // 갓 선 세계에서는 고갈이고 그 기회도 닫혀 있다
    expect({ minable: isMinable(w, room, remains!) }).toEqual({ minable: false });
    const seen = seenGather(w, remains!);
    if (seen) expect({ event: seen.event, open: seen.open }).toEqual({ event: true, open: false });
    // 지나가면 선다 — 되돌리는 것은 시간이 아니라 지나감이다 (C018 · C036 그대로)
    runUntil(w, () => isMinable(w, room, remains!), 3000, `${remains} 가 다시 서는 것`);
    expect(historyOf(w, room)?.passages?.[route.id]?.times).toBeGreaterThanOrEqual(1);
  });
});
