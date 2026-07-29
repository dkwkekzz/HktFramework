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

- [x] §34 필수 규칙 10개가 각각 위반 픽스처를 error 로 검출한다.
- [x] 수동 세계가 정적 검증 + §35 테스트를 통과한다(불통과 항목은 콘텐츠 또는 검증기 수정으로 해소).
- [x] §41 생성 세계가 수정 루프를 거쳐 합격하거나, 3회 초과 시 사람이 읽을 수 있는 Issue 목록을 남긴다.
- [x] 시뮬레이션 판정이 결정론적이다(같은 입력 → 같은 SimulationTestResult).
- [x] AI 보조 검사가 꺼져 있어도(오프라인) 파이프라인이 완결된다.

## 이후 Phase 인터페이스

- 합격 판정 → Phase 7 "플레이어에게 공개 가능" 게이트(§35 첫 문장).
- SimulationTestResult·기준선 → 이후 콘텐츠·생성기 개선의 회귀 지표.

---

# 구현 결과

## 산출 모듈

| 모듈 | 역할 |
|---|---|
| `generation/WorldValidator.ts` | §34 정적 검증 — (a) 스키마 층 재검 + (b) 의미 검사기 10종(코드 고정) · 이후 재검증이 9종을 더해 **지금은 19종**, 개수의 단일 출처는 `SEMANTIC_CODES` ([Review-2 §6](Review-DesignValidation-2.md)) |
| `generation/SimulationTester.ts` | §35 무개입 30일 실행 + 판정 8종 + 다양성·깊이 점수 + 재현성 해시 |
| `generation/simulationBaseline.ts` | 수동 세계 측정치를 합격선으로 고정 (`npm run baseline:sim` 으로 재고정) |
| `generation/AiAudit.ts` | §33.2 AI 보조 검사 5종 — warning 전용, 포트가 없으면 통째로 건너뛴다 |
| `generation/RepairLoop.ts` | 이슈 → 생성 단계 매핑 + 증분 재실행 + 상한 3회 |
| `generation/phase6Checks.ts` | 위반 픽스처 10종 (verify 와 테스트가 같은 함수를 쓴다) |

## DoD 1 — 검사기가 정말 보고 있는가 (위반 픽스처 10종)

통과 세계로는 검사기가 살아 있는지 알 수 없다. 수동 세계를 한 군데씩 망가뜨려 그 항목만 걸리는지 본다.

```
✓ §34 필수 규칙 10종이 각각 위반 세계를 잡는다 (10/10)
  ✓ state.schema        규칙이 등록되지 않은 상태에 값을 쓴다
      → 규칙 rule.hunger_growth: 등록되지 않은 상태를 쓴다 — unregistered_mana
  ✓ rule.target-exists  조직이 존재하지 않는 종족과의 기본 관계를 선언한다
      → 조직 faction.silent_village 관계 기본값이 존재하지 않는 species 을 가리킨다 — species.ghost
  ✓ resource.source     생성 경로도 초기 배치도 없는 자원이 있다        → resource.phantom_salt
  ✓ species.need        생존 자원이 하나도 없는 종족이 있다              → species.human
  ✓ faction.lifecycle   붕괴 조건이 없는 조직이 있다                     → faction.silent_village
  ✓ agent.goal          초기 상태에서 이미 모든 목적을 이룬 개인이 있다  → agent.mar (활성도 > 0 인 목적 없음)
  ✓ action.cost         비용도 위험도 없는 공짜 행동이 있다              → action.move
  ✓ ability.cost-scaling 더 강한 능력이 더 싼 대가를 갖는다
      → ability.strong_and_cheap: 출력 90 인데 대가 9.0 — 더 약한 출력 40 의 대가 160.0 보다 작다
  ✓ event.multi-agent   혼자서 벌어지는 사건 패턴이 있다                 → pattern.ecological_conflict (최소 참여자 1)
  ✓ goal.no-infinite    완료·포기 조건 없는 순환 목적 그래프가 있다
      → goal_graph.treadmill: 순환 [goal.loop_a→goal.loop_b] 안에 탈출구가 없다
```

각 픽스처는 **자기 검사기 하나만** 깨뜨린다(테스트가 `alsoFailed` 로 확인한다) — 검사기끼리 새지 않는다.

## DoD 2 — 수동 세계는 정적 검증과 §35 를 통과한다 (대조군 + 기준선)

