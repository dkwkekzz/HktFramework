# CYCLE C011 — Guard Trades Body for Resource

> 번호·이름 주의 — 이 이름은 롤백된 구 `C010-guard-trades-body-for-resource` 와 같고
> 번호는 롤백된 구 `C011-perfect-guard-turns-the-table` 의 것을 재사용한다.
> 둘 다 git history 에만 존재하며, 구분은 전체 ID(번호+이름)로 한다
> (`master/frontier.md` 번호 주의). 구 산출물은 참조 가능하나 이번 범위는 R1 §14 기준으로
> 다시 좁혔다 — 아래 SCOPE NOTE 참조.

[PASS] Cycle Definition
[PASS] Intent                    (막기를 행동이 아니라 자세로 정했다)
[PASS] World Semantic          (막기는 Final Damage 에 걸린다 — R1 핵심 원칙)
[PASS] GameView Specification
[PASS] Human Semantic Review     (2026-08-17 APPROVED)
[PASS] World Implementation      (world 254 tests 통과)
[PASS] View Implementation       (view fixture 15 tests · 전체 452/453)
[    ] Verification

STATUS  IN PROGRESS

## MASTER TRACE
    Frontier            FR-GUARD-TRADES-BODY-FOR-RESOURCE
    Source Goal         MG-SURVIVE-ENEMY-OFFENSIVE
    Source Possibility  MP-TRADE-BODY-FOR-RESOURCE
    Target Capability   MC-GUARD               (overlay: MISSING — 이번 Cycle 의 유일한 결손)
    Reused Capability   MC-DEFENSE-MITIGATION  (overlay: IMPLEMENTED — C010 이 채웠다)
                        MC-CP-ECONOMY          (overlay: PARTIAL → 방어가 같은 예산을 쓰기 시작한다)
                        MC-BODY-FACING         (overlay: IMPLEMENTED — 막는 방향의 기준)
    Active Constraints  DC-COMBAT-PLAYER-CAUSALITY
                        DC-COMBAT-ONE-FORMULA
                        DC-COMBAT-ONE-LAYER-AT-A-TIME
                        DC-COMBAT-SHARED-BUDGET
                        DC-WORLD-OWNS-THE-SURFACE-LIST    (GLOBAL — 2026-08-17 승격)
    Constraint Note
        DC-COMBAT-ONE-FORMULA
            새 피해 공식을 만들지 않는다. C010 의 계산 결과값에 의미 하나만 더한다 —
            R1 핵심 원칙의 "Guard → Final Damage 를 감소시킨다" 가 그대로 이 자리다.
        DC-COMBAT-PLAYER-CAUSALITY
            막힌 결과에 우연을 넣지 않는다. 같은 방향·같은 기력·같은 타격이면
            언제나 같은 결과다. 줄어든 양과 그 원인이 관찰 가능해야 한다.
        DC-COMBAT-SHARED-BUDGET
            방어용 전용 게이지를 만들지 않는다. C007 의 기력 하나를 그대로 쓴다 —
            막기가 기력을 쓰기 시작하면 같은 기력이 고급 스킬·달리기와 경쟁한다.
        DC-COMBAT-ONE-LAYER-AT-A-TIME
            Defense Action 층 하나만 올린다. 그 위의 Active Defense(완벽한 막기·되받아치기)와
            Damage Type·Penetration 은 손대지 않는다.
        DC-WORLD-OWNS-THE-SURFACE-LIST
            막기를 걸 수 있다는 사실과 그 조건을 세계가 밝힌다.
            View 가 "막기라는 것이 있다" 를 자기 코드에 적어 두지 않는다.
        DC-COMBAT-DEFENSE-IS-ACTIVE  (현재 DRAFT — Active 아님)
            이 Cycle 이 그 Constraint 의 근거 층이다. 닫은 뒤 재승인 여부를 Human 이
            판단할 자리가 생긴다 — 이번 Cycle 이 그것을 전제로 삼지는 않는다.
    원본 근거           design/Design-Combat-OffenseDefense-R0.md **R1**
                        §14 Defense Action 층 (`Guard → Damage Taken × 0.5` 수준에서 시작) ·
                        핵심 원칙 (Guard 는 Final Damage 를 감소시킨다) · §13 하지 않을 것
                        구판 §8.1 (막기가 자원을 치른다는 의미의 출처)

