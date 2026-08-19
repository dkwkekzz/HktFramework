# CYCLE C014 — Observe Reveals the Opponent

[PASS] Cycle Definition
[    ] Intent
[    ] World Semantic
[    ] GameView Specification
[    ] Human Semantic Review
[    ] World Implementation
[    ] View Implementation
[    ] Verification

STATUS  IN PROGRESS

## MASTER TRACE

    Frontier            FR-OBSERVE-REVEALS-THE-OPPONENT   (2026-08-19 Human Select)
    Source Goal         MG-EXPLORE-BEIRA
                        "자신이 이해하고 대응할 수 있는 세계의 범위가 지금보다 넓다 —
                         이전에는 갈 수 없던 베이라의 영역에 닿는다" (BW §1 · §32)
    Source Possibility  MP-VENTURE-INTO-FRINGE
                        "가장 얕은 진입이다 — 위험은 강한 토착 포식자뿐이고, 요구되는 것은
                         힘이 아니라 관찰·예측·지형 활용이라는 정보 능력이다. 다른 층 진입과
                         달리 문명권의 기본 전투 능력만으로도 생존 여지가 있다" (BW §21)
    Target Capability   MC-OBSERVE                (overlay: MISSING)
                        "행동하기 전에 대상을 관찰하여 그 행동·습성·상태의 정보를 얻는다"
    쪼갠 사유           FRINGE 진입 요구 3종 중 첫 하나다. 셋을 한 Cycle 에 닫으면 관찰·예측·
                        지형이 각각 검증되지 않으며, MC-OBSERVE 는 지역 기반 없이 현재 전투
                        세계 안에서 닫을 수 있는 유일한 조각이다 (Frontier — Missing / Partial)
    Reused Capability   MC-ATTACK-ARMOR-MATCHUP   (overlay: IMPLEMENTED — C012)
                        MC-PENETRATION            (C013 — 기계 검증 완료, Human Play 확인 대기)
                        MC-COMBAT-CAUSE-READING   (overlay: PARTIAL — C007 R2 · C009 · C010)
    Reused Knowledge    MK-OPPONENT-DEFENSE-SHAPE (C012 의 Actor.DefenseShape)

    사다리 위치 — 이 Cycle 은 **탐험 사다리**(BW §19 SAFE → FRINGE → …)의 첫 칸이며
    전투 사다리(R1 §14)의 층이 아니다. 전투 사다리는 Penetration 까지 서 있고 그 위
    (Active Defense · Aura/Nen)를 이 Cycle 이 올리지 않는다. 무대는 전투 안이지만 —
    현재의 적대 존재가 FRINGE 토착 포식자로 자리매김되어 있기 때문이다 (Q18(a) 매핑) —
    더해지는 의미는 전투 층이 아니라 정보 능력 한 칸이다.

    Active Constraints  DC-WORLD-PROGRESSION-IS-REACH
                        DC-COMBAT-MATCHUP-SOFT
                        DC-WORLD-OWNS-THE-SURFACE-LIST    (GLOBAL)
                        DC-WORLD-PLAYER-UNFIXED-PATH
                        DC-COMBAT-ONE-LAYER-AT-A-TIME 은 무관하다 — 전투 층을 올리지 않는다
                        DC-COMBAT-PLAYER-CAUSALITY 는 무관하다 — 난수도 판정도 더하지 않는다
                        DC-COMBAT-SHARED-BUDGET 은 무관하다 — 관찰은 기력을 쓰지 않는다 (EXCLUDED)

    Constraint Note
        DC-WORLD-PROGRESSION-IS-REACH
            BW §32 가 Progression 의 축으로 지정한 사슬은 `관찰 → 이해 → 대응 발견 →
            Capability → …` 이고, 그 **첫 칸이 세계에 없다.** 이 Cycle 이 세우는 것은
            수치 상승이 아니라 그 첫 칸이다. 관찰의 결과는 능력치가 아니라 "무엇으로
            칠지 고를 근거" 이며, 그것이 대응 가능한 범위의 확장이다.
        DC-COMBAT-MATCHUP-SOFT
            `weakness_is_observable` 은 유지된다 — 뜻이 "언제나 눈앞에 있다" 에서
            "관찰 행동을 하면 알 수 있다" 로 읽힌다. 약점을 가리는 것이 아니라 **아는
            방법을 행동으로 만든다.** 관찰하지 않은 쪽도 계속 싸울 수 있어야 하며
            (하드 카운터 금지의 정보판), 관찰 여부가 배율이 되어서는 안 된다 —
            관찰은 피해 계산에 한 글자도 더하지 않는다.
        DC-WORLD-OWNS-THE-SURFACE-LIST
            무엇이 기본 공개이고 무엇이 관찰 뒤에 있는지의 **목록을 세계가 소유한다.**
            가려진 자리는 View 가 빈칸으로 짐작하는 것이 아니라, 세계가 "아직 관찰하지
            않았다" 는 사실과 사유를 관찰 계약에 실어 보낸다. 관찰 행동의 가용성과
            불가 사유도 같은 계약에 실린다.
        DC-WORLD-PLAYER-UNFIXED-PATH
            관찰은 **강제 절차가 아니라 선택이다.** 관찰해야만 공격할 수 있게 만들지
            않는다. 보지 않고 덤비는 플레이와 관찰하고 덤비는 플레이가 둘 다 성립하고,
            서로 다른 정보를 가진 채 싸우는 것이 이 Cycle 의 플레이다.

