# RoomBearsLife — 방이 생명을 낳는다, 허물의 주인

상태: **주입됨** (Human 주입 1회 + 검토 반영 — "모두 수정해". 확정 사항은 위임된 결정이다). Cycle Breakdown 의 체크박스만 앞으로 갱신된다.
계약은 [L2-World-Life.md](../L2-World-Life.md).
선행: [RoomBearsMaterial.md](RoomBearsMaterial.md)(원천 · 흔적 · 채취 결과) · [RoomNeverSame.md](RoomNeverSame.md)(철 · 소란) ·
[RoomOfAnotherKind.md](RoomOfAnotherKind.md)(다른 갈래) — 이 Play 는 그 셋 위에 **탄생과 개체군**을 얹는다. 새 축을 요구하지 않는다.

## 0. Row

**기반 층 2 — 세계 절반 ②-부속 셋째(생명의 성립과 탄생)의 증명 Play.** 2층 여섯째다.
이 Play 가 놓는 것: *숲의 재료 하나에는 주인이 있다. 그 주인은 처음엔 뿌리가 낳았고 다음부터는 스스로 잇는다.
태어남은 세계의 무언가를 먹고, 태어난 것은 다른 것을 부르고 먹히고 남긴다 — 숲은 관찰자 없이 한 바퀴 돈다.*

놓는 미지: **M6 붉은 알집** (구조) — 미지 M1 거대 악마의 숲을 M3(재료 계통) 다음으로 한 번 더 깊게 한다.

미증명 ④(발견된 뒤에도 세계가 살아 움직이는가)의 **2층 몫 둘째**다. Time 이 "바깥에서 세계를 바꾸는 힘"(철)을
주었다면, 이 Play 는 "발견된 방 **안에서** 계속 새로 생기고 서로를 바꾸는 것"을 준다 — 그리고 그것이 스폰이 아님을 보인다 (F8).
W9(플레이어 없이 돈다)가 **생태에서** 처음 증명된다 (F14).

## 1. References

- [L2-World-Life.md](../L2-World-Life.md) — F1~F15 · §3.2 데이터 계약 · 검사 ㉗~㉝ · §2.1 분할선
- [L2-World-Material.md](../L2-World-Material.md) S4 흔적 · S6 생애 · S7 공급 · S8 채취 결과 · S9 흐름 · §2.2(이 Play 가 옮긴다)
- [RoomBearsMaterial.md](RoomBearsMaterial.md) 부록 A.1 Seed 셋 · A.2 Source 일곱 — 이 Play 가 쓰는 자리는 전부 여기 있다
- [L2-World-Concept.md](../L2-World-Concept.md) §4 숲의 생태 사슬 (거목 → 광물 → 곤충 → 조류 → 포식자 → 균류 → 거목) — 이 Play 가 값으로 한 바퀴 돌린다
- [L2-World-Time.md](../L2-World-Time.md) 2.3 철 · 2.5 소란 · 2.6 경로 — 탄생 조건이 타는 주기 · 개체군이 만드는 presence
- [RoomOfAnotherKind.md](RoomOfAnotherKind.md) 확정 2·4 — 협곡의 원인(열을 먹는 결정). 이 Play 의 대조군

## 2. Play Goal

**관찰자가 밑동의 허물에 주인이 없다는 것을 알아채고, 거목의 뿌리에서 붉은 알집이 맺히는 조건(균사 · 축적 · 비)을
흔적만으로 뒤쫓아 부화를 목격하고, 그 부화가 뿌리혹의 축적과 균사를 먹는 것을 보고, 그 뒤 밑동의 허물이 다시
쌓이는 것과 태어난 것이 스스로 다음을 잇는 것을 확인하고, 조건 하나를 캐어 다음 탄생을 늦춰 보고,
곤충이 조류를 부르고 조류가 포식수를 부르고 포식수가 사체를 남겨 균류가 되는 한 바퀴를 관찰자 없이 도는 채로 본다.**

완료 확인 일곱:

