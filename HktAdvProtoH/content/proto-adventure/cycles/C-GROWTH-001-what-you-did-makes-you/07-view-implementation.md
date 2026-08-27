# C-GROWTH-001 — View Implementation

> 04 가 세운 계약을 화면 결정으로 옮긴다. **새 조작이 하나도 없다** — 이 Cycle 이
> 화면에 더하는 것은 누를 자리가 아니라 **읽을 자리**다.
>
> 그리고 이 파일에는 산술이 하나도 없다. 단계도 · 남은 양도 · 보태는 몫도 세계가
> 세어서 보내므로, 결정 Layer 가 하는 일은 **어느 값을 어떤 말과 함께 어느 순서로
> 세울 것인가** 뿐이다 (DC-WORLD-OWNS-THE-SURFACE-LIST).

## SPEC CONSUMED

    growth.level / maxLevel / deeds       view/growth-presentation.ts `growthLines`
    growth.nextThreshold / deedsToNext    같은 자리 — **없으면 "더 오를 곳이 없다"**
    growth.contributions                  같은 자리 — 세계가 보낸 차례 그대로 세운다
    growthEvents[]                        view/growth-presentation.ts `growthEventLines`
    growthEvents[].levelBefore/After      같은 자리 — 갈리면 오른 줄로 다르게 쓴다
    hud.self.growth.*                     self 패널이 가져간다 (isSelfHudId 무변경)
    entities[].attributes.combatStats     **형태가 바뀌지 않았다** — 자란 값이 그대로 온다
    strikes[].breakdown.*.fromGrowth      계약에 섰다. 아직 문장으로 쓰지 않는다 (NOTES)

    소비하지 않은 것
        World.DeedCatalog · GrowthThresholds · GrowthLevelSteps
            **표 전체가 오지 않는다** (04 not_projected). 화면이 표를 지니지 않으므로
            문턱을 고치거나 늘려도 이 코드가 열리지 않는다

## ASSET MAPPING

    없음 — 이 Cycle 은 그림을 더하지 않는다. 새 role 도 새 kind 도 없다.
    자란 것은 몸의 생김새를 바꾸지 않는다 (그것은 UL §40 이고 이 Cycle 의 EXCLUDED 다).

## INPUT → ACTION REQUEST

    **없다.** `actions/` 도 `bindings.ts` 도 `key-registry.ts` 도 한 줄 바뀌지 않았다.

    자라게 하는 조작은 이미 있는 것들이다 — 치기(`J` · `K` · `L`) · 캐기 · 살펴보기.
    그 조작의 프롬프트도 사유도 그대로다. **성장을 요청하는 조작이 세계에 없으므로
    화면에도 없다** — 있으면 성장이 세계 안의 일이 아니라 사람이 누르는 일이 된다.

## FILES

    view/growth-presentation.ts (NEW)
        growthLines            자란 것 두 줄 (단계·쌓임·다음 문턱 / 단계 몫)
        growthEventLines       방금 쌓인 일들 — 오른 줄만 전후 단계를 함께 쓴다
        justLeveled            방금 올랐는가 — **사실 하나만 답한다.**
                               이펙트나 연출을 이 파일이 만들지 않는다

        GROWTH 트랙이 자기 결정 파일을 세웠다 (works.md 병렬 규칙) —
        terrain-presentation · allocation-presentation 이 각자 그렇게 선 자리와 같다

    view/code-text.ts (CHANGED)
        `deed.strike` · `deed.down` · `deed.mine` · `deed.observe` 넷.
        **`deed.` 를 앞에 붙였다** — `mine` 이 이미 행동 코드로 이 표에 있고,
        같은 문자열이 두 뜻을 가지면 문구가 어긋난다 (`item.` 이 선 것과 같은 이유).
        자라는 값의 이름 넷은 **이미 이 표에 있어** 다시 적지 않았다

    view/resolve.ts (CHANGED)
        self 패널 줄 목록의 **맨 뒤**에 두 벌을 붙였다. 자란 것은 국면이 아니라
        이력이라 지금의 결정(기술·대상·자리)을 재촉하지 않으므로, 급한 것부터 세우는
        이 목록에서 가장 급하지 않은 자리다.
        **기존 줄이 한 칸도 밀리지 않는다** — 자기 영역 끝에만 더했다
        (works.md 공유 지점 규칙 · LANES 충돌 칸)

    건드리지 않았다
        combat-presentation.ts   `selfPanel` 도 `isSelfHudId` 도 무변경.
                                 `self.growth.*` 는 접두사 규칙에 이미 걸린다
        hud-presentation.ts      가로 띠로 가지 않으므로 등록할 것이 없다
                                 (온기가 그렇게 한 것과 같은 자리)
        effect-presentation.ts   **오름에 이펙트를 붙이지 않았다.** 붙이려면 예산 일곱
                                 중 하나를 빼야 하고, 이 Cycle 이 그 결정을 살 이유가
                                 아직 없다 — 오름은 줄로 읽힌다. `justLeveled` 가
                                 그 문을 열어 두었으니 필요해지면 그때 한 줄이다
        engine/                  기반이다. 편집하지 않았다

