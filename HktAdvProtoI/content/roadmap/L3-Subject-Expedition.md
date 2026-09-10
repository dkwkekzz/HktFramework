# L3 — 원정 편성과 무대의 한 명 (기반 층 3 · 기획서 · 대기)

상태: **대기** — 3층은 열려 있으나(2층 판정과 병행 — [plan/DESIGN.md](../../plan/DESIGN.md) §1) 아직 잘리지 않았다. 열린 층보다 먼저 온 7층 원문([L7-Fairy-Growth-Combination.md](L7-Fairy-Growth-Combination.md) §3 배분 · 확정 12)에서 3층의 것으로 판정된 절을 옮겨 세웠다. 3층 이하의 기획서는 2층이 축마다 문서 하나였던 것과 같은 방식으로 **주제마다 하나**다.
옮긴 절은 **글자 그대로**다 — 제목 수준만 맞췄고, 절마다 출처를 적었고, 원래 자리에는 포인터가 있다 (규칙: [design/Design-DesignAuthoringWorkflow.md §5](../../design/Design-DesignAuthoringWorkflow.md) "기획서의 층" · [README.md §1](README.md)).
§1 이 원문이다. 검토 · 계약 절(§2 이후)은 이 기획서를 자를 때 선다 — Human 의 주입물(방향 한 줄 · 빈칸의 답)이 오면 `advprotoi-inject` 가 이 문서에 **덧붙인다** (새 파일을 만들지 않는다). Human 이 언제든 고친다.

```text
이 기획서가 세운다        관찰자 ↔ **편성**(요정 여럿 — 크기는 세계 조건, 확정 5) ↔ 무대의 **몸 하나**. 교체 = Action Law(Leave 가 세계에 남기고 Entry 가 세계에 닿는다 · 제약 없음, 확정 4) ·
                        대기 요정은 몸이 없다 · Core 가 몸의 State 로 적혀 property Lock 에 답하는 첫 사례(Access K12 — "몸이 답한다")
                        (배분 판정이지 원문이 아니다)
이 기획서가 소유하지 않는다  Active/Entry/Leave/Off-field 의 **내용**과 늪의 마녀(6층 — [L6-Skill-Class.md](L6-Skill-Class.md)) · 몸의 값(Human 주입 — 후보 5) · 생물의 앎과 행동([L3-Subject-Discovery.md](L3-Subject-Discovery.md)) ·
                        요정의 획득 방식과 첫 둘의 계열(위임 D1 — 이 기획서의 첫 spec 이 확정 후보를 낸다) · 화면(§10 의 화면 복잡도 한 줄 — 8층 · Required 로)
함께 읽는다 (옮기지 않는다)  L7 확정 3 · 4 · 5 · 10 · 11 · 12 · 위임 D1 · D5 ([L7 확정 사항](L7-Fairy-Growth-Combination.md)) · [Access](L2-World-Access.md) §14.1 · §15 · K12 · [Life](L2-World-Life.md) F10 · [M5](M5-FrostCanyon.md) ·
                        design/Design-Subject-Decision · Design-Inventory-Equipment-D1 §26.1(관찰자 하나 = 몸 하나의 결손)
놓는 미지                 무엇을 원하는지 아는 생물 하나 — M8 협곡의 열을 쫓는 것 ([plan/DESIGN.md](../../plan/DESIGN.md) §2 — 이름은 Human · 코드 후보 `HEAT_STALKER`)
자르는 때                 [plan/DESIGN.md](../../plan/DESIGN.md) §5 후보 2 — "L3-Subject-Expedition 으로 spec 써". 방향: 요정 둘을 편성해 협곡을 지난다 (L7 §4 의 3층 줄)
```

## 1. 원문 — 옮긴 것 (글자 그대로)

### 1.1 L7 §4 — Fairy: 무엇을 다루는 존재인가
출처: [L7-Fairy-Growth-Combination.md](L7-Fairy-Growth-Combination.md) 원문 §4 — 3층 — Core 가 몸의 State 로 적힌다 (6층이 Class 를 세울 때 다시 읽는다 · §2)

#### 4. Fairy — 무엇을 다루는 존재인가
요정은 완성된 역할을 가진 캐릭터가 아니다.
요정에게 고정되는 것은 **역할이 아니라 세계적 본질**이다.
예:
| 요정  | Core Identity  |
| --- | -------------- |
| 화염계 | 열, 점화, 연소, 확산  |
| 수해계 | 물, 흐름, 침수, 정화  |
| 백왕계 | 질서, 결속, 파괴, 고정 |
| 야수계 | 감각, 추적, 본능, 표식 |
| 수목계 | 성장, 뿌리, 번식, 연결 |
| 심연계 | 침식, 흡수, 오염, 변질 |
화염계라고 해서 반드시 공격수가 아니며, 수해계라고 해서 반드시 지원가가 아니다.
요정은 단지
> **어떤 세계 현상을 다룰 수 있는가**
를 결정한다.

### 1.2 L7 §5 — Fairy Core
출처: [L7-Fairy-Growth-Combination.md](L7-Fairy-Growth-Combination.md) 원문 §5 — 3층(Core 가 몸의 State) · 6층 몫("모든 Class 는 Core 의 일부를 쓴다")이 함께 있다 (§2)

