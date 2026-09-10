---
name: advprotoi-cycle
description: HktAdvProtoI 공정의 셋째 단계 — Cycle 구현. "C### 진행" = (기획서의 첫 Cycle 이면 Cycle 목록 승인이자) spec 동결 → 승인 기입(plan/) → 실현(관찰 계약 + 기구/의미 분해 → E ∥ W ∥ V ∥ T fan-out → npm test → 7항) → 마감(촬영 shots/ · plan/ 기입 · 커밋 · 보고). 뒤 Cycle 은 spec 초안을 앞 마감의 「다음 Cycle 로」 로 다듬어 자기 차례에 동결한다. 기반 Cycle 은 제공 · 작동 · 손잡이(경험은 데이터로)로 닫고 경험을 판정하지 않는다. 기획서의 마지막 Cycle 뒤 예심: 컨텐츠 Cycle 은 관찰 항목을 판정 질문 대여섯으로 · 기반 Cycle 은 기반 검토 항목을 기반 질문 서넛으로. 정지는 UNRESOLVED 와 DESIGN/ENGINE GAP 뿐. spec 을 새로 쓰는 것은 advprotoi-spec, 기획서 주입은 advprotoi-inject 다 — 이 스킬은 spec 이 있어야 시작한다. 사용자가 "C### 진행 / 다음 Cycle 진행 / Cycle 돌려 / AdvProtoI 진행 / 예심 / 기반 검토" 를 요청하면 사용.
---

# HktAdvProtoI Cycle — 동결 → 실현 → 마감 → 예심

**작업 디렉토리: `HktAdvProtoI/`**. 공정 원본은
[design/Design-CycleExecutionWorkflow.md](../../../HktAdvProtoI/design/Design-CycleExecutionWorkflow.md) (Cycle) 과
[design/Design-DesignAuthoringWorkflow.md](../../../HktAdvProtoI/design/Design-DesignAuthoringWorkflow.md) §7~§9 (게이트 · 판정) —
어긋나면 원본이 이긴다. 경로 규약·기반/컨텐츠 경계·GAP 형식은 `HktAdvProtoI/CLAUDE.md`. 지금 어디까지 왔는가는 `plan/STATE.md`.

공정 셋 중 셋째다. 앞의 둘은 파일로만 만난다 — `advprotoi-inject`(기획서가 `content/roadmap/` 에) · `advprotoi-spec`(`cycles/C###/spec.md` 가
동결 후보 또는 초안으로). **spec 이 없으면 이 스킬은 시작하지 않는다** — "<기획서> 로 spec 써" 를 보고하고 멈춘다. spec 의 형식과 의미 규칙은
`advprotoi-spec` §2 가 소유한다 — 여기서는 인용만 한다.

이 스킬의 입구는 둘이다 — 말이 고른다:

```text
"C### 진행"              §0~§3 Cycle — (기획서의 첫 Cycle 이면 Cycle 목록 승인이자) spec 동결 → 승인 기입 → 실현 → 마감
"예심" / 마지막 Cycle 합침   §3 끝 — 기획서의 관찰 항목을 판정 질문 대여섯으로(컨텐츠 Cycle) · 기반 검토 항목을 기반 질문 서넛으로(기반 Cycle) 압축해 Human 에게 청한다
```

**Cycle 의 종류는 행이 가른다** (원본 §21 — 공정은 하나 · 완료를 재는 것이 다르다). 이 스킬의 모든 절에서 "기반 Cycle" 로 표시된 규칙은 행이 L<N> 일 때만 적용된다.

```text
기반 Cycle   행 = L<N>.  세우는 것은 축 — 게임 명사 없는 기구(engine) + 컨텐츠가 데이터로 채우는 계약 + 그것을 표현할 예제 하나.
           닫는 것은 셋 — 제공(계약이 codemap 에 섰다) · 작동(모듈마다 테스트 · 검사 · 도구가 단언한다) · 손잡이(경험을 가르는 값 · 문구 · 표시 · 배치가
           전부 데이터이고 하나를 바꾸면 행동이 따라 바뀐다 — 코드 diff 0). 경험은 판정하지 않는다 — 손잡이로 내려가 그 축을 처음 쓰는 컨텐츠 행의 Cycle 이 판정한다.
컨텐츠 Cycle  행 = M<N> · 실주행 GAP 회수.  플레이 하나 · 경험의 전환 · 관찰 항목 · 실주행 판정 — 아래 절의 기본 규칙 그대로.
```

