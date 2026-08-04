Design-ModulePlan.md
모듈 구현에 있어서 아래처럼 확장하고 싶다.
1.  Cycle를 두어 2차원 점진적으로 나아갈 필요가 있다. 왜냐하면 한번에 복잡한 컨텐츠를 구성하면 검증이 너무 어렵기 때문이다.
지금 모듈의 구조와 구현 순서는 유지하면서 Cycle 1로 전체 다 구현을 얇게 하는 것이다. 이후 Cycle 2, 3... 진행하면서 모듈 구조는 같지만 그 컨텐츠 깊이가 깊어지게 된다. 
하나의 Cycle는 반드시 직관적으로 설명 및 확인 가능한 게임 형태가 될 수 있는 목표를 가진다. 이후 계속 Cycle이 쌓이면서 완전한 mmorpg가 되어가는 형태가 된다.
2. 각 Cycle에 대하여 모듈 구조대로 Step별 세분화하여 구현 수준으로 분할하여 계획해야 한다.
예를 들어, 하나의 Cycle의 목표에 대해 "O0. 세계관 공리"라는 모듈 관점에서 어떤 공리를 어떤 함수 및 객체로 표현해서 구현해야 하는지 단계를 구현 수준으로 세분화되게 나눠야 한다.

곧, Cycle 분할 -> Step 분할 -> 각 Step 구현이 되는 것임. 큰 틀의 Cycle 생성 정책만 마련하고 계속 Cycle을 생성해서 앞으로 나아가야 한다.
위와 같이 진행하기 위해 어떻게 나아가야할지 전체 WORKFLOW를 작성해줘.

결론

기존 문서의 모듈 구조와 인과 순서는 그대로 유지해야 합니다.

V → O → S → D → P → Q → W → R → E → G → C → X → N → A

기존 문서가 정의한 주체 의존성에서 세계 요구·세계 실체화·사건·성장으로 이어지는 파이프라인은 바꾸지 않습니다. 바꾸는 것은 구현의 진행 방식입니다. 붙여넣은 마크다운(1).md

기존 방식이 다음과 같은 1차원 진행이었다면,

V를 깊게 구현
→ O를 깊게 구현
→ S를 깊게 구현
→ ...
→ 마지막에야 게임 형태로 통합

앞으로는 다음과 같은 2차원 점진 구현 방식으로 진행합니다.

                         고정된 모듈 순서
              V  O  S  D  P  Q  W  R  E  G  C  X  N  A
Cycle 1       ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■ → 얇지만 완전한 게임
Cycle 2       ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■ → 상호작용이 깊어진 게임
Cycle 3       ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■ → 세계와 시간이 깊어진 게임
Cycle 4       ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■ → 복합 MMORPG
...

핵심 구현 단위는 다음과 같습니다.

Cycle
  └─ Module Step
       └─ Implementation Task

* Cycle: 하나의 플레이 가능한 게임 장면
* Module Step: 해당 Cycle을 위해 O0, D4, W1 등의 모듈이 맡을 역할
* Implementation Task: 타입, 객체, 함수, 상태, 이벤트, 테스트, Lab 화면까지 분해된 코드 작업

⸻

1. 가장 중요한 진행 원칙

계획은 역방향, 구현은 정방향으로 진행한다

Cycle은 반드시 최종 플레이 장면부터 정의합니다.

플레이어가 무엇을 보고
→ 무엇을 선택하고
→ 세계가 어떻게 반응하고
→ 어떤 결과가 남는가?

이 장면을 실현하는 데 필요한 원인을 역방향으로 찾습니다.

플레이 장면
← X. 어떤 3D 공간과 UI가 필요한가?
← N. 누가 결과를 확정하고 저장하는가?
← C/G/E/R. 어떤 주체·충돌·성장·사건이 필요한가?
← W/Q. 어떤 세계 요소와 세계 요구가 필요한가?
← P/D/S. 어떤 가능성·의존성·주체가 필요한가?
← O. 어떤 공리와 규칙이 필요한가?
← V. 무엇을 증거로 완료를 판단할 것인가?

