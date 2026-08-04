# Design-CycleModulePlan — Cycle 기반 2차원 점진 구현 WORKFLOW

## 0. 목적

기존 모듈 구조와 인과 순서는 유지한다.

```text
V → O → S → D → P → Q → W → R → E → G → C → X → N → A
```

다만 기존처럼 앞 모듈을 깊게 완성한 뒤 다음 모듈로 이동하는 1차원 방식만 사용하지 않는다.
전체 모듈 파이프라인을 한 번 얇게 관통하는 **Cycle**을 먼저 완성하고, 다음 Cycle에서 같은 모듈 구조를 다시 통과하면서 콘텐츠와 시스템의 깊이를 증가시킨다.

최종 구현 구조는 다음과 같다.

```text
                         고정된 인과·구현 순서
              V  O  S  D  P  Q  W  R  E  G  C  X  N  A
Cycle 1       ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  → 플레이 가능한 게임 1
Cycle 2       ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  → 더 깊어진 게임 2
Cycle 3       ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  → 더 깊어진 게임 3
...          ...

세로축: 콘텐츠·상호작용·세계·시간·규모의 깊이 증가
가로축: 주체에서 세계와 사건이 발생하는 고정 인과 파이프라인
```

핵심 단위는 다음 세 단계다.

```text
Cycle
  └─ Module Step
       └─ Implementation Task
```

- **Cycle**: 하나의 직관적인 게임 장면으로 설명하고 플레이하여 검증할 수 있는 수직 통합 단위
- **Module Step**: 해당 Cycle 목표를 위해 O0, D4, W1 같은 기존 모듈이 맡아야 하는 기여
- **Implementation Task**: 타입, 객체, 함수, 상태, 이벤트, 테스트, Lab 화면처럼 바로 코드로 옮길 수 있는 작업

---

# 1. Cycle 구조의 절대 원칙

## 1.1 모든 Cycle은 게임이어야 한다

Cycle의 목표는 “D4 구현”, “월드 컴파일러 추가”, “이벤트 시스템 개발”처럼 내부 기능으로 작성하지 않는다.
반드시 플레이어가 직접 확인할 수 있는 게임 문장으로 작성한다.

잘못된 예:

```text
Cycle 2 목표: 가능성 그래프와 충돌 해결기를 구현한다.
```

올바른 예:

```text
Cycle 2 목표:
플레이어와 두 NPC가 하나뿐인 치료 재료를 두고 거래·요청·강탈 중 서로 다른 전략을 선택하며,
플레이어의 개입과 방관에 따라 소유권·관계·후속 행동이 달라지는 장면을 플레이할 수 있다.
```

모든 Cycle은 최소한 다음을 가져야 한다.

1. 플레이어가 볼 수 있는 상황
2. 플레이어가 할 수 있는 행동
3. 플레이어가 아무것도 하지 않아도 진행되는 세계 행동
4. 서로 다른 결과가 나오는 두 개 이상의 개입 방식
5. 결과가 세계 상태에 남는 구조
6. 결과가 왜 발생했는지 인과 추적 화면으로 설명되는 구조
7. 같은 시드와 입력으로 다시 재생할 수 있는 구조

## 1.2 전체 모듈을 통과하되 모든 모듈을 매번 새로 만들지는 않는다

각 Cycle은 V부터 A까지 전체 파이프라인을 통과한다.
그러나 모든 모듈이 매 Cycle마다 같은 양의 신규 코드를 가져야 하는 것은 아니다.
각 Module Step은 다음 중 하나의 작업 모드를 가진다.

```ts
type StepMode =
  | "CREATE"   // 처음 구현
  | "EXTEND"   // 새 능력·상태·분기 추가
  | "REFINE"   // 기존 의미나 알고리즘을 정교화
  | "HARDEN"   // 성능·결정성·오류 처리·검증 강화
  | "REUSE";   // 코드 변경 없이 이번 Cycle에서 통합·회귀 검증
```

`SKIP`은 사용하지 않는다.
코드 변경이 없는 모듈도 이번 Cycle의 입력을 실제로 받아 처리하고, 결과가 다음 모듈로 전달되는지를 검증해야 한다.

## 1.3 얇은 구현은 허용하지만 우회 구현은 금지한다

Cycle 1의 구현은 단순해도 되지만 실제 파이프라인을 통과해야 한다.

허용되는 얇은 구현:

- N 계층을 실제 다중 서버가 아니라 단일 프로세스 권위 서버 인터페이스로 구현
- A 계층을 실제 LLM 생성보다 먼저 구조화 콘텐츠 스키마와 검증기로 구현
- W 계층을 2km 지형이 아니라 30m × 30m 의미 공간 컴파일러로 구현
- C 계층을 국가 전체가 아니라 열매 군락 같은 최소 복합 주체로 구현

금지되는 우회 구현:

- X가 W의 출력 없이 열매 좌표를 직접 하드코딩
- NPC를 P와 R을 거치지 않고 스크립트로 특정 좌표까지 이동
- UI가 R의 상태 저장소를 거치지 않고 허기 수치를 직접 수정
- A가 후보 생성과 검증을 거치지 않고 정식 세계 상태를 직접 변경
- N을 거치지 않고 클라이언트가 소유권과 전투 결과를 확정

## 1.4 한 Cycle은 한 가지 핵심 깊이를 중심으로 확장한다

복잡도를 통제하기 위해 하나의 Cycle에서 모든 방향을 동시에 깊게 만들지 않는다.
Cycle은 하나의 **주 깊이 축**과 최대 하나의 **보조 깊이 축**만 선택한다.

깊이 축은 다음처럼 관리한다.

```ts
interface DepthVector {
  causalDepth: number;       // 의존성부터 사건까지의 인과 길이
  strategicDepth: number;    // 대안·대응·실패·반격의 수
  subjectDepth: number;      // 주체의 기억·관계·믿음·개성
  worldDepth: number;        // 규칙·상태·역사·세계 요구 결합
  temporalDepth: number;     // 사건 연쇄·성장·장기 변화
  spatialDepth: number;      // 공간 의미·3D 지형·경로·현상
  onlineDepth: number;       // 권위·동기화·영속화·규모
  productionDepth: number;   // AI 생성·검증·자동 수정
}
```

예:

```text
Cycle 2
주 깊이 축: strategicDepth
보조 깊이 축: subjectDepth

추가되는 것:
- 같은 결핍에 대해 거래·요청·강탈이라는 세 전략
- 거절당한 기억이 다음 선택에 반영

추가하지 않는 것:
- 대규모 국가 전쟁
- 새로운 능력 체계
- 수십 km 지형
- 실제 다중 서버 분산 처리
```

## 1.5 이전 Cycle은 삭제하지 않고 회귀 시나리오가 된다

Cycle 2가 완성되었다고 Cycle 1 장면을 버리지 않는다.
각 Cycle은 이후 모든 Cycle에서 자동 실행되는 회귀 시나리오가 된다.

```text
Cycle 1 완료 → C01 리플레이 고정
Cycle 2 완료 → C01 + C02 리플레이 통과
Cycle 3 완료 → C01 + C02 + C03 리플레이 통과
```

스키마 변경으로 과거 리플레이를 그대로 실행할 수 없다면 다음 둘 중 하나가 필요하다.

