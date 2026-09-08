# C022 — 허물의 주인

```text
CYCLE          C022 — LifeFormation 데이터 계약 · 탄생지 State(phase 넷) · 결속 조건 넷 ·
               전조 흔적 넷 · 비 · 개체군 값 · 검사 ㉗~㉝
SOURCE         content/roadmap/play/RoomBearsLife.md (§2 완료 확인 ① · §4 Breath 의 어긋남~기다림 ·
               §5.1 · §5.2 · §6 W38 · W39 · W40 · W43 · V19 절반 · V20 · E17 · 확정 1 · 2 · 3 · 4 · 5 · 6 · 11)
               content/roadmap/L2-World-Life.md (F1~F5 · F8 · F9 · F13 · §2.1 분할선 · §3.1 layer ·
               §3.2 데이터 계약 · §3.3 검사 ㉗~㉝ · §3.4 도구 밖으로 가는 것)
               content/roadmap/L2-World-Material.md §5.10 · §6.2 supply.recoveryCause · A.2 회복 원인 열
               content/roadmap/L2-World-Time.md §2.3 철 · §5 (날씨 체계를 만들지 않는다)
               content/roadmap/L2-World-Concept.md §4 숲의 생태 사슬
SELECTED_FROM  Play §7 Cycle Breakdown 의 첫째 항목 (C022)
확장            C011~C014 가 세운 원천 일곱 · 흔적 사다리 · 매달림과, C015~C016 이 세운 시계와 철,
               C019~C021 이 세운 위상 덧씌움 위에 **더한다** — 그 spec 의 Semantic/Rule 을
               복사하지 않고 이름으로 인용한다
```

## Playable Goal

**관찰자가 밑동의 허물에 주인이 없다는 것을 알아채고, 화면에 아무 표식 없이 흔적 넷(부푼 균사 ·
붉은 빛 · 옅어지는 흙 · 땅의 떨림)만으로 거목의 뿌리에 맺히는 붉은 알집에 닿는다.** 지목하면
지금 무엇이 차 있고 무엇이 모자란지가 읽히고, 비가 오는 동안 결속이 오르고, 균사가 끊기면
멎는다. **아직 태어나지는 않는다** — 다 차도 알집은 맺힌 채 서 있다.

## Experience Intent

```text
Start  허물은 밑동에 그냥 있는 것이다. 캐면 언젠가 다시 찬다 — 무엇이 벗었는지는 묻지 않았다.
End    벗은 것이 어디선가 만들어지고 있다. 거목의 뿌리에서, 균사와 광물과 비로.
       나는 그 자리를 흔적만으로 찾았고, 무엇이 모자란지도 안다. 아직 터지지는 않았다.
```

Play §4 Breath 의 **익숙함 → 어긋남 → 뒤쫓음 → 기다림** 구간이다. 목격(터짐)은 C023 이 받는다.

## World Change

1. **생명 계약이 세계에 선다** — `RegionSpec.ecology`(lifeFormation · populations)가 새 자리로
   난다. 네 탄생 방식의 어휘가 함께 서고(F3) 이 Cycle 은 그중 하나(`ENVIRONMENTAL_BINDING`)만 쓴다.
   새 layer 도 새 Rule 문법도 별도 Life System 도 만들지 않는다 (F13 · Life §3.1).
2. **탄생지가 세계에 처음 선다** — `ROOT_CLUTCH` 붉은 알집이 거목의 뿌리 곡선 위에 서고,
   Region State 에 `lifeSites[id] = { phase · progress }` 가 난다(저장된다). phase 는 넷
   (DORMANT · BINDING · BORN · SPENT)이고 이 Cycle 이 오가는 것은 앞의 둘이다.
3. **결속 조건 넷** — 뿌리혹의 축적(`ROOT_NODULE` 이 있음) · 둥지에서 뻗은 균사(`NEST_FUNGUS` 가
   있음 — **다른 방의 원천**이다) · 비 · 광식충 개체군이 0. 넷이 다 차 있는 동안에만 결속이 오른다.
4. **비가 선다** — 날씨 체계가 아니다 (Time §5). 세계 시각과 철에서 **유도되고 저장되지 않는다**
   (C015 의 시계와 같은 규율): 스밈에 잦고 고요에 하루 한 번, 긴 밤과 뒤척임에는 없다.
