// World Check — 검사 아홉을 독립 명령으로, 결과는 **기계가 읽는 JSON** (T1 ADDED).
//
//   npm run world:check              검사 스물둘을 돌리고 JSON 한 덩이를 낸다. fail 이 하나라도 있으면 종료 코드 1
//   npm run world:check -- --pretty  들여쓴 JSON (사람이 눈으로 볼 때)
//
// `world:observe --report` 안에만 있던 아홉을 뽑아 왔다. 뽑아 온 이유는 셋이다 —
// 다른 도구가 되읽을 수 있고(T3 의 생성기가 자기 산출을 스스로 검사한다), `npm test` 에 걸 수 있고,
// 컨텐츠 층이 검사를 더할 때(⑩~㉝) 붙을 자리가 하나로 정해진다.
//
// 판정은 기반이 한다 (engine/world-authoring/check.ts). 이 도구가 하는 일은 둘뿐이다:
// **게임 명사를 계약으로 건네는 것**과 **그 방을 어떻게 컴파일하는지 알려 주는 것**.
//
// 세계를 바꾸지 않는 읽기 전용 관찰이다 — 파일을 하나도 쓰지 않는다.

import { resolve } from 'node:path';
import {
  ANCHOR_LAYER,
  CITY_TAG,
  COMPILE_RULES,
  CONDITION_PREFIX,
  MATERIAL_SEEDS,
  REGION_GRAPH,
  REGION_SPECS,
  RESOURCE_FLOWS,
  RESOURCE_LAYER,
  SETTLEMENT_LAYER,
  START_REGION_ID,
  TRACE_LAYER,
} from '../../content/regions';
import {
  checkRegions,
  type CheckContract,
  type CheckEcology,
  type CheckEcologySource,
  type CheckRegion,
  type CheckReport,
} from '../../engine/world-authoring/check';
import { compileRegion } from '../../engine/world-authoring/compile';

// hazard · phenomenon 은 **이 세계에 아직 없어** 상수도 없다 (컨텐츠 층 주입의 것).
// 그래서 그 두 이름만 이 도구가 글자로 들고 있는다 — 검사가 무엇을 찾는지를 적어 두기 위해서다.
// 찾아서 하나도 없으면 검사는 통과가 아니라 `absent` 로 답한다 (기반이 그렇게 적는다).
const HAZARD_LAYER = 'hazard';
const PHENOMENON_LAYER = 'phenomenon';
/** ③ 사람이 사는 자리로 치는 태그 — city 만 상수가 있고 나머지 둘은 아직 이 세계에 없다 */
const SETTLEMENT_TAGS = [CITY_TAG, 'village', 'refuge'] as const;

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

/** 이 세계의 검사 스물둘을 돌린다 — 읽기 전용 (C014 CHANGED — 계통 열셋이 이어 붙는다) */
export function runWorldCheck(): CheckReport {
  return checkRegions({
    regions: WORLD_CHECK_REGIONS,
    graph: REGION_GRAPH,
    contract: WORLD_CHECK_CONTRACT,
    compile: (region) => compileRegion(region.space, COMPILE_RULES).world,
    ecology: WORLD_CHECK_ECOLOGY,
  });
}

export function renderCheckJson(report: CheckReport, pretty: boolean): string {
  return JSON.stringify(report, null, pretty ? 2 : 0);
}

function main(argv: readonly string[]): number {
  const unknown = argv.filter((arg) => arg !== '--pretty');
  if (unknown.length > 0) {
    process.stderr.write(
      [
        '  world:check — 검사 스물둘을 돌리고 JSON 을 낸다',
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
