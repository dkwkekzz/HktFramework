# CYCLE C019 — Startup Can Be Interrupted

[PASS] Cycle Definition           (선딜은 기술마다 다르고 · 보이고 · 캔슬 판정에 쓰인다)
[PASS] Intent                    (기술의 세 구간 · 세계가 판정하는 노출 · 끊김의 좁힘)
[PASS] World Semantic            (구간은 기술의 값 · 캔슬 Rule · 피격이 시점을 묻는다)
[PASS] GameView Specification    (구간은 세계 판정값 · 캔슬은 나란한 자리 · HUD 무변경)
[    ] Human Semantic Review
[PASS] World Implementation      (구간·캔슬·NPC 큰 기술 · 신규 21건 · 전체 849건 통과)
[PASS] View Implementation       (선딜은 몸 위 · 캔슬은 그 자리 · 신규 9건 · 전체 858건)
[PASS] Verification              (자동 검증 전항 통과 · 861건 · Human Play 대기)

STATUS  IN PROGRESS

## MASTER TRACE

    Frontier            FR-INTERRUPT-THE-STARTUP — 선딜을 노려 끊는다
                        (`master/frontier.md` SELECTED · Human 선택 2026-08-20)

    Source Goal         MG-OVERCOME-SUPERIOR-OPPONENT
                        "정면으로 자원을 맞바꾸는 것만으로는 넘을 수 없는 상대가 더 이상
                         앞을 막지 못한다. 핵심은 '죽인다' 가 아니라 '막지 못하게 한다'"
                        (BW §28 의 여덟 갈래 중 이것이 다섯 번째로 서는 갈래다)

    Source Possibility  MP-INTERRUPT
                        "상대의 행동이 완성되기 전에 끊는다. 완성된 공격을 받아내는 모든
                         경로와 달리 결과 자체를 존재하지 않게 만들며, 요구되는 것은 상대
                         행동의 시작을 읽는 시점 판단이다" (BW §28)
                        요구는 Capability 하나뿐이다 — Knowledge 요구 없음

    Target Capability   MC-INTERRUPT                     (overlay: PARTIAL)
                        "상대가 진행 중인 행동을 끊는다. 결과를 줄이는 것이 아니라 결과가
                         생기지 않게 한다"
                        overlay 의 결손 칸: **끊는 것을 노리는 수단** — 지금은 아무 타격에나
                        따라오는 부수 효과라 "언제 끊을까" 라는 판단이 없다

    Reused Capability   MC-COMBAT-STRIKE          (overlay: IMPLEMENTED — C007 · C010)
                        MC-CP-ECONOMY             (overlay: PARTIAL — C007 · C011)
                        MC-RELATION-STANCE        (overlay: IMPLEMENTED — C018)
                        MC-COMBAT-CAUSE-READING   (overlay: IMPLEMENTED — 경위를 싣는 자리)

    Active Constraints  DC-COMBAT-PLAYER-CAUSALITY
                        DC-COMBAT-ONE-FORMULA
                        DC-COMBAT-ONE-LAYER-AT-A-TIME
                        DC-WORLD-OWNS-THE-SURFACE-LIST       (GLOBAL)
                        DC-COMBAT-SHARED-BUDGET 는 SCOPE NOTE ① 에서 읽힌다 —
                            이 Cycle 은 기력 수지의 **시점**을 바꾸지 않는다
                        DC-WORLD-COMBAT-IS-ONE-POSSIBILITY 는 무관하다 — 전투 안에서 닫힌다
                        DC-TARGET-IS-INTENT-NOT-AIM 은 무관하다 — 지목을 건드리지 않는다

    Constraint Note
        DC-COMBAT-PLAYER-CAUSALITY
            캔슬은 확률이 아니라 **시점 관계**로 판정된다. 같은 개입을 같은 시점에 넣으면
            언제나 같은 결과가 나온다. 새 난수를 만들지 않는다 — 세계의 유일한 난수원은
            C015 의 자리이고 이 Cycle 은 그것을 쓰지 않는다.
        DC-COMBAT-ONE-FORMULA
            피해 공식에 한 글자도 닿지 않는다. 캔슬이 가르는 것은 그 기술이 **성립하는가**
            이지 피해의 크기가 아니다. 캔슬된 기술은 피해 0 이 아니라 **피해 산정 자체가
            일어나지 않는다**.
        DC-COMBAT-ONE-LAYER-AT-A-TIME
            능동 방어(완벽한 막기 · 카운터) · Critical · Aura 를 손대지 않는다. 선딜은
            전투 사다리의 층이 아니라 **모든 층이 쓰는 행동의 시간 구조**다.
        DC-WORLD-OWNS-THE-SURFACE-LIST
            "지금 선딜 중인가" 와 "무엇이 왜 캔슬되었는가" 를 **세계가 판정해서 싣는다**.
            View 가 progress 값과 구간 경계를 자기 코드에 복제해 계산하지 않는다
            (SCOPE NOTE ③).

