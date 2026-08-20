# C017 — Human Semantic Review

## 검토 대상

    Cycle Goal → Intent → World Semantic → GameView Specification
    (01-cycle.md · 02-intent.md · 03-world-semantic.md · 04-gameview.spec.yaml)

## 질문

    1. 이 World 가 내가 원하는 게임 의미를 정확히 표현하는가?
    2. 이 GameView Specification 만으로 Player 가 그 의미를 이해하고 플레이할 수 있는가?
    3. (이 Cycle 한정) 기반 트랙 커밋(Q28(a)) 없이 Stage 6·7 을 진행하는가?

## 결과

    APPROVED

    2026-08-20 Human 결정. 아래 셋을 함께 승인한다.

### 판단 셋 승인 (01-cycle.md SCOPE NOTE · 03 이 답한 것)

    ① 고른 것은 **보는 이의 것**이다
       C014 가 앎을 보는 이의 것으로 둔 자리를 따른다. 수명도 같다 —
       이어짐이 끊겨도 관찰자는 장부에 남으므로 고른 것도 이어진다.
    ② 대상 지정 행동은 고른 것을 **유일**로 쓴다
       요청이 대상을 따로 실을 길을 남기지 않는다. 남기면 TG §1 이 지적한
       갈라짐("관찰은 A · 공격은 B")이 그대로 남는다.
    ③ 쓰러진 대상도 **유지**한다
       TG §4.3 그대로. 상태 확인과 이후 확장(전리품)이 그 자리를 쓴다.

### 선행 조건 결정

    **진행한다.** 기반 트랙 커밋을 기다리지 않는다.

    근거는 Stage 4 의 코드 대조다 — 이 Cycle 뒤 존재마다 오는 interaction 이
    select-target 하나뿐이므로 기반의 클릭 경로가 그대로 고르기가 되고, 해제 키는
    KEY_BINDINGS, 대상 자리는 SceneHudItem, 강조는 tint 로 선다. 컨텐츠 경계 안에서
    닫힌다 (01-cycle.md PREREQUISITE).

    Q28(a) 의 결정 자체는 철회하지 않는다. 그 커밋이 값어치를 갖는 자리가 셋 남는다 —
    지형 클릭의 결정 · 존재마다 오는 interaction 이 둘이 될 때 · 외곽선 강조.
    이 Cycle 의 산출물을 바꾸지 않으므로 별도 기반 트랙으로 낸다.

## Return To

    없음

## Note

    이 파일은 Human 의 판정을 기록한 것이다. Agent 는 검토를 대신하지 않았고,
    위 결과는 Human 이 직접 고른 답이다.
