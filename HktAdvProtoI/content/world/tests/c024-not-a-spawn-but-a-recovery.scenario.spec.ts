// C024 — 스폰이 아니라 회복이다 · 세계 쪽 검증 시나리오 (spec SPEC-001 ~ SPEC-010)
//
// C011 ~ C014 에서 원천이 돌아오는 것은 **시간**이 하는 일이었다. C022 · C023 이 그 위에
// 생명을 세웠고(알집이 서고 터지고 개체군의 값이 올랐다), 이 Cycle 에서 그 둘이 맞물린다 —
// 되돌아옴이 **살아 있는 것의 수**에 매인다. 그래서 여기서 재는 것은 일곱이다:
//   ① 배속 — 값마다의 배속이 세계 시간에 곱해진다. 값이 0 이면 진행이 한 톨도 오르지 않는다
//   ② 사유 — 멎은 원천이 자기 코드를 진다. 표시가 아니라 **멎게 하는 그 판정**이다
//   ③ 내림 — 한 철 내내 요구가 못 차면 철이 바뀌는 순간 값이 1 준다 (0 아래는 없다)
//   ④ 사슬 — 균사를 끊으면 뿌리혹이 멎고, 뿌리혹이 한 철 비면 광식충이 준다. 두면 돌아온다
//   ⑤ 멸종 없음 — 값이 0 이면 결속의 요구가 **다시 차서** 알집이 처음처럼 맺힌다
//   ⑥ 변성 — 사체가 균류로 바뀐다. 규칙은 한 줄도 늘지 않고 대상 집합만 는다
//   ⑦ 도구 — ㉚ 이 탄생 방식 분포와 **없음의 사유**를 보고하고, ㉛ 의 대상이 둘이 된다
//
// 세계는 공개 경로로만 본다 — driveWorld 로 굴리고 dispatch 로 요청하고 observe() 를 읽는다.
// State 를 직접 읽는 자리는 spec 의 State 절이 이름으로 못 박은 넷뿐이다
// (`RegionState.populations[id]` · `RegionState.lifeSites[id]` · `RegionState.sources[id]` ·
// `World.seasonsApplied`) — 개체군의 값도 진행도 적용한 철의 수도 관찰 봉투에 실리지 않기
// 때문이다 (spec Observable "투영하지 않는 것").
//
// 이 Cycle 의 새 구현(content/regions 의 새 데이터 · content/world/semantic 과 simulation 의
// 새 함수 · content/view/** · engine/** 의 이번 변경 · tools/**)은 **읽지 않았다.**
// 기대값의 출처는 cycles/C024-not-a-spawn-but-a-recovery/spec.md 와 이미 있던 하네스·선례
// (c022 · c023 · c021 · c020 · c016 · c013 · persistence)뿐이다. 다만 SPEC-009 · SPEC-010 은
// **도구의 보고**여서 `tools/world-editor/check.ts` 의 `runWorldCheck()` 를 부르는 것이
// 유일한 길이다 — 부르기만 하고 그 안을 읽지 않았다 (c014 · c021 이 세운 그 짝).
//
// **자리도 이름도 손으로 적지 않는다** — 탄생지의 자리는 관찰 결과의 `position` 에서, 원천의
// 자리는 Description 의 resource point 에서, 그 방의 다른 원천들은 세계가 이미 엮어 둔
// `sourcesInRegion` 에서, 되돌아옴의 길이는 그 원천 데이터의 `recoverySeconds` 에서 얻는다.
// 손으로 적는 것은 spec 이 이름으로 못 박은 것(방 · 원천 id · 탄생지 id · 개체군 id · 상한 ·
// 배율 목록 · 결속 120 · 머묾 120 · 되돌아옴 240 · 하루 360)뿐이다.
//
// **이번에 새로 나는 조건 코드의 글자는 손으로 적지 않는다** — spec 의 데이터 표가 이름을
// 말하지만, 그 글자를 베끼면 "세계가 그렇게 적었다" 를 재는 것이 되고 만다. 대신 구조로 잰다:
// "멎은 세계와 도는 세계의 코드 차이가 꼭 하나다" · "그 하나가 C013 · C014 의 코드가 아니다" ·
// "허물과 균사가 서로 다른 글자를 진다" · "값이 오르면 그 글자가 사라진다".
// 반대로 선행 Cycle 이 **이미** 내보내던 코드(`RECOVERY_STALLED` · `CONDITION_UNMET`)는
// content/regions 가 내보내는 상수를 그대로 가져다 쓴다 (c023 이 세운 그 규율).
//
// **전체 개수를 단언하지 않는다** — 이 Cycle 이 더한 것의 존재와 행동만 본다.

import { describe, expect, it } from 'vitest';
import { compileRegion } from '../../../engine/world-authoring/compile';
import type { CompiledWorldTerrain } from '../../../engine/world-authoring/compiled';
import { pointsOf, type RegionDescription, type XZ } from '../../../engine/world-authoring/description';
import { isTraversableAt } from '../../../engine/world-authoring/query';
import type { CheckItem, CheckReport } from '../../../engine/world-authoring/check';
import type { WorldSnapshot } from '../../../engine/world-kernel/persistence';
import {
  COMPILE_RULES,
  CONDITION_UNMET,
  FOREST_EDGE,
  FROST_CANYON,
  ICE_CANYON,
  PREDATOR_NEST,
  RECOVERY_STALLED,
  RED_EYE_TREE,
  REGION_SPECS,
  RESOURCE_LAYER,
  regionSpec,
  type SeasonId,
} from '../../regions';
import type { ActionResult } from '../../protocol/actions';
import type { EntityView, GameViewSnapshot } from '../../protocol/gameview';
import { createWorld, restoreWorld, type World, type WorldSetup } from '../index';
import { INTERACTION_RANGE, TICK_INTERVAL, type WorldState } from '../semantic/world-state';
import { sourcesInRegion, sourceStateOf, traceStrengthAt } from '../semantic/resource';
import { driveWorld, OBSERVER, type WorldDriver } from './drive';
// SPEC-009 · SPEC-010 은 도구의 보고다 — 이 둘만은 검사를 **부르는** 것이 유일한 길이다.
import { runWorldCheck } from '../../../tools/world-editor/check';

// ── spec 이 이름으로 못 박은 것들 (State 의 데이터 값 표) ──────────────

/** 방 셋 — 숲 어귀(허물) · 둥지(균사 · 사체 · 변성지) · 거목(알집 · 뿌리혹 · 광식충) */
const EDGE = FOREST_EDGE;
const NEST = PREDATOR_NEST;
const TREE = RED_EYE_TREE;

/** 값마다의 배속을 밝힌 원천 둘 (spec 데이터 표) */
const MOLT = 'MOLT_LITTER'; // 숲 어귀 — 광식충이 좌우한다
const FUNGUS = 'NEST_FUNGUS'; // 둥지 — 거목균이 좌우한다
/** 이 Cycle 이 더하는 원천 하나 — 둥지의 사체 (spec 데이터 표) */
const CARCASS = 'NEST_CARCASS';
/** 사슬의 가운데 — 균사에 매달려 있다 (C014) */
const NODULE = 'ROOT_NODULE';

/** 개체군 둘과 그 상한 (spec 데이터 표) */
const ORE_EATER = 'ORE_EATER';
const ORE_EATER_SCALE = 4;
const TREE_FUNGUS = 'TREE_FUNGUS';
const TREE_FUNGUS_SCALE = 2;

/** 탄생지 셋 — 결속 · 계승 (C022 · C023) 과 이 Cycle 의 변성 */
const CLUTCH = 'ROOT_CLUTCH';
const EGGS = 'ROOT_EGGS';
const BLOOM = 'CARCASS_TO_FUNGUS';

/** 값마다의 배속 — spec 데이터 표 그대로 (값 0..상한 으로 색인) */
const MOLT_BY_LIFE: readonly number[] = [0, 0.5, 1, 1.5, 2];
const FUNGUS_BY_LIFE: readonly number[] = [0, 1, 2];

/** 변성의 눈금 — 결속 120 · 머묾 120 · 사체의 되돌아옴 240 (spec 데이터 표 · 기본형 ⑤) */
const TRANSFORM_SECONDS = 120;
const TRANSFORM_SPENT_SECONDS = 120;
const CARCASS_RECOVERY_SECONDS = 240;
/** 결속 60 · 계승 90 (C022 · C023 — 회귀로만 쓴다) */
const BINDING_SECONDS = 60;
/** 하루 — 360 세계 초 (C022 spec 데이터) */
const DAY_TOTAL = 360;

/** 철 넷과 그 눈금 (C015 · C016 그대로 — 뒤척임은 60 초로 가장 짧다) */
const STILL: SeasonId = 'STILL';
const TURN: SeasonId = 'TURN';
/** 뒤척임의 길이 — 철 넷 가운데 가장 짧다 (C015 가 세운 눈금: 고요 1080 · 스밈 720 · 긴 밤 360 · 뒤척임 60) */
const TURN_LENGTH = 60;

/** 탄생지의 phase 넷 (C022 · C023 State) */
const DORMANT = 'DORMANT';
const BINDING = 'BINDING';
const BORN = 'BORN';
const SPENT = 'SPENT';

/** 원천의 phase (C012 · C013 그대로) */
const AVAILABLE = 'available';
const DEPLETED = 'depleted';

/** 채취의 소요 시간 — 행동표가 소유한다. "넉넉히 지난다" 로만 쓴다 (C011~C023 어법) */
const MINE_SECONDS = 1.2;