그러나 실제 구현은 기존 순서를 유지합니다.

V → O → S → D → P → Q → W → R → E → G → C → X → N → A

즉,

계획: 게임에서 공리 방향으로 역추적
구현: 공리에서 게임 방향으로 정방향 진행
검증: 모듈 내부 + 모듈 연결 + 최종 게임 장면

이 구조여야 내부 시스템만 잔뜩 만들고 실제 게임이 되지 않는 문제를 막을 수 있습니다.

⸻

2. 모든 Cycle은 반드시 게임이어야 한다

잘못된 Cycle 목표:

Cycle 2: 가능성 그래프와 충돌 해결기를 구현한다.

올바른 Cycle 목표:

플레이어와 두 NPC가 하나뿐인 치료 재료를 두고
거래·요청·강탈 중 서로 다른 전략을 선택하며,
플레이어가 개입하거나 방관한 결과에 따라
소유권·관계·후속 행동이 달라지는 장면을 플레이할 수 있다.

모든 Cycle은 최소한 다음 조건을 가져야 합니다.

1. 플레이어가 세계에서 직접 볼 수 있는 상황
2. 플레이어가 실제로 수행할 수 있는 행동
3. 플레이어가 아무것도 하지 않아도 진행되는 세계
4. 최소 두 가지 이상의 결과 분기
5. 결과가 소유권·관계·기억·자원·공간 등에 남는 구조
6. 결과의 원인을 인과 추적 화면으로 설명할 수 있는 구조
7. 동일 시드와 동일 입력으로 재생 가능한 구조

Cycle의 완료 단위는 함수나 모듈이 아니라 직관적으로 플레이 가능한 장면입니다.

⸻

3. 모든 모듈을 통과하되 매번 모두 새로 만들지는 않는다

각 Cycle은 V부터 A까지 전체 파이프라인을 통과합니다.

다만 각 모듈의 작업은 다음 중 하나로 분류합니다.

type StepMode =
  | "CREATE"   // 최초 구현
  | "EXTEND"   // 새로운 상태·전략·규칙 추가
  | "REFINE"   // 기존 의미와 알고리즘 정교화
  | "HARDEN"   // 성능·결정성·예외 처리 강화
  | "REUSE";   // 코드 변경 없이 이번 Cycle에서 통합 검증

SKIP은 사용하지 않습니다.

코드를 수정하지 않는 모듈도 이번 Cycle의 데이터를 실제로 받아 처리하고, 다음 모듈에 결과를 넘기며, 회귀 테스트를 통과해야 합니다.

예를 들어 Cycle 3에서 O0 공리가 바뀌지 않는다면,

C03-O0: REUSE

로 기록하고, Cycle 3에서 새로 추가된 생물·능력·세계 규칙이 기존 공리를 위반하지 않는지 다시 검증합니다.

⸻

4. 얇은 구현과 가짜 구현을 구분한다

Cycle 1은 얇아도 됩니다. 하지만 실제 파이프라인을 우회하면 안 됩니다.

허용되는 얇은 구현:

N: 실제 분산 서버 대신 단일 프로세스 권위 서버
A: 실제 LLM 생성 대신 구조화 스키마와 정적 검증기
W: 2km 지형 대신 30m × 30m 의미 공간 컴파일
C: 국가 대신 열매 군락 같은 최소 복합 주체
G: 거대한 성장 체계 대신 알려진 식량 위치 하나 해금

금지되는 우회 구현:

X가 W 출력을 쓰지 않고 열매 좌표를 하드코딩
NPC를 P/R 없이 스크립트로 이동
UI가 사건 없이 허기 상태를 직접 수정
클라이언트가 N을 거치지 않고 소유권 확정
A가 후보 검증 없이 정식 세계 상태를 직접 변경

Cycle 1의 각 모듈은 기능이 단순하더라도 실제 데이터를 처리하는 진짜 구현이어야 합니다.

⸻

5. 전체 Cycle WORKFLOW

