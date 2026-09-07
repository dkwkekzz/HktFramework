# C013 — 세계가 되돌린다

```text
CYCLE          C013
SOURCE         content/roadmap/play/RoomBearsMaterial.md (승인됨)
               — §4 Breath(사슬 · 되돌아옴) · §5.5 사슬 · §5.6 되돌아옴 ·
                 §6 Required(W20 ④ · W21 · W22 · V10 · V11 · V12) ·
                 확정 사항 1 · 9 · 위임된 결정 D3(회복의 시간 규모) · 부록 A.2(회복 원인 열)
               content/roadmap/L2-World-Concept.md §4 숲의 생태 사슬 (고리)
               C012 — 고갈과 `recovery-stalled` 를 세웠다. 그것이 **표시일 뿐**이라고
                      적어 둔 자리를 이 Cycle 이 채운다 (C012 Out of Scope 첫 줄)
SELECTED_FROM  Play §7 Cycle Breakdown 의 셋째 항목 (C013)
확장 Cycle     C011 의 원천 넷 · 흔적 사다리 · 채취와 C012 의 phase · 자국 위에 **얹는다**.
               그 둘의 Semantic/Rule 을 다시 쓰지 않는다 (원본 §18)
```

## Playable Goal

관찰자가 캐서 고갈시킨 원천이 **세계의 과정으로 되돌아온다** — 저마다 다른 길이의 시간이
걸리고, 되돌아오는 중인 것은 눈으로 갈리며, **매달린 원천이 고갈돼 있으면 그 진행이 멎는다.**
그리고 노두는 캔 자리에 다시 나지 않는다 — 뿌리 곡선의 **다음 마디**에 서고 옛 자리는 무너진
채 남는다.

## Experience Intent

```text
Start   캔 자리는 그대로 남는다. 자국은 영구이고 세계는 더 이상 그것을 어떻게 하지 않는다.
End     세계가 그것을 되돌리고 있다. 흙이 짙어지고 뿌리가 부푸는 것이 **예보**여서 미리 가서
        기다린다. 그런데 아래를 캐 놓으면 위가 멎는다 — 고리였다.
        그리고 돌아온 것은 캔 자리가 아니라 뿌리가 뻗은 다음 마디에 서 있다.
```

## World Change

1. 세계 과정 하나가 돈다 — 고갈된 원천마다 **되돌아옴의 진행**이 세계 시간으로 오른다.
   관찰자가 그 방에 없어도, 세계 어디에도 없어도 돈다.
2. 되돌아옴의 길이는 원천마다 다르다 (D3) — 얕은 것은 빨리, 깊은 것은 느리게.
3. phase 가 셋이 된다. `depleted` → (절반) `recovering` → (임계) `available`.
   `recovering` 은 **눈에 보이는 되돌아옴**이다 — 그림이 갈리고 그 자리 흙이 다시 짙어진다.
4. **매달린 원천이 available 이 아니면 진행이 0 이다.** C012 의 `recovery-stalled` 가
   이제 실제로 늦춘다 — 표시가 아니라 원인이다.
5. 자리를 옮기는 원천(MIGRATORY)은 **되돌아옴이 보이기 시작할 때 다음 마디로 옮겨 선다.**
   마디의 목록은 그 방의 presence layer 곡선(뿌리 곡선)이 소유한다.
6. 무너진 마디는 **무너진 채 쌓인다** — 원천이 떠나도 그 자리는 여전히 지날 수 없다.
7. 되돌아온 원천은 다시 캘 수 있다 — 캔 횟수가 0 으로 돌아간다.

## Observable Result

1. 원천을 고갈시키고 기다리면 그림이 두 번 바뀐다 — 바닥난 것 → 되돌아오는 중 → 다시 있는 것.
2. 되돌아오는 중에는 캘 수 없고, 지목하면 그 사유가 그 자리에서 읽힌다.
3. 되돌아오는 중인 원천 둘레의 흙이 **바닥난 동안보다 짙다** — 걸어가기 전에 읽히는 예보다.
4. 뿌리혹을 캐 놓으면 노두가 아무리 기다려도 되돌아오지 않고, 지목하면 "되돌아옴이 멎었다"
   가 그 자리에 서 있다. 뿌리혹이 스스로 되돌아온 뒤에야 노두가 다시 진행한다.
