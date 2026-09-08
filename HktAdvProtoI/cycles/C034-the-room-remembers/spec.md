# C034 — 방이 기억한다

```text
CYCLE          C034 — RegionState.history · 셈을 올리는 한 자리 · 수명 표 · 판의 「기억」 줄 · 검사 ㊸ ㊼
SOURCE         content/roadmap/play/RoomRemembersAndOffers.md (§2 완료 확인 ① ② · §4 셈 · 잊힘의 부재 ·
               남은 것 · §5.1 · §5.2 · §6 W53 · W54 · W58 절반 · V26 · E23 절반 · 확정 3 · 4)
               content/roadmap/L2-World-Foundation.md G7 · G8 · §4.3 기억 · §4.4 수명 표 ·
               §5.2 ㊸ ㊼ · §10 D4 · D5 · §3.1 Persistence 행
               content/roadmap/L1-World-Grammar.md §1 저장과 유도
               루트 TODO.md §4 — C034 가 받는 줄 없음 (§4 는 Life 와 도구 레인의 것이다)
SELECTED_FROM  Play §7 Cycle Breakdown 의 첫째 항목 (C034 — 이 Play 의 셋 중 첫)
확장            C012 · C013 의 원천 State, C016 의 뒤척임, C017 의 소란, C018 의 경로,
               C026~C028 의 판 위에 **더한다** — 그 spec 들의 Semantic/Rule 을 복사하지 않고
               이름으로 인용한다
```

## Playable Goal

**숲 가장자리의 허물(MOLT_LITTER)을 세 번 캐 고갈시키고 되돌아옴을 기다린 뒤 그 원천을 지목하면,
캘 횟수는 0 으로 돌아왔는데 판의 「기억」 줄이 "세 번 캐였다 · 마지막 고갈 N초 전" 을 말한다.**
뒤척임이 발자국과 캔 자국을 묻어도 그 줄은 한 값도 달라지지 않고, 내 자리의 판은
"뒤척임 N번 · 깨어남 N번 · 고래가 N번 지났다 (마지막 N초 전)" 을 말한다. 세계를 저장하고
되살려도 그 셈은 그대로다.

## Experience Intent

```text
Start  방은 지금만 있다. 캐면 자국이 남지만 되돌아오면 없던 일이고, 뒤척임이 지나면 발자국도 없다.
       세계는 내가 한 일을 잊는다.
End    방은 센다. 세 번 캤다는 것을, 뒤척임이 두 번 지났다는 것을, 고래가 한 번 지났다는 것을 —
       누가 했는지는 세지 않는다. 묻히는 것과 남는 것이 다르다.
```

Play §4 Breath 의 **셈 → 잊힘의 부재**와 마지막 마디 **남은 것**이다. 기다림 · 때 · 내밈 · 닫힘은
C035 · C036 의 것이다.

## World Change

1. **방이 자기에게 일어난 일을 센다** — `RegionState.history` 가 선다. 항목은 다섯(D4):
   원천마다 캐인 횟수 누계 · 고갈된 횟수 · 마지막 고갈 시각, 방마다 뒤척임 횟수 ·
   깨어난 횟수와 마지막 시각 · 지나간 것마다 횟수와 마지막 시각.
2. **셈은 조건 없이 오른다** — 관찰자가 있든 없든, 어느 철이든, 어느 방이든 센다. 셈이
   무엇을 판정하지도 않는다 (읽는 조건은 C035 의 것이다).
3. **올리는 일은 한 자리가 한다** — 다섯 자리(채취 완료 · 고갈 · 뒤척임 · 깨어남 · 경로 통과)가
   그 한 자리를 부른다 (`addDisturbance` 의 선례).
4. **누가 했는지는 세지 않는다** — 관찰자의 이름도 수도 실리지 않는다 (T2.7 의 규율 그대로).
   방이 세는 것은 **우리**가 한 일이다.
5. **되돌아옴이 셈을 지우지 않는다** — `taken` 이 0 으로 돌아가도 `takenTotal` 은 남는다.
   그것이 지금 세계에서 처음으로 **지워지지 않는 것**이다 (G7 의 다섯째 칸).
