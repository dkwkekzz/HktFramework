# Frontier

Frontier 는 Graph 의 절대 Leaf 가 아니라 **현재 세계 기준으로 아직 없는 가장 작은
플레이 가능한 Capability 단위**다. 기본 절차 **NEXT** 단계의 산출물이며,
Human 이 여기서 하나를 골라 다음 Cycle Goal 로 삼는다 (Human Select → 8 Stage Cycle).

    기준 Overlay   master/overlay.md — C013 · C014 완료 + 코드 대조 정정 반영
                   (전투 사다리는 Penetration 층까지 · 탐험은 FRINGE 첫 칸까지 섰다)
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
Penetration          섰다
Active Defense       대기 — 사유는 "지금 열 수 없는 것"
Aura / Nen           대기 — 사유는 "지금 열 수 없는 것"
```

**탐험** — 층(어디)과 방법(어떻게)이 분리되었다 (HISTORY Q21):

```text
방법 3종                            지금
────────────────────────────────────────────
익힌다 (MP-LEARN-…)                 C014 로 살펴봄이 PARTIAL — 남은 결손은 예측 하나 ← 후보
자원으로 빌린다 (MP-ADAPT-…)        설계는 섰고(Q22 광물 6종) 세계에 제작이 없다
문명권에서 준비한다 (MP-PREPARE-…)  문명권·거래라는 세계 기반이 없다

층이 요구하는 것 (MW-ZONE-*.demands)   SAFE 2/4 · FRINGE 1/3 · WILD 0/4
                                       DANGER 0/4 · DEEP 0/5 · UNKNOWN 0/6
