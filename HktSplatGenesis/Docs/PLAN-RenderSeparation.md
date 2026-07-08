# PLAN — 렌더러 경계 정리 (환경=정적 / 캐릭터=동적)

상태: **구현 완료** (조정층 + 디렉터리 분리). 목표·원칙은 [../CLAUDE.md](../CLAUDE.md), 현황은
[ROADMAP.md](ROADMAP.md), 구조·결정 근거는 [DESIGN.md](DESIGN.md). 이 문서는 이미 물리적으로
갈라진 두 렌더러(무대/생명)의 **경계를 형식화**하고, 그 사이 회색지대(식생 승격·톤 공유)의
소유권과 데이터 계약을 정돈한 설계다. GPU 파이프라인·셰이더는 **건드리지 않았다** — 순수 리팩터.

## 구현 요약 (완료)

- **조정층**: `js/render-director.js`(RenderDirector) 도입 — app.tick 에 흩어져 있던 env↔life 배관
  (heightfield bake·스트림·승격 제외·sky/fog 톤 미러·프레임 시퀀싱·버블 gridCenter)을 한 소유자로.
  app.tick 렌더 본문은 `director.updateOpenWorld(camera)` + `director.frame(...)` 로 축약. 의존성
  주입(engine·getStage·heightfield)이라 전역 직결 회피.
- **승격 계약 단일 원본**: `scatter.PROMOTE_CFG`(Object.freeze, cell 3.4·maxSlope 2.2·jitter 0.8) —
  vegetation·app ScatterStream 하드코딩 제거(§2.① 해소).
- **디렉터리 분리**: `js/` 를 렌더 영역별로 물리 분리 —
  `js/life/`(캐릭터=동적, WebGPU: math·heightfield·wgsl·engine·genome·skeleton·anim·presets),
  `js/env/`(환경=정적, Spark: terrain-gen·world-profile·stage·vegetation),
  `js/shared/`(공유 계약: scatter), `js/`(합성 루트: app·editor·render-director).
  index.html·editor.html 스크립트 경로 + test 하니스(require·인라인 script src) + tools require 갱신.
- **검증(회귀 0)**: node — world-promote 6/6·world-life 9/9·world-genome·world-profile 14/14·
  world-extract 3/3. browser — app-smoke 오류 0·editor-shot OK·openworld-shot OK(판정 baseline 동일).

## 1. 왜 (문제 정의)

이 프로젝트는 이미 **2층 세계**로 렌더러가 갈라져 있다 (DESIGN 「무대는 로드, 생명은 배양」).

| 층 | 렌더러 | 캔버스 | 내용 | 렌더 특성 |
|---|---|---|---|---|
| **환경(정적)** = 무대 | Spark (WebGL2) | 아래 | 지형 타일·수면·하늘 돔·**Bake 식생** | 로드/생성 · 명암을 f_dc 에 한 번 구움 · 시뮬 안 거침 |
| **캐릭터(동적)** = 생명 | 자체 WebGPU | 위(알파 합성) | 시뮬 풀 스플랫 전부 | 매 프레임 sim→sort→EWA · 속성 셰이더 유도 |

경계의 **큰 골격은 존재**하지만(`app.js` tick: `stage.frame(...)` → `engine.frame({background: 투명})`),
그 경계를 **누구도 소유하지 않는다**. `app.js tick` 이 두 렌더러 사이의 사실상 통합 지점이 되어,
회색지대 배관(식생 승격 훅·톤 미러·카메라 미러)이 렌더 루프 본문에 흩어져 있다. 그 결과:

- **암묵적 3자 계약**이 코드 세 곳에 흩어진다 (아래 §2.①) — 깨지면 조용한 no-op(이중 그리기).
- 새 회색지대(예: 캐릭터↔환경 상호작용, 강등 크로스페이드)를 추가할 때 **끼워 넣을 자리가 없다**.
- `app.js tick` 이 렌더 조정 로직으로 비대해져, 렌더 경계의 계약이 문서(DESIGN 함정)에만 있고
  코드에는 단일 원본이 없다.

이 문서는 경계에 **명시적 소유자**를 주고, 회색지대 계약을 **단일 원본**으로 모으는 것을 제안한다.

## 2. 엉킴 지점 정밀 진단 (분리할 내용)

