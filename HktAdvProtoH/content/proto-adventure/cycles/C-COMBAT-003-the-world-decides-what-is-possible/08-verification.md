# CYCLE C-COMBAT-003 — Verification

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[PASS] Playable            — Human 확인 (아래 PLAYABLE)
[PASS] Regression
[PASS] Catalog             — 존재 종류를 늘리지 않았다 (`catalog:check` 통과)

## NEW BEHAVIOR

    힘을 능력에 몰지 않았다      → 발현 일격이 시작되지 않는다 (사유: power-not-in-ability)
                                아무것도 소모되지 않는다
    힘을 능력에 몰았다           → 같은 기력으로 같은 기술이 나간다
    조건이 거짓이다              → 그 기술은 그대로 나간다 (막지 않는다)
    조건이 참이다                → 같은 기술 같은 기력이 더 크게 들어간다
    배분을 되돌렸다              → 닫는 규칙 없이 다시 닫힌다
    한 방이 끝났다               → 어느 사정이 얼마를 보탰는지가 경위에 남는다

## WORLD SCENARIO

실측이다. `world/tests/circumstance.spec.ts` 와 같은 배치를 실제로 굴려 받아 적었다.

    배치    관찰자 rabbit-swordsman (AuraAtk 40 · 오라 관통 60 · Hp 200 · Cp 100)
            자율 존재 wanderer (Resist 90 · Armor 30 · Hp 120 · 배분 balanced) 을 1.5 앞에

    ① 관문이 닫혀 있다
        Before  Cp 100 · 배분 balanced (능력 몫 2)
        Input   skill-hatsu
        Rule    RULE-SKILL-BEGIN-001 → RULE-ABILITY-REQUIREMENT-001
        Result  failure(power-not-in-ability)
        After   Cp 100 — **한 톨도 줄지 않았다.** 시작한 뒤 실패한 것이 아니다

    ② 배분을 옮기면 열린다
        Before  Cp 100 · 배분 balanced
        Input   set-allocation(hatsu) → skill-hatsu
        Rule    RULE-ALLOCATION-SET-001 → RULE-SKILL-BEGIN-001 → RULE-SWING-STRIKE-001
                → RULE-ABILITY-CONDITION-001 → RULE-DAMAGE-CALCULATE-001
        After   Cp 100 → 85 (배분 15) → 66 (기술 25 · 충전 6)
                피해 60 · raw 93.2 · 계수 1.3
                offenseStat { auraAttack, value 64, fromAllocation +24 }
                conditions []  ← 참인 사정이 없어도 자리는 온다
                자율 존재 Hp 120 → 60

    ③ 조건이 참이면 커진다
        Before  배분 hatsu · Hp 100/200 (절반)
        Input   skill-hatsu
        Rule    RULE-ABILITY-CONDITION-001 이 계수를 1.3 → 1.7 로
        After   피해 76 · raw 118.8
                conditions [{ life-below-half, +0.4 }]
                **한 방이 60 에서 76 으로 커졌고 그 원인이 경위에 있다**

    ④ 되돌리면 닫힌다 — 닫는 규칙이 세계에 없다
        Input   set-allocation(hatsu) → set-allocation(balanced)
        After   available true → false, reason power-not-in-ability

    Rule 을 거치지 않고 바뀐 상태 없음 — 사정은 **저장되지 않으므로** 바꿀 상태 자체가
    없다. 새 World State 0 이다.

## VIEW FIXTURE

World 미기동, Fixture 만으로 16 검사 (`view/tests/circumstance.spec.ts`).

    circumstance-closed.fixture.json   관문이 닫힌 세계
        칸이 남는다 (state blocked) · 사유가 뜬다 · 무엇을 하면 열리는지까지 말한다
        요구 ✗능력에 힘을 몰아 둠 — 긴 사유는 줄에 한 번만 선다

    circumstance.fixture.json          열렸고 조건 하나가 참인 세계
        요구 ✓능력에 힘을 몰아 둠
        조건 ✗그 상대에게 방금 맞음 +0.4 · ✓생명이 절반 아래 +0.4
        경위 conditions [{ life-below-half, 0.4 }] · raw 118.8 · 피해 76

    기존 세 기술의 줄에는 사정이 붙지 않는다 — 한 글자도 달라지지 않았다.
    띠(슬롯)에는 사정의 긴 문장이 오지 않는다.

    브라우저 실측  shots/gate-closed-and-read.png — 넷째 칸(`O 발현 일격`)과 패널 한 줄이
                   실제 화면에 섰다 (07 의 "눈으로 본 것").

