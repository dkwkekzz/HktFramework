# CYCLE C025 — What You Can Do, and Why Not

[PASS] Cycle Definition           (관찰 Cycle · World Delta 0 이 기본 · Anchor 는 밖 · 사유가 이 Cycle 의 중심)
[PASS] Intent                     (물음 1·4 앞자리 · Intent 6 · 사유는 하나 · 표식은 관찰자의 일)
[PASS] World Semantic             (State 0 · Rule 0 · ADDED 없음 · Closure 통과 · JUDGEMENT 4)
[PASS] GameView Specification      (change NONE · profile 이 곧 기술 · 없는 칸은 null 로도 싣지 않는다 · GAP 없음)
[    ] Human Semantic Review
[    ] World Implementation
[    ] View Implementation
[    ] Verification

STATUS  IN PROGRESS

## MASTER TRACE

    Frontier            없음 — Master Frontier 에서 출발하지 않았다.

                        `master/frontier.md` 의 `SELECTED` 는 지금 **없음 (Human 선택 대기)**
                        이며, 이 Cycle 은 그 자리를 건드리지 않는다. 출처는 Human 이 지목한
                        기반 기획 문서 [`design/Design-View-Skill-UX-D1.md`](../../../../design/Design-View-Skill-UX-D1.md)
                        (`VUX-SK-D1`) 이고, 그 문서 스스로가 `[DIRECT-CYCLE]` 로
                        **Master 후보화 없이 바로 Cycle 로 들어가라**고 지시한다 (문서 상단 실행 지시 · §13).

                        Human 도 같은 판단을 명시했다 — "관찰 관련된 내용으로 세계에
                        존재나 규칙에는 영향을 주지 않음. 이에 바로 cycle 진행."

    Source Goal         없음 — 이 Cycle 은 **새 Goal 을 열지 않는다.**
                        지금 세계가 이미 참으로 만들어 둔 것(기술 셋 · 기력 수지 · 관문과
                        사유 · 구간)을 플레이어가 **읽을 수 있게** 만드는 일이다.

    Source Possibility  없음 — 같은 이유. 새 Possibility 가 열리지 않는다.

    Target Capability   없음 — Master Graph 에 노드가 늘지 않는다.

                        다만 이 Cycle 은 이미 IMPLEMENTED 인 여러 Capability 의
                        **관찰 가능성**을 바꾼다. 무엇이 어떻게 달라졌는지는 Stage 8 의
                        `MASTER FEEDBACK` 이 위층에 보고한다 — 여기서 overlay 를 예단하지 않는다.

    Active Constraints  DC-WORLD-OWNS-THE-SURFACE-LIST        (**이 Cycle 의 중심** · GLOBAL)

                        나머지 DC-* 는 대상이 아니다. 이 Cycle 은 세계의 규칙을 하나도
                        열지 않으므로, 규칙의 형태를 제한하는 Constraint 들이 걸릴 자리가 없다.

    Constraint Note

        DC-WORLD-OWNS-THE-SURFACE-LIST — 이 Cycle 의 전부다

            "무엇을 지금 할 수 있는가" 와 "안 되면 왜 안 되는가" 의 단일 출처는 세계다.
            이 Cycle 은 그 목록을 **더 많이 보이게** 만드는 일이지, 화면이 그 목록을
            **더 잘 만들게** 하는 일이 아니다.

            그러므로 이 Cycle 에서 화면이 해서는 안 되는 것이 셋이다.

                기술 목록을 자기 코드에 적는 것        무엇이 기술인가는 세계가 싣는다
                사유의 우선순위를 스스로 정하는 것      세계가 사유 **하나**를 싣는다
                                                    (RULE-SKILL 의 관문 순서가 곧 그 답이다)
                값을 자기가 계산하는 것                치를 기력도 낼 피해도 profile 로 와 있다

            지금 화면이 이 셋 중 어느 것도 하고 있지 않다는 것은 코드로 확인했다 (SCOPE NOTE).
            **이 Cycle 이 지켜야 할 것은 그 상태를 유지한 채 표면만 여는 것**이다.

## SCOPE NOTE — 코드로 다시 대조한 것