## SCOPE NOTE — 코드 대조로 드러난 것

Frontier 의 "이미 있는 것" 칸을 Stage 1 에서 다시 코드로 확인했다. 넷이 나왔고
그중 둘은 후보 문구를 **정정**한다.

### ① 기력은 선불이 아니다 — 캔슬의 대가는 시간이다  〔Frontier 문구 정정〕

    Frontier 의 세계에 생기는 것 ④ 는 "캔슬된 기술의 대가 — 치른 기력은 돌아오지
    않는다" 였다. 코드 대조 결과 **지금 세계는 시작할 때 기력을 치르지 않는다.**

        RULE-SKILL-BEGIN-001    cp >= cost 를 **검사만** 한다 (관문)
        RULE-SKILL-BUDGET-001   첫 타격에서 한 번 정산한다 — `budgetSettled`
                                "허공을 가른 휘두름은 정산하지 않는다 — 맞아야 기력이 돈다"

    그러므로 선딜 중에 캔슬되면 아직 정산 전이고, **돌려줄 것도 뺏을 것도 없다.**
    치를 것이 없으니 ④ 를 문자 그대로 구현하려면 기력을 선불로 바꿔야 하는데,
    그것은 C007 이 세운 수지 구조(맞아야 기력이 돈다)를 뒤집는 일이고
    DC-COMBAT-SHARED-BUDGET 이 걸린 별개의 Cycle 이다.

    이 Cycle 이 세우는 대가는 **시간과 기회**다.
        · 선딜에 쓴 시간이 사라진다 (강타 0.9초의 앞부분)
        · 그 휘두름으로 벌 수 있었던 충전을 잃는다 (맞아야 도는 기력이 돌지 않는다)
        · 맞은 쪽은 hit 0.35초에 묶이고 그동안 충전이 억눌린다 (HIT_CHARGE_FACTOR)
    큰 기술일수록 선딜이 기니 **크게 걸수록 크게 잃는다** — ④ 의 의도는 그대로 선다.
    **Master 에 보고할 항목이다** (08 MASTER FEEDBACK) — Cycle 은 master/ 를 고치지 않는다.

### ② 자율 존재는 지금 기본 공격만 쓴다 — 그대로면 이 Cycle 은 플레이로 성립하지 않는다

        world/simulation/npc-decide.ts   "자율 존재는 기본 스킬만 쓴다" (C007 EXCLUDED)
        기본 공격 0.6초 × 선딜 0.25 = **0.15초**

    0.15초는 사람이 보고 반응해서 끼어들 수 있는 시간이 아니다. 상대가 큰 기술을
    쓰지 않으면 "선딜을 노려 끊는다" 는 화면에서 한 번도 일어나지 않는다 —
    Playable Result 가 성립하지 않는다.

    그래서 이 Cycle 은 **자율 존재가 큰 기술을 쓸 수 있게** 한다. 이미 있는 스킬
    (heavy-attack 0.9초)을 고를 수 있게 여는 것이며 새 기술을 만들지 않는다.
    고르는 규칙은 **가장 단순한 것 하나**로 두고(무엇으로 할지는 Stage 3),
    패턴 · 페이즈 · 위협도 같은 판단 구조는 EXCLUDED 다.

