# RuleBoundRoom — 규칙을 품은 방, 환상의 미로

상태: **승인 대기** (AI 초안 — Human 승인 1회로 확정된다. 문서 끝 "Human 질문"에 답과 함께).
선행: [RegionGraphRooms.md](RegionGraphRooms.md) 가 닫혀 있어야 한다 — 그래프가 있어야 규칙이 그것을 바꾼다.

## 0. Row

**기반 층 L2 — 세계 자체.** 이 Play 가 증명하는 축: *방은 규칙을 품는다. Region Rule 은 Global Rule 위에
scope 를 두고 서며, 그 결과(Connector Graph)는 World State 라서 관찰자 모두에게 하나다.*

놓는 미지 — **M2 환상의 미로** (`FANTASY_MAZE`). [L2-World-Region.md](../L2-World-Region.md) §16 이 Region Spec
을 통째로 주었다 — 이 Play 는 그 Spec 을 방으로 세운다.

방향 한 줄과의 관계 — 방은 여전히 단순하다. 바뀌는 것은 방이 아니라 **방 사이의 연결**이고, 그것이
"미지의 느낌"의 두 번째 층이다: 첫 Play 에서는 목적지를 몰랐고, 이 Play 에서는 **연결 자체가 움직인다.**

## 1. References

- [L2-World-Region.md](../L2-World-Region.md) §4 Region Rule · §4.3 Rule Contract · §5 규칙이 플레이를 만든다 · §8 하나의 세계 · §10 Connector · §16 Region Spec(FANTASY_MAZE) · §17 규칙 가독성
- [L2-World-Concept.md](../L2-World-Concept.md) W5 지역은 하나의 현상 · W8 세계가 질문을 만든다 · W9 플레이어 없이 돈다
- [L1-World-Grammar.md](../L1-World-Grammar.md) — Natural Law · 적용 순서 · 저장/유도 구분 (Region Rule 이 이 문법 안에 있음을 보인다)
- [RegionGraphRooms.md](RegionGraphRooms.md) §6 — 재사용하는 W1~W8 · V1~V4 · E1~E4

## 2. Play Goal

**관찰자가 고대 문을 지나 환상의 미로의 방들에 들어가, 길을 외우는 것으로는 미로의 심장에 닿지 못하고,
방들을 움직이는 규칙(움직임이 압력이 되고 압력이 연결을 바꾼다)을 관찰해 그것을 이용해 심장에 닿은 뒤,
두 번째 관찰자가 같은 미로에서 같은 연결 상태를 본다.**

완료 확인 셋: 심장 방(`MAZE_HEART`)의 scene 이 관찰 결과에 찍힌다 · 그 직전 Connector Graph 의 패턴이
초기값(DEFAULT)과 다르다 · 같은 tick 의 두 관찰자 관찰 결과에서 미로 Connector 의 상태가 같다.

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

- **자신감** — 고대 문이 열려 있다(C004 가 데이터로 열었다). 들어간다. 방 넷, 출구 여럿. 지도를 그린다.
- **당황** — 되돌아가는 출구로 나왔는데 다른 방이다. 방의 식물(안정된 식물)은 그 자리 그대로다.
- **의심** — 가만히 서 있으면 아무것도 바뀌지 않는다. 걸으면 바뀐다. → 걸음을 센다.
- **관찰** — 방의 바닥에 압력 표시가 있다 (HUD 의 값). 걸을수록 오른다. 넘치면 출구 표식이 바뀐다.
- **가설** — "압력이 차면 연결이 재배열된다. 식물은 방의 이름표다."
- **시험** — 일부러 압력을 채운다. 재배열이 온다. 식물로 어느 방인지 안다.
- **이해** — 재배열은 무작위가 아니라 패턴 순환이다(DEFAULT → A → B → …). 심장은 특정 패턴에서만 열린다.
- **이용** — 원하는 패턴이 올 때까지 압력을 채우고, 그 패턴에서 심장 쪽 출구로 간다.
- **도달** — 미로의 심장. 출구 하나: 뒤집힌 정원 쪽(문만, 방은 이 Play 밖).
- **공유된 세계** — 두 번째 관찰자가 들어온다. 첫 관찰자가 만든 패턴 그대로다. 그의 걸음도 압력을 올린다.

## 5. Play Structure

### 5.1 자신감 — 미로의 방들 (`MAZE_CELL_A~D` · depth/deep)

