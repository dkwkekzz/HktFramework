# CC-WORLD-OWNS-THE-CHANCE

접수: Feedback — C015-critical-amplifies-the-blow 의 MASTER FEEDBACK 이 보고한 관찰이다.
Cycle Agent 는 관찰만 보고했고, 승격 판단은 Human 이 했다.

## CANDIDATE STATEMENT

    우연의 원천은 세계가 지니는 상태이고, 그 상태는 관찰에 실리지 않으며,
    그럼에도 결과는 끝까지 설명된다. 이미 정해진 일에는 우연을 쓰지 않는다.

## 무엇을 말하는가 (예시)

한 줄로: **"주사위를 어떻게 굴릴 것인가" 의 규칙.**

크리티컬을 만든다고 하자. 가장 흔한 구현은 이렇다.

```ts
// ❌ 이렇게 하지 않았다
if (Math.random() < attacker.criticalChance) damage *= 2;
```

C015 가 실제로 한 것 (`world/rules/critical-strike.ts`):

```ts
const roll = chanceAt(state.chanceSeed, state.chanceCursor);
state.chanceCursor += 1;
occurred = roll < chance;
```

차이가 네 조각으로 갈린다.

### ① 원천이 세계의 상태다

`Math.random()` 은 세계 **밖에서** 매번 새로 끌어온다. 여기서는 세계가 씨앗
(`chanceSeed`)과 커서(`chanceCursor`)를 자기 상태로 지니고, 커서를 하나씩 밀며 읽는다.

무엇이 달라지나:

```text
같은 세이브를 다시 돌린다      → 같은 씨앗 + 같은 순서 → 같은 전투가 그대로 재생된다
"여기서 이상해요" 라는 신고     → 그 시점 상태로 재현된다
서버 두 대가 같은 판정을 한다   → 결과가 갈리지 않는다
```

`Math.random()` 이면 셋 다 불가능하다. **어제의 전투를 다시 만들 수 없다.**

### ② 그 원천은 관찰에 싣지 않는다

`chanceSeed` · `chanceCursor` 는 GameView 계약에 한 글자도 없다.

실으면 보는 쪽이 `chanceAt(seed, cursor)` 를 스스로 계산해 **다음 타격이 터질지 미리
알 수 있다.** 우연의 값어치가 그 자리에서 사라진다.

### ③ 재료는 숨기되, 경위는 전부 보낸다

②와 짝이다. 숨긴다고 깜깜이로 두지 않는다. 모든 타격에 넷이 실린다.

```text
occurred               터졌나            true
chance                 가능성이 얼마였나   0.25
multiplier             몇 배였나          2.0
damageBeforeCritical   커지기 전 값       20
```

화면에서 이렇게 읽힌다 — **"20 → 40 (치명 25% 적중 · ×2.0)"**.
보는 이가 "왜 갑자기 두 배지?" 를 물을 필요가 없다.

이것이 **숨은 주사위 금지**의 뜻이다: 주사위 자체(seed)는 숨기고,
그 주사위가 무슨 일을 했는지(경위)는 전부 밝힌다.

### ④ 이미 정해진 일에는 주사위를 굴리지 않는다

가장 안 읽히는 조각인데, 실은 가장 중요하다.

```ts
if (chance <= 0) occurred = false;        // 커서를 밀지 않는다
else if (chance >= 1) occurred = true;    // 커서를 밀지 않는다
else { /* 여기서만 커서를 민다 */ }
```

확률이 0% 면 어차피 안 터지고 100% 면 어차피 터진다. **결과만 보면 이 분기가 없어도
똑같다.** 그런데 왜 넣었나 — 커서를 밀었는지 아닌지가 나중에 터지기 때문이다.

나중에 회피(Evade)를 넣는다고 하자. 회피도 같은 커서를 쓴다.

```text
크리티컬 0% 인 상대와 열 대를 주고받는다.

④ 없이 만들었다면
    크리티컬 판정이 커서를 10 소비 → 회피는 커서 10번부터 읽는다
    → 크리티컬 층을 넣기 전과 후의 회피 결과가 전부 달라진다
    → "크리티컬을 쓰지도 않는 상대인데 크리티컬 시스템 때문에 회피가 바뀌었다"

④ 로 만들었으면
    커서가 0 그대로 → 회피는 0번부터 읽는다
    → 크리티컬 층이 있든 없든 완전히 같은 세계
```

