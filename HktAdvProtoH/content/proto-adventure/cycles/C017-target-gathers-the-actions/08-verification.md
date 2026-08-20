# CYCLE C017 — Verification

[PASS] Semantic Closure
[PASS] World Rule Execution
[PASS] Projection
[PASS] View Binding
[PASS] Playable            (실제 Client 로 확인 — 아래 PLAYABLE. Human Play 확인 대기)
[PASS] Regression
[PASS] Catalog

## 실행한 것

```text
npx vitest run          45 files · 761 passed          (C017 이전 43 files · 717)
npx tsc --noEmit        오류 0
npm run boundary:check  경계 위반 0
npm run catalog:check   카탈로그 3원소 정합
```

증가분 44 = world/tests/target.spec.ts 26 + view/tests/target.spec.ts 15 +
observe.spec 계약 3 (고르기로 옮겨간 자리 · 안 골랐을 때의 사유 · 종류 불일치).

## NEW BEHAVIOR

```text
아무것도 고르지 않음   → 살펴봄 · 채집이 no-target-selected 로 거절된다
                        (목록에서 사라지지 않는다 — 사유와 함께 실린다)
존재를 고른다          → 세계가 그 관계를 지닌다. 관찰에 currentTarget 이 실린다
광맥을 고른다          → 채집이 그 광맥으로 나가고, 살펴봄은 target-kind-mismatch 다
멀어진다               → 고른 것은 그대로. 살펴봄·채집의 사유만 out-of-range 로 바뀐다
다가간다               → 같은 자리에서 사유가 available 로 돌아온다
자기 몸을 고르려 한다   → target-is-self 로 거절된다
푼다 (Esc)             → 고른 것이 없는 상태로 돌아간다
고르는 동안             → 명중도 피해도 앎도 위협도 생기지 않는다
```

## WORLD SCENARIO

실측 — `world/tests/target.spec.ts` (26 cases). 아래는 그중 판정의 뼈대다.

```text
RULE-TARGET-SELECT-001
    Before  targetSelections 비어 있음 · currentTarget.entityId 없음
    Input   select-target(npc-1)
    Rule    RULE-TARGET-SELECT-001
    After   currentTarget.entityId = 'npc-1'
    Result  { status: success, rule: RULE-TARGET-SELECT-001 }

    Before  고른 것 없음
    Input   select-target(player-1)        ← 자기 몸
    After   변화 없음
    Result  { failure, reason: 'target-is-self' }

    Before  고른 것 없음
    Input   select-target('없는-것')
    After   변화 없음
    Result  { failure, reason: 'no-such-target' }

고르기는 행동이 아니다
    Before  살펴봄 진행 중 (CurrentAction = observe)
    Input   select-target(npc-2)
    After   CurrentAction 그대로 observe · currentTarget = npc-2
    Result  success                        ← action-busy 에 걸리지 않는다

RULE-TARGET-DIRECTS-THE-ACT
    Before  currentTarget 없음 · 광맥 옆
    Input   mine
    Result  { failure, reason: 'no-target-selected' }

    Before  currentTarget = deposit-1 · 광맥 옆 · 곡괭이 보유
    Input   mine (요청에 targetEntityId: '없는-것' 을 실어 보냄)
    After   CurrentAction = mine(deposit-1)   ← 요청이 실은 대상은 무시된다
    Result  success

    Before  currentTarget = npc-1
    Input   mine
    Result  { failure, reason: 'target-kind-mismatch' }

진행 중인 행동의 대상은 따라다니지 않는다
    Before  currentTarget = deposit-1 · 채집 시작 (남은 양 5)
    Input   select-target(npc-1) → 60 tick
    After   deposit-1 남은 양 4 · currentTarget = npc-1
                                            ← 지목이 바뀌어도 캐던 것은 그 광맥이다

INTENT-TARGET-IS-NOT-AIM-001
    Before  npc-1 의 생명 · 기력 · 행동 · concealed
    Input   select-target(npc-1) → 1 tick
    After   넷 다 그대로. acquainted 여전히 false
    또한    내 몸의 자리가 한 걸음도 움직이지 않는다 (30 tick 동안)

RULE-TARGET-CLEAR-STALE-001
    Before  targetSelections = [{ observer-1 → npc-1 }] · 세계에 npc-1 이 없다
    Input   ruleTargetClearStale(state)
    After   targetSelections = []
```

## PROJECTION

`04-gameview.spec.yaml` 계약대로 산출된다 — 실측 (target.spec.ts · observe.spec.ts).

```text
currentTarget              늘 실린다. 안 골랐으면 entityId 가 없다
interactions.select-target 존재마다 하나 (Actor N + Deposit M)
                           자기 몸에도 실린다 — available false · reason target-is-self
interactions.observe       **하나**. targetEntityId 없음
interactions.mine          **하나**. targetEntityId 없음
interactions.clear-target  하나. 언제나 available
entities                   무변경 — 고른 존재에 표시가 붙지 않는다
hud                        무변경 (대상 자리는 View 가 만든다)
```

