// World Check — 검사 아홉을 독립 명령으로, 결과는 **기계가 읽는 JSON** (T1 ADDED).
//
//   npm run world:check              검사 서른다섯을 돌리고 JSON 한 덩이를 낸다. fail 이 하나라도 있으면 종료 코드 1
//   npm run world:check              검사 서른셋을 돌리고 JSON 한 덩이를 낸다. fail 이 하나라도 있으면 종료 코드 1
//   npm run world:check -- --pretty  들여쓴 JSON (사람이 눈으로 볼 때)
//
// `world:observe --report` 안에만 있던 아홉을 뽑아 왔다. 뽑아 온 이유는 셋이다 —
// 다른 도구가 되읽을 수 있고(T3 의 생성기가 자기 산출을 스스로 검사한다), `npm test` 에 걸 수 있고,
// 컨텐츠 층이 검사를 더할 때(⑩~㊷) 붙을 자리가 하나로 정해진다.
//
// 판정은 기반이 한다 (engine/world-authoring/check.ts). 이 도구가 하는 일은 둘뿐이다:
// **게임 명사를 계약으로 건네는 것**과 **그 방을 어떻게 컴파일하는지 알려 주는 것**.
//
// 세계를 바꾸지 않는 읽기 전용 관찰이다 — 파일을 하나도 쓰지 않는다.

import { resolve } from 'node:path';
import * as RegionsContent from '../../content/regions';
import {
  ANCHOR_LAYER,
  ANSWER_KINDS,
  ANSWER_KIND_ENVIRONMENT,
  ANSWER_SUPPORTS,
  CITY_TAG,
  COMPILE_RULES,
  CONDITION_PREFIX,
  LOCKS,
  LOCK_AT_AREA,
  LOCK_AT_CONNECTOR,
  MATERIAL_SEEDS,
  PRESENCE_LAYER,
  PROPERTY_ANSWERS,
  PROPERTY_ASPECTS,
  PROPERTY_RELATIONS,
  PROPERTY_TAG_SEPARATOR,
  REGION_GRAPH,
  REGION_RULE_IDS,
  REGION_SPECS,
  RESOURCE_FLOWS,
  RESOURCE_LAYER,
  SETTLEMENT_LAYER,
  START_REGION_ID,
  STATEMENT_KINDS,
  TRACE_LAYER,
  lockOfConnector,
  type SeasonId,
} from '../../content/regions';
import { LIFE_BOUND_RECOVERY_CAUSES } from '../../content/authoring/contracts';
import {
  checkRegions,
  type CheckAccess,
  type CheckContract,
  type CheckEcology,
  type CheckEcologySource,
  type CheckLife,
  type CheckLifeFormation,
  type CheckLifePopulation,
  type CheckLifeRecovery,
  type CheckMemory,
  type CheckMemoryRegion,
  type CheckRegion,
  type CheckRegionsInput,
  type CheckReport,
  type CheckTime,
  type CheckTimePhase,
  type CheckTimeRoute,
} from '../../engine/world-authoring/check';
// 수명 표는 세계가 소유한다 (content/world/semantic/persistence.ts) — 이 도구는 그것을
// 형만 바꿔 건넬 뿐이고, 표에서 빠진 State 필드를 잡는 것은 검사가 아니라 그쪽의 형이다.
import {
  ERASERS,
  PERSISTENCE_TABLE,
} from '../../content/world/semantic/persistence';
import { compileRegion } from '../../engine/world-authoring/compile';

// hazard · phenomenon 은 **이 세계에 아직 없어** 상수도 없다 (컨텐츠 층 주입의 것).
// 그래서 그 두 이름만 이 도구가 글자로 들고 있는다 — 검사가 무엇을 찾는지를 적어 두기 위해서다.
// 찾아서 하나도 없으면 검사는 통과가 아니라 `absent` 로 답한다 (기반이 그렇게 적는다).
const HAZARD_LAYER = 'hazard';
const PHENOMENON_LAYER = 'phenomenon';
/** ③ 사람이 사는 자리로 치는 태그 — city 만 상수가 있고 나머지 둘은 아직 이 세계에 없다 */
const SETTLEMENT_TAGS = [CITY_TAG, 'village', 'refuge'] as const;

