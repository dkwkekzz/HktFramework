# C011 — TODO

## Human 판정 대기 — Experience Verification

`npm run dev` 로 직접 본다. 그림은 같은 폴더 `shots/` (촬영은 판정하지 않는다 — 기록이다).
검증용 손잡이: `HKT_SPAWN_REGION=<방> HKT_SPAWN="x,z" HKT_NPCS=none npm run dev`.

spec 의 Experience Intent 는 이것이다 —
**Start** 재료는 광맥이다(아이콘이 있고 시작 방에 하나 놓여 있다) · **End** 재료는 숲이 만들고 있는 것이다
(흙 색이 먼저 오고, 그 색은 방향을 가지며, 따라가면 서로 다른 형태의 원천 넷이 서 있다).

```text
X-① 백왕령에 캘 것이 하나도 없고 흙 색도 다르지 않다 — 그것이 결핍이 아니라
    "여기가 안전한 이유와 같은 조건" 으로 읽히는가
    보기: HKT_SPAWN_REGION=WHITE_KING_DOMAIN · 판의 '흙' 줄이 아예 없다
    그림: shots/X-01-no-lineage-here.png                                   판정 [ ]

X-② 숲 가장자리에서 **흙 색이 다른 자리**가 눈에 먼저 들어오는가 — 그리고 그 한가운데
    허물이 모여 있다는 것이 재료 아이콘 없이 읽히는가
    보기: HKT_SPAWN_REGION=FOREST_EDGE HKT_SPAWN="-0.5,6"
    그림: shots/X-02-stain-and-litter.png                                  판정 [ ]

X-③ **걸어가기 전에** 알 수 있는가 — 원천을 지목하면(Alt + 클릭) 그것이 무엇이고
    무엇을 줄 수 있고 왜 지금은 안 되는지가 그 자리에서 읽히는가
    그림: shots/X-03-ask-before-walking.png                                판정 [ ]

X-④ 캔 것이 **재료의 이름**으로 손에 들어오는가 — 그리고 무엇에 쓰는지 아무 데도
    없다는 것이 결손이 아니라 "아직 이 층이 말하지 않는 것" 으로 읽히는가
    보기: HKT_SPAWN="-6.4,6" 에서 E
    그림: shots/X-04-in-hand.png                                           판정 [ ]

X-⑤ 폐허의 더미가 **다른 모습인데 같은 것**임이 캐 보고서 읽히는가 — "이 숲에 계통이
    하나 있다" 는 추측이 이 두 자리만으로 서는가
    보기: HKT_SPAWN_REGION=EXPLORER_RUIN HKT_SPAWN="-5.8,4" 에서 E
    그림: shots/X-05-ruin-spoil.png · shots/X-06-same-material.png         판정 [ ]

X-⑥ 숲 깊은 곳에서 흙의 짙기가 **방향으로** 읽히는가 — 동(광석 지대)·북(거목)은 짙어지고
    서(둥지)는 짙어지지 않는 것이 "저쪽에 무언가 있다" 로 읽히는가
    보기: HKT_SPAWN_REGION=FOREST_DEEP HKT_SPAWN="10,0" 과 "-10,0" 을 견준다
    그림: shots/X-07-direction-east.png · shots/X-08-direction-west.png    판정 [ ]

X-⑦ 핵심부의 노두가 **방 바닥보다 더 짙은 자리 한가운데** 서 있는 것이 보이는가 —
    그 한 단계 차이가 "여기가 원천이다" 로 읽히는가
    보기: HKT_SPAWN_REGION=BIO_ORE_FIELD HKT_SPAWN="2,-6"
    그림: shots/X-09-outcrop.png · shots/X-10-ask-the-outcrop.png          판정 [ ]

X-⑧ 뿌리혹 둘레가 이 세계에서 **가장 짙다**는 것이 다른 방들을 다녀온 뒤에 읽히는가
    보기: HKT_SPAWN_REGION=RED_EYE_TREE HKT_SPAWN="-2,2"
    그림: shots/X-11-root-nodule.png · shots/X-12-ask-the-nodule.png       판정 [ ]

X-⑨ (Play Goal 의 절반) 백왕령 → 숲 가장자리 → 숲 깊은 곳 → 광석 지대·거목을
    **아이콘 없이 흙만 보고** 걸어 이을 수 있는가 — 다섯 방을 실제로 건너 본다
    (촬영이 하지 못한 것이다 — 왕복이 10초 넘어 걷기가 이어지지 않는다)  판정 [ ]

X-⑩ 흔적 다섯 단계가 **눈으로 갈리는가** — 특히 3↔4(광석 지대)와 3↔5(거목)가
    다른 짙기로 보이는가. 갈리지 않으면 값은 데이터라 바로 고칠 수 있다
    (content/view/region-presentation.ts 의 단계별 불투명도)            판정 [ ]
```

