# CYCLE C015 — Verification

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[PASS] Playable        (기계 실측 완료 — Human Play 확인 대기)
[PASS] Regression
[PASS] Catalog         (존재 종류를 추가하지 않았고, 두 종류의 combat 항목만 늘렸다 —
                        catalog:check 정합 확인)

## NEW BEHAVIOR

    같은 상대를 같은 스킬로 친다      → 대부분 20 이 나오다 이따금 40 이 터진다
    터진 타격                        → 계산 경위에 `치명타 ×2 20→40` 이 찍히고
                                      그 숫자가 크게 그려진다
    안 터진 타격                     → 커지기 전과 커진 뒤가 같다.
                                      관찰을 켜면 `치명타 없음 (25%)` 이 나온다
    가능성 0 인 몸의 타격             → `치명타 없음 (터질 리 없다)` —
                                      "운이 없었다" 와 화면에서 갈린다
    가능성을 1 로 올림                → 매번 터진다. 흔들림을 쓰지 않는다
    가능성을 0 으로 내림              → 한 번도 안 터진다. 흔들림을 쓰지 않는다.
                                      **세계가 C013 과 한 톨도 다르지 않다**
    배율을 3 으로 올림                → 터질 때 60 이 나온다. 빈도와 크기가 따로 자란다
    한 휘두름이 둘에게 닿음           → 몸마다 따로 정해진다 (한쪽 20 · 한쪽 40)
    터진 한 방을 막음                → 34 를 마주해 17 이 남고 기력 21 을 치른다
                                      (안 터졌으면 17 을 마주해 9 가 남고 기력 11)
    모르는 상대에게 터짐              → 터진 것은 보이고, 그 상대가 얼마나 자주 터뜨리는지는
                                      여전히 모른다 (combatStats 는 비어 있다)
    자율 존재가 나를 침               → 언제나 17. 내가 맞는 값은 흔들리지 않는다

## WORLD SCENARIO

    실측 경로 — `npx vitest run content/proto-adventure/world` (17 파일 300+38 = 338 tests 통과)

    RULE-CRITICAL-STRIKE-001 · RULE-STRIKE-DAMAGE-001 (CHANGED)
        Before  관찰자 rabbit-swordsman — physicalAttack 40 · criticalChance 0.25 ·
                criticalDamage 2. 대상 wanderer — armor 30 · criticalChance 0
                World.ChanceSeed = 0x5EEDC015 · ChanceCursor = 0
        Input   기본 스킬로 다섯 번
        Rule    RULE-DAMAGE-CALCULATE-001 → RULE-CRITICAL-STRIKE-001 → RULE-GUARD-BLOCK-001
        After   occurred  = [false, false, true, true, false]
                finalDamage = [20, 20, 40, 40, 20]
                ChanceCursor = 5
                (뿌리의 앞자리 0.9331 · 0.2700 · 0.1038 · 0.0875 · 0.6805 —
                 가능성 0.25 이므로 셋째·넷째만 터진다)

    두 끝에서의 결정론
        Before  criticalChance = 0 · ChanceCursor = 0
        Input   여덟 번
        After   occurred 전부 false · finalDamage 전부 20 · **ChanceCursor = 0**
        Before  criticalChance = 1 · ChanceCursor = 0
        Input   여덟 번
        After   occurred 전부 true · finalDamage 전부 40 · **ChanceCursor = 0**
        두 끝을 오가며 2 + 5 + 5 + 1 번 치면 커서는 정확히 3 이다 —
        흔들리는 판정만 흔들림을 쓴다

    계산이 흔들리지 않는다 (criticalChance = 1 에서)
        damageType physical · offenseStat {physicalAttack, 40} · rawDamage 26 ·
        defenseStat {armor, 30} · penetrationStat {armorPenetration, 0} ·
        effectiveDefense 30 · defenseMultiplier 100/130
        → **C010 · C012 · C013 의 값이 한 톨도 다르지 않다.**
        달라진 것은 damageBeforeCritical 20 → finalDamage 40 뿐이다

    막기 (규칙 직접 검증)
        Before  막는 몸 cp 100 · 정면
        Input   55 (안 터짐)   → applied 28 · cpPaid 33
        Input   110 (터짐)     → applied 55 · cpPaid 66
                비율 0.5 도 대가 기준(×0.6)도 그대로다. 마주한 크기만 두 배다
        Before  막는 몸 cp 40
        Input   55  → blocked
        Input   110 → **broken** (applied 110 — 무너지면 부분적으로 막아 주지 않는다)
                무너지는 조건은 한 줄도 바뀌지 않았다

    경계
        raw 0 인 타격이 터짐        → 0 (없는 피해를 증폭이 만들지 않는다)
        armor 100000 에서 터짐      → 1 → 2 (C010 의 하한 1 이 증폭 뒤에도 유지된다)
        criticalDamage 0.5 요청     → value-out-of-range (거절)
        규칙에 0.1 이 새어 들어감    → amplified = 들어온 값 (max(1, …) 가 막는다)

    흔들림의 소유
        같은 뿌리(0x1234ABCD)로 12 대를 두 번 굴림 → 두 이야기가 완전히 같다
        다른 뿌리(0x11111111 / 0x99999999) → 터짐 순서가 다르다
        관찰 결과 JSON 에 `chanceSeed` · `chanceCursor` · `roll` 이 하나도 없다
        움직이고 · 막고 · 살펴보고 · 속성을 바꾸고 · 시간이 흘러도 커서가 그대로다
        (그 뒤 첫 타격이 커서 0 의 흔들림을 읽는 것으로 확인)

