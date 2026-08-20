# C018 — View Implementation

> View 가 더한 것은 결정 셋이다 — 몸 위에 붙는 관계 표시 하나, 펼쳐야 보이는 두 방향 한 줄,
> 맞은 자리에 뜨는 무산 문구 하나. **새 그리기 능력을 만들지 않았다** — 무산은 타격 숫자와
> 같은 자리(SceneStrike)를 쓰고 다른 것은 문구뿐이다. 기반(engine)을 한 줄도 건드리지 않았다.

## SPEC CONSUMED

    04-gameview.spec.yaml — VIEW-STANCE-DECIDES-WHO-CAN-BE-STRUCK-001

        entities.character.attributes.stanceTowardObserver   ✔ 몸 위 표시 · inspect 한 줄
        entities.character.attributes.stanceFromObserver     ✔ 몸 위 표시 · inspect 한 줄
        unharmedContacts (attackerId · targetId · skill · at · since · reason)
                                                             ✔ 맞은 자리의 한 줄
        strikeEvents · interactions · hud · commandCatalog    ✔ 무변경 — 읽는 코드도 그대로

    03-world-semantic.md 도 world/ 도 읽지 않았다. 이 화면은 계약 하나로 선다.

## 결정 셋과 그 근거

    ① 몸 위에는 **관계 하나**만 붙인다 — `[적대] 이름`
       세계는 두 방향을 보내지만 몸 위에 두 값을 늘어놓지 않는다. 플레이어가 그 자리에서
       고르는 것은 "다가갈까 물러날까" 이고, 그 답을 정하는 것은 방향이 아니라
       **둘 사이가 적대인가**다 — 세계의 관문(RULE-HARM-GATE-001)이 읽는 값과 같다.
       중립에는 아무것도 붙이지 않는다: 중립이 이 세계의 바탕이므로 표시하면 화면이
       온통 표시로 찬다. **표시가 없다는 것이 곧 "이 사이에는 아무 일도 성립하지 않는다"** 다.
       이름 **앞**에 둔다 — 무엇인지보다 어떤 사이인지가 먼저 읽혀야 한다.

    ② 두 방향은 **펼쳐야** 보인다 — `관계 적대→나 · 나→중립`
       속성 관찰(inspect)의 한 줄로 간다. 방향의 차이는 판단이 아니라 이해의 문제이고,
       늘 띄우면 몸 위가 채워진다. 중립인 존재에도 이 줄이 나온다 — 자리를 비우면
       플레이어는 세계에 그 값이 없다고 배운다 (C014 가 세운 EMPTY-SLOT 규율 그대로).

    ③ 무산은 **타격과 같은 자리에 다른 문구**로 뜬다
       빗나간 휘두름은 아무것도 오지 않고, 무산은 맞은 자리에 `적대가 아니다` 가 뜬다.
       크게 그리지 않는다(emphasis 거짓) — 일어나지 않은 일이다. 경위도 붙지 않는다 —
       산정 자체가 없다.
       **새 capability 를 만들지 않았다**: 둘 다 "그 자리에서 잠시 떠오르는 한 줄" 이고,
       다른 것은 문구뿐이다 (Guide — 표현이 고도화될 때만 capability 를 더한다).

## ASSET MAPPING

    새 sprite 도 새 role 도 없다. 적대인 존재와 중립인 존재는 **같은 그림**으로 그려지고
    표지만 다르다 — 종류가 태도를 정하지 않기 때문이다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
    tint 는 건드리지 않았다: 그 자리는 C004(자리 비움)와 C017(지목)이 이미 쓰고 있고,
    태도까지 색으로 겹치면 세 뜻이 한 자리를 다툰다.

    view/code-text.ts 에 문구 넷 추가
        hostile → 적대 · neutral → 중립 · friendly → 우호 · not-hostile → 적대가 아니다

## INPUT → ACTION REQUEST

    없음. 이 Cycle 은 새 요청을 만들지 않는다 — 태도는 플레이어가 거는 것이 아니라
    **서 있는 자리가 정하는 것**이다. 관계를 바꾸는 조작은 걷기뿐이며(이미 있는 move),
    그것이 이 Cycle 의 플레이다.

## FIXTURE TESTS

    view/tests/fixtures/relation.fixture.json      ADDED
        적대이면서 아직 아무것도 알지 못하는 존재(npc-1) · 중립인 존재(npc-2) ·
        무산 하나(player-1 → npc-2, not-hostile). 두 존재의 종류는 같다.

    view/tests/relation.spec.ts                    13 tests · ADDED
        VIEW REQUIREMENT 1  적대에 표시가 붙는다 · 중립에는 안 붙는다 · 내 몸에도 안 붙는다 ·
                            표시가 이름 앞에 온다 · C014 의 `?` 와 함께 설 수 있다
        VIEW REQUIREMENT 3  무산이 맞은 자리에 사유와 함께 뜬다 · 크게 그리지 않는다 ·
                            성립한 타격과 섞이지 않는다 · 경위가 붙지 않는다
        두 방향             펼치면 따로 읽힌다 · 중립인 존재도 줄이 비지 않는다
        VIEW REQUIREMENT 4  사유 코드가 그대로 화면에 나오지 않는다
        짐작 금지           같은 종류의 둘이 서로 다른 표시를 얻는다 (그림은 같다)

    전체 46 files · 794 tests 통과 (`npm test`)

    기존 Fixture 17종에 `contacts: []` 와 태도 두 값이 더해졌다 — 계약이 늘었으므로
    Fixture 도 그 계약의 형태를 지녀야 한다. 기존 검증의 기대값은 하나도 바뀌지 않았다.

## NOTES

    ① VIEW REQUIREMENT 2("매 관찰마다 갱신된다")는 코드를 더해서가 아니라
       **아무것도 기억하지 않음으로써** 지켜진다. 결정 Layer 는 Snapshot 하나로
       Render Plan 을 만들고 이전 값을 들고 있지 않다. 세계가 태도를 저장하지 않는 것과
       같은 성질이 화면에서도 성립한다 — 원한은 세계에도 화면에도 없다.

    ② 관계 표시와 `?` 표시가 한 이름에 함께 설 수 있다는 것이 이 Cycle 의 그림이다:
       `[적대] Wanderer 1 ?` — **저것이 나를 사냥감으로 보는 것은 알지만 얼마나 센지는
       모른다.** 물러날 판단은 앞의 것으로 하고, 싸울 판단은 뒤의 것을 알아야 한다.

    ③ 몸 위에 관계를 하나로 합친 결정은 되돌릴 수 있다 — 두 방향이 실제로 갈리는 배치
       (사람이 지킬 것을 갖는 Cycle)가 서면 그때 몸 위 표시를 나눌 근거가 생긴다.
       지금 나누면 화면이 답하지 않는 물음에 자리를 내주는 것이다.