6. **뒤척임은 자국을 묻고 셈은 못 묻는다** (확정 4 · D5) — 같은 순간이 발자국을 지우고 캔 자국을
   처음으로 되돌리면서 `turns` 를 하나 올린다.
7. **세계에 남는다** — 스냅샷에 실리고 `STATE_VERSION` 이 오른다. 되살린 세계도 같은 셈을 가진다.
8. **State 마다 지우는 손이 적힌다** — 지금 있는 State 필드 전부에 "무엇이 그것을 지우는가" 가
   다섯 중 하나로 적히고, 검사가 그 표를 보고한다 (G7 · §4.4).
9. **지목하면 셈이 읽힌다** — 판에 「기억」 줄 하나. 세계 위에 뜨는 글자는 늘지 않는다.

## Observable Result

1. 숲 가장자리 허물을 세 번 캐면 고갈된다 — 지목한 판의 「기억」 줄이 "세 번 캐였다 ·
   방금 고갈되었다" 를 말한다.
2. 60 세계 초를 기다려 되돌아온 뒤 다시 지목하면 원천은 캘 수 있는데(캘 횟수 0) 「기억」 줄은
   "세 번 캐였다 · 마지막 고갈 N초 전" 그대로다.
3. 뒤척임이 지나면 발자국이 사라지고 캔 자국이 처음으로 돌아가는데 「기억」 줄은 그대로다.
4. 내 자리를 지목한 판(기본 제목 「내가 선 자리」)에 뒤척임 · 깨어남 · 지나감의 셈이 선다 —
   한 번도 없던 것은 서지 않는다.
5. 고래가 숲 가장자리를 지나면 그 방의 지나감이 하나 오르고, 그 마디에 서 있지 않아도 오른다.
6. 세계를 저장하고 되살려도 위의 셈이 전부 그대로다. 옛 판(`hkt-adv-proto-i/10`)은 되살아나지 않는다.
7. `npm run world:check` 가 ㊸ 를 통과로, ㊼ 를 보고로 적는다 — 방마다의 기억 크기와
   State 필드별 지우는 손이 한 표에 선다.
8. 원천의 phase · 되돌아옴 · 소란 · 자국 · 위상 · 문의 열림 · 거절 사유 · 방 열셋의 땅이
   한 값도 달라지지 않는다.

## Reuse

```text
Existing (그대로 쓴다 · 이름만 인용한다)
  RULE-MINE-COMPLETE-001 (채취 완료 · taken) · RULE-SOURCE-RECOVERY-001 (되돌아옴) ·
  RULE-SOURCE-REGROWN-001 · RULE-SEASON-TURN-001 (뒤척임 · burySigns) ·
  RULE-DISTURBANCE-PHASE-001 (깨어남) · RULE-PRESENCE-PASS-001 (경로가 방을 지난다) ·
  RULE-OBSERVE-PROJECTION (투영) · RULE-TRACK-FADE-001
  스냅샷 · STATE_VERSION · restoreWorld (C001 · C008 · C012)
  판 · 지목 · 대상 프레임 · 기록 (C026~C028) · 나이 어법 "N초 전" (C028)
  검사 마흔셋과 그 입력 계약 (T1 · C014 · C018 · C022 · C029 · C030)
  세계 시각 (C015) · HKT_CLOCK · HKT_SOURCE_PHASE · HKT_PRESENCE · HKT_DISTURBANCE

Added — World (content/world)
  RegionState.history                기억 — §4.3 의 다섯 항목
  RULE-REGION-MEMORY-001             셈을 올리는 한 자리
  PERSISTENCE_TABLE                  State 경로마다 지우는 손 하나 (§4.4 · 검사 ㊼ 의 입력)
  RULE-OBSERVE-MEMORY-001            지목한 원천과 선 방의 기억이 관찰에 실린다

Added — Protocol (content/protocol)
  대상 프레임의 원천 기억 (takenTotal · depletedTimes · lastDepletedAt)
  방의 기억 (turns · awakenings · passages) — 시각만 싣고 나이는 싣지 않는다

Added — View (content/view)
  판의 「기억」 줄 — 원천의 것과 선 방의 것 · 문구는 code-text

Added — Engine (engine/world-authoring)
  CheckHistory                       방마다 기억이 가질 키 (원천 · 경로) · 수명 표
  ㊸ history-refs · ㊼ persistence-summary
```

