# Frontier

Frontier 는 Graph 의 절대 Leaf 가 아니라 **현재 세계 기준으로 아직 없는 가장 작은
플레이 가능한 Capability 단위**다. 기본 절차 **NEXT** 단계의 산출물이며,
Human 이 여기서 하나를 골라 다음 Cycle Goal 로 삼는다 (Human Select → 8 Stage Cycle).

    기준 Overlay   master/overlay.md — BW 주입 + Q2·Q3·Q8·Q11·Q17~Q19 결정 반영 (2026-08-19)
    근거 문서      전투 R1·DT · 세계 BW (매핑된 전투 노드에는 BW 보조 근거 허용 — Q18(a))

## 지금 어디까지 왔는가

**전투 사다리** (R1 §14 — 층은 이름으로 가리킨다):

```text
설계 §14 층          지금
────────────────────────────────────────────
Basic Damage         섰다
Critical             열렸다 — Q11(b) 확률 허용 ← 후보 (아래)
Defense Action       섰다
Damage Type          섰다
Penetration          ← 후보 (아래)
Active Defense       대기 — 사유는 "지금 열 수 없는 것"
Aura / Nen           대기 — 사유는 "지금 열 수 없는 것"
```

**탐험 사다리** (BW §19~§25 — 이번에 열린 새 축):

```text
BW 층                지금
────────────────────────────────────────────
SAFE FRONTIER        전투 프로토타입이 사실상 이 층이다 (기본 공격·방어·기력)
FRINGE 진입          ← 첫 결손 MC-OBSERVE 가 후보 (아래)
WILD ~ UNKNOWN       대기 — 아래 층부터 순서대로
```

어느 Cycle 이 어느 층을 닫았는지는 [HISTORY.md](HISTORY.md) 에 있다.

## 후보

### FR-PENETRATION-DEVALUES-THE-WALL
    Playable Result      플레이어가 방어를 두껍게 굳혀 벽처럼 버티는 상대 앞에서,
                         그 방어를 얼마간 통하지 않게 만들어 제 피해를 넣는다
    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-PIERCE-THE-HARD-DEFENSE
    Missing / Partial    MC-PENETRATION (MISSING) — 이것 하나뿐이다.
                         나머지 요구 3종과 지식 1종은 이미 세계에 있다 (C012 까지)
    원본 근거            R1 §14 Penetration · DT §15 (어디에 붙는가 · 금지) ·
                         R1 핵심 원칙 (새 공식을 만들지 않는다)
    Active Constraints   DC-COMBAT-PLAYER-CAUSALITY(REVISED) · DC-COMBAT-ONE-FORMULA ·
                         DC-COMBAT-ONE-LAYER-AT-A-TIME · DC-COMBAT-MATCHUP-SOFT ·
                         DC-WORLD-OWNS-THE-SURFACE-LIST
    Constraint Eval      SATISFIED — 관통은 방어를 확률로 무시하지 않고 결정적으로 깎는다
                         (CAUSALITY 의 Critical 예외와 무관한 결정 경로). 새 공식 없이
                         기존 감쇄식이 읽는 방어 값 하나를 바꾼다 (ONE-FORMULA).
                         타입 대응이 고른 방어에만 작용한다 (ONE-LAYER · DT §15).
                         배율표 금지·최소 1 피해·깎인 값 관찰 가능 (MATCHUP-SOFT).
                         깎이기 전후의 방어를 세계가 관찰에 싣는다 (SURFACE-LIST)
    Observable Result    같은 상대·같은 스킬인데 관통을 지닌 쪽이 더 큰 피해를 넣고,
                         그 차이가 계산 내역으로 설명되며, 두꺼운 상대일수록 몫이 커진다
    Why one Cycle        새 공식·새 행동·새 모션이 없다 — C012 가 고른 방어 값에
                         그 값을 깎는 의미 하나가 붙는다
    7 조건               1 MISSING · 2 네 번째 전투 경로를 연다 · 3 Client 실측 가능 ·
                         4 한 Cycle · 5 새 World 규칙("방어만으로 안전하지 않다") ·
                         6 Active 와 양립 · 7 Active Defense 층이 그대로 얹힌다
    Status               PROPOSED

