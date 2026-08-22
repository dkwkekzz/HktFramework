# C025 — Intent

## 이 Cycle 이 답하는 물음

근거 기획서 `VUX-SK-D1` §1 은 기술 화면이 답해야 할 물음 다섯을 세운다.
이 Cycle 은 그중 **둘과 절반**을 답한다. 나머지는 세계에 아직 그 의미가 없다.

    1. 지금 어떤 기술을 쓸 수 있으며, 못 쓴다면 왜 못 쓰는가        **답한다**
    2. 입력한 기술은 어디를 기준으로 누구에게 적용될 예정인가        답하지 않는다 — Anchor 가
                                                                세계에 없다 (01 SCOPE NOTE ⑤)
    3. 현재 실행은 준비·유지·발사·충돌·반복 중 어느 단계인가         **절반** — 고르기 전에 아는
                                                                구간 경계까지. 진행 중인 구간을
                                                                실시간으로 읽는 것은 `VUX-SK-03`
    4. 실제로 누구에게 어떤 결과가 적용되었는가                     이미 답하고 있다 (C007 타격
                                                                결과 · C010 산정 경위). 이 Cycle 이
                                                                더하는 것은 **내 요청이 어떻게
                                                                되었는가** 라는 그 앞의 물음이다
    5. 보이던 Projectile·Area·Trap 은 언제 어디서 왜 사라졌는가      답하지 않는다 — 그런 존재가
                                                                세계에 없다

물음 1 과 4 앞자리가 이 Cycle 의 전부다. 물음 1 은 **행동 전**의 실수를 줄이고,
"내 요청이 어떻게 되었는가" 는 **행동 후**에 무엇이 일어났는지를 이해하게 한다.

## GOAL / POSSIBILITY

    GOAL-SKILL-IS-READ-NOT-GUESSED

        기술을 고르는 일이 짐작이 아니라 읽기가 된다.

        지금 세계는 이미 셋의 가용성과 사유와 값을 관찰에 싣고 있다.
        그런데 겪는 사람은 그중 하나만, 그것도 문구 한 줄로 만난다.
        **세계가 이미 말한 것을 사람이 듣지 못하고 있는 상태**를 끝낸다.

        └── POSSIBILITY-THE-WHOLE-HAND-AT-ONCE
                지닌 기술 전부가 동시에 관찰된다 — 하나가 다른 하나를 밀어내지 않는다

        └── POSSIBILITY-EVERY-BLOCK-NAMES-ITSELF
                막힌 기술마다 **자기** 사유를 지닌다 — 셋이 각각 다른 이유로 막혀 있으면
                셋의 이유가 각각 관찰된다

        └── POSSIBILITY-THE-PRICE-IS-KNOWN-BEFORE
                치를 것과 낼 것을 고르기 **전에** 안다 — 세계가 이미 싣고 있는 값이다

    GOAL-THE-REQUEST-IS-ANSWERED-WHERE-IT-WAS-ASKED

        건 요청이 어떻게 되었는지를, 그 요청을 부른 자리에서 안다.

        세계는 도착한 **모든** 요청에 이미 답한다 (RULE-REQUEST-REPLY-001 — Precondition
        없음). 그 대답이 관찰자에게까지 오고도 화면의 어느 자리에도 닿지 않는 요청이
        있다. 기술이 그것이다.

        └── POSSIBILITY-EVERY-REQUEST-CARRIES-ITS-MARK
                기술 요청도 표식을 지녀 자기 대답과 짝지어진다 — 명령만 그러던 것을
                요청 전체로 넓힌다

        └── POSSIBILITY-REFUSAL-IS-SEEN-WHERE-IT-WAS-ASKED
                거절은 그것을 부른 자리에 붙는다 — 남의 자리에 붙지 않는다

## INTENT SET