C015 검증이 이것을 실제로 측정했다 — 크리티컬 확률이 0 인 존재들만 있는 세계는
C013 시점과 한 글자도 다르지 않다. 회귀 검증이 그대로 통과한 것이 그 증거다.

## OBSERVED REPEATING PATTERN

    관찰은 **한 번**이다. 반복이 확인되지 않았다는 것을 먼저 적는다.

    C015     세계에 우연이 처음 들어온 Cycle 이다. 위 네 조각이 그 자리에서 나왔다.

    ④ 는 C016 이 다른 영역에서 얻은 것과 같은 종류다 — 조건이 여는 것을 기록하지
    않으면 되돌림 규칙이 필요 없다 (CC-CONDITION-OPENS-WITHOUT-RECORDING).
    둘을 관통하는 문장은 하나다: **안 써도 되는 상태는 쓰지 않는다.**

## AFFECTED NODES

    직접   난수가 개입하는 모든 Capability — 지금은 MC-CRITICAL-STRIKE 하나뿐이다
    간접   앞으로 흔들림이 필요한 층 전부 — MC-EVADE(회피 성패) · 조우 · 채집 산출 ·
           생성물의 편차. DC-COMBAT-PLAYER-CAUSALITY(REVISED)가 예외를 하나로 묶어 둔
           지금은 그 예외가 늘어날 때마다 이 형태가 다시 필요해진다

## EXPECTED SCOPE

    GLOBAL — 전투에 한정되지 않는다. 세계에 우연이 들어오는 모든 자리의 성질이다.

## REQUIRES

    - 우연의 원천이 세계 상태로 존재하고 같은 뿌리·같은 순서면 같은 이야기가 나온다
    - 결과의 경위(확률·발생 여부·크기)가 관찰에 실린다

## PROHIBITS

    - 우연의 원천 자체를 관찰에 싣는 것 (앞날이 읽힌다)
    - 경위 없이 결과만 바뀌는 것 (숨은 주사위)
    - 결과가 이미 정해진 판정에서 원천을 소비하는 것

## PREFERS

    - 우연을 읽는 규칙이 세계에 **한 자리**로 유지되는 것 — 여러 규칙이 각자
      원천을 소비하기 시작하면 결정성이 사실상 관측 불가능해진다

## POTENTIAL CONFLICTS

    DC-COMBAT-PLAYER-CAUSALITY (REVISED) 와 역할이 갈린다. 충돌이 아니라 분업이다.

```text
PLAYER-CAUSALITY (REVISED)   우연을 어디에 허용하는가   — 범위   "예외는 Critical 하나"
이 후보                      우연을 어떻게 다루는가     — 형태   위 네 조각
```

    범위가 넓어질 때(두 번째 예외가 허용될 때) 형태가 이미 서 있어야 하므로,
    별개 문안으로 세우고 `supports` 로 잇는다.

## WHY THIS SHOULD BECOME A CONSTRAINT

    우연은 한 번 허용되면 조용히 번진다. 번지는 자리마다 형태가 다르면
    "같은 조건이면 같은 결과" 라는 이 세계의 성질이 어디까지 살아 있는지
    아무도 말할 수 없게 된다. 지금 형태를 못 박아 두면 다음 예외가 올 때 판단 기준이 있다.

    특히 ④ 는 **나중에는 세울 수 없는 조각**이다. 두 번째 우연이 들어온 뒤에
    "그동안 커서를 헛돌렸다" 를 고치면 그 시점까지의 모든 재현이 깨진다.

## HUMAN DECISION

    APPROVED — 2026-08-19 Human 승인. `constraints/DC-WORLD-OWNS-THE-CHANCE.yaml`
    문안 그대로 승격했다 (REVISED 없음). 관찰 1회이지만 ④ 의 비가역성이
    "두 번째 사례를 기다린다" 보다 무겁다는 판단이다.
    DC-COMBAT-PLAYER-CAUSALITY 와는 범위/형태로 역할이 갈리므로 별개 DC 로 세우고
    `relations.supports` 로 이었다.
