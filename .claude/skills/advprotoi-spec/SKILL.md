---
name: advprotoi-spec
description: HktAdvProtoI 공정의 둘째 단계 — 주입된 기획서 하나로 그 Cycle 전부의 spec 을 만든다. ① "<기획서> 로 spec 써": 기획서(content/roadmap/L<N>·M<N>)에서 플레이 하나(컨텐츠 행 M<N>) 또는 축 하나(기반 층 L<N> — 기구 + 계약 + 예제)를 Cycle 2~4개로 잘라 cycles/C###/spec.md 를 전부 쓴다 — 첫 spec 은 동결 후보(Trace 에 CYCLES 목록 · UNRESOLVED 에 질문 전부), 뒤 spec 은 자기 폴더에 초안. 한 세션에서 자를 수 없을 만큼 크면 spec 을 쓰지 않고 기획서를 나눌 자리를 제안한다. ② 실주행 GAP 회수: 예심에서 "아니오" 로 돌아온 판정 질문을 그 기획서의 Cycle 하나 또는 관찰 가능성 Cycle 하나로 잘라 spec 을 쓴다 (로드맵 행 없음). ③ Spec 한 장("<M<N>> 로 Spec 써"): 컨텐츠 A 등급(데이터만) — Cycle 없이 검사 가능한 Spec 하나. ④ Human 이 Goal 을 직접 지정한 Cycle. 어느 경우든 코드를 만지지 않고 Human 반환에서 멈춘다 — "C### 진행" 은 advprotoi-cycle 의 것이다. 묶음 · Play 같은 중간 단위는 없다. 사용자가 "spec 써 / <기획서> 로 시작 / <기획서> 로 잘라 / Spec 한 장 / GAP 회수 / 다음 spec 제안 / AdvProtoI spec" 을 요청하면 사용.
---

# HktAdvProtoI Spec — 기획서 하나 → Cycle 전부의 spec → Human 반환

**작업 디렉토리: `HktAdvProtoI/`**. 공정 원본은
[design/Design-DesignAuthoringWorkflow.md](../../../HktAdvProtoI/design/Design-DesignAuthoringWorkflow.md) §5~§7 (자르기 · 크기 · spec · 게이트) 과
[design/Design-CycleExecutionWorkflow.md](../../../HktAdvProtoI/design/Design-CycleExecutionWorkflow.md) §4~§8 · §18 · §20 · §21 (spec 의 의미 규칙) —
어긋나면 원본이 이긴다. 경로 규약 · 기반/컨텐츠 경계 · GAP 형식은 `HktAdvProtoI/CLAUDE.md`. 지금 어디까지 왔는가는 `plan/STATE.md`.

공정 셋 중 둘째다. 앞은 `advprotoi-inject`(기획서가 `content/roadmap/` 에 보존돼 있고 `plan/DESIGN.md` 에 행이 있다), 뒤는
`advprotoi-cycle`("C### 진행" = Cycle 목록 승인 + 첫 spec 동결). 이 스킬은 **Human 반환에서 멈춘다** — 코드 · `plan/` 의 승인 기입 · 브랜치를
만지지 않는다. 만드는 것은 `cycles/C###-이름/spec.md` 뿐이다 (여럿). **Cycle 을 세는 단위는 기획서 하나**다 — 기획서와 Cycle 사이에
묶음 · Play · 그래프 같은 것을 만들지 않는다.

입구는 넷이다 — 말이 고른다:

```text
"<기획서> 로 spec 써"       §1 자르기 — 기획서 하나를 Cycle 2~4개로 잘라 spec 전부(첫 것은 동결 후보 · 뒤 것은 초안)를 쓴다
"GAP 회수" / "아니오" 판정  §1 자르기 — 실주행 GAP 을 그 기획서의 Cycle 하나 또는 관찰 가능성 Cycle 하나로 (로드맵 행을 올리지 않는다)
"<M<N>> 로 Spec 써"         §3 Spec 한 장 — 컨텐츠 A 등급(데이터만) · Cycle 없음
"C### <Goal> 로 spec 써"    §2 spec 하나 — Human 이 Goal 을 직접 지정한 Cycle (SELECTED_FROM = "Human")
```