## VIEW FIXTURE

    실측 경로 — `npx vitest run content/proto-adventure/view` (13 파일 187+19 = 203 tests 통과)

    critical.fixture.json (세계에서 뽑았다 — 한 휘두름이 둘을 친 순간)
        npc-1 → `-20` · detail 없음 · emphasis false
        npc-2 → `-40` · detail `치명타 ×2 20→40` · emphasis **true**
        같은 휘두름 · 같은 스킬 · 같은 종류의 상대인데 화면이 둘을 구별한다
        관찰을 켜면 npc-1 에 `치명타 없음 (50%)` 이 붙는다
        combatStats 줄 — 관찰자 `치명타 50% · ×2` · wanderer `치명타 터뜨리지 못함`
        hud self 다섯째 줄 — `치명타 50% · ×2` (내 약점 뒤)

    critical-guard.fixture.json (세계에서 뽑았다 — 가능성 1 의 타격을 막은 순간)
        `-17` · detail `치명타 ×2 17→34 · 막음 34→17 · 기력 -21` · guard blocked
        치명타 줄이 막기 줄보다 앞이다 — 숫자에 일어난 일의 순서 그대로다
        이 fixture 의 npc-1 은 살펴보지 않은 상대라 치명타 줄이 **아예 만들어지지 않는다**

    combat.fixture.json (가능성 0 인 몸)
        관찰을 켜면 `치명타 없음 (터질 리 없다)` · hud 에 `치명타 터뜨리지 못함`

