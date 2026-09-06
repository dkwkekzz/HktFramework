# C012 — 캐면 세계가 달라진다

```text
CYCLE          C012
SOURCE         content/roadmap/play/RoomBearsMaterial.md (승인됨)
               — §4 Breath(확보 · 자국) · §5.4 자국 · §5.5 사슬 · §5.7 공유된 고갈 ·
                 §6 Required(W18 · W19 · W20 · W22 · V10 · V11) · 확정 사항 3 · 위임된 결정 D4 ·
                 부록 A.2(채취 결과 · 출현 조건 열)
               content/roadmap/L2-World-Concept.md §4 숲의 생태 사슬 · §6 위험과 보상의 동근원
               C008 (RuleBoundRoom) — Region State 와 **컴파일 결과 위의 State 덧씌움**(W12)이 선례다
SELECTED_FROM  Play §7 Cycle Breakdown 의 둘째 항목 (C012)
확장 Cycle     C011 이 세운 원천 넷 · 흔적의 사다리 · 채취 위에 **얹는다**.
               C011 의 Semantic/Rule 을 다시 쓰지 않는다 (원본 §18)
```

## Playable Goal

관찰자가 원천을 정해진 횟수만큼 캐면 그것이 **고갈되고, 그 자국이 세계에 남는다** — 외형이 바뀌고,
둘레 흙이 옅어지고, 무너진 노두는 지나갈 수 없다. 두 번째 관찰자가 같은 자국을 보고, 세계를 껐다 켜도
그대로다. 그리고 뿌리혹을 캔 자리에는 **되돌아옴이 멎었다**는 표시가 붙는다.

## Experience Intent

```text
Start   캐는 것은 가져가는 것이다. 손에 무언가 들어오고 세계는 그대로다.
End     캐는 것은 **세계를 바꾸는 것**이다. 내가 지나간 자리는 남고, 다음 사람은 그것을 보고
        "이미 훑은 자리" 를 읽는다. 무너진 노두는 길까지 바꾼다.
        그리고 하나를 캐면 다른 하나가 멎는다 — 이것들이 서로 이어져 있다.
```

## World Change

1. 원천마다 **캘 수 있는 횟수**가 있다 (D4). 다 캐면 `phase: available → depleted` 다.
2. 그 phase 는 **저장되는 세계의 State** 다 — 방의 State 에 남고 스냅샷에 실린다.
   관찰자가 나가도, 세계를 껐다 켜도 그대로다.
3. 고갈이 세계에 넷을 한다.
   ① **외형** — 무너진 노두 · 터진 뿌리혹 · 흩어진 무더기 · 헐린 더미 (A.2)
   ② **흔적** — 그 원천 둘레의 흙 변색이 한 단계 옅어진다
   ③ **통행** — 노두는 무너져 구덩이가 되고 **그 자리를 지날 수 없다**.
      땅을 다시 만들지 않는다 — 컴파일 결과 위에 State 가 덧씌워진다 (C008 W12 와 같은 형)
   ④ **의존** — 그 원천이 먹이던 다음 것에 "되돌아옴이 멎었다"(`recovery-stalled`)가 붙는다
4. 고갈된 원천은 다시 캘 수 없다 — 거절 사유 `source-depleted`.

## Observable Result

1. 원천을 정해진 횟수만큼 캐면 그림이 바뀌고 채취가 더 이상 가용하지 않다 (사유가 판에 뜬다).
2. 캐고 난 자리의 흙이 캐기 전보다 옅다 — 방 바닥과 견주어 보인다.
3. 무너진 노두 자리로 걸어가면 거절되고 사유가 **걸어가기 전에** 판에서 읽힌다 (지목).
4. 뿌리혹을 캐고 나면 노두를 지목했을 때 "되돌아옴이 멎었다" 가 그 자리에 선다.
5. 두 번째 관찰자가 같은 방에 들어오면 **같은 자국**을 본다.
6. 세계를 저장하고 되살려도 자국이 그대로다.
7. 캐지 않은 원천 셋과 백왕령은 한 값도 달라지지 않는다.