## SCOPE NOTE — 무엇이 가려지고, 그 결정의 권한은 어디에 있는가

### 이 Cycle 은 기존 의미 하나를 뒤집는다

    현재 세계에는 반대 방향의 의미가 명시적으로 서 있다.

        INTENT-ATTRIBUTE-OBSERVE-001 (C007 R2 — Human Review 로 추가)
        "세계는 어떤 속성도 숨기지 않는다. 모든 Actor 의 모든 속성은 누구의 것이든
         관찰될 수 있다. 무엇을 언제나 눈앞에 띄워 둘지는 보는 이의 선택이지
         세계의 제한이 아니다."

    이 Cycle 은 그 문장을 바꾼다. 근거는 지어낸 것이 아니라 **더 나중의 Human 결정**이다.

        Q3 (2026-08-19 CLOSED) — "전투 정보는 상황에 따라 부분적으로 보여질 수도
        가려질 수도 있다." 정보의 불완전성은 틀리게 믿는 것(Belief)이 아니라
        **관찰 범위**로 다룬다 — 무엇이 언제 관찰에 실리는가는 각 Cycle 의 관찰 계약이
        소유한다 (`master/graph/knowledge.yaml` 상시 규칙).

    즉 C007 R2 의 "세계의 제한이 아니다" 는 Q3 로 이미 부분 철회되어 있었고, 이 Cycle 이
    그 결정을 처음으로 세계 규칙으로 세운다. Stage 2 는 이것을 **CHANGED** 로 기록한다 —
    새 Intent 를 옆에 붙이고 옛 Intent 를 그대로 두는 것은 두 규칙이 모순인 채 남는 것이다.

### Stage 5 가 확인해야 하는 판단 둘

    ① C007 R2 개정의 범위
       Q3 의 문장은 "전투 정보" 다. 이 Cycle 이 가리는 범위를 아래 한 줄로 잡았으나
       (다음 항), 그 선이 Human 이 의도한 선인지는 Semantic Review 가 확인한다.

    ② DT R0 §10 관찰 계약과의 조정
       DT §10 은 "상대의 Armor 와 Resistance 는 **적어도 전투 전에** 비교 가능한 값
       또는 세계가 계산한 표현으로 제공한다" 고 요구한다. 관찰 행동 뒤로 옮기는 것은
       "제공하지 않는다" 가 아니라 "제공받는 방법이 행동이 된다" 는 읽기이며,
       Frontier 의 Constraint Eval 이 그렇게 판정했다 (MATCHUP-SOFT SATISFIED).
       그 읽기를 Human 이 승인하는 자리가 Stage 5 다. 승인되지 않으면 이 Cycle 은
       `MASTER GAP` 으로 위층에 돌아간다 — 그때는 DT §10 개정이 필요하기 때문이다.

