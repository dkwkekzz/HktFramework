# C-COMBAT-003 — View Implementation

## SPEC CONSUMED

    interactions.skillHatsu                view/interaction-presentation.ts
                                           역할 `skill-hatsu` 한 줄 — 키 · 표기 · 이름.
                                           **그 밖에 이 기술을 아는 화면 코드가 없다**
    interactions[].profile.requires        view/skill-presentation.ts (`circumstanceText`)
    interactions[].profile.conditions      같은 자리
    interactions[].reason                  기존 자리 — 새 사유 코드가 그대로 실린다
    strikes[].breakdown.conditions         계약이 실어 오고, 이 Cycle 은 화면에서 읽지 않는다
                                           (아래 NOTES ③)
    hud                                    `change: NONE` — 새 자리를 요구하지 않았다

## ASSET MAPPING

    hatsu-burst → 모션 없음                `motions/<kind>/hatsu-burst.*` 를 두지 않았다.
                                           고급 기술 · 오라 기술도 자기 시트가 없고 기본
                                           휘두름 모션으로 폴백한다 — 새 기술만 다르게
                                           둘 이유가 없다 (`npm run motions:check` 통과)
    hatsu-burst → 전격 + 파이어볼 폭발       view/effect-presentation.ts 의 SKILL_EFFECTS 한 줄.
                                           오라 스킬의 **결**(전격)에 고급 스킬의 **무게**
                                           (화구)를 올린다. 새 게놈을 만들지 않았다 —
                                           예산 7 그대로다 (F1 규칙 2·3)
    기준 60                                고급 기술(55)의 자로 재면 조건이 붙은 한 방이
                                           늘 천장에 붙어 **사정이 화면에서 구별되지 않는다**

## INPUT → ACTION REQUEST

    O           → `{ interactionId: 'skill-hatsu' }`

    F·G·H 옆에 두지 못했다. `KeyJ`~`KeyL` 은 표면 안의 조작이 쥐고,
    `KeyZ`·`KeyX`·`KeyR`·`KeyT`(시점)와 `KeyC`·`KeyV`(관찰 토글)는 기반이 먼저 가져간다
    (`engine/view-kernel/input/engine-keys.ts`). **남은 글자가 O·P 둘뿐**이었고 앞의 것을
    썼다. 처음에 `KeyZ` 로 두었다가 팩의 검사(`skill-shape.spec.ts` — 예약 키와 다투지
    않는다)가 잡았다 — C025 가 세운 그 검사가 이번에 값을 했다.

## FIXTURE TESTS

    view/tests/circumstance.spec.ts        16 검사 — World 미기동, Fixture 만으로
        기술이 넷이 되어도 화면이 이름으로 가르지 않는다 (칸 넷 · 키 O · 모양 그대로)
        갖춰지지 않은 기술이 칸을 지키고 사유가 뜬다 · 무엇을 하면 열리는지까지 말한다
        요구는 **사정의 이름**으로, 조건은 참 여부와 몫으로 — 다른 말이다
        긴 사유는 한 줄에 한 번만 선다
        요구가 조건보다 앞에 온다
        사정을 지지 않는 기술의 줄은 한 글자도 달라지지 않는다
        띠에는 사정의 긴 문장이 오지 않는다 (C025 가 실측으로 배운 것)
        경위가 되짚기에 답한다 · 화면이 계수를 피해로 환산하지 않는다

    fixtures/circumstance-closed.fixture.json   관문이 닫힌 세계
    fixtures/circumstance.fixture.json          열렸고 조건 하나가 참이며 그 한 방이 남은 세계
                                                (둘 다 실제 세계를 굴려 받아 적었다)

    전체                                   1570 검사 통과 · tsc · boundary:check ·
                                           catalog:check · motions:check 통과

