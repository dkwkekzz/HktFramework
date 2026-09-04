# play/ — 증명 Play 와 여섯 기획의 덮임

이 폴더의 **"방"은 Region 의 최소 표현**이다. Region 은 크기를 갖지 않는 공간이고 크기는 extent 데이터다 — 한 칸의 방도,
대평원도, 대륙급 오픈월드도 같은 Region 이며 그 사이를 Connector 가 잇는다 (RegionGraphRooms 불변 조건 넷째).

Play 하나는 로드맵의 **행 하나**를 증명한다 ([../README.md](../README.md) §1). 문서를 덮는 것이 아니다.
그래서 2층의 여섯 기획(도구 · 세계관 컨셉 · 세계 content 구성 · 재료 생태와 공급 계약 · 세계의 시간과 위상 ·
생명의 성립과 탄생)은 Play 하나로 닫히지 않는다 — 2층에서 증명할 수 있는 것은 Play 여섯으로 나뉘고,
나머지는 그 축이 서는 층에서 증명한다.

## 2층 Play 일곱(기획 증명 여섯 + 관찰 가능성 하나) + 컨텐츠 Play 하나 (순서대로)

| Play | 증명하는 것 | 놓는 미지 | Cycle |
|---|---|---|---|
| [RegionGraphRooms.md](RegionGraphRooms.md) | 세계는 방들의 그래프다 — 전이 · 깊이 · 중첩 · 일방향 · 닫힘 · 아직 안 간 곳 | M1 거대 악마의 숲 | C001~C004 |
| [RoomBecomesLand.md](RoomBecomesLand.md) | 방이 땅이 된다 — 같은 Region Spec 의 space 를 채우면 코드 없이 지형이 선다. 안전은 조건이 만든다 | — (백왕령은 미지가 아니다) | C005~C007 |
| [RuleBoundRoom.md](RuleBoundRoom.md) | 방은 규칙을 품는다 — Region Rule 이 방 안의 통로와 방 밖의 Connector 를 World State 로 바꾸고, 그 State 는 관찰자 모두에게 하나다 | M2 환상의 미로 | C008~C010 |
| [RoomBearsMaterial.md](RoomBearsMaterial.md) | 방이 재료를 낳는다 — 하나의 Cause 가 여러 원천을 만들고, 흔적이 먼저 오고, 캐면 자국이 남고, 세계의 과정이 다른 자리에 되돌린다 | M3 숲의 재료 계통 (M1 을 깊게 한다) | C011~C014 |
| [RoomNeverSame.md](RoomNeverSame.md) | 같은 방은 두 번 없다 — 세계는 시계(낮밤 · 네 철)를 가지고 Region 은 위상을 바꾼다. 여럿의 누적으로만 넘는 전이(소란)와 남의 발자국, 압도적 존재의 경로 | M4 천공고래의 길 (현상 · 비늘) | C015~C018 |
| [RoomOfAnotherKind.md](RoomOfAnotherKind.md) *(컨텐츠 층 M5)* | 다른 갈래의 방 — 요구가 다른 Region 이 둘 이상 있어야 "한 몸으로 다 못 간다"가 참이다. 재료 생태와 철을 다른 갈래(기후 · 지형 · 물질)에 두 번째로 쓰고, 철이 백왕령의 안전 조건에 닿는다 | M5 빙결 협곡 | C019~C021 |
| [RoomBearsLife.md](RoomBearsLife.md) | 방이 생명을 낳는다 — 재료에는 주인이 있다. 탄생은 세계의 무언가를 먹고, 흔적을 먼저 남기고, 반복 출현은 스폰이 아니라 조건의 회복이다. 태어난 것은 부르고 먹히고 남겨 숲이 관찰자 없이 한 바퀴 돈다 | M6 붉은 알집 (M1·M3 을 깊게 한다) | C022~C025 |
| [RoomAnswersWhenAsked.md](RoomAnswersWhenAsked.md) | 물으면 답하는 방 — 지목한 것(존재 · 자리)의 사실이 한 자리에 머문다. 새 축도 새 미지도 아니고 **이미 선 축들의 관찰 가능성** (실주행 DESIGN GAP 회수) | — (미지를 놓지 않는다) | C026~C028 |

**RoomAnswersWhenAsked 는 순서 밖이다** — 앞의 셋(Rooms · Land · Rule)이 실제로 플레이되면서 돌아온 DESIGN GAP 이고,
기획을 하나도 덮지 않는다(그래서 아래 덮임 지도에 열이 없다). Material·Time·Frost·Life 와 **병행**한다.

순서는 의존성이다 — 그래프가 있어야 방이 있고, 방이 있어야 땅으로 채울 수 있고, 방 안에 구조(area · traversable)가
있어야 규칙이 바꿀 것이 있고, Region State 와 세계 과정이 있어야 재료가 생애를 가진다. 미로는 Region 하나이고 그
안의 길은 Connector 가 아니라 공간의 통로다. 진행은 각 Play 의 Cycle Breakdown 체크박스가 소유한다.

