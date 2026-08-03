# MODULES.md — 모듈 레지스트리 (입력·출력 계약)

> [design/Design-ModulePlan.md](../design/Design-ModulePlan.md)(원문)의 **V~A 14계층 분할을 그대로** 옮기고,
> 각 모듈의 목적(한 문장)·입력·출력·최소 세계 상태 원소·시각화를 확정한 파생 레지스트리다.
> 작업 절차는 [WORKFLOW.md](WORKFLOW.md). 원문 §23(M01~M14)의 분할은 참고용이며 이 문서의 기준이 아니다.

표 읽는 법:

- **입력 → 출력**: 모듈 함수의 계약. 타입 이름은 core 의 TS 타입으로 그대로 선언된다.
- **상태 원소**: 이 모듈이 새로 정의하거나 변경하는 최소 세계 상태 원소 (모두 직렬화 가능, O1 존재론 타입으로 분류됨).
- **시각화**: WORKFLOW §6 공용 렌더러 5종(그래프 / 게이지 / 타임라인 / diff / 3D) 중 배정.
- 계층 순서 = 의존 순서. 앞 계층 검증 전 다음 계층 착수 금지.

## 북극성 대조표 — 목표의 핵심 둘이 어느 모듈에 사는가

CLAUDE.md 북극성(넨급 능력 문법 · 방대한 세계관)의 담당 모듈 사슬. 아래 표의 모듈을 설계·계약할 때
자기가 이 사슬의 어느 고리인지 확인한다.

| 북극성 | 담당 모듈 사슬 |
|---|---|
| ① 능력 = 캐릭터 표현의 근본 문법 (MasterPlan §10) | O0(비용·흔적 공리) → S3(값의 유래) → D3(대가의 의존 전환) → **G5(능력 문법·생성)** → **G6(강도 판정 — 제약과 서약의 식)** → E3(능력 충돌 판정) → R2(능력 흔적의 현상화) |
| ② 방대하고 다채로운 세계관 (MasterPlan §3·§8) | O0-d(공리 다산성 — 같은 공리에서 다른 종·능력·신) → W1(다중 주체 요구 병합 — 한 요소, 여러 의미) → C0~C4(마물·조직·국가·신) → A 계층(AI 확장) |

미지 영역·위험 스케일(MasterPlan §3.1 `unknownDomains`·`dangerScale`)은 아직 소유 모듈이 없다 —
W 계층 착수 시 배정하는 작업 카드를 만든다.

---

## V 계층 — 검증 기반 `contracts/ · scenarios/ · lab/`

| 모듈 | 목적 (한 문장) | 입력 → 출력 | 상태 원소 | 시각화 |
|---|---|---|---|---|
| V0 | 모든 모듈의 목적·입출력·의존·검증 방법을 등록하고 검사한다 | `MODULE.yaml[]` + `Evidence[]` + 모듈 소스 명부(`ModuleSourceSpec`) → `ModuleRegistry`(의존 DAG + 구현·검증 상태 + 착수 가능 목록) | `ModuleContract`, `ModuleStatus` | 그래프(모듈 의존 DAG, 색=status) + diff(증거 교차검사 대조표) |
| V1 | 같은 상태와 입력이면 항상 같은 결과가 나오게 한다 | `(seed, tick)` → `TickClock`, `SeededRandom`, `DeterministicId`, `stableSort`, `stateHash` | `Seed`, `Tick`, `StateHash` | diff(해시 비교표 — 100회 실행 동일성) |
| V2 | 각 모듈의 대표 장면을 자동 실행한다 | `Scenario{arrange,act,assert}` → `ScenarioResult` + `Assertion[]` (실패 시 최초 분기 상태 경로 포함) | `ScenarioResult`, `Assertion` | diff(기대 vs 실제 + 분기 경로 하이라이트) |
| V3 | 코드를 읽지 않아도 모듈 작동을 눈으로 확인하게 한다 | 모듈별 상태 원소 → Lab 페이지(화면 7요소: 입력·처리·후보·선택·상태 전후·실패 이유·인과) | — (렌더러 자체) | 자체 (공용 렌더러 5종 셸) |
| V4 | 완료를 임의 선언하지 못하게 증거 파일로만 판정한다 | 검증 산출물(테스트·시나리오·리플레이 해시)·모듈별 검증 작업 `EvidenceJob` → `Evidence` JSON, `status: VERIFIED`, 기록 순서 `EvidenceTrace` | `Evidence`, `EvidenceTrace` | diff(증거 대시보드 — 모듈별 통과 현황 + 기록 순서 추적표) |

