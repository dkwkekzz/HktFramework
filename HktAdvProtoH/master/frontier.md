# Frontier

Frontier 는 Graph 의 절대 Leaf 가 아니라 **현재 세계 기준으로 아직 없는 가장 작은
플레이 가능한 Capability 단위**다. Human 이 여기서 하나를 골라 다음 Cycle Goal 로 삼는다.

출처: `design/Design-Combat-OffenseDefense-R0.md` §21 Implementation Roadmap + `overlay.md`

> **번호 주의** — 원본 문서는 자신을 "C008" 로 부르지만 이 저장소의 C008 은
> `cycles/C008-camera-orientation` 이다. 후보 둘이 C010 · C011 로 소진됐으므로
> 다음 후보가 선택되면 **C012 이후**의 Cycle 로 열린다.
> 원본의 C008 번호를 Cycle ID 로 쓰지 않는다.

> **Constraint 판정 완료 (2026-08-15)** — Human 지시로 반영된 DC 5종
> (`master/constraints/`) 기준으로 후보 조건 6번을 판정했다. 전 후보 SATISFIED —
> 후보들이 DC 와 같은 원본 기획서에서 나왔으므로 어긋날 수 없다.
> 문안 확정은 `open-questions.md` Q9 (차단 아님).

> **MF 갱신 (2026-08-16)** — C010 · C011 의 MASTER FEEDBACK 을 반영했다.
> 후보 2종(`FR-GUARD-TRADES-BODY-FOR-RESOURCE` · `FR-PERFECT-GUARD-TURNS-THE-TABLE`)이
> `CLOSED` 로 소진됐고, 남은 후보는 4종이다.
> 두 후보의 `Missing / Partial` 이 실제로 채워졌으므로 남은 후보들의 전제도 바뀌었다 —
> 각 후보의 `MF Note` 를 볼 것.

## 후보 조건

```text
1. Existing World 에서 아직 완전히 제공되지 않는다
2. 하나 이상의 상위 Goal/Possibility 를 실제로 전진시킨다
3. Client 에서 직접 플레이하고 결과를 확인할 수 있다
4. 하나의 Cycle 안에서 의미적으로 폐쇄 가능하다
5. 단순 코드 Task 가 아니라 새로운 World/Game Capability 다
6. 적용되는 Active Constraint 와 양립한다
7. 완료 후 공유 World 에 재사용 가능한 Capability 로 누적할 수 있다
```

```text
BAD    Perfect Guard 시스템 구현
GOOD   Player 가 적의 공격 직전에 Guard 하여 피해를 받지 않고 상대를 노출시킬 수 있다
```

## 후보

### FR-GUARD-TRADES-BODY-FOR-RESOURCE
    Playable Result      플레이어가 앞을 향해 막아 들어온 공격을 생명 대신 기력으로 받아내고,
                         막을 기력이 다하면 방어가 무너져 그대로 얻어맞는다
    Source Goal          MG-SURVIVE-ENEMY-OFFENSIVE
    Source Possibility   MP-TRADE-BODY-FOR-RESOURCE
    Missing / Partial    MC-GUARD (MISSING) · MC-DEFENSE-MITIGATION (MISSING)
                         MC-CP-ECONOMY (PARTIAL → 방어가 같은 예산을 쓰기 시작한다)
    원본 근거            §5.2 Defense · §8.1 Guard · §11 CP Economy · §21 Phase 1
    Active Constraints   DC-COMBAT-DEFENSE-IS-ACTIVE · DC-COMBAT-SHARED-BUDGET ·
                         DC-COMBAT-PLAYER-CAUSALITY
    Constraint Eval      SATISFIED — 막기는 행동이고(수치가 아니다), 전용 게이지 없이 같은
                         기력을 소모하며, 무너짐의 원인(기력 고갈)이 관찰 가능하다
    Observable Result    막은 순간 생명이 줄지 않고 기력이 줄어드는 것이 보인다.
                         기력이 모자라면 방어가 무너지는 것이 사유와 함께 보인다
    Why one Cycle        새 행동 1종(막기) + 새 값 1종(방어력) + 기존 타격 규칙의 결과 분기.
                         C007 의 자원·행동·방향이 이미 있어 그 위에 얹힌다
    Status               CLOSED — C010 (cycles/C010-guard-trades-body-for-resource)
    MF Note              막기는 행동이 아니라 **자세(Stance)** 로 세워졌다 (C010 R1) —
                         행동 칸을 쓰지 않으므로 막은 채로 걸을 수 있다.
                         MC-GUARD · MC-DEFENSE-MITIGATION 이 IMPLEMENTED 로 올라갔다.
                         C010 이 남긴 관찰 — 이 Cycle 만으로 막기는 "덜 아프게 맞는 것" 으로만
                         읽힌다. 공격권을 되찾는 수단은 다음 후보가 가져왔다