### FR-CRITICAL-AMPLIFIES-THE-BLOW
    Playable Result      같은 공격이 이따금 크게 증폭되어 터지고, 플레이어는 성장·장비로
                         그 확률과 증폭을 키워 "터질 수 있는 몸"을 만든다
    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-BET-ON-THE-CRITICAL-BLOW
    Missing / Partial    MC-CRITICAL-STRIKE (MISSING) — 이것 하나뿐이다.
                         MC-COMBAT-STRIKE · MC-ATTACK-POWER 는 IMPLEMENTED
    원본 근거            R1 §14 C011 (Critical Chance · Critical Damage) ·
                         R1 핵심 원칙 (Critical 은 Final Damage 를 증폭한다) ·
                         Q11(b) Human 결정 (확률 Critical 허용 — CAUSALITY REVISED)
    Active Constraints   DC-COMBAT-PLAYER-CAUSALITY(REVISED) · DC-COMBAT-ONE-FORMULA ·
                         DC-COMBAT-ONE-LAYER-AT-A-TIME · DC-WORLD-OWNS-THE-SURFACE-LIST
    Constraint Eval      SATISFIED — Critical 은 REVISED 가 명시한 단일 확률 예외이고,
                         발생 여부·증폭이 계산 경위에 드러나야 한다 (explainable_result).
                         새 공식이 아니라 Final Damage 증폭이다 (ONE-FORMULA · R1 핵심 원칙).
                         Damage Type 층(C012)이 검증된 뒤라 한 층 원칙과 양립 (ONE-LAYER).
                         Critical 성질(확률·증폭)을 세계가 관찰에 싣는다 (SURFACE-LIST)
    Observable Result    같은 조건 반복에서 대부분 같은 피해가 나오다 이따금 증폭된 피해가
                         나오고, 그 타격의 계산 내역에 Critical 여부·배율이 찍히며,
                         Critical 성질을 올리면 빈도·크기가 달라지는 것이 보인다
    Why one Cycle        기본 공식 위의 결과값 수정 하나다 — R1 §14 가 이 층을
                         "가장 전통적인 RPG 요소 하나만 추가" 로 못 박았다
    7 조건               1 MISSING · 2 전투 경로에 분산(variance) 축을 연다 · 3 Client
                         실측 가능(반복 관찰) · 4 한 Cycle · 5 새 World 규칙 ·
                         6 REVISED CAUSALITY 와 양립 · 7 이후 층이 그대로 얹힌다
    Status               PROPOSED

