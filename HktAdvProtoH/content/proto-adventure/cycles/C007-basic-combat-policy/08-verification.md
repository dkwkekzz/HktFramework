# CYCLE C007 — Verification

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[PASS] Playable        (Agent 확인 완료 / Human Play 확인 대기)
[PASS] Regression

## NEW BEHAVIOR
    기본 스킬이 닿는다        → 상대 생명 -20, 내 기력 +12
    고급 스킬이 닿는다        → 상대 생명 -55, 내 기력 +8 -30 (순 -22)
    허공을 가른다             → 아무 일도 없다 (기력도 돌지 않는다)
    기력 < 소모량             → 고급 스킬이 시작되지 않는다 (insufficient-cp)
    생명 0                    → 쓰러진다. 행동도 못 하고 대상도 되지 않는다
    달리며 이동               → 빠르지만 초당 6 기력이 샌다. 0 이 되면 걷기로 돌아온다
    달리는 중 / 맞은 직후     → 기력 충전 배율 ×0.5 / ×0.2 (겹치면 ×0.1)
    공격 속도 ×2              → 같은 스킬이 절반 길이로 끝난다
    속성 변경 (권한 열림)     → 지목한 존재의 속성이 바뀌고 세계 규칙이 그대로 이어진다
    속성 변경 (권한 닫힘)     → 아무것도 바뀌지 않는다 (debug-closed)

## WORLD SCENARIO (View 없이 실측 — world/tests/combat.spec.ts 39항목)
    고정 피해
        Before  npc-1.Hp = 120, 정면 1.5 거리
        Input   Skill(attack)
        Rule    RULE-SKILL-BEGIN-001 → RULE-SWING-STRIKE-001 → RULE-STRIKE-DAMAGE-001
        After   npc-1.Hp = 100.  같은 조건을 다시 만들어도 언제나 100 (흔들림 없음)

    기력 수지 — 맞혀야 돈다
        Before  self.Cp = 30
        Input   Skill(heavy-attack) → 명중
        Rule    RULE-SKILL-BUDGET-001
        After   self.Cp = 8 (= 30 + 8 - 30).  허공 휘두름이면 30 그대로

        여러 몸을 동시에 때려도 정산은 한 번 — 두 대상 모두 -20, Cp 는 +12 한 번

    기력 부족 게이트
        Before  self.Cp = 8, 고급 스킬 소모 30
        Input   Skill(heavy-attack)
        Result  Failure(RULE-SKILL-BEGIN-001, insufficient-cp)
                관찰에도 available=false · reason=insufficient-cp 로 나온다

    쓰러짐
        Before  npc-1.Hp = 20
        Input   Skill(attack)
        After   Hp = 0, CurrentAction = downed.
                이후 2초를 더 굴려도 스스로 아무 행동도 시작하지 않는다.
                다시 휘둘러도 대상이 되지 않아 기력도 돌지 않는다

    달리기 누수
        Before  Cp = 30, MoveMode = run, 이동 중
        After   1초 뒤 Cp ≈ 24 (초당 6). 6초 뒤 Cp = 0 이고 MoveMode 가 walk 로 돌아온다.
                이후 run 요청은 Failure(insufficient-cp)
                멈춰 있으면 run 이어도 1초 뒤 Cp = 30 그대로

    배율 합성
        원천 없음        cpCharge = 1
        달리는 중        cpCharge = 0.5
        피격(hit) 중     cpCharge = 0.2
        둘 다            cpCharge = 0.1 (곱)

    템포
        ActionSpeed ×2   attack 이 0.35초 뒤 이미 idle (기본 0.6초는 아직 attack)
        진행 중 변경     시작 시 확정된 길이가 유지된다 (0.35초에도 여전히 attack)
        MoveSpeed 3 vs 6 같은 0.5초 동안 나아간 거리가 다르다

    속성 변경 (R2)
        권한 열림 + hp=5      → npc-1.Hp = 5
        권한 닫힘             → Failure(debug-closed), Hp 그대로. interaction 도 available=false
        모르는 속성/대상/범위 → Failure(unknown-attribute | unknown-target | value-out-of-range)
        hp = 0 으로 변경      → RULE-DOWNED-001 이 이어져 downed
        쓰러진 몸에 hp = 50   → downed 를 벗어나 idle (세계 밖에서 되돌린 결과)
        hpMax 를 50 으로      → 현재 Hp 도 50 으로 따라 들어온다

    결정론
        같은 세계를 같은 순서로 두 번 굴리면 자원·타격 결과까지 같은 값이다.
        world/ 에 Math.random 은 0 곳 (R1 로 난수원을 제외했으므로 우연 자체가 없다).

