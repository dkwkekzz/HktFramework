# Frontier — GROWTH 트랙

## 후보

### FR-WHAT-YOU-DID-MAKES-YOU — 한 일이 몸을 키운다
    이것이 무엇인가      세계 안에서 한 일이 몸에 쌓이고, 쌓인 것이 몸의 기본값을 키운다.
                         지금 그 값을 바꾸는 유일한 길은 세계 **밖**의 명령이다
    세계에 생기는 것      ① 몸이 "지금까지 한 일" 을 값으로 지닌다
                         ② 세계 안의 행위(치고 · 맞고 · 캐고 · 살펴보는 것)가 그 값을 키운다 —
                            세계 밖 명령이 아니라
                         ③ 그 값이 문턱을 넘으면 기본값 여덟 중 정해진 것이 오른다
                         ④ 관찰: 무엇이 얼마나 쌓였고 다음 문턱이 어디이며, 방금 무엇 때문에
                            올랐는지가 사유와 함께 실린다
    이 기능이 아닌 것     형태(Class)가 아니다 · 숙련이 아니다 — 무엇을 했든 같은 것이 오른다
                         (갈래를 나누는 것은 FR-THE-BODY-REMEMBERS-ITS-WAY) ·
                         스킬이 자라는 것이 아니다 (FR-THE-SKILL-LEARNS-A-NEW-MOVE) ·
                         **땅의 문턱이 아니다** — 어디에 갈 수 있는가를 이 값으로 정하지
                         않는다 (HISTORY Q53(a)) · 걸어 둔 것이 얹는 유효 값이 아니다 —
                         이 후보가 키우는 것은 기본값이다 · 경험치 표시 화면이 아니다
    이미 있는 것         **코드 대조.** 키울 자리가 이미 갈라져 있다 — 기본값 여덟과
                         걸린 것을 반영해 다시 세는 유효 값 (C023 ·
                         `world/semantic/combat.ts#effectiveStat`) · 몸이 **겨루지 않는 값**을
                         지니는 선례 — `insight` 0~100 (C016 · 어떤 계산에도 들어가지 않고
                         관문 하나만 연다) · 겪은 것이 세계에 남는 장부의 선례 —
                         `world/semantic/acquaintance.ts` (C014 · 관찰자별 · Id 만 담는다) ·
                         값을 밖에서 바꾸는 유일한 경로 — `RULE-ATTRIBUTE-SET-001` ·
                         `MUTABLE_ATTRIBUTES` (이 후보가 대신하려는 바로 그것) ·
                         세계에서 일어난 일이 사건으로 남고 사라지는 형태 —
                         `world/simulation/strike-event-expire.ts`
    Playable Result      Player 가 자율 존재를 쓰러뜨리고 광맥을 캐면 몸에 쌓이는 것이 보이고,
                         문턱을 넘으면 물리 공격이 올라 **같은 상대에게 같은 기술로 더 큰
                         피해**가 들어간다 — 디버그 명령 없이 처음으로
    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-OUTGROW-THE-OPPONENT (전투 밖에서 기른 값으로 정면 교환을 이긴다)
    Missing / Partial    MC-GAIN-LEVEL (MISSING · `grounded: true`) — 그 갈래의 `overlay_note`
                         가 "자라는 축이 없다" 고 적어 두던 자리이며, GS §19 가 그 축을 명명했다
    Active Constraints   DC-WORLD-PROGRESSION-IS-REACH · DC-GROWTH-GOAL-FIRST ·
                         DC-COMBAT-PLAYER-CAUSALITY · DC-WORLD-OWNS-THE-SURFACE-LIST
    Constraint Eval      PROGRESSION-IS-REACH: SATISFIED — 레벨은 기본값을 키우는 바닥 축이고
                         어디에 갈 수 있는가는 여전히 감당 여부가 정한다 (HISTORY Q53(a))
                         GOAL-FIRST: SATISFIED — 오르는 것 자체가 Goal 이 아니라 그 갈래의 조건이다
                         PLAYER-CAUSALITY: SATISFIED — 오른 원인이 관찰 가능한 행위이고 난수가 없다
                         OWNS-THE-SURFACE-LIST: UNRESOLVED — 무엇을 관찰에 싣는지는 04 가 정한다
    Observable Result    쌓인 양 · 다음 문턱 · 오른 값과 그 사유가 화면에서 읽힌다
    Why one Cycle        키울 자리(기본값)와 그 값이 결과를 바꾸는 규칙이 이미 서 있다.
                         새로 서는 것은 **그 값을 세계 안의 행위로 키우는 축** 하나다
    Status               SELECTED

