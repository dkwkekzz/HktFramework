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
    attack 진행 0.25~0.75  → 휘두르는 몸 주위 AttackRange 충돌 반경이 활성
    활성 반경에 몸이 닿음  → hit + 방사 방향 충격량 (같은 몸은 휘두름당 1회)
    충돌체 관찰            → 모든 몸·행동 충돌 반경이 상시 투영, View 에서 C 로 토글

## WORLD SCENARIO (실측 — scratchpad/verify-c006.ts 실행 결과)
    S1  BODY PUSH   Before  npc-1 x=0.2, npc-2 x=-0.2 (거리 0.4, 겹침 0.6)
        Rule        RULE-BODY-PUSH-001 + RULE-BODY-MOMENTUM-001
        After       t=0.1s 거리 0.772 (v ±1.899 — 크기 동일·방향 반대 = 제3법칙)
                    t=1.0s 거리 1.598, v=0 → t=3.0s 그대로 (마찰 정지·안정)
                    대칭: npc-1.x=+0.799, npc-2.x=-0.799 (질량 동일 → 밀려남 동일)
    S2  SWING STRIKE Before player(0,0) attack, npc-1(1,0) idle
        Rule        RULE-SWING-STRIKE-001 → RULE-HIT-001
        After       t=0.1s  npc 무피격 (구간 이전, swing 비활성 관찰됨)
                    t=0.167s ★타격 — npc=hit, swing.active=true, struck=["npc-1"],
                             npc.v=(6.4, 0) — 완료(0.6s)보다 앞선 접촉 판정
                    t=1.5s  npc.x=2.33 (+1.33 밀쳐남), v=(0,0), 재타격 없음
    S3  PROJECTION  specId=VIEW-BASIC-COLLISION-001
                    body={radius:0.5, mass:1, velocity} 전 Actor 투영,
                    swing={center, radius:2, active, struck} attack 중에만 — 04 계약 일치

## VIEW FIXTURE
    collision-debug.fixture.json → collision-debug.spec.ts 7/7 통과
    (토글 off 기본 무표시 / 몸 원 / 활성·비활성 구분 / struck 표시 /
     없는 몸 생략 / 속도 화살표 비례 / swing 없는 관찰 정상)

## PLAYABLE
    절차  npm run world (실서버, ws /world) + 빌드된 Client 를 Chromium 으로 원격 조작
          → 접속·join → C 토글 → WASD 이동 → F 휘두름 → NPC 접근 대기
    결과  (스크린샷 c006-*.png — 세션 기록)
          · C 토글 전 충돌체 무표시, 토글 후 모든 몸에 초록 반경 원
          · F 휘두름 중 빨간 활성 충돌 반경(r=2)이 몸을 따라 표시
          · NPC 가 다가와 휘두르는 순간: NPC 의 빨간 활성 반경 + 맞은 몸의
            주황 표시 + 파란 속도 화살표(밀쳐나는 방향·세기) 동시 관찰
          · 밀쳐난 뒤 몸들이 겹치지 않고 떨어져 정지
    관찰  두 NPC 가 서로를 인지해 몸을 맞대고 밀며 휘두름을 주고받는 창발 —
          배회·접근이 같은 물리 아래 놓인 결과다 (AFFECTED 의도대로)

## REGRESSION (03 AFFECTED + 과거 Cycle Scenario — vitest 185/185)
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
    확인 방법: ./run.sh (또는 run.bat) → C 로 충돌체 관찰을 켜고
    NPC 곁에서 F 휘두름 — 밀쳐냄과 충돌 반경이 보이면 Goal 달성이다.