## Reuse

```text
Existing (그대로 쓴다)
  C011 전부 — 원천 넷 · resourceEcology · 흔적 사다리 · 채취(RULE-MINE-001 / -COMPLETE-001) ·
              RULE-RESOURCE-PLACEMENT-001 · RULE-TRACE-STRENGTH-001 · entities.material
  C008 — Region State(저장된다) · **컴파일 결과 위의 State 덧씌움**(isClosedPassageAt 이 선례) ·
         거절 사유가 요청의 대답으로 흐르는 길
  C010 — 세계는 하나다 (관찰자 둘이 같은 값을 본다 · 떠나도 남는다) · 세계 영속
  C026~C028 — 자리·존재 지목 · 늘 떠 있는 판 · 그 대상이 주는 행동과 불가 사유 · 답이 남는다
  RULE-MOVE-001 의 전제(요청 판정) · SceneGroundZone · 다중 관찰자 · 개발 명령 표면
Added
  Data      각 원천의 `harvests`(D4) · `collapses`(노두만) · `dependsOn`(노두 ← 뿌리혹) ·
            `traceOp`(그 원천 둘레의 흔적 op) · 노두의 붕괴 area 하나
  World     방의 State 가 규칙과 원천 둘을 함께 든다 — sources[id] = { phase · taken } ·
            고갈 전이 · 붕괴 자리 판정 · 의존 조건 평가
  Protocol  entities[].conditions — 그 원천에 지금 걸린 조건 코드들
  View      고갈된 원천의 그림 넷 · 옅어진 흔적 · 문구(collapsed · source-depleted · recovery-stalled)
Engine
  없음 — C011 과 같다 (Play E12). 덧씌움도 자리 판정도 이미 있는 tagsAt 으로 성립한다
```

## Out of Scope

```text
회복 — 고갈된 것이 되돌아오는 일 · Supply Mode 의 진행 · MIGRATORY 의 자리 이동 · 뿌리 곡선   → C013
  그래서 이 Cycle 의 `recovery-stalled` 는 **멎었다는 표시**일 뿐 아무것도 늦추지 않는다.
  무엇이 늦어지는지는 되돌아옴이 서는 C013 이 보인다 (Play §5.5 의 장면이 그때 닫힌다)
NEST_FUNGUS(둥지의 균류) · RIVER_SILT · LAKE_SILT_BED · Resource Flow · 조건부 주기          → C014
  뿌리혹이 매달린 의존(분해된 흙)도 그 원천이 서는 C014 의 것이다 — 이 Cycle 이 세우는 의존은
  Design 이 §5.5 · A.2 로 준 **뿌리혹 → 노두** 한 줄뿐이다
고갈된 자리를 관찰자가 **기억**하는 것 (지도 · 표식 · 방문 기록)                              → 3층 지식
재료의 쓰임                                                                                  → 4층 이후
```

## SPEC