- 상태·이벤트 마이그레이션 구현
- 호환 불가 사유와 대체 검증 장면을 기록한 명시적 버전 단절 승인

---

# 2. 계획 방향과 구현 방향을 분리한다

## 2.1 계획은 플레이 장면에서 역방향으로 한다

Cycle의 목표는 최종 게임 장면이므로, 계획할 때는 플레이어가 볼 결과에서 원인을 역으로 추적한다.

```text
플레이어가 보는 장면과 선택
← X. 어떤 3D 공간·UI·조작이 필요한가?
← N. 누가 결과를 확정하고 어떻게 저장하는가?
← C/G/E/R. 어떤 주체·성장·충돌·사건·지각이 필요한가?
← W/Q. 그 장면을 만들 세계 요소와 요구는 무엇인가?
← P/D/S. 어떤 가능성·의존성·주체가 그 요구를 발생시키는가?
← O. 그것을 허용하고 제한하는 공리·존재론·규칙은 무엇인가?
← V. 무엇을 증거로 완료를 판정할 것인가?
```

이 과정을 통해 게임 장면에 쓰이지 않는 내부 기능을 먼저 과도하게 구현하는 일을 막는다.

## 2.2 구현은 기존 인과 순서대로 정방향으로 한다

계획이 끝나면 실제 구현은 다음 순서를 유지한다.

```text
V → O → S → D → P → Q → W → R → E → G → C → X → N → A
```

앞 단계의 출력 계약이 검증되기 전에는 뒤 단계가 그 출력을 가정하여 코딩하지 않는다.
다만 뒤 단계의 인터페이스 초안과 테스트 더블은 계획 단계에서 미리 정의할 수 있다.

## 2.3 검증은 세 방향으로 한다

```text
모듈 내부 검증: 각 Step의 함수·상태·불변식
모듈 연결 검증: 이전 Step 출력이 다음 Step 입력으로 실제 사용되는지 확인
게임 장면 검증: 전체 Cycle이 브라우저에서 하나의 게임으로 동작하는지 확인
```

---

# 3. Cycle 생성 정책

## 3.1 Cycle 후보의 입력

다음 Cycle은 임의의 기능 목록에서 고르지 않는다.
항상 이전 Cycle의 검증 결과에서 생성한다.

Cycle 후보 입력은 다음과 같다.

- 현재 프로젝트가 아직 증명하지 못한 핵심 설계 주장
- 이전 플레이 테스트에서 직관적으로 이해되지 않은 부분
- 현재 파이프라인에서 가장 위험한 기술 가정
- 막힌 목적, 행동하지 않는 주체, 상호작용 없는 공간
- 반복적으로 발생한 회귀 오류
- 깊이가 부족한 모듈 능력
- 다음 게임 장면을 위해 반드시 필요한 기반

## 3.2 후보 평가식

각 후보는 1~5점으로 평가한다.

```text
Cycle Priority =
(Player Value
 × Architectural Risk
 × Learning Value
 × Reuse Potential
 × Dependency Readiness)
÷ Scope Cost
```

- **Player Value**: 실제 플레이 경험이 얼마나 달라지는가?
- **Architectural Risk**: 틀렸을 때 전체 설계를 뒤엎을 위험이 큰가?
- **Learning Value**: 이번 Cycle을 통해 중요한 불확실성을 줄일 수 있는가?
- **Reuse Potential**: 이후 여러 Cycle에 반복 사용되는가?
- **Dependency Readiness**: 이전 Cycle의 검증된 능력만으로 시작 가능한가?
- **Scope Cost**: 신규 주체·상태·규칙·UI·네트워크 개념의 총량은 얼마인가?

## 3.3 Cycle 선택 규칙

다음 조건을 모두 만족하는 후보만 선택한다.

1. 한 문장으로 플레이 장면을 설명할 수 있다.
2. 3~10분 안에 대표 장면을 처음부터 끝까지 확인할 수 있다.
3. 최소 두 개의 결과 분기가 있다.
4. 플레이어가 방관해도 세계가 진행된다.
5. 주 깊이 축이 하나로 명확하다.
6. 기존 Cycle의 검증된 능력을 재사용한다.
7. 필요한 모든 세계 요소에 주체 요구 근거가 있다.
8. 각 모듈의 기여를 역추적할 수 있다.
9. 브라우저 Lab에서 원인과 결과를 설명할 수 있다.
10. 완료 판정을 자동화할 수 있다.

## 3.4 기본 복잡도 예산

초기 Cycle은 다음 예산을 기본값으로 사용한다.
초과할 수는 있지만 Cycle 문서에 이유를 기록해야 한다.

```text
신규 핵심 공리:       0~2개
신규 주체 종류:       0~1개
신규 의존 타입:       0~2개
신규 행동 원자:       0~3개
신규 전략 분기:       1~3개
신규 세계 규칙:       0~2개
신규 상태 종류:       0~5개
신규 UI 개념:         0~1개
신규 네트워크 개념:   0~1개
신규 AI 자동화 단계:  0~1개
```

다음 중 하나라도 해당하면 Cycle을 둘로 나눈다.

- 플레이 목표를 “그리고”로 세 번 이상 연결해야 설명할 수 있음
- 신규 핵심 규칙이 세 개 이상임
- 서로 독립적인 기술 위험이 두 개 이상임
- 대표 장면을 자동화하려면 10분 이상 필요함
- 실패 원인을 한 화면에서 추적하기 어려움
- 어떤 모듈이 무엇을 증명하는지 명확하지 않음

---

# 4. Cycle 전체 WORKFLOW

## Phase 0. 검증 기반과 모듈 껍질 준비

이 단계는 반복 Cycle 전에 한 번 수행하는 Foundation 단계다.
게임 콘텐츠를 깊게 만들지는 않지만 Cycle을 생성하고 검증할 수 있는 기반을 만든다.

구현 대상:

- V0 모듈 계약 레지스트리
- V1 결정적 Tick, Seeded Random, Deterministic ID, Stable Sort, State Hash
- V2 시나리오 실행기
- V3 브라우저 검증 Lab 기본 프레임
- V4 완료 증거 파일 생성기
- O~A의 최소 인터페이스 패키지
- Cycle 및 Step 스키마
- 리플레이 저장소

Foundation 완료 조건:

```text
빈 Cycle을 등록할 수 있다.
Module Step 의존 그래프를 검사할 수 있다.
같은 입력을 두 번 실행하여 같은 해시를 얻을 수 있다.
브라우저 Lab이 상태 전후와 이벤트 목록을 표시할 수 있다.
Step 완료 증거를 JSON으로 생성할 수 있다.
```

Foundation은 게임 Cycle로 세지 않는다.
첫 번째 게임 결과는 반드시 Cycle 1에서 나온다.

---

## Phase 1. 이전 검증 기준선 고정

다음 Cycle을 시작하기 전에 최신 VERIFIED Cycle을 기준선으로 고정한다.

입력:

- 마지막 Cycle의 코드 버전
- 상태 및 이벤트 스키마 버전
- 모든 이전 리플레이
- 완료 증거
- 알려진 문제 목록
- 플레이 테스트 결과

출력:

```yaml
baseline:
  cycle: C03
  sourceHash: "..."
  schemaVersion: 7
  replaySet:
    - C01-idle
    - C01-player-takes
    - C02-trade
    - C03-false-rumor
```

