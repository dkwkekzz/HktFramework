# Feedback — C-COMBAT-001-where-your-power-sits

    반영 시점    main f5b3ed6 위에서
    근거         cycles/C-COMBAT-001-where-your-power-sits/08-verification.md 의 MASTER FEEDBACK

    **STATUS 가 IN PROGRESS 인 채로 반영한다.** 그 Cycle 은 Gate 14항(사람이 손으로
    눌러 본다)만 남기고 나머지를 닫았고, 검사 6종과 실제 브라우저 왕복 실측이 08 에
    있다. 반영의 근거는 그 실측이며, 남은 한 항은 판정을 바꾸지 않는다 — 아래 Overlay
    가 PARTIAL 이고 그 사유가 사람의 확인이 아니라 semantic 의 절반이기 때문이다.
    Human Play 가 결과를 뒤집으면 그때 정정한다.

## Overlay

    MC-AURA-ALLOCATION   MISSING → **PARTIAL**   (IMPLEMENTED 아님)
        선 것    힘의 배분이 이름 붙은 상태로 있고, 전투 중 하나를 고르는 것으로만
                 바뀌며, 유효 값에 항으로 들어가고, 자기에게도 상대에게도 보인다
        남은 것  배분이 **값만 바꾸고 무엇을 할 수 있는가의 목록을 바꾸지 않는다.**
                 그 노드 semantic 의 절반(UL §15 — 인지를 일정 이상 몰아야 숨은 것이
                 보이는 식의 가능 여부 갈림)이 그 Cycle 의 EXCLUDED 였다
        닫는 것  FR-THE-WORLD-DECIDES-WHAT-IS-POSSIBLE (조건 관문)
        근거     08 의 WORLD SCENARIO · PLAYABLE
        **예고된 보고다** — 01 의 MASTER TRACE 가 착수 전에 이미 적었다

    갈래 셋의 요구가 함께 움직였다.

        MP-EXPLOIT-OPEN-BODY       요구 넷 중 셋이 섰고 넷째가 PARTIAL → 갈래도 PARTIAL
        MP-CONCENTRATE-THE-POWER   전진 (배분이 섰다)
        MP-HOLD-FORTIFIED          전진 — 다만 MC-FORTIFY 가 따로 남아 있다

    `MP-EXPLOIT-OPEN-BODY` 는 **판정을 하지 않고 사실만 적었다.** Cycle 이 "노드의 완결
    로는 이르고 플레이의 성립으로는 맞다 — 어느 쪽으로 판정할지는 Master(Human)의 몫"
    이라 명시해 올렸으므로 Agent 가 고르지 않는다. **Q66** 로 열어 두었다.

## Frontier (자기 트랙만 — COMBAT)

    지웠다   FR-WHERE-YOUR-POWER-SITS → 이 Cycle 로 닫혔다.
             배운 것: **후보가 "이 Cycle 로 그 갈래가 닫힌다" 고 적은 것이 절반만 맞았다.**
             플레이로는 닫혔고 노드로는 아니다. 후보 단계에서 "닫힌다" 를 적을 때
             둘 중 무엇을 뜻하는지가 구분되지 않았고, 그 구분이 없으면 Frontier 가
             같은 자리를 두 번 올리거나 한 번도 안 올리게 된다 (Q66 의 뿌리).

    새 후보  없음. 남은 아홉이 UL 전체를 덮고 있어 새로 열 자리가 없다.

    순서가 바뀌었다   `FR-THE-WORLD-DECIDES-WHAT-IS-POSSIBLE` 이 첫째로 올라왔다 —
             원래 여섯째였으나 이 Cycle 이 남긴 절반(가능 여부 갈림)을 바로 그것이
             닫으므로, 다음에 그것을 하면 MC-AURA-ALLOCATION 이 IMPLEMENTED 가 된다.

    SELECTED 를 비웠다 — 다음 선택은 Human 의 몫이다.

## Constraint Evaluation

    MC-AURA-ALLOCATION 노드에 여섯을 기록했다. 셋은 이미 있던 것을 실측으로 갈음했고,
    셋은 이번에 새로 걸렸다.

    DC-COMBAT-AURA-IS-A-PROFILE-NOT-A-DIAL  SATISFIED  전투 중 입력이 배분 하나를
        고르는 것뿐이다 — 요청에 몫을 실을 자리가 없어 실시간 조절 UI 의 문이
        **형(type) 수준에서** 닫혀 있다
    DC-COMBAT-ONE-FORMULA          SATISFIED  피해 식에 배분이 한 번도 등장하지 않는다
    DC-COMBAT-SHARED-BUDGET        SATISFIED  대가가 기존 기력이다 — 새 게이지가 없다
    DC-COMBAT-PLAYER-CAUSALITY     SATISFIED  (신규) 확률이 개입하지 않는다
    DC-COMBAT-ONE-LAYER-AT-A-TIME  SATISFIED  (신규) 고른 배분이 모든 값에 0 을 보태므로
        아래 층이 이 층 없이 그대로 선다 — 산술로 보장된다
    DC-WORLD-OWNS-THE-SURFACE-LIST SATISFIED  (신규) 화면에 배분 이름으로 분기하는
        코드가 없다 (`allocationLabel('zetsu')` 검증이 그 증거다)

## Candidates

    접수 하나 — `CC-ORDER-IS-THE-ADDRESS` (**순서로 짚고 이름을 적어 두지 않는다**).

    승격 조건 검사
        반복       세 번 — C020(소지품) · C023(적용 자리) · 이 Cycle(배분).
                   **다른 트랙에서 나왔다** (ITEM · ITEM · COMBAT)
        되돌림     한 번 이름으로 분기하기 시작하면 화면·조작 여러 곳에 흩어져
                   되돌리는 값이 커진다
        범위       GLOBAL — World → View 경계 전반
        겹침       DC-WORLD-OWNS-THE-SURFACE-LIST 와 인접하나 다른 것을 말한다.
                   그쪽은 "목록을 누가 소유하는가", 이쪽은 "그 목록을 어떻게 짚는가" —
                   목록을 세계가 소유하면서도 화면이 항목을 이름으로 분기할 수 있다

    `HUMAN DECISION: PENDING`. 승격 시 둘을 합칠지 나란히 둘지도 Human 판단이다.

## Master Gap

    없음 — Cycle 이 "상위 의미와 어긋난 지점이 없다" 로 보고했다.
    위의 두 PARTIAL 은 어긋남이 아니라 후보가 착수 전에 감수하기로 적은 손해다.