```text
SPEC-001  캘 수 있는 횟수가 정해져 있다
          조건  원천 하나를 정해진 횟수(D4)만큼 캔다
          기대  그 횟수만큼은 재료가 손에 들어오고, 그 방의 State 에 taken 이 그만큼 오른다
          경계  마지막 한 번까지는 phase 가 available 이다 — 미리 고갈되지 않는다

SPEC-002  다 캐면 고갈된다
          조건  마지막 한 번을 캔다
          기대  그 원천의 phase 가 depleted 가 되고, 관찰 결과의 state 가 그것을 말한다
          경계  캐지 않은 다른 원천 셋의 phase 는 그대로 available 이다

SPEC-003  고갈된 원천은 다시 캘 수 없다
          조건  고갈된 원천에 채취를 건다
          기대  거절되고 사유가 source-depleted 다. 소지품은 늘지 않는다
          경계  같은 사유가 요청 전에도 읽힌다 — interaction 의 available 이 거짓이고 reason 이 실린다

SPEC-004  자국 ① 외형이 바뀐다
          조건  원천 넷을 각각 고갈시킨다
          기대  네 자연 형태 저마다 available 과 depleted 가 **다른 그림**이다
          경계  고갈되지 않은 원천의 그림은 한 픽셀도 바뀌지 않는다

SPEC-005  자국 ② 둘레 흙이 옅어진다
          조건  원천 하나를 고갈시킨 뒤 그 둘레 자리의 흔적 세기를 잰다
          기대  캐기 전보다 **한 단계** 옅다
          경계  그 방의 바닥 흔적과 다른 원천 둘레는 달라지지 않는다

SPEC-006  자국 ③ 무너진 노두는 지날 수 없다
          조건  ORE_OUTCROP 을 고갈시킨 뒤 그 자리로 이동을 건다
          기대  거절되고 사유가 collapsed 다
          경계  ① 고갈 전에는 지날 수 있다  ② 노두 말고 셋(허물 · 더미 · 뿌리혹)은 고갈돼도
                통행을 막지 않는다  ③ 컴파일 결과(높이 · 표면 · traversable 격자)는 한 값도
                바뀌지 않는다 — 덧씌움이지 재컴파일이 아니다

SPEC-007  자국 ④ 하나를 캐면 다음 것이 멎는다
          조건  ROOT_NODULE 을 고갈시킨다
          기대  ORE_OUTCROP 의 관찰 결과에 조건 코드 recovery-stalled 가 실린다
          경계  ① 노두를 캘 수 있는지는 달라지지 않는다 (되돌아올 것이 아직 없다 — Out of Scope)
                ② 뿌리혹이 available 인 동안에는 그 코드가 실리지 않는다

SPEC-008  자국은 세계에 하나다
          조건  관찰자 A 가 고갈시킨 뒤 관찰자 B 가 같은 방을 본다
          기대  B 의 관찰 결과에서 phase · 외형 · 통행 거절이 A 의 것과 같다
          경계  손에 든 재료는 A 의 것뿐이다 — B 의 HUD 에는 실리지 않는다 (C010 그대로)

SPEC-009  자국은 세계를 껐다 켜도 남는다
          조건  고갈시킨 뒤 저장하고 되살린다
          기대  phase 와 taken 이 그대로이고 통행 거절도 그대로다
          경계  STATE_VERSION 이 오르므로 옛 스냅샷은 복구되지 않는다

SPEC-010  건드리지 않은 것은 그대로다
          조건  숲에서 캔 뒤 백왕령과 다른 방들을 본다
          기대  백왕령에는 여전히 원천도 흙 변색도 없고, 능선 · 강 · 다리 · 도시 · 조건 셋이 그대로다
          경계  다른 방의 자국은 관찰 결과에 실리지 않는다 (관찰은 방으로 잘린다)
```

## State

이 Cycle 이 **저장되는 State 를 처음으로 원천에 준다.** C011 의 원천은 데이터에서 유도되는 사실이었고,
지금부터는 그 위에 "세계가 겪은 일" 이 얹힌다 — C008 이 방의 통로에 한 것과 같은 갈래다.

```text
World.RegionStates[regionId]          방 하나가 기억하는 것. 규칙과 원천을 **함께** 든다
  .rule?                              C008 의 것 — pattern · pressure · rearrangedAt.
                                      규칙 없는 방에는 없다 (C008 SPEC-007 경계 그대로)
  .sources?[sourceId]                 C012 ADDED — 원천 없는 방에는 없다
     .phase                           'available' | 'depleted'
     .taken                           몇 번 캤는가 (0 부터)

유도되는 것 (저장되지 않는다)
  붕괴한 자리인가        그 자리를 덮은 resource area 의 태그가 depleted 인 원천이고, 그 원천이
                       무너지는 것으로 밝혀져 있으면 참 (컴파일 결과 위의 덧씌움 — C008 의 형)
  흔적 세기             C011 의 사다리에서, 고갈된 원천의 traceOp 는 한 단계 낮게 친다
  걸린 조건             그 원천이 매달린 원천이 depleted 이면 recovery-stalled
```

