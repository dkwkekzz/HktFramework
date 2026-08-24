# C027 — World Semantic

## 한 줄

    **이 Cycle 은 World State 를 0줄, World Rule 을 0개 더한다.**

    Intent 여섯이 요구하는 의미가 **하나도 빠짐없이 이미 세계에 있다.**
    아래는 그것을 하나씩 대조한 결과이며, 그 대조가 이 Stage 의 실제 작업이다.

## SEMANTIC DELTA

    REUSED

        기술 카탈로그              `SKILL_DEFINITIONS` — 세계가 지닌 기술 전부의 단일 출처.
                                기술마다 길이 · 강함 · 계수 · 충전 · 소모 · 방식 · 구간
                                경계를 지닌다 (`world/semantic/combat.ts`)
        기술 관문 판정             `evaluateSkillPreconditions` — 쓸 수 있는가와 안 되면
                                왜인가를 **한 번에** 답한다. 투영과 규칙이 같은 것을 쓴다
                                (`world/rules/skill.ts`)
        기술 시작 규칙             RULE-SKILL-BEGIN-001 — 관문을 지나면 행동이 시작된다
        기술 기력 수지             RULE-SKILL-BUDGET-001 — 맞아야 기력이 돈다
        행동 관문                  `evaluateActionBegin` — `action-busy` 의 출처
        막기 상태                  `Actor.Guarding` — `guarding` 의 출처
        쓰러짐 상태                `isDowned` — `downed` 의 출처
        기력                       `Actor.Cp` / `CpMax` — `insufficient-cp` 의 출처
        기술 피해 파생             `rawDamage(actor, kind)` — 지금 이 몸으로 이 기술을
                                쓰면 나오는 공격 피해. **세계가 계산한다**
        기술 구간 경계             `swingBegin` · `swingEnd` — 기술마다 다르다 (C019)
        요청 대답 규칙             RULE-REQUEST-REPLY-001 — **Precondition 이 없다.**
                                도착한 모든 요청이 대답을 받는다 (`engine/world-kernel/`)
        요청 표식                  `ActionRequest.mark` — 세계는 해석하지 않고 되돌린다
        관찰자별 투영              관찰 결과는 관찰자마다 따로 만들어진다
        기술 관찰 계약             `InteractionView` (available · reason) +
                                `SkillProfileView` — 형이 이미 있고 값이 이미 나간다

    ADDED

        없음 — World State 0 · World Rule 0.

        새 State 를 하나도 만들지 않는다. 새 판정도 만들지 않는다.
        세계가 답할 수 있는 물음의 집합이 이 Cycle 전후로 **정확히 같다.**

    CHANGED

        없음 — 기존 State 의 뜻도, 기존 Rule 의 관문·전이·결과도 하나도 바뀌지 않는다.

        기력 값도 사유 코드도 구간 경계도 움직이지 않는다. 이 Cycle 이 끝나도
        세계 쪽 테스트의 기대값은 한 줄도 달라지지 않아야 한다 — 달라졌다면
        이 Cycle 이 하지 않기로 한 일을 한 것이다.

    AFFECTED

        없음 — 판정이 바뀌지 않으므로 판정에 영향을 받는 기존 것도 없다.

        회귀 확인의 자리는 세계가 아니라 **화면과 요청 경로**다 (07 · 08 이 소유한다).

