# C014 — 조건과 흐름, 그리고 보고

```text
CYCLE          C014
SOURCE         content/roadmap/play/RoomBearsMaterial.md (승인됨)
               — §4 Breath(사슬 · 공유된 고갈 · 넘길 것) · §5.5 사슬 · §5.6 Supply Mode ·
                 §5.7 흐름과 경계 · §6 Required(W17 · W22 · W23 · V9 · V11 · E10 · E11) ·
                 확정 사항 1 · 5 · 7 · 10 · 위임된 결정 D1 · D2 · D3 · D4 ·
                 부록 A.1(거목균) · A.2(원천 셋) · A.3 · A.4(Flow 표와 Isolation Reason) · A.5
               content/roadmap/L2-World-Material.md §6.2 · §6.3 · §6.4 · §9 보고 ⑩~㉒ · §3.3
               content/roadmap/L2-World-Concept.md §4 숲의 생태 사슬 · W2 백왕령이 안전한 이유
               C013 — 되돌아옴의 세계 과정과 Supply Mode 셋을 세웠다. 이 Cycle 이 **넷째**를 채우고
                      (EVENT_SCARCE), C013 이 굴린 고리 한 줄을 **셋으로** 잇는다
SELECTED_FROM  Play §7 Cycle Breakdown 의 넷째 항목 (C014) — 이 Play 의 마지막 Cycle
확장 Cycle     C011 의 원천 넷 · C012 의 자국 · C013 의 되돌아옴 위에 **얹는다**.
               그 셋의 Semantic/Rule 을 다시 쓰지 않는다 (원본 §18)
```

## Playable Goal

관찰자가 **세 번째 재료**를 둥지의 부산물로 얻고, 그것을 캔 것이 거목의 뿌리혹을 멎게 하고 그
뿌리혹이 다시 노두를 멎게 하는 **고리 셋**을 겪는다. 그리고 숲 깊은 곳의 어귀에는 **물길이 불어난
때만** 퇴적이 실려 오는데, 그 출발은 거목 속 호수의 침전이다. 백왕령에는 이 계통이 하나도 없고 —
**그 이유가 데이터에 적혀 있어** 도구의 보고가 그것을 판정한다.

## Experience Intent

```text
Start   재료는 자리마다 따로 있는 것이고, 어디에 얼마나 있는지는 아무도 세지 않는다.
End     재료는 **하나의 사슬**이다 — 끝을 끊으면 위가 멎고, 어떤 것은 다른 방에서 실려 온다.
        백왕령에 그것이 없는 이유는 백왕령이 안전한 이유와 같다.
        그리고 세계가 그 계통을 제대로 적었는지는 **기계가 읽어 판정한다.**
```

## World Change

1. **세 번째 재료**가 선다 — 거목균(`GIANT_TREE_FUNGUS`). 포식수 둥지의 사체 위 균사가 그 원천이고,
   기회의 자리는 **부산물**이다 (A.3).
2. 사슬이 **셋**이 된다 — 둥지의 균사 → 거목의 뿌리혹 → 광맥의 노두. 아래를 캐면 위가 멎고,
   그 위가 멎으면 그 위도 멎는다 (C013 의 고리가 한 마디 더 길어진다).
3. **흐름 하나**가 선다 — 거목 속 호수의 침전(`LAKE_SILT_BED`)이 물길(`HEART_RIVER`)을 타고
   숲 깊은 곳의 어귀(`RIVER_SILT`)로 간다. 같은 Seed 가 물에 갈려 **다른 형태**로 도착한다 (D2 ③).
4. **주기가 있는 세계 사건** — 물길은 늘 불어 있지 않다. 주기의 활성 구간 동안에만 실어 오고,
   그때에만 어귀의 퇴적이 되돌아온다 (Supply Mode 넷째 `EVENT_SCARCE` — C013 이 남긴 자리).
