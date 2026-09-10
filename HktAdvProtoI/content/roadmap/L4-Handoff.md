# L4 — Handoff: 4층(자원과 물건)이 열릴 때 받는 절

상태: **대기 — 4층은 미주입 · 3층 뒤에 연다 (DESIGN §5 후보 6)** ([plan/DESIGN.md §1](../../plan/DESIGN.md)). 이 문서는 **기획서가 아니다** — 행을 세우지 않고, Cycle 을 자르지 않고, spec 의 SOURCE 가 되지 않는다.
앞 층의 기획서와 먼저 온 원문 가운데 **4층의 것으로 판정된 절**을 글자 그대로 옮긴 것이다 — 제목 수준만 맞췄고, 절마다 출처를 적었고, 원래 자리에는 포인터가 남아 있다.
규칙은 [design/Design-DesignAuthoringWorkflow.md §5](../../design/Design-DesignAuthoringWorkflow.md) "기획서의 층" · [README.md §1](README.md). Human 이 언제든 고친다.

```text
4층이 열릴 때   advprotoi-inject 가 Human 의 주입물(방향 한 줄 · 소지 · 장비 · 가공 사슬 · D2 · D4 의 답)과 이 문서를 합쳐 L4-<이름>.md 를 세우고 여기서 그 절을 지운다.
              방향 한 줄만 와도 된다 — 그때는 옮겨진 원문이 그대로 기획서의 원문이다. 크기 규칙(한 세션에 잘리는 기획서 · Cycle 2~4)은 그때 다시 — §2 와 §3 은 한 기획서에 든다(지니는 것 · 물건이 행동을 바꾸는 것 · 재료의 쓰임) — 넘치면 제작(§3)을 나눈다
걸친 절        §4 — 다른 층 몫이 함께 있는 절은 4층 몫을 받은 뒤 남는 몫을 그 층의 Handoff 로 넘긴다. 형의 자리(슬롯)만 있는 것은 옮기지 않았다 — 그 층이 같은 형에 줄을 더한다.
다 비면        이 파일을 지운다.
```

## 1. 받는 것 — 한눈에

| 출처 | 절 | 4층이 세울 것 (배분 판정 — 원문이 아니다 · L7 §3 · Foundation §7 표) |
|---|---|---|
| L7 원문 (§2) | §8 보석의 역할 · §16 조합은 정답 자물쇠가 아니다 · §17 Item · §24 피해야 할 구조 | 지니는 것(소지 · 장비 — Inventory-Equipment-D1 기구 · 확정 10 요정마다의 가방) · 물건이 재료의 성질을 물려받는 것(Access 4층 몫) · 물건이 Mechanism 으로 행동을 바꾸는 것 · Gem = Material Seed 하나를 지니는 것(확정 6 · D2) · 능력치형 아이템의 보조 범위(D4). 소지가 property Lock 에 답하는 둘째 종류의 답(Access ㊵) |
| Foundation 원문 (§3) | §7.6 제작 / 변환 | 재료의 쓰임 — 제작 · 정제 · 지역 의존 제작 · crafted · Recipe (Material §5.11 Downstream Handoff 의 쓰임) |

함께 읽는다 — 옮기지 않는다: [L7 확정 사항](L7-Fairy-Growth-Combination.md) 6 · 10 · 위임 D2 · D4 · [Material](L2-World-Material.md) S10 · §5.11 · [Access](L2-World-Access.md) 4층 몫([plan/DESIGN.md §3](../../plan/DESIGN.md) Access 절) ·
[Region](L2-World-Region.md) §12 · design/Design-Resource-Catalog-R0 · Design-Item-* · Design-Inventory-Equipment-D1 (README §2 4행).

## 2. L7-Fairy-Growth-Combination 에서 — 4층 몫 (L7 §3 배분)

### 2.1 원문 §8 — 보석의 역할
출처: [L7-Fairy-Growth-Combination.md](L7-Fairy-Growth-Combination.md) 원문 §8 — 4층 몫(성장 재료 · 지역과 생태에서 난다 · 경험치 대체재 아님) · 7층 몫("원하는 Class → Gem → Region" 순환)이 함께 있다 (§4)

#### 8. 보석의 역할
보석은 경험치 대체재가 아니다.
보석은 세계의 특성이 응축된 성장 재료이다.
예:
```text
왕정석
빙결정
홍염석
심연석
생명석
야수석
공명석
폭풍석
```
특정 지역과 생태에서 특정 보석이 나타난다.
따라서 원하는 클래스를 얻으려면 자연스럽게 세계를 탐험해야 한다.
```text
원하는 Class
→ 필요한 Gem
→ Gem이 존재하는 Region
→ 그 Region의 위험 극복
→ 성장
```
성장 목표가 다시 탐험 목표가 된다.

### 2.2 원문 §16 — 조합은 정답 자물쇠가 아니다
출처: [L7-Fairy-Growth-Combination.md](L7-Fairy-Growth-Combination.md) 원문 §16 — 4층 몫("아이템 → 폭발 도구" — 물건도 요구에 답한다) · 5층 몫(하나의 문제에 여러 답)이 함께 있다 (§4). 2층 Access K · 검사 ㊵ 이 같은 원칙

