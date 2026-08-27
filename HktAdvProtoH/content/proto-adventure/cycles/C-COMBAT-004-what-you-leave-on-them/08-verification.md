# CYCLE C-COMBAT-004 — Verification

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[PASS] Playable            — Human 확인 (아래 PLAYABLE)
[PASS] Regression
[PASS] Catalog             — 존재 종류를 늘리지 않았다 (`catalog:check` 통과)

## NEW BEHAVIOR

    아무도 고르지 않았다        → 표식을 남길 수 없고, 세계가 **참인 사유**를 말한다
    고른 상대에게 아직 없다     → 남길 수 있다. 피해 0 인 한 대가 나간다
    닿았다                    → 생명이 한 톨도 줄지 않고 대상에 표식이 생긴다
    이미 걸어 두었다           → 다시 걸 수 없고 그 사유가 실린다
    표식이 붙어 있다           → 그 몸에 들어가는 발현 일격이 크게 들어간다
    6 초가 지났다              → 닫는 규칙 없이 사라지고 다시 걸 수 있게 된다
    다른 곳을 골랐다           → **표식은 그대로 남아 있다** (지목과 갈리는 자리)

## WORLD SCENARIO

실측이다. `world/tests/mark.spec.ts` 와 같은 배치를 실제로 굴려 받아 적었다.

    배치    관찰자 rabbit-swordsman (AuraAtk 40 · 오라 관통 60 · Cp 100)
            자율 존재 wanderer (Resist 90 · Hp 120 · 배분 balanced) 을 1.5 앞에

    ① 아무도 고르지 않았다
        Input   skill-mark (고르지 않은 채)
        Rule    RULE-SKILL-BEGIN-001 → RULE-ABILITY-REQUIREMENT-001
        Result  failure(**no-target-selected**)
        주      그 사정의 사유(`already-marked-by-them`)가 아니다 —
                아무것도 안 걸었는데 그렇게 말하면 세계가 참이 아닌 것을 말한다
                (07 NOTES ② · 브라우저가 잡았다)

    ② 고르고 남긴다
        Before  Cp 100 · 상대 Hp 120 · marks []
        Input   select-target(npc-1) → skill-mark
        Rule    RULE-SKILL-BEGIN-001 → RULE-SWING-STRIKE-001 → RULE-MARK-LEAVE-001
        After   Cp 100 → 90 (소모 10 · 충전 0)
                **상대 Hp 120 → 120** — 한 톨도 줄지 않았다
                타격 결과 `mark-strike` amount 0 · raw 0  ← 닿은 일은 그대로 관찰된다
                marks [{ byId: player-1, since: 0.233 }]

    ③ 이미 걸어 두었으면 다시 걸 수 없다
        Input   skill-mark (휘두름이 끝난 뒤)
        Result  available false · reason `already-marked-by-them`

    ④ 표식이 다음 한 방을 바꾼다
        Before  표식 붙어 있음 · 배분 hatsu
        Input   skill-hatsu
        Rule    RULE-ABILITY-CONDITION-001 이 계수를 1.3 → 1.8 로
        After   피해 **80** · raw 125.2
                conditions [{ bears-my-mark, +0.5 }]
                상대 Hp 120 → 40 · Cp 56

        같은 배분에서 **표식 없이 친 같은 기술은 60** 이다.
        표식 한 대(0.6초 · 기력 10)를 치르고 20 을 얻었다 —
        상대 생명 120 기준으로 여섯 대가 다섯 대가 된다.

    ⑤ 시간이 닫는다 — 지우는 규칙이 없다
        After   남긴 직후 marks [{ player-1, 0.233 }]
                6.0 초 뒤 marks [] · 다시 걸기 available true
        주      **몸이 지닌 시각은 지워지지 않았다** — 다만 참이 아니다
                (단위 검사가 그 사실을 박는다). 세계에 지우는 규칙이 없다

    Rule 을 거치지 않고 바뀐 상태 없음 — 표식은 RULE-MARK-LEAVE-001 만이 쓴다.

## VIEW FIXTURE

