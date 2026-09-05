# C011 — 흔적이 원천으로 데려간다

```text
CYCLE          C011
SOURCE         content/roadmap/play/RoomBearsMaterial.md (승인됨)
               — §2 Play Goal · §4 Breath(이상함 · 추측 · 추적) · §5.1 · §5.2 · §5.3 ·
                 §6 Required(W17 · W19 · W24 · V9 · V10 · V11 · E12) · 확정 사항 2·3·5·7·8 ·
                 위임된 결정 D1(이름) · D2(성질) · 부록 A.1 · A.2 · A.3
               content/roadmap/L2-World-Concept.md §4 숲의 생태 사슬 (World Cause 원본) · §3.5 layer
               content/roadmap/L2-World-Region.md R13 데이터에 상한 없음 · §5.1 이름 표
SELECTED_FROM  Play §7 Cycle Breakdown 의 첫 항목 (C011)
```

## Playable Goal

관찰자가 재료 아이콘도 좌표 안내도 없는 채로, 흙 변색이 **짙어지는 쪽**을 따라 백왕령 → 숲 가장자리 →
탐험대 폐허 · 숲 깊은 곳 → 생체 광석 지대 · 붉은 눈의 거목으로 방을 건너 **네 원천**에 닿아 캐고,
캔 것이 **재료의 이름**으로 손에 들어온다. 백왕령에는 이 계통이 하나도 없다.

## Experience Intent

```text
Start   재료는 광맥이다 — 아이콘이 있고, 그것 하나가 시작 방에 놓여 있다.
End     재료는 숲이 만들고 있는 것이다. 흙 색이 다른 자리가 먼저 오고, 그 색은 방향을 가지며,
        따라가면 서로 다른 형태의 원천 넷이 서 있다. 손에 든 것이 무엇에 쓰이는지는 아직 모른다.
```

## World Change

1. 시작 방의 광맥(`Deposit`)이 사라진다. **원인 없이 놓인 Loot Node** 는 이 세계에서 없어진다
   (Play §6 Existing — S2 가 금지한 그것). 백왕령에는 이 계통이 유입되지 않는다 (확정 5).
2. 이 숲에 **재료 계통**이 생긴다 — Material Seed 둘(`BIO_ORE` 생체 광석 · `ORE_EATER_MOLT` 광식충 허물)이
   서로 다른 자연 형태로 네 자리에 난다 (D1 · A.1).
3. 네 **Resource Source** 가 자기 방에 선다 — 경계부 둘(`MOLT_LITTER` · `RUIN_SPOIL`)과
   핵심부 둘(`ORE_OUTCROP` · `ROOT_NODULE`). 자리도 성질도 `content/regions` 의 데이터다.
4. 방 다섯의 땅에 **흔적**(흙의 변색)이 깔린다. 세기는 경계부 → 중간부 → 핵심부 → 원천 둘레로
   **단조롭게 짙어진다** — 그것이 방향이다.
5. 채광 규칙의 대상이 광맥에서 **원천**으로 바뀐다. 얻는 것은 `stone` 이 아니라 그 원천의 **재료**다.
6. 소지품의 품목이 재료가 된다 — `stone` 은 이 세계에서 사라진다.

## Observable Result

1. 백왕령에 캘 것이 하나도 없고 흙 변색도 없다.
2. 숲 가장자리의 서쪽 나무 밑동에 **흩어진 껍질 조각**이 있고, 그 둘레 흙 색이 방의 나머지보다 짙다.
3. 탐험대 폐허의 **헐린 더미**에서 캐면 숲 가장자리와 **같은 재료**가 들어온다.
4. 숲 깊은 곳은 방 전체가 가장자리보다 짙고, 동쪽(광석 지대 쪽)과 북쪽(거목 쪽) 출구 둘레가
   더 짙다. 서쪽(둥지 쪽)은 짙어지지 않는다.
5. 생체 광석 지대의 **노두**와 붉은 눈의 거목의 **뿌리혹**은 방 바닥보다 더 짙은 변색 한가운데 서 있고,
   뿌리혹 둘레가 이 세계에서 가장 짙다.
