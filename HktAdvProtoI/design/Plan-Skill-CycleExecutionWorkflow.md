# Plan — Cycle Execution Workflow Skill 작성 계획

상태: 승인 — 스킬 3종(`advprotoi-design` · `advprotoi-plan` · `advprotoi-build`) 작성됨.
`advprotoi-master` 는 Design Authoring 공정 도입으로 제거됨 (§7). 남은 것: 시험 Cycle 실주행과 마찰 반영 (§6 의 4)
원본: [Design-CycleExecutionWorkflow.md](Design-CycleExecutionWorkflow.md) ·
기획 위층: [Design-DesignAuthoringWorkflow.md](Design-DesignAuthoringWorkflow.md) (§7 로 확장 반영)

이 문서는 Design-CycleExecutionWorkflow.md 의 공정을 AI Agent 가 그대로 수행할 수
있도록 `.claude/skills/` 스킬을 어떻게 나누고 무엇을 담을지 정하는 **계획**이다.
스킬 본문은 아직 작성하지 않는다.

## 1. 설계 문서에서 절대 누락하면 안 되는 의도

스킬 본문이 어떤 형태가 되든, 아래 항목은 전부 스킬 규칙으로 살아 있어야 한다.
(괄호는 원본 문서의 절 번호)

| # | 의도 | 스킬에 반영되는 자리 |
|---|---|---|
| 1 | Cycle = 작고 관찰 가능한 플레이 결과 하나 (§1) | Cycle Spec 게이트 — 범위가 크면 쪼개서 반환 |
| 2 | 단계는 재해석 없이 변환만 한다 (§2) | 공통 원칙 + 각 단계 입력을 spec.md 의 직전 절로 고정 |
| 3 | Design 은 Human 소유 원본 — Agent 는 수정·재해석 금지 (§3, §20) | 공통 원칙 |
| 4 | Design 에 없는 게임 의미는 결정하지 않고 `UNRESOLVED` 로 남긴다 (§5) | Spec·Semantic 단계의 정지 규칙 |
| 5 | World Semantic 은 개념·상태만 — 코드 클래스(Service/Manager) 금지 (§6) | Semantic 단계 Do/Don't |
| 6 | World Rule 은 `상태+사건+조건=새 상태`, Design 언어와 직접 대응 (§7) | Rule 단계 형식 |
| 7 | Semantic 과 Rule 은 한 문서로 묶어도 된다 — 문서 수보다 의미의 명확함 (§8) | 산출물 정의: `spec.md` 의 State·Rule 절 (파일 하나 안) |
| 8 | Implementation 은 Design 과 1:1 불필요, 단 Semantic/Rule 추적은 필수 (§9) | 구현 단계 — Rule 을 실현하는 함수에 `RULE-*` id 주석 (grep 이 곧 매핑 표) |
| 9 | 현재 의미보다 앞서 구현 금지 — 미래 예측 추상화 금지 (§10) | 구현 단계 Don't |
| 10 | 추상화는 실제 Cycle 반복에서 중복이 발견됐을 때만 (§10, §11) | 구현 단계 + 확장 Cycle 규칙 |
| 11 | GameView 는 World State 를 표현만 한다 — 새 의미 생성 금지 (§12) | GameView 단계 Do/Don't |
| 12 | Verification 기준은 코드 구조가 아니라 플레이 결과·World State (§13) | 검증 단계 — 시나리오 테스트의 Given/When/Then |
| 13 | Human 이 추가 추론 없이 성공/실패를 판단할 수 있어야 한다 (§13, §19) | TODO.md 의 Human 판정 항목 형식(하기/보기/판정) |
| 14 | Design→Spec→Semantic/Rule→Impl→검증의 Trace 유지 (§14) | spec.md 머리의 Trace 블록 + 코드의 RULE id + 시나리오 테스트의 SPEC id |
| 15 | Master Graph 는 탐색 도구 — Cycle 공정의 필수 단계가 아니다, Human 이 직접 지정하면 생략 (§15) | Design Authoring 공정이 탐색 자체를 대체 — master 스킬 없음 (§7) |
| 16 | 별도 Intent 단계 없음 — 정보를 추가하지 않는 단계는 제거 (§16) | 단계 구성 자체 (AdvProtoH 의 8 Stage 를 답습하지 않는다) |
| 17 | Cycle 산출물 최소 4종 + 필요 시 GameView (§17) | §3 산출물 표 — Implementation 은 코드, Verification 은 테스트가 원본 |
| 18 | 확장 Cycle 은 기존 Semantic/Rule 위에 추가 — 복사·재작성 금지, 기존 관찰 가능 행동 유지 (§18) | Spec·구현 단계의 REUSED/ADDED 명시 |
| 19 | 완료 조건 7항 (§19) | 검증 단계의 완료 체크리스트 |