World 미기동, Fixture 만으로 17 검사 (`view/tests/mark.spec.ts`). fixture 셋 다 실제
세계를 굴려 받아 적었다.

    mark-none       고르긴 했으나 아직 남기지 않은 세계
        `요구 ✓그 상대에게 내 표식 없음` · `피해 없음` · 몸 위에 표기 없음 ·
        펼침 `표식 없음` · 발현 일격의 조건 셋째가 `✗그 상대에게 내 표식 +0.5`
    mark-borne      남기고 그 뒤 크게 들어간 세계
        몸 위 `◈` · 펼침 `표식 player-1` · `✗ 이미 표식을 남겨 두었다` ·
        한 방 80 · conditions [{ bears-my-mark, 0.5 }]
    mark-unchosen   아무도 고르지 않은 세계
        `✗ 먼저 대상을 고르자` — **"이미 남겨 두었다" 가 아니다**
        요구의 이름은 흔들리지 않는다 (`요구 ✗그 상대에게 내 표식 없음`)

    살펴보지 않은 존재에도 표식이 뜬다 — `acquainted false` · `concealed` 에
    `combatStats` 가 있는 채로 `marks` 가 실린다.

    브라우저 실측  shots/mark-not-yet-and-what-it-opens.png — 다섯 칸의 띠와
                   패널 두 줄과 펼침의 표식 줄이 실제 화면에 섰다 (07 의 "눈으로 본 것").

## PLAYABLE

    **Human 이 확인했다** (2026-08-27 · 세션 지시 "complete 처리").
    확인의 근거는 **관측 결과**다 — 위 WORLD SCENARIO ①~⑤ 와 VIEW FIXTURE 를 실제
    세계에서 굴려 관측 계약과 화면 문장을 나란히 놓고 보았고, 관찰 쪽은 브라우저에서
    실제로 찍었다 (`shots/mark-not-yet-and-what-it-opens.png` · 판정 여섯 전부 OK).

    **손으로 눌러 보는 길은 이 환경에서 막혀 있다.** 직전 Cycle 과 같은 사유다:
    헤드리스 컨테이너 · 소프트웨어 GPU 에서는 **어떤 요청도 세계에 닿지 않는다**
    (`왕복 1538ms`). 이 Cycle 의 결함이 아니며, 같은 절차를 이 Cycle 이전 코드에 대고
    돌리면 기본 기술도 똑같이 그렇게 된다 (C-COMBAT-003 07 NOTES ④).

    남은 길 — 사람이 손으로 눌러 볼 때 볼 것 (`npm run dev`)

        1. 기술 띠 넷째 칸에 `P 표식 남기기` 가 있고, 아무도 고르지 않았으면
           **"먼저 대상을 고르자"** 라고 말한다
        2. 상대를 고르고 `P` — 상대의 생명이 **한 톨도 줄지 않는데** 이름 앞에 `◈` 가 붙는다
        3. 다시 `P` — 나가지 않고 "이미 표식을 남겨 두었다" 가 뜬다
        4. `U` → `3` → `O` — 발현 일격이 60 이 아니라 80 으로 들어가고, 떠오른 경위에서
           그 이유를 되짚을 수 있다
        5. 다른 상대를 골라도 `◈` 는 그 몸에 남아 있다
        6. 6 초가 지나면 `◈` 가 사라지고 `P` 가 다시 살아난다

    2 를 하려면 기력 10 이 필요하다 — 시작 기력 30 으로 충분하다.
    4 까지 하려면 배분 15 + 발현 25 가 더 드므로 기본 기술로 조금 모아야 한다.

## REGRESSION

    03 의 AFFECTED 를 전부 돌았다 (실측값이다).

    표식을 걸지 않은 세계가 C-COMBAT-003 이 닫은 그대로다
        기본 기술 20 · 표식 없이 친 발현 일격 60 — 값 하나까지 같다
        `hatsu-burst` 는 **배분만 갖추면 나간다** (표식은 조건이지 요구가 아니다)
        기존 넷의 `requires` · `amplifiedBy` · `leavesMark` 가 비어 있거나 거짓이다

    관문이 상대를 받게 넓혔어도 기존 요구는 그대로다
        `power-in-ability` 는 상대를 읽지 않으므로 넘어온 상대가 무엇이든 같은 답이다
        (단위 검사가 두 경우를 함께 잰다)

    RULE-DAMAGE-CALCULATE-001           식 무변경 — 위력이 0 이면 값이 0 이다
    RULE-HIT-001 · RULE-DEEDS-ADD-001   피해 0 인 타격도 그대로 지난다 (03 JUDGEMENT ⑤)
    RULE-ENGAGEMENT-REACHES-001         새 기술의 닿는 길이 정합 (0.6 ≤ 2.0 ≤ 2.0)
    Observer Projection                 기술 자리가 넷 → 다섯 · 존재마다 `marks`

    전체 1619 검사 통과 · `boundary:check` · `tsc` · `catalog:check` · `motions:check`
    (이 Cycle 이전 1570 → world 31 + view 17 + 기존 보강 1)

## MASTER FEEDBACK