## PLAYABLE

    기계 실측 — 04 PLAYABILITY NOTE 의 열 걸음을 세계에 실제로 걸었다.
    (World + View 결정 Layer 를 함께 돌린 일회성 통합 실행. 아래가 그 출력이다.
     항구 검증은 world/tests/critical.spec.ts 와 view/tests/critical.spec.ts 가 소유한다 —
     통합 실행 파일은 view 가 world 를 import 하므로 남기지 않았다. C014 와 같은 방식이다.)

        1  내 hud — `치명타 25% · ×2`
           C013 까지의 화면에는 없던 자리다. 나는 넷에 하나꼴로 두 배를 낸다
        2  자율 존재를 친다 — `-20` · 아무 말도 붙지 않는다 · emphasis false
           관찰을 켜면 `치명타 없음 (25%) · 물리 · 6+20=26 (물리 공격 40)
           ×77%(물리 방어 30 · 관통 0 → 30) = 20`
        3  가능성을 1 로 올리고 친다 — `-40` · `치명타 ×2 20→40` · emphasis **true**
           20 이 두 배가 되었다는 것이 그 자리에 다 있다. 숫자를 견주어 짐작할 필요가 없다
        4  가능성을 0 으로 내린다 — `-20` ·
           관찰을 켜면 `치명타 없음 (터질 리 없다) · … = 20`
           **C013 까지의 그 숫자 그대로이며, 화면이 "운이 없었다" 와 갈라 준다**
        5  배율을 3 으로 올린다 — `-60` · `치명타 ×3 20→60` · hud `치명타 100% · ×3`
           빈도와 크기가 따로 자란다
        6  상대를 살펴본다 — `치명타 터뜨리지 못함`
           살펴보기 전에는 `겨루는 힘 · 나에게 읽히는 방어 · 약점 — 아직 살펴보지 않았다`
           **살펴보기 전에는 저 존재가 터뜨릴 수 있는지조차 몰랐다**
        7  모르는 상대에게 터뜨린다 — `치명타 ×2 20→40` 이 보이는데
           acquainted 는 false 이고 combatStats 는 undefined 다.
           터진 것은 보이고, 얼마나 자주 터뜨리는 몸인지는 여전히 모른다
        8  자율 존재가 터뜨리며 치고 내가 막는다 — `-17` ·
           `치명타 ×2 17→34 · 막음 34→17 · 기력 -21` · guard blocked
           막기의 비율도 대가 기준도 그대로인데 마주한 크기가 두 배다
        9  그 자율 존재가 평소처럼 친다 — `-17` ·
           `치명타 없음 (터질 리 없다) · 물리 · 6+20=26 (물리 공격 40)
           ×67%(물리 방어 50 · 관통 0 → 50) = 17`
           **내가 맞는 값은 흔들리지 않는다** — C007 이래의 체감 기준이 그대로다

    Server + Client 연결
        `npx tsx server/main.ts` → "[world] 세계가 돌기 시작했다 — http://localhost:5180 (ws /world)"
        `npm run build` → tsc 오류 0 · vite build 성공

    Human Play 확인 — 대기 중. 다음 여덟 항목을 사람이 화면에서 확인해야 한다.
        ① 자기 패널에 `치명타 25% · ×2` 가 내 약점 바로 아래 있다
        ② 자율 존재를 여러 번 친다 — 대부분 20 이 뜨다 이따금 40 이 **크게** 뜬다
        ③ 그 40 옆에 `치명타 ×2 20→40` 이 붙어 있다 (속성 관찰을 켜지 않아도)
        ④ 속성 관찰을 켜면 안 터진 타격에도 `치명타 없음 (25%)` 이 나온다
        ⑤ `criticalChance` 를 1 로 두면 매번 터지고, 0 으로 두면 한 번도 안 터진다.
           0 일 때 경위가 `치명타 없음 (터질 리 없다)` 로 바뀐다
        ⑥ `criticalDamage` 를 3 으로 올리면 터질 때 60 이 뜬다
        ⑦ 상대를 살펴보면 그 존재의 치명타 줄이 열린다 (살펴보기 전에는 없다)
        ⑧ 자율 존재에게 `criticalChance` 1 을 주고 막아 보면
           `막음 34→17 · 기력 -21` 이 뜬다 (평소에는 `막음 17→9 · 기력 -11`)