### 가려지는 선 — 몸에서 바로 읽히는 것과 겨뤄 봐야 아는 것

    한 줄로 긋는다. 이 선이 이 Cycle 의 유일한 새 경계다.

        공개로 남는다   위치 · 지금 하는 행동 · 이름 · 종류 · 생명 · 기력 ·
                        이동 방식과 빠르기 · 지금 걸려 있는 배율 · 타격 기록
                        — 몸과 움직임에서 바로 읽히는 것이다 (C007 INTENT-ENTITY-OBSERVE-001)
        관찰 뒤에 있다   남의 **전투 능력** — C012 가 세운 네 능력치와 두 방어 배율,
                        C013 이 더한 관통 둘과 versusObserver
                        — 겨뤄 보거나 살펴봐야 아는 것이다

    자기 몸은 전부 공개로 남는다 (INTENT-SELF-OBSERVE-001 무변경). 가리는 대상은
    **관찰자 자신이 아닌 존재**뿐이다.

    이 선을 고른 이유: C012·C013 이 "무엇으로 칠지" 를 플레이어의 선택으로 만들었고,
    그 선택의 유일한 근거가 남의 방어 능력이다. 그 근거를 관찰 뒤로 옮겨야 관찰이
    준비를 바꾸는 것이 실측된다 (Frontier — Observable Result). 기력·템포까지 함께
    가리면 한 Cycle 에 두 개의 경계를 세우는 것이고, 어느 쪽이 플레이를 바꿨는지
    검증되지 않는다.

### 관찰의 대가

    관찰은 공짜가 아니어야 선택이 된다. 대가는 **시간과 거리**다.

        시간   관찰은 진행 시간을 가지는 행동이며 그동안 다른 것을 하지 못한다.
               싸우는 중에 관찰하면 그 사이에 맞는다 — 그것이 대가다.
        거리   대상에 닿을 수 있는 거리 안에서만 성립한다. 알기 위해 다가가는 것
               자체가 위험이다 (BW §21 — FRINGE 는 정보로 넘는 층이다).

    기력은 쓰지 않는다. 기력을 쓰는 자리는 이미 셋(고급 스킬·달리기·막기)이고
    스스로 돌아오지 않는 결손이 남아 있다 (overlay MC-CP-ECONOMY PARTIAL).
    네 번째 자리를 여는 것은 이 층의 의미가 아니다.

    구체적인 시간·거리 값은 Stage 3 이 밸런스로 소유한다.

## TYPE

    New Capability
        Observe — 세계에 없던 정보 능력 하나. 다만 **기존 관찰 계약의 CHANGED 를
        동반한다** (INTENT-ATTRIBUTE-OBSERVE-001 · Observer Projection).
        새 전투 층이 아니며 피해 공식·판정·행동 체계를 건드리지 않는다.

## TARGET CAPABILITY

    Observe — 대상을 살펴보아야 그 존재의 전투 능력이 드러난다.
              관찰하지 않은 상대는 무엇을 지녔는지 모르는 채로 마주한다.

## GOAL

    플레이어가 상대의 전투 능력을 모르는 채로 마주하고,
    그 상대를 관찰하는 행동을 마쳐야 비로소 그 값이 드러나
    무엇으로 칠지를 근거를 가지고 고를 수 있다.
    관찰하지 않고 덤비는 것도 여전히 가능하다 — 다른 정보를 가진 채 싸울 뿐이다.

