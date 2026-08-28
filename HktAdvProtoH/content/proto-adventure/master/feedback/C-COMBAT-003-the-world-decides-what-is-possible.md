# Feedback — C-COMBAT-003-the-world-decides-what-is-possible

    반영 위치    main(7caf290) + 문서 공정 개편 브랜치 위 — main 은 그 뒤 무변경이며
                 반영은 그 PR 의 병합으로 main 에 들어간다 (Where 의 취지 충족 · 경위: git)
    근거         cycles/C-COMBAT-003-the-world-decides-what-is-possible/08-verification.md
                 의 MASTER FEEDBACK. C-COMBAT-004 반영과 한 배치다

## Overlay

    MC-ABILITY-CONDITION   PARTIAL → IMPLEMENTED
        world_shape 세 문장 전부 실측 (08 WORLD SCENARIO ①~④ · VIEW FIXTURE).
        overlay_gap("사유의 원천이 전부 자기 조건") 닫힘 — struck-by-them 이 세계의
        사실을 읽는 첫 관문이다. 표식 조건은 C-COMBAT-004 가 이었다 (그쪽 반영 참조)

    MC-AURA-ALLOCATION     PARTIAL → IMPLEMENTED
        world_shape 네 문장이 전부 실측되었다 — 상태·입력·표시는 C-COMBAT-001,
        "쓸 수 있는 것의 목록이 실제로 달라진다" 는 이 Cycle (WORLD SCENARIO ①②④ —
        배분 하나로 기술 하나가 여닫힌다). 구 gap 자신이 "조건 관문이 서야 닫힌다" 고
        적었고 그 관문이 섰다.
        구 보류 사유는 detail 의 예 둘(인지 관문 등)이었으나 판정 기준은 world_shape 다
        (SCHEMA "모든 Node 공통" — detail 폐기). 인지 축이 가능 여부를 가르는 일은
        이 노드의 결손이 아니라 요구가 생길 때의 새 후보 감이다.
        LANES HUMAN 대기의 해당 항목은 이 판정으로 닫고 MP-EXPLOIT-OPEN-BODY 만 남긴다

## Possibility

    MP-BIND-BY-CONTRACT        overlay_missing 갱신 — 남은 둘 MC-VOW · MC-BIND
    MP-KNOW-THE-OPPONENT-RULE  overlay_missing 갱신 — 남은 둘 MC-OBSERVE-ABILITY ·
                               MC-DISRUPT-ABILITY. 둘 다 아직 닫히지 않는다

## Frontier (자기 트랙만 — COMBAT)

    지웠다   FR-THE-WORLD-DECIDES-WHAT-IS-POSSIBLE → 이 Cycle 로 닫혔다
    갱신     파일을 새 골격(9칸 · 한눈에 보기 표 단일화)으로 이행 (SCHEMA frontier 절) ·
             FR-KNOW-WHAT-THEY-CAN-DO 의존에 습성 문서 승인 추가 (아래 Gap ①)

## Constraint Evaluation

    노드 값 유지 (전부 SATISFIED — 값만). 특기 하나: DC-WORLD-OWNS-THE-SURFACE-LIST 를
    세계 쪽이 한 번 어겼다 고쳤다 (isSkillKind 가 종류 이름을 코드에 적음 — 06 NOTES ①).
    그 관찰이 아래 Candidate ① 이다

## Candidates

    신규     CC-THE-LIST-IS-THE-JUDGE-TOO (PENDING) — 목록이 판정에도 걸린다 (관찰 둘째)
    갱신     CC-THE-RULE-DOES-NOT-ASK-WHO-DRIVES — 여섯째 반복
             (RULE-ABILITY-REQUIREMENT-001 이 조종 주체를 묻지 않는다)

## Master Gap

    ① 자율 존재가 이 기술에 닿지 못한다 — 결손이 아니라 판단 구조의 미개방.
       Design-Creature-Behavior-R0 승인 대기 (기존 HUMAN 대기 그대로) ·
       FR-KNOW-WHAT-THEY-CAN-DO 의존과 frontier "고르기 전에" 에 반영
    ② 관문이 상대를 읽지 못한다 → C-COMBAT-004 가 닫았다 (표식 조건)
    ③ 키 자리가 좁아진다 (O 사용) → C-COMBAT-004 에서 바닥났다 (그쪽 Gap ②)

## VIEW

    경위에 조건을 펼쳐 읽히게 하는 일 — works/BACKLOG.md `condition-in-the-breakdown`
    에 이미 서 있다 (07 NOTES ③)
