# play/ — 증명 Play 의 목록

```text
목적    Play 문서들의 목록과 순서 — 어느 Play 가 무엇을 증명하고 어느 미지를 놓으며 왜 그 순서인가.
기능    Play 표(증명 · 미지 · Cycle) · 순서의 이유. 상태 · 판정 질문 · 덮임은 두지 않는다 — plan/PLAYS.md · plan/DESIGN.md 가 소유한다.
```

이 폴더의 **"방"은 Region 의 최소 표현**이다. Region 은 크기를 갖지 않는 공간이고 크기는 extent 데이터다 — 한 칸의 방도,
대평원도, 대륙급 오픈월드도 같은 Region 이며 그 사이를 Connector 가 잇는다 (RegionGraphRooms 불변 조건 넷째).

Play 하나는 로드맵의 **행 하나**를 증명한다 ([../README.md](../README.md) §1). 문서를 덮는 것이 아니다.
그래서 2층의 기획 아홉(도구 · 세계관 컨셉 · 세계 content 구성 · 재료 생태 · 시간과 위상 · 생명 · 요구와 가능성 · Region Foundation · 작성기)은
Play 하나로 닫히지 않는다 — 2층에서 증명할 수 있는 것은 Play 여럿으로 나뉘고, 나머지는 그 축이 서는 층에서 증명한다.

## 목록 (순서대로)

| Play | 증명하는 것 | 놓는 미지 | Cycle |
|---|---|---|---|
| [RegionGraphRooms.md](RegionGraphRooms.md) | 세계는 방들의 그래프다 — 전이 · 깊이 · 중첩 · 일방향 · 닫힘 · 아직 안 간 곳 | M1 거대 악마의 숲 | C001~C004 |
| [RoomBecomesLand.md](RoomBecomesLand.md) | 방이 땅이 된다 — 같은 Region Spec 의 space 를 채우면 코드 없이 지형이 선다. 안전은 조건이 만든다 | — (백왕령은 미지가 아니다) | C005~C007 |
| [RuleBoundRoom.md](RuleBoundRoom.md) | 방은 규칙을 품는다 — Region Rule 이 방 안의 통로와 방 밖의 Connector 를 World State 로 바꾸고, 그 State 는 관찰자 모두에게 하나다 | M2 환상의 미로 | C008~C010 |
| [RoomBearsMaterial.md](RoomBearsMaterial.md) | 방이 재료를 낳는다 — 하나의 Cause 가 여러 원천을 만들고, 흔적이 먼저 오고, 캐면 자국이 남고, 세계의 과정이 다른 자리에 되돌린다 | M3 숲의 재료 계통 (M1 을 깊게 한다) | C011~C014 |
| [RoomNeverSame.md](RoomNeverSame.md) | 같은 방은 두 번 없다 — 세계는 시계(낮밤 · 네 철)를 가지고 Region 은 위상을 바꾼다. 여럿의 누적으로만 넘는 전이(소란)와 남의 발자국, 압도적 존재의 경로 | M4 천공고래의 길 (현상 · 비늘) | C015~C018 |
| [RoomOfAnotherKind.md](RoomOfAnotherKind.md) *(컨텐츠 층 M5)* | 다른 갈래의 방 — 요구가 다른 Region 이 둘 이상 있어야 "한 몸으로 다 못 간다"가 참이다. 재료 생태와 철을 다른 갈래(기후 · 지형 · 물질)에 두 번째로 쓰고, 철이 백왕령의 안전 조건에 닿는다 | M5 빙결 협곡 | C019~C021 |
| [RoomBearsLife.md](RoomBearsLife.md) | 방이 생명을 낳는다 — 재료에는 주인이 있다. 탄생은 세계의 무언가를 먹고, 흔적을 먼저 남기고, 반복 출현은 스폰이 아니라 조건의 회복이다. 태어난 것은 부르고 먹히고 남겨 숲이 관찰자 없이 한 바퀴 돈다 | M6 붉은 알집 (M1·M3 을 깊게 한다) | C022~C025 |
| [RoomAnswersWhenAsked.md](RoomAnswersWhenAsked.md) | 물으면 답하는 방 — 지목한 것(존재 · 자리)의 사실이 한 자리에 머문다. 새 축도 새 미지도 아니고 **이미 선 축들의 관찰 가능성** (실주행 DESIGN GAP 회수) | — | C026~C028 |
| [RoomAsksForPossibilities.md](RoomAsksForPossibilities.md) | 방이 가능성을 묻는다 — 자리는 아이템이 아니라 세계 조건을 요구하고, 세계 어딘가의 것이 같은 어휘의 성질로 답하며, 하나의 요구에 여러 종류의 답이 올 자리가 열려 있다. 요구는 흔적으로 알아내고, 문은 아직 열리지 않는다 | M7 열을 저장하는 결정의 원천 (자원) | C029~C031 |
| [RoomRemembersAndOffers.md](RoomRemembersAndOffers.md) | 방은 기억하고 때가 되면 내민다 — 방이 자기에게 일어난 일을 세고, 세계의 조건이 한 형으로 적히며 그 형이 기억을 읽고, 방이 내미는 것(기회)이 데이터이고 때가 있는 기회가 Event 다. 첫 Event 는 채집이다 | — (M4 를 깊게 한다) | C034~C036 |
| [TrailBehindClueAhead.md](TrailBehindClueAhead.md) | 온 길은 남고, 갈 길에는 단서가 있다 — RegionGraphRooms 실주행 GAP 둘의 회수. 새 축도 새 미지도 아니다 | — | C032~C033 |
| [OneStandsOnStage.md](OneStandsOnStage.md) *(**3층**)* | 한 명만 무대에 선다 — 관찰자는 몸이 아니라 편성을 가지고, 무대에 서는 몸은 하나이며, 어느 몸이 서는가가 세계에 개입하는 방법을 바꾼다. 추위가 몸의 온기를 깎고, 문이 몸의 성질을 묻고(property Lock 의 첫 판정), 열을 쫓는 것이 따뜻한 몸만 본다 | M8 협곡의 열을 쫓는 것 (생물 — 열을 원한다) | C037~C040 |

