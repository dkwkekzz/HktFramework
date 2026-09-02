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
| 2 | 단계는 재해석 없이 변환만 한다 (§2) | 공통 원칙 + 각 단계 입력을 직전 Artifact 로 고정 |
| 3 | Design 은 Human 소유 원본 — Agent 는 수정·재해석 금지 (§3, §20) | 공통 원칙 |
| 4 | Design 에 없는 게임 의미는 결정하지 않고 `UNRESOLVED` 로 남긴다 (§5) | Spec·Semantic 단계의 정지 규칙 |
| 5 | World Semantic 은 개념·상태만 — 코드 클래스(Service/Manager) 금지 (§6) | Semantic 단계 Do/Don't |
| 6 | World Rule 은 `상태+사건+조건=새 상태`, Design 언어와 직접 대응 (§7) | Rule 단계 형식 |
| 7 | Semantic 과 Rule 은 한 문서로 묶어도 된다 — 문서 수보다 의미의 명확함 (§8) | 산출물 정의: `02-world.md` 하나 |
| 8 | Implementation 은 Design 과 1:1 불필요, 단 Semantic/Rule 추적은 필수 (§9) | 구현 단계 — 구현 노트에 Rule 매핑 표 |
| 9 | 현재 의미보다 앞서 구현 금지 — 미래 예측 추상화 금지 (§10) | 구현 단계 Don't |
| 10 | 추상화는 실제 Cycle 반복에서 중복이 발견됐을 때만 (§10, §11) | 구현 단계 + 확장 Cycle 규칙 |
| 11 | GameView 는 World State 를 표현만 한다 — 새 의미 생성 금지 (§12) | GameView 단계 Do/Don't |
| 12 | Verification 기준은 코드 구조가 아니라 플레이 결과·World State (§13) | 검증 단계 — Given/When/Then 형식 |
| 13 | Human 이 추가 추론 없이 성공/실패를 판단할 수 있어야 한다 (§13, §19) | 검증 산출물 형식 |
| 14 | Design→Spec→Semantic/Rule→Impl→검증의 Trace 유지 (§14) | 모든 Artifact 머리에 Trace 블록 |
| 15 | Master Graph 는 탐색 도구 — Cycle 공정의 필수 단계가 아니다, Human 이 직접 지정하면 생략 (§15) | Design Authoring 공정이 탐색 자체를 대체 — master 스킬 없음 (§7) |
| 16 | 별도 Intent 단계 없음 — 정보를 추가하지 않는 단계는 제거 (§16) | 단계 구성 자체 (AdvProtoH 의 8 Stage 를 답습하지 않는다) |
| 17 | Cycle 산출물 최소 4종 + 필요 시 GameView (§17) | §3 산출물 표 |
| 18 | 확장 Cycle 은 기존 Semantic/Rule 위에 추가 — 복사·재작성 금지, 기존 관찰 가능 행동 유지 (§18) | Spec·구현 단계의 REUSED/ADDED 명시 |
| 19 | 완료 조건 7항 (§19) | 검증 단계의 완료 체크리스트 |

## 2. 스킬 구성 — 3개로 최소화

문서의 6단계를 스킬 6개로 만들지 않는다. 단계 경계보다 중요한 것은
**"의미를 정하는 일(Human 게이트 필요)"과 "정해진 의미를 실현하는 일(자율·병렬 가능)"**의
경계다. 그 경계로 기획 1개 + 확정 1개 + 실현 1개로 나눈다.

```text
advprotoi-design   기획      주입(방향/기획서) → PLAY DESIGN 구체화 → CYCLE BREAKDOWN
                           산출물: content/roadmap/play/<name>.md · cycles/<CycleId>/00-cycle.md
                           Human 승인은 Play 문서 통짜 1회 (위층 문서 §8.5)

advprotoi-plan     의미 확정  00-cycle.md → CYCLE SPEC → WORLD SEMANTIC + RULE
                           산출물: 01-spec.md · 02-world.md
                           UNRESOLVED 발생 시 여기서 정지 → Human 반환

advprotoi-build    실현·검증  IMPLEMENTATION ∥ GAMEVIEW ∥ 검증 시나리오 작성 → VERIFICATION
                           산출물: 03-impl.md · 04-gameview.md(필요 시) · 05-verification.md
```

이렇게 나누는 이유:

- **plan 은 순차·저비용·Human 대화형이다.** Spec 과 Semantic/Rule 은 서로를 입력으로
  하고 UNRESOLVED 가 터지는 자리라 병렬화 이득이 없다. 한 스킬에서 이어 하면
  문서 로드가 한 번으로 끝난다 (토큰 효율).
- **build 는 자율·병렬이다.** 02-world.md 가 고정되면 World 구현·View 구현·검증
  시나리오는 서로 다른 파일을 만지므로 동시에 진행할 수 있다 (§4).
- **탐색 스킬은 두지 않는다.** "다음에 무엇을 만들까"는 승인된 Play Design 의
  Cycle Breakdown 이 답한다 (§7) — 별도 Master Graph 탐색이 필요 없다.
  Spec 의 Source 는 `design/` 문서면 충분하다.

