---
name: advprotoi-spec
description: HktAdvProtoI 공정의 둘째 단계 — 주입된 기획서로 Cycle spec 을 만든다. ① 묶음("<기획서> 로 묶음 잘라"): 기획서(content/roadmap/L<N>·M<N>·design/)에서 플레이 하나(컨텐츠 묶음 M<N>) 또는 축 하나(기반 묶음 L<N> — 기구 + 계약 + 예제)를 잘라 첫 Cycle 의 cycles/C###/spec.md 머리에 묶음 블록(Goal·Intent·Breath 또는 손잡이·Cycle 목록·미지·질문)을 쓰고 같은 파일에 첫 spec 을, 뒤 Cycle 들의 spec 은 자기 폴더에 초안으로 함께 쓴다 — UNRESOLVED 에 묶음 질문 전부. ② 실주행 GAP 회수: 예심에서 "아니오" 로 돌아온 판정 질문을 기존 묶음의 Cycle 하나 또는 관찰 가능성 묶음 하나로 잘라 spec 을 쓴다 (로드맵 행 없음). ③ Spec 한 장("<M<N>> 로 Spec 써"): 컨텐츠 A 등급(데이터만) — 묶음 · Cycle 없이 검사 가능한 Spec 하나. ④ Human 이 Goal 을 직접 지정한 묶음 없는 Cycle. 어느 경우든 코드를 만지지 않고 Human 반환에서 멈춘다 — "C### 진행" 은 advprotoi-cycle 의 것이다. 사용자가 "묶음 잘라 / <기획서> 로 시작 / spec 써 / Spec 한 장 / GAP 회수 / 다음 묶음 제안 / AdvProtoI spec" 을 요청하면 사용.
---

# HktAdvProtoI Spec — 기획서 → 묶음 → Cycle 전부의 spec → Human 반환

**작업 디렉토리: `HktAdvProtoI/`**. 공정 원본은
[design/Design-DesignAuthoringWorkflow.md](../../../HktAdvProtoI/design/Design-DesignAuthoringWorkflow.md) §5~§7 (묶음 · spec · 게이트) 과
[design/Design-CycleExecutionWorkflow.md](../../../HktAdvProtoI/design/Design-CycleExecutionWorkflow.md) §4~§8 · §18 · §20 · §21 (spec 의 의미 규칙) —
어긋나면 원본이 이긴다. 경로 규약 · 기반/컨텐츠 경계 · GAP 형식은 `HktAdvProtoI/CLAUDE.md`. 지금 어디까지 왔는가는 `plan/STATE.md`.

공정 셋 중 둘째다. 앞은 `advprotoi-inject`(주입물이 `content/roadmap/` 에 보존돼 있고 `plan/DESIGN.md` 에 행이 있다), 뒤는
`advprotoi-cycle`("C### 진행" = 묶음 승인 + spec 동결). 이 스킬은 **Human 반환에서 멈춘다** — 코드 · `plan/` 의 승인 기입 · 브랜치를
만지지 않는다. 만드는 것은 `cycles/C###-이름/spec.md` 뿐이다 (여럿).

입구는 넷이다 — 말이 고른다:

```text
"<기획서> 로 묶음 잘라"     §1 묶음 — 플레이 하나(또는 축 하나)를 잘라 첫 Cycle 의 spec 머리 블록 + 첫 spec + 뒤 Cycle 의 spec 초안
"GAP 회수" / "아니오" 판정  §1 묶음 — 실주행 GAP 을 기존 묶음의 Cycle 하나 또는 관찰 가능성 묶음 하나로 (로드맵 행을 올리지 않는다)
"<M<N>> 로 Spec 써"         §3 Spec 한 장 — 컨텐츠 A 등급(데이터만) · 묶음 · Cycle 없음
"C### <Goal> 로 spec 써"    §2 spec 하나 — Human 이 Goal 을 직접 지정한 묶음 없는 Cycle (SELECTED_FROM = "Human" · CYCLES.md §4)
```