**Cycle 의 종류는 행이 가른다** (Cycle 원본 §21 — 공정은 하나 · 완료를 재는 것이 다르다). 아래 절에서 "기반" 으로 표시된 규칙은 행이 L<N> 일 때만 적용된다.

```text
기반 Cycle   행 = L<N>.  세우는 것은 축 — 게임 명사 없는 기구(engine) + 컨텐츠가 데이터로 채우는 계약 + 그것을 표현할 예제 하나.
            경험은 판정하지 않는다 — 손잡이(데이터)로 내려가 그 축을 처음 쓰는 컨텐츠 행의 Cycle 이 판정한다.
컨텐츠 Cycle  행 = M<N> · 실주행 GAP 회수.  플레이 하나 · 경험의 전환 · 관찰 항목 · 실주행 판정.
```

의미의 출처는 기획서 하나이고 spec 은 그것을 **인용**한다. 대화 History 는 Source of Truth 가 아니다 — 파일만이 단계 간 인터페이스다.

## 1. 자르기 — 기획서 하나를 Cycle 전부로

입력은 Human 이 지목한 **기획서 하나**(`content/roadmap/L<N>-*.md` 또는 `M<N>-*.md`)와 `plan/DESIGN.md`(§1 열린 층 · §2 행 · §3 그 원본의
"덮인 것 / 남은 것" · §5 다음에 자를 기획서). 지목한 기획서가 `content/roadmap/` 에 없으면(채팅으로 왔다) 먼저 `advprotoi-inject` 다 — 그 스킬을
부르고 돌아온다. 보존되지 않은 주입물로 자르지 않는다. `L<N>-Handoff.md` 는 기획서가 아니다 — 지목되면 그 층의 주입(`advprotoi-inject` — 방향 한 줄이면 된다)이 먼저
기획서로 세운다. `design/` 문서는 기획서가 지목한 근거로만 연다.

판정 넷을 먼저 한다 (inject 가 이미 했으면 DESIGN 의 행에서 읽고 확인만):
- **어느 행인가** — 기반 층이면 DESIGN §1 의 열린 층("다음") 하나만 받는다. 다른 층의 것이면 보고하고 Human 판단.
  컨텐츠 층이면 등급(Tool-Scale §2 — A 데이터만 · B Cycle 하나 · C 새 축)을 확인하고 로드맵 열 질문 ①~⑩ 을 통과시킨다 (README §4).
  A 면 §3 이다. 새 축을 요구하는 미지는 컨텐츠 행이 아니라 기반 층의 새 행이다 — 보고한다.
- **무엇이 이미 있는가** — "덮인 것" 과 `codemap/` 이 Existing 이다. 재주입(같은 기획서를 다시 자른다)이면 "남은 것" 이 Goal 후보다.
- **한 세션에 잘리는가** (원본 §5) — 기획서 하나가 Cycle 2~4개로 서지 않으면(축이 둘 이상 · 플레이가 둘 이상 · Cycle 이 다섯을 넘는다) **spec 을 쓰지 않는다**.
  "첫 것만 쓰고 나머지는 다음에" 는 없다 — 나눌 자리(절 번호 · 갈래 이름 · 갈래마다 서는 플레이 한 줄)를 제안해 Human 에게 돌려보내고,
  Human 이 나누면(또는 inject 에 시키면) 나뉜 문서 하나로 다시 시작한다.
- **Cycle 순서** — 의존성 + 경험의 점진 완성. 각 Cycle 은 작다 · 플레이 가능 · World 변화 분명 · 관찰 가능 · 검증 가능 · 재사용 가능
  (기반 Cycle 은 축의 의존성 — 각각 기구 하나 또는 계약 하나 + 예제 · 손잡이 SPEC 가능 · 회귀 가능).

**실주행 GAP 회수**이면 입력은 `plan/DESIGN.md` §3 그 기획서 절의 "아니오" 판정 질문이다. 새 축도 새 미지도 아니다 — 로드맵 행을 올리지 않는다.
질문 하나가 그 기획서의 자리에 들어가면 Cycle 하나를 더한다(§2 — SOURCE 에 그 질문 번호). 여럿에 걸치면 관찰 가능성 Cycle 하나로 자른다 —
행은 그 질문들이 나온 기획서의 행이다.