## O 계층 — 세계관 공리와 존재론 `core/`

| 모듈 | 목적 | 입력 → 출력 | 상태 원소 | 시각화 |
|---|---|---|---|---|
| O0 | 세계에 어떤 존재와 현상이 허용되는지 정의하고 위반을 거부한다 | `AxiomSpec[]` → `AxiomSet` + `validate(정의) → Violation[]` | `Axiom`, `Violation` | diff(정의 투입 → 통과/거부 판정 데모) |
| O1 | 모든 콘텐츠를 공통 개념 12타입으로 표현한다 | — → 존재론 타입 12종: `Subject` `Entity` `State` `Rule` `Phenomenon` `Claim` `Commitment` `Affordance` `Event` `Dependency` `Possibility` `WorldRequirement` | 12타입 전부 | diff(원문 개념 ↔ 타입 커버리지 표) |
| O2 | 물리·생물·생태·관계·제도·경제·정보·의념·초월 9영역 상태를 통일 표현한다 | 영역별 정의 → `StateSchema`(9영역 필드 트리) | `WorldState` 9영역 서브트리 | diff(상태 트리 뷰) |

## S 계층 — 주체 원형 `core/`

| 모듈 | 목적 | 입력 → 출력 | 상태 원소 | 시각화 |
|---|---|---|---|---|
| S0 | 사람·생물·조직·국가·신이 공통 인터페이스를 가지게 한다 | — → `Subject` 인터페이스 + 5질문 검사기(감지·의존·능력·기억·유지) | `Subject` (id, boundaries, needs, values, capabilities, perceptionProfile, …GraphId) | diff(주체 카드 — 5질문 응답표) |
| S1 | 종의 신체·감각·생애·기본 의존성을 정의한다 | `SpeciesSpec`, `SpeciesDefinition`, `StateSchema` → `SpeciesArchetype`, `SpeciesViolation`, `SpeciesSeed` | `SpeciesArchetype` (= O0 종 정의 + `BodyPlan`, `SenseSpec`, `LifeStage`, `NeedTemplate`, capabilities) | diff(종 카드 — 같은 종 단계별 대조) |
| S2 | 같은 종이라도 문화·역할별로 다른 해석·행동 가능성을 준다 | `CultureSpec`, `RoleSpec`, `SpeciesArchetype`, `SpeciesSeed` → `CultureArchetype`, `RoleArchetype`, `CultureViolation`, `SubjectSeed` | `CultureArchetype` (= O1 Rule + `ReadingRule`, `ValueTemplate`, taboos, roles), `RoleArchetype` (grants·taboos·읽기·원함) | diff(문화·역할 카드 비교 — 같은 종 문화별 대조) |
| S3 | 종+문화+역할+이력+성격으로 개별 주체를 생성한다 | `SpeciesArchetype + CultureArchetype + RoleArchetype + PastEvent[] + Trait[]` → `SubjectInstance`, `Provenance`, `InstanceViolation` | `SubjectInstance` (= S0 주체 + `PastEvent`, `Residue`, `Trait`, `Provenance`) | diff(개별 주체 카드 — 값마다 유래 배지) |

## D 계층 — 주체 의존 그래프 `core/`

