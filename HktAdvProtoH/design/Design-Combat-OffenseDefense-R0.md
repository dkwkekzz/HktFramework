<!--
저장소 주석 (원본 아님) — 이 파일은 Human 이 작성한 전투 System Design Document 원본이다.

1. 문서 안의 "C008" 은 이 문서 자체의 번호이며, 이 저장소의 `cycles/C008-camera-orientation`
   과 무관하다. 저장소의 다음 Cycle 번호는 C010 이후다. 혼동을 피하려 파일명에서 번호를 뺐다.
2. 이 문서의 의미 중 Goal/Possibility/Capability 는 Master Layer 로 주입되어 있다 —
   Graph `master/graph/*.yaml` · Overlay `master/overlay.md` · Frontier `master/frontier.md`.
   Constraint 는 주입하지 않았다 — 이 문서에서 설계 원칙을 뽑는 일은 Human 이 한다.
3. §5·§6·§8·§9·§17 의 수치·공식·판정 순서는 Master 에 올리지 않는다
   (Master-Intent-Graph-Policy §22 · §26.3). 그것들은 이 문서에 남아 있다가
   해당 Cycle 의 `03-world-semantic.md` 가 소유한다. 이 파일이 그 수치의 원본이다.
-->

# SYSTEM DESIGN DOCUMENT

## C008 — 공격·방어 전투 시스템

Combat Offense / Defense · FLOW / BREAK / VOW

> **핵심 명제**
> 랜덤이 크리티컬을 만드는 것이 아니라, 플레이어의 선택이 크리티컬을 만든다.

| **문서 버전** | R0                                    |
|---------------|---------------------------------------|
| **상태**      | System Design Draft                   |
| **기반**      | C007 — Intent                         |
| **범위**      | 공격 / 방어 / 공방 배분 / Break / Vow |
| **작성 목적** | 기획·구현·밸런스 공통 기준            |

# 1. Executive Summary

C008은 C007에서 이미 구현된 HP/CP 자원 순환, 고정 피해, 공격속도에 따른
행동 길이, 피격 시 행동 중단·넉백을 유지하면서, 공격과 방어 사이의
실시간 상호작용을 확장한다.

핵심 설계 방향은 확률형 명중·회피·크리티컬을 추가하지 않는 것이다. 대신
큰 피해와 전투 우위는 공격 선택, 공방력 배분, Guard 타이밍, Counter,
Break, 위치, 그리고 플레이어가 스스로 받아들인 제약으로 만들어진다.

> **Design Pillar**
> 강한 결과에는 반드시 관찰 가능한 원인이 있어야 한다. 같은 상태·같은 조건·같은 행동이면 언제나 같은 결과가 나온다.

## 1.1 이번 시스템이 해결하려는 문제

- 기본 공격 → CP 충전 → 고급 스킬 사용만으로 끝나는 단조로운 자원 루프에
  공격/방어 심리전을 추가한다.

- 방어를 단순 피해 감소 수치가 아니라 공격권을 되찾는 능동 행동으로
  만든다.

- 폭발적인 딜 타이밍을 RNG Critical이 아니라 Break와 조건 달성으로
  만든다.

- 강력한 스킬에 실제 전투 위험을 부여하여 빌드와 플레이 스타일의 개성을
  만든다.

- 모든 계산 이유를 세계가 공개할 수 있게 하여 전투 학습성과 디버깅
  가능성을 높인다.

## 1.2 전투의 4개 판정 층

| **Layer** | **핵심 질문**              | **플레이 경험**                 |
|-----------|----------------------------|---------------------------------|
| HIT       | 실제로 충돌했는가?         | 거리 · 방향 · 타이밍            |
| MATCHUP   | 무엇으로 무엇을 때렸는가?  | 공격 타입 · 방어 타입           |
| FLOW      | 지금 힘을 어디에 몰았는가? | 공격/방어 리스크 배분           |
| RESPONSE  | 상대가 어떻게 대응했는가?  | Guard · Evade · Counter · Break |

## 1.3 한 문장으로 정의하는 전투

> **Core Loop**
> 약공으로 기회를 만들고, 방어로 상대의 공격권을 훔치고, 힘을 한쪽에 집중해 위험을 감수하며, Break 순간에 축적한 CP를 폭발시키고, 제약을 완수했을 때 규칙을 넘어서는 한 방을 만든다.

# 2. Current Baseline — C007

C008은 기존 전투 구조를 교체하지 않는다. 기존 C007을 하위 기반으로 삼고
Strike 결과 해석과 방어·상태 계층을 확장한다.