/**
 * ⑩ ㉑ 자원 layer 에 서지만 원천이 아닌 것 — 이 세계의 **탄생지**들이다 (C022 ADDED).
 *
 * 방 차례 · 그 방 데이터 차례로 편다 (결정론). 하나도 없으면 빈 목록이고, 그때의 두 검사는
 * C021 까지와 한 값도 다르지 않다.
 */
const LIFE_SITE_TAGS = REGION_SPECS.flatMap((spec) =>
  (spec.ecology?.lifeFormation ?? []).map((site) => site.id),
);

/** 이 세계가 기반에 건네는 계약 — 게임 명사는 전부 여기서 간다 */
export const WORLD_CHECK_CONTRACT: CheckContract = {
  anchorLayer: ANCHOR_LAYER,
  resourceLayer: RESOURCE_LAYER,
  hazardLayer: HAZARD_LAYER,
  phenomenonLayer: PHENOMENON_LAYER,
  settlementLayer: SETTLEMENT_LAYER,
  settlementTags: SETTLEMENT_TAGS,
  conditionPrefix: CONDITION_PREFIX,
  traceLayer: TRACE_LAYER,
  lifeSiteTags: LIFE_SITE_TAGS,
  startRegion: START_REGION_ID,
};

/**
 * 이 세계의 **재료 계통**을 기반에 건네는 자리 (C014 ADDED — 검사 ⑩~㉒ 가 이것을 읽는다).
 *
 * 여기서 세는 것이 없다 — content/regions 의 데이터를 형만 바꿔 옮긴다. 판정은 전부 기반의
 * 것이고, 이 도구는 "이 세계에서 무엇이 재료이고 무엇이 원천인가" 를 말할 뿐이다.
 *
 * 두 값이 이 세계의 답으로 고정된다 (Play 확정 1):
 *   renewable  **참** — 이 세계의 원천은 전부 되돌아온다. 되돌아오지 않는 원천이 없으므로
 *              검사 ⑭ 는 일곱 전부에 원인을 묻는다
 *   finite     **거짓** · depletionConsequence 는 빈 글자 — 이 Play 는 유한 원천
 *              (FINITE_WORLD_STATE)을 쓰지 않는다. 그래서 검사 ⑮ 는 잴 것이 없어 absent 이고,
 *              그것을 통과로 적지 않는 것이 옳다 (spec SPEC-007 경계 ②)
 *
 * 흔적은 그 원천의 **마디마다의 둘레 op** 다 (C013 의 traceOps) — 방 바닥에 깔린 흔적은
 * 어느 원천의 것도 아니므로 여기 실리지 않는다.
 */
export const WORLD_CHECK_ECOLOGY: CheckEcology = {
  materials: MATERIAL_SEEDS.map((seed) => ({ id: seed.id, worldCause: seed.worldCause })),
  sources: REGION_SPECS.flatMap((spec) =>
    (spec.resourceEcology?.sources ?? []).map(
      (source): CheckEcologySource => ({
        id: source.id,
        region: spec.id,
        materialId: source.materialId,
        worldCause: source.worldCause,
        supply: source.supply,
        renewable: true,
        recoveryCause: source.recoveryCause,
        finite: false,
        depletionConsequence: '',
        traces: source.traceOps ?? [],
        opportunity: source.opportunity,
        carrier: source.carrier,
      }),
    ),
  ),
  flows: RESOURCE_FLOWS.map((flow) => ({
    id: flow.id,
    materialId: flow.materialId,
    from: { region: flow.from.regionId, source: flow.from.sourceId },
    to: { region: flow.to.regionId, source: flow.to.sourceId },
    connector: flow.connectorId,
  })),
  // 이 계통이 **다룬다고 밝힌** 방 — resourceEcology 를 적은 방이다 (기본형 ⑥).
  // 원천 없이 밝힌 방(백왕령)만 이유를 지고, 원천이 있는 방은 스스로 낳으므로 빈 글자다.
  regions: REGION_SPECS.filter((spec) => spec.resourceEcology).map((spec) => ({
    id: spec.id,
    isolationReason: spec.resourceEcology?.isolationReason ?? '',
  })),
};

