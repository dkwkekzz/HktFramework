# C027 — View Implementation

## SPEC CONSUMED

    04 항목                          읽는 자리
    ────────────────────────────────────────────────────────────────────────
    skill.identification            `view/skill-presentation.ts` — `isSkillInteraction`
                                    (`profile` 이 실렸는가 하나로 답한다)
    skill.availability              `view/skill-presentation.ts` — `skillObservations`
    skill.unavailableReason         같은 자리 — 코드를 그대로 받아 문구로만 바꾼다
    skill.profile.cost / charge     `view/skill-presentation.ts` — `energyText`
    skill.profile.rawDamage         같은 자리 — **그대로 옮긴다.** 다시 계산하지 않는다
    skill.profile.damageType        같은 자리 — `code-text` 로 문구가 된다
    requestOutcome.accepted         `app/main.ts` — `drainOutcomes`
    requestOutcome.reason           같은 자리 → `SkillAnswer.reason` → 문구는 결정 Layer
    requestOutcome.mark             같은 자리 — 어느 대답이 어느 요청의 것인지 짚는 수단

    **읽지 않은 것** — 04 가 이 Cycle 의 밖으로 둔 것들
    entities[].actionPhase · entities[].progress (VUX-SK-03) ·
    entities[].swing (조준 범위처럼 보이지 않게) · profile.swingBegin / swingEnd 의
    실시간 환산 (VUX-SK-03) · strikes[].breakdown (이미 C010 이 그리고 있다)

## 새 파일

    `view/skill-presentation.ts`

        기술을 어떻게 보일지 정하는 **role/id 단위 단일 항목**. 이 파일에
        `attack` 도 `skill-heavy` 도 `aura-strike` 도 **없다** — 기술이 넷이 되는 날
        이 파일은 바뀌지 않는다.

        띠      `skillHudItems`    기술마다 한 칸. 이름 · 실제 키 · 지금 어떤가 하나
        패널    `skillDetailLines` 기술마다 한 줄. 기력 수지 · 공격 피해 · 방식 · 긴 사유
        집합    `skillInteractionIds`  조립 루트가 "표식을 달까" 를 이것으로 안다

## 고친 파일

    `view/resolve.ts`            띠를 `hud` 뒤에, 줄을 `self.lines` 뒤에 붙인다.
                                옵션 하나가 는다 (`skillAnswers`) — `command` ·
                                `facingSides` 와 같은 자리다
    `view/code-text.ts`          짧은 표기 둘 (`guarding` · `insufficient-cp`).
                                긴 문장은 이미 있었다. `downed` 는 두지 않았다 —
                                긴 문장 자체가 이미 짧고, 없는 말을 짓지 않는다
    `content/active-view.ts`     조립이 쓸 셋을 재수출한다
    `app/main.ts`                아래 INPUT → ACTION REQUEST 절

    **`engine/` 은 한 글자도 고치지 않았다.** `world/` 도 마찬가지다.
    `npm run boundary:check` 경계 위반 0.

## ASSET MAPPING

    없음 — 새 그림도 새 스프라이트도 새 이펙트도 없다.

    기술 띠는 이미 있는 라벨 위젯(`widget: 'label'`)으로 선다. 04 가 인용한 기획서 §11 의
    지시 그대로다 — "기존 Label · Button · Outline 으로 닫을 수 있는 Vertical Slice 부터
    완료한다". 자리 배치(바닥 중앙 띠 · 아이콘 · 방사형 진행)는 그리기 능력의 일이며
    기반 트랙의 자리다 (아래 CAPABILITY NOTE).

## INPUT → ACTION REQUEST

    키 F · G · R  또는  같은 code 를 흉내 내는 손가락 버튼
        → `latestScene.interactions` 에서 그 code 의 항목을 고른다  (기존 경로 그대로)
        → 그 id 가 `skillInteractionIds(snapshot)` 에 있으면 **표식을 달아** 보낸다
        → 없으면 지금까지처럼 표식 없이 보낸다

    **조립은 기술의 이름을 하나도 알지 못한 채 이 갈림을 지난다** — 무엇이 기술인지는
    팩이 답한다. 그리고 이 갈림 위에 **입력 수단을 묻는 자리가 없다** — 키가 눌렀든
    손가락이 눌렀든 같은 code 로 도착하므로 나가는 요청이 같다
    (INTENT-SKILL-INPUT-CONVERGES-001 · VUX-SK-V-02).

    대답이 오면 그 표식이 가리키는 **기술의 자리**에 붙는다.

        표식이 기술의 것       그 기술의 칸에 `나갔다` 또는 `거절 · 사유`
        표식이 명령의 것       지금까지처럼 명령 기록 줄에 (변화 없음)
        표식이 없는 대답       **아무 자리에도 붙이지 않는다** (아래 FIXED)

