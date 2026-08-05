# Design-ModulePlan — MMORPG Cycle 기반 2차원 점진 구현 WORKFLOW

## 0. 문서 목적

이 문서는 기존 Design-ModulePlan의 모듈 구조와 인과 순서를 유지하면서, 전체 시스템을 Cycle 단위로 반복 구현하여 점진적으로 완전한 MMORPG로 성장시키는 방법을 정의한다.

고정된 모듈 순서는 다음과 같다.

```text
V → O → S → D → P → Q → W → R → E → G → C → X → N → A
```

이 순서는 바꾸지 않는다.

| 모듈 | 역할 |
|---|---|
| V | 검증 기반 |
| O | 세계관 공리와 존재론 |
| S | 주체 원형 |
| D | 의존 그래프 |
| P | 가능성 그래프 |
| Q | 세계 요구 |
| W | 세계 컴파일 |
| R | 세계 런타임 |
| E | 사건과 상호작용 |
| G | 성장과 의존 변형 |
| C | 복합 주체 |
| X | 3D 공간과 웹 클라이언트 |
| N | 멀티플레이 서버와 영속화 |
| A | AI 제작 자동화 |

기존처럼 앞 모듈을 완전하게 만든 뒤 다음 모듈로 넘어가는 1차원 방식만 사용하면, 실제 플레이 가능한 결과가 너무 늦게 나오고 복합 콘텐츠를 한 번에 검증하기 어렵다.

따라서 다음과 같은 2차원 점진 구현 방식을 사용한다.

```text
                               고정 모듈 순서
                 V  O  S  D  P  Q  W  R  E  G  C  X  N  A
Cycle 1          ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  → 작은 MMORPG 지역
Cycle 2          ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  → 경제·조직이 깊어진 지역
Cycle 3          ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  → 능력·캐릭터가 깊어진 지역
Cycle 4          ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  ■  → 정치·영토가 깊어진 세계
Cycle 5 ...
```

- **가로축**: 주체의 존재에서 세계·사건·성장으로 이어지는 고정 인과 파이프라인
- **세로축**: MMORPG의 세계·경제·사회·성장·멀티플레이·시간적 깊이 증가

핵심 원칙은 다음과 같다.

- Cycle은 하나의 기능이나 짧은 테스트 장면이 아니다. Cycle은 제한된 지역 안에서 탐험·전투·채집·제작·거래·사회·성장·멀티플레이·영속 세계 변화가 서로 연결된 하나의 소형 MMORPG다.
- 작은 단위의 검증은 Cycle 자체를 축소해서 해결하지 않는다. Cycle 아래에 Situation과 Scenario를 두어 복잡한 MMORPG를 작고 명확한 검증 장면으로 분해한다.

---

## 1. 개발 단위 계층

전체 개발 단위는 다음과 같이 구분한다.

```text
Cycle
  ├─ MMORPG Gameplay Loop
  │    └─ Situation
  │          └─ Scenario
  └─ Module Step
         └─ Implementation Task
```

### 1.1 Cycle

하나의 제한된 지역에서 MMORPG의 핵심 루프가 실제로 연결되어 동작하는 플레이 가능한 세계 단위다.

Cycle은 다음 질문에 답해야 한다.

- 플레이어는 어떤 세계에 들어가는가?
- 그 안에서 어떤 역할을 선택할 수 있는가?
- 무엇을 반복해서 플레이하는가?
- 다른 플레이어 및 주체와 어떻게 협력·경쟁하는가?
- 어떻게 성장하는가?
- 세계는 플레이어가 없어도 어떻게 변하는가?
- 행동 결과는 다음 접속과 다음 Cycle에 무엇을 남기는가?

### 1.2 MMORPG Gameplay Loop

Cycle 안에서 반복 가능한 실제 플레이 흐름이다.

예:

```text
탐험 → 정보 획득 → 목표 선택 → 준비
→ 전투·거래·제작·협상 → 보상·손실
→ 성장 → 지역 상태 변화 → 새로운 기회 발견
```

한 번 실행되고 끝나는 고정 퀘스트가 아니라, 세계 상태와 주체의 목적에 따라 반복될 때 다른 상황이 발생해야 한다.

### 1.3 Situation

여러 주체의 목적과 의존성이 같은 공간·자원·인물·규칙에 연결되어 형성된 현재의 갈등 또는 기회 상태다.

예:

- 국가가 국경석을 이동했다.
- 국경 신의 영역이 약해졌다.
- 마물 이동로가 붕괴했다.
- 마을과 광산 방향으로 마물 이동 압력이 증가했다.
- 치료사·상인·국가·밀수 조직이 서로 다른 해결을 원한다.

Situation은 퀘스트 데이터가 아니라 현재 세계 상태에서 계산되는 압력 구조다.

### 1.4 Scenario

Situation의 특정 초기 상태와 입력을 고정하여 자동 또는 수동으로 재현하는 검증 장면이다.

예:

```text
SC-C01-E3-01:
플레이어 두 명과 국가 운송대가 동시에 하나의 마물 기관 소유권을 주장한다.
권위 서버가 소유권·계약·전투 결과를 한 번만 확정하는지 검증한다.
```

`배고픈 인간과 음식 하나`, `두 주체가 같은 자원을 획득`, `거절 기억이 다음 전략에 반영` 같은 작은 장면은 Cycle이 아니라 Scenario다.

### 1.5 Module Step

해당 Cycle의 MMORPG를 성립시키기 위해 기존 모듈이 맡는 구체적인 책임이다.

예:

```text
C01-D4:
국가·마물·마을·치료사·상인의 의존 압력을 계산하고,
현재 지역에서 어떤 목적이 활성화되는지 P 계층에 전달한다.
```

### 1.6 Implementation Task

Module Step을 실제 코드 작업으로 분할한 단위다.

- 타입
- 객체
- 함수
- 상태 읽기·쓰기
- 이벤트
- UI
- 테스트
- Lab 패널
- 완료 증거

---

## 2. Cycle은 무엇이어야 하는가

### 2.1 Cycle은 작은 MMORPG 세계다

Cycle 1이 작다는 것은 다음을 의미한다.

- 지역 수가 적다.
- 세력 수가 적다.
- 자원과 제작식 수가 적다.
- 능력과 성장 경로 수가 적다.
- 동시에 활성화되는 Situation 수가 적다.
- 서버 규모와 동시 접속자 수가 작다.

다음 요소를 제거해도 된다는 뜻은 **아니다**.

- 탐험이 없다.
- 전투가 없다.
- 경제가 없다.
- 제작이 없다.
- 사회적 관계가 없다.
- 성장이 없다.
- 멀티플레이 의미가 없다.
- 세계가 저장되지 않는다.
- 플레이어가 없으면 세계가 멈춘다.
- 한 번 보면 끝나는 스크립트 장면만 있다.

Cycle 1부터 작지만 MMORPG라고 부를 수 있는 구조가 존재해야 한다.

### 2.2 Cycle은 시스템 데모가 아니다

잘못된 Cycle 목표:

```text
Cycle 1: 의존 그래프와 가능성 그래프를 연결한다.
Cycle 2: 거래와 충돌 해결기를 구현한다.
Cycle 3: 믿음 그래프를 구현한다.
```

올바른 Cycle 목표:

```text
Cycle 1: 국경 협곡 개척지

플레이어들은 국가·마을·치료사·밀수 조직·거대 마물·국경 신이
서로 다른 목적을 추구하는 국경 협곡을 탐험한다.
플레이어는 사냥·탐험·제작·거래·호위·밀수·협상·의례 중
자신의 역할을 선택하고 다른 플레이어와 협력하거나 경쟁한다.
국경석·광산·마물 이동로·시장·세력 관계가 행동 결과에 따라 변하고,
그 변화가 저장되어 이후 플레이와 새로운 Situation을 만든다.
```

내부 모듈은 이 목표를 성립시키는 원인이다. 모듈 자체가 Cycle의 전면 목표가 되어서는 안 된다.

### 2.3 Cycle 완료는 한 장면 완료가 아니다

Cycle 완료는 다음 상태를 의미한다.

- 하나의 지역을 탐험할 수 있다.
- 여러 역할과 반복 가능한 루프가 있다.
- 복수의 주체와 세력이 자율적으로 행동한다.
- 경제와 자원이 순환한다.
- 플레이어가 협력하거나 경쟁할 수 있다.
- 성장이 다음 가능성을 연다.
- 세계 상태가 지속된다.
- 플레이어 행동이 다음 Situation을 바꾼다.

짧은 대표 장면은 Cycle 전체를 검증하기 위한 Scenario일 뿐이다.

---

## 3. MMORPG Cycle의 필수 구성 요소

모든 Cycle은 아래 요소를 가져야 한다. Cycle 1에서는 각각의 폭과 깊이를 최소화할 수 있지만 제거할 수는 없다.

### 3.1 플레이어 판타지

플레이어가 이 Cycle에서 어떤 존재가 되는지 명확해야 한다.

예:

- 미지의 국경을 개척하는 탐험가
- 거대 마물을 추적하는 사냥꾼
- 희귀 재료를 연구하는 치료사·제작자
- 위험한 교역로를 운영하는 상인·운송자
- 국가와 범죄 조직 사이에서 거래하는 중개자
- 신의 규칙과 의례를 조사하는 의념 연구자

