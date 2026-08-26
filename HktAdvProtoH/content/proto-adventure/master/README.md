# master/ — Master Intent Graph

> ## 진행 순서 — 2026-08-17 Human 지시 (2026-08-18 갱신)
>
> 전투 기본 규칙(OffenseDefense) 트랙을 마무리하는 것이 먼저다. 그 전에는 이 디렉터리를
> **새 영역으로** 넓히는 작업(다른 주제의 WHY/OPTIONS/NEED Graph 확장 · Constraint 신설)을
> 시작하지 않는다. 닫힌 Cycle 을 반영하는 Feedback 은 그 제한에 걸리지 않는다 — 그것을 미루면
> `frontier/` 와 `overlay.md` 가 현재 세계와 어긋나 다음 선택을 흐린다.
>
> Human 이 직접 세운 것은 `constraints/` 뿐이다. `graph/` `overlay.md` `frontier/` 는
> R1 개정 때 설계 문서의 의미를 옮겨 둔 것이며 Master 를 처음부터 세운 결과가 아니다.
>
> **2026-08-18 — 이 지시 아래에서 Graph 확장을 한 번 실행했다.** OffenseDefense 트랙 자신의
> 다음 층(Penetration)이 Graph 에 노드가 없어 Frontier 에 나타나지 못하고 있었다.
> 새 영역이 아니라 **진행 중인 트랙의 결손**이므로 위 제한의 취지에 어긋나지 않는다고
> 판단했다 — MC-PENETRATION · MP-PIERCE-THE-HARD-DEFENSE 2종. 이견이 있으면 되돌린다.
>
> **2026-08-19 — Human 지시로 세계관 문서를 주입했다.** `content/proto-adventure/design/Master-World-Beira.md`(BW)
> 의 주입(Inject)은 Agent 주도 확장이 아니라 Human 지목 반영이므로 위 제한에 걸리지
> 않는다. 세계(WORLD) 영역이 열렸다 — 아래 "현재 상태" 참조. 위 제한은 Agent 주도의
> 새 영역 **탐색**(WHY/OPTIONS 확장)에는 계속 적용된다.

이 디렉터리는 **Master Layer** 의 산출물이다.

```text
MASTER LAYER   WHY → OPTIONS → NEED → NEXT — 무엇을 왜 만들지 결정한다
CYCLE LAYER    선택된 하나의 플레이 결과를 World Semantic 과 Rule 로 폐쇄한다  → cycles/
```

정책 원본은 [design/Master-Intent-Graph-Policy.md](../../../design/Master-Intent-Graph-Policy.md),
파일 형식의 단일 출처는 [SCHEMA.md](SCHEMA.md) 다.
절차(4단계 · Feedback · Inject)는 `advprotoh-master` 스킬과 `../guides/master-*.md` 가
소유한다 — 여기에 중복해 두지 않는다. 아래 "현재 상태"의 전투 영역은
주입(Inject — `../guides/master-inject.md`)으로 들어온 것이다.

## 현재 상태

근거 문서는 영역별로 분리된다 — 근거는 영역을 넘지 않는다 (Q15).

```text
content/proto-adventure/design/   팩 기획서 — R1 · DT · BW
design/                           공정·기반 원본(루트) — GR

전투   R1  Design-Combat-OffenseDefense-R0.md   §14 확장 순서가 Cycle 사다리다
       DT  Design-Combat-DamageType-R0.md       §15 가 이후 확장의 경계를 긋는다
성장   GR  Master-Intent-Graph-Growth.md        GROWTH scope 한정
세계   BW  Master-World-Beira.md                2026-08-19 주입 — 세계압·탐험·자원
       BT  Master-World-Beira-Terrain.md        2026-08-26 주입 — 대지형 여덟·안전의 사유
```

해당 영역 문서가 이름조차 대지 않는 의미는 Graph·Constraint 에 두지 않는다 — 보류가
아니라 삭제한다. 기준 시점 **C019 닫힘** — 전투 사다리는 Critical 층까지, 탐험은
FRINGE 의 첫 칸(살펴봄 + 그것에 이르는 두 경로)까지 서 있고, 그 위에 고른 대상
하나(C017 지목)와 둘 사이의 태도(C018 관계)가 얹혔다. C019 로 **행동 안의 시점**이
세계에 생겼다 — 기술에는 아직 나가지 않은 구간이 있고 그 구간에만 끊긴다.