// ── 하네스 (c013 · c016 · c020 · c021 · c022 · c023 의 선례 그대로) ────

/** 검증용 손잡이 — 교집합으로 둔다 (c022 · c023 의 LifeSetup 그대로) */
type LifeSetup = WorldSetup & {
  lifeSitePhases?: Record<string, string>;
  populations?: Record<string, number>;
};

const solo: LifeSetup = { npcs: [] };

const state = (w: WorldDriver) => w.world.snapshot().state as WorldState;
const statesOf = (w: WorldDriver) => state(w).regionStates as Record<string, unknown>;
const worldTime = (w: WorldDriver) => state(w).time;
/** `World.seasonsApplied` — spec State 절이 이름으로 못 박은 자리 (turnsApplied 와 같은 어법) */
const seasonsAppliedOf = (w: WorldDriver): number =>
  (state(w) as unknown as { seasonsApplied: number }).seasonsApplied;

function spaceOf(id: string): RegionDescription {
  const spec = regionSpec(id);
  if (!spec) throw new Error(`세계가 방 '${id}' 를 알지 못한다`);
  return spec.space;
}

const terrainMemo = new Map<string, CompiledWorldTerrain>();
function terrainOf(id: string): CompiledWorldTerrain {
  const hit = terrainMemo.get(id);
  if (hit) return hit;
  const made = compileRegion(spaceOf(id), COMPILE_RULES).world;
  terrainMemo.set(id, made);
  return made;
}

const gridMemo = new Map<string, XZ[]>();
function gridSpots(id: string): XZ[] {
  const hit = gridMemo.get(id);
  if (hit) return hit;
  const t = terrainOf(id);
  const out: XZ[] = [];
  for (let iz = 0; iz < t.rows; iz++) {
    for (let ix = 0; ix < t.cols; ix++) {
      out.push({ x: t.extent.minX + ix * t.resolution, z: t.extent.minZ + iz * t.resolution });
    }
  }
  gridMemo.set(id, out);
  return out;
}
const walkableSpots = (region: string): XZ[] => {
  const t = terrainOf(region);
  return gridSpots(region).filter((p) => isTraversableAt(t, p.x, p.z));
};

const distanceBetween = (a: XZ, b: XZ) => Math.hypot(a.x - b.x, a.z - b.z);
const minBy = <T>(items: readonly T[], score: (item: T) => number): T =>
  items.reduce((best, item) => (score(item) < score(best) ? item : best), items[0]!);
const maxBy = <T>(items: readonly T[], score: (item: T) => number): T =>
  items.reduce((best, item) => (score(item) > score(best) ? item : best), items[0]!);

const pointOf = (region: string, id: string): XZ => {
  const found = pointsOf(spaceOf(region), RESOURCE_LAYER).find((p) => p.tag === id);
  if (!found) throw new Error(`${region} 의 resource layer 에 '${id}' 자리가 없다`);
  return found.position;
};

/** 그 자리에 손이 닿는, 걸어 설 수 있는 자리 하나 (c020 ~ c023 의 besideIn 그대로) */
function besideIn(region: string, at: XZ): XZ {
  const near = walkableSpots(region).filter((p) => distanceBetween(p, at) <= INTERACTION_RANGE * 0.9);
  if (near.length === 0) throw new Error(`(${at.x}, ${at.z}) 곁에 걸어 설 자리가 없다 (${region})`);
  return minBy(near, (p) => distanceBetween(p, at));
}

// ── 세계를 세우고 굴리는 자리 ────────────────────────────────────────

const inRoom = (region: string, at?: XZ, extra: LifeSetup = {}): WorldDriver =>
  driveWorld({
    ...solo,
    actorRegion: region,
    ...(at ? { actorPosition: { x: at.x, z: at.z } } : {}),
    ...extra,
  } as WorldSetup);
const inSeason = (season: SeasonId, region: string, at?: XZ, extra: LifeSetup = {}): WorldDriver =>
  inRoom(region, at, { ...extra, clock: season });

const tickFor = (w: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) w.tick(TICK_INTERVAL);
};
/** 세계 시간을 흘린다 — 한 걸음 1 세계 초로 나눠 굴린다 (c013 ~ c023 의 wait 그대로) */
function wait(w: WorldDriver, seconds: number, step = 1) {
  let left = seconds;
  while (left > 1e-9) {
    const dt = Math.min(step, left);
    w.tick(dt);
    left -= dt;
  }
}

/** 그 조건이 참이 될 때까지 굴린다 (1 세계 초 걸음) — 걸린 세계 초를 돌려준다 */
function runUntil(w: WorldDriver, done: () => boolean, limitSeconds: number, what: string): number {
  for (let s = 0; s < limitSeconds; s++) {
    if (done()) return s;
    w.tick(1);
  }
  if (done()) return limitSeconds;
  throw new Error(`${limitSeconds} 세계 초 안에 일어나지 않았다 — ${what}`);
}

const mine = (w: WorldDriver, targetEntityId: string): ActionResult =>
  w.dispatch({ interactionId: 'mine', targetEntityId });

function mineOnce(w: WorldDriver, id: string): ActionResult {
  const result = mine(w, id);
  tickFor(w, MINE_SECONDS + TICK_INTERVAL);
  return result;
}

// ── 저장·복구 (persistence.spec · c013 ~ c023 의 선례 그대로) ─────────

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

// ── 관찰 결과와 State 를 읽는 자리 (spec Observable · State 의 점 경로) ──

type CodedView = EntityView & { conditions?: string[] };

const sourceEntity = (v: GameViewSnapshot, id: string): CodedView | undefined =>
  v.entities.find((e) => e.role === 'resource-source' && e.id === id) as CodedView | undefined;
const siteEntity = (v: GameViewSnapshot, id: string): CodedView | undefined =>
  v.entities.find((e) => e.role === 'life-site' && e.id === id) as CodedView | undefined;

/** 그 원천에 지금 걸린 조건 코드들 — 하나도 없으면 자리 자체가 없다 (관찰 계약) */
function sourceCodes(w: WorldDriver, id: string): string[] {
  const seen = sourceEntity(w.observe(), id);
  if (!seen) throw new Error(`관찰 결과에 원천 '${id}' 가 실리지 않았다`);
  return seen.conditions ?? [];
}
/** 관찰에 실린 원천마다의 조건 코드 — 어느 원천이 실렸는가까지 함께 잰다 */
function codeMap(w: WorldDriver): Record<string, string[]> {
  const seen = w.observe().entities.filter((e) => e.role === 'resource-source') as CodedView[];
  return Object.fromEntries(seen.map((e) => [e.id, [...(e.conditions ?? [])].sort()]));
}

/** 그 탄생지에 지금 **모자란** 조건 코드들 */
function siteCodes(w: WorldDriver, id: string): string[] {
  const seen = siteEntity(w.observe(), id);
  if (!seen) throw new Error(`관찰 결과에 탄생지 '${id}' 가 실리지 않았다`);
  return seen.conditions ?? [];
}

interface SourceShape {
  phase: string;
  taken: number;
  progress?: number;
}
const sourceAt = (w: WorldDriver, region: string, id: string): SourceShape =>
  sourceStateOf(statesOf(w) as never, region, id) as SourceShape;
/** 원천 하나의 지금 — 견주기 좋게 세 값만 뽑는다 */
const sourceShot = (w: WorldDriver, region: string, id: string) => {
  const held = sourceAt(w, region, id);
  return { id, phase: held.phase, taken: held.taken, progress: held.progress ?? 0 };
};

interface LifeSiteShape {
  phase: string;
  progress: number;
}
/** `RegionState.lifeSites[<id>]` — spec State 절이 이름으로 못 박은 자리 */
function siteState(w: WorldDriver, region: string, id: string): LifeSiteShape {
  const here = statesOf(w)[region] as { lifeSites?: Record<string, LifeSiteShape> } | undefined;
  const found = here?.lifeSites?.[id];
  if (!found) throw new Error(`Region State 에 탄생지가 없다 — regionStates.${region}.lifeSites.${id}`);
  return found;
}
const phaseOf = (w: WorldDriver, region: string, id: string): string => siteState(w, region, id).phase;
const progressOf = (w: WorldDriver, region: string, id: string): number =>
  siteState(w, region, id).progress;