5. 흐름은 **출발에 매달린다** — 호수 바닥을 캐 놓으면 물길이 불어도 어귀에 아무것도 오지 않는다.
6. **백왕령은 이 계통 밖이다** — 원천도 흔적도 없고, **왜 없는지**가 그 방의 데이터에 적힌다.
7. 숲 깊은 곳의 흔적이 **세 방향**을 가리킨다 — 둥지 쪽에도 원천이 섰으므로 그 쪽 흙도 짙어진다.
8. 도구가 재료 계통을 **판정한다** — 검사 열셋(⑩~㉒)이 검사 아홉에 이어 붙는다.
   끊긴 참조는 실패로, 분포는 판정 없는 요약으로 낸다.

## Observable Result

1. 포식수 둥지에 사체 위 균사가 서 있고, 캐면 세 번째 재료가 손에 들어온다.
2. 둥지의 균사를 캔 뒤 거목의 뿌리혹을 지목하면 "되돌아옴이 멎었다" 가 서 있고, 광맥의 노두에도
   같은 것이 서 있다 — 두 방 건너 멎는다.
3. 숲 깊은 곳의 어귀에는 처음에 아무것도 없다. 기다리면 퇴적이 서고, 지목했을 때 그 사이의
   답이 달라진다 (실려 오는 중 / 아직 아니다).
4. 거목 속 호수 바닥에 침전이 있고, 그것을 캐 놓으면 어귀에 아무리 기다려도 오지 않는다.
5. 어귀의 알갱이와 광맥의 노두는 **같은 재료**인데 그림이 다르다.
6. 숲 깊은 곳의 흙이 안쪽 출구 **셋** 둘레에서 다 짙다.
7. 백왕령에는 여전히 원천도 흙 변색도 없다.
8. `npm run world:check` 가 검사 **스물둘**을 내고, 끊긴 참조가 하나도 없다.
9. 그 보고가 기회의 자리 분포와 방마다의 Carrier 분포를 **판정 없이** 요약한다.

## Reuse

```text
Existing (그대로 쓴다)
  C011 — resourceEcology · 원천의 자리(resource point) · 흔적 사다리 · 채취
  C012 — phase · taken · 자국 넷 · sourcePhases 손잡이
  C013 — 되돌아옴의 세계 과정 · recoverySeconds · recovering · 매달림(recovery-stalled)이
         진행을 멎게 하는 형 · 마디와 자리 이동 · 되돌아오는 중의 그림
  T1   — 검사 아홉과 그 형(CheckItem · CheckStatus · CheckContract · world:check)
  C001 — Connector `HEART_RIVER`(이미 그래프에 있다) · anchor `RIVER_MOUTH` · `RIVER`
  C026~C028 — 지목 · 대상 프레임 · 답이 남는다
Added
  Data      재료 하나(거목균) · 원천 셋(둥지의 균사 · 어귀의 퇴적 · 호수 바닥의 침전) ·
            흐름 하나(`FLOW_HEART_SILT`) · 원천마다의 worldCause · recoveryCause ·
            백왕령의 isolationReason · 세 방(둥지 · 호수 · 어귀)의 흔적 · 뿌리혹의 매달림 한 줄
  World     흐름의 주기(세계 시각에서 유도) · 유입 흐름을 가진 원천의 되돌아옴 조건
  View      원천 셋의 그림(available · depleted · recovering) · 문구 셋
  Engine    검사 ⑩~⑱ ㉑ ㉒ (참조 무결성) · 요약 ⑲ ⑳ (판정 없음) —
            검사 아홉 곁에 이어 붙인다. 게임 명사는 계약으로 받는다
Protocol
  없음 — 새 자리가 없다. 이 Cycle 이 싣는 것은 전부 C012 의 `conditions` 코드다
```

## Out of Scope

