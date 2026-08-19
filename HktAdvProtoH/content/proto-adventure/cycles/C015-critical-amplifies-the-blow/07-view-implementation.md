# C015 — View Implementation

> 04 계약이 약속한 것이 여기서 지켜졌다 — **가려짐을 다루는 코드는 한 줄도 고치지 않았다.**
> Critical 두 성질이 C014 의 `combatStats` 안에 들어갔으므로 `concealed` 를 읽는 자리도,
> "모름" 을 그리는 자리도 그대로다. 세계가 가리는 값이 늘었는데 화면이 저절로 따라왔다
> (DC-WORLD-OWNS-THE-SURFACE-LIST).
>
> 실제로 더한 것은 셋이다 — 겨루는 힘 줄 하나, 자기 패널 줄 하나, 타격 경위 줄 하나.

## SPEC CONSUMED

    strikeEvents.breakdown.critical         view/combat-presentation.ts `criticalLine`
        터진 타격에는 **관찰을 켜지 않아도** 한 줄 붙는다 (04 VARIANCE NOTE).
        `치명타 ×2 20→40`
        안 터진 타격은 관찰을 켰을 때만 나온다 — 매번 "안 터짐" 을 띄우면
        정작 터진 순간이 묻힌다. 켜면 가능성까지 나오므로
        `치명타 없음 (25%)` 과 `치명타 없음 (터질 리 없다)` 가 그 자리에서 갈린다

    strikeEvents.breakdown.finalDamage      view/combat-presentation.ts `strikeMark`
        emphasis 가 `heavy-attack || critical.occurred` 가 된다 —
        **크게 터진 한 방을 크게 그린다.** 고급 스킬과 같은 자리를 쓴다:
        둘 다 "이번 것은 평소보다 크다" 이고 새 그리기 능력을 만들 이유가 없다

    entities.character.attributes.combatStats.criticalChance / criticalDamage
                                            view/combat-presentation.ts `contestedLines`
        방어 읽기(물리·오라·관통·약점)가 끝난 **뒤에** 온다.
        앞의 네 줄이 "이 상대를 어떻게 칠까" 라면 이 줄은 "이 상대가 나를 어떻게 치는가" 다

    hud.self.combat.criticalChance / criticalDamage
                                            view/combat-presentation.ts `selfPanel`
        `내 약점` 뒤. 살펴봄과 무관하게 언제나 있다 —
        성질을 바꾸면 이 줄이 곧바로 따라가는 것이 이 Cycle 의 확인 경로다

    commandCatalog                          view/code-text.ts
        `criticalChance` → `치명타 확률` · `criticalDamage` → `치명타 배율`.
        (C013 이 빠뜨린 `armorPenetration` · `resistancePenetration` 문구도 함께 채웠다 —
         같은 목록의 이웃 항목이고, 없으면 명령 화면에 코드가 그대로 나온다)

    entities.character.attributes.versusObserver · defenseShape · concealed ·
    interactions.* · hud.playerAction       **고치지 않았다** (04 delta.reused)

## ASSET MAPPING

    없음 — 새 role 도 새 kind 도 새 모션도 없다 (04 delta · 01 EXCLUDED).
    Critical 은 기존 타격 모션 위에서 읽힌다.

## INPUT → ACTION REQUEST

    없음 — 새 입력이 없다. Critical 은 고르는 조건이 아니라 고른 뒤에 일어나는 일이다
    (04 interactions.change: NONE).
    성질을 바꾸는 경로는 기존 명령 한 줄이며, 계약 모양이 바뀌지 않아
    `view/command-request.ts` 도 고치지 않았다 — 목록이 늘어난 것은 세계 쪽 일이다.
    두 성질은 소수를 받는 첫 항목이지만 명령 화면은 이미 소수를 보낸다
    (`{ id, value: number }`).

