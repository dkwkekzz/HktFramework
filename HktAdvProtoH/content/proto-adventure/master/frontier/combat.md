# Frontier — COMBAT 트랙

전투(R1 · DT · UL) · 스킬(SK) 도메인의 후보와 지금 도는 것을 담는다. 트랙 규칙과 트랙 간
판단은 [README.md](README.md), 읽는 법은 guides/master-frontier.md 소유다.

    기준 Overlay   master/overlay.md — 전투 사다리는 Critical 층까지, 그 위에 고른
                   대상(C017) · 태도(C018) · 행동 안의 시점(C019) · 휘두름의 모양(C025)이
                   얹혔다. 스킬(SK) · 전투 상층(UL) 주입 반영

## 한눈에 보기

넷이다. 앞의 셋은 **공격을 받는 순간**을 여는 사슬이고 (하나가 다음을 떠받친다),
넷째는 **힘을 어디에 두는가**로 그 셋과 독립이다.

    FR-THE-BLOW-CAN-BE-ANSWERED     닿는 순간에 대답할 수 있다        →  다음 둘의 바닥
    FR-WHEN-YOU-ANSWER-DECIDES      언제 대답했는가가 결과를 가른다    ↑ 위 하나를 요구
    FR-A-GOOD-ANSWER-OPENS-A-DOOR   잘 된 대답이 다음 수를 연다        ↑ 위 둘을 요구
    FR-WHERE-YOUR-POWER-SITS        지금 힘이 어디에 몰려 있는가       ·  앞 셋과 무관

## 후보

### FR-THE-BLOW-CAN-BE-ANSWERED — 닿는 순간에 대답할 수 있다

    이것이 무엇인가      공격이 닿기 전의 짧은 구간에, 받는 쪽이 자기 몸에 끼워 둔
                         대답 하나를 실행할 수 있다. 무슨 일이 일어나는지는 그 자리에
                         무엇이 들어 있는가가 정한다

    세계에 생기는 것      ① 몸마다 대답 자리가 하나 있고, 지금 무엇이 들어 있는지가 상태다
                         ② 다가오는 타격마다 대답할 수 있는 구간이 열리고 닫힌다
                         ③ 그 구간 안에 실행한 대답이 그 타격의 결과를 바꾼다
                         ④ 대답하지 않으면 기존 피해 계산이 그대로 지난다 — 예외가 아니라 정상이다
                         ⑤ 관찰: 지금 대답할 수 있는가 · 자리에 무엇이 있는가 · 안 되면 왜 안 되는가

    이 기능이 아닌 것     정밀 구간이 아니다 — 언제 눌렀는가로 결과가 갈리는 것은 다음 후보다.
                         여기서는 구간 안이면 전부 같은 결과다
                         기회가 아니다 — 대답이 다음 수를 열지 않는다
                         입력을 늘리는 것이 아니다 — 자리가 하나이고 버튼도 하나다
                         무적 구간이 아니고 확률 회피도 아니다
                         대답의 **종류를 여럿 만드는 것**이 아니다 — 자리 하나와 그 자리에
                         들어갈 한 종류로 닫는다. 종류를 늘리는 것은 이 개념이 아니다

    이미 있는 것          기술이 세 구간을 갖고 그 경계를 기술 자신이 지닌다 —
                         `world/semantic/combat.ts` 의 `SkillPhase`(startup · active · recovery)와
                         `swingBegin`. **언제 닿는가가 이미 세계에 있다** (C019 · C025)
                         막기가 행동과 나란한 몸의 상태로 있고 정면 판정이 방향을 가른다 —
                         `world/semantic/actor.ts` 의 `guarding` · `guardBrokenUntil` (C011)
                         못 쓰는 사유를 세계가 골라 하나 내보내는 자리 —
                         `view/skill-presentation.ts` 의 `unavailableReason`
                         계산 경위를 통째로 관찰에 싣는 자리 (MC-COMBAT-CAUSE-READING)

    Playable Result      Player 가 적의 타격이 닿기 직전 구간에 대답을 실행해 그 타격의
                         결과를 바꿀 수 있고, 대답하지 않으면 지금까지와 똑같이 맞는다

    Source Goal          MG-SURVIVE-ENEMY-OFFENSIVE
    Source Possibility   MP-READ-AND-COUNTER · MP-EVADE-BY-MOVING-THE-BODY · MP-STORE-AND-RELEASE
    Missing / Partial    MC-ACTIVE-RESPONSE (MISSING)
    Active Constraints   DC-COMBAT-ONE-RESPONSE-INPUT(DRAFT) ·
                         DC-COMBAT-RESPONSE-IS-OPTIONAL-MASTERY(DRAFT) ·
                         DC-COMBAT-SHARED-BUDGET · DC-COMBAT-ONE-LAYER-AT-A-TIME ·
                         DC-COMBAT-PLAYER-CAUSALITY · DC-WORLD-OWNS-THE-SURFACE-LIST
    Constraint Eval      SATISFIED — 자리가 하나라 입력이 늘지 않고(ONE-RESPONSE-INPUT),
                         무대답이 정상 경로로 남으며(OPTIONAL-MASTERY), 전용 게이지 없이
                         기존 기력을 쓰고(SHARED-BUDGET), 확률이 개입하지 않는다(PLAYER-CAUSALITY).
                         아래 층(막기 · 피해 공식)은 이것 없이도 그대로 동작한다(ONE-LAYER)
    Observable Result    타격마다 "지금 대답할 수 있다" 가 보이고, 대답한 타격과 대답하지 않은
                         타격의 계산 경위가 다르게 실린다
    Why one Cycle        새 상태가 둘뿐이다 — 자리에 무엇이 있는가 · 지금 대답 구간인가.
                         두 번째는 이미 있는 `SkillPhase` 에서 계산되므로 저장하지 않는다
    Status               PROPOSED

