# Frontier

Frontier 는 Graph 의 절대 Leaf 가 아니라 **현재 세계 기준으로 아직 없는 가장 작은
플레이 가능한 단위**다. 기본 절차 **NEXT** 단계의 산출물이며,
Human 이 여기서 하나를 골라 다음 Cycle Goal 로 삼는다 (Human Select → 8 Stage Cycle).

    기준 Overlay   master/overlay.md — C013 닫힘 (2026-08-18)
                   master/growth/growth-graph.md — 획득 경로 축
    근거 문서      **영역을 넘지 않는다** (2026-08-18 Q15 결정)
                       전투   R1  design/Design-Combat-OffenseDefense-R0.md
                              DT  design/Design-Combat-DamageType-R0.md
                       성장   GR  design/Master-Intent-Graph-Growth.md
                   해당 영역의 문서가 이름조차 대지 않는 것은 후보로도 대기열로도 두지 않는다

## 지금 어디까지 왔는가

두 축이 있다. **무엇을 할 수 있는가**(전투 층)와 **그것을 어떻게 얻는가**(획득 경로)다.
전투 층은 R1 §14 순서대로 한 층씩 올려 왔고, 획득 경로는 아직 한 개도 없다.

```text
전투 층 (R1 §14)                    획득 경로 (GR)
──────────────────────────────      ─────────────────────────────
Basic Damage       섰다              Item  (IT-*)   0 개
Critical           건너뛰었다 — Q11   Class (CL-*)   0 개  — Q2 로 막혀 있다
Defense Action     섰다              Actor 전수      없다
Damage Type        섰다
Penetration        섰다 (C013)       → 세계의 모든 능력치는 종류가 정한 값이거나
Active Defense     대기 — 아래          디버그 명령으로만 바뀐다
Aura / Nen         대기 — 아래
```

전투 층의 다음 칸(Active Defense)은 원본이 이름만 대고 막혀 있다. 그동안 R1 이 스스로
예고한 깊이의 순서는 다음과 같다 — 첫 칸이 아직 비어 있다.

```text
장비 성장 → 빌드 → 능동 방어 → 기력 운용 → 넨식 조건과 제약     (R1 핵심 원칙 말미)
   ↑ 없다     섰다    막혔다
```

어느 Cycle 이 어느 층을 닫았는지는 [HISTORY.md](HISTORY.md) 에 있다.

## 후보

