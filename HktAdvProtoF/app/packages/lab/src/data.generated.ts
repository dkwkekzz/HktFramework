// 이 파일은 생성된다 — 직접 고치지 말 것.
// 생성: node packages/lab/scripts/generate-data.ts  (npm run verify 가 자동 수행)
// 원본: packages/contracts/*.yaml · packages/contracts/evidence/*.json

import type { ContractSource, Evidence } from '@hkt/contracts';

export const CONTRACT_SOURCES: readonly ContractSource[] = [
  {
    "name": "O1.yaml",
    "text": "id: O1\nname: common-world-ontology\npurpose: >\n  원문 설계의 모든 개념을 공통 존재론 12타입 중 하나 이상으로 표현한다.\n\ninputs: [ConceptCatalog]        # 원문에서 뽑은 개념 목록 — 무엇을 덮어야 하는가\noutputs: [OntologyKind, OnticNode, ClassifyResult, CoverageReport]\n\nwrites:                         # O1 은 세계를 바꾸지 않는다 — 세계를 무엇으로 적을지 정한다.\n  - OnticNode\n\ndepends: [V1, V2, V0, V3, V4]   # 검증 기반 전체가 선 뒤에야 존재론을 등록할 수 있다\n\nsubtasks:                       # 상태 원소 12종 > 3종 → WORKFLOW §3 원소 묶음별 분할\n  - id: O1-a\n    name: being-triad\n    purpose: 존재론 골격을 세우고 Subject·Entity·State 를 정의한다.\n    status: DONE\n  - id: O1-b\n    name: operation-triad\n    purpose: 세계가 굴러가는 방식을 Rule·Phenomenon·Event 로 정의한다.\n    status: DONE\n  - id: O1-c\n    name: relation-triad\n    purpose: 주체가 세계에 거는 것을 Claim·Commitment·Affordance 로 정의한다.\n    status: DONE\n  - id: O1-d\n    name: demand-triad\n    purpose: 주체의 결핍과 세계에 대한 청구를 Dependency·Possibility·WorldRequirement 로 정의한다.\n    status: DONE\n  - id: O1-e\n    name: concept-coverage\n    purpose: 원문 개념 중 12타입으로 환원되지 않는 것이 남으면 그 사실을 드러낸다.\n    status: DONE\n\nscenarios:                      # 정상 1 + 실패 1 + 경계 1 (WORKFLOW §5.1)\n  - o1-catalog-covered          # 정상: 원문 개념 전부가 12타입으로 분류되고 남는 타입이 없다\n  - o1-unmapped-rejected        # 실패: 타입 없는 개념·어긴 필드가 경로와 사유로 지목된다\n  - o1-boundary                 # 경계: 빈 카탈로그 · 직렬화 불가 값 · kind 없는 값 · 중복 id\n\nelements:\n  - name: Subject\n    ontology: Subject\n    renderer: diff\n  - name: Entity\n    ontology: Entity\n    renderer: diff\n  - name: State\n    ontology: State\n    renderer: diff\n  - name: Rule\n    ontology: Rule\n    renderer: diff\n  - name: Phenomenon\n    ontology: Phenomenon\n    renderer: diff\n  - name: Claim\n    ontology: Claim\n    renderer: diff\n  - name: Commitment\n    ontology: Commitment\n    renderer: diff\n  - name: Affordance\n    ontology: Affordance\n    renderer: diff\n  - name: Event\n    ontology: Event\n    renderer: diff\n  - name: Dependency\n    ontology: Dependency\n    renderer: diff\n  - name: Possibility\n    ontology: Possibility\n    renderer: diff\n  - name: WorldRequirement\n    ontology: WorldRequirement\n    renderer: diff\n  - name: ConceptEntry\n    ontology: Claim              # 원문이 \"이 개념은 이 타입이다\" 라고 건 주장\n    renderer: diff\n  - name: CoverageReport\n    ontology: State              # 존재론이 지금 얼마나 덮고 있는가 — 검사 시점의 값\n    renderer: diff\n\nlab: /lab/o1\n\nstatus: IN_PROGRESS\n"
  },
  {
    "name": "V0.yaml",
    "text": "id: V0\nname: module-contract-registry\npurpose: >\n  모든 모듈의 목적·입출력·의존·검증 상태를 등록하고 결함 계약을 사유와 함께 거부한다.\n\ninputs: [ContractSource]\noutputs: [ModuleRegistry, ModuleContract, ContractViolation]\n\nwrites:                         # V0 은 세계 상태를 쓰지 않는다 — 계약 등록 상태만 만든다.\n  - ModuleContract\n  - ModuleStatus\n\ndepends: [V1, V2]               # 안정 정렬·상태 해시(V1) 로 판정하고, 검증은 V2 실행기로 한다\n\nsubtasks:\n  - id: V0-a\n    name: contract-yaml-parser\n    purpose: MODULE.yaml 서식을 읽고 서식 밖 문법을 줄 번호와 함께 거부한다.\n    status: DONE\n  - id: V0-b\n    name: registry-checker\n    purpose: 파싱된 계약을 등록하며 결함 계약을 거부하고 의존 DAG 를 계산한다.\n    status: DONE\n\nscenarios:\n  - v0-registry-accepts         # 정상: 온전한 계약 등록 + 위상 순서 + 착수 가능 목록\n  - v0-rejects-defective        # 실패: 목적/입출력/시나리오/증거 없음 · 순환 의존 거부\n  - v0-boundary                 # 경계: 계약 0개 · 파싱 실패 · 중복 ID · 없는 의존 · 미검증 의존\n\nelements:\n  - name: ModuleContract\n    ontology: Rule\n    renderer: graph\n  - name: ModuleStatus\n    ontology: State\n    renderer: graph\n\nlab: /lab/v0                    # V3 미구현 — packages/scenarios/verify/v0.ts 가 같은 7요소를 출력한다.\n\nstatus: VERIFIED\nevidence: evidence/V0.json\n"
  },
  {
    "name": "V1.yaml",
    "text": "id: V1\nname: deterministic-runtime\npurpose: >\n  같은 시드와 입력이면 항상 같은 사건 순서와 상태 해시가 나오게 한다.\n\ninputs: [Seed, Tick]\noutputs: [TickClock, SeededRandom, DeterministicId, stableSort, stateHash]\n\nwrites:                         # V1 은 세계 상태를 쓰지 않는다 — 시간·난수·식별자·순서·해시만 제공한다.\n  - Seed\n  - Tick\n  - StateHash\n\ndepends: []                     # 모든 것의 전제. 선행 모듈 없음.\n\nsubtasks:\n  - id: V1-a\n    name: monorepo-scaffold\n    purpose: app/ 모노레포와 core 패키지를 만들어 V1 을 담을 자리를 연다.\n    status: DONE\n\nscenarios:                      # 정상 1 + 실패 1 + 경계 1 (WORKFLOW §5.1)\n  - v1-same-seed-100            # 정상: 같은 시드 100회 → 사건 순서·상태 해시 동일\n  - v1-seed-drift-detected      # 실패: 시드 한 글자 차이 → 해시 상이 + 최초 분기 사건 지목\n  - v1-boundary                 # 경계: 틱 0·주체 0·시드 0 vs \"0\"·빈 배열 연산\n                                # 정의 위치: packages/scenarios/suites/v1.ts (V2 실행기 형식)\n\nelements:\n  - name: Seed\n    ontology: State\n    renderer: diff\n  - name: Tick\n    ontology: State\n    renderer: diff\n  - name: StateHash\n    ontology: State\n    renderer: diff\n\nlab: /lab/v1                    # V3 미구현 — packages/scenarios/verify/v1.ts 가 같은 7요소를 출력한다.\n\nstatus: VERIFIED\nevidence: evidence/V1.json\n"
  },
  {
    "name": "V2.yaml",
    "text": "id: V2\nname: scenario-runner\npurpose: >\n  각 모듈의 대표 장면을 arrange / act / assert 로 자동 실행하고, 실패를 고칠 수 있는 형태로 보고한다.\n\ninputs: [Scenario]\noutputs: [ScenarioResult, Assertion, SuiteResult, SuiteDigest]\n\nwrites:                         # V2 도 세계 상태를 쓰지 않는다 — 검증 결과만 만든다.\n  - ScenarioResult\n  - Assertion\n\ndepends: [V1]                   # 상태 해시·안정 정렬로 결과를 판정한다\n\nscenarios:\n  - v2-passing-report           # 정상: 통과 장면 → 단언 목록과 함께 통과 보고\n  - v2-failure-report           # 실패: 고의 결함 → 초기상태·입력·기대·실제·최초 분기 경로 5요소 출력\n  - v2-boundary                 # 경계: 단언 0개 · arrange/act 예외 · 직렬화 불가 상태\n\nelements:\n  - name: ScenarioResult\n    ontology: Event\n    renderer: diff\n  - name: Assertion\n    ontology: Claim\n    renderer: diff\n\nlab: /lab/v2                    # V3 미구현 — packages/scenarios/verify/v2.ts 가 같은 7요소를 출력한다.\n\nstatus: VERIFIED\nevidence: evidence/V2.json\n"
  },
  {
    "name": "V3.yaml",
    "text": "id: V3\nname: browser-verification-lab\npurpose: >\n  코드를 읽지 않아도 모듈 작동을 브라우저에서 눈으로 확인하게 한다.\n\ninputs: [ModuleStateElements]\noutputs: [LabPage, VNode]\n\nwrites:                         # V3 은 세계 상태를 쓰지 않는다 — 화면만 만든다.\n  - VNode\n\ndepends: [V1, V2, V0, V4]       # 해시·시나리오·계약·증거를 화면으로 옮긴다\n\nscenarios:\n  - v3-page-shows-seven         # 정상: 모든 페이지가 화면 7요소를 채우고 판정을 보인다\n  - v3-failure-highlight        # 실패: 갈라진 상태의 경로·기대·실제가 강조돼 나온다\n  - v3-boundary                 # 경계: 빈 상태 · 직렬화 불가 상태 · 섹션 누락 · 이스케이프\n\nelements:\n  - name: VNode\n    ontology: State\n    renderer: diff\n\nlab: /lab/v3                    # 셸 자체가 Lab 이다 — npm run dev --workspace @hkt/lab\n\nstatus: VERIFIED\nevidence: evidence/V3.json\n"
  },
  {
    "name": "V4.yaml",
    "text": "id: V4\nname: completion-evidence\npurpose: >\n  검증 산출물에서만 완료 상태를 결정해, 완료를 임의로 선언하지 못하게 한다.\n\ninputs: [EvidenceInput]\noutputs: [Evidence, PromotionCheck]\n\nwrites:\n  - Evidence\n  - ModuleStatus\n\ndepends: [V1, V2, V0]           # 해시(V1) · 시나리오 결과(V2) · 계약(V0) 을 재료로 삼는다\n\nscenarios:\n  - v4-evidence-verified        # 정상: 전부 통과한 산출물 → VERIFIED 증거 + 완료 전이 허용\n  - v4-refuses-unverified       # 실패: 시나리오/테스트/커버리지/결정성 미달 → 전이 거부\n  - v4-boundary                 # 경계: 증거 없음 · 낡은 증거(소스 변경) · 시나리오 0개 · 테스트 0개\n\nelements:\n  - name: Evidence\n    ontology: Claim\n    renderer: diff\n\nlab: /lab/v4                    # V3 미구현 — packages/scenarios/verify/v4.ts 가 같은 7요소를 출력한다.\n\nstatus: VERIFIED\nevidence: evidence/V4.json\n"
  }
];

