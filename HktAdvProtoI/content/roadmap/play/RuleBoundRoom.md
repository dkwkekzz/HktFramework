# RuleBoundRoom — 규칙을 품은 방, 환상의 미로

상태: **승인됨** (Human 승인 1회 — 질문 여섯 전부 승인. 이후 Human 결정으로 미로를 Region 하나로 고쳐 씀).
선행: [RegionGraphRooms.md](RegionGraphRooms.md) 와 [RoomBecomesLand.md](RoomBecomesLand.md) 가 닫혀 있어야 한다 —
그래프가 있어야 규칙이 그것을 바꾸고, 방 안에 구조(area · traversable)가 있어야 규칙이 바꿀 것이 생긴다.

## 0. Row

**기반 층 L2 — 세계 자체.** 이 Play 가 증명하는 축: *방은 규칙을 품는다. Region Rule 은 Global Rule 위에
scope 를 두고 서며, 그 결과(방 안의 통로 · 방 밖으로의 Connector)는 World State 라서 관찰자 모두에게 하나다.*

놓는 미지 — **M2 환상의 미로** (`FANTASY_MAZE`). [L2-World-Region.md](../L2-World-Region.md) §16 이 Region Spec
을 통째로 주었다 — 이 Play 는 그 Spec 을 **Region 하나**로 세운다. 미로의 방들은 Region 이 아니라 그 공간 안의
구역(area)이고, 방 사이의 복도는 Connector 가 아니라 그 공간 안의 통로다. Connector 는 세계의 전이(고대 문 ·
심장 · 뒤집힌 정원)에만 쓴다 — Region 은 공간일 뿐이고 그 안의 구조는 공간의 것이다 (Rooms 불변 조건 넷째).

방향 한 줄과의 관계 — 방은 여전히 단순하다. 바뀌는 것은 방이 아니라 **방 안의 길**이고, 그것이
"미지의 느낌"의 두 번째 층이다: 첫 Play 에서는 목적지를 몰랐고, 이 Play 에서는 **길 자체가 움직인다.**

## 1. References

- [L2-World-Region.md](../L2-World-Region.md) §4 Region Rule · §4.3 Rule Contract · §5 규칙이 플레이를 만든다 · §8 하나의 세계 · §10 Connector · §16 Region Spec(FANTASY_MAZE) · §17 규칙 가독성
- [L2-World-Concept.md](../L2-World-Concept.md) W5 지역은 하나의 현상 · W8 세계가 질문을 만든다 · W9 플레이어 없이 돈다
- [L1-World-Grammar.md](../L1-World-Grammar.md) — Natural Law · 적용 순서 · 저장/유도 구분 (Region Rule 이 이 문법 안에 있음을 보인다)
- [L2-World-Tool.md](../L2-World-Tool.md) §2 "땅이 시간에 따라 바뀌는가" — 이 Play 가 그 첫 답이다: 높이는 정적이고 **통행만** State 가 된다
- [RegionGraphRooms.md](RegionGraphRooms.md) §6 — 재사용하는 W1~W8 · V1~V4 · E1~E4
- [RoomBecomesLand.md](RoomBecomesLand.md) §6 — 재사용하는 E6~E9 · W15 · V7 (area op · traversable · 이동 거절)

## 2. Play Goal

**관찰자가 고대 문을 지나 환상의 미로에 들어가, 길을 외우는 것으로는 미로의 심장에 닿지 못하고,
길을 움직이는 규칙(움직임이 압력이 되고 압력이 통로를 바꾼다)을 관찰해 그것을 이용해 심장에 닿은 뒤,
두 번째 관찰자가 같은 미로에서 같은 통로 상태를 본다.**

완료 확인 셋: 심장(`MAZE_HEART`)의 scene 이 관찰 결과에 찍힌다 · 그 직전 미로의 패턴이 초기값(DEFAULT)과 다르다 ·
같은 tick 의 두 관찰자 관찰 결과에서 미로의 통로 상태가 같다.

