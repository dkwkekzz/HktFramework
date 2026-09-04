# RoomBearsMaterial — 방이 재료를 낳는다, 거대 악마의 숲

상태: **승인됨** (Human 승인 1회 — 제안 여섯은 승인, 빈칸 넷은 "알아서" 로 위임되어 이 문서가 내렸다. 아래 확정 사항 · 위임된 결정).
Cycle Breakdown 의 체크박스만 앞으로 갱신된다. 주입 원문은
[L2-World-Material.md](../L2-World-Material.md) 가 소유한다.
선행: [RoomBecomesLand.md](RoomBecomesLand.md) 가 area·traversable·compile 을, [RuleBoundRoom.md](RuleBoundRoom.md) 가
Region State 와 "세계는 플레이어 없이도 돈다" 를 먼저 세운다 — 재료 생태는 그 둘 위에 선다.

## 0. Row

**기반 층 L2 — 세계 자체 (세계 절반 ② 부속).** 이 Play 가 증명하는 축: *방은 재료를 낳는다. 재료는
하나의 World Cause 에 매달려 여러 자리에 여러 형태로 나고, 보이기 전에 흔적으로 먼저 오고, 캐면 세계에
자국이 남고, 세계의 과정으로 되돌아오되 같은 자리가 아니다.*

놓는 미지 — 새 지역이 아니라 **미지 M1(거대 악마의 숲)을 깊게 한다.** 그 숲의 재료 계통에는 아직 이름이
없다 ([L2-World-Concept.md](../L2-World-Concept.md) §4 는 관계만 주고 이름을 주지 않았다) — 이름은
Human 이 위임해 이 문서가 지었다 (위임된 결정 D1 — 생체 광석 · 광식충 허물 · 거목균). 그것이 컨텐츠 층의
새 행 **M3 숲의 재료 계통**이다 ([../README.md](../README.md) §3).

방향과의 관계 — 앞의 세 Play 는 방을 **짓는** 것을 증명했다 (그래프 · 땅 · 규칙). 이 Play 는 그 방이
**무엇을 내놓는가**를 증명한다. 세계가 성장의 원천이라는 문장([L0-Game.md](../L0-Game.md) §2)에서,
성장이 아니라 **원천** 쪽 절반이다.

```text
이 Play 가 세우는 것   재료의 세계 사실 — 왜 생기는가 · 어디에 붙어 있는가 · 무엇이 암시하는가 ·
                     캐면 무엇이 달라지는가 · 어떤 과정으로 돌아오는가 · 어떻게 흐르는가
이 Play 가 세우지 않는 것  그 재료의 쓰임 — Recipe · 조합 · Item 효과 · 수치 · Class 요구 (4층 이후) ·
                     살아 움직이는 생물 (3층) · 무엇을 알아냈는가 (3층 지식)
```

## 1. References

- [L2-World-Material.md](../L2-World-Material.md) — 주입 원문 전체. 특히 M1~M10 · §5 계약 열한 항목 · §6 데이터 계약 · §9 보고 ⑩~㉒ · §10 작성 양식 · §11 거대 악마의 숲 예시
- [L2-World-Concept.md](../L2-World-Concept.md) §4 숲의 생태 사슬(**이 Play 의 World Cause 원본**) · §6 위험과 보상의 동근원 · §12 지역은 하나의 현상 · §3.5 layer(resource · trace · presence)
- [L2-World-Region.md](../L2-World-Region.md) R10 하나의 Cause 에서 함께 닫힌다 · R11 Terrain 은 결과다 · R13 데이터에 상한 없음 · §5.1 이름 표 · §3.2 검사 ⑤~⑨
- [L0-Game.md](../L0-Game.md) §4 판단 기준 넷 · Core Breath
- [RegionGraphRooms.md](RegionGraphRooms.md) — 재사용하는 방 여섯과 Connector(특히 `HEART_RIVER` 물길) · 확정 1(숲은 방 여럿이다)
- [RoomBecomesLand.md](RoomBecomesLand.md) §6 — 재사용하는 E6~E9 · W15(traversable) · V7·V8(표면 표)
- [RuleBoundRoom.md](RuleBoundRoom.md) §6 — 재사용하는 W9(Region State) · W12(State 가 컴파일 결과 위에 덧씌워진다) · V6

## 2. Play Goal

**관찰자가 숲 가장자리의 흔적 하나에서 시작해 재료 아이콘 없이 원천에 닿아 캐고, 캔 자리와 그 둘레가
달라진 채 남아 다른 관찰자에게도 그렇게 보이며, 균류를 캔 것이 거목 쪽 회복을 늦추는 것을 관찰하고,
되돌아온 원천이 같은 자리가 아니라 뿌리가 뻗은 다음 마디에 선 것을 본다.**

완료 확인 다섯:

```text
① 화면에 재료 표식(아이콘 · 미니맵 · 좌표 안내)이 없는 상태에서, 흔적만으로 Source 일곱 중 다섯 이상에 닿는다
② 채취 전후의 관찰 결과가 다르다 — Source 상태 · 둘레 흔적의 세기 · 통행(무너진 노두는 못 지나간다)
③ 두 관찰자의 같은 tick 관찰 결과에서 Source 상태가 같고, 세계를 껐다 켜도 남는다
④ 둥지의 균류를 캔 뒤 거목 쪽 회복이 실제로 늦어진다 — Source 사이의 의존이 화면에서 읽힌다
⑤ world:observe --report 의 ⑩~㉒ 가 통과하고, ⑲⑳ 이 Opportunity 역할 넷 · Carrier 유형 다섯을 요약한다
```