**묶음의 종류는 행이 가른다** (Cycle 원본 §21 — 공정은 하나 · 완료를 재는 것이 다르다). 아래 절에서 "기반" 으로 표시된 규칙은 행이 L<N> 일 때만 적용된다.

```text
기반 묶음   행 = L<N>.  세우는 것은 축 — 게임 명사 없는 기구(engine) + 컨텐츠가 데이터로 채우는 계약 + 그것을 표현할 예제 하나.
           경험은 판정하지 않는다 — 손잡이(데이터)로 내려가 그 축을 처음 쓰는 컨텐츠 묶음이 판정한다.
컨텐츠 묶음  행 = M<N> · 실주행 GAP 회수.  플레이 하나 · Breath · 관찰 항목 · 실주행 판정.
```

기획서와 Cycle 사이에 다른 문서를 만들지 않는다 — Play 문서 · Master Graph · Intent 문서는 없다. 의미의 출처는 기획서 하나이고
spec 은 그것을 **인용**한다. 대화 History 는 Source of Truth 가 아니다 — 파일만이 단계 간 인터페이스다.

## 1. 묶음 — 기획서에서 플레이 하나를 자른다 (첫 Cycle 의 spec.md 머리)

입력은 Human 이 지목한 **기획서**(`content/roadmap/L<N>-*.md` · `M<N>-*.md` · `design/*.md`)와 `plan/DESIGN.md`(§1 열린 층 ·
§2 행 · §3 그 원본의 "덮인 것 / 남은 것" · §5 후보 표). 지목한 기획서가 `content/roadmap/` 에 없으면(채팅으로 왔다) 먼저
`advprotoi-inject` 다 — 그 스킬을 부르고 돌아온다. 보존되지 않은 주입물로 자르지 않는다.

판정 셋을 먼저 한다 (inject 가 이미 했으면 DESIGN 의 행에서 읽고 확인만):
- **어느 행인가** — 기반 층이면 DESIGN §1 의 열린 층("다음") 하나만 받는다. 다른 층의 것이면 보고하고 Human 판단.
  컨텐츠 층이면 등급(Tool-Scale §2 — A 데이터만 · B Cycle 하나 · C 새 축)을 확인하고 로드맵 열 질문 ①~⑩ 을 통과시킨다 (README §4).
  A 면 §3 이다. 새 축을 요구하는 미지는 컨텐츠 행이 아니라 기반 층의 새 행이다 — 보고한다.
- **무엇이 이미 있는가** — "덮인 것" 과 `codemap/` 이 Existing 이다. 재주입(같은 기획서를 다시 자른다)이면 "남은 것" 이 Goal 후보다.
- **묶음 하나에 담기는가** — 안 담기면 묶음 여럿을 순서대로 제안하되 첫 묶음만 spec 까지 쓰고 나머지는 DESIGN §5 후보 표에 한 줄씩 (보고에 담아 Human 이 승인 때 함께 본다 — 이 스킬은 plan/ 을 쓰지 않는다).

**실주행 GAP 회수**이면 입력은 `plan/CYCLES.md` §3 그 묶음 절의 "아니오" 판정 질문이다. 새 축도 새 미지도 아니다 — 로드맵 행을 올리지 않는다.
질문 하나가 기존 묶음의 자리에 들어가면 그 묶음에 Cycle 하나를 더한다(§2 — SOURCE 에 그 질문 번호). 여럿에 걸치면 관찰 가능성 묶음 하나로
자른다 — 행은 그 질문들이 나온 묶음의 행이다.

그 다음 첫 Cycle 의 `cycles/C###-이름/spec.md` 를 만든다 (번호는 전 이름공간 최대 + 1 — `plan/CYCLES.md` 와 `cycles/` 둘 다 본다).
머리에 **묶음 블록**, 그 아래 §2 의 spec 을 이어 쓴다.

