# Feedback — C025-the-shape-is-data

    반영 시점    main 843ebbf 위에서
    근거         cycles/C025-the-shape-is-data/08-verification.md (STATUS COMPLETE —
                 Gate 15항 전부 충족 · Human Play 확인)

이 Cycle 의 Graph 쪽 반영(판정·근거·Q46·Candidate)은 Human Play 확인 전에
선반영되었다 (HISTORY.md "Feedback — C025 반영" — feedback/ 도입 전의 기록).
이번 반영은 그때 미뤄 둔 Frontier 소진을 닫고, 경위의 소유를 이 파일로 확정한다.

## Overlay

    MC-COMBAT-STRIKE   IMPLEMENTED 유지 — 새 Capability 를 세우지 않았다.
                       대신 노드에 걸려 있던 판정이 닫혔다:
                       DC-SKILL-IS-COMBINATION-NOT-NAME  UNRESOLVED → SATISFIED
                       근거는 코드가 있다는 사실이 아니라 **값을 바꿔 본 결과**다 —
                       큰 기술의 모양 셋(각·길이·굵기)만 바꿔 같은 각본에서 판정이
                       뒤집혔고 규칙 코드 0줄 (08-verification CONSTRAINT 실측).
                       이것이 이 노드의 마지막 UNRESOLVED 였다 — 네 판정 전부 SATISFIED
    MC-EVADE           MISSING 유지 — 읽는 법만 한 줄 붙었다: 공격의 공간 판정이 이제
                       기술마다 다르므로 회피가 설 때 피할 대상이 하나가 아니다
    MS-SKILL-FORM      CONTACT 칸의 모양이 값이 되었다 — 남은 칸이 설 때 이 축을
                       재사용한다. 다만 남은 칸을 여는 것은 아니다 (Q35 의 7 조건 2)

## Frontier (자기 트랙만)

    지웠다   FR-THE-SHAPE-IS-DATA → C025 로 닫혔다. 같은 자리, 다른 기술, 다른 결과를
             Human 이 실제 게임에서 확인했다 (F 는 맞고 G 는 빗나가고, 한 걸음 물러나면
             반대).
             배운 것 ① 모양을 층이 아니라 정의의 값으로 내리는 데 규칙 코드가 한 줄도
             필요 없었다 — C019(시간 축)와 같은 형태의 두 번째 사례.
             배운 것 ② 표에 있는 것과 손에 닿는 것은 다르다 — 오라 스킬(R)이 C012
             이래로 엔진 시점 키에 삼켜져 키보드로 나간 적이 없었다. Human 이 05 에서
             "다 사용할 수 있어야 한다" 를 못박지 않았으면 표만 보고 지나갔다
    새 후보  없음 — 이 트랙에 후보가 하나도 남지 않았다. 다음 전투 후보는 MASTER
             레인의 OPTIONS(Q35 — 몸이 아닌 존재를 요구하는 Possibility)가 낳는다

## Constraint Evaluation

    MC-COMBAT-STRIKE 의 DC-SKILL-IS-COMBINATION-NOT-NAME — 위 Overlay 절의 판정.
    graph/capabilities.yaml 에 선반영되어 있다 (노드에는 값과 짧은 근거만).

## Candidates

    CC-A-SHARED-CONSTANT-BECOMES-A-DEFINITION — 접수됨 · HUMAN DECISION: PENDING.
    C019(시간 축) · C025(공간 축)가 각자 같은 답에 이른 반복 패턴이다. 반론(DC-SKILL-
    COMBINE-BEFORE-NEW-FORM §6-2 가 이미 절반을 담는다)도 그 파일에 함께 있다.

## Master Gap

    공정 Gap 둘(③ SELECTED 가 병렬 선택을 담지 못한다 · ④ Cycle 번호 충돌 네 번)은
    Q46 으로 묶여 Human 대기다 — 번호 쪽 절반은 실무 규칙(번호 선예약)이 먼저 섰다.
    ⑦(조작 키 단일 출처 없음) · ⑧(SceneColliderDebug 이름)은 Master 의 일이 아니라
    기반 트랙 일감이다 — LANES.md ENGINE 레인이 잡고 있다.