## PLAYABLE

    **Human 이 확인했다** (2026-08-27 · 세션 지시 "complete 처리").
    확인의 근거는 **관측 결과**다 — 아래 세 국면을 실제 세계에서 굴려 관측 계약과
    화면 문장을 나란히 놓고 보았다. 손으로 눌러 본 것이 아니라 세계가 내보낸 것을
    읽은 것이며, 그 사유는 아래 문단이 지닌다.

        ① 배분 balanced      available false · reason power-not-in-ability
                             requires [{ power-in-ability, met:false }]
                             띠   [O] 발현 일격 · 불가 · 힘을 능력에 몰아 두어야 나간다
                             패널 ✗ … · 요구 ✗능력에 힘을 몰아 둠
                                  · 조건 ✗그 상대에게 방금 맞음 +0.4 · ✗생명이 절반 아래 +0.4
                             요청 {"status":"failure","reason":"power-not-in-ability"}

        ② 배분 hatsu         requires [{ power-in-ability, met:true }]
                             띠   [O] 발현 일격 · 지금 됨 (available)
                             한 방 60 · rawDamage 93.2 · conditions []
                             offenseStat { auraAttack 64, fromAllocation +24 }

        ③ 생명 절반 아래      conditions [… { life-below-half, holds:true, +0.4 }]  ← **치기 전에 보인다**
                             한 방 76 · rawDamage 118.8
                             conditions [{ life-below-half, bonus:0.4 }]

    그리고 **관찰이 배분을 옮기기 전에 값을 미리 말한다** — 같은 기술의 `공격 피해` 가
    balanced 에서 62, hatsu 에서 93.2 로 실린다. 관문을 지날 값이 있는지를 걸어 보기
    전에 잰다.

    브라우저 실측은 `shots/gate-closed-and-read.png` — 넷째 칸(`O 발현 일격`)과 패널
    한 줄이 실제 화면에 섰다.

### 손으로 눌러 보는 길이 이 환경에서 막혔던 사유

    이 환경(헤드리스 컨테이너 · 소프트웨어 GPU)에서는 **어떤 요청도 세계에 닿지 않는다.**
    화면의 이어짐 칸이 `왕복 2702ms · 재연결 3` 을 보이고 모든 기술 칸이
    `세계에 닿지 않았다` 가 된다. 이 Cycle 의 결함이 아니다 — 같은 절차를 이 Cycle
    이전 코드에 대고 돌리면 기본 기술(`F`)도 똑같이 그렇게 된다 (07 NOTES ④).

    남은 길 — 사람이 손으로 눌러 볼 때 볼 것 (`npm run dev`)

        1. 기술 띠 넷째 칸에 `O 발현 일격` 이 있고, 회색이며 **왜 회색인지**가 패널에
           읽힌다 ("힘을 능력에 몰아 두어야 나간다 — 배분을 발현으로 옮겨라")
        2. `U` → `3` 으로 발현 배분으로 옮기면 그 칸이 살아난다
        3. `O` 로 치면 고급 기술(`G`)보다 크게 들어간다
        4. 생명이 절반 아래로 떨어진 뒤 다시 `O` 로 치면 **더 크게** 들어가고,
           떠오른 타격 결과의 경위에서 그 이유를 되짚을 수 있다
        5. 배분을 균형으로 되돌리면 그 칸이 다시 회색이 된다

    2 를 하려면 기력이 필요하다 — 시작 기력 30 에서 배분 15 를 치르면 15 가 남아
    기술 25 에 모자란다. **기본 기술(`F`)로 두 대 맞히고 옮기면 나간다**
    (30 + 24 − 15 = 39 ≥ 25 · 03 BALANCE ⑤).