| **기존 요소** | **C007 상태**             | **C008에서의 확장**                    |
|---------------|---------------------------|----------------------------------------|
| HP / CP       | 생명과 기력 2자원         | 공격·방어·회피의 공통 CP 예산          |
| Skill Budget  | 적중 시 충전/소비         | Guard·Evade·Fortify·Vow로 확장         |
| Fixed Damage  | 스킬별 고정 피해          | baseDamage 유지 + 결정론적 배율 추가   |
| Action Speed  | 공격속도가 행동 길이 변경 | Flow 구간도 동일 비율로 축소/확장      |
| Hit Reaction  | 중단 + 밀려남             | Exposed · Guard Break · Broken 추가    |
| Observability | 속성/결과 완전 관찰       | 피해 원인의 모든 배율과 Condition 공개 |

> **보존 원칙**
> 명중률, 회피율, 피해 난수, 확률 Critical은 추가하지 않는다. C008의 변동성은 “확률”이 아니라 “상태와 선택”에서 나온다.

# 3. Reference Principles

## 3.1 Warcraft III — 상성은 선택을 만든다

차용할 핵심은 공격 타입과 방어 타입의 조합이다. 다만 캐릭터 중심
전투에서는 하드 카운터가 플레이 경험을 억압할 수 있으므로 피해 상성 폭은
작게 유지하고, 강한 카운터 감각은 Break 효율 쪽에 더 크게 배치한다.

## 3.2 MMORPG — 방어 성공은 공격 기회다

잘 만든 액션 MMORPG의 Guard, Counter, Stagger/Break 구조에서 가져올
핵심은 “방어가 피해를 덜 받는 행위로 끝나지 않는다”는 점이다. 좋은
방어는 상대의 공격권을 빼앗고 다음 폭딜 창을 만든다.

## 3.3 Hunter × Hunter Nen — 힘은 집중과 제약에서 나온다

넨 시스템에서 차용할 핵심은 계통 이름보다 원리다. 공격과 방어에 힘을
배분하고, 한쪽에 집중할수록 다른 쪽이 비며, 더 큰 위험과 제약을
받아들일수록 더 강한 결과를 얻는다.

| **참고 개념**       | **전투 설계 변환**                  |
|---------------------|-------------------------------------|
| Gyo / Ko            | 특정 순간에 공격 Flow 집중          |
| Ken                 | 지속 방어 상태 Fortify              |
| Ryu                 | 스킬 구간별 실시간 공방 배분        |
| Restrictions & Vows | 세계가 검증 가능한 제약 ↔ 추가 위력 |

# 4. Core Combat Loop

전투는 단순히 스킬 쿨다운을 순서대로 소모하는 것이 아니라, 상대의
행동권과 자원 상태를 읽고 Burst Window를 직접 만드는 과정이다.

| **단계**   | **행동**                | **전투적 의미**            |
|------------|-------------------------|----------------------------|
| 1\. 탐색   | 거리 · 방향 · 스킬 관찰 | 상대의 방어/Flow 성향 파악 |
| 2\. 축적   | 기본 공격 적중          | CP 확보 + Break 압박 시작  |
| 3\. 교환   | Guard / Evade / Counter | 공격권을 주고받음          |
| 4\. 압박   | 상성 공격 · Counter     | Break를 빠르게 누적        |
| 5\. 파열   | BREAK → BROKEN          | 짧은 방어 붕괴 창 생성     |
| 6\. 폭발   | 고급 스킬 + Vow         | 축적 CP를 대량 소비        |
| 7\. 재정렬 | 거리 회복 · CP 재축적   | 다음 교환 준비             |

탐색 → CP 축적 → Guard/Counter 교환 → Break 압박 → BROKEN → Burst →
재정렬

# 5. Damage Model

## 5.1 최종 피해 공식

rawDamage  
= skill.damage  
× matchupDamageMultiplier  
× offenseFlowMultiplier  
× conditionMultiplier  
  
effectiveDefense  
= baseDefense  
× defenseFlowMultiplier  
+ temporaryDefense  
  
damageReduction  
= effectiveDefense × DEFENSE_K  
/ (1 + effectiveDefense × DEFENSE_K)  
  
finalDamage  
= rawDamage × (1 - damageReduction)

동일한 Actor, 동일한 상태, 동일한 스킬, 동일한 위치/조건이라면 결과는
항상 같다. 피해 공식 안에는 난수가 없다.

## 5.2 Defense

Defense는 공격을 빗나가게 만들지 않고, 실제로 맞은 피해를 줄인다. 양수
방어력은 diminishing return 구조를 사용하며 일반 방어만으로 피해 0에
도달하지 않는다.

DEFENSE_K = 0.02  
MAX_DAMAGE_REDUCTION = 0.80  
effectiveDefense \>= 0

음수 방어력은 사용하지 않는다. 추가 피해는 Exposed, Broken, Counter,
Weak Point 같은 명시적인 조건으로 만든다.

# 6. Attack Type × Armor Type

## 6.1 기본 공격/방어 타입