5. **개체군 값이 선다** — Region State 에 `populations[id] = { value }`. 광식충 하나뿐이고 값은 0
   이며 **이 Cycle 에서는 아무것도 그 값을 올리지 않는다**(C023 의 몫). 값이 0 이라는 사실 자체가
   결속의 조건이다 — 최초는 결속이고 이후는 계승이기 때문이다 (확정 2).
6. **전조 흔적 넷** — 부푼 균사(curve) · 뿌리 마디의 붉은 빛(point) · 뿌리 둘레 흙이 한 단계
   옅어짐(area) · BINDING 동안의 떨림(선 자리의 걸린 것). 넷 다 **탄생지의 phase 와 조건에서**
   나온다 — **위상을 거는 원인이 여섯째가 되었다** (철 · 소란 · 지나가는 것 · 상시 · 고갈 · **탄생지**).
7. **생명을 전제한 회복 원인이 계약이 된다** — `MOLT_LITTER` 의 회복 원인 `molt-cycle` 이 "무엇이
   벗는가" 를 이름으로 밝힌다(광식충). 검사 ㉛ 이 그 자리를 잰다 — 밝히지 않으면 결손이다.
   **값이 회복을 실제로 좌우하는 것은 C024** 이고, 여기서 서는 것은 참조뿐이다.
8. **검사가 스물여섯에서 서른셋이 된다** — ㉗ ㉘ ㉙ ㉛ ㉜(참조 무결성) · ㉚ ㉝(분포 요약).
   ㉜ 는 links 가 아직 없으므로 `absent` 이고, ㉝ 는 관계 없는 개체군 하나를 보고한다.

## Observable Result

1. 거목의 방에서 흔적 넷이 읽힌다 — 둥지 쪽 이음에서 뿌리로 뻗은 **부푼 균사**의 자락, 뿌리 마디의
   **붉은 빛**, 그 둘레 흙이 **한 단계 옅어진 것**(C011 의 사다리에서 5 → 4). 화면 어디에도 알집을
   가리키는 아이콘 · 타이머 · 좌표는 없다.
2. 알집을 지목하면 지금의 phase 와 **무엇이 차 있고 무엇이 모자란지**가 조건 코드로 읽힌다.
   캐기는 걸리지 않는다 — 알집은 원천이 아니다.
3. 비가 오는 철·시각에 넷이 다 차면 phase 가 BINDING 이 되고, 그 자리에 선 동안 **떨림**이
   걸린 것에 실린다. 그 방을 떠나 있어도 세계 시간으로 오른다.
4. 균사를 캐 `NEST_FUNGUS` 를 바닥내면 그 tick 에 phase 가 DORMANT 로 돌아가고 **진행이 멎는다** —
   지워지지 않는다. 균사가 되돌아오고 비가 오면 **멎은 자리에서 이어서** 오른다.
5. 긴 밤에는 넷이 아무리 차 있어도 BINDING 이 되지 않는다 — 비가 없다.
6. 결속이 다 차도 **아무 일도 일어나지 않는다** — 알집은 BINDING 인 채 서 있고, 뿌리혹도 균사도
   개체군도 한 값 달라지지 않는다 (태어남은 C023 이다).
7. `npm run world:check` 가 검사 서른셋을 낸다 — ㉗ ㉘ ㉙ ㉛ 통과 · ㉜ absent · ㉚ 은 결속 하나를,
   ㉝ 는 관계 없는 개체군 하나를 보고한다.
8. 백왕령 · 숲 다섯 · 미로 셋 · 협곡 둘의 땅 · 원천 · 흔적 · 철의 덧씌움은 한 값도 달라지지 않는다.

## Reuse

