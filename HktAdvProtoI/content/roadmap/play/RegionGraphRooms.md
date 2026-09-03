# RegionGraphRooms — 방과 방 사이, 지도 없는 세계

상태: **승인됨** (Human 승인 1회 — 질문 일곱 전부 승인). Cycle Breakdown 의 체크박스만 앞으로 갱신된다.

## 0. Row

**기반 층 L2 — 세계 자체.** 이 Play 가 증명하는 축은 하나다: *세계는 Region Graph 이고, 플레이어는
그 그래프를 걸으면서 깊이가 달라지는 것과 아직 가지 않은 곳이 남아 있다는 것을 느낀다.*

놓는 미지 (컨텐츠 층 첫 행) — **M1 거대 악마의 숲** (`GIANT_DEMON_FOREST`). 백왕령은 출발점이지 미지가
아니다.

방향 한 줄 (Human):

> 전반적으로 컨셉 느낌만 주는 간단한 구성의 방으로 표현(마치 단조로운 던전 같은 느낌). 지금의 세계관을
> 유지하여 각 방의 연결만 그럴듯하게 복잡한 세계를 표현하여 미지의 느낌을 보여주는 region graph 를
> 형성하고 플레이어는 이를 느낄 수 있어야 함. 이후 코드 변경 없이 폴리싱 가능한 구조로 개선할 수 있어야 함.

세 문장이 세 불변 조건이다.

```text
방은 단순하다        Region = 평평한 방 하나. 바닥 · 이름 · 깊이 색 · 출구 표식뿐. 지형·자연물은 없다
연결이 세계다        미지감은 방 안이 아니라 방 사이에서 난다 — 출구가 여럿 · 목적지는 건너야 안다 ·
                    작은 문이 큰 방으로 · 일방향 · 닫힌 문 · 돌아오는 길이 다른 곳으로
폴리싱은 데이터로     방·그래프·표현은 전부 content/regions 와 content/view 의 데이터다.
                    **총 수에 상한이 없다** — Connector 는 수십~수백이 될 수 있다 (L2-World-Region R13).
                    나중에 방을 지형으로 바꾸는 것은 같은 Region Spec 의 space 를 채우는 일이지 코드가 아니다
```

## 1. References

- [L0-Game.md](../L0-Game.md) — 게임 방향 · Core Breath · 판단 기준 넷
- [L2-World-Concept.md](../L2-World-Concept.md) — W1 이해의 깊이 · W2 문명은 예외 · W11 끝이 없다 · `depth` 다섯
- [L2-World-Region.md](../L2-World-Region.md) — R1 Region Graph · R3 WorldPosition · R5 중첩 · R6 Connector · R9 진입/이탈 · §5 이름 표 · §5.4 첫 Region 둘
- [L2-World-Tool.md](../L2-World-Tool.md) — §3 연결 계약 (layer · tag · op · anchor · graph.ts)
- [design/Design-World-Editor-Terrain-Compiler.md](../../../design/Design-World-Editor-Terrain-Compiler.md) §3 — 거대 악마의 숲의 Landmark · POI · Connector 목록 (정식 이름의 출처)

## 2. Play Goal

**관찰자의 몸이 백왕령을 나서 Connector 로 거대 악마의 숲의 방 다섯 이상을 건너고, 붉은 눈의 거목 안으로
들어갔다가 다른 곳으로 나와 백왕령까지 돌아온다 — 그동안 화면에서 방마다 깊이가 다른 것과 아직 건너지
않은 출구가 남아 있는 것을 읽는다.**

완료는 셋으로 확인한다: 관찰 결과의 `scene` 이 여섯 개 이상의 regionId 를 지났다 · 그 중 depth 가 셋
(civil · outer · wild) · 되돌아온 백왕령에서 아직 건너지 않은 출구가 하나 이상 화면에 남아 있다.

## 3. Experience Intent

