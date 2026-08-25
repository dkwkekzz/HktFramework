# SYSTEM DESIGN DOCUMENT

## Item System — 세계 자원이 사용 가능한 형태가 되는 방식

| **문서 버전** | R1 |
|---|---|
| **상태** | Human 원안 (레이아웃 정리만 — 내용은 원문 그대로) |
| **선행** | [Design-Item-System-R0.md](Design-Item-System-R0.md) (정의 · 소지 · 사용 · 장착 · 제작 · 세계 개체화 여섯 층) |
| **범위** | Resource 와 Property 가 Form · Mechanism 으로 결속되어 Actor 가 쓸 수 있는 형태가 되기까지 |
| **관계** | 네 문서가 어떻게 한 사슬인지는 [Design-Resource-Item-Chain-R0.md](Design-Resource-Item-Chain-R0.md) 가 소유한다 |

---

### 0. 핵심 정의

> **Item은 Resource와 Property를 특정 Form과 Mechanism으로 결속하여 Actor가 운반·사용·장착·설치할 수 있게 만든 비-Actor 세계 존재다.**

아이템은 종류 이름으로 능력을 결정하지 않는다.

기존 시스템의 구조 그대로:

```text
IP Property
↓
IT Item
↓
IM Mechanism
↓
MC Capability
```

를 따른다.

---

# 1. Item은 Actor가 아니다

아이템은:

```text
상태를 가진다.
조건에 반응한다.
Capability를 제공할 수 있다.
Skill을 발동할 수 있다.
변화할 수 있다.
파괴될 수 있다.
```

그러나:

```text
목적이 없다.
세계에 대한 Belief가 없다.
Possibility를 평가하지 않는다.
행동을 선택하지 않는다.
```

따라서 자동 발동 장비도:

```text
Trigger
→ Mechanism
→ Effect
```

일 뿐 Actor 행동 결정이 아니다.

---

# 2. Item Definition의 네 층

모든 복합 아이템은 다음 네 층으로 설명할 수 있어야 한다.

```text
FORM
무엇으로 사용되는가

MATERIAL
무엇으로 만들어졌는가

MECHANISM
어떤 세계 상태 변환을 수행하는가

MODIFICATION
기본 Mechanism을 어떻게 특화했는가
```

예:

```text
Form
Long Sword

Material
열기억철
심박목

Mechanism
Heat Storage
Heat Release

Modification
Guard 직후 Heat Release 효율 증가
```

---

# 3. Item Role

고정된 `Weapon / Armor / Potion` enum이 모든 규칙을 결정하게 하지 않는다.

ItemDefinition은 여러 Role을 선언할 수 있다.

```text
material
consumable
equipment
tool
container
component
deployable
key
information
```

Role은 UI와 가능한 Interaction을 정리하기 위한 의미다.

실제 Capability는 Mechanism/grants를 통해 계산한다.

---

# 4. 보유와 적용

기존 Item System의 중요한 원칙을 그대로 유지한다.

```text
가지고 있다
≠
적용되고 있다
```

아이템은 다음 상태 중 하나일 수 있다.

```text
Inventory
Equipped
World
Container
Installed
Consumed
Destroyed
```

장착된 Item만 장착 효과를 제공하고, 설치된 Item만 설치형 Mechanism을 작동시킨다.

기존 설계 역시 보유와 적용을 분리해야 능력을 세계 안에서 획득할 수 있다고 정의한다.

---

# 5. Item Interaction

모든 Item Interaction은 동일한 인터페이스를 사용한다.

```text
CanInteract
Reason
Action
Result
```

지원 기본 행동:

| 행동        | 의미               |
| --------- | ---------------- |
| PICK_UP   | 세계 → Inventory   |
| DROP      | Inventory → 세계   |
| USE       | Item Effect 사용   |
| EQUIP     | Item 적용          |
| UNEQUIP   | 적용 해제            |
| INSTALL   | 세계 구조로 설치        |
| REMOVE    | 설치 회수            |
| PROCESS   | Resource/Item 가공 |
| CRAFT     | 새 Item 제작        |
| REPAIR    | 구조 복원            |
| REFINE    | 품질 개선            |
| MODIFY    | Mechanism 추가·변경  |
| REFORGE   | 기존 Item 재제작      |
| DISMANTLE | Resource로 해체     |
| DESTROY   | Item 존재 종료       |

화면과 실제 실행은 반드시 동일한 `CanInteract` 결과를 사용한다.

---

# 6. Item Use

사용은 정식 World Action이다.