## 3. Experience Intent

```text
Start   재료는 광맥이다. 아이콘이 있고, 캐면 사라지고, 잠시 뒤 같은 자리에 다시 생긴다.
End     재료는 세계가 만들고 있는 것이다. 흔적이 먼저 오고, 캔 자리에는 자국이 남고,
        다른 것을 캐면 이것이 늦어지고, 돌아올 때는 다른 자리에 선다.
        그리고 손에 든 것이 무엇에 쓰이는지는 아직 세계가 말하지 않는다.
```

## 4. Breath

```text
이상함 → 추측 → 추적 → 확보 → 자국 → 사슬 → 되돌아옴 → 공유된 고갈 → 넘길 것
```

- **이상함** — 숲 가장자리, 나무 밑동에 낯선 껍질 조각이 흩어져 있다. 그 둘레 흙 색이 다르다.
- **추측** — 탐험대 폐허의 버려진 더미에도 같은 것이 섞여 있다. "이 숲에 무슨 계통이 하나 있다."
- **추적** — 흙 변색은 안쪽으로 갈수록 짙다 — **방향이 있다.** 따라가면 광석 지대의 노두와 거목의 뿌리혹.
- **확보** — 캔다. 깊은 자리일수록 위험이 함께 온다 — 같은 원인이 만든 것이므로 (Concept §6).
- **자국** — 노두는 무너져 구덩이가 되고 그 자리는 못 지나간다. 둘레 변색이 옅어진다. 돌아와도 그대로다.
- **사슬** — 둥지 아래 균류를 캤더니 거목 쪽 흙의 회복이 멎는다. "이것들이 서로 이어져 있다."
- **되돌아옴** — 뿌리가 부푼다. 다음 노두는 캔 자리가 아니라 **뿌리가 뻗은 다음 마디**에 선다.
- **공유된 고갈** — 다른 관찰자가 들어와 내가 캔 자국을 그대로 본다. 가장자리의 허물은 아직 있다 — 그의 몫이 남아 있다.
- **넘길 것** — 손에 든 것은 아직 아무것도 아니다. 무엇으로 쓰는지는 이 층이 말하지 않는다는 것을 안다.

## 5. Play Structure

### 5.0 World Cause — 숲의 사슬 (Concept §4, 정식)

```text
거대 수목(붉은 눈의 거목)
→ 뿌리가 특정 광물을 흡수          축적자
→ 광물을 먹는 곤충                  소비자 → 허물 · 잔해
→ 곤충을 먹는 대형 조류             운반체 → 둥지로 옮긴다
→ 조류를 사냥하는 포식자            소비자 → 사체
→ 사체에서 특수 균류                분해자
→ 균류 때문에 다시 거대 수목 성장    고리가 닫힌다
```

이 사슬은 **고리**다. 그래서 재료도 고리다 — 한 자리를 캐면 다른 자리가 늦어진다. 이 Play 의 §5.5 가
그 고리를 증명한다.

**생물은 아직 세계에 없다** ([L2-World-Material.md](../L2-World-Material.md) §2.2). 이 Play 가 세우는 것은
그것들이 **남긴 것과 그 자리**다 — 허물 · 잔해 · 사체 · 균류 · 분해된 흙. 곤충이 실제로 기어 다니며 광물을
먹는 것은 3층이 받고, 그때 여기 선 Source 가 그 생물에 그대로 매달린다.

### 5.1 이상함 · 추측 — Baseline Opportunity 와 첫 흔적

```text
존재   FOREST_EDGE(outer) space — area(layer: trace, tag: soil-stain) 옅은 것 하나 ·
       point(layer: resource, tag: molt-litter, sourceId: MOLT_LITTER) 나무 밑동에.
       EXPLORER_RUIN space — point(layer: resource, sourceId: RUIN_SPOIL) 무너진 선광 더미
상태   둘 다 AVAILABLE 로 시작. Region State 의 sources[id] 에 phase 와 progress
조건   없음 — 경계부는 조건 없이 접한다 (§7 단계 11 "Region 초입에서도 재료 계통을 접할 수 있는가")
관찰   흩어진 껍질 조각 표식 · 흙 색이 다른 area · 폐허의 더미. 재료 아이콘은 없다
추론   "같은 것이 두 자리에 있다. 이 숲에 계통이 하나 있다"
반응   캔다 — 기존 채광 그대로. 얻는 것은 재료이지 쓰임이 아니다 (HUD 는 이름만 말한다)
```

경계부가 **가장 안정된 공급**이다 (`BASELINE_RENEWABLE`) — 먼저 온 사람이 다 가져갈 수 없는 자리를
가장 얕은 곳에 둔다 (M7 · 검증 8.4).

### 5.2 추적 — Trace 가 방향을 준다

```text
존재   FOREST_EDGE → FOREST_DEEP → BIO_ORE_FIELD / RED_EYE_TREE 로 갈수록 짙어지는
       area(layer: trace, tag: soil-stain) 의 세기 값
상태   세기는 정적 데이터가 아니라 **가까운 Source 의 phase 에서 유도된다** (L1 저장/유도) —
       원천이 고갈되면 흔적도 옅어진다
관찰   흙 색의 짙기 · 흔적에 서면 HUD 사유 코드(trace-stain: 짙어지는 쪽이 어디인가)
추론   "이건 표식이 아니라 방향이다. 짙은 쪽에 원천이 있다"
반응   방을 옮겨 간다 — Connector 를 건너는 것 자체가 추적이다 (Rooms 재사용)
```