## Out of Scope

```text
Condition 형과 평가기 · 조건 자리 넷의 한 형 읽기 · 기억을 읽는 첫 조건 · 검사 ㊹     C035
Opportunity 형 · 첫 기회(비늘) · 「할 수 있는 것」 줄의 출처 · Mutation op 표 대조 ·
  검사 ㊺ ㊻ · 기회 표 · T2 열셋째 답 · T4 결정 나무                                  C036
history.births (탄생 횟수)                                                          Life 가 선 뒤 (§4.3 에 자리만)
기억의 상한 · 오래된 것을 버리는 규칙                                                두지 않는다 (확정 3 "상한 없음")
누가 했는가 (관찰자별 셈)                                                            두지 않는다 (확정 3 · T2.7)
Player Knowledge · 발견 상태 다섯                                                    3층 (G10)
Region 자체 성장 · Object 류                                                         빈칸 3 · 컨텐츠 행
```

## SPEC

```text
SPEC-001  방이 센다 — 셈은 조건 없이 오른다
  다섯 자리가 한 자리를 불러 셈을 올린다: 채취 완료 · 고갈 · 뒤척임 · 깨어남 · 경로 통과.
  경계 ① 관찰자가 그 방에 없어도 오른다 (뒤척임 · 깨어남 · 지나감은 아무도 없어도 도는 것이다).
  경계 ② 누가 했는지는 어디에도 없다 — 관찰자가 둘이어도 셈은 하나다.
  경계 ③ 아무 일도 없던 방의 기억은 비어 있다 (셈 0 · 시각 없음). 자리가 있는 것과 값이
         찬 것이 다르다.

SPEC-002  되돌아옴이 셈을 지우지 않는다
  세 번 캐 고갈된 원천이 되돌아와 taken 0 · phase available 인데 takenTotal 3 ·
  depletedTimes 1 · lastDepletedAt 은 고갈된 그 세계 시각이다.
  경계 ① 되돌아오는 도중(recovering)에도 셈은 그대로다.
  경계 ② 다시 캐 고갈시키면 takenTotal 6 · depletedTimes 2 이고 시각이 새것으로 바뀐다.
  경계 ③ 한 번만 캐고 두면(고갈 아님) takenTotal 1 · depletedTimes 0 · 시각 없음이다.

SPEC-003  뒤척임은 자국을 묻고 셈은 못 묻는다
  뒤척임이 발자국을 지우고 캔 자국을 처음으로 되돌리는 그 순간 turns 가 하나 오르고
  sources 의 셈은 한 값도 달라지지 않는다.
  경계 ① 같은 뒤척임이 두 번 세지 않는다 (C016 의 규율 그대로).
  경계 ② 큰 걸음으로 뒤척임을 건너뛰어도 빠뜨리지 않는다.
  경계 ③ 뒤척임이 처음으로 되돌린 원천의 taken 은 0 인데 takenTotal 은 그대로다.

SPEC-004  깨어남과 지나감이 세어진다
  소란이 임계를 넘어 방이 깨어나면 awakenings.times 가 하나 오르고 그 시각이 남는다.
  경로가 한 방을 지나면 그 방의 passages[경로].times 가 하나 오르고 그 시각이 남는다.
  경계 ① 깨어 있는 동안 소란이 오르내려도 한 번이다 — 0 에 닿아 잠들고 다시 넘어야 두 번이다.
  경계 ② 한 지나감이 지나는 방마다 한 번씩이고, 같은 지나감이 한 방에서 두 번 세지 않는다.
  경계 ③ 경로가 지나지 않는 방에는 그 경로의 자리가 아예 없다.

SPEC-005  기억은 세계에 남는다
  저장하고 되살린 세계의 기억이 저장 직전과 같다. STATE_VERSION 이 오르고 옛 판의 스냅샷은
  되살아나지 않는다.
  경계 ① 관찰자가 그 방을 떠나 방이 실리지 않아도 남는다 (C010 의 어법).
  경계 ② 관찰자 둘이 같은 방의 같은 셈을 읽는다.

SPEC-006  지목하면 셈이 읽힌다
  원천을 지목하면 판에 「기억」 줄 — 캐인 횟수와 마지막 고갈의 나이. 지목이 없으면 그 자리가
  내가 선 방이고, 뒤척임 · 깨어남 · 지나감의 셈이 그 판에 선다.
  경계 ① 한 번도 일어나지 않은 것은 줄에 서지 않는다 (0 을 말하지 않는다).
  경계 ② 나이("N초 전")는 관찰자가 잰다 — 세계는 시각만 싣는다 (C028 어법).
  경계 ③ 세계 위에 뜨는 글자 · 숫자 HUD 는 하나도 늘지 않는다.
  경계 ④ 관찰 범위 밖의 방은 실리지 않으므로 그 기억도 실리지 않는다 (밤 · 눈보라 그대로).

SPEC-007  검사가 기억을 본다 — ㊸ ㊼
  ㊸ 방마다 기억이 가질 키(그 방의 원천 · 그 방을 지나는 경로)가 실제 데이터의 것이고,
  그 방이 가진 것 가운데 셀 수 없는 것이 없다 (양방향).
  ㊼ State 경로마다 지우는 손이 하나씩 적히고, 방마다의 기억 크기가 한 표에 선다.
  경계 ① ㊼ 는 판정하지 않는다 (report — 사람이 본다).
  경계 ② 두 번 돌려도 글자까지 같다 · 읽기 전용이다.

SPEC-008  앞의 세계는 그대로다 (회귀)
  원천의 phase · taken · 되돌아옴의 길이 · 소란의 값과 위상 · 자국 · 위상 덧씌움 ·
  문의 열림과 거절 사유 · 방 열셋의 땅과 hash · 검사 마흔셋의 나머지 답이 한 값도 달라지지 않는다.
  경계 ① 규칙은 기억을 **읽지 않는다** — 셈은 이 Cycle 에서 아무것도 판정하지 않는다.
```