### ① 식생 승격 계약 — 3자 암묵 합의 (핵심 통증)

같은 나무가 원경에선 Bake(정적·무대), 근접하면 8슬롯 시뮬로 승격(동적·생명)된다 (W-Q2c).
이중 그리기를 막으려면 **승격된 스폰의 Bake 사본을 빼야** 하고, 그 제외는 승격 key 가 Bake
후보 key 와 **정확히 일치**할 때만 실효한다. 지금 이 정합은 세 곳이 **같은 상수**를 쓰기로 한
암묵 합의로 성립한다:

- `js/vegetation.js:135,149` — `bakeTile`/`bakePanorama` 가 `{ cell: 3.4, maxSlope: 2.2, jitter: 0.8 }`.
- `js/scatter.js:72` — `candidates(...cfg)` 가 그 cfg 로 스폰 테이블을 뽑고 `excludeKeys` 로 거른다.
- `js/app.js:388` — `startOpenWorld` 의 `ScatterStream` opts 가 **같은** cell/maxSlope/jitter 를
  줘야 승격 key ⊆ Bake key 가 보장된다 (DESIGN 「승격 훅」 함정: cell 이 다르면 제외가 조용한 no-op).

배관은 `app.js:448-456` tick 이 매 bake 주기 `stream.promotedKeys()` → `stage.setVegExclusion(keys)`
로 잇고, `stage.js:352-360` 이 서명이 바뀔 때만 근접 링(ring 0) 식생 타일을 다시 굽는다
(`rebakeTileVeg` → `vegetation.bakeTile(..., {excludeKeys: vegExclude})`).

**문제**: 계약 상수(cell/maxSlope/jitter)의 단일 원본이 없다. 세 곳 중 하나만 바뀌면 승격 정합이
깨지되 컴파일·런타임 에러 없이 **이중 그리기 또는 팬 누수**로만 드러난다.

### ② 톤(sky/fog) 단일 원본의 미러 배선

무대가 sky/fog 톤의 원본(`stage.js:169 setSkyFog`/`getSkyFog`), 생명은 렌더 FS 로 같은 톤을
소비한다 (DESIGN 「무대 fog = clear 색, 생명 fog = 렌더 FS」). 방향(무대→생명)은 옳지만, 미러
배관이 `app.js:496` tick 에 있다 — `const fog = (stageOn && st.tiledMode) ? st.getSkyFog() : null`
→ `engine.frame({fog})`. 즉 "두 층이 같은 톤으로 만난다"는 계약의 실행 지점이 렌더 루프 본문이다.

### ③ 카메라 뷰 미러

무대·생명이 **투영 행렬을 공유하지 않고**(클립 규약이 다르다, DESIGN) 뷰 파라미터만 각자 받는다.
`app.js:491` `st.frame(camera, ...)` 과 `app.js:502` `engine.frame({view, proj})` 가 같은 `camera`
에서 각각 유도한다. 이건 올바른 격리지만, **두 소비 지점이 app 에 흩어져** 있어 "한 카메라를 두
렌더러가 미러한다"는 사실이 코드에 명시되지 않는다.

### ④ 시뮬 바닥·버블 (환경→생명 단방향 입력)

무대(지형)는 생명에게 **heightfield 로만** 알려진다 (DESIGN S2). `app.js:447-461` tick 이 카메라
타깃을 따라 `engine.setHeightfield(bakeFn(world.height))` 를 굽고, `gridCenter: engine.bubbleCenter`
로 버블을 지형에 추종시킨다. 이것도 환경→생명 단방향 계약인데, 승격 훅과 같은 tick 블록에 섞여 있다.

### ⑤ (참고·비목표) RENDER 셰이더 내부의 env-creature ↔ character 혼재

`wgsl.js` RENDER 셰이더 하나가 나무·불·슬라임·골렘 + 살 휴머노이드를 전부 그리고, 캐릭터 전용
장치(`rest` binding 6·`boneGroup` 7·`groupColors` 8)가 `if (E.fleshK > 0.0)` 분기로 얹혀 있다
(`wgsl.js:657-661`). 이는 **동적 층 내부**의 분리 축이라 이번 「렌더러 경계 정리」의 대상이 아니다
— §6 에서 별도 트랙으로 남긴다.

## 3. 설계 원칙

