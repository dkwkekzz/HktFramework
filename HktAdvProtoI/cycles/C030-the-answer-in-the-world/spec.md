# C030 — 답이 세계에 있다

```text
CYCLE          C030 — 열을 저장하는 결정의 원천 · 온기의 흔적 · 채취와 되돌아옴 · 열쇠 × 자물쇠 표
SOURCE         content/roadmap/play/RoomAsksForPossibilities.md (§2 완료 확인 ③ ⑥ · §4 되돌아감·발견·이음 ·
               §5.3 · §5.4 · §6 W48 뒷머리 · W51 · V24 · V25 · E20 · 확정 5 · 7)
               content/roadmap/L2-World-Access.md §4.5 Answer Map · §5.2 ㉟ ㊴ ㊵ · §5.3 관찰 도구 ·
               §9.2 Possibility 표 (HEAT_CRYSTAL 행) · §10 D2 · D5 · K8 · K12 · K13
               content/roadmap/L2-World-Material.md §6.1 · §6.2 · S4 흔적 · S10 쓰임은 넘기지 않는다 ·
               A.2 회복 원인 · §5.6 Supply Mode
               content/roadmap/L2-World-Region.md §5.1 정식 이름 표 (HEAT_CRYSTAL) · §5.5 이름 위임 규칙 · §12
               content/roadmap/play/RegionGraphRooms.md §5.5 거목 내부 세계 (TREE_INNER_WORLD · deep)
               content/roadmap/play/RoomBearsMaterial.md D2 ①② · 부록 A.2 (뿌리혹의 사슬)
               루트 TODO.md §4 — C030 이 받는 세 줄 (Seed 와 원천을 함께 · ㉟ 은 이미 통과 · 성질 문장의 자리)
SELECTED_FROM  Play §7 Cycle Breakdown 의 둘째 항목
확장            C029 의 어휘 · Lock · Seed 의 성질 위에, 그리고 C011~C014 의 재료 계통 위에 **더한다** —
               그 spec 들의 Semantic/Rule 을 복사하지 않고 이름으로 인용한다
```

## Playable Goal

**협곡에서 답을 찾지 못한 관찰자가 숲으로 돌아가 거목 안으로 들어서면, 안쪽으로 갈수록 서리가 걷히고
따뜻해지는 흔적을 따라 벽의 한 자리에 닿아 열을 저장하는 결정을 캔다** — 지목하면 판이 "열을 담는다"
라고 말한다. 그것을 들고 빙결 심층의 문 앞에 서도 문은 열리지 않는다.

## Experience Intent

```text
Start  협곡을 다 뒤져도 열을 담는 것이 없다. 문이 요구하는 것을 채울 방법이 세계에 없어 보인다.
End    있었다 — 협곡이 아니라 숲에, 그것도 살아 있는 것 안에. 세계는 어느 것이 답인지 말하지 않았고,
       "살아 있는 것 안에 쌓인다" 는 숲의 사실과 "따뜻한 것을 본다" 는 협곡의 현상을 내가 이었다.
       그리고 손에 쥔 지금도 문은 열리지 않는다 — 세계는 답을 알고 나도 아는데, 여는 것은 내 몸이다.
```

Play §4 Breath 의 **되돌아감 → 발견 → 이음**, 그리고 **넘길 것**의 앞 절반이다.
다른 길(눈보라)은 C031 이 받는다.

## World Change

1. **미지 M7 이 세계에 선다** — 열을 저장하는 결정(`HEAT_CRYSTAL`)이 Material Seed 로 서고, 그 원천 하나가
   거목 내부 세계(deep)의 벽 한 자리에 난다. 이름은 이 세계의 정식 이름 표의 것이고, 원천의 이름은
   그것이 무엇인지에서 짓는다.
2. **두 미지가 서로를 가리킨다** — 협곡의 문이 묻는 성질(`heat:hides`)에 숲의 재료가 가진 성질
   (`heat:stores`)이 답한다. **세계는 그 이음을 화면에 그리지 않는다** — 판 둘이 각각 제 것만 말한다.
3. **흔적의 어휘가 셋이 된다** — 숲은 흙이 물들고(C011) 협곡은 숨이 얼고(C020), 거목 속은 **온기가 오른다**.
   기제는 하나이고 태그와 색과 말만 갈린다. 들어온 문에서 멀어질수록 짙어져 방향이 된다.