기준선이 없으면 신규 Cycle의 변경으로 무엇이 좋아지고 무엇이 깨졌는지 판정할 수 없다.

---

## Phase 2. Cycle 목표 계약 작성

Cycle 목표를 내부 기능이 아니라 게임 경험으로 정의한다.

```ts
interface CycleSpec {
  id: string;
  title: string;
  baselineCycleId: string;

  playerGoal: string;
  systemHypothesis: string;
  primaryDepthAxis: keyof DepthVector;
  secondaryDepthAxis?: keyof DepthVector;

  initialState: ScenarioStateRef;
  playerActions: string[];
  autonomousWorldActions: string[];
  outcomeBranches: OutcomeBranchSpec[];

  scopeBudget: ScopeBudget;
  moduleSteps: ModuleStepRef[];
  acceptance: CycleAcceptanceSpec;
}
```

Cycle 목표 계약에는 반드시 다음이 들어간다.

### 2.1 플레이어 관점 목표

```text
어디에서 무엇을 보고,
무엇을 선택할 수 있으며,
선택 또는 방관 때문에 무엇이 달라지는가?
```

### 2.2 시스템 가설

```text
이번 장면을 통해 전체 설계의 어떤 주장이 맞는지 검증하는가?
```

예:

```text
결핍된 의존성이 목적과 행동을 만들고,
그 행동이 플레이어의 행동과 충돌하여
퀘스트 없이도 이해 가능한 사건을 만든다.
```

### 2.3 결과 분기

최소한 다음 세 종류를 권장한다.

- **방관 분기**: 플레이어가 아무것도 하지 않음
- **정상 개입 분기**: 예상되는 방식으로 개입
- **대안 또는 실패 분기**: 거절, 우회, 경쟁, 잘못된 정보 등

### 2.4 플레이 가능 완료 판정

```text
브라우저에서 시작 버튼을 누른다.
개발자 콘솔 없이 상황을 이해한다.
플레이어가 실제로 이동·관찰·상호작용한다.
NPC가 스크립트가 아니라 현재 의존성과 믿음으로 행동한다.
결과가 이벤트와 상태로 남는다.
원인 추적 화면에서 전체 경로를 확인한다.
저장 후 재실행하거나 동일 시드로 리플레이한다.
```

---

## Phase 3. 최종 장면에서 모듈 요구를 역방향 도출

Cycle 목표를 정한 뒤 최종 장면에서 필요한 원인을 역으로 찾는다.

산출물은 `TRACE.graph.json`이다.

```text
Player-visible Outcome
  ← Interaction/Event
  ← Runtime Intent/Perception/Belief
  ← Canonical World State
  ← World Requirement
  ← Possibility/Strategy
  ← Dependency Pressure
  ← Subject Prototype
  ← Axiom/Rule
```

각 노드는 다음 정보를 가진다.

```ts
interface TraceNode {
  id: string;
  kind:
    | "player_evidence"
    | "event"
    | "intent"
    | "world_state"
    | "world_requirement"
    | "possibility"
    | "dependency"
    | "subject"
    | "axiom";
  producedByStep: string;
  consumedBySteps: string[];
  sourceRefs: string[];
}
```

역추적 중 다음 질문에 답하지 못하는 요소는 Cycle 범위에서 제거하거나 상위 원인을 추가한다.

- 이 오브젝트가 왜 세계에 있는가?
- 이 NPC가 왜 이 행동을 하는가?
- 이 행동은 어떤 결핍과 가능성에서 나왔는가?
- 이 결과는 어떤 규칙과 충돌 해결로 정해졌는가?
- 플레이어는 무엇을 보고 이 상황을 이해하는가?
- 결과는 어디에 기록되어 다음 행동에 영향을 주는가?

---

## Phase 4. 2차원 Cycle 행 생성

역추적 그래프를 기존 모듈 순서에 배치하여 하나의 Cycle 행을 만든다.

```text
C04-V  C04-O  C04-S  C04-D  C04-P  C04-Q  C04-W
C04-R  C04-E  C04-G  C04-C  C04-X  C04-N  C04-A
```

각 모듈에는 다음을 지정한다.

- 이번 Cycle의 역할
- 작업 모드 CREATE/EXTEND/REFINE/HARDEN/REUSE
- 입력 계약
- 출력 계약
- 변경할 상태 범위
- 다음 모듈이 사용할 출력
- 플레이어가 확인할 수 있는 증거
- 자동 검증 방식

예:

```yaml
module: D4
mode: EXTEND
purpose: "NPC의 에너지 결핍과 치료 재료 결핍을 동시에 평가한다."
consumes:
  - S3:IndividualSubject
  - O2:WorldStateSnapshot
produces:
  - DependencyPressureSet
stateWrites: []
playerEvidence:
  - "Lab에서 두 압력의 계산 근거와 우선순위를 확인"
nextConsumers:
  - P1
  - P4
```

모든 출력은 다음 모듈 중 하나에서 실제로 소비되어야 한다.
소비되지 않는 출력은 과잉 구현으로 간주한다.

---

## Phase 5. Module Step을 구현 수준으로 분해

각 Module Step은 바로 코드로 옮길 수 있도록 다음 형식으로 작성한다.

```ts
interface ModuleCycleStep {
  id: string;                  // 예: C04-O0-S01
  cycleId: string;
  moduleId: string;            // 예: O0
  mode: StepMode;

  purpose: string;
  playerEvidence: string[];

  consumes: ArtifactRef[];
  produces: ArtifactRef[];

  implementation: {
    filesToCreate: string[];
    filesToModify: string[];
    types: string[];
    objects: string[];
    functions: FunctionTaskSpec[];
    stateReads: string[];
    stateWrites: string[];
    eventsEmitted: string[];
    errors: string[];
  };

  verification: {
    unitTests: string[];
    propertyTests: string[];
    failureTests: string[];
    integrationTests: string[];
    labPanels: string[];
    replayScenarios: string[];
  };

  doneEvidence: string[];
}
```

하나의 Step은 다음 다섯 묶음으로 분해한다.

### 5.1 계약·스키마 Task

- 입력 타입
- 출력 타입
- 오류 타입
- 변경 가능한 상태 경로
- 이벤트 스키마
- 버전

### 5.2 순수 로직 Task

- 계산 함수
- 후보 생성 함수
- 선택 함수
- 검증 함수
- 설명 함수

가능하면 이 단계는 World Store에 직접 접근하지 않는 순수 함수로 만든다.

### 5.3 런타임 연결 Task

- 상태 읽기
- 명령 제출
- 이벤트 생성
- 상태 전이 적용
- 다음 모듈 출력 전달

### 5.4 직관적 확인 Task

- Lab 입력 폼
- 처리 과정 표시
- 후보와 선택 결과 표시
- 상태 전후 diff
- 실패 사유
- 인과 추적 링크

### 5.5 자동 검증 Task

- 정상 단위 테스트
- 실패 테스트
- 경계값·속성 테스트
- 다음 모듈과의 통합 테스트
- 대표 리플레이
- 완료 증거 파일

---

## Phase 6. 정방향 구현과 Step Gate

구현은 고정된 모듈 순서대로 진행한다.

```text
V Gate
→ O Gate
→ S Gate
→ D Gate
→ P Gate
→ Q Gate
→ W Gate
→ R Gate
→ E Gate
→ G Gate
→ C Gate
→ X Gate
→ N Gate
→ A Gate
```