## 알려진 부채

```text
원천은 캐도 줄지 않는다 — phase 도 고갈도 없다. 채취 단위(D4)와 캔 자국은 C012 가 함께 세운다.
  그때까지 한 원천에서 무한히 캘 수 있다 (spec Out of Scope 에 밝힌 대로다)
고갈된 원천의 외형과 문구를 재던 fixture 와 검증을 걷었다 (deposit-depleted) — C012 가 되살린다
지목한 판이 **재료의 이름**을 말하지 않는다 — 자연 형태(노두 · 뿌리혹 · 껍질 조각 · 선광 더미)만
  말한다. 그래서 "노두와 뿌리혹이 같은 것" 이라는 이 Play 의 핵심 한 줄이 화면에서 닫히지 않는다.
  세계는 이미 싣고 있다 (entities[].material) — 판의 표가 그 줄을 아직 두지 않았을 뿐이다
흔적의 세기가 Source 의 상태를 따라 흔들리지 않는다 — 지금은 정적 데이터다.
  "원천이 고갈되면 흔적도 옅어진다"(Play §5.2)는 phase 가 서는 C012 의 것이다
원천 넷이 전부 point 다 — 노두가 무너져 그 칸을 막는 것(Play §5.4 ③)에는 area 가 필요하다. C012
촬영이 걷기를 밀지 못한다 — 왕복이 9~19초다 (C010 ①② 와 같은 결손). 그래서 X-⑨ 는 그림이 없다
```

## 다음 Cycle 로

```text
spec 이 침묵해 검증이 판정 방식을 스스로 정한 자리 (T 의 보고)
  · "쓰임이 관찰 결과 어디에도 없다" 는 **원천 entity 의 키 목록**으로 쟀다 — 관찰 계약에 자리가
    늘면 이 단언이 깨진다
  · "원천에서 먼 자리(방 바닥)" 를 **그 방 격자에서 가장 옅은 값**으로 잡았다 — 바닥 흔적이
    extent 를 통째로 덮는 지금의 배치에 기댄다
  · action-busy 는 **채취 중 채취**로만 밟았다 — 이동 중 · 공격 중은 아직 아무 시나리오도 밟지 않는다
  · "흔적을 몇 개의 구역으로 그리는가" 를 **area 하나에 구역 하나**로 잡았다 — 화면이 단계를 합쳐
    그리기 시작하면 그 단언이 깨진다
  · HUD 에 재료 이름이 뜨는 것이 계약인지 폴리싱인지 spec 이 정하지 않았다 (Observable Result 7)
자동으로 놓을 수 없어 Human 실주행으로 넘긴 것 — X-⑨(방을 건너 잇기) · X-⑩(단계가 눈으로 갈리는가)
SceneState 에 미니맵 자리가 없어 "미니맵도 없다"(SPEC-008)를 견줄 대상이 없다 — 지금은 참이지만 무증명
```