```text
① 화면에 탄생 표식(아이콘 · 타이머 · 좌표 안내)이 없는 상태에서, 흔적 넷(부푼 균사 · 붉은 빛 · 줄어드는 광물 ·
   땅의 진동)만으로 알집에 닿는다
② 부화 전후가 세계에서 구분된다 — 뿌리혹의 축적 감소 · 균사의 분해 멎음 · 빈 껍질 trace · 알집 phase 전이 ·
   개체군 값 상승. 다섯이 같은 tick 에 함께 일어난다
③ 개체군이 오른 뒤 밑동의 허물(`MOLT_LITTER`) 회복이 실제로 빨라진다 — 검사 ㉛ 이 **실패에서 통과로 바뀐다**
④ 개체군 > 0 이면 알집 없이도 뿌리의 알(계승형)에서 +1 이 난다 — 최초는 결속, 이후는 계승 (F3 겹침)
⑤ 둥지의 균사를 캐면 다음 결속이 늦어지고, 두면 되돌아온다. 개체군이 0 이 되어도 조건이 돌아오면 다시 난다 (F8 · F15)
⑥ 관찰자가 없는 채로 세계 시계 두 바퀴 — 곤충 ↑ → 조류 ↑ → 포식수 ↑ → 사체(RESIDUE) → 균사 ↑ → 곤충 ↓ 가 값으로
   한 바퀴 돌고, 그 사이 소란과 presence 가 바뀐 것이 관찰된다 (F14 · W9)
⑦ world:observe --report 가 ㉗~㉝ 을 보고하고, 협곡에 이 탄생지가 없는 이유가 세계에 적혀 있다 (F6)
```

## 3. Experience Intent

```text
Start   허물은 밑동에 그냥 있는 것이다. 세계는 재료를 놓아둔다 — 캐면 언젠가 다시 찬다.
End     허물에는 주인이 있다. 주인은 처음엔 뿌리가 낳았고 지금은 스스로 잇는다. 태어나면서 뿌리의 것을 먹었고,
        태어난 것이 새를 부르고 새가 포식수를 부르고 포식수가 남긴 것에서 균류가 나 다시 뿌리로 간다.
        내가 캔 균사가 그 바퀴 하나를 늦춘다. 세계는 재료를 놓아두지 않는다 — 만들고, 돌린다. 그리고 나는 그 바퀴 안에 있다.
```

## 4. Breath

```text
익숙함 → 어긋남 → 뒤쫓음 → 기다림 → 목격 → 잇댐 → 끊어 봄 → 돌아감
```

- **익숙함** — 밑동의 허물을 캔다. 늘 하던 것.
- **어긋남** — 허물은 벗은 것이다. 그런데 벗은 것을 본 적이 없다. *무엇이 벗었는가.*
- **뒤쫓음** — 균사가 둥지에서 뿌리 쪽으로 뻗어 있다. 뿌리 둘레의 붉은 흙이 **옅어지고 있다** — 재료가 어디론가 간다.
- **기다림** — 뿌리에 붉은 것이 맺혔다. 땅이 낮게 떨린다. 아직 아니다.
- **목격** — 맺힌 것이 터진다. 같은 순간 뿌리혹이 여윈다. 균사가 삭기를 멈춘다. 세계가 무언가를 **지불했다**.
- **잇댐** — 며칠 뒤 밑동에 허물이 전보다 빨리 쌓인다. 뿌리 마디에 작은 붉은 점들 — 이번엔 알집 없이. *아, 저것이 벗은 것이고, 이제 저희끼리 잇는다.*
- **끊어 봄** — 둥지의 균사를 캐 본다. 다음 붉은 것이 오지 않는다. 두면 다시 온다.
- **돌아감** — 며칠 자리를 비운다. 돌아오니 새가 왔고, 포식수의 자국이 있고, 새 사체 위에 균사가 있다. 내가 없어도 돌았다.

## 5. Play Structure

### 5.1 어긋남 — 허물에 주인이 없다

```text
존재   FOREST_EDGE 의 `MOLT_LITTER`(나무 밑동의 허물) — Material 이 이미 세운 Baseline Source
상태   그 회복 원인이 "탈피 주기" 라고만 적혀 있다 — 벗은 것이 세계에 없다 (Life §2.1 이 지목한 구멍)
관찰   허물 무더기 · 흩어진 껍질 조각. 캐면 옅어지고 시간이 지나면 다시 찬다
추론   "이건 벗은 것이다. 무언가 살아 있고, 그것이 어딘가에서 온다"
반응   균사와 붉은 흙을 따라 안쪽으로 간다
도구   검사 ㉛ 이 여기서 **실패를 보고한다** — 살아 있는 것을 전제한 회복 원인인데 lifeFormation 이 없다.
       C022 는 그 실패를 재현하는 것으로 시작한다
```