1. **경계는 데이터 계약이다** — 무대는 로드/생성, 생명은 배양(절대 원칙, 불변). 두 렌더러는 서로의
   내부를 모르고, **명시된 계약**(카메라 미러·톤·heightfield·승격 제외)으로만 만난다.
2. **회색지대는 한 소유자를 가진다** — 승격(정적↔동적 식생 핸드오프)은 두 렌더러 어디에도 속하지
   않는 **다리(bridge)**가 소유한다. 계약 상수는 그 다리의 단일 원본.
3. **`app.js tick` 은 렌더 조정을 하지 않는다** — 입력(카메라·시간·게놈·입력축)만 모아 조정 계층에
   넘기고, 렌더러 간 배관은 조정 계층 안으로 들어간다.
4. **순수 리팩터** — GPU 파이프라인·셰이더·버퍼 레이아웃·바이트 계약 무변. 기존 하니스 픽셀 회귀 0.

## 4. 제안 구조

`app.js tick` 에 흩어진 배관을 **세 파사드 + 한 다리**로 모은다. 전부 classic `<script>` 전역
네임스페이스 컨벤션(빌드 스텝 없음)을 따른다.

```
                    ┌─────────────────── RenderDirector (조정층) ───────────────────┐
  camera/time  ───▶ │  frame(ctx): 입력을 모아 두 파사드에 미러 + 다리를 돌린다        │
  genes/input       │                                                                │
                    │   ┌── EnvironmentRender (정적 파사드) ──┐   ┌── LifeRender ──┐  │
                    │   │  stage.js 래핑                       │   │ engine.js 래핑 │  │
                    │   │  · 지형 타일·수면·하늘·Bake 식생      │   │ · 시뮬 풀      │  │
                    │   │  · 입력: 카메라 타깃·월드 게놈        │   │ · 입력: 카메라 │  │
                    │   │  · 출력: getSkyFog() (톤 원본)        │   │   genes·bones  │  │
                    │   └──────────────────────────────────────┘   │   fog·height   │  │
                    │                    ▲  톤·heightfield          └────────────────┘  │
                    │   ┌────────────────┴─ VegetationBridge (다리) ─────────────────┐  │
                    │   │  · 승격 계약 상수(cell/maxSlope/jitter) 단일 원본           │  │
                    │   │  · stream.promotedKeys() → env.setVegExclusion() 소유       │  │
                    │   │  · heightfield bake·버블 추종도 여기(환경→생명 단방향 입력) │  │
                    │   └────────────────────────────────────────────────────────────┘  │
                    └────────────────────────────────────────────────────────────────────┘
```

- **EnvironmentRender** (`js/env-render.js`, 신규 얇은 파사드): `stage.js` 를 감싸 "정적 세계"의
  단일 창구가 된다. `startTileWorld`/`updateTileCenter`/`setVegExclusion`/`getSkyFog` 를 노출.
  stage.js 자체는 거의 무변(파사드가 호출 순서·계약만 정리).
- **LifeRender** (`js/life-render.js`, 신규 얇은 파사드): `engine.js` 를 감싸 "동적 배양"의 단일
  창구. `frame({genes,entities,bones,fog,gridCenter,camera})`·`setHeightfield`·`respawnEntity` 노출.
  engine.js 무변.
- **VegetationBridge** (`js/veg-bridge.js`, 신규): 회색지대 소유자. **계약 상수**
  (`PROMOTE_CFG = {cell:3.4, maxSlope:2.2, jitter:0.8}`)를 **단일 원본**으로 export 하고,
  vegetation·scatter·app 이 각각 하드코딩하던 값을 여기서 참조하게 바꾼다. 매 bake 주기
  `stream.promotedKeys()` → `env.setVegExclusion()` 을 이 다리가 돌린다. heightfield bake·버블
  추종(§2.④)도 환경→생명 단방향 입력이므로 여기 둔다.
- **RenderDirector** (`js/render-director.js`, 신규): `app.js tick` 이 부르는 유일한 렌더 함수.
  카메라·시간·입력을 받아 ① 환경 파사드 frame ② 톤/heightfield/승격을 다리로 잇기 ③ 생명 파사드
  frame 을 **정해진 순서**로 실행. `app.js tick` 은 입력 수집 + `director.frame(ctx)` 로 얇아진다.