```text
살아 있는 생물 — 광식충 · 조류 · 포식수의 행동                        → 3층 (확정 2 · Play A.6 ④)
재료의 쓰임 — Recipe · 조합 · 효과 · 수치                             → 4층 이후 (A.5 unresolvedUses)
유한한 원천(FINITE_WORLD_STATE)                                       → 이 Play 는 쓰지 않는다 (확정 1).
  그래서 검사 ⑮(고갈 결과가 적혔는가)는 잴 것이 없어 `absent` 다 — 통과로 적지 않는다
검사 ①(자원과 위험의 같은 근원) · ④(Region 의 phenomenon)             → hazard · phenomenon layer 를
  놓는 컨텐츠 층 주입. 이 Cycle 도 그 둘을 놓지 않으므로 두 검사는 `absent` 그대로다
흐름을 하나 더 놓는 것 · 세계 사건 기회(WORLD_EVENT)                   → 다음 Region 의 Play (A.3 은
  이 Play 가 World Event Opportunity 를 두지 않는다고 밝혔다)
Region 작성기(T2~T6)가 이 검사를 쓰는 일                               → ENGINE B 레인
```

## SPEC

```text
SPEC-001  세 번째 재료가 부산물로 난다
          조건  포식수 둥지에서 사체 위 균사를 캔다
          기대  거목균이 손에 들어오고, 그 원천의 기회 자리가 **부산물**이다.
                한 번에 다 뜯기므로(D4) 한 번 캐면 고갈된다
          경계  둥지에는 이 원천 말고 아무 원천도 없다 — 다른 방의 원천은 관찰에 실리지 않는다

SPEC-002  사슬이 셋이 된다
          조건  둥지의 균사를 캐 고갈시킨 뒤 거목의 뿌리혹과 광맥의 노두를 본다
          기대  ① 뿌리혹에 recovery-stalled 가 걸리고 진행이 오르지 않는다
                ② 노두에도 recovery-stalled 가 걸린다 — 두 방 건너 멎는다
          경계  ① 균사가 되돌아오면 뿌리혹의 진행이 다시 오르고, 뿌리혹이 되돌아오면 노두도 오른다
                ② 셋 다 available 인 동안에는 어느 것에도 그 코드가 걸리지 않는다

SPEC-003  흐름의 출발과 도착이 선다
          조건  거목 속 호수 바닥과 숲 깊은 곳의 어귀를 본다
          기대  둘 다 원천이고 **같은 Material Seed** 를 내되 자연 형태가 서로 다르다
          경계  어귀의 원천은 세계가 설 때 **아직 없다**(고갈로 선다) — 실려 와야 생긴다

SPEC-004  물길이 불어난 때만 실려 온다
          조건  어귀의 원천이 없는 상태로 세계를 굴린다
          기대  흐름의 활성 구간 동안에만 진행이 오르고, 한 구간을 채우면 되돌아온다.
                활성이 아닌 동안에는 아무리 기다려도 진행이 없다
          경계  ① 활성이 아닐 때 그 원천을 보면 condition-unmet 이, 활성일 때는 flow-arrived 가 실린다
                ② 주기는 되풀이된다 — 캐서 다시 없앤 뒤에도 다음 활성 구간에 다시 온다
                ③ 흐름 밖의 원천 다섯은 주기와 무관하게 제 길이대로 돌아온다

SPEC-005  흐름은 출발에 매달린다
          조건  호수 바닥의 침전을 캐 고갈시키고 어귀에서 여러 주기를 기다린다
          기대  흐름이 활성이어도 어귀의 진행이 오르지 않고, 그 원천에 recovery-stalled 가 실린다
          경계  침전이 스스로 되돌아온 뒤부터 다시 실려 온다

SPEC-006  백왕령은 이 계통 밖이고, 그 이유가 적혀 있다
          조건  백왕령을 본다 · 그 방의 데이터를 읽는다
          기대  원천도 흙 변색도 하나 없고, 그 방이 **왜 유입이 없는지**를 밝힌다
          경계  그 이유가 없으면 검사 ㉒ 가 그 방을 걸어낸다 (SPEC-007 이 그것을 잰다)

SPEC-007  검사가 끊긴 참조를 잡는다 (⑩ ⑪ ⑫ ⑬ ⑭ ⑮ ⑯ ⑰ ⑱ ㉑ ㉒)
          조건  world:check 를 돌린다
          기대  열셋이 검사 아홉 뒤에 번호 순으로 이어 붙고, 이 세계에서 fail 이 하나도 없다
          경계  ① 데이터에서 참조를 하나 끊으면(재료 없는 원천 · 없는 방을 가리키는 흐름 ·
                  흔적 없는 원천 · 이유 없는 고립) 그 검사가 fail 로 돌아선다
                ② 잴 것이 놓이지 않은 검사(⑮ 유한 원천)는 pass 가 아니라 absent 다

SPEC-008  요약은 판정하지 않는다 (⑲ ⑳)
          조건  같은 보고를 읽는다
          기대  기회 자리 넷의 분포와 방마다의 Carrier 유형·원천 수가 실리고, 둘 다 status 가 report 다
          경계  요약은 ok 판정에 영향을 주지 않는다 — 편중이 있어도 종료 코드는 그대로다

SPEC-009  흔적이 세 방향을 가리킨다
          조건  숲 깊은 곳의 안쪽 출구 셋 둘레의 흔적 세기를 잰다
          기대  셋 다 그 방 바닥보다 짙다 — 이제 세 방향 모두에 원천이 있다
          경계  방 바닥과 바깥쪽 출구 둘레는 달라지지 않는다

SPEC-010  건드리지 않은 것은 그대로다
          조건  이 Cycle 이 더한 원천 셋을 캐고 흐름이 도는 동안 앞의 원천 넷과 미로를 본다
          기대  원천 넷의 자리 · 캘 수 있는 횟수 · 되돌아오는 길이가 한 값도 달라지지 않는다.
                미로의 압력과 재배열도 그대로 돈다
          경계  땅(높이 · 표면 · traversable)은 어느 방에서도 한 값도 바뀌지 않는다
```