기능 목록이 아니라 플레이어가 되고 싶은 역할로 설명할 수 있어야 한다.

### 3.2 탐험 가능한 의미 공간

공간은 테스트 맵이 아니라 서로 다른 활동과 위험이 연결된 지역이어야 한다.

예:

- 국경 마을
- 국가 초소
- 광산
- 마물 이동 협곡
- 국경 신의 제단
- 밀수 동굴
- 치료 재료 습지
- 전망대
- 운송로
- 숨겨진 우회로

각 장소는 최소 하나 이상의 Gameplay Loop, 주체 의존성, 세계 역사와 연결되어야 한다.

### 3.3 살아 있는 주체·세력·생태

서로 다른 목적과 의존성을 가진 복수의 주체가 있어야 한다.

| 주체 | 목적과 의존성 |
|---|---|
| 국가 | 광맥 확보, 국경 통제, 정당성 유지 |
| 마을 | 안전, 식량, 교역, 치료 |
| 치료사 집단 | 약초와 마물 기관, 환자 보호, 지식 유지 |
| 밀수 조직 | 은폐 통로, 거래 상대, 단속 회피 |
| 거대 마물 | 이동로, 먹이, 번식지, 기관 회복 |
| 국경 신 | 국경석, 의례, 숭배, 영역 안정 |

이들은 플레이어가 접근해야만 활성화되는 콘텐츠가 아니다. 플레이어가 없어도 목적을 선택하고 행동하며 서로의 상태를 바꾼다.

### 3.4 복수의 플레이 방식

같은 지역 갈등에 대해 여러 역할과 해결 방식이 있어야 한다.

- 탐험과 조사
- 전투와 사냥
- 채집과 운송
- 제작과 연구
- 거래와 시장 활동
- 고용과 계약
- 협상과 기만
- 밀수와 단속
- 의례와 능력 사용
- 구조와 호위

모든 플레이어가 같은 전투 목표를 따라가는 구조는 MMORPG Cycle 완료로 인정하지 않는다.

### 3.5 반복 가능한 경제와 자원 순환

자원은 한 번 획득하고 끝나는 퀘스트 아이템이 아니다.

```text
광산에서 광물 생산
→ 국가·상인·제작자의 수요 발생
→ 운송로와 노동력 필요
→ 마물 이동으로 운송 위험 증가
→ 호위 비용과 장비 가격 상승
→ 밀수 수익 증가
→ 국가 단속 강화
→ 새로운 계약·충돌·우회로 발생
```

최소 Cycle에서도 생산, 소비, 운송, 소유권, 가격 또는 교환 가치 중 일부가 실제 상태로 연결되어야 한다.

### 3.6 성장과 가능성 확장

성장은 단순 경험치 증가만이 아니다.

- 전투 숙련
- 제작법 획득
- 지역 지식 획득
- 새로운 이동 경로 발견
- 세력 신뢰와 접근 권한 획득
- 거래 권한과 계약 등급 획득
- 능력의 조건과 대응법 발견
- 의존 대상 대체
- 가능성 그래프의 신규 노드 해금

성장 결과가 다음 플레이 방식과 세계 요구를 실제로 바꿔야 한다.

### 3.7 다중 플레이어 상호작용

Cycle 1부터 얇더라도 실제 멀티플레이 의미가 있어야 한다.

- 한 플레이어가 발견한 정보를 다른 플레이어에게 판매한다.
- 한 집단이 마물을 추적하는 동안 다른 집단이 광산을 약탈하거나 방어한다.
- 플레이어가 체결한 운송 계약이 지역 가격과 공급에 영향을 준다.
- 여러 플레이어가 같은 고유 자원이나 권한을 두고 경쟁한다.
- 플레이어들이 공동으로 사냥·의례·호위를 수행한다.

최소 서버 규모는 작아도 되지만 다음은 실제로 구현한다.

- 권위 서버
- 공유 소유권
- 동시 행동 충돌
- 공유 사건
- 플레이어 간 거래 또는 협력
- 저장과 재접속

### 3.8 지속되는 세계 변화

결과가 세션 종료와 함께 초기화되어서는 안 된다.

- 국경석 위치
- 광산 생산량
- 마물 이동 경로
- 마을 식량과 부상자 수
- 시장 재고와 교환 가치
- 세력 관계와 정당성
- 신의 안정도
- 운송로 안전도
- 알려진 정보와 소문
- 플레이어 평판과 약속

이 상태는 다음 접속, 다음 Situation, 다음 Cycle의 입력이 된다.

### 3.9 세계 내 직관적 전달

플레이어는 개발자용 그래프를 읽지 않고도 상황을 추론할 수 있어야 한다.

- 공간 변화
- 흔적
- 소리와 이펙트
- NPC 행동
- 대화와 소문
- 시장 가격
- 실종과 부상
- 순찰 변화
- 게시판·보고서·계약
- 신의 영역 변화

정확한 내부 인과 추적은 개발자 Lab에 제공하되, 플레이어에게는 세계 현상으로 전달한다.

---

## 4. 얇은 구현과 우회 구현의 구분

### 4.1 허용되는 얇은 구현

Cycle 1은 모든 시스템의 범위를 제한할 수 있다.

- 하나의 2km × 2km 지역
- 주요 세력 4~6개
- 핵심 자원 4~6종
- 제작식 3~5개
- 능력 계열 1개와 개별 능력 소수
- 동시 플레이어 소수
- 단일 프로세스 권위 서버
- 한 종류의 시장과 계약
- 압축된 낮·밤 또는 사건 시간
- 구조화 AI 후보와 정적 검증

### 4.2 금지되는 우회 구현

다음은 얇은 구현이 아니라 파이프라인 위반이다.

- X가 W 출력 없이 지역 요소 좌표를 하드코딩한다.
- NPC가 D/P/R 없이 고정 스크립트로 행동한다.
- 퀘스트 플래그가 세계 상태를 직접 변경한다.
- 조직이 실제 구성원·자산 없이 추상 수치만으로 행동한다.
- 클라이언트가 N을 거치지 않고 소유권·전투·거래를 확정한다.
- 사건 없이 관계·재고·가격·영역 상태를 직접 수정한다.
- 플레이어 요구 때문에 관찰된 세계가 조용히 소급 변경된다.
- AI가 검증 없이 정식 세계 상태를 직접 생성한다.
- 전투·제작·경제가 서로 분리된 미니게임으로 존재하고 같은 세계 상태를 사용하지 않는다.

---

## 5. 세계 구성과 세계 실행의 분리

Cycle 방식에서도 기존의 두 파이프라인 분리는 유지한다.

### 5.1 세계 구성 파이프라인

아직 관찰되지 않은 지역이나 요소를 정식 세계로 만들 때 실행한다.

```text
세계관 공리
→ 주체 원형
→ 의존 그래프
→ 가능성 문법
→ 세계 요구
→ 다중 주체 요구 병합
→ 규칙·상태·공간 실체화
→ 압축 역사
→ 정식 세계 등록
```

### 5.2 세계 실행 파이프라인

이미 정식화된 세계 안에서 실행한다.

```text
세계 사건
→ 현상
→ 지각
→ 믿음
→ 의존 상태 평가
→ 목적 활성화
→ 행동 의도
→ 충돌 해결
→ 사건 기록
→ 기억·관계·성장·의존 변화
```

### 5.3 Cycle과 두 파이프라인의 관계

Cycle은 두 파이프라인을 모두 포함한다.

- **O~W**: 해당 Cycle 지역이 왜 존재하고 어떤 조건으로 구성되는가?
- **R~C**: 구성된 세계가 플레이어 유무와 관계없이 어떻게 움직이는가?
- **X~N**: 그 세계를 플레이어들이 어떻게 공유하고 개입하는가?
- **A**: 다음 Cycle과 신규 콘텐츠를 같은 규칙으로 어떻게 확장하는가?
- **V**: 모든 과정이 실제로 검증되었음을 어떻게 증명하는가?

---

## 6. 계획은 역방향, 구현은 정방향

### 6.1 계획은 MMORPG 경험에서 역방향으로 한다

Cycle 계획은 플레이어 경험과 지역 상태에서 시작한다.

```text
플레이어 판타지와 반복 루프
← 어떤 지역과 세계 변화가 필요한가?
← 어떤 Situation과 역할 충돌이 필요한가?
← 어떤 경제·성장·멀티플레이 상태가 필요한가?
← 어떤 사건·행동·지각·믿음이 필요한가?
← 어떤 세계 요소·규칙·역사가 필요한가?
← 어떤 주체의 가능성과 의존성이 그것을 요구하는가?
← 어떤 공리와 존재론이 그것을 허용하고 제한하는가?
← 무엇을 증거로 완료를 판단할 것인가?
```

역추적 결과는 `TRACE.graph.json`에 보존한다.

### 6.2 구현은 V→A 정방향으로 한다

계획이 완료되면 실제 구현은 기존 모듈 순서대로 진행한다.

```text
V → O → S → D → P → Q → W → R → E → G → C → X → N → A
```

앞 단계의 실제 출력이 다음 단계 입력으로 사용되지 않으면 완료가 아니다.

### 6.3 검증은 세 수준으로 한다

