// C025 — 숲이 스스로 돈다 · 세계 쪽 검증 시나리오 (spec SPEC-001 ~ SPEC-010)
//
// C022 · C023 이 생명을 세우고 C024 가 그 값에 **내림**과 철의 수 세기를 얹었다. 이 Cycle 은
// 그 위에 **값과 값 사이의 관계**를 얹는다 — 개체군이 셋이 되고, 철이 바뀔 때마다 관계 다섯이
// 값을 올리고 내리고 원천을 세운다. 그래서 여기서 재는 것은 여덟이다:
//   ① 부름(CALLS) — from 이 상한의 절반 이상이면 to 가 1 오른다 (상한을 넘지 않는다)
//   ② 먹음(EATS)  — from 이 1 이상이면 to 가 1 준다 (0 아래는 없다)
//   ③ 남김(LEAVES)— from 이 1 이상이면 to 인 원천이 **선다**. 그 원천은 시간으로 돌아오지 않는다
//   ④ 한 마디 — 한 철의 판정은 **함께 읽고 함께 적용한다**. 앞의 관계가 올린 값을 뒤의 관계가
//      그 철에 쓰지 않는다 (이 Cycle 의 심장이다 — 값 셋을 세워 한 철을 넘긴 뒤
//      **무엇이 움직이고 무엇이 안 움직였는가**로 잰다)
//   ⑤ 방을 넘음 — 밝힌 이음이 실제로 두 방을 이을 때 선다. **오르는 것은 to 의 방**이고
//      from 의 방은 한 값도 달라지지 않는다
//   ⑥ 방향(trend) — 그 철의 **처음과 끝**을 견준 답 하나다 (중간을 보지 않는다) · 저장된다
//   ⑦ 바퀴 — 사체 → 변성 → 균사 → 뿌리혹 → 탄생이 **관찰자 없이** 이어진다
//   ⑧ 도구 — ㉜ 가 관계 다섯을 재고 ㉝ 가 "관계 없는 개체군 0" 을 보고하고 ㉛ 의 대상이 셋이 된다
//
// 세계는 공개 경로로만 본다 — driveWorld 로 굴리고 observe() 를 읽는다. State 를 직접 읽는
// 자리는 spec 의 State 절과 SPEC 이 점 경로로 못 박은 넷뿐이다
// (`RegionState.populations[id].value` · `.trend` · `RegionState.sources[id]` ·
// `World.seasonsApplied`) — 개체군의 값도 방향도 관계도 관찰 봉투에 실리지 않기 때문이다
// (spec Observable "투영하지 않는 것").
//
// 이 Cycle 의 새 구현(content/regions 의 새 데이터 · content/world/semantic 과 simulation 의
// 새 함수 · content/view/** · tools/world-editor/run.ts)은 **읽지 않았다.** 기대값의 출처는
// cycles/C025-the-forest-turns-on-its-own/spec.md 와 이미 있던 하네스·선례(c024 · c023)뿐이다.
// 다만 SPEC-010 은 **도구의 보고**여서 `tools/world-editor/check.ts` 의 `runWorldCheck()` 를
// 부르는 것이 유일한 길이다 — 부르기만 하고 그 안을 읽지 않았다 (c014 · c021 · c024 의 그 짝).
//
// 손으로 적는 것은 spec 이 이름으로 못 박은 것(방 · 원천 id · 개체군 id · 상한 4 · 2 · 1 ·
// 문턱 · 하루 360 · trend 의 어휘 셋)뿐이다. 이음이 실제로 두 방을 잇는가는 손으로 적지 않고
// REGION_GRAPH 에서 **재고**, 되돌아옴의 길이는 그 원천 데이터에서 얻는다.
//
// **전체 개수를 단언하지 않는다** — 이 Cycle 이 더한 것의 존재와 행동만 본다.

import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import type { CheckItem, CheckReport } from '../../../engine/world-authoring/check';
import type { WorldSnapshot } from '../../../engine/world-kernel/persistence';
import {
  CONDITION_UNMET,
  FOREST_DEEP,
  FOREST_EDGE,
  NEST_TRAIL,
  ORE_EATER,
  PREDATOR_NEST,
  RED_EYE_TREE,
  REGION_GRAPH,
  REGION_SPECS,
  TREE_APPROACH,
  TREE_FUNGUS,
  type SeasonId,
} from '../../regions';
import type { EntityView, GameViewSnapshot } from '../../protocol/gameview';
import { createWorld, restoreWorld, type World, type WorldSetup } from '../index';
import type { WorldState } from '../semantic/world-state';
import { inflowOf, sourcesInRegion, sourceStateOf } from '../semantic/resource';
import { driveWorld, OBSERVER, type WorldDriver } from './drive';
// SPEC-010 은 도구의 답이다 — 이 하나만은 검사를 **부르는** 것이 유일한 길이다.
import { runWorldCheck } from '../../../tools/world-editor/check';

// ── spec 이 이름으로 못 박은 것들 (State 의 데이터 값 표) ──────────────

/** 방 셋 — 거목의 방(광식충) · 숲 안쪽(대형 조류) · 둥지(포식수 · 사체) */
const TREE = RED_EYE_TREE;
const DEEP = FOREST_DEEP;
const NEST = PREDATOR_NEST;
/** 관찰자가 서 있을 자리 — 값 셋이 사는 방 **어디도 아니다** (이 Cycle 의 어법) */
const AWAY = FOREST_EDGE;

/** 개체군 셋과 그 상한 (spec 데이터 값 표 · 확정 6 의 눈금) */
const BIG_BIRD = 'BIG_BIRD';
const PREDATOR = 'PREDATOR';
const ORE_EATER_SCALE = 4;
const BIG_BIRD_SCALE = 2;
const PREDATOR_SCALE = 1;
/** CALLS 의 문턱 — 상한의 절반 이상 (spec 문턱 표) */
const halfOf = (scale: number) => Math.ceil(scale / 2);

/** 원천 넷 — 사체(LEAVES 의 to) · 균사 · 뿌리혹 (사슬은 C013 · C014 · C024 가 세웠다) */
const CARCASS = 'NEST_CARCASS';
const FUNGUS = 'NEST_FUNGUS';
const NODULE = 'ROOT_NODULE';
/** 변성지 — C024 의 셋째 탄생 방식 (사체를 먹는다) */
const BLOOM = 'CARCASS_TO_FUNGUS';
/** 거목균 — 관계를 하나도 밝히지 않은 개체군 (SPEC-001 경계 ④ 의 증인) */
const TREE_FUNGUS_SCALE = 2;

/** 값의 방향 어휘 셋 (spec State 절) */
const RISING = 'rising';
const FALLING = 'falling';
const STEADY = 'steady';

/** 철 넷 가운데 둘 — 뒤척임 60 · 긴 밤 360 (C015 가 세운 눈금) */
const TURN: SeasonId = 'TURN';
const LONG_NIGHT: SeasonId = 'LONG_NIGHT';
const TURN_LENGTH = 60;
const LONG_NIGHT_LENGTH = 360;
/** 하루 — 360 세계 초 (C022 spec 데이터) */
const DAY_TOTAL = 360;
/** 변성의 결속 — 120 세계 초 (C024 spec 데이터 · 회귀로만 쓴다) */
const TRANSFORM_SECONDS = 120;

/** 탄생지의 phase (C022 · C023 State — 회귀로만 쓴다) */
const BINDING = 'BINDING';

/** 원천의 phase (C012 · C013 그대로) */
const AVAILABLE = 'available';
const DEPLETED = 'depleted';

// ── 하네스 (c022 ~ c024 의 선례 그대로) ──────────────────────────────

/** 검증용 손잡이 — 교집합으로 둔다 (c022 ~ c024 의 LifeSetup 그대로) */
type LifeSetup = WorldSetup & {
  lifeSitePhases?: Record<string, string>;
  populations?: Record<string, number>;
};

const solo: LifeSetup = { npcs: [] };