넷째는 [L2-World-Material.md](../L2-World-Material.md) 주입이 열었다 — 2층의 기획이 셋에서 넷이 되었다
(도구 · 세계관 컨셉 · 세계 content 구성 · **재료 생태와 공급 계약**). 그 문서와 이 Play 는 한 번에 승인됐다.
다섯째는 [L2-World-Time.md](../L2-World-Time.md) — 넷에 공통으로 없던 축 **시간**이다. 그 문서와 Play 는 한 번에 승인됐다.
넷째의 빈칸 넷(재료의 이름 · 성질 · 시간 규모 · 채취 단위)은 Human 이 위임해 그 Play 가 내렸다
(RoomBearsMaterial 의 위임된 결정 D1~D4 — Human 이 언제든 뒤집는다).
여섯째는 [L2-World-Life.md](../L2-World-Life.md) — 넷째가 남긴 구멍(허물에 주인이 없다)을 메우는 ②-부속 셋째다.
Frost 뒤에 오는 이유는 탄생이 **소비할 것**(재료)과 **탈 주기**(철)와 **대조할 갈래**(협곡)가 먼저 서야 하기 때문이다.
Play 여섯 중 다섯(RegionGraphRooms · RoomBecomesLand · RuleBoundRoom · RoomBearsMaterial · RoomNeverSame)과 컨텐츠
하나(RoomOfAnotherKind)는 **승인됐고**, 여섯째는 주입된 그대로다.

## 다섯 기획의 덮임 지도

| 기획 | 2층 Play 가 덮는 것 | 2층 밖 — 어느 층 |
|---|---|---|
| **도구** (WE · Plan · L2-World-Tool) | Region Description · anchor/graph · 관찰(observe) · 검사 ⑤~⑨ → **Rooms**. Height Field · Stamp · Curve · Surface 규칙 · traversable · 컴파일 캐시 · Build→Observe 루프 → **Land** | Tree/Rock Kit · scatter 밀도 · 자산 카탈로그 (WE §17~§26) → Land 이후의 폴리싱 (데이터). Streaming → 방 크기의 Region 에는 없다. Region 크기에 상한이 없으므로(Rooms 불변 조건 "방은 공간일 뿐이다") 큰 Region 이 실제로 올 때 Land 뒤 ENGINE 레인 — chunk 단위 적재, 관찰 계약 변경 없음 |
| **세계관 컨셉** (L2-World-Concept) | W1 깊이 · W11 끝없음 → **Rooms**. W5 지역은 하나의 현상 · W8 세계가 질문을 만든다(단서) · W9 플레이어 없이 돈다 → **Rule**. W2 안전은 조건이 만든다 · §16 비주얼 방향 → **Land**. **W4 위험과 보상의 동근원 · §4 숲의 생태 사슬 → Material** | W3 위험 일곱 갈래가 몸에 닿는 것 · W7 지식이 전투력 · W10 강함만으로 안 됨 → 3층. W4 중 **재료의 쓰임**(조합 · 효과 · 수치) → 4층 이후. W6 압도적 존재 → 컨텐츠 층 + 5층. §8 요정/Class → 7층. §14 사회적 분업 발견 → 뒤 층 |
| **세계 content 구성** (L2-World-Region) | R1 Graph · R3 WorldPosition · R5 중첩 · R6 Connector · R9 진입/이탈 · R12 공간 분리 → **Rooms**. R4 World State 공유 · R7 Region Rule · R8 규칙이 플레이를 만든다 · §10 activation/persistence · §16 Spec 양식 · §17 규칙 가독성 → **Rule**. R11 Terrain 은 결과다 · §13 · §15 9~10 → **Land**. **R10 하나의 Cause 에서 함께 닫힌다 · §15 4·5 의 자원 절 → Material** | §8 Discovery State(개인 지식) · §6 Hard Entry 의 knowledge activation → 3층. §12 Growth Outcome 중 **capability·성장** → 4층 이후 (재료 쪽은 Material 이 받는다). §6 Soft Requirement(체온 등 몸의 값) → 3층 |
| **재료 생태와 공급 계약** (L2-World-Material) | S1~S12 전부 → **Material** (원천 · 흔적 · 구배 · 생애 · 공급 · 채취 결과 · 흐름 · 도구 보고 ⑩~㉒) | S10 이 미룬 것 — Recipe · 조합 · Item 효과 · 수치 · Class 요구 → 4층 이후. Carrier 중 살아 있는 CREATURE · 채취가 생물 행동에 미치는 것 → 3층 |
| **세계의 시간과 위상** (L2-World-Time) | T1~T8 전부 → **Time** (시계 · 네 철 · 위상 덧씌움 · 소란 · 발자국 · 압도적 존재의 경로 · 검사 ㉓~㉖) | 시간이 몸에 하는 일 · 생물의 철 따른 행동 → 3층. 압도적 존재와의 접촉 → 3·5층. 날씨 → 두지 않는다(컨텐츠 행). 걷는 숲의 나무 이동 → 그 Region 의 Play |
| **생명의 성립과 탄생** (L2-World-Life) | F1~F15 전부 → **Life** (생명의 정의 · 네 탄생 방식 · 탄생의 조건과 소비 · 전후의 흔적 · 개체군 값과 관계 · 멸종 없음 · 스폰이 아닌 회복 · 검사 ㉗~㉝) | 태어난 개체의 몸 · 감각 · 지식 · 행동 · 죽음 · 성장 단계 · 능력치 → 3층. 성별과 구체적 번식 · 유전과 변이 → 3층 이후. 플레이어가 탄생에 개입하는 구체적 Action → 3층 이후 (2층의 개입은 채취뿐). 요정의 원리 결속 → 7층. 최초의 생명 → **확정하지 않는다** (F12) |

여섯 Play 가 닫히면 2층이 닫힌다. 그 뒤 컨텐츠 층의 행(M1 · M2 와 §5.1 의 이름들)은 요구 축이 서는
대로 각자의 Play 를 받는다.