### Capability Overlay

    MC-MARK   MISSING → IMPLEMENTED
        근거는 이 문서의 WORLD SCENARIO ②③④⑤ 와 VIEW FIXTURE 다.
        노드의 world_shape 세 문장이 전부 실측으로 성립한다.

            "대상에 붙는 표식이 세계의 사실로 존재한다"     → ② (marks 에 남는다)
            "붙어 있다는 것이 양쪽 모두에게 보인다"          → VIEW FIXTURE
                                                            (살펴봄 관문 밖이다)
            "이후의 판정이 그 표식의 유무로 달라진다"        → ④ (60 → 80)

        detail 이 강조한 가름도 세계에서 확인된다 — **다른 곳을 골라도 남아 있다**
        (지목과 표식이 갈리는 유일한 성질 · 단위 검사가 그것을 잰다).

    MC-ABILITY-CONDITION   IMPLEMENTED 유지 · **근거가 두꺼워졌다**
        직전 Cycle 이 `PARTIAL → IMPLEMENTED` 로 보고한 노드다. 등급은 오르지 않으나
        그 Cycle 이 남긴 Master Gap ②(관문이 상대를 읽지 못한다)가 **닫혔다** —
        UL §18 이 요구의 예로 든 "Target 에 Mark 존재" 가 이제 세계에서 성립한다.

### Possibility 전진

    MP-BIND-BY-CONTRACT   요구 넷 중 둘이 섰다 (MC-ABILITY-CONDITION · MC-MARK).
                          남은 둘 — MC-VOW · MC-BIND. **다음 후보가 그 둘을 함께 세운다**
                          (FR-A-PROMISE-BINDS-BOTH — 쪼갤 수 없다고 후보가 적었다)
    MP-KNOW-THE-OPPONENT-RULE
                          이 Cycle 이 직접 전진시키지 않는다. 다만 규칙 있는 능력의
                          **형태**가 한 칸 더 찼다 (UL §16 의 아홉 칸 중 Requirement 가
                          이제 상대를 읽는다)

