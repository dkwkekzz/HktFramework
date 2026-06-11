# HWS 공통 UI 엔진 — 패널 스펙

step-0007 부터 각 step 의 HTML 은 **셸**(~12줄)이고, 시뮬 동작은 `step-NNNN/sim-core.js`,
프레젠테이션 구성은 작은 **선언적 패널**(`step-NNNN/panel.js`)에서 온다. 공통 UI(`engine/hws-ui.js`)와
공통 CSS(`engine/hws-ui.css`)는 step 마다 복제하지 않는다.

> **왜**: step-0001~0006 은 step 당 HTML 790줄 중 ~460줄이 sim-core.js 의 *손복사본*(인라인 코어)이고
> UI ~230줄도 ~90% 동일했다. 새로 더해지는 시뮬 로직은 step 당 ~95줄뿐. 엔진 분리로 step 작업은
> "sim-core.js(새 시뮬) + verify.js + 작은 panel.js" 만 쓰면 된다.

## 셸 HTML (step-NNNN.html) — step-0009 부터 3D 셸이 표준

```html
<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">
<title>HWS step-0009</title>
<link rel="stylesheet" href="engine/hws-ui.css">
</head><body>
<script src="step-0009/sim-core.js"></script>   <!-- 새 시뮬 로직. window.HWS9 export -->
<script src="engine/hws-ui.js"></script>          <!-- 공통 엔진. window.HWS -->
<script src="engine/hws-3d.js"></script>          <!-- 3D 레이어. window.HWS3D -->
<script src="step-0009/panel.js"></script>        <!-- 이 step 의 노브·통계. window.HWS_PANEL_0009 -->
<script>HWS3D.bind(HWS.mount(window.HWS9, HWS3D.attach(window.HWS_PANEL_0009)));</script>
</body></html>
```

> 닫힌 step-0007·0008 은 당시의 2D 전용 셸(`HWS.mount(core, panel)` 한 줄) 형태를 그대로 보존한다
> (닫은 step 불변 규칙). 3D 상세는 아래 "3D 뷰" 절.

