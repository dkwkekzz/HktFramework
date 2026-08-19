# CYCLE C016 — Insight Sees Before Looking

[PASS] Cycle Definition
[PASS] Intent                    (앎에 길이 둘 · 앎이 자리 단위 · 통찰은 관문이 아니다)
[PASS] World Semantic            (성질 하나 · 문턱 셋 · 판정 하나 · 계산 무변경)
[PASS] GameView Specification    (세 자리가 따로 온다 · 문턱은 싣지 않는다 · 계약 모양 무변경)
[    ] Human Semantic Review
[    ] World Implementation
[    ] View Implementation
[    ] Verification

STATUS  IN PROGRESS

## MASTER TRACE

    Frontier            FR-INSIGHT-SEES-BEFORE-LOOKING   (frontier.md SELECTED — Human Select)
    Source Goal         MG-EXPLORE-BEIRA
                        "자신이 이해하고 대응할 수 있는 세계의 범위가 지금보다 넓다 —
                         이전에는 갈 수 없던 베이라의 영역에 닿는다" (BW §1 · §32)
    Source Possibility  MP-LEARN-TO-HANDLE-THE-LAYER
                        "들어가서 겪으며 그 층이 무엇을 요구하는지 알아내고, 그 대응을
                         스스로 익혀 감당한다. 셋 중 유일하게 미리 갖추지 않고 시작하며,
                         그래서 가장 위험하고 가장 싸다 — 치르는 것은 자원이 아니라
                         시간과 실패다" (BW §32)
    Target Capability   MC-OBSERVE                (overlay: PARTIAL — C014 가 절반을 세웠다)
                        "행동하기 전에 대상을 관찰하여 그 행동·습성·상태의 정보를 얻는다"
                        남은 결손 둘 중 **경로 쪽**을 닫는다 — 앎에 이르는 길이 살펴봄
                        하나뿐이고, 앎이 존재 단위여서 "일부만 안다" 가 세계에 없다
                        (C014 06 NOTES · overlay MC-OBSERVE 의 결손 칸)
    Reused Capability   MC-OBSERVE                (overlay: PARTIAL — C014 · 장부·관문·계약)
                        MC-ATTACK-ARMOR-MATCHUP   (overlay: IMPLEMENTED — C012)
                        MC-PENETRATION            (overlay: IMPLEMENTED — C013)
                        MC-CRITICAL-STRIKE        (C015 — 기계 검증 완료, Human Play 확인 대기)
                        MC-COMBAT-CAUSE-READING   (overlay: IMPLEMENTED)
    Reused Knowledge    MK-OPPONENT-DEFENSE-SHAPE (C012 의 DefenseShape · C014 로 가려졌다)

    사다리 위치 — 이 Cycle 은 **탐험 사다리**(BW §19)의 둘째 걸음이며 전투 사다리
    (R1 §14)의 층이 아니다. FRINGE 진입이 요구하는 3종(관찰·예측·지형) 중 관찰 하나를
    C014 가 절반 세웠고, 이 Cycle 은 그 관찰을 **끝까지 세우지 않는다** — 남은 둘 중
    경로 하나만 닫는다. 행동·습성(MC-PREDICT 자리)은 EXCLUDED 다. 전투 사다리는
    Penetration + Critical 까지 서 있고 그 위(Active Defense · Aura/Nen)를 올리지 않는다.

    이 Cycle 이 세계에서 처음 만족시키는 것 — DC-WORLD-PROGRESSION-IS-REACH 의
    requires 두 줄(`progression_expands_reachable_world` ·
    `resource_can_open_capability_route`) 은 지금까지 세계에 실체가 없었다.
    능력치가 오르면 피해가 커지는 것은 C010 이 세웠지만, 그것은 **수치의 상승**이고
    이 Constraint 가 금지하는 축이다(`numeric_level_as_core_progression`). 이 Cycle 은
    능력이 오를 때 **대응 가능한 범위**가 넓어지는 첫 자리를 만든다 — 통찰이 높으면
    같은 상대 앞에서 아는 것이 더 많고, 고를 근거가 더 많다.

    Active Constraints  DC-WORLD-PROGRESSION-IS-REACH
                        DC-COMBAT-MATCHUP-SOFT
                        DC-WORLD-OWNS-THE-SURFACE-LIST    (GLOBAL)
                        DC-WORLD-PLAYER-UNFIXED-PATH
                        DC-COMBAT-ONE-LAYER-AT-A-TIME 은 무관하다 — 전투 층을 올리지 않는다
                        DC-COMBAT-PLAYER-CAUSALITY 는 무관하다 — 난수를 더하지 않는다
                        DC-COMBAT-SHARED-BUDGET 은 무관하다 — 통찰은 기력을 쓰지 않는다
                        DC-COMBAT-ONE-FORMULA 는 무관하다 — 피해 공식에 닿지 않는다

    Constraint Note
        DC-WORLD-PROGRESSION-IS-REACH
            진행의 결과가 숫자가 아니라 **닿는 범위**로 나타나야 한다. 통찰이 오르면
            늘어나는 것은 피해도 생존도 아니고 "살펴보지 않고도 아는 상대의 자리" 다.
            그 자리가 늘면 준비 없이 마주할 수 있는 상대가 늘고, 그것이 이 세계에서
            처음으로 나타나는 Reach 다 (BW §32 의 사슬 중 "이해" 칸이 능력에 걸린다).
        DC-COMBAT-MATCHUP-SOFT
            통찰이 **유일한 문이 되어서는 안 된다.** 통찰이 0 인 플레이어도 다가가
            살펴보면 똑같이 전부를 안다 — 통찰은 그 길을 짧게 할 뿐 다른 결과를 주지
            않는다. 그리고 아는 것은 여전히 정보뿐이다: 통찰은 피해 계산에 한 글자도
            더하지 않는다. 알아서 이기는 것이 아니라 알아서 고른다.
        DC-WORLD-OWNS-THE-SURFACE-LIST
            지금 무엇이 열려 있고 무엇이 아직 가려져 있는지의 **목록은 세계가 싣는다.**
            C014 가 세운 그 자리(관찰 계약의 가려진 항목 목록과 사유)가 그대로 나른다 —
            View 는 "통찰이 얼마면 무엇이 보인다" 를 자기 코드에 적지 않는다.
            항목이 존재 단위에서 항목 단위로 넓어져도 계약의 모양은 그대로다.
        DC-WORLD-PLAYER-UNFIXED-PATH
            통찰을 기르는 것이 **강제 경로가 되어서는 안 된다.** 통찰을 올리지 않은
            플레이와 올린 플레이가 둘 다 성립하고, 서로 다른 만큼 아는 채로 같은
            상대 앞에 설 수 있다는 것이 이 Cycle 의 플레이다.

