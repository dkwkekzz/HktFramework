# SYSTEM DESIGN DOCUMENT

## Item Lifecycle & Progression — 아이템이 태어나고 성장하고 사라지는 방식

| **문서 버전** | R0 |
|---|---|
| **상태** | Human 원안 (레이아웃 정리만 — 내용은 원문 그대로) |
| **선행** | [Design-Item-Instance-State-R0.md](Design-Item-Instance-State-R0.md) · [Design-Item-System-R1.md](Design-Item-System-R1.md) · [Design-Resource-Catalog-R0.md](Design-Resource-Catalog-R0.md) |
| **범위** | Formation 부터 Destroyed·Residue 까지의 순환과 성장의 여섯 축 · Deep Item Cycle 구현 순서 |
| **관계** | 네 문서가 어떻게 한 사슬인지는 [Design-Resource-Item-Chain-R0.md](Design-Resource-Item-Chain-R0.md) 가 소유한다 |

---

### 0. 핵심 명제

> **아이템 성장은 Item Level을 올리는 것이 아니라, 세계의 더 깊은 Resource와 Process를 이용해 Item이 제공하는 가능성을 확장하는 과정이다.**

따라서 성장의 기본 형태는:

```text
탐험
↓
원천 발견
↓
Resource 획득
↓
가공
↓
제작
↓
사용
↓
개조
↓
더 깊은 탐험
↓
새 Resource
↓
기존 Item 성장
```

이다.

현재 지형 설계 역시 한 지역의 자원이 다른 지역의 탐험과 생활을 변화시키도록 구성되어 있다.

---

# 1. 전체 Lifecycle

```text
FORMATION
세계에서 Resource Source 생성
↓
HARVEST
Resource 분리
↓
PROCESS
Material 생성
↓
CRAFT
Item 생성
↓
ACQUIRE
Actor 소유
↓
USE
Item 상태 변화
↓
REFINE / MODIFY / TRANSFORM
Item 성장
↓
REPAIR / REFORGE
수명 연장 또는 구조 변화
↓
BROKEN
↓
REPAIR
또는
DISMANTLE
또는
OVERDRIVE
↓
DESTROYED
↓
RESIDUE / RESOURCE
```

완전한 선형 구조가 아니다.

여러 지점에서 다시 순환한다.

---

# 2. 성장의 여섯 축

## 2.1 Resource Progression

더 깊은 세계에서 더 특이한 Resource를 얻는다.

```text
일반 광석
↓
Property Material
↓
고밀도 Property Material
↓
복합 / 심층 Material
```

단순 희귀도 상승이 아니다.

**할 수 있는 일이 달라진다.**

---

## 2.2 Processing Progression

같은 Resource를 더 잘 다룬다.

```text
Raw
↓
Refined
↓
Stabilized
↓
Specialized
```

예:

```text
열기억철

일반 정련
→ 열 저장

고급 결정 정렬
→ 열 손실 감소

심층 저온 단조
→ 극단적 Thermal State 유지
```

---

## 2.3 Structural Progression

Form 자체가 발전한다.

```text
단순 Blade
↓
복합 Blade
↓
Mechanism 수용 구조
↓
다중 Mechanism 구조
```

---

## 2.4 Mechanism Progression

새로운 Capability를 획득한다.

```text
Heat Storage
↓
Heat Release
↓
Directional Release
↓
Conditional Overdrive
```

---

## 2.5 Specialization Progression

범용성을 포기하고 조건을 좁혀 특정 상황에서 강해진다.

```text
일반 방출
```

에서:

```text
완전 Guard 직후에만 가능
+
StoredHeat 전량 소모
↓
극대 방출
```

로 변할 수 있다.

강력한 Item일수록:

```text
Activation Condition
Cost
Risk
Context
```

를 더 강하게 설계할 수 있다.

---

## 2.6 Provenance Progression

하나의 Item이 여러 사건을 거치며 고유한 Instance가 된다.

```text
제작
↓
개조
↓
파손
↓
수리
↓
환경 변화
↓
재제작
```

