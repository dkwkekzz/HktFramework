# CYCLE C011 — Perfect Guard Turns the Table

[PASS] Cycle Definition            (R1 — 자세 재세움 간격)
[PASS] Intent                     (R1 — 자세 재세움 간격)
[PASS] World Semantic
[    ] GameView Specification
[    ] Human Semantic Review
[    ] World Implementation
[    ] View Implementation
[    ] Verification

STATUS  IN PROGRESS

## MASTER TRACE
    Frontier            FR-PERFECT-GUARD-TURNS-THE-TABLE
    Source Goal         MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility  MP-READ-AND-COUNTER
    Target Capability   MC-PERFECT-GUARD       (overlay: MISSING)
                        MC-COUNTER             (overlay: MISSING)
    Reused Capability   MC-GUARD               (overlay: C010 이 IMPLEMENTED 로 보고함 —
                                               MP-READ-AND-COUNTER 가 함께 요구한다)
                        MC-CP-ECONOMY          (overlay: PARTIAL — MP 가 함께 요구한다.
                                               이 Cycle 에서 기력이 처음으로 *방어로* 늘어난다)
    Active Constraints  DC-COMBAT-PLAYER-CAUSALITY · DC-COMBAT-DEFENSE-IS-ACTIVE
    Constraint Note
        DC-COMBAT-PLAYER-CAUSALITY
            완벽한 막기의 성패에 우연을 넣지 않는다. 갈리는 것은 오직 두 시각의 관계 —
            막기를 세운 세계 시각과 타격이 닿은 세계 시각이다. 같은 두 시각이면 언제나
            같은 결과이며, 그 두 시각과 그 차이가 관찰 가능해야 한다.
            반격의 큰 숫자도 마찬가지다 — 명시된 노출 조건이 성립할 때만 커진다.
        DC-COMBAT-DEFENSE-IS-ACTIVE
            C010 이 이 Constraint 의 첫 requires(defense_as_player_action)만 닫았고,
            두 번째 requires(defense_success_creates_offense_opportunity)를
            "MP-READ-AND-COUNTER 가 이어받는다" 며 다음 Cycle 로 인계했다
            (C010/01-cycle.md MASTER TRACE · 05-review.md 판단 2).
            **이 Cycle 이 그 인계를 받는 Cycle 이다** — 막아 낸 것이 곧 때릴 기회가 된다.
        DC-COMBAT-SHARED-BUDGET (직접 지정은 아니나 건드리므로 함께 지킨다)
            완벽한 막기의 보상도 전용 자원을 신설하지 않는다. C007 의 기력(Cp) 하나가
            늘어날 뿐이며, 그 기력은 여전히 스킬·달리기와 경쟁한다.

## TYPE
    New Capability + Existing Capability Enhancement

    New         완벽한 막기 판정(시점) · 노출 상태 · 반격 보정 — 셋 다 세계에 없다
    Enhancement C010 의 막기(Stance)와 C007 의 타격 규칙이 이 판정을 태우도록 확장된다.
                막기는 이제 "언제 세웠는가" 를 기억하고, 타격은 네 갈래에서 다섯 갈래가 된다

## TARGET CAPABILITY
    Perfect Guard (완벽한 막기 — 공격이 닿기 직전에 세운 막기)
    Exposed / Counter (노출 — 완벽하게 막힌 자가 잠시 열리는 것 · 그 틈을 때리는 되받아침)

## GOAL
    플레이어는 공격이 닿기 직전에 막기를 세워 피해를 전혀 받지 않고 기력을 오히려 얻으며,
    그렇게 막힌 상대는 잠시 열린 상태가 되어 그동안 때리면 평소보다 큰 피해를 준다.