```

**세계 순환** (BW §16 · §17):

```text
탐험 → 자원 → 능력 → 더 깊은 탐험
설계    Q22 로 닫혔다 — 광물 6종 · grants 3건 (growth/growth-graph.md)
구현    네 칸 모두 비어 있다 — 얻은 것으로 달라지는 것이 하나도 없다 ← 후보 D
```

어느 Cycle 이 어느 층을 닫았는지는 [HISTORY.md](HISTORY.md) 에 있다.

## 후보

### FR-INSIGHT-SEES-BEFORE-LOOKING
    Playable Result      플레이어가 기른 통찰이 높으면 상대의 일부가 살펴보지 않아도 이미
                         보이고, 낮으면 여전히 다가가 살펴봐야 한다 — 같은 상대 앞에서
                         내가 무엇을 아는지가 내 능력에 따라 달라진다
    Source Goal          MG-EXPLORE-BEIRA
    Source Possibility   MP-LEARN-TO-HANDLE-THE-LAYER
    Missing / Partial    MC-OBSERVE (PARTIAL) — 남은 결손 둘 중 **경로 쪽**을 닫는다.
                         앎에 이르는 길이 살펴봄 하나뿐이고, 앎이 존재 단위여서
                         "일부만 안다" 가 세계에 없다 (C014 06 NOTES)
    원본 근거            BW §32 (관찰 → 이해 → 대응 발견 — 진행이 대응 범위의 확장이다) ·
                         DC-WORLD-PROGRESSION-IS-REACH 의 requires
                         (`progression_expands_reachable_world` ·
                          `resource_can_open_capability_route`) ·
                         2026-08-19 Human 지시 ("아이템이나 내 능력치·스킬에 따라
                         미리 알 수도 있어야 한다 — 그럴 여지만 있으면 됨")
    Active Constraints   DC-WORLD-PROGRESSION-IS-REACH · DC-COMBAT-MATCHUP-SOFT ·
                         DC-WORLD-OWNS-THE-SURFACE-LIST · DC-WORLD-PLAYER-UNFIXED-PATH
    Constraint Eval      SATISFIED — 진행의 결과가 수치가 아니라 **대응 가능한 범위**로
                         나타난다 (PROGRESSION-IS-REACH: 통찰이 오르면 아는 상대가 늘고
                         고를 근거가 늘어난다). 얻는 것은 여전히 정보뿐이고 계산에는
                         닿지 않으며, 통찰이 낮은 쪽도 살펴봄으로 똑같이 알 수 있다 —
                         능력이 유일한 문이 되지 않는다 (MATCHUP-SOFT 의 정보판 ·
                         PLAYER-UNFIXED-PATH). 무엇이 열렸고 무엇이 아직 가려졌는지의
                         목록은 C014 가 세운 그 자리(`concealed`)가 그대로 나른다
                         (SURFACE-LIST — 계약 변경 없음)
    Observable Result    통찰을 올리면 살펴보지 않은 상대의 가려진 항목이 줄어드는 것이
                         보이고, 내리면 다시 가려진다. 두 플레이어가 같은 상대 앞에서
                         서로 다른 만큼 알고 서 있다
    Why one Cycle        새 능력치 하나와, 이미 있는 앎 판정에 붙는 절 하나다 —
                         C014 가 세운 장부·관문·계약을 그대로 쓴다. 다만 장부를
                         존재 단위에서 **항목 단위**로 넓히는 일이 함께 온다
                         (계약은 이미 목록을 나르므로 View 는 그대로다)
    7 조건               1 PARTIAL · 2 MP-LEARN-TO-HANDLE-THE-LAYER 전진 + PROGRESSION-IS-REACH 의
                         requires 를 세계에서 처음 만족시킨다 · 3 Client 실측 가능
                         (통찰을 바꿔 가며 가려짐이 변하는 것) · 4 한 Cycle ·
                         5 새 World 규칙("아는 만큼이 능력이다") · 6 Active 와 양립 (위) ·
                         7 아이템 경로·습성 관찰이 이 위에 얹힌다
    Note                 FR-EARN-THE-PIERCING("관통을 얻는 경로")과 **같은 뿌리다** —
                         둘 다 `resource_can_open_capability_route` 를 겨냥한다.
                         이쪽은 형태가 정해져 있어(능력치) 지금 고를 수 있고, 그쪽은
                         형태 미정으로 대기열에 있다. 이 Cycle 이 형태의 선례를 만든다
    Status               SELECTED

### FR-PREDICT-READS-THE-NEXT-BLOW
    Playable Result      살펴본 상대가 다음에 무엇을 할지가 미리 읽히고, 그것을 근거로
                         막거나 물러나거나 먼저 친다 — 관찰이 이해로 이어진다
    Source Goal          MG-EXPLORE-BEIRA
    Source Possibility   MP-LEARN-TO-HANDLE-THE-LAYER
    Missing / Partial    MC-PREDICT (MISSING) — 이 방법이 요구하는 둘 중 남은 하나이자
                         MW-ZONE-FRINGE 의 demands 셋 중 둘째.
                         MC-OBSERVE (PARTIAL) 의 남은 조각 **행동·습성**도 이 자리다
    원본 근거            BW §21 (FRINGE — 관찰·예측·지형) · §32 (관찰 → 이해 →
                         대응 발견) · C014 08 MASTER FEEDBACK 의 제안
    Active Constraints   DC-WORLD-PROGRESSION-IS-REACH · DC-COMBAT-PLAYER-CAUSALITY ·
                         DC-WORLD-OWNS-THE-SURFACE-LIST · DC-WORLD-PLAYER-UNFIXED-PATH
    Constraint Eval      SATISFIED — 예측은 사슬의 둘째 칸이며 진행이 이해의 확장으로
                         나타난다 (PROGRESSION-IS-REACH · BW §32). 읽히는 것은 세계가
                         이미 결정한 다음 행동이므로 새 난수가 없다 (PLAYER-CAUSALITY).
                         무엇이 읽히고 무엇이 아직 안 읽히는지를 세계가 싣는다
                         (SURFACE-LIST). 읽지 않고 싸우는 길이 남는다 (UNFIXED-PATH)
    Observable Result    같은 상대를 앞에 두고 예측 전에는 다음 행동 자리가 비어 있고,
                         예측이 서면 그 자리가 채워지며, 그 정보로 막기 시점이 달라진다
    Why one Cycle        지역 기반을 요구하지 않는다 — 자율 존재의 행동은 이미 세계에 있다
                         (RULE-NPC-DECIDE-001). 읽을 대상이 이미 굴러가고 있다
    7 조건               1 MISSING · 2 FRINGE 진입을 둘에서 하나로 줄인다 · 3 Client
                         실측 가능 · 4 한 Cycle · 5 새 World 규칙 · 6 Active 와 양립 ·
                         7 FRINGE 진입 완주가 이 위에 얹힌다
    Judgment for Human   MC-OBSERVE 의 "습성" 을 이 Cycle 에 함께 닫을지, 습성 관찰을
                         먼저 따로 볼지는 Human 의 몫이다 (C014 08 이 남긴 판단)
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

### FR-WHAT-YOU-GATHER-CHANGES-YOUR-BODY
    Playable Result      플레이어가 세계에서 캐거나 얻은 것이 몸이나 장비를 실제로 바꾸고,
                         그 전과 후의 전투 결과가 달라진다 — 디버그 명령이 아니라 플레이로
    Source Goal          MG-EXPLORE-BEIRA (그리고 MG-OVERCOME-SUPERIOR-OPPONENT)
    Source Possibility   MP-ADAPT-BY-RESOURCE 의 첫 칸 · MP-OUTGROW-THE-OPPONENT 의 결손
    Missing / Partial    MC-ATTACK-POWER (PARTIAL) — 값이 결과를 바꾸는 것은 닫혔고,
                         그 값을 **세계 안의 행위로** 바꾸는 경로가 없다.
                         MC-PENETRATION 도 같은 결손을 진다 (growth/growth-graph.md)
    원본 근거            BW §17 (탐험에서 얻은 자원이 다음 탐험의 가능성을 연다) ·
                         BW §18 (Capability 가 먼저 필요해지고 그 다음 획득 Route) ·
                         BW §32 (Progression 은 Level 이 아니라 Reach) ·
                         Q22 Human 지시로 선 광물 계통 (IP 5 · IT 6 · IM 3)
    Active Constraints   DC-WORLD-PROGRESSION-IS-REACH · DC-WORLD-RESOURCE-ADAPTATION-TRACE ·
                         DC-COMBAT-ONE-FORMULA · DC-GROWTH-GOAL-FIRST ·
                         DC-GROWTH-NEED-FROM-POSSIBILITY
    Constraint Eval      SATISFIED — Q22 로 자원 쪽 판단이 닫혔다. 지금 캐는 돌은
                         IT-COMMON-STONE 이고 MW-SAFE-FRONTIER 유래를 가지므로
                         `resource_placed_without_world_cause` 에 걸리지 않는다.
                         다만 그 성격이 이 Cycle 의 형태를 정한다 — 평범한 돌은 기적을
                         주지 않으므로 여는 것은 **제작**(돌 → 도구·무기)이지 능력치
                         직접 상승이 아니다. 기적적인 성장은 베이라 광물의 몫이다
    Observable Result    얻은 것을 쓰기 전과 후에 같은 상대·같은 스킬의 피해가 달라지고,
                         그 차이가 계산 내역으로 설명된다
    Why one Cycle        새 전투 규칙이 없다 — 이미 있는 능력치에 그것을 바꾸는 세계 내
                         행위 하나가 붙는다
    관계                 이것이 서면 "지금 열 수 없는 것" 의 FR-EARN-THE-PIERCING 과
                         "아이템으로 아는 경로" 가 같은 틀 위에 얹힌다 — 셋이 묻는 것은
                         결국 하나다: **얻은 것이 나를 바꾸는가**
    7 조건               1 PARTIAL · 2 성장이라는 축 전체를 연다 · 3 Client 실측 가능 ·
                         4 한 Cycle · 5 새 World 규칙 · 6 Q22 로 Constraint 닫힘 ·
                         7 BW §17 순환의 첫 칸이 된다
    Status               PROPOSED

### FR-INTERRUPT-DENIES-THE-BLOW
    Playable Result      플레이어가 상대의 행동이 완성되기 전에 그것을 노려 끊고,
                         그 공격이 아예 일어나지 않게 만든다
    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-INTERRUPT
    Missing / Partial    MC-INTERRUPT (PARTIAL) — 이것 하나뿐이고 그마저 절반 서 있다.
                         타격을 받으면 하던 행동이 끊기는 규칙은 이미 세계에 있다
                         (RULE-HIT-001). 없는 것은 그것을 **노리는** 수단과 그 판단이다
    원본 근거            BW §28 (범용 Combat Graph 의 여덟 갈래 중 하나) ·
                         BW §23 (MW-ZONE-DANGER 의 demands 4종 중 하나)
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
                         6 Active 와 양립 · 7 DANGER 층 demands 하나를 미리 채운다
    Status               PROPOSED

## 추천 순서 (Agent 제안 — 확정은 Human)

```text
1. FR-INSIGHT-SEES-BEFORE-LOOKING     ← SELECTED
                                      C014 가 방금 세운 자리 위에 바로 얹힌다 — 장부·관문·
                                      계약이 이미 있어 가장 작고, PROGRESSION-IS-REACH 의
                                      requires 를 세계에서 처음 만족시킨다.
                                      2026-08-19 Human 이 이 방향을 지시했다