각 Step은 다음 Gate를 통과해야 한다.

### Step Gate

```text
입력·출력 스키마가 등록되었다.
정상·실패·경계 테스트가 통과했다.
결정적 결과가 확인되었다.
Lab에서 처리 과정이 보인다.
출력 샘플이 생성되었다.
완료 증거 JSON이 생성되었다.
```

### Module Handoff Gate

```text
이전 모듈의 실제 출력이 다음 모듈 입력으로 사용된다.
테스트용 하드코딩 데이터가 운영 경로에 남아 있지 않다.
출력 중 소비되지 않는 필드가 없다.
오류가 다음 모듈에서 숨겨지지 않는다.
인과 추적 ID가 유지된다.
```

모듈 단독 테스트를 통과해도 Handoff Gate를 통과하지 못하면 완료가 아니다.

---

## Phase 7. 수직 통합 장면 조립

X 단계에 도달한 뒤에 처음 연결하는 것이 아니라, 각 모듈 Gate가 통과할 때 Cycle 장면에 계속 연결한다.

권장 통합 순서:

```text
1. O/S/D/P를 Lab 텍스트 장면으로 연결
2. Q/W를 의미 공간 그래프로 연결
3. R/E를 헤드리스 시뮬레이션으로 연결
4. G/C를 반복 실행과 장기 상태에 연결
5. X를 통해 3D 플레이로 표현
6. N을 통해 명령·권위·저장을 단일 경로로 통합
7. A를 통해 동일 스키마의 콘텐츠 후보를 생성·검증
```

각 단계에서 플레이 장면은 불완전해도 실행 가능해야 한다.
예를 들어 X가 완성되기 전에는 Lab의 2D 노드 화면으로 같은 장면을 실행한다.

---

## Phase 8. Cycle Playable Gate

Cycle 완료는 테스트 통과만으로 판정하지 않는다.
반드시 실제 게임 빌드로 다음을 확인한다.

### 8.1 이해 가능성

- 플레이어가 현재 상황을 UI와 세계 현상으로 이해할 수 있는가?
- 퀘스트 설명문 없이도 누가 무엇을 원하고 있는지 추론 가능한가?
- 중요한 정보가 개발자 콘솔에만 있지 않은가?

### 8.2 개입 가능성

- 플레이어가 실제로 선택할 수 있는가?
- 선택이 단순한 버튼 분기가 아니라 세계 상태와 주체 행동을 바꾸는가?
- 아무것도 하지 않는 것도 하나의 유효한 선택인가?

### 8.3 자율 진행

- NPC와 세계가 플레이어 입력 없이도 목적을 선택하고 행동하는가?
- 결과가 미리 작성된 타임라인이 아니라 현재 상태에서 계산되는가?

### 8.4 결과 지속성

- 소유권·관계·기억·자원·공간 상태 중 하나 이상이 실제로 변하는가?
- 저장 후 다시 불러와도 변화가 유지되는가?
- 후속 행동이 변경된 상태를 사용하게 되는가?

### 8.5 설명 가능성

하나의 결과를 선택하면 다음 경로가 표시되어야 한다.

```text
세계관 공리
→ 주체
→ 의존성
→ 결핍
→ 가능성
→ 목적과 전략
→ 세계 요구
→ 정식 세계 요소
→ 지각과 믿음
→ 행동 의도
→ 충돌
→ 사건
→ 성장 또는 의존 변화
```

### 8.6 결정적 재생

- 같은 시드와 같은 입력으로 같은 최종 상태 해시가 나오는가?
- 다른 결과가 나온 경우 최초 차이 Tick과 상태 경로를 표시하는가?

---

## Phase 9. 전체 회귀 검증

현재 Cycle과 모든 이전 Cycle을 실행한다.

```text
Unit Tests
→ Property Tests
→ Module Integration
→ Current Cycle Replays
→ Previous Cycle Replays
→ Save/Load Replays
→ Browser Playable Scenarios
```

변경이 의도된 경우 단순히 새 해시로 덮어쓰지 않는다.
다음 내용을 기록한다.

```yaml
replayChange:
  replayId: C02-refuse-trade
  previousHash: "..."
  newHash: "..."
  reason: "관계 감소가 요청 이벤트 뒤가 아니라 거절 이벤트 뒤에 적용되도록 수정"
  intendedStatePaths:
    - subjects.npcA.relationships.player.trust
  unintendedPaths: []
  approvedBy: "cycle-review"
```

---

## Phase 10. Cycle 동결과 능력 원장 갱신

Playable Gate와 회귀 검증을 통과하면 Cycle을 VERIFIED로 동결한다.

산출물:

- `CYCLE.yaml`
- `TRACE.graph.json`
- 모든 `STEP.yaml`
- 대표 시나리오 입력
- 리플레이와 최종 해시
- 브라우저 캡처 또는 자동 Playwright 결과
- 완료 증거
- 플레이 테스트 결과
- 알려진 한계
- 다음 Cycle 후보

Cycle 완료 증거 예:

```json
{
  "cycle": "C04-border-canyon",
  "baseline": "C03",
  "sourceHash": "...",
  "moduleSteps": 42,
  "verifiedSteps": 42,
  "currentCycleReplays": "passed",
  "previousCycleReplays": "passed",
  "saveLoadReplay": "passed",
  "playableGate": "passed",
  "causalTraceCoverage": 1.0,
  "status": "VERIFIED"
}
```

능력 원장은 숫자만 기록하지 않고 실제 검증된 능력을 기록한다.

```yaml
capabilities:
  D4:
    - "단일 자원 결핍 평가"
    - "두 의존성의 압력 비교"
  P4:
    - "비용과 성공 가능성으로 목적 선택"
    - "거절 기억에 따른 전략 가중치 변경"
  W1:
    - "두 주체의 자원 요구를 하나의 공간 요소로 병합"
```

---

## Phase 11. 다음 Cycle 생성

현재 Cycle의 결과에서 다음 후보를 만든다.

```text
검증 실패
→ 같은 Cycle에서 수정

검증 통과 + 깊이 부족
→ 같은 장면의 다음 깊이 Cycle 후보

검증 통과 + 새로운 상호작용 발견
→ 파생 장면 Cycle 후보

검증 통과 + 기술 위험 해소
→ 다음으로 큰 위험을 가진 Cycle 후보
```

다음 Cycle을 선택할 때 기존 장면을 단순히 크게 복제하지 않는다.
새 Cycle은 기존 장면의 원인·대안·시간·주체·공간·규모 중 하나를 실제로 깊게 해야 한다.

---

# 5. Cycle 및 Step 파일 구조

Cycle 계획과 검증 자료는 코드와 분리하되, 실제 소스 코드는 Cycle별로 복제하지 않는다.

```text
/cycles
  /C01-food-pressure
    CYCLE.yaml
    TRACE.graph.json
    /steps
      C01-V0-S01.yaml
      C01-O0-S01.yaml
      C01-D4-S01.yaml
      ...
    /scenarios
      idle.yaml
      player-takes-food.yaml
      player-refuses-request.yaml
    /replays
      idle.replay.json
      player-takes-food.replay.json
    /evidence
      cycle-evidence.json
      module-evidence/
    PLAYTEST.md
    LIMITATIONS.md

/packages
  /verification
  /ontology
  /subjects
  /dependencies
  /possibilities
  /world-requirements
  /world-compiler
  /runtime
  /events
  /growth
  /complex-subjects
  /client-3d
  /server
  /ai-authoring

/apps
  /lab
  /game
  /server
```