5. 되돌아온 노두는 **다른 자리**에 서 있다 — 땅 위의 뿌리 선을 따라 다음 마디다.
6. 옛 자리는 여전히 구덩이이고 걸어가면 거절된다 — 원천이 거기 없는데도 그대로다.
7. 원천 넷의 되돌아옴이 저마다 다른 때에 온다 (허물이 가장 빠르고 핵심부가 가장 느리다).
8. 두 번째 관찰자가 같은 진행을 보고, 세계를 껐다 켜도 이어진다.
9. 백왕령과 미로는 한 값도 달라지지 않는다.

## Reuse

```text
Existing (그대로 쓴다)
  C011 전부 — 원천 넷 · resourceEcology · 흔적 사다리 · 채취 · entities.material
  C012 전부 — phase · taken · 자국 넷 · sourcePhases 손잡이 · 고갈된 원천의 그림 넷
  C008 — 방의 State 는 저장된다 · 세계 과정은 몸 없이도 돈다(RULE-MAZE-CONNECTION-001 의 선례) ·
         컴파일 결과 위의 State 덧씌움
  C010 — 세계는 하나다 (관찰자 둘이 같은 값을 본다) · 세계 영속
  C026~C028 — 지목 · 대상 프레임 · 답이 남는다
  RULE-WORLD-TICK-001 의 systems 배열 (세계 과정이 붙는 자리)
Added
  Data      각 원천의 `recoverySeconds`(D3) · `traceOps`(마디마다의 둘레 흔적) ·
            `collapseOps`(마디마다의 붕괴 자리) · BIO_ORE_FIELD 의 뿌리 곡선(presence/root)과
            마디 넷 · RED_EYE_TREE 의 뿌리 곡선
  World     원천 State 에 progress · siteIndex · collapsedSites · 회복 세계 과정 하나 ·
            자리 이동 · 되돌아오는 중에는 캘 수 없다
  Protocol  entities[].siteIndex · entities[].collapsedSites (자리를 옮기는 원천에만)
  View      되돌아오는 중인 원천의 그림 넷 · 문구 둘 · 땅 위의 뿌리 선
Engine
  곡선 하나를 폭만큼 부풀린 다각형 (polyline → strip). 게임 명사가 없는 순수 기구이고,
  이번 사용처(뿌리 선을 지면에 그린다)가 쓰는 만큼만 만든다
```

## Out of Scope

```text
NEST_FUNGUS(둥지의 균류) · RIVER_SILT · LAKE_SILT_BED · Resource Flow · 조건부 주기      → C014
  그래서 **EVENT_SCARCE 는 이 Cycle 이 세우지 않는다** — 그 Mode 를 쓰는 원천(RIVER_SILT)도
  그것을 켜는 사건(물길이 불어남)도 C014 의 것이고, 사용처 없는 갈래를 미리 만들지 않는다.
  Play §5.6 의 넷 가운데 이 Cycle 이 실제로 굴리는 것은 셋이다
  (BASELINE_RENEWABLE · CONDITIONAL_RENEWABLE · MIGRATORY).
  뿌리혹이 매달릴 분해된 흙(NEST_FUNGUS)도 같은 이유로 C014 가 잇는다 — 이 Cycle 이
  굴리는 의존은 C012 가 놓은 **뿌리혹 → 노두** 한 줄뿐이다
검사 ⑩~㉒ · 요약 ⑲⑳ · world:observe --report                                          → C014
언제 돌아오는지 세계가 말해 주는 것 (남은 시간 · 진행률 · 마디 목록)                     → 싣지 않는다 (아래 Observable)
회복이 무엇으로 도는가를 바꾸는 새 세계 과정 (계절 · 날씨)                                → 새 Cycle (Play 불변 조건)
재료의 쓰임                                                                              → 4층 이후
```

## SPEC