그 다음 Cycle 마다 `cycles/C###-이름/spec.md` 를 만든다 (번호는 전 이름공간 최대 + 1 부터 — `plan/CYCLES.md` 와 `cycles/` 둘 다 본다). 형식은 §2.
첫 spec 의 Trace 에 이 기획서의 Cycle 목록을 둔다:

```text
CYCLES         C### <한 줄 목표> → C### <한 줄 목표> → C### <한 줄 목표>     ← 첫 spec 에만 · 이 기획서의 순서
행             L<N> 또는 M<N> (기반 층이면 놓는 미지 M<N> 도 — 이름은 Human)
```

- **AI 가 자른다** — 각 Cycle 의 Playable Goal · Experience Intent · World Change · 사건마다 World Cause. 방향 한 줄만 와도 이 층은 AI 가 지어 올린다.
- **Human 이 정한다** — 게임 의미. 지어내지 않고 첫 spec 의 UNRESOLVED 에 모은다 — 뒤 Cycle 의 것도 여기서 한 번에. 주입물의 의도를 크게 벌리는 선택도 질문에 함께.
- 기획서 하나는 행 하나만 세운다. 확정되지 않은 축의 의미가 필요해지면 Required 가 아니라 질문으로.
- **Cycle 전부의 spec 을 함께 쓴다** — 첫 Cycle 의 spec 은 동결 후보, 뒤 Cycle 의 spec 은 자기 폴더 `cycles/C###-이름/spec.md` 에
  **초안**으로 (머리에 첫 spec 링크 + "초안 — 앞 Cycle 의 「다음 Cycle 로」 를 받아 자기 차례에 동결" · UNRESOLVED 에는 "첫 spec 의 질문 Q<n> 의 답이 든다" 와
  새로 생긴 의미만). spec 하나만 쓰고 멈추지 않는다 — 이어서 진행할 수 없다.

## 2. spec — 형식과 의미 규칙 (첫 것은 동결 후보 · 뒤 것은 초안)

입력은 §1 의 Cycle 목록 한 항목과 그것이 지목한 기획서(`content/roadmap/*.md` · `design/`).
Human 직접 Goal · GAP 회수의 Cycle 하나이면 입력은 그 Goal 과 **`plan/DESIGN.md` §3 그 기획서 절의「다음 Cycle 로」**(판정 질문은
읽지 않는다 — 그것은 기획서 단위 Human 몫이다). 기획서를 재해석하지 않는다 — 이번 것만 잘라 검증 가능한 문장으로 **폐쇄**한다.
코드는 보지 않는다 (Existing 판정은 `codemap/ENGINE.md` · `codemap/CONTENT.md` + 기존 `cycles/*/spec.md` 의 ADDED 로).

「다음 Cycle 로」의 항목은 하나씩 판정한다 — 이번 Cycle 이 받는 것은 SPEC/Reuse 로 들어오고, 받지 않는 것은 Out of Scope 에
받을 Cycle 을 적는다 (받을 Cycle 이 없으면 보고에 "결정 대기 · DESIGN.md 남은 것 · CYCLES.md 부채 중 어디로" 를 적는다 — 옮기는 것은 cycle 의 승인 기입). 회수 규칙의 원본은 Plan-Skill §3.

