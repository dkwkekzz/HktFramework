// C039 — 몸이 세계에 선다 · 세계 쪽 검증 시나리오 (spec 규칙 1 ~ 규칙 10 · 마흔 쌍)
//
// C038 까지 몸의 값은 **닫힌 필드**였다 — 최대 HP 도 최대 CP 도 인지 범위도 태어날 때 박힌
// 숫자였고, 세계는 몸에게 아무것도 묻지 않았다. 이 Cycle 이 그 셋을 **물음의 답**으로 옮기고
// (몸의 종류 · 때 · 자락 세 Source 의 합), 조건이 처음으로 **행위자를 가리키며**, 빙결 심층의
// 문이 문 앞의 몸에게 「체열이 숨겨지는가」를 묻는다. 그래서 여기서 재는 것은 열이다.
//   ① 형    — 저장되는 몸 상태에 자리 · 향함 · 속도 · HP · CP · 이동 방식 · 지금 행동 · Core 가
//             있고 **최대 HP · 최대 CP · 인지 범위는 없다** (규칙 1)
//   ② 물음  — 성질의 답이 Source 들의 몫(상한 · 더함 · 참거짓)의 합이고, 답할 Source 가 없으면
//             「없음」이지 「0」이 아니다 (규칙 2)
//   ③ 현재값 — HP · CP 를 바꾸는 규칙은 한 줄도 옮기지 않았고, 현재값은 성질에 잘린다 (규칙 3)
//   ④ 인지  — 세 상한 가운데 작은 것이 답이고, 그 값들이 지금 코드의 값 그대로다 (규칙 4)
//   ⑤ 조건  — 「행위자」 갈래가 성질 · 있음 · 상태를 실제 몸에서 읽고, 없는 몸은 여전히 판정
//             불가이며, 앎은 아직 판정 불가다 (규칙 5)
//   ⑥ 문    — 성질 요구가 몸에게 물어 판정된다 · 답이 들어올 자리가 실재한다 (규칙 6)
//   ⑦ Core  — 몸의 지속 상태로 서고 아무것도 열지 않는다 (규칙 7)
//   ⑧ 손잡이 — 표의 값 · 때의 상한 · 문이 묻는 이름 · Core 의 이름이 **데이터**다 (규칙 8)
//   ⑨ 명사 0 — 기반 코드에 토끼도 떠도는 자도 체열도 HP 라는 글자도 없다 (규칙 9)
//   ⑩ 회귀  — 앞의 세계가 그대로다. 달라지는 것은 긴 밤의 빙결 심층 문 **하나뿐**이다 (규칙 10)
//
// 세계는 공개 경로로만 본다 — driveWorld 로 굴리고 dispatch 로 요청하고 observe() 와
// world.snapshot().state 를 읽는다. 이 Cycle 의 새 구현(engine/world-authoring/property.ts ·
// content/world/semantic/body-property.ts · actor.ts · region.ts · condition.ts 의 본문)은
// **읽지 않았다.** 기대값의 출처는 cycles/C039-a-body-stands-in-the-world/spec.md 와 그 두
// 파일이 **선언한 계약**(형 · 함수 이름), 그리고 이미 있던 데이터(character-catalog ·
// content/regions)뿐이다.
//
// **이름도 자리도 손으로 적지 않는다** — 문은 LOCKS 에서, 자락은 그 방의 area op 에서, 성질
// 태그는 content/regions/properties.ts 의 propertyTag 에서, 몸의 종류 값은 CHARACTER_CATALOG
// 에서 읽는다. 손으로 적는 이름은 spec 이 못 박은 것(FROST_DEPTH_DOOR · FROST_CANYON ·
// 'hazard-blizzard' · 'LONG_NIGHT' · 성질 이름 셋 · 상태 다섯 가운데 세계가 오래 써 온 hp · cp ·
// moveMode)과 spec 이 수로 못 박은 값(200 · 100 · 30 · 9 · 20 · 10 · 250 · 150 · 5 · 50)뿐이다.
//
// **전체 개수를 단언하지 않는다** — 이 Cycle 이 더한 것의 존재와 행동만 잰다. 회귀의 자리에서만
// spec 이 "한 값도 다르지 않다" 로 못 박은 표(방 열셋의 hash · 문의 열림표 · 검사의 답)를 견준다.
//
// **여기서 재지 않는 것** — 관찰이 무대 몸의 인지 범위를 읽는 것 · 앎 · 행동 입구(C040) ·
// 원정 · 교체(C041) · 장착 슬롯 · Bag(C042) · 사람이 읽을 문구(View 의 표가 짓는다).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  propertySourcesOf,
  resolveProperty,
  type PropertyAnswer,
  type PropertySource,
} from '../../../engine/world-authoring/property';
import type {
  Condition,
  ConditionLeaf,
  ConditionOperator,
  ConditionQueryKind,
  ConditionValue,
  ConditionVerdict,
} from '../../../engine/world-authoring/condition';
import {
  CONDITION_ITEM,
  checkRegions,
  type CheckConditionSite,
  type CheckRegionsInput,
} from '../../../engine/world-authoring/check';
import { compileRegion } from '../../../engine/world-authoring/compile';
import type { CompiledWorldTerrain } from '../../../engine/world-authoring/compiled';
import {
  descriptionHash,
  type RegionDescription,
  type XZ,
} from '../../../engine/world-authoring/description';
import { areaCoversPoint, isTraversableAt } from '../../../engine/world-authoring/query';
import type { WorldSnapshot } from '../../../engine/world-kernel/persistence';
import {
  COMPILE_RULES,
  FROST_CANYON,
  REGION_GRAPH,
  REGION_SPECS,
  lockOfConnector,
  regionSpec,
  type Lock,
} from '../../regions';
import { ASPECT_HEAT, RELATION_HIDES, propertyTag } from '../../regions/properties';
import type { EntityView, GameViewSnapshot } from '../../protocol/gameview';
import { createWorld, restoreWorld, type World, type WorldSetup } from '../index';
import type { ActorState } from '../semantic/actor';
import {
  BODY_PROPERTY_NAMES,
  BODY_PROPERTY_TABLES,
  PROPERTY_AWARENESS,
  PROPERTY_MAX_CP,
  PROPERTY_MAX_HP,
  TIME_AWARENESS_CAPS,
  bodyAwareness,
  bodyMaxCp,
  bodyMaxHp,
  bodyProperty,
  bodyPropertySources,
  type BodyPropertyTables,
} from '../semantic/body-property';
import { CHARACTER_CATALOG } from '../semantic/character-catalog';
import { SWING_BEGIN } from '../semantic/collision';
import { RUN_CP_DRAIN, SKILL_DEFINITIONS } from '../semantic/combat';
import { worldConditionVerdict, worldConditionVocabulary } from '../semantic/condition';
import {
  connectorClosedReason,
  connectorReasonCodes,
  isConnectorOpen,
} from '../semantic/region';
import { OBSERVE_RANGE_NIGHT, TICK_INTERVAL, type WorldState } from '../semantic/world-state';
import { worldCheckInput } from '../../../tools/world-editor/check';
import { driveWorld, OBSERVER, PLAYER, type WorldDriver } from './drive';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

// ── spec 이 못 박은 것 (여기 말고는 손으로 적지 않는다) ────────────────

/** 성질 요구를 밝힌 첫 문과 그 문이 선 방 (spec 규칙 6 · 재료 Access §14.1) */
const FROST_DEPTH_DOOR = 'FROST_DEPTH_DOOR';
/** 그 문 앞의 자락 — 관찰 범위를 낮 20 · 밤 10 으로 거는 그 자락 (C019 확정 6) */
const BLIZZARD = 'hazard-blizzard';
/** 그 문이 열릴 수 있는 철 (spec 규칙 6 ① — WorldSetup.clock 손잡이가 받는 글자) */
const LONG_NIGHT = 'LONG_NIGHT';
/** 그 철이 아닌 때 하나 (규칙 6 ③) */
const STILL = 'STILL';
/** 밤으로 여는 때 · 낮으로 여는 때 (c018 · c019 의 어법 그대로) */
const NIGHT_CLOCK = 'STILL:NIGHT';
const DAY_CLOCK = 'STILL';

/** 몸의 종류 둘 — 값의 출처는 CHARACTER_CATALOG 이고 이름만 여기 있다 (spec 규칙 4 ②) */
const RABBIT = 'rabbit-swordsman';
const WANDERER = 'wanderer';

/** spec 이 수로 못 박은 값들 */
const RABBIT_MAX_HP = 200;
const RABBIT_MAX_CP = 100;
const RABBIT_START_CP = 30;
const WANDERER_AWARENESS = 9;
const NIGHT_AWARENESS_CAP = 20;
const BLIZZARD_NIGHT_CAP = 10;
const BLIZZARD_DAY_CAP = 20;

/** 세계가 오래 써 온 상태 이름들 — 조건의 상태 물음이 가리키는 자리 (규칙 5 ②) */
const STATE_HP = 'hp';
const STATE_CP = 'cp';
const STATE_MOVE_MODE = 'moveMode';

/** 변형 데이터가 더하는 성질 이름 — 이 Cycle 의 세계에는 없는 이름이다 (규칙 9 ②) */
const PROPERTY_WEIGHT = 'weight';
/** 어느 Source 도 답하지 않는 이름 (규칙 2 ③) */
const NO_SUCH_PROPERTY = 'c039-no-such-property';

const solo: WorldSetup = { npcs: [] };

// ── 세계를 세우고 읽는 자리 (c031 · c035 의 어법 그대로) ──────────────