흔적이 드러내는 것은 다섯 중 하나 이상이어야 한다 (S4): **존재 · 방향 · 활성 · 고갈 · 회복 단계.**
미니맵 아이콘은 흔적의 대체물이 아니다 (§12.4 금지) — 이 Play 는 재료용 아이콘을 만들지 않는다.

### 5.3 확보 — Risk Opportunity

```text
존재   BIO_ORE_FIELD — area(layer: resource, sourceId: ORE_OUTCROP) 노두. 거목 뿌리가 뻗어 온 자리
       RED_EYE_TREE — point(layer: resource, sourceId: ROOT_NODULE) 뿌리혹.
       둘 다 curve(layer: presence, tag: root) **뿌리 곡선** 위에 마디로 놓인다
상태   phase: AVAILABLE. 뿌리 곡선의 어느 마디가 노두인가는 Region State 가 들고 있다
조건   ROOT_NODULE 은 dependencies 를 가진다 — 분해된 흙(균류 계통)이 살아 있어야 축적된다
관찰   노두의 결정면 · 부푼 뿌리혹 · 그 둘레 흙의 짙은 변색
추론   "원천은 둘이지만 같은 것이다. 하나는 땅에서 캐고 하나는 뿌리에서 캔다"
반응   캔다. 깊은 방일수록 위험이 함께 온다 — 위험이 몸에 하는 일은 3층이지만 **깊이는 이미 보인다**
```

같은 Material Seed 가 **다른 순도·형태**로 나는 것은 M1 이 허용한 그대로다 — 종류를 늘리지 않고
기회를 늘린다.

### 5.4 자국 — Harvest Consequence

```text
존재   채취된 Source 의 자리
상태   phase: AVAILABLE → DEPLETED. Region State 에 남는다 (관찰자가 나가도 · 세계를 껐다 켜도)
효과   ① Source 의 외형이 바뀐다 — 무너진 노두 · 터진 뿌리혹 · 흩어진 무더기
       ② 둘레 trace 가 옅어진다 — 다음 사람이 "이미 훑은 자리"로 읽는다
       ③ 노두는 무너져 그 칸의 통행이 막힌다 (State 가 컴파일 결과 위에 덧씌워진다 — Rule 의 W12 그대로)
       ④ 그 Source 가 먹이던 다음 것의 조건이 늦어진다 (§5.5)
관찰   외형 · 흔적 세기 · 이동 거절 사유 코드(collapsed) · HUD 사유 코드(harvested)
추론   "캐는 것은 가져가는 것이 아니라 세계를 바꾸는 것이다"
반응   없음 — 세계가 그렇게 남는다
```

**같은 좌표에 아무 일 없이 다시 나타나는 것을 기본형으로 삼지 않는다** (M8). 이 Play 의 어떤 Source 도
"사라졌다가 제자리에 다시 생기지" 않는다 — §5.6 이 그 대신을 준다.

### 5.5 사슬 — 채취가 다른 재료의 조건을 바꾼다

이 Play 의 핵심 한 장면이다.

```text
존재   PREDATOR_NEST — area(layer: resource, sourceId: NEST_FUNGUS) 사체 위 균사.
       RED_EYE_TREE / BIO_ORE_FIELD 의 흙 — 균류가 분해해 만든 것
상태   NEST_FUNGUS.phase 가 DEPLETED 이면 분해가 멎는다 →
       ROOT_NODULE 의 축적 progress 가 오르지 않는다 → ORE_OUTCROP 의 다음 마디도 서지 않는다
관찰   둥지의 균사가 사라진다 · 거목 쪽 흙의 변색이 더 이상 짙어지지 않는다 ·
       부푼 뿌리(회복 흔적)가 멈춘 채로 있다 · HUD 사유 코드(recovery-stalled)
추론   "사슬이 고리였다. 아래를 끊으면 위가 멈춘다"
반응   기다리거나, 다른 기회로 간다 — 경계부의 허물과 물길의 퇴적은 이 고리 밖이다
```

M8 의 "다른 재료의 생성 조건"과 검증 8.5 의 "주요 채취가 다른 Source 에 영향을 주는가"가 여기서
동시에 닫힌다. 그리고 이것이 **재료가 Drop Table 이 아니라는 것의 증명**이다 (S2).

### 5.6 되돌아옴 — 회복은 세계 과정이고, 자리를 옮긴다

```text
존재   curve(layer: presence, tag: root) 뿌리 곡선 — 노두가 설 수 있는 마디의 목록
상태   세계 과정 하나가 돈다: 거목의 축적 progress 가 tick 마다 오른다 (조건: 분해된 흙이 있을 것).
       임계에서 phase: RECOVERING → AVAILABLE 로 돌아오되 **다음 마디**에 선다 (MIGRATORY)
관찰   회복 단계가 흔적으로 보인다 — 뿌리가 부풀고, 그 마디 둘레 흙이 짙어진다.
       고갈된 옛 자리는 무너진 채 그대로다 (돌아오지 않는다)
추론   "타이머가 아니다. 거목이 다시 빨아올리는 중이고, 다음은 저기다"
반응   회복 흔적을 읽고 미리 가서 기다린다 — 흔적이 예보가 된다
```

Supply Mode 넷이 서로 다른 회복을 준다 (전체는 §부록 10.2).

