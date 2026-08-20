# Frontier

Frontier 는 Graph 의 절대 Leaf 가 아니라 **현재 세계 기준으로 아직 없는 가장 작은
플레이 가능한 Capability 단위**다. 기본 절차 **NEXT** 단계의 산출물이며,
Human 이 여기서 하나를 골라 다음 Cycle Goal 로 삼는다 (Human Select → 8 Stage Cycle).

    기준 Overlay   master/overlay.md — C015(치명) · C016(통찰) 완료 + TG(지목) 주입 반영
    근거 문서      전투 R1·DT · 세계 BW · 지목 TG (매핑된 전투 노드에는 BW 보조 근거 허용 — Q18(a))

## 한눈에 보기

한 줄로 읽는 다섯 후보다. "무엇을 보면 되는가" 는 그 Cycle 이 끝났을 때 사람이 화면에서
확인할 수 있는 것이며, 그것이 곧 완료 판정이다.

| # | 후보 | 이번 Cycle 이 끝나면 플레이어가 하는 것 | 무엇을 보면 되는가 | 크기 |
|---|---|---|---|---|
| 1 | **고른 상대에게 한다** | 존재 하나를 골라 두고, 살펴보기·채집이 그 상대로 나간다 | 늑대를 고르면 늑대가 표시되고, 멀어지면 "너무 멀다" 로 사유가 바뀌며, 다른 것을 골라도 화면이 헷갈리지 않는다 | 작다 (선행 1건) |
| 2 | **무엇이 나를 사냥한다** | 나를 사냥감으로 보는 존재와 그렇지 않은 존재가 갈린다 | 어떤 존재는 다가가면 덤비고 어떤 존재는 그냥 지나가며, 덤비지 않는 것을 치려 하면 거절된다 | 중간 |
| 3 | **다음 수를 읽는다** | 상대가 큰 것을 내기 전에 그 예고를 읽고 대비한다 | 상대 위에 예고가 뜨고, 그것을 보고 막으면 막히며, 못 보고 서 있으면 그대로 맞는다 | 중간 |
| 4 | **얻은 것이 나를 바꾼다** | 캔 것으로 무언가를 만들어 쓰고, 그 전후로 결과가 달라진다 | 같은 상대에게 같은 스킬을 쓴 피해가 전과 후로 달라지고, 그 차이가 계산 내역으로 설명된다 | 크다 |
| 5 | **끊어서 막는다** | 상대의 행동이 완성되기 전에 노려서 끊는다 | 상대의 큰 행동이 시작된 것이 보이고, 그때 넣은 개입이 그것을 무산시키며, 늦게 넣으면 무산되지 않는다 | 작다 |

## 지금 어디까지 왔는가

**전투 사다리** (R1 §14 — 층은 이름으로 가리킨다):

```text
설계 §14 층          지금
────────────────────────────────────────────
Basic Damage         섰다
Critical             섰다 — C015
Defense Action       섰다
Damage Type          섰다
Penetration          섰다
Active Defense       대기 — 그 층의 설계 문서가 아직 없다
Aura / Nen           대기 — 아래 층이 서야 의미가 생긴다
```

**탐험** — 층(어디)과 방법(어떻게)이 분리되어 있다 (HISTORY Q21):

```text
방법 3종                            지금
────────────────────────────────────────────
익힌다 (MP-LEARN-…)                 보는 칸이 섰다 (C014 · C016). 남은 것은 읽는 칸과
                                    지목·관계 ← 후보 1 · 2 · 3
자원으로 빌린다 (MP-ADAPT-…)        설계는 섰고(Q22 광물 6종) 세계에 제작이 없다 ← 후보 4
문명권에서 준비한다 (MP-PREPARE-…)  문명권·거래라는 세계 기반이 없다

층이 요구하는 것 (MW-ZONE-*.demands)   SAFE 2/4 · FRINGE 1/3 · WILD 0/4
                                       DANGER 0/4 · DEEP 0/5 · UNKNOWN 0/6
```

**세계 순환** (BW §16 · §17): 탐험 → 자원 → 능력 → 더 깊은 탐험.
설계는 Q22 로 닫혔고 **구현은 네 칸 모두 비어 있다** — 얻은 것으로 달라지는 것이 하나도
없다 (후보 4 가 그 첫 칸이다).

어느 Cycle 이 어느 층을 닫았는지는 [HISTORY.md](HISTORY.md) 에 있다.

## 후보