```text
Existing (그대로 쓴다 · 이름만 인용한다)
  재료 계통 전부 — Seed 표 · ResourceSourceSpec · 원천의 phase 셋 · 캐기와 고갈(C012) ·
    세계 시간으로 되돌아옴(C013) · 매달림과 흐름(C014) · 출현 조건(C016)
  시계와 철 (C015) · 방이 시계를 읽어 위상을 얻는 덧씌움 (C016 · C017 · C018 · C019 · C020 · C021)
  흔적 자락의 단계 기제 · 원천 둘레가 한 단계 옅어짐 (C011 · C012)
  존재의 조건 코드 자리 · 지목과 대상 프레임 (C011 · C026 · C027)
  Region State 의 저장 (C010) · 세계 과정이 관찰자 없이 도는 것 (C013)

Added — World
  RegionSpec.ecology                 lifeFormation · populations (F13 — 새 layer 를 만들지 않는다)
  LifeFormationSpec                  mode · source · condition · transition · consumes · traces ·
                                     ecologicalRole · population (Life §3.2 그대로)
  LifeFormationMode 넷               INHERITED · ENVIRONMENTAL_BINDING · TRANSFORMATION · SEPARATION
  PopulationSpec                     id · scale · declineCause · presence?(이 Cycle 은 밝히지 않는다)
  RegionState.lifeSites[id]          phase · progress (저장된다)
  RegionState.populations[id]        value (저장된다)
  RULE_FOREST_CLUTCH                 이 숲의 Region Rule id 하나 (FOREST_CHAIN 과 같은 갈래의 상수)
  RULE-LIFE-CONDITION-001            결속 조건 넷의 판정과 조건 코드
  RULE-LIFE-BINDING-001              조건이 차 있는 동안 세계 시간으로 진행 · 깨지면 멎는다
  RULE-RAIN-001                      비는 시각과 철에서 유도된다 (저장하지 않는다)
  RULE-LIFE-SITE-PHASE-001           탄생지의 phase 가 그 방에 위상을 건다 (거는 원인 여섯째)
  ResourceSourceSpec.recoveryLife?    회복 원인이 전제하는 개체군 (㉛ 이 재는 자리)

Added — Data
  content/regions/lives.ts       LifeSeed 목록 — `ORE_EATER` 광식충 (materials.ts 와 같은 자리)
  content/regions/red-eye-tree.ts  ecology 하나 · 탄생지 point · 전조 흔적 셋의 op
  content/regions/forest-edge.ts   MOLT_LITTER 에 recoveryLife
  content/regions/index.ts         새 상수의 재수출 (배열 끝에 붙는다)
  content/authoring/contracts.ts   탄생 방식 넷 · 생명을 전제하는 회복 원인 코드 목록

Added — View
  탄생지의 phase 별 외형(DORMANT · BINDING) · 부푼 균사와 붉은 빛의 색 ·
  문구 clutch-dormant · clutch-binding · clutch-condition-* · tremor · rain

Added — Engine
  검사 일곱 ㉗ ㉘ ㉙ ㉚ ㉛ ㉜ ㉝ (check.ts — 게임 명사는 계약으로 받는다)
```

## Out of Scope

```text
DORMANT/BINDING → BORN 전이 · 소비 넷 · traces.after(빈 껍질) · 개체군 값이 오르는 것 ·
  뿌리의 알(계승형 ROOT_EGGS) · presence area                                        C023
개체군 값이 MOLT_LITTER 의 회복을 **좌우**하는 것 (F8 · ㉛ 의 행동 쪽 절반) ·
  개체군이 줄어 0 이 되는 것 · 사체 → 균류 변성형 · 협곡에 탄생지가 없는 사유 · ㉚ 분포 보고   C024
개체군 셋과 관계 다섯(EATS · CALLS · LEAVES) · Region 을 넘는 CALLS · RESIDUE 를 낳는 LEAVES ·
  무관찰 실주행 명령 · ㉜ ㉝ 의 실제 보고 · populations 의 trend                          C025
분화형 SEPARATION 의 첫 사례 (거대 수목이 스스로 생명인가)              Play Human 질문 1 — 그 행의 Play
태어난 개체의 몸 · 걸음 · 감각 · 죽음                                                   3층 (F10)
생명이 요구에 답할 성질 태그 (lives.ts 의 properties)                RoomAsksForPossibilities (C029~)
날씨 체계 (구름 · 바람 · 지역마다 다른 비)                            두지 않는다 (Time §5 · 확정 4)
```

## SPEC

