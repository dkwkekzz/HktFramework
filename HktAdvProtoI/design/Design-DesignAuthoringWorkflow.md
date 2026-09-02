# Design — Design Authoring → Cycle Workflow

상태: 승인 (Human 원문 제공)
원본 관계: [Design-CycleExecutionWorkflow.md](Design-CycleExecutionWorkflow.md) 의 **위층 확장**이다.
Cycle 이후(PLAN → BUILD → VERIFY)는 그 문서가 그대로 소유한다 — 이 문서는
사람의 아이디어에서 `00-cycle.md` 까지의 기획 공정만 정의한다.

## 1. 목적

게임의 큰 방향과 시스템 기획으로부터 **실제 플레이 경험**을 설계하고, 이를 작은
Cycle 단위로 분할하여 기존 구현 Workflow 로 전달한다.

핵심 원칙: **큰 기획을 기능 목록으로 직접 분해하지 않는다.** 큰 기획을 실제 플레이
경험으로 구체화한 뒤, 그 경험을 만드는 데 필요한 World 변화만 Cycle 로 구현한다.

```text
Game Direction → System Design → Play Design → Cycle Breakdown
→ Cycle(00-cycle.md) → PLAN → BUILD → VERIFY → 다음 Cycle
```

별도의 Master Graph · Intent Graph · Capability Graph 는 사용하지 않는다.

## 2. 계층과 산출물

```text
design/
  Design-*.md 등 기존   시스템 기획 = Level 1 (이 저장소는 systems/ 폴더 대신
                       기존 design/ 문서 체계를 System Design 층으로 그대로 쓴다)
content/roadmap/       주입 순서(README.md)와 그 결과물 — 이 세계의 것이므로 content/ 에 둔다.
                       로드맵은 두 층이다 — 기반 층(축의 순서) · 컨텐츠 층(미지의 목록)
  L0-Game.md           게임 전체 경험 방향 1개 (Level 0)
  L<N>-*.md            기반 층 — 층별로 Human 이 확정한 문서
  M<N>-*.md            컨텐츠 층 — 미지(지역·생물·자원·구조) 하나에 대해 Human 이 준 세계관 사실
  play/<PlayName>.md   실제 플레이 경험 1개당 1문서 (Level 2) — 로드맵의 행 하나를 증명한다
cycles/C###-이름/
  00-cycle.md          이번에 플레이 가능하게 만들 최소 단위 (Level 3)
  01-spec.md … 05-verification.md   기존 PLAN/BUILD 산출물 (변경 없음)
```

