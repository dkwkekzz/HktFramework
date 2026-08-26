# CYCLE C-COMBAT-001 — Where Your Power Sits

[PASS] Cycle Definition           (배분 하나 · 값만 오르내린다 · 여닫는 것은 EXCLUDED)
[PASS] Intent                     (세 축은 겹치지 않는다 · 고른 배분은 0 · 형태는 보이고 값은 관문 안)
[PASS] World Semantic             (몫 합 6 · 고른 배분은 0 · 유효 값에 0 바닥 · GAP 없음)
[PASS] GameView Specification      (더하는 것 셋 · 형태는 그대로 수만 움직인다 · GAP 없음)
[    ] Human Semantic Review
[    ] World Implementation
[    ] View Implementation
[    ] Verification

STATUS  IN PROGRESS

> **트랙 번호공간.** `C-COMBAT-` 접두사의 첫 Cycle 이다 (`guides/cycle-definition.md` Do 1).
> `C001`~`C026` 은 트랙 도입 전의 옛 번호공간이라 세지 않는다.

## MASTER TRACE

    Frontier            FR-WHERE-YOUR-POWER-SITS — 지금 힘이 어디에 몰려 있는가
                        (`master/frontier/combat.md` 의 SELECTED · Human 위임 2026-08-26)

    Source Goal         MG-OVERCOME-SUPERIOR-OPPONENT

    Source Possibility  MP-EXPLOIT-OPEN-BODY          (이 Cycle 로 닫히기를 겨눈다)
                        MP-CONCENTRATE-THE-POWER      (전진)
                        MP-HOLD-FORTIFIED             (전진)

    Target Capability   MC-AURA-ALLOCATION            (overlay: MISSING)

    Active Constraints  DC-COMBAT-AURA-IS-A-PROFILE-NOT-A-DIAL
                        DC-COMBAT-ONE-FORMULA
                        DC-COMBAT-SHARED-BUDGET
                        DC-COMBAT-PLAYER-CAUSALITY
                        DC-COMBAT-ONE-LAYER-AT-A-TIME
                        DC-WORLD-OWNS-THE-SURFACE-LIST

    Constraint Note     여섯 다 SATISFIED 로 평가되어 SELECTED 되었다. 이 Cycle 이
                        실제로 지켜야 하는 형태로 풀면 이렇다.

                        AURA-IS-A-PROFILE-NOT-A-DIAL — 가장 주의할 하나다.
                          전투 중 입력이 **이름 붙은 배분 하나를 고르는 것**을 넘어서는
                          순간 이 층이 UL §41.1 이 이름 붙여 금지한 실시간 조절 UI 가
                          된다. 비율·슬라이더·축별 증감 버튼은 전부 이 선 밖이다.
                          개수 제한은 이 Constraint 가 아니다 — 몇이든 좋고 고르는
                          입력이 하나면 된다
                        ONE-FORMULA — 배분은 **새 공식이 아니다.** 피해도 방어도 지금의
                          한 공식을 그대로 지난다. 배분이 하는 일은 그 공식이 읽는
                          입력값을 바꾸는 것뿐이다. 배분 전용 피해식·배분 전용 감쇄식은
                          이 Cycle 의 실패다
                        SHARED-BUDGET — 새 게이지를 만들지 않는다. 배분을 바꾸는 대가는
                          이미 있는 기력(`cp`)에서 나온다 (UL §12 — 초기에는 기존 자원)
                        PLAYER-CAUSALITY — 확률이 개입하지 않는다. 같은 배분·같은 타격은
                          같은 결과이고, 그 경위에 배분이 얼마를 기여했는지가 실린다
                        ONE-LAYER-AT-A-TIME — 배분 없이도 아래 층이 그대로 동작해야 한다.
                          배분을 한 번도 바꾸지 않은 몸은 지금까지와 한 톨도 다르지 않다
                          (기본 배분의 기여가 0 이라는 뜻이며, 이것이 회귀의 근거다)
                        WORLD-OWNS-THE-SURFACE-LIST — 지금 어느 배분인가 · 그래서 무엇이
                          얼마나 오르내렸나 · 바꿀 수 없으면 왜 안 되나를 **세계가**
                          싣는다. 화면이 배분 이름을 보고 값을 계산하지 않는다

    Master Feedback     닫힐 때 `08-verification.md` 가 위층에 보고할 것 중 **미리 아는
                        것 하나**를 여기 박아 둔다. 이 Cycle 은 MC-AURA-ALLOCATION 을
                        `MISSING → IMPLEMENTED` 로 올리지 못한다.

                        그 노드의 semantic 은 "수치뿐 아니라 **지금 무엇을 할 수 있는가
                        자체를 가른다**" 를 포함하고 (UL §15), 그 절반은 이 Cycle 의
                        EXCLUDED 다 — 능력의 가능 여부를 여닫는 것은 조건 관문
                        (FR-THE-WORLD-DECIDES-WHAT-IS-POSSIBLE) 의 몫이라고 후보 자신이
                        적었다. 그러므로 정직한 판정은 `MISSING → PARTIAL` 이고,
                        남는 결손은 "배분이 값만 바꾸고 목록을 바꾸지 않는다" 다.

                        같은 이유로 **MP-EXPLOIT-OPEN-BODY 가 이 Cycle 로 닫히는지도
                        Stage 8 이 실측으로 판정한다.** 후보는 닫힌다고 적었고 근거는
                        요구 넷 중 셋이 이미 선 것이다. 그 판단이 서려면 남은 하나
                        (MK-OPPONENT-FLOW-PATTERN = "상대의 배분이 관찰된다")가 이
                        Cycle 의 INCLUDED 로 실제로 서야 하며, 그래서 그것을 INCLUDED 에
                        넣었다. 판정은 실행 결과로 한다 — 여기서 미리 닫지 않는다.

                        이 둘은 상위 의미와 **어긋나지 않는다** — 후보의 "추천 순서" 절이
                        같은 손해를 이미 적어 두고 그것을 감수하기로 했다. 그러므로
                        MASTER GAP 이 아니라 예고된 보고다.