## PROJECTION
    세계가 내보내는 관찰 결과가 04 계약과 일치함을 World 테스트가 관찰 결과로 검증한다
    (테스트는 내부 State 를 읽지 않고 world.latestObservation 만 본다).
        entities[].name · vitality           이름 · 생명 현재/최대 · 쓰러짐
        entities[].attributes                기력·이동 모드·control·템포 3·배율 4 — 남의 것도 전부
        interactions attack/skill-heavy      available · reason · profile(damage/charge/cost)
        interactions move-mode/set-attribute available · reason
        hud.self.* 13항목                     자기 자원·템포·배율
        snapshot.strikes                      attacker/target/skill/amount/at/since, TTL 뒤 사라짐
        snapshot.debug                        open + mutableAttributes 8종과 범위

## VIEW FIXTURE
    view/tests/combat.spec.ts (19항목) + combat.fixture.json — World 미기동
        존재 표지    이름·생명·비율 · 쓰러짐 구분 · 토글 없이 항상 실림
        속성 관찰    켜면 남/자기 모두 펼쳐지고 끄면 없다
        타격 숫자    "-55"/"-20" · 고급 스킬 강조 · 자리·시각
        자기 정보    자원 비율 · 이동 모드 문구+코드 · 템포 줄 · 1 이 아닌 배율만 줄
        상호작용     F/G 키 · insufficient-cp → "기력이 모자란다" · Shift 안내
        중복 방지    self.* 는 일반 HUD 줄로 다시 그려지지 않는다

## PLAYABLE (Server + Client 실제 연결 — Chromium)
    절차   `npx tsx server/main.ts` 로 세계를 띄우고 브라우저로 접속해 플레이했다.

    달성한 것
      1. 접속하자마자 모든 몸 위에 이름과 생명 막대가 보인다
         (Player 1 200/200 · Wanderer 1 120/120)
      2. F 로 기본 스킬을 휘둘러 자율 존재를 때리면 그 자리에 "-20" 이 뜨고
         상대 표지가 120/120 → 100/120 으로 줄어든다
      3. 같은 순간 왼쪽 아래 자기 정보의 CP 가 30 → 42 로 찬다 (기본 스킬 충전 +12)
      4. G 를 누르면 상단 HUD 의 행동이 "강공격" 으로 바뀐다
      5. Shift 로 "달리기" 가 되고, 자기 정보에 "기력 충전 배율 ×0.5" 줄이 나타나며
         움직이는 동안 CP 가 줄어든다
      6. V 를 켜면 모든 몸 위에 기력·이동 속도·공속·배율 4종이 펼쳐진다 (남의 것도)
      7. 자율 존재가 나를 때려 내 생명이 200 → 180 → 140 으로 줄어든다
      8. 싸움이 이어지자 자율 존재가 0/120 이 되어 표지가 흐려지고 이름이 붉어졌다.
         그 뒤로는 움직이지도, 다시 맞지도 않는다

    설계대로인 관찰
      쓰러진 몸에는 휘두름이 닿아도 아무 일도 일어나지 않아 타격 숫자가 뜨지 않는다.
      고급 스킬의 "-55" 강조 표시는 Fixture 검증으로 확인했다.

    남은 것   Human Play 확인 (아래 STATUS 참조)