```text
# C### — <이름>
## 묶음 — <이름>
기획서     그 절들 (+ 지목한 design/ 문서)   ← 의미의 유일한 출처. 재해석하지 않고 인용한다
행         L<N> 또는 M<N> (기반 층이면 놓는 미지 M<N> 도 — 이름은 Human)
Goal       플레이어가 실제로 무엇을 하는지 한 문장 — 완료를 직접 확인할 수 있게
           ("숲의 공포를 경험한다" ✗ / "포식자를 죽이지 않고 영역 내부의 자원을 획득한다" ○)
           기반 묶음: 축 — 무엇이 기구로 서고 컨텐츠가 무엇을 데이터로 주어 그 위에 놓이는가 한 문장 + 그것을 표현할 예제 하나 (이 세계의 데이터 한 줄)
Intent     Start / End (기반 묶음은 세계 · 컨텐츠 작업의 전후 — "조건이 넷의 모양 → 한 형")
Breath     감정 전이 사슬 (강도 숫자 금지 — 어떤 경험 뒤에 다음 상태로 넘어가는지) — 컨텐츠 묶음
손잡이     기반 묶음 (Breath 대신) — 이 축 위에서 컨텐츠가 코드 없이 바꿀 수 있어야 하는 것: 값 · 문구 · 표시 · 배치. Cycle 마다의 상세는 spec 의 Data Knobs
Cycle      C### — 한 줄 목표 · spec 경로 (2~4개 · 순서는 의존성 + Breath 의 점진 완성 · 각각 작다/플레이 가능/World 변화 분명/관찰 가능/검증 가능/재사용 가능.
           기반 묶음은 축의 의존성 — 각각 기구 하나 또는 계약 하나 + 예제 · 손잡이 SPEC 가능 · 회귀 가능)
미지       놓는 미지 하나 (2층: 지역 · 3층: 생물 · 4층: 자원) — 이름은 Human
검사       (컨텐츠 행이면) 열 질문 ①~⑩ 의 답
질문       게임 의미 — 수치 · 확률 · 시간 · 범위 · 원리의 확정 · 세계관 사실 · 이름. 묶음 전체의 것 = 첫 spec 의 UNRESOLVED
```

- **AI 가 자른다** — Goal · Intent · Breath · Cycle 분할 · 사건마다 World Cause. 방향 한 줄만 와도 이 층은 AI 가 지어 올린다
  (승인으로 확정되므로 창작이되 독단이 아니다).
- **Human 이 정한다** — 게임 의미. 지어내지 않고 "질문" 에 모은다. 주입물의 의도를 크게 벌리는 선택(목표 자체를 바꾸는 갈래)도 질문에 함께.
- 묶음 하나는 행 하나만 세운다. 확정되지 않은 축의 의미가 필요해지면 Required 가 아니라 질문으로.
- **Cycle 전부의 spec 을 함께 쓴다** — 첫 Cycle 의 spec 은 묶음 블록 아래에(동결 후보), 뒤 Cycle 의 spec 은 자기 폴더 `cycles/C###-이름/spec.md` 에
  **초안**으로 (머리에 첫 spec 링크 + "초안 — 앞 Cycle 의 「다음 Cycle 로」 를 받아 자기 차례에 동결" · UNRESOLVED 에는 "묶음 질문 Q<n> 의 답이 든다" 와
  새로 생긴 의미만). spec 하나만 쓰고 멈추지 않는다 — 이어서 진행할 수 없다.

## 2. spec — 형식과 의미 규칙 (첫 것은 동결 후보 · 뒤 것은 초안)