| **Attack Type** | **역할**                     |
|-----------------|------------------------------|
| SLASH           | 경량·노출 대상에 유리한 절단 |
| PIERCE          | 균형형 방어와 약점 공략      |
| CRUSH           | 중장 및 Break 공략           |
| AURA            | 상성 중립 / 특수 효과 기반   |

| **Armor Type** | **역할**                                |
|----------------|-----------------------------------------|
| LIGHT          | 기동 중심, Slash에 상대적으로 취약      |
| BALANCED       | 중간형, Pierce가 효율적                 |
| HEAVY          | 직접 피해에 강하지만 Crush Break에 취약 |

## 6.2 Damage Matchup

| **Attack** | **LIGHT** | **BALANCED** | **HEAVY** |
|------------|-----------|--------------|-----------|
| SLASH      | 1.15      | 1.00         | 0.85      |
| PIERCE     | 1.00      | 1.15         | 0.90      |
| CRUSH      | 0.90      | 1.00         | 1.15      |
| AURA       | 1.00      | 1.00         | 1.00      |

## 6.3 Break Matchup

| **Attack** | **LIGHT** | **BALANCED** | **HEAVY** |
|------------|-----------|--------------|-----------|
| SLASH      | 1.00      | 1.00         | 0.90      |
| PIERCE     | 1.00      | 1.15         | 1.00      |
| CRUSH      | 0.90      | 1.10         | 1.50      |
| AURA       | 1.00      | 1.00         | 1.00      |

> **설계 포인트**
> 상성의 강한 감각을 HP 피해가 아니라 Break 효율로 분산한다. “이 무기 없으면 못 잡는다”보다 “이 무기로 방어를 깨면 팀의 폭딜이 열린다”가 목표다.

# 7. FLOW — 공방력 배분

Flow는 별도 자원이 아니다. 현재 행동이 몸의 힘을 공격과 방어 중 어디에
집중하는지를 표현하는 상태값이다.

offenseFlow + defenseFlow = 100

| **상태** | **공격 / 방어** | **Attack** | **Defense** | **의미**            |
|----------|-----------------|------------|-------------|---------------------|
| Neutral  | 50 / 50         | ×1.00      | ×1.00       | 기본 상태           |
| Assault  | 70 / 30         | ×1.15      | 약화        | 일반 공격 집중      |
| Focus    | 90 / 10         | ×1.45      | 대폭 약화   | 한 방에 건다        |
| Fortify  | 20 / 80         | ×0.85      | ×1.35       | 지속 방어 / CP 소모 |

## 7.1 Skill Flow Profile

스킬은 STARTUP / ACTIVE / RECOVERY 구간마다 서로 다른 Flow를 가질 수
있다. 따라서 “강한 공격의 정확한 순간에 몸이 열린다”는 리스크를 데이터로
표현할 수 있다.

Thrust  
  
STARTUP 30 offense / 70 defense  
ACTIVE 85 offense / 15 defense  
RECOVERY 40 offense / 60 defense

공격속도가 행동 길이를 줄이거나 늘리면 Flow 구간도 동일한 비율로
조정한다.

> **전투 숙련도**
> 플레이어는 단순히 상대 스킬 이름을 외우는 것이 아니라 “언제 offenseFlow가 높고 defenseFlow가 낮아지는지”를 읽는다. 그 순간이 Counter의 핵심 틈이다.

# 8. Defense Interaction

## 8.1 Guard

Guard는 행동이다. 전방 Guard Arc 안에서 Guard 가능한 공격을 받으면 HIT
대신 GUARDED가 된다. HP 피해는 크게 줄지만 CP와 Break 압박을 받는다.

GUARD_ARC = 120°  
GUARD_HP_DAMAGE_MULTIPLIER = 0.25  
Guard CP Cost = skill.impact × GUARD_CP_FACTOR  
GUARD_CP_FACTOR = 1.0

현재 CP가 필요한 Guard 비용보다 적으면 남은 CP를 모두 소모하고
GUARD_BREAK가 발생한다. 계속 막기만 하는 플레이는 결국 자원이 말라
붕괴한다.

## 8.2 Perfect Guard

Guard 시작 직후 0.20초 안에 공격이 들어오면 Perfect Guard가 된다. 이는
확률 판정이 아니라 공격 충돌 시각과 Guard 시작 시각의 관계로 결정된다.

PERFECT_GUARD_WINDOW = 0.20 sec  
HP Damage = 0  
Guard CP Cost = 0  
Defender CP += 10  
Attacker → EXPOSED 0.8 sec

## 8.3 Evade

기본 Evade는 무적 프레임을 제공하지 않는다. 실제 몸이 이동하여 충돌을
피해야 한다. 확률 회피율 대신 위치와 타이밍을 사용한다.

EVADE_CP_COST = 15

## 8.4 Counter

Counter 가능한 스킬이 Exposed 대상 또는 스킬이 정의한 Counter Window를
때리면 Counter 조건이 성립한다.