| 모듈 | 목적 | 입력 → 출력 | 상태 원소 | 시각화 |
|---|---|---|---|---|
| D0 | 주체가 의존할 수 있는 모든 대상을 11종으로 분류하고 각 종이 세계의 무엇으로 서는지 못박는다 | 원문 D0·D1 두 목록, `OntologyKind`, `StateDomain`, `StateSchema` → `DependencyKind` 11종(자원·공간·환경·신체·주체·관계·정보·제도·규칙·의례·시간) + `DependencyKindSpec`, `KindResolution`, `KindGrounding`, `TargetFit`, `DependencyKindViolation` | `DependencyKind` | diff(분류표) |
| D1 | 의존 노드·간선 스키마를 확정한다 | `DependencyKind`, `KindGrounding`, `StateSchema`, `Band` → `DependencyNode{kind, target, condition}`, `DependencyEdge{relation, strength, urgency, substitutability, failureDelayTicks, failureEffects}`, `DependencyGraph`, `GraphViolation` | `DependencyGraph` | 그래프(노드=kind 색, 간선=relation) |
| D2 | 종 원형에서 그 종의 모든 개체가 물려받는 기본 의존 그래프를 찍어 내고, 생존·번식 경로가 끊기지 않게 한다 | `SpeciesArchetype + SpeciesBlueprint`(뿌리 선언 · 대 잇는 자리 · 채움 갈래) `+ GraphBirth` → 종 기본 `DependencyGraph` + `BlueprintReport`(뿌리별 무단절 판정) + `SpeciesGraphViolation` | `DependencyGraph`, `PathVerdict` | 그래프(종별 기본 그래프 · 끊긴 뿌리 적색) + 게이지(무단절 판정표) |
| D3 | 개인·문화·능력이 기본 의존성을 변형하게 하되 의존이 사라지지 않고 전환되게 한다 | `SubjectInstance + 기본 DependencyGraph + VariationSpec[]`(유래 + 더함·약화·끊음) `+ Definition[]`(능력의 대가) → 개인 `DependencyGraph` + `PersonalReport`(전환 장부·다시 읽은 뿌리) + `GraphDiff` + `PersonalViolation` | `DependencyGraph` diff, `ConversionEntry` | 그래프 diff(더함=녹 / 끊김=적 / 흔들림=노랑) |
| D4 | 지금 세계에서 각 의존이 얼마나 채워졌는지 재어 압력을 계산하고 5단계 충족을 판정한다 | `DependencyGraph + WorldSnapshot`(O2 트리 + 틱) `+ PressureContext`(결핍이 시작된 시각) → `PressureReport`(간선별 `Pressure = Strength×Deficit×Urgency×FailureRisk` · 노드별 5단계 · `DeficitReading` · 추이) + `PressureViolation` | `WorldSnapshot`, `pressure`, `fulfillment` | 게이지(노드 색=5단계, 막대=압력 추이) |
| D5 | 주체 내부·주체 간 의존 충돌을 찾는다 (단계 3 착수) | 다주체 `DependencyGraph[] + PressureReport[]` → `DependencyConflict[]`(경합 자원·대상·공간) | `DependencyConflict` | 그래프(주체↔경합 대상 이분 그래프) |

## P 계층 — 가능성 그래프 `core/`

