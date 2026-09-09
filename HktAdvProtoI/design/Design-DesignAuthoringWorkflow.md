# Design — 주입 → 묶음 → Cycle Workflow

상태: 승인
원본 관계: [Design-CycleExecutionWorkflow.md](Design-CycleExecutionWorkflow.md) 의 **위층 확장**이다.
Cycle 자체(명세 → 실현 → 마감)는 그 문서가 그대로 소유한다 — 이 문서는 사람의 기획서에서
**첫 Cycle 의 spec** 까지, 그리고 Cycle 들이 끝난 뒤의 **실주행 판정**까지만 정의한다.

## 1. 목적

게임의 큰 방향과 시스템 기획으로부터 **실제 플레이 경험 하나**를 잘라 내고, 그것을 작은
Cycle 들로 구현 Workflow 에 전달한다.

핵심 원칙: **큰 기획을 기능 목록으로 직접 분해하지 않는다.** 기획서에서 "실제로 플레이되는
결과 하나" 를 먼저 자르고, 그 경험을 만드는 데 필요한 World 변화만 Cycle 로 구현한다.

```text
기획서(L<N> · M<N> · design/) → 묶음 (첫 Cycle 의 spec.md 머리 블록) → Cycle → Cycle → … → 실주행 판정
```

기획서와 Cycle 사이에 별도 문서 층을 두지 않는다 — Play Design · Master Graph · Intent Graph ·
Capability Graph 는 없다. 의미의 출처는 기획서 하나이고, spec 은 기획서를 직접 인용한다.

## 2. 계층과 산출물

```text
design/
  Design-*.md            시스템 기획 = 각 영역이 어떤 원리로 작동하는가 (Human 원본)
content/roadmap/         주입의 규약(README.md)과 그 결과물 — 이 세계의 것이므로 content/ 에 둔다
  L0-Game.md             게임 전체 경험 방향 1개
  L<N>-*.md              기반 층 — 층별로 Human 이 확정한 문서
  M<N>-*.md              컨텐츠 층 — 미지(지역·생물·자원·구조) 하나에 대해 Human 이 준 세계관 사실
cycles/C###-이름/
  spec.md                이번 Cycle 의 범위 + 명세 — Cycle 공정이 한 번에 쓴다.
                         묶음의 첫 Cycle 이면 머리에 "묶음" 블록이 있다 (§5)
  shots/                 마감 촬영
plan/                    작업 관리 — STATE(어디까지) · TODO(할 일) · DESIGN(기획서 덮임) · CYCLES(묶음 · 레인 · 판정 · 부채)
codemap/                 코드에 있는 것 — API 명세와 구조
```

