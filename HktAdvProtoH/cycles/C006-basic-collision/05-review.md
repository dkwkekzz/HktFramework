# CYCLE C006 — Human Semantic Review

## 검토 대상
    Cycle Goal → Intent → World Semantic → GameView Specification
    (01-cycle.md · 02-intent.md · 03-world-semantic.md · 04-gameview.spec.yaml)

## 질문
    1. 이 World 가 내가 원하는 게임 의미를 정확히 표현하는가?
    2. 이 GameView Specification 만으로 Player 가 그 의미를 이해하고 플레이할 수 있는가?

## 검토자에게 제시된 결정
    1. 휘두름은 무방향이다 — C002 의 "공격은 대상을 향하지 않는다" 를 유지한다.
       swing 충돌 반경은 휘두르는 몸 주위의 원(AttackRange)이고,
       밀쳐냄은 공격자 중심 → 대상 중심의 방사 방향이다.
       Facing(향하는 방향) 의미는 이번 Cycle 에 만들지 않았다.
    2. 타격 시점이 바뀐다 (INTENT-ATTACK-HIT-001 CHANGED) —
       완료 순간 일괄 판정 → swing 진행 구간 [SWING_BEGIN, SWING_END] 의 접촉 시점 판정.
       같은 몸은 휘두름당 한 번만 맞는다 (CurrentAction.StruckActorIds).
    3. 물리 모델 — 겹침 깊이 × PUSH_STIFFNESS 의 힘(제3법칙, 크기 동일·방향 반대)
       → 질량 반비례 속도 변화(제2법칙) → 관성 이동 + FRICTION 감쇠 + 경계 고정(제1법칙 변형).
       의도한 이동(move, moveSpeed)은 그대로 두고 Tick 마지막의 물리 단계가 위치를 보정한다.
    4. 범위 제외 — 발사체(충돌 반경 구조만 담을 수 있게 설계), 지형·장애물 충돌,
       피해량·체력, Deposit 의 몸. 디버그 관찰은 World 가 상시 투영하고
       켜고 끄는 토글은 View(관찰자) 책임, 기본 off.

## 결과
    APPROVED
    Return To  없음
    Reason     위 4가지 결정을 포함해 승인.

## 기록 경위
    이 판정은 검토자가 대화에서 직접 선택한 것(AskUserQuestion 응답)을 그대로 옮겨 적은 것이다.
    Agent 가 판정하지 않았다.

## R1 — Human Play 후 반환과 재승인 방향 (검토자 지시 전문 반영)
    검토자 지시 (Stage 8 Human Play 검토에서):
      "캐릭터가 구체 혹은 캡슐모양으로 보여야 하는데 반경만 있는게 이상함.
       그리고 칼질을 하면 칼을 휘두르는 부분에 충돌체를 생성해야 자연스러운데 이상함."
    반영 결정:
      1. 몸 충돌체는 캡슐 부피(Radius + Height)로 관찰한다.
         서로 밀어내는 판정은 기존대로 지면 평면 투영 원이다 (수직 충돌은 01 EXCLUDED 유지).
      2. 휘두름 충돌체는 몸 주위 반경이 아니라, 몸이 향한 방향(Facing)의 칼끝 자리에
         생성되어 휘두름 구간 동안 호를 그리며 쓸고 지나가는 구체다.
         이를 위해 Actor.Facing 을 추가한다 (이동이 갱신, 자율 존재는 겨눈 대상을 향함).
         공격이 대상을 고르지 않는 것(INTENT-ATTACK-001)은 유지된다 —
         방향은 대상이 아니라 몸의 자세다.
    이 개정은 검토자의 명시적 지시를 그대로 옮긴 것이며 Agent 가 임의로 정하지 않았다.

## R2 — 캡슐 크기를 이미지에 맞춤 (검토자 지시 반영)
    검토자 지시:
      "캡슐 크기를 이미지 크기에 맞춰보자. 이건 이후 새로운 entity를 추가해도 마찬가지.
       이미지에 충돌체 크기를 알아서 조절할 것."
    반영 결정:
      몸 캡슐 크기를 기존 이미지 표시 크기와 같게 종류별로 정하고
      (BODY_SIZE_BY_KIND — rabbit-swordsman 0.85/3.4, wanderer 0.7/2.8),
      View 의 그림 표시 크기를 Body.Height 에서 유도하도록 뒤집었다.
      World 가 크기의 단일 출처가 되므로(Authority 유지) 새로운 종류의 존재를
      추가해도 충돌체와 이미지는 자동으로 일치한다 — View 가 World 에 크기를
      알려주는 경로는 만들지 않았다.