COUNTER_DAMAGE_BONUS = +0.25  
COUNTER_BREAK_MULTIPLIER = 2.00

# 9. BREAK — 공격권을 폭딜 창으로 변환

Break는 HP/CP와 같은 장기 자원이 아니라 현재 전투에서 균형이 얼마나
무너졌는지를 표현하는 단기 상태값이다.

breakMax = 100  
breakGain = skill.breakPower × matchupBreakMultiplier ×
resultBreakMultiplier

| **Result**    | **Break Multiplier** | **의미**                    |
|---------------|----------------------|-----------------------------|
| HIT           | ×1.00                | 기본 압박                   |
| GUARDED       | ×1.50                | HP 대신 균형 부담 증가      |
| COUNTER       | ×2.00                | 읽은 공격에 강한 보상       |
| PERFECT GUARD | 공격자에게 누적      | 방어 성공이 역압박으로 전환 |

## 9.1 Break Decay

BREAK_DECAY_DELAY = 3.0 sec  
BREAK_DECAY_RATE = 10 / sec

Break는 압박을 이어가야 유지된다. 드문드문 약공만 반복해도 언젠가
자동으로 무너지는 구조는 피한다.

## 9.2 BROKEN

BROKEN_DURATION = 2.50 sec  
현재 행동 중단  
Guard / Evade 시작 불가  
Defense Flow 효과 무효  
BROKEN_TARGET_DAMAGE_BONUS = +0.35

> **Burst Window**
> BROKEN은 “공격 성공의 끝”이 아니라 파티/개인 폭딜의 시작이다. 플레이어는 이 2.5초를 위해 CP를 축적하고 고급 스킬과 Vow를 아껴둔다.

# 10. Conditional Critical

확률 Critical을 제거하고, 플레이어가 만들어낸 사건을 Critical의 원인으로
사용한다.

| **Condition** | **초기 보상** |
|---------------|---------------|
| COUNTER       | Damage +0.25  |
| WEAK_POINT    | Damage +0.20  |
| BROKEN_TARGET | Damage +0.35  |
| REAR_ATTACK   | Damage +0.10  |
| VOW_FULFILLED | 스킬별 정의   |

conditionMultiplier = 1 + sum(conditionBonus)  
MAX_CONDITION_MULTIPLIER = 2.00

여러 조건을 겹쳐 최대 2배까지 도달할 수 있지만, 그 결과는 운이 아니라
상황 설계와 실행으로 만들어진다.

# 11. CP Economy

CP는 공격력, 방어력, 이동력, 폭딜 가능성을 하나의 경제로 묶는 공통
예산이다. 별도의 Guard Gauge / Ultimate Gauge를 만들지 않고 기존 CP를
확장한다.

| **행동**       | **CP 방향**    | **목적**                |
|----------------|----------------|-------------------------|
| 기본 공격 적중 | 획득           | 다음 선택을 위한 축적   |
| 고급 공격      | 소비           | 폭발 피해               |
| Guard          | 소비           | HP 피해를 자원으로 전환 |
| Perfect Guard  | 획득           | 성공적 방어 보상        |
| Evade          | 소비           | 위치 재설정             |
| Fortify        | 지속 소비      | 안정성 확보             |
| Vow Skill      | 대량 소비 가능 | 클라이맥스              |

기본 공격 → CP 충전  
Guard / Evade → CP 소비  
Perfect Guard → CP 회복 + 공격권  
Break → Burst Window  
고급 스킬 / Vow → CP 대량 방출

# 12. RESTRICTION / VOW — 위험과 보상

강한 스킬에는 실제 전투에서 검증 가능한 제약을 붙일 수 있다. 제약은
텍스트 설정이 아니라 세계가 참/거짓을 판정할 수 있는 조건이어야 한다.

| **제약 유형** | **예시**                  | **보상 방향**   |
|---------------|---------------------------|-----------------|
| 상태 조건     | HP 30% 이하에서만         | 위력 상승       |
| 선행 조건     | Perfect Guard 직후만      | 위력/Break 상승 |
| 실패 리스크   | MISS 시 Guard 8초 봉인    | 큰 위력 보상    |
| 방어 포기     | ACTIVE 중 defenseFlow = 0 | 공격 배율 증가  |
| 대상 제한     | Marked / Broken 대상만    | 효율 증가       |
| 자원 제약     | CP 전부 소비              | 강한 Burst      |
| 반복 제한     | 전투당 1회                | 클라이맥스 강화 |
| 시간 제약     | 2초 Charge                | 위력 강화       |

totalRisk = sum(restriction.riskScore)  
vowMultiplier = 1 + totalRisk × VOW_RISK_FACTOR  
VOW_RISK_FACTOR = 0.10  
MAX_VOW_MULTIPLIER = 1.60