### 읽기 — 행동 전

    INTENT-SKILL-HAND-IS-WHOLE-001 (ADDED)

        관찰자는 자기 몸이 지금 지닌 기술을 **전부** 동시에 관찰한다.

        하나를 보기 위해 다른 하나를 포기하지 않는다. 세계가 기술 하나를 더 지니게
        되면 관찰되는 것도 하나 는다 — 관찰자 쪽에 기술의 목록이 따로 있어서
        그것을 고쳐야 하는 일이 없다.

        기술이라는 것은 세계가 정한다. 무엇이 기술이고 무엇이 아닌지를 관찰자가
        판단하지 않는다 (DC-WORLD-OWNS-THE-SURFACE-LIST).

    INTENT-SKILL-BLOCK-NAMES-ITSELF-001 (ADDED)

        쓸 수 없는 기술마다 **그 기술이** 막힌 사유가 함께 관찰된다.

        기력이 모자라 못 쓰는 것과, 막고 있어서 못 쓰는 것과, 지금 하는 행동이
        안 끝나서 못 쓰는 것과, 쓰러져서 못 쓰는 것은 서로 다른 사정이다.
        겪는 사람이 다음에 무엇을 하면 되는지가 사유마다 다르기 때문이다 —
        기다리면 되는 일인지, 손을 내리면 되는 일인지, 아무것도 할 수 없는 상태인지.

        셋이 서로 다른 이유로 막혀 있으면 **셋의 이유가 각각** 관찰된다.
        하나로 뭉뚱그리거나 하나만 골라 보이면 나머지 둘의 사정이 사라진다.

        그 사유는 실제 거절이 쓰는 판정과 **같은 출처**에서 온다. 미리 보인 이유와
        걸었을 때 돌아온 이유가 어긋나면 미리 보인 것은 안내가 아니라 거짓말이다.

    INTENT-SKILL-PRICE-BEFORE-CHOICE-001 (ADDED)

        기술을 고르기 **전에** 그 기술의 값을 관찰한다 —
        치르는 기력, 채우는 기력, 지금 이 몸으로 냈을 때의 공격 피해, 그 방식.

        고급 기술이 기본 기술보다 무엇을 더 치르고 무엇을 더 내는지를 모르면
        "지금 고급 기술을 쓸 것인가" 는 선택이 아니라 도박이다.
        방식(물리·오라)도 마찬가지다 — 세기가 아니라 방식으로 갈리는 선택은
        그 방식이 보여야만 선택이 된다.

        이 값들은 **세계가 지닌 값**이며 관찰자가 자기 능력치로 계산해 만들지 않는다.
        관찰자가 계산하면 세계와 화면에 두 개의 답이 생기고, 공식이 바뀌는 날
        둘이 갈라진다.

### 대답 — 행동 후

    INTENT-SKILL-REQUEST-ANSWERED-001 (ADDED)

        관찰자가 건 기술 요청은 **그 요청을 부른 자리에서** 대답을 받는다.

        받아들여진 요청과 거절된 요청은 서로 다르게 관찰된다.
        거절이면 세계가 준 사유가 함께 온다.

        그리고 **아무 대답도 오지 않은 것**과 **거절된 것**이 구분된다 —
        눌렀는데 세계에 닿지 않은 것과, 닿았고 세계가 안 된다고 답한 것은
        겪는 사람에게 서로 다른 사정이다.

        어느 대답이 어느 요청의 것인지도 섞이지 않는다. 연달아 여러 번 부른 이도
        어느 것이 받아들여지고 어느 것이 거절되었는지 안다
        (INTENT-REPLY-CORRESPONDENCE-001 이 명령에 대해 세운 것과 같은 성질이다).

        그러므로 **표식 없이 나가는 요청이 남아 있어서는 안 된다.**
        표식이 없는 대답은 갈 곳이 없고, 갈 곳이 없는 대답은 엉뚱한 자리에 붙는다.

    INTENT-NOTHING-BEFORE-THE-WORLD-SAYS-SO-001 (ADDED)

        요청과 대답 사이에 관찰자는 **아직 일어나지 않은 것을 관찰하지 않는다.**

        기력이 줄었다는 것도, 기술이 나갔다는 것도, 무엇이 맞았다는 것도
        세계의 관찰 결과가 그렇게 말할 때에만 참이다.

        요청을 걸어 둔 상태 자체는 관찰된다 — 그것은 세계의 일이 아니라
        **내가 무엇을 걸어 두었는가** 이며 관찰자 자신이 아는 사실이다.
        걸어 둔 것과 일어난 것이 화면에서 구분된다.

