# CC-A-SHARED-CONSTANT-BECOMES-A-DEFINITION

접수: 2026-08-21 (Feedback) — C025-the-shape-is-data 의 MASTER FEEDBACK 이 보고한
반복 패턴이다. Cycle Agent 는 관찰만 보고했고, 승격 판단은 Human 이 한다.

## CANDIDATE STATEMENT

    세계가 모든 종류에 똑같이 물려주던 상수가 **종류마다 달라야 할 이유**를 얻으면,
    새 층을 세우지 않고 그 상수를 정의로 내린다. 규칙은 그 값을 읽을 뿐이고,
    이름을 묻는 분기를 만들지 않는다.

## 무엇을 말하는가 (예시)

    ❌ 흔한 방식 — "큰 기술은 다르다" 를 층으로 세운다

        function swingCollider(actor) {
          if (actor.currentAction.kind === 'heavy-attack') {
            return heavySwingCollider(actor);   // 큰 기술 전용 경로
          }
          return normalSwingCollider(actor);
        }

        한 번은 싸다. 문제는 **두 번째부터**다. 기술이 하나 늘 때마다 분기가 하나 늘고,
        그 분기를 아는 규칙 · 화면 · 테스트가 함께 열린다. 그리고 두 경로가 조금씩
        갈라진다 — 한쪽만 고친 버그가 다른 쪽에 남는다. 무엇보다 **"기술마다 다르다"
        가 세계의 성질이 아니라 코드의 사정**이 된다: 값을 바꾸려면 코드를 열어야 하고,
        디자이너가 만질 수 있는 것이 아무것도 남지 않는다.

    ✅ C019 가 한 것 — 시간 축

        `world/semantic/collision.ts` 의 전역 상수 `SWING_BEGIN` · `SWING_END` 를
        `SkillDefinition.swingBegin` · `swingEnd` 로 내렸다. 판정은 그 기술의 값을 읽고,
        큰 기술만 값이 다르다. 기본 기술의 값은 한 톨도 바뀌지 않았다.

    ✅ C025 가 한 것 — 공간 축

        같은 파일의 `SWING_ARC` · `SWING_BLADE_RADIUS` 와 파생 함수
        `swingReach(attackRange)` 를 폐지하고 `SkillDefinition.swingArc` ·
        `swingReach` · `swingTipRadius` 로 내렸다.

        **값만 바꿔 실제로 확인했다** — 큰 기술의 셋을 `40°·2.2·0.55` 에서
        `100°·1.6·0.9` 로 바꾸고 같은 플레이 각본을 그대로 다시 돌렸더니 옆에 선
        상대의 판정이 뒤집혔다. 바꾼 것은 값 세 줄이고 **규칙 코드 0줄 · 화면 코드
        0줄 · 각본 0줄**이다. 되돌리니 첫 판의 값이 그대로 돌아왔다.

    두 번 다 같은 세 가지가 성립했다

        새 층을 세우지 않았다        파라미터 몇 칸이 층 하나를 대신했다
        기존 값이 흔들리지 않았다    움직인 것은 그 축이 실제로 달라야 하는 기술 하나뿐
        그 뒤로 값이 싸졌다          새 기술은 정의 한 벌이면 되고 규칙은 열리지 않는다

## OBSERVED REPEATING PATTERN

    C019   전역 상수 SWING_BEGIN · SWING_END              → SkillDefinition (시간 축)
    C025   전역 상수 SWING_ARC · SWING_BLADE_RADIUS
           + 파생 함수 swingReach(몸의 교전 거리)          → SkillDefinition (공간 축)

    C025 는 여기에 하나를 더했다 — **상수가 엉뚱한 소유자에게 있었다.** 닿는 길이가
    몸의 교전 거리에서 왔기 때문에 "어떤 기술도 다른 기술보다 멀리 닿지 못한다" 가
    규칙이 아니라 **사고**로 성립하고 있었다. 값을 내리는 일은 소유자를 바로잡는
    일이기도 하다.

    같은 결의 선례가 아이템 쪽에도 있다 — C020 이 `forceOfSkill()` 로 위력을 정의에서
    뽑아 아이템이 지닌 위력과 같은 자리에 넣었다. 다만 그쪽은 상수를 내린 것이 아니라
    두 출처를 한 자리로 모은 것이라 형태가 조금 다르다.