> **중요**
> 제약은 “어려운 척하는 설명”이 아니라 실제 위험이어야 한다. 실패 사건이 발생하면 정의된 Consequence가 즉시 적용되어야 한다.

## 12.1 예시 — RED FLASH

Damage 100  
CP Cost 60  
AttackType SLASH  
BreakPower 30  
ACTIVE Flow 90 / 10  
  
Restriction  
HP \<= 30%  
  
Failure  
MISS → GUARD_LOCK 8 sec  
  
Additional Risk  
ACTIVE defenseFlow = 0  
  
Vow Multiplier  
×1.50

Broken Target에게 성공하면 Focus, Broken 조건, Vow가 동시에 작동한다.
강력하지만 실패하면 방어권을 잃고, HP가 낮을 때만 사용할 수 있으며, 시전
중 몸도 열린다.

# 13. Weak Point / Rear Attack

## 13.1 Weak Point

Weak Point는 확률형 약점 공격이 아니다. 특정 충돌 영역 또는 세계 상태
조건에 실제 공격이 닿아야 성립한다.

WEAK_POINT_DAMAGE_BONUS = +0.20  
WEAK_POINT_BREAK_MULTIPLIER = 1.50

## 13.2 Rear Attack

후방에서 들어온 공격은 Guard를 우회하기 쉬우며 작은 추가 피해를
제공한다.

REAR_ARC = 120°  
REAR_ATTACK_DAMAGE_BONUS = +0.10

# 14. Strike Resolution Order

동일한 세계 상태에서는 판정 순서도 동일해야 한다. 아래 순서를 Combat
Resolver의 기준으로 사용한다.

1.  공격자 / 대상 유효성 확인

2.  실제 충돌 확인

3.  대상 DOWNED 여부

4.  Guard Arc 확인

5.  Perfect Guard Window 확인

6.  Guard 가능 공격 여부

7.  Guard CP 충분성 / Guard Break

8.  Counter 조건

9.  Weak Point 조건

10. Rear Attack 조건

11. AttackType × ArmorType

12. Flow 계산

13. Condition 계산

14. Defense 계산

15. HP Damage 적용

16. Break 적용

17. DOWNED / BROKEN 판정

18. CP 충전·소비 적용

19. Combat Result 관찰 이벤트 생성

## 14.1 State Priority

DOWNED \> BROKEN \> HIT_REACTION \> NORMAL_ACTION

동일 타격으로 HP 0과 Break Max가 동시에 발생하면 최종 상태는 DOWNED다.

# 15. Feedback & Observability

전투의 모든 큰 결과는 세계 규칙에서 판정되고, UI/사운드/카메라는 그
결과를 표현한다. 연출이 판정을 만들지 않는다.

| **Tier** | **대표 결과**           | **연출 강도**                 |
|----------|-------------------------|-------------------------------|
| 1        | HIT / GUARDED           | 기본 Hit Stop · 숫자          |
| 2        | REAR / WEAK POINT       | 강조 텍스트 · 강화 효과음     |
| 3        | COUNTER / PERFECT GUARD | 강한 Hit Stop · 명확한 사운드 |
| 4        | GUARD BREAK / BREAK     | 화면·카메라·파티 Burst 신호   |
| 5        | VOW FULFILLED           | 전투 클라이맥스 연출          |

## 15.1 Combat Result 공개 정보

attacker / target / skill  
baseDamage / finalDamage  
attackType / armorType / matchupMultiplier  
offenseFlow / defenseFlow  
conditions\[\] / strikeResult  
breakDamage / currentBreak / maxBreak  
hpBefore / hpAfter  
cpChanges\[\]

피해가 커졌다면 플레이어와 디버거가 “왜 커졌는가”를 정확히 추적할 수
있어야 한다.

# 16. Data Shape

## 16.1 Actor

Actor  
hp / hpMax  
cp / cpMax  
baseDefense  
armorType  
offenseFlow / defenseFlow  
break / breakMax  
combatState  
modifiers\[\]  
statusEffects\[\]

## 16.2 Skill

Skill  
damage  
cpCharge / cpCost  
actionLength  
attackType  
impact / breakPower  
guardable / counterable  
flowProfile { startup, active, recovery }  
restrictions\[\]  
failureConsequence\[\]  
vowRisk

## 16.3 CombatResult

CombatResult  
attacker / target / skill  
resultType  
baseDamage / finalDamage  
damageReduction  
matchupDamageMultiplier / matchupBreakMultiplier  
offenseFlowMultiplier / defenseFlowMultiplier  
conditions\[\]  
breakDamage  
hpDelta / cpDelta  
causedBroken / causedDowned

# 17. R0 Initial Tuning Constants

