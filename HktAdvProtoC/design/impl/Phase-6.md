# Phase 6 — 자동 검증과 수정

> 근거: §42-6(모순과 누락을 검사하고 생성 결과를 다시 수정한다), §34(생성 결과 검증), §35(자동 시뮬레이션 테스트), §33.2(정합성 검사 보조).

## 목표

생성된 세계를 플레이어에게 공개하기 전에 자동으로 판정한다: **정적 검증(§34) → 자동 시뮬레이션(§35) → 문제 발견 시 수정 루프(§42-6)**. 수동 세계(Phase 1)도 같은 검증을 통과시켜 검증기 자체를 교정한다.

## 산출 모듈

- `generation/WorldValidator.ts` (§37) — 정적 검증: 스키마 + 의미 규칙
- `generation/SimulationTester.ts` — §35 무개입 자동 실행 + 지표 수집
- `generation/RepairLoop.ts` — ValidationIssue → 재생성 지시 변환

## 상세 설계

### 6.1 정적 검증 (§34)

출력은 `ValidationIssue`(§34 — level/code/targetId/message/suggestedFix) 목록. 두 층:

**(a) JSON Schema 검증** — Phase 2·4·5 에서 확정한 계약 스키마 재사용. 생성 직후 이미 1차 수행되므로 여기서는 전체 조립본(`WorldDefinition`) 기준 재검.

**(b) 의미 검증** — §34 필수 규칙 10개를 각각 독립 검사기로 (코드명 고정):

| code | §34 규칙 | 판정 방법 |
|---|---|---|
| `state.schema` | 모든 상태는 정의된 스키마 사용 | 부트스트랩·규칙 효과의 stateKey 전수 대조 |
| `rule.target-exists` | 규칙 대상 실존 | 심볼 테이블(Phase 5) 대조 |
| `resource.source` | 자원의 생성 경로/초기 배치 존재 | productionRules ∪ bootstrap 역추적 |
| `species.need` | 종은 최소 1개 생존 자원 필요 | requiredResources 비어있음 검사 |
| `faction.lifecycle` | 조직에 유지 목적·붕괴 조건 존재 | requiredStates·collapseConditions 검사 |
| `agent.goal` | 개인에게 활성화 가능한 목적 존재 | 초기 상태로 활성도 > 0 인 노드 탐색(Phase 3 계산기 재사용) |
| `action.cost` | 행동에 비용 또는 위험 존재 | costs∪위험 효과 검사 |
| `ability.cost-scaling` | 강한 능력일수록 제약·대가 증가 | 능력 간 출력 순위와 제약 severity·costs 순위의 상관 검사 |
| `event.multi-agent` | 사건 패턴은 둘 이상 주체/시스템 연결 | minimumParticipants·태그 소유 시스템 수 검사 |
| `goal.no-infinite` | 순환 목적 그래프의 무한 행동 금지 | GoalEdge 순환 검출 + 순환 내 완료/포기 조건 부재 검사 |

**(c) AI 보조 검사(§33.2)** — 기계 판정이 어려운 5항목(명제 위반 규칙, 이유 없는 자원, 목적 없는 조직, 대가 없는 강한 능력, 고립된 설정)을 `TextGenerationPort` 로 질의해 `warning` 레벨 Issue 로 수집. AI 판단은 error 로 승격하지 않는다 — 최종 게이트는 기계 검증과 §35 지표만.

### 6.2 자동 시뮬레이션 테스트 (§35)

- 실행: 무개입 30일(§35), Phase 0 InlineHost 로 headless. 결과는 `SimulationTestResult`(§35 필드 그대로: totalActions, deadlockedAgents, dominantActionRatios, resourceCollapse, factionCollapse, warnings…).
- §35 최소 테스트 8항목을 각각 판정기로: 전원 1회 이상 목적 행동 / 단일 행동 70% 초과 없음 / 자원 무한 증가·전멸 없음(30일 추세 기울기 검사) / 조직 즉시 붕괴 없음 / 사건 단일 종류 반복 없음 / 정체 상태 없음(change 발생률 하한).
- 다양성·깊이 점수: §35 의 두 공식 계수 그대로. 입력 통계는 Phase 4 사건 데이터와 change 로그에서 산출. 합격선은 수동 세계(Phase 1~4 완성본)의 측정치를 기준선으로 삼아 결정 — 임의 상수를 만들지 않는다.
- 결정론 활용: 같은 정의·시드로 2회 실행해 로그 해시 일치 확인을 테스트에 포함(§44-12 상시 회귀).

### 6.3 수정 루프 (§42-6)

```
WorldDefinition → 정적 검증 ─error→ 해당 생성 단계만 재실행(Issue 를 프롬프트에 첨부)
        ↓ pass
   시뮬레이션 테스트 ─fail→ 원인 단계 매핑 후 재생성 (아래 표)
        ↓ pass
      공개 가능
```

시뮬레이션 실패 → 재생성 단계 매핑: deadlockedAgents → 목적 그래프·행동(단계 10·11) / dominantAction 편중 → 규칙·행동 비용(5·11) / resourceCollapse → 자원·규칙(6·5) / factionCollapse → 조직(8) / 사건 단조 → 사건 패턴(12). 재생성은 전체 재컴파일이 아니라 **해당 단계 아티팩트만 교체 후 하위 단계 증분 재실행**(Phase 5 파이프라인의 단계 저장 구조 활용). 루프 상한 3회 — 초과 시 Issue 목록과 함께 사람 검토로 전환.

## 구현 스텝

1. 의미 검사기 10종 (+ 각각 위반 세계 픽스처로 단위 테스트 — 검사기가 실제로 잡는지 증명).
2. SimulationTester (§35 판정 8종 + 다양성·깊이 점수 + 재현성 검사).
3. 수동 세계로 기준선 측정·합격선 확정.
4. AI 보조 검사 5종 (mock 포트 테스트).
5. RepairLoop (Issue→단계 매핑, 증분 재실행, 상한).
6. §41 생성 세계 전체 파이프라인: 생성→검증→수정→합격.

## 완료 조건 (DoD)

- [ ] §34 필수 규칙 10개가 각각 위반 픽스처를 error 로 검출한다.
- [ ] 수동 세계가 정적 검증 + §35 테스트를 통과한다(불통과 항목은 콘텐츠 또는 검증기 수정으로 해소).
- [ ] §41 생성 세계가 수정 루프를 거쳐 합격하거나, 3회 초과 시 사람이 읽을 수 있는 Issue 목록을 남긴다.
- [ ] 시뮬레이션 판정이 결정론적이다(같은 입력 → 같은 SimulationTestResult).
- [ ] AI 보조 검사가 꺼져 있어도(오프라인) 파이프라인이 완결된다.

## 이후 Phase 인터페이스

- 합격 판정 → Phase 7 "플레이어에게 공개 가능" 게이트(§35 첫 문장).
- SimulationTestResult·기준선 → 이후 콘텐츠·생성기 개선의 회귀 지표.