```
✓ 수동 세계가 §34 정적 검증을 통과 (의미 검사 10/10 · 오류 0)
    ✓ 스키마 층          규칙 44개 정규형 검증 · 조립본 계약 위반 0건
    ✓ state.schema       상태 참조 258건 대조 (스키마 45종·파생 3종) · 미등록 0 · 파생 상태 쓰기 0
    ✓ rule.target-exists 참조 459건 / 선언 190개 대조 · 미해결 0
    ✓ resource.source    자원 3종 · 생산 규칙 보유 3 · 출처 없음 0
    ✓ species.need       human:1 echo_beast:2
    ✓ faction.lifecycle  silent_village(유지 1·붕괴 1) research_society(유지 1·붕괴 1)
    ✓ agent.goal         주체 9명 · 최상위 활성도 31.7~118.5 · 활성 목적 없는 주체 0
    ✓ action.cost        행동 14종 · 비용 보유 11 · 위험만 3 · 공짜 0
    ✓ ability.cost-scaling 능력 없음 — 검사 대상 0
    ✓ event.multi-agent  패턴 6개 · 최소 참여자 3/2/2/2/3/3 · 연결 시스템 수 4/2/3/3/3/3
    ✓ goal.no-infinite   그래프 10개 · 목적 29개(탈출구 27) · 순환 0

✓ 수동 세계가 §35 최소 테스트 8항을 통과 (8/8)
    ✓ sim.run              30일 · 표본 30일 · 플레이어 개입 0회 · change 7893건
    ✓ sim.all-agents-act   주체 10명 · 행동한 주체 10 · 교착 0 · 총 행동 1825회
    ✓ sim.dominant-action  행동 종류 13 · 최다 action.rest 26%
    ✓ sim.resource-collapse ability_residue 98→330 · food 259→593 (노드 없는 자원 1종은 판정 밖)
    ✓ sim.resource-explosion 상한 대비 330/500 · 593/1000 — 포화 없음
    ✓ sim.faction-collapse 조직 4 · 붕괴 0
    ✓ sim.event-variety    사건 37건 · 종류 6 · 최다 rumor_spread 41%
    ✓ sim.no-stagnation    일평균 change 263건 · 무변화 일수 0/30 (최소 195 최대 430)
    다양성 30.00 = 행동 13×0.2 + 사건종류 6×0.3 + 참여조합 22×0.3 + 상태갈래 95×0.2
    깊이  5.12 = 목적/사건 11.14×0.25 + 시스템/사건 3.51×0.25 + 정보비대칭 0.76×0.2 + 지속 4.36×0.3
```

이 측정치가 그대로 **합격선**이 된다(`src/content/manual-world/simulation-baseline.json`). §35 는 다양성·깊이의
절대 기준을 주지 않으므로 임의 상수를 만들지 않고 "생성된 세계는 최소한 손으로 만든 세계만큼은 살아 있어야
한다"로 정한다. 판정 8종의 임계는 기획서가 준 것만 쓴다(70% 편중 / 교착 0 / 붕괴 / 포화 / 무변화 0일).

## DoD 3 — §41 생성 세계는 3라운드 만에 합격한다

Phase 5 가 만든 세계는 **14단계 참조 무결성 검증을 통과한 상태**(`검증 이슈 0건`)였다. 그 위에 §34 의미 검증과
§35 실행 판정을 걸자 네 가지가 드러났고, 전부 수정 루프가 닫았다.

```
✓ §41 생성 세계가 3라운드 만에 합격 (상한 3)
  라운드 1: 정적 오류 2 · 시뮬 미실행
    ✗ state.schema:규칙 rule.healing_care   ✗ agent.goal:agent.noa
    → 4단계부터 재생성 (원인 단계 4,10) · 수정 rules/wilds, goals/goal_graph.healer
      · 치료 규칙이 파생 상태 stress 에 직접 값을 썼다 — 원천 상태인 fear 를 낮추도록 바꿨다
      · 치유사의 목적이 전부 '지금 편안한가'로 끝나 초기 상태에서 이미 달성 상태였다 —
        치유 목적의 달성 조건을 '약초 확보'로, 포기 조건을 '제 몸이 무너짐'으로 바꿨다
  라운드 2: 정적 오류 0 · 시뮬 불합격(sim.all-agents-act, sim.resource-explosion)
    → 5단계부터 재생성 (원인 단계 5,6,10,11) · 수정 actions, rules/resources
      · 위임 행동이 '같은 지역의 villager' 만 대상으로 삼아, 마을 밖 조직은 아무에게도 일을 시키지 못했다 —
        조직의 명령은 전령·소문으로 흐른다(§17·§23). 대상 태그를 human 으로 넓히고 지역·거리 제약을 없앴다
      · 재생 규칙에 한계가 없어 채집되지 않는 자원이 상한까지 차올랐다 —
        자리마다 재생 속도의 20일치를 수용력으로 두고 그 아래에서만 자라게 했다
  라운드 3: 정적 오류 0 · 시뮬 합격 → 공개 가능
  최종: 주체 53명 전원 행동 · 사건 14건(9종) · 다양성 53.20 깊이 21.18
        기준선 대비 ✓다양성 ✓깊이 ✓일평균 change ✓행동 종류 ✓사건 종류
```

