# HWS 공통 UI 엔진 — 패널 스펙

step-0007 부터 각 step 의 HTML 은 **셸**(~12줄)이고, 시뮬 동작은 `step-NNNN/sim-core.js`,
프레젠테이션 구성은 작은 **선언적 패널**(`step-NNNN/panel.js`)에서 온다. 공통 UI(`engine/hws-ui.js`)와
공통 CSS(`engine/hws-ui.css`)는 step 마다 복제하지 않는다.

> **왜**: step-0001~0006 은 step 당 HTML 790줄 중 ~460줄이 sim-core.js 의 *손복사본*(인라인 코어)이고
> UI ~230줄도 ~90% 동일했다. 새로 더해지는 시뮬 로직은 step 당 ~95줄뿐. 엔진 분리로 step 작업은
> "sim-core.js(새 시뮬) + verify.js + 작은 panel.js" 만 쓰면 된다.

## 셸 HTML (step-NNNN.html)

```html
<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">
<title>HWS step-0007</title>
<link rel="stylesheet" href="engine/hws-ui.css">
</head><body>
<script src="step-0007/sim-core.js"></script>   <!-- 새 시뮬 로직. window.HWS7 export -->
<script src="engine/hws-ui.js"></script>          <!-- 공통 엔진. window.HWS -->
<script src="step-0007/panel.js"></script>        <!-- 이 step 의 노브·통계. window.HWS_PANEL_0007 -->
<script>HWS.mount(window.HWS7, window.HWS_PANEL_0007);</script>
</body></html>
```

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
   (engine/validate/step-0006.panel.js 가 출발 템플릿.)
4. `step-NNNN.html` — 위 셸에서 NNNN 만 바꾼다.

엔진(`hws-ui.js`/`hws-ui.css`)은 건드리지 않는다. step 이 *완전히 새로운 시각화*를 요구할 때만
`panel.drawHook` 으로 더한다 — 엔진은 안정적으로 둔다.

## 검증

`engine/validate/` 는 엔진이 닫힌 step-0006 을 동일 시뮬로 재현함을 증명한다(닫힌 step 파일 불변):
- `step-0006.html` — 셸 재현(육안 비교)
- `step-0006.panel.js` — step-0006 UI 의 선언적 패널(= step-0007 출발 템플릿)
- `verify-engine.js` — headless: 파라미터 매핑 동일 · 결정론 · 게이트 · 장부. `node engine/validate/verify-engine.js`