### 핵심 계약을 코드로 승격

지금 DESIGN 함정 주석에만 있는 계약을 **실행 가능한 단일 원본**으로:

```js
// js/veg-bridge.js (발췌 — 제안)
const PROMOTE_CFG = Object.freeze({ cell: 3.4, maxSlope: 2.2, jitter: 0.8 });
// vegetation.bakeTile / scatter.candidates / ScatterStream 이 전부 이 상수를 참조 →
// "승격 key ⊆ Bake key" 정합이 세 곳 하드코딩이 아니라 한 상수로 강제된다.
```

`vegetation.js:135,149` 의 인라인 `{cell:3.4,...}` 기본값과 `app.js:388` 의 ScatterStream opts 가
`window.HktGenesisVegBridge.PROMOTE_CFG` 를 참조하게 바꾸면, §2.① 의 "세 곳이 어긋나면 조용한
no-op" 위험이 구조적으로 사라진다.

## 5. 마이그레이션 단계 (구현은 후속 세션)

작은 순수 리팩터로 쪼갠다 — 각 단계는 기존 하니스로 회귀 0 을 증명한 뒤 다음으로.

- **M1 — 계약 상수 단일 원본**: `PROMOTE_CFG` 를 `veg-bridge.js`(또는 임시로 `vegetation.js`
  export)로 올리고 vegetation·scatter opts·app ScatterStream 이 참조. 가장 값싸고 위험 낮음.
  검증: `test/world-promote.js`(승격 key ⊆ Bake key) 무회귀.
- **M2 — VegetationBridge 추출**: `app.js:448-456` 의 승격 훅(promotedKeys→setVegExclusion)과
  `app.js:447-451,460` 의 heightfield bake·버블을 다리 객체로. app tick 은 `bridge.update(camera)` 호출.
  검증: `test/openworld-shot.js`(지형·수면·나무·하늘톤 한 프레임) 무회귀.
- **M3 — 톤 배선을 조정층으로**: `app.js:496` 의 `fog = st.getSkyFog()` 미러를 director 로.
  검증: `test/world-water-shot.js`(하늘밴드 톤 정합) 무회귀.
- **M4 — 파사드 + RenderDirector**: EnvironmentRender/LifeRender 파사드로 stage/engine 호출을
  감싸고, `app.js tick` 렌더 본문을 `director.frame(ctx)` 한 줄로. 카메라 미러(§2.③)가 director
  안에서 명시적. 검증: `test/app-smoke`·`editor-shot`·`openworld-shot` 전부 무회귀.

각 단계 끝에서 DESIGN 의 해당 함정 주석을 "계약이 코드 단일 원본으로 이동함"으로 갱신한다.

## 6. 비목표 (이번 축 아님)

- **RENDER 셰이더 내부 분리**(§2.⑤ env-creature ↔ character 경로) — 동적 층 내부 축. 별도 제안:
  캐릭터 전용 바인딩(rest/boneGroup/groupColors)을 살 개체 전용 파이프라인/BindGroup 으로 격리.
  C6~C7·R1~R4 캐릭터 확장이 공유 셰이더를 오염시키기 시작하면 착수.
- **정적 스플랫 버퍼 분리** — Bake·승격 안 된 정적 생명에 sim+bitonic 을 건너뛰는 별도 상주 버퍼를
  주는 성능 최적화. 지금은 정적은 이미 Spark(무대)가 그리므로(시뮬 풀 안 거침) 급하지 않음.
- **강등 크로스페이드** — 승격 v0 는 하드컷(경계 팝 허용, W-Q2c). 다리가 생기면 크로스페이드를
  얹을 자리가 명확해지지만, 이번 정리의 범위 밖.

## 7. 완료 기준 (이 제안이 채택될 때)

- `app.js tick` 렌더 본문이 입력 수집 + `director.frame` 로 축약되고, 렌더러 간 배관(승격·톤·
  heightfield·카메라 미러)이 조정층/다리로 이동.
- 승격 계약 상수(cell/maxSlope/jitter)가 단일 원본이 되어 세 곳 하드코딩 제거.
- `test/openworld-shot`·`world-promote`·`world-water`·`app-smoke`·`editor-shot` 픽셀/판정 **무회귀**
  (순수 리팩터 증명).
