# L6 — Handoff: 6층(능력)이 열릴 때 받는 절

상태: **대기 — 6층은 미주입 · 5층 뒤에 연다 (DESIGN §5 후보 8)** ([plan/DESIGN.md §1](../../plan/DESIGN.md)). 이 문서는 **기획서가 아니다** — 행을 세우지 않고, Cycle 을 자르지 않고, spec 의 SOURCE 가 되지 않는다.
앞 층의 기획서와 먼저 온 원문 가운데 **6층의 것으로 판정된 절**을 글자 그대로 옮긴 것이다 — 제목 수준만 맞췄고, 절마다 출처를 적었고, 원래 자리에는 포인터가 남아 있다.
규칙은 [design/Design-DesignAuthoringWorkflow.md §5](../../design/Design-DesignAuthoringWorkflow.md) "기획서의 층" · [README.md §1](README.md). Human 이 언제든 고친다.

```text
6층이 열릴 때   advprotoi-inject 가 Human 의 주입물(방향 한 줄 · 스킬의 실행 형태 · D5 의 값 · Class 둘의 정식 이름)과 이 문서를 합쳐 L6-<이름>.md 를 세우고 여기서 그 절을 지운다.
              방향 한 줄만 와도 된다 — 그때는 옮겨진 원문이 그대로 기획서의 원문이다. 크기 규칙(한 세션에 잘리는 기획서 · Cycle 2~4)은 그때 다시 — §2 가 한 기획서다
걸친 절        §4 — 다른 층 몫이 함께 있는 절은 6층 몫을 받은 뒤 남는 몫을 그 층의 Handoff 로 넘긴다. 형의 자리(슬롯)만 있는 것은 옮기지 않았다 — 그 층이 같은 형에 줄을 더한다.
다 비면        이 파일을 지운다.
```

## 1. 받는 것 — 한눈에

| 출처 | 절 | 6층이 세울 것 (배분 판정 — 원문이 아니다 · L7 §3) |
|---|---|---|
| L7 원문 (§2) | §6 Class · §19 탐험 조합 | 스킬 = Core 의 성질 ↔ World State 의 관계 · 하나의 Core 가 Class 마다 다른 Law 로 나가는 것 · Leave 가 남긴 장판이 다른 요정의 능력과 반응하는 것(§11 늪의 마녀) · Off-field 의 시간 규모(D5) |
| Foundation 원문 (§3) | 없다 | 관찰 수단 "요정 능력"(§2.6) 한 줄뿐 — 원문 자리에 |

함께 읽는다 — 옮기지 않는다: [L7 확정 사항](L7-Fairy-Growth-Combination.md) 위임 D5 · [L3-Handoff](L3-Handoff.md) §2.1 · §2.2 · §2.5 (L7 §4 · §5 · §11 — 3층이 받은 뒤 남는 몫이 여기로 온다) · design/Design-Skill-* (README §2 6행).

## 2. L7-Fairy-Growth-Combination 에서 — 6층 몫 (L7 §3 배분)

### 2.1 원문 §6 — Class: 그 본질을 어떻게 사용할 것인가
출처: [L7-Fairy-Growth-Combination.md](L7-Fairy-Growth-Combination.md) 원문 §6 — 6층 몫 (Class = Core 를 쓰는 방법 · 갈라진다 — Class Change 의 Law 는 7층 §7)

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

### 2.2 원문 §19 — 탐험 조합
출처: [L7-Fairy-Growth-Combination.md](L7-Fairy-Growth-Combination.md) 원문 §19 — 6층 몫 (탐험도 조합 문제 — 독성 밀림은 컨텐츠 행 후보 · L7 §6)

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

## 3. L2-World-Foundation 에서

없다.

## 4. 걸친 절 — 다른 층과 나눠 갖거나 옮기지 않은 것

```text
L7 §5 "모든 Class 는 Core 의 일부를 쓴다" · §11 Active/Entry/Leave/Off-field 의 내용 · 늪의 마녀 · §4    L3-Handoff §2.1 · §2.2 · §2.5 에 있다 — 3층이 받은 뒤 남는 몫이 여기로 온다
L7 §2.2 표 "모든 Class 가 갖는 것" — 기존 목록(Signature · Mobility · Utility · Mechanic · Ultimate · Response)은 Active 안의 구성(6층 재료)    L7 문서 자리에 — 인용
```

## 5. 이 층이 놓는 것

Class 둘의 정식 이름 ([plan/DESIGN.md §5](../../plan/DESIGN.md) 후보 8) — L7 §6 의 클래스 후보 열에서 Human 이 고른다.
