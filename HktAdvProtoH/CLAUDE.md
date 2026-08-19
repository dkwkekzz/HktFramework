# CLAUDE.md

HktAdvProtoH — 목적 트리 기반 오픈월드 어드벤처 프로토타입.

## 목표

mmorpg에서 컨텐츠를 구성하기 위한 구조를 설계한다.
여기서 단조롭게 채집물, 퀘스트 제공하는 npc, 몬스터를 배치하는 것으로는 일반적인 mmorpg를 벗어날 수가 없다.
우리는 세계의 규칙과 상태를 정의함으로 그 세계에서 굴러가는 게임을 설계해야 한다.
그 결과로 만화 헌터헌터 수준의 **캐릭터 능력 표현의 근본적이고 깊은 설계, 방대한 다채로운 세계관**이 도출되어야 한다.

개발의 기본 단위는 **Cycle** — 현재 게임에 플레이 가능한 Delta 하나를 더한다.

> **다음에 무엇을 하는가** — 후보와 그 순서, 각 층이 막힌 이유, Human 의 선택 기록은
> [master/frontier.md](master/frontier.md) 가 소유한다. 이 문서는 원칙과 인덱스만 담는다.

## 두 층

Workflow 는 두 층이다. 무엇을 왜 만들지 정하는 층과, 그것을 실제로 닫는 층을 분리한다.

```text
MASTER LAYER   master/    WHY → OPTIONS → NEED → NEXT — 무엇을 왜 만들지 결정한다
               지속적으로 자라는 하나의 Typed Graph. History 가 아니라 현재 상태다
                   Goal → (OR) Possibility → (AND) Capability
                   → Existing World Overlay → Frontier
                   Constraint 는 각 선택 지점의 Filter 다 — 단계가 아니다

CYCLE LAYER    cycles/    선택된 하나의 플레이 결과를 World Semantic 과 Rule 로 폐쇄한다
               기존 8 Stage. Master 도입으로 이 공정은 변경되지 않는다
```

접합점은 **둘뿐**이다. 그 외 경로로 두 층이 서로를 건드리지 않는다.

```text
아래로   master/frontier.md 의 SELECTED   →  01-cycle.md 의 MASTER TRACE
위로     08-verification.md 의 MASTER FEEDBACK  →  master/overlay.md · candidates/ 반영
```

Cycle Agent 는 `master/` 를 편집하지 않는다 — 보고까지가 Cycle 의 책임이다.
Master Agent 는 `world/` `view/` 를 편집하지 않는다 — Overlay 판정을 위해 읽기만 한다.

정책 원본: [design/Master-Intent-Graph-Policy.md](design/Master-Intent-Graph-Policy.md)

## 기반 / 컨텐츠 경로 규약

기반(Engine)과 컨텐츠(팩)는 물리적으로 분리되어 있다
([design/Design-System-Content-Separation.md](design/Design-System-Content-Separation.md)).

```text
engine/            기반 — world-kernel · physics(기본 세계 규칙 솔버) · view-kernel ·
                   protocol-core. 컨텐츠 작업 중 어떤 Agent 도 편집하지 않는다 (기반 트랙
                   전용). 팩의 시스템은 physics 솔버를 조합해 만든다 — 직접 재구현하지 않는다
content/<pack>/    컨텐츠 팩 = 교체 단위 — master/ cycles/ world/ view/ protocol/ motions/
hkt.pack.json      활성 팩 선언 (공정·도구용) — 코드 조립은 content/active*.ts 가 맡는다
```

이 문서와 `guides/` 의 `master/` `cycles/` `world/` `view/` 경로는 **활성 팩 루트 기준**이다
(현재: `content/proto-adventure/`). `guides/` `design/` `tools/` 는 프로젝트 루트 기준.
다른 Master Graph Root 로 작업한다 = 새 팩을 만든다 — 기반은 그대로 둔다.
경계는 `npm run boundary:check` 가 강제한다 (engine→content import 금지 · 팩 간 격리).

## 읽는 순서

모든 Agent 는 다음 셋만 읽고 작업한다.

```text
1. CLAUDE.md              이 문서 — 공통 불변 규칙
2. guides/<stage>.md      자기 단계의 작업 방법
3. 입력 Artifact          Cycle 이면 cycles/<CycleId>/… · Master 면 master/…
```

필요한 경우에만 관련 기존 Capability Artifact 나 코드를 추가로 확인한다.
`design/` 전체 문서는 일반적인 작업 Context 가 아니다.

단계 실행은 스킬이 담당한다 — 다음 미완료 Stage 판정, 공통 규칙 상세, Artifact 형식을
스킬이 로드한다. 따라서 이 문서에는 원칙과 인덱스만 둔다.

```text
Cycle Stage    advprotoh-cycle 스킬
Master Stage   advprotoh-master 스킬
```

## 핵심 원칙