## TYPE

    New Capability — 힘의 배분 (MS-AURA-NEN / ALLOCATION)

    다만 **새 계산 축을 세우는 것이 아니다.** 판정이 읽는 값을 매번 다시 세는 얼개
    (`world/semantic/combat.ts` 의 `effectiveStat` · RULE-EFFECTIVE-STATS-001)가 C023 으로
    이미 서 있고, 배분은 그 합에 항을 하나 더한다. 지금 그 합은 한 항(걸린 것들의 기여)
    이고 이 Cycle 이 둘째 항(지금의 배분)을 더한다.

    그래서 이 Cycle 은 새 Capability 를 세우면서 동시에 **기존 Capability 의 확장**이다 —
    `effectiveStat` 이 답하는 능력의 목록이 여덟에서 아홉으로 늘고(아래 INCLUDED),
    그 값을 읽는 자리가 하나 늘어난다.

## TARGET CAPABILITY

    Combat — 유효 값 (`world/semantic/combat.ts` 의 `effectiveStat` 와 그 독자들)
    Actor  — 몸이 지니는 상태 하나 (지금의 배분)

## GOAL

    플레이어가 전투 중에 **한 번의 조작으로 자기 힘의 배분을 바꾸면**, 그 순간부터
    때리고 막는 값과 아는 범위가 눈에 띄게 맞바뀌고, 그 맞바뀜이 피해 계산의 경위에
    숫자로 실린다. 그리고 **상대가 지금 어디에 몰아 두었는지가 보이므로**, 얇아진 쪽을
    골라 때릴 수 있다.

    지금은 그럴 수 없다. 몸의 능력치는 종류가 정한 값에 걸린 물건의 기여를 더한 것으로
    고정되어 있고 (C010 · C012 · C013 · C015 · C023), 전투가 도는 동안 그 값을 사람이
    바꿀 수 있는 자리가 없다. 그래서 지금의 전투는 "누가 더 좋은 값을 지녔는가" 로
    시작해 그대로 끝난다 — 같은 몸이 국면마다 다른 몸이 되는 일이 일어나지 않는다.

    이 Cycle 이 끝나면 **같은 몸이 두 국면에서 다른 몸이다.** 그리고 그 다름은 숨은
    것이 아니라 서로에게 보이는 것이라, 읽고 노리는 수가 성립한다.