Phase 0. Foundation 구축

반복 Cycle을 시작하기 전에 한 번만 수행합니다.

구현 대상:

V0 모듈 계약 레지스트리
V1 결정적 Tick, Random, ID, Stable Sort, State Hash
V2 시나리오 실행기
V3 브라우저 검증 Lab
V4 완료 증거 생성기
O~A 최소 인터페이스
Cycle/Step 스키마
리플레이 저장소

Foundation은 게임 Cycle로 계산하지 않습니다.

완료 조건:

빈 Cycle을 등록할 수 있다.
Module Step 의존성을 검사할 수 있다.
같은 입력으로 같은 상태 해시를 얻는다.
Lab에서 상태 전후와 이벤트를 볼 수 있다.
Step 완료 증거를 JSON으로 생성할 수 있다.

⸻

Phase 1. 이전 VERIFIED Cycle을 기준선으로 고정

다음 Cycle 시작 시 다음을 고정합니다.

baseline:
  cycle: C03
  sourceHash: "..."
  schemaVersion: 7
  replaySet:
    - C01-idle
    - C01-player-takes
    - C02-trade
    - C03-false-rumor

이 기준선이 있어야 새 Cycle이 무엇을 추가했고 무엇을 깨뜨렸는지 알 수 있습니다.

⸻

Phase 2. 다음 Cycle 후보 생성

후보는 임의 기능 목록이 아니라 이전 Cycle의 결과에서 생성합니다.

입력:

* 아직 검증하지 못한 핵심 설계 주장
* 이해하기 어려웠던 플레이 장면
* 가장 위험한 기술 가정
* 행동하지 않는 주체
* 막혀 있는 목적
* 상호작용이 없는 공간
* 반복되는 오류
* 깊이가 부족한 모듈

후보 우선순위는 다음 관점으로 평가합니다.

Cycle Priority =
(Player Value
 × Architectural Risk
 × Learning Value
 × Reuse Potential
 × Dependency Readiness)
÷ Scope Cost

다음 Cycle은 가장 기능이 많은 후보가 아니라, 작은 범위로 가장 중요한 불확실성을 검증할 수 있는 후보를 선택합니다.

⸻

Phase 3. Cycle 목표 계약 작성

Cycle은 다음 형식으로 정의합니다.

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

필수 항목:

플레이어 관점 목표
검증할 시스템 가설
초기 상태
플레이어 행동
자율 세계 행동
방관 결과
기본 개입 결과
대안 또는 실패 결과
완료 판정

⸻

Phase 4. 게임 장면에서 모듈 요구를 역추적

Cycle 목표로부터 다음 경로를 만듭니다.

플레이어에게 보이는 결과
← 사건
← 행동 의도
← 지각과 믿음
← 정식 세계 상태
← 세계 요구
← 가능성
← 의존성
← 주체
← 공리

모든 요소는 다음 질문에 답해야 합니다.

이 오브젝트는 왜 세계에 존재하는가?
이 NPC는 왜 이 행동을 하는가?
이 가능성은 어떤 결핍에서 나왔는가?
이 결과는 어떤 규칙과 충돌 해결로 결정되었는가?
플레이어는 무엇을 보고 상황을 이해하는가?
이 결과는 어디에 기록되어 다음 행동에 영향을 주는가?

그 답을 TRACE.graph.json으로 보존합니다.

⸻

Phase 5. 하나의 Cycle 행 생성

역추적 결과를 고정된 모듈 구조에 배치합니다.

C04-V  C04-O  C04-S  C04-D  C04-P  C04-Q  C04-W
C04-R  C04-E  C04-G  C04-C  C04-X  C04-N  C04-A

각 Module Step은 다음을 가져야 합니다.

이번 Cycle에서의 역할
CREATE/EXTEND/REFINE/HARDEN/REUSE
입력 계약
출력 계약
읽는 상태
쓰는 상태
발생시키는 이벤트
다음 모듈이 사용할 출력
플레이어가 확인할 증거
자동 검증 방법

