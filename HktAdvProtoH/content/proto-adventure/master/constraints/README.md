# constraints/ — 승인된 Design Constraint

파일 하나 = Constraint 하나. 이름은 `DC-<NAME>.yaml`. 형식은 [../SCHEMA.md](../SCHEMA.md).

현재: **Active 32종** — 전투 5종(1종 REVISED) + 성장 6종 + 세계 5종 +
아이템 6종(1종 REVISED) + 스킬 6종(3종 REVISED) + GLOBAL 4종. 보류(DRAFT)는 없다.

근거 문서:

```text
R1 §x   design/Design-Combat-OffenseDefense-R0.md   전투 영역
DT §x   design/Design-Combat-DamageType-R0.md        전투 영역
GR §x   design/Master-Intent-Graph-Growth.md         성장(GROWTH) 영역 한정
TG §x   design/Design-Targeting-R0.md                 지목(GLOBAL)
BW §x   design/Master-World-Beira.md                 세계(WORLD) 영역
IS §x   design/Design-Item-System-R0.md               아이템(ITEM) 영역
IE §x   design/Design-Inventory-Equipment-D1.md       아이템(ITEM) 영역 — IS §5.4 · §10 의 후속
```

근거는 영역을 넘지 않는다 — 전투 노드에 GR 을, 성장 노드에 R1/DT 를 인용하지 않는다.
**예외 (Q18(a) — 2026-08-19 Human 승인)**: BW 의 전투 교차분(§20~§28)이 기존 전투
노드와 매핑 확정되어, 매핑된 전투 노드에는 BW 를 **보조 근거**로 인용할 수 있다
(주 근거는 여전히 R1/DT).

삭제된 구판(R0)은 근거가 아니다. 구판에만 근거가 있던 Constraint 는 보류가 아니라
**삭제**한다 — 필요해지면 그 층의 설계 문서가 나온 뒤 새로 만든다.

### Active — APPROVED (전투)

| Constraint | 한 줄 | 근거 |
|---|---|---|
| DC-COMBAT-PLAYER-CAUSALITY **(REVISED)** | 중요한 결과는 관찰 가능한 원인과 플레이어의 선택에서 — 난수 명중·회피·피해 금지. **Critical 만 확률 허용** (Q11(b) 2026-08-19) | R1 §0 · §6 · §9 · §14 C011 · DT §8 · §10 |
| DC-COMBAT-ONE-FORMULA | 기반 피해 공식은 하나 — 새 시스템은 공식의 입력/결과에 한 가지 의미만 더한다 | R1 핵심 원칙 · §15 · DT §5 · §17 |
| DC-COMBAT-ONE-LAYER-AT-A-TIME | 한 번에 한 층 — 현재 층이 플레이로 검증되기 전에 다음 층을 올리지 않는다 | R1 §0 · §13 · §14 · §16 · DT §13 · §15 |
| DC-COMBAT-SHARED-BUDGET | 전투 행동은 하나의 기력 예산을 나눈다 — 행동별 전용 게이지 신설 금지 | R1 §1 · §11 · §14 Aura/Nen · 핵심 원칙 |
| DC-COMBAT-MATCHUP-SOFT | 상성은 선택을 만들되 지배하지 않는다 — 배율표가 아니라 대응 능력치 차이로만 | DT §4 · §5 · §7 · §14-7 · §14-10 |

### Active — APPROVED (성장)

| Constraint | 한 줄 | 근거 |
|---|---|---|
| DC-GROWTH-NEED-FROM-POSSIBILITY | Class/Item 은 획득 경로일 뿐 — Capability 필요성은 항상 Goal→Possibility 에서 | GR §22.2 · §27.1 · §42 |
| DC-GROWTH-CLASS-ORIGIN-TRACE | Class 는 세계 인과의 결과 — origin_trace 필수, 제거해도 원인 세계 요소 성립 | GR §24.2 · §41 |
| DC-GROWTH-NO-CAPABILITY-DUPLICATION | 같은 Capability 를 Source 별로 복제 금지 — 하나의 MC 에 여러 경로가 grants | GR §33 · §35 · §42 |
| DC-GROWTH-DEFINITION-INSTANCE-SPLIT | Master 는 유한 Definition 만 — II-*/조합 결과는 Runtime, 사전 생성 금지 | GR §28~§32 · §42 |
| DC-GROWTH-NOT-A-STAGE | Growth 는 Master Stage 가 아니라 NEED 위의 Overlay | GR §21 · §22.1 |
| DC-GROWTH-GOAL-FIRST | 성장 자체를 Goal 로 세우지 않는다 — 현재 Goal 의 Possibility 로만 | GR §34 · §42 |

### Active — APPROVED (세계 — BW 주입 · Q17(a) 승인)