### FR-WHEN-YOU-ANSWER-DECIDES — 언제 대답했는가가 결과를 가른다

    이것이 무엇인가      같은 대답이라도 언제 했는가로 결과가 갈린다. 대답하지 않음 ·
                         구간 안에서 함 · 좁은 구간에 맞춤 세 단계이고, 맞췄을 때만
                         그 대답의 강한 쪽 결과가 나온다

    세계에 생기는 것      ① 대답 구간 안에 더 좁은 구간이 있다
                         ② 같은 대답이 어느 단계였는가에 따라 다른 결과를 낸다
                         ③ 막기의 좁은 구간 결과가 "완벽한 막기" 다 — 피해 없음 + 때린 쪽의 노출
                         ④ 관찰: 방금 그 대답이 어느 단계였는지가 결과에 실린다

    이 기능이 아닌 것     완벽한 막기를 **별개 행동으로 만드는 것**이 아니다 — 버튼도 자리도
                         늘지 않고, 같은 대답의 결과가 갈릴 뿐이다
                         기회가 아니다 — 노출이 생기되 그것으로 내 행동이 바뀌지는 않는다
                         확률 판정이 아니다 — 시각 관계다
                         대답의 종류를 늘리는 것이 아니다

    이미 있는 것          앞 후보가 세운 대답 자리와 대답 구간. 그리고 구간의 경계를 기술이
                         지니는 얼개 (`world/semantic/combat.ts` 의 `swingBegin` — 좁은 구간도
                         전역 상수가 아니라 기술의 값이 되어야 한다는 선례가 이미 있다, C019 · C025)

    Playable Result      Player 가 타격이 닿는 순간에 정확히 맞춰 막으면 피해를 전혀 받지
                         않고 때린 쪽이 잠시 노출되며, 어긋나게 막으면 지금처럼 절반만 줄어든다

    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT · MG-SURVIVE-ENEMY-OFFENSIVE
    Source Possibility   MP-READ-AND-COUNTER
    Missing / Partial    MC-PRECISION-RESPONSE (MISSING) · MC-PERFECT-GUARD (MISSING)
    Active Constraints   DC-COMBAT-PLAYER-CAUSALITY · DC-COMBAT-RESPONSE-IS-OPTIONAL-MASTERY(DRAFT) ·
                         DC-COMBAT-ONE-RESPONSE-INPUT(DRAFT) · DC-COMBAT-ONE-FORMULA
    Constraint Eval      SATISFIED — 시각 관계로 갈리고(PLAYER-CAUSALITY), 못 맞춰도 기존
                         막기가 그대로 성립하며(OPTIONAL-MASTERY), 입력이 늘지 않고,
                         피해는 여전히 하나의 공식을 지난다(ONE-FORMULA — 결과값을 0 으로
                         만드는 것도 그 공식의 결과에 거는 것이다)
    Observable Result    같은 막기가 두 결과로 갈리고, 어느 단계였는지가 계산 경위에 실린다
    Why one Cycle        새 상태가 없다 — 좁은 구간은 기술의 값이고, 판정은 이미 저장된
                         대답 시각과 타격 시각의 비교다
    Depends on           FR-THE-BLOW-CAN-BE-ANSWERED — 대답 자리가 없으면 "언제 대답했는가"
                         가 성립하지 않는다
    Status               PROPOSED