```text
BASELINE_RENEWABLE      MOLT_LITTER · RUIN_SPOIL   탈피 주기 · 더미의 침식으로 새 조각이 드러난다
CONDITIONAL_RENEWABLE   ROOT_NODULE · NEST_FUNGUS  분해된 흙이 있어야 · 사체의 분해 단계가 와야
MIGRATORY               ORE_OUTCROP                같은 자리에 나지 않는다 — 뿌리 곡선의 다음 마디
EVENT_SCARCE            RIVER_SILT                 물길이 불어난 때만 실려 온다 (사건은 되풀이된다)
FINITE_WORLD_STATE      쓰지 않는다                 기본 공급을 유한 원천에 걸지 않는다 (S7 · 확정 1)
```

### 5.7 공유된 고갈 · 넘길 것 — 두 관찰자와 흐름, 그리고 경계

```text
존재   관찰자 둘 (Existing) · Resource Flow 하나 —
       HEART_LAKE 의 침전(LAKE_SILT_BED) → 물길 HEART_RIVER → FOREST_DEEP 의 어귀(RIVER_SILT)
상태   Source 상태는 세계에 하나다 (R4). 흐름은 조건이 맞을 때 도착지에 퇴적을 만든다
관찰   ① 두 관찰자가 같은 자국·같은 회복 단계를 본다  ② 어귀에 퇴적선이 생긴다(trace) —
       거목이 빨아올린 것이 물에 갈려 다른 형태로 내려온 것이다  ③ 백왕령에는 이 계통이 없다
추론   "이 숲은 내 것이 아니다. 그리고 숲 안에서도 것들이 돌아다닌다.
        백왕령에 이것이 없는 이유는 백왕령이 안전한 이유와 같다 — 산과 강이 막는다"
반응   없음 — 관찰로 증명된다
```

넘길 것은 **Material Seed 셋과 그 공급 조건**이다. 이 Play 는 그것으로 무엇을 만드는지 한 줄도 정하지
않는다 (S10) — 그것을 정하지 않은 채로도 재료의 세계성이 분명한가가 이 Play 의 마지막 판정이다
(원문 §13-11).

## 6. Required Capability

### Existing (재사용)

```text
RegionGraphRooms 전부 (방 여섯 · Connector · 건너기 · 투영 · 깊이) · RoomBecomesLand 의 E6~E9 · W15 · V7 · V8
(area/point/curve op · traversable · compile · observe) · RuleBoundRoom 의 W9(Region State) · W12(State 덧씌움) · V6 ·
**채광**(RULE-MINE-001 / RULE-MINE-COMPLETE-001 — 대상만 Deposit 에서 Source 로 바뀐다) · 소지품 ·
HUD 사유 코드 · SceneGroundZone · 다중 관찰자 · 세계 영속 · 개발 명령 표면
```

지금 코드의 `Deposit`(광맥)은 **원인 없이 놓인 Loot Node** 다 — S2 가 금지한 바로 그것이다.
[L2-World-Region.md](../L2-World-Region.md) §5.3 이 `mining-field` 를 "Region 이 아니라 발판" 이라고 한 것과
같은 자리다: 이 Play 가 그 발판을 Resource Source 로 갈아 끼운다. 규칙(채광)은 남고 배치와 이유가 바뀐다.

### Required — 세계 (content/world · content/regions)

```text
W17  Material Seed / Resource Source / Resource Flow 데이터 — content/regions 의 값.
     RegionSpec += resourceEcology (원문 §6.4). 규칙 코드는 어떤 재료도 이름으로 알지 못한다 (R13)
W18  Source State — Region State 의 sources[id] = { phase · progress · siteIndex }. 스냅샷에 실린다
W19  채취 — 채광 규칙의 대상이 Source 가 된다. 거절 사유 코드 셋(depleted · not-exposed · condition-unmet)
W20  채취 결과 — phase 전이가 ① 외형 ② 둘레 trace 세기 ③ 통행(collapsed) ④ 의존 Source 의 조건을 바꾼다.
     재컴파일이 아니라 컴파일 결과 위의 State 덧씌움 (Rule W12 와 같은 형)
W21  회복 — 세계 과정 시스템 하나. Supply Mode 별 progress 규칙 + 임계 전이 + **자리 이동**(MIGRATORY 는
     presence 곡선의 다음 마디에 선다). 관찰자가 없어도 돈다 (Rule 확정 6 과 같은 근거)
W22  출현 조건 — Occurrence Condition 평가 (Region State · 주기 · 다른 Source 의 phase)
W23  Resource Flow — 출발 Source 의 상태가 Connector 를 통해 도착 Region 의 Source 를 만든다.
     세계에 하나이고 도착에 흔적을 남긴다
W24  투영 — 관찰 결과에 Source 의 **의미**(종류 · phase · 회복 단계)와 trace 의 reveals 만 싣는다.
     좌표 안내도 아이콘 지시도 싣지 않는다 (§12.4)
```

### Required — 표현 (content/view)

```text
V9   trace 표식 — tag → sprite/색 표, 세기 → 진하기. 재료 아이콘·미니맵 표식은 만들지 않는다
V10  resource 표식 — Source 종류 × phase → 외형 (AVAILABLE · DEPLETED · RECOVERING 이 눈으로 갈린다)
V11  문구 — 사유 코드 (trace-stain · harvested · collapsed · recovery-stalled · flow-arrived · condition-unmet)
V12  presence 곡선 — 뿌리 · 물길의 자리 (땅 위의 선). 다음 마디가 어디인지는 흔적이 말하고 선이 거들 뿐이다
```