`STATE_VERSION` 은 `hkt-adv-proto-i/4` → `hkt-adv-proto-i/5`. 방의 State 형태가 바뀌므로
옛 스냅샷은 복구되지 않는다.

### 데이터 값 (content/regions)

채취 단위는 위임된 결정 **D4** 의 표 그대로다. 나머지 셋은 A.2 의 줄에서 온다.

```text
원천           harvests(D4)   무너지는가(A.2 채취 결과)          매달린 원천(A.2 · §5.5)
MOLT_LITTER    3              아니오 (무더기가 흩어진다)          —
RUIN_SPOIL     2              아니오 (더미가 헐린다)              —
ORE_OUTCROP    3              **예 — 무너져 구덩이**              ROOT_NODULE (거목의 축적)
ROOT_NODULE    1              아니오 (터진 자국)                  — (분해된 흙 = NEST_FUNGUS 는 C014)

그 원천 둘레의 흔적 op (C011 이 놓은 것 — 새로 놓지 않는다)
MOLT_LITTER → trace-edge-molt · RUIN_SPOIL → trace-ruin-spoil ·
ORE_OUTCROP → trace-ore-outcrop · ROOT_NODULE → trace-tree-nodule

노두의 붕괴 자리   BIO_ORE_FIELD 의 resource layer area(circle · 중심 (8, -6) · 반경 2) 하나
```

## Rule

```text
R1  CHANGED  RULE-MINE-001 — 고갈된 원천은 캘 수 없다
    IF  대상 원천의 phase 가 depleted
    THEN 거절 source-depleted
    (곡괭이 · 거리 · 방 · 행동 대체 가능은 C011 그대로다)

R2  CHANGED  RULE-MINE-COMPLETE-001 — 캔 것이 세계에 자국을 남긴다
    IF  채취 행동이 Duration 을 채웠고 대상 원천의 phase 가 available
    THEN Inventory.Items[material] += 1 · sources[id].taken += 1 ·
         taken 이 harvests 에 이르면 phase = depleted
    경계  이 전이 말고는 아무것도 세계를 바꾸지 않는다 — 나머지 셋(외형 · 흔적 · 통행)은
          전부 이 phase 에서 **유도된다** (State 를 세 벌로 만들지 않는다)

R3  ADDED    RULE-SOURCE-COLLAPSE-001 — 무너진 노두가 몸을 막는다
    IF  그 자리를 덮은 resource area 의 원천이 depleted 이고 무너지는 것으로 밝혀져 있다
    THEN 그 자리는 지날 수 없다 (사유 collapsed)
    경계  컴파일 결과는 한 값도 바뀌지 않는다 — 덧씌움이다 (C008 R3 과 같은 규율)

R4  CHANGED  RULE-MOVE-001 — 이동의 전제에 붕괴가 더해진다
    IF  목적지가 붕괴한 자리
    THEN 거절 collapsed
    (기존 전제 — extent · traversable · 닫힌 통로 — 는 그대로다)

R5  CHANGED  RULE-TRACE-STRENGTH-001 — 고갈이 흔적을 옅게 한다
    IF  그 자리를 덮은 흔적 area 가 고갈된 원천의 traceOp 다
    THEN 그 area 의 단계를 1 낮춰 친다 (0 아래로는 내려가지 않는다)
    경계  겹치면 여전히 가장 큰 쪽이 이긴다 (C011 R4 그대로 — 합하지 않는다)

R6  ADDED    RULE-SOURCE-CONDITION-001 — 매달린 것이 고갈되면 멎는다
    IF  원천 X 가 원천 Y 에 매달려 있고 Y 의 phase 가 depleted
    THEN X 에 조건 코드 recovery-stalled 가 걸린다
    경계  걸린다고 해서 X 를 캘 수 없는 것은 아니다 (되돌아올 것이 아직 없다)

R7  AFFECTED RULE-OBSERVE-PROJECTION — 원천의 phase 와 걸린 조건이 실린다.
             관찰은 여전히 방으로 잘린다

R8  AFFECTED RULE-QUIET-GROUND-001 — 고갈된 원천에도 세계 위 글자는 없다.
             "이미 캐 간 자리" 는 그림과 흙이 말하고, 이름은 물었을 때 판이 답한다
```