- **Implementation Task 검증**: 함수·타입·불변식·오류
- **Scenario 검증**: 작은 상태와 입력으로 특정 인과와 충돌 재현
- **Cycle 검증**: 전체 지역에서 MMORPG 루프·멀티플레이·성장·영속 변화 확인

이 구조로 복잡한 게임을 작게 검증하되, 최종 결과가 장난감 시뮬레이션으로 축소되는 것을 막는다.

---

## 7. Cycle의 깊이 증가 정책

모든 Cycle은 동일한 모듈 구조를 다시 통과하지만, 한 번에 모든 방향을 깊게 하지 않는다.

```ts
interface DepthVector {
  causalDepth: number;       // 의존성부터 세계 변화까지의 인과 길이
  strategicDepth: number;    // 대안·대응·실패·반격의 폭
  subjectDepth: number;      // 기억·관계·믿음·가치관·개성
  worldDepth: number;        // 규칙·상태·공간·역사·지역 연계
  economicDepth: number;     // 생산·소비·운송·가격·조직 재정
  progressionDepth: number;  // 숙련·지식·능력·의존 변형
  temporalDepth: number;     // 사건 연쇄·장기 변화·세대·역사
  socialDepth: number;       // 계약·평판·파벌·정치·법률
  spatialDepth: number;      // 의미 공간·3D 지형·경로·현상
  onlineDepth: number;       // 권위·동시성·관심 영역·영속화
  productionDepth: number;   // AI 생성·검증·자동 수정
}
```

각 Cycle은 다음을 지정한다.

- **주 깊이 축**: 반드시 1개
- **보조 깊이 축**: 최대 2개
- **유지 축**: 이전 Cycle 수준을 회귀 검증
- **비범위**: 이번 Cycle에서 의도적으로 깊게 만들지 않는 영역

Cycle 1은 모든 MMORPG 축의 최소 연결을 만든다. Cycle 2부터 특정 축을 깊게 만든다.

---

## 8. Module Step 작업 모드

모든 Cycle은 V부터 A까지 통과한다. 그러나 모든 모듈에 매번 같은 양의 신규 코드를 작성하지는 않는다.

```ts
type StepMode =
  | "CREATE"   // 최초 구현
  | "EXTEND"   // 새 상태·전략·콘텐츠·루프 추가
  | "REFINE"   // 의미나 알고리즘 정교화
  | "HARDEN"   // 성능·결정성·동시성·오류 처리 강화
  | "REUSE";   // 코드 변경 없이 새 Cycle 데이터로 통합·회귀 검증
```

`SKIP`은 사용하지 않는다.

REUSE인 모듈도 다음을 증명해야 한다.

- 이번 Cycle의 실제 입력을 처리한다.
- 출력을 다음 모듈에 전달한다.
- 기존 공리와 계약을 위반하지 않는다.
- 이전 Cycle 회귀 시나리오를 통과한다.

---

## 9. 전체 Cycle 생성 및 구현 WORKFLOW

### Phase 0. Foundation 구축

Foundation은 반복 Cycle 전에 한 번 구축한다. 게임 Cycle로 계산하지 않는다.

구현 대상:

- V0 모듈 계약 레지스트리
- V1 결정적 Tick, Seeded Random, Deterministic ID, Stable Sort, State Hash
- V2 Scenario Runner
- V3 브라우저 검증 Lab
- V4 완료 증거 생성기
- O~A 최소 인터페이스
- Cycle/Situation/Scenario/Step 스키마
- 이벤트 로그와 리플레이 저장소
- 단일 프로세스 권위 서버 껍질
- 3D 게임 앱과 Lab 앱의 공통 상태 연결

완료 조건:

- Cycle 문서를 등록할 수 있다.
- Situation과 Scenario를 Cycle에 연결할 수 있다.
- Module Step 의존성을 검사할 수 있다.
- 같은 시드와 입력으로 같은 상태 해시를 얻는다.
- Lab에서 상태 전후·이벤트·인과 경로를 볼 수 있다.
- 게임 클라이언트가 권위 서버를 통해 명령을 제출한다.
- 완료 증거 파일을 생성할 수 있다.

### Phase 1. 이전 VERIFIED Cycle 기준선 고정

다음 Cycle 시작 전에 최신 VERIFIED Cycle을 고정한다.

```yaml
baseline:
  cycle: C02
  sourceHash: "..."
  schemaVersion: 8
  worldSnapshotVersion: 4
  replaySet:
    - C01-borderstone-idle
    - C01-monster-hunt
    - C01-route-repair
    - C01-smuggling-contract
    - C02-market-shock
```

기준선에는 다음을 포함한다.

- 코드 버전
- 상태·이벤트 스키마
- 대표 월드 스냅샷
- 모든 이전 Scenario 리플레이
- Cycle Playtest 결과
- 알려진 한계
- 검증된 모듈 능력 원장
- 아직 검증되지 않은 설계 위험 원장

### Phase 2. 다음 Cycle 후보 생성

후보는 임의 기능 목록에서 만들지 않는다.

입력:

- 이전 Cycle에서 반복 플레이가 약했던 루프
- 플레이어 역할 간 차이가 부족했던 부분
- 행동하지 않는 주체 또는 막힌 목적
- 경제·생태·사회 상태가 연결되지 않은 부분
- 플레이어가 이해하지 못한 세계 변화
- 멀티플레이 협력·경쟁이 발생하지 않은 부분
- 장기 성장과 영속 변화가 부족한 부분
- 가장 위험한 기술·설계 가정
- AI가 생성하기 어려운 콘텐츠 구조

후보 평가:

```text
Cycle Priority =
(Player Fantasy Value
 × MMORPG Loop Value
 × Architectural Risk
 × Learning Value
 × Reuse Potential
 × Dependency Readiness)
÷ Scope Cost
```

Cycle 후보는 기능이 많아서가 아니라, 기존 작은 MMORPG를 가장 의미 있게 깊게 만드는가로 선택한다.

### Phase 3. Cycle MMORPG 계약 작성

Cycle 계약은 다음 구조를 가진다.

```ts
interface CycleSpec {
  id: string;
  title: string;
  baselineCycleId: string;
  playerFantasy: string;
  worldPromise: string;
  regionScope: RegionScopeSpec;
  primaryDepthAxis: keyof DepthVector;
  secondaryDepthAxes: (keyof DepthVector)[];
  outOfScope: string[];
  coreGameplayLoops: GameplayLoopSpec[];
  playerRoles: PlayerRoleSpec[];
  subjectsAndFactions: SubjectScopeSpec[];
  resourceEconomy: EconomyScopeSpec;
  progression: ProgressionScopeSpec;
  multiplayer: MultiplayerScopeSpec;
  persistence: PersistenceScopeSpec;
  situations: SituationSpec[];
  scenarios: ScenarioRef[];
  moduleSteps: ModuleStepRef[];
  acceptance: CycleAcceptanceSpec;
}
```

필수 계약 항목:

| 항목 | 내용 |
|---|---|
| 플레이어 판타지 | 플레이어는 이 Cycle에서 어떤 존재가 되는가? |
| 세계 약속 | 어떤 종류의 미지·갈등·성장·상호작용을 경험하는가? |
| 지역 범위 | 장소, 이동 경로, 위험 구역, 생산 지점, 사회 공간 |
| 핵심 Gameplay Loop | 어떤 반복 행동이 세계 상태와 성장에 연결되는가? |
| 플레이어 역할 | 전투·탐험·제작·경제·사회 역할이 어떻게 다르고 연결되는가? |
| 경제 | 무엇이 생산·소비·운송·거래되며 부족과 과잉이 무엇을 바꾸는가? |
| 성장 | 플레이 전후에 어떤 가능성과 접근 권한이 달라지는가? |
| 멀티플레이 | 어떤 행동에서 협력·경쟁·거래·충돌이 실제로 발생하는가? |
| 영속성 | 어떤 상태가 저장되고 다음 플레이를 바꾸는가? |
| Situation | 어떤 주체 목적 충돌이 반복 가능한 콘텐츠를 발생시키는가? |

### Phase 4. MMORPG Loop 설계

Cycle의 중심은 Situation 하나가 아니라 서로 연결된 반복 루프다.

각 루프는 다음 형식으로 작성한다.

```ts
interface GameplayLoopSpec {
  id: string;
  playerIntent: string;
  entrySignals: string[];
  actions: string[];
  requiredRoles: string[];
  worldInputs: string[];
  worldOutputs: string[];
  progressionOutputs: string[];
  economyEffects: string[];
  multiplayerInteractions: string[];
  repeatVariationSources: string[];
}
```

반드시 검증할 질문:

- 플레이어가 왜 이 루프를 시작하는가?
- 세계에서 무엇을 보고 기회를 발견하는가?
- 반복할 때 무엇이 달라지는가?
- 다른 플레이어가 있으면 어떤 선택이 추가되는가?
- 결과가 경제·관계·생태·성장 중 무엇을 바꾸는가?
- 바뀐 상태가 다음 루프의 입력이 되는가?

### Phase 5. Situation 생성

Gameplay Loop를 발생시키는 지역 압력 구조를 정의한다.