```text
Start   여기가 세계의 전부처럼 보인다. 방 하나, 출구 몇 개. 어디로 이어지는지 모른다.
End     세계는 방들의 그물이고 나는 그 일부만 걸었다. 어떤 문은 닫혀 있었고, 어떤 길은 돌아올 수 없었고,
        작은 문 뒤에 큰 방이 있었다. 지도는 없지만 "저 출구 너머에 더 있다"는 것을 안다.
```

## 4. Breath

```text
익숙함 → 경계 → 호기심 → 낯섦 → 불안 → 발견 → 방향 상실 → 이해 → 귀환 → 새로운 미지
```

- **익숙함** — 백왕령. 사람이 사는 방. 출구가 여럿인데 하나만 길이다.
- **경계** — 길 끝의 출구에 이름이 없다. 건너기 전에는 무엇인지 모른다. → 건넌다.
- **호기심** — 숲 가장자리. 색이 바뀌고 이름이 생겼다. 출구가 셋으로 늘었다. → 하나를 고른다.
- **낯섦** — 숲 안쪽. 깊이가 또 바뀐다. 이름만 있는 문(고대 문)이 닫혀 있다. → 다른 출구로.
- **불안** — POI 방들. 둥지 · 폐허 · 광석 지대. 각각 막다른 방인데 하나에서만 다른 출구가 보인다. → 거목 쪽으로.
- **발견** — 붉은 눈의 거목. 작은 문. 들어가니 지금까지의 어느 방보다 큰 방이다. → 안으로.
- **방향 상실** — 거목 내부의 어느 출구는 추락이다. 떨어지면 심장 호수. 올라갈 길이 없다. → 남은 출구 하나.
- **이해** — 호수의 출구로 나오니 숲 안쪽이다. 들어간 곳과 다르다. 연결에는 종류가 있다 — 길 · 문 · 추락 · 물길. → 되짚는다.
- **귀환** — 백왕령. 같은 방인데 출구 하나가 아직 그대로 남아 있다.
- **새로운 미지** — 그 출구(붉은 황야 쪽 · 얼음 협곡 쪽)와 닫힌 고대 문. 이 Play 는 여기서 끝난다.

## 5. Play Structure

각 사건에 World Cause 여섯 질문(존재 / 상태 / 조건 / 관찰 / 추론 / 반응)을 붙인다.

### 5.1 익숙함 — 백왕령 (`WHITE_KING_DOMAIN` · depth/civil)

```text
존재   방 하나. 관찰자의 몸. 출구 anchor 셋 — FOREST_PATH(길) · 붉은 황야 쪽 · 얼음 협곡 쪽
상태   방의 depth = civil. 출구마다 transition 종류(road · pass)
조건   몸이 anchor 에 닿고 건너기 interaction 을 요청하면 전이가 판정된다
관찰   바닥 색(civil) · 방 이름 라벨 · 출구 표식 세 개(종류별로 다른 표식). 목적지 이름은 없다
추론   "여기는 안전한 곳이고 나가는 길이 여럿이다"
반응   건너면 관찰 결과의 scene 이 바뀌고 몸은 상대 방의 anchor 자리에 선다
```

### 5.2 경계 · 호기심 — 숲 가장자리 (`FOREST_EDGE` · depth/outer)

```text
존재   방. 출구 anchor — 돌아가는 길(백왕령) · 숲 안쪽(trail) · 탐험대 폐허(trail)
상태   depth = outer. FOREST_PATH 는 양방향
관찰   바닥 색이 civil 과 다르다. HUD 에 depth 사유 코드 → 문구("문명의 경계를 넘었다")
추론   "색이 곧 깊이다. 돌아갈 수 있다"
반응   되돌아가면 백왕령의 같은 anchor 에 선다
```

### 5.3 낯섦 — 숲 안쪽 (`FOREST_DEEP` · depth/wild)