## INCLUDED

    관찰 행동            대상 하나를 정해 수행하는 새 행동. 진행 시간을 가지며
                        그동안 다른 행동을 하지 못한다 (기존 행동 상태 구조 재사용)
    관찰 관문            대상이 관찰 가능한 거리 안에 있어야 성립한다. 지금 관찰할 수
                        있는가와 없다면 그 사유가 관찰 계약에 실린다 (기존 가용성·사유 계약)
    관찰 이전 / 이후      관찰 전에는 남의 전투 능력 자리가 **비어 있고**, 관찰 후에는
                        같은 자리가 채워진다. 채워진 뒤에는 세계의 현재 값이 실린다
    관찰자별 사실         무엇을 관찰했는가는 관찰자마다 다르다 (C004 관찰자별 투영 재사용).
                        한 관찰자가 관찰한 사실은 그 관찰자에게 남아 매번 다시 하지 않는다
    가려짐도 관찰이다      "값이 없다" 가 아니라 "아직 관찰하지 않았다" 라는 사실과 사유를
                        세계가 실어 보낸다. View 가 빈칸을 스스로 해석하지 않는다
                        (DC-WORLD-OWNS-THE-SURFACE-LIST)
    가려지는 범위         관찰자 자신이 아닌 존재의 전투 능력 — 공격 둘 · 방어 둘 ·
                        관통 둘 · 방어 배율 둘 · versusObserver. 그 외는 공개 유지 (SCOPE NOTE)
    관찰이 준비를 바꾼다   관찰 전과 후에 플레이어가 고르는 공격 방식이 달라질 수 있다는 것이
                        실제 플레이로 확인된다 (C012 의 타입 선택이 근거를 얻는다)
    디버그 명령 갱신      관찰 상태를 되돌리는 수단을 명령 카탈로그에 더한다 (C009) —
                        관찰 전/후를 반복해 비교하는 확인 경로다

## EXCLUDED

    예측 (MC-PREDICT)              관찰한 정보로 다음 행동을 미리 읽는 것은 다음 조각이다
                                   (BW §21 · Frontier 7조건 7)
    지형 활용 (MC-USE-TERRAIN)      지형이 판정에 쓰이는 의미 — 세계 기반이 없다
    지역 · 이동 · FRINGE 경계        SAFE↔FRINGE 진입 자체는 지역이라는 세계 기반을 요구한다.
                                   이 Cycle 은 현재 전투 무대 안에서 닫힌다
    틀린 정보 · 오독 · Belief        Q3 이 기각했다. 관찰 결과는 언제나 참이다 —
                                   불완전성은 "가려짐" 으로만 표현한다
    관찰 저항 · 은폐 · 관찰 난이도 차등  존재마다 관찰이 더 어렵거나 관찰을 방해하는 의미.
                                   가리는 쪽의 능력은 이 층이 세우는 것이 아니다
    관찰이 주는 이득 그 자체          관찰로 피해가 오르거나 명중이 붙는 것. 관찰이 주는 것은
                                   **정보뿐**이다 — 계산에 한 글자도 더하지 않는다
                                   (DC-COMBAT-MATCHUP-SOFT — 관찰이 배율이 되면 하드 카운터다)
    기력 소모                       SCOPE NOTE — 기력을 쓰는 네 번째 자리를 열지 않는다
    관찰 시점 값의 고정(stale)       관찰은 "그 값을 안다" 는 사실이며, 열린 뒤에는 세계의
                                   현재 값이 실린다. 관찰 당시의 숫자를 굳혀 두지 않는다
    관찰 결과의 만료 · 망각          시간이 지나 다시 모르게 되는 것. 되돌리는 수단은
                                   디버그 명령뿐이다 (확인 경로)
    자율 존재의 관찰                 NPC 가 관찰 행동을 하고 그 결과로 판단을 바꾸는 것.
                                   RULE-NPC-DECIDE-001 은 지금 그대로다
    자기 몸 · 몸에서 읽히는 것을 가리기  INTENT-SELF-OBSERVE-001 과 위치·행동·생명·기력·
                                   템포의 공개는 그대로다 (SCOPE NOTE 의 선)
    새 모션 자산                    관찰 행동의 전용 모션 시트를 만들지 않는다.
                                   기존 fallback 으로 관찰된다 — 표현은 View 의 결정이다
    Critical · Active Defense       전투 사다리의 위층. 이 Cycle 은 전투 층을 올리지 않는다

