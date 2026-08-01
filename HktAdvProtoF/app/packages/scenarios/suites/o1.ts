// O1 검증 시나리오 3종 — 원문의 모든 개념이 12타입으로 적히는가, 그리고 아닌 것은 걸리는가.

import {
  assertOntic,
  checkCoverage,
  classify,
  CONCEPT_CATALOG,
  countByKind,
  coverageReport,
  coverageVerdict,
  implementedKinds,
  isOntologyComplete,
  ONTOLOGY_KINDS,
  provenanceGaps,
  type ConceptEntry,
} from '@hkt/core/o1';

import {
  defineScenario,
  expectDeterministic,
  expectRejected,
  expectState,
  expectTrue,
  type Assertion,
} from '../src/index.ts';

import {
  accessPath,
  BROKEN_NODES,
  foodNeed,
  forageWay,
  healingClaim,
  HUNTER_SCENE,
  rustle,
  toxin,
} from './o1-hunter-scene.ts';

/** 위반을 `사유 경로` 한 줄로 접는다 — 기대와 실제를 같은 모양으로 비교하려고. */
function reasons(value: unknown): string[] {
  return classify(value).violations.map((violation) => `${violation.rule} ${violation.path}`);
}

/** 정상 — 한 장면이 12타입만으로 적히고, 원문 개념 전부가 그 타입들로 덮인다. */
export const o1CatalogCovered = defineScenario({
  id: 'o1-catalog-covered',
  module: 'O1',
  kind: 'normal',
  purpose: '붉은 장막 사냥꾼 한 컷이 12타입만으로 적히고, 원문 개념 전부가 그 타입들로 덮인다.',
  arrange: () => ({ scene: HUNTER_SCENE, catalog: CONCEPT_CATALOG }),
  act: ({ scene }) => {
    const counts = countByKind(scene);
    return {
      classified: scene.map((node) => classify(node).kind),
      declared: scene.map((node) => node.kind),
      kindsPresent: ONTOLOGY_KINDS.filter((kind) => counts[kind] > 0),
      report: coverageReport(),
      gaps: provenanceGaps(accessPath, [forageWay], [foodNeed]),
      implemented: implementedKinds(),
    };
  },
  assert: (result): Assertion[] => [
    expectState('장면의 원소가 전부 스스로 밝힌 타입으로 분류된다', result.declared, result.classified),
    expectState('12타입이 모두 한 장면 안에 등장한다', [...ONTOLOGY_KINDS], [...result.kindsPresent]),
    expectState('12타입 모두 필드까지 정의됐다', [...ONTOLOGY_KINDS], [...result.implemented]),
    expectTrue('존재론이 완결됐다', isOntologyComplete()),
    expectState(
      `원문 개념 ${String(result.report.total)}종이 전부 덮인다`,
      result.report.total,
      result.report.covered,
    ),
    expectState('미분류 개념이 없다', [], [...result.report.unmapped]),
    expectState('아무 개념도 쓰지 않는 타입이 없다', [], [...result.report.unusedKinds]),
    expectTrue('커버리지 완결', result.report.complete, coverageVerdict(result.report)),
    expectState('요구 → 가능성 → 의존 근거 사슬이 이어진다', [], [...result.gaps]),
    expectTrue(
      '실제 상태와 주체의 믿음은 어긋나도 둘 다 온전한 원소다',
      classify(toxin).kind === 'State' &&
        classify(healingClaim).kind === 'Claim' &&
        healingClaim.assertion !== String(toxin.value),
      { 실제: toxin.value, 믿음: healingClaim.assertion },
    ),
    expectDeterministic('같은 장면이면 같은 커버리지 보고서', () => coverageReport()),
  ],
});

/** 실패 — 타입 없는 개념과 계약을 어긴 값이 각각의 사유·경로로 지목된다. */
export const o1UnmappedRejected = defineScenario({
  id: 'o1-unmapped-rejected',
  module: 'O1',
  kind: 'failure',
  purpose: '12타입으로 적을 수 없는 개념과 계약을 어긴 값이 사유·경로와 함께 지목된다.',
  arrange: (): { readonly catalog: readonly ConceptEntry[] } => ({
    catalog: [
      ...CONCEPT_CATALOG,
      {
        id: 'nameless-thing',
        concept: '어느 타입으로도 적히지 않는 무엇',
        source: 'MasterPlan §0',
        kinds: [],
        note: '환원 방법을 아직 모른다',
      },
    ],
  }),
  act: ({ catalog }) => ({
    report: checkCoverage(catalog, implementedKinds()),
    // 결함 원소 8종 — 각자 어긴 조항이 다르다.
    broken: BROKEN_NODES.map((node) => ({
      broke: node.broke,
      expected: node.expected,
      actual: reasons(node.value)[0] ?? '(통과해 버렸다)',
    })),
  }),
  assert: (result): Assertion[] => [
    expectState('타입 없는 개념이 미분류로 지목된다', ['nameless-thing'], [...result.report.unmapped]),
    expectTrue('미분류가 하나라도 있으면 완결이 아니다', !result.report.complete),
    expectTrue(
      '판정 문장이 무엇이 빠졌는지 말해 준다',
      coverageVerdict(result.report).includes('nameless-thing'),
      coverageVerdict(result.report),
    ),
    expectState(
      '결함 원소 8종이 각자의 사유·경로로 걸린다',
      result.broken.map((entry) => `${entry.broke} → ${entry.expected}`),
      result.broken.map((entry) => `${entry.broke} → ${entry.actual}`),
    ),
    expectTrue(
      '결함 원소는 하나도 분류되지 않는다',
      BROKEN_NODES.every((node) => classify(node.value).kind === null),
    ),
    expectRejected(
      'assertOntic 는 조립 지점에서 사유를 모아 던진다',
      () => assertOntic(BROKEN_NODES[0]?.value),
      /존재론 원소가 아니다/,
    ),
  ],
});

