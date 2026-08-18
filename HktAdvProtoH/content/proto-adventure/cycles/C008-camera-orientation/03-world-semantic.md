# C008 — World Semantic

> **WORLD CHANGE: NONE** — 이번 Cycle 은 세계에 상태도 규칙도 더하지 않는다.
> 세계에서 참인 것은 하나도 바뀌지 않으며, 바뀌는 것은 세계를 보는 방향과
> 그 방향을 통해 읽히는 방식이다. 그 판단의 근거와 검사 결과가 아래에 있다.

## SEMANTIC DELTA
    REUSED
        Actor.Facing                    (C006 R1) 몸이 향한 방향 (단위 벡터).
                                        휘두름이 나가는 쪽이며, 이번 Cycle 이 그림으로 옮길 값
        RULE-BODY-FACING-001            (C006 R1) 움직이면 그 방향을 향한다.
                                        자율 존재는 겨눈 대상을 향해 돌린다
        Actor.Position                  (C001) 시점이 따라다닐 자리
        Actor.CharacterKind             (C002) 존재의 종류 — 어떤 그림을 쓰는지의 기준
        ActionCollider (파생)           (C006 R1) 칼끝 자리 — Facing 에서 유도된다
        RULE-SWING-STRIKE-001           (C006·C007) 휘두름이 닿는 판정
        RULE-MOVE-001 / -PROGRESS-001   (C001·C002) 목적지 요청 → 이동 판정·도달·막힘
        Move 요청 계약 (TargetPosition) (C001) 목적지는 세계 좌표로 온다 —
                                        어떤 기준으로 그 좌표를 정했는지 세계는 묻지 않는다
        Observer.ActorId                (C004) 어느 몸이 그 관찰자의 것인가
    ADDED
        없음
    CHANGED
        없음
    AFFECTED
        없음 — 어떤 기존 Rule 의 Input · Precondition · Transition · Result 도 바뀌지 않는다.
        (다만 RULE-BODY-FACING-001 과 RULE-SWING-STRIKE-001 의 결과가 처음으로 눈에 드러나므로
         Verification 의 회귀 대상이다 — 08 의 검증 항목으로 넘긴다)

## WORLD STATE
    이번 Cycle 이 더하는 State 는 없다. 읽어 쓰는 기존 State 와 그 Authority 는 다음과 같다.

    Actor
        Facing             World Authority    RULE-BODY-FACING-001 만이 바꾼다 (C006 R1).
                                              관찰자는 이 값을 읽을 뿐 바꾸지 못한다
        Position           World Authority    RULE-MOVE-PROGRESS-001 · 물리 규칙이 바꾼다
        CharacterKind      World Authority    존재가 놓일 때 정해진다 (C002)

    관찰자의 시점 방향은 World State 가 아니다.
        01-cycle.md EXCLUDED "시점의 세계 진입" · INTENT-VIEWPOINT-ORIENT-001 —
        세계는 관찰자가 어디를 보는지 알지 않으며, 관찰자가 어디를 보든
        세계에서 일어나는 일은 달라지지 않는다. 따라서 이 값에는 World Authority 가 없다.

## WORLD RULE
    이번 Cycle 이 더하거나 바꾸는 Rule 은 없다.
    Intent 가 기대는 기존 Rule 은 다음 둘이며, 둘 다 정의 그대로 재사용된다.

    RULE-BODY-FACING-001 (C006 R1 — REUSED, 변경 없음)
        Implements     INTENT-BODY-FACING-001 (C006)
                       · INTENT-STRIKE-LEGIBLE-001 (C008 — 새 Intent 를 추가 구현 없이 만족한다)
        Input          이동 중인 모든 Actor / 휘두름을 결정한 자율 Actor
        Preconditions  없음
        Transition     한 걸음 옮길 때마다 Facing = 이동 방향.
                       자율 Actor 는 attack 시작 직전 Facing = 겨눈 대상 방향
        Result         Faced

        C008 이 여기에 기대는 것 — 몸 방향은 이동 방향에서 나온다.
        관찰자가 시점 기준으로 정한 목적지가 세계 좌표로 도착하면,
        그 방향으로 걷는 몸은 그 방향을 향하게 된다.
        즉 "보는 쪽으로 간다" 가 성립하면 "보는 쪽을 향한다" 도 따라온다 —
        세계에 시점을 알리지 않고도 그렇다.

    RULE-MOVE-001 / RULE-MOVE-PROGRESS-001 (C001·C002 — REUSED, 변경 없음)
        Implements     INTENT-MOVE-001 (C001)
                       · INTENT-MOVE-BY-VIEW-001 (C008 — 요청의 기준만 관찰자 쪽에서 달라진다)
        Input          Move 요청의 TargetPosition
        Preconditions  기존 그대로
        Transition     기존 그대로
        Result         Progress | Arrived | Failure(reason)

        C008 이 여기에 기대는 것 — 목적지는 세계 좌표로 온다.
        관찰자가 그 좌표를 자기 시점 기준으로 계산했다는 사실은 요청에 실리지 않으며
        세계의 판정에 들어가지도 않는다. 갈 수 있는지는 지금까지대로 세계가 정한다.