Cycle 디렉터리 `cycles/<CycleId>/` 에 두는 것은 둘뿐이다 — `spec.md`(코드 전, 동결) · `shots.json` + `shots/`
(마감 촬영). 코드 뒤에 남는 것은 **`plan/` 의 관점별 문서**에 쓴다 — 관찰 항목 · 결정 · 다음 Cycle 로 · 뒤 층 · 뒤 기획서로는 `plan/DESIGN.md` §3 그 기획서 절,
공학 부채는 `plan/CYCLES.md` §4 (모든 Cycle 이 공유 · Cycle 별 파일 없음). 그 밖의 문서(구현 노트 · GameView 표 · 검증 산문)는 만들지 않는다 — 원본은 코드 주석의 `RULE-*` id ·
`content/view` 의 표 · 시나리오 테스트 · 커밋 메시지다. 대화 History 는 Source of Truth 가 아니다 — 파일만이 단계 간
인터페이스다.

두 단계의 경계는 **spec.md 동결**이다. 명세는 의미를 정하며 Human 에게 멈춰 돌아가고(UNRESOLVED),
실현은 정해진 의미를 자율·병렬로 옮긴다. 정지 지점은 그 둘뿐이다:

```text
UNRESOLVED > 0   (명세)   Design 에 없는 게임 의미 → Human 질의 목록을 올리고 멈춘다
DESIGN GAP       (실현)   spec 으로 의미를 결정할 수 없음 → GAP 블록을 올리고 멈춘다
ENGINE GAP       (실현)   기존 engine 계약 변경 필요 → 승인 요청을 올리고 그 부분만 멈춘다
```

## 0. 시작 조건

1. **Cycle** — Human 이 `C###` 을 지정하면 그것. 아니면 plan/CYCLES.md §1 레인 표에서 "기다리는 것"이 빈
   첫 레인의 Cycle. "기다리는 것"이 남은 Cycle 은 시작하지 않고 보고한다 (Human 결정 줄의 것은
   Human 이 정한 뒤에만). CycleId 는 첫 spec 의 CYCLES 목록이 정한 번호 그대로 (`C###-이름`). 열린 기획서가 없으면 "<기획서> 로 spec 써"(advprotoi-spec) 를 보고하고 멈춘다.
2. **브랜치** — `cycle/C###` (없으면 main 에서 만든다 — 1.5 의 승인 기입 뒤에). 브랜치 안에서 만지는 것은 자기
   `cycles/C###/` 와 코드뿐 — plan/ · codemap/ 은 main 에 합친 직후에만 (§4).
3. **재개** — `spec.md` 가 동결돼 있으면 1 을 건너뛰고 2 부터. `spec.md` 가 없으면 시작하지 않는다. `shots/` 와 마감 커밋이 있으면
   "닫힘 — 합침 대기" 보고로 끝난다. 판정은 파일이 말한다.

## 1. 동결 — spec.md 를 받아 닫는다 (쓰는 것은 advprotoi-spec)

입력은 `cycles/C###-이름/spec.md` — 기획서의 첫 Cycle 이면 Trace 에 CYCLES 목록이 있는 **동결 후보**, 뒤 Cycle 이면 **초안**. 그리고 Human 이 "C### 진행" 과
함께 준 **답**, 뒤 Cycle 이면 **`plan/DESIGN.md` §3 그 기획서 절의「다음 Cycle 로」**(판정 질문은 읽지 않는다 — 그것은 기획서 단위 Human 몫이다).
spec 의 형식 · 의미 규칙(Design 침묵의 판정 · 범위 게이트 · 확장 Cycle · 코드 구조 금지 · 기반 Cycle 의 경험 값은 Data Knobs)은
[advprotoi-spec §2](../advprotoi-spec/SKILL.md) 그대로다 — 여기서 다시 쓰지 않는다.

1. **답 반영** — UNRESOLVED 의 항목마다 Human 답을 그 자리(State 값 표 · Rule · 검사)에 옮기고 목록에서 지운다.
   답이 기획서에 없던 세계관 사실이면 먼저 `content/roadmap/` 그 행의 문서에 Human 의 문장으로 덧붙인다 (Design 에 반영됐음을 확인한 뒤 spec 에).