const state = (w: WorldDriver) => w.world.snapshot().state as WorldState;
const statesOf = (w: WorldDriver) => state(w).regionStates as Record<string, unknown>;
const worldTime = (w: WorldDriver) => state(w).time;
/** `World.seasonsApplied` — spec 이 이름으로 못 박은 자리 (C024 가 세웠다) */
const seasonsAppliedOf = (w: WorldDriver): number =>
  (state(w) as unknown as { seasonsApplied: number }).seasonsApplied;

/** 값 셋을 한 벌로 다룬다 — spec 의 데이터 표가 그 셋을 한 사슬로 적었기 때문이다 */
interface Values {
  oreEater: number;
  bigBird: number;
  predator: number;
}

/**
 * 값 셋을 세운 세계 하나 — 관찰자는 **그 셋이 사는 방 어디에도 없다**.
 * clock 이 철의 첫머리를 세우므로 여기서 세운 값이 곧 **그 철이 시작할 때의 값**이다.
 */
function standWorld(
  values: Values,
  extra: LifeSetup = {},
  season: SeasonId = TURN,
  region: string = AWAY,
): WorldDriver {
  const w = driveWorld({
    ...solo,
    actorRegion: region,
    clock: season,
    ...extra,
    populations: {
      [ORE_EATER]: values.oreEater,
      [BIG_BIRD]: values.bigBird,
      [PREDATOR]: values.predator,
      ...(extra.populations ?? {}),
    },
  } as WorldSetup);
  // Given 이 실제로 섰는가 — 세우지 못한 값 위에서 재면 답이 거짓말이 된다
  expect({ given: three(w) }).toEqual({ given: values });
  return w;
}

/** 세계 시간을 흘린다 — 한 걸음 1 세계 초로 나눠 굴린다 (c013 ~ c024 의 wait 그대로) */
function wait(w: WorldDriver, seconds: number, step = 1) {
  let left = seconds;
  while (left > 1e-9) {
    const dt = Math.min(step, left);
    w.tick(dt);
    left -= dt;
  }
}
/** 그 철이 끝나고 다음 철로 넘어간 뒤까지 굴린다 (c024 의 pastTurn 그대로) */
const pastSeason = (w: WorldDriver, length = TURN_LENGTH) => wait(w, length + 5);

/** 그 조건이 참이 될 때까지 굴린다 (1 세계 초 걸음) — 걸린 세계 초를 돌려준다 */
function runUntil(w: WorldDriver, done: () => boolean, limitSeconds: number, what: string): number {
  for (let s = 0; s < limitSeconds; s++) {
    if (done()) return s;
    w.tick(1);
  }
  if (done()) return limitSeconds;
  throw new Error(`${limitSeconds} 세계 초 안에 일어나지 않았다 — ${what}`);
}

// ── 저장·복구 (persistence.spec · c013 ~ c024 의 선례 그대로) ─────────

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
const throughFile = (snapshot: WorldSnapshot): WorldSnapshot =>
  JSON.parse(JSON.stringify(snapshot)) as WorldSnapshot;

function revive(base: WorldDriver): WorldDriver {
  const restored = restoreWorld(throughFile(base.world.snapshot()));
  if (!restored) throw new Error('되살릴 수 없는 스냅샷이다');
  const world = createWorld({}, restored);
  world.join(OBSERVER);
  world.tick(0);
  return wrap(world);
}

// ── State 를 읽는 자리 (spec 의 점 경로) ─────────────────────────────

interface PopulationShape {
  value: number;
  trend?: string;
  metThisSeason?: boolean;
}
/** `RegionState.populations[<id>]` — spec State 절이 이름으로 못 박은 자리 */
function populationState(w: WorldDriver, region: string, id: string): PopulationShape {
  const here = statesOf(w)[region] as { populations?: Record<string, PopulationShape> } | undefined;
  const found = here?.populations?.[id];
  if (!found) {
    throw new Error(`Region State 에 개체군이 없다 — regionStates.${region}.populations.${id}`);
  }
  return found;
}
/** `RegionState.populations[<id>].value` */
const valueOf = (w: WorldDriver, region: string, id: string): number =>
  populationState(w, region, id).value;
/** `RegionState.populations[<id>].trend` */
const trendOf = (w: WorldDriver, region: string, id: string): string | undefined =>
  populationState(w, region, id).trend;

const oreEaters = (w: WorldDriver): number => valueOf(w, TREE, ORE_EATER);
const bigBirds = (w: WorldDriver): number => valueOf(w, DEEP, BIG_BIRD);
const predators = (w: WorldDriver): number => valueOf(w, NEST, PREDATOR);
const treeFungi = (w: WorldDriver): number => valueOf(w, NEST, TREE_FUNGUS);

/** 값 셋을 한 눈에 — 이 Cycle 이 재는 것은 언제나 셋이 함께다 */
const three = (w: WorldDriver): Values => ({
  oreEater: oreEaters(w),
  bigBird: bigBirds(w),
  predator: predators(w),
});
/** 방향 셋을 한 눈에 */
const trends = (w: WorldDriver) => ({
  oreEater: trendOf(w, TREE, ORE_EATER),
  bigBird: trendOf(w, DEEP, BIG_BIRD),
  predator: trendOf(w, NEST, PREDATOR),
});

interface SourceShape {
  phase: string;
  taken: number;
  progress?: number;
}
const sourceAt = (w: WorldDriver, region: string, id: string): SourceShape =>
  sourceStateOf(statesOf(w) as never, region, id) as SourceShape;
/** 원천 하나의 지금 — 견주기 좋게 세 값만 뽑는다 (c024 의 sourceShot 그대로) */
const sourceShot = (w: WorldDriver, region: string, id: string) => {
  const held = sourceAt(w, region, id);
  return { id, phase: held.phase, taken: held.taken, progress: held.progress ?? 0 };
};
const carcassPhase = (w: WorldDriver): string => sourceShot(w, NEST, CARCASS).phase;

interface LifeSiteShape {
  phase: string;
  progress: number;
}
/** `RegionState.lifeSites[<id>].phase` — spec 이 이름으로 못 박은 자리 (C022 · C024) */
function lifeSiteState(w: WorldDriver, region: string, id: string): LifeSiteShape {
  const here = statesOf(w)[region] as { lifeSites?: Record<string, LifeSiteShape> } | undefined;
  const found = here?.lifeSites?.[id];
  if (!found) throw new Error(`Region State 에 탄생지가 없다 — regionStates.${region}.lifeSites.${id}`);
  return found;
}
const sitePhase = (w: WorldDriver, region: string, id: string): string =>
  lifeSiteState(w, region, id).phase;

/**
 * 방 하나의 지금 — 그 방의 **개체군 값들**과 **거기 서 있는 원천들** (SPEC-005 경계 ③ 의 판).
 *
 * 되돌아옴의 진행이나 흐름이 비우는 것은 시간의 일이지 관계의 일이 아니다 (C013 · C014).
 * 관계가 방에 하는 일은 둘뿐이므로 그 둘만 찍는다 — 값을 올리고 내리는 것,
 * 그리고 **없던 자리에 원천을 세우는 것**(LEAVES).
 *
 * 물길이 먹이는 원천은 세지 않는다 — 그것을 세우고 비우는 것은 시간표이지 관계가 아니다
 * (C014 의 흐름 그대로 · 어느 관계도 그것을 to 로 삼지 않는다).
 */
function roomShot(w: WorldDriver, region: string) {
  const here = statesOf(w)[region] as { populations?: Record<string, PopulationShape> } | undefined;
  return {
    populations: Object.fromEntries(
      Object.entries(here?.populations ?? {}).map(([id, one]) => [id, one.value]),
    ),
    standing: sourcesInRegion(region)
      .map((one) => one.id)
      .filter((id) => !inflowOf(id))
      .filter((id) => sourceShot(w, region, id).phase === AVAILABLE),
  };
}
/** 그 사이에 **없던 자리에 선** 원천들 — LEAVES 가 한 일은 이 모양으로 나타난다 */
const newlyStanding = (
  before: ReturnType<typeof roomShot>,
  after: ReturnType<typeof roomShot>,
): string[] => after.standing.filter((id) => !before.standing.includes(id));

