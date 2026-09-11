# design — 설계·기획 원본

이 프로젝트의 설계 문서가 **한자리에** 있다. 공정·기반 문서(컨텐츠를 갈아 끼워도 참인 것)와
이 세계의 컨텐츠 기획 원본(세계관·전투·아이템·스킬·UX)이 함께 산다.

Human 이 작성·개정한 **원본**이다. Agent 는 이 문서들을 바꾸지 않는다 —
승인·개정은 Human 소유다.

> 이 문서들 가운데 상당수는 **아직 코드에 들어오지 않은 것**을 적고 있다.
> 지금 코드에 있는 것은 [`codemap/`](../codemap/README.md) 이, 어떤 기획서가 얼마나 반영됐는가는 [`plan/DESIGN.md`](../plan/DESIGN.md) 가
> 답한다. 무엇을 어떤 순서로 들일지는 [`content/roadmap/README.md`](../content/roadmap/README.md)
> 의 층 순서가 정한다 — 이 폴더는 **재료**이고, 순서대로 들여 확정한 **결과물**(`L0-Game.md` ·
> 층별 확정 문서 · `play/`)은 `content/roadmap/` 에 있다.

## 공정 · 기반

| 문서 | 내용 |
|---|---|
| `Design-Concept.md` | MMORPG 세계 문법 — 존재·상태·주체·법칙·시간, 무엇이 존재하고 어떻게 변하는가 (Level 1 · 로드맵 1층) |
| `Design-Subject-Decision.md` | 주체의 의사결정 — 지식·숙련·경험·선호·목적·가능성 그래프, 주체가 어느 행동을 고르는가 (로드맵 3층 재료) |
| `Design-DesignAuthoringWorkflow.md` | **기획 위층 공정** — 기획서 하나 → 그 Cycle 전부의 spec → Cycle → 실주행 판정 (기획서는 한 세션에 잘리는 크기 — 크면 나눈다) |
| `Design-CycleExecutionWorkflow.md` | **Cycle 실행 공정 원본** — SPEC → SEMANTIC/RULE → IMPL → VERIFY |
| `Plan-Skill-CycleExecutionWorkflow.md` | 공정의 스킬 계획 (advprotoi-inject · spec · cycle 셋 — 경계와 이어 돌리기) · plan/ 회수 규칙 · 병렬 |
| `Design-Workflow.md` | Goal/Possibility 기반 Observable World 구현 Workflow (이전 기준선 참고 문서) |
| `Design-System-Content-Separation.md` | **기반(engine) / 컨텐츠(content) 분리** — 지금 코드가 선 자리 |
| `Design-World-Persistence.md` | 세계 스냅샷과 복구 |
| `Design-Effect-Presentation.md` | 이펙트 장치 |
| `Design-World-Editor-Terrain-Compiler.md` | **세계 제작 도구** — AI World Editor + Terrain Compiler (Human 주입 원문, 약칭 WE · 로드맵 2층의 도구 재료) |
| `Plan-World-Authoring-Engine.md` | WE 를 이 저장소의 engine/content 위에 세우는 설계 (확정) — 받는 것·바꾸는 것·구조·1단계 범위. 결과물은 `content/roadmap/L2-World-Tool.md` |
| `Plan-Place-Observation-Surface.md` | **자리를 관찰하는 표면** — 세계에 뿌리는 글자를 어디에 둘 것인가 · 관찰 상호작용 · 기존 지목(TG) 기반과의 겹침 판정. 결과물은 `content/roadmap/L2-World-Observation.md` (C026~C028 이 세웠다) — 이 문서는 그 재료(실측과 판정)다 |

## 기획서와 Cycle

기획서와 Cycle 사이에 아무 단위도 없다. Cycle 을 세는 단위는 `content/roadmap/` 의 기획서 하나이고, 그 Cycle 전부가 `cycles/C###/spec.md` 로
함께 선다 (첫 spec 의 Trace 에 Cycle 목록). "C### 진행" 이 승인이다 (Design-DesignAuthoringWorkflow.md §5~§7).
기획서 하나는 로드맵의 행 하나만 세운다 — 한 세션에서 Cycle 로 자를 수 없으면 기획서를 나눈다.

## 컨텐츠 기획

| 갈래 | 문서 | 약칭 |
|---|---|---|
| 세계 | 원본은 `design/` 이 아니라 로드맵에 있다 — `content/roadmap/L2-World-Concept.md` (세계관 컨셉) · `L2-World-Region.md` (세계 content 구성 — Region Graph · Rule · Connector · 중첩) · `L2-World-Tool.md` (제작 도구) | WC · WR |
| 성장 | `Design-Fairy-Growth-System.md` · `Design-Growth-Balance-R0.md` · `Design-Fairy-Class-Layer0-R0.md` | — · FC |
| 전투 | `Design-Combat-OffenseDefense-R0.md` · `Design-Combat-DamageType-R0.md` · `Design-Combat-UpperLayer-R0.md` · `Design-Combat-Knowledge-Extension-R0.md` | R1 · DT · UL · CK |
| 지목 | `Design-Targeting-R0.md` | TG |
| 아이템 | `Design-Item-System-R0.md` · `Design-Item-System-R1.md` · `Design-Item-Chain-R0.md` · `Design-Item-Instance-State-R0.md` · `Design-Item-Lifecycle-Progression-R0.md` · `Design-Inventory-Equipment-D1.md` · `Design-Resource-Catalog-R0.md` | IS · IE |
| 스킬 | `Design-Skill-System.md` · `Design-Skill-Execution-Form.md` · `Design-Skill-Effect.md` | SK |
| 존재 | `Design-Autonomous-Behavior-Knowledge-R0.md` · `Design-Creature-Behavior-R0.md` | — |
| 화면(UX) | `Design-View-Inventory-Equipment-UX-D1.md` · `Design-View-Skill-UX-D1.md` | VUX-IE · VUX-SK |

약칭은 근거 인용의 이름이다.

## 승인 상태

문서마다 자기 머리(문서 버전 · 상태)에 적혀 있다.