### ③ 선딜의 경계는 세계만 안다 — 그래서 노출은 새 자리를 요구한다

        engine/protocol-core/gameview.ts   state(행동 종류) · progress(0..1) 는 이미 실린다
        world/semantic/collision.ts        SWING_BEGIN 0.25 · SWING_END 0.75 는 세계 안에만 있다

    View 는 "heavy-attack 이 0.13 만큼 진행됐다" 를 이미 안다. 그러나 그 0.13 이
    선딜인지 판정 구간인지는 **경계 상수를 알아야** 판단할 수 있고, View 가 그것을
    자기 코드에 복제하는 순간 SURFACE-LIST 위반이다 (C013 의 versusObserver ·
    C012 의 defenseShape 이 같은 이유로 세계 계산값이 되었다).
    그러므로 이 Cycle 의 "선딜 노출" 은 **세계가 판정한 값**으로 선다.

### ④ 이 Cycle 은 끊김을 넓히지 않는다 — 좁힌다

    지금 RULE-HIT-001 은 사정을 묻지 않는다: 맞으면 무조건 hit 이 되고 하던 행동이
    사라진다. 그래서 "끊었다" 가 판단이 아니라 부산물이다.

        지금       아무 때나 때리면 끊긴다
        이 Cycle   선딜 중에 때려야 끊긴다 — 이미 판정이 나갔으면 그 기술은 끝까지 나간다

    **새 규칙의 본체는 이 좁힘이다.** 늦게 넣은 개입이 무산되지 않아야 "언제 넣을까" 가
    비로소 판단이 된다. 판정 형태(피격 반응과 행동 유지가 어떻게 공존하는가)는
    Stage 3 이 정한다.

## TYPE

    Existing Capability Enhancement
        MC-INTERRUPT 는 overlay 에서 PARTIAL 이고, 끊김 규칙(RULE-HIT-001 · C002)도
        구간 상수(SWING_BEGIN/END · C006)도 이미 있다. 이 Cycle 은 그 둘에 의미를
        준다 — 새 공식도, 새 자원도, 새 기술도 만들지 않는다.

## TARGET CAPABILITY

    선딜 (Startup)
        기술의 시간이 선딜 · 판정 · 후딜로 나뉘고, 선딜이 기술마다 다르며,
        그 구간이 눈에 보이고 캔슬 판정에 쓰인다.

## GOAL

    플레이어가 상대의 큰 기술이 선딜에 들어간 것을 보고 끼어들어 그 기술을
    캔슬시킬 수 있고 — 늦으면 이미 판정이 나가 캔슬되지 않으며,
    자기 큰 기술도 같은 규칙으로 캔슬당한다.

## INCLUDED

    기술마다 다른 선딜        선딜 길이가 기술의 성질이 된다. 지금은 모든 기술이 0.25 로
                            같다 — 센 기술일수록 선딜이 길어야 "크게 거는 것" 이 위험을
                            함께 진다. 값은 Stage 3 이 정한다
    선딜의 의미 노출          "지금 선딜 중인가, 이미 판정이 나갔는가" 를 **세계가 판정해서**
                            싣는다. View 가 진행도와 경계로 계산하지 않는다 (SCOPE NOTE ③)
    캔슬 판정                선딜 중에 개입이 닿으면 그 기술이 캔슬된다 — 판정이 나가지
                            않는다. 피해 산정이 일어나지 않는 것이지 피해 0 이 아니다
    끊김의 좁힘              판정 구간 이후에 맞으면 그 기술은 끝까지 나간다.
                            RULE-HIT-001 이 처음으로 **시점을 묻는다** (SCOPE NOTE ④)
    캔슬의 대가              선딜에 쓴 시간과 그 휘두름으로 벌 수 있었던 충전을 잃는다.
                            큰 기술일수록 크게 잃는다 (SCOPE NOTE ①)
    캔슬의 관찰              무엇이 왜 캔슬되었는지가 관찰에 실린다. 캔슬은 빗나감과도
                            무산(C018 의 닿았으나 성립하지 않음)과도 다른 사건이다
    예외 없는 규칙            자율 존재도 같은 규칙을 진다. 플레이어의 큰 기술도 같은
                            시점 조건으로 캔슬당한다 — 몸의 종류가 판정을 바꾸지 않는다
    자율 존재의 큰 기술        자율 존재가 heavy-attack 을 쓸 수 있게 한다. 이미 있는 스킬을
                            고를 수 있게 여는 것이며, 이것이 없으면 Goal 이 플레이로
                            성립하지 않는다 (SCOPE NOTE ②). 고르는 규칙은 가장 단순한 하나