### FR-A-GOOD-ANSWER-OPENS-A-DOOR — 잘 된 대답이 다음 수를 연다

    이것이 무엇인가      좋은 대답이 짧은 기회를 남기고, 그 기회를 가진 동안 이미 있는
                         행동 하나가 다른 것으로 바뀐다

    세계에 생기는 것      ① 좁은 구간에 맞춘 대답이 기회를 남긴다
                         ② 기회를 가진 동안 특정 행동이 다른 행동으로 **바뀐다**
                         ③ 기회는 짧고, 시각에서 계산되어 저절로 닫힌다
                         ④ 관찰: 지금 어떤 기회를 가졌는가 · 언제까지인가 · 그래서 이 자리가
                            무엇이 되었는가

    이 기능이 아닌 것     되받아치기 버튼을 만드는 것이 아니다 — 기존 행동이 바뀔 뿐이다
                         기회를 상태로 적어 두고 지우는 것이 아니다 — 시각에서 매번 계산한다
                            (Q54(a) · `isGuardBroken` 과 같은 꼴)
                         쌓이는 자원이 아니다 — 모아 두었다 쓰지 않는다
                         상대에게 거는 것이 아니다 — 내가 얻는 것이다

    이미 있는 것          앞 두 후보가 세운 대답과 정밀 판정. 그리고 시각 하나에서 상태를
                         매번 다시 계산하는 선례 — `world/semantic/combat.ts` 의
                         `isGuardBroken` / `guardBrokenUntil` (C011)
                         같은 자리의 행동이 상황에 따라 달라지는 얼개는 **없다** — 이 후보가 세운다

    Playable Result      Player 가 정확히 막아 낸 직후 짧은 동안 기본 공격 자리가 되받아치기로
                         바뀌고, 그것으로 평소보다 큰 피해를 넣을 수 있다

    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-READ-AND-COUNTER — **이 후보로 그 갈래가 닫힌다**
    Missing / Partial    MC-OPPORTUNITY (MISSING) · MC-COUNTER (MISSING)
    Active Constraints   DC-COMBAT-ONE-RESPONSE-INPUT(DRAFT) · DC-CONDITION-OPENS-WITHOUT-RECORDING ·
                         DC-COMBAT-UNAVAILABLE-HAS-A-REASON(DRAFT) · DC-COMBAT-ONE-FORMULA
    Constraint Eval      SATISFIED — 입력이 늘지 않고, 기회를 기록하지 않고 시각에서
                         재계산하며(Q54(a)), 기회가 없어 평소 형태인 것도 사유로 읽히고,
                         바뀐 행동의 피해도 같은 공식을 지난다
    Observable Result    같은 자리의 행동 이름과 값이 기회 유무로 달라지고, 무엇이 그 기회를
                         만들었는지가 경위에 남는다
    Why one Cycle        새 상태가 하나다 — 마지막 정밀 대답의 시각. 기회 자체는 그 시각에서
                         계산되므로 저장되지 않는다
    Depends on           FR-WHEN-YOU-ANSWER-DECIDES — 기회를 낳는 것이 정밀 판정이다
    Status               PROPOSED

