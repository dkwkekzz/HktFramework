// 이 파일은 생성된다 — 직접 고치지 말 것.
// 생성: node packages/lab/scripts/generate-data.ts  (npm run verify 가 자동 수행)
// 원본: packages/contracts/*.yaml · packages/contracts/evidence/*.json

import type { ContractSource, Evidence } from '@hkt/contracts';

export const CONTRACT_SOURCES: readonly ContractSource[] = [
  {
    "name": "D0.yaml",
    "text": "id: D0\nname: dependency-kind\npurpose: >\n  주체가 기댈 수 있는 대상을 11종으로 확정하고, 각 종이 세계의 무엇으로 서고 어느 자리에서\n  충족을 읽는지를 못박는다.\n\ninputs: [DependencyKinds, OntologyKind, StateDomain, StateSchema]\noutputs: [DependencyKindSpec, KindResolution, KindGrounding, TargetFit, DependencyKindViolation]\n\nwrites: []                      # D0 은 세계를 바꾸지 않는다 — 분류만 확정한다.\n\ndepends: [V1, V2, V0, V3, V4, O1, O2, O0, S0, S1, S2, S3]\n\nsubtasks:                       # 원문 대조와 세계 걸림은 검사기가 다르다 → WORKFLOW §3 분할\n  - id: D0-a\n    name: kind-reconciliation\n    purpose: 원문이 두 곳에 다르게 적은 의존 대상 목록(D0 11 · D1 9)을 11종으로 남김없이 해소한다.\n    status: DONE\n  - id: D0-b\n    name: kind-grounding\n    purpose: 각 종의 대상이 O1 의 무엇이고 충족을 O2 어느 자리에서 읽는지 못박고, 선언한 종과 실제 대상이 어긋나면 거부한다.\n    status: DONE\n  - id: D0-c\n    name: eye-check\n    purpose: 시나리오 3종과 Lab 분류표로 D0 를 눈으로 확인한다.\n    status: DONE\n\nscenarios:                      # 정상 1 + 실패 1 + 경계 1 (WORKFLOW §5.1)\n  - d0-one-rule-three-kinds     # 정상: 같은 원소가 기대는 방식에 따라 여러 종으로 서고, 11종이 9영역을 덮는다\n  - d0-broken-kinds-rejected    # 실패: 자리 없는 종·어긋난 대상·해소되지 않은 원문 이름이 각자의 사유로 거부된다\n  - d0-boundary                 # 경계: 대상 없는 종(시간) · 어느 종도 받지 않는 원소 · 대조표의 양끝\n\nelements:\n  - name: DependencyKind\n    ontology: Dependency        # O1 이 이름표로 고정한 11종에 근거와 성격 축이 붙는다\n    renderer: diff\n\nlab: /lab/d0                    # 분류표 (11종 × 성격 축) + 원문 대조 + 같은 원소가 갈리는 자리 + 거부 사유\n\nstatus: VERIFIED\nevidence: evidence/D0.json\n"
  },
  {
    "name": "D1.yaml",
    "text": "id: D1\nname: dependency-graph-schema\npurpose: >\n  확정된 의존 대상 열한 종을 노드로 세우고, 그 노드들을 무엇으로 잇는지(관계 7종)를 확정한다.\n\ninputs: [DependencyKind, KindGrounding, StateSchema, Band]\noutputs: [DependencyNode, DependencyEdge, DependencyGraph, GraphViolation]\n\nwrites: []                      # D1 도 세계를 바꾸지 않는다 — 그래프의 모양만 확정한다.\n\ndepends: [V1, V2, V0, V3, V4, O1, O2, O0, S0, S1, S2, S3, D0]\n\nsubtasks:                       # 노드·간선·조립은 검사기가 다르고, 그래프 뷰는 공용 렌더러다 → WORKFLOW §3\n  - id: D1-a\n    name: dependency-node\n    purpose: 종마다 정해진 자리에서만 조건을 읽게 하고, D0 대상 관문을 그대로 지나게 한다.\n    status: DONE\n  - id: D1-b\n    name: dependency-edge\n    purpose: 관계 7종이 D0 의 성격(소모·가리킴)과 어긋나면 거부한다.\n    status: DONE\n  - id: D1-c\n    name: dependency-graph\n    purpose: 뿌리에서 닿지 않는 노드·순환·끊긴 참조를 막고 그래프 해시를 고정한다.\n    status: DONE\n  - id: D1-d\n    name: graph-renderer\n    purpose: 공용 그래프 뷰를 세운다 — 노드 색은 종, 간선은 관계, 굵기는 강도 (WORKFLOW §6-2).\n    status: DONE\n  - id: D1-e\n    name: eye-check\n    purpose: 시나리오 3종과 Lab 그래프로 D1 을 눈으로 확인한다.\n    status: DONE\n\nscenarios:                      # 정상 1 + 실패 1 + 경계 1 (WORKFLOW §5.1)\n  - d1-winter-food-graph        # 정상: 뿌리 하나에서 뻗은 그래프가 서고, 같은 그래프는 같은 해시가 된다\n  - d1-broken-graphs-rejected   # 실패: 소모할 수 없는 것을 소모하거나 닿지 않는 노드·순환이 거부된다\n  - d1-boundary                 # 경계: 노드 하나짜리 그래프 · 시간 노드의 틱 조건 · 수치의 양끝\n\nelements:\n  - name: DependencyGraph\n    ontology: Dependency        # 노드 하나하나가 O1 Dependency 로 선다\n    renderer: graph\n\nlab: /lab/d1                    # 그래프 뷰(노드=종 색, 간선=관계) + 노드·간선 표 + 거부 사유\n\nstatus: VERIFIED\nevidence: evidence/D1.json\n"
  },
  {
    "name": "D2.yaml",
    "text": "id: D2\nname: species-base-dependency-graph\npurpose: >\n  종 원형에서 그 종의 모든 개체가 물려받는 기본 의존 그래프를 찍어 내고, 생존·번식 경로가 끊기지 않게 한다.\n\ninputs: [SpeciesArchetype, SpeciesBlueprint, BirthPlace]\noutputs: [DependencyGraph, BlueprintReport, SpeciesGraphViolation]\n\nwrites: []                      # D2 도 세계를 바꾸지 않는다 — 종이 물려주는 그래프의 모양만 찍어 낸다.\n\ndepends: [V1, V2, V0, V3, V4, O1, O2, O0, S0, S1, S2, S3, D0, D1]\n\nsubtasks:                       # 뿌리·채움·무단절은 검사기가 다르다 → WORKFLOW §3\n  - id: D2-a\n    name: graph-roots\n    purpose: 종이 무너진다고 말한 자리(S1 NeedTemplate)마다 뿌리를 하나씩 세우고, 조건을 고쳐 적지 못하게 한다.\n    status: DONE\n  - id: D2-b\n    name: supply-branches\n    purpose: 무엇이 그 자리를 채우는지를 선언에서 노드·간선으로 찍어 내고 시한을 대사로 나눈다.\n    status: DONE\n  - id: D2-c\n    name: unbroken-paths\n    purpose: 뿌리마다 채움이 있고 늙는 종은 대를 잇는지 본다 — 원문 D2 검증 조항.\n    status: DONE\n  - id: D2-d\n    name: eye-check\n    purpose: 시나리오 3종과 Lab 으로 종에서 찍어 낸 그래프를 눈으로 확인한다.\n    status: DONE\n\nscenarios:                      # 정상 1 + 실패 1 + 경계 1 (WORKFLOW §5.1)\n  - d2-species-base-graphs      # 정상: 종 다섯이 각자의 기본 그래프를 찍어 내고, 같은 종의 둘이 같은 모양을 받는다\n  - d2-broken-blueprints-rejected # 실패: 채울 것 없는 무너짐·대를 잇지 않는 종·고쳐 적은 조건이 거부된다\n  - d2-boundary                 # 경계: 뿌리 하나·채움 하나 · 단계가 시한을 나눈다 · 늙지 않는 종의 대\n\nelements:\n  - name: DependencyGraph\n    ontology: Dependency        # 찍어 낸 노드 하나하나가 여전히 O1 Dependency 다\n    renderer: graph\n\nlab: /lab/d2                    # 종별 기본 그래프 + 단계별 시한 대조 + 무단절 판정표 + 거부 사유\n\nstatus: VERIFIED\nevidence: evidence/D2.json\n"
  },
  {
    "name": "D3.yaml",
    "text": "id: D3\nname: personal-dependency-variation\npurpose: >\n  종이 물려준 기본 의존 그래프를 개인·문화·능력이 변형하게 하되, 의존이 사라지지 않고 다른 의존으로 전환되게 한다.\n\ninputs: [SubjectInstance, DependencyGraph, VariationSpec, Definition]\noutputs: [DependencyGraph, PersonalReport, GraphDiff, PersonalViolation]\n\nwrites: []                      # D3 도 세계를 바꾸지 않는다 — 한 개체의 그래프 모양만 갈라 놓는다.\n\ndepends: [V1, V2, V0, V3, V4, O1, O2, O0, S0, S1, S2, S3, D0, D1, D2]\n\nsubtasks:                       # 개인화·변형 문법·전환 검사는 검사기가 다르다 → WORKFLOW §3\n  - id: D3-a\n    name: personalize-roots\n    purpose: 종의 그래프를 개체의 자리에 세우고, 뿌리 간선의 급함·시한을 개체의 실제 Need 에서 다시 읽는다.\n    status: DONE\n  - id: D3-b\n    name: variation-grammar\n    purpose: 변형을 더함·약화·끊음 셋으로만 적게 하고, 유래를 대지 못하는 변형을 거부한다.\n    status: DONE\n  - id: D3-c\n    name: conversion-check\n    purpose: 줄인 만큼 다른 의존이 서는지 본다 — 원문 D3 검증 조항(제거가 아닌 전환).\n    status: DONE\n  - id: D3-d\n    name: graph-diff-view\n    purpose: 공용 그래프 뷰에 더함=녹·끊김=적·바뀜=노랑을 더한다 (WORKFLOW §6-2).\n    status: DONE\n  - id: D3-e\n    name: eye-check\n    purpose: 시나리오 3종과 Lab 으로 같은 종 넷이 갈라지는 것을 눈으로 확인한다.\n    status: DONE\n\nscenarios:                      # 정상 1 + 실패 1 + 경계 1 (WORKFLOW §5.1)\n  - d3-personal-graphs          # 정상: 같은 기본 그래프에서 넷이 갈리고, 사제의 식량 의존이 의념으로 전환된다\n  - d3-broken-variations-rejected # 실패: 공짜 전환·가벼운 전환·대가 없는 전환·유래 없는 변형이 거부된다\n  - d3-boundary                 # 경계: 변형 0개 · 약화의 양끝 · 뿌리를 잃는 변형\n\nelements:\n  - name: DependencyGraph\n    ontology: Dependency        # 변형된 노드도 여전히 O1 Dependency 다\n    renderer: graph\n\nlab: /lab/d3                    # 기본 대비 개인 그래프 diff(녹·적·노랑) + 전환 장부 + 거부 사유\n\nstatus: VERIFIED\nevidence: evidence/D3.json\n"
  },
  {
    "name": "D4.yaml",
    "text": "id: D4\nname: dependency-pressure\npurpose: >\n  지금 세계에서 각 의존이 얼마나 채워졌는지 재어 압력을 계산하고 충족 5단계를 판정한다.\n\ninputs: [DependencyGraph, WorldSnapshot, PressureContext]\noutputs: [PressureReport, DeficitReading, EdgePressure, PressureViolation]\n\nwrites: []                      # D4 는 세계를 읽기만 한다 — 상태를 바꾸는 것은 R1 사건의 몫이다.\n\ndepends: [V1, V2, V0, V3, V4, O1, O2, O0, S0, S1, S2, S3, D0, D1, D2, D3]\n\nsubtasks:                       # 세계 모으기·결핍·압력·게이지는 검사기가 다르다 → WORKFLOW §3\n  - id: D4-a\n    name: world-snapshot\n    purpose: 개체가 지고 온 값과 세계의 자리를 O2 트리 하나로 모아 지금의 세계를 세운다.\n    status: DONE\n  - id: D4-b\n    name: deficit-reading\n    purpose: 노드의 조건과 세계의 실제 값을 대어 결핍을 0~1 로 읽는다.\n    status: DONE\n  - id: D4-c\n    name: pressure-formula\n    purpose: 원문 식(Strength × Deficit × Urgency × FailureRisk)으로 압력을 내고 5단계를 판정한다.\n    status: DONE\n  - id: D4-d\n    name: gauge-renderer\n    purpose: 공용 게이지·추이 렌더러를 세운다 — 5단계 색과 압력 막대 (WORKFLOW §6-2).\n    status: DONE\n  - id: D4-e\n    name: eye-check\n    purpose: 시나리오 3종과 Lab 으로 압력이 오르는 것을 눈으로 확인한다.\n    status: DONE\n\nscenarios:                      # 정상 1 + 실패 1 + 경계 1 (WORKFLOW §5.1)\n  - d4-hunger-rises             # 정상: 재고가 줄면 압력이 단조 증가하고 5단계가 차례로 오른다\n  - d4-broken-readings-rejected # 실패: 어긴 상태·미래의 결핍·없는 노드가 거부된다\n  - d4-boundary                 # 경계: 충족이면 압력 0 · 결핍의 양끝 · 시한이 1틱인 무너짐\n\nelements:\n  - name: Pressure\n    ontology: Dependency        # 압력은 의존이 지금 지고 있는 값이다\n    renderer: gauge\n\nlab: /lab/d4                    # 압력 게이지 + 5단계 그래프 + 재고 감소 추이 + 거부 사유\n\nstatus: VERIFIED\nevidence: evidence/D4.json\n"
  },
  {
    "name": "O0.yaml",
    "text": "id: O0\nname: worldview-axioms\npurpose: >\n  세계에 어떤 존재와 현상이 허용되는지 공리로 정의하고, 그 공리를 어기는 능력·종 정의를 거부한다.\n\ninputs: [AxiomSpec, Definition, StateSchema]   # 원문 세 목록 + 세계에 들이려는 정의 + O2 자리\noutputs: [AxiomSet, AxiomViolation, EnforcementReport, DerivationReport]\n\nwrites:                         # O0 는 값을 바꾸지 않는다 — 무엇이 세계에 설 수 있는지를 정한다.\n  - Axiom\n  - Definition\n\ndepends: [V1, V2, V0, V3, V4, O1, O2]\n\nsubtasks:                       # 상태 원소 3종 초과 · 검증 장면 2개 초과 → WORKFLOW §3 분할\n  - id: O0-a\n    name: axiom-reconciliation\n    purpose: 원문이 세 곳에 나눠 적은 공리·불변 규칙을 대조해 하나의 공리 집합으로 확정한다.\n    status: DONE\n  - id: O0-b\n    name: definition-check\n    purpose: 세계에 들이려는 능력·종 정의가 공리를 어기면 사유와 경로로 거부한다.\n    status: DONE\n  - id: O0-c\n    name: enforcement-probe\n    purpose: 공리마다 지금 그것을 실제로 강제하는 지점이 있는지 실행해서 확인한다.\n    status: DONE\n  - id: O0-d\n    name: derivation-report\n    purpose: 같은 공리에서 서로 다른 여러 정의가 도출되는지 센다.\n    status: DONE\n  - id: O0-e\n    name: eye-check\n    purpose: 시나리오 3종과 Lab 판정 데모로 O0 를 눈으로 확인한다.\n    status: DONE\n\nscenarios:                      # 정상 1 + 실패 1 + 경계 1 (WORKFLOW §5.1)\n  - o0-definitions-stand        # 정상: 원문 공리 위에 능력 3 · 종 4 가 서고 강제 지점이 살아 있다\n  - o0-violations-rejected      # 실패: 결함 정의 14종이 각자의 공리·사유·경로로 거부되고, 공리를 빼면 통과한다\n  - o0-boundary                 # 경계: 빈 공리 집합 · 강도 임계 · 근거 없는 정의 · 불모 공리\n\nelements:\n  - name: Axiom\n    ontology: Rule              # 공리는 근거가 자기 자신인 규칙이다 (O1 Rule.axiomId = null)\n    renderer: diff\n  - name: AxiomResolution\n    ontology: Claim             # 원문이 \"이 문장은 저 공리다\" 라고 건 대조 주장\n    renderer: diff\n  - name: Definition\n    ontology: Rule              # 정의는 공리에서 나온 규칙이다 — 근거는 Rule.axiomId 가 이미 갖고 있다\n    renderer: diff\n  - name: AxiomViolation\n    ontology: Claim             # 공리가 정의에 대해 내리는 판정\n    renderer: diff\n  - name: EnforcementPoint\n    ontology: Commitment        # \"이 공리는 여기서 강제된다\" 는 계층 사이의 약속\n    renderer: diff\n\nlab: /lab/o0                    # 원문 세 목록 대조표 + 공리별 강제 지점 + 정의 판정 데모\n\nstatus: VERIFIED\nevidence: evidence/O0.json\n"
  },
  {
    "name": "O1.yaml",
    "text": "id: O1\nname: common-world-ontology\npurpose: >\n  원문 설계의 모든 개념을 공통 존재론 12타입 중 하나 이상으로 표현한다.\n\ninputs: [ConceptCatalog]        # 원문에서 뽑은 개념 목록 — 무엇을 덮어야 하는가\noutputs: [OntologyKind, OnticNode, ClassifyResult, CoverageReport]\n\nwrites:                         # O1 은 세계를 바꾸지 않는다 — 세계를 무엇으로 적을지 정한다.\n  - OnticNode\n\ndepends: [V1, V2, V0, V3, V4]   # 검증 기반 전체가 선 뒤에야 존재론을 등록할 수 있다\n\nsubtasks:                       # 상태 원소 12종 > 3종 → WORKFLOW §3 원소 묶음별 분할\n  - id: O1-a\n    name: being-triad\n    purpose: 존재론 골격을 세우고 Subject·Entity·State 를 정의한다.\n    status: DONE\n  - id: O1-b\n    name: operation-triad\n    purpose: 세계가 굴러가는 방식을 Rule·Phenomenon·Event 로 정의한다.\n    status: DONE\n  - id: O1-c\n    name: relation-triad\n    purpose: 주체가 세계에 거는 것을 Claim·Commitment·Affordance 로 정의한다.\n    status: DONE\n  - id: O1-d\n    name: demand-triad\n    purpose: 주체의 결핍과 세계에 대한 청구를 Dependency·Possibility·WorldRequirement 로 정의한다.\n    status: DONE\n  - id: O1-e\n    name: concept-coverage\n    purpose: 원문 개념 중 12타입으로 환원되지 않는 것이 남으면 그 사실을 드러낸다.\n    status: DONE\n\nscenarios:                      # 정상 1 + 실패 1 + 경계 1 (WORKFLOW §5.1)\n  - o1-catalog-covered          # 정상: 원문 개념 전부가 12타입으로 분류되고 남는 타입이 없다\n  - o1-unmapped-rejected        # 실패: 타입 없는 개념·어긴 필드가 경로와 사유로 지목된다\n  - o1-boundary                 # 경계: 빈 카탈로그 · 직렬화 불가 값 · kind 없는 값 · 중복 id\n\nelements:\n  - name: Subject\n    ontology: Subject\n    renderer: diff\n  - name: Entity\n    ontology: Entity\n    renderer: diff\n  - name: State\n    ontology: State\n    renderer: diff\n  - name: Rule\n    ontology: Rule\n    renderer: diff\n  - name: Phenomenon\n    ontology: Phenomenon\n    renderer: diff\n  - name: Claim\n    ontology: Claim\n    renderer: diff\n  - name: Commitment\n    ontology: Commitment\n    renderer: diff\n  - name: Affordance\n    ontology: Affordance\n    renderer: diff\n  - name: Event\n    ontology: Event\n    renderer: diff\n  - name: Dependency\n    ontology: Dependency\n    renderer: diff\n  - name: Possibility\n    ontology: Possibility\n    renderer: diff\n  - name: WorldRequirement\n    ontology: WorldRequirement\n    renderer: diff\n  - name: ConceptEntry\n    ontology: Claim              # 원문이 \"이 개념은 이 타입이다\" 라고 건 주장\n    renderer: diff\n  - name: CoverageReport\n    ontology: State              # 존재론이 지금 얼마나 덮고 있는가 — 검사 시점의 값\n    renderer: diff\n\nlab: /lab/o1                    # 원문 개념 ↔ 12타입 커버리지 표\n\nstatus: VERIFIED\nevidence: evidence/O1.json\n"
  },
  {
    "name": "O2.yaml",
    "text": "id: O2\nname: world-state-schema\npurpose: >\n  세계의 모든 상태 값을 9영역 필드 트리 하나로 표현하고, 그 트리에 없는 값을 거부한다.\n\ninputs: [DomainSpec, FieldSpec, State]      # 영역별 정의 + O1 State 원소\noutputs: [StateSchema, SchemaViolation, WorldState, StateDiffEntry]\n\nwrites:                         # O2 는 값을 바꾸지 않는다 — 값이 놓일 자리를 정한다.\n  - WorldState\n\ndepends: [V1, V2, V0, V3, V4, O1]\n\nsubtasks:                       # 새 상태 원소 3종 초과 → WORKFLOW §3 분할\n  - id: O2-a\n    name: domain-reconciliation\n    purpose: 원문 두 목록이 다르게 적은 상태 영역을 대조해 9영역으로 확정한다.\n    status: DONE\n  - id: O2-b\n    name: field-spec\n    purpose: 영역 안의 각 상태 필드가 가질 수 있는 값을 스펙으로 선언하고 위반을 사유로 돌려준다.\n    status: DONE\n  - id: O2-c\n    name: world-tree\n    purpose: 상태 원소 목록을 9영역 서브트리로 조립하고 다시 원소로 분해한다.\n    status: DONE\n  - id: O2-d\n    name: eye-check\n    purpose: 시나리오 3종과 Lab 상태 트리 뷰로 O2 를 눈으로 확인한다.\n    status: DONE\n\nscenarios:                      # 정상 1 + 실패 1 + 경계 1 (WORKFLOW §5.1)\n  - o2-scene-assembled          # 정상: 장면의 상태들이 9영역 트리로 서고 왕복해도 같다\n  - o2-offschema-rejected       # 실패: 스키마 밖 영역·경로·값·보유자가 각자의 사유로 거부된다\n  - o2-boundary                 # 경계: 빈 세계 · 범위 양끝 · 매개 경로 · 중복 상태\n\nelements:\n  - name: DomainSpec\n    ontology: State\n    renderer: diff\n  - name: DomainReconciliation\n    ontology: Claim             # 원문이 \"이 영역은 저 영역이다\" 라고 건 대조 주장\n    renderer: diff\n  - name: FieldSpec\n    ontology: Rule              # 어떤 값이 세계에 놓일 수 있는지를 정하는 규칙\n    renderer: diff\n  - name: WorldState\n    ontology: State\n    renderer: diff\n  - name: SchemaViolation\n    ontology: Claim             # 스키마가 값에 대해 내리는 판정\n    renderer: diff\n  - name: StateDiffEntry\n    ontology: State\n    renderer: diff\n\nlab: /lab/o2                    # 9영역 상태 트리 + 원문 필드 대조표\n\nstatus: VERIFIED\nevidence: evidence/O2.json\n"
  },
  {
    "name": "P0.yaml",
    "text": "id: P0\nname: action-atom\npurpose: >\n  가능성을 구성하는 최소 행동을 16원자로 확정하고, 각 원자가 무엇을 요구하고 세계의 어느 자리를\n  바꾸며 무엇을 치르는지를 못박는다.\n\ninputs: [ActionAtoms, StateSchema, DependencyKind, Affordance]\noutputs: [ActionAtomSpec, AtomResolution, AtomGrounding, ActionProposal, ActionFit, ActionAtomViolation]\n\nwrites: []                      # P0 도 세계를 바꾸지 않는다 — 무엇을 바꿀 수 있는지의 문법만 확정한다.\n\ndepends: [V1, V2, V0, V3, V4, O1, O2, O0, S0, S1, S2, S3, D0, D1, D2, D3, D4]\n\nsubtasks:                       # 목록 확정·세계 걸림·요청 문법은 검사기가 다르다 → WORKFLOW §3\n  - id: P0-a\n    name: atom-reconciliation\n    purpose: 원문이 흩어 적은 행동(P1 방향 7 · P2 예시 15)이 16원자로 남김없이 환원되는지 대조한다.\n    status: DONE\n  - id: P0-b\n    name: atom-grounding\n    purpose: 원자마다 무엇을 읽고 어느 자리를 바꾸고 무엇을 치르는지를 O2 실재 자리로 못박고, 접히는 원자·채울 수 없는 종을 드러낸다.\n    status: DONE\n  - id: P0-c\n    name: action-grammar\n    purpose: O1 이 열어 둔 `Affordance.action` 자리를 16종으로 닫고, 원자가 열지 않은 변경·대가 없는 행동·보지 않고 하는 조작을 거부한다.\n    status: DONE\n  - id: P0-d\n    name: eye-check\n    purpose: 시나리오 3종과 Lab 원자표로 P0 를 눈으로 확인한다.\n    status: DONE\n\nscenarios:                      # 정상 1 + 실패 1 + 경계 1 (WORKFLOW §5.1)\n  - p0-sixteen-atoms            # 정상: 원문이 흩어 적은 행동이 16원자로 환원되고, 굶주림 하나 앞에 원자가 갈린다\n  - p0-broken-actions-rejected  # 실패: 16종 밖의 행동·대가 없는 요청·보지 않은 조작이 각자의 사유로 거부된다\n  - p0-boundary                 # 경계: 아무 원자도 채우지 못하는 종(시간·규칙) · 짝 없는 원자 · 동의 축의 양끝\n\nelements:\n  - name: ActionAtom\n    ontology: Affordance        # 원자는 O1 Affordance 의 `action` 자리를 채우는 이름표다\n    renderer: diff\n\nlab: /lab/p0                    # 원자 16표(축·자리·대가) + 원문 환원 대조 + 굶주림 앞의 열여섯 + 거부 사유\n\nstatus: VERIFIED\nevidence: evidence/P0.json\n"
  },
  {
    "name": "P1.yaml",
    "text": "id: P1\nname: strategy-direction\npurpose: >\n  결핍된 의존마다 대응 방향 7종을 전개하고, 열리지 않는 방향은 왜 막혔는지를 함께 남긴다.\n\ninputs: [DependencyGraph, PressureReport, ActionAtom, AtomGrounding, KindGrounding]\noutputs: [StrategyDirectionSpec, DirectionResolution, StrategyOption, StrategyBranch, StrategyTree, StrategyViolation]\n\nwrites: []                      # P1 도 세계를 바꾸지 않는다 — 결핍 앞에 놓인 갈래만 펼친다.\n\ndepends: [V1, V2, V0, V3, V4, O1, O2, O0, S0, S1, S2, S3, D0, D1, D2, D3, D4, P0]\n\nsubtasks:                       # 방향 확정·열림 판정·트리 조립은 검사기가 다르다 → WORKFLOW §3\n  - id: P1-a\n    name: direction-set\n    purpose: 대응 방향 7종을 확정하고 각 방향이 어느 원자로 이루어지는지를 P0 환원표에 묶는다.\n    status: DONE\n  - id: P1-b\n    name: opening-rules\n    purpose: 결핍 하나 앞에서 각 방향이 열리는지 판정하고, 막힌 방향은 사유와 갚을 모듈을 남긴다.\n    status: DONE\n  - id: P1-c\n    name: strategy-tree\n    purpose: 압력이 있는 노드마다 갈래를 묶어 대응 트리를 세우고 해시를 고정한다.\n    status: DONE\n  - id: P1-d\n    name: eye-check\n    purpose: 시나리오 3종과 Lab 대응 트리로 P1 을 눈으로 확인한다.\n    status: DONE\n\nscenarios:                      # 정상 1 + 실패 1 + 경계 1 (WORKFLOW §5.1)\n  - p1-seven-directions         # 정상: 원문 물 부족 일곱 갈래가 방향 다섯으로 붙고, 굶주림 앞에 갈래가 펼쳐진다\n  - p1-broken-expansions-rejected # 실패: 결핍 없는 전개·남의 노드·원자가 어긋난 방향이 각자의 사유로 거부된다\n  - p1-boundary                 # 경계: 아무 방향도 열리지 않는 결핍 · 뿌리의 의존 제거 · 아직 눈이 없는 경쟁 제거\n\nelements:\n  - name: StrategyDirection\n    ontology: Possibility       # 방향 하나하나가 O1 Possibility 로 선다 — 아직 고르지 않은 갈래다\n    renderer: graph\n\nlab: /lab/p1                    # 대응 트리(결핍 → 방향) + 방향 7표 + 원문 예시 대조 + 막힌 사유\n\nstatus: VERIFIED\nevidence: evidence/P1.json\n"
  },
  {
    "name": "P2.yaml",
    "text": "id: P2\nname: possibility-grammar\npurpose: >\n  같은 결핍 앞에서도 주체 유형과 문화에 따라 다른 갈래가 나오게 한다 — 낼 손이 있는가,\n  낼 수 있어도 하지 않는가.\n\ninputs: [SubjectKind, SpeciesArchetype, CultureArchetype, RoleArchetype, ActionAtom, AtomGrounding, StrategyTree]\noutputs: [KindFooting, AccessRule, AbilityGrant, AtomBan, PossibilityGrammar, NarrowedTree, ExampleReport, GrammarViolation]\n\nwrites: []                      # P2 도 세계를 바꾸지 않는다 — 누가 무엇을 낼 수 있는지의 문법만 확정한다.\n\ndepends: [V1, V2, V0, V3, V4, O1, O2, O0, S0, S1, S2, S3, D0, D1, D2, D3, D4, P0, P1]\n\nsubtasks:                       # 접근 격자·문화 겹침·적용은 검사기가 다르다 → WORKFLOW §3\n  - id: P2-a\n    name: kind-access\n    purpose: S0 경계 4종을 접근 4종(직접·구성원·의념·막힘)으로 번역해 유형 × 원자 격자를 계산한다.\n    status: DONE\n  - id: P2-b\n    name: culture-overlay\n    purpose: 능력이 대가를 의념으로 옮기고 금기가 원자를 닫는 겹침을 세우고, 거짓 인용을 거부한다.\n    status: DONE\n  - id: P2-c\n    name: narrow-and-reconcile\n    purpose: 문법으로 P1 갈래를 좁히고(닫기만 한다), 원문 P2 다섯 줄이 격자에서 도출되는지 대조한다.\n    status: DONE\n  - id: P2-d\n    name: eye-check\n    purpose: 시나리오 3종과 Lab 격자·대조표로 P2 를 눈으로 확인한다.\n    status: DONE\n\nscenarios:                      # 정상 1 + 실패 1 + 경계 1 (WORKFLOW §5.1)\n  - p2-five-grammars            # 정상: 유형 다섯이 다른 손으로 내고, 원문 다섯 줄이 도출되며, 같은 종의 셋이 갈린다\n  - p2-broken-grammars-rejected # 실패: 몸 없는 자의 직접 행동·없는 능력·아무도 열지 않은 금기가 거부된다\n  - p2-boundary                 # 경계: 능력이 열지 못하는 자리 · 문화가 걸러 내는 원자 · 좁히기의 한 방향\n\nelements:\n  - name: PossibilityGrammar\n    ontology: Rule              # 문법은 그 주체에게 걸린 규칙이다 — 문화·역할과 같은 자리에 선다\n    renderer: diff\n\nlab: /lab/p2                    # 유형 × 원자 격자 80칸 + 원문 다섯 줄 대조 + 같은 종 셋의 갈림\n\nstatus: VERIFIED\nevidence: evidence/P2.json\n"
  },
  {
    "name": "P3.yaml",
    "text": "id: P3\nname: lazy-possibility-expansion\npurpose: >\n  모든 가능성을 미리 만들지 않고, 지금 보이는 것·기억·관계에 걸린 부분만 펼친다.\n\ninputs: [NarrowedTree, PossibilityGrammar, AtomGrounding, Percept, Memory, Relationship, Capability]\noutputs: [AtomPrerequisite, PrerequisiteReport, ContextFact, ExpansionContext, PossibilitySubgraph, ExpansionTrace, PossibilityGraphViolation]\n\nwrites: []                      # P3 도 세계를 바꾸지 않는다 — 무엇을 펼칠지만 정한다.\n\ndepends: [V1, V2, V0, V3, V4, O1, O2, O0, S0, S1, S2, S3, D0, D1, D2, D3, D4, P0, P1, P2]\n\nsubtasks:                       # 검증 장면이 넷이고 새 상태 원소가 3종을 넘는다 → WORKFLOW §3\n  - id: P3-a\n    name: atom-prerequisite\n    purpose: 원자 사이의 선행 관계를 손으로 적지 않고 P0 걸림(reads/writes/pays)에서 계산한다.\n    status: DONE\n  - id: P3-b\n    name: expansion-context\n    purpose: 지금 보이는 것·기억·관계·능력을 확장의 근거 하나로 세운다.\n    status: DONE\n  - id: P3-c\n    name: subgraph-assembly\n    purpose: 근거에 걸린 가능성만 펼쳐 활성 부분 그래프를 세우고 preconditionIds 를 채운다.\n    status: DONE\n  - id: P3-d\n    name: eye-check\n    purpose: 시나리오 3종과 Lab 부분 그래프(전체 회색·활성 발광)로 P3 를 눈으로 확인한다.\n    status: DONE\n\nscenarios:                      # 정상 1 + 실패 1 + 경계 1 (WORKFLOW §5.1)\n  - p3-expands-relevant-only    # 정상: 같은 갈래 앞에서 본 것이 다른 셋이 서로 다른 부분만 편다\n  - p3-broken-expansion-rejected # 실패: 거짓 근거·없는 노드·서지 않은 선행이 각각의 사유로 거부된다\n  - p3-boundary                 # 경계: 아무것도 못 봐도 찾기는 서고, 어긋난 기억은 stale 로 남는다\n\nelements:\n  - name: ContextFact\n    ontology: State             # 주체가 지금 딛고 선 사실 하나 — 출처 4종을 한 모양으로\n    renderer: diff\n  - name: AtomPrerequisite\n    ontology: Rule              # 원자 사이에 걸린 규칙 — 세계가 아니라 문법에 선다\n    renderer: graph\n  - name: PossibilitySubgraph\n    ontology: Possibility\n    renderer: graph             # 전체 회색, 활성 부분 발광 (MODULES.md P3 행)\n  - name: ExpansionTrace\n    ontology: State             # 왜 폈는가 / 왜 안 폈는가 — 사유 6종\n    renderer: diff\n\nlab: /lab/p3\n\nstatus: VERIFIED\nevidence: evidence/P3.json\n"
  },
  {
    "name": "P4.yaml",
    "text": "id: P4\nname: goal-selection\npurpose: >\n  펴 놓은 가능성 중 실제로 추구할 목적 하나를 고르고, 매 틱 흔들리지 않게 관성을 준다.\n\n# 원문 P4 의 평가 요소 아홉은 P4 가 손으로 적지 않는다 — 아래 입력이 그 아홉을 실어 나른다.\n#   압력=NarrowedTree.branches[].pressure (D4 가 재고 P1 이 갈래에 붙인 값 — 두 곳에서 재지 않는다)\n#   성공률·기억=ExpansionContext/ExpansionTrace · 비용·관계·약속=WorldState\n#   가치관=SubjectInstance.values(S0 ValueTarget.weight) · 매몰비용=이전 틱의 ActiveGoal\ninputs: [PossibilitySubgraph, ExpansionContext, ExpansionTrace, NarrowedTree, SubjectInstance, WorldState, ActiveGoal]\noutputs: [PaymentRequirement, PayabilityReport, GoalFactor, GoalScore, ActiveGoal, GoalViolation]\n\nwrites: []                      # P4 도 세계를 바꾸지 않는다 — 무엇을 좇을지만 정한다.\n\ndepends: [V1, V2, V0, V3, V4, O1, O2, O0, S0, S1, S2, S3, D0, D1, D2, D3, D4, P0, P1, P2, P3]\n\nsubtasks:                       # 검증 장면이 넷이고 새 상태 원소가 3종을 넘는다 → WORKFLOW §3\n  - id: P4-a\n    name: payment-verdict\n    purpose: 치를 자리가 비었을 때 그것이 먼저 할 일인지 브레이크가 없는 것인지 세계와 맞대어 판정한다.\n    status: DONE\n  - id: P4-b\n    name: goal-factors\n    purpose: 원문 평가 요소 아홉을 손으로 적지 않고 앞 계층에서 읽어 한 모양으로 세운다.\n    status: DONE\n  - id: P4-c\n    name: score-and-inertia\n    purpose: 요소를 점수로 접어 후보를 세우고 이전 목적에 관성을 주어 매 틱 흔들리지 않게 한다.\n    status: DONE\n  - id: P4-d\n    name: eye-check\n    purpose: 시나리오 3종과 Lab 점수표(선택 마크 + 관성 여유선)로 P4 를 눈으로 확인한다.\n    status: DONE\n\nscenarios:                      # 정상 1 + 실패 1 + 경계 1 (WORKFLOW §5.1)\n  - p4-picks-under-pressure     # 정상: 압력 1위가 항상 뽑히지는 않는다 — 선행과 치를 것이 뒤집는다\n  - p4-broken-selection-rejected # 실패: 출처 없는 요소·회색을 고른 목적·재계산되지 않는 점수가 거부된다\n  - p4-boundary                 # 경계: 후보가 없으면 목적도 없고, 관성은 사라진 목적을 붙들지 않는다\n\nelements:\n  - name: PaymentRequirement\n    ontology: Rule              # 원자와 세계 사이에 걸린 규칙 — 치를 자리 하나의 판정\n    renderer: gauge\n  - name: GoalFactor\n    ontology: State             # 후보 하나를 밀거나 당기는 힘 하나 — 출처가 앞 계층이다\n    renderer: gauge\n  - name: GoalScore\n    ontology: State             # 요소들을 접은 한 값 + 그 값이 어디서 왔는가\n    renderer: gauge\n  - name: ActiveGoal\n    ontology: Possibility       # 고른 목적은 그 가능성 자체다 — 새 타입을 만들지 않는다\n    renderer: gauge             # 후보별 점수표 + 선택 마크 (MODULES.md P4 행)\n\nlab: /lab/p4\n\nstatus: VERIFIED\nevidence: evidence/P4.json\n"
  },
  {
    "name": "P5.yaml",
    "text": "id: P5\nname: action-planning\npurpose: >\n  고른 목적을 실제 행동 단위까지 분해한다 — 원자 하나가 아니라 순서열이 되는 자리다.\n\n# 계획의 순서는 P5 가 정하지 않는다 — 아래 입력이 이미 \"먼저\" 를 지고 있다.\n#   원자 사이의 먼저=AtomPrerequisite(P3-a) · 세계와 맞댄 먼저 낼 원자=PayabilityReport(P4-a)\n#   무엇을 좇는가=ActiveGoal(P4) · 지금 무엇이 보이는가=ExpansionContext(P3-b)\ninputs: [ActiveGoal, AtomPrerequisite, PayabilityReport, ExpansionContext, WorldState]\noutputs: [PlanStep, ActionPlan, ChainResolution, ChainReport, PlanViolation]\n\nwrites: []                      # P5 도 세계를 바꾸지 않는다 — 무엇을 어떤 순서로 낼지만 정한다.\n\ndepends: [V1, V2, V0, V3, V4, O1, O2, O0, S0, S1, S2, S3, D0, D1, D2, D3, D4, P0, P1, P2, P3, P4]\n\nsubtasks:                       # 검증 장면이 넷이고 새 상태 원소가 3종을 넘는다 → WORKFLOW §3\n  - id: P5-a\n    name: plan-chain\n    purpose: 고른 목적 하나에서 뒤로 거슬러 지금 낼 수 있는 원자까지 사슬을 세운다.\n    status: DONE\n  - id: P5-b\n    name: chain-reconciliation\n    purpose: 원문 P5 가 든 일곱 단계가 16원자를 지나 이 사슬에서 도출되는지 대조한다.\n    status: DONE\n  - id: P5-c\n    name: timeline-renderer\n    purpose: 공용 렌더러 5종 중 넷째(타임라인)를 세운다 — 순서가 있는 것을 순서대로 그린다.\n    status: DONE\n  - id: P5-d\n    name: eye-check\n    purpose: 시나리오 3종과 Lab 타임라인으로 P5 를 눈으로 확인한다.\n    status: DONE\n\nscenarios:                      # 정상 1 + 실패 1 + 경계 1 (WORKFLOW §5.1)\n  - p5-plans-the-chain          # 정상: 한 걸음처럼 보이던 목적이 세계에 따라 다른 길이로 펴진다\n  - p5-broken-plan-rejected     # 실패: 끊긴 사슬·순서가 뒤집힌 걸음·자기를 딛는 걸음이 거부된다\n  - p5-boundary                 # 경계: 지금 바로 낼 수 있으면 사슬은 한 칸이고, 닿지 못해도 던지지 않는다\n\nelements:\n  - name: PlanStep\n    ontology: Possibility       # 걸음 하나도 아직 일어나지 않은 것이다\n    renderer: timeline\n  - name: ActionPlan\n    ontology: Possibility       # 계획은 아직 일어나지 않은 것이다 — 세계에 적히는 것은 R 계층부터\n    renderer: timeline          # 계획 단계 목록 (MODULES.md P5 행) — P5-c 가 세우는 렌더러다\n  - name: ChainResolution\n    ontology: Rule              # 원문 이름 하나가 원자로 접히는 규칙 (P0 환원표와 같은 모양)\n    renderer: diff\n\nlab: /lab/p5\n\nstatus: VERIFIED\nevidence: evidence/P5.json\n\n# P4 가 P5 에 넘긴 자리 (착수 시 카드로 옮긴다):\n#   - 갈래를 낼 원자는 P4 가 가장 나은 하나로 접었다. 순서열로 펴는 것은 여기다.\n#   - 선행 사슬은 아직 한 칸이다(P3-c). 긴 사슬(찾기 → 만들기 → 빼앗기)이 여기서 선다.\n#   - 재료 선행의 \"먼저 낼 원자\"(PayabilityReport.blockedBy)가 계획의 앞칸이 된다.\n"
  },
  {
    "name": "R0.yaml",
    "text": "id: R0\nname: world-state-store\npurpose: >\n  정식화된 세계의 실제 상태를 원장 하나에 담고 시간을 가로질러 조회한다 — 지금까지 세계는\n  값으로만 있었고 주인이 없었다.\n\n# R0 은 세계를 새로 만들지 않는다. 조립 관문은 O2(`assembleWorld`)가, 스냅샷의 모양은\n# D4(`WorldSnapshot`)가 이미 세웠고, 시간은 V1 TickClock 이 준다. R0 이 더하는 것은\n# **주인과 열**이다: 담는 것(원장) · 지우지 않는 것(사슬 해시) · 시간을 가로질러 읽는 것(조회).\ninputs: [State, StateSchema, Tick, CommitCause]\noutputs: [WorldStateSnapshot, WorldStateStore, CommitResult, SnapshotQuery, SlotReading, SlotHistoryEntry, LedgerDiff, StoreViolation]\n\nwrites: []                      # R0 은 담을 뿐이다 — 세계를 바꾸는 것은 R1 사건이고, 그 자리(cause.eventIds)를 비워 둔다.\n\ndepends: [V1, V2, V0, V3, V4, O1, O2, O0, S0, S1, S2, S3, D0, D1, D2, D3, D4]\n\nsubtasks:                       # 검증 장면이 셋이다 → WORKFLOW §3\n  - id: R0-a\n    name: ledger-commit\n    purpose: 세계를 담을 주인을 세우고, 담을 수 없는 커밋을 거부한다.\n    status: DONE\n  - id: R0-b\n    name: time-queries\n    purpose: 원장 위에서 임의의 틱·자리·구간을 읽는다.\n    status: DONE\n  - id: R0-c\n    name: eye-check\n    purpose: 시나리오 3종과 Lab 상태 브라우저로 R0 를 눈으로 확인한다.\n    status: DONE\n\nscenarios:                      # 정상 1 + 실패 1 + 경계 1 (WORKFLOW §5.1)\n  - r0-keeps-the-ledger         # 정상: 열 틱을 담으면 여섯이 남고, 시간을 가로질러 읽히며, 다시 세워도 같은 지문이다\n  - r0-broken-commit-rejected   # 실패: 뒤로 가는 틱·같은 틱·근거 없는 커밋·어긴 값·손댄 과거가 각자의 사유로 거부된다\n  - r0-boundary                 # 경계: 빈 세계의 genesis · 첫 스냅샷 이전 조회 · 한 번도 바뀌지 않은 자리의 역사\n\nelements:\n  - name: WorldStateSnapshot\n    ontology: State             # 스냅샷은 그 틱에 선 State 들의 묶음이다 (O2 왕복 성질을 그대로 쓴다)\n    renderer: diff              # 상태 브라우저 (MODULES.md R0 행)\n\nlab: /lab/r0\n\nstatus: VERIFIED\nevidence: evidence/R0.json\n\n# R0 이 R1 에 넘기는 자리:\n#   - `CommitCause.eventIds` 는 비어 있다 — R0 은 근거의 **자리**만 열고, 사건 id 로 채우는 것은 R1 이다.\n#   - R0 은 세계를 바꾸지 않는다. 커밋은 밖에서 들어온 세계를 담을 뿐이고, 무엇이 바뀌었는지는\n#     O2 `worldDiff` 가 말한다 — 변경을 만드는 문법은 R1·R2 의 몫이다.\n"
  },
  {
    "name": "R1.yaml",
    "text": "id: R1\nname: event-sourced-mutation\npurpose: >\n  세계의 모든 상태 변화를 사건으로만 허용한다 — 사건 없이 담긴 칸은 원장 감사에서 걸린다.\n\n# R1 도 새 문법을 지어내지 않는다. 무엇을 바꿀 수 있는지는 P0-b 걸림이, 요청이 설 수 있는지는\n# P0-c `fitAction` 이, 사건이 무엇으로 이루어지는지는 O1 `Event` 가, 담기는 규칙은 R0 이 이미 정했다.\n# R1 이 더하는 것은 **통로**다: 세계를 바꾸는 길이 사건 하나뿐이 되게 하는 것.\ninputs: [ActionProposal, WorldStateStore, WorldState, Tick]\noutputs: [WorldEvent, EventEffect, EventLog, ApplyResult, EventViolation, CommitResult]\n\nwrites: []                      # 사건이 바꾸는 자리는 P0-b 가 원자마다 못박은 자리뿐이다 — R1 은 그 밖을 열지 않는다.\n\ndepends: [V1, V2, V0, V3, V4, O1, O2, O0, S0, S1, S2, S3, D0, D1, D2, D3, D4, P0, R0]\n\nsubtasks:                       # 검증 장면이 셋이다 → WORKFLOW §3\n  - id: R1-a\n    name: event-shape\n    purpose: 행동 요청 하나를 세계에 낼 수 있는 사건으로 세운다.\n    status: DONE\n  - id: R1-b\n    name: event-application\n    purpose: 사건을 R0 원장에 적용하고, 사건 없이 담긴 칸을 찾아낸다.\n    status: DONE\n  - id: R1-c\n    name: eye-check\n    purpose: 시나리오 3종과 Lab 사건 로그로 R1 을 눈으로 확인한다.\n    status: PLANNED\n\nscenarios:                      # 정상 1 + 실패 1 + 경계 1 (WORKFLOW §5.1)\n  - r1-events-move-the-world    # 정상: 겨울이 사건으로 다시 서고, 모든 칸이 사건 id 를 가리킨다\n  - r1-silent-change-rejected   # 실패: 원자 밖의 변경·낡은 전제·되돌릴 수 없는 것의 되돌림·사건 없는 칸이 거부된다\n  - r1-boundary                 # 경계: 바닥난 창고에서 먹는 사건 · 자연 발생(유예) · 사건 하나짜리 로그\n\nelements:\n  - name: WorldEvent\n    ontology: Event             # O1 이 이미 연 자리를 채운다 — 새 타입을 만들지 않는다\n    renderer: timeline          # 사건 로그 (MODULES.md R1 행) — P5-c 가 세운 공용 렌더러 ④\n\nlab: /lab/r1\n\nstatus: IN_PROGRESS\n\n# R1 이 뒤 계층에 넘기는 자리:\n#   - 자연 발생 사건(actorId null)은 유예다 — 규칙이 실체화(W2)되어야 근거를 댈 수 있다.\n#   - 사건이 남기는 관찰 가능한 흔적(Phenomenon)은 R2 의 몫이다 — R1 은 사건까지만 만든다.\n#   - 같은 틱에 같은 자리를 다투는 사건 둘의 판정은 D5·E0 의 몫이다.\n"
  },
  {
    "name": "S0.yaml",
    "text": "id: S0\nname: common-subject-model\npurpose: >\n  사람·생물·조직·국가·신이 하나의 공통 인터페이스로 서서 다섯 질문(감지·의존·능력·기억·유지)에 전부 답하게 한다.\n\ninputs: [SubjectSpec, SpeciesDefinition, StateSchema]   # 주체 선언 + O0 종 정의 + O2 자리\noutputs: [SubjectProfile, SubjectViolation, FiveQuestionReport]\n\nwrites:                         # S0 는 값을 바꾸지 않는다 — 주체가 무엇으로 이루어지는지를 정한다.\n  - Subject\n  - Boundary\n\ndepends: [V1, V2, V0, V3, V4, O1, O2, O0]\n\nsubtasks:                       # 상태 원소 5종 · 검증 장면 다수 → WORKFLOW §3 분할\n  - id: S0-a\n    name: subject-boundary\n    purpose: 주체 종류마다 어디까지가 자기인지를 경계로 밝히고, 매달 그래프 4종의 자리를 유래에서 연다.\n    status: DONE\n  - id: S0-b\n    name: perception-profile\n    purpose: 주체가 현상 통로 6종 중 무엇을 얼마나 감지하는지 선언하고 감지 여부를 판정한다.\n    status: DONE\n  - id: S0-c\n    name: stake-slots\n    purpose: 주체가 무너지지 않으려 지키는 자리(의존)와 밀고 가려는 자리(유지)를 O2 자리로 못박는다.\n    status: DONE\n  - id: S0-d\n    name: subject-profile\n    purpose: 경계·감지·의존·유지·능력을 한 주체 프로필로 합치고 종 정의와 어긋나면 거부한다.\n    status: DONE\n  - id: S0-e\n    name: five-questions\n    purpose: 모든 주체가 다섯 질문에 답할 수 있는지 응답표로 판정한다.\n    status: DONE\n  - id: S0-f\n    name: eye-check\n    purpose: 시나리오 3종과 Lab 주체 카드로 S0 를 눈으로 확인한다.\n    status: DONE\n\nscenarios:                      # 정상 1 + 실패 1 + 경계 1 (WORKFLOW §5.1)\n  - s0-five-kinds-answer        # 정상: 사람·생물·조직·국가·신 다섯이 다섯 질문에 전부 답한다\n  - s0-mute-subjects-rejected   # 실패: 답 못 하는 주체가 어느 질문의 어느 자리에서 왜 막히는지 나온다\n  - s0-boundary                 # 경계: 빈 경계 · 자기 참조 · 임계 감도 · 종 정의와의 어긋남\n\nelements:\n  - name: SubjectProfile\n    ontology: Subject           # O1 Subject 를 확장한다 — 필드를 빼지 않고 더한다\n    renderer: diff\n  - name: Boundary\n    ontology: Affordance        # \"여기까지가 나\" 는 세계가 이 주체에게 여는 범위다\n    renderer: diff\n  - name: PerceptionProfile\n    ontology: Affordance        # 현상 통로가 이 주체에게 열려 있는 정도\n    renderer: diff\n  - name: Need\n    ontology: Dependency        # 무너지지 않으려 지켜야 하는 자리\n    renderer: diff\n  - name: ValueTarget\n    ontology: Commitment        # 주체가 스스로에게 건 방향 — 무너지지는 않지만 밀고 간다\n    renderer: diff\n\nlab: /lab/s0                    # 주체 5종 카드 + 5질문 응답표 + 거부 사유\n\nstatus: VERIFIED\nevidence: evidence/S0.json\n"
  },
  {
    "name": "S1.yaml",
    "text": "id: S1\nname: species-archetype\npurpose: >\n  종의 신체·감각·생애·기본 의존을 한 원형으로 세우고, 개체의 감각과 붕괴 시한이 그 원형에서 나오게 한다.\n\ninputs: [SpeciesSpec, SpeciesDefinition, StateSchema]   # 종 선언 + O0 종 정의 + O2 자리\noutputs: [SpeciesArchetype, SpeciesViolation, SpeciesSeed]\n\nwrites:                         # S1 은 값을 바꾸지 않는다 — 개체가 무엇을 물려받는지를 정한다.\n  - SpeciesArchetype\n  - PerceptionProfile           # S0 이 개체마다 손으로 적던 것이 여기서 온다\n  - Need                        # 같음 — collapseAfterTicks 는 단계의 대사에서 나온다\n\ndepends: [V1, V2, V0, V3, V4, O1, O2, O0, S0]\n\nsubtasks:                       # 상태 원소 5종 · 검증 장면 다수 → WORKFLOW §3 분할\n  - id: S1-a\n    name: body-plan\n    purpose: 종이 갖는 기관을 선언하고, 몸의 유무가 생물 영역 자리와 맞물리게 한다.\n    status: DONE\n  - id: S1-b\n    name: species-senses\n    purpose: 감각을 종으로 올리고, 몸을 거치는 통로는 그것을 여는 기관을 요구한다.\n    status: DONE\n  - id: S1-c\n    name: lifecycle\n    purpose: 성장 단계를 O2 growthStage 선택지로 못박고 대사에서 붕괴 시한을 파생한다.\n    status: DONE\n  - id: S1-d\n    name: base-needs\n    purpose: 종이 정하는 의존 템플릿에서 개체의 Need 를 찍어 낸다.\n    status: DONE\n  - id: S1-e\n    name: archetype\n    purpose: 넷을 한 원형으로 합치고 개체 씨앗(SpeciesSeed)을 낸다.\n    status: DONE\n  - id: S1-f\n    name: eye-check\n    purpose: 시나리오 3종과 Lab 종 카드로 S1 을 눈으로 확인한다.\n    status: DONE\n\nscenarios:                      # 정상 1 + 실패 1 + 경계 1 (WORKFLOW §5.1)\n  - s1-five-species-stand       # 정상: 종 다섯이 서고 그 종에서 태어난 개체가 S0 을 지난다\n  - s1-broken-species-rejected  # 실패: 설 수 없는 종 14종이 각자의 사유·경로로 거부된다\n  - s1-boundary                 # 경계: 단계의 끝 · 대사의 양끝 · 감각 배수 클램프 · 빈 목록\n\nelements:\n  - name: SpeciesArchetype\n    ontology: Rule              # O0 SpeciesDefinition 을 확장한다 — 필드를 빼지 않고 더한다\n    renderer: diff\n  - name: BodyPlan\n    ontology: Affordance        # 몸이 이 종에게 여는 것 — 기관이 통로를 연다\n    renderer: diff\n  - name: SenseSpec\n    ontology: Affordance        # 현상 통로가 이 종에게 열려 있는 정도\n    renderer: diff\n  - name: LifeStage\n    ontology: State             # 세계에 적히는 값 — O2 biological.growthStage · metabolism\n    renderer: diff\n  - name: NeedTemplate\n    ontology: Dependency        # 이 종이 무너지지 않으려 지켜야 하는 자리 (D2 의 씨앗)\n    renderer: diff\n\nlab: /lab/s1                    # 종 카드 5종 + 같은 종 세 단계 대조 + 거부 사유\n\nstatus: VERIFIED\nevidence: evidence/S1.json\n"
  },
  {
    "name": "S2.yaml",
    "text": "id: S2\nname: culture-role-archetype\npurpose: >\n  같은 종에서 태어난 둘이 문화·역할에 따라 같은 세계를 다르게 읽고 다른 것을 원하고 다른 것을 할 수 있게 한다.\n\ninputs: [CultureSpec, RoleSpec, SpeciesArchetype, SpeciesSeed]   # 문화·역할 선언 + S1 종 원형·씨앗\noutputs: [CultureArchetype, RoleArchetype, CultureViolation, SubjectSeed]\n\nwrites:                         # S2 도 값을 바꾸지 않는다 — 개체가 종 위에 무엇을 더 얹는지를 정한다.\n  - CultureArchetype\n  - RoleArchetype\n  - ValueTarget                 # S0 이 개체마다 손으로 적던 것이 여기서 온다\n  - Claim                       # 문화의 읽기가 개체의 믿음이 된다\n\ndepends: [V1, V2, V0, V3, V4, O1, O2, O0, S0, S1]\n\nsubtasks:                       # 상태 원소 4종 · 검증 장면 다수 → WORKFLOW §3 분할\n  - id: S2-a\n    name: reading\n    purpose: 문화가 같은 현상을 무엇으로 읽는지 선언하고, 종이 열지 않은 통로는 읽지 못하게 한다.\n    status: DONE\n  - id: S2-b\n    name: value-template\n    purpose: 문화·역할이 개체에게 주는 유지 자리를 템플릿으로 정하고 개체의 ValueTarget 으로 찍어 낸다.\n    status: DONE\n  - id: S2-c\n    name: role\n    purpose: 역할이 능력을 더하고(입문 의례) 막는다(금기) — 행동 가능성이 자리에서 갈린다.\n    status: DONE\n  - id: S2-d\n    name: culture-archetype\n    purpose: 읽기·원함·역할을 한 문화 원형으로 합치고 종 씨앗 위에 겹쳐 개체 씨앗을 낸다.\n    status: DONE\n  - id: S2-e\n    name: eye-check\n    purpose: 시나리오 3종과 Lab 문화·역할 카드로 S2 를 눈으로 확인한다.\n    status: DONE\n\nscenarios:                      # 정상 1 + 실패 1 + 경계 1 (WORKFLOW §5.1)\n  - s2-same-species-diverges    # 정상: 같은 종의 둘이 문화로 갈리고 그 개체가 S0 을 지난다\n  - s2-broken-cultures-rejected # 실패: 설 수 없는 문화·역할이 각자의 사유·경로로 거부된다\n  - s2-boundary                 # 경계: 전부 금기 · 확신의 양끝 · 빈 목록 · 역할 없는 문화\n\nelements:\n  - name: CultureArchetype\n    ontology: Rule              # \"이 문화에 속한 자는 이렇게 읽고 이것을 원한다\" — 조건→효과의 서술\n    renderer: diff\n  - name: ReadingRule\n    ontology: Claim             # 문화가 낳는 믿음의 틀 — 실제와 어긋날 수 있다\n    renderer: diff\n  - name: ValueTemplate\n    ontology: Commitment        # 주체가 스스로에게 건 방향 (S0 ValueTarget 과 같은 분류)\n    renderer: diff\n  - name: RoleArchetype\n    ontology: Rule              # 문화 안의 자리 — 무엇을 열고 무엇을 막는가\n    renderer: diff\n\nlab: /lab/s2                    # 문화 카드 + 같은 종 두 문화 대조 + 거부 사유\n\nstatus: VERIFIED\nevidence: evidence/S2.json\n"
  },
  {
    "name": "S3.yaml",
    "text": "id: S3\nname: subject-instance\npurpose: >\n  종·문화·역할 위에 이력과 성격을 얹어 개별 주체를 낳고, 그 주체의 모든 값이 어디서 왔는지를 댈 수 있게 한다.\n\ninputs: [SpeciesArchetype, CultureArchetype, RoleArchetype, PastEvent, Trait]\noutputs: [SubjectInstance, Provenance, InstanceViolation]\n\nwrites:                         # S3 도 시뮬레이션을 돌리지 않는다 — 개체가 태어날 때의 첫 값을 정한다.\n  - SubjectInstance\n  - State                       # 과거가 지금 남긴 값 (relational.grudge, informational.knows, …)\n\ndepends: [V1, V2, V0, V3, V4, O1, O2, O0, S0, S1, S2]\n\nsubtasks:                       # 상태 원소 4종 · 검증 장면 다수 → WORKFLOW §3 분할\n  - id: S3-a\n    name: past-event\n    purpose: 지나간 사건이 지금의 자리에 남긴 값으로만 개체에 걸리게 한다 — 흔적 없는 과거는 과거가 아니다.\n    status: DONE\n  - id: S3-b\n    name: trait\n    purpose: 성격이 이미 있는 값을 흔들 뿐 새 자리를 만들지 못하게 한다.\n    status: DONE\n  - id: S3-c\n    name: instance\n    purpose: 종·문화·역할·이력·성격을 한 개체로 합치고 모든 값에 유래를 붙인다.\n    status: DONE\n  - id: S3-d\n    name: eye-check\n    purpose: 시나리오 3종과 Lab 개별 주체 카드로 S3 를 눈으로 확인한다.\n    status: DONE\n\nscenarios:                      # 정상 1 + 실패 1 + 경계 1 (WORKFLOW §5.1)\n  - s3-same-culture-diverges    # 정상: 같은 문화의 둘이 이력·성격으로 갈리고 모든 값이 유래를 댄다\n  - s3-broken-instances-rejected # 실패: 설 수 없는 이력·성격·개체가 각자의 사유로 거부된다\n  - s3-boundary                 # 경계: 이력 없음 · 성격 없음 · 배수의 양끝 · 유래 완결\n\nelements:\n  - name: SubjectInstance\n    ontology: Subject           # S0 SubjectProfile 을 확장한다 — 필드를 빼지 않고 더한다\n    renderer: diff\n  - name: PastEvent\n    ontology: Event             # 실제로 일어난 일 — 상태를 바꾸지 않으면 사건이 아니다 (O1)\n    renderer: diff\n  - name: Residue\n    ontology: State             # 과거가 지금 남긴 값 — O2 의 실재하는 자리에만 적힌다\n    renderer: diff\n  - name: Trait\n    ontology: Rule              # \"이 개체에게서는 이 값이 이렇게 흔들린다\" 는 서술\n    renderer: diff\n\nlab: /lab/s3                    # 개별 주체 카드 (값마다 유래 배지) + 같은 문화 두 개체 대조 + 거부 사유\n\nstatus: VERIFIED\nevidence: evidence/S3.json\n"
  },
  {
    "name": "V0.yaml",
    "text": "id: V0\nname: module-contract-registry\npurpose: >\n  모든 모듈의 목적·입출력·의존·검증 상태를 등록하고 결함 계약을 사유와 함께 거부한다.\n\ninputs: [ContractSource, Evidence, ModuleSourceSpec]\noutputs: [ModuleRegistry, ModuleContract, ContractViolation]\n\nwrites:                         # V0 은 세계 상태를 쓰지 않는다 — 계약 등록 상태만 만든다.\n  - ModuleContract\n  - ModuleStatus\n\ndepends: [V1, V2]               # 안정 정렬·상태 해시(V1) 로 판정하고, 검증은 V2 실행기로 한다\n\nsubtasks:\n  - id: V0-a\n    name: contract-yaml-parser\n    purpose: MODULE.yaml 서식을 읽고 서식 밖 문법을 줄 번호와 함께 거부한다.\n    status: DONE\n  - id: V0-b\n    name: registry-checker\n    purpose: 파싱된 계약을 등록하며 결함 계약을 거부하고 의존 DAG 를 계산한다.\n    status: DONE\n  - id: V0-c\n    name: evidence-crosscheck\n    purpose: 실제 계약을 실제 증거·소스 해시와 대조해 evidence-unsupported 관문을 실전에서 돌린다.\n    status: DONE\n\nscenarios:\n  - v0-registry-accepts         # 정상: 온전한 계약 등록 + 위상 순서 + 착수 가능 목록\n  - v0-rejects-defective        # 실패: 목적/입출력/시나리오/증거 없음 · 순환 의존 거부\n  - v0-boundary                 # 경계: 계약 0개 · 파싱 실패 · 중복 ID · 없는 의존 · 미검증 의존\n  - v0-evidence-crosscheck      # 정상: 증거가 뒷받침하면 등록 + 착수 가능 목록이 계산된다\n  - v0-crosscheck-rejects       # 실패: 강등된 증거 · 낡은 증거(소스 변경) · 없는 증거 기각\n  - v0-crosscheck-boundary      # 경계: 증거 맵을 안 넘기면 관문이 돌지 않는다 · PLANNED 는 증거 없이 등록\n\nelements:\n  - name: ModuleContract\n    ontology: Rule\n    renderer: graph\n  - name: ModuleStatus\n    ontology: State\n    renderer: graph\n\nlab: /lab/v0                    # V3 미구현 — packages/scenarios/verify/v0.ts 가 같은 7요소를 출력한다.\n\nstatus: VERIFIED\nevidence: evidence/V0.json\n"
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
    "text": "id: V4\nname: completion-evidence\npurpose: >\n  검증 산출물에서만 완료 상태를 결정해, 완료를 임의로 선언하지 못하게 한다.\n\ninputs: [EvidenceInput, EvidenceJob]\noutputs: [Evidence, PromotionCheck, EvidenceTrace]\n\nwrites:\n  - Evidence\n  - ModuleStatus\n  - EvidenceTrace\n\ndepends: [V1, V2, V0]           # 해시(V1) · 시나리오 결과(V2) · 계약(V0) 을 재료로 삼는다\n\nscenarios:\n  - v4-evidence-verified        # 정상: 전부 통과한 산출물 → VERIFIED 증거 + 완료 전이 허용\n  - v4-refuses-unverified       # 실패: 시나리오/테스트/커버리지/결정성 미달 → 전이 거부\n  - v4-boundary                 # 경계: 증거 없음 · 낡은 증거(소스 변경) · 시나리오 0개 · 테스트 0개\n  - v4-recording-batch          # 정상: 검증 전량 뒤 일괄 기록 → 뒤 모듈이 온전히 선다\n  - v4-recording-eager          # 실패: 즉시 기록 → 같은 재료로도 뒤 모듈이 강등된다 (#662 재현)\n  - v4-recording-boundary       # 경계: 작업 0개·1개는 순서 문제가 생길 수 없다\n\nelements:\n  - name: Evidence\n    ontology: Claim\n    renderer: diff\n  - name: EvidenceTrace\n    ontology: Event\n    renderer: diff\n\nlab: /lab/v4                    # V3 미구현 — packages/scenarios/verify/v4.ts 가 같은 7요소를 출력한다.\n\nstatus: VERIFIED\nevidence: evidence/V4.json\n"
  }
];