## WORLD STATE

    없음 — 이 Cycle 이 더하는 State 가 하나도 없다.

    아래는 Intent 가 읽는 **기존** State 와 그 Authority 다. 전부 World Authority 이며
    이 Cycle 로 Authority 가 옮겨 가는 것도 없다.

        Actor.Cp / CpMax            World Authority     `insufficient-cp` 를 정한다
        Actor.Guarding              World Authority     `guarding` 을 정한다
        Actor.CurrentAction         World Authority     `action-busy` 를 정한다
        Actor.Health (downed)       World Authority     `downed` 를 정한다
        Actor.CombatStats           World Authority     `rawDamage` 의 입력
        Actor.Modifiers             World Authority     기력 소모·충전의 실제 값
        SkillCatalog                World Authority     기술 전부와 그 값 (정적 정의)

    ### pending 은 World State 가 아니다

    "내가 요청을 걸어 두었다" 는 것은 **세계의 상태가 아니다.**

    세계는 누가 무엇을 걸었는지 기억하지 않으며 (RULE-REQUEST-REPLY-001 의
    `Transition 없음`), 대답조차 State 가 아니라 Tick 의 산출물이다.
    그러므로 pending 을 세계에 만들지 않는다 — 그것은 **관찰자 자신이 아는 사실**이며
    INTENT-NOTHING-BEFORE-THE-WORLD-SAYS-SO-001 의 뒷문장이 그 자리를 이미 정했다.

    이것을 State 로 만들려는 유혹이 이 Cycle 에서 가장 큰 위험이다.
    만드는 순간 세계가 관찰자의 사정을 기억하기 시작하고, C003(세계 분리)과
    C009(대답은 State 가 아니다)가 함께 세운 것이 무너진다.

## WORLD RULE

    없음 — 이 Cycle 이 더하거나 고치는 Rule 이 하나도 없다.

    아래는 Intent 가 기대는 **기존** Rule 이며, 어느 것도 열리지 않는다.

        RULE-SKILL-BEGIN-001        Implements  INTENT-ATTACK-001 · INTENT-SKILL-COST-GATE-001 ·
                                                INTENT-DOWNED-001 · INTENT-TEMPO-ACTION-001
                                    Input       Actor, SkillKind
                                    Precond.    쓰러지지 않음 → 막지 않음 → 행동 대체 가능 →
                                                기력 충분  (**이 순서가 곧 사유의 순서다**)
                                    Result      Success | Failure(downed | guarding |
                                                action-busy | insufficient-cp)

        RULE-SKILL-PHASE-001        Implements  INTENT-SKILL-PHASE-001
                                    Result      none | startup | active | recovery
                                    (구간 경계는 기술이 지닌다 — 고르기 전에 아는 값이
                                     profile 로 이미 나간다)

        RULE-REQUEST-REPLY-001      Implements  INTENT-REQUEST-REPLY-001 ·
                                                INTENT-REPLY-CORRESPONDENCE-001
                                    Precond.    **없음** — 도착한 모든 요청이 대답을 받는다
                                    Transition  없음
                                    Result      받아들임(어느 Rule 이) |
                                                거절(어느 Rule 이, 무슨 사유로) + 받은 표식

## OBSERVABLE SEMANTIC

이 Cycle 이 요구하는 관찰은 **전부 이미 관찰 결과에 실려 있다.** 아래는 그 대조다.

    무엇을 관찰해야 하는가          지금 무엇으로 오는가                     상태
    ─────────────────────────────────────────────────────────────────────────
    기술이 무엇무엇인가             interactions 에 실린 항목들               **온다**
    그 기술을 지금 쓸 수 있는가      `InteractionView.available`              **온다**
    못 쓰면 왜 못 쓰는가            `InteractionView.reason` (사유 코드)      **온다**
    치르는 기력                    `profile.cost`                          **온다**
    채우는 기력                    `profile.charge`                        **온다**
    지금 내 몸으로 내는 피해         `profile.rawDamage`                     **온다**
    그 피해의 방식                  `profile.damageType`                    **온다**
    기술 자체의 강함 · 계수          `profile.baseDamage` · `attackRatio`     **온다**
    구간 경계 (고르기 전에)          `profile.swingBegin` · `swingEnd`        **온다**
    내 요청이 어떻게 되었는가         `RequestOutcomeView` (accepted · rule ·   **온다**
                                 reason · mark)
    어느 대답이 어느 요청의 것인가    `RequestOutcomeView.mark`                **온다**
    세계에 이어져 있는가            링크 상태 (C005)                          **온다**

    **빠진 것이 없다.** 그러므로 이 Stage 는 `WORLD DESIGN GAP` 을 내지 않는다.

    ### 관찰 순서 — 사유 하나가 오는 것의 뜻

    관문은 실패 하나에서 멈춘다 (`evaluateSkillPreconditions` 는 첫 실패를 낸다).
    그러므로 관찰되는 사유도 **언제나 하나**다. 이것은 모자람이 아니라 의미다 —
    관문의 순서가 곧 "무엇을 먼저 해결해야 하는가" 의 답이기 때문이다.

        downed              먼저다 — 쓰러진 몸은 다른 무엇을 해도 달라지지 않는다
        guarding            다음이다 — C011 이 이 판정을 **행동 관문보다 앞에** 둔 이유가
                            정확히 이것이다. 뒤에 두면 실제 사유가 드러나지 않는다
        action-busy         다음이다 — 기다리면 풀린다
        insufficient-cp     마지막이다 — 다른 셋이 다 풀린 뒤에야 이것이 남는다

    기획서 §3 은 "Primary 한 개와 Secondary 사유를 분리한다" 를 말하지만, 이 세계에는
    Secondary 라는 것이 없다. 여러 사유를 함께 내려면 관문이 전부를 평가해야 하고
    그것은 **규칙의 변경**이다 — 이 Cycle 밖이다.

