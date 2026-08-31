# Plan — Cycle Execution Workflow Skill 작성 계획

상태: 승인 — 스킬 3종(`advprotoi-plan` · `advprotoi-build` · `advprotoi-master`) 작성됨. 남은 것: 시험 Cycle 실주행과 마찰 반영 (§6 의 4–5)
원본: [Design-CycleExecutionWorkflow.md](Design-CycleExecutionWorkflow.md)

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
| 15 | Master Graph 는 탐색 도구 — Cycle 공정의 필수 단계가 아니다, Human 이 직접 지정하면 생략 (§15) | 별도 스킬로 분리, Cycle 스킬은 의존하지 않음 |
| 16 | 별도 Intent 단계 없음 — 정보를 추가하지 않는 단계는 제거 (§16) | 단계 구성 자체 (AdvProtoH 의 8 Stage 를 답습하지 않는다) |
| 17 | Cycle 산출물 최소 4종 + 필요 시 GameView (§17) | §3 산출물 표 |
| 18 | 확장 Cycle 은 기존 Semantic/Rule 위에 추가 — 복사·재작성 금지, 기존 관찰 가능 행동 유지 (§18) | Spec·구현 단계의 REUSED/ADDED 명시 |
| 19 | 완료 조건 7항 (§19) | 검증 단계의 완료 체크리스트 |

## 2. 스킬 구성 — 3개로 최소화

문서의 6단계를 스킬 6개로 만들지 않는다. 단계 경계보다 중요한 것은
**"의미를 정하는 일(Human 게이트 필요)"과 "정해진 의미를 실현하는 일(자율·병렬 가능)"**의
경계다. 그 경계로 2개 + 탐색 1개로 나눈다.

```text
advprotoi-master   (선택)  Master Graph 탐색 — 다음에 무엇을 만들까 → Frontier 후보 제시
                           Human 이 직접 Cycle 을 지정하면 아예 쓰지 않는다 (§15)

advprotoi-plan     의미 확정  DESIGN(읽기 전용) → CYCLE SPEC → WORLD SEMANTIC + RULE
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
- **master 는 공정 밖이다** (§15). Cycle 스킬이 master 산출물을 요구하면 안 된다 —
  Spec 의 Source 는 `design/` 문서면 충분하다.

## 3. 산출물 규약

한 Cycle 디렉터리 = `cycles/<CycleId>/` (CycleId: `C###-이름`).
대화 History 는 Source of Truth 가 아니다 — Artifact 파일만이 단계 간 인터페이스다.
(이것이 병렬·재개 가능한 Agent 처리의 전제다.)

| 파일 | 원본 단계 | 형식 핵심 |
|---|---|---|
| `01-spec.md` | CYCLE SPEC (§4) | Source / 이번에 성립시킬 것 / 하지 않을 것 / 검증 방법 + `UNRESOLVED` 목록 |
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
  content/<pack>/    content/<pack>/     05-verification.md
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

## 5. 각 스킬에 담을 내용 (목차 수준)

### advprotoi-plan

1. 작업 디렉토리·경로 규약 (CLAUDE.md 위임 — 중복 기재하지 않음)
2. Cycle 시작: Human 지정 Goal 또는 master Frontier → CycleId 채번
3. CYCLE SPEC 작성 — 4항 표 + 범위 게이트("한 문장으로 성립 결과를 말할 수 있는가")
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

### advprotoi-master

1. §15 의 탐색 사다리 (World/Actor → Goal → Possibility → Capability → Missing → Frontier)
2. Frontier 후보 제시까지만 — 선택은 Human, 선택 결과는 01-spec.md 의 Source 로만 전달
3. Cycle 산출물을 되읽어 재해석하지 않는다 (§15 — "이후 구현은 Master Graph 를 다시 해석하지 않는다")

## 6. 작성 순서

| 순서 | 작업 | 비고 |
|---|---|---|
| 1 | Human 이 이 계획 승인 (특히 §2 의 2+1 분할과 §3 산출물 규약) | |
| 2 | `advprotoi-plan` SKILL.md 작성 | 가장 먼저 — 의미 게이트가 공정의 심장 |
| 3 | `advprotoi-build` SKILL.md 작성 | fan-out 프롬프트 템플릿 포함 |
| 4 | 시험 Cycle 1개 실주행 (기존 design/ 의 작은 항목, 예: 막기 계열 최소 조각) | 공정 검증은 문서가 아니라 실주행 |
| 5 | 실주행에서 드러난 마찰만 스킬에 반영, `advprotoi-master` 작성 | 추상화는 반복에서 — 스킬 자신에게도 §10 적용 |
| 6 | CLAUDE.md "작업 공정" 절에 스킬 진입점 등록 | |