```ts
interface SituationSpec {
  id: string;
  title: string;
  regionStatePredicates: PredicateSpec[];
  involvedSubjects: string[];
  dependencyPressures: string[];
  contestedResources: string[];
  activeRules: string[];
  observableSignals: string[];
  autonomousEscalation: EscalationSpec[];
  playerInterventionFamilies: string[];
  persistentOutcomes: string[];
}
```

Situation은 다음 특성을 가진다.

- 플레이어가 없어도 진행된다.
- 하나 이상의 주체 의존 압력에서 발생한다.
- 여러 해결 방식이 존재한다.
- 결과가 다음 Situation의 조건을 만든다.
- 단일 NPC가 미리 작성한 퀘스트를 배포하는 구조가 아니다.

### Phase 6. Scenario로 검증 분해

각 Situation을 작은 Scenario로 분해한다.

Scenario는 다음 종류를 포함한다.

| 종류 | 검증 질문 |
|---|---|
| 인과 Scenario | 의존 결핍이 목적과 행동으로 연결되는가? |
| 공간 Scenario | 실제 경로·가시성·위험 지형이 행동 선택을 바꾸는가? |
| 경제 Scenario | 생산·소비·운송 변화가 재고와 교환 가치에 반영되는가? |
| 사회 Scenario | 관계·평판·계약·기만이 다음 행동에 반영되는가? |
| 충돌 Scenario | 동시에 같은 자원·공간·대상을 변경하려 할 때 결과가 한 번만 결정되는가? |
| 멀티플레이 Scenario | 협력·경쟁·거래·배신이 공유 세계 상태를 바꾸는가? |
| 영속 Scenario | 저장·재접속 후 사건 결과와 장기 상태가 유지되는가? |
| 회귀 Scenario | 이전 Cycle의 대표 플레이가 계속 성립하는가? |

이 단계가 복잡도를 통제하는 핵심이다. Cycle은 MMORPG 규모를 유지하고, 검증은 Scenario 단위로 작게 분할한다.

### Phase 7. 플레이 경험에서 모듈 요구 역추적

Cycle의 플레이 경험과 각 Situation을 기존 모듈로 역추적한다.

```text
플레이어에게 보이는 현상·역할·결과
← X/N: 조작·공유·권위·저장
← C/G/E/R: 주체·성장·충돌·사건·지각
← W/Q: 지역·규칙·자원·역사·세계 요구
← P/D/S: 전략·의존성·주체 원형
← O: 공리·존재론·불변식
← V: 테스트·리플레이·완료 증거
```

`TRACE.graph.json`의 모든 플레이 증거는 하나 이상의 공리·주체·의존성까지 연결되어야 한다.

역추적 질문:

- 이 장소는 어떤 주체 요구 때문에 존재하는가?
- 이 자원은 어떤 생산·소비·생태 순환에 속하는가?
- 이 NPC·조직은 왜 이 행동을 하는가?
- 이 전투는 어떤 의존 충돌의 결과인가?
- 이 가격 변화는 어떤 사건과 재고 변화에서 나왔는가?
- 이 성장은 어떤 경험과 비용에서 나왔는가?
- 플레이어는 세계 안에서 어떤 신호로 이를 이해하는가?
- 결과는 어떤 상태에 저장되어 다음 행동을 바꾸는가?

### Phase 8. Cycle 모듈 행 생성

역추적 결과를 고정된 모듈 순서에 배치한다.

```text
C03-V  C03-O  C03-S  C03-D  C03-P  C03-Q  C03-W
C03-R  C03-E  C03-G  C03-C  C03-X  C03-N  C03-A
```

각 Module Step에는 다음을 기록한다.

```yaml
module: D4
mode: EXTEND
purpose: "국가·마물·마을·치료사·상인의 현재 의존 압력을 평가한다."
player_visible_contribution:
  - "마물이 임의로 마을을 공격하지 않고 이동로 붕괴 때문에 경로를 변경한다."
mmorpg_loop_contribution:
  - exploration
  - hunting
  - economy
  - faction
  - persistent_world
consumes:
  - S3:IndividualAndComplexSubjects
  - O2:WorldStateSnapshot
produces:
  - DependencyPressureSet
  - RegionalPressureSnapshot
consumedBy:
  - P4
  - E0
  - X4
```

모든 Step은 반드시 다음 두 항목을 가진다.

- `player_visible_contribution`: 플레이어가 이 구현으로 어떤 새로운 세계 현상·행동·결과를 경험하는가?
- `mmorpg_loop_contribution`: 탐험·전투·제작·경제·사회·성장·멀티플레이·영속성 중 어디에 기여하는가?

플레이어 기여가 없는 Step은 다음 중 하나로 분류한다.

- Foundation 기반 작업
- 기술 부채 정리
- 현재 Cycle 범위를 벗어난 과잉 구현

### Phase 9. Module Step을 Implementation Task로 분해

```ts
interface ModuleCycleStep {
  id: string;
  cycleId: string;
  moduleId: string;
  mode: StepMode;
  purpose: string;
  playerVisibleContribution: string[];
  mmorpgLoopContribution: MmorpgLoopTag[];
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
    commandsHandled: string[];
    errors: string[];
  };
  verification: {
    unitTests: string[];
    propertyTests: string[];
    failureTests: string[];
    integrationTests: string[];
    scenarios: string[];
    labPanels: string[];
    playableEvidence: string[];
  };
  doneEvidence: string[];
}
```

각 Step은 다음 묶음으로 분해한다.

**계약·스키마**

- 입력·출력 타입
- 오류 타입
- 명령과 이벤트 스키마
- 읽고 쓰는 상태 경로
- 버전과 마이그레이션

**순수 로직**

- 계산
- 후보 생성
- 검증
- 선택
- 설명
- 정렬과 결정성

**런타임 연결**

- 상태 조회
- 명령 제출
- 사건 생성
- 상태 전이
- 다음 모듈 출력 전달

**게임 표현**

- 3D 현상
- UI 신호
- NPC 행동 표현
- 가격·재고·경로·관계 변화
- 플레이어 조작과 피드백

**개발자 검증**

- Lab 입력
- 처리 과정
- 후보와 선택 결과
- 상태 전후 diff
- 실패 사유
- 인과 추적

**자동 검증**

- 정상·실패·경계 테스트
- 속성 테스트
- Module Handoff 테스트
- Scenario 리플레이
- 저장·복구 테스트
- 완료 증거

### Phase 10. 정방향 구현과 Gate

구현은 고정 순서대로 진행한다.

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

**Step Gate**

- 입력·출력 스키마 등록
- 정상·실패·경계 테스트 통과
- 결정성 확인
- Scenario 연결
- Lab에서 처리 과정 확인
- 플레이어 기여 증거 확인
- 완료 증거 생성

**Module Handoff Gate**

- 이전 모듈의 실제 출력이 다음 모듈 입력으로 사용됨
- 운영 경로에 테스트 하드코딩이 없음
- 미소비 출력이 없음
- 오류가 숨겨지지 않음
- 인과 추적 ID 유지
- 상태 변경은 사건을 통해서만 발생

### Phase 11. 지속적인 수직 통합

X까지 모두 만든 후 처음 게임을 조립하지 않는다.

```text
O/S/D/P → 텍스트·그래프 기반 주체 행동 시뮬레이션
Q/W     → 의미 공간과 지역 상태 미리보기
R/E     → 헤드리스 Situation 실행
G/C     → 반복 실행과 장기 주체·경제·생태 변화
X       → 실제 3D 탐험·전투·제작·거래 표현
N       → 공유 세계·명령·권위·저장 경로 통합
A       → 같은 스키마로 콘텐츠 후보 생성·검증
```

Cycle 개발 중에도 항상 다음 중 하나가 실행 가능해야 한다.

- Lab 기반 지역 시뮬레이션
- 헤드리스 Scenario
- 3D 플레이 빌드
- 권위 서버가 연결된 멀티플레이 빌드

### Phase 12. Cycle MMORPG Acceptance Gate

Cycle 완료는 테스트 통과만으로 인정하지 않는다.

#### 12.1 MMORPG Identity Gate

다음이 모두 존재해야 한다.

- 탐험 가능한 공유 지역
- 복수의 플레이 역할
- 반복 가능한 Gameplay Loop
- 자율적으로 행동하는 복수 주체·세력
- 희소 자원과 경제적 선택
- 성장과 가능성 확장
- 협력 또는 경쟁하는 플레이어
- 저장되는 세계 변화

하나라도 완전히 없으면 Cycle이 아니라 시스템 프로토타입이다.

#### 12.2 Gameplay Loop Gate

- 루프 진입 신호가 세계 안에 존재한다.
- 플레이어가 여러 행동 중 선택한다.
- 행동에 비용·위험·기회비용이 있다.
- 결과가 세계·경제·관계·성장을 바꾼다.
- 변경된 상태가 다음 루프를 바꾼다.
- 반복 시 상태와 주체 때문에 다른 상황이 발생한다.

#### 12.3 World Autonomy Gate

- 플레이어가 없어도 주체가 목적을 선택한다.
- 생태·경제·조직 상태가 제한된 해상도로 진행된다.
- Situation이 발생·악화·해소된다.
- 결과가 미리 작성된 타임라인이 아니라 현재 상태에서 계산된다.

#### 12.4 Multiplayer Gate