### 입력

    INTENT-SKILL-INPUT-CONVERGES-001 (ADDED)

        같은 기술을 부르는 서로 다른 입력은 세계에 **같은 요청**으로 도착한다.

        키로 불렀든 화면을 짚어 불렀든 세계로 나가는 것이 같다.
        세계는 무엇이 자기를 불렀는지 알지 못하며, 알 필요도 없다 —
        입력 장치마다 다른 기술 규칙이 생길 길 자체가 없다.

        그러므로 "무엇을 부를 수 있는가" 의 목록도 하나여야 한다.
        입력 수단마다 자기 목록을 따로 만들면 그 목록들이 갈라지고,
        갈라진 순간 세계가 실은 것과 화면이 보이는 것이 서로 다른 답을 한다.

## DESIGN TRACE

    INTENT-SKILL-HAND-IS-WHOLE-001
        Source Goal         GOAL-SKILL-IS-READ-NOT-GUESSED
        Source Possibility  POSSIBILITY-THE-WHOLE-HAND-AT-ONCE

    INTENT-SKILL-BLOCK-NAMES-ITSELF-001
        Source Goal         GOAL-SKILL-IS-READ-NOT-GUESSED
        Source Possibility  POSSIBILITY-EVERY-BLOCK-NAMES-ITSELF

    INTENT-SKILL-PRICE-BEFORE-CHOICE-001
        Source Goal         GOAL-SKILL-IS-READ-NOT-GUESSED
        Source Possibility  POSSIBILITY-THE-PRICE-IS-KNOWN-BEFORE

    INTENT-SKILL-REQUEST-ANSWERED-001
        Source Goal         GOAL-THE-REQUEST-IS-ANSWERED-WHERE-IT-WAS-ASKED
        Source Possibility  POSSIBILITY-EVERY-REQUEST-CARRIES-ITS-MARK ·
                            POSSIBILITY-REFUSAL-IS-SEEN-WHERE-IT-WAS-ASKED

    INTENT-NOTHING-BEFORE-THE-WORLD-SAYS-SO-001
        Source Goal         GOAL-THE-REQUEST-IS-ANSWERED-WHERE-IT-WAS-ASKED
        Source Possibility  POSSIBILITY-REFUSAL-IS-SEEN-WHERE-IT-WAS-ASKED

    INTENT-SKILL-INPUT-CONVERGES-001
        Source Goal         GOAL-SKILL-IS-READ-NOT-GUESSED
        Source Possibility  POSSIBILITY-THE-WHOLE-HAND-AT-ONCE