```text
SPEC-001  생명 계약이 세계에 선다
  방이 `ecology` 를 밝힐 수 있고, 그 안에 탄생지(lifeFormation)와 개체군(populations)이 든다.
  거목의 방이 탄생지 하나와 개체군 하나를 밝히고, 그 탄생지는 방식 · 재료 셋 · 조건 넷 ·
  소비 둘 · 전조 넷 · 생태 역할 · 올릴 개체군을 다 가진다.
  경계 ① `ecology` 를 밝히지 않은 방은 한 값도 달라지지 않는다 — 열넷 중 하나만 밝힌다.
  경계 ② 네 탄생 방식의 어휘가 다 서고, 이 세계가 쓰는 것은 결속 하나뿐이다.

SPEC-002  탄생지가 방에 서고, 물으면 답한다
  알집은 거목의 방 뿌리 곡선 위 resource layer 의 point 로 서고, 지목하면 지금의 phase 와
  조건 코드가 읽힌다 — 차 있는 것과 모자란 것이 갈린다.
  경계 ① 캐기는 걸리지 않는다 (알집은 원천이 아니다) — 불가 사유가 그것을 말한다.
  경계 ② 세계 위에 늘 떠 있는 글자는 하나도 늘지 않는다 (C026~C028 의 규율).

SPEC-003  전조 흔적 넷이 알집으로 이끈다
  ① 둥지 쪽 이음에서 뿌리로 뻗은 부푼 균사의 자락이 `NEST_FUNGUS` 가 있음일 때만 선다.
  ② 뿌리 마디의 붉은 빛이 조건 넷이 다 찬 동안(BINDING) 선다.
  ③ 알집 둘레의 흙이 진행에 따라 한 단계 옅어진다 (5 → 4 — 재료가 알집으로 간다).
  ④ BINDING 동안 그 자락에 선 몸의 걸린 것에 떨림의 코드가 실린다.
  경계 ① 넷 다 철 · 소란 · 지나가는 것 · 상시 · 고갈의 덧씌움과 **함께** 걸린다 — 서로 지우지 않는다.
  경계 ② 땅도 통행 격자도 hash 도 한 값 바뀌지 않는다 (덧씌움이지 재컴파일이 아니다).
  경계 ③ 알집을 가리키는 아이콘 · 타이머 · 좌표는 어디에도 없다.

SPEC-004  결속 조건은 넷이고, 하나라도 모자라면 서지 않는다
  뿌리혹이 있음 · 균사가 있음 · 비가 온다 · 광식충이 0 — 넷이 다 차 있는 동안에만 phase 가
  BINDING 이다. 균사는 **다른 방의 원천**이다.
  경계 ① 하나라도 깨지면 그 tick 에 DORMANT 로 돌아간다.
  경계 ② 모자란 조건마다 다른 코드가 걸린다 — 무엇이 모자란지가 갈린다.
  경계 ③ 관찰자가 그 방에 없어도 판정은 돈다.

SPEC-005  결속은 세계 시간으로 오르고, 조건이 깨지면 멎는다
  BINDING 인 동안 진행이 세계 시간으로 오르고 60 세계 초에 다 찬다. 조건이 깨지면 진행이
  **그 자리에 멎고 지워지지 않으며**, 조건이 다시 차면 이어서 오른다.
  경계 ① 진행은 1 을 넘지 않는다.
  경계 ② 다 차도 phase 는 BINDING 그대로다 — 아무것도 태어나지 않고 아무것도 소비되지 않는다.
  경계 ③ 저장된다 — 세계를 다시 세워도 phase 와 진행이 그대로다.

SPEC-006  비는 시각과 철에서 유도되고 저장되지 않는다
  하루(360 세계 초) 안의 정해진 구간에 비가 오고, 그 구간의 수가 철마다 다르다 —
  고요 하루 한 번 · 스밈 하루 두 번 · 긴 밤과 뒤척임에는 없다.
  경계 ① 세계 State 가 아니다 — 시각에서 유도되고 저장되지 않는다 (C015 의 시계 그대로).
  경계 ② 관찰자와 무관하다. 비는 온 세계에 같이 온다 (지역마다 다른 비를 두지 않는다).
  경계 ③ 비는 땅 · 표면 · 통행 · 관찰 범위를 한 값도 바꾸지 않는다.

SPEC-007  개체군 값이 서고, 0 이라는 사실이 조건이다
  거목의 방이 광식충 개체군 하나를 밝히고 값이 0 으로 선다(저장된다). 상한이 있고 값이 내리는
  세계 안의 원인이 데이터에 적혀 있다.
  경계 ① 이 Cycle 에는 값을 올리거나 내리는 것이 하나도 없다 — 늘 0 이다.
  경계 ② 값이 0 이 아니면 결속이 서지 않는다 (손잡이로 값을 세워 잰다).

SPEC-008  검사가 일곱 늘어 서른셋이 된다
  ㉗ 탄생지가 가리키는 재료 · Region Rule · 요구 상태 · 소비 · 흔적이 실제로 있는가 ·
  ㉘ 모든 탄생지가 그 방의 세계 원인에 닿는가 · ㉙ 모든 탄생지가 전조와 소비를 하나 이상 가지는가 ·
  ㉛ 회복 원인이 살아 있는 것을 전제하는 원천이 그 개체군을 밝혔고 그 개체군의 탄생지가 있는가 ·
  ㉜ 관계의 양끝과 이음이 실제인가 · ㉚ 방마다의 탄생 방식 분포 · ㉝ 관계 없는 개체군.
  경계 ① 잴 것이 놓이지 않은 검사는 통과가 아니라 `absent` 다 — ㉜ 가 그렇다(관계가 없다).
  경계 ② 넷(㉗ ㉘ ㉙ ㉛)은 잘못된 데이터를 실제로 집어낸다 — 끊긴 참조 · 원인 없는 탄생 ·
        전조 없는 탄생 · 주인 없는 회복 원인.
  경계 ③ 앞의 스물여섯은 한 값도 달라지지 않는다.

SPEC-009  앞의 세계는 그대로다 (회귀)
  백왕령 · 숲 다섯 · 미로 셋 · 협곡 둘의 땅 · 표면 · 통행 · hash · 원천 일곱 + 넷의 phase 와
  캐기 · 흔적 단계 · 철과 소란과 지나가는 것의 덧씌움 · 관찰 범위가 한 값도 달라지지 않는다.
  경계 거목의 방에서도 `ROOT_NODULE` 의 캐기와 되돌아옴은 그대로다 — 알집은 아직 아무것도 먹지 않는다.
```