const state = (w: WorldDriver): WorldState => w.world.snapshot().state as WorldState;
const bodyOf = (s: WorldState, id = PLAYER): ActorState => {
  const found = s.actors.find((a) => a.id === id);
  if (!found) throw new Error(`세계에 몸 '${id}' 가 없다`);
  return found;
};
const hud = (v: GameViewSnapshot, id: string): unknown => v.hud.find((h) => h.id === id)?.value;
const entityOf = (v: GameViewSnapshot, id: string): EntityView | undefined =>
  v.entities.find((e) => e.id === id);
const exitOf = (v: GameViewSnapshot, id: string): (EntityView & { conditions?: string[] }) | undefined =>
  v.entities.find((e) => e.id === id && e.role === 'region-exit') as
    | (EntityView & { conditions?: string[] })
    | undefined;

const standingIn = (region: string, at?: XZ, extra: WorldSetup = {}): WorldDriver =>
  driveWorld({
    ...solo,
    ...extra,
    actorRegion: region,
    ...(at ? { actorPosition: { x: at.x, z: at.z } } : {}),
  });

const tickFor = (w: WorldDriver, seconds: number): void => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) w.tick(TICK_INTERVAL);
};

// ── 저장 · 복구 (c031 · persistence.spec 의 선례 그대로) ───────────────

const throughFile = (snapshot: WorldSnapshot): WorldSnapshot =>
  JSON.parse(JSON.stringify(snapshot)) as WorldSnapshot;

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

function revive(base: WorldDriver): WorldDriver {
  const restored = restoreWorld(throughFile(base.world.snapshot()));
  if (!restored) throw new Error('되살릴 수 없는 스냅샷이다');
  const world = createWorld({}, restored);
  world.join(OBSERVER);
  world.tick(0);
  return wrap(world);
}

/** 스냅샷의 몸 상태를 값으로 고쳐 되살린다 (c031 의 worldFrom 그대로 — 코드 diff 0) */
function worldFrom(base: WorldDriver, edit: (s: WorldState) => void): WorldDriver {
  const restored = restoreWorld(throughFile(base.world.snapshot()));
  if (!restored) throw new Error('되살릴 수 없는 스냅샷이다');
  edit(restored);
  const world = createWorld({}, restored);
  world.join(OBSERVER);
  world.tick(0);
  return wrap(world);
}

// ── 땅을 읽는 자리 (c029 ~ c031 의 helper 그대로) ─────────────────────

function spaceOf(id: string): RegionDescription {
  const spec = regionSpec(id);
  if (!spec) throw new Error(`방 '${id}' 가 없다`);
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
function gridSpots(id: string): XZ[] {
  const t = terrainOf(id);
  const out: XZ[] = [];
  for (let iz = 0; iz < t.rows; iz++) {
    for (let ix = 0; ix < t.cols; ix++) {
      out.push({ x: t.extent.minX + ix * t.resolution, z: t.extent.minZ + iz * t.resolution });
    }
  }
  return out;
}
const walkableSpots = (region: string): XZ[] => {
  const t = terrainOf(region);
  return gridSpots(region).filter((p) => isTraversableAt(t, p.x, p.z));
};
function areaShapeOf(region: string, areaId: string) {
  const op = spaceOf(region).ops.find((o) => o.id === areaId);
  if (!op || op.kind !== 'area') throw new Error(`데이터에 area op '${areaId}' 가 없다 (${region})`);
  return op.shape;
}
const coveredBy = (region: string, areaId: string, at: XZ): boolean =>
  areaCoversPoint(areaShapeOf(region, areaId), at.x, at.z);
const spotsInAreaOp = (region: string, areaId: string): XZ[] =>
  walkableSpots(region).filter((p) => coveredBy(region, areaId, p));
const distanceBetween = (a: XZ, b: XZ): number => Math.hypot(a.x - b.x, a.z - b.z);
const minBy = <T,>(items: readonly T[], score: (item: T) => number): T =>
  items.reduce((best, item) => (score(item) < score(best) ? item : best), items[0]!);

/** 눈보라 자락 안의 자리 하나 · 그 자락 밖의 자리 하나 (데이터에서 고른다) */
const blizzardSpot = (): XZ => {
  const spots = spotsInAreaOp(FROST_CANYON, BLIZZARD);
  if (spots.length === 0) throw new Error('눈보라 자락 안에 걸어 설 자리가 없다');
  return spots[0]!;
};
const outsideBlizzardSpot = (): XZ => {
  const from = blizzardSpot();
  const outside = walkableSpots(FROST_CANYON).filter((p) => !coveredBy(FROST_CANYON, BLIZZARD, p));
  if (outside.length === 0) throw new Error('눈보라 자락 밖에 걸어 설 자리가 없다');
  return minBy(outside, (p) => distanceBetween(p, from));
};
/** 자락 안에서 서로 대여섯 걸음 떨어진 두 자리 — 인지 범위 9 안이다 */
function blizzardPair(): { here: XZ; there: XZ } {
  const spots = spotsInAreaOp(FROST_CANYON, BLIZZARD);
  const here = spots[0]!;
  const there = minBy(
    spots.filter((p) => distanceBetween(p, here) > 0),
    (p) => Math.abs(distanceBetween(p, here) - 6),
  );
  return { here, there };
}

/** 그 문이 이 방에서 서는 자리 (c020 · c029 의 connectorSpot 그대로) */
function connectorSpot(connectorId: string, region: string): XZ {
  const c = REGION_GRAPH.connectors.find((x) => x.id === connectorId);
  if (!c) throw new Error(`graph 에 이음 '${connectorId}' 가 없다`);
  const anchorTag = c.from.region === region ? c.from.anchor : c.to.anchor;
  const spec = spaceOf(region);
  const found = spec.ops.find((op) => op.kind === 'point' && op.tag === anchorTag);
  if (!found || found.kind !== 'point') throw new Error(`${region} 에 anchor '${anchorTag}' 가 없다`);
  return { x: found.position.x, z: found.position.z };
}

/** 빙결 심층 문의 Lock — 성질 요구도 사유 코드도 이 데이터에서 읽는다 (이름을 손으로 적지 않는다) */
function frostDoorLock(): Lock {
  const lock = lockOfConnector(FROST_DEPTH_DOOR);
  if (!lock) throw new Error(`${FROST_DEPTH_DOOR} 에 Lock 이 없다`);
  return lock;
}
/** 그 Lock 이 밝힌 성질 요구의 이름들 (데이터가 짓는다) */
const doorPropertyNames = (): string[] =>
  frostDoorLock()
    .requires.map((r) => (r as { property?: string }).property)
    .filter((name): name is string => typeof name === 'string');

// ── 몸을 성질로 읽는 얼굴 (계약의 조각을 그대로 잇는다) ────────────────

/** 문이 묻는 자리에 서는 몸 — connectorClosedReason 의 body 인자 */
const askable = (s: WorldState, actor: ActorState, tables?: BodyPropertyTables) => ({
  property: (name: string): PropertyAnswer | undefined => bodyProperty(s, actor, name, tables),
});
/** 무엇을 물었는지 적어 두는 몸 — 문이 **무엇을** 묻는가를 재는 자리 (규칙 6 ④ · 규칙 8 ③) */
function probeBody(answer: (name: string) => PropertyAnswer | undefined = () => undefined) {
  const asked: string[] = [];
  return {
    asked,
    body: {
      property: (name: string): PropertyAnswer | undefined => {
        asked.push(name);
        return answer(name);
      },
    },
  };
}

/** 「체열이 숨겨진다 참」 Source 하나 — 답이 들어올 자리 (Access §15 Actor: 체열 억제) */
const heatHiddenSource = (): PropertySource => ({
  origin: 'c039:variant-heat-hidden',
  property: propertyTag(ASPECT_HEAT, RELATION_HIDES),
  share: { kind: 'flag', value: true },
});

// ── 변형 데이터를 짓는 자리 (코드 diff 0 — 변형은 언제나 값이다) ───────
//
// c004 의 VARIANT_ROOM 과 같은 어법이다: 지금 데이터에서 **값**으로 다른 표를 지어 세계와
// 물음에 그대로 먹인다. 표의 **모양**을 손으로 적지 않는다 — 지금 값을 깊이 복사하면서
// 수 하나만 갈아 끼우므로, 표가 어떤 꼴이든 같은 변형이 된다.

function deepReplaceNumber<T>(value: T, from: number, to: number): T {
  if (typeof value === 'number') return (value === from ? to : value) as unknown as T;
  if (Array.isArray(value)) return value.map((item) => deepReplaceNumber(item, from, to)) as unknown as T;
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = deepReplaceNumber(child, from, to);
    }
    return out as unknown as T;
  }
  return value;
}

/** 몸의 종류 표에서 수 하나를 갈아 끼운 변형 표 */
const kindsVariant = (from: number, to: number): BodyPropertyTables => ({
  ...BODY_PROPERTY_TABLES,
  kinds: deepReplaceNumber(BODY_PROPERTY_TABLES.kinds, from, to),
});
/** 때가 거는 상한 표에서 상한 하나를 갈아 끼운 변형 표 */
const timeCapVariant = (from: number, to: number): BodyPropertyTables => ({
  ...BODY_PROPERTY_TABLES,
  timeAwarenessCaps: TIME_AWARENESS_CAPS.map((row) =>
    row.cap === from ? { ...row, cap: to } : row,
  ),
});

// ── 조건의 잎을 짓는 자리 (형은 기반의 것이고 글자는 어휘의 것이다) ────

const actorLeaf = (
  ref: string | undefined,
  query: { kind: ConditionQueryKind; path?: string },
  operator: ConditionOperator,
  value?: ConditionValue,
): ConditionLeaf => ({
  target: { kind: 'actor', ...(ref === undefined ? {} : { ref }) },
  query,
  operator,
  ...(value === undefined ? {} : { value }),
});