입력은 묶음 블록의 Cycle 목록 한 항목(Goal · Intent · Breath · 질문)과 그것이 지목한 기획서(`content/roadmap/*.md` · `design/`).
묶음 없는 Cycle(Human 직접 Goal · GAP 회수의 Cycle 하나)이면 입력은 그 Goal 과 **`plan/CYCLES.md` §3 그 묶음 절의「다음 Cycle 로」**(판정 질문은
읽지 않는다 — 그것은 묶음 단위 Human 몫이다). 기획서를 재해석하지 않는다 — 이번 것만 잘라 검증 가능한 문장으로 **폐쇄**한다.
코드는 보지 않는다 (Existing 판정은 `codemap/ENGINE.md` · `codemap/CONTENT.md` + 기존 `cycles/*/spec.md` 의 ADDED 로).

「다음 Cycle 로」의 항목은 하나씩 판정한다 — 이번 Cycle 이 받는 것은 SPEC/Reuse 로 들어오고, 받지 않는 것은 Out of Scope 에
받을 Cycle 을 적는다 (받을 Cycle 이 없으면 보고에 "결정 대기 · DESIGN.md 남은 것 · CYCLES.md 부채 중 어디로" 를 적는다 — 옮기는 것은 cycle 의 승인 기입). 회수 규칙의 원본은 Plan-Skill §3.

```text
# C### — <이름>
CYCLE / SOURCE / SELECTED_FROM   Trace 블록 하나 (SOURCE = 기획서 절 + 묶음의 첫 spec · SELECTED_FROM = 묶음 Cycle 목록 항목 또는 "Human")

## Playable Goal        이번에 성립할 플레이 결과 한두 문장 — 완료를 직접 확인 가능
   (기반 Cycle: ## Foundation Goal — 기구(engine 에 무엇이) · 계약(컨텐츠가 데이터로 무엇을 채우나) · 예제(이 세계의 데이터 한 줄 — 무엇이 보이나) 세 줄)
## Experience Intent    Start / End — 묶음의 Breath 중 이 Cycle 이 만드는 구간
   (기반 Cycle: ## Data Knobs — 표: 손잡이(컨텐츠가 코드 없이 바꾸는 것) · 자리(어느 파일 · 어느 표) · 기본값. 경험을 가르는 값 · 문구 · 표시 · 배치가 여기 없으면 spec 의 결손)
## World Change         세계에서 무엇이 어떻게 변하는가 (번호 목록)
## Observable Result    화면/상태에서 무엇을 직접 확인하는가 (번호 목록 — 기반 Cycle 은 도구 · State(검사 JSON · observe 보고 · 봉투)가 먼저, 화면은 예제 하나)
   (기반 Cycle: ## Module Check — 표: 모듈(기구 · 어댑터 · 검사 · 투영 · 표 · 도구) · 무엇이 단언하나(engine 테스트 · 시나리오 SPEC · world:check · 도구 테스트 · grep))
## Reuse                Existing(그대로 쓴다) / Added(이 Cycle 이 세운다 — World · Protocol · Data · View · Engine)
## Out of Scope         이번에 하지 않는 것과 그것을 받을 Cycle
## SPEC                 SPEC-001 … — World Change·Observable Result 를 참·거짓을 가릴 문장으로 폐쇄.
                        각 항은 조건 하나 + 기대 하나, 경계(성립하지 않는 경우)도 최소 한 항.
                        기반 Cycle 은 반드시 둘을 둔다 — 손잡이 SPEC(Data Knobs 하나를 데이터로 바꾸면 행동이 따라 바뀐다 · 코드 diff 0) · 명사 0 SPEC(engine 과 규칙 코드에 게임 명사 글자가 없다 · grep)
## State                존재와 상태를 점 경로로 (Wolf.knowledge.fireDanger 식) + 이 Cycle 의 데이터 값 표
## Rule                 R1, R2… — IF <상태 + 사건 + 조건> THEN <새 상태>. Design 의 언어와 직접 대응.
                        기존 Rule 은 CHANGED(전제/전이 변경) / AFFECTED(대상 집합만) 로 표시
## REUSED / ADDED       REUSED(이름만 인용 · 재정의 금지) · ADDED · CHANGED · AFFECTED
## Observable (관찰 계약)  투영할 State 를 점 경로로 열거 — 실현 단계가 그대로 protocol/ 로 옮긴다.
                        투영하지 않는 것도 한 줄 (그것이 묶음의 미지감인 경우가 많다)
## UNRESOLVED           Design 에 없어 결정하지 못한 의미 (없으면 "없음") + 기본형으로 둔 것의 목록
```

