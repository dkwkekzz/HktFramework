# C012 — View Implementation

## SPEC CONSUMED

    entities.character.attributes.combatStats     view/presentation/combat-presentation.ts
                                                  네 값이 물리 한 줄 · 오라 한 줄로 갈린다
    entities.character.attributes.defenseShape    view/presentation/combat-presentation.ts
                                                  세계가 보낸 코드를 사람 말로 옮기기만 한다
    interactions.skillAura                        view/presentation/interaction-presentation.ts
                                                  role 'skill-aura' → KeyR
    interactions[*].profile.damageType            view/presentation/code-text.ts (표시 문구)
    strikeEvents.breakdown.damageType             view/presentation/combat-presentation.ts
    strikeEvents.breakdown.offenseStat            같은 곳 — 이름과 값이 함께 나온다
    strikeEvents.breakdown.defenseStat            같은 곳
    hud.self.combatStats                          view/presentation/combat-presentation.ts
    commandCatalog                                **소비 코드를 고치지 않았다** — 아래 NOTES

## ASSET MAPPING

    없음. 오라 스킬은 새 모션 자산을 쓰지 않는다 —
    `aura-strike` 의 행동 표현은 기존 휘두름 모션 해석을 그대로 탄다
    (heavy-attack 이 이미 같은 자리에 있다).

## INPUT → ACTION REQUEST

    KeyR → { interactionId: 'skill-aura' }

    조립 루트를 고치지 않았다. 키 바인딩은 role 표에 한 줄이 늘어난 것이고,
    요청 발신은 세계가 실어 보낸 interaction 목록을 그대로 타고 나간다
    (DC-WORLD-OWNS-THE-SURFACE-LIST).

    키 자리 — 기본 스킬(F) 옆의 R 로 두었다. 둘은 세기가 아니라 **방식**으로 갈리는
    선택이므로 나란히 놓여야 "고르는 일" 로 읽힌다. 고급 스킬(G)은 세기의 축이라
    사이에 두지 않았다.

## 표시 결정 (결정 Layer)

    ── 능력 줄을 둘로 나눈 것 ────────────────────────────────────────
    C010 은 `공격력 40 · 방어력 50 (받는 피해 67%)` 한 줄이었다.
    C012 는 두 줄이다.

        물리 공격 40 · 물리 방어 50 (받는 피해 67%)
        오라 공격 40 · 오라 방어 20 (받는 피해 83%)
        내 약점 오라에 약하다

    네 값을 한 줄에 몰면 견주는 축이 흐려진다. 플레이어가 견주는 것은
    공격/방어가 아니라 **물리/오라**이므로 그 축으로 줄을 나눴다.

    ── 약점을 "무른 쪽" 으로 말하는 것 ───────────────────────────────
    세계는 어느 쪽이 **단단한지**를 보낸다 (`aura-tougher`).
    화면은 어느 쪽이 **무른지**로 옮긴다 (`물리에 약하다`).
    플레이어가 고르는 것은 칠 방향이지 피할 방향이 아니기 때문이다.
    판정 자체는 세계의 값 그대로이고 뒤집지 않았다 — 말만 바꿨다.

    ── 경위 줄에 이름을 넣은 것 ──────────────────────────────────────
        C010   6+20=26 ×67%(방어 50) = 17
        C012   물리 · 6+20=26 (물리 공격 40) ×67%(물리 방어 50) = 17

    04 DEFENSE STAT NOTE 가 요구한 것이다. 방어가 둘이 된 뒤로 `방어 50` 만으로는
    무엇을 읽었는지 알 수 없다 — 50 이 물리인지 오라인지가 결과를 완전히 가른다.

    ── 막기 표시를 한 글자도 고치지 않은 것 ──────────────────────────
    04 가 "막기 표시는 방식과 무관하게 지금과 똑같아야 한다" 고 못박았다.
    막힌 타격 줄(`막음 17→9 · 기력 -11`)은 그대로이고, 그 **뒤에 붙는 경위**에만
    방식이 나타난다. 다르게 보이면 있지도 않은 규칙을 보는 이가 배운다.

## FIXTURE TESTS

    view/tests/fixtures/damage-type.fixture.json  (신규)
        오라 스킬로 wanderer 를 한 번 친 순간. 세계에서 실제로 뽑아 굳혔다

    view/tests/damage-type.spec.ts (신규 12 tests, World 미기동)
        맞은 자리 "-14"
        경위 "오라 · 6+20=26 (오라 공격 40) ×53%(오라 방어 90) = 14"
        막기 줄 없음 — 막지 않은 타격의 표시가 C010·C011 과 같다
        상대 속성 펼침 두 줄 · "약점 물리에 약하다"
        자기 패널 두 줄 · "내 약점 오라에 약하다"
        오라 스킬이 목록에 있고 사유가 기존 스킬과 같다 (셋 다 action-busy)
        키 F / R · 프롬프트
        profile.damageType 3종 · 오라 rawDamage 26
        변경 가능 속성 목록이 네 능력으로 바뀐 것이 그대로 실린다

    마이그레이션한 기존 fixture · 테스트
        fixtures 11종     combatStats 네 값 · defenseShape · breakdown · profile.damageType
        combat.spec.ts    self 패널 줄 번호가 둘 밀린다
        damage.spec.ts    능력 줄 두 개 · 경위 문구
        guard.spec.ts     막기 줄은 그대로, 뒤 경위에만 방식이 붙는다

    view 전체 통과 · 저장소 전체 498 tests 통과 (기존 486 + 신규 12)
    npx tsc --noEmit 오류 없음 · npx vite build 성공

## NOTES

    ── commandCatalog 소비 코드를 한 줄도 고치지 않았다 ──────────────
    세계의 변경 가능 속성이 `attack · defense` 에서 네 이름으로 **교체**되었는데
    View 는 손대지 않았고 화면의 명령 목록이 그대로 따라 바뀌었다.
    C009 가 세운 구조(목록을 세계가 싣고 View 는 읽는다)가 항목 추가만이 아니라
    **삭제와 분할**에서도 성립한다는 뜻이다 —
    DC-WORLD-OWNS-THE-SURFACE-LIST 의 세 번째 증거다
    (C010 은 명령 목록 추가에서, C011 은 interaction 추가에서 같은 것을 보였다).

    ── 04 계약 외의 World 정보를 쓰지 않았다 ─────────────────────────
    view/ 는 world/ 를 import 하지 않는다. defenseShape 를 View 가 계산하지 않고
    세계가 보낸 코드를 받아 문구로만 옮긴 것이 이 Cycle 의 핵심 경계다.

    ── GAP ───────────────────────────────────────────────────────────
    없음. 04-gameview.spec.yaml 의 added / changed 가 모두 소비되었다.