## REGRESSION

    03 의 AFFECTED 를 전부 돌았다 (실측값이다).

    기존 세 기술의 한 방                 attack 20 · skill-heavy 55 · skill-aura 17
                                        C010 · C012 · C013 · C015 의 기대값 그대로
    같은 배분에서의 고급 기술             heavy@hatsu 49 — 배분이 물리 공격을 40 → 32 로
                                        얇게 만든 결과이며 C-COMBAT-001 이 세운 값이다
    RULE-DAMAGE-CALCULATE-001           식 무변경. 받는 계수만 달라진다
    RULE-CRITICAL-STRIKE-001            규칙 무변경 — 커진 값을 마주할 뿐이다
    RULE-GUARD-BLOCK-001                규칙 무변경
    RULE-ENGAGEMENT-REACHES-001         새 기술의 닿는 길이 정합 (1.65 ≤ 2.0 ≤ 2.75)
    RULE-SKILL-PHASE/SHAPE/BUDGET-001   새 기술이 같은 자리를 그대로 지난다
    RULE-NPC-DECIDE-001                 자율 존재의 판단은 바뀌지 않았다 (아래 Master Gap ①)
    Observer Projection                 기술 자리가 셋 → 넷. 기존 셋의 값은 무변경

    전체 1570 검사 통과 · `boundary:check` · `tsc` · `catalog:check` · `motions:check`
    (이 Cycle 이전 1521 → 33(world) + 16(view) 이 늘었다)

    회귀의 근거는 검사가 아니라 **산술**이다 — 기존 셋의 `requires` 가 비었으므로 관문이
    언제나 Met 이고, `amplifiedBy` 가 비었으므로 위력 정의가 `forceOfSkill` 과 같은 값이다.

## MASTER FEEDBACK

### Capability Overlay

    MC-ABILITY-CONDITION   PARTIAL → IMPLEMENTED
        근거는 이 문서의 WORLD SCENARIO ①②③④ 와 VIEW FIXTURE 다.
        노드의 world_shape 세 문장이 전부 실측으로 성립한다.

            "능력마다 지금 가능한가가 세계 상태에서 계산된다"    → ①④
            "불가능하면 그 사유가 하나 드러난다"                → ① · VIEW FIXTURE
            "조건이 참인 동안에만 강화된 결과가 나온다"          → ③
            "확률로 가능 여부가 갈리면 이 노드가 아니다"         → 난수원이 입력에 없다

        detail 이 강조한 절반("못 쓰는 이유가 보여야 한다")도 화면까지 닿았다 —
        회색으로 칠하고 끝내지 않고 **무엇을 하면 열리는지**까지 말한다.

    MC-AURA-ALLOCATION     PARTIAL → IMPLEMENTED  **(판정은 Master 가 확인한다)**
        C-COMBAT-001 이 스스로 남긴 결손은 "배분이 값만 바꾸고 무엇을 할 수 있는가의
        목록을 바꾸지 않는다" 였다. 그것이 닫혔다 — WORLD SCENARIO ①②④ 가 배분 하나로
        기술 하나가 여닫히는 것을 실측한다.

        **남는 것 하나를 정직하게 적는다.** 노드의 detail 은 예를 둘 들었다 —
        "인지를 일정 이상 몰아야만 숨은 존재가 보이고, 능력을 일정 이상 몰아야만
        계약의 두 번째 조건을 쓸 수 있는 식" (UL §15). 이 Cycle 이 세운 것은 **능력 축**
        하나이고, 인지 축이 관문이 되는 일은 하지 않았다 (C016 의
        INTENT-INSIGHT-NOT-A-GATE-001 을 말없이 뒤집지 않기 위해서다 — 02 의 "열지 않는다").

        semantic("그 선택이 … 지금 무엇을 할 수 있는가 자체를 가른다")으로 읽으면
        IMPLEMENTED 이고, detail 의 예 둘을 요구로 읽으면 아직 PARTIAL 이다.
        **어느 쪽으로 읽을지는 Master 가 정한다** (Q66 과 같은 종류의 물음이다).

### Possibility 전진

    MP-BIND-BY-CONTRACT        요구 넷 중 MC-ABILITY-CONDITION 이 섰다.
                               남은 셋 — MC-VOW · MC-BIND · MC-MARK
    MP-KNOW-THE-OPPONENT-RULE  요구 넷 중 MC-ABILITY-CONDITION 이 섰고
                               MC-AURA-ALLOCATION 도 함께 (위 판정에 달렸다).
                               남은 둘 — MC-OBSERVE-ABILITY · MC-DISRUPT-ABILITY

    **둘 다 닫히지 않는다.** 이 Cycle 은 사슬 B 의 바닥을 놓은 것이며, 후보 자신이
    그렇게 적었다 (frontier/combat.md 의 추천 순서).

    다음 후보 `FR-WHAT-YOU-LEAVE-ON-THEM` 의 의존이 이것으로 풀린다 —
    "표식을 읽을 관문이 먼저다" 가 섰다.

