# Frontier — GROWTH 트랙

## 후보

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
                         DC-COMBAT-ONE-FORMULA · DC-COMBAT-PLAYER-CAUSALITY ·
                         DC-GROWTH-POWER-PAYS-IN-REACH-OR-CONSTRAINT ·
                         DC-GROWTH-CAPABILITY-DECLARES-ITS-LIMITS
    Constraint Eval      SKILL-GAINS-BEHAVIOR: SATISFIED — 이 후보가 그 원칙을 세계에서 닫는다.
                         늘어나는 것이 값이 아니라 할 수 있는 행동이다
                         IS-COMBINATION-NOT-NAME: SATISFIED — 자라는 것은 이름이 아니라
                         조합의 값이다. 새 스킬 이름이 생기지 않는다
                         ONE-FORMULA: SATISFIED — 피해 공식은 그대로이고 입력만 달라진다
                         PLAYER-CAUSALITY: SATISFIED — 자란 원인이 실제로 쓴 이력이다
                         POWER-PAYS-IN-REACH-OR-CONSTRAINT: UNRESOLVED — 늘어난 행동이
                         넓어지는 만큼 조건이 붙는지는 그 Cycle 이 정한다 (GB §20)
                         CAPABILITY-DECLARES-ITS-LIMITS: UNRESOLVED — 자란 스킬이 무엇에
                         통하지 않는지를 growth/balance/ 의 Contract 가 함께 세운다
    Observable Result    같은 기술이 성장 전후로 다른 조건에서 성립하고, 그 차이가 화면에서 읽힌다
    Why one Cycle        기술이 자기 값을 지니는 것은 이미 두 축(시간 · 공간)에서 섰다.
                         새로 서는 것은 **그 값이 몸마다 달라지고 쓴 이력으로 자란다** 하나다
    의존                 없음. **"쌓인다" 의 형태는 이미 섰다** (C-GROWTH-001 — Actor.Deeds ·
                         World.DeedCatalog · 문턱 표 · GrowthEvents). 이 후보는 그 형태를
                         그대로 재사용하되 쌓이는 자리가 몸이 아니라 **몸의 그 기술**이다
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
                         DC-COMBAT-PLAYER-CAUSALITY · DC-WORLD-OWNS-THE-SURFACE-LIST ·
                         DC-GROWTH-CAPABILITY-DECLARES-ITS-LIMITS
    Constraint Eval      MASTERY-FROM-OWN-BEHAVIOR: UNRESOLVED — **절반만 닫는다.**
                         "반복량이 아니라 행동에서" 는 이 후보가 세우고, "형태마다 세는 행동이
                         다르다" 는 CL-* 가 설 때 닫힌다. 이 Cycle 에서 다 닫으려 하지 않는다
                         DIFFERENCE-IS-BEHAVIOR: UNRESOLVED — 같은 이유다. 몸이 한 종류라
                         캐릭터 **사이**의 차이는 아직 잴 수 없고, 이 후보가 세우는 것은
                         같은 몸의 서로 다른 이력이다
                         PLAYER-CAUSALITY: SATISFIED — 쌓인 원인이 관찰 가능한 행위다
                         OWNS-THE-SURFACE-LIST: UNRESOLVED — 04 가 정한다
                         CAPABILITY-DECLARES-ITS-LIMITS: UNRESOLVED — 갈래마다 무엇이
                         열리고 무엇이 열리지 않는지를 Contract 가 함께 세운다
    Observable Result    두 플레이어가 같은 상대를 각자 다른 방식으로 넘고, 몸에 쌓인 것이
                         서로 다르게 읽힌다
    Why one Cycle        셀 재료(사유가 붙은 판정)와 장부의 형태가 이미 서 있다.
                         새로 서는 것은 **갈래로 나누어 쌓는 것** 하나다
    의존                 없음 — 형태(Class)를 요구하지 않는다. 다만 형태가 서기 전에는 위
                         두 판정이 UNRESOLVED 로 남는다.
                         **"쌓인다" 의 형태는 이미 섰다** (C-GROWTH-001) — 이 후보가 새로
                         세우는 것은 그것을 **갈래로 나누는 일** 하나다
    Status               PROPOSED