### 5.2 뒤쫓음 · 기다림 — 전조 (traces.before)

Cause 는 Concept §4 의 사슬을 거꾸로 읽은 것이다: **균사가 뿌리까지 퍼지고, 뿌리가 빨아올린 광물이 그 안에 쌓이고,
비가 그 농도를 넘긴다 → 균사가 광물과 양분을 둘러싸 경계를 만든다.** 위험을 만든 것이 곧 재료라는 문장(Concept §6)의
생명판이다 — 재료를 만든 것이 곧 생명이다.

```text
존재   `ROOT_CLUTCH` **붉은 알집** — RED_EYE_TREE 의 뿌리 곡선 위 point (layer: resource · 탄생지)
상태   lifeFormation `CLUTCH_BINDING` (mode: ENVIRONMENTAL_BINDING · population: oreEater)
         source        BIO_ORE (뿌리혹의 축적) · GIANT_TREE_FUNGUS (둥지에서 뻗은 균사) · 비 (Region State)
         condition     regionRule RULE_FOREST_CLUTCH · requiredState [ nodule.phase >= 축적 · fungus 살아 있음 · rain · oreEater == 0 ]
         transition    DORMANT → BINDING → BORN → SPENT
         consumes      ROOT_NODULE 의 축적 · NEST_FUNGUS 의 분해 진행
         ecologicalRole 광식충 개체군을 **처음** 세운다 → 허물 공급의 원인이 된다
관찰   traces.before 넷 — ① 둥지에서 뿌리로 뻗은 **부푼 균사** ② 뿌리 마디의 **붉은 빛**
       ③ 뿌리 둘레 붉은 흙이 **옅어진다**(재료가 알집으로 간다 — 흔적이 방향을 가진다 · S4)
       ④ BINDING 동안 그 칸의 **땅이 떤다**(소란과 다른 값 — 탄생지 고유)
추론   "여기서 무언가 만들어지고 있고, 재료는 이 나무의 것이다. 비가 와야 넘는다"
반응   기다린다 · 조건을 센다 · 물러난다
```

**표식을 두지 않는다** — 알집은 흔적으로만 찾는다 (Material 의 원칙 그대로). `oreEater == 0` 이 조건에 있는 것은
결속이 **최초에만** 일어나기 때문이다 — 이미 개체군이 있으면 5.4 의 계승이 잇는다.

### 5.3 목격 — 결속과 소비 (F1 · F4)

```text
존재   BORN 으로의 전이 = 세계 상태 전이 하나 (개체가 스폰되는 것이 아니다 — F9 의 첫 깊이)
효과   ① 알집 phase DORMANT/BINDING → BORN → SPENT
       ② `ROOT_NODULE` 의 축적이 준다 — 그 가지의 다음 노두가 늦어진다 (Material 이 이미 만든 의존을 그대로 쓴다)
       ③ `NEST_FUNGUS` 의 분해 진행이 멎는다
       ④ Region State 의 **개체군 값** `oreEater` 가 오른다
       ⑤ traces.after — 빈 껍질(point) · 그 둘레의 붉은 가루
       ⑥ Region 의 소란(Time 2.5)이 조금 오른다 — 떼가 돈다 (presence area `ORE_EATER_SWARM`)
관찰   터진 알집 · 여윈 뿌리혹 · 멎은 균사 · 빈 껍질 · 넓어진 presence
추론   "태어나는 데 세계가 값을 치렀다. 공짜가 아니다" (F4)
반응   빈 껍질을 줍는다 (By-product) · 여윈 뿌리혹을 캘지 망설인다 — 캐면 다음 탄생이 더 늦다
```

살아 있는 개체는 **걷지 않는다** — 이 층에서 광식충은 개체군 값과 presence 다 (F9 · F10). 걷는 것은 3층이다.

### 5.4 잇댐 — 개체군이 공급을 만들고, 스스로 잇는다 (F8 · F3 겹침)