Player는 반드시 새 장비를 얻을 때마다 기존 장비를 버릴 필요가 없다.

---

# 3. Refinement

Refinement는 기존 Item의 기본 목적을 유지하면서 품질을 개선한다.

세 종류가 있다.

### MATERIAL

```text
불순물 제거
결정 배열
밀도 개선
Property 안정화
```

### STRUCTURE

```text
균형
관절
결합부
충격 분산
밀폐
```

### MECHANISM

```text
손실 감소
저장량 증가
안정성 증가
제어성 개선
```

Refinement는 원칙적으로 기존 Item Identity를 유지한다.

---

# 4. Modification

Modification은 새로운 기능을 부착한다.

```text
Item
+
Component
+
Installation Process
↓
Modified Item
```

예:

```text
열기억철 검
+
충격석
↓
Guard 충격 저장
```

Modification은 Mechanism Capacity를 사용한다.

---

# 5. Imprint

Imprint는 외부 Property를 Item 구조에 직접 결속한다.

```text
Item
+
Property Source
+
Binding Process
↓
Imprint
```

예:

```text
열기억철 검
+
공명결정
↓
Blade Resonance
```

Modification이 장치를 설치하는 개념이라면 Imprint는 **소재의 Property 자체를 구조에 남기는 것**에 가깝다.

---

# 6. Environmental Transformation

일부 성장은 제작 UI에서 수행할 수 없다.

특정 환경 자체가 Process가 된다.

예:

```text
열기억철 검
+
백야철빙원 심층 열흡수 공동
+
장시간 노출
↓
극저온 결정 구조
```

또는:

```text
기억검
+
거울기억사막의 강한 기록 현상
↓
Memory Capacity 변화
```

이 구조를 통해 탐험과 강화가 직접 연결된다.

---

# 7. Charge / Discharge

Item은 세계 상태를 저장할 수 있다.

```text
World State
↓
Absorb
↓
Item Property State
↓
Release
↓
World State Change
```

예:

### 열기억철

```text
Heat
→ StoredHeat
→ Heat Release
```

### 충격석

```text
Impact
→ StoredImpulse
→ Counter
```

### 숨결석

```text
Air
→ StoredAir
→ Breath Field
```

### 기억유리

```text
Observation
→ RecordedInformation
→ Replay
```

---

# 8. Repair

Repair는 Damage 원인을 역으로 해결한다.

```text
Structural Damage
→ Material + Repair Capability

Property Contamination
→ Purification

Mechanism Misalignment
→ Recalibration

Overpressure
→ Controlled Discharge
```

따라서 수리에 필요한 Resource와 Skill도 장비마다 달라진다.

---

# 9. Reforge

Reforge는 기존 Item을 새로운 Form으로 다시 만든다.

```text
Old Item
↓
Disassembly
↓
Reusable Material / Mechanism
↓
New Process
↓
New Item Instance
```

계승 가능한 것:

```text
일부 Material
일부 Mechanism
일부 Imprint
일부 Provenance
```

계승할 수 없는 것:

```text
파괴된 구조
소모된 Material
새 Form과 호환되지 않는 Mechanism
```

---

# 10. Dismantle

Item을 Resource로 되돌린다.

```text
Item
↓
Dismantle
↓
Material
+
Component
+
Mechanism Core
+
Residue
```

100% 복구하지 않는다.

그렇지 않으면 제작과 해체가 무한 순환한다.

회수율과 실제 양은 Cycle이 결정한다.

---

# 11. Broken

Integrity가 임계 이하가 되면 Item은 BROKEN이 된다.

```text
Item 존재 O
Capability 정상 제공 X
```

예:

```text
숨결석 용기
→ 누출

기억검
→ 기록 중첩

열기억철 검
→ 저장 열 손실
```

파손 효과는 Item의 Property에서 자연스럽게 파생해야 한다.

---

# 12. Destroyed

DESTROYED는 단순 삭제가 아니다.

```text
Item
↓
Destruction Rule
↓
Residue / Component / Resource
```