## OBSERVABLE SEMANTIC
    새로 투영할 Observable 은 없다. 이번 Cycle 이 읽는 관찰값은 모두 이미 나가고 있다.

    Actor.Facing              (C006) 상시 제공. 지금까지는 충돌체 확인용으로 쓰였고,
                              이번 Cycle 부터 그림의 좌우를 정하는 상시 근거가 된다
    Actor.Position            (C001) 시점이 따라갈 자리
    Actor.CharacterKind       (C002) 어떤 그림을 쓰는 존재인가
    ActionCollider.Center / Active
                              (C006) 칼끝이 실제로 어디를 지나는가 —
                              그림이 보이는 쪽과 어긋나지 않는지 대조할 수 있는 관찰값
    Move.Availability / FailureReason
                              (C001) 시점 기준으로 정한 목적지도 같은 사유로 막힌다

    관찰 목적의 확대는 관찰 계약의 변경이 아니다 — 같은 값을 더 많은 곳에서 쓸 뿐이다.
    그 확대는 04-gameview.spec.yaml 이 `changed` 로 기록한다.

## SEMANTIC CLOSURE
    ── 세계 안에서 닫히는 문장 ────────────────────────────────────────
    "휘두름이 나가는 방향은 몸이 향한 방향이 정한다"   → Actor.Facing + ActionCollider (C006)
    "몸 방향은 움직인 방향이 정한다"                   → RULE-BODY-FACING-001
    "한 번 시작된 휘두름은 방향을 바꾸지 않는다"       → 휘두름 중에는 이동이 진행되지 않으므로
                                                       RULE-BODY-FACING-001 이 호출되지 않는다
    "세계의 방향으로 환산되어 요청된다"                → Move 요청 계약 (TargetPosition, 세계 좌표)
    "갈 수 있는지는 세계가 정한다"                     → RULE-MOVE-001 / -PROGRESS-001 + FailureReason
    "존재의 종류마다 다르다"                           → Actor.CharacterKind (그림 선택의 기준)
    "몸이 향한 방향을 관찰할 수 있다"                  → Observable Actor.Facing (상시)

    ── 세계 밖에서 닫히는 문장 (관찰자의 의미) ────────────────────────
    각 문장 옆은 그 의미를 책임지는 곳이다. 세계가 알지 않기로 한 것은
    01-cycle.md 의 EXCLUDED 와 02-intent.md 의 BOUNDARY RESOLVED 가 정한 결정이다.

    "관찰자는 바라보는 방향을 가진다"                  → 관찰자 / 04 viewpoint
    "그 방향은 유지되고 저절로 되돌아가지 않는다"      → 관찰자 / 04 viewpoint
    "위아래 한계 안에 머문다"                          → 관찰자 / 04 viewpoint
    "방향의 변화는 이어져 있다"                        → 관찰자 / 04 viewpoint
    "시점은 몸을 두고 그 주위를 돈다"                  → 관찰자 / 04 viewpoint
    "지형 표면 아래로 내려가지 않는다"                 → 관찰자 / 04 viewpoint
                                                       (지형 높이는 세계 판정 밖의 시각 표현 —
                                                        C001 이래 유지된 경계다)
    "앞이란 관찰자가 향한 방향이다"                    → 관찰자 / 04 interactions.move
    "몸 방향은 화면의 좌우 중 한쪽으로 읽힌다"         → 관찰자 / 04 entities.character.facing
    "시점을 돌리면 반대쪽으로 읽힌다"                  → 관찰자 / 04 entities.character.facing
    "좌우 어느 쪽도 아닌 구간은 직전 쪽을 유지한다"    → 관찰자 / 04 entities.character.facing
    "그림에는 원래 향한 쪽이 있다"                     → 그림 / 04 spriteOrientation
    "기준 방향과 다르면 뒤집혀 보인다"                 → 그림 / 04 spriteOrientation

    ── 닫힘 판정 ──────────────────────────────────────────────────────
    Intent 6종의 모든 문장이 위 두 표 중 한 곳에 대응한다. 남는 문장 없음.

    세계 밖에서 닫히는 문장이 정말 세계를 필요로 하지 않는지 다음을 검사했다.

        읽는 데 필요한 것       몸이 향한 방향 · 몸의 자리 · 존재의 종류
        지금 이미 나가는가      셋 다 상시 관찰값이다 (C002·C004·C006)
        관찰자만 아는 것        자기 시점의 두 각 — 세계에 실리지 않고,
                                다른 관찰자도 알 필요가 없다 (01 EXCLUDED)
        그림만 아는 것          존재 종류별 원본 기준 방향 (02 BOUNDARY RESOLVED)

    따라서 새 World State 없이 Intent 가 닫힌다. 이 판정이 틀리는 경우는 하나뿐이다 —
    내가 어디를 보는지를 **다른 관찰자가 알아야** 하는 순간(시선 공유·정면 판정·등 뒤 판정).
    그것은 01-cycle.md 가 EXCLUDED 로 제외했으므로 이번 Cycle 의 대상이 아니며,
    필요해지면 Cycle Definition 으로 돌아가 시점을 세계에 들이는 별도 Cycle 이 된다.
