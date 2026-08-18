# C013 — View Implementation

> 새 표면을 열지 않았다. 새 role 도 새 interaction 도 새 그림도 없다.
> 이미 있는 세 자리 — 속성 관찰 · 타격 경위 · 자기 패널 — 에 실리는 내용만 넓어진다.
> 그중 하나는 **관계**다. 상대의 방어 뒤에 "그런데 나에게는 얼마로 읽히는가" 가 붙는다.

## SPEC CONSUMED

    04-gameview.spec.yaml (VIEW-PENETRATION-DEVALUES-THE-WALL-001) 만을 입력으로 삼았다.
    `world/` 를 읽지 않았고 import 하지 않는다.

    entities.character.attributes.combatStats (여섯 값)
        → view/presentation/combat-presentation.ts `inspectLines()`
          `관통 물리 60 · 오라 0` 한 줄. 상대의 관통도 쓴다 —
          저쪽이 내 방어를 얼마나 무력화하는지는 내가 얼마나 위험한지를 아는 일이다

    entities.character.attributes.versusObserver
        → `inspectLines()` 의 두 방어 줄 끝에 붙는다
          `오라 공격 15 · 오라 방어 90 (받는 피해 53%) → 나에게 56.25 (64%)`
          원래 값과 같으면 아무 말도 붙지 않는다 (`versusText()` 가 빈 문자열).
          같다는 것은 화살표가 **없는 것**으로 읽힌다 — 통하지 않았다는 뜻이다.
          **곱셈을 하지 않는다.** 세계가 보낸 값을 그대로 쓴다
          (04 versusObserver.meaning · DC-WORLD-OWNS-THE-SURFACE-LIST)

    strikeEvents.breakdown.penetrationStat · effectiveDefense
        → `breakdownLine()` 안의 새 조각 `defenseText()`
          `×64%(오라 방어 90 · 관통 60 → 56.25)`
          관통이 0 이어도 세 값을 모두 쓴다 — `물리 방어 30 · 관통 0 → 30`

    hud.self.combatStats (관통 둘)
        → `selfPanel()` 의 세 번째 줄 `관통 물리 60 · 오라 0`
          0 인 쪽도 쓴다 (04 hud.self.combatStats.meaning)

    entities.character.attributes.defenseShape
        → 그대로다. 걷힌 값으로 판정을 다시 만들지 않는다 (04 defenseShape.meaning)

    interactions
        → `change: NONE`. interaction-presentation 을 손대지 않았다

    commandCatalog
        → 손대지 않았다. 세계가 실어 보내는 목록을 그대로 그리므로
          set-attribute 의 속성 목록에 관통 둘이 코드 수정 없이 나타난다
          (04 COMMAND NOTE 가 예고한 검사 — 실제로 View 수정이 필요 없었다)

## ASSET MAPPING

    없음. 새 role 도 새 kind 도 새 모션도 없다 (01 EXCLUDED).
    `presentation/role-presentation.ts` · `kind-presentation.ts` · `motions/` 무변경.

## INPUT → ACTION REQUEST

    없음 — 새 조작이 없다.
    관통을 바꾸는 것은 기존 set-attribute 명령이며, 그 입력 경로는 C009 가 만든
    명령 입력이 세계의 목록을 그대로 읽어 처리한다. View 코드 변경 없음.

## FIXTURE TESTS

    view/tests/penetration.spec.ts  11 tests (신설)
        strikeEvents.breakdown       관통이 작용한 타격 -17 (관통 없었다면 14) ·
                                     세 값이 한 줄에 (90 · 관통 60 → 56.25) ·
                                     관통 0 fixture 에서도 `관통 0 → 90` 이 나온다 ·
                                     rawDamage 가 그대로다 (관통이 공격 기여로 보이지 않는다)
        versusObserver               상대 방어 뒤에 나에게 읽히는 값이 붙는다 ·
                                     관통 없는 쪽에는 붙지 않는다 ·
                                     그 존재의 관통 줄 · 약점 판정이 흔들리지 않는다 ·
                                     **versusObserver 를 원래 값으로 되돌리면 표시도 사라진다**
                                     (View 가 곱해 만들고 있었다면 이 검사가 실패한다)
        hud.self                     관통 두 값이 능력치 두 줄 뒤에 온다 · 0 인 쪽도 쓴다

    view/tests/fixtures/penetration.fixture.json (신설)
        세계에서 받아 적은 한 순간이다 — 관찰자(오라 관통 60 은 종류가 정한 값이다)가
        오라 스킬로 wanderer(Resistance 90)를 친 결과. 손으로 지어낸 수가 아니다.

    기존 fixture 6종 갱신
        combat · command · damage-type · guard · guard-broken 의 attributes 에
        combatStats 관통 둘(0)과 versusObserver(원래 값과 같음)를, strikes 의 breakdown 에
        penetrationStat(0) · effectiveDefense(= defenseStat.value)를 더했다.
        **관통을 0 으로 둔 것은 의도적이다** — 이 fixture 들이 담고 있는 피해 숫자는
        관통이 없던 조합의 값이며, 관통만 채워 넣으면 fixture 안에서 계산이 어긋난다.
        덕분에 이 6종이 그대로 "관통 0 표시" 의 회귀 검사가 되었다.

    기존 표시 단언 갱신 (형식이 바뀐 자리)
        view/tests/combat.spec.ts · damage.spec.ts · damage-type.spec.ts · guard.spec.ts
        self 패널 줄 번호가 하나씩 밀리고, 경위 줄의 방어 자리가 세 값이 되었다.

    view 전체    16 files · 233 tests 통과 (World 미기동)
    전체          34 files · 534 tests 통과
    npm run build tsc --noEmit + vite build 통과

## NOTES

    ① 왜 `→ 나에게` 를 조건부로 붙이는가
       내 관통이 0 이거나 상대 방어가 0 이면 두 값이 같다. 그때도 `→ 나에게 30` 을 쓰면
       모든 존재의 모든 줄에 같은 수가 두 번 나와 정작 걷힌 경우가 묻힌다.
       화살표의 **유무**가 "이 상대에게 내 관통이 통하는가" 의 표시다.
       타격 경위(breakdownLine)는 반대로 늘 세 값을 쓴다 — 그쪽은 한 번의 사건에 대한
       기록이고, 계약이 "관통 0 에서도 읽혀야 한다" 를 명시했다 (04 strikeEvents.meaning).

    ② 검산의 기준이 바뀌었다
       C012 까지 `defenseMultiplier` 는 `defenseStat.value` 로 검산할 수 있었다.
       이제 아니다 — 걷힌 뒤 값(effectiveDefense)이 그 근거다. 표시 문자열이
       `방어 90 · 관통 60 → 56.25` 다음에 `×64%` 를 두는 순서인 것은 그 때문이다.
       읽는 이가 64% 를 90 이 아니라 56.25 와 짝지어 읽게 된다.

    ③ 소수점
       걷힌 방어는 56.25 처럼 정수가 아니다. 기존 `round()` (정수면 그대로, 아니면
       소수 둘째 자리)를 그대로 썼다 — 자릿수 정리는 View 의 일이라는 판단은 C010 부터
       같고, 세계가 보낸 값과 다른 수를 보이지 않는다.

    ④ capability 코드를 건드리지 않았다
       renderer · hud · input 은 한 줄도 바뀌지 않았다. 바뀐 것은 결정 Layer
       (`presentation/combat-presentation.ts`) 하나다.

    GAMEVIEW GAP 없음.
