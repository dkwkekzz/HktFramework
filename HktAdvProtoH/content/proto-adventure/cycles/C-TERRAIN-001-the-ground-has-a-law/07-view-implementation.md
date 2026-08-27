# C-TERRAIN-001 — View Implementation

## SPEC CONSUMED

    ground.zones                    view/terrain-presentation.ts#groundZonePlans
        법칙별 색·이름 표 → 지면 구역 지시(GroundZonePlan). 04 의 `engine_contract` 형태다
    ground.self.state · law · takes  view/terrain-presentation.ts#groundLawLines
        지금 걸린 법칙의 줄. `sheltered` 를 `none` 과 구분해 낸다
    hud[self.warmth] · [self.warmthMax]  view/terrain-presentation.ts#groundHeldLines
        지닌 열의 줄 — self 패널로 간다 (아래 NOTE 2)
    조립                             view/resolve.ts — self 패널 lines 의 **맨 앞**
    낱말                             view/code-text.ts — heat-binding · taking · sheltered · warmth

    04 의 `interactions: change: NONE` 그대로 — 새 키도 새 요청도 만들지 않았다.
    플레이어가 하는 일은 걸어 들어가고 걸어 나오는 것뿐이며 그것은 이미 있는 행동이다.

## ASSET MAPPING

    없음. 새 sprite 도 새 모션도 없다 — 이 Cycle 이 더하는 것은 **땅 위의 범위**와
    **글자 줄**이고, 둘 다 그림 파일을 요구하지 않는다.

    색만 정한다 (view/terrain-presentation.ts).

        heat-binding  작용하는 자리 0x4a7fb5 (푸른 쪽)   멎는 자리 0xd98b45 (따뜻한 쪽)

    **같은 계열이 아니라 반대 계열을 골랐다.** 예외 자리를 한눈에 못 찾으면 이 Cycle 의
    플레이가 성립하지 않기 때문이다. 멎는 자리는 작고 찾아야 하는 것이라 채움도 테두리도
    더 진하다.

## INPUT → ACTION REQUEST

    없음 — 이 Cycle 은 새 입력을 만들지 않는다.

    걷기(`move`)가 유일한 입력이고 그것은 C002 부터 있던 것이다. 땅을 겪는 것도 멎는
    것도 요청을 지나지 않는다 (INTENT-STANDING-IS-THE-WHOLE-INPUT-001).

## FIXTURE TESTS

    view/tests/terrain.spec.ts      19 tests — 전부 통과 (World 미기동)
    view/tests/fixtures/ground-taking.fixture.json     빙원 안 · 온기 62/100
    view/tests/fixtures/ground-sheltered.fixture.json  해숨구멍 안 · 온기 44/100

        자리마다 지시가 하나씩 나온다 · 범위는 세계가 보낸 값 그대로다
        작용하는 자리와 멎는 자리가 색·진하기·테두리로 갈린다
        멎는 자리는 그 사실이 이름에 있다 (`빙원 — 멎는 자리`)
        intensity 를 싣지 않는다 — 이 Cycle 은 맥동하지 않는다
        **모르는 법칙도 그려진다** — 표현 등록 누락이 게임을 멈추지 않는다
        자리가 없는 세계에서는 지시도 없다 — fallback
        거두는 중이면 무엇을 거두는지가 실린다 (조사가 이름에 맞게 붙는다)
        멎어 있으면 그 사실이 실린다 — 자리 밖과 **같은 화면이 되지 않는다**
        온기는 자리 밖에서도 보인다 — 되채워지지 않으므로 판단의 재료다
        온기를 모르는 옛 스냅샷도 그려진다
        땅의 줄이 self 패널 맨 앞에 온다
        `self.*` 는 가로 띠로 가지 않는다 (C007 규율)

    전체 스위트 79 files · 1369 tests 통과 (Stage 6 의 1350 + 19). 회귀 0.
    `npm run build` 통과.

## 눈검증 — 실제 World 를 돌려 화면 줄을 읽었다

    빙원 가장자리 안쪽(-6, 8)에서 시작해 해숨구멍으로 걸어 들어갔다 나온다.

        시작(빙원 안)      state=taking     온기 100/100 | 빙원 — 열을 거두어 가는 중
        3초 머물렀다       state=taking     온기  88/100 | 빙원 — 열을 거두어 가는 중
        8초 머물렀다       state=taking     온기  68/100 | 빙원 — 열을 거두어 가는 중
        해숨구멍에 들었다   state=sheltered  온기  64/100 | 빙원 — 여기서는 멎는다
        거기서 5초         state=sheltered  온기  64/100 | 빙원 — 여기서는 멎는다
        빙원 밖으로 나왔다  state=none       온기  59/100

    읽히는 것 넷.

        ① 머무는 동안 계속 준다              100 → 88 → 68
        ② 해숨구멍에서 **멎는다**             64 에서 5초가 지나도 64
        ③ 멎는 것과 자리 밖이 다르다          sheltered 는 줄이 있고 none 은 없다
        ④ 되돌아오지 않는다                  나온 뒤에도 59 다 (승인 ②)

    나오는 길에 64 → 59 로 더 준 것은 빙원을 가로질러 걸었기 때문이다 — **나가는 데도
    값이 든다**는 것이 이 땅의 판단을 실제로 만든다.