이 Cycle 의 근거 기획서(`VUX-SK-D1`)는 아직 이 세계에 없는 Skill 설계
(`design/Skill/*.md` 의 Anchor · Activation · Presence · Execution)를 함께 전제한다.
그러므로 **기획서의 어느 문장이 지금 세계에서 참이고 어느 문장이 아직 아닌지**를
코드로 가르는 것이 이 Stage 의 일이다. 아래 다섯이 그 대조 결과다.

### ① 세계는 이미 기술 셋의 가용성·사유·profile 을 싣고 있다

    `world/projection/observer-view.ts` 가 관찰 결과마다 셋을 나란히 싣는다.

        attack        role `skill-basic`   available + reason + profile
        skill-heavy   role `skill-heavy`   available + reason + profile
        skill-aura    role `skill-aura`    available + reason + profile

    사유는 지어낸 것이 아니라 **실제 거절이 쓰는 것과 같은 판정**에서 온다 —
    `evaluateSkillPreconditions` 하나를 투영과 규칙이 함께 쓴다
    (`world/rules/skill.ts` 의 주석이 그것을 명시한다: "판정이 한 곳에만 있어야
    '왜 안 되는가' 와 실제 거절 사유가 어긋나지 않는다").

    사유 코드 넷이 이미 세계에 있고 문구도 이미 있다 (`view/code-text.ts`).

        downed              쓰러짐
        guarding            막는 중에는 휘두를 수 없다
        action-busy         지금 하는 행동이 끝나야 한다
        insufficient-cp     기력이 모자란다

    **그러므로 이 Cycle 은 사유를 만들지 않는다.** 있는 것을 화면에 도착시키는 일이다.

### ② 그 사유는 화면의 한 자리를 다투다 거의 언제나 지워진다

    `view/resolve.ts` 는 세계가 보낸 interaction 을 전부 `SceneInteraction` 으로 옮긴다.
    거기까지는 하나도 잃지 않는다. 잃는 것은 **그리는 자리**다.

        바닥 프롬프트     키 지시가 있는 것들 중 **첫 번째** 하나 (가용한 것 우선)
        손가락 버튼 띠    키와 프롬프트가 있는 것 **전부** — 그러나 사유 문구는 없고
                        (available 이 `data-` 속성으로만 붙는다),
                        `COARSE_POINTER || touch.engaged()` 일 때만 나타난다

    그래서 마우스와 키보드로 하는 지금의 플레이에서는 **셋 중 하나만, 그것도 문구 한 줄로**
    보인다. 기력이 모자라 기본 기술이 안 나가는 순간에도 화면은 대개 다른 것을 말하고 있다.

    C017 이 우선순위(`interactionPriority`)를 세운 것이 바로 이 문제의 절반이었다 —
    "정작 사람이 알아야 할 '왜 못 캐는가' 는 한 번도 뜨지 못했다"
    (`view/interaction-presentation.ts` 주석). 그 판단은 **한 자리를 누가 차지하는가**를
    고쳤고, 이 Cycle 은 **자리를 하나에서 셋으로 여는 쪽**을 고친다.

### ③ profile 은 화면 코드에 소비처가 0건이다

    `SkillProfileView` 는 일곱 값을 싣는다 — `baseDamage` `attackRatio` `rawDamage`
    `charge` `cost` `damageType` `swingBegin` `swingEnd`.

    이 값들을 읽는 곳을 `app/` `engine/view-kernel/` `content/proto-adventure/view/`
    전체에서 찾으면 **테스트와 Fixture 뿐**이다 (`view/tests/damage-type.spec.ts` 가
    계약이 오는지만 검사한다). 실제 화면에는 한 값도 도착하지 않는다.

    그래서 지금 플레이어는 **고급 기술이 기본 기술보다 무엇을 더 치르는지 화면에서
    알 수 없다.** 자기 패널(`combat-presentation.ts` 의 `selfPanel`)은 자기 능력치를
    아주 자세히 보여 주지만, 그 능력치가 **어느 기술로 얼마가 되는지**는 어디에도 없다.

    C012 가 오라 기술을 세운 이유가 "세기가 아니라 방식으로 갈리는 선택" 이었는데,
    그 선택에 필요한 값이 계약에는 와 있고 화면에는 없다.

### ④ 기술 요청의 대답은 아무 데도 도착하지 않는다

    세계는 요청마다 `RequestOutcomeView` 로 답한다 (accepted · rule · reason · mark).
    화면에서 그 대답을 읽는 곳은 `app/main.ts` 의 `drainOutcomes` 하나이고,
    그것이 붙는 자리는 **명령 콘솔의 기록 줄뿐**이다.

    기술은 `link.send` 로 나간다 — 표식 없는 전송이다. `sendMarked` 는 명령만 쓴다.
    그러므로 기술 요청이 거절되면 **화면에서는 아무 일도 일어나지 않는다.**
    눌렀는데 몸이 안 움직인 것과, 눌렀는데 세계가 거절한 것이 화면에서 같다.

    이것이 기획서 §8 이 말하는 `요청 거절` 항목이 이 세계에서 뜻하는 바다.

### ⑤ Anchor 는 이 세계에 없다 — 이 Cycle 이 만들지 않는다

    기획서 §4.1 은 Anchor 넷(Self · Unit · Direction · GroundPoint)을 전제한다.
    지금 세계의 기술은 **대상을 담지 않는다.**

        `world/rules/skill.ts`      "CurrentAction = SkillKind (대상을 담지 않는다)"
        `world/semantic/action.ts`  `CurrentAction.targetActorId` 는 주석이 `kind = attack`
                                    이라 적고 있으나, 기술을 시작하는 `beginAction(actor, kind, {}, …)`
                                    은 **빈 값**을 넘긴다 — 기술은 대상을 지니고 시작하지 않는다
        `observer-view.ts`          "대상이 없다. 무엇이 맞을지는 요청할 때가 아니라
                                    휘두름 구간의 접촉이 정한다"

    지목(C017 `select-target`)이 있으나 **그것은 Anchor 가 아니다.** 지목은 살펴봄·채굴이
    읽는 것이고, 기술은 지목을 읽지 않는다. 기술이 지목을 읽게 만드는 것은
    `DC-TARGET-IS-INTENT-NOT-AIM` 이 걸리는 **World 의미의 변경**이다.

    그러므로 기획서 `VUX-SK-01` 의 "Self·Unit Anchor Skill 하나를 실제 요청" 을
    **이 세계의 말로 옮기면 "대상 없는 기술 셋 중 하나를 실제 요청"** 이다.
    이 번역은 기획서 §13.1 의 `World Delta  NONE 이 기본` 과 정확히 같은 방향이며,
    §13.2 가 Stage 3 에 건 금지("UI 편의를 위한 Skill Type/Effect 추가")를 지키는 유일한 길이다.

    Anchor 를 세우는 것은 **세계에 존재와 규칙을 더하는 일**이므로 Master Layer 를 거친다.
    이 Cycle 은 그것을 열지 않는다.

### 그러므로 이 Cycle 에 남은 것

    화면에 도착하지 않고 있는 세계의 말 셋을 도착시키는 일이다.

        무엇을 쓸 수 있는가        셋이 한 자리에 나란히 선다        (지금은 하나만)
        무엇을 치르고 무엇을 내는가  profile 이 화면에 처음 도착한다    (지금은 0건)
        내 요청이 어떻게 되었는가    기술의 대답이 화면에 붙는다        (지금은 명령만)

    세 가지 모두 **세계에 있는 것을 읽는 일**이다. World Delta 0 이 이 Cycle 의 기본이며,
    Stage 4 에서 부족한 것이 드러나면 그때 `GAMEVIEW GAP` 으로 되돌린다.

## TYPE

    Existing Capability Enhancement

    기술이라는 개념은 C007 이 세웠고 (기력 수지 · 관문 · 사유), C012 가 방식을 갈랐고,
    C019 가 구간을 세웠다. 이 Cycle 은 **새 개념을 세우지 않는다** —
    그 셋이 이미 만들어 둔 의미의 **관찰 표면**을 연다.

## TARGET CAPABILITY

    기술의 관찰 — "지금 무엇을 할 수 있고, 못 한다면 왜 못 하는가" 를 플레이어가
    행동 **전에** 읽고, 요청한 뒤 그 요청이 어떻게 되었는지를 **행동 후에** 읽는다.

## GOAL

    플레이어가 자기 기술 전부를 한 자리에서 보고 — 각 기술이 무엇을 치르고 얼마를
    내는지, 지금 쓸 수 있는지, 못 쓴다면 왜 못 쓰는지를 읽은 뒤 —
    하나를 골라 실행해 그 요청이 받아들여졌는지 거절됐는지를 화면에서 확인한다.

## INCLUDED

    기술 띠                  세계가 실은 기술이 **전부** 한 자리에 나란히 선다.
                            하나가 다른 하나를 밀어내지 않는다. 화면은 무엇이 기술인지
                            자기 코드에 적지 않는다 — 세계가 실은 것을 편다

    사라지지 않는 사유         못 쓰는 기술마다 **자기 사유**가 그 자리에 붙어 있다.
                            셋이 서로 다른 이유로 막혀 있으면 셋 다 각자의 이유를 보인다.
                            사유는 세계가 실은 코드 그대로이며 화면이 고르지 않는다

    치를 것과 낼 것           고르기 전에 안다 — 기력을 얼마 치르고 얼마를 채우는지,
                            지금 내 능력으로 이 기술이 얼마를 내는지, 어느 방식인지.
                            **세계가 이미 싣고 있는 profile 이 화면에 처음 도착한다**

    요청의 대답              기술 요청이 거절되면 화면이 그것을 말한다. 받아들여진 것과
                            아무 일도 일어나지 않은 것이 화면에서 구분된다.
                            사유는 세계가 준 것이며 화면이 짐작하지 않는다

    같은 의미, 두 입력        키와 포인터가 **같은 요청**으로 수렴한다.
                            누른 것이 무엇이든 세계로 나가는 것은 같다
                            (`VUX-SK-V-02`). 손가락 버튼 띠도 같은 자리를 읽는다 —
                            지금처럼 다른 코드가 자기 목록을 따로 만들지 않는다

    Fixture 검증             세계 프로세스 없이 화면의 결정이 검증된다 (`VUX-SK-V-12`).
                            가용·불가·거절 세 상태가 Fixture 로 고정된다

## EXCLUDED

    Anchor 와 조준            Self · Unit · Direction · GroundPoint 넷 (기획서 §4)
                            — **세계에 없다** (SCOPE NOTE ⑤). Anchor 를 세우는 것은
                            World 의미의 변경이므로 Master Layer 를 거친다.
                            `VUX-SK-02` 가 닫을 자리이며 그 앞에 World Cycle 이 하나 선다

    범위 표시 · Preview       판정 범위 도형 · 예상 대상 강조 (기획서 §4.2 · §4.3).
                            지금 세계의 기술에는 Geometry 도 candidate 도 없다.
                            휘두름 충돌 구(`SwingView`)는 이미 오지만 그것은 **판정의
                            결과**이지 조준의 약속이 아니다 — 예고로 쓰면 화면이 세계가
                            하지 않은 약속을 하게 된다

    복합 Activation          Cast · Charge · Hold · Channel · Combo · Toggle (기획서 §5)
                            — **세계에 없다.** 지금 기술은 시작하면 끝까지 나가고
                            (`replaceable: false`), 중간에 플레이어가 개입하는 단계가 없다.
                            `VUX-SK-03` 이 닫는다

    재사용 대기 (cooldown)    **세계에 없다.** 기술을 막는 것은 기력과 행동 관문뿐이다.
                            화면에 cooldown 자리를 미리 만들지 않는다 — 없는 개념의
                            자리를 만들면 그것이 곧 화면이 지어낸 규칙이 된다

    Presence · Projectile     장판 · 함정 · 날아가는 것과 그 생명주기 (기획서 §6).
                            세계에 그런 존재가 없다. `VUX-SK-04` 가 닫는다

    관찰 오버레이             `F8` 패널 · execution tree · query counts (기획서 §2.2 · §12).
                            `VUX-SK-05` 가 닫는다. 기획서 §13 스스로가 "오버레이부터
                            만들면 진단 화면만 남는다" 며 이것을 뒤로 미룬다

    구간(phase)의 표현        C019 가 세운 startup · active · recovery 를 띠에서 그리는 것.
                            `swingBegin` · `swingEnd` 는 **고르기 전에 아는 값**이므로
                            이 Cycle 의 profile 에 포함되지만, **진행 중인 구간을
                            실시간으로 그리는 것**은 `VUX-SK-03` 의 자리다

    새 기술 · 새 Effect       기술이 늘지 않는다. 피해 공식도 열리지 않는다.
                            띠에 항목이 하나 느는 것은 **세계에 기술이 하나 느는 일**이며
                            그때 이 Cycle 의 화면 코드는 열리지 않아야 한다

    World 규칙 변경           관문도 사유도 기력 수지도 구간 경계도 움직이지 않는다.
                            Stage 4 에서 계약이 모자라면 **투영만** 여는 것이 최대이며
                            (기획서 §13.2 Stage 6), 규칙이 열려야 한다면 그것은
                            이 Cycle 의 범위 밖이라는 신호다

    모바일 전용 조준           폭 `< 720px` 의 전용 UX (기획서 §2.3). 지원 대상이 아니다

    Clipboard 내보내기        기획서 §12 스스로가 후속 범위로 미룬다

## RELATED EXISTING CAPABILITY

    재사용

        기술 판정 단일 출처       `world/rules/skill.ts` 의 `evaluateSkillPreconditions`
                                — 투영과 규칙이 함께 쓴다. **열리지 않는다**
        기술 투영                `world/projection/observer-view.ts` — 셋을 싣는 자리.
                                available · reason · profile 이 이미 나간다
        기술 계약                `protocol/gameview.ts` 의 `SkillProfileView` ·
                                `InteractionView.profile` — 형이 이미 있다
        요청의 대답 계약          `engine/protocol-core/gameview.ts` 의 `RequestOutcomeView`
                                — 형이 이미 있다. 표식으로 요청과 짝지어진다
        표식 전송                `engine/view-kernel/net/world-link.ts` 의 `sendMarked` ·
                                `takeOutcomes` — 명령이 이미 쓰는 길
        키 바인딩 · 문구          `view/interaction-presentation.ts` (F · G · R) ·
                                `view/code-text.ts` (사유 넷의 문구) — 둘 다 이미 있다
        조립 루트                `view/resolve.ts` — 세계가 실은 interaction 을 전부
                                옮기는 자리. 잃는 것은 여기가 아니라 그리는 자리다
        자기 패널                `view/combat-presentation.ts` 의 `selfPanel` — 기력과
                                능력치가 이미 있다. 기술 띠가 그 값을 다시 그리지 않는다
        손가락 버튼 띠            `engine/view-kernel/hud/touch-pad.ts` — 이미 전부를 편다.
                                기술 띠가 이것과 **같은 자리를 읽어야** 두 목록이 갈리지 않는다

    영향 가능

        바닥 프롬프트 우선순위      `interactionPriority` — 기술 셋이 자기 자리를 갖게 되면
                                프롬프트가 다투는 것이 무엇인지가 달라진다.
                                C017 이 이 값을 세운 판단을 뒤집지 않는다
        손가락 버튼 띠            같은 자리를 읽게 되면 이 파일이 열릴 수 있다 —
                                `engine/` 은 컨텐츠 Cycle 이 편집하지 않으므로
                                열려야 한다면 `[CAPABILITY-GAP]` 이다 (기획서 §11)
        `app/main.ts` 의 요청 경로  기술이 표식을 달고 나가면 `drainOutcomes` 가 명령 외의
                                대답도 다루게 된다. 명령 콘솔의 지금 동작은 그대로여야 한다 (회귀)
        Fixture 전부              `view/tests/fixtures/*.json` 은 이미 profile 을 지니고 있다.
                                띠가 서면 기존 Fixture 로도 곧바로 그려진다 — 회귀 확인 대상