### Constraint Evaluation

    DC-COMBAT-PLAYER-CAUSALITY            SATISFIED
        가능 여부에도 강화에도 난수가 없다. `RULE-ABILITY-REQUIREMENT-001` 은 사정을
        **선언된 차례대로** 물으므로 둘이 함께 거짓이어도 사유가 언제나 같다.
        explainable_result 도 섰다 — 76 이라는 값에서 계수 1.7 → 참인 사정 하나로
        되짚어 올라간다 (WORLD SCENARIO ③).

    DC-COMBAT-UNAVAILABLE-HAS-A-REASON    SATISFIED
        **이 Cycle 이 그 제약의 실물이다.** 지금까지 거절 사유 넷은 전부 자기 몸의
        사정이었고(쓰러짐·막는 중·행동 중·기력), 이제 세계의 사실을 가리키는 사유가
        선다. 그리고 그 사유는 회색으로 칠하고 끝내지 않는다 —
        "배분을 발현으로 옮겨라" 까지 말한다 (rationale 이 ❌ 로 든 형태의 반대다).

    DC-CONDITION-OPENS-WITHOUT-RECORDING  SATISFIED
        새 World State 0. 사정이 연 것을 적지 않으므로 닫는 규칙이 없고,
        WORLD SCENARIO ④ 가 그것을 실측한다. `struck-by-them` 이 지나간 일을 보지만
        그 일은 세계가 **이미 지니고 스스로 사라지는** 것이다 (Q61(a) 의 경계 안).

    DC-COMBAT-ABILITY-IS-A-RULE           SATISFIED
        UL §16 의 아홉 칸 중 둘이 섰다 — Requirement · Condition. 능력이 처음으로
        "언제나 쓸 수 있는 버튼" 이 아니게 되었다.

    DC-COMBAT-ONE-FORMULA                 SATISFIED
        `RULE-DAMAGE-CALCULATE-001` 이 한 글자도 바뀌지 않았다. 조건이 움직이는 것은
        위력 정의의 계수 하나이며, 그것은 그 식의 **입력**이다
        (extensions_modify_inputs_or_outputs).

    DC-COMBAT-ONE-LAYER-AT-A-TIME         SATISFIED
        기존 셋의 값이 한 톨도 달라지지 않았고(REGRESSION), 그 근거가 검사가 아니라
        산술이다. 사정을 지지 않는 세계는 이 층 이전과 같다.

    DC-WORLD-OWNS-THE-SURFACE-LIST        SATISFIED — 그리고 **한 번 어겼다가 고쳤다**
        사정 목록도 그것을 읽는 관문도 세계가 소유하고, 화면은 요구·조건을 옮기기만
        한다. 다만 `isSkillKind` 가 세 이름을 코드에 적어 두고 있어 새 기술이
        **시작은 되는데 칼끝을 만들지 않았다** — 목록에 묻는 것으로 고쳤다
        (06 NOTES ①). 아래 Constraint Candidate 가 그 관찰이다.

### Constraint Candidate

    ① CC-THE-LIST-IS-THE-JUDGE-TOO — 목록이 판정에도 걸린다   **관찰 둘째**
        `DC-WORLD-OWNS-THE-SURFACE-LIST` 는 지금 **World → View 경계**의 규율로 적혀
        있다 ("관찰자가 목록을 자기 코드에 적지 않는다"). 이번에 어긴 것은 화면이
        아니라 **세계 자신**이었다 — `isSkillKind` 가 목록에 묻지 않고 세 이름을
        적어 두었고, 그래서 새 항목이 조용히 반쪽만 살아났다.

        같은 종류의 자리를 이 세계는 이미 여럿 지닌다 —
        `HOSTILITY_REASONS`(C018) · `ALLOCATION_CATALOG`(C-COMBAT-001) ·
        `GROUND_LAWS`(C-TERRAIN-001) · 그리고 이번의 `ABILITY_CIRCUMSTANCES`.
        전부 "목록을 늘려도 규칙이 열리지 않는다" 를 노리고 세워졌다.

        승격할 것인가, 기존 DC 의 scope 를 넓힐 것인가(지금 GLOBAL 이지만 rationale 이
        View 쪽만 말한다)는 **Human 이 정한다**. 관찰은 둘째다 (C018 이 첫째).

    ② CC-THE-RULE-DOES-NOT-ASK-WHO-DRIVES — **여섯째 반복**
        `RULE-ABILITY-REQUIREMENT-001` 의 Input 에 누가 조종하는 몸인지가 없고,
        시험이 자율 존재의 몸으로 같은 관문을 같은 사유로 지나는 것을 확인한다.
        후보 파일이 다섯 Cycle 을 세어 두었으므로 이것이 여섯째다.