원칙:

```text
Cycle 디렉터리: 목표·Step·시나리오·증거를 보존
packages 디렉터리: Cycle을 거치며 계속 확장되는 실제 구현
```

Cycle 2가 Cycle 1 소스를 복사해 별도 구현하지 않는다.
같은 모듈 소스를 확장하고 Cycle 1 리플레이로 이전 동작을 보호한다.

---

# 6. 재사용 가능한 Cycle 문서 템플릿

```md
# CXX. Cycle 제목

## 1. 플레이 목표
플레이어가 어디에서 무엇을 보고, 무엇을 선택하며, 무엇이 달라지는가?

## 2. 검증할 시스템 가설
이번 게임 장면으로 어떤 설계 주장을 증명하는가?

## 3. 기준선
- 이전 VERIFIED Cycle:
- 상태 스키마 버전:
- 필수 회귀 리플레이:

## 4. 깊이 증가
- 주 깊이 축:
- 보조 깊이 축:
- 이전 Cycle보다 실제로 깊어진 점:

## 5. 범위 예산
- 신규 공리:
- 신규 주체:
- 신규 의존성:
- 신규 행동:
- 신규 규칙:
- 신규 UI:
- 신규 네트워크/AI 개념:

## 6. 대표 장면
### 초기 상태
### 플레이어가 관찰할 현상
### 플레이어 행동
### 자율 세계 행동
### 결과 분기 A: 방관
### 결과 분기 B: 기본 개입
### 결과 분기 C: 대안·실패

## 7. 인과 추적
O → S → D → P → Q → W → R → E → G → C → X → N → A

## 8. Module Step 목록
### V
### O
### S
### D
### P
### Q
### W
### R
### E
### G
### C
### X
### N
### A

## 9. Playable Gate

## 10. 회귀 검증

## 11. 완료 증거

## 12. 알려진 한계

## 13. 다음 Cycle 후보
```

---

# 7. 재사용 가능한 Module Step 템플릿

```yaml
id: CXX-O0-S01
cycle: CXX
module: O0
mode: EXTEND

purpose: "이번 Cycle에서 이 Step이 반드시 해결할 한 가지 목적"
playerEvidence:
  - "게임 또는 Lab에서 눈으로 확인할 증거"

consumes:
  - artifact: "..."
    from: "..."

produces:
  - artifact: "..."
    schema: "..."
    consumedBy:
      - "..."

implementation:
  filesToCreate: []
  filesToModify: []
  types: []
  objects: []
  functions:
    - name: "..."
      input: "..."
      output: "..."
      errors: []
      deterministic: true
  stateReads: []
  stateWrites: []
  eventsEmitted: []

verification:
  unitTests: []
  propertyTests: []
  failureTests: []
  integrationTests: []
  labPanels: []
  replayScenarios: []

doneEvidence:
  - "source hash"
  - "test report"
  - "state hash"
  - "lab scenario result"
```

---

# 8. Cycle 1의 구체적 예시

## 8.1 Cycle 1 목표

```text
작은 3D 협곡에 플레이어, 배고픈 채집자 NPC, 열매가 하나 남은 열매 군락이 존재한다.
플레이어가 아무것도 하지 않으면 NPC는 열매를 발견하고 이동하여 획득하고 먹는다.
플레이어가 먼저 열매를 가져가면 NPC는 플레이어가 열매를 가지고 있다고 믿고 양도를 요청한다.
플레이어가 주거나 거절하면 허기, 소유권, 관계, 기억, 다음 행동이 서로 다르게 변한다.
모든 결과는 의존성부터 사건까지 하나의 인과 경로로 설명되고 저장된다.
```

### 시스템 가설

```text
하나의 실제 의존성이 가능성과 세계 요구를 만들고,
실체화된 세계 안에서 지각·판단·충돌·사건·성장으로 이어지면,
퀘스트 목록 없이도 플레이어가 이해하고 개입할 수 있는 최소 게임 콘텐츠가 발생한다.
```

### 대표 분기

```text
A. 방관
NPC가 열매를 획득하고 먹는다.
허기 압력이 감소하고 열매 재고가 0이 된다.

B. 양도
플레이어가 먼저 열매를 획득하고 NPC의 요청을 수락한다.
소유권이 이전되고 NPC가 먹는다.
NPC의 신뢰가 증가한다.

C. 거절
플레이어가 요청을 거절한다.
NPC의 허기는 유지되고 플레이어에 대한 신뢰가 감소한다.
NPC는 거절 사건과 플레이어의 소유 사실을 기억한다.
```

## 8.2 Cycle 1 전체 Module Step 개요

### V — 검증 기반

구현:

- `CycleRegistry`
- `ScenarioRunner`
- `ReplayRecorder`
- `StateHasher`
- `EvidenceWriter`
- 인과 추적 Lab

핵심 함수:

```ts
registerCycle(spec: CycleSpec): void
runScenario(id: string, input: ScenarioInput): ScenarioResult
replay(log: ReplayLog): ScenarioResult
hashWorldState(state: WorldState): string
writeCycleEvidence(result: CycleVerificationResult): void
```

증거:

- 세 분기 자동 실행
- 같은 시드 재생 해시 동일
- 최초 상태 차이 경로 출력

### O — 세계관 공리와 존재론

Cycle 1 공리:

1. 생명 주체는 활동 에너지를 유지해야 한다.
2. 자원을 소비하여 얻은 에너지는 자원 재고 감소를 동반한다.
3. 정식 세계 상태는 사건 없이 변경될 수 없다.
4. 행동은 지각 가능한 현상 또는 기록을 남긴다.
5. 관찰된 정식 세계 요소는 사건 없이 소급 변경되지 않는다.

Cycle 1 존재론:

- `Subject`
- `ResourceEntity`
- `PopulationSubject`
- `Dependency`
- `Possibility`
- `WorldRequirement`
- `WorldState`
- `Event`
- `Phenomenon`
- `Claim`
- `Ownership`

Cycle 1 상태:

- 위치
- 에너지
- 허기 압력
- 열매 재고
- 소유권
- 신뢰
- 알려진 열매 위치
- 정식화 상태

### S — 주체 원형

구현:

- 인간 종 원형
- 플레이어 역할
- 채집자 역할
- 플레이어 1명과 채집자 NPC 1명 생성

핵심 객체:

```ts
HumanSpeciesPrototype
PlayerRolePrototype
ForagerRolePrototype
SubjectFactory
```

### D — 의존 그래프

구현:

```text
채집자
└─ 활동 에너지 유지
   └─ 섭취 가능한 식량 필요
```

핵심 함수:

```ts
buildBaseDependencyGraph(subject: Subject): DependencyGraph
evaluateDependencySatisfaction(graph: DependencyGraph, world: WorldView): DependencyEvaluation
calculatePressure(node: DependencyNode, state: DependencyState): number
```

검증:

- 열매를 먹기 전 압력 상승
- 먹은 뒤 압력 감소
- 열매가 충분하면 식량 목적 비활성