## State

```text
World.RegionStates[regionId]
  .rule?                        그대로 (C008)
  .sources?                     그대로 (C012~C014) — taken 은 여전히 되돌아오면 0 이다
  .disturbance                  그대로 (C017)
  .tracks?                      그대로 (C017)
  .lifeSites? · .populations?   그대로 (C022 · C023)
  .history                      C034 ADDED — **지워지지 않는 것**. 모든 방에 선다
                                (disturbance 의 어법 — 물음표가 없다)
     .sources[sourceId]?        그 원천에 일어난 일. 한 번도 캔 적 없으면 자리가 없다
        .takenTotal             캐인 횟수 누계 (정수 · 상한 없음)
        .depletedTimes          고갈된 횟수 (정수)
        .lastDepletedAt         마지막 고갈의 세계 시각 | null
     .turns                     뒤척임 횟수 (정수 · 기본 0)
     .awakenings                { times: 정수, lastAt: 세계 초 | null }
     .passages[routeId]?        { times: 정수, lastAt: 세계 초 | null } — 지난 적 없으면 자리가 없다
     (Life 뒤) .births          자리만 — 이 Cycle 은 세우지 않는다 (§4.3)

유도되는 것 (저장되지 않는다)
  셈의 나이("N초 전")          지금 세계 시각 − lastAt (관찰자가 잰다 · C028 의 strikes.since 선례)
  "한 번도 없었다"              그 키의 자리가 없거나 times 가 0 인 것 — 저장된 표시가 아니다
```

`STATE_VERSION` 은 `hkt-adv-proto-i/10` → `hkt-adv-proto-i/11`.

### 이 Cycle 의 데이터 값

기억은 **세계가 겪은 일**이므로 content/regions 에 값을 두지 않는다. 데이터에서 오는 것은
셈의 **키**뿐이고 그것은 이미 있는 것이다 (원천 id · 경로 id). 새 상수도 없다 —
상한이 없기 때문이다 (확정 3).