### FR-WHERE-YOUR-POWER-SITS — 지금 힘이 어디에 몰려 있는가

    이것이 무엇인가      몸이 지금 자기 힘을 몸 · 능력 · 인지 중 어디에 몰아 두었는지가
                         상태로 있고, 한쪽에 몰수록 나머지가 실제로 얇아진다.
                         전투 중에는 미리 정해진 배분 하나를 고르는 것으로만 바꾼다

    세계에 생기는 것      ① 몸마다 지금의 배분이 이름 붙은 상태로 있다
                         ② 그 배분이 판정이 읽는 **유효 값**에 들어간다 — 몸에 몰면 때리고
                            막는 값이 오르고 능력과 인지의 값이 내린다
                         ③ 전투 중 배분을 바꾸는 입력이 하나 있고, 바꾸는 데 대가가 있다
                         ④ 남의 배분도 관찰된다 — 상대가 어디에 몰아 두었는지가 보인다
                         ⑤ 자율 존재도 배분을 지니고 국면에 따라 바꾼다

    이 기능이 아닌 것     비율을 실시간으로 조절하는 것이 아니다 — 이름 붙은 배분을 고른다
                         능력의 가능 여부를 여닫는 것이 아니다 — 그것은 조건(F5)의 몫이고,
                         여기서는 값만 오르내린다
                         새 자원이 아니다 — 배분은 게이지가 아니라 상태다
                         버프가 아니다 — 걸고 푸는 것이 아니라 언제나 어느 하나다
                         능력치를 **키우는** 것이 아니다 — 같은 총량을 다르게 나눌 뿐이다

    이미 있는 것          **판정이 읽는 값을 매번 다시 세는 얼개가 이미 있다** —
                         `world/semantic/combat.ts` 의 `effectiveStat`(기본값 + 걸린 것들의
                         기여, 저장하지 않는다, C023 · RULE-EFFECTIVE-STATS-001). 배분은
                         그 합에 들어가는 항을 하나 더하는 일이지 새 축을 만드는 일이 아니다
                         세 축이 걸릴 값이 셋 다 이미 세계에 있다 —
                         몸: `physicalAttack` · `armor` (C010 · C012) /
                         능력: 스킬 값 배율 (MC-SKILL-SCALING) /
                         인지: `insight` — 살펴보지 않고도 아는 범위 (C016)
                         계산 경위를 통째로 싣는 자리 (MC-COMBAT-CAUSE-READING)

    Playable Result      Player 가 배분을 바꾸면 자기 방어와 아는 범위가 눈에 띄게 맞바뀌고,
                         상대가 어디에 몰아 두었는지를 보고 얇아진 쪽을 노려 때릴 수 있다

    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-EXPLOIT-OPEN-BODY — **이 후보로 그 갈래가 닫힌다**
                         (나머지 요구 셋이 전부 서 있다: MC-COMBAT-STRIKE IMPLEMENTED ·
                          MC-COMBAT-CAUSE-READING IMPLEMENTED · MK-OPPONENT-FLOW-PATTERN 은
                          "상대의 배분이 관찰된다" 가 곧 그 지식이다 — 위 ④⑤ 가 그것이다)
                         MP-CONCENTRATE-THE-POWER · MP-HOLD-FORTIFIED 도 전진한다
    Missing / Partial    MC-AURA-ALLOCATION (MISSING)
    Active Constraints   DC-COMBAT-AURA-IS-A-PROFILE-NOT-A-DIAL(DRAFT) · DC-COMBAT-ONE-FORMULA ·
                         DC-COMBAT-SHARED-BUDGET · DC-COMBAT-PLAYER-CAUSALITY ·
                         DC-COMBAT-ONE-LAYER-AT-A-TIME · DC-WORLD-OWNS-THE-SURFACE-LIST
    Constraint Eval      SATISFIED — 전투 중 입력이 배분 하나를 고르는 것뿐이고(PROFILE-NOT-A-DIAL),
                         새 공식 없이 기존 유효 값 계산에 항을 더하며(ONE-FORMULA),
                         새 게이지가 없고(SHARED-BUDGET), 결과가 관찰 가능한 상태에서
                         나온다(PLAYER-CAUSALITY). 대답(F1) 없이도 완전히 동작한다(ONE-LAYER)
    Observable Result    같은 상대에게 같은 기술을 넣어도 그 상대의 배분에 따라 피해가 달라지고,
                         경위에 어느 배분이 얼마를 기여했는지가 실린다
    Why one Cycle        새 상태가 하나다 — 지금의 배분. 그 효과는 `effectiveStat` 이
                         이미 매번 다시 세므로 저장되는 것이 늘지 않는다
    Depends on           없음 — 앞 셋과 독립이다
    Status               PROPOSED

## 추천 순서 (Agent 제안 — 확정은 Human)

    1. FR-WHERE-YOUR-POWER-SITS      갈래 하나가 이 Cycle 로 닫힌다
    2. FR-THE-BLOW-CAN-BE-ANSWERED   상층의 나머지 전부가 이것 위에 선다
    3. FR-WHEN-YOU-ANSWER-DECIDES
    4. FR-A-GOOD-ANSWER-OPENS-A-DOOR  여기서 MP-READ-AND-COUNTER 가 닫힌다

첫째를 먼저 두는 근거는 셋이다.

**갈래가 닫힌다.** MP-EXPLOIT-OPEN-BODY 의 요구 넷 중 셋이 이미 서 있어, 배분 하나가
서면 그 갈래가 통째로 닫힌다. 지금 열려 있는 갈래 중 한 Cycle 로 닫히는 것은 이것뿐이다.

**새로 만드는 것이 가장 적다.** 판정이 읽는 값을 매번 다시 세는 얼개(`effectiveStat`)가
C023 로 이미 서 있고, 세 축이 걸릴 값(`physicalAttack`·`armor` / 스킬 값 / `insight`)도
셋 다 세계에 있다. 배분은 그 합에 항을 하나 더하는 일이다.

**상층의 정체성이 한 번에 보인다.** "같은 몸이 국면마다 다른 몸이 된다" 는 UL 이
세우려는 것의 핵심이고 (§45), 그것을 가장 적은 코드로 보여 주는 것이 배분이다.

