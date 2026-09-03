---
name: advprotoi-plan
description: HktAdvProtoI 의 Cycle 의미 확정 단계를 실행한다 — Cycle 시작(cycles/<CycleId>/spec.md 앞부분 또는 Human 지정 Goal) → CYCLE SPEC → WORLD SEMANTIC + RULE 을 같은 spec.md 에 덧붙여 동결한다. Design 에 없는 게임 의미는 결정하지 않고 UNRESOLVED 로 정지·Human 반환한다. 코드는 수정하지 않는다 — 구현·검증은 advprotoi-build 가 이어받는다. 사용자가 "AdvProtoI Cycle 시작 / Cycle Spec 작성 / World Semantic 작성 / plan 진행 / 다음 Cycle 계획" 을 요청하면 사용.
---

# HktAdvProtoI Cycle Plan — 의미 확정 (SPEC → SEMANTIC + RULE)

**작업 디렉토리: `HktAdvProtoI/`**. 공정 원본은
[design/Design-CycleExecutionWorkflow.md](../../../HktAdvProtoI/design/Design-CycleExecutionWorkflow.md) —
이 스킬과 어긋나면 원본이 이긴다. 경로·경계·GAP 형식은 `HktAdvProtoI/CLAUDE.md` 를 따른다.

이 스킬은 **의미를 정하는 일**만 한다. 코드·`content/`·`engine/` 을 수정하지 않는다.
산출물은 `HktAdvProtoI/cycles/<CycleId>/spec.md` 의 **뒷부분**(SPEC ~ UNRESOLVED)이다 —
`advprotoi-design` 이 만든 앞부분(Playable Goal ~ Out of Scope) 아래에 덧붙인다.
UNRESOLVED 가 0 이면 파일은 **동결**된다 — 이후 아무도 고치지 않는다 (의미를 바꿔야 하면
새 Cycle 이다). 대화 History 는 Source of Truth 가 아니다 — 파일만이 단계 간 인터페이스다.

## 공통 원칙 (원본 §20)

- Design(`design/`) 은 Human 소유 원본 — 수정·재해석하지 않는다. 필요한 정보만 더
  구체적인 형태로 **변환**한다.
- **Design 에 없는 게임 의미는 결정하지 않는다.** 수치·시간·확률·허용 범위는 전부
  여기에 해당한다 (예: Design 이 "공격 직전 Guard = Perfect Guard" 라고만 말하면
  `PerfectGuardWindow = 0.2 sec` 을 정하는 것은 기획이지 구현이 아니다) →
  `UNRESOLVED` 로 남기고 정지한다.
- 각 절의 입력은 같은 파일의 직전 절로 고정한다. 이전 절을 다시 해석하지 않는다.

## 1. Cycle 시작

1. Cycle Goal 을 받는다 — 표준 경로는 `advprotoi-design` ③ 이 만든
   `cycles/<CycleId>/spec.md` 앞부분(승인된 Play Design 의 Cycle Breakdown 한 항목)이다.
   그것이 있으면 **이 단계의 유일한 입력**이며, Play Design·Design 을 되읽어
   재해석하지 않는다 (Source 문서는 근거 확인 용도로만 연다).
   예외 경로 — Human 이 직접 Goal 을 지정하면 `spec.md` 를 새로 만들고 앞부분을
   Human 지정 내용으로 쓴다 (Playable Goal · Out of Scope 두 절이 최소). Source 는
   `design/` 문서면 충분하다.