#### 16. 조합은 정답 자물쇠가 아니다
다음과 같은 구조는 최소화한다.
```text
얼음벽
→ 화염계 필요
```
이것은 조합이 아니라 요구 조건이다.
대신 하나의 문제에 여러 접근법을 제공한다.
예:
##### 거대 얼음 장벽
가능한 방법:
```text
화염계
→ 녹인다.
백왕계 파괴 Class
→ 직접 깨뜨린다.
심연계
→ 내부 구조를 침식한다.
수해계
→ 균열에 물을 넣고 얼려 팽창시킨다.
아이템
→ 폭발 도구 사용.
Knowledge
→ 우회 동굴 위치 발견.
```
Collection이 성장한다는 것은 정답 하나를 얻는 것이 아니라
> **문제를 해결할 수 있는 방법이 늘어나는 것**
이다.

### 2.3 원문 §17 — Item: 사용법을 변형한다
출처: [L7-Fairy-Growth-Combination.md](L7-Fairy-Growth-Combination.md) 원문 §17 — 4층 몫 (Item = 행동을 바꾸는 장치 — Design-Item-System-R1 의 Mechanism)

#### 17. Item — 사용법을 변형한다
Item은 단순 능력치 증가물이 아니다.
```text
Item
= Fairy 또는 Class의 행동을 변경하는 장치
```
예:
```text
화염검사
+
공명검
```
결과:
```text
Burning 대상 공격
→ Resonance 생성
```
다른 아이템:
```text
화염검사
+
응축화석
```
결과:
```text
Burn을 퍼뜨리는 대신
한 대상에 Heat를 집중
```
따라서 동일 Fairy / 동일 Class라도 아이템에 의해 다른 빌드가 만들어진다.

### 2.4 원문 §24 — 피해야 할 구조
출처: [L7-Fairy-Growth-Combination.md](L7-Fairy-Growth-Combination.md) 원문 §24 — 4층 몫(Item = 스탯 부착물) · 5층 몫(고정 전투 순서 · 정답 속성 관계) · 7층 몫(Fairy = 고정 역할 · Class Change = 숫자 상승)이 함께 있다 (§4) — 확정 11 "그것만이 중심이 되지 않는다" 로 읽는다

#### 24. 피해야 할 구조
다음 구조는 중심 설계로 사용하지 않는다.
###### Fairy = 고정 역할
```text
A = Tank
B = DPS
C = Healer
```
###### 고정 전투 순서
```text
제어
→ Break
→ Burst
```
###### 정답 속성 관계
```text
얼음
→ 불 필수
```
###### Class Change = 숫자 상승
```text
ATK +30%
HP +20%
```
###### Item = 스탯 부착물
```text
공격력 +10%
치명타 +5%
```
이러한 요소가 보조적으로 존재할 수는 있지만, 성장의 중심이 되어서는 안 된다.

## 3. L2-World-Foundation 에서 — 4층 몫 (Foundation §7 표)

### 3.1 원문 §7.4~§7.17 활동군 가운데 §7.6 — 제작 / 변환
출처: [L2-World-Foundation.md](L2-World-Foundation.md) 원문 §7.4~§7.17 활동군 가운데 §7.6 — 4층 (재료의 쓰임 — Material §2.1 이 "쓰임은 4층 이후" 로 둔 것)

#### 7.6 제작 / 변환
지역의 환경 자체를 제작 도구로 사용할 수 있다.
```text
제작
정제
조합
요리
연금
마력 부여
아이템 성장
수리
분해
```
그리고:
```text
용암에서만 정제 가능
폭풍 속에서 충전
특정 생물 내부에서 숙성
월광 아래에서 변이
```
같은 **지역 의존 제작**도 가능하다.

## 4. 걸친 절 — 다른 층과 나눠 갖거나 옮기지 않은 것

```text
L7 §8 · §16 · §24 (여기 §2)                 5 · 7층 몫이 함께 있다 → 4층이 받은 뒤 남는 몫을 L5-Handoff · L7-Handoff 로. 두 문서의 §4 가 여기를 가리킨다
Foundation §7.11 구조물 / 세계 변경           건설 · 수리 · 다리 설치 · 캠프 건설은 4층 이후 — 파괴 · 활성화 · 봉인의 절반은 2층(§8 기준 16). 목록 하나라 옮기지 않는다
Foundation §4.6 crafted · §5 Ownership 의 Item · Currency(GRANT 는 2층 Material 만 — C036) · §7.8 조합 퍼즐의 아이템 · §9 Yield 열 Item · Currency · Recipe(열은 2층 · 값은 여기 — G11) ·
           §2.6 관찰 수단 도구 · 아이템 · §8 기준 10 · 15 · 16 의 4층 몫 — 형의 자리는 2층 · 옮기지 않는다
Material §5.11 Downstream Handoff 의 쓰임(Recipe · 효과 · 수치) · S10          Material 문서 자리에 (plan/DESIGN.md §3 Material)
Access 4층 몫(물건이 재료의 성질을 물려받는다)                                    Access 문서 자리에 (plan/DESIGN.md §3 Access) — 3층 주입 때 옮긴다
```

## 5. 이 층이 놓는 미지

README §1 — **어디서 나는지 정해진 자원 하나**. 후보는 보석 여덟 가운데 하나 (L7 §6 · 확정 6 · D2 빙결정 = 빙정석?) — 이름과 Region · 원인은 Human.