## RELATED EXISTING CAPABILITY

    재사용
        Observer Projection         C004 — INTENT-PER-OBSERVER-PROJECTION-001.
                                    "관찰자마다 다른 결과" 라는 구조가 이미 있다.
                                    관찰 여부는 그 구조에 얹히는 두 번째 관찰자별 사실이다
        RULE-ACTION-BEGIN-001       C002 — 행동 시작 관문. 새 행동 하나가 더해진다
        행동 종류와 진행 시간         C002 — 항목 하나가 더해진다. 구조는 바뀌지 않는다
        가용성 · 불가 사유 계약        C007 · C009 — 지금 할 수 있는가와 없다면 왜인지를
                                    세계가 싣는 형식. 관찰도 같은 형식을 쓴다
        RULE-SWING-STRIKE-001       C006 — 거리 판정. 새 거리 개념을 만들지 않는다
        Actor.DefenseShape          C012 — MK-OPPONENT-DEFENSE-SHAPE. 관찰 뒤에 드러나는 값
        versusObserver              C013 — 두 존재 사이의 값. 관찰 뒤에 드러나는 값
        RULE-ATTRIBUTE-SET-001      C009 — 관찰 상태를 되돌리는 명령이 이 자리에 붙는다
        Observer Join / Leave       C004 — 관찰자의 수명. 관찰한 사실의 수명이 여기에 걸린다

    변경 예상
        INTENT-ATTRIBUTE-OBSERVE-001  C007 R2 — "세계는 어떤 속성도 숨기지 않는다" 가
                                      "무엇이 기본 공개이고 무엇이 관찰 뒤인가를 세계가
                                      소유한다" 로 바뀐다 (SCOPE NOTE — 근거는 Q3)
        Observer Projection           남의 combatStats · versusObserver 가 관찰 여부에 따라
                                      실리거나 사유와 함께 비어 있다
        행동 종류 목록                 관찰 행동 하나가 더해진다
        명령 카탈로그                  관찰 상태를 되돌리는 항목
        관찰자 상태                    관찰자가 무엇을 관찰했는가를 세계가 지닌다

    영향 예상
        C007 R2 검증                  "세계는 어떤 속성도 숨기지 않는다" 를 확인하던 기존
                                      검증은 이번에 의미가 바뀐다. 지우는 것이 아니라 새 경계로
                                      다시 쓴다 — 무엇이 여전히 안 가려지는가가 그 자리다
        C012 · C013 관찰 실측           남의 방어·관통·versusObserver 를 읽는 기존 검증은
                                      **관찰한 뒤** 같은 값이 나와야 한다 (Regression)
        C010 계산 내역 관찰             타격 기록(DamageBreakdown)은 가리지 않는다 —
                                      맞아 본 것은 이미 겨뤄 본 것이다. 그대로여야 한다 (Regression)
        View 전투 표시                 상대 능력치를 보여 주던 자리가 비어 있을 때
                                      무엇을 보여 줄지 — 표현 결정은 Stage 7 의 몫이다
        RULE-NPC-DECIDE-001            C007 — 자율 존재의 판단은 그대로다. 세계의 사실을
                                      읽는 경로는 관찰 계약이 아니므로 영향받지 않아야 한다 (Regression)

## NOTE — 선행 Cycle 상태

    C013 (Penetration) 은 기계 검증 아홉 항을 통과했으나 Human Play 확인 전이라
    STATUS 가 IN PROGRESS 다. 이 Cycle 은 C013 이 세운 관찰값(versusObserver)을
    가리는 쪽에 포함하므로, C013 의 Play 확인이 이 Cycle 의 구현 전에 끝나는 것이
    깔끔하다. 확인 순서는 Human 이 정한다 — 이 Cycle 의 Stage 2~4 는 그와 무관하게
    진행할 수 있다.