```text
Constraint   36     Active 36 (APPROVED 31 · REVISED 5) · DRAFT 0 — 대지형 4종 승인 (Q51)
Candidate    12     APPROVED 3 (→ DC) · PENDING 9 (무리별 읽는 법은 candidates/README.md)
Actor         2     Knowledge 3 · Belief 0 (Belief 는 도입하지 않는다 — Q3 결정)
Goal          6     Possibility 23 — 상대 넘어서기 11 · 밀리는 국면 3 · 탐험 4 · 기관 획득 5.
                    여섯째는 MG-RESCUE-THE-TAKEN (BT — 갈래 미배선)
                    탐험 4 는 **방법**이다 (익힌다 · 빌린다 · 준비해 간다 · 상위 형태가 된다 — Q21 · GS).
                    층은 Possibility 가 아니라 MW-ZONE-* 의 demands 다
                    §27 기관 대안 4종만 requires 미배선
Capability   63     IMPLEMENTED 15 · PARTIAL 7 · MISSING 41
                    요구처는 둘이다 — 방법의 required_by · 장소의 demanded_by
                    숫자의 단일 출처는 graph/GRAPH.md 머리말이다 (master:graph 재생성물)
Item Def     14     IP 5 · IT 6 · IM 3 (growth/items/) — Q22 광물 계통.
                    grants 3건으로 BW §17 순환이 그래프에서 닫혔다
Balance       1     GBC-GAIN-LEVEL (growth/balance/) — 성장 하나의 비용·보상 (Q58(c)).
                    Class(CL-*)는 0 — 계열별 설계 문서의 주입이 세운다 (Q55(b))
Frontier     11     트랙 넷 — ITEM 5 · TERRAIN 3 · GROWTH 3 · COMBAT 0.
                    SELECTED 둘 — TERRAIN(C-TERRAIN-001) · GROWTH(C-GROWTH-001), 둘 다 착수 전.
                    ITEM 은 Human 선택 대기 · COMBAT 은 후보가 소진되어 MASTER OPTIONS(Q35) 대기
WorldState   22     상위 인과 2 (PRIMAL-WORLD · WORLD-PRESSURE) · 세계압 두 갈래 2
                    (FREE-PRESSURE · BOUND-PRESSURE) · 구조 2 (SAFE-FRONTIER · DEPTH-GRADIENT) ·
                    깊이 층 5 (ZONE-FRINGE ~ ZONE-UNKNOWN) · 대표 지역 2 ·
                    **대지형 9** (MACRO-TERRAIN + TERRAIN-* 8 — BT 주입).
                    세계를 나누는 축이 둘이며 **직교한다** (Q47(a)) — 대지형은 어떤 법칙의
                    땅인가, 층은 그 땅 안에서 얼마나 깊은가. 한 지역은 둘을 함께 가진다

Open Question     수와 내용은 open-questions.md 가 소유한다. 다음 Cycle 선택을 막는 것은
                  Q35(COMBAT 트랙) 하나다. 대지형이 냈던 다섯(Q47~Q51)은 2026-08-26
                  전부 닫혔다 — 땅을 세우는 첫 Cycle 의 모양이 정해질 수 있게 되었고,
                  Frontier 후보는 아직 없다 (NEXT 작업)
```

무엇이 언제 왜 바뀌었는지는 Cycle 반영이면 `feedback/<CycleId>.md`, Master 층 자체의
결정이면 `HISTORY.md` 가 소유한다. 살아 있는 문서(`overlay.md` · `frontier/` ·
`open-questions.md` · `constraints/README.md`)에는 **지금 할 일과 현재 상태만** 남긴다 —
닫힌 것은 그 자리에서 지우고 보관소로 옮긴다.

닫힌 Possibility 4종 — MP-TRADE-BODY-FOR-RESOURCE(C011) · MP-MATCH-WEAPON-TO-ARMOR(C012) ·
MP-PIERCE-THE-HARD-DEFENSE(C013) · MP-INTERRUPT(C019). MP-OUTGROW-THE-OPPONENT 은 코드 대조로 PARTIAL 로
되돌렸다 — 능력치가 결과를 바꾸는 것은 닫혔으나 그 값을 플레이로 올릴 경로가 없다.
요구 Capability 가 하나도 비어 있지 않은 경로들이다.

아직 비어 있는 것 — 지어내지 않고 남긴 자리다:

```text
§27 기관 대안 4종의 requires   BW 는 대안 구조만 공급했다 — 배선은 OPTIONS/NEED 몫
지역이라는 세계 기반           SAFE↔FRINGE 경계·이동이 세계에 없다 — 탐험 Cycle 들의 전제
각 층이 만드는 Local Goal      §16 은 순환(발견 → Local Goal)만 공급했다 — WHY 몫
Growth 획득 경로               CL-* 0 건 — 사다리·계열은 섰다. 계열별 문서 주입이 채운다
```

닫힌 결정(2026-08-19): Belief 비도입(Q3) · 전투는 전투로(Q8) · Critical 확률 허용(Q11) ·
전투 Goal 의 World Cause 배선(Q2) · BW DC 승인(Q17) · 전투 매핑(Q18) · root 확정(Q19)
— 전부 HISTORY.md.

## 수명

```text
cycles/     History     한번 닫히면 수정하지 않는다
master/     현재 상태    world/ view/ 처럼 계속 갱신된다
```

과거 판정을 남기려면 파일을 복제하지 말고 Node 의 `status` 와 근거 Cycle 참조로 남긴다.

## 파일

| 경로 | 내용 | 소유 |
|---|---|---|
| [root.md](root.md) | Root Game Goal · World Premise | **Human** |
| [constraints/](constraints/) | `DC-*.yaml` — 승인된 Design Constraint | **Human** 승인 |
| [graph/](graph/) | MW · MA · MK · MB · MG · MP · MC · edges | Master Design Agent |
| [overlay.md](overlay.md) | Capability × 현재 구현 상태 — **생성물, 손으로 고치지 않는다** (원본: graph/ 노드 필드 + overlay-notes.yaml) | `npm run master:graph` |
| [frontier/](frontier/) | 트랙별 `FR-*` 후보 + Human 선택 — 트랙 목록·병렬 규칙은 [frontier/README.md](frontier/README.md) | Agent 제안 / **Human** 선택 |
| [candidates/](candidates/) | `CC-*.md` — 미승인 Constraint Candidate | Agent 제안 / **Human** 승인 |
| [open-questions.md](open-questions.md) | 승인 대기 · Constraint 충돌 · 설계 공백 · Trade-off | Agent 제기 / **Human** 결정 |
| [feedback/](feedback/) | Cycle 반영 경위 — 한 Cycle = 한 파일, 평소에 읽지 않는다 | Master Feedback 작업 |
| [HISTORY.md](HISTORY.md) | Master 층 자체의 닫힌 것 보관소 — 평소에 읽지 않는다 | Master Design Agent |
| [graph/GRAPH.md](graph/GRAPH.md) | Graph 스냅샷 (Mermaid · 표) — **생성물, 손으로 고치지 않는다** | `npm run master:graph` |

위 문서들은 **지금 할 일과 현재 상태만** 담는다. 닫힌 항목은 그 자리에서 지우고
보관소(Cycle 반영은 `feedback/<CycleId>.md` · Master 층 결정은 `HISTORY.md`)로 옮긴다 —
그래야 매번 읽는 문서가 가볍게 유지된다.

## 관찰

Graph 를 눈으로 보려면 프로젝트 루트에서 다음을 실행한다. 원본은 아무것도 바뀌지 않는다.

```text
npm run master:graph         GRAPH.md · overlay.md · 뷰어 둘(그래프 · 개념 지도)을 다시 만든다
npm run master:graph:check   정합성 + GRAPH.md·overlay.md 최신 여부만 확인한다 (아무것도 쓰지 않는다)
```

여섯 산출물이 나온다. HTML 넷은 커밋하지 않는다 (`.gitignore`).

| 파일 | 보는 곳 |
|---|---|
| `graph/GRAPH.md` | GitHub · 에디터 — Mermaid 와 표. **커밋한다** |
| `overlay.md` | Capability × 구현 상태 — 노드 필드에서 생성. **커밋한다** |
| `graph/graph-view.html` | 브라우저 — 인터랙티브 뷰어 (서버 없이 `file://` 로 열린다) |
| `graph/graph-view.artifact.html` | Artifact 게시용 — 아래 고정 링크 ①에 덮어쓸 때 이 파일을 올린다 |
| `graph/concept-map.html` | 브라우저 — 개념 지도 |
| `graph/concept-map.artifact.html` | Artifact 게시용 — 아래 고정 링크 ②에 덮어쓸 때 이 파일을 올린다 |

