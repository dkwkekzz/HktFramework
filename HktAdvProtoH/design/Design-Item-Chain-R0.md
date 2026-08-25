# SYSTEM DESIGN DOCUMENT

## Item Chain — Resource 에서 Player Progression 까지, 문서 사슬 총괄

| **문서 버전** | R0 |
|---|---|
| **상태** | 기초 기획 초안 (Agent 작성 — Human 승인·개정 대기) |
| **범위** | 자원·아이템 계열 문서들의 **사이** — 전체 흐름, 각 문서의 소유 경계, 층과 층이 넘겨주는 것 |
| **소유하지 않는 것** | 어느 층의 내용도 소유하지 않는다. 이 문서를 고쳐서 세계가 바뀌지 않는다 |
| **총괄 대상** | `Design-Resource-Catalog-R0.md` · `Design-Item-System-R1.md` · `Design-Item-Instance-State-R0.md` · `Design-Item-Lifecycle-Progression-R0.md` |

---

# 0. 이 문서가 있는 이유

각 설계 문서는 **자기 층만** 답해야 한다. 자원 문서는 "자원이 무엇으로 사용 가능한가" 까지
답하고 멈추고, 아이템 문서는 "그 자원이 어떤 형태가 되는가" 부터 시작한다. 그것이 문서가
서로를 침범하지 않는 형태다.

그런데 그렇게 자르고 나면 **어느 문서도 소유하지 않는 것**이 하나 남는다.

```text
층 안의 규칙       → 각 문서가 소유한다
층과 층의 이음     → 아무도 소유하지 않는다 → 사라진다
```

사라지면 나타나는 증상은 정해져 있다. 같은 개념이 문서마다 다른 이름으로 두 번 서고, 한
문서가 "여기서 답하지 않는다" 로 넘긴 것을 받는 문서가 없어 빈칸이 되고, 새 문서를 더할 때
어디에 붙여야 하는지 아무도 모른다.

> **이 문서는 사슬의 한 칸이 아니라 사슬 자체다.** 내용을 옮겨 오지 않고, 어느 칸이 무엇을
> 소유하며 칸과 칸 사이로 무엇이 건너가는지만 적는다.

---

## 0.1 이 사슬이 그대로 유지하는 것 (원문 서두)

네 문서를 한 벌로 쓴 원문은 시작부터 **바꾸지 않을 것** 둘을 못박았다. 아래는 그 문장 그대로다.

> 첨부된 기존 Item System의 핵심 구조인 `Master=정의 / Runtime=실제 개체·상태 / Cycle=수치·공식` 경계는 그대로 유지합니다. 또한 아이템 개체는 **같은 종류인데 상태가 달라져야 할 때만** 생성하며, 모든 개체는 자신의 출처를 설명할 수 있어야 한다는 원칙도 유지합니다.

사슬 위에서 그 둘을 실제로 지키는 자리는 다음과 같다. 여기서 어긋나면 그 문서가 틀린 것이다.

```text
Master / Runtime / Cycle 경계   Resource §1 (소유 경계) · Instance §5 (수치는 Cycle) ·
                                Item System §8 (슬롯 구성은 다른 문서) · Chain §4 (마지막 줄)
달라질 때만 개체가 된다          Item System §12 instance_policy · Instance §1 (생성 기준)
모든 개체는 출처를 답한다         Instance §2 (필수 조건) · §3 provenance · §12 Provenance ·
                                Item System §11 (Loot 는 실제 출처를 가진다) · Resource §5 · §6
```

---

# 1. 전체 흐름 한 장

각 구간 옆이 그 구간을 **소유한 문서와 절**이다. 흐름 자체는 각 문서의 원문에 있는 것을 이어
붙인 것이고, 이 문서가 새로 정한 것은 없다.

```text
WORLD PRINCIPLE                     Master-World-Beira.md
        │                           Master-World-Beira-Terrain.md
        ▼
TERRAIN / ECOLOGY                   Terrain §1 · §4 ~ §11
        │
        ▼
RESOURCE SOURCE                     Resource §2 · §3 · §4
        │  Harvest                  Resource §5 (방법이 결과 상태를 바꾼다)
        │  Consequence              Resource §6 (얻으면 세계가 변한다)
        ▼
RESOURCE                            Resource §8 · §12 ~ §16
        │  Process                  Item System §9 · Lifecycle §2.2
        ▼
MATERIAL
        │  Craft                    Item System §9 (재료 감소 + 생성이 한 단위)
        ▼
ITEM (정의)                          Item System §2 · §12
        │  Property → Mechanism      Item System §7 (grants 사슬)
        │  → grants → Capability
        ▼
ITEM (개체)                          Instance §1 (같아지지 않을 때만 개체가 된다)
        │  상태 · 구성 · 출처         Instance §3 ~ §12
        ▼
ITEM (시간 속)                       Lifecycle §1
        │  Refine · Modify · Imprint  Lifecycle §3 ~ §6
        │  Charge · Repair · Reforge  Lifecycle §7 ~ §10
        │  Broken · Destroy · Overdrive Lifecycle §11 ~ §13
        ▼
PLAYER PROGRESSION                  Lifecycle §2 (여섯 축) · §16 (지형을 건너며)
```