// ── 시간 쪽 계약 (C018 ADDED — 검사 ㉓~㉖ 이 이것을 읽는다) ──────────
//
// 계통(WORLD_CHECK_ECOLOGY)과 같은 어법이다 — 여기서 판정하는 것이 하나도 없고
// content/regions 의 데이터를 형만 바꿔 옮긴다. 다른 것은 하나다: **철과 낮밤의 어휘**를
// 함께 건넨다. 기반은 이 세계에 철이 넷이라는 것도 그 이름도 알지 못하기 때문이다
// (L2-World-Time 원칙 T1 · T4).

/**
 * 이 세계의 철 어휘 — `SeasonId` 의 값 목록.
 *
 * 손으로 적는 이유는 하나다: `phases.ts` 의 `SeasonId` 는 **형**이라 실행 때 목록이 없다.
 * 그래서 여기가 그 유일한 실행 값이고, `SeasonId[]` 로 못 박아 두어 철이 하나 늘면 이 줄이
 * 컴파일에서 걸린다 — 어휘가 두 곳으로 갈라지지 않게 하는 자리다.
 *
 * `observe --at` 도 이것을 읽는다 — 도구 둘이 철의 목록을 따로 들면 하나가 늦는 날이 온다.
 */
export const SEASON_IDS: readonly SeasonId[] = ['STILL', 'SEEP', 'LONG_NIGHT', 'TURN'];

/**
 * 이 세계의 낮밤 어휘 — 원본은 관찰 계약(content/protocol 의 WorldClockView.dayPhase)이다.
 * 이 도구는 `content/regions` 만 읽으므로(그 폴더가 world·view 와 갈라져 있는 규율 그대로)
 * 두 글자를 여기 적는다. hazard · phenomenon layer 이름을 이 파일이 들고 있는 것과 같은 어법.
 */
const DAY_PHASE_IDS = ['DAY', 'NIGHT'] as const;

/**
 * 컨텐츠가 밝힌 경로 하나의 형 — W 레인이 `content/regions` 에 두는 `PRESENCE_ROUTES` 의 원소.
 *
 * 이 도구가 그 형을 **되적는** 이유: 경로 데이터는 세계 쪽에서 서는 것이고, 이 도구는
 * 그것이 아직 없어도 서른다섯을 다 돌려야 한다. 그래서 이름째로 골라 읽고(아래
 * `presenceRoutes`) 읽은 것을 기반의 `CheckTimeRoute` 로 옮긴다.
 *
 * 골라 읽는 대가로 **형이 어긋나도 컴파일이 잡지 못한다** — 그때는 검사 ㉔ 가 끊긴 참조로
 * 드러낸다 (마디의 방이 없다 · 그 선이 없다). 잡히지 않고 조용히 빠지는 자리는 없다.
 */
interface ContentPresenceRoute {
  id: string;
  presence: string;
  /** 마디 차례 — 마디 하나는 후보 { 방 · 그 방에서 지나는 선의 tag } 들 */
  nodes: readonly (readonly { region: string; curve: string }[])[];
  schedule: { seasons?: readonly SeasonId[]; dayPhase?: string; everyNCycles: number };
  effectWhilePassing?: {
    hazardExtend?: readonly { areaId: string; hazard: string }[];
    disturbancePerSecond?: number;
  };
  leavesBehind?: readonly string[];
}