## State

새로 나는 것은 Region State 의 두 자리뿐이다. 원천 · 압력 · 자국의 State 는 한 줄도 바뀌지 않는다.

```text
RegionState.lifeSites[<id>].phase      DORMANT | BINDING | BORN | SPENT  (이 Cycle 은 앞 둘만 오간다 · 저장된다)
RegionState.lifeSites[<id>].progress   0..1                              (조건이 깨져도 지워지지 않는다 · 저장된다)
RegionState.populations[<id>].value    0..scale                          (이 Cycle 에는 늘 0 · 저장된다)

유도되고 저장되지 않는 것
  비                                    세계 시각 + 철 → 참/거짓 (C015 의 낮밤 · 철과 같은 자리)
  결속 조건 넷의 충족                    지금의 원천 phase · 비 · 개체군 값에서 매 tick 판정
```

데이터 — 탄생지 하나 (Play §5.2 · 확정 1 · 3 · 5).

| 자리 | 값 | 근거 |
|---|---|---|
| id | `ROOT_CLUTCH` 붉은 알집 | 확정 1 · 미지 M6 |
| 방 | `RED_EYE_TREE` (뿌리 곡선 위의 마디 곁) | Play §5.2 |
| mode | `ENVIRONMENTAL_BINDING` | 확정 2 (최초는 결속) |
| source | `BIO_ORE`(뿌리혹의 축적) · `GIANT_TREE_FUNGUS`(둥지에서 뻗은 균사) · 비 | 확정 3 |
| condition.regionRule | `RULE_FOREST_CLUTCH` | Play §5.2 |
| condition.requiredState | `ROOT_NODULE` 있음 · `NEST_FUNGUS` 있음 · 비 · `ORE_EATER` == 0 | Play §5.2 |
| transition | DORMANT → BORN (이 Cycle 은 BINDING 까지만 간다) | Play §5.2 |
| consumes | `ROOT_NODULE` 의 축적 · `NEST_FUNGUS` 의 분해 진행 | Play §5.3 (실제 소비는 C023) |
| traces.before | 부푼 균사 · 붉은 빛 · 옅어지는 흙 · 떨림 | Play §5.2 |
| traces.after | 빈 껍질 · 붉은 가루 (**밝혀만 둔다** — C023 이 쓴다) | Play §5.3 |
| ecologicalRole | 광식충 개체군을 처음 세운다 → 허물 공급의 원인이 된다 | Play §5.2 |
| population | `ORE_EATER` | Play §5.2 |
| 결속 길이 | 60 세계 초 | 확정 5 |

