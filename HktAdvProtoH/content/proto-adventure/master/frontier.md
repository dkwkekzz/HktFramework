# Frontier

Frontier 는 Graph 의 절대 Leaf 가 아니라 **현재 세계 기준으로 아직 없는 가장 작은
플레이 가능한 Capability 단위**다. 기본 절차 **NEXT** 단계의 산출물이며,
Human 이 여기서 하나를 골라 다음 Cycle Goal 로 삼는다.

    기준 Overlay   master/overlay.md — 코드 대조로 판정 6건을 정정한 상태
    근거 문서      전투 R1 · DT · 세계 BW (매핑된 전투 노드에는 BW 보조 근거 허용)

## 지금 어디까지 왔는가

**전투 사다리** (R1 §14):

```text
설계 §14 층          지금
────────────────────────────────────────────
Basic Damage         섰다
Critical             열렸다 — 후보 C
Defense Action       섰다
Damage Type          섰다
Penetration          섰다 (C013 — Human Play 확인 대기)
Active Defense       대기 — 그 층의 설계 문서가 와야 한다
Aura / Nen           대기 — 아래 층이 서야 의미가 생긴다
```

**탐험** — 층(어디)과 방법(어떻게)이 분리되었다 (HISTORY Q21):

```text
방법 3종                            지금
────────────────────────────────────────────
익힌다 (MP-LEARN-…)                 결손 2 — 첫 칸 MC-OBSERVE 가 후보 B
자원으로 빌린다 (MP-ADAPT-…)        설계는 섰고(Q22) 세계에 제작이 없다
문명권에서 준비한다 (MP-PREPARE-…)  문명권·거래라는 세계 기반이 없다

층이 요구하는 것 (MW-ZONE-*.demands)   SAFE 2/4 · FRINGE 0/3 · WILD 0/4
                                       DANGER 0/4 · DEEP 0/5 · UNKNOWN 0/6
```

**세계 순환** (BW §16 · §17) — 이번 대조로 드러난 축이다:

```text
탐험 → 자원 → 능력 → 더 깊은 탐험
설계    Q22 로 닫혔다 — 광물 6종 · grants 3건 (growth/growth-graph.md)
구현    네 칸 모두 비어 있다. 후보 D 가 첫 삽이다
```

## 진행 중

### FR-PENETRATION-DEVALUES-THE-WALL
    Status               SELECTED → C013-penetration-devalues-the-wall 실행 중
    남은 것              Human Play 확인. 그것이 끝나면 이 항목을 지우고 HISTORY.md 로 옮긴다
    코드 상태            구현·검증 완료 (overlay.md MC-PENETRATION 행 참조)

## 후보

### A. FR-INTERRUPT-DENIES-THE-BLOW
    Playable Result      플레이어가 상대의 행동이 완성되기 전에 그것을 노려 끊고,
                         그 공격이 아예 일어나지 않게 만든다
    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-INTERRUPT
    Missing / Partial    MC-INTERRUPT (PARTIAL) — 이것 하나뿐이고 그마저 절반 서 있다.
                         타격을 받으면 하던 행동이 끊기는 규칙은 이미 세계에 있다.
                         없는 것은 그것을 **노리는** 수단과 그 판단이다
    원본 근거            BW §28 (범용 Combat Graph 의 여덟 갈래 중 하나) ·
                         BW §23 (DANGER 층 요구 4종 중 하나)
    Active Constraints   DC-COMBAT-PLAYER-CAUSALITY · DC-COMBAT-ONE-FORMULA ·
                         DC-COMBAT-ONE-LAYER-AT-A-TIME · DC-WORLD-OWNS-THE-SURFACE-LIST
    Constraint Eval      SATISFIED — 끊김은 확률이 아니라 시점 관계로 판정된다.
                         피해 공식을 건드리지 않는다 (ONE-FORMULA). 능동 방어·Critical·
                         Aura 를 손대지 않는다 (ONE-LAYER). 무엇이 끊겼고 왜 끊겼는지를
                         세계가 관찰에 싣는다 (SURFACE-LIST)
    Observable Result    상대가 큰 행동을 시작한 것이 보이고, 거기에 맞춰 넣은 개입이
                         그 행동을 무산시키며, 같은 개입을 늦게 넣으면 무산되지 않는다
    Why one Cycle        새 공식도 새 자원도 없다 — 이미 있는 끊김 규칙에 "노려서 끊는"
                         조건 하나와 그것을 읽을 표면 하나가 붙는다
    7 조건               1 PARTIAL · 2 다섯 번째 전투 경로를 연다 · 3 Client 실측 가능 ·
                         4 한 Cycle · 5 새 World 규칙(행동에는 끊길 수 있는 구간이 있다) ·
                         6 Active 와 양립 · 7 DANGER 층 요구 4종 중 하나를 미리 채운다
    Status               PROPOSED

