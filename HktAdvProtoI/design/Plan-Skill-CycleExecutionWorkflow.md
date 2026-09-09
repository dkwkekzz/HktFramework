# Plan — Cycle Execution Workflow Skill 작성 계획

상태: 승인 — 스킬 하나(`advprotoi-cycle`) · Play 층 제거 (§7)
원본: [Design-CycleExecutionWorkflow.md](Design-CycleExecutionWorkflow.md) ·
기획 위층: [Design-DesignAuthoringWorkflow.md](Design-DesignAuthoringWorkflow.md) (주입 → 묶음 → 판정 — §7)

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
| 13 | Human 이 추가 추론 없이 성공/실패를 판단할 수 있어야 한다 (§13, §19) | plan/CYCLES.md 판정 질문의 형식(굵은 한 줄 + 무엇을 묻나 + 확인 방법) — 예심 전 원 항목은 하기/보기/판정 |
| 14 | Design→Spec→Semantic/Rule→Impl→검증의 Trace 유지 (§14) | spec.md 머리의 Trace 블록 + 코드의 RULE id + 시나리오 테스트의 SPEC id |
| 15 | Master Graph 는 탐색 도구 — Cycle 공정의 필수 단계가 아니다, Human 이 직접 지정하면 생략 (§15) | 탐색 스킬 없음 — Human 이 기획서를 지목하고 AI 가 묶음을 자른다 (§7) |
| 16 | 별도 Intent 단계 없음 — 정보를 추가하지 않는 단계는 제거 (§16) | 단계 구성 자체 (AdvProtoH 의 8 Stage 를 답습하지 않는다) |
| 17 | Cycle 산출물 최소 4종 + 필요 시 GameView (§17) | §3 산출물 표 — Implementation 은 코드, Verification 은 테스트가 원본 |
| 18 | 확장 Cycle 은 기존 Semantic/Rule 위에 추가 — 복사·재작성 금지, 기존 관찰 가능 행동 유지 (§18) | Spec·구현 단계의 REUSED/ADDED 명시 |
| 19 | 완료 조건 7항 (§19) | 검증 단계의 완료 체크리스트 |

## 2. 스킬 구성 — 하나

문서의 6단계를 스킬 6개로 만들지 않는다. 경계는 **Human 게이트**다 — 게이트는 하나뿐이다: 묶음의 첫 spec 동결("C### 진행" =
묶음 승인 + UNRESOLVED 답). 그래서 스킬도 하나다.

```text
advprotoi-cycle   묶음     "<기획서> 로 묶음 잘라" — 기획서에서 플레이 하나를 잘라 첫 Cycle 의 spec.md 머리에 묶음 블록(Goal · Intent · Breath ·
                          Cycle 목록 · 미지 · 질문)을 쓰고 같은 파일에 첫 spec 을 이어 쓴다. UNRESOLVED 에 묶음 질문 전부 → Human 반환
                  Cycle    "C### 진행" — spec 동결 → 실현(관찰 계약 · 기구/의미 분해 → E ∥ W ∥ V ∥ T fan-out → npm test → 7항)
                          → 마감(촬영 shots/ · plan/ 에 분류해 기입 · 마감 커밋 · 그림 보고 → PR)
                  예심     묶음의 마지막 Cycle 이 합쳐진 뒤 — 관찰 항목을 판정 질문 대여섯으로 압축해 Human 에게 청한다
                  산출물: cycles/C###/spec.md · 코드·시나리오 테스트 커밋 · shots/ · plan/ 의 항목 · codemap/ 의 갱신
```

이렇게 두는 이유:

- **기획서와 Cycle 사이에 문서 층을 두지 않는다.** 옛 Play 문서는 기획서를 다시 쓰고 spec 이 그것을 또 썼다 — 의미의 출처가
  둘이 되어 어긋났고, 승인이 병목이었다. 묶음은 자르기 · 순서 · 게이트 위치 · 판정 단위만 남긴 것이고 spec 의 일부다.
