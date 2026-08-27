# C-COMBAT-004 — World Implementation

## IMPLEMENTED

    Actor.Marks                       world/semantic/actor.ts — 남긴 자 Id → 남긴 시각.
                                      **새 상태는 이것 하나다**
    Marks · MARK_DURATION · BorneMark world/semantic/mark.ts
    RULE-MARK-BORNE-001 (isMarkedBy)  같은 파일 — 시각에서 매번 다시 센다
    borneMarks                        같은 파일 — 지금 붙어 있는 것만 (닫힌 것은 나가지 않는다)
    RULE-MARK-LEAVE-001               world/rules/mark-leave.ts — 덮어쓴다, 둘이 되지 않는다
    사정 `bears-my-mark`              world/semantic/circumstance.ts
    사정 `no-mark-of-mine-yet`        같은 파일 — 서로의 부정. 사유는 그 파일 주석
    SkillDefinition.leavesMark        world/semantic/combat.ts — **값이지 이름이 아니다**
    SkillKind `mark-strike`           같은 파일 + world/semantic/action.ts
    `hatsu-burst` 의 조건 셋째          같은 파일 — `bears-my-mark` (+0.5)

## REUSED

    RULE-ABILITY-CONDITION-001        C-COMBAT-003 — **대상마다 따로 도는 성질**을
                                      그대로 쓴다. 표식이 조건 목록의 항목이 될 뿐이다
    DamageBreakdown.conditions        C-COMBAT-003 — 표식의 몫이 여기 실린다
    World.TargetSelections            C017 — **읽기만 한다**. 고르기의 뜻을 바꾸지 않았다
    RULE-DAMAGE-CALCULATE-001         **한 글자도 바뀌지 않았다.** 위력이 0 이면 값이 0 이며,
                                      `raw > 0 이면 최소 1` 이 이미 그것을 지니고 있었다
    isGuardBroken / guardBrokenUntil  C011 — 시각에서 매번 다시 세는 선례

## AFFECTED UPDATED

    CircumstanceNow                   `time` 이 더해진다 — World.Time 에 이름을 맞춰 두어
                                      세계 자체가 이 형에 그대로 들어맞는다
    RULE-ABILITY-REQUIREMENT-001      `other` 를 받는다. **차례대로 묻는 것도 처음 거짓인
                                      것의 사유를 내는 것도 그대로다**
    RULE-SKILL-BEGIN-001              그 상대를 관문에 넘긴다
    RULE-SWING-STRIKE-001             `leavesMark` 면 닿은 몸마다 RULE-MARK-LEAVE-001.
                                      **어느 기술인지 묻는 분기가 아니라 정의가 답한 값**
    interactions 목록                  `skill-mark` 하나 + 다섯 기술 모두 고른 상대를 넘긴다.
                                      `chosenTarget` 헬퍼가 관찰자↔몸을 잇는다 (아래 NOTES ①)
    Observer Projection               존재마다 `marks` · 기술 자리가 넷 → 다섯 ·
                                      `requires` 의 `met` 이 고른 상대를 본다
    spawn.ts                          새 몸은 표식 없이 태어난다
    protocol                          `BorneMarkView` · `AttributesView.marks`
    기존 시험 넷                        아래 NOTES ③

## 건드리지 않았다

    engine/                           `boundary:check` 통과
    damage-calculate.ts               피해를 세는 식
    target-selection.ts               고르기의 규칙 — 읽기만 했다
    npc-decide.ts · npc-allocation.ts  자율 존재의 판단 구조 (아래 NOTES ②)

## PROJECTION

    entities[].attributes.marks       world/projection/observer-view.ts —
                                      `borneMarks(actor.marks, state.time)`.
                                      **살펴봄 관문 밖이다** — 가려지지 않는다
    interactions.skill-mark           같은 파일 — 갖춰지지 않아도 목록에 남는다
    interactions[].profile.requires   같은 파일 — `met` 이 고른 상대를 본 답이다

