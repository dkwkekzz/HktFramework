# CYCLE C006 — Verification

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[PASS] Playable (Agent 원격 플레이 실측 — Human Play 확인 대기)
[PASS] Regression

## NEW BEHAVIOR
    몸이 겹친다            → 매 Tick 질량 반비례로 서로 밀려나 겹침이 풀린다
    힘을 받은 몸           → 관성으로 움직이고 마찰로 잦아들며 경계를 넘지 않는다
    attack 진행 0.25~0.75  → 몸이 향한 방향(Facing)의 칼끝 충돌 구가 호를 쓸며 활성 (R1)
    활성 칼끝에 몸이 닿음  → hit + 몸 중심 기준 방사 충격량 (같은 몸은 휘두름당 1회)
    등 뒤                  → 맞지 않는다 (R1 — 휘두름은 향한 방향으로만 나간다)
    충돌체 관찰            → 몸 캡슐·칼끝 구가 상시 투영, View 에서 C 로 토글 (R1)

## WORLD SCENARIO (실측 — scratchpad/verify-c006.ts 실행 결과)
    S1  BODY PUSH   Before  npc-1 x=0.2, npc-2 x=-0.2 (거리 0.4, 겹침 0.6)
        Rule        RULE-BODY-PUSH-001 + RULE-BODY-MOMENTUM-001
        After       t=0.1s 거리 0.772 (v ±1.899 — 크기 동일·방향 반대 = 제3법칙)
                    t=1.0s 거리 1.598, v=0 → t=3.0s 그대로 (마찰 정지·안정)
                    대칭: npc-1.x=+0.799, npc-2.x=-0.799 (질량 동일 → 밀려남 동일)
    S2  SWING STRIKE (R1 재실측) Before player 가 +x 를 보고 attack, npc-1(1,0) idle
        Rule        RULE-SWING-STRIKE-001 → RULE-HIT-001 (+ RULE-BODY-PUSH — 타격 전 몸끼리 밀음)
        After       t=0.1s  npc 무피격 (구간 이전, 칼끝 구 비활성 r=0.7 관찰됨)
                    t=0.2s  ★타격 — 칼끝이 호를 쓸며 npc 에 닿음. npc=hit,
                             swing.active=true, struck=["npc-1"], npc.v=(6.75, 0)
                    t=1.5s  npc.x=2.53 (+1.53 밀쳐남), v=(0,0), 재타격 없음
        등 뒤 판정  npc(-1,0) 은 전체 휘두름 동안 무피격 (attack.spec R1 테스트)
    S3  PROJECTION  specId=VIEW-BASIC-COLLISION-001
                    body={radius:0.5, height:1.7, mass:1, facing, velocity} 전 Actor 투영,
                    swing={center(칼끝 — 실측 (1.13, 0.71) 호 위), radius:0.7, active, struck}
                    attack 중에만 — 04 계약(R1) 일치

## VIEW FIXTURE
    collision-debug.fixture.json → collision-debug.spec.ts 7/7 통과 (R1)
    (토글 off 기본 무표시 / 몸 캡슐(반경·높이) / 칼끝 구 위치·활성 구분 / struck 표시 /
     없는 몸 생략 / 속도 화살표 비례 / swing 없는 관찰 정상)

## PLAYABLE
    절차  npm run world (실서버, ws /world) + 빌드된 Client 를 Chromium 으로 원격 조작
          → 접속·join → C 토글 → WASD 이동(조준) → F 휘두름 → NPC 접근 대기
    결과  (스크린샷 c006-*.png · r1-*.png — 세션 기록)
          · C 토글 전 충돌체 무표시, 토글 후 모든 몸이 초록 캡슐 부피로 표시 (R1)
          · F 휘두름 중 칼끝 충돌 구가 향한 방향에서 표시 — 예비 구간 노랑,
            활성 구간 빨강, 프레임마다 호를 따라 위치 이동 (R1 burst 캡처)
          · NPC 가 다가와 휘두르는 순간: 활성 칼끝 구 + 맞은 몸의 주황 표시 +
            파란 속도 화살표(밀쳐나는 방향·세기) 동시 관찰
          · 밀쳐난 뒤 캡슐들이 겹치지 않고 떨어져 정지
    관찰  두 NPC 가 서로를 인지해 몸을 맞대고 밀며 휘두름을 주고받는 창발 —
          배회·접근이 같은 물리 아래 놓인 결과다 (AFFECTED 의도대로)
    R1    1차 Human Play 에서 "반경 원 표시·몸 주위 일괄 반경" 이 반환되어
          캡슐 부피 + 칼끝 호 충돌체로 수정 후 위 절차로 재검증했다 (05-review R1)
    R2    "캡슐이 이미지와 어긋난다" 반환 — 몸 크기를 종류별로 이미지 크기와 같게 올리고
          (BODY_SIZE_BY_KIND) 그림 크기를 Body.Height 에서 유도하도록 뒤집어
          캡슐이 캐릭터 그림을 정확히 감싸는 것을 재캡처로 확인했다 (r2-*.png).
          몸이 커진 만큼 밀어냄·타격 접촉 거리도 화면과 일치하게 됐다.

## REGRESSION (03 AFFECTED + 과거 Cycle Scenario — vitest 187/187)
    RULE-MOVE-PROGRESS-001   move/npc/mine 이동 도달 시나리오 그대로 통과 (C001~C002)
    RULE-ACTION-PROGRESS-001 mine 완료·hit 진행 그대로 통과 (C002)
    RULE-NPC-DECIDE-001      인지·추격·배회 시나리오 그대로 통과 (C002)
    RULE-OBSERVER-JOIN-001   참여·재참여·다중 관찰자 그대로 통과 (C004)
    C003 server / C005 telemetry / view resolve·motion·link 전부 통과
    attack.spec 은 CHANGED 의미(구간 접촉 판정)로 재작성 — 06 참조

## FAILURES
    없음

## STATUS
    IN PROGRESS — Human Play 확인 대기.
    확인 방법: ./scripts/run.sh (또는 scripts/run.bat) → C 로 충돌체 관찰을 켜고
    NPC 곁에서 F 휘두름 — 밀쳐냄과 충돌 반경이 보이면 Goal 달성이다.