| **항목**                   | **R0 값** | **의도**                  |
|----------------------------|-----------|---------------------------|
| DEFENSE_K                  | 0.02      | 방어 diminishing return   |
| MAX_DAMAGE_REDUCTION       | 0.80      | 일반 방어의 피해 0 방지   |
| GUARD_ARC                  | 120°      | 전방 능동 방어            |
| GUARD_HP_DAMAGE_MULTIPLIER | 0.25      | HP 대신 CP/Break 부담     |
| PERFECT_GUARD_WINDOW       | 0.20 sec  | 명확한 타이밍 보상        |
| PERFECT_GUARD_CP_REWARD    | 10        | 방어 성공을 자원 이득으로 |
| EVADE_CP_COST              | 15        | 기동의 기회비용           |
| BREAK_MAX                  | 100       | 튜닝 기준점               |
| BREAK_DECAY_DELAY          | 3.0 sec   | 압박 지속 요구            |
| BREAK_DECAY_RATE           | 10 / sec  | 이탈 시 회복              |
| BROKEN_DURATION            | 2.50 sec  | 폭딜 창                   |
| BROKEN_DAMAGE_BONUS        | +0.35     | Burst 명확화              |
| COUNTER_DAMAGE_BONUS       | +0.25     | 읽기 보상                 |
| COUNTER_BREAK_MULTIPLIER   | ×2.00     | 역공 핵심                 |
| WEAK_POINT_DAMAGE_BONUS    | +0.20     | 정확한 위치 보상          |
| REAR_ATTACK_DAMAGE_BONUS   | +0.10     | 위치 보상                 |
| FORTIFY_CP_DRAIN           | 3 / sec   | 지속 방어 비용            |
| MAX_CONDITION_MULTIPLIER   | 2.00      | 조건 중첩 상한            |
| MAX_VOW_MULTIPLIER         | 1.60      | 제약 위력 상한            |

> **주의**
> 위 수치는 밸런스 확정값이 아니라 R0 전투 리듬 검증용이다. 먼저 “행동이 재미있는가”를 확인한 뒤 TTК, CP 수지, Break 속도를 조정한다.

# 18. Combat Examples

## 18.1 일반 Slash vs Heavy

Skill Damage = 100  
SLASH → HEAVY Damage Matchup = ×0.85  
Offense Flow 70 = ×1.15  
Target Defense = 20  
DEFENSE_K = 0.02  
  
rawDamage = 100 × 0.85 × 1.15 = 97.75  
damageReduction = 0.4 / 1.4 = 0.2857  
finalDamage ≈ 70

같은 조건이면 다음 공격도 동일하게 약 70 피해가 나온다.

## 18.2 Perfect Guard → Counter → Break

공격 충돌: Guard 시작 후 0.16 sec  
0.16 \<= 0.20 → PERFECT_GUARD  
  
방어자 HP Damage = 0  
방어자 CP +10  
공격자 EXPOSED 0.8 sec  
공격자 Break 누적  
  
즉시 Counter Skill 적중  
→ Damage +0.25  
→ Break ×2.00  
→ Break 100 도달  
→ BROKEN 2.5 sec  
→ Burst Window

## 18.3 Vow Burst

RED FLASH가 Broken Target에게 적중하면 Focus + Vow + Broken 조건이
겹친다. 이때 큰 숫자는 RNG가 아니라 “HP 조건을 감수하고, 공격 중 방어를
포기하고, 상대를 먼저 Break시키고, 실제로 공격을 적중시킨 결과”다.

# 19. C008 Intent Specification — Summary

아래 Intent들은 구현 추적을 위한 C008 핵심 단위다. 세부 수치와 상태
전이는 앞 절의 규칙을 따른다.