## FIXED — 표식 없는 대답이 남의 자리에 붙던 것

    예전 `drainOutcomes` 는 표식 없는 대답을 **명령 기록의 마지막 줄**에 붙였다.
    기술이 표식 없이 나가던 탓에, 명령을 한 번 쓴 뒤 기술이 거절되면 그 사유가
    엉뚱하게 명령 줄에 붙었다 (02 AFFECTED 가 예고한 것이다).

    명령은 언제나 표식을 달고 나가므로(`sendMarked`) 그 갈래가 잡아내던 것은
    **처음부터 남의 요청의 대답뿐**이었다. 갈래를 없앴다.

## FIXTURE TESTS

    `view/tests/skill-observation.spec.ts` — **43 항목.** World 미기동 (VUX-SK-V-12).

    `view/tests/fixtures/skill-unknown.fixture.json` (새 Fixture)
        화면이 이름을 모르는 기술 하나(`skill-tideturn`) + 모르는 사유 코드
        (`moon-not-risen`) + 모르는 방식(`tide`). 기존 `combat` fixture 에서 파생했다.

    기존 Fixture 를 그대로 쓴 것 — 이 Cycle 이 계약을 열지 않았다는 증거이기도 하다

        `combat.fixture.json`       기본은 되고 고급은 기력이 모자란다 (**한 화면에 둘 다**)
        `guard.fixture.json`        셋 다 막는 중
        `damage-type.fixture.json`  셋 다 행동 중 · 물리 둘 오라 하나

    묶음별로 무엇을 고정했는가

        VUX-SK-FX-READY         세계가 실은 기술이 전부 칸이 된다 · 세계가 준 순서 그대로 ·
                                실제 바인딩이 보인다 · 기술이 없으면 자리도 없다
        VUX-SK-FX-UNAVAILABLE   같은 화면에서 하나는 되고 하나는 안 된다 · 다른 사정은
                                다른 사유로 온다 · 가용한 것에 사유를 지어내지 않는다
        (04 skill.profile)      기력 수지가 합쳐지지 않는다 · rawDamage 를 그대로 옮긴다 ·
                                방식이 보인다 · 최종 피해를 만들지 않는다
        VUX-SK-FX-STALE         걸어 둔 것 · 거절 · 닿지 못함 · 받아들여짐이 서로 다르다 ·
                                거절이 남의 자리에 붙지 않는다 · 막을 것이 사라지면 물러난다 ·
                                사유가 바뀌면 세계의 지금 말이 이긴다
        VUX-SK-FX-UNKNOWN       모르는 기술도 칸을 얻는다 · 키가 없어도 사라지지 않는다 ·
                                모르는 코드는 원문 그대로 · 아는 것들은 그대로 그려진다
        (04 identification)     profile 이 없으면 기술이 아니다 · role 이 `skill-` 로
                                시작하지 않아도 profile 이 있으면 기술이다 ·
                                profile 을 떼면 이름이 그대로여도 기술이 아니다
        VUX-SK-V-02             기술마다 실제 키가 실린다 · 손가락 버튼이 서는 조건을
                                모두 만족한다 · 같은 code 는 같은 기술 하나로 풀린다
        VUX-SK-V-05             걸어 둔 것이 기력도 행동도 타격도 이펙트도 바꾸지 않는다 ·
                                세계에 없는 자리(재사용 대기 · 토글 · 연계)를 만들지 않는다
        회귀                    바닥 프롬프트용 목록은 그대로다 · 기술 줄이 패널의 끝이라
                                앞의 줄들을 밀어내지 않는다 · 대답을 주지 않아도 그려진다

    기존 테스트 중 고친 것은 **하나**다 — `view/tests/combat.spec.ts` 의 HUD 순서 기대값에
    기술 칸 둘이 는다. 띠에 자리가 하나 느는 Cycle 이 반드시 건드리는 자리이며,
    그 밖의 기대값은 한 줄도 달라지지 않았다.

## NOTES

### 화면이 판정하지 않는다는 것을 어떻게 지켰는가

    이 파일들에는 기술 이름도, 사유의 우선순위도, 피해 공식도 없다.
    유일한 분류는 `interaction.profile !== undefined` 하나이고, 그것도 계약이 실은
    값을 보는 일이다.

    한 군데 **두 값을 견주는 자리**가 있다 — `rejectionStillHolds` 가
    `skill.reason === answer.reason` 을 본다. 이것도 판정이 아니다:
    세계가 준 두 값(지금의 사유 · 그때의 사유)이 같은지를 물을 뿐, 어느 사유가
    더 중한지도 무엇이 무엇을 막는지도 이 코드는 모른다.

### 왜 그 견줌이 필요했는가 — 실측이 찾아낸 것

    처음 구현은 "거절은 다음 요청까지 남는다" 였다 (기획서 §8 의 `지속 사유`).
    실제로 돌려 보니 **막기를 푼 뒤에도 `거절 · 막는 중` 이 그대로 떠 있었다.**
    세계는 이미 "된다" 고 말하는데 화면이 지난 일을 현재처럼 말한 것이다.

    거절은 *일어난 일*이고 가용성은 *지금 어떤가* 다. 둘이 어긋나면 화면은
    **지금**을 말해야 한다. 그래서 거절은 세계가 여전히 같은 사유로 막는 동안에만 남는다.

        되면                  그냥 된다
        사유가 바뀌면          세계의 지금 말이 이긴다
        같은 사유로 아직 막히면  거절이 남는다 — 짐작이 아니라 실제로 걸어 본 답이므로