```text
존재   `MOLT_LITTER` 의 회복 원인이 값을 가진다 — 개체군 `oreEater` (지금까지 "탈피 주기" 라는 말뿐이었다)
       그리고 둘째 lifeFormation `ROOT_EGGS` **뿌리의 알** (mode: INHERITED · population: oreEater)
         source        oreEater (부모 개체군) · BIO_ORE (뿌리혹의 축적)
         condition     requiredState [ oreEater >= 1 · nodule.phase >= 축적 ]   — 균사도 비도 필요 없다
         consumes      ROOT_NODULE 의 축적 (결속보다 적게)
         traces        before 뿌리 마디의 작은 붉은 점들 / after 작은 껍질
상태   개체군이 높으면 허물이 빨리 쌓이고, 0 이면 쌓이지 않는다. 개체군이 있으면 알집 없이 알에서 잇는다
관찰   같은 자리를 두 번 오면 무더기의 크기가 다르다 — 그 차이의 원인이 다른 방(뿌리)에 있다.
       뿌리에 알집이 아니라 **작은 붉은 점**이 있다 — 결속의 큰 흔적과 계승의 작은 흔적이 눈으로 갈린다
추론   "밑동의 재료는 뿌리에서 시작한다. 처음은 나무가 낳았고 지금은 저희끼리 잇는다. 숲의 한쪽을 건드리면 다른 쪽이 마른다"
반응   허물이 필요하면 뿌리를 지킨다 · 광물이 필요하면 알을 늦춘다 — 처음으로 **서로 다른 재료가 경쟁한다**
도구   검사 ㉛ 이 통과로 바뀐다 (완료 확인 ③)
```

이것이 이 Play 의 심장이다 — **Respawn Timer 가 세계 안의 원인으로 갈아 끼워진다** (F8 · S7). 그리고 F7 의 깊이
구배가 지켜진다 — wild 의 생물은 **부모가 있다**. 부모 없는 결속은 그 부모를 처음 세우는 순간 한 번뿐이다.

### 5.5 끊어 봄 — 조건을 캐면 늦어진다 · 멸종은 없다 (2층의 유일한 개입 · F15)

```text
존재   `NEST_FUNGUS`(둥지의 균사) — 이미 캘 수 있는 Source. `ROOT_NODULE` 도 캘 수 있다
효과   균사를 캐면 → 뿌리까지 못 간다 → 결속 조건이 안 찬다 (최초 탄생이 늦어진다)
       뿌리혹을 캐면 → 축적이 없다 → 알(계승)도 멈춘다 → 개체군이 한 철에 -1 씩 줄어 0 이 된다 → 허물이 마른다
       두면 → 다음 사체의 분해에서 균사가 다시 뻗고, 뿌리가 다시 빨아올려 → 결속 조건이 다시 차 → 개체군이 다시 선다
관찰   뿌리로 뻗던 균사가 없다 · 뿌리 마디에 빛이 안 온다 · 개체군이 서서히 준다 · 허물이 마른다 · 그리고 되돌아온다
추론   "탄생은 조건이고, 조건은 내가 만질 수 있다. 그러나 끊어도 사라지지는 않는다 — 세계가 다시 만든다"
반응   되돌린다
```

원문 §7 이 이후 층으로 넘긴 "탄생 과정에 개입하는 구체적 Action" 은 여기 없다. **2층의 개입은 채취뿐**이고,
그것으로 충분히 인과가 보인다. **멸종은 없다** (F15) — 백 명이 뿌리혹을 캐도 광식충은 사라지지 않고 조건이 돌아오면
다시 결속된다. 이것이 MMO 의 약속이다 (S7 의 생명판).

### 5.6 돌아감 — 숲이 관찰자 없이 한 바퀴 돈다 (F14 · W9)

Concept §4 의 사슬을 **값으로** 돌린다. 개체는 없다 — 개체군 셋과 관계 다섯이 있고, 그것이 Material 의 Source 에 닿는다.