이 사슬을 거꾸로 읽으면 **최상위 원칙 첫째**(§3)의 검사 절차가 된다 — 어떤 Capability 든
위로 거슬러 올라가 Terrain 과 Principle 에 닿아야 한다.

---

# 2. 각 문서가 무엇을 소유하는가

| 문서 | 답하는 질문 | 소유한다 | 소유하지 않는다 → 넘긴다 |
|---|---|---|---|
| **Resource** `Design-Resource-Catalog-R0.md` | 자원이 왜 존재하고 어디서 생기며 어떻게 얻는가 · 무엇이 있는가 | Source · Harvest · Consequence · Renewable · 종류 전수와 그 세계 유래 · `ResourceDefinition` | 자원이 **무엇이 되는가** → Item System · 채집 수치 → Cycle · 생물 자체 → Creature |
| **Item System** `Design-Item-System-R1.md` | 자원이 어떻게 쓸 수 있는 형태가 되는가 | Form/Material/Mechanism/Modification · Role · 보유와 적용의 분리 · Interaction · Crafting · `ItemDefinition` · `ItemView` | 두 개체가 **달라지는 것** → Instance · 슬롯 구성 → Inventory/Equipment D1 |
| **Instance** `Design-Item-Instance-State-R0.md` | 같은 종류의 두 개가 왜 다른 개체인가 · 지금 어떤 상태인가 | 개체화 기준 · Composition · Integrity · Property Module · Refinement · Conflict · Ownership · Provenance · `ItemInstanceView` | 상태가 **어떻게 변해 가는가** → Lifecycle · Integrity 수치 → Cycle |
| **Lifecycle** `Design-Item-Lifecycle-Progression-R0.md` | 아이템이 어떻게 태어나 성장하고 사라지는가 | 전체 Lifecycle · 성장 여섯 축 · Refine ~ Overdrive · Item Build · Lifecycle Event · 구현 순서(Cycle 5~12) | 회수율·비용 수치 → Cycle · 성장 비용·보상 균형 → Growth Balance R0 |
| **(이 문서)** | 그 넷이 어떻게 한 사슬인가 | 흐름 · 소유 경계 · 층간 계약 · 읽는 순서 | 층 안의 어떤 규칙도 소유하지 않는다 |

경계에서 이어받는 이웃 문서는 다음과 같다. 사슬은 여기서 끝나지 않고 넘어간다.

```text
슬롯 구성 · 소지품 화면      Design-Inventory-Equipment-D1.md · Design-View-Inventory-Equipment-UX-D1.md
성장 비용 · 보상 균형        Design-Growth-Balance-R0.md
어떤 생물이 그 기관을 지니나  Design-Creature-Behavior-R0.md
모든 수치 · 공식             각 Cycle 의 03-world-semantic.md
```

---

# 3. 네 문서의 최종 관계 (원문)

아래는 네 문서를 한 벌로 쓴 원문의 마지막 장이다. **원문 그대로** 두고, 이 문서가 그것을
소유한다 — 사슬 위의 어느 칸도 이 장을 다시 싣지 않는다.

```text
WORLD
│
│ World Principle이 무엇을 만들어내는가
▼
Design-Resource-Catalog-R0
│
│ Resource가 무엇으로 사용 가능한가
▼
Design-Item-System-R1
│
│ 지금 이 실제 Item은 어떤 상태인가
▼
Design-Item-Instance-State-R0
│
│ 그 Item이 시간과 플레이에 따라 어떻게 변하는가
▼
Design-Item-Lifecycle-Progression-R0
│
▼
PLAYER PROGRESSION
```

그리고 이 시스템 전체에서 지켜야 할 최상위 원칙은 세 가지입니다.

**첫째, 아이템의 모든 힘은 세계의 원천까지 거슬러 올라갈 수 있어야 한다.**