### Required — 기구 (ENGINE 레인 B — 작다)

```text
E10  검사 ⑩~⑱ · ㉑ ㉒ — 참조 무결성. engine/world-authoring 의 검사 목록에 이어 붙인다 (⑤~⑨ 곁)
E11  요약 ⑲ ⑳ — Opportunity 역할 분포 · Carrier 유형 분포와 Source 수. **판정하지 않는다** (원문 §9)
E12  없음이 목표다 — resource · trace · presence 는 이미 Description 의 layer 다 (Land 가 area/point/curve 를 세웠다).
     새 op 도 새 layer 도 만들지 않는다
```

### 불변 조건 — 코드 변경 없이 폴리싱

```text
Source 를 더한다 · 흔적을 옮긴다 · Supply Mode 를 바꾼다 · 회복 임계를 바꾼다 · 의존을 잇는다 ·
Flow 를 하나 더 놓는다 · 재료를 하나 더 만든다
    → content/regions 의 데이터만 (materials · sources · flows · 각 RegionSpec.resourceEcology)
회복이 무엇으로 도는가를 바꾼다 (새 세계 과정)
    → 시스템 하나 — 이것은 폴리싱이 아니라 새 Cycle 이다
```

## 7. Cycle Breakdown

```text
[ ] C011 — 흔적이 원천으로 데려간다: Material Seed · Resource Source 데이터 계약 + RegionSpec.resourceEcology +
           resource/trace layer 배치 + 흔적의 방향(유도 세기) + 채광의 대상이 Source 가 된다.
           경계부 둘(허물 · 폐허 더미)과 핵심부 둘(노두 · 뿌리혹). 아이콘 없이 흔적만으로 닿는다
[ ] C012 — 캐면 세계가 달라진다: Source phase(Region State) + 채취 결과 넷(외형 · 흔적 · 통행 · 의존) +
           두 관찰자가 같은 자국을 보고 세계를 껐다 켜도 남는다
[ ] C013 — 세계가 되돌린다: 회복 세계 과정 + Supply Mode 넷 + 회복 흔적 + MIGRATORY 의 자리 이동
           (뿌리 곡선의 다음 마디). 균류를 캔 것이 거목 쪽 회복을 늦추는 고리를 화면에서 읽는다
[ ] C014 — 조건과 흐름, 그리고 보고: 조건부 기회(물길 주기 → 어귀 퇴적) + 부산물 기회(둥지의 균류) +
           Resource Flow 하나(HEART_LAKE → HEART_RIVER → FOREST_DEEP) + 백왕령의 Isolation Reason +
           world:observe --report ⑩~㉒ 와 분포 요약 ⑲⑳
```

각 항목은 작다 · 플레이 가능 · World 변화 분명 · 관찰 가능 · 검증 가능 · 재사용 가능.
순서는 의존성(원천이 있어야 캐고 · 캔 자국이 있어야 회복이 보이고 · 회복이 있어야 흐름이 의미를 가진다)이자
Breath 의 순서(이상함·추측·추적 → 확보·자국 → 사슬·되돌아옴 → 공유·넘길 것)다.

---

## 부록 — Resource Ecology Contract 초안 (거대 악마의 숲)

원문 §10 이 요구하는 표들이다. 이름과 성질은 위임된 결정 D1·D2 의 것이다 — Human 이 언제든 뒤집는다.

### A.1 Material Seed 표 (§10.1)

| Material Seed | 세계 기원 | 자연 형태 | 관찰 가능한 성질 | 공급 유형 | 후속 사용 |
|---|---|---|---|---|---|
| `BIO_ORE` **생체 광석** | 거대 수목이 뿌리로 빨아올리는 그 광물 (Concept §4 · 생체 광석 지대의 그것 — D1) | ① 광맥의 노두(원석) ② 뿌리혹의 축적체 ③ 물길이 갈아 실어 온 알갱이 — **같은 것의 세 순도** | 살아 있는 것의 몸을 따라 옮겨 다니며 쌓인다 · 쌓인 자리를 붉게 물들인다(흙의 변색 · 거목의 붉은 눈) · 물에 갈리면 붉은빛을 잃는다 (D2) | MIGRATORY(노두) · CONDITIONAL_RENEWABLE(뿌리혹) · EVENT_SCARCE(퇴적) | **미정 — 후속 층** |
| `ORE_EATER_MOLT` **광식충 허물** | 생체 광석을 먹는 벌레(광식충)가 벗은 것 (D1) | 허물 · 조류가 떨어뜨린 잔해 | 붉은 결이 있되 광석보다 옅다 · 마르면 부서져 가루가 된다 · 나무 밑동 그늘에 모인다 (D2) | BASELINE_RENEWABLE | **미정 — 후속 층** |
| `GIANT_TREE_FUNGUS` **거목균** | 포식수의 사체에서 자라 거목을 키우는 균류 (Concept §4 · D1) | 사체 위 흰 균사 · 그것이 분해한 붉은 흙 | 포식수의 사체에서만 자란다 · 사체를 삭여 흙을 붉게 되돌린다(광석을 사슬 끝에서 처음으로 보낸다) · 그늘에서만 산다 (D2) | CONDITIONAL_RENEWABLE | **미정 — 후속 층** |