| 계층 | 질문 |
|---|---|
| L0-Game.md | 이 게임은 궁극적으로 어떤 경험인가? |
| design/*.md · L<N>-*.md (시스템 · 층) | 각 영역이 어떤 원리로 작동하는가? |
| M<N>-*.md (미지) | 이 세계에 무엇이 존재하는가 — 지역·생물·자원·구조 하나 |
| spec.md 의 묶음 블록 (+ 뒤 Cycle 의 spec 초안) | 그 기획에서 지금 어떤 플레이 하나를 세우는가 — 어느 Cycle 들로, 각각 무엇을? |
| spec.md 범위 절 | 이번 Cycle 에 무엇을 작게 플레이 가능하게 만드는가? |
| 명세 / 실현 / 마감 | (Cycle 공정 그대로 — advprotoi-cycle) |

## 3. Level 0 — Game Direction (`content/roadmap/L0-Game.md`)

게임 전체에서 변하지 않는 **경험 방향**만 정의한다. 기능·콘텐츠를 정의하지 않는다.
Core Experience 한 단락 + **Core Breath**(게임 전체의 가장 큰 호흡, 예:
미지 → 호기심 → 접촉 → 위험 → 관찰 → 이해 → 시도 → 극복 → 성장 → 새로운 미지)를
담는다. Core Breath 는 모든 플레이가 그대로 따라야 하는 틀이 아니라, 새 시스템·
묶음을 자를 때 "이것이 우리 게임이 추구하는 경험과 맞는가"를 판단하는 상위 기준이다.

## 4. Level 1 — System Design (`design/` · `L<N>-*.md`)

특정 지역·몬스터가 아니라 각 영역(World·Player·Exploration·Combat·Growth·Item·NPC …)
이 **어떤 원리로 플레이 경험을 만들어내는지** 정의한다. 완료 조건:

```text
이 시스템은 무엇인가? / 왜 게임에 존재하는가? / 플레이어에게 어떤 경험을 만드는가?
세계 안에서 어떤 원리로 작동하는가? / 다른 시스템과 어떤 방식으로 만나는가?
```

세부 콘텐츠·구현 명세까지 작성하지 않는다. Human 원본이다 — Agent 는 고치지 않는다.

## 5. 묶음 — 기획서에서 플레이 하나를 자른다 (첫 Cycle 의 spec.md 머리)

**기획서와 Cycle 을 잇는 유일한 단계.** 기획서는 원리를 말하고, 묶음은 그 원리들이 실제
플레이 하나에서 어떻게 만나는지를 말한다. 별도 문서가 아니라 **첫 Cycle 의 `spec.md` 머리 블록**이다
— 뒤 Cycle 의 spec 은 그것을 SOURCE 로 인용만 한다.

```text
## 묶음 — <이름>
기획서     content/roadmap/L2-World-Foundation.md §2.8 · §5 (+ 지목한 design/ 문서)   ← 의미의 유일한 출처
행         기반 층 L<N> 또는 컨텐츠 층 M<N> — 이 묶음이 세우는 로드맵의 행 하나 (기반 층이면 놓는 미지 M<N> 도)
Goal       플레이어가 실제로 무엇을 하는지 한 문장 — 완료를 직접 확인할 수 있게
           ("숲의 공포를 경험한다" ✗ / "포식자를 죽이지 않고 영역 내부의 자원을 획득한다" ○)
Intent     Start / End — 플레이 전후 경험 상태의 변화. 뒤 Cycle 의 범위 판단 기준
Breath     감정 전이 사슬 (강도 숫자 금지 — 어떤 경험 뒤에 다음 상태로 넘어가는지)
Cycle      C### 이름 — 한 줄 목표 · 그 spec 의 경로   (2~4개 · 순서는 의존성 + Breath 의 점진 완성. 번호는 전 이름공간 최대+1 부터)
           C### …                                      **모든 Cycle 의 spec 초안을 이때 함께 쓴다** — 뒤 Cycle 은 자기 폴더에 초안으로
미지       이 묶음이 놓는 미지 하나 (2층: 지역 · 3층: 생물 · 4층: 자원) — 이름은 Human
검사       컨텐츠 행이면 로드맵 열 질문 ①~⑩ 의 답 (README §4). 없는 답은 아래 질문으로
질문       게임 의미 — 수치 · 확률 · 시간 · 범위 · 원리의 확정 · 세계관 사실. 이 묶음 전체의 것을 여기 모은다.
           첫 Cycle 의 UNRESOLVED 가 곧 이 목록이다
```

- **AI 가 자른다** — Goal · Intent · Breath · Cycle 분할 · World Cause(사건마다 세계 안의 원인). 방향 한 줄만
  주입돼도 이 층은 AI 가 지어 올린다 (승인으로 확정되므로 창작이되 독단이 아니다).
- **Human 이 정한다** — 게임 의미. AI 는 지어내지 않고 "질문" 에 모은다. 판단이 서지 않으면 질문으로 올린다 —
  주입물의 의도를 크게 벌리는 선택(목표 자체를 바꾸는 갈래)도 질문에 함께 적는다.
- 묶음 하나는 로드맵의 **행 하나**만 세운다. 확정되지 않은 축의 의미가 필요해지면 Required 가 아니라 질문으로 남긴다.
- **묶음의 Cycle 전부가 spec 초안으로 선다** — 첫 Cycle 의 spec 은 머리에 묶음 블록을 가지고 동결 후보이며, 뒤 Cycle 의 spec 은 자기 폴더에
  초안으로 서서(머리에 "초안 — 앞 Cycle 의 「다음 Cycle 로」 를 받아 자기 차례에 동결") 이어서 진행할 수 있게 한다. 묶음 질문은 첫 spec 에 모으고,
  뒤 spec 은 그 답을 물려받는다. 한 spec 만 쓰고 멈추지 않는다 — 이어서 진행할 수 없기 때문이다.
- 기획서가 커서 묶음 하나에 안 담기면 묶음 여럿을 순서대로 제안한다 — 첫 묶음만 spec 들까지 쓰고, 나머지는
  `plan/DESIGN.md` 의 "다음 묶음 후보" 에 한 줄씩.
- 각 Cycle 은 작다 · 플레이 가능하다 · World 변화가 분명하다 · 화면 또는 상태로 확인할 수 있다 · 검증할 수 있다 ·
  이후 Cycle 에서 재사용할 수 있다.

## 6. Cycle 들의 spec — 첫 것은 같은 파일에 이어 쓰고, 뒤 것은 자기 폴더에 초안으로

묶음 블록 아래에 첫 Cycle 의 spec 을 그대로 쓴다 (Cycle 공정의 형식 — 범위 절 · SPEC · State · Rule · Observable · UNRESOLVED).
**UNRESOLVED 에 묶음 질문 전부**를 둔다 — 뒤 Cycle 의 것도 여기서 한 번에 묻는다. 뒤 Cycle 의 spec 은 `cycles/C###-이름/spec.md` 에
같은 형식의 **초안**으로 함께 쓴다 — 머리에 묶음의 첫 spec 링크와 "초안" 표시, UNRESOLVED 에는 "묶음 질문 Q<n> 의 답이 이 spec 에 든다" 와
그 spec 에서 새로 생긴 의미만.

```text
# C### — <이름>
## 묶음 — <이름>            (§5 의 블록 — 묶음의 첫 Cycle 에만)
CYCLE / SOURCE / SELECTED_FROM   SOURCE = 기획서 절 (+ 근거 design/ 문서) · SELECTED_FROM = 묶음의 Cycle 목록 또는 "Human"
## Playable Goal     이번에 성립할 플레이 결과 한두 문장
## Experience Intent 이 Cycle 이 만드는 경험 전환 — 묶음 Breath 의 어느 구간
## World Change      세계에서 무엇이 어떻게 변하는가
## Observable Result 화면/상태에서 무엇을 직접 확인하는가
## Reuse             Existing / Added
## Out of Scope      이번에 하지 않는 것과 그것을 받을 Cycle
(이어서 SPEC · State · Rule · Observable · UNRESOLVED — Cycle 공정)
```

## 7. 게이트 — "C### 진행" 하나

Human 게이트는 **묶음마다 한 번**이다: 묶음 블록 + 첫 spec + 질문 목록을 한 번에 올리고, Human 이 답과 함께
"C### 진행" 이라 말하면 묶음이 승인되고 spec 이 동결된다. Goal · Intent · Breath · Cycle 목록에 개별 게이트를 두지 않는다.
답이 오지 않은 질문이 남으면 spec 은 동결되지 않는다 (UNRESOLVED > 0 — Cycle 공정의 정지 규칙 그대로).

뒤 Cycle 은 게이트가 없다 — 첫 spec 의 답을 물려받고, 초안을 자기 차례("C### 진행")에 앞 Cycle 마감이 남긴 「다음 Cycle 로」 를 반영해 동결한다.
자기 spec 에서 새로 생긴 의미만 UNRESOLVED 로 묻는다.

## 8. Verification 의 두 층

- **Functional Verification** — 자동 검증 가능한 World State 변화 (Cycle 공정 그대로).
- **Experience Verification** — 실제 플레이에서 묶음의 Intent 가 성립하는지 관찰한다. 감정을 숫자로 검증하는
  것이 아니라 **의도한 인지·행동 변화가 실제로 발생하는지** 본다. 판단은 Human 의 몫이다 — Cycle 마감이 관찰
  항목을 `plan/CYCLES.md` 그 묶음 절에 남기고, Human 이 **묶음 단위**로 판정한 뒤 지운다 (§9 — Cycle 마다 판정하지 않는다).

## 9. 묶음의 마지막 Cycle 뒤 — 실주행 판정

묶음의 마지막 Cycle 이 합쳐지면 원래 Goal 을 실제로 수행할 수 있어야 하고, Breath 가 실제 플레이에서 어느
정도 성립하는지 확인한다. 이것이 **실주행 판정**이다:

```text
AI 예심    관찰 항목을 셋으로 가른다 — A 그림·테스트가 이미 단언하는 것(닫는다) · B 사람 눈이 필요한 것 ·
          C Human 이 값·규칙을 정할 것. B·C 를 묶음당 질문 대여섯으로 압축해 plan/CYCLES.md 그 묶음 절에 둔다
Human     npm run dev 로 Goal 을 한 번 플레이하며 그 질문에 답한다 — 예 / 아니오 / 값
반영      통과는 지운다. 실패는 DESIGN GAP 이 되어 §10 의 셋째 주입이 된다. 질문이 전부 비면 로드맵의 행이 닫힌다
```

완료된 Capability 는 다음 묶음에서 다시 사용하며, 이 반복으로 게임 전체가 점진 확장된다.

## 10. 주입 — 세 종류

이 공정의 기본 사용법은 **주입 한 번 → 묶음 + 첫 spec → "C### 진행"** 이다.

```text
기반 층 주입    축 하나 — 방향 한 줄 · 기획서 · design/ 문서 지목. 위에서 아래로 하나씩, 열린 층만 받는다
              (열린 층은 plan/DESIGN.md §1). 그 층의 묶음은 축을 세우면서 미지를 하나 놓는다.
컨텐츠 층 주입  미지 하나 — 지역 · 생물 · 자원 · 구조 (이름 + 종류 + 세계관 사실). 요구 축이 전부 확정이면 언제든.
              먼저 등급을 가른다 (L2-World-Tool-Scale §2) — A 데이터만(묶음 없음 · Spec + 검사 + Human 판정) ·
              B 규칙 하나(Cycle 하나) · C 새 축(기반 층의 새 행). 로드맵 열 질문 ①~⑩ 을 통과시킨다.
실주행 GAP 주입  §9 에서 "아니오" 로 돌아온 질문 — 새 축도 새 미지도 아니다. 기존 묶음에 Cycle 을 더하거나,
              여럿에 걸치면 관찰 가능성 묶음 하나로 자른다. 로드맵의 행은 새로 올리지 않는다.
```

- 채팅으로 온 주입물은 `content/roadmap/` 에 그 층의 결과물(`L<N>-*.md` · `M<N>-*.md`)로 보존한다 — 그것이 Source 다.
- **L0-Game.md 와 시스템 문서는 있으면 참조하고, 없어도 막지 않는다.** 주입물 자체가 그 자리의 근거다.
- 주입의 **순서**는 [content/roadmap/README.md](../content/roadmap/README.md) 가, 층 · 행의 상태와 기획서의 덮임 ·
  남은 것은 `plan/DESIGN.md` 가 소유한다. 확장성은 열거된 그래프가 아니라 `선 축들 × 미지들` 의 조합에서 나온다.

## 11. Human / AI 역할

```text
Human   결정: 게임 전체 방향 / 시스템 핵심 원칙 / 게임 의미(수치·확률·시간·범위, 세계관 사실) / 실주행 판정
        승인: 묶음(Goal · Intent · Breath · Cycle 목록) — AI 가 제안한 것을 "C### 진행" 으로 승인·수정한다
AI      수행: 기획서 읽기 / 묶음 자르기 / Experience → World Cause 변환 / Cycle 분할 / spec 작성 / 실현 / 검증 / 예심
        제안: Goal · Intent · Breath (주입물이 말하지 않았으면)
```

**플레이 층**(무엇을 하게 할 것인가, 어떤 호흡으로, 어떤 사건과 세계 인과로)은 AI 가 지어 올리고 Human 이
승인한다. **게임 의미**(그 사건이 성립하는 수치·원리·세계관 사실)는 AI 가 정하지 않는다 — 질문으로 올라간다.

문서 소유권: `L0-Game.md` · `L<N>-*.md` · `M<N>-*.md` · 시스템 문서는 Human 원본이다. `spec.md` 는 AI 가 쓰고
동결 뒤 아무도 고치지 않는다 (의미를 바꿔야 하면 새 Cycle). `plan/` 은 공정이 갱신하는 살아 있는 문서다.

## 12. Artifact 생성 규칙

```text
생성한다      시스템 문서 (영역별 1개) · L<N>-*.md (기반 층별) · M<N>-*.md (미지별) · cycles/C###/spec.md · shots/ ·
             plan/ 의 항목 (절이 비면 절을 지운다)
생성하지 않는다  Play 문서 · Master Graph · Intent Graph · Possibility Graph · Capability Graph · Experience Graph ·
             Frontier 문서 · 별도 Breath/World Cause 문서 · 구현 노트 · 검증 산문
```

"다음에 무엇을 만들까" 는 첫 spec 의 묶음 블록(Cycle 목록)과 `plan/CYCLES.md` 레인 표가 답한다. 열린 묶음이
없으면 Human 이 기획서를 지목하고 AI 가 묶음을 자르는 것이 곧 탐색이다.

## 13. 공정의 핵심 규칙 6개

1. 큰 시스템을 기능 목록으로 직접 분해하지 않는다 (Combat → Parry/Counter/Break 식 금지).
2. 항상 실제로 플레이되는 결과 하나(묶음)를 먼저 자른다.
3. 묶음에는 반드시 경험의 호흡(Breath)이 존재한다.
4. 모든 중요한 감정 변화에는 게임 안의 원인(World Cause)이 있어야 한다.
5. Cycle 은 기능 단위가 아니라 **최소 Playable Experience 단위**다
   ("ThreatDetection 구현"이 아니라 "주변 생물의 행동으로 보이지 않는 위험을 알아차릴 수 있다").
6. 의미의 출처는 기획서 하나다 — 묶음도 spec 도 기획서를 인용하지 다시 쓰지 않는다. 구현 Workflow 는 건드리지 않는다.
