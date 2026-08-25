# V-001 — what-you-can-do-and-why-not

    목표        화면 아래 슬롯 띠에서 지금 쓸 수 있는 기술 전부를 한눈에 보고,
                못 쓰는 것마다 그 사유가 붙어 있으며, 하나를 걸면 그 대답
                (나갔다 / 거절 · 사유)이 **그 칸에** 돌아온다

    바뀐 표면    기술 슬롯 띠 (화면 아래 가운데) — 새로 섰다
                    칸마다 부르는 자리(F·G·H) · 이름 · 모양(넓이 막대 · 각 · 도달) ·
                    지금 어떤가가 **각각 다른 자리**에 선다. 눌러서도 걸 수 있다
                자기 패널의 `기술` 절 — 치를 기력 · 채울 기력 · 공격 피해 · 방식,
                    그리고 못 쓰는 사유의 **긴 문장**
                위쪽 가로 띠 — 기술 칸이 **떠났다** (같은 값이 두 자리에 있으면
                    한 화면에 같은 말이 두 번이다)

                근거 기획서: content/proto-adventure/design/Design-View-Skill-UX-D1.md 의 `VUX-SK-01`
                (§1 물음 1 · §2.1 슬롯 바 · §3 시각 언어 · §8 요청 거절)

    바뀐 파일    view/skill-presentation.ts (새 파일) · view/resolve.ts ·
                view/code-text.ts (짧은 표기 둘) ·
                view/tests/skill-observation.spec.ts (새 파일 · 43항) ·
                view/tests/fixtures/skill-unknown.fixture.json (새 Fixture) ·
                view/tests/skill-shape.spec.ts · view/tests/combat.spec.ts (자리 이동 반영)
                조립: app/main.ts · content/active-view.ts · content/blank/view/index.ts

    선행 ENGINE  슬롯 띠는 기반에 없던 능력이라 **ENGINE 레인 작업**이 앞섰다 —
                `engine/view-kernel/hud/slot-bar.ts` · `scene/scene-state.ts` ·
                `index.html` CSS · `tests/slot-bar.spec.ts` (커밋 3518c19).
                그 능력은 게임의 명사를 하나도 모른다 (칸을 그릴 뿐이다).

    검증        `npm test` 68 파일 **1169 통과 / 0 실패** · `npx tsc --noEmit` 오류 0 ·
                `npm run build` 성공 · `npm run boundary:check` 위반 0

                실제 Client 를 띄워(vite + Chromium 1440×900) 눈으로 확인한 다섯 상태

                    입력 전        [F] 지금 됨 · [G] 지금 됨 · [H] 지금 됨
                    **칸을 눌러**   [G] **나갔다** — 키가 아니라 포인터로 걸었고
                                   그 대답이 그 칸으로 돌아왔다
                    막기를 건 뒤    셋 다 불가 · 막는 중
                    막는 중에 F     [F] **거절 · 막는 중** — 다른 둘은 `불가`.
                                   내가 걸어 본 것과 미리 받은 안내가 화면에서 갈린다
                    막기를 푼 뒤    셋 다 지금 됨 — 지난 일이 현재를 가리지 않는다

                회귀: 바닥 프롬프트 · 명령 콘솔 · 소지품/장비 띠 · 기존 Fixture 전부 그대로.
                기대값을 고친 기존 테스트는 자리 이동을 반영한 둘뿐이다.

    실측이 찾은 것   Fixture 로는 드러나지 않고 **실제로 돌려야** 드러난 결함 둘.
                둘 다 화면이 *지금 참이 아닌 것*을 말하는 병이었다.
                  ① 막기를 푼 뒤에도 `거절 · 막는 중` 이 남았다
                     → 거절은 세계가 **여전히 같은 사유로 막는 동안에만** 남긴다
                  ② `나갔다` 가 한 번도 뜨지 않았다 (받아들여진 기술은 곧바로 행동 중이
                     되어 `불가` 가 먼저 잡았다) → 받아들여짐을 `불가` 앞에 두고
                     오래 머물지 않게 했다 (1.2초)

    계약 diff    **없음** — `git diff origin/main...HEAD -- world/ protocol/ master/` 가 비어 있다.
                세계가 이미 싣고 있던 것(`available` · `reason` · `profile` ·
                `RequestOutcomeView`)을 도착시켰을 뿐이며, 그중 `profile` 은
                이 작업 전까지 화면 코드에 **소비처가 0건**이었다.

    무엇이 기술인가  `profile` 이 실린 interaction 하나로 가른다. `role` 의 이름이나
                접두사로 고르지 않는다 — 그러면 이름 규칙이 화면 코드로 복제되고,
                세계가 이름을 바꾸는 날 화면이 조용히 틀린다
                (DC-SKILL-IS-COMBINATION-NOT-NAME · DC-WORLD-OWNS-THE-SURFACE-LIST).
                그래서 이 파일들에 `attack` 도 `skill-heavy` 도 `aura-strike` 도 없다.

