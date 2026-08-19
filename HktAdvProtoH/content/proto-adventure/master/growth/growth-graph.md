# Growth Overlay — Capability 획득 경로

Master Capability 를 **"세계 안에서 어떻게 얻는가"**(Class / Item / Actor / World Interaction)
관점으로 겹쳐 본 결과다. [../overlay.md](../overlay.md) 와 축이 다르다.

```text
../overlay.md      그 의미가 세계에 구현되어 있는가        있는가 / 없는가
이 문서            그 Capability 를 얻는 경로가 있는가      가질 수 있는가 / 없는가
```

둘을 헷갈리면 안 된다. 공격력이 피해를 바꾸는 것(구현됨)과 플레이어가 공격력을 올릴 수
있는 것(획득 경로)은 다른 이야기이고, 지금 이 프로젝트가 정확히 그 사이에 걸려 있다.

GR = `design/Master-Intent-Graph-Growth.md`. 형식: [../SCHEMA.md](../SCHEMA.md).

## 광물 — 어디서 왔고 무엇을 여는가

Q22 로 세계의 광물을 정의했다. 각 광물은 **어떤 압력이 그것만 남겼는가**를 갖는다 —
좋은 것을 위험한 곳에 배치한 것이 아니라, 그 환경이 남긴 것이 인간에게 값진 것이다
(BW §11 · §33 · DC-WORLD-RESOURCE-ADAPTATION-TRACE).

| 광물 | 유래 | 왜 그것만 남았나 | 성질 | 제작물 | 여는 Capability |
|---|---|---|---|---|---|
| 평범한 돌 | MW-SAFE-FRONTIER | 변화시키는 압력이 없어 그냥 남았다 — 겪은 일이 없다 | 없음 (그것이 요점) | IT-COMMON-STONE | 없음 |
| 경계결정 | MW-SPATIAL-SHEAR | 공간이 어긋나도 구조적 연속성을 유지했다 | IP-BOUNDARY-STABLE | IT-BOUNDARY-BLADE | **MC-CUT-ABNORMAL-STRUCTURE** (IM-BOUNDARY-EDGED) |
| 불식광 | MW-ZONE-WILD | 독과 삭임이 만연해 반응하는 것은 다 사라졌다 | IP-UNREACTIVE | IT-SEALED-VESSEL | 없음 (사유 아래) |
| 산격석 | MW-ZONE-DANGER | 충격을 한 점에 받는 구조는 부서지고 흩어 보내는 것만 남았다 | IP-SHOCK-DISPERSING | IT-WARDING-PLATE | 없음 (사유 아래) |
| 불연정 | MW-ZONE-DEEP | 공생 Network 에 끌려 들어간 것은 그 체계의 일부가 되었고, 끌려 들어가지 않은 것만 광물로 남았다 | IP-BIOLOGICALLY-CLOSED | IT-SEVERING-BLADE | **MC-BREAK-BIOLOGICAL-LINK** (IM-BIO-SEVERING) |
| 정박정 | MW-ZONE-UNKNOWN | 정체가 흔들린 것은 더 이상 그것이 아니게 되고, 자기 동일성을 잃지 않은 것만 같은 것으로 남았다 | IP-SELF-IDENTICAL | IT-ANCHOR-STONE | **MC-IDENTITY-ANCHOR** (IM-IDENTITY-ANCHORED) |

### 왜 둘은 아무 능력도 열지 않는가

불식광과 산격석은 성질과 제작물만 있고 `grants` 가 비어 있다. 빠뜨린 것이 아니다.

지금 어떤 Possibility 도 "삭임을 견딘다" 나 "환경 위험을 견딘다" 를 요구하지 않는다.
요구가 없는데 자원이 있다는 이유로 Capability 를 만들면 그 순간 방향이 뒤집힌다 —
`DC-GROWTH-NEED-FROM-POSSIBILITY` 와 BW §18 이 금지하는 바로 그 형태다.
요구하는 경로가 생기면 그때 잇는다. 그때까지 이 둘은 재료이고, 그것으로 충분하다.
세계압은 가능성을 늘릴 뿐 전리품을 보장하지 않는다 (BW §12).

### BW §17 순환이 그래프에서 닫혔다

세 개의 `grants` 배선이 "한 층의 산물이 다음 층의 조건이 된다" 를 실제 간선으로 만든다.