```text
존재   방. 출구 — 가장자리(trail) · 포식수 둥지 · 생체 광석 지대 · 붉은 눈의 거목(interaction) · 고대 문(door, 닫힘)
상태   depth = wild. ANCIENT_GATE connector 의 활성 상태 = LOCKED (Region Spec 의 초기 state)
조건   닫힌 connector 는 건너기 요청을 거절한다 — 사유 코드 하나(connector-inactive)
관찰   출구가 다섯. 그 중 하나는 표식이 다르다(닫힘). 요청하면 세계의 대답(Request.Outcome)으로 거절이 온다
추론   "열리는 조건이 있다. 지금은 모른다"
반응   거절은 세계 State 를 바꾸지 않는다 — 요청의 대답만 돌아온다 (RULE-REQUEST-REPLY-001 재사용)
```

### 5.4 불안 — POI 방 셋 (`PREDATOR_NEST` · `EXPLORER_RUIN` · `BIO_ORE_FIELD` · depth/wild)

```text
존재   막다른 방 셋. 각 방에 출구는 돌아가는 것 하나 — 단 광석 지대에는 거목 쪽 출구가 하나 더 있다
상태   depth = wild. 방 안에 무엇이 있는가는 이 Play 의 것이 아니다 — 방은 비어 있고 이름만 있다
관찰   방 이름이 무엇이 있을 자리인지 말한다(둥지 · 폐허 · 광석). 비어 있다는 것 자체가 "아직 없다"
추론   "이름은 있는데 아직 아무것도 없다 — 나중에 채워질 자리다"  (폴리싱의 자리)
반응   없음 — 들어갔다 나온다
```

### 5.5 발견 — 붉은 눈의 거목 (`RED_EYE_TREE` · depth/wild) → 거목 내부 세계 (`TREE_INNER_WORLD` · depth/deep)

```text
존재   거목 방 — 작은 방. 출구 둘: 숲 안쪽(돌아감) · 안으로(door, 중첩)
       내부 세계 방 — 이 Play 의 어느 방보다 넓은 extent. 출구 둘: 나가는 문 · 아래로(falling, 일방향)
상태   Containment: TREE_INNER_WORLD 의 parent = RED_EYE_TREE. Spatial Embedding 없음 — 방 크기가 부모보다 크다
관찰   작은 방에서 문을 건너니 큰 방이다. depth 색이 deep 으로 바뀐다
추론   "안이 밖보다 크다. 세계는 좌표가 아니다"  (R5)
반응   되돌아가는 문은 거목 방의 같은 anchor 로 나온다
```

### 5.6 방향 상실 — 심장 호수 (`HEART_LAKE` · depth/deep)

```text
존재   방. 들어온 자리에는 anchor 가 없다 (추락은 도착 anchor 만 있고 돌아가는 connector 가 없다). 출구 하나: 물길(river)
상태   FALL connector 의 direction = one-way. 지속성 = WORLD_SHARED
조건   추락은 anchor 에 닿는 것만으로 전이된다 — 요청 없이 (Connector.transition = falling)
관찰   올라갈 출구가 없다. 남은 출구는 하나
추론   "돌아갈 수 없는 길이 있다. 그러면 남은 길이 답이다"
반응   물길을 건너면 숲 안쪽(FOREST_DEEP)의 다른 anchor 로 나온다 — 들어간 곳(거목 쪽)과 다른 자리
```

### 5.7 이해 · 귀환 · 새로운 미지

```text
존재   숲 안쪽 → 가장자리 → 백왕령. 전부 이미 있던 방
관찰   같은 방들을 거꾸로 지난다. 백왕령의 출구 셋 중 둘(붉은 황야 쪽 · 얼음 협곡 쪽)은 한 번도 건너지 않았다
추론   "연결에 종류가 있다 — 길은 돌아오고, 추락은 못 돌아오고, 문은 닫혀 있을 수 있고, 안은 밖보다 클 수 있다"
       "아직 안 간 곳이 있다"
반응   없음. 이 Play 는 여기서 끝난다. 붉은 황야 · 얼음 협곡은 Connector 가 가리키되 방은 이 Play 가 짓지 않는다
       (Human 질문 5)
```

### 5.8 방 그래프 (제안 — Human 질문 1·2·3)