## 2. 스킬 구성 — 2개로 최소화

문서의 6단계를 스킬 6개로 만들지 않는다. 경계는 **Human 게이트**다 — 게이트가 있는 자리에서만
나눈다. 게이트는 둘뿐이다: Play 승인(기획)과 spec.md 동결(UNRESOLVED). 그래서 기획 1개 +
Cycle 1개다.

```text
advprotoi-design   기획      주입(방향/기획서/미지) → PLAY DESIGN 구체화 → Human 승인 1회 → STATE §1 레인 표
                           산출물: content/roadmap/play/<name>.md · STATE.md §1
advprotoi-cycle    Cycle     명세: cycles/<CycleId>/spec.md 한 파일 — 범위 · SPEC · State/Rule · Observable · UNRESOLVED 를
                           한 번에 쓰고 동결 (UNRESOLVED > 0 이면 정지 → Human)
                           실현: 관찰 계약 · 기구/의미 분해 → E ∥ W ∥ V ∥ T fan-out → npm test → 7항
                           마감: 촬영 shots/ · TODO.md · 마감 커밋 · 그림 보고 → PR
                           산출물: spec.md · 코드·시나리오 테스트 커밋 · TODO.md · shots/
```

이렇게 나누는 이유:

- **design 은 Human 대화형이다.** Play 문서 통짜 승인이 유일한 게이트고, 그 뒤 "다음에 무엇을"은
  레인 표가 답한다. Cycle 범위를 잘라내는 일(옛 00-cycle)은 게이트가 아니므로 design 에 두지
  않는다 — 같은 AI 가 같은 파일에 이어 쓰는 일이라 cycle 의 명세 단계에 속한다.
- **cycle 안의 명세/실현 경계는 스킬이 아니라 spec.md 동결이다.** 명세는 순차·Human 반환형
  (UNRESOLVED), 실현은 자율·병렬(§4)이다. 한 세션에서 이어 도는 것이 전제이므로 호출은 하나면
  된다 — 게이트는 단계 경계로 남는다.
- **탐색 스킬은 두지 않는다.** "다음에 무엇을 만들까"는 승인된 Play Design 의 Cycle Breakdown 과
  STATE §1 레인 표가 답한다 (§7) — 별도 Master Graph 탐색이 필요 없다.

## 3. 산출물 규약

한 Cycle 디렉터리 = `cycles/<CycleId>/` (CycleId: `C###-이름`).
대화 History 는 Source of Truth 가 아니다 — 파일만이 단계 간 인터페이스다.
(이것이 병렬·재개 가능한 Agent 처리의 전제다.)

파일은 둘뿐이다 — **코드 전에 쓰이는 것**(spec)과 **코드 뒤에 남는 것**(TODO).
코드가 나온 뒤에 코드를 다시 산문으로 옮기는 문서(구현 노트 · GameView 매핑 표 ·
검증 산문)는 만들지 않는다 — 그 내용의 원본은 코드·테스트·커밋이 이미 소유하고,
어느 Agent 의 입력도 아니다. 병렬 Agent 가 실제로 읽는 파일은 spec 하나다.

| 파일 | 쓰는 이 | 내용 |
|---|---|---|
| `spec.md` | cycle 의 명세 단계가 한 번에 쓴다. 실현 단계는 읽기만 | **범위** (위층 문서 §6): Playable Goal · Experience Intent · World Change · Observable Result · Reuse · Out of Scope. **명세** (CYCLE SPEC + WORLD SEMANTIC/RULE, §4–8): `SPEC-###` 목록 · State(점 경로 · 데이터 값) · Rule(`IF … THEN …` · CHANGED/AFFECTED) · REUSED/ADDED · Observable(점 경로 — 관찰 계약의 원본) · UNRESOLVED(+ 기본형으로 둔 것). UNRESOLVED 가 없으면 **동결** |
| `TODO.md` | cycle 의 마감이 쓰고, Human·다음 Cycle 이 지운다 | Human 판정 대기(Experience Verification 관찰 항목 — 하기/보기/판정) · 알려진 부채 · 다음 Cycle 로 넘긴 것. 항목이 다 지워지면 파일을 지운다 — `spec.md` 만 남은 디렉터리가 깨끗이 닫힌 Cycle 이다. 남길 것이 없으면 만들지 않는다 |

