# L1 — 세계의 문법 (기반 층 1)

상태: **확정**. 로드맵 1층의 결과물이다 ([README.md](README.md) §2).

이 층이 지목한 재료는 [design/Design-Concept.md](../../design/Design-Concept.md) 다.
이 문서는 그 문법을 다시 적지 않는다 — **무엇이 확정되었고, 무엇이 이 층의 것이 아니며,
왜 증명 Play 가 없는지**만 둔다. 문법 본문이 필요하면 Concept 를 읽는다.

이 층은 세계관 사실(이름·존재)을 요구하지 않는다. 문법만 정하므로 Human 이 채워 넣을
빈칸이 없었다 (§4 ① 의 "빠진 것만 채워"에 해당하는 것이 없다). 2층부터는 다르다.

---

## 1. 확정한 것

세계를 네 질문으로 적는다.

| 개념 | 질문 | 확정한 답 |
|---|---|---|
| **Entity** | 무엇이 존재하는가 | 독립된 동일성을 가진 것. 생물에 한정하지 않는다 — 물건·자원·구조물·투사체·설치물이 모두 Entity 다 |
| **State** | 지금 그것은 어떤 상태인가 | 세계에서 참인 사실. 속성도 관계도 State 다 |
| **Subject** | 무엇이 행동할 수 있는가 | Action Law 를 실행할 수 있는 Entity. **무엇이 그 행동을 고르는지는 문법 밖이다** |
| **Law** | 어떤 조건에서 무엇이 어떻게 변하는가 | Natural Law(조건이 서면 발생) · Action Law(Subject 가 실행) |

함께 확정한 넷.

```text
시간        세계의 일부다. tick 마다 Natural Law 의 조건을 검사하고 요청된 Action Law 를
            실행한다. 시간 자체도 State 다
저장과 유도  저장되는 State 와 그로부터 계산되는 사실(Near · InRange · Alive)을 나눈다.
            같은 사실을 두 곳에 두지 않는다. Law 의 결과는 저장되는 State 만 바꾼다
계산과 확률  Law 의 결과는 State 를 인자로 하는 계산일 수 있고 확률을 가질 수 있다.
            계산의 입력도 확률의 난수도 세계의 State 다 — 세계 밖 값은 받지 않는다
적용 순서    한 순간에 여러 Law 가 적용될 때 순서를 세계가 정한다. 그 순서가 규칙이고,
            결정론을 지키는 것도 그 순서다
```

그리고 한 가지 더 — **세 성장 축이 세계에 닿는 자리**를 이 층이 정했다
([L0-Game.md](L0-Game.md) §1 · Concept §10).

```text
클래스   어떤 Action Law 를 실행할 수 있는가 — Law 의 조건을 연다
아이템   그 Law 의 결과 계산에 들어간다 — 증폭하거나 속성을 부가한다
지식     둘을 잇는 조건 — 클래스의 스킬과 아이템의 속성이 함께 발현되게 한다
```

세 축의 State 가 한 Law 안에서 만나 확률을 가진 결과를 낸다. **축 각각의 내용은 이 층의
것이 아니다** — 자리만 정했다.

## 2. 정하지 않은 것

이 층에서 답이 나온 것처럼 보이면 안 되는 것들이다. Concept 의 예시에 등장하는 이름과
속성(`Fairy01` · `BodyTemperature` · `Class`)은 문법 설명용이며 **어느 층의 확정도 아니다.**

| 무엇을 | 어디가 답하는가 |
|---|---|
| 주체가 무엇을 알고, 무엇을 원하고, 어느 행동을 고르는가 | 3층 — [design/Design-Subject-Decision.md](../../design/Design-Subject-Decision.md) |
| 어떤 지역·생물·자원이 있고 무엇이라 불리는가 | 2층 이후 · 컨텐츠 층의 미지 |
| 몸이 무엇을 가지는가 (깎이고 회복되는 값) | 3층 |
| 피해·막기·지목이 어떻게 계산되는가 | 5층 |
| 스킬의 형태와 효과 | 6층 |
| 클래스·아이템·지식 각각의 내용과 성장 | 7층 |

## 3. 증명 Play 가 없는 이유

**코드가 이미 이 문법 위에 서 있기 때문이다.** 이 층은 새로 세우는 것이 아니라 서 있는
것을 적었다 — 그래서 코드를 한 줄도 바꾸지 않았고, 플레이해 볼 새 사건도 없다.

```text
Entity · State   content/world/semantic/     WorldState = actors[] · deposits[] · strikeEvents[]
Subject          semantic/actor.ts           ActorState.control: 'player' | 'autonomous'
Action Law       content/world/rules/        요청 → Transition (move · attack · mine · skill …)
Natural Law      content/world/simulation/   tick → 진행 (action-progress · cp-run-drain …)
시간             engine/world-kernel/state.ts  CoreWorldState.time
시간에 걸친 적용   semantic/action.ts          CurrentAction — 진행 중이라는 사실이 State 다
유도되는 사실      semantic/combat.ts          isDowned() — Downed 는 저장하지 않는다
적용 순서         content/world/index.ts      SYSTEMS 배열 하나가 tick 순서를 고정한다
```

한 가지는 문법에만 있고 코드에 없다.

```text
확률   세계에 난수 State 가 없다. 지금의 모든 Law 는 확정적 결과만 낸다.
       (Math.random 은 view 가 관찰자 id 를 짓는 데만 쓴다 — 세계 밖이다)
```

문법이 확률을 허용한다는 것과 이 세계가 확률을 쓴다는 것은 다르다. 확률을 처음 쓰는 층이
난수 State 를 세계에 들이고, 그것이 결정론을 지키는 방식(같은 State·같은 시간 → 같은 결과)을
함께 정한다. 세 성장 축의 조합이 이 게임의 핵심 재미이므로 이것은 5층 이후의 첫 숙제다.