- **묶음 제안과 Cycle 은 같은 AI 가 같은 파일에 이어 쓰는 일이다.** 게이트가 하나면 스킬도 하나다.
- **탐색 스킬은 두지 않는다.** "다음에 무엇을 만들까"는 첫 spec 의 묶음 블록(Cycle 목록)과 plan/CYCLES.md 레인 표가 답하고,
  열린 묶음이 없으면 Human 이 기획서를 지목한다 (plan/DESIGN.md §5 후보 표).

## 3. 산출물 규약

한 Cycle 디렉터리 = `cycles/<CycleId>/` (CycleId: `C###-이름`).
대화 History 는 Source of Truth 가 아니다 — 파일만이 단계 간 인터페이스다.
(이것이 병렬·재개 가능한 Agent 처리의 전제다.)

파일은 둘뿐이다 — **코드 전에 쓰이는 것**(Cycle 폴더의 spec)과 **코드 뒤에 남는 것**(`plan/` 의 관점별 문서 — 모든 Cycle 이 공유한다).
코드가 나온 뒤에 코드를 다시 산문으로 옮기는 문서(구현 노트 · GameView 매핑 표 ·
검증 산문)는 만들지 않는다 — 그 내용의 원본은 코드·테스트·커밋이 이미 소유하고,
어느 Agent 의 입력도 아니다. 병렬 Agent 가 실제로 읽는 파일은 spec 하나다.

| 파일 | 쓰는 이 | 내용 |
|---|---|---|
| `spec.md` | cycle 의 명세 단계가 한 번에 쓴다. 실현 단계는 읽기만 | **범위** (위층 문서 §6): Playable Goal · Experience Intent · World Change · Observable Result · Reuse · Out of Scope. **명세** (CYCLE SPEC + WORLD SEMANTIC/RULE, §4–8): `SPEC-###` 목록 · State(점 경로 · 데이터 값) · Rule(`IF … THEN …` · CHANGED/AFFECTED) · REUSED/ADDED · Observable(점 경로 — 관찰 계약의 원본) · UNRESOLVED(+ 기본형으로 둔 것). UNRESOLVED 가 없으면 **동결** |
| `plan/` — `CYCLES.md` · `DESIGN.md` (`HktAdvProtoI/plan/`), Cycle 폴더가 아니다 | cycle 의 마감이 쓰고, 아래 회수 규칙의 소비자가 지운다 | 관찰 항목(Human 에게) · Human 이 정할 것 · 다음 Cycle 로 → `CYCLES.md` §3 그 묶음 절 · 공학 부채 → `CYCLES.md` §5 · 뒤 층·뒤 묶음으로 → `DESIGN.md` §3 의 그 원본 "남은 것". 절이 비면 절을 지운다. Cycle 마감은 **바로 분류해** 적는다 — Cycle 별 파일을 만들지 않는다 |

**회수 규칙** — 항목의 종류마다 소비자와 시점이 하나씩 고정돼 있다. 어느 공정도 "plan 을 봐 달라" 고
따로 말하지 않는다 — 그 시점이 오면 그 공정이 읽는다.