6. 원천을 지목하면 판이 그것의 종류와 줄 수 있는 행동(채취)을 답한다 — 세계 위에 이름표는 없다.
7. 캐고 나면 HUD 에 그 **재료의 이름**과 수가 뜬다. 무엇에 쓰는지는 아무 데도 없다.

## Reuse

```text
Existing (그대로 쓴다)
  RegionGraphRooms 전부 — 방 열하나 · Connector 열여섯 · 건너기 · 방으로 잘리는 투영 · depth
  RoomBecomesLand — Description(point · area · polygon) · compile · tagsAt · SceneGroundZone · 조건 area
  RuleBoundRoom — Region State · 컴파일 위의 덧씌움 · 다중 관찰자 · 세계 영속
  RoomAnswersWhenAsked — 자리 지목(C026) · 존재 지목과 대상 프레임과 그 대상이 주는 행동(C027) ·
                        늘 떠 있는 판 · 세계 위 글자 0(RULE-QUIET-GROUND-001)
  채광 — RULE-MINE-001 / RULE-MINE-COMPLETE-001 (대상만 바뀐다) · 행동 진행 · 소지품 · InteractionRange
Added
  Data      content/regions/materials.ts (Material Seed 표) · RegionSpec.resourceEcology ·
            방 다섯의 Description 에 resource layer point 넷 · trace layer area 열
  World     semantic/resource.ts — 원천 목록과 자리를 데이터에서 유도한다 · 흔적 세기 유도
  Protocol  EntityView.material — 그 원천이 내는 Material Seed 의 코드
  View      원천 표현(형태별 그림 넷) · 흔적 표현(단계별 지면 색) · 문구
Engine
  없음 — E12 그대로다. resource · trace 는 이미 Description 의 layer 이고 새 op 도 새 layer 종류도 없다
```

## Out of Scope

```text
Source 의 phase 와 채취 단위 · 캔 자국(외형 · 흔적 옅어짐 · 통행 막힘 · 의존)   → C012 (D4 가 여기 붙는다)
회복 · Supply Mode 의 실제 진행 · MIGRATORY 의 자리 이동 · 뿌리 곡선(presence)  → C013 (D3 가 여기 붙는다)
조건부 기회(RIVER_SILT) · 부산물(NEST_FUNGUS) · 호수 침전 · Resource Flow ·
  Isolation Reason 의 명시 · world:observe --report ⑩~㉒ 와 분포 요약 ⑲⑳          → C014
재료의 쓰임 — Recipe · 조합 · 효과 · 수치                                     → 4층 이후 (S10 · unresolvedUses)
살아 움직이는 광식충 · 조류 · 포식수                                          → 3층 (확정 2)
```

**이 Cycle 의 원천은 캐도 줄지 않는다.** 채취 단위(D4)와 고갈은 C012 가 phase 와 함께 세운다 —
Play 가 그 둘을 한 자리에 묶어 두었고(§5.4 · D4 "C012 헤더 고정"), 여기서 수만 먼저 깎으면
"캐면 세계가 달라진다" 의 절반이 이 Cycle 에 흩어진다. TODO 의 부채로 남긴다.

## SPEC