### FR-WHAT-I-HOLD-CHANGES-MY-BLOW
    Playable Result      플레이어가 세계에서 얻은 무기를 쥐면 자기 공격 능력치가 실제로
                         바뀌고, 같은 스킬로 같은 상대를 쳤는데 피해가 달라진다.
                         놓으면 원래 값으로 돌아온다
    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-OUTGROW-THE-OPPONENT
                         그 노드의 `requires.resource` 가 이미
                         "능력치를 올릴 장비·성장의 원천" 을 요구한다 — 그것이 없다
    Missing / Partial    Capability 축이 아니라 **획득 경로 축**의 결손이다.
                         growth-graph.md 가 두 건을 "획득 경로 없음" 으로 판정했다 —
                         MC-ATTACK-POWER (C010 이 값 조작으로만 실측) ·
                         MC-PENETRATION (C013 이 같은 결손을 다시 만났다).
                         **새 MC-* 를 만들지 않는다** — 필요성은 이미 Possibility 에 있고
                         Item 은 그 Capability 를 얻는 경로일 뿐이다
                         (DC-GROWTH-NEED-FROM-POSSIBILITY · NO-CAPABILITY-DUPLICATION)
    원본 근거            **영역별로 갈라 인용한다** (Q15)
                         전투 쪽 — 값이 바뀌면 무엇이 달라지는가:
                             R1 §12 (검을 교체해 Attack 100 → 120 · 계수가 큰 스킬이 더
                             큰 혜택을 받는다) · §16 (성공 조건 "공격력이 높으면 더 세다") ·
                             핵심 원칙 (새 공식을 만들지 않고 입력값에 의미 하나만 더한다)
                             — 이 인용은 전투 노드 MP-OUTGROW-THE-OPPONENT 가 이미 소유한 것이다
                         성장 쪽 — 획득 경로가 어떤 형태여야 하는가:
                             GR §27.1 (Item 은 Capability 를 제공하되 그 존재 이유를 만들지
                             않는다 · GOOD 예) · §28 (Definition / Instance 분리) ·
                             §28.1~§28.3 · §30 (Item 은 세계의 Actor / Location / Event /
                             Composition 을 통해 획득된다) · §41 Item Gate
    Active Constraints   DC-GROWTH-NEED-FROM-POSSIBILITY · DC-GROWTH-DEFINITION-INSTANCE-SPLIT ·
                         DC-GROWTH-NO-CAPABILITY-DUPLICATION · DC-GROWTH-GOAL-FIRST ·
                         DC-GROWTH-NOT-A-STAGE · DC-WORLD-OWNS-THE-SURFACE-LIST ·
                         DC-COMBAT-ONE-FORMULA · DC-COMBAT-PLAYER-CAUSALITY
                         (DC-GROWTH-CLASS-ORIGIN-TRACE 는 NOT_APPLICABLE — Class 를 만들지 않는다)
    Constraint Eval      SATISFIED
                         NEED-FROM-POSSIBILITY  새 Capability 를 만들지 않는다. 이미 있는
                             MC-ATTACK-POWER 에 획득 경로가 붙을 뿐이고 그 필요성은
                             MP-OUTGROW-THE-OPPONENT 에서 온다 (GR §27.1 GOOD 방향)
                         DEFINITION-INSTANCE-SPLIT  Master 에는 IT-* 의 의미만 둔다.
                             실제 무기 개체와 그 수치는 Runtime World 와 Cycle 소유이며,
                             조합을 사전 생성하지 않고 "공격력 +13" 을 Node 로 만들지 않는다
                         NO-CAPABILITY-DUPLICATION  MC-ATTACK-POWER 하나에 경로가 붙는다.
                             Item 전용 사본을 만들지 않는다
                         GOAL-FIRST  성장 자체가 Goal 이 아니다 — 기존 Goal 을 달성하는
                             기존 Possibility 의 미충족 resource 를 채운다
                         NOT-A-STAGE  새 Master Stage 가 생기지 않는다. NEED 위의 Overlay
                             결손을 Cycle 하나가 닫을 뿐이다
                         WORLD-OWNS-THE-SURFACE-LIST  무엇을 쥐었고 그것이 내 어느 값을
                             얼마로 만드는지를 세계가 계산해 관찰에 싣는다. View 는 더하지 않는다
                         COMBAT-ONE-FORMULA  새 피해 공식이 없다. 기존 공식의 입력값 하나가
                             달라질 뿐이다 (R1 핵심 원칙)
                         COMBAT-PLAYER-CAUSALITY  확률 옵션이 없다 — 같은 것을 쥐면 언제나 같은 값
    Observable Result    자기 패널의 공격 능력치가 쥔 것에 따라 바뀌고, 타격 경위의
                         "공격 기여" 항목이 그만큼 달라진다. 계수가 큰 스킬과 작은 스킬을
                         나눠 쳐 보면 큰 쪽이 더 크게 자란다 (R1 §12 의 성질이 처음으로
                         플레이로 나타난다). 놓으면 모든 표시가 원래대로 돌아온다
    Why one Cycle        새 피해 공식도 새 전투 행동도 없다. 기존 값 하나에 "지금 쥔 것이
                         이 값의 일부를 공급한다" 는 의미가 붙고, 그것을 세계에서 얻는
                         최소 경로 하나가 열린다
    Scope Note           쪼갤 수 있다 — ① 쥔 것이 값을 바꾼다 ② 세계에서 얻는다.
                         그러나 ① 만 두면 "디버그 명령으로만 얻는다" 가 되어 C013 이 지적한
                         결함이 그대로 반복된다. **얻는 경로 하나는 반드시 포함한다.**
                         그 원천을 무엇으로 할지는 Human 이 고른다 → open-questions Q17
    7 조건               1 획득 경로 축에서 MISSING (growth-graph.md 실측 2건) ·
                         2 MP-OUTGROW-THE-OPPONENT 를 처음으로 실제 플레이로 만든다
                           (MP-PIERCE-THE-HARD-DEFENSE 도 같은 결손을 공유한다) ·
                         3 쥐고 · 놓고 · 쳐 보는 것으로 Client 에서 확인된다 ·
                         4 한 Cycle 에 닫힌다 (위 Why one Cycle) ·
                         5 코드 Task 가 아니라 "세계에서 얻은 것이 내 능력의 일부가 된다" 는
                           새 World 규칙이다 · 6 Active Constraint 와 양립 (위 Constraint Eval) ·
                         7 이후의 모든 획득 경로(Class · Actor · Composition)가 재사용할
                           첫 경로로 누적된다
    Status               PROPOSED — Human 선택 대기