데이터 — 개체군 하나 (확정 6).

| 자리 | 값 | 근거 |
|---|---|---|
| id | `ORE_EATER` 광식충 | Concept §4 · Play §5.6 |
| scale | 4 | 확정 6 |
| declineCause | 조건 결핍 (`CONDITION_LOST`) | 확정 6 · Life §3.2 (먹힘은 C025) |
| presence | 밝히지 않는다 | C023 이 세운다 |

데이터 — 비 (확정 4 · 기본형 ②).

| 철 | 하루 안의 비 구간 | 하루의 비 |
|---|---|---|
| 고요 (3일) | [0, 90) | 한 번 |
| 스밈 (2일) | [0, 90) · [180, 270) | 두 번 |
| 긴 밤 (1일) | 없음 | 없다 |
| 뒤척임 (60 초) | 없음 | 없다 |

데이터 — 흔적 셋의 자락 (C011 의 사다리 위에 겹친다 · 기본형 ①).

```text
부푼 균사     RED_EYE_TREE 의 둥지 쪽 이음 anchor → 알집까지의 curve · `fungus-swell`
              (NEST_FUNGUS 가 있음일 때만 선다)
붉은 빛       알집 자리의 point · `clutch-glow`  (BINDING 동안만 선다)
옅어지는 흙   알집 둘레 circle · `soil-stain:4`  (진행이 절반을 넘으면 선다 — 바닥 5 위에 겹쳐 옅게)
떨림         알집 둘레 circle · 걸린 것의 코드 `ground-tremor`  (BINDING 동안만)
```

회복 원인이 전제하는 개체군 (㉛ · Material A.2 회복 원인 열).

```text
MOLT_LITTER  molt-cycle   → ORE_EATER   C022 ADDED — 무엇이 벗는가가 이름으로 선다
NEST_FUNGUS  carcass-decay → (밝히지 않는다)  C024 가 사체를 낳는 것을 세운 뒤에 밝힌다
그 밖의 원천                              생명을 전제하지 않는다 (tree-uptake · pile-erosion · flow-arrival …)
```

## Rule

```text
R1  RULE-RAIN-001 (ADDED)  — 비는 시각과 철에서 유도된다
    IF   지금 철이 밝힌 비 구간이 있고, 하루 안의 지금 자리가 그 구간 안이다
    THEN 지금 비가 온다.
    ELSE 오지 않는다.
    경계 ① 세계 State 가 아니다 — 저장되지 않고 관찰자와 무관하다 (C015 R1 · C014 R1 의 어법).
    경계 ② 땅 · 표면 · 통행 · 관찰 범위를 한 값도 바꾸지 않는다.
    비고  규칙은 철의 이름을 알지 못한다 — 데이터의 열쇠와 시계가 낸 지금 철을 맞춰 볼 뿐이다.

R2  RULE-LIFE-CONDITION-001 (ADDED)  — 결속 조건의 판정
    IF   탄생지가 요구 상태를 밝혔다
    THEN 요구마다 지금 차 있는지를 판정하고, 모자란 것마다 그 조건의 코드를 건다.
    요구의 갈래 셋  ① 원천이 있음인가 (같은 방이든 다른 방이든) ② 비가 오는가
                   ③ 개체군 값이 그 값인가
    경계 ① 요구를 밝히지 않은 탄생지는 늘 차 있는 것으로 읽는다 (이 세계에는 없다).
    경계 ② 세계가 모르는 원천 · 개체군을 가리킨 요구는 **차지 않은 것**으로 읽는다
          (끊긴 참조는 아무 일도 하지 않는다 — C021 R3 의 어법). 검사 ㉗ 이 그것을 잡는다.
    경계 ③ 관찰자와 무관하게 매 tick 돈다.

R3  RULE-LIFE-BINDING-001 (ADDED)  — 결속은 조건이 찬 동안만 오른다
    IF   요구가 다 차 있다 AND phase 가 DORMANT 또는 BINDING 이다
    THEN phase = BINDING 이고, 그만큼의 세계 시간이 진행에 실린다 (1 을 넘지 않는다).
    ELSE phase = DORMANT 이고 진행은 **그 자리에 멎는다** (지워지지 않는다).
    경계 ① 진행이 다 차도 phase 는 BINDING 그대로다 — BORN 으로 가는 것은 C023 이다.
    경계 ② phase 와 진행은 저장된다 (Region State 의 규율 그대로 · C010).
    비고  "조건을 캐면 늦어지고 두면 되돌아온다" 가 이 한 줄에서 나온다 (Play §5.5).

R4  RULE-LIFE-SITE-PHASE-001 (ADDED)  — 탄생지의 phase 가 위상을 건다
    IF   탄생지가 phase 마다의 자락을 밝혔다 AND 지금 phase 가 그것이다
    THEN 그 자락의 흔적 · 걸린 것의 코드가 그 방의 위상에 함께 실린다.
    ELSE 아무것도 늘지 않는다.
    경계 ① 철 · 소란 · 지나가는 것 · 상시 · 고갈의 덧씌움과 **함께** 걸린다 — 서로 지우지 않는다.
    경계 ② 땅도 통행 격자도 hash 도 한 값 바뀌지 않는다.
    비고  형은 C019 의 덧씌움 그대로다. 거는 **원인이 여섯째**가 되었을 뿐이다.

R5  RULE-OBSERVE-PROJECTION (AFFECTED)  — 대상 집합만 는다
    탄생지가 존재 하나로 실리고(역할은 원천과 같은 자리), 그 조건 코드가 실린다.
    봉투에 **새 자리는 나지 않는다**.

R6  RULE-MINE-001 (AFFECTED)  — 대상 집합만 는다
    알집은 원천이 아니므로 캐기가 걸리지 않는다 (unknown-source 의 자리 그대로).

R7  RULE-SOURCE-RECOVERY-001 · RULE-SOURCE-CONDITION-001 (REUSED)
    한 줄도 바뀌지 않는다. 알집은 이 Cycle 에서 아무것도 소비하지 않는다.
```