## REGRESSION

    03 SEMANTIC DELTA 의 AFFECTED 를 전부 돌았다.

    RULE-GUARD-BLOCK-001 (C011)
        막기가 남기는 비율 0.5 · 대가 기준 ×0.6(덜어내기 전 값) · 무너짐 조건 —
        셋 다 무변경. `view/tests/guard.spec.ts` 와 `world/tests/guard.spec.ts` 전부 통과
    RULE-DAMAGE-CALCULATE-001 (C010 · C012 · C013)
        `world/tests/damage.spec.ts` · `damage-type.spec.ts` · `penetration.spec.ts` 통과.
        criticalChance 0 에서 물리 20 · 고급 55 · 오라 17 —
        **C010 · C012 · C013 의 실측값 그대로**
    RULE-SWING-STRIKE-001 (C006)
        `collision.spec.ts` 통과. 여럿에게 닿는 구조 무변경 —
        한 휘두름이 둘을 치면 판정도 둘이다
    RULE-NPC-DECIDE-001 (C007)
        `npc.spec.ts` 통과. 자율 존재의 판단 무변경 —
        Critical 을 노리고 고르지 않는다
    RULE-OBSERVE-* · World.Acquaintances (C014)
        `world/tests/observe.spec.ts` · `view/tests/observe.spec.ts` 통과.
        가려지는 항목의 이름은 여전히 셋이고 살펴봄 1.0 초도 그대로다.
        Critical 두 성질이 그 관문 안쪽에 들어갔을 뿐이다
    RULE-ATTRIBUTE-SET-001 (C009)
        `command.spec.ts` 통과. 목록 14 → 16, 거절 사유 4종 무변경
    INTENT-WORLD-OBSERVATION-001
        `observer.spec.ts` · `observer-mark.spec.ts` · `world-tick.spec.ts` 통과.
        세계가 지닌 흔들림은 관찰에 실리지 않는다

    전체 — `npm test` → **41 파일 중 40 파일 · 678 tests 중 677 통과.**
    실패 1건은 이 Cycle 밖이다 (아래 MASTER FEEDBACK · FAILURES).

