# C-COMBAT-003 — Human Semantic Review

## 검토 대상

    Cycle Goal → Intent → World Semantic → GameView Specification
    01-cycle.md · 02-intent.md · 03-world-semantic.md · 04-gameview.spec.yaml

## 질문

    1. 이 World 가 내가 원하는 게임 의미를 정확히 표현하는가?
    2. 이 GameView Specification 만으로 Player 가 그 의미를 이해하고 플레이할 수 있는가?

## 결과

    APPROVED
    승인    Human 위임 · 세션 지시 ("WORLD·COMBAT 진행. 선택은 agent 가 제안대로 진행")
    Return To  해당 없음
    Reason     해당 없음

## 승인이 확정한 것

승인은 아래 판단들을 함께 확정한다. Stage 6·7 은 이것을 다시 열지 않는다.

    관문과 강화를 함께   `MC-ABILITY-CONDITION` 의 world_shape 이 셋을 요구하므로 쪼개면
                        어느 쪽도 노드를 닫지 못한다 (01 의 "왜 한 Cycle 인가")

    사정의 입력 모양      Self · Other · Now 하나이며, 관문에서는 Other 가 없다.
                        상대를 읽는 사정을 요구로 걸지 않는 것이 지금의 규율이다
                        (03 의 WORLD STATE · 01 의 물음 ①)

    첫 사정 셋           `power-in-ability`(요구) · `struck-by-them`(조건) ·
                        `life-below-half`(조건). 첫째가 C-COMBAT-001 의 남은 결손을 닫는다

    강화가 움직이는 값     계수(AttackRatio). 기본 피해가 아니다 — 몰아 둔 만큼 보답이
                        커져야 관문과 조건이 같은 방향을 가리킨다 (03 의 BALANCE ③)

    관문의 자리           기력 관문보다 **앞**이다. 기력은 기다리면 차고 사정은 만들러
                        가야 한다 (03 의 RULE-SKILL-BEGIN-001)

    새 기술 하나          `hatsu-burst` — 방식은 aura(능력 축이 닿는 값이 auraAttack 이다),
                        모양·구간은 heavy-attack 과 같은 값(차이가 사정에서만 오게 한다)

    수치 다섯            03 의 BALANCE ①~⑤ — 기본 피해 10 · 계수 1.3 · 소모 25 · 충전 6 ·
                        조건 몫 0.4 씩 · 관문 문턱 능력 몫 3

    관찰의 두 칸          요구와 조건은 **다른 칸**이다. 갖춰지지 않은 기술도 목록에 남고,
                        문턱 값은 싣지 않는다 (04)

    조건 관찰의 뜻        고른 대상에 대한 **예고**이며 약속이 아니다 — 실제로 닿은 몸에
                        대해 다시 세어진다 (04)

    Capability 판정       `MC-ABILITY-CONDITION` 은 `PARTIAL → IMPLEMENTED` 를,
                        `MC-AURA-ALLOCATION` 은 남은 절반의 해소를 겨눈다.
                        **둘 다 Stage 8 이 실측으로 확정한다** (01 의 Master Feedback)

## 다음

    Stage 6  World Implementation   — world/ + 06-world-implementation.md
    Stage 7  View Implementation    — view/ + 07-view-implementation.md
