# CYCLE C004 — View Implementation

계약은 `04-gameview.spec.yaml` (VIEW-MULTI-OBSERVER-001) 하나다.
`world/` 도 `03-world-semantic.md` 도 읽지 않았다.

## SPEC CONSUMED
    identity                              view/net/observer-identity.ts        [ADDED]
        owner: observer                   보관·재선언은 관찰자 쪽 책임
        firstTime: observer-generates     보관된 것이 없으면 스스로 만든다
        stability: persists-across-links  보관소가 살아 있는 한 같은 나를 밝힌다
        보관 수단은 주입받는다 — 브라우저 없이 검증하기 위해서다.
        저장소를 쓸 수 없으면(사생활 모드) 이번 세션만 사는 식별으로 물러난다.

    identity.declaredOn: link-established view/net/world-link.ts               [CHANGED]
        이어짐이 열리면 가장 먼저 join 을 보낸다.
        열림이 동기로 오는 경우(가짜 소켓)를 위해 소켓이 손에 잡히는 즉시 보내도록 했다.
    session.onReconnect.redeclares        같은 코드 경로다 — 다시 열릴 때도 밝힌다.

    observer.self                         view/tests/world-link.spec.ts 로 확인
        Snapshot.observer 로 들어온다. 화면 결정에는 role 이 이미 갈라져 오므로
        View 가 이 값으로 다시 판별할 필요가 없다 — 세계가 이미 갈라 주었다.

    entities.character.role               view/presentation/role-presentation.ts [CHANGED]
        other-player-character 항목 추가 — 같은 시트, 다른 색, 카메라 따라가지 않음.
        카메라가 따라가는 것은 여전히 player-character 하나뿐이다.

    entities.character.attended           view/presentation/role-presentation.ts [ADDED]
                                          view/presentation/resolve.ts           [CHANGED]
        attended = false → unattendedTint(탈색) + unattendedLabel('자리 비움').
        결정은 role 항목에 있고 resolve 는 옮기기만 한다.

    hud.observers.present                 view/presentation/hud-presentation.ts  [ADDED]
        '함께' 👥 N명

    interactions.subject: observer-character
        View 는 아무것도 하지 않는다 — 요청에 주체를 적는 자리가 없기 때문이다.
        기존 입력 경로(app/main.ts)가 그대로 내 몸에 닿는다.

    delivery · session.link · entities.deposit · interactions · motion
        C003 · C002 계약 그대로. 수정하지 않았다.

## ASSET MAPPING
    other-player-character → player-pickaxe:<state> (내 몸과 같은 시트)
                             tint 0xffd9a0 / 자리 비움 시 0x6b6b6b
    새 Asset 은 추가하지 않았다 — 등록된 sprite 키를 그대로 쓴다.

## INPUT → ACTION REQUEST
    변경 없음. WASD → move · 클릭 → move/mine · E → mine · Space → attack.
    C004 로 달라진 것은 그 요청이 "내 몸"에 닿는다는 사실뿐이고,
    그 판정은 세계가 이어짐으로 한다 — View 는 아무것도 덧붙이지 않는다.
    이어짐이 열리면 요청보다 먼저 join 이 나간다.

## FIXTURE TESTS (World 미기동)
    view/tests/fixtures/two-observers.fixture.json                          [ADDED]
        내 몸 · 조종되는 다른 몸 · 조종되지 않는 다른 몸 · NPC · 광맥
    기존 fixture 4종                                                        [CHANGED]
        observer 절 추가 (계약이 요구한다)

    view/tests/resolve.spec.ts        11건 (C004 4건 추가)
        내 몸만 카메라가 따라간다 / 남의 몸은 색으로 구분된다
        조종하는 이가 없는 몸은 탈색 + '자리 비움'
        함께 보는 수가 HUD 로 표시된다
        소지품은 내 것 하나뿐이다
    view/tests/world-link.spec.ts     11건 (C004 3건 추가)
        열리면 가장 먼저 자신을 밝힌다 / 다시 이을 때도 같은 것을 밝힌다 /
        관찰 결과가 누구의 것인지 안다
        기존 이어짐 상태 전이 8건은 join 이 sent[0] 이 된 것만 반영하고 그대로 통과
    view/tests/observer-identity.spec.ts 5건                                [ADDED]
        만들어 보관 / 보관된 것을 다시 / 여러 번 물어도 같은 나 /
        세계가 받아들일 수 있는 형태 / 다른 보관소는 다른 나
    view/tests/motion.spec.ts         15건 수정 없이 통과

    실행 결과   view 42건 통과 (world 72 + server 13 포함 전체 127건 통과)
    타입 검사   npx tsc --noEmit 통과
    빌드        vite build 성공. 번들에 world 코드 0건
                (RULE-MINE-001 · wanderIndex · perceptionRange · createWorld ·
                 ruleObserverJoin 모두 0)

## NOTES
    Capability Layer(renderer · hud · input)는 한 줄도 고치지 않았다.
    C004 의 View 작업은 전부 결정 Layer 의 항목 추가와 계약 소비였다 —
    Guide 가 말하는 "새 Cycle 의 View 작업 = 결정 항목 추가" 그대로다.

    판단한 것 하나 — 다른 관찰자의 몸에 이름표를 붙이지 않았다.
    04-gameview.spec.yaml 이 다른 관찰자의 Id 를 투영하지 않기로 했으므로
    View 에는 붙일 이름이 없다. 구분은 색으로 하고, 자리 비움만 글로 알린다.
    누구인지 보여주는 것은 이번 Cycle 의 의미가 아니다.