## MASTER FEEDBACK

    Capability Overlay
        MC-CRITICAL-STRIKE    MISSING → IMPLEMENTED
            근거 이 문서의 WORLD SCENARIO · PLAYABLE.
            "공격이 확률적으로 더 크게 증폭되어 터진다" — 같은 조건 다섯 대에서
            [20, 20, 40, 40, 20] 이 실측된다.
            "발생 확률과 증폭 크기는 Actor 의 성질" — 종류가 정하고(0.25 / 2.0)
            바꾸면 빈도와 크기가 각각 달라지는 것이 실측된다(가능성 1 → 매번,
            배율 3 → 60).
            "발생 여부와 증폭이 계산 경위에 그대로 드러난다" — occurred · chance ·
            multiplier · damageBeforeCritical 넷이 모든 타격에 실리고,
            가능성 0 인 몸과 운이 없었던 몸이 경위만으로 갈린다.

            **다만 "성장·장비로 자란다" 는 부분은 닫히지 않았다.**
            MP-BET-ON-THE-CRITICAL-BLOW 의 `requires.resource`
            ("Critical 성질을 올릴 성장·장비의 원천")가 세계에 없어, 성질을 바꾸는
            경로는 종류 초기값과 디버그 명령뿐이다 (01 SCOPE NOTE 4).
            Capability 자체는 섰고 그 위에 얹힐 것이 남았다.

    Constraint Evaluation
        DC-COMBAT-PLAYER-CAUSALITY (REVISED)    SATISFIED
            예외가 정확히 한 자리다 — ChanceCursor 를 읽는 규칙이 세계에 하나뿐이고,
            움직임·막기·살펴봄·속성 변경·시간 진행 어느 것도 그것을 소비하지 않는 것이
            실측된다. random_hit · random_evade · random_damage 는 여전히 없다.
            `deterministic_resolution_under_same_state` 는 확률의 양 끝에서
            그대로 성립하고(커서조차 흐르지 않는다), 그 밖의 구간에서도
            같은 뿌리 + 같은 순서면 같은 이야기다.
            `explainable_result` — 네 항목으로 "25% 였고 이번엔 터졌고 두 배가 되어
            20 이 40 이 되었다" 가 완전히 읽힌다.
            `observable_cause` — chance 가 모든 타격에 실린다.
        DC-COMBAT-ONE-FORMULA                   SATISFIED
            RULE-DAMAGE-CALCULATE-001 의 코드가 한 줄도 바뀌지 않았다.
            증폭은 그 밖에서 결과값에 걸린다 — R1 핵심 원칙이 이 층에 배정한
            `Critical → Final Damage 를 증폭한다` 한 줄 그대로다.
            우회하는 별도 피해 계산 경로가 생기지 않았다.
        DC-COMBAT-ONE-LAYER-AT-A-TIME           SATISFIED
            Critical 층 하나만 올렸다. 능동 방어도 Aura 도 손대지 않았다.
            `each_layer_playable_standalone` — 가능성 0 에서 세계가 C013 과
            완전히 같다는 것이 실측된다. 아래 층들은 이 층 없이도 서 있다.
        DC-WORLD-OWNS-THE-SURFACE-LIST          SATISFIED
            두 성질과 그 허용 범위(0~1 · 1~100)를 세계가 목록과 함께 싣는다.
            **View 는 가려짐을 다루는 코드를 한 줄도 고치지 않았다** —
            세계가 가리는 값이 늘었는데 화면이 저절로 따라온 것이 이 Constraint 의
            두 번째 측정 가능한 증거다 (첫 번째는 C010 의 "View 코드 변경 0").

    Constraint Candidate
        **CC-WORLD-OWNS-THE-CHANCE** (관찰된 패턴 — 승격 판단은 Human)
            이 Cycle 이 세계에 처음으로 우연을 들이며 세운 형태다.
            ① 우연의 원천은 세계가 지니는 상태다 (밖에서 매번 끌어오지 않는다)
            ② 그 상태는 관찰에 실리지 않는다 (실으면 앞날이 읽힌다)
            ③ 그럼에도 결과는 끝까지 설명된다 (판정의 재료가 아니라 판정의 경위를 싣는다)
            ④ 이미 정해진 일에는 우연을 쓰지 않는다 (확률의 양 끝에서 소비하지 않는다)
            아직 한 Cycle 에서만 나타났으므로 패턴이라 부르기 이르다.
            다음에 흔들림이 필요한 층(Evade · 조우 · 채집 산출 등)이 오면
            같은 형태가 반복되는지 확인할 자리다.

    Master Gap
        없음 — 상위 의미와 어긋난 지점을 발견하지 못했다.

    Master 도구 상태 (이 Cycle 밖 — 위층이 처리할 일)
        `npm test` 의 실패 1건은 `tools/master-graph/tests/graph.spec.ts` 다 —
        `master/graph/GRAPH.md` 가 `graph/*.yaml` 과 어긋나 있다.
        **이 Cycle 이 만든 것이 아니다**: 작업 시작 전 상태(stash)에서도 같은 실패가
        재현되며, 이 Cycle 은 `master/` 를 한 파일도 건드리지 않았다.
        `npm run master:graph` 로 재생성하면 닫히지만, 그것은 Master Layer 의 일이다
        (CLAUDE.md — Cycle Agent 는 `master/` 를 편집하지 않는다).
        함께 보고된 정합 경고 `ORPHAN_CAPABILITY — MC-CUT-ABNORMAL-STRUCTURE 를 요구하는
        Possibility 가 없다` 도 같은 자리다.

## FAILURES

    이 Cycle 의 검증 실패 없음.

    [FAIL] tools/master-graph/tests/graph.spec.ts — 이 Cycle 밖
    Missing   master/graph/GRAPH.md 가 graph/*.yaml 과 어긋나 있다 (재생성물 미갱신)
    Reason    작업 시작 전 상태에서도 재현된다. 이 Cycle 은 master/ 를 편집하지 않았다
    Return To MASTER (Human) — `npm run master:graph` 는 Master Layer 의 작업이다

## STATUS

    IN PROGRESS   — 기계 검증 전 항목 통과. **Human Play 확인 대기.**
                    사람이 위 여덟 항목을 화면에서 확인하면 COMPLETE 로 바꾼다.
