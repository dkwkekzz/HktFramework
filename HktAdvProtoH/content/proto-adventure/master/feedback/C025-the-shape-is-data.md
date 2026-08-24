# Feedback — C025-the-shape-is-data

    반영 시점    main 843ebbf 위에서 (후보 소진 · 이 기록)
    근거         cycles/C025-the-shape-is-data/08-verification.md 의 MASTER FEEDBACK 아홉 항

    **두 번에 나뉘어 돌았다.** Graph · Overlay · Constraint · Candidate · 질문은 Stage 8
    실측 직후에 반영되었고(그때 이 Cycle 은 아직 `C024` 였다), Human Play 확인을 기다리던
    **후보 소진만 남아 있었다.** 그 절반을 이번에 닫는다. 앞 절반의 상세 경위는
    `feedback/` 규약이 서기 전에 쓰여 [../HISTORY.md](../HISTORY.md) 의
    `Feedback — C025(휘두름의 모양이 값이 된다) 반영` 절에 있다 — 옮겨 오지 않는다
    (History 를 History 로 옮기는 일이고, 그것을 가리키는 문서들이 어긋난다).

## Overlay

    MC-COMBAT-STRIKE   IMPLEMENTED 유지 — 새 Capability 를 세우지 않았다.
                       근거 칸에 C025 를 더했다 (모양이 전역 상수에서 정의로 내려왔다)
    MC-EVADE           MISSING 유지 — 얹힐 바닥이 **기술마다 다른 공간**이 되었다는
                       한 줄만 붙었다. 상태를 바꿀 근거가 아니다
    MS-SKILL-FORM      CONTACT 칸의 모양이 값이 되었다. 남은 다섯 칸이 설 때 그 축을
                       재사용한다 — **다만 그것이 남은 칸을 여는 것은 아니다**

    셋 다 이미 반영되어 있다 (`graph/capabilities.yaml` 노드 필드 · 재생성된 `overlay.md`).
    이번 실행은 Overlay 를 건드리지 않았다 — `npm run master:graph:check` 통과.

## Frontier (자기 트랙만)

    지웠다   FR-THE-SHAPE-IS-DATA — **C025 로 닫혔다** (Gate 15항 전부 충족 ·
             Human Play 확인 완료). `frontier/combat.md` 의 후보 블록과 "한눈에 보기"
             줄을 지웠고 SELECTED 를 `없음 — 후보 0` 으로 바꿨다.

             배운 것 셋
             ① **값을 바꿔 보지 않은 판정은 판정이 아니다.** 이 후보가 닫은 것은
                `DC-SKILL-IS-COMBINATION-NOT-NAME` 이고, 그것을 닫은 것은 모양을 정의로
                내렸다는 사실이 아니라 `40°·2.2·0.55` → `100°·1.6·0.9` 로 바꿔 옆의
                판정이 뒤집힌 것을 본 일이다 (규칙 코드 0줄).
             ② **표에 있는 것과 손에 닿는 것은 다르다.** 오라 스킬은 C012 이래로
                자판으로 나간 적이 없었다 — 관찰에는 셋 다 실려 있었기 때문에 표로
                확인하고 넘어간 두 Cycle 이 그것을 지나쳤다.
             ③ 후보가 **기존 노드의 확장**일 수 있다. 결손은 노드의 상태가 아니라
                그 노드에 걸린 Constraint 판정에 있었다.

    새 후보  **없음.** 이 트랙의 후보가 0 이 되었다 — 다음 COMBAT Cycle 은 MASTER 의
             OPTIONS(Q35 — 몸이 아닌 존재를 요구하는 Possibility)가 후보를 낳은 뒤에야
             열린다. `frontier/README.md` 의 트랙 표와 "트랙 간 순서" 에 그대로 적었다.

## Constraint Evaluation

    MC-COMBAT-STRIKE
        DC-SKILL-IS-COMBINATION-NOT-NAME   UNRESOLVED → SATISFIED
        이것이 그 노드의 **마지막 UNRESOLVED** 였다 — 네 판정이 모두 SATISFIED 다.
    (앞 절반에서 이미 반영됨 · 이번 실행의 변경 없음)

## Candidates

    CC-A-SHARED-CONSTANT-BECOMES-A-DEFINITION — 접수 완료 · `HUMAN DECISION: PENDING`.
    반론(DC-SKILL-COMBINE-BEFORE-NEW-FORM §6-2 가 이미 절반을 담는다)이 함께 적혀 있다.
    이번 실행에서 새로 접수한 것은 없다.

## Master Gap

    없음. Master 밖으로 나간 것 둘은 **ENGINE 레인 일감**이며 배차판이 지금 그것을
    지니고 있다 (`LANES.md` 의 ENGINE 줄).

        조작 키의 단일 출처가 없다 (MOVE_KEYS · TURN_KEYS 가 팩에 내보내지지 않는다) —
        팩은 `RESERVED_KEY_CODES` 사본으로 막고 있다
        `SceneColliderDebug` 의 이름이 뜻과 어긋난다 (하는 일은 "지면 위 부피를 그린다")

## 이번 실행이 발견한 공정 결손 — PROCESS 레인으로 보고

    **같은 사실을 두 도구가 다르게 센다.**

        npm run feedback:gate    `미처리 MASTER FEEDBACK 없음` — 틀렸다
        npm run lanes:check      C025 · C026 을 미처리로 잡는다 — 맞다

    `tools/feedback-gate/check.ts` 의 `pendingCycles` 는 검사 대상을 `C-<TRACK>-NNN`
    정규식으로 좁힌다. 그래서 옛 번호공간(C001~C026)의 Cycle 은 08-verification 에
    MASTER FEEDBACK 이 있고 `feedback/<CycleId>.md` 가 없어도 통과한다.
    `tools/lanes/build.ts` 는 같은 자리에서 **08 이 FEEDBACK 레인을 명시적으로 지목했는가**
    (`asksFeedback`)를 함께 보아 옛 번호공간을 놓치지 않는다 — 그쪽이 옳은 규칙이다.

    영향은 실재한다. Feedback 착수 전 게이트가 `없음` 을 내므로, 배차판이 손으로
    "C025 · C026 반영이 밀려 있다" 를 적어 두지 않았다면 이 실행은 열리지 않았을 것이다.

    제안   `feedback-gate` 가 `lanes/build.ts` 의 판정을 쓰거나 같은 규칙을 갖는다.
    고치는 자리는 도구(`tools/`)이므로 FEEDBACK 레인의 쓰기 범위 밖이다 — 보고만 한다
    (guides/works.md "발견의 밸브").