```text
SPEC-001  네 원천이 자기 방에 선다
          조건  관찰자가 FOREST_EDGE · EXPLORER_RUIN · BIO_ORE_FIELD · RED_EYE_TREE 에 선다
          기대  그 방의 관찰 결과에 role = 'resource-source' 인 존재가 정확히 하나 있고,
                그 자리는 그 방 Description 의 resource layer point 자리와 같다
          경계  WHITE_KING_DOMAIN · FOREST_DEEP · PREDATOR_NEST · HEART_LAKE 에는 하나도 없다

SPEC-002  원천은 자기가 무엇을 내는지 밝힌다
          조건  원천 하나를 관찰한다
          기대  material 이 그 원천의 Material Seed 코드이고 kind 가 자연 형태 코드다
                MOLT_LITTER · RUIN_SPOIL → ORE_EATER_MOLT · ORE_OUTCROP · ROOT_NODULE → BIO_ORE
          경계  쓰임(Recipe · 효과 · 수치)은 관찰 결과 어디에도 없다

SPEC-003  흔적이 방을 건너 짙어진다
          조건  방마다 원천에서 먼 자리(방 바닥)의 흔적 세기를 잰다
          기대  FOREST_EDGE = EXPLORER_RUIN(1) < FOREST_DEEP(2) < BIO_ORE_FIELD = RED_EYE_TREE(3)
          경계  WHITE_KING_DOMAIN 은 어느 자리에서도 0 이다

SPEC-004  흔적이 방 안에서도 방향을 준다
          조건  한 방 안의 두 자리를 견준다
          기대  ① FOREST_DEEP — ORE_TRAIL(동) · TREE_APPROACH(북) 둘레가 NEST_TRAIL(서) 둘레보다 짙다
                ② 원천 넷은 저마다 자기 방 바닥보다 짙은 자리 위에 서 있다
                ③ ROOT_NODULE 자리가 세계에서 가장 짙다
          경계  겹친 흔적이 여럿이면 **가장 짙은 것**이 그 자리의 세기다 (합하지 않는다)

SPEC-005  캐면 그 원천의 재료가 손에 들어온다
          조건  곡괭이를 지닌 몸이 원천의 InteractionRange 안에서 mine 을 걸고 행동이 끝난다
          기대  소지품의 그 Material Seed 수가 1 늘고, 다른 재료는 늘지 않는다
          경계  행동이 끝나기 전에는 아무것도 늘지 않는다 (즉시 획득이 아니다 — 기존 채광 그대로)

SPEC-006  채취의 거절
          조건  전제를 하나씩 깬다
          기대  곡괭이 없음 → no-mining-tool · 거리 밖 → out-of-range · 다른 행동 중 → action-busy ·
                모르는 대상 → unknown-source. 어느 경우에도 소지품이 늘지 않는다
          경계  다른 방의 원천을 대상으로 걸면 out-of-range 다 (자리가 방마다 따로이므로)

SPEC-007  백왕령에는 이 계통이 없다
          조건  관찰자가 WHITE_KING_DOMAIN 에 선다
          기대  캘 수 있는 존재가 하나도 없고 mine interaction 도 하나도 없다
          경계  방은 그대로 산다 — 능선 · 강 · 다리 · 도시 · 조건 셋은 한 값도 바뀌지 않는다

SPEC-008  화면에 재료 표식이 없다
          조건  원천이 선 방을 그린다
          기대  원천 위에 글자(라벨 · 이름표 · 수량)가 하나도 없고, 지면 표식도 미니맵도 없다
          경계  원천의 그림 자체는 그 자리에 선다 — 그것은 표식이 아니라 실물이다

SPEC-009  물으면 원천이 답한다
          조건  원천을 지목한다 (C027 의 존재 지목)
          기대  판에 그 종류가 서고, 그 대상이 주는 행동으로 채취가 서며, 걸 수 없으면 사유가 그 자리에 있다
          경계  지목을 풀면 판은 내 몸으로 돌아간다 (C027 그대로 — 이 Cycle 이 바꾸지 않는다)

SPEC-010  가지지 않은 재료의 자리는 없다
          조건  아무것도 캐지 않은 관찰자의 HUD 를 본다
          기대  재료 자리가 하나도 없다. 하나 캐면 그 재료의 자리 하나가 생긴다
          경계  0 으로 지어내지 않는다 — 세지 않은 것과 없는 것을 화면이 가르지 않게
```

## State

**이 Cycle 은 세계 State 를 하나도 더하지 않는다.** 원천은 저장되는 것이 아니라 데이터에서
유도되는 사실이다 (semantic/terrain.ts · semantic/region.ts 와 같은 갈래).

```text
사라지는 것   World.deposits          — 광맥 목록. 시작 방의 `deposit-1` 과 함께 없어진다
             Actor.currentAction.targetDepositId → targetSourceId 로 이름이 바뀐다
             Item.Kind 'stone'        → 재료 코드 둘로 바뀐다
유도되는 것   ResourceSource(regionId · id · material · form · carrier · opportunity · supply · position)
             — content/regions 의 resourceEcology + 그 방 Description 의 resource point 에서
             흔적 세기(자리 하나의 정수 0..5) — 그 방 Description 의 trace area 에서
```