## REUSED / ADDED / CHANGED / AFFECTED

```text
REUSED    RULE-WORLD-CLOCK-001 · RULE-REGION-PHASE-001 · RULE-STANDING-CONDITIONS-001 ·
          RULE-SOURCE-RECOVERY-001 · RULE-SOURCE-CONDITION-001 · RULE-MINE-001 ·
          RULE-TRACE-STRENGTH-001 · RULE-RESOURCE-PLACEMENT-001 · RULE-OBSERVE-PROJECTION
ADDED     RULE-RAIN-001 · RULE-LIFE-CONDITION-001 · RULE-LIFE-BINDING-001 ·
          RULE-LIFE-SITE-PHASE-001 · RegionSpec.ecology(lifeFormation · populations) ·
          LifeFormationMode 넷 · RegionState.lifeSites · RegionState.populations ·
          ROOT_CLUTCH · ORE_EATER · RULE_FOREST_CLUTCH · recoveryLife ·
          검사 ㉗ ㉘ ㉙ ㉚ ㉛ ㉜ ㉝
CHANGED   없음 — 기존 Rule 의 전제도 전이도 한 줄 바뀌지 않는다
AFFECTED  RULE-OBSERVE-PROJECTION · RULE-MINE-001 (둘 다 대상 집합만)
```

## Observable (관찰 계약)

봉투에 **새 자리는 하나도 나지 않는다.** 이미 있는 자리의 목록이 늘고 값이 달라질 뿐이다.

```text
snapshot.entities[] (role: resource)   알집 하나 — 종류 · 지금 phase · 조건 코드(차 있는 것과 모자란 것)
snapshot.interactions[]                알집에는 캐기가 걸리지 않는다 (불가 사유)
snapshot.standingConditions[]          BINDING 자락 위에 선 동안 떨림의 코드
place 의 흔적 줄                        선 자리의 흔적 단계 (알집 둘레는 진행에 따라 옅다)
snapshot.region.{id,hash}              땅은 한 값도 바뀌지 않는다
```

**투영하지 않는 것** — 결속의 진행이 몇인지 · 결속이 몇 초짜리인지 · 지금 비가 오는지의 값 그 자체 ·
개체군 값 · 무엇이 태어나려 하는지 · 언제 태어나는지 · 그 뒤에 무엇이 남는지.
관찰자는 흔적과 조건 코드로만 그것을 읽는다 (Material · Time · Frost 의 규율 그대로).