예:

```text
열기억철 검
→ 열기억철 파편

충격석 방패
→ 균열된 충격결정

생체 장비
→ 죽은 생체조직
```

---

# 13. Overdrive

Player가 의도적으로 Item의 구조까지 소비할 수 있다.

```text
Stored Property
+
Remaining Integrity
↓
Extreme Effect
↓
BROKEN 또는 DESTROYED
```

예:

### 충격석 방패

```text
저장된 충격
+
결정 구조 자체
↓
대규모 충격 방출
↓
방패 파괴
```

### 숨결석

```text
저장 공기
+
Container Integrity
↓
순간 압력 폭발
↓
용기 파괴
```

이것은 `파괴될 수 있음`을 단순 유지비가 아니라 **전투 선택**으로 바꾼다.

---

# 14. Item Mechanism Constraint

강한 Mechanism은 조건으로 특화할 수 있다.

형식:

```yaml
Mechanism:
  grants:
  activation:
    requirements:
  cost:
  risk:
  context:
  failure:
```

예:

```text
백야방출

Requirements
StoredHeat >= threshold

Cost
StoredHeat 전량

Context
장착 상태

Risk
Thermal Stress 증가
```

또는:

```text
완전 Guard 성공 후 짧은 시간 동안만 발동 가능
```

이 방식이면 숫자만 큰 Item보다 **플레이 방식 자체가 다른 Item Build**를 만들 수 있다.

---

# 15. Item Build

최종 Item Build는 다음 다섯 요소의 조합이다.

```text
FORM
+
MATERIAL
+
MECHANISM
+
MODIFICATION
+
CONSTRAINT
```

예:

```text
대검
+
열기억철 / 심박목
+
Heat Storage
Heat Release
+
충격석 Modification
+
Perfect Guard 후에만
저장 충격 → Heat 전환
```

같은 `대검`이라는 Form에서도 전혀 다른 Gameplay가 나온다.

---

# 16. Cross-Terrain Progression

아이템 성장의 핵심은 하나의 지형에서 끝나지 않는다.

예:

```text
왕관수계 분지
↓
기본 장비

백야철빙원
↓
열기억철
↓
열 관리 장비

무호흡해
↓
숨결석
↓
호흡 장비

울림석림
↓
공명결정
↓
신호 / 진동 Mechanism

거울기억사막
↓
기억유리
↓
관찰 기록 Mechanism
```

결국 하나의 장비가 여러 지형의 흔적을 가지게 된다.

---

# 17. 대표 성장 예시 — 백야의 포식검

## 1단계

```text
열기억철
+
심박목
↓
열기억철 장검
```

Capability:

```text
Heat Storage
```

---

## 2단계

고급 단조.

```text
Thermal Stability 증가
```

---

## 3단계

충격석 Modification.

```text
Guard Impact
↓
StoredImpulse
```

---

## 4단계

Mechanism 결합.

```text
StoredImpulse
↓
Heat Conversion
```

---

## 5단계

심층 백야철빙원 Environmental Transformation.

```text
고밀도 Thermal Structure
```

새 Skill:

```text
백야방출
```

---

## 6단계

Constraint 특화.

```text
Perfect Guard 직후에만 사용 가능
+
모든 StoredHeat 소비
↓
대규모 공격
```

이것이 단순:

```text
검 +1
검 +2
검 +3
```

와 다른 베이라 Item Progression이다.

---

# 18. 회복 아이템 계통

현재 Item System에서 회복 Capability는 원천 부재 때문에 아직 닫히지 않았다고 명시되어 있다.

Resource Catalog가 생기면서 이 경로를 닫을 수 있다.

```text
흡명수림
↓
생체 Network
↓
혈수지
↓
생체 활력 저장 Property
↓
정제
↓
회복 Item
↓
IM-BIOLOGICAL-RESTORATION
↓
MC-RESTORE-BIOLOGICAL-STATE
```

중요한 것은:

```text
Potion
→ HP +100
```

이 먼저 존재하는 것이 아니다.