export const EVIDENCE: Readonly<Record<string, Evidence>> = {
  "D0": {
    "module": "D0-dependency-kind",
    "sourceHash": "ae92f218f5b366cc",
    "unitTests": "passed",
    "propertyTests": "passed",
    "labScenarios": "manual",
    "integrationScenario": "passed",
    "replayHash": "dcceedac282e7174",
    "status": "VERIFIED",
    "blockers": [],
    "detail": {
      "generator": "packages/lab/verify/evidence.ts",
      "labSubstitute": "packages/lab/verify/v3.ts — 본 검증은 브라우저 /lab/d0 (npm run dev --workspace @hkt/lab)",
      "testPackage": "packages/core",
      "coverage": {
        "module": "D0",
        "normal": 1,
        "failure": 1,
        "boundary": 1,
        "complete": true
      },
      "tests": {
        "total": 988,
        "passed": 988
      },
      "scenarios": {
        "total": 3,
        "passed": 3,
        "failed": 0,
        "coverageComplete": true,
        "byId": {
          "d0-one-rule-three-kinds": "passed",
          "d0-broken-kinds-rejected": "passed",
          "d0-boundary": "passed"
        }
      }
    }
  },
  "D1": {
    "module": "D1-dependency-graph-schema",
    "sourceHash": "ac64a714cde9810b",
    "unitTests": "passed",
    "propertyTests": "passed",
    "labScenarios": "manual",
    "integrationScenario": "passed",
    "replayHash": "80ac8e057267a0f8",
    "status": "VERIFIED",
    "blockers": [],
    "detail": {
      "generator": "packages/lab/verify/evidence.ts",
      "labSubstitute": "packages/lab/verify/v3.ts — 본 검증은 브라우저 /lab/d1 (npm run dev --workspace @hkt/lab)",
      "testPackage": "packages/core",
      "coverage": {
        "module": "D1",
        "normal": 1,
        "failure": 1,
        "boundary": 1,
        "complete": true
      },
      "tests": {
        "total": 988,
        "passed": 988
      },
      "scenarios": {
        "total": 3,
        "passed": 3,
        "failed": 0,
        "coverageComplete": true,
        "byId": {
          "d1-winter-food-graph": "passed",
          "d1-broken-graphs-rejected": "passed",
          "d1-boundary": "passed"
        }
      }
    }
  },
  "D2": {
    "module": "D2-species-base-dependency-graph",
    "sourceHash": "b3f697c6d9a9a750",
    "unitTests": "passed",
    "propertyTests": "passed",
    "labScenarios": "manual",
    "integrationScenario": "passed",
    "replayHash": "7295630fd9d5e1a4",
    "status": "VERIFIED",
    "blockers": [],
    "detail": {
      "generator": "packages/lab/verify/evidence.ts",
      "labSubstitute": "packages/lab/verify/v3.ts — 본 검증은 브라우저 /lab/d2 (npm run dev --workspace @hkt/lab)",
      "testPackage": "packages/core",
      "coverage": {
        "module": "D2",
        "normal": 1,
        "failure": 1,
        "boundary": 1,
        "complete": true
      },
      "tests": {
        "total": 988,
        "passed": 988
      },
      "scenarios": {
        "total": 3,
        "passed": 3,
        "failed": 0,
        "coverageComplete": true,
        "byId": {
          "d2-species-base-graphs": "passed",
          "d2-broken-blueprints-rejected": "passed",
          "d2-boundary": "passed"
        }
      }
    }
  },
  "D3": {
    "module": "D3-personal-dependency-variation",
    "sourceHash": "e48a868569e68aa8",
    "unitTests": "passed",
    "propertyTests": "passed",
    "labScenarios": "manual",
    "integrationScenario": "passed",
    "replayHash": "785391fe559e73ea",
    "status": "VERIFIED",
    "blockers": [],
    "detail": {
      "generator": "packages/lab/verify/evidence.ts",
      "labSubstitute": "packages/lab/verify/v3.ts — 본 검증은 브라우저 /lab/d3 (npm run dev --workspace @hkt/lab)",
      "testPackage": "packages/core",
      "coverage": {
        "module": "D3",
        "normal": 1,
        "failure": 1,
        "boundary": 1,
        "complete": true
      },
      "tests": {
        "total": 988,
        "passed": 988
      },
      "scenarios": {
        "total": 3,
        "passed": 3,
        "failed": 0,
        "coverageComplete": true,
        "byId": {
          "d3-personal-graphs": "passed",
          "d3-broken-variations-rejected": "passed",
          "d3-boundary": "passed"
        }
      }
    }
  },
  "D4": {
    "module": "D4-dependency-pressure",
    "sourceHash": "fe34332d8012ffd9",
    "unitTests": "passed",
    "propertyTests": "passed",
    "labScenarios": "manual",
    "integrationScenario": "passed",
    "replayHash": "c57478d58aa4a46a",
    "status": "VERIFIED",
    "blockers": [],
    "detail": {
      "generator": "packages/lab/verify/evidence.ts",
      "labSubstitute": "packages/lab/verify/v3.ts — 본 검증은 브라우저 /lab/d4 (npm run dev --workspace @hkt/lab)",
      "testPackage": "packages/core",
      "coverage": {
        "module": "D4",
        "normal": 1,
        "failure": 1,
        "boundary": 1,
        "complete": true
      },
      "tests": {
        "total": 988,
        "passed": 988
      },
      "scenarios": {
        "total": 3,
        "passed": 3,
        "failed": 0,
        "coverageComplete": true,
        "byId": {
          "d4-hunger-rises": "passed",
          "d4-broken-readings-rejected": "passed",
          "d4-boundary": "passed"
        }
      }
    }
  },
  "O0": {
    "module": "O0-worldview-axioms",
    "sourceHash": "641db17aa195d6df",
    "unitTests": "passed",
    "propertyTests": "passed",
    "labScenarios": "manual",
    "integrationScenario": "passed",
    "replayHash": "546d4d4f39328a8a",
    "status": "VERIFIED",
    "blockers": [],
    "detail": {
      "generator": "packages/lab/verify/evidence.ts",
      "labSubstitute": "packages/lab/verify/v3.ts — 본 검증은 브라우저 /lab/o0 (npm run dev --workspace @hkt/lab)",
      "testPackage": "packages/core",
      "coverage": {
        "module": "O0",
        "normal": 1,
        "failure": 1,
        "boundary": 1,
        "complete": true
      },
      "tests": {
        "total": 988,
        "passed": 988
      },
      "scenarios": {
        "total": 3,
        "passed": 3,
        "failed": 0,
        "coverageComplete": true,
        "byId": {
          "o0-definitions-stand": "passed",
          "o0-violations-rejected": "passed",
          "o0-boundary": "passed"
        }
      }
    }
  },
  "O1": {
    "module": "O1-common-world-ontology",
    "sourceHash": "175b575d768a599c",
    "unitTests": "passed",
    "propertyTests": "passed",
    "labScenarios": "manual",
    "integrationScenario": "passed",
    "replayHash": "1e00b51bdc7aea2e",
    "status": "VERIFIED",
    "blockers": [],
    "detail": {
      "generator": "packages/lab/verify/evidence.ts",
      "labSubstitute": "packages/lab/verify/v3.ts — 본 검증은 브라우저 /lab/o1 (npm run dev --workspace @hkt/lab)",
      "testPackage": "packages/core",
      "coverage": {
        "module": "O1",
        "normal": 1,
        "failure": 1,
        "boundary": 1,
        "complete": true
      },
      "tests": {
        "total": 988,
        "passed": 988
      },
      "scenarios": {
        "total": 3,
        "passed": 3,
        "failed": 0,
        "coverageComplete": true,
        "byId": {
          "o1-catalog-covered": "passed",
          "o1-unmapped-rejected": "passed",
          "o1-boundary": "passed"
        }
      }
    }
  },
  "O2": {
    "module": "O2-world-state-schema",
    "sourceHash": "71af7b00a1929753",
    "unitTests": "passed",
    "propertyTests": "passed",
    "labScenarios": "manual",
    "integrationScenario": "passed",
    "replayHash": "286279e5eee8bb14",
    "status": "VERIFIED",
    "blockers": [],
    "detail": {
      "generator": "packages/lab/verify/evidence.ts",
      "labSubstitute": "packages/lab/verify/v3.ts — 본 검증은 브라우저 /lab/o2 (npm run dev --workspace @hkt/lab)",
      "testPackage": "packages/core",
      "coverage": {
        "module": "O2",
        "normal": 1,
        "failure": 1,
        "boundary": 1,
        "complete": true
      },
      "tests": {
        "total": 988,
        "passed": 988
      },
      "scenarios": {
        "total": 3,
        "passed": 3,
        "failed": 0,
        "coverageComplete": true,
        "byId": {
          "o2-scene-assembled": "passed",
          "o2-offschema-rejected": "passed",
          "o2-boundary": "passed"
        }
      }
    }
  },
  "P0": {
    "module": "P0-action-atom",
    "sourceHash": "12226db000d0747e",
    "unitTests": "passed",
    "propertyTests": "passed",
    "labScenarios": "manual",
    "integrationScenario": "passed",
    "replayHash": "fd73bf3583cfb080",
    "status": "VERIFIED",
    "blockers": [],
    "detail": {
      "generator": "packages/lab/verify/evidence.ts",
      "labSubstitute": "packages/lab/verify/v3.ts — 본 검증은 브라우저 /lab/p0 (npm run dev --workspace @hkt/lab)",
      "testPackage": "packages/core",
      "coverage": {
        "module": "P0",
        "normal": 1,
        "failure": 1,
        "boundary": 1,
        "complete": true
      },
      "tests": {
        "total": 988,
        "passed": 988
      },
      "scenarios": {
        "total": 3,
        "passed": 3,
        "failed": 0,
        "coverageComplete": true,
        "byId": {
          "p0-sixteen-atoms": "passed",
          "p0-broken-actions-rejected": "passed",
          "p0-boundary": "passed"
        }
      }
    }
  },
  "P1": {
    "module": "P1-strategy-direction",
    "sourceHash": "9ecb648bceb2e22f",
    "unitTests": "passed",
    "propertyTests": "passed",
    "labScenarios": "manual",
    "integrationScenario": "passed",
    "replayHash": "fb2662647e12fecd",
    "status": "VERIFIED",
    "blockers": [],
    "detail": {
      "generator": "packages/lab/verify/evidence.ts",
      "labSubstitute": "packages/lab/verify/v3.ts — 본 검증은 브라우저 /lab/p1 (npm run dev --workspace @hkt/lab)",
      "testPackage": "packages/core",
      "coverage": {
        "module": "P1",
        "normal": 1,
        "failure": 1,
        "boundary": 1,
        "complete": true
      },
      "tests": {
        "total": 988,
        "passed": 988
      },
      "scenarios": {
        "total": 3,
        "passed": 3,
        "failed": 0,
        "coverageComplete": true,
        "byId": {
          "p1-seven-directions": "passed",
          "p1-broken-expansions-rejected": "passed",
          "p1-boundary": "passed"
        }
      }
    }
  },
  "P2": {
    "module": "P2-possibility-grammar",
    "sourceHash": "d81f82329db0aa6b",
    "unitTests": "passed",
    "propertyTests": "passed",
    "labScenarios": "manual",
    "integrationScenario": "passed",
    "replayHash": "b197224b6195bf53",
    "status": "VERIFIED",
    "blockers": [],
    "detail": {
      "generator": "packages/lab/verify/evidence.ts",
      "labSubstitute": "packages/lab/verify/v3.ts — 본 검증은 브라우저 /lab/p2 (npm run dev --workspace @hkt/lab)",
      "testPackage": "packages/core",
      "coverage": {
        "module": "P2",
        "normal": 1,
        "failure": 1,
        "boundary": 1,
        "complete": true
      },
      "tests": {
        "total": 988,
        "passed": 988
      },
      "scenarios": {
        "total": 3,
        "passed": 3,
        "failed": 0,
        "coverageComplete": true,
        "byId": {
          "p2-five-grammars": "passed",
          "p2-broken-grammars-rejected": "passed",
          "p2-boundary": "passed"
        }
      }
    }
  },
  "P3": {
    "module": "P3-lazy-possibility-expansion",
    "sourceHash": "f5d721cf13d8975f",
    "unitTests": "passed",
    "propertyTests": "passed",
    "labScenarios": "manual",
    "integrationScenario": "passed",
    "replayHash": "349663adfc6a4425",
    "status": "VERIFIED",
    "blockers": [],
    "detail": {
      "generator": "packages/lab/verify/evidence.ts",
      "labSubstitute": "packages/lab/verify/v3.ts — 본 검증은 브라우저 /lab/p3 (npm run dev --workspace @hkt/lab)",
      "testPackage": "packages/core",
      "coverage": {
        "module": "P3",
        "normal": 1,
        "failure": 1,
        "boundary": 1,
        "complete": true
      },
      "tests": {
        "total": 988,
        "passed": 988
      },
      "scenarios": {
        "total": 3,
        "passed": 3,
        "failed": 0,
        "coverageComplete": true,
        "byId": {
          "p3-expands-relevant-only": "passed",
          "p3-broken-expansion-rejected": "passed",
          "p3-boundary": "passed"
        }
      }
    }
  },
  "P4": {
    "module": "P4-goal-selection",
    "sourceHash": "fe67091aa9071efc",
    "unitTests": "passed",
    "propertyTests": "passed",
    "labScenarios": "manual",
    "integrationScenario": "passed",
    "replayHash": "e3de3b72bbc7ec26",
    "status": "VERIFIED",
    "blockers": [],
    "detail": {
      "generator": "packages/lab/verify/evidence.ts",
      "labSubstitute": "packages/lab/verify/v3.ts — 본 검증은 브라우저 /lab/p4 (npm run dev --workspace @hkt/lab)",
      "testPackage": "packages/core",
      "coverage": {
        "module": "P4",
        "normal": 1,
        "failure": 1,
        "boundary": 1,
        "complete": true
      },
      "tests": {
        "total": 988,
        "passed": 988
      },
      "scenarios": {
        "total": 3,
        "passed": 3,
        "failed": 0,
        "coverageComplete": true,
        "byId": {
          "p4-picks-under-pressure": "passed",
          "p4-broken-selection-rejected": "passed",
          "p4-boundary": "passed"
        }
      }
    }
  },
  "P5": {
    "module": "P5-action-planning",
    "sourceHash": "0500bad825204427",
    "unitTests": "passed",
    "propertyTests": "passed",
    "labScenarios": "manual",
    "integrationScenario": "passed",
    "replayHash": "513decb9fa8ca25e",
    "status": "VERIFIED",
    "blockers": [],
    "detail": {
      "generator": "packages/lab/verify/evidence.ts",
      "labSubstitute": "packages/lab/verify/v3.ts — 본 검증은 브라우저 /lab/p5 (npm run dev --workspace @hkt/lab)",
      "testPackage": "packages/core",
      "coverage": {
        "module": "P5",
        "normal": 1,
        "failure": 1,
        "boundary": 1,
        "complete": true
      },
      "tests": {
        "total": 988,
        "passed": 988
      },
      "scenarios": {
        "total": 3,
        "passed": 3,
        "failed": 0,
        "coverageComplete": true,
        "byId": {
          "p5-plans-the-chain": "passed",
          "p5-broken-plan-rejected": "passed",
          "p5-boundary": "passed"
        }
      }
    }
  },
  "R0": {
    "module": "R0-world-state-store",
    "sourceHash": "31e9a03856e56d13",
    "unitTests": "passed",
    "propertyTests": "passed",
    "labScenarios": "manual",
    "integrationScenario": "passed",
    "replayHash": "194f5a1419f0227c",
    "status": "VERIFIED",
    "blockers": [],
    "detail": {
      "generator": "packages/lab/verify/evidence.ts",
      "labSubstitute": "packages/lab/verify/v3.ts — 본 검증은 브라우저 /lab/r0 (npm run dev --workspace @hkt/lab)",
      "testPackage": "packages/core",
      "coverage": {
        "module": "R0",
        "normal": 1,
        "failure": 1,
        "boundary": 1,
        "complete": true
      },
      "tests": {
        "total": 988,
        "passed": 988
      },
      "scenarios": {
        "total": 3,
        "passed": 3,
        "failed": 0,
        "coverageComplete": true,
        "byId": {
          "r0-keeps-the-ledger": "passed",
          "r0-broken-commit-rejected": "passed",
          "r0-boundary": "passed"
        }
      }
    }
  },
  "S0": {
    "module": "S0-common-subject-model",
    "sourceHash": "b9043599f716b3da",
    "unitTests": "passed",
    "propertyTests": "passed",
    "labScenarios": "manual",
    "integrationScenario": "passed",
    "replayHash": "7de04928723c8185",
    "status": "VERIFIED",
    "blockers": [],
    "detail": {
      "generator": "packages/lab/verify/evidence.ts",
      "labSubstitute": "packages/lab/verify/v3.ts — 본 검증은 브라우저 /lab/s0 (npm run dev --workspace @hkt/lab)",
      "testPackage": "packages/core",
      "coverage": {
        "module": "S0",
        "normal": 1,
        "failure": 1,
        "boundary": 1,
        "complete": true
      },
      "tests": {
        "total": 988,
        "passed": 988
      },
      "scenarios": {
        "total": 3,
        "passed": 3,
        "failed": 0,
        "coverageComplete": true,
        "byId": {
          "s0-five-kinds-answer": "passed",
          "s0-mute-subjects-rejected": "passed",
          "s0-boundary": "passed"
        }
      }
    }
  },
  "S1": {
    "module": "S1-species-archetype",
    "sourceHash": "b2d5ca50633c7f90",
    "unitTests": "passed",
    "propertyTests": "passed",
    "labScenarios": "manual",
    "integrationScenario": "passed",
    "replayHash": "5b968b55708a1cf8",
    "status": "VERIFIED",
    "blockers": [],
    "detail": {
      "generator": "packages/lab/verify/evidence.ts",
      "labSubstitute": "packages/lab/verify/v3.ts — 본 검증은 브라우저 /lab/s1 (npm run dev --workspace @hkt/lab)",
      "testPackage": "packages/core",
      "coverage": {
        "module": "S1",
        "normal": 1,
        "failure": 1,
        "boundary": 1,
        "complete": true
      },
      "tests": {
        "total": 988,
        "passed": 988
      },
      "scenarios": {
        "total": 3,
        "passed": 3,
        "failed": 0,
        "coverageComplete": true,
        "byId": {
          "s1-five-species-stand": "passed",
          "s1-broken-species-rejected": "passed",
          "s1-boundary": "passed"
        }
      }
    }
  },
  "S2": {
    "module": "S2-culture-role-archetype",
    "sourceHash": "f72fd20e472597ba",
    "unitTests": "passed",
    "propertyTests": "passed",
    "labScenarios": "manual",
    "integrationScenario": "passed",
    "replayHash": "6ed19db035a0431e",
    "status": "VERIFIED",
    "blockers": [],
    "detail": {
      "generator": "packages/lab/verify/evidence.ts",
      "labSubstitute": "packages/lab/verify/v3.ts — 본 검증은 브라우저 /lab/s2 (npm run dev --workspace @hkt/lab)",
      "testPackage": "packages/core",
      "coverage": {
        "module": "S2",
        "normal": 1,
        "failure": 1,
        "boundary": 1,
        "complete": true
      },
      "tests": {
        "total": 988,
        "passed": 988
      },
      "scenarios": {
        "total": 3,
        "passed": 3,
        "failed": 0,
        "coverageComplete": true,
        "byId": {
          "s2-same-species-diverges": "passed",
          "s2-broken-cultures-rejected": "passed",
          "s2-boundary": "passed"
        }
      }
    }
  },
  "S3": {
    "module": "S3-subject-instance",
    "sourceHash": "886ff3f19add1b6d",
    "unitTests": "passed",
    "propertyTests": "passed",
    "labScenarios": "manual",
    "integrationScenario": "passed",
    "replayHash": "08b7f69d79d1a5d4",
    "status": "VERIFIED",
    "blockers": [],
    "detail": {
      "generator": "packages/lab/verify/evidence.ts",
      "labSubstitute": "packages/lab/verify/v3.ts — 본 검증은 브라우저 /lab/s3 (npm run dev --workspace @hkt/lab)",
      "testPackage": "packages/core",
      "coverage": {
        "module": "S3",
        "normal": 1,
        "failure": 1,
        "boundary": 1,
        "complete": true
      },
      "tests": {
        "total": 988,
        "passed": 988
      },
      "scenarios": {
        "total": 3,
        "passed": 3,
        "failed": 0,
        "coverageComplete": true,
        "byId": {
          "s3-same-culture-diverges": "passed",
          "s3-broken-instances-rejected": "passed",
          "s3-boundary": "passed"
        }
      }
    }
  },
  "V0": {
    "module": "V0-module-contract-registry",
    "sourceHash": "3f9be448320f3413",
    "unitTests": "passed",
    "propertyTests": "passed",
    "labScenarios": "manual",
    "integrationScenario": "passed",
    "replayHash": "d0713f208e7f1cc0",
    "status": "VERIFIED",
    "blockers": [],
    "detail": {
      "generator": "packages/lab/verify/evidence.ts",
      "labSubstitute": "packages/scenarios/verify/v0.ts",
      "testPackage": "packages/contracts",
      "coverage": {
        "module": "V0",
        "normal": 2,
        "failure": 2,
        "boundary": 2,
        "complete": true
      },
      "tests": {
        "total": 87,
        "passed": 87
      },
      "scenarios": {
        "total": 6,
        "passed": 6,
        "failed": 0,
        "coverageComplete": true,
        "byId": {
          "v0-evidence-crosscheck": "passed",
          "v0-registry-accepts": "passed",
          "v0-crosscheck-rejects": "passed",
          "v0-rejects-defective": "passed",
          "v0-boundary": "passed",
          "v0-crosscheck-boundary": "passed"
        }
      }
    }
  },
  "V1": {
    "module": "V1-deterministic-runtime",
    "sourceHash": "b97f5918fde26956",
    "unitTests": "passed",
    "propertyTests": "passed",
    "labScenarios": "manual",
    "integrationScenario": "passed",
    "replayHash": "bfc6afce291d17c6",
    "status": "VERIFIED",
    "blockers": [],
    "detail": {
      "generator": "packages/lab/verify/evidence.ts",
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
        "total": 988,
        "passed": 988
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
      "generator": "packages/lab/verify/evidence.ts",
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
        "total": 99,
        "passed": 99
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
    "sourceHash": "faa2ff3ea6a29e41",
    "unitTests": "passed",
    "propertyTests": "passed",
    "labScenarios": "manual",
    "integrationScenario": "passed",
    "replayHash": "4a81eb9ab76abe78",
    "status": "VERIFIED",
    "blockers": [],
    "detail": {
      "generator": "packages/lab/verify/evidence.ts",
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
        "total": 115,
        "passed": 115
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
    "sourceHash": "53897ecf6ba3023c",
    "unitTests": "passed",
    "propertyTests": "passed",
    "labScenarios": "manual",
    "integrationScenario": "passed",
    "replayHash": "97a107cdb7f704cf",
    "status": "VERIFIED",
    "blockers": [],
    "detail": {
      "generator": "packages/lab/verify/evidence.ts",
      "labSubstitute": "packages/scenarios/verify/v4.ts",
      "testPackage": "packages/contracts",
      "coverage": {
        "module": "V4",
        "normal": 2,
        "failure": 2,
        "boundary": 2,
        "complete": true
      },
      "tests": {
        "total": 87,
        "passed": 87
      },
      "scenarios": {
        "total": 6,
        "passed": 6,
        "failed": 0,
        "coverageComplete": true,
        "byId": {
          "v4-evidence-verified": "passed",
          "v4-recording-batch": "passed",
          "v4-recording-eager": "passed",
          "v4-refuses-unverified": "passed",
          "v4-boundary": "passed",
          "v4-recording-boundary": "passed"
        }
      }
    }
  }
};
