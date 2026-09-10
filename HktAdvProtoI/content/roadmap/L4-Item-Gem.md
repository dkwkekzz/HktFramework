# L4 — 보석과 물건 — 행동을 바꾸는 장치 (기반 층 4 · 기획서 · 대기)

상태: **대기** — 4층은 미주입 · 3층 뒤에 연다 ([plan/DESIGN.md](../../plan/DESIGN.md) §5 후보 6). 열린 층보다 먼저 온 7층 원문([L7-Fairy-Growth-Combination.md](L7-Fairy-Growth-Combination.md) §3 배분)에서 4층의 것으로 판정된 절을 옮겨 세웠다. 3층 이하의 기획서는 2층이 축마다 문서 하나였던 것과 같은 방식으로 **주제마다 하나**다.
옮긴 절은 **글자 그대로**다 — 제목 수준만 맞췄고, 절마다 출처를 적었고, 원래 자리에는 포인터가 있다 (규칙: [design/Design-DesignAuthoringWorkflow.md §5](../../design/Design-DesignAuthoringWorkflow.md) "기획서의 층" · [README.md §1](README.md)).
§1 이 원문이다. 검토 · 계약 절(§2 이후)은 이 기획서를 자를 때 선다 — Human 의 주입물(방향 한 줄 · 빈칸의 답)이 오면 `advprotoi-inject` 가 이 문서에 **덧붙인다** (새 파일을 만들지 않는다). Human 이 언제든 고친다.

```text
이 기획서가 세운다        지니는 것(소지 · 장비 — Inventory-Equipment-D1 기구 · 확정 10 요정마다의 가방) · 물건이 재료의 성질을 물려받는 것(Access 4층 몫) · 물건이 Mechanism 으로 행동을 바꾸는 것 ·
                        Gem = Material Seed 하나를 지니는 것(확정 6 · D2) · 소지가 property Lock 에 답하는 둘째 종류의 답(Access ㊵ — 몸 · 소지 · 동행 가운데 둘째)
                        (배분 판정이지 원문이 아니다)
이 기획서가 소유하지 않는다  제작 · 정제([L4-Item-Craft.md](L4-Item-Craft.md)) · 하나의 문제에 여러 답의 전투 쪽(5층 — [L5-Combat-Emergent.md](L5-Combat-Emergent.md)) · Class Change 의 재료로서의 Gem 과 "원하는 Class → Gem → Region" 순환(7층) ·
                        능력치형 아이템의 보조 범위(위임 D4 — 4층 주입)
함께 읽는다 (옮기지 않는다)  L7 확정 6 · 10 · 위임 D2 · D4 · [Material](L2-World-Material.md) S10 · §5.11 · [Access](L2-World-Access.md) 4층 몫([plan/DESIGN.md](../../plan/DESIGN.md) §3 Access 절) · [Region](L2-World-Region.md) §12 ·
                        design/Design-Resource-Catalog-R0 · Design-Item-* · Design-Inventory-Equipment-D1 (README §2 4행)
놓는 미지                 어디서 나는지 정해진 자원 하나 — 보석 여덟 후보 가운데 하나 (L7 §6 · 확정 6 · D2 빙결정 = 빙정석?) — 이름과 Region · 원인은 Human
자르는 때                 [plan/DESIGN.md](../../plan/DESIGN.md) §5 후보 6 — 4층이 열리면 "L4-Item-Gem 으로 spec 써". 방향: 캐서 지니면 갈 수 있는 곳이 늘어난다 (L7 §4 의 4층 줄)
```

## 1. 원문 — 옮긴 것 (글자 그대로)

### 1.1 L7 §8 — 보석의 역할
출처: [L7-Fairy-Growth-Combination.md](L7-Fairy-Growth-Combination.md) 원문 §8 — 4층(성장 재료 · 지역과 생태에서 난다 · 경험치 대체재 아님) · 7층 몫("원하는 Class → Gem → Region" 순환)이 함께 있다 (§2)

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

### 1.2 L7 §16 — 조합은 정답 자물쇠가 아니다
출처: [L7-Fairy-Growth-Combination.md](L7-Fairy-Growth-Combination.md) 원문 §16 — 4층("아이템 → 폭발 도구" — 물건도 요구에 답한다) · 5층 몫(하나의 문제에 여러 답)이 함께 있다 (§2). 2층 Access K · 검사 ㊵ 이 같은 원칙

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

### 1.3 L7 §17 — Item: 사용법을 변형한다
출처: [L7-Fairy-Growth-Combination.md](L7-Fairy-Growth-Combination.md) 원문 §17 — 4층 (Item = 행동을 바꾸는 장치 — Design-Item-System-R1 의 Mechanism)

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

### 1.4 L7 §24 — 피해야 할 구조
출처: [L7-Fairy-Growth-Combination.md](L7-Fairy-Growth-Combination.md) 원문 §24 — 4층(Item = 스탯 부착물) · 5층 몫(고정 전투 순서 · 정답 속성 관계) · 7층 몫(Fairy = 고정 역할 · Class Change = 숫자 상승)이 함께 있다 (§2) — 확정 11 "그것만이 중심이 되지 않는다" 로 읽는다

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

## 2. 걸친 절 — 다른 층과 나눠 갖거나 옮기지 않은 것

```text
§1.1 · §1.2 · §1.4 (L7 §8 · §16 · §24)   5 · 7층 몫이 함께 있다 — 이 기획서가 받은 뒤 남는 몫을 L5-Combat-Emergent §1 · L7 원문 곁으로 옮긴다 (두 문서의 §2 가 여기를 가리킨다)
Foundation §7.11 구조물 / 세계 변경        건설 · 수리 · 다리 설치 · 캠프 건설은 4층 이후 — 파괴 · 활성화 · 봉인의 절반은 2층(§8 기준 16). 목록 하나라 옮기지 않는다
Foundation §4.6 crafted · §5 Ownership 의 Item · Currency(GRANT 는 2층 Material 만 — C036) · §7.8 조합 퍼즐의 아이템 · §9 Yield 열 Item · Currency · Recipe(열은 2층 · 값은 여기 — G11) ·
  §2.6 관찰 수단 도구 · 아이템 · §8 기준 10 · 15 · 16 의 4층 몫       형의 자리는 2층 · 원문 자리에
Material §5.11 Downstream Handoff 의 쓰임 · S10 · Access 4층 몫(물건이 재료의 성질을 물려받는다)     그 문서 자리에 — 3층 주입 때 이리로 옮긴다
```
