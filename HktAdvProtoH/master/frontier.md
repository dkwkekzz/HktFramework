# Frontier

Frontier 는 Graph 의 절대 Leaf 가 아니라 **현재 세계 기준으로 아직 없는 가장 작은
플레이 가능한 Capability 단위**다. Human 이 여기서 하나를 골라 다음 Cycle Goal 로 삼는다.

출처: `design/Design-Combat-OffenseDefense-R0.md` §21 Implementation Roadmap + `overlay.md`

> **번호 주의** — 원본 문서는 자신을 "C008" 로 부르지만 이 저장소의 C008 은
> `cycles/C008-camera-orientation` 이고 C009 까지 닫혀 있다. 아래 후보가 선택되면
> **C010 이후**의 Cycle 로 열린다. 원본의 C008 번호를 Cycle ID 로 쓰지 않는다.

> **Constraint 판정 없음** — `master/constraints/` 가 비어 있다. 후보 조건 6번
> (Active Constraint 와 양립한다)은 지금 판정할 수 없다. Constraint 가 세워지면
> 각 후보에 `Active Constraints` · `Constraint Eval` 을 다시 채운다.

## 후보 조건

```text
1. Existing World 에서 아직 완전히 제공되지 않는다
2. 하나 이상의 상위 Goal/Possibility 를 실제로 전진시킨다
3. Client 에서 직접 플레이하고 결과를 확인할 수 있다
4. 하나의 Cycle 안에서 의미적으로 폐쇄 가능하다
5. 단순 코드 Task 가 아니라 새로운 World/Game Capability 다
6. 적용되는 Active Constraint 와 양립한다        ← 현재 판정 불가
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
    Observable Result    막은 순간 생명이 줄지 않고 기력이 줄어드는 것이 보인다.
                         기력이 모자라면 방어가 무너지는 것이 사유와 함께 보인다
    Why one Cycle        새 행동 1종(막기) + 새 값 1종(방어력) + 기존 타격 규칙의 결과 분기.
                         C007 의 자원·행동·방향이 이미 있어 그 위에 얹힌다
    Status               PROPOSED

### FR-PERFECT-GUARD-TURNS-THE-TABLE
    Playable Result      플레이어가 공격이 닿기 직전에 막아 피해를 전혀 받지 않고,
                         상대를 잠시 열린 상태로 만들어 되받아친다
    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-READ-AND-COUNTER
    Missing / Partial    MC-PERFECT-GUARD (MISSING) · MC-COUNTER (MISSING)
    원본 근거            §8.2 Perfect Guard · §8.4 Counter · §18.2 예시 · §21 Phase 2
    Observable Result    같은 막기라도 시점이 맞으면 다른 결과가 나오는 것이 보이고,
                         상대가 열린 구간이 눈에 드러난다
    Why one Cycle        Guard 위에 시점 판정 1종과 노출 상태 1종을 더한다
    Depends On           FR-GUARD-TRADES-BODY-FOR-RESOURCE (막기가 있어야 그 시점이 있다)
    Status               PROPOSED

### FR-BREAK-OPENS-THE-BURST-WINDOW
    Playable Result      플레이어가 압박을 이어 상대의 균형을 무너뜨리고,
                         무너져 있는 짧은 동안 모아 둔 기력을 쏟아붓는다
    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-BREAK-THE-GUARD
    Missing / Partial    MC-BREAK (MISSING)
    원본 근거            §9 Break · §9.1 Decay · §9.2 BROKEN · §21 Phase 3
    Observable Result    쌓이는 압박이 보이고, 압박이 끊기면 풀리는 것이 보이며,
                         무너진 동안이 명확히 구분된다
    Why one Cycle        누적값 1종 + 붕괴 상태 1종 + 그 동안의 피해 조건 1종
    Status               PROPOSED

### FR-FLOW-OPENS-THE-BODY
    Playable Result      플레이어가 힘을 공격에 몰면 그동안 몸이 실제로 열리고,
                         상대가 힘을 몬 순간을 읽어 그 틈을 때릴 수 있다
    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-EXPLOIT-OPEN-BODY
    Missing / Partial    MC-COMBAT-FLOW (MISSING) · MC-COMBAT-CAUSE-READING (PARTIAL)
    원본 근거            §7 FLOW · §7.1 Skill Flow Profile · §21 Phase 4
    Observable Result    상대 행동의 어느 구간이 취약한지가 화면에서 읽히고,
                         같은 스킬도 언제 맞았는지에 따라 결과가 달라진다
    Why one Cycle        배분 상태 1종 + 스킬 구간별 배분 정의.
                         단, 관찰 표면이 함께 커져야 "읽을 수 있다" 가 성립한다
    Status               PROPOSED

### FR-MATCHUP-MAKES-THE-CHOICE
    Playable Result      플레이어가 상대의 방어 형태에 맞는 공격 형태를 골라
                         같은 스킬로 다른 결과를 만든다
    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-MATCH-WEAPON-TO-ARMOR
    Missing / Partial    MC-ATTACK-ARMOR-MATCHUP (MISSING)
    원본 근거            §6.1 타입 정의 · §6.2 Damage Matchup · §6.3 Break Matchup · §21 Phase 5
    Observable Result    선택이 결과를 바꾸는 것이 수치로 보이고,
                         왜 그렇게 됐는지가 공격·방어 형태로 설명된다
    Why one Cycle        공격 타입 1종 + 방어 타입 1종 + 두 표.
                         존재 종류 정적 데이터(kind 3원소)를 건드리므로 catalog 정합이 함께 온다
    Status               PROPOSED

### FR-VOW-BUYS-POWER-WITH-RISK
    Playable Result      플레이어가 스스로 제약을 건 스킬로 규칙 위의 한 방을 내고,
                         제약을 지키지 못하면 정의된 대가를 그 자리에서 치른다
    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-STAKE-EVERYTHING-ON-ONE-BLOW
    Missing / Partial    MC-VOW (MISSING) · MC-CONDITION-STACKING (MISSING)
    원본 근거            §10 Conditional Critical · §12 Restriction/Vow · §12.1 RED FLASH · §21 Phase 6
    Observable Result    큰 숫자 옆에 그것을 만든 조건들이 그대로 보인다
    Why one Cycle        제약 판정 1종 + 실패 대가 1종 + 조건 합성 1종.
                         겹칠 조건이 이미 있어야 의미가 있으므로 앞의 후보들에 의존한다
    Depends On           FR-BREAK-OPENS-THE-BURST-WINDOW · FR-FLOW-OPENS-THE-BODY
    Status               PROPOSED

## 추천 순서와 근거 (확정 아님 — Human 이 고른다)

```text
1  FR-GUARD-TRADES-BODY-FOR-RESOURCE     없는 것이 가장 적고 C007 자원 위에 바로 얹힌다.
                                         "막는 행위가 실제 선택이 되는가" 를 먼저 본다