```text
존재   방 넷(§5.6 제안). 각 방에 안정된 식물 point 하나(layer: clue). 출구 anchor 는 방마다 셋
상태   FANTASY_MAZE 의 Region State — connectorPattern: DEFAULT · pressure: 0 · heartAccess: LOCKED  (Spec §16 state)
조건   Connector 의 to 는 고정이 아니다 — connectorPattern 이 정한다 (패턴 표: 데이터)
관찰   방마다 식물 표식(종류가 다르다 — 이름표). 출구 셋. 목적지는 여전히 안 보인다
추론   "방은 넷, 식물이 넷. 식물로 방을 구분할 수 있다"
반응   건너면 현재 패턴이 정하는 방으로 간다
```

### 5.2 당황 · 의심 · 관찰 — RULE_MAZE_CONNECTION (Core Rule)

Rule Contract (Region §4.3) 로 적는다 — 이것이 02-world 의 양식이 된다.

```text
Scope        FANTASY_MAZE 안의 모든 몸 (관찰자 · 자율 존재 구분 없음)
Trigger      몸이 미로 안에서 이동한다 (move-progress 가 위치를 바꿀 때)
Condition    항상 — 미로 안에 있으면
Effect       Region State.pressure += 이동 거리 × k. pressure ≥ P 이면 connectorPattern 을 다음 패턴으로,
             pressure = 0. (k · P · 패턴 순환은 Human 질문 1·2)
Feedback     HUD 에 pressure(counter, progress = pressure/P). 재배열 순간 출구 표식이 바뀐다 (intensity 맥동 — SceneGroundZone.intensity 재사용)
Exploit      압력을 일부러 채워 원하는 패턴을 부른다. 식물로 자기 방을 안다
Persistence  Region State — 세계에 하나. 관찰자가 나가도 남는다 (W9)
Priority     move-progress 뒤 · 투영 앞 (SYSTEMS 배열 순서 — L1 적용 순서)
```

Global Rule 과의 결합 방식 — **Additive** (이동 위에 압력이라는 State 를 더한다). 이동 자체는 바꾸지 않는다.
Region Rule 이 L1 의 Natural Law 임을 보이는 자리다: 조건에 "몸의 regionId = FANTASY_MAZE" 가 들어간 것뿐이다.

### 5.3 가설 · 시험 — RULE_STABLE_PLANT_CLUE (Supporting Rule)

```text
Scope        미로의 각 방
Trigger      없음 — 항상 참인 State
Effect       각 방의 clue point 는 패턴과 무관하게 그 방에 있다 (재배열은 Connector 만 바꾼다)
Feedback     식물 표식 — 방마다 다른 sprite/색 (view 표)
Exploit      "어느 방에 있는가"를 식물로 안다. 지도는 못 그려도 이름표는 읽는다
```

규칙이라기보다 **재배열이 건드리지 않는 것**의 선언이다 — 그래서 Supporting 이다. 관찰 가능성(§17)을
이것이 준다: Core Rule 의 결과를 읽을 기준점.

### 5.4 이해 · 이용 · 도달 — 심장 (`MAZE_HEART` · depth/deep)

```text
존재   심장 방. 들어오는 Connector 는 하나 — 어느 방의 어느 출구인가는 패턴 표가 정한다 (특정 패턴에서만 심장을 가리킨다)
상태   heartAccess: LOCKED → 그 패턴에서 OPEN (Connector.activation = Region State 조건 — Region §10)
관찰   그 패턴이 왔을 때만 어느 출구의 표식이 "열림"으로 바뀐다
추론   "심장은 패턴 X 에서 방 Y 의 출구 Z 다"
반응   건너면 심장. 출구 하나: 뒤집힌 정원 쪽 문 — 이 Play 는 건너지 않는다 (topology.children 만 그래프에)
```

### 5.5 공유된 세계 — 두 번째 관찰자

```text
존재   관찰자 둘 (다중 관찰자 — Existing)
상태   같은 FANTASY_MAZE Region State
관찰   둘의 관찰 결과에서 connectorPattern · pressure · 출구 표식이 같은 tick 에 같다. 한쪽이 걸으면 다른 쪽의 pressure 도 오른다
추론   "이 미로는 내 것이 아니다. 세계의 것이다"  (R4)
반응   없음 — 관찰만으로 증명된다
```

RULE_SPATIAL_ECHO (Ambient) 는 이 Play 에서 세우지 않는다 — 분위기 규칙이고 축의 증명에 필요 없다.
Spec 의 `rules.ambient` 자리에 이름만 남는다.

### 5.6 미로 그래프 (제안 — Human 질문 3)

