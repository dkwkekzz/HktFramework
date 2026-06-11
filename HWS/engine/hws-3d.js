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
        title: 'WebGL2 3D 뷰 ↔ 2D 캔버스 전환. 프레젠테이션 전용 — 시뮬·검증에 영향 없음.' },
      { kind: 'check', id: 'worldview', label: '세계 해석(2분할)', def: true, view: true,
        title: '오른쪽에 세계 해석 뷰를 나란히 — 높이=*물질*(R 고체 only)·에너지(E)는 흐르든 고이든 z 안 솟음(고활성=발광·저활성=물 재질). 차이는 에너지 전부 z 제거 + 색·재질·빛(상/조성/밀도/광택). 렌더러는 형태를 author 안 함(분포 재성형 0). 왼쪽=에너지 변위(h=E+R). 설계: RENDER.md §2·§5. 프레젠테이션 전용.' }
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
    var e32 = R.e32, mx = 0, mxR = 0, mxA = 0;
    for (var i = 0; i < E.length; i++) {
      var v = E[i];
      e32[i * 4] = v; e32[i * 4 + 1] = Rf ? Rf[i] : 0; e32[i * 4 + 2] = Gf ? Gf[i] : 0; e32[i * 4 + 3] = Af ? Af[i] : 0;
      if (v > mx) mx = v;                                   // 자동 명암 포화점은 2D 와 동일하게 E 기준
      if (Rf && Rf[i] > mxR) mxR = Rf[i];                   // 저장체 색 포화점은 R 분포에 적응(step 마다 농축도 다름)
      if (Af && Af[i] > mxA) mxA = Af[i];                   // 활성도 발광 포화점은 A 분포에 적응(소산만 높은 끝 — A_burn/A_store≈26)
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
    /* ── 분할 레이아웃: 세계 해석 뷰가 켜지면 캔버스를 1:2 로 높여 두 정사각 뷰포트(위·아래 적층) ── */
    var split = isWorld();
    ensureCanvasSize(split);
    var cam = S.cam, glcv = S.dom.glcv;
    var Pm = mPersp(cam.fov, 1, 0.5, 800);                  // 뷰포트는 늘 정사각 → aspect=1 (분할 무관)
    var eye = camEye();                                     // 월드 카메라 위치 — 세계 해석 셰이더 프레넬/글린트 시선벡터
    var Vm = mLookAt(eye, [cam.cx + cam.tx, 0, cam.cz + cam.tz], [0, 1, 0]);
    var MVP = mMul(Pm, Vm);
    gl.viewport(0, 0, glcv.width, glcv.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    /* 오버레이 라인·생명 점 버퍼는 두 뷰포트가 공유 — 한 번만 만들어 올린다(좌·우에서 같은 마커) */
    var ln = buildLines(sim);
    if (ln.length) {
      gl.bindBuffer(gl.ARRAY_BUFFER, R.bufLn);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ln), gl.DYNAMIC_DRAW);
    }
    var ag = sim.agents || [], agN = 0;
    if (S.ov.life && ag.length) {
      var need = ag.length * 4;                            // (x, y, m, g) — g=생명 유전형 a.g(step-0016~, 0=무유전)
      if (!R.agArr || R.agArr.length < need) R.agArr = new Float32Array(Math.max(256, need * 2));
      for (var k = 0; k < ag.length; k++) {
        R.agArr[k * 4] = ag[k].x; R.agArr[k * 4 + 1] = ag[k].y; R.agArr[k * 4 + 2] = ag[k].m; R.agArr[k * 4 + 3] = ag[k].g || 0;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, R.bufAg);
      gl.bufferData(gl.ARRAY_BUFFER, R.agArr.subarray(0, need), gl.DYNAMIC_DRAW);
      agN = ag.length;
    }
    /* ── 패스: 위 = 에너지 변위(원본 렌즈), (분할 시) 아래 = 세계 해석(활성도 분류 렌즈).
     * GL 뷰포트 원점은 좌하단 → 위 뷰포트가 vy=CV_SIZE, 아래가 vy=0. 비분할이면 단일 뷰포트 vy=0. ── */
    drawView(split ? CV_SIZE : 0, false, MVP, ln.length, agN, glcv, Pm, eye);
    if (split) drawView(0, true, MVP, ln.length, agN, glcv, Pm, eye);
    drawHud(sim, split);
  }

  /* 한 뷰포트에 지형(prog 선택)+오버레이 라인+생명 점을 그린다. 버퍼·텍스처는 호출 전 업로드됨.
   * world=false → 에너지 변위 셰이더(progT, 원본), true → 세계 해석 셰이더(progW, 활성도 분류). */
  function drawView(vy, world, MVP, lnCount, agN, glcv, Pm, eye) {
    var gl = S.gl;
    gl.viewport(0, vy, CV_SIZE, CV_SIZE);                   // 뷰포트가 색·깊이 쓰기를 이 사각으로 한정(위·아래 충돌 없음)
    /* ① 지형(하이트필드) */
    var prog = world ? R.progW : R.progT, u = world ? R.uW : R.uT;
    gl.useProgram(prog);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, R.tex);
    gl.uniform1i(u.uE, 0);
    gl.uniformMatrix4fv(u.uMVP, false, MVP);
    gl.uniform1f(u.uSat, R.sat); gl.uniform1f(u.uHS, HS); gl.uniform1f(u.uSatR, R.satR);
    if (world) { gl.uniform1f(u.uSatA, R.satA); gl.uniform3f(u.uEye, eye[0], eye[1], eye[2]); }   // 물 프레넬/글린트 시선벡터
    gl.uniform2i(u.uDim, R.W, R.H);
    gl.uniform3f(u.uLight, 0.421, 0.781, 0.461);
    gl.depthMask(true); gl.disable(gl.BLEND);
    gl.bindVertexArray(R.vaoT);
    gl.drawElements(gl.TRIANGLES, R.nIdx, gl.UNSIGNED_SHORT, 0);
    /* ② 오버레이 라인(링·빔·경계·호버) */
    if (lnCount) {
      gl.useProgram(R.progL);
      gl.uniformMatrix4fv(R.uL.uMVP, false, MVP);
      gl.bindVertexArray(R.vaoL);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.drawArrays(gl.LINES, 0, lnCount / 6);
    }
    /* ③ 생명(발광 점) — 가산 블렌딩, 크기 ∝ √m (2D 와 동일 규칙) */
    if (agN) {
      gl.useProgram(R.progP);
      gl.uniform1i(R.uP.uE, 0);
      gl.uniformMatrix4fv(R.uP.uMVP, false, MVP);
      gl.uniform1f(R.uP.uSat, R.sat); gl.uniform1f(R.uP.uHS, HS);
      gl.uniform2i(R.uP.uDim, R.W, R.H);
      gl.uniform1f(R.uP.uPx, Pm[5] * CV_SIZE / 2);          // 세계 길이 → 픽셀 환산 계수(뷰포트 높이=CV_SIZE, 세로분할이어도 캔버스 전체높이 아님)
      gl.bindVertexArray(R.vaoP);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.depthMask(false);
      gl.drawArrays(gl.POINTS, 0, agN);
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
    /* ── 뷰포트 제목 라벨 (분할 시 위=에너지 변위 · 아래=세계 해석. HUD 는 좌상단 원점이라 아래 뷰포트는 y=CV_SIZE 만큼 내린다) ── */
    ctx.textAlign = 'center'; ctx.font = 'bold 13px Segoe UI';
    vlabel(ctx, CV_SIZE / 2, 21, '에너지 변위', '#9fb0c0');
    if (split) {
      vlabel(ctx, CV_SIZE / 2, CV_SIZE + 21, '세계 해석 (물질)', '#e6c860');
      /* 세계 해석 범례 — 높이=물질(R 고체 only)·에너지(E)는 z 0(고활성=빛·저활성=물 재질) 분해 (RENDER §2·§5) */
      ctx.textAlign = 'left'; ctx.font = '11px Consolas';
      var leg = [['#1a5a86', '물 · 액체 (저활성 E · 높이 0 · 투과)'], ['#52473f', '돌 · 암반 (R 고체 · 무광)'],
                 ['#c89a6a', '나무 · 결정 (R + 유전 G)'], ['#ffb04d', '빛 · 에너지 (고활성 A · 높이 0)']];
      var lx = 10, ly = CV_SIZE + 34, lh = 16;
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
            Math.sin(c.pitch) * c.dist,
            c.cz + c.tz + Math.cos(c.yaw) * cp * c.dist];
  }

  /* 마우스 이벤트 → 셀. 캔버스 밖이면 null. */
  function evCell(ev) {
    var glcv = S.dom.glcv, r = glcv.getBoundingClientRect();
    var mx = ev.clientX - r.left, my = ev.clientY - r.top;
    if (mx < 0 || my < 0 || mx >= r.width || my >= r.height) return null;
    /* 세로 분할 시 위/아래 어느 뷰포트인지 가려 뷰포트-로컬 NDC 로 — 두 뷰포트는 같은 카메라/MVP 라 픽킹 식 동일 */
    var split = isWorld();
    var halfCss = split ? r.height / 2 : r.height;          // CSS 높이 기준 한 뷰포트 높이
    var localY = (split && my >= halfCss) ? my - halfCss : my;
    return pick(mx / r.width * 2 - 1, 1 - localY / halfCss * 2);
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
    var aspect = 1;                                         // 뷰포트는 늘 정사각(CV_SIZE²) — 분할이어도 1 (render 의 MVP 와 일치)
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

  /* ── 세계 해석 셰이더 (INTERPRET §5b — 물질 표현) — 같은 텍스처(E,R,G,A)를 *물질/에너지*로 갈라 읽는다.
   * 척추 정합(SPINE 척추 체크 2·INTERPRET §4): 렌더러는 *형태(실루엣)를 author 하지 않는다* — R·E *분포*는 시뮬이 정한다.
   *   렌더러에 허용된 차이는 둘뿐: ① *어느 양이 높이가 되는가*(물질=R 만, 에너지는 흐르든 고이든 빼서 빛·재질로 — §4 "정직한 읽기")
   *   ② *색·재질·빛*(상·조성·밀도·광택·발광 — §3). 높이로 분포를 *재성형*(예: 물 평탄화)하면 §4 가 금지한 형태 author 다.
   * 그래서 높이 = hOf(R) only — 에너지뷰(h=E+R)와 *에너지 전부(E)만큼* 갈린다(RENDER §2: 응축상 R 만 공간 점유).
   *   흐르는 에너지(고활성 E·A)는 솟지 않고 *빛*으로(별 연소·확산 전선). 고인 물(저활성 E)도 z 를 안 들어올리고 R 위에 *얹혀*(§5) *재질*로만 읽는다 — 분포는 그대로(평탄화 0, 그냥 z 에 안 든다).
   *   물 렌즈(§5 "물 = R 위 반투명 막"): 바닥 물질색(store·dens)을 깊이(저활성 E)로 흡광 블렌드(Beer-Lambert transmit=exp(-depth·absorb)) — 얕으면 바닥 비침·청록, 깊으면 짙은 남. FS 에서 프레넬(비스듬할수록 표면 반사↑)·시선기반 글린트. 고체는 vWet=0 → 불투명·무광 불변.
   *   고체 거칠기 렌즈(§5 "지형·거칠기"): R 라플라시안 |∇²R|(고주파 성분)으로 고체 노멀을 미세 변조 — 들쭉날쭉한 R=거친 암석, 매끈한 R=매끈. 높이는 불변(분포 재성형 0), 셰이딩 노멀만(§6 도함수 읽기). 진폭=∇R 거침·방향=셀 해시(서브셀 디테일 절차적). 액체/공허는 rough=0.
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
    'out vec3 vBase; out vec3 vNormal; out float vGlow; out float vHot; out float vWet; out vec3 vWorld;',
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
    'float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }', // 셀 해시 → 절차적 미세 노멀 방향
    'vec3 geneCol(float tag){',                             // 유전형 클론 색 — storeCol 과 동일 팔레트(2D GENE_COL 일관)
    '  int g=int(tag+0.5);',
    '  if (g==1) return vec3(0.910,0.376,0.376);',
    '  if (g==2) return vec3(0.471,0.784,0.376);',
    '  if (g==3) return vec3(0.376,0.659,0.910);',
    '  if (g>=4) return vec3(0.784,0.439,0.878);',
    '  return vec3(0.784,0.608,0.416);',                    // 0 = 무유전(여기선 도달 안 함 — 돌 경로가 가져감)
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
    '  vec3 wpos=vec3(aCell.x, matH(t), aCell.y);',         // 월드 좌표(FS 프레넬·글린트 시선벡터용)
    '  vWorld=wpos;',
    '  gl_Position=uMVP*vec4(wpos, 1.0);',                  // 높이 = 물질(R) only — 에너지(흐르든 고이든) z 기여 0. 분포 재성형 0(물은 z 서 빠지되 분포 안 건드림)
    '}'].join('\n');

  var FS_WORLD = [
    '#version 300 es',
    'precision highp float;',
    'in vec3 vBase; in vec3 vNormal; in float vGlow; in float vHot; in float vWet; in vec3 vWorld;',
    'uniform vec3 uLight, uEye;',
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
    '  o=vec4(surf + vec3(spec) + fire*vGlow*1.6, 1.0);',   // 물질/물 표면 + 글린트 + 에너지 발광(조명 무관)
    '}'].join('\n');

  var VS_POINT = [
    '#version 300 es',
    'precision highp float;',
    'layout(location=0) in vec3 aAgent;',                   // (x, y, m)
    'layout(location=1) in float aGene;',                   // 생명 유전형 a.g(step-0016~) — 0=무유전. 2D drawHook 의 점 색과 일관.
    'uniform sampler2D uE;',
    'uniform mat4 uMVP;',
    'uniform float uSat, uHS, uPx;',
    'uniform ivec2 uDim;',
    'out vec3 vCol;',                                       // 유전형 클론 색 → FS 로 전달(geneCol 팔레트, 2D GENE_COL 일관)
    'vec3 geneColP(float tag){',
    '  int g=int(tag+0.5);',
    '  if (g==1) return vec3(0.910,0.376,0.376);',          // tag1 빨강(저적합)
    '  if (g==2) return vec3(0.471,0.784,0.376);',          // tag2 초록
    '  if (g==3) return vec3(0.376,0.659,0.910);',          // tag3 파랑
    '  if (g>=4) return vec3(0.784,0.439,0.878);',          // tag4 보라(고적합)
    '  return vec3(0.96,0.84,0.40);',                       // 0 = 무유전 → 기존 호박색(과거 step 불변)
    '}',
    'void main(){',
    '  vec2 t=texelFetch(uE, ivec2(int(aAgent.x),int(aAgent.y)), 0).rg;',
    '  float h=min(uHS*log(1.0+max(t.r+t.g,0.0))/log(1.0+uSat), uHS*2.2);',
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
    R.progW = mkProg(gl, VS_WORLD, FS_WORLD);               // 세계 해석 렌즈(INTERPRET)
    R.progP = mkProg(gl, VS_POINT, FS_POINT);
    R.progL = mkProg(gl, VS_LINE, FS_LINE);
    R.uT = locs(gl, R.progT, ['uE', 'uMVP', 'uSat', 'uHS', 'uSatR', 'uDim', 'uLight']);
    R.uW = locs(gl, R.progW, ['uE', 'uMVP', 'uSat', 'uHS', 'uSatR', 'uSatA', 'uDim', 'uLight', 'uEye']);
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
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0);   // (x,y,m) stride 16 — 생명 유전형 g 가 4번째 float
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 16, 12);  // a.g(유전형 태그) — geneColP 로 점 색 분기
    gl.bindVertexArray(R.vaoL);
    gl.bindBuffer(gl.ARRAY_BUFFER, R.bufLn);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    gl.bindVertexArray(null);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.043, 0.051, 0.064, 1);
    R.W = 0; R.H = 0; R.sat = 8; R.satR = 1.5; R.satA = 1e-6;
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
