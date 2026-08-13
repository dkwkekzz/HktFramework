# CYCLE C002 — Verification

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[PASS] Playable
[PASS] Regression

## NEW BEHAVIOR
    캐릭터는 언제나 하나의 행동 안에 있다     → 시작 시 모든 Actor 가 idle
    플레이어가 조작하면 행동이 바뀐다         → 이동 · 채굴 · 공격
    NPC 는 조작 없이 스스로 행동한다          → 순회 · 인지 후 접근 · 사거리에서 공격
    시간이 걸리는 행동은 진행하다 끝난다      → 채굴 1.2s · 공격 0.6s, 끝나면 대기 복귀
    진행 중 행동은 다른 행동으로 대체되지 않는다 → action-busy 사유와 함께 거부
    행동은 그 행동의 모션으로 관찰된다        → 주입된 시트가 행동/진행도에 맞춰 재생

## WORLD SCENARIO (View 없이 실측 — world/tests, `npx vitest run`)
    RULE-ATTACK-001
        Before  player(0,0) idle · npc-1(1,0), AttackRange 2
        Input   Attack(player, npc-1)
        Rule    RULE-ATTACK-001 → RULE-ACTION-BEGIN-001
        After   CurrentAction = attack(npc-1), progress 관찰 가능
        0.6s 후 CurrentAction = idle, npc-1 은 그대로 존재 (공격의 결과는 C002 밖)

    RULE-ATTACK-001 실패
        Before  player(0,0) · npc-1(10,0)
        Input   Attack(player, npc-1)
        After   Failure(out-of-range), 상태 불변, 사유가 interactions.attack 에 투영

    RULE-ACTION-BEGIN-001 (배타)
        Before  채굴 진행 0.2s 경과
        Input   Move(0,0) / Mine(deposit-1)
        After   둘 다 Failure(action-busy), 행동은 mine 유지
        1.2s 경과 후 → Move 성공 (다시 대체 가능해진다)

    RULE-MINE-COMPLETE-001
        Before  player(8,-5) · deposit-1 amount 5 · stone 0
        Input   Mine(player, deposit-1) → tick 0.6s → tick 0.6s
        After   0.6s 시점 state=mine progress=0.5, stone 0 (아직 획득 없음)
                1.2s 시점 state=idle, stone 1, amount 4

    RULE-NPC-DECIDE-001
        Before  npc-1(-8,4) 인지 1, WanderPath [(-8,4),(-8,-6)] · 플레이어는 인지 밖
        Input   tick 반복 5초
        After   0.1s 에 move 진입 → 4초에 (-8,-6) 도달 → 방향을 바꿔 되돌아간다
        Before  npc-1(-8,0) 인지 9 · player(0,0)
        Input   tick 반복
        After   move(접근) → 사거리 진입 시 attack(target=player)
        결정론  같은 배치 · 같은 tick 순서 → entities 상태·좌표 문자열이 완전히 동일

    실행 결과   world 테스트 30건 통과 (action 7 · attack 6 · npc 5 · mine 7 · move 5)

## PROJECTION
    projectPlayerView 가 04-gameview.spec.yaml 의 항목을 모두 산출한다.
        entities.character   id · role · kind · state · progress · targetEntityId
        entities.deposit     state · labelValue
        interactions         move(1) · attack(대상 수) · mine(광맥 수) + available/reason
        hud                  inventory.stone · tool.hasMiningTool · player.action(+progress)
    투영하지 않기로 한 값(MoveSpeed · AttackRange · PerceptionRange · WanderPath · Duration)은
    Snapshot 어디에도 나타나지 않는다 — 06-world-implementation.md PROJECTION 절 참조.

## VIEW FIXTURE (World 미기동 — view/tests)
    character-action.fixture.json
        player kind=rabbit-swordsman state=mine progress=0.5
            → mine 시트가 없으므로 rabbit-swordsman/idle 로 폴백, mode=progress(0.5)
        npc-1 kind=wanderer state=move
            → wanderer/move 시트로 mode=loop
        deposit-1 kind=stone
            → 모션 없음 → 절차 그림 stone-deposit:available
        hud player.action → widget=label, "행동", 값 "채굴", progress 0.5
        attack interaction 2건 → 키 F · 프롬프트 "공격" · 사유 문구(멀다 / 행동이 끝나야 한다)
    모션 데이터가 하나도 없는 Library 로 같은 fixture 를 풀면
        모든 entity 가 절차 그림(player-pickaxe:mine · wanderer:move · wanderer:attack ·
        stone-deposit:available)으로 그려진다 — 데이터 부재가 게임을 멈추지 않는다.

    실행 결과   view 테스트 22건 통과 (motion 15 · resolve 7)