뷰어는 층(WorldState → Goal → Possibility → Capability)으로 배치하고, Capability 는
overlay 색으로, Possibility 는 **준비도**(요구 Capability 중 세계에 이미 있는 것의 비율)로
보여 준다. 노드를 고르면 그 인과 경로만 남고 원문이 열린다. Constraint 를 고르면 그 원칙
아래 있는 노드만 남는다. 빈 인과 필드(구멍)에는 주황 점이 찍힌다.

### 고정 링크 — Artifact

브라우저만 있으면 어디서나 열리는 뷰어다. **링크는 아래 셋이며 바뀌지 않는다.**
셋 다 main 을 가리킨다.

```text
① Master Intent Graph   graph/graph-view.artifact.html
   https://claude.ai/code/artifact/c3c54815-4a6a-47e7-83ce-2cd169acdef5

② Concept Map           graph/concept-map.artifact.html
   https://claude.ai/code/artifact/ec1fd0e1-3af5-498c-a7ad-0feaae5d1a45

③ Lanes Board           ../LANES.artifact.html   (npm run lanes 가 만든다)
   https://claude.ai/code/artifact/ca6a873b-1e46-4ac6-8db7-54edd562fae3
```

**주소를 여기 적어 두는 것이 규칙의 절반이다.** 적혀 있지 않으면 다음 세션이 그것을
찾지 못해 `url` 없이 새로 올리고, 그러면 같은 이름의 아티팩트가 둘이 되어 어느 것이
지금인지 아무도 모르게 된다 — 실제로 한 번 그렇게 되었다 (Master Intent Graph 가
`745ac158`…과 `c3c54815`… 둘이다. 지금 것은 ①이다).

`graph/` 나 `constraints/` 를 고친 Agent 는 재생성 후 ①②를 갱신하고, `LANES.md` 나
트랙 상태를 고친 Agent 는 `npm run lanes` 뒤에 ③을 갱신한다 —
**단 그 변경이 main 에 들어간 뒤다.** 셋 다 main 의 상태를 가리킨다.

작업 브랜치에서 그래프를 보여 줘야 하면 이 링크를 덮어쓰지 말고 **별도 Artifact 를
새로 올린다** (Artifact 도구에 `url` 을 넘기지 않으면 새 주소가 생긴다). 그 링크는
그 PR 안에서만 쓰고 README 에 적지 않는다 — 병합되면 쓸모가 없어진다.
브랜치의 그래프를 덮어쓰면 main 을 보는 사람이 아직 없는 것을 보게 된다.

```text
Artifact 도구에 file_path = 위 표의 .artifact.html
                 url       = 그 줄의 링크      ← 반드시 함께 넘긴다
```

`url` 을 빼면 **같은 링크에 덮어쓰지 않고 새 아티팩트가 새 주소로 생긴다.** 링크가 하나로
유지되는 것은 이 인자 덕분이므로 생략하지 않는다. Artifact 도구가 없는 환경이면 게시를
건너뛰고 그 사실을 보고한다 — 다른 주소로 올려 링크를 늘리지 않는다.

같은 통과에서 참조 무결성도 검사한다 — 존재하지 않는 ID 참조, `requires` ↔ `required_by`
비대칭, 없는 Constraint 참조, 고아 Possibility/Capability.

## 두 층의 접합점

접합점은 둘뿐이다. 그 외 경로로 두 층이 서로를 건드리지 않는다.

```text
아래로   frontier/<트랙>.md 의 선택된 FR-*   →  cycles/<CycleId>/01-cycle.md 의 MASTER TRACE
위로     08-verification.md 의 MASTER FEEDBACK  →  overlay.md · frontier/<트랙>.md 갱신 ·
         feedback/<CycleId>.md 기록 · candidates/ 제출
```

Cycle Agent 는 `master/` 를 **직접 편집하지 않는다**. 보고까지가 Cycle 의 책임이고,
반영은 Master Feedback 작업이 한다.

## 절대 규칙

```text
Constraint 는 시스템 목록을 만들지 않는다 — Goal/Possibility 의 형태를 제한할 뿐이다.
Capability 의 필요성은 Possibility 에서 나온다 — Constraint 에서 나오지 않는다.
수치·공식·판정 상수는 여기 두지 않는다 — Cycle 의 03-world-semantic.md 가 소유한다.
Agent 는 Constraint 를 자동 승격하지 않는다 — Human 이 승인한다.
Agent 는 Constraint 충돌을 임의로 해결하지 않는다 — Trade-off 로 노출한다.
```