/**
 * 세계에 선 경로들 — 아직 없으면 빈 배열이다.
 *
 * `import { PRESENCE_ROUTES }` 로 적으면 그 이름이 서기 전까지 이 도구가 통째로 깨진다.
 * 그래서 문(門)을 통째로 받아 이름 하나를 골라 읽는다 — 없으면 검사 ㉔ 가 `absent` 로 답하고,
 * 그것은 통과가 아니다 (기반이 그렇게 적는다).
 */
const presenceRoutes: readonly ContentPresenceRoute[] =
  (RegionsContent as { PRESENCE_ROUTES?: readonly ContentPresenceRoute[] }).PRESENCE_ROUTES ?? [];

/**
 * 지나는 동안 거는 덧씌움이 **어느 방의 것인가**.
 *
 * 컨텐츠의 `hazardExtend` 는 area op id 만 밝힌다 — 그 자락이 어느 방에 있는지는 경로가
 * 지나는 방들 가운데 **그 op 를 실제로 가진 방**이다. 하나도 없으면 첫 마디의 첫 후보로
 * 적는다: 그래야 끊긴 참조가 ㉔ 에서 방 이름과 함께 드러난다 (조용히 빠지지 않는다).
 */
function areaRegionOf(route: ContentPresenceRoute, areaId: string): string {
  for (const node of route.nodes) {
    for (const candidate of node) {
      const spec = REGION_SPECS.find((it) => it.id === candidate.region);
      if (spec?.space.ops.some((op) => op.id === areaId)) return candidate.region;
    }
  }
  return route.nodes[0]?.[0]?.region ?? '';
}

/** 이 세계의 시간 쪽 계약 — 철별 덧씌움 · 경로 · 철 조건 문 · 철 조건 원천 */
export const WORLD_CHECK_TIME: CheckTime = {
  seasons: SEASON_IDS,
  dayPhases: DAY_PHASE_IDS,
  presenceLayer: PRESENCE_LAYER,
  // 방 차례 · 철 어휘 차례로 편다 — Record 의 열쇠 순회에 기대지 않는다 (두 번 돌리면 같다)
  phases: REGION_SPECS.flatMap((spec) =>
    SEASON_IDS.flatMap((season): CheckTimePhase[] => {
      const phase = spec.phases?.seasons?.[season];
      if (!phase) return [];
      return [
        {
          region: spec.id,
          season,
          depthAreaIds: (phase.depthOverlay ?? []).map((overlay) => overlay.areaId),
          hazardAreaIds: (phase.hazardExtend ?? []).map((overlay) => overlay.areaId),
        },
      ];
    }),
  ),
  routes: presenceRoutes.map(
    (route): CheckTimeRoute => ({
      id: route.id,
      presence: route.presence,
      nodes: route.nodes,
      seasons: route.schedule.seasons ?? [],
      dayPhase: route.schedule.dayPhase,
      everyNCycles: route.schedule.everyNCycles,
      effectAreas: (route.effectWhilePassing?.hazardExtend ?? []).map((overlay) => ({
        region: areaRegionOf(route, overlay.areaId),
        areaId: overlay.areaId,
      })),
      leaves: route.leavesBehind ?? [],
    }),
  ),
  // 철 조건을 밝힌 문 — 그 문에 걸린 Lock 이 time 을 밝힌 것만 (C029 CHANGED — 읽는 자리가
  // 활성 표에서 Lock 으로 바뀌었고 답은 그대로다). 차례는 connectors 배열 순서다
  seasonalConnectors: REGION_GRAPH.connectors.flatMap((connector) => {
    const seasons = lockOfConnector(connector.id)?.requires.find((one) => one.time)?.time?.seasons;
    if (!seasons) return [];
    return [{ id: connector.id, from: connector.from.region, to: connector.to.region, seasons }];
  }),
  // 철 조건을 밝힌 원천 — occurrence 를 적은 것만
  seasonalSources: REGION_SPECS.flatMap((spec) =>
    (spec.resourceEcology?.sources ?? []).flatMap((source) =>
      source.occurrence ? [{ id: source.id, region: spec.id, seasons: source.occurrence.seasons }] : [],
    ),
  ),
  // 세계에 있는 원천 전부 — ㉔ 가 "남기는 것" 이 아는 원천인지 여기서 본다
  sourceIds: REGION_SPECS.flatMap((spec) =>
    (spec.resourceEcology?.sources ?? []).map((source) => source.id),
  ),
};