2  FR-PERFECT-GUARD-TURNS-THE-TABLE      막기가 있어야 그 시점이 성립한다
3  FR-BREAK-OPENS-THE-BURST-WINDOW       공방 교환이 생긴 뒤라야 압박에 대상이 생긴다
4  FR-FLOW-OPENS-THE-BODY                읽을 것이 늘어난 뒤에 읽는 법을 준다
5  FR-MATCHUP-MAKES-THE-CHOICE           전투 리듬이 선 뒤에 선택지를 넓힌다
6  FR-VOW-BUYS-POWER-WITH-RISK           겹칠 조건이 다 생긴 뒤라야 겹칠 수 있다
```

이 순서는 원본 문서 §21 의 Phase 순서와 같다.
**1 과 2 를 한 Cycle 로 묶을지**는 판단이 갈린다 — 묶으면 Cycle 이 커지고,
나누면 첫 Cycle 이 끝난 시점에 "막기는 있는데 그것으로 공격권을 가져오지는 못하는" 상태가
한 Cycle 동안 유지된다 (원본 §3.2 가 방어의 목적으로 말하는 것이 그때까지 없다).

## 선택 기록

| Frontier | 결정 | Cycle | 비고 |
|---|---|---|---|
| — | — | — | 아직 선택 없음 |

## 규칙

```text
Constraint 를 VIOLATE 하는 후보를 여기에 올리지 않는다 — Design Conflict 로 따로 제시한다.
Agent 는 후보와 근거를 제공하되 개발 우선순위를 확정하지 않는다.
선택된 FR-* 는 cycles/<CycleId>/01-cycle.md 의 MASTER TRACE 로 이어진다.
```
