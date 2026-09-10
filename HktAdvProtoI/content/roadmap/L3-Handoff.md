# L3 — Handoff: 3층(주체와 몸)이 열릴 때 받는 절

상태: **대기 — 3층은 열려 있으나(2층 판정과 병행) 기획서가 아직 없다** ([plan/DESIGN.md §1](../../plan/DESIGN.md)). 이 문서는 **기획서가 아니다** — 행을 세우지 않고, Cycle 을 자르지 않고, spec 의 SOURCE 가 되지 않는다.
앞 층의 기획서와 먼저 온 원문 가운데 **3층의 것으로 판정된 절**을 글자 그대로 옮긴 것이다 — 제목 수준만 맞췄고, 절마다 출처를 적었고, 원래 자리에는 포인터가 남아 있다.
규칙은 [design/Design-DesignAuthoringWorkflow.md §5](../../design/Design-DesignAuthoringWorkflow.md) "기획서의 층" · [README.md §1](README.md). Human 이 언제든 고친다.

```text
3층이 열릴 때   advprotoi-inject 가 Human 의 주입물(방향 한 줄 · 몸의 값 · 생물의 앎과 선택)과 이 문서를 합쳐 L3-<이름>.md 를 세우고 여기서 그 절을 지운다.
              방향 한 줄만 와도 된다 — 그때는 옮겨진 원문이 그대로 기획서의 원문이다. 크기 규칙(한 세션에 잘리는 기획서 · Cycle 2~4)은 그때 다시 — 자연스러운 자리는 둘이다. §2 편성과 무대의 한 명(DESIGN §5 후보 2) · §3 발견 상태와 NPC 의 행동(후보 5)
걸친 절        §4 — 다른 층 몫이 함께 있는 절은 3층 몫을 받은 뒤 남는 몫을 그 층의 Handoff 로 넘긴다. 형의 자리(슬롯)만 있는 것은 옮기지 않았다 — 그 층이 같은 형에 줄을 더한다.
다 비면        이 파일을 지운다.
```

## 1. 받는 것 — 한눈에

| 출처 | 절 | 3층이 세울 것 (배분 판정 — 원문이 아니다 · L7 §3 · Foundation §7 표) |
|---|---|---|
| L7 원문 (§2) | §4 Fairy · §5 Fairy Core · §9 원정 편성 · §10 한 명만 무대에 · §11 Active/Off-field 의 **자리** · §20 탐험에서도 교체 | 관찰자 ↔ **편성**(요정 여럿 — 크기는 세계 조건, 확정 5) ↔ 무대의 **몸 하나**. 교체 = Action Law(Leave 가 세계에 남기고 Entry 가 세계에 닿는다 · 제약 없음, 확정 4). 대기 요정은 몸이 없다. Core 가 몸의 State 로 적혀 property Lock 에 답하는 첫 사례(Access K12) |
| Foundation 원문 (§3) | §2.5 NPC Process · §2.6 발견 상태 · §7.7 조우 · §7.9 Investigation / Knowledge | 생물이 스스로 이동 · 행동한다(Foundation §8 기준 11 · 12) · Player Knowledge 와 발견 상태 다섯(G10 — Region §8 Discovery State · Access §7 과 같은 것) · knowledge Lock · HIDDEN 이 발견되는 절차 · Condition 의 target: actor 와 Opportunity 의 participants 가 형에 든다(D2) |

함께 읽는다 — 옮기지 않는다 (Human 답 · 앞 층의 계약): [L7 확정 사항](L7-Fairy-Growth-Combination.md) 3 · 4 · 5 · 10 · 11 · 12 · 위임 D1 · D5 ·
[Access](L2-World-Access.md) §14.1 · §15 · K12 · [Life](L2-World-Life.md) F10 · [M5](M5-FrostCanyon.md) · design/Design-Subject-Decision · Autonomous-Behavior-Knowledge-R0 · Creature-Behavior-R0 (README §2 3행).

## 2. L7-Fairy-Growth-Combination 에서 — 3층 몫 (L7 §3 배분 · 확정 12)

### 2.1 원문 §4 — Fairy: 무엇을 다루는 존재인가
출처: [L7-Fairy-Growth-Combination.md](L7-Fairy-Growth-Combination.md) 원문 §4 — 3층 몫 — Core 가 몸의 State 로 적힌다 (6층이 Class 를 세울 때 다시 읽는다 · §4)

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

### 2.2 원문 §5 — Fairy Core
출처: [L7-Fairy-Growth-Combination.md](L7-Fairy-Growth-Combination.md) 원문 §5 — 3층 몫(Core 가 몸의 State) · 6층 몫("모든 Class 는 Core 의 일부를 쓴다")이 함께 있다 (§4)

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

### 2.3 원문 §9 — 원정 편성
출처: [L7-Fairy-Growth-Combination.md](L7-Fairy-Growth-Combination.md) 원문 §9 — 3층 몫 (확정 5 — 크기는 세계 조건)

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

### 2.4 원문 §10 — 한 명만 무대에 선다
출처: [L7-Fairy-Growth-Combination.md](L7-Fairy-Growth-Combination.md) 원문 §10 — 3층 몫 (화면 복잡도 한 줄은 8층 — 각 Cycle 의 Required 로)

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