## FIXTURE TESTS

    view/tests/growth.spec.ts (NEW · 16)          World 미기동 · Fixture 만으로

    ① 자란 것이 늘 보인다
        `자란 것 1/5 · 쌓인 것 20 · 다음까지 30 (50)`
        `단계 몫 물리 공격 +4 · 오라 공격 +4 · 물리 방어 +3 · 오라 방어 +3`
        **0 도 보인다** — `자란 것 0/5 · 쌓인 것 0 · 다음까지 20 (20)` · 몫 넷이 +0
        **최대 단계** — `자란 것 5/5 · 쌓인 것 240 · 더 오를 곳이 없다`
                        (0 을 지어내지 않는다)

    ② 방금 쌓인 일
        `한 대 +1 (6)`                       오르지 않은 쌓임도 사라지지 않는다
        `쓰러뜨림 +14 (20) → 자란 것 0 ▸ 1`   오른 줄만 전후 단계를 함께 쓴다
        `justLeveled` 셋 (오름 · 빈 목록 · 안 오름)
        **모르는 원천** — `deed.solved-an-event +9 (29)` 로 코드 그대로 선다.
                          세계가 원천을 하나 더 지어도 화면이 멈추지 않는다
        자리 — 자란 것 → 단계 몫 → 쌓인 일들이 이어서 서고, **맨 뒤다**

    ③ 화면이 계산하지 않는다
        앞뒤가 맞지 않는 수를 보내도 **고치지 않는다** (deeds 7 · level 4 · 남은 3)
        보태는 몫의 **차례도 세계가 정한다** — 화면은 정렬하지 않는다
        자란 몸의 능력치 줄은 유효 값 44 를 그대로 쓴다 (40 과 4 를 더하지 않는다)

    계약이 없어도 선다
        `growth` 가 아예 없으면 줄을 만들지 않는다 — 자리를 지어내지 않는다

    fixtures (NEW · 2)
        growth.fixture.json      단계 1/5 · 방금 한 대와 쓰러뜨림 · 그 둘째가 올렸다
        growth-max.fixture.json  단계 5/5 · **문턱 둘이 아예 오지 않는다**

    fixtures (CHANGED · 33)
        전부 `growth`(단계 0) · `growthEvents: []` · 경위의 `fromGrowth: 0` 을 받았다.
        **화면 결정은 한 줄도 바뀌지 않았다** — 계약이 넓어졌을 뿐이다

    전체       1520 passed (84 files) · tsc 0 · boundary 0

## NOTES

    GAMEVIEW CHANGE: ADDED (셋) — growth · growthEvents · breakdown 의 fromGrowth

    경위의 `fromGrowth` 를 아직 문장으로 쓰지 않았다
        계약에는 섰고 값도 온다. 그러나 타격 경위 줄(`inspect` 를 켰을 때)은 이미
        길고, 배분의 몫(`fromAllocation`)과 자란 몫을 나란히 쓰면 한 줄이 두 줄이 된다.
        **화면 몫이므로 works/BACKLOG.md 로 넘긴다** — 세계는 이미 보내고 있으니
        VIEW 레인이 잡을 때 계약을 넓힐 필요가 없다.

    오름을 알리는 연출이 없다
        지금은 줄 하나가 잠깐 서 있다가 세계가 지운다 (STRIKE_EVENT_TTL). 사람이
        그 순간을 놓칠 수 있으며, 그것이 이 Cycle 의 실제 약점이다. 다만 이펙트
        예산이 일곱이라 무엇을 뺄지 함께 정해야 하므로 (F1 규칙 ③), 이 Cycle 에서
        결정하지 않고 `justLeveled` 로 문만 열어 두었다. **BACKLOG 로 넘긴다.**

    자란 것이 맨 뒤인 것이 옳은가
        self 패널의 줄이 이 Cycle 로 두 줄 + 사건 줄만큼 길어졌다. 급한 것부터라는
        기존 순서를 따르면 맨 뒤가 맞지만, 화면이 좁으면 잘려 나가는 자리이기도 하다.
        **사람이 눌러 보고 판단할 것 하나로 08 에 남긴다.**