- 여러 플레이어가 같은 세계 상태를 본다.
- 동시 행동 충돌을 권위 서버가 결정한다.
- 협력·경쟁·거래 중 둘 이상이 실제 이익과 위험을 만든다.
- 한 플레이어의 행동이 다른 플레이어의 선택을 바꾼다.

#### 12.5 Progression Gate

- 플레이 전후에 가능한 행동이 달라진다.
- 지식·숙련·관계·권한·능력·의존 구조 중 하나 이상이 변한다.
- 성장이 비용과 세계 규칙을 우회하는 무제한 해금이 아니다.

#### 12.6 Economy Gate

- 생산과 소비가 실제 재고를 바꾼다.
- 운송·위험·희소성 중 하나가 교환 가치에 영향을 준다.
- 플레이어와 NPC가 같은 자원 상태를 사용한다.
- 경제 결과가 새로운 계약·갈등·전략을 만든다.

#### 12.7 Persistence Gate

- 세계 상태가 저장된다.
- 재접속 후 결과가 유지된다.
- 사건 로그와 스냅샷으로 복구할 수 있다.
- 저장된 변화가 다음 Situation과 NPC 행동에 사용된다.

#### 12.8 Player Comprehension Gate

플레이어는 다음을 개발자 콘솔 없이 이해할 수 있어야 한다.

- 현재 지역에 무슨 변화가 일어나는가?
- 어떤 주체들이 무엇을 원하고 있는가?
- 자신이 개입할 수 있는 방법은 무엇인가?
- 행동 결과로 무엇이 달라졌는가?

퀘스트 목록만으로 설명하는 것은 허용하지 않는다. 공간·현상·NPC 행동·소문·계약·가격·흔적을 함께 사용한다.

#### 12.9 Developer Explainability Gate

개발자 Lab에서는 하나의 결과를 다음 경로로 추적할 수 있어야 한다.

```text
공리
→ 주체
→ 의존성
→ 결핍·위협·기회
→ 가능성
→ 목적·전략
→ 세계 요구
→ 세계 요소·규칙·역사
→ 지각·믿음
→ 행동 의도
→ 충돌
→ 사건
→ 성장·관계·경제·세계 변화
```

#### 12.10 Determinism and Regression Gate

- 같은 시드와 입력에서 같은 최종 상태 해시
- 차이가 생기면 최초 차이 Tick과 상태 경로 출력
- 현재 Cycle의 모든 Scenario 통과
- 이전 모든 Cycle의 회귀 Scenario 통과
- 저장·불러오기 리플레이 통과

### Phase 13. 플레이 테스트

자동 검증 후 실제 플레이 테스트를 수행한다.

확인 항목:

- 플레이어가 스스로 활동을 발견하는가?
- 역할 간 플레이 방식이 실제로 다른가?
- 전투 외 행동도 세계에 의미 있는 영향을 주는가?
- 다른 플레이어가 기회이자 위험으로 작동하는가?
- 세계 변화가 다음 행동을 자연스럽게 유도하는가?
- 반복 플레이에서 같은 순서만 재생되지 않는가?
- NPC 행동이 임의적이 아니라 이해 가능한가?
- 성장이 새로운 가능성을 실제로 여는가?

플레이 테스트 문제는 기능 요청으로 바로 변환하지 않는다.

```text
관찰된 문제
→ 어떤 MMORPG Loop가 약한가?
→ 어떤 Situation이 발생하지 않았는가?
→ 어떤 모듈 출력이 부족했는가?
→ 다음 Cycle 후보 또는 현재 Cycle 수정 Step 생성
```

### Phase 14. Cycle 동결

모든 Gate를 통과하면 VERIFIED로 동결한다.

산출물:

- `CYCLE.yaml`
- `TRACE.graph.json`
- `LOOPS.yaml`
- `SITUATIONS.yaml`
- `STEP.yaml` 목록
- Scenario 입력과 리플레이
- 대표 월드 스냅샷
- 상태 해시
- 자동 테스트 결과
- 플레이 테스트 보고서
- 완료 증거
- 알려진 한계
- 다음 Cycle 후보

상태 기계:

```text
PLANNED
→ CONTRACTED
→ LOOP_DESIGNED
→ SCENARIO_DEFINED
→ IMPLEMENTING
→ STEP_VERIFIED
→ MODULE_CONNECTED
→ CYCLE_INTEGRATED
→ MMORPG_GATE_VERIFIED
→ PLAYTEST_VERIFIED
→ REGRESSION_VERIFIED
→ VERIFIED
```

VERIFIED Cycle만 다음 Cycle의 기준선이 된다.

---

## 10. 플레이어 설명과 개발자 설명의 분리

### 10.1 개발자 인과 설명

개발자 Lab은 정확한 수치와 인과를 보여 준다.

```text
BorderStoneMoved
→ god.stability -20
→ monster.routeCost.old +35
→ monster.routeSelection = villageEastPass
→ village.threat +42
→ merchant.escortDemand +3
→ transport.priceMultiplier 1.4
```

### 10.2 플레이어 세계 내 설명

플레이어는 세계의 징후로 이해한다.

- 제단의 빛이 약해진다.
- 국경석 주변의 문양이 깨진다.
- 기존 마물 발자국이 사라지고 마을 동쪽에서 새 흔적이 발견된다.
- 가축이 사라지고 부상자가 늘어난다.
- 상인이 호위 인원을 모집한다.
- 치료 재료와 장비 가격이 오른다.
- 밀수 조직이 새로운 통로 정보를 판매한다.
- 국가 관리인이 사건을 은폐하려 한다.

플레이어 UI에 내부 Dependency Graph를 그대로 노출하지 않는다. 플레이어는 조사·관찰·대화·거래를 통해 인과를 발견한다.

---

## 11. Cycle 파일 구조

```text
/cycles
  /C01-border-canyon
    CYCLE.yaml
    LOOPS.yaml
    SITUATIONS.yaml
    TRACE.graph.json
    /steps
      C01-V0-S01.yaml
      C01-O0-S01.yaml
      C01-D4-S01.yaml
      ...
    /scenarios
      /causal
      /space
      /economy
      /social
      /collision
      /multiplayer
      /persistence
      /regression
    /replays
    /snapshots
    /evidence
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

- **Cycle 디렉터리**: 목표·루프·Situation·Scenario·Step·증거 보존
- **packages 디렉터리**: Cycle을 거치며 계속 확장되는 실제 구현

Cycle마다 코드를 복제하지 않는다. 같은 모듈 패키지를 확장하고 이전 Cycle 리플레이로 동작을 보호한다.

---

## 12. Cycle 문서 템플릿

```md
# CXX. Cycle 제목

## 1. 플레이어 판타지

## 2. 세계 약속

## 3. 이전 기준선
- 이전 VERIFIED Cycle:
- 상태·이벤트 버전:
- 필수 회귀 Scenario:

## 4. 깊이 증가
- 주 깊이 축:
- 보조 깊이 축:
- 유지할 기존 축:
- 이번 Cycle 비범위:

## 5. 지역 범위
- 장소:
- 이동 구조:
- 생산 지점:
- 위험 지점:
- 사회 공간:

## 6. 주체·세력·생태

## 7. 플레이어 역할

## 8. 핵심 Gameplay Loop
### 탐험
### 전투·사냥
### 채집·제작
### 경제·운송
### 사회·세력
### 성장
### 지역 변화

## 9. 자원 경제
- 생산:
- 소비:
- 운송:
- 소유권:
- 희소성:
- 가격·교환 가치:

## 10. 멀티플레이
- 협력:
- 경쟁:
- 거래:
- 동시 충돌:

## 11. 영속 상태

## 12. Situation 목록

## 13. Scenario 목록

## 14. 인과 추적
O → S → D → P → Q → W → R → E → G → C → X → N → A

## 15. Module Step
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

## 16. MMORPG Acceptance Gate

## 17. 회귀 검증

## 18. 완료 증거

## 19. 알려진 한계

## 20. 다음 Cycle 후보
```

---

## 13. Module Step 템플릿

```yaml
id: CXX-O0-S01
cycle: CXX
module: O0
mode: EXTEND
purpose: "이번 Cycle에서 이 Step이 해결할 한 가지 목적"
player_visible_contribution:
  - "플레이어가 세계 안에서 확인할 변화"
mmorpg_loop_contribution:
  - exploration
  - combat
  - crafting
  - economy
  - social
  - progression
  - multiplayer
  - persistent_world
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
  commandsHandled: []
  eventsEmitted: []
verification:
  unitTests: []
  propertyTests: []
  failureTests: []
  integrationTests: []
  scenarios: []
  labPanels: []
  playableEvidence: []
doneEvidence:
  - "source hash"
  - "test report"
  - "state hash"
  - "scenario result"
  - "playable evidence"