### FR-THE-SKILL-LEARNS-A-NEW-MOVE — 쓰던 기술이 새 수를 배운다
    이것이 무엇인가      기술이 쓰인 이력을 지니고, 쌓이면 그 기술이 이전에는 할 수 없던 것을
                         할 수 있게 된다
    세계에 생기는 것      ① 기술의 값이 **몸마다 달라질 수 있다** — 지금은 종류가 정한 고정값이다
                         ② 쓴 이력이 그 몸의 그 기술에 쌓인다
                         ③ 쌓이면 값뿐 아니라 **할 수 있는 행동**이 하나 늘어난다 —
                            이전에는 성립하지 않던 조건에서 성립한다
                         ④ 관찰: 그 기술이 지금 무엇을 할 수 있고 무엇을 아직 못 하는가
    이 기능이 아닌 것     새 기술을 하나 더 주는 것이 아니다 — 쓰던 것이 넓어진다 ·
                         스킬 트리가 아니다 · 수치만 오르는 강화가 아니다
                         (DC-GROWTH-SKILL-GAINS-BEHAVIOR 가 그것을 금지한다) ·
                         **새 실행 형태를 여는 것이 아니다** — MS-SKILL-FORM 의 빈 다섯 칸은
                         Q35 의 몫이다 · 걸어 둔 것이 얹는 것이 아니다 · 조합을 고르는
                         스킬 편집이 아니다
    이미 있는 것         **코드 대조.** 기술이 자기 값을 지니는 것이 이미 섰다 —
                         `SkillDefinition` 의 구간(C019 `swingBegin`·`swingEnd`)과
                         모양(C025 `swingArc`·`swingReach`·`swingTipRadius`).
                         **없는 것은 그 값이 몸마다 다른 것**이다 ·
                         정의를 그때그때 다시 세는 형태의 선례 — 유효 값 재계산
                         (C023 · 가감이 아니라 재계산) · 구간과 모양이 이미 관찰에 실린다
                         (C019 · C025) · 행동 진행도와 그 판정 (`world/simulation/action-progress.ts`)
    Playable Result      Player 가 같은 기본 기술을 계속 쓰다 보면 그 기술이 이전에는 닿지 않던
                         자리까지 닿게 되고, **같은 버튼이 다른 일을 한다**
    Source Goal          MG-EXPLORE-BEIRA
    Source Possibility   MP-BECOME-A-HIGHER-FORM (몸 자체가 상위 형태가 되어 감당한다)
    Missing / Partial    MC-MASTER-A-SKILL (MISSING · `grounded: true`)
    Active Constraints   DC-GROWTH-SKILL-GAINS-BEHAVIOR · DC-SKILL-IS-COMBINATION-NOT-NAME ·
                         DC-COMBAT-ONE-FORMULA · DC-COMBAT-PLAYER-CAUSALITY
    Constraint Eval      SKILL-GAINS-BEHAVIOR: SATISFIED — 이 후보가 그 원칙을 세계에서 닫는다.
                         늘어나는 것이 값이 아니라 할 수 있는 행동이다
                         IS-COMBINATION-NOT-NAME: SATISFIED — 자라는 것은 이름이 아니라
                         조합의 값이다. 새 스킬 이름이 생기지 않는다
                         ONE-FORMULA: SATISFIED — 피해 공식은 그대로이고 입력만 달라진다
                         PLAYER-CAUSALITY: SATISFIED — 자란 원인이 실제로 쓴 이력이다
    Observable Result    같은 기술이 성장 전후로 다른 조건에서 성립하고, 그 차이가 화면에서 읽힌다
    Why one Cycle        기술이 자기 값을 지니는 것은 이미 두 축(시간 · 공간)에서 섰다.
                         새로 서는 것은 **그 값이 몸마다 달라지고 쓴 이력으로 자란다** 하나다
    의존                 없음. 다만 FR-WHAT-YOU-DID-MAKES-YOU 가 먼저 서면 "쌓인다" 의 형태를
                         그대로 재사용한다 — 순서를 뒤집어도 성립하지만 같은 것을 두 번 세운다
    Status               PROPOSED