2. **「다음 Cycle 로」 회수** (뒤 Cycle) — 항목을 하나씩 판정한다: 이번 Cycle 이 받는 것은 SPEC/Reuse 로, 받지 않는 것은 Out of Scope 에 받을 Cycle 을
   적는다 (받을 Cycle 이 없으면 결정 대기 · DESIGN.md 남은 것 · CYCLES.md 부채 중 맞는 자리로 옮긴다). 회수 규칙의 원본은 Plan-Skill §3. 초안 머리의
   "초안" 표시를 지운다.
3. **범위 게이트 재확인** — Playable Goal 한두 문장 · SPEC 열 항 이내. 답을 받으며 커졌으면 쪼개 후보를 내고 Human 선택을 받는다.
4. **판정** —
   `UNRESOLVED = 없음` → **동결**. 이후 아무도 고치지 않는다 (의미를 바꿔야 하면 새 Cycle). 바로 1.5 로.
   `UNRESOLVED > 0` → 목록을 Human 질의로 올리고 **정지**. 답이 오면 1 부터 다시.

### 1.5 승인 기입 — 기획서의 첫 Cycle 이면 main 에서 `plan/` 을 갱신한다

"C### 진행" 이 Cycle 목록 승인이다. 동결 직후, 브랜치를 만들기 **전에** main 에서 — `CYCLES.md` §1 레인 한 줄 ·
`DESIGN.md` §1/§2 의 그 행 · §3 그 기획서 절의 "덮음"(Cycle 목록 · 상태) · "남은 것" → "덮인 것"(이 Cycle 들이 받은 절) · §5 에서 삭제 ·
`STATE.md` §0 · §2 · §3 · `TODO.md` §1 · §2. 뒤 Cycle 은 게이트가 없다 — 첫 spec 의 답을 물려받고, 기입은 §3 마감의 것뿐이다.
Human 직접 Goal 의 Cycle(SELECTED_FROM = "Human")은 그 SOURCE 기획서 절의 "덮음" 에 한 줄.

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
  따른다. State → 표현의 대응은 `content/view` 의 표 자체가 원본이다. 기반 Cycle 이면 예제 하나만 보이게 하고,
  경험을 가르는 것(문구 · 표기 · 어느 코드를 세우나 · 순서)은 spec 의 Data Knobs 가 지목한 **표**에 둔다 — 함수 안의 상수로 두지 않는다.
- **T**: **Black-box** — 읽는 것은 spec.md 뿐 (SPEC = 무엇을 · State/Rule/Observable = 어떤 State 를).
  새 코드·W/V 결과는 보지 않고 **기존 하네스**(createWorld · driveWorld · 관찰 봉투 · 기존
  spec/fixture 선례)만 쓴다. 하네스로 놓을 수 없는 Given 은 `it.todo('GAP: …')`.
  형식: `describe('SPEC-00x <이름>')` 안 `it('S-0xx <한 줄>')` — Given/When/Then 을 주석으로,
  단언은 spec 의 점 경로로. REUSED/AFFECTED 의 기존 행동(회귀)도 `describe('회귀')` 로.
  **전체 개수를 단언하지 않는다** — 이 Cycle 이 더한 것의 존재와 행동만. spec 이 침묵해 판정 방식을
  정해야 했던 자리는 보고에 목록으로. 기반 Cycle 이면 `describe('손잡이')` 를 둔다 — Data Knobs 하나를 바꾼
  데이터(변형 방 · 변형 표 — 선례 `c004` 의 `VARIANT_ROOM`)로 세계를 세워 행동이 따라 바뀜을 단언한다 (손잡이 SPEC · 코드 0).

### 2.3 통합·검증

1. GAP 처리 — IMPLEMENTATION GAP 은 본체가 최소 범위로 해소 · ENGINE GAP 은 모아 Human 승인 뒤 분리
   커밋 · DESIGN GAP 은 모아 Human 반환(정지). 해소 전에는 완료로 표시하지 않는다.
2. T 의 `it.todo('GAP: …')` 를 푼다 — 하네스 보강(IMPLEMENTATION GAP)으로 실제 테스트로, 자동으로
   놓을 수 없는 것만 Human 실주행 항목(plan/DESIGN.md §3 그 기획서 절)으로.