`STATE_VERSION` 은 `hkt-adv-proto-i/3` → `hkt-adv-proto-i/4`. deposits 가 사라지고 소지품의 품목이
바뀌므로 옛 스냅샷은 복구되지 않는다.

### 데이터 값 (content/regions)

Material Seed — 이름과 성질은 D1 · D2 의 것이다. 쓰임은 없다.

```text
BIO_ORE           생체 광석    형태  outcrop(노두 원석) · root-nodule(뿌리혹 축적체)
ORE_EATER_MOLT    광식충 허물  형태  molt-litter(나무 밑동의 허물) · spoil-pile(버려진 선광 더미)
```

`spoil-pile` 이 광식충 허물인 근거는 Play §4 Breath 의 **추측** 그대로다 — "탐험대 폐허의 버려진 더미에도
**같은 것이 섞여 있다**". 같은 것이 두 자리에 있어야 §5.1 의 추론("이 숲에 계통이 하나 있다")이 선다.
`GIANT_TREE_FUNGUS` 는 이 Cycle 에 원천이 없으므로 표에도 두지 않는다 (없는 것을 미리 세우지 않는다).

Resource Source 넷 — 성질은 A.2 의 줄 그대로. supply · opportunity · carrier 는 **밝혀만 두고**
이 Cycle 의 규칙은 읽지 않는다 (C013 의 회복과 C014 의 보고가 읽는다).

```text
id            방                material          form          carrier  opportunity  supply                 자리
MOLT_LITTER   FOREST_EDGE      ORE_EATER_MOLT    molt-litter   residue  baseline     baseline-renewable     (-8, 6)
RUIN_SPOIL    EXPLORER_RUIN    ORE_EATER_MOLT    spoil-pile    residue  baseline     baseline-renewable     (-4, 4)
ORE_OUTCROP   BIO_ORE_FIELD    BIO_ORE           outcrop       terrain  risk         migratory              (8, -6)
ROOT_NODULE   RED_EYE_TREE     BIO_ORE           root-nodule   plant    risk         conditional-renewable  (-8, 2)
```

흔적 — trace layer 의 area 태그 `soil-stain:<단계>`. 단계는 1..5 이고 겹치면 큰 쪽이 이긴다.

```text
방                 바닥(polygon = extent)   더 짙은 자리(circle)
FOREST_EDGE       1                        MOLT_LITTER 둘레 r7 → 2
EXPLORER_RUIN     1                        RUIN_SPOIL 둘레 r7 → 2
FOREST_DEEP       2                        ORE_TRAIL(18,0) r8 → 3 · TREE_APPROACH(0,18) r8 → 3
BIO_ORE_FIELD     3                        ORE_OUTCROP 둘레 r7 → 4
RED_EYE_TREE      3                        ROOT_NODULE 둘레 r7 → 5
WHITE_KING_DOMAIN 없음                      없음 (확정 5 — 산과 강이 막는다)
PREDATOR_NEST · HEART_LAKE · 미로 셋  없음   C014 와 뒤의 Play 가 채운다
```

단계 수와 반경은 **배치 데이터**다 (C005 의 능선 · C006 의 강과 같은 갈래). Design 이 준 것은
순서(경계부 옅음 → 중간부 → 핵심부 → 뿌리혹이 가장 짙음)이고, 그 순서를 지키는 한 값은 폴리싱이다.

## Rule

