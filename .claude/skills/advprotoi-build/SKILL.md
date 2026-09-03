---
name: advprotoi-build
description: HktAdvProtoI 의 Cycle 실현·검증 단계를 실행한다 — 입력 검사(cycles/<CycleId>/spec.md 동결 · UNRESOLVED 0) → 관찰 계약 확정 + 기구/의미 분해(기구=engine 추출·의미=content) → E(기구) ∥ W(World) ∥ V(GameView) ∥ T(시나리오 테스트) 병렬 fan-out → 통합·npm test → 완료 조건 7항 판정 → TODO.md(Human 판정 대기·부채) + 마감 커밋. 문서 산출물은 TODO.md 뿐 — 구현 노트·GameView 표·검증 산문을 만들지 않는다. Design 에 없는 의미가 필요해지면 GAP 으로 반환하고 지어내지 않는다. 사용자가 "AdvProtoI 구현 / Cxxx build / Cycle 구현 진행 / build 진행 / 검증 진행" 을 요청하면 사용.
---

# HktAdvProtoI Cycle Build — 실현·검증 (IMPL ∥ GAMEVIEW ∥ 검증)

**작업 디렉토리: `HktAdvProtoI/`**. 공정 원본은
[design/Design-CycleExecutionWorkflow.md](../../../HktAdvProtoI/design/Design-CycleExecutionWorkflow.md) —
어긋나면 원본이 이긴다. 경로 규약·기반/컨텐츠 경계·GAP 형식은 `HktAdvProtoI/CLAUDE.md`.
`engine/` 수정은 아래 **기구 추출** 경로로만 한다 — `npm run boundary:check`
(engine→content import 금지)는 항상 통과해야 한다.

입력은 `cycles/<CycleId>/spec.md` 하나다 (앞부분 = 범위와 Experience Intent, 뒷부분 =
SPEC · State · Rule · REUSED/ADDED · Observable · UNRESOLVED). 산출물은 **코드·테스트
커밋**과 `cycles/<CycleId>/TODO.md` 다. 그 밖의 문서(구현 노트 · Rule↔코드 매핑 표 ·
GameView 매핑 표 · 검증 산문)는 만들지 않는다 — 원본은 코드 주석의 `RULE-*` id ·
`content/view` 의 표 · 시나리오 테스트 · 커밋 메시지가 이미 소유한다 (원본 §17:
Implementation 은 Runtime Code, Verification 은 성립의 증거).

## 0. 입력 검사 — 아니면 시작 거부

1. `spec.md` 가 있고 뒷부분(`## SPEC` ~ `## Observable`)이 있다.
2. `## UNRESOLVED` 가 "없음"이다. 아니면 시작하지 않고 `advprotoi-plan`(또는 Human)
   으로 반환한다.
3. spec.md 는 여기서부터 읽기 전용이다 — build 가 고치지 않는다.

## 1. 관찰 계약 확정 + 기구/의미 분해 — fan-out 전 단일 작업

**관찰 계약**: spec.md 의 `## Observable` 절을 `content/protocol/` 로 옮긴다. 무엇을
투영할지는 이미 plan 이 닫았다 — 이 작업은 **기계적 변환**이어야 하며, 여기서 투영
대상을 새로 판단하게 되면 그것은 spec 의 결손이다 (DESIGN GAP 반환). 컨텐츠를
조립에 잇는 자리는 `content/active*.ts` 뿐이다 (CLAUDE.md 경계 규칙 3).

**기구/의미 분해**: 이번 구현 요구를 둘로 나눈다.

```text
기구 (→ engine)    게임 명사 없이 성립하는 구조 — 그리기·배치·입력·수치 처리·순회.
                   예: "칸 격자에 아이콘과 수량을 그린다"(타일뷰) · "영역이 위치를
                   포함하는지 판정한다". 이후 Cycle 과 다른 팩이 재사용할 자산이 된다.
의미 (→ content)   이 세계의 이름과 규칙을 아는 부분 — "이 칸은 stone 이고 채광으로
                   늘어난다" · "이 영역의 세계압은 spatial-shear 다".
```

분해 판정: 구현할 코드에서 게임 명사를 전부 벗겨도 남는 동작이 있으면 그것이 기구다.
벗기면 아무것도 남지 않는 코드(의미와 얽힌 Rule 로직)는 통째로 content 다.
추출하는 기구의 **기능 범위는 이번 사용처가 실제로 쓰는 만큼**이다 — 확장 축(옵션·
변형)은 그것을 쓰는 다음 사용처가 온 Cycle 에서 넓힌다. 기구가 이미 engine 에 있으면
그대로 재사용한다 (추출 전에 기존 기구 목록을 훑는 이유다).