| 종류 (사는 자리) | 소비자 | 시점 | 처리 |
|---|---|---|---|
| Human 에게 — 판정 질문 (`CYCLES.md` §3 그 묶음 절) | **Human** — 단, AI 예심 뒤 | **묶음 단위** — 그 묶음의 마지막 Cycle 이 합쳐진 직후의 실주행 판정 (위층 문서 §9). Cycle 마다 판정하지 않는다 | Cycle 마감은 Experience Verification 관찰 항목(하기/보기/판정)을 그 Play 절에 쌓는다. Play 의 마지막 Cycle 마감이 **AI 예심**을 한다: 항목을 셋으로 가른다 — A 그림(`shots/`)·테스트가 이미 단언하는 것은 근거를 달아 닫는다(Human 은 표본만 본다) · B 사람 눈이 필요한 것(느낌 · 이해되는가 · 타이밍) · C Human 이 값·규칙을 정할 것. B·C 를 **Play 당 질문 대여섯**으로 압축해 그 절을 바꿔 쓴다. 질문 형식: **굵은 한 줄**(게임 용어 없이 답할 수 있게) + 전제 한 줄(세계가 그것을 **어떻게** 보여 주는지 — "깊이는 바닥 색과 상단 문구로만 보인다" 처럼. 질문이 전제를 숨기면 Human 은 "무슨 말인지 모르겠다" 로 답하게 되고 그것은 판정이 아니다) + 무엇을 묻나 + 확인 방법 + 원 항목 번호. Human 은 그 질문만 답한다. 통과한 질문은 지운다. 실패한 질문은 DESIGN GAP 으로 advprotoi-design 의 주입물이 된다 (위층 문서 §8.5 셋째 주입) |
| Human 이 정할 것 — 결정 대기 (`CYCLES.md` §3 그 묶음 절) | **Human** | 언제든 — 실주행 판정 때 함께 보는 것이 싸다 | 값·규칙·방향의 결정 한 줄씩. §1 의 질문과 겹치지 않는 것만. 정하면 지우고, 결정은 그 값이 사는 자리(데이터 · spec · Play 문서)로 간다 |
| 뒤 층 · 뒤 묶음으로 (`DESIGN.md` §3 그 원본의 "남은 것") | **묶음 제안** (advprotoi-cycle) | 그 층·묶음을 자를 때 입력 | 지금 Cycle 이 받을 수 없는 것(다른 층의 의미 · 다른 Region 의 Play). Cycle 마감이 바로 그 원본 아래에 적고, 기획이 Play 로 받으면 "덮인 것" 으로 옮긴다 |
| 다음 Cycle 로 (`CYCLES.md` §3 그 묶음 절 · 묶음 없는 것은 §4) | **같은 묶음의 다음 Cycle** 명세 단계 | 그 Cycle 의 spec.md 를 쓸 때 — 이 절이 명세 입력이다 | 이번에 받는 것은 SPEC/Reuse 로, 받지 않는 것은 Out of Scope 에 받을 Cycle 을 적는다. 받은 항목은 그 Cycle 을 main 에 합친 직후 지운다 |
| 공학 부채 (`CYCLES.md` §5) | **AI** — 다음 Cycle · ENGINE 레인 · 화면 레인 | 그 자리를 만지는 Cycle 이 갚는다 | 처음 난 자리(C###)를 하나만 적는다. 갚으면 지운다 |

- 항목은 **한 번만** 적힌다 — 처음 난 Cycle 표기 하나로. 뒤 Cycle 이 같은 부채를 만나도 다시 적지 않는다 —
  `C006 → C009 → C016` 식 사슬은 경위이므로 금지 (CLAUDE.md 원칙 10). STATE.md · TODO.md 는 부채를 복제하지 않고 CYCLES.md 를 가리킨다.
- spec 이 침묵해 **테스트가 판정 방식을 스스로 정한 자리**는 plan/ 에 적지 않는다 — 그 시나리오의 단언과 마감 커밋이
  이미 그 선택을 적고 있다. 실제 결정이 걸린 것만 §2 로 올린다.
- 로드맵의 "실제로 플레이되면 행이 닫힌다" 는 곧 그 묶음의 판정 질문이 비는 것이다
  ([content/roadmap/README.md](../content/roadmap/README.md) §4 ③).

만들지 않는 것과 그 내용이 사는 자리:

| 만들지 않는 것 | 원본이 사는 자리 |
|---|---|
| 구현 노트 (변경 파일 · Rule↔코드 매핑 표 · Architecture 변화) | Rule 을 실현하는 함수 머리의 `RULE-*` id 주석 (grep 이 곧 매핑 표) · 커밋(변경 파일) · 기구 추출은 engine 의 분리 커밋 메시지 |
| GameView 매핑 표 | `spec.md` 의 Observable 절 + `content/view` 의 표 자체 |
| 검증 산문 (Given/When/Then · 실측값 · 완료 조건 7항 체크) | 시나리오 테스트 `content/*/tests/<주제>.scenario.spec.ts` (`describe('SPEC-###')` · `it('S-###')`) · 7항 판정과 테스트 수는 마감 커밋 메시지 한 줄 |
| Human 판정 항목 · 부채 | `plan/CYCLES.md` §3 그 묶음 절 · §5 |

`spec.md` 머리에 Trace 블록 하나를 둔다 (절마다 두지 않는다 — 절의 순서가 곧 입력 관계다):

```text
CYCLE          C###-이름
SOURCE         기획서 절 — content/roadmap/L<N>-*.md · M<N>-*.md · design/*.md (+ 묶음의 첫 spec)
SELECTED_FROM  묶음 블록의 Cycle 목록 항목 또는 "Human"
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
                  7항 판정은 마감 커밋 메시지 한 줄 · Human 판정 항목은 plan/CYCLES.md 그 묶음 절
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
   PR 은 Cycle 번호 순으로 합친다. 같은 묶음의 Cycle 은 순차다 (같은 파일을 잇달아 바꾼다).
   다른 묶음의 Cycle 은 spec 의 Reuse/Existing 이 요구하는 Capability 가 main 에 있을 때
   build 를 시작할 수 있다 — plan(문서)은 그 전에도 된다. ENGINE 레인(게임 명사 없는 기구)은
   Cycle 이 아니며 언제나 병행한다. 병렬을 안전하게 하는 규칙 넷:
   ① 공용 표 파일(`regions/graph.ts` · `regions/index.ts` · `view/code-text.ts` ·
      `view/*-presentation.ts` · `world/semantic/world-state.ts` · `protocol/*`)은 Cycle 작업에서
      **항목 추가만** 한다 — 기존 항목을 바꾸는 것은 spec 에 CHANGED 로 적힌 것뿐. 합칠 때
      충돌이 기계적으로 풀린다.
   ② plan/ 과 codemap/ 은 main 에 합친 직후에만 갱신한다 — 브랜치 안에서는 자기
      `cycles/C###/` 만 만진다.
   ③ 시나리오 테스트는 전체 개수를 단언하지 않는다 — 이 Cycle 이 더한 것의 존재와 행동만.
   ④ engine 변경은 분리 커밋으로 먼저 합친다 — 두 Cycle 이 같은 기구를 따로 뽑지 않게.
      기존 engine 계약 변경(ENGINE GAP)은 병렬 중에는 하지 않는다 — Human 승인 뒤 main 에서.
   레인 판정과 plan/CYCLES.md 의 레인 표는 묶음 승인과 합침 직후에 갱신한다. 승인된
   묶음의 Cycle 순서를 깨는 병렬은 제안이 아니라 Human 결정 항목으로 올린다.
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

0. 묶음: Human 이 기획서를 지목하면 첫 Cycle 의 spec.md 머리에 묶음 블록(위층 문서 §5) + 첫 spec + UNRESOLVED(묶음 질문 전부) → Human 반환.
   "C### 진행" 이 승인. 열 질문(컨텐츠 행) · 로드맵의 열린 층 판정은 plan/DESIGN.md 로
1. 시작 조건: plan/CYCLES.md 레인 표에서 "기다리는 것"이 빈 Cycle · 브랜치 `cycle/C###` · 재개 판정(파일이 말한다)
2. 명세 → spec.md 한 번에: 범위(Playable Goal · Intent · World Change · Observable Result · Reuse · Out of Scope)
   + SPEC-### + State/Rule(코드 클래스 금지 · REUSED/ADDED/CHANGED/AFFECTED §18) + Observable(관찰 계약) + UNRESOLVED
   + 범위 게이트(Goal 한두 문장 · SPEC 10항 이내) + Design 침묵의 판정
3. **정지 규칙**: Design 에 없는 의미 → `UNRESOLVED` 기록 후 Human 반환. 수치·시간·확률은 전부 여기 (§5 의
   PerfectGuardWindow 예 그대로) → 없으면 동결
4. 실현: 관찰 계약 확정(protocol/) + 기구/의미 분해(§4.5) → §4 의 fan-out(Agent tool, 단일 메시지 동시 발사 —
   담당 파일 경계 · spec.md · 금지 규칙 · GAP 삼분법) → 통합: npm test → 7항 판정(§19)은 마감 커밋 메시지 한 줄
5. Trace: 모든 R# 에 `RULE-*` id 주석이 달린 함수가 있는지 grep (§9)
6. 마감: 촬영(cycle:shot → shots/) · plan/ 에 분류해 기입 · 그림 보고 → PR. 확장 Cycle 은 기존 관찰
   가능 행동 회귀 검증 포함 (§18, CLAUDE.md 원칙 8). 합친 직후 plan/ · codemap/ 갱신

## 6. 작성 순서

| 순서 | 작업 | 비고 |
|---|---|---|
| 1 | Human 이 이 계획 승인 (§2 의 스킬 하나 · §3 산출물 규약 · §7 의 Play 층 제거) | 완료 |
| 2 | `advprotoi-cycle` SKILL.md 작성 (묶음 모드 포함) | 완료 |
| 3 | CLAUDE.md "작업 공정" 절에 스킬 진입점 등록 | 완료 |
| 4 | 첫 묶음 실주행 (기획서 → 묶음 + 첫 spec → Cycle) → 드러난 마찰만 스킬에 반영 | 공정 검증은 문서가 아니라 실주행 |

## 7. 위층 — 주입 → 묶음 → 판정 (Play 층 없음)

[Design-DesignAuthoringWorkflow.md](Design-DesignAuthoringWorkflow.md) 가 Cycle 공정의 위층이다. 기획서와 Cycle 사이에
문서를 두지 않는다 — 옛 Play Design 문서(`content/roadmap/play/`)와 기획 스킬(`advprotoi-design`)은 제거됐다.

```text
기획서(L<N> · M<N> · design/) → 묶음(첫 Cycle 의 spec.md 머리 블록) → "C### 진행" → Cycle → … → AI 예심 → Human 실주행 판정
```

연결 규칙:

1. **묶음 블록의 Cycle 목록 항목이 cycle 명세 단계의 표준 입력이다.** SOURCE = 기획서 절 (+ 묶음의 첫 spec). Human 이 직접
   Goal 을 지정하는 예외 경로는 유지한다.
2. **첫 spec 의 UNRESOLVED 가 묶음 질문 전부다** — 뒤 Cycle 의 것도 여기서 한 번에 묻는다. 뒤 Cycle 은 그 답을 물려받고
   자기 spec 에서 새로 생긴 의미만 묻는다.
3. **cycle 마감이 plan/ 에 남긴다** — 관찰 항목 · 결정 · 다음 Cycle 로는 `plan/CYCLES.md` 그 묶음 절, 뒤 층으로는 `plan/DESIGN.md`
   그 원본의 "남은 것", 부채는 `plan/CYCLES.md` §5. 묶음의 마지막 Cycle 이 합쳐지면 AI 예심이 관찰 항목을 판정 질문
   대여섯으로 바꿔 쓴다 (§3 회수 규칙).
4. **탐색 스킬 · 관리 artifact 는 없다** — 다음 Cycle 은 묶음 블록이, 다음 묶음은 `plan/DESIGN.md` §5 후보 표와 Human 의 지목이 답한다.