```text
개체군   oreEater 광식충 (0~4) · bigBird 대형 조류 (0~2) · predator 포식수 (0~1)
관계     oreEater  ─CALLS─▶ bigBird     곤충이 많으면 새가 온다 (이웃 Region 에서 — via Connector · Flow 의 anchor)
         bigBird   ─EATS──▶ oreEater    새가 있으면 곤충이 준다
         bigBird   ─CALLS─▶ predator    새가 있으면 포식수가 온다
         predator  ─EATS──▶ bigBird     포식수가 있으면 새가 준다
         predator  ─LEAVES▶ NEST_FUNGUS 포식수가 있으면 둥지에 사체가 남는다 → 균사의 원천 (Material 이 "다음 사체" 라고만 적었던 자리)
         (균사 → 뿌리 → 결속/알 → oreEater 는 5.2~5.4 가 이미 이었다)
상태     값이 오르내린다 — 헤더 상수 · 세계 시계에 매인다. 개체군마다 presence area 가 값에 따라 넓어진다 (Time 2.6 과 같은 layer)
관찰     새의 presence 가 숲 가장자리로 든다 · 포식수의 경로가 둥지에 온다 · 둥지에 새 사체 · 소란이 오르내린다 ·
         허물이 줄었다 늘었다 한다. 관찰자가 방을 비운 동안에도 그렇다 (관찰자 둘의 같은 tick 관찰이 같다 — R4)
추론     "숲은 나 없이도 돈다. 내가 하는 건 그 바퀴를 조금 밀거나 늦추는 것이다"
반응     없음 — 관찰로 증명된다. 개체를 사냥해 값을 내리는 것은 5층
```

이것이 Material 이 "살아 있는 포식은 3층" 이라 비워 둔 자리다 — **값으로는 2층에서 돈다.** 3층은 이 값에 몸을 붙인다.

### 5.7 두 번째·세 번째 mode 와 대조 — 사체가 균류가 된다 · 협곡에는 없다 (F3 · F6)

```text
존재   `NEST_FUNGUS` 자신의 lifeFormation `CARCASS_TO_FUNGUS` — mode: TRANSFORMATION.
       포식수의 사체가 Region Rule 아래 균류로 **바뀐다** (Concept §4 "포식자의 사체에서 특수 균류 발생" 그대로)
         source     포식수의 사체(RESIDUE — 5.6 의 LEAVES 가 만든다) · 그늘 · 습기
         consumes   사체의 남은 부피
         traces     before 삭는 모양 · 냄새의 자리 / after 붉게 되돌아온 흙
추론   "탄생은 한 가지 방식이 아니다. 어떤 것은 맺히고, 어떤 것은 잇고, 어떤 것은 바뀐다"
대조   협곡(FROST_CANYON)에는 이 셋 중 어느 탄생지도 없다 — **열을 먹는 결정**이 있어 결속에 쓸 열이 남지 않는다
       (Frost 확정 2). 없다는 것 자체가 World Cause 로 적힌다 (Material S9 의 Isolation Reason 을 생명에 그대로)
관찰   world:observe --report 의 ㉚ 분포 — 숲은 결속 하나 · 계승 하나 · 변성 하나, 협곡은 0 과 그 사유. ㉝ 고립 개체군 없음
```

네 mode 중 셋이 이 Play 에서 선다. 분화형 `SEPARATION` 만 남는다 — 문법에는 있고 세계에는 아직 없다 (확정 8 · Human 질문 1).

## 6. Required Capability

