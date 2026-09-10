# L3 — 생물의 행동과 발견 상태 (기반 층 3 · 재료 — L3-Subject-Body 의 Cycle B 가 읽는다)

상태: **재료** — 3층의 기획서는 [L3-Subject-Body.md](L3-Subject-Body.md) 하나다 (Human 확정 — 그 문서 §3). 이 문서는 행이 아니라 그 Cycle B(Knowledge & Action)의 재료로 든다. 아래 머리 블록의 "자르는 때 · 놓는 미지" 는 그 결정 전의 것이다 — §3 이 지금이다. 2층 [L2-World-Foundation.md](L2-World-Foundation.md) 원문에서 3층의 것으로 판정된 절(Foundation §7 표 · G10 · G12 · D2)을 옮겨 세웠다. 3층 이하의 기획서는 2층이 축마다 문서 하나였던 것과 같은 방식으로 **주제마다 하나**다.
옮긴 절은 **글자 그대로**다 — 제목 수준만 맞췄고, 절마다 출처를 적었고, 원래 자리에는 포인터가 있다 (규칙: [design/Design-DesignAuthoringWorkflow.md §5](../../design/Design-DesignAuthoringWorkflow.md) "기획서의 층" · [README.md §1](README.md)).
§1 이 원문이다. 검토 · 계약 절(§2 이후)은 이 기획서를 자를 때 선다 — Human 의 주입물(방향 한 줄 · 빈칸의 답)이 오면 `advprotoi-inject` 가 이 문서에 **덧붙인다** (새 파일을 만들지 않는다). Human 이 언제든 고친다.

```text
이 기획서가 세운다        생물이 스스로 이동 · 행동한다(Foundation §8 기준 11 · 12) · Player Knowledge 와 발견 상태 다섯(G10 — Region §8 Discovery State · Access §7 네 단계와 같은 것) ·
                        knowledge Lock · HIDDEN 이 **발견되는** 절차(거름은 C038 이 세웠다) · Condition 의 target: actor · Mutation 의 Knowledge 군이 형에 든다(D2)
                        (배분 판정이지 원문이 아니다)
이 기획서가 소유하지 않는다  편성 · 교체([L3-Subject-Expedition.md](L3-Subject-Expedition.md)) · NPC 와의 상호작용 · 관계 변화 · 사회(층이 없다 — [plan/DESIGN.md](../../plan/DESIGN.md) §4) · 몸의 값(Human 주입)
함께 읽는다 (옮기지 않는다)  Foundation G10 · G12 · D2 · 빈칸 3 · [Region](L2-World-Region.md) §8 · [Access](L2-World-Access.md) §7 · K10 · design/Design-Subject-Decision · Design-Autonomous-Behavior-Knowledge-R0 ·
                        Design-Creature-Behavior-R0 (README §2 3행)
놓는 미지                 무엇을 원하는지 아는 생물 하나 더 ([plan/DESIGN.md](../../plan/DESIGN.md) §5 후보 5 — 이름은 Human)
자르는 때                 [plan/DESIGN.md](../../plan/DESIGN.md) §5 후보 5 — 후보 2 의 판정 뒤 · 3층 나머지 절반이 주입되면 "L3-Subject-Discovery 로 spec 써"
```

## 1. 원문 — 옮긴 것 (글자 그대로)

### 1.1 Foundation §2.5 — Processes 의 한 갈래 — NPC Process
출처: [L2-World-Foundation.md](L2-World-Foundation.md) 원문 §2.5 — 3층 (Actor 의 행동 — 사회 Process 는 층이 없어 원문 자리에 남는다)

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

### 1.2 Foundation §2.6 — Observation 의 뒷부분 — 발견 상태
출처: [L2-World-Foundation.md](L2-World-Foundation.md) 원문 §2.6 — 3층 (G10 — 2층 몫은 World Truth → Observable Signal 까지 · 관찰 수단 목록은 원문 자리에)

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

### 1.3 Foundation §7.7 — NPC 조우 / 사회적 상호작용 의 첫 갈래 — 조우
출처: [L2-World-Foundation.md](L2-World-Foundation.md) 원문 §7.7 — 3층 (§8 기준 11 — 상호작용 · 관계 변화 · 결과는 층이 없어 원문 자리에 남는다)

###### 조우
```text
우연히 만남
찾아감
구조
추적
매복당함
동행
```

### 1.4 Foundation §7.9 — Investigation / Knowledge
출처: [L2-World-Foundation.md](L2-World-Foundation.md) 원문 §7.9 — 3층 ("알아냈다" — §8 기준 22 · Rule 발견 · Weakness · "Class Change 조건 발견" 은 7층이 다시 읽는다)

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

## 2. 걸친 절 — 다른 층과 나눠 갖거나 옮기지 않은 것

```text
Foundation §4.6 행동 조건          talked · traded · observed — 형(2층 · C035)은 있고 이 층이 줄을 더한다. 옮기지 않는다
Foundation §5 Mutation Knowledge 군  REVEAL · HIDE · REFINE · CONFIRM — 표의 자리는 2층(C036 · 자리만) · 동작은 여기. 옮기지 않는다
Foundation §8 discovery 의 NPC · KNOWLEDGE 갈래 · §2.3 State 의 Society 이름공간 · §7.8 지식 퍼즐 · §11 떠돌이 NPC(문법 설명용 예) ·
  §8 최소 완성 기준 6 · 10 · 11 · 12 · 15 · 22 의 3층 몫 · G12 둘째 사례(폐허 → 마을 — NPC 뒤) · §2.6 관찰 수단의 NPC 정보     원문 자리에
```

## 3. 주입 — 3층 원문이 왔고, 이 문서는 그 재료가 됐다

Human 의 3층 기획서 전문이 [L3-Subject-Body.md](L3-Subject-Body.md) 에 보존됐다. 그 원문 §7 Awareness · §8~§9 Knowledge(learn / forget / knows) · §10 Condition target:actor · §11~§14 Action Port(Controller 와 무관한 행동 입구)가
이 문서의 주제와 겹친다. "몸의 값" 은 그 원문 §3~§6 이 받았다 — 이 문서가 "Human 주입" 으로 미뤄 두던 몫이다.
Human 이 그 문서 하나를 3층의 행으로 정했다 (그 문서 §3 "가"). 이 문서의 §1 원문(Foundation §2.5 · §2.6 · §7.7 · §7.9)은 그 문서의 Cycle B 가 SOURCE 로 함께 읽는다.
Knowledge 의 주인 — **Actor 와 관찰자(원정) 둘 다 소유할 수 있게 한다** (Human 확정: "둘다 소유할 수 있도록. 이후 유연하게 대응"). 원문 §8 의 Actor Knowledge 와 이 문서의 발견 상태 다섯(G10)은 같은 것으로 합치지도, 하나를 버리지도 않는다.
놓는 미지는 없다 (Human 확정). "L3-Subject-Discovery 로 spec 써" 는 더 이상 말할 것이 아니다 — "L3-Subject-Body 로 spec 써" 다.