### FR-PERFECT-GUARD-TURNS-THE-TABLE
    Playable Result      플레이어가 공격이 닿기 직전에 막아 피해를 전혀 받지 않고,
                         상대를 잠시 열린 상태로 만들어 되받아친다
    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-READ-AND-COUNTER
    Missing / Partial    MC-PERFECT-GUARD (MISSING) · MC-COUNTER (MISSING)
    원본 근거            §8.2 Perfect Guard · §8.4 Counter · §18.2 예시 · §21 Phase 2
    Active Constraints   DC-COMBAT-PLAYER-CAUSALITY · DC-COMBAT-DEFENSE-IS-ACTIVE
    Constraint Eval      SATISFIED — 성공 조건은 확률이 아니라 방어 시작과 충돌의 시점
                         관계이고, 성공이 공격권을 뒤집는다
    Observable Result    같은 막기라도 시점이 맞으면 다른 결과가 나오는 것이 보이고,
                         상대가 열린 구간이 눈에 드러난다
    Why one Cycle        Guard 위에 시점 판정 1종과 노출 상태 1종을 더한다
    Depends On           FR-GUARD-TRADES-BODY-FOR-RESOURCE (막기가 있어야 그 시점이 있다) — 충족
    Status               CLOSED — C011 (cycles/C011-perfect-guard-turns-the-table)
    MF Note              MC-PERFECT-GUARD · MC-COUNTER 가 IMPLEMENTED 로 올라갔고,
                         DC-COMBAT-DEFENSE-IS-ACTIVE 의 두 번째 requires 가 여기서 닫혔다.
                         원본에 없는 것 하나가 세계에 더해졌다 — **자세 재세움 간격**.
                         이것이 없으면 자세를 여닫는 것만으로 완벽 창이 끊임없이 새로 열려
                         "읽어서 세운다" 가 성립하지 않는다 (C011 R1).
                         닫지 못한 것 — 되받아침의 **균형 부담**
                         (원본 §8.4 COUNTER_BREAK_MULTIPLIER)은 균형이라는 값이 아직 없어
                         남았다. FR-BREAK-OPENS-THE-BURST-WINDOW 가 가져온다

### FR-BREAK-OPENS-THE-BURST-WINDOW
    Playable Result      플레이어가 압박을 이어 상대의 균형을 무너뜨리고,
                         무너져 있는 짧은 동안 모아 둔 기력을 쏟아붓는다
    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-BREAK-THE-GUARD
    Missing / Partial    MC-BREAK (MISSING)
    원본 근거            §9 Break · §9.1 Decay · §9.2 BROKEN · §21 Phase 3
    Active Constraints   DC-COMBAT-PLAYER-CAUSALITY
    Constraint Eval      SATISFIED — 누적·풀림·붕괴가 모두 관찰 가능한 결정적 상태이며
                         폭발 창은 난수가 아니라 이어간 압박이 연다
    Observable Result    쌓이는 압박이 보이고, 압박이 끊기면 풀리는 것이 보이며,
                         무너진 동안이 명확히 구분된다
    Why one Cycle        누적값 1종 + 붕괴 상태 1종 + 그 동안의 피해 조건 1종
    Status               PROPOSED
    MF Note              전제가 좋아졌다 — overlay 가 적어 둔 "압박의 대상인 방어가 없으면
                         의미가 얇다" 가 해소됐다 (C010 막기 · C011 완벽한 막기).
                         이 후보가 가져올 몫이 둘 늘었다:
                           · 막기의 **균형 부담** (MC-GUARD semantic 의 미완 부분)
                           · 되받아침의 **균형 배수** (원본 §8.4 COUNTER_BREAK_MULTIPLIER)
                         정리해야 할 것 하나 — C010 의 방어 무너짐은 원본 §8.1 이 말하는
                         "즉시 BROKEN 전환" 대신 재막기 봉인으로 세워져 있다.
                         BROKEN 이 들어오면 둘 중 하나로 정합을 맞춰야 하며
                         그 Cycle 의 CHANGED 항목이 된다