// ── 생명 쪽 계약 (C022 ADDED — 검사 ㉗~㉝ 이 이것을 읽는다) ──────────
//
// 계통(WORLD_CHECK_ECOLOGY) · 시간(WORLD_CHECK_TIME)과 같은 어법이다 — 여기서 판정하는 것이
// 하나도 없고 content/regions 의 데이터를 형만 바꿔 옮긴다. 게임 명사는 전부 여기서 간다:
// 기반은 이 세계에 광식충이 있다는 것도, 어느 회복 원인이 살아 있는 것을 전제하는지도 알지
// 못한다 (Life F13 · R13).

/** 이 세계의 생명 계통 — 탄생지 · 개체군 · 관계 · 생명을 전제하는 회복 원인 */
export const WORLD_CHECK_LIFE: CheckLife = {
  // 방 차례 · 그 방 데이터 차례로 편다 (결정론)
  formations: REGION_SPECS.flatMap((spec) =>
    (spec.ecology?.lifeFormation ?? []).map(
      (site): CheckLifeFormation => ({
        id: site.id,
        region: spec.id,
        mode: site.mode,
        worldCause: site.worldCause,
        regionRule: site.condition.regionRule,
        sourceMaterialIds: site.source.materials,
        sourceStateCodes: site.source.states,
        // 요구의 갈래 셋 가운데 **가리키는 것이 있는** 둘만 참조로 편다 —
        // 비(rain)는 세계 상태이지 원천도 개체군도 아니므로 잴 것이 없다
        requiredSourceIds: site.condition.requires.flatMap((requirement) =>
          requirement.kind === 'source-available' ? [requirement.sourceId] : [],
        ),
        // C023 CHANGED — 개체군을 가리키는 갈래가 **둘**이다 (결속의 "이하" · 계승의 "이상").
        // 둘 다 실어야 ㉗ 이 끊긴 참조를 잡는다 — 갈래 하나를 빠뜨리면 세계에 없는 개체군을
        // 가리킨 계승이 검사를 그냥 지나간다
        requiredPopulationIds: site.condition.requires.flatMap((requirement) =>
          requirement.kind === 'population-at-most' || requirement.kind === 'population-at-least'
            ? [requirement.populationId]
            : [],
        ),
        consumesSourceIds: site.consumes,
        // 흔적의 op id 들 — C023 CHANGED: 태어난 **뒤**의 것(traces.after)도 함께 편다.
        // C022 가 비워 둔 이유(그 방 Description 에 아직 그 자락이 없다)가 사라졌기 때문이다:
        // 이제 세계가 그것을 실제로 세우므로 ㉗ 이 "그 op 이 그 방에 있는가" 를 재야 한다.
        // ㉙("전조 없는 탄생")은 이 목록이 비었는가를 보므로, 뒤의 것만 가진 탄생지는
        // 그 검사를 지나가게 된다 — 지금 세계의 탄생지 둘은 다 전조를 가진다
        traceOpIds: [...site.traces.before.map((trace) => trace.op), ...site.traces.after],
        population: site.population,
      }),
    ),
  ),
  populations: REGION_SPECS.flatMap((spec) =>
    (spec.ecology?.populations ?? []).map(
      (population): CheckLifePopulation => ({ id: population.id, region: spec.id }),
    ),
  ),
  // 개체군 사이의 관계는 이 세계에 아직 하나도 없다 — ㉜ 는 잴 것이 없어 `absent` 이고,
  // 그것을 통과로 적지 않는 것이 옳다 (spec SPEC-008 경계 ① · 검사 ⑮ 의 선례). C025 가 세운다
  links: [],
  // 회복 원인이 **살아 있는 것을 전제하는** 원천들 — 어느 코드가 그런지는 계약이 고른다
  // (content/authoring/contracts.ts). 밝히지 않은 원천은 그 목록에 들지 않으므로 ㉛ 의
  // 대상이 아니고, 밝힌 원천이 개체군을 비워 두면 그것이 결손이다 (SPEC-008 경계 ②)
  lifeRecoveries: REGION_SPECS.flatMap((spec) =>
    (spec.resourceEcology?.sources ?? []).flatMap((source): CheckLifeRecovery[] =>
      LIFE_BOUND_RECOVERY_CAUSES.includes(source.recoveryCause)
        ? [
            {
              sourceId: source.id,
              recoveryCause: source.recoveryCause,
              population: source.recoveryLife ?? '',
            },
          ]
        : [],
    ),
  ),
  regionRules: REGION_RULE_IDS,
  // **잔류 원천** — 무언가가 남기고 간 것을 지는 원천들이다 (carrier 가 residue).
  // LEAVES 의 끝이 이것이어야 한다는 것이 ㉜ 의 물음이고, 무엇이 잔류인지는 세계가 답한다
  residueSourceIds: REGION_SPECS.flatMap((spec) =>
    (spec.resourceEcology?.sources ?? []).flatMap((source) =>
      source.carrier === 'residue' ? [source.id] : [],
    ),
  ),
};