## REUSED / ADDED / CHANGED / AFFECTED

```text
REUSED    RULE-RESOURCE-PLACEMENT-001 · RULE-ACTION-BEGIN-001 · RULE-ACTION-PROGRESS-001 ·
          RULE-TERRAIN-COMPILE-001 · RULE-MAZE-CONNECTION-001 · RULE-PLACE-READING-001 ·
          RULE-BEING-READING-001 · RULE-TARGET-OFFERS-001 · tagsAt · areasOf · 세계 영속
ADDED     RULE-SOURCE-COLLAPSE-001 · RULE-SOURCE-CONDITION-001
CHANGED   RULE-MINE-001 · RULE-MINE-COMPLETE-001 · RULE-MOVE-001 · RULE-TRACE-STRENGTH-001 ·
          World.RegionStates 의 형태 (규칙과 원천을 함께 든다)
AFFECTED  RULE-OBSERVE-PROJECTION · RULE-QUIET-GROUND-001 · 되살리기(STATE_VERSION)
```

## Observable (관찰 계약)

```text
싣는다 (C011 의 자리에 더한다)
  entities[].state          'available' | 'depleted'          ← C011 은 언제나 available 이었다
  entities[].conditions     그 원천에 지금 걸린 조건 코드들 (없으면 자리가 없다)  ← protocol 의 새 자리
  interactions[] mine       available 이 거짓일 때 reason = 'source-depleted'
  요청의 대답               이동 거절의 reason = 'collapsed'

싣지 않는다
  taken(몇 번 캤는가) · harvests(몇 번 캘 수 있는가) · 무엇이 무엇에 매달렸는가 ·
  붕괴한 자리의 모양 · 흔적의 세기 · 다른 방의 원천
  흔적과 붕괴는 **땅과 같은 규율**로 관찰자가 자기 content/regions 와 **실려 온 phase** 로
  스스로 얻는다 (C005~C007 · C011 의 규율 그대로). 그래서 새 자리는 conditions 하나뿐이다
```

## UNRESOLVED

없음.

기본형으로 둔 것 (Human 이 감사할 자리):

```text
① 흔적이 **한 단계** 옅어진다        — Design 은 "옅어진다" 만 말한다 (§5.4 ②). 사다리가 다섯 단계이므로
                                     한 단계를 기본형으로 삼았다. 값은 데이터라 언제든 바꾼다
② 붕괴 자리의 반경 2                 — Design 은 "그 칸" 이라고만 한다. 화면에서 보이고 방을 끊지 않는
                                     크기로 골랐다 (배치 데이터)
③ taken 을 State 에 함께 둔다        — Design 은 phase 만 말한다 (W18). 몇 번 남았는지는 phase 에서
                                     유도되지 않으므로 저장한다. 관찰에는 싣지 않는다
④ 매달린 원천을 `dependsOn` 한 줄로   — Design 의 사슬은 셋을 잇지만(균류 → 뿌리혹 → 노두) 이 Cycle 에
                                     서는 원천 셋 중 둘만 서 있다. 균류 쪽은 C014 가 잇는다
⑤ 고갈된 원천도 **지목되고 판에 선다** — Design 은 "이미 훑은 자리로 읽는다" 만 말한다.
                                     C027 의 지목을 그대로 쓰는 것이 기본형이다
```
