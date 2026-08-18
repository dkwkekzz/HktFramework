# Growth Overlay — Capability 획득 경로

Master Capability 를 **"세계 안에서 어떻게 얻는가"**(Class / Item / Actor / World Interaction)
관점으로 겹쳐 본 결과다. 기존 [../overlay.md](../overlay.md)(그 의미가 세계에 **구현되어
있는가**)와 축이 다르다 — 여기는 그 Capability 를 얻는 **경로가 존재하는가**다 (GR §22.1 · §39).
GR = `design/Master-Intent-Graph-Growth.md`. 형식: [../SCHEMA.md](../SCHEMA.md).

기준 시점: **C013 닫힘 (2026-08-18)** — `growth/classes/` `growth/items/` 에 노드 0 개.

## 상태

세계에 Class(`CL-*`) · Item(`IT-*` `IP-*` `IM-*`) 노드가 하나도 없다 —
**모든 Capability 의 획득 경로가 미정의다.** 경로 노드가 없는 Capability 를 전부
나열하지 않고, 획득 경로의 부재가 실측으로 드러난 대표 1건만 판정한다.
나머지는 경로 노드가 생길 때 이 표에 추가한다.

| Capability | 획득 경로 (grants 하는 CL-* / IT-* / MA-*) | 근거 | 부족한 것 |
|---|---|---|---|
| MC-ATTACK-POWER | 없음 | C010 08-verification 은 공격력 40→80 변경을 세계 밖 값 조작으로 실측했다 — semantic 이 말하는 "장비·성장·버프가 이 값을 올린다"의 세계 내 행위가 존재하지 않는다 | 이 값을 올리는 세계 내 경로 전부 — 장착할 Item 도, 될 Class 도, 배울 Actor 도 없다 |
| MC-PENETRATION | 없음 | C013 08-verification MASTER FEEDBACK — 관통은 존재 종류가 정한 값이거나 디버그 명령(`set-attribute`)으로만 바뀐다. "그 벽을 뚫기 위해 무언가를 한다"는 선택이 세계에 없다 | 같음 — 이 값을 얻는 세계 내 경로 전부 |

MP-OUTGROW-THE-OPPONENT("성장해서 힘으로 넘어선다")는 overlay.md 기준으로 닫힌
경로지만(C010), **성장이라는 행위 자체는 아직 세계 안에 없다** — 능력치가 존재하고
피해에 반영되는 것(구현)과 그 능력치를 플레이로 올릴 수 있는 것(획득 경로)은 다르다.
그 노드의 `requires.resource` 가 이미 "능력치를 올릴 장비·성장의 원천"을 요구하고 있으며,
이 표가 그것이 없다고 판정한다 — 두 문서가 같은 결손을 양쪽에서 가리킨다.
C013 이 같은 결손을 관통에서 다시 만났다 (MASTER FEEDBACK 의 FR-EARN-THE-PIERCING).
두 번 반복된 결손이므로 frontier.md 가 이것을 후보로 세운다.

## 채워지는 경로

```text
master/root.md (Root Game Goal · World Premise — Human, Q2)
      ↓
WHY — 세계 사실(MW-*)이 생긴다
      ↓
OPTIONS / NEED — 그 세계에서 Possibility 와 필요 Capability 가 나온다
      ↓
탐색 4단계가 origin_trace 를 갖춘 CL-* / IT-* 노드를 세운다   ← 주입이 아니다
      ↓
이 표에 획득 경로가 채워진다
```

**Class 와 Item 의 막힘 정도가 다르다.**

```text
CL-*   Master origin_trace(MW → MG → MP) 필수 — DC-GROWTH-CLASS-ORIGIN-TRACE · GR §24.2
       MW-* 가 하나도 없으므로 Q2(root.md)가 닫히기 전에는 한 개도 만들 수 없다
IT-*   Master 는 의미(semantic)만 요구한다 — GR §28.1. 출처 추적은 Runtime Instance 의
       obtained_from 이며(GR §29 · §30 · §41 Item 절) Master origin_trace 가 아니다
       → 세계에 이미 있는 획득 원천(Actor/Location/Event/Composition)에 붙이면 Q2 이전에도 성립한다
```

따라서 이 표의 "없음"을 처음 채울 수 있는 것은 Item 경로다 — 판단은 Human 이며
[../open-questions.md](../open-questions.md) Q17 이 그 결정을 대기한다.

이 파일에는 **현재 상태만** 둔다 — 갱신 이력은 [../HISTORY.md](../HISTORY.md) 소유다.
Cycle Agent 는 이 파일을 직접 편집하지 않는다.