**다만 이것은 UL §42 의 번호 순서(F1 대답 → … → F4 배분)를 벗어난다.** 그 순서를
지킬 근거도 있다 — 문서가 정한 순서이고, 배분의 진짜 값어치(§15 — 배분이 무엇을 할 수
있는지 자체를 여닫는다)는 여닫을 능력이 서야 드러난다. 지금 세우면 배분은 당분간
"수치가 맞바뀐다" 까지만 한다. 그 손해를 감수할지가 이 선택의 실제 내용이다.
`DC-COMBAT-ONE-LAYER-AT-A-TIME` 은 순서를 강제하지 않는다 — 각 층이 아래 층 없이도
동작할 것만 요구하고, 배분은 그 조건을 만족한다.

둘째부터 넷째는 순서가 정해져 있다 — 하나가 다음의 바닥이다. 셋을 한 Cycle 에 넣지
않는 이유는 각각이 세우는 개념이 다르고(자리 · 시점 · 변형), 그것이 곧 쪼갤 자리이기
때문이다.

## SELECTED

```text
없음 — Human 선택 대기. 후보 넷이 서 있다
```

## 지금 열 수 없는 것

이유가 사라지면 후보로 올린다. 사유의 근거는 괄호의 자리가 소유한다.
트랙 밖(세계 기반 · 설계 문서 부재 등)의 결손은 [README.md](README.md) 의 같은 절에 있다.

| 기능 / 층 | 무엇이 막고 있는가 |
|---|---|
| **계약** (MC-VOW) · **묶음** (MC-BIND) · **표식** (MC-MARK) | 막는 것은 크기다. 그것을 요구하는 갈래(MP-BIND-BY-CONTRACT)가 MISSING 넷을 한꺼번에 요구해 한 Cycle 에 닫히지 않는다 — 조건(아래 줄)부터 쪼개야 후보가 선다 |
| **능력 조건** (MC-ABILITY-CONDITION) | 여닫을 것이 없다. 지금 세계에서 못 쓰는 사유는 전부 자기 조건(자원·거리·장착)이고, "상대가 나를 먼저 쳤는가" 같은 세계의 사실이 능력을 여닫는 자리가 없다. 그런 능력이 하나 서면 그때 조건이 후보가 된다 |
| **능력 관찰** (MC-OBSERVE-ABILITY) · **능력 봉인** (MC-DISRUPT-ABILITY) | 알아낼 대상이 없다 — 적대 존재가 규칙 있는 능력을 갖고 있지 않다. 상대 쪽에 상층이 먼저 서야 한다 |
| **저장과 방출** (MC-ABSORB) | 대답 자리(FR-THE-BLOW-CAN-BE-ANSWERED)와 정밀 판정이 먼저다. 그 둘이 서면 이 자리도 후보가 된다 |
| **자세 유지** (MC-FORTIFY) | `part_of.grounded: false` — UL 은 배분을 **유지하는 비용**을 말하지 않는다. R1 이 이름만 댄 부분이라 후보의 Target 이 되지 않는다 (guides/master-frontier.md MUST NOT) |
| **수호 · 대상 이전** (UL §9 · §27) | 세계에 아군이 없다. Q53(c) 로 **미루기로 정해졌다** — 아군을 세울 때 (b)(세계의 존재로 받는다)를 따른다 (HISTORY) |
| **스킬 실행 형태** (MS-SKILL-FORM 의 빈 다섯 칸) | 이제 하나가 막는다 — **그 형태를 요구하는 Possibility 가 없다** (Q35 의 7 조건 2 — OPTIONS 작업이 먼저다). 기획 공백은 SK 최종안이 메웠고 자리도 열넷에서 여섯으로 줄었다. 남은 실질 장벽 하나: 투사체·장판·설치는 세계에 **몸이 아닌 존재**가 먼저 서야 한다 |
| 위협도 · 진영 · 도발 | 막는 것은 없다 (HOSTILITY_REASONS 에 항목 추가로 시작) — 아직 어느 Possibility 도 요구하지 않는다 (7 조건 2) |

**후보로 올리지 않은 결손 하나**: 기력이 스스로 돌아오지 않는다 (MC-CP-ECONOMY PARTIAL).
어느 상위 갈래를 전진시키는지 근거 문서가 말하지 않아 7 조건 2 를 세울 수 없다 —
밸런스로 다룰지 규칙으로 세울지는 Human 판단이다. 다만 위 후보 넷 중 앞의 셋이
기력을 더 쓰게 만들므로, 그중 하나가 선택되면 이 결손이 먼저 아플 수 있다.