## INCLUDED

    지금의 배분                  몸마다 정확히 하나. 이름 붙은 상태이며 값의 묶음이 아니다
                                 (DC-COMBAT-AURA-IS-A-PROFILE-NOT-A-DIAL)
    배분이 유효 값에 들어간다     `effectiveStat` 의 합에 항이 하나 는다. 몸에 몰면 때리고
                                 막는 값이 오르고 능력과 인지의 값이 내린다 — **총량은
                                 같다.** 한쪽이 오르면 다른 쪽이 실제로 내려야 한다
    아는 범위도 유효 값이 된다    `insight` 가 지금은 기본값 그대로 읽힌다 (`self.insight`).
                                 인지 축이 걸릴 곳이 그것뿐이므로 이 Cycle 이 그 값을
                                 유효 값 경로로 옮긴다 — 아래 AFFECTED 가 그 대가다
    바꾸는 입력 하나              전투 중에 배분을 바꾸는 조작. **하나**이며 대가가 있다
    바꿀 수 없는 사유             대가를 치를 수 없으면 세계가 사유를 골라 하나 싣는다
                                 (`unavailableReason` 과 같은 꼴)
    남의 배분이 보인다            상대가 지금 어디에 몰아 두었는지가 관찰에 실린다.
                                 **이것이 MP-EXPLOIT-OPEN-BODY 의 남은 요구 하나다** —
                                 빠지면 그 갈래가 닫히지 않는다
    경위에 배분이 실린다          한 방의 계산 경위에 배분이 어느 값에 얼마를 보탰는지가
                                 읽힌다 (MC-COMBAT-CAUSE-READING 의 자리를 그대로 쓴다)
    자율 존재도 배분을 지닌다     같은 상태를 지니고, 국면에 따라 바꾼다.
                                 배분이 플레이어 전용 장치가 되면 상대를 읽는 수가
                                 성립하지 않는다

## EXCLUDED

    가능 여부를 여닫는 것         "인지를 일정 이상 몰아야 숨은 것이 보인다" · "능력을
                                 일정 이상 몰아야 계약의 둘째 조건을 쓴다" (UL §15).
                                 **조건 관문(FR-THE-WORLD-DECIDES-WHAT-IS-POSSIBLE)의
                                 몫이다.** 여기서는 값만 오르내린다 — 후보 자신이 그렇게
                                 적었고, 그 대가는 위 Master Feedback 에 박아 두었다
    전투 밖의 배분 편집 화면      배분을 만들고 다듬는 자리. Constraint 가 막지 않지만
                                 이 Cycle 의 Goal 이 아니다 — 세계가 배분을 정해 두고
                                 고르기만 한다
    비율 · 슬라이더 · 축별 증감    Constraint 가 이름 붙여 금지한 형태다
    배분을 유지하는 비용          몰아 둔 자세를 무는 데 드는 지속 자원 (MC-FORTIFY).
                                 근거 문서가 이름만 댔다 (`part_of.grounded: false`) —
                                 후보의 Target 이 될 수 없으므로 여기서 지어내지 않는다.
                                 이 Cycle 이 서면 그 위에서 다시 본다
    새 자원 · 새 게이지            배분은 게이지가 아니라 상태다 (DC-COMBAT-SHARED-BUDGET)
    총량을 키우는 것              배분은 같은 총량을 다르게 나눌 뿐이다. 배분을 바꿔서
                                 세 축의 합이 커지면 그것은 버프이지 배분이 아니다
    걸고 푸는 것                  버프가 아니다 — 언제나 어느 하나이고, "배분이 없는 몸"
                                 은 존재하지 않는다 (기본 배분이 있을 뿐이다)
    배분에 따라 겉모습이 달라짐    UL §40 의 시각 표현. 관찰에는 실리되 **몸의 생김새를
                                 바꾸는 일**은 이 Cycle 이 아니다
    대답 · 정밀 구간 · 기회        사슬 A 전부. 이 후보는 그것과 독립이다 (Depends on 없음)

