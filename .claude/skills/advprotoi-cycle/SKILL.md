---
name: advprotoi-cycle
description: HktAdvProtoI 의 Cycle 하나를 끝까지 돌린다 — 명세(cycles/<CycleId>/spec.md 한 파일에 범위 · SPEC · State/Rule · Observable 을 한 번에 쓰고 동결. Design 에 없는 게임 의미는 UNRESOLVED 로 정지·Human 반환) → 실현(관찰 계약 확정 + 기구/의미 분해 → E(engine) ∥ W(World) ∥ V(GameView) ∥ T(시나리오 테스트) 병렬 fan-out → npm test → 완료 조건 7항) → 마감(촬영 shots/ · TODO.md · 마감 커밋 · 그림 보고). 정지는 UNRESOLVED 와 DESIGN/ENGINE GAP 뿐. 시작 전 STATE.md §1 레인 표와 브랜치 cycle/C### 을 확인한다. 사용자가 "C### 진행 / 다음 Cycle 진행 / Cycle 돌려 / AdvProtoI 진행 / build 진행" 을 요청하면 사용.
---

# HktAdvProtoI Cycle — 명세 → 실현 → 마감

**작업 디렉토리: `HktAdvProtoI/`**. 공정 원본은
[design/Design-CycleExecutionWorkflow.md](../../../HktAdvProtoI/design/Design-CycleExecutionWorkflow.md) —
어긋나면 원본이 이긴다. 경로 규약·기반/컨텐츠 경계·GAP 형식은 `HktAdvProtoI/CLAUDE.md`.

Cycle 디렉터리 `cycles/<CycleId>/` 에 두는 것은 셋뿐이다 — `spec.md`(코드 전, 동결) · `TODO.md`
(코드 뒤, 비면 삭제) · `shots.json` + `shots/`(마감 촬영). 그 밖의 문서(구현 노트 · GameView 표 ·
검증 산문)는 만들지 않는다 — 원본은 코드 주석의 `RULE-*` id · `content/view` 의 표 · 시나리오
테스트 · 커밋 메시지다. 대화 History 는 Source of Truth 가 아니다 — 파일만이 단계 간 인터페이스다.

두 단계의 경계는 **spec.md 동결**이다. 명세는 의미를 정하며 Human 에게 멈춰 돌아가고(UNRESOLVED),
실현은 정해진 의미를 자율·병렬로 옮긴다. 정지 지점은 그 둘뿐이다:

```text
UNRESOLVED > 0   (명세)   Design 에 없는 게임 의미 → Human 질의 목록을 올리고 멈춘다
DESIGN GAP       (실현)   spec 으로 의미를 결정할 수 없음 → GAP 블록을 올리고 멈춘다
ENGINE GAP       (실현)   기존 engine 계약 변경 필요 → 승인 요청을 올리고 그 부분만 멈춘다
```

## 0. 시작 조건

1. **Cycle** — Human 이 `C###` 을 지정하면 그것. 아니면 STATE.md §1 레인 표에서 "기다리는 것"이 빈
   첫 레인의 Cycle. "기다리는 것"이 남은 Cycle 은 시작하지 않고 보고한다 (Human 결정 줄의 것은
   Human 이 정한 뒤에만). CycleId 는 Play 의 Cycle Breakdown 이 정한 번호 그대로 (`C###-이름`).
2. **브랜치** — `cycle/C###` (없으면 main 에서 만든다). 브랜치 안에서 만지는 것은 자기
   `cycles/C###/` 와 코드뿐 — STATE.md · Play 체크박스는 main 에 합친 직후에만 (§4).
3. **재개** — `spec.md` 가 동결돼 있으면 1 을 건너뛰고 2 부터. `TODO.md` 와 마감 커밋이 있으면
   "닫힘 — 합침 대기" 보고로 끝난다. 판정은 파일이 말한다.

## 1. 명세 → `spec.md` (한 번에 쓰고 동결)