## REPORT

세계 관찰의 결손 — **스스로 메우지 않았다.** Human 판단 대기.

    ① 조준의 기준이 없다
       `anchor` 가 world/ · protocol/ 전체에 **0건**이다. 기술은 대상을 담지 않고
       시작하며(`beginAction(actor, kind, {}, …)`), 무엇이 맞을지는 휘두름 구간의
       접촉이 정한다. 그래서 기획서 §4(조준) 전체와 §10 의 `aiming` 을 화면이
       표현할 수 없다. 지목(select-target)은 있으나 기술이 그것을 읽지 않는다.
       → 막힌 것: `VUX-SK-02`

    ② 복합 Activation 이 없다
       `activation` · `toggle` · `combo` 가 **0건**이다. 지금 기술은 시작하면 끝까지
       나가고 중간에 개입하는 단계가 없다. 기획서 §5 의 Cast·Charge·Hold·Combo·Toggle
       을 표현할 것이 없다.
       **다만 구간(startup / active / recovery)은 이미 실려 온다** (`actionPhase` ·
       `progress`) — §5 의 일부는 지금 세계로도 VIEW 작업이 가능하다.
       → 막힌 것: `VUX-SK-03` 의 나머지

    ③ 공간에 남는 존재가 없다
       `presence` · `projectile` · `trap` 이 **0건**이다. 생성→이동→충돌/발동→소멸을
       따라갈 대상이 세계에 없다 (기획서 §6).
       → 막힌 것: `VUX-SK-04`

    ④ 재사용 대기가 없다
       `cooldown` 이 **0건**이다. 기술을 막는 것은 기력과 행동 관문뿐이다.
       화면에 재사용 대기 자리를 **만들지 않았다** — 없는 개념의 자리를 만들면
       그것이 곧 화면이 지어낸 규칙이 된다 (기획서 §3 의 cooldown 표시는 보류).

    ⑤ 한 실행을 묶을 식별자가 없다
       `strikes` · `contacts` · `cancels` · `breakdown` 은 이미 전부 온다. 그런데
       "이 타격들이 **한 번의 실행**이다" 를 묶는 `executionId` 가 계약에 없다.
       그래서 기획서 §7 의 `Skill 실행 → Resolved Target[] → Effect Event` 연결과
       §12 의 실행 Tree 를 화면이 조립할 수 없다.
       → 부분적으로 막힌 것: `VUX-SK-05` (개별 결과는 지금도 보이고 있다)

공정 결손 — PROCESS 레인으로 보고

    ⑥ 조립(`app/` · `content/active*.ts`)이 어느 레인의 쓰기 범위에도 없다
       `guides/works.md` 의 레인 표는 VIEW 를 `view/` · `works/V-*` 로,
       ENGINE 을 `engine/` 로 긋는다. 그런데 화면 작업은 조립 루트를 거의 반드시
       건드린다 — 새 표면을 그리려면 `app/main.ts` 가 그 레이어를 만들고 그려야 하고,
       팩이 내보낸 것을 `content/active-view.ts` 가 재수출해야 한다.
       이 작업도 셋을 건드렸다. `boundary:check` 는 조립을 `assembly` 로 알고 있으나
       레인 표에는 그 이름이 없다.
       → Human 판단: VIEW 쓰기 범위에 조립을 넣을 것인가, 별도 레인인가

## 이 기록이 대신하는 것

이 작업은 처음에 `cycles/C027-what-you-can-do-and-why-not/` 로 8 Stage 를 돌았다.
`guides/works.md` 의 레인 판정(원칙 23)이 서면서 그것이 오분류였음이 드러났다 —
`world/` 와 `protocol/` 을 한 줄도 바꾸지 않았으므로 처음부터 VIEW 작업이었다.
그 디렉터리는 지웠고, 그 안의 판단은 이 파일의 각 절과 REPORT 로 옮겼다.