### FR-FLOW-OPENS-THE-BODY
    Playable Result      플레이어가 힘을 공격에 몰면 그동안 몸이 실제로 열리고,
                         상대가 힘을 몬 순간을 읽어 그 틈을 때릴 수 있다
    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-EXPLOIT-OPEN-BODY
    Missing / Partial    MC-COMBAT-FLOW (MISSING) · MC-COMBAT-CAUSE-READING (PARTIAL)
    원본 근거            §7 FLOW · §7.1 Skill Flow Profile · §21 Phase 4
    Active Constraints   DC-COMBAT-POWER-HAS-COST · DC-COMBAT-PLAYER-CAUSALITY
    Constraint Eval      SATISFIED — 공격에 몰면 방어가 실제로 비고(집중의 대가),
                         그 열림이 관찰 가능한 상태로 드러난다
    Observable Result    상대 행동의 어느 구간이 취약한지가 화면에서 읽히고,
                         같은 스킬도 언제 맞았는지에 따라 결과가 달라진다
    Why one Cycle        배분 상태 1종 + 스킬 구간별 배분 정의.
                         단, 관찰 표면이 함께 커져야 "읽을 수 있다" 가 성립한다
    Status               PROPOSED
    MF Note              전제가 좋아졌다 — 관찰 표면이 C010·C011 로 넓어졌고
                         (StrikeEvent 내역 11값), 읽을 대상도 생겼다.
                         그리고 이 후보가 MP-READ-AND-COUNTER 의 남은 몫을 마저 가져온다 —
                         그 경로가 요구하는 Knowledge(MK-OPPONENT-FLOW-PATTERN)는
                         C011 이 닫지 못했다. 지금 읽을 수 있는 것은 "칼이 나왔다" 하나뿐이며
                         스킬마다 다른 취약 구간을 읽는 일이 여기서 열린다

### FR-MATCHUP-MAKES-THE-CHOICE
    Playable Result      플레이어가 상대의 방어 형태에 맞는 공격 형태를 골라
                         같은 스킬로 다른 결과를 만든다
    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-MATCH-WEAPON-TO-ARMOR
    Missing / Partial    MC-ATTACK-ARMOR-MATCHUP (MISSING)
    원본 근거            §6.1 타입 정의 · §6.2 Damage Matchup · §6.3 Break Matchup · §21 Phase 5
    Active Constraints   DC-COMBAT-MATCHUP-SOFT · DC-COMBAT-PLAYER-CAUSALITY
    Constraint Eval      SATISFIED — 상성은 결정적이고, 피해 폭은 작게·강한 감각은 균형
                         붕괴 효율 쪽이라는 prefers 와 원본 §6 표의 방향이 일치한다.
                         표의 수치 자체는 Cycle 의 03-world-semantic 소유
    Observable Result    선택이 결과를 바꾸는 것이 수치로 보이고,
                         왜 그렇게 됐는지가 공격·방어 형태로 설명된다
    Why one Cycle        공격 타입 1종 + 방어 타입 1종 + 두 표.
                         존재 종류 정적 데이터(kind 3원소)를 건드리므로 catalog 정합이 함께 온다
    Status               PROPOSED
    MF Note              전제가 좋아졌다 — 방어 타입이 걸릴 자리(Actor.Defense)가 C010 으로
                         생겼고, 그 값이 이미 카탈로그의 종류별 항목이다.
                         Break Matchup 표(§6.3)는 MC-BREAK 이 있어야 뜻을 가지므로
                         FR-BREAK 뒤에 두는 편이 낫다