## PLAYABLE
    실행      npx vite (127.0.0.1:5199) + Chromium 자동 조작 (기록: 조작 → HUD 관찰)

    start   Stone 0 · 곡괭이 ✓ · 행동: 대기
    D/W 반복 입력                    행동: 이동     캐릭터가 화면에서 이동
    광맥 도달                        행동: 대기     힌트가 "[E] 채굴" 로 바뀐다
    E 입력                           행동: 채굴 ▮▮░ 진행 막대가 차오른다
    채굴 중 이동 시도                행동: 채굴     힌트 "지금 하는 행동이 끝나야 한다"
    1.0s 후 Stone 1 ·                행동: 대기     획득 토스트
    NPC 접근 대기 후 F 입력          행동: 공격
    0.7s 후                          행동: 대기

    모션 재생 실측
        플레이어를 대기 상태로 두고 캐릭터 영역만 125ms 간격 12회 캡처 →
        서로 다른 렌더 결과 6종이 반복 순환 (주입한 9프레임 idle 시트가 실제로 재생된다).
        시트 파일을 지우면 절차 그림으로 돌아간다 (view fixture 테스트가 같은 경로를 검증).

    NPC 관찰
        조작하지 않아도 NPC 가 스스로 다가와 사거리에서 공격 행동에 들어간다.
        wanderer 종류에도 같은 idle 시트를 주입해 두었으므로 플레이어와 같은 모션으로
        재생되며, role tint 로 서로 구분된다. wanderer 폴더의 파일을 갈아 끼우면
        코드 변경 없이 NPC 모션만 바뀐다 (view/tests/motion.spec.ts 가 이 독립성을 검증).

## REGRESSION
    C001 Stone Mining Goal — 이동해서 광맥에 접근한 뒤 캐면 Stone 을 얻는다
        world 테스트 (mine.spec.ts "C001 REGRESSION")            → 통과
        실제 플레이 (위 PLAYABLE 절차)                            → 통과 (채굴에 1.2초가 걸린다)
    RULE-MOVE-001 / RULE-MOVE-PROGRESS-001 (AFFECTED)
        Bounds 밖 거부 · tick 도달 · 목적지 초과 없음 · 접근 시 mine 가용 전이 → 통과
    RULE-MINE-001 Precondition (AFFECTED)
        no-mining-tool · out-of-range · deposit-depleted 판정과 사유 투영 → 통과
        마지막 1개 채굴 시 available → depleted 전이                       → 통과
    C001 View Fixture 3종 (mining-available · out-of-range · deposit-depleted)
        모두 그대로 통과 — kind 가 없는 Snapshot 은 절차 그림 경로로 해석된다

    변경된 관찰 이름 (의도된 변경)
        entity.state 'moving' → 'move'   Asset Registry 는 두 키를 모두 유지한다.

## CYCLE COMPLETION GATE
    [x] 작은 플레이 가능한 Goal 이 정의되어 있다              01-cycle.md GOAL
    [x] Goal / Possibility 가 존재한다                        02-intent.md
    [x] Intent 가 존재한다                                    02-intent.md INTENT SET 7종
    [x] Intent 의 모든 의미가 State / Rule 로 닫혀 있다        03-world-semantic.md CLOSURE PASS
    [x] World State 변화가 World Rule 을 통해서만 발생한다     모든 전이가 rules/ · simulation/ 경유
    [x] World 는 Authoritative 하다                           Client 는 ActionRequest 만 보낸다
    [x] GameView Specification 이 존재한다                    04-gameview.spec.yaml
    [x] View 는 Spec 외 World 정보를 사용하지 않는다          view/ → world/ import 0건 (grep)
    [x] World 는 View 구현 정보를 사용하지 않는다             world/ → view/ import 0건 (grep)
    [x] World 를 View 없이 검증할 수 있다                     world 테스트 30건
    [x] View 를 Fixture 만으로 검증할 수 있다                 view 테스트 22건
    [x] Server + Client 연결 시 실제 플레이가 가능하다        PLAYABLE 절
    [x] Runtime 결과를 Goal / Intent 까지 추적할 수 있다      ActionResult.rule → semantic-id.ts
                                                              → Rule 주석의 Implements → Intent
    [ ] 인간이 실제 게임에서 Cycle Goal 달성을 확인했다        ← 사용자 확인 대기
    [x] 결과를 다음 Cycle 에서 그대로 재사용할 수 있다        아래 NOTES

## FAILURES
    없음.

## 다음 Cycle 이 그대로 쓰는 것
    ActionKind 를 늘리는 비용 = ACTION_DEFINITIONS 항목 1줄 + 시작 Rule 1개
      (+ 완료 효과가 있으면 RULE-ACTION-PROGRESS-001 의 분기 1줄).
      Projection · View · 모션 재생은 손대지 않아도 새 행동이 그대로 흐른다.
    새 캐릭터 종류를 늘리는 비용 = Actor.characterKind 문자열 + motions/<종류>/ 폴더.
      View 코드 수정 없음.
    공격의 결과(피해 · 체력 · 사망)는 이 위에 얹는 다음 Cycle 의 자리다 —
    RULE-ACTION-PROGRESS-001 의 attack 완료 분기가 그 자리다.

## STATUS
    IN PROGRESS  (Human Play 확인 후 COMPLETE)