## JUDGEMENT — Human 이 정할 것

Agent 권고안을 함께 적는다. 별도 지시가 없으면 권고안대로 Stage 4 로 간다.

### ① 무엇이 "기술" 인지를 화면이 어떻게 아는가

    관찰 결과의 interactions 에는 기술도 있고 이동도 있고 지목도 있다.
    그런데 `InteractionView` 에는 **"이것이 기술이다" 라는 칸이 없다.**

    화면이 `role` 의 `skill-` 접두사로 고르면, 그 순간 화면이 이름 규칙을 자기 코드에
    지니게 된다 — DC-WORLD-OWNS-THE-SURFACE-LIST 가 막는 바로 그것이다.
    (게다가 기본 기술의 id 는 `attack` 이고 role 만 `skill-basic` 이라 접두사가 온전하지도 않다.)

    **권고 — `profile` 이 실린 interaction 이 기술이다.**

        지금 `profile` 은 기술 셋에만 실린다. 값이 오는 것 자체가 "이것은 치르는 것과
        내는 것이 있는 행위다" 라는 세계의 말이며, 화면은 이름을 하나도 알지 못한 채
        기술을 가려낼 수 있다.

        계약이 열리지 않는다 — 형에 칸을 더하지 않고, 세계 쪽 코드도 열리지 않는다.
        기술이 넷이 되는 날 profile 이 함께 실릴 것이고 띠에 항목이 저절로 는다.

        **다만 이것은 Stage 4 가 계약 문장으로 못박아야 한다.** Spec 이 "profile 이
        실린 interaction 이 기술이다" 라고 말하지 않으면, 화면이 그렇게 고르는 것은
        계약을 읽은 것이 아니라 짐작한 것이 된다.

    기각한 대안 — `InteractionView` 에 분류 칸을 더한다

        형이 하나 늘고 세계 쪽이 열린다. World Delta 0 이 깨진다.
        지금 `profile` 로 충분히 갈리므로 값을 치를 이유가 없다. 갈리지 않는 날
        (치르는 것이 없는 기술이 생기는 날) 그때 세우면 된다.

### ② 투영이 기술 셋을 손으로 싣는 것을 고칠 것인가

    `observer-view.ts` 는 지금 `attack` · `skill-heavy` · `skill-aura` 를 **각각 손으로**
    싣는다. `SKILL_DEFINITIONS` 를 펴면 한 자리가 되고, 기술이 넷이 되는 날 투영이
    저절로 따라온다.

    **권고 — 이 Cycle 에서는 하지 않는다.**

        INTENT-SKILL-HAND-IS-WHOLE-001 이 요구하는 것은 **관찰자 쪽에 목록이 없는 것**이다.
        세계 쪽 투영이 셋을 손으로 싣든 카탈로그를 펴든 관찰 결과의 내용은 같고,
        화면은 어느 쪽이든 "실린 것을 전부 편다" 로 끝난다. Intent 는 닫힌다.

        그리고 지금 펴면 id · role 의 이름 셋(`attack`/`skill-basic` · `skill-heavy` ·
        `skill-aura`)을 카탈로그에 어떻게 붙일지를 함께 정해야 한다. 그 이름들은
        화면의 키 바인딩 · 문구 표 · Fixture 전부가 쓰는 이름이므로, 건드리면
        **관찰 계약이 열리고 회귀가 생긴다** — 이 Cycle 이 열지 않기로 한 자리다.

        그러므로 이것은 **기술이 넷이 되는 날의 부채**이며, Stage 8 의 MASTER FEEDBACK 이
        그 사실을 위층에 올린다. 지금 갚으면 이 Cycle 의 World Delta 0 이 깨지고
        얻는 것은 없다.