### FR-VOW-BUYS-POWER-WITH-RISK
    Playable Result      플레이어가 스스로 제약을 건 스킬로 규칙 위의 한 방을 내고,
                         제약을 지키지 못하면 정의된 대가를 그 자리에서 치른다
    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-STAKE-EVERYTHING-ON-ONE-BLOW
    Missing / Partial    MC-VOW (MISSING) · MC-CONDITION-STACKING (MISSING)
    원본 근거            §10 Conditional Critical · §12 Restriction/Vow · §12.1 RED FLASH · §21 Phase 6
    Active Constraints   DC-COMBAT-POWER-HAS-COST · DC-COMBAT-PLAYER-CAUSALITY
    Constraint Eval      SATISFIED — 제약은 세계가 판정 가능하고 실패 대가가 즉시 적용되며,
                         큰 결과는 명시 조건의 합으로만 나온다
    Observable Result    큰 숫자 옆에 그것을 만든 조건들이 그대로 보인다
    Why one Cycle        제약 판정 1종 + 실패 대가 1종 + 조건 합성 1종.
                         겹칠 조건이 이미 있어야 의미가 있으므로 앞의 후보들에 의존한다
    Depends On           FR-BREAK-OPENS-THE-BURST-WINDOW · FR-FLOW-OPENS-THE-BODY
    Status               PROPOSED
    MF Note              겹칠 조건이 하나 생겼다 — C011 이 원본 §10 의 조건 5종 중
                         COUNTER 를 세웠다. 다만 조건을 **합성**하는 구조와 상한
                         (MAX_CONDITION_MULTIPLIER)은 없고 조건 하나가 홀로 걸릴 뿐이다.
                         MC-CONDITION-STACKING 이 채울 몫은 그대로 남아 있다

## 추천 순서와 근거 (확정 아님 — Human 이 고른다)

```text
✔  FR-GUARD-TRADES-BODY-FOR-RESOURCE     C010 으로 닫힘
✔  FR-PERFECT-GUARD-TURNS-THE-TABLE      C011 으로 닫힘

1  FR-BREAK-OPENS-THE-BURST-WINDOW       공방 교환이 생긴 뒤라야 압박에 대상이 생긴다
                                         — 이제 그 대상이 실제로 있다
2  FR-FLOW-OPENS-THE-BODY                읽을 것이 늘어난 뒤에 읽는 법을 준다
3  FR-MATCHUP-MAKES-THE-CHOICE           전투 리듬이 선 뒤에 선택지를 넓힌다
4  FR-VOW-BUYS-POWER-WITH-RISK           겹칠 조건이 다 생긴 뒤라야 겹칠 수 있다
```

이 순서는 원본 문서 §21 의 Phase 순서와 같다 (남은 것은 Phase 3~6).

**닫힌 두 후보에 대한 회고** — 1 과 2 를 나눈 것이 옳았는지가 판단이 갈리는 지점이었다.
실제로 나누어 돌린 결과, C010 이 끝난 시점에 "막기는 있는데 그것으로 공격권을 가져오지는
못하는" 상태가 한 Cycle 동안 유지됐고 C010 스스로 그것을 관찰로 남겼다
(막기가 "덜 아프게 맞는 것" 으로만 읽힌다). 그 상태는 C011 이 곧바로 해소했다.
나눈 대가는 한 Cycle 동안의 불완전함이었고, 얻은 것은 두 Cycle 각각이 작게 닫힌 것이다.

**다음 판단이 갈리는 지점** — 남은 넷 중 어느 것도 서로를 강하게 요구하지 않는다.
다만 FR-VOW 는 `Depends On` 이 명시돼 있고(BREAK · FLOW), FR-MATCHUP 의 Break Matchup 표는
MC-BREAK 이 있어야 뜻을 가진다. 즉 **FR-BREAK 을 먼저 두면 나머지 셋의 선택이 자유로워진다.**

## 선택 기록

| Frontier | 결정 | Cycle | 비고 |
|---|---|---|---|
| FR-GUARD-TRADES-BODY-FOR-RESOURCE | SELECTED | C010 | 추천 1번. 08-verification 통과 · Human Play 확인 대기 |
| FR-PERFECT-GUARD-TURNS-THE-TABLE | SELECTED | C011 | 추천 2번. `Depends On` 이 C010 으로 충족된 뒤 선택 · 08-verification 통과 · Human Play 확인 대기 |

두 Cycle 모두 `08-verification.md` 의 STATUS 가 아직 `IN PROGRESS` 다 (Human Play 확인 대기).
Overlay 승격은 실측 기록을 근거로 이루어졌으므로 Play 확인에서 되돌아오면
overlay.md 와 이 표를 함께 되돌린다.

## 규칙

```text
Constraint 를 VIOLATE 하는 후보를 여기에 올리지 않는다 — Design Conflict 로 따로 제시한다.
Agent 는 후보와 근거를 제공하되 개발 우선순위를 확정하지 않는다.
선택된 FR-* 는 cycles/<CycleId>/01-cycle.md 의 MASTER TRACE 로 이어진다.
```