### B. FR-OBSERVE-REVEALS-THE-OPPONENT
    Playable Result      상대를 관찰하는 행동이 존재하고, 상대의 방어 형태·능력 같은
                         정보 일부가 관찰해야만 드러난다 — 보지 않고 덤비는 플레이어와
                         관찰하고 덤비는 플레이어가 다른 정보를 가진 채 싸운다
    Source Goal          MG-EXPLORE-BEIRA
    Source Possibility   MP-LEARN-TO-HANDLE-THE-LAYER
    Missing / Partial    MC-OBSERVE (MISSING) — 이 방법이 요구하는 둘 중 첫째다
                         (나머지는 MC-PREDICT). 둘을 한 Cycle 에 닫으면 관찰과 예측이
                         각각 검증되지 않아 쪼갰다. MC-OBSERVE 는 지역 기반 없이
                         현재 전투 세계 안에서 닫을 수 있다
    원본 근거            BW §21 (FRINGE — 관찰·예측·지형) · §32 (관찰 → 이해 → 대응)
    Active Constraints   DC-WORLD-PROGRESSION-IS-REACH · DC-COMBAT-MATCHUP-SOFT ·
                         DC-WORLD-OWNS-THE-SURFACE-LIST · DC-WORLD-PLAYER-UNFIXED-PATH
    Constraint Eval      SATISFIED — 관찰이 이해를, 이해가 대응을 연다 (PROGRESSION-IS-REACH).
                         약점은 여전히 알 수 있다 — 가리는 것이 아니라 아는 방법을 행동으로
                         만든다 (MATCHUP-SOFT). 무엇이 기본 공개이고 무엇이 관찰 뒤에
                         있는지의 목록은 세계가 소유한다 (SURFACE-LIST). 관찰은 강제
                         절차가 아니라 선택이다 (PLAYER-UNFIXED-PATH)
    Observable Result    관찰 전에는 상대의 일부 정보가 비어 있고, 관찰 후 같은 정보가
                         채워지며, 그 차이가 준비(무기 선택 등)를 바꾼다
    Why one Cycle        새 행동 하나(관찰)와 정보 공개 시점의 규칙 하나다 — 지역·이동
                         같은 세계 기반을 요구하지 않고 현재 무대 안에서 닫힌다
    주의                 이것은 세계의 **가장 근본적인 전제 하나를 뒤집는다** — 지금 세계는
                         모든 Actor 의 모든 속성을 모든 관찰자에게 무조건 싣는다.
                         가림이 생기면 기존 관찰 계약 전체가 영향을 받으므로,
                         무엇을 가릴지의 범위를 좁게 잡는 것이 이 Cycle 의 핵심 판단이다
    Status               PROPOSED