## SCOPE NOTE — R1 과 Possibility 를 함께 읽은 결과

    R1 §14 는 이 층을 `Guard → Damage Taken × 0.5` 로 아주 단순하게 시작하라고 적었고,
    "Perfect Guard 나 Guard Break 는 아직 없다" 고 못박았다.
    반면 Frontier 의 Playable Result 와 MP-TRADE-BODY-FOR-RESOURCE 의
    meaningful_difference 는 **기력을 치르는 것**과 **자원이 말라 무너지는 것**을
    이 경로의 정체성으로 삼는다. 둘을 다음과 같이 읽었다.

    포함한다 — 기력 대가와 고갈로 인한 붕괴
        피해가 절반이 되는 것만으로는 MP-TRADE-BODY-FOR-RESOURCE 가 성립하지 않는다.
        "생명 대신 **자원**으로 받는다" 가 그 Possibility 의 meaningful_difference 이고,
        "자원이 바닥나면 방어 자체가 무너진다" 가 그 changes 에 적혀 있다.
        대가가 없으면 계속 막는 것이 언제나 이득이라 선택이 되지 않는다.
        DC-COMBAT-SHARED-BUDGET 도 막기가 같은 기력을 쓸 것을 전제한다.

    포함하지 않는다 — Guard Break
        R1 이 제외한 Guard Break 는 **공격자가 압박으로 방어를 무너뜨리는 것**이며,
        그것은 MC-BREAK / MP-BREAK-THE-GUARD 라는 별도 경로다 (균형 누적값이 필요하다).
        이번의 붕괴는 **막는 자가 자기 기력을 다 써서** 일어나는 것이므로 다른 일이다.
        공격자 쪽에는 아무 새 값도 생기지 않는다.

    이 해석이 상위 의미와 어긋난다고 보이면 Stage 5 Human Review 에서 되돌린다.

## TYPE
    New Capability                     Guard — 막는다는 행위가 세계에 없다.
                                       지금 방어는 맞고 나서 값이 줄어드는 것뿐이고,
                                       플레이어가 고르는 방어 수단이 하나도 없다

    Existing Capability Enhancement    Damage Formula (C010) — 계산의 마지막에
                                       막기 배율이 붙는다. 공식을 바꾸는 것이 아니라
                                       결과값에 의미 하나가 더해진다
                                       Action / Move (C002·C007) — 스스로 끝나지 않고
                                       놓을 때까지 유지되는 첫 상태가 생긴다

## TARGET CAPABILITY
    Guard
        앞을 향해 버티는 자세 · 막힌 타격이 치르는 기력 · 기력이 다했을 때의 붕괴

## GOAL
    플레이어는 앞을 향해 막기를 유지하여 정면에서 들어온 타격을 생명 대신 기력으로
    받아내고, 받아낼 기력이 다하면 방어가 무너져 그대로 얻어맞는다.
    무엇이 얼마나 막혔고 그 대가로 기력을 얼마나 치렀는지를 맞은 자리에서 확인한다.