3. `npm test` · `npm run build`. 실측은 **테스트 결과**다 — 산문으로 옮기지 않는다.
4. 확장 Cycle 이면 REUSED Rule 의 기존 시나리오 재실행 (원본 §18 · 원칙 8).

## 3. 마감

**완료 조건 7항** (원본 §19) 을 판정하고 결과를 **마감 커밋 메시지 한 줄**로 적는다
(예: `시나리오 33/33 PASS · 7항 충족 · Human 판정 대기 8`). 문서에 체크리스트를 남기지 않는다.

```text
Design Trace / Scope / Semantic / Rule   spec.md 의 SOURCE · Playable Goal(기반: Foundation Goal) · State · Rule
Implementation                           모든 R# 에 RULE id 주석이 달린 함수가 있다 (grep)
Observable                               관찰 계약 + V 의 표 (기반: 검사 JSON · observe 보고 · 봉투가 먼저 — 화면은 예제 하나)
Verification                             시나리오 테스트 전부 PASS + plan/DESIGN.md §3 그 기획서 절의 관찰 항목
                                         (기반: + 손잡이 SPEC · 명사 0 SPEC PASS + Module Check 의 모듈마다 단언이 있다 + 기반 검토 항목)
```

7항 전부 + 시나리오 전부 PASS 여야 완료다. 미달이면 미완 항목과 반환 대상을 보고하고 완료
선언하지 않는다. 기반 Cycle 은 셋을 더 본다 — **제공**(Added 의 기구 · 계약이 codemap 에 적힐 형인가) · **작동**(Module Check 의 모듈마다
단언이 하나 이상인가) · **손잡이**(Data Knobs 의 줄마다 자리가 실제 데이터 · 표인가 — 함수 안의 상수면 미달).

