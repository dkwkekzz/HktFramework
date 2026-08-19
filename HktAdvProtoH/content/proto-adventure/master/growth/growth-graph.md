# Growth Overlay — Capability 획득 경로

Master Capability 를 **"세계 안에서 어떻게 얻는가"**(Class / Item / Actor / World Interaction)
관점으로 겹쳐 본 결과다. 기존 [../overlay.md](../overlay.md)(그 의미가 세계에 **구현되어
있는가**)와 축이 다르다 — 여기는 그 Capability 를 얻는 **경로가 존재하는가**다 (GR §22.1 · §39).
GR = `design/Master-Intent-Graph-Growth.md`. 형식: [../SCHEMA.md](../SCHEMA.md).

기준 시점: **BW(베이라 세계관) 주입 (2026-08-19)** — `growth/items/` 에 IP 1 · IT 1,
`growth/classes/` 는 노드 0 개.

## 상태

Class(`CL-*`) 노드는 아직 없고, Item 노드는 BW §10 이 직접 명명한 2종
(IP-BOUNDARY-STABLE · IT-BOUNDARY-BLADE)만 있다 — **grants 배선은 아직 없어
모든 Capability 의 획득 경로가 미완이다.** 경로 노드가 없는 Capability 를 전부
나열하지 않고, 경로가 문서로 예고되었거나 부재가 실측으로 드러난 것만 판정한다.
나머지는 경로 노드가 생길 때 이 표에 추가한다.

| Capability | 획득 경로 (grants 하는 CL-* / IT-* / MA-*) | 근거 | 부족한 것 |
|---|---|---|---|
| MC-ATTACK-POWER | 없음 | C010 08-verification 은 공격력 40→80 변경을 세계 밖 값 조작으로 실측했다 — semantic 이 말하는 "장비·성장·버프가 이 값을 올린다"의 세계 내 행위가 존재하지 않는다 | 이 값을 올리는 세계 내 경로 전부 — 장착할 Item 도, 될 Class 도, 배울 Actor 도 없다 |
| MC-CUT-ABNORMAL-STRUCTURE | IT-BOUNDARY-BLADE (예고 — BW §17) | BW §10 · §17 이 경계결정 → Boundary Blade → 이 Capability 사슬을 명시한다 | grants 는 스키마상 IM-*/CL-* 소유다 — 제작(조합 규칙)이 정해져 IM 이 서기 전까지 배선 없음. 세계 구현도 전무 (overlay MISSING) |
| MC-RESTORE-BIOLOGICAL-STATE | 없음 | BW §8 은 원천(회귀초 — MW-HYPER-PREDATION 적응)만 명시하고 Item ID 를 명명하지 않았다 | 회귀초의 IT-* 노드와 획득·사용 규칙 전부 — 문서가 ID 를 주지 않아 세우지 않았다 (지어내지 않는다) |

MP-OUTGROW-THE-OPPONENT("성장해서 힘으로 넘어선다")는 overlay.md 기준으로 닫힌
경로지만(C010), **성장이라는 행위 자체는 아직 세계 안에 없다** — 능력치가 존재하고
피해에 반영되는 것(구현)과 그 능력치를 플레이로 올릴 수 있는 것(획득 경로)은 다르다.

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

Class / Item 노드는 origin_trace(World Cause) 필수다(DC-GROWTH-CLASS-ORIGIN-TRACE).
BW 주입(2026-08-19)으로 World Cause 가 생기기 시작했다 — IT-BOUNDARY-BLADE ·
IP-BOUNDARY-STABLE 은 MW-SPATIAL-SHEAR trace 로 섰다. 전투 Capability 쪽 경로는
여전히 Q2(전투 Goal 의 World Cause 배선)가 닫혀야 채울 수 있다.

이 파일에는 **현재 상태만** 둔다 — 갱신 이력은 [../HISTORY.md](../HISTORY.md) 소유다.
Cycle Agent 는 이 파일을 직접 편집하지 않는다.
