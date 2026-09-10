# L6 — Class 와 탐험 조합 — Core 를 쓰는 방법 (기반 층 6 · 기획서 · 대기)

상태: **대기** — 6층은 미주입 · 5층 뒤에 연다 ([plan/DESIGN.md](../../plan/DESIGN.md) §5 후보 8). 열린 층보다 먼저 온 7층 원문([L7-Fairy-Growth-Combination.md](L7-Fairy-Growth-Combination.md) §3 배분)에서 6층의 것으로 판정된 절을 옮겨 세웠다. 3층 이하의 기획서는 2층이 축마다 문서 하나였던 것과 같은 방식으로 **주제마다 하나**다.
옮긴 절은 **글자 그대로**다 — 제목 수준만 맞췄고, 절마다 출처를 적었고, 원래 자리에는 포인터가 있다 (규칙: [design/Design-DesignAuthoringWorkflow.md §5](../../design/Design-DesignAuthoringWorkflow.md) "기획서의 층" · [README.md §1](README.md)).
§1 이 원문이다. 검토 · 계약 절(§2 이후)은 이 기획서를 자를 때 선다 — Human 의 주입물(방향 한 줄 · 빈칸의 답)이 오면 `advprotoi-inject` 가 이 문서에 **덧붙인다** (새 파일을 만들지 않는다). Human 이 언제든 고친다.

```text
이 기획서가 세운다        스킬 = Core 의 성질 ↔ World State 의 관계 · 하나의 Core 가 Class 마다 다른 Law 로 나가는 것 · Leave 가 남긴 장판이 다른 요정의 능력과 반응하는 것(L7 §11 늪의 마녀) · Off-field 의 시간 규모(위임 D5)
                        (배분 판정이지 원문이 아니다)
이 기획서가 소유하지 않는다  Class Change 의 Law(7층 — L7 §7) · 편성 · 교체의 자리(3층 — [L3-Subject-Expedition.md](L3-Subject-Expedition.md)) · 피해와 지목(5층) · 스킬의 실행 형태의 값(6층 주입) · Class 둘의 정식 이름(Human)
함께 읽는다 (옮기지 않는다)  L7 위임 D5 · [L3-Subject-Expedition.md](L3-Subject-Expedition.md) §1.1 · §1.2 · §1.5(L7 §4 · §5 · §11 — 3층이 받은 뒤 남는 몫이 여기로 온다) · L7 §2.2 표 "모든 Class 가 갖는 것"(기존 목록은 Active 안의 구성 — 6층 재료) ·
                        design/Design-Skill-* (README §2 6행)
놓는 미지                 Class 둘의 정식 이름 — L7 §6 의 클래스 후보 열에서 Human 이 고른다
자르는 때                 [plan/DESIGN.md](../../plan/DESIGN.md) §5 후보 8 — 6층이 열리면 "L6-Skill-Class 로 spec 써". 방향: 한 Core 가 두 Class 로 갈리고, 장판이 반응한다 (L7 §4 의 6층 줄)
```

## 1. 원문 — 옮긴 것 (글자 그대로)

### 1.1 L7 §6 — Class: 그 본질을 어떻게 사용할 것인가
출처: [L7-Fairy-Growth-Combination.md](L7-Fairy-Growth-Combination.md) 원문 §6 — 6층 (Class = Core 를 쓰는 방법 · 갈라진다 — Class Change 의 Law 는 7층 §7)

#### 6. Class — 그 본질을 어떻게 사용할 것인가
Class는 Fairy Core를 사용하는 **방법**을 결정한다.
```text
Fairy
= 무엇을 다루는가
Class
= 그것을 어떻게 사용하는가
```
예:
```text
수해계 Fairy
├─ 격류술사
│  └─ 흐름을 직접 공격으로 사용
│
├─ 늪의 마녀
│  └─ 흐름을 지형 제어로 사용
│
├─ 청류의 성녀
│  └─ 흐름을 정화와 보호로 사용
│
└─ 심해 추적자
   └─ 흐름을 탐험과 탐지에 사용
```
Class에 의해 결정될 수 있는 것은 다음과 같다.
* Active 전투 방식
* 공격 거리
* 이동 방식
* 방어 방식
* 상태 생성
* 상태 소비
* Off-field 행동
* 탐험 능력
* 환경 상호작용
* 다른 Fairy와의 연결 방식
따라서 Class Change는 단순 강화가 아니다.
> **Fairy의 조합 위치와 사용법을 변경하는 성장이다.**

### 1.2 L7 §19 — 탐험 조합
출처: [L7-Fairy-Growth-Combination.md](L7-Fairy-Growth-Combination.md) 원문 §19 — 6층 (탐험도 조합 문제 — 독성 밀림은 컨텐츠 행 후보 · L7 §6)

#### 19. 탐험 조합
전투와 탐험은 별개의 시스템이 아니다.
탐험에서도 동일한 세계 상태와 능력을 사용한다.
예:
##### 독성 밀림
현재 상태:
```text
독성 포자
높은 습도
거대 식물
숨겨진 수로
```
가능한 접근:
```text
화염계
→ 포자 소각
```
또는:
```text
수해계
→ 공기와 물의 독성 정화
```
또는:
```text
수목계
→ 독성 식물과 공명하여 통로 생성
```
또는:
```text
야수계
→ 이 지역을 통과하는 생물 흔적 추적
→ 안전한 길 발견
```
탐험 역시 조합 문제이다.

## 2. 걸친 절 — 다른 층과 나눠 갖거나 옮기지 않은 것

```text
L7 §5 "모든 Class 는 Core 의 일부를 쓴다" · §11 Active/Entry/Leave/Off-field 의 내용 · 늪의 마녀 · §4    L3-Subject-Expedition §1.1 · §1.2 · §1.5 에 있다 — 3층이 받은 뒤 남는 몫이 여기로 온다
Foundation §2.6 관찰 수단의 "요정 능력"                                                            원문 자리에
```
