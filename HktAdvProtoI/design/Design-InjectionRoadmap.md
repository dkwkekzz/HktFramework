# Design — 주입 순서 (Injection Roadmap)

상태: 승인 (Human 결정). [Design-DesignAuthoringWorkflow.md](Design-DesignAuthoringWorkflow.md)
§8.5 주입 경로의 **순서 규칙**이다 — 무엇을 주입하는가는 그 문서가, 어떤 순서로
주입하는가는 이 문서가 답한다.

## 1. 원칙

세계는 기반 층을 **위에서 아래로** 하나씩 주입하며 점진적으로 완성한다.

```text
층 하나 = 주입 하나 = 그 층만 증명하는 Play 하나 = 그 Play 의 Cycle 들
```

- 각 층은 바로 위 층의 답으로만 설명된다. 아래 층의 질문은 위 층 없이 답해지지 않는다.
- **층을 건너뛰는 Play 는 만들지 않는다.** 한 Play 가 두 층 이상의 의미를 동시에
  세우면 정리되지 않는다 — 열린 층 하나만 증명한다.
- 아래 층의 의미가 Play 에 필요해지면 Required 에 올리지 않고 Human 질문으로만 남긴다.
- 그 층의 Play 가 실제로 플레이되면 층이 닫히고, 그때 다음 층을 주입한다.

## 2. 층 순서

| 순서 | 층 | 주입 내용 (Human 문서) | 재료가 될 기존 문서 | 증명 Play (제안) | 상태 |
|---|---|---|---|---|---|
| 0 | 게임 방향 | 핵심 경험 한 단락 + Core Breath + 핵심 문장 | `Game.md` · BW §1·§35·§36 | 없음 — 판단 기준일 뿐 | **확정** |
| 1 | 세계의 문법 | 무엇이 존재하고 무엇이 변하는가 — 상태·주체·법칙·목적·가능성 | `Design-Concept.md` | 없음 — 코드가 이미 이 문법 위에 있음 | **다음** (문서 있음, Human 확인만) |
| 2 | 세계 자체 | 세계압은 자연 법칙인가 · 안전권과 깊이 단계 · 지역 지도 · **이름 목록** | `Design-World-Beira.md` · `Design-World-Beira-Terrain.md` · `Design-World-Spatial-Presence.md` | 안전권을 나서 깊이가 달라지는 것을 본다 (아직 아무것도 깎이지 않음) | 미주입 |
| 3 | 주체와 몸 | 요정의 몸은 무엇을 가지는가(깎이고 회복되는 값) · 생물은 무엇을 알고 어떻게 행동하는가 | `Design-Concept.md` §3~4 · `Design-Autonomous-Behavior-Knowledge-R0.md` · `Design-Creature-Behavior-R0.md` | 세계가 몸을 깎고, 생물이 그것에 반응하는 것을 본다 | 미주입 |
| 4 | 자원과 물건 | 무엇이 어디서 나는가(2 의 지역과 연결) · 소지·장비·가공 사슬 | `Design-Resource-Catalog-R0.md` · `Design-Item-*.md` · `Design-Inventory-Equipment-D1.md` | 캐서 지니면 갈 수 있는 곳이 늘어난다 | 미주입 |
| 5 | 대결 | 공격·방어·피해 종류·지목 | `Design-Combat-*.md` · `Design-Targeting-R0.md` | 처음으로 맞서 이긴다 | 미주입 |
| 6 | 능력 | 스킬 체계·실행 형태·효과 | `Design-Skill-*.md` | 능력 표현이 세계에 닿는다 | 미주입 |
| 7 | 성장 | 요정 성장·밸런스·클래스 | `Design-Fairy-*.md` · `Design-Growth-Balance-R0.md` | 자원 관계에서 성장이 나온다 | 미주입 |
| 8 | 화면 | UX | `Design-View-*.md` | 별도 주입 없음 — 각 층 Play 의 Required 로 들어온다 | — |

"증명 Play" 열은 방향 제안이다 — 실제 Play 는 그 층을 주입할 때 `play/` 문서로
구체화하고 승인한다. 지금 코드에 있는 것(채광·이동·관찰·기본 전투·몸)은 1층 위에
서 있고 2층부터 비어 있다 — 실질적 첫 Play 는 2층에서 나온다.

## 3. 한 층을 주입하는 방식

```text
① 문서 확정   그 층의 기존 문서를 지목하고 빠진 것만 채운다. 세계관 사실(이름·존재)은
             AI 가 지어낼 수 없으므로 여기서 준다.
② 방향 한 줄  "이 층으로 이런 것을 보게 하라" → advprotoi-design 이 그 층만의 Play 를
             구체화한다 (승인 1회).
③ 완성 판정   그 Play 의 Cycle 이 실제로 플레이되면 층이 닫힌다 → 이 표의 상태를
             갱신하고 다음 층을 주입한다.
```

## 4. 상태 갱신 규칙

이 표의 "상태" 열만 살아 있는 상태다 — **확정 / 다음 / 미주입** 셋 중 하나.
경위·날짜는 적지 않는다 (git history 가 소유). 층이 닫히면 그 층은 확정, 바로 아래
층이 다음이 된다.
