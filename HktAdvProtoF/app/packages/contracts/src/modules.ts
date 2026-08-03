// 모듈 소스 명부 — 어느 모듈이 어느 파일로 이뤄져 있는가.
//
// 증거의 `sourceHash` 는 이 명부로 계산된다. 명부가 한 곳에만 있어야 하는 이유:
// 증거를 **만드는 쪽**(lab/verify/evidence.ts)과 완료 주장을 **대조하는 쪽**(scenarios/verify/v0.ts)이
// 서로 다른 해시 공식을 쓰면, 소스가 바뀌어도 낡은 증거가 통과해 버린다 (이슈 #663).
//
// 여기는 순수 데이터다 — 파일을 읽는 것은 load.ts 의 `hashSources`·`loadSourceHashes` 다.

/** 모듈 하나가 무엇으로 이뤄져 있는가. */
export interface ModuleSourceSpec {
  readonly id: string;
  /** `<ID>-<name>` 형태의 증거용 모듈 이름 */
  readonly name: string;
  /** 검증 대상 소스 (app 루트 기준). 바뀌면 sourceHash 가 바뀌어 증거가 무효가 된다. */
  readonly sources: readonly string[];
  /** 단위 테스트를 돌릴 패키지 (app 루트 기준) */
  readonly testPackage: string;
  /** V3 Lab 대체 스크립트 */
  readonly labSubstitute: string;
}

/** 브라우저 Lab 확인이 아직 수동인 모듈의 대체 문구. */
const labOf = (id: string): string =>
  `packages/lab/verify/v3.ts — 본 검증은 브라우저 /lab/${id.toLowerCase()} (npm run dev --workspace @hkt/lab)`;