```text
 1. AI Agent 는 전체 설계 문서를 매번 읽지 않는다.
 2. CLAUDE.md 는 프로젝트 전체 공통 불변 규칙을 제공한다.
 3. 각 Stage Guide 는 해당 단계의 작업 방법만 제공한다.
 4. 각 Agent 는 이전 Artifact 를 입력받아 다음 Artifact 를 만든다.
 5. Artifact 가 Agent 간 Context 전달 수단이다. 대화 History 가 아니다.
 6. Cycle 은 기능 Module 이 아니라 하나의 플레이 가능한 Game Delta 다.
 7. 새 Cycle 은 기존 Capability 를 재사용하거나 확장하거나 변경할 수 있다.
 8. 과거 Cycle Artifact 는 History 로 보존한다.
 9. 현재 World 와 View 는 Cycle 을 거치며 계속 발전한다.
10. 기존 Semantic 변경 시 REUSED / ADDED / CHANGED / AFFECTED 를 명시한다.
11. 영향을 받는 기존 Rule 과 플레이 Scenario 도 함께 검증한다.
12. World 는 Authoritative Server 이고 View 는 독립적인 Client 다.
13. World → View 계약은 GameView Specification 이다.
14. View 는 GameView Specification 만으로 동작할 수 있어야 한다.
15. 최종 완료 조건은 코드 작성이 아니라 실제 Cycle Goal 의 플레이 가능성이다.
16. Cycle Goal 은 Master Layer 의 Frontier 에서 온다 — 없으면 그 사유를 적는다.
17. Constraint 는 Goal/Possibility/Capability 의 **형태**를 제한할 뿐, 시스템 목록을
    직접 만들지 않는다. Capability 의 필요성은 Possibility 에서 나온다.
18. Master 에는 플레이 의미를, Cycle 에는 수치·공식·판정을 둔다.
19. Constraint 의 승격·변경과 다음 Cycle Goal 선택은 Human 이 결정한다.
20. 살아 있는 문서(README·overlay·frontier·open-questions·graph 본문)에는 **현재 상태만**
    둔다. 완료·승인·삭제의 경위와 날짜를 본문에 남기지 않는다 — 닫힌 것은 그 자리에서
    지우고 master/HISTORY.md 로만 옮긴다. 상태 필드(status: APPROVED 등)가 곧 기록이다.
```

## Kind 정적 데이터

존재 종류(CharacterKind)의 정적 데이터는 3원소(world 카탈로그 · view kind 표현 · `motions/<kind>/`)에만
둔다. 세부 규칙은 각 Stage Guide(World / View Implementation · Verification)가 담당한다.
관찰·정합 검사: `npm run catalog` / `npm run catalog:check`.

## Master Graph 관찰

`master/graph/*.yaml` 은 사람이 눈으로 읽기 어렵다. 관찰·정합 검사는 도구가 맡는다.

```text
npm run master:graph         GRAPH.md + 뷰어 + Artifact 판을 다시 만든다
npm run master:graph:check   정합성 + GRAPH.md 최신 여부만 확인한다 (아무것도 쓰지 않는다)
```

`graph/` `constraints/` 를 고친 Agent 는 **재생성물을 같은 커밋에 넣고 고정 링크를 갱신한다**
— 절차와 그 링크는 [master/README.md](content/proto-adventure/master/README.md) 의 "관찰" 이
소유한다. 여기에 링크를 복사해 두지 않는다.

## 막혔을 때

이전 단계에서 확정된 의미를 임의로 바꾸거나 없는 의미를 만들어내지 않는다.
부족한 내용을 명시하고 그 의미를 책임지는 단계로 반환한다.

```text
GAP
Required   무엇을 표현해야 하는가
Missing    무엇이 없는가
Reason     왜 현재 입력으로 불가능한가
Return To  어느 단계가 이 의미를 책임지는가
```

반환 방향은 정해져 있다. 마지막 하나가 두 층 사이의 반환이다.

```text
View 정보 부족             → GameView Specification
Spec 정보 부족             → World Semantic
Semantic 정보 부족         → Intent
Intent 가 Goal 과 불일치    → Cycle Definition (Human)
Cycle Goal 이 상위 Possibility / Constraint 와 어긋남 → MASTER (Human)
```

## Master Step 인덱스

Master 의 기본 절차는 `WHY → OPTIONS → NEED → NEXT` 4단계뿐이다 (정책 §9).

| Step | Guide | Artifact |
|---|---|---|
| 1. WHY — World/Actor/Goal | [guides/master-graph.md](guides/master-graph.md) | `master/graph/` world-state·actors·knowledge·goals |
| 2. OPTIONS — 대안 Possibility | [guides/master-graph.md](guides/master-graph.md) | `master/graph/possibilities.yaml` |
| 3. NEED — Capability + Overlay | [guides/master-graph.md](guides/master-graph.md) · [guides/master-overlay.md](guides/master-overlay.md) | `master/graph/capabilities.yaml` · `master/overlay.md` |
| 4. NEXT — Frontier 후보 | [guides/master-frontier.md](guides/master-frontier.md) | `master/frontier.md` |
| Human Select | Human | `frontier.md` 의 `SELECTED` → Cycle Stage 1 |
| Feedback (위쪽 접합점) | [guides/master-feedback.md](guides/master-feedback.md) | `overlay.md` · `frontier.md` · `candidates/` |
| Inject (기반 기획 주입) | [guides/master-inject.md](guides/master-inject.md) | `constraints/`(DRAFT) · `graph/`(§ provenance) · `overlay.md` · `open-questions.md` |