입력은 승인된 Play 문서(`content/roadmap/play/<PlayName>.md`)의 Cycle Breakdown 한 항목과
그 Play 의 §5 Play Structure · §6 Required Capability · 확정 사항, 그리고 그것들이 지목한
`content/roadmap/*.md` · `design/` 문서다. Play 를 재해석하지 않는다 — 이번 것만 잘라 검증
가능한 문장으로 **폐쇄**한다. 코드는 보지 않는다 (Existing 판정은 CLAUDE.md "코드에 있는 것" +
기존 `cycles/*/spec.md` 의 ADDED 로).

```text
# C### — <이름>
CYCLE / SOURCE / SELECTED_FROM   Trace 블록 하나 (SOURCE = Play 문서 + 근거 문서 · SELECTED_FROM = Breakdown 항목 또는 "Human")

## Playable Goal        이번에 성립할 플레이 결과 한두 문장 — 완료를 직접 확인 가능
## Experience Intent    Start / End — Play 의 Breath 중 이 Cycle 이 만드는 구간
## World Change         세계에서 무엇이 어떻게 변하는가 (번호 목록)
## Observable Result    화면/상태에서 무엇을 직접 확인하는가 (번호 목록)
## Reuse                Existing(그대로 쓴다) / Added(이 Cycle 이 세운다 — World · Protocol · Data · View · Engine)
## Out of Scope         이번에 하지 않는 것과 그것을 받을 Cycle
## SPEC                 SPEC-001 … — World Change·Observable Result 를 참·거짓을 가릴 문장으로 폐쇄.
                        각 항은 조건 하나 + 기대 하나, 경계(성립하지 않는 경우)도 최소 한 항
## State                존재와 상태를 점 경로로 (Wolf.knowledge.fireDanger 식) + 이 Cycle 의 데이터 값 표
## Rule                 R1, R2… — IF <상태 + 사건 + 조건> THEN <새 상태>. Design 의 언어와 직접 대응.
                        기존 Rule 은 CHANGED(전제/전이 변경) / AFFECTED(대상 집합만) 로 표시
## REUSED / ADDED       REUSED(이름만 인용 · 재정의 금지) · ADDED · CHANGED · AFFECTED
## Observable (관찰 계약)  투영할 State 를 점 경로로 열거 — 실현 단계가 그대로 protocol/ 로 옮긴다.
                        투영하지 않는 것도 한 줄 (그것이 Play 의 미지감인 경우가 많다)
## UNRESOLVED           Design 에 없어 결정하지 못한 의미 (없으면 "없음") + 기본형으로 둔 것의 목록
```

규칙 (원본 §4–8 · §20):

- **Design 은 Human 소유 원본** — 수정·재해석하지 않고 더 구체적인 형태로 변환만 한다.
- **Design 에 없는 게임 의미는 결정하지 않는다.** 수치·시간·확률·허용 범위·세계관 사실이 전부
  여기 해당한다 (Design 이 "공격 직전 Guard = Perfect Guard" 라고만 하면
  `PerfectGuardWindow = 0.2 sec` 은 기획이지 구현이 아니다) → UNRESOLVED.
- **Design 침묵의 판정** — 이번 Cycle 이 성립하는 데 그 답이 **필요하면** UNRESOLVED, 답 **없이도
  성립하면** Out of Scope 로 돌리고 기본형(기존 Rule 그대로 · Design 이 준 이름만)으로 둔다.
  기본형으로 둔 것은 UNRESOLVED 아래 목록으로 — Human 이 감사할 자리다.
- **범위 게이트** — Playable Goal 을 한두 문장으로 말할 수 없거나 SPEC 이 열 항을 넘으면 크다.
  쪼개 후보를 내고 Human 선택을 받는다.
- **확장 Cycle** (원본 §18) — 기존 `cycles/*/spec.md` 의 Semantic/Rule 을 복사·재작성하지 않고
  그 위에 추가함을 SOURCE 에 적는다.
