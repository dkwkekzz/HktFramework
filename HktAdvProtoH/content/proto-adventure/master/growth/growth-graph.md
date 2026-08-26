# Growth Overlay — Capability 획득 경로

Master Capability 를 **"세계 안에서 어떻게 얻는가"**(Class / Item / Actor / World Interaction)
관점으로 겹쳐 본 결과다. [../overlay.md](../overlay.md) 와 축이 다르다.

```text
../overlay.md      그 의미가 세계에 구현되어 있는가        있는가 / 없는가
이 문서            그 Capability 를 얻는 경로가 있는가      가질 수 있는가 / 없는가
```

둘을 헷갈리면 안 된다. 공격력이 피해를 바꾸는 것(구현됨)과 플레이어가 공격력을 올릴 수
있는 것(획득 경로)은 다른 이야기이고, 지금 이 프로젝트가 정확히 그 사이에 걸려 있다.

GR = `design/Master-Intent-Graph-Growth.md` (공정 원본) ·
GS = `content/proto-adventure/design/Master-Fairy-Growth-System.md` (성장 기획 원본) ·
GB = `content/proto-adventure/design/Design-Growth-Balance-R0.md` (비용·보상 균형).
형식: [../SCHEMA.md](../SCHEMA.md).

이 문서가 답하는 것은 **얻을 수 있는가**다. GB 가 묻는 **그 값이 치른 것과 맞는가**는
아직 이 표에 없다 — 비용·보상 Profile 이 어디에 사는지가 정해지지 않았기 때문이다
(open-questions Q58). 정해지면 아래 표에 칸이 붙거나 옆에 표가 하나 선다.

## 성장의 원천 — 값이 어디에서 올라오는가

GS §5 · §19 주입으로 이 표가 생겼다. 이 문서가 지금까지 답하지 못하던 질문 —
"Capability 를 세계 안에서 어떻게 얻는가" 의 **Class 쪽 절반** — 이 여기서 시작한다.

| 성장 대상 | 원천 (무엇을 해야 오르는가) | 노드 | 세계 |
|---|---|---|---|
| Character Level | 전투 · 탐험 · 발견 · 사건 해결 | MC-GAIN-LEVEL | 없음 |
| 기본값 (생명력·공격력·방어력·기력·이동) | Character Level + Class | MC-ATTACK-POWER 외 — 값 자체는 이미 있다 | 값은 있고 **키우는 축이 없다** |
| Class Mastery | 그 형태 고유의 행동 | MC-GROW-CLASS-MASTERY | 없음 |
| Skill Mastery | 실제 사용과 난도 높은 활용 | MC-MASTER-A-SKILL | 없음 |
| Exploration Mastery | 자기 원리로 환경 문제 해결 | MC-GROW-EXPLORATION-MASTERY | 없음 |
| Equipment | 세계 자원 획득 · 제작 · 강화 | **MC-EQUIP-ITEM** | **있다** (C023 · C024) |
| Class Change | Level + Mastery + World Experience + Catalyst | MC-CHANGE-CLASS | 없음 — 넘어갈 형태(CL-*)가 없다 |

다섯 축 중 **하나만 세계에 서 있다**. 그리고 서 있는 그 하나는 성장이 아니라 자원으로
감당하는 갈래(MP-ADAPT-BY-RESOURCE)에 매달려 있다 — 물건을 걸면 값이 오르지만 그것은
값을 *키우는* 것이 아니라 *얹는* 것이다. 걸린 것을 풀면 정확히 원래 몸으로 돌아온다.

Class Catalyst(GS §6)의 자리는 비어 있다. GS 는 그것이 "강한 형태를 유지하기 위해 필요한
세계의 Property" 라고만 적고 어느 자원인지 명명하지 않는다 (태양심을 예로 들 뿐이다) —
자원의 이름과 유래는 승인 대기 중인 자원 카탈로그 문서가 소유한다.

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
| MC-ATTACK-POWER | **부분** — 장착 하나 (C023 · C024) | 코드 대조 — 걸어 둔 물건이 유효 값을 얹지만 기본값은 스폰 시 정해진 뒤 그대로이고, 그 값을 바꾸는 유일한 규칙은 여전히 디버그 명령이다 | 기본값을 **키우는** 경로. GS §19 주입으로 그 형태는 정해졌다 — 전투·탐험·발견·사건 해결이 Level 을 올리고 Level 이 기본값을 올린다 (MC-GAIN-LEVEL). 세계에 그 축이 없다 |
| MC-RESTORE-BIOLOGICAL-STATE | **없음** | BW §8 은 원천(회귀초)만 명시하고 Item ID 를 명명하지 않았다 | 회귀초의 IT-* 와 획득·사용 규칙. 문서가 ID 를 주지 않아 세우지 않았다 — 광물은 Q22 로 정의했으나 식물은 Human 지시 범위 밖이었다 쓰는 개념(MC-USE-ITEM)이 선 다음 Cycle 이 원천과 함께 가져온다 (HISTORY Q31) |
| 전투 Capability 전반 | **없음** | 코드 대조 — 배우거나 얻거나 되는 사건이 세계에 없다 | Class(CL-*) 노드 0 개. **GS 주입으로 그 자리의 형태는 섰다** — 사다리 넷(MS-CLASS-EVOLUTION)과 계열 여덟(MS-FAIRY-LINEAGE). 이름의 소유도 정해졌다 (HISTORY Q55(b) — GS 가 소유한다). 남은 것은 **계열별 설계 문서의 주입** 하나다 |

### grants 가 몸에 닿으려면 무엇이 먼저 서야 하는가

`IM-BOUNDARY-EDGED → MC-CUT-ABNORMAL-STRUCTURE` 같은 배선은 **설계의 간선**이다.
그 간선이 실제 몸의 능력이 되려면 세계에 "이 물건을 지금 적용하고 있다" 는 상태가
있어야 한다 — 그 자리가 `MC-EQUIP-ITEM` 이다 (IS §3 · §5.4). 그리고 그 물건이
재료에서 나오려면 `MC-CRAFT-FROM-MATERIALS` 가, 층에서 얻어 오려면
`MC-TRANSFER-ITEM` 이 서야 한다. 넷 다 지금은 MISSING 이다 (../overlay.md).

```text
IP 성질 ──► IM 조합 ──grants──► MC 능력        설계에서는 닫혀 있다 (Q22)
                                   │
                          MC-EQUIP-ITEM 이 없어 여기서 끊긴다   ← 세계의 결손
                                   │
                                 몸의 능력
```

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
| 설계 (이 문서) | IP 5 · IT 6 · IM 3 · grants 3 건 — BW §17 순환이 그래프에서 닫혔다. **CL 0** — 사다리와 계열은 systems.yaml 에 섰고, 채우는 것은 계열별 문서의 주입이다 (Q55(b)) |
| 세계 (`world/`) | 광물 1 종(돌)만 존재하고 쓰임이 없다. 제작·장착·거래 규칙 전무 |
| 결손의 이름 | IS 주입으로 넷이 노드가 되었다 — MC-USE-ITEM · MC-EQUIP-ITEM · MC-CRAFT-FROM-MATERIALS · MC-TRANSFER-ITEM (모두 MISSING) |

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