```text
MW-SPATIAL-SHEAR   → 경계결정 → MC-CUT-ABNORMAL-STRUCTURE  → MP-ADAPT-BY-RESOURCE
MW-ZONE-DEEP       → 불연정   → MC-BREAK-BIOLOGICAL-LINK   → MW-ZONE-UNKNOWN 의 demands
MW-ZONE-UNKNOWN    → 정박정   → MC-IDENTITY-ANCHOR         → MW-ZONE-UNKNOWN 의 demands
```

세 경우 모두 **필요가 먼저 있었고 경로가 나중에 붙었다.** 세 Capability 전부
이 광물들을 세우기 전부터 어떤 Possibility 나 층이 요구하고 있던 노드다.

아래 둘은 특히 순환이 좁게 도는 경우다 — DEEP 에서 얻은 것이 UNKNOWN 을 열고,
UNKNOWN 에서 얻은 것이 다시 UNKNOWN 을 더 감당하게 한다. 한 번 다녀와 본 사람만
제대로 들어갈 수 있다는 형태이며, BW §16 탐험 Loop 가 층 안에서도 도는 경우다.

## 아직 경로가 없는 것

| Capability | 획득 경로 | 근거 | 부족한 것 |
|---|---|---|---|
| MC-PENETRATION | **없음** | C013 08-verification 은 관통 값의 변경을 **디버그 명령**으로 실측했다. 종류가 정한 초기값 외에 이 값을 바꾸는 세계 내 행위가 없다 — 08 이 그 사실을 Possibility 주의로 직접 보고했다 | 관통을 얻는 경로 전부. 형태(장비·성장·준비 행동)가 정해지지 않았다 |
| MC-ATTACK-POWER | **없음** | 코드 대조 — 능력치를 바꾸는 유일한 규칙이 디버그 명령이다. 장착도 소모품도 훈련도 레벨도 없고, 스폰 시 종류별 기본값이 정해진 뒤 그대로다 | 이 값을 올리는 세계 내 경로 전부. 광물을 세워도 **쓰는 규칙**이 없으면 그대로다 |
| MC-RESTORE-BIOLOGICAL-STATE | **없음** | BW §8 은 원천(회귀초)만 명시하고 Item ID 를 명명하지 않았다 | 회귀초의 IT-* 와 획득·사용 규칙. 문서가 ID 를 주지 않아 세우지 않았다 — 광물은 Q22 로 정의했으나 식물은 Human 지시 범위 밖이었다 |
| 전투 Capability 전반 | **없음** | 코드 대조 — 배우거나 얻거나 되는 사건이 세계에 없다 | Class(CL-*) 노드 0 개 |

### 채집은 있는데 왜 획득 경로가 없다고 하는가

세계에 채집이 하나 있다 — 곡괭이를 들고 광맥에 다가가 돌을 캔다. 그 돌이 이제
`IT-COMMON-STONE` 으로 세계 유래를 갖게 되었지만, 여전히 개수만 세어지고 아무 데도
쓰이지 않는다. 만들 것도, 장착할 것도, 팔 상대도 없다.

그러니 세계에는 **물건을 얻는 행위**는 있고 **그 물건으로 달라지는 것**이 없다.
Growth 의 관점에서 이것은 경로가 아니라 경로의 앞부분 한 칸이다.
설계에서 순환이 닫힌 것과 세계에서 순환이 도는 것은 다르다.

## 구현 현황

| 층 | 상태 |
|---|---|
| 설계 (이 문서) | IP 5 · IT 6 · IM 3 · grants 3 건 — BW §17 순환이 그래프에서 닫혔다 |
| 세계 (`world/`) | 광물 1 종(돌)만 존재하고 쓰임이 없다. 제작·장착·거래 규칙 전무 |

## 채워지는 경로

```text
master/root.md (Root Game Goal · World Premise — Human)
      ↓
WHY — 세계 사실(MW-*)이 생긴다
      ↓
OPTIONS / NEED — 그 세계에서 Possibility 와 필요 Capability 가 나온다
      ↓
그 필요를 채우는 CL-* / IT-* / IM-* 가 origin_trace 를 갖추고 선다   ← 역방향 금지
      ↓
이 표에 획득 경로가 채워진다
```

Class 노드는 `origin_trace`(World Cause) 필수다 (DC-GROWTH-CLASS-ORIGIN-TRACE).
Item 도 같은 요구를 SCHEMA 의 `origin_trace` 로 진다 (GR §41 Item Gate).

이 파일에는 **현재 상태만** 둔다 — 갱신 이력은 [../HISTORY.md](../HISTORY.md) 소유다.
Cycle Agent 는 이 파일을 직접 편집하지 않는다.