## SCOPE NOTE — 무엇이 넓어지고, 무엇이 이 Cycle 밖인가

### 이 Cycle 은 C014 의 규칙을 뒤집지 않는다 — 그 규칙의 단위를 넓힌다

    C014 는 "살펴보기 전에는 남의 겨루는 힘을 모른다" 를 세웠고, 앎의 단위를
    **존재 하나**로 두었다 (알거나 · 모르거나). 이 Cycle 은 그 이분을 없애는 것이
    아니라 사이를 만든다 — 같은 상대에 대해 **어떤 자리는 열려 있고 어떤 자리는
    아직 가려져 있는** 상태가 세계에 생긴다.

        C014 까지    모른다 → (살펴봄) → 전부 안다
        이 Cycle 뒤   통찰이 정한 만큼 이미 안다 → (살펴봄) → 전부 안다

    살펴봄의 결과는 바뀌지 않는다. 마치면 여전히 전부 열린다.
    바뀌는 것은 **살펴보기 전의 상태**다.

### 왜 능력치인가 — 형태의 선례

    "앎에 이르는 다른 경로" 의 후보는 둘이었다: 능력치(성장)와 아이템(감정 도구).
    아이템 쪽은 **세계에 "아이템을 쓴다" 는 개념 자체가 없어서**(소지 개수만 있고
    소모·사용 규칙이 0건) 그 개념까지 함께 세워야 한다 — 한 Cycle 에 둘이다.
    능력치 쪽은 형태가 이미 세계에 있다 (C010 이 세운 겨루는 성질들, C007 R2 · C009 의
    값 조작 경로). 그래서 이쪽을 먼저 닫고, 아이템 경로는 이 위에 얹는다
    (frontier "지금 열 수 없는 것" — 부분 공개가 서면 남는 것은 "아이템 사용" 하나다).

    이 Cycle 은 `resource_can_open_capability_route` 의 **형태 선례**를 만든다 —
    FR-EARN-THE-PIERCING 과 같은 뿌리다 (frontier Note).