### C. FR-CRITICAL-AMPLIFIES-THE-BLOW
    Playable Result      같은 공격이 이따금 크게 증폭되어 터지고, 플레이어는 성장·장비로
                         그 확률과 증폭을 키워 "터질 수 있는 몸" 을 만든다
    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-BET-ON-THE-CRITICAL-BLOW
    Missing / Partial    MC-CRITICAL-STRIKE (MISSING) — 이것 하나뿐이다
    원본 근거            R1 §14 C011 (Critical Chance · Critical Damage) · R1 핵심 원칙 ·
                         Q11(b) Human 결정 (확률 Critical 허용 — CAUSALITY REVISED)
    Active Constraints   DC-COMBAT-PLAYER-CAUSALITY(REVISED) · DC-COMBAT-ONE-FORMULA ·
                         DC-COMBAT-ONE-LAYER-AT-A-TIME · DC-WORLD-OWNS-THE-SURFACE-LIST
    Constraint Eval      SATISFIED — REVISED 가 명시한 단일 확률 예외이고, 발생 여부·증폭이
                         계산 경위에 드러나야 한다. 새 공식이 아니라 Final Damage 증폭이다
    Observable Result    같은 조건 반복에서 대부분 같은 피해가 나오다 이따금 증폭된 피해가
                         나오고, 계산 내역에 증폭 여부·배율이 찍히며, 관련 성질을 올리면
                         빈도·크기가 달라진다
    Why one Cycle        기본 공식 위의 결과값 수정 하나다
    주의                 세계에 난수원을 처음 들이는 Cycle 이다 — 결정성 검증(같은 입력
                         같은 출력)에 seed 개념이 들어가므로 기존 테스트 전제가 바뀐다
    Status               PROPOSED

### D. FR-WHAT-YOU-GATHER-CHANGES-YOUR-BODY
    Playable Result      플레이어가 세계에서 캐거나 얻은 것을 써서 자기 능력치를 실제로
                         올리고, 그 전과 후의 전투 결과가 달라진다 — 디버그 명령이 아니라
                         플레이로
    Source Goal          MG-EXPLORE-BEIRA (그리고 MG-OVERCOME-SUPERIOR-OPPONENT)
    Source Possibility   MP-ADAPT-BY-RESOURCE 의 첫 칸 · MP-OUTGROW-THE-OPPONENT 의 결손
    Missing / Partial    MC-ATTACK-POWER (PARTIAL) — 값이 결과를 바꾸는 것은 닫혔고,
                         그 값을 **세계 안의 행위로** 올리는 경로가 없다.
                         growth/growth-graph.md 가 이 결손을 이미 판정하고 있다
    원본 근거            BW §17 (탐험에서 얻은 자원이 다음 탐험의 가능성을 연다) ·
                         BW §18 (Capability 가 먼저 필요해지고 그 다음 획득 Route) ·
                         BW §32 (Progression 은 Level 이 아니라 Reach)
    Active Constraints   DC-WORLD-PROGRESSION-IS-REACH · DC-WORLD-RESOURCE-ADAPTATION-TRACE ·
                         DC-COMBAT-ONE-FORMULA · DC-GROWTH-GOAL-FIRST ·
                         DC-GROWTH-CLASS-ORIGIN-TRACE
    Constraint Eval      SATISFIED — Q22 로 닫혔다. 지금 캐는 돌은 IT-COMMON-STONE 이고
                         MW-SAFE-FRONTIER 유래를 갖는다. 아무 성질이 없는 것이 그 땅의
                         세계 법칙이 낳은 결과이므로 `resource_placed_without_world_cause`
                         에 걸리지 않는다. 다만 그 성격이 이 Cycle 의 형태를 정한다 —
                         평범한 돌은 기적을 주지 않으므로, 여는 것은 **제작**(돌 → 도구·무기)
                         이지 능력치 직접 상승이 아니다. 기적적인 성장은 베이라 광물의 몫이다
                         (growth/growth-graph.md 광물 표)
    Observable Result    캐거나 얻은 것을 쓰기 전과 후에 같은 상대·같은 스킬의 피해가
                         달라지고, 그 차이가 계산 내역으로 설명된다
    Why one Cycle        새 전투 규칙이 없다 — 이미 있는 능력치에 그것을 바꾸는 세계 내
                         행위 하나가 붙는다
    7 조건               1 PARTIAL · 2 성장이라는 축 전체를 연다 · 3 Client 실측 가능 ·
                         4 한 Cycle · 5 새 World 규칙 · 6 Q22 로 Constraint 닫힘 ·
                         7 BW §17 순환의 첫 칸이 된다
    Status               PROPOSED