#### 5. Fairy Core
모든 요정은 클래스 체인지 이후에도 사라지지 않는 고유한 Core를 가진다.
예:
```text
화염계 Core
- Heat
- Burn
- Ignite
- Spread
수해계 Core
- Flow
- Wet
- Cleanse
- Current
야수계 Core
- Sense
- Track
- Mark
- Pursue
```
모든 클래스는 반드시 자신의 Fairy Core 중 일부를 사용해야 한다.
따라서 같은 역할을 수행하더라도 요정마다 방법이 다르다.
예를 들어 지원 역할이라도:
```text
화염계 지원
→ 아군에게 불씨를 심고 공격을 통해 폭발시킨다.
수해계 지원
→ 흐름을 만들어 상태를 정화하고 위치 이동을 돕는다.
수목계 지원
→ 뿌리를 연결하여 생명력과 효과를 공유한다.
```
역할은 비슷할 수 있지만 플레이 방식은 서로 다르다.

### 1.3 L7 §9 — 원정 편성
출처: [L7-Fairy-Growth-Combination.md](L7-Fairy-Growth-Combination.md) 원문 §9 — 3층 (확정 5 — 크기는 세계 조건)

#### 9. 원정 편성
플레이어는 보유한 요정 중 일부를 선택하여 원정 파티를 만든다.
기본 구조는 다음과 같다.
```text
Expedition Party
Fairy A
Fairy B
Fairy C
Fairy D
```
하지만 필드에 직접 존재하는 요정은 항상 **한 명**이다.
```text
[A Active]
B / C / D
→ 대기
```
플레이어는 전투와 탐험 중 자유롭게 Active Fairy를 교체한다.

### 1.4 L7 §10 — 한 명만 무대에 선다
출처: [L7-Fairy-Growth-Combination.md](L7-Fairy-Growth-Combination.md) 원문 §10 — 3층

#### 10. 한 명만 무대에 선다
핵심 원칙:
> **동시에 직접 조작되는 요정은 항상 한 명이다.**
이유는 다음과 같다.
* MMORPG 캐릭터 조작의 직접성을 유지한다.
* 화면 복잡도를 통제한다.
* 각각의 요정에 대한 애착을 유지한다.
* 교체 자체를 의미 있는 플레이 행동으로 만든다.
* 다수 캐릭터 자동 전투로 변질되는 것을 방지한다.
다른 Fairy는 존재하지 않는 것이 아니라 간접적으로 전투에 영향을 줄 수 있다.

### 1.5 L7 §11 — Active / Off-field 구조
출처: [L7-Fairy-Growth-Combination.md](L7-Fairy-Growth-Combination.md) 원문 §11 — 3층은 **자리**(Entry · Leave · Off-field 가 발동하는 때 · 확정 4) · **내용**(Active 의 능력 · 늪의 마녀)은 6층 (§2)

#### 11. Active / Off-field 구조
각 Class는 필요에 따라 다음 요소를 가질 수 있다.
```text
Active
Entry
Leave
Off-field
```
###### Active
현재 직접 조작할 때 사용하는 능력.
###### Entry
교체되어 등장할 때 발생하는 행동.
###### Leave
퇴장하면서 남기는 효과.
###### Off-field
교체 이후에도 유지되는 효과.
예:
```text
늪의 마녀
Active
→ 물과 진흙으로 전장을 변화시킨다.
Leave
→ 현재 위치에 늪을 남긴다.
Off-field
→ 늪이 일정 시간 유지되며 다른 Fairy와 반응한다.
```
모든 Class가 네 요소를 모두 가져야 하는 것은 아니다.
이를 정형적인 로테이션 구조로 강제하지 않는다.

### 1.6 L7 §20 — 탐험에서도 교체를 사용한다
출처: [L7-Fairy-Growth-Combination.md](L7-Fairy-Growth-Combination.md) 원문 §20 — 3층

#### 20. 탐험에서도 교체를 사용한다
Active Fairy 구조는 탐험에도 그대로 적용한다.
예:
```text
야수계
→ 흔적 발견
교체
수목계
→ 발견한 위치에 뿌리 성장
교체
백왕계
→ 뿌리를 Anchor로 사용하여 절벽 돌파
```
따라서 Fairy 교체는 전투 전용 UI가 아니다.
> **세계에 개입하는 방법을 바꾸는 행동**
이다.

## 2. 걸친 절 — 다른 층과 나눠 갖거나 옮기지 않은 것

```text
§1.2 · §1.5 (L7 §5 · §11)     6층 몫(Class 는 Core 의 일부를 쓴다 · Active/Entry/Leave/Off-field 의 내용 · 늪의 마녀)이 함께 있다 — 이 기획서가 받은 뒤 남는 몫을
                              L6-Skill-Class §1 로 옮긴다 (그 문서 §2 가 여기를 가리킨다)
§1.1 (L7 §4)                  6층이 Class 를 세울 때 다시 읽는다 — 인용
Foundation §8 Opportunity      participants — 형에 자리만(C036) · 채우는 것은 이 기획서 (몸이 서야 "여럿" 이 센다)
Foundation §4.6 행동 조건       entered · crossed 는 2층 · 몸이 하는 것(moved · observed)은 여기 — 형(C035)에 줄을 더한다 · 옮기지 않는다
```

## 3. 주입 — 3층 원문이 왔다 (포인터)

Human 의 3층 기획서 전문이 [L3-Subject-Body.md](L3-Subject-Body.md) 에 보존됐다. 그 원문 §15 Core · §16~§19 Expedition · 무대의 한 명 · 교체 · Presence · §22 Bag(원정 단위) 이 이 문서의 주제와 같고,
그 §26 Cycle C(Expedition & Stage)가 이 문서의 후보 2 와 겹친다. 문장은 옮기지 않았다 — 어느 문서가 행이 되는가는 Human 이 정한다 ([plan/DESIGN.md](../../plan/DESIGN.md) §3 L3-Subject-Body 절의 질문 1 · 2).
답이 오면 이 문서의 상태와 "자르는 때" 를 그 답대로 고친다.