## RELATED EXISTING CAPABILITY

    재사용 — 이 Cycle 이 얹히는 자리 (형태를 바꾸지 않기를 기대한다)
        effectiveStat                  C023 · RULE-EFFECTIVE-STATS-001 —
                                       기본값 + 걸린 것들의 기여. **저장하지 않고 매번
                                       다시 센다.** 배분은 이 합에 더해지는 둘째 항이다
        ActorState 의 여덟 능력치        C010 · C012 · C013 · C015 — 이제 "기본값" 이라는
                                       뜻을 가진 값들이다. 이 Cycle 이 그 뜻을 유지한다
        defenseMultiplier              C010 · C012 — 방어가 남기는 몫. **바꾸지 않는다**
        rawDamage / offenseStatValue   C010 · C012 — 유효 값을 읽는 자리. 배분이 들어가면
                                       읽는 값이 달라지지만 **읽는 방법은 그대로다**
        cp / cpMax                     C007 — 바꾸는 대가가 나올 곳 (DC-COMBAT-SHARED-BUDGET)
        상대 능력치 관찰 · 가려짐         C014 · C016 — 남의 값이 어디까지 보이는가의 관문.
                                       "남의 배분이 보인다" 가 이 관문을 지나는지 지나지
                                       않는지는 Stage 3 이 정한다
        계산 경위                       MC-COMBAT-CAUSE-READING (IMPLEMENTED) — 한 방의
                                       경위를 통째로 싣는 자리. 배분의 기여가 여기 실린다
        npc 판단                        C002 · `world/simulation/npc-decide.ts` —
                                       자율 존재가 국면에 따라 배분을 바꿀 자리

    영향 가능 (AFFECTED — Stage 3 이 확정한다)
        ContributableStat              `world/semantic/item.ts` — 지금 여덟이고 `insight`
                                       가 없다. 인지 축이 유효 값이 되려면 이 목록이
                                       늘어야 한다. 주석이 이미 그 길을 적어 두었다
                                       ("그런 물건이 생기면 이 목록에 이름이 하나 늘고,
                                       유효 값을 세는 자리는 열리지 않는다")
        observe / 가려짐 관문            `world/rules/observe.ts` · `projection/observer-view.ts`
                                       가 `self.insight` 를 **기본값 그대로** 읽는다.
                                       유효 값으로 옮기면 배분이 실제로 아는 범위를 바꾼다 —
                                       옮기지 않으면 인지 축이 아무 일도 하지 않는다.
                                       C016 의 회귀 대상이다
        관찰 표면 (self · 상대)          `projection/observer-view.ts` 의 능력치 줄들.
                                       배분 항이 생기면 이 값들이 국면마다 움직인다 —
                                       C010 · C012 · C013 · C015 · C016 · C023 의 관찰이
                                       전부 이 값을 지나므로 회귀 범위가 넓다
        전투 HUD                        `view/hud-presentation.ts` · `view/combat-presentation.ts` —
                                       지금의 배분과 상대의 배분이 자리를 요구한다.
                                       **VIEW 레인과 같은 파일이다** — 자기 영역 끝에
                                       추가만 하고 기존 줄을 옮기지 않는다 (LANES 충돌 칸)

    건드리지 않는다
        engine/                        기반이다. 컨텐츠 Cycle 이 편집하지 않는다
                                       (`npm run boundary:check`)
        world/semantic/equipment.ts 의 기여 계산
                                       걸린 것의 기여는 그대로다. 배분은 그 옆에 서는
                                       **다른 항**이지 같은 항의 확장이 아니다

## 이 Cycle 이 답해야 하는 것 — Stage 2·3 으로 넘긴다

    아래 셋은 여기서 정하지 않는다. 정할 자리가 아니고 (구현 방법이 아니라 세계 의미),
    정할 근거도 Stage 3 이 세운다. 다만 **Stage 3 이 이것을 지나쳤다면 그 단계가 덜
    닫힌 것**이므로 여기 남긴다.

    ① 능력(ABILITY) 축이 걸릴 값은 무엇인가
       후보는 "스킬 값 배율" 이라 적었고 그 근거 노드(MC-SKILL-SCALING)는 IMPLEMENTED 다.
       그런데 세계에서 그 배율(`attackRatio`)은 **스킬이 지닌 값**이고 몸이 지닌 값이
       아니다. 몸의 배분이 스킬의 값을 건드릴 수는 없으므로, 능력 축은 그 배율이
       곱하는 쪽(공격 능력) 에 걸리거나 새 이름을 얻어야 한다.
       **총량 보존(위 EXCLUDED)이 이 선택의 심판이다** — 능력 축이 몸 축과 같은 값에
       걸리면 두 축이 같은 것이 되어 배분이 성립하지 않는다.

    ② 세 축이 어느 값에 얼마를 보태는가 — 그리고 그 합이 왜 같은 총량인가
       "한쪽에 몰수록 나머지가 실제로 얇아진다" 가 검사가 아니라 **구조**로 성립해야
       한다. `effectiveStat` 이 가감이 아니라 재계산인 것과 같은 이유다.

    ③ 남의 배분이 C016 의 가려짐 관문을 지나는가
       지나면 통찰이 낮은 몸에게는 상대의 배분이 안 보이고, 그러면 인지 축이 자기
       자신을 여닫는 구조가 된다 (깊지만 EXCLUDED 인 "가능 여부" 에 가깝다).
       지나지 않으면 배분은 언제나 보이고 읽는 수가 곧바로 성립한다.
       **어느 쪽이든 사유를 적는다** — C016 이 세운 의미를 말없이 비켜 가지 않는다