만들지 않는 것과 그 내용이 사는 자리:

| 만들지 않는 것 | 원본이 사는 자리 |
|---|---|
| 구현 노트 (변경 파일 · Rule↔코드 매핑 표 · Architecture 변화) | Rule 을 실현하는 함수 머리의 `RULE-*` id 주석 (grep 이 곧 매핑 표) · 커밋(변경 파일) · 기구 추출은 engine 의 분리 커밋 메시지 |
| GameView 매핑 표 | `spec.md` 의 Observable 절 + `content/view` 의 표 자체 |
| 검증 산문 (Given/When/Then · 실측값 · 완료 조건 7항 체크) | 시나리오 테스트 `content/*/tests/<주제>.scenario.spec.ts` (`describe('SPEC-###')` · `it('S-###')`) · 7항 판정과 테스트 수는 마감 커밋 메시지 한 줄 |
| Human 판정 항목 | `TODO.md` |

`spec.md` 머리에 Trace 블록 하나를 둔다 (절마다 두지 않는다 — 절의 순서가 곧 입력 관계다):

```text
CYCLE          C###-이름
SOURCE         content/roadmap/play/<PlayName>.md (+ 근거 문서)
SELECTED_FROM  Play Cycle Breakdown 항목 또는 "Human"
```

## 4. 병렬 Agent 처리 설계

병렬화는 cycle 의 실현 단계 안에서만 일어난다. 명세 단계는 의도적으로 순차다.

```text
spec.md 동결 (Observable 절 = 관찰 계약)
        │
        ├────────────────┬───────────────────┐
        ▼                ▼                   ▼
  Agent W            Agent V             Agent T
  World 구현         GameView 구현       시나리오 테스트 작성
  content/world/     content/view/       content/*/tests/<주제>.scenario.spec.ts
  + regions/ + protocol/                 (spec 만 보고 — 기존 하네스로)
        │                │                   │
        └────────────────┴───────────────────┘
                         ▼
                  통합: cycle 본체가 npm test · boundary:check →
                  7항 판정은 마감 커밋 메시지 한 줄 · Human 판정 항목은 TODO.md
```

병렬이 안전한 근거와 규칙:

1. **파일 경계가 곧 Agent 경계다.** W=`world/`+`regions/`, V=`view/`, T=`*.scenario.spec.ts`.
   기존 boundary:check 가 경계 위반을 기계적으로 잡는다. `protocol/`(관찰 계약)은
   fan-out **전에** cycle 본체가 spec.md 의 Observable 절로부터 확정해 두 Agent 의 공유 입력으로
   준다 — W·V 가 계약을 서로 다르게 만들지 못하게 하는 유일한 동기화 지점이다.
2. **T 는 구현을 보지 않는다 (Black-box Verification).** 시나리오 테스트는
   spec.md 만으로 쓴다 (SPEC = 무엇을 검증할지 · State/Rule/Observable = 어떤 State 를
   조작·관측할지) — 새 코드·W/V 산출물은 읽지 않고 기존 하네스 API 만 쓴다 (§13 —
   검증 기준은 코드 구조가 아니다). 하네스로 놓을 수 없는 Given 은 `it.todo('GAP: …')`
   로 남겨 통합에서 푼다. 그래서 구현과 동시에 시작할 수 있고, 구현이 시나리오에
   맞추는 방향이 유지된다. 전체 개수는 단언하지 않는다 — 이 Cycle 이 더한 것만.
3. **GAP 은 병렬 중에도 지어내지 않는다 — 단, 두 종류를 구분한다.**
   `IMPLEMENTATION GAP`(의미는 충분한데 코드 기반의 기술 기능이 없음)은 Agent/cycle
   본체가 최소 범위로 구현해 해소한다 — Human 반환 불필요. `DESIGN GAP`(spec 으로
   의미를 결정할 수 없음)만 `GAP` 블록으로 남겨 plan 또는 Human 으로 반환한다.
   기술 결손마다 Human 에게 돌아오는 공정을 막는다.