### 1. FR-PICK-ONE-AND-ACT-ON-IT

    Playable Result      플레이어가 세계의 존재 하나를 골라 두면 그 선택이 유지되고,
                         살펴보기와 채집이 화면에서 따로 대상을 찾지 않고 그 상대로 나간다
    Source Goal          MG-EXPLORE-BEIRA
    Source Possibility   MP-LEARN-TO-HANDLE-THE-LAYER
    Missing / Partial    MC-DESIGNATE-TARGET (MISSING) — 세계가 "지금 이 사람이 누구를
                         고르고 있는가" 를 지니는 자리가 없다.
                         MC-WATCH-TARGET (PARTIAL) — 재료는 다 있다. 가용 여부·불가 사유·
                         가려진 목록이 이미 관찰에 실린다. 없는 것은 그것이 고른 상대
                         하나로 모이는 자리다
    원본 근거            TG §0 (지목은 자동 조준이 아니라 의도의 표명) · §1 (지금은 행동마다
                         대상을 따로 찾는다) · §3.2 · §3.3 · §4
    Active Constraints   DC-TARGET-IS-INTENT-NOT-AIM · DC-WORLD-OWNS-THE-SURFACE-LIST
    Constraint Eval      SATISFIED — 고르는 것으로는 아무 일도 일어나지 않는다.
                         피해도 명중도 정보도 늘지 않고 세계가 대신 다가가지도 않는다
                         (INTENT-NOT-AIM). 무엇을 고를 수 있고 지금 무엇이 되는지의 목록과
                         사유는 세계가 싣는다 (SURFACE-LIST)
    Observable Result    늑대를 고르면 그 늑대가 화면에 표시된 채 유지되고, 생명과 거리가
                         계속 갱신되며, 멀어지면 살펴보기가 "너무 멀다" 로 바뀐다.
                         두 사람이 같은 세계에서 서로 다른 상대를 고른 채 서 있을 수 있고,
                         고른 상대가 사라지면 표시도 함께 사라진다
    Why one Cycle        새 계산도 새 자원도 없다 — 세계에 "고른 관계" 하나가 생기고,
                         이미 있는 살펴봄·채집이 그 관계를 읽을 뿐이다
    선행 조건            **기반 트랙 커밋 1건이 먼저다** (HISTORY Q28(a)) — 지금은 무엇을
                         지목하면 무슨 요청이 되는지를 화면 커널이 확정해 버린다.
                         그 결정 자리를 컨텐츠로 되돌리는 것이 그 커밋이다
    7 조건               1 MISSING+PARTIAL · 2 익히는 갈래가 요구한다 · 3 Client 실측 가능 ·
                         4 한 Cycle · 5 새 World 규칙(고른 관계는 세계가 지닌다) ·
                         6 Active 와 양립 · 7 관계·공격·대화·전리품이 모두 이 위에 얹힌다
    Status               PROPOSED

### 2. FR-SOMETHING-HUNTS-YOU

    Playable Result      나를 사냥감으로 보는 존재와 그렇지 않은 존재가 갈리고,
                         그 태도에 따라 할 수 있는 일이 달라진다
    Source Goal          MG-EXPLORE-BEIRA
    Source Possibility   MP-LEARN-TO-HANDLE-THE-LAYER
    Missing / Partial    MC-RELATION-STANCE (MISSING) — 지금 세계에는 적대·중립·우호라는
                         개념이 하나도 없다. 휘두른 자리에 닿은 것은 무엇이든 맞고,
                         자율 존재는 인지 범위에 든 대상을 가리지 않고 쫓는다
    원본 근거            BW §21 (FRINGE 는 강한 토착 포식자의 층) · BW §26 (능력은 그 층의
                         생존이 만든 적응의 결과) · MA-HOSTILE-COMBATANT 의 관점
                         ("자기 사냥터에 들어온 것은 사냥감이다") · MG-HOLD-HUNTING-GROUND ·
                         TG §3.1 · §3.4-5 (지목이 이 태도를 쓴다)
    Active Constraints   DC-WORLD-OWNS-THE-SURFACE-LIST · DC-WORLD-CREATURE-FROM-PRESSURE ·
                         DC-WORLD-COMBAT-IS-ONE-POSSIBILITY
    Constraint Eval      SATISFIED — 적대는 플레이어를 위해 배치된 성질이 아니라 그 존재가
                         자기 사냥터를 지키려는 목적의 결과다 (CREATURE-FROM-PRESSURE).
                         적대라는 이유만으로 처치 Goal 이 생기지 않는다 —
                         물러나는 것도 여전히 답이다 (COMBAT-IS-ONE-POSSIBILITY).
                         누구를 칠 수 있는지의 판단 근거를 세계가 싣는다 (SURFACE-LIST)
    Observable Result    어떤 존재는 다가가면 덤비고 어떤 존재는 그냥 자기 일을 하며,
                         덤비지 않는 것을 치려 하면 세계가 사유와 함께 거절한다.
                         같은 존재라도 누구에게서 본 태도인지가 관찰에 실린다
    Why one Cycle        새 계산이 없다 — 존재 사이에 값 하나가 생기고, 이미 있는 공격
                         관문과 자율 판단이 그 값을 읽는다
    Note                 이것과 후보 1 은 서로를 요구하지 않는다 — 지목은 태도 없이도
                         성립하고, 태도는 지목 없이도 성립한다. 다만 둘이 다 서면
                         "저것은 나를 노린다, 그러니 저것을 고른다" 가 처음으로 성립한다
    7 조건               1 MISSING · 2 익히는 갈래가 요구한다 · 3 Client 실측 가능 ·
                         4 한 Cycle · 5 새 World 규칙 · 6 Active 와 양립 ·
                         7 대화·거래·진영·위협도가 모두 이 위에 얹힌다
    Status               PROPOSED

