# C019 — View Implementation

입력은 `04-gameview.spec.yaml` 하나다. `world/` 도 `03-world-semantic.md` 도 보지 않았다.

## IMPLEMENTED

    view/phase-presentation.ts (신규)
        isInStartup(entity)     세계가 보낸 actionPhase 를 그대로 읽는다
        startupMark(entity)     선딜일 때만 붙는 몸 위 표시
        cancelMark(cancel)      끊긴 자리에 뜨는 한 줄 (SceneStrike)

    view/code-text.ts
        startup '준비!' · active '나감' · recovery '거둠' · cancelled '끊김'
        구간 셋을 다 등록해 두되 화면에 뜨는 것은 선딜뿐이다 (아래 결정 2).

## 결정 셋 — 왜 이렇게 그리는가

    1. 선딜은 **몸 위**에 붙는다 (HUD 가 아니라)
       플레이어가 그 순간 고르는 것은 "지금 넣을까 말까" 이고, 그 답은 상대의 몸에서
       읽혀야 한다. HUD 로 올리면 눈이 몸에서 떠나고 "보고 반응한다" 가 "숫자를 읽는다"
       가 된다. 04 의 `hud: NONE` 이 이 결정의 계약 쪽 표현이다.

    2. **판정·후딜에는 아무것도 붙이지 않는다**
       표시가 없다는 것이 곧 "이미 나갔다 — 지금 넣어도 늦었다" 는 뜻이다.
       세 구간을 다 표시하면 무엇이 기회인지가 흐려진다. C018 이 중립을 표시하지 않은
       것과 같은 판단이다 (바탕은 그리지 않는다).

    3. 캔슬은 **끊긴 자리**에 뜬다 — 타격 숫자·무산 사유와 같은 그리기 능력
       셋 다 "그 자리에서 잠시 떠오르는 한 줄" 이고 다른 것은 문구뿐이다.
       무엇이 끊겼는지를 함께 싣는다("강공격 끊김") — 큰 것을 끊었다는 사실이
       플레이어가 배워야 할 것이기 때문이다. emphasis 는 참이다: 일어나지 않게 만든
       일이고, 그것이 플레이어가 한 일이다.

## AFFECTED UPDATED

    view/combat-presentation.ts (nameplate)
        이름 문자열이 `[관계] 준비! 이름` 순서가 된다. 관계 표시(C018)가 먼저다 —
        어떤 사이인지가 먼저 읽혀야 다가갈지 물러날지를 고르고, 그다음이 지금의 틈이다.

    view/resolve.ts
        strikes 배열에 cancels 를 더한다. 세 목록(타격 · 무산 · 캔슬)이 같은 자리를
        쓰되 문구로 갈린다.

## 새로 만들지 않은 것

    새 그리기 능력(capability)      캔슬은 SceneStrike 를 그대로 쓴다
    새 HUD 줄 · 새 막대             04 hud: NONE
    새 입력 · 새 버튼               끊는 것은 별도 행동이 아니라 때리는 것이다
    구간 계산                       progress 와 경계로 phase 를 만들지 않는다 —
                                    경계는 기술마다 다르고 세계 안에만 있다

## TESTS

    view/tests/phase.spec.ts + fixtures/phase.fixture.json     신규 9건 — 전부 통과

        VIEW NOTE 1  4건  선딜에 표시가 붙는다 · 이미 나간 쪽엔 안 붙는다 ·
                          기술이 아닌 행동엔 없다 · 관계 표시와 나란히 선다
        VIEW NOTE 2  3건  끊긴 자리에 무엇이 끊겼는지 뜬다 · 타격 숫자와 섞이지 않는다 ·
                          크게 그린다
        VIEW NOTE 3  2건  **진행도로 다시 계산하지 않는다**(같은 progress, 다른 phase 를
                          주면 표시가 따라 바뀐다) · profile 로 고르기 전에 안다

    fixture 는 한 장면이다 — 나는 큰 기술의 선딜 중이고(끊길 수 있다), 적대인 상대는
    이미 칼을 냈으며(늦었다), 중립인 상대는 걷고 있다(구간이 없다). 그 순간 내 기술이
    끊긴 사건이 함께 실려 있다.

    전체 회귀     858건 통과 (기존 849 + 신규 9) · 타입 검사 통과 · 경계 위반 0

    기존 View fixture 18종에 `cancels: []` 를 더했다 — 계약에 자리가 생겼으므로
    비어 있음을 명시한다 (C018 이 contacts 를 더했을 때와 같다).

## NOTES

    ① Human Play 로 확인할 것 — 08 의 몫
       선딜 0.45초가 실제로 반응 가능한 길이인지, 표시가 그 시간 안에 눈에 들어오는지는
       화면에서만 답할 수 있다. 짧다면 값은 semantic 의 BALANCE ① 한 줄이다.

    ② VIEW GAP 없음 — 04 계약만으로 세 요구를 다 그렸다.
