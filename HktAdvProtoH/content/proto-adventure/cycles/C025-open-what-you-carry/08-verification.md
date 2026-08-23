# CYCLE C025 — Verification

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[PASS] Playable
[PASS] Regression

## NEW BEHAVIOR

    I 를 누른다                      → 소지품 작업 공간이 열린다. 세계는 흔들리지 않는다
    지닌 것과 남은 자리가 함께 보인다  → 항목 칸 + `capacity − used` 만큼의 빈 칸
    ← → 로 하나를 고른다              → 그 물건으로 지금 무엇이 되고 무엇이 왜 안 되는지가
                                       **같은 자리에** 뜬다
    ↑ ↓ 로 행동을 고르고 Enter        → 관찰이 실어 온 그대로 요청된다
    Esc · ✕ 로 닫는다                → 세계는 그동안 계속 흘렀다

## WORLD SCENARIO

    세계는 한 줄도 바뀌지 않았다 (06). 이 Cycle 이 부르는 Rule 은 전부 기존이다.

    Before  inventory = [pickaxe ×1, buckler ×1] · room 2 / 4 · equipment 여섯 자리 전부 빔
    Input   Enter (고른 것 = 손방패 · 초점 = 걸기) → { interactionId: 'equip-item', itemKind: 'buckler' }
    Rule    RULE-ITEM-EQUIP-001 (C023 · 변경 없음)
    After   inventory = [pickaxe ×1] · room 1 / 4 · 자리 하나에 손방패 · 물리 방어 50 → 65

## VIEW FIXTURE

    view/tests/inventory-workspace.spec.ts — 32 tests, **세계 프로세스 없이** 통과 (VUX-IE-V-10)

        V-01  I / Esc 왕복 · 여닫기로 요청이 나가지 않는다
        V-02  항목마다 칸 하나 · 수량 · 빈 가방의 남길 글자
        V-03  고르고 옮기고 여닫아도 used / capacity 가 그대로다
        V-04  되는 것은 그 id 그대로 요청되고 안 되는 것은 요청되지 않는다
        V-05  기다리는 동안 수량도 자리도 바뀌지 않는다
        V-06  자판만으로 고르기 · 상세 읽기 · 실행이 된다
        V-09  모르는 kind · category · role · reason 이 코드 그대로 나온다

    FX-EMPTY    자리 0 / 4 · 빈 칸 넷 · `소지품 없음`
    FX-FULL     자리 4 / 4 · 가득 · 빈 칸 0 — **항목 둘에 자리 넷**(돌 아홉이 자리 셋)
    FX-STALE    보낸 뒤 `보냈다` · 두 번 보내지 않는다 · 표식으로 풀린다 ·
                표식 없는 대답은 가져가지 않는다
    FX-UNKNOWN  `moonshard` · `attune-item` · `moon-is-not-yours` 가 그대로 나온다

## PLAYABLE — 실제 게임에서 실측

    `npm run dev` 로 세계와 클라이언트를 띄우고 브라우저에서 실제로 조작했다
    (헤드리스 크로뮴 · 1280×800 · 콘솔 오류 0).

    1. 붙는다                → 자리 2 / 4 · 곡괭이 ×1 · 손방패 ×1
    2. `I`                   → **작업 공간이 열린다.** `지닌 것 — 2 종류` 칸 둘,
                               `자리 2 / 4 · 남은 자리 2` 아래 점선 빈 칸 둘
    3. `→`                   → 곡괭이가 고른 것이 되고 상세가 뜬다
                               `✗ 쓰기 — 대상 없음` · `✓ 걸기` ·
                               `✗ 바꿔 걸기 — 걸린 것 없음` · `✗ 덜어내기 — 되돌릴 수 없음`
                               **되는 것 하나와 안 되는 것 셋이 사유와 함께 한 자리에 있다**
    4. `↓`                   → 초점이 다음 줄로. 고른 칸(파란 테두리)과 초점(노란 링)이
                               서로 다른 자리에 보인다
    5. `→`                   → 손방패로 옮긴다. `✓ 걸기` · `✗ 바꿔 걸기 — 걸린 것 없음` ·
                               `✓ 덜어내기`
    6. `Enter`               → 세계가 판정하고 다음 관찰이 결과를 나른다:
                               `지닌 것 — 1 종류` · `자리 1 / 4 · 남은 자리 3` ·
                               위 띠에 `걸린 것: 손방패 · 물리 방어 +15` ·
                               self 패널의 물리 방어 `50 → 65`
                               **고른 것이 관찰에서 사라졌으므로 고르기가 지워졌고,
                               다른 것을 대신 고르지 않았다**
    7. `Esc`                 → 닫힌다. 이동이 다시 돌아온다

    화면 증거: `01-before` ~ `08-closed` 여덟 장. 재현은
    `npm run dev` 후 브라우저에서 `I` — 손으로도 같은 것이 나온다.