## 3. Experience Intent

```text
Start   미로는 길을 외우면 된다. 지도를 그리면 된다.
End     길은 외울 수 없다 — 내가 걷는 것이 길을 바꾼다. 대신 규칙이 있고, 규칙은 관찰할 수 있고,
        이해하면 미로가 나를 심장으로 데려간다. 그리고 그 미로는 남들에게도 같은 미로다.
```

## 4. Breath

```text
자신감 → 당황 → 의심 → 관찰 → 가설 → 시험 → 이해 → 이용 → 도달 → 공유된 세계
```

- **자신감** — 고대 문이 열려 있다(C004 가 데이터로 열었다). 들어간다. 구역 넷, 통로 여럿. 지도를 그린다.
- **당황** — 왔던 통로로 되돌아가려는데 막혀 있다. 없던 통로가 열려 있다. 구역의 식물(안정된 식물)은 그 자리 그대로다.
- **의심** — 가만히 서 있으면 아무것도 바뀌지 않는다. 걸으면 바뀐다. → 걸음을 센다.
- **관찰** — 바닥에 압력 표시가 있다 (HUD 의 값). 걸을수록 오른다. 넘치면 통로의 열림·닫힘이 바뀐다.
- **가설** — "압력이 차면 통로가 재배열된다. 식물은 구역의 이름표다."
- **시험** — 일부러 압력을 채운다. 재배열이 온다. 식물로 어느 구역인지 안다.
- **이해** — 재배열은 무작위가 아니라 패턴 순환이다(DEFAULT → P1 → P2 → …). 심장은 특정 패턴에서만 열린다.
- **이용** — 원하는 패턴이 올 때까지 압력을 채우고, 그 패턴에서 심장 쪽 문으로 간다.
- **도달** — 미로의 심장. 출구 하나: 뒤집힌 정원 쪽(문만, 방은 이 Play 밖).
- **공유된 세계** — 두 번째 관찰자가 들어온다. 첫 관찰자가 만든 패턴 그대로다. 그의 걸음도 압력을 올린다.

## 5. Play Structure

### 5.1 자신감 — 미로 (`FANTASY_MAZE` · depth/deep · Region 하나)

```text
존재   Region 하나. space 에 구역 area 넷(layer: cell · tag: A~D) · 통로 area 여섯(layer: passage · tag: AB · BC · CD · DA · AC · BD) ·
       구역마다 안정된 식물 point 하나(layer: clue) · anchor 둘(ANCIENT_GATE 입구 · HEART_GATE 심장 쪽)
상태   FANTASY_MAZE 의 Region State — connectorPattern: DEFAULT · pressure: 0 · heartAccess: LOCKED  (Spec §16 state)
       통로의 열림/닫힘은 패턴이 정한다 — 패턴 표(데이터)가 "어느 통로가 열려 있는가"를 준다
조건   닫힌 통로 area 는 통행 불가다 — 이동 규칙이 정적 traversable(컴파일 결과)과 함께 Region State 의 통로 상태를 읽는다
관찰   구역마다 식물 표식(종류가 다르다 — 이름표). 열린 통로와 닫힌 통로의 바닥 색이 다르다. 심장 쪽 문은 닫혀 있다
추론   "구역은 넷, 식물이 넷. 식물로 구역을 구분할 수 있다. 통로는 열리고 닫힌다"
반응   열린 통로로만 옆 구역에 간다. 닫힌 통로에 들어서려 하면 세계의 대답(거절 사유 코드 passage-closed)
```

### 5.2 당황 · 의심 · 관찰 — RULE_MAZE_CONNECTION (Core Rule)

Rule Contract (Region §4.3) 로 적는다 — 이것이 02-world 의 양식이 된다.