분해 결과로 **기구의 API(형·함수 시그니처)를 여기서 선언**한다 — W·V 는 이 API 에
맞춰 조립하고, E 는 이 API 를 구현한다. 이것과 관찰 계약이 병렬 Agent 들의 동기화
지점이다.

## 2. 병렬 fan-out (E ∥ W ∥ V ∥ T)

Agent tool 로 **한 메시지에 동시 발사**한다. 각 프롬프트에 반드시 담는 것:
담당 파일 경계 · `spec.md` 전문(또는 경로) · 확정된 관찰 계약 · 선언된 기구 API ·
아래 공통 금지 규칙.

```text
Agent E  기구 추출·구현     engine/ — 1 에서 선언한 API 를 게임 명사 없이 구현한다 (+ engine 테스트).
                           분해 결과 새 기구가 없으면 생략. 커밋은 content 와 분리한다
Agent W  World 구현        content/world/ + content/regions/ — 기구 API 에 명사·데이터를 공급해 조립
Agent V  GameView 구현     content/view/ — World State 를 표현만 한다. 기구 API 로 그린다
Agent T  시나리오 테스트    content/world/tests/<주제>.scenario.spec.ts (+ 표현 검증이 있으면
                           content/view/tests/<주제>.scenario.spec.ts) — spec 만 보고 쓰는 black-box 테스트
```

공통 금지 규칙 (각 Agent 프롬프트에 그대로):

- **코드 배치** — 1 의 분해 결과를 따른다: 기구는 engine (E 의 담당, 게임 명사
  없이), 의미는 content. 게임 명사를 아는 코드는 전부 content 다.
- **의미 생성 금지 + GAP 삼분법** — 막히면 종류를 먼저 판정한다.
  - `IMPLEMENTATION GAP`: Semantic/Rule 은 충분한데 content 쪽 코드에 필요한 기술
    기능이 없다 (예: spec 이 요구하는 Attack.impactTime 을 담을 상태가 팩에
    아직 없다) → **Agent 가 그 자리에서 최소 범위로 구현한다.** Human 반환 불필요.
  - `ENGINE GAP`: 성립하려면 **기존 engine 계약을 바꿔야 한다** (기존 export 의
    시그니처·의미 변경, 스냅샷 형태 변경 등 다른 사용처에 영향이 가는 것) →
    결과 보고에 `ENGINE GAP` 블록(필요한 변경 · 영향 범위)을 남기고 그 부분만
    미완으로 종료한다 → Human 승인 후 별도 커밋으로 반영하고 Cycle 이 재개한다.
    새 기구를 **더하는** 것은 E 의 정상 작업이다 — 이 GAP 은 기존 것을 **바꿀 때**만.
  - `DESIGN GAP`: spec 으로는 게임 의미를 결정할 수 없다 → 지어내지 말고 결과
    보고에 CLAUDE.md `GAP` 블록을 남기고 그 부분만 미완으로 종료한다 (plan/Human
    반환 대상). 기술 결손은 위 두 GAP 으로 보내 공정을 계속 굴린다.
- **선행 추상화 금지** (원본 §10) — 현재 Rule 실행에 필요한 최소 구조만 만든다.
  미래 요구를 예상한 Provider/Strategy/Pipeline/Registry 를 만들지 않는다.
  추상화는 실제 Cycle 반복에서 중복이 발견됐을 때만, 그때도 기존 관찰 가능 행동을
  유지하는 리팩터링으로만 (원본 §11, §18).
- 담당 경계 밖 파일을 만지지 않는다. Agent 는 문서를 만들지 않는다 — 결과는 채팅
  보고로 돌려준다.

Agent 별 추가 규칙:

- **E**: 게임 명사 없이 구현한다 — 이름·데이터는 매개변수와 제네릭으로 받는다.
  기능 범위는 선언된 API 그대로 (확장 축은 다음 사용처의 Cycle 이 넓힌다).
  구현한 기구 목록(무엇을 · 어떤 요구에서 추출했는지)을 결과로 보고한다 — 이것이
  engine 커밋 메시지의 재료다.
- **W**: 세계 State 변경은 World Rule 의 Transition 에서만 (CLAUDE.md 원칙 4).
  팩 시스템은 `engine/physics` 솔버를 조합한다 — 재구현하지 않는다.
  **Rule ↔ 코드 Trace 는 코드 주석이다** — 각 R# 를 실현하는 함수 머리에 그 Rule id
  (`RULE-…`)를 한국어 주석으로 적는다. grep 이 곧 매핑 표이므로 별도 표를 쓰지 않는다.
  spec 의 R# 전부가 어느 함수에 닿는지를 결과로 보고한다.