## State

이 Cycle 은 **세계 State 를 하나도 더하지 않는다.** 원천 셋이 늘지만 그 State 는 C012·C013 이
세운 그대로이고(`phase · taken · progress · siteIndex`), 흐름의 활성은 **세계 시각에서 유도된다** —
저장할 것이 없다 (`state.time` 은 이미 저장되는 값이다).

```text
World.RegionStates[regionId].sources?[sourceId]     C012 · C013 의 것 그대로. 원천이 셋 늘 뿐이다

유도되는 것 (저장되지 않는다)
  흐름이 지금 활성인가    (세계 시각 mod 주기) < 활성 구간
  걸린 조건              매달린 원천이 available 이 아니면 recovery-stalled ·
                        유입 흐름을 가진 원천이 available 이 아닐 때 그 흐름이 활성이면
                        flow-arrived, 아니면 condition-unmet

세계가 설 때 (C013 의 createRegionStates 에 한 줄)
  유입 흐름을 가진 원천은 **고갈로 선다** — 실려 와야 생기는 것이므로 (SPEC-003 경계)
```

`STATE_VERSION` 은 **오르지 않는다** — State 의 형이 그대로이므로 C013 의 스냅샷이 그대로 복구된다.

### 데이터 값 (content/regions)

원천 셋의 값은 A.2 · D3 · D4 의 표 그대로다.