| 자리 | 값 | 근거 |
|---|---|---|
| 세는 자리 | 채취 완료 · 고갈 · 뒤척임 · 깨어남 · 경로 통과 다섯 | Play W54 · 확정 3 |
| 원천 키 | 그 방의 원천 id (숲 가장자리는 여덟) | 이미 있는 것 |
| 경로 키 | `SKY_WHALE_ROUTE` · `BLIND_HUNTER_ROUTE` | C018 |
| 실주행이 쓰는 원천 | `MOLT_LITTER` (harvests 3 · recoverySeconds 60) | C011 · C013 데이터 |
| 상한 | 없음 | 확정 3 |

### 수명 표 — 무엇이 그것을 지우는가 (Foundation §4.4 · G7)

이 Cycle 이 State 필드마다 지우는 손 하나를 적는다. 앞으로 State 를 더하는 Cycle 은 이 표에
한 줄을 더한다. 검사 ㊼ 가 이 표를 보고한다.

| State 경로 | 지우는 손 | 종류 |
|---|---|---|
| `region.tracks[]` | 시간 — 60 초가 지운다 (뒤척임도 묻는다) | 스치는 것 |
| `region.disturbance.value` | 시간 — 고요에 0.5/s 가라앉는다 | 스치는 것 |
| `region.sources[].progress` | 시간 — 되돌아옴이 다 차면 0 으로 | 스치는 것 |
| `actor.distanceSinceTrack` | 시간 — 자국 하나가 날 때마다 0 | 스치는 것 |
| 판 · 기록 · 지목 | 관찰자 — 세계 State 가 아니다 | 관찰자만 쥐는 것 |
| `region.sources[].taken` | 뒤척임 · 되돌아옴 — 처음으로 되돌린다 | 뒤척임이 묻는 것 |
| `region.sources[].siteIndex` | 뒤척임 — 옮겨 선 마디를 처음으로 | 뒤척임이 묻는 것 |
| 위상 덧씌움 (phases) | 철 · 소란 — 원인이 걷히면 걷힌다 (유도) | 뒤척임이 묻는 것 |
| `region.rule.pattern` · `.pressure` · `.rearrangedAt` | 아무것도 | 세계에 남는 것 |
| `region.sources[].phase` | 아무것도 | 세계에 남는 것 |
| `region.disturbance.phase` | 아무것도 | 세계에 남는 것 |
| `region.populations` · `region.lifeSites` | 아무것도 | 세계에 남는 것 |
| `region.sources[].collapsedSites` | 그 Region 의 결정만 | 지워지지 않는 것 |
| **`region.history` 전부** | **그 Region 의 결정만 — 뒤척임도 되돌아옴도 못 지운다** | **지워지지 않는 것** |

## Rule

