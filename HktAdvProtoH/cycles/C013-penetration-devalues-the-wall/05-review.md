# C013 — Human Semantic Review

> 이 파일은 Human 의 결정을 그대로 옮긴 것이다. 판단은 Agent 가 하지 않았다.
> 2026-08-18 세션 기록이다.

## 검토 대상
    Cycle Goal → Intent → World Semantic → GameView Specification
    01-cycle.md · 02-intent.md · 03-world-semantic.md · 04-gameview.spec.yaml

## 제시한 판단 3건
    1. 걷히는 몫의 형태 — `남은 방어 = 방어 × 100/(100+관통)`.
       세계에 이미 있는 곡선(C010 감쇄식)을 방어 값에 적용한다. 새 곡선을 만들지 않아
       DC-COMBAT-ONE-FORMULA 를 가장 강하게 지키며, 비율이 1 에 이르지 않아 방어가
       통째로 사라지지 않는다 (03-world-semantic.md WORLD STATE · BALANCE).
       제시한 대안 — 선형 + 상한(관통 60 = 60% 무효, 상한 75%). 읽기는 쉬우나 상한 위로는
       관통이 완전히 무의미해지고 새 상수가 하나 는다.
    2. 관통 초기값 — wanderer 60/0 · rabbit-swordsman 0/0.
       플레이어(wanderer)는 auraAttack 15 라 무른 쪽으로 피해 갈 수 없어 마주한 갑주를
       깎는 것이 유일한 길이며, 이것이 MP-PIERCE-THE-HARD-DEFENSE 그 자체다.
       대가로 wanderer 의 물리 피해가 C012 대비 달라진다 (rabbit 상대 17 → 20).
       그 외 모든 조합은 관통 0 이라 C012 숫자가 그대로다 (03 BALANCE).
       제시한 대안 — 전 종류 0. C012 숫자가 한 값도 안 변하지만 디버그 명령 없이는
       이 층이 플레이에 보이지 않는다.
    3. 계약에 versusObserver 를 더한다 — "armor 50 인 상대가 나에게는 31.25 로 읽힌다" 를
       세계가 계산해 치기 전에 싣는다. View 가 곱셈으로 만들어내지 않는다
       (DC-WORLD-OWNS-THE-SURFACE-LIST). 함께 `defenseStat.value` 를 **걷히기 전**으로
       고정하고 감쇄식의 입력은 새 이름 `effectiveDefense` 가 가진다
       (04 DEFENSE STAT NOTE).
       제시한 대안 — versusObserver 제외. 계약은 작아지지만 고르기 전 판단이 사라지고
       관통이 사후 설명이 된다.

## 결과
    APPROVED       2026-08-18
    Return To      해당 없음
    Reason         01~04 와 위 판단 3건을 대안과 함께 제시한 뒤 Human 이
                   "APPROVED — 구현 진행" 을 선택했다. 항목별 수정 요청은 없었다.
                   Stage 6 World Implementation 으로 진행한다.

    기록 주의      이 승인은 항목별 검토가 아니라 **제시된 묶음에 대한 진행 지시**다.
                   Stage 8 의 Human Play 확인에서 의미가 어긋나면 그때 되돌린다.

## 정정 — 2026-08-18 (이 기록은 남기고 전제만 바로잡는다)

    위 판단 2 는 **틀린 전제 위에 제시되었다.** "플레이어(wanderer)" 라고 적었으나
    관찰자의 몸은 rabbit-swordsman 이다 (RULE-OBSERVER-JOIN-001). 그대로 구현한 결과
    관통을 지닌 쪽이 자율 존재가 되어 Cycle Goal 의 주어가 뒤집혀 있었다.

    Human 이 "플레이어에 영향을 주는 속성이 명료한가" 를 물어 드러났고,
    Human 의 지시("고쳐")로 03 World Semantic 의 BALANCE 를 다시 정했다 —
    관통을 관찰자의 몸(rabbit-swordsman)의 **오라 쪽**에 둔다.
    판단 1(곡선)과 판단 3(versusObserver)은 그대로 유효하다.

    경위와 그 이유는 08-verification.md 의 CORRECTION 절이 소유한다.