const verdict = (s: WorldState, condition: Condition): ConditionVerdict =>
  worldConditionVerdict(s, condition);

// ── 검사를 부르는 자리 (c035 · c038 의 어법 그대로) ───────────────────

function withSite(site: CheckConditionSite): CheckRegionsInput {
  const input = worldCheckInput();
  if (!input.condition) throw new Error('worldCheckInput 이 조건 쪽 계약을 주지 않는다');
  return { ...input, condition: { ...input.condition, sites: [...input.condition.sites, site] } };
}
/** 어휘까지 값으로 갈아 끼운 검사 입력 (규칙 9 ② — 성질 이름 하나를 더한다) */
function withVocabularyPath(input: CheckRegionsInput, path: string): CheckRegionsInput {
  if (!input.condition) throw new Error('조건 쪽 계약이 없다');
  const vocabulary = input.condition.vocabulary;
  return {
    ...input,
    condition: {
      ...input.condition,
      vocabulary: {
        ...vocabulary,
        queries: vocabulary.queries.map((rule) =>
          rule.target === 'actor' && rule.query === 'property' && rule.paths
            ? { ...rule, paths: [...rule.paths, path] }
            : rule,
        ),
      },
    },
  };
}
function conditionItemOf(input: CheckRegionsInput) {
  const item = checkRegions(input).items.find((it) => it.id === CONDITION_ITEM.id);
  if (!item) throw new Error('보고에 ㊹ 이 없다');
  return item;
}
const actorPaths = (query: ConditionQueryKind): readonly string[] | undefined =>
  worldConditionVocabulary().queries.find((rule) => rule.target === 'actor' && rule.query === query)
    ?.paths;

// ─────────────────────────────────────────────────────────────────────
describe('규칙 1 (형 · ADDED) — 몸의 저장되는 것과 유도되는 것이 갈린다', () => {
  it('① 세계가 처음 선다 → 저장되는 몸 상태가 자리 · 향함 · 속도 · HP · CP · 이동 방식 · 지금 행동 · Core 여덟이 된다', () => {
    // Given 세계가 처음 서고 관찰자 하나가 들어왔다
    const body = bodyOf(state(driveWorld(solo)));
    // Then 저장되는 몸 상태에 그 여덟 자리가 있다
    for (const field of ['position', 'facing', 'velocity', 'hp', 'cp', 'moveMode', 'currentAction', 'core']) {
      expect({ field, stored: field in body }).toEqual({ field, stored: true });
    }
  });

  it('② 세계가 처음 선다 → 변형 없음: 저장되는 것 가운데 최대 HP · 최대 CP · 인지 범위가 없다 (묻는 것이다)', () => {
    const body = bodyOf(state(driveWorld(solo)));
    // Then 최대값도 인지 범위도 저장되지 않는다 — 어느 철자로도 없다
    for (const field of ['hpMax', 'cpMax', 'perceptionRange', PROPERTY_MAX_HP, PROPERTY_MAX_CP, PROPERTY_AWARENESS]) {
      expect({ field, stored: field in body }).toEqual({ field, stored: false });
    }
    // 그래도 물으면 답이 있다 — 없어진 것이 아니라 자리를 옮겼다
    const s = state(driveWorld(solo));
    expect(bodyMaxHp(s, bodyOf(s))).toBe(RABBIT_MAX_HP);
  });

  it('③ 세계가 처음 선다 → 변형 없음: 서는 자리 · 향함 · HP 200 · CP 30 · 지금 행동 「가만히」가 지금 세계와 같다', () => {
    const w = driveWorld(solo);
    const body = bodyOf(state(w));
    expect({
      position: body.position,
      facing: body.facing,
      hp: body.hp,
      cp: body.cp,
      action: body.currentAction.kind,
      kind: body.characterKind,
    }).toEqual({
      position: { x: 0, z: 0 },
      facing: { x: 0, z: 1 },
      hp: RABBIT_MAX_HP,
      cp: RABBIT_START_CP,
      action: 'idle',
      kind: RABBIT,
    });
    expect(hud(w.observe(), 'self.hp')).toBe(RABBIT_MAX_HP);
    expect(hud(w.observe(), 'self.cp')).toBe(RABBIT_START_CP);
  });

  it.todo(
    'GAP: 「정체 · 있음 · 몸 상태 · Core · 인지 · 앎 · 지금 행동 · 장착 자리」 여덟 자리의 **형**(그 가운데 앎 · 장착 자리는 빈 자리다) 은 이 하네스로 놓을 수 없다 — 값이 없는 자리는 실행 중에 드러나지 않는다. 세계 쪽에서 잴 수 있는 것은 저장되는 몸 상태의 여덟 자리(①)와 없는 셋(②)까지다',
  );
});