### 받아들여짐이 `불가` 보다 앞에 서는 이유

    받아들여진 기술은 **그 순간부터 행동 중**이라 세계가 곧바로 `action-busy` 로 막는다.
    그래서 `불가` 를 먼저 보면 `나갔다` 는 영영 화면에 뜨지 않고, 나간 것과 애초에
    못 나간 것이 같아 보인다 — 이 Cycle 이 없애려는 상태가 그대로 남는다.

    이것도 실측이 찾았다. 처음 구현에서 `나갔다` 는 **한 번도 뜨지 않았다.**

    대신 그 표시는 오래 머물지 않는다 (1.2초 — 가장 긴 기술의 행동 길이 0.9초보다
    조금 길다). 걷히면 세계의 지금이 자리를 돌려받는다. 얼마나 머물지는 **시계를 쥔
    조립 루트**가 정한다 — 결정 Layer 는 무엇을 보일지만 정하고 시간을 세지 않는다.

### CAPABILITY NOTE — 기반으로 반환하지 않은 것과 반환할 것

    기획서 §2.1 의 그림(바닥 중앙 띠 · 아이콘 · 방사형 진행 · 슬롯 테두리)은
    **그리기 능력의 일**이며 `engine/view-kernel/hud/` 가 소유한다.
    컨텐츠 Cycle 이 그것을 고치지 않으므로 이번에는 **있는 라벨 띠로 닫았다** —
    기획서 §11 이 지시한 순서 그대로다.

    지금 형태로도 이 Cycle 의 Goal 은 전부 성립한다: 셋이 한 자리에 나란히 서고,
    사유가 각자 붙고, 값이 보이고, 요청의 대답이 그 자리에 온다.

    다만 다음 둘은 **기반 트랙의 일**로 남는다 — 컨텐츠에 우회 판정을 만들지 않았다.

        슬롯 모양의 띠            아이콘 · 테두리 · 진행 링. 지금은 `label: value` 한 줄이다
        손가락 버튼의 사유         `touch-pad.ts` 는 `available` 을 `data-` 속성으로만 쓰고
                                사유 문구를 그리지 않는다. 같은 목록을 읽고 있으므로
                                두 표면이 갈리지는 않지만, 손가락으로 하는 사람은
                                여전히 "왜 안 되는가" 를 읽지 못한다

    후자는 이 Cycle 이 연 `INTENT-SKILL-BLOCK-NAMES-ITSELF-001` 이 **아직 한쪽 표면에서만
    참**이라는 뜻이다. 08 의 MASTER FEEDBACK 이 그것을 위층에 올린다.

---

## 기반 트랙 이후 — 자리가 옮겨졌다 (이 Cycle 이 닫히기 전)

이 문서가 쓰인 뒤 두 가지가 일어났다.

**① main 병합 — 레인 B 가 같은 자리를 이미 열어 두었다.**
`C025-the-shape-is-data` 가 기술 띠와 패널을 먼저 세웠다 (넓이 막대 · 도달 · 가용성 · 사유).
합치기로 했고, 그 결정 넷은 병합 커밋이 소유한다. 요약하면:
무엇이 기술인가는 `profile` 로 통일하고(모양은 있으면 그린다), 띠의 표기와 자리 순서는
레인 B 를 따르고, 패널은 레인 B 의 ✓/✗ 에 이 Cycle 의 값(기력 수지·공격 피해·방식)을 얹었다.

**② 기반에 슬롯 띠 capability 가 섰다** — `engine/view-kernel/hud/slot-bar.ts`.

    그래서 기술은 **위쪽 가로 띠를 떠났다.** 같은 값이 화면 아래 슬롯 띠에 서므로
    두 자리에 두면 한 화면에 같은 말이 두 번 있게 된다.

        위쪽 띠 (이전)   `F 기본 스킬: ███░░ 150° · 도달 2.0 · 지금 됨`
        슬롯 띠 (지금)   칸 하나에 부르는 자리 · 이름 · 값 · 지금 어떤가가 **각각 다른 자리**

    이 Cycle 이 만든 관찰(가용성 · 사유 · 값 · 요청의 대답)은 **하나도 잃지 않았다** —
    자리만 옮겼고, 옮긴 자리에서 **누를 수 있게** 되었다.

    `skillHudItems` 는 지웠다 (죽은 코드를 남기지 않는다). `skillSlotBar` 가 그 자리다.

**③ 요청이 나가는 자리가 하나로 모였다** — `app/main.ts` 의 `requestInteraction`.
키가 불렀든, 손가락 버튼이 불렀든, 띠의 칸이 눌렸든 전부 이 함수 하나를 지난다.
`INTENT-SKILL-INPUT-CONVERGES-001` 이 코드의 모양으로 강제된다 — 입력 수단마다 다른
규칙이 생길 길 자체가 없다.