## 눈으로 본 것

    shots/gate-closed-and-read.png         실제 브라우저 (headless chromium · vite)

    화면에 선 것
        기술 띠에 넷째 칸 — `O 발현 일격 · 40° · 도달 2.8`
        패널 한 줄 —
            발현 일격 ✗ 힘을 능력에 몰아 두어야 나간다 — 배분을 발현으로 옮겨라
                     · 기력 -25 / +6 · 공격 피해 62 (오라)
                     · 요구 ✗능력에 힘을 몰아 둠
                     · 조건 ✗그 상대에게 방금 맞음 +0.4 · ✗생명이 절반 아래 +0.4

    **닫힌 기술이 목록에 남아 있고, 왜 닫혔는지와 무엇을 하면 열리는지가 함께 읽힌다.**
    그것이 이 Cycle 이 세운 것의 절반이다 (UL §33 · DC-COMBAT-UNAVAILABLE-HAS-A-REASON).

## NOTES

### ① 화면이 이 기술을 아는 자리는 한 줄이다

`view/skill-presentation.ts` 는 스스로 "기술이 넷이 되는 날 이 파일은 바뀌지 않는다" 고
적어 두었다. 실제로 바뀌지 않았다 — 목록도 순서도 키도 세계가 실은 것이고, 이 Cycle 이
그 파일에 더한 것은 **사정을 옮기는 함수 하나**(`circumstanceText`)뿐이다.

새 기술 자체를 아는 자리는 표 셋의 각 한 줄이다: 부를 키(`interaction-presentation.ts`) ·
사람이 읽는 말(`code-text.ts`) · 터지는 모양(`effect-presentation.ts`). 셋 다 코드가
아니라 표다.

### ② 브라우저가 잡은 것 — 같은 문장이 한 줄에 두 번 섰다

처음에는 갖춰지지 않은 요구를 **긴 사유**로 적었다. 그러자 패널 한 줄이 이렇게 나왔다.

    발현 일격 ✗ 힘을 능력에 몰아 두어야 나간다 — 배분을 발현으로 옮겨라 · … ·
             요구 ✗힘을 능력에 몰아 두어야 나간다 — 배분을 발현으로 옮겨라

앞머리가 이미 그 문장을 지고 있었다. 요구를 **사정의 이름**으로 바꾸어 한 번만 서게
했다. 시험이 아니라 **눈이 잡은 것**이며, 그래서 시험을 하나 더 세웠다 (긴 사유는 한
줄에 한 번만).

### ③ 경위의 조건을 아직 화면에서 읽지 않는다

`strikes[].breakdown.conditions` 는 계약으로 오고 fixture 시험이 그것을 확인하지만,
떠오르는 타격 결과 표시(`combat-presentation.ts`)에는 아직 싣지 않았다.

**의도한 것이다.** 그 자리는 VIEW 레인과 같은 파일이고(LANES 의 충돌 칸), 지금 그 줄은
이미 방식 · 관통 · 치명 · 막기 · 배분 · 성장을 지고 있다. 사정까지 그 한 줄에 밀어
넣으면 C025 가 띠에서 겪은 실패를 결과 표시에서 되풀이한다. **경위를 어떻게 펼쳐
읽힐지는 화면의 문제이지 세계의 결손이 아니므로** VIEW 레인의 할일로 넘긴다 —
08 의 MASTER FEEDBACK 과 `works/BACKLOG.md` 에 적는다.

계약은 이미 그 값을 싣고 있으므로 그 작업은 세계를 건드리지 않는다 (V-작업이다).

### ④ 이 환경에서 재어 보지 못한 것 — 요청이 나가는 길

헤드리스 컨테이너에서는 **어떤 요청도 세계에 닿지 않는다.** 화면 아래 이어짐 칸이
`왕복 2702ms · 재연결 3` 을 보이고, 기술 칸은 전부 `세계에 닿지 않았다` 가 된다.

**이 Cycle 의 결함이 아니다** — 같은 절차를 이 Cycle 이전 코드에 대고 돌리면 기본
기술(`F`)도 똑같이 `세계에 닿지 않았다` 가 된다. 소프트웨어 GPU 위에서 three 와
스플랫을 한 프로세스에 올린 탓이며, `npm run fx:game` 의 "사건이 온다" 판정도 같은
이유로 이 환경에서는 이 Cycle 이전부터 실패한다.

그러므로 **누르면 나간다**는 Human Play 로 확인한다 (08 의 PLAYABLE) —
`npm run dev` → `U` → `3` (발현) → `O`.

### ⑤ GAP 없음

04 의 계약이 실은 것 중 화면이 받지 못한 값은 없다. 세계 내부를 읽은 자리도 없다.
