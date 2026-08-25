# SYSTEM DESIGN DOCUMENT

## Item Instance State — 같은 종류의 아이템이 서로 달라지는 방식

| **문서 버전** | R0 |
|---|---|
| **상태** | Human 원안 (레이아웃 정리만 — 내용은 원문 그대로) |
| **선행** | [Design-Item-System-R1.md](Design-Item-System-R1.md) (Definition / Instance 분리) |
| **범위** | 같은 ItemDefinition 에서 태어난 두 Item 이 서로 다른 개체가 되는 이유와 그 상태 |
| **관계** | 네 문서가 어떻게 한 사슬인지는 [Design-Item-Chain-R0.md](Design-Item-Chain-R0.md) 가 소유한다 |

---

### 0. 목적

이 문서는:

> **같은 ItemDefinition에서 태어난 두 Item이 어떤 이유로 서로 다른 개체가 되는가**

만을 정의한다.

---

# 1. Instance 생성 기준

모든 아이템을 개체화하지 않는다.

다음 중 하나라도 필요해지는 순간 Instance로 전환한다.

```text
내구도
개별 소재 구성
개별 강화
개조
각인
Charge
귀속
제작자
고유 History
상태 오염
개별 소유권
```

이 기준은 기존 Item System에서 정의된 Instance 전환 원칙을 그대로 따른다.

예:

```text
돌 × 30
→ Stack

회복약 × 5
→ Stack
```

하지만:

```text
열기억철 검 A
Integrity 81%

열기억철 검 B
Integrity 43%
```

는 별도 Instance다.

---

# 2. Instance의 필수 조건

Instance는 반드시 다음 질문에 답해야 한다.

```text
무엇인가?
어디에서 왔는가?
지금 어디에 있는가?
누가 가지고 있는가?
지금 어떤 상태인가?
어떤 Mechanism을 가지고 있는가?
```

`UUID`만 있다고 Instance가 되는 것이 아니다.

---

# 3. Universal State

모든 ItemInstance가 공통으로 가지는 최소 상태다.

```yaml
ItemInstance:
  identity:
    instance_id:
    definition_id:
  provenance:
    created_by_event:
    source_resources:
    creator:
    creation_location:
  location:
    state:
    holder_id:
    container_id:
    world_position:
  lifecycle:
    created_at:
    lifecycle_state:
```

---

# 4. Composition State

복합 Item은 실제 구성 소재를 기록한다.

```yaml
composition:
  materials:
    - resource_definition:
      amount:
      source_reference:
  components:
    - component_instance:
  mechanisms:
    - mechanism_id:
  modifications:
    - modification_id:
```

같은 장검이라도:

```text
열기억철 + 심박목
고정암 + 심박목
열기억철 + 충격석
```

이면 완전히 다른 Capability 조합을 가질 수 있다.

---

# 5. Integrity State

내구도는 Item 구조가 원래 Mechanism을 유지할 수 있는 상태를 나타낸다.

단계:

```text
STABLE
WORN
DAMAGED
CRITICAL
BROKEN
DESTROYED
```

`Integrity` 수치는 Cycle이 소유한다.

Master는 상태의 의미만 정의한다.

## BROKEN

Item은 여전히 존재한다.

그러나:

```text
일부 Capability 비활성
일부 Skill 사용 불가
누출
오작동
```

등이 발생할 수 있다.

## DESTROYED

기존 ItemInstance가 더 이상 존재하지 않는다.

필요하다면 새로운 Resource/Residue가 생성된다.

---

# 6. Property State Module

아이템마다 동일한 상태를 강제하지 않는다.

Mechanism이 요구하는 상태 Module만 가진다.

## THERMAL

```yaml
thermal:
  stored_heat:
  saturation:
  temperature:
```

## PRESSURE

```yaml
pressure:
  stored_air:
  internal_pressure:
```

## IMPULSE

```yaml
impulse:
  stored_impulse:
  stress:
```

## INFORMATION

```yaml
information:
  records:
  density:
  overlap:
```

## BIOLOGICAL

```yaml
biological:
  vitality:
  compatibility:
  contamination:
```

---

# 7. Refinement State

강화 수치를 단일 `EnhancementLevel`로만 표현하지 않는다.