| Constraint | 한 줄 | 근거 |
|---|---|---|
| DC-WORLD-RESOURCE-ADAPTATION-TRACE | 중요 자원은 세계압→적응 Trace 로 설명 — 배치형 설계·위험=등급 직결 금지 | BW §6 · §11 · §12 · §33 · §34 |
| DC-WORLD-CREATURE-FROM-PRESSURE | 전투 Creature 를 먼저 만들지 않는다 — 능력은 적응의 결과 | BW §26 |
| DC-WORLD-COMBAT-IS-ONE-POSSIBILITY | Creature 존재만으로 처치 Goal 금지 — Goal 은 WorldState 에서, 전투는 대안 중 하나 | BW §27 · §28 |
| DC-WORLD-PLAYER-UNFIXED-PATH | Player 의 역할·Class·진영·탐험 이유를 하나로 고정하지 않는다 | BW §1 · §15 · §31 |
| DC-WORLD-PROGRESSION-IS-REACH | Progression 은 Level 이 아니라 대응 가능한 세계 범위의 확장 | BW §1 · §17 · §32 |

### Active — APPROVED (아이템 — IS 주입 · Q30(a) 승인)

| Constraint | 한 줄 | 근거 |
|---|---|---|
| DC-ITEM-KIND-IS-DATA-NOT-BRANCH | 종류 이름은 정의를 찾는 열쇠일 뿐 규칙의 분기 조건이 아니다 — 새 아이템은 정의를 더하는 것으로 끝난다 | IS §0 · §5.1 · §7 P1 · §8 |
| DC-ITEM-CAPABILITY-COMES-FROM-GRANTS | 성질(IP-*)은 세계 유래만이고 용도는 종류가 가진다 — 능력 판정은 성질 조회가 아니라 지금 무엇을 주는가로 | IS §3.1~§3.3 · §5.1 · §7 P2 |
| DC-ITEM-HOLDING-IS-NOT-APPLYING **(REVISED)** | 가지고 있는 것만으로는 몸이 달라지지 않는다 — 달라지는 것은 적용된 것 때문이고 풀면 정확히 원복된다. **그 "정확히" 는 가감이 아니라 재계산으로 담보한다** (prefers · Q33 2026-08-21) | IS §5.4 · §7 P3 · §8 · IE §38 · §39 |
| DC-ITEM-CHANGE-IS-ONE-UNIT | 효과와 수량은 함께 변하거나 함께 변하지 않는다 — 실패한 시도는 흔적을 남기지 않는다 | IS §5.5 · §5.6 · §7 P4 |
| DC-ITEM-CAPACITY-IS-FINITE | 담을 자리도 적용할 자리도 유한하고 적용할 자리가 훨씬 좁다 — 몇 개인가는 Cycle 이 소유한다 | IE §0 · §3.1 · §10 · §49 P2·P3 · §50 |
| DC-ITEM-LIVES-IN-ONE-PLACE | 아이템은 정확히 한 곳에 있다 — 저장소가 담고, 다른 저장소의 자리를 가리키지 않는다 | IE §13.1 · §24 · §25 · §41 · §44 · §49 P4·P9 |

뒤의 둘은 IE 주입으로 섰다 (Q32 2026-08-21). IS §10 이 범위 밖으로 두고 IS §5.4 가
후속 문서에 넘긴 영역이라 앞의 넷과 의미가 겹치지 않는다.

### Active — REVISED (스킬 — SK 주입 · Q41 승인 → Q45 근거 재배선)

| Constraint | 한 줄 | 근거 |
|---|---|---|
| DC-SKILL-IS-COMBINATION-NOT-NAME **(REVISED)** | 스킬 이름은 세계가 아는 종류가 아니다 — 시스템에는 형태만 있고 스킬은 그 조합을 고른 정의다 | SK §2 · §5 · §7 · §9 · §11 |
| DC-SKILL-DELIVERY-IS-NOT-EFFECT **(REVISED)** | 효과가 대상에 닿는 방식과 대상에게 일어나는 일은 다른 축 — 한쪽을 다른 쪽의 종류로 만들지 않는다 | SK §0 · §4 · §7 |
| DC-SKILL-COMBINE-BEFORE-NEW-FORM **(REVISED)** | 새 요구는 먼저 기존 형태의 조합으로 — 새 실행 형태는 조합으로도 값으로도 안 되고 세계에 다른 생명주기·판정이 필요할 때만 | SK §6 · §9 |

셋은 2026-08-21 구판(SF) 주입으로 승인됐고(HISTORY Q41), 같은 날 구판이 삭제되며
근거가 SK 로 옮겨졌다 (Q45). 방향과 금지 범위는 그대로이고 바뀐 것은 조합의 항 이름과
인용 § 다. `DELIVERY-IS-NOT-EFFECT` 의 ID 는 SK 가 그 축을 `Execution` 으로 부르게
된 뒤에도 유지한다 — 이력이 이미 그 ID 로 여럿을 가리킨다.

### Active — APPROVED (스킬 — SK 최종안이 새로 명시 · Q45 승인)