세 Seed 가 사슬의 **세 자리**(축적 · 소비 · 분해)에서 나온다. 종류를 늘린 것이 아니라 사슬을 옮겨 적은 것이다.

### A.2 Resource Source 표 (§10.2)

| Source | Region | Carrier | 공간 역할 | 출현 조건 | Trace | 채취 결과 | 회복 원인 |
|---|---|---|---|---|---|---|---|
| `MOLT_LITTER` 나무 밑동의 허물 | `FOREST_EDGE` | RESIDUE | **Baseline** | 없음 | 흩어진 껍질 조각 · 옅은 변색 | 무더기가 흩어지고 흔적이 옅어진다 | 탈피 주기 — 가장 안정된 공급 |
| `RUIN_SPOIL` 버려진 선광 더미 | `EXPLORER_RUIN` | RESIDUE | **Baseline** | 없음 | 헐린 더미 · 인공물 곁의 변색 | 더미가 헐린다 | 비와 바람이 더미를 씻어 새 조각이 드러난다 |
| `ORE_OUTCROP` 광맥의 노두 | `BIO_ORE_FIELD` | TERRAIN | **Risk** | 뿌리 곡선의 그 마디까지 축적이 왔을 것 | 짙은 변색 · 결정면의 빛 | 무너져 구덩이 — **그 칸을 못 지나간다** | 거목의 축적 — **다음 마디에** 선다 (MIGRATORY) |
| `ROOT_NODULE` 거목의 뿌리혹 | `RED_EYE_TREE` | PLANT | **Risk** | 분해된 흙이 살아 있을 것 (`NEST_FUNGUS` 의존) | 부푼 뿌리 · 가장 짙은 변색 | 터진 자국 · 그 가지의 다음 노두가 늦어진다 | 균류가 분해한 흙에서 다시 빨아올린다 |
| `NEST_FUNGUS` 사체 위 균사 | `PREDATOR_NEST` | FUNGUS | **By-product** | 사체의 분해 단계 | 균사의 색 · 사체의 삭는 모양 | 분해가 멎는다 → **거목 쪽 회복이 늦어진다** | 다음 사체의 분해 (살아 있는 포식은 3층) |
| `RIVER_SILT` 어귀의 퇴적 | `FOREST_DEEP` | WATER | **Conditional** | 물길이 불어난 때 (`FLOW_HEART_SILT`) | 어귀의 퇴적선 | 퇴적선이 지워진다 | 다음 흐름이 실어 온다 |
| `LAKE_SILT_BED` 호수 바닥의 침전 | `HEART_LAKE` | WATER | Risk (흐름의 출발) | 없음 | 물빛의 탁함 | 침전이 걷힌다 | 거목 내부에서 계속 가라앉는다 |

Carrier 유형 다섯 (RESIDUE · TERRAIN · PLANT · FUNGUS · WATER) — 한 유형에 편중되지 않는다 (검증 8.2).
Opportunity 역할 넷 전부 충족 (세 이상 필요 — M3).

### A.3 Opportunity Gradient (§10.3)

```text
경계부:      MOLT_LITTER (FOREST_EDGE · outer) · RUIN_SPOIL (EXPLORER_RUIN)
중간부:      흔적만 — soil-stain 이 짙어지는 FOREST_DEEP. 원천은 없고 방향이 있다
핵심부:      ORE_OUTCROP (BIO_ORE_FIELD) · ROOT_NODULE (RED_EYE_TREE) · LAKE_SILT_BED (HEART_LAKE · deep)
조건부 상태:  RIVER_SILT (FOREST_DEEP 어귀 — 물길이 불어난 때)
생태 부산물:  NEST_FUNGUS (PREDATOR_NEST)
세계 사건:    없음 — 이 Play 는 World Event Opportunity 를 두지 않는다 (선택적 · M3)
피난처:      WHITE_KING_DOMAIN — 얻은 것을 확인하고 다음 위험을 판단하는 자리 (§7 단계 9)
```

**모든 재료를 핵심부 한 지점에 몰아넣지 않는다** — 경계 둘 · 핵심 셋 · 조건 하나 · 부산물 하나.

### A.4 Resource Flow 표 (§10.4)

| Flow | 출발 Region/Source | 운반체·현상 | 조건 | 도착 Region | 도착 뒤 변화 | Trace |
|---|---|---|---|---|---|---|
| `FLOW_HEART_SILT` | `HEART_LAKE` / `LAKE_SILT_BED` | WATER — 물길 (Connector `HEART_RIVER`, 이미 그래프에 있다) | 물길이 불어난 때 | `FOREST_DEEP` (anchor `RIVER_MOUTH`) | 어귀에 `RIVER_SILT` 가 선다. 원석이 갈려 **알갱이**로 — 같은 Seed 의 다른 형태 | 어귀의 퇴적선 · 물빛 |

**Isolation Reason** — `WHITE_KING_DOMAIN` 에는 이 계통이 유입되지 않는다. 이유는 새로 짓지 않는다:
산맥과 강이 막기 때문이고, 그것이 **백왕령이 안전한 이유와 같은 조건**이다
([L2-World-Concept.md](../L2-World-Concept.md) W2 · RoomBecomesLand §5.3). 안전과 결핍이 한 원인이다.

### A.5 Downstream Handoff (§5.11)

```text
넘긴다   Material Seed 셋 · 각각의 자연 형태 · 공급 유형과 원천 위치 · 관찰 가능한 성질(D2)
넘기지 않는다   Recipe · 조합 · Item 효과 · 수치 · Class 요구 — unresolvedUses: true
받는 곳   로드맵 4층(자원과 물건) 이후. 이 Play 가 4층의 앞 절반을 미리 닫는다
         ([L2-World-Material.md](../L2-World-Material.md) §2.1)
```

