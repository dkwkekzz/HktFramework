# content/roadmap — 주입의 규약과 그 결과물

이 세계(`content/`)를 기획으로 점진 완성하는 **주입 순서(Roadmap)** 의 규약과, 각 주입이 낳은
**결과물**이 한자리에 있다. [design/Design-DesignAuthoringWorkflow.md](../../design/Design-DesignAuthoringWorkflow.md)
§10 주입의 순서 규칙이다 — 무엇을 주입하는가는 그 문서가, 어떤 순서로 주입하는가는 이 문서가 답한다.

이 문서는 **규약**만 둔다 — 층의 정의 · 주입 방식 · 열 질문. 층과 행이 지금 어디까지 왔는가는
[plan/DESIGN.md](../../plan/DESIGN.md) 가, Cycle 의 판정 · 결정 대기는 [plan/DESIGN.md §3](../../plan/DESIGN.md) 그 기획서 절이, 레인은 [plan/CYCLES.md](../../plan/CYCLES.md) 가 소유한다.

```text
content/roadmap/
  README.md            이 문서 — 층은 둘이다 · 기반 층의 정의 · 주입 방식 · 열 질문
  L0-Game.md           0층 결과물 — 게임 방향
  L1-World-Grammar.md  1층 결과물 — 세계의 문법 (확정 범위 · 경계 · 코드 대응)
  L<N>-<이름>.md        기반 층의 결과물 — 그 층에서 Human 이 확정한 문서 (한 층에 여럿일 수 있다)
  M<N>-<이름>.md        컨텐츠 층의 결과물 — 그 미지에 대해 Human 이 준 세계관 사실
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
행 하나 = 주입 하나 = 기획서 하나 = 그 기획서의 Cycle 들 (첫 spec 의 Trace 에 Cycle 목록 · 한 세션에 잘리는 크기)
```

- **행을 건너뛰는 기획서는 만들지 않는다.** 기반 층의 기획서는 열린 층의 축 하나를 세우고,
  컨텐츠 층의 기획서는 미지 하나를 놓는다. 한 기획서가 두 축을 동시에 세우면 정리되지 않는다 — 기획서를 나눈다.
- 기반 층의 Cycle 들은 축을 세우면서 **미지를 하나 놓는다** — 그 미지가 컨텐츠 층의
  첫 행들이다. 2층은 이름 있는 지역 하나, 3층은 무엇을 원하는지 아는 생물
  하나, 4층은 어디서 나는지 정해진 자원 하나.
- 아직 확정되지 않은 축의 의미가 Cycle 에 필요해지면 Required 에 올리지 않고 Human
  질문으로만 남긴다.
- 그 행의 Cycle 들이 실제로 플레이되면 행이 닫힌다 — "실제로 플레이됨" 은 그 Cycle 들이
  `plan/DESIGN.md` §3 그 기획서 절에 남긴 Human 판정 질문이 실주행 판정으로 전부 비는 것이다
  (회수 규칙은 [design/Plan-Skill-CycleExecutionWorkflow.md](../../design/Plan-Skill-CycleExecutionWorkflow.md) §3).

## 2. 기반 층 — 축의 정의