| Constraint | 한 줄 | 근거 |
|---|---|---|
| DC-SKILL-ANCHOR-IS-NOT-RESOLUTION | 어디를 기준으로 쓰는가와 누가 맞는가는 다른 질문 — 한 명이냐 여럿이냐를 스킬 종류로 만들지 않는다 | SK §3 · §7 |
| DC-SKILL-EFFECT-MUST-ALREADY-EXIST | 스킬은 지금 세계에 있는 상태 변화만 부른다 — 없는 효과의 이름을 미리 두지 않는다 | SK 핵심 원칙 7 · SK-EF §5 · §6 |
| DC-SKILL-PRESENCE-IS-WORLD-NOT-SKILL | 몸 아닌 것이 세계에 자리를 가지는 일은 세계의 능력 — 스킬 안에 임시로 만들지 않는다 | SK 핵심 원칙 6 · SK-SP §1 · §3 |

셋은 구판에 없던 의미이며 최종안이 새로 명시했다. `PRESENCE-IS-WORLD-NOT-SKILL` 의
Scope 는 `SKILL` 하나로 둔다 (Q45 — 근거가 스킬 영역 문서이므로 영역을 넘기지 않는다).
Frontier 후보 7(물건이 몸 밖에 놓인다)이 같은 자리를 요구하지만, 그쪽을 구속하려면
그 층의 문서가 근거로 서야 한다.
`ANCHOR-IS-NOT-RESOLUTION` 은 MC-COMBAT-STRIKE 에 걸려 SATISFIED 다 — 지금 세계의
휘두름은 고른 대상을 읽지 않고 접촉이 맞는 것을 정한다.

### Active — APPROVED (GLOBAL — 기획 문서 주입)

| Constraint | 한 줄 | 근거 |
|---|---|---|
| DC-TARGET-IS-INTENT-NOT-AIM | 지목은 의도의 표명일 뿐 — 명중·피해·정보·위협을 만들지 않고 세계가 대신 다가가지 않는다 | TG §0 · §2.1 · §2.3 · §3.4 · §9 · §10 |

### Active — APPROVED (GLOBAL — Cycle 관찰에서 승격)

아래 셋은 위 표들과 성격이 다르다. 기획 문서가 아니라 **Cycle 을 돌면서 반복 발견된
형태**가 근거이며, 그래서 근거 칸에 § 번호가 아니라 Cycle ID 가 들어간다.

| Constraint | 한 줄 | 근거 |
|---|---|---|
| DC-WORLD-OWNS-THE-SURFACE-LIST | 무엇을 할 수 있고 값이 어디까지인지의 목록은 세계가 소유하고 관찰에 실어 보낸다 — View 가 만들지 않는다 | C007 → C009 → C010 (DT §10 · §16.3-6 이 독립적으로 지지) |
| DC-WORLD-OWNS-THE-CHANCE | 우연의 원천은 세계 상태 · 관찰에 싣지 않는다 · 경위는 전부 싣는다 · 이미 정해진 일에는 소비하지 않는다 | C015 (형태) — 범위는 DC-COMBAT-PLAYER-CAUSALITY 가 소유 |
| DC-CONDITION-OPENS-WITHOUT-RECORDING | 지금의 조건이 여는 것은 기록하지 않는다 — 조건이 사라지면 저절로 닫힌다 | C016 (C015 는 다른 영역의 같은 종류) |

뒤의 둘은 **관찰 1회로 승격**했다. 반복이 아니라 비가역성이 근거다 — 둘 다 나중에
세우면 이미 쌓인 것(재현 이력 · 저장된 데이터)을 깨야 한다. 승격 조건 4항의 첫 항을
면제한 사례이므로, 같은 예외를 다시 쓸 때는 그 비가역성을 먼저 보인다.

반영·삭제 이력은 [../HISTORY.md](../HISTORY.md) 가 소유한다 — 이 파일에는 지금 살아 있는
Constraint 만 남긴다.

## 이것이 무엇인가

게임의 Goal/Possibility/Capability/World Rule 이 **어떤 형태로 존재할 수 있는지** 제한하거나
방향짓는 Human-owned Design Intent. Actor 의 Goal 이 아니다.

Constraint 는 Master 기본 절차(WHY → OPTIONS → NEED → NEXT)의 **단계가 아니다** —
각 선택 지점에서 적용되는 Filter 다 (정책 §2.3 · §10). Constraint 작업(신설·재작성·승인)은
Human 이 요청할 때만 별도로 수행한다.

```text
Goal        Actor 가 어떤 이유로 원하는 Desired State
Constraint  그 Goal 과 해결 방법이 어떤 설계 원칙 안에서 만들어져야 하는지
```

## 금지

```text
수치·상수·판정 공식을 넣지 않는다      "Perfect Guard 는 0.20초여야 한다"  → Cycle 소유
시스템 목록을 만들지 않는다            Constraint → Combat System → Guard/Break/…  → BAD
특정 구현 모듈을 이유 없이 강제하지 않는다
Agent 가 임의로 추가·삭제·완화하지 않는다 — 승인도 삭제도 Human 이다
근거 문서에 없는 의미를 남겨 두지 않는다 — 보류가 아니라 삭제한다
삭제한 것을 이 파일에 남겨 두지 않는다 — 이력은 ../HISTORY.md 로
원본 문서보다 세게 쓰지 않는다 — 정도 조절을 금지로 바꾸지 않는다
충돌을 임의로 해결하지 않는다 — conflicts_with 로 노출하고 Human 이 결정한다
```