### A.6 UNRESOLVED (§10.5)

```text
① Material Seed 의 고유한 세계적 성질   → 위임됨 · D2 가 내렸다
② 회복 원인의 시간 규모                → 위임됨 · D3 가 내렸다 (결정론 상수 — C013 이 헤더에 고정)
③ 채취 단위                          → 위임됨 · D4 가 내렸다 (C012 가 헤더에 고정)
④ 살아 있는 운반체(곤충 · 조류)의 이동   → 3층. 2층은 그것이 남긴 자리만 세운다 — 남는 UNRESOLVED 는 이것 하나다
⑤ Finite Source 를 반복 성장에 쓸 것인가 → 이 Play 는 쓰지 않는다 (확정 1). 후속 층이 뒤집을 수 있다
```

---

## 확정 사항 (Human 승인)

```text
 1. 이 Play 는 FINITE_WORLD_STATE 를 쓰지 않는다. 이 숲의 일곱 Source 는 전부 기본 공급이고,
    S7 이 기본 성장 공급에 유한 원천을 금지했다. 유한을 쓸 자리는 뒤의 Region 이 정한다.
 2. 생물은 세우지 않는다. 곤충 · 조류 · 포식자는 **남긴 것**(허물 · 잔해 · 사체)으로만 세계에 있다.
    살아 움직이는 것은 3층이고, 그때 여기 선 Source 가 그 생물에 그대로 매달린다
    (L2-World-Material §2.2). Carrier 유형 CREATURE 는 이 Play 에서 쓰이지 않는다.
 3. 채취 행위는 기존 채광 하나다. 뜯다 · 긁다 · 건지다를 따로 만들지 않는다 —
    Source 종류마다 다른 것은 문구와 결과이지 행위가 아니다.
 4. **탐험대 폐허의 선광 더미**(`RUIN_SPOIL`)는 정식 세계 사실이다 — 앞서 온 탐험대가 캐다 버리고
    간 것. 경계부에서 재료 계통을 미리 읽게 하는 자리이자, 먼저 온 사람이 있었다는 흔적이다.
 5. **백왕령의 Isolation Reason** 은 정식이다 — 숲의 계통은 백왕령에 들어오지 않는다.
    산맥과 강이 막기 때문이고, 그것이 백왕령이 안전한 이유와 같은 조건이다 (Concept W2).
    안전과 결핍이 한 원인이다.
 6. 자리와 번호 — 이 Play 는 2층 **넷째**이고 RuleBoundRoom(C008~C010) 뒤에 선다.
    Cycle 은 **C011~C014**. Region State 와 세계 과정이 먼저 서야 재료가 생애를 가진다.
 7. 대상 Region 은 미지 M1 거대 악마의 숲이고, World Cause 는 Concept §4 의 생태 사슬 그대로다.
    Source 일곱 · Carrier 유형 다섯 · Opportunity 역할 넷 (부록 A.2).
 8. 재료 아이콘·미니맵 표식을 만들지 않는다 (§12.4). 원천은 흔적으로 찾는다.
 9. 노두는 같은 자리에 다시 나지 않는다 — 뿌리 곡선의 다음 마디에 선다 (MIGRATORY · M8).
10. Resource Flow 는 하나다 — HEART_LAKE → 물길(HEART_RIVER) → FOREST_DEEP 의 어귀.
    이미 그래프에 있는 Connector 를 쓴다.
11. 빈칸 넷(이름 · 성질 · 시간 규모 · 채취 단위)은 Human 이 **"컨셉에 맞게 알아서"** 로 위임했다.
    L2-World-Region §5 와 같은 방식으로 이 문서가 내렸고 Human 이 언제든 뒤집는다 (아래 위임된 결정).
    Cycle 은 이것으로 멈추지 않는다.
```

## 위임된 결정 (Human "알아서" → 이 문서가 내렸다)

Human 이 "컨셉에 맞게 알아서 정하면 된다" 로 위임한 넷이다. [L2-World-Region.md](../L2-World-Region.md) §5 와
같은 자리다 — 이 문서가 내렸고, Human 이 언제든 뒤집는다. 기준은 셋: **기존 문서에 있는 것에서 나온다 ·
이름은 그것이 무엇인지에서 나온다(Region §5.5 ③) · 쓰임(효과 · Recipe)은 정하지 않는다(S10).**

### D1. 재료의 이름 — 사슬의 세 자리에서

| id | 이름 | 근거 |
|---|---|---|
| `BIO_ORE` | **생체 광석** | 새로 짓지 않았다. `BIO_ORE_FIELD 생체 광석 지대`(WE §3 · Region §5.1 정식)의 그 광석이 Concept §4 의 "특정 광물" 이다 — 숲의 광석 지대에 있는 광물이 거목이 빨아올리는 광물과 다른 것이라면 그 지대가 거기 있을 이유가 없다. "생체" 라는 이름 자체가 살아 있는 것을 따라 옮겨 다닌다는 성질(D2)을 말한다 |
| `ORE_EATER_MOLT` | **광식충 허물** | 광물을 먹는 곤충(Concept §4)은 이름이 없었다 — 그것이 무엇인지에서 짓는다: **광식충**(鑛食蟲 · 광석을 먹는 벌레). 재료는 그 벌레가 아니라 벗은 것이므로 광식충 허물 |
| `GIANT_TREE_FUNGUS` | **거목균** | 포식자 사체에서 나 거목을 키우는 균류(Concept §4) — 그것이 하는 일에서 짓는다. 사체의 주인은 이미 이름이 있다: **포식수**(`PREDATOR_NEST 포식수 둥지` · 정식) |