```text
WHITE_KING_DOMAIN (civil)
 ├─ FOREST_PATH  road  ⇄  FOREST_EDGE (outer)
 │                         ├─ trail ⇄ EXPLORER_RUIN (wild, 막다른 방)
 │                         └─ trail ⇄ FOREST_DEEP (wild)
 │                                     ├─ trail ⇄ PREDATOR_NEST (wild, 막다른 방)
 │                                     ├─ trail ⇄ BIO_ORE_FIELD (wild) ─ trail ⇄ RED_EYE_TREE
 │                                     ├─ interaction ⇄ RED_EYE_TREE (wild)
 │                                     │                 └─ door ⇄ TREE_INNER_WORLD (deep, parent=RED_EYE_TREE)
 │                                     │                             └─ falling → HEART_LAKE (deep)
 │                                     │                                           └─ river → FOREST_DEEP (다른 anchor)
 │                                     └─ door(LOCKED) → FANTASY_MAZE   (방은 이 Play 밖 — 문만 있다)
 ├─ pass → RED_WASTE     (Connector 만 — 방 없음)
 └─ pass → ICE_CANYON    (Connector 만 — 방 없음)
```

지금 데이터: 방 아홉 · Connector 열셋 (양방향 여덟 · 일방향 다섯 — 고대 문 · 고개 둘 · 추락 · 물길) ·
중첩 둘. 고대 문이 열려 있는지는 Human 질문 ④ 가 아직 답을 기다린다.

이 Play 가 증명하는 것은 **연결 종류의 수**다 — 길 · 오솔길 · 문 · 고개 · 들어감 · 추락 · 물길 일곱 갈래.
종류가 갈래를 주고, 그 갈래 위에서 **수는 데이터로 얼마든지 는다** (L2-World-Region R13). 아홉과 열셋은
이 Play 가 한 화면에서 증명하기에 알맞은 수이지 세계의 상한이 아니다 — 같은 코드로 방 수백, Connector
수백을 굴릴 수 있고 C004 가 그것을 실측한다. 늘릴 때 먼저 좁아지는 것은 세계의 총 수가 아니라
**한 방의 출구 수**다 (아래 Human 질문 ①).

## 6. Required Capability

### Existing (재사용)

```text
이동 · 몸 충돌 · 관찰자 참여/이탈 · 관찰 결과(GameViewSnapshot: scene · entities · interactions · hud · commands)
요청의 대답(RequestOutcome — 거절 사유 코드) · HUD label 항목 · SceneGroundZone(바닥 표현의 자리) ·
세계 영속(스냅샷) · 다중 관찰자 · 개발 명령 표면
```

### Required — 세계 (content/world · protocol)

```text
W1  WorldState.regions · ActorState.regionId — WorldPosition = regionId + (x, z)       (R3)
W2  Region Graph 를 World Data 로 읽는다 — content/regions/graph.ts + 각 Region Spec         (R1)
W3  방 안 이동 — 몸은 자기 Region 의 extent 안에서만 움직인다 (WORLD_BOUNDS 대체)
W4  건너기 — anchor 에 닿은 몸이 요청하면 상대 Region 의 anchor 로 옮긴다. transition = falling 은 요청 없이.
    direction = one-way 면 역방향 anchor 가 없다. 활성 상태가 LOCKED 면 거절(사유 코드)                 (R6 · R9)
W5  투영 — 관찰 결과에는 같은 Region 의 존재만 실린다. scene = regionId. 출구는 interaction 으로
    (id · transition 종류 · available · reason). 목적지 이름은 싣지 않는다
W6  HUD — 방 이름 · depth 사유 코드 (문구는 view)
W7  Connector 활성 상태는 Region Spec 의 초기 state 에서 온다 — 바꾸는 규칙은 이 Play 에 없다 (LOCKED 고정)
W8  STATE_VERSION 올림 · 스냅샷에 regionId
```

### Required — 표현 (content/view)