```text
Scope        FANTASY_MAZE 안의 모든 몸 (관찰자 · 자율 존재 구분 없음)
Trigger      몸이 미로 안에서 이동한다 (move-progress 가 위치를 바꿀 때)
Condition    항상 — 미로 안에 있으면
Effect       Region State.pressure += 이동 거리 × k. pressure ≥ P 이면 connectorPattern 을 다음 패턴으로,
             pressure = 0. 패턴이 바뀌면 열린 통로의 집합이 바뀐다 (패턴 표) — 통로 area 의 상태가 곧 바뀐 땅이다
Feedback     HUD 에 pressure(counter, progress = pressure/P). 재배열 순간 통로 바닥 색이 바뀌고 맥동한다
             (SceneGroundZone.intensity 재사용) · 사유 코드 maze-rearranged
Exploit      압력을 일부러 채워 원하는 패턴을 부른다. 식물로 자기 구역을 안다
Persistence  Region State — 세계에 하나. 관찰자가 나가도 남는다 (W9)
Priority     move-progress 뒤 · 투영 앞 (SYSTEMS 배열 순서 — L1 적용 순서)
```

Global Rule 과의 결합 방식 — **Additive** (이동 위에 압력이라는 State 를 더하고, 통행에 통로 상태라는 조건을 더한다).
이동 자체는 바꾸지 않는다. Region Rule 이 L1 의 Natural Law 임을 보이는 자리다: 조건에 "몸의 regionId = FANTASY_MAZE" 가
들어간 것뿐이다.

이 규칙이 **땅이 State 가 되는 첫 자리**다 (Tool §2). 다만 높이·표면은 여전히 컴파일 결과(정적)이고, 바뀌는 것은 통로
area 의 통행 여부 하나다 — 컴파일 결과 위에 Region State 가 덧씌워지는 형태이지 재컴파일이 아니다.

### 5.3 가설 · 시험 — RULE_STABLE_PLANT_CLUE (Supporting Rule)

```text
Scope        미로의 각 구역
Trigger      없음 — 항상 참인 State
Effect       각 구역의 clue point 는 패턴과 무관하게 그 구역에 있다 (재배열은 통로만 바꾼다)
Feedback     식물 표식 — 구역마다 다른 sprite/색 (view 표)
Exploit      "어느 구역에 있는가"를 식물로 안다. 지도는 못 그려도 이름표는 읽는다
```

규칙이라기보다 **재배열이 건드리지 않는 것**의 선언이다 — 그래서 Supporting 이다. 관찰 가능성(§17)을
이것이 준다: Core Rule 의 결과를 읽을 기준점.

### 5.4 이해 · 이용 · 도달 — 심장 (`MAZE_HEART` · depth/deep · 중첩 자식 Region)

```text
존재   심장 Region. 미로의 HEART_GATE anchor 에서 door Connector 하나로 들어간다 (Containment: parent = FANTASY_MAZE)
상태   heartAccess: LOCKED → 특정 패턴에서 OPEN (Connector.activation = Region State 조건 — Region §10)
관찰   그 패턴이 왔을 때만 심장 쪽 문의 표식이 "열림"으로 바뀐다. HEART_GATE 는 구역 B 안에 있다 — 그 패턴에서 B 에 닿을 수 있어야 한다
추론   "심장은 패턴 X 에서 구역 B 의 문이다"
반응   건너면 심장. 출구 하나: 뒤집힌 정원 쪽 문 — 이 Play 는 건너지 않는다 (topology.children 만 그래프에)
```

§16 의 "행동에 따라 Connector 관계가 재편된다"는 여기서 증명된다 — Region Rule 이 바꾸는 Connector 는 **세계의 전이**(심장 문)
하나이고, 미로 안의 길은 Connector 가 아니라 공간의 통로다.

### 5.5 공유된 세계 — 두 번째 관찰자

