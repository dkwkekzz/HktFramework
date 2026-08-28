# C-TERRAIN-003 — View Implementation

입력: [04-gameview.spec.yaml](04-gameview.spec.yaml)

## SPEC CONSUMED

    ground.zones · ground.self    **변경 없음** — 태어난 배치가 기존 표면으로 그려진다.
                                  자리의 개수는 처음부터 목록의 길이였다 (cardinality:
                                  many) — 화면은 받은 목록을 그릴 뿐 세지 않으므로
                                  계약도 그리기도 열리지 않았다
    ground.genesisSeed (ADDED)    진단 표면 한 줄로 소비 (아래)
    hud · interactions            change: NONE — 확인함. 코드 변경 없음

## ASSET MAPPING

    없음 — 새 role · 새 sprite · 새 이펙트가 없다. SceneGroundZone 계약 변경 없음
    (engine_contract: change: NONE — 태어난 자리도 같은 지시(groundZonePlans)로 그려진다).

## INPUT → ACTION REQUEST

    없음 — 이 Cycle 은 Action 을 더하지 않는다. 태어남은 요청이 아니다.

## FIXTURE TESTS

    view/tests/terrain.spec.ts (+2)
        진단 표면(C · debugObserve)을 켜면 self 패널에 "세계 씨앗 N" 한 줄 ·
        평시 표면은 그리지 않는다 (플레이어에게 씨앗은 세계 밖의 사실이다)
    27/27 통과 — World 미기동, Fixture 만으로.

## NOTES

    1. 씨앗의 표시 자리 — `view/terrain-presentation.ts#groundGenesisLines` +
       `resolve.ts` 의 self 패널 조립. **진단 표면(충돌체 관찰과 같은 C 토글)이 켜졌을
       때만** 실린다 — 04 의 "표시하는 화면은 디버그 패널뿐" 을 이 화면의 디버그
       표면(진단 토글)으로 읽었다. 평시 플레이어 표면은 한 줄도 달라지지 않는다.
    2. 관찰 계약의 fixture 41개에 ground.genesisSeed 가 늘었다 (Stage 6 에서 함께 반영 —
       계약 필드는 필수다: View 는 이 값이 늘 온다고 믿어도 된다).