// ─────────────────────────────────────────────────────────────────────
describe('RULE-BODY-PROPERTY-001 — 몸의 성질은 물음의 답이다', () => {
  it('① 성질 하나를 묻는다 → 답이 그 몸에 걸린 Source 들의 몫의 합이 된다 (첫 Source 는 몸의 종류다)', () => {
    const s = state(driveWorld(solo));
    const body = bodyOf(s);
    for (const property of [PROPERTY_MAX_HP, PROPERTY_MAX_CP, PROPERTY_AWARENESS]) {
      const sources = bodyPropertySources(s, body);
      const mine = propertySourcesOf(property, sources);
      // Then 그 성질에 답하는 Source 가 적어도 하나 있고, 답은 그 몫들이 낸 값이다
      expect({ property, answered: mine.length > 0 }).toEqual({ property, answered: true });
      expect({ property, answer: bodyProperty(s, body, property) }).toEqual({
        property,
        answer: resolveProperty(property, sources),
      });
    }
    // 첫 Source 는 몸의 종류가 놓은 것이다 — Source 를 더 걸어도 첫 자리는 그대로다
    const base = propertySourcesOf(PROPERTY_MAX_HP, bodyPropertySources(s, body));
    const added = driveWorld({
      ...solo,
      actorSources: [{ origin: 'c039:add', property: PROPERTY_MAX_HP, share: { kind: 'add', value: 50 } }],
    });
    const addedState = state(added);
    const grown = propertySourcesOf(PROPERTY_MAX_HP, bodyPropertySources(addedState, bodyOf(addedState)));
    expect(grown.length).toBe(base.length + 1);
    expect(grown[0]).toEqual(base[0]);
  });

  it('② 관찰자의 몸에게 최대 HP 를 묻는다 → 「200」이 된다 (최대 CP 는 「100」 — 지금 세계와 같다)', () => {
    const s = state(driveWorld(solo));
    const body = bodyOf(s);
    expect({ maxHp: bodyMaxHp(s, body), maxCp: bodyMaxCp(s, body) }).toEqual({
      maxHp: RABBIT_MAX_HP,
      maxCp: RABBIT_MAX_CP,
    });
    // 그 값의 출처는 몸의 종류다 — 카탈로그가 오래 적어 온 값과 한 값도 다르지 않다
    expect({ maxHp: bodyMaxHp(s, body), maxCp: bodyMaxCp(s, body) }).toEqual({
      maxHp: CHARACTER_CATALOG[RABBIT]!.resources.hpMax,
      maxCp: CHARACTER_CATALOG[RABBIT]!.resources.cpMax,
    });
  });

  it('③ 어느 Source 도 답하지 않는 성질을 묻는다 → 「없음」이 된다 (「0」이 아니다)', () => {
    const s = state(driveWorld(solo));
    const body = bodyOf(s);
    expect(bodyProperty(s, body, NO_SUCH_PROPERTY)).toBeUndefined();
    expect(propertySourcesOf(NO_SUCH_PROPERTY, bodyPropertySources(s, body))).toEqual([]);
    // 기구도 같은 말을 한다 — 답할 Source 가 없으면 없음이다
    expect(resolveProperty(NO_SUCH_PROPERTY, [])).toBeUndefined();
  });

  it('④ 변형 데이터로 최대 HP 에 「+50」 Source 를 건다 → 「250」이 되고 저장되는 자리는 하나도 늘지 않는다', () => {
    const base = bodyOf(state(driveWorld(solo)));
    const w = driveWorld({
      ...solo,
      actorSources: [{ origin: 'c039:add', property: PROPERTY_MAX_HP, share: { kind: 'add', value: 50 } }],
    });
    const s = state(w);
    const body = bodyOf(s);
    // Then 답이 250 이다
    expect(bodyMaxHp(s, body)).toBe(RABBIT_MAX_HP + 50);
    // 저장되는 몸 상태에 자리가 하나도 늘지 않았다 (필드 이름의 벌이 같다)
    expect(Object.keys(body).sort()).toEqual(Object.keys(base).sort());
    // 아무것도 저장되지 않았다 — 250 이라는 값은 몸 어디에도 없다
    expect(JSON.stringify(body).includes('250')).toBe(false);
    // 같은 몸 · 같은 Source · 같은 때면 언제나 같은 답이다
    expect(bodyMaxHp(s, body)).toBe(bodyMaxHp(s, body));
    tickFor(w, 1.0);
    expect(bodyMaxHp(state(w), bodyOf(state(w)))).toBe(RABBIT_MAX_HP + 50);
  });

  it('⑤ Source 둘이 같은 성질에 상한 「20」과 「10」을 건다 → 「10」이 된다 (상한은 작은 쪽이 이긴다)', () => {
    const caps: PropertySource[] = [
      { origin: 'a', property: PROPERTY_AWARENESS, share: { kind: 'cap', value: 20 } },
      { origin: 'b', property: PROPERTY_AWARENESS, share: { kind: 'cap', value: 10 } },
    ];
    expect(resolveProperty(PROPERTY_AWARENESS, caps)).toBe(10);
    // 차례를 바꿔도 같다 — 작은 쪽이 이기는 것이지 뒤에 온 쪽이 이기는 것이 아니다
    expect(resolveProperty(PROPERTY_AWARENESS, [caps[1]!, caps[0]!])).toBe(10);
    // 더함은 합이다
    expect(
      resolveProperty(PROPERTY_MAX_HP, [
        { origin: 'a', property: PROPERTY_MAX_HP, share: { kind: 'add', value: 100 } },
        { origin: 'b', property: PROPERTY_MAX_HP, share: { kind: 'add', value: 20 } },
      ]),
    ).toBe(120);
    // 참거짓은 하나라도 참이면 참이다
    const tag = propertyTag(ASPECT_HEAT, RELATION_HIDES);
    expect(
      resolveProperty(tag, [
        { origin: 'a', property: tag, share: { kind: 'flag', value: false } },
        { origin: 'b', property: tag, share: { kind: 'flag', value: true } },
      ]),
    ).toBe(true);
    expect(
      resolveProperty(tag, [{ origin: 'a', property: tag, share: { kind: 'flag', value: false } }]),
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('RULE-STRIKE-DAMAGE-001 · RULE-CP-RUN-DRAIN-001 · RULE-SKILL-BUDGET-001 — HP 와 CP 는 현재값이고 최대는 성질이다', () => {
  const BASIC = SKILL_DEFINITIONS.attack;
  const AFTER_SWING_OPEN = SWING_BEGIN * BASIC.baseDuration + 2 * TICK_INTERVAL;
  // 순회도 인지도 없는 정지 NPC — 때릴 대상으로만 쓴다 (combat.spec 의 dummyAt 그대로 · 결정론)
  const dummyAt = (x: number, z: number) => ({ id: 'npc-1', position: { x, z }, wanderPath: [], perceptionRange: 0 });
  const aimRight = (w: WorldDriver) => {
    w.dispatch({ interactionId: 'move', position: { x: 2, z: 0 } });
    w.tick(TICK_INTERVAL);
  };

  it('① 타격이 닿고 · 달리며 한 Tick 이 지나고 · HP 가 0 이 된다 → 변형 없음: 셋 다 지금 그대로다', () => {
    // 타격 — HP 가 스킬이 정한 값만큼 준다
    const hit = driveWorld({ npcs: [dummyAt(1.5, 0)] });
    aimRight(hit);
    hit.dispatch({ interactionId: 'attack' });
    tickFor(hit, AFTER_SWING_OPEN);
    expect(bodyOf(state(hit), 'npc-1').hp).toBe(CHARACTER_CATALOG[WANDERER]!.resources.hpMax - BASIC.damage);

    // 달림 — CP 가 준다 (달린 시간에 비례)
    const run = driveWorld(solo);
    run.dispatch({ interactionId: 'move-mode', mode: 'run' });
    run.dispatch({ interactionId: 'move', position: { x: 18, z: 18 } });
    tickFor(run, 1.0);
    expect(RABBIT_START_CP - (hud(run.observe(), 'self.cp') as number)).toBeCloseTo(RUN_CP_DRAIN * 1.0, 1);

    // 쓰러짐 — HP 가 0 이면 지금 행동이 쓰러짐이 된다
    const down = driveWorld({ npcs: [dummyAt(3, 0)] });
    down.dispatch({
      interactionId: 'set-attribute',
      targetEntityId: 'npc-1',
      attribute: { id: STATE_HP, value: 0 },
    });
    expect(entityOf(down.observe(), 'npc-1')?.state).toBe('downed');
  });

  it('② CP 가 최대 CP 를 넘는 값이 되려 한다 → 그 CP 가 「최대 CP」가 된다', () => {
    const w = driveWorld({ npcs: [dummyAt(1.5, 0)] });
    aimRight(w);
    const s = state(w);
    const maxCp = bodyMaxCp(s, bodyOf(s));
    // 최대까지 채워 두고 한 번 더 충전시킨다
    w.dispatch({ interactionId: 'set-attribute', attribute: { id: STATE_CP, value: maxCp } });
    expect(hud(w.observe(), 'self.cp')).toBe(maxCp);
    w.dispatch({ interactionId: 'attack' });
    tickFor(w, AFTER_SWING_OPEN);
    // Then 넘지 않는다 — 현재값은 성질을 넘지 않는다
    expect(hud(w.observe(), 'self.cp')).toBe(maxCp);
    expect(bodyOf(state(w)).cp).toBeLessThanOrEqual(maxCp);
  });

  it('③ 변형 데이터로 최대 HP 가 지금 HP 보다 작아진다 → 그 HP 가 「새 최대 HP」가 된다', () => {
    // Given 최대 HP 에 상한 50 을 건 Source 하나 (코드 diff 0)
    const w = driveWorld({
      ...solo,
      actorSources: [{ origin: 'c039:cap', property: PROPERTY_MAX_HP, share: { kind: 'cap', value: 50 } }],
    });
    tickFor(w, 0.5);
    const s = state(w);
    const body = bodyOf(s);
    // Then 최대가 50 이고 현재값도 그 값에 잘렸다
    expect(bodyMaxHp(s, body)).toBe(50);
    expect(body.hp).toBe(50);
    expect(hud(w.observe(), 'self.hp')).toBe(50);
  });

  it('④ HP · CP 밖의 전투 자원이 있는가를 센다 → 변형 없음: 둘뿐이다', () => {
    const s = state(driveWorld(solo));
    const body = bodyOf(s);
    // 현재값은 둘이다 — 셋째 자원 이름이 저장되는 몸 상태에 없다
    expect({ hp: STATE_HP in body, cp: STATE_CP in body }).toEqual({ hp: true, cp: true });
    for (const other of ['stamina', 'mana', 'aura', 'focus', 'heat', 'sp', 'mp']) {
      expect({ other, stored: other in body }).toEqual({ other, stored: false });
    }
    // 최대는 성질이고, 자원의 최대는 그 가운데 둘뿐이다 (셋째는 인지 범위이고 자원이 아니다)
    expect([...BODY_PROPERTY_NAMES]).toEqual([PROPERTY_MAX_HP, PROPERTY_MAX_CP, PROPERTY_AWARENESS]);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('RULE-AWARENESS-001 — 인지 범위는 유도값이다', () => {
  it('① 인지 범위를 묻는다 → 종류 · 때 · 자락 세 상한 가운데 작은 것이 된다', () => {
    const inside = blizzardSpot();
    const outside = outsideBlizzardSpot();
    const answers = {
      // 낮 · 자락 밖 — 거는 것이 없다 (제한 없음)
      dayOutside: (() => {
        const s = state(standingIn(FROST_CANYON, outside, { clock: DAY_CLOCK }));
        return bodyAwareness(s, bodyOf(s));
      })(),
      // 밤 · 자락 밖 — 때가 건 20
      nightOutside: (() => {
        const s = state(standingIn(FROST_CANYON, outside, { clock: NIGHT_CLOCK }));
        return bodyAwareness(s, bodyOf(s));
      })(),
      // 낮 · 자락 안 — 자락이 건 20
      dayInside: (() => {
        const s = state(standingIn(FROST_CANYON, inside, { clock: DAY_CLOCK }));
        return bodyAwareness(s, bodyOf(s));
      })(),
      // 밤 · 자락 안 — 둘 가운데 작은 10
      nightInside: (() => {
        const s = state(standingIn(FROST_CANYON, inside, { clock: NIGHT_CLOCK }));
        return bodyAwareness(s, bodyOf(s));
      })(),
    };
    expect(answers).toEqual({
      dayOutside: Infinity,
      nightOutside: NIGHT_AWARENESS_CAP,
      dayInside: BLIZZARD_DAY_CAP,
      nightInside: BLIZZARD_NIGHT_CAP,
    });
  });

  it('② 세계가 처음 선다 → 값 넷이 선다: 종류 rabbit-swordsman 제한 없음 · wanderer 9 · 밤 20 · 눈보라 낮 20 밤 10', () => {
    // 종류가 거는 상한 — 자락 밖 · 낮에 물으면 종류의 것만 남는다
    const rabbit = state(driveWorld(solo));
    expect(bodyAwareness(rabbit, bodyOf(rabbit))).toBe(Infinity);
    const withNpc = state(driveWorld({ actorPosition: { x: 18, z: 18 } }));
    expect(bodyAwareness(withNpc, bodyOf(withNpc, 'npc-1'))).toBe(WANDERER_AWARENESS);
    // 때가 거는 상한 — 밤 20 (표의 줄로 선다)
    expect(TIME_AWARENESS_CAPS.some((row) => row.cap === NIGHT_AWARENESS_CAP)).toBe(true);
    // 지금 코드의 값을 자리만 옮긴 것이다
    expect(OBSERVE_RANGE_NIGHT).toBe(NIGHT_AWARENESS_CAP);
    expect(CHARACTER_CATALOG[WANDERER]!.perceptionRange).toBe(WANDERER_AWARENESS);
    // 자락이 거는 상한 — 눈보라의 낮 20 · 밤 10 (그 방의 데이터가 소유한다)
    const inside = blizzardSpot();
    const day = state(standingIn(FROST_CANYON, inside, { clock: DAY_CLOCK }));
    const night = state(standingIn(FROST_CANYON, inside, { clock: NIGHT_CLOCK }));
    expect({
      day: bodyAwareness(day, bodyOf(day)),
      night: bodyAwareness(night, bodyOf(night)),
    }).toEqual({ day: BLIZZARD_DAY_CAP, night: BLIZZARD_NIGHT_CAP });
  });

  it('③ 떠도는 자에게 묻고 낮이며 눈보라 밖이다 → 「9」가 되고 그 몸이 9 안의 몸을 쫓는다', () => {
    // Given 떠도는 자 하나가 여덟 걸음 떨어져 선다 (9 안이다)
    const w = driveWorld({
      actorPosition: { x: 0, z: 0 },
      npcs: [{ id: 'npc-1', position: { x: -8, z: 0 }, wanderPath: [] }],
      clock: DAY_CLOCK,
    });
    const s = state(w);
    expect(bodyAwareness(s, bodyOf(s, 'npc-1'))).toBe(WANDERER_AWARENESS);
    // Then 쫓는다 — RULE-NPC-DECIDE-001 그대로
    w.tick(0.1);
    expect(entityOf(w.observe(), 'npc-1')?.state).toBe('move');
    const before = distanceBetween(bodyOf(state(w), 'npc-1').position, bodyOf(state(w)).position);
    tickFor(w, 1.0);
    const after = distanceBetween(bodyOf(state(w), 'npc-1').position, bodyOf(state(w)).position);
    expect(after).toBeLessThan(before);
  });

  it('④ 떠도는 자가 눈보라 자락 안이고 밤이다 → 변형 없음: 답이 「9」다 (상한 10 보다 작다)', () => {
    const { here, there } = blizzardPair();
    const w = driveWorld({
      actorRegion: FROST_CANYON,
      actorPosition: { x: here.x, z: here.z },
      npcRegion: FROST_CANYON,
      npcs: [{ id: 'npc-1', position: { x: there.x, z: there.z }, wanderPath: [] }],
      clock: NIGHT_CLOCK,
    });
    const s = state(w);
    const npc = bodyOf(s, 'npc-1');
    // Given 그 몸이 자락 안이고 때가 밤이다
    expect(coveredBy(FROST_CANYON, BLIZZARD, npc.position)).toBe(true);
    // Then 답이 9 다 — 자율 존재의 행동이 한 값도 다르지 않다
    expect(bodyAwareness(s, npc)).toBe(WANDERER_AWARENESS);
    expect(distanceBetween(npc.position, bodyOf(s).position)).toBeLessThanOrEqual(WANDERER_AWARENESS);
    w.tick(0.1);
    expect(entityOf(w.observe(), 'npc-1')?.state).toBe('move');
    const before = distanceBetween(bodyOf(state(w), 'npc-1').position, bodyOf(state(w)).position);
    tickFor(w, 1.0);
    expect(distanceBetween(bodyOf(state(w), 'npc-1').position, bodyOf(state(w)).position)).toBeLessThan(before);
  });

  it('⑤ 관찰자의 몸에게 묻고 때가 밤이다 → 「20」이 된다', () => {
    const s = state(driveWorld({ ...solo, clock: NIGHT_CLOCK }));
    expect(bodyAwareness(s, bodyOf(s))).toBe(NIGHT_AWARENESS_CAP);
  });

  it('⑥ 변형 데이터로 rabbit-swordsman 의 상한을 「5」로 바꾼다 → 인지 범위가 「5」가 된다', () => {
    // Given 그 몸에 상한 5 를 건 Source 하나 (코드 diff 0 — 값만 짓는다)
    const w = driveWorld({
      ...solo,
      actorSources: [{ origin: 'c039:awareness', property: PROPERTY_AWARENESS, share: { kind: 'cap', value: 5 } }],
    });
    const s = state(w);
    // Then 무엇을 감지할 수 있는가가 데이터로 달라진다
    expect(bodyAwareness(s, bodyOf(s))).toBe(5);
    // 종류 표를 값으로 갈아 끼워도 같은 답이다 (표의 값이 그 상한의 출처다)
    const plain = state(driveWorld(solo));
    expect(bodyAwareness(plain, bodyOf(plain), kindsVariant(Infinity, 5))).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('RULE-CONDITION-READ-001 — 조건이 행위자를 가리킨다', () => {
  it('① 대상이 행위자이고 세계에 있으며 물음이 「성질」이다 → 답이 규칙 2 의 답으로 갈린다 (판정 불가가 아니다)', () => {
    const s = state(driveWorld(solo));
    expect(verdict(s, actorLeaf(PLAYER, { kind: 'property', path: PROPERTY_MAX_HP }, '==', RABBIT_MAX_HP))).toBe('met');
    expect(verdict(s, actorLeaf(PLAYER, { kind: 'property', path: PROPERTY_MAX_HP }, '==', RABBIT_MAX_HP - 1))).toBe('unmet');
    expect(verdict(s, actorLeaf(PLAYER, { kind: 'property', path: PROPERTY_MAX_CP }, '>=', RABBIT_MAX_CP))).toBe('met');
    expect(verdict(s, actorLeaf(PLAYER, { kind: 'property', path: PROPERTY_MAX_CP }, '>', RABBIT_MAX_CP))).toBe('unmet');
  });

  it('② 대상이 행위자이고 물음이 「있음」 또는 「상태」다 → 답이 그 몸의 저장된 값으로 갈린다', () => {
    const s = state(driveWorld(solo));
    // 있음 — 세계에 선 몸이다
    expect(verdict(s, actorLeaf(PLAYER, { kind: 'exists' }, 'EXISTS'))).toBe('met');
    // 상태 — 저장된 값으로 갈린다 (세계가 오래 써 온 이름 셋으로 못 박는다)
    expect(verdict(s, actorLeaf(PLAYER, { kind: 'state', path: STATE_HP }, '==', RABBIT_MAX_HP))).toBe('met');
    expect(verdict(s, actorLeaf(PLAYER, { kind: 'state', path: STATE_HP }, '==', 1))).toBe('unmet');
    expect(verdict(s, actorLeaf(PLAYER, { kind: 'state', path: STATE_CP }, '==', RABBIT_START_CP))).toBe('met');
    expect(verdict(s, actorLeaf(PLAYER, { kind: 'state', path: STATE_MOVE_MODE }, '==', 'walk'))).toBe('met');
    expect(verdict(s, actorLeaf(PLAYER, { kind: 'state', path: STATE_MOVE_MODE }, '==', 'run'))).toBe('unmet');
    // 어휘가 여는 상태 경로는 **모두** 읽힌다 — 판정 불가가 하나도 없다.
    // C039 CHANGED — 훑는 잣대를 `!= <글자>` 에서 EXISTS 로 옮겼다: 다섯 가운데 hp · cp 는 **수**이고
    // 기반은 형이 어긋난 견줌을 거짓으로 누르지 않고 판정 불가로 낸다(engine 의 compareScalars).
    // 그것은 읽히지 않은 것이 아니라 **잘못 잰 것**이므로, 「그 몸의 저장된 값으로 갈린다」를 값의
    // 형을 타지 않는 EXISTS 로 잰다 (다섯 경로가 다 읽힌다 = met)
    for (const path of actorPaths('state') ?? []) {
      const judged = verdict(s, actorLeaf(PLAYER, { kind: 'state', path }, 'EXISTS'));
      expect({ path, judged }).toEqual({ path, judged: 'met' });
    }
  });

  it('③ 대상이 행위자인데 그 행위자가 세계에 없다 → 「판정 불가」가 된다', () => {
    const s = state(driveWorld(solo));
    expect(verdict(s, actorLeaf('c039-no-such-body', { kind: 'exists' }, 'EXISTS'))).toBe('undecidable');
    expect(verdict(s, actorLeaf('c039-no-such-body', { kind: 'state', path: STATE_HP }, '==', 1))).toBe('undecidable');
    expect(
      verdict(s, actorLeaf('c039-no-such-body', { kind: 'property', path: PROPERTY_MAX_HP }, '==', RABBIT_MAX_HP)),
    ).toBe('undecidable');
  });

  it('④ 대상이 행위자이고 물음이 「앎」이다 → 「판정 불가」가 된다 (C040 이 연다)', () => {
    const s = state(driveWorld(solo));
    expect(verdict(s, actorLeaf(PLAYER, { kind: 'knowledge', path: 'anything' }, 'EXISTS'))).toBe('undecidable');
    // 어휘도 앎을 열지 않는다
    expect(actorPaths('knowledge')).toBeUndefined();
  });

  it('⑤ 검사 ㊹ 가 행위자 대상의 조건을 잰다 → 어휘가 몸의 종류 · 성질 이름 셋 · 상태 다섯이고 없는 성질 이름은 「실패」다', () => {
    const vocabulary = worldConditionVocabulary();
    // 몸의 종류 — 어휘가 여는 행위자의 id 목록
    expect(vocabulary.targets.actor).toBeDefined();
    expect([...(vocabulary.targets.actor ?? [])]).toEqual(Object.keys(CHARACTER_CATALOG));
    // 성질 이름 셋 — 그 목록이 곧 어휘다
    expect([...(actorPaths('property') ?? [])]).toEqual([...BODY_PROPERTY_NAMES]);
    expect((actorPaths('property') ?? []).length).toBe(3);
    // 상태 다섯
    expect((actorPaths('state') ?? []).length).toBe(5);
    for (const path of [STATE_HP, STATE_CP, STATE_MOVE_MODE]) {
      expect({ path, listed: (actorPaths('state') ?? []).includes(path) }).toEqual({ path, listed: true });
    }
    // 어휘 안의 잎은 통과한다
    const good = conditionItemOf(
      withSite({
        where: 'c039:actor',
        condition: {
          all: [
            actorLeaf(undefined, { kind: 'property', path: PROPERTY_MAX_HP }, '>=', 1),
            actorLeaf(undefined, { kind: 'state', path: STATE_HP }, '>=', 1),
            actorLeaf(undefined, { kind: 'exists' }, 'EXISTS'),
          ],
        },
      }),
    );
    expect(good.status).toBe('pass');
    // 없는 성질 이름을 가리킨 조건은 걸린다
    const bad = conditionItemOf(
      withSite({
        where: 'c039:ghost-property',
        condition: actorLeaf(undefined, { kind: 'property', path: NO_SUCH_PROPERTY }, '==', 1),
      }),
    );
    expect(bad.status).toBe('fail');
    expect(bad.refs.map((ref) => ref.where)).toContain('c039:ghost-property');
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('RULE-LOCK-ACTIVATION-001 — 문의 성질 요구가 몸에게 묻는다', () => {
  const doorSpot = (): XZ => connectorSpot(FROST_DEPTH_DOOR, FROST_CANYON);
  const atDoor = (clock: string, extra: WorldSetup = {}): WorldDriver =>
    standingIn(FROST_CANYON, doorSpot(), { ...extra, clock });
  /** 그 자리에서 문이 밝히는 사유 코드 — 데이터가 짓는다 (자락 안이면 완화된 줄) */
  const expectedReason = (at: XZ): string => {
    const lock = frostDoorLock();
    const relaxed = (lock.relaxedBy ?? []).some(
      (r) => r.area !== undefined && coveredBy(FROST_CANYON, r.area, at),
    );
    return relaxed && lock.relaxedReason !== undefined ? lock.relaxedReason : lock.reason!;
  };

  it('① 요구가 「체열이 숨겨진다」이고 때가 긴 밤이며 문 앞 몸의 그 성질이 거짓이다 → 「잠김」 · 사유는 그대로다', () => {
    const w = atDoor(LONG_NIGHT);
    const s = state(w);
    const body = bodyOf(s);
    // Given 답할 Source 가 없다
    expect(bodyProperty(s, body, propertyTag(ASPECT_HEAT, RELATION_HIDES))).toBeFalsy();
    // Then 문이 잠긴다 — 철 때문이 아니다 (긴 밤이다)
    const closed = connectorClosedReason(s.regionStates, FROST_DEPTH_DOOR, s.time, askable(s, body));
    expect(closed).not.toBeNull();
    expect(closed).not.toBe('season');
    expect(isConnectorOpen(s.regionStates, FROST_DEPTH_DOOR, s.time, askable(s, body))).toBe(false);
    // 판이 읽는 값도 잠김이다
    expect(exitOf(w.observe(), FROST_DEPTH_DOOR)?.state).toBe('locked');
    // 사유는 현상 한 마디 그대로다 — 요구의 이름을 말하지 않는다
    expect(exitOf(w.observe(), FROST_DEPTH_DOOR)?.conditions).toEqual([expectedReason(doorSpot())]);
    expect(connectorReasonCodes(FROST_DEPTH_DOOR, { regionId: FROST_CANYON, position: doorSpot() })).toEqual([
      expectedReason(doorSpot()),
    ]);
    // 붙어서 물으면 거절이다
    expect(w.dispatch({ interactionId: 'transit', targetEntityId: FROST_DEPTH_DOOR })).toEqual({
      status: 'failure',
      rule: 'RULE-REGION-TRANSIT-001',
      reason: 'connector-inactive',
    });
  });

  it('② 변형 데이터로 그 몸에 「체열이 숨겨진다 참」 Source 를 건다 · 때가 긴 밤이다 → 「열림」이 된다', () => {
    const w = atDoor(LONG_NIGHT, { actorSources: [heatHiddenSource()] });
    const s = state(w);
    const body = bodyOf(s);
    // Given 답이 들어왔다
    expect(bodyProperty(s, body, propertyTag(ASPECT_HEAT, RELATION_HIDES))).toBe(true);
    // Then 문이 열린다
    expect(connectorClosedReason(s.regionStates, FROST_DEPTH_DOOR, s.time, askable(s, body))).toBeNull();
    expect(isConnectorOpen(s.regionStates, FROST_DEPTH_DOOR, s.time, askable(s, body))).toBe(true);
    expect(exitOf(w.observe(), FROST_DEPTH_DOOR)?.state).toBe('open');
    // 건너기의 거절도 더 이상 "닫혔다" 가 아니다 — 그 너머는 아직 경계다
    expect(w.dispatch({ interactionId: 'transit', targetEntityId: FROST_DEPTH_DOOR })).toEqual({
      status: 'failure',
      rule: 'RULE-REGION-TRANSIT-001',
      reason: 'region-not-built',
    });
  });

  it('③ 그 Source 가 걸린 몸이고 때가 긴 밤이 아니다 → 변형 없음: 「잠김」 · 사유 「이 철이 아니다」', () => {
    const w = atDoor(STILL, { actorSources: [heatHiddenSource()] });
    const s = state(w);
    const body = bodyOf(s);
    expect(bodyProperty(s, body, propertyTag(ASPECT_HEAT, RELATION_HIDES))).toBe(true);
    // Then 때 요구는 여전히 판정된다
    expect(connectorClosedReason(s.regionStates, FROST_DEPTH_DOOR, s.time, askable(s, body))).toBe('season');
    expect(exitOf(w.observe(), FROST_DEPTH_DOOR)?.state).toBe('locked');
    expect(w.dispatch({ interactionId: 'transit', targetEntityId: FROST_DEPTH_DOOR })).toEqual({
      status: 'failure',
      rule: 'RULE-REGION-TRANSIT-001',
      reason: 'not-this-season',
    });
  });

  it('④ 문의 요구가 「앎」이다 → 변형 없음: 판정에 들어오지 않는다', () => {
    // Given 지금 이 세계의 문 가운데 앎을 밝힌 것이 하나도 없다
    const asksKnowledge = REGION_SPECS.flatMap((spec) => spec.access?.locks ?? []).flatMap((lock) =>
      lock.requires.filter((r) => (r as { knowledge?: unknown }).knowledge !== undefined),
    );
    expect(asksKnowledge).toEqual([]);
    // Then 문이 몸에게 묻는 것은 성질의 이름들뿐이다 — 앎의 이름을 한 번도 묻지 않는다
    const w = atDoor(LONG_NIGHT);
    const s = state(w);
    const probe = probeBody();
    connectorClosedReason(s.regionStates, FROST_DEPTH_DOOR, s.time, probe.body);
    expect(probe.asked).toEqual(doorPropertyNames());
  });

  it('⑤ 문 앞에 몸이 없다 → 변형 없음: 요구가 있는 문은 몸 없이 「열림」이 되지 않는다', () => {
    const s = state(standingIn(FROST_CANYON, doorSpot(), { clock: LONG_NIGHT }));
    // 몸을 주지 않으면 성질 요구는 서지 않는다
    expect(isConnectorOpen(s.regionStates, FROST_DEPTH_DOOR, s.time)).toBe(false);
    expect(connectorClosedReason(s.regionStates, FROST_DEPTH_DOOR, s.time)).not.toBeNull();
    // 요구를 밝히지 않은 문은 몸이 없어도 답이 그대로다 (미로 심장 · 걷는 숲은 회귀 규칙이 잰다)
    for (const connector of REGION_GRAPH.connectors) {
      const lock = lockOfConnector(connector.id);
      const asksProperty = (lock?.requires ?? []).some(
        (r) => (r as { property?: unknown }).property !== undefined,
      );
      if (asksProperty) continue;
      const probe = probeBody(() => true);
      const withBody = connectorClosedReason(s.regionStates, connector.id, s.time, probe.body);
      const without = connectorClosedReason(s.regionStates, connector.id, s.time);
      expect({ id: connector.id, withBody }).toEqual({ id: connector.id, withBody: without });
      expect({ id: connector.id, asked: probe.asked }).toEqual({ id: connector.id, asked: [] });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('RULE-BODY-CORE-001 — Core 가 몸에 귀속된다', () => {
  it('① 세계가 처음 선다 → 관찰자 몸의 Core 가 서고 그것이 몸의 저장되는 상태다', () => {
    const w = driveWorld(solo);
    const body = bodyOf(state(w));
    expect(typeof body.core).toBe('string');
    expect((body.core as unknown as string).length).toBeGreaterThan(0);
    // 저장을 건너도 그 자리에 그대로 있다 — 저장되는 상태다
    expect(JSON.stringify(throughFile(w.world.snapshot())).includes(body.core as unknown as string)).toBe(true);
  });

  it('② 방을 건너고 · HP 가 줄고 · 세계가 껐다 켜진다 → 변형 없음: Core 가 그대로다', () => {
    const w = driveWorld(solo);
    const before = bodyOf(state(w)).core;
    // 방을 건넌다 (걸어 닿을 수 있는 첫 출구로)
    const exits = w.observe().entities.filter((e) => e.role === 'region-exit');
    expect(exits.length).toBeGreaterThan(0);
    const target = exits[0]!;
    w.dispatch({ interactionId: 'move', position: { x: target.position.x, z: target.position.z } });
    tickFor(w, 20);
    w.dispatch({ interactionId: 'transit', targetEntityId: target.id });
    w.tick(TICK_INTERVAL);
    // HP 가 준다
    w.dispatch({ interactionId: 'set-attribute', attribute: { id: STATE_HP, value: 42 } });
    expect(bodyOf(state(w)).core).toEqual(before);
    // 껐다 켠다
    const revived = revive(w);
    expect(bodyOf(state(revived)).core).toEqual(before);
  });

  it('③ 세계가 그 Core 로 무엇을 여는가를 센다 → 변형 없음: 아무것도 열지 않는다', () => {
    const base = driveWorld(solo);
    const baseView = base.observe();
    // Core 이름만 값으로 갈아 끼운 세계
    const other = worldFrom(base, (s) => {
      const body = s.actors.find((a) => a.id === PLAYER)!;
      (body as unknown as { core: string }).core = 'c039-other-core';
    });
    const otherView = other.observe();
    // 행동 입구도 출구의 표식도 한 값도 달라지지 않는다
    expect(JSON.stringify(otherView.interactions)).toBe(JSON.stringify(baseView.interactions));
    expect(
      otherView.entities.filter((e) => e.role === 'region-exit').map((e) => [e.id, e.state]),
    ).toEqual(baseView.entities.filter((e) => e.role === 'region-exit').map((e) => [e.id, e.state]));
    // 성질의 답도 그대로다 — Core 는 아직 아무 성질에도 답하지 않는다
    const a = state(base);
    const b = state(other);
    expect(bodyMaxHp(b, bodyOf(b))).toBe(bodyMaxHp(a, bodyOf(a)));
    expect(bodyAwareness(b, bodyOf(b))).toBe(bodyAwareness(a, bodyOf(a)));
  });
});

// ─────────────────────────────────────────────────────────────────────
//
// 손잡이 — 경험 값은 **데이터가** 돌린다 (spec 규칙 8 · 원칙 9).
//
// 규율은 c004 의 VARIANT_ROOM 과 같다: **코드 diff 0** 이고 변형은 언제나 값이다. 여기서 짓는
// 것은 변형 표(BodyPropertyTables 를 값으로 갈아 끼운 것)와 WorldSetup.actorSources 로 건
// Source 뿐이며, 컨텐츠 파일도 규칙 코드도 한 줄 바꾸지 않는다.

describe('손잡이 — 경험 값은 데이터가 돌린다 (규칙 8)', () => {
  it('① 몸의 종류 표에서 rabbit-swordsman 의 최대 HP 를 「150」으로 바꾼다 → 그 몸의 최대 HP 가 「150」이 된다', () => {
    const s = state(driveWorld(solo));
    const body = bodyOf(s);
    expect(bodyMaxHp(s, body)).toBe(RABBIT_MAX_HP);
    // Given 표의 그 수 하나만 값으로 갈아 끼운다 (코드 diff 0)
    const variant = kindsVariant(RABBIT_MAX_HP, 150);
    // Then 몸이 얼마나 버티는가가 표의 값이다
    expect(bodyMaxHp(s, body, variant)).toBe(150);
    expect(bodyProperty(s, body, PROPERTY_MAX_HP, variant)).toBe(150);
    // 지금 표는 한 글자도 달라지지 않았다
    expect(bodyMaxHp(s, body)).toBe(RABBIT_MAX_HP);
  });

  it('② 때가 거는 인지 상한 「20」을 「30」으로 바꾼다 → 밤의 인지 범위가 「30」이 된다', () => {
    const outside = outsideBlizzardSpot();
    const s = state(standingIn(FROST_CANYON, outside, { clock: NIGHT_CLOCK }));
    const body = bodyOf(s);
    expect(bodyAwareness(s, body)).toBe(NIGHT_AWARENESS_CAP);
    // Given 표의 그 줄의 상한만 값으로 갈아 끼운다 (코드 diff 0)
    const variant = timeCapVariant(NIGHT_AWARENESS_CAP, 30);
    // Then 밤이 얼마나 어두운가는 규칙이 아니라 데이터의 줄이다
    expect(bodyAwareness(s, body, variant)).toBe(30);
    // 낮은 그 줄이 없으므로 여전히 제한 없음이다
    const day = state(standingIn(FROST_CANYON, outside, { clock: DAY_CLOCK }));
    expect(bodyAwareness(day, bodyOf(day), variant)).toBe(Infinity);
  });

  it('③ 문의 요구를 다른 성질 이름으로 바꾼다 → 문이 그 성질을 몸에게 묻는다 (사유 문구도 표의 줄이다)', () => {
    const w = standingIn(FROST_CANYON, connectorSpot(FROST_DEPTH_DOOR, FROST_CANYON), { clock: LONG_NIGHT });
    const s = state(w);
    // Then 문이 묻는 이름은 **그 문의 데이터가 적은 이름** 그대로다 (규칙이 이름을 짓지 않는다)
    const probe = probeBody();
    connectorClosedReason(s.regionStates, FROST_DEPTH_DOOR, s.time, probe.body);
    expect(probe.asked).toEqual(doorPropertyNames());
    expect(doorPropertyNames()).toEqual([propertyTag(ASPECT_HEAT, RELATION_HIDES)]);
    // 그 이름에 참으로 답하면 열리고, 다른 이름에만 답하면 열리지 않는다
    const yes = probeBody((name) => (doorPropertyNames().includes(name) ? true : undefined));
    expect(connectorClosedReason(s.regionStates, FROST_DEPTH_DOOR, s.time, yes.body)).toBeNull();
    const elsewhere = probeBody((name) => (name === PROPERTY_WEIGHT ? true : undefined));
    expect(connectorClosedReason(s.regionStates, FROST_DEPTH_DOOR, s.time, elsewhere.body)).not.toBeNull();
    // 서지 않을 때의 사유 문구도 그 문의 데이터가 적은 줄이다
    const lock = frostDoorLock();
    expect(connectorReasonCodes(FROST_DEPTH_DOOR)).toEqual([lock.reason]);
  });

  it('④ 관찰자 몸의 Core 이름을 바꾼다 → 그 몸의 Core 가 그 이름이 된다 (계열은 데이터다)', () => {
    const base = driveWorld(solo);
    const renamed = worldFrom(base, (s) => {
      const body = s.actors.find((a) => a.id === PLAYER)!;
      (body as unknown as { core: string }).core = 'c039-variant-core';
    });
    expect(bodyOf(state(renamed)).core).toBe('c039-variant-core');
    // 갈아 끼운 이름이 껐다 켜도 그대로다 — 저장되는 상태다
    expect(bodyOf(state(revive(renamed))).core).toBe('c039-variant-core');
  });

  it.todo(
    'GAP: 「눈보라 자락이 거는 상한 줄을 지운다」(규칙 8 ②의 뒷절)는 이 하네스로 놓을 수 없다 — 자락이 거는 상한은 그 방의 데이터(content/regions/frost-canyon.ts 의 area observeRange)에 있고, 이 Cycle 의 계약(BodyPropertyTables · WorldSetup.actorSources)에는 그 줄을 값으로 지우는 손잡이가 없다. 잴 수 있는 것은 때의 줄을 갈아 끼운 앞절까지다',
  );
});

// ─────────────────────────────────────────────────────────────────────
describe('명사 0 — 기반 코드는 어떤 몸도 성질도 이름으로 모른다 (규칙 9)', () => {
  it('① 성질 물음 · Source 합성 · 조건 평가기에 토끼도 떠도는 자도 체열도 눈보라도 HP 라는 글자도 없다 (grep 이 증거)', () => {
    const names = [
      ...Object.keys(CHARACTER_CATALOG),
      ...BODY_PROPERTY_NAMES,
      STATE_HP,
      STATE_CP,
      ASPECT_HEAT,
      BLIZZARD,
      FROST_CANYON,
      FROST_DEPTH_DOOR,
    ];
    const files = ['engine/world-authoring/property.ts', 'engine/world-authoring/condition.ts'];
    const hits: string[] = [];
    for (const file of files) {
      readFileSync(`${ROOT}${file}`, 'utf8')
        .split('\n')
        .forEach((text, index) => {
          for (const name of names) {
            // 낱말로 잰다 (c035 의 어법 그대로)
            if (new RegExp(`(^|[^A-Za-z0-9_\\-])${name}([^A-Za-z0-9_\\-]|$)`).test(text)) {
              hits.push(`${file}:${index + 1}  ${name}  │ ${text.trim()}`);
            }
          }
        });
    }
    // Given 검사가 헛돌지 않는다 — 이름이 살아도 되는 자리(데이터)에서는 걸린다
    const data = readFileSync(`${ROOT}content/world/semantic/character-catalog.ts`, 'utf8');
    expect(names.some((name) => data.includes(name))).toBe(true);
    // Then 기반의 두 파일 어디에도 한 자리도 없다
    expect(hits.join('\n')).toBe('');
  });

  it('② 변형 데이터로 성질 이름 하나를 더한다 (「무게」) → 같은 물음이 그것에도 답하고 같은 검사가 그 이름을 어휘에 센다', () => {
    // Given 그 몸에 「무게」를 답하는 Source 둘 (코드 diff 0 — 값만 짓는다)
    const w = driveWorld({
      ...solo,
      actorSources: [
        { origin: 'c039:weight-a', property: PROPERTY_WEIGHT, share: { kind: 'add', value: 12 } },
        { origin: 'c039:weight-b', property: PROPERTY_WEIGHT, share: { kind: 'add', value: 8 } },
      ],
    });
    const s = state(w);
    const body = bodyOf(s);
    // Then 같은 물음이 그것에도 답한다 — 앞의 규칙 전부가 그대로 든다
    expect(bodyProperty(s, body, PROPERTY_WEIGHT)).toBe(20); // 규칙 2 ① 더함은 합이다
    expect(propertySourcesOf(PROPERTY_WEIGHT, bodyPropertySources(s, body)).length).toBe(2);
    const plain = state(driveWorld(solo));
    expect(bodyProperty(plain, bodyOf(plain), PROPERTY_WEIGHT)).toBeUndefined(); // 규칙 2 ③ 없음
    // 그 이름을 어휘에 더하면 같은 검사가 그것을 센다 — 더하기 전에는 걸린다
    const leaf = actorLeaf(undefined, { kind: 'property', path: PROPERTY_WEIGHT }, '>=', 1);
    const site: CheckConditionSite = { where: 'c039:weight', condition: leaf };
    expect(conditionItemOf(withSite(site)).status).toBe('fail');
    expect(conditionItemOf(withVocabularyPath(withSite(site), PROPERTY_WEIGHT)).status).toBe('pass');
  });
});

// ─────────────────────────────────────────────────────────────────────
//
// 회귀 — 앞의 세계는 그대로다 (spec 규칙 10 · 원칙 8).
//
// 기준값은 **이 Cycle 이 들어가기 전의 세계**(C038)에서 그대로 읽어 온 것이다.

const HASH_BASELINE: Readonly<Record<string, string>> = {
  WHITE_KING_DOMAIN: '1c57fb5f',
  FOREST_EDGE: 'da66b8e9',
  FOREST_DEEP: 'b0cabbb8',
  EXPLORER_RUIN: 'a1cfb66b',
  PREDATOR_NEST: 'c9a53392',
  BIO_ORE_FIELD: 'f111570c',
  RED_EYE_TREE: '594e1d6d',
  TREE_INNER_WORLD: 'fed501ba',
  HEART_LAKE: 'dfb3a6cf',
  FANTASY_MAZE: '53ca6a70',
  MAZE_HEART: 'b9b77a14',
  ICE_CANYON: '5928ed79',
  FROST_CANYON: 'ba0afb9e',
};

/** 철 넷에서 문마다의 열림/잠김 — C038 의 값 그대로 (몸을 주지 않은 판정) */
const SEASONS = [STILL, 'SEEP', LONG_NIGHT, 'TURN'] as const;
const DOOR_BASELINE: Readonly<Record<string, readonly string[]>> = {
  MAZE_HEART_GATE: ['locked', 'locked', 'locked', 'locked'],
  WALKING_FOREST_DOOR: ['locked', 'locked', 'open', 'locked'],
};

describe('회귀 — 앞의 세계는 그대로다 (규칙 10)', () => {
  it('① 이 Cycle 이 들어갔다 → 변형 없음: 타격 · 달림 · 쓰러짐 · 추적 · 밤과 눈보라의 값 · 미로 심장 문 · 걷는 숲 문 · 방 열셋의 hash · 검사의 답이 C038 과 같다', () => {
    const BASIC = SKILL_DEFINITIONS.attack;
    // 타격 — 고정 피해
    const hit = driveWorld({ npcs: [{ id: 'npc-1', position: { x: 1.5, z: 0 }, wanderPath: [], perceptionRange: 0 }] });
    hit.dispatch({ interactionId: 'move', position: { x: 2, z: 0 } });
    hit.tick(TICK_INTERVAL);
    hit.dispatch({ interactionId: 'attack' });
    tickFor(hit, SWING_BEGIN * BASIC.baseDuration + 2 * TICK_INTERVAL);
    expect(bodyOf(state(hit), 'npc-1').hp).toBe(CHARACTER_CATALOG[WANDERER]!.resources.hpMax - BASIC.damage);

    // 달림의 소모 · 쓰러짐
    const run = driveWorld(solo);
    run.dispatch({ interactionId: 'set-attribute', attribute: { id: 'moveSpeed', value: 0.5 } });
    run.dispatch({ interactionId: 'move-mode', mode: 'run' });
    run.dispatch({ interactionId: 'move', position: { x: 18, z: 18 } });
    tickFor(run, 6.0);
    expect(hud(run.observe(), 'self.cp')).toBe(0);
    expect(hud(run.observe(), 'self.moveMode')).toBe('walk');
    const down = driveWorld({ npcs: [{ id: 'npc-1', position: { x: 3, z: 0 }, wanderPath: [], perceptionRange: 0 }] });
    down.dispatch({
      interactionId: 'set-attribute',
      targetEntityId: 'npc-1',
      attribute: { id: STATE_HP, value: 0 },
    });
    expect(entityOf(down.observe(), 'npc-1')?.state).toBe('downed');

    // 떠도는 자의 추적 거리 — 9 그대로
    expect(CHARACTER_CATALOG[WANDERER]!.perceptionRange).toBe(WANDERER_AWARENESS);
    // 밤과 눈보라의 관찰 범위 — 20 · (낮 20 · 밤 10) 그대로
    expect(OBSERVE_RANGE_NIGHT).toBe(NIGHT_AWARENESS_CAP);
    const blizzardOverlay = REGION_SPECS.find((spec) => spec.id === FROST_CANYON)!.phases!.standing!
      .hazardExtend!.find((entry) => entry.areaId === BLIZZARD)!;
    expect(blizzardOverlay.observeRange).toEqual({ day: BLIZZARD_DAY_CAP, night: BLIZZARD_NIGHT_CAP });

    // 미로 심장의 문 · 걷는 숲의 문 — 철 넷에서 답이 그대로다
    for (const [id, baseline] of Object.entries(DOOR_BASELINE)) {
      const answers = SEASONS.map((clock) => {
        const s = state(driveWorld({ ...solo, clock }));
        return isConnectorOpen(s.regionStates, id, s.time) ? 'open' : 'locked';
      });
      expect({ id, answers }).toEqual({ id, answers: [...baseline] });
    }

    // 방 열셋의 hash
    for (const spec of REGION_SPECS) {
      expect({ id: spec.id, hash: descriptionHash(spec.space) }).toEqual({
        id: spec.id,
        hash: HASH_BASELINE[spec.id],
      });
    }

    // 검사의 답 — ㊹ 이 한 값도 달라지지 않는다
    expect(conditionItemOf(worldCheckInput()).answer).toBe('자리 30 · 잎 31 · 걸린 것 0');
    expect(conditionItemOf(worldCheckInput()).status).toBe('pass');
  });

  it('② 이 Cycle 이 들어갔고 때가 긴 밤이며 몸이 빙결 심층 문 앞이다 → 그 문이 「잠김」이다 (이것 하나만 다르다)', () => {
    const at = connectorSpot(FROST_DEPTH_DOOR, FROST_CANYON);
    const w = standingIn(FROST_CANYON, at, { clock: LONG_NIGHT });
    const s = state(w);
    // C038 에서는 이 자리가 'open' 이었다 — 달라지는 것은 이 문 하나다
    expect(exitOf(w.observe(), FROST_DEPTH_DOOR)?.state).toBe('locked');
    // 같은 방의 다른 문은 그대로다
    for (const exit of w.observe().entities.filter((e) => e.role === 'region-exit')) {
      if (exit.id === FROST_DEPTH_DOOR) continue;
      expect({ id: exit.id, state: exit.state }).toEqual({
        id: exit.id,
        state: isConnectorOpen(s.regionStates, exit.id, s.time) ? 'open' : 'locked',
      });
    }
    // 다른 철에서도 그 문은 여전히 철 때문에 잠긴다 (C038 과 같은 답)
    for (const clock of SEASONS) {
      if (clock === LONG_NIGHT) continue;
      const other = standingIn(FROST_CANYON, at, { clock });
      expect({ clock, state: exitOf(other.observe(), FROST_DEPTH_DOOR)?.state }).toEqual({
        clock,
        state: 'locked',
      });
    }
  });

  it('③ 세계가 껐다 켜진다 → 변형 없음: 저장된 몸 상태가 그대로이고 유도되는 셋은 저장에 없다 · 옛 저장도 그대로 선다', () => {
    const w = driveWorld(solo);
    tickFor(w, 1.0);
    w.dispatch({ interactionId: 'set-attribute', attribute: { id: STATE_HP, value: 137 } });
    const before = bodyOf(state(w));
    const beforeMax = { hp: bodyMaxHp(state(w), before), cp: bodyMaxCp(state(w), before) };

    const revived = revive(w);
    const after = bodyOf(state(revived));
    expect(JSON.parse(JSON.stringify(after))).toEqual(JSON.parse(JSON.stringify(before)));
    // 유도되는 셋은 저장에 없다 — 되살린 몸에도 없고, 물으면 같은 답이다
    for (const field of ['hpMax', 'cpMax', 'perceptionRange', PROPERTY_MAX_HP, PROPERTY_MAX_CP, PROPERTY_AWARENESS]) {
      expect({ field, stored: field in after }).toEqual({ field, stored: false });
    }
    expect({ hp: bodyMaxHp(state(revived), after), cp: bodyMaxCp(state(revived), after) }).toEqual(beforeMax);

    // 옛 저장 — 최대값이 **필드로 든** 스냅샷을 되살려도 세계가 그대로 선다
    const legacy = throughFile(w.world.snapshot());
    const legacyState = legacy.state as WorldState;
    for (const actor of legacyState.actors) {
      const loose = actor as unknown as Record<string, unknown>;
      loose.hpMax = 999;
      loose.cpMax = 999;
      loose.perceptionRange = 999;
    }
    const restored = restoreWorld(legacy);
    expect(restored).not.toBeNull();
    const old = createWorld({}, restored!);
    old.join(OBSERVER);
    expect(() => old.tick(0)).not.toThrow();
    const oldState = old.snapshot().state as WorldState;
    const oldBody = oldState.actors.find((a) => a.id === PLAYER)!;
    // 옛 필드는 답을 한 값도 움직이지 못한다 — 유도가 저장을 이긴다
    expect(bodyMaxHp(oldState, oldBody)).toBe(RABBIT_MAX_HP);
    expect(bodyMaxCp(oldState, oldBody)).toBe(RABBIT_MAX_CP);
    expect(bodyAwareness(oldState, oldBody)).toBe(Infinity);
    expect(oldBody.hp).toBe(137);
    expect(oldBody.core).toEqual(before.core);
    // 그리고 세계는 계속 돈다
    for (let i = 0; i < 5; i++) old.tick(TICK_INTERVAL);
    expect(old.latestObservation(OBSERVER)).not.toBeNull();
  });
});