## INCLUDED

    ── 시점이 가르는 막기 ────────────────────────────────────────────
    막기 시작 시각       막기를 세운 세계 시각을 몸이 기억한다.
                         C010 의 막기는 "지금 막고 있는가" 만 알았고 "언제부터" 를 몰랐다
    완벽 판정            타격이 닿은 시각이 막기를 세운 시각으로부터 아주 짧은 창 안이면
                         그 막기는 완벽한 막기다. 창을 벗어나면 C010 의 보통 막기 그대로다.
                         우연은 없다 — 두 시각의 차이 하나가 결과를 가른다
                         (DC-COMBAT-PLAYER-CAUSALITY)
    완벽하게 막은 결과   생명이 전혀 줄지 않는다. 기력을 치르지 않는다.
                         오히려 기력을 얻는다 — 읽어 낸 방어는 자원을 벌어들인다
    창은 한 번만 열린다  하나의 막기에서 완벽한 막기는 되풀이되지 않는다.
                         세우고 버티는 것으로 계속 완벽할 수는 없다 —
                         다시 완벽하려면 놓았다가 다시 세워야 한다
    방향은 그대로        완벽한 막기도 앞쪽만 막는다 (C010 GUARD_FRONT_COS 재사용).
                         옆·뒤에서 들어온 타격은 시점이 맞아도 완벽하지 않다

    ── 노출 ──────────────────────────────────────────────────────────
    노출 상태            완벽하게 막힌 타격을 낸 자는 잠시 열린 상태가 된다.
                         정해진 세계 시각까지 이어지고 그 시각을 지나면 저절로 가신다
    노출의 의미          열려 있는 동안 받는 타격은 반격이 된다.
                         노출은 그 자체로 아프지 않다 — 열려 있을 뿐이다
    노출과 자세          열린 몸도 막을 수는 있다. 다만 그 사이에 맞으면 크게 맞는다
                         (막기가 노출을 지우지 않는다)

    ── 되받아침 ──────────────────────────────────────────────────────
    반격 보정            열린 상대를 때리면 그 타격의 본래 피해가 정해진 만큼 커진다.
                         이 증폭은 방어력 감쇄보다 먼저 걸린다 — 본래 피해가 커지는 것이다
    누구든 열리면 맞는다 노출은 관찰자와 자율 존재 모두에게 생기고,
                         반격 보정도 때린 쪽이 누구든 똑같이 걸린다
    되받아칠 수 있는 몸  완벽하게 막은 직후의 몸은 막기를 놓고 바로 때릴 수 있어야 한다 —
                         C010 의 "막는 동안 스킬 시작 불가" 는 그대로이되,
                         자세를 놓는 것은 언제나 가능하므로 (C010 RULE-GUARD-SET-001)
                         새 규칙 없이 성립한다. 이 Cycle 은 그것을 확인만 한다

    ── 관찰 ──────────────────────────────────────────────────────────
    완벽했는가           타격 내역에 "완벽하게 막혔는가" 와 그것을 가른 시간 차가 실린다.
                         왜 완벽했고 왜 아니었는지를 숫자로 되짚을 수 있다
    누가 열려 있는가     누가 지금 노출되어 있고 언제까지인지 모든 관찰자가 본다
    반격이었는가         타격 내역에 "반격이었는가" 와 그것이 키운 몫이 실린다
    지금 완벽할 수 있는가 자기 정보에서 완벽 창이 아직 남았는지 확인한다

## EXCLUDED
    균형 · 붕괴 누적     완벽한 막기가 상대에게 균형 부담을 쌓지 않는다.
                         노출은 시간으로 끝나지 균형으로 무너지지 않는다
                         (FR-BREAK-OPENS-THE-BURST-WINDOW)
    반격 균형 배수       원본 §8.4 의 COUNTER_BREAK_MULTIPLIER 는 이번에 없다 —
                         균형이라는 값 자체가 아직 세계에 없기 때문이다
                         (FR-BREAK-OPENS-THE-BURST-WINDOW)
    스킬별 반격 창       스킬이 자기만의 Counter Window 를 정의하지 않는다.
                         반격 조건은 "상대가 열려 있는가" 하나다 (원본 §8.4 의 두 조건 중 하나만)
    자세 배분 (Flow)     완벽한 막기가 배분을 바꾸지 않는다 (FR-FLOW-OPENS-THE-BODY)
    공격·방어 타입 상성  반격 보정은 타입과 무관한 한 값이다 (FR-MATCHUP-MAKES-THE-CHOICE)
    회피                 몸을 굴려 피하는 행동 없음 (원본 §8.3 — 아직 Frontier 가 아니다)
    노출 중 행동 강제    열렸다고 하던 행동이 끊기거나 움직이지 못하지 않는다.
                         노출은 받는 결과만 바꾼다 — 조작을 빼앗지 않는다
    노출의 겹침 누적     여러 번 완벽하게 막혀도 노출이 길어지거나 깊어지지 않는다.
                         마지막 노출이 끝나는 시각만 뒤로 밀린다
    NPC 의 완벽한 막기   자율 존재는 여전히 막지 않는다 (C010 EXCLUDED 그대로).
                         다만 자율 존재도 **노출되고 반격당한다** — 그것이 이 Cycle 의 플레이다
    완벽한 막기 전용 자원 신설하지 않는다. 얻는 것은 C007 의 기력이다
                         (DC-COMBAT-SHARED-BUDGET)
    무너짐과의 상호작용  완벽한 막기는 기력을 치르지 않으므로 무너뜨릴 수 없다.
                         C010 의 무너짐 규칙은 그대로이며 새 갈래를 만들지 않는다