## REGRESSION

    기존 두·세 걸음 조작이 그대로 닿는다   1085 tests 전부 통과 (C020 · C022 · C023 · C024
                                          view 테스트가 한 줄도 바뀌지 않았다)
    가로 띠와 self 패널이 그대로다         같은 테스트가 증거다 — 작업 공간은 더해진 것이지
                                          대체한 것이 아니다
    세계 회귀 없음                         world/ 를 한 줄도 고치지 않았다 (06)
    blank 팩이 그대로 뜬다                 boundary 위반 0 · blank 스모크 통과

    실제 조작 중 확인: 표면이 열린 동안 방향키가 이동이 아니라 고르기가 되고,
    닫으면 이동이 돌아온다. 눌러 둔 방향이 닫는 순간 되살아나지 않는다.

## MASTER FEEDBACK

    Capability Overlay
        해당 없음 — 이 Cycle 은 Capability 를 건드리지 않는다 (01 MASTER TRACE).
        다만 **MC-EQUIP-ITEM 의 IMPLEMENTED 판정이 이제 "겪을 수 있다" 를 뜻한다** —
        지금까지 그 판정은 "코드가 있다" 였고, 걸고 푸는 일에 닿는 길은 손가락 자리를
        외운 사람에게만 있었다. 이것은 새 판정이 아니라 기존 판정의 값어치다

    Constraint Evaluation
        DC-WORLD-OWNS-THE-SURFACE-LIST   SATISFIED — 화면이 판정을 하나도 하지 않는다.
                                         `exchange-item` 을 "안 되는 것" 으로 그리지 않은
                                         것이 그 증거다: 세계가 된다고 말했고, 이 자리에
                                         길이 없다는 사정은 화면의 것으로 따로 적었다
        DC-ITEM-KIND-IS-DATA-NOT-BRANCH  SATISFIED — 작업 공간 코드에 종류 이름이 하나도
                                         없다. FX-UNKNOWN 이 실측이다
        DC-ITEM-CAPACITY-IS-FINITE       SATISFIED — 남은 자리가 숫자가 아니라 **자리로**
                                         보인다
        DC-ITEM-HOLDING-IS-NOT-APPLYING  SATISFIED — 지닌 것만 그린다. 걸어 둔 것은 이
                                         표면에 없고 `contributions` 를 더하지 않는다

    Constraint Candidate
        관찰된 패턴 하나 — **표면이 넓어질 때 화면이 판정을 시작하려 한다.**
        이 Cycle 에서 그것이 두 번 나타났다: ① 가방의 형편에서 교체 가능 여부를 유추하고
        싶어지는 자리 ② 세계가 된다고 한 것을 화면 사정으로 "안 됨" 처리하고 싶어지는 자리.
        둘 다 기존 Constraint 로 막혔으므로 새 Constraint 후보로 올리지 않는다.
        **승격 판단은 Human 이다.**

    Master Gap
        없음.

## 이 Cycle 이 남긴 부채

    ① `engine/view-kernel` 에 표시 문구(한국어)가 남아 있다 — 기반 트랙 부채로 적었다
       (design/Design-System-Content-Separation.md 남은 부채).
    ② `SceneCommandSurface` 와 `SceneSelf` 를 범용 표면 위로 옮기지 않았다 —
       승격 규칙 1(rule of two). 다음 팩이 다른 패널을 요구할 때 정한다.
    ③ 좁은 화면(< 720px)은 지원 대상 밖이다 (기획서 §2.3).
    ④ 기획서 §12.3 의 "처음 보는 플레이어가 30초 안에" 는 **사람 한 명으로 재지 않았다.**
       이 문서의 PLAYABLE 은 만든 사람이 돌린 것이다.

## STATUS

    IN PROGRESS — **Human Play 확인만 남았다**

    여섯 판정 항목이 전부 통과했고 위 PLAYABLE 이 실제 게임에서 실측되었다.
    그러나 그 실측을 돌린 것은 만든 사람이다.

    **만든 사람이 돌려 본 것은 Human Play 가 아니다.** 이 세계의 완료 조건은 코드가 도는
    것도 테스트가 통과하는 것도 아니라 실제로 플레이되는 것이며(CLAUDE.md 15),
    그 확인은 겪는 사람이 한다. 그때까지 COMPLETE 로 바꾸지 않는다.

    확인하는 법
        npm run dev  →  브라우저에서 I  →  ← → 로 고르고  ↑ ↓ 로 행동을 고르고  Enter

    기획서 §12.3 의 "처음 보는 플레이어가 30초 안에" 는 그 자리에서만 잴 수 있다.