```text
FOREST_DEEP ── ANCIENT_GATE(door, C004 가 연다) ──▶ MAZE_CELL_A
                                                       │
     ┌──── 패턴이 정하는 연결 (표) ────┐               │
     │  DEFAULT: A→B, B→C, C→D, D→A     │   방 넷 A·B·C·D — 각 방 출구 셋 (앞 · 옆 · 뒤)
     │  P1:      A→C, C→B, B→D, D→A     │   "뒤" 출구는 언제나 들어온 방으로 — 단 재배열 뒤엔 다른 방일 수 있다
     │  P2:      A→D, D→C, C→A, B→HEART │   P2 에서만 B 의 "앞" 이 심장을 가리킨다
     └────────────────────────────────┘
MAZE_HEART ── door → INVERTED_GARDEN (문만 — 방은 이 Play 밖)
탈출:  COLLAPSE_TO_ENTRY — 어느 방에서든 "돌아가기" 명령(개발 명령 표면 재사용)이 A 의 입구 anchor 로 (Spec exit.emergency)
```

## 6. Required Capability

### Existing (재사용)

```text
RegionGraphRooms 의 전부 (W1~W8 · V1~V4 · E1~E4) · 이동(move-progress) · HUD counter+progress ·
SceneGroundZone.intensity(맥동) · 다중 관찰자 · 개발 명령 표면 · 세계 영속
```

### Required — 세계

```text
W9   Region State — Region Spec 의 state 가 WorldState 에 들어온다 (regions[id].state). 스냅샷에 실린다
W10  패턴 표 — Connector.to 가 고정값이 아니라 Region State 의 키로 풀리는 형 (graph.ts 의 Connector 에 `toByPattern`)
W11  RULE_MAZE_CONNECTION — 시스템 하나. scope 판정 + pressure 누적 + 패턴 전이. SYSTEMS 배열에 자리
W12  Connector.activation = Region State 조건 (heartAccess) — 건너기 규칙(W4)이 이것을 읽는다
W13  exit.emergency — 명령 표면에 "돌아가기" 명령 (CommandCatalog 재사용)
W14  투영 — HUD 에 pressure · 패턴 전이 순간의 사유 코드 (maze-rearranged)
```

### Required — 표현

```text
V5   clue point 표식 — layer: clue 의 tag → sprite/색 표 (방마다 다른 식물)
V6   재배열 순간 — 출구 표식 맥동 (intensity) · HUD 문구
```

### Required — 기구 (ENGINE 레인)

```text
E5   없음이 목표다. Region Rule 은 content/world/simulation 의 시스템 하나로 선다.
     두 번째 Region Rule 이 생기면 Rule Primitive(Trigger + Condition + State Change + Feedback + Reset)를
     engine/physics 옆으로 뽑는다 — 이 Play 에서는 뽑지 않는다 (Region §3.3)
```

### 불변 조건 — 코드 변경 없이 폴리싱

```text
패턴을 더한다 · 방을 더한다 · 임계값을 바꾼다 · 식물 표식을 바꾼다 → graph.ts 의 패턴 표 · Region Spec 의 state · view 표
규칙을 하나 더 넣는다 → 시스템 하나 (코드) — 이것은 폴리싱이 아니라 새 Cycle 이다
```

## 7. Cycle Breakdown

```text
[ ] C005 — 규칙이 하나 있는 방: 미로 방 넷 + Region State(pressure · pattern) + RULE_MAZE_CONNECTION.
           걸으면 압력이 오르고 넘치면 출구가 바뀐다. 식물 표식으로 방을 안다
[ ] C006 — 규칙을 이용해 닿는다: 패턴 조건 activation(heartAccess) + 심장 방 + 돌아가기 명령.
           원하는 패턴을 불러 심장에 닿는다
[ ] C007 — 세계는 하나다: 두 관찰자가 같은 미로 State 를 본다. 한쪽의 걸음이 다른 쪽의 압력이다.
           떠난 뒤에도 State 가 남는다 (영속 스냅샷에 Region State)
```

## Human 질문

```text
1. 압력 상수 — 이동 거리 1 당 압력 k, 임계값 P. 수치는 Human 의 것 (제안: 한 방을 가로지르면 P 의 1/3)
2. 패턴 순환 — §5.6 의 세 패턴(DEFAULT → P1 → P2 → DEFAULT)은 제안이다. 몇 개, 어떤 연결인가
3. 방 넷 · 출구 셋 — 미로의 크기. 승인?
4. 고대 문은 어떻게 열리는가 — 원문은 knowledge(3층)다. 2층에서는 C004 가 데이터로 연다(Spec state 로) — 승인?
   아니면 FOREST_DEEP 의 World State 조건(예: 숲 안쪽에서 일정 압력)을 둘 것인가
5. 미로의 심장에 무엇이 있는가 — Spec 은 reward 공간 왜곡 결정(4층) · discovery 뒤집힌 정원을 준다.
   이 Play 는 방과 문만 둔다 — 승인?
6. 자율 존재(NPC)의 걸음도 압력이 되는가 — W9 "플레이어 없이 돈다" 를 따르면 그렇다. 승인?
```