```

---

## 14. Cycle 1 — 국경 협곡 개척지

Cycle 1은 전체 모듈을 얇게 관통하는 최초의 소형 MMORPG 지역이다.

### 14.1 플레이어 판타지

플레이어는 아직 완전히 통제되지 않은 국경 협곡에 들어가 탐험가·사냥꾼·제작자·상인·호위자·밀수업자·협상가·의념 연구자 중 자신의 역할을 선택한다. 다른 플레이어 및 세계 주체와 협력하거나 경쟁하면서 지역의 생태·경제·세력 관계와 신의 영역을 바꾼다.

### 14.2 세계 약속

- 모든 장소와 자원은 주체의 의존성과 세계 요구에서 생성된다.
- 모든 NPC·조직·생물은 플레이어 없이도 행동한다.
- 전투·거래·제작·정보·사회 행동이 같은 세계 상태를 사용한다.
- 플레이어의 결과는 저장되어 다음 Situation을 바꾼다.
- 퀘스트를 받지 않아도 흔적·소문·가격·행동을 통해 개입 기회를 발견한다.

### 14.3 지역 범위

```text
크기: 약 2km × 2km 국경 협곡

주요 장소:
- 국경 마을 1개
- 국가 초소 1개
- 광산 1개
- 국경 신 제단 1개
- 치료 재료 습지 1개
- 거대 마물 이동로 1개
- 밀수 동굴과 우회 통로 1개
- 전망·흔적 조사 지점 여러 개
- 교역로 1개
```

### 14.4 주체·세력·생태

- 플레이어: 소수 동시 접속
- 마을 주민: 생존·식량·안전
- 치료사: 약초·마물 기관·환자 보호
- 상인: 재고·운송로·이익
- 국경 관리인과 국가 조직: 광맥·통제·정당성
- 밀수 조직: 은폐 통로·거래·단속 회피
- 거대 마물: 이동로·먹이·회복·번식 조건
- 국경 신: 국경석·의례·숭배·영역 안정
- 자원 군락과 생태 개체군

### 14.5 중앙 지역 압력

```text
국가가 광맥 개발을 위해 국경석을 이동한다.
        ↓
국경 신의 안정도와 영역 규칙이 약화된다.
        ↓
거대 마물의 기존 이동로가 붕괴하거나 위험해진다.
        ↓
마물이 마을·교역로·광산 방향으로 이동한다.
        ↓
마을의 안전과 식량이 위협받는다.
치료사는 마물 기관을 확보하려 한다.
상인은 교역로를 유지하려 한다.
국가는 개발을 계속하고 사건을 통제하려 한다.
밀수 조직은 혼란과 우회로를 이용하려 한다.
플레이어들은 서로 다른 역할과 이해관계로 개입한다.
```

이것은 고정 메인 퀘스트가 아니라 지역의 초기 압력 구조다.

### 14.6 핵심 Gameplay Loop

**탐험·정보 루프**

```text
소문·현상 발견
→ 흔적 조사
→ 위험·자원·주체 위치 추론
→ 지도와 믿음 갱신
→ 새로운 경로·계약·사냥 기회 발견
```

**사냥·전투 루프**

```text
마물 흔적 분석
→ 도구·약품·역할 준비
→ 추적·유인·차단
→ 전투·포획·회피
→ 해체·운반
→ 생태·시장·세력 상태 변화
```

**채집·제작 루프**

```text
광물·약초·마물 부산물 획득
→ 품질·효능 판별
→ 가공
→ 치료제·추적 도구·의례 도구·장비 제작
→ 사용·판매·계약 납품
→ 더 위험한 가능성 해금
```

**경제·운송 루프**

```text
지역 수요와 재고 확인
→ 생산지·판매처·운송로 선택
→ 호위·밀수·정상 거래 결정
→ 운송 중 위험과 플레이어 경쟁
→ 거래·손실·압수
→ 재고·교환 가치·세력 재정 변화
```

**사회·세력 루프**

```text
주체의 요구와 갈등 파악
→ 계약·거래·협상·기만·위협
→ 약속 수행 또는 위반
→ 신뢰·평판·권한·적대 변화
→ 새로운 정보·지역·서비스 접근
```

**지역 변화 루프**

```text
플레이어와 주체 행동 축적
→ 국경석·마물 경로·광산·시장·마을 상태 변화
→ 새로운 Situation 발생
→ 기존 경로 폐쇄 또는 신규 경로 개방
→ 새로운 자원·위험·세력 행동 발생
```

### 14.7 최소 자원 경제

핵심 자원 예:

- 광물
- 치료 약초
- 마물 기관
- 식량
- 의례 재료
- 운송·전투 소모품

최소 제작 결과:

- 치료제
- 추적 도구
- 의례 안정화 도구
- 광산 또는 전투용 장비

경제 상태:

- 생산량
- 재고
- 소유권
- 운송 중 물량
- 소비 수요
- 위험 비용
- 세력별 교환 가치
- 계약 보상

### 14.8 최소 성장

Cycle 1 안에서 다음 성장 중 여러 개가 실제로 발생한다.

- 지역 지식과 지도 갱신
- 마물 흔적 판별 숙련
- 제작식 획득
- 세력 신뢰와 거래 권한
- 새 우회로·생산지 접근
- 의념 능력의 조건 또는 대응 정보 발견
- 가능성 그래프의 신규 전략 해금

### 14.9 최소 멀티플레이

- 플레이어 간 자원·정보 거래
- 공동 사냥 또는 호위
- 같은 고유 자원에 대한 경쟁
- 계약 수행 중 역할 분담
- 밀수와 단속 측의 대립
- 한 플레이어의 선택이 지역 가격·안전·평판에 영향

### 14.10 영속 상태

- 국경석 위치와 상태
- 신의 안정도
- 마물 위치·부상·이동 경로
- 광산 생산량과 지배 상태
- 교역로 안전도
- 시장 재고와 교환 가치
- 마을 식량·부상자·신뢰
- 세력 관계와 계약
- 플레이어 평판·지식·제작법·약속
- 발견된 장소와 소문

### 14.11 대표 Situation

#### ST-C01-01. 마물 이동로 붕괴

국경석 이동으로 신의 영역이 약해지고 마물이 마을 방향의 대체 경로를 선택한다.

가능한 개입:

- 마물을 사냥한다.
- 기존 이동로를 복구한다.
- 국경석을 원위치 또는 다른 위치로 이동한다.
- 마을을 방어하고 대피시킨다.
- 국가에 개발 중단을 요구하거나 거래한다.
- 밀수 통로를 이용해 사람과 자원을 이동한다.
- 의례로 신의 영역을 임시 안정화한다.

#### ST-C01-02. 치료 재료 부족

부상자 증가로 약초와 마물 기관 수요가 증가한다.

가능한 개입:

- 약초 채집과 재배지 보호
- 마물 사냥·기관 거래
- 치료제 제작
- 재료 독점과 가격 상승
- 위조 재료 또는 정보 기만
- 운송 계약과 호위

#### ST-C01-03. 광산과 밀수 통로 충돌

국가의 광산 확장이 밀수 통로와 마물 서식지를 침범한다.

가능한 개입:

- 국가 측 경비·개발
- 밀수 측 운송·은폐
- 광산 방해 또는 협상
- 새로운 우회로 탐색
- 관련 정보를 다른 세력에 판매

### 14.12 대표 Scenario

Cycle 1의 복잡성을 다음처럼 작게 검증한다.

| Scenario | 검증 내용 |
|---|---|
| SC-C01-D4-01 | 식량이 줄어든 마을의 의존 압력이 상승하고 상인·주민 목적이 변하는가? |
| SC-C01-P4-01 | 마물이 기존 경로·마을 경로·광산 경로 중 비용과 위험에 따라 하나를 선택하는가? |
| SC-C01-W1-01 | 국가·마물·신·밀수 조직·치료사의 요구가 하나의 협곡 구조로 병합되는가? |
| SC-C01-R4-01 | 국가 보고서와 실제 흔적이 다를 때 NPC와 플레이어가 서로 다른 믿음을 형성하는가? |
| SC-C01-E3-01 | 플레이어 두 명과 NPC가 같은 마물 기관을 동시에 획득하려 할 때 소유권이 한 번만 확정되는가? |
| SC-C01-G1-01 | 반복 추적으로 마물 흔적 판별 가능성과 비용이 달라지는가? |
| SC-C01-N3-01 | 국경석 이동 후 저장·재접속해도 신의 안정도와 마물 경로가 유지되는가? |

기존의 `배고픈 인간 한 명과 음식 하나`는 다음과 같은 하위 Scenario로 사용할 수 있다.

| Scenario | 검증 내용 |
|---|---|
| SC-C01-D4-BASE-01 | 단일 인간의 식량 의존 압력 계산 |
| SC-C01-E3-BASE-01 | 두 주체가 음식 하나를 동시에 획득할 때 소유권 충돌 |
| SC-C01-R5-BASE-01 | 양도 요청 거절 기억이 다음 전략 선택에 미치는 영향 |

이 장면들은 전체 Cycle 목표가 아니라 모듈의 최소 불변식을 검증하는 테스트다.

---

## 15. Cycle 1의 모듈별 기여

| 모듈 | Cycle 1 구현 책임 | 플레이어가 경험하는 결과 |
|---|---|---|
| V | Cycle·Situation·Scenario·리플레이·상태 해시·완료 증거 | 같은 세계를 재현하고 오류 원인을 확인할 수 있다 |
| O | 의념 비용, 사건 기반 변경, 소유권, 신의 영역, 관찰 세계 고정 공리 | 능력·의례·소유권·세계 변화에 일관된 대가와 규칙이 있다 |
| S | 플레이어 역할, 주민, 치료사, 상인, 관리인, 밀수업자, 마물, 신 원형 | 서로 다르게 감지하고 행동하는 주체가 존재한다 |
| D | 식량·안전·광물·기관·이동로·의례·정당성 의존성 | 세력과 생물이 왜 행동하는지 이유가 생긴다 |
| P | 탐험·거래·사냥·밀수·의례·복구·협상 전략 | 같은 문제를 여러 방식으로 해결할 수 있다 |
| Q | 각 전략의 공간·자원·규칙·정보·상대·역사 요구 | 콘텐츠가 임의 배치되지 않는다 |
| W | 국경 협곡·광산·마을·제단·통로·생태·압축 역사 | 탐험할 실제 지역과 현재 갈등의 근거가 생긴다 |
| R | 사건·현상·지각·믿음·기억·관계·행동 의도 | 주체가 실제 세계가 아니라 자신이 아는 정보로 행동한다 |
| E | 계약·거래·기만·전투·소유권·사건 연쇄 | 플레이어와 주체의 행동 충돌이 콘텐츠를 만든다 |
| G | 지식·숙련·제작법·평판·전략·능력 성장 | 반복 플레이가 새로운 가능성을 연다 |
| C | 마물·조직·국가·신·자원 군락을 복합 주체로 실행 | 개인 NPC를 넘어선 생태·제도·영역 변화가 발생한다 |
| X | 3D 탐험·전투·채집·제작·거래·정보·현상 UI | 실제 MMORPG 지역으로 플레이할 수 있다 |
| N | 공유 세계·권위·동시성·관심 영역·저장·재접속 | 여러 플레이어가 같은 지속 세계에 영향을 준다 |
| A | 종·의존성·지역·Situation 후보의 구조화 생성과 검증 | 다음 콘텐츠를 같은 인과 구조로 확장할 수 있다 |

---

## 16. Cycle 1 / O0 세계관 공리 Step 상세 예시

O0는 공리 자체를 전면 콘텐츠로 만들기 위한 모듈이 아니다. 국경 협곡의 능력·신·소유권·세계 변화를 일관되게 작동시키기 위한 기반이다.

### C01-O0-S01. 공리 메타데이터 스키마

```ts
type AxiomPhase =
  | "definition"
  | "world_compile"
  | "runtime_transition"
  | "authority_resolution";