```yaml
refinement:
  material:
    purity:
    stability:
  structure:
    precision:
    reinforcement:
  mechanism:
    efficiency:
    stability:
```

각 축의 실제 숫자는 Cycle이 결정한다.

---

# 8. Modification / Imprint State

아이템에 후천적으로 부여된 특성을 저장한다.

```yaml
modifications:
  - id:
    source_property:
    mechanism:
    installation_event:
    conditions:
```

예:

```text
충격석 각인
→ Guard 충격 저장

공명결정 각인
→ Blade Resonance

균압석 각인
→ Pressure fluctuation 완충
```

---

# 9. Mechanism Capacity

Item이 Mechanism을 무한히 갖지 못하도록 구조적 용량을 둔다.

```text
Item Structure
↓
Mechanism Capacity
```

Capacity는 단순 Slot 수일 필요가 없다.

Mechanism은:

```text
공간
구조 강도
에너지
Property Compatibility
```

를 요구할 수 있다.

따라서:

```text
Mechanism A + Mechanism B
```

가 각각 설치 가능하더라도 함께 설치할 수 없을 수 있다.

---

# 10. Property Conflict

조합은 항상 강화가 아니다.

예:

```text
열흡수 Material
+
완전 단열 Material
```

은 서로 충돌할 수 있다.

또는:

```text
공명 증폭
+
진동 차단
```

도 동시에 최대 효과를 낼 수 없다.

ItemInstance는 현재 활성 Conflict를 관찰 가능하게 가진다.

```yaml
conflicts:
  - mechanism_a:
    mechanism_b:
    result:
```

---

# 11. Ownership / Binding

소유와 귀속을 분리한다.

```text
Ownership
현재 누가 가지고 있는가

Binding
누가 사용할 수 있는가
```

예:

```text
A가 소유
B에게 귀속
```

같은 상태도 가능하다.

귀속은 임의 MMO 규칙이 아니라 세계적 원인이 있을 때만 사용한다.

예:

```text
생체 장비가 특정 생체 신호와 결합됨
```

---

# 12. Provenance

모든 중요한 Instance는 출처를 추적할 수 있다.

```text
Resource Source
↓
Harvest Event
↓
Processing Event
↓
Craft Event
↓
Item Instance
```

예:

```text
백야철빙원 제3심층광맥
→ 정밀 절단
→ 열기억철
→ 왕관수계 분지 장인 아렌
→ 열기억철 장검 #...
```

---

# 13. History

History는 모든 Event를 무한 기록하지 않는다.

**현재 또는 미래 Gameplay에 의미가 있는 Event만** 남긴다.

예:

```text
제작
재제작
중요 각인
BROKEN
특수 환경 변환
고유 Skill 획득
주요 소유권 이전
```

History 자체가 Mechanism의 조건이 될 수도 있다.

예:

```text
특정 Actor의 공격을 실제로 10회 기록한 기억검
```

그러나 Item이 학습하거나 의지를 가진 것은 아니다.

세계가 Item에 남긴 상태다.

---

# 14. Instance State Transition

모든 변경은 Event를 통해 발생한다.

```text
State Before
+
World Event
+
Rule
↓
State After
```

직접 필드 수정은 금지한다.

예:

```text
ITEM_DAMAGED
ITEM_REPAIRED
ITEM_CHARGED
ITEM_DISCHARGED
ITEM_REFINED
ITEM_MODIFIED
ITEM_REFORGED
```

---

# 15. ItemInstanceView

```yaml
ItemInstanceView:
  identity:
    name:
    instance_id:
  origin:
    source_summary:
    creator:
  composition:
    materials:
    modifications:
  condition:
    integrity_state:
    important_property_states:
  capability:
    granted_capabilities:
    granted_skills:
  constraints:
    activation_requirements:
    conflicts:
  interactions:
    available_actions:
  history:
    significant_entries:
```

---

# 16. 완료 기준

Instance System은 다음 시나리오가 가능하면 완료다.

```text
동일한 검 두 자루 제작
↓
A만 전투에서 사용
↓
A Integrity 감소
↓
B는 그대로
↓
A에 충격석 각인
↓
A에만 새 Mechanism 발생
↓
A를 다른 Actor에게 넘김
↓
Ownership 변화
↓
B와 모든 상태가 독립적으로 유지
```
