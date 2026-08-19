# Growth Overlay — Capability 획득 경로

Master Capability 를 **"세계 안에서 어떻게 얻는가"**(Class / Item / Actor / World Interaction)
관점으로 겹쳐 본 결과다. [../overlay.md](../overlay.md) 와 축이 다르다.

```text
../overlay.md      그 의미가 세계에 구현되어 있는가        있는가 / 없는가
이 문서            그 Capability 를 얻는 경로가 있는가      가질 수 있는가 / 없는가
```

둘을 헷갈리면 안 된다. 공격력이 피해를 바꾸는 것(구현됨)과 플레이어가 공격력을 올릴 수
있는 것(획득 경로)은 다른 이야기이고, **지금 이 프로젝트가 정확히 그 사이에 걸려 있다.**

GR = `design/Master-Intent-Graph-Growth.md`. 형식: [../SCHEMA.md](../SCHEMA.md).

## 지금 상태 — 한 줄로

세계 안에서 무언가를 **가지게 되는** 경로가 하나도 없다. 획득 경로 표가 전부 "없음" 인
것은 노드를 아직 안 세워서가 아니라, 세계에 그런 종류의 사건이 없기 때문이다.

```text
Class(CL-*)      노드 0 개
Item(IT-* IP-*)  노드 2 개 — BW §10 이 직접 명명한 경계결정 계열뿐
Modifier(IM-*)   노드 0 개
grants 배선      0 건 — 따라서 모든 Capability 의 획득 경로가 미완이다
```

## 표

경로 노드가 없는 Capability 를 전부 나열하지 않는다. 경로가 문서로 예고되었거나
부재가 코드로 확인된 것만 판정한다.

| Capability | 획득 경로 | 근거 | 부족한 것 |
|---|---|---|---|
| MC-ATTACK-POWER | **없음** | 코드 대조 — 능력치를 바꾸는 유일한 규칙이 디버그 명령이다. 장착도 소모품도 훈련도 레벨도 없고, 스폰 시 종류별 기본값이 정해진 뒤 그대로다 | 이 값을 올리는 세계 내 경로 전부 |
| MC-CUT-ABNORMAL-STRUCTURE | IT-BOUNDARY-BLADE (예고 — BW §17) | BW §10 · §17 이 경계결정 → Boundary Blade → 이 Capability 사슬을 명시한다 | `grants` 는 스키마상 IM-*/CL-* 소유다. 제작(조합 규칙)이 정해져 IM 이 서기 전까지 배선 없음. 세계 구현도 전무 |
| MC-RESTORE-BIOLOGICAL-STATE | **없음** | BW §8 은 원천(회귀초 — MW-HYPER-PREDATION 적응)만 명시하고 Item ID 를 명명하지 않았다 | 회귀초의 IT-* 노드와 획득·사용 규칙 전부. 문서가 ID 를 주지 않아 세우지 않았다 (지어내지 않는다) |
| 전투 Capability 전반 | **없음** | 코드 대조 — 배우거나 얻거나 되는 사건이 세계에 없다 | 위와 같음 |

### 채집은 있는데 왜 획득 경로가 없다고 하는가

세계에 채집이 하나 있다 — 곡괭이를 들고 광맥에 다가가 돌을 캔다. 그런데 그 돌은
개수만 세어지고 아무 데도 쓰이지 않는다. 만들 것도, 장착할 것도, 팔 상대도 없다.
곡괭이 자체도 시작할 때 그냥 주어지고 닳지 않는다.

그러니 세계에는 **물건을 얻는 행위**는 있고 **그 물건으로 달라지는 것**이 없다.
Growth 의 관점에서 이것은 경로가 아니라 경로의 앞부분 한 칸이다.

## 이것이 막고 있는 것

`MP-ADAPT-BY-RESOURCE`(possibilities.yaml) 가 이 공백의 정확한 피해자다.
그 노드는 BW §17 의 순환 — 탐험에서 얻은 자원이 다음 탐험의 조건이 된다 — 을 그래프에
세운 것인데, 요구하는 두 Capability 가 모두 획득 경로 없음이라 순환이 시작되지 않는다.

```text
BW §17 이 말하는 순환                        지금 끊긴 자리
────────────────────────────────────────────────────────────
지역에 들어간다                              지역이 없다
  ↓
자원을 얻는다                                광석 하나만 · 쓸모 없음   ← 끊김
  ↓
그 자원이 능력을 준다                        grants 배선 0 건          ← 끊김
  ↓
그 능력으로 더 깊은 지역에 간다              지역이 없다
```

## 채워지는 경로

```text
master/root.md (Root Game Goal · World Premise — Human)
      ↓
WHY — 세계 사실(MW-*)이 생긴다
      ↓
OPTIONS / NEED — 그 세계에서 Possibility 와 필요 Capability 가 나온다
      ↓
탐색 4단계가 origin_trace 를 갖춘 CL-* / IT-* 노드를 세운다   ← 주입이 아니다
      ↓
이 표에 획득 경로가 채워진다
```

Class / Item 노드는 `origin_trace`(World Cause) 필수다 (DC-GROWTH-CLASS-ORIGIN-TRACE).
IT-BOUNDARY-BLADE · IP-BOUNDARY-STABLE 은 MW-SPATIAL-SHEAR trace 로 섰다.

이 파일에는 **현재 상태만** 둔다 — 갱신 이력은 [../HISTORY.md](../HISTORY.md) 소유다.
Cycle Agent 는 이 파일을 직접 편집하지 않는다.