출력은 반드시 다음 모듈 중 하나에서 실제로 사용되어야 합니다. 사용되지 않는 출력은 현재 Cycle의 과잉 구현입니다.

⸻

Phase 6. Module Step을 코드 수준으로 분해

각 Step은 다음 다섯 묶음으로 분해합니다.

1. 계약·스키마

입력 타입
출력 타입
오류 타입
상태 경로
이벤트 스키마
버전

2. 순수 로직

계산 함수
후보 생성 함수
검증 함수
선택 함수
설명 함수

3. 런타임 연결

상태 읽기
명령 제출
이벤트 생성
상태 전이
다음 모듈 출력 전달

4. 직관적 확인

Lab 입력
처리 과정
후보 목록
선택 결과
상태 전후 diff
실패 이유
인과 추적

5. 자동 검증

정상 테스트
실패 테스트
경계값 테스트
속성 테스트
모듈 연결 테스트
대표 리플레이
완료 증거

⸻

Phase 7. 기존 모듈 순서대로 구현

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

각 Step은 다음 조건을 만족해야 합니다.

입력·출력 스키마 등록
정상·실패·경계 테스트 통과
결정적 결과 확인
Lab 처리 과정 표시
출력 샘플 생성
완료 증거 생성

그리고 모듈 간에는 별도의 Handoff Gate를 둡니다.

실제 이전 모듈 출력이 다음 모듈 입력으로 사용됨
운영 경로에 테스트 하드코딩이 없음
미사용 출력 필드가 없음
오류가 다음 모듈에서 숨겨지지 않음
인과 추적 ID가 유지됨

⸻

Phase 8. 플레이 가능한 Cycle 조립

X 단계까지 기다렸다가 처음 통합하지 않습니다.

O/S/D/P
→ Lab 텍스트 장면
Q/W
→ 의미 공간 그래프
R/E
→ 헤드리스 시뮬레이션
G/C
→ 반복 실행과 장기 상태
X
→ 실제 3D 플레이
N
→ 권위·명령·저장 통합
A
→ 같은 스키마를 사용하는 후보 생성·검증

각 단계에서 불완전하더라도 장면은 계속 실행 가능해야 합니다.

⸻

Phase 9. Cycle Playable Gate

Cycle은 다음 여섯 관점에서 검증합니다.

이해 가능성

퀘스트 설명문이나 개발자 콘솔 없이 현재 상황을 이해할 수 있는가?

개입 가능성

플레이어의 행동이 실제 세계 상태와 NPC 행동을 바꾸는가?

자율 진행

플레이어가 아무것도 하지 않아도 NPC와 세계가 진행되는가?

결과 지속성

결과가 소유권·관계·기억·자원·공간 등에 남는가?

설명 가능성

결과에 대해 다음 경로를 볼 수 있는가?

공리
→ 주체
→ 의존성
→ 결핍
→ 가능성
→ 목적과 전략
→ 세계 요구
→ 세계 요소
→ 지각과 믿음
→ 행동 의도
→ 충돌
→ 사건
→ 성장

결정적 재생

같은 시드와 입력에서 같은 최종 상태 해시가 나오는가?

⸻

Phase 10. 이전 Cycle 전체 회귀 검증

현재 Cycle 테스트
→ 현재 Cycle 리플레이
→ 이전 모든 Cycle 리플레이
→ 저장·불러오기 리플레이
→ 브라우저 플레이 시나리오

Cycle 4가 완성되려면 C01~C04가 모두 통과해야 합니다.

의도적으로 결과가 변경되었다면 단순히 새로운 해시로 덮어쓰지 않고 변경 이유와 영향 상태 경로를 기록합니다.

⸻

Phase 11. Cycle 동결

검증이 끝나면 다음을 보존합니다.

CYCLE.yaml
TRACE.graph.json
STEP.yaml 목록
대표 시나리오
리플레이
최종 상태 해시
완료 증거
플레이 테스트 결과
알려진 한계
다음 Cycle 후보

상태는 다음과 같이 진행합니다.