```text
V1  방 — extent 를 바닥으로 그린다 (SceneGroundZone polygon 하나). 색은 depth 태그 → 표 (terrain-presentation)
V2  출구 — anchor 자리에 표식. transition 종류 → 표식/색 표. 닫힘은 다른 표식. 이름 라벨 없음
V3  방 이름 라벨 · depth 문구 (code-text)
V4  카메라 — 방 extent 에 맞춘다 (큰 방은 넓게)
```

### Required — 기구 (engine, ENGINE 레인 — 별도 커밋)

```text
E1  engine/world-authoring: RegionDescription(최소형 — extent · areas · points) · RegionGraph 형 ·
    검사 ⑤~⑧ (anchor 존재 · 자식마다 Connector · 이탈 있음 · civil 에서 전부 닿음)              (Tool §1 · Region §3.2)
E2  SceneGroundZone.shape 에 polygon                                                        (Tool §1)
E3  GameViewSnapshot 에 region { id, hash }                                                   (Plan §3.5)
E4  tools/world-editor: world:observe --graph (방·Connector 표 + 검사 보고). 컴파일러의 높이·표면·scatter 는
    이 Play 에서 쓰지 않는다 — 방은 평평하다. 도구 1단계의 순서가 바뀐다: 그래프 → 방 → (뒤에) 지형
```

### 불변 조건 — 코드 변경 없이 폴리싱

```text
방을 더한다 · 연결을 바꾼다 · 색을 바꾼다 · 출구 표식을 바꾼다 · 방을 넓힌다 · 문을 연다 ·
시작 방을 옮긴다
    → content/regions/*.ts · graph.ts · content/view 의 표만 바뀐다
방을 지형으로 바꾼다
    → 같은 Region Spec 의 space 에 stamp · curve · area op 를 더하고 world:compile 을 돌린다 — 뒤의 ENGINE 레인
검증  C004 가 이것을 실측한다 — 데이터만 바꾸고 게임이 도는가
```

**몇 개까지 되는가 — 상한이 없다** (L2-World-Region R13 · §2.1).

```text
규칙이 이름을 모른다   그래서 값이 늘어도 규칙은 바뀔 수 없다. C004 가 쟀다 —
                    content/world 35 파일 0 hit · engine 64 파일 0 hit
성능도 벽이 아니다     방 1000 · Connector 6000 에서 매 틱 도는 exitsOf 가 1초에 13 ms 다.
                    무거운 검사 둘은 도구가 부를 때만 돈다
먼저 좁아지는 것       세계의 총 수가 아니라 ① 한 방의 출구 수(화면·프롬프트) ② 손으로 짓는 것
                    ③ 사람이 읽는 보고. 셋 다 "한 자리에서 한 번에 보이는 수" 의 문제다
```

## 7. Cycle Breakdown

```text
[x] C001 — 방 둘과 길 하나: 백왕령 ⇄ 숲 가장자리. Region Graph 데이터 · regionId · 건너기 · 방 그리기 · 이름과 깊이
           (civil → outer — 2층 증명의 최소. 이것만으로 "안전권을 나서 깊이가 달라지는 것을 본다")
[x] C002 — 출구는 여럿, 목적지는 모른다: 숲 안쪽 · POI 방 셋 · 닫힌 고대 문 · 붉은 황야/얼음 협곡 쪽 Connector.
           출구는 종류만 보이고 닫힌 문은 거절한다
[ ] C003 — 작은 문, 큰 방, 돌아올 수 없는 길: 거목 → 내부 세계(중첩 · 더 큰 방) → 추락 → 심장 호수 → 물길 → 다른 자리로
[ ] C004 — 폴리싱은 데이터로: graph 와 표만 바꿔 방을 더하고 색을 바꾸고 문을 여는 것을 코드 diff 0 으로 실측.
           world:observe --graph 보고 + 검사 ⑤~⑧
```