## 3. 산출물 규약

한 Cycle 디렉터리 = `cycles/<CycleId>/` (CycleId: `C###-이름`).
대화 History 는 Source of Truth 가 아니다 — Artifact 파일만이 단계 간 인터페이스다.
(이것이 병렬·재개 가능한 Agent 처리의 전제다.)

| 파일 | 원본 단계 | 형식 핵심 |
|---|---|---|
| `01-spec.md` | CYCLE SPEC (§4) | **델타만** — 검증 가능한 `SPEC-###` 목록 + `UNRESOLVED`. 범위(Goal·World Change·Out of Scope)는 00-cycle 이 소유하므로 재서술하지 않는다 (§16). 00-cycle 없는 예외 경로에서만 Source·범위 2항을 덧붙인다 |
| `02-world.md` | WORLD SEMANTIC + RULE (§6–8) | State 목록(개념·상태만) + Rule 목록(`IF … THEN …`) + REUSED/ADDED |
| `03-impl.md` | IMPLEMENTATION (§9–11) | 변경 파일 목록 + **Rule ↔ 코드 매핑 표**(Trace) — 코드 자체는 커밋이 소유 |
| `04-gameview.md` | GAMEVIEW (§12) | World State → 표현 매핑 표 (필요한 Cycle 만) |
| `05-verification.md` | VERIFICATION (§13, §19) | Given/When/Then + 실측 결과 + 완료 조건 7항 체크 |

모든 Artifact 머리에 공통 Trace 블록을 둔다:

```text
CYCLE  C###-이름
SOURCE design/Design-….md
PREV   (직전 Artifact 파일명 — 이 파일만이 입력이다)
```

## 4. 병렬 Agent 처리 설계

병렬화는 build 스킬 안에서만 일어난다. plan 은 의도적으로 순차다.

```text
02-world.md 확정 (+ 관찰 계약: World 가 투영할 State 목록)
        │
        ├────────────────┬───────────────────┐
        ▼                ▼                   ▼
  Agent W            Agent V             Agent T
  World 구현         GameView 구현       검증 시나리오 작성
  content/    content/     05-verification.md
  world/ + protocol/ view/               의 Given/When/Then
        │                │                   │
        └────────────────┴───────────────────┘
                         ▼
                  통합: build 본체가 npm test · boundary:check ·
                  시나리오 실행 → 05-verification.md 에 실측 기입
```

병렬이 안전한 근거와 규칙:

1. **파일 경계가 곧 Agent 경계다.** W=`world/`+`protocol/`, V=`view/`, T=`cycles/`.
   기존 boundary:check 가 경계 위반을 기계적으로 잡는다. `protocol/`(관찰 계약)은
   fan-out **전에** build 본체가 02-world.md 로부터 확정해 두 Agent 의 공유 입력으로
   준다 — W·V 가 계약을 서로 다르게 만들지 못하게 하는 유일한 동기화 지점이다.
2. **T 는 구현을 보지 않는다 (Black-box Verification).** 검증 시나리오는
   01-spec.md(무엇을 검증할지) + 02-world.md(어떤 State 를 조작·관측할지)만으로
   쓴다 — 코드·W/V 산출물은 읽지 않는다 (§13 — 검증 기준은 코드 구조가 아니다).
   그래서 구현과 동시에 시작할 수 있고, 구현이 시나리오에 맞추는 방향이 유지된다.
3. **GAP 은 병렬 중에도 지어내지 않는다 — 단, 두 종류를 구분한다.**
   `IMPLEMENTATION GAP`(의미는 충분한데 코드 기반의 기술 기능이 없음)은 Agent/build
   본체가 최소 범위로 구현해 해소한다 — Human 반환 불필요. `DESIGN GAP`(02-world 로
   의미를 결정할 수 없음)만 `GAP` 블록으로 남겨 plan 또는 Human 으로 반환한다.
   기술 결손마다 Human 에게 돌아오는 공정을 막는다.
4. **Cycle 간 병렬 규칙은 아직 두지 않는다** — 한 번에 한 Cycle 이 기본. 실제 필요가
   생기면 그때 세운다 (선행 추상화 금지 §10 을 공정 자신에게도 적용).
5. GameView 가 불필요한 Cycle 이면 V 를 생략한다 — 병렬 구조를 형식적으로 채우지 않는다.

## 4.5 기반/확장 — 기구 추출과 engine/content 정책

기반(engine: 표현·물리·프로토콜 봉투)과 확장(content: 세계 의미·성장·능력)은
**공정 하나 + 기구 추출**로 굴린다. Cycle 이 유일한 공정이고, 구현 요구가 들어올
때마다 기반화할 부분을 그 자리에서 추출해 engine 에 재사용 자산으로 쌓는다.