PLANNED
→ CONTRACTED
→ IMPLEMENTING
→ STEP_VERIFIED
→ MODULE_CONNECTED
→ CYCLE_INTEGRATED
→ PLAYABLE_VERIFIED
→ REGRESSION_VERIFIED
→ VERIFIED

VERIFIED가 된 Cycle만 다음 Cycle의 기준선이 됩니다.

⸻

6. Cycle의 깊이 증가 정책

한 Cycle에서 모든 방향을 확장하면 다시 검증할 수 없는 크기가 됩니다.

따라서 다음 깊이 축 중 하나만 주축으로 선택합니다.

interface DepthVector {
  causalDepth: number;       // 인과관계 길이
  strategicDepth: number;    // 대안·대응·실패·반격
  subjectDepth: number;      // 기억·관계·믿음·개성
  worldDepth: number;        // 규칙·상태·공간·역사
  temporalDepth: number;     // 사건 연쇄·성장·장기 변화
  spatialDepth: number;      // 3D 공간·경로·현상
  onlineDepth: number;       // 권위·동기화·영속화
  productionDepth: number;   // AI 생성·검증·자동 수정
}

예를 들어 Cycle 2가 전략 깊이를 증가시키는 Cycle이라면,

추가:
거래
요청
강탈
거절 기억에 따른 전략 변경
추가하지 않음:
국가 전쟁
새 능력 체계
대륙 지형
대규모 멀티플레이

로 범위를 제한합니다.

⸻

7. Cycle 1의 권장 목표

작은 3D 협곡에 플레이어, 배고픈 채집자 NPC,
열매가 하나 남은 열매 군락이 존재한다.
플레이어가 아무것도 하지 않으면
NPC는 열매를 발견하고 이동하여 획득하고 먹는다.
플레이어가 먼저 열매를 가져가면
NPC는 플레이어가 열매를 가진다고 판단하고 양도를 요청한다.
플레이어가 주거나 거절하면
허기, 소유권, 관계, 기억, 다음 행동이 서로 다르게 변한다.
모든 결과는 의존성부터 사건까지 설명되고 저장된다.

이 작은 장면을 통해 전체 파이프라인을 얇게 관통합니다.

계층	Cycle 1의 최소 실제 구현
V	시나리오, 리플레이, 상태 해시, 완료 증거
O	에너지 필요, 자원 보존, 사건 없는 변경 금지 공리
S	인간 원형, 플레이어, 채집자
D	활동 에너지와 식량 의존성
P	관찰, 이동, 획득, 섭취, 요청, 양도, 거절
Q	식량, 접근 경로, 시각 현상, 소유권 규칙 요구
W	요구로부터 작은 협곡과 열매 군락 실체화
R	상태 저장, 사건, 지각, 믿음, 행동 의도
E	자원 획득, 요청, 양도, 거절, 소유권 충돌
G	알려진 식량 위치와 전략 가중치 변화
C	재고와 재생 규칙을 가진 열매 군락
X	이동·획득·요청 응답·인과 추적 UI
N	단일 프로세스 권위 서버와 저장·불러오기
A	구조화 콘텐츠 후보와 공리·근거 검증

⸻

8. O0 구현 분할 예

사용자가 말한 Cycle 1 / O0. 세계관 공리는 다음 정도까지 분해되어야 합니다.

C01-O0-S01 공리 메타데이터 스키마
C01-O0-S02 공리 레지스트리
C01-O0-S03 Cycle 1 공리 평가 함수
C01-O0-S04 정의 검증기와 상태 전이 가드
C01-O0-S05 공리 사용 인과 추적
C01-O0-S06 Lab 화면
C01-O0-S07 테스트와 완료 증거

핵심 타입:

interface AxiomSpec {
  id: string;
  description: string;
  phases: ("definition" | "world_compile" | "runtime_transition")[];
  severity: "error" | "warning";
  evaluatorId: string;
}
interface AxiomResult {
  axiomId: string;
  passed: boolean;
  violationCode?: string;
  message: string;
  statePaths: string[];
}