2. CycleId 채번(예외 경로만): `C###-이름` — `cycles/` 디렉터리와 기존 코드 주석의
   Cycle 번호(C###)를 통틀어 최대 번호 +1 로 잇는다 (세 자리). 코드에 남은 이전
   기준선의 번호도 같은 이름 공간이다.
3. `cycles/<CycleId>/` 생성 (없으면).

`spec.md` 머리의 Trace 블록은 하나다 (design 이 이미 썼으면 그대로 둔다. 절마다 두지
않는다 — 절의 순서가 곧 입력 관계다):

```text
CYCLE          C###-이름
SOURCE         content/roadmap/play/….md 또는 content/roadmap/*.md 또는 design/Design-….md   (의미의 근거 — 반드시 기획 문서다)
SELECTED_FROM  Play Cycle Breakdown 항목 또는 "Human"   (왜 지금 이걸 하는가)
```

## 2. CYCLE SPEC → `## SPEC` (원본 §4–5)

입력은 spec.md 앞부분뿐이다. PLAN 은 이미 결정된 플레이 기획을 **검증 가능한
요구사항으로 폐쇄**하는 단계다 — Experience Intent 를 재해석하지 않고, 새 기획서도
쓰지 않는다.

**델타만 쓴다 (원본 §16 — 정보를 추가하지 않는 단계는 두지 않는다).**
Playable Goal · World Change · Observable Result · Out of Scope 는 이미 앞부분이
소유한다 — 재서술·복사하지 않고, 이 단계가 **새로 더하는 것만** 적는다.

```text
## SPEC
SPEC-001 …  앞부분의 World Change·Observable Result 를 참·거짓을 가릴 수 있는
            문장으로 폐쇄한 목록. 각 항은 하나의 조건과 하나의 기대 결과를 갖는다.
            경계(성립하지 않는 경우)도 최소 한 항으로 적는다.
```

**Design 침묵의 판정** — Design 이 말하지 않은 의미를 만나면 둘 중 하나로 처리한다:
이번 Cycle 이 성립하는 데 그 답이 **필요하면** UNRESOLVED 로 올려 Human 에게 묻고,
그 답 **없이도 성립하면** Out of Scope 로 되돌려 범위 밖임을 확인하고 Cycle 을
움직인다 (기존 Rule 그대로 두기 · Design 이 준 이름만 쓰기가 기본형이다). 기본형으로
둔 것은 UNRESOLVED 절 아래에 목록으로 남긴다 — Human 이 감사할 자리다.

**범위 게이트**: Playable Goal 을 한두 문장으로 말할 수 없거나 SPEC 이 열 항을
넘어가면 Cycle 이 크다 — 쪼개서 후보를 제시하고 Human 선택을 받는다.

**확장 Cycle** (원본 §18): 기존 기능 확장이면 기존 `cycles/*/spec.md` 들의
Semantic/Rule 을 복사·재작성하지 않고 그 위에 추가할 것임을 Source 에 명시한다.

## 3. WORLD SEMANTIC + RULE → `## State` · `## Rule` · `## REUSED / ADDED` · `## Observable (관찰 계약)` (원본 §6–8)

입력은 `## SPEC` 뿐이다. 세계가 보유해야 할 **개념·상태**와 **상태 변화 규칙**만
정의한다. 절 순서는 SPEC → State → Rule → REUSED / ADDED → Observable → UNRESOLVED.

```text
## State
존재와 그 상태 목록 — 실제 상태 이름을 점 경로로 확정한다
예: Wolf.knowledge.fireDanger · Wolf.behaviorState · Player.heldItem
이 Cycle 의 데이터 값(좌표·이름)이 있으면 여기 표로 적는다

## Rule
각 Rule 은 R1, R2… 로 번호를 붙이고 다음 형태로:
IF <현재 상태 + 행동/사건 + 조건> THEN <새로운 상태>
Rule 의 언어는 Design 의 언어와 직접 대응해야 한다. 기존 Rule 을 건드리면
CHANGED(전제/전이가 바뀜) 또는 AFFECTED(대상 집합만 좁아짐)로 표시한다

## REUSED / ADDED
REUSED   이미 세계에 있는 Semantic/Rule (재정의 금지 — 이름만 인용)
ADDED    이번 Cycle 이 새로 더하는 것
CHANGED / AFFECTED  위 Rule 절의 표시를 모은다

## Observable (관찰 계약)
외부(GameView·검증)에 투영할 State 목록 — 위 State 의 부분집합을 점 경로로 열거한다.
build 는 이 목록을 그대로 protocol/ 로 옮긴다 — 무엇을 투영할지 여기서 닫아야
build 의 관찰 계약 확정이 기획 행위가 아니라 기계적 변환이 된다.
투영하지 않는 것도 한 줄로 적는다 (그것이 Play 의 미지감인 경우가 많다)

## UNRESOLVED
Design·앞부분에 없어서 결정하지 못한 의미 (없으면 "없음") + 기본형으로 둔 것의 목록
```

**금지** (원본 §6): KnowledgeService · Repository · Manager · Component 같은 코드
클래스·소프트웨어 구조를 여기서 정의하지 않는다. 그것은 IMPLEMENTATION 의 일이다.

**모든 State/Rule 은 컨텐츠(팩)의 의미다** — 기반(engine)은 게임의 명사를 모른다.
이 의미를 실현하는 데 필요한 기구(게임 명사 없이 성립하는 그리기·배치·판정 구조)를
engine 으로 추출하는 것은 build 의 기구/의미 분해가 담당한다 — plan 은 의미만 적는다.

## 4. 종료 보고

- `UNRESOLVED = 0` → spec.md 동결 · "build 가능" 보고. 이어서 `advprotoi-build` 를
  실행할 수 있다.
- `UNRESOLVED > 0` → 목록을 Human 질의로 제시하고 **정지한다**. Human 답을 받으면
  그 결정을 (Human 이 Design 에 반영했음을 확인한 뒤) Spec 에 반영하고 재개한다.
- 진행 중 의미 부족·모순을 만나면 CLAUDE.md 의 `GAP` 형식으로 반환한다.