### 3. FR-PREDICT-READS-THE-NEXT-BLOW

    Playable Result      상대가 다음에 무엇을 할지가 미리 읽히고, 그것을 근거로 막거나
                         물러나거나 먼저 친다 — 관찰이 이해로 이어진다
    Source Goal          MG-EXPLORE-BEIRA
    Source Possibility   MP-LEARN-TO-HANDLE-THE-LAYER
    Missing / Partial    MC-PREDICT (MISSING) — MC-OBSERVE 에 남은 마지막 결손
                         (행동·습성)이 바로 이 자리다. 이것이 닫히면 MC-OBSERVE 도
                         IMPLEMENTED 가 된다
    원본 근거            BW §21 (FRINGE — 관찰·예측·지형) · BW §32 (관찰 → 이해 → 대응) ·
                         C014 · C016 이 남긴 제안
    Active Constraints   DC-WORLD-PROGRESSION-IS-REACH · DC-COMBAT-PLAYER-CAUSALITY ·
                         DC-WORLD-OWNS-THE-SURFACE-LIST · DC-WORLD-PLAYER-UNFIXED-PATH
    Constraint Eval      SATISFIED — 읽히는 것은 세계가 이미 정한 다음 행동이므로 새 난수가
                         없다 (PLAYER-CAUSALITY). 진행이 수치가 아니라 이해의 확장으로
                         나타난다 (PROGRESSION-IS-REACH). 무엇이 읽히고 무엇이 아직
                         안 읽히는지를 세계가 싣는다 (SURFACE-LIST).
                         읽지 않고 싸우는 길이 남는다 (UNFIXED-PATH)
    Observable Result    상대가 큰 행동을 시작하면 그 예고가 보이고, 그것을 보고 막으면
                         막히며, 예고를 못 보고 서 있으면 그대로 맞는다.
                         예측이 서기 전에는 그 자리가 비어 있다
    Why one Cycle        읽을 대상이 이미 굴러가고 있다 — 자율 존재의 행동은 세계에 있다.
                         더할 것은 행동에 예고 구간을 두고 그것을 관찰에 싣는 일이다
    7 조건               1 MISSING · 2 FRINGE 진입 요구를 셋 중 둘로 채운다 ·
                         3 Client 실측 가능 · 4 한 Cycle · 5 새 World 규칙 ·
                         6 Active 와 양립 · 7 능동 방어가 이 위에 얹힌다
    Status               PROPOSED

