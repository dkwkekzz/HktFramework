# C010 — View Implementation

> 입력: `04-gameview.spec.yaml` (VIEW-GUARD-TRADES-BODY-FOR-RESOURCE-001) · 현재 `view/` · `protocol/`
> `03-world-semantic.md` 와 `world/` 는 읽지 않았다 — 계약 하나만으로 화면을 구성했다.

## SPEC CONSUMED

    04 항목                                  구현 자리
    ─────────────────────────────────────────────────────────────────
    entities.character.stance                view/presentation/combat-presentation.ts  nameplate()
        guarding · broken                    → SceneNameplate.guarding · guardBroken
        facing                               body.facing 와 같은 값이므로 다시 그리지 않는다
                                             (C008 의 방향 표현이 이미 이 값을 쓴다 — 중복 결정 금지)
        brokenUntil                          지금은 표시하지 않는다 (아래 NOTES ②)

    entities.character.attributes.defense    combat-presentation.ts  inspectLines()
                                             → "방어 5" (속성 관찰을 켤 때만 — C007 R2 규율 그대로)

    entityHud.shows.guarding / guardBroken   view/hud/hud.ts  plateLayer
                                             → data-guarding · data-guard-broken 표시 상태
                                             index.html — 막는 몸에 ⛊ 와 테두리,
                                             무너진 몸에 ✕ 를 붙인다

    strikeEvents.breakdown                   combat-presentation.ts  strikeMark() · strikeDetail()
        base → mitigated                     "20 → 15"
        guarded · energyPaid                 "막음 · 기력 -10.2"
        guardBroken                          "방어 무너짐"
                                             → SceneStrike.detail · guarded · guardBroken
                                             hud.ts 가 둘째 줄로 그리고 색을 가른다

    interactions.guard                       view/presentation/interaction-presentation.ts
                                             'set-guard-stance' → Q 키 · "막기"
        available / unavailableReason        기존 SceneInteraction 계약 그대로 흐른다
                                             (사유 문구는 code-text.ts 가 정한다)

    interactions.attack / skillHeavy / mine  새 사유 'guarding' 이 code-text 에 더해졌을 뿐 —
        unavailableReason: guarding          기존 표시 경로가 그대로 문구를 만든다

    hud.self.guard                           combat-presentation.ts  selfPanel()
        stance · broken · available/reason   → SceneSelf.stance · stanceCode · guarding ·
                                                guardBroken · guardUnavailableText
    hud.self.defense                         → SceneSelf.defense + "방어력 5" 줄

## ASSET MAPPING

    없음 — 새 sprite 를 들이지 않았다.
    막는 자세는 새 모션 파일이 아니라 **표지의 표시**로 드러난다 (⛊ 와 테두리).
    이유: 이번 Cycle 은 자세가 행동 칸을 쓰지 않으므로 (02 R1) `entities.character.state` 에
    guard 가 오지 않는다 — 걷는 중이면 여전히 move 다. 모션 선택 기준(kind + state)을
    건드리지 않고 표현을 얹는 것이 계약에 맞다.
    `motions/<kind>/guard.*.png` 를 넣으면 그때 모션으로 승격할 수 있는 자리는 열려 있다.

## INPUT → ACTION REQUEST

    Q (또는 손가락 조작 자리의 "막기")
        → SetStance(ObserverCharacter, guard | open)
        app/main.ts — GUARD_KEYS 분기.
        이동 모드(Shift)와 같은 형태다: 값을 실어 보내야 하므로 조립 루트가 직접 다루고,
        지금 자세(scene.self.stanceCode)의 반대를 명시값으로 보낸다.
        View 는 자기 판단으로 자세를 바꾸지 않는다 — 다음 관찰의 stance 를 따라간다
        (세계가 스스로 푸는 경우가 있다: 달리기 · 무너짐 · 쓰러짐).
        놓는 요청은 available 을 보지 않고 보낸다 — 놓는 것은 언제나 되기 때문이다.

    손가락 조작 자리(touch-pad)는 key + prompt 가 있는 interaction 을 자동으로 버튼으로
    만든다 — 'set-guard-stance' 에 둘 다 있으므로 코드를 더하지 않아도 버튼이 생긴다.

## FIXTURE TESTS

    view/tests/fixtures/guard.fixture.json          막는 중 · 남은 기력 12 ·
                                                    타격 3종(막아 냄 · 무너뜨림 · 그냥 맞음)
    view/tests/fixtures/guard-broken.fixture.json   무너진 여파 안 · 기력 0 · 막기 거절

    view/tests/guard.spec.ts (신규 19) — 전부 통과
        entityHud            막는 몸 / 무너진 몸 / 늘 실린다(켜야 보이는 것이 아니다)
        strikeEvents         막아 낸 타격의 경로 · 무너뜨린 타격 · 방어력 몫 ·
                             같은 스킬이라도 다르게 읽힘
        hud.self.guard       자세 문구+코드 · 방어력 줄 · 거절 사유 · 사유 없음
        interactions.guard   Q 키 · guarding 문구 · 무너짐 거절 · 걸음은 가용
        속성 관찰            켜면 방어 · 자세가 줄로 (무너짐 표기 포함)
        계약 정합            specId · 자세 없는 대상(광맥)에서 터지지 않음

    기존 Fixture 갱신 — combat.fixture.json · command.fixture.json 에
    attributes.defense · entities[].stance · strikes[].breakdown 을 더했다 (계약이 넓어졌다).
    view/tests/combat.spec.ts 의 두 기대값을 새 계약에 맞췄다
    (nameplate 에 guarding/guardBroken 추가, self.lines 를 자리가 아니라 내용으로 찾도록).

    실행 결과   전체 28 파일 430 테스트 중 429 통과.
                남은 1건은 `view/tests/motion-atlas.spec.ts` 의 시트 절단선 검사로,
                **이 Cycle 이전에도 같은 상태로 실패한다** (base 에서 재현 확인).
                C010 과 무관한 그림 자산 문제다.

## NOTES

    ① 두 Layer 분리를 지켰다. capability(hud/renderer/input)에는 "막기" 라는 말이 없다 —
       data-guarding / data-guard-broken 이라는 표시 상태와 detail 한 줄을 그릴 뿐이고,
       그것이 무슨 뜻인지는 presentation 이 정한다. Q 키도 role 항목에서 온다.

    ② stance.brokenUntil 은 계약으로 받되 화면에 숫자로 띄우지 않았다.
       남은 시간을 초로 보여 주는 것보다 "지금 막을 수 없다 + 그 사유" 가 플레이에 필요한
       정보이고, 그것은 이미 hud.self.guard 에 있다. 계약은 소비되지 않은 것이 아니라
       **표시하지 않기로 결정된 것**이다 — 나중에 게이지가 필요해지면 그 자리에서 쓴다.

    ③ 막아 낸 피해가 정수가 아니다 (2.25). 반올림하면 −2 가 되고, 더 작은 값에서는 −0 이 되어
       "막으면 안 아프다" 로 잘못 읽힌다. 10 미만이면 소수 한 자리를 남기는 규칙을 두었다
       (strikeNumber). 세계는 실수를 그대로 두고 표현만 View 가 정한다는 경계 그대로다.

    ④ GAMEVIEW GAP 없음. 04 의 delta 항목이 모두 화면 지시로 옮겨졌다.
