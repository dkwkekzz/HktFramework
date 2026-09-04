# content/roadmap — 주입 순서와 그 결과물

이 세계(`content/`)를 기획으로 점진 완성하는 **주입 순서(Roadmap)** 와, 각 주입이 낳은
**결과물**이 한자리에 있다. [design/Design-DesignAuthoringWorkflow.md](../../design/Design-DesignAuthoringWorkflow.md)
§8.5 주입 경로의 순서 규칙이다 — 무엇을 주입하는가는 그 문서가, 어떤 순서로
주입하는가는 이 문서가 답한다.

```text
content/roadmap/
  README.md            이 문서 — 기반 층의 순서 · 컨텐츠 층의 행 · 각각의 현재 상태
  L0-Game.md           0층 결과물 — 게임 방향
  L1-World-Grammar.md  1층 결과물 — 세계의 문법 (확정 범위 · 경계 · 코드 대응)
  L<N>-<이름>.md        기반 층의 결과물 — 그 층에서 Human 이 확정한 문서 (한 층에 여럿일 수 있다)
  M<N>-<이름>.md        컨텐츠 층의 결과물 — 그 미지에 대해 Human 이 준 세계관 사실
  play/<PlayName>.md   증명 Play (Level 2, AI 초안 + Human 승인 1회)
```

`design/` 은 재료(시스템 기획 원본)이고, 이 폴더는 그 재료를 순서대로 들여 확정한
결과다. 코드(`content/world` 등)는 이 폴더를 import 하지 않는다 — 문서만 있다.

## 1. 원칙 — 층은 둘이다

로드맵은 코드의 기반/컨텐츠 분리와 같은 두 층으로 되어 있다.

```text
코드                                  로드맵
engine/   게임 명사 없이 성립하는 기구    기반 층    축을 세운다 — 세계 · 몸 · 물건 · 대결 · 능력 · 성장
content/  그 위에 놓이는 이 세계          컨텐츠 층  미지를 놓는다 — 지역 · 생물 · 자원 · 구조 하나씩
```

- **기반 층**은 순서가 있고 유한하다. 위에서 아래로 하나씩 주입하며, 한 번에 하나만
  열린다. 각 층은 바로 위 층의 답으로만 설명된다.
- **컨텐츠 층**은 순서가 없고 무한하다. 행 하나가 미지(세계 사실) 하나이고, 요구하는
  축이 전부 확정되면 언제든 시작한다 — 기반 층 전체가 닫히기를 기다리지 않는다.
- 의존은 한 방향이다. 컨텐츠 행은 기반 층의 축을 쓰고, 기반 층은 어떤 미지가 올지
  모른다. 미지가 **새 축을 요구하면** 그것은 컨텐츠 행이 아니라 기반 층의 새 행이다.
- 컨텐츠 공간은 `선 축들 × 미지들` 이다. 미지가 하나 늘 때마다 모든 축과 곱해진다 —
  확장성은 여기서 나온다. 열거된 그래프(Master Graph)를 두지 않는다.

```text
행 하나 = 주입 하나 = 그 행만 증명하는 Play 하나 = 그 Play 의 Cycle 들
```

- **행을 건너뛰는 Play 는 만들지 않는다.** 기반 층 Play 는 열린 층의 축 하나를 증명하고,
  컨텐츠 층 Play 는 미지 하나를 놓는다. 한 Play 가 두 축을 동시에 세우면 정리되지 않는다.
- 기반 층의 증명 Play 는 축을 세우면서 **미지를 하나 놓는다** — 그 미지가 컨텐츠 층의
  첫 행들이다. 2층 Play 는 이름 있는 지역 하나, 3층 Play 는 무엇을 원하는지 아는 생물
  하나, 4층 Play 는 어디서 나는지 정해진 자원 하나.
- 아직 확정되지 않은 축의 의미가 Play 에 필요해지면 Required 에 올리지 않고 Human
  질문으로만 남긴다.
- 그 행의 Play 가 실제로 플레이되면 행이 닫힌다.

## 2. 기반 층 — 축의 순서