항목 수 실측 — 존재 3 + 광맥 1 인 세계에서
`select-target 4 · observe 1 · mine 1 · clear-target 1` (이전: observe 3 · mine 1).

## VIEW FIXTURE

`view/tests/target.spec.ts` (15 cases) — World 미기동, Fixture 만으로 통과.

```text
mining-available.fixture (deposit-1 을 고른 화면)
    → 고른 대상=돌 광맥 · 지금=캘 수 있다 · 채집=가능 ·
      살펴보기=이 대상에게는 할 수 없다 · 생명 줄 없음(광맥이므로)
observe.fixture (npc-2 를 고른 화면)
    → 고른 대상=Wanderer 2 · 생명=계약의 값 · 살펴보기=가능 ·
      npc-2 에만 지목의 색, npc-1 은 역할의 색
combat.fixture (아무것도 고르지 않은 화면)
    → 고른 대상=없음 한 줄만. 살펴보기·채집 줄이 아예 없다.
      어느 존재도 지목의 색을 갖지 않는다
```

## PLAYABLE

세계와 Client 를 실제로 띄우고(`vite` — 세계가 같은 프로세스에서 `ws /world` 로 돈다)
브라우저로 조작한 결과다. 화면에서 읽은 문구를 그대로 옮긴다.

```text
[1] 들어온 직후   고른 대상: 없음
                  키 안내에 "살펴보기: T" · "지목 해제: Esc" 가 뜬다
[2] 광맥을 클릭   고른 대상: 돌 광맥 · 지금: 캘 수 있다 ·
                  살펴보기: 이 대상에게는 할 수 없다 · 채집: 너무 멀다 — 가까이 이동하자
[3] 걸어서 접근   고른 대상 그대로 · 채집: 가능        ← 선택은 유지되고 사유만 바뀐다
[4] E 를 누름     ⛏ Stone: 0 → 1
[5] 존재를 클릭   고른 대상: Wanderer 1 · 지금: 이동 · 생명: 120 ·
                  살펴보기: 가능 · 채집: 이 대상에게는 할 수 없다
                  그 몸이 지목의 색으로 바뀐다 (화면에서 확인)
[6] 상대가 덤빔   살펴보기: 지금 하는 행동이 끝나야 한다   ← 같은 자리에서 갱신된다
[6'] 상대가 멀어짐 살펴보기: 너무 멀다 — 가까이 이동하자
[7] Esc           고른 대상: 없음
[8] 둘이 접속     함께: 2명. A 의 고른 것은 A 의 것이고, B 에게는 없다.
                  **A 의 화면 어디에도 "골라졌다" 는 표시가 없다**
```

Cycle Goal 의 문장이 그대로 읽힌다 — 골라 두면 유지되고, 그 상대의 지금이 한자리에서
갱신되며, 살펴봄과 채집이 그 하나로 나가고, 고르는 것만으로는 아무 일도 일어나지 않는다.

### 브라우저로 끝까지 못 본 것 하나 (사실대로)