## NOTES

    1. 지면 구역은 아직 화면에 오르지 않는다 — 결정만 서 있다

       엔진의 `SceneGroundZone` 이 아직 없다 (ENGINE 레인 산출).
       `engine/` 은 팩 작업에서 편집하지 않으므로 이 Stage 는 **지시를 만드는 데까지**
       하고 멈춘다 — design/Design-Terrain-Visualization.md 의 진행 순서 3 이 정한
       그대로이며, fallback(안 그림)이 있어 게임은 돈다.

       `groundZonePlans` 는 04 의 `engine_contract` 형태를 그대로 낸다. 장치가 서면
       `resolve.ts` 가 그 결과를 `SceneState.zones` 로 실어 보내는 **한 줄**이 는다.
       그 한 줄이 없는 지금, 04 요구 분해의 ①② 는 아직 화면에 없고 ③④ 는 서 있다.

       **Stage 8 은 ①② 를 요구한다.** ENGINE 합류 전에는 검증을 닫을 수 없다.

    2. 온기를 가로 띠가 아니라 self 패널에 두었다

       처음에는 `hud-presentation.ts` 에 항목을 더했으나 그것은 **죽은 코드**였다 —
       `self.*` 로 시작하는 id 는 가로 띠로 가지 않고 self 패널이 가져간다는 것이 이
       화면의 규율이다 (C007 · combat-presentation.ts#isSelfHudId). 항목을 걷어내고
       그 자리에 이유를 적어 두었다.

       그래서 온기의 줄은 `terrain-presentation.ts` 가 **이름까지 함께** 지닌다 —
       소지품과 대상 자리가 그렇게 한 것과 같은 자리다 (hud-presentation.ts C022 주석).

    3. 온기는 **자리 밖에서도** 보인다

       법칙의 줄(`groundLawLines`)은 자리 안일 때만 나오지만 지닌 것의 줄
       (`groundHeldLines`)은 늘 나온다. 이 값이 **되채워지지 않기 때문이다**
       (05-review.md 승인 ②) — 빙원에서 40 만 남기고 나온 사람이 자리 밖에서 그것을
       볼 수 없다면 다시 들어갈지를 고를 재료가 없고, 이 Cycle 이 묻는 판단이 바로
       그것이다.

       이것이 04 계약을 넘지 않는다 — `hud[self.warmth]` 는 계약에 늘 실리고, 언제
       보일지는 화면의 결정이다 (DC-WORLD-OWNS-THE-SURFACE-LIST 의 경계).

    4. 땅의 줄이 self 패널 **맨 앞**이다

       지금 무언가가 나에게서 빠져나가는 중이라면 그것이 다른 무엇보다 급한 사실이다.
       자리 밖에서는 법칙의 줄이 아예 없으므로 기존 배치가 밀리지 않는다.

    5. 조사를 문장에 박지 않았다

       거두어 가는 것의 이름은 표에서 온다 (`warmth → 열`). 문장에 `을/를` 을 박아 두면
       다음 법칙이 `숨결` 이나 `이름` 을 거두어 갈 때 문장이 깨진다 — 받침으로 고르는
       한 줄을 두었다. 한글이 아닌 이름(미등록 코드)에는 `를` 을 쓴다.

    6. 이펙트를 더하지 않았다

       땅이 거두어 가는 것은 **사건이 아니라 상태**다 (매 Tick 조금씩 준다).
       `effect-presentation.ts` 의 표 넷은 전부 사건에 걸리는 것이라 이 Cycle 이
       더할 줄이 없다. 예산(EFFECT_SET 7개)도 건드리지 않았다.
       터질 것이 생기는 것은 예고 Cycle 이다 (퍼지는 서리 무늬 · BT §5.4).

## GAP

    없음 — 04 의 계약으로 부족한 것이 없었다.

    다만 **미완이 하나 있다**: 지면 구역의 실제 렌더 (NOTE 1). 이것은 계약의 결손이
    아니라 기반 산출의 미도착이므로 GAMEVIEW GAP 이 아니다. 배차판의 ENGINE 줄과
    충돌표(WORLD·TERRAIN ↔ ENGINE)가 그 자리를 이미 지닌다.