**관찰 촬영** — Observable Result 를 실제 게임에서 찍어 Human 에게 보여준다. 기반 Cycle 은 **예제 한 장**(둘까지)만 찍는다 —
나머지 증거는 테스트 · `world:check` · `world:observe --report` 이고, 화면이 안 바뀌면 찍지 않는다. `cycles/<CycleId>/shots.json`
(형식은 `tools/cycle-shot/shot.cjs` 머리 주석 — run 마다 `spawn` · `npcs` · 걸음) →
`npm run cycle:shot cycles/<CycleId>/shots.json` → `shots/*.png`. 파일명은 관찰 항목 번호
(X-##). 도구는 판정하지 않는다 — expect 는 기록이다. 소프트웨어 GPU 라 걷기가 이어지지 않으므로
먼 자리는 `spawn`, 자율 존재가 방해하면 `npcs: "none"` (둘 다 `vite.config.ts` 의 검증용 손잡이 —
세계 규칙은 그대로). 그림에 안 보이는 결과(State 값)는 테스트가 증거다 — 억지로 찍지 않는다.

**`plan/` 기입** — 코드 뒤에 남는 것은 `plan/` 의 관점별 문서에 쓴다 (`HktAdvProtoI/plan/`). Cycle 별 파일을 만들지
않는다. 이 Cycle 이 남기는 것을 **바로 분류해** 적는다 (형식은 그 파일의 머리와 기존 항목을 따른다):

```text
DESIGN.md §3 그 기획서 절  관찰 항목 — Experience Verification (하기/보기/그림 cycles/C###/shots/X-##/판정[ ]). spec 의 Experience Intent 와
                         Observable Result 에서 뽑는다. 판정은 Human 몫 — 판정 칸은 비워 둔다
                         기반 Cycle 은 관찰 항목 대신 **기반 검토 항목** — F-# 모듈 · 제공(계약이 codemap 어디에) · 작동(무엇이 단언하나 — 테스트 id · 검사 번호 · 도구) ·
                         손잡이(데이터 자리 — 없으면 "—") · 판정[ ]. spec 의 Module Check 와 Data Knobs 에서 뽑는다. 예제 그림은 그 줄에 링크
                         결정 대기 — 이 Cycle 이 Human 결정으로 돌린 값·규칙·방향 (spec 의 기본형으로 둔 것 중 실제 결정이 걸린 것).
                         기반 Cycle 은 **계약 결정만**(형 · 축 · 경계) — 경험 값(문구 · 표기 · 표시 여부 · 임계 · 배치)은 여기 올리지 않고 손잡이로 내린다
                         다음 Cycle 로 — spec 이 침묵해 테스트가 피해 간 자리 · 이월한 관측 (T 의 보고에서) · 받을 Cycle
DESIGN.md §3 (같은 절)  뒤 층 · 뒤 기획서로 — 이 Cycle 이 받을 수 없어 다른 층·다른 Region 의 Cycle 로 보내는 것 → 그 원본 기획의 "남은 것" 에 받는 자리와 함께.
                         기획서의 **원문 절** 단위로 뒤 층에 보내는 것이면 그 층의 content/roadmap/L<N>-Handoff.md 로 옮기고(글자 그대로 · 자리에 포인터) 남은 것에는 "→ L<N>-Handoff §…" 만
                         기반 Cycle 이 손잡이로 내린 경험의 판정("읽히는가 · 이 값이 맞는가")도 여기 — 받는 자리는 "그 축을 처음 쓰는 컨텐츠 행의 Cycle"
CYCLES.md §4            공학 부채 — 기구·도구·촬영의 결손 — "C###" 표기 하나
codemap/CONTENT.md      경험 손잡이 표 — 기반 Cycle 의 Data Knobs 를 축 · 손잡이 · 자리로 (합친 직후 · Cycle 번호 없이 · 현재 상태만)
```

회수 규칙 (Plan-Skill §3) — 항목은 **한 번만** 적힌다. 앞 Cycle 의 부채를 이 Cycle 이 다시 만났어도 다시 적지
않는다 (`C006 → C009 → C016` 식 사슬 금지 — 원칙 10). 테스트가 판정 방식을 스스로 정한 자리는 적지 않는다
(시나리오 단언과 마감 커밋이 그것을 소유한다) — 실제 결정이 걸린 것만 결정 대기로.

**마감 보고** — Human 이 보는 유일한 결과다. 그림(`shots/*.png` 를 SendUserFile 로) · 판정 한 줄 ·
plan/ 에 적은 항목 수 · "PR 을 올려 번호 순으로 합친다". 공정 설명을 반복하지 않고, 다음 Cycle 을 이어
시작하지 않는다 — 합침이 먼저다.

**합친 직후 (main 에서)** — `plan/DESIGN.md` §3 그 기획서 절에서 이 Cycle 의 spec 이 받은「다음 Cycle 로」항목을 지우고 상태 줄(어느 Cycle 까지 닫혔나)을 고친다 ·
`plan/CYCLES.md` §1 레인 표에서 이 Cycle 을 지우고 이것을 기다리던 레인의 "기다리는 것"을 비운다 · `plan/STATE.md` §0 트랙 표 · §2 · §3 과
`plan/TODO.md` §3 의 그 줄 · `codemap/ENGINE.md` · `codemap/CONTENT.md` 에 **API 나 구조가 바뀐 것만** 한 줄씩 (새 기구 · 새 State · 새 Rule id · 새 방 —
Cycle 번호 없이). 현재 상태만 — 경위를 쌓지 않는다 (원칙 10).

**기획서의 마지막 Cycle 이면 — AI 예심** — Human 에게 항목 전부를 읽히지 않는다. `plan/DESIGN.md` §3 그 기획서 절의 관찰 항목을
셋으로 가른다: **A** 그 항목의 `cycles/C###/shots/X-##.png` 를 실제로 열어 보거나 지목된 시나리오 테스트가 단언해 이미
닫힌 것 (지운다 — 근거는 마감 커밋 메시지에 · 그림이 항목과 불일치하면 CYCLES.md §4 촬영 부채로) · **B** 사람 눈이 필요한 것
(느낌 · 읽히는가 · 타이밍 · 걸어야 아는 것) · **C** Human 이 값·규칙을 정할 것. B·C 를 **기획서당 질문 대여섯**으로 압축해
그 절을 **판정 질문**으로 **바꿔 쓴다** (번호는 `<기획서 약칭>-N` — 기획서 사이에 겹치지 않게). 질문 형식: **굵은 한 줄** — 게임 내부 용어 없이, "예/아니오/값" 으로 답할 수 있게 · **전제** 한 줄 — 세계가 그것을
어떻게 보여 주는지("깊이는 바닥 색과 상단 문구로만 보인다") — 전제를 숨긴 질문은 "무슨 말인지 모르겠다" 를 돌려받고
그것은 판정이 아니다 · 무엇을 묻나 (왜 사람이 봐야 하는지 두세 문장) · 확인 방법 (`npm run dev` 자리 · 손잡이 · 견줄
그림 한 줄) · 원 항목 번호. Human 이 "알아서 확인해 봐" 로 위임한 질문은 Agent 가 지금 빌드를 실제로 띄워(촬영 하네스)
보고 판정한다 — 옛 그림으로 답하지 않는다.
받을 Cycle 이 없는 부채는 결정 대기 · DESIGN.md 남은 것 · CYCLES.md 부채로 옮긴다. `plan/DESIGN.md` §3 그 기획서 절을 "판정 대기 — 질문 N" 으로 올리고
`plan/STATE.md` §0 · §2 와 `plan/TODO.md` §1 의 Human 판정 줄이 그것을 링크하게 하여
Human 에게 청한다. 통과는 지우고, 실패는 DESIGN GAP 이 되어 실주행 GAP 회수(advprotoi-spec §1 — 이 기획서에 Cycle 을 더하거나 관찰 가능성 Cycle 하나로)가 된다.
그 절의 질문이 비면 로드맵의 행이 닫힌다 — Agent 는 A 만 닫고 B·C 는 판정하지 않는다.

**기반 층 기획서의 마지막 Cycle 이면 — AI 기반 예심** (실주행 예심 대신 · 원본 §21) — 그 기획서 절의 **기반 검토 항목**을 셋으로 가른다:
**A** 테스트 id · 검사 번호 · grep · 도구 출력이 단언하는 것 — 실제로 `npm test` · `npm run world:check` 를 돌려 확인하고 지운다 (근거는 마감 커밋) ·
**B** 계약 판단 — 축이 기획서의 자리(여덟 자리 · 계약 표)에 맞게 섰는가 · 경계 — 무엇을 기반에 두지 않았는가가 맞는가 · **손잡이 표가 컨텐츠 작업에 충분한가** ·
**C** 계약 결정 — 결정 대기의 형 · 축 · 경계. B·C 를 **기획서당 기반 질문 서넛**으로 압축해 그 절을 바꿔 쓴다 (번호 `<기획서 약칭>-N`).
질문 형식은 판정 질문과 같되 — **전제**는 "계약이 어디에 어떻게 서 있는가"(codemap 의 줄 · 손잡이 표의 줄) · **확인 방법**은 codemap 절 ·
`npm run world:check` · 손잡이 하나를 바꿔 보는 명령 · 예제 그림 한 장. **경험 질문은 만들지 않는다** — "읽히는가 · 느낌 · 이 값이 맞는가" 가
항목에 남아 있으면 손잡이로 내리고(codemap 손잡이 표 한 줄 · 기본값 그대로) DESIGN.md §3 그 원본의 "남은 것" 에 "그 축을 처음 쓰는 컨텐츠 Cycle 이
판정" 으로 이월한다. 상태는 "검토 대기 — 기반 질문 N". Human 은 걷지 않는다 — 계약 표 · 손잡이 표 · 검사 결과를 읽고 답한다 (예제를 띄워 보는 것은 선택).
실패는 ENGINE GAP(기구 · 계약) 또는 DESIGN GAP(기획서의 자리)이 되어 이 기획서에 Cycle 을 더한다. 질문이 비면 행이 닫힌다.

## 4. Cycle 간 병렬 (Plan-Skill §4 항목 4)

한 Cycle = 브랜치 `cycle/C###` = 세션 하나. 어느 레인이 돌 수 있는지는 plan/CYCLES.md §1 이 답한다.

```text
① 공용 표 파일(regions/graph.ts · regions/index.ts · view/code-text.ts · view/*-presentation.ts ·
   world/semantic/world-state.ts · protocol/*)은 항목 추가만 — 기존 항목 변경은 spec 의 CHANGED 뿐
② plan/ · codemap/ 은 main 에 합친 직후에만 — 브랜치 안에서는 자기 cycles/C###/ 만
③ 시나리오 테스트는 전체 개수를 단언하지 않는다
④ engine 커밋은 분리해 먼저 합친다 · 기존 engine 계약 변경(ENGINE GAP)은 병렬 중 금지
⑤ 같은 기획서의 Cycle 은 순차 · 다른 기획서의 Cycle 은 spec 의 Reuse/Existing 이 main 에 있을 때 병행 · ENGINE 레인은 언제나 병행
```