- **V**: GameView 는 새 의미를 만들지 않는다 — 관찰 계약의 State 를 표현만 한다
  (원본 §12). `view/resolve.ts` · `code-text.ts` 등 팩 계약 자리를 따른다. State →
  표현의 대응은 `content/view` 의 표 자체가 원본이다 — 별도 표를 쓰지 않는다.
- **T**: **Black-box Verification 원칙** — 읽는 것은 `spec.md` 뿐이다 (SPEC = 무엇을
  검증할지 · State/Rule/Observable = 어떤 State 를 조작·관측할지). 새 구현 코드·W/V
  의 결과는 보지 않는다 — 구현에 맞춰 테스트를 왜곡하는 것을 막는다 (원본 §13 —
  검증 기준은 코드 구조가 아니라 플레이 결과·World State 다). 테스트는 **기존
  하네스**(createWorld · driveWorld · 관찰 봉투 · 기존 spec/fixture 의 선례)만으로
  쓴다. 새 코드의 API 를 추측하지 않는다 — 하네스로 놓을 수 없는 Given 은
  `it.todo('GAP: …')` 로 남기고 결과에 목록으로 보고한다.
  형식: `describe('SPEC-00x <이름>')` 안에 `it('S-0xx <한 줄>')` — Given/When/Then 을
  주석으로 적고 단언은 spec 의 State 점 경로로 한다. REUSED/AFFECTED Rule 의 기존
  행동(회귀)도 `describe('회귀')` 로 넣는다 (원본 §18 · CLAUDE.md 원칙 8).
  **전체 개수를 단언하지 않는다** — 이 Cycle 이 더한 것의 존재와 행동만 단언한다
  (다른 Cycle 이 방·존재·규칙을 더해도 이 테스트가 깨지지 않게).
  spec 이 침묵해 판정 방식을 정해야 했던 자리(경계값 포함 여부 등)는 결과에
  목록으로 보고한다 — build 본체가 TODO 의 "다음 Cycle 로" 에 넣을지 정한다.
- GameView 가 불필요한 Cycle 이면 V 를 생략한다 — 형식적으로 채우지 않는다.

## 3. 통합·검증

1. Agent 보고를 모아 GAP 을 먼저 처리한다: IMPLEMENTATION GAP 은 build 본체가
   최소 범위로 구현해 해소하고, ENGINE GAP(기존 engine 계약 변경)은 모아 Human 에게
   승인을 받아 별도 커밋으로 반영하며, DESIGN GAP 은 모아서 plan 또는 Human 으로 반환한다.
   해소 전에는 해당 부분을 완료로 표시하지 않는다.
2. T 의 `it.todo('GAP: …')` 를 푼다 — 하네스에 없던 조작은 최소 범위로 보강해
   (IMPLEMENTATION GAP) 실제 테스트로 바꾸고, 자동으로 놓을 수 없는 것만 Human
   실주행 관찰 항목(TODO.md)으로 옮긴다.
3. `npm test` (경계 검사 + vitest) · `npm run build` 실행. 실측은 **테스트 결과**다 —
   산문으로 옮겨 적지 않는다.
4. **확장 Cycle** 이면 기존 관찰 가능 행동의 회귀 검증을 포함한다 (원본 §18,
   CLAUDE.md 원칙 8 — REUSED Rule 의 기존 시나리오 재실행).

## 4. 마감

**완료 조건 7항** (원본 §19) 을 build 본체가 판정한다 — 문서에 체크리스트를 남기지
않고, 판정 결과를 마감 커밋 메시지 한 줄로 적는다
(예: `시나리오 33/33 PASS · 7항 충족 · Human 판정 대기 8`):

```text
Design Trace   어떤 Design 에서 나왔는지 설명 가능 (spec.md 의 SOURCE)
Scope          무엇을 만들었는지 한두 문장 (spec.md 의 Playable Goal)
Semantic       필요한 World State 명확 (spec.md 의 State)
Rule           조건→상태 변화 명확 (spec.md 의 Rule)
Implementation Semantic·Rule 이 Runtime 에서 실행됨 (모든 R# 에 RULE id 주석이 달린 함수가 있다 — grep 으로 확인)
Observable     World State 또는 GameView 에서 직접 확인 가능 (관찰 계약 + V 의 표)
Verification   Human 이 추가 추론 없이 판단 가능 (시나리오 테스트 전부 PASS + TODO 의 관찰 항목)
```