Constraint 정비는 Step 이 아니다 — Human 요청 시에만
[guides/master-constraint.md](guides/master-constraint.md) (`master/constraints/DC-*.yaml`).
Root Game Goal / World Premise (`master/root.md`) 와 Constraint 승인은 Human 소유다.
파일 형식의 단일 출처는 [master/SCHEMA.md](master/SCHEMA.md) 다.

## Cycle Stage 인덱스

| Stage | Guide | Artifact |
|---|---|---|
| 1. Cycle Definition | [guides/cycle-definition.md](guides/cycle-definition.md) | `01-cycle.md` |
| 2. Intent | [guides/intent.md](guides/intent.md) | `02-intent.md` |
| 3. World Semantic | [guides/world-semantic.md](guides/world-semantic.md) | `03-world-semantic.md` |
| 4. GameView Specification | [guides/gameview-spec.md](guides/gameview-spec.md) | `04-gameview.spec.yaml` |
| 5. Human Semantic Review | Human | `05-review.md` |
| 6. World Implementation | [guides/world-implementation.md](guides/world-implementation.md) | `world/` + `06-world-implementation.md` |
| 7. View Implementation | [guides/view-implementation.md](guides/view-implementation.md) | `view/` + `07-view-implementation.md` |
| 8. Verification | [guides/verification.md](guides/verification.md) | `08-verification.md` |

각 단계의 MUST / MUST NOT / DONE WHEN 은 해당 Guide 에 있다. 여기에 중복해 두지 않는다.

## 디렉터리 인덱스

팩 경로는 활성 팩 루트(`content/proto-adventure/`) 기준이다.

| 경로 | 내용 | 수명 |
|---|---|---|
| [guides/](guides/) | Stage Guide — 단계별 작업 방법·완료 조건 | 공정이 바뀔 때만 |
| `<pack>/master/` | Master Intent Graph — Constraint · Graph · Overlay · Frontier | 현재 상태만, 닫히면 지운다 |
| `<pack>/master/HISTORY.md` | 닫힌 질문·선택·갱신의 보관소 | 조회용, 평소 읽지 않는다 |
| `<pack>/cycles/` | Cycle Artifact — 진행 기록 | History, 수정하지 않는다 |
| `<pack>/world/` | Authoritative World 구현 (Server) — 팩의 Rule·Semantic·투영 | 현재 게임, 계속 발전 |
| `<pack>/view/` | Client View 결정 Layer — presentation 표·문구·바인딩 | 현재 게임, 계속 발전 |
| `<pack>/protocol/` | 팩의 GameView·Action 확장 타입 | 현재 게임, 계속 발전 |
| `<pack>/motions/` | 모션 시트 — 폴더 규약 자동 발견 | 현재 게임, 계속 발전 |
| [engine/](engine/) | 기반 — 커널·Capability·봉투. 컨텐츠 작업에서 편집 금지 | 기반 트랙 전용 |
| [design/](design/) | 원본 설계 — 경계 사례에서만 참조 | 원본 |

## 기준 문서 (Source of Truth)

| 문서 | 내용 |
|---|---|
| [Design-Concept.md](design/Design-Concept.md) | 세계와 주체의 행동 구조 — 무엇이 존재하고 어떤 변화가 가능한가 |
| [Master-Intent-Graph-Policy.md](design/Master-Intent-Graph-Policy.md) | **Master Layer 정책** — Constraint · Graph · Overlay · Frontier · 두 층의 접합 |
| [Design-Workflow.md](design/Design-Workflow.md) | Goal/Possibility 기반 Observable World 구현 Workflow |
| [Design-CycleWorkflow.md](design/Design-CycleWorkflow.md) | Cycle 단위 점진 개발 공정 |
| [Design-CycleExecution.md](design/Design-CycleExecution.md) | **Agent 실행 방식** — 이 작업환경의 근거 |

`guides/` 는 이 문서들에서 각 단계에 필요한 규칙만 압축한 것이다.

충돌 시 우선순위:

```text
Master Layer 의 의미·절차                     → Master-Intent-Graph-Policy.md
Artifact 이름 · 단계 구분 · Agent 실행 방식   → Design-CycleExecution.md
그 외 공정과 게임 의미                        → Design-Workflow / Design-CycleWorkflow
```

`Design-Workflow` / `Design-CycleWorkflow` 의 Goal/Possibility 는 **Cycle-local** 의미로 읽는다.
지속적인 상위 Goal/Possibility 는 `master/` 가 소유한다 (Master-Intent-Graph-Policy §13).

`Design-CycleWorkflow.md` 의 §33(Artifact 이름 5종)과 §19(Implementation 단일 단계)는
`Design-CycleExecution.md` 가 대체한다 — 실제 규격은 `01-cycle.md` ~ `08-verification.md` 8종,
World / View 구현 2단계다.