### Stage 2 · 3 이 정하고 Stage 5 가 확인할 판단 셋

    ① 통찰은 누구의 것인가 — 몸인가 관찰자인가
       C014 는 앎을 **관찰자**의 것으로 두었다 (한 몸을 둘이 번갈아 조종해도 앎은
       갈린다 — C014 06 NOTES ①). 그런데 통찰은 성장하는 **능력**이므로 몸의 성질로
       읽는 것이 자연스럽다. 둘 중 무엇으로 두는가에 따라 "다른 몸으로 갈아타면
       아는 것이 달라지는가" 가 갈린다. Stage 3 이 정하고 Stage 5 가 확인한다.
    ② 무엇이 먼저 열리는가
       가려질 수 있는 자리는 셋이다 (C014 가 세운 목록). 통찰이 오를 때 셋이
       한꺼번에 열리면 이분이 그대로 남는다 — 순서가 있어야 "일부만 안다" 가 생긴다.
       그 순서와 문턱 값은 Stage 3 의 밸런스다. 다만 **순서가 있어야 한다**는 것은
       이 Cycle 의 INCLUDED 다.
    ③ 상대에 따라 달라지는가
       같은 통찰으로도 어떤 상대는 읽히고 어떤 상대는 안 읽히는 것(상대의 깊이)은
       매력적이지만, 그것은 "가리는 쪽의 능력" 이며 C014 가 이미 EXCLUDED 로 박았다.
       이 Cycle 도 열지 않는다 — 통찰만이 유일한 변수다.

### 통찰을 무엇으로 올리는가 — 이번에는 세계 밖이다

    통찰을 **세계 안에서 기르는 경로는 이 Cycle 이 만들지 않는다.** 지금 세계에는
    어떤 능력치도 플레이로 올릴 방법이 없고(overlay MC-ATTACK-POWER PARTIAL —
    "디버그 명령이 유일한 경로"), 성장 경로를 여는 것은 그 자체로 한 Cycle 이다.

    이 Cycle 이 세우는 것은 **통찰이 무엇을 바꾸는가**이고, 값을 바꾸는 손은
    C007 R2 · C009 가 이미 세운 디버그 명령이다. 그 손으로 통찰을 올렸다 내리며
    가려짐이 변하는 것을 플레이로 확인한다 (Frontier — Observable Result).
    "무엇이 통찰을 기르는가" 는 다음 Frontier 의 몫이다.

## TYPE

    Existing Capability Enhancement
        MC-OBSERVE (C014) 의 확장이다. 새 행동도 새 계약 항목도 만들지 않는다 —
        앎의 단위를 존재에서 항목으로 넓히고, 앎에 이르는 두 번째 경로를 연다.
        전투 계산·판정·행동 체계는 건드리지 않는다.

## TARGET CAPABILITY

    Observe (앎) — 살펴봄 하나뿐이던 앎의 경로에 **기른 능력**을 더한다.
                   통찰이 높으면 살펴보지 않은 상대의 일부가 이미 열려 있다.

## GOAL

    플레이어가 기른 통찰이 높으면 살펴보지 않은 상대의 겨루는 힘 중 일부가
    이미 보이고, 낮으면 여전히 다가가 살펴봐야 한다 —
    같은 상대 앞에서 내가 무엇을 아는지가 내 능력에 따라 달라진다.