### 4. FR-WHAT-YOU-GATHER-CHANGES-YOUR-BODY

    Playable Result      세계에서 캐거나 얻은 것이 몸이나 장비를 실제로 바꾸고,
                         그 전과 후의 전투 결과가 달라진다 — 디버그 명령이 아니라 플레이로
    Source Goal          MG-EXPLORE-BEIRA (그리고 MG-OVERCOME-SUPERIOR-OPPONENT)
    Source Possibility   MP-ADAPT-BY-RESOURCE 의 첫 칸 · MP-OUTGROW-THE-OPPONENT 의 결손
    Missing / Partial    MC-ATTACK-POWER (PARTIAL) — 값이 결과를 바꾸는 것은 닫혔고 그 값을
                         **세계 안의 행위로** 바꾸는 경로가 없다. MC-PENETRATION 과
                         MC-CRITICAL-STRIKE 도 같은 결손을 진다 — 셋 다 종류 초기값과
                         디버그 명령으로만 바뀐다
    원본 근거            BW §17 (탐험에서 얻은 자원이 다음 탐험의 가능성을 연다) ·
                         BW §18 (능력이 먼저 필요해지고 그 다음 획득 경로) ·
                         BW §32 · Q22 로 선 광물 계통 (IP 5 · IT 6 · IM 3)
    Active Constraints   DC-WORLD-PROGRESSION-IS-REACH · DC-WORLD-RESOURCE-ADAPTATION-TRACE ·
                         DC-COMBAT-ONE-FORMULA · DC-GROWTH-GOAL-FIRST ·
                         DC-GROWTH-NEED-FROM-POSSIBILITY
    Constraint Eval      SATISFIED — Q22 로 자원 쪽 판단이 닫혔다. 지금 캐는 돌은 평범한
                         돌(IT-COMMON-STONE)이고 안전한 문명권 유래를 가지므로, 이 Cycle 이
                         여는 것은 **제작**(돌 → 도구·무기)이지 능력치 직접 상승이 아니다.
                         기적적인 성장은 베이라 광물의 몫이다
    Observable Result    캔 것으로 무언가를 만들어 쓰기 전과 후에, 같은 상대에게 같은 스킬을
                         쓴 피해가 달라지고 그 차이가 계산 내역으로 설명된다
    Why one Cycle        새 전투 규칙이 없다 — 이미 있는 능력치에 그것을 바꾸는 세계 안의
                         행위 하나가 붙는다
    관계                 이것이 서면 관통을 얻는 경로 · 치명을 키우는 경로 · 아이템으로 아는
                         경로가 모두 같은 틀 위에 얹힌다. 셋이 묻는 것은 하나다 —
                         **얻은 것이 나를 바꾸는가**
    7 조건               1 PARTIAL · 2 성장이라는 축 전체를 연다 · 3 Client 실측 가능 ·
                         4 한 Cycle · 5 새 World 규칙 · 6 Q22 로 Constraint 닫힘 ·
                         7 BW §17 순환의 첫 칸이 된다
    Status               PROPOSED

### 5. FR-INTERRUPT-DENIES-THE-BLOW

    Playable Result      상대의 행동이 완성되기 전에 그것을 노려 끊고, 그 공격이 아예
                         일어나지 않게 만든다
    Source Goal          MG-OVERCOME-SUPERIOR-OPPONENT
    Source Possibility   MP-INTERRUPT
    Missing / Partial    MC-INTERRUPT (PARTIAL) — 이것 하나뿐이고 그마저 절반 서 있다.
                         맞으면 하던 행동이 끊기는 규칙은 이미 있다. 없는 것은 그것을
                         **노리는** 수단과 그 판단이다
    원본 근거            BW §28 (범용 전투 그래프의 여덟 갈래 중 하나) ·
                         BW §23 (DANGER 층이 요구하는 넷 중 하나)
    Active Constraints   DC-COMBAT-PLAYER-CAUSALITY · DC-COMBAT-ONE-FORMULA ·
                         DC-COMBAT-ONE-LAYER-AT-A-TIME · DC-WORLD-OWNS-THE-SURFACE-LIST
    Constraint Eval      SATISFIED — 끊김은 확률이 아니라 시점 관계로 판정된다.
                         피해 공식을 건드리지 않고(ONE-FORMULA), 능동 방어·Aura 를 손대지
                         않는다(ONE-LAYER). 무엇이 왜 끊겼는지를 세계가 싣는다(SURFACE-LIST)
    Observable Result    상대가 큰 행동을 시작한 것이 보이고, 거기에 맞춰 넣은 개입이 그
                         행동을 무산시키며, 같은 개입을 늦게 넣으면 무산되지 않는다
    Why one Cycle        새 공식도 새 자원도 없다 — 이미 있는 끊김 규칙에 "노려서 끊는"
                         조건 하나와 그것을 읽을 표면 하나가 붙는다
    Note                 후보 3(예측)과 짝이다 — 예측이 예고를 세우면 이것이 그 예고를
                         쓸 자리가 된다. 순서를 바꿔도 각자 성립한다
    7 조건               1 PARTIAL · 2 다섯 번째 전투 경로를 연다 · 3 Client 실측 가능 ·
                         4 한 Cycle · 5 새 World 규칙(행동에는 끊길 수 있는 구간이 있다) ·
                         6 Active 와 양립 · 7 DANGER 층 요구 하나를 미리 채운다
    Status               PROPOSED

## 추천 순서 (Agent 제안 — 확정은 Human)