```text
SPEC-001  고갈된 원천이 세계의 과정으로 되돌아온다
          조건  원천 하나를 고갈시키고 그 원천의 recoverySeconds 만큼 세계를 진행시킨다
          기대  phase 가 available 로 돌아오고 taken 이 0 이며 다시 캘 수 있다
          경계  임계에 이르기 전에는 available 이 아니다 — 미리 돌아오지 않는다

SPEC-002  되돌아옴의 길이는 원천마다 다르다
          조건  원천 넷을 모두 고갈시키고 세계를 진행시킨다
          기대  각 원천은 자기 recoverySeconds 에 이르러서야 돌아온다.
                허물(가장 짧다)이 핵심부 둘(가장 길다)보다 먼저 돌아온다
          경계  한 원천이 돌아왔다고 다른 원천이 함께 돌아오지 않는다

SPEC-003  되돌아오는 중이 눈에 보인다
          조건  고갈시킨 뒤 recoverySeconds 의 절반을 넘긴다
          기대  phase 가 recovering 이고 관찰 결과의 state 가 그것을 말한다.
                형태 넷 저마다 available · depleted · recovering 셋이 **다른 그림**이다
          경계  되돌아오는 중에는 캘 수 없다 — 거절되고 사유가 그 자리에서 읽힌다.
                소지품은 늘지 않는다

SPEC-004  되돌아오는 중이면 그 자리 흙이 다시 짙어진다
          조건  같은 자리의 흔적 세기를 depleted 일 때와 recovering 일 때 잰다
          기대  recovering 이 depleted 보다 짙고, 캐기 전(available)과 같다 — 예보다
          경계  ① 방 바닥 흔적은 한 값도 바뀌지 않는다
                ② 다른 원천 둘레도 바뀌지 않는다

SPEC-005  매달린 것이 available 이 아니면 진행이 멎는다
          조건  뿌리혹과 노두를 함께 고갈시키고 노두의 recoverySeconds 를 훌쩍 넘겨 진행시킨다
          기대  노두의 진행이 오르지 않아 돌아오지 않고, 관찰 결과에 recovery-stalled 가 실린다
          경계  ① 뿌리혹은 매달린 것이 없으므로 제 길이대로 돌아온다
                ② 뿌리혹이 돌아온 뒤부터 노두의 진행이 다시 오르고 결국 돌아온다
                ③ 매달린 것이 available 인 동안에는 그 코드가 실리지 않는다

SPEC-006  자리를 옮기는 원천은 다음 마디에 선다
          조건  노두를 고갈시키고 되돌아오는 중이 될 때까지 진행시킨다
          기대  그 원천의 자리가 뿌리 곡선의 **다음 마디**로 옮겨 있고, 관찰 결과의 position 이
                그 마디다. 돌아온 뒤에도 그 자리다
          경계  ① 자리를 옮기지 않는 원천 셋은 한 값도 자리가 바뀌지 않는다
                ② 무너진 마디는 건너뛴다 — 되돌아온 원천이 지날 수 없는 자리에 서지 않는다

SPEC-007  옛 자리는 무너진 채 쌓인다
          조건  노두를 고갈시켜 무너뜨리고, 되돌아와 다음 마디에 선 뒤 옛 자리로 이동을 건다
          기대  거절되고 사유가 collapsed 다 — 원천이 거기 없는데도 그대로다
          경계  ① 아직 고갈된 적 없는 마디는 지날 수 있다
                ② 컴파일 결과(높이 · 표면 · traversable 격자)는 한 값도 바뀌지 않는다
                ③ 무너지지 않는 원천 셋은 몇 번을 돌아도 통행을 막지 않는다

SPEC-008  되돌아옴은 관찰자 없이도 돌고 세계에 하나다
          조건  관찰자 A 가 고갈시킨 뒤 그 방을 떠나 기다리고, 관찰자 B 가 그 방에 들어온다
          기대  진행은 그동안에도 올랐고, A 와 B 의 관찰 결과에서 phase · 자리 · 무너진 자리가 같다
          경계  손에 든 재료는 각자의 것이다

SPEC-009  되돌아옴은 세계를 껐다 켜도 이어진다
          조건  진행 도중에 저장하고 되살린 뒤 남은 만큼 진행시킨다
          기대  phase · progress · 자리 · 무너진 자리가 그대로이고, 남은 시간만큼 뒤에 돌아온다
          경계  STATE_VERSION 이 오르므로 옛 스냅샷은 복구되지 않는다

SPEC-010  건드리지 않은 것은 그대로다
          조건  숲에서 캐고 되돌아옴이 도는 동안 백왕령과 미로를 본다
          기대  백왕령에는 여전히 원천도 흙 변색도 없고, 미로의 규칙(패턴 · 압력)도 그대로 돈다
          경계  캐지 않은 원천은 progress 가 오르지 않는다 — 되돌아옴은 고갈된 것의 일이다
```

## State