| **Intent**                         | **정의**                                                               |
|------------------------------------|------------------------------------------------------------------------|
| INTENT-ATTACK-TYPE-001             | 스킬은 SLASH / PIERCE / CRUSH / AURA 중 공격 타입을 가진다.            |
| INTENT-ARMOR-TYPE-001              | Actor는 LIGHT / BALANCED / HEAVY 방어 타입을 가진다.                   |
| INTENT-ATTACK-ARMOR-MATCHUP-001    | 공격×방어 조합이 Damage/Break 배율을 결정한다.                         |
| INTENT-DEFENSE-001                 | Defense는 충돌 후 피해량을 감소시킨다.                                 |
| INTENT-NEGATIVE-DEFENSE-001        | 일반 전투에서 effectiveDefense는 0 미만이 되지 않는다.                 |
| INTENT-COMBAT-FLOW-001             | 공격력과 방어력은 Flow 100을 분배한다.                                 |
| INTENT-SKILL-FLOW-PROFILE-001      | 스킬 구간별 STARTUP/ACTIVE/RECOVERY Flow를 정의할 수 있다.             |
| INTENT-STRIKE-RESULT-001           | HIT/GUARDED/PERFECT_GUARD/COUNTER/GUARD_BREAK/BREAK로 결과를 분류한다. |
| INTENT-DAMAGE-RESOLUTION-001       | 고정 baseDamage에 결정론적 배율을 적용한다.                            |
| INTENT-CONDITIONAL-CRITICAL-001    | 확률 Critical 대신 명시 조건으로 추가 피해를 만든다.                   |
| INTENT-GUARD-001                   | 전방 Guard는 HP 피해 일부를 CP/Break 부담으로 전환한다.                |
| INTENT-PERFECT-GUARD-001           | Guard 시작 직후 정확한 타이밍 성공 시 피해 0과 반격권을 얻는다.        |
| INTENT-EVADE-001                   | 기본 Evade는 무적이 아니라 실제 위치 이동으로 충돌을 피한다.           |
| INTENT-COUNTER-001                 | Exposed/Counter Window를 읽으면 Damage와 Break 보너스를 얻는다.        |
| INTENT-BREAK-001                   | 전투 압박을 0~breakMax의 단기 상태값으로 누적한다.                     |
| INTENT-BROKEN-001                  | Break Max 도달 시 방어 붕괴와 Burst Window를 만든다.                   |
| INTENT-GUARD-BREAK-001             | Guard CP 부족 시 즉시 Broken으로 전환된다.                             |
| INTENT-COMBAT-CP-ECONOMY-001       | 기존 CP를 공격·방어·회피의 공통 예산으로 사용한다.                     |
| INTENT-FORTIFY-001                 | 지속 CP 소비로 높은 방어 Flow를 유지한다.                              |
| INTENT-SKILL-RESTRICTION-001       | 스킬 제약은 세계가 검증 가능한 조건이어야 한다.                        |
| INTENT-VOW-001                     | 실제 제약과 실패 위험을 추가 위력으로 교환한다.                        |
| INTENT-VOW-FAILURE-001             | 정의된 실패 사건이 발생하면 Consequence를 적용한다.                    |
| INTENT-WEAK-POINT-001              | 정확한 영역/조건 적중이 Weak Point 보상을 만든다.                      |
| INTENT-REAR-ATTACK-001             | 후방 공격은 Guard 우회와 소규모 피해 보상을 가진다.                    |
| INTENT-STRIKE-RESOLUTION-ORDER-001 | 동일한 판정 순서를 사용해 결정론을 유지한다.                           |
| INTENT-COMBAT-RESULT-OBSERVE-001   | 결과를 만든 모든 원인과 배율을 관찰할 수 있다.                         |

# 20. Existing Intent Delta

## 20.1 Reused

| **기존 Intent**              | **C008 관계**                               |
|------------------------------|---------------------------------------------|
| INTENT-VITALITY-001          | HP / CP 자원 재사용                         |
| INTENT-SKILL-BUDGET-001      | 적중 기반 CP 순환 재사용                    |
| INTENT-SKILL-COST-GATE-001   | 행동 시작 비용 Gate 재사용                  |
| INTENT-DAMAGE-APPLY-001      | 최종 피해를 기존 HP 감소 경로로 적용        |
| INTENT-DOWNED-001            | HP 0 상태 우선순위 유지                     |
| INTENT-TEMPO-ACTION-001      | 공격속도와 Flow 구간 길이 연동              |
| INTENT-ACTION-STATE-001      | Guard/Evade/Fortify도 기존 Action 구조 사용 |
| INTENT-BODY-FACING-001       | Guard Arc / Rear Attack 판정 재사용         |
| INTENT-WORLD-CLOCK-001       | Perfect/Break/Status Duration 기준 시간     |
| INTENT-ATTRIBUTE-OBSERVE-001 | 신규 전투 속성 전체 관찰 가능               |

## 20.2 Changed

INTENT-STRIKE-DAMAGE-001은 “고정 피해량이 곧 최종 피해”에서 “고정
baseDamage + 결정론적 배율”로 의미가 확장된다. 난수는 여전히 사용하지
않는다.

INTENT-SWING-IMPACT-001 / INTENT-HIT-REACTION-001은 타격 결과별로 반응을
분리하고 Exposed, Guard Break, Broken 상태를 추가한다.

INTENT-STRIKE-OBSERVE-001은 피해 숫자뿐 아니라 Attack Type, Armor Type,
Flow, Defense, Conditions, Break 원인을 함께 공개하도록 확장한다.

# 21. Implementation Roadmap

기능을 한꺼번에 붙이면 수치 문제와 손맛 문제가 섞인다. 아래 순서로 한
층씩 검증한다.