### FR-THE-BODY-REMEMBERS-ITS-WAY — 몸이 자기 방식을 기억한다
    이것이 무엇인가      무엇을 하며 자랐는지가 몸에 **갈래별로** 남는다 — 같은 상대를 같은
                         횟수로 상대해도 어떻게 했는가에 따라 다른 것이 쌓인다
    세계에 생기는 것      ① 세계가 행위를 갈래로 구분해 센다 (버텨 냈다 · 정면으로 받았다 ·
                            깨뜨렸다 · 정확한 순간에 쳤다)
                         ② 갈래마다 따로 쌓인다 — 합쳐진 하나의 값이 아니다
                         ③ 갈래마다 열리는 것이 다르다
                         ④ 관찰: 어떤 갈래가 얼마나 쌓였는가
    이 기능이 아닌 것     **형태(Class)를 세우는 것이 아니다** — CL-* 는 계열별 설계 문서의
                         주입 몫이다 · 레벨이 아니다 (그쪽은 무엇을 했든 같은 것이 오른다) ·
                         업적·도전과제가 아니다 — 보상을 주는 목록이 아니라 자라는 축이다 ·
                         스킬이 자라는 것이 아니다 · 숙련이 전투를 대신 이겨 주는 것이 아니다
    이미 있는 것         **코드 대조.** 세계가 이미 "무엇이 왜 그렇게 되었는가" 를 말한다 —
                         막기와 무너짐(C011) · 관통 반영값(C013) · 행동의 구간(C019) ·
                         휘두름의 모양(C025)이 전부 사유와 함께 판정되고 관찰에 실린다.
                         갈래로 셀 재료가 이미 세계에 있다 ·
                         겪은 것이 장부로 남는 선례 — `acquaintance.ts` (C014) ·
                         몸이 지닌 비전투 값 — `insight` (C016)
    Playable Result      정면으로 받아내며 이긴 Player 와 피하며 이긴 Player 의 몸에 서로 다른
                         것이 쌓이고, 그 둘이 각각 다른 것을 연다 — **같은 사냥터가 두
                         플레이어를 다르게 키운다**
    Source Goal          MG-EXPLORE-BEIRA
    Source Possibility   MP-BECOME-A-HIGHER-FORM
    Missing / Partial    MC-GROW-CLASS-MASTERY (MISSING · `grounded: true`)
    Active Constraints   DC-GROWTH-MASTERY-FROM-OWN-BEHAVIOR · DC-GROWTH-DIFFERENCE-IS-BEHAVIOR ·
                         DC-COMBAT-PLAYER-CAUSALITY · DC-WORLD-OWNS-THE-SURFACE-LIST
    Constraint Eval      MASTERY-FROM-OWN-BEHAVIOR: UNRESOLVED — **절반만 닫는다.**
                         "반복량이 아니라 행동에서" 는 이 후보가 세우고, "형태마다 세는 행동이
                         다르다" 는 CL-* 가 설 때 닫힌다. 이 Cycle 에서 다 닫으려 하지 않는다
                         DIFFERENCE-IS-BEHAVIOR: UNRESOLVED — 같은 이유다. 몸이 한 종류라
                         캐릭터 **사이**의 차이는 아직 잴 수 없고, 이 후보가 세우는 것은
                         같은 몸의 서로 다른 이력이다
                         PLAYER-CAUSALITY: SATISFIED — 쌓인 원인이 관찰 가능한 행위다
                         OWNS-THE-SURFACE-LIST: UNRESOLVED — 04 가 정한다
    Observable Result    두 플레이어가 같은 상대를 각자 다른 방식으로 넘고, 몸에 쌓인 것이
                         서로 다르게 읽힌다
    Why one Cycle        셀 재료(사유가 붙은 판정)와 장부의 형태가 이미 서 있다.
                         새로 서는 것은 **갈래로 나누어 쌓는 것** 하나다
    의존                 없음 — 형태(Class)를 요구하지 않는다. 다만 형태가 서기 전에는 위
                         두 판정이 UNRESOLVED 로 남는다
    Status               PROPOSED