- **금지** (원본 §6) — Service · Repository · Manager · Component 같은 코드 구조를 여기 쓰지 않는다.
  모든 State/Rule 은 컨텐츠의 의미다 — 기반(engine)은 게임 명사를 모른다. 기구 추출은 2 의 몫.
- 컨텐츠 층 Play(미지)의 Cycle 이면 README §4 열 질문의 답이 Play 에 있는지 본다 — 없으면 UNRESOLVED.

`UNRESOLVED = 없음` → **동결**. 이후 아무도 고치지 않는다 (의미를 바꿔야 하면 새 Cycle). 바로 2 로.
`UNRESOLVED > 0` → 목록을 Human 질의로 올리고 **정지**. Human 답을 (Design 에 반영됐음을 확인한 뒤)
반영하고 재개한다.

## 2. 실현 — 관찰 계약 · 분해 · fan-out · 통합

`engine/` 수정은 아래 **기구 추출** 경로로만 — `npm run boundary:check`(engine→content import 금지)는
항상 통과한다.

### 2.1 관찰 계약 확정 + 기구/의미 분해 (fan-out 전 단일 작업)

**관찰 계약**: spec.md 의 Observable 절을 `content/protocol/` 로 옮긴다 — **기계적 변환**이어야 하며,
여기서 투영 대상을 새로 판단하게 되면 spec 의 결손이다 (DESIGN GAP). 컨텐츠를 조립에 잇는 자리는
`content/active*.ts` 뿐이다.

**기구/의미 분해**: 구현 요구를 둘로 나눈다.

```text
기구 (→ engine)    게임 명사 없이 성립하는 구조 — 그리기·배치·입력·수치 처리·순회.
                   "칸 격자에 아이콘과 수량을 그린다" · "영역이 위치를 포함하는지 판정한다"
의미 (→ content)   이 세계의 이름과 규칙을 아는 부분 — "이 칸은 stone 이고 채광으로 늘어난다"
```

판정은 명사 벗기기다 — 게임 명사를 전부 벗겨도 남는 동작이 기구, 벗기면 아무것도 남지 않는 코드
(의미와 얽힌 Rule 로직)는 통째로 content. 기구의 기능 범위는 **이번 사용처가 쓰는 만큼** — 확장
축은 다음 사용처의 Cycle 이 넓힌다. 이미 engine 에 있으면 재사용한다 (추출 전에 목록을 훑는다).
분해 결과로 **기구의 API(형·시그니처)를 여기서 선언**한다 — 관찰 계약과 함께 병렬 Agent 의
동기화 지점이다.

### 2.2 병렬 fan-out (E ∥ W ∥ V ∥ T)

Agent tool 로 **한 메시지에 동시 발사**한다. 각 프롬프트에: 담당 파일 경계 · `spec.md` 경로 ·
확정된 관찰 계약 · 선언된 기구 API · 아래 공통 금지 규칙.

```text
Agent E  기구 추출·구현     engine/ — 선언한 API 를 게임 명사 없이 구현 (+ engine 테스트). 새 기구가 없으면 생략.
                           커밋은 content 와 분리한다
Agent W  World 구현        content/world/ + content/regions/ — 기구 API 에 명사·데이터를 공급해 조립
Agent V  GameView 구현     content/view/ — World State 를 표현만 한다. 기구 API 로 그린다. 불필요하면 생략
Agent T  시나리오 테스트    content/world/tests/<주제>.scenario.spec.ts (+ view 검증은 content/view/tests/) —
                           spec 만 보고 쓰는 black-box 테스트
```

공통 금지 규칙 (각 프롬프트에 그대로):