export const EVIDENCE: Readonly<Record<string, Evidence>> = {
  "V0": {
    "module": "V0-module-contract-registry",
    "sourceHash": "ed897e655dc73dfb",
    "unitTests": "passed",
    "propertyTests": "passed",
    "labScenarios": "manual",
    "integrationScenario": "passed",
    "replayHash": "649a083d4a0ff900",
    "status": "VERIFIED",
    "blockers": [],
    "detail": {
      "generator": "packages/scenarios/verify/evidence.ts",
      "labSubstitute": "packages/scenarios/verify/v0.ts",
      "testPackage": "packages/contracts",
      "coverage": {
        "module": "V0",
        "normal": 1,
        "failure": 1,
        "boundary": 1,
        "complete": true
      },
      "tests": {
        "total": 60,
        "passed": 60
      },
      "scenarios": {
        "total": 3,
        "passed": 3,
        "failed": 0,
        "coverageComplete": true,
        "byId": {
          "v0-registry-accepts": "passed",
          "v0-rejects-defective": "passed",
          "v0-boundary": "passed"
        }
      }
    }
  },
  "V1": {
    "module": "V1-deterministic-runtime",
    "sourceHash": "f6097c0c7e4961ea",
    "unitTests": "passed",
    "propertyTests": "passed",
    "labScenarios": "manual",
    "integrationScenario": "passed",
    "replayHash": "bfc6afce291d17c6",
    "status": "VERIFIED",
    "blockers": [],
    "detail": {
      "generator": "packages/scenarios/verify/evidence.ts",
      "labSubstitute": "packages/scenarios/verify/v1.ts",
      "testPackage": "packages/core",
      "coverage": {
        "module": "V1",
        "normal": 1,
        "failure": 1,
        "boundary": 1,
        "complete": true
      },
      "tests": {
        "total": 33,
        "passed": 33
      },
      "scenarios": {
        "total": 3,
        "passed": 3,
        "failed": 0,
        "coverageComplete": true,
        "byId": {
          "v1-same-seed-100": "passed",
          "v1-seed-drift-detected": "passed",
          "v1-boundary": "passed"
        }
      }
    }
  },
  "V2": {
    "module": "V2-scenario-runner",
    "sourceHash": "e996f7877fb13e9a",
    "unitTests": "passed",
    "propertyTests": "passed",
    "labScenarios": "manual",
    "integrationScenario": "passed",
    "replayHash": "0aaaa0d5eeabf9fa",
    "status": "VERIFIED",
    "blockers": [],
    "detail": {
      "generator": "packages/scenarios/verify/evidence.ts",
      "labSubstitute": "packages/scenarios/verify/v2.ts",
      "testPackage": "packages/scenarios",
      "coverage": {
        "module": "V2",
        "normal": 1,
        "failure": 1,
        "boundary": 1,
        "complete": true
      },
      "tests": {
        "total": 36,
        "passed": 36
      },
      "scenarios": {
        "total": 3,
        "passed": 3,
        "failed": 0,
        "coverageComplete": true,
        "byId": {
          "v2-passing-report": "passed",
          "v2-failure-report": "passed",
          "v2-boundary": "passed"
        }
      }
    }
  },
  "V3": {
    "module": "V3-browser-lab",
    "sourceHash": "a79bbcf4dac407a3",
    "unitTests": "passed",
    "propertyTests": "passed",
    "labScenarios": "manual",
    "integrationScenario": "passed",
    "replayHash": "6b7bf66e4726471e",
    "status": "VERIFIED",
    "blockers": [],
    "detail": {
      "generator": "packages/scenarios/verify/evidence.ts",
      "labSubstitute": "packages/lab/verify/v3.ts (본 검증은 브라우저: npm run dev --workspace @hkt/lab)",
      "testPackage": "packages/lab",
      "coverage": {
        "module": "V3",
        "normal": 1,
        "failure": 1,
        "boundary": 1,
        "complete": true
      },
      "tests": {
        "total": 31,
        "passed": 31
      },
      "scenarios": {
        "total": 3,
        "passed": 3,
        "failed": 0,
        "coverageComplete": true,
        "byId": {
          "v3-page-shows-seven": "passed",
          "v3-failure-highlight": "passed",
          "v3-boundary": "passed"
        }
      }
    }
  },
  "V4": {
    "module": "V4-completion-evidence",
    "sourceHash": "01d8c154e517d1fc",
    "unitTests": "passed",
    "propertyTests": "passed",
    "labScenarios": "manual",
    "integrationScenario": "passed",
    "replayHash": "e7c4be1f650b4167",
    "status": "VERIFIED",
    "blockers": [],
    "detail": {
      "generator": "packages/scenarios/verify/evidence.ts",
      "labSubstitute": "packages/scenarios/verify/v4.ts",
      "testPackage": "packages/contracts",
      "coverage": {
        "module": "V4",
        "normal": 1,
        "failure": 1,
        "boundary": 1,
        "complete": true
      },
      "tests": {
        "total": 60,
        "passed": 60
      },
      "scenarios": {
        "total": 3,
        "passed": 3,
        "failed": 0,
        "coverageComplete": true,
        "byId": {
          "v4-evidence-verified": "passed",
          "v4-refuses-unverified": "passed",
          "v4-boundary": "passed"
        }
      }
    }
  }
};