| 순서 | 층 | 주입 내용 (Human 문서) | 재료가 될 `design/` 문서 | Cycle 의 방향 |
|---|---|---|---|---|
| 0 | 게임 방향 | 핵심 경험 한 단락 + Core Breath + 핵심 문장 | `L0-Game.md` 가 원문을 소유한다 | 없음 — 판단 기준일 뿐 |
| 1 | 세계의 문법 | 무엇이 존재하고 무엇이 변하는가 — 존재·상태·주체·법칙·시간 (주체가 행동을 **고르는** 과정은 3층) | `Design-Concept.md` | 없음 — 코드가 이미 이 문법 위에 있음 |
| 2 | 세계 자체 | **도구 절반** — 세계를 쓰는 문법과 컴파일러(engine) · 2단계 Region 작성기 · **세계 절반** — ① 세계관 컨셉 ② 세계 content 구성(Region Graph · Rule · Connector · 중첩) ②-부속 다섯: 재료 생태와 공급 계약 · 시간과 위상 · 생명의 성립과 탄생 · 요구와 가능성 · Region Foundation | 도구: `Design-World-Editor-Terrain-Compiler.md` (WE) · `Plan-World-Authoring-Engine.md` · 세계: 주입 원문은 결과물 안에 | 안전권을 나서 깊이가 달라지는 것을 본다 — 백왕령(civil) ⇄ 거대 악마의 숲(outer) |
| 3 | 주체와 몸 | 요정의 몸은 무엇을 가지는가(깎이고 회복되는 값) · 생물은 무엇을 알고 어떻게 행동하는가 · **원정 편성과 무대의 한 명** · 교체 = 세계에 개입하는 방법을 바꾸는 행동 · Entry/Leave/Off-field 의 자리 · 요정 Core 가 몸의 State 로 적혀 property Lock 에 답한다 (L7 §3 의 3층 몫) | `Design-Subject-Decision.md` · `Design-Autonomous-Behavior-Knowledge-R0.md` · `Design-Creature-Behavior-R0.md` · **`L7-Fairy-Growth-Combination.md` §9~§11 · §20 · §4** | 한 명만 무대에 선다 — 요정 둘을 편성해 협곡을 지난다 |
| 4 | 자원과 물건 | 소지·장비·가공 사슬 · 조합과 쓰임 ("무엇이 어디서 나는가" 는 2층 ②-부속이 닫았다) · **보석은 세계의 특성이 응축된 성장 재료(Material Seed) · 물건은 행동을 바꾸는 장치이지 스탯 부착물이 아니다** (L7 §8 · §17 · §24) | `Design-Resource-Catalog-R0.md` · `Design-Item-*.md` · `Design-Inventory-Equipment-D1.md` · **`L7` §8 · §17** | 캐서 지니면 갈 수 있는 곳이 늘어난다 |
| 5 | 대결 | 공격·방어·피해 종류·지목 · **정해진 전투 Phase 없음 — 대상의 World State 를 생성·제거·변화·전달·소비·증폭하는 것이 전투의 문법 · 하나의 문제에 여러 답** (L7 §13 · §14 · §16) | `Design-Combat-*.md` · `Design-Targeting-R0.md` · **`L7` §13 · §14** | 처음으로 맞서 이긴다 — 같은 적을 두 가지 상태 순서로 |
| 6 | 능력 | 스킬 체계·실행 형태·효과 · **Class 는 Core 를 쓰는 방법 · Active/Entry/Leave/Off-field 의 내용 · Leave 가 남긴 것이 다음 요정의 능력과 반응한다** (L7 §5 · §6 · §11 · §19) | `Design-Skill-*.md` · **`L7` §6 · §11** | 능력 표현이 세계에 닿는다 — 한 Core 가 두 Class 로 갈리고, 장판이 반응한다 |
| 7 | 성장 | 요정 성장·밸런스·클래스 — **성장 = 유효한 조합과 세계 개입 가능성의 확장**: 요정 컬렉션 · Class Change(Fairy + Gem + 조건) · Knowledge = 숨겨진 관계의 해금 · Fairy Build 와 편성 · 고정 역할 없음 | **`L7-Fairy-Growth-Combination.md`** (원문 — 충돌하는 자리에서 `Design-Fairy-*.md` 를 이긴다, L7 §2.2) · `Design-Growth-Balance-R0.md` · `Design-Subject-Decision.md` §20·§23 | 자원 관계에서 성장이 나온다 — 보석 하나로 Class 가 바뀌어 못 풀던 자리를 새 방법으로 푼다 |
| 8 | 화면 | UX | `Design-View-*.md` | 별도 주입 없음 — 각 Cycle 의 Required 로 들어온다 |

2층은 절반이 둘이다 — **도구가 먼저, 세계가 다음**. 도구 절반(`L2-World-Tool.md` · 2단계 `L2-World-Tool-Scale.md`)은 게임 명사를
모르므로 ENGINE 레인으로 선다. 세계 절반은 ① `L2-World-Concept.md` ② `L2-World-Region.md` 와 ②-부속 다섯(`L2-World-Material.md` ·
`L2-World-Time.md` · `L2-World-Life.md` · `L2-World-Access.md` · `L2-World-Foundation.md`)이다 — 부속은 새 층이 아니라 ② 의 확장 계약이고,
각각이 문서 머리에서 자기가 어느 구멍을 메우는지 말한다. 주입이 도구의 어느 자리(layer · tag · op)에 닿는지는 `L2-World-Tool.md` §3 이 정한다.
각 Region 의 내용은 ①②②-부속에 있는 것만으로 쓴다 — 없는 것은 지어내지 않고 Human 질문으로 남긴다.
수십~수백 규모의 지역은 사람이 아니라 **Region 작성기**가 쓴다 — 단계 T1~T6 은 `L2-World-Tool-Scale.md` §3 이 소유한다.

**7층의 주입물이 열린 층보다 먼저 왔다** — `L7-Fairy-Growth-Combination.md`. 층을 앞당기지 않는다. 원문을 그 자리에 보존하고
원문의 절들이 3 · 4 · 5 · 6 · 7층 어디로 가는지를 그 문서 §3 이 배분했다 — **각 층이 열릴 때 그 층의 주입은 이 배분을 받는다**
(위 표의 3~7 행에 굵게 적힌 것). 원문은 기존 `design/` 성장 문서와 어긋나는 자리에서 **이긴다** (L7 §2.2).