```text
생체 상태를 저장하는 Resource
↓
그 상태를 다른 생명체에 다시 전달하는 Mechanism
↓
회복
```

의 순서다.

---

# 19. Item Progression과 경제

장비가 영원히 누적만 되면 Resource 가치가 사라진다.

따라서 자연적인 Item Sink를 사용한다.

```text
사용
→ Material 소모

Repair
→ Resource 소모

Modification
→ Component 소모

Reforge
→ 일부 Material 손실

Dismantle
→ 일부만 회수

Overdrive
→ Item 파괴
```

즉 경제 Sink도 별도의 인위적인 삭제 규칙보다 **Item Lifecycle 자체**에서 나온다.

---

# 20. Lifecycle Event

```text
RESOURCE_FORMED
RESOURCE_HARVESTED
RESOURCE_PROCESSED
ITEM_CRAFTED
ITEM_ACQUIRED
ITEM_EQUIPPED
ITEM_USED
ITEM_CHARGED
ITEM_DISCHARGED
ITEM_DAMAGED
ITEM_BROKEN
ITEM_REPAIRED
ITEM_REFINED
ITEM_MODIFIED
ITEM_IMPRINTED
ITEM_TRANSFORMED
ITEM_REFORGED
ITEM_DISMANTLED
ITEM_DESTROYED
```

각 Event는:

```text
Before State
Event Cause
After State
```

를 관찰 가능하게 남긴다.

---

# 21. Deep Item Cycle 구현 순서

기존 Item System의 기본 네 Cycle 이후 다음 순서로 확장한다. 기존 문서의 기본 단계는 사용 → 장착 → 제작 → 세계 아이템 순서로 정의되어 있다.

| Cycle | 목표                           | 플레이 결과                         |
| ----- | ---------------------------- | ------------------------------ |
| 5     | Resource Origin              | 실제 식물/광맥에서 서로 다른 방법으로 자원을 얻는다  |
| 6     | Item Instance                | 동일 장비 두 개가 독립된 상태를 가진다         |
| 7     | Integrity / Repair           | 전투로 장비가 손상되고 세계 자원으로 복구한다      |
| 8     | Refinement                   | 기존 장비를 버리지 않고 성능·구조를 개선한다      |
| 9     | Mechanism Modification       | 다른 지형 자원을 장비에 결합해 새 Skill을 얻는다 |
| 10    | Environmental Transformation | 특정 지형에서만 가능한 장비 변환을 경험한다       |
| 11    | Reforge / Dismantle          | 기존 장비의 일부를 계승하여 새로운 장비를 만든다    |
| 12    | Destruction / Overdrive      | 장비 파괴 자체가 전략적 선택이 된다           |

각 Cycle은 하나의 플레이 결과로 검증한다.

---

# 22. 최종 통합 검증

전체 Item Deep System의 대표 시나리오는 하나로 닫을 수 있다.

```text
Player가 백야철빙원에서
광맥의 열 흡수 현상을 관찰한다.
↓
정밀 채굴법을 선택한다.
↓
열기억철 Resource를 얻는다.
↓
Resource에 광맥 출처가 남는다.
↓
왕관수계 분지에서
열기억철 검을 제작한다.
↓
Item Instance 생성.
↓
전투에서 사용하며
StoredHeat와 Integrity가 변화한다.
↓
울림석림에서 충격석을 얻는다.
↓
기존 검에 충격석 Mechanism을 설치한다.
↓
새로운 Skill을 얻는다.
↓
검이 심하게 파손된다.
↓
Resource를 사용해 수리한다.
↓
더 깊은 백야철빙원에서
Environmental Transformation을 수행한다.
↓
기존 검이 새로운 구조로 변화한다.
↓
전투에서 Overdrive를 선택한다.
↓
검이 파괴된다.
↓
남은 Material과 Mechanism Core를 회수한다.
↓
그것을 다음 Item의 제작에 사용한다.
```

이 흐름이 성립하면 아이템은 더 이상 **전투력 숫자를 올리는 장비 목록**이 아니다.