2. FR-PREDICT-READS-THE-NEXT-BLOW     탐험의 다음 칸 — 익히는 갈래의 결손을 둘에서 0 으로
                                      만든다. 지역 기반을 요구하지 않는 마지막 조각이다

3. FR-WHAT-YOU-GATHER-CHANGES-YOUR-BODY
                                      가장 크게 막힌 것을 푼다 — 얻은 것이 나를 바꾸는
                                      경로가 세계에 하나도 없다. Q22 로 재료(광물 계통)가
                                      섰으므로 이제 쓰는 규칙만 남았다

4. FR-INTERRUPT-DENIES-THE-BLOW       가장 작은 전투 후보 — 끊김 규칙이 이미 있어 조건
                                      하나만 붙이면 되고 DANGER 층 demands 도 미리 채운다

5. FR-CRITICAL-AMPLIFIES-THE-BLOW     열렸지만 급하지 않다 — 다른 층의 전제가 아니고
                                      분산 축은 언제 넣어도 얹힌다
```

## SELECTED

```text
FR-INSIGHT-SEES-BEFORE-LOOKING
```

    선택 근거   추천 1순위. 2026-08-19 Human 지시가 이 방향을 직접 가리켰고,
                C014 가 세운 살펴봄 위에 바로 얹혀 가장 작다.
    다음 단계   cycles/C015-<name>/01-cycle.md 의 MASTER TRACE 로 이어진다
                (advprotoh-cycle 스킬 — 아직 시작하지 않았다)

## 지금 열 수 없는 것

각각 막힌 이유가 다르다. 이유가 사라지면 후보로 올린다.

| 층 / 후보 | 무엇이 막고 있는가 |
|---|---|
| FRINGE 층 완주 (MW-ZONE-FRINGE 의 demands 3종) | 결손 MC-USE-TERRAIN + 지형·지역이라는 세계 기반. MC-PREDICT 는 위 후보다 (C014 로 MC-OBSERVE 가 절반 섰다) |
| WILD 이하 층 (MW-ZONE-* 의 demands) | 얕은 층부터 채운다 (MW-DEPTH-GRADIENT). WILD 0/4 · DANGER 0/4 · DEEP 0/5 · UNKNOWN 0/6 |
| 문명권에서 준비하는 갈래 (MP-PREPARE-IN-CIVILIZATION) | 요구 Capability 는 없다 — 막는 것은 전부 세계 기반이다 (문명권이라는 장소 · 주체 사이에 무언가가 오가는 경로) |
| Active Defense (완벽한 막기·되받아치기·Break) | R1 §15 층 그림에서 Penetration 위이고 그 아래층은 C013 으로 섰다. 이제 막는 것은 설계 문서다 — 두 문서는 이름만 예고한다 |
| FR-EARN-THE-PIERCING (C013 이 제안) | 관통은 종류가 정한 값이거나 디버그 명령으로만 바뀐다 — 플레이어가 "그 벽을 뚫기 위해 무언가를 한다" 는 선택이 없다. 이것이 장비인지 성장인지 준비 행동인지를 근거 문서가 정하지 않았고, R1 §14 는 다음 층으로 Active Defense 를 지정한다. 형태와 순서 판단은 Human 의 몫 |
| 아이템으로 아는 경로 (감정 도구 등) | **아이템을 "쓴다" 는 개념이 세계에 없다** — 소지 개수만 있고(C001 Inventory) 소모·사용 Rule 이 0건이다. 그 개념 + 감정 도구 + 부분 공개를 한 Cycle 에 넣으면 셋이 된다. FR-INSIGHT-SEES-BEFORE-LOOKING 이 부분 공개를 먼저 세우면 남는 것은 "아이템 사용" 하나다 (2026-08-19 Human 이 이 방향도 지시했다) |
| Aura / Nen (집중·조건·제약·서약) | 사다리의 맨 위 — 아래 층이 서야 의미가 생긴다 |
| Evade (회피) | R1 §13 이 이후 확장으로만 지정 — §14 순서에 자리가 없다 |
| MG-ACQUIRE-RARE-ORGAN 의 대안 4종 (줍기·거래·사체·강제) | requires 미배선 (BW 는 구조만 공급) + WILD 지역·기관·거래 상대라는 세계 기반이 없다 — OPTIONS/NEED 와 지역 기반 후속 |
| MP-CONTROL-MOVEMENT · MP-WEAPONIZE-ENVIRONMENT | 결손 2~3종 + (후자는) Hazard 세계 기반. MP-INTERRUPT 는 결손 하나(MC-INTERRUPT)라 다음 회차 후보 가능 |

## 규칙

```text
Constraint 를 VIOLATE 하는 후보를 여기에 올리지 않는다 — Design Conflict 로 따로 제시한다.
Agent 는 후보와 근거를 제공하되 개발 우선순위를 확정하지 않는다.
선택된 FR-* 는 cycles/<CycleId>/01-cycle.md 의 MASTER TRACE 로 이어진다.
선택된 FR-* 는 Cycle 이 도는 동안 "선택되어 진행 중" 에 남는다 — 근거는 복제하지 않는다.
Cycle 이 닫히면 그 FR-* 를 이 파일에서 지우고 HISTORY.md 에 결과를 적는다.
대기 사유는 근거 문서의 문장으로 확인되어야 한다 — 지어내지 않는다.
```

이 파일은 **지금 고를 수 있는 것**과 **지금 도는 것**만 담는다. 닫힌 Cycle 의 선택 기록과
거기서 배운 것은 [HISTORY.md](HISTORY.md) 가 소유한다.
