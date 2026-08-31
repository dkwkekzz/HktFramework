---
name: advprotoi-plan
description: HktAdvProtoI 의 Cycle 의미 확정 단계를 실행한다 — Cycle 시작(Human 지정 Goal 또는 Frontier) → CYCLE SPEC(01-spec.md) → WORLD SEMANTIC + RULE(02-world.md). Design 에 없는 게임 의미는 결정하지 않고 UNRESOLVED 로 정지·Human 반환한다. 코드는 수정하지 않는다 — 구현·검증은 advprotoi-build 가 이어받는다. 사용자가 "AdvProtoI Cycle 시작 / Cycle Spec 작성 / World Semantic 작성 / plan 진행 / 다음 Cycle 계획" 을 요청하면 사용.
---

# HktAdvProtoI Cycle Plan — 의미 확정 (SPEC → SEMANTIC + RULE)

**작업 디렉토리: `HktAdvProtoI/`**. 공정 원본은
[design/Design-CycleExecutionWorkflow.md](../../../HktAdvProtoI/design/Design-CycleExecutionWorkflow.md) —
이 스킬과 어긋나면 원본이 이긴다. 경로·경계·GAP 형식은 `HktAdvProtoI/CLAUDE.md` 를 따른다.

이 스킬은 **의미를 정하는 일**만 한다. 코드·`content/`·`engine/` 을 수정하지 않는다.
산출물은 `HktAdvProtoI/cycles/<CycleId>/01-spec.md` 와 `02-world.md` 두 파일이다.
대화 History 는 Source of Truth 가 아니다 — Artifact 파일만이 단계 간 인터페이스다.

## 공통 원칙 (원본 §20)

- Design(`design/`) 은 Human 소유 원본 — 수정·재해석하지 않는다. 필요한 정보만 더
  구체적인 형태로 **변환**한다.
- **Design 에 없는 게임 의미는 결정하지 않는다.** 수치·시간·확률·허용 범위는 전부
  여기에 해당한다 (예: Design 이 "공격 직전 Guard = Perfect Guard" 라고만 말하면
  `PerfectGuardWindow = 0.2 sec` 을 정하는 것은 기획이지 구현이 아니다) →
  `UNRESOLVED` 로 남기고 정지한다.
- 각 단계의 입력은 직전 Artifact 로 고정한다. 이전 단계를 다시 해석하지 않는다.

## 1. Cycle 시작

1. Cycle Goal 을 받는다 — Human 이 직접 지정하거나, `advprotoi-master` 의 Frontier
   선택 결과를 받는다. **master 산출물은 필수가 아니다** (원본 §15) — Source 가
   `design/` 문서면 충분하다.
2. CycleId 채번: `C###-이름` (`cycles/` 의 최대 번호 +1, 세 자리).
3. `cycles/<CycleId>/` 생성.

모든 Artifact 머리에 Trace 블록을 둔다:

```text
CYCLE          C###-이름
SOURCE         design/Design-….md   (의미의 근거 — 반드시 Design 문서다)
SELECTED_FROM  Frontier 후보 이름 또는 "Human"   (왜 지금 이걸 하는가 — Master 는 Source 가 아니다)
PREV           (직전 Artifact 파일명 — 이 파일만이 입력이다. 01-spec.md 는 "없음")
```

## 2. CYCLE SPEC → `01-spec.md` (원본 §4–5)

Source Design 문서를 읽고 이번 Cycle 범위만 잘라낸다. **새 기획서가 아니다** —
Design 을 새 추상 구조로 재해석하지 않고 작업 범위만 고정한다.

형식 (4항 고정):

```text
## Source
어떤 Design 문서·절에서 나온 작업인가

## 이번 Cycle 에서 성립시킬 것
플레이어 또는 세계에서 어떤 결과를 만드는가 (구체적 시나리오로)

## 이번 Cycle 에서 하지 않을 것
범위 제한 목록

## 검증
무엇을 직접 보면 완료라고 판단할 수 있는가 (구체적 배치·행동·기대 결과)

## UNRESOLVED
Design 에 없어서 결정하지 못한 의미 목록 (없으면 "없음")
```

**범위 게이트**: "성립시킬 것"을 한두 문장으로 말할 수 없으면 Cycle 이 크다 —
쪼개서 후보를 제시하고 Human 선택을 받는다.

**확장 Cycle** (원본 §18): 기존 기능 확장이면 기존 `02-world.md` 들의 Semantic/Rule
을 복사·재작성하지 않고 그 위에 추가할 것임을 Source 에 명시한다.

## 3. WORLD SEMANTIC + RULE → `02-world.md` (원본 §6–8)

입력은 `01-spec.md` 뿐이다. 세계가 보유해야 할 **개념·상태**와 **상태 변화 규칙**만
정의한다. 한 파일로 묶는다 — 문서 수보다 의미의 명확함이 중요하다.

```text
## State (Semantic)
존재와 그 상태 목록 — 실제 상태 이름을 점 경로로 확정한다
예: Wolf.knowledge.fireDanger · Wolf.behaviorState · Player.heldItem

## Rule
각 Rule 은 R1, R2… 로 번호를 붙이고 다음 형태로:
IF <현재 상태 + 행동/사건 + 조건> THEN <새로운 상태>
Rule 의 언어는 Design 의 언어와 직접 대응해야 한다.

## REUSED / ADDED
REUSED  이미 세계에 있는 Semantic/Rule (재정의 금지 — 이름만 인용)
ADDED   이번 Cycle 이 새로 더하는 것

## Observable
외부(GameView·검증)에 투영할 State 목록 — 위 State 의 부분집합을 점 경로로 열거한다.
build 는 이 목록을 그대로 protocol/ 로 옮긴다 — 무엇을 투영할지 여기서 닫아야
build 의 관찰 계약 확정이 기획 행위가 아니라 기계적 변환이 된다.
```

**금지** (원본 §6): KnowledgeService · Repository · Manager · Component 같은 코드
클래스·소프트웨어 구조를 여기서 정의하지 않는다. 그것은 IMPLEMENTATION 의 일이다.

## 4. 종료 보고

- `UNRESOLVED = 0` → "build 가능" 보고. 이어서 `advprotoi-build` 를 실행할 수 있다.
- `UNRESOLVED > 0` → 목록을 Human 질의로 제시하고 **정지한다**. Human 답을 받으면
  그 결정을 (Human 이 Design 에 반영했음을 확인한 뒤) Spec 에 반영하고 재개한다.
- 진행 중 의미 부족·모순을 만나면 CLAUDE.md 의 `GAP` 형식으로 반환한다.