4. **거목 내부 세계가 처음으로 무엇을 낳는다** — anchor 둘뿐이던 방에 흔적과 원천이 선다.
   땅도 통행도 한 값 바뀌지 않는다.
5. **캐면 그 자리가 식는다** — 채취 하나로 고갈되고, 둘레의 온기가 한 단계 옅어지며, 고갈된 동안
   그 원천이 "자리가 식었다" 를 진다.
6. **되돌아옴이 사슬에 매달린다** — 거목의 축적이 그것을 되돌리고, 그 축적은 거목균에 매달린다.
   거목균이 고갈이면 이 자리의 되돌아옴도 멎는다 — 사슬이 방 셋을 건넌다.
7. **도구가 열쇠 × 자물쇠 표를 낸다** — `world:observe --report` 가 Lock 마다 답의 종류와 그 원천의 방을
   사람이 읽는 표로 적는다. 세계를 바꾸지 않는 읽기 전용이다.
8. **문은 열리지 않는다** — 결정을 지닌 채 문 앞에 서도 열림도 거절 사유도 한 값 달라지지 않는다.

## Observable Result

1. 거목 내부 세계에 들어서 안쪽으로 걸으면 바닥의 흔적이 **단조롭게 따뜻해진다** — 들어온 문 쪽이
   가장 옅고 벽의 한 자리가 가장 짙다. 재료 아이콘도 미니맵도 없다.
2. 그 자리에 원천이 서 있고, 지목하면 판이 **「재료 열을 저장하는 결정 · 성질 열을 담는다」**를 말한다.
3. 캔다. 한 번에 고갈되고 그림이 바뀌며, 둘레의 온기가 한 단계 옅어지고, 지목하면 「자리가 식었다」가 읽힌다.
4. 거목균을 먼저 캐 두면 이 자리의 되돌아옴이 멎는다 — 지목하면 「되돌아옴이 멎었다」가 함께 읽힌다.
5. `npm run world:check` 에서 ㊴ 의 Material 열이 **2** 가 된다 (빙정석 · 열 결정). ㉟ 은 여전히 통과다.
6. `npm run world:observe -- --report` 에 **열쇠 × 자물쇠 표**가 서서, 빙결 심층의 문이 묻는 것에
   어떤 종류의 답이 어느 방에 있는지가 한 장으로 읽힌다.
7. 결정을 지닌 채 빙결 심층의 문 앞에 서도 **문은 그대로다** — 긴 밤이면 열려 있고 아니면 「이 철이 아니다」이며,
   지목하면 여전히 「체열이 감지된다」다.
8. 백왕령에서 그 원천까지 빙결 심층의 문을 지나지 않고 닿는다.
9. 숲 · 미로 · 백왕령 · 협곡의 땅과 원천과 관찰 범위는 한 값도 달라지지 않는다.

## Reuse

```text
Existing (그대로 쓴다 · 이름만 인용한다)
  RULE-SOURCE-PLACEMENT / 원천의 자리와 흔적 (C011) · RULE-MINE-* 채취와 고갈 (C012) ·
  RULE-SOURCE-RECOVERY-001 되돌아옴과 phase 셋 (C013) · 매달림과 RECOVERY_STALLED (C012 · C014)
  MaterialSeed · MaterialSeed.properties (C029) · ResourceSourceSpec · MATERIAL_SEEDS
  traceLevel 과 흔적 어휘 둘 (C011 · C020) · 흔적이 옅어지는 규칙 (C012 · C013)
  RULE-BEING-READING-001 판의 재료 이름과 성질 줄 (C029) · propertyPhraseCode (C029)
  RULE-LOCK-ACTIVATION-001 · RULE-LOCK-REASON-001 (C029) — 한 줄도 바뀌지 않는다
  검사 서른다섯과 그 refs (T1 · C014 · C018 · C029) · world:observe --report 의 절들 (C007 · C021)

Added — Data (content/regions)
  HEAT_CRYSTAL Seed + properties [heat:stores]      resource-ecology.ts (C029 가 넘긴 것)
  emberWarmthTag(level) · EMBER_WARMTH_MAX          셋째 흔적 어휘 (traceLevel 이 함께 읽는다)
  FORM_WALL_EMBER · RECOVERY_TREE_UPTAKE(재사용)     자연 형태 하나
  EMBER_COOLED                                      조건 코드 — 자리가 식었다
  tree-inner-world.ts                               흔적 셋 · 원천 하나 · resourceEcology

Added — World (content/world)
  ResourceSourceSpec.depletedCode?                  고갈된 동안 그 원천이 지는 조건 코드 (regrownCode? 의 형제)
  RULE-SOURCE-DEPLETED-CODE-001                     그것을 실어 보내는 규칙

Added — View (content/view)
  온기의 흔적 색 셋 · 원천의 그림(있음 / 바닥남) · 문구 — 재료 이름 · stores-heat · ember-cooled

Added — Engine (engine/world-authoring)
  accessAnswerMap(input)                            Lock 마다의 답과 그 원천의 방을 낸다 (검사와 같은 입력)

Added — Tools
  world:observe --report 에 열쇠 × 자물쇠 표 (읽기 전용)
```