## 추천 순서 (Agent 제안 — 확정은 Human)

```text
1. A  FR-INTERRUPT-DENIES-THE-BLOW        가장 작다. 끊김 규칙이 이미 있어 조건 하나만
                                          붙이면 되고, DANGER 층 요구도 미리 채운다

2. D  FR-WHAT-YOU-GATHER-CHANGES-YOUR-BODY  가장 크게 막힌 것을 푼다. 성장이 세계 밖에
                                          있는 한 "닫혔다" 고 적은 전투 경로들도 실은
                                          절반이다. Q22 로 Constraint 판단이 닫혔다

3. B  FR-OBSERVE-REVEALS-THE-OPPONENT     탐험 축의 첫 삽. 파급이 크므로(관찰 계약 전체)
                                          범위를 좁게 잡아야 한다

4. C  FR-CRITICAL-AMPLIFIES-THE-BLOW      열렸지만 급하지 않다 — 다른 층의 전제가 아니고
                                          난수를 들이는 비용이 있다
```

## 지금 열 수 없는 것

각각 막힌 이유가 다르다. 이유가 사라지면 후보로 올린다.

| 층 / 후보 | 무엇이 막고 있는가 |
|---|---|
| 익히는 갈래 완주 (MP-LEARN-TO-HANDLE-THE-LAYER) | 결손 MC-PREDICT + 층이라는 세계 기반(MW-DEPTH-GRADIENT). 후보 B 가 먼저다 |
| 문명권에서 준비하는 갈래 (MP-PREPARE-IN-CIVILIZATION) | 문명권이라는 장소도, 주체 사이에 무언가가 오가는 경로도 없다. 요구 Capability 는 없으므로 막는 것은 전부 세계 기반이다 |
| 각 층 감당 (MW-ZONE-* 의 demands) | FRINGE 0/3 · WILD 0/4 · DANGER 0/4 · DEEP 0/5 · UNKNOWN 0/6. 얕은 층부터 채운다 (MW-DEPTH-GRADIENT) |
| MP-ADAPT-BY-RESOURCE 완주 (BW §17 순환) | Q22 로 **설계상 획득 경로는 섰다**(경계결정 → IM-BOUNDARY-EDGED → MC-CUT-ABNORMAL-STRUCTURE). 남은 것은 지역·제작이라는 세계 구현이다. 후보 D 가 그 첫 칸이다 |
| Active Defense (완벽한 막기·되받아치기·Guard Break) | R1 §15 층 그림에서 Penetration 위다. 두 문서는 이름만 예고 — 그 층의 설계 문서가 와야 한다 |
| Aura / Nen (집중·조건·제약·서약) | 사다리의 맨 위 — 아래 층이 서야 의미가 생긴다 |
| Evade (회피) | R1 §13 이 이후 확장으로만 지정 — §14 순서에 자리가 없다 |
| MG-ACQUIRE-RARE-ORGAN 의 대안 4종 (줍기·거래·사체·강제) | requires 미배선 (BW 는 구조만 공급) + 생물에게서 무언가가 나온다는 것 자체가 없다 |
| MP-CONTROL-MOVEMENT · MP-WEAPONIZE-ENVIRONMENT | 전자는 결손 1 + PARTIAL 2, 후자는 Hazard 세계 기반 자체가 없다 |

## 규칙

```text
Constraint 를 VIOLATE 하는 후보를 여기에 올리지 않는다 — Design Conflict 로 따로 제시한다.
Agent 는 후보와 근거를 제공하되 개발 우선순위를 확정하지 않는다.
선택된 FR-* 는 cycles/<CycleId>/01-cycle.md 의 MASTER TRACE 로 이어진다.
Cycle 이 닫히면 그 FR-* 를 이 파일에서 지우고 HISTORY.md 에 결과를 적는다.
대기 사유는 근거 문서의 문장으로 확인되어야 한다 — 지어내지 않는다.
```

이 파일은 **지금 고를 수 있는 것**만 담는다. 닫힌 Cycle 의 선택 기록과 거기서 배운 것은
[HISTORY.md](HISTORY.md) 가 소유한다.