```text
Existing   Rooms · Land · Rule(Region State · 세계 과정) · Material(W17~W24 — Source · phase · 채취 결과 · 의존 · Flow) ·
           Time(W25~W32 — 시계 · 철 · 소란 · presence) · Frost(W33~W37). 채광 규칙과 투영은 그대로 쓴다
Required — 세계
  W38  LifeFormation 데이터 계약 — RegionSpec.ecology.lifeFormation (mode · source · condition · transition ·
       consumes · traces · ecologicalRole · population). 값이지 규칙이 아니다
  W39  탄생지 State — Region State 의 lifeSites[id] = { phase · progress }. 스냅샷에 실린다.
       phase DORMANT → BINDING → BORN → SPENT (Material 의 Source phase 와 같은 기제)
  W40  결속 규칙 — requiredState 가 다 차면 전이한다. 규칙은 어떤 생명도 이름으로 알지 못한다 (R13).
       INHERITED 는 source 에 부모 개체군이 있는 같은 규칙이다 — mode 마다 규칙을 따로 두지 않는다
  W41  탄생의 소비 — 전이가 다른 Source 의 phase/진행을 낮춘다 (Material W20 의 의존을 반대 방향으로 쓴다)
  W42  개체군 값 — Region State 의 populations[id] = { value · trend }. 오르는 원인은 탄생 · CALLS, 내리는 원인은
       조건 결핍 · EATS. 이 값이 Source 의 회복 속도를 좌우한다 (F8). **개체는 없다** — 값과 presence area 뿐 (F9 · F10)
  W43  비 — Region State 의 조건 하나. 철(Time)에 매인다. 날씨 체계가 아니라 **이 Region 의 상태값**이다 (Time §5)
  W44  개체군 관계 — RegionSpec.ecology.links (EATS · CALLS · LEAVES) 의 평가. 세계 시계에 매인 값의 오르내림.
       Region 을 넘는 CALLS 는 Resource Flow 와 같은 자리(Connector · anchor). LEAVES 는 RESIDUE Source 를 만든다 (F14)
  W45  멸종 없음 — 개체군 0 은 종점이 아니다. 조건이 돌아오면 결속이 다시 선다 (F15). FINITE 생명은 이 Region 에 없다
Required — 표현
  V19  탄생지 표식 — 알집 종류 × phase → 외형 (DORMANT · BINDING · SPENT 가 눈으로 갈린다) · 빈 껍질 · 뿌리의 작은 붉은 점(계승)
  V20  전조 흔적 — 부푼 균사(curve) · 뿌리의 붉은 빛(point) · 옅어지는 흙(area 세기) · 떨림(BINDING 동안)
  V21  개체군의 자리 — presence area 셋(떼 · 새 · 포식수의 경로)이 값에 따라 넓어진다. 개체 그림은 없다
  V22  문구 — clutch-binding · clutch-spent · eggs-laid · fungus-severed · population-low · birds-arrived · predator-passed
Required — 기구
  E17  검사 ㉗~㉝ — 참조 무결성 다섯(㉗ ㉘ ㉙ ㉛ ㉜) + 분포 요약 둘(㉚ ㉝). ㉛ 은 Material 의 회복 원인 표를 읽어야 한다
       (Source 의 recoveryCause 가 살아 있는 것을 전제하는데 그 lifeFormation 이 없는가)
  E18  무관찰 실주행 — 관찰자 0 인 채로 세계 시계 N 바퀴를 돌리고 Region State 의 궤적을 기록하는 개발 명령
       (Time 의 "개발 명령 표면으로 부를 수 있어야 한다" 와 같은 자리). 완료 확인 ⑥ 의 증거다
```

## 7. Cycle Breakdown

```text
[ ] C022 — 허물의 주인: LifeFormation 데이터 계약 + 탄생지 State(phase 넷) + 결속 조건(균사 · 축적 · 비 · 개체군 0) +
           전조 흔적 넷 + 검사 ㉗~㉝(㉛ 은 먼저 실패를 보고한다). 아직 태어나지는 않는다
[ ] C023 — 태어남은 소비다: DORMANT → BORN 전이 + 소비 넷(뿌리혹 축적 · 균사 분해 · 알집 phase · presence) +
           traces.after(빈 껍질) + 개체군 값 + 뿌리의 알(계승형 — 개체군이 있으면 알집 없이 잇는다) + 투영.
           부화 전후 · 결속과 계승이 화면에서 갈린다
[ ] C024 — 스폰이 아니라 회복이다: 개체군이 MOLT_LITTER 회복을 좌우(㉛ 통과) + 균사·뿌리혹을 캐면 늦어지고 0 이 되고
           두면 되돌아온다(멸종 없음) + 사체 → 균류 변성형 + 협곡에 탄생지가 없는 사유 + ㉚ 분포 보고
[ ] C025 — 숲이 스스로 돈다: 개체군 셋(광식충 · 대형 조류 · 포식수) + 관계 다섯(CALLS · EATS · LEAVES) + Region 을 넘는
           CALLS(새가 이웃에서 온다 — Flow 의 anchor) + LEAVES 가 NEST_FUNGUS 의 사체를 만든다 + presence 셋 +
           무관찰 실주행 명령으로 두 바퀴 궤적 + ㉜ ㉝ 보고
```

---

## 확정 사항 (위임된 결정 — 전부 제안값이고 Human 이 언제든 뒤집는다)