### P — 가능성 그래프

Cycle 1 행동 원자:

- 관찰
- 이동
- 획득
- 섭취
- 요청
- 양도
- 거절

핵심 가능성:

```text
열매가 무소유 상태 → 직접 획득
플레이어가 소유 → 양도 요청
요청 수락 → 이전된 열매 섭취
요청 거절 → 기억·관계 갱신 후 목적 재평가
```

핵심 함수:

```ts
generatePossibilities(context: PossibilityContext): PossibilityCandidate[]
scorePossibility(candidate: PossibilityCandidate, subject: Subject): number
selectCommitment(candidates: PossibilityCandidate[]): Commitment
buildActionPlan(commitment: Commitment): ActionPlan
```

### Q — 세계 요구

의존성과 가능성에서 다음 요구를 추출한다.

```text
섭취 가능한 자원이 존재할 수 있어야 한다.
자원에 접근 가능한 이동 공간이 필요하다.
자원을 발견할 수 있는 시각 현상이 필요하다.
자원을 획득하고 소유권을 변경하는 규칙이 필요하다.
소유자에게 양도를 요청할 상호작용이 필요하다.
```

핵심 함수:

```ts
extractWorldRequirements(plan: ActionPlan): WorldRequirement[]
separateDesiredOutcome(requirement: WorldRequirement): RequirementValidation
traceRequirementOrigin(requirementId: string): RequirementOriginPath
```

### W — 세계 컴파일

구현:

- 인간의 식량 요구와 열매 군락의 번식·재고 요구를 병합
- 30m × 30m 의미 공간 생성
- 플레이어 시작점, NPC 시작점, 열매 군락, 이동 가능한 경로 배치
- 열매 군락의 기원 사건 생성
- 정식 세계로 등록

핵심 함수:

```ts
normalizeRequirements(requirements: WorldRequirement[]): NormalizedRequirement[]
mergeRequirements(requirements: NormalizedRequirement[]): WorldElementProposal[]
compileSemanticSpace(proposals: WorldElementProposal[]): SemanticSpaceGraph
instantiateWorld(graph: SemanticSpaceGraph, seed: number): CanonicalWorld
```

금지:

- X에서 열매 좌표 직접 지정
- NPC 행동을 위해 임의의 경로를 별도 작성

### R — 세계 런타임

구현:

- World Store
- 사건 로그
- 열매의 색·형태 현상
- NPC 시야 지각
- “열매가 저 위치에 있다”, “플레이어가 열매를 가진다”는 믿음
- 행동 의도 제출

핵심 함수:

```ts
appendEvent(event: WorldEvent): WorldState
emitPhenomena(event: WorldEvent): Phenomenon[]
perceive(subject: Subject, phenomena: Phenomenon[]): Observation[]
updateBeliefs(subject: Subject, observations: Observation[]): BeliefGraph
submitIntent(subject: Subject, plan: ActionPlan): ActionIntent
```

### E — 사건과 상호작용

구현:

- 같은 열매를 향한 행동을 하나의 상황으로 군집
- 무소유 열매 획득
- 소유된 열매에 대한 요청
- 양도 또는 거절
- 소유권 충돌 해결
- 관계와 후속 사건 생성

핵심 사건:

```text
ResourceAcquired
TransferRequested
TransferAccepted
TransferRejected
ResourceTransferred
ResourceConsumed
TrustChanged
```

### G — 성장과 의존 변형

Cycle 1에서는 수치 레벨업을 만들지 않는다.
경험으로 가능성 그래프가 한 단계 변하는 최소 성장을 구현한다.

```text
NPC가 열매 군락을 직접 발견함
→ knownFoodLocations에 위치 추가
→ 다음 식량 탐색에서 무작위 탐색 대신 알려진 위치 확인 가능성 생성
```

거절 경험도 다음 전략 가중치에 반영한다.

```text
같은 소유자에게 거절당함
→ 직접 재요청 성공 기대치 감소
→ 다른 식량원 탐색 가능성의 가중치 증가
```

### C — 복합 주체

열매 군락을 최소 복합 생태 주체로 구현한다.

```ts
interface ResourcePopulationSubject {
  id: string;
  stock: number;
  capacity: number;
  regrowthTicks: number;
  habitatRequirement: PredicateSpec;
}
```

Cycle 1에서는 재고 1과 단순 재생 규칙만 사용한다.
향후 Cycle에서 날씨·토양·경쟁 생물로 깊어진다.

### X — 3D 웹 클라이언트

구현:

- 작은 협곡 지형
- 플레이어 이동
- 열매 관찰과 획득
- NPC 이동과 요청 표시
- 양도·거절 상호작용
- 현재 사건, 소유권, NPC 의도 표시
- 선택한 사건의 전체 인과 경로 표시

플레이어는 개발자 콘솔을 열지 않고 세 분기를 실행할 수 있어야 한다.

### N — 권위와 영속화

Cycle 1에서는 단일 프로세스 권위 서버로 구현한다.

```ts
interface AuthorityServer {
  submitCommand(command: PlayerCommand): CommandReceipt;
  tick(): TickResult;
  getSnapshot(): WorldSnapshot;
  save(): PersistedWorld;
  load(data: PersistedWorld): void;
}
```

원칙:

- 클라이언트는 열매 획득과 양도를 요청한다.
- 서버가 소유권과 사건 순서를 확정한다.
- 저장 후 다시 불러와도 열매 재고, 소유권, 신뢰, 기억이 유지된다.

### A — AI 제작 자동화

Cycle 1에서는 실제 자유 생성보다 AI가 사용할 구조를 먼저 검증한다.

구현:

- `ContentPackage` 스키마
- 인간 원형 후보
- 열매 군락 후보
- 의존 그래프 후보
- 공리·의존 경로·무비용 효과 검증
- 후보 승인 후에만 W 입력으로 전달

검증 장면:

```text
정상 후보 → 정적 검증 통과 → Cycle 1 세계 생성에 사용
에너지 증가만 있고 열매 재고 감소가 없는 후보 → O0 공리 위반으로 거부
근거 없이 X 좌표를 직접 지정한 후보 → Q/W 경로 누락으로 거부
```

## 8.3 Cycle 1 완료 조건

```text
세 분기를 브라우저에서 직접 플레이할 수 있다.
NPC가 현재 허기와 지각 결과로 행동한다.
열매는 주체 요구에서 도출된 W 출력으로 배치된다.
모든 상태 변경은 사건으로 기록된다.
소유권 충돌은 권위 경로에서 한 번만 결정된다.
경험이 다음 가능성 그래프에 영향을 준다.
저장·불러오기 후 결과가 유지된다.
동일 시드와 입력의 상태 해시가 같다.
각 사건에서 O→A 전체 인과 경로를 확인할 수 있다.
이전 단계의 출력을 우회한 하드코딩 경로가 없다.
```

---

# 9. O0 Step을 구현 수준으로 완전히 분해한 예시

다음은 사용자가 예로 든 `Cycle 1 / O0. 세계관 공리`의 실제 Step 분할 예다.

## C01-O0-S01. 공리 메타데이터 스키마

목적:

```text
공리를 설명 문장만이 아니라 정의 검증과 상태 전이 검증에서 실행 가능한 객체로 표현한다.
```

파일:

```text
packages/ontology/src/axiom/axiom-types.ts
packages/ontology/src/axiom/axiom-errors.ts
```

타입:

```ts
type AxiomPhase = "definition" | "world_compile" | "runtime_transition";
type AxiomSeverity = "error" | "warning";

interface AxiomSpec {
  id: string;
  description: string;
  phases: AxiomPhase[];
  severity: AxiomSeverity;
  evaluatorId: string;
}

interface AxiomContext {
  phase: AxiomPhase;
  before?: unknown;
  input: unknown;
  after?: unknown;
  traceId: string;
}

interface AxiomResult {
  axiomId: string;
  passed: boolean;
  violationCode?: string;
  message: string;
  statePaths: string[];
}
```

완료 조건:

- JSON 직렬화 가능한 공리 메타데이터
- 실행기와 분리된 evaluator ID
- 위반 상태 경로 표현 가능

## C01-O0-S02. 공리 레지스트리

파일:

```text
packages/ontology/src/axiom/axiom-registry.ts
```

객체:

```ts
class AxiomRegistry {
  register(spec: AxiomSpec, evaluator: AxiomEvaluator): void;
  get(id: string): RegisteredAxiom;
  listByPhase(phase: AxiomPhase): RegisteredAxiom[];
  snapshot(): AxiomRegistrySnapshot;
}
```

오류:

- 중복 공리 ID
- 존재하지 않는 evaluator
- 지원하지 않는 phase

테스트:

- 동일 ID 중복 등록 거부
- 등록 순서와 관계없는 안정 정렬
- snapshot 해시 결정성

## C01-O0-S03. Cycle 1 공리 평가기

파일:

```text
packages/ontology/src/axiom/evaluators/living-energy.ts
packages/ontology/src/axiom/evaluators/resource-conservation.ts
packages/ontology/src/axiom/evaluators/event-sourced-transition.ts
packages/ontology/src/axiom/evaluators/observable-action.ts
packages/ontology/src/axiom/evaluators/observed-world-lock.ts
```

핵심 함수:

```ts
checkLivingEnergyDependency(ctx: AxiomContext): AxiomResult
checkResourceConservation(ctx: AxiomContext): AxiomResult
checkEventSourcedTransition(ctx: AxiomContext): AxiomResult
checkObservableAction(ctx: AxiomContext): AxiomResult
checkObservedWorldLock(ctx: AxiomContext): AxiomResult
```

대표 검증:

```text
열매 1개를 먹고 에너지가 증가했는데 열매 재고가 그대로다.
→ resource-conservation 위반

World Store의 신뢰 수치를 직접 수정하고 대응 사건이 없다.
→ event-sourced-transition 위반

플레이어가 이미 본 열매 군락 좌표를 새 요구 때문에 조용히 이동한다.
→ observed-world-lock 위반
```

## C01-O0-S04. 정의 검증기와 런타임 전이 가드

파일:

```text
packages/ontology/src/axiom/definition-validator.ts
packages/ontology/src/axiom/transition-guard.ts
```

함수:

```ts
validateDefinition(input: DefinitionCandidate, registry: AxiomRegistry): ValidationReport
validateWorldProposal(input: WorldProposal, registry: AxiomRegistry): ValidationReport
validateTransition(input: StateTransitionCandidate, registry: AxiomRegistry): ValidationReport
assertTransitionAllowed(input: StateTransitionCandidate): void
```

연결:

- A2 정적 검증이 `validateDefinition` 사용
- W2/W3가 `validateWorldProposal` 사용
- R1의 사건 적용기가 `validateTransition` 사용

완료 조건:

- 세 모듈이 같은 공리 레지스트리를 사용
- 공리 위반을 각 모듈이 별도 규칙으로 중복 구현하지 않음

## C01-O0-S05. 공리 사용 추적

파일:

```text
packages/ontology/src/axiom/axiom-trace.ts
```

함수:

```ts
recordAxiomEvaluation(result: AxiomResult, trace: CausalTrace): void
explainAxiomViolation(result: AxiomResult): HumanReadableExplanation
findAxiomsForEvent(eventId: string): AxiomTraceEntry[]
```

출력 예:

```text
ResourceConsumed 이벤트
├─ living-subject-requires-energy: 통과
├─ resource-consumption-is-conserved: 통과
└─ event-sourced-transition: 통과
```

## C01-O0-S06. Lab 화면

표시:

- 등록된 공리 목록
- 공리의 적용 phase
- 현재 선택된 정의·세계 제안·상태 전이
- 각 공리의 통과/실패
- 위반 상태 경로
- 이 공리를 요구한 Cycle Step
- 위반 후보와 수정 후 후보 비교

## C01-O0-S07. 자동 검증과 완료 증거

테스트:

```text
정상 정의 테스트
공리 위반 정의 테스트
정상 상태 전이 테스트
사건 없는 직접 변경 테스트
관찰 상태 소급 변경 테스트
공리 등록 순서를 바꾼 결정성 테스트
A2/W2/R1 통합 테스트
```

완료 증거:

```json
{
  "step": "C01-O0",
  "axiomsRegistered": 5,
  "unitTests": "passed",
  "failureTests": "passed",
  "integrationTests": ["A2", "W2", "R1"],
  "registryHash": "...",
  "status": "VERIFIED"
}
```

이 정도 수준으로 각 Cycle의 O0, D4, P4, W1 같은 모든 Module Step을 분해한다.

---

# 10. 후속 Cycle 예시 로드맵

다음은 고정 일정이 아니라 Cycle 생성 정책을 보여 주는 초기 후보군이다.
실제 순서는 이전 Cycle 결과와 위험 점수로 결정한다.

| Cycle | 플레이 가능한 목표 | 주 깊이 축 | 핵심 증가 |
|---|---|---|---|
| C01 | 배고픈 NPC와 플레이어가 열매 하나를 둘러싸고 획득·요청·양도·거절 | causalDepth | 전체 파이프라인의 실제 최소 관통 |
| C02 | 두 NPC와 플레이어가 희소 자원을 거래·요청·강탈하며 대응 | strategicDepth | 대안 전략, 충돌, 관계 기반 선택 |
| C03 | 소문과 잘못된 정보 때문에 주체들이 서로 다른 장소와 대상을 추적 | subjectDepth | 지각, 주장, 믿음, 정보 비대칭 |
| C04 | 치료사·마물·국가·신·밀수 조직의 요구가 하나의 국경 협곡을 생성 | worldDepth | 다중 요구 병합, 규칙·공간·역사 컴파일 |
| C05 | 반복된 결핍 경험으로 저장·거래·대체 에너지 전략이 전문화 | temporalDepth | 기억, 성장, 가능성 그래프 변화, 의존 대체 |
| C06 | 국가의 광산 개발이 마물 이동로와 신의 앵커를 변화시켜 사건 연쇄 발생 | subjectDepth/worldDepth | 복합 주체, 조직 명령, 생태·제도 충돌 |
| C07 | 두 플레이어가 같은 고유 자원과 사건에 동시에 개입하고 재접속 | onlineDepth | 권위, 관심 영역, 영속화, 동시성 |
| C08 | AI가 새 종·의존성·지역 후보를 만들고 자동 검증·축소 시뮬레이션 후 추가 | productionDepth | 후보 생성, 정적 검증, 자동 수정 |

