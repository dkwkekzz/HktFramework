# CC-WORLD-OWNS-THE-SURFACE-LIST

접수: 2026-08-17 (MF) — C010-stats-decide-the-damage 의 MASTER FEEDBACK 이 보고한
반복 패턴이다. Cycle Agent 는 관찰만 보고했고, 승격 판단은 Human 이 한다.

## CANDIDATE STATEMENT

    무엇을 할 수 있고 그 값이 어디까지 허용되는지의 목록은 세계가 소유하고 관찰 결과에
    실어 보낸다. 관찰자(View)는 그 목록을 스스로 만들지 않는다.

## OBSERVED REPEATING PATTERN

    C007 R2   세계가 바꿀 수 있는 속성의 목록과 각자의 허용 범위를 관찰 결과에 실었다.
              View 가 "무엇을 바꿀 수 있는가" 를 알기 위해 World 를 들여다볼 필요가 없어졌다.

    C009      그 목록을 명령 카탈로그의 Domain 으로 옮겼다. 걸 수 있는 명령이 무엇인지를
              세계가 밝히고, View 는 밝혀진 것을 그리기만 한다.
              당시 이 설계의 값은 "앞으로 명령이 늘어날 자리를 낸다" 는 예고였다.

    C010      그 예고가 실제로 값을 했다. 세계에 두 속성(공격 능력·방어 능력)을 더한 것
              만으로 조작 표면이 늘었다 — **View 코드 변경 0**.
              07-view-implementation.md 의 SPEC CONSUMED · commandCatalog 항목이 근거다.

    같은 구조가 이미 다른 곳에도 있다 — 스킬의 가용성과 불가 사유(C007), 존재 종류의
    정적 데이터 3원소 정합 검사(`npm run catalog:check`). 목록의 단일 출처가 세계 쪽에
    있을 때 표면이 저절로 따라온다는 것이 세 Cycle에 걸쳐 반복되었다.

## AFFECTED NODES

    직접   MC-* 중 "무엇을 할 수 있는가" 를 관찰로 밝히는 것 전부
    간접   앞으로 선택지가 늘어나는 모든 Capability —
           스킬 목록 · 존재 종류 · 장비 슬롯 · 명령 · 상호작용

    이것은 특정 Goal/Possibility 에 매이지 않는다. Capability 의 **형태**를 제한한다.

## EXPECTED SCOPE

    GLOBAL — 전투에 한정되지 않는다. World → View 경계 전반의 성질이다.

## REQUIRES

    - 선택 가능한 항목의 집합과 각 항목의 허용 범위를 세계가 관찰 계약에 싣는다
    - 새 항목이 생기면 세계 쪽 단일 출처에 더하는 것으로 끝난다

## PROHIBITS

    - View 가 선택지 목록을 자기 코드에 적어 두는 것
    - 같은 목록이 World 와 View 두 곳에 적히는 것

## PREFERS

    - 목록의 각 항목이 자기 사유 코드(불가할 때 왜인지)를 함께 지니는 것

## POTENTIAL CONFLICTS

    없음. 기존 DC-* 4종(Active)은 모두 COMBAT scope 이고 이것은 경계의 형태에 대한
    것이라 겹치지 않는다.

    다만 승격 시 검토할 것 — 이 원칙은 "표현 결정은 View 가 한다" 는 기존 2-Layer
    원칙과 붙어 있다. 목록은 세계가, 그 목록을 **어떻게 보여줄지**는 View 가 정한다.
    문안이 이 경계를 흐리면 View 의 표현 자유를 침범할 수 있다.

## WHY THIS SHOULD BECOME A CONSTRAINT

    세 Cycle 에 걸쳐 같은 이득이 반복되었고, C010 에서 "코드 변경 0" 이라는 측정 가능한
    형태로 나타났다. Constraint 로 세우면 앞으로의 Cycle 이 선택지를 늘릴 때마다
    View 를 함께 고쳐야 하는지를 다시 판단하지 않아도 된다.

    반대로 세우지 않으면, 편의상 View 에 목록을 적는 Cycle 이 하나만 나와도 그 뒤로는
    두 곳을 함께 고쳐야 한다 — 되돌리기 어려운 종류의 부채다.

## HUMAN DECISION

    APPROVED       2026-08-17
    Reason         세 Cycle 에 걸친 반복과 C010 의 "코드 변경 0" 이 근거로 충분하다.
                   승격 결과 → constraints/DC-WORLD-OWNS-THE-SURFACE-LIST.yaml
                   (provenance 에 CANDIDATE:CC-WORLD-OWNS-THE-SURFACE-LIST 를 남겼다)

    이 파일은 지우지 않는다 — 그 원칙이 어디서 왔는지의 기록이다.