```text
Request
↓
Target validation
↓
Capability validation
↓
Item state validation
↓
Action start
↓
Complete
↓
Effect
↓
Consumption / State Change
```

지원:

```text
즉시 사용
사용 시간
중단
Self Target
Actor Target
World Target
Cooldown
Charge 소비
Item 소비
```

기존 Item System의 사용 행동과 대상·중단·재사용 제한 구조를 그대로 유지한다.

---

# 7. Item Skill

아이템 Skill은 ItemDefinition 이름 자체에 붙지 않는다.

```text
Material Property
↓
Mechanism
↓
grants
↓
Skill / Capability
```

### ACTIVE

사용자가 명령한다.

```text
Heat Release
```

### REACTIVE

세계 Event에 반응한다.

```text
Guard Success
→ 충격 저장
```

### SUSTAINED

적용 중 유지된다.

```text
균압 갑옷
→ Pressure Resistance
```

### CHARGED

선행 상태가 필요하다.

```text
Stored Heat
→ Release
```

### CONTEXTUAL

환경이 조건이다.

```text
거울기억사막
+
기억유리
→ Memory Reading 강화
```

---

# 8. Equipment

장비는 Body에 존재하는 Slot에 적용된다.

Item System은:

```text
장착 가능 여부
장착/해제
효과 적용
grants 계산
```

까지만 소유한다.

`6개의 슬롯` 같은 실제 플레이 슬롯 구성은 Inventory/Equipment Design이 소유한다.

장착 시:

```text
Body Base Capability
+
Equipment Grants
+
Class Grants
+
Condition Grants
=
Effective Capability
```

---

# 9. Crafting

제작의 기본 정의:

```text
Inputs
+
Process
+
Context
↓
Output
```

단순 Recipe는 이 Transformation의 가장 간단한 형태다.

예:

```text
열기억철
+
Blade Form
+
Forge Process
↓
열기억철 검
```

제작 성공은 하나의 원자적 변화다.

```text
Input 감소
+
Output 생성
```

둘 중 하나만 발생할 수 없다.

기존 문서 역시 재료 감소와 결과물 생성을 한 단위로 요구한다.

---

# 10. World Item

Item은 Actor의 Inventory 밖에도 존재한다.

```text
WorldItem:
    position
    content
    ownership
    interaction
```

Item은 세계에서:

```text
놓인다.
떨어진다.
운반된다.
보관된다.
설치된다.
줍힌다.
소멸한다.
```

기존 World Item 설계가 정의한 양방향 이동 원칙을 그대로 사용한다.

---

# 11. Loot

적을 죽였다는 이유로 임의의 ItemDefinition을 생성하지 않는다.

Loot는 실제 출처를 가진다.

```text
Actor가 보유하던 물건
Actor의 기관
Actor의 사체 Material
Actor의 분비물
Actor가 운반하던 Resource
```

따라서:

```text
Creature
→ Body State
→ Resource Source
→ Harvest
```

또는:

```text
Creature Inventory
→ Loot Container
```

로 처리한다.

---

# 12. ItemDefinition

```yaml
ItemDefinition:
  identity:
    id:
    name:
    form:
    roles:
  master:
    item_node_id:
  composition:
    fixed_properties:
    allowed_material_categories:
    component_slots:
  actions:
    usages:
    equip_requirements:
    install_requirements:
  mechanisms:
    default_mechanisms:
    supported_mechanisms:
  stacking:
    stackable:
    max_stack:
  instance_policy:
    requires_instance_when:
  crafting:
    valid_processes:
  observation:
    display_fields:
```

---

# 13. Item ViewModel

World가 최소 다음을 계산한다.

```yaml
ItemView:
  identity:
    name:
    form:
  quantity:
  location:
  state_summary:
  granted_capabilities:
  granted_skills:
  interactions:
    - action:
      available:
      reason:
  provenance_summary:
```

UI가 ItemDefinition을 조회해 규칙을 다시 해석해서는 안 된다.

기존 문서 역시 소지품 관찰에 아이템·수량·가능 행동·불가 이유를 모두 싣도록 요구한다.

---

# 14. Item System 완료 조건

```text
새 ItemDefinition 추가
→ 기존 규칙 수정 없음

Resource 획득
→ 제작 가능 여부 변화

제작
→ 재료 감소 + Item 생성

장착
→ Capability 변화

해제
→ 정확히 원복

사용
→ Item 상태 또는 수량 변화

버리기
→ World Item 생성

다른 Actor가 줍기
→ Ownership 이동

파괴
→ 더 이상 Item Capability 제공 불가
```
