# V-021 — 조립이 눌림과 손짓을 갈라 보내는 자리

    목표        ① 팩이 같은 코드에 바인딩을 둘 이상 둘 수 있다
                ② 바인딩이 **사양**할 수 있고, 사양하면 그 눌림이 세계로 흐른다
                ③ 조립이 표면 손짓을 **표면 이름 없는 자리 하나**에게 넘긴다
    바뀐 표면    `Esc` 로 걸어 둔 것을 놓는 길 (V-020 이 못 닫은 절) —
                그 밖에는 화면이 달라지지 않는다. **얼개를 바꾼 작업이다**
    이전 → 지금  아래
    검증        아래
    계약 diff    없음 (world/ · protocol/ 무변경)

**이 한 바퀴는 레인을 셋 건넜다** — 기반(`engine/`) · 조립(`app/` · `content/active-view.ts`) ·
팩(`view/`). Human 지시로 세 결손을 한 번에 풀기로 했기 때문이다 (works.md 의 한 레인
= 한 세션에서 벗어난다). 세 결손은 V-018·V-020 이 REPORT 로 올린 것들이다.

## 무엇이 막혀 있었나

```text
① 같은 코드의 키를 둘 이상 등록할 수 없다   조립이 KEY_BINDINGS.find 로 **첫 하나**만 불렀다.
   (V-018 REPORT ②)                     표면이 둘이 되자 ↑ ↓ 를 표면마다 둘 수 없어
                                        팩이 한 함수 안에서 갈라야 했다
② 바인딩이 사양할 수 없다                 KeyBinding.invoke 가 아무것도 돌려주지 않았다.
   (V-020 REPORT ①)                     팩이 `Escape` 에 규칙을 얹는 순간 세계의
                                        지목 해제(clear-target)가 죽었다
③ 표면 손짓의 수신자가 모듈 하나다          content/active-view.ts 가 다섯을
   (V-018 REPORT ①)                     `inventory-workspace` 에서 재수출했다.
                                        표면이 둘이 되자 소지품 모듈이 남의 표면까지 갈랐다
```

## 무엇을 세웠는가

```text
engine/view-kernel/input/bindings.ts   (기반)
    KeyBinding.invoke -> boolean | void   돌려주는 값이 곧 "이 눌림을 가져갔는가" 다.
                                          아무것도 안 돌려주면 가져간 것 (예전과 같다) ·
                                          false 면 사양
    dispatchKey(bindings, code, scene, send) -> boolean
                                          같은 코드를 등록 차례대로 묻고 사양하지 않은
                                          첫 바인딩에서 멈춘다. 아무도 안 가져가면 거짓

app/main.ts                            (조립)
    두 자리(표면이 열렸을 때·아닐 때)가 모두 dispatchKey 를 쓴다. 가져가지 않으면
    그 눌림은 그대로 세계의 interaction 으로 흐른다

content/proto-adventure/view/surface-dispatch.ts   (팩 — 새 파일)
    표면 손짓 다섯(칸 한 번·두 번·목록 청함·줄·글자)을 어느 표면의 것인지만 보고 넘긴다.
    **판단이 없다.** 표면이 셋째가 되어도 조립은 바뀌지 않는다

content/active-view.ts                 (조립)
    다섯을 surface-dispatch 에서 재수출한다 (inventory-workspace 가 아니라)

content/proto-adventure/view/bindings.ts           (팩 — 새 얼개를 쓴다)
    logAxis / workspaceKey    표면마다 자기 바인딩을 두고 **닫혀 있으면 사양한다**
    armedRelease              `Esc` — 걸린 것이 있으면 놓고, 없으면 사양한다
```

## 이전 → 지금

    걸음                          이전                          지금
    U 로 걸어 두고 Esc            걸린 줄이 그대로 선다          걸린 줄이 사라진다
    걸린 것 없이 Esc              지목 해제가 나간다             그대로 나간다 (사양했으므로)
    ↑ ↓ (되짚는 자리가 열림)      팩이 한 함수에서 갈랐다        되짚는 자리의 바인딩이 가져간다
    ↑ ↓ (소지품이 열림)           〃                            소지품 바인딩이 가져간다
    ↑ ↓ (둘 다 닫힘)             아무 일도 없었다               둘 다 사양 → 세계로 흘러 이동
    표면 줄 눌림                  소지품 모듈이 갈랐다            surface-dispatch 가 가른다

## 검증

**검사** — `dispatchKey` 의 성질 다섯을 새로 세웠다
(`engine/view-kernel/tests/key-dispatch.spec.ts`): 안 돌려주면 가져간 것 · 사양하면
다음이 묻는다 · 가져간 데서 멈춘다 · 전부 사양하면 거짓 · 코드가 다르면 아예 안 묻는다.
검사 88 files / 1571 tests (이전 87 / 1566). 경계 위반 0.

**눈으로** — 실제 Client 를 띄워(1280×900 · `HKT_SPAWN=-10,-8`) 밟았다. 페이지 오류 0.

```text
③ U        걸림: 배분        ← 걸린 줄이 선다
④ Esc      걸림: 없음        ← **놓인다** (V-020 이 못 닫은 절)
⑦ →        소지품 링 use-item
⑧ ↓        소지품 링 equip-item   ← 소지품의 ↑ ↓ 가 그대로 듣는다 (회귀 없음)
⑩ ↓        기록 링 strike:npc-1>player-1:heavy-attack@8.823
                              ← 같은 코드의 바인딩 둘이 표면별로 갈린다
```

**직접 보지 못한 것 — 사양한 `Esc` 가 세계로 흐르는 것을 눈으로 확정하지 못했다.**
지목을 클릭으로 잡지 못해(다섯 자리를 짚었으나 `고른 대상: 없음` 이 그대로였다)
"지목이 풀린다" 를 화면에서 보이지 못했다. 대신 **세계로 나간 요청 수**로 갈음했다:

```text
걸음                                    보냄
① 시작                                  7
② Esc (걸린 것 없음)                     11    +4
③ Esc (걸린 것 없음)                     15    +4
④ U   (세계로 안 나가는 손짓)              17    +2   ← 바닥
⑤ Esc (걸린 것을 놓는다 — 안 나간다)        19    +2   ← 바닥과 같다
⑥ Esc (걸린 것 없음)                     22    +3
```

걸린 것을 놓는 `Esc` 는 바닥만큼만 늘고, 걸린 것이 없는 `Esc` 는 더 는다. 방향은
맞지만 **한 걸음에 한 요청으로 정확히 대응시키지는 못했다** — 바닥에 다른 오감이 섞인다.

## REPORT

**① 조립(`app/` · `content/active*.ts`)은 어느 레인의 것인지 정해져 있지 않다.**
`guides/works.md` 의 레인 표에 ENGINE 은 `engine/`, VIEW 는 `view/`·`works/`, PROCESS 는
`guides/`·`tools/`·스킬로 적혀 있고 **조립은 어느 줄에도 없다.** 이번 작업이 그 자리를
고쳐야 했고, 규칙이 없어 기반 트랙의 일로 보고 진행했다 (경계 검사는 `content/active*.ts`
를 assembly 로 분류한다 — content 가 아니다).

되풀이될 자리다. **PROCESS 레인의 일**이다 — Frontier 재료가 아니다.

세계 관찰의 결손은 없다.