```text
1. 고른 상대에게 한다 (FR-PICK-ONE-AND-ACT-ON-IT)
       지금 가장 값싸고, 뒤의 거의 모든 것이 이 위에 얹힌다. C014·C016 이 세운 앎을
       화면에서 쓸 자리가 아직 없다 — 고른 상대가 없어서 알게 된 것이 흩어져 있다.
       선행 기반 커밋 1건이 붙는다는 것만 감안하면 된다

2. 무엇이 나를 사냥한다 (FR-SOMETHING-HUNTS-YOU)
       지금 세계에서 가장 이상한 것을 고친다 — 아무나 벨 수 있고 아무나 나를 쫓는다.
       Human 이 이번에 세우기로 한 자리다 (HISTORY Q24(b))

3. 다음 수를 읽는다 (FR-PREDICT-READS-THE-NEXT-BLOW)
       익히는 갈래의 마지막 결손이고, 닫으면 MC-OBSERVE 가 완성된다.
       지역 기반을 요구하지 않는 마지막 조각이다

4. 얻은 것이 나를 바꾼다 (FR-WHAT-YOU-GATHER-CHANGES-YOUR-BODY)
       가장 크게 막힌 것을 푼다 — 얻은 것이 나를 바꾸는 경로가 세계에 하나도 없다.
       크기도 가장 크다 (제작·장착이라는 개념이 통째로 없다)

5. 끊어서 막는다 (FR-INTERRUPT-DENIES-THE-BLOW)
       가장 작은 전투 후보 — 끊김 규칙이 이미 있어 조건 하나만 붙이면 된다.
       예측(3)이 먼저 서면 더 자연스럽지만 각자 성립한다
```

## SELECTED

```text
아직 없음 — Human 선택 대기
```

## 지금 열 수 없는 것

각각 막힌 이유가 다르다. 이유가 사라지면 후보로 올린다.

| 층 / 후보 | 무엇이 막고 있는가 |
|---|---|
| FRINGE 층 완주 (MW-ZONE-FRINGE 의 요구 3종) | 결손 MC-USE-TERRAIN + 지형·지역이라는 세계 기반. MC-PREDICT 는 위 후보 3 이다 |
| WILD 이하 층 | 얕은 층부터 채운다 (MW-DEPTH-GRADIENT). WILD 0/4 · DANGER 0/4 · DEEP 0/5 · UNKNOWN 0/6 |
| 문명권에서 준비하는 갈래 | 요구 Capability 는 없다 — 막는 것은 전부 세계 기반이다 (문명권이라는 장소 · 주체 사이에 무언가가 오가는 경로) |
| Active Defense (완벽한 막기·되받아치기·Break) | 아래층은 C013·C015 로 섰다. 이제 막는 것은 **그 층의 설계 문서**다 — 두 전투 문서는 이름만 예고한다 |
| 관통·치명을 얻는 경로 | 후보 4 와 같은 뿌리다. 그것이 제작·장비·성장 중 무엇인지를 근거 문서가 정하지 않았다 — 후보 4 가 먼저 형태를 만들면 그 틀에 얹힌다 |
| 아이템으로 아는 경로 (감정 도구 등) | **아이템을 "쓴다" 는 개념이 세계에 없다** — 소지 개수만 있고 소모·사용 규칙이 0건이다. C016 이 부분 공개를 세웠으므로 남는 것은 "아이템 사용" 하나다 |
| Aura / Nen (집중·조건·제약·서약) | 사다리의 맨 위 — 아래 층이 서야 의미가 생긴다 |
| Evade (회피) | R1 §13 이 이후 확장으로만 지정 — §14 순서에 자리가 없다 |
| 희귀 기관을 얻는 네 갈래 (줍기·거래·사체·강제) | 요구 배선이 없다 (BW 는 구조만 공급) + WILD 지역·기관·거래 상대라는 세계 기반이 없다 |
| MP-CONTROL-MOVEMENT · MP-WEAPONIZE-ENVIRONMENT | 결손 2~3종 + (후자는) 환경 위험이라는 세계 기반 |

**후보로 올리지 않은 관찰된 결손 하나**: 기력이 스스로 돌아오지 않는다
(MC-CP-ECONOMY 의 PARTIAL — 회복 경로가 "타격을 성공시킨다" 하나뿐이라 빗나가면
아무것도 벌지 못하고 쉬어도 차지 않는다). 이것이 어느 상위 갈래를 전진시키는지를
근거 문서가 말하지 않아 7 조건 2 를 세울 수 없다. 밸런스로 다룰지 규칙으로 세울지는
Human 판단이다.

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