### 2.5 원문 §11 — Active / Off-field 구조
출처: [L7-Fairy-Growth-Combination.md](L7-Fairy-Growth-Combination.md) 원문 §11 — 3층 몫은 **자리**(Entry · Leave · Off-field 가 발동하는 때 · 확정 4) · **내용**(Active 의 능력 · 늪의 마녀)은 6층 몫 (§4)

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

### 2.6 원문 §20 — 탐험에서도 교체를 사용한다
출처: [L7-Fairy-Growth-Combination.md](L7-Fairy-Growth-Combination.md) 원문 §20 — 3층 몫

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

## 3. L2-World-Foundation 에서 — 3층 몫 (Foundation §7 표 · G10 · G12 · D2)

### 3.1 원문 §2.5 Processes 의 한 갈래 — NPC Process
출처: [L2-World-Foundation.md](L2-World-Foundation.md) 원문 §2.5 Processes 의 한 갈래 — 3층 (Actor 의 행동 — 사회 Process 는 층이 없어 원문 자리에 남는다)

##### NPC Process
```text
이동
노동
휴식
거래
사냥
탐색
도망
집결
```

### 3.2 원문 §2.6 Observation 의 뒷부분 — 발견 상태
출처: [L2-World-Foundation.md](L2-World-Foundation.md) 원문 §2.6 Observation 의 뒷부분 — 3층 (G10 — 2층 몫은 World Truth → Observable Signal 까지 · 관찰 수단 목록은 원문 자리에)

##### 발견 상태
```text
UNKNOWN
SUSPECTED
DISCOVERED
UNDERSTOOD
MASTERED
```
예:
```text
WORLD TRUTH
"붉은 안개는 출혈한 생물을 추적하는 포식자를 끌어들인다."
```
처음에는:
```text
UNKNOWN
```
플레이어는
```text
출혈
→ 붉은 안개
→ 이상한 울음소리
→ 포식자 등장
```
만 경험한다.
이후 지식을 얻어 법칙을 이해한다.
이 때문에 **지역의 법칙 자체가 탐험 콘텐츠**가 된다.

### 3.3 원문 §7.7 NPC 조우 / 사회적 상호작용 의 첫 갈래 — 조우
출처: [L2-World-Foundation.md](L2-World-Foundation.md) 원문 §7.7 NPC 조우 / 사회적 상호작용 의 첫 갈래 — 3층 (§8 기준 11 — 상호작용 · 관계 변화 · 결과는 층이 없어 원문 자리에 남는다 · plan/DESIGN.md §4)

###### 조우
```text
우연히 만남
찾아감
구조
추적
매복당함
동행
```

### 3.4 원문 §7.9 — Investigation / Knowledge
출처: [L2-World-Foundation.md](L2-World-Foundation.md) 원문 §7.9 — 3층 ("알아냈다" — §8 기준 22 · Rule 발견 · Weakness · Class Change 조건 발견은 7층이 다시 읽는다)

#### 7.9 Investigation / Knowledge
탐험과 별도로 **이해하는 행위**를 하나의 플레이 축으로 둔다.
```text
흔적 조사
시체 조사
생물 관찰
환경 실험
NPC 증언
문헌 발견
반복 관찰
```
결과:
```text
World Fact 발견
Weakness 발견
Resource 획득법 발견
Rule 발견
Hidden Region 발견
Recipe 발견
Class Change 조건 발견
```

## 4. 걸친 절 — 다른 층과 나눠 갖거나 옮기지 않은 것

```text
L7 §5 · §11 (여기 §2.2 · §2.5)            6층 몫(Class 는 Core 의 일부를 쓴다 · Active/Entry/Leave/Off-field 의 내용 · 늪의 마녀)이 함께 있다 → 3층이 받은 뒤 남는 몫을 L6-Handoff 로. L6-Handoff §4 가 여기를 가리킨다
L7 §4 (여기 §2.1)                          6층이 Class 를 세울 때 다시 읽는다 — 인용
Foundation §4.6 행동 조건                    talked · traded · observed 등 — 형(2층 · C035)은 있고 그 층이 줄을 더한다. 옮기지 않는다
Foundation §5 Mutation — Knowledge 군        REVEAL · HIDE · REFINE · CONFIRM — 표의 자리는 2층(C036 · 자리만) · 동작은 3층. 옮기지 않는다
Foundation §8 Opportunity 공통 구조           participants · discovery 의 NPC · KNOWLEDGE 갈래 — 형에 자리만(C036) · 채우는 것은 3층
Foundation §2.3 State 의 Society 이름공간 · §7.8 지식 퍼즐 · §11 떠돌이 NPC(문법 설명용 예) · §8 최소 완성 기준 6 · 10 · 11 · 12 · 15 · 22 의 3층 몫 · G12 둘째 사례(폐허 → 마을 — NPC 뒤)
Foundation §2.6 관찰 수단 가운데 NPC 정보      3층 — 목록은 원문 자리에 (도구 · 아이템은 4층 · 요정 능력은 6층)
```

## 5. 이 층이 놓는 미지

README §1 — 3층의 Cycle 들은 축을 세우면서 **무엇을 원하는지 아는 생물 하나**를 놓는다. 후보는 M8 협곡의 열을 쫓는 것 ([plan/DESIGN.md §2](../../plan/DESIGN.md) — 이름은 Human · 코드 후보 `HEAT_STALKER`).