| 모듈 | 목적 | 입력 → 출력 | 상태 원소 | 시각화 |
|---|---|---|---|---|
| P0 | 가능성을 구성하는 최소 행동 16원자를 정의하고, 각 원자가 무엇을 바꾸고 무엇을 치르는지 못박는다 | 원문 P0 16 · P1 방향 7 · P2 예시 15, `StateSchema`, `DependencyKind`, `Affordance` → `ActionAtom` 16종(찾다·획득·생산·교환·빼앗다·보호·제거·은폐·조사·설득·협박·동맹·배신·적응·대체·탈피) + `ActionAtomSpec`, `AtomResolution`, `AtomGrounding`(손대는 곳·동의·의존에 대한 태도·읽기/바꾸기/치르기 자리·관측), `ActionProposal`, `ActionFit`, `ActionAtomViolation` | `ActionAtom` | diff(원자 16표 + 원문 환원표 + 결핍 앞의 길) |
| P1 | 결핍된 의존마다 대응 방향 7종을 전개하고, 열리지 않는 방향은 사유와 함께 남긴다 | `DependencyGraph + PressureReport`(D4) + `AtomGrounding`(P0) + `KindGrounding`(D0) → `StrategyDirectionSpec` 7종(충족·대체·감소·생산·위임·경쟁 제거·의존 제거) + `StrategyOption`(열림·원자·막힘 사유 8종·갚을 모듈) + `StrategyBranch`·`StrategyTree`(압력 순·해시) + 열린 갈래의 `Possibility`(O1) + `StrategyViolation` | `Possibility` | 그래프(결핍 → 대응 트리, 열림=녹·막힘=적 파선) |
| P2 | 같은 의존에 주체 유형별 다른 대응이 나오게 한다 — 낼 손이 있는가, 낼 수 있어도 하지 않는가 | `SubjectKind`(S0 경계 4종) + `SpeciesArchetype/CultureArchetype/RoleArchetype` + `AtomGrounding`(P0) + `StrategyTree`(P1) → `KindFooting`·`AccessRule`(유형×원자 80칸, 접근 4종=직접·구성원·의념·막힘) + `AbilityGrant`·`AtomBan` + `PossibilityGrammar` + `NarrowedTree`(닫기만 한다) + `ExampleReport`(원문 P2 다섯 줄 대조) + `GrammarViolation` | `PossibilityGrammar` | diff(유형×원자 격자 + 문화별 비교표) |
| P3 | 전체가 아닌 현재 관련된 가능성만 지연 확장하고, 그전에 원자 사이의 "먼저" 를 계산한다 | `AtomGrounding`(P0) + `NarrowedTree`·`PossibilityGrammar`(P2) + `결핍 + Percept[] + Memory + Relationship + Capability` → `AtomPrerequisite`(관측 선행·재료 선행) + `PrerequisiteReport`(뿌리·물결·닿지 않는 원자·세울 수 없는 자리) + 활성 `PossibilitySubgraph`(`preconditionIds` 채움) + `ExpansionTrace` + `PossibilityGraphViolation` | `AtomPrerequisite`, `PossibilitySubgraph` | 그래프(선행 물결 + 전체 회색·활성 부분 발광) |
| P4 | 후보 중 실제 추구할 목적을 선택하고 관성을 유지한다 | `PossibilitySubgraph + 평가요소(압력·성공률·비용·위험·가치관·관계·기억·약속·매몰비용)` → `ActiveGoal{commitmentInertia}` | `ActiveGoal` | 게이지(후보별 점수표 + 선택 마크) |
| P5 | 목적을 행동 원자 시퀀스까지 분해한다 | `ActiveGoal` → `ActionPlan`(ActionAtom 순서열 + 선행 조건) | `ActionPlan` | 타임라인(계획 단계 목록) |

## Q 계층 — 세계 요구 그래프 `core/`

| 모듈 | 목적 | 입력 → 출력 | 상태 원소 | 시각화 |
|---|---|---|---|---|
| Q0 | 가능성 실행에 필요한 조건을 8종 요구로 추출한다 | `ActionPlan/Possibility` → `WorldRequirement[]`(공간·자원·규칙·상태·상대 주체·정보·시간·역사) | `WorldRequirement` | 그래프(계획 → 요구, 유형 태그 색) |
| Q1 | 주체가 원하는 결과 자체는 요구하지 못하게 거른다 | `WorldRequirement` → 정제 요구 또는 `Rejection`("치료제 존재" 거부 → "치료 효과 가능 물질+원천+정보+비용" 통과) | `Rejection` | diff(거부/통과 판정 데모) |
| Q2 | 요구의 범위·중요도를 제한한다 | `WorldRequirement` → `scope`(개인/지역/광역/세계) + `weight` (개인 요구로 대륙 생성 금지) | `scope`, `weight` | 게이지(범위별 요구 분포) |
| Q3 | 모든 요구의 생성 근거 사슬을 보존한다 | 파이프 산출물 → `ProvenanceChain`(주체→의존→결핍→가능성→목적→전략→요구) | `ProvenanceChain` | 그래프(근거 사슬 역추적 뷰) |