## Out of Scope

```text
Lock.relaxedBy(눈보라) · 완화 표시 · ㊴ Environment 1 · ㊵ ≥ 2 · T4 계약 목록          C031
열을 저장하는 결정의 **쓰임** — "빙결 Region 에서 체온을 유지한다" 는 판에 서지 않는다   4층 이후 (S10 · Play §0)
  Play §5.3 관찰은 그 문장을 판에 적었으나 §0 이 "이 Play 가 세우지 않는 것" 에 쓰임을 두었다.
  뒤엣것을 따랐다 — Human 결정으로 돌린다 (아래 기본형 ⑦)
property Lock 을 실제로 판정하는 것 (몸이 열을 지니고 버틴다)                             3 · 4층 (K12)
거목 내부 세계의 땅 (벽 · 높이 · 위험)                                                    그 방을 짓는 Play
살아 있는 생물이 이 원천을 지는 것 (Carrier CREATURE)                                     3층
빙결 심층(FROST_DEPTH) 방 자체 — 문 뒤는 경계로 남는다                                    확정 8 · 컨텐츠 층
```

## SPEC

```text
SPEC-001  열을 저장하는 결정과 그 원천이 세계에 선다
  Seed 하나가 성질 `heat:stores` 를 지고 서고, 그 Seed 를 내는 원천 하나가 거목 내부 세계의
  벽 한 자리에 선다. 원천은 자리 · 형태 · 지는 것 · 기회 자리 · 공급 · 되돌아옴의 원인을 밝힌다.
  경계 ① 그 방의 땅 · 높이 · 표면 · 통행 격자는 한 값도 바뀌지 않는다 (흔적과 원천은 얹히는 것이다).
  경계 ② 다른 방에는 이 재료의 원천이 하나도 없다.
  경계 ③ 쓰임은 어디에도 적히지 않는다.

SPEC-002  흔적만으로 닿는다 — 온기가 방향이 된다
  그 방의 흔적이 셋째 어휘(온기)로 서고, 들어온 문 쪽에서 원천 쪽으로 **단조롭게** 짙어진다.
  가장 짙은 단계는 원천 둘레다.
  경계 ① 앞의 두 어휘(흙 · 숨)를 읽던 자리는 한 값도 달라지지 않는다.
  경계 ② 재료 아이콘도 미니맵도 원천을 가리키는 화살표도 없다.
  경계 ③ 다른 방의 흔적은 한 값도 달라지지 않는다.

SPEC-003  캐면 그 자리가 식는다
  한 번 캐면 고갈되고, 둘레의 온기가 한 단계 옅어지며, 고갈된 동안 그 원천이 「자리가 식었다」를 진다.
  경계 ① 캐기 전에는 그 코드가 실리지 않는다.
  경계 ② 그 코드를 밝히지 않은 원천은 몇 번을 캐도 한 글자도 늘지 않는다 (지금 세계의 나머지 전부).
  경계 ③ 그 방의 땅도 통행도 무너지지 않는다 — 이 원천은 자리를 막지 않는다.

SPEC-004  되돌아옴이 사슬에 매달린다
  고갈된 뒤 세계 시간이 흐르면 되돌아온다. 그러나 매달린 원천(거목균)이 고갈이면 진행이 0 이고
  「되돌아옴이 멎었다」가 함께 실린다.
  경계 ① 매달린 것이 되돌아오면 진행도 다시 흐른다.
  경계 ② 아무도 그 방에 없어도 돈다 (C013 이 세운 그대로).

SPEC-005  지목하면 판이 재료의 이름과 성질을 말한다
  그 원천을 지목하면 판에 재료의 이름과 성질 문장이 선다.
  경계 ① 그 성질이 어느 요구에 답하는지도 · 그 요구가 어디 있는지도 판에 없다.
  경계 ② 성질의 이름(축:관계)은 화면 어디에도 실리지 않는다.

SPEC-006  답이 둘이 되고, 도구가 그 이음을 세계 쪽에서 보인다
  검사 ㊴ 의 중요 Lock 의 Material 열이 2 가 되고 ㉟ 은 통과다. `world:observe --report` 가
  Lock 마다 답의 종류와 그 원천의 방을 적은 표를 낸다.
  경계 ① ㊵ 는 여전히 "한 종류뿐인 Lock 1" 이다 — 둘 다 같은 종류(Material)이기 때문이다.
  경계 ② 읽기 전용이다 · 두 번 돌리면 글자까지 같다.
  경계 ③ 종료 코드는 fail 하나가 정한다 — 요약이 무엇을 적든 0 이다.

SPEC-007  문은 열리지 않는다
  결정을 지닌 채 빙결 심층의 문 앞에 서도 열림 · 거절 사유 · 지목한 판의 현상이 지니지 않았을 때와 같다.
  경계 ① 어느 철에서도 같다.
  경계 ② 요구를 밝히지 않은 문의 답도 한 값 달라지지 않는다.

SPEC-008  백왕령에서 그 원천까지 그 문을 지나지 않고 닿는다
  시작 방에서 빙결 심층의 문을 벽으로 놓아도 그 원천이 선 방에 닿는다.
  경계 ① 그 문을 벽으로 놓아도 닿지 못하게 되는 방은 늘지 않는다.

SPEC-009  앞의 세계는 그대로다 (회귀)
  방 열하나의 땅 · 표면 · 통행 · 걸린 것 · 관찰 범위 · 원천의 phase 와 마디 · 자국 · 지나는 것 ·
  소란 · 문의 열림이 한 값도 달라지지 않는다. 검사 서른다섯의 나머지 답도 그대로다.
```