네 가지 결함은 **전부 Phase 5 가 통과시킨 것들**이다. 참조가 다 맞고 로드도 되는 세계에서
"치유사에게는 원하는 것이 하나도 없었고, 밀수단은 아무에게도 말을 걸 수 없었고, 숲은 무한히 자랐다."
정적 검증만으로는 뒤의 둘을 볼 수 없고, 실행만으로는 앞의 하나(한 번도 발동하지 않은 규칙의 파생 상태 쓰기)를
볼 수 없다 — §34 와 §35 가 **둘 다** 필요한 이유가 이 표다.

수정 라운드의 응답은 `src/content/first-world/recorded/repairs.json` 에 녹화되어 있다. 이슈 코드에 답하는
녹화만 켜지므로, 검증을 통과하는 세계에서는 한 번도 쓰이지 않는다. 고칠 응답이 없는 포트로 돌리면 루프는
상한에서 멈추고 남은 Issue 목록을 그대로 돌려준다(테스트가 그 경로도 확인한다).

## DoD 4 — 판정의 결정론

```
✓ 같은 입력 → 같은 SimulationTestResult · 하루씩 나눈 실행이 한 번에 진행한 세계와 동일
    시드 42 판정 해시 1418a2a3 · 재실행 1418a2a3 · 시드 43 2e15a54e
    30×1일 로그 dbc0ad11 = 1×30일 로그 dbc0ad11
```

판정 해시는 표본 30일·지표·8종 판정 전부를 덮는다. 두 번째 줄은 "측정이 세계를 흔들지 않는다"의 근거다 —
자원 추세를 보려면 하루마다 표본을 떠야 하는데, 그 호출 분할이 결과를 바꾸면 지표 자체를 믿을 수 없다.

## DoD 5 — AI 보조 검사는 꺼도 된다 (§33.2)

```
✓ §33.2 AI 보조 검사 5종 — 켜면 경고만 내고, 꺼도 파이프라인이 완결된다
    꺼짐: 검사 5종 전부 건너뜀 · 이슈 0건 (게이트 영향 없음)
    ✓ audit.axiom-violation    대상 59건 → 지적 0건
    ✓ audit.purposeless-resource 대상 15건 → 지적 2건
    ✓ audit.purposeless-faction  대상  5건 → 지적 0건
    ✓ audit.costless-ability     대상  5건 → 지적 0건
    ✓ audit.isolated-setting     대상 27건 → 지적 2건
    경고(error 로 승격하지 않음): resource.charm, resource.trade_goods, species.veil_moss, species.hollow_swarm
```

AI 가 지적한 넷은 기계가 판정할 수 없는 종류다 — "생산과 소비가 같은 규칙 하나뿐이라 세계 안에서 돌지 않는
자원", "종족 정의가 태그 뒤에 가려져 실행에 닿지 않는 종족". 전부 warning 이고 게이트를 막지 않는다.
입력은 구조화 요약만 싣는다(최대 9448B < 상한 12288B).

## 구현 중 드러난 실패와 처방

| 관측된 실패 | 원인 | 처방 |
|---|---|---|
| 생존 압력의 `targetState`/`failureState` 가 전부 "미등록 상태"로 잡힘 | 두 필드는 상태 키가 아니라 서술문이다(§8) | 상태 참조는 `relievedWhen` 조건에서만 수집 |
| 템플릿 id(`creature.echo_beast_cub`)가 미해결 참조로 잡힘 | 템플릿이 개체 접두사를 쓴다 | 템플릿 id 를 template·entity 두 종류로 선언 |
| 수정 후 `rule.healing_care` 가 처음 발동하면서 런타임이 터짐 | 파생 상태 `stress` 에 쓰기 — 한 번도 발동한 적이 없어 드러나지 않았다 | `state.schema` 검사기에 파생 상태 쓰기 금지를 추가하고 규칙을 수정 |
| 위임 대상을 전 지역으로 넓히자 `faction_id` 조회에서 §9 검증 오류 | `BeliefView.knowsAgent` 가 조직에게도 `faction_id` 를 읽었다 | 조직은 자기 id 가 곧 소속이다 — 갈래를 나눔 (수동 세계 기준선 3시드 전부 불변) |
| 큰 세계에서 행동 종류가 실제보다 적게 세어짐 | change 로그 상한(20000)에 걸려 마지막 며칠만 세고 있었다 | 하루마다 새 change 만 훑는 누적 집계로 교체 |

## 코어 변경 (최소)

Phase 6 은 판정하는 Phase 이므로 코어를 건드리지 않는 것이 원칙이다. 실제 변경은 **한 줄기**뿐이다 —
`BeliefView.knowsAgent` 의 조직 갈래(위 표). 수동 세계 30일 실행은 3개 시드 전부 기준선과 **완전히 동일**하다
(`npm run verify` Phase 2 항목).