export const MODULE_SOURCES: readonly ModuleSourceSpec[] = [
  {
    id: 'V0',
    name: 'V0-module-contract-registry',
    sources: [
      'packages/contracts/src/index.ts',
      'packages/contracts/src/yaml.ts',
      'packages/contracts/src/contract.ts',
      'packages/contracts/src/registry.ts',
      'packages/contracts/src/load.ts',
    ],
    testPackage: 'packages/contracts',
    labSubstitute: 'packages/scenarios/verify/v0.ts',
  },
  {
    id: 'V1',
    name: 'V1-deterministic-runtime',
    sources: [
      'packages/core/src/index.ts',
      'packages/core/src/v1/index.ts',
      'packages/core/src/v1/tick.ts',
      'packages/core/src/v1/random.ts',
      'packages/core/src/v1/id.ts',
      'packages/core/src/v1/stable-sort.ts',
      'packages/core/src/v1/hash.ts',
    ],
    testPackage: 'packages/core',
    labSubstitute: 'packages/scenarios/verify/v1.ts',
  },
  {
    id: 'V2',
    name: 'V2-scenario-runner',
    sources: [
      'packages/scenarios/src/index.ts',
      'packages/scenarios/src/scenario.ts',
      'packages/scenarios/src/assertions.ts',
      'packages/scenarios/src/diff.ts',
      'packages/scenarios/src/digest.ts',
      'packages/scenarios/src/runner.ts',
      'packages/scenarios/src/report.ts',
    ],
    testPackage: 'packages/scenarios',
    labSubstitute: 'packages/scenarios/verify/v2.ts',
  },
  {
    id: 'V3',
    name: 'V3-browser-lab',
    sources: [
      'packages/lab/src/index.ts',
      'packages/lab/src/vnode.ts',
      'packages/lab/src/page.ts',
      'packages/lab/src/shell.ts',
      'packages/lab/src/mount.ts',
      'packages/lab/src/renderers/diff.ts',
      'packages/lab/src/renderers/scenario.ts',
      'packages/lab/src/pages/index.ts',
    ],
    testPackage: 'packages/lab',
    labSubstitute: 'packages/lab/verify/v3.ts (본 검증은 브라우저: npm run dev --workspace @hkt/lab)',
  },
  {
    id: 'O0',
    name: 'O0-worldview-axioms',
    sources: [
      'packages/core/src/o0/index.ts',
      'packages/core/src/o0/axiom.ts',
      'packages/core/src/o0/definition.ts',
      'packages/core/src/o0/enforcement.ts',
      'packages/core/src/o0/derivation.ts',
    ],
    testPackage: 'packages/core',
    labSubstitute: labOf('O0'),
  },
  {
    id: 'O1',
    name: 'O1-common-world-ontology',
    sources: [
      'packages/core/src/o1/index.ts',
      'packages/core/src/o1/kinds.ts',
      'packages/core/src/o1/check.ts',
      'packages/core/src/o1/being.ts',
      'packages/core/src/o1/operation.ts',
      'packages/core/src/o1/relation.ts',
      'packages/core/src/o1/demand.ts',
      'packages/core/src/o1/coverage.ts',
      'packages/core/src/o1/catalog.ts',
    ],
    testPackage: 'packages/core',
    labSubstitute: labOf('O1'),
  },
  {
    id: 'O2',
    name: 'O2-world-state-schema',
    sources: [
      'packages/core/src/o2/index.ts',
      'packages/core/src/o2/domain.ts',
      'packages/core/src/o2/field.ts',
      'packages/core/src/o2/schema.ts',
      'packages/core/src/o2/world.ts',
    ],
    testPackage: 'packages/core',
    labSubstitute: labOf('O2'),
  },
  {
    id: 'S0',
    name: 'S0-common-subject-model',
    sources: [
      'packages/core/src/s0/index.ts',
      'packages/core/src/s0/violation.ts',
      'packages/core/src/s0/boundary.ts',
      'packages/core/src/s0/perception.ts',
      'packages/core/src/s0/stake.ts',
      'packages/core/src/s0/subject.ts',
      'packages/core/src/s0/questions.ts',
    ],
    testPackage: 'packages/core',
    labSubstitute: labOf('S0'),
  },
  {
    id: 'S1',
    name: 'S1-species-archetype',
    sources: [
      'packages/core/src/s1/index.ts',
      'packages/core/src/s1/violation.ts',
      'packages/core/src/s1/body.ts',
      'packages/core/src/s1/senses.ts',
      'packages/core/src/s1/lifecycle.ts',
      'packages/core/src/s1/needs.ts',
      'packages/core/src/s1/archetype.ts',
    ],
    testPackage: 'packages/core',
    labSubstitute: labOf('S1'),
  },
  {
    id: 'S2',
    name: 'S2-culture-role-archetype',
    sources: [
      'packages/core/src/s2/index.ts',
      'packages/core/src/s2/violation.ts',
      'packages/core/src/s2/reading.ts',
      'packages/core/src/s2/value.ts',
      'packages/core/src/s2/role.ts',
      'packages/core/src/s2/culture.ts',
    ],
    testPackage: 'packages/core',
    labSubstitute: labOf('S2'),
  },
  {
    id: 'S3',
    name: 'S3-subject-instance',
    sources: [
      'packages/core/src/s3/index.ts',
      'packages/core/src/s3/violation.ts',
      'packages/core/src/s3/history.ts',
      'packages/core/src/s3/trait.ts',
      'packages/core/src/s3/instance.ts',
    ],
    testPackage: 'packages/core',
    labSubstitute: labOf('S3'),
  },
  {
    id: 'D0',
    name: 'D0-dependency-kind',
    sources: [
      'packages/core/src/d0/index.ts',
      'packages/core/src/d0/violation.ts',
      'packages/core/src/d0/kind.ts',
      'packages/core/src/d0/grounding.ts',
    ],
    testPackage: 'packages/core',
    labSubstitute: labOf('D0'),
  },
  {
    id: 'D1',
    name: 'D1-dependency-graph-schema',
    sources: [
      'packages/core/src/d1/index.ts',
      'packages/core/src/d1/violation.ts',
      'packages/core/src/d1/node.ts',
      'packages/core/src/d1/edge.ts',
      'packages/core/src/d1/graph.ts',
    ],
    testPackage: 'packages/core',
    labSubstitute: labOf('D1'),
  },
  {
    id: 'D2',
    name: 'D2-species-base-dependency-graph',
    sources: [
      'packages/core/src/d2/index.ts',
      'packages/core/src/d2/violation.ts',
      'packages/core/src/d2/root.ts',
      'packages/core/src/d2/supply.ts',
      'packages/core/src/d2/blueprint.ts',
    ],
    testPackage: 'packages/core',
    labSubstitute: labOf('D2'),
  },
  {
    id: 'D3',
    name: 'D3-personal-dependency-variation',
    sources: [
      'packages/core/src/d3/index.ts',
      'packages/core/src/d3/violation.ts',
      'packages/core/src/d3/personal.ts',
      'packages/core/src/d3/variation.ts',
      'packages/core/src/d3/transform.ts',
    ],
    testPackage: 'packages/core',
    labSubstitute: labOf('D3'),
  },
  {
    id: 'D4',
    name: 'D4-dependency-pressure',
    sources: [
      'packages/core/src/d4/index.ts',
      'packages/core/src/d4/violation.ts',
      'packages/core/src/d4/snapshot.ts',
      'packages/core/src/d4/deficit.ts',
      'packages/core/src/d4/pressure.ts',
    ],
    testPackage: 'packages/core',
    labSubstitute: labOf('D4'),
  },
  {
    id: 'P0',
    name: 'P0-action-atom',
    sources: [
      'packages/core/src/p0/index.ts',
      'packages/core/src/p0/violation.ts',
      'packages/core/src/p0/atom.ts',
      'packages/core/src/p0/grounding.ts',
      'packages/core/src/p0/action.ts',
    ],
    testPackage: 'packages/core',
    labSubstitute: labOf('P0'),
  },
  {
    id: 'P1',
    name: 'P1-strategy-direction',
    sources: [
      'packages/core/src/p1/index.ts',
      'packages/core/src/p1/violation.ts',
      'packages/core/src/p1/direction.ts',
      'packages/core/src/p1/opening.ts',
      'packages/core/src/p1/tree.ts',
      'packages/core/src/p1/possibility.ts',
    ],
    testPackage: 'packages/core',
    labSubstitute: labOf('P1'),
  },
  {
    id: 'P2',
    name: 'P2-possibility-grammar',
    sources: [
      'packages/core/src/p2/index.ts',
      'packages/core/src/p2/violation.ts',
      'packages/core/src/p2/access.ts',
      'packages/core/src/p2/grammar.ts',
      'packages/core/src/p2/narrow.ts',
    ],
    testPackage: 'packages/core',
    labSubstitute: labOf('P2'),
  },
  {
    id: 'V4',
    name: 'V4-completion-evidence',
    sources: [
      'packages/contracts/src/evidence.ts',
      'packages/contracts/src/collect.ts',
      'packages/contracts/src/modules.ts',
    ],
    testPackage: 'packages/contracts',
    labSubstitute: 'packages/scenarios/verify/v4.ts',
  },
];

/** id → 명부 한 줄. */
export function moduleSourceSpec(id: string): ModuleSourceSpec | null {
  return MODULE_SOURCES.find((spec) => spec.id === id) ?? null;
}