## State

이 Cycle 은 **저장되는 세계 State 를 하나도 늘리지 않는다.** 원천의 phase 와 채취 수는 C012 · C013 이
세운 그 자리를 그대로 쓰고, 「자리가 식었다」도 온기의 옅어짐도 같은 phase 에서 유도되는 사실이다.

```text
MaterialSeed                       (C029 의 형 그대로 — 값 하나가 는다)
  HEAT_CRYSTAL                     worldCause FOREST_CHAIN · forms [벽의 잉걸] · properties [heat:stores / behavior]

ResourceSourceSpec += depletedCode?   고갈된 동안 그 원천이 지는 조건 코드 (regrownCode? 의 형제 · 데이터)
                                      밝히지 않은 원천은 몇 번을 캐도 아무것도 늘지 않는다
```

이 Cycle 의 데이터 값 표.

| 자리 | 값 | 근거 |
|---|---|---|
| 재료의 이름 | `HEAT_CRYSTAL` 열을 저장하는 결정 | L2-World-Region §5.1 정식 이름 표 |
| 재료의 세계 원인 | `FOREST_CHAIN` | Access D2 (살아 있는 것 안에 쌓인다) · Play §5.0 |
| 재료의 성질 | `heat:stores` (from behavior) | Access §9.2 · C029 의 어휘 |
| 원천의 이름 | `CORE_EMBER` 속의 잉걸 | 확정 5 (가칭을 그것이 무엇인지에서 짓는다) · Region §5.5 |
| 원천의 방 | `TREE_INNER_WORLD` (deep) | 확정 5 · D5 |
| 원천의 자리 | (−34, 20) — 서쪽 벽, 들어온 문에서 먼 절반 | 아래 기본형 ② |
| 자연 형태 | `FORM_WALL_EMBER` 서리가 앉지 않는 벽의 잉걸 | Play §5.3 Trace |
| 지는 것 (Carrier) | `plant` | Play §5.3 |
| 기회 자리 | `risk` | Play §5.3 |
| 공급 | `conditional-renewable` · 매달린 것 `NEST_FUNGUS` | Play §5.3 (거목균에 매달린다) |
| 되돌아옴의 원인 | `RECOVERY_TREE_UPTAKE` (거목의 축적) | Play §5.3 · A.2 |
| 캘 횟수 | 1 | Play §5.3 (채취 단위 1) |
| 되돌아옴의 길이 | 180 세계 초 | 아래 기본형 ③ |
| 고갈된 동안의 코드 | `ember-cooled` 자리가 식었다 | Play §6 V25 |
| 흔적 어휘 | `ember-warmth:1..3` — 방 바닥 1 · 원천 쪽 절반 2 · 원천 둘레 3 | 아래 기본형 ④ |
| 성질 문장 | `heat:stores` → 「열을 담는다」 | Play §6 V25 stores-heat |