### ③ 화면이 기술마다 어떤 손짓으로 부를지를 어디가 정하는가

    기술이 하나 늘면 그 기술을 부를 키가 필요하다. 그 키는 세계가 정하지 않는다 —
    `view/interaction-presentation.ts` 가 role 마다 정한다 (F · G · R).

    **권고 — 그대로 둔다. 이것은 위반이 아니다.**

        세계가 소유하는 것은 **목록과 판정과 사유**이고, 화면이 소유하는 것은
        **그것을 무엇으로 부르고 어떻게 그리는가** 다. C005 가 세운
        INTENT-LINK-BINDING-VISIBLE-001 도 "실제 바인딩을 보인다" 이지
        "세계가 바인딩을 정한다" 가 아니다.

        그러므로 띠는 **세계가 실은 기술 전부**를 그리되, 그중 키가 정해지지 않은
        것도 그린다 — 부르지 못할 뿐 존재는 관찰된다. 이것이 기획서 §3 의
        "알 수 없는 code 는 원문 fallback 과 일반 아이콘으로 보이며 슬롯 전체가
        사라지지 않는다" 가 이 세계에서 뜻하는 바다.

### ④ 요청 표식을 기술에만 달 것인가, 나가는 요청 전부에 달 것인가

    지금 표식을 다는 것은 명령뿐이다 (`sendMarked`). 나머지 요청은 전부 표식 없이 나간다.

    **권고 — 이 Cycle 에서는 기술 요청까지만 단다.**

        INTENT-SKILL-REQUEST-ANSWERED-001 이 요구하는 범위가 거기까지다.
        이동 요청은 매 프레임 나가므로 (`MOVE_REQUEST_INTERVAL`) 표식을 달면
        대답이 쏟아지고, 그 대답을 받을 자리도 이 Cycle 에 없다.

        다만 **표식 없는 대답이 엉뚱한 자리에 붙는 문제**는 이 Cycle 이 닫아야 한다
        (02 AFFECTED). 기술이 표식을 달면 기술은 해결되지만, 표식 없이 나가는 다른
        요청의 대답은 여전히 명령 기록의 마지막 줄로 간다. 그 붙이기가 **명령이 건
        요청의 대답일 때만** 일어나도록 좁히는 것이 최소 수선이며, 그것을 Stage 7 이
        소유한다. 세계는 열리지 않는다.

## SEMANTIC CLOSURE