| 순서 | 층 | 주입 내용 (Human 문서) | 재료가 될 `design/` 문서 | 증명 Play (제안) | 결과물 | 상태 |
|---|---|---|---|---|---|---|
| 0 | 게임 방향 | 핵심 경험 한 단락 + Core Breath + 핵심 문장 | `L0-Game.md` 가 원문을 소유한다 | 없음 — 판단 기준일 뿐 | `L0-Game.md` | **확정** |
| 1 | 세계의 문법 | 무엇이 존재하고 무엇이 변하는가 — 존재·상태·주체·법칙·시간 (주체가 행동을 **고르는** 과정은 3층) | `Design-Concept.md` | 없음 — 코드가 이미 이 문법 위에 있음 | `L1-World-Grammar.md` | **확정** |
| 2 | 세계 자체 | **도구 절반** — 세계를 쓰는 문법과 컴파일러 (engine) · **세계 절반** — ① 세계관 컨셉 ② 세계 content 구성(Region Graph · Region Rule · Connector · 중첩) ②-부속 재료 생태와 공급 계약(원천 · 흔적 · 생애 · 공급 · 흐름) | 도구: `Design-World-Editor-Terrain-Compiler.md` (WE) · `Plan-World-Authoring-Engine.md` · 세계: 주입 원문은 결과물 안에 |안전권을 나서 깊이가 달라지는 것을 본다 — 백왕령(civil) ⇄ 거대 악마의 숲(outer) | `L2-World-Tool.md` · `L2-World-Concept.md` · `L2-World-Region.md` · `L2-World-Material.md` · `play/` 의 Play 넷 | **다음** — C001~C005 닫힘 |
| 3 | 주체와 몸 | 요정의 몸은 무엇을 가지는가(깎이고 회복되는 값) · 생물은 무엇을 알고 어떻게 행동하는가 | `Design-Subject-Decision.md` · `Design-Autonomous-Behavior-Knowledge-R0.md` · `Design-Creature-Behavior-R0.md` | 세계가 몸을 깎고, 생물이 그것에 반응하는 것을 본다 | `L3-*.md` · `play/` | 미주입 |
| 4 | 자원과 물건 | 소지·장비·가공 사슬 · 조합과 쓰임 ("무엇이 어디서 나는가" 는 2층 ②-부속이 닫았다 — 이 층은 그 Material Seed 를 받는다) | `Design-Resource-Catalog-R0.md` · `Design-Item-*.md` · `Design-Inventory-Equipment-D1.md` | 캐서 지니면 갈 수 있는 곳이 늘어난다 | `L4-*.md` · `play/` | 미주입 |
| 5 | 대결 | 공격·방어·피해 종류·지목 | `Design-Combat-*.md` · `Design-Targeting-R0.md` | 처음으로 맞서 이긴다 | `L5-*.md` · `play/` | 미주입 |
| 6 | 능력 | 스킬 체계·실행 형태·효과 | `Design-Skill-*.md` | 능력 표현이 세계에 닿는다 | `L6-*.md` · `play/` | 미주입 |
| 7 | 성장 | 요정 성장·밸런스·클래스 — 세 성장 축(클래스·아이템·지식)의 조합 (L0-Game.md §1) | `Design-Fairy-*.md` · `Design-Growth-Balance-R0.md` · `Design-Subject-Decision.md` §20·§23 | 자원 관계에서 성장이 나온다 | `L7-*.md` · `play/` | 미주입 |
| 8 | 화면 | UX | `Design-View-*.md` | 별도 주입 없음 — 각 행의 Play 의 Required 로 들어온다 | — | — |

2층은 절반이 둘이다 — **도구가 먼저, 세계가 다음**. 도구 절반(`L2-World-Tool.md`)은 게임 명사를
모르므로 ENGINE 레인으로 선다. 세계 절반은 ① 세계관 컨셉(`L2-World-Concept.md` — 위험 일곱 갈래 ·
깊이 다섯 단계 · 위험과 보상의 동근원 · 제작 일곱 단계)과 ② 세계 content 구성(`L2-World-Region.md` —
Region Graph · Region Rule · Connector · 중첩 · 제작 12단계 · Region Spec 양식), 그리고 **②-부속**
재료 생태와 공급 계약(`L2-World-Material.md` — 재료가 왜 생기고 무엇이 암시하며 캐면 무엇이 달라지고
어떤 세계 과정으로 돌아오는가. 새 층이 아니라 ② 의 확장 계약이다)이다. 주입이 도구의
어느 자리(layer · tag · op)에 닿는지는 `L2-World-Tool.md` §3 이 정한다. 각 Region 의 내용(Spec 의 1~8)은
그 Region 의 Play 가 ①②②-부속 에 있는 것만으로 쓴다 — 없는 것은 지어내지 않고 Human 질문으로 남긴다.

2층의 Play 는 넷이다 (`play/README.md`) — **전부 승인됐다**. 넷째(`play/RoomBearsMaterial.md`)만
UNRESOLVED 넷(재료의 이름 · 관찰 가능한 성질 · 회복의 시간 규모 · 채취 단위)을 안고 선다.

"증명 Play" 열은 방향 제안이다 — 실제 Play 는 그 층을 주입할 때 `play/` 문서로
구체화하고 승인한다. 지금 코드에 있는 것(채광·이동·관찰·기본 전투·몸)은 1층 위에
서 있고 2층부터 비어 있다 — 실질적 첫 Play 는 2층에서 나온다.

## 3. 컨텐츠 층 — 미지의 목록

행 하나가 미지 하나다. 열은 기반 층과 같고, 순서 열 대신 **요구 축** 열이 있다 —
그 축이 전부 확정이어야 이 행을 시작할 수 있다. 미지의 이름과 존재는 Human 만이
짓는다 (§4 ①). 표는 비어 있는 것이 정상이다 — 기반 층의 첫 증명 Play 가 첫 행을 놓는다.