`강한 검이라서 강하다`가 아니라 `어떤 지형의 어떤 Property를 어떤 방식으로 결속했기 때문에 이런 Capability가 나온다`가 되어야 합니다.

**둘째, 아이템 성장은 숫자 증가보다 가능성 확장이어야 한다.**

새로운 지형을 견디고, 새로운 방식으로 싸우고, 새로운 자원을 다루게 해야 합니다.

**셋째, 아이템은 Actor가 아니지만 세계의 역사를 몸에 남기는 개체가 될 수 있다.**

그래서 플레이어가 오래 사용한 하나의 검이 여러 지역의 소재와 개조와 파손과 재제작을 거쳐 정말로 **그 플레이어만의 장비**가 되는 구조입니다.

---

# 4. 층과 층이 넘겨주는 것 — 이음 계약

문서가 갈리는 자리마다 **무엇이 건너가는지**가 정해져 있어야 한다. 건너가는 것의 이름이
양쪽에서 같아야 두 문서가 서로를 검사할 수 있다.

| 이음 | 넘어가는 것 | 받는 쪽이 그것으로 하는 일 |
|---|---|---|
| Terrain → Resource | Principle · 환경 Property · 생존 압력 | 그 압력이 강요한 적응이 무엇으로 남았는지 (Resource §4 · §14) |
| Resource → Item System | Material 과 그 `IP-*` 성질 · 가능한 Process | Form 과 결속해 Mechanism 을 세운다 (Item System §2 · §7) |
| Item System → Instance | `instance_policy.requires_instance_when` | 그 조건이 참이 되는 순간 개체가 태어난다 (Instance §1) |
| Instance → Lifecycle | 현재 상태 + 그 상태를 바꾸는 Event | 상태 전이와 성장·파손·재제작 (Lifecycle §20) |
| Lifecycle → Resource | Residue · Dismantle 산출 · Overdrive 잔해 | 다시 재료가 되어 사슬이 순환한다 (Resource §2) |
| 어느 층이든 → Cycle | 그 층이 정한 **의미** | 수치·시간·확률로 옮긴다 (`03-world-semantic.md`) |

마지막 두 줄이 이 사슬이 **직선이 아니라 순환**인 이유이고, 동시에 어떤 문서도 수치를 갖지
않는 이유다.

---

# 5. 읽는 순서

```text
처음 보는 사람        이 문서 §1 → Resource §0 · §1 → Item System §0 → Lifecycle §0
                     (사슬을 먼저 보고 각 칸으로 내려간다)

자원을 더하는 사람     Resource §4 (Formation) → §5 (Harvest) → §11 (전수 조사에 자리 잡기)
                     → 그 자원이 여는 Item 이 있는지 Item System §7 로 확인

아이템을 더하는 사람   Item System §2 (네 층) → §12 (`ItemDefinition`)
                     → 개체가 필요한지 Instance §1 → 변해 가는지 Lifecycle §1

Cycle 을 여는 사람     Lifecycle §21 (구현 순서 5~12) → 해당 층 문서의 완료 기준
                     → 수치는 그 Cycle 의 03-world-semantic.md 에서 정한다

Master 작업자         Resource §19 (grants) · §20 (설계 원칙) · §23 (미결 이음매)
                     → 그래프에 옮길 것과 아직 옮기면 안 되는 것을 가른다
```

---

# 6. 지금 열려 있는 것 — 포인터만

이 문서는 이음매를 **판정하지 않는다.** 어디에 열려 있는지만 가리킨다.

```text
지리 모델이 두 벌 (대지형 vs 층 MW-ZONE-*)          Resource §23.1
같은 자원이 이름을 두세 벌                          Resource §23.2
회복 계통이 같은 MC- 를 두 조합으로 가리킨다          Resource §23.3
곡괭이가 세계에는 있고 그래프에는 없다                Resource §15
Critical 성질 장비 — 원천이 없어 세우지 않았다        Resource §16
```

닫히면 그 문서의 해당 절이 바뀌고, 이 문서는 바뀌지 않는다. **이 목록이 비는 것이 사슬이
닫혔다는 뜻이다.**

---

# 7. 이 문서가 다루지 않는 것

```text
층 안의 규칙        각 문서가 소유한다 — 여기에 옮겨 적지 않는다 (옮기면 두 벌이 된다)
수치 · 공식         Cycle 의 03-world-semantic.md
개별 자원 · 아이템   Resource §12 ~ §16 · Item System §12
구현                world/ · view/ — 문서는 의미까지만 답한다
```