Intent 의 모든 문장을 기존 State · Rule · Observable 로 잇는다.

    INTENT-SKILL-HAND-IS-WHOLE-001

        "지닌 기술을 전부"          → SkillCatalog (`SKILL_DEFINITIONS`) 가 목록의 단일 출처.
                                    그 전부가 interactions 로 나간다
        "동시에 관찰한다"           → 관찰 결과가 셋을 **함께** 싣는다. 하나를 고르는
                                    판단이 세계에 없다 (고르는 것은 화면의 그리는 자리였고,
                                    그 자리를 여는 것이 이 Cycle 이다)
        "관찰자 쪽에 목록이 없다"    → 화면은 `profile` 이 실린 항목을 편다 (JUDGEMENT ①)

    INTENT-SKILL-BLOCK-NAMES-ITSELF-001

        "쓸 수 없는 기술마다"        → `InteractionView.available` 이 기술마다 따로 온다
        "그 기술이 막힌 사유"        → `InteractionView.reason` 이 기술마다 따로 온다
        "네 사유가 갈린다"          → RULE-SKILL-BEGIN-001 의 Result 네 갈래
        "실제 거절과 같은 출처"      → `evaluateSkillPreconditions` 하나를 투영과 규칙이
                                    함께 쓴다 (`world/rules/skill.ts` 가 그 이유를 명시)

    INTENT-SKILL-PRICE-BEFORE-CHOICE-001

        "치르는 기력"               → `profile.cost` (= `SkillDefinition.cpCost`)
        "채우는 기력"               → `profile.charge`
        "지금 이 몸으로 내는 피해"    → `profile.rawDamage` — 세계가 이 몸의 능력치로 계산한다
        "그 방식"                   → `profile.damageType`
        "고르기 전에"               → 이 값들은 요청 전의 관찰 결과에 실린다.
                                    쓰기 전에 알 수 있어야 한다는 것이 C007 이 profile 을
                                    세운 이유 그대로다

    INTENT-SKILL-REQUEST-ANSWERED-001

        "요청은 대답을 받는다"       → RULE-REQUEST-REPLY-001 (Precondition 없음)
        "받아들임과 거절이 갈린다"    → `RequestOutcomeView.accepted`
        "거절이면 사유가 온다"       → `RequestOutcomeView.reason` — 판정한 Rule 이 낸 그대로
        "어느 대답이 어느 요청의 것"  → `RequestOutcomeView.mark` = 요청에 실린 `ActionRequest.mark`
        "대답이 안 온 것과 거절의 구분" → 링크 상태 (C005) + 표식이 짝지어지지 않음.
                                    **세계에 새로 만들 것이 없다**
        "표식 없이 나가는 요청이 없다" → `ActionRequest.mark` 가 이미 형에 있다.
                                    다는 것은 관찰자의 일이다

    INTENT-NOTHING-BEFORE-THE-WORLD-SAYS-SO-001

        "일어나지 않은 것을 관찰하지 않는다" → 관찰 결과는 Tick 의 산출물이며
                                          관찰자가 그것을 앞질러 쓰지 않는다.
                                          **세계에 State 를 더할 자리가 없다**
        "걸어 둔 것은 관찰된다"            → 표식은 관찰자가 지닌다.
                                          세계는 기억하지 않는다 (WORLD STATE 절)
        "걸어 둔 것과 일어난 것이 구분된다"  → 표식 미해소 vs 관찰 결과의 변화

    INTENT-SKILL-INPUT-CONVERGES-001

        "같은 요청으로 도착한다"      → `ActionRequest` 가 경계의 유일한 형이다.
                                    세계는 무엇이 자기를 불렀는지 알 수단이 없다 —
                                    **이미 구조로 참이다**
        "목록도 하나여야 한다"       → interactions 하나가 목록의 단일 출처.
                                    입력 수단이 각자 목록을 만들지 않는 것은 화면의 책임이며
                                    07 이 소유한다

    **닫히지 않은 문장 없음.** State 0 · Rule 0 으로 Closure 가 성립한다.

## OBSERVABLE CLOSURE

    Rule 판단에 영향을 준 조건이 전부 관찰되는가.

        RULE-SKILL-BEGIN-001 의 네 관문

            쓰러짐          `entities[].vitality.downed` 로 관찰된다
            막기            `entities[].attributes.guard.guarding` 로 관찰된다
            행동            `entities[].state` · `progress` · `actionPhase` 로 관찰된다
            기력            `hud.self.cp` / `cpMax` + `profile.cost` +
                            `attributes.modifiers.energyConsume` 로 관찰된다

        네 조건 모두 **값 자체가** 관찰되고, 그 판정의 **결과**도 `reason` 으로 관찰된다.
        겪는 사람은 "왜 안 되는가" 를 사유로 알고, "얼마나 모자란가" 를 값으로 안다.

        실패 사유 넷 모두 코드로 오고 문구도 이미 있다 (`view/code-text.ts`).

    **Observable Closure 통과.** 이 Cycle 이 더할 관찰이 없다.