| 미지 | 종류 | 주입 내용 (Human 문서) | 요구 축 | 증명 Play | 결과물 | 상태 |
|---|---|---|---|---|---|---|
| **M1 거대 악마의 숲** | 지역 | 이름 · 방 구성 · 깊이 · 무엇으로 이어지는가 — `L2-World-Region.md` §5.1·§5.4 와 `play/RegionGraphRooms.md` §5.8 | 2 | `play/RegionGraphRooms.md` | 그 Play 가 소유 | **다음** — C001 닫힘 (숲 가장자리까지) |
| **M2 환상의 미로** | 지역 | 이름 · Region Spec 통째 — `L2-World-Region.md` §16 | 2 | `play/RuleBoundRoom.md` | 그 Play 가 소유 | **다음** |
| (이후) | 지역 · 생물 · 자원 · 구조 | 그 미지가 무엇이고 어디에 있으며 왜 그런가 | 2 · 3 · … | 그 미지 하나를 만나는 Play | `M<N>-*.md` · `play/` | — |

## 4. 한 행을 주입하는 방식

### 기반 층

```text
① 문서 확정   그 층의 design/ 재료를 지목하고 빠진 것만 채워 이 폴더에 결과물로 둔다.
             세계관 사실(이름·존재)은 AI 가 지어낼 수 없으므로 여기서 준다.
② 방향 한 줄  "이 층으로 이런 것을 보게 하라" → advprotoi-design 이 그 층만의 Play 를
             play/ 에 구체화한다 (승인 1회). 이 Play 가 놓는 미지 하나를 §3 에 행으로 올린다.
③ 완성 판정   그 Play 의 Cycle 이 실제로 플레이되면 층이 닫힌다 → 상태를 갱신하고
             다음 층을 주입한다.
```

### 컨텐츠 층

```text
① 미지 하나   Human 이 미지 하나를 준다 — 이름 · 종류 · 세계관 사실. 이 폴더에 M<N>-*.md 로
             보존하고 §3 에 행을 올린다. 요구 축이 전부 확정이어야 한다.
② 열 질문     advprotoi-design 이 아래 열 질문에 통과시켜 그 미지만의 Play 를 play/ 에
             구체화한다 (승인 1회). 답이 주입물·design/ 에 없으면 지어내지 않고
             Human 질문으로 남긴다.
③ 완성 판정   그 Play 의 Cycle 이 실제로 플레이되면 행이 닫힌다.
```

```text
세계 인과 (자원을 설계할 때 반드시 묻는 여섯 질문 — 이 문서가 소유한다)
  ① 어디에서 발생했는가         어떤 WorldState 인가
  ② 왜 그 Property 가 필요한가   어떤 생존 압력에 대한 적응인가
  ③ 무엇이 그것을 붙잡아 두는가   식물 · 생물 기관 · 광물 · 다른 구조
  ④ 인간에게 왜 가치 있는가      문명권에서는 불가능한 어떤 문제를 해결하는가
  ⑤ 어떤 Gameplay 가 발생하는가  Combat · Exploration · Observation · Negotiation · Harvest · Craft
  ⑥ 어떤 Capability 를 여는가    새로운 지역이나 Possibility 를 열 수 있는가

게임 방향 (L0-Game.md §4 — 네 질문)
  ⑦ 어떤 위험을 주는가            그 위험은 세계 안의 원인을 가지는가
  ⑧ 극복할 재료를 어디에 두는가    재료는 위험과 같은 원인에서 나오는가
  ⑨ 요정이 무엇으로 자라는가       성장이 대응 범위의 확장으로 드러나는가
  ⑩ Core Breath 의 어느 전이인가   미지에서 새로운 미지까지 어느 구간을 만드는가
```

①~③ 이 Play 의 World Cause 가 되고, ④~⑥ 이 Play Goal 과 Required 가 되며, ⑦~⑩ 이
그 Play 가 이 게임의 것인지 판정한다. 열 답이 다 서면 Play 문서(7단계)를 쓴다.

이 열 질문은 **검사**다. 미지 하나를 **쓰는 순서**는 [L2-World-Concept.md](L2-World-Concept.md) §17 의
일곱 단계가 정한다 — 그 순서로 쓰고 이 열로 검사한다. 둘은 같은 관문의 앞뒤다.

## 5. 상태 갱신 규칙

두 표의 "상태" 열만 살아 있는 상태다 — **확정 / 다음 / 미주입** 셋 중 하나.
경위·날짜는 적지 않는다 (git history 가 소유). 기반 층은 층이 닫히면 확정, 바로 아래
층이 다음이 된다. 컨텐츠 층은 순서가 없으므로 "다음"이 여럿일 수 있다 — 요구 축이
확정된 행이 곧 다음이다.