## EXISTING INTENT DELTA

    REUSED — 이 Cycle 이 다시 만들지 않고 그대로 쓰는 것

        INTENT-SKILL-COST-GATE-001          (C007) 기력이 모자라면 기술이 나가지 않는다.
                                            **관문도 값도 움직이지 않는다** — 이 Cycle 은
                                            그 관문의 판정을 읽을 뿐이다
        INTENT-SKILL-BUDGET-001             (C007) 맞아야 기력이 돈다. 열리지 않는다
        INTENT-SKILL-SCALING-001            (C007) 공격 능력이 피해에 실린다 —
                                            profile 의 `rawDamage` 가 그 결과다
        INTENT-DAMAGE-TYPE-001              (C012) 기술마다 방식이 있다
        INTENT-AURA-SKILL-001               (C012) 오라 기술은 기존 관문을 그대로 지난다
        INTENT-SKILL-PHASE-001              (C019) 기술에는 구간이 있고 경계는 기술마다
                                            다르다 — 경계 값(`swingBegin`·`swingEnd`)이
                                            profile 로 오고 있다
        INTENT-ACTION-EXCLUSIVE-001         (C002) 한 몸은 한 행동 안에 있다 —
                                            `action-busy` 사유의 근거
        INTENT-GUARD-RESTRICT-001           (C011) 막는 몸으로는 휘두르지 못한다 —
                                            `guarding` 사유의 근거
        INTENT-DOWNED-001                   (C007) 쓰러진 몸은 행동하지 않는다 —
                                            `downed` 사유의 근거
        INTENT-REQUEST-REPLY-001            (C009) 도착한 모든 요청이 대답을 받는다.
                                            **세계 쪽은 이미 완성되어 있다**
        INTENT-REPLY-CORRESPONDENCE-001     (C009) 어느 대답이 어느 요청의 것인지 짚는다.
                                            표식이 그 수단이며 형도 길도 이미 있다
        INTENT-SELF-OBSERVE-001             (C007) 자기 몸의 값은 자기가 본다
        INTENT-PER-OBSERVER-PROJECTION-001  관찰은 관찰자마다 따로 만들어진다
        INTENT-LINK-ALWAYS-SHOWN-001        (C005) 이어짐은 늘 보인다 — "대답이 오지 않는다"
                                            를 판단할 근거가 이미 화면에 있다

    확장 — 기존 Intent 가 세운 성질을 **새 자리**에 그대로 적용한다

        INTENT-EACH-REFUSAL-HAS-ITS-OWN-REASON-001   (C024)

            C024 가 아이템의 자리에서 세운 것을 기술의 자리에 그대로 옮긴다.
            그때의 문장이 그대로 참이다 — "하나로 뭉뚱그리면 겪는 사람은 무엇을 하면
            되는지 알 수 없다". 기술의 사유 넷도 각각 다음 행동이 다르다.

            **새 사유를 만들지 않는다.** 세계에 이미 있는 넷을 각자의 자리에
            도착시키는 일이다. INTENT-SKILL-BLOCK-NAMES-ITSELF-001 은 이 성질을
            기술 표면에서 부르는 이름이다.

        INTENT-REPLY-CORRESPONDENCE-001              (C009)

            C009 는 이 성질을 **명령**에 대해 세웠고 그 길(표식)도 함께 세웠다.
            이 Cycle 은 그 길을 **기술 요청도 지나게** 한다.

            세계 쪽에서는 아무것도 바뀌지 않는다 — 세계는 받은 표식을 되돌릴 뿐
            그것을 해석하지 않으며, 표식 없는 요청도 이미 대답한다.
            바뀌는 것은 **관찰자가 표식을 다는가** 하나다.

    CHANGED

        없음 — 기존 Intent 중 뜻이 바뀌는 것이 없다.

        이 Cycle 은 세계에 무엇이 가능한지를 하나도 바꾸지 않는다.
        가능한 것과 불가능한 것의 경계가 그대로이고, 사유도 그대로이고,
        값도 그대로다. 바뀌는 것은 **그것이 겪는 사람에게 도착하는가** 뿐이다.

    AFFECTED — 이 변화가 닿는 기존 것

        명령 콘솔의 대답 붙이기      지금 표식 없는 대답은 **명령 기록의 마지막 줄**에
                                  붙는다. 기술 요청이 표식 없이 나가므로, 명령을 한 번
                                  쓴 뒤 기술이 거절되면 그 사유가 엉뚱하게 명령 줄에
                                  붙는다. 기술이 표식을 달면 이 어긋남이 사라진다 —
                                  **명령 콘솔 자체의 동작은 그대로여야 한다** (회귀)

        바닥 프롬프트               기술이 자기 자리를 갖게 되면 프롬프트가 다투는 것이
                                  달라진다. C017 이 우선순위를 세운 판단(상대에게 하는 일 →
                                  내 몸을 다루는 일 → 판을 정리하는 일)은 뒤집지 않는다

        손가락 버튼 띠              같은 목록을 읽어야 두 표면이 갈리지 않는다
                                  (INTENT-SKILL-INPUT-CONVERGES-001).
                                  그 파일이 기반에 있으므로 열려야 한다면 그것은
                                  `[CAPABILITY-GAP]` 이다 — 컨텐츠 Cycle 이 기반을 고치지 않는다

        기존 Fixture               `view/tests/fixtures/*.json` 은 이미 세 기술과 profile 을
                                  지니고 있다. 띠가 서면 기존 Fixture 로도 곧바로 그려지므로
                                  그것들이 회귀 확인 자리가 된다