규칙 (Cycle 원본 §4–8 · §20):

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
  모든 State/Rule 은 컨텐츠의 의미다 — 기반(engine)은 게임 명사를 모른다. 기구 추출은 실현(cycle)의 몫.
- 컨텐츠 층 묶음(미지)의 Cycle 이면 README §4 열 질문의 답이 묶음 블록에 있는지 본다 — 없으면 UNRESOLVED.
- **기반 Cycle 의 경험 값은 UNRESOLVED 가 아니다** — 문구 · 숫자 표기 · 무엇을 판에 세우나 · 임계 · 자락 크기처럼 경험을 가르는 값은 Human 에게
  묻지 않고 **Data Knobs 에 자리와 기본값**으로 둔다 (기본값은 기존 코드의 값 · 기획서가 준 값 · 없으면 가장 단순한 것). 묻는 것은 계약 결정(형 · 축 · 경계)뿐.

## 3. Spec 한 장 — 컨텐츠 A 등급 (데이터만)

미지가 A 등급(Tool-Scale §2 — 규칙 없이 기존 축의 데이터만으로 선다)이면 묶음도 Cycle 도 없다. `cycles/` 에 폴더를 만들지 않고
그 `M<N>-*.md` 문서 끝에 `## Spec` 절 하나를 더한다 — 데이터가 채울 자리(어느 파일 · 어느 표 · 값) · 검사(`npm run world:check` 가 무엇을 단언하나) ·
Human 판정 한 줄(걸어 본다 — 무엇이 보여야 하나) · UNRESOLVED(세계관 사실 · 이름 · 값 중 기획서에 없는 것). 규칙이 하나라도 필요해지면 A 가 아니다 —
B 로 올리고 §1 로 돌아간다 (보고에 등급 변경을 적는다). A 의 실현은 데이터 커밋 하나이므로 cycle 스킬을 부르지 않는다 — Human 이 "넣어" 라 하면
데이터를 채우고 검사를 돌리고 판정을 청한다.

## 4. 반환 — Human 게이트 앞에서 멈춘다

**묶음 블록 + 첫 spec + 질문 목록**(+ 뒤 spec 초안의 경로 · 후보 표에 올릴 나머지 묶음)을 한 번에 Human 에게 올리고 멈춘다. spec 파일들은 main 에
커밋한다 (코드가 아니다 — 브랜치 없음). 커밋 메시지 한 줄: `HktAdvProtoI: <묶음 이름> 묶음 제안 — C###~C### spec · 질문 N`.

- `plan/` 은 쓰지 않는다 — 승인 기입(CYCLES §1 레인 · §3 묶음 절 · DESIGN §1/§2/§3/§5 · STATE · TODO)은 "C### 진행" 을 받은 `advprotoi-cycle` 이 한다.
  제안 상태는 spec 파일 자체가 말한다 (UNRESOLVED 가 있는 첫 spec = 제안 대기).
- 보고의 마지막 줄은 다음 단계의 문구다: **"답과 함께 `C### 진행`"** (advprotoi-cycle). UNRESOLVED 가 비어 있어도 같다 — "C### 진행" 은 묶음 승인이지
  질문의 유무가 아니다. 이 스킬은 어떤 경우에도 cycle 을 자동으로 잇지 않는다.
- Human 이 답을 주며 spec 을 고쳐 달라 하면(승인 전) 같은 파일을 다시 쓴다 — 동결 전이므로 고쳐도 된다. 동결 뒤에는 이 스킬이 spec 을 만지지 않는다.