`file://` 더블클릭에서 동작한다(클래식 `<script src>` 는 file:// 로드 가능 — `type=module`/`fetch` 만 차단됨).
브라우저와 `verify.js` 가 *같은* sim-core.js 를 돌리므로 "문서 수치 = verify 출력" 보증이 강해진다.

## 패널 객체

`HWS.mount(core, panel)` 에 넘기는 `panel` 의 필드:

| 필드 | 타입 | 설명 |
|---|---|---|
| `title` | html | `<h1>` 제목 |
| `subtitle` | html | 부제(`.sub`) |
| `legend` | html | 하단 범례(`.legend`) |
| `overlays` | obj | 표준 오버레이 on/off `{sourceSink,pools,life,centroid,sparkline}`. 기본 전부 true, 데이터 없으면 자동 no-op |
| `poolOpts` | obj | `detectPools` 옵션. 기본 `{minE:1.5,prom:0.3}` |
| `seeds`/`speeds`/`defaultSpeed` | | 시드·속도 셀렉트 덮어쓰기(기본 step-0006 값) |
| `controls` | 행 배열 | 노브. `[{items:[...]}, ...]` — 각 행은 `.ctl` div |
| `presets` | 배열 | **데모/가설 재현 버튼** `[{label, params, seed?, run?, note?, title?}]`. 한 클릭으로 *현상이 보이는 설정*으로 점프(아래 절) |
| `stats` | 배열 | 통계표 행 `[{label, get(ctx)}]` |
| `actions` | obj | 버튼 핸들러 `{name(api){}}` |
| `clickModes` | obj | 캔버스 클릭 모드 `{name(api,x,y){}}` |
| `drawHook` | fn | step 고유 오버레이 `(ctx,{sim,core,SCALE,pools})` |
| `onReset` | fn | 리셋 직후 훅 `(api)` |

### controls 항목 (kind 별)

- **check** `{kind:'check', id, label, param?, def, view?, gateFor?, title?}`
  - `param`: 체크 → `sim.p[param] = checked` (라이브). 예: `drive`,`life`,`repro`,`move`
  - `view:true`: 시뮬 무관, 토글 시 redraw 만. 예: `auto`(자동 명암)
  - `gateFor:'<sliderId>'`: 이 체크가 슬라이더를 게이트(off → 슬라이더 param 을 `gateOff` 로)
- **slider** `{kind:'slider', id, label, param, min,max,step,def, fixed, gateBy?, gateOff?, title?}`
  - `param` 값을 라이브 반영. `fixed`: 표시 소수 자릿수
  - `gateBy:'<checkId>'`: 게이트 체크 off 면 `param = gateOff`(기본 0), on 이면 슬라이더 값. 예: `kA`(agg), `baseCost`(base)
- **select** `{kind:'select', id, label, options:[[val,text],...], def, role?}`
  - `role:'click'`: 캔버스 클릭 모드를 이 셀렉트 값으로 디스패치
- **button** `{kind:'button', id, label, action, title?}` — `actions[action](api)` 호출

### presets — 데모/가설 재현 (가독성 표준)

**왜**: 기본 패널은 회귀 상태(새 노브 off·V 사다리는 D=1)로 열린다 — 그래서 *직전 step 과 화면이 같다*. "설명은 그럴듯한데 시뮬을 보면 뭘 더했는지 모르겠다" 의 구조적 원인이다(4기둥 ①회귀 0 의 그림자). `presets` 는 이 격차를 메운다: **한 클릭으로 이 step 이 더한 현상이 *보이는* 설정으로 점프**한다.

```js
presets: [
  { label: '☀ 별 부력 ON (D=8)',
    params: sunArena(1),    // 전체 createSim 오버라이드 — verify.js 의 가설 시나리오와 *같은* 객체를 쓴다(핵심)
    seed: seedSunCore,      // (선택) 리셋 직후 사용자 시딩 fn(sim, core) — 예: 점화 신호 R 핵
    run: 200,               // (선택) 미리 진행할 tick 수 — 현상이 자라게(별이 천장까지 떠오르도록)
    note: 'E 무게중심 z 가 ~6.36 으로 솟으면 별이 하늘로(=verify sun)',  // (선택) 토스트 한 줄
    title: '...'            // (선택) 버튼 hover 설명 }
]
```

엔진(`applyPreset`)이 ① `createSim(seed, params)` 재생성 → ② `seed(sim, core)` → ③ `run` tick 진행 → ④ **보이는 노브를 params 값에 동기화**(슬라이더·게이트 체크가 움직여 "무슨 설정인지" 드러남, 시뮬 영향 0) → ⑤ `note` 토스트 순으로 처리한다.

**핵심 규약 — verify 와 같은 시나리오를 쓴다**: `params`(+`seed`)를 `verify.js` 의 가설 아레나(`sunArena()`/`seedSunCore()` 등)와 *같게* 두면 **화면이 보여주는 것 = verify 가 단언하는 수치**가 된다(가독성 + 신뢰). 둘이 드리프트하지 않도록 같은 상수·식을 쓴다(예: `comZ`).

**가설 수치 통계(필수 동반)**: 프리셋과 짝으로, verify 의 가설 지표를 `stats` 행으로 화면에 띄운다 — 예: `E 무게중심 z` (verify `sun` 의 `comZ`). 3D 렌더(L-V1 voxel 렌즈)가 닫히기 전엔 z 축 현상이 화면에 안 그려지므로(하이트필드는 z=0 평면만), 이 **수치가 증거**다. 프리셋 ON 을 누르면 통계가 verify 와 같은 값(6.36)으로 솟는 걸 눈으로 확인한다.

**주의**: 프리셋은 *출발점 스냅샷*이다 — 이후 헤더 '리셋'·노브 조작은 컨트롤 값에서 재구성되므로 비-컨트롤 격리(initE 등)는 풀린다(통상 스택으로 복귀). `panel.presets` 가 없으면 데모 행 자체가 안 그려진다(하위호환 — 기존 패널 무영향).

**검증**: `node engine/validate/smoke-preset.js` — 회귀 상태로 열린 패널의 프리셋 버튼을 클릭해 별이 천장까지 떠오르고 E 무게중심 z 가 솟는지(=verify sun 수치) 헤드리스로 단언.

### stats `get(ctx)` 컨텍스트

`ctx = {sim, core, m, led, pools}` (m=`measure`, led=`ledger`). 반환:
- 문자열 → 그대로 표시
- `{text, cls}` → `cls` 로 색(`pass`/`fail`). 예: 장부 잔차 행

### actions/clickModes `api`

`api = {sim, core, W, H, SCALE, val(id), redraw(), toast(msg,ms)}`.
`val(id)` 로 컨트롤 현재값을 읽는다(예: 클릭 셀렉트). 핸들러 후 자동 redraw.

## 새 step 작성법

1. `step-NNNN/sim-core.js` — 직전 step 코어를 잇고 **항 하나** 추가(불변 규칙).
2. `step-NNNN/verify.js` — 회귀·장부·결정론·가설 4기둥 검증(headless).
3. `step-NNNN/panel.js` — **직전 step panel.js 를 복사**해 새 노브 행 1개 + 새 통계 행을 더한다.
   (engine/validate/step-0006.panel.js 가 출발 템플릿.) **`presets` 와 가설 수치 통계도 이번 step 의 현상에 맞게 갱신**한다 —
   직전 step 의 데모 아레나·지표를 *이번 가설*(verify.js 의 새 시나리오)과 같게 바꾼다(위 "presets" 절). 그래야 다음 step 도 "한 클릭으로 보이는" 가독성을 이어받는다.
4. `step-NNNN.html` — 위 **3D 표준 셸**에서 NNNN 만 바꾼다(attach/bind 포함 — 빼지 않는다).

엔진(`hws-ui.js`/`hws-ui.css`/`hws-3d.js`)은 건드리지 않는다. step 이 *완전히 새로운 시각화*를
요구할 때만 `panel.drawHook` 으로 더한다 — 엔진은 안정적으로 둔다.

## 검증

`engine/validate/` 는 엔진이 닫힌 step-0006 을 동일 시뮬로 재현함을 증명한다(닫힌 step 파일 불변):
- `step-0006.html` — 셸 재현(육안 비교)
- `step-0006.panel.js` — step-0006 UI 의 선언적 패널(= step-0007 출발 템플릿)
- `verify-engine.js` — headless: 파라미터 매핑 동일 · 결정론 · 게이트 · 장부 · 3D attach 불변. `node engine/validate/verify-engine.js`

## 3D 뷰 (engine/hws-3d.js — 새 step 셸의 표준)

**step-0009 부터 새 step 셸은 3D 셸(위 "셸 HTML" 절)이 표준이다** — 기본 3D 로 열리고('3D 뷰' 체크로
2D 전환 가능), 조작·관찰 전부 3D 에서 된다. 시뮬은 그대로 — 3D 는 스냅샷을 읽기만 하는 프레젠테이션
레이어다(설계·결정 기록은 [DESIGN-3D.md](DESIGN-3D.md), 왜 WebGPU 가 아닌가 포함).

- **`HWS3D.attach(panel)`** — 패널을 장식해 돌려준다(원본 불변): '3D 뷰' 토글(view 전용 체크 —
  param 없음 → `defaultParams` 매핑 불변, verify-engine ⑤가 증명) + drawHook 체이닝(sim/core 동기화)
  + actions/clickModes 토스트의 HUD 미러.
- **`HWS3D.bind(handle)`** — mount 반환값을 받아 3D 클릭의 redraw 경로를 완성한다(클릭 직후 통계표 갱신).
- **조작**: 좌드래그 회전 · 휠 줌 · Shift/우드래그 팬 · 클릭(이동<5px) = 레이캐스트 → 셀 → 기존
  `clickModes[mode](api, cx, cy)` 그대로 디스패치. **패널은 2D/3D 를 구분할 필요가 없다.**
- **관찰**: 지형 = 열지도의 하이트필드(colorOf 색 램프·'자동 명암' 노브 공유), **저장체 R(step-0008~,
  있으면 자동) = E+R 합산 높이의 호박색 암석 융기**(2D drawHook 와 같은 색 언어), source/sink = 링·emissive
  기둥, 고임 = 링, 생명 = 발광 점(반경 ∝ √m), 무게중심 = 빔, HUD = 스파크라인·토스트·**호버 셀 툴팁**(E·R·m).
  통계표·컨트롤은 DOM 이라 모드 무관.
- WebGL2 불가 환경 → 콘솔 경고 후 2D 뷰로 조용히 폴백.
- 엔진과 같은 불변 규칙: step 이 고유 3D 시각화를 요구해도 `hws-3d.js` 를 건드리지 않는다 — 필요해지는
  시점에 (2D 의 drawHook 처럼) 확장점을 더한다.

3D 검증:
- `node engine/validate/verify-engine.js` — ⑤ attach 전후 `defaultParams` 동일(시뮬 영향 0 기계 증명)
- `node engine/validate/smoke-dom-3d.js` — 장식된 패널의 mount·이벤트·WebGL2 폴백 경로(headless)
- `engine/validate/step-0007-3d.html` — 닫힌 step-0007 의 3D 재현(육안 + 통계표가 2D 셸과 동일)