/**
 * 이 세계의 **요구와 가능성**을 기반에 건네는 자리 (C029 ADDED — 검사 ㉞~㊷ 가 이것을 읽는다).
 *
 * 계통(WORLD_CHECK_ECOLOGY) · 시간(WORLD_CHECK_TIME)과 **같은 어법**이다 — 여기서 판정하는
 * 것이 하나도 없고 `content/regions` 의 데이터를 형만 바꿔 옮긴다. 기반은 heat 도 문도 재료도
 * 알지 못하므로, 이 세계가 **어휘와 글자**를 함께 건넨다 (축 · 관계 · 잇는 글자 · 문장 다섯 항 ·
 * 답의 종류 여섯 · SUPPORTS 라는 글자 · Lock 이 매달리는 자리의 갈래 둘).
 *
 * 요구의 `kind` 도 컨텐츠가 정하는 글자다 — 'property' | 'time' | 'state' | 'knowledge'.
 * 한 요구가 갈래를 여럿 밝히면 밝힌 만큼 줄이 난다 (지금 데이터에는 그런 요구가 없다).
 *
 * 차례는 전부 데이터의 배열 순서다 (방 차례 · 그 방이 적은 Lock 차례 · Seed 표 차례) —
 * 두 번 돌리면 글자까지 같다.
 */
