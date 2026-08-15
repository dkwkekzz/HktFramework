# CYCLE C010 — Guard Trades Body for Resource

[PASS] Cycle Definition
[PASS] Intent                    (R1 — 막기를 행동이 아니라 자세로 고쳐 씀)
[PASS] World Semantic
[PASS] GameView Specification
[PASS] Human Semantic Review     APPROVED (05-review.md)
[PASS] World Implementation
[PASS] View Implementation
[    ] Verification

STATUS  IN PROGRESS

## MASTER TRACE
    Frontier            FR-GUARD-TRADES-BODY-FOR-RESOURCE
    Source Goal         MG-SURVIVE-ENEMY-OFFENSIVE
    Source Possibility  MP-TRADE-BODY-FOR-RESOURCE
    Target Capability   MC-GUARD               (overlay: MISSING)
                        MC-DEFENSE-MITIGATION  (overlay: MISSING)
                        MC-CP-ECONOMY          (overlay: PARTIAL → 방어가 같은 예산을 쓰기 시작한다)
    Reused Capability   MC-BODY-FACING         (overlay: IMPLEMENTED — MP 가 함께 요구한다)
    Active Constraints  DC-COMBAT-DEFENSE-IS-ACTIVE · DC-COMBAT-SHARED-BUDGET ·
                        DC-COMBAT-PLAYER-CAUSALITY
    Constraint Note
        DC-COMBAT-DEFENSE-IS-ACTIVE
            막기는 수치가 아니라 플레이어가 고르는 행동이어야 한다 (requires:
            defense_as_player_action). 이 Cycle 은 그것을 세운다.
            같은 Constraint 의 두 번째 requires(defense_success_creates_offense_opportunity)
            는 이 Cycle 이 닫지 않는다 — Master 가 MP-TRADE-BODY-FOR-RESOURCE 를
            SATISFIED 로 판정하며 "공격 기회 전환은 같은 행동 위의 정확한 시점
            경로(MP-READ-AND-COUNTER)가 이어받는다" 고 명시했다
            (`master/graph/possibilities.yaml`). 그 경로가
            FR-PERFECT-GUARD-TURNS-THE-TABLE 이며 이 Cycle 의 막기 위에 얹힌다.
            따라서 MASTER GAP 이 아니라 다음 Cycle 로의 인계다.
        DC-COMBAT-SHARED-BUDGET
            방어용 전용 게이지를 만들지 않는다. C007 의 기력(Cp) 하나를 그대로 쓴다.
            막기가 기력을 쓰기 시작하면 같은 기력이 고급 스킬과 달리기와 경쟁한다.
        DC-COMBAT-PLAYER-CAUSALITY
            막힌 결과에 우연을 넣지 않는다. 같은 방향·같은 기력·같은 타격이면
            언제나 같은 결과다. 줄어든 양과 그 원인이 관찰 가능해야 한다.

## TYPE
    New Capability    막기(Guard) 라는 새로운 방어 행동과 피해 감쇄라는 새 값
                      기존 타격 규칙(C007 RULE-STRIKE-DAMAGE-001)은 이 규칙의 영향을 받아
                      결과가 분기하도록 변경된다

## TARGET CAPABILITY
    Guard (막기 — 앞을 향해 버티며 들어온 타격을 생명 대신 기력으로 받아내는 행동)

## GOAL
    플레이어는 앞을 향해 막기를 유지하여 정면에서 들어온 타격을 생명 대신 기력으로 받아내고,
    받아낼 기력이 다하면 방어가 무너져 그대로 얻어맞는다.

## INCLUDED

    ── 막는 행동 ─────────────────────────────────────────────────────
    막기 행동            시작과 해제를 스스로 요청하는, 스스로 끝나지 않고 유지되는 행동
                         (기존 스킬처럼 길이를 가지고 저절로 끝나지 않는다)
    막기 시작 조건       쓰러지지 않았고, 지금 행동이 대체 가능하며, 기력이 남아 있어야 한다
                         — 시작하지 못하면 사유가 남는다
    막는 동안의 제약     막는 동안에는 스킬을 시작할 수 없다.
                         막기를 유지한 채 걸을 수는 있다 (달리기는 아니다 —
                         달리기는 막기를 놓는 것으로 본다)
    막는 방향            막기는 앞쪽만 막는다. 몸이 향한 방향(C006 Facing)을 기준으로
                         정면 각도 안에서 들어온 타격만 막힌다.
                         옆·뒤에서 들어온 타격은 막지 않은 것과 같다

    ── 막힌 타격 ─────────────────────────────────────────────────────
    방어력               맞은 피해를 줄이는 Actor 의 값. 아무리 커도 피해를 0 으로 만들지
                         못한다 — 반드시 최소한의 피해는 통과한다
    막기 기력 대가       막힌 타격 한 번마다 그 타격의 크기에 비례한 기력을 치른다.
                         이것이 "생명 대신 기력" 이다
    막힌 결과            체력 감소는 방어력과 막기로 크게 줄고, 밀려남(C006 충격량)은
                         그대로 일어난다 — 막아도 몸은 밀린다
    막지 못한 결과       방향이 어긋났거나 막고 있지 않았으면 C007 의 기존 타격 그대로다

    ── 무너짐 ────────────────────────────────────────────────────────
    방어 붕괴            치를 기력이 모자란 상태에서 막힌 타격을 받으면 방어가 무너진다.
                         무너지면 막기가 풀리고, 그 타격은 막히지 않은 것으로 처리된다
    무너진 뒤            무너진 직후 잠시 막기를 다시 시작할 수 없다 — 기력이 마르면
                         계속 막는 것으로 버틸 수 없다는 것이 이 선택의 대가다

    ── 관찰 ──────────────────────────────────────────────────────────
    막고 있음            누가 지금 막고 있고 어느 쪽을 막고 있는지 모든 관찰자가 볼 수 있다
    타격 결과의 원인     타격 결과에 "막혔는가 / 생명을 얼마 잃었는가 / 기력을 얼마 치렀는가"
                         가 함께 실려 왜 그 숫자가 나왔는지 되짚을 수 있다
    무너짐의 사유        방어가 무너진 순간과 그 사유(기력 고갈)가 관찰된다
    막기 가능 여부       지금 막을 수 있는가와 그 이유를 자기 정보에서 확인한다

