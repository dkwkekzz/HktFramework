# C011 — View Implementation

> 입력: `04-gameview.spec.yaml` (VIEW-PERFECT-GUARD-TURNS-THE-TABLE-001) — 유일한 World 계약
> `03-world-semantic.md` 와 `world/` 는 읽지 않았다.
> 새 capability 를 만들지 않았다 — C010 이 세운 표지·타격 숫자·자기 패널이 이미 있으므로
> 이 Cycle 은 그 결정 항목에 자리를 더한다 (결정 Layer 만 손댄다).

## SPEC CONSUMED

    entities.character.stance.startedAt        view/presentation/combat-presentation.ts
    entities.character.stance.perfectWindow    → nameplate.perfectWindow
    entities.character.exposure                → nameplate.exposed
    entityHud.shows.exposed                    → view/hud/hud.ts  data-exposed
    strikeEvents.timing.perfect                → strikeMark.perfect · detail "완벽하게 막음"
    strikeEvents.timing.elapsed                → detail "(0.15초)"
    strikeEvents.timing.counter                → strikeMark.counter · detail "되받음 +5"
    strikeEvents.timing.counterBonus           → 같은 자리
    strikeEvents.timing.energyGained           → detail "기력 +10"
    hud.self.guard.perfectWindow               → self.perfectWindow
    hud.self.guard.rearmAt                     → self.guardRearmIn (world.time 과의 차)
    hud.self.exposure                          → self.exposed
    interactions.guard.unavailableReason
        (+guard-rearming)                      → view/presentation/code-text.ts

    04 의 항목 중 화면으로 옮기지 않은 것
        entities.character.stance.startedAt — 값 자체는 표지에 띄우지 않는다.
        04 notShownByDefault 가 그렇게 정했고, 창의 유무(perfectWindow)와
        타격 내역의 elapsed 로 필요한 것은 전부 읽힌다. 계약에는 실려 있으므로
        속성 관찰을 고도화하는 Cycle 이 언제든 꺼내 쓸 수 있다.

## ASSET MAPPING

    없음 — 새 role 도, 새 kind 도, 새 그림도 없다.
    이 Cycle 이 더한 것은 이미 그려지고 있는 표지·숫자·패널 위의 구분뿐이다.

    표지 (index.html)
        data-perfect-window="true"  밝은 테두리 + ⛊ (막고 있는 것보다 밝다)
        data-exposed="true"         노란 테두리 + ◇  ("지금이 때릴 때다")
    타격 숫자
        data-perfect="true"         밝은 흰빛 — 잃은 것이 없다는 뜻
        data-counter="true"         뜨거운 주황 + 큰 글씨 — 큰 숫자가 우연이 아님을 먼저 알린다
    자기 패널
        data-perfect-window="true"  창이 열린 동안 자세 문구가 밝아진다 (" · 지금")
        data-exposed="true"         내가 열려 있는 동안 (" · 열림")
        재세움 남은 시간            " · 0.4초"

    무너짐(C010)과 열림(C011)을 다른 색으로 둔 이유 — 하나는 내 실패이고 하나는 내 성공이다.
    같은 색이면 둘 다 "무슨 일이 났다" 로만 읽힌다.

## INPUT → ACTION REQUEST

    변경 없음. 이 Cycle 은 새 조작을 만들지 않는다 —
    C010 의 막기 요청(SetStance)을 **언제** 보내는가가 전부이기 때문이다.
    같은 키, 같은 요청, 다른 시점.

    다만 거절이 하나 늘었으므로 그 사유가 문구로 옮겨진다 (code-text.ts):
        guard-rearming → "방금 자세를 세웠다 — 다시 세우려면 한 호흡이 필요하다"
    이것이 없으면 재세움 간격은 "가끔 안 먹히는 버튼" 으로만 느껴진다.