7항 전부 + 시나리오 전부 PASS 여야 Cycle 완료다. 하나라도 미달이면 미완 항목과
반환 대상(W/V/plan/Human)을 보고하고 완료 선언하지 않는다.

**`TODO.md`** — 코드 뒤에 남는 유일한 문서. 살아 있는 문서다: 항목이 닫히면 지우고,
다 지워지면 파일을 지운다 (`spec.md` 만 남은 디렉터리가 깨끗이 닫힌 Cycle 이다).
남길 것이 없으면 만들지 않는다.

```text
# C### — TODO
## Human 판정 대기 — Experience Verification
   spec.md 의 Experience Intent(Start/End)와 Observable Result 를 실주행 관찰 항목으로 옮긴다 —
   실행 방법 + 항목마다 하기/보기/판정[ ]. 의도한 인지·행동 변화가 실제 플레이에서
   발생하는지의 최종 판단은 Human 몫이다 (원본 위층 문서 §7). 판정 칸은 비워 둔다
## 알려진 부채          이 Cycle 이 남긴 것과 그것을 받을 Cycle
## 다음 Cycle 로        spec 이 침묵해 테스트가 피해 간 자리 · 이월한 관측 (T 의 보고에서)
```

**관찰 촬영** — Observable Result 를 실제로 띄운 게임에서 찍어 **Human 에게 보여준다**.
`cycles/<CycleId>/shots.json` 에 시나리오(run 마다 spawn + 걸음 — 형식은
`tools/cycle-shot/shot.cjs` 머리 주석)를 쓰고 `npm run cycle:shot cycles/<CycleId>/shots.json`
을 돌린다 → `cycles/<CycleId>/shots/*.png`. 파일명은 TODO.md 의 Human 판정 항목 번호(X-##)에
맞추고, TODO.md 의 각 항목이 자기 그림을 가리키게 한다. 찍은 그림은 마감 보고에서 바로
보여준다(SendUserFile) — Human 판정은 그림에서 시작한다. 도구는 판정하지 않는다 — expect 는
기록이다. 소프트웨어 GPU 라 걷는 조작이 이어지지 않으므로 먼 자리는 시나리오의 `spawn`
(HKT_SPAWN)으로 시작하고, 자율 존재가 방해하면 `npcs: "none"`(HKT_NPCS) 인 run 을 따로 둔다
— 둘 다 `vite.config.ts` 의 검증용 손잡이이고 세계 규칙은 바뀌지 않는다. 그림에 안 보이는
결과(State 값)는 시나리오 테스트가 증거다 — 억지로 찍지 않는다.

**Play 문서 갱신**: Cycle 이 `content/roadmap/play/<PlayName>.md` 의 Cycle Breakdown 에서
왔으면, 완료 시 그 항목의 체크박스만 `[x]` 로 갱신한다 — play 문서에서 Agent 가
만질 수 있는 유일한 자리다. 해당 Play 의 모든 Cycle 이 닫혔으면 "Play Goal 실주행
확인"을 Human 에게 제안한다.

**STATE.md 갱신**: §2 진행 표 · §4 코드에 있는 것 · §5 부채(TODO.md 를 가리킨다). §1 의
레인 표는 design 이 소유한다 — 닫힌 Cycle 을 지우고 "기다리는 것"이 풀린 레인만 표시한다.
현재 상태만 — 완료 경위를 쌓지 않는다 (CLAUDE.md 원칙 10). 병렬 중이면 이 갱신은 main 에
합친 직후에 한다 (아래).

## 5. Cycle 간 병렬 (Plan-Skill §4 항목 4)

한 Cycle = 브랜치 `cycle/C###` = 세션 하나. 어느 레인이 지금 돌 수 있는지는 STATE.md §1 이
답한다 — build 는 그 표의 "기다리는 것"이 비어 있는 Cycle 만 시작한다. 브랜치 안에서 지킬 것:

```text
① 공용 표 파일(regions/graph.ts · regions/index.ts · view/code-text.ts · view/*-presentation.ts ·
   world/semantic/world-state.ts · protocol/*)은 항목 추가만 — 기존 항목 변경은 spec 의 CHANGED 뿐
② STATE.md · Play 체크박스는 main 에 합친 직후에만 — 브랜치 안에서는 자기 cycles/C###/ 만
③ 시나리오 테스트는 전체 개수를 단언하지 않는다
④ engine 커밋은 분리해 먼저 합친다 · 기존 engine 계약 변경(ENGINE GAP)은 병렬 중 금지
```

PR 은 Cycle 번호 순으로 합친다. 합친 뒤 ② 를 하고, 그 Cycle 을 기다리던 레인이 있으면 STATE §1
의 "기다리는 것"을 비운다.