```text
원천              방              재료                형태            기회      Carrier  harvests  recoverySeconds
NEST_FUNGUS       PREDATOR_NEST   GIANT_TREE_FUNGUS  사체 위 균사     부산물    fungus   1         120  (D3)
RIVER_SILT        FOREST_DEEP     BIO_ORE            어귀의 알갱이    조건부    water    2         30   (활성 구간 하나 · D3)
LAKE_SILT_BED     HEART_LAKE      BIO_ORE            호수 바닥의 침전 위험      water    2         180  (아래 기본형 ②)

매달림 (A.2 회복 원인 · §5.5)
  ROOT_NODULE  → NEST_FUNGUS    C014 ADDED — 분해된 흙이 있어야 축적된다 (C012 가 자리를 비워 두었다)
  ORE_OUTCROP  → ROOT_NODULE    C012 의 것 그대로
  RIVER_SILT   → LAKE_SILT_BED  흐름의 from 이 곧 그 매달림이다 (아래 Flow)

흐름 (A.4)
  FLOW_HEART_SILT   BIO_ORE
    from  HEART_LAKE / LAKE_SILT_BED      to  FOREST_DEEP / RIVER_SILT
    connector  HEART_RIVER (이미 그래프에 있다)
    주기  240 s · 활성 30 s (D3)

흔적 (C011 의 사다리를 잇는다 — 방 바닥 위에 원천 둘레가 겹친다)
  PREDATOR_NEST   바닥 2 · 균사 둘레 4      (균류가 흙을 붉게 되돌린다 — D2 거목균 ②)
  HEART_LAKE      바닥 2 · 침전 둘레 4      (물빛의 탁함 — A.2 Trace)
  FOREST_DEEP     어귀 둘레 3 · **둥지 쪽 출구 둘레 3** (C014 CHANGED — 아래 R7)

세계 원인 (§6.1 origin.worldCause · §6.2 cause.worldCause)
  FOREST_CHAIN — 숲의 생태 사슬 하나 (Play §5.0 · Concept §4). 재료 셋과 원천 일곱이 전부 이것에 매달린다

되돌아옴의 원인 코드 (§6.2 supply.recoveryCause · A.2 회복 원인 열)
  MOLT_LITTER molt-cycle · RUIN_SPOIL pile-erosion · NEST_FUNGUS carcass-decay ·
  ROOT_NODULE · ORE_OUTCROP tree-uptake · RIVER_SILT flow-arrival · LAKE_SILT_BED lake-settling

백왕령 (§6.4 isolationReason · 확정 5)
  WHITE_KING_DOMAIN — 원천 없는 resourceEcology 하나와 그 이유. 산맥과 강이 막기 때문이고
  그것이 백왕령이 안전한 이유와 같은 조건이다 (Concept W2)
```

## Rule