```text
R1  RULE-REGION-MEMORY-001 (ADDED)  — 셈은 한 자리에서 오른다
    IF   세계에 셀 만한 일이 방 하나에서 일어났다 (다섯 중 하나)
    THEN 그 방의 history 의 해당 자리가 하나 오르고, 시각을 가지는 항목은 지금 세계 시각을 적는다.
    경계 ① 조건이 없다 — 관찰자 · 철 · 방을 묻지 않는다.
    경계 ② 누가 했는지는 받지 않는다 — 부르는 자리가 몸을 넘겨주지 않는다.
    경계 ③ 자리가 없던 키는 그 순간 난다 (원천 · 경로).
    경계 ④ 이 규칙은 아무것도 판정하지 않는다 — 읽는 것은 C035 부터다.
    비고  `addDisturbance` 가 소란에 대해 하는 것과 같은 자리다 (Play W54).

R2  RULE-MINE-COMPLETE-001 (CHANGED)  — 캐면 센다
    채취가 완료될 때 taken 을 올리는 그 자리에서 takenTotal 도 오르고, 그 채취가 고갈로
    이어졌으면 depletedTimes 와 lastDepletedAt 도 함께 오른다.
    경계 ① 캐지 못한 요청(거절 · 중단)은 세지 않는다 — 완료만 센다.
    경계 ② taken 의 뜻과 되돌아옴의 판정은 한 줄도 바뀌지 않는다.

R3  RULE-SEASON-TURN-001 (CHANGED)  — 뒤척임은 묻고 센다
    뒤척임이 자국 · 발자국 · 옮겨 선 마디를 처음으로 되돌리는 그 자리에서 turns 가 하나 오른다.
    history 는 손대지 않는다.
    경계 ① 같은 뒤척임이 두 번 세지 않는다 (C016 이 이미 세운 규율을 그대로 탄다).
    경계 ② 뒤척임을 밝히지 않은 방도 센다 — 뒤척임은 세계의 순간이지 방의 선택이 아니다.

R4  RULE-DISTURBANCE-PHASE-001 (CHANGED)  — 깨어나면 센다
    소란의 위상이 잠듦 → 깨어남으로 넘어가는 그 전이에서 awakenings 가 오른다.
    경계 ① 깨어 있는 동안의 오르내림은 세지 않는다 — 전이만 센다 (C017 의 "넘은 것과 비운 것").
    경계 ② 깨어남 → 잠듦은 세지 않는다.

R5  RULE-PRESENCE-PASS-001 (CHANGED)  — 지나가면 그 방이 센다
    경로가 한 방에 드는 그 전이에서 그 방의 passages[경로] 가 오른다.
    경계 ① 한 지나감이 여러 방을 지나면 방마다 한 번씩이다.
    경계 ② 같은 방에 머무는 동안 두 번 세지 않는다.
    경계 ③ 불러서 일으킨 지나감(HKT_PRESENCE · 개발 명령)도 같은 자리에서 센다 — 손잡이가
           규칙을 우회하지 않는다.

R6  RULE-OBSERVE-MEMORY-001 (ADDED)  — 셈이 관찰에 실린다
    IF   관찰 결과가 어떤 원천을 싣는다   THEN 그 원천의 기억(계수 둘 · 마지막 고갈 시각)도 함께 싣는다.
    IF   관찰 결과가 어떤 방을 싣는다     THEN 그 방의 기억(turns · awakenings · passages)도 함께 싣는다.
    경계 ① 나이는 싣지 않는다 — 시각만 싣고 관찰자가 잰다.
    경계 ② 실리지 않는 방 · 원천(밤의 범위 · 눈보라)의 기억은 실리지 않는다.
    경계 ③ 누가 했는가는 실을 것이 없다 — 세계가 세지 않기 때문이다.

R7  RULE-OBSERVE-PROJECTION (AFFECTED)  — 투영이 한 자리 넓어진다
    싣는 것이 늘 뿐 무엇을 실을지 고르는 규칙(범위 · 잘림)은 한 줄도 바뀌지 않는다.

R8  검사 ㊸ ㊼ (ADDED · 기반)  — 기억을 보는 두 자리
    ㊸ 방마다 기억이 가질 키가 실제 원천 · 경로이고 그 역도 참인가 (참조 무결 — 통과/실패).
    ㊼ State 경로마다 지우는 손 하나와 방마다의 기억 크기 (요약 — 판정 없음).
    경계 ① 세는 방식과 앞선 검사 마흔셋의 답은 한 줄도 바뀌지 않는다.
    경계 ② ㊼ 는 데이터가 아니라 **계약 표**를 읽는다 — 표에서 빠진 State 필드는 형이 잡는다
           (아래 기본형 ⑤).
```

## REUSED / ADDED

