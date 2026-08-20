# C017 — View Implementation

> 이 Cycle 의 화면 값어치는 **고른 상대의 지금이 한자리에서 읽힌다** 이고,
> 그 한자리는 세계가 아니라 View 가 만든다. 세계가 보장한 것은 짐작 없이 모을 수 있다는
> 것뿐이다 (04 VIEW ASSEMBLY NOTE). 그래서 이 단계가 한 일은 **모으는 결정**이다 —
> 판정은 한 줄도 여기서 하지 않는다.

## SPEC CONSUMED

    currentTarget.entityId          view/target-presentation.ts · view/resolve.ts
                                    고른 존재의 Id 하나. 이 Id 로 entities 를 짚어
                                    이름 · 지금 · 생명을 읽는다 (여기서 값을 만들지 않는다)
    interactions.selectTarget       view/interaction-presentation.ts  'select-target'
                                    키 없음 — 그 몸을 눌러 부른다
    interactions.clearTarget        view/interaction-presentation.ts  'clear-target'
                                    Escape — 대상이 없는 요청이므로 키로 부른다
    interactions.observe (CHANGED)  view/interaction-presentation.ts  'observe-character'
                                    **키가 생겼다** (KeyT). 대상이 사라졌으므로 키로 부를 수 있다
    interactions.mine (CHANGED)     view/interaction-presentation.ts  'mine-deposit'
                                    KeyE 그대로. 이제 광맥마다가 아니라 하나다
    interactions.*.reason           view/code-text.ts — 새 사유 둘의 문구
    entities[*]                     무변경 — 고른 존재에 붙는 표시는 계약에 없다.
                                    tint 로 가르는 것은 View 의 결정이다

## ASSET MAPPING

    변경 없음. 새 sprite 도 새 모션도 이 Cycle 에는 없다.
    고른 존재의 강조는 **색**으로 한다 — `TARGET_TINT = 0xffe066`
    (view/target-presentation.ts). 외곽선·발밑 링은 기반이 그 지시를 갖고 있지 않으므로
    이 Cycle 에서는 만들지 않는다 (01 PREREQUISITE ③ — 기반 트랙의 몫).

## INPUT → ACTION REQUEST

    존재를 클릭        → select-target(그 존재)
                        기반의 규칙 그대로다: "짚은 존재를 대상으로 하는 첫 interaction".
                        이 Cycle 뒤 **존재마다 오는 interaction 은 select-target 하나뿐**
                        이므로 짚으면 고르기가 된다 (조립 확인으로 실측 — 아래)
    지형을 클릭 · WASD → move (무변경)
    E                  → mine (고른 것을 캔다)
    T                  → observe (고른 것을 살펴본다)          ← C017 ADDED
    Esc                → clear-target                          ← C017 ADDED
    F · G · R · Q · Shift · C · V · /  → 무변경

    조립 루트(app/main.ts)는 **한 줄도 고치지 않았다.** 키를 지닌 interaction 을 요청으로
    바꾸는 경로도, 존재를 짚어 요청을 만드는 경로도 이미 있던 것이다 —
    이 Cycle 이 한 일은 그 경로에 실려 갈 계약의 모양을 바꾼 것뿐이다.

## PRESENTATION 결정 (ADDED)

    view/target-presentation.ts (신규)
        TARGET_TINT          고른 존재에 곱할 색. 역할이 정한 색을 이 색이 대신한다 —
                             "지금 고른 하나" 는 역할보다 앞서는 구분이다.
                             자리 비움의 탈색만은 이기지 않는다 (그것은 존재의 상태다)
        targetHudItems()     대상 자리의 줄들. 고른 것이 없으면 `target.none` 한 줄을 남긴다 —
                             "지금은 안 골랐다" 와 "화면이 이 자리를 안 그린다" 는 다르다
                             (C011 · C014 가 세운 태도)
        줄 구성              고른 대상 · 지금 · 생명(있는 존재만) · 살펴보기 · 채집
                             살펴보기·채집은 **늘 띄운다** — 안 되는 이유를 읽는 것이
                             이 자리의 값어치다 (MC-WATCH-TARGET)

    view/hud-presentation.ts     target.* 여섯 항목의 라벨·아이콘
    view/code-text.ts            no-target-selected · target-kind-mismatch ·
                                 select-target · clear-target · stone · available · depleted
                                 target-is-self 의 문구가 자리를 따라 바뀌었다
                                 ("살펴볼 대상이 아니다" → "고를 수 없다")
    view/resolve.ts              고른 존재의 tint · hud 앞의 대상 자리 — 두 자리만 늘었다