| **Phase**        | **구현 범위**                        | **검증 질문**                         |
|------------------|--------------------------------------|---------------------------------------|
| 1\. Defense Core | Defense + Guard + Impact             | 막는 행위가 실제 선택이 되는가?       |
| 2\. Timing       | Perfect Guard + Exposed + Counter    | 방어 성공이 공격권으로 체감되는가?    |
| 3\. Break        | Break + Broken + Burst Window        | 전투에 명확한 폭발 리듬이 생기는가?   |
| 4\. Flow         | Offense/Defense Flow + Skill Profile | 강공의 리스크가 읽히고 대응 가능한가? |
| 5\. Matchup      | Attack Type × Armor Type             | 무기/스킬 선택이 달라지는가?          |
| 6\. Vow          | Restriction + Risk + Consequence     | 강한 스킬이 무료로 강하지 않은가?     |

## 21.1 최소 플레이테스트 시나리오

- 동일 스탯 1v1: Guard 없이 맞딜했을 때 TTK 기준 확보

- Guard 반복: CP가 소모되며 결국 Guard Break가 발생하는지 확인

- Perfect Guard 반복: 숙련자가 공격권을 실제로 되찾는지 확인

- Break 루프: 기본 압박 → Counter → Broken → Burst가 자연스럽게
  발생하는지 확인

- Flow 읽기: 강공 ACTIVE의 방어 취약 구간을 상대가 학습 가능한지 확인

- Vow: 보상보다 실패 리스크가 체감상 충분히 큰지 확인

- 관찰성: CombatResult만 보고 최종 피해 원인을 완전히 재구성할 수 있는지
  확인

# 22. Out of Scope — C008

이번 Cycle에서는 시스템 범위를 의도적으로 제한한다. 다음 항목은 후속
확장 후보이며 C008 검증 전에는 추가하지 않는다.

| **제외 항목**             | **이유**                                |
|---------------------------|-----------------------------------------|
| 명중률 / 회피율           | 결정론적 충돌 철학 유지                 |
| 확률 Critical / 피해 난수 | 큰 피해의 원인을 플레이어 행동으로 유지 |
| 원소 속성 / 상태이상 축적 | 공격/방어 Core 검증과 분리              |
| Nen 계통 친화도           | Vow/Flow 검증 후 성장 시스템에서 확장   |
| Skill Tree / 장비 등급    | 전투 규칙 안정화 이후                   |
| PvP 보정                  | 기본 규칙 검증 이후                     |
| Boss Super Armor / Threat | PvE encounter layer에서 별도 설계       |
| Ultimate Gauge            | CP 경제를 먼저 검증                     |

# 23. Combat Philosophy

> **R0 Philosophy**
> Random does not create the critical moment. The player does.

강한 결과가 발생했다면 반드시 설명 가능한 이유가 존재해야 한다.

- 좋은 위치를 잡았다.

- 올바른 공격 타입을 골랐다.

- 상대 공격을 읽었다.

- Perfect Guard에 성공했다.

- 상대가 공격에 힘을 몰아 몸을 연 순간을 때렸다.

- Break를 누적했다.

- CP를 아꼈다.

- 위험한 제약을 받아들였고 실제로 완수했다.

> **최종 전투 루프**
> 기본 공격으로 CP를 모으고 → 공격과 방어로 서로의 자원을 압박하고 → 상대가 몸을 여는 순간을 읽고 → Guard/Perfect Guard/Counter로 공격권을 뒤집고 → Break로 방어를 무너뜨리고 → BROKEN 동안 모아 둔 CP와 Vow를 한꺼번에 쏟아붓는다.

# Appendix A. Reference Lens

본 기획은 아래 작품/게임의 특정 수치나 콘텐츠를 복제하기보다, 전투 설계
원리를 추출해 현재 시스템의 결정론적 구조에 맞게 재해석한다.

| **Reference**         | **차용한 설계 원리**                                             |
|-----------------------|------------------------------------------------------------------|
| Warcraft III          | 공격 타입 × 방어 타입 상성으로 선택을 만든다.                    |
| Action MMORPGs        | Guard / Counter / Stagger·Break 성공이 공격 기회로 전환된다.     |
| Hunter × Hunter — Nen | 공방 집중, 집중의 대가, 지속 방어 비용, 제약과 서약의 위험-보상. |

# Appendix B. Terminology

| **용어**    | **정의**                                                |
|-------------|---------------------------------------------------------|
| Flow        | 현재 전투력을 공격/방어 어디에 배분하는지 나타내는 상태 |
| Impact      | Guard 시 CP 소모를 결정하는 스킬 압력 값                |
| BreakPower  | 대상 균형을 무너뜨리는 스킬 값                          |
| Exposed     | Counter 기회를 제공하는 취약 상태                       |
| Broken      | Break Max 도달 후 발생하는 짧은 방어 붕괴 상태          |
| Condition   | Counter/WeakPoint/Rear/Broken 등 명시적 추가 피해 원인  |
| Restriction | 스킬 사용을 제한하는 세계 판정 가능 조건                |
| Vow         | Restriction/실패 위험을 추가 위력으로 교환하는 규칙     |