곤충·조류·포식자 **자체**의 이름은 3층이 생물을 세울 때 그 Play 가 짓는다 — 광식충과 포식수는 그때 그대로
쓸 수 있고, 조류는 아직 이름이 없어도 이 Play 에 필요하지 않다 (남기는 것이 광식충 잔해이므로).

### D2. 관찰 가능한 성질 — 사슬이 곧 성질이다

성질은 새로 발명하지 않고 **Concept §4 의 사슬이 이미 말하는 것**을 관찰 가능한 문장으로 옮겼다.
효과·수치·Recipe 는 없다 — 후속 층이 이것을 읽고 쓰임을 정한다.

```text
생체 광석
  ① 살아 있는 것의 몸을 따라 옮겨 다니며 쌓인다 — 뿌리 → 광식충 → 조류 → 포식수 → 거목균 → 흙 → 뿌리.
     사슬 그 자체가 이 성질의 증거다 (Concept §4)
  ② 쌓인 자리를 붉게 물들인다 — 흙의 변색이 그것이고, **붉은 눈의 거목**의 붉은 눈이 가장 많이 쌓인 자리다
     (정식 이름 둘을 잇는 한 줄 — 이것이 이 문서가 새로 놓은 유일한 세계 사실이다)
  ③ 물에 갈리면 붉은빛을 잃는다 — 어귀의 알갱이는 붉지 않다. 순도의 차이가 눈에 보이는 이유
광식충 허물
  ① 붉은 결이 있되 광석보다 옅다 (② 를 먹은 것의 흔적)
  ② 마르면 부서져 가루가 된다 — 오래 둔 허물은 재료가 아니다 (회복 주기 D3 와 맞물린다)
  ③ 나무 밑동 그늘에 모인다 — 광식충이 뿌리 곁에서 먹기 때문 (Baseline 자리의 이유)
거목균
  ① 포식수의 사체에서만 자란다
  ② 사체를 삭여 흙을 붉게 되돌린다 — 광석을 사슬의 끝에서 처음으로 보낸다. 이것이 균류가 거목을 키운다는 말의 뜻이다
  ③ 그늘에서만 산다 — 둥지 아래. 캐서 밖에 두면 시든다
```

### D3. 회복의 시간 규모 — 세계 초 (결정론 상수 · C013 헤더 고정)

세계의 시계는 초 단위 dt 로 돈다 (`engine/world-kernel/clock.ts`). 기준 하나에서 나머지를 정했다 —
**관찰자가 숲 가장자리에서 거목까지 갔다 오는 데 약 60초** (방 여섯 · 40×40 · 걷는 속도 기준).

| Source | 과정 | 한 바퀴 | 이유 |
|---|---|---|---|
| `MOLT_LITTER` | 광식충의 탈피 | **60 s** | 가장 빠르다 — Baseline. 다녀오면 다시 있다 (후발 몫이 항상 남는다) |
| `RUIN_SPOIL` | 더미의 침식 | **90 s** | Baseline 둘째 |
| `NEST_FUNGUS` | 사체의 분해 단계 | **120 s** | 부산물. 균사가 다시 피는 데 두 바퀴 |
| `ROOT_NODULE` · `ORE_OUTCROP` | 거목의 축적 (뿌리 곡선의 다음 마디) | **180 s** | 핵심부. 세 바퀴 — 회복 흔적을 읽고 **기다릴 이유**가 생기는 길이. 거목균이 없으면 진행 0 |
| `RIVER_SILT` ← `FLOW_HEART_SILT` | 물길이 불어남 | **240 s 주기 · 30 s 활성** | Conditional. 가장 드물고, 활성 구간이 짧아 "그때 가야 한다" |

숫자는 폴리싱 값이다 — 헤더 상수 하나씩이고, 바꾸는 것은 Cycle 이 아니다. 비율(1 : 1.5 : 2 : 3 : 4)이 설계다:
**얕은 것은 빨리, 깊은 것은 느리게, 조건부는 드물게.**

### D4. 채취 단위 — Source 하나에서 몇 번 (C012 헤더 고정)

| Source | 횟수 | 이유 |
|---|---|---|
| `MOLT_LITTER` | 3 | Baseline — 넉넉하다 |
| `RUIN_SPOIL` | 2 | 더미는 남이 캐다 버린 것 — 많지 않다 |
| `ORE_OUTCROP` | 3 | Risk — 한 번 닿으면 값어치가 있어야 한다 |
| `ROOT_NODULE` | 1 | 뿌리혹 하나 = 한 번. 캐면 터진다 |
| `NEST_FUNGUS` | **1** | 한 번에 다 뜯긴다 — 그래서 사슬이 끊긴다 (§5.5 의 장면은 이 1 에서 나온다) |
| `RIVER_SILT` | 2 | 한 번 실려 온 양 |
| `LAKE_SILT_BED` | 2 | 흐름의 출발이지만 닿으면 캘 수 있다 (추락으로만 닿는다) |

지금 `Deposit.resourceAmount` 의 기본값 5 는 발판의 값이다 — 이 표가 그것을 대체한다.
