# C-COMBAT-004 — View Implementation

## SPEC CONSUMED

    entities[].attributes.marks            view/mark-presentation.ts (새 파일 · 표 둘)
                                           → view/combat-presentation.ts 의 이름줄과 펼침
    interactions.skillMark                 view/interaction-presentation.ts 한 줄 (키 `P`)
    interactions[].profile.requires        view/skill-presentation.ts — **자리가 그대로다.**
                                           답이 "지금 고른 상대에 대해" 로 넓어졌을 뿐이다
    interactions.skillHatsu.profile.conditions
                                           같은 자리 — 항목이 둘 → 셋
    interactions[].reason                  기존 자리 — 상대 쪽 사유가 실릴 수 있다
    strikes[].breakdown.conditions         C-COMBAT-003 이 연 자리 — **화면 코드 무변경**
    hud                                    `change: NONE`

## ASSET MAPPING

    mark-strike → 모션 없음                기존 넷과 같다 — 휘두름 모션으로 폴백한다
                                           (`npm run motions:check` 통과)
    mark-strike → 전격 (작고 낮게)          view/effect-presentation.ts 한 줄.
                                           **세기가 없다** — 바닥과 천장을 같은 값(0.55)으로
                                           두어 언제나 같은 크기로 찍힌다. 잴 피해가 없는
                                           사건에서 나올 세기가 없다는 것이 이 표의 정직한
                                           답이다 (F1 규칙 2 를 그 사건에 적용한 결과).
                                           **새 게놈을 만들지 않았다** — 예산 7 그대로
    ◈ (표식 표기)                          몸 위 한 글자. 태도 `[적대]` · 선딜 `준비!` ·
                                           배분 표기가 선 자리에 넷째로 붙는다

## INPUT → ACTION REQUEST

    P           → `{ interactionId: 'skill-mark' }`

    **남은 마지막 글자다.** 기반이 W·A·S·D·화살표·Z·X·R·T·C·V·`/` 를, 팩이
    E·F·G·H·Q·Y·B·N·M·I·U·J·K·L·O·Shift 를 쓴다. 기술이 하나 더 늘면 부를 자리가 없다 —
    `works/BACKLOG.md` 의 `skill-slot-crowds-the-keyboard` 가 그 자리를 기다린다.
    막힘은 아니다 (띠는 눌러서도 부른다 — C025). 08 MASTER FEEDBACK 에 다시 적는다.

## FIXTURE TESTS

    view/tests/mark.spec.ts                17 검사 — World 미기동, Fixture 만으로
        붙지 않은 몸에는 표기가 없다 (없다는 것이 곧 관찰이다) · 붙은 몸에는 `◈`
        살펴보지 않은 몸에도 뜬다 — 겨루는 힘은 여전히 가려져 있다
        몸 위에 남긴 자의 이름은 붙지 않는다 · 펼침에서 그것을 읽는다
        붙은 것이 없으면 "표식 없음" — 줄이 사라지지 않는다
        **언제까지인지는 화면 어디에도 없다**
        띠에 다섯째 칸 · 키 `P`
        `공격 피해 0` 이 아니라 `피해 없음` · 값이 있는 기술의 줄은 무변경
        요구가 지금 고른 상대를 본 답이다 (아직 안 걸었다 ✓ / 이미 걸었다 ✗ + 사유)
        **아무도 고르지 않았으면 "먼저 대상을 고르자"** — 아래 NOTES ②
        발현 일격의 조건 셋째로 표식 · 그 한 방이 80 · 경위가 표식을 지목한다

    fixtures/mark-none.fixture.json        고르긴 했으나 아직 남기지 않은 세계
    fixtures/mark-borne.fixture.json       남기고 그 뒤 크게 들어간 세계
    fixtures/mark-unchosen.fixture.json    아무도 고르지 않은 세계
                                           (셋 다 실제 세계를 굴려 받아 적었다)

    전체                                   1619 검사 통과 · tsc · boundary:check ·
                                           catalog:check · motions:check 통과

## 눈으로 본 것

    shots/mark-not-yet-and-what-it-opens.png   실제 브라우저 (headless chromium · vite)

    화면에 선 것
        기술 띠 다섯 칸 — `F 기본 · G 고급 · H 오라 · P 표식 남기기 · O 발현 일격`
        `P` 칸이 회색이고 `불가 · 대상 없음`
        패널 —
            표식 남기기 ✗ 먼저 대상을 고르자 · 기력 -10 / +0 · 피해 없음
                       · 요구 ✗그 상대에게 내 표식 없음
            발현 일격 ✗ … · 조건 ✗그 상대에게 방금 맞음 +0.4
                       · ✗생명이 절반 아래 +0.4 · ✗그 상대에게 내 표식 +0.5
        펼침(속성 관찰) — 존재마다 `표식 없음`

    **피해가 없는 기술이 "약한 공격" 이 아니라 다른 일을 하는 것으로 읽히고,
    무엇을 하면 열리는지가 함께 읽힌다.**