### FR-OBSERVE-REVEALS-THE-OPPONENT
    Playable Result      상대를 관찰하는 행동이 존재하고, 상대의 방어 형태·능력 같은
                         정보 일부가 관찰해야만 드러난다 — 보지 않고 덤비는 플레이어와
                         관찰하고 덤비는 플레이어가 다른 정보를 가진 채 싸운다
    Source Goal          MG-EXPLORE-BEIRA
    Source Possibility   MP-VENTURE-INTO-FRINGE
    Missing / Partial    MC-OBSERVE (MISSING) — 진입 요구 3종 중 첫 하나로 쪼갰다.
                         쪼갠 사유: 셋을 한 Cycle 에 닫으면 관찰·예측·지형이 각각
                         검증되지 않는다. MC-OBSERVE 는 지역 기반 없이 현재 전투 세계
                         안에서 닫을 수 있는 유일한 조각이다
    원본 근거            BW §21 (FRINGE — 관찰·예측·지형) · §32 (관찰 → 이해 → 대응) ·
                         Q3 결정 (전투 정보는 상황에 따라 부분적으로 보이거나 가려진다)
    Active Constraints   DC-WORLD-PROGRESSION-IS-REACH · DC-COMBAT-MATCHUP-SOFT ·
                         DC-WORLD-OWNS-THE-SURFACE-LIST · DC-WORLD-PLAYER-UNFIXED-PATH
    Constraint Eval      SATISFIED — 관찰이 이해를, 이해가 대응을 연다 (PROGRESSION-IS-REACH ·
                         BW §32 의 첫 두 칸). weakness_is_observable 은 "관찰 행동을 하면
                         알 수 있다" 로 유지된다 — 가리는 것이 아니라 아는 방법을 행동으로
                         만든다 (MATCHUP-SOFT). 무엇이 기본 공개이고 무엇이 관찰 뒤에
                         있는지의 목록은 세계가 소유한다 (SURFACE-LIST). 관찰은 강제
                         절차가 아니라 선택이다 (PLAYER-UNFIXED-PATH)
    Observable Result    관찰 전에는 상대의 일부 정보가 비어 있고, 관찰 행동 후 같은
                         정보가 채워져 보이며, 그 차이가 준비(무기 선택 등)를 바꾼다
    Why one Cycle        새 행동 하나(관찰)와 정보 공개 시점의 규칙 하나다 — 지역·이동
                         같은 세계 기반을 요구하지 않고 현재 전투 무대 안에서 닫힌다
    7 조건               1 MISSING · 2 탐험 Root 의 첫 Possibility 를 전진 · 3 Client
                         실측 가능 · 4 한 Cycle · 5 새 World 규칙(정보는 관찰의 결과다) ·
                         6 Active 와 양립 (위) · 7 MC-PREDICT · FRINGE 진입이 이 위에 얹힌다
    Status               PROPOSED

## 추천 순서 (Agent 제안 — 확정은 Human)

```text
1. FR-PENETRATION-DEVALUES-THE-WALL   전투 사다리의 원래 다음 층 — 결손 하나, 가장 작다
2. FR-OBSERVE-REVEALS-THE-OPPONENT    탐험 축의 첫 삽 — Q3 결정(부분 공개)을 세계 규칙로
                                      세우고, 이후 FRINGE 진입·베이라 확장의 기반이 된다
3. FR-CRITICAL-AMPLIFIES-THE-BLOW     열렸지만 급하지 않다 — 다른 층의 전제가 아니고
                                      분산 축은 언제 넣어도 얹힌다
```

## 지금 열 수 없는 것

각각 막힌 이유가 다르다. 이유가 사라지면 후보로 올린다.

| 층 / 후보 | 무엇이 막고 있는가 |
|---|---|
| FRINGE 진입 완주 (MP-VENTURE-INTO-FRINGE) | 결손 MC-PREDICT · MC-USE-TERRAIN + 지역(SAFE↔FRINGE 경계)이라는 세계 기반. MC-OBSERVE Cycle 이 먼저다 |
| WILD 이하 진입 (MP-VENTURE-INTO-WILD ~ UNKNOWN) | 윗층 진입이 먼저다 (MW-DEPTH-GRADIENT). 각 층 결손 4~6종 |
| Active Defense (완벽한 막기·되받아치기·Break) | R1 §15 층 그림에서 Penetration 위다. 두 문서는 이름만 예고 — 그 층의 설계 문서가 와야 한다 |
| Aura / Nen (집중·조건·제약·서약) | 사다리의 맨 위 — 아래 층이 서야 의미가 생긴다 |
| Evade (회피) | R1 §13 이 이후 확장으로만 지정 — §14 순서에 자리가 없다 |
| MG-ACQUIRE-RARE-ORGAN 의 대안 4종 (줍기·거래·사체·강제) | requires 미배선 (BW 는 구조만 공급) + WILD 지역·기관·거래 상대라는 세계 기반이 없다 — OPTIONS/NEED 와 지역 기반 후속 |
| MP-CONTROL-MOVEMENT · MP-WEAPONIZE-ENVIRONMENT | 결손 2~3종 + (후자는) Hazard 세계 기반. MP-INTERRUPT 는 결손 하나(MC-INTERRUPT)라 다음 회차 후보 가능 |

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