### Master Gap

    ① 자율 존재는 이 기술에 닿지 못한다 — **결손이 아니라 미개방이다**
        `RULE-NPC-DECIDE-001` 은 기력만 보고 기술을 고르고 `RULE-NPC-ALLOCATION-001` 은
        생명만 보고 배분을 고른다. 그래서 자율 존재의 배분은 능력 축에 몰리는 일이
        없고, 이 기술은 그들에게 언제나 닫혀 있다.

        관문은 조종 주체를 묻지 않으므로 **규칙에는 구멍이 없다** (시험이 지킨다).
        비어 있는 것은 판단이며, 그 설계는 아직 승인되지 않은 문서의 몫이다
        (`Design-Creature-Behavior-R0` — Master 의 HUMAN 대기).

        상위 의미와 어긋나지 않는다. 다만 **`FR-KNOW-WHAT-THEY-CAN-DO` 가 이것을
        전제로 삼는다** — "자율 존재가 규칙 있는 능력을 하나 지닌다" 는 그 후보의 첫
        요구인데, 지금 세계에서 자율 존재는 사정을 지는 능력을 **가질 수는 있으나
        쓰지 않는다.** 그 후보를 열기 전에 습성 문서가 서야 한다는 뜻이며,
        frontier/combat.md 의 "지금 열 수 없는 것" 에 이 사유를 적을 자리다.

    ② 상대를 읽는 사정을 요구로 걸 수 없다 — **다음 후보가 부딪힌다**
        관문은 쓰기 전에 서므로 대상이 없다. 그래서 `struck-by-them` 같은 사정을
        `requires` 에 걸면 그 기술은 결코 나가지 않는다. 지금은 세계의 규율로 막는다
        (06 NOTES ④).

        **다음 후보 `FR-WHAT-YOU-LEAVE-ON-THEM` 이 정확히 이것을 요구한다** — UL §18 이
        든 요구의 예에 "Target 에 Mark 존재" 가 있다. 그 Cycle 은 관문이 고른 대상을
        받도록 넓히는 일부터 해야 하며, 그것은 이 층의 결손이 아니라 그 층의 첫 일이다.

    ③ 기술을 부를 손가락 자리가 좁아진다 — **공정 쪽 관찰**
        새 기술 하나에 키 하나가 든다. 기반이 이미 W·A·S·D·화살표·Z·X·R·T·C·V·`/` 를
        가져갔고 팩이 E·F·G·H·Q·Y·B·N·M·I·U·J·K·L·Shift 를 쓴다. **남은 글자가
        O·P 둘뿐**이었고 이 Cycle 이 O 를 썼다.

        사슬 B 에 남은 후보 넷이 각자 기술을 세울 것이므로 **다음 Cycle 에서 자리가
        떨어진다.** 이것은 세계의 문제가 아니라 조작 표면의 문제이며, 기술 띠가
        이미 눌러서 부를 수 있으므로(C025) 막힘은 아니다. VIEW/ENGINE 레인이 받을
        일로 적는다 — 예를 들어 기술 칸을 숫자로 부르는 길.

### VIEW 레인으로 넘기는 것

    경위에 조건을 펼쳐 읽히게 하는 일 (`works/BACKLOG.md`)
        `strikes[].breakdown.conditions` 는 계약으로 오고 있으나 떠오르는 타격 결과
        표시에는 아직 싣지 않았다. 그 한 줄은 이미 방식·관통·치명·막기·배분·성장을
        지고 있어, 사정까지 밀어 넣으면 C025 가 띠에서 겪은 실패를 되풀이한다.
        **세계를 건드리지 않으므로 V-작업이다** (07 NOTES ③).

## FAILURES

    없음 — 6종 전부 통과. Playable 은 관측 결과로 Human 이 확인했고, 손으로 눌러 보는
    길이 이 환경에서 막힌 사유는 판정 실패가 아니라 환경의 한계다 (PLAYABLE 절 · 07 NOTES ④).

## STATUS

    COMPLETE