interface PopulationShape {
  value: number;
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
/** 광식충의 값 (거목의 방) · 거목균의 값 (둥지) */
const oreEaters = (w: WorldDriver): number => populationState(w, TREE, ORE_EATER).value;
const treeFungi = (w: WorldDriver): number => populationState(w, NEST, TREE_FUNGUS).value;

/** 지나는 것과 **서 있는 떼**가 같은 자리에 실린다 — 떼만 `area` 를 진다 (관찰 계약) */
type PresenceShape = { presence: string; curve?: string; area?: string };
const herdAreas = (w: WorldDriver): string[] =>
  (w.observe().presences as unknown as PresenceShape[])
    .filter((p) => p.area !== undefined)
    .map((p) => p.area!);

/** 그 봉투 안에 **값이 꼭 그것인** 자리가 있는가 — 부분 문자열은 세지 않는다 (c023 선례) */
function carriesExactly(value: unknown, needle: string): boolean {
  if (typeof value === 'string') return value === needle;
  if (value === null || typeof value !== 'object') return false;
  return Object.values(value as Record<string, unknown>).some((one) => carriesExactly(one, needle));
}

// ── 데이터에서 얻는 것 (손으로 적지 않는다) ──────────────────────────

const sourceIdsIn = (region: string): string[] => sourcesInRegion(region).map((s) => s.id);
const recoverySecondsOf = (region: string, id: string): number => {
  const found = sourcesInRegion(region).find((s) => s.id === id);
  if (!found) throw new Error(`${region} 에 원천 '${id}' 가 없다`);
  return found.recoverySeconds;
};
/** 세계의 원천 전부 — 방마다 세어 온다 */
const allSources = (): { region: string; id: string }[] =>
  REGION_SPECS.flatMap((spec) => sourcesInRegion(spec.id).map((s) => ({ region: spec.id, id: s.id })));
/** 세계의 원천을 남김없이 바닥낸 채로 세운다 (손잡이가 세우는 State 는 캐서 닿는 그것이다) */
const allDepleted = (): Record<string, string> =>
  Object.fromEntries(allSources().map((one) => [one.id, DEPLETED]));

/** 탄생지 하나의 자리 — **관찰 결과에서 얻는다** (손으로 적지 않는다) */
const siteAtMemo = new Map<string, XZ>();
function siteAt(region: string, id: string): XZ {
  const key = `${region}/${id}`;
  const hit = siteAtMemo.get(key);
  if (hit) return hit;
  const found = siteEntity(inRoom(region).observe(), id);
  if (!found) throw new Error(`관찰 결과에 탄생지 '${id}' 가 실리지 않았다 — 자리를 얻을 수 없다`);
  const at = { x: found.position.x, z: found.position.z };
  siteAtMemo.set(key, at);
  return at;
}

/**
 * **멎음 코드를 구조로 얻는다** — 이번에 나는 글자를 손으로 적지 않기 위해서다.
 * 같은 원천을 "멎은 세계" 와 "도는 세계" 로 나란히 세우고, 그 조건 코드의 **차이 하나**를 집는다.
 */
function stallCodeOf(region: string, id: string, stalled: LifeSetup, running: LifeSetup): string {
  const at = besideIn(region, pointOf(region, id));
  const dead = inSeason(STILL, region, at, stalled);
  const alive = inSeason(STILL, region, at, running);
  dead.tick(1);
  alive.tick(1);
  const extra = sourceCodes(dead, id).filter((code) => !sourceCodes(alive, id).includes(code));
  if (extra.length !== 1) {
    throw new Error(
      `'${id}' 의 멎음 코드가 하나로 갈리지 않는다 — 멎은 쪽 ${JSON.stringify(sourceCodes(dead, id))} · 도는 쪽 ${JSON.stringify(sourceCodes(alive, id))}`,
    );
  }
  return extra[0]!;
}

// ── 검사 보고 (SPEC-009 · SPEC-010 — 도구를 부르기만 한다) ────────────

const REPORT: CheckReport = runWorldCheck();
function itemAt(mark: string): CheckItem {
  const found = REPORT.items.find((i) => i.mark === mark);
  if (!found) throw new Error(`보고에 검사 ${mark} 가 없다`);
  return found;
}

// ─────────────────────────────────────────────────────────────────────
// SPEC-001 — 개체군이 되돌아옴의 속도를 좌우한다
// ─────────────────────────────────────────────────────────────────────

/** 허물만 바닥난 숲 어귀 — 거목의 뿌리혹을 함께 비워 **아무것도 태어나지 않게** 둔다 */
const edgeWith = (oreEater: number, extra: LifeSetup = {}): WorldDriver =>
  inSeason(STILL, EDGE, besideIn(EDGE, pointOf(EDGE, MOLT)), {
    populations: { [ORE_EATER]: oreEater },
    sourcePhases: { [MOLT]: DEPLETED, [NODULE]: DEPLETED },
    ...extra,
  });

describe('SPEC-001 개체군이 되돌아옴의 속도를 좌우한다', () => {
  it('S-201 값마다의 배속이 세계 시간에 곱해진다 — 되돌아옴의 길이는 바뀌지 않는다', () => {
    // Given 데이터가 소유한 되돌아옴의 길이 (손으로 적지 않는다)
    const length = recoverySecondsOf(EDGE, MOLT);
    expect({ positive: length > 0 }).toEqual({ positive: true });

    // When 광식충의 값만 다른 세계 셋을 나란히 굴린다
    const elapsed = (value: number): number => {
      const w = edgeWith(value);
      expect({ value, phase: sourceShot(w, EDGE, MOLT).phase }).toEqual({ value, phase: DEPLETED });
      return runUntil(
        w,
        () => sourceShot(w, EDGE, MOLT).phase === AVAILABLE,
        length * 8,
        `값 ${value} 에서 허물이 되돌아오는 것`,
      );
    };

    // Then 걸린 세계 초가 `길이 ÷ 배속[값]` 이다 — 데이터의 길이는 한 값도 바뀌지 않는다
    expect({
      one: elapsed(1),
      two: elapsed(2),
      four: elapsed(ORE_EATER_SCALE),
    }).toEqual({
      one: length / MOLT_BY_LIFE[1]!,
      two: length / MOLT_BY_LIFE[2]!,
      four: length / MOLT_BY_LIFE[ORE_EATER_SCALE]!,
    });
    // And 배속 1 인 값에서는 데이터의 길이 그대로다 (C011 이 세운 그 눈금)
    expect({ atOne: elapsed(2) }).toEqual({ atOne: length });
  }, 120_000);

  it('S-202 (경계 ②) 값이 0 이면 세계 시간을 아무리 흘려도 진행이 한 톨도 오르지 않는다', () => {
    // Given 광식충이 하나도 없는 세계 — 허물은 바닥나 있다
    const w = edgeWith(0);
    const length = recoverySecondsOf(EDGE, MOLT);
    const start = sourceShot(w, EDGE, MOLT);
    expect({ phase: start.phase, progress: start.progress }).toEqual({
      phase: DEPLETED,
      progress: 0,
    });
    // When 되돌아옴의 길이의 여러 곱을 흘린다
    wait(w, length * 6);
    // Then 진행이 한 톨도 오르지 않았다
    expect({ ...sourceShot(w, EDGE, MOLT) }).toEqual({ ...start });
  }, 120_000);

  it('S-203 (경계 ④) 밝히지 않은 원천은 한 값도 달라지지 않는다 — 같은 방의 것들이 증인이다', () => {
    // Given 세계의 원천을 남김없이 바닥낸 두 세계 — 값 0 과 값 2 (배속 1)
    const depleted = allDepleted();
    const dead = inSeason(STILL, EDGE, undefined, {
      populations: { [ORE_EATER]: 0 },
      sourcePhases: depleted,
    });
    const alive = inSeason(STILL, EDGE, undefined, {
      populations: { [ORE_EATER]: 2 },
      sourcePhases: depleted,
    });
    // When 어느 원천도 다 돌아오지 못할 만큼만 굴린다
    const shortest = Math.min(...allSources().map((one) => recoverySecondsOf(one.region, one.id)));
    wait(dead, shortest / 3);
    wait(alive, shortest / 3);

    // Then 허물 말고는 세계의 어느 원천도 한 값이 다르지 않다
    const shotAll = (d: WorldDriver) =>
      allSources().map((one) => ({ region: one.region, ...sourceShot(d, one.region, one.id) }));
    expect(shotAll(dead).filter((one) => one.id !== MOLT)).toEqual(
      shotAll(alive).filter((one) => one.id !== MOLT),
    );
    // And 허물은 갈린다 — 값 0 에서 멎고 값 2 에서 오른다
    expect({
      dead: sourceShot(dead, EDGE, MOLT).progress,
      aliveRises: sourceShot(alive, EDGE, MOLT).progress > 0,
    }).toEqual({ dead: 0, aliveRises: true });
  }, 120_000);

  it.todo(
    'GAP: (경계 ③) 값이 목록보다 크면 목록의 마지막이 답이다 — ' +
      'populations 손잡이가 값을 상한으로 자르고, 배속 목록의 마지막 자리가 곧 그 상한이라 ' +
      '"목록보다 큰 값" 을 세울 길이 하네스에 없다 (데이터를 지어내야 한다)',
  );

  it.todo(
    'GAP: (경계 ⑤) 그 개체군을 세계가 모르면 값이 0 으로 읽혀 멎는다 — ' +
      '끊긴 참조를 가진 원천을 놓으려면 content/regions 에 없는 데이터를 지어내야 한다. ' +
      '이 세계의 데이터가 온전한가는 검사 ㉛ 이 답한다 (SPEC-010)',
  );
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-002 — 멎은 것이 자기 사유를 말한다
// ─────────────────────────────────────────────────────────────────────

const moltStallCode = (): string =>
  stallCodeOf(
    EDGE,
    MOLT,
    { populations: { [ORE_EATER]: 0 }, sourcePhases: { [MOLT]: DEPLETED, [NODULE]: DEPLETED } },
    { populations: { [ORE_EATER]: 2 }, sourcePhases: { [MOLT]: DEPLETED, [NODULE]: DEPLETED } },
  );

describe('SPEC-002 멎은 것이 자기 사유를 말한다', () => {
  it('S-211 배속이 0 이라 멎은 원천이 **자기 코드 하나**를 진다 — 앞선 Cycle 의 코드가 아니다', () => {
    // Given 멎은 세계와 도는 세계 — 그 차이가 코드 하나다 (구조로 집는다)
    const code = moltStallCode();
    // Then 그 코드는 C013 · C014 가 세운 것 가운데 하나가 아니다 (여섯째 말이다)
    expect({ isStalled: code === RECOVERY_STALLED, isUnmet: code === CONDITION_UNMET }).toEqual({
      isStalled: false,
      isUnmet: false,
    });
    // And 값이 0 인 세계에서 그 코드가 실제로 실린다
    const dead = edgeWith(0);
    dead.tick(1);
    expect({ carries: sourceCodes(dead, MOLT).includes(code) }).toEqual({ carries: true });
  }, 60_000);

  it('S-212 값이 오르면 그 코드가 사라지고 진행이 다시 오른다', () => {
    const code = moltStallCode();
    const length = recoverySecondsOf(EDGE, MOLT);
    // Given 값이 0 인 세계 — 코드가 걸리고 진행이 멎어 있다
    const dead = edgeWith(0);
    wait(dead, length / 2);
    expect({
      carries: sourceCodes(dead, MOLT).includes(code),
      progress: sourceShot(dead, EDGE, MOLT).progress,
    }).toEqual({ carries: true, progress: 0 });

    // When 같은 자리를 값 1 로 세운다 (배속이 0 이 아니다)
    const alive = edgeWith(1);
    wait(alive, length / 2);
    // Then 그 코드가 없고 진행이 올랐다
    expect({
      carries: sourceCodes(alive, MOLT).includes(code),
      rises: sourceShot(alive, EDGE, MOLT).progress > 0,
    }).toEqual({ carries: false, rises: true });
  }, 60_000);

  it('S-213 (경계 ③) 거기 서 있는(available) 원천에는 걸리지 않는다', () => {
    const code = moltStallCode();
    // Given 값이 0 이지만 허물이 **거기 서 있는** 세계 (캐지 않았다)
    const w = inSeason(STILL, EDGE, besideIn(EDGE, pointOf(EDGE, MOLT)), {
      populations: { [ORE_EATER]: 0 },
      sourcePhases: { [NODULE]: DEPLETED },
    });
    wait(w, 30);
    expect({ phase: sourceShot(w, EDGE, MOLT).phase }).toEqual({ phase: AVAILABLE });
    // Then 아직 없는 것에만 묻는다 — 서 있는 것에는 한 글자도 걸리지 않는다
    expect({ carries: sourceCodes(w, MOLT).includes(code) }).toEqual({ carries: false });
  }, 60_000);

  it('S-214 (경계 ④) 코드를 밝히지 않은 원천은 멎어도 한 글자도 늘지 않는다', () => {
    const depleted = allDepleted();
    // Given 같은 방을 값 0 과 값 2 로 세운 두 세계 (원천을 남김없이 바닥냈다)
    const dead = inSeason(STILL, EDGE, undefined, {
      populations: { [ORE_EATER]: 0 },
      sourcePhases: depleted,
    });
    const alive = inSeason(STILL, EDGE, undefined, {
      populations: { [ORE_EATER]: 2 },
      sourcePhases: depleted,
    });
    dead.tick(1);
    alive.tick(1);
    // Then 관찰에 실린 원천들 가운데 코드가 달라지는 것은 허물 하나뿐이다
    // (어느 쪽에만 실린 원천이 있어도 여기서 갈린다 — 자리 자체가 는 것도 "느는 글자" 다)
    const differing = [...new Set([...Object.keys(codeMap(dead)), ...Object.keys(codeMap(alive))])]
      .filter(
        (id) => JSON.stringify(codeMap(dead)[id]) !== JSON.stringify(codeMap(alive)[id]),
      )
      .sort();
    expect({ differing }).toEqual({ differing: [MOLT] });
  }, 60_000);
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-003 — 값이 내린다 (한 철 내내 모자랐을 때)
// ─────────────────────────────────────────────────────────────────────

/**
 * **뒤척임에서 잰다** — 철 넷 가운데 뒤척임이 60 세계 초로 가장 짧아, "한 철 내내" 를
 * 사슬이 스스로 풀리기 전에 지날 수 있는 유일한 철이다 (뿌리혹의 되돌아옴은 180 초다).
 *
 * 값을 손으로 못 박지 않고 **세계가 선 뒤의 값**에서 재는 것은, 철 가운데에서 시작한 세계가
 * 지나온 철을 어떻게 셈하는지를 spec 이 말하지 않기 때문이다 (turnsApplied 의 어법대로면
 * 세운 그 tick 에 지난 철이 한꺼번에 적용된다). 여기서 재는 것은 **한 철이 지나면 하나가
 * 준다**이므로 그 앞자리가 얼마든 판정은 같다.
 */
const atTurn = (extra: LifeSetup = {}, region = TREE, at?: XZ): WorldDriver =>
  inSeason(TURN, region, at, { populations: { [ORE_EATER]: ORE_EATER_SCALE }, ...extra });
/** 뒤척임이 끝나고 다음 철로 넘어간 뒤까지 굴린다 (60 초 + 5) */
const pastTurn = (w: WorldDriver) => wait(w, TURN_LENGTH + 5);

describe('SPEC-003 값이 내린다 — 한 철 내내 모자랐을 때', () => {
  it('S-221 (②) 한 번도 다 차지 않은 채로 철이 바뀌면 값이 1 준다', () => {
    // Given 뿌리혹이 그 철이 시작할 때부터 바닥나 있는 세계
    const w = atTurn({ sourcePhases: { [NODULE]: DEPLETED } });
    const before = oreEaters(w);
    const seasonsBefore = seasonsAppliedOf(w);
    expect({ standing: before > 0 }).toEqual({ standing: true });
    expect({ phase: sourceShot(w, TREE, NODULE).phase }).toEqual({ phase: DEPLETED });

    // When 그 철이 끝나고 다음 철이 온다
    pastTurn(w);

    // Then 값이 꼭 하나 줄었고, 적용한 철의 수가 꼭 하나 늘었다
    expect({ value: oreEaters(w), seasons: seasonsAppliedOf(w) }).toEqual({
      value: before - 1,
      seasons: seasonsBefore + 1,
    });
    // And 새 철의 셈은 다시 처음이다 (한 번도 차지 않은 채로 시작한다)
    expect({ met: populationState(w, TREE, ORE_EATER).metThisSeason }).toEqual({ met: false });
  }, 60_000);

  it('S-222 (①) 그 철에 한 번이라도 요구가 찼으면 그 철에는 내리지 않는다', () => {
    // Given 뿌리혹이 **거기 서 있는** 채로 시작하는 세계 (곁에 곡괭이를 들고 선다)
    const at = besideIn(TREE, pointOf(TREE, NODULE));
    const w = atTurn({ sourcePhases: { [FUNGUS]: DEPLETED }, actorItems: { pickaxe: 9 } }, TREE, at);
    const before = oreEaters(w);
    expect({ standing: before > 0, phase: sourceShot(w, TREE, NODULE).phase }).toEqual({
      standing: true,
      phase: AVAILABLE,
    });

    // When 철의 첫머리에 뿌리혹을 캐 비운다 — 그 뒤로는 그 철이 끝날 때까지 비어 있다
    for (let i = 0; i < 9 && sourceShot(w, TREE, NODULE).phase === AVAILABLE; i++) {
      mineOnce(w, NODULE);
    }
    expect({ phase: sourceShot(w, TREE, NODULE).phase }).toEqual({ phase: DEPLETED });
    expect({ met: populationState(w, TREE, ORE_EATER).metThisSeason }).toEqual({ met: true });
    pastTurn(w);

    // Then 값이 그대로다 — 잠깐 먹어 비는 것으로는 줄지 않는다
    expect({ value: oreEaters(w) }).toEqual({ value: before });

    // And 대조 — 그 철이 시작할 때부터 비어 있던 세계는 같은 철에 하나가 준다
    const control = atTurn({ sourcePhases: { [NODULE]: DEPLETED, [FUNGUS]: DEPLETED } });
    const controlBefore = oreEaters(control);
    pastTurn(control);
    expect({ value: oreEaters(control) }).toEqual({ value: controlBefore - 1 });
  }, 60_000);

  it('S-223 (③) 값은 0 아래로 내려가지 않는다', () => {
    // Given 값이 0 이고 요구가 비어 있는 세계
    const w = atTurn({
      populations: { [ORE_EATER]: 0 },
      sourcePhases: { [NODULE]: DEPLETED, [FUNGUS]: DEPLETED },
    });
    expect({ value: oreEaters(w) }).toEqual({ value: 0 });
    // When 철을 둘 지난다
    pastTurn(w);
    wait(w, 30);
    // Then 0 이다 — 음수가 되지 않는다
    expect({ value: oreEaters(w) }).toEqual({ value: 0 });
  }, 60_000);

  it('S-225 (경계 ⑤) 철을 여럿 건너뛴 큰 걸음도 지난 만큼 일어난다', () => {
    // Given 세계의 원천이 남김없이 비어 있는 세계 (한 걸음 안에서 사슬이 풀리지 않는다)
    const w = atTurn({ sourcePhases: allDepleted() });
    const before = oreEaters(w);
    const seasonsBefore = seasonsAppliedOf(w);
    expect({ standing: before >= 3 }).toEqual({ standing: true });

    // When 한 걸음으로 철 셋을 통째로 건너뛴다 (뒤척임 → 고요 → 스밈 → 긴 밤)
    w.tick(TURN_LENGTH + 1080 + 720 + 1);
    // 세계는 그 걸음이 **끝난** 시각을 다음 Tick 에 읽는다 (c016 S-064 가 세운 그 어법)
    w.tick(0);

    // Then 셋이 다 세어졌다 — 하나도 빠지지 않았다
    expect({ value: oreEaters(w), seasons: seasonsAppliedOf(w) }).toEqual({
      value: before - 3,
      seasons: seasonsBefore + 3,
    });
  }, 60_000);

  it('S-226 (경계 ⑥) 껐다 켠 세계가 같은 철을 두 번 세지 않는다', () => {
    // Given 철 하나를 지나 값이 하나 준 세계
    const w = atTurn({ sourcePhases: { [NODULE]: DEPLETED, [FUNGUS]: DEPLETED } });
    const before = oreEaters(w);
    pastTurn(w);
    const value = oreEaters(w);
    const seasons = seasonsAppliedOf(w);
    expect({ value }).toEqual({ value: before - 1 });

    // When 저장했다가 되살린다 (파일을 거쳐 간다)
    const again = revive(w);
    // Then 적용한 철의 수도 값도 그대로 실려 왔다
    expect({ value: oreEaters(again), seasons: seasonsAppliedOf(again) }).toEqual({ value, seasons });
    // And 철이 바뀌지 않는 만큼 더 굴려도 두 번 세지 않는다
    wait(again, 30);
    expect({ value: oreEaters(again), seasons: seasonsAppliedOf(again) }).toEqual({ value, seasons });
  }, 60_000);

  it('S-227 (R3 경계) 관찰자가 그 방에 없어도 돈다', () => {
    // Given 관찰자가 숲 어귀에 있고, 값이 내리는 것은 거목의 방이다
    const w = atTurn({ sourcePhases: { [NODULE]: DEPLETED, [FUNGUS]: DEPLETED } }, EDGE);
    const before = oreEaters(w);
    // When 그 철이 지난다
    pastTurn(w);
    // Then 아무도 보지 않은 방에서 값이 하나 줄었다
    expect({ value: oreEaters(w) }).toEqual({ value: before - 1 });
  }, 60_000);

  it.todo(
    'GAP: (경계 ④) 요구를 밝히지 않은 개체군은 내리지 않는다 — ' +
      '이 세계의 개체군 둘(광식충 · 거목균)이 **둘 다** 요구를 밝힌다 (spec 데이터 표). ' +
      '밝히지 않은 개체군을 세우려면 content/regions 에 없는 데이터를 지어내야 한다',
  );
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-004 — 끊으면 마르고 두면 돌아온다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-004 끊으면 마르고 두면 돌아온다', () => {
  it('S-231 (①) 균사와 뿌리혹을 끊어 두고 한 철을 보내면 광식충의 값이 준다', () => {
    // Given 균사와 뿌리혹이 함께 비어 있는 세계 (캔 자리와 같은 State 다 — C012 의 규율)
    const w = atTurn({ sourcePhases: { [FUNGUS]: DEPLETED, [NODULE]: DEPLETED } });
    const before = oreEaters(w);
    w.tick(1);
    // Then 뿌리혹의 되돌아옴이 균사에 걸려 멎어 있다 (C013 의 매달림 그대로 — 새 코드가 아니다)
    expect({ stalled: sourceCodes(w, NODULE).includes(RECOVERY_STALLED) }).toEqual({ stalled: true });

    // When 그 철이 지난다
    pastTurn(w);
    // Then 떼의 자락이 한 겹 줄어든다 (값이 하나 준다)
    expect({ value: oreEaters(w) }).toEqual({ value: before - 1 });
  }, 60_000);

  it('S-232 (②) 값이 준 뒤 허물의 되돌아옴이 실제로 느려진다', () => {
    const length = recoverySecondsOf(EDGE, MOLT);
    const elapsed = (value: number): number => {
      const w = edgeWith(value);
      return runUntil(
        w,
        () => sourceShot(w, EDGE, MOLT).phase === AVAILABLE,
        length * 8,
        `값 ${value} 에서 허물이 되돌아오는 것`,
      );
    };
    // Given 값이 상한인 세계와, 거기서 하나가 준 세계
    const full = elapsed(ORE_EATER_SCALE);
    const dried = elapsed(ORE_EATER_SCALE - 1);
    // Then 같은 허물이 더 오래 걸린다 — 그 비는 배속의 비 그대로다
    expect({ slower: dried > full }).toEqual({ slower: true });
    expect({ full, dried }).toEqual({
      full: length / MOLT_BY_LIFE[ORE_EATER_SCALE]!,
      dried: length / MOLT_BY_LIFE[ORE_EATER_SCALE - 1]!,
    });
  }, 120_000);

  it('S-233 (③) 캔 것을 그대로 두면 균사가 돌아오고 뿌리혹이 차고 값이 다시 오른다', () => {
    // Given 균사와 뿌리혹이 비어 있고, 거목균이 하나 서 있는 세계 (고요의 첫머리)
    const w = inSeason(STILL, TREE, undefined, {
      populations: { [ORE_EATER]: 1, [TREE_FUNGUS]: 1 },
      sourcePhases: { [FUNGUS]: DEPLETED, [NODULE]: DEPLETED },
    });
    const before = oreEaters(w);
    expect({ before }).toEqual({ before: 1 });

    // When 아무것도 하지 않고 둔다
    const fungusBack = runUntil(
      w,
      () => sourceShot(w, NEST, FUNGUS).phase === AVAILABLE,
      recoverySecondsOf(NEST, FUNGUS) * 4,
      '균사가 돌아오는 것',
    );
    // Then ① 먼저 균사가 돌아오고
    expect({ fungus: sourceShot(w, NEST, FUNGUS).phase }).toEqual({ fungus: AVAILABLE });
    // ② 그 뒤에 뿌리혹이 찬다 (매달림이 풀린 뒤에야 오른다)
    const noduleBack = runUntil(
      w,
      () => sourceShot(w, TREE, NODULE).phase === AVAILABLE,
      recoverySecondsOf(TREE, NODULE) * 4,
      '뿌리혹이 차는 것',
    );
    expect({ order: noduleBack > 0 && fungusBack >= 0 }).toEqual({ order: true });
    // ③ 그리고 값이 다시 오른다 (계승이 잇는다)
    runUntil(w, () => oreEaters(w) > before, 400, '광식충의 값이 다시 오르는 것');
    expect({ rose: oreEaters(w) > before }).toEqual({ rose: true });
  }, 120_000);

  it('S-234 (경계 ④) 캐지 않은 세계에서는 한 철이 지나도 값이 내리지 않는다', () => {
    // Given 아무것도 끊지 않은 세계 (뿌리혹이 그대로 서 있다)
    const w = atTurn();
    const before = oreEaters(w);
    expect({ phase: sourceShot(w, TREE, NODULE).phase }).toEqual({ phase: AVAILABLE });
    // When 그 철이 지난다
    pastTurn(w);
    // Then 값이 그대로다
    expect({ value: oreEaters(w) }).toEqual({ value: before });
  }, 60_000);
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-005 — 멸종은 없다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-005 멸종은 없다', () => {
  it('S-241 (①) 값이 0 이 되면 결속의 요구가 다시 차서 알집이 처음처럼 맺힌다', () => {
    // Given 값이 하나뿐이고 뿌리혹이 비어 있는 세계 (관찰자는 알집 곁에 선다)
    const w = inSeason(TURN, TREE, siteAt(TREE, CLUTCH), {
      populations: { [ORE_EATER]: 1 },
      sourcePhases: { [NODULE]: DEPLETED },
    });
    expect({ phase: phaseOf(w, TREE, CLUTCH) }).toEqual({ phase: DORMANT });

    // When 그 철이 지나 값이 0 이 된다
    pastTurn(w);
    expect({ value: oreEaters(w) }).toEqual({ value: 0 });

    // Then 뿌리혹이 차고 비가 오면 알집이 **다시** 맺히기 시작한다 (규칙은 하나도 늘지 않았다)
    runUntil(
      w,
      () => phaseOf(w, TREE, CLUTCH) === BINDING,
      DAY_TOTAL * 3,
      '값이 0 이 된 뒤 알집이 다시 맺히는 것',
    );
    expect({ phase: phaseOf(w, TREE, CLUTCH) }).toEqual({ phase: BINDING });
    // And 그것은 작은 붉은 점(계승)이 아니라 큰 알집(결속)이다
    expect({ eggs: phaseOf(w, TREE, EGGS) }).toEqual({ eggs: DORMANT });
  }, 180_000);

  it('S-242 (②) 그 결속이 다 차면 값이 1 이 되고, 그 뒤로는 계승이 잇는다', () => {
    const w = inSeason(TURN, TREE, siteAt(TREE, CLUTCH), {
      populations: { [ORE_EATER]: 1 },
      sourcePhases: { [NODULE]: DEPLETED },
    });
    pastTurn(w);
    runUntil(w, () => phaseOf(w, TREE, CLUTCH) === BINDING, DAY_TOTAL * 3, '알집이 다시 맺히는 것');
    expect({ value: oreEaters(w) }).toEqual({ value: 0 });

    // When 결속이 다 찬다
    runUntil(
      w,
      () => phaseOf(w, TREE, CLUTCH) !== BINDING,
      BINDING_SECONDS * 4,
      '결속이 다 차는 것',
    );
    // Then 값이 1 이 된다 — 멸종이 아니라 최초의 자리로 돌아간 것이다
    expect({ value: oreEaters(w), phase: phaseOf(w, TREE, CLUTCH) }).toEqual({
      value: 1,
      phase: BORN,
    });

    // And 그 뒤로는 계승이 잇는다 (알집 없이 뿌리의 알이 선다)
    runUntil(
      w,
      () => phaseOf(w, TREE, EGGS) === BINDING,
      DAY_TOTAL * 3,
      '계승이 이어 서는 것',
    );
    expect({ eggs: phaseOf(w, TREE, EGGS) }).toEqual({ eggs: BINDING });
  }, 180_000);
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-006 — 셋째 탄생 방식: 사체가 균류로 바뀐다
// ─────────────────────────────────────────────────────────────────────

/** 한 걸음마다 찍는 둥지의 지금 — "한 tick 에 함께" 를 견주는 판 (c023 Frame 의 어법) */
interface NestFrame {
  time: number;
  phase: string;
  progress: number;
  fungi: number;
  carcass: { phase: string; taken: number; progress: number };
}
const nestFrame = (w: WorldDriver): NestFrame => ({
  time: worldTime(w),
  phase: phaseOf(w, NEST, BLOOM),
  progress: progressOf(w, NEST, BLOOM),
  fungi: treeFungi(w),
  carcass: (() => {
    const shot = sourceShot(w, NEST, CARCASS);
    return { phase: shot.phase, taken: shot.taken, progress: shot.progress };
  })(),
});

/** 변성이 **BINDING 을 벗어나는 그 tick** 까지 굴린다 (c023 runToLeaveBinding 그대로) */
function runToLeaveBloom(w: WorldDriver, limitSeconds = 600) {
  if (phaseOf(w, NEST, BLOOM) !== BINDING) {
    throw new Error(`변성지가 결속하고 있지 않다 — 지금 ${phaseOf(w, NEST, BLOOM)}`);
  }
  const from = worldTime(w);
  let before = nestFrame(w);
  for (let s = 0; s < limitSeconds; s++) {
    w.tick(1);
    if (phaseOf(w, NEST, BLOOM) !== BINDING) {
      const at = nestFrame(w);
      return { before, at, elapsed: at.time - from };
    }
    before = nestFrame(w);
  }
  throw new Error(`변성이 ${limitSeconds} 세계 초 안에 결속을 벗어나지 않았다`);
}

const atBloom = (extra: LifeSetup = {}): WorldDriver =>
  inSeason(STILL, NEST, siteAt(NEST, BLOOM), extra);

describe('SPEC-006 셋째 탄생 방식 — 사체가 균류로 바뀐다', () => {
  it('S-251 (①) 사체가 있고 전조가 다 차면 변성지가 결속해 밝힌 초에 태어난다', () => {
    // Given 사체가 거기 있고 거목균이 아직 상한이 아닌 세계
    const w = atBloom();
    expect({
      carcass: sourceShot(w, NEST, CARCASS).phase,
      fungi: treeFungi(w),
      phase: phaseOf(w, NEST, BLOOM),
    }).toEqual({ carcass: AVAILABLE, fungi: 0, phase: BINDING });
    // And 모자란 것이 하나도 없다 (지목해도 코드가 걸리지 않는다)
    expect({ codes: siteCodes(w, BLOOM) }).toEqual({ codes: [] });

    // When 결속이 다 찬다
    const { at, elapsed } = runToLeaveBloom(w);
    // Then 밝힌 초(120)에 태어난다
    expect({ elapsed, phase: at.phase }).toEqual({ elapsed: TRANSFORM_SECONDS, phase: BORN });
  }, 60_000);

  it('S-252 (②) 태어나는 그 tick 에 사체가 고갈되고 거목균의 값이 1 오른다 — 같은 한 규칙이다', () => {
    const w = atBloom();
    const { before, at } = runToLeaveBloom(w);
    // Then 그 한 tick 에 셋이 함께 움직인다
    expect({ phase: at.phase, carcass: at.carcass.phase, fungi: at.fungi }).toEqual({
      phase: BORN,
      carcass: DEPLETED,
      fungi: before.fungi + 1,
    });
    // And 그 앞의 tick 에는 아무것도 움직이지 않았다 (반만 일어나지 않는다)
    expect({ phase: before.phase, carcass: before.carcass.phase, fungi: before.fungi }).toEqual({
      phase: BINDING,
      carcass: AVAILABLE,
      fungi: 0,
    });
  }, 60_000);

  it('S-253 (경계 ③) 사체가 available 이 아니면 결속이 오르지 않고 진행이 그 자리에 멎는다', () => {
    // Given 사체가 비어 있는 세계
    const w = atBloom({ sourcePhases: { [CARCASS]: DEPLETED } });
    w.tick(1);
    expect({ phase: phaseOf(w, NEST, BLOOM), progress: progressOf(w, NEST, BLOOM) }).toEqual({
      phase: DORMANT,
      progress: 0,
    });
    // And 지목하면 모자란 것이 코드로 읽힌다
    expect({ some: siteCodes(w, BLOOM).length > 0 }).toEqual({ some: true });

    // When 결속의 길이를 넘고도 남을 만큼 굴린다 — 다만 사체가 돌아오기 전까지만
    wait(w, CARCASS_RECOVERY_SECONDS / 2);
    // Then 진행이 한 톨도 오르지 않았다
    expect({ phase: phaseOf(w, NEST, BLOOM), progress: progressOf(w, NEST, BLOOM) }).toEqual({
      phase: DORMANT,
      progress: 0,
    });
  }, 60_000);

  it('S-254 (경계 ④) 거목균의 값이 상한이면 전이가 **통째로** 일어나지 않는다 — 사체도 그대로다', () => {
    // Given 거목균이 상한인 세계 (사체는 거기 그대로 있다)
    const w = atBloom({ populations: { [TREE_FUNGUS]: TREE_FUNGUS_SCALE } });
    w.tick(1);
    const start = nestFrame(w);
    expect({ fungi: start.fungi, carcass: start.carcass.phase }).toEqual({
      fungi: TREE_FUNGUS_SCALE,
      carcass: AVAILABLE,
    });

    // When 결속의 길이를 두 곱 넘게 굴린다
    wait(w, TRANSFORM_SECONDS * 2);
    // Then 태어나지 않았고, 값도 사체도 한 값이 달라지지 않았다
    const still = nestFrame(w);
    expect({
      born: still.phase === BORN || still.phase === SPENT,
      fungi: still.fungi,
      carcass: still.carcass,
    }).toEqual({ born: false, fungi: TREE_FUNGUS_SCALE, carcass: start.carcass });
  }, 60_000);
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-007 — 변성이 남기는 것
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-007 변성이 남기는 것', () => {
  it('S-261 (①) 태어난 뒤 SPENT 인 동안 그 자리에 자락이 선다', () => {
    // Given 결속하는 세계와, 터진 채 머무는 세계
    const binding = atBloom();
    const spent = atBloom({ lifeSitePhases: { [BLOOM]: 'spent' } });
    binding.tick(1);
    spent.tick(1);
    expect({ binding: phaseOf(binding, NEST, BLOOM), spent: phaseOf(spent, NEST, BLOOM) }).toEqual({
      binding: BINDING,
      spent: SPENT,
    });

    // Then 그 방의 흔적이 SPENT 인 동안에만 달라진 자리가 있다
    const strengthAt = (w: WorldDriver, spot: XZ) => traceStrengthAt(statesOf(w) as never, NEST, spot);
    const sweep = walkableSpots(NEST).filter((_, i) => i % 7 === 0);
    const differs = sweep.filter((spot) => strengthAt(spent, spot) !== strengthAt(binding, spot));
    expect({ stands: differs.length > 0 }).toEqual({ stands: true });
  }, 60_000);

  it('S-262 (경계 ②) 그 밖의 phase 에서는 서지 않는다', () => {
    // Given 같은 자리를 phase 셋으로 세운 세계들
    const dormant = atBloom({ sourcePhases: { [CARCASS]: DEPLETED } });
    const binding = atBloom();
    const spent = atBloom({ lifeSitePhases: { [BLOOM]: 'spent' } });
    for (const one of [dormant, binding, spent]) one.tick(1);
    expect({
      dormant: phaseOf(dormant, NEST, BLOOM),
      binding: phaseOf(binding, NEST, BLOOM),
      spent: phaseOf(spent, NEST, BLOOM),
    }).toEqual({ dormant: DORMANT, binding: BINDING, spent: SPENT });

    const strengthAt = (w: WorldDriver, spot: XZ) => traceStrengthAt(statesOf(w) as never, NEST, spot);
    const sweep = walkableSpots(NEST).filter((_, i) => i % 7 === 0);
    const differs = (a: WorldDriver, b: WorldDriver) =>
      sweep.filter((spot) => strengthAt(a, spot) !== strengthAt(b, spot)).length;
    // Then SPENT 만 갈린다 — 잠든 자리와 결속하는 자리에는 그 자락이 없다
    expect({
      spentVsDormant: differs(spent, dormant) > 0,
      spentVsBinding: differs(spent, binding) > 0,
    }).toEqual({ spentVsDormant: true, spentVsBinding: true });

    // And 자락 밖의 바닥은 셋이 다 같다 — 달라지는 것은 그 자리 둘레뿐이다
    const away = maxBy(walkableSpots(NEST), (p) => distanceBetween(p, siteAt(NEST, BLOOM)));
    expect({ binding: strengthAt(binding, away), spent: strengthAt(spent, away) }).toEqual({
      binding: strengthAt(dormant, away),
      spent: strengthAt(dormant, away),
    });
    // And 머묾은 밝힌 초(120)에 끝난다 — 그 뒤로는 SPENT 가 아니므로 이 자락의 자리도 아니다
    wait(spent, TRANSFORM_SPENT_SECONDS + 5);
    expect({ leftSpent: phaseOf(spent, NEST, BLOOM) !== SPENT }).toEqual({ leftSpent: true });
  }, 60_000);
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-008 — 균사의 되돌아옴이 균류의 값에 매인다
// ─────────────────────────────────────────────────────────────────────

/**
 * 거목균이 **0 인 채로 머무는** 세계 — 사체를 비워 두면 변성이 서지 않아 값이 오르지 않는다
 * (사체는 240 초 뒤에야 돌아온다). 그 창 안에서만 잰다.
 */
const nestWith = (fungi: number, extra: LifeSetup = {}): WorldDriver =>
  inSeason(STILL, NEST, besideIn(NEST, pointOf(NEST, FUNGUS)), {
    populations: { [TREE_FUNGUS]: fungi },
    sourcePhases: { [FUNGUS]: DEPLETED, [CARCASS]: DEPLETED },
    ...extra,
  });

const fungusStallCode = (): string =>
  stallCodeOf(
    NEST,
    FUNGUS,
    {
      populations: { [TREE_FUNGUS]: 0 },
      sourcePhases: { [FUNGUS]: DEPLETED, [CARCASS]: DEPLETED },
    },
    {
      populations: { [TREE_FUNGUS]: 1 },
      sourcePhases: { [FUNGUS]: DEPLETED, [CARCASS]: DEPLETED },
    },
  );

describe('SPEC-008 균사의 되돌아옴이 균류의 값에 매인다', () => {
  it('S-271 (①) 거목균이 0 인 세계에서 캔 균사는 돌아오지 않고 자기 코드를 진다', () => {
    const code = fungusStallCode();
    // Then 그 코드는 허물의 것과도, 앞선 Cycle 의 것과도 다르다 (대상이 둘이고 말이 둘이다)
    expect({
      sameAsMolt: code === moltStallCode(),
      isStalled: code === RECOVERY_STALLED,
      isUnmet: code === CONDITION_UNMET,
    }).toEqual({ sameAsMolt: false, isStalled: false, isUnmet: false });

    // Given 거목균이 하나도 없는 세계
    const w = nestWith(0);
    const start = sourceShot(w, NEST, FUNGUS);
    // When 되돌아옴의 길이만큼 흘린다 (사체가 돌아오기 전까지)
    wait(w, Math.min(recoverySecondsOf(NEST, FUNGUS), CARCASS_RECOVERY_SECONDS - 20));
    // Then 진행이 한 톨도 오르지 않았고 그 코드가 걸려 있다
    expect({ ...sourceShot(w, NEST, FUNGUS), carries: sourceCodes(w, FUNGUS).includes(code) }).toEqual(
      { ...start, carries: true },
    );
  }, 120_000);

  it('S-272 (②) 변성이 한 번 일어나 값이 1 이 되면 균사가 다시 돌아오기 시작한다', () => {
    // Given 균사가 비어 있고 사체는 거기 있는 세계 (거목균은 0 이다)
    const w = inSeason(STILL, NEST, besideIn(NEST, pointOf(NEST, FUNGUS)), {
      populations: { [TREE_FUNGUS]: 0 },
      sourcePhases: { [FUNGUS]: DEPLETED },
    });
    w.tick(1);
    expect({ fungi: treeFungi(w), progress: sourceShot(w, NEST, FUNGUS).progress }).toEqual({
      fungi: 0,
      progress: 0,
    });

    // When 변성이 다 차기 전까지 굴린다
    wait(w, TRANSFORM_SECONDS - 10);
    // Then 아직 값이 0 이고 진행도 0 이다
    expect({ fungi: treeFungi(w), progress: sourceShot(w, NEST, FUNGUS).progress }).toEqual({
      fungi: 0,
      progress: 0,
    });

    // When 변성이 일어난다
    runUntil(w, () => treeFungi(w) > 0, TRANSFORM_SECONDS * 3, '변성이 일어나 거목균이 서는 것');
    expect({ fungi: treeFungi(w) }).toEqual({ fungi: 1 });
    // Then 그 뒤로 균사의 진행이 오르고 마침내 돌아온다
    wait(w, 20);
    expect({ rises: sourceShot(w, NEST, FUNGUS).progress > 0 }).toEqual({ rises: true });
    runUntil(
      w,
      () => sourceShot(w, NEST, FUNGUS).phase === AVAILABLE,
      recoverySecondsOf(NEST, FUNGUS) * 4,
      '균사가 다시 돌아오는 것',
    );
    expect({ phase: sourceShot(w, NEST, FUNGUS).phase }).toEqual({ phase: AVAILABLE });
  }, 120_000);

  it('S-273 (경계 ③) 그 방의 다른 원천들(갓 둘 · 껍질 조각)은 한 값도 달라지지 않는다', () => {
    // Given 둥지의 원천을 남김없이 비운 두 세계 — 거목균 0 과 상한
    const depleted = allDepleted();
    const dead = nestWith(0, { sourcePhases: depleted });
    const alive = nestWith(TREE_FUNGUS_SCALE, { sourcePhases: depleted });
    // When 그 방의 가장 짧은 되돌아옴에도 못 미치는 만큼 굴린다
    const others = sourceIdsIn(NEST).filter((id) => id !== FUNGUS && id !== CARCASS);
    expect({ some: others.length > 0 }).toEqual({ some: true });
    const shortest = Math.min(...others.map((id) => recoverySecondsOf(NEST, id)));
    wait(dead, shortest / 3);
    wait(alive, shortest / 3);

    // Then 갓 둘 · 껍질 조각은 한 값도 다르지 않다
    const shot = (w: WorldDriver) => others.map((id) => sourceShot(w, NEST, id));
    expect(shot(dead)).toEqual(shot(alive));
    // And 균사만 갈린다
    expect({
      dead: sourceShot(dead, NEST, FUNGUS).progress,
      aliveRises: sourceShot(alive, NEST, FUNGUS).progress > 0,
    }).toEqual({ dead: 0, aliveRises: true });
  }, 120_000);
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-009 — 없다는 것이 세계에 적혀 있다 (도구의 보고 ㉚)
// ─────────────────────────────────────────────────────────────────────

/** ㉚ 의 refs 가 어느 방을 짚는가 */
const refsOf = (mark: string) => itemAt(mark).refs;
const wheresOf = (mark: string): string[] => [...new Set(refsOf(mark).map((r) => r.where))];

describe('SPEC-009 없다는 것이 세계에 적혀 있다 (㉚)', () => {
  it('S-281 (①) 협곡의 방들은 탄생지가 0 이다', () => {
    const w = inSeason(STILL, EDGE);
    const sitesIn = (region: string): string[] => {
      const here = statesOf(w)[region] as { lifeSites?: Record<string, unknown> } | undefined;
      return Object.keys(here?.lifeSites ?? {});
    };
    expect({ frost: sitesIn(FROST_CANYON), ice: sitesIn(ICE_CANYON) }).toEqual({
      frost: [],
      ice: [],
    });
    // And 탄생지가 서는 방은 따로 있다 — 거목과 둥지다
    expect({
      tree: sitesIn(TREE).sort(),
      nest: sitesIn(NEST).sort(),
    }).toEqual({ tree: [CLUTCH, EGGS].sort(), nest: [BLOOM] });
  }, 60_000);

  it('S-282 (②) ㉚ 이 방마다의 탄생 방식 분포를 보고하고, 사유를 밝힌 방을 함께 싣는다', () => {
    const refs = refsOf('㉚');
    const wheres = wheresOf('㉚');
    // Then 탄생지가 선 방 둘이 보고에 실린다
    expect({ tree: wheres.includes(TREE), nest: wheres.includes(NEST) }).toEqual({
      tree: true,
      nest: true,
    });
    // And 그 한 줄 답이 방 둘 · 탄생지 셋 · 방식 셋을 센다 (spec Observable Result 7)
    // (도구의 산문을 글자로 못 박지 않는다 — spec 이 말한 **수 셋**만 잰다)
    const answer = itemAt('㉚').answer;
    const counted: [string, RegExp][] = [
      ['방 2', /방[^0-9]*2(\D|$)/],
      ['탄생지 3', /탄생지[^0-9]*3(\D|$)/],
      ['방식 3', /방식[^0-9]*3(\D|$)/],
    ];
    for (const [what, shape] of counted) {
      expect({ what, says: shape.test(answer), answer }).toEqual({ what, says: true, answer });
    }
    // And 탄생지가 0 인 방 하나가 **사유와 함께** 실린다
    const absence = refs.filter((r) => r.where === FROST_CANYON);
    expect({ listed: absence.length > 0 }).toEqual({ listed: true });
    expect({ hasReason: absence.every((r) => r.detail.trim().length > 0) }).toEqual({
      hasReason: true,
    });
  });

  it('S-283 (경계 ③) ㉚ 은 판정하지 않는다 — 사유가 있든 없든 report 다', () => {
    expect({ status: itemAt('㉚').status }).toEqual({ status: 'report' });
    // And 그래서 세계의 검사 전체가 붉어지지 않는다
    expect({ ok: REPORT.ok }).toEqual({ ok: true });
  });
});

// ─────────────────────────────────────────────────────────────────────
// SPEC-010 — ㉛ 의 대상이 둘이고 둘 다 통과한다
// ─────────────────────────────────────────────────────────────────────

describe('SPEC-010 ㉛ 의 대상이 둘이고 둘 다 통과한다', () => {
  it('S-291 (① ②) 살아 있는 것을 전제하는 회복 원인이 둘이고 둘 다 통과한다', () => {
    const item = itemAt('㉛');
    // Then 판정이 pass 다 — 둘 다 개체군을 밝히고 그 개체군을 세우는 탄생지가 세계에 있다
    expect({ status: item.status }).toEqual({ status: 'pass' });
    // And 그 한 줄 답이 대상 **둘**을 센다 (C022 는 하나였다)
    expect({ counts: /(^|\D)2(\D|$)/.test(item.answer), answer: item.answer }).toEqual({
      counts: true,
      answer: item.answer,
    });
    // And 걸린 자리가 하나도 없다 (통과한 검사는 짚을 것이 없다)
    expect({ refs: item.refs }).toEqual({ refs: [] });
  });

  it('S-292 (경계 ③) 밝히지 않은 원천은 여전히 대상이 아니다 — 결손으로 세지 않는다', () => {
    const item = itemAt('㉛');
    // Given 세계의 원천은 둘보다 훨씬 많다
    expect({ many: allSources().length > 2 }).toEqual({ many: true });
    // Then 그래도 검사가 pass 이고 세계 전체가 ok 다 — 밝히지 않은 것을 결손으로 세지 않았다
    expect({ status: item.status, ok: REPORT.ok }).toEqual({ status: 'pass', ok: true });
    // And fail 이 하나도 없다
    expect({ fail: REPORT.counts.fail }).toEqual({ fail: 0 });
  });
});

// ─────────────────────────────────────────────────────────────────────
// 회귀 — REUSED / AFFECTED 의 기존 행동
// ─────────────────────────────────────────────────────────────────────

describe('회귀', () => {
  it('S-301 (SPEC-005 경계 ③) 값이 0 이 아닌 동안에는 결속이 서지 않는다 — C022 · C023 그대로', () => {
    // Given 요구 넷 가운데 셋이 다 찬 고요의 첫 비, 다만 개체군이 하나 서 있다
    const w = inSeason(STILL, TREE, siteAt(TREE, CLUTCH), { populations: { [ORE_EATER]: 1 } });
    w.tick(1);
    expect({ phase: phaseOf(w, TREE, CLUTCH) }).toEqual({ phase: DORMANT });
    // And 지목하면 모자란 것이 코드로 읽힌다
    expect({ some: siteCodes(w, CLUTCH).length > 0 }).toEqual({ some: true });
    // When 결속의 길이를 두 곱 넘게 굴린다
    wait(w, BINDING_SECONDS * 2);
    // Then 진행이 한 톨도 오르지 않았다
    expect({ phase: phaseOf(w, TREE, CLUTCH), progress: progressOf(w, TREE, CLUTCH) }).toEqual({
      phase: DORMANT,
      progress: 0,
    });
  }, 60_000);

  it('S-302 (SPEC-001 경계 ④) 밝히지 않은 원천의 되돌아옴 길이가 데이터 그대로다', () => {
    // Given 광식충도 거목균도 하나도 없는 세계 (배속이 걸릴 자리가 다 0 이다)
    const others = sourceIdsIn(EDGE).filter((id) => id !== MOLT);
    const pick = minBy(others, (id) => recoverySecondsOf(EDGE, id));
    const length = recoverySecondsOf(EDGE, pick);
    const w = inSeason(STILL, EDGE, undefined, {
      populations: { [ORE_EATER]: 0, [TREE_FUNGUS]: 0 },
      sourcePhases: { [pick]: DEPLETED },
    });
    // When 그 데이터의 길이만큼 기다린다
    const elapsed = runUntil(
      w,
      () => sourceShot(w, EDGE, pick).phase === AVAILABLE,
      length * 4,
      `${pick} 가 되돌아오는 것`,
    );
    // Then 데이터의 길이 그대로다 — 값이 0 이어도 한 값 달라지지 않는다
    expect({ id: pick, elapsed }).toEqual({ id: pick, elapsed: length });
  }, 60_000);

  it('S-303 (SPEC-008 경계 ③) 둥지의 갓 · 껍질 조각의 되돌아옴이 데이터 그대로다', () => {
    const others = sourceIdsIn(NEST).filter((id) => id !== FUNGUS && id !== CARCASS);
    const pick = minBy(others, (id) => recoverySecondsOf(NEST, id));
    const length = recoverySecondsOf(NEST, pick);
    const w = inSeason(STILL, NEST, undefined, {
      populations: { [TREE_FUNGUS]: 0 },
      sourcePhases: { [pick]: DEPLETED },
    });
    const elapsed = runUntil(
      w,
      () => sourceShot(w, NEST, pick).phase === AVAILABLE,
      length * 4,
      `${pick} 가 되돌아오는 것`,
    );
    expect({ id: pick, elapsed }).toEqual({ id: pick, elapsed: length });
  }, 60_000);

  it('S-304 (C022 · C023 회귀) 요구 넷이 다 찬 세계에서 결속이 60 초에 태어난다', () => {
    // Given 넷이 다 찬 고요의 첫 비 (개체군이 0 이다)
    const w = inSeason(STILL, TREE, siteAt(TREE, CLUTCH));
    expect({ phase: phaseOf(w, TREE, CLUTCH), value: oreEaters(w) }).toEqual({
      phase: BINDING,
      value: 0,
    });
    // When 결속이 다 찬다
    const elapsed = runUntil(
      w,
      () => phaseOf(w, TREE, CLUTCH) !== BINDING,
      BINDING_SECONDS * 4,
      '결속이 다 차는 것',
    );
    // Then 60 세계 초에 태어나고 값이 1 오른다 (C022 · C023 의 눈금이 그대로다)
    expect({ elapsed, phase: phaseOf(w, TREE, CLUTCH), value: oreEaters(w) }).toEqual({
      elapsed: BINDING_SECONDS,
      phase: BORN,
      value: 1,
    });
  }, 60_000);

  it('S-305 (R6 AFFECTED) 값만큼 떼의 자락이 서고, 값이 내리면 그만큼 줄어든다', () => {
    // Given 값이 다른 두 세계 (관찰자는 거목의 방에 있다)
    const two = inSeason(STILL, TREE, undefined, { populations: { [ORE_EATER]: 2 } });
    const three = inSeason(STILL, TREE, undefined, { populations: { [ORE_EATER]: 3 } });
    two.tick(1);
    three.tick(1);
    expect({ two: herdAreas(two).length, three: herdAreas(three).length }).toEqual({
      two: 2,
      three: 3,
    });

    // When 값이 내리는 세계에서 한 철이 지난다
    const w = atTurn({ sourcePhases: { [NODULE]: DEPLETED, [FUNGUS]: DEPLETED } });
    w.tick(1);
    const before = { value: oreEaters(w), areas: herdAreas(w).length };
    expect({ standing: before.value > 0, matched: before.areas === before.value }).toEqual({
      standing: true,
      matched: true,
    });
    pastTurn(w);
    // Then 선 자락이 그만큼 줄어든다 — 세계 위에 숫자는 하나도 뜨지 않는다
    expect({ value: oreEaters(w), areas: herdAreas(w).length }).toEqual({
      value: before.value - 1,
      areas: before.areas - 1,
    });
  }, 60_000);

  it('S-306 (관찰 계약 회귀) 개체군의 값도 적용한 철의 수도 관찰 봉투에 실리지 않는다', () => {
    // Given 값이 상한이고 철을 하나 지난 세계
    const w = atTurn({ sourcePhases: { [NODULE]: DEPLETED, [FUNGUS]: DEPLETED } });
    pastTurn(w);
    const envelope = w.observe();
    const seen = JSON.stringify(envelope);
    // Then 개체군의 **이름**이 봉투 어디에도 값으로 실리지 않는다
    // (부분 문자열은 세지 않는다 — 재료 이름 ORE_EATER_MOLT 는 C023 이 세운 다른 자리다)
    expect({
      oreEater: carriesExactly(envelope, ORE_EATER),
      treeFungus: carriesExactly(envelope, TREE_FUNGUS),
    }).toEqual({ oreEater: false, treeFungus: false });
    // And 이 Cycle 이 더한 State 둘의 열쇠도 봉투에 없다
    expect({
      seasonsApplied: seen.includes('seasonsApplied'),
      metThisSeason: seen.includes('metThisSeason'),
    }).toEqual({ seasonsApplied: false, metThisSeason: false });
  }, 60_000);

  it('S-307 (C011 · C022 회귀) 숲 어귀의 허물은 여전히 세 번 캘 수 있다', () => {
    // Given 광식충이 상한인 세계 (배속 2 — 되돌아옴만 빨라진다)
    const at = besideIn(EDGE, pointOf(EDGE, MOLT));
    const w = inSeason(STILL, EDGE, at, {
      populations: { [ORE_EATER]: ORE_EATER_SCALE },
      actorItems: { pickaxe: 9 },
      sourcePhases: { [NODULE]: DEPLETED },
    });
    for (let i = 0; i < 3; i++) {
      expect({ nth: i + 1, ...mineOnce(w, MOLT) }).toEqual({
        nth: i + 1,
        status: 'success',
        rule: 'RULE-MINE-001',
      });
    }
    expect({ phase: sourceShot(w, EDGE, MOLT).phase }).toEqual({ phase: DEPLETED });
    // And 되돌아옴은 배속 2 만큼 빨라질 뿐, 캘 수 있는 횟수는 데이터 그대로다
    runUntil(
      w,
      () => sourceShot(w, EDGE, MOLT).phase === AVAILABLE,
      recoverySecondsOf(EDGE, MOLT) * 4,
      '허물이 되돌아오는 것',
    );
    expect({ taken: sourceShot(w, EDGE, MOLT).taken }).toEqual({ taken: 0 });
  }, 60_000);
});
