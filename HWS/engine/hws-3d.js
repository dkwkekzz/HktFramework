/* HWS 3D 프레젠테이션 레이어 — 2D 엔진(hws-ui.js) *옆에* 놓이는 WebGL2 뷰. 설계: engine/DESIGN-3D.md
 *
 * 원칙: 시뮬 동작은 전적으로 sim-core.js 에서 오고, 이 레이어는 스냅샷을 *읽기만* 한다(서버 권위의
 *   브라우저판). hws-ui.js 는 한 줄도 바꾸지 않는다 — 통합은 공식 확장점 둘만 쓴다:
 *   ① attach(panel): 패널을 장식해 돌려준다(원본 불변). drawHook 체이닝으로 sim/core 참조를 받고,
 *      '3D 뷰' 토글(view 전용 체크 — param 없음 → createSim 파라미터 매핑 불변)을 더한다.
 *   ② bind(handle): HWS.mount 반환값({sim,reset,draw})을 받아 3D 클릭 디스패치의 redraw 경로를 완성한다.
 *
 * 셸: HWS3D.bind(HWS.mount(window.HWS8, HWS3D.attach(window.HWS_PANEL_0008)));
 *
 * 내부 2층 (WebGPU 경첩 — DESIGN-3D.md D2):
 *   - 장면 동기화층: sim 스냅샷 → E 텍스처/에이전트 인스턴스/오버레이 라인 버퍼 (GL 무관)
 *   - GL 백엔드: 지형(하이트필드)·생명(발광 점)·라인 3개 프로그램. 갈아탈 땐 이 층만 교체.
 *
 * 조작: 좌드래그 회전 · 휠 줌 · Shift/우드래그 팬 · 클릭(이동<5px) = 레이캐스트 → 셀 → 기존
 *   panel.clickModes[mode](api, cx, cy) 그대로 디스패치(패널은 2D/3D 를 구분하지 않는다).
 * 관찰: 표준 오버레이의 3D 등가물(지형=열지도, 링=source/sink/고임, 빔=무게중심, 점=생명) +
 *   HUD(투명 2D 캔버스: 스파크라인·토스트·호버 툴팁). 통계표는 DOM 이라 모드 무관.
 *
 * 시뮬 tick 과 렌더 프레임은 분리: 3D 는 자체 rAF 로 돌며 *현재* sim 을 읽는다(일시정지 중에도
 *   카메라가 부드럽다). E 업로드는 4096 float = 무시할 비용이라 매 프레임 갱신.
 *
 * voxel 확장 경첩(DESIGN-3D.md D4): 필드 업로드·픽킹·높이 함수가 한곳에 모여 있어, 이후 step 이
 *   E 를 W×H×D 로 확장하면 (하이트필드→볼륨) 백엔드만 바꾼다 — attach/bind/클릭 규약은 불변.
 *
 * WebGL2 불가 환경: 콘솔 경고 후 2D 뷰 그대로(3D 는 조용히 비활성). 브라우저(file:// 더블클릭) 전용 —
 *   Node 에서는 attach/bind 가 순수 함수로만 동작(검증: verify-engine.js ⑤, smoke-dom-3d.js).
 */