export const WORLD_CHECK_ACCESS: CheckAccess = {
  aspects: PROPERTY_ASPECTS.map((aspect) => aspect.id),
  relations: PROPERTY_RELATIONS.map((relation) => relation.id),
  tagSeparator: PROPERTY_TAG_SEPARATOR,
  statementKinds: [...STATEMENT_KINDS],
  answerKinds: [...ANSWER_KINDS],
  supportKind: ANSWER_SUPPORTS,
  connectorLockKind: LOCK_AT_CONNECTOR,
  areaLockKind: LOCK_AT_AREA,
  answers: PROPERTY_ANSWERS.map((answer) => ({
    requirement: answer.requirement,
    property: answer.property,
    kind: answer.kind,
  })),
  locks: LOCKS.map((lock) => ({
    id: lock.id,
    region: lock.region,
    at: { kind: lock.at.kind, ref: lock.at.ref },
    important: lock.important ?? false,
    // 밝힌 갈래마다 한 줄 — 성질을 밝힌 줄만 태그를 진다 (나머지는 갈래의 이름뿐이다)
    requires: lock.requires.flatMap((requirement) => {
      const out: { property?: string; kind: string }[] = [];
      if (requirement.property !== undefined) {
        out.push({ property: requirement.property, kind: 'property' });
      }
      if (requirement.time !== undefined) out.push({ kind: 'time' });
      if (requirement.state !== undefined) out.push({ kind: 'state' });
      if (requirement.knowledge !== undefined) out.push({ kind: 'knowledge' });
      return out;
    }),
    traces: lock.traces.map((trace) => trace.op),
    // 그 Lock 을 **무르게 하는 것들** (C031 ADDED) — 자락 하나가 한 줄이다. 밝히지 않은 Lock 은
    // 빈 목록이고, 그 자리의 답은 C030 까지와 한 값도 다르지 않다.
    //
    // 종류는 **환경**이다 — 무르게 하는 것이 몸이 지고 오는 재료가 아니라 그 방이 이미 가진
    // 자락이기 때문이고, 그 이름은 답의 종류 여섯(ANSWER_KINDS) 가운데 하나를 그대로 쓴다.
    // `ref` 는 그 자락의 op id 다 (데이터가 가리킨 글자 그대로).
    //
    // **여기서 판정하는 것이 하나도 없다** — 무엇이 답이 되는가도 · 답이 몇 종류인가도 기반이
    // 센다 (계통·시간 계약과 같은 어법 · 형만 옮긴다).
    relaxations: (lock.relaxedBy ?? []).map((relaxation) => ({
      kind: ANSWER_KIND_ENVIRONMENT,
      ref: relaxation.area,
    })),
  })),
  // 재료 Seed 와 그 성질 — 성질을 밝히지 않은 Seed 는 빈 목록이다 (고래 비늘이 그렇다).
  // 지금 답의 종류는 재료 하나뿐이다 (생명 · 환경 · 주체 · 지식은 뒤 층의 것 — ANSWER_KINDS 의 첫째)
  seeds: MATERIAL_SEEDS.map((seed) => ({
    id: seed.id,
    answerKind: ANSWER_KINDS[0] ?? '',
    properties: (seed.properties ?? []).map((property) => ({
      tag: property.tag,
      from: property.from,
    })),
  })),
  // 그 Seed 를 내는 원천이 어느 방에 서 있는가 — ㉟ 이 "그 Lock 을 지나지 않고 닿는가" 를
  // 여기서 읽는다. 방 차례 · 그 방의 원천 차례다
  seedSources: REGION_SPECS.flatMap((spec) =>
    (spec.resourceEcology?.sources ?? []).map((source) => ({
      seed: source.materialId,
      region: spec.id,
      source: source.id,
    })),
  ),
};

// ── 기억 쪽 계약 (C034 ADDED — 검사 ㊸ ㊼ 가 이것을 읽는다) ──────────
//
// 계통(WORLD_CHECK_ECOLOGY) · 시간(WORLD_CHECK_TIME)과 **같은 어법**이다 — 여기서 판정하는
// 것이 하나도 없고 데이터를 형만 바꿔 옮긴다. 기반은 이 세계의 원천도 경로도 알지 못하고,
// State 에 어떤 필드가 있는지도 알지 못한다 (그것은 형이지 데이터가 아니다).