```text
# C### — <이름>
CYCLE / SOURCE / SELECTED_FROM / CYCLES / 행   Trace 블록 하나 (SOURCE = 기획서 절 · SELECTED_FROM = 첫 spec 의 CYCLES 항목 또는 "Human" · CYCLES 는 첫 spec 에만)

## Playable Goal        이번에 성립할 플레이 결과 한두 문장 — 완료를 직접 확인 가능
   (기반 Cycle: ## Foundation Goal — 기구(engine 에 무엇이) · 계약(컨텐츠가 데이터로 무엇을 채우나) · 예제(이 세계의 데이터 한 줄 — 무엇이 보이나) 세 줄)
## Experience Intent    Start / End — 이 Cycle 이 만드는 경험의 전환
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
                        투영하지 않는 것도 한 줄 (그것이 미지감인 경우가 많다)
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
  쪼개 후보를 내고 Human 선택을 받는다. 기획서 전체가 Cycle 넷을 넘어가면 §1 의 "한 세션에 잘리는가" 로 돌아간다 — 기획서를 나눈다.
- **확장 Cycle** (원본 §18) — 기존 `cycles/*/spec.md` 의 Semantic/Rule 을 복사·재작성하지 않고
  그 위에 추가함을 SOURCE 에 적는다.
- **금지** (원본 §6) — Service · Repository · Manager · Component 같은 코드 구조를 여기 쓰지 않는다.
  모든 State/Rule 은 컨텐츠의 의미다 — 기반(engine)은 게임 명사를 모른다. 기구 추출은 실현(cycle)의 몫.
- 컨텐츠 행(미지)의 Cycle 이면 README §4 열 질문의 답이 첫 spec 에 있는지 본다 — 없으면 UNRESOLVED.
- **기반 Cycle 의 경험 값은 UNRESOLVED 가 아니다** — 문구 · 숫자 표기 · 무엇을 판에 세우나 · 임계 · 자락 크기처럼 경험을 가르는 값은 Human 에게
  묻지 않고 **Data Knobs 에 자리와 기본값**으로 둔다 (기본값은 기존 코드의 값 · 기획서가 준 값 · 없으면 가장 단순한 것). 묻는 것은 계약 결정(형 · 축 · 경계)뿐.

## 3. Spec 한 장 — 컨텐츠 A 등급 (데이터만)

미지가 A 등급(Tool-Scale §2 — 규칙 없이 기존 축의 데이터만으로 선다)이면 Cycle 이 없다. `cycles/` 에 폴더를 만들지 않고
그 `M<N>-*.md` 문서 끝에 `## Spec` 절 하나를 더한다 — 데이터가 채울 자리(어느 파일 · 어느 표 · 값) · 검사(`npm run world:check` 가 무엇을 단언하나) ·
Human 판정 한 줄(걸어 본다 — 무엇이 보여야 하나) · UNRESOLVED(세계관 사실 · 이름 · 값 중 기획서에 없는 것). 규칙이 하나라도 필요해지면 A 가 아니다 —
B 로 올리고 §1 로 돌아간다 (보고에 등급 변경을 적는다). A 의 실현은 데이터 커밋 하나이므로 cycle 스킬을 부르지 않는다 — Human 이 "넣어" 라 하면
데이터를 채우고 검사를 돌리고 판정을 청한다.

## 4. 반환 — Human 게이트 앞에서 멈춘다

**Cycle 목록 + spec 전부 + 질문 목록**(첫 spec 의 UNRESOLVED)을 한 번에 Human 에게 올리고 멈춘다. spec 파일들은 main 에
커밋한다 (코드가 아니다 — 브랜치 없음). 커밋 메시지 한 줄: `HktAdvProtoI: <기획서> → C###~C### spec · 질문 N`.
자를 수 없어 나누기를 제안했으면 커밋할 것이 없다 — 나눌 자리만 보고한다.

- `plan/` 은 쓰지 않는다 — 승인 기입(CYCLES §1 레인 · DESIGN §3 그 기획서 절의 덮음 · §1/§2/§5 · STATE · TODO)은 "C### 진행" 을 받은 `advprotoi-cycle` 이 한다.
  제안 상태는 spec 파일 자체가 말한다 (UNRESOLVED 가 있는 첫 spec = 제안 대기).
- 보고의 마지막 줄은 다음 단계의 문구다: **"답과 함께 `C### 진행`"** (advprotoi-cycle). UNRESOLVED 가 비어 있어도 같다 — "C### 진행" 은 Cycle 목록 승인이지
  질문의 유무가 아니다. 이 스킬은 어떤 경우에도 cycle 을 자동으로 잇지 않는다.
- Human 이 답을 주며 spec 을 고쳐 달라 하면(승인 전) 같은 파일을 다시 쓴다 — 동결 전이므로 고쳐도 된다. 동결 뒤에는 이 스킬이 spec 을 만지지 않는다.