```text
구현 요구
   │  기구/의미 분해 (build 의 fan-out 전 단일 작업)
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
4. **02-world 의 State/Rule 은 전부 content 의 의미다** — 기반은 게임 명사 없이
   동작한다 (설계 반전 ⑤). plan 은 의미만 적고, 분해는 build 가 한다.
   `boundary:check`(engine→content import 금지)는 모든 커밋에서 통과한다.

## 5. 각 스킬에 담을 내용 (목차 수준)

### advprotoi-plan

1. 작업 디렉토리·경로 규약 (CLAUDE.md 위임 — 중복 기재하지 않음)
2. Cycle 시작: 00-cycle.md(표준) 또는 Human 직접 지정 Goal → CycleId 채번
3. CYCLE SPEC 작성 — **델타만**(SPEC-### + UNRESOLVED, 00-cycle 재서술 금지)
   + 범위 게이트(Playable Goal 을 한두 문장으로 말할 수 있는가 · SPEC 10항 이내)
4. **정지 규칙**: Design 에 없는 의미 → `UNRESOLVED` 기록 후 Human 반환. 수치·시간·
   확률은 전부 여기에 해당한다 (§5 의 PerfectGuardWindow 예 그대로 인용)
5. WORLD SEMANTIC + RULE 작성 — 02-world.md 한 파일, State/Rule 형식, 코드 클래스 금지,
   REUSED/ADDED 구분 (§18)
6. 종료 보고: UNRESOLVED 가 0 이면 "build 가능", 아니면 Human 질의 목록

### advprotoi-build

1. 입력 검사: 01-spec.md · 02-world.md 존재 + UNRESOLVED 0 확인 (아니면 시작 거부)
2. 관찰 계약 확정 (protocol/) — fan-out 전 단일 작업
3. §4 의 3-Agent fan-out (Agent tool, 단일 메시지 동시 발사) — 각 Agent 프롬프트에
   담을 것: 담당 파일 경계 · 02-world.md 전문 · 금지 규칙(선행 추상화 금지 §10,
   의미 생성 금지, GAP 형식)
4. 통합·검증: 테스트 실행 → 05-verification.md 실측 기입 → 완료 조건 7항 (§19) 체크
5. Trace 완성: 03-impl.md 의 Rule↔코드 매핑 표 검수 (§9)
6. 확장 Cycle 규칙: 기존 관찰 가능 행동 회귀 검증 포함 (§18, CLAUDE.md 원칙 8)

### advprotoi-design

목차는 §7 의 연결 규칙과 스킬 본문이 소유한다 — Play Design 7단계 + Human 승인
게이트 + 00-cycle.md 생성.

## 6. 작성 순서

| 순서 | 작업 | 비고 |
|---|---|---|
| 1 | Human 이 이 계획 승인 (특히 §2 의 스킬 분할과 §3 산출물 규약) | 완료 |
| 2 | `advprotoi-plan` · `advprotoi-build` · `advprotoi-design` SKILL.md 작성 | 완료 |
| 3 | CLAUDE.md "작업 공정" 절에 스킬 진입점 등록 | 완료 |
| 4 | 시험 Cycle 1개 실주행 (Play Design 1개 작성 → 첫 Cycle) → 드러난 마찰만 스킬에 반영 | 공정 검증은 문서가 아니라 실주행 |

## 7. 확장 — Design Authoring 위층 (advprotoi-design)

[Design-DesignAuthoringWorkflow.md](Design-DesignAuthoringWorkflow.md) 가 Cycle 공정의
위층으로 승인되면서 기획 스킬(`advprotoi-design`)을 더하고 탐색 스킬
(`advprotoi-master`)을 제거한다. plan·build 의 역할·산출물은 바꾸지 않는다 —
plan 의 입력에 `00-cycle.md` 가 추가될 뿐이다 (원본 확장 규칙 6: "구현 Workflow 는
건드리지 않는다").

```text
advprotoi-design   기획      Game.md/시스템 문서 → content/roadmap/play/<name>.md
                            (Play Goal → Intent → Breath → Structure → World Cause
                             → Capability → Cycle Breakdown, Human 승인 게이트)
                            → cycles/<CycleId>/00-cycle.md
```

연결 규칙:

1. **00-cycle.md 가 plan 의 표준 입력이다.** 01-spec 의 PREV = 00-cycle.md,
   SOURCE = `content/roadmap/play/<name>.md`. 00-cycle 없이 Human 이 직접 Goal 을 지정하는
   예외 경로는 유지한다.
2. **build 마감에 두 가지가 더해진다** — Experience Verification 관찰 항목을
   05-verification.md 에 기입(판정은 Human), 완료 시 play 문서의 Cycle Breakdown
   체크박스 갱신 (play 문서에서 Agent 가 만질 수 있는 유일한 자리).
3. **master 는 제거된다** — 다음 Cycle 은 승인된 Play 의 Cycle Breakdown 이 답한다.
   Play Design 이 하나도 없으면 첫 Play 를 기획하는 것(advprotoi-design)이 곧 탐색이다.
4. Graph 류 관리 artifact 는 만들지 않는다 — Breath·Capability·Cycle 후보는 전부
   해당 play 문서 안에서 관리한다 (위층 문서 §10).