type AxiomSeverity = "error" | "warning";

interface AxiomSpec {
  id: string;
  description: string;
  phases: AxiomPhase[];
  severity: AxiomSeverity;
  evaluatorId: string;
  playerFacingSignals?: string[];
}

interface AxiomContext {
  phase: AxiomPhase;
  before?: unknown;
  input: unknown;
  after?: unknown;
  eventId?: string;
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

### C01-O0-S02. 공리 레지스트리

```ts
class AxiomRegistry {
  register(spec: AxiomSpec, evaluator: AxiomEvaluator): void;
  get(id: string): RegisteredAxiom;
  listByPhase(phase: AxiomPhase): RegisteredAxiom[];
  snapshot(): AxiomRegistrySnapshot;
}
```

### C01-O0-S03. Cycle 1 핵심 공리

| 공리 | 내용 |
|---|---|
| 사건 기반 상태 변경 | 정식 세계 상태는 대응 사건 없이 변경될 수 없다. |
| 자원·비용 보존 | 자원 소비, 능력 효과, 생산 결과에는 추적 가능한 비용과 상태 변화가 필요하다. |
| 능력 흔적 | 강한 의념 효과는 관찰 가능한 현상·잔향·조건 중 하나 이상을 남긴다. |
| 관찰 세계 고정 | 관찰된 정식 세계 요소는 사건 없이 소급 변경되지 않는다. |
| 조직 실체 행동 | 국가와 조직은 실제 구성원·자산·명령 전달 경로를 통해서만 행동한다. |
| 신의 유지 조건 | 신의 영역과 효과는 앵커·의례·숭배·금기 같은 유지 조건의 상태에 따라 변한다. |
| 권위 충돌 확정 | 공유 소유권·전투·계약 결과는 권위 서버에서 한 번만 확정된다. |

핵심 평가 함수:

```ts
checkEventSourcedTransition(ctx: AxiomContext): AxiomResult
checkResourceAndCostConservation(ctx: AxiomContext): AxiomResult
checkObservableAbilityTrace(ctx: AxiomContext): AxiomResult
checkObservedWorldLock(ctx: AxiomContext): AxiomResult
checkOrganizationEmbodiedAction(ctx: AxiomContext): AxiomResult
checkGodMaintenanceCondition(ctx: AxiomContext): AxiomResult
checkAuthoritativeConflictResolution(ctx: AxiomContext): AxiomResult
```

### C01-O0-S04. 정의·세계 제안·상태 전이 검증

```ts
validateDefinition(
  candidate: DefinitionCandidate,
  registry: AxiomRegistry
): ValidationReport

validateWorldProposal(
  proposal: WorldProposal,
  registry: AxiomRegistry
): ValidationReport

validateTransition(
  transition: StateTransitionCandidate,
  registry: AxiomRegistry
): ValidationReport

validateAuthorityResolution(
  resolution: AuthorityResolutionCandidate,
  registry: AxiomRegistry
): ValidationReport
```

연결:

- A2가 정의 검증 사용
- W2/W3/W4가 세계 제안 검증 사용
- R1이 상태 전이 검증 사용
- E3/N0가 권위 충돌 검증 사용

### C01-O0-S05. 대표 실패 Scenario

```text
마물 기관을 소비하지 않고 치료제를 무한 생산
→ 자원·비용 보존 위반

국경석 이동 사건 없이 신의 안정도 직접 수정
→ 사건 기반 변경 위반

플레이어가 본 밀수 동굴을 새 요구 때문에 조용히 다른 위치로 이동
→ 관찰 세계 고정 위반

국가가 병사·명령·자산 없이 광산 점유율을 즉시 변경
→ 조직 실체 행동 위반

동시에 두 플레이어가 같은 기관 소유자가 됨
→ 권위 충돌 확정 위반
```

### C01-O0-S06. 플레이어 기여

- 능력과 의례에 비용과 흔적이 생긴다.
- 국가 행동이 실제 병사와 자산으로 표현된다.
- 신의 영역 변화가 제단·문양·현상으로 나타난다.
- 고유 자원의 소유권이 공유 세계에서 일관된다.
- 관찰한 장소가 임의로 바뀌지 않는다.

### C01-O0-S07. Lab과 완료 증거

Lab:

- 등록된 공리
- 적용 phase
- 선택한 정의·세계 제안·사건·권위 결과
- 통과·실패
- 위반 상태 경로
- 플레이어에게 나타날 현상
- 해당 결과를 사용하는 Module Step

완료 증거:

```json
{
  "step": "C01-O0",
  "axiomsRegistered": 7,
  "unitTests": "passed",
  "failureScenarios": "passed",
  "integrationModules": ["W", "R", "E", "N", "A"],
  "registryHash": "...",
  "status": "VERIFIED"
}
```

다른 Module Step도 같은 수준으로 타입·객체·함수·상태·이벤트·게임 표현·Scenario·증거까지 분할한다.

---

## 17. 후속 Cycle 방향

후속 Cycle은 별도 게임을 다시 만드는 것이 아니라 Cycle 1의 국경 세계를 보존하면서 MMORPG 깊이를 확장한다.

### Cycle 2 — 경제와 조직

- **주 깊이 축**: `economicDepth` + `socialDepth`
- **추가**:
  - 생산 체인
  - 운송과 창고
  - 가격·재고·수요
  - 조직 자산과 재정
  - 고용과 계약
  - 플레이어 간 시장
  - 밀수와 단속 경제
- **완료 결과**: 플레이어의 사냥·제작·운송·약탈·정책 선택이 지역 경제와 조직 행동을 지속적으로 바꾼다.

### Cycle 3 — 능력과 캐릭터 표현

- **주 깊이 축**: `subjectDepth` + `progressionDepth` + `strategicDepth`
- **추가**:
  - 가치관·공포·과거·습관에서 능력 생성
  - 표현 계통
  - 개인 특화
  - 제약과 비용
  - 숙련과 안정도
  - 대상 저항과 실패 결과
  - 능력 정보 은폐와 추론
  - 플레이어·NPC별 대응 전략
- **완료 결과**: 같은 전투와 갈등도 캐릭터의 가치관과 능력 조건에 따라 전혀 다른 전략과 사건으로 전개된다.

### Cycle 4 — 영토와 정치

- **주 깊이 축**: `socialDepth` + `worldDepth` + `temporalDepth`
- **추가**:
  - 국가 정책
  - 조직 파벌
  - 법률과 범죄
  - 영토 점유
  - 정당성
  - 신의 영역
  - 플레이어 집단의 정치적 영향
- **완료 결과**: 개인의 계약과 전투가 조직·마을·국가의 정책과 영토 상태에 누적된다.

### Cycle 5 — 다지역 오픈월드

- **주 깊이 축**: `spatialDepth` + `economicDepth` + `worldDepth`
- **추가**:
  - 여러 지역
  - 지역별 생태·규칙·문화·자원
  - 교역로
  - 생물 이동
  - 정보 전달 지연
  - 전쟁·난민·질병·가격 전파
- **완료 결과**: 한 지역의 사건이 다른 지역의 경제·생태·정치와 연결된다.

### Cycle 6 — 대규모 영속 MMORPG

- **주 깊이 축**: `onlineDepth` + `temporalDepth`
- **추가**:
  - 관심 영역
  - 시뮬레이션 해상도
  - 다수 플레이어와 조직
  - 장기 사건
  - 서버 복구와 버전 이관
  - 비접속 플레이어의 약속·자산·관계 처리

### Cycle 7 — AI 확장 세계

- **주 깊이 축**: `productionDepth`
- **추가**:
  - 새 종
  - 새 능력
  - 새 세력
  - 새 지역
  - 새 자원 순환
  - 새 Situation 문법
  - 정적 검증
  - 축소 시뮬레이션
  - 자동 수정

AI는 후보만 생성하며, 기존 O~N 검증을 통과한 결과만 정식 세계에 등록한다.

---

## 18. 자동화 명령

```text
cycle:new C03
→ Cycle/Loop/Situation/Scenario/Step 템플릿 생성

cycle:lint C03
→ 필수 MMORPG 요소, 모듈 Step, 미소비 출력, 순환 의존 검사

cycle:trace C03
→ 플레이 증거에서 공리까지 인과 누락 검사

cycle:scenario C03
→ Cycle의 모든 단위 Scenario 실행

cycle:test C03
→ 단위·속성·모듈 통합 테스트

cycle:play C03
→ 실제 3D 지역 실행

cycle:mmorpg-gate C03
→ MMORPG Identity와 각 Acceptance Gate 검사

cycle:replay C03
→ 현재 Cycle 대표 리플레이와 해시 검사

cycle:regression C03
→ 이전 모든 Cycle Scenario와 리플레이 실행

cycle:evidence C03
→ Step 및 Cycle 완료 증거 생성

cycle:freeze C03
→ VERIFIED 조건 검사 후 기준선 등록
```

`cycle:lint` 오류:

- Cycle에 탐험 가능한 지역이 없음
- 반복 Gameplay Loop가 없음
- 성장 또는 경제가 없음
- 멀티플레이 협력·경쟁·거래가 없음
- 영속 상태가 없음
- Module Step 누락
- 플레이어 기여 없는 Step
- 입력 근거 없는 출력
- 다음 모듈에서 소비되지 않는 출력
- X의 하드코딩된 정식 세계 요소
- 사건 없는 상태 변경
- 실패 Scenario 없는 CREATE/EXTEND Step
- 동일 시드 비결정성
- A 후보가 검증 없이 정식 세계에 등록되는 경로

---

## 19. AI Agent 작업 루프

AI Agent는 Cycle 전체를 한 번에 구현 완료로 선언하지 않는다.

1. Cycle MMORPG 계약 확인
2. Gameplay Loop 확인
3. Situation과 Scenario 분해
4. 플레이 경험에서 모듈 원인 역추적
5. Module Step 생성
6. Implementation Task 분해
7. V→A 순서 구현
8. Step Gate 통과
9. Module Handoff 통과
10. Scenario 통과
11. 3D 수직 통합
12. MMORPG Acceptance Gate 통과
13. 플레이 테스트
14. 전체 회귀
15. Cycle 동결

Agent Step 보고 형식:

1. Step 한 문장 목적
2. 기여하는 MMORPG Loop
3. 플레이어에게 보이는 변화
4. 구현한 타입·객체·함수
5. 읽고 쓰는 상태 경로
6. 명령과 사건
7. 정상·실패·경계 Scenario 결과
8. Lab 확인 방법
9. 다음 모듈에 전달한 출력
10. 완료 증거 경로
11. 남은 한계

실패 시 가장 먼저 잘못된 인과 Step으로 되돌아간다.

```text
게임 현상 문제
→ X만 임시 수정하지 않음
→ R/E/W/P/D까지 인과 추적
→ 최초 잘못된 출력 Step 수정
```

---

## 20. 금지되는 Cycle 설계 패턴

### 20.1 모듈 데모를 Cycle로 승격

```text
배고픈 NPC가 열매를 먹는다.
```

이것은 D/P/R/E의 Scenario다. 전체 Cycle이 아니다.

### 20.2 MMORPG 기능 체크리스트만 존재

```text
전투 있음
제작 있음
거래 있음
```

각 기능이 같은 자원·주체·사건·성장 상태에 연결되지 않으면 MMORPG 루프가 아니다.

### 20.3 고정 퀘스트로 세계 시스템을 위장

```text
NPC가 국경석 이동 퀘스트를 배포
→ 수락
→ 보스 처치
→ 지역 상태 플래그 변경
```

주체의 의존성과 실제 사건 없이 퀘스트 스크립트가 결과를 결정하면 실패다.

### 20.4 플레이어만 세계를 움직임

플레이어가 접속하지 않으면 세력·생태·경제가 멈추는 구조는 World Autonomy Gate를 통과하지 못한다.

### 20.5 모든 Cycle에서 새 지역만 추가

지역 수만 늘리고 경제·캐릭터·능력·사회·시간의 깊이가 증가하지 않으면 세로축 진행이 아니다.

### 20.6 개발자 설명을 플레이어 UI로 사용

Dependency Graph와 수식을 플레이어에게 그대로 보여 주는 것은 직관적 게임 전달이 아니다. 세계 현상과 정보 탐색으로 변환해야 한다.

### 20.7 Cycle 범위를 줄이기 위해 MMORPG 핵심 삭제

Cycle을 검증 가능하게 만들기 위해 멀티플레이·경제·성장·영속성을 없애지 않는다. 대신 Scenario로 검증을 분할하고 각 시스템의 폭을 제한한다.

---

## 21. 전체 반복 알고리즘

```ts
while (!projectCompletionCriteriaMet()) {
  const baseline = loadLatestVerifiedCycle();
  const candidates = generateCycleCandidates({
    baseline,
    unverifiedDesignClaims: loadRiskLedger(),
    playtestFindings: loadPlaytestFindings(),
    weakGameplayLoops: loadLoopHealthReport(),
    moduleDepthLedger: loadCapabilityLedger()
  });

  const cycle = selectHighestValueMmorpgDepthCandidate(candidates);

  writeCycleMmorpgContract(cycle);
  designGameplayLoops(cycle);
  deriveSituations(cycle);
  decomposeSituationsIntoScenarios(cycle);

  const trace = deriveRequirementsBackwardFromPlayerExperience(cycle);
  const steps = placeTraceIntoFixedModuleOrder(trace, [
    "V", "O", "S", "D", "P", "Q", "W",
    "R", "E", "G", "C", "X", "N", "A"
  ]);

  decomposeEveryStepToImplementationTasks(steps);
  implementAndVerifyForward(steps);
  integratePlayableMmorpgRegion(cycle);

  if (!passesAllScenarios(cycle)) {
    reviseFirstCausalFailure(cycle);
    continue;
  }

  if (!passesMmorpgAcceptanceGates(cycle)) {
    reviseWeakestGameplayLoopOrSystem(cycle);
    continue;
  }

  if (!passesPlaytest(cycle)) {
    revisePlayerComprehensionOrLoopProblem(cycle);
    continue;
  }

  if (!passesAllPreviousCycleRegressions(cycle)) {
    reviseFirstRegressionDifference(cycle);
    continue;
  }

  freezeAsVerifiedBaseline(cycle);
  updateCapabilityRiskAndLoopLedgers(cycle);
}
```

---

## 22. 최종 운영 규칙

1. Cycle은 기능이나 짧은 사건이 아니라 작은 MMORPG 지역이다.
2. Cycle은 탐험·전투·제작·경제·사회·성장·멀티플레이·영속성을 최소한으로라도 서로 연결해야 한다.
3. 복잡한 Cycle은 크기를 장난감 수준으로 줄이지 않고, Situation과 Scenario로 검증 단위를 분할한다.
4. 계획은 플레이어 판타지·Gameplay Loop·지역 변화에서 O 방향으로 역추적한다.
5. 구현은 V→A의 기존 모듈 순서로 정방향 진행한다.
6. 각 Module Step은 플레이어 기여와 MMORPG Loop 기여를 명시한다.
7. 세계 요소·주체 행동·경제 변화·성장은 전체 인과 경로를 가져야 한다.
8. 플레이어는 세계 현상으로 상황을 이해하고, 개발자는 Lab에서 정확한 인과를 추적한다.
9. 다음 Cycle은 같은 세계와 모듈 구조를 보존하면서 하나의 MMORPG 깊이 축을 실질적으로 확장한다.
10. 이전 Cycle과 Scenario는 영구 회귀 검증으로 유지한다.

최종 구조는 다음 한 문장으로 요약된다.

> **하나의 Cycle을 탐험·전투·제작·경제·사회·성장·멀티플레이·영속 변화가 연결된 작은 MMORPG 지역으로 정의하고, 그 세계를 구성하는 원인을 기존 모듈 파이프라인으로 역추적하여 Module Step과 Scenario로 분해한 뒤 V→A 순서로 구현·검증한다. 이후 같은 세계와 모듈 구조를 유지한 채 Cycle마다 하나의 MMORPG 깊이 축을 확장함으로써 완전한 오픈월드 MMORPG로 성장시킨다.**