각 항목은 작다 · 플레이 가능 · World 변화 분명 · 관찰 가능 · 검증 가능 · 재사용 가능. 순서는 의존성(그래프 →
전이 종류 → 중첩/일방향 → 검증)이자 Breath 의 순서(익숙함·경계·호기심 → 낯섦·불안 → 발견·방향 상실·이해 →
귀환·새로운 미지)다.

## 확정 사항 (Human 승인)

```text
1. 거대 악마의 숲은 방 여럿이다 — FOREST_EDGE(숲 가장자리) · FOREST_DEEP(숲 안쪽) 두 방을 새로 짓고
   WE §3 의 POI 셋과 Landmark 를 각각 방으로 둔다 (§5.8). 두 이름은 정식이다.
2. depth 배정 — civil 1 · outer 1 · wild 5 · deep 2 (§5.8).
3. 세계 사실 셋 — 거목 내부의 추락은 심장 호수로 · 호수의 물길은 숲 안쪽의 다른 자리로 ·
   고대 문은 이 Play 동안 닫혀 있다.
4. 방 크기 — 기본 40×40 (지금 WORLD_BOUNDS 와 같다). 거목 내부 세계는 80×80.
5. 붉은 황야 · 얼음 협곡 — Connector 만 두고 방은 짓지 않는다. 건너기 요청은 사유 코드로 거절한다
   (region-not-built — "아직 없는 곳"). 이것이 세계의 끝이 아니라 아직 만들지 않은 곳이라는 표시다.
6. 다른 관찰자는 같은 방에 있을 때만 보인다 (W5) — 세계 규칙으로 확정.
7. 도구 1단계의 순서를 그래프 → 방 → 지형으로 바꾼다 (E4). 높이·표면·scatter 는 RoomBecomesLand 로 미룬다.
8. **방과 Connector 의 총 수에 상한이 없다** — 수십~수백 규모를 전제한다. 이 Play 의 아홉과 열셋은
   한 화면에서 증명하기에 알맞은 수이지 세계의 상한이 아니다 (L2-World-Region R13 · §2.1).
```

## Human 질문 — 규모 주입(R13)이 남긴 것

이 Play 의 Cycle 넷은 이미 닫혔다. 아래는 **다음 Play 들이 받을** 질문이고, 답이 나오면 그때
해당 Play 의 Cycle 로 간다 — 이 Play 를 다시 열지 않는다.

```text
① 한 방이 감당하는 출구 수는 몇인가          ← 게임 의미(수치). 지어내지 않는다
   지금은 다섯(숲 안쪽)이 최대이고 그것도 한 화면에 안 들어와 시점을 돌려 센다.
   프롬프트는 그 중 하나만 말한다. 열이면? 서른이면?
   따라오는 질문 — 여럿을 한 번에 보여야 하는가, 가까운 것만 말해도 되는가,
   출구를 고르는 수단(목록·지목)이 필요한가

② 방 수백 개의 이름은 누가 짓는가            ← 세계관 사실. 지어내지 않는다
   지금은 방마다 사람이 이름 한 줄(REGION_NAMES)과 RegionSpec 파일 하나를 쓴다.
   수백이면 손으로 못 쓴다. 생성 규칙으로 짓는가(그러면 이름이 세계관 사실이 아니게 된다),
   아니면 이름 있는 방과 이름 없는 방을 가르는가

③ world:observe 는 수천 줄을 어떻게 보이는가   ← 도구. ①②의 답이 나온 뒤가 자연스럽다
   요약·추리기가 필요해지는 지점이다. C004 는 요구가 없어 읽기 전용 전체 출력만 만들었다

④ (이월) 고대 문과 확정 3                     ← 아직 답을 못 받았다
   확정 3 은 "고대 문은 이 Play 동안 닫혀 있다" 이고 RuleBoundRoom 확정 4 는
   "고대 문은 RegionGraphRooms 의 C004 가 데이터로 연다" 다. 둘 다 Human 승인이라 어긋난다.
   C004 는 뒤의 것을 따라 열었다 — 되돌릴 것은 CLOSED_CONNECTORS 한 줄이다
```