// ── 관찰 봉투를 읽는 자리 (spec Observable) ──────────────────────────

type CodedView = EntityView & { conditions?: string[] };

const sourceEntity = (v: GameViewSnapshot, id: string): CodedView | undefined =>
  v.entities.find((e) => e.role === 'resource-source' && e.id === id) as CodedView | undefined;

/** 그 원천에 지금 걸린 조건 코드들 — 하나도 없으면 자리 자체가 없다 (관찰 계약) */
function sourceCodes(w: WorldDriver, id: string): string[] {
  const seen = sourceEntity(w.observe(), id);
  if (!seen) throw new Error(`관찰 결과에 원천 '${id}' 가 실리지 않았다`);
  return seen.conditions ?? [];
}

/** 지나는 것과 **서 있는 떼**가 같은 자리에 실린다 — 떼만 `area` 를 진다 (관찰 계약) */
type PresenceShape = { presence: string; curve?: string; area?: string };
const swarmAreas = (w: WorldDriver): string[] =>
  (w.observe().presences as unknown as PresenceShape[])
    .filter((p) => p.area !== undefined)
    .map((p) => p.area!);

/** 그 봉투 안에 **값이 꼭 그것인** 자리가 있는가 — 부분 문자열은 세지 않는다 (c023 · c024 선례) */
function carriesExactly(value: unknown, needle: string): boolean {
  if (typeof value === 'string') return value === needle;
  if (value === null || typeof value !== 'object') return false;
  return Object.values(value as Record<string, unknown>).some((one) => carriesExactly(one, needle));
}

// ── 데이터에서 얻는 것 (손으로 적지 않는다) ──────────────────────────

/** 그 이음이 **실제로** 두 방을 잇는가 — REGION_GRAPH 가 답한다 (SPEC-005 ①) */
function connectorJoins(via: string, a: string, b: string): boolean {
  return REGION_GRAPH.connectors.some(
    (c) =>
      c.id === via &&
      ((c.from.region === a && c.to.region === b) || (c.from.region === b && c.to.region === a)),
  );
}
const recoverySecondsOf = (region: string, id: string): number => {
  const found = sourcesInRegion(region).find((s) => s.id === id);
  if (!found) throw new Error(`${region} 에 원천 '${id}' 가 없다`);
  return found.recoverySeconds;
};

/**
 * `world:run` 을 **부르기만** 한다 — package.json 의 world:run 이 여는 그 문(門)이다.
 * 인자를 하나도 주지 않는다: 도구가 스스로 밝힌 기본 바퀴 수로 돈다 (spec 은 N 을 정하지 않는다).
 */
function callWorldRun(): { status: number; out: string } {
  const ran = spawnSync('npx', ['tsx', 'tools/world-editor/run.ts'], {
    encoding: 'utf8',
    timeout: 120_000,
  });
  return { status: ran.status ?? -1, out: `${ran.stdout ?? ''}${ran.stderr ?? ''}` };
}

// ── 검사 보고 (SPEC-010 — 도구를 부르기만 한다) ──────────────────────

const REPORT: CheckReport = runWorldCheck();
function itemAt(mark: string): CheckItem {
  const found = REPORT.items.find((i) => i.mark === mark);
  if (!found) throw new Error(`보고에 검사 ${mark} 가 없다`);
  return found;
}

// ─────────────────────────────────────────────────────────────────────
// SPEC-001 — 관계가 값을 올린다 (CALLS)
// ─────────────────────────────────────────────────────────────────────

/** 사체를 비워 둔다 — LEAVES 가 세우는 것이 섞이지 않도록 (그 판정은 SPEC-003 이 한다) */
const noCarcass: LifeSetup = { sourcePhases: { [CARCASS]: DEPLETED } };

/**
 * 세계의 원천을 **남김없이** 바닥낸 채로 세운다 (c024 S-225 의 그 하네스 그대로).
 *
 * 사체 하나만 비우면 뿌리혹이 내내 서 있어 잘게 굴린 세계만 내림을 면한다 — 그러면 두 길이
 * 관계가 아니라 **내림**에서 갈린다 (C024 가 못 박은 큰 걸음의 어법: 건너뛴 철의 요구가
 * 찼는지 알 수 없으므로 첫 철만 그 답을 쓰고 나머지는 거짓으로 친다).
 */
const allDepleted = (): Record<string, string> =>
  Object.fromEntries(
    REGION_SPECS.flatMap((spec) =>
      (spec.resourceEcology?.sources ?? []).map((one) => [one.id, DEPLETED] as const),
    ),
  );