```text
R1  ADDED    RULE-RESOURCE-FLOW-001 — 흐름은 주기로 온다
    IF  세계 시각을 그 흐름의 주기로 나눈 나머지가 활성 구간보다 작다
    THEN 그 흐름은 지금 **활성**이다
    경계  ① 세계 State 가 아니다 — 시각에서 유도되고 저장되지 않는다
          ② 관찰자와 무관하다. 세계가 도는 동안 늘 돈다

R2  CHANGED  RULE-SOURCE-RECOVERY-001 — 유입 흐름을 가진 원천은 그 흐름이 실어 올 때만 진행한다
    IF  그 원천에 유입 흐름이 있고 (그 흐름이 활성이 아니거나 흐름의 출발 원천이 available 이 아니다)
    THEN progress 는 오르지 않는다
    (C013 의 나머지 — 매달림 · 임계 · 자리 이동 — 는 한 줄도 바뀌지 않는다)

R3  CHANGED  RULE-SOURCE-CONDITION-001 — 흐름의 조건도 코드가 된다
    IF  원천이 available 이 아니고 유입 흐름이 있다
    THEN 그 흐름이 활성이면 flow-arrived, 아니면 condition-unmet 이 걸린다
    그리고 (C013 그대로) 매달린 원천이 available 이 아니면 recovery-stalled 가 걸린다 —
    흐름의 **출발 원천**이 그 매달림이다
    경계  available 인 원천에는 아무 코드도 걸리지 않는다

R4  CHANGED  createRegionStates — 유입 흐름을 가진 원천은 고갈로 선다
    IF  세계가 서고 그 원천에 유입 흐름이 있다
    THEN phase = depleted · taken = harvests · progress = 0
    경계  나머지 원천은 C012 그대로 available · taken 0 이다

R5  AFFECTED RULE-SOURCE-CONDITION-001 의 사슬 — 매달림이 **두 마디**가 된다
    뿌리혹이 균사에, 노두가 뿌리혹에 매달린다. 규칙은 한 줄도 바뀌지 않는다 —
    데이터가 한 줄 늘었을 뿐이다 (C013 R2 가 이미 그 형이다)

R6  AFFECTED RULE-RESOURCE-PLACEMENT-001 · RULE-MINE-001 · RULE-MINE-COMPLETE-001 ·
             RULE-TRACE-STRENGTH-001 — 대상 집합이 넷에서 일곱으로 는다. 규칙은 그대로다

R7  CHANGED  숲 깊은 곳의 흔적 — 둥지 쪽 출구 둘레가 한 단계 짙어진다 (데이터)
    C011 은 "둥지의 균류는 이 계통의 끝이고 그 원천은 C014 의 것이다 — 없는 방향을 미리
    가리키지 않는다" 고 적고 그 방향을 비워 두었다. 이 Cycle 이 그 원천을 세우므로 그 방향도 선다.
    경계  방 바닥과 바깥쪽 출구(숲 가장자리로 돌아가는 길) 둘레는 달라지지 않는다

R8  ADDED    검사 ⑩~⑱ ㉑ ㉒ — 끊긴 참조를 판정한다 (기반 · 게임 명사 없음)
    ⑩ resource 배치의 태그가 아는 원천인가          ⑪ 원천이 세계 원인과 재료를 가리키는가
    ⑫ 재료마다 자리를 얻은 원천이 하나 이상 있는가   ⑬ 원천에 공급 유형이 있는가
    ⑭ 되돌아오는 원천에 되돌아옴의 원인이 있는가     ⑮ 유한한 원천에 고갈 결과가 있는가
    ⑯ 원천에 흔적 참조가 있는가                     ⑰ 그 흔적과 방이 실제로 있는가
    ⑱ 흐름의 from/to 방·원천과 Connector 가 유효한가
    ㉑ 원천 없는 배치와 재료 없는 원천               ㉒ 유입도 원천도 이유도 없는 방
    경계  잴 것이 놓이지 않은 검사는 pass 가 아니라 absent 다 (T1 이 세운 넷째 판정 그대로)

R9  ADDED    요약 ⑲ ⑳ — 판정하지 않는다 (원문 §9 마지막 줄)
    ⑲ 기회 자리(baseline · risk · conditional · by-product)의 분포
    ⑳ 방마다의 Carrier 유형 분포와 원천 수
    경계  status 는 report 다 — ok 판정과 종료 코드에 영향을 주지 않는다

R10 AFFECTED RULE-QUIET-GROUND-001 — 새 원천 셋에도 세계 위 글자는 없다.
             흐름이 왔다는 것도 흙과 그림이 말하고, 코드는 물었을 때 판이 옮긴다
```

## REUSED / ADDED / CHANGED / AFFECTED

```text
REUSED    RULE-MINE-001 · RULE-MINE-COMPLETE-001 · RULE-RESOURCE-PLACEMENT-001 ·
          RULE-SOURCE-COLLAPSE-001 · RULE-TRACE-STRENGTH-001 · RULE-OBSERVE-PROJECTION ·
          RULE-TERRAIN-COMPILE-001 · RULE-MAZE-CONNECTION-001 · checkRegions 의 형 · 세계 영속
ADDED     RULE-RESOURCE-FLOW-001 · 검사 ⑩~⑱ ㉑ ㉒ · 요약 ⑲ ⑳
CHANGED   RULE-SOURCE-RECOVERY-001 · RULE-SOURCE-CONDITION-001 · createRegionStates ·
          FOREST_DEEP 의 흔적 데이터
AFFECTED  RULE-QUIET-GROUND-001 · 원천을 대상으로 삼는 규칙 전부(대상 집합만 는다)
```