## FIXTURE TESTS

    view/tests/fixtures/critical.fixture.json          ← 새 fixture (세계에서 뽑았다)
        관찰자가 가능성 0.5 로 **한 번 휘둘러 둘을 친** 순간.
        npc-1 은 안 터졌고(20) npc-2 는 터졌다(40). 둘 다 살펴본 뒤다.
        **같은 휘두름 · 같은 스킬 · 같은 종류의 상대인데 결과가 갈렸다** —
        화면이 그 둘을 구별하지 못하면 이 Cycle 은 플레이되지 않는다.

    view/tests/fixtures/critical-guard.fixture.json    ← 새 fixture (세계에서 뽑았다)
        자율 존재가 가능성 1 로 관찰자를 치고 관찰자가 막은 순간.
        17 이 34 가 되어 들어왔고 막아서 17 이 남았으며 기력 21 을 치렀다.
        (터지지 않았다면 17→9 에 기력 11 이었을 자리다)
        이 fixture 의 npc-1 은 **살펴보지 않은 상대**라 combatStats 가 비어 있다 —
        "터진 것은 보이지만 얼마나 자주 터뜨리는지는 모른다" 가 그대로 담겼다

    두 fixture 모두 손으로 쓰지 않고 세계를 굴려 뽑은 실제 관찰 결과다.

    view/tests/critical.spec.ts   19 tests — 새 파일
        strikeEvents.breakdown.critical  숫자가 갈린다 · 터졌음이 관찰 없이 읽힌다 ·
                                         커지기 전 값을 세계에서 받아 쓴다 ·
                                         터진 한 방을 크게 그린다 ·
                                         안 터진 한 방은 평소에 조용하다 ·
                                         "터질 리 없는 몸" 과 "운이 없었다" 가 갈린다 ·
                                         치명타 줄이 막기 줄보다 앞이다 ·
                                         막아도 커진 값을 마주했다는 것이 읽힌다
        combatStats                      방어 읽기 뒤에 온다 · 0 은 "터뜨리지 못함" ·
                                         빈도와 크기를 함께 쓴다 ·
                                         살펴보지 않은 상대에겐 아예 오지 않는다
        hud.self                         내 약점 뒤 · 살펴봄과 무관 · 0 인 몸도 쓴다

    갱신한 기존 fixture (계약이 자란 만큼만)
        combat · command · damage-type · guard · guard-broken · observe · penetration
        combatStats 에 두 값 · breakdown 에 critical.
        **치는 이의 성질과 그 타격의 경위가 어긋나지 않게** 맞췄다 —
        가능성 0 인 몸이 친 타격의 경위에 0.25 가 적혀 있으면 그 fixture 는
        세계에서 나올 수 없는 것이 된다

    갱신한 기존 검증
        combat.spec.ts        self 패널 줄 순서 (내 약점 뒤에 치명타가 하나 늘었다)
        damage.spec.ts        경위 문자열에 `치명타 없음 (터질 리 없다)` 가 앞에 붙는다
        damage-type.spec.ts   경위 문자열에 `치명타 없음 (25%)` 가 앞에 붙는다
        guard.spec.ts         치명타 줄이 막기 줄보다 앞에 온다
        penetration.spec.ts   경위 문자열에 `치명타 없음 (25%)` 가 앞에 붙는다

    실측 — `npx vitest run content/proto-adventure/view` → **13 파일 203 tests 통과**
           (C014 시점 187 → 새 19, 갱신 5개 파일)

## NOTES

    ── 왜 치명타 줄이 막기 줄보다 앞인가

    숫자에 일어난 일의 순서 그대로다 — 계산이 값을 내고 · 치명타가 키우고 · 막기가 덜어낸다.
    `치명타 ×2 17→34 · 막음 34→17 · 기력 -21` 을 왼쪽에서 오른쪽으로 읽으면
    그 한 방의 전 생애가 읽힌다. 순서를 뒤집으면 34 가 어디서 왔는지 알 수 없다.

    ── 04 VARIANCE NOTE 의 다섯 금지를 어떻게 지켰는가

        ① 숫자로 역산하지 않는다      `critical.occurred` 만 읽는다. 평소보다 큰지를
                                     비교하는 코드가 없다
        ② 커지기 전 값을 만들지 않는다 `damageBeforeCritical` 을 그대로 쓴다.
                                     `finalDamage / multiplier` 는 반올림 때문에 어긋난다
        ③ 다음을 예상하지 않는다      세계가 그 정보를 주지 않으므로 만들 수도 없다.
                                     `chance` 는 기대이지 예고가 아니며 그대로 쓴다
        ④ 보정을 표시하지 않는다      세계에 그런 규칙이 없다. 지난 타격을 세는 상태가 없다
        ⑤ 모르는 상대를 짐작하지 않는다 `combatStats` 가 없으면 치명타 줄이 아예 만들어지지
                                     않는다. `contestedLines` 의 기존 분기가 그대로 막는다

    ── 표현 결정 두 가지

    `치명타 터뜨리지 못함` — 가능성 0 을 `0%` 로 쓰지 않았다. 옆에 배율이 있어서
    `치명타 0% · ×2` 로 쓰면 읽는 이가 그 ×2 를 기대값으로 삼는다.

    `치명타 없음 (터질 리 없다)` — 관찰을 켰을 때 가능성 0 인 타격에 나온다.
    `(0%)` 로 쓸 수도 있었지만, 이 자리가 답해야 하는 질문은 숫자가 아니라
    **"운이 없었나, 애초에 안 되는 몸인가"** 이므로 그 답을 그대로 쓴다.

    두 문구 모두 View 의 결정이다 — 세계가 보낸 것은 `chance` 하나다.

    ── 발견한 것 (이 Cycle 밖 — 이후 닫혔다)

    이 Stage 시점에 `npm test` 가 `tools/master-graph/tests/graph.spec.ts` 하나를
    실패시켰다 — `master/graph/GRAPH.md` 가 `graph/*.yaml` 과 어긋나 있었다.
    **이 Cycle 이 만든 것이 아니었다** — 작업 시작 전 상태에서도 같은 실패가 재현되었고,
    Cycle Agent 는 `master/` 를 편집하지 않는다 (CLAUDE.md).
    Stage 8 의 MASTER FEEDBACK 으로 보고했고, main 의 Master Feedback 작업이
    재생성물을 갱신하면서 닫혔다.

    GAP 없음. `engine/` 을 편집하지 않았다. `world/` 를 import 하지 않았다.
