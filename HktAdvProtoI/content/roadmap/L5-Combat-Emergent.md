# L5 — 창발 전투 — 상태 관계가 전투의 문법 (기반 층 5 · 기획서 · 대기)

상태: **대기** — 5층은 미주입 · 4층 뒤에 연다 ([plan/DESIGN.md](../../plan/DESIGN.md) §5 후보 7). 먼저 온 7층 원문([L7-Fairy-Growth-Combination.md](L7-Fairy-Growth-Combination.md) §3 배분)과 2층 [L2-World-Foundation.md](L2-World-Foundation.md) 원문에서 5층의 것으로 판정된 절을 옮겨 세웠다. 3층 이하의 기획서는 2층이 축마다 문서 하나였던 것과 같은 방식으로 **주제마다 하나**다.
옮긴 절은 **글자 그대로**다 — 제목 수준만 맞췄고, 절마다 출처를 적었고, 원래 자리에는 포인터가 있다 (규칙: [design/Design-DesignAuthoringWorkflow.md §5](../../design/Design-DesignAuthoringWorkflow.md) "기획서의 층" · [README.md §1](README.md)).
§1 이 원문이다. 검토 · 계약 절(§2 이후)은 이 기획서를 자를 때 선다 — Human 의 주입물(방향 한 줄 · 빈칸의 답)이 오면 `advprotoi-inject` 가 이 문서에 **덧붙인다** (새 파일을 만들지 않는다). Human 이 언제든 고친다.

```text
이 기획서가 세운다        World State 를 **대상**(적 · 구조물)에 생성 · 제거 · 변화 · 전달 · 소비 · 증폭하는 것 — 피해 종류가 아니라 상태 관계가 전투의 문법 · 어휘 열하나는 Access 성질 어휘(축:관계)의 확장(확정 8) ·
                        전투 Opportunity 가 Foundation §8 의 같은 형에 든다 · killed · Boss 탄생 조건(Life F9 셋째 깊이) · 시스템이 순서를 지정하지 않는다는 것이 증명 대상
                        (배분 판정이지 원문이 아니다)
이 기획서가 소유하지 않는다  스킬의 실행 형태(6층 — [L6-Skill-Class.md](L6-Skill-Class.md)) · Territory 전투 · 세력전 · PvP · 다중 플레이어(층이 없다 — [plan/DESIGN.md](../../plan/DESIGN.md) §4) · 확률(Foundation §4.7 — 확률을 처음 쓰는 층이 난수 State 와 함께 · L1 §3) · 피해 · 지목의 값(5층 주입)
함께 읽는다 (옮기지 않는다)  L7 확정 8 · 위임 D3(Combat-Knowledge-Extension 슬롯 모델 처분) · L7 §23 Monster 질문 · [Concept](L2-World-Concept.md) W6 · W7 · [Time](L2-World-Time.md) 접촉 ·
                        design/Design-Combat-* · Design-Targeting-R0 · Design-Combat-Knowledge-Extension (README §2 5행)
놓는 미지                 여러 해법을 허용하는 몬스터 하나 ([plan/DESIGN.md](../../plan/DESIGN.md) §5 후보 7 — 이름은 Human · L7 §6 의 "거대 갑각수" 가 후보)
자르는 때                 [plan/DESIGN.md](../../plan/DESIGN.md) §5 후보 7 — 5층이 열리면 "L5-Combat-Emergent 로 spec 써". 방향: 같은 적을 두 가지 상태 순서로 쓰러뜨린다 (L7 §4 의 5층 줄)
```

## 1. 원문 — 옮긴 것 (글자 그대로)

### 1.1 L7 §13 — 고정 전투 페이즈를 만들지 않는다
출처: [L7-Fairy-Growth-Combination.md](L7-Fairy-Growth-Combination.md) 원문 §13 — 5층 (World State 어휘 열하나 — 확정 8)

#### 13. 고정 전투 페이즈를 만들지 않는다
시스템이 다음과 같은 전투 순서를 지정하지 않는다.
```text
추적
→ 제어
→ Break
→ Burst
```
이는 가능한 전투 흐름 중 하나일 뿐이다.
게임 시스템이 가져야 하는 것은 **Phase가 아니라 World State**이다.
예:
```text
Burning
Wet
Frozen
Cracked
Marked
Bound
Exposed
Poisoned
Charged
Corroded
Rooted
```
Fairy와 Skill은 이러한 상태를:
* 생성하고
* 제거하고
* 변화시키고
* 전달하고
* 소비하고
* 증폭한다.

### 1.2 L7 §14 — Emergent Combat
출처: [L7-Fairy-Growth-Combination.md](L7-Fairy-Growth-Combination.md) 원문 §14 — 5층 ("다른 플레이어는 같은 적을 …" 한 줄은 다중 플레이어 — 층이 없다)

#### 14. Emergent Combat
전투의 Phase는 플레이어 행동 결과 자연스럽게 발생한다.
예:
```text
야수계
→ Mark 생성
백왕계
→ Mark 위치 파괴
심연계
→ 열린 상처 침식
화염계
→ 침식 부위 연소
```
다른 플레이어는 같은 적을:
```text
수해계
→ Wet
빙결 Class
→ Freeze
백왕계
→ Frozen 갑각 파괴
야수계
→ 노출된 부위 추적
```
로 상대할 수 있다.
시스템은 정답 순서를 제공하지 않는다.
> **플레이어가 전투 흐름을 만든다.**

### 1.3 Foundation §7.4 — 전투 / 사냥
출처: [L2-World-Foundation.md](L2-World-Foundation.md) 원문 §7.4 — 5층 (대결 — 전투도 Opportunity 중 하나 · Territory 전투 · 세력전 · PvP 는 층이 없다)

#### 7.4 전투 / 사냥
전투도 Opportunity 중 하나다.
```text
일반 사냥
희귀 개체
Elite
Boss
매복
추적 사냥
방어
호위
Territory 전투
세력전
PvP
PvPvE
환경 이용 전투
퍼즐 전투
생태 개입 전투
```
###### 기반
```text
Actor
Space
Rules
State
Processes
```

## 2. 걸친 절 — 다른 층과 나눠 갖거나 옮기지 않은 것

```text
L7 §16 하나의 문제에 여러 답 · §24 고정 전투 순서 · 정답 속성 관계    L4-Item-Gem §1.2 · §1.4 에 있다 — 4층이 받은 뒤 남는 몫이 여기로 온다
L7 §23 신규 콘텐츠 설계 원칙 — Monster                              L7 문서 자리에 (7층 몫과 한 절) — 인용
Foundation §4.7 확률                                                CHANCE · WEIGHTED_SELECT · SEEDED_RANDOM — 확률을 처음 쓰는 층이 결정론을 지키는 방식과 함께 정한다(L1 §3 · 빈칸 1). 5층이 먼저면 여기가 받는다. 원문 자리에
Foundation §4.6 killed · damaged · healed · §2.8 의 예 lastBossDeath · totalDeaths(D4 — 자리는 같은 형) · §7.10 사냥(추적은 2층) · §8 기준 7 · 8 · 25 의 5층 몫 · §11 포식자 사냥(문법 설명용 예)    원문 자리에
Concept W6 · W7 · Time 의 접촉                                       그 문서 자리에 — 3층 주입 때 이리로 옮긴다
```
