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
  var HS = 9.0;                      // 높이 스케일(세계 단위) — h = HS·log(1+E)/log(1+sat)
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
    cam: { yaw: -0.65, pitch: 0.95, dist: 95, fov: 45 * Math.PI / 180, tx: 0, tz: 0, cx: 31.5, cz: 31.5 },
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
        title: 'WebGL2 3D 뷰 ↔ 2D 캔버스 전환. 프레젠테이션 전용 — 시뮬·검증에 영향 없음.' }
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

  function initDom() {
    var doc = global.document;
    var cv = byId('cv');
    if (!doc || !cv || !cv.parentNode) { S.failed = true; return; }
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
    /* ── 동기화층: E(+R 있으면, +G 유전형 있으면) → RGBA32F 텍스처 (W·H×4 float — 매 프레임 갱신해도 무시할 비용) ──
     * r=E, g=R(저장체), b=G(유전형 태그, step-0015~. 없으면 0 → 무유전=호박색). a=예약(0). */
    var E = sim.E, Rf = sim.R || null, Gf = sim.G || null, e32 = R.e32, mx = 0, mxR = 0;
    for (var i = 0; i < E.length; i++) {
      var v = E[i];
      e32[i * 4] = v; e32[i * 4 + 1] = Rf ? Rf[i] : 0; e32[i * 4 + 2] = Gf ? Gf[i] : 0; e32[i * 4 + 3] = 0;
      if (v > mx) mx = v;                                   // 자동 명암 포화점은 2D 와 동일하게 E 기준
      if (Rf && Rf[i] > mxR) mxR = Rf[i];                   // 저장체 색 포화점은 R 분포에 적응(step 마다 농축도 다름)
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
    gl.bindTexture(gl.TEXTURE_2D, R.tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RGBA, gl.FLOAT, e32);
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
    /* ── 카메라 ── */
    var cam = S.cam, glcv = S.dom.glcv;
    var Pm = mPersp(cam.fov, glcv.width / glcv.height, 0.5, 800);
    var Vm = mLookAt(camEye(), [cam.cx + cam.tx, 0, cam.cz + cam.tz], [0, 1, 0]);
    var MVP = mMul(Pm, Vm);
    gl.viewport(0, 0, glcv.width, glcv.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    /* ── ① 지형(하이트필드) — VS 가 E 텍스처에서 높이·법선·색을 끌어낸다 ── */
    gl.useProgram(R.progT);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, R.tex);
    gl.uniform1i(R.uT.uE, 0);
    gl.uniformMatrix4fv(R.uT.uMVP, false, MVP);
    gl.uniform1f(R.uT.uSat, R.sat); gl.uniform1f(R.uT.uHS, HS);
    gl.uniform1f(R.uT.uSatR, R.satR);
    gl.uniform2i(R.uT.uDim, W, H);
    gl.uniform3f(R.uT.uLight, 0.421, 0.781, 0.461);
    gl.depthMask(true); gl.disable(gl.BLEND);
    gl.bindVertexArray(R.vaoT);
    gl.drawElements(gl.TRIANGLES, R.nIdx, gl.UNSIGNED_SHORT, 0);
    /* ── ② 오버레이 라인(링·빔·경계·호버) — CPU 가 표면 높이에 얹어 만든다 ── */
    var ln = buildLines(sim);
    if (ln.length) {
      gl.useProgram(R.progL);
      gl.uniformMatrix4fv(R.uL.uMVP, false, MVP);
      gl.bindVertexArray(R.vaoL);
      gl.bindBuffer(gl.ARRAY_BUFFER, R.bufLn);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ln), gl.DYNAMIC_DRAW);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.drawArrays(gl.LINES, 0, ln.length / 6);
    }
    /* ── ③ 생명(발광 점) — 가산 블렌딩, 크기 ∝ √m (2D 와 동일 규칙) ── */
    var ag = sim.agents || [];
    if (S.ov.life && ag.length) {
      var need = ag.length * 3;
      if (!R.agArr || R.agArr.length < need) R.agArr = new Float32Array(Math.max(192, need * 2));
      for (var k = 0; k < ag.length; k++) {
        R.agArr[k * 3] = ag[k].x; R.agArr[k * 3 + 1] = ag[k].y; R.agArr[k * 3 + 2] = ag[k].m;
      }
      gl.useProgram(R.progP);
      gl.uniform1i(R.uP.uE, 0);
      gl.uniformMatrix4fv(R.uP.uMVP, false, MVP);
      gl.uniform1f(R.uP.uSat, R.sat); gl.uniform1f(R.uP.uHS, HS);
      gl.uniform2i(R.uP.uDim, W, H);
      gl.uniform1f(R.uP.uPx, Pm[5] * glcv.height / 2);     // 세계 길이 → 픽셀 환산 계수
      gl.bindVertexArray(R.vaoP);
      gl.bindBuffer(gl.ARRAY_BUFFER, R.bufAg);
      gl.bufferData(gl.ARRAY_BUFFER, R.agArr.subarray(0, need), gl.DYNAMIC_DRAW);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);   // 가산 — 발광체
      gl.depthMask(false);
      gl.drawArrays(gl.POINTS, 0, ag.length);
    }
    gl.depthMask(true); gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    drawHud(sim);
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

  /* ── 높이 함수 — 셰이더 hOf 와 동일식(CPU, E+R 합산·클램프). 픽킹·오버레이가 공유한다. ── */
  function hCPU(e) {
    return Math.min(HS * Math.log(1 + Math.max(e, 0)) / Math.log(1 + (R ? R.sat : 8)), HS * 2.2);
  }
  function eBilin(sim, x, y) {                              // wrap 쌍선형 — 링이 표면을 매끈히 타게
    var W = sim.p.W, H = sim.p.H, E = sim.E, Rf = sim.R || null;
    var x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    function at(xx, yy) {
      xx = ((xx % W) + W) % W; yy = ((yy % H) + H) % H;
      var i = yy * W + xx;
      return E[i] + (Rf ? Rf[i] : 0);
    }
    return at(x0, y0) * (1 - fx) * (1 - fy) + at(x0 + 1, y0) * fx * (1 - fy)
         + at(x0, y0 + 1) * (1 - fx) * fy + at(x0 + 1, y0 + 1) * fx * fy;
  }
  function hAt(sim, x, y) { return hCPU(eBilin(sim, x, y)); }

  /* ════════ HUD (투명 2D 캔버스) — 스파크라인·호버 툴팁·토스트·조작 힌트 ════════ */

  function drawHud(sim) {
    var ctx = S.dom.hctx, wdt = S.dom.hud.width, hgt = S.dom.hud.height;
    ctx.clearRect(0, 0, wdt, hgt);
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
    if (S.hover) {                                          // 호버 셀 정보 — 2D 에 없던 관찰 보강
      var hv = S.hover, idx = hv.y * sim.p.W + hv.x;
      var txt = '셀 (' + hv.x + ',' + hv.y + ')  E ' + sim.E[idx].toFixed(3);
      if (sim.R && sim.R[idx] > 0.005) txt += '  ·  저장체 R ' + sim.R[idx].toFixed(2);
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
            Math.sin(c.pitch) * c.dist,
            c.cz + c.tz + Math.cos(c.yaw) * cp * c.dist];
  }

  /* 마우스 이벤트 → 셀. 캔버스 밖이면 null. */
  function evCell(ev) {
    var glcv = S.dom.glcv, r = glcv.getBoundingClientRect();
    var mx = ev.clientX - r.left, my = ev.clientY - r.top;
    if (mx < 0 || my < 0 || mx >= r.width || my >= r.height) return null;
    return pick(mx / r.width * 2 - 1, 1 - my / r.height * 2);
  }

  /* 픽킹 — 카메라 기저로 레이 생성 후 하이트필드 레이마칭(이분 정밀화). 셰이더와 같은 높이식 사용. */
  function pick(px, py) {
    var sim = S.sim;
    if (!sim) return null;
    var cam = S.cam, eye = camEye(), tgt = [cam.cx + cam.tx, 0, cam.cz + cam.tz];
    var fw = norm3([tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]]);
    var rt = norm3(cross3(fw, [0, 1, 0]));
    var up = cross3(rt, fw);
    var tf = Math.tan(cam.fov / 2);
    var aspect = S.dom.glcv.width / S.dom.glcv.height;
    var dir = norm3([
      fw[0] + rt[0] * px * tf * aspect + up[0] * py * tf,
      fw[1] + rt[1] * px * tf * aspect + up[1] * py * tf,
      fw[2] + rt[2] * px * tf * aspect + up[2] * py * tf
    ]);
    var T = cam.dist * 4 + 100, stepL = 0.5, prevF = null, prevT = 0;
    for (var t = 0; t <= T; t += stepL) {
      var x = eye[0] + dir[0] * t, y = eye[1] + dir[1] * t, z = eye[2] + dir[2] * t;
      var f = y - hAt(sim, x, z);
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
   * 높이 = hOf(E+R): 퇴적이 지형을 *키운다*(VISION-UE "pool 지속성→반영구 지형" 행의 구현). 태그(b)는 높이 무관(색만).
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
    'vec3 storeCol(float tag){',                            // 저장체 색 — 유전형 태그면 클론 색(2D GENE_COL 일관), 0 이면 호박색(무유전)
    '  int g=int(tag+0.5);',
    '  if (g==1) return vec3(0.910,0.376,0.376);',          // tag1(저적합) 빨강
    '  if (g==2) return vec3(0.471,0.784,0.376);',          // tag2 초록
    '  if (g==3) return vec3(0.376,0.659,0.910);',          // tag3 파랑
    '  if (g>=4) return vec3(0.784,0.439,0.878);',          // tag4(고적합) 보라
    '  return vec3(0.784,0.608,0.416);',                    // 0 = 무유전 호박색(G 없는 step 은 늘 이 경로 → 과거 렌더 불변)
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

  var VS_POINT = [
    '#version 300 es',
    'precision highp float;',
    'layout(location=0) in vec3 aAgent;',                   // (x, y, m)
    'uniform sampler2D uE;',
    'uniform mat4 uMVP;',
    'uniform float uSat, uHS, uPx;',
    'uniform ivec2 uDim;',
    'void main(){',
    '  vec2 t=texelFetch(uE, ivec2(int(aAgent.x),int(aAgent.y)), 0).rg;',
    '  float h=min(uHS*log(1.0+max(t.r+t.g,0.0))/log(1.0+uSat), uHS*2.2);',
    '  vec4 cp=uMVP*vec4(aAgent.x, h+0.55, aAgent.y, 1.0);',
    '  gl_Position=cp;',
    '  float wr=min(0.35+0.55*sqrt(max(aAgent.z,0.0)), 1.8);',  // 반경 ∝ √m (2D 와 동일 규칙)
    '  gl_PointSize=clamp(2.0*wr*uPx/max(cp.w,0.001), 2.0, 56.0);',
    '}'].join('\n');

  var FS_POINT = [
    '#version 300 es',
    'precision highp float;',
    'out vec4 o;',
    'void main(){',
    '  vec2 d=gl_PointCoord-0.5; float r2=dot(d,d);',
    '  if (r2>0.25) discard;',
    '  float a=exp(-r2*16.0);',                             // 중심 핵 + 글로우 (가산 블렌딩 전제)
    '  o=vec4(vec3(0.96,0.84,0.40)*a, a);',
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
    R.progP = mkProg(gl, VS_POINT, FS_POINT);
    R.progL = mkProg(gl, VS_LINE, FS_LINE);
    R.uT = locs(gl, R.progT, ['uE', 'uMVP', 'uSat', 'uHS', 'uSatR', 'uDim', 'uLight']);
    R.uP = locs(gl, R.progP, ['uE', 'uMVP', 'uSat', 'uHS', 'uDim', 'uPx']);
    R.uL = locs(gl, R.progL, ['uMVP']);
    R.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, R.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    R.vaoT = gl.createVertexArray(); R.bufCell = gl.createBuffer(); R.bufIdx = gl.createBuffer();
    R.vaoP = gl.createVertexArray(); R.bufAg = gl.createBuffer();
    R.vaoL = gl.createVertexArray(); R.bufLn = gl.createBuffer();
    gl.bindVertexArray(R.vaoP);
    gl.bindBuffer(gl.ARRAY_BUFFER, R.bufAg);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(R.vaoL);
    gl.bindBuffer(gl.ARRAY_BUFFER, R.bufLn);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    gl.bindVertexArray(null);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.043, 0.051, 0.064, 1);
    R.W = 0; R.H = 0; R.sat = 8; R.satR = 1.5;
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
