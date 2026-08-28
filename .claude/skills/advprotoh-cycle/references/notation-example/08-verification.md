# CYCLE C026 — Verification

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[PASS] Playable
[PASS] Regression

## NEW BEHAVIOR

    I                → 작업 공간이 열린다 — 세계 무변화
    격자             → 항목 칸 + (capacity − used) 만큼의 빈 칸
    ← →              → 고른 물건의 되는 것·안 되는 것·사유가 같은 자리에 뜬다
    ↑ ↓ + Enter      → 관찰이 실어 온 그대로 요청된다
    Esc · ✕          → 닫힌다 — 세계는 그동안 계속 흘렀다

## WORLD SCENARIO

    세계 변경 0 (06) — 이 Cycle 이 부르는 Rule 은 전부 기존이다.

    Before  inventory = [pickaxe ×1, buckler ×1] · room 2/4 · equipment 전부 빔
    Input   Enter (고른 것 buckler · 초점 걸기) → { interactionId: 'equip-item', itemKind: 'buckler' }
    Rule    RULE-ITEM-EQUIP-001 (C023 · 변경 없음)
    After   inventory = [pickaxe ×1] · room 1/4 · 자리 하나에 buckler · 물리 방어 50 → 65

## VIEW FIXTURE

    view/tests/inventory-workspace.spec.ts — 32 tests · 세계 프로세스 없이 통과 (VUX-IE-V-10)

        V-01  I/Esc 왕복 — 여닫기로 요청이 나가지 않는다
        V-02  항목마다 칸 하나 · 수량 · 빈 가방 문구
        V-03  부분 — 거르개 없음 (VUX-IE-04). 잰 것: 표시 조작이 세계의 두 수를 건드리지 않는다
        V-04  되는 것은 그 id 그대로 요청 · 안 되는 것은 요청되지 않는다
        V-05  대기 중 수량·자리 불변
        V-06  자판만으로 고르기 · 상세 · 실행
        V-07  걸어 둔 것은 칸에 없고 자리 셈에 들지 않는다
        V-08  안 잼 — 이 표면은 교체를 실행하지 않는다 (04 unexecutable_actions · VUX-IE-03 몫)
        V-09  모르는 kind·category·role·reason 은 코드 그대로 나온다

    FX-EMPTY(0/4 · 빈 칸 넷) · FX-FULL(4/4 — 항목 둘에 자리 넷: 돌 아홉이 자리 셋) ·
    FX-STALE(보냈다 표시 · 중복 전송 없음 · 표식으로 풀림 · 표식 없는 대답 무시) ·
    FX-UNKNOWN(moonshard · attune-item · moon-is-not-yours 그대로)

## PLAYABLE — 실제 게임 실측

    npm run dev · 헤드리스 크로뮴 1280×800 · 콘솔 오류 0

    1. 접속     자리 2/4 · pickaxe ×1 · buckler ×1
    2. I        작업 공간 열림 — 칸 둘 + 점선 빈 칸 둘 · `자리 2/4 · 남은 자리 2`
    3. →        pickaxe 상세: ✗쓰기(대상 없음) · ✓걸기 · ✗바꿔 걸기(걸린 것 없음) ·
                ✗덜어내기(되돌릴 수 없음) — 되는 것과 안 되는 것이 사유와 함께 한 자리
    4. ↓        초점 이동 — 고른 칸(파란 테두리)과 초점(노란 링)이 구분 표시
    5. →        buckler 상세: ✓걸기 · ✗바꿔 걸기(걸린 것 없음) · ✓덜어내기
    6. Enter    걸기 성공 — 다음 관찰로: 1종류 · 자리 1/4 · 걸린 것 buckler(+15) ·
                물리 방어 50→65 · 고른 것이 관찰에서 사라져 고르기 해제 (대체 선택 없음)
    7. Esc      닫힘 — 이동 복귀

    화면 증거 shots/01-before ~ 08-closed (여덟 장). 재현: npm run dev → 브라우저에서 I

## REGRESSION

    기존 두·세 걸음 조작    1085 tests 통과 — C020·C022·C023·C024 view 테스트 무변경
    가로 띠 · self 패널     동일 테스트가 증거 — 작업 공간은 추가이지 대체가 아니다
    세계                    world/ 무변경 (06)
    blank 팩                boundary 위반 0 · 스모크 통과
    실측 확인               열린 동안 방향키 = 고르기, 닫으면 이동 복귀 — 눌러 둔 방향이
                            닫는 순간 되살아나지 않는다

## MASTER FEEDBACK

    Capability Overlay      해당 없음 (01 MASTER TRACE). 단 MC-EQUIP-ITEM 의 IMPLEMENTED
                            판정이 "코드가 있다"에서 "겪을 수 있다"가 되었다 — 새 판정이
                            아니라 기존 판정의 값어치
    Constraint Evaluation
        DC-WORLD-OWNS-THE-SURFACE-LIST     SATISFIED — 화면 판정 0. exchange-item 을
                                           "안 됨"으로 그리지 않았고 화면 사정은 따로 적었다
        DC-ITEM-KIND-IS-DATA-NOT-BRANCH    SATISFIED — 작업 공간 코드에 종류 이름 0 (FX-UNKNOWN 실측)
        DC-ITEM-CAPACITY-IS-FINITE         SATISFIED — 남은 자리가 자리로 보인다
        DC-ITEM-HOLDING-IS-NOT-APPLYING    SATISFIED — 지닌 것만 그린다 · contributions 미사용
    Constraint Candidate    없음 — 관찰 1건: 표면이 넓어질 때 화면이 판정을 시작하려 한다
                            (두 번 나타났고 둘 다 기존 Constraint 로 막혔다). 승격 판단은 Human
    Master Gap              없음

## 부채

    ① engine/view-kernel 에 한국어 표시 문구 잔존 — 기반 트랙 (Design-System-Content-Separation 남은 부채)
    ② SceneCommandSurface·SceneSelf 범용 승격 보류 — rule of two, 다음 팩이 요구할 때 판단
    ③ 좁은 화면(<720px) 미지원 (기획서 §2.3)
    ④ 기획서 §12.3 "처음 보는 플레이어 30초" 미실측 — 만든 사람·승인한 사람은 이미 아는 사람
    ⑤ MOVE_KEYS·TURN_KEYS 원본이 팩에 미노출 — 사본(RESERVED_KEY_CODES)으로 차단 중.
       기반 트랙 부채 (레인 B 보고 · 여전히 열림)

## MERGE — 레인 B (C025-the-shape-is-data)

    번호 이동      C025 → C026 — 나중에 병합하는 쪽이 옮긴다
    코드 충돌      view/resolve.ts 한 곳 — colliderDebug(레인 B)와 surfaces(이 Cycle) 둘 다 유지
    키 겹침        없음 — 레인 B 는 R→H · T→Y 이동, 이 Cycle 은 I 신규
    합류 후 실측    I → 고르기 → Enter → 결과 → Esc 재확인 · 콘솔 오류 0 · 1117 tests ·
                   typecheck · boundary 0
    공통 발견      이동·시점 키가 삼켜져 interaction 에 닿지 않는 결손 — 레인 B 는 사본
                   목록으로, 이 Cycle 은 keyboard.suspendMovement 로 막았다. 같은 원인의
                   두 면이며 원본 노출은 기반 트랙 몫 (부채 ⑤)

## STATUS

    COMPLETE — Human 이 실제 게임 화면을 보고 확인 (Stage 5 에서 지정한 완료 기준).
    잔여는 부채 ④ 하나.