4. **Cycle 간 병렬 — 의미 의존성이 병목이고, 파일 충돌은 규칙으로 푼다.**
   한 Cycle = 브랜치 하나(`cycle/C###`) = 세션 하나. plan → build 를 그 안에서 돌리고,
   PR 은 Cycle 번호 순으로 합친다. 같은 Play 의 Cycle 은 순차다 (같은 파일을 잇달아 바꾼다).
   다른 Play 의 Cycle 은 spec 의 Reuse/Existing 이 요구하는 Capability 가 main 에 있을 때
   build 를 시작할 수 있다 — plan(문서)은 그 전에도 된다. ENGINE 레인(게임 명사 없는 기구)은
   Cycle 이 아니며 언제나 병행한다. 병렬을 안전하게 하는 규칙 넷:
   ① 공용 표 파일(`regions/graph.ts` · `regions/index.ts` · `view/code-text.ts` ·
      `view/*-presentation.ts` · `world/semantic/world-state.ts` · `protocol/*`)은 Cycle 작업에서
      **항목 추가만** 한다 — 기존 항목을 바꾸는 것은 spec 에 CHANGED 로 적힌 것뿐. 합칠 때
      충돌이 기계적으로 풀린다.
   ② STATE.md 와 Play 의 체크박스는 main 에 합친 직후에만 갱신한다 — 브랜치 안에서는 자기
      `cycles/C###/` 만 만진다.
   ③ 시나리오 테스트는 전체 개수를 단언하지 않는다 — 이 Cycle 이 더한 것의 존재와 행동만.
   ④ engine 변경은 분리 커밋으로 먼저 합친다 — 두 Cycle 이 같은 기구를 따로 뽑지 않게.
      기존 engine 계약 변경(ENGINE GAP)은 병렬 중에는 하지 않는다 — Human 승인 뒤 main 에서.
   레인 판정과 STATE.md §1 의 레인 표는 design 이 소유한다 (advprotoi-design ③). 승인된
   Play 순서를 깨는 병렬은 제안이 아니라 Human 결정 항목으로 올린다.
5. GameView 가 불필요한 Cycle 이면 V 를 생략한다 — 병렬 구조를 형식적으로 채우지 않는다.

## 4.5 기반/확장 — 기구 추출과 engine/content 정책

기반(engine: 표현·물리·프로토콜 봉투)과 확장(content: 세계 의미·성장·능력)은
**공정 하나 + 기구 추출**로 굴린다. Cycle 이 유일한 공정이고, 구현 요구가 들어올
때마다 기반화할 부분을 그 자리에서 추출해 engine 에 재사용 자산으로 쌓는다.

```text
구현 요구
   │  기구/의미 분해 (cycle 실현 단계의 fan-out 전 단일 작업)
   ├────────────────────────────┐
   ▼                            ▼
기구 → engine (Agent E)      의미 → content (Agent W·V)
게임 명사 없이 성립하는       이 세계의 이름과 규칙을 아는 부분.
그리기·배치·입력·판정 구조.   engine 기구에 명사·데이터를 공급해 조립한다
이후 Cycle·다른 컨텐츠가 재사용
```

정책 4개:

1. **분해 판정은 명사 벗기기다.** 구현할 코드에서 게임 명사(stone·wolf·
   worldPressure)를 전부 벗겨도 남는 동작이 기구 → engine. 벗기면 아무것도 남지
   않는 코드(의미와 얽힌 Rule 로직)는 통째로 content. 예: "칸 격자에 아이콘과
   수량을 그린다" = 기구(타일뷰), "이 칸은 stone 이고 채광으로 늘어난다" = 의미.
2. **추출 기구의 기능 범위는 이번 사용처가 정한다.** 확장 축(옵션·변형)은 그것을
   실제로 쓰는 다음 사용처의 Cycle 에서 넓힌다. 추출 전에 기존 engine 기구 목록을
   훑어 이미 있는 것은 재사용한다. engine 커밋은 content 커밋과 분리한다.
3. **기존 engine 계약의 변경은 ENGINE GAP 으로 Human 승인을 거친다.** 새 기구를
   더하는 것은 Cycle 안 E 의 정상 작업이고, 기존 export 의 시그니처·의미·스냅샷
   형태를 바꾸는 것(다른 사용처에 영향)만 승인 대상이다. 기존 관찰 가능 행동은
   유지한다 (§18).
4. **spec 의 State/Rule 은 전부 content 의 의미다** — 기반은 게임 명사 없이
   동작한다 (설계 반전 ⑤). 명세는 의미만 적고, 분해는 실현이 한다.
   `boundary:check`(engine→content import 금지)는 모든 커밋에서 통과한다.

## 5. 각 스킬에 담을 내용 (목차 수준)

### advprotoi-cycle