## FIXTURE TESTS

    view/tests/perfect-guard.spec.ts    16개 — 전부 통과 (World 미기동)

        perfect-guard.fixture.json      창 안의 자세 · 완벽하게 막힌 타격 · 열린 몸 ·
                                        되받아친 타격 · 창 밖의 보통 막기
        guard-rearming.fixture.json     방금 놓아 다시 세울 수 없는 상태 · 내가 열려 있는 상태

        entities.character.stance (2)   창 안의 자세가 구분된다 / 창 없는 몸엔 표지도 없다
        entityHud.shows.exposed (4)     막힌 자가 열린다 / 막아 낸 자는 열리지 않는다 /
                                        쓰러진 몸엔 남지 않는다 / 켜야 보이는 것이 아니다
        strikeEvents.timing (4)         완벽 = 잃은 것 없이 벌었다 / 되받아침이 키운 몫이 보인다 /
                                        되받아침은 크게 그린다 / 창 밖은 C010 그대로
        hud.self.guard (4)              창이 실린다 / 사유와 남은 시간 / 나도 열린다 /
                                        불가 사유가 문구로 옮겨진다
        View 는 세계가 준 것만 쓴다 (2)  남은 시간은 세계 값의 차로만 만든다 /
                                        옛 계약도 그려진다 (표현 누락이 게임을 멈추지 않는다)

    기존 Fixture 갱신 — 계약이 넓어졌으므로 네 파일이 새 자리를 갖는다
        combat / command / guard / guard-broken.fixture.json
        값은 그 Fixture 가 이미 말하는 상황과 어긋나지 않게 채웠다 —
        막고 있지 않은 몸은 창도 없고, 기존 타격은 전부 C010 시절의 것이므로
        완벽도 되받아침도 아니다. 기존 19 + 21 개 검증이 그대로 통과한다.

    전체                                476 통과 / 1 실패
        실패 1건은 view/tests/motion-atlas.spec.ts 의 시트 절단선 검사이며
        **이 Cycle 이전부터 실패하고 있었다** (C011 커밋을 stash 한 상태에서도 같은 실패).
        그림 파일 판독 검사로 이 Cycle 과 무관하다 — 고치지 않고 사실만 남긴다.

## NOTES

    ── 이 Cycle 의 View 는 "같은 것을 다르게 읽히게 하는 일" 이다 ────────

    C010 은 새 조작(막기)과 새 표지를 만들었다. C011 은 아무것도 새로 그리지 않는다 —
    같은 자세, 같은 타격 숫자, 같은 패널이 **언제였는가**에 따라 다르게 읽히게 할 뿐이다.
    그래서 이 Cycle 의 View 작업은 전부 결정 Layer 안에서 끝났고
    capability(renderer/hud/input) 코드에는 게임 의미가 한 줄도 더해지지 않았다 —
    data 속성이 하나씩 늘었을 뿐이고, 그것이 무슨 뜻인지는 여전히 CSS 와 결정 Layer 만 안다.

    ── elapsed 를 그대로 보여 주는 것 ──────────────────────────────────

    타격 한 줄에 "(0.15초)" 를 그대로 싣는다. 세계는 창의 크기(0.20)를 말해 주지 않지만,
    플레이어는 여러 번의 값을 비교해 그 경계를 스스로 알아낸다 —
    0.15 는 완벽했고 0.94 는 아니었다는 것이 같은 자리에서 읽히기 때문이다.
    04 가 이것을 "결과가 우연이 아니라는 증거" 라고 부른 자리이며,
    C010 이 GUARD_FRONT_COS 에 대해 남긴 아쉬움("각도를 맞아 보며 배운다")을
    이 Cycle 이 시점에 대해서는 남기지 않는 방법이다.

    ── 재세움 남은 시간을 자세가 서 있을 때는 세지 않는다 ────────────────

    세계는 이미 서 있는 자세에 오는 guard 요청을 거절하지 않는다 —
    아무것도 바꾸지 않는 요청이므로 거절할 것이 없다 (06 참조).
    View 도 같은 판단을 따라, 막고 있는 동안에는 남은 시간을 만들지 않는다.
    그러지 않으면 "막고 있는데 막을 수 없다고 뜨는" 화면이 된다 —
    계약이 아니라 화면이 거짓말을 하게 되는 자리다.

    ── 되받아침을 크게 그리는 것 (판단) ────────────────────────────────

    04 는 "큰 숫자가 나왔다 가 아니라 열려 있었기 때문에 이만큼 커졌다 로 읽혀야 한다" 고만
    말한다. 어떻게 크게 그릴지는 View 의 결정이므로, 고급 스킬에 이미 쓰고 있던
    emphasis 를 되받아침에도 준다 — 새 표현 축을 만들지 않고 기존 것을 나눠 쓴다.
    색은 다르다(고급 = 노랑 · 되받아침 = 주황). 둘이 겹치면 되받아침 색이 이긴다 —
    "왜 컸는가" 의 답이 스킬 종류가 아니라 시점이기 때문이다.