```text
존재   관찰자 둘 (다중 관찰자 — Existing)
상태   같은 FANTASY_MAZE Region State
관찰   둘의 관찰 결과에서 connectorPattern · pressure · 통로 상태가 같은 tick 에 같다. 한쪽이 걸으면 다른 쪽의 pressure 도 오른다
추론   "이 미로는 내 것이 아니다. 세계의 것이다"  (R4)
반응   없음 — 관찰만으로 증명된다
```

RULE_SPATIAL_ECHO (Ambient) 는 이 Play 에서 세우지 않는다 — 분위기 규칙이고 축의 증명에 필요 없다.
Spec 의 `rules.ambient` 자리에 이름만 남는다.

### 5.6 미로의 공간과 패턴 표 (데이터)

```text
FOREST_DEEP ── ANCIENT_GATE(door, C004 가 연다) ──▶ FANTASY_MAZE (Region 하나 · 80×80)

   FANTASY_MAZE 의 space                          패턴이 정하는 열린 통로 (표)
   ┌────────┬────────┐                            DEFAULT: AB · BC · CD · DA          (고리 — 지도를 그릴 수 있어 보인다)
   │  A     │  B  ◇  │   구역 넷 = 40×40 area     P1:      AC · CB · BD · DA          (고리가 끊기고 대각선이 열린다)
   │        │        │   ◇ = HEART_GATE anchor    P2:      AD · DC · CA · BD + 심장 문  (P2 에서만 heartAccess = OPEN)
   ├────────┼────────┤   통로 여섯 = 인접 넷(AB · BC · CD · DA) + 대각선 둘(AC · BD)
   │  D     │  C     │   입구 anchor(ANCIENT_GATE) 는 A 안
   └────────┴────────┘
MAZE_HEART ── door → INVERTED_GARDEN (문만 — 방은 이 Play 밖)
탈출:  COLLAPSE_TO_ENTRY — 어디서든 "돌아가기" 명령(개발 명령 표면 재사용)이 A 의 입구 anchor 로 (Spec exit.emergency)
```

구역·통로·패턴은 전부 Region Spec 과 패턴 표의 데이터다. 구역을 늘리거나 통로를 더하거나 패턴을 바꾸는 것은 코드가 아니다.

## 6. Required Capability

### Existing (재사용)

```text
RegionGraphRooms 의 전부 (W1~W8 · V1~V4 · E1~E4) · RoomBecomesLand 의 E6~E9 (area op · traversable · compile · observe) ·
W15 (이동 규칙이 traversable 을 읽는다) · V7 (surface 태그 → 색) · 이동(move-progress) · HUD counter+progress ·
SceneGroundZone.intensity(맥동) · 다중 관찰자 · 개발 명령 표면 · 세계 영속
```

### Required — 세계

```text
W9   Region State — Region Spec 의 state 가 WorldState 에 들어온다 (regions[id].state). 스냅샷에 실린다
W10  패턴 표 — 패턴 이름 → 열린 통로 태그의 집합. Region Spec 의 데이터 (space 의 passage area 와 태그로 맞물린다)
W11  RULE_MAZE_CONNECTION — 시스템 하나. scope 판정 + pressure 누적 + 패턴 전이. SYSTEMS 배열에 자리
W12  통로 상태 — 이동 규칙이 목표 자리의 정적 traversable 에 더해 "그 자리가 닫힌 통로 area 안인가"를 Region State 로 읽는다.
     닫혀 있으면 거절(사유 코드 passage-closed). 컴파일 결과는 바뀌지 않는다 — State 가 덧씌워진다
W13  Connector.activation = Region State 조건 (heartAccess) — 건너기 규칙(W4)이 이것을 읽는다
W14  exit.emergency — 명령 표면에 "돌아가기" 명령 (CommandCatalog 재사용) — 같은 Region 안에서 입구 anchor 로 옮긴다
W15' 투영 — HUD 에 pressure · 패턴 전이 순간의 사유 코드 (maze-rearranged) · 통로 area 의 열림/닫힘 상태
```

### Required — 표현