/** 이 세계의 기억 쪽 계약 — 방마다 셀 수 있는 열쇠들 · State 경로마다 지우는 손 */
export const WORLD_CHECK_MEMORY: CheckMemory = {
  // 방 차례 · 그 방 데이터 차례 · 경로 데이터 차례로 편다 (결정론)
  regions: REGION_SPECS.map(
    (spec): CheckMemoryRegion => ({
      id: spec.id,
      // 그 방의 원천 — 캔 적 있는 것만 실제로 셈을 가지지만, 열쇠가 될 수 있는 것은 이 전부다
      sources: (spec.resourceEcology?.sources ?? []).map((source) => source.id),
      // 그 방을 지나는 경로 — 마디의 후보에 그 방이 한 번이라도 든 경로들이다.
      // 휨(bend)은 후보 가운데 하나를 고르는 것이므로, 후보에 든 방은 지날 수 있는 방이다
      routes: presenceRoutes
        .filter((route) => route.nodes.some((node) => node.some((it) => it.region === spec.id)))
        .map((route) => route.id),
    }),
  ),
  // 수명 표 — 세계가 소유한 그 표를 줄마다 그대로 옮긴다 (여기서 짓는 줄이 하나도 없다)
  persistence: PERSISTENCE_TABLE.map((row) => ({ path: row.path, eraser: row.eraser })),
  erasers: [...ERASERS],
};

/**
 * 컨텐츠의 RegionSpec → 검사가 보는 방. `coreRules` 는 이 세계의 세는 법이다 —
 * 지금 한 방은 규칙을 하나까지 품는다 (RegionSpec.rule 하나). 그 형이 늘면 이 줄이 늘어난다.
 */
export const WORLD_CHECK_REGIONS: readonly CheckRegion[] = REGION_SPECS.map((spec) => ({
  id: spec.id,
  depth: spec.depth,
  space: spec.space,
  coreRules: spec.rule ? 1 : 0,
}));

/**
 * 이 세계가 기반에 건네는 입력 한 덩이 (C030 ADDED).
 *
 * 위의 계약 넷을 한 값으로 묶은 것이고 **새로 정하는 것이 하나도 없다** — 검사와
 * 열쇠 × 자물쇠 표(accessAnswerMap)가 **같은 입력**을 받아야 두 도구의 답이 갈리지 않기
 * 때문이다 (spec R4 경계 ②). 부르는 쪽마다 따로 엮으면 하나가 늦는 날이 온다.
 */
export function worldCheckInput(): CheckRegionsInput {
  return {
    regions: WORLD_CHECK_REGIONS,
    graph: REGION_GRAPH,
    contract: WORLD_CHECK_CONTRACT,
    compile: (region) => compileRegion(region.space, COMPILE_RULES).world,
    ecology: WORLD_CHECK_ECOLOGY,
    time: WORLD_CHECK_TIME,
    life: WORLD_CHECK_LIFE,
    access: WORLD_CHECK_ACCESS,
    memory: WORLD_CHECK_MEMORY,
  };
}

/**
 * 이 세계의 검사 마흔둘을 돌린다 — 읽기 전용
 * (C022 CHANGED — 생명 일곱 · C029 CHANGED — 요구와 가능성 아홉이 이어 붙는다).
 */
export function runWorldCheck(): CheckReport {
  return checkRegions(worldCheckInput());
}

export function renderCheckJson(report: CheckReport, pretty: boolean): string {
  return JSON.stringify(report, null, pretty ? 2 : 0);
}

function main(argv: readonly string[]): number {
  const unknown = argv.filter((arg) => arg !== '--pretty');
  if (unknown.length > 0) {
    process.stderr.write(
      [
        '  world:check — 검사 서른다섯을 돌리고 JSON 을 낸다',
        '  world:check — 검사 서른셋을 돌리고 JSON 을 낸다',
        `    모르는 인자: ${unknown.join(' ')}`,
        '    쓸 수 있는 것: --pretty',
        '',
      ].join('\n'),
    );
    return 2;
  }
  const report = runWorldCheck();
  process.stdout.write(`${renderCheckJson(report, argv.includes('--pretty'))}\n`);
  return report.ok ? 0 : 1;
}

// tsx 로 직접 돌렸을 때만 실행한다 — 테스트가 import 해도 아무 일이 없어야 한다
// (world:compile 과 같은 판정법이다)
if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
  process.exitCode = main(process.argv.slice(2));
}