## 추천 순서

    1. FR-THE-SKILL-LEARNS-A-NEW-MOVE   승인된 원칙 하나(DC-GROWTH-SKILL-GAINS-BEHAVIOR)를
                                        세계에서 닫는다. 값이 싸다 — 기술이 자기 값을 지니는
                                        것이 이미 두 축(시간 · 공간)에서 섰고, **쌓이는 형태도
                                        이제 섰다** (C-GROWTH-001). 새로 서는 것은 그 값이
                                        몸마다 달라지는 것 하나다
    2. FR-THE-BODY-REMEMBERS-ITS-WAY    셋 중 유일하게 판정을 절반만 닫는다 (형태가 없다).
                                        형태가 선 뒤에 하면 온전해지지만, 그 전에 해도
                                        축 자체는 성립한다

    Agent 추천은 **1** 이다. 근거는 취향이 아니라 판정이다 — 승인된 Constraint 하나를
    세계에서 닫는 유일한 후보이며, 바닥(C-GROWTH-001)이 선 지금 그 위에 얹히는 비용이
    가장 작다. 순서는 Human 이 정한다.

## SELECTED

```text
없음 — Human 선택 대기
```

    직전 선택(FR-WHAT-YOU-DID-MAKES-YOU)은 `C-GROWTH-001-what-you-did-makes-you` 로
    닫혔다. 반영 경위는 `feedback/C-GROWTH-001-what-you-did-makes-you.md` 가 소유한다.

## 지금 열 수 없는 것

| 기능 / 층 | 무엇이 막고 있는가 |
|---|---|
| 원리로 환경 문제를 푼 것이 쌓인다 (MC-GROW-EXPLORATION-MASTERY) | **막는 것이 옮겨갔다.** 땅은 섰고(`C-TERRAIN-001` — 자리가 법칙을 지닌다) 쌓이는 형태도 섰다(`C-GROWTH-001`). 남은 것은 **푸는 일**이다 — 지금 땅의 법칙은 겪는 것이지 원리로 푸는 것이 아니다 (거두어 가는 것을 멎게 하는 자리가 놓여 있을 뿐 그것을 여는 행위가 없다) |
| 형태가 상위 형태가 된다 (MC-CHANGE-CLASS) | 넘어갈 형태가 없다 — `CL-*` 가 0 이다. 이름의 소유는 정해졌고 (HISTORY Q55(b) — GS 가 소유한다) 남은 것은 **계열별 설계 문서의 주입**이다 |
| 자기 원리와 관련된 세계 현상을 겪는다 (MK-WITNESSED-WORLD-PHENOMENON) | 드물게 일어나는 세계 현상이 세계에 없다 — 그것은 땅 위에서 생긴다 (TERRAIN 트랙) |
| Class Catalyst — 형태를 유지하는 세계의 Property | GS 는 "세계의 Property" 라고만 적고 어느 자원인지 명명하지 않는다. 자원 카탈로그 문서의 승인·주입이 그 자리를 받는다 (HISTORY Q50(a)) |
| 요정 계열 여덟의 고유 능력 (MS-FAIRY-LINEAGE 여덟 자리) | **누구의 것인지는 정해졌다** — 플레이어가 요정 역할을 수행한다 (HISTORY Q54(a)). 남은 것은 계열별 설계 문서의 주입이며, 그것이 서야 CL-* 와 계열 고유 능력이 노드가 된다 |
| 고를 수 있는 몸이 둘 이상이다 (MA-PLAYER 의 "고를 갈래가 없다") | 갈래가 실제로 달라야 고름이 고름이 된다 (DC-GROWTH-DIFFERENCE-IS-BEHAVIOR — 차이는 수치가 아니라 반복하는 행동이다). 두 번째 몸이 무엇을 다르게 하는지는 계열별 설계 문서가 공급한다 — 그 전에 세우면 외형만 다른 같은 몸이 된다 |