## UNRESOLVED

**없음** — Play 의 확정 사항 열하나와 Life · Material · Time · Concept 이 이번에 필요한 게임 의미를
다 준다. Human 질문 1(거대 수목이 스스로 생명인가)은 이 Cycle 이 답을 **필요로 하지 않는다** —
Play 가 알집을 결속형으로 못박았고, 분화형은 이 세계에 아직 서지 않는다.

기본형으로 둔 것 (Human 이 감사할 자리).

```text
① 알집의 **자리**와 흔적 자락의 크기 — Design 은 "거목의 뿌리 곡선 위 마디 곁" 까지만 말한다.
   C011~C014 · C020 의 배치 데이터와 같은 성격으로 두고, 컴파일해 실측한 값을 주석에 적는다
   (뿌리혹과 다른 마디 · 둥지 쪽 이음에서 걸어 닿을 수 있어야 한다).
② 비의 **구간과 길이** — Design 은 "스밈에 잦고 긴 밤에 없다" 까지만 말한다 (확정 4).
   하루를 넷으로 나눈 90 초 구간을 쓰고 고요 하나 · 스밈 둘 · 긴 밤과 뒤척임 0 으로 두었다 —
   결속 60 초가 비 한 번 안에 다 찰 수 있는 값이다. 고요에도 한 번 두는 것은 "잦다" 가
   견줄 것을 필요로 하기 때문이다.
③ 조건이 깨졌을 때 진행이 **멎는다**(0 으로 지우지 않는다) — Design 은 "늦어진다 · 두면
   되돌아온다" 라고만 한다 (§5.5). C013 이 매달린 원천에 준 "되돌아옴이 멎었다" 와 같은 어법을
   골랐다. 지운다면 "늦어진다" 가 아니라 "처음부터 다시" 가 되어 Design 과 어긋난다.
④ 흙이 옅어지는 지점 = **진행 절반** — Design 은 "옅어지고 있다" 라고만 한다. C013 이 되돌아옴의
   예보에 쓴 절반과 같은 값을 골랐다.
⑤ 개체군의 값이 내리는 원인을 `CONDITION_LOST` 하나로 두었다 — Design 은 확정 6 에서 "조건
   결핍이 한 철 이어지면 -1" 이라 하고 먹힘(EATS)은 C025 의 것이다. 값을 실제로 내리는 규칙은
   이 Cycle 에 없다 (C024 가 세운다) — 데이터에 원인만 밝혀 둔다.
⑥ ㉛ 이 **참조**만 잰다 — Design 은 "회복 원인이 살아 있는 것을 전제하는데 그 lifeFormation 이
   없는가" 라고 한다. 그래서 이 Cycle 은 `MOLT_LITTER` 가 전제하는 개체군을 이름으로 밝히고
   그 개체군의 탄생지가 있는지를 잰다 — 그 값이 회복 속도를 **좌우하는 것**은 C024 의 몫이다
   (Play §5.4). 검사가 결손을 실제로 집어내는 것은 그 자리를 지운 데이터로 잰다.
⑦ `NEST_FUNGUS` 의 `carcass-decay` 는 이번에 개체군을 밝히지 않는다 — 사체를 남기는 것
   (LEAVES)이 아직 세계에 없어 무엇을 전제하는지 세계가 알지 못한다. C024 가 변성형을 세울 때
   밝힌다. 그때까지 그 원천은 ㉛ 의 대상이 아니다 (밝히지 않은 것을 결손으로 세지 않는다 —
   RegionBrief 의 "미답을 답으로 세지 않는다" 와 같은 규율).
⑧ 떨림을 **위험이 아닌 조건 코드**로 두었다 — Design 은 "땅이 떤다(소란과 다른 값 · 탄생지
   고유)" 라고만 한다. 몸에 아무 일도 하지 않으므로 hazard 가 아니라 선 자리의 코드로 두었다
   (C019 가 결정면에 준 접촉 코드와 같은 자리).
⑨ 탄생 방식 넷의 코드 이름 — Life §3.2 가 준 그대로다 (`INHERITED` · `ENVIRONMENTAL_BINDING` ·
   `TRANSFORMATION` · `SEPARATION`). 이 세계가 쓰는 것은 하나뿐이나 어휘는 넷 다 선다.
```