## AFFECTED NODES

    MC-COMBAT-STRIKE      두 번 다 이 노드의 내부에서 일어났다
    MS-SKILL-FORM         CONTACT 칸의 시간 축 · 공간 축이 이 패턴으로 값이 되었다
    MC-EQUIP-ITEM         (약하게) C023 의 유효 능력치도 "저장하지 않고 정의에서 센다" 는
                          같은 방향이나, 그쪽은 CC-THE-EFFECTIVE-IS-DERIVED-NOT-STORED 가
                          이미 담는다

## EXPECTED SCOPE

    SKILL 에 한정되지 않는다. "세계가 모든 것에 똑같이 물려주던 값" 은 아이템 ·
    존재 종류 · 지형 어디에나 생긴다. 다만 관찰된 사례가 둘 다 SKILL 이므로,
    승격한다면 scope 를 어디까지 열지가 Human 판단의 일부다.

## REQUIRES

    - 종류마다 달라야 할 이유가 생긴 상수는 그 종류의 정의로 내린다
    - 판정은 정의가 답한 값을 읽는다 — 종류의 이름을 묻지 않는다
    - 내린 뒤에도 기존 종류의 값은 그대로다 (내리는 것과 조정하는 것을 한 번에 하지 않는다)

## PROHIBITS

    - 종류 하나가 달라야 한다는 이유로 그 종류 전용 판정 경로를 세우는 것
    - 값이 정의에 있으면서 규칙이 종류 이름으로 분기하는 것 (반쪽만 내린 상태)

## PREFERS

    - 값을 내리는 Cycle 에서 **그 값을 실제로 바꿔 결과가 따라오는지 확인**하는 것.
      코드가 그 자리에 있다는 사실은 증거가 아니다 (C025 가 그렇게 확인했다)

## POTENTIAL CONFLICTS

    `DC-SKILL-COMBINE-BEFORE-NEW-FORM` 과 겹칠 수 있다. 그쪽 §6-2 는 이미
    *"파라미터로도 표현할 수 없어야 새 형태를 세운다"* 를 요구하며, 값 한 칸으로 되는
    것을 새 형태로 세우지 말라고 한다.

    **다른 점은 방향이다.** COMBINE-BEFORE-NEW-FORM 은 *새 것을 만들려 할 때* 앞을
    막고, 이 후보는 *이미 있는 상수를 볼 때* 뒤를 민다. 겹치지만 같지는 않다 —
    그래서 아래 Human 판단이 필요하다.

    `DC-SKILL-IS-COMBINATION-NOT-NAME` 과는 겹치지 않는다. 그쪽은 "무엇이 판정의
    근거인가"(이름이 아니라 정의)를 정하고, 이 후보는 "언제 값을 내리는가"(달라야 할
    이유가 생겼을 때)를 정한다.

## WHY THIS SHOULD BECOME A CONSTRAINT

    두 Cycle 이 각자 발견해 같은 답에 이르렀고, 두 번 다 **더 큰 것을 만들 뻔했다** —
    C019 는 "선딜 시스템", C025 는 "공격 방식 층" 을 세울 수 있었다. 값 몇 칸으로
    끝난 것은 결과이지 처음부터 보이던 길이 아니다.

    원칙이 있으면 세 번째에는 처음부터 보인다.

## COUNTER-ARGUMENT

    **원칙 없이도 이미 두 번 지켜졌다.** Cycle Agent 가 매번 스스로 값 쪽을 골랐다면,
    이것은 Constraint 가 아니라 그냥 좋은 감각일 수 있다. 그리고 Constraint 를 늘리는
    것에는 값이 있다 — 읽어야 할 것이 하나 는다.

    COMBINE-BEFORE-NEW-FORM 의 rationale 에 C025 를 **두 번째 사례로 적는 것**으로
    족하다는 판단도 성립한다. 그쪽이 이미 C019 를 사례로 들고 있다.

## HUMAN DECISION

    PENDING

    고를 것 셋
        (a) 승격한다 — 새 DC 로 세운다. scope 를 SKILL 로 좁힐지 GLOBAL 로 열지 함께 정한다
        (b) 승격하지 않는다 — `DC-SKILL-COMBINE-BEFORE-NEW-FORM` 의 rationale 에
            C025 를 두 번째 사례로 적는 것으로 끝낸다 (가장 싸다)
        (c) 세 번째 사례를 기다린다 — 다른 축(아이템 · 존재 종류)에서 같은 일이
            일어나는지 보고 그때 정한다