| 계층 | 질문 |
|---|---|
| L0-Game.md | 이 게임은 궁극적으로 어떤 경험인가? |
| design/*.md (시스템) | 각 영역이 어떤 원리로 작동하는가? |
| M<N>-*.md (미지) | 이 세계에 무엇이 존재하는가 — 지역·생물·자원·구조 하나 |
| play/*.md | 그 시스템들이 실제 플레이 하나에서 어떻게 만나는가? |
| 00-cycle.md | 지금 무엇을 작게 플레이 가능하게 만들 것인가? |
| PLAN / BUILD / VERIFY | (기존 공정 그대로) |

## 3. Level 0 — Game Direction (`content/roadmap/L0-Game.md`)

게임 전체에서 변하지 않는 **경험 방향**만 정의한다. 기능·콘텐츠를 정의하지 않는다.
Core Experience 한 단락 + **Core Breath**(게임 전체의 가장 큰 호흡, 예:
미지 → 호기심 → 접촉 → 위험 → 관찰 → 이해 → 시도 → 극복 → 성장 → 새로운 미지)를
담는다. Core Breath 는 모든 플레이가 그대로 따라야 하는 틀이 아니라, 새 시스템·
플레이를 기획할 때 "이것이 우리 게임이 추구하는 경험과 맞는가"를 판단하는 상위 기준이다.

## 4. Level 1 — System Design (기존 `design/` 문서들)

특정 지역·몬스터가 아니라 각 영역(World·Player·Exploration·Combat·Growth·Item·NPC …)
이 **어떤 원리로 플레이 경험을 만들어내는지** 정의한다. 완료 조건:

```text
이 시스템은 무엇인가? / 왜 게임에 존재하는가? / 플레이어에게 어떤 경험을 만드는가?
세계 안에서 어떤 원리로 작동하는가? / 다른 시스템과 어떤 방식으로 만나는가?
```

세부 콘텐츠·구현 명세까지 작성하지 않는다.

## 5. Level 2 — Play Design (`content/roadmap/play/<PlayName>.md`)

**큰 기획과 Cycle 을 연결하는 핵심 단계.** System Design 들은 각각 독립적인 원리를
정의하고, Play Design 은 그것들을 하나의 실제 플레이 상황에서 결합한다.
작성 순서는 7단계 고정:

### Step 1 — Play Goal

플레이어가 실제로 무엇을 하는지 한 문장. 완료 여부를 직접 확인할 수 있어야 한다.
("숲의 공포를 경험한다" ✗ / "포식자를 죽이지 않고 영역 내부의 자원을 획득한다" ○)

### Step 2 — Experience Intent

플레이 전후 플레이어의 경험 상태 변화(Start/End). 구현 요구사항이 아니라 이후 모든
Play Structure 를 판단하는 기준이다.

### Step 3 — Breath

Experience Intent 가 플레이 시간 안에서 어떻게 변화하는가.
(예: 신비 → 위화감 → 불안 → 공포 → 의문 → 관찰 → 이해 → 재시도 → 통제 → 성취 → 새로운 미지)
감정의 강도를 숫자로 만들지 않는다 — 각 감정이 **어떤 경험 이후** 다음 상태로 변하는지
정의한다.

### Step 4 — Play Structure

각 Breath 를 실제 게임 사건으로 변환한다. (예: 위화감 = "작은 생물들이 갑자기 같은
방향으로 도망간다. 플레이어는 아직 Predator 를 볼 수 없다.")

### Step 5 — World Cause

모든 중요한 플레이 사건에 **세계 안의 원인**을 부여한다. 질문 6개:

```text
무엇이 존재하는가? / 어떤 상태를 가지는가? / 어떤 조건에서 행동하는가?
플레이어는 무엇을 관찰하는가? / 그 관찰로 무엇을 추론할 수 있는가?
플레이어의 행동에 세계는 어떻게 반응하는가?
```

이로써 "불안감을 준다" 같은 추상 기획이 Threat Detection · Flee Behavior ·
Observable Direction 같은 구현 가능한 세계 변화로 변한다.

### Step 6 — Required Capability

Play Structure 구현에 필요한 기능을 Existing / Required 로 나눠 **Play 문서 안에서**
간단히 관리한다. 별도 Capability Graph 를 만들지 않는다.

### Step 7 — Cycle Breakdown

Play 전체를 한 번에 구현하지 않는다. 각 Cycle 조건:

```text
작다 / 플레이 가능하다 / World 변화가 분명하다 / 화면 또는 상태로 확인할 수 있다 /
완료 여부를 검증할 수 있다 / 이후 Cycle 에서 재사용할 수 있다
```

순서는 구현 의존성뿐 아니라 **Play Breath 가 점진적으로 완성되도록** 정한다.
체크박스 목록으로 관리한다 (`[ ] C001 — 생물의 위험 감지와 도주`).

### Play Design 문서 골격

```text
# <PlayName>
## 0. Row               (로드맵의 행 하나 — 기반 층 L<N> 또는 컨텐츠 층 M<N>;
                         기반 층이면 이 Play 가 놓는 미지 M<N> 도 함께)
## 1. References        (L0-Game.md + 관련 시스템 문서 + 미지 문서)
## 2. Play Goal
## 3. Experience Intent  (Start / End)
## 4. Breath
## 5. Play Structure     (Breath 단계별 사건 + World Cause)
## 6. Required Capability (Existing / Required)
## 7. Cycle Breakdown    (체크박스 목록)
```

## 6. Level 3 — Cycle 생성 (`cycles/<CycleId>/00-cycle.md`)

Cycle 하나를 선택하면 `00-cycle.md` 를 만든다. Play Design 전체를 다시 설명하지
않는다 — **이번 구현에 필요한 것만** 가져온다.

```text
# C### — <이름>
## Source            content/roadmap/play/<PlayName>.md (+ 근거 시스템 문서)
## Playable Goal     이번에 성립할 플레이 결과 한두 문장
## Experience Intent 이 Cycle 이 만드는 경험 전환
## World Change      세계에서 무엇이 어떻게 변하는가
## Observable Result 화면/상태에서 무엇을 직접 확인하는가
## Reuse             Existing / Added
## Out of Scope      이번에 하지 않는 것
```

여기까지가 Design 공정이다. `00-cycle.md` 가 승인되면 기존 PLAN Workflow
(`advprotoi-plan`)가 시작된다 — PLAN 은 Experience Intent 를 다시 해석하지 않고,
이미 결정된 플레이 기획을 World 명세로 폐쇄한다.

## 7. Verification 의 두 층

기존 05-verification.md 위에 관점 하나를 더한다.

- **Functional Verification** — 자동 검증 가능한 World State 변화 (기존 그대로).
- **Experience Verification** — 실제 플레이에서 00-cycle 의 Experience Intent 가
  성립하는지 관찰한다. 감정을 숫자로 검증하는 것이 아니라 **의도한 인지·행동 변화가
  실제로 발생하는지** 본다. 판단은 Human 의 몫이다.

## 8. Cycle 완료 후 처리

Cycle 이 완료되면 Play Design 문서의 Cycle Breakdown **체크박스만** 갱신한다
(`[x]`). Graph 를 갱신하거나 새로운 관리 artifact 를 만들지 않는다. 완료된 Cycle 의
World Capability 는 이후 Cycle 에서 그대로 재사용한다.

모든 핵심 Cycle 이 완료되면 원래 Play Goal 을 실제로 수행할 수 있어야 하고, Breath
가 실제 플레이에서 어느 정도 성립하는지 확인한다 — 그때 그 Play 가 완료된 것이다.
완료된 Capability 는 다음 Play 에서 다시 사용하며, 이 반복으로 게임 전체가 점진
확장된다.

## 8.5 주입 경로 — 방향/기획서 → Cycle (기본 진입점)

이 공정의 기본 사용법은 **주입 한 번 → Cycle 생성**이다. 과정을 복잡하게 만들지
않는다 — 단계는 셋뿐이고 Human 승인은 한 번이다.

```text
① 주입    Human 이 방향 한 줄이든 기획서 전문이든 준다 (채팅 텍스트·파일 무관).
          채팅으로 온 주입물은 content/roadmap/ 에 그 층의 결과물로 보존한다 —
          그것이 Source 가 된다.
② 구체화  AI 가 주입물을 Play Design 1문서(7단계)로 구체화한다 (§22 의 AI 수행
          영역 — Play Structure 구체화와 Experience → World Cause 변환). 즉
          **플레이 층은 AI 가 제안하고 승인으로 확정**한다. 다만 게임 의미의
          결정(수치·확률·시간 · 시스템 원리의 확정 · 세계관 사실)은 AI 의 것이
          아니다 — 지어내지 않고 문서 끝 "Human 질문" 목록에 모은다.
          → Human 승인 1회 (Play 문서 통짜 — Goal·Intent·Breath·Breakdown 개별
          게이트를 두지 않는다. 질문 목록이 있으면 답과 함께 승인된다)
③ 생성    승인 즉시 첫 미완료 Cycle 의 00-cycle.md 를 만든다 → plan 으로 이어진다.
```

전제 조건 완화 — **L0-Game.md 와 시스템 문서는 있으면 참조하고, 없어도 막지 않는다.**
주입물 자체가 그 자리의 근거다. 시스템 원리는 주입물이 쌓일수록 design/ 에
점진적으로 두꺼워진다 (한 번에 Game → System 을 완성할 수 없다는 전제).
큰 주입물이면 Play 를 여러 개로 나눠 제안하되, 승인은 여전히 문서당 1회다.

주입의 **순서**는 [content/roadmap/README.md](../content/roadmap/README.md) 가 소유한다.
로드맵은 코드의 기반/컨텐츠 분리와 같은 두 층이고, 주입도 두 종류다.

```text
기반 층 주입    축 하나 — 방향 한 줄 · 기획서 · design/ 문서 지목.
              위에서 아래로 하나씩, 열린 층만 받는다. 그 층의 증명 Play 는 축을
              세우면서 미지를 하나 놓는다 (2층: 지역 · 3층: 생물 · 4층: 자원).
컨텐츠 층 주입  미지 하나 — 지역 · 생물 · 자원 · 구조 (이름 + 종류 + 세계관 사실).
              요구 축이 전부 확정이면 언제든 받는다 — 기반 층 전체를 기다리지 않는다.
              Play 로 구체화하기 전에 로드맵 §4 의 열 질문(세계 인과 여섯 + L0-Game.md §4 넷)을
              통과시킨다 — ①~③ 이 World Cause, ④~⑥ 이 Goal·Required, ⑦~⑩ 이 판정.
              새 축을 요구하는 미지는 컨텐츠 행이 아니라 기반 층의 새 행이다.
```

한 Play 는 행 하나만 증명한다. 확정되지 않은 축의 의미가 필요해지면 Required 가
아니라 Human 질문으로 남긴다. 확장성은 열거된 그래프가 아니라 `선 축들 × 미지들` 의
조합에서 나온다 — 미지가 하나 늘 때마다 모든 축과 곱해진다.

## 9. Human / AI 역할

```text
Human   결정: 게임 전체 방향 / 시스템 핵심 원칙 / 게임 의미(수치·확률·시간·범위,
        세계관 사실) / 실제 플레이 경험 판단
        승인: Play Goal · Experience Intent · Breath · Cycle 범위 — AI 가 제안한
        것을 승인·수정한다 (§8.5 의 승인 1회 게이트)
AI      수행: 기획 문서 읽기 / Play Structure 구체화 / Experience → World Cause 변환 /
        Capability 분석 / Cycle 후보 분할 / Cycle 문서 작성 / PLAN / BUILD / 검증
        제안: Play Goal · Experience Intent · Breath (주입물이 말하지 않았으면)
```

"결정"과 "제안"의 경계가 이 공정의 핵심이다. **플레이 층**(무엇을 하게 할 것인가,
어떤 호흡으로, 어떤 사건과 세계 인과로)은 AI 가 지어 올리고 Human 이 승인한다 —
방향 한 줄만 주입돼도 공정이 굴러가는 이유다. **게임 의미**(그 사건이 성립하는
수치·원리·세계관 사실)는 AI 가 정하지 않는다 — Human 질문으로 올라간다.

Human 은 게임이 무엇이어야 하는가를 결정하고, AI 는 그것을 구현 가능한 인과와 작은
작업 단위로 폐쇄한다.

문서 소유권: `L0-Game.md` 와 시스템 문서는 Human 원본이다. `play/*.md` 는 AI 가
초안을 작성하고 Human 이 문서 통짜로 1회 승인하는 **공동 문서**다 (§8.5) —
승인 전에는 Cycle 을 시작하지 않는다. 승인 후 Agent 가 play 문서를 만질 수 있는
자리는 Cycle Breakdown 체크박스 갱신(§8)뿐이다.

## 10. Artifact 생성 규칙

```text
생성한다      시스템 문서 (영역별 1개) · L<N>-*.md (기반 층별 1개 — 0층이 `L0-Game.md`) ·
             M<N>-*.md (미지별 1개) · play/*.md (플레이별 1개) · cycles/C###/00~05
생성하지 않는다  Master Graph · Intent Graph · Possibility Graph · Capability Graph ·
             Experience Graph · Frontier 문서 · 별도 Breath/World Cause 문서
```

Breath · Capability · Cycle 후보는 전부 해당 `play/*.md` 안에서 관리한다.
Master Graph 탐색 공정(advprotoi-master)은 이 공정으로 **대체·제거**한다 —
"다음에 무엇을 만들까"는 승인된 Play Design 의 Cycle Breakdown 이 답하고,
Play Design 이 하나도 없으면 첫 Play 를 기획하는 것(advprotoi-design)이 곧 탐색이다.

## 11. 공정의 핵심 규칙 6개

1. 큰 시스템을 기능 목록으로 직접 분해하지 않는다 (Combat → Parry/Counter/Break 식 금지).
2. 항상 실제 Play 를 먼저 만든다.
3. Play 에는 반드시 경험의 호흡(Breath)이 존재한다.
4. 모든 중요한 감정 변화에는 게임 안의 원인(World Cause)이 있어야 한다.
5. Cycle 은 기능 단위가 아니라 **최소 Playable Experience 단위**다
   ("ThreatDetection 구현"이 아니라 "주변 생물의 행동으로 보이지 않는 위험을 알아차릴 수 있다").
6. 구현 Workflow 는 건드리지 않는다 — 이 공정은 `00-cycle.md` 까지만 담당하고,
   이후는 기존 PLAN(01·02) / BUILD(03·04·05)를 그대로 사용한다.
