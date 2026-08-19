# C014 — Human Semantic Review

> 이 파일은 Human 의 결정을 그대로 옮긴 것이다. 판단은 Agent 가 하지 않았다.
> 2026-08-19 세션 기록이다.

## 검토 대상
    Cycle Goal → Intent → World Semantic → GameView Specification
    01-cycle.md · 02-intent.md · 03-world-semantic.md · 04-gameview.spec.yaml

## 제시한 판단 3건

    1. C007 R2 개정의 범위 — 가려지는 선을 **남의 겨루는 힘**으로만 긋는다.
       공격 둘 · 방어 둘 · 관통 둘 · 방어 배율 둘 · versusObserver · defenseShape.
       위치 · 행동 · 이름 · 종류 · 생명 · 기력 · 템포 · 배율 · 타격 경위는 공개 유지이고,
       자기 몸은 전부 공개다 (01 SCOPE NOTE · 03 SEMANTIC DELTA).
       근거는 Q3 (2026-08-19 Human — "전투 정보는 상황에 따라 부분적으로 보여질 수도
       가려질 수도 있다") 이며, C007 R2 의 "세계의 제한이 아니다" 를 그 결정이
       이미 부분 철회해 두었다.
       제시한 대안 — 기력·템포까지 함께 가린다. 정보의 대가가 커지지만 한 Cycle 에
       두 개의 경계가 서고 어느 쪽이 플레이를 바꿨는지 검증되지 않는다.

    2. DT R0 §10 관찰 계약과의 조정 — §10 의 "상대의 Armor 와 Resistance 는 적어도
       전투 전에 제공한다" 를 **제공받는 방법이 행동이 된다**로 읽는다.
       `interactions.observe` 가 그 제공의 경로이며, 살펴봄은 전투 전에 할 수 있다.
       DC-COMBAT-MATCHUP-SOFT 의 `weakness_is_observable` 은 "언제나 눈앞에 있다" 에서
       "관찰 행동을 하면 알 수 있다" 로 뜻이 옮겨간다 (Frontier Constraint Eval 과 같은 읽기).
       제시한 대안 — 승인하지 않고 MASTER GAP 으로 반환. 그때는 DT §10 개정이 선행해야 한다.

    3. 타격 경위는 가리지 않는다 — "맞아 본 것은 이미 겨뤄 본 것이다".
       모르는 상대를 쳐도 breakdown 은 전부 실리고 그 안에 상대의 방어 값이 나온다.
       따라서 반복해 때려 보는 것으로도 방어를 짐작할 수 있으며 세계는 그 길을 막지 않는다 —
       살펴봄이 여는 것은 **치기 전에** 아는 길이다 (02 INTENT-UNSEEN-CAPABILITY-001).
       제시한 대안 — 경위의 방어 값도 가린다. 앎의 경계가 촘촘해지지만 C010 이 세운
       "숫자가 왜 그만큼인지 설명된다" 가 무너지고 계산의 관찰 가능성이 사라진다.

## 결과
    APPROVED       2026-08-19
    Return To      해당 없음
    Reason         01~04 와 위 판단 3건을 대안과 함께 제시한 뒤 Human 이
                   "APPROVED 로 진행해줘, 나머지 단계 끝까지" 를 선택했다.
                   항목별 수정 요청은 없었다.
                   Stage 6 World Implementation 으로 진행한다.

    기록 주의      이 승인은 항목별 검토가 아니라 **제시된 묶음에 대한 진행 지시**다.
                   Stage 8 의 Human Play 확인에서 의미가 어긋나면 그때 되돌린다.