## NOTES

### ① 화면이 이 기술을 아는 자리는 표 세 줄이다

`skill-presentation.ts` 는 여전히 기술 이름을 하나도 모른다 — 다섯째 칸이 저절로 섰다.
이 Cycle 이 그 파일에 더한 것은 **피해 0 을 다른 말로 옮기는 함수 하나**(`damageText`)뿐이다.

새 기술 자체를 아는 자리는 표 셋의 각 한 줄이다: 부를 키 · 사람이 읽는 말 · 터지는 모양.
표식을 그리는 결정은 새 파일 하나(`mark-presentation.ts`)에 모았고, 그 파일도 표 둘이다.

### ② 브라우저가 잡은 것 — 세계가 참이 아닌 말을 하고 있었다

아무도 고르지 않은 채 `P` 를 누르면 화면이 이렇게 말했다.

    표식 남기기 ✗ 이미 표식을 남겨 두었다 — 먼저 쓰거나 지워지기를 기다려라

**아무것도 안 걸었는데.** 관문이 `other === null` 을 그냥 "그 사정이 거짓" 으로 다루었고,
그래서 그 사정의 사유가 그대로 나갔다.

`DC-COMBAT-UNAVAILABLE-HAS-A-REASON` 이 요구하는 것은 사유가 **있는** 것이 아니라
**읽을 수 있는** 것이다. 참이 아닌 사유는 회색으로 칠하고 끝내는 것보다 나쁘다 —
플레이어를 틀린 방향으로 보낸다.

고쳤다. 사정이 **자기가 상대를 읽는지**를 밝히고(`readsOther`), 관문은 고른 상대가 없을 때
그 사정의 사유 대신 `no-target-selected` 를 낸다 (C017 이 이미 세운 코드를 그대로 쓴다 —
새 말을 만들지 않았다). 시험 둘을 세웠고, 브라우저에서 다시 확인했다.

    표식 남기기 ✗ 먼저 대상을 고르자 · 기력 -10 / +0 · 피해 없음
               · 요구 ✗그 상대에게 내 표식 없음

**요구의 이름은 흔들리지 않는다** — 무엇을 지는 기술인지는 사정이 참이든 아니든 같다.
흔들리는 것은 지금 왜 못 쓰는가뿐이다.

### ③ `공격 피해 0` 을 쓰지 않는다

세계가 보낸 0 을 그대로 쓰면 "아주 약한 공격" 으로 읽힌다. 세계가 말하는 것은 그것이
아니라 **이 기술은 피해를 내지 않는다** 다.

지어내는 것이 아니다 — 0 을 다른 말로 옮길 뿐이며, 옮기는 말을 정하는 것이 결정 Layer 의
일이다. 값이 있으면 지금까지와 한 글자도 같다 (시험이 그것을 박는다).

### ④ 몸 위에는 붙었는지만, 펼침에는 누가

태도(C018) · 배분(C-COMBAT-001) 이 이미 세운 가름을 따랐다 — 짧은 표기는 위로, 긴 것은
아래로. 몸 위에 남긴 자의 이름까지 붙이면 이름줄이 `[적대] 준비! ◈발(強) Wanderer 1 ?`
처럼 자란다. C025 가 기술 띠에서 실측으로 배운 것과 같은 자리다.

### ⑤ 경위의 표식을 아직 화면에서 읽지 않는다

`strikes[].breakdown.conditions` 는 C-COMBAT-003 이 이미 계약에 실었고 이 Cycle 이 표식을
그 목록에 더했다. 떠오르는 타격 결과 표시에는 여전히 싣지 않는다 —
`works/BACKLOG.md` 의 `condition-in-the-breakdown` 이 그 자리를 기다린다 (V-작업이며
세계를 건드리지 않는다). 이 Cycle 이 그 항목의 값을 키웠을 뿐 새 결손을 만들지 않았다.

### ⑥ GAP 없음

04 의 계약이 실은 것 중 화면이 받지 못한 값은 없다. 세계 내부를 읽은 자리도 없다.