## REGRESSION
    AFFECTED 로 표시한 기존 Rule 전부를 기존 Scenario 로 재실행했다 — 85항목 통과.
      RULE-SWING-STRIKE-001 · RULE-HIT-001    attack.spec.ts (18)  휘두름·접촉·피격 그대로
      RULE-BODY-PUSH/MOMENTUM-001             collision.spec.ts (8) 밀어냄·관성 그대로
      RULE-NPC-DECIDE-001                     npc.spec.ts (5)      배회·접근·휘두름 그대로
      RULE-MINE-001 · MINE-COMPLETE-001       mine.spec.ts (7)     채굴 그대로
      RULE-MOVE-001 · MOVE-PROGRESS-001       move.spec.ts (5)     이동 그대로 (걷기 기본값)
      RULE-ACTION-BEGIN/PROGRESS-001          action.spec.ts (7)   행동 배타·진행 그대로
      RULE-WORLD-TICK-001                     world-tick.spec.ts (9) 진행 순서 그대로
      RULE-OBSERVER-JOIN/LEAVE/MARK-001       observer.spec.ts (26) 참여·이탈·표식 그대로

    전체 269항목 통과 (C001~C006 의 World·View·Server 테스트 전부 포함).
    변경한 기존 테스트는 attack.spec.ts 의 Rule 식별자 3줄뿐이다
    (RULE-ATTACK-001 → RULE-SKILL-BEGIN-001 — 일반화에 따른 이름 변경).

## COMPLETION GATE
    [O] 작은 플레이 가능한 Goal 이 정의되어 있다        01-cycle.md GOAL
    [O] Goal / Possibility 가 존재한다                  02-intent.md (Goal 4 · Possibility 10)
    [O] Intent 가 존재한다                              02-intent.md (Intent 16)
    [O] Intent 의 모든 의미가 State / Rule 로 닫혀 있다 03 SEMANTIC CLOSURE 전 문장 대응
    [O] World State 변화가 World Rule 을 통해서만 발생  Hp 는 STRIKE-DAMAGE/ATTRIBUTE-SET,
                                                        Cp 는 SKILL-BUDGET/CP-RUN-DRAIN/ATTRIBUTE-SET
                                                        만이 바꾼다
    [O] World 는 Authoritative 하다                     Client 는 요청만 한다.
                                                        속성 변경조차 Rule 을 거친다
    [O] GameView Specification 이 존재한다              04-gameview.spec.yaml
    [O] View 는 Spec 외 World 정보를 사용하지 않는다    view/ · app/ 에서 world/ import 0건
    [O] World 는 View 구현 정보를 사용하지 않는다       world/ 에서 view/ import 0건
    [O] World 를 View 없이 검증할 수 있다               world/tests/combat.spec.ts 39항목
    [O] View 를 Fixture 만으로 검증할 수 있다           view/tests/combat.spec.ts 19항목
    [O] Server + Client 연결 시 실제 플레이가 가능하다  위 PLAYABLE 8항목
    [O] Runtime 결과를 Intent 까지 추적할 수 있다       모든 Rule 이 Implements 로 Intent ID 를
                                                        명시하고 protocol/semantic-id.ts 가 식별자를 둔다
    [ ] 인간이 실제 게임에서 Cycle Goal 달성을 확인했다  ← 대기
    [O] 결과를 다음 Cycle 에서 그대로 재사용할 수 있다  Modifier 원천·MutableAttribute·SkillDefinition
                                                        모두 항목을 더하면 늘어나는 구조다

## FAILURES
    없음.

    구현 중 나온 정정 2건 (담당 단계로 반환하지 않고 같은 Cycle 안에서 고쳤다)
      Actor.Name    "관찰자가 밝힌 식별" → 세계 순번.
                    C004 가 "세계 밖 문자열을 이름으로 쓰지 않는다" 를 이미 확정했다.
                    03-world-semantic.md R2 정정.
      out-of-range  C001 의 "너무 멀다" 와 코드가 겹쳐 속성 범위 초과를
                    value-out-of-range 로 나누었다. 03·04 갱신.

## STATUS
    IN PROGRESS — Human Play 확인 대기

    확인 요청 (`./scripts/run.sh` 또는 `npx tsx server/main.ts` 뒤 브라우저 접속)
      1. 몸 위에 이름과 체력이 보이는가
      2. F 로 때리면 "-20" 이 뜨고 상대 체력이 줄며 내 CP 가 차는가
      3. CP 가 30 이상일 때 G 가 나가고, 모자라면 "기력이 모자란다" 가 뜨는가
      4. Shift 로 달리면 빨라지면서 CP 가 새고, 충전 배율 ×0.5 가 보이는가
      5. V 로 남의 속성까지 펼쳐 볼 수 있는가
      6. 자율 존재를 쓰러뜨리면 표지가 흐려지고 더 이상 반응하지 않는가