(function (global) {
  'use strict';

  var CV_SIZE = 640;                 // 3D 캔버스 한 변(px). 2D(512)보다 약간 크게 — 원근 압축 보상
  var HS = 9.0;                      // 높이 스케일(세계 단위) — h = HS·log(1+E)/log(1+sat) (레거시 하이트필드 뷰 전용)
  var VOX_SCALE = 0.46;              // voxel 큐브 반변(L-V1) — <0.5 라 칸 사이 약한 틈 = 벽돌감
  var COL = {                        // 2D 오버레이와 같은 팔레트 (hws-ui.css)
    border:   [0.227, 0.259, 0.314], // #3a4250
    src:      [0.435, 0.808, 0.541], // #6fce8a
    snk:      [0.878, 0.439, 0.439], // #e07070
    pool:     [0.341, 0.839, 0.878], // #57d6e0
    centroid: [1.000, 0.373, 0.816], // #ff5fd0
    hover:    [0.941, 0.816, 0.376]  // #f0d060
  };

  /* ── 싱글톤 상태 (페이지당 mount 1개 — 2D 엔진과 같은 전제) ── */
  var S = {
    panel: null, ov: null,           // attach 가 받은 원본 패널·오버레이 플래그
    sim: null, core: null,           // drawHook 동기화로 받는 현재 참조
    handle: null,                    // bind 가 받은 mount 핸들
    dom: null, gl: null,             // DOM 묶음·WebGL2 컨텍스트
    cam: { yaw: -0.65, pitch: 0.95, dist: 95, fov: 45 * Math.PI / 180, tx: 0, tz: 0, cx: 31.5, cy: 0, cz: 31.5 },
    hover: null,                     // 호버 셀 {x,y}
    msg: '', msgUntil: 0,            // HUD 토스트
    popHist: [], lastTick: -1,       // 개체수 스파크라인(틱 단위 샘플)
    pools: [], poolTick: -1,         // 고임 캐시(틱 단위)
    failed: false                    // WebGL2 불가/오류 → 2D 로 폴백
  };
  var R = null;                      // GL 리소스 (initGL 에서)

  /* ════════ 셸 통합 표면 ════════ */

  function attach(panel) {
    S.panel = panel;
    S.ov = Object.assign({ sourceSink: true, pools: true, life: true, centroid: true, sparkline: true }, panel.overlays || {});
    var p = Object.assign({}, panel);
    p.controls = (panel.controls || []).concat([{ items: [
      { kind: 'check', id: 'view3d', label: '3D 뷰', def: true, view: true,
        title: 'WebGL2 3D 뷰 ↔ 2D 캔버스 전환. 프레젠테이션 전용 — 시뮬·검증에 영향 없음.' },
      { kind: 'check', id: 'worldview', label: 'voxel 세계(2분할)', def: true, view: true,
        title: '오른쪽에 voxel 세계 뷰를 나란히(L-V1) — R 점유 칸을 인스턴스드 큐브로(높이=sim-z, 렌더러가 발명 0). 에너지(E)는 색 밝기: 흐르는 E(고활성)=발광·고인 E(저활성)=파란 물 voxel. 왼쪽=에너지 변위(레거시 2.5D 하이트필드, z=0 바닥 슬라이스). 설계: VOXEL.md §4. 프레젠테이션 전용.' }
    ]}]);
    var origHook = panel.drawHook;
    p.drawHook = function (ctx, info) { sync(info); if (origHook) origHook(ctx, info); };
    /* actions/clickModes 의 toast 를 HUD 에도 미러 — 3D 뷰에서도 버튼·클릭 피드백이 보이게 */
    if (panel.actions) {
      p.actions = {};
      Object.keys(panel.actions).forEach(function (k) {
        p.actions[k] = function (api) { return panel.actions[k](mirrorToast(api)); };
      });
    }
    if (panel.clickModes) {
      p.clickModes = {};
      Object.keys(panel.clickModes).forEach(function (k) {
        p.clickModes[k] = function (api, x, y) { return panel.clickModes[k](mirrorToast(api), x, y); };
      });
    }
    return p;
  }

  function bind(handle) { S.handle = handle; return handle; }

  function mirrorToast(api) {
    return Object.assign({}, api, { toast: function (m, ms) { api.toast(m, ms); hudToast(m, ms); } });
  }
  function hudToast(m, ms) { S.msg = m; S.msgUntil = now() + (ms || 2500); }

  /* drawHook 동기화 — 매 엔진 draw 마다: 참조 갱신 + 시드 리셋 감지 + (첫 호출) DOM/GL 초기화 */
  function sync(info) {
    if (info.sim !== S.sim) {        // 리셋 → 새 sim 객체: 히스토리·캐시 비움
      S.sim = info.sim;
      S.popHist = []; S.lastTick = -1; S.poolTick = -1; S.pools = []; S.hover = null;
    }
    S.core = info.core;
    if (S.failed) return;
    if (!S.dom) {
      try { initDom(); } catch (e) { fail('3D 초기화 실패: ' + e.message); }
    }
    applyVisibility();
  }

  function fail(msg) {
    S.failed = true;
    if (global.console && console.warn) console.warn('[HWS3D] ' + msg + ' — 2D 뷰로 진행');
    if (S.dom) { S.dom.cv.style.display = ''; S.dom.wrap.style.display = 'none'; }
  }

  /* ════════ DOM 구성 ════════ */

  /* 레이아웃 override — hws-ui.css 의 `.row{display:flex}` 를 명시 가로 배치로 고정해 *입력 패널을 시각화 우측*에 둔다.
   * 두 상태 뷰포트(에너지 변위·세계 해석)는 캔버스를 *세로로* 분할해 좌측 위·아래로 적층한다(render/ensureCanvasSize).
   * 분할 캔버스가 폭 640 한 뷰포트라 패널을 오른쪽에 둬도 밀리지 않는다(과거 1280px 가로분할 때문에 패널을 아래로
   * 내렸던 제약이 세로분할로 풀렸다). hws-ui.css 는 불변(D5)이라 파일을 고치지 않고 3D 레이어가 스타일 1줄을 주입한다.
   * 멱등: id 로 중복 주입 방지. */
  function injectLayoutCSS() {
    var doc = global.document;
    if (!doc || byId('hws3d-css')) return;
    var st = doc.createElement('style');
    st.id = 'hws3d-css';
    st.textContent = '.row{flex-direction:row;align-items:flex-start;}';
    (doc.head || doc.body || doc.documentElement).appendChild(st);
  }

  function initDom() {
    var doc = global.document;
    var cv = byId('cv');
    if (!doc || !cv || !cv.parentNode) { S.failed = true; return; }
    injectLayoutCSS();                                      // 입력 UI(.panel)를 시각화 아래로 — .row 세로 적층
    var wrap = doc.createElement('div');
    wrap.style.position = 'relative';
    var glcv = doc.createElement('canvas');
    glcv.width = CV_SIZE; glcv.height = CV_SIZE; glcv.style.display = 'block';
    var hud = doc.createElement('canvas');                 // HUD — 텍스트·스파크라인은 2D API 로
    hud.width = CV_SIZE; hud.height = CV_SIZE;
    hud.style.position = 'absolute'; hud.style.left = '1px'; hud.style.top = '1px';
    hud.style.pointerEvents = 'none'; hud.style.background = 'transparent'; hud.style.border = 'none';
    wrap.appendChild(glcv); wrap.appendChild(hud);
    cv.parentNode.insertBefore(wrap, cv.nextSibling || null);
    S.dom = { cv: cv, wrap: wrap, glcv: glcv, hud: hud, hctx: hud.getContext('2d') };
    var gl = glcv.getContext ? glcv.getContext('webgl2', { antialias: true }) : null;
    if (!gl) { fail('WebGL2 사용 불가'); return; }
    S.gl = gl;
    initGL();
    initInput();
    if (global.requestAnimationFrame) global.requestAnimationFrame(frame);
  }

  function isView3d() { var el = byId('view3d'); return el ? !!el.checked : true; }
  function isWorld() { var el = byId('worldview'); return el ? !!el.checked : true; }   // 2분할 세계 해석 뷰 on/off

  function applyVisibility() {
    if (!S.dom) return;
    if (S.failed) { S.dom.cv.style.display = ''; S.dom.wrap.style.display = 'none'; return; }
    var on = isView3d();
    S.dom.cv.style.display = on ? 'none' : '';
    S.dom.wrap.style.display = on ? '' : 'none';
  }

  /* ════════ 렌더 루프 (시뮬 tick 과 분리 — 일시정지 중에도 카메라 생동) ════════ */

  function frame() {
    applyVisibility();
    if (S.gl && !S.failed && S.sim && isView3d()) {
      try { render(); } catch (e) { fail('3D 렌더 오류: ' + e.message); }
    }
    global.requestAnimationFrame(frame);
  }

  function render() {
    var gl = S.gl, sim = S.sim, p = sim.p, W = p.W, H = p.H;
    ensureGrid(W, H);
    /* ── 동기화층: E,R,G,A → RGBA32F 텍스처 (W·H×4 float — 매 프레임 갱신해도 무시할 비용) ──
     * r=E(흐름량), g=R(저장체), b=G(유전형 태그, step-0015~. 없으면 0 → 무유전), a=A(활성도 throughput, step-0014~. 없으면 0).
     * a 채널은 세계 해석 뷰의 분류 다이얼(빛/생명력) — 에너지 변위 뷰는 a 를 안 읽으므로 과거 렌더 불변. */
    var E = sim.E, Rf = sim.R || null, Gf = sim.G || null, Af = sim.A || null;
    var WH = W * H, D = p.D || 1, N = E.length;             // voxel 격자(VOXEL V1): N=W·H·D. z=0 평면 == 첫 W·H 칸
    S.cam.cy = (D - 1) / 2;                                 // 카메라 수직 타깃 = 세계 중간 높이(D=1 → 0 = 기존 프레이밍)
    var e32 = R.e32, mx = 0, mxR = 0, mxA = 0;
    /* 1패스: 전역 포화점은 *전 볼륨*(전 z) 기준 */
    for (var i = 0; i < N; i++) {
      var v = E[i];
      if (v > mx) mx = v;                                   // 자동 명암 포화점은 2D 와 동일하게 E 기준(전 볼륨)
      if (Rf && Rf[i] > mxR) mxR = Rf[i];                   // 저장체 색 포화점은 R 분포에 적응(step 마다 농축도 다름)
      if (Af && Af[i] > mxA) mxA = Af[i];                   // 활성도 발광 포화점은 A 분포에 적응(소산만 높은 끝 — A_burn/A_store≈26)
    }
    /* 좌측 '에너지 변위' 텍스처 = *칼럼 투영*(z 축 최대) — D>1 에선 z=0 바닥 슬라이스 대신 칼럼별 최대 E·R 을 위에서 내려다본다.
     * 과거 z=0 슬라이스는 부력을 거꾸로 보였다(별이 z 로 떠오르면 z=0 이 비어 하이트필드가 *낮아*져 "가라앉은" 듯). 칼럼 최대는
     * *어느 높이에든* 에너지가 있으면 그 칼럼을 세우므로 역전이 사라진다(에너지 스카이라인). 이렇게 좌측 뷰를 숨기지 않고 살린다 —
     * 동역학(흐름·확산)은 이 열지도에서 가장 또렷하다. G·A 태그는 칼럼 대표 셀(E+R 최대 z)에서 취한다.
     * D=1 이면 z 가 하나뿐이라 z=0 슬라이스와 비트 동일(회귀 0). */
    for (var j = 0; j < WH; j++) {
      var mE = 0, mR = 0, repK = -1, repG = 0, repA = 0;
      for (var zz = 0; zz < D; zz++) {
        var ci = j + zz * WH, ev = E[ci], rv = Rf ? Rf[ci] : 0;
        if (ev > mE) mE = ev;
        if (rv > mR) mR = rv;
        if (ev + rv > repK) { repK = ev + rv; repG = Gf ? Gf[ci] : 0; repA = Af ? Af[ci] : 0; }
      }
      e32[j * 4] = mE; e32[j * 4 + 1] = mR; e32[j * 4 + 2] = repG; e32[j * 4 + 3] = repA;
    }
    var autoEl = byId('auto');                              // 2D 와 같은 '자동 명암' 노브 공유
    /* 포화점을 목표값으로 지수 평활(EMA) — 강한 흐름 구배(기복 step-0009)에서 maxE 가 tick 간 출렁이면
     * 그 한 점 진동이 화면 전체 밝기·높이 스케일을 떨게 한다. 평활로 체감 떨림을 죽인다(시뮬 불변 — 색·높이
     * 정규화 상수일 뿐). 실제 추세(서서히 밝아짐/어두워짐)는 따라간다. */
    var satTarget = (autoEl && autoEl.checked) ? (mx > 1 ? mx : 1) : 8;
    R.sat = R.sat > 0 ? R.sat + 0.06 * (satTarget - R.sat) : satTarget;
    /* 저장체 호박색 포화점 — 이 세계의 maxR 기준 정규화. step-0008(농축 R~5)이든 step-0009(기복으로
     * 얇게 펴진 R~3)이든 강한 퇴적이 항상 또렷. R 없는 step(0007)은 mxR=0 → satR floor 로 무영향(g=0). */
    R.satR = mxR > 1.5 ? mxR : 1.5;
    /* 활성도 발광 포화점 — 이 세계의 maxA 에 적응(평활). A 없는/꺼진(kFlux=0) step 은 mxA≈0 → floor 로 무발광. */
    var satTargetA = mxA > 1e-6 ? mxA : 1e-6;
    R.satA = R.satA > 0 ? R.satA + 0.06 * (satTargetA - R.satA) : satTargetA;
    gl.bindTexture(gl.TEXTURE_2D, R.tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RGBA, gl.FLOAT, e32);
    /* ── voxel 인스턴스 빌드(L-V1·L-V2·L-V3) — *R 점유 + 의미있는 E* 셀만 큐브 1개로(빈칸=void=생략).
     * L-V2: 불투명(고체·빛)과 물(고인 E)을 *두 인스턴스 집합*으로 가른다 — 불투명 먼저 그려 깊이를 채우고,
     *   물은 반투명으로 그 위에 블렌드(뒤 큐브가 비친다). 분류 문턱은 VS_VOXEL 과 동일(불일치 0).
     * L-V3: 고체 칸은 R 6-이웃 라플라시안(|∇²R| 고주파)을 *거칠기*로 미리 재 인스턴스에 싣는다 — 들쭉날쭉한 R=거친 암석.
     * L-V4: 빛 칸은 ∇E(흐름량 중앙차분) *하류 방향*을 월드 좌표로 미리 재 인스턴스에 싣는다 — FS 가 시간 이류 띠로 흐름 방향을 보인다.
     * L-V5: *빈칸*(void)의 미량 E 가 수렴(∇²E<0)하면 안개 점(부드러운 스프라이트)을 따로 모은다 — 겹쳐 쌓여 볼류메트릭 안개(응결).
     * 분포 author 0: 어느 칸이 차 있는가·R·E 분포는 시뮬의 사실, 렌더러는 읽어서 큐브를 두고 도함수(∇²R·∇E·∇²E)로 셰이딩만(RENDER §6·VOXEL V-A). */
    var satA = R.satA, satR = R.satR, STR = 11;             // 인스턴스 stride 11: (x,y,z, E,R,G,A, rough, fx,fy,fz)
    var va = R.voxArr, vn = 0, vw = R.voxArrW, wn = 0, fa = R.fogArr, fn = 0;
    if (!va || va.length < 4096 * STR) va = R.voxArr = new Float32Array(4096 * STR);
    if (!vw || vw.length < 1024 * STR) vw = R.voxArrW = new Float32Array(1024 * STR);
    if (!fa) fa = R.fogArr = new Float32Array(1024 * 4);    // 안개 점(L-V5): (x,y,z, density) — 빈칸 ∇²E 수렴
    function rN(x, y, z) {                                   // 이웃 R — x·y wrap(토러스)·z 클램프(벽). Rf 없으면 0(거칠기 무)
      x = ((x % W) + W) % W; y = ((y % H) + H) % H; if (z < 0) z = 0; else if (z >= D) z = D - 1;
      return Rf ? Rf[(z * H + y) * W + x] : 0;
    }
    function eN(x, y, z) {                                   // 이웃 E — x·y wrap·z 클램프 (∇E 바람용)
      x = ((x % W) + W) % W; y = ((y % H) + H) % H; if (z < 0) z = 0; else if (z >= D) z = D - 1;
      return E[(z * H + y) * W + x];
    }
    for (i = 0; i < N; i++) {
      var Ev = E[i], Rv = Rf ? Rf[i] : 0, Av = Af ? Af[i] : 0;
      var an = Av > 0 ? clamp(Av / satA, 0, 1) : 0;          // 활성도 정규화
      var tt = clamp((an - 0.16) / 0.84, 0, 1), af = tt * tt * (3 - 2 * tt);  // smoothstep(0.16,1) — VS_VOXEL actFrac 와 동일
      var liquidE = Ev * (1 - af), flowE = Ev * af;
      var solid = Rv > 0.08 && Rv >= liquidE;                // 고체(저장체 우세)
      var water = !solid && liquidE > 0.05;                  // 물(고인 E 우세) — 반투명 패스
      var z = (i / WH) | 0, rem = i - z * WH, yy = (rem / W) | 0, xx = rem - yy * W;   // i → (x,y,z)
      if (!(solid || water || flowE > 0.035)) {              // 빈칸(void) → 큐브 없음. 단 미량 E 가 수렴(∇²E<0)하면 안개(L-V5)
        if (Ev > 0.004) {
          var lapE = eN(xx + 1, yy, z) + eN(xx - 1, yy, z) + eN(xx, yy + 1, z) + eN(xx, yy - 1, z) + eN(xx, yy, z + 1) + eN(xx, yy, z - 1) - 6 * Ev;
          var fog = clamp(-lapE / Math.max(R.sat * 0.03, 1e-3), 0, 1) * clamp(Ev / Math.max(R.sat * 0.25, 1e-3), 0, 1);  // 수렴(∇²E<0) × 미량 E 농도
          if (fog > 0.05) {
            if ((fn + 1) * 4 > fa.length) { var nf = new Float32Array(fa.length * 2); nf.set(fa); fa = R.fogArr = nf; }
            var of = fn * 4; fa[of] = xx; fa[of + 1] = yy; fa[of + 2] = z; fa[of + 3] = fog; fn++;
          }
        }
        continue;
      }
      var rough = 0;                                         // L-V3 거칠기 — 고체만(물·빛=매끈)
      if (solid && Rf) {
        var lapR = rN(xx + 1, yy, z) + rN(xx - 1, yy, z) + rN(xx, yy + 1, z) + rN(xx, yy - 1, z) + rN(xx, yy, z + 1) + rN(xx, yy, z - 1) - 6 * Rv;
        rough = clamp(Math.abs(lapR) / Math.max(satR, 1e-3) * 1.6, 0, 1);   // |∇²R| 정규화(매끈 R→0)
      }
      var fwx = 0, fwy = 0, fwz = 0;                         // L-V4 ∇E 하류 방향(월드 좌표) — 빛 칸만(흐르는 E)
      if (flowE > 0.03) {
        var gx = eN(xx + 1, yy, z) - eN(xx - 1, yy, z), gy = eN(xx, yy + 1, z) - eN(xx, yy - 1, z), gz = eN(xx, yy, z + 1) - eN(xx, yy, z - 1);
        fwx = -gx; fwy = -gz; fwz = -gy;                    // 하류(고E→저E)·sim(x,y,z)→월드(x,z,y) 축 매핑
      }
      if (water) {
        if ((wn + 1) * STR > vw.length) { var nw = new Float32Array(vw.length * 2); nw.set(vw); vw = R.voxArrW = nw; }
        var ow = wn * STR;
        vw[ow] = xx; vw[ow + 1] = yy; vw[ow + 2] = z; vw[ow + 3] = Ev; vw[ow + 4] = Rv; vw[ow + 5] = Gf ? Gf[i] : 0; vw[ow + 6] = Av; vw[ow + 7] = 0;
        vw[ow + 8] = 0; vw[ow + 9] = 0; vw[ow + 10] = 0;
        wn++;
      } else {
        if ((vn + 1) * STR > va.length) { var nv = new Float32Array(va.length * 2); nv.set(va); va = R.voxArr = nv; }
        var o = vn * STR;
        va[o] = xx; va[o + 1] = yy; va[o + 2] = z; va[o + 3] = Ev; va[o + 4] = Rv; va[o + 5] = Gf ? Gf[i] : 0; va[o + 6] = Av; va[o + 7] = rough;
        va[o + 8] = fwx; va[o + 9] = fwy; va[o + 10] = fwz;
        vn++;
      }
    }
    R.voxN = vn; R.voxNW = wn; R.fogN = fn;
    if (vn) { gl.bindBuffer(gl.ARRAY_BUFFER, R.bufVox); gl.bufferData(gl.ARRAY_BUFFER, va.subarray(0, vn * STR), gl.DYNAMIC_DRAW); }
    if (wn) { gl.bindBuffer(gl.ARRAY_BUFFER, R.bufVoxW); gl.bufferData(gl.ARRAY_BUFFER, vw.subarray(0, wn * STR), gl.DYNAMIC_DRAW); }
    if (fn) { gl.bindBuffer(gl.ARRAY_BUFFER, R.bufFog); gl.bufferData(gl.ARRAY_BUFFER, fa.subarray(0, fn * 4), gl.DYNAMIC_DRAW); }
    /* 틱 단위 캐시 — 개체수 히스토리·고임 (엔진 2D 와 같은 주기) */
    if (sim.tick !== S.lastTick) {
      S.lastTick = sim.tick;
      S.popHist.push(sim.agents ? sim.agents.length : 0);
      if (S.popHist.length > 240) S.popHist.shift();
    }
    if (S.ov.pools && S.core && S.core.detectPools && sim.tick !== S.poolTick) {
      S.pools = S.core.detectPools(sim, (S.panel && S.panel.poolOpts) || { minE: 1.5, prom: 0.3 });
      S.poolTick = sim.tick;
    }
    /* ── 분할 레이아웃: 세계 해석 뷰가 켜지면 캔버스를 1:2 로 높여 두 정사각 뷰포트(위·아래 적층) ──
     * 위=에너지(D>1 칼럼 투영·D=1 z=0 슬라이스), 아래=voxel 세계. 과거엔 D>1 에서 좌측을 숨겼으나(z=0 슬라이스가
     * 부력을 거꾸로 그려 — 별이 z 로 떠오르면 z=0 이 비어 하이트필드가 *낮아*져 "가라앉은" 듯), 칼럼 최대 투영은
     * *어느 높이에든* 에너지가 있으면 그 칼럼을 세워 역전이 사라진다 → 좌측 뷰를 숨기지 않고 살린다. 에너지 동역학은
     * 이 열지도에서 가장 또렷하다(숨기면 우측 voxel 점유[거의 정적]만 남아 "움직임 없음"처럼 보였다 — 사용자 피드백). */
    var split = isWorld();
    ensureCanvasSize(split);
    var cam = S.cam, glcv = S.dom.glcv;
    var Pm = mPersp(cam.fov, 1, 0.5, 800);                  // 뷰포트는 늘 정사각 → aspect=1 (분할 무관)
    var eye = camEye();                                     // 월드 카메라 위치 — 세계 해석 셰이더 프레넬/글린트 시선벡터
    var Vm = mLookAt(eye, [cam.cx + cam.tx, cam.cy, cam.cz + cam.tz], [0, 1, 0]);
    var MVP = mMul(Pm, Vm);
    gl.viewport(0, 0, glcv.width, glcv.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    /* 오버레이 라인 — 레거시 뷰는 하이트필드 위 마커(buildLines), voxel 뷰는 3D 박스·기둥·호버 큐브(buildLines3D). 별 버퍼 */
    var ln = buildLines(sim);
    if (ln.length) {
      gl.bindBuffer(gl.ARRAY_BUFFER, R.bufLn);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ln), gl.DYNAMIC_DRAW);
    }
    var ln3 = buildLines3D(sim);
    if (ln3.length) {
      gl.bindBuffer(gl.ARRAY_BUFFER, R.bufLnV);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ln3), gl.DYNAMIC_DRAW);
    }
    R.lnVoxN = ln3.length / 6;
    var ag = sim.agents || [], agN = 0;
    if (S.ov.life && ag.length) {
      var need = ag.length * 5;                            // (x, y, m, g, z) — g=유전형 a.g(step-0016~), z=sim-z(step-0042~, voxel 세계 높이)
      if (!R.agArr || R.agArr.length < need) R.agArr = new Float32Array(Math.max(320, need * 2));
      for (var k = 0; k < ag.length; k++) {
        R.agArr[k * 5] = ag[k].x; R.agArr[k * 5 + 1] = ag[k].y; R.agArr[k * 5 + 2] = ag[k].m;
        R.agArr[k * 5 + 3] = ag[k].g || 0; R.agArr[k * 5 + 4] = ag[k].z || 0;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, R.bufAg);
      gl.bufferData(gl.ARRAY_BUFFER, R.agArr.subarray(0, need), gl.DYNAMIC_DRAW);
      agN = ag.length;
    }
    /* ── 별(구동) FSM 점 — 내생 별의 연소 상태(state: 0=living/kindling·1=burning·2=ash)를 *이산 재질*로 읽는다(RENDER §5 빛).
     * 필드 없으면 no-op: kIgnite=0 이면 sim.stars 빈 배열 → stN=0 → 그리지 않음(골든/스모크 불변). FSM off(state undefined)면 풀가동=burning(1). ── */
    var stz = sim.stars || [], stN = 0;
    if (stz.length) {
      var sneed = stz.length * 4;                          // (x, y, z, state) — z=부력 상승 좌표(step-0035, 없으면 0=바닥)
      if (!R.stArr || R.stArr.length < sneed) R.stArr = new Float32Array(Math.max(64, sneed * 2));
      for (var si = 0; si < stz.length; si++) {
        var s0 = stz[si];
        R.stArr[si * 4] = s0.x; R.stArr[si * 4 + 1] = s0.y;
        R.stArr[si * 4 + 2] = (s0.z === undefined ? 0 : s0.z); R.stArr[si * 4 + 3] = (s0.state === undefined ? 1 : s0.state);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, R.bufStar);
      gl.bufferData(gl.ARRAY_BUFFER, R.stArr.subarray(0, sneed), gl.DYNAMIC_DRAW);
      stN = stz.length;
    }
    /* ── 패스: 위 = 에너지 변위(레거시 2.5D 하이트필드), (분할 시) 아래 = voxel 세계(L-V1 — R 점유 큐브).
     * GL 뷰포트 원점은 좌하단 → 위 뷰포트가 vy=CV_SIZE, 아래가 vy=0. 비분할이면 단일 뷰포트 vy=0. ── */
    drawView(split ? CV_SIZE : 0, false, MVP, ln.length, agN, glcv, Pm, eye, stN);   // 위 = 에너지 투영(칼럼 최대)
    if (split) drawView(0, true, MVP, ln.length, agN, glcv, Pm, eye, stN);            // 아래 = voxel 세계
    drawHud(sim, split);
  }

  /* 한 뷰포트를 그린다. 버퍼·텍스처는 호출 전 업로드됨. uVoxel = (world?1:0) 으로 점/별 위치를 분기한다:
   * world=false → 좌측 '에너지 변위'(레거시 2.5D 하이트필드, z=0 바닥 슬라이스 · progT) + 표준 오버레이.
   * world=true  → 우측 'voxel 세계'(L-V1·L-V2 — R 점유 인스턴스드 큐브 · progV) — 형태가 시뮬의 사실이라 발명 0(VOXEL V-A).
   * 점/별은 양 뷰가 공유하되 uVoxel 로 높이를 가른다(하이트필드 z ↔ 진짜 sim-z). 오버레이 라인은 뷰별로 다른 버퍼:
   * 레거시는 하이트필드 위 마커(vaoL), voxel 은 3D 박스·기둥·호버 큐브(vaoLV). */
  function drawView(vy, world, MVP, lnCount, agN, glcv, Pm, eye, starN) {
    var gl = S.gl;
    gl.viewport(0, vy, CV_SIZE, CV_SIZE);                   // 뷰포트가 색·깊이 쓰기를 이 사각으로 한정(위·아래 충돌 없음)
    var vox = world ? 1 : 0;
    gl.depthMask(true); gl.disable(gl.BLEND);
    if (world) {
      /* ① voxel 세계 — 불투명(고체·빛) 먼저 깊이 채우고(L-V1), 물은 반투명으로 그 위에 블렌드(L-V2). 높이=sim-z(발명 0). */
      if (R.voxN || R.voxNW) {
        gl.useProgram(R.progV);
        gl.uniformMatrix4fv(R.uV.uMVP, false, MVP);
        gl.uniform1f(R.uV.uSat, R.sat); gl.uniform1f(R.uV.uSatR, R.satR); gl.uniform1f(R.uV.uSatA, R.satA);
        gl.uniform1f(R.uV.uScale, VOX_SCALE);
        gl.uniform3f(R.uV.uLight, 0.421, 0.781, 0.461);
        gl.uniform3f(R.uV.uEye, eye[0], eye[1], eye[2]);    // 물 프레넬 시선벡터
        gl.uniform1f(R.uV.uTime, (now() - R.t0) * 0.001);   // ∇E flowmap 이류 시간(세션 상대)
        if (R.voxN) {                                       // 불투명 패스 — 깊이 쓰기 on
          gl.bindVertexArray(R.vaoV);
          gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, R.voxN);
        }
        if (R.voxNW) {                                      // 물 패스 — 반투명(깊이 테스트 on·쓰기 off → 뒤 큐브 비침)
          gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
          gl.depthMask(false);
          gl.bindVertexArray(R.vaoVW);
          gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, R.voxNW);
          gl.depthMask(true); gl.disable(gl.BLEND);
        }
      }
      /* ② 안개(L-V5) — 빈칸 ∇²E 수렴을 부드러운 점 스프라이트로(겹쳐 쌓여 볼류메트릭). 알파-오버·깊이 테스트 on·쓰기 off(고체 뒤는 가림) */
      if (R.fogN) {
        gl.useProgram(R.progF);
        gl.uniformMatrix4fv(R.uF.uMVP, false, MVP);
        gl.uniform1f(R.uF.uPx, Pm[5] * CV_SIZE / 2);
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.bindVertexArray(R.vaoF);
        gl.drawArrays(gl.POINTS, 0, R.fogN);
        gl.depthMask(true); gl.disable(gl.BLEND);
      }
      /* ③ 3D 오버레이(도메인 박스·source/sink 기둥·무게중심·호버 큐브) — voxel 월드 좌표. 깊이 테스트 on(공간감)·쓰기 off */
      if (R.lnVoxN) {
        gl.useProgram(R.progL);
        gl.uniformMatrix4fv(R.uL.uMVP, false, MVP);
        gl.bindVertexArray(R.vaoLV);
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.drawArrays(gl.LINES, 0, R.lnVoxN);
        gl.depthMask(true); gl.disable(gl.BLEND);
      }
    } else {
      /* ① 레거시 하이트필드(에너지 변위 — z=0 바닥 슬라이스) */
      gl.useProgram(R.progT);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, R.tex);
      gl.uniform1i(R.uT.uE, 0);
      gl.uniformMatrix4fv(R.uT.uMVP, false, MVP);
      gl.uniform1f(R.uT.uSat, R.sat); gl.uniform1f(R.uT.uHS, HS); gl.uniform1f(R.uT.uSatR, R.satR);
      gl.uniform2i(R.uT.uDim, R.W, R.H);
      gl.uniform3f(R.uT.uLight, 0.421, 0.781, 0.461);
      gl.bindVertexArray(R.vaoT);
      gl.drawElements(gl.TRIANGLES, R.nIdx, gl.UNSIGNED_SHORT, 0);
      /* ② 오버레이 라인(링·빔·경계·호버) — 레거시 하이트필드 뷰 전용 */
      if (lnCount) {
        gl.useProgram(R.progL);
        gl.uniformMatrix4fv(R.uL.uMVP, false, MVP);
        gl.bindVertexArray(R.vaoL);
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.drawArrays(gl.LINES, 0, lnCount / 6);
      }
    }
    /* ③ 생명(발광 점) — 가산 블렌딩, 크기 ∝ √m (2D 와 동일 규칙). uVoxel=1 이면 바닥(sim z=0), 0 이면 하이트필드 */
    if (agN) {
      gl.useProgram(R.progP);
      gl.uniform1i(R.uP.uE, 0);
      gl.uniformMatrix4fv(R.uP.uMVP, false, MVP);
      gl.uniform1f(R.uP.uSat, R.sat); gl.uniform1f(R.uP.uHS, HS);
      gl.uniform2i(R.uP.uDim, R.W, R.H);
      gl.uniform1f(R.uP.uPx, Pm[5] * CV_SIZE / 2);          // 세계 길이 → 픽셀 환산 계수(뷰포트 높이=CV_SIZE, 세로분할이어도 캔버스 전체높이 아님)
      gl.uniform1i(R.uP.uVoxel, vox);
      gl.bindVertexArray(R.vaoP);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.depthMask(false);
      gl.drawArrays(gl.POINTS, 0, agN);
    }
    /* ④ 별 FSM(이산 재질) — kindling(어두운 응결핵)·burning(백열)·ash(식은 회색)로 이산 분기(lerp 0), 가산 발광. uVoxel=1 이면 부력 z(천장까지) */
    if (starN) {
      gl.useProgram(R.progS);
      gl.uniform1i(R.uS.uE, 0);
      gl.uniformMatrix4fv(R.uS.uMVP, false, MVP);
      gl.uniform1f(R.uS.uSat, R.sat); gl.uniform1f(R.uS.uHS, HS);
      gl.uniform2i(R.uS.uDim, R.W, R.H);
      gl.uniform1f(R.uS.uPx, Pm[5] * CV_SIZE / 2);
      gl.uniform1i(R.uS.uVoxel, vox);
      gl.bindVertexArray(R.vaoS);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.depthMask(false);
      gl.drawArrays(gl.POINTS, 0, starN);
    }
    gl.depthMask(true); gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }

  /* 분할 토글에 맞춰 캔버스·HUD 크기 조정 — on 이면 1:2(위·아래 두 정사각 뷰포트), off 면 정사각 1개.
   * 세로 적층이라 폭은 늘 한 뷰포트(CV_SIZE)·높이만 2배가 된다(과거 가로분할은 폭 2배였다). */
  function ensureCanvasSize(split) {
    var wantH = split ? CV_SIZE * 2 : CV_SIZE, glcv = S.dom.glcv, hud = S.dom.hud;
    if (glcv.width !== CV_SIZE) { glcv.width = CV_SIZE; hud.width = CV_SIZE; }
    if (glcv.height !== wantH) { glcv.height = wantH; hud.height = wantH; }
  }

  /* ── 오버레이 라인 빌더 — 표면 위 링·빔·경계·호버. [x,y,z,r,g,b]×2 per line ── */
  function buildLines(sim) {
    var p = sim.p, W = p.W, H = p.H, out = [], lift = 0.12;
    rectY(out, 0, 0, W - 1, H - 1, 0.02, COL.border);       // 터 경계
    if (S.ov.sourceSink) {
      ringSurf(out, sim, p.source.x, p.source.y, p.source.r, COL.src, lift);
      beam(out, sim, p.source.x, p.source.y, COL.src);      // 샘 — emissive 기둥
      ringSurf(out, sim, p.sink.x, p.sink.y, p.sink.r, COL.snk, lift);
      crossSurf(out, sim, p.sink.x, p.sink.y, 1.4, COL.snk, lift);
    }
    if (S.ov.pools) {
      for (var k = 0; k < S.pools.length; k++) ringSurf(out, sim, S.pools[k].x, S.pools[k].y, 1.1, COL.pool, lift);
    }
    if (S.ov.centroid && S.core && S.core.centroid) {
      var ct = S.core.centroid(sim);
      if (ct) { beam(out, sim, ct.x, ct.y, COL.centroid); crossSurf(out, sim, ct.x, ct.y, 1.5, COL.centroid, lift); }
    }
    if (S.hover) cellOutline(out, sim, S.hover.x, S.hover.y, COL.hover);
    return out;
  }

  function push2(out, a, b, c) {
    out.push(a[0], a[1], a[2], c[0], c[1], c[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  }
  function rectY(out, x0, z0, x1, z1, y, c) {
    push2(out, [x0, y, z0], [x1, y, z0], c); push2(out, [x1, y, z0], [x1, y, z1], c);
    push2(out, [x1, y, z1], [x0, y, z1], c); push2(out, [x0, y, z1], [x0, y, z0], c);
  }
  function ringSurf(out, sim, cx, cy, r, c, lift) {
    var SEG = 36, prev = null;
    for (var s = 0; s <= SEG; s++) {
      var a = s / SEG * 2 * Math.PI;
      var x = cx + Math.cos(a) * r, z = cy + Math.sin(a) * r;
      var pt = [x, hAt(sim, x, z) + lift, z];
      if (prev) push2(out, prev, pt, c);
      prev = pt;
    }
  }
  function beam(out, sim, cx, cy, c) {                      // 수직 빔 + 둘레 4선 = 기둥
    var h0 = hAt(sim, cx, cy) + 0.1, h1 = HS * 1.3;
    push2(out, [cx, h0, cy], [cx, h1, cy], c);
    for (var k = 0; k < 4; k++) {
      var a = k * Math.PI / 2, x = cx + Math.cos(a) * 0.45, z = cy + Math.sin(a) * 0.45;
      push2(out, [x, h0, z], [x, h1 * 0.85, z], c);
    }
  }
  function crossSurf(out, sim, cx, cy, r, c, lift) {
    var h = hAt(sim, cx, cy) + lift;
    push2(out, [cx - r, h, cy], [cx + r, h, cy], c);
    push2(out, [cx, h, cy - r], [cx, h, cy + r], c);
  }
  function cellOutline(out, sim, cx, cy, c) {
    var h = hAt(sim, cx, cy) + 0.1;
    var x0 = cx - 0.5, x1 = cx + 0.5, z0 = cy - 0.5, z1 = cy + 0.5;
    push2(out, [x0, h, z0], [x1, h, z0], c); push2(out, [x1, h, z0], [x1, h, z1], c);
    push2(out, [x1, h, z1], [x0, h, z1], c); push2(out, [x0, h, z1], [x0, h, z0], c);
  }

  /* ── voxel 오버레이 라인 빌더(3D 오버레이) — 하이트필드가 아니라 *voxel 월드*에 마커를 둔다.
   * 월드 좌표 = (sim-x, 위=sim-z, 깊이=sim-y). 도메인 박스 와이어 + source/sink 기둥·링 + 무게중심 기둥 + 호버 voxel 큐브. ── */
  function buildLines3D(sim) {
    var p = sim.p, W = p.W, H = p.H, D = p.D || 1, out = [], top = D - 1;
    boxWire3(out, -0.5, -0.5, -0.5, W - 0.5, top + 0.5, H - 0.5, COL.border);   // 터 박스(W×H×D) 와이어프레임
    if (S.ov.sourceSink) {
      ring3(out, p.source.x, p.source.y, p.source.r, -0.4, COL.src);           // 샘 — 바닥 링 + 수직 기둥(z 전체)
      beam3(out, p.source.x, p.source.y, top, COL.src);
      ring3(out, p.sink.x, p.sink.y, p.sink.r, -0.4, COL.snk);                  // 싱크 — 링 + 십자
      cross3(out, p.sink.x, p.sink.y, -0.4, 1.4, COL.snk);
    }
    if (S.ov.pools) {
      for (var k = 0; k < S.pools.length; k++) ring3(out, S.pools[k].x, S.pools[k].y, 1.1, -0.4, COL.pool);
    }
    if (S.ov.centroid && S.core && S.core.centroid) {
      var ct = S.core.centroid(sim);
      if (ct) beam3(out, ct.x, ct.y, top, COL.centroid);                       // 무게중심 — 수직 기둥
    }
    if (S.hover && S.hover.z !== undefined) cubeWire3(out, S.hover.x, S.hover.z, S.hover.y, COL.hover);  // 호버 voxel 큐브
    return out;
  }
  function ring3(out, sx, sy, r, yup, c) {                  // sim(sx,sy) 둘레 링(높이 yup) — 월드(sx+cos·r, yup, sy+sin·r)
    var SEG = 36, prev = null;
    for (var s = 0; s <= SEG; s++) {
      var a = s / SEG * 2 * Math.PI, pt = [sx + Math.cos(a) * r, yup, sy + Math.sin(a) * r];
      if (prev) push2(out, prev, pt, c);
      prev = pt;
    }
  }
  function beam3(out, sx, sy, top, c) {                     // 수직 기둥(바닥~천장) + 둘레 4선
    push2(out, [sx, -0.45, sy], [sx, top + 0.6, sy], c);
    for (var k = 0; k < 4; k++) {
      var a = k * Math.PI / 2, x = sx + Math.cos(a) * 0.42, z = sy + Math.sin(a) * 0.42;
      push2(out, [x, -0.4, z], [x, top + 0.4, z], c);
    }
  }
  function cross3(out, sx, sy, yup, r, c) {                 // 수평 십자(높이 yup)
    push2(out, [sx - r, yup, sy], [sx + r, yup, sy], c);
    push2(out, [sx, yup, sy - r], [sx, yup, sy + r], c);
  }
  function boxWire3(out, x0, y0, z0, x1, y1, z1, c) {       // 상자 12 모서리(월드 좌표 직접)
    push2(out, [x0, y0, z0], [x1, y0, z0], c); push2(out, [x1, y0, z0], [x1, y0, z1], c);  // 바닥 사각
    push2(out, [x1, y0, z1], [x0, y0, z1], c); push2(out, [x0, y0, z1], [x0, y0, z0], c);
    push2(out, [x0, y1, z0], [x1, y1, z0], c); push2(out, [x1, y1, z0], [x1, y1, z1], c);  // 천장 사각
    push2(out, [x1, y1, z1], [x0, y1, z1], c); push2(out, [x0, y1, z1], [x0, y1, z0], c);
    push2(out, [x0, y0, z0], [x0, y1, z0], c); push2(out, [x1, y0, z0], [x1, y1, z0], c);  // 수직 4 모서리
    push2(out, [x1, y0, z1], [x1, y1, z1], c); push2(out, [x0, y0, z1], [x0, y1, z1], c);
  }
  function cubeWire3(out, cx, cyUp, cz, c) {                // 호버 voxel 큐브(월드 center = (cx, cyUp, cz))
    boxWire3(out, cx - 0.5, cyUp - 0.5, cz - 0.5, cx + 0.5, cyUp + 0.5, cz + 0.5, c);
  }

  /* ── 높이 함수 — 셰이더 hOf 와 동일식(CPU, E+R 합산·클램프). 픽킹·오버레이가 공유한다. ── */
  function hCPU(e) {
    return Math.min(HS * Math.log(1 + Math.max(e, 0)) / Math.log(1 + (R ? R.sat : 8)), HS * 2.2);
  }
  function eBilin(sim, x, y) {                              // wrap 쌍선형 — 링이 표면을 매끈히 타게
    var W = sim.p.W, H = sim.p.H, E = sim.E, Rf = sim.R || null, WH = W * H, D = sim.p.D || 1;
    var x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    function at(xx, yy) {                                   // 칼럼 최대(E·R 독립) — 렌더 하이트필드(칼럼 투영)와 같은 표면(픽킹·오버레이 정합). D=1 이면 z=0 한 칸과 동일
      xx = ((xx % W) + W) % W; yy = ((yy % H) + H) % H;
      var base = yy * W + xx, bestE = 0, bestR = 0;
      for (var z = 0; z < D; z++) {
        var i = base + z * WH, e = E[i], r = Rf ? Rf[i] : 0;
        if (e > bestE) bestE = e; if (r > bestR) bestR = r;
      }
      return bestE + bestR;
    }
    return at(x0, y0) * (1 - fx) * (1 - fy) + at(x0 + 1, y0) * fx * (1 - fy)
         + at(x0, y0 + 1) * (1 - fx) * fy + at(x0 + 1, y0 + 1) * fx * fy;
  }
  function hAt(sim, x, y) { return hCPU(eBilin(sim, x, y)); }

  /* ════════ HUD (투명 2D 캔버스) — 스파크라인·호버 툴팁·토스트·조작 힌트 ════════ */

  function drawHud(sim, split) {
    var ctx = S.dom.hctx, wdt = S.dom.hud.width, hgt = S.dom.hud.height;
    ctx.clearRect(0, 0, wdt, hgt);
    ctx.textAlign = 'left';
    var ph = S.popHist;
    if (S.ov.sparkline && ph.length > 1) {                  // 엔진 2D 스파크라인 이식
      var gw = 170, gh = 52, gx = wdt - gw - 10, gy = 10;
      ctx.fillStyle = 'rgba(20,22,26,0.80)'; ctx.fillRect(gx, gy, gw, gh);
      ctx.strokeStyle = '#3a4250'; ctx.lineWidth = 1; ctx.strokeRect(gx, gy, gw, gh);
      var mxp = 1, i;
      for (i = 0; i < ph.length; i++) if (ph[i] > mxp) mxp = ph[i];
      ctx.strokeStyle = '#f0d060'; ctx.lineWidth = 1.5; ctx.beginPath();
      for (i = 0; i < ph.length; i++) {
        var X = gx + (i / (ph.length - 1)) * gw, Y = gy + gh - 2 - (ph[i] / mxp) * (gh - 14);
        if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      }
      ctx.stroke();
      ctx.fillStyle = '#8a93a0'; ctx.font = '10px Consolas';
      ctx.fillText('개체수 ' + (sim.agents ? sim.agents.length : 0) + ' (peak ' + mxp + ')', gx + 5, gy + 12);
    }
    if (S.hover) {                                          // 호버 셀 정보 — 2D 에 없던 관찰 보강(voxel 픽킹이면 z·A 까지)
      var hv = S.hover, W = sim.p.W, H = sim.p.H;
      var idx = (hv.z !== undefined) ? ((hv.z * H + hv.y) * W + hv.x) : (hv.y * W + hv.x);
      var pos = (hv.z !== undefined) ? ('(' + hv.x + ',' + hv.y + ',' + hv.z + ')') : ('(' + hv.x + ',' + hv.y + ')');
      var txt = '셀 ' + pos + '  E ' + sim.E[idx].toFixed(3);
      if (sim.R && sim.R[idx] > 0.005) txt += '  ·  R ' + sim.R[idx].toFixed(2);
      if (sim.A && sim.A[idx] > 1e-4) txt += '  ·  A ' + sim.A[idx].toFixed(3);
      var ag = sim.agents || [];
      for (var a = 0; a < ag.length; a++) if (ag[a].center === idx) { txt += '  ·  생명 m ' + ag[a].m.toFixed(2); break; }
      ctx.font = '12px Consolas';
      var tw = ctx.measureText ? ctx.measureText(txt).width : 200;
      ctx.fillStyle = 'rgba(20,22,26,0.85)'; ctx.fillRect(6, hgt - 46, tw + 12, 20);
      ctx.fillStyle = '#d8dde4'; ctx.fillText(txt, 12, hgt - 32);
    }
    if (S.msg && now() < S.msgUntil) {
      ctx.fillStyle = '#f0d060'; ctx.font = '14px Segoe UI';
      ctx.fillText(S.msg, 8, 22);
    }
    ctx.fillStyle = '#5a6270'; ctx.font = '10px Segoe UI';
    if (ctx.measureText) {
      var hint = '드래그 회전 · 휠 줌 · Shift/우드래그 팬 · 클릭 = 클릭 동작';
      ctx.fillText(hint, wdt - ctx.measureText(hint).width - 8, hgt - 8);
    }
    /* ── 뷰포트 제목 라벨 (분할 시 위=에너지 변위[레거시 2.5D] · 아래=voxel 세계[L-V1]. HUD 좌상단 원점이라 아래 뷰포트는 y=CV_SIZE 만큼 내린다) ── */
    ctx.textAlign = 'center'; ctx.font = 'bold 13px Segoe UI';
    /* 위(또는 단일) 뷰포트 = 에너지. D>1 은 칼럼 투영(위에서 내려다본 z-최대), D=1 은 레거시 z=0 슬라이스. */
    var proj = (sim.p && (sim.p.D || 1) > 1);
    vlabel(ctx, CV_SIZE / 2, 21, proj ? '에너지 투영 (칼럼 z-최대 · 위에서 내려다봄)' : '에너지 변위 (z=0 바닥 슬라이스 · 레거시 2.5D)', '#9fb0c0');
    if (split) {
      /* voxel 세계 뷰포트 윗변 = 아래 뷰포트(vy=0 → HUD y=CV_SIZE). */
      var voxTop = CV_SIZE;
      vlabel(ctx, CV_SIZE / 2, voxTop + 21, 'voxel 세계 (3D · R 점유 큐브)', '#e6c860');
      /* voxel 세계 범례 — 점유=물질(R) voxel(높이=sim-z, 발명 0)·에너지(E)는 색 밝기(고활성=빛·저활성=물) (VOXEL V-A·V-B) */
      ctx.textAlign = 'left'; ctx.font = '11px Consolas';
      var leg = [['#1a6e9c', '물 · 액체 (고인 E · 파란 voxel)'], ['#52473f', '돌 · 암반 (R 고체 큐브)'],
                 ['#c89a6a', '나무 · 결정 (R + 유전 G)'], ['#ffb04d', '빛 · 에너지 (흐르는 E·A · 발광)']];
      var lx = 10, ly = voxTop + 34, lh = 16;
      for (var li = 0; li < leg.length; li++) {
        var yy = ly + li * lh;
        ctx.fillStyle = 'rgba(15,17,21,0.55)'; ctx.fillRect(lx, yy, 168, lh - 2);
        ctx.fillStyle = leg[li][0]; ctx.fillRect(lx + 3, yy + 3, 10, 10);
        ctx.fillStyle = '#cdd5de'; ctx.fillText(leg[li][1], lx + 19, yy + 11);
      }
    }
    ctx.textAlign = 'left';                                 // 다음 프레임 sparkline/hover 가 left 기준이도록 복원
  }

  /* 뷰포트 상단 가운데 제목 — 반투명 배경 + 색 텍스트. cy = 텍스트 baseline(배경 사각은 그 위로) */
  function vlabel(ctx, cx, cy, txt, col) {
    var w = ctx.measureText(txt).width;
    ctx.fillStyle = 'rgba(15,17,21,0.62)'; ctx.fillRect(cx - w / 2 - 7, cy - 15, w + 14, 21);
    ctx.fillStyle = col; ctx.fillText(txt, cx, cy);
  }

  /* ════════ 입력 — 궤도 카메라 + 레이캐스트 클릭/호버 ════════ */

  function initInput() {
    var glcv = S.dom.glcv, drag = null;
    glcv.addEventListener('mousedown', function (ev) {
      drag = { x: ev.clientX, y: ev.clientY, b: ev.button, shift: ev.shiftKey, moved: false };
    });
    glcv.addEventListener('mousemove', function (ev) {      // 호버(드래그 아닐 때만)
      if (!drag && !S.failed && S.sim && isView3d()) S.hover = evCell(ev);
    });
    glcv.addEventListener('mouseleave', function () { S.hover = null; });
    global.addEventListener('mousemove', function (ev) {    // 드래그 — 캔버스 밖으로 나가도 이어지게 window 에
      if (!drag) return;
      var dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      if (drag.b === 2 || drag.shift) pan(dx, dy);
      else {
        S.cam.yaw -= dx * 0.008;
        S.cam.pitch = clamp(S.cam.pitch + dy * 0.006, 0.18, 1.45);
      }
      drag.x = ev.clientX; drag.y = ev.clientY;
    });
    global.addEventListener('mouseup', function (ev) {
      if (!drag) return;
      var d = drag; drag = null;
      if (!d.moved && d.b === 0 && !S.failed && S.sim && isView3d()) {
        var cell = evCell(ev);
        if (cell) dispatchClick(cell);
      }
    });
    glcv.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      S.cam.dist = clamp(S.cam.dist * Math.exp(ev.deltaY * 0.0012), 18, 320);
    }, { passive: false });
    glcv.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
  }

  function pan(dx, dy) {
    var c = S.cam, s = c.dist * 0.0016;
    var sy = Math.sin(c.yaw), cy = Math.cos(c.yaw);
    c.tx -= (cy * dx - sy * dy) * s;                        // 화면 오른쪽=right(cy,0,-sy), 위=수평전방(-sy,0,-cy)
    c.tz -= (-sy * dx - cy * dy) * s;
    c.tx = clamp(c.tx, -c.cx, c.cx); c.tz = clamp(c.tz, -c.cz, c.cz);
  }

  function camEye() {
    var c = S.cam, cp = Math.cos(c.pitch);
    return [c.cx + c.tx + Math.sin(c.yaw) * cp * c.dist,
            c.cy + Math.sin(c.pitch) * c.dist,                 // c.cy = voxel 세계 중간 높이((D−1)/2) — 키 큰 3D 세계 프레이밍
            c.cz + c.tz + Math.cos(c.yaw) * cp * c.dist];
  }

  /* 마우스 이벤트 → 셀. 캔버스 밖이면 null. voxel 뷰포트(분할 하단)는 voxel 레이캐스트, 그 외(레거시 하이트필드)는 하이트필드. */
  function evCell(ev) {
    var glcv = S.dom.glcv, r = glcv.getBoundingClientRect();
    var mx = ev.clientX - r.left, my = ev.clientY - r.top;
    if (mx < 0 || my < 0 || mx >= r.width || my >= r.height) return null;
    /* 세로 분할 시 위/아래 어느 뷰포트인지 가려 뷰포트-로컬 NDC 로 — 두 뷰포트는 같은 카메라/MVP 라 레이 식 동일.
     * 분할이면 상단=에너지 투영(하이트필드 픽킹)·하단=voxel 세계(voxel 픽킹). 비분할은 단일 에너지 투영. */
    var split = isWorld();
    var halfCss = split ? r.height / 2 : r.height;          // CSS 높이 기준 한 뷰포트 높이
    var inVoxel = split && my >= halfCss;                   // 분할 하단이 voxel 세계(render 의 vy=0 패스)
    var localY = inVoxel ? my - halfCss : my;
    var ndcX = mx / r.width * 2 - 1, ndcY = 1 - localY / halfCss * 2;
    return inVoxel ? pickVoxel(ndcX, ndcY) : pick(ndcX, ndcY);
  }

  /* 카메라 기저로 픽셀 NDC → 월드 레이(eye·dir). 타깃 y=cam.cy 로 render 의 mLookAt 과 일치(D>1 voxel 프레이밍). */
  function camRay(px, py) {
    var cam = S.cam, eye = camEye(), tgt = [cam.cx + cam.tx, cam.cy, cam.cz + cam.tz];
    var fw = norm3([tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]]);
    var rt = norm3(cross3(fw, [0, 1, 0]));
    var up = cross3(rt, fw);
    var tf = Math.tan(cam.fov / 2);                         // aspect=1 (뷰포트는 늘 정사각 CV_SIZE²)
    var dir = norm3([
      fw[0] + rt[0] * px * tf + up[0] * py * tf,
      fw[1] + rt[1] * px * tf + up[1] * py * tf,
      fw[2] + rt[2] * px * tf + up[2] * py * tf
    ]);
    return { eye: eye, dir: dir };
  }

  /* voxel 픽킹(L-V 픽킹) — 점유 큐브에 레이를 쏴 첫 충돌 셀(x,y,z)을 고른다. 인스턴스 빌드와 같은 점유 판정.
   * 월드(x, 위=y, 깊이=z) → sim(x, y, z) 역매핑: sim-x=wx · sim-y=wz(깊이) · sim-z=wy(위). 고정 스텝 행진(셀 크기 1 < step). */
  function pickVoxel(px, py) {
    var sim = S.sim;
    if (!sim) return null;
    var p = sim.p, W = p.W, H = p.H, D = p.D || 1;
    var ray = camRay(px, py), eye = ray.eye, dir = ray.dir;
    var T = S.cam.dist * 4 + 200, step = 0.25;
    for (var t = 0; t <= T; t += step) {
      var sx = Math.round(eye[0] + dir[0] * t);             // 월드-x → sim-x
      var sz = Math.round(eye[1] + dir[1] * t);             // 월드 위(y) → sim-z
      var sy = Math.round(eye[2] + dir[2] * t);             // 월드 깊이(z) → sim-y
      if (sx < 0 || sy < 0 || sz < 0 || sx >= W || sy >= H || sz >= D) continue;
      if (occAt(sim, sx, sy, sz)) return { x: sx, y: sy, z: sz };
    }
    return null;
  }

  /* 셀 점유 판정 — voxel 인스턴스 빌드(render)와 동일 문턱(고체·물·빛). 비면 false(빈칸=void → 픽킹 통과). */
  function occAt(sim, x, y, z) {
    var W = sim.p.W, H = sim.p.H, idx = (z * H + y) * W + x;
    var Ev = sim.E[idx], Rv = sim.R ? sim.R[idx] : 0, Av = sim.A ? sim.A[idx] : 0;
    var an = (Av > 0 && R && R.satA > 0) ? clamp(Av / R.satA, 0, 1) : 0;
    var tt = clamp((an - 0.16) / 0.84, 0, 1), af = tt * tt * (3 - 2 * tt);
    var liquidE = Ev * (1 - af), flowE = Ev * af;
    var solid = Rv > 0.08 && Rv >= liquidE;
    return solid || liquidE > 0.05 || flowE > 0.035;
  }

  /* 픽킹(레거시 하이트필드) — 카메라 레이를 하이트필드에 레이마칭(이분 정밀화). 셰이더와 같은 높이식 사용. */
  function pick(px, py) {
    var sim = S.sim;
    if (!sim) return null;
    var ray = camRay(px, py), eye = ray.eye, dir = ray.dir;
    var T = S.cam.dist * 4 + 100, stepL = 0.5, prevF = null, prevT = 0;
    for (var t = 0; t <= T; t += stepL) {
      var y = eye[1] + dir[1] * t;
      var f = y - hAt(sim, eye[0] + dir[0] * t, eye[2] + dir[2] * t);
      if (prevF !== null && prevF > 0 && f <= 0) {
        var lo = prevT, hi = t;                             // 이분 — 교차점 정밀화
        for (var k = 0; k < 18; k++) {
          var m = (lo + hi) / 2;
          if (eye[1] + dir[1] * m - hAt(sim, eye[0] + dir[0] * m, eye[2] + dir[2] * m) > 0) lo = m; else hi = m;
        }
        var hx = eye[0] + dir[0] * hi, hz = eye[2] + dir[2] * hi;
        var W = sim.p.W, H = sim.p.H;
        if (hx < -0.5 || hz < -0.5 || hx > W - 0.5 || hz > H - 0.5) return null;  // 본 도메인 밖(반복 지형) 거부
        return { x: clamp(Math.round(hx), 0, W - 1), y: clamp(Math.round(hz), 0, H - 1) };
      }
      prevF = f; prevT = t;
    }
    return null;
  }

  /* 3D 클릭 → 기존 clickModes 디스패치 — 엔진 2D 캔버스 클릭과 같은 계약( fn(api,cx,cy) 후 redraw ) */
  function dispatchClick(cell) {
    var panel = S.panel;
    if (!panel || !panel.clickModes || !S.sim || !S.core) return;
    var sel = null;
    eachItem(panel, function (it) { if (it.kind === 'select' && it.role === 'click') sel = it; });
    var mode;
    if (sel) { var el = byId(sel.id); mode = el ? el.value : sel.def; }
    else mode = Object.keys(panel.clickModes)[0];
    var fn = panel.clickModes[mode];
    if (!fn) return;
    fn(shimApi(), cell.x, cell.y);
    if (S.handle && S.handle.draw) S.handle.draw();         // 엔진 draw → 통계표·drawHook 동기화
  }

  function shimApi() {
    var sim = S.sim;
    return {
      sim: sim, core: S.core, W: sim.p.W, H: sim.p.H, SCALE: 512 / sim.p.W,
      val: function (id) {
        var el = byId(id);
        if (!el) return undefined;
        if (el.type === 'checkbox') return el.checked;
        if (el.type === 'range') return parseFloat(el.value);
        return el.value;
      },
      redraw: function () { if (S.handle && S.handle.draw) S.handle.draw(); },
      toast: hudToast
    };
  }

  /* ════════ GL 백엔드 (WebGPU 경첩 — 이 아래만 교체하면 API 를 갈아탈 수 있다) ════════ */

  /* 필드 텍스처는 RGBA32F — r=E(흐르는 흐름량), g=R(굳은 저장체, step-0008~. 없으면 0), b=G(유전형 태그, step-0015~. 없으면 0).
   * 높이 = hOf(E+R): 퇴적이 지형을 *키운다*(VISION "pool 지속성→반영구 지형" 행의 구현). 태그(b)는 높이 무관(색만).
   * 색 = E 열지도 램프를 저장체 색으로 블렌드 — 저장체 색은 유전형 태그면 클론 색(storeCol), 0 이면 호박색(무유전). 블렌드 포화점 uSatR 은 *이 세계의 maxR* 에 적응한다 —
   *   step-0008(농축 R~5)이든 step-0009(기복으로 얇게 펴진 R~3)이든 강한 퇴적이 항상 또렷(고정 /20 은
   *   얇은 퇴적을 거의 못 보였음 — 사용자 피드백 반영). R 없는 step 은 g=0 이라 무영향. */
  var VS_TERRAIN = [
    '#version 300 es',
    'precision highp float;',
    'layout(location=0) in vec2 aCell;',
    'uniform sampler2D uE;',
    'uniform mat4 uMVP;',
    'uniform float uSat, uHS, uSatR;',
    'uniform ivec2 uDim;',
    'out vec3 vColor; out vec3 vNormal;',
    'float mAt(int x, int y){',                             // E+R 합산 높이 — 토러스 wrap(가장자리 법선 연속)
    '  x=(x+uDim.x)%uDim.x; y=(y+uDim.y)%uDim.y;',
    '  vec2 t=texelFetch(uE, ivec2(x,y), 0).rg;',
    '  return t.r+t.g;',
    '}',
    'float hOf(float e){ return min(uHS*log(1.0+max(e,0.0))/log(1.0+uSat), uHS*2.2); }',
    'vec3 ramp(float e){',                                  // hws-ui.js colorOf 이식 — 2D 와 색 일관
    '  float t=clamp(log(1.0+max(e,0.0))/log(1.0+uSat),0.0,1.0);',
    '  if (t<0.5){ float u=t*2.0; return vec3(10.0+30.0*u,15.0+90.0*u,40.0+160.0*u)/255.0; }',
    '  float v=(t-0.5)*2.0; return vec3(40.0+215.0*v,105.0+120.0*v,200.0-60.0*v)/255.0;',
    '}',
    'vec3 storeCol(float tag){',                            // 저장체 색 — 유전형 태그 → 절차적 해시 색(혈통 무한 분화·팔레트 캡 제거, RENDER §4). 0 이면 호박색(무유전)
    '  int g=int(tag+0.5);',
    '  if (g<=0) return vec3(0.784,0.608,0.416);',          // 0 = 무유전 호박색(G 없는 step 은 늘 이 경로 → 과거 렌더 불변)
    '  float h=fract(float(g)*0.6180339887);',              // 황금비 저불일치 색상환 — 인접 혈통도 또렷이 갈림(고정 4색 캡 제거)
    '  float s=0.55+0.18*fract(float(g)*0.3247);',          // 채도·명도도 약하게 분화 → 같은 색상대 혈통 구분 보강
    '  float v=0.80+0.15*fract(float(g)*0.7654);',
    '  vec3 r=clamp(abs(mod(h*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0);', // HSV→RGB(hue→rgb)
    '  return v*mix(vec3(1.0), r, s);',
    '}',
    'void main(){',
    '  int x=int(aCell.x), y=int(aCell.y);',
    '  vec3 t0=texelFetch(uE, ivec2(x,y), 0).rgb;',         // r=E, g=R, b=유전형 태그
    '  vNormal=normalize(vec3(hOf(mAt(x-1,y))-hOf(mAt(x+1,y)), 2.0, hOf(mAt(x,y-1))-hOf(mAt(x,y+1))));',
    '  vColor=mix(ramp(t0.r), storeCol(t0.b), min(t0.g/uSatR, 0.85));',
    '  gl_Position=uMVP*vec4(aCell.x, hOf(t0.r+t0.g), aCell.y, 1.0);',
    '}'].join('\n');

  var FS_TERRAIN = [
    '#version 300 es',
    'precision highp float;',
    'in vec3 vColor; in vec3 vNormal;',
    'uniform vec3 uLight;',
    'out vec4 o;',
    'void main(){ float d=max(dot(normalize(vNormal),uLight),0.0); o=vec4(vColor*(0.42+0.62*d),1.0); }'
  ].join('\n');

  /* ── [RETIRED — L-V1 이후 미사용] 2.5D 세계 해석 셰이더 (하이트필드 z=hOf(R)). voxel 전환(VOXEL.md)으로 우측 뷰가
   *   VS_VOXEL(인스턴스드 큐브)로 대체됨 — 더 이상 mkProg 로 컴파일되지 않는다. *참조용으로만 보존*: 물 흡광(Beer-Lambert
   *   transmit)·프레넬·∇R 거칠기·∇E flowmap 의 수식이 L-V2(물 볼륨)·후속 voxel 렌즈에서 큐브로 재구현될 때 출발점이다.
   * ── 세계 해석 셰이더 (INTERPRET §5b — 물질 표현) — 같은 텍스처(E,R,G,A)를 *물질/에너지*로 갈라 읽는다.
   * 척추 정합(SPINE 척추 체크 2·INTERPRET §4): 렌더러는 *형태(실루엣)를 author 하지 않는다* — R·E *분포*는 시뮬이 정한다.
   *   렌더러에 허용된 차이는 둘뿐: ① *어느 양이 높이가 되는가*(물질=R 만, 에너지는 흐르든 고이든 빼서 빛·재질로 — §4 "정직한 읽기")
   *   ② *색·재질·빛*(상·조성·밀도·광택·발광 — §3). 높이로 분포를 *재성형*(예: 물 평탄화)하면 §4 가 금지한 형태 author 다.
   * 그래서 높이 = hOf(R) only — 에너지뷰(h=E+R)와 *에너지 전부(E)만큼* 갈린다(RENDER §2: 응축상 R 만 공간 점유).
   *   흐르는 에너지(고활성 E·A)는 솟지 않고 *빛*으로(별 연소·확산 전선). 고인 물(저활성 E)도 z 를 안 들어올리고 R 위에 *얹혀*(§5) *재질*로만 읽는다 — 분포는 그대로(평탄화 0, 그냥 z 에 안 든다).
   *   물 렌즈(§5 "물 = R 위 반투명 막"): 바닥 물질색(store·dens)을 깊이(저활성 E)로 흡광 블렌드(Beer-Lambert transmit=exp(-depth·absorb)) — 얕으면 바닥 비침·청록, 깊으면 짙은 남. FS 에서 프레넬(비스듬할수록 표면 반사↑)·시선기반 글린트. 고체는 vWet=0 → 불투명·무광 불변.
   *   고체 거칠기 렌즈(§5 "지형·거칠기"): R 라플라시안 |∇²R|(고주파 성분)으로 고체 노멀을 미세 변조 — 들쭉날쭉한 R=거친 암석, 매끈한 R=매끈. 높이는 불변(분포 재성형 0), 셰이딩 노멀만(§6 도함수 읽기). 진폭=∇R 거침·방향=셀 해시(서브셀 디테일 절차적). 액체/공허는 rough=0.
   *   유전형 색 렌즈(§4 "G→색은 절차적"): geneCol/storeCol/geneColP 가 고정 4색 팔레트 대신 *황금비 색상환 해시*(hue=fract(g·φ⁻¹) HSV→RGB) — 혈통이 무한히 갈려도 author 0 으로 색이 분화(고정 팔레트 캡 제거). 무유전(g=0)은 호박색 경로 그대로(과거 렌더 불변).
   *   파생 바람 렌즈(§5 "파생: 바람·해류"): ∇E(흐름량 중앙차분)로 하류 방향 flowmap 위상을 만들어, FS 에서 uTime 이류 띠로 발광을 변조 — 흐르는 에너지의 *세기*에 더해 *방향*을 보인다. 코어 불변(GPU 파생·도함수 읽기)·분포 author 0. 약한 ∇E/무흐름 셀은 flowVis=1(발광 불변).
   *   별 FSM 렌즈(§5 빛 "FSM 이산 분기, lerp 금지"): 별 텍스처가 아닌 sim.stars[].state(0 kindling·1 burning·2 ash)를 읽어 *이산 재질* 점(VS_STAR/FS_STAR)으로 — 색·크기·높이가 문턱에서 딱 갈린다(연속 변조 아님). kIgnite=0 이면 stars 빈 배열 → no-op(필드 없으면 안 그림).
   * 두 뷰가 *같은 실루엣*인 자리는 버그가 아니라 §5 진단(시뮬에 형태가 없음) — 형태는 시뮬(형태 사다리)이 빚으면 렌즈가 공짜로 받는다.
   * 물질 다속성, 속성마다 다른 *읽기 함수*: 상(3분기 고체/액체/공허·lerp 0) · 조성(G→색조) · 밀도(R→밝기·불투명) · 광택(액체만 반짝). */
  var VS_WORLD = [
    '#version 300 es',
    'precision highp float;',
    'layout(location=0) in vec2 aCell;',
    'uniform sampler2D uE;',
    'uniform mat4 uMVP;',
    'uniform float uSat, uHS, uSatR, uSatA;',
    'uniform ivec2 uDim;',
    'out vec3 vBase; out vec3 vNormal; out float vGlow; out float vHot; out float vWet; out vec3 vWorld; out float vFlowPhase; out float vFlowMag;',
    'float hOf(float e){ return min(uHS*log(1.0+max(e,0.0))/log(1.0+uSat), uHS*2.2); }',
    'float actFrac(float a){ return smoothstep(0.16, 1.0, clamp(a/uSatA, 0.0, 1.0)); }', // A→흐르는 에너지 비율(소산 극단만 큼)
    'float matH(vec4 t){',                                  // 물질 높이 = hOf(R) only — 에너지(흐르든 고이든)는 z 를 안 만든다. 응축상 R 만 공간을 점유(RENDER §2). 물(고인 E)도 안 솟고 R 위에 얹힌다(§5)
    '  return hOf(t.g);',
    '}',
    'float hAtXY(int x, int y){',                           // 이웃 물질 높이(법선용) — 토러스 wrap
    '  x=(x+uDim.x)%uDim.x; y=(y+uDim.y)%uDim.y;',
    '  return matH(texelFetch(uE, ivec2(x,y), 0));',
    '}',
    'float rAt(int x, int y){',                             // 이웃 R(저장체) — 토러스 wrap (∇R 거칠기용)
    '  x=(x+uDim.x)%uDim.x; y=(y+uDim.y)%uDim.y;',
    '  return texelFetch(uE, ivec2(x,y), 0).g;',
    '}',
    'float eAt(int x, int y){',                             // 이웃 E(흐름량) — 토러스 wrap (∇E 바람용)
    '  x=(x+uDim.x)%uDim.x; y=(y+uDim.y)%uDim.y;',
    '  return texelFetch(uE, ivec2(x,y), 0).r;',
    '}',
    'float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }', // 셀 해시 → 절차적 미세 노멀 방향
    'vec3 geneCol(float tag){',                             // 유전형 클론 색 — storeCol 과 동일 절차적 해시(혈통 무한 분화, RENDER §4)
    '  int g=int(tag+0.5);',
    '  if (g<=0) return vec3(0.784,0.608,0.416);',          // 0 = 무유전(여기선 도달 안 함 — 돌 경로가 가져감)
    '  float h=fract(float(g)*0.6180339887);',              // 황금비 저불일치 색상환
    '  float s=0.55+0.18*fract(float(g)*0.3247);',
    '  float v=0.80+0.15*fract(float(g)*0.7654);',
    '  vec3 r=clamp(abs(mod(h*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0);',
    '  return v*mix(vec3(1.0), r, s);',
    '}',
    'void main(){',
    '  int x=int(aCell.x), y=int(aCell.y);',
    '  vec4 t=texelFetch(uE, ivec2(x,y), 0);',              // r=E, g=R, b=G태그, a=A활성도
    '  float E=t.r, Rr=t.g, tag=t.b;',
    '  float af=actFrac(t.a);',                             // 흐르는 에너지 비율
    '  float liquidE=E*(1.0-af);',                          // 저활성 E = 액체 물질(고인 물)
    '  float flowE=E*af;',                                  // 고활성 E = 흐르는 에너지(빛 — 높이서 뺌)
    /* 상(phase) 3분기(lerp 0) — *색·재질* 읽기(높이 아님, 형태 author 0): 고체(무광) / 액체(투과·광택) / 공허(암흑) */
    '  bool isSolid = Rr > 0.08 && Rr >= liquidE;',         // 고체 우세 = 바위/나무
    '  bool isLiquid = !isSolid && liquidE > 0.03;',        // 액체 = 고인 물
    '  float dens=clamp(Rr/uSatR, 0.0, 1.0);',              // 밀도(R) → 밝기·불투명(고체 전용 함수)
    '  float depth=clamp(log(1.0+max(liquidE,0.0))/log(1.0+uSat),0.0,1.0);', // 깊이(액체 전용 함수, 색으로)
    '  vec3 store=(tag>0.5)? geneCol(tag) : vec3(0.322,0.278,0.247);',       // 조성(G) → 유전=나무/결정, 무유전=돌
    '  vec3 base; float wet;',
    '  if (isSolid){ base = store*(0.50+0.50*dens); wet=0.0; }',             // 고체 — 밀도로 견고/불투명
    '  else if (isLiquid){',                                                 // 물 = R 위 반투명 막(RENDER §5): 바닥 R 투과 + 깊이 흡광
    '    vec3 bottom = store*(0.42+0.58*dens);',                             // 물 아래 바닥 물질색(고체와 같은 셰이딩 — 비쳐 보일 대상)
    '    vec3 absorb = vec3(2.6, 1.15, 0.5);',                               // 색별 흡광계수: 빨강 먼저 죽고 파랑 남음(깊을수록 남빛)
    '    vec3 transmit = exp(-depth*absorb);',                               // 바닥 투과율(Beer-Lambert) — 얕으면≈1(바닥 비침)·깊으면→0(불투명)
    '    vec3 deep = vec3(0.02,0.09,0.22);',                                 // 깊은 물 산란색(짙은 남)
    '    base = bottom*transmit + deep*(1.0-transmit);',                     // 얕으면 바닥 청록 비침 · 깊으면 짙은 남(깊이=흡광색)
    '    wet=1.0;',                                                          // 액체 — FS 에서 프레넬 반사·글린트
    '  }',
    '  else { base = vec3(0.018,0.022,0.035); wet=0.0; }',                   // 공허/기체 — 거의 암흑(빈 공간)
    '  vBase=base; vWet=wet;',
    '  vec3 nrm=vec3(hAtXY(x-1,y)-hAtXY(x+1,y), 2.0, hAtXY(x,y-1)-hAtXY(x,y+1));', // 법선=물질 기복(분포 그대로)
    /* 고체 거칠기(RENDER §5) — R 고주파(라플라시안 |∇²R|)로 미세 노멀 변조: 들쭉날쭉한 R=거친 암석, 매끈한 R=매끈.
     * 높이 불변(분포 재성형 0)·셰이딩 노멀만(§6 도함수 읽기 허용). 진폭=∇R 거침, 방향=셀 해시(서브셀 디테일은 절차적). */
    '  float lapR = rAt(x+1,y)+rAt(x-1,y)+rAt(x,y+1)+rAt(x,y-1) - 4.0*Rr;',        // R 라플라시안 = 고주파 성분
    '  float rough = (isSolid ? 1.0 : 0.0) * clamp(abs(lapR)/max(uSatR,1e-3)*1.6, 0.0, 1.0);', // 거칠기(고체만·매끈 R→0)
    '  vec3 detail = vec3(hash21(aCell)-0.5, 0.0, hash21(aCell+19.7)-0.5);',       // 절차적 미세 facet 방향(셀별)
    '  vNormal=normalize(nrm + detail*rough*1.3);',                                // 거친 곳만 법선 흔들림 → 무광 암석 질감
    '  vHot=af;',                                           // 색온도(흰빛 정도 — 활성 클수록 흼)
    '  vGlow=af*(0.55 + 0.9*clamp(flowE/uSat, 0.0, 1.0));', // 발광 세기 = 에너지(흐르는 E·A) — 높이서 뺀 만큼 빛으로
    /* ∇E → 파생 바람(RENDER §5 "파생: 바람·해류") — 흐름량 기울기를 읽어 흐르는 에너지의 *방향*을 flowmap 위상으로.
     * 코어 불변(GPU 파생·도함수 읽기)·분포 author 0 — FS 에서 시간 이류 띠로 발광만 변조(세기에 더해 방향을 보인다). */
    '  vec2 gradE=vec2(eAt(x+1,y)-eAt(x-1,y), eAt(x,y+1)-eAt(x,y-1));', // ∇E (중앙차분)
    '  float gmag=length(gradE);',
    '  vec2 flowDir=(gmag>1e-4)? -gradE/gmag : vec2(0.0);', // 하류 방향(고E→저E = 흐름)
    '  vFlowPhase=dot(vec2(aCell.x,aCell.y), flowDir)*1.1;', // flowmap 위상 — 흐름 따라 정렬된 띠(FS 에서 시간 이동)
    '  vFlowMag=clamp(gmag/(uSat*0.15), 0.0, 1.0);',        // ∇E 세기(약하면 무흐름 → 방향 안 보임)
    '  vec3 wpos=vec3(aCell.x, matH(t), aCell.y);',         // 월드 좌표(FS 프레넬·글린트 시선벡터용)
    '  vWorld=wpos;',
    '  gl_Position=uMVP*vec4(wpos, 1.0);',                  // 높이 = 물질(R) only — 에너지(흐르든 고이든) z 기여 0. 분포 재성형 0(물은 z 서 빠지되 분포 안 건드림)
    '}'].join('\n');

  var FS_WORLD = [
    '#version 300 es',
    'precision highp float;',
    'in vec3 vBase; in vec3 vNormal; in float vGlow; in float vHot; in float vWet; in vec3 vWorld; in float vFlowPhase; in float vFlowMag;',
    'uniform vec3 uLight, uEye;',
    'uniform float uTime;',
    'out vec4 o;',
    'void main(){',
    '  vec3 N=normalize(vNormal);',
    '  float d=max(dot(N,uLight),0.0);',
    '  vec3 lit=vBase*(0.30+0.70*d);',                      // 물질 = 조명 받는 표면(높이·법선·색)
    '  vec3 V=normalize(uEye - vWorld);',                   // 시선 벡터(프레넬·글린트용)
    '  vec3 Rl=reflect(-uLight, N);',                       // 광원 반사 벡터(시선기반 스페큘러)
    '  float spec=vWet*pow(max(dot(Rl,V),0.0), 40.0)*0.9;', // 액체 전용 — 매끈 표면 글린트(고체는 vWet=0 → 무광)
    '  float fres=0.02 + 0.98*pow(1.0-max(dot(N,V),0.0), 5.0);', // 프레넬 — 비스듬히 볼수록 반사↑(정면=투과)
    '  vec3 sky=vec3(0.32,0.46,0.62);',                     // 물이 반사하는 주변광/하늘색
    '  vec3 surf=mix(lit, sky, fres*vWet);',                // 물만 프레넬 반사(바닥 투과 ↔ 표면 반사 보간), 고체 불변
    '  vec3 fire=mix(vec3(1.0,0.55,0.18), vec3(1.0,0.95,0.72), vHot);', // 뜨거울수록 흰빛
    '  float stripe=0.5+0.5*sin(vFlowPhase - uTime*2.2);',  // ∇E flowmap — 흐름 방향으로 이동하는 밝기 띠(이류)
    '  float flowVis=mix(1.0, 0.55+0.9*stripe, vFlowMag*vHot);', // 빠른 흐름·강한 ∇E 에서만 방향 드러남(무흐름=1, 발광 불변)
    '  o=vec4(surf + vec3(spec) + fire*vGlow*1.6*flowVis, 1.0);', // 물질/물 표면 + 글린트 + 에너지 발광(흐름 방향 변조)
    '}'].join('\n');

  /* ── voxel 세계 셰이더 (L-V1 — VOXEL.md §4) — 인스턴스드 단위 큐브로 *R 점유* 칸을 그린다.
   * 척추 정합(VOXEL V-A·RENDER §6 형태 author 0): 2.5D 에선 렌더러가 "어느 양이 높이가 되는가"를 정했지만(hOf),
   *   3D 에선 *높이가 시뮬의 사실*이다 — voxel 위치 = sim (x,y,z) 그대로. sim-z 가 월드 위(중력 방향 z=0 바닥), sim-y 가 화면 깊이.
   *   렌더러에 남는 권한은 *색·재질·빛*뿐: 상(고체/액체/빛) · 조성(G→나무/돌) · 밀도(R) · 발광(흐르는 E·A).
   * E 밝기(VOXEL V-B "고도 표현 폐기 → 색 밝기"): 흐르는 E(고활성)는 발광(클수록 밝게), 고인 E(저활성)는 물(파란 voxel).
   * L-V2 물 볼륨: 물 큐브를 *반투명*으로 — 깊이(고인 E)로 Beer-Lambert 흡광·표면 프레넬(시선 비스듬할수록 반사↑) +
   *   불투명을 먼저 그려 뒤 큐브가 *비친다*. 쌓인 물 voxel 들이 블렌드로 누적돼 *볼륨감*이 난다(층이 깊을수록 짙음).
   * L-V3 거칠기: 고체 큐브 면 노멀을 R 라플라시안(|∇²R| — CPU 가 인스턴스에 실어 보냄)로 변조 — 들쭉날쭉한 R=거친 암석·매끈한 R=매끈.
   *   높이 불변(분포 재성형 0)·셰이딩 노멀만(RENDER §6 도함수 읽기). 물·빛 큐브는 rough=0(불변).
   * L-V4 바람: 빛 큐브 발광을 ∇E 하류 방향(CPU 가 월드 좌표로 실어 보냄)으로 uTime 이류 띠로 변조 — 흐르는 에너지의 세기에 더해 *방향*.
   *   코어 불변(GPU 파생·도함수 읽기)·분포 author 0. 무흐름/저활성 셀은 flowVis=1(발광 불변). */
  var VS_VOXEL = [
    '#version 300 es',
    'precision highp float;',
    'layout(location=0) in vec3 aPos;',                     // 단위 큐브 코너 [-0.5,0.5]
    'layout(location=1) in vec3 aNrm;',                     // 큐브 면 법선
    'layout(location=2) in vec3 aCell;',                    // sim 셀 (x,y,z) — 인스턴스별
    'layout(location=3) in vec4 aField;',                   // (E,R,G태그,A) — 인스턴스별
    'layout(location=4) in float aRough;',                  // 거칠기 |∇²R|(L-V3) — 인스턴스별(고체만 >0)
    'layout(location=5) in vec3 aFlow;',                    // ∇E 하류 방향·세기(월드, L-V4) — 인스턴스별(빛만 ≠0)
    'uniform mat4 uMVP;',
    'uniform float uSat, uSatR, uSatA, uScale;',
    'out vec3 vBase; out vec3 vNormal; out float vGlow; out float vHot; out float vWet; out float vAlpha; out vec3 vWorld; out float vRough; out vec3 vFlow;',
    'float actFrac(float a){ return smoothstep(0.16, 1.0, clamp(a/uSatA, 0.0, 1.0)); }', // A→흐르는 에너지 비율
    'vec3 geneCol(float tag){',                             // 유전형 클론 색 — VS_WORLD 와 동일 절차적 해시(혈통 무한 분화, RENDER §4)
    '  int g=int(tag+0.5);',
    '  if (g<=0) return vec3(0.784,0.608,0.416);',
    '  float h=fract(float(g)*0.6180339887);',
    '  float s=0.55+0.18*fract(float(g)*0.3247);',
    '  float v=0.80+0.15*fract(float(g)*0.7654);',
    '  vec3 r=clamp(abs(mod(h*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0);',
    '  return v*mix(vec3(1.0), r, s);',
    '}',
    'void main(){',
    '  float E=aField.x, Rr=aField.y, tag=aField.z;',
    '  float af=actFrac(aField.w);',                        // 흐르는 에너지 비율
    '  float liquidE=E*(1.0-af), flowE=E*af;',
    '  bool isSolid = Rr>0.08 && Rr>=liquidE;',             // 고체 우세 = 바위/나무 (CPU 방출 문턱과 동일)
    '  bool isLiquid = !isSolid && liquidE>0.05;',          // 액체 = 고인 물 (CPU water 분류와 동일)
    '  float dens=clamp(Rr/uSatR, 0.0, 1.0);',              // 밀도(R) → 밝기
    '  float depth=clamp(log(1.0+max(liquidE,0.0))/log(1.0+uSat),0.0,1.0);', // 깊이(액체)
    '  vec3 store=(tag>0.5)? geneCol(tag) : vec3(0.322,0.278,0.247);',       // 조성: 유전=나무/결정, 무유전=돌
    '  vec3 base; float wet=0.0, alpha=1.0;',
    '  if (isSolid){ base = store*(0.50+0.50*dens); }',     // 고체 — 밀도로 견고(불투명)
    '  else if (isLiquid){',                                // 물(L-V2 반투명 볼륨)
    '    vec3 absorb=vec3(2.6,1.15,0.5);',                  // 색별 흡광: 빨강 먼저 죽고 파랑 남음(깊을수록 남빛)
    '    vec3 transmit=exp(-depth*absorb);',                // Beer-Lambert 투과율(얕음≈1·깊음→0)
    '    base = mix(vec3(0.02,0.10,0.26), vec3(0.12,0.46,0.62), transmit);', // 얕음 청록 ↔ 깊음 남빛
    '    wet=1.0; alpha=clamp(0.30+0.62*depth, 0.30, 0.94);', // 얕으면 더 비치고(투명)·깊으면 짙음
    '  }',
    '  else { base = vec3(0.04,0.07,0.11); }',              // 빛만 있는 저밀도 칸 — 어두운 바탕에 발광 얹힘
    '  vBase=base; vHot=af; vWet=wet; vAlpha=alpha; vRough=aRough; vFlow=aFlow;',
    '  vGlow=af*(0.55 + 0.9*clamp(flowE/uSat, 0.0, 1.0));', // 발광 = 흐르는 E·A (클수록 밝게)
    '  vNormal=aNrm;',                                      // 축 정렬 큐브 — 모델 회전 없음(법선 그대로·FS 가 거칠기로 변조)
    '  vec3 center=vec3(aCell.x, aCell.z, aCell.y);',       // sim-z = 월드 위(y) · sim-y = 월드 깊이(z)
    '  vec3 wpos=center + aPos*(2.0*uScale);',              // 큐브 = center ± uScale(반변)
    '  vWorld=wpos;',                                       // 프레넬 시선벡터용 월드 좌표
    '  gl_Position=uMVP*vec4(wpos, 1.0);',
    '}'].join('\n');

  var FS_VOXEL = [
    '#version 300 es',
    'precision highp float;',
    'in vec3 vBase; in vec3 vNormal; in float vGlow; in float vHot; in float vWet; in float vAlpha; in vec3 vWorld; in float vRough; in vec3 vFlow;',
    'uniform vec3 uLight, uEye;',
    'uniform float uTime, uSat;',
    'out vec4 o;',
    'vec3 hash33(vec3 p){',                                 // 절차적 미세 노멀 방향(서브셀 facet) — 거친 암석 질감
    '  p=fract(p*vec3(0.1031,0.1030,0.0973));',
    '  p+=dot(p, p.yxz+33.33);',
    '  return fract((p.xxy+p.yxx)*p.zyx)*2.0-1.0;',
    '}',
    'void main(){',
    '  vec3 N=normalize(vNormal);',
    '  if (vRough>0.001){',                                 // L-V3 거칠기 — R 고주파 큰 고체 면 노멀을 서브셀 해시로 흔든다(들쭉날쭉=거침)
    '    vec3 j=hash33(floor(vWorld*6.0));',                // 월드 6분할 격자별 facet 방향(셰이딩만·높이 불변)
    '    N=normalize(N + j*vRough*0.7);',
    '  }',
    '  float d=max(dot(N,uLight),0.0);',
    '  vec3 lit=vBase*(0.34+0.66*d);',                      // 면 법선 램버트(큐브 면마다 음영)
    '  vec3 fire=mix(vec3(1.0,0.55,0.18), vec3(1.0,0.95,0.72), vHot);', // 뜨거울수록 흰빛
    '  float flowVis=1.0;',                                 // L-V4 ∇E 바람 — 하류 방향으로 이동하는 밝기 띠(이류)
    '  float flowMag=length(vFlow);',
    '  if (flowMag>1e-4){',
    '    vec3 fdir=vFlow/flowMag;',                         // 하류 단위 방향(월드)
    '    float stripe=0.5+0.5*sin(dot(vWorld, fdir)*1.2 - uTime*2.2);', // 흐름 따라 정렬된 띠가 시간에 이동
    '    flowVis=mix(1.0, 0.5+0.95*stripe, clamp(flowMag/(uSat*0.15),0.0,1.0)*vHot);', // 빠른 흐름·고활성에서만 방향 드러남
    '  }',
    '  vec3 emit=fire*vGlow*1.5*flowVis;',                  // 에너지 발광(흐름 방향 변조)
    '  if (vWet>0.5){',                                     // 물(L-V2) — 프레넬 반사 + 깊이 알파(반투명)
    '    vec3 V=normalize(uEye - vWorld);',
    '    float fres=0.03 + 0.97*pow(1.0-max(dot(N,V),0.0), 5.0);', // 비스듬할수록 표면 반사↑(정면=투과)
    '    vec3 sky=vec3(0.34,0.48,0.64);',                   // 물이 반사하는 하늘색
    '    vec3 rgb=mix(lit, sky, fres) + emit;',             // 투과(바닥 비침) ↔ 표면 반사 보간
    '    o=vec4(rgb, clamp(max(vAlpha, fres*0.9), 0.0, 1.0));', // 가장자리(프레넬) 더 또렷이
    '  } else {',
    '    o=vec4(lit + emit, 1.0);',                         // 불투명(고체·빛)
    '  }',
    '}'].join('\n');

  var VS_POINT = [
    '#version 300 es',
    'precision highp float;',
    'layout(location=0) in vec3 aAgent;',                   // (x, y, m)
    'layout(location=1) in float aGene;',                   // 생명 유전형 a.g(step-0016~) — 0=무유전. 2D drawHook 의 점 색과 일관.
    'layout(location=2) in float aZ;',                      // 생명 sim-z(step-0042~) — voxel 세계에서 점 높이(없으면 0=바닥)
    'uniform sampler2D uE;',
    'uniform mat4 uMVP;',
    'uniform float uSat, uHS, uPx;',
    'uniform ivec2 uDim;',
    'uniform int uVoxel;',                                  // 1=voxel 세계(에이전트는 바닥 sim z=0) · 0=레거시 하이트필드
    'out vec3 vCol;',                                       // 유전형 클론 색 → FS 로 전달(geneCol 과 동일 절차적 해시)
    'vec3 geneColP(float tag){',                            // 생명 점 색 — geneCol 과 동일 절차적 해시(혈통 무한 분화, RENDER §4)
    '  int g=int(tag+0.5);',
    '  if (g<=0) return vec3(0.96,0.84,0.40);',             // 0 = 무유전 → 기존 호박색(과거 step 불변)
    '  float hh=fract(float(g)*0.6180339887);',             // 황금비 저불일치 색상환
    '  float ss=0.55+0.18*fract(float(g)*0.3247);',
    '  float vv=0.82+0.14*fract(float(g)*0.7654);',         // 점은 발광이라 명도 floor 살짝 높임
    '  vec3 rr=clamp(abs(mod(hh*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0);',
    '  return vv*mix(vec3(1.0), rr, ss);',
    '}',
    'void main(){',
    '  float h;',                                           // 점 높이: voxel 세계는 sim-z(step-0042~ 생명 z-거주), 레거시는 하이트필드
    '  if (uVoxel==1){ h=aZ; }',                            // 생명이 z>0 에 살면(이동·번식·혼잡 z) 제 높이에 그린다 — 수직 컬럼이 보인다
    '  else { vec2 t=texelFetch(uE, ivec2(int(aAgent.x),int(aAgent.y)), 0).rg;',
    '         h=min(uHS*log(1.0+max(t.r+t.g,0.0))/log(1.0+uSat), uHS*2.2); }',
    '  vec4 cp=uMVP*vec4(aAgent.x, h+0.55, aAgent.y, 1.0);',
    '  gl_Position=cp;',
    '  vCol=geneColP(aGene);',                              // 유전형으로 점 색 분기(개체 클론 색)
    '  float wr=min(0.35+0.55*sqrt(max(aAgent.z,0.0)), 1.8);',  // 반경 ∝ √m (2D 와 동일 규칙)
    '  gl_PointSize=clamp(2.0*wr*uPx/max(cp.w,0.001), 2.0, 56.0);',
    '}'].join('\n');

  var FS_POINT = [
    '#version 300 es',
    'precision highp float;',
    'in vec3 vCol;',                                        // 유전형 클론 색(VS 에서)
    'out vec4 o;',
    'void main(){',
    '  vec2 d=gl_PointCoord-0.5; float r2=dot(d,d);',
    '  if (r2>0.25) discard;',
    '  float a=exp(-r2*16.0);',                             // 중심 핵 + 글로우 (가산 블렌딩 전제)
    '  o=vec4(vCol*a, a);',                                 // 유전형 색 발광(무유전은 호박색 — 불변)
    '}'].join('\n');

  /* ── 별 FSM 점 (RENDER §5 빛 — "FSM 상태로 이산 분기, lerp 금지") — 내생 별의 연소 상태를 *이산 재질*로.
   * 활성도(A 발광)는 연속 측정이라 *세기*만 비춘다 — FSM 라벨(kindling/burning/ash)은 *질적 상전이*(색·크기·높이가 문턱에서 딱 갈림).
   * 분포 author 0: 별 위치·상태는 시뮬이 정하고(sim.stars), 렌더러는 상태→재질 분기만 고른다. lerp 없이 정수 state 로 분기. */
  var VS_STAR = [
    '#version 300 es',
    'precision highp float;',
    'layout(location=0) in vec4 aStar;',                    // (x, y, z, state) — z=부력 상승 좌표(step-0035) · state: 0=living/kindling 1=burning 2=ash
    'uniform sampler2D uE;',
    'uniform mat4 uMVP;',
    'uniform float uSat, uHS, uPx;',
    'uniform ivec2 uDim;',
    'uniform int uVoxel;',                                  // 1=voxel 세계(부력 z 그대로) · 0=레거시 하이트필드
    'out vec3 vCol; out float vCore;',                      // 상태 색 + 핵 강도(FS 글로우 모양 — burning 날카로움·ash 흐림)
    'void main(){',
    '  int st=int(aStar.w+0.5);',                           // 연소 FSM 상태(이산)
    '  float h;',                                           // 별 높이: voxel 세계는 부력 z(천장까지) · 레거시는 하이트필드
    '  if (uVoxel==1){ h=aStar.z; }',                       // step-0035 부력 — 소산 극단이 떠오른 제 z(월드-y)
    '  else { vec2 t=texelFetch(uE, ivec2(int(aStar.x),int(aStar.y)), 0).rg;',
    '         h=min(uHS*log(1.0+max(t.r+t.g,0.0))/log(1.0+uSat), uHS*2.2); }',
    '  float lift; float rad; vec3 col;',
    '  if (st==1){ col=vec3(1.00,0.92,0.66); lift=0.95; rad=2.0; vCore=1.0; }',    // burning — 백열·크게·솟은 화염(고강도 emissive)
    '  else if (st==2){ col=vec3(0.30,0.29,0.31); lift=0.16; rad=0.7; vCore=0.22; }', // ash — 식은 회색·작게·가라앉음(불응기 잔불)
    '  else { col=vec3(0.55,0.16,0.06); lift=0.45; rad=1.1; vCore=0.5; }',         // living/kindling — 어두운 응결핵(저활성·정지)
    '  vec4 cp=uMVP*vec4(aStar.x, h+lift, aStar.y, 1.0);',
    '  gl_Position=cp;',
    '  vCol=col;',
    '  gl_PointSize=clamp(2.0*rad*uPx/max(cp.w,0.001), 2.0, 80.0);',
    '}'].join('\n');

  var FS_STAR = [
    '#version 300 es',
    'precision highp float;',
    'in vec3 vCol; in float vCore;',
    'out vec4 o;',
    'void main(){',
    '  vec2 d=gl_PointCoord-0.5; float r2=dot(d,d);',
    '  if (r2>0.25) discard;',
    '  float core=exp(-r2*(8.0+24.0*vCore));',              // burning=날카로운 핵+넓은 글로우, ash=흐릿한 잔불
    '  o=vec4(vCol*core*(0.6+1.4*vCore), core);',           // 상태별 발광 세기(가산 블렌딩 — burning 만 흰빛 블룸)
    '}'].join('\n');

  /* ── 안개 점 (L-V5 — RENDER §5 "파생: 안개·응결") — 빈칸 미량 E 의 수렴(∇²E<0)을 부드러운 점 스프라이트로.
   * 겹쳐 쌓이는 저-알파 점 = 볼류메트릭 안개(응결). 진짜 raymarch(3D 텍스처)는 정제 백로그 — 여기선 점군 근사.
   * 분포 author 0: 위치·∇²E 는 시뮬 E 의 도함수(읽기), 렌더러는 흐릿한 푸른 막만 얹는다. */
  var VS_FOG = [
    '#version 300 es',
    'precision highp float;',
    'layout(location=0) in vec4 aFog;',                     // (x, y, z, density) — sim 셀 + 안개 농도
    'uniform mat4 uMVP;',
    'uniform float uPx;',
    'out float vDen;',
    'void main(){',
    '  vec3 c=vec3(aFog.x, aFog.z, aFog.y);',               // sim(x,y,z) → 월드(x, 위, 깊이)
    '  vec4 cp=uMVP*vec4(c, 1.0);',
    '  gl_Position=cp;',
    '  vDen=aFog.w;',
    '  gl_PointSize=clamp(2.6*uPx/max(cp.w,0.001), 4.0, 64.0);', // 셀보다 큰 스프라이트(겹쳐 부드럽게)
    '}'].join('\n');

  var FS_FOG = [
    '#version 300 es',
    'precision highp float;',
    'in float vDen;',
    'out vec4 o;',
    'void main(){',
    '  vec2 d=gl_PointCoord-0.5; float r2=dot(d,d);',
    '  if (r2>0.25) discard;',
    '  float a=exp(-r2*5.0)*vDen*0.20;',                    // 부드러운 가우시안 × 농도 × 낮은 세기(겹쳐 쌓임 = 볼륨)
    '  o=vec4(vec3(0.62,0.70,0.82)*a, a);',                 // 푸르스름한 흰 안개(알파-오버 — 뒤를 흐리게)
    '}'].join('\n');

  var VS_LINE = [
    '#version 300 es',
    'precision highp float;',
    'layout(location=0) in vec3 aPos;',
    'layout(location=1) in vec3 aCol;',
    'uniform mat4 uMVP;',
    'out vec3 vCol;',
    'void main(){ vCol=aCol; gl_Position=uMVP*vec4(aPos,1.0); }'
  ].join('\n');

  var FS_LINE = [
    '#version 300 es',
    'precision highp float;',
    'in vec3 vCol;',
    'out vec4 o;',
    'void main(){ o=vec4(vCol, 0.95); }'
  ].join('\n');

  function initGL() {
    var gl = S.gl;
    R = {};
    R.progT = mkProg(gl, VS_TERRAIN, FS_TERRAIN);
    R.progV = mkProg(gl, VS_VOXEL, FS_VOXEL);               // voxel 세계 렌즈(L-V1 — R 점유 인스턴스드 큐브)
    R.progP = mkProg(gl, VS_POINT, FS_POINT);
    R.progS = mkProg(gl, VS_STAR, FS_STAR);                 // 별 FSM 이산 재질 점(RENDER §5 빛)
    R.progF = mkProg(gl, VS_FOG, FS_FOG);                   // 안개 점(L-V5 — ∇²E 응결)
    R.progL = mkProg(gl, VS_LINE, FS_LINE);
    R.uT = locs(gl, R.progT, ['uE', 'uMVP', 'uSat', 'uHS', 'uSatR', 'uDim', 'uLight']);
    R.uV = locs(gl, R.progV, ['uMVP', 'uSat', 'uSatR', 'uSatA', 'uScale', 'uLight', 'uEye', 'uTime']);
    R.uP = locs(gl, R.progP, ['uE', 'uMVP', 'uSat', 'uHS', 'uDim', 'uPx', 'uVoxel']);
    R.uS = locs(gl, R.progS, ['uE', 'uMVP', 'uSat', 'uHS', 'uDim', 'uPx', 'uVoxel']);
    R.uF = locs(gl, R.progF, ['uMVP', 'uPx']);
    R.uL = locs(gl, R.progL, ['uMVP']);
    R.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, R.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    R.vaoT = gl.createVertexArray(); R.bufCell = gl.createBuffer(); R.bufIdx = gl.createBuffer();
    R.bufCube = gl.createBuffer(); R.bufCubeIdx = gl.createBuffer();
    R.vaoV = gl.createVertexArray(); R.bufVox = gl.createBuffer();     // 불투명 voxel(고체·빛)
    R.vaoVW = gl.createVertexArray(); R.bufVoxW = gl.createBuffer();   // 물 voxel(반투명, L-V2)
    R.vaoP = gl.createVertexArray(); R.bufAg = gl.createBuffer();
    R.vaoS = gl.createVertexArray(); R.bufStar = gl.createBuffer();
    R.vaoF = gl.createVertexArray(); R.bufFog = gl.createBuffer();     // 안개 점(L-V5)
    R.vaoL = gl.createVertexArray(); R.bufLn = gl.createBuffer();      // 오버레이 라인(레거시 하이트필드)
    R.vaoLV = gl.createVertexArray(); R.bufLnV = gl.createBuffer();    // 오버레이 라인(voxel 3D)
    /* ── voxel VAO(L-V1·L-V2): 단위 큐브(정점 24=면당 4·법선 per-face) 공유 + 인스턴스(셀+필드, divisor 1).
     * 불투명·물 두 VAO 가 같은 큐브 버퍼를 쓰되 인스턴스 버퍼만 다르다(분리 패스 — 불투명 먼저·물 나중). ── */
    gl.bindBuffer(gl.ARRAY_BUFFER, R.bufCube);
    gl.bufferData(gl.ARRAY_BUFFER, cubeVerts(), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, R.bufCubeIdx);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cubeIdx(), gl.STATIC_DRAW);                      // 36 = 12 삼각형
    function bindVoxVAO(vao, instBuf) {
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, R.bufCube);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);   // 큐브 코너
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);  // 면 법선
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, R.bufCubeIdx);                                  // VAO 가 인덱스 버퍼 기억
      gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);                                               // 인스턴스 stride 44: (x,y,z, E,R,G,A, rough, fx,fy,fz)
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 44, 0);    // 셀 (x,y,z)
      gl.vertexAttribDivisor(2, 1);
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 44, 12);   // 필드 (E,R,G,A)
      gl.vertexAttribDivisor(3, 1);
      gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 1, gl.FLOAT, false, 44, 28);   // 거칠기(∇R, L-V3)
      gl.vertexAttribDivisor(4, 1);
      gl.enableVertexAttribArray(5); gl.vertexAttribPointer(5, 3, gl.FLOAT, false, 44, 32);   // ∇E 하류 방향(월드, L-V4)
      gl.vertexAttribDivisor(5, 1);
    }
    bindVoxVAO(R.vaoV, R.bufVox);
    bindVoxVAO(R.vaoVW, R.bufVoxW);
    gl.bindVertexArray(R.vaoP);
    gl.bindBuffer(gl.ARRAY_BUFFER, R.bufAg);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);   // (x,y,m) stride 20 — g·z 가 4·5번째 float
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 20, 12);  // a.g(유전형 태그) — geneColP 로 점 색 분기
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 20, 16);  // a.z(sim-z, step-0042~) — voxel 세계 점 높이
    gl.bindVertexArray(R.vaoS);
    gl.bindBuffer(gl.ARRAY_BUFFER, R.bufStar);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);   // (x,y,z,state) stride 16 — 별 FSM 점(z=부력 높이)
    gl.bindVertexArray(R.vaoF);
    gl.bindBuffer(gl.ARRAY_BUFFER, R.bufFog);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);   // (x,y,z,density) stride 16 — 안개 점(L-V5)
    gl.bindVertexArray(R.vaoL);
    gl.bindBuffer(gl.ARRAY_BUFFER, R.bufLn);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    gl.bindVertexArray(R.vaoLV);                            // voxel 3D 오버레이 라인(같은 포맷·다른 버퍼)
    gl.bindBuffer(gl.ARRAY_BUFFER, R.bufLnV);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    gl.bindVertexArray(null);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.043, 0.051, 0.064, 1);
    R.W = 0; R.H = 0; R.sat = 8; R.satR = 1.5; R.satA = 1e-6;
    R.t0 = now();                                          // 애니메이션 시간 기준점 — uTime 을 세션 상대(작은 값)로 묶어 float32 정밀도 보존(긴 세션·Date.now 폴백 대비)
  }

  /* 격자 크기에 맞춘 정적 버퍼 — 정점=셀 중심(W·H개), 인덱스=쿼드 2삼각형. 크기가 바뀌면 재생성
   * (voxel 확장 경첩: W·H 가 코어에서 오므로 이후 step 의 격자 변화도 자동 수용). */
  function ensureGrid(W, H) {
    var gl = S.gl;
    if (R.W === W && R.H === H) return;
    if (W * H > 65536) throw new Error('격자 ' + W + '×' + H + ' — uint16 인덱스 한도 초과');
    R.W = W; R.H = H;
    var cells = new Float32Array(W * H * 2);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      cells[(y * W + x) * 2] = x; cells[(y * W + x) * 2 + 1] = y;
    }
    var idx = new Uint16Array((W - 1) * (H - 1) * 6), n = 0;
    for (y = 0; y < H - 1; y++) for (x = 0; x < W - 1; x++) {
      var i0 = y * W + x, i1 = i0 + 1, i2 = i0 + W, i3 = i2 + 1;
      idx[n++] = i0; idx[n++] = i2; idx[n++] = i1;
      idx[n++] = i1; idx[n++] = i2; idx[n++] = i3;
    }
    gl.bindVertexArray(R.vaoT);
    gl.bindBuffer(gl.ARRAY_BUFFER, R.bufCell);
    gl.bufferData(gl.ARRAY_BUFFER, cells, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, R.bufIdx);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    R.nIdx = idx.length;
    gl.bindTexture(gl.TEXTURE_2D, R.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, W, H, 0, gl.RGBA, gl.FLOAT, null);
    R.e32 = new Float32Array(W * H * 4);                    // 인터리브 [E,R,G,0] — R 없는 step 은 g=0·G 없는 step 은 b=0
    S.cam.cx = (W - 1) / 2; S.cam.cz = (H - 1) / 2;         // 카메라 타깃 = 세계 중심
  }

  function mkProg(gl, vsSrc, fsSrc) {
    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('셰이더 컴파일: ' + gl.getShaderInfoLog(s));
      return s;
    }
    var pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('프로그램 링크: ' + gl.getProgramInfoLog(pr));
    return pr;
  }
  function locs(gl, prog, names) {
    var o = {};
    for (var i = 0; i < names.length; i++) o[names[i]] = gl.getUniformLocation(prog, names[i]);
    return o;
  }

  /* ── voxel 단위 큐브 (L-V1) — 면당 4정점·면 법선(부드러운 셰이딩 아닌 또렷한 6면). 코너 [-0.5,0.5] ── */
  function cubeVerts() {
    return new Float32Array([
      // +X                                       // -X
       0.5,-0.5,-0.5, 1,0,0,  0.5, 0.5,-0.5, 1,0,0,  0.5, 0.5, 0.5, 1,0,0,  0.5,-0.5, 0.5, 1,0,0,
      -0.5,-0.5, 0.5,-1,0,0, -0.5, 0.5, 0.5,-1,0,0, -0.5, 0.5,-0.5,-1,0,0, -0.5,-0.5,-0.5,-1,0,0,
      // +Y(위)                                   // -Y(아래)
      -0.5, 0.5,-0.5, 0,1,0, -0.5, 0.5, 0.5, 0,1,0,  0.5, 0.5, 0.5, 0,1,0,  0.5, 0.5,-0.5, 0,1,0,
      -0.5,-0.5, 0.5, 0,-1,0,-0.5,-0.5,-0.5, 0,-1,0, 0.5,-0.5,-0.5, 0,-1,0,  0.5,-0.5, 0.5, 0,-1,0,
      // +Z                                       // -Z
       0.5,-0.5, 0.5, 0,0,1,  0.5, 0.5, 0.5, 0,0,1, -0.5, 0.5, 0.5, 0,0,1, -0.5,-0.5, 0.5, 0,0,1,
      -0.5,-0.5,-0.5, 0,0,-1,-0.5, 0.5,-0.5, 0,0,-1, 0.5, 0.5,-0.5, 0,0,-1,  0.5,-0.5,-0.5, 0,0,-1
    ]);
  }
  function cubeIdx() {
    var idx = new Uint16Array(36);                          // 6면 × 2삼각형. 컬링 미사용 → winding 무관(법선만 음영 좌우)
    for (var f = 0; f < 6; f++) {
      var b = f * 4, o = f * 6;
      idx[o] = b; idx[o + 1] = b + 1; idx[o + 2] = b + 2;
      idx[o + 3] = b; idx[o + 4] = b + 2; idx[o + 5] = b + 3;
    }
    return idx;
  }

  /* ── 최소 행렬 수학 (column-major, WebGL 관례) ── */
  function mPersp(fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0]);
  }
  function mLookAt(eye, c, up) {
    var zx = eye[0] - c[0], zy = eye[1] - c[1], zz = eye[2] - c[2];
    var zl = 1 / (Math.hypot(zx, zy, zz) || 1); zx *= zl; zy *= zl; zz *= zl;
    var xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    var xl = 1 / (Math.hypot(xx, xy, xz) || 1); xx *= xl; xy *= xl; xz *= xl;
    var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([
      xx, yx, zx, 0,
      xy, yy, zy, 0,
      xz, yz, zz, 0,
      -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
      -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
      -(zx * eye[0] + zy * eye[1] + zz * eye[2]), 1]);
  }
  function mMul(a, b) {
    var o = new Float32Array(16);
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  }
  function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm3(v) {
    var l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /* ── 소도구 ── */
  function byId(id) {
    var d = global.document;
    return (d && d.getElementById) ? d.getElementById(id) : null;
  }
  function eachItem(panel, fn) {
    var rows = panel.controls || [];
    for (var r = 0; r < rows.length; r++) {
      var items = rows[r].items || [];
      for (var c = 0; c < items.length; c++) fn(items[c]);
    }
  }
  function now() { return (global.performance && global.performance.now) ? global.performance.now() : Date.now(); }

  var api = { attach: attach, bind: bind };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.HWS3D = api;
})(typeof window !== 'undefined' ? window : globalThis);