이 Cycle 은 C012 가 세운 원천 State 위에 **되돌아옴이 겪는 것**을 더한다. 자리 · 성질 ·
recoverySeconds 는 여전히 데이터에서 다시 온다 (content/regions) — 여기 있는 것은 세계가
겪은 일뿐이다.

```text
World.RegionStates[regionId]
  .rule?                              C008 의 것 — 그대로
  .sources?[sourceId]
     .phase                           C013 CHANGED — 'available' | 'depleted' | 'recovering'
     .taken                           C012 의 것 — 되돌아오면 0 으로 돌아간다
     .progress                        C013 ADDED — 되돌아옴이 얼마나 왔는가 (세계 초).
                                      available 이면 언제나 0 이다
     .siteIndex                       C013 ADDED — 지금 선 마디 (기본 0). 마디가 하나뿐인
                                      원천은 언제나 0 이다
     .collapsedSites?                 C013 ADDED — 무너진 채 남은 마디 번호들. 무너지지 않는
                                      원천에는 자리 자체가 없다

유도되는 것 (저장되지 않는다)
  원천의 지금 자리      siteIndex 번째 마디 (마디 목록은 데이터가 소유한다)
  무너진 자리인가        그 자리를 덮은 붕괴 area 의 마디 번호가 collapsedSites 에 있으면 참
  흔적 세기             그 원천의 **지금 마디** 둘레만 센다. depleted 면 한 단계 아래,
                       recovering · available 이면 그대로. 다른 마디의 둘레는 0 이다
  걸린 조건             매달린 원천이 available 이 아니면 recovery-stalled
```

`STATE_VERSION` 은 `hkt-adv-proto-i/5` → `hkt-adv-proto-i/6`.

### 데이터 값 (content/regions)

되돌아옴의 길이는 위임된 결정 **D3** 의 표 그대로다. D4(harvests)가 C012 에서 그랬듯
세계 데이터에 둔다 — Play 불변 조건이 "회복 임계를 바꾼다 → content/regions 의 데이터만"
이라고 못 박았다.

```text
원천           recoverySeconds(D3)   자리를 옮기는가      무너지는가
MOLT_LITTER    60                    아니오               아니오
RUIN_SPOIL     90                    아니오               아니오
ROOT_NODULE    180                   아니오               아니오
ORE_OUTCROP    180                   **예 (MIGRATORY)**   예

뿌리 곡선 (BIO_ORE_FIELD · presence layer · tag `root`) — 노두가 설 수 있는 마디 넷.
  마디 0 (8, -6)  ← C011 이 놓은 자리 그대로
  마디 1 · 2 · 3  ← 방 안의 평지에 흩어 놓는다 (전부 extent 안 · traversable · 출구를 막지 않는다)
  마디마다 둘레 흔적 area 하나(soil-stain:4 · 반지름 7)와 붕괴 area 하나(반지름 2)를 함께 둔다 —
  마디 0 의 것은 C011 · C012 가 이미 놓은 trace-ore-outcrop · collapse-ore-outcrop 이다

뿌리 곡선 (RED_EYE_TREE · presence layer · tag `root`) — 거목에서 광석 지대 쪽으로 뻗는 선.
  뿌리혹은 이 선 위의 마디 하나에 선다. 자리를 옮기지 않으므로 마디는 하나다 (§5.3)
```

## Rule