## Rule

```text
R1  원천 하나가 는다 (데이터 — 새 규칙 없음)
    C011~C013 의 규칙이 그대로 이 원천을 집는다: 자리를 얻고 · 흔적이 둘레에 서고 · 캐면 고갈되고 ·
    세계 시간이 되돌리고 · 매달린 것이 고갈이면 진행이 0 이다.
    경계  규칙 코드에 이 재료의 이름도 이 원천의 이름도 한 글자 늘지 않는다 (C004 가 세운 규율).

R2  RULE-TRACE-VOCABULARY (CHANGED — C011 R? · C020 이 둘로 만든 그 자리)  — 어휘가 셋이 된다
    IF   흔적 태그가 온기의 접두사로 시작한다
    THEN 그 태그의 단계는 그 수다 — 흙 · 숨의 태그를 읽는 답은 한 값도 달라지지 않는다.
    ELSE 지금까지와 같다 (모르는 태그는 0 · 없는 흔적을 지어내지 않는다).
    비고  기제는 하나이고 태그와 색과 말만 갈린다 (C020 이 세운 그 판단의 연장).

R3  RULE-SOURCE-DEPLETED-CODE-001 (ADDED)  — 고갈된 동안 그 자리가 말한다
    IF   원천이 고갈되었고 AND 그 원천이 고갈의 코드를 밝혔다
    THEN 그 원천의 조건 코드에 그것이 실린다.
    ELSE 한 글자도 늘지 않는다.
    경계 ① 되돌아오는 중이거나 있는 동안에는 실리지 않는다.
    경계 ② 밝히지 않은 원천은 몇 번을 캐도 늘지 않는다 (지금 세계의 나머지 전부).
    경계 ③ 이미 실리는 코드(되돌아옴이 멎었다 등)와 겹치면 걸린 것이 전부 실린다.
    비고  `regrownCode?`(C021)의 형제다 — 저것은 "그 자리가 처음 자리가 아니다" 이고 이것은
          "그 자리가 지금 비었다" 이며, 둘 다 원천이 밝혔을 때만 실린다.

R4  accessAnswerMap (ADDED · 기반)  — Lock 마다의 답을 사람이 읽을 표로
    검사 ㉟ ㊴ 이 이미 세는 것을 **행과 열로** 낸다 — Lock 하나가 한 행, 답의 종류가 열, 칸은
    답이 된 재료와 그 원천이 선 방들.
    경계 ① 판정하지 않는다 — 수와 이름을 적을 뿐이다 (요약 여섯의 어법 그대로).
    경계 ② 게임 명사를 알지 못한다 — 검사가 받는 그 계약을 그대로 받는다.

R5  RULE-LOCK-ACTIVATION-001 (AFFECTED — 한 줄도 바뀌지 않는다)
    손에 무엇을 들었는가는 이 판정에 들어오지 않는다. 그래서 결정을 지녀도 문의 답이 같다 (K12).
```

## REUSED / ADDED

```text
REUSED    RULE-MINE-* · RULE-SOURCE-RECOVERY-001 · RULE-BEING-READING-001 · RULE-LOCK-ACTIVATION-001 ·
          RULE-LOCK-REASON-001 · traceLevel · propertyPhraseCode · CheckAccess 와 검사 아홉
ADDED     HEAT_CRYSTAL Seed · CORE_EMBER 원천 · 온기의 어휘 셋 · FORM_WALL_EMBER · EMBER_COOLED ·
          ResourceSourceSpec.depletedCode? · RULE-SOURCE-DEPLETED-CODE-001 · accessAnswerMap ·
          world:observe --report 의 열쇠 × 자물쇠 표
CHANGED   traceLevel (어휘가 셋이 된다 — 앞의 둘의 답은 그대로)
AFFECTED  검사 ⑫ ⑲ ⑳ ㉑ ㉒ ㉟ ㊱ ㊲ ㊴ ㊵ 의 수 (재료 하나 · 원천 하나가 늘었다) ·
          거목 내부 세계의 hash (그 방에 op 이 는다 — 땅은 그대로)
```