## EXCLUDED
    완벽한 막기          시점에 따라 결과가 갈리는 판정 없음 —
                         막기는 시작한 순간부터 끝까지 같은 막기다
                         (FR-PERFECT-GUARD-TURNS-THE-TABLE)
    반격 · 노출          막았다고 상대가 열리지 않는다. Exposed 상태 없음
                         (FR-PERFECT-GUARD-TURNS-THE-TABLE)
    균형 · 붕괴 누적     막기가 균형 부담을 쌓지 않는다. 무너짐의 원인은 기력 하나다
                         (FR-BREAK-OPENS-THE-BURST-WINDOW)
    자세 배분 (Flow)     공격/방어 어디에 힘을 몰지 고르는 배분 없음
                         (FR-FLOW-OPENS-THE-BODY)
    공격·방어 타입 상성  방어력은 한 값이다. 타입별 표 없음
                         (FR-MATCHUP-MAKES-THE-CHOICE)
    회피                 몸을 굴려 피하는 행동 없음 — 이번 Cycle 의 방어는 받아내는 것뿐이다
    후방 타격 보너스     뒤에서 맞았다고 더 아프지 않다. 방향은 막힘 여부만 가른다
    부위 판정            몸은 여전히 단일 캡슐이다 (C006)
    방어력의 외부 유래   장비·버프가 방어력을 바꾸지 않는다. 존재 종류가 정하는 고정값이며,
                         C009 의 속성 변경 경로로만 바꿔 볼 수 있다
    기력 자연 회복       막느라 마른 기력이 저절로 차지 않는다 —
                         기력은 지금까지대로 맞혀야 돈다 (C007)
    NPC 의 막기          자율 존재는 막지 않는다. 막기는 이번 Cycle 에서 관찰자의 선택이다
    막기 전용 게이지     신설하지 않는다 (DC-COMBAT-SHARED-BUDGET)

## RELATED EXISTING CAPABILITY
    Combat Vitals            (C007) — Cp 가 방어의 대가를 치르는 예산이 된다.
                             Hp 감소가 방어력만큼 줄어든다
    RULE-STRIKE-DAMAGE-001   (C007) — 이 Rule 의 결과가 막힘 여부로 분기한다 (CHANGED 예정)
    RULE-SKILL-BEGIN-001     (C007) — 막는 동안 스킬 시작이 막힌다 (AFFECTED 예정)
    RULE-MOVE-MODE-001       (C007) — 달리기 전환이 막기를 푼다 (AFFECTED 예정)
    Action State/Definition  (C002) — 막기는 기존 행동 구조에 얹히되 스스로 끝나지 않는
                             첫 행동이다
    Body Facing              (C006) — 막는 방향 판정에 그대로 쓴다. 새 방향 개념을 만들지 않는다
    Swing Strike / Collision (C006) — 타격 탐지는 그대로다. 결과만 분기한다
    Observer Projection      (C004) — 막는 상태·타격 원인·무너짐이 Projection 에 실린다
    Attribute Set            (C009·C007 R2) — 방어력이 MutableAttribute 목록에 더해진다
    Command Catalog          (C009) — 막기 관련 관찰·조작을 명령으로 확인할 수 있다

## REVISION
    R1  (02-intent.md 착수 후, Human Review 이전) 막기를 "행동" 으로 쓰면
        01 INCLUDED 의 "막기를 유지한 채 걸을 수는 있다" 와 C002 의 "한 번에 하나의 행동" 이
        충돌한다. 막기를 **자세(Stance)** — 행동 칸을 쓰지 않고 행동과 나란히 유지되며
        무엇을 시작할 수 있는지를 좁히는 몸의 태세 — 로 고쳐 썼다.
        01 의 Goal · INCLUDED · EXCLUDED 는 바뀌지 않는다. 표현 방식만 정해진 것이다.
        영향 Artifact: 02-intent.md (R1)

## WHY ONE CYCLE
    새 행동 1종(막기) + 새 값 1종(방어력) + 기존 타격 규칙의 결과 분기 1개.
    C007 이 자원(Cp)·행동 구조·고정 피해를, C006 이 방향과 충돌 판정을 이미 세워 두었으므로
    이 Cycle 은 그 위에 "받아내는 선택" 하나만 얹는다.
    이번 Cycle 이 끝나면 플레이어는 자율 존재의 공격 앞에서 맞을지 막을지를 고르게 되고,
    막기만으로는 버틸 수 없다는 것을 기력이 마르는 것으로 배운다.