**T 로 살펴봄을 완주하는 장면**은 실제 Client 에서 잡지 못했다. 이 세계의 자율 존재는
인지 범위에 든 상대를 쫓아와 치고(RULE-NPC-DECIDE-001) 또 스스로 순찰하므로, 살펴봄이
시작되면 곧 `action-busy`(맞아서 끊김) 또는 `out-of-range`(상대가 걸어감)가 된다.
**C017 의 결함이 아니라 이 세계가 이미 가지고 있던 동역학**이며, 오히려 사유가 그 자리에서
갱신되는 것이 화면으로 확인되었다 (위 [6] · [6']).

살펴봄이 고른 것으로 나가 **완주해서 앎이 남는 것**은 다른 두 자리에서 실측되었다.

```text
world/tests/observe.spec.ts   35 cases — 고르고 살펴보면 세 자리가 열린다 (전부 통과)
조립 실측 (Stage 7 07)        가만히 있는 존재로 굴린 결과:
                              살펴보기=가능 → (T) → 살펴보기=이미 알고 있다 ·
                              가려진 자리 [] (셋이 다 열렸다)
```

## REGRESSION

`03-world-semantic.md` 의 AFFECTED 를 모두 돌았다.

```text
RULE-OBSERVER-JOIN-001 / LEAVE-001
    떠났다 돌아오면 몸·가진 것·하던 행동이 이어진다             observer.spec ✓
    떠나도 하던 채집은 세계의 시간대로 끝난다                    observer.spec ✓
RULE-WORLD-TICK-001
    요청은 도착하고 나서 판정된다 · 도착 순서대로               world-tick.spec ✓
    지목이 매 Tick 저절로 풀리지 않는다                         target.spec ✓
RULE-ATTRIBUTE-SET-001
    밖에서 값을 바꾸는 손은 자기 대상을 따로 지목한다 (무변경)   command.spec ✓
RULE-OBSERVE-FORGET-001
    되돌려도 고른 것은 풀리지 않는다 (서로를 읽지 않는다)        observe.spec ✓
RULE-DOWNED-001
    쓰러진 존재도 고른 채로 남는다                              target.spec ✓
Command Catalog
    명령 목록의 모양이 바뀌지 않았다                            command.spec ✓
```

과거 Cycle Scenario 재실행 — 전부 통과.

```text
C001 채굴          도구·거리·남은 양의 판정과 결과 무변경        mine.spec 7 cases ✓
C002 행동          행동 하나 · 진행도 · 대체 가능 여부 무변경     action.spec ✓
C004 관찰자별 투영  둘이 **같은 것을 고른 채로** 가용성이 갈린다   observer.spec ✓
                   (이 Cycle 로 오히려 세진 검증이다)
C006~C013 전투     피해·방어·관통 계산 한 자리도 바뀌지 않았다    damage/guard/
                                                                penetration/damage-type ✓
C014 살펴봄        시간·거리·중단·앎의 장부 무변경                observe.spec 35 cases ✓
C015 흔들림        난수 자리 무변경 (지목은 흔들림을 쓰지 않는다) critical.spec ✓
C016 통찰          문턱 셋과 부분 공개 무변경                     insight.spec 27 cases ✓
```

**계산이 한 자리도 바뀌지 않았다는 것**이 이 Cycle 의 Regression 핵심이다 —
전투·앎·성장 검증이 전부 손대지 않은 채 통과했고, 바뀐 것은 대상을 어디서 얻는가뿐이다.

## CATALOG

존재 종류를 더하거나 바꾸지 않았다. `npm run catalog:check` — 3원소 정합.

## MASTER FEEDBACK

### Capability Overlay

```text
MC-DESIGNATE-TARGET   MISSING → IMPLEMENTED
    근거   이 문서의 WORLD SCENARIO (RULE-TARGET-SELECT-001 · CLEAR-001 · CLEAR-STALE-001)
           와 PLAYABLE. overlay 가 적은 결손 셋이 모두 닫혔다 —
           ① 고른 관계 그 자체        World.TargetSelections (관찰자별 · Id 만)
           ② 살펴봄/채집이 함께 쓰는 것  두 Rule 이 요청이 아니라 그 관계에서 대상을 읽는다
           ③ 대상이 사라졌을 때의 정리  RULE-TARGET-CLEAR-STALE-001
    단서   ③ 은 **플레이로 도달하지 않는다** (아래 Master Gap 없음 항목의 주 참조).
           규칙과 단위 검증은 섰고, 플레이 확인은 존재가 사라지는 경로가 생기는
           Cycle 의 몫이다

MC-WATCH-TARGET       PARTIAL → IMPLEMENTED
    근거   PLAYABLE [2][3][5][6][6'] — 고른 상대의 지금 값과, 그에게 지금 무엇이 되고
           무엇이 왜 안 되는지가 **한자리에서 계속 갱신된다.** overlay 가 적은 결손
           ("조각들이 고른 대상 하나로 모이는 자리")이 닫혔다.
           사유가 사라지고 행동만 회색으로 남는 형태가 아니다 — 문구로 온다

MC-OBSERVE            PARTIAL 유지 (변화 없음)
    이 Cycle 은 살펴봄의 대상을 어디서 얻는지만 바꿨다. 남은 결손(행동·습성 = MC-PREDICT
    자리)은 그대로다
```

### Constraint Evaluation

```text
DC-TARGET-IS-INTENT-NOT-AIM     SATISFIED
    prohibits 세 줄이 모두 지켜졌다 — 실측 근거:
      · 지목에 따른 피해·명중·치명 보정 없음
        → 전투 검증 전부 무변경 통과 (damage · critical · penetration · guard)
        → target.spec: 고른 뒤 대상의 생명·기력·행동·concealed 가 그대로다
      · 자동 이동·자동 사거리 진입·자동 추적 없음
        → target.spec: 고른 뒤 30 tick 동안 내 자리가 한 걸음도 움직이지 않는다
        → 진행 중인 행동은 시작할 때의 대상을 끝까지 지닌다 (지목을 따라가지 않는다)
      · 지목만으로 가려진 정보가 열리지 않음
        → target.spec: 고른 뒤에도 acquainted false · concealed 그대로
    requires 도 지켜졌다 — 성공 여부는 여전히 거리·상태·닿음이 정하고(PLAYABLE [2]→[3]),
    실패는 언제나 관찰 가능한 사유로 돌아오며, 지목은 관찰자마다 따로 성립하고
    대상은 골라졌다는 이유로 달라지지 않는다 (PLAYABLE [8])

DC-WORLD-OWNS-THE-SURFACE-LIST  SATISFIED
    무엇을 고를 수 있는가와 고른 상대에게 무엇이 되는가의 목록·사유를 세계가 싣는다.
    View 는 판정을 한 줄도 하지 않는다 — `targetHudItems` 는 available 과 reason 을
    문구로 옮길 뿐이며 거리도 종류도 스스로 보지 않는다 (07 NOTES ③).
```

### Constraint Candidate

```text
CC-THE-CHOICE-IS-THE-OBSERVERS-OWN   (관찰된 반복 패턴 — 승격 판단은 Human)
    관찰자에게 매달리는 세계의 사실이 이번으로 셋이 되었다.
        C004  어느 몸이 내 몸인가        Observer.ActorId
        C014  무엇을 아는가              Acquaintances (ObserverId → 알게 된 Id 들)
        C017  누구를 고르고 있는가        TargetSelections (ObserverId → 고른 Id)
    셋 다 같은 모양으로 섰다 — **세계가 지니되 관찰자별로 갈리고, 담는 것은 Id 뿐이며,
    "없음" 을 따로 저장하지 않고, 대상 쪽에는 아무것도 적지 않는다.**
    C017 은 이 모양을 새로 발명하지 않고 C014 의 것을 그대로 가져왔고, 그때 판단할 것이
    하나도 남지 않았다 — 이것이 패턴이 굳었다는 신호로 보인다.
    값어치: 다음에 관찰자별 사실이 생길 때(대화 상대 · 파티 · 표식) 그 자리에서
    "대상 쪽에 적을까" 를 다시 묻지 않게 된다. 대상 쪽에 적는 순간 위협도가 된다.

CC-A-GATE-MOVES-WITH-ITS-MEANING     (관찰된 패턴 — 승격 판단은 Human)
    이 Cycle 에서 사유 코드 둘(`target-is-self` · `no-such-target`)이 살펴봄에서
    고르기로 **자리를 옮겼다.** 뜻은 한 글자도 바뀌지 않았고 문구만 그 자리를 따라갔다.
    C014 가 "왜 자기는 못 하는지도 세계가 말한다" 로 세운 태도가 새 관문에서도 유지되었다 —
    관문이 옮겨갈 때 사유를 잃지 않는 것이 규율일 수 있다. 다만 사례가 하나뿐이다.
```

### Master Gap

```text
없음 — 상위 의미와 어긋난 지점이 없다.
```

주(註) — Gap 은 아니지만 위층이 알아야 할 사실 둘.

```text
① RULE-TARGET-CLEAR-STALE-001 은 플레이로 도달하지 않는다
   존재가 세계에서 사라지는 경로가 0건이다 (쓰러져도 · 바닥나도 · 관찰자가 떠나도 남는다).
   규칙은 섰고 단위 검증도 섰으나 플레이 확인은 없다. 존재를 없애는 개념이 오는 Cycle
   (전리품 · 소멸 · 지역 이동)이 그 확인을 함께 가져간다.

② 기반 트랙 커밋(HISTORY Q28(a))은 이 Cycle 의 선행 조건이 아니었다
   Stage 1 이 "없으면 Stage 6·7 을 못 연다" 고 적었으나 Stage 4 의 코드 대조가 그것을
   정정했고, Human 이 그대로 진행을 결정했다 (05-review.md). 이 Cycle 은 `engine/` 을
   한 줄도 편집하지 않고 닫혔다. 그 커밋의 값어치는 남아 있으며 자리가 셋이다 —
   지형 클릭의 결정 · 존재마다 오는 interaction 이 둘이 될 때 · 외곽선 강조.
   앞의 둘은 다음 Cycle 이 밟을 수 있는 부채다.
```

## FAILURES

없음.

## STATUS

    IN PROGRESS — 기계 검증 7항 전부 통과. **Human Play 확인 대기.**

    사용자가 실제로 플레이하여 아래를 확인하면 COMPLETE 로 바꾼다.

```text
1. 존재나 광맥을 클릭하면 화면 위 "고른 대상" 줄이 그것으로 바뀐다
2. 그 상태로 멀어지면 "채집/살펴보기" 줄이 사유로 바뀌고, 다가가면 다시 "가능" 이 된다
   — 이때 고른 대상은 풀리지 않는다
3. E(채집) · T(살펴보기)가 고른 상대로 나간다. 아무것도 안 고르면 "먼저 대상을 고르자"
4. Esc 로 풀면 "고른 대상: 없음" 으로 돌아간다
5. 고르는 것만으로는 아무 일도 일어나지 않는다 — 상대가 달라지지도, 다가가지도 않는다
```