## W 계층 — 세계 컴파일러 `core/`

| 모듈 | 목적 | 입력 → 출력 | 상태 원소 | 시각화 |
|---|---|---|---|---|
| W0 | 서로 다른 표현의 요구를 공통 타입으로 정규화한다 | `WorldRequirement[]` → 정규화 요구("숨을 곳"+"감시 회피 공간" → 은폐 이동 공간) | `NormalizedRequirement` | diff(정규화 전후 표) |
| W1 | 여러 주체의 요구를 하나의 세계 요소로 결합한다 | 다주체 `NormalizedRequirement[]` → `MergedWorldElement`(마물 이동로+광맥+신 앵커+밀수 통로+기관 원천 → 국경 협곡 1개) | `MergedWorldElement` | 그래프(요구들 → 병합 요소 연결도) |
| W2 | 병합 요소를 세계 규칙으로 실체화한다 | `MergedWorldElement` → `Rule[]`(물질·생태·의념·소유권·법률·신역) | `Rule` | 타임라인(규칙 발동 데모 로그) |
| W3 | 실제 초기 세계 상태를 생성한다 | `MergedWorldElement` → 초기 `WorldState`(매장량·개체군·지배력·안정도·은폐도·식량) | `WorldState` | diff(상태 트리 + 수치) |
| W4 | 이동·관찰·생태·전투가 가능한 3D 공간을 만든다 | 지역 그래프 → `SpaceManifest`(위상→높이·경사·통로→지형 메시→충돌→내비게이션) | `SpaceManifest` | 3D(Three.js 지형 + 내비 경로 오버레이) |
| W5 | 현재 상태가 갑자기 생기지 않은 것처럼 압축 과거를 만든다 | 실체화 세계 → `CompressedHistory`(사건열 — "왜 국경석이 여기에" 응답 가능) | `HistoricalEvent` | 타임라인(역사 연표) |
| W6 | 세계 요소의 확정 수준을 관리하고 소급 변경을 막는다 | 세계 요소 → 상태 라벨 전이 `Latent → Foreshadowed → Canonical → Observed`(Observed 는 사건 없이 변경 불가) | `CanonState` | diff(요소별 라벨 색 + 전이 다이어그램) |

## R 계층 — 세계 런타임 `core/` (호스트: `server/`)

| 모듈 | 목적 | 입력 → 출력 | 상태 원소 | 시각화 |
|---|---|---|---|---|
| R0 | 정식화된 세계의 실제 상태를 저장·조회한다 | 정식 세계 → `WorldStateStore`(조회·스냅샷 API) | `WorldStateSnapshot` | diff(상태 브라우저) |
| R1 | 모든 상태 변화를 사건으로만 허용한다 | 상태 변경 시도 → `Event` 기록 또는 거부 (사건 없는 변경 금지) | `Event` | 타임라인(사건 로그) |
| R2 | 사건이 관찰 가능한 현상으로 나타나게 한다 | `Event` → `Phenomenon[]`(빛·소리·흔적·냄새·의념 잔향·보고서) | `Phenomenon` | 3D+타임라인(현상 위치·수명 맵) |
| R3 | 주체가 감각과 위치에 따라 현상을 감지하게 한다 | `Phenomenon[] + PerceptionProfile + 위치` → `Percept[]` | `Percept` | diff(같은 현상, 주체별 감지 비교) |
| R4 | 주체가 실제가 아닌 믿는 세계를 형성하게 한다 | `Percept[]` → `BeliefGraph` 갱신 | `Belief`, `BeliefGraph` | diff(실제 세계 vs 믿음 diff) |
| R5 | 과거 사건과 관계가 이후 판단에 영향을 주게 한다 | `Event/Percept` → `Memory`, `Relationship` 갱신 | `Memory`, `Relationship` | 그래프(관계망) + 타임라인(기억) |
| R6 | 활성 목적과 계획을 실제 행동으로 제출한다 | `ActiveGoal + ActionPlan + BeliefGraph` → `ActionIntent` 제출 | `ActionIntent` | 타임라인(틱별 의도 큐) |