```text
REUSED    RULE-SOURCE-RECOVERY-001 · RULE-SOURCE-REGROWN-001 · RULE-SOURCE-COLLAPSE-001 ·
          RULE-TRACK-001 · RULE-TRACK-FADE-001 · RULE-DISTURBANCE-001 ·
          RULE-DISTURBANCE-DECAY-001 · RULE-PRESENCE-SCHEDULE-001 · RULE-PRESENCE-BEND-001 ·
          RULE-REGION-PHASE-001 · 스냅샷 · 판과 지목 · 검사 마흔셋
ADDED     RegionState.history · RULE-REGION-MEMORY-001 · RULE-OBSERVE-MEMORY-001 ·
          PERSISTENCE_TABLE · CheckHistory · 검사 ㊸ ㊼ · 판의 「기억」 줄
CHANGED   RULE-MINE-COMPLETE-001 (완료가 셈도 올린다) · RULE-SEASON-TURN-001 (묻으면서 센다) ·
          RULE-DISTURBANCE-PHASE-001 (깨어남의 전이가 센다) · RULE-PRESENCE-PASS-001 (드는
          전이가 센다) — 넷 다 **전제와 전이는 그대로**이고 셈 하나가 곁에 는다
AFFECTED  RULE-OBSERVE-PROJECTION (싣는 것이 는다) · 스냅샷을 읽고 쓰는 모든 자리
          (STATE_VERSION 이 올라 옛 스냅샷을 버린다)
```

## Observable (관찰 계약)

```text
투영한다
  대상 프레임(원천).memory   { takenTotal · depletedTimes · lastDepletedAt }
  방.memory                  { turns · awakenings{times,lastAt} · passages[routeId]{times,lastAt} }
  (이미 있다) world.time     REUSED — 나이를 재는 값

투영하지 않는다 — 이것이 이 Play 의 규율이다
  누가 했는가 (관찰자의 이름 · 수 · 어느 몸이 캤는가)
  나이 — 세계는 시각만 말하고 "N초 전" 은 관찰자가 짓는다
  기억이 무엇의 조건인가 (읽는 조건은 C035 · 내미는 것은 C036)
  다음에 무슨 일이 언제 일어나는가 ("언제 다시 지나는가" 는 끝까지 싣지 않는다)
```

## UNRESOLVED

없음.

기본형으로 둔 것 (Design 이 침묵해 기존 규율을 따른 자리 — Human 이 감사할 자리다).

```text
① **한 번도 없던 것은 판에 서지 않는다** — 0 을 말하지 않는다. Play §5.1 관찰은 값이 있는 경우의
   문장만 준다. 0 을 말하면 처음 든 방마다 "뒤척임 0번 · 깨어남 0번" 이 서서 판이 길어지고,
   판이 세로로 길면 몸을 가린다는 부채(C028)가 있다. 말하지 않는 쪽을 골랐다.
② **깨어남은 전이를 센다** — 잠듦 → 깨어남의 순간 하나가 한 번이다. 확정 3 은 "깨어난 횟수" 라고만
   적는다. C017 이 "넘은 것과 비운 것이 다르다" 를 이미 세웠으므로 그 어법을 그대로 탔다.
③ **지나감은 방에 드는 전이를 센다** — 경로가 한 방에 머무는 동안이 한 번이다. 확정 3 은
   "지나간 것의 횟수" 까지다.
④ **캐지 못한 요청은 세지 않는다** — 완료만 센다. 확정 3 은 "캐인 횟수 누계" 이므로 taken 이
   오르는 자리와 같은 자리를 골랐다.
⑤ **수명 표를 형이 붙든다** — 표에서 빠진 State 필드는 검사가 아니라 타입이 잡는다
   (State 필드 전부를 키로 요구하는 표). 검사 ㊼ 는 밖에서 그 State 필드 집합을 알 길이 없고,
   Foundation §5.2 는 ㊼ 를 "판정 없는 요약" 으로 두었다.
⑥ **history 는 모든 방에 선다** (물음표 없음) — disturbance 가 C017 에서 그랬듯. 방마다
   자리가 있고 값이 비어 있는 것이 "일어난 일이 없다" 다.
⑦ **셈은 정수이고 상한이 없다** (확정 3). 넘침을 막는 규칙도, 오래된 것을 버리는 규칙도 두지 않는다.
⑧ **기억은 방의 것이다** — 원천의 셈도 그 원천이 아니라 **그 방의 history 아래**에 든다
   (§4.3 이 `RegionState += history` 로 적었다). 원천이 마디를 옮겨도 셈은 방에 남는다.
```