### Constraint Evaluation

    DC-COMBAT-ABILITY-IS-A-RULE           SATISFIED — **이 Cycle 이 그 제약의 실물이다**
        `mark-strike` 는 피해가 0 이고 그래도 강하다. 그 제약의 rationale 이
        ❌ 로 든 형태("능력을 효과 목록으로 만든다 — 이름과 연출은 달라도 세계가 겪는
        일은 하나뿐")의 정확한 반대이며, UL §23 이 대표 실물로 든 것과 같은 종류다.

    DC-CONDITION-OPENS-WITHOUT-RECORDING  SATISFIED
        표식은 시각이고 지우는 규칙이 세계에 없다. WORLD SCENARIO ⑤ 가 그것을 실측하며,
        단위 검사가 **닫힌 뒤에도 몸이 지닌 시각은 그대로**임을 박는다 —
        "장부에는 열림인데 지금 조건은 닫힘" 이라는 어긋남의 자리 자체가 없다.

    DC-COMBAT-UNAVAILABLE-HAS-A-REASON    SATISFIED — **한 번 어겼다가 고쳤다**
        아무도 고르지 않았는데 "이미 표식을 남겨 두었다" 가 나갔다. 사유가 **있는** 것과
        **읽을 수 있는** 것은 다르며, 참이 아닌 사유는 회색으로 칠하고 끝내는 것보다
        나쁘다 — 플레이어를 틀린 방향으로 보낸다. 브라우저가 잡았고 고쳤다 (07 NOTES ②).
        아래 Constraint Candidate ① 이 그 관찰이다.

    DC-COMBAT-ONE-FORMULA                 SATISFIED
        `RULE-DAMAGE-CALCULATE-001` 무변경. 표식이 판정을 바꾸는 길은 직전 Cycle 이
        세운 사정 하나뿐이며, 그것은 식의 **입력**을 고르는 일이다.

    DC-COMBAT-PLAYER-CAUSALITY            SATISFIED
        표식의 유무에 난수가 없다. 60 → 80 의 차이가 경위에서 `bears-my-mark +0.5` 로
        되짚어진다.

    DC-COMBAT-ONE-LAYER-AT-A-TIME         SATISFIED
        표식을 걸지 않은 세계가 C-COMBAT-003 이 닫은 그대로다. 그 근거가 **`hatsu-burst`
        에 표식을 요구가 아니라 조건으로 건 판단**이며 (03 JUDGEMENT ③), 회귀 검사가
        그것을 지킨다.

    DC-WORLD-OWNS-THE-SURFACE-LIST        SATISFIED
        사정 목록도 표식의 지속도 세계가 소유한다. 화면은 "언제까지인가" 를 모르며
        시험이 그것을 박는다.

### Constraint Candidate

    ① CC-A-REASON-MUST-BE-TRUE — 사유는 있는 것이 아니라 **참인 것**이어야 한다
        `DC-COMBAT-UNAVAILABLE-HAS-A-REASON` 은 사유가 **드러나야 한다**고 적는다.
        이번에 세계는 사유를 드러냈고 — 그런데 그 사유가 거짓이었다. 관문이 "상대가
        없다" 와 "그 사정이 거짓이다" 를 한 답으로 뭉갰기 때문이다.

        같은 모양의 자리가 이 세계에 이미 있다 — C017 이 `no-target-selected` 와
        `target-is-self` 를 가른 것, C024 가 `no-occupied-slot` 을 "가방 탓이 아니다"
        로 다시 쓴 것, C011 이 막기 판정을 행동 관문 **앞**에 둔 것. 셋 다 "사유가
        참이 되게 하려고 판정의 순서나 갈래를 고친" 자리다.

        승격할 것인가, 기존 DC 의 requires 에 문장 하나를 더할 것인가는 Human 이
        정한다. 관찰은 이번이 처음 이름 붙는 것이며, 위 셋은 소급 근거다.

    ② CC-THE-RULE-DOES-NOT-ASK-WHO-DRIVES — **일곱째 반복**
        `RULE-MARK-LEAVE-001` 의 Input 에 누가 조종하는 몸인지가 없고, 자율 존재가
        남긴 표식도 사람의 몸에 붙는 것을 시험이 확인한다.

### Master Gap

    ① 자율 존재는 고르지 않으므로 상대를 읽는 요구가 그들에게 언제나 거짓이다
        고른 대상은 **관찰자별** 장부이고(C017) 자율 존재는 그것을 읽지 않는다.
        규칙이 조종 주체를 묻는 것이 아니라 자율 존재가 아직 고르지 않기 때문이다.

        C-COMBAT-003 의 Master Gap ① 과 **같은 종류이며 이것으로 둘째다** — 그 Cycle 은
        자율 존재가 능력 축에 몰지 않아 관문을 못 지났고, 이번에는 고르지 않아 못 지난다.
        둘 다 규칙의 구멍이 아니라 **판단 구조의 미개방**이고, 둘 다 같은 문서를
        기다린다 (`Design-Creature-Behavior-R0` — Master 의 HUMAN 대기).

        **두 번 같은 자리에서 걸렸다는 것이 보고의 요지다.** 사슬 B 의 남은 셋
        (계약 · 규칙 관찰 · 봉인)이 전부 "상대가 무엇을 하는가" 를 전제하므로,
        그 문서가 서지 않으면 이 트랙은 곧 반쪽만 검증되는 층을 쌓게 된다.

    ② 기술을 부를 손가락 자리가 **바닥났다**
        C-COMBAT-003 이 `O` 를, 이 Cycle 이 `P` 를 썼다. **글자 키가 남지 않았다.**
        사슬 B 에 후보 셋이 남아 있고 그중 계약·묶음은 조작이 둘 이상일 수 있다.

        막힘은 아니다 — 띠는 눌러서도 부른다 (C025). 그러나 **다음 Cycle 은 키 없는
        기술을 세우게 된다.** `works/BACKLOG.md` 의 `skill-slot-crowds-the-keyboard` 가
        그 자리를 기다리며, 그것은 VIEW/ENGINE 레인의 일이다 (세계를 건드리지 않는다).

    ③ 표식의 지속이 관찰에 없다 — 지금은 결손이 아니다
        세계는 "지금 붙어 있는가" 만 싣고 "얼마나 남았는가" 는 싣지 않는다. 화면이
        시계를 들고 규칙을 복제하지 않게 하는 판단이며 (C016 이 통찰 문턱에 내린 것과
        같다), 지금 플레이에서는 6 초가 넉넉해 문제가 되지 않는다.

        남은 시간을 눈에 보이게 하고 싶어지는 날, 그것은 화면의 요구가 아니라
        **세계가 무엇을 실을지의 물음**이므로 Frontier 로 올린다.

### VIEW 레인으로 넘기는 것

    새 항목 없음. 이 Cycle 은 `works/BACKLOG.md` 에 이미 선 두 항목의 값을 키웠을 뿐이다.

        condition-in-the-breakdown        경위의 조건 목록에 표식이 하나 더 늘었다
        skill-slot-crowds-the-keyboard    **시한이 왔다** (위 Master Gap ②)

## FAILURES

    없음 — 6종 전부 통과. Playable 은 관측 결과로 Human 이 확인했고, 손으로 눌러 보는
    길이 이 환경에서 막힌 사유는 판정 실패가 아니라 환경의 한계다 (PLAYABLE 절).

## STATUS

    COMPLETE