## E 계층 — 충돌과 콘텐츠 사건 `core/`

| 모듈 | 목적 | 입력 → 출력 | 상태 원소 | 시각화 |
|---|---|---|---|---|
| E0 | 같은 공간·자원·대상에 걸린 목적들을 상황으로 묶는다 | 다주체 `ActionIntent[]/ActiveGoal[]` → `Situation` 군집 | `Situation` | 그래프(상황 클러스터 맵) |
| E1 | 상황에서 사회적 상호작용 8종을 선택하게 한다 | `Situation + 관계·힘 차·긴급도·도덕 비용·성공률·정보 비대칭` → `SocialInteraction`(요청·거래·협박·기만·동맹·고용·배신·복종) | `SocialInteraction` | 게이지(선택 기준 점수표) |
| E2 | 퀘스트를 약속·계약 구조로 대체한다 | 상호작용 → `Contract{제안, 수락, 의무, 보상, 기한, 위반, 위반 결과}` | `Contract` | 타임라인(계약 상태 전이 카드) |
| E3 | 같은 상태를 동시에 바꾸려는 행동의 결과를 확정한다 | 경합 `ActionIntent[]` (+ 능력 대 능력 충돌 시 G6 `EffectMagnitude`) → 확정 `Event`(소유자 1인 결정 등) | `Event` | 타임라인(충돌 판정 리플레이) |
| E4 | 사건이 다음 사건의 원인을 남기게 한다 | `Event` → 후속 원인 상태(부상·채무·증거·소문·원한·권력 공백·생태 변화·자원 부족) | `Consequence` | 그래프(사건 연쇄 인과 그래프) |

## G 계층 — 성장과 의존 변형 `core/`

| 모듈 | 목적 | 입력 → 출력 | 상태 원소 | 시각화 |
|---|---|---|---|---|
| G0 | 반복 행동의 비용·실패율을 감소시킨다 | 행동 반복 이력 → `Proficiency` | `Proficiency` | 게이지(숙련 곡선) |
| G1 | 경험이 가능성 그래프를 바꾸게 한다 | 경험 `Event[]` → `PossibilityGraph` 변경(해금·가중치·연결·제거·전문화) | `PossibilityGraph` diff | 그래프 diff(전후) |
| G2 | 의존 충족 효율을 성장시킨다 | 경험 → 효율 파라미터(소비 감소·접근 거리·안전·속도) | `EfficiencyParams` | 게이지(효율 지표 전후) |
| G3 | 의존 대상을 대체하게 한다 | 성장 조건 → `DependencyGraph` 대체 간선(음식→의념 결정→태양 에너지) | `DependencyEdge` | 그래프 diff |
| G4 | 의존 탈피가 반드시 새 의존·비용을 낳게 한다 | 탈피 조건 → 의존 제거 + 신규 의존/비용 (등가 검사 실패 시 거부) | `DependencyGraph` diff | 그래프 diff + diff(등가 검사 결과) |
| G5 | 능력을 캐릭터의 실체화로 생성한다 — 욕망·가치·공포·행동·비용·제한 6요소가 능력 전체 문법으로 조립된다 | 6요소 조합 + `SubjectInstance` → `PersonalAbility{sourceMedium, expression(6종: 강화·방출·변화·조작·구현화·특질), targetPattern, effectProgram, activationConditions, restrictions, costs, failureConsequences, mastery, stability}` (무비용·무제약·무실패 능력 거부 · MasterPlan §10.1) | `PersonalAbility` | diff(능력 카드 — 요소별 근거 + 표현 계통) |
| G6 | 능력 강도를 제약과 서약의 식으로 판정한다 — 조건이 구체적이고 대가가 실질적이며 가치관과 일치할수록 강하다 | `PersonalAbility + AbilityContext`(출력·집중·감정 일관성·범위·지속·대상 저항) → `EffectMagnitude`(MasterPlan §10.2 식 — 항별 기여 분해 포함. E3 충돌 판정·규칙 엔진이 소비) | `EffectMagnitude` | 게이지(강도 분해 — 식의 항별 기여) |