중요한 것은 C08까지 기다려 AI 인터페이스를 만드는 것이 아니다.
C01에서 A의 얇은 계약과 검증 경로를 만들고, 이후 Cycle에서 생성 능력을 깊게 한다.
N, C, G도 같은 방식으로 처음부터 실제 파이프라인에 존재하되 점차 강해진다.

---

# 11. 기존 M0~M9의 사용 방식 변경

기존 M0~M9는 더 이상 “M0을 끝낸 뒤 M1 전체를 시작하는 단계”로만 사용하지 않는다.
Cycle이 획득한 검증 능력에 붙이는 **Milestone Tag**로 사용한다.

예:

```yaml
cycle: C01
milestones:
  - M0: "동일 시드 결정성"
  - M1: "실제 의존성을 가진 주체"
  - M2: "결핍에서 목적과 행동 생성의 최소형"
  - M3: "플레이어와 NPC의 자원 충돌 최소형"
  - M7: "작은 3D 지역에서 플레이 가능한 최소형"
```

후속 Cycle은 같은 Milestone을 더 높은 수준으로 재검증할 수 있다.

```text
C01의 M3: 플레이어와 NPC 한 명의 열매 소유권 충돌
C02의 M3: 세 주체의 거래·강탈·요청 충돌
C06의 M3: 국가·마물·신·조직의 장기 충돌
C07의 M3: 다중 플레이어 동시 개입 충돌
```

따라서 Milestone은 한 번 체크하고 버리는 완료 표시가 아니라 깊이가 쌓이는 검증 태그다.

---

# 12. 자동화해야 할 Cycle 운영 명령

명령 이름은 예시지만 다음 기능은 반드시 자동화한다.

```text
cycle:new C04
  → CYCLE.yaml, Step 템플릿, 시나리오 디렉터리 생성

cycle:lint C04
  → 모든 모듈 존재, Step 입력·출력, 미소비 출력, 순환 의존 검사

cycle:trace C04
  → 플레이 증거부터 공리까지 인과 경로 누락 검사

cycle:test C04
  → 이번 Cycle 단위·속성·통합 테스트

cycle:replay C04
  → 이번 Cycle 대표 분기 재생과 해시 검사

cycle:regression C04
  → 모든 이전 Cycle 리플레이 실행

cycle:play C04
  → 브라우저에서 검증 장면 실행

cycle:evidence C04
  → Step 및 Cycle 완료 증거 생성

cycle:freeze C04
  → VERIFIED 조건 검사 후 기준선 등록
```

`cycle:lint`는 다음을 오류로 처리한다.

- 모듈 Step 누락
- 입력 근거 없는 출력
- 다음 모듈에서 소비되지 않는 출력
- X의 하드코딩된 정식 세계 요소
- 사건 없는 상태 변경
- 플레이 증거 없는 Step
- 실패 시나리오 없는 CREATE/EXTEND Step
- 동일 시드 비결정성
- A 후보가 검증 없이 정식 세계에 등록되는 경로

---

# 13. AI Agent 작업 루프

AI Agent도 Cycle 전체를 한 번에 “완료”라고 선언하지 않는다.
다음 상태 기계로 작업한다.

```text
PLANNED
→ CONTRACTED
→ IMPLEMENTING
→ STEP_VERIFIED
→ MODULE_CONNECTED
→ CYCLE_INTEGRATED
→ PLAYABLE_VERIFIED
→ REGRESSION_VERIFIED
→ VERIFIED
```

실패 시 이동:

```text
Step 테스트 실패
→ 해당 Step IMPLEMENTING으로 복귀

모듈 연결 실패
→ 최초 계약 불일치 Step으로 복귀

Playable Gate 실패
→ 원인 추적 후 관련 Module Step으로 복귀

이전 Cycle 회귀 실패
→ 최초 상태 차이를 만든 Step으로 복귀
```

Agent가 각 Step에서 제출해야 하는 보고 형식:

```text
1. 이번 Step의 한 문장 목적
2. 구현한 타입·객체·함수
3. 읽고 쓰는 상태 경로
4. 발생시키는 이벤트
5. 정상·실패·경계 테스트 결과
6. Lab에서 확인하는 방법
7. 다음 모듈에 전달한 출력
8. 완료 증거 경로
9. 아직 남은 한계
```

장황한 개발 일지가 아니라 위 증거만 제출한다.

---

# 14. 전체 반복 알고리즘

```ts
while (!projectCompletionCriteriaMet()) {
  const baseline = loadLatestVerifiedCycle();
  const candidates = generateCycleCandidates({
    baseline,
    unverifiedDesignClaims: loadRiskLedger(),
    playtestFindings: loadPlaytestFindings(),
    moduleDepthLedger: loadCapabilityLedger()
  });

  const cycle = selectHighestValueBoundedCandidate(candidates);

  writePlayableCycleContract(cycle);
  const trace = deriveRequirementsBackwardFromPlayableScene(cycle);
  const steps = placeTraceIntoFixedModuleOrder(trace, [
    "V", "O", "S", "D", "P", "Q", "W",
    "R", "E", "G", "C", "X", "N", "A"
  ]);

  decomposeEveryStepToImplementationTasks(steps);
  implementAndVerifyForward(steps);
  integratePlayableScene(cycle);

  if (!passesPlayableGate(cycle)) {
    reviseFirstCausalFailure(cycle);
    continue;
  }

  if (!passesAllPreviousCycleRegressions(cycle)) {
    reviseFirstRegressionDifference(cycle);
    continue;
  }

  freezeAsVerifiedBaseline(cycle);
  updateCapabilityAndRiskLedgers(cycle);
}
```

---

# 15. 최종 운영 규칙

전체 프로젝트는 다음 규칙으로 진행한다.

```text
1. 먼저 다음에 구현할 기능을 고르지 않는다.
   다음에 플레이하여 검증할 게임 장면을 고른다.

2. 장면에서 필요한 원인을 O까지 역추적한다.

3. 역추적 결과를 기존 V→A 모듈 순서에 Module Step으로 배치한다.

4. 각 Module Step을 타입·객체·함수·상태·이벤트·테스트·Lab 수준으로 분해한다.

5. 구현은 V→A 순서로 진행하고 각 Step 및 Handoff Gate를 통과한다.

6. 모든 Cycle은 브라우저에서 하나의 직관적인 게임으로 끝난다.

7. 다음 Cycle은 같은 모듈 구조를 다시 통과하면서 한 가지 깊이 축을 확장한다.

8. 이전 Cycle은 삭제하지 않고 영구 회귀 시나리오로 유지한다.

9. 세계 요소·NPC 행동·사건 결과는 전체 인과 경로를 설명할 수 있어야 한다.

10. 이 반복을 통해 얇지만 완전한 게임이 점점 깊고 넓어져 최종 MMORPG가 된다.
```

최종 구조는 한 문장으로 요약된다.

> **플레이 가능한 하나의 장면을 Cycle 목표로 정의하고, 그 장면의 원인을 기존 모듈 파이프라인으로 역추적하여 Step을 만든 뒤, 정방향으로 구현·검증한다. 이후 같은 구조의 다음 Cycle에서 하나의 깊이 축을 확장하고 모든 이전 장면을 보존함으로써, 얇지만 완전한 게임을 점진적으로 완전한 MMORPG로 성장시킨다.**