1. 시작 조건: STATE §1 레인 표에서 "기다리는 것"이 빈 Cycle · 브랜치 `cycle/C###` · 재개 판정(파일이 말한다)
2. 명세 → spec.md 한 번에: 범위(Playable Goal · Intent · World Change · Observable Result · Reuse · Out of Scope)
   + SPEC-### + State/Rule(코드 클래스 금지 · REUSED/ADDED/CHANGED/AFFECTED §18) + Observable(관찰 계약) + UNRESOLVED
   + 범위 게이트(Goal 한두 문장 · SPEC 10항 이내) + Design 침묵의 판정
3. **정지 규칙**: Design 에 없는 의미 → `UNRESOLVED` 기록 후 Human 반환. 수치·시간·확률은 전부 여기 (§5 의
   PerfectGuardWindow 예 그대로) → 없으면 동결
4. 실현: 관찰 계약 확정(protocol/) + 기구/의미 분해(§4.5) → §4 의 fan-out(Agent tool, 단일 메시지 동시 발사 —
   담당 파일 경계 · spec.md · 금지 규칙 · GAP 삼분법) → 통합: npm test → 7항 판정(§19)은 마감 커밋 메시지 한 줄
5. Trace: 모든 R# 에 `RULE-*` id 주석이 달린 함수가 있는지 grep (§9)
6. 마감: 촬영(cycle:shot → shots/) · TODO.md(Human 판정 대기 · 부채) · 그림 보고 → PR. 확장 Cycle 은 기존 관찰
   가능 행동 회귀 검증 포함 (§18, CLAUDE.md 원칙 8). 합친 직후 Play 체크박스 · STATE 갱신

### advprotoi-design

목차는 §7 의 연결 규칙과 스킬 본문이 소유한다 — Play Design 7단계 + Human 승인
게이트 + STATE §1 레인 표.

## 6. 작성 순서

| 순서 | 작업 | 비고 |
|---|---|---|
| 1 | Human 이 이 계획 승인 (특히 §2 의 스킬 분할과 §3 산출물 규약) | 완료 |
| 2 | `advprotoi-cycle` · `advprotoi-design` SKILL.md 작성 | 완료 |
| 3 | CLAUDE.md "작업 공정" 절에 스킬 진입점 등록 | 완료 |
| 4 | 시험 Cycle 1개 실주행 (Play Design 1개 작성 → 첫 Cycle) → 드러난 마찰만 스킬에 반영 | 공정 검증은 문서가 아니라 실주행 |

## 7. 확장 — Design Authoring 위층 (advprotoi-design)

[Design-DesignAuthoringWorkflow.md](Design-DesignAuthoringWorkflow.md) 가 Cycle 공정의
위층으로 승인되면서 기획 스킬(`advprotoi-design`)을 더하고 탐색 스킬
(`advprotoi-master`)을 제거한다. Cycle 공정의 역할·산출물은 바꾸지 않는다 —
cycle 의 명세 단계 입력이 승인된 Play 의 Cycle Breakdown 한 항목이 될 뿐이다 (원본 확장 규칙 6:
"구현 Workflow 는 건드리지 않는다").

```text
advprotoi-design   기획      L0-Game.md/시스템 문서 → content/roadmap/play/<name>.md
                            (Play Goal → Intent → Breath → Structure → World Cause
                             → Capability → Cycle Breakdown, Human 승인 게이트)
                            → STATE.md §1 레인 표 (다음에 할 Cycle)
```

연결 규칙:

1. **Play 의 Cycle Breakdown 한 항목이 cycle 명세 단계의 표준 입력이다.** spec.md 의 범위 절(옛
   00-cycle)은 그 항목을 잘라 cycle 이 쓴다 — design 은 쓰지 않는다. SOURCE = `content/roadmap/play/<name>.md`.
   Human 이 직접 Goal 을 지정하는 예외 경로는 유지한다.
2. **cycle 마감에 두 가지가 더해진다** — Experience Verification 관찰 항목을
   TODO.md 에 기입(판정은 Human — 판정 후 지운다), 완료 시 play 문서의 Cycle Breakdown
   체크박스 갱신 (play 문서에서 Agent 가 만질 수 있는 유일한 자리).
3. **master 는 제거된다** — 다음 Cycle 은 승인된 Play 의 Cycle Breakdown 이 답한다.
   Play Design 이 하나도 없으면 첫 Play 를 기획하는 것(advprotoi-design)이 곧 탐색이다.
4. Graph 류 관리 artifact 는 만들지 않는다 — Breath·Capability·Cycle 후보는 전부
   해당 play 문서 안에서 관리한다 (위층 문서 §10).