- **코드 배치** — 2.1 의 분해를 따른다. 게임 명사를 아는 코드는 전부 content.
- **의미 생성 금지 + GAP 삼분법** — `IMPLEMENTATION GAP`(의미는 충분한데 content 코드에 기술
  기능이 없음)은 Agent 가 그 자리에서 최소 범위로 구현한다 · `ENGINE GAP`(기존 engine export 의
  시그니처·의미·스냅샷 형태 변경 — 다른 사용처에 영향)은 보고에 블록을 남기고 그 부분만 미완
  (새 기구를 **더하는** 것은 E 의 정상 작업) · `DESIGN GAP`(spec 으로 의미를 결정할 수 없음)은
  지어내지 말고 CLAUDE.md `GAP` 블록을 남기고 그 부분만 미완.
- **선행 추상화 금지** (원본 §10) — 현재 Rule 실행에 필요한 최소 구조만. Provider/Strategy/
  Pipeline/Registry 를 미리 만들지 않는다. 추상화는 실제 반복이 드러났을 때만, 기존 관찰 가능
  행동을 유지하는 리팩터링으로만 (§11 · §18).
- 담당 경계 밖 파일을 만지지 않는다. Agent 는 문서를 만들지 않는다 — 결과는 채팅 보고로.

Agent 별 규칙:

- **E**: 이름·데이터는 매개변수와 제네릭으로 받는다. 구현한 기구 목록(무엇을 · 어떤 요구에서)을
  보고한다 — engine 커밋 메시지의 재료다.
- **W**: State 변경은 World Rule 의 Transition 에서만 (원칙 4). 팩 시스템은 `engine/physics`
  솔버를 조합한다. **Rule ↔ 코드 Trace 는 코드 주석** — 각 R# 를 실현하는 함수 머리에 `RULE-…`
  id 를 한국어 주석으로. grep 이 곧 매핑 표다. R# 전부가 어느 함수에 닿는지 보고한다.
- **V**: 새 의미를 만들지 않는다 (원본 §12). `view/resolve.ts` · `code-text.ts` 등 팩 계약 자리를
  따른다. State → 표현의 대응은 `content/view` 의 표 자체가 원본이다.
- **T**: **Black-box** — 읽는 것은 spec.md 뿐 (SPEC = 무엇을 · State/Rule/Observable = 어떤 State 를).
  새 코드·W/V 결과는 보지 않고 **기존 하네스**(createWorld · driveWorld · 관찰 봉투 · 기존
  spec/fixture 선례)만 쓴다. 하네스로 놓을 수 없는 Given 은 `it.todo('GAP: …')`.
  형식: `describe('SPEC-00x <이름>')` 안 `it('S-0xx <한 줄>')` — Given/When/Then 을 주석으로,
  단언은 spec 의 점 경로로. REUSED/AFFECTED 의 기존 행동(회귀)도 `describe('회귀')` 로.
  **전체 개수를 단언하지 않는다** — 이 Cycle 이 더한 것의 존재와 행동만. spec 이 침묵해 판정 방식을
  정해야 했던 자리는 보고에 목록으로.

### 2.3 통합·검증

1. GAP 처리 — IMPLEMENTATION GAP 은 본체가 최소 범위로 해소 · ENGINE GAP 은 모아 Human 승인 뒤 분리
   커밋 · DESIGN GAP 은 모아 Human 반환(정지). 해소 전에는 완료로 표시하지 않는다.
2. T 의 `it.todo('GAP: …')` 를 푼다 — 하네스 보강(IMPLEMENTATION GAP)으로 실제 테스트로, 자동으로
   놓을 수 없는 것만 Human 실주행 항목(TODO.md)으로.
3. `npm test` · `npm run build`. 실측은 **테스트 결과**다 — 산문으로 옮기지 않는다.
4. 확장 Cycle 이면 REUSED Rule 의 기존 시나리오 재실행 (원본 §18 · 원칙 8).

## 3. 마감

**완료 조건 7항** (원본 §19) 을 판정하고 결과를 **마감 커밋 메시지 한 줄**로 적는다
(예: `시나리오 33/33 PASS · 7항 충족 · Human 판정 대기 8`). 문서에 체크리스트를 남기지 않는다.