> G5·G6 은 MasterPlan §10(개인화된 초능력 체계)을 모듈로 분해한 **파생 확장**이다 — 원문
> ModulePlan G5(의념 능력)가 생성 조합만 적고 작동 체계(표현 계통·강도 식·숙련·저항)를 비워 둔
> 격차를 갚는다 (STATE.md 열린 이슈 · GitHub #666). G0 의 `Proficiency` 는 능력의
> `mastery`·`stability` 성장을 포함한다. 능력의 **발동**은 별도 모듈이 아니다 — R6 이 의도로
> 제출하고(§19 `invokedCapabilities`), E3 가 G6 강도로 판정하며, R2 가 흔적을 현상으로 남긴다.

## C 계층 — 복합 주체 `core/`

| 모듈 | 목적 | 입력 → 출력 | 상태 원소 | 시각화 |
|---|---|---|---|---|
| C0 | 종·생태가 섭식·번식·이동·적응으로 굴러가게 한다 | `SpeciesArchetype + 공간` → 생태 상태 갱신(개체군·서식지) | `Population`, `Habitat` | 게이지+3D(개체군 추이 + 서식 맵) |
| C1 | 거대 마물을 이동하는 생태 규칙로 만든다 | 마물 원형 → 마물 `SubjectInstance`(기관·먹이·이동로·번식지·영역·사체 결과) | `Organ`, `MigrationPath`, `Territory` | 3D(이동로·영역 오버레이) |
| C2 | 조직이 실제 구성원과 자산으로만 행동하게 한다 | 조직 정의 → 조직 `SubjectInstance`(명령→구성원 실행, 파벌·결속·정보 전달) | `Order`, `Membership`, `Cohesion` | 그래프(조직도 + 명령 흐름) |
| C3 | 국가를 법률·영토·군대·경제·정당성으로 굴린다 | 국가 정의 → 국가 `SubjectInstance` | `Law`, `Territory`, `Legitimacy` | 3D+게이지(영토 맵 + 정당성) |
| C4 | 신을 유지 조건과 지역 규칙을 가진 주체로 만든다 | 신 정의 → 신 `SubjectInstance`(숭배·금기·의례·앵커·영역·붕괴 조건) | `Worship`, `Anchor`, `DivineDomain` | 3D+게이지(영역 + 안정도) |

## X 계층 — 3D 웹 클라이언트 `client/`

| 모듈 | 목적 | 입력 → 출력 | 상태 원소 | 시각화 |
|---|---|---|---|---|
| X0 | 지형보다 먼저 공간의 기능을 생성한다 | 세계 요소 → `SemanticSpaceGraph`(이동로·은폐로·국경·둥지·채굴지·관찰·전투·의례 지점) | `SemanticNode` | 그래프(의미 공간 그래프) |
| X1 | 의미 공간을 실제 지형으로 컴파일한다 | `SemanticSpaceGraph` → 3D 지형·도로·강·협곡·구조물·충돌·내비 | `TerrainMesh`, `NavMesh` | 3D(씬 자체) |
| X2 | 세계 상태를 Three.js 로 렌더링한다 | `WorldManifest`(서버 동기화 상태) → Three.js 씬(지형·인스턴스·캐릭터·현상 이펙트) | — (뷰) | 3D(자체) |
| X3 | 플레이어 입력을 서버 제출용 의도로 변환한다 | 입력 이벤트 → 플레이어 `ActionIntent`(이동·관찰·상호작용·획득·공격·능력·대화·계약) | `ActionIntent` | 3D+타임라인(조작 → 의도 로그) |
| X4 | 퀘스트 목록 대신 아는 것 기반 UI 를 제공한다 | `BeliefGraph + Contract[] + Event[]` → UI 패널(아는 사건·주장과 출처·증거·관계·약속·가능성·위험) | — (뷰) | 자체(패널) |

## N 계층 — MMORPG 서버 `server/`

| 모듈 | 목적 | 입력 → 출력 | 상태 원소 | 시각화 |
|---|---|---|---|---|
| N0 | 위치·소유권·전투·비용·사건·계약을 서버가 단독 확정한다 | 클라이언트 `ActionIntent` → 권위 판정 + 확정 `Event` | `AuthoritativeState` | 타임라인(판정 로그) |
| N1 | 거리+관계·약속·조직·추적 정보 기준으로 동기화한다 | 주체별 관련성 → 관심 영역 구독 집합 | `InterestSet` | 그래프(구독 매트릭스) |
| N2 | 주체·지역을 활성도에 따라 5해상도로 시뮬레이션한다 | 활성도 → 해상도 배정 `L0 잠재~L4 활성 상호작용` | `SimLevel` | 3D+게이지(해상도 맵) |
| N3 | 사건 로그·스냅샷으로 저장·복구·이관한다 | `Event 로그 + Snapshot` → 재시작·재접속 복구 (해시 일치 검증) | `Snapshot` | diff(복구 전후 해시 비교) + 타임라인 |

## A 계층 — AI 제작 자동화 `studio/`

| 모듈 | 목적 | 입력 → 출력 | 상태 원소 | 시각화 |
|---|---|---|---|---|
| A0 | AI 가 자유 텍스트가 아닌 스키마를 작성하게 한다 | — → 구조화 편집기(공리·종·의존 그래프·가능성 문법·능력·세계 요구·지역 후보 7종 폼) | — (도구) | 자체(편집기) |
| A1 | AI 가 후보만 만들고 세계를 직접 바꾸지 못하게 한다 | 프롬프트 + 스키마 → `ContentCandidate` | `ContentCandidate` | diff(후보 목록) |
| A2 | 후보의 구조적 결함을 정적으로 걸러낸다 | `ContentCandidate` → `Violation[]`(공리 위반·의존 단절·무비용 능력·대응 불가 능력·실행 불가 목적·근거 없는 요소) | `Violation` | diff(위반 리포트) |
| A3 | 후보를 작은 세계에서 반복 실행해 검증한다 | `ContentCandidate` → 축소 시뮬 결과(실패 지점 포함) | `SimReport` | 타임라인(시뮬 요약 + 실패 지점) |
| A4 | 실패 원인 기반으로 후보를 자동 수정한다 | `SimReport` → 수정 `ContentCandidate`(막힌 목적·부족 자원·무대응 능력·무행동 주체·무상호작용 지역) | `ContentCandidate` diff | diff(수정 전후) |

---

## 계층 간 데이터 흐름 요약

```
S3 SubjectInstance ──→ D2·D3 DependencyGraph ──→ D4 PressureReport
                                                      │ (결핍)
                                    P3 PossibilitySubgraph → P4 ActiveGoal → P5 ActionPlan
                                                      │                          │
              (세계 구성 파이프라인)  Q0~Q3 WorldRequirement + ProvenanceChain    │ (세계 실행 파이프라인)
                                    W0~W6 세계 실체화 → R0 WorldStateStore       │
                                                      │                          ▼
                                    R1 Event ← E3 충돌 해결 ← E0 Situation ← R6 ActionIntent
                                      │
                                    R2 Phenomenon → R3 Percept → R4 Belief → (다음 틱 P3 로)
                                      │
                                    E4 Consequence · G0~G5 성장 → (D·P 그래프 변형)
```

세계 **구성**(Q·W)과 세계 **실행**(R·E)은 원문 §2 대로 절대 섞지 않는다 —
실행 중 결핍이 생겨도 세계 요소가 즉석 생성되지 않으며, 오직 구성 파이프라인만 세계를 만든다.