```text
1. 붉은 알집 `ROOT_CLUTCH` — 거목의 뿌리 마디에 균사가 광물과 양분을 둘러싸 맺는 것. 미지 M6 의 이름이다.
   Region §5.5 의 위임 규칙(그것이 무엇인지에서 짓는다)을 따랐다
2. 광식충은 두 방식을 겹쳐 쓴다 — **최초는 환경 결속(알집), 이후는 계승(뿌리의 알).** 결속은 개체군이 0 일 때만 일어나고,
   개체군이 있으면 알집 없이 알에서 잇는다. F7 의 깊이 구배(wild 의 생물은 부모가 있다)를 지키면서도 "허물의 주인이
   어디서 왔는가" 에 답한다. 이것이 이 Play 가 놓는 유일한 큰 세계 사실이다
3. 탄생의 재료 셋 — 뿌리혹의 축적(BIO_ORE) · 둥지에서 뻗은 균사(GIANT_TREE_FUNGUS) · 비. 원문 §5 그대로이고,
   앞 둘은 Material 부록 A.2 에 이미 있는 Source 다. 새 Source 는 알집 하나뿐이다 (알은 알집의 작은 형태 — 같은 point)
4. 비 — 날씨 체계를 만들지 않는다 (Time §5 의 결정을 지킨다). Region State 의 값 하나이고 철에 매인다 —
   스밈에 잦고 긴 밤에 없다
5. 시간 규모 (세계 초 · Material D3 과 같은 규칙) — 결속 BINDING 60 s · 부화 후 알집 SPENT 유지 120 s ·
   조건이 다시 차기까지 균사 재생 180 s · 알(계승) 한 번에 90 s. 결정론 상수이므로 C022 가 헤더에 고정한다
6. 개체군 눈금 — oreEater 0~4 · bigBird 0~2 · predator 0~1. 탄생 1 회 +1 · 조건 결핍이 한 철 이어지면 -1.
   MOLT_LITTER 회복 배율은 oreEater 0 에서 정지 · 4 에서 두 배. 눈금이 작은 것은 값이지 개체가 아니기 때문이다 (F9)
7. 채취 단위 — 빈 껍질 1 · 작은 껍질 1 (By-product · Material D4 와 같은 규칙)
8. 분화형 SEPARATION 은 이 Play 가 쓰지 않는다. 네 mode 중 셋(결속 · 계승 · 변성)이 이 숲에 서고, 분화형은 그것을
   요구하는 행(거대 수목 · 걷는 숲)이 처음 쓴다 — Human 질문 1
9. 관계 상수 (헤더) — CALLS: from 이 상한의 절반 이상이면 한 철에 to +1 (Region 을 넘는 것은 이웃의 값에서 옮겨 온다).
   EATS: from 이 1 이상이면 한 철에 to -1. LEAVES: predator 가 1 이면 한 철에 둥지 사체 하나 (NEST_FUNGUS 의 원천).
   합쳐서 관찰자 없이 두 바퀴 안에 곤충 ↑ → 새 ↑ → 포식수 ↑ → 사체 → 균사 ↑ → 곤충 ↓ 가 한 번 돈다
10. 멸종 없음 — 이 Region 의 세 개체군은 전부 기본 공급이다. 0 은 종점이 아니라 조건 결핍의 표시다 (F15 · S7).
    FINITE 생명(진짜로 사라지는 것)은 그것을 놓는 행이 World Event 로 따로 정한다
11. 자리와 번호 — 2층 여섯째 Play · Frost 뒤 · Cycle 은 C022~C025
```

## Human 질문

```text
1. 거대 수목(RED_EYE_TREE)은 스스로 생명인가?
   그렇다면 분화형 SEPARATION 의 첫 후보가 되고(뿌리혹 · 묘목 · 걷는 숲), 알집은 "거목이 낳는 것" 이 되어
   결속형이 아니라 분화형으로 읽힐 수 있다. 이 Play 는 **묻지 않고 결속형으로 두었다** — 거목을 생명으로
   확정하면 Concept §12 걷는 숲과 함께 다시 읽어야 한다. 그 판단은 Human 의 것이다
```

닫힌 질문 하나 — "광식충 위쪽 사슬을 2층에서 어디까지 값으로 둘 것인가" 는 검토에서 **둔다**로 확정했다 (F14 · 5.6).
W9 와 미증명 ④를 생태에서 증명하려면 값의 바퀴가 2층에 있어야 하고, 개체가 아니라 값이므로 3층을 침범하지 않는다.