## INCLUDED

    ── 막는 자세 ─────────────────────────────────────────────────────
    막기 시작·해제       플레이어가 시작을 요청하고 놓을 때까지 유지된다.
                         스스로 끝나지 않는 첫 상태다 (기존 스킬은 길이가 있어 저절로 끝난다)
    시작 조건            쓰러지지 않았고, 지금 하던 것을 그만둘 수 있으며,
                         치를 기력이 남아 있어야 한다 — 시작하지 못하면 사유가 남는다
    막는 동안의 제약     스킬을 시작할 수 없다. 걷는 것은 된다.
                         달리기는 막기를 놓는 것으로 본다 (같은 기력을 두 곳에 쓸 수 없다)
    막는 방향            앞쪽만 막는다. 몸이 향한 방향(C006)을 기준으로 정면 안에서
                         들어온 타격만 막힌다. 옆·뒤는 막지 않은 것과 같다

    ── 막힌 타격 ─────────────────────────────────────────────────────
    피해 감쇄            막힌 타격은 C010 이 계산한 최종 피해에 막기 배율이 곱해져 들어간다.
                         새 공식이 아니라 그 결과값에 붙는 한 단계다
    기력 대가            막힌 타격 한 번마다 그 타격의 크기에 따른 기력을 치른다.
                         이것이 "생명 대신 기력" 이다
    밀려남은 그대로      막아도 몸은 밀린다 (C006 충격량). 막기는 아프지 않게 할 뿐
                         공격을 없던 일로 만들지 않는다
    막지 못한 타격       방향이 어긋났거나 막고 있지 않으면 C010 그대로다 — 아무 변화 없다

    ── 무너짐 ────────────────────────────────────────────────────────
    방어 붕괴            치를 기력이 모자란 채로 막힌 타격을 받으면 방어가 무너진다.
                         막기가 풀리고, 그 타격은 막지 못한 것으로 들어간다
    무너진 뒤            무너진 직후 잠시 다시 막을 수 없다 — 기력이 마르면 대가가 따른다

    ── 관찰 ──────────────────────────────────────────────────────────
    막고 있음            누가 지금 막고 있는지는 모든 존재에 대해 관찰된다
                         (C007 R2 의 전 속성 관찰 원칙 그대로)
    막힌 계산 내역       C010 의 계산 경위에 막기 단계가 더해진다 —
                         막지 않았다면 얼마였고, 막아서 얼마가 되었고, 기력을 얼마 치렀는가
    붕괴의 순간          방어가 무너지는 것이 그 자리에서 드러난다
    걸 수 있는 것        막기를 시작·해제할 수 있다는 것과 그 조건을 세계가 밝힌다
                         (DC-WORLD-OWNS-THE-SURFACE-LIST)

## EXCLUDED
    완벽한 막기          닿기 직전에 막아 무효화하는 것 — R1 §14 Active Defense 층 (다음)
    되받아치기 · 노출     위와 같음. 막기 성공이 공격 기회로 전환되지 않는다
    Guard Break          공격자가 압박으로 방어를 무너뜨리는 것 — MC-BREAK 는 별도 경로다
                         (SCOPE NOTE 참조). 이번의 붕괴는 막는 자의 기력 고갈뿐이다
    균형 누적값          위와 함께 이연. 막기에는 누적되는 값이 없다
    회피 · 패링          R1 §13 이연
    방향별 피해 차등     막는 방향은 막힘/안 막힘만 가른다. 각도에 따라 값이 달라지지 않는다
    부위 · 관통 · 속성    R1 §14 Damage Type / Penetration 층
    자율 존재의 막기     자율 존재는 이번에도 기본 스킬만 쓴다 (C007 EXCLUDED 그대로).
                         막기는 플레이어의 선택으로만 존재한다
    막기 중 이동 속도 변화 막으면서 걷는 빠르기는 그대로다. 템포 능력치를 건드리지 않는다
    기력 자연 회복       C007 EXCLUDED 그대로 — 막아서 줄어든 기력은 스스로 돌아오지 않는다
    새 자원 · 새 게이지   자원은 생명·기력 둘 그대로다 (DC-COMBAT-SHARED-BUDGET)
    피해 공식 변경       C010 의 공식 자체는 손대지 않는다. 그 결과값 뒤에 한 단계가 붙을 뿐이다

## RELATED EXISTING CAPABILITY
    Damage Formula               (C010) — CHANGED. 계산 결과에 막기 단계가 더해지고,
                                 계산 경위에도 그 단계가 실린다
    Combat Vitals (hp · cp)      (C007) — REUSED. 기력이 이제 세 곳(고급 스킬·달리기·막기)에서
                                 쓰인다. 자원 구조 자체는 그대로다
    Action State / Definition    (C002·C007) — 유지되는 상태가 처음 들어온다.
                                 기존 행동 구조 위에 얹되 "길이가 있어 끝난다" 는 전제가 확장된다
    Move / Run                   (C007) — 달리기와 막기가 같은 기력을 두고 배타적이다
    Body Facing                  (C006) — REUSED. 막는 방향의 기준을 그대로 쓴다
    Swing Strike / Collision     (C002·C006) — REUSED. 누가 맞았는지 정하는 판정은 그대로다
    Observer Projection          (C004·C007 R2) — 막는 상태와 막힌 경위가 기존 관찰 계약에 실린다
    Command Catalog              (C009) — 막기를 걸 수 있다는 것이 세계가 밝히는 목록에 오른다
    Strike Result HUD            (C007·C010) — 맞은 자리의 표시에 막기 단계가 더해진다