## 추천 순서

    1. FR-WHAT-YOU-DID-MAKES-YOU        바닥이다. overlay 의 둘째 구멍("성장이 세계 밖에
                                        있다")을 실제로 닫는 유일한 후보이며, 그 갈래
                                        (MP-OUTGROW-THE-OPPONENT)가 결손의 이름으로 이것을
                                        직접 가리킨다
    2. FR-THE-SKILL-LEARNS-A-NEW-MOVE   승인된 원칙 하나(SKILL-GAINS-BEHAVIOR)를 세계에서
                                        닫는다. 값이 싸다 — 기술이 자기 값을 지니는 것이
                                        이미 두 축에서 섰다
    3. FR-THE-BODY-REMEMBERS-ITS-WAY    셋 중 유일하게 판정을 절반만 닫는다 (형태가 없다).
                                        형태가 선 뒤에 하면 온전해지지만, 그 전에 해도
                                        축 자체는 성립한다

    Agent 추천은 **1** 이다. 근거는 취향이 아니라 판정이다 — 성장 축 다섯 중 넷이 MISSING
    이고 그중 셋이 이것 위에 쌓이며(숙련 · 스킬 숙련 · 탐험 숙련 모두 "쌓인다" 를 전제한다),
    세계에서 값을 바꾸는 유일한 길이 아직 디버그 명령이다. 순서는 Human 이 정한다.

## SELECTED

```text
FR-WHAT-YOU-DID-MAKES-YOU — 한 일이 몸을 키운다
Cycle ID   C-GROWTH-001         트랙의 첫 번호 (cycles/ 에 C-GROWTH-* 가 아직 없다)
다음       advprotoh-cycle 스킬 Stage 1 — 아직 시작하지 않았다
```

    **정한 사람** — Human 이 이 선택을 Agent 에게 위임했다 (2026-08-26 · "후보 선택은
    알아서 정하고"). 선택은 원래 Human 소유이므로(CLAUDE.md 원칙 19) 위임의 사실과 고른
    근거를 HISTORY.md 에 남겼다. 근거는 위 "추천 순서" 절과 같다 — 성장 축 다섯 중 넷이
    MISSING 이고 그중 셋이 이것 위에 쌓이며, 세계에서 값을 바꾸는 유일한 길이 아직
    디버그 명령이다.

    **Cycle 이 받아 갈 것** — `01-cycle.md` 의 `MASTER TRACE` 로 그대로 옮긴다.

        Frontier             FR-WHAT-YOU-DID-MAKES-YOU
        Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
        Source Possibility   MP-OUTGROW-THE-OPPONENT
        Target Capability    MC-GAIN-LEVEL (MISSING · `grounded: true`)
        Active Constraints   DC-WORLD-PROGRESSION-IS-REACH · DC-GROWTH-GOAL-FIRST ·
                             DC-COMBAT-PLAYER-CAUSALITY · DC-WORLD-OWNS-THE-SURFACE-LIST
        Constraint Note      PROGRESSION-IS-REACH 가 이 Cycle 의 경계다 — 레벨은 기본값을
                             키우는 바닥 축이고 **어디에 갈 수 있는가를 이 값으로 정하지
                             않는다** (HISTORY Q53(a)). 문턱·관문에 이 값을 걸지 않는다.
                             OWNS-THE-SURFACE-LIST 는 UNRESOLVED 로 넘어간다 — 무엇을
                             관찰에 싣는지는 04 가 정한다.
                             **승인되면 하나가 더 걸린다** — 이 성장은 모든 상황에 적용되는
                             범용 축이므로 DC-GROWTH-POWER-PAYS-IN-REACH-OR-CONSTRAINT 가
                             "한 단계의 폭은 작아야 한다" 를 03 의 수치 결정에 건다
                             (GB §20 · 승인 대기 Q56)

## 지금 열 수 없는 것

| 기능 / 층 | 무엇이 막고 있는가 |
|---|---|
| 원리로 환경 문제를 푼 것이 쌓인다 (MC-GROW-EXPLORATION-MASTERY) | 풀 환경 문제가 없다 — 땅이 없다. TERRAIN 트랙의 `C-TERRAIN-001`(땅이 법칙을 지닌다)이 그 바닥을 세운다 |
| 형태가 상위 형태가 된다 (MC-CHANGE-CLASS) | 넘어갈 형태가 없다 — `CL-*` 가 0 이다. 이름의 소유는 정해졌고 (HISTORY Q55(b) — GS 가 소유한다) 남은 것은 **계열별 설계 문서의 주입**이다 |
| 자기 원리와 관련된 세계 현상을 겪는다 (MK-WITNESSED-WORLD-PHENOMENON) | 드물게 일어나는 세계 현상이 세계에 없다 — 그것은 땅 위에서 생긴다 (TERRAIN 트랙) |
| Class Catalyst — 형태를 유지하는 세계의 Property | GS 는 "세계의 Property" 라고만 적고 어느 자원인지 명명하지 않는다. 자원 카탈로그 문서의 승인·주입이 그 자리를 받는다 (HISTORY Q50(a)) |
| 요정 계열 여덟의 고유 능력 (MS-FAIRY-LINEAGE 여덟 자리) | 계열별 설계 문서의 주입이 먼저다. 그리고 **Q54 가 열려 있다** — 요정이 플레이어 캐릭터인가에 따라 그 능력들이 누구의 것인지가 갈린다 |