```text
R1  ADDED    RULE-SOURCE-RECOVERY-001 — 세계가 되돌린다 (세계 과정)
    Scope    모든 방의, phase 가 available 이 아닌 원천 전부
    Trigger  세계의 Tick (dt)
    IF   그 원천에 걸린 조건이 없다 (매달린 원천이 available 이거나 매달린 것이 없다)
    THEN progress += dt
    ELSE progress 는 오르지 않는다
    그리고
      progress ≥ recoverySeconds × RECOVERY_VISIBLE_FRACTION 이고 phase 가 depleted 면
          phase = recovering · 자리를 옮기는 원천이면 siteIndex = **무너지지 않은 다음 마디**
      progress ≥ recoverySeconds 면
          phase = available · taken = 0 · progress = 0
    경계  ① 관찰자와 무관하다 — 몸이 그 방에 없어도, 세계 어디에도 없어도 돈다
          ② 한 Tick 에 두 문턱을 함께 넘을 수 있다 (dt 가 크면). 그래도 자리 이동은 한 번뿐이다
          ③ 무너지지 않은 마디가 하나도 없으면 자리를 옮기지 않는다 (아래 기본형 ③)

R2  CHANGED  RULE-SOURCE-CONDITION-001 — 매달린 것이 **available 이 아니면** 멎는다
    IF  원천 X 가 원천 Y 에 매달려 있고 Y 의 phase 가 available 이 아니다
    THEN X 에 조건 코드 recovery-stalled 가 걸리고 **X 의 진행이 오르지 않는다**
    (C012 는 Y 가 depleted 일 때만 걸었고 아무것도 늦추지 않았다 — 이제 원인이다)
    경계  걸린다고 해서 X 를 캘 수 없는 것은 아니다 (X 가 available 이면 여전히 캔다)

R3  CHANGED  RULE-MINE-001 — 되돌아오는 중인 원천은 캘 수 없다
    IF  대상 원천의 phase 가 recovering
    THEN 거절 source-recovering
    (고갈은 여전히 source-depleted 다. 나머지 전제는 C011 · C012 그대로)

R4  CHANGED  RULE-RESOURCE-PLACEMENT-001 — 자리를 옮기는 원천의 자리는 **마디 + State** 다
    IF  그 원천이 마디 목록(presence 곡선)을 밝혔다
    THEN 자리는 siteIndex 번째 마디다
    ELSE 자리는 C011 그대로 resource layer point 다
    경계  마디 목록도 point 도 없는 원천은 서지 않는다 (C011 R3 경계 그대로)

R5  CHANGED  RULE-SOURCE-COLLAPSE-001 — 무너진 자리는 **마디마다** 쌓인다
    IF  그 자리를 덮은 붕괴 area 의 마디 번호가 그 원천의 collapsedSites 에 있다
    THEN 그 자리는 지날 수 없다 (사유 collapsed)
    (C012 는 "그 원천이 depleted 인가" 로 판정했다 — 원천이 자리를 옮기므로 자리가 기억한다)
    경계  컴파일 결과는 한 값도 바뀌지 않는다 (C012 R3 경계 그대로)

R6  CHANGED  RULE-MINE-COMPLETE-001 — 고갈되는 순간 그 마디가 무너진다
    THEN (C012 그대로) taken += 1 · taken 이 harvests 에 이르면 phase = depleted ·
         **그 원천이 무너지는 것이면 collapsedSites 에 지금 siteIndex 를 더한다**
    경계  이미 있는 마디를 두 번 더하지 않는다

R7  CHANGED  RULE-TRACE-STRENGTH-001 — 둘레 흔적은 **지금 마디**의 것이고 phase 가 정한다
    IF  그 흔적 area 가 어떤 원천의 마디 둘레다
    THEN 그 원천의 지금 마디가 아니면 0 으로 친다.
         지금 마디이면 phase 가 depleted 일 때 한 단계 아래, recovering · available 이면 그대로
    경계  ① 겹치면 여전히 가장 큰 쪽이 이긴다 (합하지 않는다)
          ② 방 바닥에 깔린 흔적은 어느 원천의 둘레도 아니므로 한 값도 바뀌지 않는다
          ③ 마디가 하나뿐인 원천은 C012 와 한 값도 다르지 않다 (지금 마디가 언제나 0)

R8  AFFECTED RULE-OBSERVE-PROJECTION — state 가 셋이 되고, 자리를 옮기는 원천에는
             siteIndex 와 무너진 마디들이 실린다. 관찰은 여전히 방으로 잘린다

R9  AFFECTED RULE-QUIET-GROUND-001 — 되돌아오는 중인 원천에도 세계 위 글자는 없다.
             예보는 흙과 그림이 말하고, 이름과 사유는 물었을 때 판이 답한다

R10 AFFECTED RULE-WORLD-TICK-001 — systems 배열에 세계 과정 하나가 는다.
             자리는 미로의 재배열 곁(세계 과정끼리) 이고 채취의 완료(action-progress)보다
             앞이다 — 같은 Tick 에 캔 것이 곧바로 되돌아오지 않는다
```

## REUSED / ADDED / CHANGED / AFFECTED