## 지금 열 수 없는 것

각각 막힌 이유가 다르다. 이유가 사라지면 후보로 올린다.

| 층 / 후보 | 무엇이 막고 있는가 |
|---|---|
| Active Defense (완벽한 막기·되받아치기·가드 브레이크) | 결손은 MC-PERFECT-GUARD · MC-COUNTER · MC-BREAK. R1 §14 C015 는 세 **이름만** 대고, DT §15 는 "이 문서는 그 효율을 정하지 않는다" 고 명시한다 — 후보 조건 ①(무엇을 더하는가)이 원본에 없다. 그 층의 설계 문서가 와야 한다 |
| Critical | DC-COMBAT-PLAYER-CAUSALITY 와 충돌 — Human 결정 대기 (Q11). R1 자신이 건너뛰기를 허용한다 ("Basic Damage 는 Critical 없이도 완전히 동작해야 한다") |
| Aura / Nen (집중·조건·제약·서약) | 사다리의 맨 위다. 아래 층이 서야 의미가 생긴다. 결손 MC-COMBAT-FLOW · MC-CONDITION-STACKING · MC-VOW · MC-FORTIFY. R1 §14 가 예시 한 줄(Attack ×1.3 · Defense ×0.7 · CP -5/sec)만 공급한다 |
| Evade (회피) | R1 §13 이 이후 확장으로만 지정하고 §14 확장 순서에는 자리를 주지 않았다 |
| 기력 회복 (MC-CP-ECONOMY 의 PARTIAL) | 기력이 스스로 돌아오지 않는 결손은 R1 §14 Aura/Nen 층(기력 집중)이 소유한다. R1 §11 · §16-3 은 지금의 루프(기본 공격이 벌고 고급 공격이 쓴다)를 그대로 성립시킨다 — 결손이지만 지금 층의 결손은 아니다 |
| Class 기반 성장 (CL-*) | origin_trace(MW → MG → MP) 필수인데 MW-* 가 0 개다 — Q2(root.md)가 닫히기 전에는 한 개도 만들 수 없다 (DC-GROWTH-CLASS-ORIGIN-TRACE) |
| 전투 밖 경로 (교섭·환경·정보) | Q8 — root.md 와 WHY/OPTIONS 확장이 선행한다 |

### 후보로 세우는 조건

한 후보는 그 영역의 원본이 다음 셋을 지정할 때 성립한다. 셋 중 하나라도 없으면 Cycle 이
없는 설계를 지어내 메우게 된다.

```text
1. 무엇을 더하는가        세계에 세우는 의미
2. 어디에 붙는가          기존 공식·구조의 어느 지점에 작용하는가
3. 무엇을 하면 안 되는가   이웃을 어떻게 침범하지 않는가
```

FR-WHAT-I-HOLD-CHANGES-MY-BLOW 는 셋을 모두 갖추었다 —
1 은 R1 §12(전투 쪽 근거), 2 는 R1 핵심 원칙 + GR §27.1 GOOD 예,
3 은 GR §28.2~§28.3(수치 옵션은 Node 가 아니다) · §31(조합 사전 생성 금지) · §34(성장이
Goal 을 대신하지 않는다) 이다.

## 규칙

```text
Constraint 를 VIOLATE 하는 후보를 여기에 올리지 않는다 — Design Conflict 로 따로 제시한다.
Agent 는 후보와 근거를 제공하되 개발 우선순위를 확정하지 않는다.
선택된 FR-* 는 cycles/<CycleId>/01-cycle.md 의 MASTER TRACE 로 이어진다.
Cycle 이 닫히면 그 FR-* 를 이 파일에서 지우고 HISTORY.md 에 결과를 적는다.
대기 사유는 근거 문서의 문장으로 확인되어야 한다 — 지어내지 않는다.
근거는 영역을 넘지 않는다 — 전투 근거로 성장 형태를, 성장 근거로 전투 의미를 정하지 않는다.
```

이 파일은 **지금 고를 수 있는 것**만 담는다. 닫힌 Cycle 의 선택 기록과 거기서 배운 것은
[HISTORY.md](HISTORY.md) 가 소유한다.