## RELATED EXISTING CAPABILITY
    Guard Stance             (C010) — Actor.Stance 를 그대로 쓴다. 새 자세를 만들지 않는다.
                             막기를 세우는 RULE-GUARD-SET-001 이 시각을 함께 남기도록 확장된다
    RULE-STRIKE-DAMAGE-001   (C010·C007) — 네 갈래가 다섯 갈래로 갈린다 (CHANGED 예정).
                             완벽 갈래가 보통 막기 갈래 앞에 선다
    StrikeEvent 내역 6종     (C010) — 여기에 완벽 여부·시간 차·반격 여부가 더해진다 (CHANGED 예정)
    Combat Vitals            (C007) — 완벽한 막기의 보상이 Cp 로 들어온다.
                             CpMax 를 넘지 않는다 (기존 clamp 재사용)
    World.Time · Tick        (C003) — 두 시각의 비교가 이루어지는 자리.
                             노출이 가시는 것도 C010 의 무너짐 여파와 같은 방식
                             (만료 Rule 없이 시각 비교)으로 다룬다
    Body Facing              (C006) — 완벽 판정도 같은 정면 조건을 쓴다
    Observer Projection      (C004) — 노출·완벽·반격이 Projection 에 실린다
    Attribute Set            (C009·C007 R2) — 노출을 세계 밖의 손으로 세워 볼 수 있어야
                             혼자서도 반격을 확인할 수 있다
    Command Catalog          (C009) — 완벽한 막기·노출·반격을 명령으로 관찰·재현한다

## WHY ONE CYCLE
    새 판정 1종(시점) + 새 상태 1종(노출) + 기존 타격 규칙의 갈래 1개 추가.
    C010 이 막기·방향·타격 내역을, C007 이 기력과 피해 계산을, C003 이 세계 시각을
    이미 세워 두었으므로 이 Cycle 은 그 위에 "언제 세웠는가" 하나를 얹는다.

    이번 Cycle 이 끝나면 플레이어는 같은 막기 버튼으로 두 가지 다른 결과를 낼 수 있게 된다 —
    늦게 세우면 기력을 치르며 버티고, 읽어서 세우면 기력을 벌며 상대를 연다.
    C010 이 "막기만으로는 버틸 수 없다" 를 가르쳤다면 이 Cycle 은 그 막다른 길의 출구를 준다:
    버티는 막기는 자원이 마르지만 읽어 낸 막기는 자원을 벌어 공격으로 이어진다.
    이것이 원본 §3.2 가 말하는 "방어 성공은 공격 기회다" 이며,
    DC-COMBAT-DEFENSE-IS-ACTIVE 의 두 번째 requires 가 여기서 닫힌다.

## REVISION
    R1  (03-world-semantic.md 착수 중, Human Review 이전) INCLUDED 의
        "창은 한 번만 열린다 — 다시 완벽하려면 놓았다가 다시 세워야 한다" 는
        자세를 놓았다 세우는 데 아무 대가가 없으면 성립하지 않는다.
        막기를 연타하면 창이 매번 새로 열려 언제나 완벽해지고, 그러면 이 Cycle 의
        Goal("읽어서 세우면")이 사라진다.
        따라서 **자세를 다시 세우기까지의 최소 간격**을 세계 규칙으로 둔다 —
        놓는 것은 언제나 되지만, 세우는 것은 직전에 세운 뒤 한 호흡이 지나야 된다.
        시작하지 못하면 그 사유가 관찰된다 (C010 의 막기 실패 사유 네 가지에 하나 추가).
        Goal · INCLUDED · EXCLUDED 의 의미는 바뀌지 않는다 —
        "되풀이되지 않는다" 를 실제로 성립시키는 조건이 정해진 것이다.
        영향 Artifact: 02-intent.md (R1) · 03-world-semantic.md

## FRONTIER NOTE
    `master/frontier.md` 의 선택 기록 표는 아직 비어 있다 (`아직 선택 없음`).
    Cycle Agent 는 `master/` 를 편집하지 않으므로 이 Cycle 은 표를 갱신하지 않는다 —
    C010(FR-GUARD-TRADES-BODY-FOR-RESOURCE)과 이 Cycle 의 선택 기록은
    Master Feedback Stage 가 함께 반영한다. 선택 근거는 frontier.md 의 추천 순서 2번과
    `Depends On  FR-GUARD-TRADES-BODY-FOR-RESOURCE` 가 C010 으로 충족된 것이다.