describe('SPEC-001 관계가 값을 올린다 (CALLS)', () => {
  it('S-401 (①) from 이 상한의 절반이면 철이 바뀔 때 to 의 값이 1 오른다', () => {
    // Given 광식충이 꼭 절반(⌈4/2⌉=2)이고 새도 포식수도 없는 세계
    const w = standWorld({ oreEater: halfOf(ORE_EATER_SCALE), bigBird: 0, predator: 0 }, noCarcass);
    const seasons = seasonsAppliedOf(w);

    // When 그 철이 끝나고 다음 철이 온다
    pastSeason(w);

    // Then 숲 안쪽의 새가 하나 섰다 — 철은 꼭 하나 지났다
    expect({ ...three(w), seasons: seasonsAppliedOf(w) }).toEqual({
      oreEater: halfOf(ORE_EATER_SCALE),
      bigBird: 1,
      predator: 0,
      seasons: seasons + 1,
    });
  }, 60_000);

  it('S-402 (②) to 의 상한에서는 오르지 않는다', () => {
    // Given 광식충이 상한이고 새가 이미 상한인 세계 (포식수는 없다)
    const w = standWorld({ oreEater: ORE_EATER_SCALE, bigBird: BIG_BIRD_SCALE, predator: 0 }, noCarcass);

    // When 한 철이 지난다
    pastSeason(w);

    // Then 새는 상한 그대로다 — 그 철에 새가 광식충을 먹고 포식수를 부른 것과 별개다
    expect(three(w)).toEqual({
      oreEater: ORE_EATER_SCALE - 1,
      bigBird: BIG_BIRD_SCALE,
      predator: 1,
    });
  }, 60_000);

  it('S-403 (경계 ③) from 이 절반보다 적으면 오르지 않는다', () => {
    // Given 광식충이 절반보다 하나 적은 세계
    const w = standWorld({ oreEater: halfOf(ORE_EATER_SCALE) - 1, bigBird: 0, predator: 0 }, noCarcass);

    // When 한 철이 지난다
    pastSeason(w);

    // Then 새가 서지 않았다 — 한 값도 달라지지 않았다
    expect(three(w)).toEqual({
      oreEater: halfOf(ORE_EATER_SCALE) - 1,
      bigBird: 0,
      predator: 0,
    });
  }, 60_000);

  it('S-404 (경계 ④) 관계를 밝히지 않은 개체군은 이 규칙이 건드리지 않는다', () => {
    // Given 관계가 도는 세계에 거목균이 하나 서 있다 (거목균은 어느 관계의 양 끝도 아니다).
    // 사체를 세워 둔다 — 거목균의 요구가 그 철 내내 차 있어야 **내림**이 섞이지 않는다
    // (내림은 C024 의 규칙이고 여기서 재는 것은 관계다)
    const w = standWorld({ oreEater: ORE_EATER_SCALE, bigBird: 0, predator: 0 }, {
      sourcePhases: { [CARCASS]: AVAILABLE },
      populations: { [TREE_FUNGUS]: 1 },
    });
    const before = treeFungi(w);
    expect({ before }).toEqual({ before: 1 });

    // When 한 철이 지난다 (새가 선다)
    pastSeason(w);

    // Then 새는 섰고 거목균은 한 값도 달라지지 않았다
    expect({ bigBird: bigBirds(w), treeFungus: treeFungi(w) }).toEqual({
      bigBird: 1,
      treeFungus: before,
    });
  }, 60_000);
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-002 — 관계가 값을 내린다 (EATS)
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-002 관계가 값을 내린다 (EATS)', () => {
  it('S-411 (①) from 이 1 이상이면 철이 바뀔 때 to 의 값이 1 준다', () => {
    // Given 새가 하나 선 세계 (광식충은 상한이고 뿌리혹은 그대로 서 있다 — 내림이 없다)
    const w = standWorld({ oreEater: ORE_EATER_SCALE, bigBird: 1, predator: 0 }, noCarcass);

    // When 한 철이 지난다
    pastSeason(w);

    // Then 광식충이 꼭 하나 줄었다 (같은 철에 새는 오르고 포식수가 선다 — 그것이 한 마디다)
    expect(three(w)).toEqual({
      oreEater: ORE_EATER_SCALE - 1,
      bigBird: 2,
      predator: 1,
    });
  }, 60_000);

  it('S-412 (②) 값은 0 아래로 내려가지 않는다', () => {
    // Given 광식충이 하나도 없고 새가 하나 선 세계
    // (뿌리혹을 비워 둔다 — 그 철에 결속이 서서 값이 도로 오르지 않도록)
    const w = standWorld({ oreEater: 0, bigBird: 1, predator: 0 }, {
      ...noCarcass,
      sourcePhases: { [CARCASS]: DEPLETED, [NODULE]: DEPLETED },
    });

    // When 한 철이 지난다
    pastSeason(w);

    // Then 0 이다 — 음수가 되지 않는다
    expect({ oreEater: oreEaters(w) }).toEqual({ oreEater: 0 });
  }, 60_000);

  it('S-413 (경계 ③) from 이 0 이면 내리지 않는다', () => {
    // Given 포식수가 하나도 없고 새가 둘인 세계 (광식충이 0 이라 새를 부르는 것도 없다)
    const w = standWorld({ oreEater: 0, bigBird: BIG_BIRD_SCALE, predator: 0 }, noCarcass);

    // When 한 철이 지난다
    pastSeason(w);

    // Then 새는 한 마리도 줄지 않았다 — 다만 그 새가 포식수를 부른다
    expect(three(w)).toEqual({ oreEater: 0, bigBird: BIG_BIRD_SCALE, predator: 1 });
  }, 60_000);
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-003 — 관계가 원천을 세운다 (LEAVES)
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-003 관계가 원천을 세운다 (LEAVES)', () => {
  it('S-421 (①) from 이 1 이상이면 철이 바뀔 때 거기 없던 원천이 선다', () => {
    // Given 포식수가 하나 서 있고 둥지에 사체가 **없는** 세계
    const w = standWorld({ oreEater: 0, bigBird: 0, predator: 1 }, noCarcass);
    expect({ carcass: carcassPhase(w) }).toEqual({ carcass: DEPLETED });

    // When 한 철이 지난다
    pastSeason(w);

    // Then 사체가 서서 캘 수 있다
    expect({ carcass: carcassPhase(w) }).toEqual({ carcass: AVAILABLE });
  }, 60_000);

  it('S-422 (②) 이미 서 있으면 아무 일도 일어나지 않는다', () => {
    // Given 포식수가 있고 사체가 **이미 서 있는** 세계
    // (거목균을 상한으로 세워 변성이 그 사체를 먹지 않게 둔다 — C024 의 자리다)
    const w = standWorld({ oreEater: 0, bigBird: 0, predator: 1 }, {
      sourcePhases: { [CARCASS]: AVAILABLE },
      populations: { [TREE_FUNGUS]: TREE_FUNGUS_SCALE },
    });
    const before = sourceShot(w, NEST, CARCASS);
    expect({ phase: before.phase }).toEqual({ phase: AVAILABLE });

    // When 한 철이 지난다
    pastSeason(w);

    // Then 그 원천의 세 값이 하나도 달라지지 않았다
    expect(sourceShot(w, NEST, CARCASS)).toEqual(before);
  }, 60_000);

  it('S-423 (경계 ③) from 이 0 이면 서지 않는다', () => {
    // Given 포식수가 하나도 없고 사체도 없는 세계
    const w = standWorld({ oreEater: 0, bigBird: 0, predator: 0 }, noCarcass);

    // When 한 철이 지난다
    pastSeason(w);

    // Then 사체가 서지 않았다
    expect({ carcass: carcassPhase(w) }).toEqual({ carcass: DEPLETED });
  }, 60_000);

  it('S-424 (경계 ④) 그 원천은 시간으로 돌아오지 않는다 — condition-unmet 을 지고 진행이 멎는다', () => {
    // Given 포식수가 없고 사체도 없는 세계 (관찰자가 둥지에서 본다)
    const w = standWorld({ oreEater: 0, bigBird: 0, predator: 0 }, noCarcass, TURN, NEST);
    w.tick(1);
    const start = sourceShot(w, NEST, CARCASS);
    // 데이터가 소유한 되돌아옴의 길이 — 손으로 적지 않는다
    const length = recoverySecondsOf(NEST, CARCASS);
    expect({ phase: start.phase, progress: start.progress }).toEqual({
      phase: DEPLETED,
      progress: 0,
    });

    // When 그 길이의 두 곱을 넘게 흘린다 (철도 지난다 — 다만 사냥이 없다)
    wait(w, Math.max(length * 2, DAY_TOTAL));

    // Then 한 톨도 오르지 않았고 phase 도 그대로다 — 되돌리는 것은 다음 사냥이다
    expect(sourceShot(w, NEST, CARCASS)).toEqual(start);
    // And 아직 없다는 그 사실이 **기존 코드**로 실린다 (흐름 · 지나가는 것과 같은 글자다)
    expect({ carries: sourceCodes(w, CARCASS).includes(CONDITION_UNMET) }).toEqual({ carries: true });
  }, 120_000);
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-004 — 한 철의 판정은 함께 읽고 함께 적용한다 (이 Cycle 의 심장)
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-004 한 철의 판정은 함께 읽고 함께 적용한다', () => {
  it('S-431 (①) 한 철에 사슬이 **한 마디**만 나아간다 — 첫 마디', () => {
    // Given 광식충만 상한인 세계 (새도 포식수도 없고 사체도 없다)
    const w = standWorld({ oreEater: ORE_EATER_SCALE, bigBird: 0, predator: 0 }, noCarcass);

    // When 한 철이 지난다
    pastSeason(w);

    // Then 움직인 것은 **새 하나**뿐이다.
    // 차례대로 적용했다면 이 한 철에 바퀴가 통째로 돌았을 것이다 —
    // 새가 서고(1) 그 새가 광식충을 먹고(2) 포식수를 부르고(3) 그 포식수가 새를 먹고(4)
    // 사체를 남겼을(5) 것이다. 앞의 관계가 올린 값을 뒤의 관계가 그 철에 쓰지 않는다.
    expect({ ...three(w), carcass: carcassPhase(w) }).toEqual({
      oreEater: ORE_EATER_SCALE,
      bigBird: 1,
      predator: 0,
      carcass: DEPLETED,
    });
  }, 60_000);

  it('S-432 (①) 그 다음 철에 다음 마디가 나아간다 — 사체는 아직 서지 않는다', () => {
    // Given 앞 철이 낸 값 셋을 그대로 세운 세계
    const w = standWorld({ oreEater: ORE_EATER_SCALE, bigBird: 1, predator: 0 }, noCarcass);

    // When 한 철이 지난다
    pastSeason(w);

    // Then 새가 더 서고 · 광식충이 하나 줄고 · 포식수가 선다. 사체는 아직이다
    // (그 철이 시작할 때 포식수가 0 이었으므로 LEAVES 가 판정되지 않는다)
    expect({ ...three(w), carcass: carcassPhase(w) }).toEqual({
      oreEater: ORE_EATER_SCALE - 1,
      bigBird: 2,
      predator: 1,
      carcass: DEPLETED,
    });
  }, 60_000);

  it('S-433 (경계 ②) 관계 다섯이 다 서는 철의 답이 **관계의 차례와 무관한 값**이다', () => {
    // Given 관계 다섯이 모두 판정되는 값 셋 (광식충 상한 · 새 하나 · 포식수 하나)
    const w = standWorld({ oreEater: ORE_EATER_SCALE, bigBird: 1, predator: 1 }, noCarcass);

    // When 한 철이 지난다
    pastSeason(w);

    // Then 답은 그 철 시작의 값들로 셈한 **합**이다:
    //   광식충 4 −1(새가 먹는다)                       = 3
    //   새      1 +1(광식충이 부른다) −1(포식수가 먹는다) = 1
    //   포식수  1 +1(새가 부른다 · 상한 1 을 넘지 않는다)  = 1
    //   사체     선다 (포식수가 1 이상이다)
    // 이 셈은 **어느 차례로 적용해도 같은 값**이다 — 어느 개체군도 상한/바닥에 걸려
    // 오르내림이 잘리지 않기 때문이다. 차례가 답을 바꾸는 세계라면 여기서 갈린다.
    expect({ ...three(w), carcass: carcassPhase(w) }).toEqual({
      oreEater: ORE_EATER_SCALE - 1,
      bigBird: 1,
      predator: PREDATOR_SCALE,
      carcass: AVAILABLE,
    });
  }, 60_000);

  it('S-434 (경계 ③) 철을 여럿 건너뛴 큰 걸음도 지난 만큼 일어난다', () => {
    // Given 같은 세계 둘 — 긴 밤의 첫머리에서 시작한다 (긴 밤 360 → 뒤척임 60 → 고요)
    //
    // **세계의 원천을 남김없이 비운다** (c024 S-225 의 어법 그대로). 사체만 비우면 뿌리혹이
    // 내내 서 있어 **잘게 굴린 쪽만** 내림을 면한다 — 큰 걸음은 건너뛴 철의 요구가 찼는지
    // 알 수 없어 첫 철만 그 답을 쓰고 나머지는 거짓으로 치기 때문이다 (C024 가 못 박은 어법).
    // 그것은 관계의 일이 아니므로, 두 길이 **내림에서도** 같은 자리에 서게 해 놓고
    // 이 경계가 말하려는 것(관계가 지난 만큼 일어난다)만 남긴다.
    const values: Values = { oreEater: ORE_EATER_SCALE, bigBird: 0, predator: 0 };
    const dry: LifeSetup = { sourcePhases: allDepleted() };
    const slow = standWorld(values, dry, LONG_NIGHT);
    const leap = standWorld(values, dry, LONG_NIGHT);
    const span = LONG_NIGHT_LENGTH + TURN_LENGTH + 1; // 철 둘을 건넌다
    const seasons = seasonsAppliedOf(slow);

    // When 하나는 1 초씩, 하나는 한 걸음으로 같은 시간을 지난다
    wait(slow, span);
    leap.tick(span);
    // 세계는 그 걸음이 **끝난** 시각을 다음 Tick 에 읽는다 (c016 S-064 · c024 S-225 의 어법)
    leap.tick(0);

    // Then 두 길이 **같은 답**에 닿는다 — 철 둘이 다 세어졌고 한 마디씩 두 번 나아갔다.
    // 원천이 다 비었으므로 철마다 내림도 한 번씩 함께 든다 (C024 · 두 길이 같은 자리에 선다).
    //   철 ① 내림 −1 · 관계는 (4,0,0) 을 읽어 새를 세운다        → (3,1,0)
    //   철 ② 내림 −1 · 관계는 (3,1,0) 을 읽어 새가 먹고 부른다   → (1,2,1)
    const answer = {
      oreEater: 1,
      bigBird: 2,
      predator: 1,
      seasons: seasons + 2,
    };
    expect({ ...three(slow), seasons: seasonsAppliedOf(slow) }).toEqual(answer);
    expect({ ...three(leap), seasons: seasonsAppliedOf(leap) }).toEqual(answer);
  }, 120_000);
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-005 — 관계가 방을 넘는다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-005 관계가 방을 넘는다', () => {
  it('S-441 (①) 밝힌 이음이 실제로 두 방을 이으면 선다', () => {
    // Given 이 세계의 이음 둘이 그 방들을 **실제로** 잇는다 (데이터에서 잰다)
    expect({
      approach: connectorJoins(TREE_APPROACH, TREE, DEEP),
      nestTrail: connectorJoins(NEST_TRAIL, DEEP, NEST),
    }).toEqual({ approach: true, nestTrail: true });

    // When 광식충이 절반 이상인 채로 한 철이 지난다 (거목 → 숲 안쪽)
    const w = standWorld({ oreEater: ORE_EATER_SCALE, bigBird: 0, predator: 0 }, noCarcass);
    pastSeason(w);
    // Then 이웃한 방의 값이 올랐다
    expect({ bigBird: bigBirds(w) }).toEqual({ bigBird: 1 });

    // And 새가 선 채로 한 철이 지나면 그 다음 이음을 넘어 둥지의 값이 오른다 (숲 안쪽 → 둥지)
    const next = standWorld({ oreEater: 0, bigBird: 1, predator: 0 }, noCarcass);
    pastSeason(next);
    expect({ predator: predators(next) }).toEqual({ predator: 1 });
  }, 60_000);

  it('S-443 (경계 ③) 값이 오르는 것은 to 가 사는 방이다 — from 의 방은 한 값도 달라지지 않는다', () => {
    // Given 새 하나만 선 세계 — 그 새가 이음을 넘어 포식수를 부른다
    const w = standWorld({ oreEater: 0, bigBird: 1, predator: 0 }, noCarcass);
    const fromRoom = roomShot(w, DEEP);

    // When 한 철이 지난다
    pastSeason(w);

    // Then to 의 방에서 값이 올랐고
    expect({ predator: predators(w) }).toEqual({ predator: 1 });
    // And from 의 방(숲 안쪽)은 개체군의 값이 한 값도 달라지지 않았고 선 것도 없다
    expect({
      populations: roomShot(w, DEEP).populations,
      stood: newlyStanding(fromRoom, roomShot(w, DEEP)),
    }).toEqual({ populations: fromRoom.populations, stood: [] });

    // And 반대 갈래도 같다 — 광식충이 새를 부를 때 거목의 방에서는 아무 일도 일어나지 않는다
    const calling = standWorld({ oreEater: ORE_EATER_SCALE, bigBird: 0, predator: 0 }, noCarcass);
    const treeRoom = roomShot(calling, TREE);
    pastSeason(calling);
    expect({ bigBird: bigBirds(calling) }).toEqual({ bigBird: 1 });
    expect({
      populations: roomShot(calling, TREE).populations,
      stood: newlyStanding(treeRoom, roomShot(calling, TREE)),
    }).toEqual({ populations: treeRoom.populations, stood: [] });
  }, 60_000);

  it.todo(
    'GAP: (경계 ②) 밝힌 이음이 그 두 방을 잇지 않으면 아무 일도 하지 않는다 — ' +
      '끊긴 이음을 가리키는 관계를 세우려면 content/regions 에 없는 데이터를 지어내야 한다. ' +
      '이 세계의 관계 다섯이 밝힌 이음이 온전한가는 검사 ㉜ 이 답한다 (SPEC-010 ①)',
  );
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-006 — 값이 방향을 가진다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-006 값이 방향을 가진다', () => {
  it('S-451 (①) 오른 값은 오름 · 내린 값은 내림 · 그대로인 값은 멈춤이다', () => {
    // Given 광식충만 선 세계 — 그 철에 새만 오른다
    const first = standWorld({ oreEater: ORE_EATER_SCALE, bigBird: 0, predator: 0 }, noCarcass);
    pastSeason(first);
    // Then 새는 오름, 움직이지 않은 둘은 멈춤이다
    expect(trends(first)).toEqual({ oreEater: STEADY, bigBird: RISING, predator: STEADY });

    // Given 새가 하나 선 세계 — 그 철에 광식충이 내리고 새와 포식수가 오른다
    const second = standWorld({ oreEater: ORE_EATER_SCALE, bigBird: 1, predator: 0 }, noCarcass);
    pastSeason(second);
    expect({ ...three(second) }).toEqual({
      oreEater: ORE_EATER_SCALE - 1,
      bigBird: 2,
      predator: 1,
    });
    expect(trends(second)).toEqual({ oreEater: FALLING, bigBird: RISING, predator: RISING });
  }, 60_000);

  it('S-452 (②) 방향이 저장되고 되살아난다', () => {
    // Given 방향 셋이 갈린 세계
    const w = standWorld({ oreEater: ORE_EATER_SCALE, bigBird: 1, predator: 0 }, noCarcass);
    pastSeason(w);
    const before = { values: three(w), trends: trends(w), seasons: seasonsAppliedOf(w) };
    expect(before.trends).toEqual({ oreEater: FALLING, bigBird: RISING, predator: RISING });

    // When 저장했다가 되살린다 (파일을 거쳐 간다)
    const again = revive(w);

    // Then 값도 방향도 적용한 철의 수도 그대로 실려 왔다
    expect({ values: three(again), trends: trends(again), seasons: seasonsAppliedOf(again) }).toEqual(
      before,
    );
  }, 60_000);

  it('S-453 (경계 ③) 값이 오르고 내려 제자리면 멈춤이다 — 한 철의 결과만 본다', () => {
    // Given 새가 그 철에 **둘 다** 겪는 세계 — 광식충이 부르고(+1) 포식수가 먹는다(−1)
    const w = standWorld({ oreEater: ORE_EATER_SCALE, bigBird: 1, predator: 1 }, noCarcass);

    // When 한 철이 지난다
    pastSeason(w);

    // Then 새의 값은 제자리이고 방향은 멈춤이다 (중간을 보지 않는다)
    expect({ bigBird: bigBirds(w), trend: trendOf(w, DEEP, BIG_BIRD) }).toEqual({
      bigBird: 1,
      trend: STEADY,
    });
    // And 같은 철에 움직인 둘의 방향은 그대로 갈린다
    expect({ oreEater: trendOf(w, TREE, ORE_EATER) }).toEqual({ oreEater: FALLING });
  }, 60_000);
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-007 — 같은 철의 두 규칙이 정해진 차례로 돈다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-007 같은 철의 두 규칙이 정해진 차례로 돈다', () => {
  it('S-461 (①) 한 철의 자리에서 내림과 관계가 **둘 다** 값을 움직인다', () => {
    // Given 뿌리혹이 그 철 내내 비어 있고(내림) 새가 하나 선(먹음) 세계
    const both = standWorld({ oreEater: ORE_EATER_SCALE, bigBird: 1, predator: 0 }, {
      sourcePhases: { [CARCASS]: DEPLETED, [NODULE]: DEPLETED },
    });
    // And 대조 둘 — 내림만 있는 세계 · 관계만 있는 세계
    const declineOnly = standWorld({ oreEater: ORE_EATER_SCALE, bigBird: 0, predator: 0 }, {
      sourcePhases: { [CARCASS]: DEPLETED, [NODULE]: DEPLETED },
    });
    const linkOnly = standWorld({ oreEater: ORE_EATER_SCALE, bigBird: 1, predator: 0 }, noCarcass);

    // When 같은 철이 셋 다 지난다
    for (const w of [both, declineOnly, linkOnly]) pastSeason(w);

    // Then 대조는 하나씩 줄고, 둘 다인 세계는 **둘 다** 줄었다 —
    // 한 철의 그 자리에서 내림이 먼저 오고 관계가 그 위에 얹힌다
    expect({
      declineOnly: oreEaters(declineOnly),
      linkOnly: oreEaters(linkOnly),
      both: oreEaters(both),
    }).toEqual({
      declineOnly: ORE_EATER_SCALE - 1,
      linkOnly: ORE_EATER_SCALE - 1,
      both: ORE_EATER_SCALE - 2,
    });
  }, 60_000);

  it('S-462 (경계 ②) 둘 다 움직인 철의 방향은 처음과 끝을 견준 **답 하나**다', () => {
    // Given 내림과 먹음이 같은 철에 함께 오는 세계
    const w = standWorld({ oreEater: ORE_EATER_SCALE, bigBird: 1, predator: 0 }, {
      sourcePhases: { [CARCASS]: DEPLETED, [NODULE]: DEPLETED },
    });

    // When 한 철이 지난다
    pastSeason(w);

    // Then 두 번 움직였어도 방향은 하나다 — 처음(4)과 끝(2)을 견준 답이다
    // (중간을 보지 않는다는 것의 뒷면은 S-453 이 잰다 — 올랐다 내려 제자리면 멈춤이다)
    expect({ value: oreEaters(w), trend: trendOf(w, TREE, ORE_EATER) }).toEqual({
      value: ORE_EATER_SCALE - 2,
      trend: FALLING,
    });
  }, 60_000);

  it.todo(
    'GAP: (①) 내림과 관계의 **차례 그 자체**는 이 세계의 데이터로 갈리지 않는다 — ' +
      '차례가 뒤집혔음을 보려면 같은 철에 내림이 있는 개체군의 값을 어떤 관계가 **올려야** ' +
      '하는데, 내림을 밝힌 개체군은 광식충 하나이고 그 값을 올리는 관계는 세계에 없다 ' +
      '(관계 다섯 가운데 광식충을 to 로 삼는 것은 EATS 하나다). ' +
      '차례를 뒤집을 손잡이도 없다 — 세울 수 있는 것은 S-461 의 "둘 다 적용된다" 까지다',
  );
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-008 — 바퀴가 닫힌다
// ─────────────────────────────────────────────────────────────────────

/**
 * 사슬을 **처음부터 끊어 세운 둥지와 거목** — 균사도 뿌리혹도 비었고 거목균도 광식충도 0 이다.
 * 이 자리에서는 포식수가 남기는 사체 말고 그 사슬을 다시 세울 길이 없다:
 * 균사의 되돌아옴은 거목균에 매이고(C024) 뿌리혹은 균사에 매달려 있고(C013 · C014)
 * 탄생은 뿌리혹을 먹는다(C022 · C023). 그래서 바퀴가 닫히는 것을 마디마다 볼 수 있다.
 */
const brokenChain: LifeSetup = {
  sourcePhases: { [CARCASS]: DEPLETED, [FUNGUS]: DEPLETED, [NODULE]: DEPLETED },
  populations: { [TREE_FUNGUS]: 0 },
};

describe('SPEC-008 바퀴가 닫힌다', () => {
  it('S-471 (①) 관찰자가 하나도 없는 채로 사체 → 변성 → 균사 → 뿌리혹 → 탄생이 이어진다', () => {
    // Given 포식수만 하나 선 세계 — 관찰자는 숲 어귀에 있고 사슬은 끊겨 있다
    const w = standWorld({ oreEater: 0, bigBird: 0, predator: 1 }, brokenChain);
    expect({
      carcass: carcassPhase(w),
      fungus: sourceShot(w, NEST, FUNGUS).phase,
      nodule: sourceShot(w, TREE, NODULE).phase,
      treeFungus: treeFungi(w),
      oreEater: oreEaters(w),
    }).toEqual({
      carcass: DEPLETED,
      fungus: DEPLETED,
      nodule: DEPLETED,
      treeFungus: 0,
      oreEater: 0,
    });

    // When 아무도 아무것도 하지 않은 채로 굴린다 — 마디마다 그때의 세계 시각을 적는다
    const at: Record<string, number> = {};
    runUntil(w, () => carcassPhase(w) === AVAILABLE, TURN_LENGTH * 3, '사체가 서는 것');
    at.carcass = worldTime(w);
    runUntil(w, () => treeFungi(w) > 0, TRANSFORM_SECONDS * 3, '변성이 일어나 거목균이 서는 것');
    at.transform = worldTime(w);
    runUntil(
      w,
      () => sourceShot(w, NEST, FUNGUS).phase === AVAILABLE,
      recoverySecondsOf(NEST, FUNGUS) * 4,
      '균사가 돌아오는 것',
    );
    at.fungus = worldTime(w);
    runUntil(
      w,
      () => sourceShot(w, TREE, NODULE).phase === AVAILABLE,
      recoverySecondsOf(TREE, NODULE) * 6,
      '뿌리혹이 차는 것',
    );
    at.nodule = worldTime(w);
    runUntil(w, () => oreEaters(w) > 0, DAY_TOTAL * 6, '다음 탄생이 서는 것');
    at.birth = worldTime(w);

    // Then 다섯 마디가 그 차례로 지나갔다 — 아무도 캐지 않았는데 그렇게 되었다
    expect({
      transform: at.transform! > at.carcass!,
      fungus: at.fungus! > at.transform!,
      nodule: at.nodule! >= at.fungus!,
      birth: at.birth! > at.nodule!,
      oreEater: oreEaters(w) > 0,
    }).toEqual({ transform: true, fungus: true, nodule: true, birth: true, oreEater: true });
  }, 300_000);

  it('S-472 (경계 ②) 한 마디를 끊으면 그 뒤가 서지 않는다', () => {
    // Given 같은 세계에 포식수가 **없다** (사냥이 없으니 사체가 서지 않는다)
    const w = standWorld({ oreEater: 0, bigBird: 0, predator: 0 }, brokenChain);
    // And 견줄 세계 — 포식수가 하나 있다
    const turning = standWorld({ oreEater: 0, bigBird: 0, predator: 1 }, brokenChain);

    // When 바퀴가 도는 세계에서 다음 탄생이 설 때까지 굴리고, 끊긴 세계도 그만큼 굴린다
    const spent = runUntil(turning, () => oreEaters(turning) > 0, DAY_TOTAL * 8, '바퀴가 도는 것');
    wait(w, spent + 5);

    // Then 끊긴 세계에서는 사체도 변성도 균사도 뿌리혹도 탄생도 서지 않았다
    expect({
      carcass: carcassPhase(w),
      treeFungus: treeFungi(w),
      fungus: sourceShot(w, NEST, FUNGUS).phase,
      nodule: sourceShot(w, TREE, NODULE).phase,
      oreEater: oreEaters(w),
    }).toEqual({
      carcass: DEPLETED,
      treeFungus: 0,
      fungus: DEPLETED,
      nodule: DEPLETED,
      oreEater: 0,
    });
  }, 300_000);
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-009 — 아무도 없는 세계를 굴려 볼 수 있다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-009 아무도 없는 세계를 굴려 볼 수 있다', () => {
  it('S-481 (②) 같은 세계를 두 번 굴리면 값 셋의 궤적이 **글자까지** 같다', () => {
    // Given 값 셋이 사는 방 어디에도 관찰자가 없는 세계 둘 (같은 자리에서 시작한다)
    const values: Values = { oreEater: ORE_EATER_SCALE, bigBird: 0, predator: 0 };
    const trace = (w: WorldDriver): string => {
      const rows: unknown[] = [];
      for (let i = 0; i < 60; i++) {
        rows.push({ ...three(w), trends: trends(w), carcass: carcassPhase(w) });
        wait(w, 10);
      }
      return JSON.stringify(rows);
    };
    const first = trace(standWorld(values, noCarcass, LONG_NIGHT));
    const second = trace(standWorld(values, noCarcass, LONG_NIGHT));

    // Then 두 궤적이 글자까지 같다
    expect({ same: first === second }).toEqual({ same: true });
    // And 그 궤적은 한 자리에 멎어 있지 않다 — 굴러서 값이 달라졌다
    expect({ moved: new Set(JSON.parse(first).map((r: unknown) => JSON.stringify(r))).size > 1 }).toEqual(
      { moved: true },
    );
  }, 180_000);

  it('S-482 (① ②) `world:run` 이 값 셋의 궤적을 내고, 같은 인자로 두 번 돌리면 글자까지 같다', () => {
    // Given · When 도구를 **같은 인자로 두 번** 부른다 (그 안을 읽지 않았다)
    const first = callWorldRun();
    const second = callWorldRun();

    // Then 굴러갔고, 그 궤적에 값 셋이 이름으로 실린다
    expect({
      ok: first.status === 0,
      oreEater: first.out.includes(ORE_EATER),
      bigBird: first.out.includes(BIG_BIRD),
      predator: first.out.includes(PREDATOR),
      out: first.out,
    }).toEqual({
      ok: true,
      oreEater: true,
      bigBird: true,
      predator: true,
      out: first.out,
    });
    // And 그 궤적은 한 자리에 멎어 있지 않다 — 방향이 적힌다
    expect({
      moves: first.out.includes(RISING) || first.out.includes(FALLING),
      out: first.out,
    }).toEqual({ moves: true, out: first.out });
    // And 두 번의 답이 **글자까지** 같다 (결정론)
    expect({ same: first.out === second.out, status: second.status }).toEqual({
      same: true,
      status: first.status,
    });
  }, 300_000);

  it.todo(
    'GAP: (경계 ③) 저장소에 한 값도 쓰지 않는다 — 도구가 세계를 저장하는 자리를 건드렸는가는 ' +
      '이 하네스가 볼 수 있는 자리가 아니다 (시나리오 테스트는 세계를 메모리에서만 굴린다). ' +
      '읽기 전용이라는 것은 도구를 두 번 불러도 답이 같다는 S-482 가 간접으로만 받친다',
  );
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-010 — 도구가 관계를 잰다 (㉜ ㉝ ㉛)
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-010 도구가 관계를 잰다', () => {
  it('S-491 (①) ㉜ 가 관계 다섯의 양 끝과 이음을 재어 pass 다', () => {
    const item = itemAt('㉜');
    // Then 판정이 pass 다 — 다섯 다 아는 개체군 · 아는 원천 · 실제로 잇는 이음을 가리킨다
    expect({ status: item.status }).toEqual({ status: 'pass' });
    // And 그 한 줄 답이 관계 **다섯**을 센다 (도구의 산문을 글자로 못 박지 않는다)
    expect({ counts: /(^|\D)5(\D|$)/.test(item.answer), answer: item.answer }).toEqual({
      counts: true,
      answer: item.answer,
    });
    // And 걸린 자리가 하나도 없다 (통과한 검사는 짚을 것이 없다)
    expect({ refs: item.refs }).toEqual({ refs: [] });
  });

  it('S-492 (②) ㉝ 가 관계의 편중을 보고한다 — 판정하지 않는다', () => {
    const item = itemAt('㉝');
    expect({ status: item.status }).toEqual({ status: 'report' });
    // And 이 Cycle 이 세운 관계 다섯이 그 한 줄에 세어진다.
    //
    // C025 CHANGED — spec Observable Result 6 · SPEC-010 ② 는 "관계 없는 개체군 0" 이라
    // 적었으나 **그것은 spec 자신의 데이터와 어긋난다**: C024 가 세운 거목균은 어느 관계의
    // 끝도 아니고(그것을 이 사슬에 매는 것은 관계가 아니라 변성 탄생지와 recoveryLife 다),
    // spec 의 SPEC-001 경계 ④ 는 바로 그 "관계 없는 개체군" 이 있어야 성립한다.
    // 편중을 **보이게 하는 것**이 이 검사의 일이므로(판정하지 않는다) 세계가 옳고 산문이
    // 틀렸다 — 재는 것을 "그 수가 0 이다" 에서 **"관계를 세고 편중을 적는다"** 로 되돌린다.
    expect({
      links: /관계\s*5(\D|$)/.test(item.answer),
      reportsIsolation: /관계\s*없는\s*개체군\s*\d/.test(item.answer),
      answer: item.answer,
    }).toEqual({ links: true, reportsIsolation: true, answer: item.answer });
  });

  it('S-493 (③) ㉛ 의 대상이 셋이고 셋 다 통과한다', () => {
    const item = itemAt('㉛');
    expect({ status: item.status }).toEqual({ status: 'pass' });
    // And 그 한 줄 답이 대상 **셋**을 센다 (C022 는 하나 · C024 는 둘이었다)
    expect({ counts: /(^|\D)3(\D|$)/.test(item.answer), answer: item.answer }).toEqual({
      counts: true,
      answer: item.answer,
    });
    expect({ refs: item.refs }).toEqual({ refs: [] });
    // And 세계 전체가 ok 다 — fail 이 하나도 없다
    expect({ ok: REPORT.ok, fail: REPORT.counts.fail }).toEqual({ ok: true, fail: 0 });
  });
});

// ─────────────────────────────────────────────────────────────────────
// 회귀 — REUSED / AFFECTED 의 기존 행동
// ─────────────────────────────────────────────────────────────────────

describe('회귀', () => {
  it('S-501 (SPEC-003 경계 ④ 의 뒷면) C024 의 변성이 사체를 여전히 먹는다', () => {
    // Given 사체가 서 있고 거목균이 0 인 둥지 (포식수가 없어 새 사체가 끼어들지 않는다)
    const w = standWorld({ oreEater: 0, bigBird: 0, predator: 0 }, {
      sourcePhases: { [CARCASS]: AVAILABLE },
      populations: { [TREE_FUNGUS]: 0 },
    }, TURN, NEST);
    w.tick(1);
    expect({ carcass: carcassPhase(w), fungi: treeFungi(w), site: sitePhase(w, NEST, BLOOM) }).toEqual({
      carcass: AVAILABLE,
      fungi: 0,
      site: BINDING,
    });

    // When 변성의 결속이 다 찬다
    runUntil(w, () => treeFungi(w) > 0, TRANSFORM_SECONDS * 3, '변성이 일어나는 것');

    // Then 거목균이 하나 서고 사체가 고갈된다 — C024 의 그 한 규칙 그대로다
    expect({ fungi: treeFungi(w), carcass: carcassPhase(w) }).toEqual({
      fungi: 1,
      carcass: DEPLETED,
    });
  }, 120_000);

  it('S-502 (C024 회귀) 한 철 내내 요구가 모자라면 값이 1 준다 — 그 내림이 그대로다', () => {
    // Given 뿌리혹이 철의 첫머리부터 비어 있는 세계 (관계는 광식충을 건드리지 않는다)
    const w = standWorld({ oreEater: ORE_EATER_SCALE, bigBird: 0, predator: 0 }, {
      sourcePhases: { [CARCASS]: DEPLETED, [NODULE]: DEPLETED },
    });
    const seasons = seasonsAppliedOf(w);
    // And 대조 — 뿌리혹이 서 있는 세계
    const met = standWorld({ oreEater: ORE_EATER_SCALE, bigBird: 0, predator: 0 }, noCarcass);

    // When 그 철이 끝나고 다음 철이 온다
    pastSeason(w);
    pastSeason(met);

    // Then 모자란 쪽만 하나 줄었고 적용한 철의 수가 꼭 하나 늘었다
    expect({ unmet: oreEaters(w), met: oreEaters(met), seasons: seasonsAppliedOf(w) }).toEqual({
      unmet: ORE_EATER_SCALE - 1,
      met: ORE_EATER_SCALE,
      seasons: seasons + 1,
    });
  }, 60_000);

  it('S-503 (R4 AFFECTED) 자락이 셋이 된다 — 값만큼 서고 값이 오르면 그만큼 는다', () => {
    // Given 값이 선 방마다 관찰자를 하나씩 세운다
    const inTree = standWorld({ oreEater: 3, bigBird: 0, predator: 0 }, noCarcass, TURN, TREE);
    const inDeep = standWorld({ oreEater: 0, bigBird: BIG_BIRD_SCALE, predator: 0 }, noCarcass, TURN, DEEP);
    const inNest = standWorld({ oreEater: 0, bigBird: 0, predator: PREDATOR_SCALE }, noCarcass, TURN, NEST);
    for (const one of [inTree, inDeep, inNest]) one.tick(1);

    // Then 방마다 그 값만큼의 자락이 서 있다 — 세계 위에 숫자는 하나도 뜨지 않는다
    expect({
      tree: swarmAreas(inTree).length,
      deep: swarmAreas(inDeep).length,
      nest: swarmAreas(inNest).length,
    }).toEqual({ tree: 3, deep: BIG_BIRD_SCALE, nest: PREDATOR_SCALE });

    // When 새가 하나뿐인 숲 안쪽에서 한 철이 지난다 (광식충이 부른다)
    const rising = standWorld({ oreEater: ORE_EATER_SCALE, bigBird: 1, predator: 0 }, noCarcass, TURN, DEEP);
    rising.tick(1);
    const before = swarmAreas(rising).length;
    expect({ before }).toEqual({ before: 1 });
    pastSeason(rising);
    // Then 선 자락이 그만큼 늘었다
    expect({ areas: swarmAreas(rising).length, value: bigBirds(rising) }).toEqual({
      areas: before + 1,
      value: 2,
    });
  }, 60_000);

  it('S-504 (관찰 계약 회귀) 값 · 방향 · 관계는 봉투에 한 글자도 실리지 않는다', () => {
    // Given 값 셋이 다 서고 방향이 갈린 세계 (관찰자는 숲 안쪽에 있다)
    const w = standWorld({ oreEater: ORE_EATER_SCALE, bigBird: 1, predator: 1 }, noCarcass, TURN, DEEP);
    pastSeason(w);
    const envelope = w.observe();
    const seen = JSON.stringify(envelope);

    // Then 개체군의 이름이 봉투 어디에도 값으로 실리지 않는다 (부분 문자열은 세지 않는다)
    expect({
      oreEater: carriesExactly(envelope, ORE_EATER),
      bigBird: carriesExactly(envelope, BIG_BIRD),
      predator: carriesExactly(envelope, PREDATOR),
    }).toEqual({ oreEater: false, bigBird: false, predator: false });
    // And 이 Cycle 이 더한 State 의 열쇠와 그 어휘도 봉투에 없다
    expect({
      trend: seen.includes('trend'),
      rising: carriesExactly(envelope, RISING),
      falling: carriesExactly(envelope, FALLING),
      links: seen.includes('links'),
    }).toEqual({ trend: false, rising: false, falling: false, links: false });
  }, 60_000);

  it('S-505 (SPEC-005 ① 의 뒷면) 관계가 지나가지 않는 방은 한 값도 달라지지 않는다', () => {
    // Given 관계 다섯이 다 서는 철 (관찰자가 선 숲 어귀는 그 사슬의 어느 끝도 아니다)
    const w = standWorld({ oreEater: ORE_EATER_SCALE, bigBird: 1, predator: 1 }, noCarcass);
    const away = roomShot(w, AWAY);

    // When 한 철이 지난다
    pastSeason(w);

    // Then 사슬은 돌았고
    expect({ carcass: carcassPhase(w) }).toEqual({ carcass: AVAILABLE });
    // And 숲 어귀는 개체군의 값도 그대로이고 없던 자리에 선 것도 없다
    expect({
      populations: roomShot(w, AWAY).populations,
      stood: newlyStanding(away, roomShot(w, AWAY)),
    }).toEqual({ populations: away.populations, stood: [] });
  }, 60_000);
});