핵심 함수:

registerAxiom(spec: AxiomSpec): void
validateDefinition(
  candidate: DefinitionCandidate
): ValidationReport
validateWorldProposal(
  proposal: WorldProposal
): ValidationReport
validateTransition(
  transition: StateTransitionCandidate
): ValidationReport
findAxiomsForEvent(
  eventId: string
): AxiomTraceEntry[]

대표 실패 검증:

열매를 먹어 에너지가 증가했지만 열매 재고가 줄지 않음
→ 자원 보존 공리 위반
World Store의 신뢰 수치를 사건 없이 직접 변경
→ 사건 기반 상태 변경 공리 위반
플레이어가 이미 관찰한 열매 위치를 조용히 이동
→ 관찰된 세계 소급 변경 금지 공리 위반

이 수준으로 D4, P4, W1 등의 Step도 타입·함수·상태·이벤트·테스트·Lab까지 분해합니다.

⸻

9. 초기 후속 Cycle 후보

이 목록은 고정 일정이 아니라 Cycle 생성 정책의 예시입니다.

Cycle	플레이 가능한 목표	주 깊이 축
C01	플레이어와 배고픈 NPC가 열매를 획득·요청·양도·거절	전체 인과 최소 관통
C02	두 NPC와 플레이어가 희소 자원을 거래·요청·강탈	전략 깊이
C03	소문과 거짓 정보로 주체들이 다른 대상을 추적	믿음·정보 깊이
C04	치료사·마물·국가·신·밀수 조직의 요구로 국경 협곡 생성	세계 깊이
C05	반복된 결핍으로 저장·거래·대체 전략이 전문화	시간·성장 깊이
C06	국가 개발이 마물 이동로와 신의 앵커를 변화시킴	복합 주체 깊이
C07	두 플레이어가 같은 사건과 고유 자원에 동시 개입	온라인 깊이
C08	AI가 종·의존성·지역 후보를 생성하고 자동 수정	제작 자동화 깊이

중요한 점은 N과 A를 C07, C08에서 처음 만드는 것이 아닙니다.

C01: N의 최소 권위 인터페이스
C02~C06: 권위와 저장의 의미 강화
C07: 실제 다중 플레이어 동시성
C01: A의 구조화 스키마와 검증
C02~C07: 검증 범위와 후보 종류 확장
C08: 실제 AI 후보 생성과 자동 수정

모든 계층이 Cycle 1부터 존재하고, Cycle이 쌓일수록 깊어지는 구조입니다.

⸻

10. 최종 반복 알고리즘

while (!projectCompletionCriteriaMet()) {
  const baseline = loadLatestVerifiedCycle();
  const candidates = generateCycleCandidates({
    baseline,
    risks: loadUnverifiedDesignClaims(),
    playtestFindings: loadPlaytestFindings(),
    capabilityLedger: loadModuleCapabilityLedger()
  });
  const cycle = selectHighestValueBoundedCandidate(candidates);
  writePlayableCycleContract(cycle);
  const trace =
    deriveRequirementsBackwardFromPlayableScene(cycle);
  const steps =
    placeTraceIntoFixedModuleOrder(trace, [
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

최종적으로는 다음 한 문장으로 정리할 수 있습니다.

플레이 가능한 하나의 장면을 Cycle 목표로 정의하고, 그 장면의 원인을 기존 모듈 파이프라인으로 역추적하여 Step을 만든 뒤, 정방향으로 구현·검증한다. 이후 같은 구조의 다음 Cycle에서 하나의 깊이 축을 확장하고 모든 이전 장면을 회귀 검증으로 보존함으로써, 얇지만 완전한 게임을 점진적으로 완전한 MMORPG로 성장시킨다.

전체 Workflow, Cycle/Step 스키마, 디렉터리 구조, Cycle 1 전체 모듈 계획, O0 상세 구현 예시, AI Agent 상태 기계까지 포함한 마크다운 파일입니다.

Design-ModulePlan-CycleWorkflow.md 다운로드⁠￼