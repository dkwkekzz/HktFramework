# play/ — 증명 Play 와 세 기획의 덮임

Play 하나는 로드맵의 **행 하나**를 증명한다 ([../README.md](../README.md) §1). 문서를 덮는 것이 아니다.
그래서 2층의 세 기획(도구 · 세계관 컨셉 · 세계 content 구성)은 Play 하나로 닫히지 않는다 — 2층에서
증명할 수 있는 것은 Play 셋으로 나뉘고, 나머지는 그 축이 서는 층에서 증명한다.

## 2층 Play 셋 (전부 **승인됨** — 순서대로)

| Play | 증명하는 것 | 놓는 미지 | Cycle |
|---|---|---|---|
| [RegionGraphRooms.md](RegionGraphRooms.md) | 세계는 방들의 그래프다 — 전이 · 깊이 · 중첩 · 일방향 · 닫힘 · 아직 안 간 곳 | M1 거대 악마의 숲 | C001~C004 |
| [RuleBoundRoom.md](RuleBoundRoom.md) | 방은 규칙을 품는다 — Region Rule 이 Connector Graph 를 World State 로 바꾸고, 그 State 는 관찰자 모두에게 하나다 | M2 환상의 미로 | C005~C007 |
| [RoomBecomesLand.md](RoomBecomesLand.md) | 방이 땅이 된다 — 같은 Region Spec 의 space 를 채우면 코드 없이 지형이 선다. 안전은 조건이 만든다 | — (백왕령은 미지가 아니다) | C008~C010 |

순서는 의존성이다 — 그래프가 있어야 규칙이 그것을 바꿀 수 있고, 방이 있어야 땅으로 채울 수 있다.
Cycle 번호는 C001~C010 으로 고정되었다 (승인). 진행은 각 Play 의 Cycle Breakdown 체크박스가 소유한다.

## 세 기획의 덮임 지도

| 기획 | 2층 Play 가 덮는 것 | 2층 밖 — 어느 층 |
|---|---|---|
| **도구** (WE · Plan · L2-World-Tool) | Region Description · anchor/graph · 관찰(observe) · 검사 ⑤~⑨ → **Rooms**. Height Field · Stamp · Curve · Surface 규칙 · traversable · 컴파일 캐시 · Build→Observe 루프 → **Land** | Tree/Rock Kit · scatter 밀도 · 자산 카탈로그 (WE §17~§26) → Land 이후의 폴리싱 (데이터). Streaming → 방 크기의 Region 에는 없다. Region 크기에 상한이 없으므로(Rooms 불변 조건 "방은 공간일 뿐이다") 큰 Region 이 실제로 올 때 Land 뒤 ENGINE 레인 — chunk 단위 적재, 관찰 계약 변경 없음 |
| **세계관 컨셉** (L2-World-Concept) | W1 깊이 · W11 끝없음 → **Rooms**. W5 지역은 하나의 현상 · W8 세계가 질문을 만든다(단서) · W9 플레이어 없이 돈다 → **Rule**. W2 안전은 조건이 만든다 · §16 비주얼 방향 → **Land** | W3 위험 일곱 갈래가 몸에 닿는 것 · W7 지식이 전투력 · W10 강함만으로 안 됨 → 3층. W4 위험과 보상의 동근원(자원 사슬) → 4층. W6 압도적 존재 → 컨텐츠 층 + 5층. §8 요정/Class → 7층. §14 사회적 분업 발견 → 뒤 층 |
| **세계 content 구성** (L2-World-Region) | R1 Graph · R3 WorldPosition · R5 중첩 · R6 Connector · R9 진입/이탈 · R12 공간 분리 → **Rooms**. R4 World State 공유 · R7 Region Rule · R8 규칙이 플레이를 만든다 · §10 activation/persistence · §16 Spec 양식 · §17 규칙 가독성 → **Rule**. R11 Terrain 은 결과다 · §13 · §15 9~10 → **Land** | §8 Discovery State(개인 지식) · §6 Hard Entry 의 knowledge activation → 3층. §12 Growth Outcome(재료·capability) → 4층 이후. §6 Soft Requirement(체온 등 몸의 값) → 3층 |

세 Play 가 닫히면 2층이 닫힌다. 그 뒤 컨텐츠 층의 행(M1 · M2 와 §5.1 의 이름들)은 요구 축이 서는
대로 각자의 Play 를 받는다.
