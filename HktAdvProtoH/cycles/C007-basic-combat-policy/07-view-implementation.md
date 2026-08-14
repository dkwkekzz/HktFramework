# C007 — View Implementation

## SPEC CONSUMED
    entityHud (이름·생명·쓰러짐)          view/presentation/combat-presentation.ts  nameplate()
                                          view/hud/hud.ts  plateLayer
    entities.character.attributes (R2)    view/presentation/combat-presentation.ts  inspectLines()
    debugAuthority.inspect (R2)           view/presentation/resolve.ts  options.inspect
                                          app/main.ts  INSPECT_KEY (V)
    strikeEvents                          view/presentation/combat-presentation.ts  strikeMark()
                                          view/hud/hud.ts  strikeLayer
    hud.self (자원·템포·배율)             view/presentation/combat-presentation.ts  selfPanel()
                                          view/hud/hud.ts  selfPanel
    interactions.attack (skill-basic)     view/presentation/interaction-presentation.ts
    interactions.skillHeavy               view/presentation/interaction-presentation.ts
    interactions.moveMode                 app/main.ts  MOVE_MODE_KEYS
    interactions.setAttribute (R2)        키 없음 — 이번 Cycle 은 경로만 연다
    entities.character.state 신규 값       view/presentation/code-text.ts (강공격 · 쓰러짐)

## RENDER PLAN 확장
    SceneNameplate · SceneStrike · SceneSelf   view/scene/scene-state.ts
    SceneEntity.nameplate · inspect            같은 파일
    SceneState.self · strikes · worldTime      같은 파일
    HudOverlays(plates · strikes)              view/hud/hud.ts — 화면 좌표 투영은 조립 루트가 한다

## ASSET MAPPING
    없음 — 새 그림을 더하지 않았다.
    존재 HUD·타격 숫자·자기 정보는 전부 DOM 표시이며 index.html 의 스타일이 그린다.
    heavy-attack · downed 는 모션 자산이 없어 기존 폴백(kind:idle → placeholder)으로 그려진다.
    행동을 구분해 읽는 것은 상단 HUD 의 "행동" 항목과 존재 HUD 가 맡는다.

## INPUT → ACTION REQUEST
    F        Skill(attack)            기존 자리 그대로 (C002 의 공격 키)
    G        Skill(heavy-attack)      C007 ADDED
    Shift    SetMoveMode(walk | run)  현재 값을 보고 반대값을 명시해 보낸다 (토글 아님)
    E        Mine                     기존
    클릭/WASD Move                     기존
    C        충돌체 관찰 토글          View 자체 기능 — World 에 요청하지 않는다
    V        속성 관찰 토글 (R2)       View 자체 기능 — 세계는 이미 다 보내고 있다

## FIXTURE TESTS
    view/tests/combat.spec.ts (19 항목) + view/tests/fixtures/combat.fixture.json
        entityHud        이름·생명·비율 · 쓰러짐 구분 · 토글 없이 항상 · 기본은 속성 미표시
        inspect          켜면 남/자기 속성 모두 펼쳐짐 · 끄면 없음
        strikeEvents     숫자·자리·시각 · 고급 스킬 강조 · 내가/남이 친 것 모두 · worldTime
        hud.self         자원 비율 · 이동 모드 문구+코드 · 템포 줄 · 1 이 아닌 배율만 줄 ·
                         self 값이 일반 HUD 로 중복되지 않음
        interaction      F/G 키 · insufficient-cp 문구 · Shift 안내 · set-attribute 키 없음
        상태 표현        heavy-attack · downed 의 그림 키

    기존 Fixture 5종에 strikes/debug 를 더했다 (계약 필수 항목).
    전체 269개 통과 (World 39 + View 19 신규 포함).

## PLAY VERIFICATION (실제 클라이언트, Chromium)
    세계를 띄우고(`npx tsx server/main.ts`) 브라우저로 실제 플레이해 확인했다.

    확인된 것
      존재 HUD      모든 몸 위에 "Player 1 / 180 200", "Wanderer 1 / 100 120" 이 붙는다
      타격 숫자     기본 스킬이 닿는 순간 맞은 자리에 "-20" 이 떠올랐다 사라진다
      자기 정보     HP/CP 막대 + "걷기/달리기" + 이동 속도 6 ·달리기 ×1.8 · 공격 속도 ×1
      달리기        Shift 로 "달리기" 로 바뀌고 "기력 충전 배율 ×0.5" 줄이 나타난다
      속성 관찰     V 로 모든 몸 위에 기력·이동·공속·배율 4종이 펼쳐진다 (남의 것도)
      고급 스킬     G 로 상단 HUD 의 행동이 "강공격" 으로 바뀐다
      쓰러짐        자율 존재가 0/120 이 되면 표지가 흐려지고 이름이 붉어진다.
                    쓰러진 뒤로는 움직이지도, 맞지도 않는다

    관찰된 사실 (설계대로)
      쓰러진 몸에는 휘두름이 닿아도 아무 일도 일어나지 않는다 —
      그래서 이미 쓰러진 대상에게는 타격 숫자가 뜨지 않는다.
      고급 스킬의 "-55" 강조 표시는 Fixture 검증으로 확인했다.

## NOTES
    - 세계는 모든 속성을 보내지만 View 는 몸 위에 이름과 생명만 늘 띄운다.
      감춘 것이 아니라 표시 선택이며, V 를 켜면 그 자리에서 전부 펼쳐진다
      (04 entityHud.notShownByDefault 그대로).
    - hud.self.* 항목은 self 패널이 가져가고 일반 HUD 줄에서는 걸러낸다 — 같은 값을 두 번 그리지 않는다.
    - 배율은 1 이 아닐 때만 줄이 된다. 걸린 것이 있을 때만 눈에 띄어야 한다.
    - 이동 모드만은 값을 실어 보내야 해서 조립 루트가 직접 다룬다.
      Interaction Presentation 에는 안내 키 표기만 둔다.

## DEVIATION
    사유 코드 `out-of-range` 충돌 — C001 이 "너무 멀다" 로 이미 쓰고 있어
    속성 변경의 범위 초과는 `value-out-of-range` 로 나누었다.
    03·04 Artifact 도 같은 이름으로 갱신했다.