```text
REUSED    RULE-ACTION-BEGIN-001 · RULE-ACTION-PROGRESS-001 · RULE-MOVE-001 ·
          RULE-TERRAIN-COMPILE-001 · RULE-MAZE-CONNECTION-001 · RULE-PLACE-READING-001 ·
          RULE-BEING-READING-001 · RULE-TARGET-OFFERS-001 · areasOf · curvesOf · 세계 영속
ADDED     RULE-SOURCE-RECOVERY-001
CHANGED   RULE-SOURCE-CONDITION-001 · RULE-MINE-001 · RULE-MINE-COMPLETE-001 ·
          RULE-RESOURCE-PLACEMENT-001 · RULE-SOURCE-COLLAPSE-001 · RULE-TRACE-STRENGTH-001 ·
          ResourceSourceState 의 형태
AFFECTED  RULE-OBSERVE-PROJECTION · RULE-QUIET-GROUND-001 · RULE-WORLD-TICK-001 ·
          되살리기(STATE_VERSION)
```

## Observable (관찰 계약)

```text
싣는다 (C012 의 자리에 더한다)
  entities[].state          'available' | 'depleted' | 'recovering'   ← 셋이 되었다
  entities[].position       그 원천의 **지금 자리** — 자리를 옮기면 이 값이 옮겨 간다 (이미 있는 자리)
  entities[].siteIndex      지금 선 마디 번호 — 마디를 여럿 가진 원천에만                ← 새 자리
  entities[].collapsedSites 무너진 채 남은 마디 번호들 — 무너진 것이 있는 원천에만        ← 새 자리
  interactions[] mine       available 이 거짓일 때 reason = 'source-recovering'          ← 새 코드
  entities[].conditions     C012 그대로 — recovery-stalled

싣지 않는다
  progress(얼마나 왔는가) · recoverySeconds(얼마나 걸리는가) · 남은 시간 · 마디 목록과 그 좌표 ·
  무엇이 무엇에 매달렸는가 · 흔적의 세기 · 무너진 자리의 모양 · 다른 방의 원천
  **언제 돌아오는지 세계는 말하지 않는다** — 관찰자는 흙과 그림으로 그것을 읽는다 (§5.6 예보).
  마디의 자리는 관찰자가 자기 content/regions 의 뿌리 곡선에서 번호로 얻는다
  (땅과 흔적과 붕괴를 스스로 얻는 C005~C007 · C011 · C012 의 규율 그대로)
```

## UNRESOLVED

없음.

기본형으로 둔 것 (Human 이 감사할 자리):

```text
① 되돌아옴이 **절반**에서 눈에 보이기 시작한다   — Design 은 phase 셋(RECOVERING → AVAILABLE)만
   (RECOVERY_VISIBLE_FRACTION = 0.5 · 헤더 상수)   말하고 언제 보이기 시작하는지는 말하지 않는다.
                                                 절반은 예보가 예보일 만큼 이르고, 자리 이동이
                                                 곧바로 일어나지 않을 만큼 늦은 값이다
② 자리 이동이 **recovering 으로 넘어갈 때** 일어난다 — Design 은 "RECOVERING → AVAILABLE 로
                                                 돌아오되 다음 마디에 선다" 고만 한다. 돌아온
                                                 순간 옮기면 §5.6 의 "흔적을 읽고 미리 가서
                                                 기다린다" 가 성립할 수 없다 — 예보가 서려면
                                                 자리가 먼저 서야 한다
③ 무너지지 않은 **다음** 마디로 옮긴다. 하나도 없으면 옮기지 않는다 — Design 은 마디가 다
   무너진 경우를 말하지 않는다. 마디 넷과 harvests 3 이면 먼 이야기이고, 그때 세계는 그렇게
   되었다는 것이 답이다 (지나갈 수 없는 자리에 선 원천)
④ 되돌아오는 중의 거절 사유를 `source-recovering` 이라 부른다 — Design 은 "되돌아와야 캘 수
   있다" 는 사실만 준다. 코드 이름은 구현이고, 문구는 view 의 표가 옮긴다
⑤ 마디 넷 · 마디마다 흔적 반지름 7 · 붕괴 반지름 2 — Design 은 "뿌리 곡선의 다음 마디" 라고만
   한다. 값은 배치 데이터이고 C011 · C012 가 마디 0 에 쓴 값을 그대로 이어 쓴다
⑥ 되돌아온 원천의 taken 이 0 으로 돌아간다 — Design 은 "AVAILABLE 로 돌아온다" 고만 한다.
   돌아왔는데 캘 수 없으면 돌아온 것이 아니다
⑦ EVENT_SCARCE 는 이 Cycle 이 세우지 않는다 — 위 Out of Scope 참조. Play §5.6 의 넷 가운데
   셋만 굴린다
```