## Observable (관찰 계약)

```text
싣는다 — **새 자리가 하나도 없다**
  entities[].conditions   C012 의 자리 그대로. 코드가 둘 는다 —
                          flow-arrived(지금 실려 오는 중이다) · condition-unmet(아직 그때가 아니다)
  entities[].state · kind · material · position   C011~C013 그대로. 원천이 셋 늘 뿐이다

싣지 않는다
  흐름의 주기와 활성 구간 · 다음 활성까지 남은 시간 · 무엇이 무엇에 매달렸는가 ·
  흐름의 출발이 어느 방의 무엇인가 · 흔적의 세기 · 다른 방의 원천
  **언제 물길이 불어나는지 세계는 말하지 않는다** — 관찰자는 어귀에 가서 보고 안다.
  검사 보고는 관찰 계약이 아니다 — 도구가 데이터에서 직접 읽는 것이고 세계를 거치지 않는다
```

## UNRESOLVED

없음.

기본형으로 둔 것 (Human 이 감사할 자리):

```text
① 세계 원인의 id 를 `FOREST_CHAIN` 하나로 둔다 — Design 은 사슬을 문장으로 주고(Concept §4)
   id 를 주지 않았다. 재료 셋과 원천 일곱이 **하나의 Cause** 에서 나온다는 것이 M1 이므로
   id 도 하나다. 관계(축적 · 잔류 · 퇴적 …)는 적지 않는다 — 검사 열셋 중 아무도 읽지 않는다
② 호수 바닥의 침전이 180 초에 돌아온다 — D3 의 표에 이 원천만 없다. D3 가 밝힌 설계
   ("얕은 것은 빨리, 깊은 것은 느리게")와 그 비율에서 **핵심부의 값**을 그대로 썼다
③ 어귀의 퇴적이 **활성 구간 하나**(30 초)로 돌아온다 — D3 는 "240 s 주기 · 30 s 활성" 까지만
   말한다. 활성 동안에만 진행이 오르므로 한 구간을 채우면 도착이고, 구간 안에 캐 버리면
   다음 주기를 기다린다 — "그때 가야 한다" 가 그 표의 말이다
④ 유입 흐름을 가진 원천이 **고갈로 선다** — Design 의 lifecycle 은 `LATENT → AVAILABLE` 을
   말하지만(§6.2), phase 를 넷으로 늘리지 않고 C013 의 셋으로 같은 것을 말한다:
   "아직 실려 오지 않았다" 와 "다 캐 갔다" 는 관찰자에게 같은 사실이다 (거기에 지금 없다)
⑤ 검사 ⑬ 이 **공급 유형만** 묻는다 — 원문은 "Supply Mode 와 Lifecycle" 을 함께 말하지만,
   이 세계의 lifecycle 은 규칙이 소유하고 모든 원천이 같은 것을 산다 (available → depleted →
   recovering → available). 데이터에 따로 적을 것이 없다
⑥ 검사 ㉒ 의 "주요 Region" 을 **resourceEcology 를 밝힌 방**으로 친다 — 원문은 주요를 정의하지
   않는다. 그 계통이 다룬다고 밝힌 방만 묻고, 원천이 있으면 스스로 낳는 것이므로 이유가 필요 없다
⑦ 되돌아옴의 원인을 **코드**로 적는다 (molt-cycle · carcass-decay …) — A.2 는 사람의 말로 준다.
   검사는 있는가만 묻고, 사람의 문구가 필요해지면 View 의 표가 옮긴다 (재료 이름의 선례 그대로)
⑧ 세 방의 흔적 값(둥지 2/4 · 호수 2/4 · 어귀 3) — Design 은 흔적이 있어야 한다고만 한다.
   C011 의 사다리(바닥보다 둘레가 짙다)와 C013 의 규율(원천 둘레는 phase 가 낮춘다)에 맞춘
   배치 데이터다
```