## 3. 컨텐츠 층 — 미지의 목록

행 하나가 미지 하나다. 열은 기반 층과 같고, 순서 열 대신 **요구 축** 열이 있다 — 그 축이 전부 확정이어야 이 행을
시작할 수 있다. 미지의 이름과 존재는 Human 만이 짓는다 (§4 ①). 목록과 상태는 [plan/DESIGN.md §2](../../plan/DESIGN.md) 다.

## 4. 한 행을 주입하는 방식

### 기반 층

```text
① 문서 확정   그 층의 design/ 재료를 지목하고 빠진 것만 채워 이 폴더에 결과물로 둔다 (advprotoi-inject 가 보존 · 판정한다 — 지어내지 않는다).
             세계관 사실(이름·존재)은 AI 가 지어낼 수 없으므로 여기서 준다. 문서 확정만으로 닫히는 층(0 · 1층)은 여기서 끝난다.
② 방향 한 줄  "이 층으로 이런 것을 보게 하라" → advprotoi-spec 이 그 층 기획서의 Cycle 전부를 spec 으로
             쓴다 → Human "C### 진행" (승인 1회). 이 Cycle 들이 놓는 미지 하나를 plan/DESIGN.md §2 에 행으로 올린다.
③ 완성 판정   그 기획서의 마지막 Cycle 이 합쳐진 뒤 Human 이 **기반 검토**를 한다 — 걷지 않는다. plan/DESIGN.md §3 그 기획서 절의
             기반 질문(AI 예심이 압축한 서넛 — 축 · 경계 · 손잡이의 충분함)에 codemap 의 계약 표 · 손잡이 표 · world:check 결과를 읽고 답한다.
             경험(읽히는가 · 값이 맞는가)은 묻지 않는다 — 손잡이(데이터)로 내려가 그 축을 처음 쓰는 컨텐츠 행이 판정한다
             (design/Design-CycleExecutionWorkflow.md §21). 전부 비면 층이 닫힌다 → 상태를 갱신하고 다음 층을 주입한다.
             실패한 항목은 ENGINE GAP(기구 · 계약) 또는 DESIGN GAP(기획서의 자리)으로 그 기획서에 Cycle 을 더한다.
```

### 컨텐츠 층

```text
① 미지 하나   Human 이 미지 하나를 준다 — 이름 · 종류 · 세계관 사실. advprotoi-inject 가 이 폴더에 M<N>-*.md 로
             보존하고 plan/DESIGN.md §2 에 행을 올린다. 요구 축이 전부 확정이어야 한다.
①' 등급 판정  먼저 세 등급 중 어디인지 가른다 (L2-World-Tool-Scale.md §2) —
             A 데이터만 (Cycle 없음 — Spec 한 장 + 검사 + Human 판정) ·
             B 규칙 하나 (Cycle 하나) · C 새 축 (컨텐츠 행이 아니다 — 기반 층을 기다린다).
             **대부분의 지역은 A 다.** Cycle 을 자르는 것은 B 의 첫 사례이거나 계약을 처음 일반화할 때뿐이다.
② 열 질문     advprotoi-spec 이 아래 열 질문에 통과시켜 (A 면 Spec 을, B 면 Cycle 의 spec 을) 구체화한다 (승인 1회).
             답이 주입물·design/ 에 없으면 지어내지 않고 Human 질문으로 남긴다 — 이름과 "그것이 무엇인지에서
             나오는 것" 은 위임됐다 (Region §5.5).
③ 완성 판정   A 는 검사 통과 + 걸어 본 것으로, B 는 plan/CYCLES.md 의 그 질문이
             실주행 판정으로 비면 행이 닫힌다 (기반 층 ③ 과 같은 방식).
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

①~③ 이 Cycle 의 World Cause 가 되고, ④~⑥ 이 Goal 과 Required 가 되며, ⑦~⑩ 이
그 Cycle 이 이 게임의 것인지 판정한다. 열 답이 다 서면 spec 을 쓴다.

이 열 질문은 **검사**다. 미지 하나를 **쓰는 순서**는 [L2-World-Concept.md](L2-World-Concept.md) §17 의
일곱 단계가 정한다 — 그 순서로 쓰고 이 열로 검사한다. 둘은 같은 관문의 앞뒤다.

## 5. 상태

층 · 행의 상태(확정 / 다음 / 미주입)와 남은 것은 `plan/DESIGN.md` 에만 있다. 경위·날짜는 적지 않는다 (git history 가 소유).
기반 층은 층이 닫히면 확정, 바로 아래 층이 다음이 된다. 컨텐츠 층은 순서가 없으므로 "다음" 이 여럿일 수 있다.