/** 경계 — 빈 카탈로그·직렬화 불가·확장 필드·수치 양끝에서도 판정이 흔들리지 않는다. */
export const o1Boundary = defineScenario({
  id: 'o1-boundary',
  module: 'O1',
  kind: 'boundary',
  purpose: '빈 카탈로그·직렬화 불가 값·확장 필드·수치 양끝에서도 판정이 흔들리지 않는다.',
  arrange: () => ({ empty: [] as readonly ConceptEntry[] }),
  act: ({ empty }) => {
    const emptyReport = checkCoverage(empty, implementedKinds());
    const duplicate = checkCoverage(
      [CONCEPT_CATALOG[0] as ConceptEntry, CONCEPT_CATALOG[0] as ConceptEntry],
      implementedKinds(),
    );
    const cyclic: Record<string, unknown> = { ...healingClaim };
    cyclic['self'] = cyclic;
    return {
      emptyComplete: emptyReport.complete,
      emptyUnused: emptyReport.unusedKinds.length,
      emptyVerdict: coverageVerdict(emptyReport),
      duplicateIds: [...duplicate.duplicateIds],
      cyclicReasons: reasons(cyclic),
      // 나중 계층(S0·D1)이 필드를 더해도 같은 타입이어야 한다.
      extendedKind: classify({ ...healingClaim, beliefGraphId: 'belief:abc' }).kind,
      // 수치의 양끝 — 0 과 1 은 통과하고, 그 밖은 걸린다.
      zeroIntensity: classify({ ...rustle, intensity: 0 }).kind,
      fullConfidence: classify({ ...healingClaim, confidence: 1 }).kind,
      zeroSubstitutability: classify({ ...foodNeed, substitutability: 0 }).kind,
      zeroStrength: reasons({ ...foodNeed, strength: 0 }),
      emptyAtoms: reasons({ ...forageWay, atoms: [] }),
      notARecord: reasons([healingClaim]),
      noKind: reasons({ id: healingClaim.id }),
    };
  },
  assert: (result): Assertion[] => [
    expectTrue('빈 카탈로그는 완결이 아니다 — 아무것도 확인하지 않은 것이다', !result.emptyComplete),
    expectState('빈 카탈로그에서는 12타입 전부가 미사용으로 남는다', 12, result.emptyUnused),
    expectTrue('빈 카탈로그의 사유가 화면에 남는다', result.emptyVerdict.includes('비었다'), result.emptyVerdict),
    expectState('같은 개념을 두 번 등록하면 중복으로 걸린다', 1, result.duplicateIds.length),
    expectState('순환 참조는 직렬화 불가로 걸린다', ['not-serializable $'], result.cyclicReasons),
    expectState('나중 계층이 필드를 더해도 같은 타입이다', 'Claim', result.extendedKind),
    expectState('세기 0 은 통과한다 — 감지되지 않는 현상도 현상이다', 'Phenomenon', result.zeroIntensity),
    expectState('확신 1 은 통과한다 — 확신은 진실성이 아니다', 'Claim', result.fullConfidence),
    expectState('대체 불가(0) 는 통과한다', 'Dependency', result.zeroSubstitutability),
    expectState('강도 0 은 의존이 아니다', ['bad-field $.strength'], result.zeroStrength),
    expectState('행동 원자 없는 가능성은 걸린다', ['bad-field $.atoms'], result.emptyAtoms),
    expectState('배열은 존재론 원소가 아니다', ['not-a-record $'], result.notARecord),
    expectState('이름표 없는 값은 분류되지 않는다', ['unknown-kind $.kind'], result.noKind),
  ],
});

export const o1Scenarios = [o1CatalogCovered, o1UnmappedRejected, o1Boundary] as const;