## FIXTURE TESTS

    view/tests/target.spec.ts (ADDED — 15 cases)
        currentTarget       없으면 "없음" 한 줄 · 이름 · 이름 없는 존재는 종류로 ·
                            지금과 생명이 계약의 값 그대로 · 생명 없는 존재엔 그 줄 없음
        대상 자리            되는 것 · 안 되는 사유(세계가 준 코드의 문구) ·
                            고르지 않으면 두 줄이 아예 없다 · 소지품보다 먼저 읽힌다
        강조                 고른 존재에만 지목의 색 · 안 고르면 아무도 아니다
        입력                 고르기는 키 없음(존재마다) · Esc · 살펴봄·채집은 하나씩이고
                            대상을 싣지 않으며 각각 키를 지닌다

    FIXTURE 갱신 (17개) — 계약이 바뀌었으므로 Fixture 도 그 모양을 따른다
        currentTarget 추가 · observe/mine 을 하나로 · select-target 을 존재마다 ·
        clear-target 추가 · 광맥에 kind 추가 (세계는 늘 싣는다)
        고른 상태는 각 Fixture 가 검증하려던 것이 유지되도록 골랐다 —
        채집 화면은 광맥을, 살펴봄 화면은 그 상대를 고른 상태다

    REGRESSION (기존 검증을 새 계약으로 다시 통과시켰다)
        observe.spec.ts     "존재마다 있다" 가 **고르기**에 대한 검증으로 옮겨갔다.
                            자기 몸의 사유도 그 자리로 따라갔다
        insight.spec.ts     문턱·사유 그대로. 살펴봄이 하나로 줄어든 만큼만 바꿨다
        combat.spec · resolve.spec  hud 앞에 대상 자리가 붙는 것을 기대값에 반영
        server/tests/world-host.spec.ts  요청 두 개(고르기 → 채집)로 나뉜다

    전체   45 files · 761 passed  (이전 43 files · 717)
    tsc    오류 0
    npm run boundary:check   경계 위반 0
    npm run catalog:check    카탈로그 3원소 정합

## 조립 확인 (실측)

    실제 세계를 띄워 계약 → Render Plan 을 굴리고, 기반의 입력 규칙과 **같은 방법으로**
    짚어 본 결과다 (임시 스크립트 — 커밋하지 않는다. app/ 도 engine/ 도 고치지 않았다).

```text
클릭→요청 deposit-1 : select-target
클릭→요청 npc-1     : select-target
클릭→요청 player-1  : select-target (available false)
고르기 전 대상자리   : [ 고른 대상=없음 ]
키 목록              : KeyT:observe  Escape:clear-target  KeyF:attack  KeyG:skill-heavy
                       KeyR:skill-aura  KeyQ:guard-begin  ShiftLeft:move-mode  KeyE:mine

광맥을 고른 뒤       : 고른 대상=돌 광맥 · 지금=캘 수 있다 ·
                       살펴보기=이 대상에게는 할 수 없다 · 채집=가능
E 로 캔 결과         : 돌 1 / 광맥 남은 양 4

npc-1 을 고른 뒤     : 고른 대상=Wanderer 1 · 지금=대기 · 생명=120 ·
                       살펴보기=가능 · 채집=이 대상에게는 할 수 없다
T 로 살펴본 뒤       : 살펴보기=이미 알고 있다 · 가려진 자리=[]
멀어진 뒤            : 고른 대상=Wanderer 1 (그대로) · 살펴보기=너무 멀다 — 가까이 이동하자
Esc 뒤               : 고른 대상=없음
```

    Cycle Goal 의 문장이 그대로 읽힌다 — 골라 두면 유지되고, 그 상대의 지금이 한자리에서
    갱신되며, 살펴봄과 채집이 그 하나로 나가고, 멀어지면 사유만 바뀐다.

## NOTES

    ① 왜 살펴봄에 키를 두는가 — C014 의 판단을 뒤집은 것이 아니다
       C014 가 키를 두지 않은 이유는 "키에는 대상을 고를 수단이 없고, 가장 가까운 하나
       같은 규칙을 View 가 만들면 세계가 정하지 않은 선택 규칙을 화면이 발명하게 된다"
       였다. **그 이유가 사라졌다** — 대상을 고르는 수단이 세계에 생겼고, 무엇을 살펴볼지는
       여전히 세계가 지닌다. View 는 아무 규칙도 발명하지 않는다.

    ② 왜 대상 자리를 hud 로 만들었는가
       기반의 SceneHudItem(counter · flag · label)은 게임 의미를 모르는 범용 지시다.
       대상 자리에 필요한 것은 줄과 값과 라벨뿐이므로 그것으로 충분하다.
       전용 패널 지시(TG §5.3 focusPanel)는 배치를 더 정교하게 하고 싶을 때의 일이며,
       그것 없이 이 Cycle 의 Goal 이 화면에서 성립한다.

    ③ 판정을 한 줄도 하지 않았다
       `targetHudItems` 는 available 과 reason 을 읽어 문구로 옮길 뿐이다. 거리를 재지도,
       종류를 보고 "광맥은 못 살펴본다" 를 정하지도 않는다 — 그 판정은 전부 세계가 보낸
       사유 코드로 온다 (DC-WORLD-OWNS-THE-SURFACE-LIST).

    ④ 남긴 부채 하나
       외곽선·발밑 링 같은 강조는 기반에 그 지시가 없어 tint 로 대신했다. 같은 역할의
       존재가 여럿일 때 색만으로는 덜 뚜렷하다 — 기반 트랙 커밋(TG §5.3)이 오면
       이 결정 한 줄만 바꾸면 된다 (`view/target-presentation.ts`).
