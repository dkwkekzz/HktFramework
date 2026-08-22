# Frontier — COMBAT 트랙

전투(R1 · DT) · 스킬(SK) 도메인의 후보와 지금 도는 것을 담는다. 트랙 규칙과 트랙 간
판단은 [README.md](README.md), 읽는 법은 guides/master-frontier.md 소유다.

    기준 Overlay   master/overlay.md — 전투 사다리는 Critical 층까지, 그 위에 고른
                   대상(C017) · 태도(C018) · 행동 안의 시점(C019)이 얹혔다. 스킬(SK) 주입 반영

## 한눈에 보기

| FR | 기능 | 이것이 무엇인가 | 세계에 없는 것 | 크기 |
|---|---|---|---|---|
| FR-THE-SHAPE-IS-DATA | **휘두름의 모양이 값이 된다** | 기술이 닿는 모양이 코드가 아니라 기술의 정의에 담긴다 | 모양 자체 — 반경 · 각도 · 길이가 코드 상수다 | 작음 |

## 후보

### FR-THE-SHAPE-IS-DATA — 휘두름의 모양이 값이 된다

    이것이 무엇인가    기술이 닿는 **모양**(어디를 · 얼마나 넓게 · 몇을 함께)이 규칙
                       코드가 아니라 기술의 정의에 담긴다. 지금은 모든 기술이 같은
                       궤적을 쓰고, 그 궤적이 코드에 박혀 있다
    세계에 생기는 것    ① 기술 정의가 모양을 지닌다 — 찌르기는 좁고 길게, 횡베기는
                          넓게 (SK-EX §5.2 의 형상)
                       ② 닿는 것을 고르는 판정이 그 모양을 읽는다 — 규칙은 기술
                          이름을 묻지 않는다 (SK §7)
                       ③ 모양이 관찰에 실린다 — 무엇에 왜 닿았는지 설명된다
    이 기능이 아닌 것   **새 실행 형태가 아니다** — 투사체 · 장판 · 광선은 여기 없다.
                       그 셋은 세계에 **몸이 아닌 존재**가 먼저 서야 하고, 그것을
                       요구하는 Possibility 가 아직 없다 (Q35).
                       여럿을 동시에 치는 것 자체가 목적이 아니다 — 모양의 결과로
                       그렇게 될 뿐이다.
                       대상 기준의 갈래를 세우는 일도 아니다 — SK §3 이 그 갈래(자기 · 고른 것 ·
                       방향 · 세계의 한 자리)를 공급했으나, 이 후보가 쓰는 것은 지금
                       세계에 이미 있는 방향 기준 하나뿐이다.
                       새 기술을 여럿 만드는 일이 아니다 — 값이 다른 둘이면 족하다
    이미 있는 것        코드 대조 — 궤적 판정이 이미 한 자리에 있다
                       (`world/semantic/collision.ts` — 휘두른 무기 끝이 훑는 궤적 안의
                       몸만 맞는다). 기술 정의도 이미 값을 지닌다
                       (`world/semantic/combat.ts` 의 `SKILL_DEFINITIONS` — 위력 · 길이 ·
                       구간 경계). C019 가 구간 경계를 전역 상수에서 정의로 내린 것이
                       **이 후보와 똑같은 형태의 선례**다.
                       **없는 것은 모양 자체**다 — 반경 · 각도 · 길이가 코드 상수다
    Playable Result    좁고 길게 찌르는 기술과 넓게 베는 기술이 실제로 다르게 닿는다 —
                       하나는 정면의 먼 것에, 하나는 옆의 여럿에
    Observable Result  기술마다 다른 모양이 관찰에 실리고, 같은 자리에 선 상대가 기술에
                       따라 맞기도 하고 안 맞기도 한다
    Source Goal        MG-EXPLORE-BEIRA
    Source Possibility MP-OUTGROW-THE-OPPONENT 외 — MC-COMBAT-STRIKE 를 요구하는 전투
                       갈래 전부가 이 노드를 지난다
    Missing / Partial  **MC-COMBAT-STRIKE 의 확장** (overlay: IMPLEMENTED).
                       새 Capability 를 세우지 않는다 — 이 후보가 닫는 것은 그 노드에
                       걸린 `DC-SKILL-IS-COMBINATION-NOT-NAME: UNRESOLVED` 다
                       (휘두름의 모양이 아직 규칙 코드에 있다)
    원본 근거          SK §5 (근접 공격 = 접촉) · §7 (규칙은 이름을 묻지 않는다) ·
                       §12 수용 기준 3 · 15 · SK-EX §5.2 (형상) · §8.1 (접촉) ·
                       open-questions Q35 ("휘두름의 모양을 정의로 꺼내는 일이
                       선행 작업이 된다")
    Active Constraints DC-SKILL-IS-COMBINATION-NOT-NAME · DC-SKILL-COMBINE-BEFORE-NEW-FORM ·
                       DC-COMBAT-ONE-FORMULA · DC-COMBAT-PLAYER-CAUSALITY ·
                       DC-WORLD-OWNS-THE-SURFACE-LIST
    Constraint Eval    SATISFIED — 모양을 값으로 내리는 것이 IS-COMBINATION-NOT-NAME 이
                       요구하는 형태 그 자체다. 새 형태를 만들지 않고 파라미터로 푸는
                       것이므로 COMBINE-BEFORE-NEW-FORM 과도 맞는다(SK §6-2 의 정석 사례).
                       피해 공식은 한 글자도 건드리지 않는다(ONE-FORMULA).
                       모양은 결정적이므로 같은 자리·같은 기술이면 같은 결과다
    Why one Cycle      모양을 정의로 내리는 것과 판정이 그것을 읽는 것은 한 몸이다.
                       정의에만 두면 아무 일도 일어나지 않고, 판정만 고치면 읽을 값이 없다
    7 조건             1 **노드 아님 — 기존 노드의 확장이다.** 다만 그 노드에 걸린
                       Constraint 판정이 UNRESOLVED 이므로 결손은 실재한다 ·
                       2 전투 갈래 전부의 바닥을 넓힌다 · 3 실측 가능 · 4 한 Cycle ·
                       5 새 World 규칙(모양이 데이터다) · 6 양립 ·
                       7 이후 모든 전달 형태가 이 형상 축을 재사용한다
    의존               **없다.** 아이템 축과 겹치지 않는다 — 이것이 이 후보를 다른
                       세션에 맡길 수 있는 이유다 (README.md 병렬 규칙)
    Status             PROPOSED

## 추천 순서 (Agent 제안 — 확정은 Human)

후보가 하나다. 작고, 선례가 있고(C019 가 같은 형태로 구간 경계를 정의로 내렸다),
방금 Active 가 된 원칙의 UNRESOLVED 하나를 닫는다.

## SELECTED

```text
없음 — Human 선택 대기
```

## 지금 열 수 없는 것

이유가 사라지면 후보로 올린다. 사유의 근거는 괄호의 자리가 소유한다.
트랙 밖(세계 기반 · 설계 문서 부재 등)의 결손은 [README.md](README.md) 의 같은 절에 있다.

| 기능 / 층 | 무엇이 막고 있는가 |
|---|---|
| **스킬 실행 형태** (MS-SKILL-FORM 의 빈 다섯 칸) | 이제 하나가 막는다 — **그 형태를 요구하는 Possibility 가 없다** (Q35 의 7 조건 2 — OPTIONS 작업이 먼저다). 기획 공백은 SK 최종안이 메웠다: 대상 기준·대상 결정의 갈래(HISTORY Q42 가 기다리던 것)는 SK §3 이, 몸 아닌 존재와 그 관찰 경계(Q44 ①②)는 SK-SP 가, 없는 효과를 미리 두지 않는 규칙(Q44 ③)은 SK-EF 가 공급했고, 자리 자체가 열넷에서 여섯으로 줄어 Q44 ④ 도 해소됐다. 남은 실질 장벽은 하나 — 투사체·장판·설치는 세계에 **몸이 아닌 존재**가 먼저 서야 하고, 그것을 요구하는 Possibility 가 아직 없다 |
| 위협도 · 진영 · 도발 | 막는 것은 없다 (HOSTILITY_REASONS 에 항목 추가로 시작) — 아직 어느 Possibility 도 요구하지 않는다 (7 조건 2) |
| 회피 (MC-EVADE) | R1 §13 이 이후 확장으로만 지정 |

**후보로 올리지 않은 결손 하나**: 기력이 스스로 돌아오지 않는다 (MC-CP-ECONOMY PARTIAL).
어느 상위 갈래를 전진시키는지 근거 문서가 말하지 않아 7 조건 2 를 세울 수 없다 —
밸런스로 다룰지 규칙으로 세울지는 Human 판단이다.