```text
V5   clue point 표식 — layer: clue 의 tag → sprite/색 표 (구역마다 다른 식물)
V6   통로 — passage area 를 SceneGroundZone 으로, 열림/닫힘 → 색 표. 재배열 순간 맥동 (intensity) · HUD 문구
```

### Required — 기구 (ENGINE 레인)

```text
E5   없음이 목표다. Region Rule 은 content/world/simulation 의 시스템 하나로 선다. area op 와 traversable 은 Land 가 세웠다.
     두 번째 Region Rule 이 생기면 Rule Primitive(Trigger + Condition + State Change + Feedback + Reset)를
     engine/physics 옆으로 뽑는다 — 이 Play 에서는 뽑지 않는다 (Region §3.3)
```

### 불변 조건 — 코드 변경 없이 폴리싱

```text
패턴을 더한다 · 구역을 더한다 · 통로를 더한다 · 임계값을 바꾼다 · 식물 표식을 바꾼다
    → Region Spec 의 space(area · point) · 패턴 표 · Region Spec 의 state · view 표
미로를 넓힌다 · 구역 모양을 바꾼다 · 높이를 준다 → space 의 op 만 (Land 와 같은 방법)
규칙을 하나 더 넣는다 → 시스템 하나 (코드) — 이것은 폴리싱이 아니라 새 Cycle 이다
```

## 7. Cycle Breakdown

```text
[x] C008 — 규칙이 하나 있는 방: 미로 Region 하나(구역 넷 · 통로 여섯) + Region State(pressure · pattern) + RULE_MAZE_CONNECTION.
           걸으면 압력이 오르고 넘치면 열린 통로가 바뀐다. 닫힌 통로는 거절한다. 식물 표식으로 구역을 안다
[x] C009 — 규칙을 이용해 닿는다: 패턴 조건 activation(heartAccess) + 심장 Region + 돌아가기 명령.
           원하는 패턴을 불러 심장에 닿는다
[x] C010 — 세계는 하나다: 두 관찰자가 같은 미로 State 를 본다. 한쪽의 걸음이 다른 쪽의 압력이다.
           떠난 뒤에도 State 가 남는다 (영속 스냅샷에 Region State)
```

## 확정 사항 (Human 승인)

```text
1. 압력 상수 — 한 구역(40×40)을 가로지르면 임계값 P 의 1/3 이 찬다. 곧 P = 120, k = 1 (이동 거리 1 = 압력 1).
   결정론 시뮬 상수이므로 헤더 상수로 고정한다.
2. 패턴 순환 — 셋 (DEFAULT → P1 → P2 → DEFAULT), 열린 통로는 §5.6 의 표. 데이터이므로 나중에 늘릴 수 있다.
3. 미로는 Region 하나(FANTASY_MAZE · 80×80)다. 그 안에 구역 넷(40×40 area)과 통로 여섯(area). 구역과 통로는 Region 이
   아니고 Connector 도 아니다 — 공간의 구조다. Connector 는 세계의 전이 셋뿐: 고대 문(들어옴) · 심장 문(중첩 자식) ·
   뒤집힌 정원 문(심장에서).
4. 고대 문은 RegionGraphRooms 의 C004 가 데이터로 연다 (Region Spec 의 state). 지식으로 여는 것은 3층의 것이다.
5. 심장에는 Region 과 뒤집힌 정원 쪽 문만 둔다. 보상(공간 왜곡 결정)은 4층, 정원은 그 Region 의 Play.
6. 자율 존재의 걸음도 압력이 된다 (W9 — 세계는 플레이어 없이도 돈다). 미로 안의 모든 몸이 Scope 다.
7. 순서는 RegionGraphRooms → RoomBecomesLand → RuleBoundRoom. 규칙이 바꿀 구조(area · traversable)를 Land 가 먼저 세운다.
   이 Play 의 Cycle 은 C008~C010 이다.
```