## INCLUDED

    통찰이라는 성질        존재가 지니는 성질 하나. 높을수록 살펴보지 않고도 아는 것이
                          많다. 값을 바꾸면 아는 범위가 즉시 달라진다
    항목 단위의 앎          앎이 존재 하나가 아니라 **자리마다** 정해진다. 같은 상대에
                          대해 어떤 자리는 열려 있고 어떤 자리는 가려져 있을 수 있다
    문턱의 순서            통찰이 오를 때 자리들이 한꺼번에 열리지 않는다 — 먼저 열리는
                          자리와 나중에 열리는 자리가 있다 (값은 Stage 3 밸런스)
    살펴봄은 그대로         살펴봄을 마치면 여전히 전부 열린다. 통찰과 무관하게 도달점은
                          같다 — 통찰은 길을 짧게 할 뿐이다 (UNFIXED-PATH · MATCHUP-SOFT)
    가려짐은 여전히 세계 것  지금 무엇이 가려져 있는지의 목록과 사유를 세계가 싣는다.
                          목록이 짧아지는 것으로 통찰이 화면에 드러난다 (SURFACE-LIST)
    관찰자마다 다르다       두 플레이어가 같은 상대 앞에서 서로 다른 만큼 알고 선다
                          (C004 관찰자별 투영 · C014 관찰자별 장부 재사용)
    디버그로 확인 가능       통찰 값을 올렸다 내리며 가려짐이 변하는 것을 플레이로 확인한다
                          (C007 R2 · C009 의 값 조작 경로 재사용)

## EXCLUDED

    통찰을 기르는 경로            성장·장비·수련 등 세계 안에서 통찰을 올리는 수단.
                                이번 경로는 디버그 명령뿐이다 (SCOPE NOTE)
    아이템으로 아는 경로           감정 도구 등. "아이템을 쓴다" 는 개념이 세계에 없다 —
                                이 Cycle 이 부분 공개를 세우면 남는 것은 그 개념 하나다
    예측 (MC-PREDICT)            행동·습성을 읽는 것. MC-OBSERVE 의 남은 결손 나머지 하나이며
                                다음 조각이다 (frontier FR-PREDICT-READS-THE-NEXT-BLOW)
    가려지는 범위의 변경           무엇이 가려질 수 있는가의 목록은 C014 가 정한 그대로다.
                                이 Cycle 은 그 목록에 더하지도 빼지도 않는다
    상대별 관찰 난이도             어떤 존재는 더 읽기 어렵다는 의미. 가리는 쪽의 능력은
                                C014 가 EXCLUDED 로 박았고 이 Cycle 도 열지 않는다
    통찰이 계산에 닿는 것          통찰로 피해·명중·방어가 달라지는 것. 통찰이 주는 것은
                                **정보뿐**이다 (MATCHUP-SOFT — 정보가 배율이 되면 하드 카운터다)
    부분적으로 틀린 정보           반쯤 아는 것이 "흐린 값" 이나 "대략의 범위" 로 나오는 것.
                                열린 자리는 언제나 참값이다 — 불완전성은 자리의 열림/가려짐
                                으로만 표현한다 (C014 의 Q3 판정 유지)
    통찰의 만료 · 망각             시간이 지나 다시 모르게 되는 것. 되돌리는 수단은 C014 가
                                세운 디버그 명령뿐이다
    자율 존재의 통찰              NPC 가 통찰로 다르게 판단하는 것. 자율 존재는 관찰 계약이
                                아니라 세계 상태를 직접 읽으므로 관문 밖이다 (C014 무변경)
    새 난수                     통찰이 확률로 열리는 것. 세계의 유일한 난수원은 C015 가
                                세운 자리이며 이 Cycle 은 그것을 쓰지 않는다
    지역 · 지형 · FRINGE 경계      SAFE↔FRINGE 진입은 지역이라는 세계 기반을 요구한다.
                                이 Cycle 은 현재 무대 안에서 닫힌다

## RELATED EXISTING CAPABILITY

    살펴봄 (C014)              앎의 장부 · 투영 관문 · 가려진 항목 목록과 사유 · 되돌리는
                              명령. 이 Cycle 이 확장하는 대상이자 재사용하는 바닥이다
    관찰자별 투영 (C004)        앎이 관찰자마다 다르다는 구조. 통찰이 관찰자별로 다른
                              결과를 내는 것이 이 위에 얹힌다
    겨루는 힘 (C010·C012·C013)  가려질 수 있는 세 자리의 내용. 값과 계산은 무변경이다
    성질과 값 조작 (C007 R2·C009) 존재가 성질을 지니는 구조와, 그 값을 밖에서 바꾸는 명령.
                              통찰이라는 성질이 이 구조에 얹히고 확인 경로가 된다
    흔들림 (C015)              무관하다 — 통찰은 확률을 쓰지 않는다. 다만 가려진 자리
                              하나가 C015 가 더한 항목을 품고 있어 함께 열린다
