# design — 이 팩의 컨텐츠 기획 원본

Human 이 작성·개정한 **기획 원본**이다. Master Layer 는 이것을 주입(Inject)으로 번역해
Constraint · Graph 로 옮기고(`../../../guides/master-inject.md`), Cycle 은 그 결과에서 온다.
Agent 는 이 문서들을 **바꾸지 않는다** — 승인·개정은 Human 소유다.

여기 있는 것은 이 팩(`content/proto-adventure/`)의 세계에만 참인 것들이다. 팩을 갈아
끼우면 함께 교체된다. 팩이 바뀌어도 참인 공정·기반 문서는 프로젝트 루트 `design/` 에
남아 있다 (Workflow · Master 정책 · 기반/컨텐츠 분리 · 이펙트 장치).

경로는 어디서 적든 프로젝트 루트 기준이다 — 이 디렉터리는 언제나
`content/proto-adventure/design/…` 로, 루트의 공정 문서는 `design/…` 로 적는다
(CLAUDE.md 경로 규약).

## 갈래

| 갈래 | 문서 | 약칭 |
|---|---|---|
| 세계 | `Master-World-Beira.md` · `Master-World-Beira-Terrain.md` | BW |
| 성장 | `Master-Fairy-Growth-System.md` · `Design-Growth-Balance-R0.md` · `Design-Fairy-Baiwang-Growth-R0.md` · `Design-Fairy-Baiwang-Skill-R0.md` | — |
| 전투 | `Design-Combat-OffenseDefense-R0.md` · `Design-Combat-DamageType-R0.md` · `Design-Combat-UpperLayer-R0.md` · `Design-Combat-Knowledge-Extension-R0.md` | R1 · DT · UL · CK |
| 지목 | `Design-Targeting-R0.md` | TG |
| 아이템 | `Design-Item-System-R0.md` · `Design-Item-System-R1.md` · `Design-Item-Chain-R0.md` · `Design-Item-Instance-State-R0.md` · `Design-Item-Lifecycle-Progression-R0.md` · `Design-Inventory-Equipment-D1.md` · `Design-Resource-Catalog-R0.md` | IS · IE |
| 스킬 | `Skill/Skill-System.md` · `Skill/Skill-Execution-Form.md` · `Skill/Skill-Effect.md` · `Skill/World-Spatial-Presence.md` | SK |
| 존재 | `Design-Creature-Behavior-R0.md` | — |
| 화면(UX) | `Design-View-Inventory-Equipment-UX-D1.md` · `Design-View-Skill-UX-D1.md` | VUX-IE · VUX-SK |

약칭은 근거 인용의 이름이다 — 어느 근거가 어느 영역에만 쓰이는지는
`../master/constraints/README.md` 가 소유한다. 근거는 영역을 넘지 않는다.

UX 기획서(`Design-View-*.md`)는 Master 가 아니라 **VIEW 레인**의 입력이다 —
`../works/BACKLOG.md` 로 번역되어 `V-NNN` 작업이 된다 (`../../../guides/view-work.md`).

## 승인 상태

문서마다 자기 머리(문서 버전 · 상태)에 적혀 있다. Human 승인 대기 문서가 무엇을 막고
있는지는 `../LANES.md` 의 "HUMAN 대기" 표가 소유한다 — 여기 중복해 두지 않는다.