```text
R1  CHANGED  RULE-MINE-001 — 채광의 대상이 원천이 된다
    IF  곡괭이를 지닌 Actor 가 같은 방의 Resource Source 를 InteractionRange 안에서 걸고,
        지금 행동이 대체 가능하다
    THEN CurrentAction = mine(sourceId)
    거절  no-mining-tool | out-of-range | action-busy | unknown-source

R2  CHANGED  RULE-MINE-COMPLETE-001 — 캔 것은 그 원천의 재료다
    IF  mine 행동이 Duration 을 채웠고 대상 원천을 세계가 안다
    THEN Inventory.Items[그 원천의 material] += 1
    거절  unknown-source

R3  ADDED    RULE-RESOURCE-PLACEMENT-001 — 원천의 자리는 데이터가 정한다
    IF  방 하나를 묻는다
    THEN 그 방 resourceEcology 의 원천마다, 같은 id 를 tag 로 가진 resource layer point 의 자리에 선다
    경계  그런 point 가 없는 원천은 **서지 않는다** — 자리를 지어내지 않는다

R4  ADDED    RULE-TRACE-STRENGTH-001 — 그 자리의 흔적 세기
    IF  방과 자리 하나를 묻는다
    THEN trace layer 의 `soil-stain:<n>` 태그 가운데 **가장 큰 n**. 하나도 없으면 0
    경계  합하지 않는다 — 겹침은 짙기이지 양이 아니다

R5  AFFECTED RULE-OBSERVE-PROJECTION — 관찰은 방으로 잘린다 (C001 R6 그대로)
    광맥이 있던 자리에 원천이 온다. 다른 방의 원천은 실리지 않는다

R6  AFFECTED RULE-QUIET-GROUND-001 (C026 R4) — 세계 위에 글자가 없다
    원천에도 라벨을 달지 않는다. 남은 양도 이름도 판이 물었을 때 답한다
```

## REUSED / ADDED / CHANGED / AFFECTED

```text
REUSED    RULE-ACTION-BEGIN-001 · RULE-ACTION-PROGRESS-001 · RULE-MOVE-001 · RULE-TRANSIT-001 ·
          RULE-TERRAIN-COMPILE-001 · RULE-SAFEBY-001 · RULE-PLACE-READING-001 · RULE-BEING-READING-001 ·
          RULE-TARGET-OFFERS-001 · RULE-POINTER-INTENT-001 · tagsAt · areasOf · findPoint
ADDED     RULE-RESOURCE-PLACEMENT-001 · RULE-TRACE-STRENGTH-001
CHANGED   RULE-MINE-001 · RULE-MINE-COMPLETE-001 (대상과 산출)
AFFECTED  RULE-OBSERVE-PROJECTION (광맥 → 원천) · RULE-QUIET-GROUND-001 (새 존재에도 글자가 없다) ·
          RULE-OBSERVER-JOIN-001 (몸의 초기 소지품에서 stone 이 사라진다)
```

## Observable (관찰 계약)

```text
싣는다
  entities[].role          'resource-source'
  entities[].id            원천의 id
  entities[].kind          자연 형태 코드 (molt-litter | spoil-pile | outcrop | root-nodule)
  entities[].material      Material Seed 코드 (BIO_ORE | ORE_EATER_MOLT)      ← protocol 의 새 자리
  entities[].state         'available'
  entities[].position      그 방 Local Space 의 자리
  interactions[] id 'mine' · role 'harvest-source' · targetEntityId · available · reason
  hud[] `inventory.<MaterialSeed>` — kind 'counter'. **지닌 재료마다 하나** (0 이면 자리가 없다)

싣지 않는다
  원천의 남은 양 · 재료의 쓰임 · 흔적의 세기 · 다른 방의 원천 · 원천으로 가는 방향이나 거리 ·
  아이콘 지시 · Material Seed 표 자체
  흔적은 **땅과 같은 규율**로 관찰자가 자기 content/regions 를 컴파일해 스스로 얻는다
  (C005~C007 이 높이·표면·통행에, C026 이 area 에 세운 그대로). 세계 State 가 아니므로
  투영할 것이 없다 — phase 가 흔적을 흔들기 시작하는 C012 가 그때 이 자리를 연다
```

## UNRESOLVED

없음.

기본형으로 둔 것 (Human 이 감사할 자리):

```text
① 흔적의 단계 수(5)와 각 방의 값 · 원천 둘레 반경(7 · 8)   — Design 이 준 것은 짙기의 **순서**뿐이다.
                                                            순서를 지키는 배치 데이터로 두었다
② 원천 넷의 좌표                                          — 배치 데이터. 통행 가능하고 출구에서
                                                            걸어 닿는 자리로 골랐다
③ `spoil-pile` 의 Material Seed = ORE_EATER_MOLT           — 근거는 Play §4 Breath 의 추측 (위 State 절)
④ 형태 코드 넷의 이름                                      — A.1 의 자연 형태를 코드로 옮긴 것
⑤ mine interaction 의 role 이름 'harvest-source'           — 행위는 하나 그대로다 (확정 3). 이름만 대상에 맞췄다
```