## Observable (관찰 계약)

```text
투영한다
  entities[].material         (있던 자리) 이 원천도 자기 재료의 코드를 싣는다
  entities[].conditions       (있던 자리) 고갈된 동안 「자리가 식었다」가 실린다
  entities[].state            (있던 자리) available | depleted | recovering

투영하지 않는다 — 이것이 이 Play 의 미지감이다
  이 재료가 어느 요구에 답하는가 · 그 요구가 어느 방에 있는가 · 둘을 잇는 선
  열쇠 × 자물쇠 표 (도구의 것이지 화면의 것이 아니다)
  이 재료의 쓰임 · 성질의 수치
  무엇이 이 원천의 되돌아옴을 멎게 했는가 (세계는 "지금 멎었다" 만 말한다 — C012 가 세운 그대로)
  온기의 사다리가 몇 단계인가 · 원천이 어느 쪽인가 (짙기만 보이고 방향은 관찰자가 읽는다)
```

## UNRESOLVED

없음.

기본형으로 둔 것 (Design 이 침묵해 기존 규율을 그대로 따른 자리 — Human 이 감사할 자리다).

```text
① 원천의 이름 `CORE_EMBER` — Play 는 가칭 `TREE_HEART_EMBER` 를 주며 "그것이 무엇인지에서 짓는다"
   (확정 5 · Region §5.5). 거목의 **속**에서 열이 모여 굳은 자리이므로 그렇게 지었다. `HEART` 를 뺀 것은
   이 세계에 이미 미로의 심장 · 심장 호수가 있어 한 글자가 세 자리를 가리키게 되기 때문이다.
② 원천의 자리 (−34, 20) — Play 는 "서리가 앉지 않는 벽의 한 자리" 까지만 말한다. 서쪽 **경계**를 벽으로
   읽고, 들어온 문(0, −38)에서 먼 절반에 두어 흔적이 길잡이가 되게 했다. 떨어지는 자리(0, 38)에서 39 떨어져
   있어 걸어가다 떨어지지 않는다.
③ 되돌아옴의 길이 180 세계 초 — Design 에 없다. 이 세계의 값 둘(얕은 것 60 · 깊은 것 180) 가운데 깊은 것을
   따랐다: deep 방의 원천이다.
④ 온기의 사다리를 **셋**으로 두었다 — Design 에 없다. 협곡의 숨(셋)을 따랐다. 방 하나 안에서 나뉘므로
   숲의 흙(다섯)만큼 잘게 나눌 자리가 없다.
⑤ "붉은 눈 쪽으로 갈수록 따뜻함" 을 **들어온 문에서 멀어질수록** 으로 옮겼다 — 거목 내부 세계는
   Spatial Embedding 이 없어(RegionGraphRooms §5.5) "붉은 눈 쪽" 이 이 방 안의 방향으로 번역되지 않는다.
   구배의 기제는 Play 가 말한 그대로(변색과 같은 것)이고, 방향의 기준만 이 방이 가진 것으로 골랐다.
⑥ 역할 `risk` 인데 이 Cycle 은 그 방에 위험을 새로 두지 않았다 — 이 방의 위험은 이미 있는 추락이다
   (RegionGraphRooms §5.5). 검사 ⑲ 는 역할의 분포만 세고 위험의 유무를 묻지 않는다.
⑦ 판이 「빙결 Region 에서 체온을 유지한다」를 말하지 않는다 — Play §5.3 관찰은 그 문장을 적었으나
   §0 이 "이 Play 가 세우지 않는 것" 에 **쓰임(S10)** 을 두었고, 그 문장은 이 재료가 무엇에 쓰이는가다.
   뒤엣것을 따랐다. 판에 세우려면 데이터 한 줄이고, 결정은 Human 의 것이다.
⑧ 고갈의 코드를 `depletedCode?` 라는 **원천마다의 선택**으로 두었다 — 세계 전체의 규칙으로 두면
   지금 있는 원천 열둘의 판이 한꺼번에 달라진다. `regrownCode?`(C021)가 선 그 자리와 같은 어법이다.
```