## 순서의 이유

순서는 의존성이다 — 그래프가 있어야 방이 있고, 방이 있어야 땅으로 채울 수 있고, 방 안에 구조(area · traversable)가
있어야 규칙이 바꿀 것이 있고, Region State 와 세계 과정이 있어야 재료가 생애를 가진다. 미로는 Region 하나이고 그
안의 길은 Connector 가 아니라 공간의 통로다.

- **RoomAnswersWhenAsked · TrailBehindClueAhead 는 순서 밖이다** — 앞 Play 의 실주행에서 돌아온 DESIGN GAP 의 회수이고 기획을 하나도 덮지 않는다. 다른 Play 와 **병행**한다.
- **RoomBearsLife 는 Frost 뒤다** — 탄생이 **소비할 것**(재료)과 **탈 주기**(철)와 **대조할 갈래**(협곡)가 먼저 서야 한다.
- **RoomAsksForPossibilities 는 Frost 뒤다** — 첫 property Lock(빙결 심층의 문)과 둘째 종류의 답(눈보라)이 협곡에 있다.
- **OneStandsOnStage 는 2층이 아니라 3층의 첫 Play 다** — 7층 주입물([L7](../L7-Fairy-Growth-Combination.md))의 3층 몫(편성 · 무대의 한 명 · 교체 · Core 가 몸의 State 로)을 Human 결정으로 2층 실주행 판정과 병행해 연다. 2층이 세운 협곡 · 문의 요구(`heat:hides`) · 성질 어휘를 그대로 쓰고, Access 가 "3층이 받는다" 고 넘긴 property Lock 의 판정을 처음 세운다. C039 만 C029 뒤다.

진행은 각 Play 의 Cycle Breakdown 체크박스가 소유한다. 위임된 결정(D1~)은 각 Play 문서 안에 있다 — Human 이 언제든 뒤집는다.
