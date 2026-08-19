# C016 — View Implementation

> 계약의 모양이 하나도 바뀌지 않았으므로 새 표현도, 새 키도, 새 화면도 없다.
> 바꾼 것은 하나다 — **겨루는 힘의 자리를 통짜에서 자리별로 풀었다.**
> C014 판은 수치와 관계가 둘 다 있어야 값을 그렸고, 그 코드가 그대로 남았다면
> 통찰 60 인 화면이 아는 것까지 전부 가려 버렸을 것이다.

## SPEC CONSUMED

    entities.character.attributes.insight        view/combat-presentation.ts (inspectLines)
        겨루는 힘 바로 위에 `통찰 N` 한 줄. 아래 줄들이 왜 그만큼만 열려 있는지를
        이 줄이 설명한다. 가려지지 않는 값이므로 조건 없이 그린다
    entities.character.attributes.concealed      view/combat-presentation.ts (contestedLines)
        부분 목록을 그대로 이름으로 옮긴다. 열린 줄들 **아래**에 온다 —
        "이만큼 알고, 이건 아직 모른다" 의 순서다
    entities.character.attributes.combatStats    자리별 조건 (수치 네 줄 + 관통 + 치명타)
    entities.character.attributes.versusObserver 자리별 조건 — 수치가 있으면 꼬리로 붙고,
                                                 수치가 없으면 **자기 두 줄**로 선다
    entities.character.attributes.defenseShape   자리별 조건 (약점 한 줄)
    entities.character.attributes.acquainted     몸 위 이름의 물음표 (뜻이 넓어진 그대로)
    interactions.observe                         가용성·사유 그대로 (C014 재사용)
    hud.self.insight                             view/combat-presentation.ts (selfPanel)
        `통찰 N` 한 줄. 자기 겨루는 힘 줄들 뒤, 템포 뒤에 온다

## ASSET MAPPING

    없음 — 새 role 도 새 종류도 새 상태도 없다. 그림은 한 장도 늘지 않았다.

## INPUT → ACTION REQUEST

    없음 — 새 조작이 없다. 통찰을 바꾸는 것은 C009 가 세운 명령 한 줄이고
    (`set-attribute insight <값>`), 그 경로는 세계가 싣는 목록에서 그대로 발견된다
    (view/command-request.ts 무변경 — 속성 이름은 세계가 나른다).

## FIXTURE TESTS

    view/tests/fixtures/insight.fixture.json     신설
        관찰자의 통찰이 60 인 순간. npc-1 은 살펴본 존재(전부 열림),
        npc-2 는 살펴본 적 없는 존재(형태와 관계만 열리고 수치는 가려짐).
        C014 의 observe fixture 에서 파생했다 — 값은 전부 그대로다

    view/tests/insight.spec.ts                   12 tests — 신설
        attributes.insight
            내 통찰이 내 자리에 있다 (`통찰 60`)
            수치가 가려진 존재에도 통찰 줄이 나온다 — 가려지지 않는다
        SEAT NOTE
            수치만 가려진 존재에서 **열린 자리와 가려진 자리가 함께** 보인다
            (약점·나에게 읽히는 방어가 있고, 겨루는 힘은 이름으로 남고,
             오라 공격·치명타 같은 오지 않은 수치는 만들어내지 않는다)
            전부 아는 존재는 C015 까지의 화면 그대로다
            형태만 열린 존재도 그려진다 (관계값을 지운 판)
            세 자리가 다 가려진 존재는 C014 의 화면과 같다
            수치만 오고 관계가 없는 판도 그려진다 — 화살표(`→ 나에게`)가 붙지 않는다
        목록의 출처
            세계가 아직 없는 이름(`somethingNew`)을 보내와도 화면이 그대로 나른다 —
            View 가 목록을 자기 코드에 적지 않는다는 증거다
        몸 위 표시
            일부만 아는 존재에도 물음표가 남고, 전부 아는 존재와 내 몸은 이름 그대로다
        interactions.observe
            일부만 열린 존재에는 살펴봄이 가용하다
            더 열 자리가 없는 존재에는 사유가 `이미 알고 있다` 로 나온다

    실행 결과
        view 14 파일 215 tests 통과 (`npx vitest run content/proto-adventure/view`)
        전체 43 파일 717 tests 통과 (`npm test`) · `tsc --noEmit` 오류 0

## NOTES

    ① 한 줄 조건이 아니라 자리별 조건인 이유
       C014 판 `contestedLines` 는 `if (!combat || !versus) → 가려짐 한 줄` 이었다.
       통찰 60 인 관찰자에게 versus 는 오고 combat 은 안 오므로, 그 코드는
       **열려 있는 관계값까지 함께 숨겼다.** 지금은 자리마다 `if (combat)` `if (versus)`
       `if (defenseShape)` 를 묻고 각자 자기 줄을 낸다. 조합의 가짓수를 세지 않으므로
       세계가 문턱을 바꾸거나 자리를 늘려도 이 코드는 그대로다 (04 SEAT NOTE).

    ② 관계값만 온 자리의 문구
       수치가 없으면 "물리 방어 30 → 나에게 30" 처럼 쓸 수 없다 — 원래 값을 모르기
       때문이다. 그래서 그때는 `나에게 읽히는 물리 방어 30 (받는 피해 77%)` 로 선다.
       원래 값을 되짚어 계산하지 않는다. 플레이어가 자기 관통을 알고 머리로 되짚는
       것은 자유이고, 화면이 대신 해 주지는 않는다 (03 NOTE ② · 04 EMPTY-SLOT NOTE).

    ③ 물음표를 그대로 둔 판단
       세계가 보내는 `acquainted` 의 뜻이 "가려진 자리가 없다" 로 넓어졌으므로,
       통찰로 절반 아는 존재에도 물음표가 남는다. "절반은 안다" 를 나타내는 새 표시를
       만들지 않았다 — 무엇을 아는지는 관찰을 켜면 줄로 읽히고, 몸 위의 물음표는
       "아직 모르는 것이 있다" 하나만 말한다. 두 번째 표시를 만들면 View 가 세계의
       상태를 자기 기준으로 다시 나누게 된다.

    ④ 줄 번호를 세던 기존 검증 하나
       `view/tests/penetration.spec.ts` 가 inspect 줄을 번호로 짚고 있었고,
       통찰 줄이 위에 생기면서 넷이 한 칸씩 밀렸다. 줄의 내용과 순서는 그대로이며
       번호만 고쳤다 (그 파일에 사유를 주석으로 남겼다).

    ⑤ fixture 아홉 개에 통찰 0 이 더해졌다
       계약에 필수 항목이 하나 늘었으므로 기존 fixture 전부가 그 값을 지닌다.
       전부 0 이라 어떤 검증의 기대값도 달라지지 않았다 — 기본값 0 이 지키는 것이
       여기서도 그대로다 (06 NOTES ④).

    ⑥ GAP 없음
       04 가 정한 모든 항목이 화면에 있고, 계약에 없는 의미를 만들지 않았다.
       `world/` 를 import 하지 않았고 `engine/` 은 한 줄도 열지 않았다.