## EXCLUDED

    경직 · 기절 (CC)          맞은 쪽을 일정 시간 묶어 두는 상태. 끊는 것과 묶는 것은 다르다.
                            hit 0.35초는 이미 있는 것이며 이 Cycle 은 그 길이를 손대지 않는다
    카운터                    캔슬시킨 뒤에 오는 추가 이득(취약 상태 · 확정타 · 반격 창).
                            그것은 R1 §14 Active Defense 층이고 ONE-LAYER-AT-A-TIME 이 막는다
    완벽한 막기 · 회피         MC-PERFECT-GUARD · MC-EVADE. 같은 층의 이웃이며 이번이 아니다
    패턴을 미리 읽는 것         무엇이 올지를 아는 것 (MC-PREDICT). 시계가 다르다 —
                            이것은 기술 **안**, 예측은 기술 **앞**이다. 그 갈래는 자율 존재
                            기획서를 기다리며 보류 중이다 (frontier "지금 열 수 없는 것")
    자율 존재의 판단 구조       패턴 · 페이즈 · 기술 선택 AI · 위협도. 이 Cycle 이 여는 것은
                            "큰 기술을 쓸 수 있다" 하나이고 그 판단을 정교하게 만들지 않는다
    기력 선불로 바꾸기         시작하는 순간 기력을 치르게 하는 것. C007 의 수지 구조를
                            뒤집는 별개의 Cycle 이다 (SCOPE NOTE ①)
    피해 공식 · 방어 · 관통 · 치명   한 글자도 닿지 않는다 (ONE-FORMULA)
    새 난수                   캔슬은 결정론적이다. 시점 관계만으로 판정한다
    막기를 행동으로 편입하는 것   막기는 지금 켜 두는 자세이고 행동이 아니다 (C011).
                            선딜을 주지 않는다 — 그것은 Active Defense 층의 일이다
    다른 행동의 선딜           채굴 · 살펴봄에 선딜의 의미를 주는 것. 이번에 서는 것은
                            **기술**의 선딜이며, 캔슬 판정도 기술에만 선다
    선딜 중 이동 · 방향 전환     선딜 동안 몸을 어떻게 다룰 수 있는가. 지금 규칙 그대로 둔다

## RELATED EXISTING CAPABILITY

    행동의 시간 구조 (C002)     모든 존재는 언제나 하나의 행동 안에 있고, 종류 · 소요 시간 ·
                            진행도를 지닌다. 선딜은 그 진행도 위에 서는 의미다 — 구조 자체는
                            바꾸지 않는다 (`world/semantic/action.ts`)
    휘두름 구간 (C006)         SWING_BEGIN 0.25 · SWING_END 0.75 — 칼날이 닿는 구간.
                            선딜은 이 구간의 **앞**이며, 경계가 기술마다 달라지는 것이
                            이 Cycle 의 첫 항목이다 (`world/semantic/collision.ts`)
    피격 반응 (C002 · RULE-HIT-001)  맞으면 하던 행동이 hit 으로 대체된다. 이 Cycle 이
                            시점 조건을 더해 **좁히는** 자리다 — 이 규칙의 CHANGED 다
    기력 수지 (C007 · C011)     맞아야 기력이 돈다 · 첫 타격에서 한 번 정산한다.
                            캔슬의 대가가 이 구조 위에서 읽힌다 — 규칙은 무변경이다
    스킬 (C007 · C012)         attack 0.6 · heavy-attack 0.9 · aura-strike 0.6.
                            선딜 길이가 스킬의 성질로 더해진다. 피해 · 기력 값은 무변경
    자율 판단 (C002 · C007 · C018)  인지 · 태도 거르기 · 쫓기 · 휘두르기. 큰 기술을 고를 수
                            있게 여는 자리이며 고르는 구조 자체는 그대로다
    관찰 계약 (C002 · C004)     state · progress 가 이미 실린다. 선딜 판정이 그 옆에 선다
    관찰: 성립하지 않은 접촉 (C018)  닿았으나 해가 없었던 접촉 + 사유. 캔슬 관찰이 참고할
                            **나란한 선례**이며, 캔슬은 그것과 다른 사건이다 (섞지 않는다)
    계산 경위 관찰 (C010~C015)   타격마다 경위가 실리는 자리. 캔슬은 산정 자체가 없으므로
                            이 자리에 오지 않는다 — 그 사실이 구분의 근거다