```text
Design Trace / Scope / Semantic / Rule   spec.md 의 SOURCE · Playable Goal · State · Rule
Implementation                           모든 R# 에 RULE id 주석이 달린 함수가 있다 (grep)
Observable                               관찰 계약 + V 의 표
Verification                             시나리오 테스트 전부 PASS + TODO 의 관찰 항목
```

7항 전부 + 시나리오 전부 PASS 여야 완료다. 미달이면 미완 항목과 반환 대상을 보고하고 완료
선언하지 않는다.

**관찰 촬영** — Observable Result 를 실제 게임에서 찍어 Human 에게 보여준다. `cycles/<CycleId>/shots.json`
(형식은 `tools/cycle-shot/shot.cjs` 머리 주석 — run 마다 `spawn` · `npcs` · 걸음) →
`npm run cycle:shot cycles/<CycleId>/shots.json` → `shots/*.png`. 파일명은 TODO 의 판정 항목 번호
(X-##). 도구는 판정하지 않는다 — expect 는 기록이다. 소프트웨어 GPU 라 걷기가 이어지지 않으므로
먼 자리는 `spawn`, 자율 존재가 방해하면 `npcs: "none"` (둘 다 `vite.config.ts` 의 검증용 손잡이 —
세계 규칙은 그대로). 그림에 안 보이는 결과(State 값)는 테스트가 증거다 — 억지로 찍지 않는다.

**`TODO.md`** — 코드 뒤에 남는 유일한 문서. 살아 있는 문서다: 항목이 닫히면 지우고, 다 지워지면
파일을 지운다. 남길 것이 없으면 만들지 않는다.

```text
# C### — TODO
## Human 판정 대기 — Experience Verification
   spec 의 Experience Intent(Start/End) 와 Observable Result 를 실주행 관찰 항목으로 — 실행 방법 +
   항목마다 하기/보기/그림(shots/…)/판정[ ]. 판단은 Human 몫 (위층 문서 §7) — 판정 칸은 비워 둔다
## 알려진 부채          이 Cycle 이 남긴 것과 그것을 받을 Cycle
## 다음 Cycle 로        spec 이 침묵해 테스트가 피해 간 자리 · 이월한 관측 (T 의 보고에서)
```

**마감 보고** — Human 이 보는 유일한 결과다. 그림(`shots/*.png` 를 SendUserFile 로) · 판정 한 줄 ·
TODO 항목 수 · "PR 을 올려 번호 순으로 합친다". 공정 설명을 반복하지 않고, 다음 Cycle 을 이어
시작하지 않는다 — 합침이 먼저다.

**합친 직후 (main 에서)** — Play 문서의 Cycle Breakdown 체크박스만 `[x]` (Play 문서에서 Agent 가
만지는 유일한 자리 · Play 의 모든 Cycle 이 닫혔으면 "Play Goal 실주행 확인"을 Human 에게 제안) ·
STATE.md §2 진행 · §4 코드에 있는 것 · §5 부채(TODO.md 를 가리킨다) · §1 레인 표에서 이 Cycle 을
지우고 이것을 기다리던 레인의 "기다리는 것"을 비운다. 현재 상태만 — 경위를 쌓지 않는다 (원칙 10).

## 4. Cycle 간 병렬 (Plan-Skill §4 항목 4)

한 Cycle = 브랜치 `cycle/C###` = 세션 하나. 어느 레인이 돌 수 있는지는 STATE.md §1 이 답한다.

```text
① 공용 표 파일(regions/graph.ts · regions/index.ts · view/code-text.ts · view/*-presentation.ts ·
   world/semantic/world-state.ts · protocol/*)은 항목 추가만 — 기존 항목 변경은 spec 의 CHANGED 뿐
② STATE.md · Play 체크박스는 main 에 합친 직후에만 — 브랜치 안에서는 자기 cycles/C###/ 만
③ 시나리오 테스트는 전체 개수를 단언하지 않는다
④ engine 커밋은 분리해 먼저 합친다 · 기존 engine 계약 변경(ENGINE GAP)은 병렬 중 금지
```