## TESTS

    world/tests/mark.spec.ts          31 검사 — 이 Cycle 의 Intent 열하나 전부
        피해 0 — 값이 작은 것이 아니라 0 · 생명이 한 톨도 줄지 않는다 · 그래도 닿은
        일은 타격 결과로 관찰된다
        표식이 닿은 몸에 생긴다 · 건 쪽에는 남지 않는다 · **다른 곳을 골라도 남아 있다**
        표식 자체는 아무 일도 하지 않는다
        담기는 것은 시각 하나 · 문턱 앞뒤 · 닫힌 표식은 실리지 않는다 ·
        **닫힌 뒤에도 몸이 지닌 시각은 그대로다** (지우는 규칙이 없다는 증거)
        같은 자가 다시 남기면 덮는다 · 다른 자는 다른 자리 · 한 휘두름이 둘에게 닿으면 둘 다
        아무도 고르지 않았으면 상대를 읽는 요구가 거짓 · 이미 걸어 둔 상대에게는 거절과
        사유 · 표식이 닫히면 다시 열린다
        상대를 읽지 않는 요구는 넘어온 상대가 무엇이든 같은 답이다 (회귀)
        목록에 둘 늘었을 뿐 · `hatsu-burst` 는 표식을 **조건**으로 진다
        표식 없이 60 → 표식 뒤 80 · 경위에 `[{ bears-my-mark, 0.5 }]` · raw 125.2
        살펴보지 않은 존재의 표식도 실린다 (겨루는 힘은 여전히 가려져 있다)
        언제까지인지는 실리지 않는다
        자율 존재가 남긴 표식도 사람의 몸에 붙는다
        회귀 — 기존 넷은 표식을 지지 않는다 · 기본 기술 20 · `hatsu-burst` 는 배분만
        갖추면 나간다 · 닿는 길이 정합

    전체                              1601 검사 통과 (이 Cycle 이전 1570 + 31)
                                      boundary:check · tsc 통과

## NOTES

### ① 관문은 "누가 고르고 있는가" 를 모른다

고른 것은 **관찰자**의 장부이고(C017) 관문이 받는 것은 **몸**이다. 둘을 잇는 일을
관문 안에 두면 규칙이 관찰자 개념을 알아야 하고, 그러면 세계 규칙이 "누가 보고
있는가" 에 매인다.

그래서 잇는 자리를 수용층(`world/actions/interactions.ts` 의 `chosenTarget`)과
투영층(`observer-view.ts` 의 `chosenTarget`)에 두었다. 둘 다 이미 관찰자를 아는
자리다. 관문도 사정도 넘어온 몸 하나만 본다.

**대가 하나가 남는다.** 자율 존재는 그 장부를 읽지 않으므로(C017) 상대를 읽는 요구가
그들에게 언제나 거짓이다. 규칙이 조종 주체를 묻는 것이 아니라 자율 존재가 아직
고르지 않기 때문이며, C-COMBAT-003 의 Master Gap ① 과 같은 종류의 자리다.
08 의 MASTER FEEDBACK 이 그것을 보고한다.

### ② 자율 존재는 아직 표식을 걸지 않는다

`RULE-NPC-DECIDE-001` 은 기력만 보고 기본/고급을 고른다. 표식을 거는 판단은 없다.

**의도한 것이다** — 이 Cycle 이 여는 것은 "상대에게 남는 것이 있다" 이지 판단 구조가
아니다 (C-COMBAT-001 · C-COMBAT-003 이 같은 자리에서 내린 판단 그대로).
규칙이 조종 주체를 묻지 않는다는 것은 시험이 지킨다 — 자율 존재가 남긴 표식도
사람의 몸에 붙는다.

### ③ 기존 시험 넷이 고쳐졌다 — 전부 "목록이 늘었다" 다

    circumstance.spec.ts   사정 목록 셋 → 다섯 · `hatsu-burst` 의 조건 둘 → 셋 ·
                           `CircumstanceNow` 에 `time`
    combat.spec.ts         존재의 속성에 `marks: []` (가려지지 않는 것이 하나 늘었다)
    fixtures/*.json 24개    같은 이유 — `attributes.marks` 한 줄

**의미를 고친 것이 하나도 없다.** 전부 이 Cycle 이 03 에서 CHANGED 로 선언한 자리이며,
검사가 "무엇이 목록에 있는가" 를 박아 두었기 때문에 늘어난 것이 잡힌 것이다 —
그것이 그 검사들이 지키는 것이다.

### ④ 피해 0 인 한 대가 여는 것 — 지어내지 않은 결과

피격(RULE-HIT-001)도 밀려남도 쌓임(RULE-DEEDS-ADD-001)도 그대로 일어난다.
그러므로 표식 한 대는 상대의 선딜을 끊을 수 있다 (C019).

**이 Cycle 이 만든 규칙이 아니다** — 이미 있는 규칙들이 피해를 묻지 않기 때문에
따라온 결과이며, C-GROWTH-001 이 "막혀서 0 이 들어가도 친 것은 친 것이다" 로 이미
그 방향을 정했다. 뒤집지 않았다 (03 JUDGEMENT ⑤).

### ⑤ GAP 없음

03 의 ADDED · CHANGED 가 모두 코드에 있고, AFFECTED 가 새 의미와 정합한다.
Semantic 이 부족해 지어낸 자리는 없다.
